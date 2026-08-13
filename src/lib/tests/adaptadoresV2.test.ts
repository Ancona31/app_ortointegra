/**
 * Los nueve adaptadores de v2 — **la prueba del cable**, no la del papel.
 *
 * Lo que miden `recetaMedica.test.ts` y sus hermanas es la GEOMETRÍA: que el
 * formato componga la lámina. Lo que se mide aquí es lo otro, y hasta el cableado
 * no existía: que lo que la fila guarda llegue a la ranura que le toca.
 *
 * ══ LA PRUEBA CENTRAL ES `emitir === regenerar` ═════════════════════════════
 *
 * Un documento se reimprime meses después desde `contenido`, y al emitirlo el
 * formulario pasa un objeto parecido pero no igual. Si los dos no producen las
 * MISMAS props, el papel recuperado no es el papel entregado —y el fallo no se ve
 * el día que se introduce, sino el día que alguien reclama—. Por eso cinco de los
 * nueve se comparan campo a campo entre sus dos entradas.
 *
 * Los otros cuatro no admiten esa comparación y se dice por qué en cada uno.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React, { type ReactElement } from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { PdfConsultorioData, PdfMedicoData } from '@/lib/pdf/PdfStyles'
import SolicitudLaboratorio from '@/lib/pdf/v2/formatos/SolicitudLaboratorio'
import SolicitudImagenologia from '@/lib/pdf/v2/formatos/SolicitudImagenologia'
import RecetaMedica from '@/lib/pdf/v2/formatos/RecetaMedica'
import PlanSuplementacion from '@/lib/pdf/v2/formatos/PlanSuplementacion'
import ReciboHonorarios from '@/lib/pdf/v2/formatos/ReciboHonorarios'
import SolicitudInternamiento from '@/lib/pdf/v2/formatos/SolicitudInternamiento'
import EscritoMedico from '@/lib/pdf/v2/formatos/EscritoMedico'
import ConsentimientoInformado from '@/lib/pdf/v2/formatos/ConsentimientoInformado'
import DenegacionConsentimiento from '@/lib/pdf/v2/formatos/DenegacionConsentimiento'
import { fechaCorta, fechaLarga, membrete, panel } from '@/lib/pdf/v2/adaptadores/comun'
import { propsSolicitudLaboratorio } from '@/lib/pdf/v2/adaptadores/SolicitudLaboratorio'
import { propsSolicitudImagenologia } from '@/lib/pdf/v2/adaptadores/SolicitudImagenologia'
import { propsRecetaMedica } from '@/lib/pdf/v2/adaptadores/RecetaMedica'
import { propsPlanSuplementacion } from '@/lib/pdf/v2/adaptadores/PlanSuplementacion'
import { propsReciboHonorarios } from '@/lib/pdf/v2/adaptadores/ReciboHonorarios'
import { propsSolicitudInternamiento } from '@/lib/pdf/v2/adaptadores/SolicitudInternamiento'
import { propsEscritoMedico } from '@/lib/pdf/v2/adaptadores/EscritoMedico'
import { propsConsentimientoInformado } from '@/lib/pdf/v2/adaptadores/ConsentimientoInformado'
import { propsDenegacionConsentimiento } from '@/lib/pdf/v2/adaptadores/DenegacionConsentimiento'
import { FORMATO_VERSION_POR_DEFECTO, VERSION_DE_EMISION, puedeComponer, versionQueEmite } from '@/lib/mobileShare'

const MEDICO: PdfMedicoData = {
  nombre: 'Dr. Ángel Ancona',
  especialidad: 'Ortopedia y Traumatología',
  cedula_profesional: '9552456',
  cedula_especialidad: '12085805',
  universidad: 'Universidad Autónoma de Yucatán',
  color_primario: '#1a3a5c',
  firma_url: 'data:image/png;base64,RUBRICA',
}

const CONSULTORIO: PdfConsultorioData = {
  nombre: 'Consultorio del Centro',
  direccion: 'Calle 60 #123, Mérida',
  telefono: '999 222 3173',
}

/** La entrada de un adaptador, con el médico y el consultorio ya puestos. */
function entrada(data: Record<string, unknown>) {
  return { medico: MEDICO, data, logoUrl: undefined, consultorio: CONSULTORIO }
}

const ruta = (archivo: string): string => path.resolve(process.cwd(), 'public/fonts', archivo)

