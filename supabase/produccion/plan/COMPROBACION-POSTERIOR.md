# Comprobación posterior — que producción quedó IDÉNTICA al ensayo

> Paso 7 de `PLAN-DE-APLICACION.md` (con el orden «código primero»: el código
> nuevo ya está desplegado desde el paso 4), al día con las 9 migraciones y con la foto
> real de producción (agente QL, 2026-11-22). Los comandos de §0 son los del
> ensayo de punta a punta, que se corrió así sobre un clon nuevo de la foto
> [C]. **Todo es de sólo lectura**: la única conexión a producción es la de
> `foto-produccion.sh` y la de `catalogo-despues.sql` (`BEGIN TRANSACTION READ
> ONLY` + `ROLLBACK`).

Carpetas (todas fuera del repo, 700):

| Carpeta | Qué hay | Cuándo nace |
|---|---|---|
| `~/spinus-produccion-foto/` | la foto del ensayo (2026-11-22) y los registros de `aplicar.sh` en `aplicacion-<fecha>/` | ya existe |
| `~/spinus-produccion-foto-antes/` | la foto «antes» de producción, tomada el día | paso 2 del plan |
| `~/spinus-produccion-ensayo/` | el ensayo sobre el clon: `clon-antes.jsonl`, `clon-despues.jsonl`, `difs-antes-despues.tsv`, `referencia.claves` | §0, antes del día |
| `~/spinus-produccion-foto-despues/` | la foto «después» de producción | §1, el día |

---

## 0. Antes del día: el ensayo sobre un clon de la foto

Fija las referencias contra las que se compara producción. Se repite si el día
la foto «antes» (paso 2 del plan) no sale idéntica a la del ensayo. Un solo
contenedor, y se borra al terminar.

```bash
free -h    # con menos de 5 GB disponibles, esperar
ESPERADAS=scripts/produccion/esperadas-clon.tsv \
  bash scripts/produccion/clonar-desde-foto.sh ~/spinus-produccion-foto spinus-ensayo-prod 54330
# contraseña LOCAL del clon (no es la de producción; el clon no tiene datos)
docker exec -i spinus-ensayo-prod psql -X -q -U supabase_admin -d postgres -c "ALTER ROLE postgres PASSWORD 'postgres'"

mkdir -p ~/spinus-produccion-ensayo && chmod 700 ~/spinus-produccion-ensayo
scripts/produccion/comparar-estructura.sh --extraer contenedor:spinus-ensayo-prod > ~/spinus-produccion-ensayo/clon-antes.jsonl

# las 9, con el MISMO script del día, en modo ensayo (contraseña: postgres)
APL_HOST=127.0.0.1 APL_PUERTO=54330 APL_USUARIO=postgres APL_SSL=disable APL_RED=host \
  APL_DESTINO=$HOME/spinus-produccion-ensayo/aplicacion bash supabase/produccion/plan/aplicar.sh aplicar

scripts/produccion/comparar-estructura.sh --extraer contenedor:spinus-ensayo-prod > ~/spinus-produccion-ensayo/clon-despues.jsonl
scripts/produccion/comparar-estructura.sh --silencioso --etiquetas antes,despues \
  --tsv ~/spinus-produccion-ensayo/difs-antes-despues.tsv \
  ~/spinus-produccion-ensayo/clon-antes.jsonl ~/spinus-produccion-ensayo/clon-despues.jsonl
cut -f1-5 ~/spinus-produccion-ensayo/difs-antes-despues.tsv | sort > ~/spinus-produccion-ensayo/referencia.claves
docker rm -f spinus-ensayo-prod
```

Lo que tiene que salir (salió así en el ensayo [C]):

- el clon: `14 diferencias (14 esperadas, 0 inesperadas)` (los avisos de dos
  esperadas que no aparecen son normales con la foto real);
- `aplicar.sh`: `Las 9 aplicadas y registradas.`; rejillas iguales a
  `rejillas-del-ensayo.txt` (63 OK, 10 INFO, 0 REVISAR). Con el guion nuevo
  (cada archivo en una petición, desde la oleada 3, ronda 1) cada `*.salida.txt`
  empieza además por la línea «sesión: idle_in_transaction_session_timeout=10s,
  lock_timeout=5s, statement_timeout=2min»; las rejillas salieron idénticas
  [C-CA];
- el comparador: `Resumen: 2629 objetos en antes, 3503 en despues; 958
  diferencias` (`exit 1`, normal: no se le dan esperadas). Sus claves son las de
  `diferencias-antes-despues.clon-foto.tsv` de esta carpeta (comprobado: tres
  corridas sobre clones nuevos, mismas claves). La referencia del día es
  `referencia.claves`.

