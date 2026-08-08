/**
 * Sistema de documentos v2 — formato II.2 · **Solicitud de Imagenología**.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de `Solicitud de Imagen.dc.html`**,
 * la lámina aprobada (versión `v1785856069259788`), con `SPEC_DISENO_PARTE_B.md`
 * B.2 como segunda lectura del mismo archivo. **No la Sección II.2 del spec de
 * implementación**, que en cuatro puntos dice otra cosa — están listados abajo.
 *
 * ESTE ARCHIVO NO DECIDE NADA DE GEOMETRÍA
 *
 * Igual que II.1: ni un solo número con unidad fuera de un token. Lo que este
 * formato sí declara es **qué lámina fija cada componente** (`lamina`), que es la
 * forma que tomó la conciliación cuando resultó que dos hojas aprobadas componen
 * la misma pieza con cifras distintas. Ver `Lamina` en la capa de tokens.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina mide 232.88 pt de encabezado desde el margen de 54, y eso NO es una
 * constante que copiar: es la suma de sus bloques, y uno de ellos sobra.
 *
 *     fila superior del membrete   59      (la fija el panel)
 *     aire                          8
 *     filete principal              2.5
 *     aire                          6
 *     banda de dirección           24      ← DOS renglones de 12
 *     espaciador de cierre         12      ← 2.B, no un aire de este formato
 *     bloque de título             25      (lo fija el riel derecho de 190)
 *     aire                          6
 *     filete del título             2.5
 *     aire                         10
 *     riel de identificación       63.87   (0.75 + 30 + 32.375 + 0.75)
 *     aire                         14
 *                                 ──────
 *                                 232.87
 *
 * ⚠ **El encabezado compuesto mide 229.87 y no 232.87, y los 3 pt son el panel.**
 * La lámina es HTML y suma los dos anillos de 1.5 pt por fuera del diámetro de 56;
 * Yoga los mide por dentro (2.A), así que su fila superior mide 56 y no 59. Es la
 * única cota que este formato no puede cerrar: el panel es geometría COMPARTIDA por
 * los ocho (A.6) y subirlo a 59 mueve Laboratorio, que ya está conciliado.
 * Reportado, no resuelto.
 *
 * ⚠ **Los 12 pt del espaciador NO se declaran aquí abajo, y no es un olvido.** Una
 * lectura anterior los contó dos veces: la extracción los vio como un tercer
 * renglón vacío de la banda de dirección y la tabla de espaciados los vio como un
 * aire «dirección → título». Son la misma pieza, cierra el membrete y por tanto
 * vive en 2.B. Este formato no separa el membrete del título: lo hace el membrete.
 *
 * LO QUE LA LÁMINA CONTRADICE DE II.2, Y GANA LA LÁMINA
 *
 * a. **SÍ lleva folio**, en el riel derecho del bloque de título y en la banda de
 *    pie, con prefijo `I-`. II.2 §1 decía «Folio: no» y pie `sin folio`. Es la
 *    misma reversión que ya se aplicó en 4.1 y por la misma prueba.
 * b. **La entrada es APILADA**, con los cuatro datos uno bajo otro. Es lo contrario
 *    de la tabla de tres columnas de Laboratorio, aunque II.2 llame a los dos
 *    formatos «gemelos».
 * c. **El badge vive DENTRO del bloque de título**, no como bloque hermano entre
 *    título y riel: cuelga del título a 4 pt y por encima del filete.
 * d. **El riel lleva 5 celdas, no 7**: el diagnóstico ocupa la fila entera y la
 *    fecha no está en el riel — va como `Emisión` en el riel derecho de arriba.
 *
 * TRES COSAS QUE ESTE FORMATO NO MONTA, Y POR QUÉ
 *
 * a. **`MotorFlujo` (2.N).** Igual que II.1: su prop `arrastre` pide las tres
 *    últimas líneas de PROSA que bajan con la firma, y este formato termina en
 *    lista y contador. Con él, el aviso de continuación de la lámina —«CONTINÚA EN
 *    LA HOJA 2 · ESTUDIOS 04 A 06»— tampoco se compone. Queda abierto (anexo A,
 *    P4-4), y con él la fila compartida que II.2 §3 daba por cerrada en 4.2.
 * b. **La hoja de continuación.** Membrete reducido, línea de paciente de una sola
 *    línea, badge reducido a la derecha de ella, cabecera `Estudios · continuación`
 *    y contador en forma `intermedia` están medidos y NO se componen: react-pdf
 *    reparte un `Page` en hojas, pero el encabezado de la hoja 2 no puede diferir
 *    del de la 1 sin montarlo con `fixed` + `render`, que es trabajo de 2.N. Si la
 *    lista desborda, la hoja 2 sale sin encabezado propio — el mismo hueco que
 *    tiene hoy Laboratorio.
 * c. **El rótulo `Notas para el servicio de imagen`.** La lámina lo compone en
 *    Archivo 9 / 13, que no es ningún rol de I.1.4, y las notas entran por 2.J como
 *    una cadena: el rótulo viaja dentro del texto y sale en `etiqueta`, 7 / 11. Es
 *    el mismo hueco que `Observaciones del laboratorio` en 4.1.
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
import BloqueNegativo from '../BloqueNegativo'
import BloquePaciente, { type ValoresPaciente } from '../BloquePaciente'
import EntradaNumerada, { CabeceraLista } from '../EntradaNumerada'
import ParserBloques from '../ParserBloques'
import ContadorLista from '../ContadorLista'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import { ESPACIO, MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

/** Las cuatro cadenas que este formato declara, textuales de la lámina. */
const TITULO = 'Solicitud de imagenología'
/** `<ÍTEMS>` de 2.K, regla 1, y el sustantivo de la cabecera de la lista. */
const ITEMS = 'estudios'
const CABECERA_LISTA = 'Estudios'
/**
 * Rótulo colgado de la ranura `nota` de cada entrada. Existe para distinguir la
 * indicación DEL ESTUDIO del diagnóstico DEL DOCUMENTO, que va una sola vez en el
 * riel (II.2 §5).
 */
