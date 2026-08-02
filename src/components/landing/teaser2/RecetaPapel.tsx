'use client'

import { motion, useTransform, type MotionValue } from 'motion/react'
import { RECETA } from '@/components/landing/motion/tokens'
import FirmaCanvas from './FirmaCanvas'
import { QR_BANDAS, QR_LADO } from './qr-receta-demo'
import {
  DIAGNOSTICO,
  EDAD,
  FECHA,
  FOLIO,
  MEDICAMENTOS,
  MEDICO,
  PACIENTE,
  SEXO,
  type PaletaReceta,
} from './receta-demo'

/* ═══════════════════════════════════════════════════════════════════════════
   RÉPLICA EN HTML DE LA RECETA REAL (§5.7)

   ⚠️ ESTO NO ES EL PDF: ES UNA COPIA A MANO DE `src/lib/pdf/RecetaPdf.tsx`,
   `PdfHeader.tsx` y `PdfBarras.tsx`. Se hace así porque `@react-pdf/renderer`
   no renderiza al DOM y por tanto no se puede animar, que es todo el propósito
   del teaser. **La deuda de desfase está registrada**: si alguien cambia el PDF
   real, esta hoja se queda vieja y NADA lo detecta — ni el build, ni el lint,
   ni un test. La única defensa es que los números de aquí sean LOS MISMOS que
   los de allá, y por eso:

   1 · LA UNIDAD ES EL PUNTO DEL PDF. `--rx-u` vale `100cqw / 612`, y 612pt es
       el ancho de una hoja carta en `@react-pdf`. O sea que cada número que se
       escribe aquí con `u()` es LITERALMENTE el número que está en
       `RecetaPdf.tsx`: `u(8)` es su `fontSize: 8`, `u(50)` su
       `paddingHorizontal: 50`. Auditar el desfase es comparar dos columnas de
       cifras, no reinterpretar un diseño.
   2 · ESCALA SIN REFLUJO. Al colgar todo de una unidad de contenedor, la hoja
       se encoge y se agranda como una hoja de papel: proporciones idénticas a
       cualquier ancho, sin puntos de ruptura y sin JS que mida nada. Un
       documento que se re-maqueta al estrecharse no parece un documento.
   3 · LOS COLORES DE AQUÍ NO SON LOS DE LA LANDING, y no hay que "normalizarlos"
       a `--lp-*`. Son los del PDF (`#e5e7eb`, `#555`, `#888`…). La hoja imita a
       la app, no a la página que la enseña.

   ⚠️ A ESTE TAMAÑO LA HOJA ES LA PÁGINA REAL A ~0.65×, y los rótulos de 6.5–8pt
   NO SE LEEN — igual que no se leen en el PDF de verdad al 65% de zoom. Es
   deliberado: lo que el visitante tiene que leer (Rx, paciente, diagnóstico,
   nombres de los medicamentos) está en 10–34pt. No agrandes la tipografía
   "para que se lea": romperías la única propiedad que hace auditable esta
   copia.

   ═══ EL HUECO BLANCO DEL CUERPO: POR QUÉ LA HOJA SIGUE SIENDO CARTA ═══
   Con 3 medicamentos el contenido mide ~414 unidades de las 792 de una carta,
   así que entre la última fila y el bloque de QR/firma quedan ~378 unidades de
   blanco (48% de la hoja). Se evaluó **contraer el cuerpo al contenido dejando
   un mínimo** y se DESCARTÓ, por geometría y no por gusto:

     · La hoja mide 612 de ancho y el contenido 414 de alto. Cualquier alto
       "pegado al contenido" —incluso reservando un margen generoso— da una caja
       MÁS ANCHA QUE ALTA: 414+100 = 514 < 612. Eso ya no es una hoja, es una
       tarjeta apaisada, y el teaser dejaría de enseñar un documento.
     · El alto mínimo que todavía se lee como hoja vertical ronda 673 (1.10:1),
       y a ese alto el hueco baja de 378 a 259 unidades. O sea: se paga entera
       la fidelidad de proporción —que ES el argumento del teaser— a cambio de
       un tercio del problema. Mal cambio.

   **Lo que sí se corrigió es la ESCALA DEL PAPEL EN MÓVIL.** El hueco se lee
   como error, y no como margen, porque en un teléfono el tipo es diminuto
   respecto a la hoja: la misma proporción de blanco en una carta impresa se lee
   como margen precisamente porque el texto se lee. Así que por debajo de `lg`
   la réplica emula un papel de **480 puntos de ancho** en vez de 612 — misma
   proporción carta, misma maqueta, unidad un 27% mayor. El contenido pasa a
   ocupar ~70% de la hoja en vez de ~52%, el hueco cae de ~221px a ~139px sobre
   una hoja de 358px de ancho, y de paso el cuerpo sube de 5.8 a 7.5px.

   ⚠️ SI ALGÚN DÍA HAY «RECOMENDACIONES» EN LA RECETA DEMO, EL HUECO SE LLENA
   SOLO y estos 480 pueden volver a 612. El bloque existe en el PDF real
   (`RecetaPdf.tsx:594`) y aquí no se replica porque **no se inventa texto
   clínico**: lo escribe Angel o no existe.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Un valor en puntos del PDF, convertido a la escala de la hoja. */
