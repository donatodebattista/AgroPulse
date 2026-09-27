# 🌱 AgroPulse — Monitoreo Agronómico y Riego de Precisión

[![Expo SDK](https://img.shields.io/badge/Expo-SDK_57-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.86-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime_%26_RLS-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![Redpanda](https://img.shields.io/badge/Redpanda-Kafka_Streaming-FF0000?style=for-the-badge&logo=redpanda&logoColor=white)](https://redpanda.com)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com)

**AgroPulse** es una plataforma móvil multiplataforma (iOS, Android y Web) para el monitoreo en tiempo real de telemetría de suelo, clima y control inteligente de actuadores de riego agrícola. Integra una arquitectura de eventos de baja latencia con **Redpanda**, persistencia reactiva en **Supabase** y una interfaz móvil de alto rendimiento desarrollada con **React Native** y **Expo Router**.

---

## 🌾 Contexto de Dominio & Caso de Estudio

El proyecto está ambientado en el **Establecimiento Didáctico Concordia** (Entre Ríos, Argentina) para la evaluación académica **FCyT 2026**:
- **Lotes Productivos:** *Costa 1* (Arroz), *Costa 2* (Citrus dulce) y *Monte A* (Arándanos).
- **Estaciones IoT de Campo:** Monitorean humedad volumétrica de suelo (%), temperatura ambiental (°C) y precipitaciones acumuladas (mm).
- **Válvulas y Actuadores:** Electroválvulas de apertura/cierre temporizado con protección de concurrencia e idempotencia.

---

## 🏛️ Arquitectura del Sistema

El flujo de información opera bajo una arquitectura dirigida por eventos (*Event-Driven Architecture*) que garantiza la frontera de red y el cumplimiento de seguridad estricto (**RNF-02**):

```
+-------------------------------------------------------------------------+
|                        SIMULADOR IOT (Node.js)                          |
|  - Genera ticks de sensores periódicos para las estaciones de Concordia |
|  - Modela dinámicamente el aumento de humedad cuando el riego se abre   |
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
|                   WORKER CONSUMIDOR & ACTUADOR                          |
|  - Ingesta lecturas en 'readings' usando service_role_key               |
|  - Escucha órdenes de riego en 'irrigation_commands'                    |
|  - Aplica órdenes en los actuadores y conmuta válvulas (open/closed)   |
+-----------------------------------+-------------------------------------+
                                    |
                    (PostgreSQL / PostgREST / Realtime)
                                    v
+-----------------------------------+-------------------------------------+
|                       SUPABASE CLOUD / LOCAL                            |
|  - Tablas protegidas con Row Level Security (RLS) por organización      |
|  - Canal WebSocket Supabase Realtime (CDC Postgres Changes)             |
+-----------------------------------+-------------------------------------+
                                    |
                    (WebSocket Seguro / JWT anon_key)
                                    v
+-----------------------------------+-------------------------------------+
|                    APLICACIÓN MÓVIL REACT NATIVE                        |
|  - Conexión exclusiva a Supabase con anon_key (NUNCA expone Kafka)      |
|  - Renderizado reactivo en UI en tiempo real (RNF-04 ≤ 3s)              |
+-------------------------------------------------------------------------+
```

---

## ✨ Funcionalidades Principales

### 🗺️ 1. Mapa Interactivo y Semáforo Operativo (RF-05, RF-06, RF-07)
- Visualización de polígonos GeoJSON de los lotes sobre mapas satelitales/vectoriales.
- **Semáforo Agronómico Dinámico:** 
  - 🔴 **Seco (`dry`):** Humedad por debajo del umbral mínimo del lote.
  - 🟢 **Óptimo (`optimal`):** Humedad en rango agronómico adecuado.
  - 🔵 **Húmedo (`wet`):** Humedad por encima del umbral máximo.
  - ⚪ **Desactualizado (`stale`):** Sin mediciones frescas en los últimos 15 minutos (**RF-09**).
- Simulación de ubicación del usuario en campo y detección automática del lote actual.

### 📈 2. Gráfico de Tendencia Histórica (RF-10, RF-11)
- Gráfico interactivo SVG de la serie temporal de las últimas 6 horas.
- Líneas de umbral dinámicas (Mínimo / Máximo) configurables en tiempo real por el Productor.
- Selector de puntos interactivo para inspección de lectura puntual (humedad y hora).
- Blindaje contra valores atípicos y conversiones numéricas automáticas.

### 🚰 3. Control de Riego e Idempotencia (RF-13, RF-14, RF-15, RF-16, RNF-05)
- Listado de válvulas asociadas a cada lote con su estado actual (`open` / `closed`).
- Formulario de comando con duración personalizable (1–120 minutos).
- Generación de `client_request_id` (UUID v4) para garantizar idempotencia en órdenes de riego.
- Manejo reactivo de estado `pending` en UI con feedback claro y sin bloqueo ni *spinners infinitos*.
- Bloqueo preventivo de órdenes concurrentes cuando una válvula ya tiene una orden en proceso.

### 🔐 4. Control de Acceso por Roles (RBAC) & Multitenant (RF-01, RF-02, RF-23)
- Seguridad a nivel de filas (**RLS**) estricta en PostgreSQL según la membresía de organización del usuario.
- Tres roles con permisos diferenciados:
  - **🌱 Productor:** Acceso total, edición de umbrales agronómicos y comando de riego.
  - **🚜 Operador de Riego:** Visualización de telemetría y ejecución de comandos de válvulas.
  - **📋 Asesor Agrónomo:** Modo de solo lectura para auditoría y consulta técnica.

### ⚡ 5. Diagnóstico de Conectividad & Métricas en Vivo
- Identidad de sesión activa, rol y organización activa.
- Test de latencia HTTP PostgREST (*Round-Trip Ping*) en tiempo real.
- Monitor de ticks recibidos vía Supabase Realtime y cálculo de lag aparente de entrega.

---

## 👥 Usuarios de Prueba (Semilla Concordia)

El sistema incluye usuarios preconfigurados con contraseñas seguras y acceso rápido desde la pantalla de login:

| Rol | Correo Electrónico | Contraseña | Permisos |
|---|---|---|---|
| **Productor** | `producer@agropulse.test` | `AgroPulse2026!` | Acceso total, editar umbrales, riego |
| **Operador** | `operator@agropulse.test` | `AgroPulse2026!` | Ver telemetría, operar válvulas |
| **Asesor** | `advisor@agropulse.test` | `AgroPulse2026!` | Solo lectura agronómica |

---

## 🛠️ Stack Tecnológico

### Aplicación Móvil (Frontend)
- **Framework:** [React Native](https://reactnative.dev) (v0.86) con [Expo](https://expo.dev) (SDK 57)
- **Navegación:** [Expo Router](https://docs.expo.dev/router/introduction/) (File-based routing)
- **Lenguaje:** TypeScript en modo estricto
- **Mapas:** `react-native-maps` con soporte web/nativo unificado
- **Gráficos:** `react-native-svg`
- **Cliente Supabase:** `@supabase/supabase-js` v2 con transporte de almacenamiento seguro

### Infraestructura Backend & Streaming
- **Broker de Eventos:** [Redpanda](https://redpanda.com) (API compatible con Apache Kafka)
- **Consola de Observabilidad:** Redpanda Console Web UI
- **Microservicios:** Node.js 22 + TypeScript con `kafkajs`
- **Base de Datos:** PostgreSQL 15 en Supabase con extensiones PostGIS y Realtime CDC

---

## 🚀 Guía de Instalación y Ejecución

### Prerrequisitos
- [Node.js](https://nodejs.org/) v20 o superior
- [npm](https://www.npmjs.com/)
- [Docker](https://www.docker.com/) y [Docker Compose](https://docs.docker.com/compose/)
- Dispositivo móvil con **Expo Go** instalado o emulador Android Studio / simulador iOS

### 1. Clonar el repositorio e instalar dependencias

```bash
cd agroPulse
npm install
```

### 2. Configurar variables de entorno

Copia las plantillas de entorno y completa las credenciales de tu proyecto Supabase:

```bash
# Variables públicas para la app móvil
cp .env.example .env

# Variables para los contenedores backend
cp infra/.env.example infra/.env
```

Contenido de `.env`:
```env
EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=tu-anon-key-publica
```

Contenido de `infra/.env`:
```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-secreta
```

### 3. Iniciar la infraestructura de streaming (Docker)

Levanta el broker Redpanda, la consola web, el simulador de telemetría y el worker de ingesta:

```bash
npm run infra:up
```

- **Consola Web de Redpanda:** Disponible en [http://localhost:8080](http://localhost:8080)
- **Ver logs de telemetría y actuadores:**
  ```bash
  npm run infra:logs
  ```

### 4. Iniciar la aplicación móvil

Inicia el servidor de desarrollo de Expo:

```bash
npm start
```

- Escanea el código QR desde la app **Expo Go** en tu dispositivo físico.
- Presiona `a` para abrir en el emulador de Android o `i` para el simulador de iOS.
- Presiona `w` para abrir en el navegador web.

---

## 📜 Scripts del Proyecto

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el bundler de Expo en modo interactivo |
| `npm run android` | Ejecuta la aplicación en emulador Android |
| `npm run ios` | Ejecuta la aplicación en simulador iOS |
| `npm run web` | Ejecuta la aplicación en el navegador web |
| `npm run infra:up` | Construye e inicia los contenedores de Redpanda, Worker y Simulador |
| `npm run infra:down` | Detiene y remueve los contenedores de infraestructura |
| `npm run infra:logs` | Sigue los logs en tiempo real del simulador IoT y worker |
| `npx tsc --noEmit` | Ejecuta la verificación estricta de tipos de TypeScript |

---

## 📂 Estructura del Repositorio

```text
agroPulse/
├── src/
│   ├── app/                     # Rutas y pantallas (Expo Router)
│   │   ├── (auth)/              # Flujo de autenticación (login)
│   │   ├── (app)/               # Vistas protegidas principales
│   │   │   ├── index.tsx        # Mapa interactivo principal
│   │   │   ├── plots.tsx        # Listado de lotes y estado
│   │   │   ├── plot/[id].tsx    # Detalle de lote, telemetría y válvulas
│   │   │   ├── account.tsx      # Perfil de usuario y cambio de organización
│   │   │   └── diagnostics.tsx  # Métricas de latencia y Realtime
│   │   └── _layout.tsx          # Layout raíz con AuthProvider
│   ├── components/              # Componentes de UI reutilizables
│   │   ├── common/              # Cabecera, modales y botones
│   │   ├── map/                 # Mapa nativo/web, marcadores y polígonos
│   │   ├── telemetry/           # Gráficos SVG y editor de umbrales
│   │   └── valves/              # Listado de válvulas y modal de comando
│   ├── context/                 # Contextos de React (AuthContext)
│   ├── hooks/                   # Hooks personalizados (telemetría, lotes, válvulas, GPS)
│   ├── lib/                     # Inicialización de Supabase y almacenamiento
│   ├── types/                   # Definición de tipos TypeScript y esquema DB
│   └── utils/                   # Cálculo de semáforo, mitigación de clock-skew, formato
├── infra/                       # Infraestructura de streaming y microservicios
│   ├── docker-compose.yml       # Orquestación de Redpanda, Simulador y Worker
│   ├── simulator/               # Simulador de sensores IoT (Productor Kafka)
│   └── worker/                  # Consumidor de eventos y actuador de válvulas
└── supabase/
    ├── migrations/              # Esquema DDL de PostgreSQL con RLS
    └── seed.sql                 # Datos semilla del establecimiento Concordia
```

---

## ⚖️ Aviso de Transparencia y Ética (RNF-10)

Los datos de telemetría de suelo, clima y coordenadas geográficas del *Establecimiento Didáctico Concordia* son simulados exclusivamente con propósitos académicos y de evaluación para la cátedra de **Desarrollo Móvil (FCyT 2026)**. No representan instalaciones ni condiciones meteorológicas reales.
