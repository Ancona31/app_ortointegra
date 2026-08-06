/**
 * ⚠️ RUTA TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Taller de componentes del chasis de documentos v2: `/super-admin/dashboard/taller-v2`.
 *
 * Vive aquí por la autorización: el layout de `super-admin/dashboard` ya valida
 * en el servidor sesión + `role = 'super_admin'` y redirige si no cumple, así que
 * esta página no necesita —ni debe— reimplementar el guard. No está enlazada en
 * el sidebar a propósito: se llega por URL y desaparece sin dejar rastro en la
 * navegación.
 *
 * Es una herramienta de desarrollo. No lee ni escribe base de datos ni Storage,
 * no toca el renderer v1 ni el flujo del médico.
 */

import type { Metadata } from 'next'
import type { ReactElement } from 'react'
import TallerV2 from '@/components/taller-v2/TallerV2'

export const metadata: Metadata = {
  title: 'Taller de componentes v2 — Spinus®',
}

export default function TallerV2Page(): ReactElement {
  return <TallerV2 />
}
