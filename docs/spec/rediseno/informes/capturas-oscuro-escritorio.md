# Capturas en modo oscuro (teléfono) y escritorio — revisión

Fecha: 2026-11-19 · App compilada en `localhost:3000` contra Supabase local, datos ficticios, usuario `admin.a@semilla.spinus.test`.

- Capturas oscuro teléfono: `scratchpad/cap-oscuro/` — 30 PNG (20 a 466×678 `@ext`, 5 a 669×951 `@iv`, 5 a 951×669 `@ih`) + `metricas-ext.json`, `metricas-iv.json`, `metricas-ih.json`.
- Capturas escritorio: `scratchpad/cap-escritorio/` — 65 PNG (20 `@d-claro`, 20 `@d-oscuro`, 4 `@d1280`, y 21 segundas capturas `-2` con `<main>` desplazado) + `metricas-d-claro.json`, `metricas-d-oscuro.json`, `metricas-d1280.json`.
- Guion: `scratchpad/tools/cap-od.js` (derivado de `cap.js`, que no se tocó). Sonda de colores: `scratchpad/tools/sonda-od.js`.
- Hojas de contacto usadas para revisar: `scratchpad/sheets/od/`.

## Cómo se activa el oscuro (mecanismo real)

No sigue `prefers-color-scheme`. `ScriptTema.tsx` y `ThemeProvider.tsx` leen `localStorage.theme === 'dark'` y ponen la clase `dark` en `<html>`; el botón «Modo oscuro» del Sidebar escribe esa misma clave. El guion la fija con `addInitScript` antes de cada carga. Verificado por captura y por métrica: las 50 capturas oscuras tienen `dark: true` y `bodyBg: rgb(18, 18, 18)` en su JSON.

Consecuencia observada: `/inicio` (launcher) usa otra paleta oscura (azul noche casi negro, `inicio@d-oscuro.png`) y la agenda otra más (navy azulado, `agenda@d-oscuro.png`, `agenda-config@d-oscuro.png`), frente al gris neutro `#121212/#1E1E1E` del resto. Son tres «oscuros» distintos en la misma app.

## A. Modo oscuro — defectos, de más a menos grave

### 1. GRAVE — Texto casi invisible: `text-[#3d3d3f]` no tiene traducción a oscuro
La hoja de traducción cubre `text-[#1d1d1f]` y `text-[#86868b]`, pero no `#3d3d3f`. Medido con la sonda: color `rgb(61,61,63)` sobre fondo `rgb(30,30,30)` (contraste ≈ 1,5:1).
- **Lista de pacientes**: las columnas Edad, Expediente y Fecha de ingreso no se leen. `expediente-lista@d-oscuro.png`, `expediente-lista@d-oscuro-2.png`, `expediente-lista@ih.png` (tabla), y en tarjetas los valores de «Expediente» e «Ingreso»: `expediente-lista@ext.png`, `expediente-lista@iv.png`. Es la pantalla más usada y pierde la mitad de sus datos.
- **Editar paciente**: el botón «Cancelar» queda como un rectángulo vacío. `exp-editar@d-oscuro-2.png`.
- **Estadísticas**: la etiqueta del eje Y de «Top 10 diagnósticos» («Lumbago no especificad…») no se lee: el `tick` lleva `fill: '#3d3d3f'` fijo. `estadisticas@d-oscuro.png`, `estadisticas@ext.png`.
- Mismo token en `src/app/(app)/expediente/page.tsx` (5), `TablaPacientesExpediente.tsx` (3), `SheetFiltrosExpediente.tsx` (3), `admin/usuarios/page.tsx` (3), `estadisticas/page.tsx` (2), `Breadcrumbs.tsx`, `documentos/page.tsx`, `expediente/[id]/editar/page.tsx`. Una sola regla en la hoja de traducción lo arreglaría todo salvo los `fill` de Recharts.

### 2. GRAVE — Gráficas de Estadísticas no se adaptan
`CartesianGrid stroke="#f1f5f9"` fijo: en oscuro la rejilla punteada sale casi blanca y pesa más que la propia serie. `estadisticas@d-oscuro.png`, `estadisticas@d-oscuro-2.png`, `estadisticas@ext.png`. Además la línea y las barras usan el azul de marca sin aclarar (poco contraste sobre `#1E1E1E`), y el anillo de «Distribución por sexo» conserva un borde blanco entre sectores.

