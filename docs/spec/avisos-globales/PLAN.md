# Avisos globales — PLAN (fase 1)

Rama `feature/avisos-globales` (nace de `feature/integracion-rediseno-agenda`, `1d16ad0`).
Fecha: 2026-11-24. **Estado: plan a la espera del visto bueno del planificador. No hay código.**

Decisiones de Angel que este plan da por cerradas: (a) toda eventualidad avisa en campana y
burbuja; (b) la burbuja lleva el nombre del paciente; (c) campana y burbujas en toda la app;
(d) quien hace la acción no recibe su aviso; (e) lo que hace el personal en la agenda de un
médico avisa sólo a ese médico; (f) el «No» de Google cancela, avisa y manda correo.

Lo marcado **ASUMIENDO** no se comprobó todavía y se comprueba al empezar el paso que lo usa.

---

## 1. Las 19 eventualidades

«Hoy» está confirmado en el código (archivo:línea). `f1`…`f4` son las migraciones
`supabase/migrations/202612011[2-6]0000_agenda_f*.sql`.

### Paciente

| # | Eventualidad | Hoy (confirmado) | Dónde nace el aviso | Destinatario | Tipo | Ruido |
|---|---|---|---|---|---|---|
| 1 | Reserva por enlace | Aviso y burbuja. `trg_appointments_aviso_clinica` (f4:1287) | Igual | Clínica (quien ve la cita) | `reserva_enlace` (existe) | No |
| 2 | Confirma por su enlace | Aviso y burbuja. `trg_cita_confirmaciones_aviso_confirmacion` (f4:1256) | Igual | Clínica | `confirmacion_paciente` (existe) | No |
| 3 | «Sí» en Google | **Nada**: `cita_rsvp_google` (f2:973) sólo cambia el estado y audita `via='google_rsvp'` | Disparador NUEVO en `appointments` (AFTER UPDATE OF status) que lee `spinus.via = 'google_rsvp'` | Clínica | `confirmacion_paciente` (se reutiliza) | No: uno pendiente por cita |
| 4 | Cancela por su enlace | Aviso y burbuja. `trg_cita_confirmaciones_aviso_clinica` (f4:1249) | Igual | Clínica | `cancelacion_paciente` (existe) | No |
| 5 | «No» en Google | **Nada**: `aceptaronDe` sólo mira `accepted` (`src/lib/gcalRsvp.ts:27`) | El mismo disparador nuevo, con `via='google_rsvp'` y estado → cancelada (§4) | Clínica | `cancelacion_paciente` (se reutiliza) | No |
| 6 | Reagenda por su enlace | Aviso y burbuja. `trg_cita_reagendos_aviso_clinica` (f4:1262) | Igual | Clínica | `reagendado_paciente` (existe) | No |
| 7 | Lo frena el candado o un contacto bloqueado | **Nada, ni registro**: `reservar_por_enlace` devuelve `bloqueado` (f3:1204-1215) o `ya_tiene_cita` (f3:1216-1222) y la ruta sólo traduce (`src/app/api/reservar/[codigo]/route.ts:122-127`) | La RUTA, tras la RPC, llama a una RPC nueva y pequeña (sólo `service_role`). No se toca `reservar_por_enlace` (regla de J2: tras el contador nada puede lanzar) | El médico del enlace + administrador y secretaria | `reserva_frenada` (nuevo, sin cita) | **Sí** (lo provoca un anónimo). Uno pendiente por médico: los siguientes suben un contador y la hora. Burbuja sólo del primero |
| 8 | No responde y la cita está cerca | Lista «Por confirmar», sin burbuja (`/api/agenda/por-confirmar`) | Sin fila de aviso: sigue siendo la lista. Ver pregunta P2 | — | — | **Sí** si fuera uno por cita y por día |

### Google

