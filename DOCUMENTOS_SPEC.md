# Spec del sistema de documentos PDF — Spinus

> **Fuente de verdad de implementación.** Consolida el diseño aprobado en
> `DOCUMENTOS_HANDOFF.md`. Donde este documento y el handoff difieran, manda
> este: las diferencias son correcciones acordadas, no reinterpretaciones, y
> cada una lleva su nota.
>
> `DOCUMENTOS_DECISIONES.md` es histórico. `DOCUMENTOS_AUDITORIA.md` describe
> el sistema viejo: sirve para saber qué campos existen y qué bugs no repetir,
> nunca como referencia de diseño.

**Estado de redacción**

| Sección | Estado |
|---|---|
| §0 · Cómo se lee | escrita |
| I.1 · Tokens | escrita — con sitios pendientes marcados |
| I.3 · Invariantes del sistema | escrita |
| I.2 · Componentes | no escrita |
| II · Por formato | no escrita |

---

## §0 · Cómo se lee

Esta sección no contiene ningún valor. Solo establece cómo se nombra y cómo se
verifica lo que sigue.

### Convención de nombres

Los tokens se nombran `grupo.token`, en minúsculas, en español, separados por
punto. El grupo corresponde a la subsección de I.1 donde vive la definición.
Ejemplos: `caja.ancho`, `filete.alarma`, `manuscrito.alto`.

Un token **derivado** se escribe con su fórmula, no con su resultado. El
resultado se anota entre paréntesis como valor de referencia, para poder
revisarlo, pero **lo que se implementa es la fórmula**. Si el resultado aparece
como literal en el código, el token no está implementado.

### Dónde vive cada cosa

| Pregunta, en este orden | Si la respuesta es sí |
|---|---|
| 1. ¿Es miembro de una escala declarada? | **CHASIS.** El formato declara cuál miembro usa |
| 2. ¿Es comportamiento o variante de un componente del chasis? | **CHASIS**, como variante nombrada. El formato declara cuál activa |
| 3. ¿Lo usan dos o más formatos **por la misma razón**? | **CHASIS** |
| 4. Ninguna de las anteriores | **FORMATO** |

Las preguntas 1 y 2 pesan más que el conteo de formatos: un valor que hoy usa
un solo formato pero pertenece a una escala del sistema es chasis, o el
formato #9 no hereda nada.

La pregunta 3 dice «por la misma razón», no «el mismo número». Dos valores
iguales por causas distintas se mantienen separados y se anota la coincidencia,
para que nadie los fusione después.

### Las tres comprobaciones de cierre

1. **Cada token tiene exactamente un sitio de definición.** La comprobación es
   sobre nombres, no sobre cifras.
2. **La sección II no contiene `pt`, `mm`, `%` ni `#`.** Los dígitos permitidos
   ahí solo cuentan contenido: 13 vías, 6 firmantes, 2 secciones.
3. **Todo nombre de variante citado en II existe declarado en I.2.**

Si un formato necesita escribir un número con unidad, el chasis no tiene el
token o la variante. El arreglo es agregarla al chasis, nunca escribir el
número en el formato.

### Marcas

- `PENDIENTE · hoja espécimen` — el sitio de definición existe y puede citarse
  por nombre; el valor llega con los valores tipográficos de la hoja espécimen.
- `COINCIDENCIA` — dos tokens comparten valor por casualidad. No se fusionan.
- `CORRIGE HANDOFF` — diferencia deliberada respecto de `DOCUMENTOS_HANDOFF.md`.

---

# SECCIÓN I — CHASIS

## I.1 · Tokens

Módulo único de constantes tipadas. Sin componentes, sin JSX. Ningún literal
numérico de layout puede existir fuera de aquí.

### I.1.1 · Papel y caja

| Token | Valor | Nota |
|---|---|---|
| `papel.ancho` | 612 pt | Carta, 216 mm |
| `papel.alto` | 792 pt | Carta, 279 mm |
| `caja.ancho` | 486 pt | Token único de texto corrido en todo el sistema |
| `caja.alto` | 688 pt | `papel.alto − margen.superior − margen.inferior` |

