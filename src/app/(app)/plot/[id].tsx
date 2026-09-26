import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Plot } from '@/types/database.types';
import { getSemaforoInfo } from '@/utils/semaforo';
import { useLocation } from '@/hooks/use-location';
import { useAuth } from '@/context/auth-context';
import { usePlotTelemetry } from '@/hooks/use-plot-telemetry';
import { MoistureChart } from '@/components/telemetry/moisture-chart';
import { ThresholdEditorModal } from '@/components/telemetry/threshold-editor-modal';

export default function PlotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { currentRole } = useAuth();

  const [plot, setPlot] = useState<Plot | null>(null);
  const [loadingPlot, setLoadingPlot] = useState(true);
  const [plotError, setPlotError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);

  // Carga de metadatos del lote
  const loadPlot = useCallback(async () => {
    if (!id) return;
    setLoadingPlot(true);
    setPlotError(null);

    try {
      const { data, error } = await supabase
        .from('plots')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setPlot(data);
    } catch (err: any) {
      console.error('[PlotDetail] Error al cargar lote:', err);
      setPlotError(err?.message || 'Error al cargar el lote');
    } finally {
      setLoadingPlot(false);
    }
  }, [id]);

  useEffect(() => {
    loadPlot();
  }, [loadPlot]);

  // Hook de Telemetría en Tiempo Real (RF-08, RF-09, RF-10, Supabase Realtime)
  const thresholdMin = plot?.threshold_min ?? 25;
  const thresholdMax = plot?.threshold_max ?? 45;

  const {
    stations,
    readings,
    latestReading,
    status,
    isLoading: loadingTelemetry,
    error: telemetryError,
    ageText,
    isRealtimeActive,
    refreshTelemetry,
  } = usePlotTelemetry(id as string, thresholdMin, thresholdMax);

  // Hook de Geolocalización (RF-06)
  const { currentPlot } = useLocation(plot ? [{ ...plot, geojson: null, status: 'optimal', last_measured_at: null, last_moisture_pct: null, last_temp_c: null, last_rain_mm: null }] : []);
  const isUserHere = currentPlot?.id === id;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadPlot(), refreshTelemetry()]);
    setRefreshing(false);
  };

  const isProducer = currentRole === 'producer';
  const semaforo = getSemaforoInfo(status);

  if (loadingPlot) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#166534" />
          <Text style={styles.loadingText}>Cargando información del lote...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (plotError || !plot) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>Lote no disponible</Text>
          <Text style={styles.errorSubtext}>{plotError || 'No se encontró la parcela solicitada.'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Volver a Lotes</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Barra de Navegación Superior */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{plot.name}</Text>
        <View style={styles.realtimeTag}>
          <View style={[styles.realtimeDot, isRealtimeActive && styles.realtimeDotActive]} />
          <Text style={styles.realtimeText}>
            {isRealtimeActive ? 'Realtime' : 'Conectando'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#166534']} />
        }
      >
        {/* Cabecera del Lote y Semáforo */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.plotTitle}>{plot.name}</Text>
              <Text style={styles.cropSubtitle}>
                {plot.crop ? `Cultivo: ${plot.crop}` : 'Sin cultivo especificado'}
              </Text>
            </View>

            {/* Badge Semáforo (§8 y RF-12) */}
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

          {/* Detección de Presencia GPS (RF-06) */}
          <View style={[styles.gpsTag, isUserHere ? styles.gpsTagHere : styles.gpsTagNotHere]}>
            <Text style={[styles.gpsTagText, isUserHere ? styles.gpsTextHere : styles.gpsTextNotHere]}>
              {isUserHere
                ? '📍 Estás ubicado físicamente dentro de este lote'
                : '🧭 Estás fuera del perímetro de este lote'}
            </Text>
          </View>
        </View>

        {/* Métrica de Humedad Actual y Antigüedad (RF-09) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderWithAction}>
            <View>
              <Text style={styles.cardHeading}>Estado de Humedad Actual</Text>
              <Text style={styles.statusDescription}>{semaforo.description}</Text>
            </View>
          </View>

          <View style={styles.gaugeContainer}>
            <Text style={[styles.currentMoisture, { color: semaforo.polygonStroke }]}>
              {latestReading?.moisture_pct !== null && latestReading?.moisture_pct !== undefined
                ? `${latestReading.moisture_pct.toFixed(1)}%`
                : '--%'}
            </Text>
            <Text style={styles.gaugeSub}>Humedad Volumétrica</Text>

            {/* Antigüedad de la lectura (RF-09: "hace 12 s / hace 2 h") */}
            <View style={styles.agePill}>
              <Text style={styles.ageText}>⏱️ {ageText}</Text>
            </View>
          </View>

          {/* Umbrales Configurables (RF-11) */}
          <View style={styles.thresholdsGrid}>
            <View style={styles.thresholdItem}>
              <Text style={styles.thLabel}>Umbral Mínimo</Text>
              <Text style={[styles.thValue, { color: '#dc2626' }]}>{plot.threshold_min}%</Text>
              <Text style={styles.thNote}>Humedad &lt; {plot.threshold_min}% → Seco</Text>
            </View>

            <View style={styles.thresholdItem}>
              <Text style={styles.thLabel}>Umbral Máximo</Text>
              <Text style={[styles.thValue, { color: '#2563eb' }]}>{plot.threshold_max}%</Text>
              <Text style={styles.thNote}>Humedad &gt; {plot.threshold_max}% → Húmedo</Text>
            </View>
          </View>

          {/* Botón para Editar Umbrales (Solo Productor) */}
          <TouchableOpacity
            style={[styles.editThresholdBtn, !isProducer && styles.editThresholdBtnDisabled]}
            onPress={() => setShowThresholdModal(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.editThresholdBtnText}>
              {isProducer ? '⚙️ Configurar Umbrales de Riego (RF-11)' : '🔒 Umbrales protegidos (Solo Productor)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Gráfico de Humedad de las Últimas 6 Horas (RF-10) */}
        <MoistureChart
          readings={readings}
          thresholdMin={plot.threshold_min}
          thresholdMax={plot.threshold_max}
        />

        {/* Telemetría Ambiental de Estaciones (RF-08) */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Estaciones de Monitoreo ({stations.length})</Text>
          <Text style={styles.cardSubtitle}>
            {stations.map((s) => s.name).join(', ') || 'Sin estación asociada'}
          </Text>

          <View style={styles.envGrid}>
            <View style={styles.envItem}>
              <Text style={styles.envIcon}>🌡️</Text>
              <Text style={styles.envLabel}>Temperatura Suelo</Text>
              <Text style={styles.envValue}>
                {latestReading?.temp_c !== null && latestReading?.temp_c !== undefined
                  ? `${latestReading.temp_c.toFixed(1)} °C`
                  : '--'}
              </Text>
            </View>

            <View style={styles.envItem}>
              <Text style={styles.envIcon}>🌧️</Text>
              <Text style={styles.envLabel}>Lluvia Acumulada</Text>
              <Text style={styles.envValue}>
                {latestReading?.rain_mm !== null && latestReading?.rain_mm !== undefined
                  ? `${latestReading.rain_mm.toFixed(1)} mm`
                  : '0.0 mm'}
              </Text>
            </View>
          </View>
        </View>

        {/* Banner para la Iteración 5 */}
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>Módulo de Riego (Siguiente Paso)</Text>
          <Text style={styles.nextText}>
            En la <Text style={{ fontWeight: 'bold' }}>Iteración 5</Text> implementaremos las válvulas del lote,
            el formulario de comando de riego con duración (1–120 min) y el acuse asíncrono en ≤ 5 s (RF-13 a RF-16).
          </Text>
        </View>
      </ScrollView>

      {/* Modal para Editar Umbrales */}
      {plot && (
        <ThresholdEditorModal
          visible={showThresholdModal}
          plotId={plot.id}
          plotName={plot.name}
          currentMin={plot.threshold_min}
          currentMax={plot.threshold_max}
          isProducer={isProducer}
          onClose={() => setShowThresholdModal(false)}
          onSuccess={(newMin, newMax) => {
            setPlot((prev) => (prev ? { ...prev, threshold_min: newMin, threshold_max: newMax } : prev));
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  errorSubtext: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 16,
    textAlign: 'center',
  },
  backBtn: {
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    paddingVertical: 4,
  },
  backIcon: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
  },
  navTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    maxWidth: '50%',
  },
  realtimeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  realtimeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#94a3b8',
  },
  realtimeDotActive: {
    backgroundColor: '#22c55e',
  },
  realtimeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  plotTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f172a',
  },
  cropSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusIcon: {
    fontSize: 13,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
  },
  gpsTag: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 12,
  },
  gpsTagHere: {
    backgroundColor: '#dcfce7',
  },
  gpsTagNotHere: {
    backgroundColor: '#f1f5f9',
  },
  gpsTagText: {
    fontSize: 12,
    fontWeight: '700',
  },
  gpsTextHere: {
    color: '#15803d',
  },
  gpsTextNotHere: {
    color: '#64748b',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeaderWithAction: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  statusDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  currentMoisture: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -1,
  },
  gaugeSub: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748b',
    marginTop: 2,
  },
  agePill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  ageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  thresholdsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  thresholdItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  thLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  thValue: {
    fontSize: 18,
    fontWeight: '800',
    marginVertical: 2,
  },
  thNote: {
    fontSize: 10,
    color: '#94a3b8',
    textAlign: 'center',
  },
  editThresholdBtn: {
    marginTop: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  editThresholdBtnDisabled: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  editThresholdBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  envGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  envItem: {
    alignItems: 'center',
    flex: 1,
  },
  envIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  envLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  envValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
    marginTop: 2,
  },
  nextCard: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  nextTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 4,
  },
  nextText: {
    fontSize: 12,
    color: '#15803d',
    lineHeight: 18,
  },
});
