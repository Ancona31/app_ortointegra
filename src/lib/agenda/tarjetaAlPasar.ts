/**
 * src/lib/agenda/tarjetaAlPasar.ts
 *
 * T3 · La tarjeta de lectura AL PASAR EL RATÓN (petición de Angel, punto 15 de
 * la tanda tras sus pruebas a mano), detrás del interruptor de la agenda v2.
 * Puro: la preferencia del dispositivo y el VIGÍA, la máquina de tiempos que
 * decide cuándo abrir y cuándo cerrar. El oyente del DOM vive en
 * `useTarjetaAlPasar.ts`, junto a la ruta; la tarjeta es `TarjetaLectura.tsx`.
 *
 * Reglas (las de Angel):
 *   · se abre tras `ESPERA_ABRIR_MS` de QUIETUD sobre la cita: cada movimiento
 *     dentro de ella vuelve a empezar la cuenta;
 *   · se cierra al retirar el ratón de la cita y de la tarjeta, con un margen
 *     (`MARGEN_CERRAR_MS`) para cruzar de la una a la otra;
 *   · un clic la deja fija (eso lo hace quien llama: deja de ser «al pasar» y
 *     se lo dice al vigía con `soltar`);
 *   · nunca mientras se arrastra o se estira una cita: con un botón pulsado no
 *     se arma (`mover` con `botones > 0`) y la abierta se cierra (pulsar su cita
 *     no la cierra: el clic la fija), y la cita pulsada no se vuelve a armar
 *     hasta que el ratón salga de ella (si no, al soltar tras un arrastre la
 *     tarjeta saltaría sola un segundo después);
 *   · `puedeAbrir` (lo decide quien llama) se pregunta AL DISPARAR: ratón fino,
 *     preferencia encendida, ningún diálogo abierto.
 *
 * ⚠️ NO SE LLAMA `tarjetaLectura.ts` NI NADA QUE SÓLO SE DISTINGA DE UN
 * COMPONENTE POR LA MAYÚSCULA (CLAUDE.md, «Estilo de código»).
 */

/** Segundos de quietud antes de abrir (Angel: «más de 1 segundo»). */
export const ESPERA_ABRIR_MS = 1000
/** Lo que se espera al salir antes de cerrar: da tiempo a cruzar el hueco de 8 px hasta la tarjeta. */
export const MARGEN_CERRAR_MS = 300

/** El reloj, inyectable para probar sin esperar (`T`: el asa del temporizador). */
export interface RelojVigia<T> {
  poner(fn: () => void, ms: number): T
  quitar(asa: T): void
}

export interface AccionesVigia {
  /** ¿Se puede abrir ahora? (ratón fino, preferencia, ningún diálogo). */
  puedeAbrir(): boolean
  abrir(citaId: string): void
  cerrar(): void
}

export interface VigiaAlPasar {
  /** El puntero se movió; `citaId` es la cita debajo, o `null`. `botones` = `PointerEvent.buttons`. */
  mover(citaId: string | null, botones: number): void
  /** Se pulsó un botón (arrastre, estiramiento o clic): no se arma hasta salir de esa cita. */
  pulsar(): void
  entrarTarjeta(): void
  salirTarjeta(): void
  /** La tarjeta dejó de ser «al pasar» (se fijó con un clic, o se cerró por otra vía). */
  soltar(): void
  destruir(): void
}

/** El vigía. Un solo temporizador de cada clase vivo a la vez. */
export function crearVigiaAlPasar<T>(acciones: AccionesVigia, reloj: RelojVigia<T>): VigiaAlPasar {
  let sobre: string | null = null
  let desarmada: string | null = null
  let abierta: string | null = null
  let enTarjeta = false
  let tAbrir: T | null = null
  let tCerrar: T | null = null
  const quitar = (t: T | null): null => { if (t !== null) reloj.quitar(t); return null }

  function programarCierre(): void {
    tCerrar = quitar(tCerrar)
    tCerrar = reloj.poner(() => {
      tCerrar = null
      if (abierta === null || enTarjeta || sobre === abierta) return
      abierta = null
      acciones.cerrar()
    }, MARGEN_CERRAR_MS)
  }

  function armar(id: string): void {
    tAbrir = quitar(tAbrir)
    tAbrir = reloj.poner(() => {
      tAbrir = null
      if (sobre !== id || !acciones.puedeAbrir()) return
      tCerrar = quitar(tCerrar)
      abierta = id
      acciones.abrir(id)
    }, ESPERA_ABRIR_MS)
  }

  return {
    mover(citaId, botones) {
      // Un arrastre (botón pulsado) cierra la abierta: la tarjeta no acompaña al gesto.
      if (botones !== 0 && abierta !== null) {
        abierta = null
        tCerrar = quitar(tCerrar)
        acciones.cerrar()
      }
      if (citaId !== sobre) {
        if (desarmada !== null && citaId !== desarmada) desarmada = null
        sobre = citaId
        tAbrir = quitar(tAbrir)
        if (abierta !== null && citaId !== abierta && !enTarjeta) programarCierre()
        if (abierta !== null && citaId === abierta) tCerrar = quitar(tCerrar)
      }
      if (citaId === null || botones !== 0 || citaId === desarmada || citaId === abierta) {
        tAbrir = quitar(tAbrir)
        return
      }
      armar(citaId)
    },
    pulsar() {
      tAbrir = quitar(tAbrir)
      desarmada = sobre
    },
    entrarTarjeta() {
      enTarjeta = true
      tCerrar = quitar(tCerrar)
      tAbrir = quitar(tAbrir)
    },
    salirTarjeta() {
      enTarjeta = false
      if (abierta !== null && sobre !== abierta) programarCierre()
    },
    soltar() {
      abierta = null
      enTarjeta = false
      tCerrar = quitar(tCerrar)
    },
    destruir() {
      tAbrir = quitar(tAbrir)
      tCerrar = quitar(tCerrar)
    },
  }
}

/* ── La preferencia «Abrir la tarjeta al pasar el ratón» ─────────────────
   Por dispositivo, como la de los atajos (`atajosAgenda.ts`). ENCENDIDA por
   omisión: es lo que Angel pidió, y quien no la quiera la apaga en la
   configuración de la agenda. No es un dato de paciente. */

export const CLAVE_TARJETA_AL_PASAR = 'spinus.agenda.tarjeta-al-pasar'

/** Lo mínimo de `Storage`; `localStorage` lo cumple. */
export interface AlmacenTarjetaAlPasar {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
}

/** Encendida por omisión. Sin almacén o si falla, también. */
export function leerTarjetaAlPasar(almacen: AlmacenTarjetaAlPasar | null): boolean {
  try { return almacen?.getItem(CLAVE_TARJETA_AL_PASAR) !== 'no' } catch { return true }
}

/** Guarda la preferencia. Un almacén bloqueado (modo privado) no rompe nada. */
export function guardarTarjetaAlPasar(almacen: AlmacenTarjetaAlPasar | null, encendida: boolean): void {
  try { almacen?.setItem(CLAVE_TARJETA_AL_PASAR, encendida ? 'si' : 'no') } catch { /* vale para esta visita */ }
}

/** La consulta de medios de «dispositivo con ratón». En táctil sigue el toque. */
export const MEDIO_RATON = '(hover: hover) and (pointer: fine)'
