# Estado del despliegue 1 — agenda v2 (PLANTILLA)

> **ESTO ES UNA PLANTILLA. NADA SE HA APLICADO NI DESPLEGADO.** La escribió el
> agente B7 el 2026-11-23 a partir de `supabase/produccion/plan/PLAN-DE-APLICACION.md`
> (§4 pasos 0–8, §8.1 y §15). El coordinador la rellena tras cada paso; Angel
> escribe la hora elegida. Si esta tabla y el plan dicen cosas distintas, **manda
> el plan**.
>
> «Despliegue 1» = la agenda v2 (código de `feature/agenda-v2-produccion` + las 9
> migraciones). El rediseño estético (`feature/rediseno-estetico`) es **otro
> despliegue, posterior y aparte**; no entra en este tablero.

| Campo | Valor |
|---|---|
| **Estado general** | **SIN EMPEZAR** |
| Commit congelado (el que se despliega) | `________` (propuesto: `7af5775e`, el último que cambia código, migraciones o pruebas; lo posterior es sólo documentación) |
| Huella de `aplicar.sh` vista por Angel ese día | `________` (debe ser `67ec5d149065f0723ca1397591a8e024adb1000960a338dabe497767d2e3e571`, plan §2) |
| `sha256sum -c huellas.sha256` ese día | `________` (19 líneas, todas OK) |
| Fecha elegida (sin consulta) | `____ / ____ / ______` (la escribe Angel) |
| Hora elegida (sin consulta) | `____:____` (la escribe Angel; plan §4, paso 3, campo «Hora elegida») |
| Despliegue de Vercel ACTUAL (el de `main`, al que se vuelve si falla el paso 5) | `________` |
| Ida y vuelta medida por `aplicar.sh estado` (mediana de 5) | `____ ms` |
| Prueba de humo de petición grande | `aceptada / NO aceptada`, `____ s` |

## Reglas que no se reescriben aquí (resumen; el texto bueno es el del plan)

- **Orden del día** (plan §4 y §6.1, decisión de Angel del 2026-11-22): **CÓDIGO
  PRIMERO** (paso 4) y **la BASE inmediatamente después, en la misma sesión**
  (paso 6), con la v2 apagada en todas las clínicas. El paso 8 (encender) es otro
  día.
- **Si el paso 5 falla** (código nuevo, base vieja): se vuelve al despliegue
  anterior de Vercel; **no hay reversa de base** porque la base no se tocó (plan
  §4, paso 5).
- **Aborto por candado** (plan §8.1, aprobado por Angel): mirar G.14/G.15/G.16
  de los conteos; **esperar 2 minutos** y repetir `aplicar.sh aplicar`; **como
  mucho 3 veces en total**, con 2 minutos entre cada una. No subir el
  `lock_timeout` ni terminar sesiones ajenas. Si persiste, **se deja para otra
  hora sin consulta** (la pone Angel) y se retoma desde el paso 3; quedarse a
  medias entre dos archivos es un estado válido.
- **Reversa** (plan §10): antes de revertir cualquier migración, **apagar la v2
  en TODAS las clínicas**; sólo con `aplicar.sh reversa` / `reversa-truncate`;
  sólo con orden de Angel.
- **Los tres escalones de rendimiento tras encender la v2** (plan §15, decisión
  de Angel, literal en el plan): se compara la mediana de «Carga» de 5 recargas
  DESPUÉS con la de ANTES (mismo procedimiento, equipo y red):

  | Mediana de «Carga» después, frente a la de antes | Qué se hace |
  |---|---|
  | igual o más rápida | se sigue |
  | más lenta, hasta un 50 % | no se apaga; **no se enciende en ninguna otra clínica** hasta saber la causa |
  | más de un 50 % más lenta, **o con errores** | se apaga en la clínica de Angel y se investiga |

  Una medición rara no cuenta: se repite la tanda de 5. (Decisión abierta: si la
  cifra que decide pasa de «Carga» al LCP: «Carga» llega antes de que se pinte
  la agenda; `supabase/produccion/ensayo/ENSAYO-PRINCIPAL.md` §5.6.)

## El tablero

«Quién»: **Angel** = lo corre él en su terminal o en un panel (todo lo que toca
producción, Vercel o Supabase); **coordinador** = lee salidas, compara con el
plan y actualiza esta tabla. Nadie más escribe en producción.

