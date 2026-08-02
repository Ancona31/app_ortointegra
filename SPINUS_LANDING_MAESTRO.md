# SPINUS — DOCUMENTO MAESTRO · Rediseño de landing pública

**Versión:** 2.0 — consolida y SUSTITUYE a PLAN_LANDING_SPINUS.md v1
**Fecha:** 29 de julio de 2026
**Rama:** `feature/rediseno-landing` · **Fuera de scope:** `(launcher)/inicio/` (home del médico logueado)

---

## 0 · PARA EL ASISTENTE QUE LEE ESTO

Este documento sustituye una sesión completa de planeación. No necesitas
contexto adicional para operar. Léelo entero antes de proponer nada.

**Qué es Spinus:** SaaS de expediente clínico electrónico (PWA) para médicos
privados en México. Construido en solitario por el Dr. Ángel M. Ancona Pérez,
cirujano de columna en ejercicio (Mérida/Umán). Fase beta. Stack: Next.js
16.2.1, React 19.2.4, Tailwind 4, TypeScript 5, Supabase, Stripe, Vercel.

**Objetivo del proyecto:** convertir la landing (`src/app/page.tsx`) en una
página que genere confianza en el primer segundo y convierta visitantes en
registros. Estrategia: curiosity gap + demostración del producto real +
acabado visual impecable con animación Motion.

**Estado del trabajo:**
- ✅ F0.a — `motion@12.43.0` instalado; `Reveal`/`Stagger`/`tokens.ts` creados;
  fix de hydration mismatch aplicado (commits e150187, 60ff25c)
- ✅ F1.1 — 13 secciones extraídas a `src/components/landing/sections/`;
  page.tsx 748→42 líneas (commit posterior a 60ff25c)
- ⏳ Siguiente: **F1.2** (contenido y estructura — sección 12 de este doc)

**Metodología de trabajo con Angel (obligatoria):**
- Respuestas breves y concisas. Un paso a la vez; no dar la siguiente
  instrucción hasta que la actual esté confirmada.
- Ningún código se escribe sin: prompt de auditoría → reporte del auditor →
  correcciones → re-auditoría → "sin bloqueantes" → prompt de aplicación.
- **`npm run build` SÍ CORRE EN WSL, y esta línea decía lo contrario.**
  Corregido el 2026-08-01 (F2.a·a2) tras ejecutarlo: `✓ Compiled successfully`,
  exit 0, desde `~/proyectos/app_ortointegra`. Lo que falla es lanzarlo **desde
  el lado Windows**, donde el CWD es una ruta UNC (`\\wsl.localhost\…`) y
  `cmd.exe` la rechaza — el error es del anfitrión, no del proyecto, y se
  confundió con un bloqueo del build.
  **Consecuencia: llevábamos todo el proyecto validando de menos en esta
  máquina.** `tsc` y `eslint` no compilan las rutas ni ejecutan la generación
  estática; el build sí, y es lo único que habría cazado un fallo de
  prerender o de frontera RSC. La validación completa de cada tanda es
  `npm run build && npx tsc --noEmit && npx eslint .`, los tres **dentro de
  WSL**. Invocación desde el lado Windows, si hace falta:
  `wsl.exe -d Ubuntu -- bash -ic 'cd ~/proyectos/app_ortointegra && npm run build'`
  (`bash -ic`, no `-lc`: nvm se carga en `.bashrc` y con `-lc` no hay `node`).
- Commits como checkpoints tras smoke test en dev server. NUNCA push a main
  sin indicación explícita de Angel. Prompts siempre en bloque de código.
- Ante desacuerdo o dato faltante: investigar (historial, web, prompt de
  investigación) antes de ceder o de repetir la pregunta. Angel valora el
  desacuerdo fundamentado.

---

## 1 · BASE DE EVIDENCIA

Toda decisión de este documento pertenece a uno de tres niveles. El nivel
se indica por sección con [E1] [E2] [E3].

**[E1] Medido — estudios con muestra:**
- 46.1% de los consumidores juzga la credibilidad de un sitio SOLO por su
  diseño visual (Stanford Web Credibility Project, 4,500+ personas). El
  juicio se forma en ~50ms. → El acabado visual es infraestructura de
  conversión, no decoración. "De la vista nace el amor" tiene respaldo.
- Formularios: 3 campos convierten 10.1%, 9 campos 3.6% (Unbounce, 41k
  páginas, 464M visitas). El registro actual de Spinus tiene 10 campos →
  deuda técnica de máxima palanca (§15).
- Mediana de conversión SaaS: 3.8% — la más baja de todas las industrias.
  Top decil B2B SaaS: 8–15%. Calibrar expectativas con esto.
- Las páginas que convierten >4% comparten: precio visible sin llamada,
  producto REAL en el hero, CTA repetido cada altura de pantalla.
- Fuente de tráfico pesa más que diseño (email convierte 77% más que paid).
  La red de colegas de Angel vale más que cualquier animación.
- Móvil ≈ mayoría del tráfico, convierte ~8% menos que escritorio →
  paridad de calidad móvil/escritorio es requisito.

**[E2] Convergencia de la élite (Linear, Stripe, Vercel, Apple) — no medido
pero unánime:** cuerpo 17–18px; H1 48–72px; máx. 2 familias tipográficas;
escala de espaciado única; ninguna sección pegada a la siguiente; superficies
planas (glassmorphism = 2021); producto real en movimiento (video/clip) en
vez de ilustración; movimiento con física (nada lineal); respuesta <100ms.

**[E3] Reglas internas — su valor es la consistencia absoluta, no el valor
individual:** variedad de layout por sección; hero asimétrico; bento con
DICOM al doble; captura sangrando el borde. Un solo valor fuera de sistema
destruye la percepción de pulido: el ojo detecta la incoherencia aunque no
sepa nombrarla. **Regla de oro: ningún valor de color, espacio, duración o
easing que no salga de las tablas de este documento.**

---

## 2 · PRINCIPIOS (no negociables)

1. **Principio rector del demo:** el demo NUNCA muestra una capacidad que el
   producto no tiene.
2. **Regla de fidelidad visual:** todo lo que represente la interfaz de
   Spinus es captura o grabación REAL de la app (cuenta demo, cero PII).
   Lo que no sea real no puede parecer pantalla: será diagrama declarado.
   No existe el punto medio.
3. **Tesis de producto (guía todo el copy):** los sistemas médicos
   existentes son lentos, complejos, rígidos y dan ansiedad — hechos para
   cumplir regulaciones, no para ayudar al médico. Spinus es lo contrario.
   → Corolario: la landing no puede estar sobrecargada. Contención =
   coherencia.
4. **Curiosity gap:** mostrar lo justo para que el médico se registre a
   descubrir el resto. Tres puertas cerradas: nota con velo (Teaser 1),
   logo con candado (Teaser 2), cupos beta limitados (Precio).
5. **Suavidad absoluta:** cero cuadros caídos al refresco nativo del
   dispositivo (120fps en ProMotion, 60 en pantallas de 60Hz). La suavidad
   es varianza cero, no promedio alto. 120Hz es el techo físico del
   navegador; nada lo supera. Optimizado para gama alta; en hardware débil
   los escenarios degradan a Reveal — nunca se envía jank.

---

## 3 · SISTEMA VISUAL

### 3.1 Color [E3 — fuente: spinus-tokens.css del producto]

```
--cs  #1e5fa8  azul brillante = --sp-primary (acción, links, acentos)
--cp  #1a3a5c  navy profundo  = bloques oscuros, hover
⚠️ TRAMPA: --cp ("primario") es el NAVY; --sp-primary apunta a --cs.
   Está invertido respecto a lo intuitivo. Verificar token, no deducir.

Tinta (azulada, NO slate):  900 #14345c · 700 #3b4a5c · 500 #5a6b81 · 350 #8a99ac
Superficies: blanco · franjas #f5f8fc · bordes 0.5px #e6ebf2
Radios: cards 16px · botones 12px
```
- Colores semánticos (verde/púrpura/ámbar/rojo) SOLO cuando representan
  datos reales del producto (citas de agenda, cortes DICOM). Nunca decoran.
- Un acento por sección. Dos bloques navy idénticos (IA y CTA final) — son
  marco de apertura y cierre, no accidentes.
- **Glassmorphism ELIMINADO** (hoy: `bg-slate-100/40 backdrop-blur-md
  border-white/30`). Superficies planas. [E2] + backdrop-blur cuesta
  rendimiento móvil.
- `NeuralBackground` ELIMINADO → lavado CSS de --cs al 3–5% solo en hero y
  CTA. Sin canvas, sin rAF.

### 3.2 Tipografía [E2 los tamaños, E3 el sistema]

**Inter variable**, `next/font`, subsets `["latin","latin-ext"]` (latin-ext
OBLIGATORIO: acentos y ñ), `axes:["opsz"]`, solo en la landing.

| Rol | Tamaño | Tracking | Line-height |
|---|---|---|---|
| Hero | `clamp(40px, 7vw, 72px)` | −0.04em | 1.02 |
| Titular sección | `clamp(30px, 4vw, 46px)` | −0.03em | 1.10 |
| Bajada | 19px | −0.01em | 1.55 |
| Cuerpo | 17px | 0 | 1.65 |
| Etiqueta/kicker | 12px | +0.12em | 1.0 |

Inter sin tracking negativo en display se ve barata — el −0.04em es la
diferencia entre "grande" y "caro". Numerales tabulares donde haya cifras.
Nota: la app queda en fuente de sistema por ahora → capturar TODO desde la
misma Mac (SF Pro) para consistencia; unificación a Inter en deuda (§15).

### 3.3 Espaciado [E2 el principio, E3 los valores]

Base 4px. Escala única: `8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`.
Padding de sección: 128px escritorio / 72px móvil.
**Ninguna sección toca la siguiente: mínimo 96px de aire.**
Ningún gap fuera de escala, jamás.

### 3.4 Variedad de layout [E3, derivado de E1-50ms]

Diagnóstico: la landing actual repite el esqueleto "badge centrado + titular
centrado + 3 cards" en 8 de 13 secciones → lectura de template en 2 scrolls,
que quema el juicio de 50ms. **Ningún esqueleto se repite dos veces
seguidas:**

| # | Sección | Esqueleto |
|---|---|---|
| 0 | Nav | barra fija que se transforma |
| 1 | Hero | ASIMÉTRICO: texto izq., captura sangrando borde der. |
| 2 | El problema | franja a sangría izq., 74% de ancho, sin centrar |
| 3 | Grid 5 cards | bento asimétrico, DICOM 2× |
| 4 | Bloque IA | navy ancho completo, texto a la izquierda |
| 5 | TEASER 1 | dos columnas: dictado / nota |
| 6 | Expediente | dos columnas invertidas: **video real** izq., texto der. |
| 7 | TEASER 2 | documento izq., controles der. · **superficie NAVY a ancho completo** (única que no repite vecino — ver nota 1 de §5.7) |
| 8 | Flujo 5 pasos | lista numerada izq., titular der. |
| 9 | Portabilidad | franja horizontal delgada de 3 ítems |
| 10 | Seguridad | 3 tarjetas en fila ⚠️ |
| 10b | Tu práctica, tuya | 2 bloques APILADOS: franja con abanico de PDFs + zócalo con foto anclada y tarjeta encima |
| 11 | Historia | retrato izq. chico, texto largo der. |
| 12 | Precio + beta | 2 tarjetas centradas, una acentuada |
| 12b | FAQ | columna estrecha centrada, filas apiladas de ancho completo |
| 13 | CTA + footer | navy centrado ancho completo |

**CTAs sembrados** [E1]: además de hero y cierre, un CTA discreto tras el
Teaser 1 y tras el Teaser 2 ("Empieza gratis →" en línea, sin bloque).

