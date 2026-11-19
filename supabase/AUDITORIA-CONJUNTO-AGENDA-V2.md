# Auditoría del conjunto de migraciones — agenda v2

Cierre del proyecto `mejora_agendaV2.md` (rama `feature/agenda-v2`), 2026-11-12.
Todo se hizo contra la base **local** de Docker (`supabase_db_app_ortointegra`,
PostgreSQL 17.6). Producción no se tocó ni se leyó. Este documento no sustituye
a la auditoría de cada archivo (`supabase/AUDITORIA-MIGRACIONES.md`, en la
cabecera de cada migración): se suma a ella. `AUDITORIA-MIGRACIONES.md` no se
modificó. Las dimensiones que se proponen para esa lista están en el §6.

## 1. El conjunto

Las 16 migraciones del proyecto, confirmadas con
`git diff --name-only main...HEAD -- supabase/migrations`. Se aplican después de
las 5 de `main`, en orden de nombre de archivo.

| # | Archivo | Qué hace |
|---|---|---|
| A1.8 | `20261111120000_agenda_a18_indices_rango.sql` | dos índices de rango sobre `appointments` |
| B0 | `20261112120000_agenda_b0_auditoria_citas.sql` | `log_cita_change()` y los disparadores `audit_appointments*` |
| B1 | `20261112130000_agenda_b1_ajustes_interruptor.sql` | `agenda_ajustes` (ajustes, candado e interruptor) |
| B5 | `20261112140000_agenda_b5_horario_propio.sql` | `consultorios.horario_propio` |
| B6 | `20261112150000_agenda_b6_tipos_cita.sql` | `tipos_cita` y `appointments.tipo_cita_*` |
| C1 | `20261113120000_agenda_c1_gcal_sync_estado.sql` | `gcal_sync_estado`, el candado y la puerta S3 |
| C2 | `20261113130000_agenda_c2_gcal_aplicar.sql` | aplicar e importar desde Google; `via:'google'` en `log_cita_change` |
| D1 | `20261114120000_agenda_d1_enlaces_reserva.sql` | `reserva_avisos`, `reserva_enlaces` y `appointments.reserva_*` |
| D2 | `20261114130000_agenda_d2_candado_reserva.sql` | `reserva_incidencias`, `reserva_contactos` y el candado |
| D3 | `20261114140000_agenda_d3_reservar.sql` | `reserva_verificaciones` y `reservar_por_enlace` |
| D4 | `20261114150000_agenda_d4_gcal_por_ligar.sql` | Google no reescribe el título de una cita por ligar |
| E1 | `20261115120000_agenda_e1_confirmacion_enlace.sql` | `cita_confirmaciones`; lista blanca de `via` |
| E6 | `20261115130000_agenda_e6_reagendar.sql` | `cita_reagendos` y `reagendar_por_enlace` |
| E4 | `20261115140000_agenda_e4_correos_cita.sql` | `cita_correos` (registro de envíos) |
| E9 | `20261115160000_agenda_e9_rsvp_google.sql` | `cita_rsvp_google` |
| D11 | `20261116120000_agenda_d11_sync_antes_de_reservar.sql` | `reserva_empalmes_google`, frescura y avisos de empalme |

## 2. Cada migración: veredicto

La auditoría independiente de cada una está en su cabecera. En el cierre se
revisó cada auditoría contra las 18 dimensiones de `AUDITORIA-MIGRACIONES.md`, y
las reglas transversales se comprobaron en el catálogo de la base recién
reiniciada (§3). D11 no tenía auditoría formal, solo la revisión de su diff: se
le hizo en el cierre.

| # | Auditoría previa | Revisión del cierre | Veredicto |
|---|---|---|---|
| A1.8 | APTA | No mueve permisos. El replay desde cero da 5 × OK | APTA |
| B0 | APTA | DEFINER con `search_path=''`. Sin PUBLIC; trigger con los 3 roles (la regla). Requiere PG ≥ 14 | APTA |
| B1 | APTA | RLS + 3 policies. FK RESTRICT. anon sin nada, sin DELETE. El interruptor solo para `postgres`/`supabase_admin`, y ninguna DEFINER escribe la tabla (§3, consulta 11) | APTA |
| B5 | APTA | Columna con DEFAULT constante. La policy por fila de `consultorios` es heredada (aceptado) | APTA |
| B6 | APTA (notas incorporadas) | FK RESTRICT a `clinicas`, `profiles` y `tipos_cita`. CHECK bidireccional | APTA |
| C1 | APTA CON CAMBIOS (aplicados) | Las 6 funciones INVOKER, solo `service_role`. S3 no modificó `clinica_tiene_acceso()` ni `clinica_no_suspendida()` (huella idéntica a `main`, §3) | APTA |
| C2 | APTA CON CAMBIOS (aplicados) | `log_cita_change` reemplazado con la misma firma y los mismos grants | APTA |
| D1 | APTA CON CAMBIOS (aplicados) | Tres FK RESTRICT nuevas: dos desde `appointments` (enlace, aviso) y una hacia ella (`usado_cita_id`) (efecto en §4, H1) | APTA |
| D2 | APTA CON CAMBIOS (aplicados) | `reserva_contacto_marcar` y `reserva_contactos_bloqueados` solo `authenticated`, justificado en el archivo (usan la RLS de la sesión) | APTA |
| D3 | APTA CON CAMBIOS (aplicados) | Guarda de READ COMMITTED. Carrera probada (`reserva-carrera.sh`) | APTA |
| D4 | APTA CON CAMBIOS (aplicados) | Misma firma que C2 en las dos funciones, sin sobrecarga (§3, consulta 2) | APTA |
| E1 | APTA CON CAMBIOS + re-auditoría APTA | `cita_confirmaciones.paciente_id` **sin FK**, a propósito: una RESTRICT bloquearía borrar pacientes sin historial. Lo cuenta su COMMENT. No es una FK a pacientes, así que no choca con la regla de `CLAUDE.md`, pero tampoco hay integridad referencial: para Angel | APTA (nota) |
| E6 | APTA CON CAMBIOS | Siguen abiertos, para Angel: el correo del reagendado y el techo de 100 (§4, H5) | APTA (notas) |
| E4 | APTA CON CAMBIOS | Siguen abiertos, para Angel: el `enviando` del tercer intento, `duplicado` y el disparador sin huella | APTA (notas) |
| E9 | APTA | No cierra la clínica suspendida por sí misma; la cierra quien la llama (§4, H4) | APTA (nota) |
| D11 | Revisión del diff: APTA CON CAMBIOS | **Auditoría formal del cierre: APTA CON CAMBIOS, aplicados en el archivo** (§5) | APTA tras los cambios |

## 3. Comprobaciones del conjunto en el catálogo

Las cuatro bases sobre las que se comprobó:

- **(R) rama:** `supabase db reset --local` con las 21 migraciones (5 de `main` +
  las 16).
- **(M) solo main:** las 5 de `main`.
- **(C) combinada:** main + las tres `20261014*` de `feature/limites-ajustables`
  + las 16, en orden de nombre.
- **(F) final:** igual que R, con D11 corregida.

Las consultas (`pg_proc`, `pg_policies`, `pg_trigger`, `pg_constraint`,
`information_schema.role_routine_grants` y `role_table_grants`,
`has_function_privilege`) son las del guion `catalogo.sql`, más una huella
md5 por objeto de `public`: definición y `proacl` de cada función, cada policy,
cada disparador, `relacl`/RLS de cada tabla y cada constraint.

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Las 38 funciones del proyecto: EXECUTE a PUBLIC | ninguna. 26 solo `service_role` (las que llama el servidor). 2 solo `authenticated` (las de sesión de D2). 2 con `authenticated`+`service_role`. Las 7 de disparador y `cita_confirmacion_coincide` (pura), los tres roles, como pide la regla |
| 2 | Sobrecargas en `public` | ninguna, salvo `unaccent` (extensión). Los `CREATE OR REPLACE` repetidos (`log_cita_change` B0→C2→E1, `gcal_citas_por_evento`/`gcal_aplicar_evento` C2→D4) conservan firma y grants |
| 3 | SECURITY DEFINER sin `search_path` fijo | ninguna. Solo hay dos DEFINER nuevas (`log_cita_change`, `reserva_registrar_incidencia`), las dos con `search_path=''`; las INVOKER también lo llevan |
| 4 | Las 12 tablas nuevas | todas con RLS. anon sin ningún privilegio. `gcal_sync_estado` y `reserva_verificaciones` sin policies ni grants de sesión (solo servidor) |
| 5 | Policies de `appointments` | las 5 de siempre, intactas. `appointments_gates_insert` sigue siendo la única RESTRICTIVE; ninguna migración añade otra puerta ni toca las `*_gates_insert` |
| 6 | Disparadores de `appointments` | `audit_appointments`, `audit_appointments_update` (B0) y `trg_appointments_reserva_incidencia` (D2), todos AFTER: no se pisan y su orden no importa |
| 7 | CASCADE | ninguna FK nueva con CASCADE. Las 13 CASCADE de `public` vienen todas de `main` (entre ellas `appointments.clinica_id`) |
| 8 | FK a `pacientes` | ninguna nueva (ver E1) |
| 9 | Lista blanca de `via` | `c_vias` = `google`, `enlace_paciente`, `google_rsvp`. Son exactamente los literales que ponen las funciones; E6 además lo limpia con `''`, que no está en la lista |
| 10 | Columnas técnicas de `log_cita_change` | la misma lista en las tres versiones y en el WHEN. Las columnas nuevas de `appointments` (`tipo_cita_*`, `reserva_*`) no son técnicas y se auditan, como corresponde |
| 11 | DEFINER de `postgres` que escriban `agenda_ajustes`, `reserva_enlaces` o `reserva_contactos` (tablas protegidas por `current_user`) | ninguna |
| 12 | Contrato con spinus-consola | ninguna migración nombra `ajuste_*` ni `limite_efectivo`, ni hace `ALTER`/`UPDATE` sobre `clinicas` |
| 13 | **S3 y objetos previos: huella M contra R** | **0 objetos de `main` cambiados o quitados** (355 huellas de M, todas iguales en R; R añade 183: 38 funciones, 18 policies, disparadores, tablas y constraints). `clinica_tiene_acceso()`, `clinica_no_suspendida()`, `get_clinica_id()` y todas las policies previas, idénticas en definición y permisos |
| 14 | **Huella R contra C** (con limites-ajustables) | los objetos del proyecto son idénticos en definición y `proacl`. C solo añade lo de limites: sus 4 constraints `clinicas_ajuste_*`, `limite_efectivo`, `proteger_ajustes_clinica` con su disparador, y los cuatro `sa_*` reescritos. Las 24 migraciones se aplican sin fallo |
| 15 | Idempotencia del conjunto | el reinicio desde cero aplica las 21 sin fallos (48 s), y cada archivo traía su doble pasada probada. D11, tras corregirla: segunda pasada sin ningún cambio (huella idéntica) y rejilla 7 × OK |

## 4. Hallazgos del conjunto

Se juntan dos fuentes: lo que encontró el coordinador del cierre (Opus) y una
auditoría independiente del conjunto hecha en otro modelo (Sonnet). El
revisor no vio las conclusiones del coordinador; abajo se dice qué vio cada
uno y qué se hizo.

**H1 · Las FK RESTRICT nuevas hacia `appointments` hacen que una cita con
historial de agenda ya no se pueda borrar** (D1, D2, E1, E4, E6). Lo vieron los
dos.
- Una cita a la que alguna vez se le emitió un enlace de confirmación, se le
  mandó un correo, se le registró una incidencia o gastó un enlace de un solo
  uso ya no se borra: `DELETE` → 23503. Además, borrar una clínica, que antes
  arrastraba sus citas por `appointments.clinica_id` CASCADE, ahora falla en
  cuanto la clínica tiene una fila en `agenda_ajustes` o en cualquiera de las
  tablas nuevas, todas RESTRICT a `clinicas`.
- **Está atendido en el código, y es el comportamiento que se busca** (las
  citas con paciente no se borran, se cancelan; `CLAUDE.md`, «los
  expedientes no se borran»):
  - `DELETE /api/appointments/[id]` da 409 antes de borrar una cita con
    paciente o por ligar con el interruptor encendido;
  - traduce el 23503 a 409 «cancélala» cuando está apagado
    (`src/app/api/appointments/[id]/route.ts:1398-1440`);
  - el único borrado de clínicas del código (`api/me/clinica`, que deshace
    una clínica recién creada) no tiene filas que lo bloqueen.
- ~~Lo que queda: un `DELETE` directo por PostgREST recibe el 23503 en crudo, sin
  perder datos.~~ **Falso tal como estaba escrito (corregido el 2026-11-12,
  revisión independiente posterior al cierre).** Sólo era cierto para las
  citas **con historial de agenda** (las que sostiene alguna FK RESTRICT de
  arriba). Una cita con paciente o por ligar **sin** ese historial —la gran
  mayoría— **sí se podía borrar** por PostgREST, sin pasar por la API: la RLS
  `appointments_delete` deja borrar a médico, administrador y secretaria
  cualquier cita de su clínica, y el 409 de B3/D6 sólo vive en la API.
- **Corregido** con `20261117120000_agenda_seg_borrado_cita.sql`: el disparador
  `BEFORE DELETE` `trg_appointments_proteger_borrado` rechaza (42501) borrar una
  cita con paciente o por ligar cuando la clínica tiene la v2 encendida, también
  a `service_role`; con la v2 apagada o sin fila de ajustes, se borra como
  antes. Lee sólo `OLD` y `agenda_ajustes`, nunca `appointments`; no toca
  ninguna policy. Prueba: `supabase/pruebas-sql/seg_borrado_cita.sql` y
  `e2e/seguridad-postgrest.e2e.ts`. Detalle en `mejora_agendaV2.md` §6-bis,
  «Correcciones de seguridad en la base tras la revisión independiente».
- El revisor lo calificó «probable, por confirmar en `src/`»; en `src/` estaba
  manejado, pero la base no.

**H2 · Fusionar con `feature/limites-ajustables` pone en rojo
`p1_permisos_funciones.sql`, caso 3.** Lo vieron los dos; confirmado en la
base C.
- El caso fija la lista textual de las 10 funciones que no ejecutan los tres
  roles. Con la agenda son 40: las 30 nuevas cerradas a propósito más esas 10.
- **No es una brecha:** en C, el resto de `p1` (casos 1, 2 y 4-7), `p1b`, `p2`,
  `p3` y las 17 pruebas del proyecto pasan.
- **Para Angel, al fusionar:** actualizar la lista del caso 3 con las funciones
  del proyecto. Su propio comentario lo prevé: «si una migración cierra o abre
  otra, esta lista cambia con ella».

**H3 · Sin las tablas, cada apertura de la agenda escribe un `warn` en el
log.** Lo vio el coordinador, en la prueba de tolerancia (§5).
- Con el código desplegado y las migraciones sin aplicar, `agendaV2Encendida`
  escribe «interruptor de la agenda sin leer (cuenta como apagado)» en cada
  petición. Fueron 150 líneas en una corrida de 100 pruebas.
- El comportamiento es el de hoy, y `console.warn` no va a Sentry (no hay
  integración de consola). Es solo ruido en los logs de Vercel.
- **Orden recomendado:** aplicar el conjunto antes de desplegar el código.
  Los dos órdenes son seguros, pero ese no ensucia.

**H4 · E9 no cierra por sí misma la clínica suspendida.** Lo vio el revisor.
- E1 lo había anticipado («Señalado para E9»): `cita_rsvp_google` no mira
  `clinicas.suspendida`.
- **Está mitigado en quien la llama.** El único llamador es la pasada de
  sincronización (`src/lib/gcalSincronizacion.ts:132`), que antes de nada exige
  `gcal_sync_clinica_habilitada` (la puerta S3: `clinica_no_suspendida()` y
  `clinica_tiene_acceso()`). Es la misma defensa que tienen
  `gcal_aplicar_evento` e `importar`. Además, E9 está detrás de
  `AGENDA_RSVP_GOOGLE`, apagado.
- Lo que queda es el resto conocido de una suspensión que llega a mitad de
  pasada (DEUDA_TECNICA.md).
- **Sin cambio en la migración.** Si Angel quiere defensa en profundidad, es un
  `EXISTS` sobre `clinicas.suspendida` en la función.

**H5 · `agenda_ajustes.candado_reagendados` no tiene techo, y
`reserva_reagendados` y `cita_reagendos.numero` lo tienen en 100** (B1 contra
D1/E6). Lo vio el revisor; ya estaba anotado en la cabecera de E6.
- Solo con un candado por encima de 100, fijado a mano por SQL: el reagendado
  101 sale con 23514, de forma atómica. Sin cambio.

**H6 · `spinus.via` se queda puesto hasta el fin de la transacción.** Lo vio
el revisor.
- E1, E9, C2 y D4 no lo limpian; E6 sí.
- Hoy cada RPC es su propia transacción (PostgREST), así que no contamina.
  Solo mordería si alguien agrupa dos de estas RPC en una transacción a mano.
  Sin cambio; queda anotado.

**H7 · El reinicio desde cero cambia el entorno local.** Lo vio el
coordinador.
- `db reset` con la CLI 2.117.0 recrea los contenedores con sus imágenes
  (Postgres 17.6.1.167 en vez de 17.6.1.084, storage-api nueva).
- La base queda sin las `20261014*` de `feature/limites-ajustables`, que ese
  worktree tenía aplicadas.
- Está anotado en la guía (§2) con la forma de volver al estado combinado.

**H8 · La semilla no toleraba la falta de `agenda_ajustes`** (herramienta de
prueba, no migración). Lo vio el coordinador.
- `scripts/agenda-semilla.ts` borraba esa tabla sin tolerar que no existiera.
  La segunda siembra sobre una base solo con `main` fallaba.
- Ahora le da el mismo trato que a `tipos_cita` (42P01/PGRST205). Commit del
  paso 5.

**Lo que parecía sospechoso y está bien** (comprobado por los dos):
- **Triple reemplazo de `log_cita_change`:** sin lógica perdida; el único
  cambio es aditivo, la etiqueta `via`.
- **C2 → D4:** el diff se queda en los 5 predicados descritos, y el pre-vuelo
  de D4 compara el md5 del cuerpo anterior.
- **Conteos fijos de los pre-vuelos y las rejillas** («las 5 policies de
  appointments»): siguen ciertos en el replay completo.
- **S3:** sigue evaluable, porque las dos originales siguen siendo SQL de una
  sentencia con `public.get_clinica_id()` una vez.
- **Las funciones solo-`service_role`:** se llaman solo desde el servidor.
- **`ALTER DEFAULT PRIVILEGES` de P1** (limites-ajustables): no reabre nada del
  proyecto.

## 5. D11: auditoría formal del cierre

La hizo un auditor independiente (Opus, sin ser el autor), con las 18
dimensiones. Veredicto: **APTA CON CAMBIOS**. Están aplicados en el archivo,
que no estaba en producción; en local se volvió a aplicar con el reinicio desde
cero. La cabecera lo anota.

**Hallazgo 1, aplicado.** El desempate «id menor» entre dos reservas
empalmadas perdía el par.
- Pasaba cuando la reserva de id menor ya no podía hacer de reserva
  (`attended` o terminada) y la otra sí.
- Ahora el orden canónico solo rige entre dos reservas activas.
- Prueba nueva: caso 5-ter de `d11_sync_antes_de_reservar.sql`. Con el
  predicado viejo da «dio 0, esperaba 1»; con el nuevo, verde.

**Hallazgos 4, 5 y 6, aplicados:**
- el pre-vuelo exige `agenda_ajustes.agenda_v2_encendida` boolean y SELECT de
  `service_role`;
- fila 7 de la rejilla: el UNIQUE del par, que usa el `ON CONFLICT ON
  CONSTRAINT`;
