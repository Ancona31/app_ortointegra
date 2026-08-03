/**
 * Tokens de movimiento de la landing pública.
 *
 * Espejo en TypeScript de los tokens CSS que ya existen — NO es una escala
 * paralela. Cada valor de aquí tiene su origen declarado al lado:
 *
 *   - `--sp-dur-*` y `--sp-ease-*` viven en `src/app/spinus-tokens.css`
 *   - `--lp-*` es la extensión de landing, en `src/app/globals.css` (:root)
 *
 * Existe porque `motion` recibe duraciones en **segundos** y easings como
 * tupla de bezier, no como string CSS: no puede leer `var(--sp-dur-base)`.
 * Si un token CSS cambia, este archivo se actualiza a mano.
 *
 * Regla permanente (CLAUDE.md §Landing, regla 1): ningún componente de la
 * landing usa una duración, easing o distancia que no salga de aquí.
 */

/** Tupla de cubic-bezier tal como la consume `motion` (equivale a su `BezierDefinition`). */
type Bezier = readonly [number, number, number, number]

/** Duraciones en SEGUNDOS (motion no acepta ms). */
export const DUR = {
  /**
   * 120ms — hover y feedback de control. Origen: `--sp-dur-micro`.
   *
   * Los 12 hover de la landing pasaron a este valor en F2.a·a1; antes corrían
   * a 200ms, que no está en la escala de §4.2. En el CSS de esos sitios se
   * escribe `duration-[var(--sp-dur-micro)]`, no el número: este espejo es
   * para `motion`, que no lee variables CSS.
   */
  micro: 0.12,
  /**
   * 240ms — cross-fade entre estados y micro-interacciones. Origen:
   * `--sp-dur-base`.
   *
   * ⚠️ YA NO ES LA DURACIÓN DEL REVEAL. §4.2 decía «240ms (reveals)» y el PM
   * lo corrigió en F2.a·a1 (B1): la entrada de bloque es `section` (420ms).
   * Lo que sigue vivo aquí es el DESFASE del remate de §5.2
   * (`SeccionProblema.tsx`), que entra 240ms después de la frase — ahí `base`
   * es un retraso, no una duración.
   */
  base: 0.24,
  /**
   * 420ms — entrada de sección Y de bloque. Origen: `--lp-dur-section`.
   *
   * Es la duración de TODO reveal de tejido desde F2.a·a1: `Reveal.tsx`, el
   * encabezado de `SeccionControl.tsx:147` y las fichas §5.2 / §5.10b hablan
   * las tres de este valor. Si encuentras un reveal a 240, es anterior a a1.
   */
  section: 0.42,
  /** 900ms — escenario cinematográfico (los 4 momentos Apple). Origen: `--lp-dur-cine`. */
  cine: 0.9,
} as const

/** Easings como tupla de bezier. */
export const EASE = {
  /** Registro Linear: todo el tejido de la página. Origen: `--sp-ease-out`. */
  out: [0.2, 0, 0, 1] as Bezier,
  /** Registro Apple: SOLO los 4 escenarios. Origen: `--lp-ease-cine`. */
  cine: [0.65, 0, 0.35, 1] as Bezier,
} as const

/** Distancias de desplazamiento en px. Solo se aplican vía `transform`. */
export const DIST = {
  /** 24px — desplazamiento vertical de todo reveal. PLAN §2.3. */
  reveal: 24,
  /**
   * 4px — levantamiento al pasar el cursor sobre una card.
   *
   * ⚠️ NO es un valor nuevo: es el `hover:-translate-y-1` que las cards del
   * bento y las de Seguridad llevaban en CSS desde antes de F2.a. Sube aquí en
   * a3 porque desde a2 esa utilidad está MUERTA — `motion` escribe `transform`
   * inline en cuanto la card anima `y`, y el inline gana a la clase
   * (`motion-dom/.../build-transform.mjs:65-67`). Lo que a3 hace es
   * reproducirlo con `whileHover`, y para eso el número tiene que estar en el
   * sistema.
   * Lo consumen DOS sitios con mecánicas distintas: el bento (dentro de
   * `useTilt`) y `SeccionSeguridad`, que recibe solo el levantamiento y ninguna
   * inclinación.
   */
  elevacionHover: 4,
  /**
   * ±24px — recorrido del `Parallax` a lo largo de `OFFSETS.travesia`.
   *
   * ⚠️ §4.2 DEL MAESTRO DECÍA ±40 Y EL PM LO BAJÓ A 24 EN F2.a·a4, con el
   * cálculo delante. Con ±40 el bloque de encabezado despejaba la retícula de
   * abajo por solo 8px (`mb-12` = 48 menos los 40 de recorrido) en Features,
   * Portabilidad y Seguridad: cualquier cambio futuro de tipografía o de
   * espaciado lo convierte en solape SIN que falle nada. A 24 el margen es de
   * 24px, y en móvil —donde la costura interna es la mitad— esos 16px extra
   * son la diferencia.
   * Coincide en número con `DIST.reveal` por casualidad y no por parentesco:
   * uno es el desplazamiento de una entrada puntual y el otro el recorrido de
   * una capa continua. Si una tanda mueve uno, el otro NO se mueve con él.
   */
  parallax: 24,
} as const