| # | Eventualidad | Hoy (confirmado) | Dónde nace | Destinatario | Tipo | Ruido |
|---|---|---|---|---|---|---|
| 9 | Evento nuevo por asignar | Aviso y burbuja (f4:1287, marca `por_asignar`) | Igual | Clínica | `google_por_asignar` (existe) | No |
| 10 | Empalme de una reserva con un evento de Google | Aviso y burbuja (`trg_reserva_empalmes_aviso_clinica`, f4:1295) | Igual | Clínica | `empalme_google` (existe) | No |
| 11 | Mueven en Google una reservada por enlace y Spinus la regresa | Aviso sin burbuja (f4:1298) | Igual; se añade a la lista de burbujas | Clínica | `google_movimiento_rechazado` (existe) | Bajo: uno por cita, se refresca |
| 12 | Mueven en Google una cita normal | **Confirmado: nada.** `gcal_aplicar_evento` (f2:777-862, `spinus.via='google'`) cambia la hora; sólo queda `audit_log` | Disparador nuevo en `appointments` (UPDATE OF start_time, end_time) con `via='google'` | Clínica | `google_movio_cita` (nuevo) | Bajo. No se sabe QUIÉN la movió en Google: si fue el propio médico en su calendario, también le sale |
| 13 | Borran en Google una cita o evento | **Corregido:** Spinus NO borra; la **cancela y la desvincula** (`decidirBorrado`, `gcalSincronizacionDecidir.ts:309-322`; f2:832-850). Sin aviso | El mismo disparador (status → cancelada con `via='google'`). Sólo citas con paciente o por ligar; un evento sin paciente borrado en Google no avisa | Clínica | `google_cancelo_cita` (nuevo) | Bajo |
| 14 | Google se desconecta o falla la sincronización | **Corregido:** no es «nada». Con `invalid_grant` la conexión pasa a `revocada` (`gcalConexion.ts:541-595`); los fallos quedan en `gcal_sync_estado.errores_seguidos` (f2:336-339) y la agenda pinta la banda «No se pudo sincronizar con Google Calendar» (`AvisosAgenda.tsx:171-178`). En la campana, nada | Dos disparadores: en `clinica_conexiones_google` (estado `activa` → `revocada`) y en `gcal_sync_estado` (al cruzar 3 errores seguidos; **ASUMIENDO** una fila por clínica y que 3 es buen umbral para el ritmo de la tarea) | Clínica (todos) | `google_desconectado`, `google_sin_sincronizar` (nuevos, sin cita) | Uno pendiente por clínica y tipo |

### Sistema

| # | Eventualidad | Hoy (confirmado) | Dónde nace | Destinatario | Tipo | Ruido |
|---|---|---|---|---|---|---|
| 15 | Falla un correo al paciente | **Corregido:** queda `cita_correos.estado='fallido'` (`cita_correo_marcar`, f4:1000-1022) y nadie lo lee. El envío a mano sí avisa en pantalla a quien lo pulsó (`BotonCorreoCita.tsx:33`, `PanelReagendar.tsx:45`) | Disparador en `cita_correos` (UPDATE OF estado → `fallido`), sólo `comprobante` y `recordatorio`: los que nadie ve fallar. El manual ya lo ve quien lo mandó (decisión d) | Clínica (quien ve la cita) | `correo_fallido` (nuevo) | Uno pendiente por cita. Los correos que no pasan por `cita_correos` (código de verificación) quedan fuera |
| 16 | Se envió el recordatorio automático | Sólo `cita_correos` `enviado` y el log de la tarea (`cron/recordatorios/route.ts:69-75`) | Disparador en `cita_correos` (→ `enviado`, tipo `recordatorio`), **agrupado** | Médico de las citas + administrador y secretaria | `recordatorios_enviados` (nuevo, sin cita, con contador) | **Sí.** Uno pendiente por médico: «Se enviaron 6 recordatorios». Ver P2 |

### Personal

Confirmado: `appointments_insert/select/update` (`20260912190416_remote_schema.sql:2779-2793`) dejan
al médico sólo lo suyo y al administrador y a la secretaria toda la clínica. El navegador nunca
escribe `appointments` directo: todo pasa por las rutas. Dentro de un disparador el actor es
`auth.uid()` (así lo hace `log_cita_change`, f1:535).

