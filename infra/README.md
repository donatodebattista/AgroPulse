# AgroPulse - Infraestructura Backend, Worker IoT & Redpanda (Iteración 6)

Este directorio contiene la infraestructura de streaming de eventos y microservicios backend de **AgroPulse**, dando cumplimiento a los requisitos **RF-24**, **RNF-02**, **RNF-04** y las especificaciones de eventos del PRD (§10, §11).

---

## 🏛️ Arquitectura del Flujo de Datos

```
+-------------------------------------------------------------------------+
|                        SIMULADOR IOT (Node.js)                          |
|  - Genera ticks de sensores cada 5s para Concordia (Costa 1, Costa 2)   |
|  - Ajusta humedad dinámicamente si la válvula de riego está abierta     |
+-----------------------------------+-------------------------------------+
                                    |
                    (Kafka Protocol / Productor)
                                    v
+-----------------------------------+-------------------------------------+
|                      BROKER REDPANDA (Puerto 9092)                      |
|  - Topics:                                                              |
|    * soil.moisture: { station_id, moisture_pct, temp_c, ts }            |
|    * weather.tick:  { station_id, rain_mm, ts }                         |
|    * valve.status:  { valve_id, status, command_id, ts }                |
|  - Redpanda Console Web UI: http://localhost:8080                       |
+-----------------------------------+-------------------------------------+
                                    |
                    (Kafka Protocol / Consumidor)
                                    v
+-----------------------------------+-------------------------------------+
|                     WORKER CONSUMER & ACTUADOR                          |
|  - Ingesta lecturas en tabla 'readings' usando service_role (RNF-04 <1s)|
|  - Escucha órdenes de riego ('pending') en 'irrigation_commands'        |
|  - Aplica la orden en el actuador y actualiza la válvula a open/closed  |
|  - Tarea de mantenimiento: depura lecturas > 48h                        |
+-----------------------------------+-------------------------------------+
                                    |
                    (PostgreSQL / PostgREST / Realtime)
                                    v
+-----------------------------------+-------------------------------------+
|                       SUPABASE CLOUD / LOCAL                            |
|  - Base de datos relacional con RLS activado                            |
|  - Publicación Supabase Realtime sobre readings, valves, commands       |
+-----------------------------------+-------------------------------------+
                                    |
                    (WebSocket Seguro / JWT anon_key)
                                    v
+-----------------------------------+-------------------------------------+
|                    APLICACIÓN MÓVIL REACT NATIVE                        |
|  - Consume exclusivamente de Supabase Realtime (NUNCA conecta a Kafka)  |
|  - Actualiza gráfico, semáforo y estado de válvulas en vivo (≤ 3s)      |
+-------------------------------------------------------------------------+
```

---

## ⚙️ Configuración Previa

1. Edita el archivo `infra/.env` (o crea una copia desde `infra/.env.example`):
   ```bash
   cp infra/.env.example infra/.env
   ```

2. Configura las variables:
   - `SUPABASE_URL`: La URL de tu proyecto Supabase (ej: `https://zwvlgzdeqpntjtetzvfj.supabase.co`).
   - `SUPABASE_SERVICE_ROLE_KEY`: Obtén tu clave secreta de servicio en **Supabase Dashboard** -> **Project Settings** -> **API** -> `service_role (secret)`.
     > ⚠️ **Seguridad (RNF-02):** La `service_role_key` otorga permisos de bypass de RLS y NUNCA debe incluirse en la app móvil. Solo se utiliza dentro del contenedor Docker del worker backend.

---

## 🚀 Puesta en Marcha

Para iniciar toda la infraestructura (Redpanda + Consola Web + Simulador + Worker):

```bash
# Desde la raíz del proyecto:
npm run infra:up

# O directamente con Docker Compose:
docker compose -f infra/docker-compose.yml up --build -d
```

### Servicios Levantados:
| Servicio | Contenedor | Puerto Host | Descripción |
|---|---|---|---|
| **Redpanda** | `agropulse-redpanda` | `19092` | Broker Kafka de alta velocidad |
| **Redpanda Console** | `agropulse-console` | `8080` | Panel Web para inspeccionar topics y mensajes |
| **Simulador IoT** | `agropulse-simulator` | - | Publica ticks de suelo y clima |
| **Worker Consumer** | `agropulse-worker` | - | Ingesta en Supabase y procesa comandos |

---

## 🔍 Observabilidad y Logs en Tiempo Real (RF-24)

Para ver los logs en vivo del simulador y del worker:

```bash
# Ver todos los logs:
npm run infra:logs

# O con docker compose:
docker compose -f infra/docker-compose.yml logs -f simulator worker
```

### Salida esperada en la consola de compose:
```text
agropulse-simulator | [PRODUCER] 📡 soil.moisture | Estación Costa 1-Norte | Humedad: 36.1% | Temp: 24.3°C
agropulse-simulator | [PRODUCER] 🌧️ weather.tick  | Estación Costa 1-Norte | Lluvia: 0.0mm
agropulse-worker    | [CONSUMER] 📥 Consumed soil.moisture | Costa 1-Norte | Humedad: 36.1% | Temp: 24.3°C -> Inserted reading in Supabase (RNF-04 < 1s)
agropulse-worker    | [ACTUATOR] ⚙️ Detectada orden pendiente: ... | Válvula: Válvula Sector C2 | Acción: open
agropulse-worker    | [ACTUATOR] ✅ Orden ... APLICADA. Válvula ahora está 'open' (≤ 3s).
```

---

## 🖥️ Inspección Visual en Redpanda Console

Abre en tu navegador:
👉 [http://localhost:8080](http://localhost:8080)

Allí podrás ver:
1. **Topics creados automáticamente**: `soil.moisture`, `weather.tick`, `valve.status`.
2. **Mensajes en vivo**: Clica en cualquier topic para ver la carga útil JSON en tiempo real.
3. **Consumer Groups**: Monitorea el lag y estado del grupo `agropulse-supabase-worker-group`.

---

## 🛑 Detener la Infraestructura

```bash
npm run infra:down

# O con docker compose:
docker compose -f infra/docker-compose.yml down
```
