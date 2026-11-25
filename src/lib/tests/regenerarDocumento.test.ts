/**
 * regenerarDocumento.test.ts — AG-DT-276. «Regenerar PDF» de la pestaña
 * Documentos (`PanelDocumentos.tsx`).
 *
 * El defecto: el médico de la cabecera salía de `localStorage`
 * (`spinus_doctor_profile`). Sin esa caché el PDF salía sin nombre, cédula ni
 * firma y AUN ASÍ sustituía a `documentos.pdf_url`.
 *
 * Lo que se exige aquí:
 *   1. el médico se lee del servidor (`/api/me/perfil-medico`, la misma fuente
 *      que la emisión), aunque la caché esté vacía o diga otra cosa;
 *   2. sin perfil, o sin nombre o sin cédula profesional, NO se compone, NO se
 *      sube y NO se toca `pdf_url`, y se dice;
 *   3. si quien regenera no es quien emitió, tampoco: su perfil no es el del
 *      documento.
 *
 * Datos ficticios. Sin red: `fetch`, `generarPdf` y Supabase van simulados.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const generarPdf = vi.fn()
const actualizar = vi.fn()

vi.mock('@/lib/mobileShare', () => ({
  generarPdf: (...a: unknown[]) => generarPdf(...a),
  puedeComponer: () => true,
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: () => ({
      update: (fila: unknown) => ({
        eq: async (_c: string, id: string) => { actualizar(fila, id); return { error: null } },
      }),
    }),
  }),
}))
vi.mock('@/hooks/useProfile', () => ({ useProfile: () => ({ profile: null }) }))

import { regenerarDocumento } from '@/components/expediente/PanelDocumentos'

const AUTOR = '00000000-0000-4000-8000-000000000276'

const DOC = {
  id: 'doc-276',
  paciente_id: 'pac-276',
  tipo: 'escrito_medico' as const,
  contenido: { paciente: 'Paciente Ficticio', asunto: 'Constancia', cuerpo: '<p>Texto</p>' },
  formato_version: 2 as const,
  folio: null,
  subido_por: AUTOR,
}

const PERFIL_SERVIDOR = {
  nombre: 'Dr. Médico Ficticio Prueba',
  titulo: 'Dr.',
  nombres: 'Médico Ficticio',
  apellido_paterno: 'Prueba',
  apellido_materno: null,
  especialidad: 'Ortopedia',
  cedula_profesional: '0000276',
  cedula_especialidad: '0000277',
  universidad: 'Universidad Ficticia',
  logo_url: null,
  firma_url: 'https://ejemplo.invalid/firma.png',
  color_primario: '#1a3a5c',
  color_secundario: '#1e5fa8',
  direccion_consultorio: 'Calle Ficticia 1',
  telefono_consultorio: '0000000000',
}

function cacheLocal(valor: string | null): void {
  vi.stubGlobal('localStorage', {
    getItem: () => valor,
    setItem: () => undefined,
    removeItem: () => undefined,
  })
}

function servidor(medico: Record<string, unknown> | null, ok = true): void {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => ({ medico }) })))
}

beforeEach(() => {
  generarPdf.mockReset()
  actualizar.mockReset()
  generarPdf.mockResolvedValue({ blob: null, storagePath: 'pac-276/nuevo.pdf' })
  cacheLocal(null)
})

describe('regenerarDocumento (AG-DT-276)', () => {
  it('con la caché del navegador VACÍA compone con el médico del servidor y guarda', async () => {
    servidor(PERFIL_SERVIDOR)
    const r = await regenerarDocumento(DOC, AUTOR)
    expect(generarPdf).toHaveBeenCalledTimes(1)
    const { medico } = generarPdf.mock.calls[0][0] as { medico: Record<string, unknown> | null }
    expect(medico?.nombre).toBe('Dr. Médico Ficticio Prueba')
    expect(medico?.cedula_profesional).toBe('0000276')
    expect(medico?.firma_url).toBe('https://ejemplo.invalid/firma.png')
    expect(actualizar).toHaveBeenCalledWith({ pdf_url: 'pac-276/nuevo.pdf' }, 'doc-276')
    expect(r.guardado).toBe(true)
  })

  it('la caché del navegador no manda: con otra caché, el médico sigue siendo el del servidor', async () => {
    cacheLocal(JSON.stringify({ ...PERFIL_SERVIDOR, nombre: 'Dr. Caché Vieja', cedula_profesional: '9999999' }))
    servidor(PERFIL_SERVIDOR)
    await regenerarDocumento(DOC, AUTOR)
    const { medico } = generarPdf.mock.calls[0][0] as { medico: Record<string, unknown> | null }
    expect(medico?.nombre).toBe('Dr. Médico Ficticio Prueba')
    expect(medico?.cedula_profesional).toBe('0000276')
  })

  it.each([
    ['el servidor no da perfil', null, true],
    ['el servidor responde con error', PERFIL_SERVIDOR, false],
    ['el perfil no tiene cédula profesional', { ...PERFIL_SERVIDOR, cedula_profesional: '' }, true],
    ['el perfil no tiene nombre', { ...PERFIL_SERVIDOR, nombre: 'Dr.', nombres: null, apellido_paterno: null }, true],
  ])('si %s, NO compone, NO toca pdf_url y lo dice', async (_caso, medico, ok) => {
    servidor(medico, ok)
    const r = await regenerarDocumento(DOC, AUTOR)
    expect(generarPdf).not.toHaveBeenCalled()
    expect(actualizar).not.toHaveBeenCalled()
    expect(r.guardado).toBe(false)
    expect(r.aviso).toMatch(/no se regeneró/i)
  })

  it('si la petición del perfil falla por red, tampoco compone', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('sin red') }))
    const r = await regenerarDocumento(DOC, AUTOR)
    expect(generarPdf).not.toHaveBeenCalled()
    expect(actualizar).not.toHaveBeenCalled()
    expect(r.guardado).toBe(false)
  })

  it('si quien regenera no es quien emitió, no pone SU perfil en la cabecera', async () => {
    servidor(PERFIL_SERVIDOR)
    const r = await regenerarDocumento(DOC, '00000000-0000-4000-8000-0000000000ff')
    expect(generarPdf).not.toHaveBeenCalled()
    expect(actualizar).not.toHaveBeenCalled()
    expect(r.aviso).toMatch(/médico que emitió/i)
  })
})