### 3. MEDIO — «Generar con Spinus» deshabilitado es un bloque claro
En reposo (deshabilitado) el botón queda en `rgb(182,198,218)` con texto blanco: una franja gris-azul clara de 660×56 px que es lo más brillante de la pantalla y además ilegible. `nueva-nota@d-oscuro.png`, `nueva-nota@d-oscuro-2.png`, `nueva-nota@iv.png`.

### 4. MEDIO — Divisores blancos a pleno contraste en Usuarios
La línea entre las dos filas de «Tu equipo» y el separador vertical Médicos/Asistentes salen en blanco casi puro, mientras el resto de bordes va al 8-12 %. `admin-usuarios@d-oscuro.png`, `admin-usuarios@ext.png`. El marcado usa `divide-x divide-slate-100` / `divide-y divide-slate-100`. ASUMIENDO QUE la causa es que la regla `html.dark .divide-slate-100 > * + *` no coincide con el selector que genera Tailwind 4 para `divide-*`; no lo comprobé en el CSS compilado.

### 5. MEDIO — Barra lateral: más clara que el contenido y con la tarjeta amarilla intacta
- En oscuro la barra pasa a `oklch(0.42 0.07 252)` (azul pizarra medio): es **más clara** que en claro (navy `#1a3a5c`) y mucho más clara que el contenido `#121212`. El ojo se va a la barra, no al trabajo. Todas las `*@d-oscuro.png`; en teléfono `menu-abierto@ext.png`.
- La tarjeta «3 datos pendientes» sigue en amarillo saturado con degradado: es el elemento más luminoso de toda la pantalla en las 20 capturas oscuras de escritorio.
- El ítem activo pasa de píldora blanca (claro) a píldora casi negra (oscuro): correcto, pero sobre esa barra más clara queda como un «hueco».
- El logo circular (fondo blanco) no se adapta; aceptable, pero destaca.

### 6. MENOR
- **Títulos de página con color distinto**: en oscuro «Nota de Consulta», «Documentos» (del expediente) y «Protocolo de Suplementación» salen en azul claro `#93c5fd` (vienen de `text-[#1a3a5c]`), mientras «Expediente Clínico», «Mi perfil», «Usuarios», «Facturación», «Estadísticas clínicas» y «Nueva Nota Médica» salen en blanco. `consulta@d-oscuro.png`, `exp-documentos@d-oscuro.png`, `suplementacion@d-oscuro.png` frente a `perfil@d-oscuro.png`.
- **Checkbox blanco** del aviso de privacidad sobre fondo negro. `paciente-nuevo@d-oscuro.png`.
- **Bordes de tarjeta casi invisibles** en zonas punteadas: «Sin firma», carga de archivos, «Mediciones longitudinales». `perfil@d-oscuro.png`, `exp-labs@d-oscuro.png`.
- **Vista previa del encabezado de PDF** queda blanca (`perfil@d-oscuro-2.png`): correcto, representa papel; lo anoto solo para que no se «arregle».
- **Agenda, configuración**: los pulgares de los interruptores son negros sobre pista azul; se leen peor que en claro. `agenda-config@d-oscuro.png`, `agenda-config@ext.png`.
- **Dashboard**: «Nuevo documento» y «Nuevo paciente» casi no tienen borde ni fondo, parecen texto suelto frente a «Expedientes», que sí tiene borde. `dashboard@ext.png`, `dashboard@d-oscuro.png`.

### Lo que está bien en oscuro
Inputs, selects y fechas; insignias de estado (Confirmada/Agendada, prioridades); agenda semanal y de 3 días con sus colores por estado (`agenda@d-oscuro.png`, `agenda@ih.png`); avisos ámbar/azul de paciente nuevo; ayuda; facturación; expediente del paciente. No encontré ningún fondo blanco que se quede sin cambiar fuera de la vista previa de PDF.

