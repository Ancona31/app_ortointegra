# Reporte final — agenda v2 lista para producción (despliegue 1)

> Redactado por el agente B7 (Opus) el 2026-11-23 sobre `feature/agenda-v2-produccion`; guardado y revisado por el coordinador.
> **Solo documentación: no se aplicó ni se desplegó nada, y no se tocó producción.** Escrito para alguien que no estuvo en la sesión.
> **[C]** = comprobado, con el archivo o la orden al lado. **[D]** = deducido.
> Tablero del día: `docs/despliegue/ESTADO.md`. Variables: `docs/despliegue/VARIABLES-VERCEL.md`.

## 1. ¿Hay algo que impida aplicar a producción?

**No se encontró ningún impedimento técnico. Sí hay cosas que por regla van antes, y una que hay que dejar en papel: la auditoría de T.**

### (a) Impedimentos técnicos: ninguno
- **Los tres auditores coinciden** [C]:
  - ronda 1: «ninguno es BLOQUEANTE» (RONDA-1.md, Veredicto);
  - ronda 2: «no hay hallazgos que impidan aplicar» (RONDA-2.md, pasadas 2 y 3);
  - guion: «No hay nada que impida usar este guion» (RONDA-2-GUION.md §7).
- **G1, G2 y G3 están corregidos.** Son los tres medios que el auditor del guion pidió cerrar antes. Los comprobó quien los corrigió (CA, fase 4), no un auditor independiente [C: plan §2 y §10.1].
- **El ensayo de punta a punta salió en verde.** Sobre un clon de la foto y sobre la base local con la deriva: las 9 en verde, 0 REVISAR y las mismas 965 diferencias [C: plan §11; ENSAYO-PRINCIPAL §5.1].
- **Las huellas cuadran.** `sha256sum -c supabase/produccion/plan/huellas.sha256` da 19 OK y `aplicar.sh` da `67ec5d14…e571`, la del plan §2 [C: B7 y coordinador, 2026-11-23].
- **El conteo previo está limpio.** Angel lo corrió el 2026-11-22 a las 21:08: 78 filas, 73 OK, 5 INFO, 0 AVISO y 0 ALTO [C: rejilla guardada fuera del repo].

### (b) Lo que debe hacerse antes, por regla
1. **Repetir los conteos ese mismo día**, entre el paso 5 y el 6. Tiene que salir G.14 «ninguna», G.15 «ninguno» y G.16 «true» [C: plan §4, pasos 0 y 3].
2. **Orden explícita de Angel**, ese día [C: plan paso 0; CLAUDE.md].
3. **Hora sin consulta** [C: plan paso 0].
4. **Variables de Vercel** antes de desplegar, `CRON_SECRET` la primera; `AGENDA_RSVP_GOOGLE` sin definir [C: VARIABLES-VERCEL.md; plan §6.2].
5. **Integración Supabase–GitHub sin conectar**, confirmado antes de fusionar a main [C: plan paso 0 y §12.6].
6. **La auditoría de T, en papel.**
   - Su cabecera (`20261201180000_agenda_sin_truncate.sql:12-13`) y `mejora_agendaV2.md` §7.1 fila 14 dicen «PENDIENTE DE AUDITORÍA INDEPENDIENTE» [C].
   - Las rondas 1 y 2 auditaron las 9, T incluida (RONDA-2 P2-1, fila T: «ninguno») [C].
   - Si Angel las da por buenas, hay que cambiar la cabecera y regenerar `huellas.sha256` en el mismo commit (plan §12.1) [D].
   - Lo mismo pasa con la 2: plan §1 y §7.1 fila 7 dicen «pendiente», pero su cabecera ya dice «AUDITADA» [C].
7. **El aviso de privacidad de la reserva** (`avisoReserva.ts`, pendiente de revisión legal).
   - No impide aplicar ni desplegar.
   - Con la marca puesta, en Vercel no abre la página de reserva por enlace, aunque se apruebe el hash [C: `avisoReserva.ts:88-93`].
   - El plan lo cuenta entre lo que bloquea encender la v2 [C: plan §13].

