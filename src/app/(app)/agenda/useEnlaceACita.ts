'use client'

/**
 * src/app/(app)/agenda/useEnlaceACita.ts — `/agenda?cita=<uuid>` (tanda I,
 * punto 19): el destino de un aviso pulsado FUERA de la agenda
 * (`enlaceDeAviso`). Abre esa cita en su sitio con `irACita`, la misma puerta
 * del buscador (su día en la vista Día y su tarjeta).
 *
 * Sólo con la v2 y cuando la capa de interacciones ya montó (`listas`): sin
 * ella no hay `irACita` y el parámetro espera. Corre una vez por carga y retira
 * el parámetro en todos los caminos, como el enlace de `?cita=nueva` (que no
 * se toca: un uuid no es `nueva`). Cliente de SESIÓN: la RLS decide si quien
 * mira ve la cita; si no la ve, un aviso y nada más.
 *
 * Movido aquí por tamaño (`AgendaCliente.tsx`), un solo uso.
 */
import { useEffect, useRef, type RefObject } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/Toast'
import { citaDelEnlace } from '@/lib/avisos/avisosClinica'
import type { ApiInteraccionesV2 } from '@/lib/agenda/contratosV2'
import type { CitaEncontrada } from '@/lib/agenda/buscarCitasPaciente'

function retirarParametro(): void {
  const url = new URL(window.location.href)
  url.searchParams.delete('cita')
  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function useEnlaceACita(listas: boolean, interaccionesRef: RefObject<ApiInteraccionesV2 | null>): void {
  const toast = useToast()
  const hecho = useRef(false)
  useEffect(() => {
    if (!listas || hecho.current) return
    const id = citaDelEnlace(window.location.search)
    if (!id) return
    hecho.current = true
    retirarParametro()
    createClient()
      .from('appointments')
      .select('id, title, start_time, end_time, status, medico_id, paciente_id')
      .eq('id', id)
      .maybeSingle()
      .then((res: { data: CitaEncontrada | null; error: unknown }) => {
        if (res.error) toast.info('No se pudo abrir esa cita.')
        else if (res.data) interaccionesRef.current?.irACita(res.data)
        else toast.info('No se encontró esa cita.')
      }, () => toast.info('No se pudo abrir esa cita.'))
  }, [listas, interaccionesRef, toast])
}
