# Avisos globales — ensayo de M1 y M2 en el clon de producción

Para quien corra el ensayo en el equipo de Angel. Autocontenido: no hace falta leer nada más.
Rama `feature/avisos-globales`. Nada de aquí toca producción; el guion se corre en MODO ENSAYO.

- **M1** `supabase/migrations/20261202120000_avisos_globales_modelo.sql` (riesgo medio)
- **M2** `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql` (riesgo bajo; exige M1)

## 0. Huellas (antes de nada)

```bash
sha256sum supabase/produccion/plan/aplicar.sh
# b530194de92dc21765666076234ad454375d83af852056c994f7402df0232834
sha256sum -c supabase/produccion/plan/huellas.sha256      # 23 líneas, todas OK
```

| Archivo | sha256 |
|---|---|
| `supabase/migrations/20261202120000_avisos_globales_modelo.sql` | `a73e7d69d68d9f0687bdcca587799ed5f5e38fb401c27c186c5bcfe62f78d170` |
| `supabase/migrations/20261202130000_avisos_globales_rsvp_rechazo.sql` | `54744f3bc3ab2828e258ab9198719316d1b73ab4039934b93e55690297a2fd5f` |
| `supabase/reversas/20261202120000_avisos_globales_modelo_reversa.sql` | `d452526aca93333272385643705e95eca7df9f2c8e37eaea1d36fcfde6eb7cf1` |
| `supabase/reversas/20261202130000_avisos_globales_rsvp_rechazo_reversa.sql` | `ae4a2745b0d31475f09ad644c07861e214035435214468fd5908833242aca7fa` |
| `supabase/produccion/plan/reversa-previa.sql` | `e6ad24b48e4251ea13bc69acde394f76ee4956ba80f2d905b3314ab8d7ca2c94` |
| `supabase/produccion/plan/huellas.sha256` | `4b0f9a5b7adc26528b3c4036840fc906c4d0d32171030b5e0dd3d44e524b381c` |

Si una huella no coincide, alto: el archivo no es el que se ensayó en local.

## 1. Qué cambió en el guion `aplicar.sh` (ya hecho en esta rama)

- `MIGRACIONES`: las 9 de antes + `20261202120000_avisos_globales_modelo` y
  `20261202130000_avisos_globales_rsvp_rechazo`, al final. Las que ya están en el historial y
  aplicadas se saltan solas; `aplicar` sólo ofrecerá estas dos.
- `REVERSAS`, en este orden: **M2, M1**, T, F5b, F4, F2, F3, F5a, F1. M2 antes que M1 (M2 exige M1)
  y M1 antes que T y F4 (la de F4 borra `avisos_clinica`, de la que cuelgan los escritores de M1).
- Objeto testigo (existe si y sólo si la migración está aplicada):
  - M1: función `public.aviso_clinica_registrar(uuid, text, uuid, uuid, uuid, text)`
  - M2: función `public.cita_rsvp_google_rechazo(uuid, uuid, text, text, text[])`
- `huellas.sha256`: 4 líneas nuevas (2 migraciones, 2 reversas) y la de `reversa-previa.sql`, que cambió.
- `reversa-previa.sql`: dos filas `DATOS` para M1 (marcas en `avisos_vistos`; avisos con la forma de
  M1). Con ellas, `reversa` pregunta por adelantado, como con las demás.
- Textos: «las 9» → «las 11». Nada más cambió: ni conexión, ni contraseña, ni candados.

## 2. Conteos de sólo lectura (en PRODUCCIÓN, antes de aplicar; los corre Angel)