### (c) Lo que no se probó
- **El pooler real (Supavisor):** lo dirán la prueba de humo y la ida y vuelta del día. Si sale «NO aceptada», no se aplica [C: plan §11 y §12.4].
- **`migration repair` contra el historial de producción** [C: plan §11].
- **El volumen real:** los clones estaban vacíos o con datos sintéticos de hasta 200 000 citas; producción tiene 247 [C].
- **Google real, Realtime y `imatch` en producción** [C: plan §13; ORDEN-Y-REVERSA].
- **+F3, +F2 y +F4 con la v2 apagada:** que funcionan es solo deducido [D; C: ORDEN-Y-REVERSA §5.4].
- **La batería de martes a viernes** [C: AG-DT-256].
- **La vuelta atrás de Vercel:** el nombre de la opción está POR COMPROBAR [C: plan paso 5].
- **`aplicar.sh respaldo`:** no se repitió tras el agente L [C: plan §11].
- **La latencia servidor↔base:** en las medidas, servidor y base estaban en la misma máquina [C: §5.6].

## 2. Deriva de producción
Fuente: `supabase/produccion/DERIVA.md`.
- **Hay una sola deriva que afecta: los fines de línea.** 32 funciones están con `\r\n` en producción e idénticas una vez normalizadas [C: §0 y §4].
- **Ya no hace abortar nada.** Antes hacía abortar los pre-vuelos de 20261125 y F5a. Hoy comparan el md5 normalizado y las 9 entran limpias sobre la foto [C: plan §11; DIFERENCIAS §6]. DERIVA §0 describe el estado de antes de esa corrección.
- **Producción es más estricta en privilegios.** Además difieren tres CHECK (deparseo) y la versión de la plataforma; nada de eso afecta [C: §4-§5].
- **`pg_cron` no estorba.** Hay 1 trabajo activo y ninguno toca `appointments` ni `clinicas` (G.17) [C].
- **El rol `postgres`** es dueño de `public`, no es superusuario y tiene BYPASSRLS [C].

## 3. El conjunto: de 5 a 14
[C: `ls supabase/migrations supabase/reversas`]

Las 5 de main: `20260912190416_remote_schema`, `20260913_b5_perfil_completo_rls`, `20260914_b56_trigger_aprovisionamiento`, `20260919230000_auth_02_reasentar_grants_rate_limit` y `20260919_consultorios_07_default_exclude`.

A esas se suman estas 9 (cada reversa es `supabase/reversas/<versión>_<nombre>_reversa.sql`):

| # | Versión | Nombre | Sigla |
|---|---|---|---|
| 1 | 20261125170000 | audit_log_sin_truncate | — |
| 2 | 20261126120000 | public_sin_truncate | — |
| 3 | 20261201120000 | agenda_f1_ajustes_tipos_horarios | F1 |
| 4 | 20261201130000 | agenda_f5a_bloqueos | F5a |
| 5 | 20261201140000 | agenda_f3_reserva_enlace | F3 |
| 6 | 20261201150000 | agenda_f2_google | F2 |
| 7 | 20261201160000 | agenda_f4_confirmacion_correos_avisos | F4 |
| 8 | 20261201170000 | agenda_f5b_protecciones_cita | F5b |
| 9 | 20261201180000 | agenda_sin_truncate | T |

- **Reversa:** en orden inverso (T, F5b, F4, F2, F3, F5a, F1) con `aplicar.sh reversa`; las dos de TRUNCATE aparte, con `reversa-truncate`.
- **Punto de no retorno:** el COMMIT de F1, que reescribe los horarios de 18 consultorios [C: plan §7 y §10].

## 4. Equivalencia de las 6 fundidas con las 44 originales
Fuente: `supabase/fusion/equivalencia/DIFERENCIAS.md`, tercera vuelta.
- **Veredicto: ACEPTADO.** Hay 127 diferencias, todas explicadas [C].
- **Un solo cambio de comportamiento, a propósito:** `proteger_reserva_contactos()` (A3) [C: §3].
- **El invariante da 24/24** tras cada archivo [C: §5].
- **Sobre la foto real:** 63 OK, 10 INFO y 0 REVISAR [C: §6].
- **CONJUNTO.tsv:** 139 diferencias, las 139 esperadas [C: §7].
- **No se comprobó:** `gcal_aplicar_evento` con datos, las e2e, PostgREST, los candados ni el historial con la CLI [C: §8].

