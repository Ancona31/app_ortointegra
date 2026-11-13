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

Efecto sobre las comprobaciones del §3: tres funciones nuevas sin PUBLIC
(`cita_proteger_borrado` y `cita_proteger_reserva`, de disparador, con los
tres roles; `reserva_enlace_emitir`, sólo `service_role`, que se suma a la
lista del caso 3 de `p1_permisos_funciones.sql` al fusionar, H2); dos
disparadores BEFORE nuevos en `appointments` (fila 6 ya no son «todos
AFTER»); `proteger_reserva_enlaces` reemplazada con la misma firma y grants;
ninguna policy, ninguna FK ni ningún permiso de tabla cambian. Detalle en
`mejora_agendaV2.md` §6-bis, «Correcciones de seguridad en la base tras la
revisión independiente».
