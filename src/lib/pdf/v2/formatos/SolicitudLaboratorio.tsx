/**
 * Sistema de documentos v2 — formato II.1 · **Solicitud de Laboratorio**.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` II.1, con el preámbulo de la Sección II.
 * Transcripción, no diseño. Es el primer formato del sistema: **el chasis
 * desnudo**. Si algo falla aquí, el defecto es del chasis y no de este archivo.
 *
 * ESTE ARCHIVO NO DECIDE NADA DE GEOMETRÍA
 *
 * No hay un solo número con unidad fuera de un token. Ningún `pt`, ningún ancho,
 * ningún grosor: la Sección II del spec tampoco los tiene, y ese es el criterio
 * (§0, tercera comprobación de cierre). Si algún día hace falta escribir uno aquí,
 * lo que está incompleto es el chasis y es el chasis lo que se arregla.
 *
 * UN FORMATO ES UN ÚNICO ELEMENTO `Page` (2.M)
 *
 * Por eso este componente devuelve un `Page` y no un `Document`: la paginación de
 * la banda de pie se lee de `subPage*`, que cuenta las hojas de ESTE elemento, y
 * `pageNumber` contaría las del PDF entero. Quien emite envuelve en `Document`.
 *
 * **`paddingBottom: margen.inferior` en la hoja es obligatorio**, y es lo único de
 * aquí que garantiza la regla 4 de 2.L: reserva los 36 + 16 + 16 pt donde vive la
 * banda de 2.M. Sin él vuelve el bug §8.1 y no hay nada en 2.L ni en 2.M que lo
 * detenga (anexo A, P2-27).
 *
 * LO QUE II.1 DECIDE Y NO SE PIERDE
 *
 * 1. **Título acortado.** El sistema viejo decía «Solicitud de Estudios de
 *    Laboratorio». Se acorta porque la regla 1 de 2.C exige que un título fijo
 *    quepa en un renglón, y el de Imagenología ya tuvo que acortarse por romper a
 *    dos líneas. Se guarda en capitalización de oración y 2.C lo compone en
 *    mayúsculas (`CONCILIA D1`). La misma cadena va al pie: el médico no debe leer
 *    un nombre en el encabezado y otro abajo.
 * 2. **Sin folio y sin QR.** Una solicitud no autoriza nada —en México los
 *    estudios se contratan sin solicitud médica— y nadie de fuera cita su número.
 *    De ahí la variante `sin folio` de 2.M, que es el caso mayoritario del sistema:
 *    cinco de ocho formatos (anexo A, P2-30).
 * 3. **La entrada mínima del sistema: dos ranuras ocupadas.** `secundario` y
 *    `marca` colapsan (II.1 §4). Que 2.G funcione así es lo que demuestra que no
 *    necesita todas sus ranuras — y por eso aquí no se le pasan, en vez de pasarle
 *    cadenas vacías.
 *
 * EXCEPCIÓN DE II.1 §5 — LA LISTA ES DE UNA SOLA COLUMNA
 *
 * El renderer viejo dibujaba el encabezado de una segunda columna sin filas debajo
 * (auditoría §8.2). No se repone: aquí no hay ninguna banda ni encabezado a la
 * derecha de los nombres, y la verificación visible de II.1 §6 manda comprobarlo.
 *
 * DOS COSAS QUE ESTE FORMATO NO MONTA, Y POR QUÉ
 *
 * a. **`MotorFlujo` (2.N).** La Sección II no lo nombra en ninguno de los ocho, y
 *    su prop `arrastre` pide las tres últimas líneas de PROSA que bajan con la
 *    firma. Este formato no termina en prosa: termina en lista y en el contador.
 *    Queda abierto en el spec (anexo A, P4-4) y se cierra en el primer formato que
 *    pagine de verdad.
 * b. **La fila de pie compartida con los avisos de 2.N.** No puede ocurrir aquí:
 *    el aviso de continuación solo sale en una hoja donde la lista no cerró, y en
 *    esa hoja el contador va en forma `intermedia`, nunca `final`. Este formato no
 *    ejercita ese caso (anexo A, P4-3).
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import Membrete, {
  type ConsultorioMembrete,
  type MedicoMembrete,
} from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import TituloDocumento from '../TituloDocumento'
import BloquePaciente, { type ValoresPaciente } from '../BloquePaciente'
import EntradaNumerada from '../EntradaNumerada'
import ParserBloques from '../ParserBloques'
import ContadorLista from '../ContadorLista'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import { ESPACIO, MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

/**
 * Las tres cadenas que este formato declara. Ninguna se compone en mayúsculas
 * aquí: la versalita y la caja alta las ponen los componentes que las imprimen
 * (2.C, 2.K y 2.L), que es la convención del sistema entero.
 */
