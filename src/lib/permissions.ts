/**
 * Helpers semánticos de chequeo de rol del usuario.
 *
 * Reemplaza patrones legacy distribuidos en el repo como:
 *   - ['admin', 'super_admin'].includes(role)
 *   - role === 'admin'
 *   - profile?.role === 'medico' && profile?.es_admin_de_clinica
 *
 * Modelo de roles (post-refactor de Etapa 4):
 *   - super_admin: administrador global de plataforma Spinus
 *   - medico + es_admin_de_clinica=true: dueño/admin de su clínica
 *   - medico + es_admin_de_clinica=false: médico invitado (sin privilegios admin)
 *   - secretaria: personal operativo de la clínica
 *
 * Referencia: ROLES_POST_REFACTOR.md sección 1 y apéndice SECURITY DEFINER.
 */

import type { Profile } from '@/hooks/useProfile'

/**
 * Tipo input flexible para chequeos de rol.
 *
 * Acepta Profile completo, un Pick parcial (útil en server-side donde solo se
 * seleccionan algunos campos), o null/undefined (fail-closed: helpers retornan
 * false para nullable).
 */
type RoleCheck = Pick<Profile, 'role' | 'es_admin_de_clinica'> | null | undefined

/**
 * True si el usuario es super_admin (administrador global de plataforma).
 *
 * Nota: super_admin opera EXCLUSIVAMENTE vía endpoints /api/super-admin/*.
 * NO accede a endpoints regulares de la app médica.
 */
export function isSuperAdmin(p: RoleCheck): boolean {
  return p?.role === 'super_admin'
}

/**
 * True si el usuario tiene role='medico' (sin importar si es admin de clínica o invitado).
 *
 * Útil para endpoints/UI que aplican a CUALQUIER médico (creación de pacientes,
 * consultas, documentos, etc.) sin distinguir entre admin e invitado.
 */
export function isMedico(p: RoleCheck): boolean {
  return p?.role === 'medico'
}

/**
 * True si el usuario es secretaria.
 */
export function isSecretaria(p: RoleCheck): boolean {
  return p?.role === 'secretaria'
}

/**
 * True si el usuario es admin de su clínica (medico + es_admin_de_clinica=true).
 *
 * Tiene acceso CRUD completo a TODOS los pacientes, consultas, documentos,
 * mediciones, calculadora y citas de su clínica por responsabilidad legal
 * (NOM-004, COFEPRIS, LFPDPPP).
 *
 * Reemplaza el patrón legacy ['admin', 'super_admin'] en endpoints de gestión
 * de clínica (logo, horario, stripe, billing, invitar usuarios, etc.).
 *
 * Importante: super_admin NO pasa este chequeo (su universo es separado).
 */
export function canManageClinica(p: RoleCheck): boolean {
  return p?.role === 'medico' && p?.es_admin_de_clinica === true
}

/**
 * True si el usuario es médico invitado (medico + es_admin_de_clinica=false).
 *
 * Solo ve y modifica SUS propios pacientes y datos generados (consultas,
 * documentos, mediciones, calculadora). NO ve datos generados por otros
 * médicos de la misma clínica (privacidad bidireccional, ver invariante 22).
 */
export function isMedicoInvitado(p: RoleCheck): boolean {
  return p?.role === 'medico' && p?.es_admin_de_clinica !== true
}
