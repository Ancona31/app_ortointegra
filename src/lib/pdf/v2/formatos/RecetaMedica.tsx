/**
 * Sistema de documentos v2 — formato II.3 · **Receta Médica**.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de `Receta Medica.dc.html`**, hoja
 * `B · 7 medicamentos` de la versión aprobada (`v1785856977395436`), con
 * `SPEC_DISENO_PARTE_B.md` B.3 como segunda lectura del mismo archivo — con **dos
 * decisiones de Angel que van contra lo medido**, listadas abajo antes que nada.
 *
 * Arquetipo B: el formato más complejo y el de mayor volumen del sistema. Es el
 * único que ejercita a la vez jerarquía de entrada, bloque en negativo, dos bloques
 * destacados y zona de QR.
 *
 * ESTE ARCHIVO NO DECIDE NADA DE GEOMETRÍA
 *
 * Igual que II.1 y II.2: ni un solo número con unidad fuera de un token. Lo único que
 * declara es **qué lámina fija cada componente** (`lamina="receta"`).
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina mide 223.88 pt de encabezado desde el margen de 54, y eso NO es una
 * constante que copiar: es la suma de sus bloques, y uno de ellos sobra.
 *
 *     fila superior del membrete   59      (la fija el panel)
 *     aire                          8      `transicion.membreteFilete`
 *     filete principal              2.5
 *     aire                          6      `transicion.membreteLineaFina`
 *     banda de dirección           24      dos renglones de 12
 *     espaciador de cierre         10      ← 2.B, y son 10 y no 12
 *     bloque de título             25      (lo fija el riel derecho de 210)
 *     aire                          5
 *     filete del título             2.5
 *     aire                          8      `transicion.tituloRiel`, el del chasis
 *     riel de identificación       63.88   (0.75 + 30 + 32.38 + 0.75)
 *     aire                         10
 *                                 ──────
 *                                 223.88
 *
 * ⚠ **El encabezado compuesto mide 220.88 y no 223.88, y los 3 pt son el panel.** La
 * lámina es HTML y suma los dos anillos de 1.5 pt por fuera del diámetro de 56; Yoga
 * los mide por dentro (2.A), así que su fila superior mide 56 y no 59. Es el mismo
 * hueco que reporta II.2 y por la misma causa: el panel es geometría COMPARTIDA por
 * los ocho (A.6) y subirlo a 59 mueve Laboratorio e Imagenología, que ya están
 * conciliados. **Segunda lámina que lo mide en 59.** Reportado, no resuelto.
 *
 * LAS DOS DECISIONES DE ANGEL, QUE VAN CONTRA LO MEDIDO
 *
 * Las dos se toman a sabiendas de que la lámina compone otra cosa, y las dos están
 * escritas donde se ejecutan además de aquí. No las «restaures» leyendo la lámina.
 *
 * 1. **LAS TRECE VÍAS VAN EN NEGATIVO, INCLUIDA LA ORAL.** El archivo aprobado
 *    decide por `via === 'Oral'` y compone la oral como texto plano —Archivo 7.5 /
 *    13 con «Vía» en gris—; aquí van las trece en bloque, que es lo que declaraba
 *    II.3 §5. Cuesta **3.5 pt por entrada oral**: el bloque mide 2 + 14.5 donde el
 *    renglón plano medía 13, así que una fila de vía oral pasa de los 85.37 pt de la
 *    lámina a los 89 de las demás. Con ello desaparece la única cifra de fila que
 *    esta implementación tenía en común con la lámina y quedan las otras dos.
 * 2. **SIN GENÉRICO, LA RANURA COLAPSA ENTERA.** II.3 §2 lo declara «vacío
 *    requerido: rótulo `GENÉRICO` y línea» y así se compuso primero. La línea de 2.E
 *    mide `manuscrito.ancho` —246 pt, medidos contra la presentación más larga del
 *    catálogo, no contra la caja de la entrada— y se solapaba con el bloque de la
 *    vía. Colapsa como cualquier ranura opcional de 2.G. Lo mismo la presentación:
 *    sin ella, el ancla se queda con el comercial y no baja ningún rótulo.
 *
 * LO QUE LA LÁMINA CONTRADICE DE II.3, Y GANA LA LÁMINA
 *
 * a. **El filete de la alarma mide 4 pt, no 3.** Corregido en la escala de I.1.6, que
 *    tenía un valor sin medir.
 * b. **La sangría de la alarma es 14, no `espacio.16`,** y su padding no es uniforme:
 *    `6 0 8 14`. Compuesto bajo `lamina`; el chasis no se mueve (`D15`).
 * c. **La zona de QR no lleva marco.** 2.R la compone dentro de un `MarcoParcial`.
 * d. **Son DOS bloques de cierre y no uno.** II.3 §2 inventaría un solo campo
 *    `recomendaciones` cuyo vacío «colapsa el bloque de alarma entero», como si
 *    fueran la misma cosa. La lámina compone dos bloques distintos, con filetes,
 *    cuerpos y encabezados distintos, y con 12 pt entre ellos. Aquí son dos props y
 *    cada una colapsa la suya. **Reportado.**
 *
 * TRES COSAS QUE ESTE FORMATO NO MONTA, Y POR QUÉ — LAS TRES SON LA MISMA
 *
 * a. **La hoja de continuación.** La lámina reparte 4 y 3 medicamentos en dos hojas,
 *    y la hoja 2 lleva encabezado propio: membrete `continuacion`, línea de paciente
 *    con la fecha de emisión, cabecera `Medicamentos · continuación` con su filete de
 *    48 × 1.6. Nada de eso se compone: react-pdf reparte un `Page` en hojas, pero el
 *    encabezado de la hoja 2 no puede diferir del de la 1 sin montarlo con `fixed` +
 *    `render`, que es trabajo de 2.N. Si la lista desborda, la hoja 2 sale sin
 *    encabezado propio — el mismo hueco que tienen hoy Laboratorio e Imagenología.
 * b. **El aviso de continuación.** `Continúa en la hoja 2 · medicamentos 05 a 07`
 *    junto a `Sin firma no es válida`. 2.N ya compone un aviso, y **no es este**:
 *    va en `pie` (7 / 11) sobre `tinta.secundaria` y sin filetes, mientras que la
 *    lámina lo compone en Archivo 8 / 12 a 0.18 em, con la zona izquierda en
 *    `tinta.negra` y la derecha en `tinta.etiqueta`, precedido de un filete de 1.6 en
 *    acento y otro de 0.5 en `tinta.reglaSuave`, y con las cifras a dos dígitos. Son
 *    cinco divergencias más la concordancia —`válida` contra el `válido` que 2.N
 *    concilió en `CONCILIA D22`—. **Reportado y no compuesto:** cablearlo hoy
 *    obligaría a decidir esas seis cosas sin la hoja 2 delante.
 * c. **El contador en forma `intermedia`.** Sale de saber dónde corta la lista, que
 *    es lo mismo que falta en (a) y (b). Va siempre en `final`.
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
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import ZonaQR from '../ZonaQR'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import { ESPACIO, MARGEN, PAPEL, TINTA, type AcentoResuelto } from '../tokens'

/** Las cadenas que este formato declara, textuales de la lámina. */
const TITULO = 'Receta médica'
/** `<ÍTEMS>` de 2.K, regla 1, y el sustantivo de la cabecera de la lista. */
const ITEMS = 'medicamentos'
const CABECERA_LISTA = 'Medicamentos'
/**
 * ⚠ **NO ES «Firma y sello del médico», Y LOS OTROS DOS FORMATOS SÍ LO SON.** `D14`
 * quedó reportado sin resolver: Laboratorio e Imagenología rotulan la firma con
 * sello y esta lámina sin él. Se compone la cadena de cada lámina.
 */
