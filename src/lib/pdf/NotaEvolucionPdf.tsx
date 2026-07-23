import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { Style } from '@react-pdf/types'
import type { ReactElement } from 'react'
import { t } from './PdfStyles'
import type { PdfMedicoData, PdfConsultorioData } from './PdfStyles'
import { derivarPaletaNota, type PaletaNota } from './paletaNota'
import type { NotaRenderData } from '@/lib/notaRenderData'
import type { SeccionNota, BloqueNota, SpanTexto, TipoSeccion } from '@/lib/notaParser'
import type { SignosVitales } from '@/types'

/* ------------------------------------------------------------------ */
/*  Contrato                                                           */
/* ------------------------------------------------------------------ */

/**
 * Contrato de 4 props compatible con mobileShare.ts y generar-pdf/route.ts.
 * Internamente el render usa SOLO `data` (NotaRenderData) + `logoUrl` ya
 * resuelto a base64 por el pipeline; `medico`/`consultorio` se aceptan por
 * compatibilidad de firma y se ignoran (los datos vivos ya vienen en `data`).
 * El color también viaja en `data.medico.colorPrimario/colorSecundario`.
 */
export interface NotaEvolucionProps {
  medico?: PdfMedicoData | null
  data: NotaRenderData
  logoUrl?: string
  consultorio?: PdfConsultorioData
}

/* ------------------------------------------------------------------ */
/*  Neutros NO teñibles + familia addendum (literales)                 */
/* ------------------------------------------------------------------ */

const N = {
  valueInk: '#16202c',
  labelInk: '#2c3a49',
  muted: '#6a7a8b',
  hair: '#d2dce6',
  faint: '#e4ebf2',
  white: '#fff',
  // Familia addendum: rojo semántico (marca la corrección). EXCLUIDA del
  // theming del perfil — no debe teñirse con el color de la clínica.
  addBorder: '#eccdc8',
  addAccent: '#a83232',
  addBg: '#fbeeec',
} as const

/* ------------------------------------------------------------------ */
/*  Estilos — factory tematizada por la paleta derivada del perfil     */
/* ------------------------------------------------------------------ */

