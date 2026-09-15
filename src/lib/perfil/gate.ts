import type { Role } from '@/hooks/useProfile'

/**
 * Criterio ÚNICO de «perfil completo» — Bloque B5, primera parte.
 *
 * Función PURA: recibe datos, devuelve qué falta. Sin hooks, sin red, sin
 * caché, sin `await`. La usan cliente y servidor, y cada uno la alimenta con
 * SU propia fuente.
 *
 * ⚠️ POR QUÉ PURA, Y POR QUÉ NADIE DEBE «AHORRARSE» EL PARÁMETRO LEYENDO EL
 * CACHÉ: `useProfile` guarda el perfil en `secureStorage` y cae a esa copia
 * cuando Supabase tarda más de 3 s (src/hooks/useProfile.ts:41-57). Ese dato
 * vive en el navegador del usuario, que es quien decide qué hay dentro. Un
 * gate que lea de ahí decide sobre un dato que controla la persona a la que
 * está cerrando el paso. Por eso este archivo no importa `useProfile` salvo
 * el tipo `Role` —import de tipo, se borra al compilar, mismo precedente que
 * `src/lib/permissions.ts:18`— y no conoce ningún cliente de Supabase.
 *
 * Desde el Bloque B5 (2026-09-13) sí hay consumidores: `evaluarPerfil` se
 * alimenta en `api/me/estado-perfil/route.ts:70` y su `requiereSoporte` decide
 * cuál de las dos caras del paso «clínica» enseña `OnboardingModal.tsx:401`.
 * Esta línea decía «ninguna capa consume esto todavía», que era cierto el día
 * en que se escribió el archivo y dejó de serlo en el bloque siguiente.
 */

/** Los tres pasos, en el orden en que se le piden al usuario. */
export type PasoPerfil = 'datos_medico' | 'clinica' | 'consultorio'

/** Campos del paso 1. El orden es el de presentación. */
export type CampoMedico = 'nombres' | 'especialidad' | 'cedula_profesional'

/** Por qué a alguien no se le exige nada. */
export type MotivoExencion = 'super_admin' | 'secretaria'

/**
 * Lo que hay que darle. Nombres de columna tal cual están en `profiles`, para
 * que el servidor pueda pasar la fila del `select` sin traducir.
 */
export interface DatosPerfilGate {
  role: Role
  /**
   * Quién dio de alta a este usuario. NULL o ausente = se registró por su
   * cuenta, o sea dueño de la clínica que está por crear. La escribe
   * `api/admin/crear-usuario`, el único camino con invitador
   * (20260914_b56_trigger_aprovisionamiento.sql:360-369).
   *
   * ⚠️ AQUÍ YA NO VA `es_admin_de_clinica`, Y NO ES UN OLVIDO. Esa columna
   * significa «dueño de la clínica X» y sólo afirma algo cuando `clinica_id`
   * NO es NULL. El criterio de abajo la interrogaba justo en el estado donde
   * no afirma nada —sin clínica—, donde ni true ni false son correctos. Con
   * el trigger de B5.6 puesto eso dejó de ser teórico: todo usuario nacido de
   * Google OAuth o de un POST a `/auth/v1/signup` llega con `clinica_id` NULL
   * y el `NOT NULL DEFAULT false` del flag, y caía en el panel de soporte —un
   * modal bloqueante cuya única salida es un mailto—. El flag sigue siendo la
   * respuesta correcta a «¿puede administrar la clínica?» y de ahí no se
   * mueve (`lib/permissions.ts:98` y sus quince consumidores). Lo que este
   * gate pregunta es PROCEDENCIA, y eso lo responde `invitado_por`.
   */
  invitado_por?: string | null
  nombres?: string | null
  especialidad?: string | null
  cedula_profesional?: string | null
  clinica_id?: string | null
  /**
   * Cuántos consultorios ACTIVOS tiene (no archivados), que es el filtro con
   * el que ya cuenta el resto de la app (`api/me/config/route.ts:105`). El
   * cliente pasa `consultorios.length`; el servidor, un `count` con
   * `head: true`. Se pide el número y no un booleano porque es lo que cada
   * capa tiene a mano, y convertirlo en el sitio equivocado es cómo se cuelan
   * los archivados.
   */
  consultoriosActivos: number
}

export interface EstadoPerfil {
  /** Azúcar de `pendientes.length === 0`. Responde a «¿bloqueo?». */
  completo: boolean
  /** Lo que falta, EN ORDEN. Vacío ⟺ completo. */
  pendientes: PasoPerfil[]
  /** El primero de `pendientes`, o null. Responde a «¿qué enseño?». */
  siguiente: PasoPerfil | null
  /** Qué falta DENTRO del paso 1. Vacío si ese paso no está pendiente. */
  camposFaltantes: CampoMedico[]
  /** Motivo de exención, o null si al usuario sí se le exige. */
  exento: MotivoExencion | null
  /**
   * Hay un paso pendiente que el propio usuario NO puede resolver.
   *
   * Hoy ocurre en UN caso: alguien a quien invitó un administrador
   * (`invitado_por` no nulo) y que se quedó sin `clinica_id`. El invitado no
   * puede crear una clínica, así que enseñarle el paso «clínica» es darle un
   * formulario que tiene prohibido usar. No es hipotético:
   * `profiles_clinica_id_fkey` es ON DELETE SET NULL
   * (20260912190416_remote_schema.sql:2359), así que borrar una clínica deja a
   * sus médicos exactamente así. Se bloquea igual —sin clínica, la app entera
   * filtra por un id que no existe— pero quien consuma esto debe mandarlo a
   * soporte y no al alta de clínica.
   *
   * Quien NO tiene invitador y no tiene clínica es el caso contrario: es su
   * propia cuenta la que falta, y el formulario es exactamente lo que
   * necesita.
   */
  requiereSoporte: boolean
}

