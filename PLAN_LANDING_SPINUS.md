# PLAN — Rediseño de la landing pública de Spinus

**Archivo objetivo:** `src/app/page.tsx` (landing pública)
**Fuera de scope:** `(launcher)/inicio/page.tsx` (home del médico logueado)
**Estado:** plan cerrado, pendiente de ejecución
**Última actualización:** 28 de julio de 2026

---

## 0 · Objetivo

Convertir la landing en la carta de presentación de Spinus: moderna, con
sensación de tecnología y pulido, capaz de atrapar al médico en el primer
vistazo. Estrategia de **curiosity gap**: mostrar lo justo para que quiera
registrarse a descubrir el resto.

### Principio rector (no negociable)

> El demo NUNCA muestra una capacidad que el producto no tiene.

### Regla de fidelidad visual (no negociable)

> Todo elemento de la landing que represente la interfaz de Spinus es
> **captura real** de la aplicación. Lo que no sea captura real no puede
> tener apariencia de interfaz: será ilustración o diagrama declarado,
> visualmente inconfundible con una pantalla. No existe el punto medio.

Consecuencia ya aplicada: se eliminan el mockup de agenda del hero y la
tarjeta de expediente. Se conserva la tarjeta de "flujo de trabajo típico"
porque se lee como diagrama, no como pantalla.

### Tesis de producto (guía todo el copy)

Los sistemas médicos existentes son lentos, complejos, de formatos rígidos e
interfaces que dan ansiedad — pensados para cumplir regulaciones, no para
ayudar al médico. Spinus es lo contrario.

**Corolario de diseño:** una landing que predica contra las interfaces
sobrecargadas no puede estar sobrecargada. La contención es coherencia, no
timidez.

---

## 1 · Reglas permanentes (copiar a CLAUDE.md)

1. **Tokens de movimiento:** ningún componente de la landing usa un valor de
   duración, easing o distancia que no salga de `--sp-dur-*`, `--sp-ease-*`
   o de la extensión `--lp-*`. Sin excepciones.
2. **Solo se anima `transform` y `opacity`.** Nunca `width`, `height`, `top`
   ni `left`: provocan relayout y ahí nace el jank.
3. **`useReducedMotion` se implementa junto a cada animación**, nunca como
   parche final. `globals.css:822` ya tiene el bloque
   `prefers-reduced-motion`; se extiende, no se crea otro.
