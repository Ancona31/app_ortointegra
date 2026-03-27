import { NextResponse } from 'next/server'

const FORMAS_ES: Record<string, string> = {
  'Oral Tablet': 'Tableta',
  'Oral Capsule': 'Cápsula',
  'Oral Solution': 'Solución oral',
  'Oral Suspension': 'Suspensión oral',
  'Oral Liquid': 'Líquido oral',
  'Injectable Solution': 'Solución inyectable',
  'Injection': 'Inyección',
  'Topical Cream': 'Crema tópica',
  'Topical Gel': 'Gel tópico',
  'Topical Ointment': 'Ungüento tópico',
  'Topical Lotion': 'Loción tópica',
  'Topical Spray': 'Spray tópico',
  'Nasal Spray': 'Spray nasal',
  'Ophthalmic Solution': 'Solución oftálmica',
  'Ophthalmic Drops': 'Gotas oftálmicas',
  'Otic Solution': 'Solución ótica',
  'Inhalation Aerosol': 'Aerosol inhalado',
  'Inhalation Powder': 'Polvo inhalado',
  'Inhalation Solution': 'Solución inhalada',
  'Sublingual Tablet': 'Tableta sublingual',
  'Extended Release Oral Tablet': 'Tableta liberación prolongada',
  'Extended Release Oral Capsule': 'Cápsula liberación prolongada',
  'Delayed Release Oral Tablet': 'Tableta cubierta entérica',
  'Chewable Tablet': 'Tableta masticable',
  'Effervescent Tablet': 'Tableta efervescente',
  'Patch': 'Parche transdérmico',
  'Transdermal Patch': 'Parche transdérmico',
  'Suppository': 'Supositorio',
  'Vaginal Cream': 'Crema vaginal',
  'Drops': 'Gotas',
}

function traducirForma(forma: string): string {
  for (const [en, es] of Object.entries(FORMAS_ES)) {
    if (forma.toLowerCase().includes(en.toLowerCase())) return es
  }
  return forma
}

function parsearNombreSCD(name: string): { principio_activo: string; dosis: string; presentacion: string } {
  // Formato: "Ibuprofen 200 MG Oral Tablet" o "Amoxicillin 250 MG / 5 ML Oral Suspension"
  // Buscar índice donde empieza el número (la dosis)
  const tokens = name.split(' ')
  const idxNum = tokens.findIndex(t => /^\d/.test(t))

  if (idxNum === -1) return { principio_activo: name, dosis: '', presentacion: '' }

  const principio_activo = tokens.slice(0, idxNum).join(' ')

  // La dosis puede ser "200 MG" o "250 MG / 5 ML"
  let idxForma = idxNum + 2 // después del número y la unidad
  // Si viene "/" después de la unidad, la dosis incluye más tokens
  if (tokens[idxForma] === '/') idxForma += 3

  const dosis = tokens.slice(idxNum, idxForma).join(' ')
  const presentacion = traducirForma(tokens.slice(idxForma).join(' '))

  return { principio_activo, dosis, presentacion }
}

type RxCandidate = { name: string; score: string }

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()

  if (!q || q.length < 2) return NextResponse.json({ resultados: [] })

  try {
    const res = await fetch(
      `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?term=${encodeURIComponent(q)}&maxEntries=20&option=0`,
      { next: { revalidate: 3600 } }
    )
    const data = await res.json()
    const candidatos: RxCandidate[] = data?.approximateGroup?.candidate || []

    // Filtrar solo nombres tipo SCD (sin marca entre corchetes []) y sin duplicados de principio activo
    const vistos = new Set<string>()
    const resultados = candidatos
      .filter(c => !c.name.includes('['))
      .map(c => parsearNombreSCD(c.name))
      .filter(r => {
        const key = `${r.principio_activo}|${r.dosis}|${r.presentacion}`
        if (vistos.has(key)) return false
        vistos.add(key)
        return true
      })
      .slice(0, 8)

    return NextResponse.json({ resultados })
  } catch {
    return NextResponse.json({ resultados: [] })
  }
}