- COMMENT de la tabla y de `gcal_sync_frescura`;
- en la cabecera, las fechas adelantadas (2026-11-16 por 2026-11-12) y el
  bloqueo real: SHARE ROW EXCLUSIVE sobre `clinicas` hasta el COMMIT.

**No aplicado, para Angel:**
- **Hallazgo 2:** un par que vuelve a empalmarse pasados los 30 días que
  muestra el panel no reaparece. Arreglarlo exige UPDATE y rompe «nadie
  UPDATE».
- **Hallazgo 3:** con mucho historial, el `OR` de la consulta de pares recorre
  todas las citas de la clínica. La mejora opcional es partirla en dos ramas
  con `UNION`.
- No se comprueba el dueño de los objetos previos. Postgres ya rechaza
  reemplazar uno ajeno.

Tras el cambio: rejilla 7 × OK, segunda pasada sin cambios y
`reserva-google.e2e.ts` en verde en la batería final.

## 6. Dimensiones propuestas para `AUDITORIA-MIGRACIONES.md`

Las de este cierre se suman a las de §6-bis de `mejora_agendaV2.md`. El
archivo no se tocó: decide Angel.
- **Desempates canónicos:** cuando una regla elige representante de un par
  simétrico (por ejemplo, «el id menor»), comprobar que el elegido cumpla los
  filtros del papel que se le da. Si no, el par desaparece en silencio. Viene
  de D11.
- **Fechas del nombre y de la cabecera:** que no sean futuras respecto del
  commit. Viene de D11.
- **Efecto agregado de las FK RESTRICT hacia una tabla con policy de DELETE:**
  cada migración probó la suya por separado, y nadie miró qué borrados
  cotidianos dejaban de funcionar juntas. Viene de H1.
- **Pruebas que fijan listas textuales del catálogo** (p1, caso 3): una rama
  paralela las rompe al fusionar. Al auditar un conjunto, correr las pruebas de
  las dos ramas sobre la base combinada. Viene de H2.

## 7. Correcciones posteriores al cierre (2026-11-12)

Revisión de seguridad independiente posterior al cierre (rama
`feature/agenda-v2-seg2`). Tres migraciones más, al final del conjunto, cada
una con su auditoría independiente en la cabecera (las tres APTA):

| # | Archivo | Qué hace |
|---|---|---|
| S3 | `20261117120000_agenda_seg_borrado_cita.sql` | con v2 encendida, la base no deja borrar una cita con paciente o por ligar (corrige H1) |
| S4 | `20261117121000_agenda_seg_columnas_reserva.sql` | las columnas `reserva_*` de `appointments` sólo las escribe el servidor |
| S7a | `20261117122000_agenda_seg_emision_enlaces.sql` | un enlace de reserva sólo lo emite `service_role` (`reserva_enlace_emitir`) |
| seg1 | `20261117130000_agenda_seg1_candado_correo.sql` | el candado automático decide por el correo verificado; el bloqueo manual corta también el enlace único; todo el día ocupa en el enlace (rama `feature/agenda-v2-seg1`) |

Efecto sobre las comprobaciones del §3: tres funciones nuevas sin PUBLIC
(`cita_proteger_borrado` y `cita_proteger_reserva`, de disparador, con los
tres roles; `reserva_enlace_emitir`, sólo `service_role`, que se suma a la
lista del caso 3 de `p1_permisos_funciones.sql` al fusionar, H2); dos
disparadores BEFORE nuevos en `appointments` (fila 6 ya no son «todos
AFTER»); `proteger_reserva_enlaces` reemplazada con la misma firma y grants;
ninguna policy, ninguna FK ni ningún permiso de tabla cambian. Detalle en
`mejora_agendaV2.md` §6-bis, «Correcciones de seguridad en la base tras la
revisión independiente». seg1 (cuarta fila) sólo reemplaza
`reserva_contacto_estado`, `reserva_ocupacion` y `reservar_por_enlace`, con la
misma firma y los mismos permisos. Las cuatro juntas, auditadas como conjunto,
en el §8.

## 8. Integración de las correcciones (2026-11-12)

Las ramas `feature/agenda-v2-seg1` y `feature/agenda-v2-seg2` se escribieron en
paralelo sobre la misma base local, y cada una sólo se había probado con la
migración de la otra ya aplicada encima. Aquí se auditan juntas, sobre la rama
`feature/agenda-v2` con las dos fusionadas (`0dbfbd9`). Un revisor
independiente en otro modelo (Sonnet) hizo la misma auditoría en paralelo, sin
ver estas conclusiones; abajo se dice qué vio cada uno.

### 8.1 El conjunto, desde cero

`git diff --name-only main...HEAD -- supabase/migrations` = **20 migraciones**
del proyecto (las 16 del cierre + las 4 de las correcciones). `supabase db
reset --local` (CLI 2.117.0) aplicó las **25** (5 de `main` + 20) en orden y sin
un solo fallo, en 28 s; `schema_migrations` = 25, última `20261117130000`.
Ninguna rejilla dio REVISAR. Semilla en 1.3 s.

### 8.2 Veredicto de las cuatro

| # | Archivo | Auditoría previa (cabecera) | Integración | Veredicto |
|---|---|---|---|---|
| S3 | `20261117120000_agenda_seg_borrado_cita.sql` | APTA | Sin conflicto con las limpiezas ni con Google (§8.4, B) | APTA |
| S4 | `20261117121000_agenda_seg_columnas_reserva.sql` | APTA | Todos los escritores reales de `reserva_*` pasan (§8.4, A) | APTA |
| S7a | `20261117122000_agenda_seg_emision_enlaces.sql` | APTA | Nadie posterior depende del cuerpo viejo de `proteger_reserva_enlaces` (§8.4, C) | APTA |
| seg1 | `20261117130000_agenda_seg1_candado_correo.sql` | APTA (auditoría independiente en cabecera) | Sus tres funciones no las toca seg2; su pre-vuelo por md5 cuadra | APTA |

El revisor llegó a los mismos cuatro veredictos.

### 8.3 Catálogo: qué cambió de verdad

Huella md5 por objeto de `public` (la misma consulta del §3: definición y
`proacl` de cada función, cada policy, disparador, tabla y constraint) contra
las que se tomaron en el cierre:

- **Contra `main` (355 huellas): 0 objetos cambiados o quitados.**
  `clinica_tiene_acceso()` y `clinica_no_suspendida()` siguen idénticas
  (definición y permisos), y ninguna policy de `main` cambia.
- **Contra la base final del cierre (F): exactamente** 4 funciones
  reemplazadas con los mismos permisos (`proteger_reserva_enlaces`,
  `reserva_contacto_estado`, `reserva_ocupacion`, `reservar_por_enlace`), 3
  funciones nuevas (`cita_proteger_borrado`, `cita_proteger_reserva`,
  `reserva_enlace_emitir`) y 2 disparadores nuevos en `appointments`. **Ninguna
  policy, tabla, constraint, FK ni permiso de tabla** cambia.
- **EXECUTE a PUBLIC:** ninguna de las 7 funciones nuevas o reemplazadas.
  `cita_proteger_borrado` y `cita_proteger_reserva` (de disparador) y
  `proteger_reserva_enlaces`: los tres roles. `reserva_enlace_emitir`,
  `reserva_ocupacion` y `reservar_por_enlace`: sólo `service_role`.
  `reserva_contacto_estado`: `authenticated` y `service_role`, como en D2. Todas
  INVOKER con `search_path=''`.
- **Disparadores de `appointments`:** dos BEFORE (DELETE; INSERT OR UPDATE) en
  eventos distintos y tres AFTER (`audit_appointments`,
  `audit_appointments_update`, `trg_appointments_reserva_incidencia`). El BEFORE
  de columnas sólo lee y lanza, no cambia `NEW`, así que el orden entre ellos
  no importa.

### 8.4 Conflictos entre ellas y con las anteriores

**A · El disparador de columnas `reserva_*` (S4) contra quien las escribe.**
Decide con `current_user` y deja pasar a `service_role`, `postgres` y
`supabase_admin`. Las funciones del conjunto que escriben `appointments`
(`reservar_por_enlace` y `gcal_importar_evento` insertan;
`reagendar_por_enlace`, `gcal_aplicar_evento`, `cita_confirmacion_responder` y
`cita_rsvp_google` actualizan) son **todas INVOKER, propiedad de `postgres` y
ejecutables sólo por `service_role`**: corren con `current_user =
service_role` y pasan. No hay ninguna SECURITY DEFINER que escriba
`appointments` (la única DEFINER que la nombra, `log_cita_change`, sólo
escribe `audit_log`), así que tampoco hay una que se salte el disparador «por
dueño» (la dimensión 19 propuesta en §6-bis). Las acciones referenciales que
tocan la tabla (`paciente_id SET NULL`, el CASCADE de `clinica_id`) corren como
su dueño, `postgres`. Comprobado ejecutando: `reservar_por_enlace` como
`service_role` reserva (revisor) y la batería completa, las dos carreras y las
e2e de reserva, reagendado, confirmación y Google pasan (§8.6). Y al revés: la
sesión que cambia `reserva_correo_hmac`, `reserva_nombre`, `reserva_canal` o
`reserva_aceptado_en` recibe 42501 (revisor y coordinador, éste por PostgREST
con el JWT de `admin.a`).

**B · El disparador de borrado (S3) contra las limpiezas y Google.**
- La semilla borra `agenda_ajustes` antes que las citas (con la fila y v2
  encendida el borrado da 42501; sin ella, pasa: lo probó el revisor).
- Las e2e (`sqlLocal`), `reserva-carrera.sh` y `confirmacion-carrera.sh` borran
  como `postgres`, que el disparador deja pasar.
- La sincronización con Google **nunca borra** una fila de `appointments`
  (cancela o suelta el vínculo); el único `DELETE` de citas en `src/` es
  `DELETE /api/appointments/[id]`, que con v2 ya da 409 antes. No existe un
  borrado de Google de eventos sin paciente que pueda chocar.
- B2 («la cita ya no se duplica al deshacer») deshace en el cliente con
  `revert()` o con un PUT; no borra.
- El script nuevo del Google simulado (`scripts/google-falso-manual.ts`) sólo
  borra al cerrar eventos sin paciente nacidos en Google, como `postgres`.

**C · `proteger_reserva_enlaces()` reemplazada por S7a.** seg1 no la toca, y
ninguna migración posterior compara su md5 ni parte de su cuerpo. Quien la
reemplace en el futuro tiene que partir del cuerpo de `20261117122000` (md5 de
`prosrc` `acd4128b5f25df54f6b4fd95391cf1dc`), no del de D1; queda en
`CLAUDE.md`. `reserva_enlace_regenerar_fijo` (D1) ya no puede insertar con la
sesión y no tiene llamadores; falla entera, sin dejar revocado el enlace
anterior (lo comprobó el revisor). Retirarla es una limpieza aparte
(Protocolo 2).

**D · seg1 contra seg2.** Ninguna de las tres funciones de seg1 la cambia
seg2, y el pre-vuelo por md5 de seg1 compara los cuerpos de D2/D3, que siguen
siendo los de antes cuando seg1 se aplica (va última por nombre). No hay
sobrecargas nuevas.

### 8.5 La base combinada con `feature/limites-ajustables`

Reinicio con las **28** migraciones (5 de `main` + las tres `20261014*` + las
20 del proyecto, en orden de nombre): todas aplican sin fallo. Los objetos del
proyecto quedan **idénticos** a los de la rama (huella: 0 diferencias en
funciones, policies, disparadores y constraints de la agenda); lo que cambia es
sólo lo de limites (permisos de las funciones de `main` y sus objetos nuevos).

- **`p1_permisos_funciones.sql`, caso 3: en rojo con su lista de 10, como se
  esperaba (H2).** Son ahora **41** funciones: las 10 de producción más **31**
  del proyecto (las 30 del cierre y `reserva_enlace_emitir`). Confirmado con la
  misma consulta del caso 3 en la base combinada. Con la lista ampliada, el
  caso 3 pasa.
- `p1` (resto de casos), `p1b`, `p2`, `p3` y 20 de las 21 pruebas del proyecto,
  en verde. **La 21.ª, `seg1_candado_correo.sql`, en rojo** (hallazgo I1).
- `reserva-carrera.sh` (con su control sin candado: A=ok, B=ok) y
  `confirmacion-carrera.sh`, en verde.

**La lista exacta para el caso 3** (a pegar en lugar de la de diez al fusionar
las dos ramas; el texto del `raise` cambia de «las diez» a «las 41»):

```
alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), cita_confirmacion_contexto(text), cita_confirmacion_emitir(uuid,uuid,uuid,text,uuid), cita_confirmacion_responder(uuid,text,text), cita_confirmacion_revocar(uuid,uuid), cita_correo_marcar(uuid,uuid,uuid,text,text), cita_correo_tomar(uuid,uuid,text,uuid), cita_correos_pendientes(integer), cita_reagendar_oferta(uuid,text), cita_rsvp_google(uuid,uuid,text,text,text[]), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), gcal_aplicar_evento(uuid,uuid,timestamp with time zone,text,text,timestamp with time zone,text,boolean,timestamp with time zone,timestamp with time zone,boolean,text,boolean,text,boolean), gcal_citas_por_evento(uuid,text[],uuid[]), gcal_importar_evento(uuid,text,text,text,timestamp with time zone,text,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid), gcal_sync_avanzar(uuid,uuid,text,text,timestamp with time zone,integer), gcal_sync_clinica_habilitada(uuid), gcal_sync_clinicas_pendientes(integer), gcal_sync_frescura(uuid), gcal_sync_reiniciar(uuid,uuid), gcal_sync_soltar(uuid,uuid,text), gcal_sync_tomar(uuid,uuid,text,integer,integer), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), reagendar_por_enlace(text,uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), reserva_codigo_emitir(uuid,uuid,text,text), reserva_codigo_verificar(uuid,uuid,text,text,text), reserva_contacto_estado(uuid,uuid,text,text), reserva_contacto_marcar(uuid,text), reserva_contactos_bloqueados(), reserva_contexto(text,text,text), reserva_empalmes_registrar(uuid,uuid[]), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text), reserva_enlace_regenerar_fijo(uuid,uuid,text), reserva_ocupacion(uuid,uuid,timestamp with time zone,timestamp with time zone), reservar_por_enlace(uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()
```

### 8.6 Pruebas, antes y después del reinicio

| | Sobre la fusión (antes) | Desde cero (después) |
|---|---|---|
| `npm run build` | limpio | (no depende de la base) |
| `npm run lint` | 96 errores (sin subir) | igual |
| Vitest | 1701 pruebas en 113 archivos | 1701 en 113 |
| SQL (`pruebas-sql.sh`) | 21 archivos en verde | 21 en verde |
| Playwright completo | — | 252 pasan, 0 fallan, 219 saltadas (escritorio 212, teléfono 37, tableta 3), 7.5 min |
| e2e de Google falso, `seguridad-postgrest`, `reserva-seg1` | — | dentro de la batería, en verde (20 pruebas) |
| `reserva-carrera.sh` | — | verde; control sin candado = 2 citas |
| `confirmacion-carrera.sh` | — | verde |

Antes del reinicio no se corrió Playwright: la fusión sólo pedía build, lint,
Vitest y SQL, y Playwright necesita la base sembrada desde cero.

### 8.7 Hallazgos de la integración

**I1 · `seg1_candado_correo.sql` falla en la base combinada** (coordinador).
`permission denied for function dia`: la prueba crea un ayudante en `pg_temp`
y lo llama como `service_role`. Con los privilegios por omisión de P1
(globales, sin PUBLIC), una función nueva de `postgres` nace sin EXECUTE
también en `pg_temp`; los demás ayudantes de esa prueba ya llevaban su
`grant`, al del caso 6 le faltaba. Es de la prueba, no de la migración.
**Arreglado** con el `grant` explícito (comentado en el archivo). En rojo sin
él en la base combinada; verde con él en la rama y en la combinada. Es
justamente la dimensión propuesta en §6 («correr las pruebas de las dos ramas
sobre la base combinada»).

**I2 · En la base local de esta rama, 7 funciones de `main` ejecutables por
PUBLIC** (revisor, hallazgo 2). Es cierto en la base reconstruida sin las
`20261014*`: `alta_conexion_google`, `enforce_limite_documentos_paciente`,
`generar_folio`, `guardar_secretos_conexion`,
`leer_conexion_google_con_secretos`, `sync_antropometria_paciente` y
`trg_mediciones_antropometria`, más el PUBLIC de casi todas las de `main`. El
revisor proponía fusionar limites antes que la agenda «para que el hueco no
llegue a producción». **No lo trae la agenda:** la huella de §8.3 dice que
ningún permiso de un objeto de `main` cambia, y en producción esos permisos son
los que ya están aplicados allí, no los de esta base local. Arreglarlo es el
objeto de P1/P1b, en `feature/limites-ajustables`, y el orden de fusión de las
dos ramas no lo empeora ni lo mejora. Sin cambio aquí; anotado.

**I3 · La semilla depende del orden «ajustes antes que citas»** (revisor,
informativo). Ya está explicado en el comentario de `scripts/agenda-semilla.ts`
con el nombre de la función. Sin cambio.

**I4 · El revisor no ejercitó en vivo el enlace fijo con ficha de correo**
(nota de cobertura). Lo cubren `seg1_candado_correo.sql` y
`e2e/reserva-seg1.e2e.ts`, en verde en §8.6. Sin cambio.

Fuera de la base, pero encontrado en la misma pasada: no hay camino en la
interfaz para convertir en cita un evento nacido en Google (§2 del plan lo
pide). `DEUDA_TECNICA.md` AG-DT-29.

## 9. Tanda de diseño, duración y horarios (2026-11-14)

Cuatro ramas escritas en paralelo sobre la misma base local
(`feature/agenda-v2-g1` a `-g4`), fusionadas en `feature/agenda-v2` en el
orden G4, G2, G1, G3 (`91e7794`, `e67df4b`, `5b4c1cb`, `a301b08`). G1 no trae
migraciones; las otras tres, cuatro. Aquí se auditan juntas, sobre la base
reiniciada desde cero. Un revisor independiente en otro modelo (Sonnet) hizo
la misma auditoría en paralelo, sin ver estas conclusiones; abajo se dice qué
vio cada uno.

### 9.1 El conjunto, desde cero

`git diff --name-only main...HEAD -- supabase/migrations` = **24 migraciones**
del proyecto (las 20 de antes + `20261119120000`, `20261119121000`,
`20261119130000` y `20261119140000`). `supabase db reset --local` (CLI 2.117.0)
aplicó las **29** (5 de `main` + 24) en orden y sin un error, en 29 s;
`schema_migrations` = 29, última `20261119140000`. Semilla en 2 s.

### 9.2 Veredicto de las cuatro

| # | Archivo | Qué hace | Auditoría previa (cabecera) | Integración | Veredicto |
|---|---|---|---|---|---|
| G2 | `20261119120000_agenda_g2_duracion_consulta.sql` | `tipos_cita.principal` y `consultorio_id` (FK, dos CHECK, dos índices únicos parciales), el disparador `validar_tipo_cita_consultorio()`, la policy `tipos_cita_insert` (autorizada) y `reserva_contexto` con el consultorio y el principal de cada tipo | APTA | `reserva_contexto` = cuerpo de D3 + dos claves en `tipos` (diff de una línea); nadie lo reemplazó entre D3 y G2 | APTA |
| G2b | `20261119121000_agenda_g2_tipos_cita_update.sql` | la policy `tipos_cita_update` (autorizada): el médico cambia y archiva SUS tipos | APTA | Sólo esa policy; USING = WITH CHECK | APTA |
| G4 | `20261119130000_agenda_g4_herencia_horario_consultorios.sql` | copia UNA vez `clinicas.horario_consulta` a cada consultorio sin horario propio, con respaldo en `respaldos.consultorios_horario_20261119` | APTA CON CAMBIOS (aplicado) | Sólo datos y una tabla de respaldo; ningún objeto de `public` cambia de forma | APTA |
| G3 | `20261119140000_agenda_g3_correo_confirmacion.sql` | `confirmacion` en el CHECK de `cita_correos.tipo` y en `cita_correo_tomar` (la ventana del recordatorio, sólo al recordatorio) | APTA | `cita_correo_tomar` = cuerpo de E4 salvo dos condiciones; mismos permisos | APTA |