/**
 * Inclinación de card hacia el cursor (`useTilt`, §4.4). Solo bento.
 *
 * ⚠️ SOLO ESCRITORIO. El handler descarta todo lo que no sea `pointerType ===
 * 'mouse'`, así que en táctil estos valores no llegan a aplicarse nunca (§4.3·10
 * dice "sin hover: `Tilt` no existe"). El gesto `whileHover` de `motion` ya
 * filtra `touch` por su cuenta —verificado en `motion-dom/.../gestures/hover.mjs:4-6`—
 * pero NO filtra `pen`; por eso el guard estricto vive en nuestro handler.
 */
export const TILT = {
  /** ±3° — §4.4 ("hover ±3°"). El recorrido total es 6° de borde a borde. */
  angulo: 3,
  /**
   * 1000px de perspectiva, aplicada con `transformPerspective` en el style de
   * CADA card y NO en el contenedor de la retícula: ahí crearía un bloque
   * contenedor nuevo para cualquier descendiente posicionado.
   * A 1000px la deformación es perceptible sin llegar a leerse como truco —
   * por debajo de ~600 el escorzo delata el efecto a 3°, que es lo contrario
   * de lo que busca un tejido "discreto" (§4.1).
   */
  perspectiva: 1000,
  /** .98 — reproduce el `active:scale-[0.98]` que el bento tenía en CSS. */
  pulsado: 0.98,
  /**
   * Sombra que sigue al ángulo (§4.4). Se compone SOBRE la sombra de reposo,
   * no la sustituye: `useTilt` emite las dos en el mismo `box-shadow` y esta
   * segunda entra con alfa 0 en reposo. Así el estado quieto de la card es
   * exactamente el `shadow-sm` de antes.
   */
  sombraRecorrido: 8,
  sombraBlur: 20,
  /** .10 — el mismo alfa del `hover:shadow-[0_4px_20px_…/0.10]` absorbido. */
  sombraAlfa: 0.1,
  /** Sombra de reposo. Es el valor literal de `shadow-sm` de Tailwind 4. */
  sombraReposo: '0px 1px 2px 0px rgb(0 0 0 / 0.05)',
} as const

/** Retrasos incrementales en SEGUNDOS. */
export const STAGGER = {
  /** 70ms entre hermanos (grids, cards). PLAN §2.3. */
  siblings: 0.07,
  /** 80ms en listas secuenciales (pasos, timeline). PLAN §2.3. */
  list: 0.08,
  /**
   * 90ms — mazo abanicado de documentos (SeccionControl). Tercer peldaño de
   * la escalera 70/80/90: los 3 elementos se solapan en el espacio, así que
   * necesitan más separación en el tiempo que unos hermanos en retícula para
   * que se lea el orden de apilado.
   *
   * ⚠️ Es un valor NUEVO, no venía de §4.2 del maestro. Se declara aquí
   * porque la regla permanente 1 de CLAUDE.md prohíbe números sueltos en los
   * componentes, no porque el sistema pidiera un tercer escalón. Si en QA se
   * decide que 80ms basta, este token desaparece y `deck` pasa a `list`.
   */
  deck: 0.09,
} as const

/**
 * Springs. Espejo de §4.2 del maestro, que los declara pero que hasta ahora
 * no estaban en este archivo — `motion` los consume como objeto, no como
 * variable CSS, así que no tienen contrapartida en globals.css.
 */