const u = (n: number): string => `calc(var(--rx-u) * ${n})`

/** Grises del PDF real. NO son tokens de la landing — ver la nota 3 de arriba. */
const PAPEL = {
  tinta: '#1a1a1a',
  borde: '#e5e7eb',
  bordeLogo: '#d1d5db',
  presentacion: '#555',
  principio: '#888',
  cedula: '#666',
  leyenda: '#777',
  selloFirma: '#c0c0c0',
  fondoLogo: '#fafbfc',
} as const

/**
 * Ventana de un elemento dentro del tramo de su beat. Los `n` elementos se
 * reparten el tramo en partes iguales y consecutivas: el i-ésimo empieza justo
 * donde acaba el anterior. Sin solape DENTRO del grupo — el solape entre beats
 * ya lo dan los tramos de `RECETA.tramo` (§4.3·3: como mucho una capa por grupo
 * escribiendo a la vez).
 */
function subtramo(i: number, n: number, tramo: readonly number[]): [number, number] {
  const paso = (tramo[1] - tramo[0]) / n
  return [tramo[0] + paso * i, tramo[0] + paso * (i + 1)]
}

interface CapaProps {
  progreso: MotionValue<number>
  /**
   * ⚠️ `readonly number[]` y no `[number, number]`: los tramos de `RECETA` van
   * `as const`, o sea readonly, y `useTransform` pide un array MUTABLE. Por eso
   * abajo se copian con spread antes de pasarlos — la copia es lo que quita el
   * `readonly`, y sin ella TypeScript cae en la sobrecarga equivocada de
   * `useTransform` (la de `Record<string, any[]>`) y el error que sale no habla
   * de readonly, habla de que un MotionValue no es un string.
   */
  tramo: readonly number[]
  /** Desplazamiento inicial en unidades de hoja. 0 = solo funde. */
  desde?: number
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}

/**
 * Una capa del ensamblaje: funde y se posa a lo largo de su ventana de scroll.
 *
 * Existe porque el mismo gesto se repite QUINCE veces en esta hoja (membrete,
 * 5 cajas, 4 de la tabla, 8 bandas de QR, firma) y porque `useTransform` es un
 * hook: llamarlo dentro de un `.map` es un error de las reglas de hooks y
 * además rompe el lint. Cada elemento tiene que ser su propio componente para
 * tener sus propios hooks. No es una abstracción especulativa — es la única
 * forma de escribir esto.
 */
