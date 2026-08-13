/**
 * Sistema de documentos v2 — formato II.4 · **Plan de Suplementación**.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina aprobada**, con
 * `DOCUMENTOS_SPEC.md` II.4 como segunda lectura. Donde las dos difieren manda la
 * lámina, y difieren en dos cosas grandes que están listadas abajo.
 *
 * POR QUÉ ESTE FORMATO EXISTE EN EL PLAN, SI HEREDA CASI TODO DE RECETA
 *
 * Porque es la prueba de I.3.5. II.4 §4 lo dice sin rodeos: es «la misma
 * `EntradaNumerada` de Receta con dos ranuras vacías» y **«si alguien crea un
 * componente aparte para esto, el chasis está mal»**. Este archivo es la comprobación
 * de que no hizo falta: la entrada de Suplementación no tiene vía, ni presentación, ni
 * genérico, y aun así entra por 2.G con una calibración de ritmo y **cero roles
 * tipográficos nuevos** —el número es `entrada.numero`, el ancla es
 * `entradaEstudio.ancla` y la justificación es `texto.corrido`, los tres medidos
 * idénticos a los que ya había—.
 *
 * ESTE ARCHIVO NO DECIDE NADA DE GEOMETRÍA
 *
 * Igual que II.1, II.2 y II.3: ni un solo número con unidad fuera de un token. Lo que
 * declara son sus CADENAS, su lámina y sus cuatro separaciones de primer nivel.
 *
 * LO QUE LA LÁMINA CONTRADICE DE II.4, Y GANA LA LÁMINA
 *
 * a. ⚠ **LLEVA FOLIO Y LLEVA QR, Y II.4 §1 DICE QUE NO.** La ficha razona que «un plan
 *    de suplementación no pasa por ninguna ventanilla: se lo lleva el paciente», y de
 *    ahí saca `PieDocumento` variante `sin folio`, sin folio y sin código. La lámina
 *    compone las tres zonas de la banda con `Folio S-…`, el riel derecho del título con
 *    sus celdas `Emisión` y `Folio`, y la fila de cierre con la zona de verificación y
 *    su QR de 56 × 56. **Es la tercera vez que pasa lo mismo** —4.1 y 4.2 revirtieron
 *    el `sin folio` de su propia ficha por su propia lámina—, así que la reversión no
 *    es de este formato: es que el inventario de folios de 2.M no describe las láminas.
 *    Reportado, y con el prefijo que compone la lámina: `S-`.
 * b. **El rótulo de la cabecera y el plazo de la cita van en la neo-grotesca.** La
 *    lámina los compone en IBM Plex Mono, que I.1.4 prohíbe en documento impreso.
 *    Cuarto y quinto caso idénticos (`CONCILIA D13, D20, D30`).
 * c. **La justificación se compone a 453.75 pt y la lámina la declara a 486**, que es
 *    más ancho que la caja de la entrada donde vive: en el archivo desborda una columna
 *    exacta. Se compone la caja y queda reportado en 2.G.
 * d. **La cita lleva filete superior E izquierdo**, y `CONCILIA D42` había unificado la
 *    variante a solo izquierdo citando este mismo formato. Reportado en 2.I.
 * f. ⚠ **LA MARCA COMERCIAL ENTRA EN UNA RANURA QUE LA LÁMINA DA POR NO APLICABLE, Y NO
 *    DESPLAZA A NADIE.** B.4 §3 tabula `marca` como «no aplica en este formato» y II.4 §4 lo
 *    repite —«sin vía, sin presentación, sin genérico»—, así que este campo es posterior a la
 *    lámina y **el formato deja de tener dos ranuras ocupadas para tener tres**.
 *
 *    **La justificación NO ocupa esa ranura**: vive en `nota`, que es otra, y las dos se
 *    componen a la vez sin estorbarse. El orden impreso queda ancla → marca → justificación,
 *    que es lo que el dato pide: primero qué es y cuánto, después cuál comprar, después por
 *    qué. Retirar la justificación no es una consecuencia de añadir la marca; sería una
 *    decisión de producto aparte y **cuesta las tres o cuatro líneas de texto que el
 *    paciente lee**. No se retira aquí.
 * g. ⚠ **LA MARCA VA EN NEGATIVO Y ESO LE PONE UN TECHO DE ANCHO.** 2.H no abrevia, no
 *    escala el texto, no reduce el tracking y no trunca: el ancho es la variable. La columna
 *    de contenido de la entrada mide **453.75 pt** y a 8 pt con 0.18 em de tracking ahí caben
 *    unos **70 caracteres** en versalita —medido: `Ultimate Omega · Nordic Naturals`, 32
 *    caracteres, compone un bloque de 211 pt—. Por encima, el bloque **rompe a DOS renglones
 *    dentro del negativo**: no se sale de la columna, no se recorta y no encoge. Medido con
 *    una marca de 73 caracteres: el bloque mide 432.9 × 24.5 y la entrada crece 10 pt más.
 *
 *    Es el comportamiento correcto según las reglas 1 y 3, pero **un negativo de dos
 *    renglones deja de leerse como una etiqueta y empieza a leerse como un párrafo con
 *    fondo**. Si eso pasa a menudo, la decisión no es de render: es partir el dato en dos
 *    campos —producto y fabricante— y componer solo el primero en negativo. Reportado.
 * e. **`Sin firma no es válido`, en masculino.** Es la cadena de la lámina y es también
 *    la que `CONCILIA D22` fijó para los ocho, así que aquí no hay nada que conciliar:
 *    la lámina y el chasis dicen lo mismo. La que se aparta es la de Receta, que compone
 *    `válida` en el archivo de diseño y ya salía en masculino por 2.N.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina mide **232.51 pt** desde el margen de 54. Como en los otros tres, eso no es
 * una constante que copiar: es la suma de sus bloques.
 *
 *     fila superior del membrete   56      (el panel; la lámina la mide en 59)
 *     aire                          8      `transicion.membreteFilete`
 *     filete principal              2.5
 *     aire                          6      `transicion.membreteLineaFina`
 *     banda de dirección           24      dos renglones de 12, con cédulas
 *     espaciador de cierre         12      ← 2.B, y aquí son 12 y no los 10 de Receta
 *     bloque de título             25      (lo fija el riel derecho de 210)
 *     aire                          5
 *     filete del título             2.5
 *     aire                         10      ← 2.C, y aquí son 10 y no los 8 del chasis
 *     riel de identificación       64.875  (0.75 + 30 + 0.375 + 33 + 0.75)
 *     aire                         14
 *                                 ────────
 *                                 229.875
 *
 * ⚠ **CUADRA CON LA LÁMINA POR LOS DOS LADOS Y NINGUNO ES EXACTO.** Sumando los 3 pt
 * del panel —56 en el chasis contra 59 en la lámina, el mismo hueco que reportan II.2 y
 * II.3 y por la misma causa (2.A mide los anillos por dentro)— salen **232.875** contra
 * los 232.51 medidos: **0.365 pt de sobra**. Es del orden del residuo de caja de línea
 * que esta misma lámina deja en sus filas de entrada —0.47 en las tres— y del que
 * Receta deja en las suyas —0.56—, y con el mismo signo: el HTML añade el *strut* de la
 * fuente donde Yoga no. **Cuarta lámina que mide el panel en 59.** Reportado.
 *
 * LOS 33 pt DE LA CELDA DE PESO, QUE SON LA ÚNICA LECTURA QUE CUADRA
 *
 * La fila inferior del riel la fija la celda de peso, y ahí la lámina se contradice
 * consigo misma: enumera **tres** textos en esa celda y la mide en **33.71 pt**, y
 * apilados los tres son 43. Con los dos rótulos compartiendo renglón son 33, y esa es
 * la lectura que además hace cuadrar el presupuesto de arriba —con 43, el encabezado se
 * pasa diez puntos de los 232.51—. Dos cotas medidas contra una frase. Está compuesto
 * así y reportado en 2.F.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { ValoresPaciente } from '../BloquePaciente'
import EntradaNumerada, { CierreEntradas } from '../EntradaNumerada'
import MotorFlujo from '../MotorFlujo'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import ZonaQR from '../ZonaQR'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import {
  ESPACIO,
  MARGEN,
  PAPEL,
  TINTA,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

/** Las cadenas que este formato declara, textuales de la lámina. */
const TITULO = 'Plan de suplementación'
/** `<ÍTEMS>` de 2.K, regla 1, y el sustantivo de la cabecera de la lista. */
const ITEMS = 'suplementos'
const CABECERA_LISTA = 'Suplementos'
/**
 * EL RÓTULO DE LA CABECERA, que **colapsa con el peso** (II.4 §6).
 *
 * Es una plantilla y no una cadena porque lleva el dato dentro: la lámina compone
 * `Dosis calculada para 72.5 kg`, con el peso ya redactado con su unidad por quien
 * llama. La condición vive aquí y no en 2.G ni en 2.D: es el único sitio del sistema
 * que tiene delante a la vez el riel del paciente y la cabecera de la lista.
 */
