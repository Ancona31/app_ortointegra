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
