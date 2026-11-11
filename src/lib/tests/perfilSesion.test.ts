/**
 * A1.2 — el perfil sembrado desde el servidor.
 *
 * Fija tres cosas:
 *   · EL ANALIZADOR: una fila buena sale con sus 12 campos y nada más; una que
 *     no cuadra sale `null` (= no sembrar, camino de siempre).
 *   · LA CONSTANTE DE COLUMNAS: son exactamente los campos del analizador, y es
 *     la que usa `getSubscriptionState` en su rama que consulta (PERF-DT-1: el
 *     `select` del layout y el de allí tienen que ser la misma cadena).
 *   · LA SIEMBRA: tras `sembrarPerfil`, `useProfile` monta ya con el perfil y
 *     `fetchProfile` no toca la red; tras `clearProfileCache`, vuelve el camino
 *     de red y el hook monta vacío. Una siembra nueva pisa la anterior.
 *
 * `renderToString` ejecuta el inicializador de `useState` y nada más (no corre
 * efectos), que es justo lo que hay que observar: el estado del PRIMER render.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactElement } from 'react'
import { renderToString } from 'react-dom/server'
import type { SupabaseClient } from '@supabase/supabase-js'

const dobles = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClient: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({ createClient: dobles.createClient }))
vi.mock('@/lib/secureStorage', () => ({
  secureStorage: { set: dobles.set, get: dobles.get, remove: dobles.remove },
}))

import { analizarPerfilSesion, COLUMNAS_PERFIL_SESION } from '@/lib/perfil/perfilSesion'
import { getSubscriptionState } from '@/lib/subscription'
import {
  useProfile, sembrarPerfil, clearProfileCache, fetchProfile, type Profile,
} from '@/hooks/useProfile'

const FILA = {
  id: 'u-1',
  role: 'medico',
  clinica_id: 'c-1',
  cedula_profesional: '123',
  cedula_especialidad: null,
  especialidad: 'Ortopedia',
  titulo: 'Dr.',
  universidad: null,
  es_admin_de_clinica: true,
  nombres: 'Ana',
  apellido_paterno: 'Pérez',
  apellido_materno: null,
}

const PERFIL_A: Profile = { id: 'u-a', role: 'medico', es_admin_de_clinica: false }
const PERFIL_B: Profile = { id: 'u-b', role: 'secretaria', es_admin_de_clinica: false }

function Sonda(): ReactElement {
  const { profile, loading } = useProfile()
  return createElement('i', null, `${String(loading)}|${profile?.id ?? 'null'}`)
}

const primerRender = (): string => renderToString(createElement(Sonda))

describe('analizarPerfilSesion', () => {
  it('una fila completa sale con sus 12 campos y descarta las claves de más', () => {
    const perfil = analizarPerfilSesion({ ...FILA, firma_url: 'x', invitado_por: 'y' })
    expect(perfil).toEqual(FILA)
  })

  it.each([
    ['null', null],
    ['un texto', 'u-1'],
    ['un rol fuera de la lista', { ...FILA, role: 'admin' }],
    ['sin id', { ...FILA, id: undefined }],
    ['es_admin_de_clinica nulo', { ...FILA, es_admin_de_clinica: null }],
    ['un campo de texto con número', { ...FILA, nombres: 7 }],
  ])('%s → null (no sembrar)', (_nombre, fila) => {
    expect(analizarPerfilSesion(fila)).toBeNull()
  })

  it('sin la columna clinica_id → null, no un perfil sin clínica', () => {
    const sinClinica: Record<string, unknown> = { ...FILA }
    delete sinClinica.clinica_id
    expect(analizarPerfilSesion(sinClinica)).toBeNull()
  })
})

describe('COLUMNAS_PERFIL_SESION', () => {
  it('son exactamente los campos que deja pasar el analizador, en un solo orden', () => {
    const columnas = COLUMNAS_PERFIL_SESION.split(', ')
    expect(columnas).toEqual(Object.keys(FILA))
    expect(Object.keys(analizarPerfilSesion(FILA) ?? {})).toEqual(columnas)
  })

  it('getSubscriptionState sin perfil pide `profiles` con la MISMA cadena (PERF-DT-1)', async () => {
    const pedidas: string[] = []
    const consulta = {
      select: (c: string) => { pedidas.push(c); return consulta },
      eq: () => consulta,
      single: async () => ({ data: { ...FILA, clinica_id: null }, error: null }),
    }
    const supabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'u-1' } } }) },
      from: () => consulta,
    }
    // El doble cubre sólo lo que la rama recorre (mismo patrón que gcalConexion.test.ts:140).
    const estado = await getSubscriptionState(supabase as unknown as SupabaseClient)
    expect(pedidas).toEqual([COLUMNAS_PERFIL_SESION])
    expect(estado.isBlocked).toBe(false)
  })
})

describe('sembrarPerfil / clearProfileCache', () => {
  beforeEach(() => {
    clearProfileCache()
    vi.clearAllMocks()
    dobles.set.mockResolvedValue(undefined)
    dobles.get.mockResolvedValue(null)
    dobles.getUser.mockResolvedValue({ data: { user: null } })
    dobles.createClient.mockReturnValue({ auth: { getUser: dobles.getUser } })
  })

  it('sin siembra, el primer render es «cargando» (camino de siempre)', () => {
    expect(primerRender()).toBe('<i>true|null</i>')
  })

  it('con siembra, el primer render ya trae el perfil y no está cargando', () => {
    sembrarPerfil(PERFIL_A)
    expect(primerRender()).toBe('<i>false|u-a</i>')
  })

  it('con siembra, fetchProfile resuelve el perfil sin salir a la red y lo guarda cifrado', async () => {
    sembrarPerfil(PERFIL_A)
    await expect(fetchProfile()).resolves.toBe(PERFIL_A)
    expect(dobles.createClient).not.toHaveBeenCalled()
    expect(dobles.set).toHaveBeenCalledWith('cache_user_profile', PERFIL_A)
  })

  it('una siembra nueva pisa la anterior (otra sesión en la misma pestaña)', async () => {
    sembrarPerfil(PERFIL_A)
    sembrarPerfil(PERFIL_B)
    await expect(fetchProfile()).resolves.toBe(PERFIL_B)
    expect(primerRender()).toBe('<i>false|u-b</i>')
  })

  it('clearProfileCache borra la siembra: vuelve la red y el hook monta vacío', async () => {
    vi.useFakeTimers()
    try {
      sembrarPerfil(PERFIL_A)
      clearProfileCache()
      expect(primerRender()).toBe('<i>true|null</i>')
      await expect(fetchProfile()).resolves.toBeNull()
      expect(dobles.getUser).toHaveBeenCalledTimes(1)
      expect(dobles.remove).toHaveBeenCalledWith('cache_user_profile')
    } finally {
      vi.useRealTimers()
    }
  })
})
