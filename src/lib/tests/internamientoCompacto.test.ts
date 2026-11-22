import { describe, expect, it } from 'vitest'
import {
  alternar, contarRenglones, ejemploDe, fechaCorta, GRUPOS_FIJOS, gruposDeHoja, hojaDeGrupos, leerGrupos,
  lineasPegadas, pegarEnRenglones, resumenDiagnostico, resumenGenerales, resumenInstrucciones, resumenPiso,
  resumenRequerimientos, seccionDe, textoIndicaciones, validarNombreGrupo, type GrupoIndicaciones,
} from '@/components/documentos/internamientoCompacto'

/** Lo que guardaba una plantilla «antigua»: dos fijos y uno propio. */
const ANTIGUA: GrupoIndicaciones[] = [
  { nombre: 'Dieta', renglones: ['Ayuno estricto de 8 horas'] },
  { nombre: 'Medicamentos', renglones: ['Cefalotina 1 g IV', 'Ketorolaco 30 mg IV c/8 h'] },
  { nombre: 'Al ingreso', renglones: ['Tomar BH y QS'] },
]

describe('hoja de órdenes ⇄ lo guardado', () => {
  it('la hoja vacía trae los cuatro fijos, en su orden y con un renglón listo', () => {
    const h = hojaDeGrupos([])
    expect(h.map(g => g.nombre)).toEqual([...GRUPOS_FIJOS])
    expect(h.every(g => g.renglones.length === 1 && g.renglones[0] === '')).toBe(true)
    expect(gruposDeHoja(h)).toEqual([])
    expect(textoIndicaciones(gruposDeHoja(h))).toBe('')
  })

  it('una plantilla antigua se carga con los fijos ausentes vacíos y vuelve a guardarse idéntica', () => {
    const hoja = hojaDeGrupos(leerGrupos(JSON.parse(JSON.stringify(ANTIGUA))))
    expect(hoja.map(g => g.nombre)).toEqual([...GRUPOS_FIJOS, 'Al ingreso'])
    expect(hoja[1].renglones).toEqual([''])
    expect(gruposDeHoja(hoja)).toEqual(ANTIGUA)
    expect(textoIndicaciones(gruposDeHoja(hoja))).toBe(textoIndicaciones(ANTIGUA))
  })

  it('al guardar se van los renglones vacíos y los grupos sin texto o sin nombre', () => {
    const hoja: GrupoIndicaciones[] = [
      { nombre: 'Dieta', renglones: ['', 'Blanda', '  '] },
      { nombre: 'Soluciones', renglones: [''] },
      { nombre: 'Medicamentos', renglones: ['   '] },
      { nombre: 'Cuidados de enfermería', renglones: ['Signos vitales'] },
      { nombre: '', renglones: ['Huérfano'] },
      { nombre: ' Al egreso ', renglones: ['Cita en 7 días'] },
    ]
    expect(gruposDeHoja(hoja)).toEqual([
      { nombre: 'Dieta', renglones: ['Blanda'] },
      { nombre: 'Cuidados de enfermería', renglones: ['Signos vitales'] },
      { nombre: 'Al egreso', renglones: ['Cita en 7 días'] },
    ])
    expect(textoIndicaciones(gruposDeHoja(hoja))).toBe(textoIndicaciones(hoja))
    expect(contarRenglones(hoja)).toBe(4)
  })

  it('el texto del PDF es el mismo que daba el control anterior para los mismos grupos', () => {
    expect(textoIndicaciones(gruposDeHoja(hojaDeGrupos(ANTIGUA)))).toBe(
      'Dieta\n- Ayuno estricto de 8 horas\n\nMedicamentos\n- Cefalotina 1 g IV\n- Ketorolaco 30 mg IV c/8 h\n\nAl ingreso\n- Tomar BH y QS',
    )
  })

  it('leerGrupos tolera basura y ordena los fijos en orden clínico', () => {
    expect(leerGrupos('x')).toEqual([])
    expect(leerGrupos([null, 3, { nombre: '' }, { nombre: 'Medicamentos', renglones: [1, 'A'] }, { nombre: 'Dieta' }]))
      .toEqual([{ nombre: 'Dieta', renglones: [''] }, { nombre: 'Medicamentos', renglones: ['A'] }])
  })

  it('los ejemplos son ayuda por grupo y el resto de renglones una pista', () => {
    expect(ejemploDe('Dieta', 0)).toBe('Ej: Ayuno estricto de 8 horas')
    expect(ejemploDe('Al ingreso', 0)).toBe('Ej: Una indicación por renglón')
    expect(ejemploDe('Dieta', 1)).toBe('Siguiente indicación')
  })
})

