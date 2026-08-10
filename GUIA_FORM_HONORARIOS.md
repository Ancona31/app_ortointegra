# GUIA_FORM · Honorarios / Cotización

Spec de implementación por formulario. **Base transversal:** spec 01 §1, §3.1–3.3, §3.7–3.9, §5
y su Anexo de radios. Plantillas: spec 02. Modal posterior: spec 03. Tarjetas: spec 04.

Es el único administrativo, el único con cálculo y el único que es **dos documentos en uno**.

---

## 0 · Anchos de contenedor

| Viewport | Contenedor | Tramo | Datos (cotización) | Datos (recibo) | Fila de concepto |
|---|---|---|---|---|---|
| 390 | 358 | XS | 1 col · 316 | 1 col · 316 | apilada |
| 820 | 788 | MD | 2 col · 365 | 3 col · 238 | 1 línea · concepto 364 |
| 1180 | 860 | LG | **4 col · 192** | 3 col · 262 | 1 línea · concepto 436 |
| 1440 | 896 | LG | 4 col · 201 | 3 col · 274 | 1 línea · concepto 472 |

En cotización los datos son cuatro campos: a 788 px de contenedor cuatro columnas dejarían el
folio en 165 px, así que el tramo MD va a **dos** columnas y la cuarta abre a 840.

---

## 1 · Estructura

1. Selector de tipo de documento (spec 04) · 2. Card **Plantilla** (spec 02 §1)
3. Card **Datos del documento** — con el **segmentado Recibo / Cotización en su cabecera**
4. Card **Seguro de gastos médicos** — *solo cotización*, nace cerrada
5. Card **Conceptos** — filas + bloque de cierre
6. Card **Pago** (recibo) / **Condiciones** (cotización)
7. Franja de lo conservado — solo cotización y solo con valores escritos
8. Barra de acciones sticky

---

## 2 · Segmentado de tipo

`.sp-doc-segmented` en la cabecera de Datos del documento, a la derecha del rótulo:
pista `--sp-surface-sunken` con padding 4 y radio 12; segmento activo `--sp-primary` con
texto `#fff`, 38 px de alto dentro de la cabecera de 56.
Ancho fijo **264 px** desde 600 px de contenedor; por debajo pasa a una **segunda línea de la
misma cabecera** a ancho completo (`flex: 1 0 100%`).

Cambiar de tipo **no borra nada**: los campos del otro tipo siguen en el mismo estado, solo
dejan de mostrarse y de imprimirse. El orden de las cards no cambia nunca.

---

## 3 · Las trece diferencias entre recibo y cotización

| # | Diferencia | Recibo | Cotización | Estado |
|---|---|---|---|---|
| 1 | Título del documento | `Recibo de Honorarios` | `Cotización` | ya en el código |
| 2 | Prefijo de folio | `NOH-` | `COT-` | **resuelto por estructura** (§4.1) |
| 3 | Etiqueta del primario | `Imprimir recibo` | `Imprimir cotización` | ya en el código |
| 4 | Nombre del archivo | `Nota_Honorarios` | `Cotizacion` | ya en el código |
| 5 | Aviso de generación | `Generando recibo…` | `Generando cotización…` | ya en el código |
| 6 | Aviso de guardado | `Recibo guardado` | `Cotización guardada` | ya en el código, **sin concordancia** hoy (`Cotizacion guardado`) |
| 7 | Forma de pago | se imprime | se omite del PDF | ya en el código |
| 8 | Seguro de gastos médicos | no se muestra | card propia | **hoy se muestra en ambos** |
| 9 | Vigencia | — | campo obligatorio | **no existe** |
| 10 | Origen por concepto | — | tercera columna | **no existe** |
| 11 | Subtotales | — | uno por origen usado | **no existe · derivado** |
| 12 | Anticipo | campo editable | — | **no existe** |
| 13 | Saldo | total − anticipo | — | **no existe · derivado** |

Siete ya están escritas. **Seis no existen** ni en el estado, ni en el `contenido` que se
guarda, ni en lo que recibe el renderizador: 9, 10, 11, 12, 13 y la exclusividad de 8.

---

## 4 · Elementos propios

### 4.1 · Folio

Lo asigna **la base** al insertar, con un generador único y el prefijo del tipo.
Consecuencia en pantalla: el campo no puede mostrar número antes de emitir.
`.sp-input` de solo lectura, fondo `--sp-surface-muted`, texto `--sp-ink-350`, valor
`Se asigna al emitir`, hint `Lo genera la base · prefijo COT` / `· prefijo NOH`.
Con esto **H-10** —`folio.replace('NOH-','COT-')`, que no revierte y deja folio COT en un
recibo— desaparece al cablear: queda **resuelto por cambio de estructura**.