/**
 * Las mismas familias que `registrarFuentesV2()`, por ruta de disco.
 *
 * No se llama a `registrarFuentesV2()` —ni por tanto a `envolver()`— a propósito:
 * v2 carga sus TTF por URL desde `/fonts/`, que en Node se resuelve como ruta
 * absoluta del sistema de archivos y no existe. Es la misma duplicación que ya
 * tienen las pruebas de geometría de cada formato, y por el mismo motivo.
 */
function registrarFuentesDeDisco(): void {
  Font.registerHyphenationCallback((palabra: string) => [palabra])
  Font.register({
    family: 'Archivo',
    fonts: [
      { src: ruta('Archivo-Regular.ttf'), fontWeight: 400 },
      { src: ruta('Archivo-Medium.ttf'), fontWeight: 500 },
      { src: ruta('Archivo-SemiBold.ttf'), fontWeight: 600 },
    ],
  })
  Font.register({
    family: 'IBM Plex Sans',
    fonts: [
      { src: ruta('IBMPlexSans-Regular.ttf'), fontWeight: 400 },
      { src: ruta('IBMPlexSans-Medium.ttf'), fontWeight: 500 },
    ],
  })
}

/**
 * Las dos formas en que la MISMA fila llega al adaptador.
 *
 * `emitir` reproduce lo que el formulario pasa a `generarPdf`: el contenido más la
 * fecha ya redactada y el folio, que es columna. `regenerar` reproduce lo que hay
 * meses después: el contenido crudo, con la fecha en ISO, más el folio que el
 * botón lee de la fila.
 */
function dosEntradas(contenido: Record<string, unknown>, folio: string) {
  const fecha = typeof contenido.fecha === 'string' ? contenido.fecha : ''
  return {
    emitir: entrada({ ...contenido, fecha: fechaLarga(fecha), folio }),
    regenerar: entrada({ ...contenido, folio }),
  }
}

// ─── La fecha, que es de donde salen las dos formas ──────────────────────────

describe('comun · la fecha se normaliza venga como venga', () => {
  it('compone la forma larga desde ISO y desde sí misma', () => {
    expect(fechaLarga('2026-08-13')).toBe('13 de agosto de 2026')
    expect(fechaLarga('13 de agosto de 2026')).toBe('13 de agosto de 2026')
  })

  it('compone la forma corta desde las dos, que es lo que iguala emitir y regenerar', () => {
    expect(fechaCorta('2026-08-13')).toBe('13 ago 2026')
    expect(fechaCorta('13 de agosto de 2026')).toBe('13 ago 2026')
  })

  it('no inventa fechas: lo que no reconoce sale tal cual, y lo vacío colapsa', () => {
    expect(fechaLarga('a principios de agosto')).toBe('a principios de agosto')
    expect(fechaCorta('')).toBeUndefined()
    expect(fechaLarga(undefined)).toBeUndefined()
    // Mes fuera de rango: no es una fecha, así que no se compone como tal.
    expect(fechaLarga('2026-13-01')).toBe('2026-13-01')
  })
})

describe('comun · membrete y panel', () => {
  it('redacta una línea por cédula y ninguna por la que falta', () => {
    expect(membrete(MEDICO).cedulas).toEqual(['Céd. Prof. 9552456', 'Céd. Esp. 12085805'])
    expect(membrete({ ...MEDICO, cedula_especialidad: '' }).cedulas)
      .toEqual(['Céd. Prof. 9552456'])
  })

  it('sin logo cae al monograma, y sin nombre oculta el panel', () => {
    const acento = { base: '#000', valido: true, tinta: '#000', banda: '#000', velo: '#fff' }
    // `Dr.` no es un nombre: el monograma es del médico, no de su tratamiento.
    expect(panel(MEDICO, undefined, acento)).toMatchObject({ variante: 'monograma', iniciales: 'ÁA' })
    expect(panel({ ...MEDICO, nombres: 'Ángel', apellido_paterno: 'Ancona' }, undefined, acento))
      .toMatchObject({ iniciales: 'ÁA' })
    expect(panel(MEDICO, 'data:image/png;base64,LOGO', acento)).toMatchObject({ variante: 'logo' })
    expect(panel({ ...MEDICO, nombre: '' }, undefined, acento)).toEqual({ variante: 'oculto' })
  })
})

// ─── Los nueve ───────────────────────────────────────────────────────────────

