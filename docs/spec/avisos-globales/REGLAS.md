# Avisos globales — reglas que un editor futuro no debe romper

Bloque «avisos globales» (rama `feature/avisos-globales`, 2026-11-24/25). Plan y decisiones:
`PLAN.md` (§10 manda). Migraciones: `20261202120000_avisos_globales_modelo.sql` (M1) y
`20261202130000_avisos_globales_rsvp_rechazo.sql` (M2), **sólo escritas**: las aplica Angel.

> **Para `CLAUDE.md`, todavía no.** Este archivo está escrito para pegarse como sección «Avisos
> globales» de `CLAUDE.md`. Decisión de Angel (2026-11-25): se pega cuando M1 y M2 estén aplicadas en
> producción y el bloque fusionado. Hasta entonces vive aquí.

* **Toda eventualidad de la agenda avisa en la campana y en la burbuja, con el nombre del paciente**
  (decisión de Angel). `textoEmergente` dice lo mismo que `textoAviso`. Nada clínico: ni tipo de
  cita, ni motivo, ni observaciones, ni teléfono, ni correo, ni el motivo de un bloqueo.
  Excepciones decididas: el recordatorio ENVIADO no avisa; «Por confirmar» sigue siendo una lista.
* **La campana vive en toda la app** (`CampanaGlobal`, en `(app)/layout.tsx`, fuera de `<main>`),
  sólo con la agenda v2 encendida (falla cerrado). **En `/agenda` se calla**: ahí manda
  `CampanaAgenda`. Dos campanas vivas a la vez repetirían cada burbuja. Las burbujas salen SÓLO de
  la campana (`useAvisosClinica`): no vuelvas a poner un `toast` propio por un aviso (E8 y D11 lo
  tenían, sin nombre, y se quitaron).
* **La campana global no pasa por `/api/avisos`**: lee y marca directo desde el navegador, con la
  sesión y bajo RLS (`leerAvisosClinica` y `marcarAvisosRevisados` de `avisosServidor.ts`, que por
  eso no importa nada de servidor). Es «dejar ver», no un redirect: la barrera es la RLS. Su botón
  va por portal a las ranuras `[data-ranura-campana]` de la navegación.
* **Se entera de lo nuevo releyendo cada 2 minutos con la pestaña a la vista y al volver a ella**
  (`SONDEO_MS`, que no puede ser mayor que `AVISO_RECIENTE_MS`). **Sin Realtime, por decisión de
  Angel (rendimiento):** `avisos_clinica` NO está en la publicación `supabase_realtime` y no debe
  entrar sin decidirlo de nuevo (una conexión abierta por pestaña en toda la app, y los DELETE de una
  publicación llegan a todo suscrito sin pasar por la RLS).
* **«Revisado» es POR USUARIO** (`avisos_vistos`). Pendiente para mí = sin fila mía, o
  `visto_en < creado_en`. Se lee con `avisos_pendientes` (INVOKER). `revisado_en`/`revisado_por`
  significan «cerrado para todos» y el código nuevo ya no los escribe. **No metas «no visto por mí»
  en la policy de `avisos_clinica`**: `avisos_vistos_insert` lee `avisos_clinica` y habría un ciclo
  de RLS.
* **Un hecho nuevo del mismo tipo y cita REABRE el aviso** (no crea otro):
  `trg_avisos_clinica_reabrir`, BEFORE INSERT, refresca `creado_en` con la hora real y se salta el
  alta. Por eso los seis escritores de F4 reabren sin tocarlos y `creado_en` es «último hecho», no
  «cuándo nació». En el cliente la llave de «ya avisé» es `id@creado_en`. No quites el disparador
  creyéndolo redundante con el `ON CONFLICT`. Excepción: `paciente_no_asistira` avisa una sola vez.
* **Quién ve qué:** el médico invitado, los avisos de SUS citas y los dirigidos a él; administrador y
  secretaria, los de la clínica; un aviso DIRIGIDO (`destinatario_id`), sólo su médico, ni el
  administrador; quien lo hizo (`actor_id`) nunca ve el suyo. Lo impone la policy, no el código.
* **Lo que hace el personal en la agenda de un médico avisa SÓLO a ese médico**
  (`aviso_clinica_de_cambio_cita`, `aviso_clinica_de_bloqueo`). El médico en su propia agenda no
  avisa a nadie. El actor es `auth.uid()`: una ruta que escriba con `createAdminClient()` no lo
  trae y tiene que avisar ella con `registrarAvisoDelServidor` (como «Reagendar»).
* **Un aviso nunca impide una escritura.** En las cinco funciones de disparador de M1 y en
  `aviso_clinica_reabrir` (que corre DENTRO de los seis escritores de F4: reserva por enlace,
  confirmación, cancelación y reagendado del paciente, lo de Google), TODO lo que puede fallar va
  dentro de un `BEGIN … EXCEPTION WHEN OTHERS` con `RAISE WARNING` (tipo y SQLSTATE, sin datos): leer
  la sesión (`auth.uid()`), el interruptor (`agenda_v2_encendida`) y el alta o el refresco. No saques
  nada de ese subbloque (tampoco al `DECLARE`), no lo quites ni lo dejes en silencio. Lo prueban el
  caso 9 de `av1` y `av3_avisos_no_impiden.sql`.
