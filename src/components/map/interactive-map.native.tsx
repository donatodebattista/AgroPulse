import React, { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from 'react-native-maps';
import { PlotWithStatus } from '@/types/database.types';
import { geoJsonToCoordinates, calculatePolygonCenter, LatLng } from '@/utils/geo';
import { getSemaforoInfo } from '@/utils/semaforo';

export interface InteractiveMapProps {
  plots: PlotWithStatus[];
  selectedPlot: PlotWithStatus | null;
  onSelectPlot: (plot: PlotWithStatus) => void;
  userLocation: LatLng | null;
}

export function InteractiveMap({
  plots,
  selectedPlot,
  onSelectPlot,
  userLocation,
}: InteractiveMapProps) {
  const mapRef = useRef<MapView | null>(null);

  // Coordenadas iniciales centradas en la zona Concordia (Entre Ríos)
  const initialRegion = {
    latitude: -31.395,
    longitude: -58.02,
    latitudeDelta: 0.022,
    longitudeDelta: 0.022,
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
      >
        {/* Renderizado de Polígonos con Semáforo (RF-05, RF-12) */}
        {plots.map((plot) => {
          const coordinates = geoJsonToCoordinates(plot.geojson);
          if (coordinates.length < 3) return null;

          const semaforo = getSemaforoInfo(plot.status);
          const isSelected = selectedPlot?.id === plot.id;
          const center = calculatePolygonCenter(coordinates);

          return (
            <React.Fragment key={plot.id}>
              <Polygon
                coordinates={coordinates}
                fillColor={semaforo.polygonFill}
                strokeColor={isSelected ? '#000000' : semaforo.polygonStroke}
                strokeWidth={isSelected ? 3.5 : 2}
                tappable
                onPress={() => onSelectPlot(plot)}
              />

              {/* Marcador central con nombre y humedad */}
              <Marker
                coordinate={center}
                onPress={() => onSelectPlot(plot)}
                tracksViewChanges={false}
              >
                <View style={[styles.markerBadge, { borderColor: semaforo.polygonStroke }]}>
                  <Text style={styles.markerIcon}>{semaforo.icon}</Text>
                  <Text style={styles.markerName}>{plot.name}</Text>
                  {plot.last_moisture_pct !== null && (
                    <Text style={styles.markerMoisture}>
                      {plot.last_moisture_pct.toFixed(0)}%
                    </Text>
                  )}
                </View>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Marcador manual de ubicación de usuario si existe */}
        {userLocation && (
          <Marker coordinate={userLocation} title="Mi Ubicación">
            <View style={styles.userPin}>
              <View style={styles.userPinCore} />
            </View>
          </Marker>
        )}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  markerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  markerIcon: {
    fontSize: 10,
  },
  markerName: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0f172a',
  },
  markerMoisture: {
    fontSize: 11,
    fontWeight: '800',
    color: '#166534',
  },
  userPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(59, 130, 246, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userPinCore: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2563eb',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