> ⚠️ **La fila 10 ya NO dice "en escalera", y no es un olvido.** La escalera
> se descartó en la QA visual de F1.3 (b1) y §5.10 quedó sin efecto para esa
> sección: con cuerpos de largo desigual, offset desigual sobre altura
> desigual dibuja un zigzag, y el tercer `mt` sacaba la tarjeta del
> contenedor. Detalle completo en **LP-DT-20**. No la reintroduzcas.
> Seguridad quedó en **3 tarjetas, sin cuarta y sin pie**: la línea de
> portabilidad de datos que llegó a vivir ahí se movió a la sección 10b, que
> es donde ese contenido es una garantía y no una nota al pie.
>
> ⚠️ **La fila 10b se numera así a propósito: NO renumeres la tabla.** Las
> referencias cruzadas de §5 y §7 van por número (§5.10, §5.11, §7·10, §7·13)
> y correrlas de sitio rompería media docena de punteros. Sección nueva =
> sufijo de letra.
>
> ⚠️ **EL ORDEN IMPLEMENTADO NO ES EL DE ESTA TABLA, y conviene saberlo antes
> de mover nada.** `src/app/(landing)/page.tsx` monta hoy: … Portabilidad →
> Interfaz → **Historia → 10b → Seguridad** → CTA. Es decir, respecto a la
> tabla están intercambiados **8 con 9** (Interfaz va después de
> Portabilidad) y **10 con 11** (Historia va antes que Seguridad). La
> consecuencia para 10b es concreta: en la tabla cierra el bloque de
> confianza antes de la parte personal, pero **en el código lo abre**, porque
> Historia ya pasó. Si alguna tanda reordena para alinear código y tabla,
> 10b viaja pegada a Seguridad, no a Historia.
>
> **Por qué 10b no repite esqueleto** (§3.4 exige que ninguno se repita): dos
> bloques APILADOS de ancho completo, cada uno con su propio visual. El
> primero es una franja horizontal `#f5f8fc` con texto a la izquierda y un
> abanico de tres hojas PDF a la derecha; el segundo es un zócalo `#f5f8fc`
> con la foto de la asistente **anclada a su borde inferior** y una tarjeta
> de agenda pisándole el borde derecho. Ninguna otra sección apila dos
> bloques de ancho completo con visual propio: las dobles columnas
> (Expediente, Interfaz, Historia) son asimétricas con el medio a un lado,
> las retículas (Features, Seguridad) son tarjetas iguales en fila, y la
> franja de Portabilidad es una sola tira de tres ítems. El anclaje de la
> figura al zócalo —que sobresale por arriba y se apoya abajo— no aparece en
> ningún otro sitio de la página.
>
> ⚠️ **ESTE ESQUELETO SUSTITUYE AL ANTERIOR, que eran dos columnas simétricas
> separadas por un filete vertical.** Aquel se implementó y se descartó al
> llegar el diseño aprobado. Con él murió la coreografía de `scaleY` ligado al
> scroll que describía §5.10b: ver el aviso de allí. No lo reintroduzcas.
>
> **Superficie de 10b: BLANCA, y la elección estaba acorralada.** Sus dos
> vecinas tienen la superficie clavada por motivos ya documentados: Historia
> debe seguir en franja (es lo único que la separa, no tiene contenedor
> interno) y Seguridad debe seguir en blanco (el lavado del CTA resuelve a
> ≈#f6f9fc, a un punto de la franja). Con las dos fijas, insertar en medio
> rompe una costura cromática sí o sí. Blanco rompe la barata: conserva el
> corte franja→blanco por arriba y deja blanco→blanco por abajo, caso que ya
> existe resuelto entre Problema y Features y que aquí llega con costura de
> 128/192/256 — el doble de los 128 que allí bastaron.
>
> ⚠️ **LA FILA 12b PESA MUCHO MENOS QUE SUS VECINAS, y eso NO es un problema
> de orden.** Anotado durante la resecuenciación de superficies (2026-07-31),
> cuando se sospechó que el FAQ había quedado a media página. Se verificó
> contra el DOM servido y **el orden es el correcto**: el FAQ es la 12ª de 14
> y debajo solo quedan el CTA y el footer, que es exactamente donde §7·12b lo
> quiere. Lo que sí es cierto es que **se lee como sección menor**, y la causa
> es su propio esqueleto, aprobado:
>
> - es la **única sección en columna estrecha** — `max-w-2xl` (672px) dentro
>   del `max-w-6xl` (1152px) común, o sea la mitad del ancho de contenido;
> - arranca con **nueve filas colapsadas** de poca altura, así que en reposo
>   ocupa una fracción de lo que ocupan Control, Seguridad o el bento;
> - no lleva visual propio: ni captura, ni retícula, ni figura.
>
> Las tres cosas son deliberadas y **ninguna se toca ahora**: la columna
> estrecha es lo que impide que 12b repita esqueleto, y el acordeón colapsado
> es lo que la hace escaneable. Pero si en **F6** el último tercio de la
> página se siente flojo o desequilibrado, la causa está AQUÍ y no en la
> secuencia — no vuelvas a mover el FAQ buscándola. Las palancas serían dar
> peso al bloque (ancho, encabezado con más aire, un ítem abierto por
> defecto), no reordenar.

---

## 4 · SISTEMA DE MOVIMIENTO

### 4.1 Registros [E2]

**Híbrido Apple + Linear, repartido por tipo de momento — nunca mezclado en
un mismo elemento:**
- **Apple (escenarios):** Hero, card DICOM, Teaser 1, Teaser 2. Ligado al
  scroll, duraciones largas, un foco por pantalla. El visitante se detiene.
- **Linear (tejido):** todo lo demás. Respuesta inmediata, springs rígidos,
  discreto. El visitante recorre.

### 4.2 Tokens (extienden los de la app, no los sustituyen)

```
DURACIONES  --sp-dur-micro 120ms (hover) · --sp-dur-base 240ms (cross-fade)
            --lp-dur-section 420ms (TODO reveal de tejido) · --lp-dur-cine 900ms
EASINGS     --sp-ease-out cubic-bezier(.2,0,0,1)  → todo el tejido
            --lp-ease-cine cubic-bezier(.65,0,.35,1) → solo escenarios
SPRINGS     soft {stiffness:120,damping:20} · snap {300,30} · heavy {60,18}
DISTANCIAS  reveal y:24 · parallax y:±24 · stagger 70ms · listas secuenciales 80ms
OFFSETS     OFF_ENTRADA ["start 0.9","start 0.35"]
            OFF_TRAVESIA ["start end","end start"]
            OFF_ANCLADO ["start start","end end"]
            OFF_SALIDA ["start start","end start"]   ← añadido en F2.b
```

> ⚠️ **OFF_SALIDA ES UN CUARTO TRAMO, añadido el 2026-08-01 al corregir una
> regresión de F2.b.** Va del techo del viewport hasta que el elemento
> desaparece por arriba. Existe porque **`OFF_TRAVESIA` no sirve para un
> elemento que arranca ya en pantalla**: su progreso en reposo no es 0 sino
> `(vh − alto sobre él)/(vh + alto propio)` —0.51 a 1440×900 y 0.63 a 2560×1440
> en el caso del hero—, y esa fracción CRECE con la altura del viewport, así que
> ningún umbral constante sobre ella está a salvo. Ese fue el defecto: el hero
> se servía con su texto ya desvanecido. `OFF_SALIDA` ancla el 0 a la posición
> de reposo por construcción y su longitud es exactamente el scroll alcanzable.
> **Criterio:** ¿la capa entra desde abajo? `OFF_TRAVESIA`. ¿Está en pantalla al
> cargar y solo se va? `OFF_SALIDA`. Detalle en la nota 4 de §5.1.
`tokens.ts` es espejo manual del CSS (motion exige números): cada constante
comenta su token de origen; el bloque --lp-* de globals.css referencia el
espejo. Divergencia = bug (deuda §15).

> ⚠️ **ESTA TABLA DECÍA «--sp-dur-base 240ms (reveals)» Y ERA FALSO EN DOS
> DIRECCIONES.** Corregido por el PM el 2026-08-01 (decisión B1 de F2.a·a1).
> El dato viejo contradecía a las propias fichas de §5: §5.2 y §5.10b dan las
> dos `--lp-dur-section` para la entrada de bloque, y `SeccionControl.tsx:147`
> ya animaba a 420 desde que se implementó. O sea que había **dos duraciones
> vivas en producción para el mismo gesto** — 240 en `Reveal.tsx` y 420 en
> Control — y la tabla respaldaba la equivocada.
>
> **Régimen vigente, sin excepciones:**
> * **420ms (`--lp-dur-section`)** — toda entrada de bloque o de sección. Es
>   lo que hace `Reveal.tsx` desde a1.
> * **240ms (`--sp-dur-base`)** — cross-fade entre estados y micro-interacción.
>   En el tejido su uso vivo es de **retraso**, no de duración: es el desfase
>   del remate de §5.2.
> * **120ms (`--sp-dur-micro`)** — hover. Los **15** hover de la landing corrían
>   a **200ms**, valor que nunca estuvo en esta tabla; a1 bajó 12 y a2 los 3
>   restantes de `SeccionHero.tsx`. También se sustituyó el único easing suelto
>   del tejido —un `cubic-bezier(0.32,0.72,0,1)` en `SeccionFeatures.tsx`— por
>   `--sp-ease-out`. **No queda ningún `duration-200` en la landing**
>   (verificado con grep tras a2).

### 4.3 Reglas de rendimiento [E2 + techo físico]

1. Solo se anima `transform` y `opacity` — únicas propiedades compuestas
   fuera del hilo principal. `width/height/top/left` = relayout = jank.
2. El progreso de scroll JAMÁS pasa por estado de React. Solo `MotionValue`
   + `useTransform`. Un `useState` por cuadro garantiza cuadros caídos.
3. Máx. 4 capas animando simultáneamente por escenario. `will-change:
   transform` solo en capas activas, se retira al terminar.
4. Un solo `useScroll` por escenario; las capas derivan con `useTransform`.
5. Escenarios anclados nunca se solapan verticalmente.
6. `blur()` solo donde está presupuestado (H1 en carga, velo del Teaser 1).
   Es el filtro más caro.
7. **Hydration:** NUNCA ramificar el render con `useReducedMotion` (es
   solo-cliente → DOM distinto servidor/cliente → elemento invisible).
   El árbol es idéntico siempre; reduced-motion se resuelve en CSS vía
   `[data-lp-reveal]` en el bloque `@media (prefers-reduced-motion:reduce)`
   existente al final de globals.css. Bug ya cometido y corregido (60ff25c).
8. `once:true` en tejido; escenarios REVERSIBLES (retroceder deshace).
9. Presupuesto medible: LCP < 2.5s; cero cuadros caídos al refresco nativo
   durante los 4 escenarios en hardware de referencia (MacBook + iPhone
   reciente); en hardware débil degradar a Reveal — nunca enviar jank.
10. Móvil: `100dvh` nunca `100vh`; sin hover (`Tilt` no existe); escenarios
    por toque, no por scroll.

### 4.4 Componentes de tejido

| Componente | Mecánica | Dónde |
|---|---|---|
| `<Reveal>` | OFF_ENTRADA, opacity 0→1, y 24→0, once | secciones |
| `<Stagger>` | `staggerChildren` 70ms — SIN wrappers extra (rompen grid span; usar variantes padre→hijo) | grids, listas |

> ⚠️ **`<Stagger>` SE REESCRIBIÓ EN F2.a·a2 y esta fila ya describe lo
> implementado, no una intención.** El componente es hoy SOLO el contenedor de
> variantes padre: no emite ningún elemento propio, y cada hijo anima porque el
> consumidor lo escribe como `motion.*` con las variantes compartidas que
> `Stagger.tsx` exporta. La versión anterior sí envolvía a cada hijo y por eso
> rompía el `col-span` de la card DICOM, el `gap-px` de Portabilidad y el
> `items-stretch` de Seguridad. Pudo reescribirse sin migración porque no tenía
> un solo consumidor.
>
> **Dos variantes exportadas, y elegir mal la segunda es un defecto visible:**
> * `VARIANTES_ITEM` — `opacity` + `y: 24`. El caso normal.
> * `VARIANTES_ITEM_FUNDIDO` — solo `opacity`. **Obligatoria cuando el
>   contenedor pinta un fondo que se ve entre sus hijos**, porque el hueco que
>   el hijo vacía al desplazarse se pinta de ese fondo. Caso vivo: la franja de
>   Portabilidad, cuyo `gap-px` sobre `bg-[var(--lp-border)]` habría mostrado
>   una banda #e6ebf2 de 24px sobre cada tarjeta durante los 420ms del reveal.
>
> **El `gap` se elige por la naturaleza de la lista, no por costumbre:**
> `STAGGER.siblings` (70ms) para hermanos sin orden, `STAGGER.list` (80ms) para
> secuencias donde el orden de aparición ES el contenido —los 5 pasos del flujo
> de §5.8— y `STAGGER.deck` (90ms) para la cascada diagonal del bento (§5.3).
> `SeccionInterfaz.tsx` es el único archivo donde conviven los dos primeros.
| `useTilt()` | hover ±3°, sombra sigue ángulo, <100ms | 5 cards del grid |

> ⚠️ **ES UN HOOK (`src/hooks/useTilt.ts`), NO EL COMPONENTE `<Tilt>` QUE ESTA
> FILA ANUNCIABA.** Decisión de PM en F2.a·a3 (B3), forzada por el propio
> sistema: un componente envolvente reintroduce el wrapper que esta misma tabla
> prohíbe dos filas más arriba, y lo haría justo sobre la card con
> `sm:col-span-2`. Es el mismo defecto que obligó a reescribir `Stagger`.
>
> **Absorbe el hover que antes vivía en CSS.** Desde a2, `hover:-translate-y-1`
> y `active:scale-[0.98]` estaban MUERTOS en las cards del bento: en cuanto una
> card anima `y`, `motion` escribe `transform` inline y gana a la utilidad de
> Tailwind (`motion-dom/.../build-transform.mjs:65-67`). a3 los reproduce como
> `whileHover`/`whileTap`, que es la única forma de que convivan con la
> inclinación. **Las cuatro clases retiradas no se reponen: reintroducirlas no
> las revive.**
>
> **`SeccionSeguridad` recibe SOLO el levantamiento**, sin inclinación y sin el
> hook — sus 3 tarjetas habían perdido el mismo `hover:-translate-y-1` en a2 y
> se quedaban sin dueño. El tilt sigue siendo exclusivo del bento.
>
> ⚠️ **LA SOMBRA ES UNA EXCEPCIÓN DECLARADA A §4.3·1**, que solo admite
> `transform` y `opacity`. §4.4 pide que la sombra siga al ángulo y eso no se
> puede hacer con `transform` sin sacarla a una capa propia por card. Se acepta
> el repintado porque está acotado: una card cada vez, solo con ratón, solo
> mientras el cursor está encima. Si F6 mide coste, la salida es una capa
> absoluta con `opacity`, no retirar la sombra.
>
> **Táctil y reduced-motion se resuelven sin ramificar el render** (§4.3·7): el
> descarte va en el handler (`pointerType !== 'mouse'`, más estricto que el
> filtro propio de motion, que deja pasar `pen`) y el aplanado lo da el
> `transform: none !important` de `globals.css:924`, porque las cards llevan
> `data-lp-reveal` por ser hijas del `Stagger`. El guard del handler existe
> además para que **la sombra tampoco se mueva** bajo la preferencia: la regla
> CSS no cubre `box-shadow`.
| `<Parallax>` | OFF_TRAVESIA, y +24→−24 | bloque de encabezado o columna de texto, foto Historia |

> ⚠️ **ESTA FILA DECÍA «y +40→−40» EN «títulos», Y LAS DOS COSAS ERAN
> INAPLICABLES.** Corregido en F2.a·a4 con la medición delante.
>
> **1 · El `<h2>` desnudo no es un objetivo viable a NINGUNA distancia útil.**
> El titular se mueve y su bajada no, así que el recorrido se come el hueco
> entre los dos. Medido en las seis secciones:
>
> | Sección | Hueco bajo el titular | A ±40 |
> |---|---|---|
> | Features | `mt-3` = 12px | solapa 28px |
> | Portabilidad | `mt-4` = 16px | solapa 24px |
> | Expediente · Interfaz · Historia | `mt-6` = 24px | solapa 16px |
> | Seguridad | cierra el bloque, `mb-12` = 48px | despeja 8px |
>
> Cinco de seis se solapaban —texto de 46px encima de texto de 19px— y bajar la
> distancia no lo salva: respetar los 12px de Features exigiría ±8, que no se
> percibe. **Lo que se mueve es el bloque, no el titular:** encabezado completo
> (titular + bajada) en Features, Portabilidad y Seguridad; columna de texto
> entera contra la del mockup en Expediente e Interfaz —ahí el bloque de
> titular tampoco bastaba, dejaba las viñetas (`mt-8`) en el camino—; y la foto
> en Historia, único caso que la ficha ya pedía sobre el elemento correcto.
>
> **2 · ±24 y no ±40.** Con 40 el encabezado despejaba la retícula por 8px, y
> ocho píxeles se los lleva por delante el primer cambio de tipografía o de
> espaciado, en silencio. Con 24 el margen es de 24. Token: `DIST.parallax`.
>
> **3 · `Parallax` y `Reveal` NUNCA en el mismo elemento:** los dos animan `y` y
> el continuo pisaría al puntual. Van anidados, parallax fuera —es el dueño de
> la posición y quien debe llevar el `mb-*`— y reveal dentro.
>
> ⚠️ **NO "OPTIMICES" LAS 7 INSTANCIAS CON UN `useScroll` DE PÁGINA.** Se
> evaluó y se descartó con el código del paquete delante: `motion` ya comparte
> el listener por contenedor de scroll vía `WeakMap`
> (`framer-motion/.../scroll/track.mjs:6-8,34-55`) y batchea medición y
> notificación en el orden lectura→escritura que evita el layout thrashing. Las
> 7 son **1 listener + 1 de resize**, no 7 de cada. Hacerlo a mano obligaría a
> leer `offsetTop` fuera de la fase de lectura de motion, o sea a provocar el
> forced reflow que hoy no ocurre.
| `<CountUp>` | MotionValue directo al DOM | cupos beta |
| Nav | transparente→sólido+blur, logo encoge, barra progreso 2px, continuo | siempre |

> **IMPLEMENTADO** en `SeccionNav.tsx` (F2.a·a5). Tres capas, un solo
> `useScroll` (§4.3·4), umbral de 64px (`NAV.umbral`).
>
> ⚠️ **LA BARRA DEL NAV NO SE ANIMA EN ALTURA, y no es un recorte de alcance.**
> La `h-14` es fija: animar la altura es relayout y §4.3·1 no lo admite. El
> logo encoge (`scale` del lockup completo, `origin-left`) dentro de una barra
> que no se mueve. Es menos de lo que hacen Linear o Stripe y está aceptado por
> el PM (B5).
>
> ⚠️ **EL FONDO ES UNA CAPA `absolute`, NO UNA CLASE DEL `<header>`.** Animar
> `background-color` viola §4.3·1, así que lo que anima es la `opacity` de una
> capa que lleva el `bg-white/80`, el `backdrop-blur-xl` y el borde. El
> argumento de F1.3·e5 sobre la translucidez se conserva intacto: las clases
> cambiaron de elemento, no de valor.
>
> ⚠️⚠️ **`[data-lp-reveal]` TIENE UNA EXCEPCIÓN, Y ES LA BARRA DE PROGRESO.**
> La regla de `globals.css:922-926` fuerza `transform: none !important` porque
> asume que el estado final de un reveal es "sin transform". Sobre un `scaleX`
> de progreso eso significa **barra llena permanente** — diría "fin de página"
> nada más cargar. La barra es la única capa de la landing que NO lleva el
> atributo. Antes de añadírselo a cualquier capa nueva, pregúntate si su estado
> final es realmente `transform: none`.
>
> **Bajo reduced-motion la barra sigue viva, y es decisión razonada:** refleja
> 1:1 una acción del propio usuario, sin easing ni recorrido propio, y es
> información que no está dicha en ningún otro sitio. Congelarla no reduciría
> movimiento, borraría el dato. Las otras dos capas sí se congelan.
>
> **Pendiente medido en F6:** el `backdrop-blur-xl` de la capa de fondo puede
> seguir costando compositor aunque esté a `opacity: 0` arriba de la página.
> No se resolvió en a5 a propósito — sin medición no hay decisión.

---

## 5 · COREOGRAFÍA POR SECCIÓN (fichas completas)

Formato: cada capa con propiedad, valores, disparador/tramo, easing.
RM = con prefers-reduced-motion: estado final vía `[data-lp-reveal]`.

### 5.1 Hero — ESCENARIO
**Escritorio:**
| Capa | Prop | Origen→destino | Disparo | Easing |
|---|---|---|---|---|
| Kicker | opacity,y | 0→1, 14→0 | carga +0ms, 420ms | ease-out |
| H1 L1 | opacity,y,blur | 0→1, 30→0, 8→0 | carga +90ms, 900ms | ease-cine |
| H1 L2 | ídem | ídem | carga +180ms | ease-cine |
| Subtítulo+autoría | opacity,y | 0→1, 20→0 | carga +300ms, 420ms | ease-out |
| CTAs | opacity,y,scale | 0→1, 16→0, .96→1 | carga +390ms | spring.soft |
| Captura | y,scale,opacity | 120→0, .88→1, 0→1 | scroll 0–0.70 OFF_ENTRADA | lineal/scroll |
| Captura deriva | scale | 1→1.03 | scroll 0.70–1.0 | lineal |
| Texto salida | y,opacity | 0→−70, 1→.25 | scroll 0.45–1.0 OFF_TRAVESIA | lineal |

**Móvil:** carga idéntica con distancias ×0.6; captura igual; salida del
texto ELIMINADA. **Presupuesto:** máx 2 capas simultáneas en scroll; blur
solo en carga.

> ⚠️ **IMPLEMENTADO en `SeccionHero.tsx` (F2.b). La tabla de arriba describe la
> intención; estas cuatro correcciones describen lo que corre.**
>
> **1 · LA ENTRADA DE LA CAPTURA NO PODÍA IR LIGADA AL SCROLL, y la fila 6 lo
> pedía.** `OFF_ENTRADA` cierra en `start 0.35` y la captura del hero está
> siempre por encima del pliegue: su borde superior arranca entre el **26% y el
> 48% del viewport** según el ancho (medido con la geometría documentada en el
> propio archivo — marco de 464px a 1024, ~720 a 1920, nav `sticky` de 56
> encima). El progreso vale **1 en el primer cuadro** y solo bajaría con scroll
> negativo, que no existe: **esa entrada no la vería nadie nunca**. Pasa a la
> fase de carga como sexto beat (+480ms, `--lp-dur-cine`), que es el único
> momento en que puede verse. **Lo ligado al scroll es solo la deriva**, y
> cuelga de la travesía de la sección, no de `OFF_ENTRADA`.
>
> **2 · LA CAPTURA NO ANIMA `opacity`, Y ES POR EL LCP.** Es el elemento LCP de
> la página. Chrome descarta como candidato a LCP todo elemento con opacidad 0,
> así que un fundido mueve la marca desde "la imagen pintó" —que con el preload
> de `priority` ocurre antes de que baje el bundle— hasta "hidrató y terminó la
> animación": segundos en red lenta, contra el presupuesto de §4.3·9. `y` y
> `scale` no tienen ese efecto (el elemento se pinta, solo que desplazado) ni
> computan CLS. **Regla que queda para las tres fases que faltan: ninguna capa
> que contenga al LCP arranca en opacidad 0.**
>
> **3 · LA DERIVA VA SOBRE LA CAPTURA, DENTRO DEL MARCO.** Aplicada al marco,
> un 1.03 empuja su borde derecho ~11px fuera del viewport —esa columna sangra
> por el borde (§3.4·1)— y un `transform` SÍ genera área desbordable, al
> contrario que la `box-shadow`. Sería scroll horizontal. Dentro, el
> `overflow-hidden` del marco recorta y se lee como la captura acercándose.
> Corolario general: **en el hero solo se puede escalar hacia abajo**; hacia
> arriba, nunca sobre el marco.
>
> **4 · UN SOLO `useScroll` (§4.3·4), y NO puede ser el de `OFF_TRAVESIA`.**
> Las dos capas continuas derivan de él: salida del texto 0→1 y deriva 0.30→1
> sobre **`OFF_SALIDA`** — dos capas como mucho, que es el presupuesto.
>
> ⚠️⚠️ **ESTE PUNTO DECÍA "el de la travesía… salida 0.45→1, deriva 0.70→1" Y
> ERA UNA REGRESIÓN DE COLOR EN PRODUCCIÓN.** Reportada y corregida el
> 2026-08-01, horas después de aplicar F2.b. `OFF_TRAVESIA` mide el recorrido
> por el viewport ENTERO, incluida la parte que un elemento pegado al techo del
> documento nunca hace: bajo el nav `sticky` de 56px, el hero sale del primer
> cuadro con `(vh − 56)/(vh + altoHero)` ya recorrido — **0.51 a 1440×900, 0.56
> a 1920×1080, 0.63 a 2560×1440** —, siempre por delante del 0.45. La página se
> servía con la columna de texto a `opacity` .92–.75 y y ≈ −8/−25px: el H1
> lavado hacia azul claro y el botón primario visiblemente más claro que el
> MISMO botón del nav. **Ninguna clase de color había cambiado** — el CSS
> compilado daba `color: var(--lp-ink-900)` y `color: var(--lp-accent)` en las
> dos líneas, y un único utilitario compartido para el degradado de los dos
> botones. Era la opacidad del ancestro.
>
> **Y no se arregla subiendo el umbral:** la fracción ya recorrida en reposo
> CRECE con la altura del viewport y tiende a 1, así que cualquier constante
> sobre `OFF_TRAVESIA` se rompe en la pantalla siguiente. Lo que hay que anclar
> es el CERO. De ahí el cuarto tramo de §4.2.
>
> **Lección transferible a los tres escenarios que faltan:** `OFF_TRAVESIA`
> vale para lo que ENTRA desde abajo (los 7 `Parallax`); para lo que arranca ya
> en pantalla, su progreso en reposo no es 0 y hay que usar `OFF_SALIDA` o un
> tramo anclado.
>
> **Móvil y RM se resuelven en CSS, sin ramificar el render** (§4.3·7): las
> distancias ×0.6 son cuatro `--lp-hero-y-*` con override en
> `@media (width < 40rem)` —el componente pasa la VARIABLE, no el número, y
> `motion` la resuelve al arrancar—, y la eliminación de la salida en móvil es
> `[data-lp-hero-salida]` en ese mismo bloque. `[data-lp-reveal]` neutraliza
> además `filter` desde esta tanda, por el blur del H1.
>
> **Las dos líneas del H1 son `block`, ya no las separa un `<br />`.** Es
> obligado, no cosmético: `transform` y `filter` no aplican a caja inline (la
> misma trampa que §5.2 documenta para el remate). Maqueta idéntica. Lo que NO
> se puede usar es `inline-block`, que sí volvería indivisible cada mitad.

### 5.2 Franja del problema — tejido
La frase es una bisagra y su estructura retórica es enunciado → **giro**.
La coreografía es esa estructura: el bloque entra entero y el remate llega
un beat después, para que el giro aterrice solo.

| Capa | Prop | Origen→destino | Tramo | Easing |
|---|---|---|---|---|
| Frase (el `<p>`) | opacity,y | 0→1, 24→0 | entrada +0ms, `--lp-dur-section` | ease-out |
| Remate (el `<span>`) | **opacity** | .25→1 | entrada +`--sp-dur-base` (240ms), `--lp-dur-section` | ease-out |

⚠️ **EL REMATE ANIMA `opacity` Y NADA MÁS. No le pongas `y`.** Es un
`<span>` inline dentro del `<p>`, y `transform` no aplica a elementos
inline: haría falta `inline-block`, que **impide que el texto rompa por
dentro**. Medido con la tipografía real: el remate ("— no para ayudar al
médico.", 27 caracteres) es una tirada de **392px** que como `inline-block`
sería indivisible, contra líneas de **358px a 390 de viewport** y **328px a
360** — desborda por 34 y 64px respectivamente. A 768 sí cabría (521px de
línea), pero la coreografía no puede depender del breakpoint. `opacity` sí
aplica a inline y además no toca el layout: la frase ocupa su caja desde el
primer cuadro y solo aparece la tinta.

⚠️ **Arranca en .25, NO en 0.** Con 0 hay 240ms de hueco en mitad de una
frase, que se lee como fallo de render, no como énfasis. Desde .25 el
remate está presente y lo que ocurre es que **se oscurece**, que es
exactamente lo que dice el copy.

**Móvil:** idéntico. La franja pasa de `sm:w-[74%]` a ancho completo, pero
eso es layout, no coreografía; ninguna distancia cambia.
**RM:** `data-lp-reveal` en el `<p>` **y también en el `<span>`** — la regla
de `globals.css:905` targetea el atributo, no sus descendientes, así que sin
el segundo el remate se quedaría en .25 para siempre.

> ⚠️ **ESTA FICHA CORRIGE UN DATO CADUCADO.** Decía: *"La segunda mitad de
> la frase ya está en `--sp-ink-350` (baja de contraste tipográfica, no
> animada)"*. **Ya no es cierto y no debe volver.** El QA de F1.3 (b2)
> **invirtió el énfasis**: hoy la PRIMERA mitad va apagada en `#5a6b81`
> (ink-500, 5.45:1) y el REMATE va oscuro en `#14345c` (ink-900, 12.53:1) —
> `SeccionProblema.tsx:87,89`. El `#8a99ac` (ink-350) que la ficha vieja
> daba por hecho mide **2.90:1** y está proscrito como texto. El golpe está
> en el giro, no en el enunciado; el gris caía antes sobre el remate y lo
> apagaba justo donde debía pegar.

### 5.3 Grid bento — tejido (el ESCENARIO DICOM está CANCELADO)

> ⚠️⚠️ **EL ESCENARIO DE LA CARD DICOM NO SE IMPLEMENTA. Decisión de Angel,
> 2026-08-01, tomada al abrir F2.b.** La tabla de abajo se conserva como
> registro de lo que se diseñó, pero **NO es una instrucción viva**: describe un
> scrub de `currentTime` sobre un video que ya no se va a grabar (§6 canceló el
> Video 2 el mismo día). Ninguna tanda debe implementarla mientras no exista el
> asset.
>
> **Estado vigente de la card DICOM:** ESTÁTICA. Se queda con el tejido que ya
> tiene del bento —`Stagger` diagonal (§4.4·`STAGGER.deck`) y `useTilt`, ambos
> de F2.a·a3— y con nada más. No es una entrega a medias: es el estado en el que
> se queda hasta que existan LAS DOS cosas que le faltan, un asset grabado y el
> rediseño del visor.
>
> **El `media: true` de `SeccionFeatures.tsx:15,211` SE QUEDA.** Reserva la
> zona a media sangre de la card y no lo retires por leer esto — §6 ya lo dice
> con las mismas palabras. Lo que reserva sigue sin decidirse.
>
> **Alcance real de F2.b, por tanto: solo §5.1.** De los cuatro escenarios
> Apple de §4.1, este deja de ser uno hasta nuevo aviso; quedan Hero (hecho),
> Teaser 1 (F4) y Teaser 2 (F3).

- Grid: `Stagger` diagonal desde DICOM (delays 0/.09/.18/.27/.36s) + `Tilt`.
- **Card DICOM (escenario):** OFF_ENTRADA sobre la card. — ⛔ CANCELADO, ver aviso.

| Capa | Prop | Origen→destino | Tramo |
|---|---|---|---|
| ~~Card~~ | ~~scale,opacity~~ | ~~.96→1, 0→1~~ | ~~0–0.25~~ |
| ~~Video DICOM~~ | ~~`currentTime`~~ | ~~0→duración~~ | ~~0.20–0.85~~ |
| ~~Contador n/N~~ | ~~número~~ | ~~1→N~~ | ~~0.20–0.85~~ |
| ~~Etiqueta~~ | ~~opacity,y~~ | ~~0→1, 10→0~~ | ~~0.10–0.35~~ |

~~El scroll RECORRE los cortes (scrub de video, ver §6). >0.85 queda en el
último corte; retroceder retrocede la serie.~~ **~~Móvil:~~** ~~arrastre
horizontal del dedo sobre la card controla el currentTime.~~

### 5.4 Bloque IA — tejido
`Reveal` del bloque navy; chips en `Stagger` 70ms. Los chips son el
selector del Teaser 1 (resuelve su falsa afordancia actual).

### 5.5 TEASER 1 · Nota con IA — ESCENARIO ANCLADO
Contenedor `h-[220vh]`, hijo sticky `top-0 h-dvh`.
| Capa | Prop | Origen→destino | Tramo |
|---|---|---|---|
| Panel dictado | opacity,x | 0→1, −30→0 | 0–0.12 |
| Typing dictado | índice carácter | 0→len | 0.08–0.30 |
| Pulso procesado | opacity+shimmer | 0→1→0 | 0.26–0.42 |
| Typing nota SOAP | índice carácter | 0→len | 0.38–0.74 |
| Velo ANÁLISIS/PLAN | blur,opacity | 0→10, .9→.35 | 0.72–0.86 |
| CTA "Regístrate…" | opacity,scale | 0→1, .94→1 | 0.86–1.0 |
**El typing va ligado al scroll y es REVERSIBLE** — retroceder desescribe.
El visitante siente que él genera la nota. Cambiar de chip resetea al
inicio del tramo. Cero llamadas a IA — datos scripted. Al pie: "Tú validas
y firmas." **Móvil:** 6 pasos discretos con botón siguiente.
CTA sembrado inline al salir de la sección.

### 5.6 Expediente — tejido + VIDEO 1

**IMPLEMENTADA.** Dos columnas invertidas. La tabla es lo que hay en el código.

| Capa | Prop | Origen→destino | Tramo | Easing |
|---|---|---|---|---|
| Retícula entera | opacity,y | 0→1, 24→0 | entrada, `--lp-dur-section` | ease-out |
| Columna de texto | y | +24→−24 | `OFF_TRAVESIA` | lineal/scroll |
| 4 viñetas | opacity,y | 0→1, 24→0 | stagger 70ms tras la entrada | ease-out |
| Video | — | — | — | — |

⚠️ **EL VIDEO NO ANIMA NADA PROPIO, y esa fila vacía es la ficha.** Entra
dentro del `Reveal` de la retícula (a1) y se mueve con el `Parallax` de la
columna vecina (a4) — nada más. **Ningún scrub, ningún `useScroll` sobre él:**
el scrub de vídeo es del DICOM (§5.3) y es lo que lo distingue. Si algún día
ves `useScroll` en `SeccionExpediente.tsx`, alguien confundió las dos fichas.

Lo único que el video hace por su cuenta es reproducirse UNA vez al entrar en
cuadro, y lo gatea el navegador —Chrome y Safari no reproducen automático lo
que está fuera de viewport—, no código nuestro.

**Al terminar rebobina al primer fotograma y se para ahí.** No es bucle: el
elemento queda en pausa. Antes se congelaba en el último fotograma y se leía
como atascado.

⚠️ **EL PÓSTER SE QUEDA COMO ESTÁ Y NO HAY QUE REGENERARLO.** Se evaluó
cambiarlo al fotograma del expediente abierto para conservar esa imagen en
reposo, y **no funcionaría**: el póster solo gobierna el estado ANTERIOR a la
primera reproducción. Después, el elemento pinta su fotograma actual —el 0,
tras el rebobinado—, así que un póster distinto solo lograría que el antes y el
después mostraran pantallas diferentes. El precio asumido es que en reposo se
ve la lista de pacientes y no el expediente; se acepta porque el fotograma
inicial es la afordancia correcta del clic de repetición.

**Un clic (o Enter/Espacio) sobre el área del video lo repite desde el
principio.** El área entera es un `<button>` nativo: sin icono de play, sin
barra y sin cromo de reproductor (§6·4), solo `cursor-pointer` y anillo de foco
—que no es cromo, es lo que WCAG 2.4.7 exige a un control enfocable—. El
`aria-label` del botón describe acción y contenido en una frase y el `<video>`
va `aria-hidden` para no anunciarse dos veces.

⚠️ **ESTA SECCIÓN NO SANGRA POR LA IZQUIERDA. Se probó y se retiró.** El borde
izquierdo es el de lectura: las catorce secciones arrancan en la misma x y esa
columna invisible sostiene el ritmo de la página. Romperla en un solo sitio se
lee como descuadre, no como recurso. **El sangrado es un recurso de borde
DERECHO en esta landing** —donde no hay nada que alinear— y no es simétrico.
El ancho se recupera con el reparto `lg:grid-cols-[5fr_4fr]`, y las columnas
van `items-start` porque el video es ~180px más bajo que su texto y centrarlo
lo dejaba flotando.

⚠️ **`Parallax` en la COLUMNA DE TEXTO, no en el título.** El título suelto
chocaba con su bajada; el detalle está en §4.4.

### 5.7 TEASER 2 · Receta — ESCENARIO ANCLADO → INTERACTIVO
Contenedor `h-[260vh]`. **Fase A (scroll 0–0.70) — ensamblaje:**
| Capa | Prop | Origen→destino | Tramo |
|---|---|---|---|
| Membrete | y,opacity | −80→0, 0→1 | 0–0.16 |
| Cajas paciente/edad/sexo/fecha | índice 0→4, cada una y 12→0 | 0.12–0.28 |
| Filas medicamentos | índice 0→4, stagger interno | 0.24–0.46 |
| Módulos QR | rects visibles 0→N | 0.42–0.62 |
| Línea de firma | opacity 0→1 | 0.58–0.70 |
**Fase B (>0.70) — el anclaje TERMINA y entrega el control:** canvas de
firma (dedo/mouse), 3 swatches que re-tiñen barra sup., "Rx", encabezado de
tabla, barras de sección y barra inf.; candado en el slot del logo
("Personalízalo con tu logo — al registrarte"); QR escaneable de verdad →
`/demo/receta` (réplica de la página de verificación real, datos ficticios,
aviso de demo). No se puede firmar mientras se scrollea — por eso el corte.
Copy firma: "Configura tu firma una vez. Se estampa sola en todos tus
documentos." + "o sube una foto de tu firma". Fila de 7 miniaturas
estáticas de los demás formatos: "y estos 7 más". **La firma vive SOLO en
el navegador: sin fetch, sin toDataURL fuera del componente, sin Supabase —
comentario obligatorio en el archivo.** QR = SVG estático pre-generado en
/public/demo/ (cero dependencias nuevas). Réplica en HTML/CSS igualando la
fuente del PDF real, no la de la landing (deuda de desfase §15).
**Móvil:** ensamblaje en 5 pasos por toque; fase B idéntica.
CTA sembrado inline al salir.

> ⚠️ **IMPLEMENTADO (F3, 2026-08-02)** en `SeccionReceta.tsx` +
> `components/landing/teaser2/`. La ficha de arriba es la intención; estas ocho
> notas son lo que corre.
>
> **1 · LA SUPERFICIE ES NAVY A ANCHO COMPLETO, y era la única posible.** La
> sección entra entre Expediente (`--lp-surface`) y Portabilidad
> (`--lp-surface-alt`): en blanco repite la de la que viene, en `alt` repite la
> de la que sigue. Navy deja la cadena blanco → navy → alt sin dos superficies
> iguales seguidas. Además lo que se enseña es una HOJA BLANCA, y sobre fondo
> oscuro se lee como un documento sobre una mesa —foco único de §4.1— mientras
> los controles se leen como controles. Precedente no contiguo en §3.4·4.
>
> **2 · EL ANCLAJE ES `lg`, NO `sm`, y el conductor del progreso usa el MISMO
> umbral.** Por debajo de `lg` la retícula cae a una columna y la hoja (673px)
> más los controles (~600px) suman ~1 300px dentro de un `sticky h-dvh`: anclar
> ahí sirve media escena fuera de cuadro y sin forma de alcanzarla, porque el
> scroll está ocupado gobernando el ensamblaje. Es un desvío consciente de la
> definición de "móvil" de §5.2 (previo a `sm`) y vale SOLO para esta ficha.
>
> **3 · LOS TOQUES NO SON UNA VERSIÓN REDUCIDA.** Los 5 pasos llevan el avance
> al final de cada beat (`RECETA.pasos`), o sea recorren exactamente los mismos
> tramos que el scroll. Un solo `MotionValue` de avance para toda la escena
> (§4.3·4) que escribe o el scroll o el dedo, decidido en un `ref` resuelto tras
> montar — sin ramificar el render (§4.3·7).
>
> **4 · LOS ÍNDICES DE LA TABLA SE RECONCILIAN ASÍ.** "Cajas … índice 0→4"
> nombra cuatro y cuenta cinco: son las 4 cajas de datos **más la caja de
> diagnóstico**, que si no se quedaba sin beat. "Filas medicamentos, índice
> 0→3" con 3 medicamentos son **la barra de sección + encabezado de tabla como
> elemento 0** y las 3 filas. Nada de la hoja queda fuera de un beat.
>
> **5 · EL QR SE ARMA POR BANDAS, NO POR MÓDULOS.** Son 441 módulos oscuros
> (versión 3, nivel M): animar uno a uno son 441 valores y 441 nodos, que se
> comen el presupuesto de §4.3·3 ellos solos. Van repartidos en **8 bandas
> diagonales**, un `<path>` cada una, y la aparición barre el símbolo como una
> impresión. Generado con el paquete `qrcode` que YA es dependencia (lo usa la
> receta real) — §12 prohíbe librerías QR nuevas y generarlo en cliente, y esto
> no es ninguna de las dos: es un artefacto estático.
>
> **6 · LA HOJA ESCALA CON UNIDADES DE CONTENEDOR Y LOS NÚMEROS DEL PDF SON
> LITERALES.** `--rx-u = 100cqw / 612` (612pt = ancho de carta en
> `@react-pdf`), así que cada valor escrito en la réplica ES el valor de
> `RecetaPdf.tsx`. Auditar el desfase pasa a ser comparar dos columnas de
> cifras. La hoja no se re-maqueta a ningún ancho: se encoge como papel.
>
> **7 · LA FUENTE NO ES LA DEL PDF, y es el único punto donde la réplica cede.**
> §5.7 pide igualar la del PDF (Roboto). La única copia de Roboto del repo son
> ~2.6MB de base64 dentro de `src/lib/pdf/fonts.ts`, un módulo que solo se
> importa dinámicamente al generar un PDF; servirlo a la landing —o añadir una
> segunda familia por webfont— es peso nuevo en la página cuyo LCP ya está
> presupuestado en §4.3·9. La hoja usa Inter, que ya está cargada. Va a la misma
> deuda de desfase.
>
> **8 · `/demo/receta` ESTRENA LA MINIMIZACIÓN QUE LA PÁGINA REAL NO TIENE:**
> iniciales del paciente y **sin diagnóstico ni CIE-10**, más `noindex` y sin
> `®`. Es la política que §11 tiene pendiente para `/r/[folio]`. No la
> "alinees" con la real copiándole el nombre completo — sería una regresión de
> privacidad en nombre de la consistencia.
>
> ⚠️ **HALLAZGO ABIERTO — EL NOMBRE DE LA PACIENTE NO COINCIDE CON EL VIDEO.**
> La orden pedía verificarlo "con acentos incluidos". Verificado contra el
> primer fotograma (`public/landing/expediente-demo-poster.jpg`): la cuenta
> demo escribe **"Ana Gomez Sanchez"**, SIN acentos (y "Dr. Angel Perez"
> también). El teaser usa la forma correcta, "Ana Gómez Sánchez", porque es la
> que confirmó Angel y porque en el demo se controla cada carácter. **El hilo
> narrativo se sostiene, pero la cuenta demo tiene una falta de ortografía en
> producción de cara al video.** Se arregla sembrando de nuevo la cuenta (F0.b)
> y regrabando, no desacentuando la landing.

### 5.8 Flujo 5 pasos — tejido
`Stagger` vertical 80ms — el orden de aparición DIBUJA la secuencia.
Números en gradación de un solo tono azul (nunca 5 colores).

### 5.9 Portabilidad — tejido
`Stagger` horizontal 70ms. Nada más: es franja de apoyo.

### 5.10 Seguridad — tejido
`Stagger` en las 3 tarjetas (70ms, `STAGGER.siblings`).

> ⚠️ **LA ESCALERA ESTÁ DESCARTADA — esta ficha decía "en escalera (offsets
> verticales 0/24/48px estáticos)" y ese inciso QUEDA SIN EFECTO.** La QA
> visual de F1.3 (b1) lo descartó: con cuerpos de largo desigual e
> `items-start`, offset desigual sobre altura desigual dibuja un zigzag, no
> una diagonal, y el tercer `mt` sacaba la tarjeta del contenedor. El grid
> lleva hoy `items-stretch` explícito. **F2.a NO debe reponer los offsets.**
> Motivo completo en **LP-DT-20** y aviso en el propio
> `SeccionSeguridad.tsx`. El `Stagger` sí se mantiene: es lo único de esta
> ficha que sigue vigente.

### 5.10b Tu práctica, tuya — tejido

**IMPLEMENTADA** en `SeccionControl.tsx` (no esperó a F2.a). La tabla es lo
que hay en el código, no una intención.

Dos bloques apilados: una franja con el abanico de PDFs y un zócalo con la
foto anclada y la tarjeta de agenda encima. La coreografía cuenta la frase
del bloque 2 en dos tiempos — **primero está la asistente, después aparece
la cita**—, que es justo lo que el copy afirma.

| Capa | Prop | Origen→destino | Tramo | Easing |
|---|---|---|---|---|
| Encabezado (kicker+h2, un solo div) | opacity,y | 0→1, 24→0 | entrada +0ms, `--lp-dur-section` | ease-out |
| Hoja A (atrás, izq.) | opacity,y,rotate,scale | 0→1, 28→0, −10→0, .94→1 | entrada +0ms | `SPRING.soft` |
| Hoja C (atrás, der.) | ídem | ídem | entrada +90ms (`STAGGER.deck`) | `SPRING.soft` |
| Hoja B (delante, centro) | ídem | ídem | entrada +180ms | `SPRING.soft` |
| **Zócalo + foto** (una sola pieza) | opacity,scale | 0→1, .72→1 | entrada +0ms, `origin-bottom` | `SPRING.soft` |
| **Tarjeta de agenda** | opacity,x | 0→1, 24→0 | entrada **+180ms** | `SPRING.soft` |

El mazo se arma **hacia el lector**: el orden del array `HOJAS` es a la vez
orden de pintado (la central va última, así queda al frente sin `z-index`) y
orden de entrada. Los dos bloques de TEXTO no se animan: la cabeza de cada
uno es su visual.

> ⚠️ **EL FILETE DIVISOR VERTICAL Y SU `scaleY` LIGADO AL SCROLL YA NO
> EXISTEN.** La versión anterior de esta sección era dos columnas simétricas
> con un filete de protagonista, y esta ficha describía su trazado. Al pasar
> al esqueleto de franja + zócalo se quedó sin sitio, y la ficha se retiró
> **para no dejar una instrucción muerta que F2.a implementara**. No la
> resucites: si ves `useScroll`/`useMotionValue` en `SeccionControl.tsx`,
> alguien lo hizo sin leer esto.

> ⚠️ **PRESUPUESTO EXCEDIDO A SABIENDAS: 6 capas, no 4.** §4.3·3 pone el
> techo en 4 simultáneas. Se acepta porque §4.3·3 habla de *escenarios*
> —momentos cinematográficos con scrub de vídeo— y esto es tejido: seis
> transformaciones sobre elementos de 104×132, 300×386 y 216px, todas
> `transform`/`opacity`, sin una sola propiedad que provoque relayout.

⚠️ **`origin-bottom` EN EL ZÓCALO+FOTO, NO EL CENTRO.** La regla 4 del spec
de diseño exige que la figura quede apoyada en el borde inferior del zócalo;
escalando desde el centro, el anclaje se rompe durante toda la entrada y la
figura llega flotando. Con origen abajo, el punto de apoyo no se mueve ni un
cuadro.

⚠️ **LA ROTACIÓN DEL ABANICO VIVE EN UN WRAPPER, NO EN LA CAPA ANIMADA.**
`motion` escribe su `rotate` animado dentro de `transform` inline, y la regla
`[data-lp-reveal]` fuerza `transform: none !important` bajo reduced-motion:
todo lo que dependa de ese transform desaparece con la preferencia activa.
Con la rotación en un wrapper propio queda fuera del alcance de motion.

> ⚠️ **MATIZ MEDIDO — el razonamiento obvio es INCOMPLETO y conviene saberlo
> antes de aplicar el mismo patrón en otra sección.** Tailwind 4 **no**
> compila `rotate-[8deg]` a `transform: rotate()`: emite la propiedad
> independiente `rotate: -8deg`, y `transform: none` **no la toca**.
> Verificado emulando `prefers-reduced-motion: reduce`: el computed del
> wrapper es `rotate: -8deg` / `transform: none` y el abanico se ve entero.
> Es decir, en este código concreto sobreviviría incluso sin wrapper.
> El wrapper se mantiene porque no depende de ese detalle del compilador: la
> versión anterior de esta sección ponía la rotación en un
> `style={{ transform: 'rotate(...)' }}`, que sí era un `transform` real, y
> ahí el aplanado habría sido seguro. **Regla práctica para F2.a: si el
> estado final de una capa se expresa con `transform`, sácalo del elemento
> que anima.**

> ⚠️ **HALLAZGO NUEVO — UN `transform` NO PROVOCA RELAYOUT PERO SÍ DESBORDA.**
> La tarjeta entra con `x: 24`. En móvil su borde en reposo queda a 374 de un
> viewport de 390 —16px de holgura—, así que **mientras dura la entrada**
> sobresale 8px y el documento gana scroll horizontal. Medido con prueba
> causal: ocultando solo la tarjeta, `scrollWidth` cae de 398 a 390.
> La sección lleva `overflow-x-clip` por esto. `clip` y no `hidden`: `hidden`
> crearía un contenedor de scroll y arrastraría el eje Y a `auto`, y el eje Y
> tiene que quedar intacto porque la tarjeta desborda 24px por abajo en móvil
> a propósito.
> **Lección general para F2.a:** la regla "solo `transform` y `opacity`"
> protege del jank, NO del desbordamiento. Cualquier capa que entre con
> desplazamiento lateral cerca del borde del viewport necesita esta
> comprobación.

⚠️ **TOKENS QUE ESTA SECCIÓN AÑADIÓ A `tokens.ts`**, porque la regla
permanente 1 de CLAUDE.md no admite números sueltos en los componentes:
`STAGGER.deck` (90ms, tercer peldaño tras 70/80) y `SPRING.soft/snap/heavy`
(estaban en §4.2 pero **no** en el archivo, que es su espejo). `OFFSETS.*`
también se declaró y **quedó sin consumidores** al morir el filete; se
mantiene como espejo de §4.2, igual que `SPRING.snap/heavy`.

⚠️ **DISTANCIA 24 Y NADA MÁS** para los reveals de bloque (`DIST.reveal`).
Los 28px de las hojas, el `.72` del zócalo y el `x: 24` de la tarjeta son
geometría de entrada dentro de un spring, no ritmo de reveal: van en el
componente por el mismo criterio que el `w-20 h-20` de SeccionIA.

**Móvil:** misma coreografía, sin cambios de distancia. La tarjeta pasa a
178px y sobresale por debajo del zócalo (`-bottom-6`), que es lo que el spec
de diseño pide.
**RM:** `data-lp-reveal` en las seis capas. Todas tienen estado final con
`transform` identidad (scale 1, x 0, rotate 0), así que el
`transform: none !important` de `globals.css:905` las deja exactamente donde
deben estar, sin trabajo extra.

### 5.11 Historia — tejido
`Parallax` leve en retrato + `Stagger` de párrafos. Movimiento = calma.

### 5.12 Precio + beta — tejido
`Reveal` + `CountUp` en cupos restantes.

### 5.12b FAQ — tejido · acordeón-conversación

**IMPLEMENTADA** en `SeccionFAQ.tsx` (no esperó a F2.a). La tabla es lo que hay
en el código, no una intención. Copy y verificación de cada claim en
`src/components/landing/faq-contenido.ts`; ubicación y superficie, razonadas en
el propio componente y en `(landing)/page.tsx`.

Abrir un ítem simula que el fundador responde un mensaje: avatar, indicador de
escritura y respuesta apareciendo. La coreografía ES el argumento — la sección
va en primera persona y firmada, así que el patrón dice quién contesta antes de
que se lea una sola palabra.

**FASE A — al abrir:**

| Capa | Prop | Origen→destino | Disparo | Easing |
|---|---|---|---|---|
| Marcador (`+`) | rotate | 0→45° | +0ms, `--sp-dur-base` | ease-out |
| Ítem y TODOS sus hermanos | `layout="position"` | posición, no tamaño | +0ms | `SPRING.soft` |
| Avatar | opacity | 0→1 | +0ms | `SPRING.snap` |
| Indicador (3 puntos, `repeat: 1`) | opacity | 0→1→0 | +100ms, dura 900ms | lineal |
| Burbuja | opacity, y | 0→1, 12→0 | +1000ms | `SPRING.soft` |
| Texto | índice de PALABRA | 0→n, 22ms/palabra | +1000ms | lineal |

**FASE B — al cerrar:** inverso, sin indicador y sin typing. Cerrar no es
responder. Además la respuesta queda ENTERA pintada aunque se cierre a media
escritura: es lo que hace instantánea la reapertura.
**ENTRADA de la sección:** ítems en stagger 70ms (`STAGGER.siblings`), con
variantes padre→hijo sobre el `<ul>`.
**RM:** sin indicador y sin typing — la respuesta aparece completa al instante.
Los dos son decorativos y no pueden retrasar contenido real.

> ⚠️ **ES `layout="position"`, NO `layout` A SECAS, Y LA DIFERENCIA ES TODA LA
> FICHA.** Verificado en el paquete embarcado
> (`motion-dom/dist/index.d.ts:887-889`): con `"position"` el TAMAÑO cambia de
> golpe y solo se anima la POSICIÓN. Eso convierte la restricción "el
> contenedor reserva su alto final desde el principio" en algo literal en vez
> de una intención, y evita tres problemas de una:
> * **Cero `scale` ⇒ cero deformación.** Motion solo corrige `borderRadius` y
>   `boxShadow` (`scale-correction.mjs:6-16`); el texto se estira salvo que
>   cada hijo sea a su vez nodo de proyección, y eso son ~27 nodos midiendo por
>   clic para nada.
> * **Evita escalar DESDE altura 0.** `delta-calc.mjs:20-24` corrige el `scale`
>   solo si sale `NaN`, y `N/0` es `Infinity`, que no lo es. Un panel que se
>   despliega desde 0 con `layout` completo entra justo por ahí.
> * **Los hermanos de abajo SÍ tienen que animar.** Sin `layout` en cada uno se
>   teletransportan a su nueva posición en el primer cuadro mientras el de
>   arriba se abre. Por eso el prop va en TODOS los `<li>`.
> Sigue cumpliendo §4.3·1: `buildProjectionTransform`
> (`projection/styles/transform.mjs`) solo emite `translate3d()` y `scale()`,
> jamás `width`/`height`.

> ⚠️ **EL TYPING NO MUTA `textContent` Y NO ES UN DETALLE DE ESTILO.** Las
> palabras se pintan TODAS desde el primer cuadro, cada una en su `<span>`, y
> lo que se revela es el COLOR (`transparent` → heredado). Las cajas de línea
> son definitivas desde el principio ⇒ el texto no refluye ni una vez y el
> `scrollHeight` del documento no se mueve. Mutar `textContent` recalcularía el
> layout del párrafo en cada tick y —peor— dejaría media respuesta en el árbol
> de accesibilidad: un lector de pantalla que entre a mitad lee una frase
> cortada. Por eso tampoco hay `aria-live`, que anunciaría palabra por palabra.
> El progreso va en `MotionValue` + suscripción que escribe al DOM, nunca en
> estado de React (§4.3·2).

> ⚠️ **EL INDICADOR VA EN `absolute` SOBRE LA BURBUJA, NO EN EL FLUJO.** Si
> ocupara su propia línea, la burbuja aparecería debajo y el ítem crecería a
> mitad de la coreografía — justo el reflujo que todo el patrón evita.
> Flotando sobre la burbuja (que ya está colocada, solo que a opacity 0) el
> alto del panel es el definitivo desde el primer cuadro.

⚠️ **CALIBRACIÓN CORREGIDA — LOS NÚMEROS DE LA PRIMERA FICHA ESTABAN MAL.**
Decía indicador de 330ms y typing de 14ms **por carácter**. 330ms es
aproximadamente un ciclo de pulso: se lee como parpadeo, no como "está
escribiendo", y encima retrasaba la respuesta sin comunicar nada. Y 14ms/carácter
son 5.6s para una respuesta de 400 caracteres, que nadie espera por un texto que
ya decidió leer. Valores vigentes: **900ms** de indicador y **22ms por PALABRA**.
Tokens en `CHAT.*` de `tokens.ts`.

⚠️ **VARIOS ÍTEMS ABIERTOS A LA VEZ, no uno.** Con acordeón exclusivo cada clic
son DOS animaciones de layout (cerrar + abrir) más el reflujo de todo lo que hay
entre ambos, y si el que se cierra está ARRIBA el contenido sube bajo el cursor
y el usuario pierde el sitio. Así hay una sola animación por clic.

⚠️ **EL TYPING CORRE UNA VEZ POR ÍTEM, igual que el indicador.** La alternativa
—"un clic durante el typing lo completa"— se descartó: es una afordancia
invisible (el clic que da un impaciente cae en el encabezado, que CIERRA) y una
zona de clic sobre el cuerpo pelea con la selección de texto, que en una FAQ sí
se usa. La fricción real es reabrir algo ya leído, y esto la elimina entera por
el coste de un booleano. Además deja un escape que se descubre solo: cerrar y
reabrir da el texto instantáneo.

**Presupuesto:** 6 capas propias del ítem que abre (marcador, layout, avatar,
indicador, burbuja, texto) más los hermanos de abajo animando su posición.
Excede el techo de 4 de §4.3·3 a sabiendas y por el mismo motivo que §5.10b: ese
techo habla de *escenarios* con scrub de vídeo, y esto es tejido — todo
`transform`/`opacity`, sin una sola propiedad que provoque relayout. Con una
diferencia que conviene tener presente: 5.10b anima seis capas UNA vez al entrar
la sección, y esto se dispara en cada clic. Por eso el `scale` del avatar se
retiró de la ficha original: era la capa más prescindible.

### 5.13 CTA final — tejido
`Reveal` + scale .97→1 en botón. Último beat: sin fuegos artificiales.

**IMPLEMENTADA** en `SeccionCTA.tsx` (F2.a·a1). El `Reveal` toma las clases del
bloque navy en vez de envolverlo, igual que en §5.4.

⚠️ **EL `scale` DEL BOTÓN VA EN UN ENVOLTORIO, y es la única excepción a la
norma anti-wrappers de §4.4 en toda la tanda a1.** El `<Link>` ya tiene dos
`transform` propios en CSS (`hover:-translate-y-0.5` y `active:scale-[0.97]`).
Si `motion` animara el Link directamente escribiría un `transform` **inline**
sobre él, que gana a las utilidades de Tailwind y a su propia `transition`: el
botón perdería el levantamiento al pasar el cursor y el hundido al pulsar, sin
que fallara build ni lint. Absorber esos gestos en `whileHover`/`whileTap` es
trabajo de **a3**, que hará lo mismo con el hover de las cards del bento. Con
el envoltorio hay dos dueños de `transform` y ninguno pisa al otro. **Cuando a3
absorba los gestos, este envoltorio puede desaparecer.**

El disparador del botón es PROPIO, no heredado del bloque: "último beat"
significa que aterriza cuando el botón entra en cuadro, no cuando entra la
sección. El `.97` va literal en el componente por el criterio de §5.10b
(geometría de entrada, no ritmo de reveal) — no generó token nuevo.

### 5.13b Footer — tejido

**IMPLEMENTADA** en `SeccionFooter.tsx` (F2.a·a1). Ficha creada por decisión de
PM (B7): hasta a1 el footer era la única pieza de la página sin entrada en §5,
y esa ausencia se leía como olvido en vez de como decisión.

| Capa | Prop | Origen→destino | Disparo | Easing |
|---|---|---|---|---|
| Contenedor (las dos filas) | opacity,y | 0→1, 24→0 | entrada +0ms, `--lp-dur-section` | ease-out |

**Una sola capa, y el resto se declara AUSENTE a propósito:**
* **Sin `Parallax`.** Es cierre, no contenido. Un pie que se desplaza al
  scrollear compite con el CTA que tiene justo encima, que es lo último que
  debe capturar la atención.
* **Sin `Stagger` en los tres enlaces.** Escalonar un pie de página es decorar
  por decorar: nadie lee un footer en orden.

⚠️ **EL `<Reveal>` TOMA EL `py-8` DEL CONTENEDOR, NO LO ENVUELVE.** Ese padding
es la mitad del contrato de costura con §5.13 que documenta la cabecera del
propio archivo: 96 / 128 / 160 según breakpoint, y **en móvil es exactamente el
mínimo de 96 de §3.3, sin un píxel de margen**. Un envoltorio que lo duplicara
o un div interior que lo desplazara perforan ese mínimo sin que nada falle
visiblemente. Sobre el mismo elemento el modelo de caja no se mueve:
`transform` y `opacity` no tocan el padding.

**Móvil:** idéntico. **RM:** `data-lp-reveal` en el contenedor; estado final
con `transform` identidad, así que `globals.css:922` lo deja donde debe.

---

## 6 · VIDEOS [E2: producto real en movimiento — patrón Linear/Loom]

> ⚠️ **DECISIÓN NUEVA (2026-08-01): UN SOLO VIDEO, NO DOS.** Angel canceló el
> Video 2. La tabla de abajo se conserva porque documenta el porqué de cada
> uno, pero **la fila 2 está MUERTA**.
>
> **Consecuencia directa sobre F2.b, que hay que resolver antes de empezarla:**
> la ficha §5.3 describe la card DICOM como escenario con scrub —`currentTime`
> ligado al scroll, contador n/N recorriendo los cortes— y **eso ya no existe**.
> La card DICOM se resuelve sin video o se replantea entera. Lo que NO puede
> pasar es que F2.b implemente §5.3 tal como está escrita: pediría un asset que
> nadie va a grabar.
> El `media: true` de `SeccionFeatures.tsx:15,211` sigue reservando esa zona y
> **se queda hasta que se decida con qué se llena** — no lo retires por leer
> esto.
>
> **Lo que el Video 1 conserva:** sigue siendo el único de la página y su sitio
> no cambia.

**Decisión previa: 2 videos, no 3.** El de "8 documentos" NO va (carrusel que
nadie ve + canibaliza el Teaser 2). Los otros 7 formatos → miniaturas en
Teaser 2.

| # | Contenido | Ubicación | Modo |
|---|---|---|---|
| 1 | Lista de pacientes → búsqueda → expediente abierto | Sección Expediente | **Una pasada, 15s** — sin bucle |
| ~~2~~ | ~~Visor DICOM recorriendo cortes~~ | ~~Card DICOM~~ | **CANCELADO 2026-08-01** |

> ⚠️ **EL VIDEO 1 NO VA EN BUCLE, y esta tabla decía «Bucle autoplay 20–30s».**
> Cambiado el 2026-08-01 por decisión de Angel. Corre UNA vez al entrar en
> cuadro y se congela en su último fotograma —el expediente abierto—, que es
> exactamente la imagen fija que sustituye al mockup eliminado.
>
> **El motivo es de accesibilidad, no estético.** Con `loop` había movimiento
> automático continuo y sin forma de pararlo, porque §6·4 prohíbe `controls`:
> eso es WCAG 2.2.2 incumplido y obligaba a elegir entre un botón de pausa
> (reabrir §6·4) o dejarlo roto. Sin bucle no hay nada continuo que parar y las
> dos reglas conviven. **Residual documentado en LP-DT-33:** el criterio 2.2.2
> se dispara por DURACIÓN (>5s), no por repetición, así que una pasada de 15s
> todavía lo roza; aceptado por el PM.
>
> **Consecuencia para cualquier vídeo futuro de esta landing:** el bucle deja
> de ser el modo por defecto. Si alguna tanda quiere uno, tiene que resolver
> 2.2.2 primero.

⚠️ **EL CONTENIDO DE LA FILA 1 NO ES EL QUE ESTA TABLA PROMETÍA.** Decía
"Entrar → buscar paciente (⌘K) → abrir expediente → nota con IA". El asset
grabado son 15s de lista de pacientes → búsqueda por nombre → expediente
abierto: **sin login, sin ⌘K y sin la nota con IA**. No es un defecto —el
recorrido se lee igual— pero si alguna tanda futura escribe copy apoyándose en
"se ve la nota con IA", estará describiendo un video que no existe.

**Grabación ("que no parezca video"):**
1. Pantalla Retina de la Mac (nunca monitor externo — artefactos de
   escalado). Escalado del sistema en default/Larger Text, NUNCA "More
   Space" (−30–40% de calidad). Ventana ~1280×800, sin barra de marcadores.
2. **Screen Studio** ($9/mes, un mes y cancelar): captura a resolución
   Retina completa, zooms automáticos sobre clic que recortan dentro del
   máster (se mantienen nítidos), cursor suavizado en arcos. Es el 80% del
   acabado "Linear".
3. Exportar **1440p** (Spinus es texto-denso; 4K = archivo gigante que
   mata la carga, 1080p pierde nitidez en texto). WebM (VP9/AV1) + MP4
   H.264 de respaldo.
4. Integración: `<video autoplay muted loop playsinline preload="none"
   poster="[primer frame]">`. SIN controles ni cromo de reproductor. El
   marco de ventana (puntos, borde) va en HTML alrededor, idéntico al de
   las capturas estáticas → el video se lee como la interfaz corriendo.
   `muted`+`playsinline` obligatorios (iOS). Carga al entrar en viewport:
   cero costo de LCP.
5. Datos: cuenta demo sembrada (F0.b). Cero PII. Video 2: grabar el visor
   con una serie que se preste al scrub.

**Hero: SIN video.** Captura estática [E1: juicio en 50ms + LCP]. PNG/AVIF
2x, `priority`, art direction 2 recortes (`<picture>`).

---

## 7 · ESTRUCTURA Y COPY FINAL POR SECCIÓN

*(Todo el copy siguiente ya fue auditado claim por claim contra el producto
real. No inventar variantes.)*

**0 · Nav** — `Planes · Iniciar sesión (texto) · Crear cuenta (sólido)`.
Jerarquía invertida vs. hoy: el botón sólido es para el visitante nuevo.

**1 · Hero** — Kicker: "Expediente clínico electrónico para consultorios
privados". H1: "Menos tiempo en la pantalla, más tiempo con tu paciente".
Autoría: "Creada por un cirujano de columna que la usa todos los días"
(NUNCA el plural "por médicos" — falso y débil). Subtítulo: "Expedientes,
agenda e inteligencia artificial en una sola plataforma. Sin vendedores,
sin trámites." CTA1 "Empieza gratis" · CTA2 "Ver planes" (ancla a §12).
⚠️ NO decir "Regístrate en segundos" mientras el registro tenga 10 campos.
Visual: captura real de la agenda, sangrando por el borde derecho.

**2 · El problema** — "Los sistemas de expediente electrónico son lentos,
complejos y pensados para cumplir regulaciones — no para ayudar al médico."
(74% de ancho, segunda mitad en ink-350.)

**3 · Grid bento (5 cards):**
- **Visor DICOM** (2×): "Abre el estudio completo desde el disco, sin
  instalar nada y sin costo extra. Guarda en el expediente los cortes que
  importan — hasta 100 por paciente." [+ video scrub]
- **Expedientes electrónicos:** "Toda la historia clínica de tu paciente a
  un clic. Sin papel, sin búsquedas."
- **Recetas con QR:** "Membretadas, con QR verificable. Envíalas por correo
  o entrégalas impresas."
- **Documentación con IA:** "Describe los hallazgos y la IA estructura la
  nota. Tú validas y firmas." (NUNCA "IA clínica" ni "genera" — territorio
  de dispositivo médico.)
