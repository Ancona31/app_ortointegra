/**
 * HojaFrontalPdf.tsx — hoja frontal del expediente clínico (Opción B,
 * "Editorial banner"). Letter full-bleed.
 *
 * Exporta la Page suelta ({@link PaginaHojaFrontal}) para que el export del
 * expediente completo (Parte 2) la componga con las N notas dentro de un solo
 * Document, y un Document standalone por si se genera sola.
 *
 * Tematización: {@link derivarPaletaNota}, los mismos 8 roles que la nota de
 * evolución. La familia ALERTA (roja) y su variante neutra son literales
 * semánticos y NO se tiñen con el color de la clínica.
 *
 * Fuentes: solo Roboto está registrada (400/500/700/400-italic). El mockup pide
 * pesos 600 y una display serif; aquí 600 → 700, las itálicas → 400-italic y el
 * mono del folio → Roboto 700 con letterSpacing.
 */

import {
  Document, Page, View, Text, Image, StyleSheet,
  Svg, Defs, LinearGradient, Stop, Rect, Circle, Path,
} from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import { t } from './PdfStyles'
import { derivarPaletaNota, mix, type PaletaNota } from './paletaNota'
import type { HojaFrontalData } from '@/lib/hojaFrontalData'

/* ------------------------------------------------------------------ */
/*  Geometría (pt)                                                     */
/* ------------------------------------------------------------------ */

const ANCHO_PAGINA = 612
const ALTO_BANNER = 222
const GUTTER = 40.5
const CARD_TOP = 153
/** Avatar 72 + padding vertical 19.5×2. El avatar es el hijo más alto. */
const CARD_ALTO = 111
/** Card + respiro de 21pt. */
const CUERPO_TOP = CARD_TOP + CARD_ALTO + 21

/**
 * El banner y la card son absolutos, así que ignoran el padding de la Page
 * (verificado contra el footer absoluto de NotaEvolucionPdf, en producción).
 * El padding de la Page existe solo para el flujo: da el gutter lateral en
 * TODAS las páginas y un margen superior decente si el contenido desborda a la
 * página 2, donde ya no hay banner.
 */
const PAGE_PADDING_TOP = GUTTER
const PAGE_PADDING_BOTTOM = 76.5

/**
 * Fondo del banner con gradiente SVG. En false cae a un View sólido `structure`
 * — fallback si el gradiente diera problemas de render en algún visor.
 */
const BANNER_CON_GRADIENTE = true

const TEXTO_LEGAL =
  'Documento emitido conforme a la NOM-004-SSA3-2012 del expediente clínico. ' +
  'Contiene datos personales sensibles protegidos por la LFPDPPP; su uso, manejo ' +
  'y resguardo son responsabilidad de quien lo recibe.'

/* ------------------------------------------------------------------ */
/*  Neutros y familias semánticas — NO teñibles                        */
/* ------------------------------------------------------------------ */

const N = {
  ink: '#16202c',
  ink2: '#2c3a49',
  muted: '#6a7a8b',
  faint: '#e4ebf2',
  white: '#ffffff',
  /* Familia ALERTA — marca el riesgo clínico. EXCLUIDA del theming. */
  alertBg: '#fbeeec',
  alertBorder: '#eccdc8',
  alertAccent: '#a83232',
  alertInk: '#5e1d1d',
  /* Glifo de silueta del avatar. */
  avatarClaro: '#cdddec',
  avatarOscuro: '#7c99b5',
} as const

/* ------------------------------------------------------------------ */
/*  Estilos — factory tematizada                                       */
/* ------------------------------------------------------------------ */