```sql
-- 1. Avisos que el pre-vuelo de M1 rechazaría. Esperado: 0.
SELECT count(*) FROM public.avisos_clinica
 WHERE cita_id IS NULL OR tipo NOT IN ('reserva_enlace', 'cancelacion_paciente', 'reagendado_paciente',
       'google_por_asignar', 'empalme_google', 'google_movimiento_rechazado', 'confirmacion_paciente');
-- 2. Las dos policies de F4 que M1 sustituye. Esperado: 2 filas (avisos_clinica_select, avisos_clinica_update).
SELECT policyname, cmd FROM pg_policies WHERE schemaname = 'public' AND tablename = 'avisos_clinica' ORDER BY 1;
-- 3. Nada de M1 ni de M2 existe todavía. Esperado: 0 y 0.
SELECT (SELECT count(*) FROM pg_proc WHERE pronamespace = 'public'::regnamespace
          AND proname IN ('aviso_clinica_registrar', 'avisos_pendientes', 'aviso_clinica_reabrir', 'cita_rsvp_google_rechazo')) AS funciones,
       (to_regclass('public.avisos_vistos') IS NOT NULL)::int AS tabla_avisos_vistos;
```

Si (1) no da 0, M1 aborta limpia en su pre-vuelo: no se aplica nada y hay que mirar esas filas.

## 3. El ensayo (clon de la foto, en local)

Con el clon levantado como en el ensayo de las 9 (`clonar-desde-foto.sh`; aquí en el puerto 54373) y
Docker encendido, desde la raíz del repo:

```bash
export APL_HOST=127.0.0.1 APL_PUERTO=54373 APL_USUARIO=postgres APL_SSL=disable APL_RED=host \
       APL_DESTINO="$HOME/spinus-produccion-foto/ensayo-avisos-$(date +%Y%m%d)"
bash supabase/produccion/plan/aplicar.sh estado     # M1 y M2 «pendiente»; las 9 «aplicada y registrada»
bash supabase/produccion/plan/aplicar.sh aplicar    # escribir 20261202120000 y luego 20261202130000
bash supabase/produccion/plan/aplicar.sh reversa    # REVERTIR 20261202130000, REVERTIR 20261202120000 y PARAR en la de T
bash supabase/produccion/plan/aplicar.sh aplicar    # otra vez las dos
bash supabase/produccion/plan/aplicar.sh aplicar    # segunda pasada: no ofrece nada, «Las 11 aplicadas y registradas»
```

En `reversa`, tras las dos primeras, contestar cualquier otra cosa a la de `20261201180000`: el guion
dice «parado antes de la reversa de 20261201180000_agenda_sin_truncate» y no toca nada más. Con un
clon sin datos, la comprobación previa dice «ninguna reversa de la cadena se va a negar».

Luego, las pruebas (crean sus datos y terminan en rollback):

```bash
docker exec -i <contenedor del clon> psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < supabase/pruebas-sql/av1_avisos_globales.sql
docker exec -i <contenedor del clon> psql -U postgres -v ON_ERROR_STOP=1 -q -o /dev/null -f - < supabase/pruebas-sql/av2_rsvp_rechazo.sql
```

`av1` deja UNA línea de WARNING a propósito (`aviso personal_agendo no escrito (SQLSTATE 23514)`: es el
caso que prueba que un aviso que falla no impide la cita). Cualquier `ERROR` es un fallo.
`av2` no imprime nada.

## 4. Rejillas esperadas, fila por fila

**M1** (10 filas; 9 OK y 1 INFO):

| n | comprobación | valor esperado |
|---|---|---|
| 1 | columnas nuevas de avisos_clinica | `actor_id,datos,destinatario_id,medico_id` |
| 2 | tipos que admite avisos_clinica_tipo_check | `19` |
| 3 | policies de avisos_clinica | `avisos_clinica_select:SELECT,avisos_clinica_update:UPDATE` |
| 4 | disparadores aviso nuevos, habilitados | `7` |
| 5 | funciones aviso_clinica_* DEFINER con search_path vacío | `12` |
| 6 | quién ejecuta aviso_clinica_registrar (anon/authenticated/service_role) | `false/false/true` |
| 7 | avisos_vistos: policies | `avisos_vistos_insert:INSERT,avisos_vistos_select:SELECT,avisos_vistos_update:UPDATE` |
| 8 | reabrir, sellar y sin_truncate, habilitados | `3` |
| 9 | avisos_clinica en la publicación supabase_realtime (esta migración no la añade) | `0` |
| 10 | filas de avisos_clinica (INFO) | las que hubiera; no cambian |