const ROTULO_INDICACION = 'Indicación'
/** `CONCILIA D14` — la misma cadena en Receta y en las dos solicitudes. */
const ROTULO_FIRMA = 'Firma y sello del médico'

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina aprobada.
 *
 * Mismo criterio que en 4.1: I.1.7 no nombra ninguna de estas parejas, así que
 * gobierna la ESCALA y el formato declara qué miembro usa (§0). Ninguna es literal.
 *
 *   riel → cabecera       **14 pt**   → `espacio.14`
 *   cierre → contador      **5 pt**   → `espacio.5`
 *   contador → notas      **16 pt**   → `espacio.16`
 *   notas → firma         **26 pt**   → `espacio.26`
 *
 * `espacio.14` y `espacio.26` se añadieron a I.1.7 para poder escribirlas.
 *
 * **Faltan dos parejas y las dos faltan porque ya están declaradas en el chasis**,
 * cada una en el componente que cierra: membrete → título es el espaciador de 2.B
 * y título → riel es `transicion.tituloRiel`, que 2.C aporta por abajo en 10 pt
 * para esta lámina. Sumar aquí cualquiera de las dos la contaría dos veces.
 */
const SEPARACION_RIEL_LISTA = ESPACIO[14]
const SEPARACION_LISTA_CONTADOR = ESPACIO[5]
const SEPARACION_CONTADOR_NOTAS = ESPACIO[16]
const SEPARACION_NOTAS_FIRMA = ESPACIO[26]

/**
 * Un estudio de la lista. Las TRES ranuras que II.2 §4 ocupa —`ancla`,
 * `secundario` y `nota`— más el par que compone el ancla.
 *
 * `tipo` y `region` entran por separado y no ya concatenados porque el par lo
 * exige el formulario —los dos bloquean emisión, en par— y el separador es
 * redacción del formato, no dato. Ver `anclaDe()`.
 */
