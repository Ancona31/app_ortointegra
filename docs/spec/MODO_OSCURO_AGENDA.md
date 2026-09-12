# Modo oscuro · Agenda Spinus

Extracto de `SPEC Agenda Spinus.md` §16, autocontenido para implementar el tema oscuro sin
leer el spec entero. Los valores de modo claro están en §1.1, §4 y §5 del spec.


Todo se compone sobre **`#1E1E1E`** — la superficie que `html.dark` escribe sobre el
`bg-white` del contenedor de la agenda. **No es el azul oscuro del resto de la app**, y esa
distinción es la que hace que estos veinte valores no se puedan derivar de los del chrome.

### 1 Los veinte valores

Con la asignación de §4 (ámbar → agendada, azul → confirmada, verde → atendida). El ratio es
del `text` contra su propio `bg` ya compuesto sobre `#1E1E1E`.

| Estado | `dot` | `text` | `bg` | `border` | Ratio |
|---|---|---|---|---|---|
| agendada | `#fbbf24` | `#fcd34d` | `rgba(217,119,6,.18)` | `rgba(251,191,36,.36)` | **8.98:1** |
| confirmada | `#6b9bff` | `#a9c8ff` | `rgba(30,95,168,.20)` | `rgba(107,155,255,.36)` | **8.48:1** |
| atendida | `#34d399` | `#7eecb4` | `rgba(22,163,74,.18)` | `rgba(52,211,153,.34)` | **9.04:1** |
| cancelada | `#ef4444` | `#fca5a5` | `rgba(192,57,43,.18)` | `rgba(239,68,68,.36)` | **7.64:1** |
| no asistió | `#9fb0c4` | `#c7d2e0` | `rgba(120,134,158,.22)` | `rgba(148,163,184,.40)` | **8.04:1** |

**Los cinco pasan AA con margen.** El más bajo es cancelada con 7.64:1 y el umbral es 4.5:1,
así que ninguno depende del tamaño de texto — las horas a 11.5 px y las píldoras a 10.5 px
están cubiertas.

Qué cambia respecto de producción:

- **ámbar es nuevo.** No existía porque «agendada» era azul.
- **azul y verde se mueven** un puesto (los valores de `scheduled` pasan a confirmada, los de
  `confirmed` a atendida). El `bg` del azul se re-basa a `#1e5fa8`, que es el azul del spec, en
  vez de `#2f6fed`.
- **teal queda libre.** Es el mejor color de evento que había y hoy está bloqueado por
  «atendida».
- **cancelada baja** de `#f87171` a `#ef4444` (ver 16.3).
- **no asistió no cambia.**

### 2 El criterio de derivación

Para cualquier valor futuro, el patrón que ya sigue la app y que estos veinte respetan:

| Rol | Regla |
|---|---|
| `dot` | El tono claro de la familia (nivel 400 de la escala). Mínimo **3:1 contra su propio `bg`** — es un gráfico, no texto. |
| `text` | Un escalón más claro que el `dot` (nivel 300). Da 7–9:1 sobre el `bg`. |
| `bg` | El **hex de modo claro** al 18–22 % sobre `#1E1E1E`. No un hex nuevo: así el tono es reconociblemente el mismo estado. |
| `border` | El `dot` al 34–40 %. |

Los dots contra su fondo compuesto: ámbar 7.75:1 · azul 5.31:1 · verde 6.79:1 · **rojo
3.86:1** · gris 5.56:1. El rojo es el más apretado y el único que conviene mirar en pantalla:
pasa el 3:1 de gráfico, pero sin holgura.

### 3 El par carmin / cancelada — arreglado por los dos lados

En oscuro, `carmin #ee689d` y `cancelada #f87171` están a **23.7° de hue y 1.07:1 de
luminancia**: empatan en los dos ejes, que es justo lo que la regla de §5 prohíbe. Un rojo más
oscuro solo no basta —lleva la razón a 1.27:1, aún fina—, así que se mueven los dos:

| | Antes | Después |
|---|---|---|
| cancelada `dot` | `#f87171` | **`#ef4444`** |
| carmin | `#ee689d` | **`#f472b6`** |
| Separación | 23.7° · 1.07:1 | **31.4° · 1.51:1** |

`carmin` se mueve porque **es el que puede**: la base guarda el nombre, no el hex, así que es
CSS. Y el rojo de peligro tiene menos margen de maniobra que un color decorativo — tiene que
seguir leyéndose como rojo y seguir siendo visible a 7 px.

Si tras esto el punto del mes sigue costando, la salida no es seguir retiñendo: es **retirar
`carmin` y quedarse en cinco**, con `magenta` cubriendo el rango rosa.

### 4 El ámbar entrante contra bronce

El ámbar nuevo deja a `bronce #e2a36b` a **15.1° y 1.30:1** — otro empate en los dos ejes que
el modo claro no tenía.

**Manda el estado.** Es el mismo principio que sacó a `teal` y `pizarra` de la paleta en modo
claro: cuando un estado y un color decorativo colisionan, **se mueve el decorativo**. Los
estados los lee todo el mundo todos los días; el color de un evento lo eligió una persona una
vez.

`bronce` en oscuro baja a **`#c98a4b`** → 1.74:1 contra el ámbar, y sigue en 5.73:1 contra
`#1E1E1E` como punto de 7 px.

`oliva #a3e635` queda a 39.4° del ámbar: separación de hue sobrada, no se toca.

### 5 La paleta de eventos completa en oscuro

| Identificador | Claro | Oscuro |
|---|---|---|
| `indigo` | `#3730a3` | `#818cf8` |
| `magenta` | `#a21caf` | `#e879f9` |
| `carmin` | `#be185d` | **`#f472b6`** (ajustado) |
| `oliva` | `#4d7c0f` | `#a3e635` |
| `bronce` | `#78350f` | **`#c98a4b`** (ajustado) |
| `grafito` | `#1f2937` | `#7f96b8` |

Google Calendar en oscuro: `#a78bfa`, hora `#c4b5fd`, fondo `rgba(167,139,250,.16)`, borde
`rgba(167,139,250,.34)`. La marca de Google **no se tiñe** en ninguno de los dos modos.

### 6 Neutrales y superficies

| Rol | Valor | Nota |
|---|---|---|
| Superficie de la agenda | `#1E1E1E` | el `bg-white` reescrito |
| Elevada | `#262626` | toolbar, cards del panel |
| Hundida | `#171717` | tiles del resumen, botón de hueco |
| Línea | `rgba(255,255,255,.10)` | rejilla y divisores |
| Línea fuerte | `rgba(255,255,255,.16)` | borde de marco, borde discontinuo de hueco |
| Texto principal | `#e8ecf1` | 14.0:1 |
| Texto secundario | `#a8b4c2` | 7.91:1 |
| Texto terciario | `#7b8798` | 4.62:1 — **es el piso, no bajar** |
| Fuera de horario | `#242424` | el equivalente de `#f1f4f7`: plano, apenas separado del fondo |
| Hoy | `rgba(47,111,237,.10)` | |

**El azul primario sube de `#1e5fa8` a `#2f6fed`.** El de modo claro queda en 2.9:1 sobre
`#1E1E1E` y no llega a AA para el botón «Nueva cita». Es el único token de marca que cambia
de hex entre modos.

Las líneas van en `rgba` blanco, no en un gris opaco: así funcionan igual sobre `#1E1E1E`,
`#262626` y `#171717` sin necesitar tres valores.

### 7 Lo que NO cambia entre modos

Para que nadie lo re-decida: **formas, tamaños, pesos, espaciados, radios, iconos y
tipografía son idénticos.** El modo oscuro es una sustitución de color, nunca un rediseño. En
particular siguen valiendo la barra de 3 px, el punto cuadrado para evento vs. redondo para
cita, el tachado de cancelada, el borde discontinuo de los huecos y el anillo de foco de 3 px
—que en oscuro pasa a `#6b9bff` para no perderse contra `#1E1E1E`.