## 5. Números del ensayo

| Qué | Resultado | Origen |
|---|---|---|
| `aplicar.sh aplicar` | 9 en verde, 0,28–0,41 s cada una; 63 OK, 10 INFO, 0 REVISAR; historial 14 | [C] ENSAYO-PRINCIPAL §5.1 |
| Antes ↔ después | 965 diferencias, mismas claves que el clon de la foto | [C] §5.1; plan §11 |
| Clon de la foto (CA, fase 2) | prueba de humo de 104 104 bytes aceptada en 0,30 s; 1,21–1,60 s por archivo con 150 ms de ida y vuelta | [C] plan §11 |
| Vitest | 2387/2387 en tres zonas: sin TZ, UTC y Hermosillo (con `--exclude ".claude/**"`). **Agente S:** 2395/2395 en las tres | [C] §5.3a; §10 |
| SQL | 48/48 (agente S: 48/48 otra vez, sobre la base de 14 con los almacenes) | [C] §5.3b; §10 |
| Carreras | `reserva-carrera` 1–6b y `confirmacion-carrera` 1–3, en verde | [C] §5.3c |
| Build | sale 0; 98 páginas. Agente S: sale 0 sobre `77751da3` | [C] §5.3d; §10 |
| Lint | main: 96 errores y 67 avisos; rama: 101 y 68; ningún error nuevo en código versionado | [C] §5.3d |
| Batería 1 | lunes 23, 00:35–01:00: 617 pasan, 5 fallan, 13 no corren, 491 se saltan; **guarda en ROJO** (51 citas) | [C] §5.3e |
| Batería 2 | lunes 23, 03:11–03:36, sobre `7af5775e`: 635 pasan, 0 fallan, 0 no corren, 491 se saltan; **guarda en VERDE** | [C] «Batería tras corregir las pruebas» |
| Batería 3 (agente S) | lunes 23, 09:04–09:30, sobre `2e7d5d72` (build de `77751da3`): **632 pasan, 2 fallan, 4 no corren, 494 se saltan; guarda en VERDE**. Fallos: `reserva-k2-codigo` «la reserva falla después de verificar» (la prueba llenaba el tope viejo de 4; corregida en `131ad6c1`, suelta 3 de 3 en verde; las 4 que no corrieron son las que le siguen en serie) y `agenda-empalme` «redimensionar…» (AG-DT-257, suelta 1 de 3). No se repitió entera | [C] §10 |
| Orden | las dos direcciones son seguras. Código primero: un `warn` por petición. Base primero: 500 con main sobre una cita atendida con nota | [C] ORDEN-Y-REVERSA §5.4 |
| Reversa | se niega si hay datos. Con la v2 encendida, quitar F3 o más da 500 en 21 de 66 peticiones. `audit_log` solo crece. Volver a aplicar da 0 diferencias | [C] §5.5 |

Hasta el agente S, `src/`, las migraciones y `vercel.json` no cambiaban desde `b2993fe1` [C: git diff vacío]; entre la batería 1 y la 2 sólo cambiaron archivos de `e2e/`. **El agente S cambia `src/`** (`77751da3`: la ruta de reservar, `limitesReserva.ts` y 5 pruebas de Vitest; §10). Migraciones y `vercel.json`, sin cambios [C: `git diff --stat b2993fe1 -- supabase/migrations vercel.json` vacío].

## 6. Hallazgos de los auditores

**Cerrados:**
- A1 (GRAVE): un archivo por petición, con plazos [C: RONDA-2 tabla C; plan §2].
- A2 y A8.
- A3 y A4: comprobados ejecutando.
- A5 en el guion. La reversa de F5b corrida a mano sigue sin negarse sola; está documentado.
- A6 y A12.
- A15 y A16: CA, fase 3.
- G1–G4 y G6–G13: CA, fase 4. G5 queda como regla: 2 minutos y 3 intentos.

