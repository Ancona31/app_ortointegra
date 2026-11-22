"""Escribe DIFERENCIAS.tsv (formato --esperadas del comparador, una fila por diferencia, sin globs)
a partir de la TSV que da el comparador A↔B y de cuerpos.txt (qué funciones son «sólo comentarios»)."""
import csv, sys, re
csv.field_size_limit(10**9)
difs, cuerpos, salida = sys.argv[1], sys.argv[2], sys.argv[3]

ident = set()
for m in re.finditer(r'######## (.+)\n# código sin comentarios ni espacios: (IDÉNTICO|CAMBIA)', open(cuerpos).read()):
    if m.group(2) == 'IDÉNTICO':
        ident.add(m.group(1).split('(')[0])

PASOS = {  # función → paso de comportamiento.sql que EJECUTA la rama sustituida, rol
    'cita_confirmacion_contexto': '65 (service_role) y 85 (anon: 42501 por EXECUTE de la propia función, igual en A)',
    'cita_confirmacion_emitir': '64 y 67 (service_role; v2 encendida y apagada)',
    'cita_confirmacion_responder': '66 (service_role)',
    'cita_movimiento_google_registrar': '79 y 80 (service_role; encendida → true, apagada → false)',
    'cita_proteger_bloqueo': '19-22 (authenticated médico y secretaria, service_role: mismo 42501 + HINT agenda_horario_bloqueado) y 23 (apagada: pasa)',
    'cita_proteger_borrado': '24-26 (authenticated y service_role: mismo 42501; apagada: borra)',
    'cita_proteger_eleccion': '58-60 (authenticated: mismo 42501 y HINT; notas pasan)',
    'cita_reagendar_clinica': '61-63 (service_role; apagada → «apagado»)',
    'cita_rsvp_google': '81 (service_role)',
    'gcal_aplicar_evento': 'no ejecutada con datos (exige conexión de Google); deducido del diff',
    'gcal_bloqueo_aplicar': '82 y 83 (service_role)',
    'gcal_citas_por_evento': '71, 72 (service_role) y 84 (authenticated: 42501, igual en A)',
    'gcal_importar_evento': '75 y 76 (service_role)',
    'gcal_sync_tomar': '73 y 74 (service_role)',
    'reserva_codigo_emitir': '50 (service_role)',
    'reserva_empalmes_registrar': '78 (service_role)',
    'reserva_ocupacion': '45, 46 y 56 (service_role; apagada → [])',
}
EQUIV = ('equivalente en ese sitio: agenda_ajustes.clinica_id es UNIQUE (agenda_ajustes_clinica_key) y agenda_v2_encendida '
         'NOT NULL, así que «sin fila o false = false» igual que el EXISTS/JOIN; el fragmento no tenía FOR UPDATE; misma clínica; '
         'la función sigue INVOKER, search_path vacío, mismo dueño y volatilidad (sólo cambia md5_cuerpo), y agenda_v2_encendida '
         'es INVOKER (lee con los mismos permisos/RLS que el EXISTS). EXECUTE: authenticated, service_role y postgres la tienen; '
         'anon no, pero anon no llega a esa línea (sin EXECUTE de la función, o el disparador lee antes agenda_bloqueos sin permiso)')

