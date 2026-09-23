-- ==============================================================================
-- AGROPULSE - SCRIPT DE DATOS SEMILLA (SEED)
-- Establecimiento: Estancia Didáctica Concordia (Entre Ríos)
-- Contraseña unificada para los 3 usuarios de prueba: AgroPulse2026!
-- ==============================================================================

do $$
declare
    -- IDs Fijos para reproducibilidad
    v_org_id uuid := 'a0000000-0000-0000-0000-000000000001';
    
    v_producer_id uuid := 'b0000000-0000-0000-0000-000000000001';
    v_operator_id uuid := 'b0000000-0000-0000-0000-000000000002';
    v_advisor_id  uuid := 'b0000000-0000-0000-0000-000000000003';

    v_plot_costa1_id uuid := 'c0000000-0000-0000-0000-000000000001';
    v_plot_costa2_id uuid := 'c0000000-0000-0000-0000-000000000002';
    v_plot_montea_id uuid := 'c0000000-0000-0000-0000-000000000003';

    v_station_costa1_id uuid := 'd0000000-0000-0000-0000-000000000001';
    v_station_costa2_id uuid := 'd0000000-0000-0000-0000-000000000002';
    v_station_montea_id uuid := 'd0000000-0000-0000-0000-000000000003';

    v_valve_costa1_id uuid := 'e0000000-0000-0000-0000-000000000001';
    v_valve_costa2_id uuid := 'e0000000-0000-0000-0000-000000000002';
    v_valve_montea_id uuid := 'e0000000-0000-0000-0000-000000000003';

    v_pwd_hash text;