export interface EstudioSolicitado {
  /** Radiografía, Resonancia magnética, Tomografía computarizada… */
  readonly tipo: string
  /** Región anatómica. Bloquea emisión en par con `tipo` (II.2 §2). */
  readonly region: string
  /** Ranura `secundario`. Colapsa sola si no viene. */
  readonly proyecciones?: string
  /** Ranura `nota`. Colapsa sola si no viene, con su rótulo. */
  readonly indicacion?: string
}

export interface SolicitudImagenologiaProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del riel. Este formato usa CINCO de las siete celdas de 2.D:
   * `fecha` y `hora` no viven aquí — la lámina las compone arriba, juntas, en la
   * celda `Emisión` del riel derecho del bloque de título.
   */
  readonly paciente: ValoresPaciente
  /** `estudios[]` bloquea emisión en el formulario: al menos uno. */
  readonly estudios: readonly EstudioSolicitado[]
  /**
   * Fecha y hora de emisión, YA compuestas: la lámina imprime `4 ago 2026 · 11:05`.
   * Colapsa si no viene.
   */
  readonly emision?: string
  /** Badge del documento, no del estudio (II.2 §5). Sin él, sin badge. */
  readonly urgente?: boolean
  /** Notas al servicio de imagen. Colapsan enteras si no vienen. */
  readonly notas?: string
  /** Folio del documento, ya generado. Prefijo `I-` en la lámina. */
  readonly folio: string
  /** Trazo capturado del médico (2.L regla 5). */
  readonly rubrica?: string
}

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    // Regla 4 de 2.L: reserva los 36 + 16 + 16 pt donde vive la banda de 2.M. Sin
    // él vuelve el bug §8.1 y no hay nada que lo detenga (anexo A, P2-27).
    paddingBottom: MARGEN.inferior,
  },
  bloqueRielLista: {
    marginTop: SEPARACION_RIEL_LISTA,
  },
  bloqueListaContador: {
    marginTop: SEPARACION_LISTA_CONTADOR,
  },
  bloqueContadorNotas: {
    marginTop: SEPARACION_CONTADOR_NOTAS,
  },
  bloqueFirma: {
    marginTop: SEPARACION_NOTAS_FIRMA,
  },
})

/**
 * El ancla de la entrada: `tipo · region`, con la raya del sistema y un espacio a
 * cada lado. La concatenación vive aquí y no en 2.G porque el separador es
 * redacción de ESTE formato — 2.G no sabe que sus dos datos son un tipo y una
 * región.
 */
function anclaDe(estudio: EstudioSolicitado): string {
  return `${estudio.tipo} · ${estudio.region}`
}

/**
 * La firma del médico tratante, que es la única del formato.
 *
 * Los renglones bajo la línea salen de I.1.9 y son los mismos que el membrete
 * imprime arriba: se toman de `MedicoMembrete` en vez de pedirlos otra vez, que es
 * como se emiten hoy recetas con dos juegos de cédulas distintos.
 */
function firmaDelMedico(medico: MedicoMembrete, rubrica?: string): Firma {
  return {
    rol: ROTULO_FIRMA,
    nombre: medico.nombre,
    credenciales: medico.cedulas,
    rubrica,
  }
}

