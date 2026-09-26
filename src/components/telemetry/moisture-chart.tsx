import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Reading } from '@/types/database.types';

interface MoistureChartProps {
  readings: Reading[];
  thresholdMin: number;
  thresholdMax: number;
}

export function MoistureChart({ readings, thresholdMin, thresholdMax }: MoistureChartProps) {
  const [containerWidth, setContainerWidth] = useState<number>(320);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 50) {
      setContainerWidth(width);
    }
  };

  const chartHeight = 180;
  const paddingLeft = 36;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 26;

  const innerWidth = Math.max(100, containerWidth - paddingLeft - paddingRight);
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  if (readings.length === 0) {
    return (
      <View style={styles.emptyContainer} onLayout={onLayout}>
        <Text style={styles.emptyIcon}>📈</Text>
        <Text style={styles.emptyText}>Sin lecturas en las últimas 6 horas</Text>
        <Text style={styles.emptySubtext}>Los ticks entrantes por Realtime aparecerán aquí automáticamente.</Text>
      </View>
    );
  }

  // Escalas de datos
  const moistureValues = readings.map((r) => r.moisture_pct);
  const minVal = Math.min(thresholdMin - 5, ...moistureValues);
  const maxVal = Math.max(thresholdMax + 5, ...moistureValues);

  const yMin = Math.max(0, Math.floor(minVal / 5) * 5);
  const yMax = Math.min(100, Math.ceil(maxVal / 5) * 5);
  const yRange = yMax - yMin || 1;

  const getY = (val: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, val));
    return paddingTop + innerHeight - ((clamped - yMin) / yRange) * innerHeight;
  };

  const getX = (index: number) => {
    if (readings.length === 1) return paddingLeft + innerWidth / 2;
    return paddingLeft + (index / (readings.length - 1)) * innerWidth;
  };

  // Construcción de la línea y el área
  const points = readings.map((r, i) => ({
    x: getX(i),
    y: getY(r.moisture_pct),
    reading: r,
  }));

  const linePathD = points.reduce((acc, p, idx) => {
    return idx === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  const areaPathD = `${linePathD} L ${points[points.length - 1].x} ${paddingTop + innerHeight} L ${points[0].x} ${paddingTop + innerHeight} Z`;

  const yThresholdMin = getY(thresholdMin);
  const yThresholdMax = getY(thresholdMax);

  const selectedPoint = selectedIndex !== null ? points[selectedIndex] : points[points.length - 1];

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.card} onLayout={onLayout}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tendencia de Humedad (Últimas 6 h)</Text>
          <Text style={styles.subtitle}>
            {readings.length} mediciones registradas • Mínimo 12 puntos (RF-10)
          </Text>
        </View>

        {selectedPoint && (
          <View style={styles.highlightBadge}>
            <Text style={styles.highlightMoisture}>
              {selectedPoint.reading.moisture_pct.toFixed(1)}%
            </Text>
            <Text style={styles.highlightTime}>
              {formatTime(selectedPoint.reading.measured_at)}
            </Text>
          </View>
        )}
      </View>

      <Svg width={containerWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="moistureGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#166534" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#166534" stopOpacity="0.02" />
          </LinearGradient>
        </Defs>

        {/* Líneas horizontales de guía (Grid) */}
        {[yMin, (yMin + yMax) / 2, yMax].map((tick, idx) => {
          const yPos = getY(tick);
          return (
            <G key={`grid-${idx}`}>
              <Line
                x1={paddingLeft}
                y1={yPos}
                x2={paddingLeft + innerWidth}
                y2={yPos}
                stroke="#e2e8f0"
                strokeWidth="1"
              />
              <SvgText
                x={paddingLeft - 6}
                y={yPos + 4}
                fontSize="10"
                fill="#94a3b8"
                textAnchor="end"
                fontWeight="bold"
              >
                {`${Math.round(tick)}%`}
              </SvgText>
            </G>
          );
        })}

        {/* Línea de Umbral Mínimo (Rojo discontinuo) */}
        <Line
          x1={paddingLeft}
          y1={yThresholdMin}
          x2={paddingLeft + innerWidth}
          y2={yThresholdMin}
          stroke="#ef4444"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <SvgText
          x={paddingLeft + innerWidth - 2}
          y={yThresholdMin - 4}
          fontSize="9"
          fill="#dc2626"
          textAnchor="end"
          fontWeight="bold"
        >
          {`Mín: ${thresholdMin}%`}
        </SvgText>

        {/* Línea de Umbral Máximo (Azul discontinuo) */}
        <Line
          x1={paddingLeft}
          y1={yThresholdMax}
          x2={paddingLeft + innerWidth}
          y2={yThresholdMax}
          stroke="#3b82f6"
          strokeWidth="1.5"
          strokeDasharray="4 4"
        />
        <SvgText
          x={paddingLeft + innerWidth - 2}
          y={yThresholdMax - 4}
          fontSize="9"
          fill="#2563eb"
          textAnchor="end"
          fontWeight="bold"
        >
          {`Máx: ${thresholdMax}%`}
        </SvgText>

        {/* Área sombreada bajo la curva */}
        <Path d={areaPathD} fill="url(#moistureGradient)" />

        {/* Línea de la serie de tiempo */}
        <Path d={linePathD} fill="none" stroke="#166534" strokeWidth="2.5" />

        {/* Puntos de lectura interactivos */}
        {points.map((p, idx) => {
          const isSelected = selectedIndex === idx;
          const isDry = p.reading.moisture_pct < thresholdMin;
          const isWet = p.reading.moisture_pct > thresholdMax;
          const dotColor = isDry ? '#dc2626' : isWet ? '#2563eb' : '#166534';

          return (
            <G key={`point-${p.reading.id || idx}`}>
              {isSelected && (
                <Circle cx={p.x} cy={p.y} r="8" fill={dotColor} fillOpacity="0.25" />
              )}
              <Circle
                cx={p.x}
                cy={p.y}
                r={isSelected ? 5 : 3.5}
                fill={dotColor}
                stroke="#ffffff"
                strokeWidth="1.5"
              />
            </G>
          );
        })}

        {/* Etiquetas del eje X (Tiempo) */}
        {points.length > 0 && (
          <G>
            <SvgText
              x={points[0].x}
              y={chartHeight - 6}
              fontSize="10"
              fill="#64748b"
              textAnchor="start"
            >
              -6h
            </SvgText>

            {points.length > 2 && (
              <SvgText
                x={paddingLeft + innerWidth / 2}
                y={chartHeight - 6}
                fontSize="10"
                fill="#64748b"
                textAnchor="middle"
              >
                -3h
              </SvgText>
            )}

            <SvgText
              x={points[points.length - 1].x}
              y={chartHeight - 6}
              fontSize="10"
              fill="#166534"
              textAnchor="end"
              fontWeight="bold"
            >
              Ahora
            </SvgText>
          </G>
        )}
      </Svg>

      {/* Botonera de navegación por puntos */}
      <View style={styles.pointsSelector}>
        <Text style={styles.selectorLabel}>Toca un punto para inspeccionar:</Text>
        <View style={styles.pointsPills}>
          {points.slice(-6).map((p, idx, arr) => {
            const actualIdx = points.length - arr.length + idx;
            const isSelected = selectedIndex === actualIdx;
            return (
              <TouchableOpacity
                key={actualIdx}
                style={[styles.pill, isSelected && styles.pillActive]}
                onPress={() => setSelectedIndex(actualIdx)}
              >
                <Text style={[styles.pillText, isSelected && styles.pillTextActive]}>
                  {formatTime(p.reading.measured_at)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  highlightBadge: {
    alignItems: 'flex-end',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  highlightMoisture: {
    fontSize: 16,
    fontWeight: '800',
    color: '#166534',
  },
  highlightTime: {
    fontSize: 10,
    color: '#15803d',
  },
  emptyContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  emptySubtext: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 4,
  },
  pointsSelector: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  selectorLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 6,
  },
  pointsPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pillActive: {
    backgroundColor: '#166534',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  pillTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
});