- **Agenda:** "Arrastra, suelta y listo. Sincronizada con Google Calendar."
  (SIN "en tiempo real" hasta cerrar el bug de sync.)
Eliminadas: "Seguridad grado médico" (duplicaba §10; el estándar no
existe), "Dashboard" (decisión de Angel).

**4 · Bloque IA (navy)** — Kicker: "Potenciado por inteligencia artificial".
Subtitular: "Tú aportas el criterio clínico — Spinus se encarga del trabajo
pesado." Chips (=selector Teaser 1): "Notas médicas con IA" · "Análisis de
laboratorios". (Ctrl+K FUERA de aquí: no es IA.)

**5 · Teaser 1** — 3 escenarios: Lumbalgia · Rodilla post-qx · Control de
columna. Formato de nota = el REAL post-rediseño (congelar antes de
codear). Contenido clínico: PENDIENTE de Angel (§14).

**6 · Expediente** — Titular: "El expediente que se adapta a tu ritmo, no
al revés". Bullets: "Nota médica que la IA estructura — tú validas y
firmas" · "Búsqueda rápida — ⌘K / Ctrl+K, encuentra cualquier paciente al
instante" · "Guarda los cortes clave del estudio y ábrelos con el visor
integrado" · "QR verificable en cada receta". [+ Video 1]
(Un solo nombre para el buscador en TODA la página: "Búsqueda rápida".)

