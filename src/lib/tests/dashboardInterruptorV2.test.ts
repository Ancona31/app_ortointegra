/* VELOCIDAD (punto 1) · El dashboard no vuelve a leer `agenda_ajustes` en cada
   montaje. Antes el interruptor se recordaba en un `useRef` del componente, así
   que cada regreso al dashboard pagaba `agenda_ajustes` → `appointments` en
   serie. Esta prueba cuenta las lecturas: falla si alguien devuelve el recuerdo
   al componente. */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({}) }))

import { agendaV2DeClinica } from '@/components/dashboard/ProximasCitas'

/* Agenda para todos (M3): el interruptor se le pregunta a la función de la base, por RPC. */
type Respuesta = { data: boolean | null; error: { code: string } | null }
type Cliente = Parameters<typeof agendaV2DeClinica>[0]

/** Un cliente que sólo sabe contestar la lectura del interruptor, y cuenta cuántas veces se le pide. */
function clienteFalso(respuestas: Respuesta[]): { cliente: Cliente; lecturas: () => number } {
  let n = 0
  const falso = {
    rpc: async () => respuestas[Math.min(n++, respuestas.length - 1)],
  }
  return { cliente: falso as unknown as Cliente, lecturas: () => n }
}

describe('agendaV2DeClinica · una lectura por pestaña, no por montaje', () => {
  it('encendida: la segunda vez sale de memoria, sin viaje', async () => {
    const { cliente, lecturas } = clienteFalso([{ data: true, error: null }])
    expect(await agendaV2DeClinica(cliente, 'clinica-encendida')).toBe(true)
    expect(await agendaV2DeClinica(cliente, 'clinica-encendida')).toBe(true)
    expect(lecturas()).toBe(1)
  })

  it.each(['42P01', 'PGRST202', '42883'])('sin la tabla o sin la función (%s): apagada, y también se recuerda', async (code) => {
    const { cliente, lecturas } = clienteFalso([{ data: null, error: { code } }])
    expect(await agendaV2DeClinica(cliente, `clinica-sin-${code}`)).toBe(false)
    expect(await agendaV2DeClinica(cliente, `clinica-sin-${code}`)).toBe(false)
    expect(lecturas()).toBe(1)
  })

  it('apagada a propósito (la base contesta false): se recuerda', async () => {
    const { cliente, lecturas } = clienteFalso([{ data: false, error: null }])
    expect(await agendaV2DeClinica(cliente, 'clinica-apagada')).toBe(false)
    expect(await agendaV2DeClinica(cliente, 'clinica-apagada')).toBe(false)
    expect(lecturas()).toBe(1)
  })

  it('un fallo de lectura cuenta como apagado y NO se recuerda: la siguiente vuelve a preguntar', async () => {
    const { cliente, lecturas } = clienteFalso([
      { data: null, error: { code: '500' } },
      { data: true, error: null },
    ])
    expect(await agendaV2DeClinica(cliente, 'clinica-con-fallo')).toBe(false)
    expect(await agendaV2DeClinica(cliente, 'clinica-con-fallo')).toBe(true)
    expect(lecturas()).toBe(2)
  })

  it('el recuerdo es por clínica', async () => {
    const { cliente, lecturas } = clienteFalso([{ data: false, error: null }])
    await agendaV2DeClinica(cliente, 'clinica-a')
    await agendaV2DeClinica(cliente, 'clinica-b')
    expect(lecturas()).toBe(2)
  })
})