**Aceptados como límite:**
- A7 (AG-DT-271).
- A9: COMMENT con una imprecisión menor.

**A deuda:**
- A10 (AG-DT-272) y A11 (AG-DT-273).
- A13 (AG-DT-275).
- A14 (AG-DT-274, prioridad ALTA).
- La condición 4-bis (AG-DT-270).

## 7. Rendimiento
Fuente: ENSAYO-PRINCIPAL §5.6. Mediana de 20 muestras; servidor y base en la misma máquina. [C]

**Lo que sale peor que main:**

| Métrica | main | rama apagada | rama encendida |
|---|---|---|---|
| JS al primer evento | 472 KiB / 25 chunks | 547 KiB (+16 %) / 34 | 528 KiB (+12 %) / 30 |
| JS en reposo | 472 KiB | 547 KiB (+16 %) | 587 KiB (+25 %) |
| Clic → modal cerrado | 42 ms | 14 ms | 184 ms (salida animada, solo v2; la tarjeta ya pintada a los 72 ms) |
| Cancelar (PUT) | 49 ms | 58 ms (+9 ms, fuera del ruido) | 50 ms |
| POST / mover | 70 / 61 ms | 80 / 66 ms | 82 / 66 ms (dentro del ruido) |

**Lo que sale mejor (main sobre base de 14 → rama apagada → rama encendida):**
- Abrir en frío: 450 → 391 → 400 ms.
- Abrir con red limitada: 1506 → 844 → 852 ms.
- Semana siguiente: 148 → 91 → 91 ms.
- Volver del dashboard: 225 → 114 → 121 ms.
- Peticiones bloqueantes: de 1 a 0.

**«Carga» llega antes de que se pinte la agenda; el LCP no.** «Carga» es la cifra que decide en el plan §15, y llega a ≈144 ms frente a ≈313 ms del primer evento (640 frente a ≈800 con red limitada). El LCP sí coincide con la aparición de las citas. «Fin de la última /api» sube de ≈220 a ≈390 ms con la v2 por dos peticiones posteriores al pintado.

**Main sobre la base nueva tarda +500 ms con red limitada** (999 → 1506 ms, en las 4 rondas). No se investigó. Solo importa con «base primero».

## 8. Sin resolver y decisiones de Angel
1. Qué cifra decide tras encender: «Carga» o LCP.
2. Qué hacer con el peso de JS (+16 % y +25 %) y los +9 ms al cancelar con la v2 apagada.
3. Si se investigan los +500 ms de main sobre la base nueva.
4. Que la guarda avise en `onBegin` si la base ya trae citas que la ventana pregunta hoy.
5. Excluir `.claude/` en `vitest.config.ts` y `eslint.config.mjs` (hoy no lo excluyen [C: grep vacío]).
6. El uso ampliado de `asistencia-a-proposito`: 10 archivos e2e la usan ahora para citas de mañana que borran en `afterEach` [C: git grep].
7. El 429 de `husos-dos-consultorios`: 1 de 6 corridas sueltas, sin causa encontrada.
8. Las etiquetas «admin» en `supabase/fusion/equivalencia/proteger-contactos.sql` (líneas 18, 77 y 81). El rol `admin` no existe.
9. Validar dos decisiones de CB: el rol `medico` exigido en A3 y las tres columnas nuevas del respaldo de F1.
10. El correo en claro en `reserva_enlaces.correo` del enlace único (AG-DT-274).
11. Los 28 worktrees de agentes en `.claude/worktrees/`, 4,4 GB [C: du].
12. AG-DT-257 sigue abierta aunque pasó en la última batería.
13. AG-DT-260 sigue abierta (corrida que cruza la medianoche).
14. La auditoría de T en papel (sección 1, punto b.6).
15. `docs/despliegue/` cae bajo `docs/*` en `.gitignore`: los archivos se añadieron con `git add -f`. Decidir si se añade `!docs/despliegue/`.