4. **⚠️ Trampa de nombres:** `--cp` (#1a3a5c) es el **navy oscuro** y
   `--cs` (#1e5fa8) es el **azul brillante**. `--sp-primary` apunta a
   `--cs`, no a `--cp`. Está invertido respecto a lo intuitivo.
5. **La firma del Teaser 2 nunca toca la red.** Sin `fetch`, sin
   `toDataURL` fuera del componente, sin Supabase. Comentario obligatorio
   en el archivo para que ningún refactor futuro lo "mejore".
6. **Capturas:** cuenta demo, cero PII, jamás producción ni con datos
   difuminados.
7. **Sin dependencias nuevas más allá de `motion`.** Nada de Three.js,
   GSAP, Lenis, librerías de QR ni smooth-scroll.

---

## 2 · Sistema visual

### 2.1 Paleta

Fuente de verdad: `spinus-tokens.css`. La landing **no define colores
nuevos**; usa los tokens existentes.

```
--cs  #1e5fa8   azul brillante  →  --sp-primary (acción, links, acentos)
--cp  #1a3a5c   navy profundo   →  --sp-primary-hover, bloques oscuros
```

| Uso | Token |
|---|---|
| Fondo base | `--sp-surface` #ffffff |
| Franjas alternas | `--sp-app-bg` #f5f8fc |
| Bloques oscuros | `--cp` #1a3a5c |
| Titulares | `--sp-ink-900` #14345c |
| Cuerpo | `--sp-ink-700` #3b4a5c |
| Secundario | `--sp-ink-500` #5a6b81 |
| Etiquetas / meta | `--sp-ink-350` #8a99ac |
| Bordes de card | `--sp-line-card` #e6ebf2 |
| Radio de card | `--sp-r-card` 16px |
| Radio de botón | `--sp-r-btn` 12px |

**Reglas:**

- La escala de tinta de Spinus es **azulada**, no gris neutro. Usar slate
  (#0f172a, #475569) hace que la landing se lea como otro producto.
- **Los colores semánticos nunca decoran.** `--sp-success`, `--sp-warn`,
  `--sp-danger` y los de vitales solo aparecen cuando representan su función
  real. Prohibido usarlos como paleta decorativa.
- **Un solo acento por sección.**
- El `NeuralBackground` se elimina. Lo sustituye un degradado CSS: lavado de
  `--cs` al 3–5%, solo en hero y CTA final. Sin canvas, sin `requestAnimationFrame`.
- Los dos bloques oscuros (IA y CTA final) usan `--cp` con radio y
  tratamiento **idénticos**: son hermanos que abren y cierran la página, no
  dos accidentes.

### 2.2 Tipografía

**Inter**, variable, solo en la landing. La app no se toca por ahora.

```ts
// src/app/(landing)/layout.tsx
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin", "latin-ext"],   // latin-ext obligatorio: acentos y ñ
  display: "swap",
  variable: "--lp-font",
  axes: ["opsz"],
});
```

Extensión de escala para tamaños display (la app tope en 34px):

```css
--lp-fs-hero:    clamp(40px, 7vw, 76px);
--lp-fs-display: clamp(32px, 4.5vw, 52px);
--lp-fs-lead:    clamp(17px, 1.6vw, 21px);

--lp-ls-hero:    -0.035em;   /* crítico: Inter suelta en display se ve barata */
--lp-ls-display: -0.025em;

--lp-lh-hero:    1.05;
--lp-lh-display: 1.15;
```

De cuerpo hacia abajo se usa la escala existente `--sp-fs-*` sin cambios.
Numerales tabulares donde haya cifras alineadas, sobre todo en la réplica
de la receta.

### 2.3 Movimiento

**Registro elegido: híbrido Apple + Linear.** No se mezclan en el mismo
elemento; se reparten por tipo de momento.

| Registro | Dónde | Carácter |
|---|---|---|
| **Apple** | Hero, Teaser 1, Teaser 2, card viva DICOM | Ligado al scroll, duraciones largas, mucho aire, un foco por pantalla |
| **Linear** | Todo lo demás | Respuesta inmediata, spring rígido, discreto |

Los cuatro momentos Apple son **escenarios** (el visitante se detiene y
mira). Todo lo demás es **tejido** (se recorre). Si el tejido intenta ser
escenario, la página se vuelve pesada y se pierden los dos.

**Escala — extiende la de la app, no la sustituye:**

| Uso | Token | Valor |
|---|---|---|
| Hover, feedback | `--sp-dur-micro` | 120ms *(existente)* |
| Reveal de card | `--sp-dur-base` | 240ms *(existente)* |
| Entrada de sección | `--lp-dur-section` | 420ms *(nuevo)* |
| Escenario cinematográfico | `--lp-dur-cine` | 900ms *(nuevo)* |

Easings: `--sp-ease-out` (`cubic-bezier(.2,0,0,1)`) para todo el registro
Linear. `--lp-ease-cine` (`cubic-bezier(.65,0,.35,1)`) solo para los cuatro
escenarios.

Distancias: 24px de desplazamiento en reveals. Stagger de 70ms entre
hermanos, 80ms en listas secuenciales.

**Componentes base** (`src/components/landing/motion/`):

| Componente | Qué hace |
|---|---|
| `<Reveal>` | `whileInView` + `once: true`, sube 24px con fade |
| `<Stagger>` | Aplica retraso incremental a los hijos |
| `<Tilt>` | Inclinación ±3° hacia el cursor + sombra que sigue el ángulo |
| `<CountUp>` | Número animado con `MotionValue` (sin re-render de React) |

### 2.4 Desdoble móvil / escritorio

Las secuencias ancladas al scroll son frágiles en móvil: la barra de
direcciones de iOS Safari redimensiona el viewport a media secuencia,
`100vh` miente (usar `100dvh`), Android de gama media tartamudea, y no hay
hover, así que `<Tilt>` no existe.

**Resolución — no se degrada móvil, se cambia el disparador:**

- **Escritorio:** los cuatro escenarios corren ligados al scroll.
- **Móvil:** los mismos cuatro escenarios corren **por toque**. Los teasers
  se vuelven secuencias por pasos con botón de avance; el DICOM avanza al
  tocar. En móvil la sensación la cargan la escala tipográfica y el espacio.

Costo: cada escenario tiene dos implementaciones de control (~30% más
trabajo en F2.b, F3 y F4).

### 2.5 Lo que NO se hace

Sin scroll suave secuestrado. Sin secciones pegajosas. Sin cursor
personalizado. Sin partículas. Sin texto letra por letra fuera del hero.
Sin loops infinitos. Todo eso se siente tecnológico seis segundos y luego
estorba — y varios son lo que hace que un médico de 55 años cierre la
pestaña.

---

## 3 · Arquitectura de componentes

```
src/app/(landing)/layout.tsx        → Inter, solo landing
src/app/page.tsx                    → server component, solo orquesta
src/app/demo/receta/page.tsx        → destino del QR del Teaser 2
public/demo/qr-receta.svg           → QR pre-generado (cero dependencias)
public/capturas/                    → capturas + manifest de versión

src/components/landing/
  motion/          Reveal · Stagger · Tilt · CountUp · tokens
  sections/        las secciones extraídas de page.tsx
  teaser-nota/     TeaserNotaIA · escenarios.ts · TypewriterSOAP · VeloRegistro
  teaser-receta/   TeaserReceta · RecetaPreview · CanvasFirma · SwatchesColor · LogoBloqueado
```

`page.tsx` pasa de `'use client'` monolítico (746 líneas) a server component
con islas cliente.

---

## 4 · Estructura final de la página

| # | Sección | Registro |
|---|---|---|
| 0 | Nav | Linear |
| 1 | Hero | **Apple** |
| 2 | Franja "el problema" *(nueva)* | Linear |
| 3 | Grid de 5 cards | Linear |
| 3b | Card viva DICOM (dentro del grid) | **Apple** |
| 4 | Bloque IA (navy) | Linear |
| 5 | **TEASER 1 — Nota con IA** | **Apple** |
| 6 | Expediente | Linear |
| 7 | **TEASER 2 — Receta** | **Apple** |
| 8 | Flujo de 5 pasos | Linear |
| 9 | Portabilidad (franja) | Linear |
| 10 | Seguridad | Linear |
| 11 | Historia | Linear |
| 12 | Precio + beta *(nueva)* | Linear |
| 13 | CTA final (navy) + footer | Linear |

**Decisión abierta para F1:** las secciones 6 y 8 dicen casi lo mismo
("es rápido y fácil"). Evaluar fusión viendo el largo real de la página.

---

## 5 · Especificación por sección

### 0 · Nav

- **Jerarquía invertida:** `Crear cuenta` sólido, `Iniciar sesión` texto
  plano. Hoy está al revés y es el fallo de conversión más caro de la página.
- Enlaces: `Planes` · `Iniciar sesión` · **`Crear cuenta`**
- Animación: fondo transparente → sólido con blur al scrollear, logo
  encoge, barra de progreso de scroll de 2px. Continuo, ligado a
  `useScroll`, no por pasos.

### 1 · Hero

- **Kicker:** `Expediente clínico electrónico para consultorios privados`
  (categoría + keyword, para buscadores y LLMs)
- **H1:** Menos tiempo en la pantalla, más tiempo con tu paciente
- **Autoría:** ~~Creada por médicos, para médicos~~ →
  **Creada por un cirujano de columna que la usa todos los días**
- **Subtítulo:** Expedientes, agenda e inteligencia artificial en una sola
  plataforma. Regístrate en segundos y empieza a usarla — sin vendedores,
  sin trámites.
- **CTA primario:** ~~Crear cuenta — es gratis~~ → **Empieza gratis**
- **CTA secundario:** `Ver planes` (ancla a sección 12)
- **Visual:** ~~mockup inventado~~ → **captura real de la agenda**
- Animación: kicker → H1 → subtítulo → CTAs en stagger con blur→focus.
  Captura entra 200ms después con spring suave.

### 2 · Franja "el problema" *(nueva)*

Extrae la tesis que hoy vive enterrada en la sección de Historia:

> Los sistemas de expediente electrónico son lentos, complejos y pensados
> para cumplir regulaciones — no para ayudar al médico.

Dos líneas, fondo `--sp-app-bg`, sin adornos. Es lo que hace que el médico
se reconozca en los primeros diez segundos.

### 3 · Grid de 5 cards

Sustituye al marquee. El marquee impedía leer, cortaba palabras a media
sílaba, no tenía principio ni fin, escondía las tres features
diferenciadoras fuera de cuadro e incumple WCAG 2.2.2.

Retícula 3 columnas con DICOM ocupando 2:

```
┌─────────────────────────┬───────────┐
│      VISOR DICOM        │Expedientes│
├───────────┬─────────────┼───────────┤
│Recetas QR │Documentación│  Agenda   │
│           │   con IA    │           │
└───────────┴─────────────┴───────────┘
```

| Card | Copy |
|---|---|
| **Visor DICOM** | Abre el estudio completo desde el disco, sin instalar nada y sin costo extra. Guarda en el expediente los cortes que importan — hasta 100 por paciente. |
| **Expedientes electrónicos** | Toda la historia clínica de tu paciente a un clic. Sin papel, sin búsquedas. |
| **Recetas con QR** | Membretadas, con QR verificable. Envíalas por correo o entrégalas impresas. |
| **Documentación con IA** | Describe los hallazgos y la IA estructura la nota. Tú validas y firmas. |
| **Agenda** | Arrastra, suelta y listo. Sincronizada con Google Calendar. |

**Eliminadas:** "Seguridad grado médico" (duplica sección 10; además "grado
médico" no es un estándar que exista) y "Dashboard en tiempo real"
(decisión del PO: la mayoría de los médicos no entendería qué es).

**Renombradas:** "IA clínica" → "Documentación con IA" (sale del territorio
de dispositivo médico regulable). "Agenda inteligente" → "Agenda" (drag &
drop no es inteligencia).

**Retirado:** "en tiempo real" en Agenda, hasta cerrar el bug de sync de
Google Calendar.

Animación: cascada diagonal desde la card DICOM. `<Tilt>` en las 5.

### 3b · Card viva DICOM

Único elemento de nivel "card viva" en toda la página. El contraste —cuatro
cards que respiran y una que hace algo— es lo que dirige el ojo al
diferenciador sin necesidad de un badge.

- Al entrar en viewport corre **una vez** (`once: true`). Nunca en loop.
- Hover (escritorio) / tap (móvil) para recorrer los cortes.
- **Representación estilizada en SVG.** Jamás una imagen de paciente real,
  ni anonimizada: un DICOM arrastra metadatos y a veces anotaciones quemadas
  en el píxel.
- Solo puede mostrar lo que el visor hace.

### 4 · Bloque IA (navy)

- Chips reducidos a **dos**: `Notas médicas con IA` · `Análisis de
  laboratorios`. Fuera "Consulta rápida" — no es IA (es búsqueda de texto
  normalizada) y estaba inflando lo que sí es IA.
- Los chips **son el selector del Teaser 1**. Esto resuelve la falsa
  afordancia actual (tienen forma de botón y no hacen nada).
- **Sube a subtitular:** *"Tú aportas el criterio clínico — Spinus se
  encarga del trabajo pesado."* Desactiva la objeción número uno del médico
  escéptico y hoy está enterrada en gris al final de un párrafo.
- Verificar contraste AA: texto azul-gris sobre navy es el mensaje más
  importante y el más difícil de leer.

### 6 · Expediente

- **Visual:** ~~tarjeta inventada~~ → **captura real**, recortada al panel
  (encabezado del paciente + contadores + últimas entradas del timeline).
  Dos recortes con art direction: escritorio (panel completo), móvil
  (encabezado + 2 entradas).

| Copy actual | Copy final |
|---|---|
| Nota médica **generada** con IA | Nota médica que la IA **estructura** |
| tú **solo** validas y firmas | tú validas y firmas |
| Búsqueda global con Ctrl+K | Búsqueda rápida — ⌘K / Ctrl+K |

- **Bullet nuevo:** Guarda los cortes clave del estudio en el expediente del
  paciente y ábrelos con el visor integrado.
- "QR verificable" **se queda**: claim confirmado contra la página de
  verificación real.
- Cerrar ~400px de espacio muerto al final.

### 8 · Flujo de 5 pasos

**Badges de clics eliminados.** La suma no cuadraba (mezclaba clics con
segundos y no contaba los clics del paso 3), y con paciente nuevo el flujo
real son 2–3 minutos. Sin badges, los pasos comunican brevedad por su
cuenta y nadie puede sentarse a contar.

- **Titular:** Si sabes usar tu celular, ya sabes usar Spinus *(se queda —
  es la mejor línea de la página para el posicionamiento)*
- **Subtítulo:** Sin configuraciones, sin formatos rígidos, sin
  capacitación. Cada pantalla está diseñada para que el siguiente paso sea
  obvio — desde que llega el paciente hasta que se va con su receta.

| Paso | Copy |
|---|---|
| 1 · Paciente llega | La tarjeta "Próxima cita" te muestra quién sigue |
| 2 · Abrir expediente | Un clic desde la cita |
| 3 · Nota médica con IA | Describe los hallazgos, la IA estructura la nota |
| 4 · Generar receta | Selecciona medicamentos, sale membretada y con QR |
| 5 · Enviar al paciente | Por correo, con la receta adjunta |

- Bullets: Cero curva de aprendizaje · Búsqueda rápida ⌘K / Ctrl+K ·
  Arrastra y suelta las citas en la agenda
- Los 5 números usan **un solo color** o una gradación del mismo tono. Hoy
  usan 5 colores arbitrarios que no codifican nada.
- Fuera "Sin manuales, sin capacitaciones" (se lee como "no hay soporte") →
  "No necesitas capacitación para empezar."
- La firma **no lleva paso propio**: se configura una vez y se estampa sola.

Animación: cascada vertical de 80ms. El stagger dibuja la secuencia.

### 9 · Portabilidad (franja)

De tres tarjetas grandes a **franja horizontal de tres ítems**. Es la
sección más débil de la página —"funciona en tu celular" en 2026 no
diferencia nada— y ocupaba espacio de sección protagonista.

- **Titular:** Tu consultorio en cualquier lugar *(se queda)*
- **Subtítulo:** Accede desde tu computadora, tablet o celular. **Adaptada a
  cada pantalla**, sin instalar nada de una tienda de apps.

| | |
|---|---|
| **Computadora** | La experiencia completa: sidebar, atajos de teclado y expediente expandido. |
| **Tablet y celular** | Instálala como app desde el navegador. Revisa citas y consulta expedientes donde estés. |
| **Sin instalaciones** | Corre en el navegador y se actualiza sola. Nada que descargar de una tienda de apps. |

- Fuera **"la misma experiencia fluida en cualquier pantalla"**: es falsa,
  el visor DICOM está desactivado en móvil.
- Fuera **"100% en la nube"**: contradice que el visor lea del disco local.
- Fuera **"en tiempo real"**.
- "Desktop" → "Computadora".
- **Tarjeta 3 eliminada** (duplicaba la sección 10); su contenido se absorbe
  allá.
- El ícono de nube debe ser distinto al de compartir (hoy es el mismo que en
  Expediente).
- Añadir, acotado y verificable: *"Si se te cae la conexión o cierras la
  app, el borrador de tu nota médica sigue donde lo dejaste."* Aplica solo a
  la nota médica, no a los otros 7 formatos.
- **Condicionado a prueba en iOS:** la línea "Instálala como app". En iOS no
  existe `beforeinstallprompt`; la instalación es manual desde el menú
  Compartir de Safari.

### 10 · Seguridad

Sección con más riesgo legal de la página. Tres cambios obligatorios:

**a) Eliminar "Ni siquiera nosotros podemos leer tus notas médicas".**
Describe cifrado extremo a extremo con clave en poder del médico. Spinus no
funciona así y no puede: hay queries directas a producción vía SQL Editor,
la IA procesa del lado servidor, y `service_role` lee cualquier fila. Si
fuera cierto, no habría nota con IA, ni búsqueda, ni PDF, y olvidar la
contraseña significaría perder el expediente. Riesgo agravado: el fundador
es competidor directo del cliente objetivo.

**b) "Cumple automáticamente con la NOM-004" → "Diseñado conforme a la
NOM-004".** El obligado por la NOM-004 es el médico. Ningún software puede
garantizar su cumplimiento "automáticamente".

**c) Actualizar la referencia legal.** La LFPDPPP de 2010 fue abrogada el
21/03/2025 por la nueva LFPDPPP (DOF 20/03/2025, reformada 14/11/2025). El
INAI ya no existe; la autoridad es la Secretaría Anticorrupción y Buen
Gobierno.

**Copy final:**

- **Titular:** Tu práctica, protegida *(menos absoluto que "blindada")*

| | |
|---|---|
| **Conforme a la norma** | La estructura del expediente y los formatos siguen la NOM-004, y el tratamiento de datos se rige por la LFPDPPP vigente. |
| **Tu información, separada** | Cada médico solo accede a sus pacientes, a nivel de base de datos. Cada acceso queda registrado en bitácora. |
| **Siempre disponible** | Acceso desde cualquier dispositivo, con respaldo automático en la nube. |

- Backups verificados: Supabase Pro, diarios, 7 días de retención. El claim
  "respaldo automático en la nube" **se sostiene**.
- Fuera "Tu consultorio nunca se detiene" (promesa de disponibilidad sin
  SLA, sobre Vercel + Supabase + tier nano con cold starts).
- Fuera "en tiempo real".
- Reducir absolutos: hoy hay cinco apilados.
- **Enlace nuevo:** "Cómo protegemos tu información" → página con política
  de acceso, retención y compromiso de no uso de datos de colegas. Esa
  página desactiva la objeción del competidor mejor que cualquier frase.

**Refuerzo de posicionamiento** (a evaluar como bloque propio):

> **Tus pacientes son tuyos.** Ningún otro médico ve tus expedientes — está
> separado a nivel de base de datos, y cada acceso queda en bitácora. Como
> cirujano en ejercicio, me comprometo a no usar la información clínica de
> mis colegas para nada.

Verificable, firmado por alguien con cédula, y responde la objeción real del
comprador: no es "¿pueden leer mis notas?", es "¿este competidor va a ver a
mis pacientes?". Ninguna plataforma corporativa puede hacer esa promesa en
primera persona.

### 11 · Historia

- **Badge:** "NUESTRA HISTORIA" → **"MI HISTORIA"** (el plural contradice el
  propio texto, que dice "hecho por un médico")
- **Primera persona**, no tercera. Hoy se lee como nota de prensa.
- **"y el de miles de colegas"** → *"para resolver su propio problema — uno
  que comparten miles de colegas."* Hoy implica miles de usuarios.
- La lista de módulos debe incluir **DICOM** (hoy lo omite justo en la frase
  que define qué es Spinus).
- **Foto:** la del pasillo de hospital sustituye a la de brazos cruzados.
  Postura abierta, contexto que sostiene el claim. Recorte cerrado (hombros
  arriba), como credencial y no como retrato a media columna.
  - Nombre de archivo: `dr-angel-ancona-cirujano-columna.jpg`
  - Alt: "Dr. Ángel M. Ancona Pérez, cirujano de columna y fundador de
    Spinus"
  - Misma URL de imagen en el JSON-LD (`image` del grafo `Person`) que en
    dranconacolumna.com
- **Añadir cédulas** (profesional y de especialidad) debajo del nombre.
- **Fuera el badge del estetoscopio** flotando sobre la foto.
- **Sin enlace visible a dranconacolumna.com** (son públicos distintos). El
  `sameAs` va en el JSON-LD, invisible para el lector, que es donde sirve.
- Considerar aquí: *"La columna vertebral de tu práctica médica"* — la
  frase del pie de los PDFs, que cierra el círculo con la etimología de
  *spina*.
- Animación contenida: parallax leve en la foto, párrafos en stagger. El
  movimiento debe sentirse como calma.

### 12 · Precio + beta *(nueva)*

Sustituye a la calculadora eliminada.

**Por qué se eliminó la calculadora:** con números honestos argumentaba en
contra. Médico promedio (5 pacientes/día, ahorro de 7 min/nota) = 35 min al
día, menos de 3 horas a la semana. Además el Teaser 1 *demuestra* lo que la
calculadora *afirma*, y va antes en la página. Una demostración le gana a
una proyección siempre.

**Contenido:**

1. **Precio transparente.** Un solo plan, sin "contáctanos". El hueco de
   conversión más grande de la página actual.
2. **Límites del free tier publicados.** Nadie en el sector los publica.
   Hacerlo convierte "sin letras chiquitas" de eslogan en prueba.
3. **Acceso beta con cupos limitados.** Escasez real, no inventada. Es la
   prueba social honesta: no dice "500 médicos nos usan", dice "estamos
   abriendo N lugares".
4. **Declarar que Spinus está en beta.** Protege legalmente, justifica
   funcionalidades incompletas y convierte, todo a la vez.

**Sin testimonios ni stats de impacto inventadas.** No hay clientes
todavía; fabricar prueba social rompe el principio rector, y el gremio en
Mérida es lo bastante chico como para que se detecte.

### 13 · CTA final + footer

- **Titular:** Tu consultorio merece software hecho para ayudarte, no para
  cumplir un requisito *(eco de la tesis, remata el argumento)*
- **CTA:** `Empieza gratis` — mismo texto que el hero. `Crear cuenta` solo
  en el nav.
- **CTA secundario discreto:** `Ver planes`, para quien llegó abajo sin
  estar listo.
- Degradado vertical o radial centrado, no de izquierda a derecha (hoy
  arrastra la vista fuera del bloque justo donde debe quedarse).

**Footer — hoy es demasiado pobre para lo que se pide.** Falta:

- **Contacto real** (correo de soporte + WhatsApp). Su ausencia es la señal
  de desconfianza más fuerte que puede emitir un footer.
- **Quién está detrás:** nombre y cédulas.
- **"Cómo protegemos tu información"**
- **Tagline:** "La columna vertebral de tu práctica médica"
- Verificar que `Planes` (nav y footer) ancle a la sección 12.

---

## 6 · Teaser 1 — Nota con IA

**Ubicación:** debajo del bloque navy de IA, colgando de sus dos chips.
**Costo:** cero. Animación scripted, datos ficticios, ninguna llamada a IA.

**Escenarios (3):** Lumbalgia · Rodilla post-qx · Control de columna.

**Beats:**

1. **Input crudo** — typing del dictado tal cual lo daría un médico:
   fragmentado, sin estructura, con abreviaturas.
2. **Procesando** — shimmer sobre el bloque, ~1.5s. El demo comprime
   tiempo; es honesto porque no afirma duración.
3. **Estructuración** — `[SUBJETIVO]` y `[OBJETIVO]` se escriben solos, con
   el formato real de Spinus.
4. **Corte** — `[ANÁLISIS]` y `[PLAN]` con blur + velo → botón
   **"Regístrate para ver la nota completa"**. Ese corte ES el curiosity gap.

**Al pie:** *"Tú validas y firmas."*

**⛔ BLOQUEADO** hasta el merge de `feature/rediseno-nota-expediente`. El
formato de nota debe estar congelado o se codea contra un blanco móvil.

---

## 7 · Teaser 2 — Receta

**Ubicación:** después de Expediente. Sigue el flujo clínico real (consulta
→ nota → receta) y es el clímax de la página.

**Diseño a replicar** (verificado contra el PDF real):
barra navy superior · logo circular + bloque del médico a la izquierda ·
**Rx** grande a la derecha con folio debajo · doble filete · fila de cajas
Paciente/Edad/Sexo/Fecha · caja de diagnóstico · encabezado de tabla en
navy · QR abajo a la izquierda con leyenda · firma con línea punteada y
cédulas a la derecha · barra navy inferior.

**Beats:**

| # | Beat | Detalle |
|---|---|---|
| 0 | **Ensamblaje** | Membrete se desliza desde arriba → cuerpo se llena → QR aparece módulo por módulo (stagger sobre los `<rect>` del SVG pre-generado) |
| 1 | **Firma** | Canvas. El visitante dibuja con dedo o mouse; se entinta en la receta |
| 2 | **Color** | 3 swatches que re-tiñen barra superior, "Rx", encabezado de tabla, barras de sección y barra inferior |
| 3 | **Logo** | Slot del logo circular con candado → "Personalízalo con tu logo — disponible al registrarte" |
| 4 | **QR** | Escaneable de verdad → `/demo/receta` |

**Copy del beat 1:** *"Configura tu firma una vez. Se estampa sola en todos
tus documentos."* Al pie: *"o sube una foto de tu firma"*.
Vende el ahorro, no el gesto — y es fiel: la firma se configura una vez en
el perfil (signature pad o foto sobre fondo blanco) y se estampa sola.

**Sin fallback de firma-texto** (coherencia con el producto).

**Los swatches no son un truco de demo:** son literalmente la función de
personalización por consultorio (`--cp` / `--cs` por médico). El visitante
está usando una feature real.

**El QR es el momento estrella.** No lleva a una página genérica de
"demostración": lleva a una **réplica de la página de verificación real**,
con datos ficticios y aviso de demo. El médico está en su laptop, saca el
celular, escanea, y ve lo que verá su paciente. Cruza de la pantalla al
mundo físico, y de paso vende la función de verificación que hoy la landing
calla por completo.

**Restricciones técnicas:**

- **QR pre-generado como SVG estático** en `/public/demo/`. Generarlo en
  cliente exigiría una librería QR = segunda dependencia, contra la regla.
- **Réplica HTML/CSS**, no `@react-pdf/renderer` (no es animable en DOM).
  Riesgo aceptado: si cambia el PDF real, la réplica se desfasa en
  silencio. → DEUDA_TECNICA.md día uno.
- La réplica debe igualar la fuente del PDF, no la de la landing.
- Acentos impecables. En los documentos reales hay "Numero", "Mexico",
  "dias" que vienen de configuración y de texto libre del médico — no son
  bugs de Spinus, pero en el demo se controla cada carácter.

---

## 8 · Plan por fases

Cada fase: `npm run build` + validación en navegador antes de commit.
Sin commits sin validación. Sin ramas sin autorización explícita.

| # | Fase | Contenido |
|---|---|---|
| **F0.a** | Dependencia | Instalar `motion` (v12.x, peer deps `react ^18 \|\| ^19` — compatible con React 19.2.4 / Next 16.2.1). Crear `Reveal` y `Stagger`. Prueba de humo en **una** sección. Nada más. |
| **F0.b** | Cuenta demo sembrada | Pacientes ficticios **consistentes** en agenda, expediente y receta (recupera el hilo narrativo perdido al matar el mockup). Un solo nombre por paciente. Contadores clínicamente coherentes: **nunca más recetas que notas**. Fechas frescas al capturar. Cero PII. |
| **F0.c** | Auditoría visual | Revisar agenda, expediente y generación de recetas con criterio de "esto sale a 2x en una landing". Corregir alineaciones, espaciados, estados vacíos y tipografía **antes** de capturar. ⚠️ Incógnita mayor: puede ser una tarde o dos semanas. |
| **F1** | Refactor estructural | Extraer secciones a componentes. `page.tsx` → server component con islas cliente. **Cero cambio visual.** Es la red de seguridad. Aquí se decide la fusión de secciones 6 y 8. |
| **F2.a** | Sistema de movimiento | Tokens `--lp-*`, `Reveal`, `Stagger`, `Tilt`, `CountUp`, nav, parallax. Al terminar, la landing ya se siente fluida sin un solo micro-demo. |
| **F2.b** | Card viva DICOM | Solo después de F2.a validada. Si se hace antes, se inventan valores que después contradicen los tokens. |
| **F3** | Teaser 2 — Receta | Primero QR estático + ruta `/demo/receta` (sin eso el resto no tiene sentido). Luego ensamblaje → firma → color → logo. |
| **F4** | Teaser 1 — Nota | ⛔ Bloqueado hasta merge de `feature/rediseno-nota-expediente`. |
| **F5** | Contenido nuevo | Precio + límites del free tier + acceso beta. Enlaces del footer. JSON-LD con `sameAs`. |
| **F6** | Pulido | Auditoría de contraste AA global, Lighthouse, presupuesto de rendimiento (**LCP < 2.5s**, sin caída de frames en los escenarios), móvil. |

**Activos visuales — requisitos de "máxima calidad":**

- Capturas a **2x**, exportadas en **AVIF + WebP**, servidas con `next/image`
- **Dos recortes por captura** con art direction (`<picture>`), no la misma
  imagen reescalada
- `priority` solo en la del hero; el resto perezosas
- Sin presupuesto de rendimiento, "máxima calidad" se convierte en página
  lenta — y una página lenta nunca se siente cara

---

## 9 · Pendientes de verificación

Bloquean copy final, no el diseño.

| # | Pendiente | Bloquea |
|---|---|---|
| 1 | **Hacer `grep -rn "®"` en todo el repo.** Marca en trámite ante el IMPI (exp. 3594483, sin número de registro) → no procede el ® ni "MR". Confirmado en ≥5 sitios, incluidos los PDFs que salen del consultorio. | Todo |
| 2 | ¿La bitácora de auditoría cubre hoy los accesos a datos clínicos? Existe pero incompleta (beta). | Sección 10 |
| 3 | ¿La PWA se instala en **iOS**? Nunca probado. En iOS no hay `beforeinstallprompt`. | Sección 9 |
| 4 | ¿Los estudios DICOM se guardan en Postgres o en Supabase Storage? Si están en la base, el tope de 100 podría ser mucho más alto. | Nada (arquitectura) |
| 5 | ¿El bucket de firmas de médicos es privado? Una firma autógrafa filtrada es falsificable y no se puede revocar. | Nada (seguridad) |
| 6 | ¿Las páginas de verificación de recetas tienen `noindex` + bloqueo en `robots.txt`? **Exponen nombre completo, CIE-10 y tratamiento.** Verificar con `site:spinus.com.mx`. | Nada — ⚠️ **urgente** |
| 7 | ¿El aviso de privacidad menciona al INAI o la ley de 2010? | Footer |
| 8 | Módulos reales del sidebar (para la captura del hero). | Sección 1 |
| 9 | ¿"Próxima cita" se llama así exactamente en la app? | Sección 8 |
| 10 | Unificar la grafía "Ángel" / "Angel" en landing, PDFs, IMPI y dranconacolumna.com. Dos grafías = dos entidades para buscadores y LLMs. | Sección 11 |

---

## 10 · Deuda técnica generada

A registrar en `DEUDA_TECNICA.md`:

1. **Réplica HTML/CSS de la receta** desfasable respecto al PDF real.
2. **Recapturar imágenes de landing** cuando cambie la UI de agenda,
   expediente o recetas. Manifest con fecha y versión en `/public/capturas/`.
3. **Unificar la app a Inter**; al hacerlo, recapturar.
4. **Generación de PDF no probada en gama media/baja** — riesgo aceptado.
5. **Estado vacío del visor DICOM en móvil** — hoy no existe. Debe mostrar
   "Disponible en computadora", no un visor roto.
6. **Bug de sync de Google Calendar** — bloquea el claim "en tiempo real"
   en toda la página.
7. **Dashboard** — si los médicos no entienden qué es (razón por la que se
   quitó de la landing), es señal de producto, no de copy.
8. **Almacenamiento de DICOM** — verificar Postgres vs Storage.
9. **Página de verificación de recetas:** minimización de datos (la
   farmacia no necesita nombre completo ni CIE-10), `noindex`, y vigencia
   del enlace.
10. **Renderizador de recomendaciones inconsistente** entre PDF (parseado,
    con formato) y página web (texto crudo con emojis a la vista). El
    paciente ve la peor de las dos.
11. **Marca de agua del PDF** detrás de la tabla de medicamentos — ensucia
    el dato más importante al fotocopiar.
12. **Alineación del bloque final del PDF** ("SOLICITAR CITA…") fuera de la
    caja de alarma.

**Ver también:** `RG-01 · Certificación NOM-024-SSA3-2012 ante DGIS` —
apartado de prioridad máxima, bloqueante de lanzamiento oficial. Proyecto
independiente, no es scope de este plan.
