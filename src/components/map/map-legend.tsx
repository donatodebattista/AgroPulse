import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SEMAFORO_CONFIG } from '@/utils/semaforo';
import { PlotStatus } from '@/types/database.types';

export function MapLegend() {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const statuses: PlotStatus[] = ['optimal', 'dry', 'wet', 'stale'];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.toggleButton}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.8}
      >
        <Text style={styles.toggleText}>
          {isExpanded ? 'Ocultar Leyenda ▲' : 'Semáforo ▼'}
        </Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.legendBody}>
          <Text style={styles.legendTitle}>Estado de Lotes (§8)</Text>
          <View style={styles.itemsList}>
            {statuses.map((st) => {
              const cfg = SEMAFORO_CONFIG[st];
              return (
                <View key={st} style={styles.itemRow}>
                  <View style={[styles.colorIndicator, { backgroundColor: cfg.polygonStroke }]} />
                  <Text style={styles.icon}>{cfg.icon}</Text>
                  <Text style={styles.label}>{cfg.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 14,
    left: 16,
    zIndex: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
    overflow: 'hidden',
  },
  toggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#ffffff',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  legendBody: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  legendTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
    marginBottom: 6,
  },
  itemsList: {
    gap: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  icon: {
    fontSize: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
});