function rotuloDeCalculo(peso: string): string {
  return `Dosis calculada para ${peso}`
}
/** Encabezados de los dos bloques de cierre. Los declara el formato, no 2.I. */
const ENCABEZADO_NOTAS = 'Notas adicionales'
const ENCABEZADO_CITA = 'Cita de control'
/**
 * ⚠ **NO ES «Firma y sello del médico», IGUAL QUE EN RECETA.** `D14` sigue reportado
 * sin resolver: las dos solicitudes rotulan la firma con sello y estas dos láminas sin
 * él. Se compone la cadena de cada lámina.
 */
const ROTULO_FIRMA = 'Firma del médico'
const ROTULO_VERIFICACION = 'Verificación'
/**
 * La raya del sistema, la misma con la que 2.B une las cédulas y 2.L las credenciales.
 * Aquí concatena las dos mitades del ancla.
 */
const SEPARADOR_ANCLA = ' · '

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina aprobada.
 *
 * Mismo criterio que en 4.1, 4.2 y 4.3: I.1.7 no nombra ninguna de estas parejas, así
 * que gobierna la ESCALA y el formato declara qué miembro usa (§0). Ninguna es literal
 * y ninguna es miembro nuevo: las cuatro ya estaban en la escala.
 *
 *   riel → cabecera             **14 pt**   (Receta 10, Laboratorio 12)
 *   contador → notas            **16 pt**   (Receta 14 hasta su primer bloque)
 *   notas → cita                **14 pt**
 *   cita → fila de cierre       **26 pt**   igual que Receta e Imagenología
 *
 * **Faltan tres parejas y las tres faltan porque ya están declaradas en el chasis:**
 * membrete → título es el espaciador de 2.B —12 en esta lámina—, título → riel es el
 * aire de 2.C —10 aquí, contra los 8 del chasis— y cierre de lista → contador son los
 * 5 pt que monta 2.N. Sumar cualquiera aquí la contaría dos veces.
 */