| # | Eventualidad | Hoy | Dónde nace | Destinatario | Tipo |
|---|---|---|---|---|---|
| 17 | Secretaria o administrador agenda en la agenda de un médico | Nada | Disparador nuevo en `appointments` AFTER INSERT, sólo si `auth.uid()` no es nulo y es distinto de `medico_id` | Sólo ese médico | `personal_agendo` |
| 18 | Mueve o cancela una cita de ese médico | Nada | El mismo, AFTER UPDATE OF status, start_time, end_time. «Reagendar» escribe con `createAdminClient()` (`eleccionServidor.ts:58`), sin `auth.uid()`: ahí avisa la RUTA con la RPC pequeña de 7, pasando el actor | Sólo ese médico | `personal_movio`, `personal_cancelo` |
| 19 | Pone o quita un bloqueo | Nada. `agenda_bloqueos` tiene `created_by` y borrado físico (f5a:137-162) | Disparador en `agenda_bloqueos` AFTER INSERT OR DELETE, misma condición de actor. Los de Google (`service_role`) no avisan | Sólo ese médico | `personal_bloqueo`, `personal_desbloqueo` (sin cita; llevan inicio y fin) |

Con (d) y (e) juntas: el médico que actúa en su propia agenda no genera aviso para nadie, y el
personal nunca recibe el suyo porque el aviso va dirigido sólo al médico.

### Textos (campana · burbuja)

Desde (b) la burbuja dice lo mismo que la campana, con nombre. `N` = paciente ligado o el nombre
de la reserva; `A` = quien lo hizo; «cuándo» = «del jueves, 17 de diciembre a las 10:45», en la
zona del consultorio.

| Tipo | Texto |
|---|---|
| `reserva_enlace` | «N reservó por enlace para el [cuándo]» |
| `confirmacion_paciente` | «N confirmó su cita [cuándo]» (enlace o Google: mismo texto) |
| `cancelacion_paciente` | «N canceló su cita [cuándo]» |
| `reagendado_paciente` | «N reagendó su cita para el [cuándo]» |
| `reserva_frenada` | «Alguien intentó reservar por tu enlace y no pudo: ya tiene una cita o su contacto está bloqueado» (+ «· 3 intentos») |
| `google_por_asignar` | «Evento nuevo de Google por asignar: [título]» |
| `empalme_google` | «La reserva de N se empalma con un evento de Google» |
| `google_movimiento_rechazado` | el texto de Angel de la tanda J, sin cambio |
| `google_movio_cita` | «La cita de N se movió desde Google al [cuándo]» |
| `google_cancelo_cita` | «La cita de N [cuándo] se canceló porque se borró en Google» |
| `google_desconectado` | «Google Calendar se desconectó. Vuelve a conectarlo en la configuración» |
| `google_sin_sincronizar` | «La agenda lleva varios intentos sin sincronizar con Google Calendar» |
| `correo_fallido` | «No se pudo enviar el correo a N por su cita [cuándo]» |
| `recordatorios_enviados` | «Se enviaron 6 recordatorios de cita» (sin burbuja, P2) |
| `personal_agendo` | «A agendó a N en tu agenda para el [cuándo]» |
| `personal_movio` | «A movió la cita de N al [cuándo]» |
| `personal_cancelo` | «A canceló la cita de N [cuándo]» |
| `personal_bloqueo` / `personal_desbloqueo` | «A bloqueó tu agenda el [día] de [hora] a [hora]» / «A quitó un bloqueo de tu agenda del [día]» |

---

## 2. Modelo de datos

Hoy: `avisos_clinica (id, clinica_id, tipo, cita_id NOT NULL, creado_en, revisado_en, revisado_por)`,
CHECK de 7 tipos, único parcial `(tipo, cita_id) WHERE revisado_en IS NULL`, SELECT por clínica y
por «veo la cita», seis escritores DEFINER. Vacía o casi en producción (aplicada el 2026-11-23).

### Migración M1 — `…_avisos_globales_modelo.sql` (aditiva)

