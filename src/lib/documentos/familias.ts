/**
 * familias.ts — a qué familia pertenece cada tipo de documento, y cómo se
 * titula, se folia y se firma.
 *
 * Módulo neutro, sin dependencias de cliente ni de servidor y sin marcado: es la
 * tabla que el visor consulta antes de decidir qué pintar.
 *
 * ⚠️ LAS FAMILIAS SON CINCO Y LOS TIPOS COMPONIBLES SON NUEVE. Esa es la
 * relación que sostiene el visor: no hay nueve casos sueltos, hay cinco formas
 * de leer un documento. Receta y suplementación se leen igual aunque sus
 * renglones no tengan los mismos campos; laboratorio e imagenología comparten
 * esqueleto y se separan solo en la forma del estudio. Si añades un formato,
 * lo primero es decidir a qué familia entra, no escribirle una vista propia.
 *
 * ⚠️ Y HAY DOS TIPOS QUE NO SON DE ESTA PANTALLA. «Resultado de laboratorio» y
 * «Estudio de imagen» son ARCHIVOS SUBIDOS y viven en «Mediciones y archivos»;
 * «Informe clínico» es un formato heredado que ya no se emite (queda una fila
 * en producción, de una prueba). Los tres salen del carril, pero el visor tiene
 * que sobrevivir a que alguien llegue a ellos por un enlace: por eso existe la
 * familia `sin-visor`, que no es un descuido sino el caso declarado.
 */

/** El valor de `documentos.tipo`, tal como lo admite `documentos_tipo_check`. */
export type TipoDocumentoBD =
  | 'receta' | 'solicitud_lab' | 'solicitud_imagen' | 'plan_suplementacion'
  | 'solicitud_internamiento' | 'escrito_medico' | 'consentimiento_informado'
  | 'denegacion_consentimiento' | 'nota_honorarios'
  | 'resultado_laboratorio' | 'estudio_imagen' | 'informe_clinico'

export type Familia =
  | 'solicitudes'   // A · laboratorio, imagenología
  | 'posologia'     // B · receta, suplementación
  | 'texto'         // C · escrito médico
  | 'formulario'    // D · internamiento, consentimiento, denegación
  | 'importes'      // E · honorarios / cotización
  | 'sin-visor'     // los tres que esta pestaña no compone

export interface MetaTipo {
  familia: Familia
  /** El título literal del documento impreso. */
  titulo: string
  /**
   * Prefijo de la serie, o `null` si el formato NO imprime folio.
   * ⚠️ `null` NO SIGNIFICA «todavía no tiene». Escrito médico e internamiento
   * no lo llevan POR DISEÑO —la fila sí tiene número, el papel no lo dice— y el
   * visor no debe dibujar ni rótulo, ni guion, ni «sin folio». Es lo normal en
   * esos dos formatos, no una carencia. Ver `DOCUMENTOS_RANURAS_MUERTAS.md` §2.
   */
  prefijoFolio: string | null
  /** Rótulo del bloque de firma del cierre. Es un rótulo, no un espacio. */
  rotuloFirma: string
  /** La clave del catálogo, que da el color `--sp-doc-*` y el rótulo del chip. */
  claveCatalogo: string | null
}

/**
 * ⚠️ `documentos.tipo` NO ES LA CLAVE DEL CATÁLOGO, Y SOLO COINCIDEN EN
 * «receta». La primera es lo que admite `documentos_tipo_check` en la base
 * —larga y con prefijo—; la segunda es lo que viaja en la url del selector
 * —corta— y lo que nombra la variable `--sp-doc-*`. Sin esta traducción los
 * chips salen en blanco. No «arregles» la divergencia renombrando una de las
 * dos: la clave está en urls que el médico tiene guardadas y el tipo está
 * escrito en cada fila de la base.
 *
 * Los tres sin clave de catálogo no tienen color propio porque no son formatos
 * que el selector ofrezca: caen al chip neutro.
 */
