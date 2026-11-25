import { describe, expect, it } from 'vitest'
import { MODALIDADES_IMAGEN } from '@/lib/estudiosImagen'
import {
  buscarImagen, colorModalidad, componer, conModalidad, conRegion, ESTUDIO_EDITOR_VACIO, estaVacio, faltasDe,
  interpretar, LADOS, pideContraste, pideLado, siguienteCampo, unirLista, type EstudioEditor,
} from '@/components/documentos/imagenCompuesta'

const ed = (d: Partial<EstudioEditor> = {}): EstudioEditor => ({ ...ESTUDIO_EDITOR_VACIO, ...d })
/** Una región por su modalidad y nombre, como la elige la ficha. */
function region(mod: EstudioEditor['modalidad'], nombre: string, d: Partial<EstudioEditor> = {}): EstudioEditor {
  const m = MODALIDADES_IMAGEN.find(x => x.id === mod)
  const gi = m?.grupos.findIndex(g => g.regiones.some(r => r.nombre === nombre)) ?? -1
  if (!m || gi < 0) throw new Error(`no existe ${mod} · ${nombre}`)
  return { ...conRegion(ed(), m.id, gi, nombre), ...d }
}

describe('componer: las cuatro cadenas', () => {
  it('RM de rodilla derecha contrastada', () => {
    const e = region('rm', 'Rodilla', { lado: 'Derecha', contraste: 'Contrastada', indicacion: 'Valorar menisco medial' })
    expect(componer(e)).toEqual({ tipo: 'Resonancia magnética contrastada', region: 'Rodilla derecha', proyecciones: '', indicacion: 'Valorar menisco medial' })
  })
  it('Rx de columna lumbar con las de rutina premarcadas', () => {
    expect(componer(region('rx', 'Columna lumbar'))).toEqual({ tipo: 'Radiografía', region: 'Columna lumbar', proyecciones: 'AP y Lateral', indicacion: '' })
  })
  it('proyecciones: «, » y « y »; la «Otra» va al final', () => {
    const e = region('rx', 'Rodilla', { lado: 'Izquierda', proyecciones: ['AP', 'Lateral', 'Axial de rótula (Merchant)'], otra: ' Comparativa ' })
    expect(componer(e).proyecciones).toBe('AP, Lateral, Axial de rótula (Merchant) y Comparativa')
    expect(unirLista([])).toBe('')
    expect(unirLista(['a'])).toBe('a')
    expect(unirLista(['a', 'b'])).toBe('a y b')
  })
  it('el lado concuerda con la región', () => {
    expect(componer(region('rx', 'Hombro', { lado: 'Derecha' })).region).toBe('Hombro derecho')
    expect(componer(region('rx', 'Muñeca', { lado: 'Izquierda' })).region).toBe('Muñeca izquierda')
    expect(componer(region('rx', 'Ortejos', { lado: 'Izquierda' })).region).toBe('Ortejos izquierdos')
    expect(componer(region('rx', 'Rodilla', { lado: 'Bilateral' })).region).toBe('Rodilla bilateral')
  })
  it('angio-TC: contraste implícito, no se pide ni se escribe', () => {
    const e = region('tc', 'Angio-TC de aorta', { contraste: 'Simple' })
    expect(pideContraste(e)).toBe(false)
    expect(componer(e).tipo).toBe('Tomografía (TAC)')
    expect(faltasDe(e)).toEqual([])
  })
  it('US del grupo Doppler: «Ultrasonido Doppler»; medicina nuclear: «Gammagrafía»', () => {
    expect(componer(region('us', 'Doppler carotídeo')).tipo).toBe('Ultrasonido Doppler')
    expect(componer(region('us', 'Tiroides')).tipo).toBe('Ultrasonido')
    expect(componer(region('mn', 'Tiroidea')).tipo).toBe('Gammagrafía')
  })
  it('Mx: el tipo de mastografía en minúscula; sin proyecciones fuera de Rx y Mx', () => {
    expect(componer(region('mx', 'Mama unilateral', { lado: 'Derecha', contraste: 'Diagnóstica' }))).toMatchObject({ tipo: 'Mastografía diagnóstica', region: 'Mama unilateral derecha', proyecciones: 'Craneocaudal y Mediolateral oblicua' })
    expect(componer(region('tc', 'Rodilla', { otra: 'x' })).proyecciones).toBe('')
  })
  it('«Otro» devuelve sus cuatro campos libres tal cual', () => {
    const e = ed({ modalidad: 'otro', tipoLibre: 'Electromiografía (EMG)', regionLibre: 'MPI', proyLibre: 'n/a', indicacion: 'x' })
    expect(componer(e)).toEqual({ tipo: 'Electromiografía (EMG)', region: 'MPI', proyecciones: 'n/a', indicacion: 'x' })
  })
})

