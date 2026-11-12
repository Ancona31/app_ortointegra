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

| Momento | Qué |
|---|---|
| Durante el proyecto | Nada obligatorio: los reportes de bloque son informativos |
| Al final, en local | Auditar con lo que se entrega: conjunto de migraciones con sus auditorías, datos inventados sembrados, guía corta para levantar todo, sección «Decisiones para la auditoría final» y lista de lo que no se pudo probar en local |
| Después de auditar | `select version()` en producción; aplicar el conjunto de migraciones; prueba con cuenta real de Google; variables, `CRON_SECRET` y tareas programadas en Vercel; revisar el texto legal del consentimiento y de los correos; encender el interruptor por clínica |
| Al final | `git merge` local sobre `main` |

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
  falta una migración).
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

### Bloque F

- Las 18 propuestas de la auditoría visual, aprobadas. **El pulido visual y los
  defectos salen directo; las interacciones nuevas** (burbuja de creación
  rápida, tarjeta de lectura, mini calendario, atajos, búsqueda, gestos,
  arrastrar con duración) **van detrás del interruptor**.
- Punto 11 (Compactar a media cita): no se reproduce (desajuste de ≤ 1 px).
- Punto 13 (Mes del teléfono): defecto confirmado y arreglado (`7f81548`).

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