begin
    -- 1. GENERAR HASH BCRYPT PARA LA CONTRASEÑA 'AgroPulse2026!'
    v_pwd_hash := crypt('AgroPulse2026!', gen_salt('bf'));

    -- 2. CREACIÓN DE USUARIOS DE PRUEBA EN auth.users
    -- 2.1 Productor
    if not exists (select 1 from auth.users where id = v_producer_id or email = 'producer@agropulse.test') then
        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
            '00000000-0000-0000-0000-000000000000',
            v_producer_id,
            'authenticated',
            'authenticated',
            'producer@agropulse.test',
            v_pwd_hash,
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"name":"Juan Productor"}'::jsonb,
            now(),
            now()
        );

        insert into auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) values (
            v_producer_id,
            v_producer_id,
            json_build_object('sub', v_producer_id::text, 'email', 'producer@agropulse.test'),
            'email',
            'producer@agropulse.test',
            now(),
            now(),
            now()
        );
    end if;

    -- 2.2 Operador de Riego
    if not exists (select 1 from auth.users where id = v_operator_id or email = 'operator@agropulse.test') then
        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
            '00000000-0000-0000-0000-000000000000',
            v_operator_id,
            'authenticated',
            'authenticated',
            'operator@agropulse.test',
            v_pwd_hash,
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"name":"Carlos Operador"}'::jsonb,
            now(),
            now()
        );

        insert into auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) values (
            v_operator_id,
            v_operator_id,
            json_build_object('sub', v_operator_id::text, 'email', 'operator@agropulse.test'),
            'email',
            'operator@agropulse.test',
            now(),
            now(),
            now()
        );
    end if;

    -- 2.3 Asesor Agrónomo
    if not exists (select 1 from auth.users where id = v_advisor_id or email = 'advisor@agropulse.test') then
        insert into auth.users (
            instance_id, id, aud, role, email, encrypted_password, 
            email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) values (
            '00000000-0000-0000-0000-000000000000',
            v_advisor_id,
            'authenticated',
            'authenticated',
            'advisor@agropulse.test',
            v_pwd_hash,
            now(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"name":"Ing. Laura Asesora"}'::jsonb,
            now(),
            now()
        );

        insert into auth.identities (
            id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
        ) values (
            v_advisor_id,
            v_advisor_id,
            json_build_object('sub', v_advisor_id::text, 'email', 'advisor@agropulse.test'),
            'email',
            'advisor@agropulse.test',
            now(),
            now(),
            now()
        );
    end if;

    -- 3. ORGANIZACIÓN: Estancia Didáctica Concordia
    insert into public.organizations (id, name, region)
    values (v_org_id, 'Estancia Didáctica Concordia', 'Concordia, Entre Ríos')
    on conflict (id) do update 
    set name = excluded.name, region = excluded.region;

    -- 4. MEMBRESÍAS
    insert into public.memberships (user_id, organization_id, role)
    values 
        (v_producer_id, v_org_id, 'producer'),
        (v_operator_id, v_org_id, 'operator'),
        (v_advisor_id,  v_org_id, 'advisor')
    on conflict (user_id, organization_id) do update 
    set role = excluded.role;

    -- 5. LOTES (Con polígonos reales en zona Concordia: aprox Lat -31.39, Lng -58.02)
    -- Costa 1: Citrus, Humedad Óptima (Verde)
    insert into public.plots (id, organization_id, name, crop, geom, threshold_min, threshold_max)
    values (
        v_plot_costa1_id,
        v_org_id,
        'Costa 1',
        'Citrus',
        ST_SetSRID(ST_GeomFromText('POLYGON((-58.025 -31.390, -58.020 -31.390, -58.020 -31.395, -58.025 -31.395, -58.025 -31.390))'), 4326),
        25,
        45
    ) on conflict (id) do update set geom = excluded.geom, crop = excluded.crop;

    -- Costa 2: Citrus, Seco (Rojo) para demostrar riego en demo
    insert into public.plots (id, organization_id, name, crop, geom, threshold_min, threshold_max)
    values (
        v_plot_costa2_id,
        v_org_id,
        'Costa 2',
        'Citrus',
        ST_SetSRID(ST_GeomFromText('POLYGON((-58.020 -31.390, -58.015 -31.390, -58.015 -31.395, -58.020 -31.395, -58.020 -31.390))'), 4326),
        25,
        45
    ) on conflict (id) do update set geom = excluded.geom, crop = excluded.crop;

    -- Monte A: Soja, Stale (Gris) para demostrar estación sin reportar > 15 min
    insert into public.plots (id, organization_id, name, crop, geom, threshold_min, threshold_max)
    values (
        v_plot_montea_id,
        v_org_id,
        'Monte A',
        'Soja',
        ST_SetSRID(ST_GeomFromText('POLYGON((-58.025 -31.396, -58.015 -31.396, -58.015 -31.402, -58.025 -31.402, -58.025 -31.396))'), 4326),
        25,
        45
    ) on conflict (id) do update set geom = excluded.geom, crop = excluded.crop;

    -- 6. ESTACIONES METEOROLÓGICAS (1 por lote)
    insert into public.stations (id, plot_id, name, lat, lng)
    values 
        (v_station_costa1_id, v_plot_costa1_id, 'Estación Costa 1-Norte', -31.3925, -58.0225),
        (v_station_costa2_id, v_plot_costa2_id, 'Estación Costa 2-Sur',   -31.3925, -58.0175),
        (v_station_montea_id, v_plot_montea_id, 'Estación Monte A-Centro', -31.3990, -58.0200)
    on conflict (id) do update set lat = excluded.lat, lng = excluded.lng;

    -- 7. VÁLVULAS DE RIEGO (1 por lote)
    insert into public.valves (id, plot_id, name, status)
    values 
        (v_valve_costa1_id, v_plot_costa1_id, 'Válvula Principal C1', 'closed'),
        (v_valve_costa2_id, v_plot_costa2_id, 'Válvula Sector C2',    'closed'),
        (v_valve_montea_id, v_plot_montea_id, 'Válvula Pivote MA',    'closed')
    on conflict (id) do update set status = excluded.status;

    -- 8. LECTURAS HISTÓRICAS Y RECIENTES (Últimas 6 horas)
    -- Limpiamos lecturas previas de las estaciones semilla para consistencia
    delete from public.readings where station_id in (v_station_costa1_id, v_station_costa2_id, v_station_montea_id);

    -- 8.1 Costa 1: Humedad Óptima (alrededor de 35% - 37%, última lectura hace 2 min)
    insert into public.readings (station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
    values 
        (v_station_costa1_id, now() - interval '300 minutes', 34.2, 21.0, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '240 minutes', 34.8, 21.5, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '180 minutes', 35.1, 22.2, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '120 minutes', 35.6, 23.0, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '90 minutes',  36.0, 23.5, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '60 minutes',  36.2, 24.1, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '45 minutes',  35.9, 24.5, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '30 minutes',  36.4, 24.8, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '20 minutes',  36.1, 25.0, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '10 minutes',  36.3, 25.2, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '5 minutes',   36.5, 25.1, 0.0, 'sensor'),
        (v_station_costa1_id, now() - interval '2 minutes',   36.8, 25.0, 0.0, 'sensor');

    -- 8.2 Costa 2: Suelo Seco (humedad decreciente hasta 18.2%, umbral mínimo es 25%, última lectura hace 3 min)
    insert into public.readings (station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
    values 
        (v_station_costa2_id, now() - interval '300 minutes', 26.5, 22.0, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '240 minutes', 25.4, 22.8, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '180 minutes', 24.1, 23.5, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '120 minutes', 22.8, 24.2, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '90 minutes',  21.9, 25.0, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '60 minutes',  20.7, 25.8, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '45 minutes',  20.1, 26.3, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '30 minutes',  19.5, 26.9, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '20 minutes',  19.0, 27.2, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '10 minutes',  18.7, 27.5, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '6 minutes',   18.4, 27.8, 0.0, 'sensor'),
        (v_station_costa2_id, now() - interval '3 minutes',   18.2, 28.0, 0.0, 'sensor');

    -- 8.3 Monte A: Stale (última lectura hace 45 minutos > 15 min de antigüedad)
    insert into public.readings (station_id, measured_at, moisture_pct, temp_c, rain_mm, source)
    values 
        (v_station_montea_id, now() - interval '360 minutes', 38.0, 20.5, 0.0, 'sensor'),
        (v_station_montea_id, now() - interval '300 minutes', 37.8, 21.2, 0.0, 'sensor'),
        (v_station_montea_id, now() - interval '240 minutes', 37.5, 21.8, 0.0, 'sensor'),
        (v_station_montea_id, now() - interval '180 minutes', 37.2, 22.4, 0.0, 'sensor'),
        (v_station_montea_id, now() - interval '120 minutes', 36.8, 23.0, 0.0, 'sensor'),
        (v_station_montea_id, now() - interval '90 minutes',  36.5, 23.6, 0.0, 'sensor'),
        (v_station_montea_id, now() - interval '45 minutes',  36.1, 24.0, 0.0, 'sensor');

end $$;