describe('II.1 · Solicitud de Laboratorio', () => {
  const contenido = {
    paciente: 'María Fernanda Ruiz Ortega',
    diagnostico: 'Gonartrosis bilateral',
    estudios: ['Biometría hemática', 'Química sanguínea'],
    notas: '',
    fecha: '2026-08-13',
  }

  it('convierte las cadenas sueltas en entradas de una sola ranura', () => {
    const p = propsSolicitudLaboratorio(entrada({ ...contenido, folio: 'LAB-2026-0148' }))
    expect(p.estudios).toEqual([{ nombre: 'Biometría hemática' }, { nombre: 'Química sanguínea' }])
    expect(p.paciente.fecha).toBe('13 de agosto de 2026')
    // Las notas vacías colapsan: `''` compondría el bloque con nada dentro.
    expect(p.notas).toBeUndefined()
    expect(p.rubrica).toBe('data:image/png;base64,RUBRICA')
  })

  it('emitir y regenerar componen lo mismo', () => {
    const { emitir, regenerar } = dosEntradas(contenido, 'LAB-2026-0148')
    expect(propsSolicitudLaboratorio(emitir)).toEqual(propsSolicitudLaboratorio(regenerar))
  })
})

describe('II.2 · Solicitud de Imagenología', () => {
  const contenido = {
    paciente: 'Jorge Alberto Medina',
    diagnostico: 'Dolor lumbar',
    estudios: [
      { tipo: 'Radiografía', region: 'Columna lumbar', proyecciones: 'AP y lateral', indicacion: '' },
      { tipo: 'Resonancia', region: 'Rodilla derecha' },
    ],
    urgente: true,
    fecha: '2026-08-13',
  }

  it('pasa las cuatro ranuras de cada estudio y marca el documento como urgente', () => {
    const p = propsSolicitudImagenologia(entrada({ ...contenido, folio: 'IMG-2026-0007' }))
    expect(p.estudios[0]).toEqual({
      tipo: 'Radiografía', region: 'Columna lumbar',
      proyecciones: 'AP y lateral', indicacion: undefined,
    })
    expect(p.urgente).toBe(true)
    // La fecha sube al riel del título, no al de paciente.
    expect(p.emision).toBe('13 ago 2026')
    expect(p.paciente.fecha).toBeUndefined()
  })

  it('emitir y regenerar componen lo mismo', () => {
    const { emitir, regenerar } = dosEntradas(contenido, 'IMG-2026-0007')
    expect(propsSolicitudImagenologia(emitir)).toEqual(propsSolicitudImagenologia(regenerar))
  })
})

describe('II.3 · Receta Médica', () => {
  /*
   * SIN COMPARACIÓN emitir/regenerar, y por un motivo del documento: `edad`,
   * `sexo` y el QR no se persisten. Al regenerar, las dos celdas colapsan y el
   * papel sale sin código, que es lo que hace hoy v1 por ese mismo camino.
   */
  const contenido = {
    folio: 'R-a3f9b2c1d4e5',
    paciente: 'María Fernanda Ruiz Ortega',
    diagnostico: 'Lumbalgia mecánica',
    medicamentos: [{
      nombre_comercial: 'Keral',
      presentacion: 'Tabletas 25 mg, caja con 10',
      principio_activo: 'Dexketoprofeno',
      via_administracion: 'Oral',
      indicacion: 'Una tableta cada 8 horas por 5 días',
      dosis: '',
    }],
    recomendaciones: 'Tomar con alimentos.',
    fecha: '2026-08-13',
  }

  it('lee el folio propio de la receta y el QR que solo existe al emitir', () => {
    const p = propsRecetaMedica(entrada({
      ...contenido, edad: '54 años', sexo: 'Femenino', qrDataUrl: 'data:image/png;base64,QR',
    }))
    expect(p.folio).toBe('R-a3f9b2c1d4e5')
    expect(p.qr).toBe('data:image/png;base64,QR')
    expect(p.paciente.edad).toBe('54 años')
    expect(p.medicamentos[0].principio_activo).toBe('Dexketoprofeno')
    expect(p.emision).toBe('13 ago 2026')
  })

  it('al regenerar colapsan las dos celdas y el QR, sin romper la entrada', () => {
    const p = propsRecetaMedica(entrada(contenido))
    expect(p.qr).toBeUndefined()
    expect(p.paciente.edad).toBeUndefined()
    expect(p.paciente.sexo).toBeUndefined()
    expect(p.medicamentos).toHaveLength(1)
  })
})