export const SPRING = {
  /** Entradas de escenario: llega y asienta sin rebote visible. §4.2. */
  soft: { type: 'spring', stiffness: 120, damping: 20 },
  /** Respuesta inmediata de control. §4.2. Sin consumidores todavía. */
  snap: { type: 'spring', stiffness: 300, damping: 30 },
  /** Masa alta, para lo que debe sentirse pesado. §4.2. Sin consumidores. */
  heavy: { type: 'spring', stiffness: 60, damping: 18 },
} as const

/**
 * Ritmo del acordeón-conversación de la FAQ (§5.14). Valores en SEGUNDOS.
 *
 * ⚠️ SON TOKENS NUEVOS, no venían de §4.2. Se declaran aquí porque la regla
 * permanente 1 de CLAUDE.md prohíbe números sueltos en los componentes, no
 * porque el sistema pidiera una escala nueva. Solo los consume `SeccionFAQ`.
 *
 * ⚠️ LA CALIBRACIÓN DE LA PRIMERA FICHA ESTABA MAL Y NO DEBE VOLVER. Decía
 * indicador de 330ms y typing de 14ms POR CARÁCTER:
 *   · 330ms es aproximadamente un ciclo de pulso — se lee como parpadeo, no
 *     como "está escribiendo", y encima retrasaba la respuesta sin comunicar
 *     nada. Los indicadores de chat que funcionan viven ~800–1200ms.
 *   · 14ms/carácter son 5.6s para una respuesta de 400 caracteres. Nadie
 *     espera 5.6s por un texto que ya decidió leer.
 * Corregido por el PM: 900ms de indicador y 22ms por PALABRA.
 */
export const CHAT = {
  /** 100ms — el indicador no arranca en el mismo cuadro que el panel. */
  indicadorEntra: 0.1,
  /** 900ms de indicador en pantalla. */
  indicadorDura: 0.9,
  /**
   * 1000ms — burbuja y typing arrancan cuando el indicador se apaga.
   * Es `indicadorEntra + indicadorDura`; va literal porque `as const` sobre
   * una suma pierde el tipo estrecho. Si mueves uno de los dos, mueve este.
   */
  respuesta: 1.0,
  /** 22ms por PALABRA (no por carácter). */
  palabra: 0.022,
  /** 450ms por ciclo de pulso del punto. Con `repeat: 1` son 2 ciclos = 900ms,
   *  justo la ventana del indicador. `repeat` FINITO: §12 prohíbe los loops
   *  infinitos y un indicador de escritura es el sitio donde más tienta. */
  pulso: 0.45,
  /** 80ms de desfase entre los 3 puntos del indicador. */
  pulsoDesfase: 0.08,
} as const

/**
 * Nav que se transforma al scrollear (§4.4, tanda F2.a·a5). Solo lo consume
 * `SeccionNav.tsx`.
 *
 * ⚠️ NO HAY TOKEN DE ALTURA DE BARRA, y esa ausencia es la decisión de fondo:
 * la `h-14` del nav NO se anima. Animar la altura es relayout y §4.3·1 no lo
 * admite, así que el logo encoge dentro de una barra que no se mueve. Es menos
 * de lo que hacen Linear o Stripe y está aceptado por el PM (B5) — no es un
 * pendiente.
 */
export const NAV = {
  /**
   * 64px de scroll para completar la transformación. Valor de la escala de
   * §3.3, y elegido porque es ~la altura del propio nav (`h-14` = 56): el
   * fondo termina de solidificarse justo cuando la primera franja de contenido
   * ha pasado por debajo, que es cuando el blur empieza a tener algo que
   * resolver.
   */
  umbral: 64,
  /**
   * .85 — escala final del lockup completo (isotipo + wordmark), con origen a
   * la izquierda para que encoja hacia el borde y no hacia su centro.
   * Lleva los 36px del isotipo a 30.6. Por debajo de ~.8 el wordmark de 17px
   * empieza a verse blando: un `scale` rasteriza y luego escala, no
   * re-renderiza la fuente.
   */
  escalaLogo: 0.85,
  /** 2px de barra de progreso. Lo fija §4.4 explícitamente. */
  altoBarra: 2,
} as const

