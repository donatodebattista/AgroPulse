import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { PlotWithStatus } from '@/types/database.types';
import { calculatePlotStatus } from '@/utils/semaforo';
import { useAuth } from '@/context/auth-context';

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

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('plots_with_status')
        .select('*')
        .eq('organization_id', currentOrg.id)
        .order('name', { ascending: true });

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
    fetchPlots();
  }, [fetchPlots]);

  return {
    plots,
    isLoading,
    error,
    refreshPlots: fetchPlots,
  };
}