function crearEstilos(P: PaletaNota) {
  return StyleSheet.create({
    page: {
      fontFamily: 'Roboto',
      fontSize: 9,
      color: N.labelInk,
      backgroundColor: N.white,
      // Gobierna también al header `fixed` (está en flujo, no absoluto): en las
      // páginas 2+ el membrete arranca a 24pt del borde superior.
      paddingTop: 24,
      paddingRight: 36,
      paddingBottom: 50.4,
      paddingLeft: 36,
    },

    /* Header */
    header: { marginBottom: 0 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    chip: {
      width: 28.5,
      height: 28.5,
      borderRadius: 14.25,
      borderWidth: 1.125,
      borderColor: P.structure,
      backgroundColor: P.borderSoft,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    chipLogo: { width: 28.5, height: 28.5, objectFit: 'contain' },
    chipIniciales: { fontSize: 9, fontWeight: 700, color: P.structure },
    headerCol: { flex: 1, paddingHorizontal: 9 },
    medNombre: { fontSize: 12, fontWeight: 700, color: P.textStrong },
    medEsp: { fontSize: 8.25, fontFamily: 'Roboto', fontStyle: 'italic', fontWeight: 400, color: P.accent, marginTop: 1 },
    medMeta: { fontSize: 7.125, marginTop: 1.5 },
    metaLabel: { fontWeight: 700, color: N.labelInk },
    metaValor: { fontWeight: 400, color: N.muted },
    metaSep: { color: N.hair },
    fechaChip: {
      backgroundColor: P.bgSoft,
      borderWidth: 1,
      borderColor: P.borderSoft,
      borderRadius: 5.25,
      paddingVertical: 3.5,
      paddingHorizontal: 9,
      alignItems: 'flex-end',
    },
    fechaChipEyebrow: { fontSize: 6.375, fontWeight: 700, color: P.accent, letterSpacing: 1 },
    fechaChipFecha: { fontSize: 10.5, fontWeight: 700, color: P.textStrong },
    fechaChipHora: { fontSize: 8.625, fontWeight: 700, color: P.accent },
    headerRule: { height: 2.25, borderRadius: 1.5, backgroundColor: P.structure, marginTop: 5.25 },

    /* Título */
    // El aire recuperado del margen superior se reinvierte aquí: separa el
    // título de la banda del paciente, que antes iban pegados.
    tituloWrap: { marginTop: 6, marginBottom: 13.5 },
    eyebrow: { fontSize: 7.5, fontWeight: 700, color: P.accent, letterSpacing: 1.5 },
    tituloDoc: { fontSize: 18.75, fontWeight: 700, color: P.textStrong },

    /* Barra paciente */
    pacienteCard: {
      backgroundColor: P.bgSoft,
      borderWidth: 1,
      borderColor: N.hair,
      borderLeftWidth: 3,
      borderLeftColor: P.structure,
      borderRadius: 6,
      overflow: 'hidden',
    },
    pacienteBanda: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 4.5,
      paddingHorizontal: 9,
    },
    pacienteIzq: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
    pacienteNombre: { fontSize: 12.75, fontWeight: 700, color: P.textStrong },
    pacienteTag: { fontSize: 7.5, fontWeight: 700, color: P.accent, letterSpacing: 1, textTransform: 'uppercase', marginLeft: 6 },
    pacienteMeta: { fontSize: 9.5, fontWeight: 500, color: N.valueInk, textAlign: 'right' },
    pacienteUnidad: { fontWeight: 400, color: N.muted },
    pacienteSep: { color: N.hair },

    /* Barra vitales */
    vitalesCard: {
      marginTop: 4,
      borderWidth: 1,
      borderColor: N.hair,
      borderRadius: 6,
      overflow: 'hidden',
      flexDirection: 'row',
    },
    vitalesHead: { backgroundColor: P.structure, paddingHorizontal: 10.5, justifyContent: 'center', alignItems: 'center' },
    vitalesHeadA: { fontSize: 8.25, fontWeight: 700, color: P.vitalsTitle },
    vitalesHeadB: { fontSize: 6.375, fontWeight: 400, color: P.vitalsSub, letterSpacing: 0.6 },
    vitalTile: {
      flex: 1,
      paddingVertical: 3,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      borderLeftWidth: 1,
      borderLeftColor: N.faint,
    },
    vitalLabel: { fontSize: 6.375, fontWeight: 700, color: N.muted, textTransform: 'uppercase' },
    vitalValor: { fontSize: 11.25, fontWeight: 700, color: P.textStrong, marginTop: 1.5 },
    vitalUnidad: { fontSize: 6.75, fontWeight: 400, color: N.muted },

    /* Secciones */
    secciones: { marginTop: 3.75 },
    seccionRow: { flexDirection: 'row', gap: 12, paddingBottom: 3.5 },
    seccionRowBorde: { borderTopWidth: 1, borderTopColor: N.hair, paddingTop: 3.5 },
    etiquetaCol: { width: 58, flexDirection: 'row' },
    accentBar: { width: 2.25, borderRadius: 1.5, backgroundColor: P.accentSoft },
    etiquetaTexto: { flex: 1, paddingLeft: 6 },
    seccionNumero: { fontSize: 15, fontWeight: 700, color: P.accent },
    seccionTitulo: { fontSize: 8.25, fontWeight: 700, color: P.textStrong, letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 5.25 },
    seccionSubtitulo: { fontSize: 7.125, fontFamily: 'Roboto', fontStyle: 'italic', fontWeight: 400, color: N.muted, marginTop: 2.25 },
    cuerpoCol: { flex: 1 },

    /* Bloques de texto */
    parrafo: { fontSize: 9, lineHeight: 1.3, color: N.labelInk, textAlign: 'justify' },
    parrafoItem: { fontSize: 9, lineHeight: 1.3, color: N.labelInk, textAlign: 'justify', paddingLeft: 6 },
    bold: { fontWeight: 700, color: P.structure },

    /* Firma */
    // Empuja la firma al fondo del área de contenido cuando sobra espacio (nota
    // de 1 página). En overflow, el free space es 0 → colapsa a 0 y la firma
    // fluye tras el contenido en la última página (pagina sin romperse).
    firmaSpacer: { flexGrow: 1 },
    firmaWrap: { alignItems: 'flex-end', marginTop: 10 },
    firmaCaja: { width: 223.2, alignItems: 'center' },
    firmaEspacio: { height: 45.36, alignItems: 'center', justifyContent: 'flex-end' },
    firmaImg: { maxHeight: 45.36, maxWidth: 223.2, objectFit: 'contain' },
    firmaLinea: { width: '100%', borderTopWidth: 1.125, borderTopColor: P.structure, paddingTop: 4, alignItems: 'center' },
    firmaNombre: { fontSize: 9.75, fontWeight: 700, color: P.textStrong },
    firmaMeta: { fontSize: 7.875, fontWeight: 400, color: N.muted, lineHeight: 1.3, textAlign: 'center' },

    /* Addendums */
    addCard: {
      marginTop: 6,
      borderWidth: 1,
      borderColor: N.addBorder,
      borderLeftWidth: 3,
      borderLeftColor: N.addAccent,
      borderRadius: 6,
      backgroundColor: N.addBg,
      paddingVertical: 6,
      paddingHorizontal: 9,
    },
    addTitulo: { fontSize: 7.5, fontWeight: 700, color: N.addAccent, letterSpacing: 0.9 },
    addMeta: { fontSize: 7.125, fontWeight: 400, color: N.muted, marginTop: 1.5 },
    addCuerpo: { marginTop: 3 },
    addParrafo: { fontSize: 8.25, lineHeight: 1.35, color: N.labelInk, textAlign: 'justify' },
    addParrafoItem: { fontSize: 8.25, lineHeight: 1.35, color: N.labelInk, textAlign: 'justify', paddingLeft: 6 },

    /* Footer */
    footer: {
      position: 'absolute',
      bottom: 24,
      left: 36,
      right: 36,
      borderTopWidth: 1,
      borderTopColor: N.faint,
      paddingTop: 6.75,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    footerTexto: { fontSize: 7.125, fontWeight: 400, color: N.muted },
  })
}

type EstilosNota = ReturnType<typeof crearEstilos>

/* ------------------------------------------------------------------ */
/*  Metadatos de secciones                                             */
/* ------------------------------------------------------------------ */

const ORDEN_CANONICO: TipoSeccion[] = [
  'subjetivo', 'objetivo', 'auxiliares_dx', 'analisis', 'diagnostico', 'plan', 'pronostico',
]

const TITULO_SECCION: Record<TipoSeccion, string> = {
  subjetivo: 'SUBJETIVO',
  objetivo: 'OBJETIVO',
  auxiliares_dx: 'AUXILIARES DX',
  analisis: 'ANÁLISIS',
  diagnostico: 'DIAGNÓSTICO',
  plan: 'PLAN',
  pronostico: 'PRONÓSTICO',
  desconocida: 'NOTA',
}

const SUBTITULO_SECCION: Record<TipoSeccion, string> = {
  subjetivo: 'Motivo y síntomas',
  objetivo: 'Exploración física',
  auxiliares_dx: 'Estudios',
  analisis: 'Impresión dx',
  diagnostico: 'Diagnóstico',
  plan: 'Tratamiento',
  pronostico: 'Evolución esperada',
  desconocida: '',
}

/* ------------------------------------------------------------------ */
/*  Helpers de render                                                  */
/* ------------------------------------------------------------------ */

/** Un span vacío/de espacio termina en ":". Detecta sub-encabezados tipo "Farmacológico:". */
function terminaEnDosPuntos(bloque: BloqueNota): boolean {
  const ultimo = bloque.spans[bloque.spans.length - 1]
  return bloque.tipo === 'parrafo' && !!ultimo && ultimo.texto.trimEnd().endsWith(':')
}

/**
 * Presentación (no altera parseNota): un párrafo que termina en ":" seguido de
 * EXACTAMENTE UN item (antes del siguiente párrafo/fin) se fusiona en un solo
 * párrafo — spans del encabezado + espacio + spans del item, sin guion. Con 2+
 * items consecutivos se conserva la lista.
 */
function fusionarEncabezadoItem(bloques: BloqueNota[]): BloqueNota[] {
  const out: BloqueNota[] = []
  for (let i = 0; i < bloques.length; i++) {
    const actual = bloques[i]
    const sig = bloques[i + 1]
    const sigSig = bloques[i + 2]
    if (terminaEnDosPuntos(actual) && sig?.tipo === 'item' && sigSig?.tipo !== 'item') {
      const espacio: SpanTexto = { texto: ' ', bold: false }
      out.push({ tipo: 'parrafo', spans: [...actual.spans, espacio, ...sig.spans] })
      i++ // consume el item fusionado
      continue
    }
    out.push(actual)
  }
  return out
}

/** Renderiza los bloques (párrafos e ítems) de una nota, con spans en negrita. */
function renderBloques(
  bloquesRaw: BloqueNota[],
  parrafoStyle: Style,
  itemStyle: Style,
  boldStyle: Style,
  keyPrefix: string,
): ReactElement[] {
  const bloques = fusionarEncabezadoItem(bloquesRaw)
  return bloques.map((bloque, i) => {
    const esItem = bloque.tipo === 'item'
    const base = esItem ? itemStyle : parrafoStyle
    const spans = bloque.spans.map((sp, j) =>
      sp.bold
        ? <Text key={j} style={boldStyle}>{t(sp.texto)}</Text>
        : <Text key={j}>{t(sp.texto)}</Text>,
    )
    return (
      <Text
        key={`${keyPrefix}-${i}`}
        style={i > 0 ? [base, { marginTop: 1.5 }] : base}
      >
        {esItem ? <Text>{t('- ')}</Text> : null}
        {spans}
      </Text>
    )
  })
}

/** Ordena las secciones renderizables: conocidas en orden canónico, luego desconocidas. */
function ordenarSecciones(secciones: SeccionNota[]): SeccionNota[] {
  const conBloques = secciones.filter((sec) => sec.bloques.length > 0)
  const conocidas = ORDEN_CANONICO.flatMap((tipo) => conBloques.filter((sec) => sec.tipo === tipo))
  const desconocidas = conBloques.filter((sec) => sec.tipo === 'desconocida')
  return [...conocidas, ...desconocidas]
}

/** Título de una sección desconocida: usa su título original en mayúsculas o "NOTA". */
function tituloDe(sec: SeccionNota): string {
  if (sec.tipo !== 'desconocida') return TITULO_SECCION[sec.tipo]
  return sec.titulo.trim() ? sec.titulo.trim().toUpperCase() : 'NOTA'
}

/* ------------------------------------------------------------------ */
/*  Sub-componentes                                                    */
/* ------------------------------------------------------------------ */

function HeaderNota({ data, logoUrl, s }: { data: NotaRenderData; logoUrl?: string; s: EstilosNota }) {
  const iniciales = data.medico.nombre
    .split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  const cedProf = data.medico.cedulaProfesional
  const cedEsp = data.medico.cedulaEspecialidad
  return (
    <View style={s.header} fixed>
      <View style={s.headerRow}>
        <View style={s.chip}>
          {logoUrl
            ? <Image style={s.chipLogo} src={logoUrl} />
            : <Text style={s.chipIniciales}>{t(iniciales)}</Text>}
        </View>
        <View style={s.headerCol}>
          <Text style={s.medNombre}>{t(data.medico.nombre)}</Text>
          {data.medico.especialidad ? <Text style={s.medEsp}>{t(data.medico.especialidad)}</Text> : null}
          {(cedProf || cedEsp) ? (
            <Text style={s.medMeta}>
              {cedProf ? <><Text style={s.metaLabel}>{t('Céd. Prof. ')}</Text><Text style={s.metaValor}>{t(cedProf)}</Text></> : null}
              {cedProf && cedEsp ? <Text style={s.metaSep}>{t(' · ')}</Text> : null}
              {cedEsp ? <><Text style={s.metaLabel}>{t('Céd. Esp. ')}</Text><Text style={s.metaValor}>{t(cedEsp)}</Text></> : null}
            </Text>
          ) : null}
        </View>
        <View style={s.fechaChip}>
          <Text style={s.fechaChipEyebrow}>{t('CONSULTA')}</Text>
          <Text style={s.fechaChipFecha}>{t(data.fechaCorta)}</Text>
          <Text style={s.fechaChipHora}>{t(data.horaFormateada)}</Text>
        </View>
      </View>
      <View style={s.headerRule} />
    </View>
  )
}

function BarraPaciente({ paciente, s }: { paciente: NotaRenderData['paciente']; s: EstilosNota }) {
  const sexo = paciente.sexo === 'M' ? 'Masculino' : paciente.sexo === 'F' ? 'Femenino' : paciente.sexo === 'Otro' ? 'Otro' : '—'
  const edad = paciente.edad ? `${paciente.edad.anios} años` : '—'

  // Edad y sexo siempre presentes (fallback "—"); peso/talla se OMITEN si faltan.
  const partes: ReactElement[] = [
    <Text key="edad">{t(edad)}</Text>,
    <Text key="sexo">{t(sexo)}</Text>,
  ]
  if (paciente.pesoKg != null) {
    partes.push(<Text key="peso">{t(String(paciente.pesoKg))}<Text style={s.pacienteUnidad}>{t(' kg')}</Text></Text>)
  }
  if (paciente.tallaCm != null) {
    partes.push(<Text key="talla">{t(String(paciente.tallaCm))}<Text style={s.pacienteUnidad}>{t(' cm')}</Text></Text>)
  }
  const conSeparadores = partes.flatMap((p, i) =>
    i === 0 ? [p] : [<Text key={`sep-${i}`} style={s.pacienteSep}>{t(' · ')}</Text>, p],
  )

  return (
    <View style={s.pacienteCard}>
      <View style={s.pacienteBanda}>
        <View style={s.pacienteIzq}>
          <Text style={s.pacienteNombre}>{t(paciente.nombreCompleto)}</Text>
          {paciente.numeroExpediente ? <Text style={s.pacienteTag}>{t(paciente.numeroExpediente)}</Text> : null}
        </View>
        <Text style={s.pacienteMeta}>{conSeparadores}</Text>
      </View>
    </View>
  )
}

/** Arma los tiles de vitales capturados en orden TA/FC/FR/TEMP/SPO₂. */
function tilesVitales(sv: SignosVitales): Array<{ label: string; valor: string; unidad: string }> {
  const tiles: Array<{ label: string; valor: string; unidad: string }> = []
  if (sv.ta_sistolica != null || sv.ta_diastolica != null) {
    tiles.push({ label: 'TA', valor: `${sv.ta_sistolica ?? '—'}/${sv.ta_diastolica ?? '—'}`, unidad: 'mmHg' })
  }
  if (sv.fc != null) tiles.push({ label: 'FC', valor: String(sv.fc), unidad: 'lpm' })
  if (sv.fr != null) tiles.push({ label: 'FR', valor: String(sv.fr), unidad: 'rpm' })
  if (sv.temp != null) tiles.push({ label: 'TEMP', valor: String(sv.temp), unidad: '°C' })
  if (sv.spo2 != null) tiles.push({ label: 'SPO₂', valor: String(sv.spo2), unidad: '%' })
  return tiles
}

function BarraVitales({ sv, s }: { sv: SignosVitales; s: EstilosNota }) {
  const tiles = tilesVitales(sv)
  if (tiles.length === 0) return null
  return (
    <View style={s.vitalesCard}>
      <View style={s.vitalesHead}>
        <Text style={s.vitalesHeadA}>{t('Signos')}</Text>
        <Text style={s.vitalesHeadB}>{t('VITALES')}</Text>
      </View>
      {tiles.map((tile) => (
        <View key={tile.label} style={s.vitalTile}>
          <Text style={s.vitalLabel}>{t(tile.label)}</Text>
          <Text style={s.vitalValor}>{t(tile.valor)}</Text>
          <Text style={s.vitalUnidad}>{t(tile.unidad)}</Text>
        </View>
      ))}
    </View>
  )
}

function SeccionItem({ numero, seccion, primera, s }: { numero: string; seccion: SeccionNota; primera: boolean; s: EstilosNota }) {
  return (
    <View style={primera ? s.seccionRow : [s.seccionRow, s.seccionRowBorde]}>
      <View style={s.etiquetaCol} minPresenceAhead={38}>
        <View style={s.accentBar} />
        <View style={s.etiquetaTexto}>
          <Text style={s.seccionNumero}>{t(numero)}</Text>
          <Text style={s.seccionTitulo}>{t(tituloDe(seccion))}</Text>
          {SUBTITULO_SECCION[seccion.tipo] ? <Text style={s.seccionSubtitulo}>{t(SUBTITULO_SECCION[seccion.tipo])}</Text> : null}
        </View>
      </View>
      <View style={s.cuerpoCol}>
        {renderBloques(seccion.bloques, s.parrafo, s.parrafoItem, s.bold, `sec-${numero}`)}
      </View>
    </View>
  )
}

function FirmaNota({ medico, s }: { medico: NotaRenderData['medico']; s: EstilosNota }) {
  const ceds = [
    medico.cedulaProfesional ? `Cédula Prof. ${medico.cedulaProfesional}` : '',
    medico.cedulaEspecialidad ? `Cédula Esp. ${medico.cedulaEspecialidad}` : '',
  ].filter(Boolean).join(' · ')
  return (
    <View style={s.firmaWrap} wrap={false}>
      <View style={s.firmaCaja}>
        <View style={s.firmaEspacio}>
          {/* Signed URL (1h). Si expiró, se resuelve como ausente sin error en el Paquete Firma. */}
          {medico.firmaUrl ? <Image style={s.firmaImg} src={medico.firmaUrl} /> : null}
        </View>
        <View style={s.firmaLinea}>
          <Text style={s.firmaNombre}>{t(medico.nombre)}</Text>
          {medico.especialidad ? <Text style={s.firmaMeta}>{t(medico.especialidad)}</Text> : null}
          {ceds ? <Text style={s.firmaMeta}>{t(ceds)}</Text> : null}
        </View>
      </View>
    </View>
  )
}

function AddendumCard({ addendum, s }: { addendum: NotaRenderData['addendums'][number]; s: EstilosNota }) {
  return (
    <View style={s.addCard} wrap={false}>
      <Text style={s.addTitulo}>{t('NOTA ACLARATORIA (ADDENDUM)')}</Text>
      <Text style={s.addMeta}>{t(`${addendum.medicoNombre} · ${addendum.fechaFormateada}`)}</Text>
      <View style={s.addCuerpo}>
        {renderBloques(addendum.parseado.secciones.flatMap((sec) => sec.bloques), s.addParrafo, s.addParrafoItem, s.bold, 'add')}
      </View>
    </View>
  )
}

/* ------------------------------------------------------------------ */
/*  Página — reutilizable como sección de un Document mayor            */
/* ------------------------------------------------------------------ */

export interface PaginaNotaProps {
  data: NotaRenderData
  logoUrl?: string
  /**
   * Paleta ya derivada. Ausente → se deriva aquí de `data.medico.color*`.
   * El expediente completo la hoistea: todas sus notas son de la misma clínica
   * y `derivarPaletaNota` hace bucles de contraste WCAG que no vale repetir N
   * veces. (`crearEstilos` sí corre por página: `StyleSheet.create` es la
   * identidad en react-pdf, así que solo construye un objeto literal.)
   */
  paleta?: PaletaNota
  /**
   * Cómo pagina el pie:
   *  - 'suelta': nota impresa sola. Solo muestra "Pág. X de Y" si ella misma
   *    ocupa más de una página — el Document contiene únicamente esta nota.
   *  - 'expediente': nota dentro del expediente completo. SIEMPRE pagina, con
   *    la numeración continua del Document entero (`pageNumber`/`totalPages`
   *    son globales al documento en react-pdf, no relativos al Page).
   */
  contexto: 'suelta' | 'expediente'
}

export function PaginaNota({ data, logoUrl, paleta, contexto }: PaginaNotaProps) {
  // Sin color válido → fallback total a la paleta azul del mockup.
  const P = paleta ?? derivarPaletaNota(data.medico.colorPrimario, data.medico.colorSecundario)
  const s = crearEstilos(P)

  const secciones = ordenarSecciones(data.notaParseada.secciones)
  const pac = data.paciente.nombreCompleto
  const fecha = data.fechaFormateada

  return (
    <Page size="LETTER" style={s.page}>
      <HeaderNota data={data} logoUrl={logoUrl} s={s} />

      {/* Footer fixed */}
      <View style={s.footer} fixed>
        <Text style={s.footerTexto}>{t('Nota de Evolución Médica')}</Text>
        <Text
          style={s.footerTexto}
          render={({ pageNumber, totalPages }) =>
            t(contexto === 'expediente' || totalPages > 1
              ? `${pac} · ${fecha} · Pág. ${pageNumber} de ${totalPages}`
              : `${pac} · ${fecha}`)
          }
        />
      </View>

      {/* Título */}
      <View style={s.tituloWrap}>
        <Text style={s.eyebrow}>{t('EXPEDIENTE CLÍNICO')}</Text>
        <Text style={s.tituloDoc}>{t('Nota de Evolución Médica')}</Text>
      </View>

      <BarraPaciente paciente={data.paciente} s={s} />
      {data.signosVitales ? <BarraVitales sv={data.signosVitales} s={s} /> : null}

      {/* Secciones */}
      <View style={s.secciones}>
        {secciones.map((sec, i) => (
          <SeccionItem
            key={`${sec.tipo}-${i}`}
            numero={String(i + 1).padStart(2, '0')}
            seccion={sec}
            primera={i === 0}
            s={s}
          />
        ))}
      </View>

      {/* Sin addendums, un spacer flexible ancla la firma al fondo (1 página).
          Con addendums NO se ancla: la firma va tras las secciones y los
          addendums (correcciones firmadas) la siguen, conservando el orden. */}
      {data.addendums.length === 0 ? <View style={s.firmaSpacer} /> : null}

      <FirmaNota medico={data.medico} s={s} />

      {data.addendums.map((add, i) => (
        <AddendumCard key={`addendum-${i}`} addendum={add} s={s} />
      ))}
    </Page>
  )
}

/* ------------------------------------------------------------------ */
/*  Documento standalone — contrato intacto (flujos A y B′)            */
/* ------------------------------------------------------------------ */

export function renderNotaEvolucion(props: NotaEvolucionProps) {
  return <NotaEvolucionPdf {...props} />
}

export default function NotaEvolucionPdf({ data, logoUrl }: NotaEvolucionProps) {
  const paleta = derivarPaletaNota(data.medico.colorPrimario, data.medico.colorSecundario)
  return (
    <Document>
      <PaginaNota data={data} logoUrl={logoUrl} paleta={paleta} contexto="suelta" />
    </Document>
  )
}
