'use client'

import { Component, ReactNode } from 'react'

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
      return (
        <div className="flex items-center justify-center min-h-screen bg-slate-50">
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-slate-700 mb-2">Algo salió mal</h2>
            <p className="text-sm text-slate-500 mb-6">Ocurrió un error inesperado. Por favor intenta de nuevo.</p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="px-4 py-2 bg-[#1e5fa8] text-white text-sm font-medium rounded-lg hover:bg-[#1a3a5c] transition-colors"
            >
              Reintentar
            </button>
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
            <p className="mt-4">
              <a href="/inicio" className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 transition-colors">
                Volver al inicio
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