function crearEstilos(P: PaletaNota) {
  return StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: 9,
      color: N.ink2,
      backgroundColor: N.white,
      paddingTop: PAGE_PADDING_TOP,
      paddingBottom: PAGE_PADDING_BOTTOM,
      paddingHorizontal: GUTTER,
    },

    /* Banner */
    banner: { position: 'absolute', top: 0, left: 0, right: 0, height: ALTO_BANNER },
    bannerSolido: { position: 'absolute', top: 0, left: 0, right: 0, height: ALTO_BANNER, backgroundColor: P.structure },
    bannerSvg: { position: 'absolute', top: 0, left: 0 },
    clinicaRow: { flexDirection: 'row', alignItems: 'center', paddingTop: 30, paddingHorizontal: GUTTER },
    sello: {
      width: 40.5, height: 40.5, borderRadius: 20.25,
      backgroundColor: N.white, alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    },
    selloLogo: { width: 40.5, height: 40.5, objectFit: 'contain' },
    selloIniciales: { fontSize: 13.5, fontWeight: 700, color: P.structure },
    clinicaCol: { flex: 1, paddingLeft: 12 },
    clinicaNombre: { fontSize: 13.5, fontWeight: 700, color: N.white },
    clinicaSubtitulo: {
      fontSize: 8.25, fontFamily: 'Roboto', fontStyle: 'italic', fontWeight: 400,
      color: P.vitalsTitle, marginTop: 1.5,
    },
    tituloWrap: { paddingTop: 22.5, paddingHorizontal: GUTTER },
    eyebrow: { fontSize: 8.25, fontWeight: 700, color: P.vitalsSub, letterSpacing: 2.25 },
    tituloDoc: { fontSize: 30, fontWeight: 700, color: N.white, marginTop: 3 },

    /* Card flotante */
    card: {
      position: 'absolute', top: CARD_TOP, left: GUTTER, right: GUTTER,
      backgroundColor: N.white, borderRadius: 10.5,
      borderWidth: 0.75, borderColor: N.faint,
      paddingVertical: 19.5, paddingHorizontal: 22.5,
      flexDirection: 'row', alignItems: 'center',
    },
    avatar: {
      width: 72, height: 72, borderRadius: 10.5, backgroundColor: P.bgSoft,
      alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    },
    cardCentro: { flex: 1, paddingLeft: 15 },
    pacienteNombre: { fontSize: 20.25, fontWeight: 700, color: P.textStrong },
    chipsRow: { flexDirection: 'row', marginTop: 7.5, gap: 6 },
    chip: {
      backgroundColor: P.bgSoft, borderWidth: 0.75, borderColor: P.borderSoft,
      borderRadius: 6, paddingVertical: 5.25, paddingHorizontal: 9.75,
    },
    chipEtiqueta: { fontSize: 6.375, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    chipValor: { fontSize: 10.125, fontWeight: 700, color: P.textStrong, marginTop: 1.5 },
    badgeCol: { alignItems: 'flex-end', paddingLeft: 12, flexShrink: 0 },
    badgeEtiqueta: { fontSize: 6.375, fontWeight: 700, color: N.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
    badgePildora: { backgroundColor: P.structure, borderRadius: 6, paddingVertical: 6.75, paddingHorizontal: 10.5, marginTop: 4.5 },
    badgeTexto: { fontSize: 9.75, fontWeight: 700, color: N.white, letterSpacing: 0.9 },

    /* Cuerpo */
    cuerpo: { marginTop: CUERPO_TOP - PAGE_PADDING_TOP },
    grid: { flexDirection: 'row', gap: 19.5 },
    col: { flex: 1 },
    seccionFull: { marginTop: 21 },

    /* Encabezado de sección */
    seccionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 4.5 },
    seccionNumero: { fontSize: 8.25, fontWeight: 700, color: P.accent, marginRight: 6 },
    seccionTitulo: { fontSize: 7.875, fontWeight: 700, color: P.textStrong, textTransform: 'uppercase', letterSpacing: 0.9 },
    seccionLinea: { flex: 1, height: 0.75, backgroundColor: P.borderSoft, marginLeft: 9 },

    /* Fila etiqueta / valor */
    fila: {
      flexDirection: 'row', alignItems: 'flex-start',
      paddingVertical: 4.5, borderBottomWidth: 0.75, borderBottomColor: N.faint,
    },
    filaEtiqueta: { fontSize: 8.625, fontWeight: 400, color: N.muted, paddingRight: 9, flexShrink: 0 },
    filaValor: { flex: 1, fontSize: 9.75, fontWeight: 500, color: N.ink, textAlign: 'right' },

    /* Bloque de texto libre (padecimientos crónicos) */
    bloqueTitulo: {
      fontSize: 8.625, fontWeight: 400, color: N.muted,
      paddingBottom: 4.5, borderBottomWidth: 0.75, borderBottomColor: N.faint,
    },
    bloqueTexto: { fontSize: 9.75, lineHeight: 1.55, color: N.ink2, marginTop: 6 },

    /* Banda de alergias */
    banda: {
      flexDirection: 'row', alignItems: 'center', marginTop: 21,
      borderRadius: 7.5, borderWidth: 0.75, paddingVertical: 11.25, paddingHorizontal: 15,
    },
    bandaIcono: { width: 30, height: 30, borderRadius: 7.5, alignItems: 'center', justifyContent: 'center' },
    bandaCol: { flex: 1, paddingLeft: 12 },
    bandaEtiqueta: { fontSize: 7.125, fontWeight: 700, letterSpacing: 0.9, textTransform: 'uppercase' },
    bandaValor: { fontSize: 12, fontWeight: 700, marginTop: 2.25 },

    /* Footer */
    footer: {
      position: 'absolute', bottom: 25.5, left: GUTTER, right: GUTTER,
      borderTopWidth: 0.75, borderTopColor: N.faint, paddingTop: 8.25,
      flexDirection: 'row', alignItems: 'flex-start',
    },
    footerLegal: { flex: 1, fontSize: 7.125, fontWeight: 400, color: N.muted, lineHeight: 1.55, paddingRight: 18 },
    footerFirma: { alignItems: 'flex-end', flexShrink: 0 },
    footerResponsable: { fontSize: 8.25, fontWeight: 700, color: N.ink2 },
    footerRol: { fontSize: 7.125, fontWeight: 400, color: N.muted, marginTop: 1.5 },
  })
}

