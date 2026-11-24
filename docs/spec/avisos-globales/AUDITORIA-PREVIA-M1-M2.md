# Avisos globales — repaso del AUTOR contra `supabase/AUDITORIA-MIGRACIONES.md`

Migraciones: **M1** `20261202120000_avisos_globales_modelo.sql` y **M2**
`20261202130000_avisos_globales_rsvp_rechazo.sql`. Fecha: 2026-11-24.

> **Esto NO es la auditoría.** La dimensión 25 exige que audite alguien que no escribió la
> migración. Esto es lo que el autor comprobó y, sobre todo, lo que NO pudo comprobar, para que el
> auditor independiente empiece por ahí. Todo lo marcado «local» se comprobó en el stack local de
> Supabase (CLI 2.117.0), no en el clon de la foto de producción.

## Lo que el auditor debe mirar primero

1. **El clon de producción.** Nada se ensayó sobre la foto. En producción 32 funciones tienen el
   cuerpo con `\r\n` (`supabase/produccion/DERIVA.md`); M1 y M2 no comparan ninguna huella md5, pero
   sus pre-vuelos sí miran policies, CHECK y la publicación, y eso sólo se vio en local.
2. **El dueño de la publicación `supabase_realtime`** (dimensiones 11 y 26). En local es `postgres`;
   el pre-vuelo aborta si quien aplica no es su dueño. Si en producción es `supabase_admin`, M1
   aborta limpia en el pre-vuelo: habría que sacar el `ALTER PUBLICATION` a un paso aparte.
3. **`auth.uid()` en el `WHEN` de los disparadores.** Postgres admite funciones en `WHEN` (no
   subconsultas) y en local funciona; `auth.uid()` es de Supabase (esquema `auth`, dueño
   `supabase_auth_admin`). Si Supabase cambiara su firma, los cuatro disparadores que la nombran
   habría que recrearlos.
4. **La confianza en `spinus.via`.** `aviso_clinica_de_cambio_cita` cree a `spinus.via` sólo SIN
   sesión (`auth.uid() IS NULL`), igual que `log_cita_change`. Quien pueda fijar ese ajuste sin
   sesión (cualquier código con `service_role`) puede fabricar un aviso «el paciente confirmó». No
   concede acceso a datos; es un aviso falso. No hay camino desde PostgREST con una sesión.
5. **Las rutas con `service_role` que escriben `appointments`** (dimensión 17). Con sesión de base
   nula, el disparador no sabe quién fue: «Reagendar» del personal no avisa hasta el paso 5 (la ruta
   llamará a `aviso_clinica_registrar`). «Eliminar cita» (`/quitar`) no cambia estado ni hora: no avisa.
6. **`EXCEPTION WHEN OTHERS`** en los cinco escritores: cada llamada que SÍ escribe aviso abre una
   subtransacción. Costo medido abajo. `WHEN OTHERS` no atrapa `query_canceled` ni
   `assert_failure`: un `statement_timeout` durante el alta del aviso sí abortaría la escritura.

## Dimensión por dimensión