describe('qué falta y a dónde va el foco', () => {
  it('vacío no falta nada', () => { expect(faltasDe(ed())).toEqual([]); expect(estaVacio(ed())).toBe(true) })
  it('sólo indicación: falta tipo y región', () => expect(faltasDe(ed({ indicacion: 'x' }))).toEqual(['tipo', 'region']))
  it('TC sin contraste y región con lado: faltan los dos', () => {
    const e = region('tc', 'Rodilla')
    expect(pideLado(e)).toBe(true)
    expect(faltasDe(e)).toEqual(['lado', 'contraste'])
    expect(siguienteCampo(e)).toBe('lado')
    expect(siguienteCampo({ ...e, lado: 'Derecha' })).toBe('contraste')
    expect(siguienteCampo({ ...e, lado: 'Derecha', contraste: 'Simple' })).toBe('indicacion')
  })
  it('elegir el tipo lleva a la región; «Otro» a su campo libre', () => {
    expect(siguienteCampo(conModalidad(ed(), 'rx'))).toBe('region')
    expect(siguienteCampo(conModalidad(ed(), 'otro'))).toBe('tipoLibre')
  })
  it('«Otro» exige lo de hoy: tipo y región', () => {
    expect(faltasDe(ed({ modalidad: 'otro', tipoLibre: 'X' }))).toEqual(['region'])
  })
  it('pasar a «Otro» lleva lo compuesto a los campos libres', () => {
    const e = conModalidad(region('rm', 'Hombro', { lado: 'Izquierda', contraste: 'Simple', indicacion: 'i' }), 'otro')
    expect(e).toMatchObject({ tipoLibre: 'Resonancia magnética simple', regionLibre: 'Hombro izquierdo', indicacion: 'i' })
  })
  it('colores por familia', () => {
    expect(['rx', 'tc', 'rm', 'us', 'dxa', 'mx', 'mn', 'otro'].map(x => colorModalidad(x as EstudioEditor['modalidad'])))
      .toEqual(['rx', 'tc', 'rm', 'us', 'verde', 'verde', 'otra', 'otra'])
  })
})

describe('buscador «tipo + región»', () => {
  it('«rx col lum» da columna lumbar, no cervical', () => {
    expect(buscarImagen('rx col lum')[0]).toMatchObject({ modalidad: 'rx', region: 'Columna lumbar' })
  })
  it('sin acentos y por tipo corto: «rm rod», «us hom», «tc angio»', () => {
    expect(buscarImagen('rm rod')[0]).toMatchObject({ modalidad: 'rm', region: 'Rodilla' })
    expect(buscarImagen('us hom')[0]).toMatchObject({ modalidad: 'us', region: 'Hombro' })
    expect(buscarImagen('RESONANCIA HIPOFISIS')[0]).toMatchObject({ modalidad: 'rm', region: 'Hipófisis (silla turca)' })
    expect(buscarImagen('tc angio').every(r => r.modalidad === 'tc')).toBe(true)
  })
  it('menos de dos letras no busca; a lo más nueve', () => {
    expect(buscarImagen('r')).toEqual([])
    expect(buscarImagen('rx').length).toBe(9)
  })
})