describe('II.4 · Plan de Suplementación', () => {
  const contenido = {
    paciente: 'María Fernanda Ruiz Ortega',
    diagnostico: 'Osteopenia',
    pesoKg: '72.5',
    seleccionados: [{ nombre: 'Vitamina D3', dosis: '4000 UI al día', marca: '', justificacion: 'Deficiencia documentada' }],
    notas: 'Tomar con la comida principal.',
    seguimiento: 'Control en 3 meses con nueva medición',
    fecha: '2026-08-13',
  }

  it('compone el peso con su unidad y lee lo que la fila guarda', () => {
    const p = propsPlanSuplementacion(entrada({ ...contenido, folio: 'SUP-2026-0031' }))
    expect(p.paciente.peso).toBe('72.5 kg')
    expect(p.seleccionados).toEqual([{
      nombre: 'Vitamina D3', dosis: '4000 UI al día',
      marca: undefined, justificacion: 'Deficiencia documentada',
    }])
    expect(p.seguimiento).toBe('Control en 3 meses con nueva medición')
  })

  it('sin peso no hay celda: la dosis se imprime igual', () => {
    const p = propsPlanSuplementacion(entrada({ ...contenido, pesoKg: '', folio: 'SUP-2026-0031' }))
    expect(p.paciente.peso).toBeUndefined()
    expect(p.seleccionados).toHaveLength(1)
  })

  it('emitir y regenerar componen lo mismo', () => {
    const { emitir, regenerar } = dosEntradas(contenido, 'SUP-2026-0031')
    expect(propsPlanSuplementacion(emitir)).toEqual(propsPlanSuplementacion(regenerar))
  })
})

describe('II.5 · Recibo de Honorarios / Cotización', () => {
  const cotizacion = {
    paciente: 'Renata Bustamante',
    fecha: '2026-08-13',
    tipo_doc: 'cotizacion',
    lineas: [
      { concepto: 'Honorarios del cirujano', origen: 'Honorarios médicos', precio: 45000 },
      { concepto: 'Implantes', origen: 'Material e implantes', precio: 65000 },
    ],
    monto: 110000,
    divisa: 'MXN',
    notas: '',
    vigencia_dias: 30,
    vigencia_hasta: '2026-09-12',
    subtotales: [{ origen: 'Honorarios médicos', total: 45000 }],
    aseguradora: { nombre: 'Grupo Nacional Provincial', poliza: 'GNP-4471', cobertura: '' },
  }

  const recibo = {
    paciente: 'Renata Bustamante',
    fecha: '2026-08-13',
    tipo_doc: 'honorarios',
    lineas: [{ concepto: 'Consulta de valoración', precio: 1800 }],
    monto: 1800,
    divisa: 'MXN',
    notas: 'Gracias por su preferencia.',
    forma_pago: 'Transferencia electrónica',
    anticipo: 600,
    saldo: 1200,
  }

  it('la cotización compone importes, subtotales, aseguradora y vigencia', () => {
    const p = propsReciboHonorarios(entrada({ ...cotizacion, folio: 'COT-2026-0012' }))
    expect(p.tipo_doc).toBe('cotizacion')
    expect(p.monto).toBe('$110,000.00')
    expect(p.lineas[0].precio).toBe('$45,000.00')
    // Medido: la celda es de 3 columnas y el plazo + la fecha larga componen
    // tres renglones donde la lámina tiene uno. Ver `vigenciaDe`.
    expect(p.paciente.vigencia).toBe('Hasta el 12 sep 2026')
    if (p.tipo_doc !== 'cotizacion') throw new Error('rama equivocada')
    expect(p.subtotales).toEqual([{ origen: 'Honorarios médicos', total: '$45,000.00' }])
    expect(p.aseguradora).toEqual({
      nombre: 'Grupo Nacional Provincial', poliza: 'GNP-4471', cobertura: undefined,
    })
  })

  it('el recibo lleva el anticipo con su signo, y nunca vigencia', () => {
    const p = propsReciboHonorarios(entrada({ ...recibo, folio: 'NOH-2026-0044' }))
    expect(p.tipo_doc).toBe('honorarios')
    expect(p.paciente.vigencia).toBeUndefined()
    if (p.tipo_doc !== 'honorarios') throw new Error('rama equivocada')
    expect(p.anticipo).toBe('−$600.00')
    expect(p.saldo).toBe('$1,200.00')
    expect(p.forma_pago).toBe('Transferencia electrónica')
  })

  it('sin anticipo no hay bloque, y el saldo no cuelga de nada', () => {
    const p = propsReciboHonorarios(entrada({ ...recibo, anticipo: 0, saldo: 1800 }))
    if (p.tipo_doc !== 'honorarios') throw new Error('rama equivocada')
    expect(p.anticipo).toBeUndefined()
    expect(p.saldo).toBeUndefined()
  })

  it('emitir y regenerar componen lo mismo, en las dos ramas', () => {
    const c = dosEntradas(cotizacion, 'COT-2026-0012')
    expect(propsReciboHonorarios(c.emitir)).toEqual(propsReciboHonorarios(c.regenerar))
    const r = dosEntradas(recibo, 'NOH-2026-0044')
    expect(propsReciboHonorarios(r.emitir)).toEqual(propsReciboHonorarios(r.regenerar))
  })
})

