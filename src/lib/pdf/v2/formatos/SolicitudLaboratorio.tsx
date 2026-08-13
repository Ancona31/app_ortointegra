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
 * 2. **Sin QR.** Una solicitud no autoriza nada —en México los estudios se
 *    contratan sin solicitud médica—, así que un QR de verificación sugeriría una
 *    autorización que el papel no otorga. Esa parte de la decisión se mantiene.
 * 3. **La entrada mínima del sistema: dos ranuras ocupadas.** `secundario` y
 *    `marca` colapsan (II.1 §4). Que 2.G funcione así es lo que demuestra que no
 *    necesita todas sus ranuras — y por eso aquí no se le pasan, en vez de pasarle
 *    cadenas vacías.
 *
 * LO QUE II.1 DECIDIÓ Y LA LÁMINA CONTRADICE — REVERTIDO
 *
 * a. **SÍ lleva folio.** II.1 §1 decidió que no, razonando que «nadie de fuera cita
 *    el número de una solicitud». Su lámina compone el riel de folio de 156 pt en
 *    el bloque de título y emite con prefijo en los tres casos (B.1 §2 y §4). Siete
 *    de los ocho formatos llevan folio; el único sin él es el Escrito Médico.
 * b. **La lista ES de una sola columna, y II.1 §5 tenía razón por el motivo
 *    equivocado.** Aquel párrafo lo declaraba como excepción leyendo la auditoría
 *    §8.2 —el renderer viejo dibujaba el encabezado de una segunda columna sin filas
 *    debajo—, y se rebatió: ese defecto era una cabecera huérfana y no la columna,
 *    así que B.1 §3 se compuso en tres columnas con la indicación a la derecha del
 *    nombre. **El rebatimiento era correcto y la premisa no.** La indicación por
 *    estudio no la captura nadie y se retiró, así que la tercera columna se quedaba
 *    vacía en las 486 pt de todas las solicitudes: exactamente la cabecera huérfana
 *    de §8.2, reconstruida desde el otro lado. Una sola columna, `apilada`, sin
 *    cabecera de tabla. Ver `EstudioSolicitado`.
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
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { ValoresPaciente } from '../BloquePaciente'
import EntradaNumerada, { CierreEntradas } from '../EntradaNumerada'
import MotorFlujo from '../MotorFlujo'
import ParserBloques from '../ParserBloques'
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
/**
 * Los tres rótulos de la cabecera de tabla, textuales de A.11 y de B.1 §4. Se
 * componen en versalita en 2.G, como toda versalita del sistema.
 */
