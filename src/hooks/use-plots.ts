import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { PlotWithStatus } from '@/types/database.types';
import { calculatePlotStatus } from '@/utils/semaforo';
import { useAuth } from '@/context/auth-context';
import { withClockSkewRetry } from '@/utils/supabase-retry';

export function usePlots() {
  const { currentOrg } = useAuth();
  const [plots, setPlots] = useState<PlotWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlots = useCallback(async () => {
    if (!currentOrg?.id) {
      setPlots([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error: queryError } = await withClockSkewRetry(() =>
        supabase
          .from('plots_with_status')
          .select('*')
          .eq('organization_id', currentOrg.id)
          .order('name', { ascending: true })
      );

      if (queryError) {
        console.error('[usePlots] Error al consultar plots_with_status:', queryError.message);
        setError(queryError.message);
        return;
      }

      // Re-evaluar frescura en cliente (RF-09: si now - measured_at > 15 min -> stale)
      const evaluated = (data || []).map((plot: any) => {
        const dynamicStatus = calculatePlotStatus(
          plot.last_measured_at,
          plot.last_moisture_pct,
          plot.threshold_min,
          plot.threshold_max
        );
        return {
          ...plot,
          status: dynamicStatus,
        } as PlotWithStatus;
      });

      setPlots(evaluated);
    } catch (err: any) {
      console.error('[usePlots] Error inesperado:', err);
      setError(err?.message || 'Error al cargar los lotes');
    } finally {
      setIsLoading(false);
    }
  }, [currentOrg?.id]);

  useEffect(() => {
    setIsLoading(true);
    fetchPlots();
  }, [fetchPlots]);

  // Recalcular estado de frescura cada 10 segundos
  useEffect(() => {
    const timer = setInterval(() => {
      setPlots((prev) =>
        prev.map((plot) => ({
          ...plot,
          status: calculatePlotStatus(
            plot.last_measured_at,
            plot.last_moisture_pct,
            plot.threshold_min,
            plot.threshold_max
          ),
        }))
      );
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  const fetchPlotsRef = useRef(fetchPlots);
  useEffect(() => {
    fetchPlotsRef.current = fetchPlots;
  }, [fetchPlots]);

  // Suscripción Realtime a nuevas lecturas y cambios de umbrales en lotes
  useEffect(() => {
    if (!currentOrg?.id) return;

    // Nombre de canal único para evitar colisiones con múltiples pantallas/tabs montadas
    const channelName = `org-plots-${currentOrg.id}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'readings',
        },
        () => {
          fetchPlotsRef.current();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'plots',
          filter: `organization_id=eq.${currentOrg.id}`,
        },
        () => {
          fetchPlotsRef.current();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrg?.id]);

  return {
    plots,
    isLoading,
    error,
    refreshPlots: fetchPlots,
  };
}
