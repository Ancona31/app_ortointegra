/**
 * Zonas horarias de México para consultorios Spinus.
 *
 * - 12 entradas con value único (IANA) y label descriptivo.
 * - México NO observa DST desde 2022 EXCEPTO franja fronteriza norte
 *   (Tijuana, Matamoros, Cd. Juárez, Ojinaga) que sigue reglas USA y
 *   adelanta 1h en verano. Los UTC mostrados son los de horario estándar
 *   (invierno).
 * - Ordenado por offset UTC descendente (oeste → este).
 *
 * Usado en:
 * - PrimerConsultorioModal (F3-4, onboarding bloqueante)
 * - EditConsultorioModal (F3-5, edición desde perfil)
 */

export type ZonaConsultorio = {
  /** String IANA persistido en BD (validado por timezoneSchema con Intl.supportedValuesOf) */
  value: string
  /** Display al usuario en select/chips */
  label: string
}

/**
 * 3 zonas más comunes mostradas como chips rápidos arriba del select.
 * Cubren ~85% de los casos. Quien necesite otra zona usa el select debajo.
 */
export const CHIPS_RAPIDOS: ZonaConsultorio[] = [
  { value: 'America/Mexico_City', label: 'Centro (UTC-6)' },
  { value: 'America/Cancun',      label: 'Cancún (UTC-5)' },
  { value: 'America/Tijuana',     label: 'Tijuana (UTC-8)' },
]

/**
 * 12 zonas IANA de México con labels descriptivos.
 * Cada value es único — no hay duplicados.
 */
export const ZONAS_MEXICO: ZonaConsultorio[] = [
  // UTC-8
  { value: 'America/Tijuana',         label: 'Baja California — Tijuana, Ensenada, Mexicali (UTC-8)' },

  // UTC-7
  { value: 'America/Mazatlan',        label: 'Sinaloa, BCS y Nayarit interior — Mazatlán, La Paz, Los Cabos, Tepic (UTC-7)' },
  { value: 'America/Hermosillo',      label: 'Sonora — Hermosillo, Ciudad Obregón (UTC-7)' },

  // UTC-6
  { value: 'America/Mexico_City',     label: 'Centro — CDMX, Jalisco, Edomex, Puebla, Veracruz, Oaxaca y mayoría (UTC-6)' },
  { value: 'America/Merida',          label: 'Yucatán — Mérida, Valladolid (UTC-6)' },
  { value: 'America/Monterrey',       label: 'Nuevo León, Coahuila y Tamaulipas interior — Monterrey, Saltillo (UTC-6)' },
  { value: 'America/Matamoros',       label: 'Tamaulipas frontera — Matamoros, Reynosa, Nuevo Laredo (UTC-6)' },
  { value: 'America/Chihuahua',       label: 'Chihuahua — capital y zona centro (UTC-6)' },
  { value: 'America/Ojinaga',         label: 'Chihuahua — Ojinaga (UTC-6)' },
  { value: 'America/Ciudad_Juarez',   label: 'Chihuahua — Ciudad Juárez (UTC-6)' },
  { value: 'America/Bahia_Banderas',  label: 'Nayarit — Bahía de Banderas, Punta Mita (UTC-6)' },

  // UTC-5
  { value: 'America/Cancun',          label: 'Quintana Roo — Cancún, Playa, Tulum (UTC-5)' },
]
