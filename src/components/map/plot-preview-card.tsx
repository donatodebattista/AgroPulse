import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { PlotWithStatus } from '@/types/database.types';
import { getSemaforoInfo } from '@/utils/semaforo';

interface PlotPreviewCardProps {
  plot: PlotWithStatus;
  onClose: () => void;
  isUserInside?: boolean;
}

export function PlotPreviewCard({ plot, onClose, isUserInside }: PlotPreviewCardProps) {
  const router = useRouter();
  const semaforo = getSemaforoInfo(plot.status);

  const formatAge = (timestamp: string | null) => {
    if (!timestamp) return 'Sin lecturas registradas';
    const diffMin = Math.round((new Date().getTime() - new Date(timestamp).getTime()) / (1000 * 60));
    if (diffMin < 1) return 'Hace unos segundos';
    if (diffMin === 1) return 'Hace 1 minuto';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    return `Hace ${hours} h`;
  };

  return (
    <View style={styles.cardContainer}>
      {/* Cabecera */}
      <View style={styles.cardHeader}>
        <View style={styles.titleArea}>
          <Text style={styles.plotName}>{plot.name}</Text>
          <Text style={styles.plotCrop}>{plot.crop ? `Cultivo: ${plot.crop}` : 'Sin cultivo definido'}</Text>
        </View>

        <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {/* Badge "Estoy en el lote" (RF-06) */}
      {isUserInside && (
        <View style={styles.insideBadge}>
          <Text style={styles.insideBadgeText}>📍 Estás dentro de este lote</Text>
        </View>
      )}

      {/* Semáforo & Humedad */}
      <View style={styles.metricsRow}>
        <View style={[styles.statusBadge, { backgroundColor: semaforo.badgeBg, borderColor: semaforo.badgeBorder }]}>
          <Text style={styles.statusIcon}>{semaforo.icon}</Text>
          <Text style={[styles.statusLabel, { color: semaforo.badgeText }]}>{semaforo.label}</Text>
        </View>

        <View style={styles.moistureBox}>
          <Text style={styles.moistureLabel}>Humedad actual</Text>
          <Text style={[styles.moistureValue, { color: semaforo.polygonStroke }]}>
            {plot.last_moisture_pct !== null && plot.last_moisture_pct !== undefined
              ? `${plot.last_moisture_pct.toFixed(1)}%`
              : '--%'}
          </Text>
        </View>
      </View>

      {/* Umbrales y Antigüedad */}
      <View style={styles.detailsRow}>
        <Text style={styles.detailItem}>
          Rango óptimo: <Text style={styles.bold}>{plot.threshold_min}% - {plot.threshold_max}%</Text>
        </Text>
        <Text style={styles.detailItem}>
          Actualizado: <Text style={styles.bold}>{formatAge(plot.last_measured_at)}</Text>
        </Text>
      </View>

      {/* Botón Ver Detalle (RF-05) */}
      <TouchableOpacity
        style={styles.detailButton}
        onPress={() => router.push(`/plot/${plot.id}` as any)}
        activeOpacity={0.8}
      >
        <Text style={styles.detailButtonText}>Ver Detalle Completo →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 30,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  titleArea: {
    flex: 1,
  },
  plotName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
  },
  plotCrop: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  closeButton: {
    padding: 4,
  },
  closeText: {
    fontSize: 16,
    color: '#94a3b8',
    fontWeight: '700',
  },
  insideBadge: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  insideBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#15803d',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusIcon: {
    fontSize: 14,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  moistureBox: {
    alignItems: 'flex-end',
  },
  moistureLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  moistureValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginTop: 8,
  },
  detailItem: {
    fontSize: 12,
    color: '#64748b',
  },
  bold: {
    fontWeight: '700',
    color: '#334155',
  },
  detailButton: {
    backgroundColor: '#166534',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  detailButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