> **El 453.75 pt que apareció en Plan de Suplementación queda eliminado.**
> No existe un segundo ancho de caja. Se registra aquí, en el sitio de
> definición, para que no se vuelva a derivar.

### I.1.2 · Márgenes

**Decisión.** El handoff fija la caja en 486 pt y pide margen izquierdo mayor
que el derecho, sin cifras. La caja manda; los márgenes son el residuo.

| Token | Valor | Equivalente |
|---|---|---|
| `margen.izquierdo` | 72 pt | 25.4 mm |
| `margen.derecho` | 54 pt | 19.0 mm |
| `margen.superior` | 48 pt | 16.9 mm |
| `margen.inferior` | 56 pt | 19.8 mm |

**Argumento del reparto horizontal.** El residuo horizontal es
`612 − 486 = 126 pt`, y 126 no es múltiplo de 4: los márgenes **no** son
miembros de la escala de espaciado y no deben serlo. No son espacio entre
elementos, son geometría de página. Se reparten 72 / 54.

**Defensa contra el perforado.** La perforadora estándar de dos orificios hace
agujeros de ~6 mm de diámetro con el centro a 10–12 mm del borde: el borde
exterior del agujero llega a ~15 mm. Con `margen.izquierdo` de 25.4 mm queda
~10 mm de aire entre el agujero y la primera columna de la retícula. Un margen
de 19 mm dejaría ~4 mm y el primer carácter quedaría a merced de una
perforadora mal centrada, que es lo normal en un archivo clínico.

**Defensa contra el engrapado.** La grapa diagonal de esquina superior
izquierda ocupa un cuadro de ~15 mm desde el vértice. `margen.superior` de
16.9 mm y `margen.izquierdo` de 25.4 mm lo despejan por ambos lados: la grapa
no toca el membrete.

**Reparto vertical.** El margen inferior es mayor que el superior por dos
razones: el pie del documento —folio, paginación, leyenda— vive en la última
banda de la caja y necesita aire bajo él para no perderse en el área no
imprimible de una impresora láser; y el borde inferior es donde el hospital
pone sellos y etiquetas adhesivas. `caja.alto` resultante es 688 pt, múltiplo
de 4, compatible con la escala de espaciado.

### I.1.3 · Retícula

| Token | Valor |
|---|---|
| `reticula.columnas` | 12 |
| `reticula.columna` | 32.25 pt |
| `reticula.medianil` | 9 pt |
| `reticula.riel` | 23.25 pt |

Comprobación: `12 × 32.25 + 11 × 9 = 486` = `caja.ancho`.
El riel del número más un medianil equivale a una columna:
`23.25 + 9 = 32.25`.

### I.1.4 · Tipografía

| Token | Valor |
|---|---|
| `fuente.neogrotesca` | Archivo — identidad, títulos, datos, tablas, etiquetas |
| `fuente.humanista` | IBM Plex Sans — texto corrido largo |
| `texto.corrido.cuerpo` | 11.5 pt |
| `texto.corrido.interlineado` | 18 pt |
| `texto.corrido.alineacion` | bandera izquierda |

**Prohibidas:** Roboto, Arial, Helvetica y cualquier fuente de sistema.
**Nunca justificado**, en ningún formato, sin excepción.

La medida resultante es de ~93 caracteres. `DOCUMENTOS_DECISIONES.md` §2 pedía
65–75; **queda superado por el handoff**. Se anota aquí para que nadie lo
«corrija» reduciendo la caja.

Sitios de definición pendientes, citables por nombre desde I.2:

| Token | Uso | Estado |
|---|---|---|
| `titulo.documento.cuerpo` | título del documento | `PENDIENTE · hoja espécimen` |
| `titulo.documento.interlineado` | título largo a dos líneas | `PENDIENTE · hoja espécimen` |
| `titulo.seccion.cuerpo` | encabezado de sección y de bloque | `PENDIENTE · hoja espécimen` |
| `etiqueta.cuerpo` | etiquetas en versalita | `PENDIENTE · hoja espécimen` |
| `etiqueta.tracking` | tracking de versalita | `PENDIENTE · hoja espécimen` |
| `dato.cuerpo` | valor de campo y celda de riel | `PENDIENTE · hoja espécimen` |
| `entrada.ancla.cuerpo` | ancla de la entrada numerada | `PENDIENTE · hoja espécimen` |
| `entrada.secundario.cuerpo` | segunda línea de la entrada | `PENDIENTE · hoja espécimen` |
| `entrada.numero.cuerpo` | número de entrada en el riel | `PENDIENTE · hoja espécimen` |
| `firma.nombre.renglon` | renglón del nombre bajo la firma | `PENDIENTE · hoja espécimen` (referencia provisional: 14 pt) |
| `firma.credencial.renglon` | renglón de cédula o rol | `PENDIENTE · hoja espécimen` (referencia provisional: 12 pt) |
| `pie.cuerpo` | folio, paginación, leyenda | `PENDIENTE · hoja espécimen` |

Los dos valores de referencia provisionales de firma existen solo para poder
evaluar numéricamente el umbral de I.1.9 antes de que cierre la hoja espécimen.
Cuando lleguen los valores reales, el umbral se recalcula solo: es una fórmula.

### I.1.5 · Escritura manuscrita

| Token | Valor | Medido contra |
|---|---|---|
| `manuscrito.alto` | 20 pt (7.06 mm) | Pautado de cuaderno profesional, 7.1 mm |
| `manuscrito.ancho` | 246 pt | Presentación más larga del catálogo × 1.8 |
| `manuscrito.grosor` | 0.8 pt | Es `filete.escritura` |

Aplica a: líneas de campo vacío requerido, bloques rayados, líneas de firma
manuscrita, y cualquier espacio destinado a llenarse con pluma. El genérico y
la presentación comparten `manuscrito.ancho`.

> `COINCIDENCIA` — `manuscrito.alto` vale 20 pt y `espacio.20` también.
> **No son el mismo token.** Uno es la altura de un renglón escrito a mano,
> el otro es un escalón de la escala de espaciado. Escrito Médico usa
> `espacio.20` bajo el filete del membrete; si algún día se ajusta el alto de
> escritura manuscrita, el cuerpo del Escrito Médico no se mueve.

### I.1.6 · Filetes

| Token | Grosor | Uso | Reservado a |
|---|---|---|---|
| `filete.transicion` | 4 pt | Transición de sección | Internamiento |
| `filete.alarma` | 3 pt | Bloque de alarma | Receta |
| `filete.instrucciones` | 2 pt | Instrucciones al paciente | Internamiento |
| `filete.cita` | 1.6 pt | Cita de control | Suplementación |
| `filete.escritura` | 0.8 pt | Línea de escritura y de firma | todos |
| `filete.regla` | 0.5 pt | Regla entre entradas | todos |

La escala vive aquí; la asignación vive en el formato. Un formato declara
`filete.transicion`, nunca «4 pt».

### I.1.7 · Espaciado

`espacio.base` = 4 pt. La escala es el conjunto de sus múltiplos:

`espacio.4` · `espacio.8` · `espacio.12` · `espacio.16` · `espacio.20` ·
`espacio.24` · `espacio.32` · `espacio.40` · `espacio.48`

Todo espacio entre elementos es miembro de esta escala. Un valor fuera de
escala es un defecto, no una decisión: se corrige al escalón más cercano o se
justifica por escrito en su sitio de definición.

> `CORRIGE HANDOFF` — el aire sobre el bloque de firma figuraba como 14 pt,
> que no es múltiplo de 4. Pasa a `espacio.16`. Más aire sobre una rúbrica
> nunca es un defecto, y así el umbral de I.1.9 queda enteramente derivado de
> la escala.

