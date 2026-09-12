-- ════════════════════════════════════════════════════════
-- MIGRACIÓN: trigger sincronización antropometría (labs — sub-fase 1A)
-- Sincroniza pacientes.peso_kg / talla_cm / imc cuando se
-- mutan mediciones_analitos de analitos con clave 'peso' o 'talla'.
-- Ejecutar en Supabase SQL Editor DESPUÉS de mediciones_analitos.
-- ════════════════════════════════════════════════════════

-- ─── 1. Función sync_antropometria_paciente ──────────────
-- SECURITY DEFINER: necesita escribir en pacientes desde un contexto
-- que dispara por INSERT/UPDATE/DELETE de mediciones_analitos.
--
-- Estrategia: tras cualquier mutación, siempre RE-LEE el estado actual
-- de mediciones_analitos del paciente (ORDER BY medido_en DESC LIMIT 1)
-- para peso y talla por separado. Ignoramos NEW.valor / OLD.valor /
-- NEW.medido_en / OLD.medido_en — pueden no reflejar el efectivo
-- tras la operación (ej. UPDATE que cambia un valor intermedio no
-- cambia cuál es "el más reciente"). La re-lectura cubre INSERT, UPDATE
-- de valor, UPDATE de fecha, y DELETE sin lógica especial.
--
-- Caso UPDATE de paciente_id: recalculamos para AMBOS pacientes
-- (OLD.paciente_id y NEW.paciente_id) si son distintos.
--
-- No se nulea peso_kg / talla_cm al quedar sin mediciones: se mantiene
-- el último valor conocido (decisión documentada en LABS_REDISEÑO_PLAN
-- sub-fase 4, sección Riesgos).
--
-- Fallback para IMC (Opción B — decisión α): si la mutación solo aporta
-- uno de los dos (ej. peso nuevo sin medición de talla), el IMC se
-- calcula usando el valor faltante desde pacientes.peso_kg / talla_cm
-- (último valor conocido). Así un INSERT de peso en un paciente con
-- talla pre-existente actualiza el IMC correctamente.
-- IMPORTANTE: peso_kg y talla_cm en pacientes siguen sincronizándose
-- SOLO con valores provenientes de mediciones_analitos; nunca con su
-- propio valor actual (sería no-op). El fallback aplica únicamente al
-- cálculo del IMC.
create or replace function public.sync_antropometria_paciente(p_paciente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_peso_medicion  numeric;
  v_talla_medicion numeric;
  v_peso_paciente  numeric;
  v_talla_paciente numeric;
  v_peso_final     numeric;
  v_talla_final    numeric;
  v_imc            numeric;
begin
  if p_paciente_id is null then
    return;
  end if;

  -- Última medición de peso (kg) desde mediciones_analitos
  select m.valor into v_peso_medicion
  from mediciones_analitos m
  join analitos_catalogo a on a.id = m.analito_id
  where m.paciente_id = p_paciente_id
    and a.clave = 'peso'
  order by m.medido_en desc
  limit 1;

  -- Última medición de talla (cm) desde mediciones_analitos
  select m.valor into v_talla_medicion
  from mediciones_analitos m
  join analitos_catalogo a on a.id = m.analito_id
  where m.paciente_id = p_paciente_id
    and a.clave = 'talla'
  order by m.medido_en desc
  limit 1;

  -- Estado actual en pacientes (último valor conocido) para fallback del IMC
  select peso_kg, talla_cm into v_peso_paciente, v_talla_paciente
  from pacientes
  where id = p_paciente_id;

  -- Valores efectivos para el cálculo del IMC: medición si existe, si no el
  -- último conocido en pacientes. No se usa _final para escribir peso_kg /
  -- talla_cm, solo para el IMC.
  v_peso_final  := coalesce(v_peso_medicion,  v_peso_paciente);
  v_talla_final := coalesce(v_talla_medicion, v_talla_paciente);

  -- IMC solo si ambos > 0 (evita división por cero y valores absurdos)
  if v_peso_final is not null and v_talla_final is not null
     and v_peso_final > 0 and v_talla_final > 0 then
    v_imc := round(v_peso_final / ((v_talla_final / 100.0) * (v_talla_final / 100.0)), 1);
  end if;

  -- UPDATE parcial: peso_kg / talla_cm solo se sobreescriben con valores
  -- provenientes de mediciones_analitos. IMC se recalcula usando el fallback.
  -- Si no hay historial (v_*_medicion NULL), las columnas de peso/talla
  -- mantienen su valor actual.
  update pacientes
  set peso_kg    = coalesce(v_peso_medicion,  peso_kg),
      talla_cm   = coalesce(v_talla_medicion, talla_cm),
      imc        = coalesce(v_imc,            imc),
      updated_at = now()
  where id = p_paciente_id;
end;
$$;

-- ─── 2. Función trigger trg_mediciones_antropometria ─────
create or replace function public.trg_mediciones_antropometria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_analito_id_efectivo uuid;
  v_clave               text;
begin
  -- Guard: custom analitos (analito_id NULL) nunca son antropometría.
  v_analito_id_efectivo := coalesce(new.analito_id, old.analito_id);
  if v_analito_id_efectivo is null then
    return coalesce(new, old);
  end if;

  -- Solo nos interesa si el analito involucrado es peso o talla.
  select clave into v_clave
  from analitos_catalogo
  where id = v_analito_id_efectivo;

  if v_clave not in ('peso', 'talla') then
    return coalesce(new, old);
  end if;

  -- Recalcula para el paciente afectado (NEW en INSERT/UPDATE, OLD en DELETE).
  if tg_op = 'DELETE' then
    perform public.sync_antropometria_paciente(old.paciente_id);
  else
    perform public.sync_antropometria_paciente(new.paciente_id);
    -- Si UPDATE cambió paciente_id, recalcula también para el paciente anterior.
    if tg_op = 'UPDATE'
       and old.paciente_id is distinct from new.paciente_id then
      perform public.sync_antropometria_paciente(old.paciente_id);
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

-- ─── 3. Trigger AFTER en mediciones_analitos ─────────────
-- AFTER (no BEFORE) para que el SELECT ... LIMIT 1 dentro de
-- sync_antropometria_paciente ya vea el estado post-mutación.
create trigger mediciones_sync_antropometria
  after insert or update or delete on mediciones_analitos
  for each row execute function public.trg_mediciones_antropometria();

-- ─── 4. Restringir ejecución directa (defensa-en-profundidad) ────
-- sync_antropometria_paciente recibe paciente_id como argumento.
-- Sin REVOKE, cualquier rol podría llamarla directamente:
--   - authenticated: vía SQL editor
--   - anon:          vía POST /rest/v1/rpc/sync_antropometria_paciente (Supabase REST)
--   - PUBLIC:        grant implícito a todos los roles en Postgres
-- Al tener SECURITY DEFINER, la función ignora RLS de pacientes durante el UPDATE
-- y permitiría vandalismo cross-clínica (forzar updated_at / recalcular peso/talla/imc
-- en pacientes de otra clínica).
--
-- El trigger sigue funcionando porque los triggers se invocan con
-- privilegios del owner, no del caller. Solo bloqueamos llamadas directas.
revoke execute on function public.sync_antropometria_paciente(uuid) from public, authenticated, anon;
revoke execute on function public.trg_mediciones_antropometria() from public, authenticated, anon;
