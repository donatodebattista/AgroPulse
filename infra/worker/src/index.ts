import { Kafka } from 'kafkajs';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

dotenv.config();

// Polyfill de WebSocket para compatibilidad robusta en Node.js
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = WebSocket;
}

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || 'redpanda:9092').split(',');
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const SIMULATE_FAILURES = process.env.SIMULATE_FAILURES === 'true'; // 10% fallos aleatorios si se activa

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[WORKER] ❌ Error: SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no configurados.');
  process.exit(1);
}

// Cliente Supabase con rol de servicio (bypasses RLS para ingesta masiva de sensores y control de actuadores)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: WebSocket as any,
  },
});

const kafka = new Kafka({
  clientId: 'agropulse-supabase-worker',
  brokers: KAFKA_BROKERS,
  retry: {
    initialRetryTime: 1000,
    retries: 25,
  },
});

const consumer = kafka.consumer({
  groupId: 'agropulse-supabase-worker-group',
});

const producer = kafka.producer();

// Cache en memoria para combinar clima y humedad antes de insertar
const weatherCache: Record<string, number> = {};

// Mapa de nombres para logs descriptivos (RF-24)
const STATION_NAMES: Record<string, string> = {
  'd0000000-0000-0000-0000-000000000001': 'Costa 1-Norte',
  'd0000000-0000-0000-0000-000000000002': 'Costa 2-Sur',
  'd0000000-0000-0000-0000-000000000003': 'Monte A-Centro',
};

// 1. Ingesta de Telemetría (soil.moisture y weather.tick)
async function processTelemetryMessage(topic: string, messageValue: string) {
  const data = JSON.parse(messageValue);

  if (topic === 'weather.tick') {
    weatherCache[data.station_id] = data.rain_mm || 0.0;
    return;
  }

  if (topic === 'soil.moisture') {
    const stationName = STATION_NAMES[data.station_id] || data.station_id.slice(0, 8);
    const rain = weatherCache[data.station_id] ?? 0.0;

    const { error } = await supabase.from('readings').insert({
      station_id: data.station_id,
      measured_at: data.ts,
      moisture_pct: data.moisture_pct,
      temp_c: data.temp_c,
      rain_mm: rain,
      source: 'sensor',
    });

    if (error) {
      console.error(`[CONSUMER] ❌ Error insertando reading para ${stationName}:`, error.message);
    } else {
      console.log(
        `[CONSUMER] 📥 Consumed soil.moisture | ${stationName} | Humedad: ${data.moisture_pct}% | Temp: ${data.temp_c}°C -> Inserted reading in Supabase (RNF-04 < 1s)`
      );
    }
  }
}

