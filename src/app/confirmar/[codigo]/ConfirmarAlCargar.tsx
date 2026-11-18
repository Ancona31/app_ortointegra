'use client'

import { useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'

/* ═══ K2 (punto 8 de Angel) — confirmar al abrir «Confirmo mi asistencia» del correo ═══
   El GET de la página SIGUE SIN ESCRIBIR (ver page.tsx). Lo hace ESTE
   componente, en el navegador, con el MISMO POST del botón
   (`/api/confirmar/[codigo]`, accion=confirmar: mismo token, mismas puertas de
   origen y límites, idempotente: repetido da «ya_confirmada»). Sólo se monta
   con `?paso=confirmar` (el botón del correo) y si la cita aún se puede
   confirmar.

   No confirma: un GET o HEAD (revisores de correo, vista previa), un render
   sin JavaScript (queda el botón de siempre, que se pinta en el servidor), un
   navegador automatizado (`navigator.webdriver`: los que «abren» enlaces para
   revisarlos), una página en prerender ni una pestaña en segundo plano (espera
   a que se vea). Una sola vez por carga (`useRef`: StrictMode corre el efecto
   dos veces). Si falla, vuelve el botón de siempre. «No podré asistir» no pasa
   por aquí.

   ⚠️ RIESGO ACEPTADO, NO RESUELTO: un revisor de enlaces que ABRE la página en
   un navegador real, ejecuta JavaScript, la deja visible y oculta
   `navigator.webdriver` sí confirmaría (las dos revisiones de K2 lo marcan).
   Cerrarlo del todo pide un gesto de la persona (un toque, una tecla) antes
   del POST, que es justo el clic que el punto 8 quita. Queda para Angel. */

type Estado = 'boton' | 'enviando'

/** El POST del botón; true si la ruta llevó a la página con su `?r=` (y se navega allí). */
async function confirmar(codigo: string): Promise<boolean> {
  const cuerpo = new FormData()
  cuerpo.set('accion', 'confirmar')
  try {
    const r = await fetch(`/api/confirmar/${encodeURIComponent(codigo)}`, { method: 'POST', body: cuerpo, cache: 'no-store', credentials: 'same-origin' })
    const destino = new URL(r.url)
    const esLaPagina = destino.origin === window.location.origin && destino.pathname === `/confirmar/${codigo}` && destino.searchParams.has('r')
    if (!r.redirected || !esLaPagina) return false
    window.location.replace(destino.pathname + destino.search)
    return true
  } catch {
    return false
  }
}

/** Llama a `listo` cuando la página ya no está en prerender y se ve; devuelve cómo dejar de esperar. */
function cuandoSeVea(listo: () => void): () => void {
  const comprobar = () => {
    if (Reflect.get(document, 'prerendering') === true || document.visibilityState !== 'visible') return
    quitar()
    listo()
  }
  const quitar = () => {
    document.removeEventListener('visibilitychange', comprobar)
    document.removeEventListener('prerenderingchange', comprobar)
  }
  document.addEventListener('visibilitychange', comprobar)
  document.addEventListener('prerenderingchange', comprobar)
  comprobar()
  return quitar
}

export default function ConfirmarAlCargar({ codigo, children }: { codigo: string; children: ReactNode }): ReactElement {
  const [estado, setEstado] = useState<Estado>('boton')
  const enviado = useRef(false)
  useEffect(() => {
    if (navigator.webdriver) return
    return cuandoSeVea(() => {
      if (enviado.current) return
      enviado.current = true
      setEstado('enviando')
      void confirmar(codigo).then(ok => { if (!ok) setEstado('boton') })
    })
  }, [codigo])
  if (estado === 'enviando') return <p role="status" className="rp-nota">Confirmando tu asistencia…</p>
  return <>{children}</>
}
