import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { PlotWithStatus } from '@/types/database.types';
import { getSemaforoInfo, calculatePlotStatus } from '@/utils/semaforo';
import { useLocation } from '@/hooks/use-location';

export default function PlotDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [plot, setPlot] = useState<PlotWithStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { currentPlot } = useLocation(plot ? [plot] : []);

  useEffect(() => {
    async function loadPlot() {
      if (!id) return;
      setLoading(true);
      setError(null);

      try {
        const { data, error: queryError } = await supabase
          .from('plots_with_status')
          .select('*')
          .eq('id', id)
          .single();

        if (queryError) {
          setError(queryError.message);
          return;
        }

        const dynamicStatus = calculatePlotStatus(
          data.last_measured_at,
          data.last_moisture_pct,
          data.threshold_min,
          data.threshold_max
        );

        setPlot({
          ...data,
          status: dynamicStatus,
        });
      } catch (err: any) {
        setError(err?.message || 'Error al cargar el lote');
      } finally {
        setLoading(false);
      }
    }

    loadPlot();
  }, [id]);

  const isUserHere = currentPlot?.id === id;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#166534" />
          <Text style={styles.loadingText}>Cargando detalle del lote...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !plot) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorEmoji}>⚠️</Text>
          <Text style={styles.errorText}>No se pudo encontrar el lote</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const semaforo = getSemaforoInfo(plot.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Barra de Navegación Superior */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle} numberOfLines={1}>{plot.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Cabecera del Lote */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.plotTitle}>{plot.name}</Text>
              <Text style={styles.cropSubtitle}>
                {plot.crop ? `Cultivo: ${plot.crop}` : 'Sin cultivo especificado'}
              </Text>
            </View>

            {/* Badge Semáforo */}
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

          {/* Detección GPS del Dispositivo (RF-06) */}
          <View style={[styles.gpsTag, isUserHere ? styles.gpsTagHere : styles.gpsTagNotHere]}>
            <Text style={[styles.gpsTagText, isUserHere ? styles.gpsTextHere : styles.gpsTextNotHere]}>
              {isUserHere
                ? '📍 Estás ubicado dentro de este lote'
                : '🧭 Estás fuera del perímetro de este lote'}
            </Text>
          </View>
        </View>

        {/* Tarjeta de Humedad y Umbrales (RF-08, RF-11, RF-12) */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Monitoreo de Humedad de Suelo</Text>
          <Text style={styles.statusDescription}>{semaforo.description}</Text>

          <View style={styles.gaugeContainer}>
            <Text style={[styles.currentMoisture, { color: semaforo.polygonStroke }]}>
              {plot.last_moisture_pct !== null && plot.last_moisture_pct !== undefined
                ? `${plot.last_moisture_pct.toFixed(1)}%`
                : '--%'}
            </Text>
            <Text style={styles.gaugeSub}>Humedad Volumétrica Actual</Text>
          </View>

          {/* Comparación visual con umbrales */}
          <View style={styles.thresholdsGrid}>
            <View style={styles.thresholdItem}>
              <Text style={styles.thLabel}>Umbral Mínimo</Text>
              <Text style={styles.thValue}>{plot.threshold_min}%</Text>
              <Text style={styles.thNote}>Bajo este nivel: Seco</Text>
            </View>

            <View style={styles.thresholdItem}>
              <Text style={styles.thLabel}>Umbral Máximo</Text>
              <Text style={styles.thValue}>{plot.threshold_max}%</Text>
              <Text style={styles.thNote}>Sobre este nivel: Húmedo</Text>
            </View>
          </View>
        </View>

        {/* Condiciones Ambientales Recientes */}
        <View style={styles.card}>
          <Text style={styles.cardHeading}>Telemetría de la Estación</Text>
          <View style={styles.envGrid}>
            <View style={styles.envItem}>
              <Text style={styles.envIcon}>🌡️</Text>
              <Text style={styles.envLabel}>Temperatura</Text>
              <Text style={styles.envValue}>
                {plot.last_temp_c !== null ? `${plot.last_temp_c.toFixed(1)} °C` : '--'}
              </Text>
            </View>

            <View style={styles.envItem}>
              <Text style={styles.envIcon}>🌧️</Text>
              <Text style={styles.envLabel}>Precipitaciones</Text>
              <Text style={styles.envValue}>
                {plot.last_rain_mm !== null ? `${plot.last_rain_mm.toFixed(1)} mm` : '0.0 mm'}
              </Text>
            </View>
          </View>
        </View>

        {/* Sección Preparada para Iteración 4 y 5 */}
        <View style={styles.nextCard}>
          <Text style={styles.nextTitle}>Próximas Funcionalidades del Lote</Text>
          <Text style={styles.nextBullet}>
            📈 <Text style={styles.bold}>Iteración 4:</Text> Gráfico de series temporales de humedad (últimas 6h) y actualización Realtime.
          </Text>
          <Text style={styles.nextBullet}>
            🚰 <Text style={styles.bold}>Iteración 5:</Text> Estado de válvulas simuladas y orden de irrigación con acuse de comando.
          </Text>
        </View>
      </ScrollView>
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
    paddingHorizontal: 8,
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
    maxWidth: '60%',
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
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  statusDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
  },
  gaugeContainer: {
    alignItems: 'center',
    paddingVertical: 18,
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
  thresholdsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 12,
  },
  thresholdItem: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  thLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  thValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
    marginVertical: 2,
  },
  thNote: {
    fontSize: 10,
    color: '#94a3b8',
  },
  envGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
  },
  envItem: {
    alignItems: 'center',
    flex: 1,
  },
  envIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  envLabel: {
    fontSize: 12,
    color: '#64748b',
  },
  envValue: {
    fontSize: 16,
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
    marginBottom: 24,
  },
  nextTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
  },
  nextBullet: {
    fontSize: 13,
    color: '#15803d',
    lineHeight: 20,
    marginBottom: 4,
  },
  bold: {
    fontWeight: '700',
  },
});