* **Los `WHEN` de los disparadores de avisos sólo comparan columnas.** Nada de `auth.uid()` ni de otra
  función ahí: un fallo en un `WHEN` no lo atrapa nadie y abortaría la cita (lo exige el post-vuelo de
  M1). Quién escribe se mira dentro de la función. Lo que por naturaleza no se atrapa: la cancelación
  de la sentencia (`statement_timeout`, 57014) y la caída de la sesión.
* **`aviso_clinica_reabrir` no espera a nadie:** si ya hay un aviso sin cerrar, lo refresca con
  `FOR UPDATE SKIP LOCKED` y SE SALTA el alta, lo haya refrescado o no. No lo cambies a «si no pude
  refrescar, que siga el alta»: el `INSERT … ON CONFLICT DO NOTHING` de F4 espera a la otra
  transacción (medido: 3 s frente a 0,09 s). Cada refresco deja su fila en `audit_log` (acción,
  tabla e id, sin valores), a propósito.
* **La lectura de la campana está ACOTADA** (`avisos_pendientes`): sólo avisos de los últimos **60
  días** (por `creado_en`, que el reabrir renueva) y, de esos, los **500** más nuevos que la RLS deja
  ver. Lo más viejo no se borra ni se cierra: se queda como registro. No quites la ventana ni el tope:
  el código nuevo ya no cierra avisos y sin ellos cada relectura recorre todos.
* **Lo que la lectura acotada deja fuera se DICE, no se oculta:** `avisos_mas_antiguos` (más de 500
  recientes, o alguno sin ver de entre 60 y 120 días) y el tope de la respuesta (`TOPE_AVISOS`) ponen
  `mas_antiguos` en `RespuestaAvisos`; las dos campanas pintan `TEXTO_MAS_ANTIGUOS` (`ListaAvisos`) y
  su contador lleva «+» («3 o más sin revisar»). No quites la nota ni des el número por exacto.
  `av4_policies_como_f4.sql` vigila que las policies de M1, con las columnas nuevas en NULL, dejen ver
  y marcar las mismas filas que las de F4.
* **El `OFFSET 0` del `EXISTS` de las policies de `avisos_clinica` no es ruido,** ni la subconsulta
  escalar de `avisos_pendientes`: obligan a buscar la cita y la marca de CADA aviso por su llave. Sin
  ellos Postgres lee de una vez todas las citas de la clínica y todas las marcas del usuario (medido:
  120–250 ms con 21 000; con ellos, 2–22 ms, igual con 1 200 que con 21 000;
  `supabase/pruebas-sql/medicion/av1_campana.sql`).
* **La reversa de M1 con datos no borra avisos: conserva la forma de M1, y la ida de M1 se puede
  volver a aplicar desde ahí** (su pre-vuelo reconoce ese estado y completa lo que falta). La sección
  2 de M1 está escrita con `IF [NOT] EXISTS` para eso: no la «limpies».
* **M1 y su reversa piden TODOS sus candados al principio y en el orden de los escritores** (tablas de
  origen → `avisos_clinica` → `avisos_vistos`). No muevas un `ALTER`/`DROP`/`CREATE TRIGGER` por delante
  de ese `LOCK`.
* **Los avisos los escribe sólo la base** (disparadores DEFINER) y `aviso_clinica_registrar` (sólo
  `service_role`, lista blanca de tres tipos, comprueba la clínica de médico, cita y actor, y que el
  médico de una reserva frenada tenga rol de médico). Un tipo
  nuevo exige migración, y va en el CHECK antes que en `TIPOS_AVISO`.
* **El único dato de persona en `avisos_clinica.datos` es el nombre tecleado en `reserva_frenada`**
  (120 como mucho; lo impone un CHECK). Ni teléfono ni correo. Puede no ser real.
* **El «No» de Google** (`cita_rsvp_google_rechazo`, detrás de `AGENDA_RSVP_GOOGLE`): con más de 1
  hora cancela, avisa y manda el correo (`correoCancelacionPorRsvp`, una vez, con llave por cita, con el
  enlace de reserva del médico sólo si ABRE: `enlaceDeReservaDelMedico` en `gcalRsvpRechazo.ts`); en
  la última hora NO cancela y deja «indicó que no asistirá». El umbral es el del enlace de
  confirmación, copiado: si cambia `cita_confirmacion_responder`, cambia esta función (lo vigila
  `av2_rsvp_rechazo.sql`, caso 8) y `PLAZO_CANCELAR`. Una cancelada no se reabre con un «Sí».
* **«Solo mis avisos» / «Toda la clínica»** es del médico administrador y vive en el navegador
  (`spinus.avisos.solo-mios`). Filtra lo que ya llegó; no marca nada como visto.
* **`avisosServidor.ts` atiende las DOS formas de la base** (con M1 y sin ella). No quites la rama de
  antes mientras M1 no esté aplicada en producción.