| # | M1 | M2 |
|---|---|---|
| 1 Corre | Sí, local, y desde cero con `supabase db reset --local` (16 migraciones) | Sí, ídem |
| 2 Atomicidad | `BEGIN … COMMIT` propio, como las demás del conjunto; post-vuelo antes del `COMMIT` | Ídem |
| 3 Replay | Segunda pasada: ABORTA en el pre-vuelo sin cambiar nada (probado). Desde `baseline/`: depende de las de la agenda | Ídem |
| 4 Orden de comprobaciones | Pre-vuelo antes de todo, con `RAISE EXCEPTION` | Ídem |
| 5 / 18 Veredicto | Un solo `SELECT` final, 8 filas | Un solo `SELECT`, 3 filas |
| 6 / 29 Bloqueos | ACCESS EXCLUSIVE sobre `avisos_clinica` desde el `ALTER` hasta el `COMMIT` (después vienen 6 `CREATE FUNCTION`, el bloque de disparadores, la publicación y el post-vuelo: unas 30 sentencias; con `psql -c` del guion viajan en una sola petición). SHARE ROW EXCLUSIVE sobre `appointments` y otras cuatro sólo desde el bloque `DO` final (3 sentencias hasta el `COMMIT`). **Sin medir con el RTT de Angel** | Ninguno de tabla |
| 7 Destructividad / reversa | No borra ni reescribe filas. Reversa escrita y ensayada en local: ida → reversa → ida, y con filas nuevas (sólo quita escritores; nunca borra avisos) | `DROP FUNCTION`; ensayada |
| 8 Constraints | 3 CHECK validados contra las filas existentes; el pre-vuelo aborta si hay filas que no sean de F4. **Falta el conteo de sólo lectura en producción** (abajo) | — |
| 9 Semántica | No escribe valores en filas existentes | — |
| 10 Aislamiento | Policies con `clinica_id = get_clinica_id()`; la RPC comprueba que médico, cita y actor son de `p_clinica_id` y responde igual exista o no lo referido. Probado (casos 10 y 12). **`cb_aislamiento_clinicas.sql` no se amplió** | Filtra por `p_clinica_id`; probado («otra clínica») |
| 11 Propiedad | Pre-vuelo: dueño de las 8 tablas y de la publicación | — |
| 12 Ventana | Migración primero. El código de antes pide sólo sus 7 tipos y cruza con `appointments`: no ve los nuevos | Cualquier orden |
| 13 Afirmaciones | «Realtime aplica la RLS» comprobado en local con cuatro sesiones (`scripts/local/avisos-realtime-rls.mjs`), no leído en la documentación. «Un DELETE no pasa por la RLS»: observado en la misma prueba | — |
| 15 Roles, en las dos direcciones | **Ganan:** el médico ve avisos dirigidos a él; todos los de la clínica ven `google_desconectado`/`google_sin_sincronizar`; administrador y secretaria ven `reserva_frenada` y `recordatorios_enviados` de cualquier médico. **Pierden:** quien hizo algo deja de ver ese aviso; el administrador y la secretaria NO ven los avisos dirigidos a un médico. Para los 7 tipos de F4 nada cambia (caso 14) | `service_role` gana cancelar por RSVP; nadie pierde |
| 16 Convenios | `datos` sin datos de personas: va en `COMMENT ON COLUMN`; la base no lo impone. Lo único que escribe `datos` son tres funciones de esta migración | — |
| 17 Otros caminos | `authenticated` sigue sin INSERT; `service_role` sin privilegios de tabla; puerta nueva única: `aviso_clinica_registrar` (lista blanca de 2 tipos) | Sólo `service_role` |
| 19 Recursión | Ninguna policy lee `avisos_clinica`; el post-vuelo lo comprueba con una expresión regular sobre `qual`/`with_check` (no ve una función que la leyera: no hay ninguna) | — |
| 20 Permisos de fábrica | Columnas nuevas: `authenticated` las lee (SELECT de tabla) y no las actualiza (post-vuelo y caso 13). Funciones: `REVOKE … FROM PUBLIC`; la RPC, sólo `service_role` | Sólo `service_role` |
| 21 Rendimiento | Medido en local (tabla del PLAN §8): sin cambio apreciable para el médico en su agenda; +0,2 a +0,4 ms cuando se escribe aviso. La policy añade comparaciones de columna; para avisos sin cita llama a `soy_admin_de_clinica()` y `get_my_role()` por fila (tabla pequeña, tope de 50 en la lectura) | — |
| 22 Conjunto | No reescribe ninguna función existente. Va después de las 14 | No reescribe `cita_rsvp_google`. Exige M1 |
| 23 Prueba | `av1_avisos_globales.sql`, 15 casos | `av2_rsvp_rechazo.sql`, 7 casos |
| 24 DEFINER | Las 6 nuevas fijan `search_path = ''` y no son de PUBLIC (post-vuelo) | INVOKER |
| 26 Otorgante | No revoca privilegios de tabla | — |
| 27 Contadores | `datos.intentos` y `datos.enviados` se suben en la misma sentencia (`ON CONFLICT DO UPDATE`); nada después puede lanzar | — |
| 28 Pre-vuelos acotados | Miran sólo lo que M1 toca. El de «filas que no son de F4» mira toda `avisos_clinica`, a propósito | — |
| 30 FK a tabla multi-clínica | No hay FK nuevas. `destinatario_id`, `actor_id` y `medico_id` no tienen FK y la sesión no puede escribirlas | — |
| 31 Cadena de reversas | La de M1 va la PRIMERA y nunca se niega; expone su guarda de sólo lectura en la cabecera. **`aplicar.sh` no la conoce todavía** | Antes que la de M1 |

## Conteos de sólo lectura para que Angel los corra en producción antes de aplicar

```sql
-- 1. Filas de avisos_clinica que el pre-vuelo de M1 rechazaría (esperado: 0).
SELECT count(*) FROM public.avisos_clinica
 WHERE cita_id IS NULL OR tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
       'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente');
-- 2. Dueño de la publicación y si ya contiene la tabla (esperado: postgres, false, 0).
SELECT pubowner::regrole, puballtables,
       (SELECT count(*) FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'avisos_clinica')
  FROM pg_publication WHERE pubname = 'supabase_realtime';
-- 3. Las dos policies de F4 (esperado: 2 filas).
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica';
```

## Pendiente antes de producción

- Ensayo de M1 y M2 sobre el clon de la foto, con ida, reversa e ida.
- Auditoría independiente (dimensión 25).
- Añadir las dos migraciones y sus reversas a `supabase/produccion/plan/aplicar.sh` (no se tocó).
- Ampliar `supabase/pruebas-sql/cb_aislamiento_clinicas.sql` con las columnas nuevas.
