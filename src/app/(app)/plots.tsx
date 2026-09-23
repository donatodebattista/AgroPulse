import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AppHeader } from '@/components/common/app-header';
import { usePlots } from '@/hooks/use-plots';
import { useLocation } from '@/hooks/use-location';
import { PlotWithStatus } from '@/types/database.types';
import { getSemaforoInfo } from '@/utils/semaforo';

export default function PlotsListScreen() {
  const router = useRouter();
  const { plots, isLoading, error, refreshPlots } = usePlots();
  const { currentPlot } = useLocation(plots);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshPlots();
    setRefreshing(false);
  };

  const formatAge = (timestamp: string | null) => {
    if (!timestamp) return 'Sin registros';
    const diffMin = Math.round((new Date().getTime() - new Date(timestamp).getTime()) / (1000 * 60));
    if (diffMin < 1) return 'Hace instantes';
    if (diffMin === 1) return 'Hace 1 min';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const hours = Math.floor(diffMin / 60);
    return `Hace ${hours} h`;
  };

  const renderPlotCard = ({ item }: { item: PlotWithStatus }) => {
    const semaforo = getSemaforoInfo(item.status);
    const isUserHere = currentPlot?.id === item.id;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/plot/${item.id}` as any)}
        activeOpacity={0.7}
      >
        {/* Cabecera del Lote */}
        <View style={styles.cardHeader}>
          <View style={styles.titleCol}>
            <Text style={styles.plotName}>{item.name}</Text>
            <Text style={styles.plotCrop}>
              {item.crop ? `Cultivo: ${item.crop}` : 'Sin cultivo definido'}
            </Text>
          </View>

          {/* Badge del Semáforo (RF-12) */}
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: semaforo.badgeBg, borderColor: semaforo.badgeBorder },
            ]}
          >
            <Text style={styles.statusIcon}>{semaforo.icon}</Text>
            <Text style={[styles.statusText, { color: semaforo.badgeText }]}>
              {semaforo.label}
            </Text>
          </View>
        </View>

        {/* Indicador "Estás en este lote" (RF-06) */}
        {isUserHere && (
          <View style={styles.hereTag}>
            <Text style={styles.hereTagText}>📍 Estás dentro de este lote</Text>
          </View>
        )}

        {/* Métricas Principales */}
        <View style={styles.metricsContainer}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Humedad</Text>
            <Text style={[styles.metricValue, { color: semaforo.polygonStroke }]}>
              {item.last_moisture_pct !== null && item.last_moisture_pct !== undefined
                ? `${item.last_moisture_pct.toFixed(1)}%`
                : '--'}
            </Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Umbral Mín.</Text>
            <Text style={styles.metricValueNeutral}>{item.threshold_min}%</Text>
          </View>

          <View style={styles.metricDivider} />

          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Última Lectura</Text>
            <Text style={styles.metricValueNeutral}>{formatAge(item.last_measured_at)}</Text>
          </View>
        </View>

        {/* Pie con sugerencia / acción */}
        <View style={styles.cardFooter}>
          <Text style={styles.descriptionText} numberOfLines={1}>
            {semaforo.description}
          </Text>
          <Text style={styles.arrowText}>Ver detalle →</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      <View style={styles.container}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Lotes del Establecimiento</Text>
          <Text style={styles.plotsCount}>
            {plots.length} {plots.length === 1 ? 'lote' : 'lotes'}
          </Text>
        </View>

        {isLoading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#166534" />
            <Text style={styles.loadingLabel}>Cargando lotes...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Error al cargar los lotes</Text>
            <Text style={styles.errorSubtitle}>{error}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={refreshPlots}>
              <Text style={styles.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={plots}
            keyExtractor={(item) => item.id}
            renderItem={renderPlotCard}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#166534']} />
            }
            ListEmptyComponent={
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>🌾</Text>
                <Text style={styles.emptyTitle}>No hay lotes registrados</Text>
                <Text style={styles.emptySubtitle}>
                  No se encontraron parcelas asociadas a este establecimiento.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  plotsCount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleCol: {
    flex: 1,
    marginRight: 8,
  },
  plotName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  plotCrop: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusIcon: {
    fontSize: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
  },
  hereTag: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  hereTagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
  },
  metricsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 12,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  metricValueNeutral: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#e2e8f0',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  descriptionText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
    marginRight: 8,
  },
  arrowText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLabel: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#dc2626',
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  emptyBox: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
});