**Otras contradicciones entre documentos (sin corregir):**
- `ORDEN-Y-REVERSA.md` §5.4 dice «los dos crons 60 s»; `recordatorios` tiene `maxDuration = 120` desde `24eb9910` [C].
- `DERIVA.md` §0 describe los abortos por `\r\n` de antes de la corrección.

**Deuda de prioridad alta entre AG-DT-261 y 275:**
- AG-DT-265: Sentry no carga en el servidor. Fuera de la agenda.
- AG-DT-266: `logAudit` falla en silencio y diez rutas no lo esperan.
- AG-DT-274: plazo de 30 días para los códigos de verificación y el correo del único. Va antes de encender la v2 en otras clínicas.

**Prioridad media:** AG-DT-264 (tope de tiempo en las llamadas a Google; antes de encender la v2 en otras clínicas).

## 9. Coordinación con `feature/rediseno-estetico`
Punta leída: `14df1305` (sólo `git fetch`; ni merge ni rebase). Nació de `951e31b3` [C].

**a. Commit congelado:** `131ad6c1` (agente S, 2026-11-23), el último que toca código, migraciones o pruebas [C: `git log -1 -- . ':(exclude)*.md'`]. Antes era `7af5775e`. Los commits posteriores son sólo documentación.
- Último de `src/`: `77751da3` (antes `24eb9910`).
- Último de migraciones: `fb1c9dd3`.
- Último de `aplicar.sh`: `254eb74f`.

**b. Archivos pedidos, desde `951e31b3`** [C: git diff --stat]:

| Archivo | Esta rama | Rediseño |
|---|---|---|
| `src/app/globals.css` | sin cambios | +691 / −160 |
| `src/app/spinus-tokens.css` | sin cambios | +1636 / −940 |
| `src/components/ui/ModalShell.tsx` | sin cambios | +346 / −224 |
| `src/components/ui/QuickPatientModal.tsx` | sin cambios | +159 / −180 |
| `src/components/layout/Sidebar.tsx` | sin cambios | +503 / −748 |
| `src/app/(app)/layout.tsx` | sin cambios | +32 / −63 |
| `playwright.config.ts` | +3 / −1: reporter `guardaAsistencia` | +51 / −1: `E2E_BASE_URL` y proyectos Duo (**conflicto probable** [D]) |
| `e2e/global-setup.ts` | sin cambios | +18 / −4: `E2E_SIN_SEMILLA` |
| `CLAUDE.md` | +163 / −79: pendientes, entorno Ubuntu, CLI 2.117.0, flujo de migraciones, Agenda v2 fundida, pruebas de navegador, QW3 | +4 / −2: el correo del escrito adjunta el PDF (zona distinta [D]) |

Otros archivos que tocan las dos ramas [C: `comm -12`]:

| Archivo | Esta rama | Rediseño |
|---|---|---|
| `DEUDA_TECNICA.md` | +614 / −39 | +325 al final (**conflicto probable al final** [D]) |
| `e2e/agenda-cache-rangos.e2e.ts` | +49 / −14 | +1 / −1 |
| `e2e/agenda-i3-por-asignar.e2e.ts` | +5 / −2 | +27 / −8 |
| `e2e/agenda-j3-ligar-ventana.e2e.ts` | +17 / −8 | +24 / −8 |
| `e2e/agenda-k5-marcas.e2e.ts` | +13 / −4 | +7 / −3 |

Ningún archivo de `src/` lo tocan las dos.

**c. Migraciones finales:** la tabla de la sección 3.

**d. Capas y velos nuevos desde `951e31b3`: ninguno** [C].
- En `src/` cambian 18 archivos de lógica y pruebas, más los 7 del agente S (`src/app/api/reservar/[codigo]/route.ts`, `src/lib/reserva/limitesReserva.ts` y 5 de `src/lib/tests/`); el rediseño no toca ninguno [C: `git diff --stat 951e31b3 14df1305` sobre esas rutas, vacío].
- El único archivo añadido es `src/lib/tests/reservarDespuesSeparado.test.ts`.
- En el diff no aparece ninguna línea con `fixed`, `inset-0`, `z-`, `backdrop`, `overlay` ni `createPortal`.