Lo que el clon no ensaya: datos (el backfill de F1 pasa por construcción con 0
consultorios) ni la latencia del pooler. Con datos sintéticos del tamaño real
(18 consultorios, 247 citas) lo midió el agente PL: `PLAN-DE-APLICACION.md`
§5.1 (las 9 sin REVISAR, 18 consultorios respaldados).

---

## 1. El día: la foto «después»

Después de que `aplicar.sh aplicar` termine en verde:

```bash
FOTO_DESTINO=$HOME/spinus-produccion-foto-despues bash scripts/produccion/foto-produccion.sh
```

Pide la contraseña (como la foto «antes»). Tiene que acabar en `Foto completa en
…` y en `Sin datos: ningún INSERT, COPY con filas, setval con valor ni objeto
grande.`

## 2. (a) Antes ↔ después: cambió exactamente el conjunto

```bash
scripts/produccion/comparar-estructura.sh --silencioso --etiquetas antes,despues \
  --tsv ~/spinus-produccion-foto-despues/difs-antes-despues.tsv \
  ~/spinus-produccion-foto-antes/05-catalogo.jsonl ~/spinus-produccion-foto-despues/05-catalogo.jsonl
cut -f1-5 ~/spinus-produccion-foto-despues/difs-antes-despues.tsv | sort \
  | diff ~/spinus-produccion-ensayo/referencia.claves - && echo "IGUAL QUE EL ENSAYO"
```

- El comparador sale con `exit 1` y **958 diferencias** (o las del ensayo del §0
  si se repitió con otra foto).
- **El `diff` tiene que salir vacío y escribir `IGUAL QUE EL ENSAYO`.** Una línea
  `<` es algo que el ensayo cambió y producción no; una `>`, algo que cambió en
  producción y no en el ensayo. Cualquiera: no se enciende nada y se investiga
  (el código nuevo ya está desplegado y sigue sirviendo con la v2 apagada).
- Comparan foto con foto (las dos de `foto-produccion.sh`), así que las 14
  diferencias foto ↔ clon no aparecen aquí.

## 3. (b) Producción después ↔ ensayo después

```bash
scripts/produccion/comparar-estructura.sh --silencioso --etiquetas produccion,ensayo \
  --esperadas scripts/produccion/esperadas-clon.tsv \
  ~/spinus-produccion-foto-despues/05-catalogo.jsonl ~/spinus-produccion-ensayo/clon-despues.jsonl
echo "salida: $?"
```

- Tiene que acabar en `0 inesperadas` y `salida: 0`: sólo las 14 diferencias
  foto ↔ clon de `esperadas-clon.tsv` (configuración de roles y de la base que
  `pg_dump` no vuelca, y tres CHECK con otro deparseo). No se añade ninguna
  esperada el día: una diferencia nueva es un hallazgo. (En el ensayo, foto
  ↔ clon después dio 972 = 958 + 14, el mismo cálculo.)

## 4. El historial

```bash
bash supabase/produccion/plan/aplicar.sh estado
```

Tiene que listar, en este orden, exactamente 14 versiones, y las 9 como «ya
registrada»:

```
20260912190416
20260913
20260914
20260919
20260919230000
20261125170000
20261126120000
20261201120000
20261201130000
20261201140000
20261201150000
20261201160000
20261201170000
20261201180000
```

Las cuentas de `estado` (citas, consultorios, clínicas): las del paso 3 del plan
más lo que la app haya creado entretanto; `audit_log`, mayor o igual: como
mínimo + el número de consultorios (una fila UPDATE `system` por consultorio
del backfill de F1).

## 5. El catálogo, en producción (sólo lectura)

```bash
read -rs PGPASSWORD; export PGPASSWORD
docker run --rm -i -e PGPASSWORD public.ecr.aws/supabase/postgres:17.6.1.167 psql -X -q -v ON_ERROR_STOP=1 -P pager=off \
  "host=aws-0-us-west-2.pooler.supabase.com port=5432 user=postgres.qpnegmmpneseirfyplbf dbname=postgres sslmode=require" \
  -f - < supabase/produccion/plan/catalogo-despues.sql
```

Tiene que dar (valores del ensayo [C]; los que dependen de datos, marcados):