/** II.2 · Solicitud de Imagenología. */
export default function SolicitudImagenologia({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  estudios,
  emision,
  urgente,
  notas,
  folio,
  rubrica,
}: SolicitudImagenologiaProps): ReactElement {
  // Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la
  // da sin `as`, que este proyecto prohíbe para acallar un tipo.
  const firmas: readonly [Firma] = [firmaDelMedico(medico, rubrica)]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      {/*
        El membrete de ESTA lámina lleva cédulas y universidad, en un segundo
        renglón pegado al de dirección. Es la contradicción de `CONCILIA D23` vista
        desde el lado contrario al de Laboratorio: ver la nota en 2.B.
      */}
      <Membrete
        variante="completo"
        lamina="imagenologia"
        acento={acento}
        medico={medico}
        consultorio={consultorio}
        panel={panel}
      />

      {/*
        SIN SEPARACIÓN SUPERIOR, Y NO ES UN OLVIDO: el título arranca exactamente
        donde el membrete termina de cerrarse, porque quien separa los dos bloques
        es el espaciador de 2.B. Poner aquí `espacio.12` sería contar dos veces la
        misma pieza — es lo que hacía Laboratorio.

        SIN SUBTÍTULO: esta lámina no lo tiene, a diferencia de la de Laboratorio,
        donde además quedó revertido por decisión de producto (`CONCILIA D2`).
      */}
      <TituloDocumento
        variante="fijo"
        lamina="imagenologia"
        acento={acento}
        titulo={TITULO}
        emision={emision}
        folio={folio}
        bajoTitulo={
          urgente === true ? (
            <BloqueNegativo variante="urgente" lamina="imagenologia" />
          ) : undefined
        }
      />

      {/*
        Cinco celdas: paciente, edad, sexo y expediente arriba; el diagnóstico solo,
        a fila entera, abajo. La fecha NO va aquí — sube al riel derecho del título.
      */}
      <BloquePaciente variante="completo" lamina="imagenologia" {...paciente} />

      {/*
        LA LISTA APILADA. Sin `CierreEntradas`: en esta calibración cada entrada
        lleva su regla debajo, incluida la última, y esa regla ES el cierre de la
        lista. Ver `entradaEstudio` en 2.G.

        `disposicion="apilada"` es lo que el eje declara, aunque la calibración
        `estudio` ya no consulte la ranura de columna: los dos ejes siguen siendo
        ortogonales y ninguno tiene valor por defecto (2.G).
      */}
      <View style={estilos.bloqueRielLista}>
        <CabeceraLista titulo={CABECERA_LISTA} acento={acento} />
        {estudios.map((estudio, indice) => (
          <EntradaNumerada
            // El índice ES la identidad: dos estudios pueden pedir la misma región
            // y lo único que los distingue es su orden en la solicitud.
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={anclaDe(estudio)}
            secundario={estudio.proyecciones}
            nota={estudio.indicacion}
            rotuloNota={ROTULO_INDICACION}
            acento={acento}
            calibracion="estudio"
            disposicion="apilada"
          />
        ))}
      </View>

      {/*
        El contador cierra LA LISTA, no la hoja: va a 5 pt de la regla de la última
        entrada y antes de las notas, que es el orden de la lámina.

        Forma `final` siempre, porque este formato no pagina todavía: sin 2.N no hay
        quién sepa dónde corta la lista ni, por tanto, cuándo tocaría `intermedia`.
        Ver el punto (a) de la cabecera.
      */}
      <View style={estilos.bloqueListaContador}>
        <ContadorLista
          forma="final"
          lamina="imagenologia"
          items={ITEMS}
          total={estudios.length}
        />
      </View>

      {/*
        Las notas colapsan ENTERAS, con su separación incluida: sin el `null` el
        contenedor seguiría aportando sus 16 pt y quedaría el hueco donde estarían.
        Por eso la condición envuelve al `View` y no vive dentro de él.
      */}
      {tieneValor(notas) ? (
        <View style={estilos.bloqueContadorNotas}>
          <ParserBloques texto={notas} marca="raya" />
        </View>
      ) : null}

      <View style={estilos.bloqueFirma}>
        <BloqueFirmas variante="simple" lamina="imagenologia" firmas={firmas} />
      </View>

      {/*
        Variante `completo`: folio · paginación · leyenda. La lámina compone las tres
        zonas y emite con prefijo `I-`; II.2 §1 decía `sinFolio`. Misma reversión que
        en 4.1 y por la misma prueba.
      */}
      <PieDocumento variante="completo" folio={folio} acento={acento} />
    </Page>
  )
}