> Pendiente para I.2: la sangría del bloque de alarma de Receta figura en el
> handoff como 14 pt, también fuera de escala. Se resuelve en
> `BloqueDestacado`; el valor por defecto propuesto es `espacio.16`, salvo que
> la hoja espécimen muestre que la sangría debe alinearse con otra cosa.

### I.1.8 · Color

| Token | Valor | Contraste sobre blanco | Uso |
|---|---|---|---|
| `tinta.negra` | `#101010` | 19.0 : 1 | Todo texto principal; fondo del bloque en negativo |
| `tinta.secundaria` | `#595959` | 7.0 : 1 | Rótulos secundarios, fecha del encabezado del Escrito Médico |
| `tinta.hairline` | `#B3B3B3` | 2.1 : 1 | **Solo reglas de `filete.regla`. Nunca texto** |
| `tinta.papel` | `#FFFFFF` | — | Texto sobre bloque en negativo |

Ningún texto del sistema usa un gris con contraste menor a 4.5 : 1 sobre su
fondo. `tinta.hairline` está por debajo de ese piso a propósito y por eso su
uso está restringido a reglas.

#### Derivación del color de acento

**Decisión.** El médico elige un solo color. El sistema **deriva** los cuatro
roles que usa el chasis. El médico no elige paleta.

La conversión se hace en un espacio **perceptual** —OKLCH o CIELAB—, nunca en
HSL. En HSL la «luminosidad» de un amarillo saturado y la de un azul del mismo
valor no se parecen en nada, y es exactamente el caso que rompe el sistema hoy
(auditoría §5.2: un acento amarillo produce texto blanco ilegible encima).

| Token derivado | Regla | Uso en el chasis |
|---|---|---|
| `acento.base` | Color del médico con la claridad forzada al intervalo `[0.35, 0.62]` y el croma acotado. Si cae fuera, se mueve al límite más cercano; **nunca se rechaza** | Anillo del panel circular, filetes de acento, reglas |
| `acento.tinta` | Variante de `acento.base` con la claridad reducida hasta que el contraste contra `tinta.papel` alcanza **4.5 : 1** | Acento aplicado a texto o a hairline sobre blanco |
| `acento.velo` | Mezcla opaca de `acento.base` con `tinta.papel` al 94 % | Disco del panel circular (el 5–6 % del handoff) |
| `acento.sobre` | `tinta.papel` o `tinta.negra`, el que dé mayor contraste contra `acento.base`. Si ninguno alcanza 4.5 : 1, gana `tinta.negra` y se oscurece `acento.base` hasta lograrlo | Texto colocado **encima** del acento |

Tres propiedades exigidas de la función:

1. **Determinista y pura.** Mismo hex de entrada, mismos cuatro roles de
   salida, sin estado ni configuración.
2. **Total.** Acepta cualquier hex válido, incluidos blanco, negro, amarillo
   puro y cian claro. No tiene rama de error. Un color inválido cae a
   `tinta.negra` con el acento desactivado, nunca a un render roto.
3. **El velo es opaco.** Se calcula como mezcla, no como alfa. Un alfa del 6 %
   sobre un PDF depende del compositor del visor y del driver de impresión;
   una mezcla opaca imprime igual en todos.

`acento.sobre` cierra el bug latente que registra `DOCUMENTOS_DECISIONES.md`
§2: hoy el texto sobre el acento es blanco por decreto, no por cálculo.

### I.1.9 · Firmas y umbral de flujo

#### Altura de la imagen de la rúbrica

| Token | Valor | Cuándo |
|---|---|---|
| `firma.rubrica.amplia` | 77 pt | Hasta 2 firmas en la hoja |
| `firma.rubrica.compacta` | 28 pt | De 3 a 6 firmas — piso del sistema |

Lo fija **cuántas firmas comparten la hoja**, no el hueco sobrante. Es una
imagen: no admite escala por hoja.

#### Composición del bloque de firma

> `CORRIGE HANDOFF` — el handoff usaba 77 pt y 120 pt como si midieran lo
> mismo. No lo hacen. **77 pt es la altura de la imagen de la rúbrica; el
> bloque de firma completo es rúbrica + línea + nombre + credenciales.** El
> 120 pt del umbral era ese bloque completo, escrito como número suelto.
> Aquí deja de serlo.