/**
 * Escenario del hero (§5.1, tanda F2.b). Solo lo consume `SeccionHero.tsx`.
 *
 * ⚠️ LA FICHA §5.1 REPARTÍA ESTO EN TRES FASES Y LA SEGUNDA NO ERA
 * IMPLEMENTABLE TAL COMO ESTABA ESCRITA. Pedía la ENTRADA de la captura
 * ligada al scroll con `OFF_ENTRADA` sobre la propia captura, y la captura
 * del hero está SIEMPRE por encima del pliegue: su borde superior arranca en
 * el 26–48% del viewport según el ancho (medido con la geometría documentada
 * en `SeccionHero.tsx`: marco de 464px a 1024 y de ~720 a 1920), o sea SIEMPRE
 * por delante del `start 0.35` que cierra el tramo. El progreso vale 1 desde el
 * primer cuadro y no hay forma de bajarlo, porque exigiría scroll negativo.
 * La entrada, escrita así, no la vería nadie nunca — y de paso costaría el LCP
 * (ver `capturaY`). Por eso la ENTRADA de la captura es de CARGA, como el resto
 * de §5.1·A, y lo único ligado al scroll es la DERIVA. §5.1 ya está corregida.
 */
export const HERO = {
  /**
   * Distancias de entrada, en forma de VARIABLE CSS y no de número — y esa es
   * la decisión de fondo de la tanda.
   *
   * §5.1 pide las mismas distancias al 60% en móvil. Elegir el `initial` en JS
   * obliga a leer el ancho del viewport, que es un valor solo-cliente: es el
   * hydration mismatch de §4.3·7 con otro disfraz (el servidor emitiría 30px y
   * el cliente 18). Resolverlo en CSS es exactamente lo que esa regla manda, y
   * aquí además sale gratis: las cuatro variables viven en `globals.css` con su
   * override bajo `@media (width < 40rem)`, el SSR emite
   * `translateY(var(--lp-hero-y-h1))` —CSS válido, sin JS de por medio— y
   * `motion` resuelve la variable al arrancar la animación, vía
   * `getComputedStyle` (`motion-dom/.../DOMKeyframesResolver.mjs:20-32` +
   * `css-variables-conversion.mjs:29-40`). El keyframe de origen queda en
   * "30px" y el de destino en 0: mismo tipo dimensional, interpolación normal.
   *
   * Espejo de los valores declarados en CSS (escritorio / móvil):
   *   kicker 14/8 · h1 30/18 · texto 20/12 · ctas 16/10
   * Los de móvil son los de escritorio ×0.6 redondeados al entero; §5.1 fija
   * expresamente los dos del centro (18 y 12).
   */
  y: {
    kicker: 'var(--lp-hero-y-kicker)',
    h1: 'var(--lp-hero-y-h1)',
    texto: 'var(--lp-hero-y-texto)',
    ctas: 'var(--lp-hero-y-ctas)',
  },
  /**
   * Retrasos de la entrada de carga, en SEGUNDOS. Son los de §5.1 tal cual.
   *
   * ⚠️ NO son un `Stagger`: los cinco intervalos son distintos (90·90·120·90)
   * porque el tercer beat abre paso al bloque de texto largo. `STAGGER.deck`
   * vale 90ms por coincidencia y no por parentesco — si mueves uno, el otro NO
   * se mueve con él.
   */
  retraso: {
    kicker: 0,
    h1a: 0.09,
    h1b: 0.18,
    /** Autoría y bajada entran JUNTAS: §5.1 las trata como una sola capa. */
    texto: 0.3,
    ctas: 0.39,
    /**
     * 0.48 — la captura cierra la secuencia. No sale de §5.1, que la tenía en
     * scroll (ver el aviso de arriba): es el sexto peldaño de la escalera de
     * 90ms. Cierra en 0.48 + `DUR.cine` = 1.38s desde la hidratación, que es
     * largo a propósito — es el remate del escenario, no tejido.
     */
    captura: 0.48,
  },
  /**
   * 8px de desenfoque inicial de las DOS líneas del H1. §5.1 lo presupuesta
   * ahí y §4.3·6 lo acota: es el filtro más caro y solo existe en carga. Nunca
   * en scroll, nunca en otra capa de esta sección.
   */
  blur: 8,
  /**
   * 120px de recorrido de entrada de la captura, y .88 de escala.
   *
   * ⚠️ LA CAPTURA NO ANIMA `opacity`, Y NO ES UN OLVIDO — ES EL LCP.
   * Es el elemento LCP de la página (por eso lleva `priority`). Chrome
   * DESCARTA como candidato a LCP todo elemento con opacidad 0, así que un
   * fundido de entrada mueve la marca desde "la imagen pintó" hasta
   * "hidrató + terminó la animación", que en red lenta son segundos contra el
   * presupuesto de §4.3·9 (LCP < 2.5s). `y` y `scale` no tienen ese efecto: el
   * elemento se pinta —desplazado y un 12% menor— y la marca se registra ahí.
   * El HTML del servidor ya sale con ese transform, así que tampoco hay salto
   * de layout: `transform` no reflowa y no computa CLS.
   */
  capturaY: 120,
  capturaEscala: 0.88,
  /** 1.03 — deriva de la captura DENTRO de su marco (ver `SeccionHero.tsx`). */
  deriva: 1.03,
  /** .96→1 de los CTAs, con `SPRING.soft`. §5.1. */
  ctasEscala: 0.96,
  /** Salida del bloque de texto: −70px y hasta .25 de opacidad. §5.1·C. */
  salidaY: -70,
  salidaOpacidad: 0.25,
  /**
   * Fracciones de progreso de `OFFSETS.salida` sobre la `<section>`. Los dos
   * tramos de scroll de §5.1 caen aquí porque hay un único `useScroll` en el
   * escenario (§4.3·4).
   *
   * ⚠️⚠️ ESTOS DOS NÚMEROS ERAN 0.45 Y 0.70 SOBRE `OFFSETS.travesia`, Y ESO
   * SERVÍA LA PÁGINA CON EL TEXTO YA DESVANECIDO. Regresión de color reportada
   * y corregida el 2026-08-01, el mismo día que se aplicó F2.b.
   *
   * La travesía mide el recorrido del hero por el viewport ENTERO, incluida la
   * parte que el hero nunca hace: por estar pegado al techo del documento (bajo
   * un nav `sticky` de 56px) ya sale del primer cuadro con
   * `(vh − 56) / (vh + altoHero)` de recorrido hecho. Con el alto real del hero
   * (~750px a lg) eso vale **0.51 a 1440×900, 0.56 a 1920×1080 y 0.63 a
   * 2560×1440** — SIEMPRE por encima del 0.45 en el que arrancaba la salida.
   * Resultado: la columna de texto se servía con `opacity` entre .92 y .75 y
   * con y ≈ −8 a −25px. Ningún elemento perdió su color; lo que se veía era el
   * H1 y el botón primario **lavados por la opacidad del ancestro**, y por eso
   * el mismo degradado se veía más claro aquí que en el nav.
   *
   * ⚠️ NINGUNA CONSTANTE SOBRE `travesia` ARREGLA ESTO — no subas el 0.45 y ya.
   * La fracción ya recorrida en reposo CRECE con la altura del viewport y
   * tiende a 1: cualquier umbral fijo se rompe en la pantalla siguiente. Lo que
   * hay que anclar es el CERO, y de eso se ocupa `OFFSETS.salida`.
   *
   * Con la travesía sustituida por `OFFSETS.salida`, la conversión de los dos
   * tramos de la ficha es:
   *   · salida  0.45 → **0** — el 0.45 ya quedaba por DEBAJO de la posición de
   *     reposo en todas las pantallas medidas, o sea que la ficha ya pedía
   *     "desde el principio de lo alcanzable". Ahora eso es literal y exacto.
   *   · deriva  0.70 → **0.30** — es el mismo punto de la página: el 0.70 de la
   *     travesía caía en scrollY ≈ 313 a 1440×900, y 0.30 de este tramo cae en
   *     282. La diferencia es que ahora NO se mueve con el tamaño de la
   *     pantalla (con la travesía el mismo 0.70 valía 313, 253 y 149px según el
   *     monitor).
   */
  tramo: {
    salidaInicio: 0,
    derivaInicio: 0.3,
  },
} as const