### 9.3 Conflictos entre ellas y con las anteriores

**A · Las dos policies nuevas de `tipos_cita` contra las puertas de
suscripción.** `tipos_cita` no lleva puerta RESTRICTIVE desde B6, a propósito
(§3 de este documento y `CLAUDE.md`): no es un dato de paciente y la barrera
de la reserva está en otra parte. Las dos policies reemplazadas siguen siendo
PERMISSIVE, `TO authenticated`, con `clinica_id = get_clinica_id()`; lo único
que añaden es el médico sobre las filas con `medico_id = auth.uid()` y rol
`medico`. Consecuencia (por lectura de las policies; nada la contradice en las pruebas): en una clínica en sólo lectura (free
degradada) un médico puede ahora crear o cambiar SUS tipos, como ya podía el
administrador desde B6. **No abre ninguna reserva:** `reserva_contexto` sigue
devolviendo NULL a una clínica sin acceso (`gcal_sync_clinica_habilitada`,
la puerta S3 de C1, que lee el cuerpo vigente de `clinica_tiene_acceso()` y
`clinica_no_suspendida()`), y las 7 RESTRICTIVE de INSERT de `main` (pacientes,
consultas, documentos, appointments, addendums, mediciones, consultorios) no
cambian. Ninguna policy de `main` cambia (huella, §9.4). Las dos son idénticas
a las de B6 para el administrador, y la secretaria sigue sin INSERT ni UPDATE.

**B · Las dos policies contra `reserva_contexto`.** `reserva_contexto` es
INVOKER y sólo la ejecuta `service_role` (que se salta la RLS): las policies no
la alcanzan. Lo que la reserva ve de los tipos lo decide su propio `WHERE`
(clínica del enlace, activos, de toda la clínica o del médico del enlace), que
G2 no cambió; G2 sólo añadió `consultorio_id` y `principal` al objeto de cada
tipo (diff de una línea contra el cuerpo de D3, y nadie lo reemplazó entre D3
y G2). Qué tipos valen en cada consultorio lo filtra la ruta con
`tiposDelConsultorio` antes de `reservar_por_enlace`, que no mira el
consultorio del tipo (convenio escrito en los COMMENT). La garantía atómica de
`reservar_por_enlace` no cambia (su cuerpo es el de seg1). El disparador
`validar_tipo_cita_consultorio()` (INVOKER, lee `consultorios` con la RLS de
quien escribe) impide que un médico ponga un principal en el consultorio de
otro; con el administrador falla cerrado (AG-DT-51).

**C · El CHECK de `cita_correos` contra E4.** G3 rehace
`cita_correos_tipo_check` con `confirmacion` añadido y `cita_correo_tomar` con
dos cambios: acepta `confirmacion` y la ventana del recordatorio se exige sólo
al recordatorio (`p_tipo <> 'recordatorio' OR …`; antes, `p_tipo =
'comprobante' OR …`, que es lo mismo para los dos tipos de antes). La llave
única de E4 es `(cita, tipo, inicio_cita)`: una confirmación por hora de
inicio, sin tocar las de los otros tipos. `cita_correos_pendientes` (la tarea
de recordatorios) sólo mira filas `comprobante` y `recordatorio`, así que una
confirmación **no** suprime el recordatorio. El resto de CHECK de E4
(estado, motivo, intentos, coherencia) no cambia. Mismos permisos
(`service_role`), INVOKER, `search_path=''`.

**D · El esquema `respaldos` y la tabla nueva de G4.** El esquema ya existía en
`main` (`20260912190416_remote_schema.sql` lo crea con
`appointments_gcal_20260815`); G4 sólo añade
`respaldos.consultorios_horario_20261119` (`id, clinica_id, horario,
horario_propio, respaldado_en`, con su llave). Privilegios: sólo `postgres`
(`REVOKE ALL … FROM PUBLIC, anon, authenticated, service_role`), RLS activada
y sin policies; `anon`, `authenticated` y `service_role` no tienen ni USAGE del
esquema (comprobado con `has_schema_privilege` y `has_table_privilege`).
PostgREST no lo expone (no está en los esquemas de la API). **spinus-consola**
lee `public` con vistas propias: no ve `respaldos` y nada de lo que lee cambia
(`clinicas.ajuste_*`, `limite_efectivo`, `clinica_tiene_acceso()` intactos;
`clinicas.horario_consulta` no se borra ni se cambia; en `consultorios` sólo
cambian VALORES de `horario` y `horario_propio`, no columnas). El disparador
`audit_consultorios` deja una fila UPDATE por consultorio copiado.

**E · EXECUTE a PUBLIC.** Ninguna de las tres funciones creadas o
reemplazadas lo tiene: `validar_tipo_cita_consultorio()` (de disparador; los
tres roles, con `REVOKE … FROM PUBLIC` explícito), `reserva_contexto` y
`cita_correo_tomar` (sólo `service_role`, como antes). G4 no crea funciones
(un bloque `DO`). Las demás funciones de `public` con PUBLIC en esta base son
las de `main` sin P1 (las arregla `feature/limites-ajustables`; I2 del §8.7).

### 9.4 Catálogo: qué cambió de verdad

Huella md5 por objeto de `public` (la consulta del §3: definición y `proacl` de
cada función, cada policy, disparador, tabla y constraint) de la base recién
reiniciada con las 29, contra las de `main` (cierre) y contra la de las 25
(integración de las correcciones, §8):

- **Contra `main` (355 huellas): 0 objetos cambiados o quitados.**
  `clinica_tiene_acceso()`, `clinica_no_suspendida()`, `limite_efectivo` (no
  está en esta rama) y todas las policies de `main` siguen idénticas.
- **Contra las 25 (543 huellas): exactamente** 2 policies reemplazadas
  (`tipos_cita_insert`, `tipos_cita_update`: las dos de B6, autorizadas por
  Angel), 2 funciones reemplazadas con los mismos permisos
  (`reserva_contexto`, `cita_correo_tomar`), 1 constraint rehecha
  (`cita_correos_tipo_check`), y nuevos: 1 función
  (`validar_tipo_cita_consultorio()`), 1 disparador
  (`trg_tipos_cita_consultorio`) y 3 constraints de `tipos_cita` (la FK
  `consultorio_id` y los dos CHECK). Ninguna tabla de `public` cambia de
  permisos ni de RLS; ninguna se quita. (Los índices no entran en la huella:
  G2 rehace `tipos_cita_nombre_activo_unico` para no mirar las filas con
  consultorio y crea `tipos_cita_principal_unico` y `tipos_cita_consultorio`.)
- Fuera de `public`: la tabla `respaldos.consultorios_horario_20261119` (G4).

### 9.5 La base combinada con `feature/limites-ajustables`

Reinicio con las **32** migraciones (5 de `main`, las tres `20261014*` y las 24
del proyecto, en orden de nombre): todas aplican sin fallo (el primer intento
de la CLI abortó en «Initialising schema» con `LegacyDbSetupError`; el segundo,
igual, pasó: del contenedor, no de las migraciones). Los 210 objetos de la
agenda (funciones, policies, disparadores y constraints) quedan **idénticos**
a los de la rama; ninguna función de `public` queda con EXECUTE a PUBLIC.

- **`p1_permisos_funciones.sql`, caso 3: en rojo, como se esperaba (H2).** La
  lista de la base combinada son **las mismas 41 funciones del §8.5, carácter
  por carácter**: la tanda no la cambia (`validar_tipo_cita_consultorio()`, la
  única función nueva, la ejecutan los tres roles; `reserva_contexto` y
  `cita_correo_tomar` ya estaban, sólo `service_role`). La lista para pegar al
  fusionar las dos ramas sigue siendo la del §8.5.
- `p1` (resto de casos), `p1b`, `p2`, `p3` y las **24** pruebas del proyecto
  (las 21 de antes, `g2_duracion_consulta`, `g2b_tipos_cita_update` y
  `g3_correo_confirmacion`), en verde.

### 9.6 Pruebas, antes y después del reinicio

| | Sobre la fusión (antes) | Desde cero (después) |
|---|---|---|
| `npm run build` | limpio | (no depende de la base) |
| `npm run lint` | 96 errores (sin subir) | igual |
| Vitest | 1860 pruebas en 127 archivos | 1860 en 127 |
| SQL (`pruebas-sql.sh`) | 24 archivos en verde | 24 en verde |
| Playwright completo | 358 pasan, 1 falla (`agenda-g3-tarjeta` «agendada», 1,46 px: era la prueba, §6-bis), 291 saltadas, 10.2 min | 355 pasan, 5 fallan, 292 saltadas, 11.0 min: las 5 dependen de que hoy es **domingo** y fallan igual en la base `dd634b9` (AG-DT-69) |
| e2e del Google falso y de seguridad | dentro de la batería, en verde | en verde |
| `reserva-carrera.sh` | verde | verde |
| `confirmacion-carrera.sh` | verde | verde |

### 9.7 Hallazgos de la integración y del revisor

El revisor (Sonnet, sin ver esto) llegó a los **mismos cuatro veredictos
(APTA)**, a la misma lista del caso 3 (sin cambios) y a «ningún objeto de
`main` cambia». Además señaló, y se recoge:

- **J1 · Las dos policies reemplazadas son de B6, no de `main`.** `main` no
  tiene `tipos_cita`. Cierto: la frase «la huella de main sin cambios salvo las
  dos policies autorizadas» se entiende como «sin cambios» a secas en `main`;
  las dos policies cambian respecto de las 25 (§9.4).
- **J2 · Volver a correr E4 después de G3 aborta** (su pre-vuelo encuentra el
  CHECK de `tipo` ya ensanchado). Es lo esperado y lo dice la guía §13.2 («nunca
  vuelvas a correr la 10 ni la 14 después de la 21 y la 24»).
- **J3 · El convenio «el tipo vale en ese consultorio» no lo impone la base**
  (`reservar_por_enlace` no mira `consultorio_id`). No es regresión: la RPC sólo
  la ejecuta `service_role` y las dos rutas filtran antes; lo dicen los COMMENT
  (dimensión 16).
- **J4 · Las cuatro llevan `lock_timeout = 5s`** y ninguna bloquea
  `appointments` ni `pacientes`.

Lo que vio el coordinador y el revisor no:

- **J5 · En una clínica en sólo lectura un médico puede crear o cambiar SUS
  tipos** (§9.3 A). Lo podía el administrador desde B6; `tipos_cita` no lleva
  puerta RESTRICTIVE a propósito y la reserva sigue cerrada por la puerta S3.
  Sin cambio.

**Dimensión propuesta para `AUDITORIA-MIGRACIONES.md`** (del auditor de
`20261119130000`; el archivo no se tocó, decide Angel): «pre-vuelos que
reimplementan la condición de un disparador sobre un universo más amplio que el
de las filas que la sentencia va a tocar» — un pre-vuelo que anticipa que «el
disparador X abortaría» se acota al `WHERE` de la sentencia, no a la tabla
entera.

## 10. Tanda H (2026-11-15)

Cinco ramas escritas en paralelo sobre la misma base local
(`feature/agenda-v2-h1` a `-h5`), fusionadas en `feature/agenda-v2` en el orden
H5, H2, H4, H3, H1 (`00ba7c3`, `4d023a7`, `e3c3519`, `182944f`, `1f39c4e`). H1,
H3 y H4 no traen migraciones; H2 trae dos y H5 una. En la integración se editó
`20261120121000` (el horario de partida de «Restablecer», §10.3 F). Aquí se
auditan juntas sobre la base reiniciada desde cero. Un revisor independiente en
otro modelo (Sonnet) hizo la misma auditoría en paralelo, sin ver estas
conclusiones; abajo se dice qué vio cada uno (§10.7).

### 10.1 El conjunto, desde cero

`git diff --name-only main...HEAD -- supabase/migrations` = **27 migraciones**
del proyecto (las 24 de antes + `20261120120000`, `20261120121000` y
`20261120130000`). `supabase db reset --local` (CLI 2.117.0) aplicó las **32**
(5 de `main` + 27) en orden y sin un error, en 27–29 s; `schema_migrations` = 32,
última `20261120130000`. Semilla en 2 s.

### 10.2 Veredicto de las tres

| # | Archivo | Qué hace | Auditoría previa (cabecera) | Integración | Veredicto |
|---|---|---|---|---|---|
| H2a | `20261120120000_agenda_h2_recordatorio_interruptor.sql` | `agenda_ajustes.recordatorio_encendido boolean NOT NULL DEFAULT false` y `cita_recordatorios_pendientes(integer)` (sólo `service_role`) | APTA | Cuerpo = `cita_correos_pendientes` de E4 + `AND j.recordatorio_encendido` (diff de `pg_get_functiondef`: el nombre y esa línea); la tarea llama a la nueva | APTA |
| H2b | `20261120121000_agenda_h2_restablecer_configuracion.sql` | `agenda_restablecer_configuracion(uuid,uuid)`, INVOKER, sólo `service_role` | APTA CON CAMBIOS (aplicados) | Editada en su sitio: el horario de partida (§10.3 F); md5 `6c99e553…`; rejilla 5 × OK en dos pasadas | APTA |
| H5 | `20261120130000_agenda_h5_atendida_con_nota.sql` | `trg_appointments_proteger_atendida` → `cita_proteger_atendida()` (INVOKER) y `cita_tiene_nota_ligada(uuid,uuid)` (DEFINER) | APTA CON CAMBIOS (sólo la cabecera) | Sin cambios | APTA |

### 10.3 Conflictos entre ellas y con las anteriores

**A · El disparador de H5 frente a los de seg2.** En `appointments` hay seis
disparadores; los tres `BEFORE` de protección corren en orden de nombre:
`trg_appointments_proteger_atendida` < `…_proteger_borrado` < `…_proteger_reserva`.
Ninguno cambia `NEW`, así que el orden sólo decide qué mensaje sale. Borrar una
atendida con nota con la v2 encendida lo rechazan los dos primeros (42501 los
dos; sale el de H5, «…no se borra», y la API ya veta antes con su 409); con la
v2 apagada sólo H5 (el de seg2 sólo actúa encendida: era el hueco de AG-DT-61).
El de columnas `reserva_*` vigila otras columnas: no se pisan. Los de auditoría
(`log_cita_change`) son `AFTER`: lo rechazado no deja fila.

**B · H5 frente a `gcal_aplicar_evento`.** C2 sólo reescribe hora, fin, todo el
día y estado cuando `status IN ('scheduled','confirmed')`; a una atendida le
escribe los MISMOS valores, y `cita_proteger_atendida()` compara con `IS
DISTINCT FROM`: pasa sin error (lo cubre también `c2_gcal_aplicar.sql`, en
verde). `cita_confirmacion_responder` devuelve «cerrada» a una atendida;
`cita_rsvp_google` sólo `scheduled → confirmed`; `reagendar_por_enlace` sólo
desde una cancelada: ninguna llega al disparador con una atendida.

**C · H5 frente a `agenda_restablecer_configuracion`.** La función no nombra
`appointments` (`prosrc ~* 'appointments'` = falso) y ningún disparador de
`consultorios`, `tipos_cita`, `reserva_enlaces` ni `agenda_ajustes` escribe en
citas (catálogo: auditoría, tope de 10, predeterminado, `updated_at`,
`validar_tipo_cita_*`, `proteger_*`). La prueba `h2_restablecer_configuracion`
compara la huella de las citas de las dos clínicas antes y después: idéntica.

**D · `cita_recordatorios_pendientes` frente a E4 y a la confirmación de G3.**
Misma consulta que E4 más el interruptor en la selección de clínicas: no se
pierde ni se duplica ningún correo respecto de E4 cuando está encendido; apagado
no lista nada. La exclusión por `cita_correos` (comprobante o recordatorio ya
enviado de esa hora) es la misma; la confirmación de G3 (`tipo =
'confirmacion'`, por `cita_correo_tomar`) no la mira y no depende del
interruptor: sigue sin quitar el recordatorio, como en G3. `cita_correo_tomar`
no cambió. La tarea (`src/lib/confirmacion/recordatorios.ts`) sólo llama a la
nueva; sin la migración recibe PGRST202 y no manda nada. `cita_correos_pendientes`
queda sin llamadores en `src/` (sólo la usa `e4_correos_cita.sql`; AG-DT-75).
Hueco aceptado: apagar el interruptor no frena lo ya listado en una pasada
(≤ 45 s; AG-DT-76).

**E · `cita_tiene_nota_ligada` como SECURITY DEFINER.** `LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = ''`, devuelve sólo `boolean`
(`coalesce(…, false)`): con sesión, sólo responde si `p_clinica =
get_clinica_id()` (otra clínica → `false`), y mira notas de pacientes de esa
clínica ligadas a esa cita. EXECUTE: `authenticated` y `service_role`; ni
`anon` ni PUBLIC (cierre justificado en su cabecera). Lo que deja saber a una
sesión de la clínica es lo mismo que el 409 `nota_ligada` (AG-DT-63, decidido por
Angel: se queda). Con `auth.uid()` nulo salta el filtro de clínica: sólo
`service_role` llega así, y ya lee `consultas` (AG-DT-91). El disparador es
INVOKER a propósito (necesita `current_user` para dejar fuera a
`postgres`/`supabase_admin`).

**F · El horario de partida de «Restablecer» (integración).** El `UPDATE` de
los consultorios es ahora `SET horario = cl.horario_consulta, horario_propio =
true FROM public.clinicas cl WHERE cl.id = c.clinica_id AND c.clinica_id =
p_clinica_id`: cada consultorio toma el horario de SU clínica (el JOIN no puede
copiar el de otra) y sólo los de la clínica pedida. Es la misma sentencia de
herencia de G4 (`20261119130000`) acotada a una clínica. Los disparadores de
`consultorios` no miran `horario` ni `horario_propio`. `service_role` lee
`clinicas`. Decisión de producto pendiente de Angel (`mejora_agendaV2.md`
§6-bis, «Integración de la tanda H»).

**G · EXECUTE a PUBLIC.** Ninguna función de la agenda lo tiene: las 69
funciones de `public` con PUBLIC en la base de 32 son exactamente las 69 de
`main` (las cierra P1 en `feature/limites-ajustables`). Las cuatro nuevas:
`cita_recordatorios_pendientes` y `agenda_restablecer_configuracion` sólo
`service_role`; `cita_tiene_nota_ligada`, `authenticated` y `service_role`;
`cita_proteger_atendida()`, los tres roles (es de disparador).

### 10.4 Catálogo: qué cambió de verdad

Huella md5 por objeto de `public` (la consulta del §3) de la base recién
reiniciada con las 32, contra `main` y contra la de las 29 (§9):

- **Contra `main` (355 huellas): 0 objetos cambiados o quitados.**
- **Contra las 29 (548 huellas): 0 objetos cambiados o quitados**, y 5 nuevos:
  las funciones `agenda_restablecer_configuracion(uuid,uuid)`,
  `cita_recordatorios_pendientes(integer)`, `cita_tiene_nota_ligada(uuid,uuid)` y
  `cita_proteger_atendida()`, y el disparador
  `appointments.trg_appointments_proteger_atendida` (553 en total). Ninguna
  policy nueva ni cambiada; ninguna tabla cambia de permisos ni de RLS. (La
  columna `agenda_ajustes.recordatorio_encendido` no entra en la huella.)

### 10.5 La base combinada con `feature/limites-ajustables`