describe('grupos propios y pegado', () => {
  const hoja = hojaDeGrupos(ANTIGUA)
  it('el nombre no puede ir vacío ni repetir otro (sin mayúsculas)', () => {
    expect(validarNombreGrupo(hoja, 4, 'Al egreso')).toBe('ok')
    expect(validarNombreGrupo(hoja, 4, 'Al ingreso')).toBe('ok')
    expect(validarNombreGrupo(hoja, 5, ' al INGRESO ')).toBe('repetido')
    expect(validarNombreGrupo(hoja, 5, 'dieta')).toBe('repetido')
    expect(validarNombreGrupo(hoja, 5, '   ')).toBe('vacio')
  })

  it('lo pegado quita viñetas y números, y descarta líneas vacías', () => {
    expect(lineasPegadas('1. Ayuno\n2) Hartmann 1000 ml\n\n• Omeprazol 40 mg\n- Signos vitales\r\n–  Medias')).toEqual([
      'Ayuno', 'Hartmann 1000 ml', 'Omeprazol 40 mg', 'Signos vitales', 'Medias',
    ])
    expect(lineasPegadas('Cefalotina 1 g')).toEqual(['Cefalotina 1 g'])
  })

  it('pegar en un renglón vacío lo ocupa; en uno con texto, va debajo', () => {
    expect(pegarEnRenglones(['A', '', 'C'], 1, ['x', 'y'])).toEqual({ renglones: ['A', 'x', 'y', 'C'], ultimo: 2 })
    expect(pegarEnRenglones(['A', 'C'], 0, ['x', 'y'])).toEqual({ renglones: ['A', 'x', 'y', 'C'], ultimo: 2 })
  })
})

describe('resúmenes de las secciones', () => {
  it('datos generales', () => {
    expect(resumenGenerales({ tipoInternamiento: '', fechaIngreso: '', diasEstimados: '', asa: '', lugar: '', urgente: false }))
      .toEqual({ texto: 'Sin datos del internamiento', completa: false })
    expect(resumenGenerales({
      tipoInternamiento: 'Cirugía electiva', fechaIngreso: '2026-11-25', diasEstimados: '3 días',
      asa: 'ASA II', lugar: 'Hospital X', urgente: true,
    }).texto).toBe('Urgente · Cirugía electiva · ingreso 25 nov · 3 días · ASA II · Hospital X')
    expect(fechaCorta('2026-01-05')).toBe('5 ene')
    expect(fechaCorta('')).toBe('')
  })

  it('diagnóstico, requerimientos, instrucciones y piso', () => {
    expect(resumenDiagnostico('', [], '')).toEqual({ texto: 'Falta el diagnóstico principal', completa: false })
    expect(resumenDiagnostico('Conducto lumbar', ['HAS', ''], 'Artrodesis').texto).toBe('Conducto lumbar · +1 secundario · Artrodesis')
    expect(resumenRequerimientos([], '')).toEqual({ texto: 'Sin requerimientos', completa: false })
    expect(resumenRequerimientos(['Tromboprofilaxis', 'Grúa'], 'Dolor')).toEqual({ texto: 'Tromboprofilaxis, Grúa · con justificación', completa: true })
    expect(resumenInstrucciones(false).texto).toBe('Texto estándar')
    expect(resumenInstrucciones(true).texto).toBe('Editadas')
    expect(resumenPiso(hojaDeGrupos([])).texto).toBe('Sin indicaciones')
    expect(resumenPiso(hojaDeGrupos(ANTIGUA)).texto).toBe('Dieta 1 · Medicamentos 2 · Al ingreso 1')
  })

  it('cada obligatorio vive en su sección, y los requerimientos se añaden en el orden en que se eligen', () => {
    expect(['paciente', 'lugar', 'fechaIngreso', 'diagnostico'].map(seccionDe)).toEqual(['gen', 'gen', 'gen', 'dx'])
    expect(alternar(['B'], 'A')).toEqual(['B', 'A'])
    expect(alternar(['B', 'A'], 'B')).toEqual(['A'])
  })
})
