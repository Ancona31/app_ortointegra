# Deuda técnica — Consentimiento informado

**Fecha:** 2026-11-22 · **Rama de lectura:** `feature/rediseno-estetico` · **Estado:** 🔴 abierta

## Propósito y alcance

Registro de los defectos del consentimiento informado (y de la denegación, donde
comparten código) que **no son de diseño de pantalla**: integridad legal del
documento sellado, privacidad de las identificaciones, datos y lógica. El
rediseño del embudo (pendientes → captura en 4 bloques → revisión → modo paciente
→ devolver al médico → sellar → enviar copia) ya está aprobado y va aparte; aquí
sólo se dice qué de esta lista resuelve (§3).

Cada entrada se verificó leyendo el código en la rama. **Nada se reprodujo en la
app**: los pasos de «Cómo reproducirlo» están deducidos del código. Las
referencias `archivo:línea` son de esta rama el 2026-11-22. Abreviaturas:
`CIF` = `src/components/documentos/ConsentimientoInformadoForm.tsx`,
`FC` = `src/components/documentos/FirmadoConsentimiento.tsx`,
`CID` = `src/components/documentos/CapturaIdentificacion.tsx`,
`SCH` = `supabase/migrations/20260912190416_remote_schema.sql`,
`ADP` = `src/lib/pdf/v2/adaptadores/ConsentimientoInformado.tsx`.

**Numeración:** `CI-DT-n`, por gravedad. Un número no se reutiliza al cerrar una
entrada. Gravedad: **crítica** (puede invalidar o destruir un documento legal ya
firmado), **alta** (riesgo legal o de datos sensibles real en el uso normal),
**media** (pérdida de trabajo o dato incorrecto evitable), **baja** (incomodidad
o hueco sin consecuencia legal directa).

**Reglas que aplican a toda solución con base de datos** (`CLAUDE.md`): ninguna
migración se aplica sola; se genera el SQL y Angel lo ejecuta tras pasar por
`supabase/AUDITORIA-MIGRACIONES.md`. Nunca `DELETE` en producción. FKs a
pacientes `ON DELETE RESTRICT`, nunca se cambia una a `CASCADE`. Emitir y firmar
siempre con el cliente de sesión (`asignar_folio_documento` exenta a quien no
trae JWT, `SCH:803-805`). Todo SQL de este archivo es **BORRADOR**.

### Decisiones de Angel que ya son firmes

1. Un consentimiento **sellado no se puede borrar ni regenerar**.
2. La **fecha del documento es la del día de la firma**, no la del borrador.
3. El texto de la casilla de fotografías es **«documentación médica y seguimiento»** (el del PDF).
4. Uso real: firma en iPad (a veces teléfono), dispositivo personal del médico; casi
   siempre deja borrador y lo retoma él; explica verbalmente y envía copia al correo
   del paciente; los testigos cambian siempre (suelen ser familiares); es frecuente
   que el paciente no pueda firmar; la foto de la INE se toma cuando la traen; la
   denegación casi nunca se usa.
5. El texto del sello va en la **zona del consultorio donde se firmó** (AG-DT-243).

### Tabla resumen

| Id | Título corto | Gravedad | Tipo | Esfuerzo | Migración |
|---|---|---|---|---|---|
| CI-DT-1 | «Regenerar» un sellado lo sustituye por un PDF sin firmas | crítica | integridad legal | S | sí (candado en base) |
| CI-DT-2 | La base deja borrar o reescribir un consentimiento sellado | crítica | integridad legal | M | sí |
| CI-DT-3 | Fecha y edad del borrador; la lista fecha por `created_at` | alta | integridad legal | S–M | no (opcional sí) |
| CI-DT-4 | La casilla de fotografías promete otra finalidad que el PDF | alta | integridad legal | S | no |
| CI-DT-5 | Sello en la zona y el reloj del dispositivo (AG-DT-243) | alta | integridad legal | M | no |
| CI-DT-6 | Fotos de identificación huérfanas en Storage | alta | privacidad | M | no |
| CI-DT-7 | Sin `audit_log` de firmas ni de lecturas de identificaciones | alta | privacidad | S–M | sí |
| CI-DT-8 | La copia al paciente adjunta las INE de familiar y testigos | alta | privacidad | M | no |
| CI-DT-9 | «Elegir archivo» abre la galería con el paciente en el aparato | media | privacidad | S | no |
| CI-DT-10 | La huella no es reproducible desde lo guardado | media | integridad legal | M | no |
| CI-DT-11 | Lo sellado puede no ser lo que se firmó (dos pestañas) | media | integridad legal | S | no |
| CI-DT-12 | «Imprimir sin firma» cierra el documento sin confirmar | media | UX-lógica | S | no |
| CI-DT-13 | Las firmas viven sólo en memoria (atrás del sistema las pierde) | media | datos | M | no |
| CI-DT-14 | «Seguir editándolo» no carga el borrador; `?borrador=` se queda | media | UX-lógica | S | no |
| CI-DT-15 | No hay lista global de consentimientos pendientes | media | UX-lógica | M | no |
| CI-DT-16 | El borrador no se guarda solo | media | datos | M | no |
| CI-DT-17 | Sin conexión, «Guardar borrador» e «Iniciar firmado» siguen visibles | media | sin conexión | S | no |
| CI-DT-18 | La versión del texto legal fijo no queda registrada | baja | integridad legal | M | no |
| CI-DT-19 | Los testigos se guardan en las plantillas | baja | datos | S | no |
| CI-DT-20 | El motivo de la denegación se lee pero no se captura | baja | datos | S | no |
| CI-DT-21 | El visor de un sellado no enseña firmas ni sellos | baja | UX-lógica | M | no |

---

## 2. Entradas

### CI-DT-1 — «Regenerar» un consentimiento sellado lo sustituye por uno sin firmas

**Estado:** 🔴 crítica. Decisión de Angel ya tomada: un sellado no se regenera.

**Qué pasa.** `regenerar()` (`src/components/expediente/PanelDocumentos.tsx:240-302`)
recompone el PDF sólo desde `doc.contenido`. Las firmas, el sello, la huella y
las identificaciones no están en `contenido` sino en `firmas_documento` y en
Storage, y el adaptador lo admite: «al regenerar llegan ausentes y el documento
sale con las celdas para la pluma» (`ADP:11-15`). Sin firmas, `estaSellado` es
falso y tampoco sale la rúbrica del médico (`ADP:131, 159`). Después escribe la
ruta nueva en `pdf_url` (`PanelDocumentos.tsx:286`). El nombre del archivo lleva
la hora al minuto (`src/lib/patientUtils.ts:151-163`), así que el PDF firmado no
se sobrescribe: queda en `documentos-pdf` sin que ninguna fila lo nombre. La única
condición para ofrecer el botón es que el tipo sea componible
(`PanelDocumentos.tsx:371-375`), sin mirar `estado`. Además usa el perfil del
médico en caché (`getDoctorProfile()`, `:247-264`), no el del día de la firma.

Agravante: si el sellado guardó firmas y folio pero falló el PDF, el propio
formulario manda al médico a «recuperarlo desde ahí» (`CIF:1088-1089`), o sea, a
este botón.

**Cómo reproducirlo** (no reproducido en la app, deducido del código). Sellar un
consentimiento con dos firmas → pestaña Documentos → «···» → «Regenerar PDF» →
«PDF». Sale con las celdas en blanco, sin anexo de identificaciones ni bloque de
sellado; el expediente ya sólo entrega ese.