Reinicio con las **35** migraciones (5 de `main`, las tres `20261014*` y las 27
del proyecto, en orden de nombre): todas aplican sin fallo. Los objetos de la
agenda (definiciones de funciones, policies, disparadores y constraints) quedan
**idénticos** a los de la rama; sólo cambian los `proacl` que P1 cierra y las
cuatro `sa_*` de P1b. Ninguna función de `public` queda con EXECUTE a PUBLIC.

- **`p1_permisos_funciones.sql`, caso 3: en rojo, como se esperaba.** La lista
  de la base combinada son **44 funciones**: las 41 del §8.5 más
  `agenda_restablecer_configuracion(uuid,uuid)`,
  `cita_recordatorios_pendientes(integer)` y `cita_tiene_nota_ligada(uuid,uuid)`
  (las tres sin EXECUTE para alguno de los tres roles; `cita_proteger_atendida()`
  sí lo tiene y no entra). Con esta lista pegada en el caso 3, `p1` pasa entero
  en la combinada. **Ésta es la lista para pegar al fusionar las dos ramas**
  (sustituye a la del §8.5):

  ```
  agenda_restablecer_configuracion(uuid,uuid), alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), cita_confirmacion_contexto(text), cita_confirmacion_emitir(uuid,uuid,uuid,text,uuid), cita_confirmacion_responder(uuid,text,text), cita_confirmacion_revocar(uuid,uuid), cita_correo_marcar(uuid,uuid,uuid,text,text), cita_correo_tomar(uuid,uuid,text,uuid), cita_correos_pendientes(integer), cita_reagendar_oferta(uuid,text), cita_recordatorios_pendientes(integer), cita_rsvp_google(uuid,uuid,text,text,text[]), cita_tiene_nota_ligada(uuid,uuid), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), gcal_aplicar_evento(uuid,uuid,timestamp with time zone,text,text,timestamp with time zone,text,boolean,timestamp with time zone,timestamp with time zone,boolean,text,boolean,text,boolean), gcal_citas_por_evento(uuid,text[],uuid[]), gcal_importar_evento(uuid,text,text,text,timestamp with time zone,text,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid), gcal_sync_avanzar(uuid,uuid,text,text,timestamp with time zone,integer), gcal_sync_clinica_habilitada(uuid), gcal_sync_clinicas_pendientes(integer), gcal_sync_frescura(uuid), gcal_sync_reiniciar(uuid,uuid), gcal_sync_soltar(uuid,uuid,text), gcal_sync_tomar(uuid,uuid,text,integer,integer), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), reagendar_por_enlace(text,uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), reserva_codigo_emitir(uuid,uuid,text,text), reserva_codigo_verificar(uuid,uuid,text,text,text), reserva_contacto_estado(uuid,uuid,text,text), reserva_contacto_marcar(uuid,text), reserva_contactos_bloqueados(), reserva_contexto(text,text,text), reserva_empalmes_registrar(uuid,uuid[]), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text), reserva_enlace_regenerar_fijo(uuid,uuid,text), reserva_ocupacion(uuid,uuid,timestamp with time zone,timestamp with time zone), reservar_por_enlace(uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()
  ```
- `p1` (resto de casos), `p1b`, `p2`, `p3` y las **27** pruebas del proyecto (las
  24 de antes, `h2_recordatorio_interruptor`, `h2_restablecer_configuracion` y
  `h5_atendida_con_nota`), en verde.

### 10.6 Pruebas, antes y después del reinicio

El reinicio desde cero se hizo ANTES de la verificación completa, así que la
batería entera corrió una sola vez, sobre la base de 32 recién sembrada.

| | Desde cero (las 32, semilla recién aplicada) |
|---|---|
| `npm run build` | limpio |
| `npm run lint` | 96 errores (sin subir) |
| Vitest | 1913 pruebas en 131 archivos |
| SQL (`pruebas-sql.sh`) | 27 archivos en verde |
| Playwright completo (escritorio, teléfono, tableta, con el Google falso) | 394 pasan, 3 fallan, 323 saltadas, 8 sin correr (las series tras su fallo), 11.8 min. Las 3 eran la prueba, no el código (§10.7 K7); arregladas, sus 4 archivos repetidos: 26 pasan, 0 fallan |
| e2e del Google falso y de seguridad | dentro de la batería; `agenda-google-dos-sentidos` en verde en la repetición |
| `reserva-carrera.sh` | verde (3 citas, las esperadas) |
| `confirmacion-carrera.sh` | verde |

### 10.7 Hallazgos de la integración y del revisor

El revisor (Sonnet, sin ver esto) llegó a los **mismos tres veredictos
(APTA)**, a la misma lista del caso 3 (41 → 44, tres altas y ninguna baja), a
«ningún objeto de `main` cambia» y a «ninguna función de la tanda con PUBLIC».
Coincidimos en A (orden de los disparadores), B (`gcal_aplicar_evento` reescribe
lo mismo), C (la función de restablecer no nombra citas), D (diff de una línea
y el cron con la nueva) y E (sólo booleano y la clínica de la sesión). Además
señaló, y se recoge:

- **K1 · «Restablecer» aplica una decisión marcada pendiente de Angel.** Cierto
  y a propósito: se toma la opción coherente con su regla de la tanda G y se
  deja escrita la vuelta atrás (una sentencia). Si Angel confirma, se quitan las
  marcas «pendiente» de la cabecera y de §6-bis.
- **K2 · `cita_correos_pendientes` sigue viva sin llamadores.** AG-DT-75.
- **K3 · Las tres dependen de migraciones que tampoco están en producción.** Se
  aplican las 27 del proyecto en orden de nombre (guía §13.2), no sólo éstas.
- **K4 · `auth.uid()` nulo en `cita_tiene_nota_ligada`.** AG-DT-91; sin cambio.

Lo que vio el coordinador y el revisor no:

- **K5 · `20261120120000` apaga el recordatorio en TODAS las clínicas** desde que
  se aplique, también en las que ya tuvieran la v2 encendida (sin backfill: es
  lo que pidió Angel). Lo dicen §7 y la guía §13.2 (fila 25).
- **K7 · Tres e2e que fallaban por las fusiones, y las tres eran la prueba.**
  `husos-dos-consultorios` (y, sin fallar, `confirmacion-enlace` «lista A 4»)
  disparaban la tarea de recordatorios sin encender el interruptor que H2 dejó
  apagado de fábrica: ahora lo encienden y lo apagan al terminar (la de
  confirmación pasaba sin probar nada). `recordatorios` elegía un paciente con
  una cita de la semilla dentro de la ventana y leía el recordatorio de ésa
  (dependía de la hora): ahora elige uno sin citas en 31 h.
  `agenda-google-dos-sentidos` (H3) pulsaba una franja donde `agenda-cancelar`
  deja sus canceladas: ahora 13:00. Ninguna toca SQL.
- **K6 · El revisor del paso 3 de la integración** (Sonnet, aparte) confirmó en
  vivo el md5, los permisos, que el JOIN no cruza clínicas y que los disparadores
  de `consultorios` no interfieren: APTA CON CAMBIOS, sólo documentales.

## 11. Tanda I (2026-11-17)

Cinco ramas escritas en paralelo sobre la base local (`feature/agenda-v2-i1` a
`-i5`), fusionadas con `--no-ff` en `feature/agenda-v2` en el orden I1, I2, I3,
I4, I5. I1 no trae migraciones; I2 trae dos, I3 una, I4 tres e I5 una. En la
integración se editó `20261121150000` (el WHEN del aviso de Google, §11.3 C).
Aquí se auditan juntas sobre la base reiniciada desde cero.

### 11.1 El conjunto, desde cero

`ls supabase/migrations/*.sql` = **39**: las 5 de `main`, las 27 del proyecto
hasta la tanda H y las 7 nuevas. (`git diff --name-only main...HEAD --
supabase/migrations` da 34: las 5 de `main` no salen en el diff. El encargo
decía «33 + 8 = 41»; el número que hay en el disco es 39.)
`supabase db reset --local` (CLI 2.117.0) aplicó las 39 en orden y sin un error,
en 27–28 s; `schema_migrations` = 39, última `20261121150000`. Semilla en 1.4 s.
Segunda pasada de las 7 nuevas sobre esa base: todas sin error y **huella
idéntica** (idempotentes). Los pre-vuelos que exigen md5 de un cuerpo anterior
(`cita_proteger_atendida` de `20261120130000`, `agenda_restablecer_configuracion`
de `20261120121000`, las funciones de seg1 y D3 de `reservar_por_enlace`)
pasaron en el reinicio, así que esos md5 son los de los archivos del repo.

### 11.2 Veredicto de las siete

| # | Archivo | Qué hace | Auditoría previa (cabecera) | Integración | Veredicto |
|---|---|---|---|---|---|
| I2a | `20261121120000_agenda_i2_unico_sin_correo.sql` | `reservar_por_enlace` acepta `p_correo` NULL con un enlace ÚNICO (el fijo sigue exigiéndolo); sin correo guarda un seudónimo `sha256('reserva-sin-correo:'‖id)` en `reserva_correo_hmac` para cumplir el CHECK de seg1 | APTA | Sin cambios | APTA |
| I2b | `20261121121000_agenda_i2_candado_eleccion.sql` | `trg_appointments_proteger_eleccion` → `cita_proteger_eleccion()` (INVOKER): en una cita por enlace futura con la v2 encendida el médico no cambia y consultorio/día/hora sólo los cambia `cita_reagendar_clinica` (sólo `service_role`, con el GUC `spinus.reagendar_cita`) | APTA CON OBSERVACIONES | Sin cambios | APTA |
| I3 | `20261121130000_agenda_i3_por_asignar_google.sql` | `appointments.google_asignacion` (`por_asignar`/`evento`, NULL) con su CHECK; `trg_appointments_asignacion_google` → `cita_asignacion_google()` marca `por_asignar` sólo lo que importa el sondeo (`service_role` + `spinus.via=google`) y deja a la sesión sólo `por_asignar → evento` | APTA CON OBSERVACIONES | Sin cambios | APTA |
| I4a | `20261121140000_agenda_i4_atendida_no_se_mueve.sql` | `cita_proteger_atendida()` (de H5) también veta mover una atendida con nota con la v2 APAGADA | APTA | Sin cambios | APTA |
| I4b | `20261121141000_agenda_i4_horario_revisado.sql` | `consultorios.horario_revisado_en timestamptz` NULL y `agenda_restablecer_configuracion` la vuelve a NULL. Todos los consultorios existentes nacen «por revisar» (a propósito, cabecera) | APTA CON CAMBIOS (menores, aplicados) | Sin cambios | APTA |
| I4c | `20261121142000_agenda_i4_cancelada_cerrada.sql` | `appointments.cerrada_en` y `sustituida_por` (FK a `appointments`, RESTRICT), CHECK de coherencia, `trg_appointments_proteger_cierre` → `cita_proteger_cierre()`: sólo `service_role` cierra, sólo una cancelada, con una sustituta viva de la misma clínica; nadie reabre | APTA CON CAMBIOS (menores, aplicados) | Sin cambios | APTA |
| I5 | `20261121150000_agenda_i5_avisos_clinica.sql` | tabla `avisos_clinica` (RLS), `agenda_ajustes.correo_reserva_clinica`, cinco funciones `aviso_clinica_*` y sus disparadores en `appointments`, `cita_confirmaciones`, `cita_reagendos` y `reserva_empalmes_google`; arrastre de lo ya pendiente | APTA CON OBSERVACIONES | **Editada en su sitio:** WHEN del disparador de citas y pre-vuelo (§11.3 C) | APTA |

### 11.3 Conflictos entre ellas y con las anteriores

**A · Los BEFORE de `appointments`.** Son ahora seis (catálogo de la base reiniciada; en los archivos no hay otro
BEFORE sobre `appointments`) y corren en orden de nombre: `trg_appointments_asignacion_google` < `…_proteger_atendida` <
`…_proteger_borrado` < `…_proteger_cierre` < `…_proteger_eleccion` <
`…_proteger_reserva`. Todos INVOKER con `search_path=''`. Sólo
`asignacion_google` cambia `NEW` (la columna `google_asignacion`, que ningún otro
mira); los demás sólo aceptan o rechazan, así que el orden decide qué mensaje
sale, no qué se escribe. No se solapan:
- `proteger_eleccion` sólo actúa con `OLD.reserva_canal IS NOT NULL`; una cita
  de Google por asignar tiene `reserva_canal` NULL.
- `proteger_atendida` sólo con `OLD.status = 'attended'` y cambios de estado u
  horas; ni «¿No es una cita?» (sólo `google_asignacion`) ni el cierre de I4
  (sólo `cerrada_en`/`sustituida_por`) tocan esas columnas.
- `proteger_cierre` exige `service_role`, una cancelada y una sustituta viva de
  la misma clínica: no coincide con una atendida ni con una elegida viva.
- En INSERT, `asignacion_google` pone NULL a todo salvo al sondeo: una sesión no
  puede sembrar `por_asignar` ni `evento`.
Los AFTER (`audit_appointments*`, `trg_appointments_reserva_incidencia`,
`trg_appointments_aviso_clinica`) no escriben en `appointments`:
`aviso_clinica_de_cita()` es DEFINER y sólo inserta en `avisos_clinica`; no hay
recursión. Las pruebas `d4_gcal_por_ligar` y `h5_atendida_con_nota`, que I2 e I4
adaptaron en sus ramas, pasan sobre el conjunto.

**B · Google: I2 frente a I3.** I2 mapea el 42501 «reservada por enlace» de
`gcal_aplicar_evento` a `CambioRechazadoPorLaBase` (auditado
`gcal_cambio_rechazado`, motivo `eleccion_paciente`) y Spinus reescribe Google.
I3 no tocó `gcalSincronizacion*.ts`: su marca vive entera en el BEFORE INSERT.
`gcal_importar_evento` (INVOKER, llamada por `service_role`) pone
`spinus.via=google` antes de su INSERT, que es lo que `cita_asignacion_google()`
reconoce. Sin choque de código ni de base.

**C · El aviso de Google de I5 con la marca de I3 (editado en la integración).**
I5 se escribió sin I3 y su WHEN copiaba el criterio «sin paciente, sin canal,
`origen = 'google'`», sin el «quién». Con I3 delante, un INSERT de `postgres`
(semilla, SQL Editor) o de la sesión con `origen = 'google'` dejaba un aviso
«por asignar» de una cita que la agenda no marcaba así (y en la que no hay botón
«¿No es una cita?»). El WHEN es ahora `NEW.reserva_enlace_id IS NOT NULL OR
NEW.google_asignacion = 'por_asignar'`: un AFTER ROW evalúa su WHEN con la fila
final, después de los BEFORE, así que ve la marca que puso
`cita_asignacion_google()`. El pre-vuelo exige ahora 6 columnas (con
`google_asignacion`), así que **I5 aborta limpio sin I3** (y va después por
nombre: 130000 < 150000). Los cuerpos de las cinco `aviso_clinica_*` no cambian:
el md5 de su pre-vuelo sigue valiendo. La prueba `i5_avisos_clinica` (caso 2)
inserta ahora las filas de Google como `service_role` con `spinus.via=google`,
comprueba la marca fila a fila y añade `0a16` (Google insertado por `postgres`:
sin aviso); con el WHEN viejo da rojo (`google_por_asignar>0a11,
google_por_asignar>0a16`). Nada de esto está aplicado en producción: editar en
sitio no deja dos versiones del mismo archivo.

**D · `reservar_por_enlace` (I2) frente a seg1, D3 y el CHECK de D1.** El CHECK
`appointments_reserva_check` de `20261114120000` exige `reserva_correo_hmac` NOT NULL en las citas de
reserva; I2 lo cumple sin correo con un seudónimo que no coincide con nadie (no
cuenta para el tope por correo ni para el bloqueo por correo; el bloqueo MANUAL
por teléfono sigue cortando). El fijo sigue exigiendo correo (`i2_unico_sin_correo`
caso 4). El correo a la clínica de I5 (`avisarReservaAClinica`) sale también
sin correo del paciente: se arregló en la fusión de la ruta, que hacía `return`
antes de avisar (e2e «20 · el único sin correo también avisa a la clínica»).

**E · `agenda_restablecer_configuracion` (H2 → I4b).** I4b sólo añade
`horario_revisado_en = NULL` al UPDATE de consultorios ya acotado a la clínica
(§10.3 F). La huella muestra que es uno de los tres objetos previos cambiados
(§11.4), y el único cambio es ése.

**F · Un solo canal de tiempo real** (`appointments-realtime`), que I1 hace
sobrevivir 2 min fuera de la agenda; I4 le añade «si viene cerrada, se quita» e
I5 lo reutiliza para recargar la campana con `cambioPuedeAvisar` (que ahora
mira `google_asignacion = 'por_asignar'`, la misma marca que el WHEN). No es de
base, se anota aquí porque decide qué avisos ve el personal sin recargar.

### 11.4 Catálogo: qué cambió de verdad

Huella md5 por objeto de `public` (definición y `proacl` de cada función, cada
policy, cada disparador con su estado, `relacl`/RLS de cada tabla y cada
constraint) de la base recién reiniciada con las 39, contra `main` (5) y contra
la de H (32), reiniciadas igual desde `git archive` de cada una:

- **Contra `main` (336 huellas): 0 objetos cambiados o quitados**, 226 nuevos.
- **Contra H (534 huellas): 0 quitados, 3 cambiados** — `reservar_por_enlace`
  (I2a), `cita_proteger_atendida()` (I4a) y `agenda_restablecer_configuracion`
  (I4b), los tres a propósito y con su `CREATE OR REPLACE` (mismo `proacl`) — y
  **28 nuevos**: 9 funciones (`aviso_clinica_de_cita/_de_empalme/_de_reagendo/
  _de_respuesta/_revisar`, `cita_asignacion_google`, `cita_proteger_cierre`,
  `cita_proteger_eleccion`, `cita_reagendar_clinica`), 9 disparadores (cuatro en
  `appointments`, dos en `avisos_clinica`, uno en `cita_confirmaciones`,
  `cita_reagendos` y `reserva_empalmes_google`), 7 constraints
  (`appointments_cierre_check`, `appointments_google_asignacion_check`,
  `appointments_sustituida_por_fkey`, y las cuatro de `avisos_clinica`), 2
  policies y la tabla `avisos_clinica` (562 en total). Ninguna policy previa
  cambia; ninguna tabla previa cambia de permisos ni de RLS. (Las columnas
  nuevas no entran en la huella.)

### 11.5 Permisos de funciones

Ninguna función de la tanda tiene EXECUTE a PUBLIC; todas `search_path=''`.

| Función | DEFINER | anon | authenticated | service_role |
|---|---|---|---|---|
| `cita_reagendar_clinica(uuid,uuid,uuid,uuid,timestamptz,timestamptz,timestamptz)` | no | — | — | sí |
| `reservar_por_enlace(…)` (cambiada) | no | — | — | sí |
| `agenda_restablecer_configuracion(uuid,uuid)` (cambiada) | no | — | — | sí |
| `cita_asignacion_google()`, `cita_proteger_cierre()`, `cita_proteger_eleccion()`, `cita_proteger_atendida()` (de disparador) | no | sí | sí | sí |
| `aviso_clinica_de_cita()`, `_de_empalme()`, `_de_reagendo()`, `_de_respuesta()` (de disparador) | **sí** | sí | sí | sí |
| `aviso_clinica_revisar()` (de disparador) | no | sí | sí | sí |

Las cuatro DEFINER son de disparador (no se llaman por PostgREST: devuelven
`trigger`), su dueño es `postgres` y sólo escriben en `avisos_clinica` (insertan;
`aviso_clinica_de_reagendo` además reetiqueta con un UPDATE el aviso
`reserva_enlace` pendiente de la cita a `reagendado_paciente`), con `clinica_id`
y `cita_id` tomados de la fila que las dispara. Son DEFINER para
no depender de quién escribe (la sesión no tiene INSERT en `avisos_clinica`, y
las RPC de `service_role` de siempre tampoco). Ninguna necesita
`supabase_auth_admin` ni `supabase_storage_admin`: no las alcanza Auth ni
Storage.

