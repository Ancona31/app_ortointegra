# Ranuras muertas de v2 — CERRADO

> **Las siete ranuras que este documento inventariaba ya no existen: se retiraron de los
> formatos.** No queda nada que cablear ni nada que vigilar al encender `usa_documentos_v2`.
>
> Lo que sobrevive es la sección 2, que nunca fue una lista de ranuras muertas: son tres
> decisiones que PARECEN huecos y no lo son. Está aquí para que nadie las «arregle».

---

## 1 · Qué fueron y cómo se cerraron

El chasis de v2 se midió contra las láminas aprobadas, formato por formato. **Nadie midió
el otro extremo:** que los formatos pudieran componer lo que los formularios GUARDAN. De
ahí salieron cinco ranuras construidas y sin productor, y al verificar los renombrados
salieron dos más.

Las siete se retiraron. **No eran campos que faltaran: eran bloques que se inventaron al
diseñar las láminas.**

| # | Formato | Ranura | Cómo se cerró |
|---|---|---|---|
| A | Solicitud de Laboratorio | `EstudioSolicitado.indicacion` | Retirada. Un estudio se pide por su nombre; lo demás va en las notas generales. **Se llevó la tabla con ella**: sin segunda columna de datos, la lista es de una sola columna y sin cabecera |
| B | Solicitud de Imagenología | `notas` | Retirada. Lo que el servicio necesita de cada estudio va en la ranura `nota` de su entrada, que sí se captura |
| C | Receta Médica | `signosDeAlarma` | Retirada, y el bloque entero con ella. **No son dos cosas**: una alarma es una recomendación al paciente y se escribe donde se escriben las demás |
| D | Plan de Suplementación | `cita: CitaDeControl` | Convertida a `seguimiento?: string`. El objeto pedía tres campos que nadie captura; el texto libre es lo que el formulario guarda y lo que v1 imprime |
| E | Denegación / Revocación | `motivo` | Retirada. La constancia compone siempre la fórmula por defecto, que dice lo que hay que decir |
| F | Recibo de Honorarios | `procedimiento` | Retirada. Lo que se cobra ya lo dice la relación de conceptos, línea por línea |
| G | Consentimiento Informado | `representanteLegal` | Retirada. Alternaba un rótulo; el formulario tiene un solo campo que cubre las dos calidades. **v1 tiene la misma rama y tampoco la ejerce** |

**Las dos que dejaron holgura medible** son A —la columna vacía reservaba 132 pt de ancho
por renglón— y F, que adelgazó el encabezado 25 pt y con ellos hizo caber en una hoja un
recibo de 14 conceptos que antes partía en dos. Las otras cinco no cambian ningún papel
emitido: sus bloques ya colapsaban por falta de dato.

**El hallazgo de método, que es lo que conviene no olvidar:**

> **Una lámina aprobada no prueba que el dato exista.** Las dos comprobaciones son distintas
> y hay que hacer las dos.

Y una segunda, que cambia cómo hay que leer cualquier auditoría futura:

> **`contenido` (lo que se persiste) NO es `data` (lo que ve el PDF de v1).** Son dos objetos
> distintos en los nueve formularios. `contenido` es lo que sobrevive en la fila y lo único
> que existe al regenerar.

---

## 2 · LO QUE NO ES UNA RANURA MUERTA, Y POR QUÉ SIGUE AQUÍ

> ⚠ **ESTA ES LA PARTE VIVA DEL DOCUMENTO.** `SolicitudInternamientoForm.tsx` y
> `src/lib/documentos/folio.ts` la referencian. Las tres son decisiones cerradas: no se
> «arreglan».

### El folio de Internamiento

`20260811_folio_03_denegacion.sql:273` asigna `INT-AAAA-NNNN` a `solicitud_internamiento`,
y el formato **no compone la ranura de folio** — `PieDocumento` variante `sin folio`.

**La fila lo lleva y el papel no lo dice, y las dos cosas son ciertas a la vez.** El
expediente electrónico numera todo lo que emite porque una serie con huecos no se audita; el
papel no lo lleva porque nadie va a citar ese número. Decisión reconfirmada con el desacuerdo
delante. No se «arregla» ni añadiendo la ranura ni sacando `int` del generador.

### El tipo y el número de identificación del anexo

Eran **requeridos** en `IdentificacionAnexo` y nadie los alimentaba: el formulario captura la
fotografía de la credencial y nada más. Ahora son **opcionales y el pie colapsa**. No es una
ranura pendiente: es una decisión cerrada, y estas son sus tres razones:

1. El dato ya está en la hoja, y mejor: está impreso en la credencial fotografiada.
2. Teclearlo introduce divergencia en un documento legal. La foto no se equivoca.
3. Cuesta dos campos por firmante en un flujo que ocurre con el paciente delante.

### El riel de paciente de los siete formatos

`sexo`, `expediente` y `hora` no llegan hoy desde ningún formulario, así que las celdas
colapsan y el riel se reparte entre las vivas. **Eso sí es cableado del paso siguiente**, no
una ranura muerta: el dato existe en la base, solo hay que pasarlo.

---

## 3 · Un defecto de chasis que salió al retirar la columna de Laboratorio

No es una ranura y no se cerró: queda abierto y anotado aquí porque se descubrió en este paso.

**`@react-pdf/renderer` comprime las filas de una hoja que se pasa por poco**, en vez de bajar
la entrada que sobra a la hoja siguiente. Medido en Laboratorio con 40 estudios: la hoja 2,
holgada, compone el paso de fila en **15.5 pt exactos** y la hoja 1, con 28 entradas, en
**15.366**. Son 0.134 por fila —**0.87 %**— y 3.7 pt a lo largo de la hoja, justo lo que le
faltaba a la entrada 28 para entrar. Con 20 estudios, una hoja y holgura de sobra, el paso
vuelve a 15.5: es compresión por ajuste, no ruido de redondeo.

Es una violación de I.3.4 —el documento cambia de métrica según lo que traiga— de dos órdenes
de magnitud menos que la de §8.1, que movió el paso de 50 a 40.99. `flexShrink: 0` en
`estilos.entrada` de 2.G **no lo detiene**, así que la compresión no ocurre en la entrada y
localizarla es trabajo de chasis. Con listas de tamaño real —cinco a quince estudios, una
hoja— no se alcanza.

Fijado con umbral del 1 % entre hojas en `hojaDeContinuacion.test.ts`, con la cifra y la
reproducción al lado.