const SEPARACION_RIEL_LISTA = ESPACIO[14]
const SEPARACION_CONTADOR_NOTAS = ESPACIO[16]
const SEPARACION_NOTAS_CITA = ESPACIO[14]
const SEPARACION_CITA_CIERRE = ESPACIO[26]

/**
 * Un suplemento del plan. **DOS ranuras de las cuatro de 2.G**, con el ancla partida en
 * sus dos mitades igual que en Receta.
 *
 * `nombre` y `dosis` entran por separado y no ya concatenados por las dos mismas
 * razones que allí: el separador es redacción del formato, y cada mitad colapsa
 * distinto —sin dosis, el ancla se queda con el nombre y no cuelga la raya—.
 *
 * **Y AHORA SON TRES**, con la marca comercial. Lo que sigue sin existir es `via`: esa
 * ranura de la entrada de Receta se queda vacía y no deja nada — ni rótulo, ni línea, ni
 * hueco (II.4 §4).
 */
export interface SuplementoIndicado {
  /** Nombre del suplemento. Sin él colapsa la primera mitad del ancla. */
  readonly nombre?: string
  /** Dosis y pauta. Sin ella, el ancla se queda con el nombre (II.4 §2). */
  readonly dosis?: string
  /**
   * MARCA COMERCIAL, en la ranura `marca` de la entrada — **en BLOQUE EN NEGATIVO** (2.H).
   *
   * **No todas las marcas de suplemento tienen la misma pureza**, así que el médico tiene
   * que poder decir cuál comprar, y eso es un dato que el paciente lee en el mostrador de la
   * farmacia con la caja en la mano: fondo negro, versalita, ancho variable. Es el mismo
   * papel que la vía de administración de Receta, que ocupa esa misma ranura.
   *
   * Llega **ya redactada** por quien llama —`Ultimate Omega · Nordic Naturals`, con la raya
   * del sistema entre el producto y el fabricante—, como las cédulas, el peso y la emisión:
   * este formato coloca, no rotula ni concatena lo que no es suyo.
   *
   * Colapsa sola y no deja nada, que es lo que hacen las ranuras vacías de 2.G.
   *
   * ⚠ **VA EN SU PROPIA LÍNEA, ENTRE EL DATO SECUNDARIO Y LA NOTA**, que es donde 2.G coloca
   * esta ranura. Como este formato deja `secundario` vacío, el bloque queda pegado al ancla
   * — un renglón por debajo del nombre y la dosis.
   *
   * ⚠ **LAS CUATRO REGLAS DE 2.H VALEN AQUÍ, Y LA PRIMERA ES LA QUE MUERDE.** El bloque
   * nunca abrevia y nunca trunca: el ancho es la variable. Con una marca larga el texto
   * ROMPE A DOS RENGLONES dentro del negativo en vez de salirse de la columna — ver el punto
   * (g) de la cabecera.
   */
  readonly marca?: string
  /**
   * Justificación clínica, en la ranura `nota`. Colapsa sola: la fila baja de 48 pt a 28.
   *
   * ⚠ **NO ES LA RANURA DE LA MARCA Y NO SE ESTORBAN.** La justificación vive en `nota`, dos
   * renglones más abajo y en `texto.corrido`; la marca vive en `secundario`, pegada al ancla
   * y en la neo-grotesca. Las dos se componen a la vez sin desplazarse. Ver el punto (f) de
   * la cabecera.
   */
  readonly justificacion?: string
}