const ROTULO_FIRMA = 'Firma del médico'
const ROTULO_VERIFICACION = 'Verificación'
/** Encabezados de los dos bloques de cierre. Los declara el formato, no 2.I. */
const ENCABEZADO_RECOMENDACIONES = 'Recomendaciones generales'
const ENCABEZADO_ALARMA = 'Acuda de inmediato a urgencias si presenta'
/** Rótulo de la vía. La palabra viaja DENTRO del bloque, con el dato (B.3 §3). */
const ROTULO_VIA = 'Vía'
/**
 * La raya del sistema, la misma con la que 2.B une las cédulas y 2.L las
 * credenciales. Aquí concatena las dos mitades del ancla.
 */
const SEPARADOR_ANCLA = ' · '

/**
 * La vía por defecto cuando el medicamento no la trae. II.3 §2: «No requerido, por
 * defecto oral». No es una suposición del render — es el valor declarado del campo.
 *
 * ⚠ **Y ES LA ÚNICA VEZ QUE ESTE ARCHIVO NOMBRA UNA VÍA.** Aquí hubo además una
 * función `vaEnNegativo()` que comparaba contra `Oral` para decidir la forma de la
 * marca, porque el archivo de diseño decide así y compone la oral como texto plano.
 * **Angel decidió que las trece van en negativo**, así que no hay nada que decidir y
 * la comparación se retira: el catálogo vuelve a estar entero fuera del render, que
 * es donde II.3 §5 lo pone.
 */