// La cabecera de tabla —`#` · `Estudio solicitado` · `Indicación`— se fue con la columna
// de indicación: sin una segunda columna de datos, tres rótulos son la cabecera huérfana
// de §8.2. La cabecera de continuación compone ahora la variante de rótulo único, que es
// la que ya usan las otras dos solicitudes.
/** `CONCILIA D14` — la misma cadena en Receta y en las dos solicitudes. */
const ROTULO_FIRMA = 'Firma y sello del médico'

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina aprobada.
 *
 * I.1.7 declara nueve `transicion.*` con dos extremos identificables cada una, y
 * ninguna separa las parejas de este documento —membrete → título, riel → lista,
 * lista → notas, notas → contador, contador → firma—. Para esas, I.1.7 dice que
 * gobierna la ESCALA, y §0 dice que **el formato declara qué miembro usa**. Esto
 * es esa declaración.
 *
 * **NO ES UN VALOR UNIFORME, y la versión anterior de este archivo lo era.** Ponía
 * `espacio.24` en las cinco parejas razonando desde I.3.4 —«un documento no cambia
 * de métrica según lo que traiga»—. Esa regla habla del CONTENIDO: no obliga a que
 * todas las parejas midan lo mismo, y `SPEC_DISENO_PARTE_B.md` B.1 §2, que mide el
 * orden de bloques de la hoja 1 sobre la lámina aprobada, las tiene distintas:
 *
 *   riel → cabecera       **12 pt**   B.1 §2 · aire 7 · 211.05→223.05 → `espacio.12`
 *   cierre → contador      **5 pt**   B.1 §2 · bloque 11             → `espacio.5`
 *   contador → notas      **20 pt**   B.1 §5 `separacion`            → `espacio.20`
 *   notas → firma         **20 pt**   B.1 §5 `separacion`            → `espacio.20`
 *
 * Los cinco valores salen ya de la escala: `espacio.5` y `espacio.20` se añadieron
 * a I.1.7 para poder escribirlos, porque la escala existe para expresar el diseño y
 * no para restringirlo. Ninguno es literal.
 *
 * El ORDEN es el de B.1 §2 —filas → filete de cierre → contador → observaciones →
 * firma—, no el de II.1 §3, que ponía el contador al final. Ver la nota junto al
 * contador en el render.
 *
 * **Ni membrete → título ni título → riel las declara este archivo**, y las dos
 * faltan por la misma razón: ya están declaradas en el chasis, cada una por el
 * componente que cierra. 2.C aporta `transicion.tituloRiel` por abajo, y 2.B
 * aporta su espaciador de cierre — los 12 pt que esta lista tenía como
 * `espacio.12`. Sumar aquí cualquiera de las dos la contaría dos veces.
 *
 * > **ESA PAREJA VALÍA 12 pt Y SIGUE VALIENDO 12.** Lo que cambió es de quién es:
 * > B.1 §2 la leyó como «Aire 12 pt» del formato y es el espaciador que cierra el
 * > membrete, el mismo que la lámina de Imagenología compone y que su extracción
 * > confundió con un tercer renglón de la banda de dirección. El impreso de este
 * > formato no se mueve ni un punto; lo que se mueve es dónde está escrito.
 * >
 * > La primera versión de este formato dejó **membrete → título sin separación**,
 * > leyendo II.8 §5 —«sin título el cuerpo arranca a `transicion.tituloRiel` bajo
 * > el filete del membrete»— como si dijera que el título nace pegado. No lo dice:
 * > ese pasaje describe la variante `ausente` de 2.C, donde no hay bloque de
 * > título. Impreso, el resultado era un título pegado al renglón de la
 * > universidad, leyéndose como una cuarta línea del membrete y no como el nombre
 * > del documento (anexo A, P4-5). Con el espaciador dentro de 2.B ese defecto ya
 * > no puede volver por omisión: el membrete cierra solo.
 */
const SEPARACION_RIEL_LISTA = ESPACIO[12]
const SEPARACION_CONTADOR_NOTAS = ESPACIO[20]
const SEPARACION_NOTAS_FIRMA = ESPACIO[20]

/**
 * Un estudio de la lista. **UNA sola ranura de 2.G**, `ancla`, y el nombre del estudio en
 * ella. `secundario`, `marca` y `nota` no existen en este formato — no entran como
 * opcionales vacíos, directamente no están.
 *
 * ⚠ **LLEVÓ UNA SEGUNDA COLUMNA DE `indicacion` Y SE RETIRÓ.** Nadie la alimentaba:
 * `SolicitudLabForm` guarda `estudios` como `string[]`, cadenas sueltas, y un estudio se
 * pide por su nombre. Lo que hiciera falta añadir va en las notas generales al laboratorio,
 * que sí existen y sí se guardan.
 *
 * Retirarla se llevó la tabla entera con ella, y eso es lo correcto: con la columna vacía,
 * `disposicion="columna"` reservaba 132 pt más el medianil a la derecha de cada renglón y la
 * cabecera rotulaba `Indicación` sobre nada — la cabecera huérfana que §8.2 ya había
 * señalado en el renderizador viejo. Ahora la lista es `apilada` y el nombre del estudio
 * ocupa el ancho vivo entero.
 */