| Fila | Valor |
|---|---|
| versiones en el historial | 14 |
| las 9 registradas | 9 |
| tablas nuevas de la agenda en public (de 15) | 15 |
| respaldo de F1 existe | true |
| tablas de public sin RLS (de las 15 nuevas) | 0 |
| tablas de public y respaldos con TRUNCATE para los tres roles | 0 |
| disparadores BEFORE TRUNCATE con `prohibir_truncate()` | 22 (11 de la nº 2 + 11 de T) |
| `prevent_audit_truncate` en `audit_log` | 1 |
| disparadores de `appointments`, habilitados / total | 12 / 12 (en la foto, antes: 0) |
| columnas de `appointments` | 45 (16 nuevas) |
| índices de `appointments` inválidos | 0 |
| funciones de public (sin las de extensiones) | 112 (47 de antes + 65) |
| funciones nuevas ejecutables por PUBLIC | 0 |
| funciones / relaciones de public con dueño distinto de `postgres` | 0 / 0 |
| `agenda_ajustes`: filas / con la v2 encendida | 0 / 0 |
| consultorios con `horario_propio = false` | 0 |
| consultorios / filas del respaldo | **datos**: iguales (salvo consultorios creados después de F1) |
| privilegios por omisión de postgres en public con TRUNCATE | 0 |
| md5 normalizado de las dos puertas | `a2dcfa8f2cfda91bc9c7a7ff7b642e1e` / `2efd7734772dd4c7bea262e43a3779b5` (no cambian) |

`unset PGPASSWORD` al terminar.

## 6. Las rejillas

En `~/spinus-produccion-foto/aplicacion-<fecha>/` queda un `*.salida.txt` por
archivo. Ninguna fila `REVISAR`:

```bash
grep -l 'REVISAR *$' ~/spinus-produccion-foto/aplicacion-*/2026*.salida.txt || echo "ninguna REVISAR"
```

Y cada una con las filas de `rejillas-del-ensayo.txt`. Los números de las INFO
son los de producción (en particular, la fila 2 de la nº 2 tiene que listar
**28 tablas**, las del inventario de su reversa; y la de consultorios
respaldados de F1, todos los consultorios).

## 7. Humo con la v2 APAGADA (Angel, con su cuenta)

La app de siempre tiene que seguir igual. Sin datos de pacientes reales en
ningún registro: sólo «sí/no» y cuentas. Se hace **después de aplicar las 9**
(paso 6 del plan), con el código nuevo ya desplegado (paso 4). La versión corta
de esto con la base vieja es el paso 5 del plan.

Antes de empezar, una marca de tiempo (sólo lee):

```bash
read -rs PGPASSWORD; export PGPASSWORD
docker run --rm -e PGPASSWORD public.ecr.aws/supabase/postgres:17.6.1.167 psql -X -At \
  "host=aws-0-us-west-2.pooler.supabase.com port=5432 user=postgres.qpnegmmpneseirfyplbf dbname=postgres sslmode=require" \
  -c "select clock_timestamp()"
```

1. **Entrar y `/inicio`**: entra con su cuenta, ve su inicio. Cerrar sesión y
   volver a entrar (sin bucles de recarga).
2. **Agenda**: abre en la vista de siempre. **No** aparecen el engrane de
   configuración v2, la campana ni el candado.
3. **Un evento sin paciente** («Prueba aplicación», en un hueco libre de la
   semana siguiente): crearlo, arrastrarlo a otra hora y borrarlo.
4. **Un expediente** de un paciente de prueba (o la cuenta demo): abre, se ven
   sus consultas y documentos.
5. **Búsqueda de pacientes en «Agendar»** (código nuevo; usa `imatch` de
   PostgREST): dos palabras de un paciente de prueba; lo encuentra y la consola
   del navegador no tiene un 400.
6. **Tareas de Vercel**: Schedules → Cron Jobs → View Logs de `google-sync` y
   `recordatorios`: la primera invocación tras el despliegue responde 2xx, no 401.
7. **La auditoría de citas está viva** (lo único nuevo con la v2 apagada), con
   la marca de arriba:

   ```sql
   select tabla, accion, count(*) from public.audit_log
   where tabla = 'appointments' and created_at >= '<marca>' group by 1, 2;
   ```

   Salen las filas del alta, el movimiento y el borrado del punto 3.
8. **Nadie tiene la v2 encendida**:
   `select count(*) filter (where agenda_v2_encendida), count(*) from public.agenda_ajustes;` → `0|0`.

`unset PGPASSWORD` al terminar.

## 8. Dónde mirar si algo falla en el servidor

**No hay Sentry de servidor**: el repo sólo tiene `instrumentation-client.ts`
(Sentry del navegador); no existe `instrumentation.ts` (comprobado: no está ni
en la raíz ni en `src/`). Los fallos de las rutas de la agenda (`/api/reservar/*`,
`/api/confirmar/*`, `/api/cron/*`, `/api/appointments/*`, `/api/agenda/*`) y
de lo que corre en `after()` **sólo quedan en el registro de Vercel**: Project →
Logs (filtrar por la ruta y por nivel `error`) y, para las tareas, Schedules →
Cron Jobs → View Logs. Ahí se mira tras el humo del §7 y en los días
siguientes. Los mensajes de la agenda no llevan datos de pacientes (regla del
proyecto), pero el registro de Vercel no pasa por el filtro PII de Sentry: no
copiar líneas de él a ningún documento sin mirarlas.