### 4.2 · Fila de concepto

Tres trazados por contenedor. Áreas `c` (concepto), `o` (origen), `p` (precio), `d` (borrar):

| Contenedor | `grid-template-columns` | `grid-template-areas` |
|---|---|---|
| ≥ 760 (cotización) | `minmax(0,1fr) 168px 150px 40px` | `"c o p d"` |
| 520–759 (cotización) | `minmax(0,1fr) 150px 40px` | `"c p d" "o o o"` |
| < 520 (cotización) | `minmax(0,1fr) 40px` | `"c d" "o o" "p p"` |
| ≥ 520 (recibo) | `minmax(0,1fr) 150px 40px` | `"c p d"` |
| < 520 (recibo) | `minmax(0,1fr) 40px` | `"c d" "p p"` |

Con trazado de una línea, la cabecera de columnas se renderiza una vez
(`CONCEPTO` · `ORIGEN` · `PRECIO (MXN)`). Cuando se apila, **cada fila es una minitarjeta**
—borde 1 px `--sp-line-card`, radio 13, fondo `--sp-surface`— y cada celda lleva su etiqueta.
Cierra **H-02**: `grid-cols-[1fr_140px_36px]` fijo dejaba el concepto en 94 px a 390.

Precio: `.sp-input` con `padding-left: 28px`, `text-align: right`,
`font-variant-numeric: tabular-nums` y prefijo de moneda **según la divisa** (`$` / `US$`).
Borrar: 40×44, `Trash2` 18 px `--sp-ink-icon`; con una sola fila, visible y `disabled`.

### 4.3 · Origen del cobro — desplegable escribible

Patrón de referencia definido en `GUIA_FORM_IMAGENOLOGIA.md` §2.2. **No hay lista cerrada.**
Cuatro sugerencias, ordenadas por quién cobra:
`Honorarios médicos` (el cobro propio) · `Hospital` · `Anestesiólogo` · `Material e implantes`.
El campo acepta texto libre encima. Los subtotales **agrupan por el texto tal cual**, así que un
origen escrito a mano genera su propio subtotal. Pie del menú:
`Ninguno encaja: escribe el origen y se usa tal cual.`

### 4.4 · Bloque de cierre

Filas de 44 px, etiqueta a la izquierda y cifra a la derecha con `tabular-nums`.
**Siempre visible**, también con total en cero: hoy se renderiza solo con `total > 0` y aparece
y desaparece mientras se teclea.

| Tipo | Filas |
|---|---|
| Cotización | `Subtotal · {origen}` por cada origen usado + regla + **`Total cotizado`** 20 px/800 |
| Recibo | `Total` + **`Anticipo recibido`** (`.sp-input` de 170 px, el único número editable) + regla + **`Saldo pendiente`** |

**Anticipo:** dinero que el paciente **ya pagó** y que se resta del total. Si supera el total:
`.sp-banner--warn` `El anticipo supera el total. Revísalo antes de emitir.` — **no bloquea**
la emisión: puede haber saldo a favor legítimo.

Redondeo a dos decimales en cada línea y en cada suma, con `roundCurrency` que ya existe.

### 4.5 · Seguro de gastos médicos — solo cotización

Card con conmutador `role="switch"` + `aria-checked` + `aria-label`, 44×26 con perilla de 20.
**Nace cerrada.** Abierta: `data-cols="3"` con aseguradora · número de póliza · cobertura.
Aseguradora pasa de `<datalist>` a `.sp-select` con las 20 aseguradoras más `Otra`, que abre un
campo de texto: el `datalist` no filtra igual en Safari iOS y no se lee como campo con opciones.

### 4.6 · Franja de lo conservado

Solo en cotización y solo si forma de pago o anticipo tienen algo escrito.
`.sp-banner--info` con icono `EyeOff` 17 px:
`Forma de pago (Transferencia) y anticipo ($30,000.00) se conservan escritos, pero no salen en la cotización.`

---

## 5 · Cadenas literales