⚠️ **LA COLUMNA DEL MEDIO YA NO ES UN MOCKUP DIBUJADO — ES EL VIDEO 1 REAL**
(2026-08-01). El mini-mockup de tarjeta de paciente que ocupaba ese sitio se
eliminó al montarlo y **LP-DT-13 queda cerrada**: la landing no dibuja ninguna
interfaz en JSX, así que §2·2 se cumple sin excepciones. Con él se fueron sus
13 nodos de contraste entre 2.51 y 2.63, sus cinco tamaños fuera de escala
(10/11/12/13/14px) y los tres semánticos de su timeline, que e2 y e4 habían
excluido por ser UI falsa.

⚠️ **EL ASSET ACTUAL NO PUEDE PUBLICARSE: muestra «Spinus®».** Ver **LP-DT-32**.
Y el buscador de la app se rotula «Buscar por nombre o apellido», no «Búsqueda
rápida» — la misma incoherencia que **LP-DT-31** registró desde la captura del
hero, ahora en un segundo sitio.

**7 · Teaser 2** — ver §5.7. Documento estrella: receta membretada con QR y
firma. ~~Medicamentos demo: PENDIENTES de Angel (§14).~~ **RESUELTO
(2026-08-02):** Angel entregó **3** medicamentos, no 4 — Celecoxib 200 mg,
Pregabalina 75 mg y Paracetamol 1 g, sobre M54.4 (lumbago con radiculopatía)
en Ana Gómez Sánchez, 27 años. Viven en
`components/landing/teaser2/receta-demo.ts`, que es la ÚNICA fuente: la hoja
del teaser y `/demo/receta` leen de ahí para no poder divergir.

