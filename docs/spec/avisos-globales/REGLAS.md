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
* **Un aviso nunca impide una escritura.** Cada alta de aviso de los disparadores va en su
  `BEGIN … EXCEPTION WHEN OTHERS` con `RAISE WARNING` (tipo y SQLSTATE, sin datos). No lo quites ni
  lo dejes en silencio.
* **Los avisos los escribe sólo la base** (disparadores DEFINER) y `aviso_clinica_registrar` (sólo
  `service_role`, lista blanca de tres tipos, comprueba la clínica de médico, cita y actor). Un tipo
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