describe('II.6 · Solicitud de Internamiento', () => {
  const contenido = {
    paciente: 'Renata Bustamante',
    fecha: '2026-08-13',
    fechaIngreso: '2026-08-20',
    lugar: 'Hospital Ficticio del Centro',
    diagnostico: 'Gonartrosis grado IV',
    diagnosticosSecundarios: ['Hipertensión arterial', ''],
    tipoInternamiento: 'Cirugía electiva',
    procedimiento: 'Artroplastia total de rodilla',
    diasEstimados: '3-5 días',
    asa: 'ASA II',
    urgente: false,
    requerimientos: ['Cama de hospitalización', 'Banco de sangre'],
    requerimientosExtra: 'Fisioterapia el primer día',
    justificacion: 'Dolor incapacitante',
    instruccionesPaciente: 'Ayuno de 8 horas',
    indicacionesPiso: 'Dieta blanda',
  }

  it('quita el prefijo del ASA y manda el hospital a su celda', () => {
    const p = propsSolicitudInternamiento(entrada(contenido))
    expect(p.paciente.asa).toBe('II')
    expect(p.paciente.hospital).toBe('Hospital Ficticio del Centro')
    expect(p.paciente.fechaIngreso).toBe('20 de agosto de 2026')
    // Los días van tal cual: añadir la unidad daría «3-5 días días».
    expect(p.paciente.diasEstimados).toBe('3-5 días')
    expect(p.diagnosticosSecundarios).toEqual(['Hipertensión arterial'])
    expect(p.requerimientosExtra).toBe('Fisioterapia el primer día')
  })

  it('emitir y regenerar componen lo mismo', () => {
    const { emitir, regenerar } = dosEntradas(contenido, '')
    expect(propsSolicitudInternamiento(emitir)).toEqual(propsSolicitudInternamiento(regenerar))
  })
})

describe('II.8 · Escrito Médico', () => {
  const doc = {
    schema: 'tiptap-doc-v1',
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A quien corresponda.' }] }],
    },
  }

  it('traduce el cuerpo del editor y compone el título variable', () => {
    const p = propsEscritoMedico(entrada({
      paciente: 'Jorge Medina', fecha: '2026-08-13',
      asunto: 'Constancia médica', tituloPie: 'Constancia', doc, cuerpo: '<p>A quien corresponda.</p>',
    }))
    expect(p.asunto).toBe('Constancia médica')
    expect(p.fecha).toBe('13 de agosto de 2026')
    expect(p.cuerpo).toHaveLength(1)
    expect(p.cuerpo[0]).toMatchObject({ tipo: 'parrafo' })
  })

  it('sin título el asunto colapsa, y sin `doc` cae al HTML de los escritos viejos', () => {
    const p = propsEscritoMedico(entrada({
      paciente: 'Jorge Medina', fecha: '2026-08-13', asunto: '',
      cuerpo: '<p>Escrito anterior al editor.</p>',
    }))
    expect(p.asunto).toBeUndefined()
    expect(p.cuerpo).toHaveLength(1)
  })
})