1. **Columnas nuevas, todas NULL y sin DEFAULT** (sólo metadatos, sin reescribir la tabla):
   - `destinatario_id uuid`: NULL = toda la clínica (lo de hoy); con valor, sólo ese médico.
   - `actor_id uuid`: quién lo hizo (atribución, sin FK, como `revisado_por`).
   - `medico_id uuid`: el dueño de la agenda en los avisos SIN cita (7, 16, 19).
   - `datos jsonb`: sólo contadores y horas (`{intentos}`, `{enviados}`, `{inicio, fin}`). Nada de
     personas. El convenio va en `COMMENT ON COLUMN` (dimensión 16).
2. `cita_id` pasa a admitir NULL (`DROP NOT NULL`, sólo metadatos), con CHECK: los tipos sin cita
   no llevan cita y los demás sí.
3. `avisos_clinica_tipo_check` se sustituye por el de 19 tipos (DROP + ADD en la misma
   transacción; valida una tabla diminuta). El código viejo tolera tipos desconocidos
   (`conTipoConocido`, `avisosServidor.ts`): **orden seguro = migración primero, código después**.
4. Índice único nuevo para los avisos sin cita: uno pendiente por `(clinica_id, tipo,
   coalesce(medico_id, cero))` `WHERE cita_id IS NULL AND revisado_en IS NULL`. Con él agrupan 7,
   14 y 16 (`ON CONFLICT … DO UPDATE` sube el contador y la hora). El índice de hoy no se toca.
5. **Policies** (`avisos_clinica_select` y `_update` se recrean en la misma transacción):
   ```
   clinica_id = get_clinica_id()
   AND (destinatario_id IS NULL OR destinatario_id = auth.uid())
   AND actor_id IS DISTINCT FROM auth.uid()
   AND ( (cita_id IS NOT NULL AND EXISTS (cita visible en appointments, como hoy))
      OR (cita_id IS NULL AND (medico_id IS NULL OR medico_id = auth.uid()
                               OR soy_admin_de_clinica() OR get_my_role() = 'secretaria')) )
   ```
   **Sin recursión (dimensión 19):** lee `appointments` y helpers DEFINER sobre `profiles`; nunca
   `avisos_clinica`. Con las columnas nuevas en NULL equivale exactamente a la de hoy, así que el
   código viejo ve lo mismo. Un aviso dirigido no lo ve ni el administrador.
6. **Escritores nuevos** (DEFINER de `postgres`, `search_path` vacío, `RETURNS trigger`):
   - `aviso_clinica_de_cambio_cita()` en `appointments`: AFTER INSERT (17) y AFTER UPDATE OF
     `status, start_time, end_time` (3, 5, 12, 13, 18), con `WHEN` estrecho para no dispararse en
     lo que no importa (dimensión 21). Sólo con `agenda_v2_encendida(clinica_id)`.
   - `aviso_clinica_de_bloqueo()` en `agenda_bloqueos` (19).
   - `aviso_clinica_de_correo()` en `cita_correos` (15 y 16).
   - `aviso_clinica_de_conexion_google()` y `aviso_clinica_de_sync_google()` (14).
   - **Un aviso nunca impide una escritura:** cada INSERT de aviso va en su subbloque
     `BEGIN … EXCEPTION WHEN OTHERS THEN NULL`. Un defecto aquí no puede dejar a nadie sin agendar.
   - RPC `aviso_clinica_registrar(p_clinica_id, p_tipo, p_cita_id, p_medico_id, p_actor_id)`:
     DEFINER, `search_path` fijo, EXECUTE **sólo `service_role`** (dimensión 24), lista blanca de
     dos tipos (`reserva_frenada`, `personal_movio`), comprueba que médico y cita son de esa
     clínica. La llaman las rutas con `createAdminClient()` y `clinica_id` explícito.
   - Los seis escritores de hoy y `reservar_por_enlace` **no se tocan**.
