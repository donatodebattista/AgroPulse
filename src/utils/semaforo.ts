import { PlotStatus } from '@/types/database.types';

export interface SemaforoConfig {
  status: PlotStatus;
  label: string;
  icon: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  polygonFill: string;
  polygonStroke: string;
  description: string;
}

export const SEMAFORO_CONFIG: Record<PlotStatus, SemaforoConfig> = {
  optimal: {
    status: 'optimal',
    label: 'Óptimo',
    icon: '✅',
    badgeBg: '#dcfce7',
    badgeText: '#15803d',
    badgeBorder: '#86efac',
    polygonFill: 'rgba(34, 197, 94, 0.45)', // Verde con opacidad
    polygonStroke: '#15803d',
    description: 'Humedad en rango ideal para el cultivo',
  },
  dry: {
    status: 'dry',
    label: 'Seco',
    icon: '⚠️',
    badgeBg: '#fee2e2',
    badgeText: '#b91c1c',
    badgeBorder: '#fca5a5',
    polygonFill: 'rgba(239, 68, 68, 0.5)', // Rojo con opacidad
    polygonStroke: '#b91c1c',
    description: 'Humedad por debajo del umbral mínimo. Riego sugerido.',
  },
  wet: {
    status: 'wet',
    label: 'Húmedo',
    icon: '💧',
    badgeBg: '#e0f2fe',
    badgeText: '#0369a1',
    badgeBorder: '#7dd3fc',
    polygonFill: 'rgba(59, 130, 246, 0.45)', // Azul con opacidad
    polygonStroke: '#1d4ed8',
    description: 'Humedad superior al umbral máximo.',
  },
  stale: {
    status: 'stale',
    label: 'Sin datos',
    icon: '⏳',
    badgeBg: '#f1f5f9',
    badgeText: '#475569',
    badgeBorder: '#cbd5e1',
    polygonFill: 'rgba(148, 163, 184, 0.45)', // Gris con opacidad
    polygonStroke: '#475569',
    description: 'Sin lecturas recientes (> 15 min sin reporte).',
  },
};

/**
 * Calcula el estado de semáforo según las reglas de negocio (§8)
 */
export function calculatePlotStatus(
  measuredAt: string | null | undefined,
  moisturePct: number | null | undefined,
  thresholdMin: number = 25,
  thresholdMax: number = 45
): PlotStatus {
  if (!measuredAt || moisturePct === null || moisturePct === undefined) {
    return 'stale';
  }

  const measuredDate = new Date(measuredAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - measuredDate.getTime()) / (1000 * 60);

  // Si age > 15 min, pasa a stale
  if (diffMinutes > 15) {
    return 'stale';
  }

  if (moisturePct < thresholdMin) {
    return 'dry';
  }

  if (moisturePct > thresholdMax) {
    return 'wet';
  }

  return 'optimal';
}

export function getSemaforoInfo(status: PlotStatus): SemaforoConfig {
  return SEMAFORO_CONFIG[status] || SEMAFORO_CONFIG.stale;
}