describe('II.7 · Consentimiento Informado', () => {
  const contenido = {
    paciente: 'Renata Bustamante',
    lugar: 'Mérida, Yucatán',
    fecha: '2026-08-13',
    edad: '25 años',
    procedimiento: 'Artrodesis lumbar L4-L5',
    diagnostico: 'Espondilolistesis degenerativa',
    familiar: 'María Bustamante',
    testigo1: 'Luis Pérez',
    testigo2: '',
    autorizaTransfusion: 'si',
    autorizaFotos: true,
    pacienteNoPuedeFirmar: false,
    secciones: {
      preoperatorio: 'Se valoró en consulta.',
      beneficios: 'Alivio del dolor.',
      anestesia: '', descripcion: '', riesgosComunes: '',
      riesgosEspecificos: '', alternativas: '',
    },
  }

  it('sin sellar, las celdas quedan para la pluma y no hay bloque de cierre', () => {
    const p = propsConsentimientoInformado(entrada({ ...contenido, folio: 'CI-2026-0091' }))
    expect(p.sellado).toBeUndefined()
    expect(p.firmantes.paciente).toEqual({ nombre: 'Renata Bustamante', rubrica: undefined, sello: undefined })
    // Quien no tiene nombre no tiene celda: lo decide el formato con esto.
    expect(p.firmantes.testigo2.nombre).toBeUndefined()
    /*
      ⚠ **NI SIQUIERA LA DEL MÉDICO.** Este papel se imprime para que lo firmen: sacarlo con
      su rúbrica ya estampada lo dejaría firmado antes de que el paciente consintiera nada.
      La celda queda para la pluma, como las otras cuatro.
    */
    expect(p.firmantes.medico.rubrica).toBeUndefined()
    expect(p.autorizaTransfusion).toBe('si')
    expect(p.autorizaFotos).toBe(true)
    expect(p.secciones.anestesia).toBeUndefined()
  })

  it('sellado, cada firma va a su firmante con su hora', () => {
    const p = propsConsentimientoInformado(entrada({
      ...contenido,
      folio: 'CI-2026-0091',
      firmas: [
        { rol: 'paciente', trazo: 'data:image/png;base64,TRAZO', firmadoEn: '2026-08-13T18:41:52.000Z' },
        { rol: 'medico', trazo: null, firmadoEn: '2026-08-13T18:47:19.000Z' },
      ],
      selladoEn: '2026-08-13T18:47:19.000Z',
      huella: '3f9a8c41',
      identificaciones: [{ rol: 'Paciente', nombre: 'Renata Bustamante', foto: 'data:image/jpeg;base64,FOTO' }],
    }))
    expect(p.firmantes.paciente.rubrica).toBe('data:image/png;base64,TRAZO')
    // Y sellado SÍ va la del médico: ahí el acto ya ocurrió.
    expect(p.firmantes.medico.rubrica).toBe('data:image/png;base64,RUBRICA')
    expect(p.firmantes.paciente.sello).toMatch(/^13\/08\/2026 \d{2}:\d{2}:\d{2}$/)
    expect(p.sellado?.huella).toBe('3f9a8c41')
    expect(p.identificaciones?.[0]).toEqual({
      rol: 'Paciente', nombre: 'Renata Bustamante',
      tipo: undefined, numero: undefined, foto: 'data:image/jpeg;base64,FOTO',
    })
  })

  it('el sellado exige fecha Y huella: una sin la otra no acredita nada', () => {
    const p = propsConsentimientoInformado(entrada({
      ...contenido, folio: 'CI-2026-0091', selladoEn: '2026-08-13T18:47:19.000Z',
    }))
    expect(p.sellado).toBeUndefined()
  })
})

describe('II.9 · Denegación de Consentimiento', () => {
  const contenido = {
    paciente: 'Renata Bustamante',
    lugar: 'Mérida, Yucatán',
    fecha: '2026-08-13',
    edad: '25 años',
    procedimiento: 'Artrodesis lumbar L4-L5',
    diagnostico: 'Espondilolistesis degenerativa',
    familiar: 'María Bustamante',
    pacienteNoPuedeFirmar: true,
  }

  it('`pacienteNoPuedeFirmar` enciende la sustitución, que sin él era inalcanzable', () => {
    const p = propsDenegacionConsentimiento(entrada({ ...contenido, folio: 'DEN-2026-0003' }))
    expect(p.sustitucion).toBe(true)
    expect(p.firmantes.familiar.nombre).toBe('María Bustamante')
    // Las tres celdas para la pluma, la del médico incluida: una denegación se
    // firma a mano y no se sella nunca.
    expect(p.firmantes.medico.rubrica).toBeUndefined()
    expect(p.paciente.diagnostico).toBe('Espondilolistesis degenerativa')
  })

  it('emitir y regenerar componen lo mismo', () => {
    const { emitir, regenerar } = dosEntradas(contenido, 'DEN-2026-0003')
    expect(propsDenegacionConsentimiento(emitir)).toEqual(propsDenegacionConsentimiento(regenerar))
  })
})

