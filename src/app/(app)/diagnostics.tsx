import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useDiagnostics } from '@/hooks/use-diagnostics';

export default function DiagnosticsScreen() {
  const router = useRouter();
  const {
    user,
    currentOrg,
    currentRole,
    realtimeStatus,
    lastTick,
    tickCount,
    pingMs,
    isPinging,
    seedIntegrity,
    testPing,
    refreshMetadata,
  } = useDiagnostics();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([testPing(), refreshMetadata()]);
    setRefreshing(false);
  };

  const getRoleLabel = (role: string | null) => {
    if (role === 'producer') return '🌱 Productor (Acceso Total)';
    if (role === 'operator') return '🚜 Operador de Riego';
    if (role === 'advisor') return '📋 Asesor Agrónomo (Solo Lectura)';
    return 'Sin rol asignado';
  };

  const getPingBadge = (ms: number | null) => {
    if (ms === null) return { label: 'Calculando...', color: '#64748b', bg: '#f1f5f9' };
    if (ms < 300) return { label: `${ms} ms (Excelente)`, color: '#15803d', bg: '#dcfce7' };
    if (ms < 700) return { label: `${ms} ms (Normal)`, color: '#b45309', bg: '#fef3c7' };
    return { label: `${ms} ms (Elevada)`, color: '#b91c1c', bg: '#fee2e2' };
  };

  const pingBadge = getPingBadge(pingMs);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Barra de Navegación Superior */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backBtnText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.navTitle}>Diagnóstico y Métricas RNF</Text>
        <View style={styles.realtimePill}>
          <View
            style={[
              styles.realtimeDot,
              realtimeStatus === 'connected'
                ? styles.dotConnected
                : realtimeStatus === 'connecting'
                ? styles.dotConnecting
                : styles.dotDisconnected,
            ]}
          />
          <Text style={styles.realtimeText}>
            {realtimeStatus === 'connected'
              ? 'Realtime OK'
              : realtimeStatus === 'connecting'
              ? 'Conectando...'
              : 'Desconectado'}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#166534']} />
        }
      >
        {/* Banner Didáctico y Ético (RNF-10) */}
        <View style={styles.ethicsCard}>
          <Text style={styles.ethicsTitle}>ℹ️ Aviso de Transparencia y Ética (RNF-10)</Text>
          <Text style={styles.ethicsText}>
            Los datos de telemetría de suelo, clima y coordenadas GPS del establecimiento didáctico Concordia son simulados exclusivamente con propósitos académicos y de evaluación para FCyT 2026.
          </Text>
        </View>

        {/* 1. Identidad y Control de Acceso (RF-23, RF-01, RF-02) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={styles.cardTitle}>Identidad y Sesión Activa</Text>
          </View>

          <View style={styles.metricGrid}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Usuario Autenticado:</Text>
              <Text style={styles.metricValue}>{user?.email || 'No disponible'}</Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>User ID (auth.uid):</Text>
              <Text style={styles.metricCode}>{user?.id || '---'}</Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Rol en el Establecimiento:</Text>
              <Text style={[styles.metricValue, { fontWeight: '700', color: '#166534' }]}>
                {getRoleLabel(currentRole)}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Establecimiento Activo:</Text>
              <Text style={styles.metricValue}>
                {currentOrg?.name || 'Ninguno'} {currentOrg?.region ? `(${currentOrg.region})` : ''}
              </Text>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Organization ID:</Text>
              <Text style={styles.metricCode}>{currentOrg?.id || '---'}</Text>
            </View>
          </View>
        </View>

        {/* 2. Rendimiento y Latencia de Red (RNF-04) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>⚡</Text>
            <Text style={styles.cardTitle}>Latencia y Streaming en Tiempo Real</Text>
          </View>

          {/* Test de Latencia PostgREST */}
          <View style={styles.pingSection}>
            <View style={styles.pingRow}>
              <View>
                <Text style={styles.pingLabel}>Latencia PostgREST (Round-Trip Ping):</Text>
                <Text style={styles.pingSubtitle}>Tiempo de respuesta HTTP hacia la API de Supabase</Text>
              </View>
              <View style={[styles.badgePill, { backgroundColor: pingBadge.bg }]}>
                <Text style={[styles.badgeText, { color: pingBadge.color }]}>{pingBadge.label}</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.pingBtn, isPinging && styles.pingBtnDisabled]}
              onPress={testPing}
              disabled={isPinging}
              activeOpacity={0.8}
            >
              {isPinging ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.pingBtnText}>🧪 Probar Latencia de Red</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          {/* Último Tick de Sensores Recibido (RNF-04) */}
          <View style={styles.tickSection}>
            <View style={styles.tickHeaderRow}>
              <Text style={styles.tickSectionTitle}>Último Tick de Sensor (Supabase Realtime)</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{tickCount} recibidos</Text>
              </View>
            </View>

            {lastTick ? (
              <View style={styles.tickCard}>
                <View style={styles.tickTopRow}>
                  <View>
                    <Text style={styles.tickStationName}>{lastTick.stationName}</Text>
                    <Text style={styles.tickPlotName}>Lote: {lastTick.plotName}</Text>
                  </View>

                  {/* Badge de Cumplimiento RNF-04 */}
                  <View
                    style={[
                      styles.rnfBadge,
                      lastTick.apparentLagMs <= 3000 ? styles.rnfBadgeOk : styles.rnfBadgeWarn,
                    ]}
                  >
                    <Text
                      style={[
                        styles.rnfBadgeText,
                        lastTick.apparentLagMs <= 3000 ? styles.rnfTextOk : styles.rnfTextWarn,
                      ]}
                    >
                      {lastTick.apparentLagMs <= 3000 ? '✅ RNF-04 Cumplido (≤ 3s)' : '⚠️ Lag > 3s'}
                    </Text>
                  </View>
                </View>

                {/* Métricas del Tick */}
                <View style={styles.tickMetricsGrid}>
                  <View style={styles.tickMetricItem}>
                    <Text style={styles.tickMetricLabel}>💧 Humedad</Text>
                    <Text style={styles.tickMetricValue}>{lastTick.reading.moisture_pct.toFixed(1)}%</Text>
                  </View>

                  <View style={styles.tickMetricItem}>
                    <Text style={styles.tickMetricLabel}>🌡️ Temperatura</Text>
                    <Text style={styles.tickMetricValue}>
                      {lastTick.reading.temp_c !== null ? `${lastTick.reading.temp_c.toFixed(1)} °C` : '--'}
                    </Text>
                  </View>

                  <View style={styles.tickMetricItem}>
                    <Text style={styles.tickMetricLabel}>🌧️ Lluvia</Text>
                    <Text style={styles.tickMetricValue}>{lastTick.reading.rain_mm.toFixed(1)} mm</Text>
                  </View>

                  <View style={styles.tickMetricItem}>
                    <Text style={styles.tickMetricLabel}>⏱️ Lag Aparente</Text>
                    <Text style={[styles.tickMetricValue, { color: '#0284c7' }]}>
                      {(lastTick.apparentLagMs / 1000).toFixed(2)} s
                    </Text>
                  </View>
                </View>

                <View style={styles.tickTimeRow}>
                  <Text style={styles.tickTimeText}>
                    Medido en campo: {new Date(lastTick.reading.measured_at).toLocaleTimeString()}
                  </Text>
                  <Text style={styles.tickTimeText}>
                    Recibido en app: {lastTick.receivedAt.toLocaleTimeString()}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyTickBox}>
                <ActivityIndicator size="small" color="#166534" style={{ marginBottom: 8 }} />
                <Text style={styles.emptyTickTitle}>Aguardando próximo tick del simulador IoT...</Text>
                <Text style={styles.emptyTickSub}>
                  El simulador emite cada 5 s hacia Redpanda y el worker ingesta en Supabase.
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 3. Verificación de Integridad de Datos Semilla (RNF-06) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🌾</Text>
            <Text style={styles.cardTitle}>Integridad de Datos Semilla (Concordia)</Text>
          </View>

          {seedIntegrity ? (
            <View style={styles.seedGrid}>
              <View style={styles.seedItem}>
                <Text style={styles.seedLabel}>Lotes Requeridos</Text>
                <Text style={styles.seedValue}>{seedIntegrity.plotsCount} / 3</Text>
                <Text style={styles.seedSub}>Costa 1, Costa 2, Monte A</Text>
              </View>

              <View style={styles.seedItem}>
                <Text style={styles.seedLabel}>Estaciones IoT</Text>
                <Text style={styles.seedValue}>{seedIntegrity.stationsCount} / 3</Text>
                <Text style={styles.seedSub}>1 por cada lote</Text>
              </View>

              <View style={styles.seedItem}>
                <Text style={styles.seedLabel}>Válvulas de Riego</Text>
                <Text style={styles.seedValue}>{seedIntegrity.valvesCount} / 3</Text>
                <Text style={styles.seedSub}>1 por cada lote</Text>
              </View>

              <View style={styles.seedItem}>
                <Text style={styles.seedLabel}>Lecturas Registradas</Text>
                <Text style={styles.seedValue}>{seedIntegrity.readingsCount}</Text>
                <Text style={styles.seedSub}>Serie temporal 6h</Text>
              </View>
            </View>
          ) : (
            <ActivityIndicator size="small" color="#166534" />
          )}
        </View>

        {/* 4. Matriz de Cumplimiento de Requisitos No Funcionales (RNFs) */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>📋</Text>
            <Text style={styles.cardTitle}>Matriz de Verificación RNF</Text>
          </View>

          <View style={styles.rnfList}>
            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-01: Stack Móvil Estricto</Text>
                <Text style={styles.rnfDesc}>React Native (Expo SDK 57), TypeScript strict mode y Expo Router.</Text>
              </View>
            </View>

            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-02: Seguridad y Frontera de Red</Text>
                <Text style={styles.rnfDesc}>Sin service_role en el móvil; anon key + RLS; cliente Redpanda confinado al backend.</Text>
              </View>
            </View>

            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-03: Tiempo de Carga Inicial</Text>
                <Text style={styles.rnfDesc}>Carga de mapas, polígonos GeoJSON y semáforo operativo en &lt; 3 s.</Text>
              </View>
            </View>

            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-04: Actualización en Tiempo Real</Text>
                <Text style={styles.rnfDesc}>Transición visual de lecturas de sensores y comandos en UI en ≤ 3 s (≤ 5 s actuador).</Text>
              </View>
            </View>

            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-05: Manejo de Errores Sin Spinner Infinito</Text>
                <Text style={styles.rnfDesc}>Timeout de 10 s para órdenes pendientes y mitigación automática de desfasaje de reloj (PGRST303).</Text>
              </View>
            </View>

            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-06: Reproducibilidad y Documentación</Text>
                <Text style={styles.rnfDesc}>Datos semilla para Concordia, Entre Ríos, docker-compose.yml y README detallado.</Text>
              </View>
            </View>

            <View style={styles.rnfRow}>
              <Text style={styles.rnfStatusIcon}>✅</Text>
              <View style={styles.rnfCol}>
                <Text style={styles.rnfName}>RNF-10: Datos Ficticios / Ética</Text>
                <Text style={styles.rnfDesc}>Declaración explícita de datos y coordenadas GPS didácticas para propósitos académicos.</Text>
              </View>
            </View>
          </View>
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
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backBtnText: {
    color: '#166534',
    fontSize: 14,
    fontWeight: '700',
  },
  navTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  realtimePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  realtimeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 6,
  },
  dotConnected: {
    backgroundColor: '#16a34a',
  },
  dotConnecting: {
    backgroundColor: '#eab308',
  },
  dotDisconnected: {
    backgroundColor: '#dc2626',
  },
  realtimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  ethicsCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  ethicsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1d4ed8',
    marginBottom: 4,
  },
  ethicsText: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 17,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  cardIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
  },
  metricGrid: {
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  metricLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
  },
  metricCode: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#334155',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pingSection: {
    gap: 12,
  },
  pingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pingLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  pingSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  badgePill: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pingBtn: {
    backgroundColor: '#166534',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  pingBtnDisabled: {
    backgroundColor: '#94a3b8',
  },
  pingBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  tickSection: {
    gap: 10,
  },
  tickHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tickSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
  },
  countPill: {
    backgroundColor: '#dbeafe',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  countPillText: {
    color: '#1e40af',
    fontSize: 11,
    fontWeight: '700',
  },
  tickCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  tickTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tickStationName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
  },
  tickPlotName: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  rnfBadge: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  rnfBadgeOk: {
    backgroundColor: '#dcfce7',
  },
  rnfBadgeWarn: {
    backgroundColor: '#fef3c7',
  },
  rnfBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rnfTextOk: {
    color: '#15803d',
  },
  rnfTextWarn: {
    color: '#b45309',
  },
  tickMetricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  tickMetricItem: {
    alignItems: 'center',
  },
  tickMetricLabel: {
    fontSize: 11,
    color: '#64748b',
  },
  tickMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  tickTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 6,
  },
  tickTimeText: {
    fontSize: 10,
    color: '#94a3b8',
  },
  emptyTickBox: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyTickTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  emptyTickSub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  seedGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  seedItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  seedLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  seedValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#166534',
    marginVertical: 4,
  },
  seedSub: {
    fontSize: 11,
    color: '#94a3b8',
  },
  rnfList: {
    gap: 12,
  },
  rnfRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rnfStatusIcon: {
    fontSize: 14,
    marginRight: 10,
    marginTop: 2,
  },
  rnfCol: {
    flex: 1,
  },
  rnfName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  rnfDesc: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 16,
    marginTop: 1,
  },
});
