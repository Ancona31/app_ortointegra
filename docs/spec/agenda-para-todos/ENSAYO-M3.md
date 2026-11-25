# Agenda para todos — ensayo de M3 en el clon de producción

Para quien corra el ensayo en el equipo de Angel. Rama `feature/agenda-para-todos`. Nada de aquí
toca producción; el guion se corre en MODO ENSAYO.

- **M3** `supabase/migrations/20261203120000_agenda_para_todos.sql` (riesgo medio; depende sólo de F1)

Qué hace y por qué: `REPASO-AUTOR-M3.md` (al lado). En una línea: la agenda v2 queda encendida en
todas las clínicas (DEFAULT, función común, una fila por clínica y un disparador en `clinicas` para
las que nazcan después).

> **Orden de despliegue: el CÓDIGO primero, M3 después.** Con el código de `main` (sin agenda v2) y
> M3 aplicada, borrar una cita con paciente daría error en todas las clínicas. Con el código nuevo y
> la base sin M3 no cambia nada para nadie.

## 0. Huellas (antes de nada)

```bash
sha256sum supabase/produccion/plan/aplicar.sh       # la del reporte de la entrega
sha256sum -c supabase/produccion/plan/huellas.sha256   # 25 líneas, todas OK
```

Las huellas de M3, de su reversa, de `aplicar.sh` y de `huellas.sha256` van en el reporte de la
entrega (no aquí: este archivo cambiaría con ellas). Si una no coincide, alto.

## 1. Qué cambió en el guion `aplicar.sh`

- `MIGRACIONES`: las 11 de antes + `20261203120000_agenda_para_todos`, al final. Con M1 y M2 ya
  registradas, `aplicar` sólo ofrece M3.
- `REVERSAS`: **M3 la primera**, luego M2, M1, T, F5b, F4, F2, F3, F5a, F1.
- Objeto testigo de M3: la función `public.agenda_ajustes_de_clinica_nueva()`.
- `reversa-previa.sql` NO cambió: la reversa de M3 no se niega por datos.

## 2. Conteos de sólo lectura (en PRODUCCIÓN, antes de aplicar; los corre Angel)

```bash
bash supabase/produccion/conteos/correr-conteos-agenda-para-todos.sh
```

Esperado: **0 ALTO**. Qué hacer con cada fila: `supabase/produccion/conteos/LEEME.md`, «Agenda para
todos (M3)». Los números que sólo salen de aquí (huecos de este documento):

| Fila | Qué dice | Valor en producción |
|---|---|---|
| B.1 | clínicas | _(pendiente)_ |
| B.2 | filas: total / encendidas / apagadas | _(pendiente)_ |
| B.3 | clínicas sin fila (las creará M3) | _(pendiente)_ |
| B.4 | filas apagadas que alguien tocó (¿a propósito?) | _(pendiente; esperado 0)_ |
| C.1 | clínicas con Google conectado: total / ya encendidas | _(pendiente)_ |
| C.3 | citas futuras con paciente que dejarán de poder borrarse | _(pendiente)_ |
| C.5 | citas viejas por las que se preguntará «¿Asistió?»: total / la clínica con más | _(pendiente)_ |

Contra el clon: `CONTEOS_HOST=127.0.0.1 CONTEOS_PUERTO=54373 CONTEOS_USUARIO=postgres
CONTEOS_SSL=disable CONTEOS_RED=host`.

## 3. El ensayo

Con el clon levantado y M1 y M2 ya aplicadas en él, desde la raíz del repo:

```bash
export APL_HOST=127.0.0.1 APL_PUERTO=54373 APL_USUARIO=postgres APL_SSL=disable APL_RED=host \
       APL_DESTINO="$HOME/spinus-produccion-ensayo/agenda-para-todos-$(date +%Y%m%d)"
bash supabase/produccion/plan/aplicar.sh estado     # M3 «pendiente»; las 11 «aplicada y registrada»
bash supabase/produccion/plan/aplicar.sh aplicar    # escribir 20261203120000
bash supabase/produccion/plan/aplicar.sh aplicar    # segunda pasada: no ofrece nada, «Las 12 aplicadas y registradas»
```