7. **Realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.avisos_clinica` (§3), con
   pre-vuelo de propiedad de la publicación (dimensión 11).
8. Permisos de fábrica (20), sin TRUNCATE, post-vuelo y **un solo SELECT final** (5 y 18).

**«Revisado» por usuario:** los avisos dirigidos (17-19) son de una sola persona, así que su
`revisado_en` ya es personal. Para los de toda la clínica propongo **dejarlo como hoy** (lo revisa
uno y sale de la campana de todos: decisión de la tanda I). La alternativa, una tabla
`avisos_vistos (aviso_id, usuario_id)`, es otra tabla con RLS, una FK que vigilar (dimensión 30) y
reescribir los seis escritores para que un evento nuevo «reabra» lo ya visto. Es la pregunta P1.

### Migración M2 — `…_rsvp_google_rechazo.sql` (§4)

Una función NUEVA, `cita_rsvp_google_rechazo`. No reemplaza nada.

**Total: 2 migraciones**, cada una con reversa en `supabase/reversas/`, prueba en
`supabase/pruebas-sql/`, fila en `mejora_agendaV2.md` §7 y línea en `scripts/agenda-semilla.ts` si
hiciera falta (no hay tabla nueva colgada de `clinicas`).

### Riesgo según `AUDITORIA-MIGRACIONES.md`

| Dim. | M1 | M2 |
|---|---|---|
| 6/29 Candados | `CREATE TRIGGER` en `appointments`, `agenda_bloqueos`, `cita_correos`, `clinica_conexiones_google`, `gcal_sync_estado` (SHARE ROW EXCLUSIVE breve). Todo junto al final, en un bloque `DO`, como F4 | Ninguno (sólo catálogo) |
| 7 Destructividad | Ninguna: no borra ni reescribe filas. Reversa: quita disparadores, funciones, publicación, policies de vuelta a las de F4, CHECK de 7 (se niega si hay filas de tipos nuevos sin revisar: guarda de sólo lectura, dimensión 31) | `DROP FUNCTION` |
| 8 Constraints | CHECK nuevos contra filas existentes: todas cumplen (7 tipos, con cita). Conteo de sólo lectura para Angel | — |
| 10/30 Aislamiento | Policy con `clinica_id` y helpers; la RPC comprueba la clínica de médico y cita. Prueba en `cb_aislamiento_clinicas.sql` | Filtra por `p_clinica_id` |
| 12 Ventana | Migración primero. Código nuevo contra esquema viejo: tolerado (42703 → lectura de antes) | Código nuevo sin la función: PGRST202 → no hace nada, como hoy |
| 17 Otros caminos | `authenticated` sigue sin INSERT; `service_role` sin privilegios de tabla; la única puerta nueva es la RPC | Sólo `service_role` |
| 21 Rendimiento | Un disparador más por alta/cambio de cita, con `WHEN`; dentro, una lectura de `agenda_ajustes` por PK y un INSERT. La policy añade comparaciones de columna, no subconsultas nuevas | — |
| 22 Conjunto | No reescribe ninguna función existente | No reescribe `cita_rsvp_google` |

Riesgo global: **M1 medio** (disparador nuevo en `appointments` y policies recreadas), **M2 bajo**.

---

## 3. Campana global

**Dónde se monta.** En `src/app/(app)/layout.tsx`, fuera de `<main>`, junto a `SessionGuard` (lo
de ahí «no se desmonta al navegar y no vuelve a pedir nada», layout:201-205), dentro del
`ToastProvider` que ya existe (layout:148). El botón va en el `Sidebar` (y en el encabezado del
teléfono), que también persiste. **ASUMIENDO** que cabe ahí sin maqueta nueva: su sitio exacto lo
enseño en una captura antes de darlo por bueno.

**Viajes.**
- Navegación suave: **cero** (el layout no se vuelve a renderizar).
- Carga completa: el layout añade la lectura del interruptor `agenda_v2_encendida` a su
  `Promise.all` (una consulta por PK, sin viaje a Auth). Apagada: no se monta nada ni baja el
  chunk (`next/dynamic`), la app es la de antes (falla cerrado).
- La lista: UNA lectura desde el navegador con el cliente de sesión, bajo RLS (el patrón de
  `leerAgendaV2` en `ProximasCitas.tsx:70-78`), en tiempo ocioso. **No** se usa `GET /api/avisos`
  para esto: cada llamada cuesta `getUser()` + perfil + ajustes (3 viajes, uno a Auth). Es una
  decisión de «dejar pasar» y la barrera es la RLS, conforme a «Autoridad de sesión».
- Revisar: el `PATCH /api/avisos` de hoy (un clic, poco frecuente).

**Cómo se entera con la página abierta: Realtime, no sondeo.**
- Hoy sólo existe `appointments-realtime` (`useTiempoRealAgenda.ts:124`), sólo mientras la agenda
  está montada (+2 min). `avisos_clinica` no está en la publicación.
- Propuesta: un segundo canal `avisos-realtime` (misma conexión; supabase-js multiplexa), filtrado
  por `clinica_id`. Realtime aplica la RLS: a cada quien le llegan sólo sus filas. Al llegar un
  INSERT o UPDATE se relee la lista (un viaje) y sale la burbuja.
- Red de seguridad: releer al volver a la pestaña (`visibilitychange`, tope 120 s). Sin `setInterval`.
- Costo: una conexión abierta por pestaña y cero peticiones mientras no pase nada. Un sondeo cada
  60 s serían 60 peticiones por hora y pestaña. **ASUMIENDO** que el cupo de conexiones
  simultáneas del plan de Supabase aguanta una por pestaña abierta; si no, la alternativa es el
  sondeo ligero cada 2 min.

**Convivencia con la agenda (sin burbujas dobles).** En `/agenda` la campana de siempre
(`CampanaAgenda`, con «Por confirmar» y sus acciones) se queda como está y la global no se pinta
ni lanza burbujas (`usePathname`). Fuera de la agenda manda la global. Las dos usan
`avisosParaEmergente`, cuya primera lista «sólo se apunta»: al cambiar de página no se repite una
burbuja ya vista. Sin contexto ni proveedor nuevos (Protocolo 4): se reutilizan
`useAvisosClinica` y `ListaAvisos`, que ya se escribieron para esto.

La campana global enseña sólo «Avisos». «Por confirmar» sigue en la agenda (su lectura son 4+
consultas y sus acciones dependen de la agenda). Ver P2.

---

## 4. El «No» de Google

- **`src/lib/gcalRsvp.ts`:** junto a `aceptaronDe`, `rechazaronDe` (mismos filtros: ni organizador,
  ni la propia cuenta, ni recursos). `confirmarPorRsvps` (`gcalSincronizacion.ts:349-364`) hoy
  salta lo que no esté `scheduled`; para el «No» valen `scheduled` y `confirmed`.
- **Base (M2):** `cita_rsvp_google_rechazo(clinica, cita, calendario, evento, correos[])`, INVOKER,
  sólo `service_role`, calcada de `cita_rsvp_google`: mismo evento y calendario de la conexión
  activa, v2 encendida, cita con paciente o por ligar, **futura** (hora real tras el candado),
  estado `scheduled` o `confirmed`, y el correo que rechazó es `pacientes.email` o `reserva_correo`
  de ESA cita. Pone `spinus.via = 'google_rsvp'` (ya está en la lista blanca de `log_cita_change`:
  no hace falta literal nuevo) y cancela. Devuelve `cancelada` + correo y nombre para el saludo, o
  `sin_cambio`.
- **Límite de reservas:** no hay que hacer nada. `trg_appointments_reserva_incidencia` (f3:622-626)
  registra la incidencia en CUALQUIER paso a cancelada de una cita por enlace, «lo escriba quien lo
  escriba». Cuenta exactamente igual que la cancelación por enlace (y, como ella, sólo en citas
  reservadas por enlace).
- **Aviso:** el disparador de M1 (`via='google_rsvp'` + cancelada → `cancelacion_paciente`).
- **Correo:** plantilla nueva en `plantillaCita.ts` («Tu cita fue cancelada porque indicaste que no
  asistirás. Si fue un error, agenda de nuevo»), por `src/lib/correo/transporte.ts`, a nombre del
  médico, nada clínico. Se manda sólo cuando la RPC devuelve `cancelada`.
- **Idempotencia:** la transición ocurre una vez, bajo `FOR UPDATE`; las pasadas siguientes ven la
  cita cancelada y devuelven `sin_cambio` (ni correo ni aviso de más). **ASUMIENDO** que el
  transporte admite llave de idempotencia (devuelve `duplicado`); si no, un reintento de la pasada
  tras un corte podría no reenviar: el fallo queda en el log y la cancelación no se pierde.
- **El evento en Google:** se trata como en la cancelación por enlace (misma rutina que usa
  `/api/confirmar` tras `cancelada`). **ASUMIENDO** que es reutilizable desde la pasada.
- **Si después cambia a «Sí»:** nada. `cita_rsvp_google` sólo confirma lo `scheduled`, y una
  cancelada no se reabre (regla de G: «Reagendar crea OTRA cita»). El correo ya le dice que
  agende de nuevo.
- **ASUMIENDO** que `declined` llega por `syncToken` igual que `accepted` (probado hoy sólo el
  «Sí»). Sigue detrás de `AGENDA_RSVP_GOOGLE=encendido`. Lo prueba Angel con su cuenta real.

---

## 5. Privacidad

- **En burbuja y campana:** nombre del paciente (decisión de Angel), qué pasó, día y hora, y el
  nombre de quien lo hizo en los del personal.
- **Nunca:** tipo de cita, motivo, observaciones (`notes`), teléfono, correo, nada del expediente,
  ni el motivo escrito de un bloqueo. `datos` sólo lleva contadores y horas. En `reserva_frenada`
  no va el nombre de quien lo intentó (P3). El correo del «No» no lleva nada clínico.
- **Qué ve cada rol:** médico invitado, los avisos de SUS citas y los dirigidos a él;
  administrador y secretaria, los de toda la clínica; un aviso dirigido, sólo su médico. Entre
  clínicas, nada (RLS con `clinica_id`).
- A tener presente: fuera de la agenda la burbuja puede salir con un paciente delante de la
  pantalla (en plena consulta) y lleva el nombre de otro paciente. Es consecuencia directa de (b)
  y (c); queda dicho, no se reabre.
- Sentry y logs: los textos de aviso no se registran; `audit_log` no se toca
  (`audit_avisos_clinica` sigue registrando cada alta, sin valores).

---

## 6. Orden de entrega

Un push por paso, con Vitest, lint y build en verde. Cada paso lista sus archivos antes de tocar.

| Paso | Qué | Migración | Pruebas | Lo ensaya Angel |
|---|---|---|---|---|
| 1 | Burbuja con nombre (`textoEmergente`) y `google_movimiento_rechazado` con burbuja | No | Vitest de textos | No |
| 2 | Campana global para los 7 tipos de hoy: montaje en el layout, lectura directa, relectura al volver a la pestaña; oculta en `/agenda` | No | Vitest + e2e (sale fuera de la agenda; ninguna burbuja doble; v2 apagada: no hay nada) | No. Se ve en el preview |
| 3 | **M1** + reversa + prueba SQL; código de los tipos nuevos, tolerante al esquema viejo | **M1** | `supabase/pruebas-sql/av1_*.sql` (cada evento, actor excluido, dirigido, aislamiento, v2 apagada, el aviso que falla no impide la cita); `p1_permisos_funciones`; `db reset --local` | **Sí:** clon de estructura, aplicar-deshacer-aplicar, auditoría independiente, conteos, `aplicar.sh` |
| 4 | Realtime de avisos en la campana global | (va en M1) | e2e con dos sesiones | No |
| 5 | Rutas que avisan con la RPC: reserva frenada (7) y «Reagendar» del personal (18) | No | Vitest de rutas + e2e | No |
| 6 | **M2** + «No» de Google + correo | **M2** | `e9b_rsvp_rechazo.sql`, `gcalRsvp.test.ts`, plantilla, e2e con el Google falso | **Sí** (M2) y la prueba con Google real |
| 7 | Documentación: reglas nuevas en `CLAUDE.md`, `mejora_agendaV2.md` §7, `DEUDA_TECNICA.md` | No | — | — |

Los pasos 1 y 2 funcionan contra la producción de hoy. Del 3 en adelante el código nuevo es
inerte hasta que Angel aplique la migración.

---

## 7. Preguntas para Angel

| # | Pregunta | Recomendación |
|---|---|---|
| P1 | Un aviso de toda la clínica (p. ej. «Fulano confirmó»), ¿desaparece para todos cuando uno lo revisa, como hoy, o cada persona revisa el suyo? | **Como hoy.** Los dirigidos a un médico ya son personales. «Cada quien el suyo» pide otra tabla y reescribir los seis escritores actuales |
| P2 | Recordatorios enviados (16) y citas sin confirmar (8): ¿una burbuja por cada uno? | **No.** 16: un solo aviso agrupado en la campana, sin burbuja. 8: se queda como la lista «Por confirmar» de la agenda. Uno por cita serían decenas al día |
| P3 | Reserva frenada (7): ¿el aviso dice quién lo intentó? | **No.** Guardar nombre y teléfono de alguien a quien no se le dio cita es dato personal sin necesidad, y cualquiera puede escribir un nombre ajeno |
| P4 | El «No» de Google, ¿vale hasta el último minuto o, como el enlace, sólo hasta 1 hora antes? | **Cualquier cita futura.** El paciente ya dijo que no va; más vale saberlo aunque sea tarde |
| P5 | Fuera de la agenda, ¿la campana enseña sólo «Avisos» y «Por confirmar» sigue en la agenda? | **Sí**, por los viajes de red |

---

## 8. Resultados de M1 en local (2026-11-24)

Stack local de Supabase (CLI 2.117.0, Docker) con las 14 migraciones anteriores y la semilla.

- **Ensayo:** ida (rejilla 8/8 OK) → reversa (5/5) → segunda pasada de la reversa (no hace nada) →
  ida otra vez (8/8) → segunda ida: aborta en el pre-vuelo sin cambiar nada. Con un aviso de la
  forma nueva ya escrito, la reversa sólo quita escritores y publicación y lo dice (REVISAR).
- **Pruebas SQL:** `supabase/pruebas-sql/av1_avisos_globales.sql` (15 casos) y la batería entera,
  49 archivos en verde con M1 aplicada.
- **Costo del disparador en `appointments`** (`supabase/pruebas-sql/medicion/av1_tiempos.sql`; 300
  operaciones por caso, tres corridas, ms por operación, sesión de la persona, v2 encendida):

  | Quién | Operación | Antes de M1 | Con M1 |
  |---|---|---|---|
  | Médico en su propia agenda (no escribe aviso) | alta | 1,14 – 1,19 | 1,17 – 1,40 |
  | | mover | 1,30 – 1,74 | 1,32 – 1,51 |
  | | cancelar | 1,18 – 1,32 | 1,23 – 1,29 |
  | Secretaria en la agenda de un médico (escribe aviso) | alta | 1,37 – 1,48 | 1,55 – 1,65 |
  | | mover | 1,65 – 1,79 | 1,88 – 2,05 |
  | | cancelar | 1,50 – 1,60 | 1,83 – 2,00 |

  Para el médico en su agenda la diferencia queda dentro del ruido; cuando sí se escribe el aviso,
  +0,2 a +0,4 ms por operación. Es tiempo de base en una máquina local, no de petición completa.
- **Realtime y RLS** (`scripts/local/avisos-realtime-rls.mjs`, cuatro sesiones suscritas): en 4
  corridas nadie recibió un aviso que la RLS no le deja leer (ni la otra clínica, ni un aviso
  dirigido a otro). Dos cosas a saber: (1) en la primera corrida un suscriptor NO recibió un aviso
  que sí le tocaba (arranque de la suscripción): por eso la relectura cada 2 min se queda como
  red de seguridad y como alternativa sin migración; (2) los DELETE llegan a todos los suscritos,
  también de otra clínica, con la llave primaria nada más: en la app nadie borra avisos.
- **Canal que usa hoy la agenda** (confirmado en `useTiempoRealAgenda.ts:124-131`):
  `appointments-realtime`, `postgres_changes` de `public.appointments`, todos los eventos, sin
  filtro; es el único `.channel(` de `src/`.