### No es de oscuro, pero aparece en estas capturas (teléfono 466×678)
- **Consulta**: el encabezado desborda: «Imprimir» queda cortado bajo la franja derecha y `<main>` mide 485 > 466 px. Repetido en contexto nuevo (`FRESH=1`) con el mismo resultado y `visualViewport.scale = 1`, así que es defecto real y no zoom heredado. `consulta@ext.png`.
- **Expediente**: la barra de pestañas se corta en «Medi…» (584 > 434 px, con scroll horizontal). `expediente@ext.png`, `exp-labs@ext.png`.
- **Expediente-lista** en 951×669: la tabla de escritorio entra completa, pero el menú de tres puntos cae dentro de la franja derecha. `expediente-lista@ih.png`.

## B. Escritorio — layout

### Barra lateral
- Ancho fijo **256 px** a 1440 y a 1280 (17,8 % y 20 % del ancho). Contenido útil: 1184 px y 1024 px.
- **La navegación no cabe y se corta sin indicarlo.** La tarjeta «3 datos pendientes» (≈200 px) más «Modo oscuro / Cerrar sesión» ocupan el tercio inferior fijo, y el `<nav>` queda con 339 px visibles para 369+ de contenido (medido). A 1440×900 «Ayuda» sale cortada por la mitad (`dashboard@d-claro.png`, `perfil@d-claro.png`); con un submenú abierto, «Mi perfil» y «Ayuda» desaparecen del todo (`expediente-lista@d-claro.png`, `estadisticas@d-claro.png`); en Facturación el propio ítem activo queda cortado (`billing@d-claro.png`). A **1280×800 solo se ven 4-5 entradas** («Documentos» ya cortado; `agenda@d1280.png`, `dashboard@d1280.png`). No hay barra de scroll visible que avise.
- «Plegar menú» aparece solo en Agenda y Configuración de agenda (`agenda@d-claro.png`), no en las demás pantallas.
- `menu-abierto@d-*.png` es idéntico a `dashboard@d-*.png`: en escritorio no existe botón «Abrir menú» (la barra es permanente).

### Ancho y alineación del contenido: siete columnas distintas
Borde izquierdo del contenido y ancho, medidos sobre las capturas a 1440:

| Pantalla | x inicio | ancho aprox. | Captura |
|---|---|---|---|
| expediente-lista, estadísticas, nueva-nota, agenda | 288 | 1120 (todo el ancho) | `expediente-lista@d-claro.png` |
| dashboard | 326 | 1044 | `dashboard@d-claro.png` |
| expediente, exp-labs, perfil | 368 | 960 | `expediente@d-claro.png` |
| consulta, exp-documentos, documentos, suplementación, ayuda | 400 | 896 | `consulta@d-claro.png` |
| facturación | 464 | 768 | `billing@d-claro.png` |
| agenda-config | 468 | 760 | `agenda-config@d-claro.png` |
| exp-editar, admin-usuarios | 512 | 672 | `exp-editar@d-claro.png` |
| paciente-nuevo | 560 | 576 | `paciente-nuevo@d-claro.png` |

Al navegar entre pantallas hermanas el título salta de sitio: lista (288) → expediente (368) → consulta (400) → editar (512) → paciente nuevo (560).

### Encabezados inconsistentes
Hay al menos cinco patrones de cabecera:
1. Antetítulo en versalitas + H1 mediano (≈22 px) + subtítulo: Expediente Clínico, Documentos, Usuarios, Facturación, Estadísticas.
2. Antetítulo + H1 grande (≈28-30 px): Dashboard («CENTRO»), Mi perfil («CUENTA»).
3. Flecha atrás + icono + H1 en color de marca: Nota de Consulta, Documentos del paciente, Protocolo de Suplementación (este último sin flecha).
4. Migas de pan + H1 muy grande: Nueva Nota Médica (migas «Inicio › Expediente › Paciente › Nueva Nota» **además** de flecha atrás).
5. Solo migas cortas con flecha, sin H1: Paciente nuevo («← Pacientes / Nuevo paciente»), Editar paciente; y «← Volver a pacientes» como enlace gris en el expediente.
Ayuda usa un sexto (icono en cuadro + H1). El botón de acción principal también cambia de sitio: a la derecha del título (lista, usuarios), en fila propia bajo el título (expediente, dashboard).

