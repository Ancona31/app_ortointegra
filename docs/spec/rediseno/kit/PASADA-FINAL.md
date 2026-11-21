# Pasada final de las páginas anteriores a la agenda

S = /tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
Tus vistas se hicieron antes de varias reglas y decisiones. Ponlas al día SIN rediseñar: mismo layout y tono aprobados. Lee `S/entrega/kit/CALMA.md` §23–§29 y `S/entrega/kit/INTEGRACION.md` antes de empezar. Copias `*.v5.bak` de fuentes y vistas antes de tocar; edita las fuentes, no el resultado. Responde en español. El repo `/home/user/app_ortointegra` es de solo lectura.

## 1. Textos contra el código (lo más importante)
En las primeras tandas algunos agentes inventaron textos. Recorre TODO texto visible de tus vistas (títulos, rótulos, botones, ayudas, placeholders, vacíos, errores, avisos, alertas, opciones de menú) y verifícalo contra el código real del clon `S/app` (commit 951e31b3 de feature/agenda-v2; busca el componente de cada pantalla en `src/app/(app)/…` y `src/components/…`) y `S/informes/funciones-componentes.md`. Regla: el texto de la maqueta = el del código, salvo los cambios ya aprobados por el dueño, que se conservan:
«Expediente» (navegación y título de la lista), «+ Paciente» / «+ Consulta» / «+ Documento» en `ext`, «Tipo de documento», «Cambiar» / «Gestionar» en alertas, «Descargar», encabezados de mediciones «Analito · Último valor · Estado · Fecha», «funciones» y «Prueba» en Facturación, grupo «Ajustes» en Mi perfil, «Reintentar» en Estadísticas, «Fecha de ingreso ↓» en `ext`/`iv`, «Es otra persona» + «Si es otra persona, se creará el registro de todos modos.», «Sin coincidencias.», «Invitar» / «No invitar», rótulos «‹ Paciente Prueba 01» en notas, los de CALMA §28–§29.
Entrega una TABLA «texto de la maqueta → texto del código (archivo:línea) → acción (corregido / aprobado / propuesta)». Lo que no encuentres en el código y no esté aprobado: corrígelo al texto real o, si de verdad no existe equivalente, márcalo PROPUESTA y lístalo arriba del informe. Datos de ejemplo (nombres de pacientes ficticios, fechas) no cuentan.

## 2. Funciones contra el inventario
Tabla obligatoria «ítem del inventario (`S/informes/funciones-componentes.md`, sección de tu pantalla) → dónde está en la maqueta / FALTA». Si falta algo, dibújalo.

## 3. Capas según el catálogo (§25–§26)
En `ext` ninguna capa es hoja inferior: modales, hojas, menús y rejillas son TARJETA CENTRADA en el área de contenido (ancho máx. 310, velo, nace del centro, sin asa). Hoja inferior arrastrable solo en `tel`. `ih`/`iv`/`esc` tarjeta centrada; menús sin velo solo en `esc`. Alertas en `ext` centradas en el área de contenido (310). Usa como referencia `S/entrega/capas-a/vista-*.html`.

## 4. Navegación al día (§28)
Copia la navegación actual de `S/entrega/dashboard-final/vista-dashboard.html` (o de `S/entrega/cromo/`): aviso «N datos pendientes» (tarjeta ámbar en la barra lateral de `esc`/`ih`, plegada en `ih`; distintivo en `ext`/`tel`/`iv`), logo de la clínica en el botón de consultorio, quinta píldora «Más» en `iv`, «···/Más» en `ext`, pie con «Mi perfil · Ajustes» (médico) y Ayuda. Sin cambiar la sección marcada en cada vista.

## 5. Botones
Pasa `node S/tools/chk-botones.js <tu pagina.html> --vp ext,tel,iv` (y con estados) hasta 0 hallazgos reales; aplica la regla de `S/entrega/agenda-base/PIEZAS.md` §13 (8 px libres por lado; lado a lado solo si el más largo cabe en la mitad, si no ancho por contenido, si no apilar).

## 6. Limpieza
Dentro del marco no puede haber marcadores de maqueta ni de reparto («no se dibuja», «otro agente», «propuesta», etc.): van en la tira o en la ficha, fuera del marco. Horas y fechas en formato español de 24 h. `iv` sin franja inferior (`--ib:0`).

## Entrega
Regenera, ensambla con `python3 S/entrega/kit/build.py <carpeta> "<título>"`, captura con Playwright y MIRA lo que cambió en `ext`, `iv` y `esc` (claro) y una en oscuro. Informe: (1) textos PROPUESTA sin respaldo en el código, arriba; (2) tabla de textos; (3) tabla de inventario; (4) qué cambió en capas y navegación; (5) resultado de chk-botones; (6) qué no quedó bien; (7) archivos y cómo regenerar.
