import { ValoresLab, AnalisisIA, SuplementoRec, Alerta, VALORES_REFERENCIA } from '@/types'

// ─── Reglas de suplementación basadas en laboratorio ─────────────────────────
export function analizarLaboratorios(valores: ValoresLab, datosClinico?: {
  diagnostico?: string
  post_operatorio?: boolean
  dolor_cronico_meses?: number
  inmovilizacion?: boolean
}): AnalisisIA {
  const suplementos: SuplementoRec[] = []
  const alertas: Alerta[] = []

  // ── Vitamina D3 + K2 ──────────────────────────────────────────────────────
  if (valores.vitamina_d !== undefined) {
    if (valores.vitamina_d < 40) {
      suplementos.push({
        nombre: 'Vitamina D3 (Dosis de Carga) + Vitamina K2 MK-7',
        dosis: valores.vitamina_d < 20
          ? '50,000 UI D3 semanal x 8 sem + 100 mcg K2 diario'
          : '5,000 UI D3 diario + 100 mcg K2 diario',
        justificacion: `Vitamina D en ${valores.vitamina_d} ng/mL (óptimo: 40-60). Necesaria para mineralización ósea real y fuerza en fibras tipo II. K2 activa osteocalcina y evita calcificación de tejidos blandos.`,
        prioridad: valores.vitamina_d < 20 ? 'alta' : 'media',
      })
    }
    registrarEstado(alertas, 'vitamina_d', valores.vitamina_d)
  }

  // ── Omega-3 (PCR-us y Triglicéridos) ──────────────────────────────────────
  let necesitaOmega3 = false
  let justOmega3 = ''

  if (valores.pcr_us !== undefined && valores.pcr_us > 1.0) {
    necesitaOmega3 = true
    justOmega3 += `PCR-us elevada (${valores.pcr_us} mg/L > óptimo 1.0). `
    registrarEstado(alertas, 'pcr_us', valores.pcr_us)
  }
  if (valores.trigliceridos !== undefined && valores.trigliceridos > 100) {
    necesitaOmega3 = true
    justOmega3 += `Triglicéridos ${valores.trigliceridos} mg/dL (óptimo < 100). `
    registrarEstado(alertas, 'trigliceridos', valores.trigliceridos)
  }
  if (necesitaOmega3) {
    suplementos.push({
      nombre: 'Omega-3 EPA/DHA',
      dosis: '2-3 g EPA+DHA/día con alimentos',
      justificacion: justOmega3 + 'Resolución de inflamación crónica y mejora de viscosidad sinovial.',
      prioridad: 'alta',
    })
  }

  // ── Magnesio ──────────────────────────────────────────────────────────────
  if (valores.insulina_basal !== undefined && valores.insulina_basal > 8) {
    suplementos.push({
      nombre: 'Magnesio (ZMA / Glicinato)',
      dosis: '300-400 mg/día (glicinato preferible)',
      justificacion: `Insulina basal en ${valores.insulina_basal} uIU/mL (óptimo < 8). El magnesio es cofactor en > 300 reacciones enzimáticas incluyendo sensibilidad a insulina y formación ósea.`,
      prioridad: 'media',
    })
    registrarEstado(alertas, 'insulina_basal', valores.insulina_basal)
  }

  // ── Colágeno + Vitamina C ─────────────────────────────────────────────────
  if (valores.hba1c !== undefined && valores.hba1c > 5.3) {
    suplementos.push({
      nombre: 'Colágeno Hidrolizado + Vitamina C',
      dosis: '10-15 g colágeno + 500 mg Vit C en ayunas',
      justificacion: `HbA1c en ${valores.hba1c}% (óptimo 4.8-5.3%). Glicación de colágeno comprometida. Suplementar para síntesis de matriz extracelular en cartílago y discos.`,
      prioridad: 'media',
    })
    registrarEstado(alertas, 'hba1c', valores.hba1c)
  } else if (datosClinico?.diagnostico?.toLowerCase().match(/artrosis|artritis|disco|cartílago|cartilago|hernia/)) {
    suplementos.push({
      nombre: 'Colágeno Hidrolizado + Vitamina C',
      dosis: '10-15 g colágeno + 500 mg Vit C en ayunas',
      justificacion: 'Diagnóstico con compromiso de cartílago/disco. Provee aminoácidos (prolina, lisina) para síntesis de matriz extracelular.',
      prioridad: 'media',
    })
  }

  // ── Creatina (post-op / rehabilitación) ───────────────────────────────────
  if (datosClinico?.post_operatorio) {
    suplementos.push({
      nombre: 'Creatina Monohidratada',
      dosis: '5 g/día (sin fase de carga)',
      justificacion: 'Paciente en recuperación postoperatoria. Hidratación celular y mejora de fuerza muscular para evitar atrofia durante rehabilitación.',
      prioridad: 'alta',
    })
  }

  // ── Ashwagandha (dolor crónico) ───────────────────────────────────────────
  if (datosClinico?.dolor_cronico_meses && datosClinico.dolor_cronico_meses >= 3) {
    suplementos.push({
      nombre: 'Ashwagandha KSM-66',
      dosis: '300-600 mg/día (extracto estandarizado)',
      justificacion: `Dolor crónico de ${datosClinico.dolor_cronico_meses} meses. Reduce cortisol inducido por dolor, mejora estado anímico y tolerancia al esfuerzo físico.`,
      prioridad: 'baja',
    })
  }

  // ── HMB (inmovilización) ──────────────────────────────────────────────────
  if (datosClinico?.inmovilizacion) {
    suplementos.push({
      nombre: 'HMB (Beta-hidroxi-beta-metilbutirato)',
      dosis: '3 g/día dividido en 3 tomas',
      justificacion: 'Paciente con inmovilización/reposo prolongado. Previene degradación muscular (anticatabólico).',
      prioridad: 'alta',
    })
  }

  // ── Alertas críticas ──────────────────────────────────────────────────────
  if (valores.albumina !== undefined) {
    registrarEstado(alertas, 'albumina', valores.albumina)
    if (valores.albumina < 3.5) {
      alertas.unshift({
        tipo: 'critica',
        parametro: 'Albúmina',
        mensaje: `⚠️ ALERTA CRÍTICA: Albúmina en ${valores.albumina} g/dL. Riesgo ALTO de infección de sitio quirúrgico y no-unión ósea. Optimizar estado nutricional antes de cualquier procedimiento.`,
        valor_actual: valores.albumina,
        valor_optimo: '> 4.2 g/dL',
      })
    } else if (valores.albumina < 4.2) {
      alertas.push({
        tipo: 'warning',
        parametro: 'Albúmina',
        mensaje: `Albúmina sub-óptima (${valores.albumina} g/dL). Meta > 4.2 g/dL para cicatrización óptima.`,
        valor_actual: valores.albumina,
        valor_optimo: '> 4.2 g/dL',
      })
    }
  }

  if (valores.tsh !== undefined) {
    registrarEstado(alertas, 'tsh', valores.tsh)
    if (valores.tsh > 4.5 || valores.tsh < 0.4) {
      alertas.push({
        tipo: 'critica',
        parametro: 'TSH',
        mensaje: `TSH fuera de rango de referencia (${valores.tsh} mIU/L). Considerar derivación a endocrinología.`,
        valor_actual: valores.tsh,
        valor_optimo: '1.0 – 2.5 mIU/L',
      })
    } else if (valores.tsh > 2.5 || valores.tsh < 1.0) {
      alertas.push({
        tipo: 'warning',
        parametro: 'TSH',
        mensaje: `TSH fuera del rango óptimo (${valores.tsh} mIU/L). Posible impacto en reparación tisular y fatiga muscular.`,
        valor_actual: valores.tsh,
        valor_optimo: '1.0 – 2.5 mIU/L',
      })
    }
  }

  if (valores.cistatina_c !== undefined) {
    registrarEstado(alertas, 'cistatina_c', valores.cistatina_c)
    if (valores.cistatina_c > 1.0) {
      alertas.unshift({
        tipo: 'critica',
        parametro: 'Cistatina C',
        mensaje: `⚠️ Cistatina C elevada (${valores.cistatina_c} mg/L). PRECAUCIÓN con AINEs y suplementos de alta carga renal. Evaluar filtrado glomerular.`,
        valor_actual: valores.cistatina_c,
        valor_optimo: '< 0.9 mg/L',
      })
    } else if (valores.cistatina_c > 0.9) {
      alertas.push({
        tipo: 'warning',
        parametro: 'Cistatina C',
        mensaje: `Cistatina C en límite (${valores.cistatina_c} mg/L). Monitorear función renal antes de AINEs prolongados.`,
        valor_actual: valores.cistatina_c,
        valor_optimo: '< 0.9 mg/L',
      })
    }
  }

  if (valores.tgp_alt !== undefined) {
    registrarEstado(alertas, 'tgp_alt', valores.tgp_alt)
    if (valores.tgp_alt > 30) {
      alertas.push({
        tipo: 'warning',
        parametro: 'TGP (ALT)',
        mensaje: `TGP elevada (${valores.tgp_alt} U/L > óptimo 30). Carga hepática inflamatoria. Puede afectar metabolismo proteico.`,
        valor_actual: valores.tgp_alt,
        valor_optimo: '< 30 U/L',
      })
    }
  }

  // ── Ordenar suplementos por prioridad ─────────────────────────────────────
  const orden = { alta: 0, media: 1, baja: 2 }
  suplementos.sort((a, b) => orden[a.prioridad] - orden[b.prioridad])

  const resumen = generarResumen(suplementos, alertas, valores)

  return {
    suplementos_recomendados: suplementos,
    alertas,
    resumen_clinico: resumen,
    generado_en: new Date().toISOString(),
  }
}