const VIA_POR_DEFECTO = 'Oral'

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina aprobada.
 *
 * Mismo criterio que en 4.1 y 4.2: I.1.7 no nombra ninguna de estas parejas, así que
 * gobierna la ESCALA y el formato declara qué miembro usa (§0). Ninguna es literal.
 *
 *   riel → cabecera            **10 pt**   267.88 → 277.88   → `espacio.10`
 *   cierre de lista → contador  **5 pt**                     → `espacio.5`
 *   contador → recomendaciones **14 pt**                     → `espacio.14`
 *   recomendaciones → alarma   **12 pt**                     → `espacio.12`
 *   alarma → fila de cierre    **26 pt**                     → `espacio.26`
 *
 * `espacio.10` se añadió a I.1.7 para poder escribir la primera.
 *
 * **Faltan dos parejas y las dos faltan porque ya están declaradas en el chasis**,
 * cada una en el componente que cierra: membrete → título es el espaciador de 2.B —
 * que en esta lámina mide 10 y no 12— y título → riel es `transicion.tituloRiel`,
 * que aquí NO se desvía: los 8 pt del chasis son los de esta lámina. Sumar aquí
 * cualquiera de las dos la contaría dos veces.
 *
 * ⚠ **La lámina de UN medicamento mide otras cuatro** —14 en vez de 10 tras la banda,
 * 6 en vez de 5 hasta el filete del título, 10 en vez de 8 hasta el riel y 20 en vez
 * de 10 hasta la cabecera— junto con un ritmo de entrada de 8/10 y 9/11. Se compone
 * la de siete, que es la que gobierna. Reportado.
 */
const SEPARACION_RIEL_LISTA = ESPACIO[10]
const SEPARACION_CONTADOR_RECOMENDACIONES = ESPACIO[14]
const SEPARACION_RECOMENDACIONES_ALARMA = ESPACIO[12]
const SEPARACION_ALARMA_CIERRE = ESPACIO[26]

/**
 * Un medicamento de la receta. Las CUATRO ranuras de 2.G, con el ancla partida en
 * sus dos mitades.
 *
 * `comercial` y `presentacion` entran por separado y no ya concatenados por dos
 * razones, y las dos son de composición: el separador es redacción del formato, y
 * **cada mitad colapsa distinto**. Sin comercial, el ancla se queda con la
 * presentación; sin presentación, el ancla se reduce al comercial y la presentación
 * baja a un campo vacío requerido con su línea (II.3 §2, B.3 §3 estado 3).
 */
export interface MedicamentoRecetado {
  /** Nombre comercial. Sin él colapsa la primera mitad del ancla (II.3 §2). */
  readonly comercial?: string
  /** Presentación y gramaje. Sin ella, el ancla se queda con el comercial. */
  readonly presentacion?: string
  /**
   * Denominación genérica. Va en TINTA PLENA (regla 5 de 2.G): es el único campo
   * obligatorio por normativa y no puede componerse como dato de segunda.
   *
   * **Colapsa entero si no viene** — decisión de Angel, ver el punto 2 de la
   * cabecera. II.3 §2 lo declara vacío requerido, con rótulo y línea.
   */
  readonly generico?: string
  /**
   * Vía de administración. Una de las trece de II.3 §5. Sin ella, `Oral`. Va SIEMPRE
   * en bloque negativo — ver el punto 1 de la cabecera.
   */
  readonly via?: string
  /** Indicación. Colapsa sola si no viene. */
  readonly indicacion?: string
}

