-- ==============================================================================
-- AGROPULSE - MIGRACIÓN INICIAL DEL ESQUEMA Y SEGURIDAD (RLS)
-- ==============================================================================

-- 1. EXTENSIONES
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";

-- 2. TABLAS BASE

-- 2.1 Organizaciones (Establecimientos)
create table if not exists public.organizations (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    region text,
    created_at timestamptz not null default now()
);

-- 2.2 Membresías y Roles
create table if not exists public.memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    organization_id uuid not null references public.organizations(id) on delete cascade,
    role text not null check (role in ('producer', 'operator', 'advisor')),
    created_at timestamptz not null default now(),
    unique(user_id, organization_id)
);

-- 2.3 Lotes (Plots)
create table if not exists public.plots (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references public.organizations(id) on delete cascade,
    name text not null,
    crop text,
    geom geometry(Polygon, 4326) not null,
    threshold_min numeric not null default 25 check (threshold_min >= 0 and threshold_min <= 100),
    threshold_max numeric not null default 45 check (threshold_max >= 0 and threshold_max <= 100),
    created_at timestamptz not null default now(),
    check (threshold_min < threshold_max)
);

create index if not exists idx_plots_geom on public.plots using gist(geom);
create index if not exists idx_plots_org on public.plots(organization_id);

-- 2.4 Estaciones de Monitoreo (Stations)
create table if not exists public.stations (
    id uuid primary key default gen_random_uuid(),
    plot_id uuid not null references public.plots(id) on delete cascade,
    name text not null,
    lat double precision not null,
    lng double precision not null,
    created_at timestamptz not null default now()
);

create index if not exists idx_stations_plot on public.stations(plot_id);

-- 2.5 Lecturas de Sensores (Readings)
create table if not exists public.readings (
    id uuid primary key default gen_random_uuid(),
    station_id uuid not null references public.stations(id) on delete cascade,
    measured_at timestamptz not null default now(),
    moisture_pct numeric not null check (moisture_pct >= 0 and moisture_pct <= 100),
    temp_c numeric,
    rain_mm numeric not null default 0,
    source text not null default 'sensor' check (source in ('sensor', 'manual')),
    created_at timestamptz not null default now()
);

create index if not exists idx_readings_station_measured 
on public.readings(station_id, measured_at desc);

-- 2.6 Válvulas de Riego (Valves)
create table if not exists public.valves (
    id uuid primary key default gen_random_uuid(),
    plot_id uuid not null references public.plots(id) on delete cascade,
    name text not null,
    status text not null default 'closed' check (status in ('open', 'closed')),
    updated_at timestamptz not null default now()
);

create index if not exists idx_valves_plot on public.valves(plot_id);

-- 2.7 Comandos de Riego (Irrigation Commands)
create table if not exists public.irrigation_commands (
    id uuid primary key default gen_random_uuid(),
    valve_id uuid not null references public.valves(id) on delete cascade,
    requested_by uuid not null references auth.users(id),
    action text not null check (action in ('open', 'close')),
    duration_min integer check (duration_min between 1 and 120),
    status text not null default 'pending' check (status in ('pending', 'applied', 'failed', 'cancelled')),
    client_request_id uuid not null unique, -- Idempotencia estricta
    failure_reason text,
    created_at timestamptz not null default now(),
    applied_at timestamptz
);

-- RF-16: Impedir un segundo comando 'pending' sobre la misma válvula a nivel de motor DB
create unique index if not exists idx_unique_pending_command_per_valve
on public.irrigation_commands(valve_id)
where status = 'pending';

-- 3. FUNCIONES DE SEGURIDAD (SECURITY DEFINER) PARA RLS

-- 3.1 Obtener organizaciones del usuario autenticado
create or replace function public.get_user_organization_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
    select organization_id from public.memberships where user_id = auth.uid();
$$;

-- 3.2 Verificar rol en una organización específica
create or replace function public.has_org_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select exists (
        select 1 from public.memberships
        where user_id = auth.uid()
          and organization_id = org_id
          and role = any(allowed_roles)
    );
$$;