El clon no tiene datos: la rejilla dirá `ANTES: 0 / 0 / 0 / 0` y `DESPUÉS: 0 / 0 / 0`. Para ver el
relleno, sembrar antes de aplicar (como postgres; `clinicas` sólo exige `nombre`):

```sql
INSERT INTO public.clinicas (nombre) VALUES ('Ensayo uno'), ('Ensayo dos'), ('Ensayo tres');
INSERT INTO public.agenda_ajustes (clinica_id, agenda_v2_encendida)
SELECT id, false FROM public.clinicas WHERE nombre = 'Ensayo uno';
-- esperado en la rejilla: ANTES 3 / 1 / 0 / 2 · DESPUÉS 3 / 3 / 3
```

Y después de aplicar, una clínica nueva nace con su fila:

```sql
INSERT INTO public.clinicas (nombre) VALUES ('Ensayo cuatro');
SELECT agenda_v2_encendida, recordatorio_encendido, correo_reserva_clinica
  FROM public.agenda_ajustes a JOIN public.clinicas c ON c.id = a.clinica_id WHERE c.nombre = 'Ensayo cuatro';
-- esperado: t | f | f
```

## 4. Deshacer M3 (la reversa)

El guion exige, para TODA reversa de la agenda, la v2 apagada en todas las clínicas, y M3 la
enciende en todas. Con la v2 encendida, `reversa` se para ANTES de tocar nada y dice cuáles:

```
· previo: la v2 está ENCENDIDA en estas clínicas (apágala en TODAS antes de revertir): …
ALTO: la cadena de reversas NO empieza por lo de arriba. No se tocó nada (plan §10).
```

Para deshacerla:

```sql
-- 1. Como postgres. Apaga la agenda v2 en TODAS (es lo que de verdad devuelve la app a la agenda de antes).
--    Cada fila queda auditada (audit_agenda_ajustes). No borra nada.
UPDATE public.agenda_ajustes SET agenda_v2_encendida = false WHERE agenda_v2_encendida;
```

```bash
# 2. La reversa. Como desde M3 toda clínica tiene fila, la comprobación previa avisa de que la reversa
#    de F1 «perdería datos» (agenda_ajustes: N filas) y pide PERDER DATOS para SEGUIR CON LA CADENA.
#    Para deshacer SÓLO M3: escribir PERDER DATOS, luego REVERTIR 20261203120000, y cualquier otra
#    cosa en la pregunta siguiente (la de 20261202130000). La reversa de M3 no borra ni cambia filas.
bash supabase/produccion/plan/aplicar.sh reversa
bash supabase/produccion/plan/aplicar.sh estado     # M3 «pendiente»; ningún ALTO
```

```sql
-- 3. Si sólo una clínica debía seguir encendida (la de Angel), se vuelve a encender ella:
UPDATE public.agenda_ajustes SET agenda_v2_encendida = true WHERE clinica_id = '<id de la clínica>';
```

Tras 1 y 2 la base queda como antes de M3, con una diferencia: cada clínica tiene ya su fila
(apagada). Volver a aplicar M3 (`aplicar`) las enciende otra vez.

> En producción, apagar en todas con el código nuevo desplegado devuelve a todos a la agenda de
> siempre en la siguiente carga de página. Las citas, los bloqueos, los tipos y los avisos que se
> hayan creado con la v2 se quedan en la base; no se borra nada.

## 5. Rejillas esperadas