**Por qué importa.** El expediente pasa a entregar, con el mismo folio `CI-`, un
papel que afirma que nadie firmó. `CLAUDE.md` exige que los documentos clínicos
sean inmutables y que los expedientes no se borren (NOM-004, «Cumplimiento
normativo mexicano»). El original sigue en Storage pero es inencontrable desde la
app.

**Solución propuesta.**
1. `PanelDocumentos.tsx`: `bloqueoRegenerar` devuelve un motivo cuando
   `doc.estado === 'firmado'` («Un consentimiento sellado no se vuelve a generar:
   el PDF es el que se firmó.»). `AccionesDocumento.tsx` ya pinta el bloqueo.
2. `CIF:1088-1089`: cambiar el texto del caso «sellado sin PDF» para que no mande
   a «Regenerar» (ver «Decisión», abajo).
3. Candado en la base: lo cubre el disparador de CI-DT-2 (prohíbe cambiar
   `pdf_url` de un `firmado` que ya lo tiene).

**Alternativas.** «Recuperar PDF sellado», sólo cuando `pdf_url IS NULL`: lee
`firmas_documento` (trazo, `firmado_en`, `identificacion_path`, la fila `medico`
como `selladoEn`, la `huella`), pide las fotos por la ruta GET de identificación
(que ya admite documentos no borrador, `identificacion/route.ts:143-146`) y llama
a `generarPdf` con los mismos datos que `sellar()` (`CIF:1025-1041`). Todo lo
necesario está en la base. El papel recompuesto llevaría el membrete de hoy, no
el del día de la firma.

**Cómo verificar.** Vitest de la condición `bloqueoRegenerar` (firmado →
bloqueado; `emitido_firma_manual` → libre). Prueba SQL de CI-DT-2 para el
candado. E2E: sellar, abrir el visor, comprobar que «Regenerar PDF» sale
deshabilitado con su motivo.

**Riesgos y compatibilidad.** Ninguno para lo ya emitido: sólo quita un botón en
un estado. Consultas para saber si ya ocurrió (sólo lectura, la ejecuta Angel):

```sql
-- Consentimientos sellados con algún UPDATE posterior al sellado (posibles regeneraciones).
select d.id, d.folio, f.firmado_en_servidor as sellado, count(a.id) as updates_posteriores
from public.documentos d
join public.firmas_documento f on f.documento_id = d.id and f.rol = 'medico'
join public.audit_log a on a.tabla = 'documentos' and a.registro_id = d.id
  and a.accion = 'UPDATE' and a.created_at > f.firmado_en_servidor + interval '10 minutes'
where d.estado = 'firmado'
group by d.id, d.folio, f.firmado_en_servidor;
```

**Decisión que necesita Angel.** Si el sellado se queda sin PDF, ¿se ofrece
«Recuperar PDF sellado» (alternativa) o el documento se queda sin PDF y se emite
otro? Y para los afectados, si los hay, ¿se repone `pdf_url` al archivo original
(una sentencia `UPDATE` como `postgres`, nunca `DELETE`)?

---

### CI-DT-2 — La base deja borrar o reescribir un consentimiento sellado

**Estado:** 🔴 crítica. Decisión de Angel ya tomada: un sellado no se borra.

**Qué pasa.**
- **Borrar.** `documentos_delete` deja al autor borrar cualquier documento de su
  clínica, sin mirar el estado (`SCH:2937-2942`). El visor ofrece «Eliminar
  documento» a todo lo que no es borrador (`PanelDocumentos.tsx:446-450`) y la
  ruta borra la fila y su PDF (`src/app/api/documentos/[id]/route.ts:23, 31-37`).
  Las firmas se van en cascada: `firmas_documento_documento_fkey ... ON DELETE
  CASCADE` (`SCH:2314`), y `firmas_documento_inmutable()` deja pasar ese borrado
  cuando el documento ya no existe (`SCH:1427-1440`).
- **Reescribir.** `asignar_folio_documento()` sólo congela `estado`, `folio` y
  `formato_version` (`SCH:822-857`). `contenido`, `tipo`, `paciente_id`,
  `pdf_url` y `created_at` de un `firmado` se pueden cambiar con un `UPDATE`;
  `documentos_update` sólo exige ser el autor (`SCH:2964-2972`). Lo único que lo
  impide hoy es que el formulario se desmonte al emitir (`CIF:111-123`).
- **Storage.** `documentos_pdf_delete_tratante` (`SCH:3210-3217`) deja al médico
  tratante borrar el PDF del bucket directamente.

**Comparación con el resto del repo.** Las citas sí tienen candado en la base:
`cita_proteger_borrado()` (`supabase/migrations/20261117120000_agenda_seg_borrado_cita.sql:119-146`)
y `cita_proteger_atendida()` (`20261120130000`): disparador BEFORE, INVOKER,
`search_path = ''`, 42501 con HINT, exentos sólo `postgres`/`supabase_admin` y
**no** `service_role`. Las firmas también (`firmas_documento_inmutable`). Las
notas clínicas (`consultas`) **no**: sólo tienen `audit_consultas` y una policy
de UPDATE por autor (`SCH:2631, 2905-2913`). El patrón a reutilizar es el de las
citas.

**Cómo reproducirlo** (deducido del código). (a) Sellar → visor → «···» →
«Eliminar documento» → confirmar: desaparecen la fila, sus firmas y el PDF.
(b) Con la sesión del autor, `supabase.from('documentos').update({ contenido: {...} }).eq('id', <sellado>)`
desde la consola del navegador: la base lo acepta.

**Por qué importa.** Es borrar o alterar un documento firmado del expediente:
`CLAUDE.md` («Reglas de seguridad»: notas inmutables; «Cumplimiento»: los
expedientes nunca se borran, soft delete con retención mínima de 5 años). El
`audit_log` deja constancia (`audit_documentos`, `SCH:2666-2669`) pero sólo de
`TG_OP` y el id (`SCH:1721-1733`): no se recupera lo borrado.

**Solución propuesta.**
1. Migración nueva en `supabase/migrations/` (nombre sugerido
   `2026112XXXXXXX_documentos_sellado_inmutable.sql`), con el formato de cabecera,
   pre-vuelo y rejilla de veredicto de las de la agenda:

