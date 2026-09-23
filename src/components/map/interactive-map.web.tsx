import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PlotWithStatus } from '@/types/database.types';
import { geoJsonToCoordinates, LatLng } from '@/utils/geo';
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
  // Proyección de coordenadas a espacio SVG (Bounding box de Concordia: aprox Lat -31.405 a -31.385, Lng -58.030 a -58.010)
  const minLng = -58.030;
  const maxLng = -58.010;
  const minLat = -31.405;
  const maxLat = -31.385;

  const width = 360;
  const height = 440;

  const projectToSvg = (lat: number, lng: number) => {
    const x = ((lng - minLng) / (maxLng - minLng)) * (width - 40) + 20;
    // Latitud invertida porque en SVG Y crece hacia abajo
    const y = ((maxLat - lat) / (maxLat - minLat)) * (height - 40) + 20;
    return { x, y };
  };

  return (
    <View style={styles.webContainer}>
      <View style={styles.webHeaderNotice}>
        <Text style={styles.webNoticeText}>🗺️ Vista Web de Concordia (Entre Ríos)</Text>
      </View>

      <View style={styles.canvasContainer}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
          {/* Fondo cuadriculado tipo mapa satelital suave */}
          <rect width={width} height={height} fill="#f1f5f9" rx="16" />

          {/* Renderizado de Polígonos de Lotes */}
          {plots.map((plot) => {
            const coords = geoJsonToCoordinates(plot.geojson);
            if (coords.length < 3) return null;

            const semaforo = getSemaforoInfo(plot.status);
            const isSelected = selectedPlot?.id === plot.id;

            const pointsString = coords
              .map((c) => {
                const { x, y } = projectToSvg(c.latitude, c.longitude);
                return `${x},${y}`;
              })
              .join(' ');

            return (
              <polygon
                key={plot.id}
                points={pointsString}
                fill={semaforo.polygonFill}
                stroke={isSelected ? '#0f172a' : semaforo.polygonStroke}
                strokeWidth={isSelected ? '3.5' : '2'}
                style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                onClick={() => onSelectPlot(plot)}
              />
            );
          })}

          {/* Marcadores de Lotes (Texto y Humedad) */}
          {plots.map((plot) => {
            const coords = geoJsonToCoordinates(plot.geojson);
            if (coords.length < 3) return null;

            const semaforo = getSemaforoInfo(plot.status);
            // Calcular centro
            const avgLat = coords.reduce((acc, c) => acc + c.latitude, 0) / coords.length;
            const avgLng = coords.reduce((acc, c) => acc + c.longitude, 0) / coords.length;
            const { x, y } = projectToSvg(avgLat, avgLng);

            return (
              <g key={`marker-${plot.id}`} onClick={() => onSelectPlot(plot)} style={{ cursor: 'pointer' }}>
                <rect
                  x={x - 42}
                  y={y - 14}
                  width="84"
                  height="26"
                  rx="6"
                  fill="#ffffff"
                  stroke={semaforo.polygonStroke}
                  strokeWidth="1.5"
                  filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.15))"
                />
                <text
                  x={x}
                  y={y + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="bold"
                  fill="#0f172a"
                  fontFamily="system-ui, sans-serif"
                >
                  {plot.name} {plot.last_moisture_pct ? `(${plot.last_moisture_pct.toFixed(0)}%)` : ''}
                </text>
              </g>
            );
          })}

          {/* Marcador GPS de Usuario */}
          {userLocation && (() => {
            const { x, y } = projectToSvg(userLocation.latitude, userLocation.longitude);
            return (
              <g key="user-location-pin">
                <circle cx={x} cy={y} r="12" fill="rgba(59, 130, 246, 0.3)" />
                <circle cx={x} cy={y} r="6" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
              </g>
            );
          })()}
        </svg>
      </View>

      {/* Chips interactivos rápidos abajo */}
      <View style={styles.plotChipsRow}>
        {plots.map((p) => {
          const sem = getSemaforoInfo(p.status);
          const isSelected = selectedPlot?.id === p.id;
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.plotChip,
                { borderColor: sem.polygonStroke },
                isSelected && { backgroundColor: sem.badgeBg },
              ]}
              onPress={() => onSelectPlot(p)}
            >
              <Text style={styles.plotChipText}>{sem.icon} {p.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  webHeaderNotice: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  webNoticeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
  },
  canvasContainer: {
    width: '100%',
    maxWidth: 400,
    height: 440,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  plotChipsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  plotChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  plotChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b',
  },
});