// 2. Procesador de Comandos de Riego (Actuador IoT - RF-15, RNF-04)
async function processPendingIrrigationCommands() {
  try {
    const { data: commands, error } = await supabase
      .from('irrigation_commands')
      .select('id, valve_id, action, duration_min, client_request_id')
      .eq('status', 'pending');

    if (error) {
      console.warn('[ACTUATOR] Error al consultar comandos pendientes:', error.message);
      return;
    }

    if (!commands || commands.length === 0) return;

    for (const cmd of commands) {
      console.log(
        `[ACTUATOR] ⚙️ Detectada orden pendiente: ${cmd.id} | Válvula: ${cmd.valve_id} | Acción: ${cmd.action} (duración: ${cmd.duration_min || 0}m)`
      );

      // Simular latencia física del actuador mecánico (1.5s)
      await new Promise((res) => setTimeout(res, 1500));

      // Simulación de fallo aleatorio (10%) si está habilitada (PRD §04)
      const shouldFail = SIMULATE_FAILURES && Math.random() < 0.1;

      if (shouldFail) {
        await supabase
          .from('irrigation_commands')
          .update({
            status: 'failed',
            failure_reason: 'valve_timeout',
          })
          .eq('id', cmd.id);

        console.log(`[ACTUATOR] ❌ Orden ${cmd.id} FALLÓ (simulated: valve_timeout).`);
      } else {
        const valveStatus = cmd.action === 'open' ? 'open' : 'closed';

        // 1. Actualizar estado real de la válvula
        const { error: valveErr } = await supabase
          .from('valves')
          .update({
            status: valveStatus,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cmd.valve_id);

        if (valveErr) {
          console.error(`[ACTUATOR] ❌ Error actualizando válvula ${cmd.valve_id}:`, valveErr.message);
          continue;
        }

        // 2. Marcar orden como 'applied'
        const { error: cmdErr } = await supabase
          .from('irrigation_commands')
          .update({
            status: 'applied',
            applied_at: new Date().toISOString(),
          })
          .eq('id', cmd.id);

        if (cmdErr) {
          console.error(`[ACTUATOR] ❌ Error cerrando comando ${cmd.id}:`, cmdErr.message);
          continue;
        }

        // 3. Publicar evento a topic `valve.status` en Redpanda (PRD §10)
        try {
          await producer.send({
            topic: 'valve.status',
            messages: [
              {
                key: cmd.valve_id,
                value: JSON.stringify({
                  valve_id: cmd.valve_id,
                  status: valveStatus,
                  command_id: cmd.id,
                  ts: new Date().toISOString(),
                }),
              },
            ],
          });
        } catch (kafkaErr: any) {
          console.warn('[ACTUATOR] Aviso: No se pudo publicar a valve.status:', kafkaErr.message);
        }

        console.log(
          `[ACTUATOR] ✅ Orden ${cmd.id} APLICADA. Válvula ${cmd.valve_id} ahora está '${valveStatus}' (≤ 3s).`
        );
      }
    }
  } catch (err: any) {
    console.error('[ACTUATOR] Error en ciclo del actuador:', err.message);
  }
}

// 3. Tarea de Retención de Datos (> 48h) (PRD §08)
async function cleanupOldReadings() {
  try {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('readings')
      .delete()
      .lt('measured_at', twoDaysAgo);

    if (!error) {
      console.log('[RETENTION] 🧹 Depuración de lecturas antiguas (> 48h) ejecutada.');
    }
  } catch (err: any) {
    console.warn('[RETENTION] Error en purga de datos:', err.message);
  }
}

async function startWorker() {
  console.log('====================================================');
  console.log('⚙️ AgroPulse - Worker Consumer & Ingestor Supabase (RF-24)');
  console.log(`📡 Broker Redpanda: ${KAFKA_BROKERS.join(', ')}`);
  console.log(`🌐 Supabase URL: ${SUPABASE_URL}`);
  console.log('====================================================');

  let connected = false;
  while (!connected) {
    try {
      console.log('[WORKER] Conectando a Redpanda...');
      await consumer.connect();
      await producer.connect();
      connected = true;
      console.log('[WORKER] ✅ Conectado exitosamente a Redpanda');
    } catch (err: any) {
      console.warn(`[WORKER] Reintentando conexión con Redpanda en 3s... (${err.message})`);
      await new Promise((res) => setTimeout(res, 3000));
    }
  }

  // Suscribirse a los topics de telemetría de suelo y clima
  await consumer.subscribe({ topics: ['soil.moisture', 'weather.tick'], fromBeginning: false });

  // Iniciar sondeo activo del actuador de riego cada 2 segundos
  setInterval(processPendingIrrigationCommands, 2000);

  // Iniciar depuración de retención cada 1 hora
  setInterval(cleanupOldReadings, 60 * 60 * 1000);

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      try {
        await processTelemetryMessage(topic, message.value.toString());
      } catch (err: any) {
        console.error(`[WORKER] Error procesando mensaje de topic ${topic}:`, err.message);
      }
    },
  });
}

startWorker().catch((err) => {
  console.error('[WORKER] Error fatal en el worker:', err);
  process.exit(1);
});