function registrarEstado(alertas: Alerta[], param: keyof typeof VALORES_REFERENCIA, valor: number) {
  const ref = VALORES_REFERENCIA[param]
  const label = ref.label
  // Solo registrar como info si está en rango de referencia pero fuera del óptimo
  // (las críticas y warnings se manejan por separado arriba para algunos)
}

function generarResumen(suplementos: SuplementoRec[], alertas: Alerta[], valores: ValoresLab): string {
  const criticas = alertas.filter(a => a.tipo === 'critica').length
  const warnings = alertas.filter(a => a.tipo === 'warning').length

  let resumen = `Análisis completado. `

  if (criticas > 0) resumen += `${criticas} alerta(s) crítica(s) requieren atención inmediata. `
  if (warnings > 0) resumen += `${warnings} parámetro(s) fuera del rango óptimo. `

  if (suplementos.length === 0) {
    resumen += 'Perfil metabólico dentro de rangos óptimos. No se requiere suplementación adicional en este momento.'
  } else {
    const alta = suplementos.filter(s => s.prioridad === 'alta')
    resumen += `Se recomienda ${suplementos.length} suplemento(s). `
    if (alta.length > 0) resumen += `Prioridad alta: ${alta.map(s => s.nombre).join(', ')}.`
  }

  return resumen
}