**8 · Flujo** — Titular: "Si sabes usar tu celular, ya sabes usar Spinus".
Subtítulo: "Sin configuraciones, sin formatos rígidos, sin capacitación.
Cada pantalla está diseñada para que el siguiente paso sea obvio — desde
que llega el paciente hasta que se va con su receta." SIN badges de clics
(la cuenta no cuadraba; con paciente nuevo son 2–3 min). Pasos: 1 Paciente
llega ("La tarjeta 'Próxima cita' te muestra quién sigue") · 2 Abrir
expediente ("Un clic desde la cita") · 3 Nota médica con IA ("Describe los
hallazgos, la IA estructura la nota") · 4 Generar receta ("Selecciona
medicamentos, sale membretada y con QR") · 5 Enviar al paciente ("Por
correo, con la receta adjunta"). Bullets: "No necesitas capacitación para
empezar" · "Búsqueda rápida ⌘K/Ctrl+K" · "Arrastra y suelta las citas".

**9 · Portabilidad (franja de 3)** — "Tu consultorio en cualquier lugar".
"Accede desde tu computadora, tablet o celular. Adaptada a cada pantalla,
sin instalar nada de una tienda de apps." Ítems: Computadora ("La
experiencia completa: sidebar, atajos y expediente expandido") · Tablet y
celular ("Instálala como app desde el navegador…" ⚠️ CONDICIONADO a probar
instalación PWA en iOS — nunca verificada; iOS no tiene
beforeinstallprompt) · Sin instalaciones ("Corre en el navegador y se
actualiza sola"). PROHIBIDO: "la misma experiencia fluida" (falso: DICOM
desactivado en móvil), "100% en la nube" (el visor lee del disco), "en
tiempo real". Añadir: "Si se te cae la conexión, el borrador de tu nota
médica sigue donde lo dejaste" (SOLO la nota — verificado).

**10 · Seguridad** — Titular: "Tu práctica, protegida". Tarjetas:
- "Conforme a la norma": "La estructura del expediente y los formatos
  siguen la NOM-004, y el tratamiento de datos se rige por la LFPDPPP
  vigente." (NUNCA "cumple automáticamente" — el obligado es el médico.
  LFPDPPP = la NUEVA, DOF 20/03/2025; el INAI no existe, autoridad = SABG.)