/**
 * Teaser 2 · receta interactiva (§5.7, fase F3). Solo lo consume el árbol de
 * `components/landing/teaser2/` y `SeccionReceta.tsx`.
 *
 * Los cinco tramos son los de la ficha, sin redondear. Se expresan como
 * fracciones del progreso de `OFFSETS.anclado` sobre el contenedor de 260vh, y
 * SE SOLAPAN a propósito: cada beat empieza antes de que termine el anterior
 * (0.12 dentro de 0–0.16, 0.24 dentro de 0.12–0.28…), que es lo que hace que el
 * documento se lea como que se ARMA y no como cinco apariciones sueltas.
 *
 * ⚠️ EL PRESUPUESTO DE §4.3·3 (máx. 4 capas simultáneas) SOBREVIVE AL SOLAPE, y
 * conviene entender por qué antes de añadir un sexto beat: los solapes son de
 * 0.04 de progreso y dentro de cada beat los elementos van escalonados, así que
 * en un cuadro cualquiera hay 2–3 capas escribiendo. Lo que NO se puede hacer es
 * dar a los 3+4+3+8 elementos su propio tramo completo.
 */
export const RECETA = {
  tramo: {
    /** Membrete: entra desde arriba y se posa. §5.7. */
    membrete: [0, 0.16],
    /** Las 4 cajas (paciente · edad · sexo · fecha), escalonadas dentro. */
    cajas: [0.12, 0.28],
    /** Las 3 filas de medicamentos, escalonadas dentro. */
    medicamentos: [0.24, 0.46],
    /** Las 8 bandas del QR. Ver `qr-receta-demo.ts` para por qué son bandas. */
    qr: [0.42, 0.62],
    /** La línea de firma VACÍA — la tinta la pone el visitante en la fase B. */
    firma: [0.58, 0.7],
  },
  /**
   * −80px de caída del membrete. Es la única distancia grande del escenario y
   * la ficha la fija: el membrete llega de fuera del papel, no de dentro.
   * ⚠️ EXIGE `overflow-hidden` EN LA HOJA. Prueba causal: a −80 el bloque queda
   * 80px por encima de su sitio, o sea FUERA del borde superior del papel; sin
   * recorte se pinta sobre la sección de arriba durante los primeros 0.16 del
   * tramo. No crea scroll (el desbordamiento hacia arriba no genera barra) pero
   * sí un fantasma visible.
   */
  membreteY: -80,
  /**
   * 12px para las cajas de datos. La ficha da este número para las cajas y NO
   * da ninguno para las filas de medicamentos ("stagger interno" a secas): las
   * filas reutilizan este mismo valor a propósito, para que dentro de la hoja
   * haya UN vocabulario de distancia y no dos. Si alguna vez se separan, que
   * sea por una decisión, no por descuido.
   */
  cajaY: 12,
  /**
   * Los 5 pasos del ensamblaje por TOQUE en móvil (§5.7). Cada valor es el
   * final de un beat, así que tocar cinco veces recorre exactamente la misma
   * coreografía que el scroll en escritorio — no es una versión reducida.
   */
  pasos: [0.16, 0.28, 0.46, 0.62, 0.7],
} as const

