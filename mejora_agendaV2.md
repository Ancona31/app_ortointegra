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

- **Rama:** no trabajar sobre `main`. Usar una rama aparte; `CLAUDE.md` pide
  prefijo `feature/` (por ejemplo `feature/agenda-v2`). Un commit por paso
  terminado, empujado al momento.
- **Entorno:** Docker corriendo, Supabase CLI en una versión que lea
  `supabase/config.toml` (la 2.95.4 fijada en `CLAUDE.md` no puede; la 2.117.0
  sí), Node 24. La base local es para probar migraciones y flujos; producción no
  se toca.
- **Agentes secundarios:** el orquestador reparte y verifica.
  - Modelo más capaz (Opus) para lo delicado: migraciones y RLS, sincronización
    con Google, seguridad del enlace de reserva.
  - Modelo más rápido (Sonnet) para lo mecánico: partir archivos, pruebas,
    interfaz.
  - Un revisor independiente, en otro modelo, lee cada cambio sin conocer la
    conclusión de quien lo escribió.
  - Cada migración pasa además por el prompt de
    `supabase/AUDITORIA-MIGRACIONES.md`.
- **Verificación del orquestador, en cada paso:** leer el diff, `npm run build`,
  `npm run lint`, `npm run test`, y las pruebas de navegador del área tocada. Un
  paso no está hecho porque un agente diga que lo está.
- **Reporte al cerrar cada bloque**, en pocas líneas: qué se hizo, archivos
  tocados, qué no funcionó, decisiones tomadas sin preguntar, qué sigue.
- **Parar y preguntar solo si:** el cambio toca una regla de seguridad de
  `CLAUDE.md`, el build no se puede reparar, o hace falta una decisión de
  producto que no esté en §2.

---

## 7. Lo que le toca a Angel

| Momento | Qué |
|---|---|
| Al inicio | Máquina con Docker; las tres autorizaciones de §3; confirmar o corregir la tabla de valores de §2 |
| Al cerrar cada bloque | Probar; aplicar en producción el SQL entregado (ya auditado y probado en local) |
| Bloque C | Prueba con una cuenta real de Google (conectar exige un clic humano); variables y, si aplica, tarea programada en Vercel |
| Bloque D | Aprobar el texto de consentimiento; encender el enlace |
| Bloque E | Activar la tarea programada de recordatorios; revisar el texto de los correos |
| Bloque F | Ver las capturas y grabaciones de antes y después; decir qué ajustar |
| Al final | `git merge` local sobre `main` |

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
- [ ] B — Cimientos
- [ ] C — Google en los dos sentidos
- [ ] D — Reserva por enlace
- [ ] E — Recordatorios y confirmación de asistencia
- [ ] F — Interfaz, movimiento y orden visual

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
