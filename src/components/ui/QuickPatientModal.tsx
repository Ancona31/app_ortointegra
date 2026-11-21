'use client'

import { useState, useRef, useEffect, useId, useCallback, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, X, Loader2 } from 'lucide-react'
import Portal from '@/components/ui/Portal'
import { useArrastreHoja } from '@/components/ui/ModalShell'
import { leerFormato } from '@/lib/formatoPantalla'
import { useProfile } from '@/hooks/useProfile'
import { secureStorage } from '@/lib/secureStorage'
import { toTitleCase, calcularEdad, fechaHoyISO, FECHA_MIN_NACIMIENTO, edadAFechaFicticia } from '@/lib/patientUtils'
import { componerNombreMedicoCompleto } from '@/lib/nombreMedico'
import { validarTelefono, formatearTelefono } from '@/lib/validaciones'
import type { DuplicatePatientResponse } from '@/types'

type PacienteBusqueda = { id: string; nombre: string; apellidos: string; telefono: string | null }
type Medico = { id: string; titulo: string | null; nombres: string | null; apellido_paterno: string | null; apellido_materno: string | null; especialidad: string | null }

const MEDICOS_CACHE_KEY = 'cache_medicos_clinica'

/**
 * H3 (punto 13, agenda v2) · «Teléfono celular o WhatsApp», opcional, con el
 * formato y la validación de la ficha del paciente (`formatearTelefono`,
 * `validarTelefono`: 10 dígitos, «999 123 4567»), y debajo de correo y
 * teléfono la leyenda de por qué conviene darlos. Va al mismo campo de la
 * ficha (`pacientes.telefono`) por el mismo camino que el correo.
 */
function CampoTelefono({ valor, alCambiar }: { valor: string; alCambiar: (v: string) => void }): ReactElement {
  const id = useId()
  const error = valor ? validarTelefono(valor) : null
  return (
    <>
      <div className="k-campo-g">
        <label htmlFor={id} className="k-etiqueta">Teléfono celular o WhatsApp</label>
        <input id={id} type="tel" inputMode="numeric" autoComplete="tel" value={valor} maxLength={12}
          onChange={e => alCambiar(formatearTelefono(e.target.value))} placeholder="opcional · 999 123 4567" className="k-campo"
          aria-invalid={error ? true : undefined} />
        {error && <p className="k-campo-error">{error}</p>}
      </div>
      <p className="k-campo-ayuda">
        Sin teléfono ni correo no se podrán enviar confirmaciones ni recordatorios de cita.
      </p>
    </>
  )
}