### Densidad y espacio desperdiciado
- **Documentos** (`documentos@d-claro.png`): una tarjeta de 512 px pegada a la izquierda de una columna de 896 y el 80 % de la pantalla vacío.
- **Documentos del paciente** (`exp-documentos@d-claro.png`): 8 tarjetas en dos filas arriba y 570 px en blanco debajo.
- **Consulta** (`consulta@d-claro.png`): la nota va en una columna interior de 620 px dentro de una tarjeta de 896, descentrada (margen izquierdo 138, derecho ≈ 138 hasta la línea pero la firma queda a la izquierda); dos tercios de pantalla vacíos.
- **Usuarios, Facturación, Paciente nuevo**: formularios estrechos centrados con > 50 % de pantalla sin uso; aceptable en formularios, pero Usuarios es una lista y se beneficiaría del ancho.
- **Estadísticas** (`estadisticas@d-claro.png`): «Top 10 diagnósticos» con un solo dato dibuja una barra de 260×215 px; la gráfica no limita el grosor de barra. «Top 10 medicamentos» vacío ocupa una tarjeta de 550×390.
- **Lista de pacientes**: filas de 67 px a todo el ancho; caben 10 pacientes a 900 px de alto. La columna «Paciente» se lleva 330 px y los datos quedan separados por grandes huecos. A 1280 funciona igual de bien (`expediente-lista@d1280.png`), con el buscador recortando su placeholder («Buscar por nombre o apel»).
- **Dashboard**: a 1440 cabe sin scroll (`dashboard@d-claro.png`); a 1280×800 sobran 41 px y aparece scroll por muy poco (`dashboard@d1280.png`, `dashboard@d1280-2.png`).
- **Agenda**: buen uso del ancho en ambos tamaños. A 1280 el selector de médico se reduce a «Dr. A…» y el rango a «16 – 22 nov …» (`agenda@d1280.png`); las citas cortas truncan el nombre («Paciente …») incluso a 1440.
- **Expediente**: dos columnas 604 + 330 bien equilibradas; «Eliminar paciente» queda suelto abajo a la derecha (`expediente@d-claro.png`).
- **Perfil**: columna izquierda de resumen (310 px) repite datos del formulario de la derecha; página de 2113 px de alto (`perfil@d-claro.png`, `perfil@d-claro-2.png`).

### Objetivos pequeños en escritorio
En escritorio casi todos los controles miden < 44 px de alto (p. ej. 48 de 50 en la lista, 53 de 65 en agenda). Con ratón no es un defecto; lo dejo en las tablas porque estas mismas vistas se sirven a tabletas en horizontal. Más relevante: textos < 12 px — 70 de 124 en agenda, 33 de 115 en la lista, 33 de 91 en dashboard, 22 de 50 en estadísticas.

## C. Métricas por captura

Sin desborde horizontal de página en ninguna captura. «En franja» = controles que caen bajo la franja del sistema emulada (solo teléfono).

**cap-oscuro · @ext**

| captura | controles <44 px / total | <32 px | textos <12 px / total | desborde X página | contenedores con scroll X | en franja |
|---|---|---|---|---|---|---|
| inicio@ext | 2 / 4 | 1 | 1 / 9 | no | — | 4 |
| dashboard@ext | 2 / 8 | 1 | 10 / 32 | no | — | 6 |
| expediente-lista@ext | 10 / 10 | 6 | 8 / 31 | no | — | 6 |
| paciente-nuevo@ext | 7 / 7 | 1 | 1 / 16 | no | — | 5 |
| expediente@ext | 6 / 14 | 5 | 5 / 26 | no | div[Secciones del expediente]:Resumen Co (584>434) | 9 |
| consulta@ext | 3 / 4 | 1 | 1 / 13 | no | main:Nota de Consulta Pacien (485>466) | 2 |
| exp-documentos@ext | 2 / 10 | 1 | 0 / 10 | no | — | 4 |
| exp-editar@ext | 8 / 8 | 1 | 11 / 15 | no | — | 6 |
| exp-labs@ext | 2 / 11 | 1 | 2 / 17 | no | div[Secciones del expediente]:Resumen Co (585>434) | 6 |
| nueva-nota@ext | 11 / 12 | 10 | 5 / 22 | no | — | 2 |
| agenda@ext | 0 / 13 | 0 | 1 / 47 | no | — | 5 |
| agenda-config@ext | 3 / 9 | 2 | 4 / 15 | no | — | 2 |
| documentos@ext | 2 / 2 | 0 | 2 / 6 | no | — | 1 |
| suplementacion@ext | 1 / 1 | 0 | 0 / 20 | no | — | 0 |
| perfil@ext | 1 / 4 | 0 | 1 / 13 | no | — | 0 |
| estadisticas@ext | 2 / 2 | 0 | 14 / 18 | no | — | 1 |
| admin-usuarios@ext | 4 / 4 | 2 | 8 / 17 | no | — | 3 |
| billing@ext | 1 / 1 | 0 | 1 / 16 | no | — | 0 |
| ayuda@ext | 1 / 1 | 0 | 7 / 19 | no | — | 0 |
| menu-abierto@ext | 17 / 25 | 5 | 13 / 52 | no | — | 6 |

