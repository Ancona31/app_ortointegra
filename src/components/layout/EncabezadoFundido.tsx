'use client'

import Link from 'next/link'
import { Menu, PanelLeft, User } from 'lucide-react'
import { nombreBotonMas, type EntradaNav } from '@/components/layout/RielNavegacion'

/* ═══ EL ENCABEZADO FUNDIDO (`tel` e `iv`) — B4 del rediseño ════════════════
 *
 * Banda navy que nace en el borde superior físico (por debajo de la barra de
 * estado, con `var(--it)` de relleno) y se redondea abajo. Dentro, en una fila:
 *   · `tel`: botón de menú · nombre de la sección · avatar;
 *   · `iv`:  botón de menú · pista de píldoras (secciones + «Más») · avatar.
 * Las dos composiciones van en el marcado y CSS elige (`.nav-titulo` frente a
 * `.nav-pista`), por la misma razón de hidratación que el riel.
 *
 * Presentacional: todo llega de `Sidebar.tsx`.
 *
 * ⚠️ «Abrir menú» SE QUEDA COMO NOMBRE DEL BOTÓN, también en `iv` (la maqueta lo
 * llama «Mostrar barra lateral»): es el nombre que usan las e2e y la banda de
 * la agenda para el MISMO cajón, y dos nombres para un gesto confunden al
 * lector de pantalla.
 *
 * ⚠️ EN LA AGENDA NO SE VE: la banda móvil trae su propio menú y
 * `body:has(.ag-banda-movil) .nav-encabezado` lo esconde (`globals.css`).
 */

interface Avatar {
  iniciales: string
  /** `/perfil` para el médico. Sin destino (secretaria, que no tiene Mi perfil) es sólo dibujo. */
  href: string | null
  activo: boolean
}

interface Props {
  titulo: string
  entradas: EntradaNav[]
  masActivo: boolean
  masAbierto: boolean
  pendientes: number
  alAbrirMas: () => void
  menuAbierto: boolean
  alAbrirMenu: () => void
  avatar: Avatar
}

function Pista({ entradas, masActivo, masAbierto, pendientes, alAbrirMas }: Pick<Props, 'entradas' | 'masActivo' | 'masAbierto' | 'pendientes' | 'alAbrirMas'>) {
  return (
    <nav className="nav-pista" aria-label="Secciones">
      {entradas.map(e => (
        <Link key={e.clave} href={e.href} prefetch={e.sinPrefetch ? false : undefined} onClick={e.alPulsar}
          aria-current={e.activa ? 'page' : undefined} data-activa={e.activa ? 'true' : undefined}
          className="nav-pildora k-pulsable">
          {e.etiqueta}
        </Link>
      ))}
      <button type="button" onClick={alAbrirMas} aria-label={nombreBotonMas(pendientes)} aria-haspopup="dialog"
        aria-expanded={masAbierto} data-activa={masActivo ? 'true' : undefined} className="nav-pildora k-pulsable">
        Más
      </button>
    </nav>
  )
}

function DibujoAvatar({ avatar }: { avatar: Avatar }) {
  const dentro = avatar.iniciales || <User size={18} aria-hidden="true" />
  if (!avatar.href) return <span className="nav-avatar" aria-hidden="true">{dentro}</span>
  return (
    <Link href={avatar.href} prefetch={false} aria-label="Mi perfil" aria-current={avatar.activo ? 'page' : undefined}
      data-activa={avatar.activo ? 'true' : undefined} className="nav-avatar k-pulsable">
      {dentro}
    </Link>
  )
}

export default function EncabezadoFundido(p: Props) {
  return (
    <header className="nav-encabezado">
      <button type="button" onClick={p.alAbrirMenu} aria-label="Abrir menú" aria-expanded={p.menuAbierto}
        aria-controls="barra-lateral" className="nav-enc-menu k-pulsable">
        <Menu size={22} className="nav-ic-tel" aria-hidden="true" />
        <PanelLeft size={22} className="nav-ic-iv" aria-hidden="true" />
        {p.pendientes > 0 && <span className="nav-distintivo" aria-hidden="true">{p.pendientes}</span>}
      </button>
      <p className="nav-titulo">{p.titulo}</p>
      <Pista entradas={p.entradas} masActivo={p.masActivo} masAbierto={p.masAbierto}
        pendientes={p.pendientes} alAbrirMas={p.alAbrirMas} />
      <DibujoAvatar avatar={p.avatar} />
    </header>
  )
}