**`p1_permisos_funciones.sql`, caso 3, en la base combinada.** Reinicio con las
**42** (5 de `main`, las tres `20261014*` de `feature/limites-ajustables` y las
34 del proyecto): todas aplican sin fallo y **ninguna función de `public` queda
con EXECUTE a PUBLIC**. El caso 3 da rojo, como se esperaba: la lista son ahora
**45 funciones**, las 44 del §10.5 más
`cita_reagendar_clinica(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone)`;
ninguna baja. (`cita_proteger_cierre()` y las demás de disparador tienen los
tres roles y no entran.) Con esta lista pegada, `p1` pasa entero en la
combinada. **Ésta es la lista para pegar al fusionar las dos ramas** (sustituye
a la del §10.5):

  ```
  agenda_restablecer_configuracion(uuid,uuid), alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), cita_confirmacion_contexto(text), cita_confirmacion_emitir(uuid,uuid,uuid,text,uuid), cita_confirmacion_responder(uuid,text,text), cita_confirmacion_revocar(uuid,uuid), cita_correo_marcar(uuid,uuid,uuid,text,text), cita_correo_tomar(uuid,uuid,text,uuid), cita_correos_pendientes(integer), cita_reagendar_clinica(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone), cita_reagendar_oferta(uuid,text), cita_recordatorios_pendientes(integer), cita_rsvp_google(uuid,uuid,text,text,text[]), cita_tiene_nota_ligada(uuid,uuid), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), gcal_aplicar_evento(uuid,uuid,timestamp with time zone,text,text,timestamp with time zone,text,boolean,timestamp with time zone,timestamp with time zone,boolean,text,boolean,text,boolean), gcal_citas_por_evento(uuid,text[],uuid[]), gcal_importar_evento(uuid,text,text,text,timestamp with time zone,text,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid), gcal_sync_avanzar(uuid,uuid,text,text,timestamp with time zone,integer), gcal_sync_clinica_habilitada(uuid), gcal_sync_clinicas_pendientes(integer), gcal_sync_frescura(uuid), gcal_sync_reiniciar(uuid,uuid), gcal_sync_soltar(uuid,uuid,text), gcal_sync_tomar(uuid,uuid,text,integer,integer), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), reagendar_por_enlace(text,uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), reserva_codigo_emitir(uuid,uuid,text,text), reserva_codigo_verificar(uuid,uuid,text,text,text), reserva_contacto_estado(uuid,uuid,text,text), reserva_contacto_marcar(uuid,text), reserva_contactos_bloqueados(), reserva_contexto(text,text,text), reserva_empalmes_registrar(uuid,uuid[]), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text), reserva_enlace_regenerar_fijo(uuid,uuid,text), reserva_ocupacion(uuid,uuid,timestamp with time zone,timestamp with time zone), reservar_por_enlace(uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()
  ```

En la combinada, además, `i2_unico_sin_correo.sql` daba `permission denied for
function unico`: con P1 las funciones que crea `postgres` nacen sin EXECUTE a
PUBLIC, también las de `pg_temp`, y la prueba llama a `pg_temp.unico` como
`service_role`. Se añadió al GRANT de la prueba (`e409396`); el resto de las 38
pruebas (`p1` con la lista nueva, `p1b`, `p2`, `p3` y las 34 del proyecto), en
verde en la combinada. Contra la combinada (huella de 569): los objetos del
proyecto, idénticos en definición; sólo cambian los `proacl` que P1 cierra
(41 funciones de `main`), y se añaden los 7 objetos de limites.

### 11.6 Contrato con spinus-consola y RLS de `avisos_clinica`

**Consola.** Ninguna de las siete nombra `ajuste_*`, `limite_efectivo` ni
`clinica_tiene_acceso()`, ni hace `ALTER`/`UPDATE` sobre `clinicas` (grep sobre
los siete archivos: 0). Las columnas nuevas son de `appointments`,
`consultorios` y `agenda_ajustes`; ninguna se renombra ni cambia de tipo. Sin
CASCADE: la única FK nueva entre tablas existentes es
`appointments.sustituida_por → appointments(id)` RESTRICT, y la de
`avisos_clinica.clinica_id → clinicas` es RESTRICT.

**`avisos_clinica`.** RLS activada. Privilegios: `authenticated` sólo SELECT y
UPDATE de columna (`revisado_en`, `revisado_por`); `anon` y `service_role`
nada (el servidor lee con la sesión). Sin policies de INSERT ni DELETE: sólo la
escriben los disparadores DEFINER de dueño `postgres`. Policies (PERMISSIVE,
`authenticated`):
- `avisos_clinica_select`: `clinica_id = get_clinica_id()` **y** existe la cita
  en `appointments` de esa clínica. El EXISTS corre con la RLS de
  `appointments` de quien lee, así que cada uno ve los avisos de las citas que ya
  ve (el médico las suyas; el administrador y la secretaria, las de la clínica).
- `avisos_clinica_update`: lo mismo y `revisado_en IS NULL` en USING; en WITH
  CHECK, `revisado_por = auth.uid()`. Un aviso revisado no se reabre ni
  cambia de autor: `aviso_clinica_revisar()` (BEFORE UPDATE) conserva
  `revisado_en`/`revisado_por` si ya estaban y, al revisar, sella `revisado_en`
  con `now()` (no con la hora que mande el cliente).
Sin FK a `appointments` a propósito (como `reserva_empalmes_google`): una cita
borrada deja su aviso, que deja de verse porque el EXISTS falla. CHECK de tipo
con los cinco tipos y CHECK `revisado_por IS NULL OR revisado_en IS NOT NULL`.

### 11.7 Orden de despliegue y tolerancia

Cada cabecera trae su orden respecto al código; juntas:

| Migración | Orden | Sin la migración y con el código nuevo |
|---|---|---|
| I2a | migración primero | el código viejo siempre manda correo; con el nuevo y sin ella, un único sin correo lo rechaza el cuerpo de seg1 (22023 → 400 `solicitud_invalida`; por lectura de `respuestasReserva.ts` y del cuerpo, no ejecutado): la página del único, que ya no pide correo, falla al reservar sin él. Por eso va primero |
| I2b | migración primero | «Reagendar» responde 503 (RPC ausente); la API ya vetaba por su cuenta (409). Con ella y el código VIEJO, editar o arrastrar una cita por enlace futura da 500 de la base (no escribe nada) |
| I3 | migración antes | el código sólo nombra la columna con la v2 y trata 42703/PGRST204 como «no disponible» (`no-es-cita` → 503) |
| I4a | cualquiera | sin ella, con la v2 apagada, PostgREST directo aún movería una atendida (la API no) |
| I4b | migración primero si la v2 está encendida | **arreglado en la integración:** daba 500 al guardar un horario; ahora el PATCH reintenta sin la columna |
| I4c | migración primero si la v2 está encendida | **arreglado en la integración:** el alta con `sustituye_a` daba 500; ahora entra sin cerrar la cancelada |
| I5 | cualquiera | la campana enseña lo de antes (`avisos_disponibles: false`), el interruptor del correo «no disponible» (503) |

**Prueba de tolerancia** (base local reiniciada SÓLO con las 32 de H,
`db reset --local --workdir` desde un `git archive 0349221`; el `next start`
:3001 con el build de la rama; v2 encendida en A):
- 13 e2e de antes que tocan los caminos que la tanda cambió (`agenda-cancelar`,
  `-avisos`, `-citas`, `-por-ligar`, `-tiempo-real`, `reserva-enlace`,
  `agenda-f-tarjeta`, `-interruptor`, `-horario-validacion`, `-secretaria`,
  `-panel-dia`, `-cache-rangos`, `-ligar-consulta`), escritorio: **71 pasan, 2
  saltadas, 0 fallan**.
- Sondas con la sesión de admin.a: `/agenda` 200; `GET /api/avisos` 200
  `{"avisos":[],"avisos_disponibles":false}`; `/api/agenda/por-confirmar` 200;
  `PATCH /api/me/ajustes-agenda {correo_reserva_clinica}` 503 `no_disponible`;
  `POST …/reagendar` de una cita sin enlace 409 `no_aplica`; `POST …/no-es-cita`
  503 `no_disponible`. Con la v2 APAGADA, las rutas nuevas dan 404
  `no_disponible`.
- **Dos 500, arreglados** (`e409396`, revisor Sonnet APTO):
  `PATCH /api/consultorios/[id]` («Could not find the 'horario_revisado_en'
  column») y `POST /api/appointments` con `sustituye_a` («cita a sustituir sin
  leer: 42703»). Tras el arreglo: 200 y 409 `empalme` (el flujo normal). El
  primero se probó en rojo con el build anterior y en verde con el nuevo sobre la
  misma base; el segundo, además, con una Vitest en rojo por mutación.

Orden de despliegue recomendado (sin cambios respecto de la guía §13.2): las 34
del proyecto en orden de nombre, ANTES del código; la v2 se enciende después.

### 11.8 Hallazgos

- **L1 · El WHEN de I5 (§11.3 C).** Corregido en la integración.
- **L2 · Dos rutas sin tolerancia a columna ausente (§11.7).** Corregidas.
- **L3 · El número de migraciones del encargo (41) no es el del disco (39).**
- **L4 · Pre-vuelos que comparan texto deparseado y no md5** (del revisor de la
  tabla del punto 24): las policies de `tipos_cita` en
  `20261119120000`/`20261119121000`, `appointments_update` en `20261121121000`,
  los WHEN de los disparadores de B0 en `20261113130000`/`20261115120000` y la
  forma de `clinica_tiene_acceso()`/`clinica_no_suspendida()` en
  `20261113120000`. Pueden abortar en producción por una diferencia de versión de Postgres o
  de `search_path`, no sólo por un cambio real. Aborto limpio (transacción
  revertida), no daño. Se recoge en la tabla de `mejora_agendaV2.md` §7.
- **L5 · `20260919230000_auth_02_reasentar_grants_rate_limit.sql` dice en su
  cabecera «PRODUCCIÓN: PENDIENTE DE APLICAR»**, mientras §7 cuenta las 5 de
  `main` como aplicadas. No se comprobó en producción (prohibido en esta tanda):
  a mirar en `schema_migrations` antes del ensayo.
- **L6 · El candado de lo elegido sólo protege lo que no ha empezado** (revisor
  del §11): `cita_proteger_eleccion` deja libre una cita por enlace con
  `OLD.start_time <= now()`, así que una que ya empezó se puede mover a una hora
  futura sin «Reagendar» ni correo. Es el diseño de I2 (las pasadas se corrigen
  desde el formulario; `cita_reagendar_clinica` responde `pasada`), no un hueco
  nuevo; se anota para que nadie lo lea como garantía de «nunca se mueve».
- **L7 · Una cancelada cerrada no se reactiva por ningún camino** (CHECK
  `appointments_cierre_check` + `cita_proteger_cierre`): un PUT que intentara
  cambiarle el estado acabaría en un error de la base. Hoy no hay pantalla que
  la enseñe (deuda de I4), así que nadie llega a ella por la interfaz.
- **L8 · FK nuevas RESTRICT que frenan limpiezas como `postgres`:**
  `avisos_clinica.clinica_id → clinicas` (borrar una clínica de prueba con
  avisos) y `appointments.sustituida_por → appointments` (borrar una sustituta
  antes que su cerrada). SUPONGO, sin comprobar, que borrar las dos en la misma
  sentencia puede fallar según el orden de filas. Sólo afecta a la semilla y a
  las e2e que limpian; la API traduce el 23503 a 409.
- **L9 · Cosmético en las rejillas de I3, I4a e I4c:** el renglón de PUBLIC usa
  `aclexplode(p.proacl)` sin `coalesce(…, acldefault(…))`. Con `proacl` NULL
  diría «sin PUBLIC» aunque lo tuviera; no pasa porque el REVOKE acaba de
  ejecutarse y deja `proacl` no nulo.
- **Revisor del §11** (Sonnet, sin ver estas conclusiones): APTA CON CAMBIOS,
  sólo de texto. Pidió corregir tres celdas de «Auditoría previa» de §11.2, la
  frase «sólo insertan» de §11.5 y la atribución D1/D2 de §11.3 D: corregidas.
  Confirmó la lista de 45 contando desde los GRANT de los archivos y que la única
  alta frente a las 44 es `cita_reagendar_clinica`. Sus R1–R6 son L6–L9 y la
  fila de I4b (todos «por revisar»).

## 12. Tanda J (2026-11-18)

Cinco ramas escritas en paralelo sobre la base local (`feature/agenda-v2-j1` a
`-j5`, todas desde `ccb9087`), fusionadas con `--no-ff` en `feature/agenda-v2`
en el orden J1, J2, J3, J4, J5. J1, J3 y J5 no traen migraciones; J2 trae dos y
J4 una. Ninguna migración se editó en la integración; sí una ruta, para tolerar
la base sin la de J2 (§12.7). Aquí se auditan juntas sobre la base reiniciada
desde cero.

### 12.1 El conjunto, desde cero

`ls supabase/migrations/*.sql` = **42**: las 5 de `main` y 37 del proyecto (las
34 hasta la tanda I y las 3 nuevas). Antes de reiniciar se contaron las filas
clínicas que no fueran de la semilla: **0** `consultas`, **0** `documentos`, **0**
`addendums`; no hubo nada que respaldar. `supabase db reset --local` (CLI
2.117.0) aplicó las 42 en orden y sin un error (el único aviso es «no files
matched pattern: supabase/seed.sql», el de siempre), en 26–27 s;
`schema_migrations` = 42, última `20261122140000`. Semilla en 1.3 s.

**Segunda pasada** de las 3 nuevas sobre esa base: `20261122120100` y
`20261122140000` sin error y **huella idéntica**. `20261122120000` **aborta en su
pre-vuelo** («reservar_por_enlace no es el cuerpo de i2 ni el de j2», md5
`1a448df0…`): su pre-vuelo acepta el cuerpo de I2 o el suyo propio, y en la base
completa el cuerpo ya es el de `…120100`. Aborto limpio (transacción revertida,
huella idéntica), así que no daña nada, pero j2-a **no es reejecutable** después
de j2-b (§12.8 M1).

### 12.2 Veredicto de las tres

| # | Archivo | Qué hace | Auditoría previa (cabecera) | Integración | Veredicto |
|---|---|---|---|---|---|
| J2a | `20261122120000_agenda_j2_unico_tope_correo.sql` | `reserva_enlaces`: `correo`, `correo_hmac`, `intentos` (NOT NULL DEFAULT 0) y `agotado_en`, con `reserva_enlaces_correo_check` (correo y HMAC juntos, sólo en el único) y `reserva_enlaces_intentos_check`; `trg_reserva_enlaces_unico` → `proteger_reserva_enlace_unico()`; `reserva_enlace_emitir` de 9 argumentos (nueva; la de 7 se vuelve a pegar idéntica); `reservar_por_enlace` usa el correo de la clínica en el único, cuenta intentos (tope 5, «bloqueado» lo agota) y `reserva_contexto` da el único agotado por no disponible | Rejilla de veredicto en la propia migración (§8) | Sin cambios | APTA |
| J2b | `20261122120100_agenda_j2_unico_carrera_client_id.sql` | `reservar_por_enlace` con el INSERT de la cita en su propio `BEGIN … EXCEPTION WHEN unique_violation`: si la restricción es `idx_appointments_client_id`, `client_id_en_uso` sin deshacer el conteo; si es otra, `RAISE` | Rejilla de veredicto (§4), todo «OK» | Sin cambios | APTA |
| J4 | `20261122140000_agenda_j4_aviso_google_reserva.sql` | tabla `gcal_movimientos_rechazados` (RLS, sin policies), `cita_movimiento_google_registrar` (sólo `service_role`), `trg_gcal_movimientos_aviso_clinica` → `aviso_clinica_de_movimiento_google()` (DEFINER) y el tipo `google_movimiento_rechazado` en `avisos_clinica_tipo_check` | Ensayada con ROLLBACK; corregida la fila 10 de su rejilla | Sin cambios | APTA |

### 12.3 Interacción con los disparadores de `reserva_enlaces` y `appointments`

**A · Los BEFORE de `reserva_enlaces`.** Son dos y corren por nombre:
`trg_reserva_enlaces_proteger` (`proteger_reserva_enlaces()`, seg 7a, **md5
`acd4128b` sin tocar**) < `trg_reserva_enlaces_unico`
(`proteger_reserva_enlace_unico()`, nueva). Los dos INVOKER, `search_path=''`, y
los dos dejan pasar a `postgres`/`supabase_admin`. No se pisan: el primero vigila
la tupla de identidad (id, clínica, médico, clase, hash, etiqueta, vigencia,
caducidad, autor, alta), la revocación y el «usado»; el segundo, sólo las cuatro
columnas nuevas (correo inmutable; `intentos`/`agotado_en` sólo los mueve
`service_role`, sólo hacia arriba y sin desagotar). En INSERT, el primero exige
`service_role` y el segundo pone `intentos = 0` y `agotado_en = NULL`, lo mande
quien lo mande. El correo no entra en la tupla del primero a propósito: lo
guarda el segundo. El AFTER `audit_reserva_enlaces` (`log_tabla_change`) sólo
apunta id, tabla y operación: **el correo del paciente no llega a `audit_log`**.
Cada intento contado es un UPDATE, así que deja una fila de auditoría (como mucho
5 por enlace, más la del uso).

**B · `appointments`.** Ninguna de las tres crea, cambia ni quita disparadores
de `appointments`; los seis BEFORE y los AFTER del §11.3 A siguen igual (huella).
`reservar_por_enlace` sigue insertando la cita como `service_role` y la fila
pasa por los mismos seis BEFORE y por `trg_appointments_aviso_clinica` (el aviso
`reserva_enlace`). Con J2b, el INSERT corre dentro de una subtransacción: si un
BEFORE o un AFTER lanza otra excepción, `RAISE` la sube igual que antes; si choca
`idx_appointments_client_id`, se deshace el INSERT **con** el aviso que su AFTER
hubiera dejado, y el conteo del único (hecho antes, fuera del bloque) queda. La
`unique_violation` se distingue por `CONSTRAINT_NAME`, así que la del índice
parcial de `avisos_clinica` (que, además, su disparador evita con `ON CONFLICT`)
no se confunde con la del `client_id`.

**C · J4 frente a I2 e I5.** `cita_movimiento_google_registrar` repite el
criterio de `cita_proteger_eleccion` (de esa clínica, por enlace y sin empezar),
y sólo con la v2 encendida; inserta en `gcal_movimientos_rechazados` con `ON
CONFLICT ON CONSTRAINT gcal_movimientos_rechazados_intento_key DO NOTHING`
(única sobre `(cita_id, google_updated)`), así que el
mismo movimiento rechazado en dos pasadas avisa una vez. El AFTER INSERT de esa
tabla (DEFINER) inserta el aviso en `avisos_clinica` con `ON CONFLICT (tipo,
cita_id) WHERE revisado_en IS NULL DO UPDATE SET creado_en = now()`: un aviso
pendiente se reaviva en vez de duplicarse; uno ya revisado no se reabre (nace
otro). Ese `DO UPDATE` pasa por `aviso_clinica_revisar()` (BEFORE UPDATE de I5),
que conserva `revisado_en`/`revisado_por`. `gcal_aplicar_evento` y el 42501 de I2
no cambian: J4 sólo añade, en código, la llamada a la RPC después del rechazo.

### 12.4 Catálogo: qué cambió de verdad

Huella md5 por objeto de `public` de la base recién reiniciada con las 42 contra
la de I (39), reiniciada igual desde `git archive ccb9087`:

- **0 quitados, 3 cambiados**, los tres a propósito con `CREATE OR REPLACE`
  (mismo `proacl`): `reservar_por_enlace` (J2a y J2b), `reserva_contexto` (J2a) y
  `avisos_clinica_tipo_check` (J4, DROP + ADD con un tipo más: más amplia).