| Dónde | Texto |
|---|---|
| Primario | `Imprimir recibo` / `Imprimir cotización` — XS: `Imprimir` |
| Toast de éxito | `Recibo guardado` / `Cotización guardada` |
| `titulo` del modal 03 | `Recibo generado` / `Cotización generada` |
| Cabeceras | `DATOS DEL DOCUMENTO` · `SEGURO DE GASTOS MÉDICOS` · `CONCEPTOS` · `PAGO` / `CONDICIONES` |
| Segmentado | `Recibo` · `Cotización` |
| Chips de exclusividad | `Solo cotización` · `Solo recibo` |
| Cierre | `Subtotal · {origen}` · `Total cotizado` · `Total` · `Anticipo recibido` · `Saldo pendiente` |
| Vigencia | `30 días · hasta {fecha}` |
| Error por fila | `El precio debe ser mayor a 0` |
| Aviso de anticipo | `El anticipo supera el total. Revísalo antes de emitir.` |
| Banner de faltantes | `Faltan 2 campos: Paciente · Conceptos` |

---

## 6 · Campos: obligatorios, prellenados, retirados

| Campo | Qué pasa | Motivo |
|---|---|---|
| **Paciente** | Pasa a **obligatorio** | Una cotización sin nombre no sirve, y un recibo sin nombre no se puede anexar. Deja de ser la excepción del encargo |
| Fecha | Prellenada, `min` 1900-01-01, `max` +1 año | Ya acotada hoy |
| Folio | Solo lectura, lo asigna la base | §4.1 |
| Card **«Tipo de documento»** | **Se retira** | Una card entera para dos botones; el segmentado sube a la cabecera de Datos (§2) |
| Divisa · Forma de pago | Prellenados `MXN` / `Efectivo` | Sin cambio, con altura de sistema (44, hoy 40) |
| ≥ 1 concepto con precio > 0 | **Obligatorio** | Es el contenido del documento |
| Precio 0 | Sigue significando «sin escribir» | No hay caso de concepto gratuito en los datos reales |
| Error inline de precio | **Se conserva** | Es validación de formato por campo, no el cartel global que se retira |

---

## 7 · Colisiones que resuelve

| Id | Cómo |
|---|---|
| **H-01** | `resolvedClinicaId` siempre `null` y ningún montaje pasa `clinicaId`: **muere con la tabla** (§9) |
| **H-02** | Tres trazados de fila de concepto (§4.2) |
| **H-03** | La card de plantilla apila en XS (`1fr auto` → `1fr`, spec 02 §1) |
| **H-06** | Una sola disposición de barra: primario `flex:1` + secundario `flex:0 0 auto` |
| **H-10** | Resuelto por estructura: el folio lo genera la base (§4.1) |
| Total intermitente | Bloque de cierre siempre visible (§4.4) |
| Símbolo de moneda | El prefijo sigue la divisa (§4.2) |
| Concordancia de género | `Cotización guardada`, con tilde (§5) |
| Conmutador sin nombre | `role="switch"` + `aria-checked` + `aria-label` (§4.5) |
| **G-07** | `perfilPendiente` ya existe aquí; se conserva |

---

## 8 · Decisiones, una línea cada una

- **Un formulario y no dos** — escribir la cotización, cobrarla y emitir el recibo son el mismo trámite con diez minutos de diferencia.
- **Cambiar de tipo no borra nada** — volver al recibo devuelve el anticipo y la forma de pago tal como estaban.
- **Y lo declara en vez de callarlo** — ocultar sin avisar deja al médico sin saber si lo que escribió sigue ahí.
- **El orden de las cards no cambia** — cambiar de tipo no mueve de sitio nada que ya estuviera en pantalla.
- **El origen se sugiere, no se impone** — ninguna lista cerrada aguanta la facturación real; los subtotales agrupan por texto.
- **El anticipo no bloquea** — puede haber saldo a favor legítimo y el médico sabe mejor que el sistema.
- **Paciente obligatorio** — deja de ser la excepción: el documento sin nombre no sirve para nada.
- **Sin anexar al expediente** — el único de los ocho sin valor clínico; el modal queda con Correo y WhatsApp en una fila.

---

## 9 · Plantillas y NO DEFINIDO

**Plantillas: cerrado.** `plantillas_honorarios` tiene **dos filas** en producción, de dos
médicos distintos, ambas de abril de 2026. Consultado y decidido: **no se migran**. La tabla se
retira y `plantillas_documento` nace limpia. H-01 muere con ella: no se parchea, se sustituye.
En esta guía el selector solo se coloca donde manda el spec 02 §1.

**NO DEFINIDO propio:** ninguno.
Los dos que había —lista de orígenes y naturaleza del anticipo— quedan cerrados en §4.3 y §4.4.