/**
 * LA ÚNICA MEDICIÓN DE ESTE ARCHIVO, y está aquí porque defiende una decisión del
 * cable y no del formato: **qué cabe en la celda de vigencia**.
 *
 * La celda es de 3 columnas —114.75 pt— y el formato pedía componer ahí
 * `30 días · hasta el 12 de septiembre de 2026`. No cabe. Se cuenta contando
 * operaciones de posicionamiento de texto en el flujo del PDF: un valor que rompe
 * a dos renglones añade una, y un riel que crece con lo que trae es la violación
 * de I.3.4 que el sistema persigue en todas partes.
 *
 * Reproducción: cambiar `vigenciaDe` para que devuelva la cadena larga y ver
 * fallar esta prueba con 2 operaciones de más —la larga compone TRES renglones—.
 */
describe('II.5 · la vigencia compuesta cabe en un renglón', () => {
  const COTIZACION = {
    paciente: 'Renata Bustamante Oceguera',
    fecha: '2026-08-13',
    tipo_doc: 'cotizacion',
    lineas: [{ concepto: 'Honorarios del cirujano', origen: 'Honorarios médicos', precio: 45000 }],
    monto: 45000,
    divisa: 'MXN',
    folio: 'COT-2026-0012',
    vigencia_dias: 30,
    vigencia_hasta: '2026-09-12',
  }

  /** Cuántas veces se coloca texto en la hoja. Un renglón de más suma una. */
  async function operacionesDeTexto(vigencia?: string): Promise<number> {
    const base = propsReciboHonorarios(entrada(COTIZACION))
    const props = vigencia === undefined
      ? base
      : { ...base, paciente: { ...base.paciente, vigencia } }
    const buffer = await renderToBuffer(
      React.createElement(Document, null, React.createElement(ReciboHonorarios, props)),
    )
    const crudo = buffer.toString('latin1')
    const flujo = /stream\r?\n([\s\S]*?)\r?\nendstream/g
    let total = 0
    let m: RegExpExecArray | null
    while ((m = flujo.exec(crudo)) !== null) {
      let texto: string
      try {
        texto = zlib.inflateSync(Buffer.from(m[1], 'latin1')).toString('latin1')
      } catch { continue }
      total += (texto.match(/ Tm\b/g) ?? []).length
    }
    return total
  }

  it('la cadena que compone el adaptador ocupa lo mismo que una de una palabra', async () => {
    registrarFuentesDeDisco()
    const compuesta = await operacionesDeTexto()
    const deUnaPalabra = await operacionesDeTexto('30 días')
    expect(compuesta).toBe(deUnaPalabra)
  }, 60_000)

  it('la que pedía el formato compone dos renglones más, y por eso se descartó', async () => {
    registrarFuentesDeDisco()
    const compuesta = await operacionesDeTexto()
    const larga = await operacionesDeTexto('30 días · hasta el 12 de septiembre de 2026')
    expect(larga).toBe(compuesta + 2)
  }, 60_000)
})

/**
 * LOS NUEVE, COMPUESTOS DE VERDAD, con lo MÍNIMO que el formulario deja emitir.
 *
 * Las pruebas de arriba miden el mapeo y no llegan a tocar el renderer: un formato
 * que reventara con una lista vacía o con media docena de ranuras colapsadas
 * pasaría todas. Esta los compone y comprueba que sale un PDF.
 *
 * El caso mínimo es el que hay que probar y no el completo: los huecos son lo que
 * rompe. Un documento con todo lleno no ejercita un solo colapso.
 */
