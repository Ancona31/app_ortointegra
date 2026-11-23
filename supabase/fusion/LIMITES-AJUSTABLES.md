# `feature/limites-ajustables`: estado y cómo entra en el conjunto (bloque 4.3)

> Agente I, 2026-11-22. Sólo lectura: `git fetch origin`, `git log`, `git
> show`, `git merge-tree` (que no toca ninguna rama) y una copia de la rama con
> `git archive` en un directorio temporal, para correr Vitest. No se mezcló ni
> se tocó la rama.

## 1. De dónde nace y qué trae

| Dato | Valor | Base |
|---|---|---|
| Punta remota | `e76973cd` | comprobado (`git log origin/feature/limites-ajustables`) |
| Nace de | `a58419fb` (`docs(auth): cerrar la re-auditoria de auth 02 — APTA`), commit de `main` | comprobado (`git merge-base`) |
| ¿Avanzó `main` desde entonces? | Sí, **1 commit**: `95cb5781 chore(skills): añade el skill apple-design`, sin relación con esta rama | comprobado |
| ¿Choca al mezclarla con `feature/agenda-v2-produccion`? | **No:** `git merge-tree --write-tree HEAD origin/feature/limites-ajustables` da un árbol limpio, sin conflictos | comprobado |
| `scripts/pruebas-sql.sh` | Idéntico en las dos ramas (`git diff` vacío): la agenda ya lo trae | comprobado |

**Los cinco commits** (de abajo arriba):

| Commit | Qué hace | Archivos |
|---|---|---|
| `786d3553` | **P1:** quita EXECUTE a PUBLIC en las 34 funciones de `public` que lo tenían, lo da a `anon`/`authenticated`/`service_role` y añade `ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC` (global, sin `IN SCHEMA`). Concede `handle_new_user()` a `supabase_auth_admin`. Añade la regla «Permisos de funciones» a `CLAUDE.md` | `20261014120000_revocar_execute_public.sql`, `p1_permisos_funciones.sql`, `scripts/pruebas-sql.sh`, `CLAUDE.md` |
| `e38e5c99` | **P1b:** reasienta los permisos de 7 funciones SECURITY DEFINER a los de producción (`alta_conexion_google`, `enforce_limite_documentos_paciente`, `generar_folio`, `guardar_secretos_conexion`, `leer_conexion_google_con_secretos`, `sync_antropometria_paciente`, `trg_mediciones_antropometria`). En las cuatro `sa_*` cambia `auth.role() <> 'service_role'` por `IS DISTINCT FROM`: sin claims, el candado se abría | `20261014130000_reasentar_permisos_funciones.sql`, `p1b_permisos_funciones.sql`, caso 3 de `p1` |
| `40b5e309` | `pruebas-sql.sh`: `LC_ALL=C` y `-o /dev/null` | `scripts/pruebas-sql.sh` |
| `c3baa781` | **P2:** columnas `clinicas.ajuste_max_medicos`, `ajuste_medicos_hasta`, `ajuste_max_secretarias` y `ajuste_secretarias_hasta`, con 4 CHECK. Función `limite_efectivo(integer, integer, timestamptz)` (sql, STABLE, INVOKER). Disparador `trg_clinicas_proteger_ajustes` (`proteger_ajustes_clinica()`, INVOKER: sólo `postgres`/`supabase_admin` cambian `ajuste_*`). Sección «Contrato con spinus-consola» en `CLAUDE.md` | `20261014140000_limites_ajustables.sql`, `p2_limite_efectivo.sql`, `CLAUDE.md` |
| `e76973cd` | **P3:** Invitar, Usuarios y Facturación piden el límite a la base (`rpc('limite_efectivo')`), nunca a `PLAN_LIMITS`. Funciones puras `puedeAgregar`, `mensajeLimite` y `textoLimite` | `src/app/api/admin/invitar/route.ts`, `src/app/api/admin/usuarios/route.ts`, `src/app/(app)/admin/usuarios/page.tsx`, `src/app/(app)/billing/page.tsx`, `src/lib/limitesUsuarios.ts`, `src/lib/tests/limitesUsuarios.test.ts`, `p3_limite_efectivo_clinica.sql` |

En total, 15 archivos, +1410 −45.

## 2. ¿Pasan sus pruebas?

- **Vitest, comprobado.** Sobre una copia de la rama (`git archive`), con
  `node_modules` enlazado al del repo principal:
  - `src/lib/tests/limitesUsuarios.test.ts`: **20/20 en verde**;
  - la batería entera de la rama: **35 archivos, 700/700 en verde**
    (6,9 s).
- **`tsc --noEmit`, comprobado.** Los únicos errores son `Cannot find name
  'RouteContext'` (y sus hermanos `PageProps`/`LayoutProps`), tipos que
  genera `next typegen` en `.next/types` y que la copia no tiene. Son del
  entorno, no de la rama. Filtrados esos, **0 errores**.