const TITULO = 'Solicitud de laboratorio'
/** `<ÍTEMS>` de 2.K, regla 1: la palabra la declara el formato (II.1 §3). */
const ITEMS = 'estudios'
/** `CONCILIA D14` — la misma cadena en Receta y en las dos solicitudes. */
const ROTULO_FIRMA = 'Firma y sello del médico'

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, y por qué la elige el formato.
 *
 * I.1.7 declara nueve `transicion.*` con dos extremos identificables cada una, y
 * ninguna separa las parejas de este documento —membrete → título, riel → lista,
 * lista → notas, notas → contador, contador → firma—. Para esas, I.1.7 dice que
 * gobierna la ESCALA, y §0 dice que **el formato declara qué miembro usa**. Esto
 * es esa declaración, hecha una sola vez y no cinco.
 *
 * Se elige `espacio.24` y no un miembro menor porque es la magnitud con la que el
 * diseño separa bloques de primer nivel entre sí —`transicion.entreSecciones` mide
 * lo mismo por la misma causa, y es `COINCIDENCIA`, no identidad: mover una no
 * debe mover la otra—. Uniforme en las cinco parejas, porque un documento no
 * cambia de métrica según lo que traiga (I.3.4).
 *
 * **Título → riel es la única que NO la lleva**, y es la única que ya está
 * declarada: 2.C aporta `transicion.tituloRiel` por abajo, en sus tres variantes.
 * Sumarle aquí otra la contaría dos veces.
 *
 * > La primera versión de este formato dejó **membrete → título sin separación**,
 * > leyendo II.8 §5 —«sin título el cuerpo arranca a `transicion.tituloRiel` bajo
 * > el filete del membrete»— como si dijera que el título nace pegado. No lo dice:
 * > ese pasaje describe la variante `ausente` de 2.C, donde no hay bloque de
 * > título. Impreso, el resultado era un título pegado al renglón de la
 * > universidad, leyéndose como una cuarta línea del membrete y no como el nombre
 * > del documento (anexo A, P4-5).
 */
const SEPARACION_BLOQUE = ESPACIO[24]

/**
 * Un estudio de la lista. Dos ranuras de 2.G, que son las dos que II.1 §4 ocupa:
 * `ancla` y `nota`. `secundario` y `marca` no existen en este formato — no entran
 * como opcionales vacíos, directamente no están.
 */
export interface EstudioSolicitado {
  /** Ranura `ancla`: el nombre del estudio. */
  readonly nombre: string
  /** Ranura `nota`: la indicación del estudio. Colapsa si no viene. */
  readonly indicacion?: string
}

export interface SolicitudLaboratorioProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los siete datos del riel de 2.D. II.1 §2 solo inventaría `paciente`, `fecha` y
   * `diagnostico` porque los otros cuatro no llegan hoy desde ningún formulario
   * (2.D regla 3, cableado del Paso 5). Se aceptan igual: el día que exista el
   * cable se pasan y el riel los muestra sin tocar este archivo.
   */
  readonly paciente: ValoresPaciente
  /** `estudios[]` bloquea emisión en el formulario: al menos uno (II.1 §2). */
  readonly estudios: readonly EstudioSolicitado[]
  /** Notas al laboratorio. Colapsan enteras si no vienen. */
  readonly notas?: string
  /** Trazo capturado del médico (2.L regla 5). */
  readonly rubrica?: string
}