export interface RecetaMedicaProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del riel. Este formato usa CINCO de las siete celdas de 2.D: `fecha` y
   * `hora` no viven aquí — la lámina las compone arriba, juntas, en la celda
   * `Emisión` del riel derecho del bloque de título.
   */
  readonly paciente: ValoresPaciente
  /** `medicamentos[]` bloquea emisión en el formulario: al menos uno (II.3 §2). */
  readonly medicamentos: readonly MedicamentoRecetado[]
  /**
   * Fecha y hora de emisión, YA compuestas por quien llama. Colapsa si no viene.
   */
  readonly emision?: string
  /**
   * Cuerpo del bloque de recomendaciones generales. Colapsa entero si no viene.
   *
   * **AQUÍ VA EL CAMPO `recomendaciones` DEL FORMULARIO**, que es donde el médico escribe
   * «reposo relativo», «tomar con alimentos» o «acudir a control en 15 días». No va al
   * bloque de alarma — ver `signosDeAlarma`, donde está razonado por qué no.
   */
  readonly recomendaciones?: string
  /**
   * Cuerpo del bloque de alarma. Colapsa entero si no viene.
   *
   * Es un campo APARTE de `recomendaciones` y no una variante suya: ver el punto (e)
   * de la cabecera. II.3 §2 los trataba como uno solo.
   *
   * ══ ⚠ HOY NADIE LO ALIMENTA, Y ESTÁ DECIDIDO QUE SIGA ASÍ ══════════════════
   *
   * `RecetaForm` no tiene campo de signos de alarma: su único campo de cierre se llama
   * **Recomendaciones generales** y va a la prop de arriba. Así que este bloque **no se
   * compone en ninguna receta emitida** hasta que exista un campo propio.
   *
   * Se evaluó conectarle el texto de recomendaciones —era la propuesta inicial al
   * reconciliar v1 con v2— y **se descartó con el papel delante**, por dos razones:
   *
   * 1. **El filete de 4 pt es el recurso más fuerte de la receta.** Es el grosor más alto
   *    de este formato en la jerarquía de I.1.6. Gastarlo en «tomar con alimentos» es
   *    ponerle el énfasis máximo del documento a lo que menos lo necesita.
   * 2. **Un bloque de alarma que siempre dice cosas rutinarias deja de leerse como
   *    alarma.** El día que haya un signo de verdad —«fiebre de más de 38.5 °C que no cede
   *    con el antipirético»— ya no destacará, porque el lector habrá aprendido que ahí
   *    nunca hay nada urgente. La alarma se gasta por uso, no por diseño.
   *
   * Y dejaría vacío el bloque que sí le corresponde a ese texto.
   *
   * **Lo que lo encendería** es un campo propio en `RecetaForm`, separado de
   * recomendaciones. Es trabajo de formulario, no de este archivo. Hasta entonces la
   * ranura está construida, medida y en reposo — que es distinto de estar rota.
   */
  readonly signosDeAlarma?: string
  /** Folio del documento, ya generado. Prefijo `P-` en la lámina. */
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
  bloqueRecomendaciones: {
    marginTop: SEPARACION_CONTADOR_RECOMENDACIONES,
  },
  bloqueAlarma: {
    marginTop: SEPARACION_RECOMENDACIONES_ALARMA,
  },
  /**
   * LA FILA DE CIERRE — firma a la izquierda, verificación a la derecha.
   *
   * Es la partición de I.1.3, y aquí no se escribe ningún ancho: la firma trae el
   * suyo (`cierre.izquierda`, 246 pt) y la zona de QR mide lo que miden sus dos
   * piezas. `space-between` los separa y deja el sobrante en medio, que es lo que
   * pone el QR a `x = 502` sin declararlo.
   *
   * `alignItems: 'flex-end'` apoya las dos columnas por su borde inferior. La firma
   * es la más alta —118.75 contra 56—, así que es ella quien fija el alto de la fila
   * y el QR el que sube a su base.
   */
  filaCierre: {
    // SIN `marginTop`: el aire hasta la firma lo aporta 2.N por `aireFirma`, que es
    // quien monta el bloque indivisible del cierre. Declararlo aquí también lo
    // contaba DOS veces —26 del formato más los 16 por defecto del motor— y esos 16
    // pt de más eran justo lo que empujaba la firma a una tercera hoja.
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
})

/**
 * EL ANCLA: `comercial · presentación`, con la raya del sistema.
 *
 * La concatenación vive aquí y no en 2.G porque el separador es redacción de ESTE
 * formato: 2.G no sabe que sus dos datos son un nombre comercial y un gramaje. Las
 * dos mitades pueden faltar por separado, y por eso no se compone con una plantilla:
 * se filtra lo que hay y se une lo que queda — con una mitad, tampoco queda la raya
 * suelta, que es el defecto que una plantilla sí dejaría.
 */
