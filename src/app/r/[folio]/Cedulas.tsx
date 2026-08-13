'use client'

import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'

/* ═══ El único trozo de cliente de /r/[folio] ═══
   La página es un Server Component entero y se queda así: lee la base, compone
   y no hidrata nada. Copiar al portapapeles es lo único que no se puede hacer
   sin JavaScript, así que es lo único que se monta como cliente — estas dos
   cajas, y no la tarjeta ni la página que las contienen.

   ⚠️ POR QUÉ LAS DOS CÉDULAS VIVEN EN UN SOLO COMPONENTE, Y NO UN BOTÓN CADA
   UNA. El acuse comparte UN SOLO TEMPORIZADOR: copiar la segunda tiene que
   apagar el «Copiado» de la primera en el acto. Con un temporizador por botón se
   quedan las dos en verde a la vez y quien verifica no sabe cuál lleva en el
   portapapeles — que es justo el dato que va a pegar en el registro. El estado
   compartido es el requisito, no una comodidad.

   ⚠️ SI EL PORTAPAPELES FALLA, EL RÓTULO NO MIENTE. `navigator.clipboard` no
   existe en contexto inseguro y `writeText` puede rechazarse por permisos: en
   los dos casos el botón se queda en «Copiar» y el fallo se anuncia solo por
   voz. Decir «Copiado» sin haber copiado hace que alguien pegue un portapapeles
   viejo creyendo que pegó esta cédula. El número es `user-select: all`, así que
   un toque largo se lo lleva igual — por eso fallar aquí no bloquea nada.

   ⚠️ NO LO CONVIERTAS EN UN ENLACE QUE «YA LLEVE» EL NÚMERO. Es lo primero que
   parece que falta y no existe: el buscador de la SEP **no admite prellenado por
   URL** —comprobado en el portal—, así que cualquier URL que se invente con la
   cédula dentro cae en el buscador vacío, y quien verifica cree que la búsqueda
   se hizo sola. */

interface Props {
  readonly cedulaProfesional?: string
  readonly cedulaEspecialidad?: string
}

/** Cuál de las dos lleva el acuse. Nunca las dos. */
type Acusada = 'profesional' | 'especialidad' | null

/** Cuánto dura el acuse antes de volver a «Copiar». */
const ACUSE_MS = 2000

/**
 * Una caja de cédula. Va suelta a nivel de módulo y no anidada dentro de
 * `Cedulas`: un componente declarado dentro de otro se recrea en cada render y
 * React le tira el estado —además de que el linter lo prohíbe—. El acuse no vive
 * aquí de todos modos: llega por `copiada`, porque el temporizador es único y lo
 * guarda el padre.
 *
 * Las dos cajas tienen tratamiento idéntico: entre la cédula profesional y la de
 * especialidad NO hay jerarquía, y destacar una induciría a comprobar solo esa.
 */
function Caja(
  { etiqueta, valor, copiada, onCopiar }: {
    etiqueta: string; valor: string; copiada: boolean; onCopiar: () => void
  },
): ReactElement {
  return (
    <div className="vf-ced">
      <span className="vf-ced__et">{etiqueta}</span>
      <div className="vf-ced__fila">
        <span className="vf-ced__num">{valor}</span>
        <button
          type="button"
          onClick={onCopiar}
          aria-label={`Copiar ${etiqueta.toLowerCase()} ${valor}`}
          className="vf-copiar"
        >
          {copiada ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}

export default function Cedulas({ cedulaProfesional, cedulaEspecialidad }: Props): ReactElement {
  const [acusada, setAcusada] = useState<Acusada>(null)
  const [fallo, setFallo] = useState<string>('')
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Sin esto, un desmontaje entre el copiado y los dos segundos dejaría un
     setState sobre un componente que ya no está. */
  useEffect(() => {
    return () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current)
    }
  }, [])

  async function copiar(cual: Exclude<Acusada, null>, valor: string, que: string): Promise<void> {
    let ok = false
    try {
      await navigator.clipboard.writeText(valor)
      ok = true
    } catch {
      ok = false
    }

    /* El temporizador es UNO: se reinicia venga de donde venga el clic, y con él
       se apaga el acuse de la otra caja. */
    if (temporizador.current !== null) clearTimeout(temporizador.current)
    setAcusada(ok ? cual : null)
    setFallo(ok ? '' : `No se pudo copiar la ${que.toLowerCase()}. Selecciónala y cópiala a mano.`)
    temporizador.current = setTimeout(() => {
      setAcusada(null)
      setFallo('')
    }, ACUSE_MS)
  }

  return (
    <>
      <div className="vf-ceds">
        {cedulaProfesional !== undefined && (
          <Caja
            etiqueta="Cédula profesional"
            valor={cedulaProfesional}
            copiada={acusada === 'profesional'}
            onCopiar={() => void copiar('profesional', cedulaProfesional, 'Cédula profesional')}
          />
        )}
        {cedulaEspecialidad !== undefined && (
          <Caja
            etiqueta="Cédula de especialidad"
            valor={cedulaEspecialidad}
            copiada={acusada === 'especialidad'}
            onCopiar={() => void copiar('especialidad', cedulaEspecialidad, 'Cédula de especialidad')}
          />
        )}
      </div>

      {/* El acuse también por voz: un rótulo que cambia no lo anuncia un lector
          de pantalla, y esta página la usa gente comprobando un papel. */}
      <span aria-live="polite" className="sr-only">
        {fallo !== '' ? fallo : acusada !== null ? 'Cédula copiada' : ''}
      </span>
    </>
  )
}