describe('los nueve componen un PDF con el caso mínimo', () => {
  const MINIMOS: ReadonlyArray<readonly [string, () => ReactElement]> = [
    ['solicitud_lab', () => React.createElement(SolicitudLaboratorio, propsSolicitudLaboratorio(
      entrada({ paciente: 'Jorge Medina', estudios: ['Biometría hemática'], fecha: '2026-08-13', folio: 'LAB-2026-0001' }),
    ))],
    ['solicitud_imagen', () => React.createElement(SolicitudImagenologia, propsSolicitudImagenologia(
      entrada({ paciente: 'Jorge Medina', estudios: [{ tipo: 'Radiografía', region: 'Rodilla' }], fecha: '2026-08-13', folio: 'IMG-2026-0001' }),
    ))],
    ['receta', () => React.createElement(RecetaMedica, propsRecetaMedica(
      entrada({ paciente: 'Jorge Medina', fecha: '2026-08-13', folio: 'R-a3f9', medicamentos: [{ nombre_comercial: 'Keral', principio_activo: 'Dexketoprofeno', indicacion: 'Cada 8 horas' }] }),
    ))],
    ['plan_suplementacion', () => React.createElement(PlanSuplementacion, propsPlanSuplementacion(
      entrada({ paciente: 'Jorge Medina', fecha: '2026-08-13', folio: 'SUP-2026-0001', seleccionados: [{ nombre: 'Vitamina D3', dosis: '4000 UI' }] }),
    ))],
    ['nota_honorarios · recibo', () => React.createElement(ReciboHonorarios, propsReciboHonorarios(
      entrada({ paciente: 'Jorge Medina', fecha: '2026-08-13', folio: 'NOH-2026-0001', tipo_doc: 'honorarios', lineas: [{ concepto: 'Consulta', precio: 1800 }], monto: 1800, divisa: 'MXN' }),
    ))],
    ['nota_honorarios · cotización', () => React.createElement(ReciboHonorarios, propsReciboHonorarios(
      entrada({ paciente: '', fecha: '2026-08-13', folio: 'COT-2026-0001', tipo_doc: 'cotizacion', lineas: [{ concepto: 'Cirugía', precio: 45000 }], monto: 45000, divisa: 'MXN' }),
    ))],
    ['solicitud_internamiento', () => React.createElement(SolicitudInternamiento, propsSolicitudInternamiento(
      entrada({ paciente: 'Jorge Medina', fecha: '2026-08-13', lugar: 'Hospital del Centro', diagnostico: 'Gonartrosis' }),
    ))],
    ['escrito_medico', () => React.createElement(EscritoMedico, propsEscritoMedico(
      entrada({ paciente: 'Jorge Medina', fecha: '2026-08-13', cuerpo: '<p>A quien corresponda.</p>' }),
    ))],
    ['consentimiento_informado', () => React.createElement(ConsentimientoInformado, propsConsentimientoInformado(
      entrada({ paciente: 'Jorge Medina', lugar: 'Mérida', fecha: '2026-08-13', edad: '61 años', procedimiento: 'Artroscopia', diagnostico: 'Menisco', familiar: '', folio: 'CI-2026-0001', secciones: {} }),
    ))],
    ['denegacion_consentimiento', () => React.createElement(DenegacionConsentimiento, propsDenegacionConsentimiento(
      entrada({ paciente: 'Jorge Medina', lugar: 'Mérida', fecha: '2026-08-13', edad: '61 años', procedimiento: 'Artroscopia', familiar: '', folio: 'DEN-2026-0001' }),
    ))],
  ]

  for (const [nombre, hoja] of MINIMOS) {
    it(nombre, async () => {
      registrarFuentesDeDisco()
      const buffer = await renderToBuffer(React.createElement(Document, null, hoja()))
      expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-')
      expect(buffer.byteLength).toBeGreaterThan(1000)
    }, 60_000)
  }
})

// ─── El interruptor ──────────────────────────────────────────────────────────

describe('mobileShare · qué versión se emite y cuál se sabe componer', () => {
  it('los nueve documentos del sistema se componen en las dos versiones', () => {
    const nueve = [
      'receta', 'solicitud_lab', 'solicitud_imagen', 'plan_suplementacion',
      'nota_honorarios', 'solicitud_internamiento', 'escrito_medico',
      'consentimiento_informado', 'denegacion_consentimiento',
    ]
    for (const tipo of nueve) {
      expect(puedeComponer(tipo, 1), `${tipo} v1`).toBe(true)
      expect(puedeComponer(tipo, 2), `${tipo} v2`).toBe(true)
    }
  })

  it('lo que no es un documento del sistema se queda en v1', () => {
    expect(puedeComponer('nota_evolucion', 2)).toBe(false)
    expect(puedeComponer('expediente_completo', 2)).toBe(false)
    expect(puedeComponer('nota_evolucion', 1)).toBe(true)
    // Una subida clínica no genera PDF en ninguna versión.
    expect(puedeComponer('resultado_laboratorio', 1)).toBe(false)
  })

  it('emite v2, y el búnker se queda en v1 mientras no guarde las fuentes', () => {
    expect(VERSION_DE_EMISION).toBe(2)
    expect(versionQueEmite(false)).toBe(2)
    expect(versionQueEmite(undefined)).toBe(2)
    expect(versionQueEmite(true)).toBe(FORMATO_VERSION_POR_DEFECTO)
  })

  it('lo viejo sigue siendo v1: la columna nació con ese defecto', () => {
    expect(FORMATO_VERSION_POR_DEFECTO).toBe(1)
  })
})
