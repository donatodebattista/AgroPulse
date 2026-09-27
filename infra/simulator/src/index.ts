import { Kafka, Partitioners } from 'kafkajs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

dotenv.config();

// Polyfill de WebSocket para compatibilidad robusta en Node.js
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'redpanda:9092').split(',');
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '5000', 10);
const SIMULATE_MONTE_A_STALE = process.env.SIMULATE_MONTE_A_STALE !== 'false'; // default true

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const supabase = SUPABASE_URL && SUPABASE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false },
      realtime: { transport: WebSocket as any },
    })
  : null;

// UUIDs fijos de la semilla Concordia (Entre Ríos)
const STATIONS = {
  COSTA_1: {
    id: 'd0000000-0000-0000-0000-000000000001',
    name: 'Estación Costa 1-Norte',
    plot: 'Costa 1 (Citrus)',
    targetStatus: 'optimal',
    baseMoisture: 35.8,
    tempBase: 24.0,
    valveId: 'e0000000-0000-0000-0000-000000000001',
  },
  COSTA_2: {
    id: 'd0000000-0000-0000-0000-000000000002',
    name: 'Estación Costa 2-Sur',
    plot: 'Costa 2 (Citrus)',
    targetStatus: 'dry',
    baseMoisture: 18.2,
    tempBase: 27.5,
    valveId: 'e0000000-0000-0000-0000-000000000002',
  },
  MONTE_A: {
    id: 'd0000000-0000-0000-0000-000000000003',
    name: 'Estación Monte A-Centro',
    plot: 'Monte A (Soja)',
    targetStatus: 'stale',
    baseMoisture: 36.5,
    tempBase: 22.0,
    valveId: 'e0000000-0000-0000-0000-000000000003',
  },
};

// Estado dinámico en memoria
const simulationState: Record<string, { currentMoisture: number; isIrrigating: boolean }> = {
  [STATIONS.COSTA_1.id]: { currentMoisture: STATIONS.COSTA_1.baseMoisture, isIrrigating: false },
  [STATIONS.COSTA_2.id]: { currentMoisture: STATIONS.COSTA_2.baseMoisture, isIrrigating: false },
  [STATIONS.MONTE_A.id]: { currentMoisture: STATIONS.MONTE_A.baseMoisture, isIrrigating: false },
};

const kafka = new Kafka({
  clientId: 'agropulse-telemetry-simulator',
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 1000,
    retries: 20,
  },
});

const producer = kafka.producer({
  createPartitioner: Partitioners.DefaultPartitioner,
});

// Consultar periódicamente si las válvulas están abiertas para simular absorción de agua
async function checkValveStatus() {
  if (!supabase) return;

  try {
    const { data, error } = await supabase
      .from('valves')
      .select('id, status');

    if (error) {
      console.warn('[SIMULATOR] Error consultando estado de válvulas:', error.message);
      return;
    }

    if (data) {
      for (const valve of data) {
        if (valve.id === STATIONS.COSTA_1.valveId) {
          simulationState[STATIONS.COSTA_1.id].isIrrigating = valve.status === 'open';
        }
        if (valve.id === STATIONS.COSTA_2.valveId) {
          simulationState[STATIONS.COSTA_2.id].isIrrigating = valve.status === 'open';
        }
      }
    }
  } catch (err: any) {
    console.warn('[SIMULATOR] Error al verificar estado de válvulas:', err.message);
  }
}

async function startSimulator() {
  console.log('====================================================');
  console.log('🌱 AgroPulse - Simulador de Telemetría IoT (RF-24)');
  console.log(`📡 Broker Redpanda: ${KAFKA_BROKERS.join(', ')}`);
  console.log(`⏱️ Intervalo de emisión: ${TICK_INTERVAL_MS / 1000}s`);
  console.log(`🍂 Simular Monte A en Stale: ${SIMULATE_MONTE_A_STALE ? 'SÍ (> 15 min sin emitir)' : 'NO'}`);
  console.log('====================================================');

  let connected = false;
  while (!connected) {
    try {
      console.log('[SIMULATOR] Conectando a Redpanda...');
      await producer.connect();
      connected = true;
      console.log('[SIMULATOR] ✅ Conectado exitosamente a Redpanda');
    } catch (err: any) {
      console.warn(`[SIMULATOR] Reintentando conexión con Redpanda en 3s... (${err.message})`);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  // Verificar estado de válvulas cada 10s
  setInterval(checkValveStatus, 10000);
  await checkValveStatus();

  // Bucle de emisión de ticks
  setInterval(async () => {
    const now = new Date().toISOString();

    for (const [key, station] of Object.entries(STATIONS)) {
      // Si Monte A está en modo stale didáctico, no emitimos ticks para que la app muestre el badge stale
      if (key === 'MONTE_A' && SIMULATE_MONTE_A_STALE) {
        continue;
      }

      const state = simulationState[station.id];

      // Dinámica de humedad: si la válvula está abierta (regando), sube; si no, fluctúa suavemente
      if (state.isIrrigating) {
        state.currentMoisture = Math.min(37.5, state.currentMoisture + 0.6 + Math.random() * 0.4);
      } else {
        if (key === 'COSTA_2') {
          // Costa 2 es seco por diseño (tiende a ~18.5% si no se riega)
          const target = 18.5;
          const delta = (target - state.currentMoisture) * 0.1 + (Math.random() - 0.5) * 0.4;
          state.currentMoisture = Math.max(16.0, Math.min(22.0, state.currentMoisture + delta));
        } else {
          // Costa 1 es óptimo (oscila alrededor de 35.8%)
          const noise = (Math.random() - 0.5) * 0.6;
          state.currentMoisture = Math.max(33.0, Math.min(38.0, state.currentMoisture + noise));
        }
      }

      const moisturePct = parseFloat(state.currentMoisture.toFixed(1));
      const tempC = parseFloat((station.tempBase + (Math.random() - 0.5) * 1.5).toFixed(1));
      const rainMm = 0.0; // Concordia día despejado

      const soilPayload = {
        station_id: station.id,
        moisture_pct: moisturePct,
        temp_c: tempC,
        ts: now,
      };

      const weatherPayload = {
        station_id: station.id,
        rain_mm: rainMm,
        ts: now,
      };

      try {
        // 1. Publicar a topic `soil.moisture`
        await producer.send({
          topic: 'soil.moisture',
          messages: [
            {
              key: station.id,
              value: JSON.stringify(soilPayload),
            },
          ],
        });

        // 2. Publicar a topic `weather.tick`
        await producer.send({
          topic: 'weather.tick',
          messages: [
            {
              key: station.id,
              value: JSON.stringify(weatherPayload),
            },
          ],
        });

        const statusNote = state.isIrrigating ? ' [💧 REGANDO]' : '';
        console.log(
          `[PRODUCER] 📡 soil.moisture | ${station.name} | Humedad: ${moisturePct}% | Temp: ${tempC}°C${statusNote}`
        );
      } catch (err: any) {
        console.error(`[PRODUCER] ❌ Error publicando telemetría para ${station.name}:`, err.message);
      }
    }
  }, TICK_INTERVAL_MS);
}

startSimulator().catch((err) => {
  console.error('[SIMULATOR] Error fatal en el simulador:', err);
  process.exit(1);
});