**cap-oscuro · @iv**

| captura | controles <44 px / total | <32 px | textos <12 px / total | desborde X página | contenedores con scroll X | en franja |
|---|---|---|---|---|---|---|
| dashboard@iv | 8 / 14 | 1 | 18 / 48 | no | — | 2 |
| expediente-lista@iv | 12 / 12 | 8 | 11 / 44 | no | — | 0 |
| expediente@iv | 9 / 17 | 8 | 8 / 38 | no | — | 1 |
| nueva-nota@iv | 12 / 14 | 11 | 5 / 24 | no | — | 1 |
| agenda@iv | 0 / 13 | 0 | 2 / 59 | no | — | 0 |

**cap-oscuro · @ih**

| captura | controles <44 px / total | <32 px | textos <12 px / total | desborde X página | contenedores con scroll X | en franja |
|---|---|---|---|---|---|---|
| dashboard@ih | 1 / 7 | 0 | 10 / 30 | no | — | 5 |
| expediente-lista@ih | 24 / 24 | 16 | 22 / 61 | no | — | 10 |
| expediente@ih | 6 / 14 | 5 | 5 / 28 | no | — | 4 |
| nueva-nota@ih | 11 / 12 | 10 | 5 / 27 | no | — | 1 |
| agenda@ih | 10 / 27 | 5 | 37 / 59 | no | — | 9 |

**cap-escritorio · @d-claro**

| captura | controles <44 px / total | <32 px | textos <12 px / total | desborde X página | contenedores con scroll X | en franja |
|---|---|---|---|---|---|---|
| inicio@d-claro | 2 / 5 | 1 | 1 / 17 | no | — | 0 |
| dashboard@d-claro | 28 / 36 | 8 | 33 / 91 | no | — | 0 |
| expediente-lista@d-claro | 48 / 50 | 28 | 33 / 115 | no | — | 0 |
| paciente-nuevo@d-claro | 23 / 28 | 7 | 4 / 42 | no | — | 0 |
| expediente@d-claro | 26 / 38 | 13 | 15 / 70 | no | — | 0 |
| consulta@d-claro | 19 / 22 | 5 | 4 / 35 | no | — | 0 |
| exp-documentos@d-claro | 18 / 28 | 5 | 3 / 32 | no | — | 0 |
| exp-editar@d-claro | 28 / 31 | 5 | 21 / 44 | no | — | 0 |
| exp-labs@d-claro | 20 / 31 | 6 | 6 / 43 | no | — | 0 |
| nueva-nota@d-claro | 28 / 32 | 15 | 9 / 58 | no | — | 0 |
| agenda@d-claro | 53 / 65 | 19 | 70 / 124 | no | — | 0 |
| agenda-config@d-claro | 23 / 40 | 11 | 7 / 51 | no | — | 0 |
| documentos@d-claro | 24 / 26 | 4 | 5 / 34 | no | — | 0 |
| suplementacion@d-claro | 17 / 19 | 4 | 3 / 54 | no | — | 0 |
| perfil@d-claro | 16 / 30 | 5 | 4 / 52 | no | — | 0 |
| estadisticas@d-claro | 19 / 21 | 4 | 22 / 50 | no | — | 0 |
| admin-usuarios@d-claro | 21 / 23 | 6 | 11 / 40 | no | — | 0 |
| billing@d-claro | 18 / 20 | 4 | 4 / 41 | no | — | 0 |
| ayuda@d-claro | 15 / 18 | 4 | 22 / 68 | no | — | 0 |
| menu-abierto@d-claro | 28 / 36 | 8 | 33 / 91 | no | — | 0 |