**M2** (3 filas, todas OK): `1 · INVOKER y search_path vacío = true` · `2 · quién la ejecuta =
false/false/true` · `3 · cita_rsvp_google (el «Sí») sigue = true`.

**Reversa de M2** (1 fila): `cita_rsvp_google_rechazo quitada = true`.

**Reversa de M1** (5 filas, todas OK sin datos): `1 · disparadores de M1 que quedan = 0` · `2 · funciones
de M1 que quedan = 0` · `3 · escritores de F4, intactos = 7` · `4 · tabla avisos_vistos = false` ·
`5 · forma de avisos_clinica = la de F4`.

Una segunda ida de M1 o de M2 hecha a mano (sin el guion) ABORTA en su pre-vuelo: «esta migración ya
está aplicada». Es lo esperado.

## 5. Diff de estructura esperado (antes ↔ después de M1 y M2)

El diff completo de mi base local está en `docs/spec/avisos-globales/estructura-antes-despues.local.diff`
(`pg_dump -s -n public --no-comments`). En el clon debe salir lo mismo, y NADA más:

- **Tabla nueva** `public.avisos_vistos` (`aviso_id`, `usuario_id`, `clinica_id`, `visto_en`), con su
  llave primaria `(aviso_id, usuario_id)`, FK RESTRICT a `clinicas`, 2 índices, RLS, 3 policies y
  privilegios sólo para `authenticated` (SELECT; INSERT de tres columnas; UPDATE de `visto_en`).
- **`public.avisos_clinica`**: 4 columnas nuevas (`destinatario_id`, `actor_id`, `medico_id`, `datos`);
  `cita_id` pasa a admitir NULL; `avisos_clinica_tipo_check` de 7 a 19 tipos; 2 CHECK nuevos
  (`avisos_clinica_cita_tipo_check`, `avisos_clinica_datos_check`); índice único nuevo
  `avisos_clinica_sin_cita_key`; las 2 policies, con la condición nueva. Sus privilegios no cambian.
- **10 funciones nuevas**: `aviso_clinica_de_cambio_cita`, `_de_bloqueo`, `_de_correo`,
  `_de_conexion_google`, `_de_sync_google` (disparador, DEFINER); `aviso_clinica_registrar` (DEFINER,
  sólo `service_role`); `aviso_clinica_reabrir` y `aviso_visto_sellar` (disparador, INVOKER);
  `avisos_pendientes` (INVOKER, sólo `authenticated`); `cita_rsvp_google_rechazo` (INVOKER, sólo
  `service_role`).
- **10 disparadores nuevos**: en `appointments` (`trg_appointments_aviso_alta_personal`,
  `trg_appointments_aviso_cambio`), `agenda_bloqueos` (2), `cita_correos` (1),
  `clinica_conexiones_google` (1), `gcal_sync_estado` (1), `avisos_clinica` (`trg_avisos_clinica_reabrir`)
  y `avisos_vistos` (`trg_avisos_vistos_sellar`, `trg_avisos_vistos_sin_truncate`).
- **Lo que NO debe aparecer en el diff:** ninguna otra tabla, ninguna policy de otra tabla, ningún
  cambio en `reservar_por_enlace`, `cita_rsvp_google`, `log_cita_change` ni en los seis
  `aviso_clinica_de_*` de F4, ninguna publicación (Realtime no se toca) y ningún privilegio nuevo
  para `anon`.

Tras la reversa de las dos, el diff contra «antes» debe quedar VACÍO.

## 6. Lo que se comprobó en local y lo que no

Comprobado en el stack local de Supabase (CLI 2.117.0), con este mismo guion en modo ensayo
(`APL_PUERTO=54322`): `estado`, `reversa` de M2 y M1, `aplicar` de las dos y segunda pasada; las 16
migraciones desde cero con `supabase db reset --local`; batería SQL (50 archivos); la reversa de M1 con
datos (se niega; con la confirmación sigue y conserva la forma de M1 si quedan avisos nuevos).

NO comprobado: nada sobre el clon de la foto de producción (por eso existe este guion); el tiempo de
los candados con el RTT real; y la auditoría independiente (dimensión 25), que sigue pendiente.
