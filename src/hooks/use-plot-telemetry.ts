import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Reading, Station, PlotStatus } from '@/types/database.types';
import { calculatePlotStatus } from '@/utils/semaforo';
import { withClockSkewRetry } from '@/utils/supabase-retry';

export interface UsePlotTelemetryResult {
  stations: Station[];
  readings: Reading[];
  latestReading: Reading | null;
  status: PlotStatus;
  isLoading: boolean;
  error: string | null;
  ageText: string;
  isRealtimeActive: boolean;
  refreshTelemetry: () => Promise<void>;
}

export function usePlotTelemetry(
  plotId: string,
  thresholdMin: number,
  thresholdMax: number
): UsePlotTelemetryResult {
  const [stations, setStations] = useState<Station[]>([]);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [latestReading, setLatestReading] = useState<Reading | null>(null);
  const [status, setStatus] = useState<PlotStatus>('stale');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [ageText, setAgeText] = useState<string>('Calculando...');
  const [isRealtimeActive, setIsRealtimeActive] = useState<boolean>(false);

  const stationsRef = useRef<Station[]>([]);
  stationsRef.current = stations;

  // Formateador de antigüedad de lectura (RF-09: "hace 12 s / hace 2 h")
  const formatReadingAge = useCallback((measuredAt: string | null | undefined): string => {
    if (!measuredAt) return 'Sin datos reportados';
    const diffSec = Math.max(0, Math.floor((Date.now() - new Date(measuredAt).getTime()) / 1000));

    if (diffSec < 60) {
      return `Hace ${diffSec} s`;
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `Hace ${diffMin} min`;
    }
    const diffHours = Math.floor(diffMin / 60);
    return `Hace ${diffHours} h`;
  }, []);

  const fetchTelemetry = useCallback(async () => {
    if (!plotId) return;
    setIsLoading(true);
    setError(null);

    try {
      // 1. Obtener estaciones del lote (RF-08)
      const { data: stationsData, error: stationsErr } = await withClockSkewRetry(() =>
        supabase.from('stations').select('*').eq('plot_id', plotId)
      );

      if (stationsErr) throw stationsErr;

      const loadedStations = stationsData || [];
      setStations(loadedStations);

      if (loadedStations.length === 0) {
        setReadings([]);
        setLatestReading(null);
        setStatus('stale');
        setAgeText('Sin estaciones asignadas');
        setIsLoading(false);
        return;
      }

      const stationIds = loadedStations.map((s) => s.id);

      // 2. Obtener lecturas de las últimas 6 horas (RF-10)
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const { data: readingsData, error: readingsErr } = await withClockSkewRetry(() =>
        supabase
          .from('readings')
          .select('*')
          .in('station_id', stationIds)
          .gte('measured_at', sixHoursAgo)
          .order('measured_at', { ascending: true })
      );

      if (readingsErr) throw readingsErr;

      const history = readingsData || [];
      setReadings(history);

      const latest = history.length > 0 ? history[history.length - 1] : null;
      setLatestReading(latest);

      // 3. Calcular estado inicial de semáforo (§8)
      const initialStatus = calculatePlotStatus(
        latest?.measured_at,
        latest?.moisture_pct,
        thresholdMin,
        thresholdMax
      );
      setStatus(initialStatus);
      setAgeText(formatReadingAge(latest?.measured_at));
    } catch (err: any) {
      console.error('[usePlotTelemetry] Error al cargar telemetría:', err);
      setError(err?.message || 'Error al obtener datos de telemetría');
    } finally {
      setIsLoading(false);
    }
  }, [plotId, thresholdMin, thresholdMax, formatReadingAge]);

  // Carga inicial
  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Timer para actualizar en vivo la antigüedad y el estado stale cada 5s (RF-09)
  useEffect(() => {
    const timer = setInterval(() => {
      if (latestReading?.measured_at) {
        setAgeText(formatReadingAge(latestReading.measured_at));
        const currentStatus = calculatePlotStatus(
          latestReading.measured_at,
          latestReading.moisture_pct,
          thresholdMin,
          thresholdMax
        );
        setStatus(currentStatus);
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [latestReading, thresholdMin, thresholdMax, formatReadingAge]);

  // Suscripción a Supabase Realtime para nuevos ticks de sensores (RF-10, RNF-04)
  useEffect(() => {
    if (!plotId) return;

    const channelName = `realtime-readings-${plotId}-${Math.random().toString(36).substring(2, 9)}`;
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
          const currentStationIds = stationsRef.current.map((s) => s.id);

          // Verificar si el nuevo tick pertenece a una de las estaciones de este lote
          if (currentStationIds.includes(newReading.station_id)) {
            setReadings((prev) => {
              // Mantener la serie ordenada y recortada a las últimas 6 horas
              const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
              const filtered = prev.filter(
                (r) => new Date(r.measured_at).getTime() >= sixHoursAgo
              );
              return [...filtered, newReading].sort(
                (a, b) => new Date(a.measured_at).getTime() - new Date(b.measured_at).getTime()
              );
            });

            setLatestReading(newReading);

            // Recalcular semáforo instantáneamente con el tick entrante (RNF-04 <= 3s)
            const newStatus = calculatePlotStatus(
              newReading.measured_at,
              newReading.moisture_pct,
              thresholdMin,
              thresholdMax
            );
            setStatus(newStatus);
            setAgeText('Hace instantes');
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeActive(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [plotId, thresholdMin, thresholdMax]);

  return {
    stations,
    readings,
    latestReading,
    status,
    isLoading,
    error,
    ageText,
    isRealtimeActive,
    refreshTelemetry: fetchTelemetry,
  };
}
