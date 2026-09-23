import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppHeader } from '@/components/common/app-header';
import { InteractiveMap } from '@/components/map/interactive-map';
import { MapLegend } from '@/components/map/map-legend';
import { PlotPreviewCard } from '@/components/map/plot-preview-card';
import { usePlots } from '@/hooks/use-plots';
import { useLocation } from '@/hooks/use-location';
import { PlotWithStatus } from '@/types/database.types';

export default function MapScreen() {
  const { plots, isLoading: isLoadingPlots, error: plotsError, refreshPlots } = usePlots();
  const {
    userLocation,
    isLoadingLocation,
    locationError,
    currentPlot,
    refreshLocation,
    simulateLocation,
  } = useLocation(plots);

  const [selectedPlot, setSelectedPlot] = useState<PlotWithStatus | null>(null);
  const [showSimModal, setShowSimModal] = useState<boolean>(false);

  // Ubicaciones de prueba de Concordia para demostración en clase (RF-06)
  const testLocations = [
    { label: 'Dentro de Costa 1', coords: { latitude: -31.3925, longitude: -58.0225 } },
    { label: 'Dentro de Costa 2', coords: { latitude: -31.3925, longitude: -58.0175 } },
    { label: 'Dentro de Monte A', coords: { latitude: -31.3990, longitude: -58.0200 } },
    { label: 'Fuera de los lotes', coords: { latitude: -31.4200, longitude: -58.0500 } },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppHeader />

      {/* Banner de Estado GPS "Estoy en el lote" (RF-06) */}
      <View
        style={[
          styles.gpsBanner,
          currentPlot
            ? styles.gpsBannerInside
            : locationError
            ? styles.gpsBannerError
            : styles.gpsBannerOutside,
        ]}
      >
        <Text style={styles.gpsBannerIcon}>
          {currentPlot ? '📍' : locationError ? '⚠️' : '🧭'}
        </Text>
        <Text
          style={[
            styles.gpsBannerText,
            currentPlot
              ? styles.gpsTextInside
              : locationError
              ? styles.gpsTextError
              : styles.gpsTextOutside,
          ]}
          numberOfLines={1}
        >
          {locationError
            ? 'Ubicación no disponible'
            : currentPlot
            ? `Estás en el lote: ${currentPlot.name}`
            : 'Fuera de los lotes monitoreados'}
        </Text>

        <TouchableOpacity
          style={styles.gpsSimButton}
          onPress={() => setShowSimModal(!showSimModal)}
        >
          <Text style={styles.gpsSimButtonText}>Simular GPS</Text>
        </TouchableOpacity>
      </View>

      {/* Menú flotante de simulación GPS para defensa / emulador */}
      {showSimModal && (
        <View style={styles.simModalBox}>
          <Text style={styles.simModalTitle}>Simular Posición GPS (RF-06):</Text>
          <View style={styles.simButtonsRow}>
            {testLocations.map((item, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.simItem}
                onPress={() => {
                  simulateLocation(item.coords);
                  setShowSimModal(false);
                }}
              >
                <Text style={styles.simItemText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Área del Mapa */}
      <View style={styles.mapArea}>
        {isLoadingPlots ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#166534" />
            <Text style={styles.loadingText}>Cargando cartografía de lotes...</Text>
          </View>
        ) : plotsError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorText}>No se pudieron cargar los lotes</Text>
            <Text style={styles.errorSubtext}>{plotsError}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refreshPlots}>
              <Text style={styles.retryButtonText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <InteractiveMap
              plots={plots}
              selectedPlot={selectedPlot}
              onSelectPlot={(plot) => setSelectedPlot(plot)}
              userLocation={userLocation}
            />

            {/* Leyenda Accesible del Semáforo */}
            <MapLegend />

            {/* Botón FAB para refrescar ubicación real */}
            <TouchableOpacity
              style={styles.fabLocation}
              onPress={refreshLocation}
              activeOpacity={0.8}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#166534" />
              ) : (
                <Text style={styles.fabIcon}>🎯</Text>
              )}
            </TouchableOpacity>

            {/* Tarjeta de Detalle Rápido del Lote Seleccionado (RF-05) */}
            {selectedPlot && (
              <PlotPreviewCard
                plot={selectedPlot}
                onClose={() => setSelectedPlot(null)}
                isUserInside={currentPlot?.id === selectedPlot.id}
              />
            )}
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  gpsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  gpsBannerInside: {
    backgroundColor: '#dcfce7',
    borderBottomColor: '#86efac',
  },
  gpsBannerOutside: {
    backgroundColor: '#f1f5f9',
    borderBottomColor: '#e2e8f0',
  },
  gpsBannerError: {
    backgroundColor: '#fef2f2',
    borderBottomColor: '#fecaca',
  },
  gpsBannerIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  gpsBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  gpsTextInside: {
    color: '#15803d',
  },
  gpsTextOutside: {
    color: '#475569',
  },
  gpsTextError: {
    color: '#dc2626',
  },
  gpsSimButton: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  gpsSimButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  simModalBox: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    zIndex: 15,
  },
  simModalTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 6,
  },
  simButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  simItem: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  simItemText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
  },
  mapArea: {
    flex: 1,
    position: 'relative',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  errorEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  errorSubtext: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#166534',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  fabLocation: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    zIndex: 20,
  },
  fabIcon: {
    fontSize: 20,
  },
});