| Paso | Qué se hace (plan §4) | Quién | Hora | Resultado | Evidencia | Qué sigue |
|---|---|---|---|---|---|---|
| 0 | Requisitos previos (casillas de abajo). Si falta uno, no se empieza | Angel (decide) · coordinador (repasa la lista) | — | — | — | paso 1 |
| 1a | Respaldo de Supabase: anotar la hora del último diario y si hay PITR (Dashboard → Database → Backups) | Angel | — | — | — | 1b |
| 1b | `bash supabase/produccion/plan/aplicar.sh respaldo` (volcado cifrado; la única operación que saca datos de pacientes) | Angel | — | — | línea final de tablas con datos; `.sha256` en `~/spinus-produccion-foto/aplicacion-<fecha>/` | paso 2 |
| 2 | Foto «antes» y `comparar-estructura.sh` contra la foto del ensayo: debe dar **0 diferencias** | Angel | — | — | salida de `comparar-estructura.sh` | si ≠ 0, **se para** y se repite el ensayo (plan §11); si 0, paso 3 |
| 3 | `correr-conteos.sh` + `aplicar.sh estado`: todo OK o INFO; anotar G.13b, F1.11 y las cuatro cuentas de `estado` | Angel · coordinador (lee la rejilla) | — | — | `conteos-<fecha>.txt` (fuera del repo) | paso 4 |
| 4 | Variables de Vercel (`VARIABLES-VERCEL.md`; **`CRON_SECRET` ANTES de desplegar**), Fluid Compute activado, ningún «Function Max Duration» < 300 s, casilla Supabase–GitHub **sin conectar**; merge local a `main` y despliegue | Angel | — | — | id del despliegue nuevo | paso 5 |
| 5 | Comprobación corta, código nuevo + base vieja: entrar, abrir un paciente, abrir la agenda (sin engrane, campana ni candado), crear y cancelar una cita en la semana siguiente; Logs de Vercel: un `warn` «interruptor de la agenda sin leer» es lo esperado, un `error`/500 no | Angel | — | — | — | si falla: **volver al despliegue anterior**, sin reversa de base; si va bien: 5-bis **sin pausa** |
| 5-bis | Repetir `correr-conteos.sh` (plan §4, paso 3, «REPETIRLO»): **G.14 `ninguna`, G.15 `ninguno`, G.16 `true`** | Angel · coordinador | — | — | — | si no: esperar un minuto y repetir; si sí: paso 6 |
| 6 | `bash supabase/produccion/plan/aplicar.sh aplicar` (pide `PRODUCCION`, contraseña y la versión de cada archivo) | Angel | — | — | `*.salida.txt` de cada archivo | filas 6.1–6.9 |
| 6.1 | `20261125170000` audit_log sin TRUNCATE — rejilla 7 filas (5 OK, 2 INFO) | Angel · coordinador | — | — | — | 6.2 |
| 6.2 | `20261126120000` public sin TRUNCATE — 8 filas (3 OK, 5 INFO); fila 2: **28 tablas** | Angel · coordinador | — | — | — | 6.3 |
| 6.3 | `20261201120000` F1 — 15 filas (14 OK, 1 INFO); consultorios respaldados = F1.11 del día (18 el 2026-11-22). **Punto de no retorno: su COMMIT** (plan §7) | Angel · coordinador | — | — | — | 6.4 |
| 6.4 | `20261201130000` F5a — 6 OK | Angel · coordinador | — | — | — | 6.5 |
| 6.5 | `20261201140000` F3 — 9 filas (8 OK, 1 INFO); censo 0 / 0 / 0 | Angel · coordinador | — | — | — | 6.6 |
| 6.6 | `20261201150000` F2 — 9 filas (8 OK, 1 INFO); fila 8: `a2dcfa8f…` / `2efd7734…` | Angel · coordinador | — | — | — | 6.7 |
| 6.7 | `20261201160000` F4 — 8 OK; los 7 tipos de aviso | Angel · coordinador | — | — | — | 6.8 |
| 6.8 | `20261201170000` F5b — 7 OK; 3 índices y llave primaria válidos | Angel · coordinador | — | — | — | 6.9 |
| 6.9 | `20261201180000` T — 4 OK; 11 disparadores | Angel · coordinador | — | — | — | `aplicar.sh estado` → las 9 «ya registrada»; paso 7 |
| 7 | `COMPROBACION-POSTERIOR.md` entero (foto después, antes↔después, producción↔ensayo, historial con 14, catálogo, rejillas, humo con la v2 apagada) | Angel · coordinador | — | — | — | si algo no cuadra: **no se enciende nada**; decidir arreglar o revertir (plan §10, primero apagar la v2 en todas) |
| 8a | (otro día, sólo con plan §13 resuelto) Medición «antes» de §15: 5 recargas de `/agenda` con la v2 apagada | Angel | — | — | tabla de §15 | 8b |
| 8b | Encender la v2 en UNA clínica (la de pruebas de Angel), por SQL como `postgres` | Angel | — | — | — | 8c |
| 8c | Medición «después» de §15 y comparación con los tres escalones de arriba | Angel · coordinador | — | — | tabla de §15 | según el escalón |

### Casillas del paso 0 (plan §4, paso 0)

| Requisito | Estado | Evidencia |
|---|---|---|
| Auditoría global aprobada (`supabase/AUDITORIA-MIGRACIONES.md`) | — | — |
| Equivalencia (E0) y ensayo código ↔ base (E2) en verde | — | `supabase/fusion/equivalencia/DIFERENCIAS.md`, `supabase/produccion/ensayo/ORDEN-Y-REVERSA.md` |
| `huellas.sha256` con los archivos aprobados | — | — |
| Conteos en OK corridos **ese mismo día** (el del 2026-11-22 no vale por sí solo) | — | — |
| **Orden explícita de Angel, ese día** | — | — |
| Hora sin consulta elegida (arriba) | — | — |
| Nadie más desplegando ni tocando la base | — | — |
| Integración Supabase–GitHub **sin conectar** (antes de fusionar a `main`) | — | — |
| Variables de Vercel preparadas, `CRON_SECRET` incluida | — | — |

## Bitácora (una línea por hecho, en orden)

| Hora | Quién | Qué pasó |
|---|---|---|
| — | — | — |