const CAMPOS_MEDICO: readonly CampoMedico[] = [
  'nombres',
  'especialidad',
  'cedula_profesional',
] as const

/**
 * Un campo de texto en blanco NO cuenta como presente. Las tres columnas son
 * `text` sin restricción en la base (…remote_schema.sql:558-574): el alta las
 * recorta (`src/lib/perfil/schemas.ts:49-67`), pero una fila vieja o escrita
 * por otra vía puede traer `' '`, y un espacio no es una cédula.
 */
function tieneValor(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.trim().length > 0
}

function exencion(motivo: MotivoExencion): EstadoPerfil {
  return {
    completo: true,
    pendientes: [],
    siguiente: null,
    camposFaltantes: [],
    exento: motivo,
    requiereSoporte: false,
  }
}

export function evaluarPerfil(datos: DatosPerfilGate): EstadoPerfil {
  /* super_admin va primero y es EXENTO A PROPÓSITO: su perfil no tiene clínica
     por diseño (verificado en producción), así que cualquier criterio que le
     exija una lo deja fuera de la app — y es la cuenta con la que se resuelven
     los incidentes. */
  if (datos.role === 'super_admin') return exencion('super_admin')

  /* secretaria: exenta, decisión que ya estaba tomada y que aquí solo se
     conserva (api/me/estado-perfil/route.ts:22-30). */
  if (datos.role === 'secretaria') return exencion('secretaria')

  /* LISTA BLANCA DE EXENTOS, NO DE EXIGIDOS: todo lo demás —hoy solo
     'medico'— cae aquí y se le pide todo. Un rol futuro nace BLOQUEADO, que
     es el fallo ruidoso; la alternativa sería colarlo entero sin que nadie lo
     hubiera decidido. Es la misma regla de `canVerAgendaCompleta`
     (src/lib/permissions.ts:91-94) con el lado seguro invertido, porque aquí
     lo seguro es exigir. */

  /* ── Paso 1 · Datos del médico ────────────────────────────────────────────
     `cedula_especialidad` NO se exige: un médico general no la tiene y
     pedirla lo dejaría fuera para siempre. `firma_url` tampoco: es su propio
     escalón y vive en otra parte.

     ⚠️ VENTANA FUTURA PENDIENTE — MARCA PERSONAL. Hoy el logo y los colores
     con los que se imprimen los documentos de un médico NO son suyos: viven
     en `clinicas.logo_url`, `clinicas.color_primario` y
     `clinicas.color_secundario` (20260912190416_remote_schema.sql:225,
     231-232), y `profiles` no tiene equivalente. Por eso un invitado imprime
     hoy con la marca de la clínica ajena a la que lo añadieron, y por eso
     aquí no se exige nada de marca. Cuando esa decisión se resuelva, este
     paso crece con los campos nuevos o nace un cuarto paso junto a él.
     NO SE CONSTRUYE NADA DE ESO AHORA: esta nota existe para que quien lo
     retome sepa que el hueco es conocido y no un olvido. */
  const camposFaltantes = CAMPOS_MEDICO.filter((campo) => !tieneValor(datos[campo]))

  const pendientes: PasoPerfil[] = []
  if (camposFaltantes.length > 0) pendientes.push('datos_medico')

  /* ── Paso 2 · Clínica (la cuenta) ───────────────────────────────────────── */
  const sinClinica = !tieneValor(datos.clinica_id)
  if (sinClinica) pendientes.push('clinica')

  /* ── Paso 3 · Consultorio (el lugar físico) ──────────────────────────────
     Vale para los dos: el invitado no crea clínicas, pero sí sus propios
     consultorios. La comparación va en negativo (`!(n >= 1)`) para que un
     NaN —un `count` que no llegó y se convirtió mal— caiga en «falta» y no en
     «lo tiene». */
  if (!(datos.consultoriosActivos >= 1)) pendientes.push('consultorio')

  /* `tieneValor` y no `!= null`, por lo mismo que `clinica_id` doce líneas
     arriba: las dos llegan por JSON desde un `select`, y un '' o un '  ' no es
     un invitador. De paso cubre el `undefined` de quien no manda el campo, que
     es el lado al que hay que fallar —formulario de más, nunca encierro—. */
  const fueInvitado = tieneValor(datos.invitado_por)

  return {
    completo: pendientes.length === 0,
    pendientes,
    siguiente: pendientes[0] ?? null,
    camposFaltantes,
    exento: null,
    requiereSoporte: sinClinica && fueInvitado,
  }
}