function Capa({ progreso, tramo, desde = 0, className, style, children }: CapaProps): React.JSX.Element {
  const opacity = useTransform(progreso, [...tramo], [0, 1])
  const y = useTransform(progreso, [...tramo], [desde, 0])
  return (
    <motion.div data-lp-reveal="" className={className} style={{ ...style, opacity, y }}>
      {children}
    </motion.div>
  )
}

/** Caja de dato del PDF: rótulo en versalitas + valor. `RecetaPdf.tsx:284-316`. */
function CajaDato({
  rotulo, valor, paleta, progreso, indice, tamValor = 10, peso = 1,
}: {
  rotulo: string; valor: string; paleta: PaletaReceta
  progreso: MotionValue<number>; indice: number; tamValor?: number
  /** `flex` de la caja. Son los del PDF: `RecetaPdf.tsx:518,530`. */
  peso?: number
}): React.JSX.Element {
  return (
    <Capa
      progreso={progreso}
      tramo={subtramo(indice, 5, RECETA.tramo.cajas)}
      desde={RECETA.cajaY}
      className="min-w-0"
      style={{
        flex: peso,
        border: `${u(0.5)} solid ${PAPEL.borde}`,
        borderRadius: u(2),
        padding: `${u(1)} ${u(5)} ${u(1.5)}`,
      }}
    >
      <p style={{ fontSize: u(7.5), fontWeight: 700, color: paleta.navy, letterSpacing: u(0.4), textTransform: 'uppercase' }}>
        {rotulo}
      </p>
      <p style={{ fontSize: u(tamValor), color: PAPEL.tinta, fontWeight: 500, lineHeight: 1.1 }}>
        {valor}
      </p>
    </Capa>
  )
}

/** Fila de la tabla de medicamentos. `RecetaPdf.tsx:565-590`. */
function FilaMedicamento({
  indice, paleta, progreso,
}: { indice: number; paleta: PaletaReceta; progreso: MotionValue<number> }): React.JSX.Element {
  const med = MEDICAMENTOS[indice]
  return (
    <Capa
      progreso={progreso}
      /* +1: el elemento 0 del beat es la barra de sección con el encabezado de
         la tabla. Barra + 3 filas = los "índice 0→3" de la ficha. */
      tramo={subtramo(indice + 1, MEDICAMENTOS.length + 1, RECETA.tramo.medicamentos)}
      desde={RECETA.cajaY}
      className="flex"
      style={{
        padding: `${u(3)} ${u(4)}`,
        borderBottom: `${u(0.5)} solid ${PAPEL.borde}`,
        background: indice % 2 === 1 ? `${paleta.acento}0D` : undefined,
      }}
    >
      <span style={{ width: u(18), textAlign: 'center', fontSize: u(8.5), fontWeight: 700, color: paleta.acento }}>
        {indice + 1}
      </span>
      <span className="flex-[3] min-w-0" style={{ paddingRight: u(4) }}>
        <span className="block" style={{ fontSize: u(8), fontWeight: 700, color: PAPEL.tinta }}>{med.nombre}</span>
        <span className="block" style={{ fontSize: u(7), color: PAPEL.presentacion, marginTop: u(0.5) }}>{med.presentacion}</span>
        <span className="block" style={{ fontSize: u(6.5), color: PAPEL.principio, marginTop: u(0.5) }}>{med.principio}</span>
      </span>
      <span className="flex-1 min-w-0" style={{ fontSize: u(7.5), color: paleta.acento, fontWeight: 500, paddingRight: u(4) }}>
        {med.via}
      </span>
      <span className="flex-[2] min-w-0" style={{ fontSize: u(7.5), color: '#333', lineHeight: 1.3 }}>
        {med.indicacion}
      </span>
    </Capa>
  )
}

/**
 * Una banda del QR. Ocho de estas dibujan el símbolo completo; la aparición
 * barre en diagonal, como una impresora. Ver `qr-receta-demo.ts`.
 */