```sql
-- BORRADOR — NO APLICAR; pasa por supabase/AUDITORIA-MIGRACIONES.md
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF to_regclass('public.documentos') IS NULL THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: falta public.documentos.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc WHERE oid = to_regprocedure('public.documento_proteger_sellado()') AND prosecdef) THEN
    RAISE EXCEPTION 'PRE-VUELO FALLÓ: documento_proteger_sellado() existe como SECURITY DEFINER; tiene que ser invoker.';
  END IF;
END $$;

-- Sólo lee OLD y NEW: no consulta ninguna tabla (sin autorreferencia).
CREATE OR REPLACE FUNCTION public.documento_proteger_sellado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $fn$
BEGIN
  IF current_user IN ('postgres', 'supabase_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF OLD.estado <> 'firmado' THEN
    RETURN COALESCE(NEW, OLD);   -- borradores y emitidos: como hoy
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Un documento sellado no se borra'
      USING ERRCODE = '42501', HINT = 'documento_sellado_inmutable';
  END IF;

  -- UPDATE: todo queda fijo salvo poner pdf_url cuando faltaba.
  IF (to_jsonb(NEW) - 'pdf_url') IS DISTINCT FROM (to_jsonb(OLD) - 'pdf_url')
     OR (OLD.pdf_url IS NOT NULL AND NEW.pdf_url IS DISTINCT FROM OLD.pdf_url) THEN
    RAISE EXCEPTION 'Un documento sellado no se modifica'
      USING ERRCODE = '42501', HINT = 'documento_sellado_inmutable';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE EXECUTE ON FUNCTION public.documento_proteger_sellado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documento_proteger_sellado() TO anon, authenticated, service_role;

CREATE OR REPLACE TRIGGER trg_documentos_proteger_sellado
  BEFORE UPDATE OR DELETE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.documento_proteger_sellado();

COMMIT;
```

   Roles: exentos sólo `postgres` y `supabase_admin` (editor SQL y acciones
   referenciales, como en `cita_proteger_borrado`). `service_role` **no** está
   exento: hoy ningún camino del servidor escribe `documentos` con
   `createAdminClient()` (sólo leen: `super-admin/*`, `r/[folio]/page.tsx`).
   La salida de borrador (`OLD.estado = 'borrador'`) no se toca, así que el
   sellado (`CIF:984-994`) y el `pdf_url` posterior (`CIF:1055-1058`, desde
   `NULL`) siguen pasando. La FK `ON DELETE CASCADE` de las firmas se queda como
   está (no se cambia ninguna FK): con el disparador sólo puede alcanzar a
   borradores. TRUNCATE: `documentos` es referenciada por `firmas_documento`,
   que ya tiene `trg_firmas_documento_no_truncate` (`SCH:2691-2694`), así que un
   `TRUNCATE ... CASCADE` ya falla; sin `CASCADE` falla por la FK.
2. `src/app/api/documentos/[id]/route.ts`: traducir el 42501 con HINT
   `documento_sellado_inmutable` a 409 `documento_sellado` (por el HINT, no sólo
   por el código, como `bloqueoTotalServidor.ts`).
3. `PanelDocumentos.tsx:446-450`: no ofrecer «Eliminar documento» con
   `estado === 'firmado'`.
4. Storage: policy RESTRICTIVE de DELETE en `documentos-pdf` que niegue el objeto
   nombrado por un `pdf_url` de un `firmado`. Requiere leer `documentos` desde la
   policy; hay que auditarlo aparte (rendimiento y recursión, lección del
   2026-05-04 de `CLAUDE.md`). Ver «Decisión».

**Alternativas.** Proteger también `emitido_firma_manual` de consentimiento y
denegación (su papel firmado a mano es igual de legal). Se descartó como
propuesta base porque las subidas de laboratorio nacen `emitido_firma_manual`
(DEFAULT de la columna, `SCH:336`) y la «Mejora A» de `CLAUDE.md` necesita
borrarlas; habría que filtrar por `tipo`.

**Cómo verificar.** Prueba SQL en `supabase/pruebas-sql/` con el patrón de
`seg_borrado_cita.sql`: como `authenticated` autor, DELETE de un firmado → 42501;
UPDATE de `contenido` → 42501; UPDATE de `pdf_url` desde NULL → pasa; desde no
NULL → 42501; DELETE de un borrador → pasa y arrastra sus firmas; como
`service_role` → 42501; como `postgres` → pasa. Cada caso en rojo con su mutación.

**Riesgos y compatibilidad.** Lo ya emitido no cambia. `to_jsonb(NEW) - 'pdf_url'`
congela también cualquier columna futura (como el disparador de `reserva_*`): una
columna nueva con valor por defecto que se rellene por UPDATE rompería el
sellado; quien la añada tiene que saberlo.

**Decisión que necesita Angel.** (1) ¿Se extiende a `emitido_firma_manual` de
`consentimiento_informado` y `denegacion_consentimiento`? (2) ¿Se blinda también
el borrado del PDF en Storage (punto 4) o basta con la fila?

---

### CI-DT-3 — Fecha y edad del borrador; la lista fecha el documento por `created_at`

**Estado:** 🔴 alta. Decisión de Angel ya tomada: la fecha es la del día de la firma.

**Qué pasa.** `aplicarBorrador` repone la fecha y la edad guardadas
(`CIF:550, 553`); sólo cae a hoy si no había fecha. La fecha nace en
`TZ_CLINICA`, constante de Ciudad de México (`CIF:352`, `src/lib/dates.ts:69`),
no en la zona del consultorio. Ni `iniciarFirmado` (`CIF:837-867`) ni `imprimir`
(`CIF:1110-1146`) la revisan. Aparte, la tabla no tiene fecha de emisión
(`SCH:319-337`, no hay `updated_at` ni `emitido_en`): el visor y la lista pintan
`created_at` (`src/components/expediente/VisorDocumento.tsx`, `fechaCorta(doc.created_at)`),
que es el día del borrador, y la cabecera del borrador retomado dice «Guardado el»
con `created_at` (`CIF:567, 1823`), no con el último guardado.

**Cómo reproducirlo** (deducido del código). Guardar un borrador el 1 de
octubre; retomarlo y sellarlo el 20: el papel dice «01 de octubre», la edad es la
del 1 de octubre y la lista lo fecha el 1.

**Por qué importa.** Un consentimiento con fecha anterior a la firma acredita un
acto en un día en que no ocurrió. La edad puede ser falsa en el papel.

**Solución propuesta.** En `CIF`:
1. `aplicarBorrador`: proponer `hoyEnTZ(zona)` (zona = `consultorioActivo?.timezone ?? TZ_CLINICA`)
   y `edadInicial` (la de la ficha, ya la recibe el formulario, `CIF:96`) en vez
   de las guardadas, con una línea «La fecha era la del borrador (1 oct); se cambió
   a hoy.» cuando difieran.
2. `iniciarFirmado` e `imprimir`: si `fecha` no es hoy, fijarla a hoy **antes**
   de `contenidoConsentimiento()` y de la huella (`CIF:850-852`), y decirlo.
3. Visor y carril: para `firmado`, la fecha de `contenido.fecha`; o, si se acepta
   la migración opcional, `emitido_en`.

**Alternativas.** Migración opcional: columna `emitido_en timestamptz` que
`asignar_folio_documento()` rellena con `now()` al salir de borrador o al nacer
emitido (no la propone el cliente). Exige reescribir esa función desde su cuerpo
vigente (`SCH:793-871`) y pasar por la auditoría. Para lo ya emitido quedaría
`NULL` y se caería a `created_at`.

**Cómo verificar.** Vitest de la función que decide la fecha al retomar (con
`TZ` sin fijar, `UTC` y `America/Hermosillo`, como exige `CLAUDE.md`, tanda M).
E2E: sembrar un borrador con fecha de hace 10 días, retomarlo, comprobar el aviso
y la fecha del PDF.

**Riesgos y compatibilidad.** Documentos ya emitidos: ninguno (su `contenido` no
se toca). El médico que quiera otra fecha la sigue pudiendo escribir antes de
firmar.

**Decisión que necesita Angel.** ¿«Imprimir sin firma» sigue la misma regla (la
fecha del día en que se imprime), o ahí la fecha la pone el médico?

---

### CI-DT-4 — La casilla de fotografías promete otra finalidad que el PDF

