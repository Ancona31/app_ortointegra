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
} as const