Si algo de §2–§8 falla: no se enciende nada; se apunta qué (sin datos de
pacientes) y se decide entre arreglar o revertir (`PLAN-DE-APLICACION.md` §8 y
§10).

---

## 9. Al terminar

- `~/spinus-produccion-foto-despues/` y `~/spinus-produccion-ensayo/` se quedan
  (estructura, sin datos) hasta cerrar la fase; luego se borran.
- El respaldo cifrado del paso 1b del plan: `shred -u` a los 7 días si nada lo
  necesitó.
- La línea `-- ESTADO · PRODUCCIÓN` de los 9 archivos, con la fecha y la
  comprobación (las de §2–§6), en un commit (`AUDITORIA-MIGRACIONES.md` §7).

---

## 10. Comprobación periódica: que el ajuste de privilegios por omisión sigue ahí

Lo pidió el auditor (`../auditoria/RONDA-1.md`, «Juicio sobre la sección
4-bis»): la nº 2 (`20261126120000`) quita TRUNCATE a `anon`, `authenticated` y
`service_role` en los privilegios por omisión de `postgres` en `public`, y nada
vigila que siga así (`DEUDA_TECNICA.md` AG-DT-270; dónde se corre de forma
automática lo decide Angel). Si la plataforma o alguien los repone, la siguiente tabla
nace con TRUNCATE y no se nota hasta volver a correr la nº 2. **Sólo lee.** Se
corre el día de la aplicación (tras el §5), y después **una vez al mes** y tras
cualquier cambio de la plataforma o migración nueva:

```bash
read -rs PGPASSWORD; export PGPASSWORD
docker run --rm -i -e PGPASSWORD public.ecr.aws/supabase/postgres:17.6.1.167 psql -X -q -v ON_ERROR_STOP=1 -P pager=off \
  "host=aws-0-us-west-2.pooler.supabase.com port=5432 user=postgres.qpnegmmpneseirfyplbf dbname=postgres sslmode=require" <<'SQL'
BEGIN TRANSACTION READ ONLY;
SELECT 1 AS n, 'tablas de public con TRUNCATE para anon/authenticated/service_role' AS que,
       (SELECT count(DISTINCT c.oid) FROM pg_class c CROSS JOIN (VALUES ('anon'),('authenticated'),('service_role')) r(rol)
         WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r','p','f')
           AND has_table_privilege(r.rol, c.oid, 'TRUNCATE'))::text AS valor, '0' AS esperado
UNION ALL SELECT 2, 'privilegios por omisión de postgres en public con TRUNCATE para los tres roles',
       (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
         WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'
           AND a.privilege_type = 'TRUNCATE' AND a.grantee IN ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))::text, '0'
UNION ALL SELECT 3, 'privilegios por omisión GLOBALES (sin esquema) de postgres con TRUNCATE para los tres roles',
       (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
         WHERE d.defaclrole = 'postgres'::regrole AND d.defaclnamespace = 0 AND d.defaclobjtype = 'r'
           AND a.privilege_type = 'TRUNCATE' AND a.grantee IN ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))::text, '0'
UNION ALL SELECT 4, 'disparadores BEFORE TRUNCATE con prohibir_truncate(), habilitados',
       (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal AND tgfoid = to_regprocedure('public.prohibir_truncate()') AND tgenabled = 'O')::text, '22'
UNION ALL SELECT 5, 'INFO · privilegios por omisión de supabase_admin en public con TRUNCATE para los tres (límite conocido de la nº 2)',
       (SELECT count(*) FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a
         WHERE d.defaclrole = 'supabase_admin'::regrole AND d.defaclnamespace = 'public'::regnamespace AND d.defaclobjtype = 'r'
           AND a.privilege_type = 'TRUNCATE' AND a.grantee IN ('anon'::regrole,'authenticated'::regrole,'service_role'::regrole))::text, '—';
ROLLBACK;
SQL
unset PGPASSWORD
```

En el clon de la foto con las 9 aplicadas salió [C, agente CA, 2026-11-22]:
`0 | 0`, `0 | 0`, `0 | 0`, `22 | 22` y la INFO en `3` (las tablas que cree
`supabase_admin` nacen con TRUNCATE: es el límite que la propia nº 2 describe).
**Si la 1, la 2 o la 3 no dan 0:** no se cambia nada a mano; se anota y se
decide con el coordinador (volver a correr la nº 2 la repone: su segunda pasada
no cambia nada más). La 4 en menos de 22 significa que alguien quitó un
disparador contra TRUNCATE (de la nº 2 o de T): igual.