**Ya existían en la agenda** [C: git grep]:
- `globals.css`: `.ag-capa` y `.ag-hoja` (z 45), `.ag-capa-velo` (z 44) y `body::before` (z 45).
- `CapaBarra.tsx`: portal con `position: fixed`.
- `AppointmentModal.tsx`.
- `ConfirmModal.tsx` (z-[60], con velo blur).
- `HorarioModal.tsx` (z-50, blur).
- `ModalBloqueo.tsx` (z-[55]).
- `ModalInvitacionCita.tsx` (z-[60]).
- `configuracion/ConfirmacionRestablecer.tsx` (z-[60]).
- `configuracion/DialogoHorario.tsx` (z-[60]).
- `configuracion/AvisoGuardado.tsx` (fixed, z-[70]).
- `ui/Portal.tsx`.

Usan `.ag-capa` y `.ag-hoja`: BurbujaCita, BurbujaAlta, TarjetaLectura, CampanaAgenda, MenuEngraneAgenda, BuscadorCitas, MiniMes, VentanaLigarCita, ConvertirEnCita, AyudaAtajos y otros.

**e. `E2E_SIN_SEMILLA=1` con la guarda: NO** [C].
- **Esta rama no conoce la variable.** En el rediseño está en `14df1305:e2e/global-setup.ts:135-146`.
- **El rediseño no tiene `e2e/guardaAsistencia.ts`.** Su reporter es `[['list']]`.
- **Por qué no sirve:** la guarda toma su línea base en `onBegin`, después del `globalSetup` (`guardaAsistencia.ts:95-98`), y solo acusa lo nuevo (`:106-107`). Sin resembrar, una cita vieja que ya esté en la base cuenta como «conocida» aunque tape la rejilla.
- **E1 lo comprobó ejecutando:** `agenda-m3-barra` cayó con la ventana «¿Asistió el paciente?» encima, y la guarda dijo «ninguna prueba dejó citas» (ENSAYO-PRINCIPAL §5.3 f).

## 10. Agente S (2026-11-23): dos hallazgos de Angel en sus pruebas a mano

Evidencias fuera del repo: `~/spinus-fusion/ensayo-s/`.

**1. La base local no tenía los almacenes de Storage.** Ninguna migración crea
los seis buckets de producción y `db reset` los borra; las 13 policies de
`storage.objects` sí estaban (las trae `20260912190416_remote_schema`) y son
idénticas a las de la foto [C: catálogo normalizado, 13 de 13]. Ahora
`scripts/local/almacenes-locales.{sh,sql}` los pone (mismo id, público, límite y
tipos que `06-buckets.tsv` [C: diff vacío]) y la semilla lo llama al empezar.
Producción no tiene nada en Storage que el código nuevo necesite distinto [C].
Probado en navegador contra la base local con la semilla: documento emitido con
su PDF guardado, enviado (Resend simulado → Mailpit, adjunto idéntico al
emitido), regenerado y descargado; logo, firma, identificación y dos estudios
subidos. Ninguna e2e usa Storage, así que ninguna se saltaba ni fallaba por esto,
y ningún fallo anterior se atribuyó a esto [C: grep]. Dos defectos de la app,
**sin arreglar**: AG-DT-276 («Regenerar» sin el perfil en caché del navegador
guarda un PDF sin el médico) y AG-DT-277 («Enviar al paciente» usa Resend directo:
en local, con los buckets, sale un correo real).

**2. El tope de reservas bloqueaba usos legítimos.** Lo que vio Angel: el tope
de 4 por dispositivo de `reservar` (un POST del fijo y tres del primer único,
dos que no llegaron a la RPC; el segundo único chocó a los 56 min del primero)
[C: `ip_rate_limits` leída antes de tocar la base]. Cambio sólo de código
(`77751da3`): el único vigente no cuenta por IP ni por dispositivo; el fijo, 30
por IP y 8 por dispositivo cada hora; lo que no abre y el único no vigente
cuentan en «sondeo» (30/8), que se LEE sin contar antes de abrir el enlace: lleno,
429 a cualquier código (sin oráculo). Qué deja de frenar y qué sigue: AG-DT-278.
