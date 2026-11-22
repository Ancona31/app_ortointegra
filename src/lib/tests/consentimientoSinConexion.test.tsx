/**
 * CI-DT-17: en el búnker (sin conexión) el consentimiento no enseña «Guardar
 * borrador» ni «Firmar en este dispositivo» —los dos llaman a Supabase y sólo
 * pueden fallar— y deja «Imprimir para firmar en papel», como hoy. Render
 * estático en Node: los efectos no corren y no hay red.
 */
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useMedicoInfo', () => ({ useMedicoInfo: () => ({ medicoInfo: null, isLoading: false }) }))
vi.mock('@/contexts/ConsultorioActivoContext', () => ({ useConsultorioActivo: () => ({ consultorioActivo: null }) }))
vi.mock('@/components/ui/Toast', () => ({ useToast: () => ({ success: () => {}, error: () => {}, info: () => {} }) }))
vi.mock('@/components/documentos/PlantillasDocumento', () => ({
  usePlantillasDocumento: () => ({ panelAbierto: false, selector: null, botonGuardar: null, panel: null, dialogos: null }),
}))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red') } }))

import ConsentimientoInformadoForm from '@/components/documentos/ConsentimientoInformadoForm'

describe('consentimiento sin conexión (CI-DT-17)', () => {
  it('en el búnker: ni «Guardar borrador» ni firmar en el dispositivo; sí imprimir para papel y la denegación', () => {
    const html = renderToStaticMarkup(<ConsentimientoInformadoForm offlineMode pacienteInicial="Paciente Prueba 01" />)
    expect(html).not.toContain('Guardar borrador')
    expect(html).not.toContain('Firmar en este dispositivo')
    expect(html).toContain('Imprimir para firmar en papel')
    expect(html).toContain('Emitir denegación')
  })
  it('con red: «Guardar borrador» a la vista en el pie y «Revisar y firmar»', () => {
    const html = renderToStaticMarkup(<ConsentimientoInformadoForm pacienteInicial="Paciente Prueba 01" />)
    expect(html).toContain('Guardar borrador')
    expect(html).toContain('Revisar y firmar')
    expect(html).toContain('Imprimir para firmar en papel')
  })
})