export const META_TIPO: Record<TipoDocumentoBD, MetaTipo> = {
  receta: {
    familia: 'posologia', titulo: 'Receta médica', prefijoFolio: 'RX',
    rotuloFirma: 'Firma del médico', claveCatalogo: 'receta',
  },
  solicitud_lab: {
    familia: 'solicitudes', titulo: 'Solicitud de laboratorio', prefijoFolio: 'LAB',
    rotuloFirma: 'Firma y sello del médico', claveCatalogo: 'lab',
  },
  solicitud_imagen: {
    familia: 'solicitudes', titulo: 'Solicitud de imagenología', prefijoFolio: 'IMG',
    rotuloFirma: 'Firma y sello del médico', claveCatalogo: 'imagen',
  },
  plan_suplementacion: {
    familia: 'posologia', titulo: 'Plan de suplementación', prefijoFolio: 'SUP',
    rotuloFirma: 'Firma del médico', claveCatalogo: 'suplementacion',
  },
  solicitud_internamiento: {
    familia: 'formulario', titulo: 'Solicitud de internamiento', prefijoFolio: null,
    rotuloFirma: 'Firma y sello del médico', claveCatalogo: 'internamiento',
  },
  escrito_medico: {
    familia: 'texto', titulo: 'Escrito médico', prefijoFolio: null,
    rotuloFirma: 'Firma y sello del médico', claveCatalogo: 'escrito',
  },
  consentimiento_informado: {
    familia: 'formulario', titulo: 'Carta de consentimiento informado', prefijoFolio: 'CI',
    rotuloFirma: 'Firma del médico', claveCatalogo: 'consentimiento',
  },
  denegacion_consentimiento: {
    familia: 'formulario', titulo: 'Denegación o revocación del consentimiento', prefijoFolio: 'DEN',
    rotuloFirma: 'Firma en representación del paciente', claveCatalogo: null,
  },
  /* El único formato con DOS títulos: el modo se lee de `contenido.tipo_doc`
     —`NOH` contra `COT`— y por eso `tituloDe()` lo resuelve, no esta tabla. */
  nota_honorarios: {
    familia: 'importes', titulo: 'Recibo de honorarios', prefijoFolio: 'NOH',
    rotuloFirma: 'Firma del médico', claveCatalogo: 'honorarios',
  },

  resultado_laboratorio: {
    familia: 'sin-visor', titulo: 'Resultado de laboratorio', prefijoFolio: null,
    rotuloFirma: '', claveCatalogo: null,
  },
  estudio_imagen: {
    familia: 'sin-visor', titulo: 'Estudio de imagen', prefijoFolio: null,
    rotuloFirma: '', claveCatalogo: null,
  },
  informe_clinico: {
    familia: 'sin-visor', titulo: 'Informe clínico', prefijoFolio: null,
    rotuloFirma: '', claveCatalogo: null,
  },
}

/** Los tipos que el carril lista, en el orden fijo del catálogo. */
export const TIPOS_DEL_CARRIL: readonly TipoDocumentoBD[] = [
  'receta', 'solicitud_lab', 'solicitud_imagen', 'plan_suplementacion',
  'solicitud_internamiento', 'escrito_medico', 'consentimiento_informado',
  'nota_honorarios',
] as const

/**
 * Un tipo que el visor no sabe componer.
 *
 * ⚠️ SE PREGUNTA POR LA FAMILIA Y NO POR UNA LISTA DE TIPOS. Si mañana entra un
 * décimo formato heredado, basta con darle familia `sin-visor` y todo lo demás
 * —carril, visor, acciones— lo trata bien sin tocarse.
 */
export function esSinVisor(tipo: string): boolean {
  return metaDe(tipo).familia === 'sin-visor'
}

/** Meta de un tipo, con respaldo para un valor que la base admita y esto no. */
export function metaDe(tipo: string): MetaTipo {
  return META_TIPO[tipo as TipoDocumentoBD] ?? {
    familia: 'sin-visor',
    titulo: 'Documento',
    prefijoFolio: null,
    rotuloFirma: '',
    claveCatalogo: null,
  }
}

/**
 * El título literal, resolviendo el doble título de la familia de importes.
 * `tipo_doc` es el discriminante del formulario: cualquier valor que no sea
 * `cotizacion` es un recibo, que es lo que hace el trigger de la base al elegir
 * la serie.
 */
export function tituloDe(tipo: string, contenido: Record<string, unknown> | null | undefined): string {
  const meta = metaDe(tipo)
  if (tipo === 'nota_honorarios' && contenido?.tipo_doc === 'cotizacion') return 'Cotización'
  return meta.titulo
}

/** El prefijo de la serie, con la cotización tomando el suyo propio. */
export function prefijoFolioDe(tipo: string, contenido: Record<string, unknown> | null | undefined): string | null {
  if (tipo === 'nota_honorarios' && contenido?.tipo_doc === 'cotizacion') return 'COT'
  return metaDe(tipo).prefijoFolio
}

/**
 * El folio tal como se enseña: `Folio RX-2026-0042`, o `null` cuando el formato
 * no lo imprime o el documento no lo tiene todavía (un borrador no consume
 * serie). Quien recibe `null` no dibuja nada.
 */
export function folioVisible(
  tipo: string,
  contenido: Record<string, unknown> | null | undefined,
  folioColumna: string | null | undefined,
): string | null {
  if (prefijoFolioDe(tipo, contenido) === null) return null
  /* `contenido.folio` primero: es el que el papel llevaba impreso. Las recetas
     anteriores a agosto de 2026 guardaron ahí un `R-a3f9…` que su papel dice y
     la columna no. Invertir el orden enseñaría un número que el documento
     entregado no lleva. Mismo criterio que la regeneración. */
  const enContenido = typeof contenido?.folio === 'string' ? contenido.folio.trim() : ''
  const folio = enContenido || (folioColumna ?? '').trim()
  return folio ? `Folio ${folio}` : null
}