-- 3.3 Obtener organization_id a partir de un plot_id
create or replace function public.get_plot_org_id(p_plot_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select organization_id from public.plots where id = p_plot_id;
$$;

-- 3.4 Obtener organization_id a partir de un valve_id
create or replace function public.get_valve_org_id(p_valve_id uuid)
returns uuid
language sql
security definer
set search_path = public
stable
as $$
    select p.organization_id 
    from public.valves v
    join public.plots p on p.id = v.plot_id
    where v.id = p_valve_id;
$$;

-- 4. HABILITACIÓN DE ROW LEVEL SECURITY (RLS)

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.plots enable row level security;
alter table public.stations enable row level security;
alter table public.readings enable row level security;
alter table public.valves enable row level security;
alter table public.irrigation_commands enable row level security;

-- 5. POLÍTICAS DE RLS (POLICIES)

-- 5.1 ORGANIZATIONS
create policy "Users can view their organizations"
on public.organizations for select
using (id in (select public.get_user_organization_ids()));

-- 5.2 MEMBERSHIPS
create policy "Users can view memberships of their organizations"
on public.memberships for select
using (organization_id in (select public.get_user_organization_ids()));

-- 5.3 PLOTS
create policy "Users can view plots in their organizations"
on public.plots for select
using (organization_id in (select public.get_user_organization_ids()));

create policy "Producers can update plot thresholds"
on public.plots for update
using (public.has_org_role(organization_id, array['producer']))
with check (public.has_org_role(organization_id, array['producer']));

-- 5.4 STATIONS
create policy "Users can view stations in their organizations"
on public.stations for select
using (
    plot_id in (
        select id from public.plots 
        where organization_id in (select public.get_user_organization_ids())
    )
);

-- 5.5 READINGS
create policy "Users can view readings in their organizations"
on public.readings for select
using (
    station_id in (
        select s.id from public.stations s
        join public.plots p on p.id = s.plot_id
        where p.organization_id in (select public.get_user_organization_ids())
    )
);

-- Ingesta de sensores reservada exclusivamente al service_role (Worker)
create policy "Workers with service role can insert sensor readings"
on public.readings for insert
with check (
    auth.role() = 'service_role' or (
        source = 'manual' and 
        public.has_org_role(
            public.get_plot_org_id((select plot_id from public.stations where id = station_id)),
            array['producer', 'operator']
        )
    )
);

-- 5.6 VALVES
create policy "Users can view valves in their organizations"
on public.valves for select
using (
    plot_id in (
        select id from public.plots 
        where organization_id in (select public.get_user_organization_ids())
    )
);

-- Solo el worker (service_role) puede modificar el estado real de la válvula
create policy "Worker service role can update valves"
on public.valves for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- 5.7 IRRIGATION COMMANDS
create policy "Users can view irrigation commands in their organizations"
on public.irrigation_commands for select
using (
    public.get_valve_org_id(valve_id) in (select public.get_user_organization_ids())
);

-- Productores y Operadores pueden emitir comandos (Asesores bloqueados)
create policy "Producers and operators can insert commands"
on public.irrigation_commands for insert
with check (
    auth.uid() = requested_by 
    and public.has_org_role(public.get_valve_org_id(valve_id), array['producer', 'operator'])
);

-- Solo el worker (service_role) transiciona comandos a applied / failed
create policy "Worker service role can update command status"
on public.irrigation_commands for update
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- 6. HABILITAR SUPABASE REALTIME
alter publication supabase_realtime add table public.readings;
alter publication supabase_realtime add table public.valves;
alter publication supabase_realtime add table public.irrigation_commands;

-- 7. VISTA DERIVADA DEL SEMÁFORO (RF-05, RF-09, RF-12)
create or replace view public.plots_with_status as
with latest_readings as (
    select distinct on (s.plot_id)
        s.plot_id,
        r.measured_at,
        r.moisture_pct,
        r.temp_c,
        r.rain_mm
    from public.stations s
    join public.readings r on r.station_id = s.id
    order by s.plot_id, r.measured_at desc
)
select 
    p.id,
    p.organization_id,
    p.name,
    p.crop,
    ST_AsGeoJSON(p.geom)::jsonb as geojson,
    p.threshold_min,
    p.threshold_max,
    p.created_at,
    lr.measured_at as last_measured_at,
    lr.moisture_pct as last_moisture_pct,
    lr.temp_c as last_temp_c,
    lr.rain_mm as last_rain_mm,
    case 
        when lr.measured_at is null or (now() - lr.measured_at) > interval '15 minutes' then 'stale'
        when lr.moisture_pct < p.threshold_min then 'dry'
        when lr.moisture_pct > p.threshold_max then 'wet'
        else 'optimal'
    end as status
from public.plots p
left join latest_readings lr on lr.plot_id = p.id;

-- 8. FUNCIÓN RPC PARA "ESTOY EN EL LOTE" (RF-06)
create or replace function public.check_user_in_plot(
    p_plot_id uuid,
    p_lat double precision,
    p_lng double precision
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
    select coalesce(
        ST_Contains(
            geom,
            ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
        ),
        false
    )
    from public.plots
    where id = p_plot_id;
$$;