/**
 * La cita de control. Colapsa ENTERA si no viene, con su bloque y su aire (II.4 §2,
 * campo `seguimiento`).
 *
 * `fecha` no es opcional dentro del objeto y eso es deliberado: una cita de control sin
 * fecha es un bloque que dice que hay que volver sin decir cuándo. Quien no tenga fecha
 * no pasa el objeto y el bloque no se compone, que es el mismo criterio con el que 2.D
 * resuelve el paciente ausente —no hay variante sin nombre: quien no tiene paciente no
 * monta el componente—.
 */
export interface CitaDeControl {
  /** Fecha de la cita, YA compuesta por quien llama. */
  readonly fecha: string
  /** El plazo, tal como lo redacta el formulario: `a 3 meses`. Colapsa. */
  readonly plazo?: string
  /** Indicación de la cita. Colapsa. */
  readonly nota?: string
}

export interface PlanSuplementacionProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del riel. Este formato usa SEIS de las ocho celdas de 2.D: `fecha` y
   * `hora` no viven aquí —suben a la celda `Emisión` del riel derecho del bloque de
   * título, como en Receta— y `peso` es la celda que este formato estrena.
   *
   * **Sin `peso` desaparecen dos cosas a la vez**: la celda `PESO · BASE DEL CÁLCULO`
   * del riel, cuyo espacio se reparten las demás, y el rótulo `Dosis calculada para NN
   * kg` de la cabecera. Las dosis impresas no cambian (II.4 §6).
   */
  readonly paciente: ValoresPaciente
  /** `seleccionados[]` bloquea emisión en el formulario: al menos uno (II.4 §2). */
  readonly suplementos: readonly SuplementoIndicado[]
  /** Fecha y hora de emisión, YA compuestas por quien llama. Colapsa si no viene. */
  readonly emision?: string
  /** Cuerpo del bloque de notas adicionales. Colapsa entero si no viene. */
  readonly notas?: string
  /**
   * La cita de control. Colapsa entera si no viene.
   *
   * ⚠ **LA FORMA NO COINCIDE CON LA DEL FORMULARIO, Y POR ESO HOY NO SE COMPONE.**
   * `CitaDeControl` pide `fecha` —requerida— más `plazo` y `nota` por separado;
   * `PlanSuplementacionForm` guarda **`seguimiento`, una sola cadena libre** de un
   * `<input type="text">` (`:297`, y así entra en `contenido` en `:409`). Una cadena libre
   * no se parte en tres campos sin adivinar, y adivinar la fecha de una cita es
   * exactamente lo que no se puede hacer en un documento clínico.
   *
   * No está roto: está construido, medido y en reposo. Las dos salidas son de formulario
   * —partir el campo en tres, o aceptar texto libre aquí— y ninguna se decide en este
   * archivo. Está anotado con las otras cuatro en `DOCUMENTOS_RANURAS_MUERTAS.md`.
   */
  readonly cita?: CitaDeControl
  /** Folio del documento, ya generado. Prefijo `S-` en la lámina. */
  readonly folio: string
  /**
   * Ráster del QR de verificación, ya generado. Sin él, la zona colapsa y la fila de
   * cierre se queda con la firma sola — que es lo que ocurre en una vista previa,
   * donde todavía no hay token que codificar. Ver la regla 3 de 2.R.
   */
  readonly qr?: string
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
  bloqueNotas: {
    marginTop: SEPARACION_CONTADOR_NOTAS,
  },
  bloqueCita: {
    marginTop: SEPARACION_NOTAS_CITA,
  },
  /**
   * La cita cuando las notas colapsan: hereda el aire del contador, que es de quien
   * pasa a colgar. Sin esto, un plan sin notas dejaría la cita a 14 pt del contador
   * donde la lámina pone 16 — el aire de un bloque que no está.
   */
  bloqueCitaSinNotas: {
    marginTop: SEPARACION_CONTADOR_NOTAS,
  },
  /**
   * LOS CUATRO TEXTOS DE LA CITA, apilados y sin margen entre ellos.
   *
   * El cero es la composición del sistema para una pila de rótulo y valor —la celda de
   * 2.F, el campo de 2.E, la celda de folio de 2.C y la zona de verificación de 2.R—,
   * y la lámina no mide ninguna separación aquí. `DERIVADO POR PRECEDENTE`.
   *
   * Ninguno lleva cifra: los cuatro roles viven en I.1.4 y entran por la única puerta
   * a la escala. Es lo que permite que este formato componga un bloque de anatomía
   * propia sin escribir tipografía (ver la ranura `contenido` de 2.I).
   */
  citaEncabezado: { ...estiloTipografico('cita.encabezado') },
  citaFecha: { ...estiloTipografico('cita.fecha') },
  citaPlazo: { ...estiloTipografico('cita.plazo') },
  citaNota: { ...estiloTipografico('cita.nota') },
  /**
   * LA FILA DE CIERRE — firma a la izquierda, verificación a la derecha.
   *
   * Es la partición de I.1.3, y aquí no se escribe ningún ancho: la firma trae el suyo
   * (`cierre.izquierda`, 246 pt) y la zona de QR mide lo que miden sus dos piezas.
   * `space-between` los separa y deja el sobrante en medio, que es lo que pone el QR a
   * `x = 502` sin declararlo.
   *
   * ⚠ **LA FIRMA COMPONE 118.75 pt Y ESTA LÁMINA LA MIDE EN 118.48.** Son 0.27 pt y
   * las seis cifras del desglose son las mismas que miden Imagenología y Receta —rótulo
   * 11, rúbrica 77, línea 0.75, aire 4, nombre 15, cédulas 11—, así que no hay ningún
   * sumando que corregir: es residuo de la misma clase que el 0.47 de sus filas.
   * Reportado. `GEOMETRIA.medida` de 2.L no se toca.
   */
  filaCierre: {
    // SIN `marginTop`: el aire hasta la firma lo aporta 2.N por `aireFirma`, que es
    // quien monta el bloque indivisible del cierre. Declararlo aquí también lo
    // contaría dos veces.
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
})