type EstilosHoja = ReturnType<typeof crearEstilos>

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Iniciales para el sello cuando la clínica no tiene logo. Máximo 2 letras. */
function inicialesDe(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

/** Par etiqueta/valor de una fila; el valor null hace que la fila se omita. */
type ParFila = { etiqueta: string; valor: string | null }

/* ------------------------------------------------------------------ */
/*  Sub-componentes — banner                                           */
/* ------------------------------------------------------------------ */

function FondoBanner({ P, s }: { P: PaletaNota; s: EstilosHoja }) {
  if (!BANNER_CON_GRADIENTE) return <View style={s.bannerSolido} />
  return (
    <Svg
      style={s.bannerSvg}
      width={ANCHO_PAGINA}
      height={ALTO_BANNER}
      viewBox={`0 0 ${ANCHO_PAGINA} ${ALTO_BANNER}`}
    >
      <Defs>
        <LinearGradient
          id="hfBanner"
          gradientUnits="userSpaceOnUse"
          x1={0} y1={0} x2={ANCHO_PAGINA} y2={ALTO_BANNER}
        >
          <Stop offset={0} stopColor={P.structure} />
          <Stop offset={0.55} stopColor={mix(P.structure, P.accent, 0.55)} />
          <Stop offset={1} stopColor={mix(P.accent, '#ffffff', 0.18)} />
        </LinearGradient>
      </Defs>
      <Rect x={0} y={0} width={ANCHO_PAGINA} height={ALTO_BANNER} fill="url(#hfBanner)" />
      <Circle cx={523} cy={30} r={99} fill={N.white} opacity={0.1} />
      <Circle cx={588} cy={198} r={66} fill={N.white} opacity={0.14} />
    </Svg>
  )
}

function Banner({ data, logoUrl, P, s }: {
  data: HojaFrontalData; logoUrl?: string; P: PaletaNota; s: EstilosHoja
}) {
  return (
    <View style={s.banner}>
      <FondoBanner P={P} s={s} />
      <View style={s.clinicaRow}>
        <View style={s.sello}>
          {logoUrl
            ? <Image style={s.selloLogo} src={logoUrl} />
            : <Text style={s.selloIniciales}>{t(inicialesDe(data.clinica.nombre))}</Text>}
        </View>
        <View style={s.clinicaCol}>
          <Text style={s.clinicaNombre}>{t(data.clinica.nombre)}</Text>
          {data.clinica.subtitulo
            ? <Text style={s.clinicaSubtitulo}>{t(data.clinica.subtitulo)}</Text>
            : null}
        </View>
      </View>
      <View style={s.tituloWrap}>
        <Text style={s.eyebrow}>{t('EXPEDIENTE CLÍNICO')}</Text>
        <Text style={s.tituloDoc}>{t('Hoja Frontal')}</Text>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-componentes — card del paciente                                */
/* ------------------------------------------------------------------ */

/** Silueta genérica: no hay foto de paciente en el sistema. */
function GlifoPaciente() {
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Circle cx={20} cy={14} r={7.5} fill={N.avatarOscuro} />
      <Path d="M6 36 C6 26.5 12.5 22 20 22 C27.5 22 34 26.5 34 36 Z" fill={N.avatarClaro} />
    </Svg>
  )
}

function Chip({ etiqueta, valor, s }: { etiqueta: string; valor: string; s: EstilosHoja }) {
  return (
    <View style={s.chip}>
      <Text style={s.chipEtiqueta}>{t(etiqueta)}</Text>
      <Text style={s.chipValor}>{t(valor)}</Text>
    </View>
  )
}

function CardPaciente({ data, s }: { data: HojaFrontalData; s: EstilosHoja }) {
  const p = data.paciente
  return (
    <View style={s.card}>
      <View style={s.avatar}><GlifoPaciente /></View>
      <View style={s.cardCentro}>
        <Text style={s.pacienteNombre}>{t(p.nombreCompleto)}</Text>
        <View style={s.chipsRow}>
          <Chip etiqueta="Sexo" valor={p.sexo} s={s} />
          <Chip etiqueta="Edad" valor={p.edad} s={s} />
          <Chip etiqueta="Nacimiento" valor={p.fechaNacimiento} s={s} />
        </View>
      </View>
      <View style={s.badgeCol}>
        <Text style={s.badgeEtiqueta}>{t('No. de expediente')}</Text>
        <View style={s.badgePildora}>
          <Text style={s.badgeTexto}>{t(p.numeroExpediente)}</Text>
        </View>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-componentes — secciones                                        */
/* ------------------------------------------------------------------ */

function EncabezadoSeccion({ numero, titulo, s }: { numero: string; titulo: string; s: EstilosHoja }) {
  return (
    <View style={s.seccionHead}>
      <Text style={s.seccionNumero}>{t(numero)}</Text>
      <Text style={s.seccionTitulo}>{t(titulo)}</Text>
      <View style={s.seccionLinea} />
    </View>
  )
}

function Fila({ etiqueta, valor, s }: { etiqueta: string; valor: string; s: EstilosHoja }) {
  return (
    <View style={s.fila}>
      <Text style={s.filaEtiqueta}>{t(etiqueta)}</Text>
      <Text style={s.filaValor}>{t(valor)}</Text>
    </View>
  )
}

/**
 * Sección de filas etiqueta/valor. Omite las filas sin dato y devuelve null si
 * no sobrevive ninguna — así el caller no repite el chequeo de "sección vacía".
 */
function SeccionFilas({ numero, titulo, filas, s }: {
  numero: string; titulo: string; filas: ParFila[]; s: EstilosHoja
}): ReactElement | null {
  const visibles = filas.filter((f): f is { etiqueta: string; valor: string } => !!f.valor)
  if (visibles.length === 0) return null
  return (
    <View>
      <EncabezadoSeccion numero={numero} titulo={titulo} s={s} />
      {visibles.map((f) => <Fila key={f.etiqueta} etiqueta={f.etiqueta} valor={f.valor} s={s} />)}
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Sub-componentes — banda de alergias                                */
/* ------------------------------------------------------------------ */

/** Triángulo de advertencia blanco sobre el cuadro rojo. */
function GlifoAlerta() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17">
      <Path d="M8.5 2 L16 15 L1 15 Z" fill={N.white} />
      <Rect x={7.75} y={6.6} width={1.5} height={4.6} rx={0.75} fill={N.alertAccent} />
      <Circle cx={8.5} cy={12.7} r={0.9} fill={N.alertAccent} />
    </Svg>
  )
}

/** "i" blanca sobre el cuadro muted de la variante neutra. */
function GlifoInfo() {
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17">
      <Circle cx={8.5} cy={4.6} r={1.15} fill={N.white} />
      <Rect x={7.6} y={7} width={1.8} height={5.6} rx={0.9} fill={N.white} />
    </Svg>
  )
}

/**
 * Con alergias → familia roja fija. Sin alergias → variante neutra tematizada
 * con los grises/tints de la paleta: la ausencia de alergias no es una alerta y
 * no debe competir visualmente con la que sí lo es.
 */
function BandaAlergias({ alergias, P, s }: { alergias: string | null; P: PaletaNota; s: EstilosHoja }) {
  const hay = alergias !== null
  return (
    <View
      style={[s.banda, hay
        ? { backgroundColor: N.alertBg, borderColor: N.alertBorder }
        : { backgroundColor: P.bgSoft, borderColor: P.borderSoft }]}
    >
      <View style={[s.bandaIcono, { backgroundColor: hay ? N.alertAccent : N.muted }]}>
        {hay ? <GlifoAlerta /> : <GlifoInfo />}
      </View>
      <View style={s.bandaCol}>
        <Text style={[s.bandaEtiqueta, { color: hay ? N.alertAccent : N.muted }]}>
          {t(hay ? 'Alergias declaradas' : 'Alergias')}
        </Text>
        <Text style={[s.bandaValor, { color: hay ? N.alertInk : N.ink2 }]}>
          {t(hay ? (alergias as string) : 'Sin alergias registradas')}
        </Text>
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Página                                                             */
/* ------------------------------------------------------------------ */

export interface PaginaHojaFrontalProps {
  data: HojaFrontalData
  /** Logo de la clínica ya resuelto a base64 por el pipeline. */
  logoUrl?: string
  /** Paleta hoisteada por el documento compuesto. Ausente → se deriva aquí. */
  paleta?: PaletaNota
}

export function PaginaHojaFrontal({ data, logoUrl, paleta }: PaginaHojaFrontalProps) {
  const P = paleta ?? derivarPaletaNota(data.colorPrimario, data.colorSecundario)
  const s = crearEstilos(P)
  const p = data.paciente

  const contacto = SeccionFilas({
    numero: '03',
    titulo: 'Contacto',
    filas: [
      { etiqueta: 'Teléfono', valor: p.telefono },
      { etiqueta: 'Email', valor: p.email },
      { etiqueta: 'Dirección', valor: p.direccion },
    ],
    s,
  })

  const antecedentes = SeccionFilas({
    numero: '04',
    titulo: 'Antecedentes',
    filas: [
      { etiqueta: 'No patológicos', valor: p.antNoPatologicos },
      { etiqueta: 'Quirúrgicos', valor: p.antQuirurgicos },
      { etiqueta: 'Familiares', valor: p.antFamiliares },
      { etiqueta: 'Medicamentos actuales', valor: p.medicamentosActuales },
    ],
    s,
  })

  // 03 y 04 comparten un segundo grid de 2 columnas, en eco del de 01/02. Si
  // solo sobrevive una de las dos, ocupa el ancho completo (una columna suelta
  // con su vecina vacía se lee como un error de maquetación).
  const ambas = contacto !== null && antecedentes !== null

  return (
    <Page size="LETTER" style={s.page}>
      {/* Footer fixed: se repite en la página 2 si los antecedentes desbordan. */}
      <View style={s.footer} fixed>
        <Text style={s.footerLegal}>{t(TEXTO_LEGAL)}</Text>
        <View style={s.footerFirma}>
          <Text style={s.footerResponsable}>{t(data.responsable.nombre)}</Text>
          <Text style={s.footerRol}>{t('Responsable del expediente')}</Text>
        </View>
      </View>

      {/* Banner y card: absolutos y NO fixed → solo en la primera página. */}
      <Banner data={data} logoUrl={logoUrl} P={P} s={s} />
      <CardPaciente data={data} s={s} />

      <View style={s.cuerpo}>
        <View style={s.grid}>
          <View style={s.col}>
            <EncabezadoSeccion numero="01" titulo="Identificación" s={s} />
            <Fila etiqueta="Nombre completo" valor={p.nombreCompleto} s={s} />
            <Fila etiqueta="Fecha de nacimiento" valor={p.fechaNacimiento} s={s} />
            <Fila etiqueta="Apertura del expediente" valor={data.fechaApertura ?? '—'} s={s} />
          </View>
          <View style={s.col}>
            <EncabezadoSeccion numero="02" titulo="Datos clínicos base" s={s} />
            <Text style={s.bloqueTitulo}>{t('Padecimientos crónicos')}</Text>
            <Text style={s.bloqueTexto}>
              {t(p.padecimientosCronicos ?? 'Ninguno conocido')}
            </Text>
          </View>
        </View>

        <BandaAlergias alergias={p.alergias} P={P} s={s} />

        {ambas ? (
          <View style={[s.grid, s.seccionFull]}>
            <View style={s.col}>{contacto}</View>
            <View style={s.col}>{antecedentes}</View>
          </View>
        ) : (
          <>
            {contacto ? <View style={s.seccionFull}>{contacto}</View> : null}
            {antecedentes ? <View style={s.seccionFull}>{antecedentes}</View> : null}
          </>
        )}
      </View>
    </Page>
  )
}

/* ------------------------------------------------------------------ */
/*  Documento standalone                                               */
/* ------------------------------------------------------------------ */

export interface HojaFrontalProps {
  data: HojaFrontalData
  logoUrl?: string
}

export function renderHojaFrontal(props: HojaFrontalProps) {
  return <HojaFrontalPdf {...props} />
}

export default function HojaFrontalPdf({ data, logoUrl }: HojaFrontalProps) {
  return (
    <Document>
      <PaginaHojaFrontal data={data} logoUrl={logoUrl} />
    </Document>
  )
}