/**
 * Tramos de scroll para `useScroll({ offset })`. Espejo de §4.2.
 * Sintaxis de motion: "<borde del target> <borde del contenedor>".
 */
export const OFFSETS = {
  /** Entrada: del 90% al 35% del viewport. §4.2 OFF_ENTRADA. */
  entrada: ['start 0.9', 'start 0.35'],
  /** Travesía completa del elemento por el viewport. §4.2 OFF_TRAVESIA. */
  travesia: ['start end', 'end start'],
  /** Anclado (escenarios sticky). §4.2 OFF_ANCLADO. */
  anclado: ['start start', 'end end'],
  /**
   * Salida: del techo del viewport hasta desaparecer por arriba. 0 cuando el
   * borde superior del elemento toca el borde superior del contenedor, 1 cuando
   * lo toca su borde inferior.
   *
   * ⚠️ ES UN CUARTO TRAMO Y §4.2 SOLO DECLARA TRES. Se añade en la corrección
   * de F2.b (2026-08-01) porque `travesia` NO SIRVE PARA UN ELEMENTO QUE
   * ARRANCA PEGADO AL TECHO DEL DOCUMENTO: su progreso en reposo no es 0, es
   * `(vh − 56) / (vh + alto)` —0.51 a 1440×900, 0.63 a 2560×1440— y CRECE con
   * la altura del viewport, así que ningún umbral constante sobre ella está a
   * salvo. Ver el detalle en `HERO.tramo`, que es donde se pagó el error.
   *
   * Este tramo ancla el 0 a la posición de reposo por construcción: lo que
   * queda por debajo lo clampa el propio `useScroll`
   * (`framer-motion/.../scroll/offsets/index.mjs:57`, `clamp(0, 1, …)`), así que
   * el HTML del servidor y el primer cuadro coinciden en el estado inicial
   * exacto. Su longitud es EXACTAMENTE el scroll alcanzable del elemento.
   *
   * Úsalo para cualquier capa que deba estar quieta al cargar y moverse al
   * scrollear. `travesia` sigue siendo lo correcto para lo que entra desde
   * abajo (los 7 `Parallax`): ahí el 0 sí es alcanzable.
   */
  salida: ['start start', 'end start'],
} as const
