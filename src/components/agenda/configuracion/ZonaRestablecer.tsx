'use client'

/**
 * «Restablecer configuración de la agenda» (tanda H, punto 10 de Angel): la
 * zona de peligro, última pestaña de la configuración, SÓLO para quien
 * administra la clínica (la monta `ConfiguracionCalendario` sólo con
 * `puedeAdministrar`; quien decide es `POST /api/agenda/restablecer`).
 *
 * Confirmación fuerte: un diálogo que dice qué se borra y qué NO, avisa de que
 * los enlaces ya compartidos con pacientes dejarán de funcionar, y no deja
 * seguir hasta escribir la palabra `RESTABLECER` (la misma que exige la ruta).
 * Al terminar, `alRestablecer` relee todo: «Primeros pasos» vuelve a pedir la
 * duración y el enlace. El horario de cada consultorio vuelve al de partida de
 * la agenda v2 (el de la clínica, copiado como suyo: la herencia de G4; ver
 * §6-bis, integración de la tanda H). Texto PENDIENTE DE REVISIÓN de Angel.
 */
import { useState } from 'react'
import TarjetaSeccion from '@/components/agenda/configuracion/TarjetaSeccion'
import ConfirmacionRestablecer, { SE_RESTABLECE } from '@/components/agenda/configuracion/ConfirmacionRestablecer'
import { BOTON_PELIGRO } from '@/components/agenda/configuracion/clasesConfig'
import { useToast } from '@/components/ui/Toast'

export default function ZonaRestablecer({ alRestablecer }: { alRestablecer: () => void }) {
  const [abierto, setAbierto] = useState(false)
  const toast = useToast()
  return (
    <TarjetaSeccion id="config-restablecer" titulo="Restablecer configuración de la agenda"
      ayuda="Deja la configuración de la agenda como si nunca se hubiera configurado. Sólo lo puede hacer quien administra la clínica.">
      <ul className="list-disc pl-5 text-sm text-[var(--ag-text)]">{SE_RESTABLECE.map(l => <li key={l}>{l}</li>)}</ul>
      <p className="text-sm text-[var(--ag-muted)]">Las citas, sus pacientes, la auditoría y los contactos bloqueados no se tocan.</p>
      <button type="button" className={`${BOTON_PELIGRO} self-start`} onClick={() => setAbierto(true)}>
        Restablecer configuración de la agenda
      </button>
      {abierto && (
        <ConfirmacionRestablecer onCancelar={() => setAbierto(false)}
          onHecho={() => { setAbierto(false); toast.success('Configuración de la agenda restablecida'); alRestablecer() }} />
      )}
    </TarjetaSeccion>
  )
}
