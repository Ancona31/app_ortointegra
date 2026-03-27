import { describe, it, expect } from 'vitest'
import { analizarLaboratorios } from './analisis'

// ─────────────────────────────────────────────────────────────────────────────
// Vitamina D
// ─────────────────────────────────────────────────────────────────────────────
describe('Vitamina D', () => {
  it('recomienda dosis alta cuando vitamina_d < 20', () => {
    const r = analizarLaboratorios({ vitamina_d: 15 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Vitamina D3'))
    expect(sup).toBeDefined()
    expect(sup?.dosis).toContain('50,000 UI')
    expect(sup?.prioridad).toBe('alta')
  })

  it('recomienda dosis media cuando vitamina_d entre 20 y 39', () => {
    const r = analizarLaboratorios({ vitamina_d: 30 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Vitamina D3'))
    expect(sup).toBeDefined()
    expect(sup?.dosis).toContain('5,000 UI')
    expect(sup?.prioridad).toBe('media')
  })

  it('no recomienda Vitamina D cuando está en rango óptimo', () => {
    const r = analizarLaboratorios({ vitamina_d: 50 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Vitamina D3'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Omega-3 (PCR-us y Triglicéridos)
// ─────────────────────────────────────────────────────────────────────────────
describe('Omega-3', () => {
  it('recomienda Omega-3 cuando PCR-us > 1.0', () => {
    const r = analizarLaboratorios({ pcr_us: 2.5 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Omega-3'))
    expect(sup).toBeDefined()
    expect(sup?.prioridad).toBe('alta')
  })

  it('recomienda Omega-3 cuando triglicéridos > 100', () => {
    const r = analizarLaboratorios({ trigliceridos: 150 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Omega-3'))
    expect(sup).toBeDefined()
  })

  it('recomienda Omega-3 cuando ambos están elevados', () => {
    const r = analizarLaboratorios({ pcr_us: 3.0, trigliceridos: 200 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Omega-3'))
    expect(sup).toBeDefined()
    expect(sup?.justificacion).toContain('PCR-us')
    expect(sup?.justificacion).toContain('Triglicéridos')
  })

  it('no recomienda Omega-3 cuando ambos están en rango óptimo', () => {
    const r = analizarLaboratorios({ pcr_us: 0.5, trigliceridos: 80 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Omega-3'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Magnesio (Insulina Basal)
// ─────────────────────────────────────────────────────────────────────────────
describe('Magnesio', () => {
  it('recomienda Magnesio cuando insulina_basal > 8', () => {
    const r = analizarLaboratorios({ insulina_basal: 12 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Magnesio'))
    expect(sup).toBeDefined()
    expect(sup?.prioridad).toBe('media')
  })

  it('no recomienda Magnesio cuando insulina_basal <= 8', () => {
    const r = analizarLaboratorios({ insulina_basal: 7 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Magnesio'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Colágeno + Vitamina C
// ─────────────────────────────────────────────────────────────────────────────
describe('Colágeno', () => {
  it('recomienda Colágeno cuando HbA1c > 5.3', () => {
    const r = analizarLaboratorios({ hba1c: 5.7 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Colágeno'))
    expect(sup).toBeDefined()
  })

  it('recomienda Colágeno por diagnóstico de artrosis aunque HbA1c sea normal', () => {
    const r = analizarLaboratorios({ hba1c: 5.0 }, { diagnostico: 'artrosis de rodilla' })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Colágeno'))
    expect(sup).toBeDefined()
    expect(sup?.justificacion).toContain('cartílago')
  })

  it('recomienda Colágeno por diagnóstico de hernia discal', () => {
    const r = analizarLaboratorios({}, { diagnostico: 'hernia discal L4-L5' })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Colágeno'))
    expect(sup).toBeDefined()
  })

  it('no recomienda Colágeno cuando HbA1c normal y sin diagnóstico relevante', () => {
    const r = analizarLaboratorios({ hba1c: 5.0 }, { diagnostico: 'lumbalgia mecánica' })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Colágeno'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Creatina (Post-operatorio)
// ─────────────────────────────────────────────────────────────────────────────
describe('Creatina', () => {
  it('recomienda Creatina cuando el paciente es post-operatorio', () => {
    const r = analizarLaboratorios({}, { post_operatorio: true })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Creatina'))
    expect(sup).toBeDefined()
    expect(sup?.prioridad).toBe('alta')
  })

  it('no recomienda Creatina sin contexto post-operatorio', () => {
    const r = analizarLaboratorios({})
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Creatina'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Ashwagandha (Dolor crónico)
// ─────────────────────────────────────────────────────────────────────────────
describe('Ashwagandha', () => {
  it('recomienda Ashwagandha con dolor crónico >= 3 meses', () => {
    const r = analizarLaboratorios({}, { dolor_cronico_meses: 6 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Ashwagandha'))
    expect(sup).toBeDefined()
    expect(sup?.prioridad).toBe('baja')
  })

  it('no recomienda Ashwagandha con dolor < 3 meses', () => {
    const r = analizarLaboratorios({}, { dolor_cronico_meses: 2 })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('Ashwagandha'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// HMB (Inmovilización)
// ─────────────────────────────────────────────────────────────────────────────
describe('HMB', () => {
  it('recomienda HMB cuando el paciente está inmovilizado', () => {
    const r = analizarLaboratorios({}, { inmovilizacion: true })
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('HMB'))
    expect(sup).toBeDefined()
    expect(sup?.prioridad).toBe('alta')
  })

  it('no recomienda HMB sin inmovilización', () => {
    const r = analizarLaboratorios({})
    const sup = r.suplementos_recomendados.find(s => s.nombre.includes('HMB'))
    expect(sup).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Alertas críticas — Albúmina
// ─────────────────────────────────────────────────────────────────────────────
describe('Alerta — Albúmina', () => {
  it('genera alerta CRÍTICA cuando albúmina < 3.5', () => {
    const r = analizarLaboratorios({ albumina: 3.2 })
    const alerta = r.alertas.find(a => a.parametro === 'Albúmina')
    expect(alerta).toBeDefined()
    expect(alerta?.tipo).toBe('critica')
    expect(r.alertas[0].parametro).toBe('Albúmina') // debe ser la primera por unshift
  })

  it('genera alerta WARNING cuando albúmina entre 3.5 y 4.2', () => {
    const r = analizarLaboratorios({ albumina: 3.8 })
    const alerta = r.alertas.find(a => a.parametro === 'Albúmina')
    expect(alerta?.tipo).toBe('warning')
  })

  it('no genera alerta cuando albúmina >= 4.2', () => {
    const r = analizarLaboratorios({ albumina: 4.5 })
    const alerta = r.alertas.find(a => a.parametro === 'Albúmina')
    expect(alerta).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Alertas críticas — TSH
// ─────────────────────────────────────────────────────────────────────────────
describe('Alerta — TSH', () => {
  it('genera alerta CRÍTICA cuando TSH > 4.5', () => {
    const r = analizarLaboratorios({ tsh: 6.0 })
    const alerta = r.alertas.find(a => a.parametro === 'TSH')
    expect(alerta?.tipo).toBe('critica')
  })

  it('genera alerta CRÍTICA cuando TSH < 0.4', () => {
    const r = analizarLaboratorios({ tsh: 0.1 })
    const alerta = r.alertas.find(a => a.parametro === 'TSH')
    expect(alerta?.tipo).toBe('critica')
  })

  it('genera alerta WARNING cuando TSH está fuera del óptimo pero en rango', () => {
    const r = analizarLaboratorios({ tsh: 3.5 })
    const alerta = r.alertas.find(a => a.parametro === 'TSH')
    expect(alerta?.tipo).toBe('warning')
  })

  it('no genera alerta cuando TSH está en rango óptimo', () => {
    const r = analizarLaboratorios({ tsh: 1.5 })
    const alerta = r.alertas.find(a => a.parametro === 'TSH')
    expect(alerta).toBeUndefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Alertas críticas — Cistatina C
// ─────────────────────────────────────────────────────────────────────────────
describe('Alerta — Cistatina C', () => {
  it('genera alerta CRÍTICA cuando cistatina_c > 1.0', () => {
    const r = analizarLaboratorios({ cistatina_c: 1.3 })
    const alerta = r.alertas.find(a => a.parametro === 'Cistatina C')
    expect(alerta?.tipo).toBe('critica')
    expect(r.alertas[0].parametro).toBe('Cistatina C') // unshift: debe ser la primera
  })

  it('genera alerta WARNING cuando cistatina_c entre 0.9 y 1.0', () => {
    const r = analizarLaboratorios({ cistatina_c: 0.95 })
    const alerta = r.alertas.find(a => a.parametro === 'Cistatina C')
    expect(alerta?.tipo).toBe('warning')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Orden de suplementos por prioridad
// ─────────────────────────────────────────────────────────────────────────────
describe('Orden por prioridad', () => {
  it('los suplementos de alta prioridad van primero', () => {
    const r = analizarLaboratorios(
      { vitamina_d: 25, insulina_basal: 10 },
      { post_operatorio: true, dolor_cronico_meses: 6 }
    )
    const prioridades = r.suplementos_recomendados.map(s => s.prioridad)
    for (let i = 0; i < prioridades.length - 1; i++) {
      const orden = { alta: 0, media: 1, baja: 2 }
      expect(orden[prioridades[i]]).toBeLessThanOrEqual(orden[prioridades[i + 1]])
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Resumen clínico
// ─────────────────────────────────────────────────────────────────────────────
describe('Resumen clínico', () => {
  it('indica perfil óptimo cuando no hay alteraciones', () => {
    const r = analizarLaboratorios({ vitamina_d: 50, albumina: 4.5, tsh: 1.5 })
    expect(r.resumen_clinico).toContain('óptimos')
  })

  it('menciona alertas críticas en el resumen', () => {
    const r = analizarLaboratorios({ albumina: 3.0 })
    expect(r.resumen_clinico).toContain('crítica')
  })

  it('menciona número de suplementos en el resumen', () => {
    const r = analizarLaboratorios({ vitamina_d: 10, pcr_us: 3.0 })
    expect(r.resumen_clinico).toMatch(/\d+ suplemento/)
  })

  it('retorna campo generado_en como ISO string', () => {
    const r = analizarLaboratorios({})
    expect(r.generado_en).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Casos borde
// ─────────────────────────────────────────────────────────────────────────────
describe('Casos borde', () => {
  it('maneja objeto de valores vacío sin lanzar error', () => {
    expect(() => analizarLaboratorios({})).not.toThrow()
  })

  it('maneja undefined en todos los valores', () => {
    const r = analizarLaboratorios({ vitamina_d: undefined })
    expect(r.suplementos_recomendados).toBeInstanceOf(Array)
    expect(r.alertas).toBeInstanceOf(Array)
  })

  it('maneja datosClinico undefined', () => {
    expect(() => analizarLaboratorios({ vitamina_d: 15 }, undefined)).not.toThrow()
  })

  it('maneja múltiples condiciones simultáneas correctamente', () => {
    const r = analizarLaboratorios(
      {
        vitamina_d: 10,
        pcr_us: 5.0,
        trigliceridos: 250,
        insulina_basal: 20,
        albumina: 3.0,
        tsh: 7.0,
        cistatina_c: 1.5,
        hba1c: 6.2,
      },
      {
        post_operatorio: true,
        inmovilizacion: true,
        dolor_cronico_meses: 12,
        diagnostico: 'artrosis severa de rodilla',
      }
    )
    expect(r.suplementos_recomendados.length).toBeGreaterThan(3)
    expect(r.alertas.length).toBeGreaterThan(0)
  })
})