/**
 * EL ANCLA: `nombre · dosis`, con la raya del sistema.
 *
 * La concatenación vive aquí y no en 2.G por lo mismo que en Receta: el separador es
 * redacción de ESTE formato, y las dos mitades pueden faltar por separado. Se filtra lo
 * que hay y se une lo que queda — con una sola mitad no queda la raya suelta, que es el
 * defecto que una plantilla sí dejaría.
 */
function anclaDe(suplemento: SuplementoIndicado): string {
  return [suplemento.nombre, suplemento.dosis]
    .filter((mitad): mitad is string => tieneValor(mitad))
    .join(SEPARADOR_ANCLA)
}

/**
 * La firma del médico tratante, que es la única del formato.
 *
 * Los renglones bajo la línea salen de I.1.9 y son los mismos que el membrete imprime
 * arriba: se toman de `MedicoMembrete` en vez de pedirlos otra vez.
 */
function firmaDelMedico(medico: MedicoMembrete, rubrica?: string): Firma {
  return {
    rol: ROTULO_FIRMA,
    nombre: medico.nombre,
    credenciales: medico.cedulas,
    rubrica,
  }
}

/** II.4 · Plan de Suplementación. */
export default function PlanSuplementacion({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  suplementos,
  emision,
  notas,
  cita,
  folio,
  qr,
  rubrica,
}: PlanSuplementacionProps): ReactElement {
  // Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la da
  // sin `as`, que este proyecto prohíbe para acallar un tipo.
  const firmas: readonly [Firma] = [firmaDelMedico(medico, rubrica)]
  const hayNotas = tieneValor(notas)

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      {/*
        TODO EL ENCABEZADO ENTRA COMO DATOS, y este archivo no compone ni una sola pieza
        de él: ni el membrete, ni el título, ni el riel con su celda de peso, ni la
        cabecera de la lista. Los monta 2.V desde 2.N, dos veces —hoja 1 y
        continuación— y decide cuál sale en cada hoja.

        Lo único que este formato resuelve aquí es lo suyo: sus cadenas, su lámina, su
        paciente, el aire de 14 pt hasta la cabecera y **la condición del rótulo de
        cálculo**, que es la única regla de composición de II.4 que no puede vivir en un
        componente — hace falta ver el peso y la cabecera a la vez.
      */}
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          lamina: 'suplementacion',
          titulo: TITULO,
          paciente,
          emision,
          folio,
          lista: {
            titulo: CABECERA_LISTA,
            rotulo: tieneValor(paciente.peso)
              ? rotuloDeCalculo(paciente.peso)
              : undefined,
          },
          aireLista: SEPARACION_RIEL_LISTA,
        }}
        contador={{
          items: ITEMS,
          total: suplementos.length,
          lamina: 'suplementacion',
        }}
        cierre={
          <>
            {/*
              LAS NOTAS ADICIONALES. Anatomía de `recomendaciones`: filete superior fino
              en `tinta.reglaSuave`, sin sangría, y el cuerpo a los 486 pt de la caja —el
              único bloque destacado del sistema que usa la medida completa—. El `null`
              envuelve al contenedor y no vive dentro de él: si no, el aire seguiría
              aportándose y quedaría el hueco donde estarían.
            */}
            {hayNotas ? (
              <View style={estilos.bloqueNotas}>
                <BloqueDestacado
                  variante="recomendaciones"
                  lamina="suplementacion"
                  encabezado={ENCABEZADO_NOTAS}
                  texto={notas}
                />
              </View>
            ) : null}

            {/*
              LA CITA DE CONTROL, por la ranura `contenido` de 2.I: sus cuatro piezas son
              datos con cuatro roles distintos, no un pasaje. El bloque sigue poniendo lo
              suyo —los dos filetes de 1.9, la sangría de 12, el ancho de 294 y el
              `wrap={false}`— y este archivo solo coloca los cuatro textos.
            */}
            {cita === undefined ? null : (
              <View style={hayNotas ? estilos.bloqueCita : estilos.bloqueCitaSinNotas}>
                <BloqueDestacado
                  variante="cita"
                  lamina="suplementacion"
                  contenido={
                    <>
                      <Text style={estilos.citaEncabezado}>
                        {ENCABEZADO_CITA.toUpperCase()}
                      </Text>
                      <Text style={estilos.citaFecha}>{cita.fecha}</Text>
                      {tieneValor(cita.plazo) ? (
                        <Text style={estilos.citaPlazo}>{cita.plazo}</Text>
                      ) : null}
                      {tieneValor(cita.nota) ? (
                        <Text style={estilos.citaNota}>{cita.nota}</Text>
                      ) : null}
                    </>
                  }
                />
              </View>
            )}
          </>
        }
        aireFirma={SEPARACION_CITA_CIERRE}
        firmas={
          /*
            LA FILA DE CIERRE. Los dos bloques que la componen son indivisibles por su
            cuenta —2.L regla 3 y 2.R—, y además va entera dentro del bloque que 2.N
            cierra con `wrap={false}`, así que no puede partirse entre hojas.
          */
          <View style={estilos.filaCierre}>
            <BloqueFirmas variante="simple" lamina="suplementacion" firmas={firmas} />
            {tieneValor(qr) ? (
              <ZonaQR
                qr={qr}
                rotulo={ROTULO_VERIFICACION}
                folio={folio}
                acento={acento}
              />
            ) : null}
          </View>
        }
      >
        {/*
          LA LISTA DE SUPLEMENTOS. **Dos datos por entrada** —el número en su riel, el
          ancla y la justificación en la caja—, contra los cinco de Receta.

          **Y AHORA SON TRES DATOS**: la marca entra por `secundario`, la ranura que II.4 §4
          daba por vacía. Sigue sin haber `via`, y esa ausencia no se declara de ninguna
          manera —no hay un `via={undefined}`—: una ranura que el formato no ocupa
          simplemente no existe en la llamada, que es lo que hace que la comprobación de
          II.4 §4 se lea de un vistazo.
        */}
        {suplementos.map((suplemento, indice) => (
          <EntradaNumerada
            // El índice ES la identidad: dos renglones pueden indicar el mismo producto
            // a distinta pauta y lo único que los distingue es su orden.
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={anclaDe(suplemento)}
            marca={suplemento.marca}
            nota={suplemento.justificacion}
            acento={acento}
            calibracion="suplemento"
            disposicion="apilada"
          />
        ))}
        {/*
          El filete que cierra la lista. Esta calibración pone la regla ARRIBA de cada
          entrada y se la ahorra a la primera (regla 3 de 2.G), así que la última no
          arrastra ninguna debajo y hace falta cerrarla.

          ⚠ Sale en TODAS las hojas, no solo en la última: es un nodo del flujo y cae
          donde cae. En la lámina cierra la lista de cada hoja igual, justo encima del
          contador, así que coincide — pero no es este archivo quien lo garantiza.
        */}
        <CierreEntradas />
      </MotorFlujo>

      {/*
        Variante `completo`: folio · paginación · leyenda, con el prefijo `S-`. II.4 §1
        declara `sin folio` y sin QR; la lámina compone los dos. Ver el punto (a) de la
        cabecera: misma reversión que en 4.1 y 4.2, y por la misma prueba.
      */}
      <PieDocumento variante="completo" folio={folio} acento={acento} />
    </Page>
  )
}