```
firma.bloque.alto(variante, renglones) =
      firma.rubrica.<variante>
    + filete.escritura
    + espacio.4
    + Σ(renglones de identificación)
```

Los dos casos canónicos del sistema:

| Caso | Composición | Valor de referencia |
|---|---|---|
| `firma.bloque.medico` | `firma.rubrica.amplia` + `filete.escritura` + `espacio.4` + `firma.nombre.renglon` + 2 × `firma.credencial.renglon` | 119.8 pt |
| `firma.bloque.contrafirma` | `firma.rubrica.compacta` + `filete.escritura` + `espacio.4` + `firma.nombre.renglon` + `firma.credencial.renglon` | 58.8 pt |

`77 + 0.8 + 4 + 14 + 24 = 119.8`. El 120 pt del handoff era esto. Que la
composición reconstruya el número anterior es la comprobación de que la
composición es la correcta.

El inventario exacto de renglones por rol —médico, paciente, familiar,
testigo, anestesiólogo— se cierra en I.2 · `BloqueFirmas`. La fórmula es lo
que manda; los dos casos de arriba son sus instancias conocidas.

#### Umbral de la regla 1

```
umbral.firma(variante) =
      firma.bloque.alto(variante)
    + espacio.16
    + 3 × texto.corrido.interlineado
```

| Variante | Evaluación | Referencia |
|---|---|---|
| Bloque de médico | `119.8 + 16 + 54` | 189.8 pt |
| Bloque de contrafirma | `58.8 + 16 + 54` | 74.8 pt |

Cuando conviven varios bloques en la misma hoja, el umbral se evalúa contra el
**más alto** presente.

> `CORRIGE HANDOFF` — el umbral figuraba como 185 pt, calculado con renglón de
> 17 pt, resto de una versión anterior del texto corrido. El renglón correcto
> es `texto.corrido.interlineado` = 18 pt. El 185 no se usa en ninguna parte.

El umbral **no se implementa como constante**. Se implementa como la fórmula,
para que cerrar la hoja espécimen lo actualice sin que nadie lo toque.

#### Umbrales de párrafo

| Token | Valor |
|---|---|
| `flujo.orphans` | 2 |
| `flujo.widows` | 2 |

---

## I.3 · Invariantes del sistema

Lo que no es token ni componente: reglas que ningún formato puede desactivar.

### I.3.1 · Gate de extracción de texto

**Es el Paso 3 del plan y es bloqueante.** Se corre en cuanto exista el primer
PDF real de react-pdf, antes de implementar el resto de formatos.

**Procedimiento.** Generar el PDF de un formato con datos reales y correr
`pdftotext` sobre él.

**Deben aparecer como texto real, no como trazo ni como carácter de reemplazo:**

- [ ] Denominación genérica
- [ ] Nombre comercial
- [ ] Presentación y gramaje
- [ ] Vía de administración
- [ ] Indicación
- [ ] Números de entrada (`01`, `02`…)
- [ ] Folio
- [ ] `PÁGINA X DE Y`
- [ ] Etiquetas en versalita, **sin fragmentar**: `PACIENTE`, nunca `PAC IE NT E`
- [ ] Ligaduras: `superficie`, nunca `super�cie`

**Prohibición.** No se simulan versalitas aplicando `letterSpacing` sobre
mayúsculas. Se usan **versalitas reales de la fuente**. El motivo está
confirmado hasta el operador PDF en la auditoría §8.5: `letterSpacing` hace que
el avance de cada glifo difiera de su anchura nominal, y react-pdf entonces
parte el operador `TJ` en un segmento por glifo. El extractor devuelve la
cadena letra por letra. Aplica a **todas** las etiquetas del sistema, no a tres
títulos: el diseño nuevo usa versalita en todo el chasis.

**Consecuencia declarada.** Si el gate falla, **no se avanza a otros formatos**
hasta que pase. No se documenta como deuda, no se difiere, no se implementa
«mientras tanto» un segundo formato.