def razon(e, t, k):
    nombre = re.sub(r'^(function |funcion )', '', k).split('(')[0].replace('public.', '')
    if t == 'funcion':
        if e == 'solo_b':
            return 'ACEPTABLE · pieza común nueva (ENCARGO §5): sql STABLE INVOKER, search_path vacío, coalesce(SELECT …, false); comprobado en catálogo'
        if e == 'solo_a':
            return {
                'reserva_enlace_regenerar_fijo': 'ACEPTABLE · retirada: 0 llamadores en src/ scripts/ e2e/ ni en cuerpos de función (grep); en A su INSERT con sesión ya daba 42501 por el disparador; las pruebas d1/seg_emision se adaptaron a undefined_function',
                'reserva_enlace_emitir': 'ACEPTABLE · retirada la de 7 argumentos: sólo la alcanzaba la caída PGRST202 de src/app/api/agenda/enlaces/route.ts:128-131, inalcanzable con la de 9 presente; e2e/seguridad-postgrest.e2e.ts:126 admite 42501 o PGRST202',
                'cita_correos_pendientes': 'ACEPTABLE · retirada: sólo la nombra un comentario (src/lib/confirmacion/recordatorios.ts:19 y el cuerpo de cita_correo_tomar); la sustituye cita_recordatorios_pendientes; e4_correos_cita.sql adaptada',
            }[nombre]
        if nombre in ident:
            return 'ACEPTABLE · md5_cuerpo: el código sin comentarios ni espacios es IDÉNTICO (cuerpos.py); sólo cambian comentarios -- dentro del cuerpo'
        if nombre == 'gcal_sync_clinica_habilitada':
            return 'ACEPTABLE · única diferencia de código: el texto del HINT del P0001 nombra el archivo fundido en vez de C1 (20261113120000); mismo SQLSTATE y lógica; nadie lee ese HINT en src/ scripts/ e2e/'
        return f'ACEPTABLE · única diferencia de código: la lectura en línea de agenda_ajustes → public.agenda_v2_encendida(…) (diff en cuerpos.txt); {EQUIV}. Ejecutado igual en A y B: paso {PASOS[nombre]}'
    if t == 'permiso':
        if 'agenda_v2_encendida' in k:
            return 'ACEPTABLE · EXECUTE de la pieza común nueva (dueño postgres, authenticated, service_role; sin PUBLIC ni anon); otorgante postgres (aclexplode)'
        return 'ACEPTABLE · permiso de una función retirada; se va con ella (aclexplode con otorgante: no hay otra diferencia de permisos)'
    if t == 'policy':
        if e == 'solo_a':
            return ('ACEPTABLE · policy retirada. Ejecutado (comportamiento.sql 32-37): anon, authenticated de la clínica (médico y secretaria), '
                    'de otra clínica y service_role dan el MISMO SQLSTATE y mensaje en A y B (el disparador proteger_reserva_enlaces rechaza antes '
                    'de la RLS). Sin el disparador (policy-sin-disparador.sql) A deja pasar la RLS y B la niega (42501): B es MÁS estricta')
        return ('ACEPTABLE · WITH CHECK: EXISTS(agenda_ajustes … AND j.agenda_v2_encendida) → agenda_v2_encendida(get_clinica_id()); '
                'policy TO authenticated, la función INVOKER lee con la misma RLS; ejecutado igual en A y B (pasos 15-18)')
    if t == 'comentario':
        if e == 'solo_b':
            return 'ACEPTABLE · COMMENT de la función nueva agenda_v2_encendida'
        if e == 'solo_a':
            return 'ACEPTABLE · COMMENT de la reserva_enlace_emitir de 7 argumentos, retirada (su contenido pasó al COMMENT de la de 9)'
        especiales = {
            'table column public.appointments.reserva_tel_hmac': 'ACEPTABLE · COMMENT: además de quitar «(D2)», «candado» → «bloqueo manual»: corrige el texto a la regla vigente (el teléfono sólo bloquea por bloqueo manual, CLAUDE.md «candado automático»)',
            'table public.agenda_bloqueos': 'ACEPTABLE · COMMENT: «dentro de Spinus sólo pide confirmación» (falso desde l1) → el bloqueo total por cita_proteger_bloqueo con HINT agenda_horario_bloqueado (comprobado ejecutando, pasos 19-22)',
            'table column public.appointments.reserva_reagendados': 'ACEPTABLE · COMMENT: quita «Agenda E6» y añade «Única reserva_* con DEFAULT (cita_proteger_reserva lo tolera)»: cierto en catálogo (es la única reserva_* con DEFAULT)',
            'table column public.consultorios.horario_propio': 'ACEPTABLE · COMMENT: la historia «Desde 20261119130000» → «Al crearse esta columna…»; conserva el prefijo «false = la disponibilidad» que exige b5_horario_propio.sql caso 5 (pasa en B)',
            'function public.cita_recordatorios_pendientes(integer)': 'ACEPTABLE · COMMENT: ya no nombra a la retirada; enumera sus tres puertas (v2 encendida, gcal_sync_clinica_habilitada, recordatorio_encendido): comprobado contra el cuerpo',
            'function public.proteger_reserva_enlaces()': 'ACEPTABLE · COMMENT sin historia; añade «Quien la reemplace parte de este cuerpo» (md5 de prosrc sigue acd4128b, el que exige CLAUDE.md)',
            'table public.cita_correos': 'ACEPTABLE · COMMENT: cita_correos_pendientes (retirada) → cita_recordatorios_pendientes',
        }
        return especiales.get(k, 'ACEPTABLE · COMMENT: sólo quita etiquetas de tanda/migración (D1, j2, K3, «tanda X, punto N»…) o las reescribe sin cambiar el contenido técnico (diff por palabras en comentarios.txt)')
    return 'SIN CLASIFICAR'

filas = list(csv.DictReader(open(difs), delimiter='\t'))
with open(salida, 'w') as f:
    f.write('# E0 · las 96 diferencias A (44 originales sobre base-main) ↔ B (6 fundidas sobre base-main), una por fila,\n')
    f.write('# en el formato --esperadas de scripts/produccion/comparar-estructura.sh (estado, tipo, clave, razón).\n')
    f.write('# La razón empieza por el veredicto de E0. Sin globs: cada clave es exacta.\n')
    vistos = set()
    for r in filas:
        clave = (r['estado'], r['tipo'], r['clave'])
        if clave in vistos:
            continue
        vistos.add(clave)
        # el comparador lee la clave como glob (fnmatch): «[» se escribe «[[]» para que «text[]» sea literal
        f.write('\t'.join([r['estado'], r['tipo'], r['clave'].replace('[', '[[]'), razon(*clave)]) + '\n')
print(len(vistos))
