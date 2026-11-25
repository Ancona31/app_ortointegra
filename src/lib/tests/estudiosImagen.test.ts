import { describe, expect, it } from 'vitest'
import { MODALIDADES_IMAGEN } from '@/lib/estudiosImagen'

describe('catálogo de estudios de imagen', () => {
  it('once tipos, ids únicos y en el orden de la maqueta; «Otro» al final y sin regiones', () => {
    expect(MODALIDADES_IMAGEN.map(m => m.id)).toEqual(['rx', 'tc', 'rm', 'us', 'dxa', 'mx', 'mn', 'pet', 'fl', 'eco', 'otro'])
    expect(new Set(MODALIDADES_IMAGEN.map(m => m.corto)).size).toBe(11)
    const otro = MODALIDADES_IMAGEN[MODALIDADES_IMAGEN.length - 1]
    expect(otro.grupos).toEqual([])
  })

  it('sin electromiografía ni estudios que no sean de imagen (decisión del dueño)', () => {
    const todo = JSON.stringify(MODALIDADES_IMAGEN)
    expect(todo).not.toMatch(/electromiograf|EMG|electrocardiogram/i)
  })

  it('toda modalidad salvo «Otro» tiene grupos con regiones, y cada región su nombre', () => {
    for (const m of MODALIDADES_IMAGEN) {
      if (m.id === 'otro') continue
      expect(m.grupos.length, m.id).toBeGreaterThan(0)
      for (const g of m.grupos) {
        expect(g.nombre.trim(), m.id).not.toBe('')
        expect(g.regiones.length, `${m.id} · ${g.nombre}`).toBeGreaterThan(0)
        for (const r of g.regiones) expect(r.nombre.trim()).toBe(r.nombre)
      }
    }
  })

  it('una región no se repite dentro de su grupo, ni entre grupos con distinta forma de componerse', () => {
    for (const m of MODALIDADES_IMAGEN) {
      const vistas = new Map<string, string>()
      for (const g of m.grupos) {
        const nombres = g.regiones.map(r => r.nombre)
        expect(new Set(nombres).size, `${m.id} · ${g.nombre}`).toBe(nombres.length)
        for (const r of g.regiones) {
          // La forma: lo que cambia las cadenas (Doppler, angio, lado, proyecciones).
          const forma = JSON.stringify([/^angio|^doppler/i.test(g.nombre) ? g.nombre : '', r.lado ?? '', r.rutina ?? [], r.especiales ?? []])
          const antes = vistas.get(r.nombre)
          if (antes !== undefined) expect(forma, `${m.id} · ${r.nombre}`).toBe(antes)
          vistas.set(r.nombre, forma)
        }
      }
    }
  })

  it('proyecciones sólo donde la modalidad las lleva, y con alguna de rutina', () => {
    for (const m of MODALIDADES_IMAGEN) for (const g of m.grupos) for (const r of g.regiones) {
      if (m.proyecciones) {
        expect(r.rutina?.length, `${m.id} · ${r.nombre}`).toBeGreaterThan(0)
        const todas = [...(r.rutina ?? []), ...(r.especiales ?? [])]
        expect(new Set(todas).size, `${m.id} · ${r.nombre}`).toBe(todas.length)
      } else {
        expect(r.rutina, `${m.id} · ${r.nombre}`).toBeUndefined()
        expect(r.especiales, `${m.id} · ${r.nombre}`).toBeUndefined()
      }
    }
  })

  it('contraste sólo en TC y RM (y el tipo de mastografía en Mx), sin valor por omisión', () => {
    const con = MODALIDADES_IMAGEN.filter(m => m.contrastes.length > 0).map(m => m.id)
    expect(con).toEqual(['tc', 'rm', 'mx'])
    expect(MODALIDADES_IMAGEN.find(m => m.id === 'tc')?.contrastes).toEqual(['Simple', 'Contrastada', 'Simple y contrastada'])
  })

  it('cuenta de regiones y de entradas por verificar (para la lista del dueño)', () => {
    const regiones = MODALIDADES_IMAGEN.flatMap(m => m.grupos.flatMap(g => g.regiones))
    expect(regiones.length).toBe(171)
    expect(regiones.filter(r => r.verificar).length).toBe(75)
  })
})