- "Tu información, separada": "Cada médico solo accede a sus pacientes, a
  nivel de base de datos." ⚠️ **La segunda frase de esta tarjeta ("Cada
  acceso queda registrado en bitácora") está OMITIDA A PROPÓSITO en el
  código, no olvidada.** La verificación de §10 sobre qué accesos cubre hoy
  la bitácora sigue abierta; hasta cerrarla, la frase no se escribe. Cuando
  se cierre, su sitio es esta tarjeta.
- "Respaldo automático": "Tus expedientes se respaldan solos, todos los
  días. Si algo falla, la información sigue ahí." (Verificado: Supabase Pro,
  diario, 7 días.) ⚠️ **El título es "Respaldo automático", no "Siempre
  disponible"**: el copy anterior prometía disponibilidad, que es un
  absoluto sin respaldo, y el implementado promete respaldo, que sí está
  verificado.
⚠️ **SIN PIE DE SECCIÓN.** La línea de portabilidad de datos vivió aquí unas
horas y se retiró: a 13px bajo tres tarjetas se leía como nota al pie, no
como garantía. Su contenido es ahora la sección **10b**. No la devuelvas.
**ELIMINADO:** "Ni siquiera nosotros podemos leer tus notas" (falso:
service_role + IA server-side; riesgo legal y de gremio — Angel es
competidor de su cliente). Bloque de refuerzo (evaluar): "Tus pacientes
son tuyos. Como cirujano en ejercicio, me comprometo a no usar la
información clínica de mis colegas para nada." Enlace: "Cómo protegemos tu
información" → página de política (la ruta NO existe todavía; enlazarla
sería un 404 — ver `SeccionFooter.tsx`).