/** Todo estudio que el formulario puede generar, con lados, contrastes y proyecciones variadas. */
function generables(): EstudioEditor[] {
  const out: EstudioEditor[] = []
  for (const m of MODALIDADES_IMAGEN) m.grupos.forEach((g, gi) => g.regiones.forEach((r, ri) => {
    const base = conRegion(ed(), m.id, gi, r.nombre)
    const lados = r.lado ? LADOS : ['' as const]
    const contrastes = pideContraste(base) ? m.contrastes : ['']
    for (const lado of lados) for (const contraste of contrastes) {
      out.push({ ...base, lado, contraste, indicacion: ri % 2 ? 'Descartar fractura' : '' })
    }
    if (r.especiales?.length) out.push({ ...base, proyecciones: [...r.especiales].reverse(), otra: 'Comparativa, con carga y lateral' })
  }))
  return out
}

describe('interpretar: ida y vuelta', () => {
  it('componer(interpretar(x)) === x para todo lo que el formulario genera, y se reconoce (no «Otro»)', () => {
    const lista = generables()
    expect(lista.length).toBeGreaterThan(400)
    for (const e of lista) {
      const x = componer(e)
      const i = interpretar(x)
      expect(componer(i), JSON.stringify(x)).toEqual(x)
      expect(i.modalidad, JSON.stringify(x)).toBe(e.modalidad)
    }
  })
  it('a medias (sin lado, sin contraste, sin región) también vuelve igual', () => {
    for (const e of [region('tc', 'Rodilla'), conModalidad(ed(), 'rm'), region('rx', 'Hombro', { proyecciones: [] })]) {
      const x = componer(e)
      expect(componer(interpretar(x))).toEqual(x)
      expect(interpretar(x).modalidad).toBe(e.modalidad)
    }
  })
  it('las cadenas del formulario viejo que cuadran se reconocen', () => {
    expect(interpretar({ tipo: 'Resonancia magnética simple', region: 'Columna lumbar', proyecciones: '', indicacion: '' }))
      .toMatchObject({ modalidad: 'rm', region: 'Columna lumbar', contraste: 'Simple' })
    expect(interpretar({ tipo: 'Ultrasonido', region: 'Hombro derecho' })).toMatchObject({ modalidad: 'us', region: 'Hombro', lado: 'Derecha' })
  })
  it('texto libre arbitrario cae en «Otro» sin cambiar ni un carácter', () => {
    const casos = [
      { tipo: 'Electromiografía (EMG)', region: 'Miembros pélvicos', proyecciones: '', indicacion: 'Radiculopatía' },
      { tipo: 'Radiografía', region: 'rodilla der.', proyecciones: 'AP, lateral', indicacion: '' },
      { tipo: 'Tomografía (TAC)', region: 'Columna lumbar ', proyecciones: '', indicacion: '' },
      { tipo: 'Ultrasonido', region: 'Doppler carotídeo', proyecciones: '', indicacion: '' },
      { tipo: 'Resonancia magnética', region: 'Rodilla', proyecciones: 'Sagital', indicacion: '' },
      { tipo: '', region: 'Tórax', proyecciones: '', indicacion: '' },
      { tipo: 'Gammagrafía', region: 'Ósea', proyecciones: '', indicacion: '' },
      { tipo: 'Mielograma', region: 'Lumbar', proyecciones: 'AP', indicacion: 'x' },
    ]
    for (const c of casos) {
      const i = interpretar(c)
      expect(i.modalidad, JSON.stringify(c)).toBe('otro')
      expect(componer(i)).toEqual(c)
    }
  })
  it('una proyección escrita a mano que no está en el catálogo queda como «Otra», sin cambiar el texto', () => {
    const c = { tipo: 'Radiografía', region: 'Rodilla derecha', proyecciones: 'AP y lateral', indicacion: '' }
    const i = interpretar(c)
    expect(i).toMatchObject({ modalidad: 'rx', proyecciones: ['AP'], otra: 'lateral' })
    expect(componer(i)).toEqual(c)
  })
  it('sin «proyecciones» ni «indicacion» (filas viejas) no rompe', () => {
    expect(componer(interpretar({ tipo: 'Radiografía', region: 'Pelvis' }))).toEqual({ tipo: 'Radiografía', region: 'Pelvis', proyecciones: '', indicacion: '' })
  })
})