function anclaDe(medicamento: MedicamentoRecetado): string {
  return [medicamento.comercial, medicamento.presentacion]
    .filter((mitad): mitad is string => tieneValor(mitad))
    .join(SEPARADOR_ANCLA)
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

/** II.3 · Receta Médica. */
export default function RecetaMedica({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  medicamentos,
  emision,
  recomendaciones,
  signosDeAlarma,
  folio,
  qr,
  rubrica,
}: RecetaMedicaProps): ReactElement {
  // Anotado y no aseverado: 2.L pide una tupla de una firma y la anotación se la
  // da sin `as`, que este proyecto prohíbe para acallar un tipo.
  const firmas: readonly [Firma] = [firmaDelMedico(medico, rubrica)]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      {/*
        TODO EL ENCABEZADO ENTRA COMO DATOS, y este archivo no compone ni una sola
        pieza de él: ni el membrete, ni el título, ni el riel, ni la cabecera de la
        lista. Los monta 2.V desde 2.N, dos veces —hoja 1 y continuación— y decide
        cuál sale en cada hoja.

        Lo que este formato declara aquí es lo suyo: sus cadenas, su lámina, su
        paciente y el aire de 10 pt entre el riel y la cabecera, que cada lámina mide
        distinto.
      */}
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          lamina: 'receta',
          titulo: TITULO,
          paciente,
          emision,
          folio,
          lista: { titulo: CABECERA_LISTA },
          aireLista: SEPARACION_RIEL_LISTA,
        }}
        contador={{ items: ITEMS, total: medicamentos.length, lamina: 'receta' }}
        cierre={
          <>
            {/*
              LOS DOS BLOQUES DE CIERRE, cada uno con su propio campo y su propio
              colapso. El `null` envuelve al contenedor y no vive dentro de él: si no,
              el aire seguiría aportándose y quedaría el hueco donde estarían.
            */}
            {tieneValor(recomendaciones) ? (
              <View style={estilos.bloqueRecomendaciones}>
                <BloqueDestacado
                  variante="recomendaciones"
                  encabezado={ENCABEZADO_RECOMENDACIONES}
                  texto={recomendaciones}
                />
              </View>
            ) : null}

            {tieneValor(signosDeAlarma) ? (
              <View style={estilos.bloqueAlarma}>
                <BloqueDestacado
                  variante="alarma"
                  lamina="receta"
                  encabezado={ENCABEZADO_ALARMA}
                  texto={signosDeAlarma}
                />
              </View>
            ) : null}
          </>
        }
        aireFirma={SEPARACION_ALARMA_CIERRE}
        firmas={
          /*
            LA FILA DE CIERRE. Los dos bloques que la componen son indivisibles por su
            cuenta —2.L regla 3 y 2.R—, y además va entera dentro del bloque que 2.N
            cierra con `wrap={false}`, así que no puede partirse entre hojas.
          */
          <View style={estilos.filaCierre}>
            <BloqueFirmas variante="simple" lamina="receta" firmas={firmas} />
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
          LA LISTA DE MEDICAMENTOS. Cinco datos apilados por entrada: el número en su
          riel y el ancla, el genérico, la vía y la indicación en la caja.

          `disposicion="apilada"` es lo que el eje declara, aunque la calibración
          `medicamento` no consulte la ranura de columna: los dos ejes siguen siendo
          ortogonales y ninguno tiene valor por defecto (2.G).
        */}
        {medicamentos.map((medicamento, indice) => (
          <EntradaNumerada
            // El índice ES la identidad: dos renglones pueden recetar el mismo
            // fármaco a distinta pauta y lo único que los distingue es su orden.
            key={indice}
            numero={indice + 1}
            primera={indice === 0}
            ancla={anclaDe(medicamento)}
            secundario={medicamento.generico}
            /*
              LA VÍA, SIEMPRE EN NEGATIVO. La palabra «Vía» va DENTRO de la cadena,
              como declara B.3 §3, y la redacta este archivo: 2.H coloca, no rotula.
              La ranura nunca colapsa — sin dato, la vía es oral (II.3 §2).
            */
            marca={`${ROTULO_VIA} ${
              tieneValor(medicamento.via) ? medicamento.via : VIA_POR_DEFECTO
            }`}
            nota={medicamento.indicacion}
            acento={acento}
            calibracion="medicamento"
            disposicion="apilada"
          />
        ))}
        {/*
          El filete que cierra la lista. Esta calibración pone la regla ARRIBA de
          cada entrada y se la ahorra a la primera (regla 3 de 2.G), así que la
          última no arrastra ninguna debajo.

          ⚠ Sale en TODAS las hojas, no solo en la última: es un nodo del flujo y cae
          donde cae. En la lámina cierra la lista de cada hoja igual, justo encima del
          contador, así que coincide — pero no es este archivo quien lo garantiza.
        */}
        <CierreEntradas />
      </MotorFlujo>

      {/*
        Variante `completo`: folio · paginación · leyenda. Es uno de los tres formatos
        que la llevan, y por el motivo que declara 2.M: la farmacia es la ventanilla
        que verifica de forma rutinaria y que cita el número cuando algo no cuadra.
      */}
      <PieDocumento variante="completo" folio={folio} acento={acento} />
    </Page>
  )
}