**10b · Tu práctica, tuya (nueva, 2026-07-30)** — Kicker "TU PRÁCTICA,
TUYA" **sin pastilla** (sus dos vecinas usan la misma `bg-blue-50`; tres
seguidas idénticas era repetición). Titular: "Tu información y tu equipo,
bajo tu control". Sin bajada. Dos bloques del mismo peso separados por
filete vertical (esqueleto en §3.4·10b):
- **"Tus expedientes son tuyos"**: "Descarga el historial clínico de
  cualquier paciente en PDF cuando quieras. Se genera en tu dispositivo, sin
  pasar por nuestros servidores. Y si algún día dejas de usar Spinus, tus
  expedientes siguen ahí y los sigues pudiendo descargar."
- **"Tu asistente médico, en la misma cuenta"**: "Da de alta a tu asistente
  para que gestione tu agenda: crea, mueve y cancela citas. Tú llegas y tu
  paciente ya está en tu consulta. Sin acceso a expedientes ni a notas
  clínicas — solo a la agenda."

⚠️ **CADA CLÁUSULA ESTÁ ACOTADA A CÓDIGO VERIFICADO. NO ENSANCHAR** — una
versión previa decía "exporta todos los expedientes" y "expediente
completo", y **las dos eran falsas**:
- **"de cualquier paciente", NUNCA "todos"**: el botón recibe UN paciente y
  se monta una vez por página de expediente
  (`ExportarExpedienteButton.tsx:30`, `HeroExpediente.tsx:90`). No existe
  export masivo.
- **"historial clínico", NUNCA "expediente completo"**: el PDF lleva hoja
  frontal + N notas con diagnósticos, signos vitales y addendums, y **NO**
  recetas, documentos, laboratorios ni DICOM
  (`ExpedienteCompletoPdf.tsx:25-29`).
- **"en tu dispositivo"**: 100% cliente con @react-pdf/renderer, sin servidor
  y sin persistir en Storage (`mobileShare.ts:1-12`).
- **"si algún día dejas de usar Spinus… los sigues pudiendo descargar"**: las
  9 policies RESTRICTIVE de gate son `FOR INSERT` —no existe ningún
  `_gates_update`— y los `SELECT` de `pacientes`, `consultas` y `addendums`
  no están gateados; el gate de UI solo intercepta creación.
- **"asistente médico", NUNCA "secretaria"** (decisión de PM). El enum de la
  BD sigue siendo `secretaria` y no se toca; lo que se alinea es el rótulo
  visible de la UI de alta (**LP-DT-23**). ⚠️ Esto **invalida** la mención
  multi-cuenta de §7·13, que sí decía "secretaria": ver el aviso allí.
- **"crea, mueve y cancela citas"** y **"sin acceso a expedientes ni a notas
  clínicas"**: verificado en `ROLES_POST_REFACTOR.md:171-176` y `:150,164`.
- **"da de alta", NUNCA "invita"**: no hay correo de invitación; el admin
  teclea email y contraseña (`admin/usuarios/page.tsx:36,74`).
- **SIN PRECIOS NI PLANES.** El asistente exige plan de clínica (Individual
  tiene `max_secretarias: 0`), pero esta sección no habla de dinero.

**11 · Historia** — Badge "MI HISTORIA" (nunca "nuestra"). PRIMERA persona.
Foto del pasillo de hospital (recorte hombros-arriba; badge de estetoscopio
FUERA; foto real sin fondo IA en cuanto exista — deuda). "…para resolver su
propio problema — uno que comparten miles de colegas" (nunca "y el de miles
de colegas": implica usuarios que no existen). Incluir DICOM en la lista de
módulos. Cédulas bajo el nombre (Prof. 9552456 · Esp. 12085805). Tagline
"La columna vertebral de tu práctica médica" + etimología spina. Grafía
única: "Ángel" con acento en TODAS las propiedades. Sin enlace visible a
dranconacolumna.com (públicos distintos); `sameAs` en JSON-LD con la misma
URL de imagen en ambos sitios.

**12 · Precio + beta (nueva; sustituye a la calculadora eliminada)** —
Precio transparente, un plan, sin "contáctanos" [E1]. **Límites del free
tier PUBLICADOS** —nadie en el sector lo hace; convierte "sin letras
chiquitas" en prueba— pero **PUBLICA LOS REALES**:

> ⚠️ **DOS DE LOS TRES LÍMITES QUE ESTA LÍNEA DABA POR BUENOS NO EXISTEN.**
> Decía *"(1 nota IA/24h, tope de pacientes, retención 12 meses)"*. Corregido
> el 2026-07-31 tras verificarlo contra el código:
>
> | Lo que decía | Lo que hay | Dónde |
> |---|---|---|
> | 1 nota IA / 24h | **60 llamadas / 24h, iguales para TODOS los planes** | `rateLimit.ts:8` |
> | retención 12 meses | **no existe**: ni cron, ni TTL, ni purga | grep sin resultados |
> | tope de pacientes | **5**, y es tope duro en BD | `plans.ts:29,129` · `clinica_dentro_de_limite()` |
>
> El límite de IA **no está segmentado por plan**: `LIMITES` es un mapa por
> RUTA, no por suscripción, así que un free y un premium tienen el mismo
> cupo. Si F5 publica "1 nota IA/24h" estará inventando una restricción que el
> producto no aplica, en la sección cuyo argumento entero es que aquí no hay
> letras chiquitas. Antes de publicar cualquier cifra de free, léela en
> `plans.ts` y en `rateLimit.ts`, no aquí.
"Acceso beta · cupos limitados" con CountUp — escasez real. Declarar beta.
SIN testimonios ni stats inventadas (no hay clientes; el gremio es chico).
Razón de la calculadora eliminada: con números honestos (5 pacientes × 7
min = 35 min/día) argumentaba EN CONTRA; el Teaser 1 demuestra lo que ella
afirmaba.

**12b · FAQ (nueva, 2026-07-31)** — Kicker "PREGUNTAS FRECUENTES" **sin
pastilla** (Seguridad, su vecina de arriba, usa `bg-blue-50`; dos idénticas
seguidas era repetición). Titular: "Lo que me preguntan antes de decidirse".
Bajo él, la autoría en rol caption: "Respondo yo — Dr. Ángel M. Ancona Pérez,
cirujano de columna y autor de Spinus."

**EL COPY DE LAS 9 RESPUESTAS NO SE DUPLICA AQUÍ.** Vive en
`src/components/landing/faq-contenido.ts`, junto a la verificación en código de
cada cláusula — que es donde tiene que estar para que nadie la ensanche sin ver
qué la sostiene. Ese archivo es módulo NEUTRO (sin `'use client'`) porque lo
consumen los dos lados de la frontera RSC: el componente cliente y el layout de
servidor que emite el JSON-LD.

**Decisión de PM: PRIMERA PERSONA, firmada por el fundador.** Es la única voz
coherente con la coreografía (§5.12b) y la que responde de frente la objeción de
continuidad. No es promoción de práctica médica: es el fundador de Spinus
respondiendo por su producto.