**M3** (11 filas; 8 OK y 3 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | agenda_ajustes.agenda_v2_encendida: DEFAULT | `true` |
| 2 | agenda_v2_encendida: INVOKER / STABLE / EXECUTE anon,authenticated,service_role / sin fila | `true/true/false,true,true/true` |
| 3 | agenda_ajustes_de_clinica_nueva: DEFINER con search_path vacío, sin PUBLIC | `true` |
| 4 | trg_clinicas_agenda_ajustes en clinicas, habilitado | `1` |
| 5 | clínicas sin fila en agenda_ajustes | `0` |
| 6 | filas de agenda_ajustes con la v2 apagada | `0` |
| 7 | proteger_agenda_ajustes y auditoría de agenda_ajustes, habilitados (no se tocan) | `2` |
| 8 | recordatorio_encendido / correo_reserva_clinica: DEFAULT | `false/false` |
| 9 | ANTES: clínicas / filas / encendidas / clínicas sin fila (INFO) | las que hubiera |
| 10 | DESPUÉS: clínicas / filas / encendidas (INFO) | los tres números iguales |
| 11 | filas con recordatorio o correo a la clínica encendidos (INFO) | las que ya lo estuvieran |

Antes de la rejilla imprime un `NOTICE … does not exist, skipping` (la tabla temporal de los números
de antes). Normal.

**Reversa de M3** (4 filas; 3 OK y 1 INFO): `1 · disparador y función de M3 que quedan = 0` · `2 ·
DEFAULT = false` · `3 · cuerpo de F1 / sin fila = true/false` · `4 · filas: total / encendidas`
(INFO; con la guarda del guion, `N / 0`). Imprime `WARNING: there is already a transaction in
progress` (el `BEGIN` del guion delante del del archivo, como en las demás reversas).

## 6. Diff de estructura esperado (antes ↔ después de M3)

`pg_dump -s -n public --no-comments`, quitando las dos líneas `\restrict` / `\unrestrict` (llevan un
valor al azar en cada volcado). Debe salir esto y NADA más:

- **Una función nueva:** `public.agenda_ajustes_de_clinica_nueva()` (plpgsql, SECURITY DEFINER,
  `search_path` vacío), con su ACL (sin PUBLIC; EXECUTE para `anon`, `authenticated`, `service_role`).
- **`public.agenda_v2_encendida(uuid)`:** una línea, `…), false)` → `…), true)`.
- **`public.agenda_ajustes`:** `agenda_v2_encendida boolean DEFAULT false NOT NULL` → `DEFAULT true`.
- **Un disparador nuevo:** `trg_clinicas_agenda_ajustes AFTER INSERT ON public.clinicas FOR EACH ROW`.
- **Lo que NO debe aparecer:** ninguna tabla, columna, policy, índice ni privilegio de tabla; ningún
  cambio en `proteger_agenda_ajustes()` ni en ninguna otra función.

Tras la reversa, el diff contra «antes» debe quedar VACÍO.

## 7. Pruebas tras aplicar

```bash
docker exec -i <contenedor del clon> psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < supabase/pruebas-sql/ap1_agenda_para_todos.sql
```

Deja UNA línea de WARNING a propósito (caso 5, el alta de la fila que la prueba hace fallar):
`agenda_ajustes_de_clinica_nueva: fila de ajustes no creada para la clínica 00000000-0000-4000-8000-0000000a91c4 (SQLSTATE 23514)`.
Cualquier `ERROR` es un fallo.

## 8. Lo que se comprobó en local y lo que no

Comprobado en el stack local de Supabase (CLI 2.117.0):

- las 17 migraciones desde cero con `supabase db reset --local`;
- `aplicar.sh` en modo ensayo (`APL_PUERTO=54322`) sobre una base reiniciada SIN M3 y con datos (4
  clínicas: dos de la semilla con fila en `false` y dos sin fila): `estado` (M3 pendiente) →
  `aplicar` (rejilla: `ANTES 4 / 2 / 0 / 2`, `DESPUÉS 4 / 4 / 4`) → segunda pasada (no ofrece nada) →
  `reversa` con la v2 encendida (se para sin tocar nada) → apagar en todas → `reversa` de M3 y parar
  en la de M2 (estructura = «antes», 0 diferencias) → `aplicar` otra vez (`ANTES 4 / 4 / 0 / 0`,
  `DESPUÉS 4 / 4 / 4`; estructura = la de la primera ida, 0 diferencias);
- el diff de estructura de §6, tal cual;
- los conteos de §2 contra la base local (con M3 ya aplicada dan ALTO en G.3, A.1, A.2 y A.3, que es
  lo que deben decir);
- la batería SQL, Vitest, lint, build y e2e: en el reporte de la entrega.

NO comprobado: nada sobre el clon de la foto de producción; los conteos en producción; el tiempo de
los candados con el RTT real; la auditoría independiente.
