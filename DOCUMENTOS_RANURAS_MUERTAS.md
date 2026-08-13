# Ranuras muertas de v2 — LEER ANTES DE CABLEAR

> **Este documento existe porque cinco bloques de v2 están construidos, medidos y sin nadie
> que los alimente.** Si el paso del cableado los ignora, v2 se enciende con cinco bloques
> muertos y nadie se entera hasta que un médico eche algo en falta en el papel.
>
> Generado en el paso 5.9.a (reconciliación de v2 con v1). No se cierra hasta que las cinco
> filas digan «resuelta» o «descartada por escrito».

---

## 0 · Cómo aparecieron, y por qué no antes

El chasis de v2 se midió contra las láminas aprobadas, formato por formato. **Nadie midió el
otro extremo:** que los formatos pudieran componer lo que los formularios GUARDAN de verdad.

El primero en salir fue el Escrito Médico —el formato compone `NodoEscrito[]` y la fila
guarda JSON de ProseMirror y HTML, y entre las dos formas no había nada—. Al buscar si había
más, salieron estas cinco. Ese es el hallazgo de método que conviene no olvidar:

> **Una lámina aprobada no prueba que el dato exista.** Las dos comprobaciones son distintas
> y hay que hacer las dos.

Y una segunda, que cambia cómo hay que leer cualquier auditoría futura:

> **`contenido` (lo que se persiste) NO es `data` (lo que ve el PDF).** Son dos objetos
> distintos en los nueve formularios. `contenido` es lo que sobrevive en la fila y lo único
> que existe al regenerar.

---

## 1 · Las cinco

| # | Formato | Ranura de v2 | Qué guarda el formulario | Qué pasa hoy |
|---|---|---|---|---|
| **A** | Solicitud de Laboratorio | `EstudioSolicitado.indicacion` — la columna de la tabla de B.1 §3 | `estudios: string[]`, cadenas sueltas (`SolicitudLabForm.tsx:112`) | La columna no se compone nunca |
| **B** | Solicitud de Imagenología | `notas` — el bloque con sintaxis de viñetas de `HANDOFF §4` | **No hay campo.** `contenido` son cinco claves y ninguna es notas (`:244`) | El bloque no se compone nunca |
| **C** | Receta Médica | `signosDeAlarma` — el bloque de alarma, filete de 4 pt | **No hay campo.** El único campo de cierre es `recomendaciones`, que va a su propio bloque | El bloque no se compone nunca |
| **D** | Plan de Suplementación | `cita: CitaDeControl` — `fecha` requerida, `plazo` y `nota` | `seguimiento: string`, **una cadena libre** (`:297`) | La cita de control no se compone nunca |
| **E** | Denegación / Revocación | `motivo` — el texto del `MarcoParcial` | **No hay campo.** `contenido` son seis claves (`:1006`) | Se compone la fórmula por defecto |

**E es el menos grave y no se cuenta igual que los otros cuatro:** ahí el papel no se queda
mudo —hay una fórmula por defecto que dice lo que hay que decir—. Lo que falta es la
posibilidad de que el médico asiente un motivo distinto del genérico.

Las cuatro primeras sí dejan el papel sin el bloque entero.

---

## 2 · Qué encendería cada una

**Las cinco son trabajo de FORMULARIO, no de `src/lib/pdf/v2/`.** Ninguna se arregla tocando
un formato: la ranura ya está construida y medida. Lo que falta es que alguien la alimente.

| # | Qué hace falta | Alcance |
|---|---|---|
| A | Que `SolicitudLabForm` guarde `{ nombre, indicacion }` por estudio en vez de una cadena | Formulario + migración de lectura de los `contenido` viejos |
| B | Un campo de notas en `SolicitudImagenForm` | Formulario |
| C | Un campo de signos de alarma, **separado** de recomendaciones | Formulario. Ver §3 |
| D | O partir `seguimiento` en tres campos, o que `CitaDeControl` acepte texto libre | Formulario **o** formato — decisión pendiente |
| E | Un campo de motivo en el conmutador de denegación | Formulario |

---

## 3 · La que ya tiene decisión tomada — C, los signos de alarma

Se propuso conectarle el texto que hoy el médico escribe en **Recomendaciones generales**.
**Se descartó, con el papel delante**, y queda decidido así:

1. **El filete de 4 pt es el recurso más fuerte de la receta** — el grosor más alto de ese
   formato en la jerarquía de I.1.6. Gastarlo en «tomar con alimentos» es ponerle el énfasis
   máximo del documento a lo que menos lo necesita.
2. **Un bloque de alarma que siempre dice cosas rutinarias deja de leerse como alarma.** El
   día que haya un signo de verdad ya no destacará, porque el lector habrá aprendido que ahí
   nunca hay nada urgente. La alarma se gasta por uso.
3. Y dejaría vacío el bloque `recomendaciones`, que es el que le corresponde a ese texto.

**`recomendaciones` → `recomendaciones`.** El bloque de alarma espera un campo propio.

---

## 4 · Lo que NO es una ranura muerta, y por qué está aquí

Para que nadie lo cuente dos veces ni lo «arregle»:

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

## 5 · Estado

| # | Ranura | Estado |
|---|---|---|
| A | Laboratorio · indicación por estudio | ⬜ abierta |
| B | Imagenología · notas | ⬜ abierta |
| C | Receta · signos de alarma | ⬜ abierta, **con la decisión de §3 tomada** |
| D | Suplementación · cita de control | ⬜ abierta, decisión pendiente |
| E | Denegación · motivo | ⬜ abierta, no bloqueante |

Cada ranura está además anotada en su propio formato, junto a la prop, con un `⚠ RANURA SIN
PRODUCTOR`. Este documento es el índice; el detalle vive en el código.