function BandaQR({ indice, progreso }: { indice: number; progreso: MotionValue<number> }): React.JSX.Element {
  const opacity = useTransform(progreso, subtramo(indice, QR_BANDAS.length, RECETA.tramo.qr), [0, 1])
  return <motion.path data-lp-reveal="" d={QR_BANDAS[indice]} fill="#000000" style={{ opacity }} />
}

interface RecetaPapelProps {
  progreso: MotionValue<number>
  paleta: PaletaReceta
}

export default function RecetaPapel({ progreso, paleta }: RecetaPapelProps): React.JSX.Element {
  /* La barra inferior cierra el membrete y llega desde ABAJO, simétrica a la
     de arriba: las dos son el papel membretado, no contenido. */
  const cierreOpacity = useTransform(progreso, [...RECETA.tramo.membrete], [0, 1])
  const cierreY = useTransform(progreso, [...RECETA.tramo.membrete], [-RECETA.membreteY, 0])

  return (
    /* `@container` + `--rx-u` = la hoja entera cuelga de su propio ancho.
       ⚠️ `overflow-hidden` NO ES OPCIONAL: el membrete entra desde −80 unidades,
       o sea desde FUERA del borde superior del papel, y la barra inferior desde
       +80. Sin recorte, las dos se pintan sobre lo que haya arriba y abajo
       durante los primeros 0.16 del tramo. */
    /* ⚠️ LA PROPORCIÓN ES CARTA SIEMPRE (612:792) Y LO QUE CAMBIA EN MÓVIL ES
       EL ANCHO DE PAPEL QUE SE EMULA. Ver la nota del hueco vacío al pie de
       este archivo antes de tocar cualquiera de los dos números.
       ⚠️ EL RADIO VA EN PX Y NO EN `u()`: `cqw` dentro del elemento que DECLARA
       el contenedor resuelve contra su ancestro —aquí ninguno—, o sea contra el
       viewport. `u(4)` aquí valdría 9px a 1440 en vez de 3. Los descendientes
       sí lo resuelven bien contra esta caja, que es donde se usa `u()`. Una
       hoja de papel no tiene esquinas redondeadas: los 3px existen solo para
       que se lea como objeto sobre la mesa. */
    <div
      className="@container relative w-full overflow-hidden rounded-[3px] bg-white shadow-[0_24px_60px_rgb(0_0_0/0.45)] [--rx-u:calc(100cqw/480)] lg:[--rx-u:calc(100cqw/612)]"
      style={{ aspectRatio: '612 / 792' }}
    >
      <div className="flex h-full flex-col">
        {/* ═══ MEMBRETE (beat 1) — barras, logo, médico, Rx, doble filete ═══ */}
        <Capa progreso={progreso} tramo={RECETA.tramo.membrete} desde={RECETA.membreteY}>
          <div style={{ height: u(14), background: paleta.navy }} />
          <div style={{ height: u(2), background: paleta.acento }} />
          <div className="flex items-center" style={{ gap: u(10), padding: `${u(8)} ${u(50)} 0` }}>
            {/* Slot del logo con candado — §5.7. El candado ES el mensaje: hay
                un hueco reservado para tu marca y se abre al registrarte. */}
            <div
              className="flex shrink-0 items-center justify-center"
              style={{
                width: u(52), height: u(52), borderRadius: u(26),
                border: `${u(1.5)} solid ${PAPEL.bordeLogo}`, background: PAPEL.fondoLogo,
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke={PAPEL.principio} strokeWidth={1.6} aria-hidden style={{ width: u(20), height: u(20) }}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: u(13), fontWeight: 700, color: paleta.navy, letterSpacing: u(0.3), lineHeight: 1.2 }}>
                {MEDICO.nombre}
              </p>
              <p style={{ fontSize: u(7.5), color: paleta.acento, fontWeight: 500, marginTop: u(1), letterSpacing: u(0.3) }}>
                {MEDICO.especialidad}
              </p>
              <p style={{ fontSize: u(7), color: PAPEL.cedula, marginTop: u(2) }}>
                {'·'} Céd. Prof. {MEDICO.cedulaProfesional}   {'·'} Céd. Esp. {MEDICO.cedulaEspecialidad}
              </p>
              <p style={{ fontSize: u(6.5), color: PAPEL.principio, marginTop: u(1) }}>{MEDICO.consultorio}</p>
            </div>
            <div className="shrink-0 text-center" style={{ width: u(52) }}>
              <p style={{ fontSize: u(34), fontWeight: 700, color: paleta.acento, opacity: 0.85, lineHeight: 1 }}>Rx</p>
              <p style={{ fontSize: u(7), fontWeight: 700, color: paleta.navy, marginTop: u(4) }}>{FOLIO}</p>
            </div>
          </div>
          <div style={{ height: u(1.5), background: paleta.navy, margin: `${u(6)} ${u(50)} 0` }} />
          <div style={{ height: u(0.5), background: paleta.acento, margin: `${u(1.5)} ${u(50)} 0` }} />
        </Capa>

        {/* ═══ CUERPO ═══ */}
        <div className="flex min-h-0 flex-1 flex-col" style={{ padding: `${u(8)} ${u(50)} 0` }}>
          {/* Cajas de datos (beat 2) — 4 en fila + diagnóstico = los "índice
              0→4" de la ficha, que nombra cuatro pero cuenta cinco. */}
          <div className="flex" style={{ gap: u(6) }}>
            {/* Los pesos son los del PDF (`flex: 3` en paciente, `flex: 2` en
                fecha): con los cuatro a `flex-1` —como estaban— el nombre y la
                fecha larga se partían en dos líneas y las cajas de Edad y Sexo
                sobraban de ancho. Era un defecto de la réplica, no del PDF. */}
            <CajaDato rotulo="Paciente" valor={PACIENTE} paleta={paleta} progreso={progreso} indice={0} peso={3} />
            <CajaDato rotulo="Edad" valor={EDAD} paleta={paleta} progreso={progreso} indice={1} />
            <CajaDato rotulo="Sexo" valor={SEXO} paleta={paleta} progreso={progreso} indice={2} />
            <CajaDato rotulo="Fecha" valor={FECHA} paleta={paleta} progreso={progreso} indice={3} tamValor={9} peso={2} />
          </div>
          <Capa
            progreso={progreso}
            tramo={subtramo(4, 5, RECETA.tramo.cajas)}
            desde={RECETA.cajaY}
            style={{
              marginTop: u(2.5), border: `${u(0.5)} solid ${PAPEL.borde}`,
              borderRadius: u(2), padding: `${u(2.5)} ${u(6)} ${u(3)}`,
            }}
          >
            <p style={{ fontSize: u(7.5), fontWeight: 700, color: paleta.navy, letterSpacing: u(0.4), textTransform: 'uppercase' }}>
              Diagnóstico
            </p>
            <p style={{ fontSize: u(12), fontWeight: 700, color: PAPEL.tinta, lineHeight: 1.3 }}>{DIAGNOSTICO}</p>
          </Capa>

          {/* Tabla (beat 3): barra de sección + encabezado = elemento 0. */}
          <Capa progreso={progreso} tramo={subtramo(0, MEDICAMENTOS.length + 1, RECETA.tramo.medicamentos)} desde={RECETA.cajaY}>
            <div
              style={{
                background: `${paleta.navy}0A`, borderLeft: `${u(3)} solid ${paleta.navy}`,
                borderRadius: u(3), padding: `${u(3)} 0 ${u(3)} ${u(8)}`, marginTop: u(6), marginBottom: u(4),
              }}
            >
              <p style={{ color: paleta.navy, fontSize: u(9), fontWeight: 700 }}>Medicamentos</p>
            </div>
            <div
              className="flex"
              style={{
                background: paleta.navy, borderRadius: `${u(3)} ${u(3)} 0 0`,
                padding: `${u(3)} ${u(4)}`,
                fontSize: u(6.5), fontWeight: 700, color: '#ffffff', letterSpacing: u(0.3), textTransform: 'uppercase',
              }}
            >
              <span style={{ width: u(18), textAlign: 'center' }}>#</span>
              <span className="flex-[3]">Medicamento</span>
              <span className="flex-1">Vía</span>
              <span className="flex-[2]">Indicaciones</span>
            </div>
          </Capa>
          {MEDICAMENTOS.map((med, i) => (
            <FilaMedicamento key={med.nombre} indice={i} paleta={paleta} progreso={progreso} />
          ))}

          {/* ═══ PIE: QR (beat 4) + firma (beat 5) ═══ */}
          <div className="mt-auto flex items-end justify-between" style={{ gap: u(8), paddingTop: u(6), paddingBottom: u(12) }}>
            <div className="text-center">
              <svg
                viewBox={`0 0 ${QR_LADO} ${QR_LADO}`}
                shapeRendering="crispEdges"
                style={{ width: u(50), height: u(50), background: '#ffffff' }}
                role="img"
                aria-label="Código QR que abre la verificación de esta receta de demostración"
              >
                {QR_BANDAS.map((banda, i) => (
                  <BandaQR key={banda.slice(0, 12) + i} indice={i} progreso={progreso} />
                ))}
              </svg>
              <p style={{ fontSize: u(6.5), color: PAPEL.leyenda, maxWidth: u(72), lineHeight: 1.1, marginTop: u(2) }}>
                Escanea para verificar autenticidad
              </p>
            </div>

            <Capa progreso={progreso} tramo={RECETA.tramo.firma} className="text-center" style={{ minWidth: u(190) }}>
              {/* El canvas se apoya SOBRE la línea punteada: lo que el visitante
                  traza queda encima del filete, como una firma de verdad. */}
              <div className="relative" style={{ height: u(44), marginBottom: u(4) }}>
                <FirmaCanvas tinta={PAPEL.tinta} className="absolute inset-0" />
              </div>
              <div style={{ borderTop: `${u(1)} dashed ${paleta.navy}`, paddingTop: u(5) }}>
                <p style={{ fontSize: u(8.5), fontWeight: 700, color: paleta.navy }}>{MEDICO.nombre}</p>
                <p style={{ fontSize: u(6.5), color: PAPEL.cedula, marginTop: u(1) }}>Céd. Prof. {MEDICO.cedulaProfesional}</p>
                <p style={{ fontSize: u(6.5), color: PAPEL.cedula, marginTop: u(1) }}>Céd. Esp. {MEDICO.cedulaEspecialidad}</p>
                <p style={{ fontSize: u(5.5), color: PAPEL.selloFirma, marginTop: u(3), letterSpacing: u(1.5), textTransform: 'uppercase' }}>
                  Firma y sello
                </p>
              </div>
            </Capa>
          </div>
        </div>

        {/* Barra inferior — cierra el membrete, llega desde abajo. */}
        <motion.div data-lp-reveal="" style={{ opacity: cierreOpacity, y: cierreY }}>
          <div style={{ height: u(2), background: paleta.acento }} />
          <div style={{ background: paleta.navy, padding: `${u(12)} ${u(50)}` }}>
            <p style={{ fontSize: u(6.5), color: '#ffffff', opacity: 0.85, textAlign: 'center' }}>
              {MEDICO.consultorio}
            </p>
            <p style={{ fontSize: u(5.5), color: '#ffffff', opacity: 0.5, textAlign: 'center', marginTop: u(3) }}>
              Documento generado por Spinus — La columna vertebral de tu práctica médica
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