**cap-escritorio · @d-oscuro**

| captura | controles <44 px / total | <32 px | textos <12 px / total | desborde X página | contenedores con scroll X | en franja |
|---|---|---|---|---|---|---|
| inicio@d-oscuro | 2 / 5 | 1 | 1 / 17 | no | — | 0 |
| dashboard@d-oscuro | 28 / 36 | 8 | 33 / 91 | no | — | 0 |
| expediente-lista@d-oscuro | 48 / 50 | 28 | 33 / 115 | no | — | 0 |
| paciente-nuevo@d-oscuro | 23 / 28 | 7 | 4 / 42 | no | — | 0 |
| expediente@d-oscuro | 26 / 38 | 13 | 15 / 70 | no | — | 0 |
| consulta@d-oscuro | 19 / 22 | 5 | 4 / 35 | no | — | 0 |
| exp-documentos@d-oscuro | 18 / 28 | 5 | 3 / 32 | no | — | 0 |
| exp-editar@d-oscuro | 28 / 31 | 5 | 21 / 44 | no | — | 0 |
| exp-labs@d-oscuro | 20 / 31 | 6 | 6 / 43 | no | — | 0 |
| nueva-nota@d-oscuro | 28 / 32 | 15 | 9 / 58 | no | — | 0 |
| agenda@d-oscuro | 53 / 65 | 19 | 70 / 124 | no | — | 0 |
| agenda-config@d-oscuro | 23 / 40 | 11 | 7 / 51 | no | — | 0 |
| documentos@d-oscuro | 24 / 26 | 4 | 5 / 34 | no | — | 0 |
| suplementacion@d-oscuro | 17 / 19 | 4 | 3 / 54 | no | — | 0 |
| perfil@d-oscuro | 16 / 30 | 5 | 4 / 52 | no | — | 0 |
| estadisticas@d-oscuro | 19 / 21 | 4 | 22 / 50 | no | — | 0 |
| admin-usuarios@d-oscuro | 21 / 23 | 6 | 11 / 40 | no | — | 0 |
| billing@d-oscuro | 18 / 20 | 4 | 4 / 41 | no | — | 0 |
| ayuda@d-oscuro | 15 / 18 | 4 | 22 / 68 | no | — | 0 |
| menu-abierto@d-oscuro | 28 / 36 | 8 | 33 / 91 | no | — | 0 |

**cap-escritorio · @d1280**

| captura | controles <44 px / total | <32 px | textos <12 px / total | desborde X página | contenedores con scroll X | en franja |
|---|---|---|---|---|---|---|
| dashboard@d1280 | 28 / 36 | 8 | 33 / 91 | no | — | 0 |
| expediente-lista@d1280 | 45 / 47 | 25 | 29 / 104 | no | — | 0 |
| expediente@d1280 | 26 / 38 | 13 | 15 / 70 | no | — | 0 |
| agenda@d1280 | 53 / 65 | 24 | 76 / 133 | no | — | 0 |

## Pantallas no capturadas o con salvedad

- Ninguna ruta en alcance quedó sin capturar.
- `exp-labs`: `/expediente/[id]/laboratorios` redirige a `/expediente/[id]?tab=mediciones`; la captura es la pestaña «Mediciones y archivos» (igual que en el inventario en claro).
- `menu-abierto` en escritorio: no hay botón «Abrir menú»; la captura equivale a `dashboard`.
- Segundas capturas `-2`: solo existen donde `<main>` (o un contenedor dentro de él, caso de la agenda) tiene scroll: expediente-lista, exp-editar, nueva-nota, agenda, agenda-config, suplementación, perfil, estadísticas, ayuda (claro y oscuro) y dashboard, expediente-lista, agenda a 1280. Son una pantalla más abajo, no la página entera: perfil (2113 px) y ayuda (2330 px) tienen contenido más allá de la segunda captura.
- `billing` y `exp-labs` tienen animación de entrada lenta; con 1,8 s de espera salían a medio fundido. Se repitió todo el escritorio con 3,5 s.
