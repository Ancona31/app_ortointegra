-- E0 · qué hace la RLS de reserva_enlaces SIN el disparador que rechaza el alta de la sesión (para
-- medir lo que aportaba la policy retirada reserva_enlaces_insert). Una transacción con ROLLBACK:
-- el disparador se desactiva sólo dentro de ella. Usa la semilla mínima (semilla-minima.sql).
begin;
alter table public.reserva_enlaces disable trigger trg_reserva_enlaces_proteger;
do $$
declare v_st text; v_msg text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-00000005eb01', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into public.reserva_enlaces (id, clinica_id, medico_id, clase, codigo_hash)
    values (gen_random_uuid(), '00000000-0000-4000-8000-00000005ec01', '00000000-0000-4000-8000-00000005eb01', 'unico', repeat('b', 64));
    raise notice 'RESULTADO admin de su clínica, sin disparador: INSERT ACEPTADO';
  exception when others then
    get stacked diagnostics v_st = returned_sqlstate, v_msg = message_text;
    raise notice 'RESULTADO admin de su clínica, sin disparador: % %', v_st, v_msg;
  end;
  reset role;
end $$;
rollback;