- **12 nuevos** (574 en total; más el índice `gcal_movimientos_rechazados_clinica_idx`, que la huella no cuenta): 4 funciones (`proteger_reserva_enlace_unico()`,
  `reserva_enlace_emitir` de 9 argumentos, `cita_movimiento_google_registrar`,
  `aviso_clinica_de_movimiento_google()`), 2 disparadores
  (`trg_reserva_enlaces_unico`, `trg_gcal_movimientos_aviso_clinica`), 5
  constraints (`reserva_enlaces_correo_check`, `_intentos_check`,
  `gcal_movimientos_rechazados_pkey`, `_intento_key`, `_clinica_id_fkey`) y la
  tabla `gcal_movimientos_rechazados`.
- `reserva_enlace_emitir` de 7 argumentos y `proteger_reserva_enlaces()`:
  **idénticas** a I. Ninguna policy previa cambia; ninguna tabla previa cambia de
  permisos ni de RLS.

### 12.5 Permisos de funciones

Ninguna función de la tanda tiene EXECUTE a PUBLIC; todas `search_path=''` y de
dueño `postgres`.

| Función | DEFINER | anon | authenticated | service_role |
|---|---|---|---|---|
| `reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text,text,text)` (nueva) | no | — | — | sí |
| `reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text)` (se conserva) | no | — | — | sí |
| `cita_movimiento_google_registrar(uuid,uuid,timestamptz)` (nueva) | no | — | — | sí |
| `reservar_por_enlace(…)`, `reserva_contexto(text,text,text)` (cambiadas) | no | — | — | sí |
| `proteger_reserva_enlace_unico()` (de disparador) | no | sí | sí | sí |
| `aviso_clinica_de_movimiento_google()` (de disparador) | **sí** | sí | sí | sí |

La única DEFINER es de disparador (devuelve `trigger`: no se llama por
PostgREST) y sólo inserta o reaviva en `avisos_clinica`, con `clinica_id` y
`cita_id` de la fila que la dispara; es DEFINER porque nadie más que los
disparadores escribe en `avisos_clinica` (§11.6). Ninguna necesita
`supabase_auth_admin` ni `supabase_storage_admin`.

**`gcal_movimientos_rechazados`.** RLS activada, **sin policies**; privilegios:
`service_role` SELECT e INSERT, nadie más (ni `anon` ni `authenticated`). FK
`clinica_id → clinicas` RESTRICT; **sin FK a `appointments`** a propósito (como
`avisos_clinica` y `reserva_empalmes_google`). La semilla la borra antes de las
clínicas (`scripts/agenda-semilla.ts`): sin eso, la FK RESTRICT abortaba
«borrar clínicas» y dejaba la base compartida sin datos (pasó una vez en la
tanda; notas de J1).

**`p1_permisos_funciones.sql`, caso 3, en la base combinada.** Reinicio con las
**45 migraciones** (5 de `main`, las tres `20261014*` de `feature/limites-ajustables` y las 37
del proyecto): todas aplican sin fallo y **ninguna función de `public` queda con
EXECUTE a PUBLIC** (0). La lista del caso 3 son ahora **47 funciones**: las 45
del §11.5 más `cita_movimiento_google_registrar(uuid,uuid,timestamp with time
zone)` y `reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text,text,text)`;
ninguna baja. Con esta lista pegada, **las 40 pruebas SQL** de la combinada
(`p1`, `p1b`, `p2`, `p3` y las 36 del proyecto) pasan. **Ésta es la lista para
pegar al fusionar las dos ramas** (sustituye a la del §11.5):

  ```
  agenda_restablecer_configuracion(uuid,uuid), alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), cita_confirmacion_contexto(text), cita_confirmacion_emitir(uuid,uuid,uuid,text,uuid), cita_confirmacion_responder(uuid,text,text), cita_confirmacion_revocar(uuid,uuid), cita_correo_marcar(uuid,uuid,uuid,text,text), cita_correo_tomar(uuid,uuid,text,uuid), cita_correos_pendientes(integer), cita_movimiento_google_registrar(uuid,uuid,timestamp with time zone), cita_reagendar_clinica(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone), cita_reagendar_oferta(uuid,text), cita_recordatorios_pendientes(integer), cita_rsvp_google(uuid,uuid,text,text,text[]), cita_tiene_nota_ligada(uuid,uuid), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), gcal_aplicar_evento(uuid,uuid,timestamp with time zone,text,text,timestamp with time zone,text,boolean,timestamp with time zone,timestamp with time zone,boolean,text,boolean,text,boolean), gcal_citas_por_evento(uuid,text[],uuid[]), gcal_importar_evento(uuid,text,text,text,timestamp with time zone,text,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid), gcal_sync_avanzar(uuid,uuid,text,text,timestamp with time zone,integer), gcal_sync_clinica_habilitada(uuid), gcal_sync_clinicas_pendientes(integer), gcal_sync_frescura(uuid), gcal_sync_reiniciar(uuid,uuid), gcal_sync_soltar(uuid,uuid,text), gcal_sync_tomar(uuid,uuid,text,integer,integer), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), reagendar_por_enlace(text,uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), reserva_codigo_emitir(uuid,uuid,text,text), reserva_codigo_verificar(uuid,uuid,text,text,text), reserva_contacto_estado(uuid,uuid,text,text), reserva_contacto_marcar(uuid,text), reserva_contactos_bloqueados(), reserva_contexto(text,text,text), reserva_empalmes_registrar(uuid,uuid[]), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text,text,text), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text), reserva_enlace_regenerar_fijo(uuid,uuid,text), reserva_ocupacion(uuid,uuid,timestamp with time zone,timestamp with time zone), reservar_por_enlace(uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()
  ```

Contra la combinada (huella de 581): los 12 objetos de la tanda y los 3
cambiados, idénticos en definición a la base de 42; sólo cambian los `proacl`
que P1 cierra (las mismas 41 funciones del §11.5) y se añaden los 7 objetos de
limites.

### 12.6 Contrato con spinus-consola

Ninguna de las tres nombra `ajuste_*`, `limite_efectivo` ni
`clinica_tiene_acceso()`, ni hace `ALTER`/`UPDATE` sobre `clinicas` (grep sobre
los tres archivos: 0; el único «CASCADE» es el comentario «sin CASCADE» de la
vuelta atrás de J4). Las columnas nuevas son de `reserva_enlaces`; ninguna se
renombra ni cambia de tipo. Las FK nuevas son RESTRICT. El CHECK de
`avisos_clinica` sólo se amplía: toda fila que lo cumplía lo sigue cumpliendo.
No se comprobó qué vistas de la consola leen estas tablas (su repositorio no
está aquí); ninguna columna existente cambia, que es lo que el contrato exige.

### 12.7 Orden de despliegue y tolerancia

| Migración | Orden | Sin la migración y con el código nuevo |
|---|---|---|
| J2a | migración primero | **Arreglado en la integración** (`7a1e831`): la lista de enlaces daba 500 (42703, `agotado_en`) y emitir también (PGRST202, la firma de 9), con la v2 encendida. Ahora la lista se lee con el filtro de antes y, **sin correo**, se emite con la firma de 7 (la misma emisión); **con correo no se emite** (500 «No se pudo guardar el enlace»): un único que perdiera su correo no mandaría el comprobante a nadie. La página del único, que ya no pide correo, reserva con el cuerpo de I2 (que acepta el único sin correo) y sin comprobante; no hay tope |
| J2b | después de J2a (lo exige su pre-vuelo); respecto al código, indiferente | el código ya trata `client_id_en_uso`; sin ella, la carrera de `client_id` da 500 como antes de la tanda |
| J4 | cualquiera | la pasada de Google rechaza el movimiento como en I (reescribe Google) y no avisa: la RPC no existe (PGRST202 → `SincronizacionNoDisponible`), el código lo ignora en silencio y la pasada sigue; otro error distinto se anota con `logger.warn` y cuenta en `errores` (`gcalSincronizacion.ts`, por lectura). Con la base nueva y el código viejo nadie llama a la RPC: no nace ningún aviso del tipo nuevo |

**La sobrecarga de 7 argumentos de `reserva_enlace_emitir`** se conserva para
que el código de antes siga emitiendo durante el despliegue (y, ahora, para la
tolerancia del código nuevo sin correo). Se retira con otra migración cuando no
quede ninguna instancia del código anterior; hasta entonces, la de 9 no tiene
`DEFAULT` en ningún parámetro, así que PostgREST no tiene ambigüedad: elige por
los nombres enviados.

**Prueba de tolerancia** (base local reiniciada SÓLO con las 39 de I, `db reset
--local --workdir` desde un `git archive ccb9087`; el `next start` :3001 con el
build integrado):
- **Con la v2 apagada:** `/agenda` y `/agenda/configuracion` 200; las rutas nuevas
  y `/api/agenda/enlaces` (GET y POST), 404 `no_disponible`. Es la agenda de antes.
- **Con la v2 encendida, primera pasada:** las sondas dieron `GET
  /api/agenda/enlaces` 500 y `POST` 500 (con y sin correo); 12 e2e de escritorio
  (`agenda-interruptor`, `-citas`, `-avisos`, `-cancelar`, `-secretaria`,
  `-tiempo-real`, `-panel-dia`, `-tipos-cita`, `-f-tarjeta`, `-j1-engrane`,
  `-j3-ligar-ventana`, `-i5-barra-avisos`): **54 pasan, 1 falla, 1 saltada, 1 sin
  correr**. La que falla es la de J1 que abre la configuración: «Tu enlace» se
  quedaba en «No se pudieron leer los enlaces».
- **Tras `7a1e831`** (Vitest `enlacesSinMigracionJ2.test.ts`, en rojo con cada
  una de sus dos mutaciones; revisor Sonnet APTO CON CAMBIOS, de texto,
  aplicados): `GET` 200, `POST` sin correo 201, `POST` con correo 500; las 12 e2e
  más `agenda-enlaces-reserva`: **61 pasan, 1 saltada, 0 fallan**.

Orden de despliegue recomendado (la guía §13.2, ampliada): las 37 del proyecto
en orden de nombre, ANTES del código; la v2 se enciende después.

### 12.8 Hallazgos

- **M1 · J2a no es reejecutable después de J2b** (§12.1). Su pre-vuelo acepta el
  cuerpo de I2 o el suyo, no el de J2b. En el orden normal no pasa nada; si
  alguien reaplicara la carpeta entera sobre una base que ya las tiene, J2a
  aborta limpio. No se tocó (editar una migración ya ensayada por su autor por un
  caso que no ocurre en el despliegue no compensa); se anota aquí y en la tabla
  de `mejora_agendaV2.md` §7.1.
- **M2 · La ruta de enlaces no toleraba la base sin J2a** (§12.7). Corregida.
- **M3 · Emitir un único con correo sin J2a da 500 genérico**, no un 503 «no
  disponible». Es deliberado (el servidor no puede guardar lo que la persona
  escribió) y sólo ocurre si se despliega el código antes que la migración.
- **M4 · Cada intento contado deja una fila en `audit_log`** (UPDATE de
  `reserva_enlaces`). Sin PII (sólo el id). A lo sumo 5 por enlace.
- **M5 · No se ejecutó la página pública del único contra la base sin J2a** con
  la v2 encendida; lo de la tabla del §12.7 sobre la reserva es por lectura del
  cuerpo de I2 y de la ruta.
- **Revisor del §12** (Sonnet, contra los archivos y el catálogo): APTA CON
  CAMBIOS, sólo de texto. Corrigió la restricción del `ON CONFLICT` de J4
  (§12.3 C: es `(cita_id, google_updated)`, sin `clinica_id`), la fila de J4 del
  §12.7 (sin la migración el código calla, no anota) y pidió nombrar el índice
  nuevo y distinguir «45 migraciones» de «47 funciones»: corregidos. Confirmó la
  lista de 47 (las 45 del §11.5 más exactamente las dos nuevas) cotejándola con
  los GRANT/REVOKE de las tres, los disparadores, los permisos y el contrato con
  la consola.

## 13. Tanda K (2026-11-18)

Cinco ramas en paralelo desde `0cce313` (`feature/agenda-v2-b56`, `-menores`,
`-t3`, `-t4`, `-t5`), fusionadas con `--no-ff` en `feature/agenda-v2` en el
orden K1, K2, K3, K4, K5. K4 y K5 no traen migraciones. K1 trae una, K2 traía
dos y K3 una. **En la integración se rehicieron las tres que quedan**
(`77a5b22`): la segunda de K2 se fundió en la primera, y K1 y K3 dejaron de
sustituir fragmentos de texto en los cuerpos vigentes.

### 13.1 El conjunto, desde cero

`ls supabase/migrations/*.sql` = **45**: las 5 de `main` y 40 del proyecto (las
37 hasta la tanda J y las 3 de K). Antes de reiniciar se contaron las filas
clínicas que no eran de la semilla: **0** `consultas`, **0** `documentos`,
**0** `addendums`, así que no hubo nada que respaldar. `supabase db reset
--local` (CLI 2.117.0) aplicó las 45 en orden y sin un error (el único aviso es
«no files matched pattern: supabase/seed.sql»). `schema_migrations` = 45, la
última `20261123140000`. Semilla, 1.2 s.

**Pasadas sueltas** de las tres versiones finales, sobre la base de J (42)
reiniciada aparte:

- K3 sin K1 **aborta** en el pre-vuelo.
- K1: ensayo con ROLLBACK, y luego dos pasadas reales, 13/13 OK cada una.
- K2: ensayo, y luego dos pasadas, 11/11 OK cada una.
- K3: ensayo, y luego dos pasadas, 9/9 OK cada una.
- K1 otra vez, ya con K3 puesta: **aborta** («ya tiene la guarda de "pausado"
  de K3»), sin cambiar nada.

### 13.2 Veredicto de las tres

| # | Archivo | Qué hace | Integración | Auditoría (sonnet, versión final) |
|---|---|---|---|---|
| K1 | `20261123120000_agenda_k1_bloqueos.sql` | tabla `agenda_bloqueos` (RLS propia, FK RESTRICT a `clinicas` y `profiles`, auditoría `log_tabla_change`, `trg_agenda_bloqueos_preparar` → `agenda_bloqueo_preparar()` con el candado 1790); `reserva_ocupacion` y `reservar_por_enlace` cuentan los bloqueos y dejan de contar lo de todo el día; `gcal_bloqueo_aplicar` nueva | De la sustitución de fragmentos (`k1_sustituciones` + `replace` + `EXECUTE`) a **cuerpos completos** con `CREATE OR REPLACE`. Pre-vuelo por md5 de `prosrc`: el cuerpo de J (`50a89d85…` / `1a448df0…`), el suyo (`e7cf1c34…` / `eb5ec46c…`) o **aborto** si ya tiene la guarda de K3. El post-vuelo aborta si no quedan el md5, INVOKER, la volatilidad, `search_path` vacío y sólo `service_role` | APTA con observaciones (todas de cabecera, más el post-vuelo ampliado): aplicadas |
| K2 | `20261123130000_agenda_k2_espera_codigo.sql` | `rate_limit_espera` y `reserva_espera_reenvio` (nuevas, INVOKER, STABLE, de sólo lectura), y `reserva_codigo_verificar` con la rama `reemplazado` | **Fundida aquí** la que era `20261123130100_agenda_k2_reenvio_por_enlace` (borrada). Pre-vuelo con las comprobaciones de las dos y una rejilla de 11 filas. La 5c de `k2_espera_codigo.sql` sigue en rojo sin el filtro por enlace («dio 30, esperaba 0») | APTA con observaciones (la fusión no perdió nada): aplicadas |
| K3 | `20261123140000_agenda_k3_huso_clinica_pausa_enlace.sql` | `clinicas.timezone` y `reserva_enlaces.pausado_en` (NULL; CHECK `reserva_enlaces_pausado_check`: sólo el fijo), y la guarda «no pausado» en seis funciones | De la sustitución (`k3_sustituciones` + `pg_temp.k3_veces`) a **cuerpos completos** construidos sobre los de K1. **Orden fijo K1 → K3.** Pre-vuelo y post-vuelo por md5 de las seis, más `proteger_reserva_enlaces` (`acd4128b…`, sin tocar). Se conserva el caso 6 de `k3_enlace_pausado.sql` | APTA con observaciones; la falta de CHECK de forma en `clinicas.timezone` queda como deuda (AG-DT) |

Los cuerpos finales son **idénticos en md5** a los que daba la sustitución:
reprodujimos los doce md5 que citaban K1 y K3 (J, K1, J+K3 y K1+K3).

Mutaciones en rojo sobre la base reiniciada:

- K1 sin el EXISTS sobre `agenda_bloqueos`, y K1 con lo de todo el día contado
  otra vez: caso 4 de `k1_bloqueos`.
- `reserva_codigo_emitir` sin la guarda de K3: caso 3 de `k3_enlace_pausado`.
- `reservar_por_enlace` sin la guarda de K3: también el caso 3.
- `cita_reagendar_oferta` y `reagendar_por_enlace` sin la guarda de K3: caso 4.
- Control sin mutar: en verde.

### 13.3 Disparadores de `appointments`, `agenda_bloqueos` y `reserva_enlaces`

- **`appointments`:** ninguna de las tres crea, cambia ni quita disparadores.
  Siguen los mismos diez de J: dos de auditoría, los cinco `proteger_*`,
  `asignacion_google`, `aviso_clinica` y `reserva_incidencia`.
  `reservar_por_enlace` sigue insertando como `service_role`, y la fila pasa
  por ellos igual que antes.
- **`agenda_bloqueos`** (nueva): un BEFORE INSERT OR UPDATE,
  `trg_agenda_bloqueos_preparar` (`agenda_bloqueo_preparar()`, INVOKER), y el
  AFTER `audit_agenda_bloqueos` (`log_tabla_change`, que sólo apunta id, tabla
  y operación: el `motivo` no llega a `audit_log`).
- **`reserva_enlaces`:** ningún disparador nuevo. `pausado_en` no está en la
  tupla que vigila `proteger_reserva_enlaces` (md5 `acd4128b…`, sin tocar):
  pausar es un UPDATE permitido a quien ya podía revocar (policy
  `reserva_enlaces_update`). El CHECK impide pausar un único, y
  `audit_reserva_enlaces` apunta cada pausa y cada reanudación.

### 13.4 El candado 1790

Lo toman tres funciones, todas con `pg_advisory_xact_lock(1790,
hashtext(medico_id))`:

- `reservar_por_enlace`, igual que desde D3;
- `agenda_bloqueo_preparar()`: al cambiar de médico toma los dos, en orden
  (`least`/`greatest`), para no cruzarse;
- `gcal_bloqueo_aplicar`: primero lee sin bloquear, toma el candado y después
  relee con `FOR UPDATE`.

`reagendar_por_enlace` lo hereda, porque llama a `reservar_por_enlace`. Por eso
un bloqueo y una reserva del mismo médico se serializan. En `reserva-carrera.sh`:

- escenario 6: B=ocupado tras esperar 1869 ms;
- 6b, el control sin el disparador: B=ok;
- 1 a 5 como en J;
- quedaron 5 citas, como se esperaba.

`confirmacion-carrera.sh` sigue en verde. Las citas que agenda la clínica
desde Spinus no toman el candado ni consultan los bloqueos en la base: allí el
bloqueo es una pregunta de interfaz. Tras la integración la hacen todos los
caminos que crean o mueven una cita: el alta rápida, el modal, el arrastre y,
nuevo, «Reagendar».

### 13.5 Permisos de funciones

Las funciones nuevas o recreadas, todas con REVOKE/GRANT explícitos:

- `reserva_ocupacion`, `reservar_por_enlace`, `gcal_bloqueo_aplicar`,
  `rate_limit_espera`, `reserva_espera_reenvio`, `reserva_codigo_verificar`,
  `reserva_contexto`, `reagendar_por_enlace`, `cita_reagendar_oferta` y
  `reserva_codigo_emitir` son **sólo `service_role`**.
