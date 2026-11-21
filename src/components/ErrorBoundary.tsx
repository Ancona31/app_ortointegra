'use client'

import { Component, ReactNode } from 'react'
import EstadoError from '@/components/ui/EstadoError'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[ErrorBoundary] Error capturado:', error.message, error.stack)
  }

  render() {
    if (this.state.hasError) {
      /* Aspecto del rediseño (B3, maqueta `capas-b/vista-3-error`): centrado en
         el área de contenido y SIN tarjeta, con la pieza `EstadoError`. Los
         textos y las dos salidas son los de siempre. */
      return (
        <div className="flex min-h-dvh items-center justify-center px-4">
          <EstadoError
            titulo="Algo salió mal"
            mensaje="Ocurrió un error inesperado. Por favor intenta de nuevo."
            alReintentar={() => this.setState({ hasError: false })}
          >
            {/* ⚠️⚠️ LA SEGUNDA SALIDA NO ES UN ADORNO: SIN ELLA ESTA TARJETA ES
              UN CALLEJÓN. «Reintentar» sólo vuelve a montar el mismo subárbol,
              así que ante un fallo DETERMINISTA —el caso corriente: datos que
              rompen un cálculo, un efecto que lanza siempre— vuelve a fallar
              sin decir nada nuevo, y no hay tercer botón.

              Y no basta con el menú lateral: este boundary envuelve sólo a
              `{children}` en `(app)/layout.tsx`, así que el `Sidebar`
              sobrevive, pero en un TELÉFONO el menú está fuera de pantalla y
              sólo se abre con su botón flotante. En la agenda ese botón
              depende de que exista la banda azul, que en una página caída no
              existe. Sin este enlace, el usuario se queda en la URL rota sin
              forma de salir que no sea escribir otra a mano.

              ⚠️ ES UN `<a>` Y NO UN `<Link>`, A PROPÓSITO. `Link` navega del
              lado del cliente y REUTILIZA el árbol de React que acaba de
              romperse, con sus contextos y sus cachés de SWR tal como quedaron;
              si la causa vive ahí, el destino puede heredarla. Un `<a>` es una
              carga de documento entera: tira el árbol y empieza de cero, que es
              justo lo que hace falta después de un error que no se entiende.
              Por eso tampoco lleva `router.push`.

              `/inicio` es el destino porque es la casa del usuario logueado y
              el único sitio al que se puede mandar a cualquiera: este boundary
              tiene UN solo montaje —`(app)/layout.tsx:126`— y todo lo que cuelga
              de él es sesión iniciada. Si algún día se monta en otro sitio, esto
              pasa a ser una prop antes que una constante. */}
            <a
              href="/inicio"
              className="mt-1 inline-flex min-h-11 items-center text-[14px] leading-[18px] font-semibold text-enlace ih:min-h-9 esc:min-h-9"
            >
              Volver al inicio
            </a>
          </EstadoError>
        </div>
      )
    }

    return this.props.children
  }
}
