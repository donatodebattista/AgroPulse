-- 20260925000000_actuator_simulation.sql
-- AgroPulse: Simulación Automática del Actuador IoT (RF-13, RF-14, RF-15, RF-16, RNF-04)

-- ============================================================================
-- 1. DESBLOQUEO INMEDIATO DE COMANDOS PENDIENTES TRABADOS
-- ============================================================================
-- Mapea la acción del comando ('open' -> 'open', 'close' -> 'closed') para respetar
-- la restricción de validación: check (status in ('open', 'closed')) en valves.
update public.valves v
set status = case when c.action = 'open' then 'open' else 'closed' end,
    updated_at = now()
from public.irrigation_commands c
where c.valve_id = v.id and c.status = 'pending';

update public.irrigation_commands
set status = 'applied',
    applied_at = now()
where status = 'pending';

-- ============================================================================
-- 2. TRIGGER AUTOMÁTICO PARA SIMULAR EL ACTUADOR EN CADA INSERCIÓN (RF-15)
-- ============================================================================
-- Cada vez que la app móvil inserta un comando en 'pending', este trigger con
-- privilegios elevados (SECURITY DEFINER) simula la respuesta del actuador IoT:
-- actualiza la válvula y pasa el comando a 'applied' disparando los eventos Realtime.
create or replace function public.trg_auto_apply_irrigation_command()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
    -- 2.1 Actualizar el estado real de la válvula ('open' -> 'open', 'close' -> 'closed')
    update public.valves
    set status = case when NEW.action = 'open' then 'open' else 'closed' end,
        updated_at = now()
    where id = NEW.valve_id;

    -- 2.2 Transicionar el comando a 'applied'
    update public.irrigation_commands
    set status = 'applied',
        applied_at = now()
    where id = NEW.id;

    return null;
end;
$$;

drop trigger if exists trg_irrigation_command_auto_apply on public.irrigation_commands;
create trigger trg_irrigation_command_auto_apply
after insert on public.irrigation_commands
for each row
when (NEW.status = 'pending')
execute function public.trg_auto_apply_irrigation_command();

-- ============================================================================
-- 3. FUNCIÓN RPC PARA SIMULACIÓN MANUAL O FORZADA (RESPALDO / DEMO)
-- ============================================================================
create or replace function public.simulate_actuator_execution(p_command_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_cmd record;
begin
    select * into v_cmd 
    from public.irrigation_commands 
    where id = p_command_id;

    if not found then
        return jsonb_build_object('success', false, 'error', 'Comando no encontrado');
    end if;

    if v_cmd.status != 'pending' then
        return jsonb_build_object('success', false, 'status', v_cmd.status, 'message', 'El comando ya no se encuentra en estado pending');
    end if;

    -- Actualizar estado de la válvula asociada ('open' -> 'open', 'close' -> 'closed')
    update public.valves
    set status = case when v_cmd.action = 'open' then 'open' else 'closed' end,
        updated_at = now()
    where id = v_cmd.valve_id;

    -- Transicionar estado del comando a 'applied'
    update public.irrigation_commands
    set status = 'applied',
        applied_at = now()
    where id = p_command_id;

    return jsonb_build_object(
        'success', true, 
        'command_id', p_command_id,
        'action', v_cmd.action,
        'status', 'applied'
    );
end;
$$;

-- Otorgar permisos de ejecución al rol autenticado
grant execute on function public.simulate_actuator_execution(uuid) to authenticated;