- `agenda_bloqueo_preparar()` es función de disparador y tiene los tres roles,
  según la regla: no se invoca sola.
- **Ninguna de las nuevas o recreadas por K** tiene EXECUTE a PUBLIC. En la
  base de 45 siguen con PUBLIC las 34 heredadas de `main` (`get_clinica_id`,
  `log_tabla_change`, `sa_*`…), que cierra P1 de `feature/limites-ajustables`.

**`p1_permisos_funciones.sql`, caso 3, en la base combinada.** Reiniciamos con
**48 migraciones**: las 45 y las tres `20261014*` de
`feature/limites-ajustables`. Todas aplican sin fallo, y **0 funciones** quedan
con EXECUTE a PUBLIC (sin contar las de extensiones). El caso 3 da rojo, como
se esperaba.

La lista son ahora **50 funciones**: las 47 del §12.5 más
`gcal_bloqueo_aplicar(…)`, `rate_limit_espera(text,integer,integer)` y
`reserva_espera_reenvio(uuid,uuid,text,integer)`. No hay ninguna baja.
`agenda_bloqueo_preparar()` no entra, porque tiene los tres roles.

Con esta lista pegada pasan **las 43 pruebas SQL** de la combinada: `p1`,
`p1b`, `p2`, `p3` y las 39 del proyecto. **Ésta es la lista para pegar al
fusionar las dos ramas** (sustituye a la del §12.5):

  ```
  agenda_restablecer_configuracion(uuid,uuid), alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), cita_confirmacion_contexto(text), cita_confirmacion_emitir(uuid,uuid,uuid,text,uuid), cita_confirmacion_responder(uuid,text,text), cita_confirmacion_revocar(uuid,uuid), cita_correo_marcar(uuid,uuid,uuid,text,text), cita_correo_tomar(uuid,uuid,text,uuid), cita_correos_pendientes(integer), cita_movimiento_google_registrar(uuid,uuid,timestamp with time zone), cita_reagendar_clinica(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone), cita_reagendar_oferta(uuid,text), cita_recordatorios_pendientes(integer), cita_rsvp_google(uuid,uuid,text,text,text[]), cita_tiene_nota_ligada(uuid,uuid), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), gcal_aplicar_evento(uuid,uuid,timestamp with time zone,text,text,timestamp with time zone,text,boolean,timestamp with time zone,timestamp with time zone,boolean,text,boolean,text,boolean), gcal_bloqueo_aplicar(uuid,text,text,uuid,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone,date,date), gcal_citas_por_evento(uuid,text[],uuid[]), gcal_importar_evento(uuid,text,text,text,timestamp with time zone,text,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid), gcal_sync_avanzar(uuid,uuid,text,text,timestamp with time zone,integer), gcal_sync_clinica_habilitada(uuid), gcal_sync_clinicas_pendientes(integer), gcal_sync_frescura(uuid), gcal_sync_reiniciar(uuid,uuid), gcal_sync_soltar(uuid,uuid,text), gcal_sync_tomar(uuid,uuid,text,integer,integer), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_espera(text,integer,integer), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), reagendar_por_enlace(text,uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), reserva_codigo_emitir(uuid,uuid,text,text), reserva_codigo_verificar(uuid,uuid,text,text,text), reserva_contacto_estado(uuid,uuid,text,text), reserva_contacto_marcar(uuid,text), reserva_contactos_bloqueados(), reserva_contexto(text,text,text), reserva_empalmes_registrar(uuid,uuid[]), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text,text,text), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text), reserva_enlace_regenerar_fijo(uuid,uuid,text), reserva_espera_reenvio(uuid,uuid,text,integer), reserva_ocupacion(uuid,uuid,timestamp with time zone,timestamp with time zone), reservar_por_enlace(uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()
  ```

### 13.6 Contrato con spinus-consola

- `clinicas.timezone` es una **columna nueva** (text, NULL = «aún no eligió»,
  sin DEFAULT). No se renombra ni cambia nada de lo que la consola lee.
- Ninguna de las tres nombra `ajuste_*` ni `limite_efectivo`. K1 **llama** a
  `clinica_tiene_acceso()`, `clinica_no_suspendida()` y `perfil_completo()`
  desde las policies de INSERT y UPDATE de `agenda_bloqueos`, y comprueba en su
  pre-vuelo y post-vuelo que existen, pero no las redefine.
- Ninguna hace `ALTER` de columnas existentes de `clinicas` (sólo `ADD COLUMN
  IF NOT EXISTS`) ni `UPDATE` sobre la tabla.
- No hay ningún `CASCADE`, y las FK nuevas son RESTRICT.
- La escribe sólo `PUT /api/me/horario` (el horario de la clínica, con
  `timezoneSchema` contra `Intl`), con `createAdminClient()` filtrado por
  `.eq('id', profile.clinica_id)`, porque `clinicas` no tiene policy de UPDATE
  para `authenticated`. La lee `GET /api/me/clinica`, con el cliente de sesión
  y tolerando el 42703. No la lee la rejilla, ni la reserva, ni los correos.
- No comprobamos qué vistas de la consola leen `clinicas`, porque su
  repositorio no está aquí. Ninguna columna existente cambia, y eso es lo que el
  contrato exige.

### 13.7 Orden de despliegue y tolerancia

| Migración | Orden | Sin la migración y con el código nuevo |
|---|---|---|
| K1 | después de toda la J, **antes de K3** | con la v2 apagada, nada la pide. Con la v2 encendida, la lectura de bloqueos devuelve `[]` (`BLOQUEOS_AUSENTES`) y la agenda pinta como en J. Crear un bloqueo no se puede. En el enlace, lo de todo el día sigue cerrando el día, como antes de K1 |
| K2 | cualquiera respecto a K1 y K3 | sin `reserva_espera_reenvio`, reenviar no espera 30 s en el servidor: el tope de 3/h por correo y los de red y navegador siguen. Sin `rate_limit_espera`, el mensaje no dice cuánto falta («Espera un rato…», el de antes). Sin la rama `reemplazado`, un código viejo cuenta como equivocado, como antes |
| K3 | **después de K1** (si no, su pre-vuelo aborta), antes del código | con la v2 apagada, la ruta de enlaces es 404 y la configuración es la de antes. Con la v2 encendida, apagar «Tu enlace» responde 409 `sin_pausa` y **no hace nada** (decisión de K3: no lo revoca a escondidas), y la página enseña «No se pudo guardar el enlace». El huso de la clínica no se guarda. Lo público funciona con los cuerpos de K1/J |

**Prueba de tolerancia.** Reiniciamos la base local SÓLO con las 42 de J (`db
reset --local --workdir`, desde un `git archive 0cce313`) y la sembramos con la
semilla nueva, que tolera la tabla ausente. Usamos el `next start` :3001 con el
build integrado (`fe17b4f`).

- **v2 apagada:** `agenda-interruptor`, `-citas`, `-secretaria`,
  `-tipos-cita`, `-cancelar`, `-avisos`, `-tiempo-real`, `-panel-dia` y
  `agenda-k-salida-modal` dieron **29 pasan, 0 fallan**. Varias encienden la v2
  a mitad de la prueba.
- **v2 encendida, con los archivos de K y los flujos públicos:** fallan
  exactamente las pruebas de lo que trae cada migración, y nada más:
  - la pregunta del bloqueo al reagendar y `agenda-k1-bloqueos` (sin tabla, la
    prueba no puede insertar el bloqueo);
  - las ocho de `agenda-k3-configuracion`, porque su `foto()` lee
    `clinicas.timezone` por SQL;
  - el apagado de `agenda-enlaces-reserva` (el 409 de arriba);
  - en `reserva-k2-codigo`, el reenvío (200 en vez de 429) y el «dice cuánto
    falta», que sale con el mensaje de antes;
  - el punto 5 de `reserva-seg1`.

  En la segunda tanda pasan 19, entre ellas `confirmacion-k2-al-cargar`,
  `agenda-k5-*` y `agenda-k4-leyenda-husos`. Ninguna falla es un error de la
  app; son funciones que todavía no existen.

Orden de despliegue recomendado: las 40 del proyecto en orden de nombre (K1,
K2, K3 al final), ANTES del código. La v2 se enciende después.

### 13.8 Hallazgos

- **K-M1 · K1 y K3 tienen orden fijo.** K1 aborta si K3 ya está, y K3 aborta sin
  K1. En el orden de nombre no pasa nada. Reaplicar la carpeta entera sobre una
  base que ya las tiene hace abortar limpio a K1, igual que J2a en J (§12.8 M1).
- **K-M2 · Sin la migración de K3, apagar el enlace fijo da un error visible**
  en vez de revocarlo (§13.7). Es deliberado, y sólo ocurre si el código va
  antes que la migración con la v2 encendida.
- **K-M3 · `clinicas.timezone` sin CHECK de forma.** La escribe sólo el
  servidor (`/api/me/horario`) tras Zod contra `Intl`, porque `clinicas` no
  tiene policy de UPDATE para `authenticated`. Queda como AG-DT.
- **K-M4 · Revisión de seguridad** (sonnet, sólo lectura, de la superficie
  pública y las RPC del conjunto): ningún hallazgo alto.
  - Media: confirmar al abrir (K2, punto 8) lo puede ejecutar un escáner de
    correo con navegador real. Ya era riesgo aceptado en la cabecera de
    `ConfirmarAlCargar.tsx`; va a «PARA REVISIÓN DE ANGEL» con la mitigación
    que propone, esperar un gesto `isTrusted` antes del POST.
  - Bajas: el bit de «ese correo pidió código en este enlace hace < 30 s»
    (aceptado y documentado); el bombardeo de códigos a un correo (ya
    existía); `reserva_enlace_regenerar_fijo` deja abierto el enlace nuevo
    aunque el viejo estuviera pausado (AG-DT); el `motivo` del bloqueo viaja a
    Google en el título (decisión de Angel; el riesgo es que alguien escriba un
    nombre de paciente: AG-DT y «PARA REVISIÓN DE ANGEL»).
  - Limpio: la pausa en las seis rutas públicas, los bloqueos en la reserva
    bajo el candado, el aislamiento por clínica en `/api/agenda/bloqueos/**` y
    `/api/agenda/enlaces/**`, Zod, `sessionStorage` sin nombre, teléfono ni
    código, y las redirecciones de `ConfirmarAlCargar`.
- **Revisor del §13** (sonnet, contra los archivos y el catálogo): APTA con
  cambios menores, de redacción (el PUBLIC heredado de `main` en la base de 45,
  y las funciones que K1 llama desde sus policies). Corregidos. Confirmó la
  lista de 50 contra `lista-caso3.txt`, los disparadores, el candado 1790, los
  permisos, el contrato con la consola y la tolerancia leyendo el código.


## 14. Tanda L (2026-11-19)

Cinco ramas en paralelo desde `cf97bdb` (`feature/agenda-v2-l1` a `-l5`, en
los worktrees `-agenda-b56`, `-agenda-t5`, `-agenda-t3`, `-agenda-menores` y
`-agenda-t4`), fusionadas con `--no-ff` en `feature/agenda-v2` en el orden L1,
L2, L3, L4, L5. Traen tres migraciones: L1, L2 y L5. L3 y L4 no traen ninguna.
**La integración no añadió ni cambió ninguna migración.** Los ajustes de la
integración son de pruebas, CSS y de qué chunk lleva el candado.

### 14.1 El conjunto, desde cero

`ls supabase/migrations/*.sql` = **48**: las 5 de `main` y 43 del proyecto (las
40 hasta la tanda K y las 3 de L).

Antes de reiniciar se contaron las filas que no eran de la semilla. Había **1
`consulta`** y **1 bloqueo**, de las pruebas de las ramas en la base
compartida, y la cita a la que iba ligada la consulta. Se respaldaron en JSON en
`/home/spinus/proyectos/respaldos-angel/tanda-L-respaldo-2026-11-19.json`. Esa
consulta es la que impedía resembrar durante la tanda (AG-DT-208).

`supabase db reset --local` (CLI 2.117.0) aplicó las 48 en orden y sin un error.
`schema_migrations` = 48, la última `20261124160000`. Después se sembró la
Semilla (1,3 s).

### 14.2 Las tres migraciones

| # | Archivo | Qué hace | Riesgo (cabecera) |
|---|---|---|---|
| L1 | `20261124120000_agenda_l1_bloqueo_total.sql` | `cita_proteger_bloqueo()` (nueva, INVOKER, `search_path = ''`) y el disparador `trg_appointments_horario_bloqueado`, `BEFORE INSERT OR UPDATE OF start_time, end_time, medico_id`. Rechaza con 42501 y HINT `agenda_horario_bloqueado` el alta, o el cambio de inicio, fin o médico, que se solapa con un bloqueo del mismo médico, con la v2 encendida | MEDIO |
| L2 | `20261124130000_agenda_l2_eliminar_cancelada.sql` | `appointments_cierre_check`, más ancho: cerrada sin sustituta, sólo si está cancelada. `cita_proteger_cierre()` con `CREATE OR REPLACE` acepta `sustituida_por` NULL al cerrar. Lo demás queda igual | BAJO |
| L5 | `20261124160000_agenda_l5_aviso_confirmacion_paciente.sql` | `aviso_clinica_de_confirmacion()` (nueva, SECURITY DEFINER, `search_path = ''`) y el disparador AFTER `trg_cita_confirmaciones_aviso_confirmacion` (`UPDATE OF respuesta, respondido_en`). Salta cuando `respuesta` pasa a `'confirmo'`, o sigue en `'confirmo'` con un `respondido_en` nuevo: una reconfirmación. `ON CONFLICT` sólo junta los avisos sin revisar, así que una reconfirmación tras revisar el aviso da otro. `avisos_clinica_tipo_check` suma `confirmacion_paciente` | BAJO |

Ninguna crea, cambia ni quita una policy. Ninguna añade, quita ni cambia de tipo
una columna: sólo se recrean los dos CHECK, y los dos se amplían. L2 cambia
además el `COMMENT ON COLUMN appointments.cerrada_en`, que es sólo metadato.

Lo que L1 deja pasar sin consultar `agenda_bloqueos` (mira sólo `NEW`/`OLD`, el
rol y la configuración):
- **con la v2 apagada en la clínica, o sin fila en `agenda_ajustes`, nada se
  rechaza**;
- un UPDATE que no mueve inicio, fin ni médico;
- una fila sin médico;
- `postgres` y `supabase_admin`;
- `service_role` con `spinus.via = 'google'`, porque lo de Google entra como hoy;
- el alta de `service_role` con `reserva_canal`, porque `reservar_por_enlace` ya
  rechaza los bloqueos bajo el candado 1790.

`cita_reagendar_clinica` sí pasa por él: es INVOKER, la llama `service_role` y
no pone `spinus.via`. **Salvedad para el futuro:** una función SECURITY DEFINER
cuyo dueño sea `postgres` que escriba en `appointments` dejaría a L1 inerte, por
el atajo de `current_user = 'postgres'`. Hoy no hay ninguna en ese camino.

### 14.3 Disparadores de `appointments` y `cita_confirmaciones`

**`appointments`.** Pasan de diez a **once**. Los BEFORE, en el orden en que
Postgres los dispara (por nombre):

1. `trg_appointments_asignacion_google`
2. **`trg_appointments_horario_bloqueado`** (L1)
3. `trg_appointments_proteger_atendida`
4. `trg_appointments_proteger_borrado`
5. `trg_appointments_proteger_cierre` (con el cuerpo de L2)
6. `trg_appointments_proteger_eleccion`
7. `trg_appointments_proteger_reserva`

Los AFTER: `audit_appointments`, `audit_appointments_update`
(`log_cita_change`), `trg_appointments_aviso_clinica` y
`trg_appointments_reserva_incidencia`.

El orden de los siete es la regla de Postgres, que dispara por nombre. La prueba
sólo comprueba que existen tres de ellos (`horario_bloqueado`, `proteger_cierre`
y `proteger_eleccion`), y el orden entre el 2 y el 6 por el HINT del rechazo.

Lo comprobado en la base (`supabase/pruebas-sql/l_integracion_disparadores.sql`,
nueva en la integración):

- **«Eliminar cita» de una cancelada dentro de un bloqueo funciona.** El UPDATE de
  `/quitar` sólo pone `cerrada_en`, así que `UPDATE OF …` ni dispara el
  disparador de L1. `log_cita_change` apunta `cita_editada` con
  `campos = ["cerrada_en"]`.
- **«Reasignar el horario» hacia dentro del bloqueo, no.** La sustituta no nace
  (HINT del bloqueo) y la cancelada sigue abierta.
- **Una cita de enlace movida al bloqueo por la sesión choca primero con el
  bloqueo** (2 va antes que 6). Las dos la rechazarían, y no cambia nada.
- **Un PATCH que repite inicio, fin y médico pasa**, porque PostgREST manda la fila
  entera. Ahí sí dispara, y lo deja pasar el atajo «no se mueve».
- Mutaciones en rojo:
  - sin lista de columnas y sin atajo → caso 1;
  - sin el atajo → caso 4.

**`cita_confirmaciones`.** Tres disparadores:
- `audit_cita_confirmaciones`;
- `trg_cita_confirmaciones_aviso_clinica` (I5, `cancelo`);
- **`trg_cita_confirmaciones_aviso_confirmacion`** (L5, `confirmo`).

Los dos de avisos insertan con `ON CONFLICT DO NOTHING` sobre el índice único
parcial de `avisos_clinica`. Corren dentro de la transacción de
`cita_confirmacion_responder`, que es el mismo riesgo que ya aceptaba I5.

La carrera de confirmación sigue en verde: el candado espera 1887 ms, y A y B a la
vez acaban en «cancelada».

La carrera de reserva también:
- el escenario 6 (un bloqueo contra una reserva) da B=ocupado tras esperar 1868 ms;
- quedaron 5 citas, como se esperaba.

### 14.4 Permisos de funciones

Todas llevan `REVOKE … FROM PUBLIC` y `GRANT … TO anon, authenticated,
service_role` explícitos:

- `cita_proteger_bloqueo()`: nueva, función de disparador, INVOKER.
- `cita_proteger_cierre()`: `CREATE OR REPLACE` conserva sus permisos, y aun así
  se repiten.
- `aviso_clinica_de_confirmacion()`: nueva, función de disparador, DEFINER.

Por la regla, las tres tienen los tres roles: devuelven `trigger` y no se invocan
solas. **Ninguna da EXECUTE a PUBLIC.**

**`p1_permisos_funciones.sql`, caso 3, en la base combinada.** Reiniciamos con
**51 migraciones**: las 48 y las tres `20261014*` de
`feature/limites-ajustables`. Todas aplican sin fallo. El caso 2 pasa: 0
funciones con EXECUTE a PUBLIC. El caso 3 da rojo, como se esperaba.