const estilos = StyleSheet.create({
  /**
   * Los cuatro paddings salen de `margen.*` y el ancho vivo que dejan es
   * `caja.ancho` — 612 − 72 − 54 = 486—, así que el contenido cae en la caja sin
   * que este archivo la mida. El `paddingBottom` es la regla 4 de 2.L; ver la
   * cabecera antes de tocarlo.
   */
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    paddingBottom: MARGEN.inferior,
  },
  bloque: {
    marginTop: SEPARACION_BLOQUE,
  },
})

/**
 * La firma del médico tratante, que es la única del formato (II.1 §1).
 *
 * Los renglones bajo la línea salen de I.1.9 —nombre, cédula profesional, cédula
 * de especialidad— y son los mismos que el membrete ya imprime arriba: se toman de
 * `MedicoMembrete` en vez de pedirlos por segunda vez, que es como se emiten hoy
 * recetas con dos juegos de cédulas distintos.
 */
function firmaDelMedico(medico: MedicoMembrete, rubrica?: string): Firma {
  return {
    rol: ROTULO_FIRMA,
    nombre: medico.nombre,
    credenciales: medico.cedulas,
    rubrica,
  }
}

/** II.1 · Solicitud de Laboratorio. */
export default function SolicitudLaboratorio({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  estudios,
  notas,
  rubrica,
}: SolicitudLaboratorioProps): ReactElement {
  // Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la
  // da sin `as`, que este proyecto prohíbe para acallar un tipo.
  const firmas: readonly [Firma] = [firmaDelMedico(medico, rubrica)]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <Membrete
        variante="completo"
        acento={acento}
        medico={medico}
        consultorio={consultorio}
        panel={panel}
      />

      {/*
        El título va envuelto solo para llevar su separación superior: 2.C aporta
        la inferior —`transicion.tituloRiel`— pero ninguna de las nueve
        transiciones de I.1.7 separa el membrete de lo que viene debajo.
      */}
      <View style={estilos.bloque}>
        <TituloDocumento variante="fijo" acento={acento} titulo={TITULO} />
      </View>

      {/*
        El riel de identificación. `fecha` y `diagnostico` son DOS DE SUS SIETE
        CELDAS, no un segundo riel: II.1 §3 declaraba además un `RielDatos` de una
        línea con esos dos datos, que es la estructura de dos rieles que mató
        `CONCILIA D6` y que los habría impreso por duplicado (anexo A, P4-2).
      */}
      <BloquePaciente variante="completo" {...paciente} />

      <View style={estilos.bloque}>
        {estudios.map((estudio, indice) => (
          <EntradaNumerada
            // El índice ES la identidad: dos estudios pueden llamarse igual y lo
            // único que los distingue es su orden en la solicitud.
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={estudio.nombre}
            nota={estudio.indicacion}
            acento={acento}
          />
        ))}
      </View>

      {/*
        Las notas colapsan ENTERAS, con su separación incluida: sin el `null` el
        contenedor seguiría aportando sus 24 pt y quedaría el hueco donde estarían
        —justo lo que II.1 §6 manda comprobar—. Por eso la condición envuelve al
        `View` y no vive dentro de él.
      */}
      {tieneValor(notas) ? (
        <View style={estilos.bloque}>
          <ParserBloques texto={notas} marca="raya" />
        </View>
      ) : null}

      {/*
        2.K en forma `final`: un documento de una sola hoja cuenta como final
        (regla 2). Va al FINAL DEL CONTENIDO porque el contador existe para que
        quien reciba una hoja suelta sepa si le falta otra.
      */}
      <View style={estilos.bloque}>
        <ContadorLista forma="final" items={ITEMS} total={estudios.length} />
      </View>

      <View style={estilos.bloque}>
        <BloqueFirmas variante="simple" firmas={firmas} />
      </View>

      {/* Variante `sin folio`: paginación · título · leyenda. NINGÚN folio. */}
      <PieDocumento variante="sinFolio" titulo={TITULO} acento={acento} />
    </Page>
  )
}
