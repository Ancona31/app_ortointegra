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
- Claude Code corre en WSL: `next build` está BLOQUEADO (rutas UNC). Validar
  con `npx tsc --noEmit && npx eslint .`. En Mac, `npm run build` sí corre.
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
| 6 | Expediente | dos columnas invertidas: video izq., texto der. |
| 7 | TEASER 2 | documento izq., controles der. |
| 8 | Flujo 5 pasos | lista numerada izq., titular der. |
| 9 | Portabilidad | franja horizontal delgada de 3 ítems |
| 10 | Seguridad | 3 tarjetas en fila ⚠️ |
| 10b | Tu práctica, tuya | 2 bloques APILADOS: franja con abanico de PDFs + zócalo con foto anclada y tarjeta encima |
| 11 | Historia | retrato izq. chico, texto largo der. |
| 12 | Precio + beta | 2 tarjetas centradas, una acentuada |
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
DURACIONES  --sp-dur-micro 120ms (hover) · --sp-dur-base 240ms (reveals)
            --lp-dur-section 420ms · --lp-dur-cine 900ms
EASINGS     --sp-ease-out cubic-bezier(.2,0,0,1)  → todo el tejido
            --lp-ease-cine cubic-bezier(.65,0,.35,1) → solo escenarios
SPRINGS     soft {stiffness:120,damping:20} · snap {300,30} · heavy {60,18}
DISTANCIAS  reveal y:24 · stagger 70ms · listas secuenciales 80ms
OFFSETS     OFF_ENTRADA ["start 0.9","start 0.35"]
            OFF_TRAVESIA ["start end","end start"]
            OFF_ANCLADO ["start start","end end"]
```
`tokens.ts` es espejo manual del CSS (motion exige números): cada constante
comenta su token de origen; el bloque --lp-* de globals.css referencia el
espejo. Divergencia = bug (deuda §15).

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
| `<Tilt>` | hover ±3°, sombra sigue ángulo, <100ms | 5 cards del grid |
| `<Parallax>` | OFF_TRAVESIA, y +40→−40 | títulos, foto Historia |
| `<CountUp>` | MotionValue directo al DOM | cupos beta |
| Nav | transparente→sólido+blur, logo encoge, barra progreso 2px, continuo | siempre |

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

### 5.3 Grid bento — tejido + ESCENARIO DICOM
- Grid: `Stagger` diagonal desde DICOM (delays 0/.09/.18/.27/.36s) + `Tilt`.
- **Card DICOM (escenario):** OFF_ENTRADA sobre la card.
| Capa | Prop | Origen→destino | Tramo |
|---|---|---|---|
| Card | scale,opacity | .96→1, 0→1 | 0–0.25 |
| Video DICOM | `currentTime` | 0→duración | 0.20–0.85 |
| Contador n/N | número | 1→N | 0.20–0.85 |
| Etiqueta | opacity,y | 0→1, 10→0 | 0.10–0.35 |
El scroll RECORRE los cortes (scrub de video, ver §6). >0.85 queda en el
último corte; retroceder retrocede la serie. **Móvil:** arrastre horizontal
del dedo sobre la card controla el currentTime.

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
Dos columnas invertidas. `Reveal` + `Parallax` título. El video (§6) entra
con `Reveal`; autoplay al entrar en viewport.

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

### 5.13 CTA final — tejido
`Reveal` + scale .97→1 en botón. Último beat: sin fuegos artificiales.

---

## 6 · VIDEOS [E2: producto real en movimiento — patrón Linear/Loom]

**Decisión: 2 videos, no 3.** El de "8 documentos" NO va (carrusel que nadie
ve + canibaliza el Teaser 2). Los otros 7 formatos → miniaturas en Teaser 2.

| # | Contenido | Ubicación | Modo |
|---|---|---|---|
| 1 | Entrar → buscar paciente (⌘K) → abrir expediente → nota con IA | Sección Expediente | Bucle autoplay 20–30s |
| 2 | Visor DICOM recorriendo cortes | Card DICOM | **Scrub por scroll** (currentTime ligado al progreso) |

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

**7 · Teaser 2** — ver §5.7. Documento estrella: receta membretada con QR y
firma. Medicamentos demo: PENDIENTES de Angel (§14).

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
tier PUBLICADOS** (1 nota IA/24h, tope de pacientes, retención 12 meses) —
nadie en el sector lo hace; convierte "sin letras chiquitas" en prueba.
"Acceso beta · cupos limitados" con CountUp — escasez real. Declarar beta.
SIN testimonios ni stats inventadas (no hay clientes; el gremio es chico).
Razón de la calculadora eliminada: con números honestos (5 pacientes × 7
min = 35 min/día) argumentaba EN CONTRA; el Teaser 1 demuestra lo que ella
afirmaba.

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
| F2.b | Escenario Hero + card DICOM | | Fichas §5.1 y §5.3 |
| F3 | Teaser 2 | | QR estático + /demo/receta PRIMERO; luego ensamblaje→firma→color→candado |
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
3. **4 medicamentos de la receta demo** (ficticios, clínicamente coherentes).
4. Foto real en pasillo de hospital (sin fondo IA) — no bloqueante.
5. Confirmar formato final de la nota post-rediseño (congela el Teaser 1).

## 10 · VERIFICACIONES ABIERTAS

| Qué | Bloquea |
|---|---|
| grep -rn "®" en todo el repo | F1.2 |
| Instalación PWA en iOS real | copy de Portabilidad |
| ¿Bitácora de auditoría cubre accesos a datos clínicos hoy? | copy de Seguridad |
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
custom · partículas · loops infinitos · texto letra-por-letra fuera del
hero · glassmorphism · Three.js/GSAP/Lenis/librerías QR · testimonios
inventados · badges de colores arbitrarios · hover que cambia tamaño de
fuente (desplaza layout; usar color + subrayado desplegable + icono 3px) ·
valores de color/espacio/duración fuera de las tablas de este documento ·
claims no verificados contra el producto.