La lista sigue siendo de **50 funciones**, idéntica una por una a la del §13.5:
la tanda L no añade ni quita ninguna, porque sus tres funciones tienen los tres
roles. Con esta lista pegada pasan **las 47 pruebas SQL** de la combinada (`p1`,
`p1b`, `p2`, `p3` y las 43 del proyecto). Es la misma lista para pegar al
fusionar las dos ramas:

  ```
  agenda_restablecer_configuracion(uuid,uuid), alta_conexion_google(uuid,uuid,text,text,text,text,text,bigint), cita_confirmacion_contexto(text), cita_confirmacion_emitir(uuid,uuid,uuid,text,uuid), cita_confirmacion_responder(uuid,text,text), cita_confirmacion_revocar(uuid,uuid), cita_correo_marcar(uuid,uuid,uuid,text,text), cita_correo_tomar(uuid,uuid,text,uuid), cita_correos_pendientes(integer), cita_movimiento_google_registrar(uuid,uuid,timestamp with time zone), cita_reagendar_clinica(uuid,uuid,uuid,uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone), cita_reagendar_oferta(uuid,text), cita_recordatorios_pendientes(integer), cita_rsvp_google(uuid,uuid,text,text,text[]), cita_tiene_nota_ligada(uuid,uuid), crear_paciente_con_medico(jsonb,uuid), enforce_limite_documentos_paciente(), gcal_aplicar_evento(uuid,uuid,timestamp with time zone,text,text,timestamp with time zone,text,boolean,timestamp with time zone,timestamp with time zone,boolean,text,boolean,text,boolean), gcal_bloqueo_aplicar(uuid,text,text,uuid,text,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone,date,date), gcal_citas_por_evento(uuid,text[],uuid[]), gcal_importar_evento(uuid,text,text,text,timestamp with time zone,text,timestamp with time zone,timestamp with time zone,boolean,text,text,uuid), gcal_sync_avanzar(uuid,uuid,text,text,timestamp with time zone,integer), gcal_sync_clinica_habilitada(uuid), gcal_sync_clinicas_pendientes(integer), gcal_sync_frescura(uuid), gcal_sync_reiniciar(uuid,uuid), gcal_sync_soltar(uuid,uuid,text), gcal_sync_tomar(uuid,uuid,text,integer,integer), generar_folio(text), guardar_secretos_conexion(uuid,uuid,text,text,bigint), leer_conexion_google_con_secretos(uuid,uuid), rate_limit_espera(text,integer,integer), rate_limit_intento(text,text,integer,integer), rate_limit_reset(text), reagendar_por_enlace(text,uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), reserva_codigo_emitir(uuid,uuid,text,text), reserva_codigo_verificar(uuid,uuid,text,text,text), reserva_contacto_estado(uuid,uuid,text,text), reserva_contacto_marcar(uuid,text), reserva_contactos_bloqueados(), reserva_contexto(text,text,text), reserva_empalmes_registrar(uuid,uuid[]), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text,text,text), reserva_enlace_emitir(uuid,uuid,uuid,uuid,text,text,text), reserva_enlace_regenerar_fijo(uuid,uuid,text), reserva_espera_reenvio(uuid,uuid,text,integer), reserva_ocupacion(uuid,uuid,timestamp with time zone,timestamp with time zone), reservar_por_enlace(uuid,text,uuid,uuid,timestamp with time zone,text,text,text,text,text,text,text,text,uuid), sync_antropometria_paciente(uuid), trg_mediciones_antropometria()
  ```

### 14.5 Contrato con spinus-consola

- Ninguna de las tres nombra `clinicas`, `ajuste_*`, `limite_efectivo` ni
  `clinica_tiene_acceso()`.
- No se renombra ninguna columna ni cambia ningún tipo.
- Los dos CHECK que se recrean se **amplían**:
  - `appointments_cierre_check`: cerrada sin sustituta;
  - `avisos_clinica_tipo_check`: un tipo más.

  Una vista que lea esas columnas sigue leyendo los valores de antes. La única
  novedad es que puede ver `tipo = 'confirmacion_paciente'` y una cita cerrada
  con `sustituida_por` NULL.
- No hay ningún `CASCADE` ni FK nueva.
- El repositorio de la consola no está aquí, así que no comprobamos sus vistas.

### 14.6 Orden de despliegue y tolerancia

| Migración | Orden | Sin la migración y con el código nuevo |
|---|---|---|
| L1 | después de K1 (`agenda_bloqueos`) | Las rutas siguen dando 409 `horario_bloqueado` (POST/PUT de `/api/appointments` y `/reagendar`): leen `agenda_bloqueos` antes de escribir. El PUT sólo veta si mueve inicio, fin o médico. Falta la barrera de la base: PostgREST directo, `cita_reagendar_clinica`, y la carrera con un bloqueo recién creado entre la lectura y la escritura (`esErrorDeBloqueo` sólo actúa si existe L1) |
| L2 | después de `20261121142000` | «Eliminar cita» responde 409 `no_aplica`, porque el CHECK viejo pide sustituta: la cita no sale de la agenda. No hay más efecto |
| L5 | después de E1, I5 y J4 | No hay aviso `confirmacion_paciente`. La confirmación del paciente funciona igual. **No reaplicar J4 después**: su pre-vuelo aborta limpio (AG-DT-229) |

Orden recomendado: las 43 del proyecto en orden de nombre (L1, L2 y L5 al final),
ANTES del código. La v2 se enciende después.

**Prueba de tolerancia.** Reiniciamos la base SÓLO con las 45 de K (`db reset
--local --workdir`, desde un `git archive cf97bdb`) y la sembramos. Usamos el
`next start` :3001 con el build integrado.

- **v2 apagada:** 41 pasan, 0 fallan. Corrimos `agenda-interruptor`, `-citas`,
  `-secretaria`, `-tipos-cita`, `-cancelar`, `-avisos`, `-tiempo-real`,
  `-panel-dia`, `agenda-k-salida-modal` y `agenda-j1-engrane` (lo de «apagada,
  no baja el JS de la campana, el engrane ni el candado»).
- **v2 encendida, con los archivos de L:** corrimos `agenda-l1-bloqueo-telefono`,
  `agenda-k1-bloqueos`, `agenda-l2`, `agenda-l3-configuracion`,
  `agenda-l5-campana`, `confirmacion-k2-al-cargar` y `agenda-h4-por-confirmar`.
  Dieron 40 pasan y 4 fallan. Tres de las cuatro son exactamente lo que traen las
  migraciones:
  - `agenda-l2` «Eliminar cita» da 409 en vez de 200 (L2);
  - `agenda-l5-campana` 13 y 14, y `agenda-h4` 18: no aparece el aviso
    `confirmacion_paciente` (L5).

  Las del bloqueo pasan sin L1, como se esperaba.
- La cuarta, `agenda-l3-configuracion` 17, **no era de la migración sino de la
  prueba**: daba por hecho un tipo de cita principal y un enlace fijo de admin.a,
  que la base recién sembrada no tiene. Con el id vacío, el PATCH iba a la
  colección y respondía 405. Arreglada en la integración: la prueba crea los suyos
  con `sinPendientesAgenda` y los quita. En rojo antes y en verde después, en la
  base limpia.

### 14.7 Hallazgos

- **L-M1 · Reaplicar J4 después de L5 aborta** (AG-DT-229). En el orden de nombre
  no pasa nada.
- **L-M2 · Sin L1, las rutas ya bloquean.** Lo que falta sin la migración es la
  barrera de la base. Por eso L1 va antes del código, como todas.
- **L-M3 · El bloqueo total no toma el candado 1790** (AG-DT-201). Una cita que se
  agenda desde Spinus y un bloqueo nuevo del mismo médico no se serializan. La
  reserva por enlace sí, desde K1.
- **L-M4 · Revisión de seguridad** (sonnet, sólo lectura, del diff `cf97bdb..HEAD`):
  ningún hallazgo alto.
  - Media-baja: el traspaso de nombre y teléfono por `BroadcastChannel` no está
    atado al código (AG-DT-220). Es riesgo aceptado por Angel y va «PARA REVISIÓN
    DE ANGEL» con la mitigación.
  - Baja: la regex de Sentry no cubre `%23codigo=` (AG-DT-221). No se tocó,
    porque en `sentryPiiFilter.ts` sólo está autorizada la línea de L4.
  - Baja e informativa: el saludo del correo usa `reserva_nombre`, que teclea el
    público. Va escapado y sin nada clínico (AG-DT-224).
  - Limpio:
    - `/api/appointments/[id]/quitar`: getUser, sesión con `clinica_id`,
      `puedeGestionarDelMedico`, sólo canceladas, idempotente, audit_log, y su
      único `createAdminClient()` filtrado por id, `clinica_id`, estado y
      `cerrada_en`;
    - los 409 `horario_bloqueado`, con un texto fijo, sesión con `clinica_id` y
      el 42501 reconocido sólo por su HINT;
    - las tres migraciones;
    - `/api/reservar/**`, `/api/confirmar/**` y el middleware, sin cambios;
    - el POST de `/confirmar`, que ahora espera un gesto `isTrusted`;
    - nada de PII en `localStorage`.
- **Revisor del §14** (sonnet, contra las migraciones, la prueba SQL, las rutas
  y el catálogo): APTA con cambios, todos de redacción. Pedía:
  - el atajo de la v2 apagada en la lista de L1;
  - la reconfirmación de L5;
  - el `COMMENT ON COLUMN` de L2;
  - qué del orden prueba la prueba;
  - la salvedad de las funciones DEFINER;
  - la carrera sin L1.

  Aplicados. Sin hallazgos sobre permisos ni contrato con la consola.

## 15. Tanda M (2026-11-19)

Cinco ramas en paralelo desde `cb0e290` (`feature/agenda-v2-m1` a `-m5`, en
los worktrees `-agenda-t5`, `-agenda-t3`, `-agenda-b56`, `-agenda-menores` y
`-agenda-t4`), fusionadas con `--no-ff` en `feature/agenda-v2` en el orden M1,
M2, M3, M4, M5 (`e88d928`, `87ca068`, `5e1c50d`, `3c23f39` y `108f80c`).
**Ninguna de las cinco trae migración.** La integración añade una, por encargo
de Angel, que **no es de la agenda**: `20261125170000_audit_log_sin_truncate.sql`
(`8bd6ba8`).

### 15.1 El conjunto, sin reiniciar

`ls supabase/migrations/*.sql` = **49**: las 5 de `main`, las 43 de la agenda
(sin cambios desde la tanda L) y la del TRUNCATE.

**Esta vez la base NO se reinició** (orden de Angel: «No vuelvas a borrar filas
de audit_log, tampoco en local ni de pruebas»; `supabase db reset` vaciaría el
`audit_log` local). Las 48 de la tanda L ya estaban aplicadas desde su
reinicio; sobre esa base se aplicó sólo la nueva, bajo el flock:

1. en seco, con el `COMMIT` cambiado por `ROLLBACK`: veredicto OK en las 5
   filas comprobables y la base sin cambios después (`TRUNCATE` de `anon`
   seguía en `true`, 0 disparadores nuevos);
2. real, y una segunda pasada: OK y OK, idempotente;
3. tras la auditoría, una tercera con el post-vuelo nuevo: OK;
4. registrada a mano en `supabase_migrations.schema_migrations`
   (`20261125170000`, `audit_log_sin_truncate`).

`audit_log`: 65 036 filas antes de aplicarla y 65 036 después de cada pasada
(al aplicarla, 2026-11-19 ~15:40 UTC; la cifra crece después con la actividad
de las pruebas, que ya no borran nada).

Lo que esto no comprueba, y la tanda L sí: el conjunto **desde cero**. No se
corrió; las 43 de la agenda no cambiaron desde la tanda L (§14.1), y la nueva
sólo depende de objetos del baseline.

### 15.2 La migración

| Archivo | Qué hace | Riesgo (cabecera) |
|---|---|---|
| `20261125170000_audit_log_sin_truncate.sql` | `REVOKE TRUNCATE ON public.audit_log FROM anon, authenticated, service_role` y el disparador de sentencia `prevent_audit_truncate` (`BEFORE TRUNCATE … FOR EACH STATEMENT`) con la función de siempre, `prevent_audit_modification()`, que lanza «El audit_log es inmutable. No se permite UPDATE ni DELETE.». Pre-vuelo: dueño, el md5 de la función (`f1fe023a…`) y, en una repetición, el disparador por catálogo (`tgtype` 34, la misma función). Post-vuelo ANTES del `COMMIT`: aborta si algún rol conserva TRUNCATE | BAJO |

- **No concede nada**, no toca la policy `audit_super_admin_select`, ni
  `prevent_audit_delete` ni `prevent_audit_update`, ni la función, ni ninguna
  otra tabla. Los demás privilegios de los tres roles sobre `audit_log`
  (SELECT, INSERT, UPDATE, DELETE, REFERENCES, TRIGGER y, en PG 17, MAINTAIN)
  siguen.
- **Depende sólo del baseline**: la tabla, la función y, para el veredicto,
  los dos disparadores de fila. Ninguna migración de la agenda la necesita ni
  la toca. **Se puede aplicar sola y antes que el conjunto de la agenda**; el
  timestamp va detrás de los rangos de M1–M5 sólo para no chocar.
- **Antes de escribirla**, grep de `truncate` en `src`, `scripts`, `e2e` y
  `supabase`: nada vacía `audit_log`. En `src` sólo la clase `truncate` de
  Tailwind y `NOTAS_TRUNCATE`; en `supabase`, `REVOKE` de TRUNCATE en tablas de
  la agenda y comentarios. La semilla sólo inserta en `audit_log`.
- **Prueba:** `supabase/pruebas-sql/m_audit_log_sin_truncate.sql`, 5 casos (9
  comprobaciones): los
  tres roles reciben 42501; `postgres` (el dueño, que conserva el privilegio)
  recibe P0001 con el mensaje; `service_role` con el privilegio devuelto dentro
  del subbloque, también P0001; el disparador existe; el recuento no cambia.
  Cada intento va en un subbloque que se deshace siempre (si el TRUNCATE
  entrara, una excepción propia lo revierte) y el archivo acaba en `rollback`.
  - En rojo antes de aplicar la migración: «AT caso 1 (anon): dio vació,
    esperaba 42501».
  - Mutaciones, dentro de la transacción: sin el REVOKE y sin el disparador →
    caso 1; sólo sin el disparador → caso 2; sólo con el GRANT → caso 1 («dio
    P0001…»).
  - La guarda `pruebasSinBorrarAuditoria.test.ts` deja a ese archivo, y sólo a
    él, escribir TRUNCATE de `audit_log`, si acaba en `rollback;` y no lleva
    `commit`. El DELETE le sigue prohibido. En rojo: sin el `rollback` final,
    con un `commit`, con un `delete from public.audit_log`, o con un TRUNCATE
    en otro archivo.
- **Lo que no cierra:** `postgres` con `session_replication_role = replica`
  sigue pudiendo vaciarla, igual que puede borrar filas: los tres
  disparadores son normales (`tgenabled` `O`). No se pasó a `ENABLE ALWAYS`
  porque el encargo pide uno igual al de borrado. Queda para Angel (§6-bis).

### 15.3 Permisos de funciones

La migración **no crea ninguna función**: reutiliza `prevent_audit_modification()`
(sea cual sea su ACL, no se toca: en el baseline y hoy en la base local lleva
EXECUTE a PUBLIC; `feature/limites-ajustables` lo revoca). El disparador no
necesita EXECUTE de quien hace el TRUNCATE: PostgreSQL lo comprueba al crear el
disparador, no al dispararlo.

La lista del caso 3 de `p1_permisos_funciones.sql` (`feature/limites-ajustables`)
**sigue en 50**, idéntica a la del §14.4: ninguna de las cinco ramas de M ni la
integración añade o quita funciones. **No se comprobó en una base combinada**:
exigía reiniciar la base, y esta tanda no reinicia (§15.1).

### 15.4 Contrato con spinus-consola

No cambia ninguna columna, vista ni función de `public`. La consola usa su
propia credencial; si alguna vez hiciera TRUNCATE de `audit_log` (no debe),
ahora fallaría.

### 15.5 Orden de despliegue y tolerancia

| Migración | Orden | Sin la migración |
|---|---|---|
| `20261125170000` | cualquiera; puede ir sola y la primera | Todo igual: ningún código hace TRUNCATE. Sólo sigue abierto el hueco |

El código de la tanda M no necesita ninguna migración nueva: con la base de la
tanda L, y con la v2 apagada o las tablas ausentes, se comporta como la tanda L
(las ramas lo comprobaron en sus áreas; la batería de la integración corrió con
la migración aplicada, y nada de la app ni de las pruebas toca TRUNCATE).

### 15.6 Tablas de `public` con TRUNCATE para `anon`, `authenticated` o `service_role`

Después de la migración, en la base local (`has_table_privilege`, tablas `r` y
`p` de `public`): **30 de 44**. Las que guardan datos de pacientes, en
**negrita**. Sin negrita pero sensibles: `google_tokens`,
`clinica_conexiones_google` e `invitaciones` guardan credenciales o datos del
médico, no del paciente. **No se tocó ninguna** (el encargo: «no lo extiendas a otras
tablas»).

| Tabla | anon | authenticated | service_role |
|---|---|---|---|
| **addendums** (contenido de la nota) | sí | sí | sí |
| agenda_ajustes | — | — | sí |
| analitos_catalogo | sí | sí | sí |
| **appointments** (paciente_id) | sí | sí | sí |
| **calculadora_resultados** (paciente_id, resultado) | sí | sí | sí |
| **casos_clinicos** (paciente_id, descripción) | sí | sí | sí |
| **casos_clinicos_recursos** (imágenes y anotaciones de los casos) | sí | sí | sí |
| cat_cie10 | sí | sí | sí |
| clinica_conexiones_google | sí | — | sí |
| clinicas | sí | sí | sí |
| **consultas** | sí | sí | sí |
| consultorios | sí | sí | sí |
| **documentos** | sí | sí | sí |
| **firmas_documento** (trazo de la firma; tiene su propio disparador contra TRUNCATE) | sí | — | sí |
| folios_contador | sí | sí | sí |
| google_tokens | sí | sí | sí |
| invitaciones | sí | sí | sí |
| ip_rate_limits | sí | sí | sí |
| medicamentos | sí | sí | sí |
| **mediciones_analitos** (paciente_id, valor) | sí | sí | sí |
| **paciente_medico** | sí | sí | sí |
| **pacientes** | sí | sí | sí |
| pdf_jobs (el resultado puede ser un PDF de un paciente: dudosa) | sí | sí | sí |
| plantillas_documento | sí | sí | sí |
| plantillas_honorarios | sí | sí | sí |
| profiles | sí | sí | sí |
| rate_limits | sí | sí | sí |
| **solicitudes_arco** (paciente_id) | sí | sí | sí |
| stripe_webhook_events | sí | sí | sí |
| tipos_cita | — | — | sí |

Las tablas de la agenda con datos de pacientes (`reserva_*`,
`cita_confirmaciones`, `cita_correos`, `avisos_clinica`, `agenda_bloqueos`,
`gcal_*`) no aparecen: sus migraciones ya revocaron TRUNCATE.

### 15.7 Hallazgos

- **M-M1 · Auditoría independiente** (sonnet, sólo lectura, con
  `supabase/AUDITORIA-MIGRACIONES.md`): **APTA**, sin hallazgos graves.
  - Aplicado: el post-vuelo antes del `COMMIT` (un REVOKE sólo quita lo que
    concedió quien lo ejecuta; con otro otorgante pasaría sin efecto).
  - Anotados sin cambiar: el mensaje dice «UPDATE ni DELETE» ante un TRUNCATE
    (lo pide el encargo); el recuento de la prueba en READ COMMITTED da un
    falso rojo, nunca un falso verde, si alguien inserta a la vez.
  - Propone una **dimensión 19** para `AUDITORIA-MIGRACIONES.md`, «otorgante
    del privilegio que se revoca» (mirar `aclexplode(relacl)` y su `grantor`, y
    abortar antes del `COMMIT` con `has_table_privilege`). **No se añadió:** ese
    archivo no lo edita la integración. Queda para Angel.
- **M-M2 · `replica` salta los tres disparadores de `audit_log`** (§15.2).
- **M-M3 · Sin reinicio, el conjunto desde cero no se volvió a probar** (§15.1).
- **Revisor del §15** (sonnet, contra la migración, la prueba, la guarda, el
  `git log` y el catálogo): APTA con cambios, todos de redacción. Pedía MAINTAIN
  en la lista de privilegios que siguen, la hora del recuento, que la ACL de la
  función no se toca sea cual sea, y señalar `google_tokens`,
  `clinica_conexiones_google` e `invitaciones` como sensibles sin ser de
  pacientes. Aplicados. Confirmó una por una las 30 filas de la §15.6.