export default function QuickPatientModal({
  nombreInicial,
  emailInicial = '',
  telefonoInicial = '',
  conTelefono = false,
  onCreated,
  onClose,
}: {
  nombreInicial: string
  /* D7 de la agenda: el correo de quien reservó por enlace, al ligar su cita.
     Sólo precarga el campo; se puede borrar y no salta el consentimiento. */
  emailInicial?: string
  /* Tanda J (punto 7): el teléfono que dejó quien reservó, al registrarlo desde
     «Ligar e iniciar consulta». Sólo precarga el campo (con `conTelefono`), con
     el formato de la ficha; se puede cambiar o borrar. */
  telefonoInicial?: string
  /* H3 (punto 13): el teléfono y su leyenda. Sólo la agenda v2 lo enciende;
     el resto de la app (Documentos, la agenda apagada) sigue como estaba. */
  conTelefono?: boolean
  onCreated: (p: PacienteBusqueda) => void
  onClose: () => void
}) {
  const router = useRouter()
  const { profile } = useProfile()
  const isSecretaria = profile?.role === 'secretaria'
  const esMedicoInvitado = profile?.role === 'medico' && profile?.es_admin_de_clinica !== true
  const partes = nombreInicial.trim().split(' ')
  const [nombre,    setNombre]    = useState(partes[0] ?? '')
  const [apellidos, setApellidos] = useState(partes.slice(1).join(' '))
  const [fechaNac,  setFechaNac]  = useState('')
  const [edad,      setEdad]      = useState('')
  const [email,     setEmail]     = useState(emailInicial)
  const [telefono,  setTelefono]  = useState(() => (conTelefono ? formatearTelefono(telefonoInicial) : ''))
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')
  const [consentimiento, setConsentimiento] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{ id: string; nombre: string; apellidos: string; numero_expediente: string | null; existingPatientIsMine: boolean } | null>(null)
  const [vincularError, setVincularError] = useState<string | null>(null)
  const [vinculando, setVinculando] = useState(false)
  const [medicoSeleccionado, setMedicoSeleccionado] = useState('')
  const [medicos, setMedicos] = useState<Medico[]>([])
  const forceCreateRef = useRef(false)

  const edadInfo = fechaNac ? calcularEdad(fechaNac) : null
  const panelRef = useRef<HTMLDivElement | null>(null)
  const veloRef = useRef<HTMLDivElement | null>(null)
  const puedeArrastrar = useCallback(() => leerFormato() === 'tel', [])
  const alPulsar = useArrastreHoja(panelRef, veloRef, puedeArrastrar, onClose)

  // Cargar lista de médicos (secretaria) — red primero, cache como fallback
  useEffect(() => {
    if (!isSecretaria) return

    let cancelled = false

    async function cargarMedicos() {
      try {
        const r = await fetch('/api/clinica/medicos')
        if (!r.ok) throw new Error('fetch failed')
        const { medicos: lista } = await r.json() as { medicos: Medico[] }
        if (cancelled) return
        const rows = lista || []
        setMedicos(rows)
        secureStorage.set(MEDICOS_CACHE_KEY, rows).catch(() => {})
      } catch {
        try {
          const cached = await secureStorage.get<Medico[]>(MEDICOS_CACHE_KEY)
          if (!cancelled && Array.isArray(cached)) setMedicos(cached)
        } catch {
          // silencioso
        }
      }
    }

    cargarMedicos()
    return () => { cancelled = true }
  }, [isSecretaria])

  async function handleCreate() {
    if (!nombre.trim() || !apellidos.trim()) {
      setError('Nombre y apellidos son requeridos.')
      return
    }
    if (!consentimiento) {
      setError('Debes marcar el consentimiento del aviso de privacidad.')
      return
    }
    if (isSecretaria && !medicoSeleccionado) {
      setError('Debes seleccionar un médico para asignar el paciente')
      return
    }
    const telefonoLimpio = conTelefono ? telefono.trim() : ''
    const errorTelefono = validarTelefono(telefonoLimpio)
    if (errorTelefono) {
      setError(errorTelefono)
      return
    }
    setSaving(true)
    setError('')

    const nombreLimpio = toTitleCase(nombre)
    const apellidosLimpio = toTitleCase(apellidos)

    // Resolver fecha_nacimiento priorizando fecha explícita sobre edad
    let fecha_nacimiento: string | null = null
    if (fechaNac) {
      fecha_nacimiento = fechaNac
    } else if (edad.trim()) {
      const edadNum = parseInt(edad, 10)
      if (!isNaN(edadNum) && edadNum >= 0 && edadNum <= 120) {
        fecha_nacimiento = edadAFechaFicticia(edadNum)
      }
    }

    try {
      const res = await fetch('/api/pacientes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          nombre: nombreLimpio,
          apellidos: apellidosLimpio,
          fecha_nacimiento,
          email: email.trim() || null,
          ...(telefonoLimpio ? { telefono: telefonoLimpio } : {}),
          consentimiento_otorgado: true,
          ...(isSecretaria ? { medico_id: medicoSeleccionado } : {}),
          ...(forceCreateRef.current ? { forceCreate: true } : {}),
        }),
      })
      const data = await res.json() as Record<string, unknown>

      if (res.status === 409 && data.error === 'DUPLICATE_PATIENT') {
        const dupData = data as unknown as DuplicatePatientResponse
        setDuplicateWarning({
          id: dupData.existingPatient.id,
          nombre: dupData.existingPatient.nombre,
          apellidos: dupData.existingPatient.apellidos,
          numero_expediente: dupData.existingPatient.numero_expediente,
          existingPatientIsMine: (dupData.existingPatientIsMine ?? false),
        })
        setSaving(false)
        return
      }

      if (!res.ok) { setError((data.message as string) ?? (data.error as string) ?? 'Error al crear paciente'); setSaving(false); return }
      onCreated({ id: (data.id as string) ?? '', nombre: nombreLimpio, apellidos: apellidosLimpio, telefono: telefonoLimpio || null })
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
      setSaving(false)
    }
  }

  async function handleVincular() {
    if (!duplicateWarning) return
    setVinculando(true)
    setVincularError(null)
    try {
      const res = await fetch(`/api/pacientes/${duplicateWarning.id}/vincular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSecretaria ? { medico_id: medicoSeleccionado } : {}),
      })
      if (!res.ok) {
        setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
        setVinculando(false)
        return
      }
      // Doble rol (§7): el callback decide (navegar o adjuntar a la cita en agenda)
      onCreated({ id: duplicateWarning.id, nombre: duplicateWarning.nombre, apellidos: duplicateWarning.apellidos, telefono: null })
    } catch {
      setVincularError('No se pudo conectar con el servidor. Verifica tu conexión e intenta de nuevo.')
      setVinculando(false)
    }
  }

  const textoDuplicado = duplicateWarning && (
    duplicateWarning.existingPatientIsMine
      ? `Este paciente ya está en tu lista de pacientes: ${duplicateWarning.nombre} ${duplicateWarning.apellidos}${duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}`
      : esMedicoInvitado
        ? `Este paciente ya está registrado en tu clínica, pero no aparece en tu lista porque aún no es tu paciente: ${duplicateWarning.nombre} ${duplicateWarning.apellidos}${duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}. ¿Deseas vincularlo a tus pacientes?`
        : `Ya existe un paciente con los mismos datos: ${duplicateWarning.nombre} ${duplicateWarning.apellidos}${duplicateWarning.numero_expediente ? ` (Exp. #${duplicateWarning.numero_expediente})` : ''}. ¿Es el mismo paciente o una persona distinta?`
  )

  /* Capa del catálogo (rediseño B3; `.k-capa` de `sistema.css`): modal con
     formulario; en teléfono, hoja desde abajo que se arrastra para cerrar.
     ⚠️ LA RAÍZ SIGUE SIENDO UN `div.fixed` CON EL <h2> «Registrar paciente»
     DENTRO: así lo buscan las e2e de la agenda (`registro(page)`). Y el
     `label` va justo antes de su `input` (`label:text-is("Nombre") + input`).
     ⚠️ SIN SALIDA ANIMADA, a propósito: quien la monta la desmonta al cerrar,
     y el escudo contra el doble clic (`useEscudoTrasRegistro`, en quien la
     monta) cuenta con que desaparezca en el acto.
     «Paciente duplicado» es la alerta del catálogo dentro de la misma capa
     (CALMA §20, §23.7): tres botones apilados, el principal arriba. Lo escrito
     se conserva: «Cancelar» vuelve al formulario. */
  return (
    <Portal>
    <div className="k-capa fixed inset-0 z-[70]" data-fase="abierta" data-modo={duplicateWarning ? undefined : 'hoja'}
      data-variante={duplicateWarning ? 'alerta' : undefined}>
      <div ref={veloRef} className="k-velo" onClick={onClose} />
      <div ref={panelRef} className="k-capa-panel max-w-[440px]" lang="es" onPointerDown={duplicateWarning ? undefined : alPulsar}>
        {duplicateWarning ? (
          <div className="k-al">
            <span className="k-al-i k-al-i-avisar" aria-hidden="true"><AlertTriangle /></span>
            <h2 className="k-al-tit">Paciente duplicado</h2>
            <div className="k-al-t">
              <p>{textoDuplicado}</p>
              <p>Si es otra persona, se creará el registro de todos modos.</p>
              {vincularError && <p className="k-campo-error">{vincularError}</p>}
            </div>
            <div className="k-al-b k-al-pila">
              {duplicateWarning.existingPatientIsMine ? (
                <button
                  type="button" data-principal
                  onClick={() => router.push(isSecretaria ? '/dashboard' : `/expediente/${duplicateWarning.id}`)}
                  className="k-b k-b-capa k-b-prim"
                >
                  Ir a su expediente
                </button>
              ) : (
                <button type="button" data-principal onClick={handleVincular} disabled={vinculando} className="k-b k-b-capa k-b-prim">
                  {vinculando ? <><Loader2 size={16} className="animate-spin" /> Vinculando...</> : 'Es el mismo paciente'}
                </button>
              )}
              <button
                type="button"
                disabled={vinculando}
                onClick={() => {
                  setDuplicateWarning(null)
                  setVincularError(null)
                  forceCreateRef.current = true
                  handleCreate()
                }}
                className="k-b k-b-capa k-b-tonal"
              >
                Es otra persona
              </button>
              <button
                type="button"
                disabled={vinculando}
                onClick={() => { setDuplicateWarning(null); setVincularError(null) }}
                className="k-b k-b-capa k-b-quieto"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="k-capa-asa" aria-hidden="true" />
            <div className="k-capa-cab">
              <div className="k-capa-tits"><h2 className="k-capa-tit">Registrar paciente</h2></div>
              <button type="button" onClick={onClose} className="k-b k-b-icono" aria-label="Cerrar"><X aria-hidden="true" /></button>
            </div>
            <div className="k-capa-cuerpo">
              <div className="px-6 pt-2 pb-5 ext:px-5 flex flex-col gap-3.5">
                {error && <p className="k-campo-error">{error}</p>}

                {isSecretaria && (
                  <div className="k-campo-g">
                    <label className="k-etiqueta">
                      Médico responsable <span className="text-mal-tinta">*</span>
                    </label>
                    <select value={medicoSeleccionado} onChange={e => setMedicoSeleccionado(e.target.value)} required className="k-campo">
                      <option value="">Seleccionar médico...</option>
                      {medicos.map(m => (
                        <option key={m.id} value={m.id}>
                          {componerNombreMedicoCompleto(m)}{m.especialidad ? ` — ${m.especialidad}` : ''}
                        </option>
                      ))}
                    </select>
                    {medicos.length === 0 && (
                      <p className="k-campo-ayuda text-aviso-tinta">
                        No hay médicos disponibles. Si estás sin conexión, conéctate al menos una vez para sincronizar la lista.
                      </p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="k-campo-g">
                    <label className="k-etiqueta">Nombre</label>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} autoFocus className="k-campo" />
                  </div>
                  <div className="k-campo-g">
                    <label className="k-etiqueta">Apellidos</label>
                    <input value={apellidos} onChange={e => setApellidos(e.target.value)} className="k-campo" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="k-campo-g">
                    <label className="k-etiqueta">Fecha de nacimiento</label>
                    <input type="date" value={fechaNac} onChange={e => setFechaNac(e.target.value)}
                      min={FECHA_MIN_NACIMIENTO} max={fechaHoyISO()} className="k-campo" />
                    {edadInfo && <p className="k-campo-ayuda">{edadInfo.textoElegante}</p>}
                  </div>
                  <div className="k-campo-g">
                    <label className="k-etiqueta">Edad (opcional)</label>
                    <input type="number" min={0} max={120} value={edad} onChange={e => setEdad(e.target.value)}
                      placeholder="Ej. 35" className="k-campo" />
                    <p className="k-campo-ayuda">Si no conoces la fecha exacta, ingresa solo la edad</p>
                  </div>
                </div>

                <div className="k-campo-g">
                  <label className="k-etiqueta">Correo</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="opcional" className="k-campo" />
                </div>

                {conTelefono && <CampoTelefono valor={telefono} alCambiar={setTelefono} />}

                <p className="k-campo-ayuda">El expediente completo se puede editar después desde Pacientes.</p>

                {/* La casilla a la DERECHA de su texto (CALMA §20). */}
                <label className="flex items-center gap-3 cursor-pointer min-h-11">
                  <span className="flex-1 text-[13px] leading-[18px] text-tinta2">
                    Paciente informado del{' '}
                    <a href="/privacidad" target="_blank" rel="noopener noreferrer" className="font-semibold text-enlace hover:underline">
                      aviso de privacidad
                    </a>
                  </span>
                  <input type="checkbox" checked={consentimiento} onChange={e => setConsentimiento(e.target.checked)}
                    className="size-5 flex-none accent-[var(--accion)]" />
                </label>
              </div>
            </div>

            <div className="k-capa-pie flex justify-end gap-2 px-6 pt-3 pb-5 ext:px-4 ext:pb-4 tel:px-5">
              <button type="button" onClick={onClose} disabled={saving} className="k-b k-b-capa k-b-quieto ext:flex-auto tel:flex-auto">Cancelar</button>
              <button type="button" onClick={handleCreate} disabled={saving || vinculando} className="k-b k-b-capa k-b-prim ext:flex-auto tel:flex-auto">
                {saving ? <><Loader2 size={16} className="animate-spin" /> Registrando...</> : 'Crear y continuar'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
    </Portal>
  )
}
