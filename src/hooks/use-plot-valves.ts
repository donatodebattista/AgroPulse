import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Valve, IrrigationCommand } from '@/types/database.types';
import { useAuth } from '@/context/auth-context';
import { withClockSkewRetry } from '@/utils/supabase-retry';
import { generateClientRequestId } from '@/utils/idempotency';

export interface ValveWithCommand extends Valve {
  pendingCommand?: IrrigationCommand | null;
}

export interface CommandFeedback {
  commandId: string;
  valveId: string;
  valveName?: string;
  action: 'open' | 'close';
  status: 'pending' | 'applied' | 'failed' | 'timeout';
  failureReason?: string | null;
  message: string;
}

export function usePlotValves(plotId: string | undefined) {
  const { user, currentRole } = useAuth();
  const [valves, setValves] = useState<ValveWithCommand[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<CommandFeedback | null>(null);

  // Referencias mutables para callbacks de Realtime y timers
  const valvesRef = useRef<ValveWithCommand[]>([]);
  valvesRef.current = valves;

  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpiar timers activos al desmontar
  useEffect(() => {
    return () => {
      if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
      if (simTimerRef.current) clearTimeout(simTimerRef.current);
    };
  }, []);

  // 1. Cargar Válvulas y Comandos Pendientes
  const fetchValves = useCallback(async () => {
    if (!plotId) {
      setValves([]);
      setIsLoading(false);
      return;
    }

    try {
      setError(null);

      // 1.1 Obtener válvulas del lote
      const { data: valvesData, error: valvesError } = await withClockSkewRetry(() =>
        supabase
          .from('valves')
          .select('*')
          .eq('plot_id', plotId)
          .order('name', { ascending: true })
      );

      if (valvesError) throw valvesError;

      const loadedValves: Valve[] = valvesData || [];
      if (loadedValves.length === 0) {
        setValves([]);
        return;
      }

      const valveIds = loadedValves.map((v) => v.id);

      // 1.2 Obtener comandos en estado 'pending' para estas válvulas (RF-16)
      const { data: commandsData, error: cmdError } = await withClockSkewRetry(() =>
        supabase
          .from('irrigation_commands')
          .select('*')
          .in('valve_id', valveIds)
          .eq('status', 'pending')
      );

      if (cmdError) {
        console.warn('[usePlotValves] No se pudieron verificar comandos pendientes:', cmdError.message);
      }

      const pendingCommands: IrrigationCommand[] = commandsData || [];

      // Mapear comandos pendientes a cada válvula
      const valvesWithStatus: ValveWithCommand[] = loadedValves.map((valve) => {
        const pending = pendingCommands.find((cmd) => cmd.valve_id === valve.id);
        return {
          ...valve,
          pendingCommand: pending || null,
        };
      });

      setValves(valvesWithStatus);
    } catch (err: any) {
      console.error('[usePlotValves] Error al cargar válvulas:', err);
      setError(err?.message || 'Error al obtener las válvulas del lote');
    } finally {
      setIsLoading(false);
    }
  }, [plotId]);

  useEffect(() => {
    setIsLoading(true);
    fetchValves();
  }, [fetchValves]);

  const fetchValvesRef = useRef(fetchValves);
  useEffect(() => {
    fetchValvesRef.current = fetchValves;
  }, [fetchValves]);

  // 2. Suscripción Supabase Realtime a cambios en válvulas y comandos (RF-13, RF-15)
  useEffect(() => {
    if (!plotId) return;

    const channelName = `valves-irrigation-${plotId}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      // Cambios de estado en la válvula (ej: open -> closed)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'valves',
          filter: `plot_id=eq.${plotId}`,
        },
        (payload) => {
          const updatedValve = payload.new as Valve;
          setValves((prev) =>
            prev.map((v) => (v.id === updatedValve.id ? { ...v, status: updatedValve.status } : v))
          );
        }
      )
      // Nuevos comandos de riego emitidos
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'irrigation_commands',
        },
        (payload) => {
          const newCmd = payload.new as IrrigationCommand;
          const belongsToPlot = valvesRef.current.some((v) => v.id === newCmd.valve_id);
          if (!belongsToPlot) return;

          if (newCmd.status === 'pending') {
            setValves((prev) =>
              prev.map((v) => (v.id === newCmd.valve_id ? { ...v, pendingCommand: newCmd } : v))
            );
          }
        }
      )
      // Transición del comando (pending -> applied / failed / cancelled) (RF-15)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'irrigation_commands',
        },
        (payload) => {
          const updatedCmd = payload.new as IrrigationCommand;
          const targetValve = valvesRef.current.find((v) => v.id === updatedCmd.valve_id);
          if (!targetValve) return;

          // Si el comando finalizó (applied o failed), removemos el bloqueo pending de la válvula
          if (updatedCmd.status !== 'pending') {
            setValves((prev) =>
              prev.map((v) =>
                v.id === updatedCmd.valve_id && v.pendingCommand?.id === updatedCmd.id
                  ? { ...v, pendingCommand: null }
                  : v
              )
            );
          }

          // Si este comando corresponde al feedback activo del usuario
          setActiveFeedback((current) => {
            if (!current || current.commandId !== updatedCmd.id) return current;

            // Limpiar timer de timeout RNF-05
            if (timeoutTimerRef.current) {
              clearTimeout(timeoutTimerRef.current);
              timeoutTimerRef.current = null;
            }

            if (updatedCmd.status === 'applied') {
              const actionVerb = updatedCmd.action === 'open' ? 'abierta' : 'cerrada';
              return {
                ...current,
                status: 'applied',
                message: `¡Orden aplicada en el actuador! La válvula "${targetValve.name}" ahora está ${actionVerb}.`,
              };
            }

            if (updatedCmd.status === 'failed') {
              return {
                ...current,
                status: 'failed',
                failureReason: updatedCmd.failure_reason,
                message: `Fallo en el actuador: ${updatedCmd.failure_reason || 'No se pudo aplicar el comando.'}`,
              };
            }

            return current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [plotId]);

  // 3. Emitir Comando de Riego con Idempotencia (RF-14, RF-16, RNF-05)
  const sendCommand = useCallback(
    async (params: {
      valveId: string;
      action: 'open' | 'close';
      durationMin?: number;
    }) => {
      const { valveId, action, durationMin } = params;

      // 3.1 Validación de Rol RLS (§8: Asesor bloqueado)
      if (currentRole === 'advisor') {
        throw new Error('Permisos insuficientes: los asesores agrónomos tienen acceso de solo lectura y no pueden emitir órdenes de riego.');
      }

      if (!user?.id) {
        throw new Error('Usuario no autenticado.');
      }

      // 3.2 Validación en UI de comando pendiente existente (RF-16)
      const valve = valvesRef.current.find((v) => v.id === valveId);
      if (valve?.pendingCommand) {
        throw new Error('La válvula ya tiene una orden de riego en proceso. Aguarde a que finalice antes de enviar otra (RF-16).');
      }

      // 3.3 Validación de parámetros de duración (1 a 120 minutos)
      if (action === 'open') {
        if (!durationMin || durationMin < 1 || durationMin > 120) {
          throw new Error('La duración del riego debe ser de entre 1 y 120 minutos.');
        }
      }

      // 3.4 Generación de client_request_id único para idempotencia estricta
      const clientRequestId = generateClientRequestId();

      try {
        // 3.5 Inserción en base de datos
        const { data, error: insertError } = await withClockSkewRetry(() =>
          supabase
            .from('irrigation_commands')
            .insert({
              valve_id: valveId,
              requested_by: user.id,
              action,
              duration_min: action === 'open' ? durationMin : null,
              status: 'pending',
              client_request_id: clientRequestId,
            })
            .select('*')
            .single()
        );

        if (insertError) {
          // Detectar colisión con el índice único de comando pendiente
          if (
            insertError.code === '23505' ||
            insertError.message?.includes('idx_unique_pending_command_per_valve')
          ) {
            throw new Error('Ya existe una orden pendiente activa para esta válvula en la base de datos (RF-16).');
          }
          throw insertError;
        }

        const createdCmd = data as IrrigationCommand;

        // Actualizar estado local inmediato para respuesta instantánea en UI
        setValves((prev) =>
          prev.map((v) => (v.id === valveId ? { ...v, pendingCommand: createdCmd } : v))
        );

        // Feedback inicial en estado 'pending'
        const initialFeedback: CommandFeedback = {
          commandId: createdCmd.id,
          valveId,
          valveName: valve?.name,
          action,
          status: 'pending',
          message: `Transmitiendo orden para ${action === 'open' ? 'abrir' : 'cerrar'} "${valve?.name || 'válvula'}"...`,
        };
        setActiveFeedback(initialFeedback);

        // 3.6 Temporizador RNF-05: Si no transiciona en 10s, evitar spinner infinito
        if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = setTimeout(() => {
          setActiveFeedback((current) => {
            if (current && current.commandId === createdCmd.id && current.status === 'pending') {
              return {
                ...current,
                status: 'timeout',
                message: 'La orden fue registrada y continúa procesándose en campo por el actuador. La válvula se actualizará automáticamente.',
              };
            }
            return current;
          });
        }, 10000);

        // 3.7 Simulación del Actuador (demostración académica / fallback ≤ 5 s)
        // Invoca el RPC con seguridad definer luego de 2s si no hay un microservicio externo corriendo
        if (simTimerRef.current) clearTimeout(simTimerRef.current);
        simTimerRef.current = setTimeout(async () => {
          try {
            const { error: rpcErr } = await supabase.rpc('simulate_actuator_execution', {
              p_command_id: createdCmd.id,
            });
            if (rpcErr) {
              console.warn('[usePlotValves] Simulación de actuador error:', rpcErr.message);
              if (
                rpcErr.code === 'PGRST202' ||
                rpcErr.message?.includes('simulate_actuator_execution')
              ) {
                setActiveFeedback((curr) =>
                  curr && curr.commandId === createdCmd.id && curr.status === 'pending'
                    ? {
                        ...curr,
                        status: 'failed',
                        message:
                          '⚠️ Falta ejecutar el script SQL en Supabase: La función del actuador no existe en la base de datos.',
                      }
                    : curr
                );
              }
            }
          } catch (simErr) {
            console.log('[usePlotValves] Simulación de actuador invocada:', simErr);
          }
        }, 2000);

        return createdCmd;
      } catch (err: any) {
        console.error('[usePlotValves] Error al emitir comando:', err);
        throw err;
      }
    },
    [user?.id, currentRole]
  );

  // 4. Resolver o forzar ejecución de un comando pendiente trabado (RF-16 / Demostración)
  const resolvePendingCommand = useCallback(
    async (commandId: string) => {
      try {
        const { error: rpcError } = await supabase.rpc('simulate_actuator_execution', {
          p_command_id: commandId,
        });

        if (rpcError) {
          if (
            rpcError.code === 'PGRST202' ||
            rpcError.message?.includes('simulate_actuator_execution')
          ) {
            throw new Error(
              'La función del actuador no está instalada en tu base de datos Supabase. Ejecuta el script SQL en el SQL Editor de Supabase para desbloquear el actuador.'
            );
          }
          throw new Error(rpcError.message);
        }

        // Forzar actualización inmediata de la lista de válvulas
        await fetchValves();
      } catch (err: any) {
        console.error('[usePlotValves] Error al resolver comando pendiente:', err);
        throw err;
      }
    },
    [fetchValves]
  );

  const dismissFeedback = useCallback(() => {
    setActiveFeedback(null);
  }, []);

  return {
    valves,
    isLoading,
    error,
    activeFeedback,
    sendCommand,
    resolvePendingCommand,
    dismissFeedback,
    refreshValves: fetchValves,
  };
}