**Estado:** 🔴 alta. Decisión de Angel ya tomada: «documentación médica y seguimiento».

**Qué pasa.** La casilla dice «Autoriza su uso con fines educativos y de
publicación académica» (`CIF:1588`). Los dos PDF imprimen «Autorizo la toma de
fotografías clínicas con fines de documentación médica y seguimiento del
tratamiento» (`src/lib/pdf/v2/formatos/ConsentimientoInformado.tsx:191-192`,
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:988`).

**Cómo reproducirlo.** Marcar la casilla y sellar: el papel dice otra cosa.

**Por qué importa.** El médico pregunta por una finalidad y el paciente firma otra.
Las fotos clínicas son datos sensibles (`CLAUDE.md`, LFPDPPP vigente). Si alguna
vez se quiso la finalidad académica, ningún papel la recoge.

**Solución propuesta.** Cambiar sólo el texto de `CIF:1588` a «Autoriza la toma
de fotografías clínicas para documentación médica y seguimiento del tratamiento».
El PDF no se toca. Lo cubre el rediseño si usa ese texto (§3).

**Cómo verificar.** Prueba de Vitest que compara el texto de la casilla con la
constante del formato (exportarla del formato y usarla en los dos sitios
evitaría que vuelvan a divergir; es una constante, no una abstracción).

**Riesgos y compatibilidad.** Ninguno: `autorizaFotos` sigue siendo booleano y lo
impreso no cambia. Los papeles ya emitidos dicen lo correcto.

---

### CI-DT-5 — El sello sale en la zona y con el reloj del dispositivo (AG-DT-243)

**Estado:** 🔴 alta (`DEUDA_TECNICA.md` AG-DT-243, prioridad alta; Angel: «el
sello va en la zona del consultorio donde se firmó. Se corrige en su propia rama»).

**Qué pasa.** `selloLegible` compone con `getDate/getHours` en la zona del
navegador, sin rótulo de zona (`ADP:60-68`; v1 en
`src/lib/pdf/ConsentimientoInformadoPdf.tsx:238`). Además, lo que se sella es la
hora del **reloj del dispositivo**: `firmadoEn = new Date().toISOString()`
(`FC:251`) y `selladoEn` (`CIF:941`). La base guarda también
`firmado_en_servidor` (`SCH:1397`), pero el papel no lo usa, y el CHECK sólo
acota el reloj entre el año 2000 y «servidor + 1 día» (`SCH:365-366`).
`contenido.timezone` guarda la zona del dispositivo (`CIF:744`), no la del
consultorio, y nadie la lee al componer el sello.

**Cómo reproducirlo** (deducido del código). iPad con la zona en otra región, o
con el reloj atrasado dos horas: el papel sella esa hora.

**Por qué importa.** La hora de la firma es parte de lo que el documento acredita.

**Solución propuesta.**
1. Al sellar (`CIF:927-1060`), escribir en `contenido.timezone` la zona del
   consultorio activo (`consultorioActivo.timezone`, existe en el tipo
   `Consultorio`, `src/types/index.ts:183`) y no la del dispositivo. La clave ya
   existe: no se añade ninguna. Va antes de `persistirBorrador` y de la huella
   (`CIF:850-852`), así que queda dentro de lo firmado.
2. `selloLegible(iso, zona)` con `formatInTimeZone` de `date-fns-tz` (ya en
   `dates.ts`), con `zona = data.timezone ?? TZ_CLINICA`, en v1 y en v2.
3. Ver «Decisión» sobre qué reloj se imprime.

**Cómo verificar.** La prueba de `adaptadoresV2.test.ts` que hoy falla en
`Asia/Tokyo` y `Pacific/Kiritimati` debe pasar en las cinco zonas. Añadir el caso
`timezone: 'America/Cancun'` con `TZ=America/Hermosillo`.

**Riesgos y compatibilidad.** En los ya sellados, `contenido.timezone` es la del
dispositivo de entonces, que es la mejor aproximación disponible a la del
consultorio; con CI-DT-1 cerrado esos PDF no se recomponen, así que el cambio
sólo afecta a lo nuevo. Sin consultorio activo, cae a la del dispositivo como hoy.

**Decisión que necesita Angel.** ¿El papel sella la hora del dispositivo
(`firmado_en`, la del instante del trazo) o la del servidor (`firmado_en_servidor`,
la de la inserción, que no depende del reloj del iPad pero es la misma para todos
los firmantes)?

---

### CI-DT-6 — Fotos de identificación huérfanas en Storage

**Estado:** 🔴 alta.

**Qué pasa.** La foto se sube en cuanto se acepta el recorte
(`CID:191-199` → `src/app/api/documentos/[id]/identificacion/route.ts:97-136`,
ruta `{docId}/{rol}.{ext}` con `upsert`). La fila que la nombra
(`firmas_documento.identificacion_path`) sólo se escribe al sellar
(`CIF:953-977`). Quedan objetos que ninguna fila nombra cuando:
- se sale del firmado con fotos tomadas (`FC:200-204`, el borrador se queda; las
  fotos también);
- se rehace una firma que tenía foto y se elige «Sin foto» (`FC:255-264`: la ruta
  vieja no se borra);
- se cancela el borrador o se reemplaza (`DELETE /api/documentos/[id]` sólo borra
  en `documentos-pdf`, `route.ts:31-37`; `CIF:874`);
- el borrador se emite con «Imprimir sin firma» tras un firmado abortado.

**Cómo reproducirlo** (deducido del código). Iniciar firmado → paciente firma →
«Tomar foto» → «Usar esta foto» → X → «Salir» → «Cancelar borrador». La INE
queda en `identificaciones/{id}/paciente.jpg`.

**Por qué importa.** Una identificación oficial es «el dato más sensible que
guarda el sistema» (cabecera de `identificacion/route.ts:7-9`). Conservarla sin
documento que la justifique contradice el principio de conservar sólo lo
necesario de la LFPDPPP vigente (verificar el artículo exacto antes de citarlo;
no se cita de memoria). Con la nota de Angel de que la INE «se toma cuando la
traen», el caso de salir y volver otro día será habitual.

**Solución propuesta.**
1. `src/app/api/documentos/[id]/route.ts` (DELETE): si la fila borrada era
   borrador de consentimiento, `createAdminClient().storage.from('identificaciones').list(id)`
   y `remove` de todo lo listado. El documento ya se comprobó con la sesión y la
   RLS (clínica y autor), y la ruta está acotada al prefijo `{id}/`; por la regla
   de `createAdminClient()` de `CLAUDE.md`, comprobar además que `doc.paciente_id`
   pertenece a la `clinica_id` del perfil antes de usarlo.
2. Al **sellar** (`CIF`, tras el UPDATE del estado): pedir a una ruta nueva
   `POST /api/documentos/[id]/identificacion/limpiar` que borre los objetos del
   prefijo que no estén en `firmas_documento.identificacion_path` del documento.
3. Al salir del firmado (`FC` → `onSalir`): la misma limpieza, con el documento
   todavía en borrador.

**Alternativas.** Tarea programada que barra prefijos de documentos inexistentes
o borradores sin firmas con más de N días. Más robusta (cubre cierres de pestaña)
pero añade un proceso con privilegios; necesitaría filtrar por clínica.

**Cómo verificar.** Prueba de la ruta: tras el DELETE de un borrador con dos fotos,
`list(id)` vacío. E2E con Storage local: salir del firmado y comprobar el bucket.

**Riesgos y compatibilidad.** Borrar del bucket es irreversible: la limpieza tiene
que excluir siempre lo nombrado por una firma, y nunca correr sobre un `firmado`
salvo para lo no nombrado. Las huérfanas ya existentes: inventario sólo de
lectura antes de decidir nada (no hay `DELETE` en producción sin Angel).

**Decisión que necesita Angel.** Si, con el rediseño, el médico podrá dejar la
foto tomada y volver otro día, ¿se conserva la foto entre sesiones (entonces no
se limpia al salir y hay que guardarla en el borrador) o se pide de nuevo?

---

### CI-DT-7 — Sin `audit_log` de las firmas ni de las lecturas de identificaciones

**Estado:** 🔴 alta.

**Qué pasa.** `firmas_documento` no tiene disparador de auditoría: sólo
`trg_firmas_documento_guardian`, `_inmutable` y `_no_truncate` (`SCH:2681-2694`).
El sellado deja dos filas `UPDATE` de `documentos` (`audit_documentos`) que no
dicen que fue un sellado ni cuántas firmas. La ruta de identificación no llama a
`logAudit` ni al subir (POST) ni al servir la foto (GET, `identificacion/route.ts:140-176`),
que devuelve la INE entera como data-URL.

**Cómo reproducirlo.** Sellar con foto y mirar `audit_log`: no hay ninguna fila
que nombre la firma ni la identificación.

**Por qué importa.** `CLAUDE.md`: «Todo acceso a expedientes debe quedar
registrado en `audit_log`», «Todo cambio en datos sensibles DEBE registrarse en
`audit_log`», «NUNCA quites el audit log de ninguna acción».

**Solución propuesta.**
1. Migración:

```sql
-- BORRADOR — NO APLICAR; pasa por supabase/AUDITORIA-MIGRACIONES.md
-- log_tabla_change() ya existe (SECURITY DEFINER, escribe user_id, TG_OP, tabla, id).
-- firmas_documento sólo admite INSERT (el resto lo rechaza su disparador), así que basta INSERT.
CREATE TRIGGER audit_firmas_documento
  AFTER INSERT ON public.firmas_documento
  FOR EACH ROW EXECUTE FUNCTION public.log_tabla_change();
```
   No cambia permisos ni policies; aplica a todos los roles.
2. `identificacion/route.ts`: `logAudit` con `tabla: 'documentos'`,
   `registroId: id`, acciones nuevas `subir_identificacion` y
   `leer_identificacion` (añadirlas a la unión `AuditAccion` de `src/lib/audit.ts`),
   y en `descripcion` sólo el rol, nunca la ruta ni datos de la persona.
3. Al sellar, una fila `sellar_documento` con el folio (como `enviar_documento`
   en `api/email/enviar-documento/route.ts:350-358`).

**Cómo verificar.** Prueba SQL: INSERT de una firma en un borrador → una fila en
`audit_log` con `tabla = 'firmas_documento'`, contando por `created_at >=` una
marca y no por ventana (regla de la tanda M; **sin borrar nunca `audit_log`**).
Prueba de la ruta: POST y GET escriben su fila.

**Riesgos y compatibilidad.** Cinco filas más por sellado. Ninguno para lo ya
emitido.

---

### CI-DT-8 — La copia por correo al paciente lleva las INE del familiar y de los testigos

**Estado:** 🔴 alta. Uso confirmado por Angel: siempre envía copia al paciente.

**Qué pasa.** El PDF sellado incrusta una hoja de anexo con la foto de cada
firmante que la dio (`CIF:1008-1014, 1040`), no sólo la del paciente. El envío
adjunta ese mismo archivo (`src/app/api/email/enviar-documento/route.ts:308, 345`).

**Cómo reproducirlo.** Sellar con fotos de paciente y testigo → «Enviar por
correo»: el adjunto lleva la credencial del testigo.

**Por qué importa.** Los testigos «suelen ser familiares» pero son terceros: su
identificación oficial sale de la clínica a un correo que no es suyo. Dato
personal de un tercero enviado sin su consentimiento para esa finalidad
(LFPDPPP vigente; verificar artículo antes de citarlo).

**Solución propuesta.** Emitir dos PDF al sellar: el del expediente (con el anexo
completo) y la «copia para el paciente», sin la hoja de anexo o con sólo la
identificación del propio paciente o de su representante. Guardar la ruta de la
copia en una clave nueva no es posible sin tocar `contenido`; sí lo es como
segundo objeto con nombre derivado (`{ruta}-copia.pdf`) que la ruta de correo
busca primero. Toca `CIF` (sellado), `generarPdf` (parámetro para omitir el
anexo) y la ruta de correo.

**Alternativas.** Que el correo de un `consentimiento_informado` sellado
recomponga en el servidor una copia sin anexo: hoy los PDF se componen en el
navegador, así que sería un camino nuevo y grande.

**Cómo verificar.** Vitest del formato: con `copiaPaciente: true` no hay página
de anexo. E2E de la ruta de correo con Mailpit: el adjunto no contiene la hoja.

**Riesgos y compatibilidad.** Los ya sellados sólo tienen un PDF: para ellos,
seguir enviando el que hay o bloquear el envío hasta tener copia (decisión).

**Decisión que necesita Angel.** ¿Qué identificaciones van en la copia del
paciente (ninguna, la suya, la suya y la del representante)? ¿Qué se hace con los
ya sellados?

---

### CI-DT-9 — «Elegir archivo» abre la galería con el paciente teniendo el aparato

**Estado:** 🟡 media.

**Qué pasa.** La captura ofrece «Tomar foto» (`capture="environment"`) y «Elegir
archivo», el mismo campo sin `capture` (`CID:270-274, 290-297`), que abre la
fototeca. El dispositivo es el personal del médico (decisión 4) y en ese momento
lo tiene el paciente.

**Cómo reproducirlo.** Firmar → «Elegir archivo»: sale la fototeca del médico.

**Por qué importa.** Puede contener fotos clínicas de otros pacientes: el paciente
ve datos sensibles de terceros.

**Solución propuesta.** Quitar «Elegir archivo» del flujo de firmado (decisión 4:
la INE se toma cuando la traen). Lo cubre la maqueta («solo cámara», §3). Si se
quiere conservar para escritorio, mostrarlo sólo cuando `capture` no aplica
(sin pantalla táctil) y siempre del lado del médico, nunca en el modo paciente.

**Cómo verificar.** E2E: en el modo paciente no hay ningún `input[type=file]`
sin `capture`.

**Riesgos y compatibilidad.** En escritorio, `capture` se ignora y «Tomar foto»
abre el selector igual (`CID:42-45`): no se pierde la opción allí.

---

### CI-DT-10 — La huella no es reproducible desde lo guardado

**Estado:** 🟡 media.

**Qué pasa.** `huellaDocumento` = SHA-256 de `JSON.stringify(contenido)`
(`src/lib/documentos/firmaTrazo.ts:429-447`), con las claves en el orden en que
el código arma el objeto (`CIF:736-746`). `contenido` es `jsonb` (`SCH:324`), y
Postgres no conserva el orden de las claves en `jsonb` (comportamiento documentado
de Postgres; no se comprobó contra esta base). Releer la fila y volver a hacer
`JSON.stringify` da otro texto y otra huella. No existe ningún verificador en el
código. La huella cubre `contenido`, no el membrete ni el texto legal fijo
(CI-DT-18).

**Cómo reproducirlo** (deducido). Leer un `firmado` con supabase-js, calcular
`huellaDocumento(fila.contenido)` y compararla con `firmas_documento.huella`: no
coincide.

**Por qué importa.** La huella existe para «demostrar que lo que se firmó es lo
que hoy está guardado» (`firmaTrazo.ts:424-427`). Si nadie puede recalcularla, no
demuestra nada ante un tercero.

**Solución propuesta.** Canonicalizar antes de resumir: serializar con las
claves ordenadas recursivamente (RFC 8785/JCS o un orden lexicográfico simple,
documentado). Marcar la versión en la propia huella (`c1:` + hex) para distinguir
las nuevas de las viejas. Añadir `verificarHuella(contenido, huella)` en
`firmaTrazo.ts` y una prueba.

**Alternativas.** Para las ya selladas: verificador que reconstruya el objeto en
el orden de claves de `contenidoConsentimiento()` de la versión del código con
que se firmó. Probablemente funcione (el orden lo fija el código y `secciones`
sale de `leerSecciones`), pero depende de no haber cambiado ese orden nunca: hay
que comprobarlo contra la historia de `CIF` y contra filas reales.

**Cómo verificar.** Vitest: misma huella para el mismo objeto con las claves en
otro orden; ida y vuelta por `JSON.parse` de un texto con orden de `jsonb`.

**Riesgos y compatibilidad.** Las huellas viejas no cambian (las firmas son
inmutables): convivirán dos esquemas y el verificador elige por el prefijo.

**Decisión que necesita Angel.** ¿Hace falta poder verificar las ya selladas, o
basta con que las nuevas sean verificables?

---

### CI-DT-11 — Lo sellado puede no ser lo que se firmó (borrador editado en otra pestaña)

**Estado:** 🟡 media.

**Qué pasa.** Al abrir el firmado se guarda el borrador y se resume ese contenido
(`CIF:850-852`). El sellado sólo cambia `estado` (`CIF:984-994`), y la fila
sigue siendo un borrador editable mientras el firmado está abierto
(`persistirBorrador`, `CIF:770-782`). Si el mismo médico guarda el borrador desde
otro aparato o pestaña entretanto, la base sella ese otro contenido; el PDF y la
huella son del primero.

**Cómo reproducirlo** (deducido). Pestaña A: «Iniciar firmado». Pestaña B: abrir
el mismo paciente, «Retomar», cambiar el procedimiento, «Guardar borrador».
Pestaña A: firmar y sellar.

**Por qué importa.** La fila del expediente y el papel firmado dicen cosas
distintas. Con iPad y computadora a la vez es posible.

**Solución propuesta.** En el UPDATE del sellado, enviar también
`contenido: firmando.contenido` (`CIF:991`). El disparador de folio lo admite en
la salida de borrador, y deja la fila igual a lo que se resumió. Más estricto:
leer la fila antes de insertar firmas y abortar si su `contenido` no es igual
(comparando objetos, no texto) a `firmando.contenido`.

**Cómo verificar.** Prueba de integración con dos clientes de sesión sobre la base
local.

**Riesgos y compatibilidad.** Ninguno para lo ya emitido. Si se elige «abortar»,
hay que decirle al médico qué pasó.

---

### CI-DT-12 — «Imprimir sin firma» cierra el documento sin confirmar

**Estado:** 🟡 media.

**Qué pasa.** El botón (`CIF:1733-1743`) llama a `imprimir()` sin diálogo. Con un
borrador cargado, lo convierte en `emitido_firma_manual` con folio `CI-`
(`CIF:1178-1195`), estado terminal (`SCH:823-831`): ese documento ya no se puede
firmar en pantalla. Sin borrador, crea uno nuevo con folio.

**Cómo reproducirlo.** Retomar un borrador → «Imprimir sin firma» para enseñárselo
al paciente → «Iniciar firmado» ya no existe para ese documento; habría que crear
otro (otro folio).

**Por qué importa.** Consume un folio y cierra el borrador del flujo habitual por
un gesto que parece «vista previa». Dos consentimientos del mismo acto con folios
distintos confunden el expediente.

**Solución propuesta.** Diálogo de confirmación: «Se emitirá con folio y se
firmará a mano. Ya no podrá firmarse en pantalla.» (`ModalShell`, como los demás).
Y ofrecer una vista previa sin folio ni fila (PDF con marca «Borrador — sin
validez»), que no toca la base.

**Cómo verificar.** E2E: pulsar «Imprimir sin firma» abre el diálogo; cancelar no
cambia el estado.

**Riesgos y compatibilidad.** Ninguno. El rediseño mueve el botón a la revisión,
pero no añade confirmación (§3).

**Decisión que necesita Angel.** ¿Hace falta la vista previa sin folio?

---

### CI-DT-13 — Las firmas viven sólo en memoria

**Estado:** 🟡 media.

**Qué pasa.** Los trazos están en el estado de `FC` (`FC:154, 166-167`) y entran en
la base sólo al sellar (`CIF:977`). La X y Escape piden confirmación
(`FC:199-216`), pero nada vigila el «atrás» del navegador ni el gesto de borde de
iOS (no hay `popstate` ni `beforeunload` en `FC` ni en `CIF`): se sale de la ruta
y se pierden todas.

**Cómo reproducirlo** (deducido). Firman paciente y familiar → gesto de atrás:
vuelve al expediente sin aviso; al retomar, el borrador está pero sin firmas.

**Por qué importa.** Con el paciente que no puede firmar y familiares que firman
por él, repetir el acto es costoso; y es probable en iPad.

**Solución propuesta.**
1. `FC`: al montar, `history.pushState` de una entrada propia y `popstate` que
   llame a `intentarSalir()`; `beforeunload` mientras `hayFirmas`. Es lo mínimo.
2. Persistir en `sessionStorage` cifrado no es válido: son datos del paciente y
   `CLAUDE.md` exige `secureStorage` y prohíbe `localStorage` sin él; y una firma
   capturada no debería sobrevivir fuera del acto. No se propone.

**Alternativas.** Guardar cada firma en `firmas_documento` al confirmarla: la base
lo permite en borrador (`firmas_documento_insert`, `SCH:2974-2979`), pero la firma
es inmutable y única por rol (`SCH:1427-1440, 2441`), así que **«Rehacer» dejaría
de funcionar**. Descartada salvo rediseño de «Rehacer».

**Cómo verificar.** E2E: con una firma capturada, `page.goBack()` muestra la
confirmación y no navega.

**Riesgos y compatibilidad.** Una entrada de historial de más; hay que quitarla al
salir por la X.

---

### CI-DT-14 — «Seguir editándolo» no carga el borrador; `?borrador=` se queda en la URL

**Estado:** 🟡 media.

**Qué pasa.** El visor navega con `&doc={id}` (`PanelDocumentos.tsx:452-454`). La
página lee `borrador` (`src/app/(app)/expediente/[id]/documentos/page.tsx:154`).
Sin `borradorId`, el formulario busca el último borrador propio del paciente y
abre el diálogo «ya tiene un consentimiento a medias» (`CIF:592-610`) en vez de
cargarlo. `DocumentosRecientes.tsx:172-179` ya lo anota. Aparte, `irATipo` sólo
quita `tipo` (`page.tsx:118-124`): tras emitir, `?borrador=` sigue apuntando a un
documento ya emitido.

**Cómo reproducirlo.** Visor de un borrador → «Seguir editándolo» → sale el
diálogo, no el borrador.

**Por qué importa.** Un clic de más en la acción principal del flujo habitual.

**Solución propuesta.** `PanelDocumentos.tsx:453`: `&borrador=${doc.id}`.
`irATipo(null)` (al cerrar tras emitir) borra también `borrador`.

**Cómo verificar.** E2E: «Seguir editándolo» abre el formulario con el
procedimiento del borrador y sin diálogo.

**Riesgos y compatibilidad.** Ninguno.

---

### CI-DT-15 — No hay lista global de consentimientos pendientes

**Estado:** 🟡 media.

**Qué pasa.** Los borradores sólo se ven paciente por paciente (carril, línea de
tiempo, visor). Ni `/documentos` ni la paleta de comandos los listan (búsqueda de
`'borrador'` en `src/`: sólo componentes del expediente y rutas de servidor). El
índice ya existe: `idx_documentos_borrador (subido_por, created_at DESC) WHERE
estado = 'borrador'` (`SCH:2526-2527`).

**Por qué importa.** El uso real es «dejar borrador y retomarlo» días después; sin
lista, un consentimiento sin firmar el día de la cirugía se descubre tarde.

**Solución propuesta.** Sección «Consentimientos por firmar» en `/documentos`:
consulta con el cliente de sesión (la RLS ya limita a los propios,
`SCH:2957-2962`), `tipo = 'consentimiento_informado' and estado = 'borrador'`,
con nombre del paciente, procedimiento y fecha, enlazando con `?borrador=`. Sin
migración.

**Cómo verificar.** E2E con dos borradores de pacientes distintos.

**Riesgos y compatibilidad.** Ninguno. Parte del rediseño («pendientes», §3):
coordinarlo para no hacerlo dos veces.

---

### CI-DT-16 — El borrador no se guarda solo

**Estado:** 🟡 media.

**Qué pasa.** Sólo se guarda con «Guardar borrador» o al iniciar el firmado
(`CIF:803-824, 851`). No hay temporizador ni aviso al salir con cambios.

**Por qué importa.** Las siete secciones son texto largo; cerrar la pestaña lo
pierde.

**Solución propuesta.** Guardado diferido (p. ej. 20 s sin teclear y al ocultarse
la pestaña, `visibilitychange`) que llame a `persistirBorrador` sólo si el
contenido cambió desde el último guardado, con «Guardado hace 1 min». Nunca crear
el borrador solo si hay `borradorPrevio` sin resolver (`CIF:807`).

**Alternativas.** Sólo aviso al salir (`beforeunload`) con cambios sin guardar:
más barato, no protege del cierre forzado.

**Cómo verificar.** Vitest de la función que decide «hay cambios»; E2E con reloj
fijado.

**Riesgos y compatibilidad.** Cada `UPDATE` escribe una fila en `audit_log`
(`audit_documentos`): con 20 s, decenas por documento. Es el coste a decidir.

**Decisión que necesita Angel.** ¿Autoguardado (con su volumen de auditoría) o
sólo aviso al salir?

---

### CI-DT-17 — Sin conexión, «Guardar borrador» e «Iniciar firmado» siguen visibles

**Estado:** 🟡 media.

**Qué pasa.** El búnker monta el formulario con `offlineMode`
(`src/app/(offline)/offline-mode/page.tsx:623`). Las plantillas se apagan
(`CIF:486`), pero los botones del pie (`CIF:1716-1758`) no miran `offlineMode`, y
`persistirBorrador` llama a Supabase (`CIF:765-768`). En el búnker no hay «···»,
así que «Guardar borrador» sí se ve (`spinus-tokens.css:3043-3046`, archivo en
edición por otro agente).

**Cómo reproducirlo** (deducido). Búnker → Consentimiento → «Guardar borrador» →
«No se pudo guardar el borrador. Revisa tu conexión».

**Por qué importa.** Engaña en la situación en que el médico menos puede
permitírselo.

**Solución propuesta.** Con `offlineMode`, no pintar «Guardar borrador» ni
«Iniciar firmado»; dejar «Imprimir sin firma» (que sí funciona en el búnker,
`CIF:1284-1299`) y una línea «Sin conexión: se imprime para firma a mano».

**Cómo verificar.** Vitest de render con `offlineMode`.

**Riesgos y compatibilidad.** Ninguno. `CLAUDE.md` (Protocolo 6): el búnker va a
migrar a HTML estático; esto sólo evita el fallo mientras tanto.

---

### CI-DT-18 — La versión del texto legal fijo no queda registrada

**Estado:** 🟢 baja (sin reclasificar; anotada).

**Qué pasa.** El fundamento, la declaración de otorgamiento y las frases de
transfusión y fotos viven en el código del formato
(`src/lib/pdf/v2/formatos/ConsentimientoInformado.tsx`, p. ej. `:187-196`).
`formato_version` sólo distingue chasis 1 y 2. Las secciones editables sí se
guardan en `contenido`. La huella no cubre el texto fijo.

**Por qué importa.** Si el texto legal cambia dentro de v2, no consta qué texto
firmó cada paciente salvo por su PDF. Con CI-DT-1 cerrado, el PDF sellado es la
prueba y no se recompone; el riesgo baja.

**Solución propuesta.** Constante `VERSION_TEXTO_LEGAL` en el formato, que el
sellado escriba en `contenido` (clave nueva: entra en la huella; requiere
aceptar una clave más en `contenido`) e imprima en el pie.

**Decisión que necesita Angel.** ¿Se registra? El texto legal tampoco se ha
verificado contra la LFPDPPP vigente (no hay aviso de privacidad propio en el
papel); eso es revisión legal, no deuda técnica.

---

### CI-DT-19 — Los testigos se guardan en las plantillas

**Estado:** 🟢 baja.

**Qué pasa.** `leer()` guarda `testigo1, testigo2` y `aplicar()` los repone
(`CIF:506-509, 518-519`), con el criterio de que «son personal de la clínica,
casi siempre el mismo» (`CIF:473-476`). Angel dice que cambian siempre y suelen
ser familiares.

**Por qué importa.** Aplicar una plantilla trae nombres de testigos de otro
paciente; como «firma quien tiene nombre» (`FC:89-113`), entran solos al flujo
de firmado. Son datos personales de terceros copiados a otro expediente.

**Solución propuesta.** Quitar `testigo1, testigo2` de `leer()` y no reponerlos
en `aplicar()` (dejarlos como estén, igual que el familiar). Cambiar el
comentario de `CIF:473-476`. Lo cubre la maqueta (§3).

**Cómo verificar.** Vitest: aplicar una plantilla vieja con testigos no los
cambia.

**Riesgos y compatibilidad.** Plantillas guardadas con testigos: la clave se
ignora al aplicar, no rompe nada. «Vaciar formulario» ya no limpiará testigos.

---

### CI-DT-20 — El motivo de la denegación se lee pero no se captura

**Estado:** 🟢 baja (la denegación casi nunca se usa).

**Qué pasa.** El adaptador lee `motivoNoFirma` (`src/lib/pdf/v2/adaptadores/DenegacionConsentimiento.tsx:76`,
«la clave está por confirmar»); el formulario no tiene campo ni lo guarda
(`CIF:1142-1145`). La constancia del motivo sale colapsada.

**Solución propuesta.** Campo de texto «Motivo por el que el paciente no puede
firmar» visible con `pacienteNoPuedeFirmar` en denegación, guardado como
`motivoNoFirma`.

**Decisión que necesita Angel.** Confirmar la clave y si el campo aplica también
al consentimiento (hoy el adaptador del consentimiento no la lee).

---

### CI-DT-21 — El visor de un sellado no enseña firmas ni sellos

**Estado:** 🟢 baja.

**Qué pasa.** «Las firmas y la huella del documento se registran al sellarlo;
para verlas, descarga el PDF» (`src/components/expediente/CuerpoDocumento.tsx:445-451`).
El componente no consulta `firmas_documento`.

**Por qué importa.** Para saber si un consentimiento está firmado y por quién hay
que descargar el PDF; la descarga queda auditada, la consulta no existiría.

**Solución propuesta.** Leer `firmas_documento` (rol, `firmado_en_servidor`, con
foto sí/no; nunca el trazo ni la ruta) con el cliente de sesión
(`firmas_documento_select`, `SCH:2981-2986`) al abrir un `firmado`, y pintar una
línea por firmante.

**Riesgos y compatibilidad.** Una consulta más al abrir; sólo para `firmado`.

---

## 3. Qué resuelve ya el rediseño de pantalla aprobado

| Entrada | Cobertura | Qué queda fuera |
|---|---|---|
| CI-DT-4 texto de fotografías | total, si la maqueta usa el texto del PDF | la prueba que evita que vuelvan a divergir |
| CI-DT-9 sólo cámara | total en el modo paciente | — |
| CI-DT-19 testigos fuera de la plantilla | total, si se cambia `leer()`/`aplicar()` | — |
| CI-DT-3 fecha del día de la firma | parcial: la pantalla la muestra | `aplicarBorrador`, la fecha fijada antes de la huella, la edad, el `created_at` de la lista |
| CI-DT-15 pendientes visibles | parcial: depende de si la maqueta tiene lista global o sólo por paciente | la consulta global |
| CI-DT-17 «Guardar borrador» visible | parcial: lo hace visible en línea | ocultarlo (y el firmado) sin conexión |
| CI-DT-13 modo paciente | parcial: sin X a mano baja la salida accidental | `popstate`/`beforeunload` |
| CI-DT-12 «Imprimir sin firma» en la revisión | parcial: lo aleja del flujo | la confirmación y el folio consumido |

**No los cubre:** CI-DT-1, 2, 5, 6, 7, 8, 10, 11, 14, 16, 18, 20, 21.

## 4. Orden recomendado de ataque

**Tanda 1 — antes de usar el consentimiento rediseñado en producción.**
CI-DT-1 y CI-DT-2 (un sellado no se regenera ni se borra; la migración primero
por auditoría, el código puede ir antes porque sólo quita botones), CI-DT-4,
CI-DT-3, CI-DT-14, CI-DT-7 (sin auditoría de firmas no hay rastro de lo que se
haga después) y CI-DT-8 (el rediseño termina en «enviar copia», que es el paso
que manda las INE de terceros). Razón: son las que dañan o falsean un documento
legal ya firmado, o sacan datos sensibles de terceros, en el flujo que el
rediseño vuelve más rápido y por tanto más usado.

**Tanda 2 — en las semanas siguientes.** CI-DT-5 (AG-DT-243, en su propia rama,
como decidió Angel), CI-DT-6 (al menos la limpieza al cancelar y al sellar),
CI-DT-11, CI-DT-12, CI-DT-13, CI-DT-15 y CI-DT-17. Razón: riesgo real pero
acotado, o pérdida de trabajo, sin alterar lo ya firmado.

**Tanda 3 — cuando haya hueco.** CI-DT-10, CI-DT-16, CI-DT-18, CI-DT-19 (si el
rediseño no lo hizo ya), CI-DT-20 y CI-DT-21. Razón: mejoran la prueba o la
comodidad sin riesgo inmediato; CI-DT-10 y CI-DT-18 piden decisión antes.

## 5. Descartados al verificar

- **«El familiar es obligatorio siempre»** (comentario de `FC:103-109`). Es un
  comentario desactualizado, no un defecto: `CIF:650-652` lo exige sólo si el
  paciente no puede firmar o en denegación, y `firmantesDe` filtra por nombre
  (`FC:111-113`), así que el flujo se comporta bien. Conviene corregir el
  comentario cuando se toque el archivo; no se numera.
- **«Foto huérfana al elegir “Sin foto” tras un intento».** Como se planteaba, no
  ocurre: la foto se sube sólo al aceptar el recorte, y eso ya resuelve el paso
  con su ruta (`CID:194-199`); «Volver» desde el recorte no sube nada. Sí ocurre
  vía «Rehacer» y luego «Sin foto»: está en CI-DT-6.
- **«Regenerar sobrescribe el PDF firmado».** No lo sobrescribe en Storage (el
  nombre cambia con el minuto); sustituye `pdf_url` y deja el original sin
  referencia. El defecto es el mismo (CI-DT-1), la descripción se corrigió.
- **«“Seguir editándolo” abre el formulario en blanco»** (comentario de
  `DocumentosRecientes.tsx`). Por el código, abre el formulario con el diálogo de
  borrador previo encima (`CIF:605-610`), no en blanco. Es CI-DT-14.
- **TRUNCATE de `documentos`.** `authenticated` tiene el privilegio
  (`SCH:3523`, AG-DT-253), pero no es alcanzable por PostgREST y la FK desde
  `firmas_documento` más su disparador `no_truncate` ya lo impiden. No se numera.

## 6. Lo que no se pudo determinar leyendo

- **Qué está en producción.** `SCH` ya contiene `estado`, folios y
  `firmas_documento`; por su nombre parece un `db pull`, pero no se comprobó
  contra la base. Tampoco si hay en producción algún disparador sobre
  `documentos` que no esté en el repo.
- **El orden real de claves al volver de `jsonb`** en estas filas, y por tanto si
  la alternativa de CI-DT-10 reconstruye las huellas viejas. Sólo se comprueba con
  filas reales.
- **Si ya se regeneró o borró algún sellado.** La consulta de CI-DT-1 da una
  primera respuesta; los borrados sólo constan como `DELETE` con id en
  `audit_log`.
- **Cuántas fotos huérfanas hay** en `identificaciones`: requiere listar el bucket
  con privilegios.
- **Si «Visualizar» del modal posterior queda auditado.** `ModalDocumentoGenerado`
  audita compartir y descargar; «Visualizar» es un enlace y no se siguió hasta el
  final.
- **Las notas clínicas tampoco tienen candado en la base:** `consultas` sólo tiene
  `audit_consultas` y una policy de UPDATE por autor (`SCH:2631, 2905-2913`). Está
  fuera de este archivo, pero contradice «las notas clínicas son inmutables» de
  `CLAUDE.md` si la app fuera el único freno; conviene revisarlo aparte.
- **El texto legal frente a la LFPDPPP vigente** (DOF 20/03/2025, reformada
  14/11/2025): no se revisó; es tarea legal.
- **El CSS del pie** (`spinus-tokens.css`) lo está editando otro agente; la
  referencia de CI-DT-17 puede moverse.