**Motivo.** La denominación genérica es el único campo obligatorio por
normativa. Un expediente cuyo dato legalmente exigible no es legible por
máquina es exactamente lo que se revisa en la certificación NOM-024.

### I.3.2 · Prohibiciones de diseño

Ninguna admite excepción por formato:

- Barras de color sólido a todo lo ancho
- Sombreado alternado de filas (zebra) — delata origen HTML y desaparece en fotocopia
- Marca de agua de logo en el área de contenido
- Iconos decorativos
- Degradados, sombras, esquinas muy redondeadas
- Texto justificado
- Ornamento clásico: orlas, molduras, guilloches

### I.3.3 · Supervivencia en fotocopia

**El color nunca es el único portador de significado.** Todo debe seguir
significando en fotocopia monocroma. Si dos elementos solo se distinguen por
tono de acento, el diseño está mal: la distinción se resuelve con peso, cuerpo,
grosor de filete o posición.

### I.3.4 · El motor solo mueve bloques

**Prohibido cambiar cuerpo, interlineado o márgenes para cuadrar una hoja.**
Cuando el contenido no cabe, el motor mueve bloques; no comprime.

Corolario: el bloque de firma se ancla **al final del contenido**, no al pie de
la caja. El aire sobrante queda **debajo** de la rúbrica. Aplica a todos los
formatos.

### I.3.5 · Regla anti-divergencia

Si un formato necesita algo que un componente del chasis no hace, se agrega una
**variante declarada** al componente existente. **Nunca un componente
paralelo.** Si aparece la tentación de crear uno, el chasis está mal y se
arregla el chasis.

Criterio medible heredado de `DOCUMENTOS_DECISIONES.md` §1: ningún archivo de
formato contiene un color, un cuerpo de fuente o un padding literal. Un formato
de 300 líneas es un chasis incompleto.

### I.3.6 · Consultorio activo

El `ConsultorioActivoContext` se consume **una sola vez en todo el sistema, en
`Membrete`**. Ningún otro componente lo lee. Los 8 formatos toman siempre los
datos del consultorio activo: sin instantáneas, sin respaldo a los campos
heredados del perfil (`direccion_consultorio`, `telefono_consultorio`), sin
excepciones para documentos nuevos.

### I.3.7 · La validación bloquea, no colapsa

Un dato que la normativa exige **no se colapsa cuando falta: impide emitir**.
Aplica a universidad emisora, cédulas y domicilio del consultorio.

Hoy `PdfHeader` los renderiza condicionales a truthy y un médico con perfil
incompleto emite recetas sin universidad y sin domicilio, en silencio
(auditoría, nivel 1). No es un defecto de diseño: es un defecto de producto, y
se corrige en el formulario, no en el render.

Distíngase del **campo vacío legítimo**, que sí tiene tres comportamientos
declarados en I.2 · `Campo`: con valor, vacío requerido con línea para llenar a
mano, vacío opcional que colapsa. Lo que nunca existe es una caja con etiqueta
y nada debajo.

### I.3.8 · Restricciones de react-pdf

- `<Image>` acepta **solo JPG, PNG o base64**. No GIF, no EPS, no SVG como archivo.
- El vector va por primitivas `<Svg>` / `<Path>` / `<G>`.
- Todo asset ráster se vigila por peso. El logo PNG del sistema viejo pesa
  195 KB y es el 80 % del peso de cada archivo generado.

### I.3.9 · Inmutabilidad

Los documentos ya emitidos **no se regeneran**. Un documento con
`formato_version = 1` no puede reimprimirse con el chasis nuevo: si se necesita
otro papel, se emite uno nuevo con fecha nueva. Alterar el aspecto de un
documento entregado —o firmado— no es una mejora visual, es una alteración
documental.

---

## I.2 · Componentes

*No escrita. Se redacta después de la revisión de I.1 e I.3.*

---

# SECCIÓN II — POR FORMATO

*No escrita. Se redacta después de I.2.*
