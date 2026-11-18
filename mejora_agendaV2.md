# mejora_agendaV2 — Plan de mejora de la agenda y calendario de Spinus

> **Para quien orqueste este trabajo.** Este archivo es todo el contexto que
> tienes: la conversación donde se armó no viaja contigo. Léelo completo, y lee
> `CLAUDE.md` del repo completo, antes de tocar nada. Si algo de aquí contradice
> a `CLAUDE.md`, manda `CLAUDE.md`, salvo las excepciones que Angel haya
> autorizado por escrito en su mensaje de arranque.
>
> **Origen:** diagnóstico hecho leyendo el código de `ancona31/app_ortointegra`
> el 2026-11-10/11, sobre `main` en el commit `a58419f`. No se cambió código.
> **Nada se midió en producción**: las causas de lentitud salen de leer el
> código. Los números de línea pueden haberse movido; compruébalos.

---

## 1. Objetivo

Dejar una agenda fluida y pulida, al nivel de Google Calendar, Fantastical o
Notion Calendar, que:

1. Abra y cargue rápido (la queja principal es la espera **al abrir la agenda y
   cargar los eventos**).
2. Agende citas ligadas a un paciente y a un médico de la aplicación, y conserve
   los eventos sin paciente (cirugía, junta, comida).
3. Permita reservar por enlace, estilo Calendly, sin crear expedientes basura.
4. Sincronice con Google en los dos sentidos, sin pedir permisos sensibles.
5. Mande recordatorios por correo.

**Restricción dura: no se pierde ninguna función que la agenda tenga hoy.**

---

## 2. Decisiones ya tomadas por Angel (no volver a preguntar)

| Tema | Decisión |
|---|---|
| Rehacer o reutilizar | **Reutilizar.** Se conserva FullCalendar y el código actual; se parte el archivo grande de forma gradual |
| Columnas por médico lado a lado | **Fuera del proyecto** |
| Empalmes dentro de la app | **No se bloquean.** Se muestra un modal de alerta que dice con qué cita se empalma, y el usuario decide |
| Empalmes por enlace de reserva | **Sí se bloquean**: solo se ofrecen horarios libres |
| Reserva por enlace: quién puede | Cualquiera con el enlace; puede ser alguien que aún no es paciente |
| Estado de esa reserva | Queda **agendada al instante**, sin aprobación previa |
| Paciente de esa reserva | La cita guarda nombre, teléfono y correo, **sin crear paciente**. Al iniciar la consulta el médico la liga a un paciente existente o crea uno |
| Tipo de enlace | **No público** (no listado, con código imposible de adivinar). Dos clases: **uno fijo por médico** y **enlaces de un solo uso** |
| Consultorio en la reserva | Si el médico tiene varios, quien reserva **elige consultorio** |
| Pago anticipado | No, por ahora |
| Google | Se mantiene el permiso actual (`calendar.app.created`) y el calendario aislado «Spinus». **No** se piden permisos sensibles ni se entra en verificación |
| Google de vuelta | Lo que se mueva, edite o cancele en Google sobre el calendario Spinus **vuelve a Spinus** |
| Eventos creados en Google | Entran a Spinus como filas reales: **editables desde Spinus** (título, hora, observaciones, cancelar) y **convertibles en cita** ligándolos a un paciente |
| Conflicto de edición | **Gana el último cambio**, y queda en auditoría |
| Observaciones de una cita con paciente | **Se quedan en Spinus.** No viajan a Google. Las de eventos sin paciente sí viajan |
| Médicos invitados | Sin cambios: el calendario es de la clínica (cuenta del médico responsable) y los invitados reciben la invitación en su propio Google |
| Recordatorios | **Solo por correo.** Nada de WhatsApp ni SMS |
| Eventos sin paciente | **Se quedan** |
| Confirmación de asistencia | El paciente confirma o cancela desde un enlace único de su cita. Confirmar pasa la cita de agendada a **confirmada**; «no podré asistir» la pasa a **cancelada** |
| Cancelación por el paciente | **Libera el horario al instante** y avisa a la clínica |
| Cambio de opinión | Puede cancelar aunque ya hubiera confirmado, **hasta 1 hora antes** de la cita. Después, el enlace ya no cancela |
| Reagendar | La página de «no podré asistir» **ofrece elegir otro horario** con el enlace de reserva del médico |
| Correos | **Dos:** uno al agendar (comprobante) y otro 24 horas antes (pide la confirmación) |
| WhatsApp | **Solo manual, sin API:** botón que abre WhatsApp con el mensaje y el enlace ya escritos; la persona pulsa enviar. **Prohibido** automatizar WhatsApp Web con librerías no oficiales (riesgo de bloqueo del número y de privacidad) |
| Creación rápida | Clic en un hueco abre una **burbuja** (paciente, hora, Guardar) con «Más opciones» hacia el modal completo, que se conserva |
| Clic en una cita | Abre una **tarjeta de lectura** con acciones (Confirmar, Iniciar consulta, Reagendar, Cancelar, Editar), en vez de ir directo a la edición |

### Candado contra quien agenda y cancela repetidamente — APROBADO por Angel

Aplica solo a la reserva por enlace; el personal de la clínica siempre puede
agendar a quien quiera. La persona se identifica por teléfono y correo
normalizados, por médico.

| Regla | Valor |
|---|---|
| Citas futuras activas por persona y médico | 1 |
| Veces que se puede reagendar una misma cita | 2 |
| Cancelaciones o inasistencias que cierran el autoservicio | 3 en 60 días |
| Qué ve la persona bloqueada | «Para agendar, comunícate con el consultorio», con el teléfono |
| Cómo se levanta | Solo, al pasar los 60 días; o a mano por el médico o la secretaria |
| Enlace de un solo uso emitido por la clínica | Se salta el candado |
| Verificación del correo con código antes de reservar | Sí, en el enlace fijo |
| Límite de intentos por dispositivo y red | Sí |
| Visibilidad para la clínica | Marca en la cita con el historial («3 cancelaciones») y lista de contactos bloqueados |

No es infranqueable: alguien puede usar otro correo y otro teléfono. El código
al correo y el límite por dispositivo lo encarecen; el bloqueo manual cubre el
resto.

### Ajustes editables por clínica — decidido por Angel

Estos cuatro valores **no van fijos en el código**: cada clínica los elige en la
pantalla de configuración del calendario. Lo de la tabla es el valor de fábrica
con el que nace una clínica.

| Ajuste | Valor de fábrica | Límites sugeridos |
|---|---|---|
| Recordatorio por correo | 24 horas antes de la cita | 1 a 72 horas |
| Anticipación mínima para reservar por enlace | 2 horas | 0 a 72 horas |
| Hasta cuándo se puede reservar | 60 días adelante | 1 a 365 días |
| Vigencia del enlace de un solo uso | 7 días | 1 a 30 días |

Reglas de construcción:

- Los edita solo quien administra la clínica (`canManageClinica`); los demás
  roles los ven en solo lectura o no los ven.
- Se guardan por clínica y se validan **en el servidor** con Zod y con los
  límites de la tabla. `PUT /api/me/horario` hoy guarda sin validar forma ni
  orden: no repetir ese hueco.
- Todo cálculo los lee del servidor (turnos ofrecidos, envío de recordatorios,
  vigencia de enlaces); nunca se confía en el valor que mande el navegador.
- Un cambio vale hacia adelante: los enlaces de un solo uso ya emitidos
  conservan la vigencia con la que nacieron.
- Cada cambio de estos ajustes va a `audit_log`.
- Los números del candado (1 cita activa, 2 reagendados, 3 cancelaciones en
  60 días) quedan fijos por ahora. Guárdalos junto a estos ajustes para que
  volverlos editables después no exija otra migración, pero sin exponerlos en
  pantalla salvo que Angel lo pida.

### Otros valores — propuestos; Angel los aprueba en su mensaje de arranque

Si el mensaje de arranque no los menciona, pregunta antes de darlos por buenos.

| Decisión | Valor |
|---|---|
| Duración de cada turno ofrecido | La del tipo de cita |
| «Eliminar» una cita con paciente | La cancela y queda en auditoría; no se borra |
| Funciones nuevas en producción | Apagadas por interruptor hasta que Angel las encienda |

---

## 3. Reglas del repo que mandan sobre este plan

Están completas en `CLAUDE.md`. Las que más pesan aquí:

- **Producción:** nunca ejecutar migraciones ni borrar datos en producción. Se
  genera el archivo SQL y Angel lo aplica. **Ninguna migración se aplica sin
  pasar por `supabase/AUDITORIA-MIGRACIONES.md`.** No hay base de staging.
- **Aislamiento entre clínicas:** todo `createAdminClient()` esquiva la RLS;
  cada consulta ahí filtra por `clinica_id` de forma explícita.
- **RLS:** no crear policies que consulten la misma tabla que restringen
  (recursión). No duplicar ni quitar las policies de suscripción existentes.
- **Datos de pacientes:** nada identificable a servicios externos más allá de lo
  que ya viaja hoy a Google (nombre en el título, clínica, hora). Sin notas, sin
  motivo, sin diagnóstico.
- **Auditoría:** todo cambio en datos sensibles va a `audit_log`. Las notas
  clínicas son inmutables. Los expedientes no se borran.
- **Texto legal:** la LFPDPPP cambió en 2025 y la autoridad ya no es el INAI.
  Ningún texto de consentimiento se da por válido sin revisión de Angel.
- **Autoridad de sesión:** los redirects se deciden con `getUser()`; no mover
  guardas de página al middleware.
- **Offline:** la app online no tiene capacidades offline. No crear Service
  Workers ni revivir el sistema viejo.
- **TypeScript:** sin `any`, sin `as` para callar errores, Zod en las entradas
  de API. Usar el logger de `src/lib/logger.ts`.
- **Next.js 16:** leer la guía en `node_modules/next/dist/docs/` antes de usar
  una API; no asumir las de versiones anteriores.
- **Integración:** `git merge` local sobre `main`. **Sin pull requests.**
- **Después de cada cambio:** `npm run build`; si toca tipos, `npm run lint`.
  Si el build falla, no se sigue.

**Excepciones que este proyecto necesita** (valen solo si Angel las autoriza en
su mensaje de arranque): tocar más de 3 archivos sin detenerse en cada paso;
crear hooks y módulos nuevos al partir el archivo grande; aplicar migraciones
en la base **local** de pruebas.

---

## 4. Estado actual

### 4.1 Mapa de archivos

| Pieza | Archivo |
|---|---|
| Página de la agenda (cliente, 9,142 líneas) | `src/app/(app)/agenda/page.tsx` |
| Esqueleto de carga | `src/app/(app)/agenda/loading.tsx` |
| API de citas: listar y crear | `src/app/api/appointments/route.ts` |
| API de citas: leer, editar, borrar | `src/app/api/appointments/[id]/route.ts` |
| Invitación por Google | `src/app/api/appointments/[id]/invitacion/route.ts`, `src/components/agenda/ModalInvitacionCita.tsx` |
| Lógica compartida de citas | `src/lib/appointments.ts` |
| Utilidades de agenda (con pruebas) | `src/lib/agenda/rangoQuePedir.ts`, `topeDuracion.ts`, `ventanaRejilla.ts` |
| Google: sesión, calendario, conexión | `src/lib/gcal.ts`, `src/lib/gcalConexion.ts` |
| Google: rutas | `src/app/api/google/{events,calendar,callback,connect,disconnect}/route.ts` |
| Horario de la clínica | `src/app/api/me/horario/route.ts`, `src/app/api/me/config/route.ts`, `src/lib/configApp.ts` |
| Permisos | `src/lib/permissions.ts` |
| Esquema vigente | `supabase/migrations/20260912190416_remote_schema.sql` |
| Estilos de la agenda | `src/app/globals.css` (clases `.ag-*` y `.fc-*`) |
| Especificación visual | `docs/spec/SPEC_AGENDA.md`, `RIESGOS_AGENDA.md`, `CONTRASTE_Y_MOVIMIENTO_AGENDA.md`, `MODO_OSCURO_AGENDA.md` |
| Deuda abierta | `DEUDA_TECNICA.md` (entradas `AG-DT-*`, `E5-DT-8`, `E5-DT-9`, `LP-DT-6`, `PERF-DT-*`) |

### 4.2 Qué hace hoy (inventario a conservar)

- Motor: FullCalendar 6.1.20, plugins gratuitos (`dayGrid`, `timeGrid`, `list`,
  `interaction`).
- Vistas: Mes, Semana y Día. Por debajo de 1024 px, Semana y Día son listas; el
  Mes del teléfono lleva un panel del día debajo.
- Una tabla `appointments`. Con `paciente_id` es cita; sin él es evento genérico
  con color (6) e icono (20). Estados: `scheduled`, `confirmed`, `cancelled`,
  `no_show`, `attended`.
- Alta, edición y borrado con actualización optimista; idempotencia del alta
  por `client_id`.
- Arrastrar y redimensionar, con aviso si cae fuera de horario.
- Eventos de todo el día y de varios días, con medianoche en la zona del
  consultorio (la compone el servidor).
- Tiempo real por Supabase Realtime (canal `appointments-realtime`), con
  reconocimiento del eco propio. **No hay sondeo por temporizador.**
- Refresco al reconectar el websocket y al volver a la pestaña tras 2 minutos.
- Filtro por médico; en Mes se fuerza un médico (no existe «Todos» en Mes).
- Panel lateral de la vista Día: resumen, horas ocupadas y libres, y **huecos
  disponibles** que al pulsarse abren el alta.
- Botón «Compactar» (oculta días y horas cerrados).
- Modal de horario de la clínica; conmutador Cita | Evento en el alta.
- Avisos de carga incompleta (techo de 1000 filas), de error y de fallo de
  Google, en vez de pintar una agenda vacía.
- Bloqueo de creación por suscripción (cliente, servidor y RLS).
- Modo oscuro y accesibilidad de modales (foco atrapado, Escape).
- Enlace profundo `/agenda?cita=nueva&paciente=<uuid>`.
- «Iniciar consulta» abre `/expediente/{id}/nueva-nota?cita={id}`; al guardar la
  nota, `/api/consultas` marca la cita como `attended`.
- Consumidores fuera de la agenda: `ProximasCitas`, `TarjetaHoy`,
  `HoyEnConsultorio`, `(launcher)/inicio`, y la próxima cita en el expediente.

### 4.3 Multitenant y roles

- Un usuario pertenece a una sola clínica (`profiles.clinica_id`). Roles:
  `medico` (con `es_admin_de_clinica` para el administrador), `secretaria`,
  `super_admin`.
- RLS de `appointments`, igual en lectura y escritura:
  `(medico_id = auth.uid() OR soy_admin_de_clinica() OR get_my_role() = 'secretaria') AND clinica_id = get_clinica_id()`.
  El alta lleva además el gate restrictivo de suscripción.
- Administrador y secretaria ven toda la clínica; el médico invitado solo sus
  citas.
- Los consultorios pertenecen a un médico. Cada cita copia el consultorio
  (nombre, dirección, teléfono, zona horaria) como instantánea.
- Horario: el que usa la agenda es **uno por clínica**
  (`clinicas.horario_consulta`) y **solo avisa**; el servidor no lo hace
  cumplir. Existe `consultorios.horario`, que la agenda no consume.

### 4.4 Por qué tarda al abrir (deducido del código, sin medir)

La misma sesión se valida varias veces contra el servidor de autenticación, en
cadena, antes de pintar el primer evento:

1. `src/app/(app)/layout.tsx` valida usuario y perfil en el servidor.
2. Baja el JavaScript de la página.
3. `useProfile()` (`src/hooks/useProfile.ts`) vuelve a pedir usuario y perfil
   desde el navegador. **Hasta que contesta, no se pide ninguna cita** (la
   primera traída depende de `filtroEfectivo`).
4. Salen dos peticiones y cada una valida usuario y perfil otra vez:
   - `/api/appointments`: consulta con conteo exacto.
   - `/api/google/events`: conexión, tokens, llamada a Google y una consulta más
     para restar duplicados, todo en serie y sin caché.

Otros factores:

- No hay caché ni precarga de rangos: cada cambio de semana son dos peticiones,
  y salir y volver a la agenda repite todo.
- No existe índice compuesto `(clinica_id, start_time)`.
- Cada evento se pinta como portal de React, y la animación de entrada corre en
  cada montaje (`globals.css`, regla `ag-entra`).
- `PERF-DT-4`: sospecha sin verificar de funciones de RLS evaluadas por fila.
  **Es RLS: no tocar sin medición y auditoría propias.**

Dato de tamaño: `DEUDA_TECNICA.md` registra 154 citas en producción
(2026-09-07). El problema son los viajes de red, no el volumen.

### 4.5 Google hoy

- Una conexión por clínica; la crea el administrador. Permisos:
  `calendar.app.created`, `openid`, `userinfo.email`.
- Calendario secundario «Spinus - <médico>» en la cuenta del administrador.
- **Solo de ida:** crear, editar y borrar en Spinus se escribe en Google
  después de responder (`after()`).
- Lo creado a mano en ese calendario se ve en Spinus en **solo lectura**.
- Lo que se mueva o borre en Google sobre una cita de Spinus **no vuelve**: la
  agenda sigue mostrando la hora de Spinus y la siguiente edición pisa el
  cambio. Un evento borrado en Google deja la cita en fallo de sincronización y
  nada la recrea.
- A Google viaja: título «Cita médica: <nombre>», clínica y hora. Nada clínico.
- La tabla ya tiene columnas pensadas para la vuelta y sin usar: `origen`
  (`spinus` | `google`) y `gcal_etag`.

### 4.6 Lo que falta frente a los calendarios de referencia

| Capacidad | Hoy |
|---|---|
| Navegación instantánea (caché y precarga) | No |
| Google en los dos sentidos | No |
| Alerta de empalme | No; no se detecta en ningún lado |
| Tipos de cita con duración propia | No; seis duraciones fijas |
| Disponibilidad por médico y consultorio | No |
| Reserva por enlace | No existe nada |
| Recordatorios al paciente | No; solo la invitación manual de Google |
| Citas recurrentes | No (fuera de este proyecto salvo que Angel lo pida) |
| Auditoría y borrado suave de citas | No; el borrado es definitivo y sin `audit_log` |
| Crear arrastrando con la duración arrastrada | No; siempre abre con 60 min |

---

## 5. Bloques de trabajo

Cada bloque termina en un estado que se puede integrar a `main` sin romper
nada. Las funciones nuevas quedan detrás de un interruptor apagado.

### Bloque A — Velocidad y orden (sin cambios de comportamiento)

> **Prioridad de Angel, al mismo nivel que las funciones nuevas:** que lo que la
> agenda YA hace funcione de la forma más óptima posible. Hoy es lenta por cómo
> está planteada la carga, y eso se corrige de raíz antes de añadir nada. No
> debe quedar ningún ciclo que se repita sin fin, ninguna espera en cadena que
> pueda ir en paralelo y ninguna petición repetida sin motivo.

**A0. Red de seguridad.** Antes de tocar nada: convertir el inventario de §4.2
en pruebas (unitarias donde haya lógica pura; de navegador con Playwright para
los flujos: alta, edición, arrastre, todo el día, filtro, vistas, móvil). Medir
la carga actual (tiempo a primer evento, número de peticiones) y anotarla.

**A1. Abrir rápido.**
- Sembrar el perfil desde el servidor para que la agenda no espere a
  `useProfile()` antes de pedir citas.
- Reducir las validaciones repetidas de sesión en las dos rutas, **sin bajar la
  autoridad de ningún redirect** (ver «Autoridad de sesión» en `CLAUDE.md`).
- Sacar a Google del camino crítico: las citas se pintan primero; Google se
  cachea y llega después.
- Caché de rangos en cliente y precarga de la semana anterior y siguiente.
- Índice compuesto `(clinica_id, start_time)` (migración, la aplica Angel).
- Revisar la animación de entrada para que no corra en cada recarga.

**A1-bis. Revisión completa de eficiencia.** El diagnóstico leyó las rutas de
datos y las partes centrales de `agenda/page.tsx`, **no sus 9,142 líneas una
por una**. Antes de dar la agenda por optimizada hay que recorrerla entera
buscando, con el navegador instrumentado y no solo leyendo:

- **Ciclos:** efectos que se vuelven a disparar a sí mismos, estados que se
  escriben en cada render, traídas que provocan otra traída. En la lectura no
  apareció ninguna recursión infinita en la agenda, pero no está descartado en
  lo no leído. (Las dos que sufrió el proyecto —la recursión de RLS de
  pacientes y el bucle de recarga de sesión— ya están cerradas y documentadas
  en `CLAUDE.md`; no reabrirlas.)
- **Renders de más:** cuántas veces se vuelve a pintar el calendario al abrir,
  al cambiar de semana y al llegar un evento por tiempo real; funciones y
  objetos que cambian de identidad en cada render y obligan a FullCalendar a
  rehacer trabajo.
- **Esperas conocidas que hay que acortar o quitar:**
  - `useProfile()` tiene un tope de 3 s antes de caer al caché: con la red
    lenta, la agenda puede pasar 3 s sin pedir una sola cita.
  - La primera traída espera al perfil (cadena en vez de paralelo).
  - `/api/google/events` encadena cinco o más viajes en serie.
  - `ModalInvitacionCita` sondea cada 1 s hasta 20 s esperando el evento de
    Google; con tiempo real ya disponible, ese sondeo sobra.
  - Cada cambio de otra persona con paciente distinto dispara un
    `GET /api/appointments/[id]` por evento.
  - `ProximasCitas` vuelve a consultar en cada cambio de pestaña, sin tope.
  - La escritura a Google en segundo plano emite un segundo cambio por tiempo
    real por cada cita guardada. **Verificar** si provoca trabajo de más en
    todas las agendas abiertas.
- **Peso de la página:** tamaño del JavaScript de `/agenda` y qué se puede
  cargar después (modales, selector de iconos, panel).
- **Base de datos:** medir las consultas de la agenda con datos de volumen
  realista en la base local (decenas de miles de citas), no con las 154 de
  producción. `PERF-DT-4` se **mide** aquí; si toca RLS, va con su auditoría.

**Presupuesto de rendimiento** (valores propuestos; se calibran con la línea
base de A0 y se declaran en el reporte del bloque):

| Medida | Objetivo |
|---|---|
| Validaciones de sesión contra Auth para abrir la agenda | 1, no 4 |
| Tiempo hasta ver las citas de la semana, con conexión normal | Menos de 1 s |
| Cambiar a una semana ya vista o vecina | Instantáneo, sin petición bloqueante |
| Volver a la agenda desde otra pantalla | Se pinta lo último visto al instante y se actualiza por detrás |
| Guardar, mover o cancelar una cita | Se ve al instante (ya es así; no perderlo) |
| Google lento o caído | No retrasa ni un instante las citas propias |
| Peticiones al abrir | Las mínimas, y ninguna repetida |

**Regla para todos los bloques siguientes:** ninguna función nueva puede
empeorar este presupuesto. Cada bloque vuelve a medirlo y lo reporta.

**A2. Partir `agenda/page.tsx`.** Sacar piezas a `src/components/agenda/` y
`src/lib/agenda/` sin cambiar comportamiento. Cuidado con los nombres: nunca dos
archivos que solo se distingan por mayúsculas. Mover primero lo puro
(aritmética de huecos, formatos, tipos), luego componentes, al final el
componente principal.

**Aceptación:** todas las pruebas de A0 en verde; build y lint limpios; menos
peticiones y menos tiempo a primer evento que la línea base, con los dos números
en el reporte.

### Bloque B — Cimientos

- **Tipos de cita** por clínica o por médico: nombre, duración, color opcional.
- **Disponibilidad por médico y consultorio**, partiendo de
  `consultorios.horario`. Conservar el horario de clínica mientras siga en uso.
- **Pantalla de configuración del calendario** con los cuatro ajustes editables
  por clínica de §2, además del horario que ya existe. Es donde después vivirán
  los tipos de cita y los enlaces de reserva.
- **Alerta de empalme:** modal que nombra la cita con la que se empalma, en
  alta, edición, arrastre y redimensionado. No bloquea.
- **Cancelar en vez de borrar** las citas con paciente, y registro en
  `audit_log` de alta, edición, cancelación y borrado.
- Mover la aritmética de huecos a `src/lib/agenda/` y hacerla correr también en
  el servidor, con la zona del consultorio y turnos de la duración del tipo de
  cita. Hoy vive en `agenda/page.tsx` (`tramosDeOcupacion`, `fusionarTramos`,
  `recortarATramo`, `huecosDe`), corre en el navegador sobre lo pintado, usa la
  hora del dispositivo y solo devuelve tramos de 60 min o más.
- Cerrar de paso la deuda que este bloque toca: `AG-DT-10` (auditoría),
  `E5-DT-8` (cita duplicada al arrastrar) si se reproduce.

**Aceptación:** flujos probados contra la base local; migraciones con su
auditoría; nada de §4.2 roto.

### Bloque C — Google en los dos sentidos

- Lectura incremental de cambios del calendario Spinus (`events.list` con
  `syncToken`; un 410 obliga a resincronizar completo).
- Disparo: webhook de Google (`events.watch`) si es viable; si no, al abrir la
  agenda más una tarea programada. **Sin verificar:** si Google exige verificar
  el dominio del webhook. Compruébalo en la documentación oficial antes de
  construir; si lo exige, usa la variante sin webhook.
- Citas de Spinus movidas, editadas o canceladas en Google: se reflejan en
  Spinus. Un borrado en Google **cancela** la cita, no la elimina.
- Eventos creados en Google: entran como filas con `origen = 'google'`,
  editables desde Spinus y convertibles en cita.
- Conflicto: gana el último cambio; se registra en auditoría.
- Las observaciones de citas con paciente no se envían a Google.
- Aislamiento: lo que entra por Google se escribe con cliente de servicio;
  **cada consulta filtra por `clinica_id`**.
- Deuda relacionada: `LP-DT-6`, `AG-DT-5`, y el estado `attended` que hoy no
  actualiza el evento de Google.

**Aceptación:** pruebas contra un Google simulado que cubran mover, editar,
borrar, crear, conflicto y resincronización tras 410. La prueba con cuenta real
es de Angel.

### Bloque D — Reserva por enlace

- Página fuera del área autenticada. Añadirla a las rutas públicas del
  middleware **sin tocar** las existentes (en particular
  `pathname.startsWith('/r/')`, que debe quedarse).
- Enlace fijo por médico con código no adivinable y regenerable; enlaces de un
  solo uso con vigencia.
- Quien reserva elige consultorio (si hay varios), tipo de cita y horario.
- Los horarios salen del cálculo del servidor del bloque B y **no se ofrecen
  empalmados**. Volver a comprobar al confirmar, por si dos personas eligen el
  mismo turno.
- La cita queda agendada al instante, con nombre, teléfono y correo en la propia
  cita y **sin crear paciente**. En la agenda se distingue como «por ligar».
- Al iniciar la consulta: ligar a paciente existente o crear uno (reutilizar
  `QuickPatientModal`).
- Antiabuso: límite de intentos, sin exponer datos de otras citas (solo libre u
  ocupado), sin listar médicos ni clínicas.
- Candado contra abuso según la tabla de §2: límite de citas activas, de
  reagendados y de cancelaciones, verificación del correo con código, bloqueo y
  desbloqueo manual, y marca visible en la cita. Las inasistencias (`no_show`)
  cuentan igual que las cancelaciones.
- Consentimiento de privacidad al reservar: redactarlo, marcarlo «pendiente de
  revisión legal» y **dejar el enlace apagado** hasta que Angel lo apruebe. Debe
  cubrir también que se conserva el historial de cancelaciones del contacto.

**Aceptación:** reserva completa probada en local; dos reservas simultáneas al
mismo turno dejan una sola cita; el enlace caducado o usado no reserva.

### Bloque E — Recordatorios y confirmación de asistencia

- Dos correos (Resend ya es dependencia): comprobante al agendar y recordatorio
  24 horas antes, a citas con correo conocido. El segundo requiere tarea
  programada en Vercel, que activa Angel.
- Página de confirmación con enlace único por cita, fuera del área autenticada:
  «Confirmo» y «No podré asistir», con oferta de reagendar.
  - ⚠️ **El estado cambia al pulsar un botón DENTRO de la página (POST), nunca
    al abrir el enlace.** Los filtros de correo y la vista previa de WhatsApp
    abren los enlaces solos; con un GET las citas se confirmarían o cancelarían
    sin que nadie lo pidiera.
  - Muestra lo mínimo: fecha, hora, médico y consultorio. Nada clínico. El
    enlace caduca y no lleva datos personales en la URL.
  - Solo transiciones válidas: desde agendada o confirmada; nunca sobre una cita
    atendida. La cancelación deja de aceptarse 1 hora antes.
  - Cada cambio va a `audit_log` como hecho por el paciente mediante enlace, y
    se refleja en Google.
- WhatsApp manual: botón en la cita y lista «citas de mañana por confirmar» que
  abre `wa.me` con el texto y el enlace. Marcar en `whatsapp_sent_at` /
  `whatsapp_reminder_sent_at` que se abrió (no que se envió: eso no se puede
  saber). Texto sin nada clínico. **Verificar** el formato del número para
  México antes de construir. Quien ya confirmó por correo sale de la lista.
- Leer la respuesta del paciente a la invitación de Google (aceptó o rechazó)
  como segunda vía de confirmación, si el permiso actual la devuelve.
  **Sin verificar**; comprobar en la documentación antes de construir.
- Burbuja de creación rápida y tarjeta de lectura de la cita (ver §2), sin
  retirar el modal completo.
- Animar solo la cita nueva y dar un pulso a la que llega por tiempo real, como
  pide `docs/spec/CONTRASTE_Y_MOVIMIENTO_AGENDA.md`; hoy se anima todo en cada
  recarga.
- Pulido: mini calendario de mes, botón «Hoy», atajos de teclado, búsqueda por
  paciente, deslizar para cambiar de día en móvil.
- Arrastrar para crear respetando la duración arrastrada.
- Detalles de interfaz y de móvil que hayan quedado.
- Al cerrar el proyecto (tras el bloque F): actualizar `CLAUDE.md` y
  `DEUDA_TECNICA.md` con lo cerrado y lo nuevo.

### Bloque F — Interfaz, movimiento y orden visual

Reúne tres cosas: los puntos de interfaz que aparecen al final de la lista del
bloque E (burbuja de creación rápida, tarjeta de lectura, mini calendario,
botón «Hoy», atajos, búsqueda, gestos en móvil, arrastrar con duración), la
auditoría visual y el encargo de movimiento, que siguen aquí abajo. Va al final
porque se apoya en el archivo ya partido (A2) y en la caché de rangos (A1), sin
la cual el deslizamiento entre semanas no puede ser fluido. Las mejoras de
espacio de la auditoría pueden adelantarse a A2 si no cambian comportamiento.

#### Auditoría visual (2026-11-11) — las 18 propuestas APROBADAS por Angel

Hecha sobre la agenda real, renderizada en local con datos ficticios y
fotografiada a 1440×900, 1280×720, 820×1180 y 390×844. Angel aprobó las 18:
se construyen todas. Los puntos 11 y 13 se verifican primero
como posibles defectos.

**Espacio en escritorio**

1. Antes de la primera hora de la rejilla hay cinco franjas apiladas: título y
   controles, navegación y fecha, leyenda, cabecera de días y banda de todo el
   día. En un portátil de 720 px de alto quedan visibles unas 6 horas.
   Propuesta: una sola barra (navegación + fecha + vistas + filtro + Agendar) y
   la leyenda fuera de la fila fija (en un botón «?» o al pie).
2. La barra lateral de la app ocupa 256 px fijos (20 % de un portátil).
   Propuesta: que pueda plegarse a iconos en la agenda.
3. Cada hora mide unos 84 px a 900 px de alto y 72 px a 720. Propuesta: una
   densidad «compacta» (unos 48 px por hora) elegible, para ver la jornada
   entera sin desplazar.
4. La vista Día estira cada cita a todo el ancho con una sola línea de texto y
   deja la mitad inferior del panel lateral vacía. Propuesta: usar ese ancho
   para dar más datos por cita (motivo, teléfono, consultorio) y poner el mini
   calendario de mes en el hueco del panel.
5. En Semana, el domingo cerrado ocupa una séptima parte del ancho.
   Propuesta: que «Compactar» venga encendido por defecto cuando hay días
   cerrados.
6. En Mes se pinta una semana entera del mes anterior aunque esté vacía, y las
   filas miden lo mismo tengan dos citas o doce. El spec ya pedía
   `fixedWeekCount: false` y filas que se ajustan al contenido; no está
   aplicado.

**Legibilidad**

7. Con «Todos los médicos», las citas simultáneas se parten y la segunda queda
   en «08:00 H.» o «08:30 M.»: el nombre no se lee. Propuesta: reparto en partes
   iguales y, cuando no quepa el nombre, apellido abreviado en vez de inicial.
8. La palabra del estado («agendada», «atendida») se repite en minúsculas bajo
   el nombre, cuando el color ya lo dice. Propuesta: quitarla de la tarjeta de
   Semana y dejar ahí el motivo.
9. El chip de iniciales del médico («AA») sale en todas las tarjetas aunque el
   filtro ya sea un solo médico. Propuesta: mostrarlo solo con «Todos».
10. El botón «Hoy» es gris y parece deshabilitado.
11. Al encender «Compactar», la rejilla queda desplazada a media cita y las
    tarjetas de arriba salen cortadas. **Verificar si es defecto.**

**Teléfono y tableta**

12. La lista de Semana abre en el lunes aunque hoy sea miércoles; hay que
    desplazar para ver el día actual. Propuesta: abrir en hoy.
13. En el Mes del teléfono, el panel inferior abre en el día 1 («sin citas») en
    lugar de hoy, y los puntos de la celda de hoy no se distinguen sobre el
    fondo azul. **El segundo parece defecto.**
14. En la lista de Día cada cita ocupa 110–130 px (hora, nombre, duración,
    motivo y estado en líneas separadas): caben 4 por pantalla. Propuesta:
    dos líneas por cita.
15. La banda azul superior ocupa unos 195 px de 844 (23 %). Propuesta: fundir
    título, vistas y navegación en dos filas.
16. A 820 px de ancho (tableta vertical) se muestra la lista de teléfono con
    media pantalla vacía. Propuesta: rejilla de 3 días o lista a dos columnas
    entre 768 y 1024 px.

**Modales**

17. El alta mide 480 px de ancho y obliga a desplazar para llegar a Notas y
    Guardar; los seis botones de duración parten en dos filas con uno suelto.
    La burbuja de creación rápida (§2) resuelve el caso común.
18. En la edición, los cinco estados van en rejilla de dos columnas con uno
    suelto, y «Iniciar consulta» —la acción principal del día— pesa menos que
    «Guardar». La tarjeta de lectura (§2) lo resuelve.

**No verificado en la auditoría:** el formato de fecha y hora de los campos
nativos (salieron en formato estadounidense, que puede ser del navegador de
pruebas y no de la app), el arrastre, las animaciones y el rendimiento real.

#### Movimiento y orden visual — encargo de Angel

**El encargo, en sus palabras:** animaciones fluidas, con entradas y salidas
suaves; la referencia es la apariencia de Fantastical y Notion Calendar, **sin
perder la esencia de Spinus**; todo limpio, simétrico y ordenado.

**Qué significa «la esencia de Spinus» aquí, para no perderla:** la paleta de
estados y el navy de la marca, el nombre del paciente siempre legible, tarjetas
sin sombra con barra de color a la izquierda, cifras alineadas, y las listas en
teléfono. La referencia es de **comportamiento y pulcritud**, no de copiar el
aspecto de otra aplicación.

**Punto de partida, ya en el repo:**

- Escala de movimiento de la agenda en `globals.css`: `--ag-dur-micro` 120 ms,
  `--ag-dur-base` 180 ms, `--ag-dur-lento` 240 ms; curvas `--ag-ease-out`
  (llega), `--ag-ease-in` (se va), `--ag-ease` (se mueve). **No inventar
  duraciones ni curvas fuera de esa escala**; si hace falta una más, se añade
  como token.
- `docs/spec/CONTRASTE_Y_MOVIMIENTO_AGENDA.md` §2 ya define casi todo esto
  (animar la vista y no cada tarjeta, entrada solo del evento nuevo, qué no se
  anima). **Léelo antes de escribir una sola transición**: buena parte del
  encargo es terminar de aplicarlo.
- Hoy la entrada `ag-entra` corre en **cada** tarjeta en cada montaje
  (`globals.css`, regla sobre `.agenda-fc .fc-event`), y no hay ninguna
  animación de salida.

**Qué se anima, y cómo**

| Momento | Entrada | Salida |
|---|---|---|
| Cambiar de semana, día o mes | La rejilla nueva entra deslizándose unos píxeles en el sentido de la navegación, con fundido | La anterior sale en el sentido contrario; sin parpadeo a vacío |
| Cambiar de vista (Mes ↔ Semana ↔ Día) | Fundido cruzado corto | Igual |
| Cita recién creada | Aparece creciendo levemente desde su sitio | — |
| Cita que llega por tiempo real (otra persona) | Entrada más un pulso único que la señala | — |
| Cita eliminada o cancelada | — | Se desvanece y se encoge un poco antes de quitarse; hoy desaparece de golpe |
| Cita movida por otra persona | Se desliza a su hora nueva en vez de saltar | — |
| Arrastrar y soltar | Al soltar, se asienta en su franja con un ajuste corto | Si se revierte, vuelve a su sitio deslizándose |
| Burbuja de creación y tarjeta de lectura | Crecen desde el punto donde se pulsó | Se recogen hacia ese mismo punto |
| Modal completo | Sube unos píxeles con fundido; el fondo se oscurece a la vez | Baja y se desvanece; el fondo se aclara a la vez |
| Panel lateral, avisos, banda compacta | Despliegue suave | Repliegue suave, sin dejar un salto en la rejilla |
| Hover y foco en tarjetas y botones | Cambio de fondo y borde en `--ag-dur-micro` | Igual |
| Indicador de la hora actual | Avanza sin saltos | — |

**Reglas de construcción**

- **Solo se anima `transform` y `opacity`.** Nunca `width`, `height`, `top` ni
  `left`: provocan recálculo de la rejilla y ahí nace el tirón. Para paneles
  que cambian de alto, animar con `transform`/`grid-template-rows`, no con
  `height` a mano.
- **Una salida necesita que el nodo siga montado mientras dura.** FullCalendar
  quita el evento al instante: la salida de una cita se hace marcándola,
  esperando la duración y quitándola después, sin dejar dos fuentes de verdad.
  Cuidado con la regla del spec: nada de `eventDidMount` para decidir aspecto.
- **Las filas de lista son `<tr>`**: un `transform` las despega de la tabla
  (ya pasó, ver la nota junto a `ag-entra`). En listas se anima solo `opacity`.
- **Lo que llega, decelera; lo que se va, acelera; lo que se mueve, las dos.**
  Las salidas duran menos que las entradas.
- **Nada se anima en la primera carga** salvo la vista entera. Doscientas
  tarjetas entrando a la vez es justo lo que hoy se ve mal.
- **`prefers-reduced-motion` va junto a cada animación**, no al final: sin
  desplazamientos, solo fundidos muy cortos o nada. Extender el bloque que ya
  existe en `globals.css`; no crear otro.
- **Sin dependencias nuevas.** `motion` ya está instalado, pero se prefiere CSS;
  usarlo solo donde CSS no llegue (por ejemplo, la salida coordinada de la
  burbuja) y diciéndolo en el reporte.
- **Medir, no opinar:** grabar la navegación entre semanas con un mes lleno y
  comprobar que no hay cuadros perdidos antes de dar una animación por buena.

**Orden y simetría**

- Una sola retícula de espaciado (la escala `--ag-1 … --ag-8` del spec) en
  barra, rejilla, panel, burbujas y modales. Ningún margen suelto fuera de ella.
- Mismos márgenes interiores a izquierda y derecha en toda tarjeta, fila y
  panel; mismos radios por tipo de elemento (los del spec §1.3).
- Controles de la barra a la misma altura y alineados a una misma línea base;
  iconos centrados ópticamente en su botón.
- Rejillas de botones sin elementos huérfanos (los seis de duración, los cinco
  estados): filas completas o una sola fila.
- Columnas de día del mismo ancho; cabeceras centradas sobre su columna; la
  columna de horas alineada con las líneas de la rejilla.
- Lo que se repite se ve idéntico: una cita se pinta igual en Semana, en Día,
  en el panel y en la tarjeta de lectura, cambiando solo cuánto detalle cabe.
- Comprobar en claro y en oscuro, y a los cuatro tamaños de la auditoría.

**Aceptación:** capturas antes y después a los cuatro tamaños; video o
secuencia de la navegación, del alta, de la baja y del arrastre; ninguna
animación fuera de la escala de tokens; todo sigue funcionando con movimiento
reducido.

---

## 6. Cómo trabajar

> **Reglas vigentes desde el 2026-11-12** (mensaje de Angel; sustituyen a las
> anteriores donde las contradigan).

**Todo es local primero.** Hasta que Angel termine su auditoría en local:
- Base de datos: solo la local (Docker). Nada contra producción, ni de lectura.
- Google: solo contra el Google simulado. Ninguna cuenta ni credencial real, y
  no se conecta ninguna.
- Correos: ninguno real. En local se capturan (Mailpit / transporte de prueba)
  y se comprueba el contenido sin que salga.
- Vercel: no se despliega, no se configuran variables ni tareas programadas, no
  se prueba en Preview. El código y la configuración quedan en la rama listos;
  activarlos le toca a Angel.
- El código nuevo tolera que en producción aún no existan las tablas nuevas:
  con el interruptor apagado o la tabla ausente, la agenda se comporta
  exactamente como hoy, sin errores.

**Migraciones.**
- Ninguna va a producción hasta el final del proyecto. Todas se aplican solo
  en la base LOCAL.
- Se entregan como UN conjunto. Antes de darlo por bueno: reiniciar la base
  local desde cero, aplicarlas todas en orden y correr todas las pruebas.
  Auditoría independiente de cada una (`supabase/AUDITORIA-MIGRACIONES.md`) y
  una auditoría del conjunto buscando conflictos entre ellas.
- `select version()` (≥ 14) se comprueba al final, antes de aplicar el conjunto.

**Commits y push.**
- Rama `feature/agenda-v2` (worktree `~/proyectos/app_ortointegra-agenda`).
  Un commit por paso terminado, en local.
- `git push` SOLO al cerrar cada bloque (B, C, D, E, F), con todos sus
  commits juntos: cada push dispara una Preview de Vercel. Excepción: un push
  de respaldo al día como máximo si un bloque dura muchas horas.
- Sin pull requests. Nunca merge ni push a `main`: el merge lo hace Angel.

**Cómo avanzar.**
- No se detiene el trabajo por decisiones de producto: si el plan no lo
  cubre, se toma la opción que menos cambia el comportamiento actual, se anota
  en «Decisiones para la auditoría final» y se sigue.
- Reportes de cierre de bloque informativos; no se espera visto bueno.
- Se reparte en paralelo entre agentes lo que no toque los mismos archivos.
- Agentes: modelo más capaz para migraciones, RLS, sincronización con Google y
  seguridad del enlace; el más rápido para lo mecánico; un revisor
  independiente, en otro modelo, lee cada cambio.
- Verificación en cada paso: diff, `npm run build`, `npm run lint` (96 errores
  previos, sin subir), `npm run test` y las e2e del área tocada.
- **Detenerse solo si:** el build no se puede reparar; algo obliga a cambiar
  una regla de seguridad de `CLAUDE.md`; el entorno apunta a producción; o no
  hay alternativa para S3 tal como la pidió Angel.

**Orden:** terminar B, luego C, D y E, y F al final.

---

## 7. Lo que le toca a Angel

Al día con la integración de la tanda I (2026-11-17, §6-bis «Tanda I»). **Cerradas por la tanda I:** mover una atendida con nota, sin condición (pendiente (1) de H, punto 1); el enlace de un solo uso sin correo (pendiente (2) de H, AG-DT-70, punto 2). **Decidida por Angel el 2026-11-15:** AG-DT-63 se queda como está (punto 21). **Decididas por Angel el 2026-11-14:** el invitado crea, cambia y archiva SUS tipos y su duración (cierra el punto 9 de la tanda anterior); cualquier rol que vea la cita manda el correo de confirmación; una atendida con nota no cambia de estado ni se borra; «Reagendar cita» crea una cita nueva; la reserva ofrece sólo los tipos del consultorio elegido. **Ya decididas por Angel el 2026-11-13:** el bloqueo manual por teléfono se queda (AG-DT-28) y «Compactar» al abrir se queda apagado (F1.5). **Resuelta:** convertir en cita un evento de Google (AG-DT-29). Guía
para levantarlo todo en local: `GUIA_AUDITORIA_AGENDA_V2.md`; **guía de
pruebas a mano, paso a paso y sin código: `GUIA_PRUEBAS_AGENDA_V2.md`** (el
Google simulado se arranca con un comando, `npx tsx
scripts/google-falso-manual.ts`). Auditoría del conjunto de migraciones:
`supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` (§8, las correcciones). Lo que no se
pudo probar: §10.

| Momento | Qué |
|---|---|
| Durante el proyecto | Nada obligatorio: los reportes de bloque son informativos |
| Al final, en local | Auditar con lo que se entrega: el conjunto de **34** migraciones del proyecto (las 16 del cierre, las 4 de las correcciones, las 4 de la tanda del 2026-11-14, las 3 de la tanda H y las 7 de la tanda I; con las 5 de `main`, las **39** de §7.1, una por una) con sus auditorías (cabeceras y `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`), datos inventados sembrados (`scripts/agenda-semilla.ts`), la guía corta, §6-bis y §10. Decidir las propuestas de dimensión nueva para `AUDITORIA-MIGRACIONES.md` (§6-bis, «Cierre del proyecto»; no se tocó el archivo) |
| Decisiones pendientes | **De la tanda I (§6-bis «Tanda I»):** las decisiones marcadas «— PARA REVISIÓN DE ANGEL» en cada rama y su resumen al final de la tanda (entre ellas: el canal de tiempo real que sobrevive 2 min, el encabezado del correo a nombre del médico, lo que entra «por asignar» y lo que no, las citas de más de 48 h «por revisar», el correo a la clínica APAGADO de fábrica); los textos nuevos PENDIENTE DE REVISIÓN; **la cabecera de `20260919230000_auth_02` dice «PENDIENTE DE APLICAR»** y §7 la da por aplicada: comprobarlo en producción (§7.1, fila 4). **De la tanda H (§6-bis «Tanda H»):** (1) y (2), cerradas por la tanda I; (3) el horario de cada consultorio tras «Restablecer»: se eligió el de la clínica copiado como horario propio (la herencia de G4), en vez del DEFAULT sin horario propio de H2; (4) los textos nuevos PENDIENTE DE REVISIÓN. De antes: la dimensión nueva que propone el auditor de `20261119130000` para `AUDITORIA-MIGRACIONES.md` (pre-vuelos acotados a las filas que toca la sentencia; `AUDITORIA-CONJUNTO-AGENDA-V2.md` §9); AG-DT-26 (límite en las páginas públicas) y AG-DT-27 (todo el día en los avisos de empalme); proponer o no un módulo común para `colocar` y para «hay un diálogo modal» (AG-DT-38, AG-DT-39); **S3**: quedarse con la puerta que lee `pg_proc` (C1) o la copia con huella; las «NO aplicado, para revisar por Angel» de las auditorías de E1, E4, E6 y D11 (cabeceras y §6-bis); si E9 debe cerrar la clínica suspendida también dentro de la función (H4); el plazo de conservación del historial del candado (propuesto 12 meses) |
| Antes de aplicar | `select version()` en producción (≥ 14). **Comprobar también que el PostgREST de producción admite `imatch`** (≥ 10; en local hay 14.5): la búsqueda de pacientes del punto 1 de la tanda del 2026-11-13 sale **sin interruptor** y lo usa (prueba: en la app, buscar «hugo interian» en «Agendar» devuelve el paciente y no un error 400 en la consola; o `GET /rest/v1/pacientes?nombre=imatch.x&limit=0` con sesión responde 200). Comprobar que producción tiene las 5 migraciones de `main` y decidir el orden con `feature/limites-ajustables` (sus `20261014*` van antes por fecha; al fusionar las dos, cambiar la lista fija del caso 3 de `p1_permisos_funciones.sql` por la de **45** funciones (las 44 de la tanda H, §10.5, y `cita_reagendar_clinica` de la tanda I), escrita entera en la auditoría del conjunto §11.5 y comprobada con las dos ramas juntas (42 migraciones); con ellas, `i2_unico_sin_correo.sql` necesita el GRANT de `pg_temp.unico(text)`, ya puesto; el resto de `p1`, `p1b`, `p2`, `p3` y las 21 pruebas del proyecto pasan con el conjunto combinado: hallazgos H2 e I1) |
| Aplicar | **Antes de desplegar el código** (los dos órdenes son seguros, pero con el código primero cada petición deja un `warn` en el log: hallazgo H3). El conjunto, en orden de nombre de archivo, uno por uno, mirando la rejilla final de cada uno (todas las filas OK). `20261119130000` (G4) copia datos: su respaldo queda en `respaldos.consultorios_horario_20261119`; `20261119140000` (G3), mejor en la misma ventana que E4. **`20261120120000` (H2) deja el recordatorio APAGADO en todas las clínicas** hasta que su administrador lo encienda (también las que ya tengan la v2); `20261120130000` (H5) actúa también con la v2 apagada. **Tanda I:** las siete, migración primero (orden y tolerancia en la auditoría del conjunto §11.7); `20261121140000` (I4a) actúa también con la v2 apagada; `20261121141000` (I4b) deja **todas** las filas de horario «por revisar»; `20261121150000` (I5) deja el correo a la clínica APAGADO. Después, la línea `-- ESTADO · PRODUCCIÓN` de cada archivo con fecha y comprobación (`AUDITORIA-MIGRACIONES.md` §7) |
| Vercel | Variables `RESERVA_SECRETO`, `EMAIL_TRANSPORT=resend`, `CRON_SECRET` (las tareas de `vercel.json` se activan con el despliegue y sin `CRON_SECRET` contestan 401); `AGENDA_RSVP_GOOGLE` sólo tras la prueba de RSVP |
| Google real | Prueba con cuenta real: ida y vuelta (C), sincronización antes de reservar (D11), RSVP (E9). Cerrar o no LP-DT-6. Antes de encender: revisar el panel de auditoría (C-h, `user_id='system'`) |
| Texto legal | Revisar el aviso de la reserva (D9) y aprobar su hash; revisar los textos PENDIENTE DE REVISIÓN (lista en §10); decidir si el consentimiento de los pacientes existentes cubre recordatorios y WhatsApp |
| Encender | El interruptor por clínica (`agenda_ajustes.agenda_v2_encendida`, por SQL como `postgres`; guía §5), primero en una clínica |
| Al final | `git merge` local sobre `main` |

### 7.1 Todas las migraciones, una por una (punto 24 de Angel, 2026-11-17)

Las **39** de `supabase/migrations/` en orden de nombre (`descartadas/` no
entra), leídas de los archivos, sin ninguna consulta a producción. Las cinco
primeras son las de `main`: según §7 ya están en producción (**a comprobar**:
la cabecera de la nº 4 dice «PENDIENTE DE APLICAR»); se juzgan igual. «Riesgo»
es el del ensayo contra la estructura de producción. Tabla redactada por un
revisor en Sonnet sobre los archivos enteros y repasada por el integrador (la
fila 36, con lo comprobado en el reinicio desde cero).

**`supabase/archivo-migraciones-historicas/` ya está en producción y queda
fuera de esta tabla:** 116 `.sql` aplicados a mano por el SQL Editor antes del
2026-09-12 (`LEEME.md`), que la `schema_migrations` de producción no conoce.

**Regla: cada migración nueva añade su fila a esta tabla en el mismo commit.**

| # | Migración (nombre del archivo sin `.sql`) | ¿Modifica filas existentes? | ¿Agrega restricción (CHECK / NOT NULL / FK / UNIQUE) o índice único sobre una tabla que ya tiene filas? | ¿De qué objetos previos depende? (tablas, columnas, funciones, policies) | Riesgo para el ensayo contra la estructura de producción |
|---|---|---|---|---|---|
| 1 | 20260912190416_remote_schema | No: es un volcado de DDL puro. Hay DML, pero sólo dentro de los cuerpos de funciones; a nivel superior no hay ningún INSERT/UPDATE/DELETE. | No: crea desde cero todas las tablas, sus FK/CHECK y sus índices únicos (p. ej. `consultorios_default_unico` y `appointments_clinica_google_event_id_uniq`). | Ninguna del conjunto. Supone `auth.users`, `extensions.uuid_generate_v4()` y los roles de Supabase; crea los esquemas `private` y `respaldos` y las extensiones `pg_trgm` y `unaccent`. | Bajo si ya está registrada en producción (es su `db pull`; a comprobar). No se puede volver a ejecutar: `CREATE SCHEMA "private"` y `CREATE EXTENSION` van sin IF NOT EXISTS, no hay BEGIN/COMMIT y abortaría en la primera sentencia. |
| 2 | 20260913_b5_perfil_completo_rls | No: sólo reescribe policies y funciones. El censo del pre-vuelo únicamente lee `profiles` y `consultorios`. | No: sólo `ALTER POLICY ... WITH CHECK` sobre 6 policies RESTRICTIVE de INSERT, y eso no valida las filas existentes. | Del volcado #1: `clinica_no_suspendida()`, `clinica_tiene_acceso()`, `clinica_dentro_de_limite()` y las policies `*_gates_insert`. También `crear_paciente_con_medico_v2(jsonb,uuid,boolean)`, cuyo md5 de prosrc el pre-vuelo exige que sea uno de `6762f924…`, `0835cd6a…` (ya aplicada) o `6c67ccbd…` (CRLF). | Bajo: la cabecera la da por APLICADA Y VERIFICADA en producción el 2026-09-14. Abortaría si el cuerpo de la v2 se tocó a mano después. Va sin lock_timeout y el ALTER POLICY toma ACCESS EXCLUSIVE sobre 6 tablas. |
| 3 | 20260914_b56_trigger_aprovisionamiento | No: no rellena nada (los perfiles huérfanos sólo se cuentan en un NOTICE). `handle_new_user()` sólo inserta en altas futuras. | Sí, pero toda fila pasa por construcción: `profiles.invitado_por uuid REFERENCES profiles(id) ON DELETE SET NULL` es una columna nueva y nace NULL. | `profiles` y `auth.users` (con privilegio TRIGGER) del volcado #1. El pre-vuelo exige que `profiles` no tenga ni trigger ni policy de INSERT, que `on_auth_user_created` no apunte a otra función y que quien aplica sea dueño o tenga BYPASSRLS. | Bajo: la cabecera la da por APLICADA Y VERIFICADA en producción el 2026-09-14. Va sin lock_timeout y el DROP/CREATE TRIGGER bloquea `auth.users`, la tabla de GoTrue. |
| 4 | 20260919230000_auth_02_reasentar_grants_rate_limit | No: sólo REVOKE/GRANT y `NOTIFY pgrst`. | No. | `rate_limit_intento(text,text,int,int)` y `rate_limit_reset(text)` del volcado #1. El pre-vuelo aborta si existen con otra firma y termina en NOTICE si no existe ninguna. | Bajo: según su cabecera es no-op en producción. Pero esa misma cabecera dice «ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR», lo que contradice §7; hay que comprobarlo en `schema_migrations`. |
| 5 | 20260919_consultorios_07_default_exclude | No: no hace UPDATE ni backfill. | Sí, sobre `consultorios`: cambia el UNIQUE INDEX `consultorios_default_unico` por una `EXCLUDE USING gist (medico_id WITH =) WHERE (es_default AND activo) DEFERRABLE INITIALLY DEFERRED` sin NOT VALID, que se valida contra todas las filas. El pre-vuelo aborta si algún médico tiene dos predeterminados activos, algo que el índice viejo ya impedía. | El índice `consultorios_default_unico` del volcado #1 (o la constraint `contype='x'` si ya está aplicada) y las columnas `medico_id`, `es_default` y `activo`. Instala `btree_gist` en `extensions`. | Bajo: la cabecera la da por APLICADA Y VERIFICADA en producción el 2026-09-19; si se repite, sale por la rama (a) sin hacer nada. Va sin lock_timeout. |
| 6 | 20261111120000_agenda_a18_indices_rango | No. | No: los dos índices btree que crea sobre `appointments`, `idx_appointments_clinica_inicio` e `idx_appointments_clinica_medico_inicio`, no son únicos. | `appointments` (clinica_id, medico_id, start_time, end_time) del volcado #1, con quien aplica como dueño. Si ya existen índices con esos nombres, el pre-vuelo exige que tengan la misma definición y estén válidos. | Bajo: el CREATE INDEX va sin CONCURRENTLY y toma SHARE sobre `appointments`, que en producción tiene unas 154 filas según la cabecera; con lock_timeout de 5 s. Aborta si existe un homónimo con otra definición o INVALID. |
| 7 | 20261112120000_agenda_b0_auditoria_citas | No al aplicarla. A partir de entonces, cada escritura de cita no técnica añade una fila en `audit_log`. | No. | `appointments` (id, clinica_id, status, paciente_id, origen), `audit_log`, `auth.uid()` y `log_tabla_change()` (sólo para abortar si ya audita `appointments`), todo del volcado #1. Crea `log_cita_change()` y los disparadores `audit_appointments` y `audit_appointments_update`. Necesita PG ≥ 14. | Medio, como estima su propia cabecera: si la función falla, falla toda escritura de citas, incluidos Google y las rutas de servicio, y el disparador no depende del interruptor de la v2. SHARE ROW EXCLUSIVE sobre `appointments` con lock_timeout de 5 s. |
| 8 | 20261112130000_agenda_b1_ajustes_interruptor | No: no hay backfill («sin fila = valores de fábrica»). | No (sólo en tablas nuevas: `agenda_ajustes`, con UNIQUE `clinica_id`, FK RESTRICT a `clinicas` y 5 CHECK). | `clinicas.id`, con quien aplica como dueño. `get_clinica_id()` y `soy_admin_de_clinica()`, que tienen que ser DEFINER, y `log_tabla_change()`, todas del volcado #1. | Bajo: sólo un SHARE ROW EXCLUSIVE momentáneo sobre `clinicas` por la FK. Si la tabla ya existe, el pre-vuelo exige exactamente 13 columnas, así que no se puede repetir después de #30 y #39, que le añaden columnas. |
| 9 | 20261112140000_agenda_b5_horario_propio | No: `ADD COLUMN ... DEFAULT false` es una constante y no reescribe la tabla. | Sí, pero toda fila pasa por construcción: `consultorios.horario_propio boolean NOT NULL DEFAULT false`, y las filas existentes toman el DEFAULT. | `consultorios` del volcado #1, con quien aplica como dueño. Si la columna ya existe, tiene que ser boolean NOT NULL DEFAULT false. | Bajo: ACCESS EXCLUSIVE de un instante sobre `consultorios` (lock_timeout de 5 s). El censo de la rejilla en local sale de la semilla; el número de producción no está determinado. |
| 10 | 20261112150000_agenda_b6_tipos_cita | No: `tipos_cita` nace vacía, y `appointments.tipo_cita_id` y `tipo_cita_nombre` se añaden sin DEFAULT. | Sí, sobre `appointments`: la FK compuesta `appointments_tipo_cita_fkey` (→ `tipos_cita`, RESTRICT) y el CHECK `appointments_tipo_cita_snapshot_check`, sin NOT VALID. Toda fila pasa por construcción porque las dos columnas son nuevas y NULL. El índice único `tipos_cita_nombre_activo_unico` es de la tabla nueva. | `appointments`, `clinicas` y `profiles` del volcado #1, con quien aplica como dueño. `get_clinica_id()`, `soy_admin_de_clinica()` y `get_my_role()`, que el pre-vuelo exige DEFINER, y `log_tabla_change()`. Necesita PG ≥ 14. | Medio: la FK y el CHECK recorren `appointments` con candado fuerte dentro de una sola transacción; con lock_timeout de 5 s aborta si hay escrituras de citas en cola. Por datos no puede fallar. |
| 11 | 20261113120000_agenda_c1_gcal_sync_estado | No (sólo la tabla nueva `gcal_sync_estado`). | No (sólo en tablas nuevas). | `clinica_conexiones_google`, con 7 columnas exactas (volcado #1). `agenda_ajustes.agenda_v2_encendida` de #8. `get_clinica_id()`, `clinica_no_suspendida()` y `clinica_tiene_acceso()` del volcado #1, que tienen que ser LANGUAGE sql de un solo SELECT. service_role con BYPASSRLS. | Medio: antes del COMMIT el post-vuelo ejecuta `gcal_sync_clinica_habilitada`, que lee de `pg_proc` el cuerpo vigente de las dos puertas. Si en producción, o tras `feature/limites-ajustables`, tienen otra forma, la migración entera aborta. |
| 12 | 20261113130000_agenda_c2_gcal_aplicar | No (sólo CREATE OR REPLACE de 4 funciones). | No. | `gcal_sync_clinica_habilitada` y `gcal_sync_estado` de #11. `log_cita_change()` y el WHEN literal de los disparadores `audit_appointments*` de #7. `agenda_ajustes` de #8, aunque el pre-vuelo no lo comprueba. 16 columnas de `appointments` y el índice `appointments_clinica_google_event_id_uniq` del volcado #1. | Medio: reemplaza `log_cita_change`, por donde pasa toda escritura de citas. Aborta si `pg_get_triggerdef` no reproduce el WHEN de #7. Sus cuerpos son anclas md5 de #16 y #17, así que tienen que aplicarse con el texto intacto. |
| 13 | 20261114120000_agenda_d1_enlaces_reserva | No: añade 11 columnas a `appointments`, 10 NULL y `reserva_reagendados` con NOT NULL DEFAULT 0 (constante, no reescribe). | Sí, sobre `appointments`: las FK `appointments_reserva_enlace_fkey` y `appointments_reserva_aviso_fkey`, los CHECK `appointments_reserva_check` y `appointments_reserva_reagendados_check` y el NOT NULL de `reserva_reagendados`, todo sin NOT VALID. Toda fila pasa por construcción (columnas NULL / 0). | `agenda_ajustes.vigencia_enlace_unico_dias` de #8. `tipos_cita` y `appointments.tipo_cita_id` de #10. `get_clinica_id()`, `soy_admin_de_clinica()` y `get_my_role()` (DEFINER) y `log_tabla_change()`; quien aplica tiene que ser dueño de `appointments`, `clinicas` y `profiles`. | Medio: los 11 ADD COLUMN y las 4 constraints mantienen ACCESS EXCLUSIVE sobre `appointments` hasta el COMMIT (lock_timeout de 5 s). El pre-vuelo aborta si encuentra a medias las columnas o las constraints `reserva_*`. |
| 14 | 20261114130000_agenda_d2_candado_reserva | No (sólo las tablas nuevas `reserva_incidencias` y `reserva_contactos`). | No (sólo en tablas nuevas; la FK `reserva_incidencias_cita_fkey` hacia `appointments` la declara la tabla nueva). | `appointments.reserva_*` de #13. Las columnas `candado_*` de `agenda_ajustes` de #8: no están en el pre-vuelo, pero las funciones sql se validan al crearse. `appointments` (medico_id, status, created_at). `log_tabla_change()`. | Medio: el disparador AFTER UPDATE OF status `trg_appointments_reserva_incidencia` (DEFINER) toma SHARE ROW EXCLUSIVE sobre `appointments`. Si la función falla, falla la cancelación de citas por enlace, que hoy no existen. |
| 15 | 20261114140000_agenda_d3_reservar | No (sólo la tabla nueva `reserva_verificaciones`). | No (sólo en tablas nuevas). | En el pre-vuelo: `reserva_enlaces` (#13), `reserva_incidencias` y `reserva_contacto_estado` (#14), `gcal_sync_clinica_habilitada` (#11) y BYPASSRLS de service_role. Sin comprobar: `agenda_ajustes` (#8), `consultorios.horario_propio` (#9), `tipos_cita` (#10) y `reserva_avisos` (#13). | Bajo para el ensayo, aunque la cabecera lo estima ALTO por seguridad (es el único camino sin sesión que escribe citas). Una columna que falte sólo daría error al reservar, porque plpgsql no valida al crear. Sus cuerpos son anclas md5 de #25 y #26. |
| 16 | 20261114150000_agenda_d4_gcal_por_ligar | No (CREATE OR REPLACE de 2 funciones y un COMMENT). | No. | De #12, `gcal_aplicar_evento` con md5 `f5da38cc2fa9a0ddb37aaba5f890f1a2` y `gcal_citas_por_evento` con `a1a53c1db9a323cc4103da8d797aa0e8` (o los suyos, `5ac551e4…` y `66feb69a…`), exigidos en el pre-vuelo. `reserva_canal` y `reserva_nombre` de #13. | Bajo: sólo catálogo. Aborta si el cuerpo de #12 no coincide byte a byte (p. ej. finales de línea alterados al pegarlo). |
| 17 | 20261115120000_agenda_e1_confirmacion_enlace | No (sólo la tabla nueva `cita_confirmaciones`). | No (sólo en tablas nuevas: CHECK, UNIQUE `codigo_hash` e índice único parcial `cita_confirmaciones_vigente`). | `log_cita_change()` con md5 `e57358a132ad89fc94c4df136c40f65f` de #12 (o el suyo, `80c3556c…`) y el WHEN exacto de los disparadores de #7. `clinica_no_suspendida()` con md5 normalizado `588de29d551f6d474eb24346748e1148`, el cuerpo del volcado #1. `gcal_sync_clinica_habilitada` (#11), `agenda_ajustes` (#8) y `appointments.reserva_*` (#13). | Medio: vuelve a reemplazar `log_cita_change`, que dispara en cada escritura de citas. Aborta si el cuerpo de producción de `clinica_no_suspendida()` difiere del volcado (no determinado). Las FK toman SHARE ROW EXCLUSIVE sobre `appointments` (lock_timeout de 5 s). |
| 18 | 20261115130000_agenda_e6_reagendar | No (sólo la tabla nueva `cita_reagendos`; de `appointments.reserva_reagendados` sólo cambia el COMMENT). | No (sólo en tablas nuevas: UNIQUE origen/nueva y CHECK `numero` entre 1 y 100). | `log_cita_change` con md5 exacto `80c3556c1655ddf2eaf1d57995190463` (el de #17). `cita_confirmaciones`, `cita_confirmacion_coincide` y `cita_confirmacion_responder` de #17. `reservar_por_enlace` de #15, sólo firma e INVOKER, sin md5. `candado_reagendados` (#8), `reserva_reagendados` (#13) y `clinica_no_suspendida()` con md5 `588de29d…`. | Medio: aborta si #17 no está aplicada o si alguien tocó `log_cita_change` después. Las FK toman SHARE ROW EXCLUSIVE sobre `appointments` y `cita_confirmaciones`. |
| 19 | 20261115140000_agenda_e4_correos_cita | No (sólo la tabla nueva `cita_correos`). | No (sólo en tablas nuevas: UNIQUE `(appointment_id, tipo, inicio_cita)` y CHECK). | `cita_confirmaciones` y `cita_confirmacion_emitir` de #17. `gcal_sync_clinica_habilitada` de #11. `recordatorio_horas` y `agenda_v2_encendida` de #8. `reserva_canal` y `reserva_correo` de #13. `pacientes.email`/`activo` y `profiles` del volcado #1. | Bajo: la tabla es nueva y está vacía, y el pre-vuelo sólo mira columnas y privilegios. Las FK toman un instante SHARE ROW EXCLUSIVE sobre `appointments` y `clinicas`. |
| 20 | 20261115160000_agenda_e9_rsvp_google | No (sólo crea la función `cita_rsvp_google`). | No. | `log_cita_change` con el literal `google_rsvp`, comprobado por `position` y no por md5 (#17). `agenda_ajustes` (#8). `clinica_conexiones_google` (volcado #1). `appointments.google_event_id`, `gcal_calendar_id` y `reserva_correo` (#11/#13), más `reserva_canal`, que el pre-vuelo no comprueba. `pacientes.email`. | Bajo: sólo catálogo, sin candados de tabla. La función no mira `clinicas.suspendida`; es una decisión pendiente de Angel (H4 de §7). |
| 21 | 20261116120000_agenda_d11_sync_antes_de_reservar | No (sólo la tabla nueva `reserva_empalmes_google`). | No (sólo en tablas nuevas: UNIQUE del par y CHECK `distintas`). | `gcal_sync_estado` (`ultima_ok`, `candado`, `candado_hasta`) de #11. `agenda_v2_encendida` de #8, con SELECT de service_role. `reserva_canal` de #13. `get_clinica_id()` e INSERT de service_role en `audit_log`. | Bajo: la tabla es nueva, está vacía y no tiene FK hacia `appointments`. La FK hacia `clinicas` toma SHARE ROW EXCLUSIVE hasta el COMMIT. |
| 22 | 20261117120000_agenda_seg_borrado_cita | No (sólo crea `cita_proteger_borrado()` y su disparador). | No: `trg_appointments_proteger_borrado` es un disparador BEFORE DELETE, no una restricción, y no valida filas. | `agenda_ajustes.clinica_id` y `agenda_v2_encendida` (#8), con SELECT de authenticated y service_role. `appointments.paciente_id` y `reserva_canal` (#13). Quien aplica tiene que ser dueño de `appointments`. | Bajo: SHARE ROW EXCLUSIVE momentáneo sobre `appointments`. Con la v2 apagada no cambia nada; en las clínicas encendidas frena también a service_role. |
| 23 | 20261117121000_agenda_seg_columnas_reserva | No (sólo crea `cita_proteger_reserva()` y su disparador). | No: `trg_appointments_proteger_reserva` es un disparador BEFORE INSERT OR UPDATE, no una restricción. | `appointments.reserva_telefono`, `reserva_correo` y `reserva_reagendados` (int2 con DEFAULT exactamente 0, y ninguna otra `reserva_*` con DEFAULT), todas de #13. Quien aplica tiene que ser dueño de `appointments`. La cabecera pide además #18. | Medio: actúa en toda escritura de citas con sesión y no mira el interruptor, así que cualquier camino de sesión que hoy escriba `reserva_*` falla con 42501. El pre-vuelo aborta si producción tiene otro DEFAULT en esas columnas. |
| 24 | 20261117122000_agenda_seg_emision_enlaces | No (CREATE OR REPLACE de `proteger_reserva_enlaces()` y función nueva `reserva_enlace_emitir`). | No. | `proteger_reserva_enlaces()` INVOKER con md5 `181cee8564a9ab7c0ad01c51d63af04f` de #13 (o el suyo, `acd4128b…`), y el disparador `trg_reserva_enlaces_proteger` de #13. `vigencia_enlace_unico_dias` (#8). `profiles.role` y `es_admin_de_clinica`. | Bajo: sólo catálogo. Desde aquí el INSERT con sesión en `reserva_enlaces` da 42501, así que el código viejo deja de emitir enlaces (con la v2 apagada esa ruta ya responde 404). |
| 25 | 20261117130000_agenda_seg1_candado_correo | No (CREATE OR REPLACE de 3 funciones y un COMMENT ON TABLE). | No. | md5 exactos, todos INVOKER: `reserva_contacto_estado` `d694184dc3d00292e575524178d39401` (#14), `reserva_ocupacion` `648672c060c56ece3a81f91213e708fc` (#15) y `reservar_por_enlace` `52ee7af1aa2825571925887a9b41ce9a` (#15), o los suyos en una re-ejecución. Usa sin comprobarlas `reserva_verificaciones.ficha_*` (#15), `reserva_avisos` (#13) y `tipos_cita.duracion_min` (#10). | Medio: aborta si #14 o #15 no están intactas. Las columnas que usa sin comprobar sólo darían error al reservar, porque plpgsql no valida al crear. |
| 26 | 20261119120000_agenda_g2_duracion_consulta | No: `tipos_cita.consultorio_id` (NULL) y `principal` (NOT NULL DEFAULT false, constante) no reescriben, y no hay UPDATE. | Sí, sobre `tipos_cita` (de #10): la FK `tipos_cita_consultorio_id_fkey`, los CHECK `tipos_cita_principal_check` y `tipos_cita_consultorio_check` (DROP + ADD, sin NOT VALID), el DROP + CREATE UNIQUE INDEX de `tipos_cita_nombre_activo_unico` con un predicado más estrecho y el UNIQUE `tipos_cita_principal_unico`. Toda fila pasa por construcción (`principal=false`, `consultorio_id` NULL). | `tipos_cita` y las policies `tipos_cita_insert`/`tipos_cita_update` de #10, comparadas por su texto exacto en `pg_get_expr`. `reserva_contexto` con md5 `3c2c9c91414e8fe58fe4504e58ccdde9` de #15 (o el suyo, `8d81bc66…`). `horario_propio` (#9). Helpers DEFINER del volcado #1. | Medio (la cabecera también dice MEDIO): aborta si las policies de #10 no salen literalmente iguales o si el md5 de `reserva_contexto` no coincide. ACCESS EXCLUSIVE sobre `tipos_cita`; si la tabla tiene filas, salen de lo creado tras #10 (en local, de la semilla). |
| 27 | 20261119121000_agenda_g2_tipos_cita_update | No. | No (sólo DROP + CREATE de la policy `tipos_cita_update`). | `tipos_cita_insert` exactamente como la deja #26. `tipos_cita_update` de #10, tanto USING como WITH CHECK. Que no haya ninguna policy de DELETE ni ALL en `tipos_cita`. Helpers DEFINER. | Bajo: aborta si #26 no se aplicó antes o si alguien cambió la policy de UPDATE. ACCESS EXCLUSIVE de un instante sobre `tipos_cita`. |
| 28 | 20261119130000_agenda_g4_herencia_horario_consultorios | Sí, es un backfill: UPDATE de todos los `consultorios` con `horario_propio=false`, de todas las clínicas e incluidos los archivados (`horario := clinicas.horario_consulta`, `horario_propio := true`). Antes copia un respaldo en la tabla nueva `respaldos.consultorios_horario_20261119`. Los disparadores escriben una fila de `audit_log` por consultorio. | No (sólo en la tabla nueva de respaldo). | `horario_propio` de #9. `consultorios.horario`, `clinicas.horario_consulta` y el esquema `respaldos`, del volcado #1. Los disparadores de `consultorios`, entre ellos `enforce_consultorio_default_existencia` y `audit_consultorios` (volcado #1 y #5). | Medio: reescribe datos reales, que en producción son todos los consultorios. El pre-vuelo 1.4 aborta si algún médico afectado tiene consultorios activos sin predeterminado; eso depende de datos reales y en local sólo se probó con los 4 consultorios de la semilla. |
| 29 | 20261119140000_agenda_g3_correo_confirmacion | No. | Sí, sobre `cita_correos` (de #19): DROP + ADD de `cita_correos_tipo_check` sin NOT VALID. El CHECK nuevo es más ancho (añade 'confirmacion'), así que ninguna fila existente puede violarlo, y el pre-vuelo lo comprueba. | `cita_correos` y `cita_correos_tipo_check` de #19. `cita_correo_tomar(uuid,uuid,text,uuid)` INVOKER, sin sobrecarga y con md5 `d7c18c8e5ba999f3b280056b74539bf2` de #19 (o el suyo, `5d0ce8db…`). `recordatorio_horas` (#8), `gcal_sync_clinica_habilitada` (#11) y `reserva_*` (#13). | Bajo: si va en la misma ventana que #19, `cita_correos` estará vacía. Aborta si el md5 de `cita_correo_tomar` no es el de #19. |
| 30 | 20261120120000_agenda_h2_recordatorio_interruptor | No: no hay backfill. `agenda_ajustes.recordatorio_encendido` se añade como NOT NULL DEFAULT false, una constante que no reescribe la tabla. | No: el NOT NULL de la columna nueva se cumple por construcción con el DEFAULT. | `agenda_ajustes` de #8. `cita_correos_pendientes(integer)` INVOKER con md5 `a8b08c15c9f44c50a8a2f8d4aeff08ee` de #19. `gcal_sync_clinica_habilitada` (#11), `cita_correos` (#19) y `reserva_*` (#13). | Bajo: ACCESS EXCLUSIVE de un instante sobre `agenda_ajustes`. El efecto es deliberado: deja el recordatorio APAGADO en todas las clínicas, también en las que ya tienen la v2. |
| 31 | 20261120121000_agenda_h2_restablecer_configuracion | No al aplicarla: sólo crea `agenda_restablecer_configuracion(uuid,uuid)`, que hace UPDATE e INSERT de una sola clínica cuando alguien la llama. | No. | `recordatorio_encendido` de #30 y los DEFAULT de `agenda_ajustes` de #8. `horario_propio` (#9), `clinicas.horario_consulta`, `tipos_cita` (#10) y `reserva_enlaces.revocado_por` (#13). `proteger_reserva_enlaces()` con md5 que empiece por `acd4128b` (#24). | Bajo: no toma candados de tabla. Aborta si falta #30 o si `proteger_reserva_enlaces` no es la de #24. |
| 32 | 20261120130000_agenda_h5_atendida_con_nota | No. Pero el disparador nuevo actúa desde ese momento sobre las citas atendidas con nota que ya existen: veta siempre el cambio de estado y el DELETE, y el cambio de hora sólo con la v2 encendida. | No: un disparador BEFORE UPDATE OR DELETE no valida filas existentes. | `agenda_ajustes` de #8, con SELECT de authenticated y service_role. `appointments` y `appointments_status_check` con 'attended' (volcado #1). `consultas.appointment_id`/`paciente_id`. Quien aplica tiene que tener BYPASSRLS. La rejilla espera además los disparadores de #22 y #23. | Bajo: SHARE ROW EXCLUSIVE sobre `appointments`, una tabla con mucho tráfico, con lock_timeout de 5 s. No está determinado si `postgres` tiene `rolbypassrls` en producción, y el pre-vuelo lo exige. |
| 33 | 20261121120000_agenda_i2_unico_sin_correo | No (sólo CREATE OR REPLACE de `reservar_por_enlace` y su COMMENT). | No: no añade restricciones. El pre-vuelo exige que `appointments_reserva_check` de #13 siga admitiendo `reserva_correo` NULL. | `reservar_por_enlace` INVOKER con md5 `d3ddd46b556be508622917070d798872` de #25 (o el suyo, `600fc445…`). `appointments_reserva_check` (#13). `pg_catalog.sha256`. En el cuerpo usa objetos de #8, #10, #11, #13, #14 y #15. | Bajo: aborta si `reservar_por_enlace` no tiene exactamente el cuerpo de #25, por ejemplo si #25 no se aplicó o alguien la tocó. Sólo catálogo. |
| 34 | 20261121121000_agenda_i2_candado_eleccion | No (crea `cita_proteger_eleccion()`, `cita_reagendar_clinica(...)` y un disparador). | No: el disparador BEFORE UPDATE `trg_appointments_proteger_eleccion` no valida filas. | `agenda_v2_encendida` (#8). `reserva_canal` (#13) y `consultorio_*` de `appointments`. `consultorios` y `profiles.es_admin_de_clinica` (volcado #1). La policy `appointments_update` comparada con un literal sin `public.` en `pg_get_expr`. La cabecera pide #23, pero el pre-vuelo no lo comprueba. | Medio: ASUMIENDO que `public` está en el `search_path` de la sesión que aplica; si no, `pg_get_expr` califica las funciones como `public.…` y el pre-vuelo aborta. Toma SHARE ROW EXCLUSIVE sobre `appointments` (5 s) y, ya aplicada, el código viejo recibe un 500 al mover una cita por enlace futura. |
| 35 | 20261121130000_agenda_i3_por_asignar_google | No: `appointments.google_asignacion` se añade NULL y sin DEFAULT, y no se rellena. | Sí, sobre `appointments`: `appointments_google_asignacion_check`, con NOT VALID y luego VALIDATE en la misma transacción. Toda fila pasa por construcción porque la columna es nueva y NULL. | `appointments.origen`, `paciente_id`, `all_day` y `end_time` (volcado #1 / #12). `reserva_canal` (#13). `gcal_importar_evento(...)` de #12, comprobada con un regex sobre `prosrc` (que haga `set_config('spinus.via','google',true)` y el INSERT), no con md5. Necesita PG ≥ 14. | Bajo: el VALIDATE no puede fallar con datos reales, pero el ACCESS EXCLUSIVE sobre `appointments` dura hasta el COMMIT (el NOT VALID no gana nada, como admite la cabecera) y aborta si no consigue el candado en 5 s. |
| 36 | 20261121140000_agenda_i4_atendida_no_se_mueve | No (sólo CREATE OR REPLACE de `cita_proteger_atendida()`). | No. | `cita_proteger_atendida()` INVOKER con md5 `74dde456021053f4a15a0c1c5325c4f2` de #32 (o el suyo, `cfc4fcd7…`). `cita_tiene_nota_ligada(uuid,uuid)` y `trg_appointments_proteger_atendida` de #32; la rejilla espera para la primera el md5 `39f40c71…`. | Bajo: aborta si el cuerpo de #32 en producción no tiene ese md5. Ese md5 no aparece escrito en el archivo de #32; el reinicio local desde cero pasa el pre-vuelo, así que es el del cuerpo de #32 del repo (integrador, 2026-11-17). Desde ese momento, mover una atendida con nota da 42501 también con la v2 apagada. |
| 37 | 20261121141000_agenda_i4_horario_revisado | No: `consultorios.horario_revisado_en` se añade NULL y sin DEFAULT, sin backfill. Los UPDATE que contiene están dentro de la función. | No. | `agenda_restablecer_configuracion(uuid,uuid)` con md5 `6c99e553177ba42d0f3723468b39f241` de #31 (o el suyo, `1c390644…`) y sin sobrecarga. `horario_propio` (#9), `recordatorio_encendido` (#30), `tipos_cita.activo` (#10), `reserva_enlaces.revocado_*` (#13/#24) y `clinicas.horario_consulta`. | Bajo: aborta si la función no tiene exactamente el cuerpo de #31. ACCESS EXCLUSIVE de un instante sobre `consultorios`. Efecto real: todos los consultorios de producción quedan «por revisar» (NULL). |
| 38 | 20261121142000_agenda_i4_cancelada_cerrada | No: `appointments.cerrada_en` y `sustituida_por` se añaden NULL y sin DEFAULT, y no se rellenan. | Sí, sobre `appointments`: la FK `appointments_sustituida_por_fkey` (hacia la propia tabla, RESTRICT) y el CHECK `appointments_cierre_check`, los dos sin NOT VALID, más un índice parcial no único. Toda fila pasa por construcción porque las columnas son nuevas y NULL. | `appointments.id`, `clinica_id` y `status`, y `appointments_status_check` con 'cancelled' (volcado #1). El disparador `trg_appointments_proteger_reserva` de #23. Necesita PG ≥ 14. | Medio: el ADD CHECK y el ADD FK recorren `appointments` bajo ACCESS EXCLUSIVE con lock_timeout de 5 s. No pueden fallar por datos, sólo por el candado. El disparador nuevo, que rechaza reabrir una cita cerrada, actúa en todas las citas. |
| 39 | 20261121150000_agenda_i5_avisos_clinica | Sí, por inserciones de arrastre en la tabla nueva `avisos_clinica` a partir de filas existentes de `reserva_empalmes_google` (últimos 30 días) y `cita_confirmaciones` con `respuesta='cancelo'` (últimas 48 h). No modifica tablas que ya existían: `agenda_ajustes.correo_reserva_clinica` NOT NULL DEFAULT false es una constante y no reescribe. | No sobre tablas con filas: el NOT NULL con DEFAULT de `agenda_ajustes` se cumple por construcción. El índice único parcial `avisos_clinica_pendiente_key` es de la tabla nueva. | `agenda_ajustes` (#8), `cita_confirmaciones` (#17), `cita_reagendos` (#18), `reserva_empalmes_google` (#21), `appointments.reserva_enlace_id` (#13), `origen` y `google_asignacion` (#35; el pre-vuelo exige que vaya antes). `get_clinica_id()` y `log_tabla_change()`. El pre-vuelo no comprueba `detectado_en`, `respondido_en`, `cita_nueva_id` ni `cita_reserva_id`. | Medio: crea cuatro disparadores AFTER SECURITY DEFINER sobre tablas vivas (`appointments`, `cita_confirmaciones`, `cita_reagendos`, `reserva_empalmes_google`), así que un fallo al insertar en `avisos_clinica` aborta la RPC que lo dispara. El arrastre depende de datos que en local vienen sólo de la semilla; en producción debería insertar 0 filas. |

**Observaciones del revisor de la tabla:**

- **Funciones reemplazadas varias veces, con cadenas de md5.** Cada eslabón exige el cuerpo exacto que dejó el anterior, así que ninguna puede saltarse ni tocarse a mano entre medias:
  - `log_cita_change`: #7 → #12 → #17; #18 exige el md5 de #17.
  - `reservar_por_enlace`: #15 → #25 → #33.
  - `reserva_contacto_estado` (#14) y `reserva_ocupacion` (#15) → #25.
  - `reserva_contexto`: #15 → #26.
  - `proteger_reserva_enlaces`: #13 → #24; #31 exige `acd4128b%`, que es el cuerpo de #24.
  - `cita_correo_tomar`: #19 → #29.
  - `gcal_aplicar_evento` y `gcal_citas_por_evento`: #12 → #16.
  - `agenda_restablecer_configuracion`: #31 → #37.
  - `cita_proteger_atendida`: #32 → #36.
  - En orden de nombre todas las cadenas son coherentes: no hay ningún pre-vuelo que exija el md5 de un cuerpo que otra migración anterior del conjunto ya hubiera reemplazado.
- **#18 (E6) depende de `reservar_por_enlace` sólo por firma, sin md5.** Esa función la reemplazan después #25 y #33, y #18 hereda el cuerpo que haya en cada momento.
- **Huellas md5 que no se pueden contrastar con el repo:**
  - El md5 que #36 exige del cuerpo de #32 (`74dde456…`) y el de `cita_tiene_nota_ligada` (`39f40c71…`) no aparecen en el archivo de #32. Sólo se comprueban al aplicar.
  - #31 se editó después de su auditoría («se edita aquí y no con otra migración», línea 108), así que el md5 `6c99e553…` que exige #37 corresponde al archivo ya editado.
- **Contra datos reales, el único riesgo es #28 (G4).** Hace el único backfill sobre una tabla de producción del conjunto (`consultorios`), y su pre-vuelo 1.4 depende de datos que en local sólo existen en la semilla. Las demás restricciones sobre tablas con filas (#3, #9, #10, #13, #26, #29, #35, #38) pasan por construcción: son columnas nuevas NULL o con DEFAULT constante, o un CHECK más ancho. La que se valida contra todas las filas es #5, ya aplicada según su cabecera.
- **Candados sobre `appointments`.** Toman candados fuertes, con lock_timeout de 5 s, #6, #7, #10, #13, #14, #17, #18, #22, #23, #32, #34, #35, #38 y #39: el riesgo práctico del ensayo es que alguna aborte por candado y no por datos. En `appointments` se apilan disparadores BEFORE (`proteger_borrado`, `proteger_reserva`, `proteger_atendida`, `proteger_eleccion`, `asignacion_google`, el de cierre) y AFTER (`audit_*`, `reserva_incidencia`, `aviso_clinica`).
- **Pre-vuelos que comparan texto deparseado y no md5.** #26 y #27 (policies de `tipos_cita`), #34 (`appointments_update`), #12 y #17 (WHEN de los disparadores de #7) y #11 (forma de `clinica_tiene_acceso`/`clinica_no_suspendida`) pueden abortar por diferencias de `search_path` o de versión de Postgres, no sólo por cambios reales. #11, #17 y #18 están además acoplados al cuerpo de `clinica_tiene_acceso()`/`clinica_no_suspendida()` del volcado. Si `feature/limites-ajustables` o producción los reescriben, esas migraciones abortan (no determinado: no encontré en este repo una migración que los cambie).
- **Las cinco de `main` no están todas aplicadas según sus propias cabeceras.** #4 (`auth_02`) dice «ESTADO · PRODUCCIÓN: PENDIENTE DE APLICAR», mientras #2, #3 y #5 dicen APLICADA Y VERIFICADA. Además, #1 a #5 no llevan lock_timeout y #1 no se puede volver a ejecutar.
- **La documentación cubre 32 migraciones, no 39.** Las siete de la tanda I (`20261121*`, #33 a #39) no aparecen ni en §7 de `mejora_agendaV2.md` (que habla de un conjunto de 27 de la agenda) ni en `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` (grep de `20261121`: 0 coincidencias). El conjunto real es de 34 migraciones de la agenda más las 5 de `main`.
- **Re-ejecuciones bloqueadas por diseño.** #8 después de #30 y #39, #19 después de #29 y #26 después de #27 abortan si se repiten. No afecta a una aplicación única en orden.
- **Incoherencias menores:**
  - La cabecera de #39 dice que no cambia ninguna fila existente, pero sí lee filas existentes para el arrastre (sólo escribe en la tabla nueva).
  - #23 y #34 piden en la cabecera migraciones previas (#18 y #23) que su pre-vuelo no comprueba.
  - #15 no comprueba B1, B5 ni B6.
  - En orden de nombre todas esas dependencias llegan antes, así que no hay ninguna fuera de orden.
- **#33 (i2) y el CHECK de #13 son coherentes, pero con un truco.** El CHECK de #13 exige `reserva_correo_hmac` NOT NULL en las citas de reserva. #33 lo cumple sin correo guardando un seudónimo propio, `sha256('reserva-sin-correo:'||id)`, que no coincide con nadie.

---

## 6-bis. Decisiones para la auditoría final

Todas las decisiones tomadas sin una regla previa del plan, con el valor que
quedó y por qué. Angel aprobó el 2026-11-12 los valores propuestos de B y C
**siempre que no contradigan §2**; donde contradicen, manda §2 y la diferencia
queda listada aquí.

### Generales y de entorno

- **P1. Interruptor:** uno por clínica, `agenda_ajustes.agenda_v2_encendida`
  (`false` por omisión), que solo `postgres`/`supabase_admin` cambian (lo
  enciende Angel por SQL). Falla cerrado: error al leer o tabla ausente =
  apagado. Por qué: se puede probar en una clínica antes que en todas, y una
  constante no podría valer distinto en local y en producción.
- **P2** (aprobado al inicio): turno = duración del tipo de cita; «eliminar»
  una cita con paciente la cancela y queda en auditoría; funciones nuevas
  apagadas por interruptor.
- **P10. Auditoría estricta:** si falla la escritura en `audit_log`, falla la
  de la cita. Igual que las otras 7 tablas clínicas.
- **Auditoría siempre encendida** (B0), fuera del interruptor: es regla de
  `CLAUDE.md`.
- **Lint:** el compilador de react-hooks se saltaba `AgendaCliente` entero; en
  los ganchos nuevos el patrón «último valor» que exige FullCalendar va con
  `eslint-disable-next-line` justificado en cada línea. Total: 96 errores, igual
  que `main`.
- **No se cambió ningún `getUser()` por `getClaims()`.** A1.7 (Google sembrado
  en servidor con cliente admin) quedó fuera.

### Bloque A

- **Semilla de 3 semanas por apertura** (W-1, W, W+1, con nombre, teléfono y
  correo del paciente): aprobada por Angel el 2026-11-12.
- **Caché de rangos:** versión mínima, se vacía entera ante cualquier escritura
  propia o evento de tiempo real (de cualquier clínica, porque los DELETE de
  Realtime llegan sin RLS con solo el `id`). Invalidación fina: pendiente.
- **`count: 'exact'`** se queda (+0.7 ms; sin él no se detecta el truncado).
- **PERF-DT-4** (funciones de RLS por fila) medido, no tocado: es RLS.
- **«Ver todos los médicos»** de la banda de vacío: arreglado (defecto), y no
  se muestra en Mes, donde «Todos» no existe.

### Bloque B (propuestas aprobadas)

- **P3. Empalme:** del mismo médico (no del consultorio); cuentan citas y
  eventos sin paciente; **no cuentan las citas `no_show` ni `cancelled`**
  (corrección de Angel del 2026-11-12, igual que no ocupan hueco en
  `docs/spec/SPEC_AGENDA.md` §8.4), ni los eventos de Google ni los de todo el
  día; si además cae fuera de horario, dos avisos seguidos. No bloquea.
- **P4. Cancelación:** el evento de Google se conserva con el prefijo
  «CANCELADA — » (correo de «evento actualizado») en vez de borrarse; una cita
  con paciente cancelada no se puede borrar nunca; una cita `attended` se puede
  seguir cancelando como hoy; las canceladas siguen visibles en la rejilla.
- **P5. Tipos de cita:** de clínica o de un médico (`medico_id` opcional); los
  edita el administrador; el invitado no ve tipos personales de otros médicos;
  duración 5–600 min en múltiplos de 5; el color es solo marca en el selector,
  nunca sustituye al color del estado; solo citas con paciente; opcional; con
  instantánea del nombre; reasignar a un médico incompatible → 400; el nombre
  del tipo **no** aparece en la tarjeta (se conserva la tarjeta de dos líneas).
  - **B6c, cómo quedó en el alta y la edición:** la duración del tipo **no** la
    impone el servidor: elegirlo en el modal escribe el fin (inicio + duración)
    como los botones de duración, y el usuario puede retocarlo; el servidor
    guarda y calcula el empalme con el fin que llega. La validación del tipo va
    antes del empalme (un 400 nunca llega después de aceptar un empalme) y falla
    cerrada (si no se puede leer el tipo, 500 y no se escribe). Con B3: quitar el
    paciente de una cita sigue dando el 409 `cita_con_paciente`, que va primero;
    `tipo_sin_paciente` sólo sale al ponerle un tipo a un evento sin paciente.
    Resto conocido: con el interruptor apagado, una cita con tipo a la que se le
    quita el paciente conserva el tipo (apagado no se nombran las columnas); al
    volver a encenderlo, el modal manda `tipo_cita_id: null` al editar ese evento.
    Al editar, el tipo que la cita ya tenía se conserva aunque esté archivado
    (se muestra con su instantánea) mientras no cambie el médico.
- **P6. Disponibilidad:** un tramo por día, sin pausa de comida (la forma
  actual del horario); el horario del consultorio lo edita su dueño (RLS de
  hoy); la rejilla sigue pintando el horario de la clínica.
- **P7. Pantalla de configuración:** secretaria e invitado la ven en solo
  lectura; cada médico edita su propia disponibilidad.
- **P8.** `PUT /api/me/horario` se endurece (rechaza fin ≤ inicio en un día
  activo) y se audita. Fuera del interruptor.
- **P9. Turnos ofrecidos:** consecutivos desde el inicio de cada hueco, con paso
  igual a la duración del tipo.
- **Ajustes por clínica** (§2): recordatorio 24 h (1–72), anticipación 2 h
  (0–72), horizonte 60 días (1–365), vigencia del enlace de un solo uso 7 días
  (1–30); los números del candado (1 / 2 / 3 en 60 días) guardados sin exponer.

### Bloque B — decisiones tomadas al construir (ninguna contradice §2)

- **B3 cancelar:** con el interruptor encendido, `DELETE` de una cita con
  paciente da 409 `cita_con_paciente` (antes de borrar y de programar el
  borrado en Google); quitar el paciente de una cita (PUT) también da 409, para
  que no se pueda desligar y borrar el resto. «Nunca se borra» solo rige con el
  interruptor encendido; apagado, el borrado es el de hoy. Si leer el
  interruptor falla en ese instante, cuenta como apagado (diseño «falla
  cerrado» del interruptor) y la cita se borra como hoy. **Abierto:** un
  `DELETE` directo por PostgREST, sin pasar por la API, no se bloquea (haría
  falta una migración). **→ Cerrado por `20261117120000` (ver «Correcciones de
  seguridad en la base tras la revisión independiente»).**
- **B7 empalme:** se detecta en el servidor (autoridad: ve otras semanas,
  médicos fuera del filtro y escrituras simultáneas) y en el cliente sobre lo
  pintado (inmediato). El servidor responde 409 `{error:'empalme',
  empalmes:[…]}` sin escribir salvo que todos estén en `empalmes_aceptados`;
  nombres solo de filas que la RLS ya deja ver; como máximo 6 nombres. Tocar
  extremos (10:00–10:30 y 10:30–11:00) no es empalme. Las filas
  `origen='google'` no cuentan. Si la búsqueda falla, el guardado sigue sin
  aviso (falla abierto: el aviso no bloquea).
- **B5 disponibilidad:** el orden del horario (fin > inicio) solo se exige con
  el interruptor encendido. `horarioEfectivo` cae a `HORARIO_DEFAULT` si la
  clínica no tiene horario, igual que la rejilla. Aceptado por la auditoría:
  el dueño puede escribir `consultorios.horario_propio` directo por PostgREST
  con el interruptor apagado (la policy es por fila); nada lo lee fuera del
  código que exige el interruptor.
- **B6 tipos de cita:** el ámbito (`medico_id`) no se edita: se archiva y se
  crea otro. No hay DELETE: se archivan. `tipos_cita` no lleva la policy
  RESTRICTIVE de suscripción (como `agenda_ajustes`): una clínica degradada
  puede crear tipos pero no citas. El servidor no impone la duración del tipo:
  el modal propone fin = inicio + duración y el usuario puede cambiarla. Leer
  el tipo falla cerrado (500); el empalme falla abierto. Con el interruptor
  apagado, quitar el paciente conserva el tipo (no se nombran columnas
  nuevas); al reencender, la siguiente edición lo limpia.
- **B4 pantalla de configuración** (`/agenda/configuracion`): con el
  interruptor apagado da `notFound()`; por la frontera de `loading.tsx`, el
  estado HTTP puede ser 200 con la página de no encontrado (Next 16, «Status
  Codes»); las API sí dan 404. La auditoría de los ajustes la hace el
  disparador `log_tabla_change` (fila `UPDATE` con el usuario, sin diff de
  valores). Con el interruptor encendido el engrane lo ven todos los roles
  (P7) y lleva a la pantalla; apagado, queda como hoy. Invitado y secretaria
  ven solo tipos activos; el administrador también los archivados.
- **P8:** además de fin ≤ inicio, `PUT /api/me/horario` rechaza horas mal
  escritas aunque el día esté inactivo y claves de más en el cuerpo.
- **B8 turnos:** módulo `turnosAgenda.ts` (puro). En las cuatro zonas con
  horario de verano de EE. UU. el servidor calcula bien; el panel del navegador
  conserva su desfase de 60 min esos dos días del año (no se cambió lo que se
  ve). La hora que no existe en marzo no ofrece turnos; la hora repetida de
  noviembre se cuenta una vez.
- **ProximasCitas:** la constante del umbral de 2 min se repite con una nota
  que remite a la de la agenda (la original es local a un gancho de la ruta).
- **Propuesta adicional para `AUDITORIA-MIGRACIONES.md`** (de los auditores de
  B5 y B6; no se toca el archivo): vigilar columnas nuevas bajo una policy por
  fila que solo un interruptor de la aplicación protege.

### Bloque C (propuestas aprobadas, con las diferencias por §2)

- **C-b. Importación inicial:** desde hace 30 días, sin límite hacia adelante.
- **C-c. Médico de un evento importado:** el dueño de la cuenta de Google
  conectada (lo que ya hace la vista de hoy).
- **C-f. Cancelación desde Google:** sin aviso aparte a la clínica; se ve en la
  agenda y en la auditoría.
- **C-g. Tarea programada:** Vercel Pro (confirmado por Angel): cada 10 min,
  más sondeo al abrir la agenda (administrador y secretaria, mínimo 60 s entre
  sondeos por clínica), para que nada dependa solo de la tarea. Se deja el
  código y `vercel.json` listos; activarlo le toca a Angel.
- **C-h.** Antes de encender, revisar el panel de auditoría: C es el primer
  productor en volumen de `user_id='system'` (no es uuid).
- **Disparo:** sondeo con `syncToken`; webhook (`events.watch`) solo como fase
  opcional posterior.
- **Conflicto:** gana el último cambio (`event.updated` contra `updated_at`), con
  `etag` + `If-Match` al escribir; todo conflicto a `audit_log` (nombres de
  campos, nunca valores).
- **Correcciones de Angel del 2026-11-12, que mandan sobre §2:**
  - **C-a. Recurrentes creados en Google:** **no** se importan como filas;
    siguen como hoy, visibles en solo lectura.
  - **C-d. Título:** el de una cita **con** paciente no se acepta desde Google;
    Spinus lo restablece. En eventos **sin** paciente el título sí vuelve a
    Spinus. Las observaciones de una cita con paciente no viajan en ningún
    sentido (S1).
  - **C-e. Estado:** solo las citas `scheduled` o `confirmed` aceptan cambios
    desde Google. Si en Google se mueve o se borra el evento de una cita
    `attended`, `no_show` o `cancelled`, Spinus lo ignora, lo registra en
    auditoría y vuelve a escribir en Google el estado que tiene en Spinus.
    Restaurar en Google un evento borrado no reactiva la cita.
  - Diferencia con §2 («lo que se mueva, edite o cancele en Google vuelve a
    Spinus»; «eventos creados en Google entran como filas reales»): §2 queda
    acotado por estas tres reglas.

### Seguridad (decididas por Angel el 2026-11-12)

- **S1. Observaciones a Google:** las observaciones escritas en Spinus **no**
  viajan a Google, tampoco las de eventos sin paciente (una reserva por enlace
  es un evento sin paciente con datos de una persona). Única excepción: un
  evento que nació en Google conserva su descripción sincronizada en los dos
  sentidos mientras no esté ligado a un paciente; al ligarlo, deja de
  enviarse. **Diferencia con §2**, que decía que las de eventos sin paciente sí
  viajaban: manda la decisión de Angel.
- **S2. Ruta de la tarea programada:** pública, protegida con `CRON_SECRET`;
  comparación del secreto en tiempo constante; respuesta sin ningún dato; cada
  consulta con cliente de servicio filtrada por `clinica_id`; la ruta se añade
  a las rutas públicas del middleware sin tocar las existentes.
- **S3. Acceso de la clínica para sincronizar:** **no** se suplantan claims ni
  rol. Función aparte que recibe `clinica_id`, ejecutable solo por
  `service_role`, sin modificar `clinica_tiene_acceso()` ni ninguna policy, con
  prueba SQL que demuestra el mismo veredicto que la original para VIP,
  suscripción activa, free virgen y free degradada.
  - **Cómo quedó (C1, `gcal_sync_clinica_habilitada(p_clinica_id)`), para
    revisar en la auditoría:** no copia la regla. En cada llamada lee de
    `pg_proc` el cuerpo vigente de `clinica_no_suspendida()` y
    `clinica_tiene_acceso()`, sustituye `public.get_clinica_id()` por el
    parámetro y lo ejecuta con `EXECUTE … USING`. INVOKER, solo
    `service_role`, sin suplantar claims ni rol, sin tocar las originales.
    Ventaja: sigue sola cualquier cambio de la regla (RN-1 está pendiente en
    `feature/limites-ajustables` y se heredaría al fusionar). Si la forma de
    las originales cambia (plpgsql, varias sentencias, `get_clinica_id()` sin
    `public.`), lanza P0001 y la sincronización se detiene, cerrada. Prueba:
    `supabase/pruebas-sql/c1_gcal_sync_estado.sql` (casos 1-3 y 12).
    **Alternativa más simple de leer**, si Angel la prefiere: copiar el
    predicado en la función nueva y añadir una prueba que falle si el cuerpo
    de las originales cambia (huella de `pg_get_functiondef`); obliga a
    actualizar la copia a mano al fusionar RN-1.

### Bloque C — decisiones tomadas en C0-C4 (2026-11-13, sin regla previa)

- **S3, cómo quedó:** `gcal_sync_clinica_habilitada(p_clinica_id)` (C1) **no
  copia RN-1**: lee en cada llamada el cuerpo vigente de
  `clinica_no_suspendida()` y `clinica_tiene_acceso()` desde `pg_proc`,
  sustituye `public.get_clinica_id()` por el parámetro (`EXECUTE … USING`) y lo
  ejecuta como `service_role`. Prueba: `c1_gcal_sync_estado.sql` casos 1-3 y
  12 (mismo veredicto en los cuatro casos; muta la original en un savepoint y
  la nueva la sigue). **Para revisar por Angel:** si alguien reescribe una de
  las dos originales cambiando su FORMA (a plpgsql, dos sentencias,
  `get_clinica_id()` sin `public.`), la nueva lanza y la sincronización se
  detiene, cerrada, hasta revisar C1. El aviso NO se puso en el `COMMENT` de
  las originales, porque S3 prohíbe tocarlas.
- **RN-1 no coincide con su descripción:** el contrato con la consola de
  `CLAUDE.md` (rama `feature/limites-ajustables`) incluye «o 5 pacientes o
  menos contando los dados de baja», y la función de esta rama y de la base
  local no lo tiene. Manda la función; como S3 no la copia, heredaría ese
  cambio si llega.
- **La puerta del sondeo** = `clinica_no_suspendida()` Y
  `clinica_tiene_acceso()` (las dos de `appointments_gates_insert`);
  `perfil_completo()` no aplica (es del usuario que escribe). Una clínica sin
  acceso suelta el candado con `sin_acceso`, que cuenta para la espera
  creciente.
- **C-d, cómo se detecta el título editado:** se compara con el `summary` que
  Spinus compone (`eventoParaGoogle`), por eso `gcal_citas_por_evento` devuelve
  nombre y apellidos del paciente de las citas con paciente (lo mismo que ya
  viaja a Google). Sin nombre conocido, no se marca.
- **C-e con borrado:** una cita `attended`, `no_show` o `cancelled` cuyo
  evento se borra en Google no se toca en la base (ni se desvincula): se
  audita y se marca para que C5 vuelva a escribirla (una cancelada, con
  «CANCELADA — »). Lo rechazado no guarda el `etag` nuevo.
- **«La marca» para C5:** `sincronizarClinica()` devuelve `restablecer` (ids
  de cita); no hay columna ni cola. Si C5 no la consume, no se pierde nada que
  hoy exista.
- **No aceptados aunque la cita admita cambios:** título vacío; pasar a todo
  el día una cita con paciente o una sin `consultorio_timezone` (la CHECK
  `appointments_all_day_medianoche_check` lo impediría); duraciones por encima
  del tope. Se marcan para restablecer.
- **Descripción** de una cita con paciente o nacida en Spinus editada en
  Google: se ignora y no se restablece (S1 dice que no viaja; C-d sólo habla
  del título).
- **Empate exacto** de `event.updated` y `updated_at`: gana Spinus.
- **Auditoría:** dos acciones nuevas en `src/lib/audit.ts`
  (`gcal_conflicto_cita`, `gcal_cambio_rechazado`), con nombres de campo; lo
  aceptado lo audita el disparador con `"via":"google"`. D y E deberán usar
  otro literal en `spinus.via`, nunca `'google'`.
- **Hueco conocido, sin arreglar:** un evento creado por Spinus antes de v2
  cuyo `google_event_id` nunca se guardó (falló el `after()`) se importaría
  como evento de Google, con «Cita médica: <nombre>» de título. Hoy ya se ve
  duplicado, en solo lectura. Las marcas de C5 lo evitan para lo nuevo.
- **Orden obligatorio:** C5 antes que C6. Hasta que C5 deje de mandar
  `description` en las filas `origen='google'` y guarde el `etag`, una edición
  en Spinus de una fila importada pisaría su descripción en Google con el
  formato fijo y el sondeo siguiente la importaría como notas.

### Bloque C — decisiones tomadas en C5-C6 (2026-11-13, sin regla previa)

**C5 · escritura saliente (todo sólo con el interruptor encendido; apagado, los
`after()` son los de antes, sin nombrar `gcal_etag` ni mandar marca):**
- **Marca:** `extendedProperties.private = {spinus_cita, spinus_v:'2'}` en el
  alta, en la reparación de la edición y en cada `patch` de v2 (así las citas
  de antes de v2 se marcan en su primera edición). Nunca `shared`.
- **`etag`:** se guarda el que devuelve Google en el alta, la reparación, el
  `patch` de la edición y el restablecimiento. **No** se guarda el del `patch`
  de `attended` (consultas): va sin `If-Match` y su `etag` taparía como eco un
  cambio hecho en Google antes y aún sin leer; el sondeo siguiente lo guarda o
  restablece.
- **Conflicto en la edición** (`src/lib/gcalEscritura.ts`): `get`; si el
  `etag` difiere del guardado y `event.updated` es posterior al `updated_at`
  escrito, gana Google: no se escribe ni se toca la fila, se audita
  `gcal_conflicto_cita {gana:'google', campos, via:'edicion'}` y el sondeo
  aplica. Si gana Spinus (empate incluido), el `patch` lleva el estado COMPLETO
  (puntas de la fila, descripción según S1, color) y `status:'confirmed'`, que
  deshace un borrado hecho en Google: «gana el último» vale también para un
  borrado más viejo que la edición. Se audita `{gana:'spinus'}`. Una fila sin
  `etag` guardado (anterior a v2) no detecta conflicto: parchea como hoy.
- **412:** repite `get` y decisión una vez; un segundo 412 deja la fila
  `failed`, como cualquier fallo de Google.
- **Releer `updated_at`** con el cliente de servicio (`.eq('clinica_id')`)
  antes del `get`: si consta otro valor, otro escritor más nuevo pasó y no se
  escribe nada. Si la lectura falla, se sigue como hoy. Resto conocido: si el
  sondeo aplicó un cambio de Google justo entre la ruta y su `after()`, un
  cambio de Spinus que Google no acepta como contenido (el color de
  `confirmed`) no llega hasta la siguiente edición; los que sí importan
  (cancelar, título con paciente) los devuelve el restablecimiento.
- **S1 en la edición:** una fila `origen='google'` sin paciente manda como
  descripción sus `notes` (el texto que vino de Google) **sólo si las notas
  cambiaron** en esa edición o si gana Spinus un conflicto; si no, no se manda
  `description`, para no pisar con texto plano el HTML de Google. Ligada a un
  paciente, el formato fijo de siempre. Cualquier otra fila, el formato fijo.
  **Diferencia con plan_C** («con `origen='google'` no se manda
  `description`»): manda S1, que pide los dos sentidos.
- **`attended`:** `POST /api/consultas` añade `.select('id, google_event_id')`
  al update (también apagado: devuelve la fila, sin otro efecto) y, sólo si
  pasó a atendida ahí, tenía evento y v2 está encendido, programa en `after()`
  un `patch` con `colorId:'8'` y nada más (`puedeReparar:false`, sin `get`).
- **Restablecer** (`src/lib/gcalSincronizacionRestablecer.ts`): por página,
  después de aplicar y antes de avanzar el token, con el mismo cliente. Relee
  las filas por RPC y escribe título (`resumenEsperado`), puntas, color,
  `status:'confirmed'` (Google documenta que un evento cancelado del
  organizador «can be restored (undeleted)») y la marca; **no** la
  descripción. `If-Match` = el `etag` de la página: un 412 se deja para la
  pasada siguiente. `sendUpdates:'none'` (devolver el evento a como estaba no
  avisa a los invitados; si Angel prefiere avisar, es una línea). El `etag`
  nuevo se guarda con `gcal_aplicar_evento` sin cambios (comparar-y-cambiar
  sobre `updated_at`). Un fallo cuenta en `errores` y la página avanza igual.
  Una cancelada borrada en Google se restaura con «CANCELADA — ».
- **«Gana Spinus» en el sondeo** también se restablece (plan_C §3.13 decía
  dejarla `failed`); C4 ya la mandaba a `restablecer` y la tarea pide
  consumirla.
- El `STATUS_COLOR` del PUT queda como estaba; el restablecimiento lleva una
  copia (Protocolo 4). Son ya varios sitios con el mismo mapa de colores (y
  `'8'` de `attended` en `gcalEscritura.ts`): deuda anotada, sin abstraer.
- `PREFIJO_CANCELADA` no se exportó (plan_C lo pedía): nadie de fuera lo
  necesita, porque `eventoParaGoogle` y `resumenEsperado` ya lo aplican.
- **Para tener presente (de la revisión):** cuando en la edición gana Google,
  la fila de Spinus ya quedó escrita con el cambio del usuario y el sondeo
  siguiente la sobrescribe con lo de Google (en los campos que se aceptan) sin
  aviso en el modal. Es «gana el último cambio» tal como está pedido, en una
  carrera de milisegundos; queda auditado (`gcal_conflicto_cita
  {gana:'google', via:'edicion'}`).

**C6 · disparo al abrir la agenda:**
- **`POST /api/google/sync`** (`maxDuration` 30, `force-dynamic`). Puertas en
  orden, todas con el cliente de SESIÓN y antes de tocar el de servicio:
  `getUser()` (401) → perfil con clínica (403) → `canVerAgendaCompleta`
  (invitado: `omitida`) → interruptor (`omitida`) → S3: `clinica_no_suspendida()`
  y `clinica_tiene_acceso()` por RPC con la sesión, las originales sin copiar
  (error = `sin_acceso`) → conexión bajo RLS (`sin_conexion`). Luego
  `sincronizarClinica` con 8 s de presupuesto, candado de 30 s y 60 s mínimos
  (los impone `gcal_sync_tomar` para todas las pestañas). Responde sólo
  `{estado, cambios}`; `cambios` cuenta filas de Spinus (lo restablecido cambia
  Google, no la agenda). Un fallo inesperado: `{estado:'error'}` sin detalle.
  No hace falta tocar el middleware: lleva cookie.
- **Cliente** (`AgendaCliente.tsx`): con v2 y `canVerAgendaCompleta`, el sondeo
  sale en `enOcioso` tras montar y al volver a la pestaña pasados 2 min (mismo
  umbral que el refresco por foco, repetido: es local a su gancho). Si
  `cambios > 0`: `vaciarCacheGoogle()` y `refetch(true)` (vacía también la de
  citas y fuerza Google). Fallos, silenciosos. Apagado no sale ninguna
  petición (lo prueba la e2e).
- **Sin duplicados:** la resta de `/api/google/events` ya quita todo evento con
  fila (por construcción, con la guarda del `count`). De seguro, `gcalSource`
  descarta los ids que ya son `google_event_id` de las citas pintadas
  (`quitarEventosImportados`), para la caché de 5 min de antes del sondeo. No
  hubo que migrar datos: encender v2 importa en la primera completa y lo
  importado sale solo de la vista. **Ninguna migración nueva en C5-C6.**
- **Google falso para las e2e** (`src/lib/gcalFalso.ts`): `rootUrl` sólo si
  `GCAL_FALSO_URL` está, `NODE_ENV` y `VERCEL_ENV` no son `production`, la
  Supabase es `localhost`/`127.0.0.1` **y** el propio destino es local (los
  tokens viajan en `Authorization`). Prueba: `gcalFalso.test.ts`. Hay un único
  `google.calendar(` en `gcal.ts` (el del callback de OAuth no se toca: las e2e
  no hacen OAuth).
- **Consecuencia de la guarda: las e2e de Google corren contra `next dev` en
  :3002, no contra :3001.** `next start` siempre tiene `NODE_ENV=production`,
  así que contra él el desvío no puede abrirse (es lo pedido). La prueba
  (`e2e/agenda-google-dos-sentidos.e2e.ts`, sólo en `escritorio`) arranca el
  Google falso en su proceso, siembra una conexión de la clínica A con tokens
  falsos cifrados con la clave local y que no caducan (sin refresco posible),
  levanta `next dev --webpack -p 3002` con `GOOGLE_CLIENT_ID/SECRET` falsos, y
  al acabar lo para y borra la conexión (también antes de empezar), para que
  :3001 no la vea. `next dev` escribe en `.next/dev` y no pisa el build. Simula
  los 60 s entre sondeos poniendo `ultima_ok` en el pasado.
- La e2e no cubre al médico invitado ni a la secretaria en el navegador (lo
  cubre `googleSyncRuta.test.ts`), ni el 412/`If-Match` de la edición, el 410
  ni la paginación: los cubren `gcalEscrituraV2.test.ts`,
  `gcalSincronizacion.test.ts` y `c4_gcal_flujo.sql`. El Google falso ya
  responde 412, por si se quiere añadir.

### Bloque C — decisiones tomadas en C7

- **Ruta:** `GET /api/cron/google-sync`, `dynamic = 'force-dynamic'` (lo pide
  la documentación de Vercel Cron; en Next 16 sigue valiendo porque el
  proyecto no usa `cacheComponents`) y `maxDuration = 60`. No está activa:
  falta `CRON_SECRET` en Production y desplegar (lo hace Angel).
- **Secreto (S2):** se compara la cabecera entera con `Bearer <CRON_SECRET>`
  reduciendo los dos lados a SHA-256 y comparando con `timingSafeEqual`. Así los
  buffers miden siempre 32 bytes: una longitud distinta no lanza y la longitud
  no se filtra por el tiempo. Sin la variable, o vacía: 401 a todo.
- **Respuesta (S2):** `{ ok: true }` con `no-store`; 401 y 500 sin cuerpo. El
  plan C decía «solo conteos»: manda S2, que no admite ni conteos. Lo que pasó
  queda en `gcal_sync_estado` y en la auditoría; en el log, solo cuántas
  pasadas fallaron, sin ids.
- **Middleware (S2):** la ruta entra con `===`, aparte de `publicApiPaths`,
  porque esa lista compara con `startsWith` y abriría cualquier ruta que
  empiece igual. Las entradas existentes no cambian (`/r/` incluida).
- **Presupuesto:** 45 s por ejecución, como máximo 15 s por clínica (para que
  una sincronización completa grande no deje a las demás sin turno: guarda la
  página y sigue en la siguiente ejecución), y no se empieza una clínica con
  menos de 5 s por delante. Las clínicas van en serie.
- **Listado:** se piden 100 conexiones (el tope de
  `gcal_sync_clinicas_pendientes`), no 20 como decía el plan: el listado no
  descarta las clínicas sin acceso ni las que están en espera creciente, y
  como las ordena por `ultima_ok` con NULL primero, 20 clínicas así ocuparían
  siempre las 20 plazas. Cada una cuesta una llamada a `gcal_sync_tomar` que no
  prende; el presupuesto corta antes de terminar la lista si hace falta.
  **Resto conocido:** con más de 100 clínicas sin acceso y la v2 encendida,
  las demás no entrarían por la tarea (sí por el sondeo al abrir la agenda).
- **Candado:** `leaseSeg = 90` (más que `maxDuration`, por si la función muere
  a media página: a los 90 s otra ejecución puede seguir). `minIntervaloSeg =
  60`, no 0 como decía el plan: Vercel puede repetir una ejecución, y con 0 la
  repetida volvería a sincronizar cada clínica recién terminada (inocuo, pero
  el doble de cuota de Google). Una pasada a medias (`page_token` guardado) no
  espera ese mínimo (lo dice `gcal_sync_tomar`).
- **`actorId: 'cron'`**: sólo va a los logs (`ContextoGCal`); la auditoría del
  sondeo sigue saliendo a nombre del dueño de la conexión con
  `origen:'sistema'`, como la escribe C4.
- **`restablecer`:** la tarea no lo consume (C5 y C6 iban en paralelo y no se
  sabía cómo lo harían). Como dice C4, si nadie lo consume no se pierde nada que
  hoy exista; si C5 añade un consumidor, la tarea tendría que llamarlo también.
- **`robots.txt`:** no existe en el repo (ni en `public/` ni como `robots.ts`)
  y no se creó.

### Bloque D — decisiones tomadas en D0-D3 (2026-11-11, sin regla previa)

- **D0. Transporte de correo** (`src/lib/correo/transporte.ts`): tres modos por
  `EMAIL_TRANSPORT`: `captura` (Mailpit por `POST /api/v1/send`, sólo host
  loopback, sin seguir redirecciones, 10 s de espera), `resend`, y apagado para
  todo lo demás (sin variable, vacía o valor desconocido; se compara tal
  cual, así que `RESEND` también apaga). **Doble guarda de Resend:** la variable
  Y una `NEXT_PUBLIC_SUPABASE_URL` remota (`https:` y nombre DNS de dos o más
  etiquetas que no sea IP, `.localhost`, `.local` ni `.internal`; ausente o mal
  escrita cuenta como local). Sin `RESEND_API_KEY` también apaga. No se exige
  además `VERCEL=1` (el diseño lo proponía; el encargo no). `resend` se importa
  sólo en su rama; en local ni se lee la llave. Nunca lanza: devuelve
  `{ok, modo, motivo}`. Al logger sólo van la etiqueta (literal del código,
  saneada) y el código de error, nunca destinatario, asunto, cuerpo ni el
  mensaje de error de Resend. `MAILPIT_URL` opcional (sólo loopback).
- **D0, sin cambiar:** las seis rutas que construyen `new Resend()` directo
  (registro, reset-password, email-hook, reenviar-confirmación,
  enviar-documento, admin/invitar) siguen igual y **pueden mandar correos
  reales desde local** con la llave de `.env.local` (contra §6). Para que
  Angel lo anote. `.env.local` no se tocó: sin `EMAIL_TRANSPORT=captura`, el
  transporte nuevo queda apagado también en local.
- **Alcance de D1-D3 en esta ronda:** migraciones, RPC, lógica pura
  (`src/lib/reserva/secretos.ts`) y sus pruebas. Las rutas
  `/api/agenda/enlaces*` y `/api/agenda/reservas/*` y las secciones de la
  pantalla de configuración (enlaces, contactos bloqueados) que el diseño pone
  en D1 y D2 quedan para la ronda D4-D10.
- **D1. Código del enlace:** no se guarda; `HMAC(subllave «enlace», 'enlace:'||id)`
  truncado a 16 bytes en base64url (22 caracteres); la base guarda sha256 del
  código. Subllaves HKDF-SHA256 (sal `spinus-reserva-v1`, info
  `reserva:<propósito>`) para `enlace`, `contacto`, `codigo` y `red`; la clase
  entra en el mensaje (`telefono:` / `correo:`, `ip:` / `dispositivo:`); la
  ficha de verificación usa la subllave `codigo` con prefijo `ficha:`. Sin
  `RESERVA_SECRETO` de 32+ bytes hex, todo devuelve null (falla cerrado).
- **D1. CHECK con NULL:** el CHECK de coherencia de `appointments.reserva_*`
  y el de vigencia del enlace del diseño **dejaban pasar NULL** (un CHECK que
  evalúa a NULL no falla). Cada columna lleva ahora su `IS NOT NULL`
  explícito. El pre-vuelo aborta si una constraint creada «si no existe el
  nombre» existe con otra fórmula.
- **D1. Auditoría (APTA CON CAMBIOS):** `usado_cita_id` podía apuntar a una
  cita de otra clínica. En vez de FK compuesta + `UNIQUE(id, clinica_id)` en
  `appointments` (propuesta del auditor: índice nuevo en la tabla más
  grande), la protección del enlace exige que la cita que lo gasta sea de ese
  enlace y de esa clínica. Más `COMMENT` en las 8 columnas que no lo tenían.
- **D1. Lista A aplicada:** 15 (el único se ata sólo al médico; etiqueta
  interna opcional ≤ 60), 16 (cada médico ve y gestiona sus enlaces;
  administrador y secretaria, los de todos), 19 (con el interruptor apagado
  los enlaces se conservan y los únicos siguen caducando), 9 (al ligar, los
  datos de contacto se quedan en la cita: el CHECK lo permite y nada los
  borra). Un invitado que intenta emitir un enlace de otro médico lo para la
  protección (23514, no ve su perfil) antes que la RLS.
- **D1. Cita por ligar y borrado:** `reserva_enlaces.usado_cita_id` es
  `RESTRICT`, así que una cita que gastó un enlace único no se puede borrar
  (23503). Hasta que D6 la trate como cita (B3: se cancela, no se borra), un
  `DELETE` de la API sobre ella daría 500. Con el interruptor apagado no
  existen citas así.
- **D2. Candado** (lista A 1, 2, 3 y 6): persona = teléfono **o** correo
  (seudónimos HMAC), siempre por médico; incidencia = toda cancelación o
  `no_show` de una cita por enlace, la haga quien la haga (personal, Google por
  C2, o la persona); reactivar la anula; `cancelled`→`no_show` la re-etiqueta
  sin contar doble. Sólo cuentan las citas por enlace. Desbloquear a mano
  descuenta las incidencias anteriores; bloquear a mano basta sin
  incidencias. La lista de bloqueados mira las citas creadas en los últimos
  (ventana + 366) días; un bloqueo manual de alguien sin citas en ese plazo
  sigue bloqueando pero no sale en la lista. Las incidencias no se auditan
  aparte (las derivan cambios de cita ya auditados); los contactos sí
  (`log_tabla_change`). Empate de marca de tiempo entre desbloqueo y bloqueo
  en la misma transacción: gana el desbloqueo.
- **D2. Auditoría (APTA CON CAMBIOS):** pre-vuelo con dueño de las tres tablas;
  ventana de la lista ligada al ajuste (ventana + 366, no + 30 como proponía el
  auditor, por la razón de la cabecera).
- **D3. Garantía de un solo turno:** `FOR UPDATE` sobre la fila del enlace +
  `pg_advisory_xact_lock(1790, hashtext(medico_id))`; dentro se vuelven a
  comprobar empalme y candado y se inserta. Sin restricción de exclusión (§2:
  el personal empalma). La función exige READ COMMITTED (25001 si no): en
  REPEATABLE READ la instantánea no vería la reserva ganadora. **Límite
  aceptado:** el alta del personal y la importación de Google no toman el
  candado; una cita suya en el mismo instante puede empalmarse con una
  reserva. Medido en local: la segunda reserva esperó 1,5-1,9 s al candado y salió
  «ocupado»; con la línea del candado quitada, las dos reservaban.
- **D3. Puertas:** la reserva exige, por este orden, enlace vigente, interruptor
  encendido, aviso aprobado con el mismo sha256, puerta S3
  (`gcal_sync_clinica_habilitada`, porque `service_role` se salta
  `appointments_gates_insert`), médico aún en la clínica, consultorio activo
  del médico y tipo activo de la clínica o del médico. Emitir el código del
  correo exige también la puerta S3 y el interruptor (el diseño sólo el
  interruptor); `reserva_ocupacion` exige el interruptor. Todo sólo para
  `service_role`, INVOKER; ninguna escribe `agenda_ajustes` (fila 5 del
  veredicto).
- **D3. Lista A aplicada:** 5 (ocupan las citas y las filas de Google; no
  ocupan las de todo el día, `cancelled` ni `no_show`), 14 (6 dígitos, 10 min,
  5 intentos por código, pedir otro invalida el anterior; ficha de 30 min y un
  solo uso; el bloqueo se dice sólo después de verificar), 21 (activa =
  `scheduled`/`confirmed` con fin futuro), 22 (no se detecta si quien reserva
  ya es paciente). El enlace único se salta verificación, bloqueo y «1
  activa» (§2). `reserva_historial_previo` = cancelaciones + no_show al
  reservar.
- **D3. Valores escritos:** la cita nace `scheduled`, `origen='spinus'`,
  `created_by` NULL, título = nombre de quien reserva, fin = inicio + duración
  del tipo, y `gcal_sync_status='pending'` (el diseño dejaba el valor por
  omisión `synced`, falso sin evento en Google; D8 decidirá el envío). Dos
  filas de auditoría: `cita_alta` y `cita_reservada_enlace` (`'system'`, sin
  datos personales).
- **D3. Idempotencia:** el mismo `client_id` con el mismo enlace devuelve
  `repetida` con la cita original. Un `client_id` que ya use otra cita (índice
  único global) hace fallar la llamada (23505): la ruta de D5 lo traducirá.
- **D3. Prueba de carrera:** `scripts/reserva-carrera.sh`, sólo local, con dos
  `psql` en paralelo y datos de una clínica de prueba con ids fijos. Al final
  los borra como `postgres` con `session_replication_role = replica` en esa
  transacción, incluidas SUS filas de `audit_log` (por `registro_id` de sus
  objetos y por el `clinica_id` de su descripción), que de otro modo protege
  `prevent_audit_modification`. Comprobado: no queda ninguna fila.
- **D3. Sin hacer** (lo pedía el diseño como medición, no como garantía): el
  banco de N = 1/5/20 reservas con supabase-js y el `EXPLAIN` con la semilla de
  30k citas.

### Bloque D — decisiones tomadas en D4-D10 (lado público)

- **Orden de los commits:** D4 → D9 → D5 → D8 → D10. D9 va antes que D5
  porque la página y la API exigen el hash del aviso (`reserva_contexto`).
- **D4. Google y la cita por ligar** (`20261114150000`): no se usó la
  sustitución sobre `pg_get_functiondef` del diseño; la migración COPIA los
  dos cuerpos de C2 (bloque C cerrado) y el pre-vuelo aborta si el cuerpo
  vigente no es el de C2 ni el de D4 (md5 de `prosrc`). Además de
  `gcal_aplicar_evento` (5 predicados), cambia `gcal_citas_por_evento`: una
  cita por ligar sale con `r_con_paciente = true` y `reserva_nombre` como
  nombre con apellidos `''`, así que el código de C (`resumenEsperado`,
  restablecer) compone y restablece «Cita médica: {nombre}» sin tocar
  TypeScript. La hora de una cita por ligar sí se acepta desde Google, como
  la de una con paciente. Auditoría: APTA CON CAMBIOS (COMMENT del convenio
  en las dos funciones y en `appointments.reserva_nombre`, aplicado).
- **D5. Rutas:** página `/reservar/[codigo]`; API `/api/reservar/[codigo]`
  (POST reservar), `…/turnos` (GET), `…/codigo` y `…/verificar` (POST). En
  el middleware, dos líneas nuevas con prefijo propio terminado en barra
  (`startsWith('/reservar/')` y `startsWith('/api/reservar/')`), aparte de
  `publicApiPaths`; ninguna entrada existente cambió (`/r/` incluida), y
  `middlewareRutasPublicas.test.ts` prueba las vecinas.
- **D5. 404 uniforme:** sin `RESERVA_SECRETO`, código con mala forma, aviso
  con la marca de pendiente, enlace inexistente o revocado, interruptor
  apagado, aviso sin aprobar, clínica sin acceso, médico que se fue o RPC
  ausente dan el MISMO `{"error":"no_encontrado"}` (y `notFound()` en la
  página). Usado o caducado: «Este enlace ya no está disponible» con el
  teléfono, y 410 en la API. Un enlace sin consultorios activos o sin tipos
  activos también muestra «no disponible».
- **D5. Lo que va al navegador:** nombre y especialidad del médico, sus
  consultorios activos (nombre, dirección, teléfono, zona), los tipos (nombre
  y duración) y el aviso rellenado. Nunca ids de clínica, enlace o médico, ni
  el horario crudo, ni el nombre de la clínica (lista A, 24). La e2e lo
  comprueba sobre el HTML. Metadata `noindex, nofollow` y `no-referrer`.
- **D5. Turnos** (`turnosReserva.ts`): `horarioEfectivo` (propio del
  consultorio o el de la clínica, normalizado) + `turnosDelDia` con la
  anticipación y el horizonte de `agenda_ajustes` que devuelve
  `reserva_contexto`; ocupación de `reserva_ocupacion` (ya sin `cancelled`,
  `no_show` ni todo el día; llega sin estado, así que `citaOcupa` no cuenta
  `no_show`). 7 días por consulta; una fecha pasada se sube a hoy en la zona
  del consultorio.
- **D5. Alineación y horario (lo que señaló el auditor de D3):** antes de la
  RPC, el POST exige que `inicio` sea un turno que la página pudo ofrecer
  (`turnoValido`): horario del consultorio, anticipación, horizonte y
  alineación. Como por P9 los turnos arrancan en CADA HUECO, se calcula con
  la ocupación del día quitando la cita idéntica (la propia en un reenvío),
  o con la jornada vacía; lo que no cumple ninguna es 400 `turno_invalido`.
  Si sigue libre lo decide la RPC bajo su candado (`ocupado` → 409). Usado o
  caducado en el POST también lo dice la RPC (410), para que un reenvío del
  mismo `client_id` con un único ya gastado salga `repetida` (200). Las dos
  cosas las encontraron las e2e.
- **D5. Límites** (`rate_limit_intento`, lista A 13): turnos 120/IP/10 min;
  código 3/correo/h, 10/IP/h, 5/dispositivo/h; verificar 20/IP/h; reservar
  6/IP/h, 4/dispositivo/h, 30/día por enlace fijo. `rate_limit_intento`
  cuenta por `p_ruta`, así que la llave entera va ahí
  (`reserva:<acción>:<sujeto>:<hmac>`) y `p_clave` es la constante
  `reserva`: ni la IP, ni el correo, ni la cookie en claro. Todas las
  llamadas de una acción van en paralelo y consumen aunque otra bloquee.
  Falla cerrado (error de la RPC = 429). Un sujeto que no aplica (el único no
  tiene tope por enlace) no se cuenta; antes de arreglarlo, todo único daba
  429 al reservar. IP: `x-real-ip` y si no el primer
  `x-forwarded-for`; **verificado en la documentación de Vercel** (consultada
  el 2026-11-12, «Request headers»): Vercel sobrescribe `X-Forwarded-For` y
  no reenvía IP externas «to prevent IP spoofing»; `x-real-ip` es idéntica.
  Cookie de dispositivo `sp_rdisp` (24 bytes al azar, httpOnly, Secure,
  SameSite=Strict, Path=/api/reservar, 30 días). Sin IP, todas cuentan como
  la misma (`sin-ip`). `rate_limit_intento` no recibe `p_clinica_id`: no es
  dato de clínica.
- **D5. Cliente de servicio sólo `.rpc()`** en las rutas públicas
  (`servidorReserva.ts`, `limitesReserva.ts`). La clínica sale de
  `reserva_contexto` por el hash del código, nunca de la petición.
- **D5. Correo del código:** sale por `transporte.ts` (`reserva_codigo`).
  Si el transporte está apagado o falla, 503 `correo_no_enviado`: con el
  transporte apagado en producción el enlace fijo no puede reservar (el
  único sí). La respuesta de `/codigo` no dice si el correo ya reservó ni si
  está bloqueado.
- **D5. Página:** sin `getUser()` ni redirect; sin localStorage. Pasos:
  consultorio (si hay más de uno) → tipo → turno (por semanas) → datos +
  aviso con casilla desmarcada → código (sólo fijo) → comprobante. El
  enlace único reserva directamente tras los datos.
- **D5. Sembrador:** limpia `reserva_verificaciones`, `reserva_incidencias`,
  `reserva_contactos`, suelta `reserva_enlaces.usado_cita_id`/`usado_en` y
  borra `reserva_enlaces`, como `postgres` por SQL (el rol de servicio no
  tiene DELETE en esas tablas), antes y después de borrar las citas. El
  encargo hablaba de «la columna `usado_por`»: no existe; la que cierra el
  paso es `usado_cita_id` (FK RESTRICT a la cita). `reserva_avisos` no es de
  ninguna clínica y se queda.
- **D8. Google:** `googleReserva.ts`, en el `after()` del POST sólo con `ok`
  (una `repetida` no reprograma nada): `eventoParaGoogle` con el convenio de
  la cita por ligar `{nombre: reserva_nombre, apellidos: ''}` —el mismo del
  espejo de D4 y de `pacienteParaGoogle` del lado interno (D6,
  `porLigarServidor.ts`)— → «Cita médica: {nombre}» y la descripción de una
  cita con paciente; invitado sólo el médico; marca privada `spinus_cita`;
  `puedeReparar: false`. No se añadió un `pacienteParaGoogle` propio en
  `appointments.ts` para no duplicar el nombre del de D6. Para ligar el
  evento NO hay `.from()`: `citasDeEventos` + `aplicarEvento(vincular)` de
  `gcalSincronizacionBase.ts` (el cerrojo de C prohíbe nombrar esas RPC
  fuera de ahí); sólo columnas técnicas, no mueve `updated_at` ni audita.
  Conexión y correo del médico, con `resolverConexionClinica` y
  `correoDelMedico` (filtran por `clinica_id`), como el alta. Sin conexión
  la cita queda `pending` (D3); si no prende el ligado, el sondeo lo liga
  por la marca. **Deuda aceptada (revisor):** si Google FALLA, la cita también
  queda `pending` y no `failed` como en el alta (marcarla exigiría `.from()`
  o ampliar `gcal_aplicar_evento`); queda el log y la primera edición
  reintenta el alta del evento.
- **D8. Título sin espacio colgante:** el recorte va en `tituloParaGoogle` y
  en el renglón de la descripción de `appointments.ts`, el único sitio donde
  se compone: así Google, el espejo de D4 (`resumenEsperado` ya recortaba) y
  el lado interno dan el mismo texto. **Archivo compartido**: es el único
  cambio de D8 fuera de `src/lib/reserva/` y `src/app/(api/)reservar/`.
- **D8. Comprobante** (`correosReserva.ts`, `reserva_comprobante`): fecha y
  hora en la zona del consultorio, médico, consultorio, dirección y
  teléfono, y «Para cambiar o cancelar, comunícate con el consultorio».
  Sin tipo de cita, sin la clínica, sin datos clínicos, sin el teléfono de
  la persona. Sólo con `ok` (una `repetida` no lo reenvía).
- **D9. Aviso** (`avisoReserva.ts`, versión `reserva-2026-11-v1`, sha256 `4b80a964…`): texto en `AVISO_PLANTILLA`
  (el texto aprobado no puede llevar marca ni `[VERIFICAR]`). Doble cierre: la base exige el sha256 aprobado (`reserva_avisos`) y
  `avisoPublicable()` es falso mientras lleve «PENDIENTE DE REVISIÓN LEGAL —
  no publicar». Para las e2e, `RESERVA_AVISO_BORRADOR_LOCAL=1` (añadida al
  `.env.local` de este worktree con su comentario) abre el borrador SÓLO con
  Supabase en loopback a ciencia cierta y fuera de Vercel (corrección del
  revisor: sin URL contaba como local). Aprobar: `npx tsx
  scripts/aviso-reserva-hash.ts` y el INSERT que imprime; el script se niega
  mientras haya marca. Plazo propuesto del historial: 12 meses, con nota de
  que **hoy no hay purga** de `reserva_incidencias` ni `reserva_contactos`.
- **D10 (lado público):** `e2e/reserva-enlace.e2e.ts` (flujo completo con
  el fijo leyendo el código de Mailpit por `GET /api/v1/search`; dos reservas
  simultáneas → `[201, 409]` y una cita; reenvío idempotente; único usado y
  caducado; cinco códigos erróneos, sin ficha, ficha usada; interruptor
  apagado y aviso sin aprobar → el mismo 404 que un enlace inventado; JSON de
  turnos en lista blanca y consultorio de otra clínica → 400; séptimo POST
  por IP → 429; comprobante capturado sin tipo, sin teléfono de la persona y
  sin «Consulta:», y HTML de la página sin ids internos) y
  `e2e/reserva-candado.e2e.ts` (segunda reserva → `ya_tiene_cita`; tres
  cancelaciones → 403 con el teléfono; desbloquear abre; el único se lo
  salta; coincidir sólo por teléfono bloquea). Ayudas en
  `e2e/reservaPublicaAyudas.ts` (nombre distinto del `reservaAyudas.ts` de
  D6) y `e2e/mailpit.ts` (sólo lectura: no borra el buzón). Sólo
  `escritorio`. Los enlaces se emiten por SQL con el código del mismo
  `RESERVA_SECRETO`; el candado se cierra cancelando por cambio de estado y
  se abre escribiendo lo mismo que «Desbloquear». Cada petición sale con una
  IP inventada (TEST-NET-3), porque `ip_rate_limits` sobrevive a la siembra.
  Las e2e del lado interno (D6/D7) son de la otra rama y no se duplicaron.
  Sin hacer: la medición del presupuesto de A0 y el banco de D3.
- **El mismo `RESERVA_SECRETO`** en los dos worktrees de agenda (comparten
  la base local): con secretos distintos, un enlace emitido desde uno no se
  abriría en el otro.

### Bloque D — decisiones tomadas en D6-D7 (lado interno)

**Gestión de enlaces y contactos (lo que quedó pendiente de D1 y D2):**
- **Rutas:** `/api/agenda/enlaces` (GET, POST), `/api/agenda/enlaces/[id]` (GET
  código, PATCH revocar), `/api/agenda/reservas/contactos` (GET, POST) y
  `/api/agenda/reservas/historial?cita=` (GET). Entrada común
  (`src/lib/reserva/gestionServidor.ts`): `getUser()` → perfil con clínica
  (403; un error al leerlo, 500) → interruptor (404). Cliente de sesión,
  `clinica_id` explícito en cada consulta y RLS; nada de `createAdminClient()`.
  Las RPC sin parámetro de clínica (`reserva_enlace_regenerar_fijo`,
  `reserva_contactos_bloqueados`, `reserva_contacto_marcar`) acotan con el
  `get_clinica_id()` de la sesión; la lista de bloqueados se vuelve a filtrar
  por médico en la ruta.
- **Permisos (lista A, 16):** `puedeGestionarDelMedico` = administrador o
  secretaria (`canVerAgendaCompleta`), o el médico dueño. Se comprueba antes de
  escribir (403) aunque la RLS diga lo mismo. Un `super_admin` no gestiona nada.
- **El código no viaja en la lista.** `GET /api/agenda/enlaces` devuelve sólo
  los VIGENTES (fijo sin revocar; únicos sin usar, sin revocar y sin caducar),
  sin código ni hash; el código se pide uno a uno a `GET …/enlaces/[id]`
  (410 si ya no está vigente, `no-store`), y el alta lo devuelve en el momento.
  En el navegador sólo vive en el estado de la pantalla. Usados, caducados y
  revocados no se listan (siguen en la base; nunca se borran). Tope de 200.
- **Sin `RESERVA_SECRETO`:** el alta da 503 sin escribir nada (un enlace cuyo
  código no se puede derivar no sirve) y la pantalla lo dice; la lista sí sale.
- **Fijo:** crear y regenerar son la misma llamada (`reserva_enlace_regenerar_fijo`:
  revoca el vigente y emite otro en una transacción). Regenerar y revocar piden
  confirmación. El único se emite con etiqueta opcional; la vigencia la congela
  la base con el ajuste de ese momento y el cuerpo no puede mandarla
  (`strictObject`).
- **La dirección** que se enseña es `<origen>/reservar/<código>`, la página de D5.
- **Contactos bloqueados:** la lista y «Desbloquear» por cita
  (`reserva_contacto_marcar`, que desbloquea los dos seudónimos). Bloquear a
  mano se hace desde el modal de la cita (D6). Se hereda el límite de D2: un
  bloqueo manual sin citas en (ventana + 366) días no sale en la lista.
- **Pantalla:** las dos secciones salen para cualquier médico (los suyos) y para
  administrador y secretaria (los de todos), sólo con v2 encendida, como el
  resto de la pantalla.
- **e2e y la semilla:** `scripts/agenda-semilla.ts` no conoce las tablas de D
  y sus FKs RESTRICT le impedirían volver a sembrar si una prueba deja filas;
  las e2e de este lado limpian como `postgres` con `session_replication_role =
  replica` (`e2e/reservaAyudas.ts`). Quien integre D10 debería enseñar a la
  semilla a borrarlas también.

**D6 · por ligar, historial y bloqueos en la agenda:**
- **`esEventoGenerico` = `!paciente_id && !reserva_canal`**, y `esPorLigar`
  aparte. Los 8 llamadores: los seis que reciben la fila entera ya ven
  `reserva_canal` (llega por el `*` de `APPOINTMENT_SELECT`); los dos que
  arman el objeto a mano (`contarVisibles`, `desgloseDeEstados`) lo pasan. Sin
  la columna llega `undefined` y la regla es la de antes. La clasificación va
  por el DATO, no por el interruptor: con v2 apagado sólo cambia algo si la
  clínica tuvo v2 y lo apagó con reservas en la agenda (entonces se ven como
  citas «Por ligar», que es lo que son).
- **Marca en la tarjeta:** píldora «Por ligar» (o «Por ligar · N» con
  `reserva_historial_previo` > 0) en la línea del NOMBRE, detrás de él; la
  tarjeta sigue con dos líneas y la marca se ve también en el tier `tiny`. La
  frase entera («traía N cancelaciones o inasistencias») va en `title`: N es
  la instantánea de D3, que suma cancelaciones e inasistencias, así que no se
  escribe «3 cancelaciones» a secas. En Mes, la misma píldora que «Evento» de
  Google. Las filas de las vistas de lista no llevan marca.
- **Modal:** una cita por ligar se abre como «Editar cita»; en el sitio del
  paciente, el bloque «Reservó por enlace» (nombre, teléfono, correo, historial
  EN VIVO de `GET /api/agenda/reservas/historial` y «Bloquear / Desbloquear
  contacto»). Sin buscador: se liga al iniciar la consulta (D7). Guardar sin
  paciente conserva el título y NO manda `paciente_id`. El botón de bloquear
  sale para administrador y secretaria, o para el médico de la cita; sin v2,
  sólo la instantánea.
- **Servidor (PUT y DELETE, sólo con v2):** una lectura más,
  `estaPorLigar` (`src/lib/agenda/porLigarServidor.ts`), en las filas SIN
  paciente; si falla, 500 sin escribir. Una por ligar: el DELETE da el mismo
  409 `cita_con_paciente` de B3 (se cancela); el PUT le aplica las reglas de
  cita: no puede pasar a todo el día (400 `todo_el_dia_con_paciente`), lleva el
  tope de duración de una cita y puede llevar tipo (`comprobarTipoDelPut` con
  `porLigar`: `conPaciente = paciente_id || reserva_canal`, P5 ampliado; el
  mensaje de `tipo_sin_paciente` dice «con paciente o por ligar»).
- **El 500 de la FK, corregido:** con v2 encendido no se llega al borrado (409
  de arriba). Apagado, el DELETE de una cita que sostiene una FK RESTRICT
  (sólo pasa con las tablas de D: enlace único gastado o incidencia) da 409
  `cita_con_paciente` «cancélala», en vez del 500 con el texto de Postgres.
- **«Con el interruptor apagado no existen reservas», hasta dónde es cierto**
  (prueba `d6_cita_por_ligar.sql`): por el camino de la reserva sí,
  `reservar_por_enlace` contesta «apagado» y no escribe ni gasta el enlace.
  Pero no es un invariante de la base: (a) si la clínica apaga v2 después de
  recibir reservas, las citas se quedan (de ahí el 409 de arriba); (b) la RLS
  de `reserva_enlaces` y de `appointments` no mira el interruptor, así que
  alguien de la clínica, por PostgREST directo, podría crear un enlace y una
  cita con `reserva_*` de su propia clínica con v2 apagado. Nada de eso cruza
  clínicas ni salta el candado público; se anota para la auditoría (D1).
  **→ Cerrado (b) por `20261117121000` y `20261117122000`: la sesión ya no
  escribe `reserva_*` ni emite enlaces (ver «Correcciones de seguridad en la
  base tras la revisión independiente»).**
- **Sin migración en D6.**

**D7 · ligar al iniciar la consulta:**
- **Dónde:** en una cita por ligar, «Iniciar consulta» (mismas condiciones que
  hoy: médico de la cita, con consultorio suyo, y sólo con v2) no navega:
  cambia el bloque de la reserva por «Ligar a un paciente» (`PanelLigarCita`).
  Un paciente existente con el buscador del modal (precargado con la primera
  palabra del nombre de quien reservó, porque el buscador compara nombre O
  apellidos por separado y el nombre completo no daría nada), o uno nuevo con
  `QuickPatientModal` (precarga nombre y correo con la prop nueva
  `emailInicial`; el teléfono se enseña para copiarlo a mano). El
  consentimiento de privacidad lo sigue exigiendo `QuickPatientModal`.
- **Ligar = el PUT de siempre** (`src/lib/agenda/ligarCita.ts`) con
  `{paciente_id, title: nombre del paciente, updated_at}`; con 200 se navega a
  `/expediente/<paciente>/nueva-nota?cita=<cita>`, así `/api/consultas` la
  pasa a `attended` al guardar la nota. Vacía la caché de rangos (la agenda se
  desmonta y al volver pintaría la cita aún por ligar).
- **Servidor:** al ligar (v2, cita por ligar, `paciente_id` nuevo) se exige
  que el paciente sea de la clínica y lo vea quien liga (RLS de `pacientes`):
  400 `paciente_invalido` si no (la FK no mira la clínica). Después de
  escribir, `cita_ligada` en `audit_log` con `{clinica, campos, via:'ligar'}`:
  sólo nombres de campo, ni el paciente ni el nombre de quien reservó. El
  disparador de B0 deja además su `cita_editada`.
- **Datos de contacto** (lista A, 9): se quedan en la cita; el PUT no los toca
  y no se copian a la ficha.
- **Google (S1 con C5):** al ligar, el `after()` del PUT compone el evento con
  el paciente («Cita médica: <paciente>», descripción fija sin observaciones),
  y `descripcionV2` deja de mandar notas aunque la fila hubiera nacido en
  Google. Antes de ligar, una cita por ligar se compone con
  `{nombre: reserva_nombre, apellidos: ''}`, el mismo convenio que el espejo de
  D4 (`gcal_citas_por_evento`), para que una edición desde Spinus no deje en
  Google un título que el sondeo vuelva a restablecer. `sendUpdates` no cambia
  al ligar (no hay paciente saliente): no avisa a nadie.
- **e2e:** no se guarda la nota (una nota no se borra y rompería la siembra);
  el paso a `attended` es el de `/api/consultas`, que compara `paciente_id`.
- **Sin migración en D7.** Pendiente para quien integre: D8 (alta del evento
  de una reserva) debería componer con el mismo convenio
  (`pacienteParaGoogle`, o `{nombre: reserva_nombre, apellidos: ''}`).

### Bloque D — sincronización con Google antes de reservar (decisión de Angel)

**Lo que pidió Angel (2026-11-12), literal:** «El enlace de reserva no debe
depender de la tarea programada de Vercel para conocer lo que hay en Google.
1. En GET de turnos: si la clínica tiene Google conectado y la última
sincronización buena tiene más de 60 s, haz la sincronización incremental (la
misma del sondeo al abrir la agenda) antes de calcular la ocupación. 2. En POST
de reservar: sincroniza SIEMPRE justo antes de llamar a la RPC, sin el tope de
60 s. Si el turno quedó ocupado, responde con el mismo error de turno no
disponible. 3. Si Google falla o tarda demasiado (pon un tiempo máximo corto):
permite la reserva solo si la última sincronización buena tiene menos de 30
minutos. Si es más vieja, responde que no se puede reservar por ahora y muestra
el teléfono del consultorio. Clínicas sin Google conectado no cambian. 4. Si
una sincronización posterior importa o mueve en Google algo que se empalma con
una cita reservada por enlace, avisa a la clínica por el mismo canal del aviso
de cancelación (E8) y regístralo en auditoría. 5. Pruebas: e2e contra el
Google falso para los cuatro casos, y que la garantía atómica de la RPC no
cambie.»

**Causa de fondo:** la ocupación de la reserva sale de la base
(`reserva_ocupacion`, D3), que sólo sabe de Google cuando alguien sincroniza
(el sondeo al abrir la agenda, C6, o la tarea, C7). Sin agenda abierta y sin
la tarea activa, un evento recién creado en Google no ocupaba el turno.

**Cómo quedó** (`src/lib/reserva/sincronizarReserva.ts`, llamado desde
`/api/reservar/[codigo]/turnos` y `/api/reservar/[codigo]`):
- **GET:** `sincronizarClinica` (la pasada de siempre) con `minIntervaloSeg: 60`:
  el umbral lo impone `gcal_sync_tomar` (C1) en la base, el mismo de las
  pestañas; con la última buena más reciente no toma el candado ni llama a
  Google. Va después de los límites por IP y antes de leer la ocupación.
- **POST:** la misma pasada con `minIntervaloSeg: 0`, JUSTO antes de
  `reservar_por_enlace` / `reagendar_por_enlace` (después de `turnoValido`,
  que usa la ocupación de antes: así un turno que Google acaba de ocupar llega
  a la RPC y sale su `ocupado`, el mismo 409 `turno_ocupado`, y no un 400
  `turno_invalido`). Fuera de la transacción: **la RPC no cambió**.
- **Sin solapes del `syncToken`:** el candado con testigo de C1. Si otra pasada
  lo tiene (el sondeo, la tarea u otra reserva de la misma clínica), el POST
  espera en pasos de 250 ms (`gcal_sync_frescura` dice si está tomado) y hace
  la suya; el GET no espera. Si no está tomado y aun así no se pudo (espera
  creciente tras fallos de Google), no se gira: se aplica la ventana.
- **Tope: 4 s** (`TIEMPO_GOOGLE_MS`) para todo lo de Google en la petición
  (espera del candado incluida). Por qué 4: una incremental es una página de
  `events.list` (y algún `patch` de restablecimiento), que en condiciones
  normales tarda bastante menos de 1 s; 4 s deja margen a un Google lento sin
  que la página pública parezca colgada, y es el límite que Angel sugería
  (3–4 s). **Cancela de verdad:** un `AbortController` cuya señal llevan
  `events.list` y el `patch` del restablecimiento (`OpcionesSincronizacion.senal`,
  nueva, opcional: el sondeo y la tarea no la pasan y no cambian); se aborta
  con una razón propia (no `TimeoutError`), así gaxios no reintenta. Lo que no
  lleva la señal (el refresco del token OAuth, la base) lo cubre una carrera
  con el reloj. Un corte cuenta como fallo de Google (`ultimo_error =
  'google_tiempo'`, espera creciente incluida).
- **Ventana: 30 min** (`VENTANA_TOLERADA_MS`) sobre `ultima_ok` cuando la pasada
  no terminó `ok` (error, tope, parcial, candado ajeno hasta el tope). Una
  clínica sin acceso (S3, `sin_acceso`) sigue: la rechaza la RPC con el 404
  uniforme de D5 (un 503 la distinguiría; corrección del revisor). 30 min justos ya no valen. Sin ninguna buena nunca: no se reserva.
  La lectura es una función nueva (`gcal_sync_frescura`) porque la tabla sólo
  se toca por `gcal_sync_*` (su COMMENT); no un `.from()` con el cliente de
  servicio.
- **Respuesta (GET y POST):** 503 `{ error: 'no_disponible_por_ahora',
  mensaje, telefono }`, teléfono del consultorio elegido (o el del médico), sin
  decir que la clínica tiene Google ni qué falló. La página ya pintaba
  `mensaje`; no cambió. Texto **PENDIENTE DE REVISIÓN**: «Por ahora no se puede
  reservar en línea. Para agendar, comunícate con el consultorio: {tel}.»
- **Sin Google** (sin conexión de clínica, o conexión sin calendario), o sin
  las migraciones de C o de D11: exactamente como antes. Con el interruptor
  apagado el enlace ya da 404 antes de llegar aquí (D5).
- **Aislamiento:** la clínica sale de `reserva_contexto` (hash del código). La
  conexión se lee con `resolverConexionClinica(admin, clinicaId)`
  (`.eq('clinica_id')`, el mismo de D8) y se comprueba que su `clinicaId` sea
  ése; todo lo demás es RPC con `p_clinica_id`.
- **Fallo al leer la conexión:** se decide por la ventana (con la última buena
  reciente, se reserva; sin ella, no). Cerrado ante la duda.

**Punto 4 · empalmes** (migración `20261116120000_agenda_d11_sync_antes_de_reservar.sql`):
- **Dónde se detecta:** en la sincronización (cualquiera: sondeo, tarea o
  reserva), por página, tras aplicar y restablecer: las citas que de verdad se
  IMPORTARON (`gcal_importar_evento` devolvió fila) o cuya HORA se aplicó
  (`aplicar` con puntas que prendió) van a `reserva_empalmes_registrar`, que
  busca en esa clínica y con el mismo médico los pares con una reserva por
  enlace activa (scheduled/confirmed, con hora, futura) que se solapan con
  algo que ocupa (las reglas de `reserva_ocupacion`). Incluye la reserva movida
  desde Google (D4 acepta su hora).
- **Sin duplicar:** `reserva_empalmes_google` con UNIQUE por par; resincronizar
  o repetir una página no vuelve a avisar (además, lo que no cambió no llega).
  Dos reservas empalmadas entre sí, un solo par (orden canónico). Un par nuevo
  con la misma reserva (otro evento) sí avisa.
- **Auditoría:** `reserva_empalme_google` en `audit_log`, `user_id 'system'`,
  `registro_id` = la reserva, `{clinica_id, cita_empalmada, via:'sondeo'}`: sólo
  ids. En la MISMA sentencia que el par: si la auditoría falla, no queda par
  (P10). Un fallo de esa llamada cuenta en `errores` y no tumba la página (la
  pasada avanza el token: ese aviso se pierde; resto conocido).
- **Canal de E8:** `GET /api/agenda/por-confirmar` devuelve `empalmes` (sesión,
  `clinica_id` explícito, RLS de la tabla y de `appointments`): pares de los
  últimos 30 días cuyo empalme SIGUE en pie (si el personal movió o canceló
  una, sale). El panel «Por confirmar» los pinta en «Reservas por enlace
  empalmadas con Google» y los suma al contador rojo; si al recargar trae uno
  detectado hace menos de 2 min, un aviso emergente sin nombre (una vez por
  pestaña). La agenda recarga el panel cuando su sondeo trae cambios. **Límite
  conocido**, el de E8: en móvil no hay panel; y lo que detecte la tarea o una
  reserva con la agenda abierta se ve al abrir el panel o en el siguiente
  sondeo con cambios, no al instante.
- **Tabla sin FK a `appointments`**, a propósito (FK a `clinicas` RESTRICT):
  B3 y la siembra borran citas, y una FK RESTRICT bloquearía esos borrados en
  la base compartida; la lectura cruza con `appointments`. Los pares huérfanos
  se quedan (sin purga), como un registro. La semilla la borra como postgres.

**Para tener presente:**
- **Resto conocido (revisor):** un reenvío del mismo `client_id` con Google
  caído y la última buena ya vieja recibe el 503 en vez de `repetida`, porque
  la idempotencia vive en la RPC y no se llega a llamar. La cita y su
  comprobante ya existen; cerrarlo exigiría tocar la RPC.
- Cada POST hace una llamada a Google (los límites por IP, dispositivo y
  enlace de D5 van antes y la acotan; el candado serializa por clínica). Con
  muchas reservas a la vez en una clínica, la segunda espera a la primera
  (hasta 4 s).
- La prueba de la garantía atómica sigue siendo `scripts/reserva-carrera.sh`
  (psql directo, con su control sin candado) y la carrera de
  `reserva-enlace.e2e.ts` (sin Google). Con Google conectado, la espera del
  candado de la sincronización ya serializa dos POST simultáneos: comprobado
  quitando el candado consultivo de la RPC en la base local (restaurada
  después, mismo md5), la e2e de dos POST seguía dando una cita. Por eso esa
  e2e prueba otra cosa: que el segundo POST espera y hace SU pasada (con la
  espera quitada, contesta 503).
- Sin probar en local: latencias y errores reales de Google (el falso
  responde al instante salvo cuando se le pide demora o fallo), el refresco
  del token OAuth dentro del tope y el comportamiento en Vercel de una pasada
  abortada (que su `soltar` llegue antes de que congelen la función; si no,
  el candado caduca a los 30 s).

### Bloque E — decisiones tomadas en E1-E2

**E1 · migración `20261115120000_agenda_e1_confirmacion_enlace.sql`:**
- **Una tabla, no dos:** `cita_confirmaciones` guarda el enlace Y la ÚLTIMA
  respuesta del paciente (`respuesta` `confirmo|cancelo`, `respondido_en`),
  como en el diseño. Un «confirmó y luego canceló» deja `cancelo`; el
  historial completo queda en `audit_log` (`log_cita_change` en la cita y
  `log_tabla_change` en la tabla). Una tabla de respuestas aparte duplicaría
  la auditoría. `cita_correos` (E4) y `cita_reagendos` (E6) son de sus pasos.
- **`appointments` no gana columnas** (hallazgo 4). Ningún `CASCADE`; FK a
  `appointments` y `clinicas` RESTRICT; `creado_por` → `profiles` SET NULL
  (como `created_by` de D1); `paciente_id` sin FK a propósito (convenio en el
  `COMMENT`). RLS: un SELECT de 7 columnas para `authenticated` por la RLS de
  `appointments` (sin recursión); sin escritura para `authenticated`.
- **Lista final de `via`** (`c_vias` de `log_cita_change`, sólo sin
  `auth.uid()`): `google` (C2), `enlace_paciente` (respuesta por el enlace, E1,
  y el reagendar de E6) y `google_rsvp` (E9). Un literal fuera de la lista no se
  escribe. **No** se añadió un literal para la reserva por enlace: D3 (cerrado)
  no pone `spinus.via` y ya deja su propia fila `cita_reservada_enlace`; un
  literal sin productor sería letra muerta. El encargo sugería `enlace` y
  `paciente`: manda el diseño («o los que fije el diseño»).
- **Pre-vuelo de `log_cita_change`:** aborta si `md5(prosrc)` no es el de C2
  (`e57358a1…`) ni el de E1 (`80c3556c…`), como D4. El cuerpo es el de C2 con
  una sola diferencia (la lista blanca); `c_tecnicas` y el WHEN no se tocan.
- **Cinco funciones**, INVOKER: `cita_confirmacion_coincide` (pura, regla
  general de permisos) y `…_emitir`, `…_contexto`, `…_responder`, `…_revocar`
  (sólo `service_role`). Diferencias con el diseño:
  - `emitir` devuelve `(r_id, r_codigo_hash)` en vez de un uuid: si el vigente
    se emitió con otro `RESERVA_SECRETO`, el servidor lo detecta, lo revoca y
    emite otro (si no, la cita quedaría con un enlace muerto para siempre).
  - `revocar(p_clinica_id, p_cita_id)` es nueva (la pide E2 y la usará E6).
  - `contexto` es la única sin `p_clinica_id`: la clínica se resuelve por el
    hash del código, como `reserva_contexto` de D3; la devuelve para que el
    POST la mande a `responder`, que la vuelve a casar con la fila.
  - Índice `cita_confirmaciones_cita (appointment_id)` para la FK RESTRICT.
- **Lista A aplicada:** 7 (sin caducidad guardada: vale mientras la cita no
  empiece; el cambio de paciente lo invalida; ligar una cita por ligar no), 8
  (confirmar hasta el inicio; cancelar hasta T−1h estricto, con
  `clock_timestamp()` después de los dos `FOR UPDATE`), 9 (emitir exige la
  puerta S3; responder funciona en una clínica degradada o suspendida).
  **Corregido el 2026-11-13:** la suspendida ya no responde (ver abajo); la
  degradada, sí.
- **Resto conocido:** (a) una cita por ligar ligada a P y después cambiada a Q
  conserva el enlace (está atado al correo de la reserva, que sigue en la
  cita); (b) con el interruptor apagado, el `DELETE` de una cita con enlace da
  23503, que `DELETE /api/appointments/[id]` ya traduce a 409 «cancélala»
  (D6); (c) `scripts/agenda-semilla.ts` y las limpiezas de las e2e no conocen
  `cita_confirmaciones`: hoy nada crea filas fuera de las pruebas SQL (que
  terminan en rollback), pero quien integre E3+ tiene que enseñarles a
  borrarlas (FK RESTRICT); (d) sin purga: unas pocas filas por cita.
- **Auditoría independiente (APTA CON CAMBIOS):** aplicado, el candado 1791
  también en `revocar`. **No aplicado, para revisar por Angel:** el auditor
  pidió que `contexto` y `responder` se cierren con `clinicas.suspendida`; se
  mantuvo la lista A 9 (la respuesta del paciente es un UPDATE como los del
  personal, y `appointments_update` no mira la suspensión). Cerrarlo es un
  `EXISTS` en las dos funciones; la prueba (caso 4) fija el comportamiento.
  **Cerrado el 2026-11-13** (encargo de Angel tras la auditoría): `contexto`
  da NULL y `responder` `invalido` con `clinicas.suspendida`; para el paciente,
  404 como un enlace que no existe. Se editó la migración E1 (sin aplicar en
  producción), se volvió a aplicar en local y se re-anotó; ver su cabecera
  («CIERRE DE LA SUSPENDIDA») y los casos 4 y 4b de su prueba.
- **Carrera:** `scripts/confirmacion-carrera.sh` (sólo local): el personal
  mueve la cita a +30 min mientras el paciente cancela → B espera ~1,9 s y sale
  `fuera_de_plazo`; sin el `FOR UPDATE` de la cita, cancelaba la cita movida;
  confirmar y cancelar a la vez se serializan por el enlace.

**E2 · `src/lib/confirmacion/enlaceConfirmacion.ts`:**
- Subllave HKDF `confirmacion` en `secretos.ts` (`codigoDeConfirmacion(id)` =
  HMAC('confirmacion:'||id), 22 caracteres); `codigoDeEnlace` no cambia (lo
  fija una prueba). La forma del código es la misma (`esCodigoDeEnlace`).
- API para E3-E9: `emitirEnlaceConfirmacion(clinicaId, citaId, creadoPor)` →
  `{id, codigo, url} | null`; `resolverEnlaceConfirmacion(codigo)` →
  `ContextoConfirmacion | null` (con `clinica_id` y `codigo_hash`, que NO van
  al HTML); `responderEnlaceConfirmacion(ctx, 'confirmar'|'cancelar')` →
  `{r_resultado, r_cita_id, r_google_event_id, r_gcal_etag} | null` (sólo desde
  un POST); `revocarEnlaceConfirmacion(clinicaId, citaId)` → boolean;
  `urlDeConfirmacion(codigo)`.
- URL: `${NEXT_PUBLIC_APP_URL}/confirmar/<código>`, con el mismo valor por
  omisión que el resto del repo (`https://www.spinus.com.mx`); una base que no
  sea `http(s)://host` sin ruta no emite (ni escribe). Sin datos personales ni
  ids en la URL.
- Cliente de servicio sólo `.rpc()`; tolerante (PGRST202, 42883, 42P01,
  PGRST205 → null, con `logger.warn`); al log sólo el nombre de la RPC y el
  código, nunca el código del enlace ni la URL. Nada lanza.
- **Para el procedimiento de despliegue:** rotar `RESERVA_SECRETO` invalida
  también todos los enlaces de confirmación ya enviados; el siguiente envío de
  cada cita los repara solo (revoca y reemite).
- **Revisión independiente (APTO):** comprobó las formas reales de las RPC
  contra la base local; aplicados sus dos detalles (comentario de por qué
  `revocar` no exige el secreto y prueba de la rama «revocar falla al
  reintentar»). Comprobado además de punta a punta contra el PostgREST local
  (emitir → mismo enlace → contexto → confirmar → revocar → contexto nulo) con
  datos propios borrados al final.

### Bloque E — decisiones tomadas en E3, E5, E6 y E10

**E1 · cierre de la clínica suspendida** (encargo tras la auditoría de E1):
ver la nota «Cerrado el 2026-11-13» en E1-E2. Se editó la migración de E1 (no
estaba en producción) y se re-anotó en local. La degradada sigue respondiendo
(lista A 9). Re-auditoría: APTA; señaló que `gcal_aplicar_evento` no mira la
suspensión, a tener en cuenta en E9 si el RSVP escribe por ahí.

**E3 · página `/confirmar/[codigo]` y `POST /api/confirmar/[codigo]`:**
- **El estado sólo cambia con el POST.** La página es de servidor y sólo
  llama a `cita_confirmacion_contexto` (STABLE): ni «visto» ni límites por
  GET. «No podré asistir» es un GET (`?paso=cancelar`) que pinta el «¿Seguro?»
  con su propio formulario (lista A 18: cancelar en dos pasos, confirmar en
  uno). La API sólo exporta POST (GET y HEAD, 405). Formularios HTML sin JS
  obligatorio.
- **303 explícito** (`NextResponse.redirect(url, {status: 303})`) a la misma
  página con `?r=` de una lista fija (`confirmada`, `cancelada`,
  `ya_confirmada`, `ya_cancelada`, `fuera_de_plazo`, `cerrada`, `pasada`,
  `limite`); cualquier otro valor se ignora. Recargar no reenvía el POST
  (comprobado en el navegador).
- **`referrer: 'same-origin'`, no `'no-referrer'` como decía plan_E:** con
  `no-referrer` el navegador manda `Origin: null` en el POST del formulario
  (Fetch, «append a request Origin header») y la comprobación de origen
  rechazaría el botón. `same-origin` tampoco deja salir el código a terceros.
- **Origen:** `Origin` con el host de la petición; sin `Origin`, sólo
  `Sec-Fetch-Site: same-origin`; si no, 403 (un `curl` sin cabeceras no
  responde). No es la barrera principal: sin el código no se llega a nada.
- **Orden del POST:** origen → forma del código (404 sin base) → `accion`
  (Zod, 400) → contexto (404 si no hay enlace vigente) → límites → responder.
  El contexto va ANTES de los límites (el plan los ponía antes): un código
  inventado no deja filas en `ip_rate_limits`, y el GET de la página ya hace
  esa misma lectura sin límite.
- **Límites:** acción `confirmar` en `limitesReserva.ts` (10 por enlace y 30
  por IP cada hora, `rate_limit_intento`, llave con el sha256 del código y el
  HMAC de la IP). Pasarlo: 303 a `?r=limite` sin responder.
- **404 uniforme** para revocado, interruptor apagado, clínica suspendida,
  paciente de la cita cambiado, RPC ausente, `invalido` o un error. Una cita
  pasada no es 404: «Esta cita ya pasó» (el enlace no tiene caducidad guardada,
  lista A 7).
- **Lo que se pinta** (lista A 16): fecha y hora en la zona del consultorio,
  con la etiqueta de zona si no es la de la clínica; médico (título y nombre,
  sin especialidad); consultorio, dirección y teléfono. Título «Tu cita»,
  `noindex`, sin `openGraph`. Ningún id ni la clínica en el HTML.
- **Dentro de la hora previa:** se ofrece confirmar y no cancelar, con «Ya no
  es posible cancelar desde el enlace; comunícate al {teléfono}».
- **Google** (`googleConfirmacion.ts`, lista A 10): `after()` sólo con
  `confirmada`/`cancelada` y evento → `restablecerEnGoogle` de C5 con `If-Match`
  del `etag` guardado y `sendUpdates:'none'`. Conexión por
  `resolverConexionClinica` y `conCalendarioSpinus` (los de D8, filtran por
  `clinica_id`; es el único `.from()` del camino y es el mismo que ya usa D8),
  `puedeReparar:false`. Un 412 se deja al sondeo. Sin prueba e2e con el Google
  falso (sí con Vitest): no estaba en la lista de E10 del encargo.
- **Middleware:** `startsWith('/confirmar/')` y la API EXACTA
  (`/^\/api\/confirmar\/[A-Za-z0-9_-]{22}$/`); ninguna entrada existente cambia.
- **Textos** en `vistaConfirmacion.ts` y la página: PENDIENTES DE REVISIÓN.

**E5 · comprobante con el enlace de confirmación** (lista A 1, la que menos
cambia): sólo la reserva por enlace manda comprobante, como en D8; el `after()`
de `POST /api/reservar/[codigo]` emite el enlace (`emitirEnlaceConfirmacion`,
`creadoPor` null = sistema) y la plantilla cambia el último renglón por «Para
confirmar tu asistencia o avisar que no podrás ir, usa este enlace:» con la
URL (y un `href` sólo `http(s)` sin comillas ni espacios). Si no se puede
emitir (E1 sin aplicar, sin secreto, cita ya pasada, error), sale el
comprobante de D8 tal cual. Las citas del personal siguen sin correo al
agendar. El cuerpo es determinista (lo necesita la idempotencia de E4).
**No se registra en `cita_correos`** (`cita_correo_tomar/marcar` de plan_E):
esa tabla es de E4, que va en otra rama y aún no existe aquí. Quien integre E4
tiene que envolver este envío con su registro (`comprobante/<envío>`), o la
lista A 4 («no hay recordatorio si ya salió el comprobante para ese inicio»)
no se cumplirá. Texto PENDIENTE DE REVISIÓN. La e2e de D10 (`reserva-enlace`)
pasa a esperar `/confirmar/<22>` en vez de «comunícate con el consultorio».

**E6 · reagendar desde «no podré asistir»** (migración `20261115130000`,
lista A 11):
- **El flujo de §2 al pie de la letra:** primero se cancela por el enlace; la
  página cancelada ofrece «Elegir otro horario», que lleva al ENLACE FIJO del
  médico de D (`/reservar/<fijo>?origen=<código de confirmación>`). La reserva
  es la de D entera (código al correo, candado, «1 activa»); con `origen`, la
  ruta de D5 llama a `reagendar_por_enlace`, que valida en la misma
  transacción el enlace de confirmación (vigente, con `cancelo`, del mismo
  destinatario, hasta 7 días después de la respuesta), que la cita de origen
  siga cancelada (`FOR UPDATE`: el personal no la reactiva a la vez), que no
  esté reagendada ya, el enlace fijo vigente del MISMO médico y el tope
  (`origen.reserva_reagendados < candado_reagendados`, 2), y llama a
  `reservar_por_enlace`. Con `ok`: `reserva_reagendados = origen + 1` (auditado
  `cita_editada` con `via:'enlace_paciente'`) y una fila en `cita_reagendos`.
- **Auditoría independiente: APTA CON CAMBIOS**, aplicados: un `repetida` de
  D3 que no es el reagendado de ese origen da `reagendar_invalido`; `spinus.via`
  se limpia tras anotar (dura hasta el fin de la transacción); COMMENT de
  `appointments.reserva_reagendados` con el convenio de E6. **Para revisar por
  Angel:** el correo que se verifica al reagendar no tiene por qué ser el de la
  cita de origen (una cita del personal no guarda su seudónimo), así que quien
  tenga el enlace de confirmación puede reagendar con otro correo; el personal
  liga la cita nueva al iniciar la consulta, como toda reserva.
- **Timestamp y nombre:** `20261115130000_agenda_e6_reagendar.sql` (el diseño
  decía `…140000_agenda_e3_reagendar`; el encargo fijó 130000).
- **Diferencias con el SQL del diseño:** cierre de la clínica suspendida en
  las dos funciones (como E1, con la huella de `clinica_no_suspendida()` en el
  pre-vuelo); `FOR UPDATE` también sobre la cita de origen (mismo orden de
  candados que `responder`: confirmación → cita); `authenticated` lee 6
  columnas, sin `confirmacion_id`; índice para la FK a `cita_confirmaciones`;
  `ya_reagendada` se dice antes que `vencida` en la oferta; pre-vuelo con la
  firma Y el resultado de `reservar_por_enlace`, y con el md5 de
  `log_cita_change` de E1 (sin la lista blanca, el reagendado no quedaría a
  nombre del paciente).
- **La oferta sólo se enseña si el fijo abre de verdad** (`abrirEnlace`:
  secreto, aviso publicable y aprobado, interruptor, S3, médico en la
  clínica; vigente, con consultorios y tipos). Si no, o con `tope`,
  `sin_enlace` o `vencida`: «Para agendar otra cita, comunícate al
  {teléfono}». Ya reagendada: «Ya elegiste otro horario para esta cita». La
  oferta es STABLE: el GET de la página sigue sin escribir nada.
- **`/reservar/<fijo>?origen=`** sólo se toma si el código es un enlace de
  confirmación cancelado por el paciente y de la MISMA clínica; si no, se
  ignora y la reserva es normal. Enseña «Estás reagendando tu cita del
  {fecha}». La base vuelve a validarlo todo.
- **Respuestas nuevas** (`respuestasReserva.ts`): `tope_reagendados` 403 con
  «Para agendar, comunícate con el consultorio: {teléfono}»; `ya_reagendada`
  409; `reagendar_invalido` (y `apagado`) el 404 uniforme. Sin la migración,
  `ausente` → 404.
- **El enlace de confirmación de la cita de origen NO se revoca** al
  reagendar (E1 pensaba usar `revocar` aquí): revocado, el correo viejo daría
  404; vigente, dice «Ya elegiste otro horario». La cita nueva recibe su propio
  enlace en su comprobante (E5).
- **La cita nueva es «por ligar»** aunque la de origen tuviera paciente (la
  reserva pública no liga pacientes). **Sin la línea «Reagendada desde la cita
  del {fecha}» en el modal** que pedía el diseño: `AppointmentModal.tsx` no se
  toca en este encargo (otro agente). La tabla `cita_reagendos` ya es legible
  por la RLS para quien la añada.
- **Coherencia con D2:** con origen por enlace, cancelar → reagendar (1) →
  cancelar → reagendar (2) → cancelar son tres incidencias: tope y bloqueo a
  la vez. Con origen del personal (sin `reserva_canal`) la primera
  cancelación no es incidencia: el tope llega con dos.
- **El tope no impide una reserva nueva:** la persona puede reservar otra
  cita con el fijo SIN `origen` (la reserva normal de D, con su candado); el
  tope sólo cuenta la cadena de reagendados de una cita.

**E10 · e2e de cierre de lo de este encargo** (`e2e/confirmacion-enlace.e2e.ts`,
sólo `escritorio`, leyendo Mailpit): GET (tres agentes de usuario), HEAD,
`?paso=cancelar`, `?r=` y el navegador sin pulsar no cambian la cita ni la
auditoría, y la API por GET/HEAD da 405; confirmar (un POST, 303, auditado
`system`/`enlace_paciente`; recargar no reenvía); cancelar en dos pasos y el
turno vuelve a ofrecerse; la carrera a T−1h (cita a +1 h +20 s; la página
ofrece cancelar y se pulsa pasado el corte: `fuera_de_plazo` con el teléfono, la cita sigue, confirmar aún vale);
cita pasada («ya pasó», sin botones) y enlace revocado o inventado (404);
clínica suspendida e interruptor apagado (404, sin cambio); reagendar con el
fijo dos veces y la tercera con el tope (403 y sin oferta); el comprobante con
el enlace y sin nada clínico. **No cubre** (son de E4/E7/E9, de otra rama): el
recordatorio, la tarea programada, WhatsApp, el aviso a la clínica, el RSVP, ni
el reflejo en Google contra el Google falso (sí en Vitest). Las citas del
personal se siembran por SQL con su enlace (la emisión desde la agenda es de
E4/E7). Las citas del personal que siembra (con un paciente de la semilla y HOY) se
borran al terminar, con su enlace y su auditoría: sin eso, `agenda-iniciar-
consulta` en `telefono` encontraba una de ellas al buscar la tarjeta de
«Paciente Prueba 01» y fallaba. Una prueba de D10 (`reserva-candado`,
«coincidir sólo por el teléfono») dio una vez 429 en una corrida completa y
pasó al repetirla: la base local la comparten otros agentes; queda anotado.

### Bloque E — decisiones tomadas en E4, E7, E8 y E9

**E4 · migración `20261115140000_agenda_e4_correos_cita.sql` y la tarea de recordatorios:**
- **Tabla `cita_correos`** como en el diseño (llave `(cita, tipo, inicio_cita)`,
  sin destinatario ni contenido, testigo + `tomado_en`, 3 intentos). Diferencias
  con plan_E: la puerta S3 también en el **listado** (si no, las clínicas sin
  acceso ocuparían el tope de 200 en cada ejecución, el mismo resto que tiene
  C7); `fallido` con motivo `duplicado` (409 de Resend) **no** se reintenta;
  `intentos` CHECK 1..3 (no 1..5); índice por `clinica_id` para la FK RESTRICT;
  CHECK de coherencia más estricto. El tipo `comprobante` queda listo para E5
  (mismas `tomar`/`marcar`).
- **Auditoría (APTA CON CAMBIOS):** aplicado el hallazgo 1 (un comprobante
  `enviando` de hace menos de 10 min también impide el recordatorio del mismo
  inicio). No aplicados, para Angel: (2) un envío en su tercer intento cuya
  ejecución muere queda `enviando` para siempre (no manda nada de más; falta
  el renglón de cierre); (3) `duplicado` junta el 409 de otro cuerpo y el
  concurrente; (5) el pre-vuelo no compara el disparador. El auditor resolvió
  lo que B0-E1 dejaban «sin calificar»: el `BEGIN/COMMIT` explícito con el
  `SELECT` final fuera es correcto con postgres-meta.
- **Propuesta de dimensión 19 para `AUDITORIA-MIGRACIONES.md`** (del auditor de
  E4; no se tocó el archivo): *funciones que leen el `prosrc` de OTRA función,
  lo reescriben y lo ejecutan (la puerta S3 de C1): el pre-vuelo debe exigir la
  forma exacta de la fuente y abortar si cambió, la reejecución debe correr con
  los mismos privilegios y `search_path`, y la sustitución no debe abrir
  inyección.* Hay otra dimensión 19 propuesta en «Menores»: numerarlas al decidir.
- **Ruta `GET /api/cron/recordatorios`** (S2): `autorizada()` extraída a
  `src/lib/cronAutorizacion.ts` y usada también por `/api/cron/google-sync`
  (lista A 19); `{ok:true}` o 401/500 sin cuerpo; la ruta no crea clientes y
  `recordatorios.ts` sólo llama RPC con el `clinica_id` del listado; entrada
  `===` en el middleware. `vercel.json`: `*/15 * * * *`, sin activar (faltan
  `CRON_SECRET`, `EMAIL_TRANSPORT=resend` y el despliegue).
- **Cuándo no toma nada:** transporte apagado **o sin `RESERVA_SECRETO`** (el
  diseño sólo decía transporte): sin secreto no hay enlace y cada envío quedaría
  `omitido/sin_enlace` para siempre; así los intentos siguen enteros cuando se
  encienda. Sin las RPC de E4: `{ok:true}`.
- **Presupuesto:** 45 s, 200 citas, 600 ms entre envíos que llegaron a salir.
  ⚠️ **Por verificar** el límite por segundo de la cuenta de Resend antes de
  encender.
- **Transporte:** `Correo.idempotencia` (`^[a-z0-9/_-]{1,256}$`; otra forma se
  manda SIN llave) → `idempotencyKey` de Resend; `invalid_idempotent_request` y
  `concurrent_idempotent_requests` → motivo `duplicado`. Mailpit la ignora.
- **Texto del recordatorio** (`correosCita.ts`, PENDIENTE DE REVISIÓN):
  asunto «Recordatorio: tu cita del {fecha}» sin médico; cuerpo con fecha, hora
  y «zona horaria: {región}» (`regionDeTimezone`), médico, consultorio,
  dirección, teléfono y el enlace; la versión `confirmed` dice «Avisar que no
  podré asistir» sin «Confirmar». Determinista (sin «ahora»). Zona ausente o
  inválida → `America/Mexico_City`.
- **Semilla:** `agenda-semilla.ts` borra `cita_correos` y `cita_confirmaciones`
  (FK RESTRICT a la cita, sin DELETE para el rol de servicio) en el tiempo
  «antes», como postgres. `cita_confirmaciones` es de E1, pero el recordatorio
  y WhatsApp la llenan; si E3 añade la misma línea, el choque es trivial.
- **e2e** `e2e/recordatorios.e2e.ts`: escrita, **no corrida**. Necesita un
  `CRON_SECRET` sólo de prueba en `.env.local` (no se añadió: sin él el archivo
  se salta).
- **Encontrado al verificar:** la base local compartida tiene ya otra versión de
  `cita_confirmacion_contexto` (la de E3, que cierra la suspendida), así que
  `e1_confirmacion_enlace.sql` de ESTA rama falla en su caso 4 contra ella; las
  demás pruebas SQL, `e4_correos_cita.sql` incluida, pasan una a una. Se
  resuelve al fusionar con la rama de E3.
- **Revisión independiente del diff (APTO):** confirmó contra la documentación
  de Resend los dos nombres de error de la llave; sin hallazgos nuevos aparte
  del envío zombi del tercer intento (ya anotado) y de una ventana de
  milisegundos entre la toma y la emisión del enlace (si en ese instante se
  apaga el interruptor, el envío queda `omitido/sin_enlace`).

**E7 · WhatsApp manual (sin migración):**
- **Formato verificado en la documentación oficial de WhatsApp el 2026-11-12:**
  https://faq.whatsapp.com/5913398998672934 («Usa `https://wa.me/<number>` …
  número de teléfono completo en formato internacional. No incluyas ceros,
  paréntesis ni guiones»; mensaje en `?text=` codificado) y
  https://faq.whatsapp.com/1294841057948784 («Los números de teléfono de México
  (código de país "52") deben incluir un "1" después del "+52"»). Por tanto
  `https://wa.me/521` + 10 dígitos (`normalizarTelefonoMx` de D5); si no se
  puede normalizar, el botón queda deshabilitado con «Teléfono sin formato
  válido».
- **`POST /api/agenda/whatsapp`** `{cita_id, paso:'preparar'|'abierto', tipo:'enlace'|'recordatorio'}`
  (`strictObject`). Puertas: `entradaGestion()` (la de D6: 401/403/404 con el
  interruptor apagado) → la cita con la SESIÓN y `clinica_id` (404 si la RLS no
  la deja ver) → con paciente o por ligar, `scheduled`/`confirmed`, con hora y
  futura (409 `no_aplica`) → teléfono del paciente o de la reserva (422).
  `preparar` emite el enlace de E2 con el `clinica_id` y el perfil de la sesión
  y devuelve el `wa.me` ya armado (el servidor compone el texto); no escribe en
  `appointments`. `abierto` escribe UNA columna con la hora del servidor, con
  el cliente de sesión, sin tocar `updated_at` (lo audita `log_cita_change` a
  nombre de quien pulsó). Sin enlace (sin secreto o apagado en la base) → 503.
- **Quién puede:** cualquier rol que vea la cita (la RLS decide; el invitado,
  sólo las suyas). No se añadió un permiso propio.
- **Texto** (`whatsappCita.ts`, PENDIENTE DE REVISIÓN): «Hola. Le escribimos del
  consultorio de {médico}. Su cita es el {fecha} a las {hora} en {consultorio}.
  Para confirmar o avisar que no podrá asistir: {url}» (confirmada: «Si no podrá
  asistir, avísenos aquí»). Sin nombre del paciente ni nada clínico.
- **Botón en el modal** (`BotonWhatsAppCita`, `tipo:'enlace'` →
  `whatsapp_sent_at`): con v2, en edición, en una cita (no evento) agendada o
  confirmada. Prepara en ocioso al abrir y pinta un `<a target="_blank">` real
  (no lo bloquea el navegador); al pulsar, `abierto` con `keepalive` y «Abierto
  en WhatsApp hh:mm». Que sea futura y tenga teléfono lo dice el servidor en el
  motivo del botón. **La tarjeta de lectura no lo lleva**: es del bloque F (otra
  rama); el componente está listo para montarse ahí.
- **«Por confirmar (N)»** (`PanelPorConfirmar`, en `CabeceraEscritorio` por una
  ranura `porConfirmar`; sólo con v2): `GET /api/agenda/por-confirmar` con la
  sesión, citas `scheduled` de MAÑANA en la zona de cada consultorio
  (`esDeManana`; lista A 13), con paciente o por ligar; las confirmadas salen.
  Sin teléfono en la respuesta. Cada fila lleva su botón (`tipo:'recordatorio'`
  → `whatsapp_reminder_sent_at`), que se prepara al abrir el panel (emite el
  enlace de cada cita de la lista). **Sólo escritorio**: en móvil no hay botón
  (la banda móvil es otra cabecera); queda para F.
- **Pruebas:** `whatsappCita.test.ts` (formatos de número, texto, zona) y
  `whatsappRuta.test.ts` (puertas, `preparar` sin escribir, `abierto` con una
  columna y `clinica_id`, lista de mañana). e2e `e2e/whatsapp-manual.e2e.ts`
  escrita, **no corrida** (intercepta `wa.me` con `page.route`).
- **Revisión independiente (APTO):** volvió a comprobar las dos páginas de
  WhatsApp, la RLS de `appointments_update` (médico de la cita, administrador y
  secretaria) y que apagado no sale ninguna petición. Detalle anotado: la
  documentación escribe `wa.me/<número>/?text=` con barra y el código la omite
  (`wa.me/<número>?text=`, la forma de su ejemplo con número); las dos abren.

**E8 · «Avisa a la clínica» (sin migración):**
- Como en el diseño: **sin correo a la clínica** (lista A 12), sin tocar la
  publicación de Realtime y sin truco de `client_id`.
- **Aviso emergente:** `useTiempoRealAgenda` gana `onCanceladaAjena?`; se llama
  sólo con un UPDATE a `cancelled` de una cita PINTADA que no estaba cancelada
  y que no es eco propio (`esCancelacionAjena`, se evalúa antes de consumir la
  firma y de fusionar). La agenda (sólo con v2) pregunta una vez a
  `GET /api/agenda/respuestas?cita=` (sesión, RLS de las 7 columnas de E1,
  `clinica_id` explícito; sin la tabla, `{respuesta:null}`) y avisa sólo si es
  `cancelo` de hace menos de 2 min: «Un paciente canceló su cita del {fecha} a
  las {hora}.», sin nombre. Una cita fuera de la vista no avisa: queda en el
  panel. Una cancelación del personal o de Google no avisa (no hay respuesta
  reciente).
- **Aviso persistente:** `GET /api/agenda/por-confirmar` devuelve también
  `canceladas` (respuestas `cancelo` de las últimas 48 h cuya cita SIGUE
  cancelada: si el personal la reactivó, sale), y el panel las pinta en
  «Canceladas por el paciente (48 h)» con un contador rojo junto a «Por
  confirmar». El panel se recarga cuando sale el aviso.
- **Límite conocido:** quien tenga la agenda en móvil ve el aviso emergente
  pero no el panel (el panel sólo está en la cabecera de escritorio, E7).
- **Pruebas:** `avisoCancelacion.test.ts` (eco propio, otro estado, ya
  cancelada, no pintada, INSERT/DELETE, antigüedad). e2e
  `e2e/aviso-cancelacion.e2e.ts` escrita, **no corrida** (cancela llamando a
  `cita_confirmacion_responder` como `service_role`, como haría el POST de E3).
- **Revisión independiente (APTO).** Nota suya, para Angel: la sección del
  panel enseña el TÍTULO de la cita (en una cita con paciente, su nombre), como
  la lista de mañana de E7; es la vista del personal, con la RLS de siempre. «Sin
  nombre» vale para el aviso emergente, no para el panel.

**E9 · RSVP de Google (migración `20261115160000_agenda_e9_rsvp_google.sql`):**
- **Detrás de `AGENDA_RSVP_GOOGLE=encendido`** (variable de entorno, apagada por
  omisión; cualquier otro valor apaga), además de la v2 y de las puertas del
  sondeo de C. Angel la enciende después de comprobar con su cuenta real que un
  RSVP llega por `syncToken` (§8, sin documentar). **No se escribió**
  `scripts/gcal-rsvp-humo.ts` (el diseño lo proponía para esa prueba): habla con
  Google real y aquí no se toca; queda para Angel.
- **`cita_rsvp_google(clinica, cita, calendario, evento, correos[])`**, INVOKER,
  sólo `service_role`: `scheduled` → `confirmed` si un correo aceptado (en
  minúsculas y sin espacios, en la base) es `pacientes.email` o
  `reserva_correo` de ESA cita; cita futura (hora real tras `FOR UPDATE`), con
  hora, con paciente o por ligar, ligada a ESE evento (diferencia con el diseño:
  la firma lleva el id del evento) y calendario de la conexión activa;
  `updated_at` = máximo(el que tenía, ahora); auditoría `via:'google_rsvp'`,
  `user_id 'system'`. Nunca cancela ni reactiva; `declined` no llega.
- **En el sondeo** (`gcalSincronizacion.ts`): DESPUÉS de las decisiones de C3 y
  del restablecimiento de C5, que no cambian (lo prueba
  `gcalSincronizacion.test.ts`: lo aplicado es idéntico con y sin RSVP); sólo
  filas `scheduled` con paciente o por ligar y eventos vivos; los correos salen
  de `aceptaronDe` (sin organizador, `self` ni `resource`; ≤ 50). Un fallo
  cuenta en `errores` y la página avanza. El envoltorio vive en
  `gcalSincronizacionBase.ts` (añadido al cerrojo).
- **El color de Google no se cambia** al confirmar por RSVP (no se escribe en
  Google desde un RSVP); se corrige en la siguiente edición desde Spinus, como
  el resto conocido de C5 con el color de `confirmed`.
- **Riesgo aceptado (plan_E):** un asistente con el mismo correo que el
  paciente, que no es el paciente, confirmaría la cita.
- **Auditoría independiente (APTA, sin cambios).** Su hallazgo 1 («la rama por
  ligar es inalcanzable porque el sondeo filtra con `conPaciente`») resultó
  falso: desde D4, `r_con_paciente` incluye las citas por ligar. Propuso una
  dimensión más para `AUDITORIA-MIGRACIONES.md` (no se tocó el archivo): *el
  alcance del llamador frente a las ramas de la función: leer el código que la
  invoca y comprobar que cada rama que la prueba SQL certifica se ejerce de
  verdad.*
- **Pruebas:** `e9_rsvp_google.sql` (correo del paciente en otra caja, reserva
  por ligar, diez casos sin cambio, 22023, permisos), `gcalRsvp.test.ts` y el
  bloque E9 de `gcalSincronizacion.test.ts` contra el Google simulado (apagado
  sin llamadas, encendido con los aceptados normalizados, filtros, fallo
  contado, decisiones de C3 idénticas).
- **Revisión independiente del diff (APTO):** confirmó en la base local que
  `gcal_citas_por_evento` marca las por ligar con `r_con_paciente = true` y que
  la función aplicada es idéntica al archivo. Nota: el filtro de TS usa la foto
  de la fila tomada al empezar la página, así que puede haber una llamada de
  más que la base contesta `sin_cambio` (gasto, no riesgo).

**Integración con E4, E7, E8 y E9 (tras el merge `8ff7af5`):**
- **Lista A 4, cumplida:** el comprobante de E5 se registra en `cita_correos`
  (`src/lib/reserva/comprobanteReserva.ts`): `cita_correo_tomar` con
  `tipo:'comprobante'` → enlace → plantilla → `Idempotency-Key =
  comprobante/<envío>` → `cita_correo_marcar`. El destinatario es el de la
  base (`r_para`). Con lo que menos cambia lo de hoy: sin las RPC de E4 o si
  la toma falla, sale como en D8 sin registro (puede salir también el
  recordatorio: nunca menos correo que hoy); si la base dice que no toca, no
  sale; un fallo del transporte queda `fallido` y no impide el recordatorio.
  `recordatorios.ts` (E4) exporta `tomarEnvio` y `marcarEnvio` con el tipo
  como parámetro, para no repetir la forma de las RPC. Prueba e2e: una reserva
  dentro de la ventana deja un `comprobante:enviado`, un solo correo y ningún
  recordatorio tras dos pasadas de la tarea.
- **`CRON_SECRET` de prueba** al final del `.env.local` de este worktree
  (aleatorio, con su comentario; ignorado por git): sólo local, para
  `e2e/recordatorios.e2e.ts`. El de producción lo pone Angel en Vercel.
- **Defectos de integración arreglados** (las e2e de E4 y E8 estaban
  «escritas, no corridas»): `recordatorios.e2e.ts` mandaba un texto a una
  columna uuid (`nullif(:'p','')::uuid`); `aviso-cancelacion.e2e.ts` buscaba
  la tarjeta por el título de una cita CON paciente, y la tarjeta pinta el
  nombre del paciente (ahora crea su propio paciente con el título por
  nombre); `agenda-tipos-cita.e2e.ts` no podía borrar sus citas: el botón de
  WhatsApp de E7 emite el enlace de confirmación AL ABRIR el modal
  (`preparar` en un `useEffect`) y la tarea de E4 registra envíos, y las dos
  FK son RESTRICT. **Corregido después** (ver abajo): abrir ya no escribe.
- **E7: el enlace se emite AL PULSAR, no al abrir** (corrección del
  coordinador: mirar no escribe en la base). `BotonWhatsAppCita` (lo usan el
  modal y la lista «Por confirmar»; la lista en sí sólo hace un GET de
  lectura) ya no llama a `preparar` al montarse. Al pulsar, dentro del mismo
  gesto, `window.open('', '_blank')` abre una pestaña en blanco (un
  `window.open` tras un `await` lo bloquean los navegadores; síncrono en el
  clic, no) y se le corta el `opener`; después se prepara, se le asigna la URL
  de `wa.me` y se marca `abierto`, como antes. Si la preparación falla, la
  pestaña se cierra y sale el motivo. Si el navegador la bloqueó igual, queda
  un enlace real «Abrir WhatsApp» (un `<a target="_blank">` pulsado no se
  bloquea) que marca al pulsarlo. Elegida por ser la única que abre WhatsApp
  con UN clic sin emitir nada antes. Prueba: `whatsapp-manual.e2e.ts` «abrir el
  modal de una cita con teléfono y cerrarlo NO crea ningún enlace» (comprobada
  contra el botón viejo: daba 1 enlace y 1 fila de auditoría), y la de la lista
  comprueba 0 antes de pulsar y 1 después. Se quitó de `agenda-tipos-cita` la
  limpieza de E que sólo hacía falta por eso. Las e2e de WhatsApp y de E8 crean
  su propio paciente (la tarjeta pinta el nombre del paciente).
- **¿Llega una clínica suspendida a `gcal_aplicar_evento` por el RSVP (E9)?
  No.** Los dos únicos llamadores de `sincronizarClinica` son
  `POST /api/google/sync` (que antes comprueba `clinica_no_suspendida()` y
  `clinica_tiene_acceso()` con la sesión) y `GET /api/cron/google-sync`; y
  `sincronizarClinica`, después de tomar el candado y ANTES de leer eventos,
  llama a `gcal_sync_clinica_habilitada` (suspensión + acceso) y sale con
  `sin_acceso`. El RSVP (`confirmarPorRsvps` → `cita_rsvp_google`) y el resto
  de escrituras de C (`aplicarEvento`, `restablecerEnGoogle`) sólo corren
  dentro de esa pasada. Los otros dos caminos a `gcal_aplicar_evento` sólo
  tocan columnas técnicas (`vincular`/`etag`): el ligado del evento de una
  reserva (D8; la reserva exige S3) y el reflejo de la respuesta del paciente
  (E3; `responder` ya cierra a la suspendida). No hizo falta ningún `if`:
  queda fijado con una prueba (`gcalSincronizacion.test.ts`, «encendido, con
  la clínica suspendida o sin acceso (S3): ni RSVP ni Google»). Resto
  conocido, el mismo de todo C: una suspensión que llegue A MEDIA pasada (≤ 15
  s por clínica) no corta esa pasada.

### Bloque F

- Las 18 propuestas de la auditoría visual, aprobadas. **El pulido visual y los
  defectos salen directo; las interacciones nuevas** (burbuja de creación
  rápida, tarjeta de lectura, mini calendario, atajos, búsqueda, gestos,
  arrastrar con duración) **van detrás del interruptor**.
- Punto 11 (Compactar a media cita): no se reproduce (desajuste de ≤ 1 px).
- Punto 13 (Mes del teléfono): defecto confirmado y arreglado (`7f81548`).

### Bloque F — decisiones tomadas en F0, F2 lib y F3 componentes

Ronda hecha en paralelo con el bloque E, sin tocar sus archivos
(`AppointmentModal.tsx`, `CabeceraEscritorio.tsx`, `useTiempoRealAgenda.ts`,
`AgendaCliente.tsx`, rutas públicas, middleware, cron). Diseño completo en
`e2e/resultados/plan_F.md` (fuera de git, en el worktree de la agenda).

**Las 25 decisiones de producto del diseño**, con la opción que menos cambia
lo de hoy:

1. **Cambio de fecha sin deslizamiento** (manda CONTRASTE §3): un fundido del
   armazón de 0.7 a 1 en `--ag-dur-micro`, con WAAPI. Alternativa: un desliz de
   4 px solo del título.
2. **Pulso de la cita que llega por tiempo real:** un anillo por opacidad
   (`::after` con `box-shadow` fijo `0 0 0 2px var(--ag-pulso)`; se anima solo
   la opacidad, en `--ag-dur-lento` con retraso `--ag-dur-base`, una vez). Sustituye
   al pulso de `box-shadow` de 900 ms del spec, que pasa del tope de 240 ms.
3. **Salida de una cita:** solo opacidad, 120 ms, sin «encogerse».
4. **Burbuja y tarjeta:** `scale(.97)` desde el punto pulsado (son capas, no
   tarjetas de la rejilla). Si se lee estricto «solo `translateY`», 4 px de
   `translateY`. Construido con `scale` (`.ag-capa`).
5. **Arrastre:** no se añade animación (spec §8); `dragRevertDuration` pasa de
   200 a 180 (= `--ag-dur-base`).
6. **Hora actual:** no se anima (spec §6).
7. **Avisos y paneles:** no se anima el alto; la rejilla salta una vez.
8. **Leyenda:** al pie, siempre visible, en vez de detrás de «?».
9. **CORREGIDA. Estado fuera de la tarjeta de Semana:** el diseño lo dejaba
   solo en el `title`, y entonces agendada y confirmada se distinguían solo por
   color, contra el spec §12 («el color nunca es la única señal»). **Se
   sustituye la palabra por el glifo de `GLIFO_PILDORA`
   (`FilaListaDetalle.tsx`) delante de la hora, además del `title`.** Lo hace el
   agente de la superficie (es su archivo). ⚠️ **Para él, sin resolver todavía:**
   hoy `GLIFO_PILDORA` da el MISMO glifo (`●`) a agendada y a confirmada, así que
   el glifo solo no separa justo ese par. Hace falta uno distinto para una de
   las dos (p. ej. `○` para agendada, «aún sin confirmar»); como el glifo
   también sale en la píldora de `listDay`, cambiarlo se ve allí. Si se decide
   no tocarlo, el par sigue dependiendo del color en Semana.
10. **Nombre corto:** «Nombre I.» (primer nombre y la inicial del primer apellido).
11. **Barra lateral:** plegable solo en /agenda; desplegada por omisión;
    preferencia por navegador; fuera de la agenda siempre desplegada; sin animar
    el ancho.
12. **Densidad:** «Normal» por omisión; la compacta es de 24 px por franja;
    preferencia local.
13. **«Compactar» por omisión:** se decide al abrir si hay días cerrados; no se
    recuerda.
14. **Mes con filas al contenido:** puede quedar espacio debajo; la primera
    fila con días del mes anterior se queda si el día 1 no cae en lunes.
15. **Tableta:** chip «3 días» en rejilla; Día en rejilla; Mes como en el
    teléfono. Alternativa: dejarla como hoy.
16. **«Hoy» en el teléfono:** sale sin interruptor (§6-bis no lo pone en la lista).
17. **Modal:** 560 px de ancho; duraciones en una fila; estados en una fila de 5;
    «Iniciar consulta» con relleno tonal; salida animada solo en el modal de la cita.
18. **Burbuja:** solo citas con paciente; la banda de todo el día va al modal;
    médico el del filtro, y con «Todos» se pide; consultorio el activo, y si no
    es del médico, «Más opciones»; sin tipo de cita; se conserva la
    confirmación de «fuera de horario» antes de abrir; se conserva la
    invitación de Google tras crear.
19. **Duración:** más de una franja es arrastre; un clic o un hueco del panel
    dan la duración por omisión.
20. **Tarjeta:** Google sigue sin abrir nada; por ligar, «Iniciar consulta» abre
    el modal; Reagendar abre el modal con el foco en la fecha; Cancelar y
    Eliminar piden confirmación; en el teléfono, hoja inferior.
21. **Minicalendario:** sin puntos de ocupación; en el panel de Día y en un
    desplegable de la fecha; en el teléfono, no.
22. **Búsqueda:** desde hace 30 días hasta dentro de un año, 20 resultados, con
    las citas por ligar, sin API nueva.
23. **Atajos:** encendidos por omisión con v2; se pueden apagar (WCAG 2.1.4).
24. **Deslizar:** solo en las listas de Día y Semana del teléfono.
25. **Capturas del «después»:** dos juegos, interruptor apagado (mismos nombres)
    y encendido (`v2/`).

**Decisiones de construcción de esta ronda** (sin regla previa):

- **F0 · tokens.** `--ag-1 … --ag-8` con los medios `--ag-1-5`, `--ag-2-5`,
  `--ag-3-5` y `--ag-4-5: 18px`; **no hay `--ag-7`** (el spec salta de 24 a 32).
  Declararlos no migra nada: el enganche regla por regla es F1.19.
  `--ag-pulso` en claro sigue a la marca (`--ag-brand-secondary`) y en oscuro es
  `#6b9bff`, el mismo reparto que `--ag-month-today-ring`.
- **F0 · movimiento reducido.** Un solo bloque, el que ya existía; se le
  añadieron `.ag-modal-panel`, `.ag-modal-velo`, `.ag-capa`, `.ag-capa *`,
  `.ag-hoja`, `.ag-hoja *` (contrato de F0), y en esta ronda `.ag-dia-aside`
  (el panel mismo, que ahora entra con `ag-vista`) y `.ag-capa-velo`.
- **F0 · `movimientoAgenda.ts`.** `duracionToken`, `curvaToken`,
  `prefiereMenosMovimiento` y `duracionMovimiento` (0 con `reduce`). La REGLA de
  la e2e es pura y vive aquí (`incumplimientosDeMovimiento`, solo
  `opacity`/`transform` y ≤ 240 ms, excepción `ag-barra-carga`), probada con
  Vitest, incluida la mutación de la `transition: width` en datos. La ayuda
  `animacionesFueraDeRegla()` (`e2e/movimientoAyudas.ts`) solo extrae
  `document.getAnimations()`. **La mutación contra el navegador queda para
  quien corra la e2e con servidor.**
- **F0 · `capturar.ts`** (fuera de git, `e2e/resultados/F/`): resuelve el repo
  desde su propia ruta (antes tenía el worktree escrito a mano); el interruptor
  se reaplica tras cada siembra, porque la semilla rehace `agenda_ajustes`; con
  `encendido` la salida va a `<fase>/v2/`; `--reducido` añade el sufijo
  `-reducido`; el JSON de cuadros va a `cuadros[-cpuN][-reducido].json`; un tramo
  que no se puede hacer (la burbuja sin interruptor) sale «OMITIDO» y no rompe la
  corrida. ASUMIENDO que `postgres` puede insertar y borrar las 20 citas de la
  ráfaga (como la semilla). **No se ha ejecutado: el «antes» lo mide el
  orquestador con el servidor.**
- **F2.1 · hover.** Fuera `scale(1.02)` y `drop-shadow`; queda el `z-index: 10`
  (no es movimiento: con dos citas encimadas pone delante la de debajo del
  ratón). **El hover ya no cambia ningún color**: el fondo y los bordes de
  `.ag-tarjeta` van en línea, y un tinte de hover tendría que ir en
  `MemoizedEventContent` (archivo de la superficie). **Pendiente, en un archivo de
  E:** los botones de la barra siguen con `transition-all` de Tailwind
  (`CabeceraEscritorio.tsx`); el diseño los pasa a `background-color` y
  `border-color` en micro.
- **F2.2 · `ag-vista`.** Sobre `.agenda-fc .fc-view-harness > .fc-view` y
  `.ag-dia-aside`, con `backwards`. Comprobado en FullCalendar que `.fc-view` solo
  se vuelve a montar al cambiar de tipo de vista.
- **F2.6-lib · `flipTarjetas.ts`.** El selector es `[data-cita-id="…"]` con
  `JSON.stringify` (sin `CSS.escape`, que no existe fuera del navegador); umbral de
  0.5 px; en filas de lista, fundido 0 → 1 en base con ease-out. Hasta que la
  superficie ponga `data-cita-id` (F1.4) no encuentra nada y aplica sin animar.
- **`marcasMovimiento.ts`.** Marca de 600 ms; `ApiSalida` la cumple el `Calendar`
  de `@fullcalendar/core`, no el tipo `CalendarApi` de `getApi()` (no declara
  `batchRendering`): el llamador estrecha con `instanceof`, como ya hacen
  `useTiempoRealAgenda` y `guardadoCitas`. `vaciarMarcas` queda para el cierre de
  sesión, sin enchufar.
- **`posicionCapa.ts`.** Derecha, si no izquierda, si no debajo, si no encima;
  8 px de separación y de margen; con punto, la capa sube 24 px para que su
  cabecera quede a la altura del dedo.
- **`gestoDeslizar.ts` / `useDeslizarPeriodo.ts`.** Resistencia 0.6 hasta el
  umbral y 0.2 después; solo dedo o lápiz; `pointercancel` vuelve sin pasar de
  periodo; `touch-action: pan-y` por la clase `ag-deslizable`.
- **Atajos.** Mayús no cuenta como modificador (sin ella no salen `/` ni `?` en el
  teclado español); la repetición de tecla se ignora; «capa abierta» se mira
  también en el DOM (`[role="dialog"][aria-modal="true"]`), para cubrir cualquier
  modal; preferencia en `localStorage` `spinus.agenda.atajos` (`si`/`no`).
- **Minicalendario.** Seis semanas fijas (el alto no cambia entre meses);
  Mayús+Re Pág/Av Pág cambia de año, como en APG; el foco solo se mueve tras una
  tecla. El archivo puro se llama `rejillaMes.ts` y no `miniMes.ts`, para no
  chocar por mayúsculas con `MiniMes.tsx`.
- **Búsqueda.** La consulta de pacientes vive en `buscarCitasPaciente.ts` (no en
  `altaRapida.ts`, que queda pura) y la usan el buscador y la burbuja. **Una
  diferencia con la del modal:** el texto se limpia de `,`, `(`, `)`, `%`, `*`,
  `\` y `"` antes de ir dentro de `.or(...)`, donde son sintaxis de PostgREST.
  No hay filtro de médico propio: manda la RLS (`appointments_select`).
- **Alta rápida.** Una selección que cruza de día cae a la duración por omisión;
  el fin se topa en 23:59; sin paciente no se arma nada (nunca un evento ni una
  por ligar).
- **Tarjeta.** «Reagendar» y «Cancelar» solo con la cita agendada o confirmada;
  «Iniciar consulta» la decide el llamador con las condiciones del modal. El
  archivo puro es `accionesTarjeta.ts`, no `tarjetaLectura.ts` (mayúsculas).
- **`opcionesLista.ts`** (nuevo, no estaba en el diseño): la tecla → opción
  activa de los tres controles con foco itinerante (lista de la burbuja, lista
  del buscador, barra de la tarjeta). Tres usos.
- **Capas.** Escape, foco atrapado y devolución del foco con `useDialogoModal`;
  tocar fuera cierra; salida con `data-estado="saliendo"` + `animationend` +
  temporizador de seguridad. `colocar`, `useSalida` y `useCerrarAlTocarFuera`
  están COPIADOS a propósito en `BurbujaAlta.tsx` y `TarjetaLectura.tsx` (dos usos,
  protocolo 4). `z-index: 45`, entre la rejilla y los modales (50 y 60). La hoja
  del teléfono y la ayuda llevan velo; la burbuja y la tarjeta de escritorio no.
  La ayuda de atajos cierra sin animación de salida (es un panel de consulta, se
  abre poco); las capas no se recolocan si la ventana cambia de tamaño con ellas
  abiertas (se cierran al tocar fuera). Hallazgos menores del revisor, aceptados.
- **Buscador:** una respuesta tardía de un paciente anterior no pisa la lista del
  actual (contador de petición, hallazgo del revisor, corregido antes del commit).
- **Pruebas sin DOM.** Vitest corre en `node` y no hay `jsdom` ni Testing Library
  (sin dependencias nuevas): los componentes se prueban con
  `renderToStaticMarkup` (roles, nombres, foco itinerante) y los ganchos por sus
  manejadores exportados (`manejarTeclaAtajo`, `crearDeslizador`). El
  comportamiento con teclado de punta a punta va en la e2e del enchufe.

**Lo que queda para enchufar después de integrar E** (ninguno de estos
archivos nuevos se importa todavía desde la agenda):

- `clasesDelEvento` (`tarjetasAgenda.ts`) llama a `clasesDeMovimiento`;
  `registrarNuevo` antes de `addEvent` en `handleSave` y en
  `aplicarCambioRealtime`; `podarMarcas` en `alCambiarEventos`;
  `salirConAnimacion` en `handleDelete` y en las dos bajas de
  `useTiempoRealAgenda`. El CSS de `.ag-ev-remoto::after` y `.ag-ev-saliendo` (F2.4/F2.5).
- `animarFlip` en `useTiempoRealAgenda` (cita movida) y en `restaurarPosicion`.
- El fundido de navegación (F2.3) en `alCambiarFechas`, y `dragRevertDuration={180}`.
- Burbuja y tarjeta en `altaCitas.ts` (`abrirAlta`/`abrirCita` con `agendaV2`),
  `seleccionDesdeHueco` en `abrirHueco`, `unselectCancel=".ag-capa"`,
  `eventInteractive={agendaV2}`, `cambiarEstadoCita` en `guardadoCitas.ts`, y
  `ModalState.create.horaFin` / `ModalState.edit.enfocar` en `AppointmentModal`.
- `MiniMes` en `PanelDia.tsx` y en el desplegable de la barra; `BuscadorCitas`
  tras la lupa; `useAtajosAgenda` + `AyudaAtajos`; `useDeslizarPeriodo` en las
  listas del teléfono. Todo con `next/dynamic` y precarga en ocioso solo con
  `agendaV2`.
- `data-cita-id` en las raíces de las tarjetas (superficie, F1.4).

### Bloque F — decisiones tomadas en la superficie

Agente A («Superficie»), §1 del diseño (`e2e/resultados/plan_F.md`). Todo sale
directo, sin interruptor. Pruebas en `e2e/agenda-f-pulido.e2e.ts`.

**Medición «antes» de cuadros** (F §4, antes de tocar `src/`): `capturar.ts
--solo=cuadros --cpu=4`, mes lleno con `--volumen 2000`, en
`e2e/resultados/F/antes/cuadros-cpu4.json`. **Arreglo del script:** tras
navegar por Mes, FullCalendar deja la fecha en el día 1 y al volver a Semana
pintaba la semana del día 1, no la de hoy; la baja salía «OMITIDO» (no
encontraba su evento) y los 20 pulsos caían fuera de la vista. Ahora pulsa
«Hoy» al acabar los tramos de navegación. Sólo cambió el script.

**Paso 1 · F1.4, F1.5, F1.6, F1.8, F1.10, F1.14, F1.15**

- **F1.4.** `data-cita-id` en la raíz de `MemoizedEventContent`, `MonthChip`,
  `FilaLista` y `FilaListaDetalle` (no en `BandaChip` ni en `GoogleEventCard`:
  la banda de todo el día no es un archivo de la superficie y Google no es una
  cita). Teléfono (`pacientes.telefono`, o `reserva_telefono` en una por ligar)
  y consultorio (`consultorio_nombre_corto`) montados siempre y visibles sólo en
  Día, detrás del motivo, en `--ag-ink-600` (el `--ag-muted` del descriptor da
  ~3:1 sobre el tinte). Ceden ancho antes que el nombre (`flex-shrink: 1000`).
- **F1.8 / decisión 9 corregida.** La palabra del estado sale de la tarjeta en
  TODAS las vistas de rejilla (en Día ya la decía la píldora); sin motivo, la
  tercera línea desaparece. El glifo va delante de la hora en Semana y en Día,
  a 11 px, en el color de la hora: **agendada `○`, confirmada `●`**, atendida
  `✓`, no asistió `—`, cancelada `✕`. `GLIFO_PILDORA` se exporta de
  `FilaListaDetalle.tsx` y lo usan las dos, así que la píldora de `listDay`
  cambia también (agendada pasa a `○`). Comprobado en captura a 11 px en claro
  y oscuro: `○` y `●` se distinguen. La píldora de Día de escritorio no usa el
  glifo (su punto es un `::before`) y no cambia. El `title` de la tarjeta es
  «Nombre · Estado».
- **F1.5.** Encendido si el horario tiene algún día cerrado. Se decide UNA vez
  y no se recuerda. **Hallazgo del revisor, corregido antes del commit:** si la
  semilla de config del layout falla, el primer render trae `HORARIO_DEFAULT`
  (fin de semana cerrado) y habría encendido «Compactar» en una clínica abierta
  los siete días; ahora no se decide mientras el horario sea esa constante (se
  compara por identidad) y un efecto decide una vez al llegar el real. Afectó a una e2e
  (`agenda-vistas`, que esperaba arrancar apagado): ahora arranca encendido y
  recorre el ciclo. No hizo falta la ayuda `apagarCompactar`: ninguna otra e2e
  pulsa horas o domingos fuera de horario en la semana visible.
- **F1.6.** Con «Compactar» encendido en Mes, FullCalendar recorta los días
  plegados de los bordes del mes ANTES de encajar a semanas (`trimHiddenDays`
  sobre `currentRange`), así que un mes que empieza en domingo pierde la
  primera fila cuando el domingo está plegado. Es correcto (esa fila sólo
  tendría días del mes anterior) y `semanasPintadasDelMes` sigue calculando el
  rango sin recortar, como antes. `rangosDeLaVista` lee `fixedWeekCount` de la
  vista (`getOption`), no una constante.
- **F1.10.** Escritorio: «Hoy» secundario (superficie, borde, tinta); el
  deshabilitado se ve igual, sin hover y con `cursor: default`. La transición de
  `.agenda-fc .fc-button` pasa de `all .15s` a fondo y borde en micro. Teléfono:
  «Hoy» en la primera fila de la banda, con `aria-disabled` (enfocable, no
  actúa) cuando `currentStart ≤ ahora < currentEnd`. **Toca `AgendaCliente`
  (un estado booleano y dos props), que no estaba en la lista de F1.10 del
  diseño: sin eso el botón no puede navegar.**
- **F1.14.** La píldora no cabe junto al nombre a 390 px («Paciente Prueba 01»
  bajaba a dos líneas y la fila pasaba de 72): va a la DERECHA DE LA SEGUNDA
  LÍNEA, junto a «duración · motivo». El nombre conserva el ajuste de línea y
  la segunda línea se recorta con `line-clamp`, no con `nowrap`: en la tabla de
  maquetación automática un `nowrap` ensancha la columna y saca la lista por la
  derecha (la misma lección de `.ag-listafila-nombre`). Relleno vertical de 14 a
  10 px. Medido a 390: 69 px por cita con paciente; un título largo (eventos
  de la semilla) baja a dos líneas y la fila mide 83.
- **F1.15.** Fila 1: ☰ · fecha (15 px/700) con el conteo debajo (12 px) · ‹ ·
  Hoy · ›. Fila 2: conmutador de 186 px (13 px de letra; a 172 «Semana» no
  cabía) · filtro (`flex: 1 1 0`) · «Compactar» · engrane. Medido: 114 px de
  banda (eran ~195); el filtro mide 118 px a 390 y 88 a 360.

**Paso 2 · F1.1, F1.2, F1.3, F1.7, F1.9, F1.12**

- **F1.1 · barra única.** `CabeceraEscritorio` pasa a ser `.ag-controles`,
  ítem de la rejilla de la tarjeta en la fila de la barra nativa (60 px; todos
  los controles y los botones de FullCalendar a 36). El conteo es el primero
  que cede (base 0, elipsis) y **se quita entero cuando la fila de controles
  mide 720 px o menos** (consulta de contenedor): a 1024 px útiles no le
  quedaba sitio y se veía una tira con «…». Después cede el filtro de médico
  (de 240 a 140 px). Si aún no cabe —con la v2, el «Por confirmar» de E7— la
  fila ENVUELVE en vez de recortarse. **Dos filas** (nativa arriba, controles
  debajo) por debajo de 1280 px de ventana y en Día con panel (la tarjeta pierde
  314 px): no hay forma de que quepan a la vez la fecha larga de Día y los
  controles. Se fue «Gestión de citas clínicas» (decorativa). La leyenda va al
  pie en 28 px. El hueco entre ‹ › Hoy y la fecha bajó de 14 a 8 px.
  Segmentado: el hover pasa de `opacity` a fondo. Medido: la fila cabe sin
  envolver a 1280×720, 1440×900 y 1536×900.
- **F1.2 · barra lateral.** `aria-expanded`/`aria-controls` en «Plegar menú» (al
  pie de la barra, sólo en /agenda y desde `lg`). Plegada: logo de 40 px, sin
  nombre, sin selector de consultorio ni aviso de perfil, enlaces y pie sólo
  con icono y `aria-label`/`title`. Lo plegado se esconde por CSS (no por JS)
  para que el cajón móvil, que es la misma barra, nunca se vea afectado; pulsar
  un grupo plegado despliega la barra y abre el grupo (sólo desde `lg`). El
  `ResizeObserver` de `AgendaCliente` **sí hace falta**: comprobado que sin él
  FullCalendar conserva los anchos de columna explícitos y quedan ~250 px sin
  usar (la e2e lo mide).
- **F1.3 · densidad.** Botón «Densidad compacta» (icono `Rows4`, `aria-pressed`)
  junto a «Compactar», sólo en la rejilla de horas. Preferencia en
  `localStorage` `spinus.agenda.densidad`, leída con `useSyncExternalStore` (sin
  desajuste de hidratación); el mismo patrón que la barra plegada, copiado a
  propósito (dos usos). Al cambiar, `updateSize()` en el cuadro siguiente: las
  coordenadas de las franjas no siguen a una variable CSS. El tier sale a una
  función pura `tierDeTarjeta` (Vitest: 30/60/90 min a 24 px → tiny/compact/
  full). `expandRows` sigue estirando la franja si sobra alto: 24 px es un
  suelo, y con «Compactar» la jornada entera cabe sin desplazar.
- **F1.7.** Nombre corto con partículas saltadas («de la Cruz» → «C.»); sin
  apellidos, el segundo nombre hace de apellido; en una cita por ligar sale de
  `reserva_nombre`; un evento genérico conserva su título entero. Las dos
  consultas de contenedor tienen nombre (`ag-tarjeta`, `ag-controles`).
- **F1.12.** La lista de Semana abre en la cabecera de hoy, o en la del primer
  día posterior con citas (la lista sólo pinta días con filas). Queda pendiente
  hasta que haya filas que medir: se reintenta en `eventsSet`.

**Revisión del paso 2 (corregido en commit aparte):**

- **Grave, corregido:** la consulta de contenedor de `.ag-controles` crea
  contexto de apilamiento, y el desplegable de «Por confirmar» (E7) quedaba
  pintado por debajo de las tarjetas de la rejilla. La fila lleva ahora
  `position: relative; z-index: 10`. Comprobado en captura con la v2 encendida
  a 1280 y 1440. Queda dentro de una tarjeta con `overflow-clip`: con su
  `max-h-[60vh]` cabe en la tarjeta en cualquier ventana de más de ~215 px de
  alto, así que no se recorta en la práctica.
- **Media, aceptada:** el orden de tabulación es controles → ‹ › Hoy, al revés
  que el visual (izquierda → derecha). Es el mismo orden que antes de F1.1 (el
  encabezado iba encima de la tarjeta) y el que pide el spec §12 («toolbar →
  chips → navegación → filtro → calendario»). Para invertirlo habría que montar
  los controles después de `<FullCalendar>`, y entonces irían detrás de todas
  las citas de la rejilla.
- **Menor, añadido:** una e2e de la variante de dos filas (1180 px y Día con
  panel), comprobada con la mutación de quitar la variante.
- **Menor, aceptada:** el hover de «Agendar» (`brightness`) no tiene
  transición; `filter` no está entre lo que se anima (sólo `transform` y
  `opacity`), así que cambia de golpe. Lo mismo vale para «Guardar» e «Iniciar
  consulta» del modal (revisión del paso 3).

**Paso 3 · F1.17, F1.18 (modal)**

- **F1.17.** 560 px de ancho (decisión 17). Duraciones en `grid-cols-3
  md:grid-cols-6`: una fila desde `md` y dos de tres por debajo. Notas en 2
  filas. El pie ya era fijo (el cuerpo es el que desplaza); a 1280×720
  «Guardar» queda a la vista. Sin `transition-all` en duraciones y estados: el
  marcado cambia de golpe (CONTRASTE §8).
- **F1.18.** Los cinco estados de una cita en `grid-cols-5` (un evento, dos en
  `grid-cols-2`), con el punto ENCIMA de la etiqueta: a 390 px cada casilla
  mide ~65 px y «Confirmada» no cabe con el punto delante (11 px de letra en
  móvil; «No asistió» baja a dos líneas y las cinco casillas miden lo mismo).
  «Iniciar consulta» (y «ligar y consultar» de D7) a 40 px como «Guardar», con
  relleno tonal: fondo `--ag-modal-icon-bg` (el azul suave del icono del
  encabezado) y tinta `--ag-brand-legible`, sin borde. Los botones de icono del
  pie (eliminar, cancelar cita) también a 40.
- **e2e `agenda-f-simetria`:** filas sin huérfanos (6 / 3+3 / 5), centros de
  los estados (±1 px), alto de «Iniciar consulta» = «Guardar». Mutaciones
  comprobadas: volver a 480 px, `flex-wrap`, `rows=3`, `grid-cols-2`.

**Commits aparte pedidos por los otros dos agentes (sin interruptor de por medio):**

- **F2.7 (movimiento):** prop `saliendo` en `AppointmentModal`; velo con
  `ag-modal-velo` y panel con `ag-modal-panel` (en vez de `animate-modal-enter`,
  que es de toda la app), los dos con `data-estado="saliendo"`, y la raíz
  `inert` durante la salida. Hasta que llegue el CSS de la rama de movimiento,
  el modal de la cita entra sin animación; ninguna prueba dependía de ella.
- **Contrato de F3 (interacciones), modal:** `ModalState.create` gana `horaFin`
  y `medicoId` (el fin y el médico iniciales salen de ahí si vienen);
  `ModalState.edit` gana `enfocar: 'fecha'`, que pone `autoFocus` en «Fecha de
  inicio» (`useDialogoModal` no lo pisa: sólo enfoca el panel si el foco no está
  dentro). Ninguna ruta de hoy los pone: los probará la e2e del enchufe.
- **Contrato de F3, barra y banda:** ranuras `selectorFecha` (la primera de la
  fila de controles, pegada a la fecha de FullCalendar) y `buscar` (antes de «Por
  confirmar») en `CabeceraEscritorio` y en `BandaMovil` (en la banda,
  `selectorFecha` va junto a la fecha aunque el minicalendario no se use en el
  teléfono, decisión 21; `buscar`, delante del filtro). Prop `atajos`: con ella,
  `aria-keyshortcuts` (`teclasDeAccion`) en las vistas y en ‹ Hoy ›. En
  escritorio esos tres son botones de FullCalendar, que no admite atributos
  propios: se ponen sobre su DOM en un efecto (un cuadro después del montaje y
  otra vez al cambiar de vista). **Nadie pasa `atajos` todavía**: lo cablea la
  integración con el gancho de atajos, que sabe si el usuario los apagó.

**Paso 4 · F1.16 (tableta)**

- Vista `timeGridTresDias` (`type: 'timeGrid'`, `duration: { days: 3 }`, título
  «12 – 14 nov»), registrada en las TRES tablas de vistas para que siga
  existiendo si la ventana cruza el umbral con ella puesta. `VISTAS_FC_TABLETA`:
  el Mes del teléfono (seis semanas, puntos) y las rejillas de escritorio.
- `vistaEnElOtroFormato(vista, movil, tableta = false)`: el tercer parámetro
  es opcional y sólo cuenta en estrecho, así que ningún llamador de dos
  formatos cambia. `ANCHO_TABLETA = 768` vive en `vistasAgenda.ts`.
- El chip de la banda dice «3 días» cuando la vista es la de tres días.
- Sin panel de Día (sigue siendo de escritorio) y sin leyenda en la rejilla
  (como en el teléfono). «Compactar» sí está: pliega columnas y recorta horas
  igual que en Semana.
- Proyecto Playwright `tableta` (820×1180, táctil) que sólo corre
  `agenda-f-tableta.e2e.ts`: el resto de la suite no sabe de este tercer
  formato. El arrastre con pulsación larga se prueba con eventos táctiles por
  CDP (1,2 s de pulsación, `eventLongPressDelay` es 1 s) y espera el PUT.

**Revisión del paso 4 (corregido en commit aparte):**

- **Grave, corregido:** `periodoDeLaVista` no conocía la vista de tres días y la
  banda de vacío no salía nunca en la «Semana» de la tableta. Ahora dice «Sin
  citas en estos tres días» (no «esta semana», que no lo es).
- **Media, corregido:** el «Compactar» de la banda llevaba el rótulo del Mes
  escrito a mano; en el teléfono sólo salía en Mes, pero en la tableta sale
  también en la rejilla. Usa `etiquetaCompactar(vista)`, como el de escritorio.
- **Media, corregido:** la leyenda no salía en el Día de la tableta, que es la
  rejilla con píldoras (`timeGridDay`). Sale en `listDay` y en `timeGridDay`.
- **Menor, sin tocar (no es archivo de la superficie):** la precarga en ocioso
  de `useFuentesAgenda` (`VISTAS_PRECARGABLES`) no incluye la vista de tres
  días: en la tableta no se precarga el periodo vecino. Es rendimiento, no
  corrección; queda para quien lleve ese archivo.

**Paso 5 · F1.19 (orden y simetría)**

- **Escala.** Pasan a `--ag-*` los rellenos y huecos de la barra, la leyenda,
  los controles, la tarjeta (horizontales y huecos), la tarjeta de Google, el
  chip del Mes, el chip de la banda de todo el día y la fila de la lista de
  Día. Cambios de valor: 9→10 px de relleno horizontal de la tarjeta, 5→6 px de
  hueco en tarjeta, chips y píldora, 7→8 en el chip del Mes. **Quedan fuera, a
  propósito, los valores verticales de 1–5 px** (relleno vertical de tarjeta,
  chips y píldoras): de ellos cuelgan los suelos de tamaño de la tarjeta
  (`ALTO_MINIMO_*`) y no son espaciado de maquetación sino de tipografía.
  Informe no bloqueante (`e2e/resultados/F/informe-escala.ts`): 24 → 16
  declaraciones fuera de la escala; las que siguen son esos verticales, el mes
  del teléfono (micro) y tres de otros agentes (`.ag-banda-compacta` y
  `.ag-aviso`, de movimiento; `.ag-opcion`, de interacciones).
- **Radios.** El segmentado Cita/Evento del modal usa `calc(var(--ag-r-btn) +
  3px)` en la pista y `--ag-r-btn` en el botón, como el de la barra (era 12 y 9
  a mano); su hover pasa de `opacity` a fondo.
- **La hora del gutter, en su línea.** FullCalendar la centra en la franja, así
  que «10:00» quedaba a media franja bajo su línea. Ahora va arriba
  (`vertical-align: top`, `line-height: 1.2`, 2 px de aire): el texto empieza en
  su línea.
- **e2e `agenda-f-simetria`:** columnas de Semana iguales (± 1 px) y cada
  cabecera centrada sobre su columna (± 1); cada etiqueta de hora a ± 2 px de
  su línea (antes, a media franja); iconos de los botones sin texto centrados
  (± 1) en la barra y en la banda. Mutaciones comprobadas: ancho fijo en una
  columna, quitar el `vertical-align`, desplazar los iconos.
- **El conteo a 1440 px** sale recortado con «…» («23 citas · 4…»): es lo que
  cede ancho primero; a partir de 720 px de fila de controles se quita entero.
- **Revisión del paso 5, corregido antes del commit:** el segmentado del modal
  y los controles de la barra cambian fondo, borde y TINTA en micro (CONTRASTE
  §5 pide `color` en el chip de vista); la regla de la hora lleva tres clases
  para ganar a la de FullCalendar por especificidad y no por orden de carga; la
  e2e de la hora mide sólo las celdas con hora escrita.

**Presupuesto de A al cerrar la superficie** (`MEDICION_ETIQUETA=F-superficie`,
`playwright.medicion.config.ts`, medianas de 5; «base» es `e932f75` medido el
mismo día en la misma máquina, porque el A2 del diseño es de otro día):

| Medida | A2 | base | F (superficie) | F sin «Compactar» por omisión |
|---|---|---|---|---|
| Validaciones contra Auth | 2 | 2 | 2 | 2 |
| Apertura en frío (ms) | 255 | 256 | 274 | 256 |
| Red limitada (ms) | 712 | 717 | 743 | 728 |
| Semana siguiente (ms) | 61 | 62 | 72 | 64 |
| Semana anterior (ms) | 62 | 62 | 73 | 62 |
| Semana ya vista (ms) | 50 | 48 | 64 | 50 |
| Tras precarga (ms) | 48 | 47 | 55 | 48 |
| Volver del dashboard (ms) | 71 | 72 | 82 | 71 |
| Peticiones bloqueantes | 0 | 0 | 0 | 0 |
| JS transferido (bytes) | 496 143 | 534 938 | 537 730 | 537 697 |

- **⚠️ EMPEORA, Y LA CAUSA ESTÁ AISLADA: ES F1.5.** Con «Compactar» encendido
  por omisión, la ventana de horas sigue a las citas de CADA semana (y la
  semilla tiene una cirugía a las 07:00 sólo en la semana de hoy), así que al
  navegar `slotMinTime` cambia y FullCalendar vuelve a pintar la rejilla entera
  una segunda vez. Con F1.5 apagado (misma rama, una línea) todo vuelve a la
  base dentro del ruido. Las consultas de contenedor de la tarjeta (F1.7) pesan
  ~4 ms en navegación y se dejaron (medido sin ellas: 68/67/63/54/83).
  **Decisión pendiente para el coordinador o Angel:** F1.5 está aprobado
  (decisión 13) y el presupuesto dice «no empeorar»; no se pueden cumplir los
  dos con la arquitectura de hoy. Se deja F1.5 puesto. Si se prefiere el
  presupuesto, basta con que el `useState` de `compactar` en
  `useVentanaRejilla.ts` arranque en `false`. En una clínica real (sin citas
  fuera de horario cada semana) la ventana no cambia al navegar y el coste
  desaparece.
- **JS:** +2,8 KB sobre la base (con E ya integrado, la base ya pasa los +2 KB
  del diseño sobre A2). Lo de la superficie es la barra plegable, la densidad,
  la tableta, las ranuras de F3 y el import de `teclasDeAccion` (con él viaja
  la tabla de atajos aunque el interruptor esté apagado).

### Bloque F — decisiones tomadas en el movimiento

Ronda F2.3–F2.8 (agente «Movimiento», rama `feature/agenda-v2-fb`), en paralelo
con la superficie (A) y las interacciones v2 (C). Manda CONTRASTE §2 sobre la
tabla del plan, como ya decían las decisiones 1–7.

- **Entrada solo de la cita nueva (F2.4).** Se registra antes de `addEvent` en
  el alta optimista (`handleSave`) y en la rama de alta de
  `aplicarCambioRealtime` (con `remoto`). `eventsSet` solo poda y hace de
  candado (`podarMarcas`, con los ids del anterior en una ref de
  `AgendaCliente`). `clasesDelEvento` antepone `clasesDeMovimiento`; su
  parámetro se estrechó a `{ event: Pick<EventApi, 'id' | 'allDay' |
  'extendedProps'> }`, que `EventContentArg` cumple, para poder probarla sin
  calendario. Sin `eventDidMount`.
- **La rama de alta del canal incluye un UPDATE que trae a la vista una cita
  que no estaba pintada** (movida aquí desde otra semana, o asignada a este
  médico): también entra con anillo. Para quien mira, acaba de llegar.
- **Sustitución de la optimista por la real** en un solo `batchRendering`; la
  real no se marca. Si la respuesta llega antes de 180 ms, la entrada se corta.
- **Mes y banda de todo el día entran solo con opacidad** (`ag-entra-opacidad`),
  igual que las filas de lista: la regla de `ag-entra` excluye ahora
  `.fc-daygrid-event` y `.ag-ev-saliendo`.
- **El anillo va POR DENTRO de la caja** (`inset: 0`, `box-shadow: inset 0 0 0
  2px var(--ag-pulso)`), no a `-3px` por fuera como decía el diseño: tres de
  las cinco cajas (`.ag-tarjeta`, `.ag-mes`, `.ag-banda`) llevan
  `overflow: hidden` y lo recortarían. Cuelga de la caja y no del `<a>`, porque
  el `::after` del `<a>` es de FullCalendar (foco y selección). En lista rodea
  solo la celda del nombre. Su opacidad en reposo es 0: la clase puede quedarse
  puesta hasta el siguiente repintado y no se ve.
- **La clase de entrada puede seguir en el DOM pasados 600 ms** hasta que
  FullCalendar vuelva a pintar esa tarjeta: `eventClassNames` solo se evalúa al
  pintar. No tiene efecto (la animación ya corrió y el anillo está a 0); un
  montaje posterior ya no la lleva.
- **Salida (F2.5).** `handleDelete` y las dos bajas del canal (DELETE y «dejó de
  pertenecer a esta vista») usan `salirConAnimacion`; sin `Calendar`, se quitan
  de golpe como antes. Una marca huérfana (si `addEvent` devolviera `null`) se
  poda en el siguiente `eventsSet` o caduca.
- **FLIP (F2.6)** en el UPDATE ajeno sobre una cita pintada y en
  `restaurarPosicion`, con `api.el` como raíz. **Sin `data-cita-id` no anima
  nada** (aplica y degrada a lo de hoy). **ASUMIENDO, sin verificar en el
  navegador:** entre columnas no anima, porque FullCalendar crea otro `<a>` en
  la columna nueva y `@fullcalendar/react` pinta el contenido por portal un
  momento después, así que al volver de `aplicar()` no se encuentra la tarjeta.
  Dentro de la misma columna el `<a>` se conserva y sí se desliza.
- **Fundido de navegación (F2.3)** del `.fc-view-harness`, de 0.7 a 1 en micro,
  con WAAPI. Solo si es el mismo tipo de vista y cambió `view.currentStart`: el
  primer `datesSet` y el cambio de vista ya los anima `ag-vista`, y un `datesSet`
  sin cambio de periodo (p. ej. al plegar días) no se anima (CONTRASTE §2.8).
  **No se funde sobre una rejilla ya atenuada** (`ag-cargando` o
  `ag-desactualizada`): sería un destello sobre el 0.55. Dos navegaciones
  seguidas: la segunda corta el fundido de la primera (`id` de la animación).
  Borde aceptado: si la segunda llega antes de que la primera encienda la
  atenuación (150 ms), su fundido puede tapar hasta ~20 ms el arranque de la
  rampa a 0.55.
- **`dragRevertDuration={180}`**, literal (prop primitiva). El regreso lo anima
  FullCalendar con `top`/`left` en línea sobre el espejo, que es suyo (spec §8)
  y queda fuera de la regla de `getAnimations`. Para el movimiento reducido se
  añadió `.fc-event` suelto al bloque que ya existe: el espejo cuelga de `body`,
  fuera de `.fc`, y el `!important` gana a su estilo en línea; con `.01ms` su
  `transitionend` sigue llegando.
- **Avisos y banda compacta (F2.8).** Entrada CSS al montarse: opacidad y 6 px
  en lento. Salida con `ConSalida`, un componente local de `AvisosAgenda.tsx`
  (cinco usos en el archivo): la banda sigue montada `--ag-dur-base` ms con
  `data-estado="saliendo"`, `inert` (suelta el foco del botón que la apagó,
  cosa que `aria-hidden` no permite) y sin punteros, y **retiene el texto
  que enseñaba**, para que un «Sin citas esta semana» que se va no diga el
  periodo nuevo. Sin animar el alto: la rejilla salta una vez. **La banda que
  ya está al abrir la agenda entra con la vista**, no aparte: se aceptó como
  parte de «la vista entera» de la primera carga.
- **Modal (F2.7).** `.ag-modal-panel` y `.ag-modal-velo`, con su salida. El
  `ConfirmModal` pasa a esas clases (entrada sin salida; decisión 17). Los otros
  modales de la agenda (`HorarioModal`, `ModalInvitacionCita`) siguen con
  `animate-modal-enter`: no son archivos de este agente. **La salida del modal
  de la cita está escrita pero APAGADA** (`SALIDA_DEL_MODAL = false` en
  `AgendaCliente`): `modal` sigue siendo la única verdad y se cierra al
  instante; `modalSaliente` solo sostiene el pintado. Encenderla sin el cambio
  del modal lo dejaría montado 180 ms, sin animar y pulsable (un segundo
  «Guardar» crearía otra cita).
  **⚠️ Corregido en la integración de las correcciones (2026-11-12): esta nota
  es vieja.** La salida está **encendida**: `SALIDA_DEL_MODAL = true` en
  `AgendaCliente.tsx` desde la fusión `8988f45`, con los cinco pasos de abajo
  aplicados (`saliendo` en las props de `AppointmentModal`, `data-estado` en
  velo y panel, `inert={saliendo}` en la raíz y `saliendo={modal.mode ===
  'closed'}` en el JSX). Lo que sigue se queda como registro de cómo se hizo.

  **Lo que tiene que aplicar el agente de la superficie en
  `AppointmentModal.tsx`:**
  1. Prop nueva `saliendo?: boolean` en el tipo de las props del componente
     (declarado en línea en su firma).
  2. Velo (`<div className="absolute inset-0 backdrop-blur-sm" …>`): añadir la
     clase `ag-modal-velo` y `data-estado={saliendo ? 'saliendo' : undefined}`.
  3. Panel (el `role="dialog"`): cambiar `animate-modal-enter` por
     `ag-modal-panel` y añadir el mismo `data-estado`.
  4. Raíz del modal (el `fixed inset-0` que envuelve a los dos): `inert={saliendo}`,
     porque `pointer-events: none` no corta el teclado.
  5. Al integrarlo, en `AgendaCliente`: `SALIDA_DEL_MODAL = true` y
     `saliendo={modal.mode === 'closed'}` en el `<AppointmentModal>` (mientras
     sale, `modal` ya está cerrado y lo que se pinta es `modalPintado`).
- **e2e `agenda-f-movimiento`** (escrita, sin correr). Las clases viven 120–600
  ms, así que no se esperan con `toHaveClass`: un observador instalado con
  `addInitScript` (texto, no función, por el `__name`) anota cada `.fc-event`
  que las llega a llevar y cada `element.animate()`. El fundido se comprueba
  por ese registro (solo `opacity`, ≤ 240 ms). Con movimiento reducido se exige
  que no haya ninguna llamada a WAAPI.

### Bloque F — decisiones tomadas en las interacciones

Enchufe de las interacciones v2 (F3), worktree `-agenda-menores`, rama
`feature/agenda-v2-fc`. Todas detrás del interruptor `agendaV2`; con el
interruptor apagado cada gesto hace lo de hoy y no se descarga ningún chunk
nuevo (comprobado en el build: el código de las capas sale en un chunk que no
figura en el manifiesto de la página `/agenda`).

**Carga y contrato**

- **Un chunk, montado en ocioso.** `InteraccionesV2.tsx` (capas, atajos,
  deslizar) y `HerramientasV2.tsx` (botones de la barra, minicalendario del
  panel) se cargan con `next/dynamic` y se MONTAN sólo con v2 y tras
  `enOcioso` (patrón de A2.6: el montaje es la precarga). Mientras no llegan,
  `interaccionesRef.current` es `null` y el gesto abre el modal de siempre: un
  clic en los primeros milisegundos tras abrir puede abrir el modal en vez de
  la burbuja o la tarjeta. Se acepta (la opción que menos cambia); la raíz
  publica `data-interacciones-v2="listas"` y las e2e lo esperan.
- **`contratosV2.ts`, sólo tipos.** `ApiInteraccionesV2` (lo que `altaCitas` y
  la barra piden al chunk) y las ampliaciones OPCIONALES que pertenecen a
  archivos ajenos: `ModalState.create.horaFin`/`medicoId`,
  `ModalState.edit.enfocar` y `cambiarEstadoCita`. El enchufe ya las manda o
  las lee; funcionan en cuanto su dueño las aplique, sin tocar el enchufe.
- **`eventInteractive` NO se pasa, y el diseño decía `eventInteractive={agendaV2}`.**
  FullCalendar ya hace las citas enfocables y abribles con Enter cuando hay
  `eventClick` (`getSegAnchorAttrs`, `@fullcalendar/core/internal-common.js:4483-4500`:
  sin la opción, `Boolean(emitter.hasHandlers('eventClick'))`). Pasar
  `agendaV2` habría QUITADO el teclado a las citas con el interruptor apagado.
  La devolución del foco a la cita funciona sin la prop.
- **`unselectCancel=".ag-capa"` siempre**, no sólo con v2: es un primitivo y sin
  capas en pantalla no casa con nada.

**Burbuja (F3.1)**

- Va a la burbuja: la franja de la rejilla (clic o arrastre), la celda SUELTA
  del Mes y el hueco del panel de Día. Siguen al modal: la banda de todo el día,
  el arrastre por varios días del Mes, el botón «Agendar», la barra del
  teléfono y el enlace profundo.
- Desde una celda del Mes la burbuja abre con las horas en blanco (no se
  inventa una, como el modal); al escribir el inicio se propone el fin con la
  duración de por omisión, y mover el inicio conserva la duración.
- El clic dispara `dateClick` y `select`: la segunda llamada encuentra la misma
  burbuja (fecha y horas iguales) y no la vuelve a montar.
- Al guardar: aviso de fuera de horario SÓLO si se tocaron las horas (el de la
  apertura ya se preguntó en `abrirAlta`), después el de empalme contra lo
  pintado (B7c) y después `handleSave`, que ya maneja el 409, el bloque
  optimista y la invitación de Google. Decir que no a un aviso deja la burbuja
  abierta como estaba.
- Tocar dentro de OTRO diálogo modal (el aviso, su velo) no cierra la capa de
  debajo (hallazgo del revisor: el velo de `ConfirmModal` es hermano del
  diálogo, no su hijo).
- El hueco del panel se ancla al botón si tiene el foco y, si no (Safari no
  enfoca un botón al pulsarlo; hallazgo del revisor), al panel de Día entero.
- «Más opciones» manda `horaFin` y `medicoId` al modal (`AperturaAltaV2`);
  hasta que la superficie los aplique, el modal abre con la duración de por
  omisión y el médico de siempre.

**Tarjeta (F3.2)**

- `abrirCita` sigue siendo la única puerta: la rejilla, el panel del Mes del
  teléfono y el buscador pasan por ella. Google sigue sin abrir nada.
- «Iniciar consulta» con las mismas condiciones del modal (`puedeIniciarConsulta`
  en `accionesTarjeta.ts`, copia de `showIniciarConsulta`/`showLigarYConsultar`):
  médico, su cita, su consultorio en su lista, con paciente o por ligar. Con
  paciente: `cambiarActivo` y la nota con `?cita=`; por ligar: el modal (D7).
- «Confirmar» sólo sale cuando `crearGuardadoCitas` devuelva
  `cambiarEstadoCita`; mientras tanto la tarjeta no la ofrece (no se inventa una
  segunda escritura de la cita fuera de `guardadoCitas.ts`).
- «Cancelar» y «Eliminar» preguntan con `ConfirmModal`; «Eliminar» comprueba
  otra vez que sea un evento sin paciente antes de `handleDelete` (dos puertas
  al mismo daño; el servidor contesta 409 igual).
- Cada acción cierra la tarjeta sin salida animada: lo que abre la tapa, y el
  foco vuelve a la cita antes de que lo tome el modal o el aviso.
- La hora que se lee es la VIVA del evento (tras un arrastre sin respuesta
  todavía); al modal le llega la fila del evento, como hoy.
- El WhatsApp de E7 (`BotonWhatsAppCita`) va en el hueco `extra` de la tarjeta,
  con las condiciones del modal (cita agendada o confirmada, con paciente o por
  ligar). Montarlo no emite nada. No hizo falta tocar ningún archivo ajeno.
- Abierta desde el buscador, sin ancla: centrada en escritorio, hoja en el
  teléfono.

**Minicalendario (F3.3)**

- En el panel de Día va como tarjeta propia («Calendario del mes»), la última,
  en el hueco que la auditoría vio vacío (punto 4). Ranura `miniMes` en
  `PanelDia`: sin ella el panel es el de siempre.
- El desplegable de la barra es un diálogo modal (APG «Date Picker Dialog»):
  el foco entra en el día activo, Escape cierra y el foco vuelve al botón. Al
  elegir, `gotoDate`: la vista se conserva.
- El rango visible viaja como cadena `'desde/hasta'` (`currentStart`/`currentEnd`,
  no el `activeStart` con los días del mes anterior), escrita siempre en
  `datesSet` porque el interruptor se resuelve después del primer `datesSet`.

**Buscador (F3.6)**

- Botón con lupa en la barra (y `/`, que pulsa ese botón: así el foco vuelve a
  él al cerrar). Elegir una cita: si el filtro de médico la esconde, se cambia
  al suyo; se va a su día en Día; y en cuanto la cita está pintada (hasta 6 s,
  escuchando `eventsSet`) se abre su tarjeta por `abrirCita`. Si no llega, un
  aviso.
- **RLS comprobada, no supuesta.** En la base local (2026-11-12), como el médico
  invitado: de 86 citas sobre cinco pacientes compartidos, 85 eran del otro
  médico y ninguna le fue visible; tampoco las por ligar de otro médico. La
  e2e del invitado lo vuelve a comprobar en la respuesta de PostgREST.
- En el teléfono no hay lupa todavía: la banda es de la superficie (pedido).

**Atajos (F3.5)**

- Viven en el chunk, así que con el interruptor apagado no hay ni oyente.
- La ayuda se abre con `?` y TAMBIÉN con un botón «Atajos de teclado» en la
  barra: si alguien apaga los atajos, la única forma de volver a encenderlos no
  puede ser un atajo (WCAG 2.1.4).
- `aria-keyshortcuts` en los botones del enchufe (lupa `/`, ayuda `?`). Los de
  Hoy, ‹ › y las vistas son de FullCalendar o de la superficie: pedido.

**Deslizar (F3.7)**

- Sólo en `listDay`/`listWeek` del teléfono; el oyente cuelga de la raíz
  (`raizRef`, la única prop nueva en un nodo de `AgendaCliente`).

**Copias deliberadas.** `colocar`, `hayOtroDialogoModal` y
`useCerrarAlTocarFuera` existen en tres archivos (`BurbujaAlta`,
`TarjetaLectura`, `HerramientasV2`). Con tres usos el protocolo 4 permite
proponer el gancho compartido, pero crearlo pide el visto bueno de Angel.

**Hallazgos de los revisores aceptados sin cambio**

- En Mes, el minicalendario marca el MES natural (`currentStart`/`currentEnd`)
  y no las seis semanas que pinta la rejilla (`rangosDeLaVista().completo`): se
  marca el periodo elegido, no los días de relleno. Si se prefiere lo pintado,
  es cambiar esa línea por `rangos.completo`.
- `setRangoVisible` corre también con el interruptor apagado: va en el mismo
  manejador que `setTituloVista`, así que React lo agrupa y no añade render.
- Con un teclado físico en el teléfono, `/` no abre nada (la lupa sólo está en
  la barra de escritorio) hasta que la banda tenga su ranura.
- Las e2e se escribieron por interacción pero se corren al final: la de `/` en
  `agenda-f-buscador` necesita también el commit de atajos.

**Lo que queda en archivos ajenos** (el enchufe ya lo manda o lo lee; ver
`contratosV2.ts`):

- Superficie, `AppointmentModal.tsx`: `ModalState.create.horaFin` (y
  `medicoId`), que `valoresInicialesDelModal` use en vez de `DEFAULT_DURATION`;
  `ModalState.edit.enfocar: 'fecha'`, que lleve el foco al campo Fecha.
- Superficie, `CabeceraEscritorio.tsx` y la banda del teléfono: ranuras
  `selectorFecha` (junto a la fecha) y `buscar`, para sacar `HerramientasV2`
  del hueco `porConfirmar`; `aria-keyshortcuts` en Hoy (`T`), ‹ › (`K P`/`J N`)
  y las vistas (`D`/`S`/`M`), con `teclasDeAccion`.
- Movimiento, `guardadoCitas.ts`: `cambiarEstadoCita(id, estado)` en el retorno
  de `crearGuardadoCitas`, con el PUT, la firma y la auditoría de
  `handleCancelar`. En cuanto exista, la tarjeta ofrece «Confirmar».
- Dos e2e de `agenda-f-tarjeta` (Confirmar, Reagendar con foco) quedan en rojo
  hasta esas dos piezas.

### Bloque F — decisiones tomadas en la integración y el cierre

Agente de integración, sobre la fusión `0729e24` (superficie + movimiento +
interacciones). Commits `2552a2f` (paso 1) y `a240295` (paso 2).

**Herramientas v2 en sus ranuras (paso 1)**

- `HerramientasV2` se parte en `SelectorFechaV2` (ranura `selectorFecha`) y
  `BuscarV2` (ranura `buscar`: la lupa y, a su lado, «Atajos de teclado»), cada
  uno con `next/dynamic` y montado sólo con `agendaV2 && montarV2`.
- **Teléfono: sólo la lupa, en `buscar` (delante del filtro), a 44 px.** El
  diseño pide la lupa en la banda y el minicalendario no (decisión 21). El botón
  de la ayuda NO va en la banda: a 360 px el filtro se quedaba sin ancho. Coste
  aceptado de la lupa: con v2, el filtro de médico baja a ~68 px a 390 y ~38 a
  360 (se lee «Dr.»; el desplegable nativo enseña el nombre entero). Con un
  teclado físico en el teléfono, `?` sigue abriendo la ayuda.
- `atajos` (el `aria-keyshortcuts` de Hoy, ‹ ›, las vistas, la lupa y la ayuda)
  es verdadero sólo con v2, el chunk montado y los atajos sin apagar: el chunk
  lo publica con un callback (`alCambiarAtajos`), el mismo patrón que
  `alCambiarListas`; sin abstracción nueva.

**Defectos de la fusión hallados al correr juntas, por primera vez, las e2e de F**

- **Código · la tarjeta no devolvía el foco a la cita** con el ratón:
  FullCalendar cancela el `mousedown` (para poder arrastrar) y el clic no
  enfoca la cita, así que `useDialogoModal` devolvía el foco a lo que lo tenía
  (p. ej. «›»). Ahora `handleEventClick` enfoca la cita antes de abrir la
  tarjeta, sólo con v2. Efecto visible aceptado: la capa de foco de
  FullCalendar (`.fc-event:focus`, negro al 25 %) se ve sobre la cita mientras
  tiene el foco, también tras un clic; es el indicador de foco y está donde
  está el foco (WCAG 2.4.7). **En las listas del teléfono no hay a qué volver,
  y no es de F:** con `eventContent` propio FullCalendar no monta el `<a>` de la
  fila y el `<tr>` no admite foco; hacerlas enfocables cambiaría el orden de
  tabulación de las listas y queda fuera.
- **Código · el modal de la cita animaba el anillo de foco**: sus campos y
  botones llevaban `transition-all` (150 ms, fuera de escala, con `box-shadow` y
  `outline`). Pasan a `.ag-transicion-color` (fondo, borde y tinta en micro).
  Se pierde el fundido del `disabled:opacity-50` del selector de consultorio
  (ahora cambia de golpe, CONTRASTE §8).
- **Prueba · la regla de movimiento de las e2e** contaba como incumplimiento
  el hover de color en micro (que el diseño PIDE, CONTRASTE §5) y animaciones
  que no son de la agenda (el aviso de perfil de la barra lateral, los toasts).
  Ahora admite `background-color`, `color` y `border-*-color`, mira sólo lo que
  cuelga de la agenda o de sus portales (`.agenda-raiz`, `.ag-capa`, `.ag-hoja`,
  `.ag-modal-*`, `.fc-event`) y trata `spin` (el giro de «guardando») como
  `ag-barra-carga`. Siguen fuera `width`/`height`/`top`/`left`/`box-shadow`/
  `outline-*` y el tope de 240 ms. **Pendiente, no tocado:** `HorarioModal` y
  `ModalInvitacionCita` siguen con `animate-modal-enter` (de toda la app) y con
  `transition-all` + `hover:brightness-95`; no tienen clase propia y la regla no
  los mira (ninguna e2e de movimiento los abre).
- **Prueba · arrastre a mitad de un FLIP**: tras «Cancelar» un aviso,
  `restaurarPosicion` desliza la cita 180 ms (F2.6) y la ayuda medía su caja a
  mitad, así que el ratón caía en una franja vacía y abría la burbuja. Las
  ayudas de arrastre esperan a que la cita deje de animarse (sin esperar
  bucles infinitos).
- **Prueba · `agenda-f-tarjeta`**: sus altas chocaban con el empalme de B7
  (con v2 el servidor contesta 409) y se acumulaban en el mismo viernes, así
  que `.first()` agarraba la cita de otra prueba. Aceptan el empalme (el patrón
  de `agenda-empalme`) y se borran al acabar cada prueba.
- **Prueba · la barra en dos filas** (`agenda-f-pulido`) medía en el cuadro en
  que la fila se recoloca (0.6 px); espera a que la maquetación se asiente.

**F1.5 («Compactar» abierto por omisión) — DECISIÓN PENDIENTE DE ANGEL**

- **Causa raíz del coste:** con «Compactar» encendido, la ventana de horas y
  los días plegados se recalculaban con las citas de CADA semana; una semana con
  una cita a las 07:00 y la siguiente sin ella cambiaban `slotMinTime` /
  `hiddenDays` al navegar, y FullCalendar reconstruía el perfil de fechas y
  repintaba la rejilla entera.
- **Arreglo, que se queda:** una «sesión de Compactar» (misma vista, mismo
  horario, sin apagarlo) en la que la ventana sólo se une y los días plegados
  sólo se intersecan. No esconde nunca una cita pintada (revisado). Lo que se
  pierde: dentro de la sesión la rejilla no vuelve a encoger al ir a una semana
  con menos; vuelve a ajustarse al apagar y encender. Navegación de vuelta a la
  base (semana siguiente 67 → 61, ya vista 62 → 52 ms).
- **La apertura en frío seguía por encima** con F1.5 encendido (276 contra 256
  ms; volver del dashboard 80 contra 72), también con el estado inicial ya
  compacto (se probó y se retiró: no mejoró la medida). **Se deja F1.5 apagado**
  tras `COMPACTAR_AL_ABRIR = false` (`src/lib/agenda/ventanaRejilla.ts`): la
  agenda abre como antes de F1.5. Encenderlo es cambiar esa constante; las e2e
  la leen y se adaptan solas. Si Angel prefiere F1.5 al presupuesto, cuesta
  ~20 ms al abrir con la semilla (que tiene citas fuera de horario cada
  semana); en una clínica sin ellas el coste debería ser menor (sin medir).

**Medición y entrega (paso 5)**

- `capturar.ts` (fuera de git) se adaptó al «después»: «Compactar» se pone
  apagado para comparar igual con igual salvo en `semana-compactar`; la pestaña
  de Semana de la tableta se llama «3 días»; con v2 la «modal-edicion» se toma
  entrando por «Editar» de la tarjeta; las guardas con v2 aceptan el aviso de
  empalme; las capas v2 (burbuja, burbuja con arrastre, tarjeta, por ligar,
  minicalendario, buscador, ayuda, hoja del teléfono, tres días) y los vídeos
  v2 (alta por la burbuja, tiempo real, deslizar). `comparar.ts` (nuevo, fuera
  de git) arma `comparativa/index.html`. **No se hizo el PNG compuesto por
  pareja** del diseño (§5.3): la página ya pone las tres columnas juntas.
- La batería A1-bis (`e2e/playwright.a1bis.config.ts`, build instrumentado)
  **no se corrió** en el cierre: las props nuevas de `<FullCalendar>` las metió
  F1/F2/F3 (primitivos), y el cierre no añadió ninguna.

### Menores

- **`ProximasCitas`:** tope de refresco de 2 minutos al volver a la pestaña,
  el mismo criterio que la agenda.
- **Líneas muertas de `QuickPatientModal`** en `AgendaCliente.tsx`: se borran
  tras comprobar con grep que nada las usa, en un commit propio.
- **Propuesta para `supabase/AUDITORIA-MIGRACIONES.md`** (no se modifica el
  archivo; queda aquí para que Angel decida). Dimensión 19: *las protecciones
  por disparador que deciden con `current_user` no son un invariante: una
  función `SECURITY DEFINER` propiedad de `postgres`/`supabase_admin` que
  escriba en la tabla protegida las evade (y evade la RLS, porque esos roles
  tienen `BYPASSRLS`). Antes de confiar en una, listar desde el catálogo las
  funciones `SECURITY DEFINER` de esos dueños que escriben en la tabla.* Y una
  nota sobre falsos positivos del Security Advisor de Supabase con funciones
  `RETURNS trigger` (no son invocables por RPC).
- **Hallazgos de las auditorías, no corregidos por ser patrones heredados:**
  `service_role` conserva DELETE/TRUNCATE en las tablas nuevas como en
  `clinicas`/`consultorios`; FKs existentes que incumplen la regla
  (`appointments.paciente_id SET NULL`, `consultas.appointment_id SET NULL`,
  `appointments.clinica_id CASCADE`) se reportan y no se cambian.

### Cierre del proyecto — auditoría del conjunto y decisiones (2026-11-12)

Detalle en `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`. Resumen:

- **El conjunto es APTO para producción, con notas.** 16 migraciones; 15 APTA
  como estaban y D11 APTA tras los cambios de su auditoría formal, que se hizo
  en el cierre. Ningún objeto de `main` cambia (huella md5 de todo `public`
  antes y después). Ninguna función nueva da EXECUTE a PUBLIC. No hay
  CASCADE nuevo ni FK nueva a `pacientes`.
- **Hallazgos del conjunto y qué se hizo** (coordinador y revisor
  independiente):
  - **H1, FK RESTRICT hacia `appointments`.** Una cita con historial de agenda
    (enlace, correo, incidencia, reagendado) ya no se borra, y una clínica con
    filas de agenda tampoco. Es lo buscado, y el código ya lo traduce a 409.
    Sin cambio. **(Corregido después: las demás citas con paciente o por
    ligar sí se podían borrar por PostgREST; lo cierra
    `20261117120000_agenda_seg_borrado_cita.sql`, ver «Correcciones de
    seguridad en la base tras la revisión independiente».)**
  - **H2, choque al fusionar con limites-ajustables.** `p1` caso 3 se pone en
    rojo. Lo actualiza Angel al fusionar.
  - **H3, ruido en el log.** Sin tablas, cada petición deja un `warn`. Orden
    recomendado: migraciones antes que código.
  - **H4, suspendida en E9.** E9 no cierra la suspendida por sí misma; la
    cierra la puerta del sondeo. Sin cambio.
  - **H5, techo del candado.** `candado_reagendados` > 100. Ya anotado en E6.
  - **H6, `spinus.via` puesto hasta el fin de la transacción.** Inocuo con una
    RPC por transacción.
  - **H7, entorno local.** El reset cambia las imágenes de Docker y quita las
    `20261014*`.
  - **H8, semilla.** No toleraba la falta de `agenda_ajustes`; arreglada.
- **Decisiones tomadas sin preguntar:**
  - **CLI 2.117.0** (la de fnm), no la 2.95.4 fijada: es la única que lee
    `config.toml` (`CLAUDE.md`, nota del pin).
  - **D11 corregida en su propio archivo**, no con una migración posterior: no
    estaba en producción y es lo que se hizo con E1. Anotado en la cabecera.
  - **Lo no aplicado de D11 queda para Angel:** el par que reaparece pasados 30
    días y el `OR` de la consulta.
  - **La base local queda con las 21 de esta rama más la semilla**, sin las
    `20261014*` de `feature/limites-ajustables`. Es lo que pidió el encargo; la
    guía explica cómo volver al estado combinado.
  - **Tolerancia a producción, probada con un reset local** que aplicó solo las
    5 de `main`. No se usó una base temporal aparte.
  - **`AUDITORIA-MIGRACIONES.md` no se tocó.** Sus §6 piden añadir
    dimensiones; las propuestas van aquí abajo.
- **Propuestas de dimensión nueva** (se suman a las de «Menores» y a las de las
  auditorías de B5, C1, C2, D1, D2, D3, E4 y E9):
  - **Desempates canónicos.** Que el representante elegido cumpla los filtros
    de su papel.
  - **Fechas del nombre y de la cabecera.** Que no sean futuras.
  - **Efecto agregado de las FK RESTRICT** hacia una tabla con policy de
    DELETE.
  - **Pruebas que fijan listas textuales del catálogo.** Correr las pruebas de
    las dos ramas sobre la base combinada.

### Correcciones de seguridad tras la revisión independiente (decisiones de Angel)

Rama `feature/agenda-v2-seg1` (worktree `~/proyectos/app_ortointegra-agenda-b56`).
Otro agente lleva en `feature/agenda-v2-seg2` el resto de la lista (borrado de
citas, columnas `reserva_*`, emisión de enlaces). Lo que pidió Angel, literal,
de lo que toca aquí:

> «1. El enlace de reserva no debe revelar nada sobre un teléfono. Hoy el correo
> se verifica con código y el teléfono no, y la respuesta cambia según el
> teléfono (409 ya_tiene_cita, 403 bloqueado): quien tenga el enlace puede
> averiguar si un número tiene cita o historial con ese médico. La respuesta y
> su tiempo no deben distinguir por teléfono. Solo el correo verificado puede
> recibir un mensaje específico.
> 2. Nadie debe poder perjudicar a un tercero usando su teléfono. Hoy se puede
> reservar con el teléfono de otra persona, dejarla con "ya tiene cita" y
> cargarle cancelaciones. Las decisiones automáticas del candado (cita activa,
> cancelaciones, bloqueo automático) se basan en el correo verificado. El
> teléfono queda como dato visible para la clínica y para el bloqueo MANUAL,
> pero no bloquea solo. Anota en 6-bis que esto debilita el candado frente a
> quien cambie de correo, y que es decisión mía.
> 5. Eventos de todo el día. Un evento de todo el día del médico (vacaciones,
> congreso) SÍ debe bloquear esos días en el enlace de reserva. Dentro de la
> agenda no cambia nada: ahí el empalme solo alerta.
> 6. Enlaces de un solo uso. Se siguen saltando los límites automáticos, pero
> NO el bloqueo manual: a un contacto que la clínica bloqueó a mano no le sirve
> ningún enlace.
> 7. Comprueba y, si aplica, corrige: […] que el nombre que escribe quien
> reserva no pueda meter texto engañoso en el título del evento de Google
> (límite de longitud razonable y sin URLs).
> 8. Menores, solo si son baratos; si no, a DEUDA_TECNICA.md: poner el límite
> de peticiones ANTES de la consulta a la base en las rutas públicas, y un tope
> por clínica a las sincronizaciones con Google que dispara el tráfico
> público.»

**Migración** `20261117130000_agenda_seg1_candado_correo.sql` (sólo `CREATE OR
REPLACE` de `reserva_contacto_estado`, `reserva_ocupacion` y
`reservar_por_enlace`, con el pre-vuelo por md5 de D4; ninguna tabla, dato ni
policy). Prueba: `supabase/pruebas-sql/seg1_candado_correo.sql`.

**1 · El enlace no revela nada de un teléfono.**
- **Lo que había:** en el enlace fijo, con SU PROPIO correo verificado,
  cualquiera escribía el teléfono de otro y leía `ya_tiene_cita` (409) o
  `autoservicio_cerrado` (403). Y aun SIN ficha, la RPC leía el estado del
  contacto (por teléfono) antes de mirar la verificación: el trabajo variaba
  con el teléfono (medido: una fila más de `reserva_contactos` para un número
  bloqueado a mano). En el único, el candado no se miraba, pero el estado sí.
  `/codigo`, `/verificar` y `/turnos` no reciben teléfono; la gestión de E
  (confirmar, cancelar, reagendar) no mira el candado salvo el reagendar, que
  pasa por `reservar_por_enlace`.
- **Cómo quedó:** en el fijo la ficha del correo se comprueba ANTES de leer
  nada de la persona; lo automático pasa a decidir por el correo (punto 2).
  Se igualó el TRABAJO, no se añadió relleno de tiempo: sin ficha, los tres
  teléfonos de la prueba (con historial, bloqueado a mano, limpio) dan la
  misma respuesta y los mismos contadores de `pg_stat_xact_user_tables` (ni se
  leen incidencias ni contactos). Con el correo verificado, el teléfono ya no
  cambia nada de lo automático.
- **Mensaje específico:** la opción que menos cambia: los mismos mensajes de
  siempre en la respuesta (no se añadió un canal por correo), que ahora sólo
  pueden depender del correo verificado de esa sesión (`ya_tiene_cita` y el
  bloqueo automático sólo existen en el fijo, después de la ficha). Ningún
  texto visible cambió.
- **⚠️ La única excepción, inevitable, para que decida Angel:** el bloqueo
  MANUAL por teléfono corta (puntos 2 y 6 lo piden), y cualquier rechazo que
  se base en un dato no verificado lo ve quien lo manda. Quien tenga el enlace
  puede saber si la clínica bloqueó A MANO un número con ese médico (sale el
  mismo 403 «Para agendar, comunícate con el consultorio» que cualquier
  bloqueo; acotado a 6 por IP y 4 por dispositivo por hora, y en el fijo con
  un correo verificado propio). Ya no se puede saber si tiene cita ni
  historial. **Alternativa:** que el bloqueo manual también mire sólo el
  correo (el teléfono no decidiría nada; un contacto bloqueado entraría con
  otro correo). En el único, un bloqueo manual por correo se dice a quien usa
  el enlace sin que ese correo esté verificado; el único lo emite la clínica a
  una persona, y se acepta. Anotado en `DEUDA_TECNICA.md` AG-DT-28.

**2 · Nadie perjudica a un tercero con su teléfono.**
- `reserva_contacto_estado`: las incidencias (cancelaciones y `no_show`)
  cuentan SÓLO por `correo_hmac`, y el desbloqueo que las descuenta es el del
  correo (`reserva_contacto_marcar` desbloquea las dos claves, así que en la
  práctica es el mismo). `manual` sigue mirando teléfono y correo. «1 activa»
  sólo por `reserva_correo_hmac`. `tel_hmac` se sigue guardando en citas e
  incidencias (COMMENT de `reserva_incidencias`) y el teléfono se sigue viendo
  en la cita.
- **Decisión sin regla previa:** lo que ve la clínica (la instantánea
  «Por ligar · N», el historial EN VIVO del modal y la lista de bloqueados)
  también cuenta por correo: lee la misma función, y contar ahí por teléfono
  dejaría a un tercero manchar el historial de otro y empujar a la clínica a
  un bloqueo manual.
- **Esto debilita el candado frente a quien cambie de correo; decisión de
  Angel.** Quien cancela tres veces y vuelve con otro correo (y el mismo
  teléfono) reserva otra vez; sólo lo para el bloqueo manual.
- Pruebas que cambiaron con la decisión: `d2_candado_reserva.sql` caso 4
  (coincidir sólo por teléfono ya no bloquea), `d3_reservar_por_enlace.sql`
  caso 5 (el único con bloqueo manual), y la e2e de D10
  `reserva-candado.e2e.ts` «coincidir sólo por el teléfono» (ahora ya NO
  bloquea; por el correo, sí).

**5 · Todo el día ocupa en el enlace.**
- `reserva_ocupacion` y el empalme de `reservar_por_enlace` ya no excluyen
  `all_day`. P3 sigue: `cancelled` y `no_show` no ocupan. Las puntas de una
  fila de todo el día son las medianoches de la zona de SU consultorio
  (`appointments_all_day_medianoche_check`), así que tapan esos días enteros;
  `turnosReserva.ts` no cambia (ya recortaba al día). Vale igual para lo
  importado de Google.
- **Resto conocido:** con consultorios del médico en zonas distintas, los
  bordes del día son los de la zona del evento, no los del consultorio que se
  reserva (una hora o dos al principio o al final del día). La agenda interna
  no cambia (`empalmesServidor.ts` sigue con `all_day = false`).
- **Sin cambiar** (la opción que menos cambia): el aviso de empalmes de D11
  (`reserva_empalmes_registrar`) sigue sin contar un evento de todo el día:
  unas vacaciones puestas en Google encima de una reserva ya hecha no avisan a
  la clínica. `DEUDA_TECNICA.md` AG-DT-27.
- `d3_reservar_por_enlace.sql` caso 6 pasaba con «todo el día no ocupa»: ahora
  espera `ocupado`, y el evento se movió a un día lejos de los demás turnos
  (en el día de antes, según la hora a la que corriera la prueba, habría
  tapado otros casos).

**6 · El único respeta el bloqueo manual.** `bloqueado` = manual (teléfono o
correo; en los dos enlaces) o automático por correo (sólo en el fijo). El
único se sigue saltando lo automático y «1 activa» (§2).

**7b · El nombre en el título de Google.** `ReservarSchema.nombre`
(`esquemasReserva.ts`): 80 caracteres como máximo (antes 120: un nombre con
dos apellidos rara vez pasa de 60, y 120 daba sitio a una frase), sin
caracteres de control, de formato (`\p{Cf}`: RTL override, ancho cero) ni
separadores de línea, y sin URLs ni dominios (`://`, `www.` o letra/dígito +
punto + dos letras seguidas). El mismo 400 `solicitud_invalida`. La casilla de
la página baja a `maxLength={80}`. «Ma.Guadalupe» (sin espacio) se rechaza: se
acepta. **No** se rechazan dígitos: «llame al 55…» cabe en 80 caracteres;
rechazarlos es una línea si Angel lo quiere. S1 no cambia: la descripción del
evento de una reserva no lleva observaciones. La base no repite la regla
(`reservar_por_enlace` sólo mira ≤ 120; sólo la llama `service_role`).

**8 · Menores (los dos, baratos):**
- **Límite antes de la base.** `codigoAbrible()` (`puertaReserva.ts`: secreto,
  forma del código y aviso publicable, sin base) → límites de red (IP y
  dispositivo) → `reserva_contexto`. Los que necesitan el enlace o el correo
  (tope de 30 al día del fijo, 3 por correo y hora del código) van después de
  abrirlo, para que un código inventado no deje una fila por cada correo. Así
  en `/api/reservar/[codigo]`, `…/turnos`, `…/codigo` y `…/verificar`, y en
  `/api/confirmar/[codigo]` (IP antes de `cita_confirmacion_contexto`; el
  límite por enlace después). **Cambia una decisión de E3**, que ponía el
  contexto antes de los límites para que un código inventado no dejara filas:
  ahora deja, a lo sumo, la de su IP (una por IP, no una por código). Los
  sujetos de una misma fase siguen contando en paralelo.
- **Sin hacer** (contradice E3, «ni límites por GET»): las PÁGINAS
  `/reservar/[codigo]` y `/confirmar/[codigo]` siguen leyendo el contexto sin
  límite. `DEUDA_TECNICA.md` AG-DT-26.
- **Tope por clínica de las pasadas con Google del POST público**
  (`sincronizarReserva.ts`, `LIMITES.sincronizar`: 60 cada 10 min por clínica,
  llave `reserva:sincronizar:clinica:<sha256>`): se pregunta UNA vez por
  petición (la espera del candado no lo vuelve a contar) y sólo si la clínica
  tiene Google. Pasado, no se llama a Google y decide la ventana de 30 min de
  D11, como cuando Google falla. El GET no lo necesita: lo acota ya el mínimo
  de 60 s de `gcal_sync_tomar`. Un fallo al consultar el tope cuenta como sin
  cupo (cerrado) y también decide la ventana. Los cuatro casos de D11 siguen
  en verde (`reserva-google.e2e.ts`).

### Correcciones de seguridad en la base tras la revisión independiente (decisiones de Angel)

Pedido de Angel (2026-11-12), puntos 3, 4 y 7a de su lista; rama
`feature/agenda-v2-seg2` (worktree `app_ortointegra-agenda-menores`). Tres
migraciones (`20261117120000`, `…121000`, `…122000`), sólo en la base local.
Ninguna toca una policy existente, las puertas de suscripción ni una regla de
`CLAUDE.md`.

- **3 · Borrado directo de una cita con paciente** (`20261117120000`).
  Disparador `BEFORE DELETE` `trg_appointments_proteger_borrado` →
  `cita_proteger_borrado()` (INVOKER, `search_path=''`). Lee sólo `OLD` y la
  fila de `agenda_ajustes` de `OLD.clinica_id`; nunca `appointments` (sin
  autorreferencia). Con v2 encendida y la cita con paciente o por ligar
  (`reserva_canal` no nulo) → 42501. Con v2 apagada, sin fila de ajustes o una
  cita sin paciente ni reserva: como antes.
  - **Aplica también a `service_role`** (lo que pedía la orientación): ningún
    camino legítimo del servidor borra una cita así con v2 encendida. La única
    baja de la app es `DELETE /api/appointments/[id]` con la sesión, que ya da
    409 antes; Google no borra filas (cancela, C-e). **No aplica a `postgres`
    ni `supabase_admin`** (el patrón de B1/D1): editor SQL, ayudantes de las
    e2e, y las acciones referenciales, que Postgres ejecuta como dueño de la
    tabla (comprobado: un `CASCADE` desde `clinicas` lanzado por
    `service_role` llega al disparador con `current_user = postgres`).
  - **La semilla** borraba las citas con `service_role` antes que
    `agenda_ajustes`; con v2 encendida en una clínica sembrada (la guía, §5)
    ya no podría. Ahora borra `agenda_ajustes` primero
    (`scripts/agenda-semilla.ts`).
  - **La API** traduce también el 42501 del borrado a su 409 «cancélala»: el
    caso en que la lectura del interruptor en la ruta falla (cuenta como
    apagado) y la base sí lo ve encendido.
  - **H1 de la auditoría del conjunto, corregido en el documento**: «sin
    perder datos» sólo era cierto para las citas con historial de agenda.
- **4 · Columnas `reserva_*`** (`20261117121000`). Disparador `BEFORE INSERT
  OR UPDATE` `trg_appointments_proteger_reserva` → `cita_proteger_reserva()`.
  Para todo rol que no sea `service_role`, `postgres` o `supabase_admin`: al
  crear, toda `reserva_*` NULL (y `reserva_reagendados` 0, su DEFAULT); al
  editar, ninguna cambia, salvo poner `reserva_telefono`/`reserva_correo` en
  NULL (supresión a petición del titular; los `*_hmac` se quedan para el
  candado, como ya decía el COMMENT de D1). Las 11 columnas, listadas del
  catálogo con todo el conjunto aplicado: `reserva_aceptado_en`,
  `_aviso_version`, `_canal`, `_correo`, `_correo_hmac`, `_enlace_id`,
  `_historial_previo`, `_nombre`, `_reagendados`, `_tel_hmac`, `_telefono`.
  - **Disparador (a) y no privilegios por columna (b)**: (b) obliga a listar
    las ~40 columnas permitidas y a acordarse de cada columna futura (una
    olvidada rompe la app), toca los privilegios de una tabla con datos
    clínicos que lee `spinus-consola`, y no puede decir «sólo hacia NULL».
    El disparador lista las columnas **desde la fila** (prefijo `reserva_`):
    una columna `reserva_*` nueva queda cerrada sola. **Convenio** (en el
    COMMENT de la función): una columna con ese prefijo es del servidor; una
    nueva con DEFAULT haría fallar el alta de la sesión (el pre-vuelo lo
    comprueba hoy; la prueba SQL cuenta 11 y se pone en rojo si hay más).
  - **Caminos legítimos comprobados** (ninguno escribe `reserva_*` con la
    sesión): alta y PUT de `/api/appointments` (objeto campo a campo), ligar
    (D7: `paciente_id` y `title`), cambiar el estado, WhatsApp manual
    (`whatsapp_*`), `/api/consultas` (`status`), arrastre y redimensionado. Los
    del servidor (`reservar_por_enlace`, `reagendar_por_enlace`, Google)
    corren como `service_role`.
- **7a · El código del enlace lo calcula siempre el servidor**
  (`20261117122000`). **Lo encontrado:** el alta de un enlace la hacía el
  cliente de sesión (INSERT directo o `reserva_enlace_regenerar_fijo`), así
  que cualquiera con sesión podía emitir por PostgREST un enlace con el
  `codigo_hash` de un código elegido por él (corto, conocido, o que no deriva
  de `RESERVA_SECRETO` y sobrevive a su rotación). Cambiar el hash de uno
  emitido ya estaba prohibido (D1). La base no conoce el secreto, así que no
  puede comprobar el hash: la garantía es que sólo inserte el servidor.
  - `proteger_reserva_enlaces()` reemplazada (misma firma y grants; pre-vuelo
    por md5 del cuerpo de D1): INSERT sólo de `service_role` (42501 para los
    demás); `created_by` y `revocado_por` = `coalesce(auth.uid(), lo que
    venga)` (la sesión sigue sellando su uid al revocar; el servidor pasa el
    actor). Lo demás, idéntico.
  - Función nueva `reserva_enlace_emitir(p_clinica_id, p_actor, p_id,
    p_medico_id, p_clase, p_codigo_hash, p_etiqueta)`, INVOKER, **sólo
    `service_role`**: repite la regla de las policies de `reserva_enlaces`
    con el actor (de esa clínica; el propio médico, un médico administrador o
    la secretaria; 42501 si no); fijo = revoca el vigente y emite otro, en una
    transacción; único = emite.
  - `POST /api/agenda/enlaces` la llama con `createAdminClient()`,
    `p_clinica_id` = la clínica de la sesión y `p_actor` = quien la pide, tras
    las mismas puertas de antes (sesión, clínica, interruptor, 403 de
    `puedeGestionarDelMedico`). Es la única excepción al «sólo cliente de
    sesión» de `gestionServidor.ts` (anotada allí). Leer, mostrar el código y
    revocar siguen con la sesión y la RLS.
  - **Sin tocar:** las policies `reserva_enlaces_insert/update` (la de INSERT
    se queda sin camino que la use) y `reserva_enlace_regenerar_fijo`, que ya
    no puede insertar con la sesión y queda sin llamadores; retirarla es una
    limpieza aparte (Protocolo 2).
  - **Al fusionar con `feature/limites-ajustables`**: `reserva_enlace_emitir`
    es una función más que no ejecutan los tres roles; va a la lista del
    caso 3 de `p1_permisos_funciones.sql` junto con las 30 del H2 (serán 31).
- **Pruebas:** `supabase/pruebas-sql/seg_borrado_cita.sql`,
  `seg_columnas_reserva.sql`, `seg_emision_enlaces.sql` (como `authenticated`
  con claims, como `service_role` y como `anon`); `d1_enlaces_reserva.sql`
  adaptada (las altas pasan por `reserva_enlace_emitir`; sus casos de permisos
  ahora prueban la regla de la función); `e2e/seguridad-postgrest.e2e.ts`
  (PostgREST directo con el JWT de `admin.a`, más el alta por la API). Cada una
  en rojo con su mutación (§9).
- **Lo que no se pudo hacer sin pedir permiso:** nada; ningún punto obligó a
  cambiar una policy ni una regla de `CLAUDE.md`.

### Integración de las correcciones de seguridad (2026-11-12)

Las dos ramas (`feature/agenda-v2-seg1` y `-seg2`) fusionadas en
`feature/agenda-v2` y probadas juntas desde cero. Auditoría del conjunto:
`supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` §8 (las cuatro APTA; ningún objeto
de `main` cambia; ninguna policy tocada). Lo que queda para Angel:

- **⚠️ Para Angel: los puntos 1 y 6 de tu lista se contradicen en un caso, y
  se dejó como pediste en el punto 2.** El punto 1 pide que el enlace no revele
  nada de un teléfono; el 2 y el 6, que el bloqueo **manual** por teléfono
  corte (también el enlace de un solo uso). Un rechazo que se decide por un
  dato que nadie verifica lo ve quien lo manda: **desde el enlace se puede
  saber si la clínica bloqueó A MANO un número con ese médico** (sale «Para
  agendar, comunícate con el consultorio: {teléfono}.»). Ya **no** se puede
  saber si un teléfono tiene cita ni historial: eso sólo lo decide el correo
  verificado. Lo acotan los límites de intentos (6 reservas por red y 4 por
  navegador cada hora) y, en el enlace fijo, que hace falta un correo
  verificado propio. **Alternativa:** que el bloqueo manual mire sólo el
  correo; entonces el teléfono no decidiría nada, y un contacto bloqueado
  entraría con otro correo. `DEUDA_TECNICA.md` AG-DT-28.
- **Hallazgo para Angel: no hay forma en la pantalla de convertir en cita un
  evento nacido en Google.** §2 lo pide («convertibles en cita ligándolos a un
  paciente»). Un evento importado entra como evento sin paciente; el modal
  deduce el tipo de la fila al editar y no lo deja cambiar (decisión D5,
  comentada en `AppointmentModal.tsx`: quitar o poner paciente por un selector
  reabriría el borrado sin alerta), y
  el panel de ligar (D7) sólo existe para las citas «Por ligar» de la reserva
  por enlace. **Se dejó así** (la opción que menos cambia): hoy se borra el
  evento y se agenda la cita, o se agenda encima. `DEUDA_TECNICA.md` AG-DT-29.
- **Decisiones tomadas sin preguntar en la integración:**
  - `seg1_candado_correo.sql` lleva un `grant` más (a su ayudante
    `pg_temp.dia`): fallaba en la base combinada con
    `feature/limites-ajustables` (hallazgo I1). Es la prueba, no la migración.
  - **El hallazgo 2 del revisor** (siete funciones de `main` ejecutables por
    PUBLIC en la base local de esta rama) **no se trató aquí**: no lo trae la
    agenda, y es lo que corrige `feature/limites-ajustables` (I2).
  - **Google simulado para las pruebas a mano:** pasa de un programa que la
    guía hacía copiar a mano a `scripts/google-falso-manual.ts`, que además
    arranca él mismo la app del 3002 (un comando en vez de dos terminales con
    variables). Al cerrarlo con Ctrl+C borra la conexión y el estado de
    sincronización, los eventos que entraron desde el Google falso y los
    avisos de empalme de la sesión, y suelta del falso las citas que se le
    mandaron (vuelven a `pending`). Lo hecho a mano en la agenda se queda, y la
    auditoría no se borra. La limpieza al cerrar es asíncrona a propósito:
    `npx tsx` remata al hijo con SIGKILL si en 30 ms no le contesta (comentado
    en el archivo). Si una sesión se cerró de golpe, al arrancar para la app del
    3002 que dejó (sólo procesos de esa carpeta con una marca propia en su
    entorno) y quita lo que lleva la marca exacta del falso; un evento importado
    ya cancelado y suelto se queda hasta la próxima siembra. Revisado por un
    revisor en Sonnet: sus cuatro hallazgos (borrar al arrancar sin marca
    exacta, borrar al arrancar todos los avisos de empalme, el comentario de la
    auditoría y la ventana sin manejador de señales) se corrigieron.
  - **SEG-A5 de la guía estaba mal:** decía que dentro de la agenda un evento
    de todo el día da un aviso de empalme. No lo da, ni antes ni ahora
    (`empalmesServidor.ts` filtra `all_day = false`): la cita se guarda sin
    aviso. Se corrigió la guía; el código no cambió.

### Tanda tras las primeras pruebas a mano (2026-11-13)

Angel probó la agenda a mano y mandó 16 puntos. Se repartieron en tres ramas
(`feature/agenda-v2-t1`, `-t2`, `-t3`), fusionadas e integradas en
`feature/agenda-v2` el mismo día. **Sin migraciones** (el conjunto sigue en
25). Todo lo nuevo va detrás del interruptor, salvo la búsqueda de paciente
del formulario completo (punto 1), que sale directa porque era un defecto.

**Decisiones de Angel (no volver a preguntar):**

- **AG-DT-28 se queda como está:** el bloqueo MANUAL por teléfono sigue
  cortando el enlace (también el de un solo uso), aunque desde el enlace se
  note. No se cambia a «sólo correo».
- **«Compactar» al abrir (F1.5) se queda APAGADO** (`COMPACTAR_AL_ABRIR =
  false` en `src/lib/agenda/ventanaRejilla.ts`). Cierra el pendiente de F1.5.

**Decisión pendiente de Angel (punto 9):** el **médico invitado no puede crear
tipos de cita** (la policy `tipos_cita_insert` exige `soy_admin_de_clinica()`,
P5), así que al preparar su enlace no puede aceptar «Crear «Consulta», 30 min»:
la pantalla le dice «Pídele a quien administra la clínica que cree uno.».
Permitirlo exigiría cambiar esa policy y **no se hizo** (regla de la tanda:
ninguna policy existente se toca). Si lo quieres, es una migración aparte.

**Cambia la decisión 18 de F** («se conserva la invitación de Google tras
crear»): se conserva, pero **desde la burbuja ya no se abre sola**; tras
agendar, la burbuja ofrece «Invitar por correo» como botón. Desde el formulario
completo sigue abriéndose sola, como antes.

#### T1 · búsqueda, burbuja, capas y WhatsApp (puntos 1, 2, 3, 4, 13 y 14)

**Punto 1 · buscar un paciente con varias palabras (sin interruptor).**
- Causa: la consulta era UN `.or(nombre.ilike.%texto%,apellidos.ilike.%texto%)`
  con el texto entero. «Hugo Interián» no está entero ni en `nombre` («Hugo»)
  ni en `apellidos` («Interián Canché»), y `ilike` no iguala «interian» con
  «Interián». El mismo defecto en el formulario completo, la burbuja y el
  buscador.
- Arreglo sin migración: `buscarPacientes` (`src/lib/agenda/buscarCitasPaciente.ts`)
  parte el texto en palabras sin acentos (hasta 5) y manda UN `.or()` POR
  PALABRA con `imatch` (`nombre.imatch."patrón",apellidos.imatch."patrón"`);
  PostgREST junta los `or` con AND. El patrón (`patronSinAcentos`) cambia cada
  vocal, la n y la c por su clase con las variantes acentuadas en las dos
  cajas: no depende del locale ni de `unaccent`. Sólo `[a-z0-9]` y corchetes:
  nada que PostgREST o la regex lean como sintaxis. Comprobado contra el
  PostgREST local (v14.5). **En producción hay que comprobar una vez que
  PostgREST admite `imatch` (≥ 10) antes de fusionar (§7).**
- Por qué no `unaccent`: pediría migración, permisos y tolerancia a su
  ausencia; con `imatch` vale ya en producción y la RLS sigue decidiendo qué
  pacientes se ven.
- El formulario completo usa ahora `buscarPacientes` (antes tenía su copia):
  el texto se limpia de `, ( ) % * \ "` y un error queda en el log.
- Semilla: un paciente nuevo de admin.a, «Hugo Interián Canché» (9990000026),
  sin citas.

**Punto 2 · crear paciente desde la burbuja.** Al final de la lista, cuando la
búsqueda ya contestó, sale «Registrar «…»». Abre `QuickPatientModal` tal cual
(consentimiento del aviso de privacidad, duplicados, médico para la secretaria;
la puerta de suscripción la pone el RPC). El paciente queda elegido y el foco
va a «Guardar». El modal se pinta HERMANO del diálogo de la burbuja y, mientras
está abierto, el «tocar fuera» de la burbuja se pausa.

**Punto 3 · capas dentro de la ventana.**
- Causa: `colocar` medía la capa una vez, al montar, sin alto máximo, y la
  «ventana» era la de layout (con el teclado de la tableta abierto, la parte
  visible es más baja).
- `posicionCapa` devuelve `altoMaximo` (la capa lo usa como `max-height`, con
  desplazamiento interno) y acepta la parte visible (`visualViewport`). Orden:
  derecha, izquierda, debajo si cabe, encima si cabe; si no, el lado con más
  sitio; si ni eso llega a 160 px, la ventana entera.
- Se recoloca al cambiar de alto (`ResizeObserver`) o la parte visible, en un
  `requestAnimationFrame`. La hoja del teléfono se apoya en el borde de abajo
  de la parte visible y no pasa del 80 %.
- `colocar` sigue siendo copia deliberada en tres archivos (burbuja, tarjeta,
  herramientas) y el arreglo va en las tres (deuda AG-DT-38).

**Punto 4 · WhatsApp.**
- Causa: el cliente pintaba el botón con una regla más floja que la del
  servidor, que contestaba `409 no_aplica` sin motivo («Esta cita ya no admite
  el mensaje.»). Lo más probable en la prueba de Angel: una cita pasada.
- Una sola regla pura, `motivoSinWhatsApp` (`whatsappCita.ts`), con su motivo
  (`sin_paciente`, `cancelada`, `atendida`, `no_asistio`, `otro_estado`,
  `todo_el_dia`, `pasada`, `sin_telefono`, `telefono_invalido`). La usan la
  ruta, la lista de mañana y el cliente para decidir si PINTA el botón (modal,
  tarjeta y burbuja).
- El 409 trae `motivo` y el botón lo dice en llano («La cita ya pasó.»…), con
  `role="alert"`. Un teléfono sin formato de México se rechaza (422) ANTES de
  emitir el enlace de confirmación.

**Puntos 13 y 14 · después de agendar desde la burbuja.**
- La burbuja ya no se cierra al guardar: enseña «Cita agendada» (anunciado por
  un `role="status"` siempre presente). `handleSave` devuelve el alta
  (`AltaGuardada`) y acepta `{ sinInvitacion }`.
- **Acción principal: «Listo»** (la que menos cambia: quien no quiere nada más
  pulsa donde estaba «Guardar»; el consentimiento para WhatsApp de los
  pacientes existentes sigue pendiente, §7). Secundarias: «Enviar por
  WhatsApp» e «Invitar por correo», a todo el ancho; pie «Listo» | «Más
  opciones».
- «Invitar por correo» abre el mismo «Agregar invitados», sólo si habrá evento
  de Google y quien agenda puede invitar; cierra la burbuja. «Más opciones»
  abre la edición de la cita creada.
- Logo de WhatsApp: SVG propio en #25D366, decorativo; el nombre del botón es
  su texto. En todas sus apariciones.
- El toast «Se agendó correctamente» se conserva (doble anuncio, AG-DT-41).

#### T2 · configuración guiada (puntos 7 a 12)

- **Punto 9 · permisos de los enlaces: la base ya coincidía; no se cambió
  ninguna policy.** Dueño: todos; médico invitado: sólo los suyos (403 y 42501
  para otro); secretaria: todos (lista A, punto 16, lo que menos cambia). La
  regla está en las policies, en `reserva_enlace_emitir` y en la ruta, y dice
  lo mismo.
- **Punto 9 · dónde vive el enlace de cada médico:** una **ficha por médico
  dentro de la configuración** («Enlaces de reserva»), no en `/perfil` (otra
  página, otro sistema de diseño, sin interruptor). El médico ve sólo la suya;
  administrador y secretaria, una por médico, la propia primero con «(tú)».
- **Punto 8 · una sola regla para «¿abre este enlace?»**:
  `src/lib/reserva/aperturaEnlace.ts` (`motivosApertura`), compartida por la
  página pública y la configuración. Sin ningún día abierto la página sigue
  abriendo (como hoy) y la clínica ve «Abrirá sin horarios». Lo que la base
  decide antes (aviso sin aprobar, clínica sin acceso) sale como «No abrirá:
  la clínica no puede recibir reservas ahora…».
- **Punto 8 · cómo se calcula** (`preparacionServidor.ts`, en `GET
  /api/agenda/enlaces`, campo `preparacion`): con enlace vigente, se abre con
  `abrirEnlace()` como la página; sin él, de las tablas. **Segunda excepción a
  «sólo cliente de sesión»:** los consultorios de OTROS médicos se leen con
  `createAdminClient()`, filtrado por `clinica_id` y con el alcance del rol;
  del navegador sólo sale el motivo.
- **Punto 8 · crear el enlace sigue permitido** aunque falte algo: la ficha
  pide lo que falta («Para que el enlace abra, falta:») con «Crear «Consulta»,
  30 min» (sólo a quien administra; ver la decisión pendiente arriba).
- **Punto 10 · el horario del consultorio activo en la rejilla**
  (`horarioRejilla.ts`): cuando la rejilla enseña a UN médico, (1) el
  consultorio activo de la app si es suyo; (2) si no, su único consultorio
  activo; (3) varios sin elegir o «Todos» → el de la clínica. Con horario
  propio manda el suyo. Lo leen la rejilla y TODOS los avisos de fuera de
  horario (una sola variable). Apagada: `config?.horario ?? HORARIO_DEFAULT`,
  el mismo objeto (A1-bis).
- **Punto 11 · husos:** no se cambió la rejilla (sigue en la hora del
  dispositivo); queda en deuda con su ejemplo (AG-DT-31).
- **Punto 7 · «Para empezar»:** sólo para médicos; tres pasos calculados en
  cada carga (consultorio con día abierto, tipo activo que le aplique, enlace
  vigente); desaparece con los tres hechos.
- **Punto 12 · pulido:** cuatro grupos (Horario y disponibilidad · Citas ·
  Reserva por enlace · Preferencias de este dispositivo); «Reserva por enlace y
  recordatorios» pasa a **«Plazos y recordatorios»**; un consultorio con el
  horario de la clínica no repite las siete líneas; botones en dos altos;
  `TarjetaSeccion.tsx` y `clasesConfig.ts` (ocho usos reales); tokens
  `--ag-aviso-*`.

#### T3 · engrane, convertir en cita, tarjeta al pasar, elevación (puntos 5, 6, 15 y 16)

- **Punto 5 · engrane:** con la v2, sólo icono a cualquier ancho, con
  «Configuración de la agenda» (`aria-label` y `title`), en escritorio y
  teléfono. **Apagada se queda como estaba** («Configurar horario de
  consulta», abre el modal de siempre). Lo decide la prop
  `engraneConfiguracion`.
- **Punto 6 · convertir en cita un evento nacido en Google (cierra AG-DT-29):**
  en la tarjeta de un evento sin paciente con `origen = 'google'`, con hora,
  médico y agendado o confirmado, «Convertir en cita». Pide paciente (el
  buscador de la burbuja, con su «Registrar «…»», o «Registrar paciente
  nuevo»), consultorio del médico del evento y, opcional, tipo. Guarda por
  `handleSave` (el PUT de siempre). Sólo eventos de Google (§2). No cambian
  `origen`, `google_event_id`, `gcal_etag` ni las notas (se quedan en Spinus).
  A Google va lo de cualquier cita con paciente (título del paciente,
  descripción fija; nunca las notas; `sendUpdates: 'none'`).
- **Punto 6 · servidor:** colgarle un paciente a una fila sin paciente que no
  está por ligar es un ALTA, así que pasa las puertas del alta
  (`vetoDeConversion`, `porLigarServidor.ts`): las tres funciones de
  `appointments_gates_insert` ORIGINALES por RPC con la sesión, consultorio
  obligatorio y paciente de ESTA clínica visible (`pacienteVisible`). Vale
  para cualquier evento sin paciente con v2 (acota AG-DT-13). En el cliente,
  la misma puerta de suscripción que «Agendar» (`puedeAgendar`). Auditoría
  `cita_ligada` con `via: 'convertir'` por `logAudit` (no se añadió a `c_vias`:
  pediría migración). Ligar una por ligar (D7) sigue sin pasar las puertas de
  suscripción, a propósito.
- **Punto 15 · tarjeta al pasar el ratón:** con la v2 y ratón, 1 s de quietud
  sobre una cita abre su tarjeta; se cierra al salir de la cita y de la
  tarjeta (300 ms de margen); un clic la fija (la de siempre, en su sitio, sin
  volver a entrar). Es NO modal, no roba el foco, Escape la cierra. Nunca con
  un botón pulsado, encima de otra capa, en el teléfono o en táctil.
  Preferencia por dispositivo «Abrir la tarjeta al pasar el ratón»,
  **encendida por omisión** (lo pidió Angel).
- **Punto 16 · elevación:** 1 px (`translateY(-1px)`) en la caja de dentro
  (`.ag-tarjeta`, `.ag-mes`, `.ag-banda`), nunca en el `.fc-event` (FLIP);
  nada con movimiento reducido, en filas de lista, en bloques de Google de
  sólo lectura ni en el espejo de arrastre. Manda sobre la nota F2.1 («nada de
  `transform` en el hover»): lo pidió Angel; 1 px es el mínimo.

#### Integración (decisiones sin preguntar)

- **La preferencia de la tarjeta al pasar va en su propia tarjeta**, «Tarjeta
  de la cita», dentro del grupo «Preferencias de este dispositivo» de T2: así
  el grupo sigue la retícula de las demás secciones (e2e `agenda-f-simetria`).
- **La tarjeta al pasar también se recoloca** al crecer o al cambiar la parte
  visible de la ventana (el seguimiento de T1 en las dos variantes, gancho
  `useColocacionSeguida`). Sigue sin acompañar al desplazamiento de la rejilla
  (AG-DT-36).
- **«Convertir en cita» conserva su botón «Registrar paciente nuevo»** además
  de la opción «Registrar «…»» de la lista (que abre el alta con lo escrito).
- **La e2e `reserva-seg1` «punto 5» fallaba según el día** (400
  `turno_invalido` en vez de 409 `turno_ocupado`). Causa: elegía el último
  turno libre de la cuarta semana; la ruta, antes de la RPC, exige que el turno
  se haya podido ofrecer con la ocupación del momento o con la jornada vacía, y
  con el evento de todo el día puesto sólo vale lo segundo. Si ese día había
  una cita de 13:00 a 13:15, el último turno era p. ej. 17:15, no alineado a la
  jornada vacía: 400 antes de la RPC. Qué día y qué citas dependía de la fecha
  de la siembra y de hoy. Ahora elige un turno de un día sin citas del médico
  (semana a semana, dentro del horizonte), así que la petición llega a la RPC y
  vuelve a medir que el evento de todo el día ocupa. Sigue en rojo con la
  mutación `AND NOT a.all_day` en `reservar_por_enlace` (201 en vez de 409).
  Era la prueba, no el código.
- **F1.12 fallaba los sábados** (la lista de Semana del teléfono no llegaba a
  la cabecera de hoy). Era el código, no la prueba: en el primer cuadro las
  cabeceras de día miden 17 px y en el siguiente 38, y el navegador recorta el
  `scrollTop` al alto de ese momento; con hoy cerca del final de la lista se
  quedaba corto. `desplazarListaAHoyEstable` (`listaHoy.ts`) lo repite cuadro
  a cuadro (máximo 10) mientras la lista cambie de alto, una sola vuelta a la
  vez. Sale sin interruptor, como todo F1. Prueba: `listaHoy.test.ts` (en rojo
  con una sola vuelta).
- **Las e2e ya no borran lo que no crearon** (lo pidió Angel: le borraron un
  tipo «Cita Dr Ancona» y un enlace fijo hechos a mano). Ver §9 y la guía.
  Aviso honesto: **la semilla (y por tanto cada corrida de Playwright, cuyo
  `global-setup` siembra) BORRA Y RECREA las clínicas Semilla A y B enteras**;
  eso no cambió. Lo que se cambió es que, dentro de una corrida, cada e2e
  limpia sólo lo creado desde que empezó su archivo.

### Tanda de diseño, duración y horarios (2026-11-14)

Angel mandó el 2026-11-14 veinte puntos sobre el aspecto de la agenda y sus
páginas, la duración de la consulta y los horarios, con la maqueta
`docs/spec/rediseno-paginas-agenda.html` como dirección visual. Se repartieron
en cuatro ramas (`feature/agenda-v2-g1` a `-g4`), fusionadas e integradas en
`feature/agenda-v2` el mismo día. **Cuatro migraciones nuevas** (el conjunto
pasa de 25 a **29**: las 5 de `main` y 24 del proyecto): `20261119120000` y
`20261119121000` (G2), `20261119130000` (G4) y `20261119140000` (G3). Todo lo
nuevo va detrás del interruptor, salvo la regla de la nota ligada (decisión 3,
abajo), que sale también con la v2 apagada. Reglas de Angel para toda la tanda:
sin dependencias nuevas; nada clínico en pantalla ni en correos; la seguridad y
los límites de las rutas públicas no cambian, sólo su presentación; el aviso de
privacidad no se toca; no se pierde ninguna función; una prueba por cambio,
comprobada en rojo con su mutación. Única excepción de policy autorizada:
`tipos_cita_insert` (y después `tipos_cita_update`, decisión 1).

**Decisiones de Angel durante la tanda (no volver a preguntar):**

1. **El médico invitado crea, cambia y archiva SUS tipos de cita y su
   duración**, sin poder reasignarlos a otro médico; el administrador conserva
   lo que tenía (G2 y G2b, policies `tipos_cita_insert` y `tipos_cita_update`).
   Cierra la decisión pendiente del punto 9 de la tanda del 2026-11-13.
2. **Cualquier rol que vea la cita manda el correo de confirmación**, también
   la secretaria (paridad con el WhatsApp de E7).
3. **Una cita atendida con nota clínica no cambia de estado ni se borra**; sin
   nota, se puede corregir.
4. **«Reagendar cita» desde una cancelada o «no asistió» crea una cita NUEVA**;
   la original no se toca.
5. **La página de reserva muestra sólo los tipos de cita válidos para el
   consultorio elegido; si queda uno solo, no se muestra el selector**
   (integración, abajo).
6. Ya decididas antes y que siguen: AG-DT-28 se queda; «Compactar» al abrir,
   apagado; el enlace de reserva por médico, dentro de la configuración.

**Decisión abierta para Angel:** el 409 `nota_ligada` le deja ver a la
secretaria que la cita atendida TIENE nota clínica (sólo eso, nunca el
contenido). Si lo prefieres, se unifica con el mensaje genérico
(`estado_no_admite`), que es cambiar una cadena (AG-DT-63).

**Cómo quedó el punto 13 (el horario de la agenda):** lo de G4 **sustituye al
punto 10 de la tanda del 2026-11-13** («el horario del consultorio activo en la
rejilla, y si no el de la clínica»). Con la v2 la clínica deja de tener horario
propio en pantalla (G2 quitó «Horario de la clínica»), cada consultorio que no
tenía uno hereda UNA vez el de la clínica (migración `20261119130000`) y la
agenda —rejilla, gris, «Compactar», hora de apertura, Mes, panel de huecos y
todos los avisos de fuera de horario— se dibuja con el horario de los
consultorios, cada uno en su zona. `clinicas.horario_consulta` se queda
(spinus-consola) y sólo lo heredan los consultorios nuevos.

#### G1 · diseño de /reservar, /confirmar y de los correos (puntos 1, 2, 3, 4, 6 y el bloque «Tipo de cita» del 7)

- **Dónde vive el diseño.** Un marco común `src/components/agendaPublica/MarcoPublico.tsx`
  (cabecera navy con el símbolo real `/logo.png` en su placa blanca + «Spinus»
  en texto + la tarjeta del médico) y una hoja `agendaPublica.css` con prefijo
  `rp-`. Tres usos: la reserva, «Este enlace ya no está disponible» y la
  confirmación. Todo con los tokens `--ag-*` (REGLA 4: el azul de los botones
  es `--ag-brand-secondary` = `--cs`); tipografía `--sp-font` (la de la app:
  system-ui, no la Inter de la maqueta, que es sólo dirección).
- **Tema oscuro por el teléfono del paciente.** Estas páginas no montan
  `ScriptTema` (y no deben: es sólo de `(app)`/`(launcher)`), así que no hay
  `html.dark`. La hoja redeclara en `@media (prefers-color-scheme: dark)`,
  sobre `body:has(.rp)`, los `--ag-*` que usa con los MISMOS valores de
  `html.dark`; `agendaPublicaTokens.test.ts` lo compara uno a uno. El cromo es
  el de Spinus, no la marca de la clínica (como `/r/[folio]`).
- **Pasos.** Cuatro visibles: «Qué y dónde», «Día y hora», «Tus datos» (incluye
  el código del correo del enlace fijo: «Revisa tu correo») y «Listo». **Con un
  solo consultorio y un solo tipo no hay nada que elegir y la página arranca en
  «Día y hora»** (el paso 1 sale marcado como hecho; el resumen ya enseña el
  consultorio con su dirección). Elegida por ahorrar un toque sin perder la
  dirección a la vista.
- **«Tipo de cita» sólo con más de uno (punto 7).** Hoy los tipos NO se atan a
  un consultorio (son de la clínica o del médico, `tipos_cita` no tiene
  `consultorio_id`), así que se decide con la lista del médico entera
  (`datos.tipos`). *(Superado en la integración: con los tipos por consultorio
  de G2, la página ofrece los del consultorio elegido; punto 5 de Angel, abajo.)*
  Con uno solo, va preseleccionado; con
  varios NO se preselecciona ninguno (como el «Elige…» de antes; la maqueta
  marcaba el primero) y «Elegir día y hora» espera a que se elija, con «Elige el
  tipo de cita para continuar» (hallazgo del revisor).
- **El tipo en el resumen sí, en la pantalla final no.** En los pasos se enseña
  el tipo elegido sólo si hubo que elegir; la pantalla «Listo», como el
  comprobante, sigue SIN tipo de cita (lista A, 10).
- **Dirección completa (punto 2).** `consultorios` sólo tiene `direccion` (un
  texto): «completa» = ese texto entero, sin cortes (antes un `<select>` lo
  truncaba). Va en la tarjeta del consultorio (paso 1, también con uno solo), en
  el resumen de los pasos 2 y 3, en «Listo», en la confirmación (fila
  «Dirección»), en el comprobante y en el recordatorio. **La API no cambió:** la
  dirección ya llegaba a la página.
- **Tira de fechas y Mañana/Tarde.** En el cliente, con lo que la API ya da (7
  días desde `desde`): los días sin turnos salen atenuados y deshabilitados
  (con «, sin horarios» en su nombre accesible); al cargar la semana se elige el
  primer día con turnos; debajo, sólo los de ese día, en «Mañana» (antes de las
  12:00 en la zona del consultorio) y «Tarde» (12:00 en adelante), rejilla de 4
  columnas iguales. Un grupo vacío dice «Sin horarios» (como la maqueta). Semana
  entera sin turnos: «No hay horarios libres esta semana.» y «Ver la semana
  siguiente». La semana y el día se recuerdan al volver al paso 2.
- **Fecha.** «Viernes, 13 de noviembre» (sólo la primera letra; antes la clase
  CSS `capitalize` subía la preposición). En la confirmación y en los correos la
  fecha grande va SIN año («13 de noviembre · 10:45 h», como la maqueta: cabe en
  un renglón del teléfono); el año sigue en el texto plano de los correos.
- **Estados.** Cargando: esqueleto de la tira y la rejilla con `aria-busy` y un
  `role="status"` oculto «Buscando horarios…». Error de /turnos: aviso
  `role="alert"` y «Reintentar». Ocupado (409) o turno inválido: vuelve a «Día y
  hora» con «Ese horario se acaba de ocupar. Elige otro.» y la semana se vuelve
  a pedir (se remonta). No disponible: marca sin médico (como antes), el
  teléfono y «Llamar al consultorio» (`tel:`).
- **Confirmación (punto 3).** Mismo marco; el médico SIN especialidad (la
  confirmación no la enseña: lista A 16). La fecha es lo más grande; cada estado
  y cada resultado con su color (verde confirmado, rojo cancelado, ámbar
  «fuera de plazo»/«demasiados intentos»). **No cambian** los textos, los
  nombres de los botones («Confirmo mi asistencia», «No podré asistir», «Sí,
  cancelar mi cita», «Volver», «Elegir otro horario»), el GET que sólo lee ni el
  POST. La maqueta proponía «Conservar mi cita» en vez de «Volver»: se quedó
  «Volver» (lo que menos cambia; la guía E4 lo nombra).
- **Movimiento (punto 6).** Entrada de cada paso con `opacity` + `translateY(6px)`,
  `--ag-dur-base` (180 ms) y `--ag-ease-out`; el esqueleto late en opacidad; un
  `scale(.98)` al pulsar con ratón. Nada con `prefers-reduced-motion: reduce`.
  Al cambiar de paso el foco va al título del paso (`tabIndex=-1`), salvo al
  cargar.
- **Correos (punto 4).** Un solo armado, `src/lib/correo/plantillaCita.ts`
  (`htmlCorreoCita`, `textoCorreoCita`, `fechaDeCorreo`, `urlSegura`):
  tablas y estilos en línea, cabecera navy con «Spinus» EN TEXTO (sin ninguna
  imagen: con imágenes bloqueadas un símbolo saldría roto), título, fecha
  grande, tabla Médico/Consultorio/Dirección/Teléfono, botones «a prueba de
  balas» (celda con `bgcolor` + enlace con relleno, a todo el ancho), letra
  pequeña y `meta viewport`. Los colores son los hex de fábrica de los `--ag-*`
  (un correo no lee variables). **No cambiaron** las firmas
  (`correoCodigo`, `correoComprobante`, `correoRecordatorio`), los asuntos ni
  las frases del texto plano (sólo se antepone «Spinus» y el título). El
  recordatorio gana dos botones: «Confirmo mi asistencia» (el enlace) y «No
  podré asistir» (el enlace con `?paso=cancelar`, un GET que sólo pinta el
  «¿Seguro?»); confirmada, sólo «Avisar que no podré asistir». **Para G3 / el
  integrador:** el correo de confirmación propio de Spinus debe armarse con
  `htmlCorreoCita`/`textoCorreoCita` (no con un `envolver` propio).
- **«Aviso a la clínica» no es un correo.** Angel lo listó con los correos, pero
  E8 decidió «sin correo a la clínica» (lista A 12): el aviso es el emergente de
  la agenda y el panel «Por confirmar». No se creó ningún correo nuevo; el
  emergente no se tocó.
- **El correo del código no lleva el consultorio** (la maqueta lo ponía al pie):
  `/codigo` sólo recibe el correo y añadirlo pediría cambiar la API pública.
- **Detrás del interruptor.** Las dos páginas ya sólo abren con la v2 (404 con
  ella apagada; lo prueba la e2e). Los correos de cita sólo salen con la v2. Nada
  de esto se ve con la v2 apagada.

#### G2 · duración de la consulta, rejilla fija, configuración (puntos 5, 7, 8, 9, 10-pantalla y 20)

- **Modelo de la duración (punto 7):** la «duración de la consulta» de un médico ES un tipo de cita suyo
  marcado `principal = true` (columna nueva en `tipos_cita`), nombre «Consulta», creado por dentro al
  contestar «¿Cuánto dura tu consulta?» (30 min, 45 min, 1 hora u otra). Ninguno nace con un valor fijo:
  se retiró «Crear «Consulta», 30 min». La duración distinta en UN consultorio es OTRO principal del mismo
  médico con `consultorio_id` (columna nueva); allí sustituye al general (`tiposDelConsultorio`). Sólo los
  principales llevan consultorio (CHECK): los tipos «de más» valen en todos los consultorios.
  Por qué en `tipos_cita` y no una columna en `consultorios`: `reservar_por_enlace` calcula el fin con la
  duración DEL TIPO; con la duración en el consultorio habría que cambiar la RPC de la garantía atómica.
  Así la RPC no se toca.
- **Convenio que la base no impone:** la RPC acepta el tipo en cualquier consultorio del médico; las dos
  rutas públicas (turnos y POST) filtran con `tiposDelConsultorio` antes de llamarla. Escrito en el
  COMMENT de la columna y de `reserva_contexto`.
- **«Duración de la consulta» hecha** = el médico tiene algún tipo que le aplica (la regla de T2,
  `sin_tipos`): clínicas que ya tenían tipos no ven el paso pendiente. Sin principal propio, la sección
  ofrece «Poner tu propia duración de consulta» (discreto). La duración para el ajuste de la agenda:
  principal del consultorio → principal general → el único tipo que valga → ninguna (no se ajusta).
- **Policy `tipos_cita_insert` (autorizada por Angel):** además del administrador, un MÉDICO para sí mismo
  (`medico_id = auth.uid()` y rol médico); nunca de toda la clínica ni de otro médico; la secretaria
  como hoy (no). Sin puerta de suscripción (B6 no la tenía). La ruta exige lo mismo (403).
- **Se detuvo en `tipos_cita_update`** (sólo el administrador) y lo propuso sin aplicar. *Angel lo
  autorizó (decisión 1, abajo) y se aplicó en G2b (`20261119121000`).*
- **El administrador no puede poner una duración por consultorio a otro médico:** el disparador
  `validar_tipo_cita_consultorio()` lee `consultorios` con la RLS de quien escribe y el administrador no ve
  los consultorios de otros (`consultorios_select`). Falla cerrado (23514). La opción sale sólo en la
  fila del consultorio, para su dueño.
- **El índice de nombre único** (`tipos_cita_nombre_activo_unico`) se rehízo para no mirar las filas con
  consultorio (repiten «Consulta»); las cubre `tipos_cita_principal_unico` (uno activo por médico y uno
  por médico y consultorio).
- **Rejilla fija (punto 9, sustituye a P9):** turnos desde la apertura del día con paso igual a la duración
  del tipo; el resto que no llega a un turno se pierde; un turno que algo toca aunque sea en parte no se
  ofrece (semiabierto, la misma condición que la RPC: `start_time < fin AND end_time > inicio`, sin
  `cancelled`/`no_show`, con lo de todo el día). `turnoValido` = estar en la rejilla, en horario,
  anticipación y horizonte (400 si no); lo libre lo decide la RPC bajo su candado (409). El POST YA NO lee
  la ocupación antes de la RPC (desaparece la causa del fallo «según el día» de reserva-seg1 punto 5).
  Un reenvío del mismo `client_id` sigue llegando a la RPC y sale `repetida`.
- **Ajuste al turno en la agenda (punto 9):** clic en la rejilla, selección (y el hueco del panel, que es
  una selección) y arrastre de una cita se corren al turno más cercano de la rejilla del médico en ese
  consultorio (empate → el de después). Consultorio: al arrastrar, el de la cita si quien mira lo ve; en un
  clic, el de la rejilla (`consultorioDeLaRejilla`: un médico a la vista y su consultorio activo o único).
  Sin consultorio claro, sin duración conocida o fuera de la jornada: no se ajusta (lo que menos cambia).
  En la zona del consultorio. Lo escrito a mano en la burbuja o el modal se respeta. La selección se corre
  entera (conserva lo arrastrado); el redimensionado NO se ajusta (no lo pidió Angel). La rejilla visual de
  FullCalendar no cambia (es de G4). Con la v2 apagada no hace nada ni pide los tipos.
- **El modal** ofrece los tipos del consultorio elegido (sin dos «Consulta»). En el servidor de citas no se
  añadió la comprobación de consultorio del tipo: en la agenda interna el tipo es sólo plantilla (B6c) y la
  RPC pública ya lo filtra la ruta.
- **Pantalla (punto 5):** «Primeros pasos» con barra y «N de 3 listos», en el orden horario → duración →
  enlace; la duración se contesta ahí mismo; «Crear enlace» con algo pendiente abre lo que falta en la
  misma tarjeta (contestar la duración crea el enlace a continuación; «Crear el enlace igualmente» se
  conserva, como T2). Una sola pregunta de duración a la vez (no en tres sitios). Menú de secciones:
  columna fija en escritorio (≥ lg), fichas que se envuelven arriba en el teléfono; son anclas, no pestañas.
  Cada enlace lleva píldora (Activo / Sin usar / No abrirá / Sin horarios), su motivo y «Completar» cuando
  lo que falta se arregla ahí. Los cuatro ajustes NO pasaron a controles de más y menos (no lo pedía el
  punto; lo que menos cambia).
- **Punto 10 (pantalla):** fuera la sección «Horario de la clínica» y su «Editar horario» (se borraron
  `SeccionHorarioClinica.tsx` y `ResumenHorario.tsx`; grep sin otros importadores). Cada consultorio dice su
  horario en una línea («Lun–vie 08:00 – 18:00 · Sáb 08:00 – 13:00») con sus días. Se conservan «Usar
  horario propio» / «Usar el de la clínica» (hasta la migración de G4 un consultorio puede no tener propio).
  Con la v2 apagada el engrane sigue abriendo `HorarioModal`.
- **Punto 20:** el enlace por médico sigue en la configuración, no en el perfil.
- **Texto del motivo `sin_tipos`:** «falta la duración de la consulta del médico» (antes «no hay un tipo de
  cita para este médico»): lo ven sólo la clínica.
- **Para G1 (no se tocó su página):** la página `/reservar/[codigo]` tiene que ofrecer los tipos de CADA
  consultorio con `tiposDelConsultorio(ctx.tipos, consultorio.id)` (`src/lib/agenda/tiposPorConsultorio.ts`).
  Hoy `page.tsx` pasa la lista plana: con una duración por consultorio saldrían dos «Consulta», y elegir la
  que no vale en ese consultorio da 400 en turnos. Se intentó el cambio mínimo en `page.tsx` y no se hizo
  (frontera con G1). *Hecho en la integración (punto 5 de Angel).*

**G2b (decisión 1 de Angel):**

- **Migración `20261119121000_agenda_g2_tipos_cita_update.sql`:** sólo `tipos_cita_update`. Archivar es un
  UPDATE (`activo = false`): `tipos_cita` no tiene policy ni privilegio de DELETE, así que no se tocó nada
  de DELETE. USING y WITH CHECK iguales: misma clínica y (administrador, o médico y la fila es suya). La
  WITH CHECK impide dejar la fila de otro médico, de toda la clínica (NULL) o de otra clínica; no hizo
  falta disparador. Administrador: la expresión se reduce a la de B6. Secretaria: como hoy (nada).
  Auditoría independiente: APTA. Aplicada sólo en local, dos pasadas.
- **`PATCH /api/agenda/tipos-cita/[id]`** deja pasar a cualquier médico; la RLS decide las filas (uno ajeno
  sale 404, como uno que no existe) y el ámbito no viaja en el cuerpo (`EditarTipoCitaSchema`).
- **Pantalla:** se quitaron los avisos «Para cambiarla, pídele a quien administra la clínica»; el médico ve
  «Cambiar duración», «Editar»/«Archivar»/«Reactivar» en sus tipos (también sus archivados) y «Cambiar» /
  «Usar la general» en la duración de su consultorio.

#### G3 · correo de confirmación, botones de aviso, tarjeta y hover (puntos 14 a 19)

- **Punto 14 · el correo de Spinus es el cuerpo del recordatorio con su asunto.**
  `correoConfirmacion` (`correosCita.ts`) = `correoRecordatorio` con asunto
  «Confirma tu cita del {fecha}» («Tu cita del {fecha}» si ya está confirmada).
  Así lleva fecha, hora con su zona, médico, consultorio con dirección y
  teléfono, y el enlace de E2 (mismo HMAC, misma regla de un código vigente), y
  hereda el rediseño de la plantilla de G1 sin copiarla. *(Resuelto en la integración, abajo.)* Para quien integre
  con G1: si G1 metió en el CUERPO del recordatorio una palabra propia del
  recordatorio («Recordatorio…», «es mañana»), hay que parametrizarla, porque la
  confirmación puede salir días antes.
- **Registro: tipo nuevo `confirmacion` en `cita_correos`** (migración
  `20261119140000`: CHECK de `tipo` y `cita_correo_tomar` con la ventana del
  recordatorio exigida sólo al recordatorio). UNA confirmación por hora de
  inicio (la llave de E4); se vuelve a tomar sólo si falló (no por duplicado) o
  quedó colgada, hasta 3 veces; reagendar permite otra. Ése es el «no reenviar
  en ráfaga». La confirmación **no** quita el recordatorio (sólo el comprobante
  lo hace, como hoy): un paciente avisado al agendar sigue recibiendo su
  recordatorio N horas antes. Lo que menos cambia.
- **Ruta `POST /api/agenda/correo`** `{cita_id}` (estricto): las puertas del
  WhatsApp de E7 (`entradaGestion`, la cita con la sesión y `clinica_id`, 404
  si la RLS no la deja ver) + `motivoSinCorreo` (la regla del botón: con
  paciente o por ligar, agendada o confirmada, con hora, futura, con correo).
  **Quién puede:** cualquier rol que vea la cita, como el WhatsApp (E7 no tiene
  permiso propio). El revisor pidió que Angel lo confirme. El destinatario lo da
  la base (`r_para`); el cuerpo no acepta destinatario (400). Auditoría: la
  fila de `cita_correos` (`log_tabla_change`) y `logAudit`
  `enviar_confirmacion_cita` a nombre de quien pulsó, sin correo en la
  descripción. Sin la migración: 503, nada enviado.
- **Dónde se ofrece:** en la burbuja tras agendar («Por correo», con su nombre
  accesible completo «Enviar confirmación por correo») y en el formulario
  («Enviar confirmación por correo» / «Enviar recordatorio por correo», junto al
  WhatsApp, bajo «Avisar al paciente»). **No en la tarjeta**: la maqueta (las
  cuatro tarjetas de Angel) no lo lleva y la rejilla queda pareja; desde la
  tarjeta, el engrane lleva al formulario, que sí lo tiene.
- **«Por correo» en la burbuja** (no «Enviar confirmación por correo»): en una
  columna de ~150 px el texto completo ocupa tres líneas; la maqueta dice «Por
  correo» junto a «Enviar confirmación» (WhatsApp). El nombre accesible es el
  completo y contiene el visible (WCAG 2.5.3).
- **«Invitar por correo» (Google) se queda** como extra, sólo si habrá evento y
  quien agenda puede invitar; en la burbuja va en la misma rejilla (si quedan
  tres, la última a todo el ancho).
- **Punto 15 · los rótulos** salen de `BotonWhatsAppCita` (sin `etiqueta`):
  «Enviar confirmación», o «Enviar recordatorio» si la cita está confirmada; en
  dos líneas («Enviar» / la palabra) cuando comparte fila y en una cuando va a
  todo el ancho (ajuste 4 de Angel). El logo es `LogoWhatsApp` tal cual (sólo
  a 20 px dentro de las capas, como la maqueta). La lista «Por confirmar»
  conserva su rótulo «WhatsApp» (no es ninguno de los tres sitios del punto).
- **Punto 16 · sin `title` sólo con la v2.** La tarjeta de Spinus sólo existe
  con la v2; apagada, quitarlo dejaría sin información al pasar el ratón. Con
  la v2, la caja de la cita lleva `role="group"` + `aria-label` («Nombre ·
  Estado», y la explicación de «Por ligar» si la tiene), también en el Mes; la
  marca «Por ligar» de la cita pierde su `title`. El `title` de la píldora «Por
  ligar» DENTRO de la tarjeta se queda (no es la cita). Cambiar el interruptor
  repinta las tarjetas una vez.
- **Punto 17 · tarjeta (con el ajuste de Angel del 2026-11-14):** acciones por
  estado (`disposicionDeTarjeta`, `accionesTarjeta.ts`). «Editar» deja de ser
  botón en una cita: el engrane «Configuración de la cita» (junto a la ✕, en
  TODAS las tarjetas) abre el formulario. La por ligar y el evento sin paciente
  conservan lo que tenían (con «Editar» y el engrane; «Eliminar evento» va a la
  zona de peligro, al final). **Si no hay «Iniciar consulta»** (secretaria, otro
  médico) no se ascienda otra acción a principal: quedan las secundarias.
  **Impares:** la última secundaria va a todo el ancho (nada suelto). La nota y
  el teléfono se siguen enseñando en la misma rejilla de datos que médico y
  consultorio; el tipo de cita va junto a la duración («60 min · Consulta»). El
  médico se enseña siempre (antes no con un solo médico): lo pide el diseño. El
  nombre del paciente en la cabecera se corta con «…» si no cabe (como la
  maqueta; el nombre accesible del diálogo es el completo). El mensaje del
  WhatsApp («Abierto en WhatsApp hh:mm» o el motivo de un error) va DEBAJO de la
  rejilla, no dentro de la celda.
- **«Ver expediente» (atendida)** sólo para quien abre expedientes (médico,
  `quien.esMedico`, como «Iniciar consulta»); una secretaria ve la tarjeta de
  una atendida sin acciones (el engrane sigue).
- *(Sustituido por la decisión 4 de Angel, abajo: crea una cita nueva.)* **«Reagendar cita» (cancelada / no asistió) REABRE LA MISMA CITA**, no crea
  otra: es lo que hoy se hacía en el modal (cambiar el estado y la fecha). El
  formulario abre con la fecha enfocada y el estado ya en «Agendada»
  (`ModalState.edit.reabrir`); al guardar, la cita vuelve a agendada en su nueva
  fecha (PUT de siempre: empalmes, horario y Google incluidos).
- **17.3 · lo que el servidor rechaza por el estado** (`vetoPorEstado`,
  `estadoCita.ts`, en `PUT /api/appointments/[id]`, sólo con v2; 409
  `estado_no_admite`): una ATENDIDA no se confirma, no se cancela y no se mueve
  de fecha u hora (tampoco arrastrándola). Se puede CORREGIR su estado a
  «Agendada» o «No asistió» (hoy se hace en el modal cuando se marcó por error)
  y editar notas o consultorio. Comprobado contra lo demás: confirmar sólo
  aplica a agendada/por ligar y confirmar una cancelada o no asistió es lo mismo
  que reabrirla (permitido, como «Reagendar cita»); cancelar una cancelada es
  inocuo; «Iniciar consulta» no es una escritura (la nota marca atendida sólo
  desde agendada/confirmada, `.in('status', …)` en `POST /api/consultas`, ya
  existente); WhatsApp y correo ya rechazaban atendida, cancelada, no asistió,
  pasada y todo el día (`motivoSinWhatsApp`/`motivoSinCorreo`, 409). **No se
  tocó ninguna policy.** Restos: el `PUT` con la RLS de siempre por PostgREST
  directo (sin la API) sigue pudiendo mover una atendida (sería una policy o
  un disparador nuevos: no se hizo).
- **Punto 18 · la sombra aparece en seco.** `.ag-tarjeta`/`.ag-mes` llevan
  `overflow: hidden`, así que un pseudo-elemento con la sombra y `opacity`
  quedaría recortado; la transición sigue siendo SÓLO de `transform` (3 px en
  `--ag-dur-micro`) y la sombra (`--ag-shadow-elevada`, con un anillo de 1 px
  que marca el borde sin tocar su color por estado) se pone con el hover. Lo
  prueba `agenda-f-pasar-raton` (en rojo si `box-shadow` entra en la transición).
- **Punto 19 · la etiqueta de huso** («09:00–10:00 hora Baja California») se
  conserva en la tarjeta (debajo de la fecha y la duración) y se AÑADE al
  acuse de la burbuja tras agendar (antes no estaba en la burbuja: la burbuja de
  alta no conoce aún la zona del consultorio; la cita creada, sí).
- **Burbuja de alta:** «Más opciones» | «Guardar» en dos columnas iguales del
  mismo alto (Guardar, la principal, a la derecha, como la maqueta). No se
  rediseñó el resto de la burbuja de alta (segmentado Cita/Evento y chips de
  duración de la maqueta): no lo pedía el texto de Angel y G2 toca el ajuste al
  turno antes de abrirla.

**Tras las decisiones 2 a 4 de Angel:**

- **Decisión 2 de Angel — quién manda el correo de confirmación:** cualquier rol
  que vea la cita, incluida la secretaria (paridad con el WhatsApp de E7). Sin
  cambio de código.
- **Decisión 3 de Angel — atendida con nota clínica:** una cita atendida con
  una fila en `consultas.appointment_id` no pasa a NINGÚN otro estado ni se
  borra; sin nota, se puede corregir. `vetoPorNotaLigada` (`estadoCita.ts`) en
  `PUT` (409 `nota_ligada`) y el mismo chequeo en `DELETE`
  (`notaLigadaServidor.ts`). **Aplica con la v2 encendida y apagada** (decisión
  sin preguntar: la nota es expediente, NOM-004; comprobado que ningún flujo de
  hoy desmarca una atendida con nota: la nota sólo marca atendida desde
  agendada/confirmada, Google no toca atendidas —`gcal_aplicar_evento`—, la
  respuesta del paciente cierra atendidas —`cita_confirmacion_responder`—, el
  arrastre no cambia estado, `cambiarEstadoCita` y cancelar pasan por el mismo
  `PUT`). Incluye el `DELETE` porque la FK de la nota es `SET NULL`: borrar la
  cita la dejaría sin cita. Cliente de servicio porque la RLS de `consultas`
  oculta las notas a la secretaria (y la regla dejaría de valer para ella);
  filtrado por la clínica de la sesión vía `pacientes!inner`, sólo un booleano,
  falla cerrado (500 sin escribir). El revisor señala que el 409 le dice a la
  secretaria que EXISTE una nota (no su contenido): ya ve que la cita está
  atendida; queda para el visto bueno de Angel (unificarlo con
  `estado_no_admite` es cambiar una cadena).
- **Decisión 4 de Angel — «Reagendar cita» crea una cita NUEVA:** desde una
  cancelada o «no asistió», abre el alta (`mode: 'create'`, la misma puerta que
  «Agendar» y «Más opciones»: suscripción, empalmes, horario, tope y Google)
  con el mismo paciente, médico, consultorio y duración (`altaParaReagendar`,
  `InteraccionesV2.tsx`); fecha: la de la original si aún no pasó, si no, hoy a
  la misma hora; el foco en la fecha. La original no se toca: ni estado, ni
  auditoría, ni lo que cuenta para el candado. Se quitó `reabrir`. **No se
  quitó** que el formulario deje corregir a mano el estado de una cancelada o
  «no asistió»: existía antes de G3 y nada de G3 lo añadió. El ajuste al turno
  de G2 vive en el camino de la burbuja (`altaCitas.ts`, otra rama): el
  integrador decide si también aplica a este alta (aquí se respeta la hora de
  la original).

#### G4 · la agenda con el horario de los consultorios (puntos 10 a 13 y 19)

**Punto 10 · la herencia (migración `20261119130000_agenda_g4_herencia_horario_consultorios.sql`)**

- Copia UNA vez `clinicas.horario_consulta` a `consultorios.horario` y pone
  `horario_propio = true` en cada consultorio que no tenía horario propio
  (también los archivados). Un consultorio con horario propio no se toca nunca.
  Antes de tocar, guarda el valor previo en
  `respaldos.consultorios_horario_20261119` (sin privilegios para `anon`,
  `authenticated` ni `service_role`, con RLS; mismo patrón que
  `respaldos.appointments_gcal_20260815`). Pre-vuelo que aborta (columnas de B5,
  propiedad, esquema `respaldos`, forma de la tabla de respaldo si ya existe, y
  médicos con consultorios activos sin predeterminado, que harían abortar el
  disparador de existencia). Rejilla final de 8 filas. Idempotente: la segunda
  pasada es `INSERT 0 0` y `UPDATE 0`.
- **El horario efectivo no cambia para ninguna fila**: con `horario_propio =
  false`, `horarioEfectivo()` ya daba el de la clínica, normalizado igual. Lo
  que cambia es que, desde aquí, tocar el horario de la clínica no mueve el de
  ningún consultorio.
- **Clínicas con el interruptor apagado:** reciben la copia igual (es la opción
  que menos cambia: al encender la v2 ya tienen su horario de partida). No ven
  nada distinto: con la v2 apagada ningún código lee `horario_propio` ni
  `consultorios.horario` (sólo `horarioEfectivo`, la reserva por enlace, la
  configuración y la rejilla v2, las cuatro detrás de `agendaV2Encendida`).
  Comprobado con grep.
- `clinicas.horario_consulta` no se borra ni se cambia (contrato con
  spinus-consola). Queda como respaldo de los consultorios NUEVOS, que nacen con
  `horario_propio = false` y siguen heredándolo por `horarioEfectivo` hasta
  que su médico ponga el suyo. El COMMENT de `horario_propio` lo dice.
- Auditoría en `audit_log`: el disparador `audit_consultorios` deja una fila
  UPDATE por consultorio (usuario `system`).

**Punto 11 · la fuente única (`src/lib/agenda/horarioRejilla.ts`, reescrito)**

- `consultoriosDeLaRejilla`: «Todos los médicos» → todos los consultorios
  activos que la agenda puede enseñar; un médico concreto → la unión de los
  suyos; si ese médico es quien mira y tiene consultorio activo en el menú
  lateral → sólo ése. **Decisión sin preguntar:** el consultorio activo sólo
  cuenta cuando la rejilla enseña a SU médico (con «Todos» manda la unión de
  todos, como pide el punto 11), y sólo si quien mira es médico (la secretaria
  no tiene selector; su «consultorio activo» es el predeterminado de algún
  médico y antes se colaba en la rejilla).
- `fuenteDeLaRejilla` devuelve `horario` (un tramo por día, de la apertura más
  temprana al cierre más tardío, en la hora del dispositivo) y `businessHours`
  (un tramo por consultorio y día, para que el gris respete el hueco entre dos
  consultorios). Lo leen: ventana (`slotMinTime/slotMaxTime`), «Compactar»
  (ventana y días plegados), la hora a la que abre la vista, el día hábil del
  Mes y el panel de huecos (`horario`); el gris (`businessHours`).
  Apagada: `config?.horario ?? HORARIO_DEFAULT`, el MISMO objeto, y
  `businessHours: null` (la agenda lo deriva como siempre). Con la v2, la misma
  salida para la misma entrada (la última se guarda por su contenido), así que
  FullCalendar no re-refina nada al recalcular con arrays nuevos e iguales.
- **De dónde salen los consultorios:** con la v2, `agenda/page.tsx` los lee en
  el servidor (`consultoriosAgendaServidor.ts`) con el cliente de servicio,
  **filtrado por `clinica_id` y por el alcance de `appointments_select`**
  (administrador y secretaria: los de la clínica; médico invitado: sólo los
  suyos), sólo `id, medico_id, timezone, horario, horario_propio, activo`. Hace
  falta porque la RLS de `consultorios` no le enseña al administrador los de
  los otros médicos, y con «Todos» la rejilla va de la apertura más temprana a
  la más tardía de TODOS. Tercera excepción anotada a «sólo cliente de
  sesión», del mismo tipo que `preparacionServidor.ts`. Mientras llega (o si
  falla: también si falta la columna de B5), los de la sesión
  (`config.consultorios`), que es lo de T2.
- **La hora a la que abre la vista:** `scrollTime` sólo se lee al montar, y el
  interruptor llega después; con la v2, UNA vez, en el primer render con el
  interruptor encendido, si la apertura ya no es la del montaje se lleva la
  rejilla allí (`scrollToTime`). Después, filtrar o cambiar de consultorio no
  mueve el scroll (como siempre). Apagada no corre.
- **El aviso de fuera de horario** (`crearAvisosHorario`): se compara contra el
  consultorio de la cita, en SU hora (arrastre y redimensionado: el
  `consultorio_id` del evento; formulario: el consultorio elegido —cierra
  AG-DT-33—; burbuja: el de los datos que guarda). Sin consultorio todavía
  (pulsar un hueco), contra los de la rejilla: no avisa si cabe en alguno. Una
  cita sin consultorio pero con médico (un evento), contra los de su médico.
  Apagada, los avisos de siempre al bit. **Texto:** con la v2 dice «este
  consultorio atiende…» en vez de «esta clínica atiende…», y si la hora del
  consultorio no es la del dispositivo, la lleva con su zona: «Vas a moverlo a
  las 11:00 hora Baja California, y este consultorio atiende de 09:00 a 11:00.
  ¿Es correcto?» (la misma forma que la etiqueta de la tarjeta).
- **Lo que NO cambia:** la densidad compacta (no depende del horario); el
  enlace de reserva (ya usaba el consultorio que elige el paciente, B5/D); con
  la v2 apagada, la agenda, el `HorarioModal` y los avisos.

**Presupuesto de A (punto 12)** — `playwright.medicion.config.ts`, protocolo de
siempre (cada corrida resiembra), misma máquina, mismo día, base = `dd634b9`
compilada en el mismo worktree. Dos series: 5 + 5 corridas secuenciales y 3 + 3
INTERCALADAS (base y G4 alternando el `.next` servido), con la v2 apagada y
encendida en la Clínica Semilla A.

| Medida (mediana de 40 muestras: 8 corridas × 5) | base apagada | G4 apagada | base encendida | G4 encendida |
|---|---|---|---|---|
| Apertura en frío (ms) | 261.5 | 265.5 | 263.5 | 270.5 |
| Red limitada (ms) | 755.0 | 756.5 | 754.5 | 754.5 |
| Semana siguiente (ms) | 61.0 | 63.0 | 67.0 | 66.0 |
| Semana anterior (ms) | 59.0 | 61.0 | 63.0 | 64.0 |
| Semana ya vista (ms) | 52.0 | 53.0 | 53.0 | 53.0 |
| Tras precarga (ms) | 51.5 | 51.0 | 57.0 | 56.0 |
| Volver del dashboard (ms) | 72.5 | 73.0 | 73.0 | 75.0 |
| Validaciones contra Auth (máx.) | 2 | 2 | 4 | 15 |
| Peticiones bloqueantes al volver (máx.) | 0 | 0 | 0 | 0 |
| JS transferido (bytes) | 542 645 | 544 202 | 564 356 | 565 925 |

- Validaciones contra Auth: la mediana es 2 (apagada) y 4 (encendida) en las
  dos; el 15 es UNA muestra de una corrida de G4 con la v2 encendida, contada
  del lado del servidor en los registros de Auth, que comparte la base con los
  otros agentes (el navegador contó 0): ruido ajeno, no de G4.
- Apertura en frío: en las series INTERCALADAS (la comparación controlada, 15
  muestras por lado) es igual: 265 / 265 apagada y 269 / 269 encendida. En las
  secuenciales sale +4 / +7 ms, con las corridas de G4 hechas ~1 h después que
  las de la base; la deriva entre series de la MISMA base fue de ese tamaño
  (medianas de serie 257–273). Lo marco como ruido, con este aviso.
- JS: +1 557 bytes (la fuente única y los avisos viajan con la agenda).
- **A1-bis** (`e2e/playwright.a1bis.config.ts`, build instrumentado, base y G4,
  v2 apagada y encendida): `refinadosConCambio = 0` en abrir, navegar, tiempo
  real, modal y guardar, igual que la base; el 1 de `e0_preparar_arrastre` y
  `e_arrastre` (`slotMinTime`, toolbar) está igual en la base. Renders de la
  agenda al abrir: 5 (apagada) y 7 (encendida), los mismos que la base. Reposo:
  0 renders, 0 peticiones.

**Punto 19 · husos**

- La rejilla sigue en la hora del dispositivo (FullCalendar sin `timeZone`; ver
  la cabecera de `ventanaRejilla.ts`). El gris de un consultorio en otra zona se
  calcula en SU hora y se convierte con el desfase medido al mediodía del
  primer día visible: con Tijuana 09–11, en un dispositivo de Mérida se ve
  blanco de 11:00 a 13:00 en noviembre y de 10:00 a 12:00 en julio. Un tramo
  que la conversión lleva más allá de medianoche se parte en los dos días.
- La etiqueta «09:00 hora Baja California» de la tarjeta en la rejilla se
  conserva (no se tocó `renderEventContent`) y queda cubierta por una e2e.

**Decisiones sin preguntar (resumen)**

1. El consultorio activo sólo manda con la rejilla de SU médico y si quien mira
   es médico (ver arriba).
2. Con «Todos», el gris es la unión real (respeta huecos entre consultorios),
   pero la ventana, «Compactar» y el panel de huecos usan un tramo por día (de
   la apertura más temprana al cierre más tardío), como dice el punto 11. Por
   eso el panel de huecos, con varios consultorios con hueco entre ellos, puede
   ofrecer como libre una hora gris (deuda abajo). Con un consultorio (activo o
   el único del médico) es exacto.
3. El aviso de un alta sin consultorio todavía no salta si la hora cabe en
   alguno de los consultorios de la rejilla (el blanco de la rejilla).
4. Texto del aviso con la v2: «este consultorio» y la zona si difiere.
5. La migración copia también a los consultorios archivados y a las clínicas
   con la v2 apagada (inocuo; los deja listos).
6. Respaldo dentro de la migración, en `respaldos.*` (no sólo como instrucción
   en la cabecera), porque el valor previo de `consultorios.horario` se pisa.
7. **Rendimiento (encontrado al medir, arreglado):** con la v2 encendida, la
   primera versión empeoraba la apertura en frío (266 contra 260 ms), la red
   limitada (762 contra 755) y volver del dashboard (81 contra 77). Causa: al
   leerse el interruptor, `horario` y `businessHours` pasaban del objeto de la
   clínica a uno nuevo con el MISMO contenido (los consultorios de la semilla,
   como todos los recién migrados, tienen el horario de la clínica), así que
   FullCalendar re-refinaba `businessHours` y `dayHeaderContent` y repintaba la
   rejilla; además los consultorios del servidor escribían estado también con la
   v2 apagada. Arreglo: si los consultorios dicen exactamente lo de la clínica,
   la fuente devuelve EL MISMO objeto de la clínica y `businessHours: null`; y
   los consultorios del servidor sólo escriben estado con la v2 encendida, en un
   render. Tras el arreglo, ver la tabla del informe.
8. Hallazgos del revisor (sonnet), atendidos: (a) la corrección de la hora de
   apertura podía gastarse con el horario provisional antes de que llegaran los
   consultorios del servidor → ahora espera a que contesten
   (`corregirApertura = agendaV2 && consultoriosListos`); (b) la caché de
   identidad estaba a nivel de módulo en un archivo que corre también en el
   servidor → ahora la salida anterior la guarda `AgendaCliente` en un `ref` y
   se pasa como `previa` (función pura).
9. El rótulo del botón «Compactar la rejilla al horario de la clínica» NO se
   cambió (lo pintan la cabecera y la banda del teléfono, que tocan G2/G3).
   *Cambiado en la integración: con la v2, «…al horario de los consultorios».*

#### Integración de G1–G4 (decisiones sin preguntar)

- **El ajuste al turno (G2) lee los consultorios de la rejilla (G4).** G4
  retiró `consultorioDeLaRejilla`; `useAjusteTurno` recibe ahora los mismos
  `consultoriosV2` (los del servidor, `consultoriosAgendaServidor.ts`, o los
  de la sesión mientras llegan) y la misma `seleccion`
  (`consultoriosDeLaRejilla`). En un clic se ajusta sólo con un médico a la
  vista y UN consultorio en la selección (su activo o el único que tiene);
  con varios o con «Todos», no. Al arrastrar, el consultorio de la cita.
  Consecuencia: **el administrador también ajusta el arrastre de la cita de
  otro médico** (antes no, porque la RLS de `consultorios` no le enseñaba los
  de los demás); cierra esa deuda de G2. Sin zona en el consultorio, no se
  ajusta.
- **«Reagendar cita» (G3) no se ajusta al turno**: abre el alta con la hora de
  la original (o la misma hora hoy), que cuenta como hora elegida, como la
  escrita a mano.
- **El correo de confirmación (G3) con la plantilla de G1, sin las palabras
  del recordatorio.** El cuerpo es el del recordatorio (`correoDeCita`) con
  sus propias palabras (`PalabrasCorreo`): título «Confirma tu cita» (o «Tu
  cita» si ya está confirmada) y el asunto de G3. El recordatorio sigue
  diciendo «Recordatorio de tu cita». Ninguno de los dos dice «es mañana».
- **«Compactar» dice «al horario de los consultorios» con la v2**
  (`etiquetaCompactar(vista, agendaV2)`); apagada, «al horario de la
  clínica», como siempre.
- **Punto 5 de Angel · la reserva sólo ofrece los tipos del consultorio
  elegido.** `page.tsx` los calcula en el servidor con `tiposDelConsultorio`
  (la regla de /turnos y del POST) y manda `tiposPorConsultorio`, sin
  `principal` ni `consultorio_id`. Con uno solo no hay selector; al cambiar
  de consultorio, el tipo elegido se reinicia si no vale en el nuevo (con uno
  solo, queda ése). **Un consultorio sin ningún tipo que valga no se ofrece**
  (su /turnos daría 400) y, si no queda ninguno, la página es la de «no
  disponible»: lo que menos cambia frente a un 400 a mitad de la reserva.
- **El arrastre del administrador sobre la cita de otro médico se ajusta** a
  la rejilla de ESE médico (consecuencia del primer punto; e2e nueva en
  `agenda-g2-turnos`, en rojo con los consultorios de la sesión).
- **Presupuesto de A: «volver del dashboard» empeoraba con la v2 (72 → 81 ms) y
  la apertura en frío algo menos; encontrado y arreglado.** Bisección por
  fusiones con una sonda de 12–16 vueltas: la base y G4 daban 72–73 ms; G2,
  74 (la petición de los tipos del ajuste al turno al montar); con G3, 81.
  Causa (comprobada quitando sólo eso: 73 ms): G3 pasó el interruptor como
  argumento de `renderEventContent`, dentro de `renderEC`, y `agendaV2` es
  `false` hasta que la promesa del servidor resuelve; al leerse, cambiaba la
  función `eventContent` de FullCalendar y FullCalendar repintaba TODAS las
  citas. Arreglo: las cajas leen el interruptor de un almacén mínimo en
  `MemoizedEventContent.tsx` (`fijarSinAvisoFlotante` /
  `useSinAvisoFlotante`, `useSyncExternalStore`), que fija `AgendaCliente` al
  leerlo y devuelve a `false` al desmontarse; `renderEC` ya no depende de él.
  Al cambiar sólo se repintan las cajas memorizadas. **Y una validación más
  contra Auth al abrir (4 → 5 con la v2):** el ajuste al turno de G2 pedía sus
  tipos a `GET /api/agenda/tipos-cita` al montar. Ahora los lee la página en el
  servidor (`leerTiposAjuste` de `agenda/page.tsx`: cliente de sesión, RLS,
  clínica explícita, sólo con la v2) y viajan como promesa, como la semilla. **Decisión sin
  preguntar que toca el Protocolo 4** (es un mecanismo nuevo, aunque de un
  solo uso y en un solo archivo): la alternativa sin él era devolver el
  `title` con la v2 hasta el primer repintado natural, que contradice el
  punto 16. Sigue en rojo `agenda-f-pasar-raton` «punto 16» sin
  `fijarSinAvisoFlotante`. Cifras en §9.
- **Cuatro pruebas que fallaban a ratos, hechas deterministas** (ninguna era
  el código de la tanda):
  - `reserva-candado` «ya_tiene_cita» (`verificar 400`): **era la prueba.**
    `e2e/mailpit.ts` ordenaba los correos por el texto de `Created`, y Mailpit
    recorta los ceros de los milisegundos («…26.5Z», «…26.53Z»): dos correos
    del mismo segundo salían al revés y se canjeaba el código viejo (400
    `codigo_incorrecto`). Ahora ordena por instante (`masRecientesPrimero`;
    `mailpitOrden.test.ts`, en rojo con el orden por texto).
  - `husos-dos-consultorios` «la dibuja a las 11:00» (43 px): **era la
    prueba**, sobre un salto que sí es del código pero anterior a la tanda.
    Hacia los 530 ms se montan las herramientas v2 de la barra y la barra pasa
    de 61 a 105 px: toda la rejilla baja 44 px (medido igual en la base
    `dd634b9`). La prueba medía la fila y la tarjeta en dos viajes; ahora
    espera la barra completa y mide las dos en el mismo cuadro. El salto queda
    en deuda (AG-DT-68).
  - `agenda-f-pulido` F1.8: **era la prueba.** Dependía de que la semilla (al
    azar) dejara una cita confirmada del Dr. Admin en la semana visible; ahora
    pone la suya y la borra. En rojo la versión anterior sin confirmadas esa
    semana; en verde la nueva.
  - `agenda-g3-tarjeta` «agendada» (1,46 px, visto en la batería de la
    integración): **era la prueba.** Medía anchos mientras la tarjeta entraba
    con `scale(.97)`; ahora espera a que termine la entrada.

### Tanda H (2026-11-15)

Angel mandó el 2026-11-15, tras probar a mano la tanda G, veintitrés puntos,
repartidos en cinco ramas (`feature/agenda-v2-h1` a `-h5`, worktrees
`-agenda-b56`, `-agenda-menores`, `-agenda-t3`, `-agenda-t4` y `-agenda-t5`)
e integrados en `feature/agenda-v2` el mismo día, en el orden H5, H2, H4, H3,
H1. **Tres migraciones nuevas** (el conjunto pasa de 29 a **32**: las 5 de
`main` y 27 del proyecto): `20261120120000` y `20261120121000` (H2) y
`20261120130000` (H5). Reglas de Angel para toda la tanda: sin dependencias
nuevas; nada clínico en pantalla pública ni en correos; la seguridad y los
límites de las rutas públicas no cambian; el texto del aviso de privacidad
sigue pendiente de su revisión legal; lo nuevo va detrás del interruptor; no
se pierde ninguna función; una prueba por cambio, comprobada en rojo con su
mutación; la batería completa de navegador, una sola vez y al integrar;
migraciones al final del conjunto, con su auditoría. Ninguna policy nueva ni
cambiada; ninguna regla de seguridad de `CLAUDE.md` tocada.

**Decisiones de Angel durante la tanda (no volver a preguntar):**

1. **Punto 21: «AG-DT-63 se queda como está».** El 409 `nota_ligada` sigue
   diciéndole a la secretaria que la cita atendida tiene nota (nunca el
   contenido). Cierra la decisión abierta de la tanda G.
2. Ya decididas antes y que siguen: AG-DT-28 se queda; «Compactar» al abrir,
   apagado; el enlace de reserva por médico vive en la configuración.

**Pendientes de Angel (se tomó lo que menos cambia; se cambian sin tocar nada
más):**

- **H5 · mover una atendida con nota se cierra sólo con la v2 encendida**; el
  cambio de estado y el borrado, siempre (v2 encendida y apagada). Angel pidió
  «no se pueda mover», sin condición. H5 lo dejó así porque con la v2 apagada la
  app deja arrastrar una atendida, y la regla de tolerancia («apagada, como
  hoy») no deja que la base rompa lo que la pantalla hace. Si Angel lo quiere
  sin condición: quitar de `cita_proteger_atendida()` la condición
  `NOT EXISTS (… agenda_v2_encendida …)` de la rama de mover (migración nueva) y, para que la pantalla no
  ofrezca un arrastre que la base rechaza, aplicar `vetoPorEstado` también con
  la v2 apagada.
- **H1 · hoy el enlace de un solo uso TAMBIÉN exige correo**: `ReservarSchema`
  (≥ 3 caracteres) y `reservar_por_enlace` (`p_correo` con «@») lo piden, sin
  verificarlo. Así que «quien no tiene correo se atiende con un enlace de un
  solo uso» no funciona hoy: el paciente tendría que escribir uno cualquiera.
  Permitirlo cambiaría la validación de una ruta pública y la RPC, y la regla
  de la tanda es no cambiar la seguridad de las rutas públicas. Haría falta:
  el esquema y la ruta de `POST /api/reservar/[codigo]` (correo opcional sólo
  en la clase `unico`), una migración de `reservar_por_enlace` (sin correo en
  el único) y revisar lo que cuelga del correo: el candado (que hoy decide por
  el correo verificado), el comprobante y el recordatorio (no saldrían) (AG-DT-70).
- **Integración · el horario de cada consultorio tras «Restablecer»** (abajo,
  «Integración de la tanda H»): el de la clínica, COPIADO y como horario propio.
- Los textos nuevos de cara al paciente y a la clínica (explicaciones de los
  ajustes, diálogo de «Restablecer», leyenda de «Por confirmar», registro
  rápido) siguen PENDIENTES DE REVISIÓN.

**Punto 12 (la burbuja se cerraba tras registrar):** sólo se reprodujo con
DOBLE CLIC (o un segundo clic en «¿lo tomó?»), nunca con un clic simple en
ninguna de las variantes probadas (H3, abajo). Si Angel lo ve con un solo clic,
hay otra causa que no se encontró.

#### H1 · volver, siempre en claro, «Lugar» y el correo (puntos 1 a 4)

- **Punto 2 · siempre en claro.** Fuera el `@media (prefers-color-scheme: dark)` de G1. El oscuro
  también podía llegar por `html.dark` colgada (el médico abre su enlace desde la app sin recargar:
  misma raíz de documento), así que `agendaPublica.css` redeclara en `body:has(.rp)` con el valor del
  `:root` de globals.css cada `--ag-*` que usan la hoja y los `.tsx` públicos y que `html.dark` cambia
  (28 hoy), y pone `color-scheme: light` en `html:has(.rp)` y en el cuerpo. No se tocó globals.css. El
  navy va literal (#163250, el de fábrica). Las dos páginas exportan `viewport = { colorScheme:
  'light', themeColor: '#163250' }` (la barra del navegador ya no se pone en el navy oscuro con el
  sistema en oscuro; `viewportFit: 'cover'` del layout se conserva: Next fusiona clave a clave). La
  prueba de G1 (`agendaPublicaTokens.test.ts`) exigía lo contrario y se reescribió.
- **Correos en claro.** `htmlCorreoCita` lleva `<meta name="color-scheme" content="light">` (ya estaba),
  `<meta name="supported-color-schemes" content="light">`, `:root{color-scheme:light;
  supported-color-schemes:light}` y `color-scheme:light` en el `body`; ninguna regla oscura. **Límite:**
  Gmail (Android/iOS) y Outlook invierten o atenúan colores en su modo oscuro sin preguntar; eso no se
  puede impedir desde el HTML. Las metas sólo mandan donde se respetan (Apple Mail / correo de iOS).
- **Punto 3 · «Lugar».** El paso 1 se llama «Lugar» y la página SIEMPRE empieza ahí. **Revisa la
  decisión de G1** (con un consultorio y un tipo arrancaba en «Día y hora»): Angel pide que el
  consultorio y su dirección «aparezcan igual, ya elegidos», así que se muestra la MISMA tarjeta con
  radio que con varios, marcada, y «Elegir día y hora» listo para pulsar. Cuesta un toque más; a cambio
  la persona ve dónde es antes de elegir hora. Los títulos internos del paso («¿Dónde quieres tu
  cita?» / «¿Qué necesitas y dónde?») no cambiaron. Con un solo tipo, sin selector (regla de la
  integración G).
- **Punto 1 · «Volver».** Botón secundario con borde (`rp-btn rp-btn--sec`, 50 px) en el PIE de «Día y
  hora», «Tus datos» y el código, en la misma fila que el principal (`.rp-pie__fila`: «Volver» toma lo
  que mide y el principal el resto). En el pie y no arriba: en el teléfono el pie va pegado abajo, así
  que «Volver» está siempre a la vista; arriba se iba con el desplazamiento. Fuera el enlace
  `.rp-atras`. «Listo» no tiene «Volver» (la cita ya existe).
- **Lo que se conserva al volver:** consultorio, tipo, semana, día y hora (ya se conservaban) y lo
  escrito en «Tus datos» aunque no se haya enviado (`borrador` en `useReserva`). **La casilla del aviso
  vuelve desmarcada a propósito**: es el consentimiento y se da al enviar (D5); lo que menos cambia. El
  código de 6 dígitos tecleado no se conserva: al volver a «Tus datos» sólo se avanza pidiendo otro.
- **Horario perdido al volver:** si el horario elegido ya no está entre los libres de SU semana
  (`turnoYaNoEsta`), se suelta y se avisa con el texto de `turno_invalido` («Ese horario ya no está
  disponible. Elige otro.»); los datos siguen. Si la persona cambió de semana, no se avisa (lo resuelve
  el cambio de día, como antes).
- **Punto 4 · correo obligatorio: sin cambios.** Fijo: sin correo 400; con correo sin la ficha del
  código, 403 `correo_sin_verificar`. **Hallazgo para Angel:** el enlace de un solo uso HOY también
  pide un correo (con forma, sin verificar): 400 sin él, en el esquema (`ReservarSchema`, ≥ 3) y en la
  base (`reservar_por_enlace`: `p_correo` con «@»). O sea, «quien no tiene correo se atiende con un
  enlace de un solo uso» no es cierto hoy: el paciente tendría que escribir uno cualquiera. No se tocó;
  la e2e fija lo que hay. Si Angel quiere el único sin correo, es esquema + ruta + migración de la RPC
  (y revisar candado, comprobante y recordatorio, que cuelgan del correo).

#### H2 · configuración de la agenda: pestañas, enlaces plegados, botones, plazos, recordatorio y reinicio

- **Punto 5 · pestañas.** `MenuConfiguracion.tsx` deja de ser un menú de anclas y pasa a ser un `tablist` (patrón
  «Tabs» de la WAI-ARIA APG, activación automática): `role="tab"`, `aria-selected`, `aria-controls`, foco itinerante,
  flechas en los dos ejes (con vuelta), Inicio y Fin. Escritorio: columna a la izquierda (15 rem); teléfono: fila que
  se desplaza de lado sin envolver, la elegida se trae a la vista. Pestañas: Primeros pasos (sólo si falta algo, con
  «N pendientes») · Horario y disponibilidad · Duración y tipos de cita · Enlaces de reserva · Plazos y recordatorios ·
  Contactos bloqueados · Este dispositivo · Restablecer (sólo el administrador). Abre en «Primeros pasos» mientras
  falte algo; si no, en la primera. **Decisión sin preguntar:** mientras al médico no le llega la lista de enlaces
  (de la que salen los pasos), no se elige ninguna pestaña y se lee «Cargando…» (un instante), para no enseñar otra
  sección y saltar a «Primeros pasos» después. Todos los paneles se montan y sólo se ve el elegido (`hidden`): cambiar
  de pestaña no pierde lo escrito. Los enlaces internos `#config-…` («Abrir horario», «Revisar», «Ir a la
  disponibilidad») cambian de pestaña. Desaparecen los rótulos de grupo («Citas», «Reserva por enlace»…): la pestaña
  ya es el rótulo. La nota de «Este dispositivo» pasa a la ayuda de su tarjeta.
- **Punto 6 · enlaces plegados.** A la vista: la ficha propia («(tú)», primero) y, si quien mira no tiene ficha
  propia (la secretaria), las de los médicos administradores; plegadas bajo «Enlaces de los demás médicos (N)» (botón
  con `aria-expanded`, cerrado al abrir la pantalla), las de los médicos invitados. **Decisión sin preguntar:** la
  secretaria ve abierta la del administrador (el punto habla de los invitados). Los administradores los lee la página
  en el servidor con el cliente de sesión (`profiles` de la clínica, como el agregado de configuración); si la lectura
  falla, lista vacía: todo plegado salvo lo propio.
- **Punto 7 · botones en reposo.** Tokens nuevos `--ag-control-bg`, `--ag-control-bg-hover`, `--ag-control-border` y
  `--ag-control-primario-border` (claro y `html.dark`, en `globals.css`). Los tres botones de `clasesConfig.ts` llevan
  SIEMPRE borde y fondo; el borde da ≥ 3:1 (WCAG 1.4.11) contra el blanco de la tarjeta, el azul de «Primeros pasos» y
  el ámbar del aviso en claro (#76849a: 3,35–3,79:1) y contra la tarjeta oscura (#7388a6: 3,46–4,91:1); el primario
  lleva borde claro en oscuro porque #1e5fa8 sobre #1b2a40 da 2,2:1. También los radios con aspecto de botón de la
  duración. Los tres botones que se veían como enlace («Ver qué falta», «Poner tu propia duración…», «Crear el enlace
  igualmente» con fondo de tarjeta) pasan a ser botones. Un enlace dentro de una frase («Mi perfil») sigue siendo
  enlace. Nuevo `BOTON_PELIGRO` (rojo de «cancelada»). **No se tocaron** `ConfirmModal` ni `HorarioModal` (los abre la
  configuración, pero son de la agenda entera): su «Cancelar» sigue siendo texto gris → deuda.
- **Punto 8 · una línea por ajuste.** `EXPLICACION_AJUSTES_AGENDA` (`ajustesAgenda.ts`), pintada bajo cada etiqueta y
  ligada al campo con `aria-describedby`. La del recordatorio: «El recordatorio es un correo que Spinus manda al
  paciente antes de su cita; aquí eliges cuántas horas antes.» Textos PENDIENTES DE REVISIÓN de Angel.
- **Punto 9 · recordatorio apagado de fábrica.** Columna nueva `agenda_ajustes.recordatorio_encendido boolean NOT NULL
  DEFAULT false`. La tarea llama a una función NUEVA, `cita_recordatorios_pendientes` (= la de E4 + `AND
  j.recordatorio_encendido` en la consulta que elige a las clínicas). **Por qué nueva y no un CREATE OR REPLACE de la
  de E4:** sin la migración la función no existe (PGRST202), la tarea lo trata como «no disponible» y no manda nada:
  el «apagado de fábrica» también con la columna ausente (producción sin la migración). Cambiar la de E4 en su sitio
  dejaría mandando a una base sin la migración. `cita_correos_pendientes` (E4) queda sin llamadores (deuda).
  `cita_correo_tomar` NO cambia: el comprobante y la confirmación manual no dependen del interruptor. Lo cambia quien
  cambia los plazos (el administrador; la policy de UPDATE de B1 es por fila y el disparador `proteger_agenda_ajustes`
  no protege la columna nueva: **ninguna policy nueva ni cambiada**). Se guarda al pulsarlo (`PATCH
  /api/me/ajustes-agenda`, `strictObject` con sólo `recordatorio_encendido`; sin la columna, 503), no con «Guardar
  ajustes». Texto: «Si lo enciendes, se enviará un correo a cada paciente con correo registrado, N horas antes de su
  cita. Apagado (como viene de fábrica), no se envía ninguno.» + «No cambia los demás correos…». **Consecuencia en
  producción (anotada, es lo que pidió Angel):** toda clínica, también las que ya tengan la v2 encendida, queda con el
  recordatorio apagado hasta que su administrador lo encienda. Sin backfill.
- **Punto 10 · restablecer.** UNA función `agenda_restablecer_configuracion(p_clinica_id, p_actor)` (INVOKER, sólo
  `service_role`: revoke de PUBLIC, anon, authenticated) llamada por `POST /api/agenda/restablecer`: `entradaGestion()`
  (sesión, clínica, v2) → `canManageClinica` (403 a secretaria e invitado) → cuerpo `{confirmacion:'RESTABLECER'}`
  estricto → `createAdminClient().rpc` con la clínica y el actor DE LA SESIÓN. La función vuelve a comprobar que el
  actor administra esa clínica (primero, aunque esté apagada), bloquea la fila de ajustes, respalda en `audit_log` el
  horario de cada consultorio ('agenda_horario_restablecido', una fila por consultorio con el jsonb de antes), y luego:
  consultorios (activos y archivados) a su DEFAULT de columna (`horario` todo cerrado, `horario_propio` false);
  `tipos_cita` activos → archivados (nada se borra); enlaces de reserva VIGENTES → revocados a nombre del
  administrador (el mismo UPDATE que «Revocar», que `proteger_reserva_enlaces` deja a service_role); los cuatro plazos y
  el recordatorio a su DEFAULT; una fila 'agenda_configuracion_restablecida'. No toca citas, pacientes, auditoría,
  contactos bloqueados, confirmaciones, correos de cita, Google, `clinicas` ni el interruptor/candado.
  **No hizo falta ninguna policy nueva ni cambiar una** (no me detuve en el punto 10).
- **Punto 10 · el «valor de fábrica» del horario de un consultorio:** el DEFAULT de columna (todos los días cerrados)
  con `horario_propio = false`, que es EXACTAMENTE como nace un consultorio. Por qué: (1) es «como si nunca se hubiera
  configurado» al pie de la letra; (2) es lo que menos sorprende en la agenda: con `horario_propio = false` manda el
  horario de la clínica (`horarioEfectivo`), así que la rejilla y los avisos no se quedan en gris (con «todo cerrado y
  horario propio» la agenda entera saldría fuera de horario y cada alta avisaría); (3) no inventa un horario
  (`HORARIO_DEFAULT` del código sería un lunes–viernes 09–19 que nadie eligió). Para que «Primeros pasos» quede en el
  paso 1, **la regla del paso 1 cambia un poco (decisión sin preguntar):** además de lo de antes, queda PENDIENTE si
  algún consultorio activo del médico está «como nace» (sin horario propio y su `horario` todo cerrado). Los de la
  semilla y los creados con su horario NO están así (no cambia nada para ellos); tras el reinicio, sí. El cambio es
  sólo de la tarjeta (`pasosDe`); la regla pública de apertura (`motivosApertura`) no se toca.
  *(Superado en la integración: el reinicio deja el horario de partida de la v2, el de la clínica copiado como
  horario propio; ver «Integración de la tanda H». La regla de `pasosDe` se queda para los consultorios que nacen sin
  horario.)*
- **Auditoría independiente (sonnet):** H2a APTA; H2b APTA CON CAMBIOS, aplicados: respaldo del horario en audit_log
  y la comprobación de administrador antes del interruptor.
- **Revisión independiente del código (sonnet):** sin hallazgos en seguridad, permisos, tolerancia a migraciones ausentes ni pestañas. Sus seis «regresiones» eran las mutaciones de prueba aplicadas mientras leía (comprobado: el árbol final no las tiene; vitest 1884 verde).

#### H3 · «Registrar» en verde, el escudo tras el registro, el teléfono y las observaciones (puntos 11 a 14)

**Punto 11 · «Registrar «…»» en verde.** El verde es el token de éxito de la agenda,
`--ag-success-text` (texto y línea de debajo) y `--ag-success-bg` (fondo al señalarla con el
teclado o el ratón), no un hex nuevo. Es el equivalente en la agenda del esmeralda del
«Registrar "…"» del formulario completo. AA: claro 5.15:1 en reposo y 4.60:1 señalada (justo
por encima de 4.5: si alguien retoca esos hex, la e2e lo detecta); oscuro 10:1 y 7.9:1.
La maqueta pintaba esta opción en azul de marca: manda Angel (verde).

**Punto 12 · la burbuja se cerraba tras registrar.** Causa raíz, reproducida en e2e:
`QuickPatientModal` se pinta centrado SOBRE la rejilla y el alta del paciente responde en
~50 ms en local, así que el modal desaparece entre los dos clics de un doble clic sobre
«Crear y continuar» (o antes de un segundo clic de «¿lo tomó?»), y con «Cancelar», que
cierra al instante, igual. El segundo clic cae en una franja: para la burbuja es «tocar
fuera» (se cierra) y para FullCalendar un clic en la franja (abre OTRA burbuja, a otra hora
y con el paciente vacío). Es exactamente «hay que volver a elegir el horario y teclear el
nombre». Con un clic simple NO se reproduce en ninguna de las variantes probadas (admin,
médico invitado, secretaria, arrastre, celda del Mes, tableta táctil, teclado, enlace del
aviso de privacidad con cambio de pestaña, tiempo real con el modal abierto, esperas de 10 s,
pulsar Guardar después): si Angel ve el cierre con un solo clic, hay otra causa que no se
encontró. Arreglo (`useEscudoTrasRegistro` en `BurbujaAlta.tsx`): mientras el modal está
abierto se apunta el último punto pulsado; al cerrarse (creado o cancelado), durante 600 ms
(más que el doble clic por omisión de los sistemas, 500 ms) se tragan en captura los eventos
del clic a menos de 24 px de ese punto y fuera de un diálogo, y el «tocar fuera» sigue
pausado. Un clic en otro sitio pasa (la barra, otra cita). Cada cierre reinicia la gracia.
Se descartó la otra opción (dejar el velo del modal unos milisegundos tras cerrar) porque
`QuickPatientModal` es compartido por toda la app. Decisión sin regla previa: 600 ms y 24 px.

**Punto 13 · teléfono en el registro rápido.** Sin migración: `POST /api/pacientes` ya pasaba
`telefono` a `crear_paciente_con_medico_v2`, que ya lo insertaba; va por el mismo camino que
el correo. Formato y validación, los de la ficha (`formatearTelefono`, `validarTelefono`:
10 dígitos, se guarda «999 123 4567» como en `/pacientes/nuevo`); WhatsApp y la reserva
normalizan quitando lo que no es dígito. Consentimiento, duplicados, gate de secretaria,
puertas de suscripción y auditoría sin cambios. **Detrás del interruptor** con una prop,
`conTelefono` (por omisión `false`): la encienden la burbuja y «Convertir en cita» (sólo
existen con la v2) y el formulario de cita con `agendaV2`. Fuera de la agenda (Documentos) y
con la v2 apagada, el modal y el cuerpo de la petición son los de antes, byte a byte (lo que
menos cambia; la alternativa, en todos lados, saldría sin interruptor). Ninguno de los dos
campos es obligatorio. El teléfono de quien reservó NO se precarga al ligar (lista A,
punto 9, se respeta). Etiqueta: «Teléfono celular o WhatsApp»; leyenda debajo del correo y
el teléfono: «Sin teléfono ni correo no se podrán enviar confirmaciones ni recordatorios de
cita.».

**Punto 14 · observaciones en la burbuja.** «Añadir observaciones» plegado (enlace discreto con
«+»); abierto, un área de dos líneas que crece hasta seis (`field-sizing`, con caída a dos
líneas con desplazamiento donde el navegador no lo sabe). Va al mismo `appointments.notes`
que las «Notas» del formulario completo, y «Más opciones» lo lleva al formulario
(`ModalState` create `notas`). S1: no viaja a Google (la descripción es la fija de
`eventoParaGoogle`); comprobado contra el Google falso. Escape cierra la burbuja y pierde lo
escrito, como el resto de sus campos.

#### H4 · «Por confirmar» y los huecos de Día en turnos

- **Punto 15 · la lista sigue siendo la de E7.** Citas de MAÑANA en la zona de
  su consultorio, sólo `scheduled`, con paciente o por ligar, con hora y
  futuras. La ruta no cambió de criterio. `esDeManana` pasó de
  `whatsappServidor.ts` a `whatsappCita.ts` (puro) porque el navegador la
  vuelve a aplicar a lo que llega por tiempo real; se reexporta desde el
  servidor, así que nada de lo que la importaba cambió.
- **Punto 16 · la leyenda** «Estos pacientes están pendientes de confirmar su
  cita. Envía un recordatorio.» (texto literal de Angel) sale arriba de las
  filas **cuando hay alguna**. Con la lista vacía se queda «No hay citas de
  mañana sin confirmar.»: «estos pacientes» sin pacientes no se lee bien.
  Decisión sin preguntar.
- **Punto 17 · los medios de cada fila.** La ruta devuelve por fila
  `consultorio` (nombre), `con_whatsapp` y `con_correo` (en lugar de
  `tiene_telefono`): son **las MISMAS reglas** de los botones y de sus rutas
  (`motivoSinWhatsApp`, `motivoSinCorreo`), en booleanos. Ni el teléfono ni el
  correo viajan (Vitest lo comprueba); los botones los piden al pulsar. El
  correo se lee con un alias propio (`correo:pacientes(email)` y
  `reserva_correo`) para no tocar la forma compartida con el POST de
  WhatsApp (`SELECT_CITA_WHATSAPP`). Un teléfono que no es de México de 10
  dígitos cuenta como «sin WhatsApp» (antes salía el botón y el servidor lo
  rechazaba con su motivo): es la regla del botón.
  - Botones: «WhatsApp» (rótulo de E7/G3 conservado, `tipo:'recordatorio'`)
    y «Correo» (`BotonCorreoCita` con `compacto`, nombre accesible completo
    «Enviar confirmación por correo», el mismo `POST /api/agenda/correo` de
    G3: sale el correo de confirmación, uno por hora de inicio).
  - Sin ninguno: «Sin teléfono válido ni correo.» y «Marcar como
    confirmada», que es `cambiarEstadoCita(id, 'confirmed')`: el MISMO PUT
    que «Confirmar» de la tarjeta (firma de eco `client_id`, auditoría de
    `log_cita_change`, `vetoPorEstado`, la RLS de siempre). La fila sale al
    instante; si el servidor lo rechaza, la lista se recarga y vuelve.
    `cambiarEstadoCita` ahora devuelve si el servidor lo aceptó (los otros
    llamadores lo ignoran).
  - En la lista sólo van nombre (el título de la cita), hora, consultorio y los
    medios: nada clínico.
- **Punto 18 · tiempo real por el canal ÚNICO.** `useTiempoRealAgenda` gana
  `onCambioCita` (sólo con la v2): cada cambio del canal, ANTES del eco propio
  y de mirar la vista, se reduce a `CambioCita` y se pasa al panel por un
  `ref` de `AgendaCliente` (no estado: un cambio no vuelve a pintar la
  agenda). La regla pura `efectoEnPorConfirmar`
  (`src/lib/agenda/porConfirmarTiempoReal.ts`, la misma de la ruta):
  - una fila listada que ya no entra (confirmada a mano o por el paciente,
    cancelada, movida de día, borrada) **sale sin pedir nada**; si se canceló,
    además se recarga una vez (puede ser el paciente y entonces entra en
    «Canceladas por el paciente»);
  - una cita que entra y no está listada (nueva, reagendada para mañana,
    reabierta) o una listada que cambió de hora → **una** recarga (el cambio
    no trae nombre ni medios: los joins no viajan por Realtime), coalescida
    250 ms;
  - lo demás (el eco de Google de una listada, lo de otros días), nada.
  - Una recarga pedida con otra en vuelo se repite al terminar (la que estaba
    en vuelo pudo traer una fila que el canal ya quitó).
  - Comprobado: **un solo `phx_join`** del canal `appointments-realtime` con
    el panel montado y tras confirmar por `/confirmar` (e2e).
  - La confirmación del paciente por `/confirmar` cambia el estado en la base
    y llega por el mismo canal (no hace falta nada propio).
- **Punto 19 · el punto rojo.** Con canceladas por el paciente (48 h) o
  reservas empalmadas con Google, el contador rojo de siempre (con su número).
  Sin ellas y con pendientes de mañana, **un punto rojo sin número** (el número
  ya va en «Por confirmar (N)»; el punto es `aria-hidden` con `title`). Sin
  petición nueva: los datos son los de la petición que el panel ya hacía al
  montarse (en ocioso). Decisión sin preguntar: número sólo para lo de
  siempre, punto para los pendientes.
- **Punto 20 · los huecos de Día en turnos.** `turnosEnTramo`
  (`turnosAgenda.ts`) = `turnosDelDia` (LA rejilla fija del enlace, G2) con las
  citas vacías y sólo los turnos que caben ENTEROS en el hueco: lo libre ya lo
  dice el hueco, así que un turno tocado en parte no sale. La duración y la
  zona salen de lo mismo que el ajuste al turno (`useAjusteTurno`, ahora con
  `rejillaDelGesto`: el consultorio de un clic, `duracionDeConsulta` con
  `tiposDelConsultorio`, `horarioEfectivo`), en la zona del consultorio; las
  horas de los botones, en la del dispositivo (como el hueco y la rejilla).
  Cada turno es un botón «09:00» (nombre «Agendar a las 09:00 (45 min)») que
  llama a `abrirHueco` con el turno: `api.select()` → `handleSelect`, la
  misma puerta que el clic en un hueco; el ajuste de G2 lo deja donde está
  (ya está en la rejilla).
  - **Sin rejilla clara, el hueco de hoy** (un botón por tramo): «Todos los
    médicos» (la tarjeta de huecos ni sale, como hoy), un médico con varios
    consultorios en la rejilla, sin duración conocida (sin principal y con
    varios tipos) o mientras no llegan los tipos. Decisión sin preguntar: lo
    que menos cambia.
  - Un hueco en que no cabe ningún turno entero enseña su tramo y «No cabe un
    turno entero en este hueco.» (texto, no botón).
  - **La duración que propone la burbuja desde un turno sigue siendo la de
    siempre** (`DEFAULT_DURATION`, 60 min, decisión 19 de F), igual que el
    clic en la rejilla ya ajustado por G2: el punto pide «la hora exacta».
    Proponer la de la consulta es un cambio aparte para los dos caminos.
    *(Superado en la integración: el turno propone la duración de la
    consulta, ajuste (a) de abajo; el clic en la rejilla, sin cambio.)*
  - Los tipos viajan como promesa desde la página (G2); la tarjeta la guarda
    en SU estado (`Promise.resolve(tipos)`: la promesa de Flight es un
    «thenable» cuyo `then` no devuelve otra promesa; encadenar sobre ella daba
    `undefined` y el panel nunca partía los huecos — encontrado por la e2e).
  - Los huecos siguen con `HUECO_MINIMO` = 60: un tramo libre de 45 min entre
    dos citas no es hueco y no ofrece su turno (lo que menos cambia; ver
    deuda). *(Superado en la integración: con la duración conocida, el mínimo
    es esa duración, ajuste (b) de abajo.)*
- **Presupuesto de A:** ver la tabla de §9 (abajo, en el informe). Ninguna
  petición nueva al abrir; la de «Por confirmar» sigue siendo una.

#### H5 · la atendida con nota también en la base y las e2e del domingo (puntos 22 y 23)

##### Punto 22 · una atendida con nota tampoco se mueve ni cambia de estado por PostgREST (`20261120130000`)

- **Disparador `BEFORE UPDATE OF status, start_time, end_time, all_day OR DELETE`
  `WHEN (OLD.status = 'attended')`** `trg_appointments_proteger_atendida` →
  `cita_proteger_atendida()` (INVOKER, `search_path=''`). Lee sólo OLD/NEW, la fila
  de `agenda_ajustes` de la clínica (con los permisos de quien escribe, como seg2) y
  `cita_tiene_nota_ligada()`; nunca `appointments` (sin autorreferencia). Con nota
  ligada → 42501:
  - **cambiar `status`** (a cualquier otro): con la v2 encendida **y apagada**, como
    `vetoPorNotaLigada`;
  - **mover** (`start_time`, `end_time`, `all_day`): **sólo con la v2 encendida**,
    como `vetoPorEstado`. Decisión sin preguntar (la que menos cambia): con la v2
    apagada la app deja arrastrar una atendida, y la tolerancia («apagada, como
    hoy») no deja que la base lo rompa; por PostgREST no hay nada que la app no
    haga ya;
  - **borrar**: con la v2 encendida **y apagada**, como la API. Es lo que
    `cita_proteger_borrado` (seg2) dejaba abierto con la v2 apagada (AG-DT-61): la
    FK de la nota es `SET NULL` y la nota se quedaba sin cita.
- **Columnas congeladas: estado, inicio, fin y «todo el día»** (este último porque
  pasar a/salir de todo el día mueve la cita; la API lo trata igual). **Médico y
  consultorio NO**: la API deja corregir el consultorio de una atendida (17.3) y
  ninguna regla cierra el médico; congelarlos cambiaría más de lo pedido. Notas,
  título, Google (`gcal_*`), WhatsApp y `reserva_*` (con su disparador) siguen como
  estaban. Reescribir el MISMO valor (lo que hace el formulario o
  `gcal_aplicar_evento`) pasa: compara con `IS DISTINCT FROM`.
- **La comprobación de la nota es una función aparte, `cita_tiene_nota_ligada(p_cita,
  p_clinica) → boolean`, SECURITY DEFINER, `search_path=''`**, porque la RLS de
  `consultas` sólo enseña la nota a quien la escribió y al administrador: con la
  sesión de la secretaria o de otro médico la nota «no existiría» (el mismo motivo
  del cliente de servicio en `notaLigadaServidor.ts`). El disparador NO es DEFINER:
  necesita ver quién escribe (`current_user`) para dejar fuera a
  `postgres`/`supabase_admin`. La función devuelve sólo un booleano, con el mismo
  criterio que la API (nota de un paciente de esa clínica). **Por RPC**: con sesión
  sólo responde de SU clínica (`p_clinica = get_clinica_id()`, otra → `false`), que
  es lo que la API ya le dice con el 409 `nota_ligada` (AG-DT-63); **sin EXECUTE
  para `anon` ni `PUBLIC`** (cierre justificado: anon no tiene ningún camino a
  escribir citas; el disparador nunca corre como anon); `service_role` sí (ya lee
  `consultas`).
- **Roles:** aplica a `authenticated` (las tres funciones de la clínica) y a
  `service_role`; fuera `postgres`/`supabase_admin` (patrón de B1/D1/seg2). Caminos
  del servidor comprobados (catálogo y `src/`): `gcal_aplicar_evento` sólo escribe
  hora/estado de agendadas/confirmadas (a una atendida le reescribe lo mismo);
  `cita_confirmacion_responder` devuelve «cerrada» a una atendida; `cita_rsvp_google`
  sólo `scheduled → confirmed`; `reagendar_por_enlace` sólo desde una cancelada;
  `POST /api/consultas` marca `attended` desde agendada/confirmada; las escrituras de
  `gcal_*` no nombran esas columnas. Ninguno se rompe.
- **Choques comprobados:** `trg_appointments_proteger_borrado` (con la v2 encendida
  los dos rechazan el borrado de una atendida con nota; 42501 los dos; la API ya lo
  traduce a 409 y además veta antes); `trg_appointments_proteger_reserva` (otras
  columnas; ninguno cambia NEW); `log_cita_change` (AFTER: lo rechazado no deja
  auditoría); `vetoPorEstado`/`vetoPorNotaLigada` se quedan (dan el 409 legible; el
  disparador sólo actúa por PostgREST directo o en una carrera). La semilla nunca
  borra una atendida con nota (`exigirSinExpediente` se niega antes); las e2e borran
  como `postgres` (`sqlLocal`) y `agenda-g3-tarjeta` borra su nota antes que la cita.
- **No se tocó ninguna policy** (la rejilla las lista: las 5 de `appointments` y las
  4 de `consultas`, iguales) ni ninguna regla de `CLAUDE.md`. No hizo falta
  detenerse.
- **Código:** ninguno. El `PUT` no traduce el 42501 a 409 porque no puede llegar a él
  salvo en una carrera (la API veta antes, con la v2 encendida y apagada); si
  llegara, sería un 500 sin escribir (falla cerrado).

##### Punto 23 · las cinco e2e del domingo (AG-DT-69)

- **F1.12 (la lista de Semana del teléfono) era un DEFECTO REAL.**
  `desplazarListaAHoy` (`src/lib/agenda/listaHoy.ts`) buscaba la cabecera de hoy o
  de un día posterior y, si no había ninguna, «no movía nada» y quedaba pendiente:
  el domingo (cerrado en la semilla y en la mayoría de los consultorios) la semana
  visible ya pasó entera y la lista abría en el **lunes**, justo lo que F1.12 quitó
  (captura `antes/semana-telefono.png`). La misma rama mezclaba «aún no hay filas
  que medir» con «hay filas pero ninguna de hoy en adelante». Ahora: sin ninguna
  cabecera, pendiente como antes; con cabeceras pero ninguna de hoy en adelante, **al
  fondo** (lo más cerca de hoy), repitiendo cuadro a cuadro mientras la lista crece,
  como con hoy al final. Lo mismo vale para cualquier día sin citas de ahí al final
  de la semana (p. ej. un jueves sin citas jueves–domingo). Decisión sin preguntar:
  el fondo y no «el último día con citas arriba», porque es lo que hace ya la regla
  cuando hoy está cerca del final (no puede subir más).
- **El fondo se escribe una sola vez y sólo con todas las fuentes llegadas**
  (hallazgo del revisor): Google contesta DESPUÉS que las citas y puede traer la
  cabecera de hoy. `desplazarListaAHoy(raiz, hoy, alFondo)` devuelve `'hoy' |
  'fondo' | false`; sin permiso para el fondo no toca la lista y queda pendiente.
  `AgendaCliente` pasa `listaFuentesCompletasRef` (= `!cargando && !googlePendiente`,
  escrita por un efecto que además reintenta al completarse). Así no tironea de
  quien se desplazó mientras llegaba Google.
- **F1.4, F1.8 y F1.14 eran la prueba:** miraban la vista Día de HOY (el domingo no
  hay citas) y F1.8 además contaba con que la cita de las 10:00 de la semilla
  siguiera «agendada» (la semilla marca atendidas, faltas o canceladas las que ya
  pasaron: el domingo, y el sábado por la tarde, no queda ninguna agendada en la
  semana). Ahora fijan el reloj del navegador en el **lunes de la semana visible**
  (`fijarDia`, local al archivo), y F1.8 pone también su propia agendada (jueves
  15:00) y la borra. Aserciones intactas.
- **F1.12 de la prueba** fija el día en la **semana anterior** (viernes; y una
  prueba nueva, domingo → «al fondo»), que la semilla llena igual de lunes a viernes.
- **`fijarDia` nunca adelanta el reloj** (`min(ahora, día 09:00)`): comprobado que con
  el reloj del navegador ~19 h adelantado la sesión de `e2e/.auth/` deja de servir
  (la agenda manda a `/inicio`), y la rotación del refresh token de una sesión
  compartida rompería las pruebas siguientes. Por eso el lunes de la semana visible
  (siempre ≤ hoy) y la semana anterior para F1.12.
- **`husos-dos-consultorios` «la agenda» era la prueba:** el turno es MAÑANA (lo da
  el servidor; lo necesitan el comprobante y el recordatorio de los dos casos
  anteriores) y el domingo mañana cae en la semana siguiente; esa rama sólo corría
  en domingo y pulsaba «Periodo siguiente», que es la flecha de la banda del
  TELÉFONO: en escritorio la flecha es `.fc-next-button`. Ahora pulsa ésa y
  comprueba que la columna del día está. No se fijó el reloj (habría que
  adelantarlo a mañana).

#### Integración de la tanda H (decisiones sin preguntar)

- **Fusiones sin un solo conflicto de texto.** Las cinco ramas tocan archivos
  comunes (`AgendaCliente.tsx` H4 con H5 y H3; `BurbujaAlta.tsx` H3 con H4;
  `globals.css` los `--ag-control-*` de H2 con el verde de H3; las pruebas SQL;
  `plantillaCita.ts` H1), pero en bloques distintos: git las combinó solo y la
  revisión del resultado no encontró choques de sentido (el oyente de «Por
  confirmar» de H4 y la lista del domingo de H5 conviven en `AgendaCliente`;
  los tokens de H2 y H3 son claves distintas). La tarea de recordatorios llama
  a la función nueva (`cita_recordatorios_pendientes`, en
  `src/lib/confirmacion/recordatorios.ts`); la vieja `cita_correos_pendientes`
  sólo la llama ya la prueba SQL de E4 (AG-DT-75).
- **Ajuste (a) de H4 · el turno propone la duración de la consulta.** Al
  pulsar un turno de «Huecos disponibles», la burbuja abre con la duración de
  la consulta del médico en ese consultorio (la misma que parte el hueco: un
  turno de 45 min abre «11:15–12:00», no «11:15–12:15»). `abrirHueco(t, esTurno)`
  deja `duracionTurno` en `seleccionDesdeHueco`; `sitioDelGesto` la pasa al
  gesto y `duracionDeSeleccion` la usa. Un hueco sin turnos y el clic en la
  rejilla siguen proponiendo 60 min (decisión 19 de F). Vitest `altaRapida` y
  e2e `agenda-h4-huecos-turnos`, en rojo sin `duracionTurno`.
- **Ajuste (b) de H4 · con la duración conocida, el hueco mínimo es esa
  duración.** `resumenDelDia` guarda también `tramosLibres` (todo tramo libre);
  `CardHuecos` filtra con `huecosDelPanel(resumen, duracion)`, donde la
  duración es `duracionDelPanel` (la MISMA rejilla de `turnosDelHueco`): un
  tramo de 55 min con consulta de 45 ofrece su turno; con consulta de 90, un
  tramo de 60 ya no sale. Sin duración conocida (o con la v2 apagada), los de
  `HUECO_MINIMO`, idénticos. El texto del día completo dice el mínimo con
  `etiquetaDeDuracion`. Consecuencia (vista en la captura de la integración): un
  tramo que alcanza la duración pero no casa con la rejilla (09:15–10:00 con
  turnos a las 9:00 y 9:45) sale como hueco con «No cabe un turno entero en este
  hueco.», el mismo aviso que H4 ya daba a un hueco de 60 sin turno entero; antes
  no salía. Se deja: es la regla pedida (el mínimo es la duración). Vitest `huecosPanel` y la e2e, en rojo con la duración
  quitada. **Consecuencia aceptada (revisor):** `firmaDelResumen` firma ahora
  `tramosLibres`, así que mover una cita sin cambiar ningún hueco de 60 vuelve a
  pintar el panel lateral una vez, también con la v2 apagada (AG-DT-93). Se
  descartó pasarle el interruptor al resumen: llega tarde (promesa del
  servidor) y el panel se quedaría con los huecos viejos hasta el siguiente
  `eventsSet`. A1-bis lo midió (§9).
- **El horario de cada consultorio tras «Restablecer» (punto 10 de H2) —
  DECISIÓN PENDIENTE DE ANGEL.** H2 lo dejaba en el DEFAULT de columna (todo
  cerrado) con `horario_propio = false`: así nace hoy un consultorio nuevo y,
  con la v2, la agenda, sus avisos y la reserva le pintan **en tiempo de
  ejecución el horario de la clínica**. Eso choca con la regla de Angel de la
  tanda G, «la única fuente es el horario de cada consultorio»: tras un
  reinicio, la clínica volvería a mandar en la agenda a través de un dato que
  la configuración v2 ya no enseña. **Elegido:** la función copia
  `clinicas.horario_consulta` a cada consultorio de la clínica y pone
  `horario_propio = true`. Es exactamente la herencia de una vez de G4
  (`20261119130000`), o sea el estado de partida de todo consultorio con la
  v2, que es lo que significa «como si nunca se hubiera configurado» en una
  clínica que estrenó la v2. Coherente con la regla (sólo se lee el
  consultorio), cambia lo menos posible (la agenda pinta las MISMAS horas que
  con la opción de H2; cambia sólo de dónde salen) y no inventa un horario.
  **Consecuencias:** «Primeros pasos» queda en «1 de 3» (el horario cuenta como
  hecho; faltan la duración y el enlace), no en «0 de 3»; la configuración dice
  «Horario propio» con el horario de la clínica; la regla de H2 en `pasosDe`
  («como nace» = paso 1 pendiente) se queda para los consultorios que nacen sin
  horario. **Alternativas descartadas:** la de H2 (pinta la clínica, contra la
  regla) y «todo cerrado con horario propio» (fiel a la regla, pero la agenda
  entera saldría en gris y cada alta avisaría fuera de horario, y la reserva no
  ofrecería turnos). Para volver a la de H2: el `UPDATE` de los consultorios de
  `agenda_restablecer_configuracion` con `DEFAULT` en las dos columnas.
  **Se editó `20261120121000` en su sitio** (sólo aplicada en la base local;
  así el conjunto sigue en 32): cuerpo, pre-vuelo, md5 (`6c99e553…`), cabecera
  y COMMENT; prueba SQL `h2_restablecer_configuracion` (caso 2 consultorios, en
  rojo con el cuerpo de H2), e2e `agenda-h2-configuracion` 10 y el texto del
  diálogo («El horario de cada consultorio vuelve al de partida: el horario de
  la clínica, copiado a cada consultorio.»).

### Tanda I (2026-11-17)

La tanda I reúne los puntos 1 a 22 de Angel, repartidos en cinco ramas
(`feature/agenda-v2-i1` a `-i5`, las cinco desde `0349221`, worktrees
`-agenda-b56`, `-agenda-menores`, `-agenda-t3`, `-agenda-t4` y `-agenda-t5`) y
fusionadas con `--no-ff` en `feature/agenda-v2` en el orden I1, I2, I3, I4, I5.
I1 lleva los puntos 4 a 7 (los defectos de la sección B); I2, los 2, 9 y 21; I3,
los 8, 10 y 22; I4, los 1, 3, 11 y 12; I5, los 13 a 20. **Siete migraciones
nuevas** (el conjunto pasa de 32 a **39**: las 5 de `main` y 34 del proyecto):
`20261121120000` y `20261121121000` (I2), `20261121130000` (I3),
`20261121140000`, `20261121141000` y `20261121142000` (I4) y `20261121150000`
(I5). Reglas de Angel para toda la tanda: sin tocar la estética (lo nuevo se pinta
con lo que ya hay); sin dependencias nuevas; nada clínico en pantalla pública ni en
correos; el texto del aviso de privacidad sigue pendiente de su revisión legal; lo
nuevo va detrás del interruptor de la v2, **salvo los defectos de I1, que se
corrigen siempre** (también con la v2 apagada); no se pierde ninguna función; antes
de corregir un defecto, su causa raíz reproducida en una prueba en rojo, sin
sondeos; una prueba por cambio, comprobada en rojo con su mutación; la batería
completa de navegador, una sola vez y al integrar; migraciones al final del
conjunto, con su auditoría. Con la v2 apagada o las tablas nuevas ausentes
(producción hoy), la app se comporta como hoy.

**Decisiones de Angel que siguen (no volver a preguntar):** AG-DT-28 se queda (el
bloqueo manual mira el teléfono); «Compactar» al abrir, apagado; el enlace por
médico vive en la configuración; AG-DT-63 (el 409 `nota_ligada`) se queda; el
horario tras «Restablecer» es el de la integración H (el de la clínica, copiado
como horario propio).

**Pendientes de la tanda H que esta tanda cierra:**

- **Mover una atendida con nota, sin condición** (pendiente de H5): punto 1, I4.
  Ahora tampoco se mueve con la v2 apagada, en la ruta y en la base.
- **El enlace de un solo uso sin correo** (pendiente de H1, AG-DT-70): punto 2,
  I2. El correo pasa a ser opcional en el único; el fijo no cambia.

**Pendientes de Angel (se tomó lo que menos cambia; se cambian sin tocar nada
más):** las decisiones marcadas «— PARA REVISIÓN DE ANGEL» en cada rama, con su
resumen al final de la tanda. Entre ellas, una que no es de producto: **la semilla
no se pudo rehacer en ninguna de las cinco ramas** (I1, decisión del entorno).

#### I1 · la caché de la agenda al volver y «Ir a una fecha» (puntos 4 a 7, siempre)

Sin migraciones. Todo corre también con la v2 apagada (son defectos).

- **El canal de tiempo real de la agenda sobrevive 2 min a su desmontaje — PARA
  REVISIÓN DE ANGEL** (`useTiempoRealAgenda.ts`, `abrirCanalAgenda` /
  `programarBaja`).
  - **Causa común de los puntos 4, 5 y 6.** La caché de rangos de citas vive en el
    módulo y se sirve al volver hasta 2 min (`VIGENCIA_CITAS_MS`). Su único
    invalidador externo, el canal, moría con la agenda.
  - **Ahora** el canal vive exactamente lo que puede vivir una entrada de la caché.
    Mientras la agenda no está, un evento sólo vacía la caché; al volver se
    reutiliza el mismo canal, sin otro `phx_join`. Un solo canal siempre.
  - **Alternativas descartadas:**
    - vaciar la caché al desmontar o al montar: rompe «volver del dashboard: 0
      bloqueantes» (A1.5), el presupuesto que había que conservar;
    - que la semilla del servidor pise la caché: puede venir de un RSC prefetchado
      de hasta 30 s (`staleTimes.dynamic`), o sea, MÁS vieja que la caché, y no
      cubre el regreso por la caché del router;
    - un sondeo: prohibido por el punto 5.
  - **Coste:** 0 peticiones HTTP añadidas. El WebSocket sigue abierto hasta 2 min
    en otras pantallas; antes se cerraba al salir (I1-DT-1).
  - **Por qué se marca:** al cerrar sesión la caché se vacía, pero el canal sigue
    hasta 2 min. supabase-js cambia su token en SIGNED_OUT/SIGNED_IN y la RLS
    filtra por el token vigente. **SUPOSICIÓN no verificada:** que Realtime vuelva
    a evaluar la RLS tras el cambio de token (I1-DT-5).
  - **Con la agenda desmontada**, los eventos sólo vacían la caché de citas: «Por
    confirmar» y la campana no se enteran hasta que la agenda vuelve (I1-DT-4;
    antes, ni eso).
- **El topic del canal es fijo (`appointments-realtime`), comprobado.**
  - La revisión independiente señaló una posible rendija: remontar mientras
    `removeChannel` espera el acuse del `leave` devolvería el canal saliente.
  - **No ocurre en esta versión.** `Channel.leave` de `@supabase/phoenix` pasa a
    «leaving» y, como `canPush()` exige estar unido, da el `leave` por respondido
    en el acto. El canal sale de la lista del cliente sincrónicamente.
  - Probado en el navegador reteniendo en el socket el acuse del `phx_leave`: el
    `phx_join` del canal nuevo sale y se une.
  - Se llegó a escribir un topic por apertura y una e2e. La e2e pasaba igual con el
    topic fijo, así que se retiraron las dos (no arreglaban nada). Queda un
    comentario en el efecto con la evidencia.
- **La nota guardada desde una cita vacía la caché en la misma pestaña**
  (`nueva-nota/page.tsx`, tras `res.ok` y sólo con `?cita=`), como ya hacía
  `ligarCita.ts`. Aunque el canal vivo traería el eco, una escritura propia no debe
  depender de que el eco llegue antes de que el médico vuelva.
- **Punto 7, en el componente y no en la barra.** Los dos `onClick` de
  `HerramientasV2.tsx` (`SelectorFecha` y `BotonBuscar`) leen la caja del botón
  FUERA del actualizador de `setAncla`. La lupa tenía el mismo defecto, en
  escritorio y teléfono, y se arregla igual: es el mismo componente y la misma
  línea.
- **E2e de Google con ids de evento únicos.** El Google simulado reinicia sus ids
  (`google1`, `falsoN…`) en cada arranque. Chocaban con filas viejas de otras
  corridas en la Clínica A y la importación devolvía 0 cambios.
- **Entorno: la semilla no se rehízo, la bloquean dos notas clínicas hechas a mano —
  PARA REVISIÓN DE ANGEL.**
  - `agenda-semilla.ts` aborta porque hay 2 filas en `consultas` sobre pacientes
    sembrados: «Paciente Prueba 13» y «15», creadas el 2026-11-16 02:18 UTC, ajenas
    a la tanda.
  - Son notas clínicas y **no se borraron**. Lo mismo dicen I2, I3, I4 e I5; todas
    las ramas corrieron sus e2e sin resembrar.
  - La semilla es de la semana del 9 de noviembre, así que `agenda-cache-rangos`,
    `agenda-semilla` y el cambio de semana de la medición fallan igual en `0349221`
    que en I1.
  - I4 lo deja escrito para Angel: «quitar o aceptar borrar esas dos notas de
    prueba». La batería de integración tiene que resembrar.
- **Entorno, lo demás.**
  - Dentro del flock se borró una conexión de Google simulado que otra corrida había
    dejado en la Clínica A: impedía sembrar la de las pruebas.
  - Para medir y para las regresiones se apuntaron, de forma temporal:
    - `reservaPublicaAyudas.ts` a :3003;
    - las `request.newContext` de `agenda-tiempo-real`, `agenda-candado-gesto` y
      `agenda-cache-rangos` a :3001, que no estaba arriba.
  - `medir-carga.e2e.ts` se recortó, también de forma temporal, a apertura y vuelta.
  - Nada de eso se commitea.
- **Medición** (intercalada `0349221` / I1, medianas de 5): apertura y vuelta dentro
  del ruido (±10 ms), 0 bloqueantes al volver y las mismas peticiones de datos. Un
  estático más: webpack reparte de otra forma los módulos compartidos al importar
  `cacheRangosCitas` desde la nota nueva (+115 bytes de JS).

#### I2 · el único sin correo, el candado sobre lo elegido y los correos a nombre del médico (puntos 2, 9 y 21)

Migraciones `20261121120000_agenda_i2_unico_sin_correo` (punto 2) y
`20261121121000_agenda_i2_candado_eleccion` (punto 9). Auditoría independiente:
APTA (120000) y APTA CON OBSERVACIONES (121000).

##### Punto 2 · el enlace de un solo uso sin correo (`20261121120000`)

- **Un único sin correo lleva un seudónimo por reserva, no NULL — PARA REVISIÓN DE
  ANGEL.**
  - El seudónimo: `reserva_correo_hmac = sha256('reserva-sin-correo:' || id)`, en
    hex.
  - **Por qué no NULL.** Tres sitios de la base dan por hecho que toda reserva por
    enlace tiene seudónimo:
    - `appointments_reserva_check` (D1);
    - `reserva_incidencias.correo_hmac NOT NULL` (D2);
    - `cita_confirmaciones_vinculo_check` (E1).

    Con NULL había que relajar tres restricciones, dos de ellas en tablas con filas,
    y cambiar cuatro funciones. Con el seudónimo no se toca ninguna.
  - **Consecuencias.** El seudónimo es distinto en cada reserva, así que:
    - no junta incidencias entre reservas sin correo;
    - no choca con el candado de «ya tiene cita» por correo;
    - el WhatsApp manual (E7) sigue emitiendo su enlace de confirmar o cancelar.
  - La cuenta de incidencias de esa persona sigue por teléfono. **No es un HMAC de
    nada:** no sirve para buscar a la persona.
  - Deuda: sin `COMMENT ON COLUMN`, sólo lo explica el de `reservar_por_enlace`.
  - Deuda: «Bloquear contacto» desde una reserva sin correo deja también una fila
    inútil de correo con el seudónimo. El bloqueo que cuenta es el del teléfono.
- **Sin correo no se intenta ningún correo — PARA REVISIÓN DE ANGEL.**
  - No salen comprobante, confirmación ni recordatorio: `cita_correo_tomar` no da
    fila porque no hay `reserva_correo`.
  - La página no dice «Te enviamos el comprobante».
  - La confirmación por WhatsApp (E7) sigue disponible.
- **La etiqueta del único dice «Correo electrónico (opcional)» — PARA REVISIÓN DE
  ANGEL.** El campo no es `required` y no hay paso de código. El texto del fijo no
  cambia.
- **El fijo sin correo responde 400 `solicitud_invalida` en la ruta**, antes del
  límite por enlace. La base además lo rechaza con `correo_sin_verificar`, como
  defensa redundante. Por eso quitar el IF del fijo en la función no se puede
  observar en las pruebas.
- **El único con un correo AJENO: hallazgo de seguridad sin tocar — PARA REVISIÓN DE
  ANGEL.** La revisión de seguridad lo calificó MEDIA; ya existía (AG-DT-70).
  - Como el único no verifica el correo, quien tenga el enlace puede escribir el de
    un tercero. Dos efectos:
    - al tercero le llega el comprobante, ahora a nombre del médico;
    - el HMAC real del tercero queda en la cita y le activa «ya_tiene_cita» en el
      fijo.
  - Angel pidió el correo opcional, no quitarlo, así que no se tocó.
  - Opciones que quedan:
    - ignorar el correo escrito en el único;
    - mandar el comprobante sólo a un correo verificado;
    - aceptar el riesgo por escrito.
  - Otros dos, BAJA, también a deuda:
    - el único no tiene tope por enlace (ya existía, AG-DT-28): se pueden probar
      teléfonos y distinguir «bloqueado a mano» (403, que no gasta el enlace) de
      «ok»;
    - `correo: ""` en el único da 400: falla cerrado.

##### Punto 9 · el candado sobre lo que eligió el paciente (`20261121121000`)

- **Qué queda cerrado: médico, consultorio, fecha y hora de inicio; el fin, libre —
  PARA REVISIÓN DE ANGEL.**
  - El formulario deja esos cuatro campos deshabilitados y sólo deja cambiar el fin.
  - Estirar la cita desde el borde de ARRIBA se rechaza en pantalla, como el
    arrastre. Lo añadió la revisión de código, con su e2e en rojo bajo mutación.
    Estirar el fin sigue libre.
  - El servidor respondería 409 de todos modos.
  - El médico no cambia por ningún camino.
- **Al reagendar, el estado de confirmación se conserva — PARA REVISIÓN DE ANGEL.**
  - No vuelve a «sin confirmar».
  - El correo de cambio lleva el enlace para que el paciente confirme o cancele de
    nuevo.
  - La revisión de código lo dejó como decisión de producto (BAJA).
- **Google ya no mueve una cita por enlace futura; cambia el comportamiento de D4 —
  PARA REVISIÓN DE ANGEL.**
  - La base rechaza la hora nueva con 42501 «reservada por enlace».
  - La pasada lo registra como `gcal_cambio_rechazado` con `motivo:
    'eleccion_paciente'` y vuelve a escribir en Google la hora de Spinus, como ya
    hacía C-e con una atendida.
  - El título sigue entrando mientras está por ligar (C-d), igual que antes.
  - Archivos: `gcalSincronizacion.ts` (`aplicarORechazar`) y
    `gcalSincronizacionBase.ts`, donde el 42501 se convierte en
    `CambioRechazadoPorLaBase`.
- **El «Reagendar» de la tarjeta abre el formulario con `enfocar: 'fecha'`**, y ese
  formulario abre `PanelReagendar` solo. No hay pantalla nueva aparte.
- **`cita_reagendar_clinica` no mira empalmes, horario ni tope de duración.** Lo
  hace `POST /api/appointments/[id]/reagendar` antes de llamarla, igual que el PUT
  (B7 sólo avisa). El panel enseña el empalme y pregunta «¿Reagendar de todos
  modos?».
- **Excepciones del disparador `cita_proteger_eleccion`.**
  - No frena a `postgres`/`supabase_admin`, ni las citas que ya pasaron, ni con la
    v2 apagada.
  - A `service_role` lo deja pasar sólo con `spinus.reagendar_cita = <id de la
    cita>`, y eso sólo lo pone `cita_reagendar_clinica`.
  - La revisión confirmó que no frena cancelar, cambiar estado, ligar, título, notas
    ni seg2/H5.
- **Quién puede reagendar:** las mismas personas que pueden editar la cita (el
  médico, el administrador de la clínica y la secretaria). Lo comprueban
  `puedeGestionarDelMedico` en la ruta y `sin_permiso` en la base.
- Deuda:
  - `p_esperado` NULL en `cita_reagendar_clinica` significa no comprobar la versión.
    La ruta lo manda siempre que la pantalla tiene `updated_at`.
  - Reagendar A→B→A da `no_enviado`: el correo de la vuelta es «duplicado» por
    (cita, tipo, inicio), y el panel dice «el correo no salió», aunque el paciente
    recibió el de la primera vez.
  - `PanelReagendar` interpreta la hora en la zona del navegador, igual que el
    formulario de siempre.

##### Punto 21 · los correos a nombre del médico

- **El remitente lleva el nombre del médico, entre comillas — PARA REVISIÓN DE
  ANGEL.**
  - Forma: `"Dr. Nombre" <noreply@mail.spinus.com.mx>`. La dirección no cambia.
  - Saneamiento (`nombreRemitente`, en `cabeceraFrom`):
    - se quitan controles, comillas, `\`, `<`, `>` y también `@`, para que «Dr.
      x@banco.mx» no se lea como otra dirección (añadido por la revisión);
    - los espacios se juntan;
    - se corta a 64 caracteres, por punto de código para no partir un emoji;
    - si queda vacío, se usa «Spinus».
  - **ASUMIENDO QUE** Resend acepta un display-name entrecomillado (RFC 5322); su
    documentación lo muestra sin comillas. Sin comprobar contra el servicio real:
    hay que hacer un envío de prueba real. Si no lo acepta, se quitan las comillas;
    el saneamiento ya quita lo peligroso.
- **Encabezado y pie del correo — PARA REVISIÓN DE ANGEL.**
  - Sin cambios estéticos: el encabezado sólo cambia el texto (el médico y, debajo,
    el consultorio).
  - «Enviado con Spinus» va al pie, en 11 px.
  - Si no hay médico, el encabezado dice «Spinus» y no lleva el pie.

##### Proceso

- **Una consulta de catálogo sin `flock`**: de sólo lectura, a `psql`, para ver
  firmas de funciones. Las demás operaciones contra la base corrieron con `flock`.
- **Una fila borrada, con `flock`:** un contacto bloqueado por teléfono que dejó la
  propia corrida de `reserva-seg1` (22:08:46 UTC). Ensuciaba la lista «Contactos
  bloqueados» de `agenda-enlaces-reserva`. Su fila de `audit_log` se queda: es
  inmutable.
- **I2 no hizo commits** («Git lo corre Angel», memoria de Angel) y dejó los mensajes
  propuestos en su informe.

#### I3 · «Por asignar» de Google, «¿No es una cita?», la reserva en «Próximas citas» y el doble clic (puntos 8, 10 y 22)

Migración `20261121130000_agenda_i3_por_asignar_google`. Auditoría independiente:
APTA CON OBSERVACIONES, sin bloqueantes; las dos atendidas se recogen abajo.

- **«Por asignar» se guarda en una columna nueva, `appointments.google_asignacion`**
  (`NULL` | `'por_asignar'` | `'evento'`), y no reutiliza `reserva_canal`. Cuatro
  motivos:
  - `appointments_reserva_check` exige el enlace, los hmac, el aviso y el
    consentimiento;
  - el candado D2, los disparadores de incidencias, el candado de I2
    (`cita_proteger_eleccion`) y la restauración del título de D4 (C-d) se guían por
    `reserva_canal`;
  - seg2 sólo deja que la sesión escriba el prefijo `reserva_*`;
  - una fila de Google por asignar no es una reserva por enlace.

  Cómo encaja con las reglas vigentes:
  - **S1**, sin cambios: las observaciones no viajan;
  - **C-d**: mientras no tiene paciente, el título que manda Google sigue entrando,
    porque `pacienteParaGoogle` devuelve `null`;
  - **C-e**: está `scheduled`, así que acepta los cambios de Google como hoy;
  - **I2**: su disparador no la toca, porque no tiene `reserva_canal`.

  El CHECK `appointments_google_asignacion_check` se añade `NOT VALID` y luego
  `VALIDATE`: toda fila existente tiene NULL, así que pasa.
- **Sólo el sondeo pone `por_asignar`, y sólo al INSERTAR** (disparador
  `cita_asignacion_google`). Tienen que darse todas a la vez:
  - lo hace `service_role` con el GUC `spinus.via = 'google'`, que es lo que hace
    `gcal_importar_evento`;
  - `origen = 'google'`;
  - sin paciente y sin reserva;
  - el evento tiene hora y no ha terminado.

  Cualquier otro INSERT queda en `NULL`. El UPDATE sólo admite `por_asignar →
  evento`, sin paciente antes y después: la auditoría hizo añadir `OLD.paciente_id
  IS NULL`, porque sin él se podía desligar y marcar «evento» en una sola sentencia.
  Tiene su caso en la prueba SQL, en rojo antes. Así, ninguna sincronización
  posterior devuelve un `'evento'` a `'por_asignar'`.
- **Los eventos de todo el día y los ya terminados entran como evento, como hoy —
  PARA REVISIÓN DE ANGEL.** Un «todo el día» de Google casi nunca es una consulta, y
  uno pasado no se va a iniciar. La marca sólo se decide al importar. Deuda: una fila
  por asignar que Google cambia después a todo el día, al pasado o a cancelada sigue
  marcada; los lectores ya filtran por estado y fecha.
- **No se rellenan filas viejas — PARA REVISIÓN DE ANGEL.** Lo importado antes de la
  migración sigue como evento: la migración no modifica filas existentes. En
  producción, sólo lo que entre después de aplicarla saldrá «Por asignar».
- **Ligar una por asignar al «Iniciar consulta» usa el camino de conversión de T3**
  (`vetoDeConversion` en el PUT).
  - Exige consultorio y las puertas de suscripción, y queda auditado con `via:
    'convertir'`; no hay un `via` propio de Google (deuda).
  - El consultorio es el del formulario o el activo. Si no hay ninguno, el
    formulario dice «Elige el consultorio antes de iniciar la consulta.».
- **«¿No es una cita?» va por una ruta propia, `POST
  /api/appointments/[id]/no-es-cita`.**
  - Comprobaciones, en orden: sesión (`getUser`), perfil, v2 encendida,
    `puedeGestionarDelMedico` y que la fila siga por asignar.
  - Escribe con el cliente de sesión y `.eq('clinica_id')`, y queda auditada
    (`cita_no_es_cita`). No toca `updated_at`.
  - No es un redirect, así que la regla de autoridad de sesión no entra.
  - Respuestas: 200 `{ evento: true }` (idempotente), 401, 403, 404 (v2 apagada o no
    existe en su clínica), 400 (id inválido), 409 `no_aplica` y 503 `no_disponible`
    si falta la migración. Se monta con `BotonNoEsCita.tsx`; contrato en su
    cabecera.
  - En el formulario completo cierra el formulario sin preguntar, y se pierde lo
    editado sin guardar: es lo pedido («en el momento y sin más pasos»). La marca se
    va de la rejilla sola, por el refresco que ya existe (< 1,5 s medido). El
    hallazgo del revisor («no repinta la marca») no se sostuvo: la e2e pasa con y sin
    cablear un repintado, así que no se cableó nada en `AgendaCliente`.
  - Si la v2 se apaga DESPUÉS de tener filas por asignar, la agenda sigue pintando la
    marca y el botón contesta 404. Caso de borde; no se gatea en el cliente.
- **Una por asignar no ofrece «Convertir en cita»:** al iniciar la consulta ya se
  liga. Después de «¿No es una cita?», el evento conserva «Convertir en cita» como
  camino de vuelta. Deuda: hereda de las por ligar «Confirmar», «Reagendar» y
  «Cancelar cita» en la tarjeta («como una por ligar»).
- **La fila de «Próximas citas» de una por asignar** lleva «¿No es una cita?» y un
  botón cuadrado de calendario hacia `/agenda`; la por ligar lleva «Agenda» / «Ver
  en la agenda». No hay enlace profundo a la cita: no existía un parámetro de la
  agenda para abrir una cita concreta (deuda). Al quitar una fila, la lista se vuelve
  a pedir para que el pie «no hay más» no mienta.
- **«Próximas citas» lee el interruptor de la v2 una vez por montaje**
  (`agenda_ajustes`, con la sesión, y falla cerrado).
  - Con la v2 apagada, la consulta es la de siempre.
  - Si la columna no existe (42703 / PGRST204 / PGRST100), cae a la consulta de
    siempre. En ese caso, con la v2 encendida, pierde también las por ligar de
    enlace; es improbable, porque la migración va antes que el código.
  - Es una petición más al abrir el dashboard, no al abrir la agenda.
- **No se tocan los conteos de `/inicio`, `TarjetaHoy` ni `HoyEnConsultorio` — PARA
  REVISIÓN DE ANGEL.** Para contar las por ligar habría que leer el interruptor en
  los tres, y los tres tienen que coincidir (está anotado en su código).
  Consecuencia en pantalla:
  - `/inicio` («Hoy tienes N citas») y `HoyEnConsultorio` las omiten;
  - `TarjetaHoy` las cuenta como «eventos»: la captura dice «3 citas · 2 eventos»
    con una por ligar y una por asignar dentro de los eventos.
- **El escudo de H3 pasa a ser un gancho, `src/hooks/useEscudoTrasRegistro.ts` —
  PARA REVISIÓN DE ANGEL.**
  - Tiene tres usos reales: la burbuja, el formulario completo y «Convertir en
    cita». Es una abstracción nueva (Protocolo 4 de `CLAUDE.md`, que pide el OK
    explícito de Angel) justificada con esos tres casos.
  - La opción nueva `dentroDeDialogos` (por omisión `false`) deja la burbuja
    exactamente como estaba.
  - Hace falta porque en el formulario completo el segundo clic de un doble clic cae
    sobre un chip de «Tipo de cita», dentro del propio diálogo. Medido a 1280×800:
    elegía un tipo y cambiaba la duración.
  - El comentario del escudo en `BurbujaAlta.tsx` remite ahora al gancho, donde vive
    la historia de H3.
- **El texto de la marca es «Por asignar»**, con `title` «Por asignar: evento nuevo
  de Google, aún sin paciente». En «Próximas citas» es la misma palabra en píldora.
  Se pinta con las clases de «Por ligar», sin estética nueva.
- **Dos pruebas existentes de `agenda-google-dos-sentidos.e2e.ts` se adaptaron,
  porque el comportamiento cambió por especificación:**
  - «fila editable»: el formulario se abre ahora como «Editar cita», no «Editar
    evento»;
  - la de T3 «se convierte en cita»: antes de convertir pulsa «¿No es una cita?», el
    camino de vuelta.
- **Entorno.** Con la semilla bloqueada (I1), las e2e corrieron sin resembrar, con
  una configuración temporal que sólo abre sesión. Las filas que dejan las corridas
  del Google falso (`falsoNx`, `googleN`) chocaban con la secuencia nueva del falso
  (23505 y `ON CONFLICT DO NOTHING`). Antes de cada corrida se les puso el sufijo
  `-huerfana-i3-<id>` en su `google_event_id`, como `postgres` y sin borrar nada.
  La lista está en `huerfanas-mias.txt`, hoy en
  `/home/spinus/proyectos/tanda-I-temporales/i3`.

#### I4 · la atendida con nota, el horario «por revisar», la asistencia y la cancelada que se sustituye (puntos 1, 3, 11 y 12)

Migraciones `20261121140000_agenda_i4_atendida_no_se_mueve`,
`20261121141000_agenda_i4_horario_revisado` y
`20261121142000_agenda_i4_cancelada_cerrada`.

##### Punto 1 · una atendida con nota no se mueve, tampoco con la v2 apagada (`20261121140000`)

- **También el arrastre con la v2 apagada.**
  - El veto de la ruta (`vetoPorNotaLigada`) ya no mira el interruptor para
    «mover»: una atendida con nota no cambia de fecha, hora ni «todo el día» en
    ninguna clínica.
  - La base dice lo mismo: `cita_proteger_atendida` ya no lee `agenda_ajustes`.
  - Con la v2 encendida, mover una atendida CON nota contesta ahora `nota_ligada`
    (antes `estado_no_admite`).
  - Sin nota, lo de G3 sigue igual: `estado_no_admite` con la v2, y libre con la v2
    apagada, como hoy.
- **La carrera.** Si la nota entra entre la comprobación de la ruta y el UPDATE, la
  para el disparador (42501 con su HINT `HINT_ATENDIDA_CON_NOTA`). La ruta lo traduce
  a 409 `nota_ligada` con «…no se puede cambiar de estado, de fecha ni de hora.»; el
  mensaje no sabe cuál de las dos cosas se intentó.

##### Punto 3 · el horario «por revisar» (`20261121141000`)

- **Todas las filas existentes nacen «por revisar» — PARA REVISIÓN DE ANGEL.**
  - La columna `consultorios.horario_revisado_en` nace NULL en TODOS los
    consultorios.
  - Hoy nada distingue con certeza un horario que una persona eligió de uno copiado
    por G4 o por «Restablecer».
  - Un «por revisar» de más se quita con un clic; uno de menos esconde un horario que
    nadie eligió.
  - **En producción, cada médico verá su paso de horario «por revisar» una vez.**
- **Qué cuenta como «revisado».**
  - Pulsar «Confirmar horario» o GUARDAR cualquier cambio de disponibilidad de ese
    consultorio desde la configuración, incluido «Usar el horario de la clínica»:
    una persona miró y eligió.
  - Sólo con la v2; sin ella no se nombra la columna.
  - Sólo el dueño ve el botón; decide la RLS de UPDATE de siempre.
  - Un consultorio dado de alta en /perfil nace «por revisar».
  - «Restablecer» la vuelve a NULL. Deuda: su respaldo en `audit_log` no guarda el
    valor previo de `horario_revisado_en`, porque añadirlo cambia el md5 de la
    función.
- **Cómo se ve.**
  - Un círculo con «!» en los colores de aviso que ya existen (`--ag-aviso-*`) y
    «· Por revisar» junto al título.
  - La línea «Viene del horario de la clínica: revísalo y confírmalo en cada
    consultorio.» y el botón «Revisar horario».
  - No cuenta como hecho: «0 de 3 listos», y la pestaña sigue con sus pendientes.
  - En la lista de consultorios, «· Por revisar» y «Confirmar horario» (primario).

##### Punto 11 · «¿Asistió el paciente?»

- **Se calcula en el servidor**, como los tipos del ajuste.
  - Es una promesa más de `agenda/page.tsx` que viaja con la página: ni una petición
    del navegador al abrir.
  - El componente va en el chunk que ya se descarga en ocioso (`HerramientasV2`).
  - Sale en escritorio y en teléfono.
  - `asistenciaServidor.ts` usa `createAdminClient()` sólo para saber qué citas
    tienen nota, filtrado por clínica.
- **Cuáles: las que empezaron hace más de 48 h — PARA REVISIÓN DE ANGEL.**
  - Agendada o confirmada, con hora (no de todo el día), con paciente o POR LIGAR
    (un evento sin paciente no tiene asistencia).
  - Cuyo INICIO pasó hace más de 48 h, y sin nota ligada.
  - Como mucho las 50 más recientes por apertura; si hay más, salen las siguientes
    la próxima vez.
  - Médico: las suyas (también lo garantiza la RLS). Administrador y secretaria: las
    de la clínica.
- **La cita por ligar, «lo que pediste que decidiera» — PARA REVISIÓN DE ANGEL.**
  - Sale en la ventana con los mismos botones.
  - «No asistió» la marca `no_show` por el PUT de siempre, y el disparador de D2
    apunta la incidencia del candado, IGUAL que marcarla a mano hoy: es lo que menos
    cambia.
  - «Sí asistió» la deja atendida sin paciente, como a mano.
  - **Nada automático marca `no_show`.** Se comprobó con grep de `src/` y de las
    migraciones: sólo el modal, la tarjeta, la ruta y la semilla como postgres. La
    e2e lo afirma: abrir la agenda no cambia ningún estado ni crea incidencias.
- **«Decidir después»** es un botón para toda la ventana (también la ✕ y Escape).
  Las respuestas ya dadas se quedan. Deuda: la ventana no tiene trampa de foco (la
  deuda 2 de `CLAUDE.md`, la de `ModalShell`).

##### Punto 12 · reasignar o reagendar una cancelada y cerrarla (`20261121142000`)

- **La cancelada se cierra, no se borra, y sólo si la nueva tiene paciente — PARA
  REVISIÓN DE ANGEL.**
  - **Cuándo se cierra.** Sólo si la nueva es una cita CON paciente: la sustituta
    queda sostenida por la FK RESTRICT y, con la v2, una cita con paciente no se
    borra.
  - **Cuándo no.** «Reasignar» guardado como algo sin paciente no manda
    `sustituye_a`, así que la cancelada se queda como está. «Reagendar» de una NO
    ASISTIDA no cierra nada: sólo se pidieron las canceladas.
  - **Una cancelada POR LIGAR** conserva su tarjeta de hoy, sin «Reasignar». Su
    «Reagendar» es el de I2 (enlace), no éste.
  - **En la base:** `appointments.cerrada_en` y `sustituida_por` (FK RESTRICT). Sólo
    los escribe `service_role` (`cita_proteger_cierre`), sólo sobre una cancelada y
    con una sustituta viva de la misma clínica. No se reabre. La agenda
    (`consultaCitas`), el tiempo real y el buscador no la pintan.
  - **El alta.** `POST /api/appointments` con `sustituye_a` (v2) la cierra en la
    misma petición.
- **Una cancelada ya cerrada no se ve en ninguna pantalla — PARA REVISIÓN DE ANGEL.**
  - Deja de verse en la agenda, en el buscador y en tiempo real.
  - Se conserva en `appointments` (`status = 'cancelled'`, `cerrada_en`,
    `sustituida_por` = la cita nueva).
  - Queda en `audit_log` con dos filas:
    - `cita_editada`, del disparador, con `campos ["cerrada_en","sustituida_por"]`;
    - `cita_sustituida`, con quién lo hizo y `{"sustituida_por": …}`.
  - Hoy sólo se ve por el SQL Editor: `select * from appointments where
    sustituida_por is not null`.
  - **Propuesta, no hecha:** una línea en la tarjeta de la sustituta («Sustituye a la
    cita cancelada del …») o en la lista de citas del paciente.
  - Deuda:
    - una cancelada cerrada SIN paciente ni reserva (p. ej. nacida en Google) se
      puede seguir borrando por `appointments_delete`, como cualquier cancelada sin
      paciente hoy;
    - `HoyEnConsultorio.tsx` cuenta también las canceladas (ya era así), así que una
      cancelada cerrada y su sustituta del mismo día cuentan dos.
- **Rótulos.** La cancelada ofrece «Reagendar cita» (principal, el de G3) y
  «Reasignar» (secundaria). No se llamó «Reagendar» a secas, para no tener dos
  «Reagendar» con significados distintos.
- **La sustituta tiene que estar viva**, ni cancelada ni cerrada, para que no haya
  cadenas ni pares que se escondan entre sí. Lo pidió la auditoría independiente.
- **Lo que la sesión puede hacer — PARA REVISIÓN DE ANGEL.**
  - Quien ve una cancelada puede crear una cita cualquiera con `sustituye_a`, y la
    cancelada deja de pintarse.
  - No se exige el mismo paciente, médico ni hueco: «Reasignar» cambia de paciente y
    la burbuja puede cambiar de médico.
  - No es fuga ni borrado: queda en la base y en la auditoría (`cita_sustituida`, a
    nombre de quien la cerró).
- **Idempotencia** (revisión independiente). El reintento de la misma alta (mismo
  `client_id`) devuelve la cita que ya entró con su `sustituida`, y vuelve a intentar
  el cierre si el primero no llegó.

##### Despliegue y medición

- **Orden de despliegue: con la v2 encendida, PRIMERO las migraciones** (lo dicen sus
  cabeceras).
  - Sin `horario_revisado_en`, guardar un horario con la v2 daba 500.
  - Sin `cerrada_en`, el buscador v2 no encuentra citas, y «Reagendar»/«Reasignar» de
    una cancelada daban 500.
  - Con la v2 apagada no se nombra ninguna columna nueva: la agenda filtra las
    cerradas tras leer, tolerante a que la columna falte.
  - *(Superado en parte en la integración: el PATCH del horario y
    `comprobarSustituible` toleran las columnas ausentes; ver abajo.)*
- **Medición** (abrir /agenda con la v2, intercalado `0349221` ↔ I4, 3 rondas × 3
  cargas):
  - peticiones idénticas;
  - mediana hasta `data-interacciones-v2=listas`: 996 ms base y 988 ms I4.
  - Una primera medición dio un JS de más: `PreguntaAsistencia` importaba
    `cuandoDeTarjeta` y webpack partió `accionesTarjeta`. Se copió el formato (8
    líneas) y volvió a lo de antes.

#### I5 · la barra de una fila, la campana y los avisos de la clínica (puntos 13 a 20)

Migración `20261121150000_agenda_i5_avisos_clinica`. Todo lo nuevo va detrás de
`agenda_v2_encendida`. Con la v2 apagada, la barra, «Compactar», «Densidad», la
leyenda, el conteo y el engrane de siempre quedan como estaban (e2e «apagada…» y
Vitest `CabeceraEscritorio`/`BandaMovil`).

- **Una fila desde 1280 px de ventana**, sin el panel de Día. Por debajo, o en Día
  con su panel, siguen las dos filas de siempre: la rejilla de `.agenda-fc` ya
  cambiaba ahí, y forzar una fila a 1024 partía los botones. Para que quepa a 1280
  con el menú lateral abierto (le faltaban 8 px):
  - el filtro de médico baja a 96 px de mínimo;
  - si aun así no cabe (un periodo largo), la fecha recorta con elipsis en vez de
    mandar «Agendar» a otra línea.
- **Teléfono.**
  - La campana va en la fila de arriba, antes de las flechas, y el engrane al final
    de los filtros.
  - La fecha sigue siendo texto, no botón: decisión 21 de la tanda anterior (en el
    teléfono el minicalendario es la hoja inferior de F22).
  - El título puede ocupar dos renglones, ahora que no lleva el conteo debajo.
  - Sin «Densidad» ni «Atajos», que no existían ahí.
- **El título de FullCalendar se esconde sólo cuando el botón de la fecha ya montó**
  (`:has([data-selector-fecha])`). El botón llega en ocioso con el chunk de las
  herramientas, y así nunca hay un instante sin fecha. El botón abre `MiniMes`, el
  mismo desplegable de «Ir a una fecha» que arregla I1.
- **Menú del engrane** (patrón Menu Button de la APG).
  - «Compactar» y «Densidad» son `menuitemcheckbox` y NO cierran el menú al
    pulsarlos, como pide el patrón; las otras tres opciones sí.
  - «Atajos de teclado» sale deshabilitado (`aria-disabled`) hasta que el chunk de
    interacciones está listo. Conserva el `aria-keyshortcuts="?"` del botón al que
    sustituye.
  - «Leyenda de estados» abre una capa propia con `LeyendaEstados`; la fila de la
    leyenda sale de la barra.
  - Las capas van por `Portal` con posición fija (`CapaBarra`), porque
    `.ag-controles` es un contenedor de consultas y recortaba lo absoluto. Tab en el
    menú devuelve el foco al engrane.
  - Deuda: la opción deshabilitada queda fuera del recorrido con flechas, como
    sugiere la APG.
- **La campana abre siempre en «Por confirmar».**
  - El punto rojo suma los pendientes de mañana y los avisos sin revisar.
  - Sin la tabla (producción sin la migración), la pestaña «Avisos» enseña lo de
    antes: canceladas de 48 h y empalmes de 30 días, calculados al vuelo.
  - Tras un fallo pasajero, conserva la última lista buena: no salta a la vista
    antigua ni cambia la cuenta.
- **En el teléfono, una petición más al abrir la agenda — PARA REVISIÓN DE ANGEL.**
  La campana añade la de `por-confirmar` en ocioso (antes no había panel en el
  teléfono). En escritorio, ninguna. Va a deuda, porque la regla de la tanda es no
  añadir peticiones al abrir la agenda.
- **Los avisos viajan en la respuesta de `GET /api/agenda/por-confirmar`**, la
  petición de siempre: abrir la agenda no pide nada más. `GET/PATCH /api/avisos`
  sirve a cualquier otra página (el hook en modo no controlado).
- **Revisar un aviso.**
  - Pulsarlo lo marca revisado (optimista y luego el PATCH) y lleva a su cita con
    `irACita`: su día en Día y su tarjeta. Si el PATCH no responde bien, la revisión
    optimista se deshace.
  - Fuera de la agenda, cada aviso es un enlace a `/agenda?cita=<id>`, que abre la
    cita, retira el parámetro y distingue «no se pudo abrir» de «no existe».
  - «Marcar todos como revisados» manda SÓLO los ids a la vista. La API ya no acepta
    «todos los de la clínica»: `{ todos: true }` da 400.
  - Lo de este punto viene de la revisión independiente, cada cosa con su prueba en
    `agenda-i5-barra-avisos` y su mutación en rojo.
- **Avisos emergentes.**
  - Salen sólo de los avisos que llegan con la agenda abierta: la primera lista, al
    abrir, no suena.
  - Sólo de reserva por enlace, reagendado y Google por asignar. La cancelación y el
    empalme ya tenían su aviso emergente (E8, D11), y repetirlo daba dos.
  - Sin nombres en el emergente, como E8.
  - El de Google por asignar no tiene e2e propia (la sincronización la dispara una
    petición del servidor); la regla está en Vitest (`avisosParaEmergente`).
- **«Por confirmar» (punto 17).** Cada fila es una rejilla `datos | WhatsApp |
  correo` de columnas fijas: 38 px, sólo icono, con nombre accesible. Si falta un
  medio, su celda queda vacía y el otro no se corre. El estado va en UNA línea
  debajo («WhatsApp abierto 00:35 · Correo enviado 00:35»).
- **El correo a la clínica por cada reserva: a quién va y qué lleva — PARA REVISIÓN
  DE ANGEL** (punto 20).
  - **Destinatarios:** los administradores de la clínica (`es_admin_de_clinica`,
    hasta 3, con el correo de Auth). La clínica no tiene columna de correo propia.
  - Sale también en los reagendados por el paciente, con su asunto.
  - **Lleva:** nombre, fecha, hora, médico y consultorio.
  - **No lleva:** tipo de cita, teléfono, correo del paciente ni enlace a la agenda.
  - Se audita en `audit_log` (`correo_reserva_clinica`, sin correos ni nombres). NO
    se apunta en `cita_correos`: ese registro es de correos al paciente y lo lee la
    tarea de recordatorios.
- **El correo a la clínica viene APAGADO de fábrica — PARA REVISIÓN DE ANGEL.**
  - Columna `agenda_ajustes.correo_reserva_clinica`, DEFAULT false. Se enciende en
    Configuración → «Plazos y recordatorios» → «Avisar por correo de cada reserva».
  - Sin la columna, no se manda nada.
  - «Restablecer» no toca la opción, igual que el recordatorio: sólo quien la
    encendió la apaga.
- **El aviso de Google por asignar usaba el criterio de I3** (sin paciente, sin
  reserva, con hora y por venir), con columnas que existen sin I3 (auditoría,
  hallazgo 1). *(Superado en la integración: usa la marca de I3; ver abajo.)*
- **`avisos_clinica` sólo la escriben los disparadores `aviso_clinica_de_*`** (dueño
  postgres); el personal sólo marca revisado. El índice único parcial (tipo,
  cita_id) WHERE revisado_en IS NULL es de la tabla nueva.
  - La migración inserta el arrastre: empalmes de 30 días y cancelaciones del
    paciente de 48 h.
  - Los disparadores AFTER nuevos van sobre `appointments`, `cita_confirmaciones`,
    `cita_reagendos` y `reserva_empalmes_google`.
  - Ninguna policy existente cambia.
- **Medición** (intercalada contra `0349221`, 7 rondas, escritorio 1440, v2
  encendida, mediana):
  - apertura en frío: 232 → 234 ms;
  - peticiones fetch/xhr al abrir: 9 → 9;
  - JS transferido: 544 → 549 KB (+5 KB). La campana, el engrane y las listas entran
    en el chunk de la agenda de forma estática;
  - vuelta desde el dashboard: 167 → 164 ms.

#### Integración de la tanda I (decisiones sin preguntar)

- **Fusiones.** Cinco, con `--no-ff`. Hubo conflictos de texto en seis sitios:
  - `AppointmentModal.tsx`: `eleccion`/`reagendando` de I2 con `porAsignar` de I3;
    se conservan los dos;
  - `InteraccionesV2.tsx` y `accionesTarjeta.ts`: `no-es-cita` de I3 con `reasignar`
    de I4; quedan las dos acciones;
  - `audit.ts`: las acciones nuevas de I3, I4 e I5;
  - `src/app/api/reservar/[codigo]/route.ts`: el único sin correo de I2 con el aviso
    a la clínica de I5;
  - `HerramientasV2.tsx`: el arreglo de I1, dentro del botón de fecha nuevo de I5.

  Para compilar, `correoClinicaReserva.ts` (I5) necesitó `remitente: ''`, que I2
  hizo obligatorio.

  Los temporales de los agentes se movieron fuera del worktree, a
  `/home/spinus/proyectos/tanda-I-temporales/{i1..i5}`, porque `tsconfig` y
  Playwright los recogían. Las notas los citan con su ruta vieja,
  `e2e/resultados/reglas/tmp/iN/`.
- **El aviso a la clínica sale como «Spinus», no a nombre del médico — PARA
  REVISIÓN DE ANGEL.** Es la consecuencia del `remitente: ''` de arriba: un correo
  interno de la clínica.
- **El único sin correo también avisa a la clínica.** Fusionada tal cual, la ruta
  hacía `return` cuando no había correo, y se saltaba el aviso de I5. Ahora el
  comprobante es condicional y el aviso a la clínica sale siempre. Lo fija la e2e
  «20 · el único sin correo también avisa a la clínica», en rojo con el `return`.
- **«¿No es una cita?» en la campana.** I3 dejó el contrato para I5.
  - Se monta `BotonNoEsCita` al lado (no dentro) del aviso `google_por_asignar`
    cuya cita sigue por asignar. Al pulsarlo, el aviso queda revisado.
  - La lectura de avisos pide `reserva_canal` y `google_asignacion`, y cae a la de
    antes si falta la columna.
  - Lo fijan Vitest y la e2e «punto 10 · campana», en rojo sin el botón.
- **El aviso de Google usa la marca de I3.** Se editó `20261121150000` en su sitio:
  nada está aplicado en producción.
  - El WHEN es ahora `NEW.reserva_enlace_id IS NOT NULL OR NEW.google_asignacion =
    'por_asignar'`, en vez de copiar el criterio sin el «quién».
  - Con el criterio copiado, un INSERT de postgres, o de la sesión con origen
    google, dejaba un aviso de algo que la agenda no marcaba.
  - `cambioPuedeAvisar` usa la misma marca.
  - Prueba SQL i5, caso 2, en rojo con el WHEN viejo.
  - Detalle: `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` §11.3 C.
- **La pregunta de asistencia de I4 deja fuera los «por asignar»**, porque su
  consulta pide paciente o canal de reserva. Se dejó así por ser el menor cambio;
  queda anotado como deuda.
- **Tolerancia a las columnas de I4 ausentes.** Se probó el código contra la base sin
  las siete migraciones y con la v2 encendida: guardar un horario y crear una cita
  con `sustituye_a` daban 500. Ahora:
  - el PATCH reintenta sin `horario_revisado_en`;
  - `comprobarSustituible` no veta si faltan las columnas.

  Commit `e409396`; §11.7 de la auditoría del conjunto.
- **Un selector viejo.** `agenda-reflejo-enlace` (I1) abría la configuración con el
  engrane de antes; ahora sigue el menú del engrane de I5.
- **Seis e2e de la batería completa, todas de la prueba** (`067972c`; detalle en
  §9, «Tanda I», paso 5). La que importa para lo que venga: **cada archivo de e2e
  deja la v2 APAGADA al terminar.** Ocho de la tanda la dejaban encendida, y las
  que la suponen apagada caían en el aviso de empalme.
- **Rendimiento:** +12 KB de JS con la v2 apagada y +18 ms al abrir con la red
  limitada (AG-DT-136, sin tocar). El resto, dentro del ruido (§9, «Tanda I»,
  paso 7).

#### Para revisión de Angel (resumen)

- **I1 · el canal de tiempo real vive 2 min tras salir de la agenda**, también
  después de cerrar sesión. SUPOSICIÓN sin verificar: que Realtime vuelva a evaluar
  la RLS con el token nuevo.
- **I1 · la semilla no se podía rehacer:** dos notas clínicas hechas a mano
  («Paciente Prueba 13» y «15»). **Hecho en la integración, por encargo:** se
  respaldaron con sus pacientes, sus dos citas y sus 8 filas de auditoría en
  `e2e/resultados/respaldo_consultas_angel_2026-11-15.json` (sin seguimiento) y el
  reinicio desde cero las borró. Si las quieres de vuelta, están ahí.
- **I2 · el único sin correo lleva un seudónimo por reserva**
  (`sha256('reserva-sin-correo:'||id)`), no NULL.
- **I2 · sin correo, el paciente no recibe ningún correo** (ni comprobante, ni
  confirmación, ni recordatorio), y la página no lo promete.
- **I2 · la etiqueta del único pasa a «Correo electrónico (opcional)»**, sin paso de
  código.
- **I2 · el único con el correo de un tercero** (MEDIA, ya existía, AG-DT-70): hay que
  elegir entre ignorar el correo, mandar sólo a uno verificado o aceptar el riesgo
  por escrito.
- **I2 · candado:** médico, consultorio, fecha y hora de inicio cerrados; el fin
  libre; estirar desde arriba, rechazado.
- **I2 · reagendar conserva el estado de confirmación**; el correo de cambio pide
  confirmar de nuevo.
- **I2 · Google ya no mueve una cita por enlace futura:** Spinus le devuelve su hora
  (cambia D4).
- **I2 · el remitente lleva el nombre del médico entre comillas.** Falta comprobar con
  un envío real que Resend lo acepta.
- **I2 · el correo lleva al médico y al consultorio en el encabezado**, y «Enviado con
  Spinus» al pie.
- **I3 · los eventos de Google de todo el día o ya terminados entran como evento**, no
  «Por asignar».
- **I3 · sin relleno de filas viejas:** sólo lo importado después de la migración sale
  «Por asignar».
- **I3 · los conteos de `/inicio`, `TarjetaHoy` y `HoyEnConsultorio` no cuentan las
  por ligar ni las por asignar.**
- **I3 · `useEscudoTrasRegistro` es un gancho nuevo en `src/hooks/`**; según el
  Protocolo 4, necesita el OK de Angel.
- **I4 · todos los consultorios existentes nacen con el horario «por revisar»**: cada
  médico lo verá una vez en producción.
- **I4 · la pregunta de asistencia sale para las citas que empezaron hace más de
  48 h**, sin nota, hasta 50 por apertura.
- **I4 · la cita por ligar en la pregunta de asistencia:** «No asistió» cuenta para el
  candado, como marcarla a mano.
- **I4 · la cancelada se cierra (`cerrada_en`, `sustituida_por`), no se borra**, y sólo
  si la nueva tiene paciente.
- **I4 · una cancelada cerrada no se ve en ninguna pantalla**; hay una propuesta de
  línea en la sustituta.
- **I4 · cualquiera que vea una cancelada puede cerrarla** creando una cita con
  `sustituye_a`, sin exigir el mismo paciente, médico ni hueco.
- **I5 · una petición más al abrir la agenda en el teléfono**, por la campana.
- **I5 · el correo a la clínica** va a hasta 3 administradores, con nombre, fecha,
  hora, médico y consultorio, y sale también en los reagendados.
- **I5 · el correo a la clínica viene apagado de fábrica**, y «Restablecer» no lo
  toca.
- **Integración · el aviso a la clínica sale a nombre de «Spinus»**, no del médico.

---

## 8. Sin verificar — comprobar antes de apoyarse en ello

- Las causas de lentitud no están cronometradas. A0 las mide.
- Si el webhook de Google exige verificar el dominio.
- Que `calendar.app.created` siga clasificado como no sensible (Angel lo
  comprobó al publicar la app; aquí no se pudo abrir la documentación de
  Google).
- Que `events.watch` siga aceptando `calendar.app.created` (dato de un resultado
  de búsqueda de unos seis meses de antigüedad).
- Que la base de producción coincida con el esquema del repo.
- Varias entradas de `DEUDA_TECNICA.md` citan líneas viejas, y al menos
  `AG-DT-5` y `AG-DT-6` parecen ya corregidas en el código: verificar antes de
  «arreglarlas».

**Verificado el 2026-11-11 contra la documentación oficial de Google** (URL y
cita en el informe de la sesión):
- Causas de lentitud: medidas en A0 (ver §9).
- Webhook: **ya no exige verificar el dominio**
  (support.google.com/googleapi/answer/7072069, «no longer required»). Sí
  exige HTTPS con certificado válido; el aviso llega sin cuerpo; los canales
  caducan (7 días por omisión, máximo no documentado) y no se renuevan solos;
  Google advierte que pierde mensajes, así que el sondeo con `syncToken` es
  obligatorio de todos modos. `robots.txt` puede bloquear la entrega.
- `events.watch`, `events.list` (con `syncToken`), `get`, `update`, `patch`,
  `delete` y `calendars.insert` aceptan `calendar.app.created`. `channels.stop`
  no documenta scopes.
- `syncToken` no se combina con `timeMin`, `timeMax`, `orderBy`, `q` ni
  `privateExtendedProperty` (400): el bucle de sincronización es una llamada
  aparte de la de pintar. Los borrados llegan como `status: cancelled` (solo
  `id` garantizado: mapear por `google_event_id`). 410 → sincronización
  completa.
- Conflictos: `etag` + `If-Match` → 412 (documentado para `update`/`delete`;
  en `patch` no explícito). `patch` cuesta 3 unidades de cuota.
- `attendees[].responseStatus` se lee con este scope; que un RSVP llegue por
  `syncToken` o push no está documentado: prueba con cuenta real.
- `extendedProperties.private` sirve para marcar el id de Spinus (nunca
  `shared`, que ve el invitado).
- **Sigue sin fuente pública:** que `calendar.app.created` sea no sensible
  (la documentación remite a Cloud Console → Acceso a los datos). Lo vuelve a
  mirar Angel. Cuotas: 600/min por usuario y 10,000/min por proyecto;
  facturación por exceso anunciada para finales de 2026.
- Recomendación para C: sondeo con `syncToken` (al abrir la agenda + tarea
  programada) primero; webhook después, solo como acelerador.

---

## 9. Avance

Marcar aquí y hacer commit al cerrar cada punto. Quien retome empieza por el
primero sin marcar.

- [x] A0 — Pruebas del inventario y línea base de carga (2026-11-11)
  - Entorno: worktree `~/proyectos/app_ortointegra-agenda` (la carpeta de
    siempre queda en `feature/limites-ajustables`). Base local sembrada con
    `npx tsx scripts/agenda-semilla.ts` (ver `scripts/agenda-semilla.md`).
    Pruebas: `npm run build && npx next start -p 3001`, luego
    `npx playwright test` (el `globalSetup` aborta si el build es más viejo
    que `src/`). Medición: `MEDICION_ETIQUETA=<paso> npx playwright test
    --config=playwright.medicion.config.ts`.
  - Red: 45 pruebas de navegador (escritorio 1440×900 y teléfono 390×844),
    cada una comprobada con una mutación que la pone en rojo. Dos `test.fail()`
    declarados: **Google lento (8 s) retrasa todas las citas** (objetivo A1) y
    **defecto: «Ver todos los médicos» de la banda de vacío sigue filtrando**
    (`setFiltroMedico('')` sin `aplicarFiltro`; no se arregla de paso).
  - `npm run lint` ya fallaba en `main` (96 errores previos, 2 en
    `agenda/page.tsx`): criterio = ningún error nuevo.
  - **Línea base A0** (local, admin.a, mediana de 5; servidor y base sin
    latencia entre sí):

    | Medida | A0 |
    |---|---|
    | Primer evento visible, apertura en frío | 325 ms |
    | Ídem con red limitada (60 ms, 10 Mbps) | 913 ms |
    | `GET /user` contra Auth al abrir | 5 (4 servidor + 1 navegador) |
    | Semana siguiente / anterior, citas visibles | 175 / 168 ms |
    | Volver desde /dashboard, citas visibles | 125 ms |
    | JS transferido en /agenda | 484 KB (mayor chunk 147 KB) |
    | Google con 8 s de retraso | ninguna cita antes de 8 s |
- [x] A1 — Abrir rápido
  - Decisiones: ningún `getUser()` pasa a `getClaims()`; A1.7 (Google sembrado
    en servidor con cliente admin) queda fuera; la caché de rangos es la
    versión mínima (se vacía entera ante cualquier escritura o tiempo real).
  - Hecho: A1.1 resta de Google en paralelo · A1.2 perfil sembrado desde el
    layout · A1.3 Google fuera del camino crítico (causa: FullCalendar no pinta
    ninguna fuente mientras otra carga) · A1.4a `page.tsx` → `AgendaCliente.tsx`
    + página de servidor · A1.4b consulta en `lib/agenda/consultaCitas.ts` ·
    A1.4c semilla de W-1..W+1 desde el servidor (`sesionServidor` con
    `React.cache` compartido por layout y página) · A1.5a caché de rangos ·
    A1.6 configuración sembrada desde el layout · A1.8 índices de rango
    (migración `20261111120000`, auditada; **producción: la aplica Angel**) ·
    A1.9 `ag-entra` solo para `.ag-ev-nuevo`.
  - Decisión consciente a revisar por Angel: la semilla manda en cada
    apertura tres semanas de citas (con nombre, teléfono y correo del
    paciente) en vez de una; mismos datos y misma RLS que la API, sin salir a
    terceros.
  - Medido en local (mediana): `GET /user` al abrir 5 → 2 (1 en el camino
    crítico; Google después de pintar); `/api/appointments` al abrir 1 → 0;
    red limitada 913 → 745 ms; semana vecina ~80 ms, semana ya vista 53 ms y
    volver desde /dashboard 78 ms sin petición; Google a 8 s ya no retrasa las
    citas (antes 8.2 s). El cambio de semana de A0 (175 ms) se midió con el
    método viejo y no es comparable.
  - A1.5b precarga W±1 en ocioso al navegar (W+1 → W+2 en 66 ms sin
    petición). A1.10 cerrado sin cambio (ver A1-bis).
  - Cerrado 2026-11-12 (medición final `A1`: Auth 2, red limitada 743 ms,
    semana vista 51 ms, volver 78 ms, salto tras precarga 80 ms, 0 bloqueantes).
- [x] A1-bis — Revisión completa de eficiencia y presupuesto de rendimiento (2026-11-12)
  - Medido con build instrumentado (`npx playwright test
    --config=e2e/playwright.a1bis.config.ts`). Sin ciclos; en reposo 0
    estados y 0 peticiones.
  - A1-bis.1: las ~30 mutaciones por cita en `batchRendering`. UPDATE de
    tiempo real (el del `after()` de Google en todas las agendas abiertas):
    34 repintados de FullCalendar → 3; con 30k citas 294 ms con tarea larga →
    14 ms. Guardar 444 → 122 ms; arrastrar 378 → 83 ms.
  - A1-bis.2: props estables de FullCalendar (0 opciones re-refinadas por
    render). Con 30k: abrir 109 → 44 ms, semana siguiente 122 → 52 ms, abrir
    el modal 22 → 0 ms.
  - A1.10 sin cambio: `count: 'exact'` cuesta +0.7 ms en el camino por
    defecto; sin él no se detecta el truncado. Lo que cuesta es la RLS por
    fila (PERF-DT-4, medido en `supabase/auditorias/A1.8-…`): no se toca sin
    auditoría propia.
  - Pasado a otros bloques: invalidación fina de la caché por rango (A2/B; hoy
    cualquier evento de tiempo real, de cualquier clínica, la vacía entera);
    sondeo de `ModalInvitacionCita` con tiempo real como vía rápida (C); no
    pedir Google tras `sin_token` (C); carga diferida de modales, ~17 KB gz
    (A2).
  - **Decisión de Angel pendiente:** `ProximasCitas` vuelve a consultar en
    cada vuelta a la pestaña sin tope; ponerle uno cambia lo fresco que se ve.
- [x] A2 — Partir `agenda/page.tsx` (2026-11-12)
  - `AgendaCliente.tsx` (antes `page.tsx`): 9,558 → 1,781 líneas. Todo
    movimiento verificado (líneas quitadas = añadidas, salvo pegamento) y un
    revisor independiente sin hallazgos de comportamiento.
  - `src/lib/agenda/`: tiposAgenda, horarioAgenda, fechasAgenda, huecosAgenda,
    conteoAgenda, vistasAgenda, tarjetasAgenda, eventosDeCita, traidaCitas,
    ocioso, duracionCita (+ cachés y semilla de A1).
  - `src/components/agenda/`: tarjetas (MemoizedEventContent, MonthChip,
    BandaChip, GoogleEventCard, FilaLista*, render*), modales (AppointmentModal,
    HorarioModal, ConfirmModal; `useDialogoModal` en `src/hooks/`), paneles,
    banda móvil, CabeceraEscritorio, BarraAgendarMovil, AvisosAgenda,
    LeyendaEstados, opcionesCalendario.
  - Junto a la ruta (`src/app/(app)/agenda/`): useFiltroMedico,
    useVentanaRejilla, useResumenVisible, useFuentesAgenda (fuentes, candado de
    gesto, precarga), useTiempoRealAgenda, guardadoCitas, altaCitas.
  - A2.6: modales con `next/dynamic` precargados en ocioso (~19.6 KB gz fuera
    del camino crítico).
  - Lint: el compilador de react-hooks se saltaba `AgendaCliente` entero (tiene
    `async function`); en los ganchos nuevos aparece el patrón «último valor»
    que FullCalendar exige (lee en su montaje, antes de los efectos del padre).
    Marcado con `eslint-disable-next-line` justificado en cada línea; total
    de lint 96 errores, igual que en `main`.
  - Arreglado de paso, con su prueba: «Ver todos los médicos» de la banda de
    vacío no limpiaba el filtro (defecto hallado por la red de A0).
  - Medición final del bloque A (`A2`): Auth 2 (1 en el camino crítico), red
    limitada 712 ms, semana vecina 61 ms, ya vista 50 ms, tras precarga 48 ms,
    volver 71 ms, 0 bloqueantes.
  - Pruebas al cierre: 818 Vitest, 73 e2e.
  - Queda escrito, sin tocar: el bloque comentado del `QuickPatientModal`
    viejo dentro de `AgendaCliente.tsx` (~100 líneas muertas; se pregunta
    aparte por el Protocolo 2).
- [x] B — Cimientos (2026-11-12)
  - P-0 pruebas SQL · B0 auditoría de citas (siempre encendida) · B1 ajustes e
    interruptor por clínica · B2 la cita ya no se duplica al deshacer tras una
    traída · B3 cancelar en vez de borrar · B4 pantalla de configuración
    (`/agenda/configuracion`) y P8 · B5 disponibilidad por consultorio · B6
    tipos de cita (esquema, API, modal y rutas) · B7 aviso de empalme
    (servidor + cliente) · B8 turnos en la zona del consultorio · tope de 2 min
    en `ProximasCitas` · borradas las líneas muertas de `QuickPatientModal`.
  - Migraciones (solo en local; van a producción como conjunto al final):
    `20261112120000` B0, `20261112130000` B1, `20261112140000` B5,
    `20261112150000` B6. Cada una con auditoría independiente: APTA.
  - Pruebas al cierre: 961 Vitest, 4 archivos SQL, 113 e2e.
  - Decisiones: §6-bis («Bloque B — decisiones tomadas al construir»).
  - Abierto y documentado en `DEUDA_TECNICA.md` (E5-DT-8): si otra persona
    borra la cita a mitad del arrastre, al soltar queda una tarjeta fantasma.
- [x] C — Google en los dos sentidos (2026-11-13)
  - C0 deuda (AG-DT-5 cerrada; LP-DT-6 pendiente de la prueba con cuenta real)
    · C1 estado de sincronización, candado y puerta S3
    (`gcal_sync_clinica_habilitada`) · C2 aplicar e importar con C-d, C-e y S1
    en la base, y `via:'google'` en la auditoría · C3 decisión pura · C4
    orquestador con paginación y 410 · C5 escritura saliente v2
    (`extendedProperties.private`, `etag`/`If-Match`, conflicto auditado,
    `attended`, restablecer citas cerradas) · C6 sondeo al abrir la agenda
    (`POST /api/google/sync`, 60 s mínimos) · C7 tarea programada
    (`/api/cron/google-sync`, `CRON_SECRET` en tiempo constante, cada 10 min
    en `vercel.json`; sin activar) · C8 e2e contra un Google falso (solo en
    `next dev` local; la guarda impide activarlo en producción).
  - Migraciones (solo local): `20261113120000` C1, `20261113130000` C2, con
    auditoría independiente APTA CON CAMBIOS aplicados.
  - Pruebas al cierre: 1106 Vitest, 7 archivos SQL, 120 e2e.
  - Lo activa Angel: `CRON_SECRET` en Vercel, desplegar, prueba con cuenta
    real (§7). Antes de encender: revisar el panel de auditoría (C-h).
  - Diseño: `e2e/resultados/plan_C.md` del worktree de `feature/agenda-v2`,
    acotado por C-a, C-d, C-e y S1-S3 de §6-bis, que mandan.
  - C0 (2026-11-13): AG-DT-5 cerrada en `DEUDA_TECNICA.md` (la arregló
    `18b9864`, verificado en el código); LP-DT-6 anotada: sigue abierta hasta
    la prueba con cuenta real, y «en tiempo real» sigue prohibido sin webhook.
  - C1 (migración `20261113120000`, auditada APTA CON CAMBIOS, aplicados):
    `gcal_sync_estado`, candado con testigo, listado del cron y la puerta S3.
    C2 (`20261113130000`, APTA CON CAMBIOS, aplicados): espejo, aplicar,
    importar y `"via":"google"` en `log_cita_change`. Las dos solo en local.
  - C3: `src/lib/gcalSincronizacionDecidir.ts`, decisión pura. C4:
    `gcalSincronizacionBase.ts` (única puerta a las RPC),
    `gcalSincronizacion.ts` (`sincronizarClinica`, que hoy no llama nadie),
    `listarConexionesParaSincronizar` en `gcalConexion.ts`, cerrojo nuevo y
    `supabase/pruebas-sql/c4_gcal_flujo.sql`.
  - C5 (2026-11-13): escritura saliente v2 (`src/lib/gcalEscritura.ts`,
    `gcalSincronizacionRestablecer.ts`; rutas de citas y de consultas): marca
    privada, `etag`, `If-Match` + 412, gana el último auditado, `attended` y
    restablecer. C6: `POST /api/google/sync`, sondeo en ocioso en la agenda,
    sin duplicados en la vista de Google, desvío a un Google falso con doble
    guarda y e2e `agenda-google-dos-sentidos.e2e.ts` (contra `next dev` :3002;
    cubre lo de C8 salvo 410 y paginación, que cubren Vitest y SQL).
  - Falta: C7 (cron y middleware, en otro agente). Decisiones: §6-bis,
    «Bloque C — decisiones tomadas en C0-C4» y «… en C5-C6».
- [x] D — Reserva por enlace (2026-11-13)
  - D0 transporte de correo (`EMAIL_TRANSPORT`: `captura` a Mailpit en local,
    `resend` solo con Supabase remota) · D1 enlaces (código derivado por HMAC,
    solo se guarda su sha256) · D2 candado e incidencias · D3 reserva
    transaccional (candado por médico; dos reservas al mismo turno dejan una
    sola cita, probado en carrera real) · D4 Google no reescribe el título de
    una cita por ligar · D5 página y API públicas `/reservar/{código}` y
    `/api/reservar/{código}` (404 uniforme, límites por IP, dispositivo, correo
    y enlace) · D6 marca «Por ligar · N», historial y bloqueos · D7 ligar al
    iniciar la consulta (con consentimiento) · D8 evento de Google y comprobante
    capturado · D9 aviso de privacidad **PENDIENTE DE REVISIÓN LEGAL**, el
    enlace no abre hasta que Angel apruebe su hash (`npx tsx
    scripts/aviso-reserva-hash.ts`) · D10 e2e.
  - Gestión: `/agenda/configuracion` (enlaces y contactos bloqueados).
  - Migraciones (solo local): `20261114120000` D1, `130000` D2, `140000` D3,
    `150000` D4, con auditoría independiente.
  - Variables nuevas (las configura Angel en Vercel): `RESERVA_SECRETO` (si se
    rota, se invalidan todos los enlaces y el historial del candado),
    `EMAIL_TRANSPORT=resend`. En local: `EMAIL_TRANSPORT=captura`,
    `RESERVA_AVISO_BORRADOR_LOCAL=1` (solo e2e, solo loopback).
  - Pruebas al cierre: 1239 Vitest, 12 archivos SQL, 145 e2e (dos corridas).
  - **Hallazgos para la auditoría (no corregidos):**
    - Aislamiento: el PUT normal de una cita que cambia de un paciente a otro
      no comprueba que el paciente sea de la clínica (preexistente; el ligado
      nuevo sí lo comprueba). Encaja en el pendiente prioritario de
      `CLAUDE.md`.
    - Con el interruptor apagado, alguien de la clínica podría crear filas de
      reserva de su propia clínica por PostgREST directo (la RLS no mira el
      interruptor).
    - Un `DELETE` directo por PostgREST de una cita con paciente no se bloquea
      (B3 lo bloquea en la API).
    - Seis rutas viejas (registro, reset-password, email-hook,
      reenviar-confirmacion, enviar-documento, admin/invitar) llaman a Resend
      directamente: en local podrían mandar correos reales con la llave de
      `.env.local`. Ninguna prueba las dispara.
    - El historial del candado no tiene purga automática (el aviso propone 12
      meses; plazo a fijar con la revisión legal).
    - Si Google falla al crear el evento de una reserva, la cita queda
      `pending` (no `failed`); la primera edición reintenta.
    - Los scripts de prueba limpian con `session_replication_role = replica`
      para borrar sus propias filas de `audit_log` en la base local: no debe
      usarse fuera de pruebas.
- [x] E — Recordatorios y confirmación de asistencia (2026-11-14)
  - E1 enlace de confirmación (`cita_confirmaciones`, solo el sha256 del
    código) y `via` en la auditoría (`google`, `enlace_paciente`,
    `google_rsvp`); clínica suspendida = «no disponible» (hallazgo de la
    auditoría, corregido) · E2 código del enlace (subllave `confirmacion` de
    `RESERVA_SECRETO`) · E3 página `/confirmar/{código}` que solo LEE; el
    estado cambia solo con el POST de un botón (abrir el enlace, una vista
    previa de correo o de WhatsApp no cambian nada, probado); cancelar hasta
    T-1h, en dos pasos · E4 recordatorio por correo N horas antes (ajuste) con
    registro de envíos idempotente y tarea `/api/cron/recordatorios` (S2, cada
    15 min en `vercel.json`, sin activar) · E5 comprobante con enlace (solo
    reserva por enlace) registrado en `cita_correos` · E6 reagendar desde «no
    podré asistir» con tope de 2 · E7 WhatsApp manual (`wa.me/521…`, formato
    verificado en la ayuda oficial de WhatsApp; el enlace se emite solo al
    pulsar) · E8 aviso a la clínica cuando el paciente cancela · E9 RSVP de
    Google detrás de `AGENDA_RSVP_GOOGLE` (apagado; lo prueba Angel con cuenta
    real) · E10 e2e.
  - Migraciones (solo local): `20261115120000` E1, `130000` E6, `140000` E4,
    `160000` E9, con auditoría independiente.
  - Textos del correo, de la página y de WhatsApp: **PENDIENTE DE REVISIÓN**.
  - Cumplimiento a revisar por Angel: mandar recordatorios por correo y avisos
    por WhatsApp a pacientes **existentes** quizá no lo cubre su consentimiento
    actual (LFPDPPP 2025).
  - Pruebas al cierre: 1394 Vitest, 16 archivos SQL, 163 e2e.
- [x] F — Interfaz, movimiento y orden visual (2026-11-12)
  - Superficie (F1, las 18 propuestas): `054e923`..`bfd0621`. Movimiento (F2):
    fusión `8988f45`. Interacciones v2 (F3: burbuja, tarjeta, minicalendario,
    buscador, atajos, deslizar): fusión `0729e24`. Integración y cierre:
    `2552a2f` (herramientas v2 en sus ranuras de barra y banda, `atajos`
    cableado, dos defectos de código y cuatro de prueba de la fusión) y
    `a240295` (sesión de «Compactar» que sólo se ensancha; F1.5 apagado,
    pendiente de Angel). Decisiones: §6-bis, las cuatro subsecciones de F.
  - Verificación al cierre (build de `a240295`): `npm run build` limpio; lint
    96 errores (los de siempre); Vitest 1642 en 110 archivos; SQL 16 archivos;
    Playwright 239 pasan, 0 fallan (escritorio 199, teléfono 37, tableta 3; 206
    saltadas por proyecto). Las once e2e de F corrieron juntas por primera vez.
  - Presupuesto de A (`F-final`, mediana de 5, misma máquina; «base» es
    `e932f75`, antes de F): Auth 2 (=), apertura 254 ms (base 256), red
    limitada 725 (717), semana siguiente 67 (62), anterior 65 (62), ya vista 49
    (48), tras precarga 49 (47), volver 75 (72), 0 bloqueantes; JS 539 943 B
    (+5,0 KB sobre la base: barra plegable, densidad, tableta, ranuras de F3 y
    la tabla de atajos). La semana siguiente queda ~5 ms por encima en todas
    las medidas desde la fusión de F2/F3, también con F1.5 apagado: no viene de
    F1.5 y no se aisló (candidatos: el fundido de navegación o el
    `setRangoVisible` de cada `datesSet`).
  - Cuadros (`capturar.ts --solo=cuadros --cpu=4`, mes lleno con
    `--volumen 2000`, una muestra por tramo; perdidos/peor ms/tareas largas en
    total sobre 22 tramos): antes 45 / — / 18; después 62 / — / 17; con v2 70 /
    — / 18. El peor cuadro por tramo es igual o mejor en casi todos (p. ej.
    `mes-siguiente-1` 149 → 135, `baja-con-salida` 101 → 82); los perdidos de
    más se concentran en `semana-siguiente-2/3` del «después» (9 y 5), que con
    v2 dan 2 y 2: con una muestra a CPU ×4 la variación entre corridas es de
    ese orden. Tabla completa en `comparativa/index.html` y
    `comparativa/cuadros-antes-despues.json`.
  - Entrega (fuera de git, en `e2e/resultados/F/`): `despues/` (51 capturas,
    mismos nombres que `antes/`), `despues/v2/` (82), vídeos en
    `despues/video/` (7, más sus 7 con movimiento reducido) y
    `despues/v2/video/` (10), y `comparativa/index.html`.
  - Lo que no se pudo probar en local: el rendimiento en un teléfono y una
    tableta reales (todo es Chromium emulado, también el arrastre táctil y el
    deslizar); lectores de pantalla reales sobre las capas v2; la batería
    A1-bis instrumentada; F1.5 con datos de una clínica real.
- [x] D11 — Sincronización con Google antes de reservar por enlace (decisión
  de Angel, 2026-11-12; rama `feature/agenda-v2-dsync`, worktree
  `~/proyectos/app_ortointegra-agenda-b56`)
  - GET de turnos: pasada incremental si la última buena tiene más de 60 s ·
    POST: siempre, justo antes de la RPC (que no cambia), esperando el candado
    si otra pasada lo tiene · tope de 4 s que aborta `events.list` y el
    restablecimiento · si Google falla o tarda, reserva sólo con una buena de
    menos de 30 min; si no, 503 con el teléfono · empalmes con reservas por
    enlace: registrados una vez por par, auditados y en el panel «Por
    confirmar». Decisiones: §6-bis «Bloque D — sincronización con Google
    antes de reservar».
  - Migración (sólo local): `20261116120000` D11 (`gcal_sync_frescura`,
    `reserva_empalmes_google`, `reserva_empalmes_registrar`), con revisión
    independiente APTA CON CAMBIOS aplicados; auditoría formal pendiente.
  - e2e `e2e/reserva-google.e2e.ts` contra el Google falso (`next dev` :3002),
    que ganó demora y fallo configurables para `events.list`. Cada caso, en
    rojo con su mutación (quitar la sincronización del GET, la del POST o el
    aviso de empalmes; ventana de 60 min; tope de 20 s; quitar la espera del
    candado).
  - Pruebas al cierre: 1670 Vitest, 17 archivos SQL, `reserva-carrera.sh` en
    verde (con candado 1 cita; control sin candado, 2). Batería Playwright
    contra un `next start` propio en :3003: 216 pasan, 19 fallan y 210 se
    saltan; los 19 (agenda-empalme y agenda-f-atajos, -buscador, -minimes,
    -movimiento, -tarjeta: el aviso de perfil incompleto de la barra lateral
    anima fuera de la regla y altas que chocan con la semilla) fallan IGUAL
    con `src/` en `0729e24`: preexistentes, no de D11. Para correrla desde
    este worktree se cambió `localhost:3001` por `:3003` en las e2e SIN
    commitear (el :3001 es de otro worktree).
- [x] Cierre del proyecto (2026-11-12, worktree `~/proyectos/app_ortointegra-agenda`)
  - (Aquí había un «- [ ] F» repetido, resto de la fusión de D11: F está
    cerrado arriba.)
  - **Paso 1 · verificación de la fusión `591aed1`** (base local tal como
    estaba, con las tres `20261014*` de `feature/limites-ajustables` en su
    historial): `npm run build` limpio; `npm run lint` 96 errores (los de
    siempre); Vitest 1684 en 112 archivos; SQL 17 archivos en verde;
    Playwright 244 pasan, 0 fallan, 211 saltadas (escritorio 204, teléfono
    37, tableta 3; 7.5 min), con `agenda-google-dos-sentidos` y
    `reserva-google` levantando su propio `next dev` :3002 contra el Google
    falso; `reserva-carrera.sh` y `confirmacion-carrera.sh` en verde. Los 19
    fallos que D11 vio en :3003 no salen contra el `next start` :3001 de
    este worktree (los arregló el cierre de F, `2552a2f`/`a240295`). Nada
    que arreglar.
  - **Paso 2 · el conjunto desde cero** (CLI 2.117.0 de fnm, `supabase db
    reset --local --workdir` de este worktree; antes, comprobado sin imprimir
    secretos: `NEXT_PUBLIC_SUPABASE_URL` = `127.0.0.1:54321`, sin
    `project-ref` en `supabase/.temp`, sin variables `SUPABASE_*`/`PG*` en el
    entorno, contenedor `supabase_db_app_ortointegra`). 21 migraciones (5 de
    `main` + las 16 del proyecto) aplicadas en orden sin un solo fallo, 48 s
    de reinicio completo; `schema_migrations` = 21, última `20261116120000`.
    El reinicio recreó los contenedores con las imágenes que fija la 2.117.0
    (Postgres 17.6.1.167, antes 17.6.1.084; storage-api nueva) y avisa
    `no files matched pattern: supabase/seed.sql` (no hay seed.sql: normal).
    Semilla `agenda-semilla.ts` en 1.4 s (A: 25 pacientes, 348 citas; B: 3 y
    17; aislamiento comprobado por sesión). **Quedan fuera de la base local
    las tres `20261014*` de `feature/limites-ajustables`** (ese worktree las
    tenía aplicadas): ver la guía, §2.
    Vuelta a correr todo, mismas cifras que en el paso 1: SQL 17 en verde,
    Vitest 1684/112, Playwright 244 pasan y 0 fallan (204/37/3, 7.4 min),
    `reserva-carrera.sh` y `confirmacion-carrera.sh` en verde (build y lint no
    dependen de la base: los del paso 1).
  - **Paso 3 · auditoría de cada migración** (las 16 de
    `git diff --name-only main...HEAD -- supabase/migrations`). Cada auditoría
    previa se revisó contra las 18 dimensiones de `AUDITORIA-MIGRACIONES.md` y
    las reglas transversales se comprobaron en el catálogo de la base recién
    reiniciada: tabla de veredictos en `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`
    §2. Quince APTA tal como estaban (E1, E6, E4 y E9 con notas para Angel).
    **D11 no tenía auditoría formal** (sólo la revisión de su diff): se la hizo
    un auditor independiente → APTA CON CAMBIOS, **aplicados en el archivo**
    (no estaba en producción; anotado en su cabecera): el desempate «id menor»
    de dos reservas empalmadas perdía el par si la de id menor ya no podía ser
    reserva (prueba nueva, caso 5-ter, en rojo con el predicado viejo), el
    pre-vuelo exige `agenda_v2_encendida`, fila 7 de la rejilla (el UNIQUE del
    par), dos COMMENT. Reaplicada desde cero y en segunda pasada: rejilla 7 × OK,
    no-op. SQL 17 archivos en verde.
  - **Paso 4 · auditoría del conjunto** (`supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`).
    Catálogo comprobado en cuatro bases (rama, sólo `main`, combinada con
    `feature/limites-ajustables` y final) y huella md5 de cada objeto de
    `public`: **0 objetos de `main` cambiados** (S3 no tocó
    `clinica_tiene_acceso()` ni ninguna policy), 38 funciones sin PUBLIC, sin
    sobrecargas, sin DEFINER sin `search_path`, sin CASCADE nuevo, las 5
    policies de `appointments` intactas, lista blanca de `via` completa. Con
    las 24 migraciones combinadas todo aplica y las 21 pruebas SQL de las dos
    ramas pasan salvo `p1_permisos_funciones.sql` caso 3 (lista fija de
    funciones cerradas: hay que añadir las 30 del proyecto al fusionar). Un
    revisor independiente en otro modelo (Sonnet) auditó el conjunto sin ver
    estas conclusiones; sus cinco hallazgos y los del coordinador, con lo que
    se hizo con cada uno, en el §4 del documento y en §6-bis «Cierre».
  - **Paso 5 · tolerancia a producción** (base local reiniciada SÓLO con las 5
    migraciones de `main`, `db reset --local --workdir` desde un directorio
    temporal; el `next start` :3001 con el build de la rama). Sin ninguna
    tabla nueva ni el interruptor, y sin `log_cita_change`:
    - Las 23 e2e que no tocan tablas nuevas (agenda, vistas, filtro, alta y
      edición de citas, arrastre y redimensionado, banda de todo el día,
      tiempo real, caché, enlace profundo, iniciar consulta, secretaria,
      móvil, tableta…): **99 pasan, 1 falla, y la que falla es la que debe**:
      `agenda-arrastre` comprueba la fila `cita_editada` de B0, que sin B0 no
      existe. El arrastre en sí persiste (PUT 200, contexto nuevo).
    - Sondas a mano con la sesión de admin.a: alta, edición y **baja** de una
      cita con paciente → 200/200/200 (se borra, como en `main`);
      `/agenda/configuracion` → página de no encontrado; `/reservar/{código}`
      y `/confirmar/{código}` → 404; `POST /api/reservar/{código}` → 404;
      `/api/agenda/{por-confirmar,tipos-cita,enlaces,reservas}` → 404;
      `POST /api/google/sync` → 200 `{"estado":"omitida"}`; las dos tareas →
      401 sin secreto, 200 `{"ok":true}` con él y sin hacer nada.
    - Log del servidor: ningún error. Sí un `warn` por petición
      («interruptor de la agenda sin leer (cuenta como apagado)», 150 en la
      corrida): no va a Sentry, pero ensucia el log de Vercel. Orden
      recomendado al desplegar: migraciones primero (hallazgo H3).
    - Arreglado (herramienta, no producto): la semilla borraba
      `agenda_ajustes` sin tolerar que la tabla faltara y la segunda siembra
      sobre esa base fallaba. Ahora la trata como a `tipos_cita`.
    Después, la base se dejó otra vez con las 21 y sembrada (con D11
    corregida), y se repitió todo: SQL 17, Vitest 1684, Playwright 244 pasan y
    0 fallan (204/37/3), las dos carreras en verde, lint 96.
  - **Paso 6 · entregables**: `GUIA_AUDITORIA_AGENDA_V2.md` (raíz: requisitos,
    base desde cero, variables, `next start`/Google falso, interruptor,
    cuentas, Mailpit, baterías, capturas de F); §7 al día con los pasos de
    Angel; §10 nueva, «Lo que no se pudo probar en local», consolidando §8,
    §9 y §6-bis, con la lista de textos PENDIENTE DE REVISIÓN (grep en
    `src/`).
  - **Paso 7 · `CLAUDE.md` y `DEUDA_TECNICA.md`** (lo que pide el bloque F
    «al cerrar el proyecto»): en `CLAUDE.md`, una sección «Agenda v2» con el
    estado, el interruptor, las rutas públicas nuevas y las reglas que no se
    rompen, sólo añadida (ninguna regla de seguridad cambia); en
    `DEUDA_TECNICA.md`, AG-DT-10 resuelta por B0 (pendiente de producción) y
    AG-DT-13 a AG-DT-25 con lo que queda abierto.
  - Push: lo hace el coordinador.
- [x] Correcciones de seguridad en la base tras la revisión independiente
  (puntos 3, 4 y 7a de Angel; 2026-11-12, worktree
  `app_ortointegra-agenda-menores`, rama `feature/agenda-v2-seg2`, sale de
  `501d453`). Decisiones en §6-bis, «Correcciones de seguridad en la base
  tras la revisión independiente».
  - Migraciones (sólo local, al final del conjunto): `20261117120000`
    (borrado), `20261117121000` (columnas `reserva_*`), `20261117122000`
    (emisión de enlaces). Cada una en seco con ROLLBACK, aplicada dos veces
    (rejillas 5/5/6 × OK, segunda pasada sin cambios) y anotada a mano en
    `schema_migrations`. Auditoría independiente (Sonnet, 18 dimensiones,
    pruebas en vivo rol por rol): las tres APTA; único hallazgo, las líneas de
    ESTADO · LOCAL sin rellenar (rellenadas).
  - Código: `POST /api/agenda/enlaces` emite con `reserva_enlace_emitir`
    (cliente de servicio, clínica de la sesión); `DELETE
    /api/appointments/[id]` traduce el 42501 del disparador a 409; la semilla
    borra `agenda_ajustes` antes que las citas.
  - Pruebas y mutaciones en rojo:
    - `seg_borrado_cita.sql`: quitar el RAISE → «caso 1: la sesión borró una
      cita con paciente»; dejar fuera a `service_role` → «caso 2».
    - `seg_columnas_reserva.sql`: dejar salir a `authenticated` → «caso 1»;
      permitir cualquier cambio de teléfono/correo → «caso 2: la sesión
      cambió reserva_telefono».
    - `seg_emision_enlaces.sql`: quitar el «sólo service_role» del alta →
      «caso 1: la sesión emitió un enlace con un hash elegido».
    - `e2e/seguridad-postgrest.e2e.ts` (PostgREST directo con el JWT de
      admin.a): con las tres funciones mutadas a no-op, los 3 casos en rojo.
    - `d1_enlaces_reserva.sql` adaptada (altas por `reserva_enlace_emitir`).
  - Verificación: build limpio; lint 96 errores (sin subir); Vitest 1684 en
    112 archivos; SQL 18 de 20 en verde. Los 2 rojos (`d2_candado_reserva`
    caso 4 y `d3_reservar_por_enlace` caso 5) los provoca la migración
    `20261117130000_agenda_seg1_candado_correo.sql` del otro agente, aplicada
    después en la misma base: sus versiones de esas dos pruebas (en su
    worktree) pasan contra esta base con los tres disparadores nuevos.
    Playwright completo contra `next start` :3004 (puertos cambiados en las
    e2e SIN commitear): 245 pasan, 2 fallan, 214 saltadas. Los 2:
    `reserva-candado` «coincidir sólo por el teléfono» (mismo motivo: el
    candado cambió en `20261117130000`, y el otro agente actualizó esa e2e en
    su rama) y `seguridad-postgrest` punto 3, que heredaba un enlace fijo
    vigente que dejó ese fallo; arreglado limpiando también antes de cada
    caso, y vuelto a correr detrás de `reserva-candado`: verde.
  - Para quien integre las dos ramas: el disparador de columnas cierra solo
    toda columna nueva `reserva_*` de `appointments` (y una con DEFAULT haría
    fallar el alta de la sesión; la prueba SQL cuenta 11); `reserva_enlace_emitir`
    va a la lista del caso 3 de `p1_permisos_funciones.sql` al fusionar con
    `feature/limites-ajustables`; y si otra migración reemplaza
    `proteger_reserva_enlaces()`, tiene que partir del cuerpo de
    `20261117122000` (md5 `acd4128b…`), no del de D1.

- [x] seg1 — Correcciones de seguridad del enlace de reserva tras la revisión
  independiente (decisiones de Angel, 2026-11-12; rama `feature/agenda-v2-seg1`,
  worktree `~/proyectos/app_ortointegra-agenda-b56`; puntos 1, 2, 5, 6, 7b y 8)
  - Decisiones: §6-bis «Correcciones de seguridad tras la revisión
    independiente (decisiones de Angel)».
  - Migración (sólo local): `20261117130000` seg1 (`reserva_contacto_estado`,
    `reserva_ocupacion`, `reservar_por_enlace`), con auditoría independiente
    (cabecera).
  - Pruebas: `seg1_candado_correo.sql` (casos 1-6, cada uno en rojo con su
    mutación: estado antes de la ficha, incidencias o «1 activa» por teléfono,
    único sin bloqueo manual, todo el día fuera del empalme o de la
    ocupación); `d2` caso 4 y `d3` casos 5 y 6 ajustados a la decisión; Vitest
    `esquemasReserva` (nombre), `reservarRutasLimites` (orden límite → base,
    nuevo), `confirmarRuta`, `sincronizarReserva` y `limitesReserva` (tope por
    clínica); e2e `reserva-seg1.e2e.ts` (nueva) y `reserva-candado.e2e.ts`
    (invertida la de «sólo por teléfono»). `reserva-carrera.sh` en verde.

- [x] Integración de las correcciones de seguridad (2026-11-12; worktree
  `~/proyectos/app_ortointegra-agenda`, rama `feature/agenda-v2`, sobre la
  fusión `0dbfbd9` de seg1 y seg2). Decisiones en §6-bis, «Integración de las
  correcciones de seguridad»; auditoría en
  `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md` §8.
  - **Paso 1 · la fusión:** build limpio, lint 96 errores (sin subir), Vitest
    1701 en 113 archivos, SQL 21 de 21 en verde. Nada que arreglar: con las dos
    migraciones juntas no quedó ningún rojo.
  - **Paso 2 · desde cero** (CLI 2.117.0; antes, sin imprimir secretos:
    `NEXT_PUBLIC_SUPABASE_URL` local, sin `project-ref`, sin variables
    `SUPABASE_*`/`PG*`): 25 migraciones (5 de `main` + 20 del proyecto) en
    orden, sin un fallo, 28 s; semilla 1.3 s. SQL 21 y Vitest 1701 en verde;
    Playwright completo contra `next start` :3001: **252 pasan, 0 fallan**
    (escritorio 212, teléfono 37, tableta 3; 219 saltadas), 7.5 min, con las
    e2e del Google falso (`agenda-google-dos-sentidos`, `reserva-google`),
    `seguridad-postgrest` y `reserva-seg1` dentro. `reserva-carrera.sh` en
    verde y su control sin candado (la copia de la función sin la línea del
    candado, hecha del cuerpo vigente) reserva las dos: la garantía atómica
    sigue. `confirmacion-carrera.sh` en verde.
  - **Paso 3 · auditoría del conjunto** (commit `39ebe2f`): las cuatro APTA, 0
    objetos de `main` cambiados, ninguna policy tocada; base combinada con
    `feature/limites-ajustables` (28 migraciones) con la lista de 41 para el
    caso 3 de `p1`. Hallazgo I1: `seg1_candado_correo.sql` en rojo sólo en la
    base combinada (ayudante de `pg_temp` sin `grant`); arreglado, y en rojo sin
    el arreglo. Revisor en Sonnet en paralelo: mismos veredictos; su hallazgo 2
    (PUBLIC en funciones de `main` en la base local) no es de la agenda (I2).
  - **Paso 4 · documentos:** §6-bis (contradicción de los puntos 1 y 6,
    convertir en cita un evento de Google, la nota vieja de
    `SALIDA_DEL_MODAL`), §7, este punto, §10, `CLAUDE.md` (sección «Agenda
    v2», sólo ampliada) y `DEUDA_TECNICA.md` AG-DT-29.
  - **Paso 5 · guía de pruebas a mano y Google simulado:**
    `scripts/google-falso-manual.ts` (nuevo) sustituye al programa que la guía
    hacía copiar; probado contra la app del 3002: cada orden (`lista`,
    `crear`, serie, `mover`, `titulo`, `descripcion`, `borrar`, `caido`,
    `lento`, `normal`, `ya`, `ultima`, órdenes con datos malos) con su efecto
    comprobado en la base tras `POST /api/google/sync` (importar, mover,
    renombrar, cancelar, no importar la serie, 503 → `google_5xx`, 3 s de
    espera), la ida Spinus → Google sin las observaciones, el título de una
    cita con paciente restablecido, y el Ctrl+C real (señal al grupo, como el
    terminal): conexión, estado, importados y vínculos deshechos, puertos
    libres, sin procesos sueltos; también tras un cierre de golpe (SIGKILL).
    La guía se siguió desde una base recién reiniciada: P1–P11 comando por
    comando (la vía `npx --yes supabase@2.117.0` incluida, que reinició la base
    bien), §1.6, §1.8, el cron de recordatorios sin imprimir el secreto (200 y
    401), los correos de Mailpit con enlaces al 3000, y los comandos de SEG-A3,
    SEG-A4 y SEG-A7 con las salidas que la guía dice. Las 11 marcas
    PENDIENTE-SEG resueltas; SEG-A5 corregida (en la agenda no hay aviso).

- [x] Tanda tras las primeras pruebas a mano de Angel (2026-11-13; 16 puntos
  repartidos en `feature/agenda-v2-t1`, `-t2` y `-t3`, worktrees `-agenda-b56`,
  `-agenda-menores` y `-agenda-t3`; integración en `feature/agenda-v2`).
  Decisiones en §6-bis, «Tanda tras las primeras pruebas a mano». Sin
  migraciones: el conjunto sigue en 25.
  - **T1** (puntos 1, 2, 3, 4, 13 y 14): `92d42c8`, `f991fd4`, `ac1619a`,
    `a4991f4`. **T2** (puntos 7 a 12): `32c6803`, `69ae5df`, `bd4e407`,
    `a48c16e`. **T3** (puntos 5, 6, 15 y 16): `24aa491`, `fb17fcd`, `0b92d2f`,
    `8db9e14`, `9adb88b`, `3e19abb`.
  - **Paso 1 · fusiones:** T2 (`b872b02`) y T1 (`5152da4`) sin conflictos; T3
    (`719b9ae`) con cuatro: `BurbujaAlta` (`CampoPaciente` exportado con la
    firma de T1; «Convertir en cita» usa su «Registrar «…»»), `TarjetaLectura`
    (las dos variantes de T3 con la colocación seguida de T1,
    `useColocacionSeguida`), `InteraccionesV2` (`abiertaEn` de T1 y
    `alPasar`/`sinEntrada` de T3) y `ConfiguracionCalendario` (la estructura
    de T2 con la preferencia de T3 en su hueco, en su tarjeta). Revisor en
    Sonnet: sin hallazgos graves.
  - **Paso 2 · verificación:** build limpio, lint 96 errores (sin subir),
    Vitest 1759 en 118 archivos, SQL 21 de 21, Playwright completo contra
    `next start` :3001 **306 pasan, 0 fallan** (escritorio 255, teléfono 46,
    tableta 5; 264 saltadas; 9.1 min, con las e2e del Google falso dentro),
    `reserva-carrera.sh` y `confirmacion-carrera.sh` en verde. La e2e
    `reserva-seg1` «punto 5», que fallaba según el día (400 en vez de 409), se
    hizo determinista (`0b91b1a`; causa en §6-bis); sigue en rojo con su
    mutación `AND NOT a.all_day`.
  - **Paso 3 · desde cero** (CLI 2.117.0, `db reset --local`): 25 migraciones
    (`20261117130000` la última), sin un error; semilla 1.5 s. SQL 21, Vitest
    1759 y Playwright **306 pasan, 0 fallan** (mismas cifras).
  - **Paso 4 · los datos a mano de Angel** (`442fc03`): las e2e limpian sólo lo
    creado desde que empezó su archivo (`marcaE2e` + `limpiarReservasE2e(desde)`),
    apartan los enlaces vigentes y los tipos activos que había y los devuelven
    al terminar; `global-setup` sólo apaga el interruptor de las clínicas de la
    semilla. Prueba nueva en `agenda-configuracion-guiada` (centinelas: un tipo
    y un enlace «hechos a mano»), en rojo con dos mutaciones (volver a borrar
    todos los tipos de la clínica; volver a borrar todos los enlaces).
    Comprobado además con datos como los de Angel («Cita Dr Ancona» y un enlace
    fijo vigente del Dr. Admin) corriendo los siete archivos sin resembrar:
    siguen ahí, igual, y las pruebas en verde. La semilla sigue recreando las
    clínicas: la guía lo avisa en §1.1 (AG-DT-46).
  - **Paso 5 · documentos:** §6-bis, §7, este punto, §10, `CLAUDE.md`
    (sección «Agenda v2», ampliada), `DEUDA_TECNICA.md` (AG-DT-29 resuelta,
    AG-DT-28 decidida, AG-DT-13 acotada, AG-DT-30 a AG-DT-46 nuevas) y la guía
    (§8-bis con 23 pruebas nuevas, «Qué repetir», el aviso de §1.1, B1, B2, B6,
    D0, D3, E10, F5, F21, F22, casillas).
  - **F1.12 los fines de semana** (`7c07fbd`): la batería del paso 4 la vio
    fallar en el teléfono (ya era sábado 14). Era el código; causa y arreglo en
    §6-bis. En la misma batería falló `husos-dos-consultorios` «la agenda»
    porque corrió suelta, sin el archivo que la prepara: no era un fallo.
  - **Paso 6 · batería otra vez** (tras `442fc03` y `7c07fbd`, build nuevo):
    lint 96 errores, Vitest 1763 en 119 archivos, SQL 21 de 21, Playwright
    **307 pasan, 0 fallan** (escritorio 256, teléfono 46, tableta 5; 265
    saltadas; 9.1 min), las dos carreras en verde. Cada cambio de código,
    revisado por un revisor en Sonnet; atendidos sus hallazgos (orden de los
    `afterAll` con try/finally, `cita_correos` en la limpieza, una sola vuelta
    a la vez en F1.12, el filtro por clínica en seg1).

- [x] Tanda de diseño, duración y horarios (2026-11-14; puntos de Angel
  repartidos en `feature/agenda-v2-g1`, `-g2`, `-g3` y `-g4`, worktrees
  `-agenda-b56`, `-agenda-menores`, `-agenda-t3` y `-agenda-t4`; integración en
  `feature/agenda-v2`). Decisiones en §6-bis, «Tanda de diseño, duración y
  horarios». Cuatro migraciones nuevas: el conjunto pasa a **29** (5 de `main`
  y 24 del proyecto).
  - **G1** (páginas públicas y correos): `d38aba5`, `1a771fd`. **G2**
    (duración, turnos, configuración): `51d74ab`, `bd48e22`, `3c5e879`,
    `56bed0a`, `7000b74`, `82bb3ac`, `89bbb71`. **G3** (correo de
    confirmación, tarjeta, avisos): `22fcf60`, `b304b84`, `bf14720`,
    `5f58070`, `a8257b5`. **G4** (horario de los consultorios): `894d1ca`,
    `ab211c9`.
  - **Paso 1 · fusiones** (G4 `91e7794`, G2 `e67df4b`, G1 `5b4c1cb`, G3
    `a301b08`): G4 sin conflictos; G2 con tres (`altaCitas`, `guardadoCitas`,
    `AgendaCliente`: los avisos por consultorio de G4 y el ajuste al turno de
    G2 a la vez; `useAjusteTurno` lee ahora los consultorios de la rejilla de
    G4, que retiró `consultorioDeLaRejilla`); G1 y G3 sin conflictos de texto
    (el modal, la burbuja y las interacciones conservan lo de G2 y G4,
    comprobado por el revisor). En la de G3: la confirmación con la plantilla
    de G1 y sin «Recordatorio» (`PalabrasCorreo`), y «Compactar … de los
    consultorios» con la v2. Revisor en Sonnet: APTO CON CAMBIOS (proceso).
  - **Paso 2 · punto 5 de Angel** (`71ebbc0`): la reserva sólo ofrece los
    tipos del consultorio elegido; e2e `reserva-tipos-consultorio` en rojo con
    dos mutaciones. Revisor: APTO.
  - **Paso 3 · verificación** (`6c2f248`): build limpio, lint 96 errores (sin subir), Vitest 1860 en 127 archivos, SQL 24 de 24, Playwright completo **358 pasan, 1 falla** (`agenda-g3-tarjeta` «agendada», arreglada en la prueba), 291 saltadas, 10.2 min; las dos carreras en verde. Cuatro e2e que fallaban
    a ratos, deterministas (causas en §6-bis; las cuatro eran la prueba), y la
    e2e del arrastre del administrador.
  - **Paso 4 · rendimiento:** `playwright.medicion.config.ts`, **5 rondas intercaladas** (base `dd634b9` e
    integración alternando el servidor de :3001, v2 apagada y encendida en la
    Clínica Semilla A; mediana de las 25 muestras por columna), 2026-11-15.
    La primera ronda encontró dos empeoramientos con la v2 y se arreglaron
    (`b6798da`, `7bfa208`; causas en §6-bis): «volver del dashboard» 72 → 81 ms
    y una validación contra Auth más (4 → 5). Tras los arreglos:

    | Medida (mediana de todas las muestras) | base apagada | integración apagada | base encendida | integración encendida |
    |---|---|---|---|---|
    | Apertura en frío (ms) | 268.0 | 261.0 | 257.0 | 263.0 |
    | Red limitada (ms) | 755.0 | 757.0 | 753.0 | 757.0 |
    | Semana siguiente (ms) | 63.0 | 59.0 | 65.0 | 67.0 |
    | Semana anterior (ms) | 59.0 | 60.0 | 64.0 | 58.0 |
    | Semana ya vista (ms) | 52.0 | 53.0 | 56.0 | 54.0 |
    | Tras precarga (ms) | 50.0 | 51.0 | 56.0 | 56.0 |
    | Volver del dashboard (ms) | 72.0 | 72.0 | 73.0 | 74.0 |
    | Validaciones contra Auth (mediana / máx.) | 2 / 2 | 2 / 2 | 4 / 4 | 4 / 4 |
    | Peticiones bloqueantes al volver (máx.) | 0 | 0 | 0 | 0 |
    | JS transferido (bytes, mediana) | 542 168 | 548 013 | 564 029 | 569 458 |

    Apertura en frío con la v2: 263 frente a 257 en esta serie; una sonda
    intercalada aparte (3 × 15 aperturas por lado) da 256 frente a 253 (+3 ms,
    ~1 %, con +5,4 KB de JS de las funciones nuevas; quitar el repintado de las
    cajas no lo cambia). Lo dejo como ruido con este aviso. **A1-bis**
    (`e2e/playwright.a1bis.config.ts`, instrumentado, base e integración, v2
    apagada y encendida): renders, `refinadosConCambio` y peticiones
    **idénticos** a la base en las 16 fases (abrir 5/7 renders, 0 refinados
    con cambio salvo el 1 de `slotMinTime` del arrastre, igual que la base;
    reposo 0/0). **Lo largo:** cada corrida de A tarda ~4 min (40 en total por
    las 20 corridas) y una ronda entera se repitió dos veces tras los arreglos.
  - **Paso 5 · desde cero:** `supabase db reset --local` (CLI 2.117.0) con las **29**
    (confirmadas 24 del proyecto con `git diff --name-only main...HEAD --
    supabase/migrations`), 29 s, sin un error; semilla 2 s. SQL 24 de 24,
    Vitest 1860, las dos carreras en verde y Playwright **355 pasan, 5 fallan**,
    292 saltadas, 11.0 min: las 5 (`agenda-f-pulido` F1.4, F1.8, F1.12 y F1.14 y
    `husos-dos-consultorios` «la agenda») fallan porque hoy es **domingo** (el
    domingo está cerrado en la semilla) y fallan igual en la base `dd634b9`
    con la misma base: no son de la tanda (AG-DT-69).
  - **Paso 6 · auditoría del conjunto:** `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`
    §9. Las cuatro, APTAS (coordinador y revisor en Sonnet, por separado); la huella de `main`, sin cambios; la lista del caso 3 de `p1` con `limites-ajustables`, la misma de 41 del §8.5.
  - **Pasos 7 y 8 · documentos y capturas:** esta sección, §6-bis, §7, §10,
    `CLAUDE.md` (sección «Agenda v2»), `DEUDA_TECNICA.md` (AG-DT-33 resuelta,
    AG-DT-31 en parte, AG-DT-47 a AG-DT-69 nuevas) y la guía (§8-ter con 33
    pruebas nuevas, «Qué repetir tras la tanda del 2026-11-14», D0, D1, D5,
    D12, E2, E4, E7, E8, E10, F5, F18, F21, F22, B4, B6, B7, B11, T1-6, T1-8,
    T2-1, T2-2, T2-5, T2-6, T3-5, T3-8, §13.2 y casillas). Capturas «después»
    sobre la integración en `e2e/resultados/G/integracion/despues/` e índice
    en `e2e/resultados/G/index.html`.

- [x] Tanda H (2026-11-15; 23 puntos de Angel tras probar a mano la tanda G,
  repartidos en `feature/agenda-v2-h1` a `-h5`, worktrees `-agenda-b56`,
  `-agenda-menores`, `-agenda-t3`, `-agenda-t4` y `-agenda-t5`; integración en
  `feature/agenda-v2`). Decisiones en §6-bis, «Tanda H». Tres migraciones
  nuevas: el conjunto pasa a **32** (5 de `main` y 27 del proyecto).
  - **H1** (reserva, confirmación y correos): `0cbb544`, `a940c84`, `18f79e6`,
    `0709921`. **H2** (configuración, recordatorio, restablecer): `0a80b6e`,
    `af7b40d`, `1f4fd73`. **H3** (burbuja): `53a5a0a`, `3d324ba`, `8da5c90`,
    `eac0de0`. **H4** («Por confirmar» y huecos): `59cb478`. **H5** (atendida con
    nota, domingo): `c04ec2f`, `de8c253`.
  - **Paso 1 · fusiones** (H5 `00ba7c3`, H2 `4d023a7`, H4 `e3c3519`, H3
    `182944f`, H1 `1f39c4e`), todas con `--no-ff` y **sin ningún conflicto de
    texto**; `tsc` limpio y build limpio. La tarea de recordatorios llama a la
    función nueva. Los choques de sentido aparecieron en la batería (paso 4).
  - **Paso 2 · dos ajustes de H4** (`b40e734`): el turno de «Huecos disponibles»
    propone la duración de la consulta y, con ella conocida, el hueco mínimo es
    esa duración (§6-bis, integración). Vitest y e2e en rojo con sus mutaciones.
    Revisor: APTO CON CAMBIOS (aplicados o anotados: AG-DT-93).
  - **Paso 3 · el horario de partida tras «Restablecer»** (`9db2e3c`): el de la
    clínica copiado como horario propio (§6-bis, decisión pendiente de Angel);
    `20261120121000` editada en su sitio. Revisor: APTA CON CAMBIOS
    (documentales).
  - **Paso 4 · verificación, una sola vez y sobre la base reiniciada (paso 5
    adelantado):** build limpio, lint 96 errores (sin subir), Vitest 1913 en 131
    archivos, SQL 27 de 27, Playwright completo **394 pasan, 3 fallan**, 323
    saltadas, 8 sin correr (las series tras su fallo), 11.8 min; las dos carreras
    en verde. Las 3 eran la prueba (dos por el recordatorio apagado de fábrica de
    H2, una por la hora del día y una por una franja que ocupa `agenda-cancelar`;
    la cuarta, `confirmacion-enlace` «lista A 4», pasaba sin probar nada):
    arregladas y repetidos sus 4 archivos, 26 de 26 (`ebb5efe`).
  - **Paso 5 · desde cero:** `supabase db reset --local` (CLI 2.117.0) con las
    **32** (confirmadas 27 del proyecto con `git diff --name-only main...HEAD --
    supabase/migrations`), 27–29 s, sin un error; semilla 2 s. Hecho antes del
    paso 4, así que la batería completa corrió una sola vez. Y otra vez al final
    para dejar la base como la tenía Angel (paso 10).
  - **Paso 6 · rendimiento:** `playwright.medicion.config.ts`, **4 rondas intercaladas** el
    mismo día (base `c7de598` e integración alternando el servidor de :3001, en
    orden contrario cada ronda; v2 apagada y encendida en la Clínica Semilla A;
    mediana de las 20 muestras por columna), 2026-11-15:

    | Medida (mediana de todas las muestras) | base apagada | integración apagada | base encendida | integración encendida |
    |---|---|---|---|---|
    | Apertura en frío (ms) | 257.5 | 256.5 | 257.0 | 259.5 |
    | Red limitada (ms) | 754.5 | 756.0 | 758.5 | 758.0 |
    | Semana siguiente (ms) | 64.0 | 64.0 | 66.0 | 64.5 |
    | Semana anterior (ms) | 59.5 | 60.0 | 65.0 | 60.5 |
    | Semana ya vista (ms) | 52.5 | 53.5 | 57.5 | 56.0 |
    | Tras precarga (ms) | 52.5 | 52.0 | 58.0 | 54.0 |
    | Volver del dashboard (ms) | 73.0 | 72.0 | 75.0 | 74.5 |
    | Validaciones contra Auth (mediana / máx.) | 2 / 2 | 2 / 2 | 4 / 4 | 4 / 4 |
    | Peticiones bloqueantes al volver (máx.) | 0 | 0 | 0 | 0 |
    | JS transferido (bytes, mediana) | 548 094 | 549 176 | 569 678 | 572 503 |

    Ninguna medida empeora fuera del ruido. **La apertura en frío de H4 (+7 ms)
    se descarta:** aquí +2.5 ms con la v2 y las medianas por corrida solapadas
    (base 255–263, integración 256–265); una sonda intercalada aparte (3 × 15
    aperturas en frío por lado, v2 encendida) da **260 ms la base y 258 la
    integración**, con el mismo rango intercuartil (255–263). JS: +1,1 KB
    apagada y +2,8 KB encendida (lo nuevo de H1–H4). Cero peticiones nuevas al
    abrir. Un tropiezo de proceso: la primera tanda de corridas salió con la v2
    sin encender (el gancho temporal `MEDICION_V2` de la integración G no está en
    el repo) y se descartó entera. **A1-bis** (`e2e/playwright.a1bis.config.ts`,
    instrumentado, base e integración, v2 apagada y encendida): 4 corridas por lado
    intercaladas): renders de la agenda, `refinadosConCambio` y peticiones
    **idénticos** a la base en las 16 fases (abrir 5/7 renders y 12/14
    peticiones apagada/encendida; 0 refinados con cambio salvo el 1 de
    `slotMinTime` del arrastre, igual que la base; reposo 0/0). Lo único
    distinto, `resetOptions` de FullCalendar, varía entre corridas en los DOS
    lados (la base, de 4 a 8 al abrir): con la v2 la integración tuvo en 2 de 4
    corridas dos más en el reposo tras abrir, **sin ninguna opción cambiada, sin
    tocar el DOM y por 0,1 ms**. Causa no aislada (no es un render de la
    agenda); se anota y no se toca.
  - **Paso 7 · auditoría del conjunto:** `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`
    §10. Las tres, APTAS (coordinador y revisor en Sonnet, por separado); la
    huella de `main`, sin cambios; ninguna función de la agenda con PUBLIC; la
    lista del caso 3 de `p1` con `limites-ajustables` pasa de 41 a **44**.
  - **Pasos 8 y 9 · documentos y capturas:** esta sección, §6-bis, §7, §10,
    `CLAUDE.md` (sección «Agenda v2»), `DEUDA_TECNICA.md` (AG-DT-69 cerrada,
    AG-DT-63 decidida, AG-DT-61 cerrada para las citas con nota, AG-DT-70 a
    AG-DT-93 nuevas) y la guía (§8-quater con 26 pruebas nuevas, «Qué repetir
    tras la tanda H», 29 pruebas existentes con su nota, §13.2 y casillas).
    Capturas «después» sobre la integración en `e2e/resultados/H/integracion/despues/`
    e índice en `e2e/resultados/H/index.html`.

- [x] Tanda I (2026-11-17). Son los puntos 1 a 22 de Angel tras probar a mano la
  tanda H, más el 23 (repetir ocho e2e) y el 24 (la tabla de migraciones, §7.1).
  - **Ramas y worktrees:** `feature/agenda-v2-i1` a `-i5`, todas desde `0349221`,
    en los worktrees `-agenda-b56`, `-agenda-menores`, `-agenda-t3`, `-agenda-t4`
    y `-agenda-t5`. Integración en `feature/agenda-v2`.
  - Decisiones en §6-bis, «Tanda I».
  - **Siete migraciones nuevas:** el conjunto pasa a **39** (5 de `main` y 34 del
    proyecto). El encargo decía 41; en el disco hay 39 (auditoría del conjunto
    §11.8, L3).
  - **Commits por rama:**
    - **I1** (puntos 4–7): `0d236d7`, `452087f`, `8b1b4bc`.
    - **I2** (2, 9, 21): `0c6081d`, `8e220fa`, `49e1b79`.
    - **I3** (8, 10, 22): `79eb717`, `7847328`, `a97e4c2`, `d7af2f3`, `e2e5361`.
    - **I4** (1, 3, 11, 12): `ef52d2e`, `f064599`, `995a262`.
    - **I5** (13–20): `abdc2e5`, `f693e40`, `18d5f4d`.
  - **Paso 1 · fusiones**, todas con `--no-ff`, en este orden: I1 `b61a2fc`, I2
    `6c07bf7`, I3 `56a63b6`, I4 `4b24df9`, I5 `de9fe3e`.
    - Hubo conflictos de texto en seis archivos; cómo se resolvió cada uno está
      en §6-bis, «Integración de la tanda I».
    - `tsc` y el build, limpios.
  - **Paso 2 · ajustes de integración:**
    - `f9493e7`: «¿No es una cita?» en la campana y el aviso de Google con la
      marca de I3. Es `20261121150000`, editada en su sitio.
    - `e409396`: dos 500 sin las columnas de I4, y el GRANT de `pg_temp.unico`.
    - Cada cambio tiene su prueba en rojo con la mutación. Revisor Sonnet:
      APTO CON CAMBIOS y APTO; los cambios, aplicados.
  - **Paso 3 · respaldo y base desde cero:**
    - Las dos notas que Angel hizo a mano se respaldaron en
      `e2e/resultados/respaldo_consultas_angel_2026-11-15.json` (sin
      seguimiento).
    - Después, `supabase db reset --local` (CLI 2.117.0) con las 39, sin un
      error, y la semilla.
  - **Paso 4 · auditoría del conjunto:** `supabase/AUDITORIA-CONJUNTO-AGENDA-V2.md`
    §11 (`fdd2073`).
    - La segunda pasada es idempotente.
    - La huella de `main` no cambia (336 objetos, 0 cambiados).
    - Contra H: 3 funciones cambiadas y 28 objetos nuevos.
    - La lista del caso 3 de `p1` con `limites-ajustables` pasa de 44 a **45**.
    - Tolerancia sin las siete: 13 e2e de antes, 71 pasan y 2 saltadas; los
      dos 500 se arreglaron en el paso 2.
    - Revisor Sonnet: APTA CON CAMBIOS (sólo de texto), aplicados.
  - **Paso 5 · verificación, una sola vez, sobre la base reiniciada:**
    - Build limpio y lint con 96 errores (no sube).
    - Vitest: **1989** pruebas en 138 archivos. SQL: **34 de 34**.
    - Las dos carreras, en verde: `reserva-carrera` (3 citas) y
      `confirmacion-carrera`.
    - **Playwright completo: 443 pasan y 6 fallan**, con 364 saltadas y 11 sin
      correr (las series tras su fallo), en 15,0 min.
    - **Las seis eran de la prueba, no de la app** (`067972c`):
      - Ocho archivos de la tanda dejaban la v2 encendida en A, y
        `agenda-secretaria` y `agenda-tipos-cita` caían en el aviso de empalme.
        Ahora cada archivo la apaga en su `afterAll`.
      - La prueba H3 de `agenda-google-dos-sentidos` dejaba una cita el jueves
        de 13:00 a 14:00, que tapaba el alta de `agenda-tipos-cita`. Ahora la
        borra.
      - `reserva-g1-diseno` esperaba un correo que empezara por «Spinus», y I2
        lo puso a nombre del médico.
      - `agenda-movil` fijaba el reloj en el futuro (miércoles, con hoy martes).
      - La prueba de estirar de `agenda-eleccion-i2` arrastraba fuera de la
        ventana.
    - Revisor Sonnet: APTO CON CAMBIOS, aplicados.
    - **Se repitieron sólo esos archivos:** 47 pasan y 1 falla (estirar). Tras
      el arreglo, su archivo, 7 de 7; y `agenda-movil`,
      `agenda-google-dos-sentidos` y `agenda-tipos-cita` juntos, 20 de 20.
  - **Paso 6 · punto 23, las ocho e2e por separado** (`-g`, una corrida cada
    una), todas en escritorio:
    - `recordatorios`: «evento sin paciente, cancelada o fuera de la ventana»,
      «con el interruptor apagado», «H2 · … la tarea no manda nada» y «H2 · …
      la confirmación con su botón sigue saliendo»: las cuatro pasan.
    - `agenda-google-dos-sentidos`: «un recurrente creado en Google», «una cita
      attended movida en Google» y «dos sondeos seguidos»: las tres pasan.
    - `husos-dos-consultorios`, «la agenda la dibuja a las 11:00»: **sola no
      puede correr**. Es la tercera de una serie (`mode: 'serial'`): la primera
      elige el turno y la segunda hace la reserva que la tercera busca.
      - Sola: `turno` indefinido.
      - Con la primera: no encuentra la tarjeta.
      - **Con el archivo entero: 3 de 3.**
  - **Paso 7 · rendimiento.** Se midió con `playwright.medicion.config.ts` en
    **4 rondas intercaladas**, contra `0349221`:
    - La base, compilada aparte, y la integración alternan el servidor de
      :3001, en orden contrario cada ronda.
    - La v2, apagada y encendida en la Clínica Semilla A. Para encenderla, un
      `globalSetup` temporal encadenado, fuera del repo, porque el del repo la
      apaga.
    - Cada celda es la mediana de las 20 muestras de su columna.
    - Fecha: 2026-11-17.

    | Medida (mediana de todas las muestras) | base apagada | integración apagada | base encendida | integración encendida |
    |---|---|---|---|---|
    | Apertura en frío (ms) | 269.0 | 268.0 | 268.0 | 271.0 |
    | Red limitada (ms) | 759.5 | **777.0** | 762.0 | **781.0** |
    | Semana siguiente (ms) | 63.5 | 66.0 | 69.0 | 67.0 |
    | Semana anterior (ms) | 60.5 | 66.0 | 65.0 | 68.5 |
    | Semana ya vista (ms) | 51.0 | 51.0 | 57.5 | 57.0 |
    | Tras precarga (ms) | 52.5 | 55.5 | 60.0 | 59.0 |
    | Volver del dashboard (ms) | 71.0 | **80.5** | 76.0 | **82.5** |
    | Validaciones contra Auth (máx.) | 2 | 2 | 4 | 4 |
    | Peticiones bloqueantes al volver (máx.) | 0 | 0 | 0 | 0 |
    | JS transferido al abrir (bytes) | 547 499 | **559 482** | 570 991 | **581 335** |
    | Chunks de JS al abrir | 31 | **34** | 33 | **36** |
    | Guardar un evento: clic → tarjeta pintada (ms) | 28.6 | 29.45 | 29.85 | 25.6 |
    | Guardar un evento: POST /api/appointments (ms) | 48.95 | 48.25 | 45.95 | 47.8 |

    - **Cómo se midió «Guardar»:**
      - El script temporal `medir-js-guardar.cjs` abre la agenda, va a «Nueva
        cita» y luego a la pestaña «Evento», y elige un día y una hora libres
        por SQL.
      - En la página toma `performance.now()` y pulsa «Guardar».
      - Un `MutationObserver` y dos `requestAnimationFrame` marcan la tarjeta
        ya pintada; el POST es el `responseEnd` del navegador.
      - Son 5 por corrida, 20 por columna. La tarjeta se pinta antes de que
        responda el POST (alta optimista), así que las dos cifras son
        independientes.
    - **Lo que empeora:**
      - El JS pesa **+12 KB con la v2 apagada** (+3 chunks) y +10 KB encendida.
      - La apertura con red limitada tarda **+17,5 ms** apagada y **+19 ms**
        encendida. Las medianas por corrida no se solapan (base de 758 a 764,
        integración de 774 a 783).
      - «Volver del dashboard» tarda **+9,5 ms** apagada (corridas de 68 a 73
        frente a 79 a 84) y +6,5 ms encendida.
      - Todo anotado en AG-DT-136 y sin tocar: la campana y el menú del engrane
        de I5 entran con `import` estático.
    - **Causa de la vuelta, no aislada.** Una sonda aparte (2 × 15 vueltas tras
      la red en reposo, por árbol) no ve diferencia:
      - la base, 79 y 81 ms;
      - la integración, 80 y 81;
      - cada rama sola, de 79 a 84.
    - El resto, dentro del ruido. Cero peticiones nuevas al abrir y las mismas
      validaciones contra Auth.
    - **A1-bis**, con `__agMed` reducido: renders de la agenda, `datesSet`,
      `eventsSet`, `loading` y peticiones por fase.
      - El parche de instrumentación no está en el repo:
        `instrumentar.py` en `/home/spinus/proyectos/tanda-I-temporales/integrador/herramientas/`.
        Sin causas, refinados ni `resetOptions`.
      - Base e integración, v2 apagada y encendida, 2 rondas intercaladas.
      - **Idénticos en 18 de las 19 fases.** En la otra
        (`d2_cerrar_invitacion`, v2 apagada), la integración tuvo una vez 1
        render en vez de 2.
      - La fase `d_estado_fila` falla igual en los dos lados.
  - **Paso 8 · documentos:**
    - Esta sección, §6-bis, §7 (con §7.1, la tabla de las 39) y §10.
    - `CLAUDE.md`, sección «Agenda v2».
    - `DEUDA_TECNICA.md`: AG-DT-94 a AG-DT-136 nuevas; AG-DT-70, 80, 85, 90, 133
      y 135, cerradas.
    - La guía:
      - §8-quinquies, con 38 pruebas nuevas;
      - «Qué repetir tras la tanda I»;
      - §13.2, filas 28 a 34;
      - las casillas.
    - Comparativas de cada rama en `e2e/resultados/I/iN/` e índice en
      `e2e/resultados/I/index.html`.

**Bitácora** (una línea por sesión: fecha, qué quedó hecho, qué quedó a medias):

- 2026-11-10/11 — Rama y worktree creados; A0 cerrado (sembrador, red e2e
  revisada por un revisor independiente, línea base). A1 diseñado; decisiones:
  no se cambia `getUser()` por `getClaims()` en ninguna API, A1.7 (Google
  sembrado en servidor) fuera por ahora, la caché de rangos empieza en su
  versión mínima.
- 2026-11-12 — Bloque A cerrado (A1, A1-bis, A2). Pendiente de Angel: aplicar
  en producción `supabase/migrations/20261111120000_agenda_a18_indices_rango.sql`;
  decidir el tope de `ProximasCitas`; revisar la semilla de tres semanas. Lo
  siguiente: bloque B.
- 2026-11-12 — Bloque F cerrado: integración de superficie, movimiento e
  interacciones; herramientas v2 en sus ranuras, la batería entera en verde
  (239), sesión de «Compactar» y F1.5 apagado a la espera de Angel; capturas,
  vídeos, cuadros y comparativa. Push: lo hace el coordinador.
- 2026-11-12 — Cierre del proyecto: fusión de D11 verificada; conjunto de 16
  migraciones reiniciado desde cero y en verde; auditoría formal de D11 (APTA
  CON CAMBIOS, aplicados) y del conjunto (APTO, con notas para Angel);
  tolerancia a producción comprobada sin las tablas; guía, §7, §10,
  `CLAUDE.md` y `DEUDA_TECNICA.md`. Lo siguiente es de Angel (§7).
- 2026-11-12 — seg1: correcciones de seguridad del enlace de reserva (puntos 1,
  2, 5, 6, 7b y 8 de Angel), migración `20261117130000` y pruebas. Para Angel:
  la excepción del bloqueo manual por teléfono (§6-bis) y AG-DT-26 a AG-DT-28.
- 2026-11-12 — Correcciones de seguridad en la base (3, 4 y 7a): tres
  migraciones locales con auditoría APTA, la ruta de alta de enlaces por el
  servidor, H1 corregido en la auditoría del conjunto. Nada a medias.
- 2026-11-12 — Integración de seg1 y seg2: fusión verificada, conjunto de 20
  migraciones desde cero y en verde (252 e2e, 1701 Vitest, 21 SQL, carreras),
  auditoría del conjunto §8 con la base combinada, documentos, el Google
  simulado como script del repo y la guía de pruebas a mano seguida comando
  por comando. Para Angel: la contradicción de los puntos 1 y 6 y AG-DT-29.
  Nada a medias.
- 2026-11-13/14 — Tanda tras las primeras pruebas a mano (T1, T2, T3):
  fusiones con cuatro conflictos resueltos, e2e de seg1 determinista, las e2e
  ya no borran lo hecho a mano, F1.12 arreglado para los fines de semana;
  desde cero, 25 migraciones y 307 e2e en verde. Para Angel: la decisión del
  punto 9 (el invitado no crea tipos), comprobar `imatch` en producción y la
  guía (§8-bis y «Qué repetir»). Nada a medias.
- 2026-11-14/15 — Tanda de diseño, duración y horarios (G1–G4): cuatro
  fusiones (tres conflictos en la de G2), el punto 5 de Angel (tipos por
  consultorio en la reserva), cuatro e2e deterministas, dos regresiones de
  rendimiento con la v2 encontradas y arregladas, desde cero con 29
  migraciones, auditoría del conjunto §9, documentos y capturas. Para Angel:
  el 409 `nota_ligada` (AG-DT-63), la dimensión nueva de auditoría y las 5 e2e
  que fallan en domingo (AG-DT-69). Nada a medias.
- 2026-11-15 — Tanda H (H1–H5): cinco fusiones sin conflictos de texto, dos
  ajustes de H4 (la duración del turno y el hueco mínimo), el horario de partida
  tras «Restablecer», tres e2e que chocaban entre ramas arregladas (eran la
  prueba), desde cero con 32 migraciones y una sola batería completa, presupuesto
  de A y A1-bis, auditoría del conjunto §10, documentos y capturas. Para Angel:
  mover una atendida con nota con la v2 apagada, el único sin correo (AG-DT-70) y
  el horario tras «Restablecer». Nada a medias.
- 2026-11-17 — Tanda I (I1–I5), con el punto 23 (repetir ocho e2e) y el 24 (la
  tabla de migraciones):
  - Cinco fusiones y conflictos en seis archivos. Dos ajustes de integración:
    «¿No es una cita?» en la campana y la tolerancia sin las columnas de I4.
  - Respaldo de las notas de Angel y base desde cero con 39 migraciones.
  - Auditoría del conjunto §11.
  - Una sola batería completa: las 6 que fallaron eran de la prueba.
  - Las ocho del punto 23 pasan; la de husos, sólo con su serie.
  - Rendimiento: +12 KB de JS y +18 ms con la red limitada, en AG-DT-136.
  - Para Angel: las «PARA REVISIÓN DE ANGEL» de §6-bis y la cabecera
    «PENDIENTE» de `auth_02`.
  - Nada a medias.

---

## 10. Lo que no se pudo probar en local

Consolidado de todos los bloques (§8, §9 y las subsecciones de §6-bis), al
cierre del proyecto. Todo lo demás se probó contra la base local de Docker,
el Google falso y Mailpit (cifras en §9, «Cierre del proyecto»). Ninguno de
estos puntos se puede cerrar desde aquí sin romper las reglas de §6 (nada
contra producción, Google real, correo real ni Vercel).

**Producción y base**
- `select version()` en producción (≥ 14; las migraciones usan `CREATE OR
  REPLACE TRIGGER`). Lo corre Angel antes de aplicar el conjunto.
- Que el esquema de producción coincida con el del repo (§8). Las migraciones
  se protegen solas donde dependen de un cuerpo ajeno: C1 evalúa la puerta S3
  contra la base antes del `COMMIT` y aborta si `clinica_tiene_acceso()` o
  `clinica_no_suspendida()` tienen otra forma; E1 y E6 exigen el md5 de
  `clinica_no_suspendida()`. Si abortan en producción, no se adivina: se
  revisa C1/E1 contra la definición real.
- El conjunto aplicado por el SQL Editor de Supabase (aquí se aplicó con
  `supabase db reset --local`, CLI 2.117.0, y archivo a archivo con `psql`).
  La rejilla de cada archivo se vio con `psql`, no con el SQL Editor.
- Volumen real: los bloqueos y tiempos se midieron con la semilla (≈365
  citas; 30 000 en A1.8). Con el volumen de producción que cita la cabecera
  de A1.8 (~154 citas, dato de noviembre sin volver a medir) deberían ser
  instantáneos.

**Google**
- Cualquier cosa contra una cuenta real: OAuth, refresco del token dentro del
  tope de 4 s de D11, cuotas, latencias y errores reales, el `syncToken` real
  y el 410 real (el falso los imita; 410 y paginación sólo en Vitest/SQL).
- Que un RSVP llegue por `syncToken` (E9, detrás de `AGENDA_RSVP_GOOGLE`,
  apagado). No se escribió `scripts/gcal-rsvp-humo.ts`.
- Que `calendar.app.created` siga siendo un permiso no sensible (§8).
- LP-DT-6 (sincronización de ida y vuelta) sigue abierta hasta esa prueba; el
  texto «en tiempo real» sigue prohibido (sin webhook).
- El hueco de C: un evento creado por Spinus antes de v2 sin
  `google_event_id` guardado se importaría como evento de Google.

**Correo**
- Envío real por Resend (`EMAIL_TRANSPORT=resend`): comprobante, recordatorio
  y aviso de cancelación sólo se vieron en Mailpit. Entregabilidad, SPF/DKIM
  y el 409 de idempotencia de Resend real, sin probar.

**Vercel**
- Variables (`RESERVA_SECRETO`, `EMAIL_TRANSPORT=resend`, `CRON_SECRET`; y,
  cuando toque, `AGENDA_RSVP_GOOGLE`) y las dos tareas de `vercel.json`
  (`/api/cron/google-sync` cada 10 min, `/api/cron/recordatorios` cada 15).
  Las tareas se activan solas con el primer despliegue de producción que
  lleve `vercel.json`; sin `CRON_SECRET` responden 401 y no hacen nada.
- Una pasada abortada por Vercel (que su `soltar` llegue antes de que congelen
  la función; si no, el candado caduca a los 30 s en D11 y a los 90 s en el
  cron) y el `after()` de las rutas en el entorno real.
- Ninguna Preview: las rutas públicas nuevas (`/reservar`, `/confirmar`, las
  dos de `/api/cron`) no se han visto detrás del dominio real ni de su HTTPS.

**Texto legal y cumplimiento**
- El aviso de privacidad de la reserva (D9) está **PENDIENTE DE REVISIÓN
  LEGAL**: el enlace de reserva no abre en producción hasta que Angel quite
  la marca, lo revise contra la LFPDPPP vigente y apruebe su hash
  (`npx tsx scripts/aviso-reserva-hash.ts`).
- Textos **PENDIENTE DE REVISIÓN** (grep `PENDIENTE DE REVISI` en `src/`):
  `src/lib/reserva/avisoReserva.ts` (aviso, legal),
  `src/lib/reserva/correosReserva.ts` (comprobante),
  `src/lib/reserva/respuestasReserva.ts` (respuestas de la API pública),
  `src/app/reservar/[codigo]/ReservaCliente.tsx` (texto de la página),
  `src/lib/confirmacion/correosCita.ts` (recordatorio y comprobante con
  enlace), `src/lib/confirmacion/vistaConfirmacion.ts` (página de
  confirmación), `src/app/confirmar/[codigo]/page.tsx` («Elegir otro
  horario»), `src/lib/agenda/whatsappCita.ts` (mensaje de WhatsApp).
- Consentimiento de los pacientes **existentes** para recibir recordatorios
  por correo y avisos por WhatsApp (LFPDPPP 2025): no está claro que lo cubra
  el consentimiento que firmaron.
- Plazo de conservación del historial del candado (propuesto 12 meses, sin
  purga automática).

**Interfaz**
- Rendimiento en un teléfono y una tableta reales (todo fue Chromium
  emulado, también el arrastre táctil y el deslizar).
- Lectores de pantalla reales sobre las capas v2.
- La batería A1-bis instrumentada (`e2e/playwright.a1bis.config.ts`) no se
  volvió a correr tras F.
- F1.5 («Compactar» al abrir) con datos de una clínica real.

**Tanda tras las primeras pruebas a mano (2026-11-13)**
- **`imatch` en el PostgREST de producción:** la búsqueda de pacientes (punto
  1) sale sin interruptor y lo usa; en local hay PostgREST 14.5. Comprobarlo
  antes de fusionar (§7).
- **La tarjeta al pasar el ratón y la elevación** con un ratón y un panel
  táctil reales, y en equipos híbridos (pantalla táctil con ratón): todo fue
  Chromium con `(hover: hover) and (pointer: fine)` emulado.
- **El teclado real de una tableta** (`visualViewport` al abrirse): en las e2e
  se simula encogiendo la parte visible.
- **El Google real con «Convertir en cita»:** sólo con el Google simulado.

**Tanda de diseño, duración y horarios (2026-11-14)**
- **Los correos con la plantilla nueva en buzones reales** (Gmail, Outlook,
  Apple Mail, el correo del teléfono): sólo se vieron en Mailpit, renderizados
  en un navegador de teléfono y de escritorio y con las imágenes bloqueadas.
  Tampoco su paso por Resend (el correo de confirmación de G3 incluido).
- **El modo oscuro de las páginas públicas en teléfonos reales**
  (`prefers-color-scheme`): sólo Chromium emulado.
- **La migración `20261119130000` con los datos de producción:** en local copió
  el horario de las clínicas de la semilla; cuántos consultorios toca en
  producción y su pre-vuelo 1.4 (médicos con consultorios activos sin
  predeterminado) sólo se verán al aplicarla. El respaldo queda en
  `respaldos.consultorios_horario_20261119`.
- **spinus-consola contra el conjunto:** no hay consola en local; que no lea
  `respaldos` ni dependa de `tipos_cita` se comprobó por su contrato (lee
  `public` con vistas propias; ninguna columna de `public` cambia de nombre,
  tipo ni significado), no ejecutándola.
- **El salto de la barra a los 0,5 s (AG-DT-68)** con un ancho de pantalla
  real distinto de 1440 px.

**Tanda H (2026-11-15)**
- **Las páginas públicas y los correos «siempre en claro»** en teléfonos y
  buzones reales: sólo Chromium emulado con el sistema en oscuro y Mailpit.
  Gmail (Android/iOS) y Outlook invierten o atenúan los correos en su modo
  oscuro por su cuenta (AG-DT-73).
- **«Por confirmar» en vivo con el Realtime de producción** (un solo canal,
  la confirmación del paciente llegando por él): sólo el Realtime local.
- **El doble clic del punto 12 con la latencia real:** en local el alta del
  paciente responde en ~50 ms y por eso el segundo clic caía en la rejilla; con
  la red de producción el modal tarda más en irse. El escudo (600 ms, 24 px) se
  probó sólo en local.
- **`20261120120000` en producción:** que todas las clínicas queden sin
  recordatorio hasta que su administrador lo encienda sólo se vio en la semilla.
- **El disparador de H5 con los roles de producción** (el SQL Editor como
  `postgres` lo salta; la app y `service_role`, no) y con la credencial de
  `spinus-consola`, que no escribe en `appointments` según su contrato.

**Tanda I (2026-11-17)**
- **El remitente con el nombre del médico entre comillas** (I2, punto 21): sólo
  se vio en Mailpit. ASUMIENDO QUE Resend acepta la misma cabecera `From`
  (AG-DT-108); hasta un envío real, no está probado.
- **El canal de tiempo real que vive 2 min tras salir de la agenda** (I1),
  también después de cerrar sesión: SUPOSICIÓN sin verificar que Realtime
  vuelve a evaluar la RLS con el token nuevo (AG-DT-98).
- **El correo a la clínica por cada reserva** (I5) y el aviso del único sin
  correo: sólo en Mailpit; quién lo recibe en una clínica real (hasta 3
  administradores) no se vio.
- **«Por asignar» con un Google real** (I3): el criterio (sólo lo importado por
  el sondeo, ni todo el día ni lo ya terminado) se probó con el Google
  simulado.
- **Todos los consultorios «por revisar»** tras `20261121141000` (I4): con la
  semilla; con los consultorios reales de producción, no.
- **El arrastre de avisos de `20261121150000`** (empalmes de 30 días y
  cancelaciones de 48 h): en local la tabla nueva nace vacía tras el reinicio;
  con los datos de producción, no se vio.
- **A1-bis completo:** la instrumentación del build (`window.__agMed`) no está
  en el repo; se midió con una instrumentación reducida, igual en los dos lados
  (§9, «Tanda I»). Causas de render, `refinadosConCambio` y `resetOptions` no se
  midieron.

**Correcciones de seguridad (seg1 y seg2, integradas el 2026-11-12)**
- **El tiempo de respuesta del enlace** con teléfonos distintos (punto 1): se
  igualó el TRABAJO de la base (mismos contadores de `pg_stat_xact_user_tables`
  con un teléfono con historial, uno bloqueado a mano y uno limpio), no se midió
  el tiempo con la red, Vercel y Supabase reales.
- **Los tres disparadores con los roles de producción:** en local, `postgres`
  y `supabase_admin` pasan los tres, y `service_role` el de columnas y el de
  enlaces pero no el de borrado. Que el
  SQL Editor de producción corra como `postgres` (y por eso pase) no se vio.
  Tampoco con la credencial propia de `spinus-consola`, que no escribe en
  `appointments` según su contrato; si algún día lo hiciera, el disparador de
  borrado y el de columnas la rechazarían.
- **El nombre de quien reserva en el título de Google real** (punto 7b): sólo
  se vio con el Google simulado; cómo lo pinta Google en la web y en el
  teléfono, no.
- **El tope de sincronizaciones por clínica** (punto 8, 60 cada 10 min) con
  tráfico real: sólo con Vitest y las e2e de D11.
- **El conjunto combinado con `feature/limites-ajustables` en producción:** en
  local aplica y pasa con la lista de 41 en `p1`; el orden real en producción
  lo decide Angel (§7).
- **La guía de pruebas a mano:** el integrador siguió la preparación (P1–P11)
  comando por comando sobre una base recién reiniciada, ejecutó los comandos
  de SEG-A3, SEG-A4 y SEG-A7 y probó cada orden del Google simulado contra la
  app del 3002; las pruebas de pantalla (A a F, X) no las recorrió con un
  navegador: las cubre la batería de Playwright.
