/**
 * B13 · AG5 (CALMA §29.3–§29.4) · La alerta de confirmación de la agenda v2 (`ConfirmModal` con
 * `verbo`): la pregunta como título, el resto como mensaje, el principal con su verbo y «Volver» al
 * cancelar algo. Sin `verbo` (agenda con la v2 apagada, configuración), la de siempre, intacta.
 *
 * MUTACIONES (comprobadas en rojo):
 *   · `partirPregunta` que devuelve el texto entero como título → «la pregunta, delante o detrás»;
 *   · el principal con «Aceptar» fijo → «verbo y Volver»;
 *   · `aria-labelledby` sólo con el título → «el nombre es el texto entero».
 */
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { partirPregunta } from '@/components/agenda/ConfirmModal'

vi.mock('@/components/ui/Portal', () => ({ default: ({ children }: { children: unknown }) => children }))

const { default: ConfirmModal } = await import('@/components/agenda/ConfirmModal')

describe('partirPregunta', () => {
  it('la pregunta, delante o detrás, es el título; el resto, el mensaje', () => {
    expect(partirPregunta('¿Cancelar la cita de Ana Prueba? El horario queda libre.'))
      .toEqual({ titulo: '¿Cancelar la cita de Ana Prueba?', resto: 'El horario queda libre.' })
    expect(partirPregunta('Vas a agendar a las 20:00, y esta clínica atiende de 08:00 a 20:00. ¿Es correcto?'))
      .toEqual({ titulo: '¿Es correcto?', resto: 'Vas a agendar a las 20:00, y esta clínica atiende de 08:00 a 20:00.' })
    expect(partirPregunta('Se empalma con «Paciente Prueba 07» (17:00–17:30). ¿Guardar de todos modos?'))
      .toEqual({ titulo: '¿Guardar de todos modos?', resto: 'Se empalma con «Paciente Prueba 07» (17:00–17:30).' })
  })
  it('sin pregunta, el texto entero es el título', () => {
    expect(partirPregunta('No se puede.')).toEqual({ titulo: 'No se puede.', resto: '' })
  })
})

describe('ConfirmModal', () => {
  const nada = (): void => {}
  it('con verbo: título, mensaje, «Volver» y el verbo; el nombre es el texto entero', () => {
    const html = renderToStaticMarkup(
      <ConfirmModal message="¿Cancelar la cita de Ana? El horario queda libre." verbo="Cancelar cita" secundario="Volver" icono="cancelar"
        onConfirm={nada} onCancel={nada} />,
    )
    expect(html).toContain('>¿Cancelar la cita de Ana?</h2>')
    expect(html).toContain('>El horario queda libre.</p>')
    expect(html).toMatch(/>Volver<\/button>.*>Cancelar cita<\/button>/)
    expect(html).not.toContain('Aceptar')
    const nombre = html.match(/aria-labelledby="([^"]+)"/)?.[1] ?? ''
    expect(nombre.split(' ')).toHaveLength(2)
  })
  it('sin verbo: la de siempre, «Cancelar» / «Aceptar», con el mensaje entero', () => {
    const html = renderToStaticMarkup(<ConfirmModal message="¿Seguro? Algo." onConfirm={nada} onCancel={nada} />)
    expect(html).toContain('>¿Seguro? Algo.</p>')
    expect(html).toMatch(/>Cancelar<\/button>.*>Aceptar<\/button>/)
  })
})
