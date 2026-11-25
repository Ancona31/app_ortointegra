/**
 * gcalRsvp.test.ts — agenda E9: de qué asistentes se toma el «accepted».
 */
import { describe, it, expect } from 'vitest'
import { aceptaronDe, rsvpGoogleEncendido } from '@/lib/gcalRsvp'

describe('aceptaronDe', () => {
  it('excluye organizador, self, resource, needsAction, tentative y declined', () => {
    expect(aceptaronDe({ attendees: [
      { email: 'org@e.mx', organizer: true, responseStatus: 'accepted' },
      { email: 'yo@e.mx', self: true, responseStatus: 'accepted' },
      { email: 'sala@resource.calendar.google.com', resource: true, responseStatus: 'accepted' },
      { email: 'a@e.mx', responseStatus: 'needsAction' },
      { email: 'b@e.mx', responseStatus: 'tentative' },
      { email: 'c@e.mx', responseStatus: 'declined' },
      { email: ' Paciente@E.MX ', responseStatus: 'accepted' },
      { email: 'paciente@e.mx', responseStatus: 'accepted' },
      { responseStatus: 'accepted' },
      { email: 'sin-arroba', responseStatus: 'accepted' },
    ] })).toEqual(['paciente@e.mx'])
  })

  it('sin asistentes → []; como mucho 50', () => {
    expect(aceptaronDe({})).toEqual([])
    const muchos = Array.from({ length: 80 }, (_, i) => ({ email: `p${i}@e.mx`, responseStatus: 'accepted' }))
    expect(aceptaronDe({ attendees: muchos })).toHaveLength(50)
  })
})

describe('rsvpGoogleEncendido', () => {
  it('sólo con el literal «encendido»', () => {
    expect(rsvpGoogleEncendido({})).toBe(false)
    expect(rsvpGoogleEncendido({ AGENDA_RSVP_GOOGLE: '1' })).toBe(false)
    expect(rsvpGoogleEncendido({ AGENDA_RSVP_GOOGLE: 'Encendido' })).toBe(false)
    expect(rsvpGoogleEncendido({ AGENDA_RSVP_GOOGLE: 'encendido' })).toBe(true)
  })
})