export interface EstudioSolicitado {
  /** Ranura `ancla`: el nombre del estudio. */
  readonly nombre: string
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
  /**
   * Folio del documento, ya generado por `public.generar_folio()`. **NO es
   * opcional**: la lámina lo compone en el riel de 156 pt del bloque de título y lo
   * repite en la banda de pie, y 2.M variante `completo` lo exige.
   *
   * ⚠ La clase de folio de este formato **no existe todavía en producción**: el
   * generador solo conoce `rx`, `noh`, `cot` y `ci`, y su CHECK las restringe. La
   * migración está escrita y sin aplicar en
   * `supabase/migrations/20260808_folio_02_clases_faltantes.sql`.
   */
  readonly folio: string
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
  bloqueContadorNotas: {
    marginTop: SEPARACION_CONTADOR_NOTAS,
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
  folio,
  rubrica,
}: SolicitudLaboratorioProps): ReactElement {
  // Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la
  // da sin `as`, que este proyecto prohíbe para acallar un tipo.
  const firmas: readonly [Firma] = [firmaDelMedico(medico, rubrica)]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      {/*
        EL ENCABEZADO ENTRA COMO DATOS y lo compone 2.V desde 2.N.

        Este formato es el que más gana con ello: es el de lista larga —18 estudios en
        una hoja— y por tanto el que corta más a menudo. Antes de esto, la hoja 2 de
        una solicitud de 25 estudios llegaba sin membrete, sin folio y **sin nombre de
        paciente**, que es el hallazgo más grave de la auditoría del sistema viejo.

        `lista.columnas` es lo que hace que la cabecera de continuación sea la TABLA
        de tres rótulos y no el rótulo único de las otras dos láminas: la anatomía la
        declara el formato, la repetición la resuelve el chasis.
      */}
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          titulo: TITULO,
          paciente,
          folio,
          lista: { titulo: TITULO },
          aireLista: SEPARACION_RIEL_LISTA,
        }}
        contador={{ items: ITEMS, total: estudios.length }}
        cierre={
          tieneValor(notas) ? (
            <View style={estilos.bloqueContadorNotas}>
              <ParserBloques texto={notas} marca="raya" />
            </View>
          ) : undefined
        }
        aireFirma={SEPARACION_NOTAS_FIRMA}
        firmas={<BloqueFirmas variante="simple" firmas={firmas} />}
      >
        {/*
          LA LISTA, DE UNA SOLA COLUMNA.

          `compacta` mantiene la fila calibrada a 9 / 11.5 pt, que es lo que revierte
          `D4` y `D3` y lo que hace que una lista larga quepa donde la lámina la mete.
          `apilada` sustituye a `columna` desde que se retiró la indicación por estudio:
          en `columna`, el bloque de la nota reserva 132 pt más el medianil AUNQUE no
          haya nota, así que el nombre del estudio se quedaba en 340 y sobraba un tercio
          de renglón vacío en cada uno de los dieciocho. Ahora el ancla es `flex: 1` y
          ocupa el ancho vivo entero.

          ⚠ `compacta` + `apilada` es la pareja que 2.J declara NO DEFINIDA, y no se
          compone aquí: esa indefinición es sobre el CUERPO de una nota apilada, y este
          formato ya no tiene notas por entrada. Sin nota, la rama no se ejecuta.

          **La calibración la declara este archivo, no el número de estudios.** Si algún
          día aparece aquí un `estudios.length > N` eligiendo calibración, es D4 volviendo
          por la puerta de atrás: lo que I.3.4 prohíbe es que el documento cambie de
          métrica según lo que traiga, y eso sigue en pie.
        */}
        {estudios.map((estudio, indice) => (
          <EntradaNumerada
            // El índice ES la identidad: dos estudios pueden llamarse igual y lo
            // único que los distingue es su orden en la solicitud.
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={estudio.nombre}
            acento={acento}
            calibracion="compacta"
            disposicion="apilada"
          />
        ))}
        <CierreEntradas />
      </MotorFlujo>

      <PieDocumento variante="completo" folio={folio} acento={acento} />
    </Page>
  )
}