- **Pruebas SQL (`p1`, `p1b`, `p2`, `p3`): NO las corrí.**
  - Necesitan una base con las tres `20261014…` aplicadas, y la local
    compartida no las tiene. Comprobado:
    - `schema_migrations` acaba en las 50 de la agenda;
    - `limite_efectivo` no existe;
    - siguen con PUBLIC las 34 funciones de `main` que P1 cierra.
  - Aplicarlas ahí, o hacer `db reset`, cambiaría la base que usan los
    otros agentes.
  - **Qué necesitarían:** una base aparte (otro proyecto de Supabase local u
    otro contenedor) con `main` + las tres `20261014…`, y
    `scripts/pruebas-sql.sh`. Todas abren su propia transacción y terminan en
    `rollback`. `p2` y `p3` crean sus clínicas y usuarios de prueba con ids
    fijos (`…0000c3`).
  - **Lo que dice la documentación, no comprobado por mí:**
    `AUDITORIA-CONJUNTO-AGENDA-V2.md` §13.5 cuenta una reconstrucción local
    con las 45 de la agenda de entonces más las tres `20261014*`, en la que
    «pasan las 43 pruebas SQL de la combinada: p1, p1b, p2, p3 y las 39 del
    proyecto», con la lista del caso 3 ya sustituida.

## 3. Cómo se combina con la agenda

### 3.1 Las dos puertas que lee la puerta S3 de Google

Comprobado leyendo las tres migraciones: **ninguna cambia
`clinica_tiene_acceso()` ni `clinica_no_suspendida()`.**

- El paso [3/4] de P1 les cambia los PERMISOS (les quita PUBLIC y da EXECUTE
  a los tres roles), no el cuerpo. Su `prosrc` sigue igual: md5 a2dcfa8f /
  2efd7734 en el catálogo local.
- Por eso no se rompen:
  - `gcal_sync_clinica_habilitada`, que lee su FORMA;
  - el pre-vuelo de c1 (forma);
  - el de e1/e6 (md5 normalizado 588de29d);
  - el post-vuelo de k1 (md5 exactos).
- Ninguna comprobación de la agenda mira el ACL de esas dos funciones. Las
  que miran `aclexplode(...) grantee = 0` lo hacen sobre funciones de la
  AGENDA, para comprobar que no tengan PUBLIC, y eso con P1 se sigue
  cumpliendo.
- El caso 6 de `p1` exige que los tres roles ejecuten las dos puertas, y es
  lo que deja P1.

### 3.2 La lista del caso 3 de `p1_permisos_funciones.sql`

El caso 3 lista las funciones de `public` que NO ejecutan los tres roles. En
la rama tiene las 10 de producción.

Comprobado en la base local (sin P1/P1b):

- hoy esa lista tiene **44 funciones**: 41 de la agenda y 3 de `main`
  (`crear_paciente_con_medico`, `rate_limit_intento`, `rate_limit_reset`);
- P1b cierra además las 7 suyas en una base reconstruida.

**Total en la base combinada: 51.** Coincide con `CLAUDE.md` («51
funciones»): la lista de 50 de §13.5 de la auditoría del conjunto más
`cita_nombre_saludo(uuid,uuid)`.

Al fundir, la lista cambia con la fusión:

| Decisión de la fusión (INVENTARIO §4) | Lista del caso 3 |
|---|---|
| Se recrea todo tal cual | 51 |
| No se recrea `reserva_enlace_regenerar_fijo` | 50 |
| … ni `cita_correos_pendientes` | 49 |
| … ni `reserva_enlace_emitir` de 7 argumentos (exige tocar el código) | 48 |

**Quien funda tiene que pegar la lista final en el caso 3, en el mismo
commit.** Si no, `p1` da rojo en la combinada; con la lista de la rama da rojo
seguro.

### 3.3 Los privilegios por omisión

P1 [4/4] es global para el rol `postgres`, así que toda función que se cree
después nace sin PUBLIC.

- **Va antes que el conjunto fundido** por fecha (`20261014` <
  `20261201…`), así que el conjunto se aplicará ya con esa regla.
- **No cambia nada de la agenda:** las 66 funciones hacen REVOKE/GRANT
  explícito. Comprobado: en el catálogo, ninguna de la agenda tiene PUBLIC, y
  las de disparador tienen los tres roles.
- **Sí afecta a las pruebas SQL de la agenda** que crean funciones en
  `pg_temp` y las llaman con otro rol: necesitan GRANT explícito (ya lo dice
  `CLAUDE.md`).

### 3.4 `clinicas`

- P2 añade 4 columnas, 4 CHECK y el disparador `trg_clinicas_proteger_ajustes`
  (BEFORE INSERT OR UPDATE, sólo mira `ajuste_*`).
- La agenda añade `clinicas.timezone` (k3, F1) y lee `horario_consulta`.

No se pisan:

- ningún objeto de la agenda nombra `ajuste_*` ni `limite_efectivo`;
- `PUT /api/me/horario`, que escribe `timezone` con `createAdminClient`
  (`service_role`), no toca `ajuste_*`, así que el disparador de P2 lo deja
  pasar (rama `UPDATE` sin cambios en `ajuste_*`). Esto último es
  **deducido** del cuerpo de `proteger_ajustes_clinica()`; no lo probé.

## 4. Lo que le falta

1. **Auditoría de sus tres migraciones contra `supabase/AUDITORIA-MIGRACIONES.md`**
   (regla de `CLAUDE.md`: ninguna migración se aplica sin pasar por ella).
   Comprobado leyendo los archivos:
   - **ESTADO.** Las cabeceras dicen «ESTADO · LOCAL: PENDIENTE DE APLICAR» y
     «PRODUCCIÓN: PENDIENTE DE APLICAR», aunque §13.5 de la auditoría del
     conjunto las aplicó en una reconstrucción local.
   - **Sin auditoría independiente anotada,** a diferencia de las de la
     agenda.
   - **Sin `BEGIN`/`COMMIT`** (dimensión 2, atomicidad). ASUMIENDO QUE se
     aplicarían con `supabase db push`, que envuelve cada archivo en una
     transacción: no lo verifiqué. Por el SQL Editor quedarían a medias si
     fallan a mitad.
   - **Sin `lock_timeout`** (dimensión 6). P2 hace `ALTER TABLE clinicas ADD
     COLUMN …, ADD CONSTRAINT …` y `CREATE TRIGGER` con ACCESS EXCLUSIVE /
     SHARE ROW EXCLUSIVE sobre `clinicas`, una tabla que lee toda petición
     autenticada.
   - **Sin rejilla de veredicto ni post-vuelo** (dimensiones 5 y 18). P1 y
     P1b tienen pre-vuelo; P2 no tiene ninguno.
   - **Sin «vuelta atrás»** documentada (dimensión 7).
   - **Sin fila en la tabla de §7.1** de `mejora_agendaV2.md` (regla
     «cada migración nueva añade su fila»; aquí son de otra rama, pero el
     conjunto combinado las necesita).
2. **La lista del caso 3 de `p1`** sigue con las 10 de producción. Al
   combinar con la agenda hay que pegar la final (§3.2).
3. **Documentación del plan.**
   - Las cabeceras y las pruebas citan «el plan» (§2, §5 P1, §7.2 F5, R6, P6:
     «el conteo … lo usará P6»), y ese plan no está en el repo. Comprobado:
     ningún `.md` de la rama nombra `limite_efectivo` salvo `CLAUDE.md`.
   - **No determinado:** si P4–P6 forman parte de esta rama, o vienen
     después. Si forman parte, la rama está a medias.
4. **Incoherencia de texto en `CLAUDE.md` de la rama.** La sección «Contrato
   con spinus-consola» describe RN-1 de `clinica_tiene_acceso()` como «VIP, o
   suscripción activa, o nunca tuvo premium, **o 5 pacientes o menos contando
   los dados de baja**». El cuerpo vigente (catálogo local) no tiene la
   condición de los 5 pacientes: es VIP, o Stripe activo, o
   `ha_tenido_acceso_premium IS NOT TRUE`. O el texto se adelanta a un cambio
   de la consola, o está mal. Hay que aclararlo antes de que entre en
   `CLAUDE.md`. Comprobado el cuerpo; la intención, no.
5. **Código:**
   - Sin TODO ni FIXME (comprobado en el diff).
   - Las rutas nuevas usan `createAdminClient()` filtrado por
     `profile.clinica_id` (`.eq('id', profile.clinica_id)`), como pide el
     pendiente prioritario de aislamiento.
   - `GET /api/admin/usuarios` ya no comprueba `if (profile.clinica_id)`
     antes de leer `clinicas`. Con `clinica_id` nulo, la consulta no
     devuelve nada y `licencia` queda en null: no es una fuga, sólo un
     cambio de forma (deducido).

## 5. Veredicto

**NO COMPLETA para entrar al conjunto tal como está.**

- **El código y las pruebas funcionan:**
  - Vitest 700/700;
  - tipos limpios;
  - mezcla sin conflictos;
  - no toca las puertas que lee S3.
- **Lo que falta es lo que exige el proyecto para aplicar una migración:**
  1. auditoría de las tres `20261014…` contra `AUDITORIA-MIGRACIONES.md`
     (transacción, `lock_timeout`, rejilla, vuelta atrás, ESTADO al día);
  2. la lista del caso 3 de `p1` pegada con el valor final de la fusión
     (51 si no se quita nada; 48–50 según §3.2);
  3. correr `p1`, `p1b`, `p2` y `p3` en una base combinada y aislada (no la
     compartida);
  4. aclarar el texto de RN-1 en el «Contrato con spinus-consola», y si
     P4–P6 son parte de la rama.

Con 1–3 resueltos, puede entrar en el conjunto **antes** del bloque fundido,
por fecha: no cambia el orden propuesto en `MAPA-DE-DUENOS.md` §4.1.