⚠️ **TRES CLÁUSULAS QUE NO SE TOCAN, cada una con su motivo:**
(a) **"en proceso de certificación", NUNCA "certificado"** — no hay folio DGIS.
Ver RG-01 en §11: Huli sí lo tiene (DGIS-CER-P-007-2024-09) y lo exhibe en cada
página. Decir "certificado" es falso y además comprobable en un registro público.
(b) **"El cumplimiento es del médico"** — mismo criterio que §7·10. Ninguna
plataforma cumple la NOM-004 por su usuario, y esta pregunta existe justamente
para decirlo antes de que alguien lo asuma al revés.
(c) **"nuestro objetivo es responder dentro de las 24 horas hábiles", NUNCA un
SLA por plan** — y por eso, en esta misma tanda, se retiraron las cifras `<24h`
y `<8h` de `plans.ts:98,118`. La landing compromete UN techo; la página de
precios no puede prometer dos plazos distintos con nada detrás.

⚠️ **LA PREGUNTA 9 DEPENDE DE UNA CLÁUSULA DE LOS TÉRMINOS QUE ANTES NO
EXISTÍA.** Dice que la plataforma seguiría 90 días disponible y remata "está
escrito en los términos de servicio, no es una promesa de buena voluntad".
Se escribió: `TerminosContent.tsx`, sección **19 · Continuidad y cese definitivo
del servicio** (versión v2.1). Las tres secciones que iban detrás se renumeraron
(19→20, 20→21, 21→22); los `id` de ancla no cambiaron. **Si alguien borra esa
sección, la respuesta 9 pasa a ser mentira: van juntas.**

⚠️ **JSON-LD FAQPage — PRIMER structured data del repo.** Vive en
`(landing)/layout.tsx`, que es servidor. **No esperes rich results de Google ni
los vendas:** están restringidos desde 2023 a sitios de gobierno y de salud
reconocidos, y Spinus no entra. El objetivo declarado es otro y ese sí se
cumple: contenido estructurado que un LLM pueda citar.

**Superficie BLANCA y ubicación pegada al CTA** — las dos razonadas en
`SeccionFAQ.tsx` y en `(landing)/page.tsx`. Resumen: el lavado del CTA resuelve
a ≈#f6f9fc, a un punto de la franja, así que franja aquí fundiría las dos
secciones (mismo acorralamiento que dejó a Seguridad en blanco); el contraste lo
ponen las filas del acordeón, rellenas de `#f5f8fc`.

**13 · CTA final + footer** — Titular: "Tu consultorio merece software
hecho para ayudarte, no para cumplir un requisito." **Mención multi-cuenta
(añadida 2026-07-30):** "¿Clínica con varios médicos? Da de alta a tu equipo
y a tu secretaria en una sola cuenta." Luego CTA "Empieza gratis" + "Ver
planes". Degradado vertical/radial (nunca izq→der).
⚠️ **LA MENCIÓN VA ANTES DE LOS BOTONES, NO DEBAJO.** La propuesta inicial
la ponía debajo; se movió tras medir: cuesta los mismos ~43px de caja pero
deja los botones como último elemento antes del footer. Texto bajo el botón
invita a leerlo en vez de pulsarlo, que es lo contrario de lo que un cierre
debe hacer. Orden: titular → promesa → matiz → acción.
⚠️ **TRES RESTRICCIONES DE COPY, cada una con motivo verificado:**
(a) **"da de alta", NUNCA "invita"** — no existe correo de invitación: el
admin teclea email y contraseña (`admin/usuarios/page.tsx:36,74`).
(b) **"secretaria"** — ⚠️ **DECISIÓN REVERTIDA, ESTA LÍNEA ESTÁ EN CONFLICTO
CON §7·10b Y HAY QUE RESOLVERLA ANTES DE PUBLICAR.** El 2026-07-30 se decidió
primero que la palabra pública fuera "secretaria" (y así quedó escrita esta
mención y así lo registra LP-DT-23); horas después, al redactar §7·10b, se
decidió lo contrario: **"asistente médico", NO "secretaria"**. Hoy la landing
usa las DOS palabras para el mismo rol, con una sección de por medio. Hay que
elegir una y propagarla a los tres sitios (esta mención, §7·10b y el rótulo
de la UI de alta), y reescribir LP-DT-23, que documenta la decisión vieja.
Nada de esto se tocó por cuenta propia: el copy es del PM.
(c) **SIN PRECIO** — el multi-cuenta empieza en Clínica Básica ($1,990/mes);
el plan Individual tiene `max_secretarias: 0` (`plans.ts:44`). Nombrar cifras
mete un salto de 3× en un cierre que no habla de dinero.
La capacidad es real y contratable: 8 price IDs configurados, checkout en
`api/stripe/checkout/route.ts`, y la secretaria agenda de verdad
(`ROLES_POST_REFACTOR.md:171-176`).
Footer: contacto
real (correo + WhatsApp — su ausencia es la mayor señal de desconfianza),
nombre y cédulas, "Cómo protegemos tu información", tagline, Aviso de
privacidad (⚠️ verificar que no cite INAI/ley 2010), Términos, Planes.
⚠️ **Lo implementado diverge de esa lista a propósito**, y está razonado en
`SeccionFooter.tsx:6-17`: sin WhatsApp (no hay número), sin autoría ni
cédulas (es footer de SaaS, no firma profesional — esos datos viven en
Historia) y sin enlace a "Cómo protegemos tu información" (la ruta no
existe; sería un 404). Entran cuando existan, no antes.

**Global:** `grep -rn "®"` → eliminar TODAS las apariciones (nav, sidebar,
mockups, imagen 5, footer, PDFs, registro — mín. 6 sitios). Marca EN
TRÁMITE ante IMPI (exp. 3594483, sin registro concedido): usar ® o "MR" es
infracción. "Spinus" a secas hasta el título.

---

## 8 · FASES

| # | Fase | Estado | Contenido |
|---|---|---|---|
| F0.a | Dependencia | ✅ | motion + Reveal/Stagger/tokens + fix hydration |
| F0.b | Cuenta demo | ⏳ bloqueante de capturas/videos | Pacientes ficticios consistentes en agenda/expediente/receta (mismo nombre exacto); nunca más recetas que notas; fechas frescas al capturar; cero PII |
| F0.c | Auditoría visual de la app | ⏳ **incógnita mayor** | Agenda, expediente, recetas con criterio "sale a 2x en una landing": alineaciones, estados vacíos, tipografía. Puede ser una tarde o dos semanas — es el techo de calidad de todo |
| F1.1 | Extracción | ✅ | 13 secciones → components/landing/sections |
| F1.2 | **Contenido y estructura** | ▶ SIGUIENTE | Aplicar §7: eliminar mockups falsos/calculadora/marquee, nuevos layouts §3.4, copy final. 3 tandas: (a) eliminaciones, (b) grid bento, (c) resto |
| F1.3 | Sistema visual | | Inter (crear route group landing) + escala tipo/espaciado + tokens Spinus (fuera slate/violet) + superficies planas |
| F1.4 | Server component | | page.tsx a RSC; secciones sin motion primero. Alcance reducido: el valor está en page.tsx, no en las 13 |
| F2.a | Movimiento tejido | | Tokens §4.2, patrones §4.4 en todas las secciones. Stagger SIN wrappers |
| F2.b | Escenario Hero ~~+ card DICOM~~ | | Ficha §5.1. **§5.3 fuera: el escenario DICOM está cancelado** (sin asset — ver el aviso de §5.3) |
| F3 | Teaser 2 | ✅ **APLICADA 2026-08-02** | QR estático + /demo/receta + ensamblaje→firma→color→candado. Notas de implementación al pie de §5.7 |
| F4 | Teaser 1 | | Requiere formato de nota congelado + textos clínicos de Angel |
| F5 | Precio/beta + footer + JSON-LD | | §7.12–13 + sameAs |
| F6 | Pulido | | Contraste AA global, Lighthouse, cero cuadros caídos medidos, móvil real vía preview de Vercel |

Cada fase: auditoría → aplicación → `tsc --noEmit + eslint` (WSL) o build
(Mac) → smoke test en dev server → commit checkpoint. Sin push a main.

---

## 9 · PENDIENTES DE ANGEL (contenido que solo él puede producir)

1. **Guiones finos de los 2 videos** (qué paciente, dónde se detiene, dónde
   corta el bucle). Depende de F0.b.
2. **Textos clínicos del Teaser 1** (dictado crudo + nota completa × 3
   escenarios). Los escribe Angel: un médico detecta texto clínico de IA
   genérica — es donde más se juega la credibilidad con el gremio.
3. ~~**4 medicamentos de la receta demo** (ficticios, clínicamente coherentes).~~
   ✅ **ENTREGADO 2026-08-02** — fueron 3, no 4, y con eso se implementó F3.
   En `components/landing/teaser2/receta-demo.ts`. Ver §7·7.
4. Foto real en pasillo de hospital (sin fondo IA) — no bloqueante.
5. Confirmar formato final de la nota post-rediseño (congela el Teaser 1).

## 10 · VERIFICACIONES ABIERTAS

| Qué | Bloquea |
|---|---|
| grep -rn "®" en todo el repo | F1.2 |
| Instalación PWA en iOS real | copy de Portabilidad |
| ~~¿Bitácora de auditoría cubre accesos a datos clínicos hoy?~~ | ✅ **CERRADA 2026-07-31** — sí. `useAuditAccess` está montado en las 5 páginas que leen datos clínicos: expediente (`page.tsx:26`), consulta (`:38`), nueva nota (`:188`), documentos (`:44`) y laboratorios (`:18`); `/api/audit` valida sesión server-side. ⚠️ **Con asterisco:** es fire-and-forget desde el cliente (`useAudit.ts:16-19`) y `logAudit` traga los errores (`audit.ts:84-86`) — si el POST falla, el acceso ocurre igual y no queda rastro (mismo defecto que LP-DT-21). Por eso el copy dice "queda registrado", no "queda registrado siempre". La frase ya está en la tarjeta 2 de Seguridad y en la pregunta 2 de la FAQ |
| ¿Página de verificación de recetas indexable? (site:spinus.com.mx) | URGENTE, ya delegado a otro chat |
| Node de la Mac vs WSL (v24) → .nvmrc | higiene |
| ¿"Próxima cita" se llama así en la app? | copy Flujo |

## 11 · DEUDA TÉCNICA GENERADA (a DEUDA_TECNICA.md)

Registro 10 campos → 2 + onboarding progresivo (máxima palanca [E1];
bloquea "en segundos") · Réplica HTML de receta desfasable del PDF ·
Recapturar al cambiar UI (manifest en /public/capturas/) · Unificar app a
Inter → recapturar · PDF en gama media no probado (riesgo aceptado) ·
Estado vacío DICOM móvil ("Disponible en computadora") · Bug sync GCal
(bloquea "tiempo real") · ¿DICOM en Postgres o Storage? · Verificación de
recetas: noindex + minimización + vigencia · Renderizador de
recomendaciones inconsistente PDF/web · Marca de agua tras la tabla ·
Espejo tokens CSS↔TS · Auditar useReducedMotion en la app (mismo bug de
hydration) · Bucket de firmas privado (verificar) · **RG-01 NOM-024/DGIS:
prioridad máxima — Huli YA certificado (DGIS-CER-P-007-2024-09) y lo usa en
cada página: desventaja competitiva activa.**

## 12 · LO QUE NO SE HACE (lista negra)

Scroll secuestrado · secciones pegajosas fuera de los 2 teasers · cursor
custom · partículas · **loops infinitos** · **texto que se escribe solo, donde
el acto de escribir no ES el mensaje** · glassmorphism ·
Three.js/GSAP/Lenis/librerías QR · testimonios inventados · badges de colores
arbitrarios · hover que cambia tamaño de fuente (desplaza layout; usar color +
subrayado desplegable + icono 3px) · valores de color/espacio/duración fuera de
las tablas de este documento · claims no verificados contra el producto.

> ⚠️ **LA ENTRADA DEL TYPING SE REESCRIBIÓ EL 2026-07-31, y la vieja estaba
> caducada desde antes.** Decía *"texto letra-por-letra fuera del hero"*, lo
> que dejaba el typing permitido SOLO en el hero. Pero el hero (§5.1) no tiene
> typing —sus capas son opacity/y/blur— y el Teaser 1 (§5.5) sí lo tiene, en
> dos capas. O sea que la regla llevaba tiempo prohibiendo lo único que el
> documento manda hacer, y autorizando lo único que nadie hace.
>
> **La regla vigente es de intención, no de ubicación:** el texto se escribe
> solo donde el ACTO DE ESCRIBIR ES EL MENSAJE. Hoy son dos sitios y ninguno
> más:
> * **Teaser 1 (§5.5)** — la IA redactando la nota. El typing *es* la
>   demostración; sin él no hay nada que enseñar.
> * **FAQ (§5.12b)** — el fundador contestando. El typing *es* la firma:
>   convierte una lista de preguntas en alguien respondiendo.
>
> Decorar con typing sigue prohibido. Un titular que se teclea, un kicker que
> aparece letra a letra o un contador con efecto máquina de escribir son
> exactamente lo que esta línea existe para frenar.
>
> ⚠️ **"Loops infinitos" NO se relajó, y el indicador de escritura es donde
> más tienta romperlo.** Los 3 puntos de §5.12b llevan `repeat: 1` — dos ciclos
> de 450ms, 900ms en total, y se acabó. `repeat: Infinity` en un indicador de
> chat es el caso de libro de esta prohibición.
