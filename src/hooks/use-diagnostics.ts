import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/auth-context';
import { Reading, Station, Plot } from '@/types/database.types';

export interface DiagnosticTick {
  reading: Reading;
  stationName: string;
  plotName: string;
  receivedAt: Date;
  apparentLagMs: number;
}

export interface SeedIntegrity {
  plotsCount: number;
  stationsCount: number;
  valvesCount: number;
  readingsCount: number;
  isComplete: boolean;
}

export function useDiagnostics() {
  const { user, currentOrg, currentRole, session } = useAuth();

  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [lastTick, setLastTick] = useState<DiagnosticTick | null>(null);
  const [tickCount, setTickCount] = useState<number>(0);
  const [pingMs, setPingMs] = useState<number | null>(null);
  const [isPinging, setIsPinging] = useState<boolean>(false);
  const [seedIntegrity, setSeedIntegrity] = useState<SeedIntegrity | null>(null);
  const [stationsMap, setStationsMap] = useState<Record<string, { station: Station; plotName: string }>>({});

  const stationsRef = useRef<Record<string, { station: Station; plotName: string }>>({});
  stationsRef.current = stationsMap;

  // 1. Cargar metadatos de estaciones y lotes de la organización para mapear nombres
  const loadMetadata = useCallback(async () => {
    if (!currentOrg?.id) return;

    try {
      // Consultar lotes
      const { data: plotsData } = await supabase
        .from('plots')
        .select('*')
        .eq('organization_id', currentOrg.id);

      const plots: Plot[] = plotsData || [];
      const plotMap = new Map<string, string>();
      plots.forEach((p) => plotMap.set(p.id, p.name));

      // Consultar estaciones de estos lotes
      const plotIds = plots.map((p) => p.id);
      if (plotIds.length === 0) return;

      const { data: stationsData } = await supabase
        .from('stations')
        .select('*')
        .in('plot_id', plotIds);

      const stations: Station[] = stationsData || [];
      const sMap: Record<string, { station: Station; plotName: string }> = {};

      stations.forEach((s) => {
        sMap[s.id] = {
          station: s,
          plotName: plotMap.get(s.plot_id) || 'Lote desconocido',
        };
      });

      setStationsMap(sMap);

      // Verificar integridad de datos semilla (Concordia: 3 lotes, 3 estaciones, 3 válvulas)
      const { count: valvesCount } = await supabase
        .from('valves')
        .select('*', { count: 'exact', head: true })
        .in('plot_id', plotIds);

      const { count: readingsCount } = await supabase
        .from('readings')
        .select('*', { count: 'exact', head: true })
        .in('station_id', stations.map((s) => s.id));

      setSeedIntegrity({
        plotsCount: plots.length,
        stationsCount: stations.length,
        valvesCount: valvesCount || 0,
        readingsCount: readingsCount || 0,
        isComplete: plots.length >= 3 && stations.length >= 3 && (valvesCount || 0) >= 3,
      });
    } catch (err) {
      console.warn('[useDiagnostics] Error al cargar metadatos:', err);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    loadMetadata();
  }, [loadMetadata]);

  // 2. Medir Latencia PostgREST (Ping Round-Trip)
  const testPing = useCallback(async () => {
    setIsPinging(true);
    const start = performance.now();
    try {
      await supabase.from('organizations').select('id').limit(1).single();
      const elapsed = Math.round(performance.now() - start);
      setPingMs(elapsed);
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setPingMs(elapsed);
    } finally {
      setIsPinging(false);
    }
  }, []);

  // Ping inicial automático al montar
  useEffect(() => {
    testPing();
  }, [testPing]);

  // 3. Suscripción Supabase Realtime a nuevos ticks de sensores
  useEffect(() => {
    if (!currentOrg?.id) return;

    setRealtimeStatus('connecting');
    const channelName = `diag-readings-${currentOrg.id}-${Math.random().toString(36).substring(2, 9)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'readings',
        },
        (payload) => {
          const newReading = payload.new as Reading;
          const now = new Date();
          const measuredAt = new Date(newReading.measured_at);
          const apparentLag = Math.max(0, now.getTime() - measuredAt.getTime());

          const stationInfo = stationsRef.current[newReading.station_id];
          const stationName = stationInfo?.station.name || `Estación ${newReading.station_id.slice(0, 8)}...`;
          const plotName = stationInfo?.plotName || 'Lote Concordia';

          setLastTick({
            reading: newReading,
            stationName,
            plotName,
            receivedAt: now,
            apparentLagMs: apparentLag,
          });

          setTickCount((prev) => prev + 1);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setRealtimeStatus('connected');
        } else if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR') {
          setRealtimeStatus('disconnected');
        } else {
          setRealtimeStatus('connecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrg?.id]);

  return {
    user,
    session,
    currentOrg,
    currentRole,
    realtimeStatus,
    lastTick,
    tickCount,
    pingMs,
    isPinging,
    seedIntegrity,
    testPing,
    refreshMetadata: loadMetadata,
  };
}
