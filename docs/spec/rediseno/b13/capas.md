# B13 · línea CAPAS (AG5 → AG8) — registro

Rama `feature/b13-capas`, desde `cbaaa1c1` (+ `ca1c2cf8` fusionado). Maquetas: `S/entrega/ag-burbuja`,
`ag-form`, `ag-ligado`, `ag-herr`. Capturas y resultados: `S/b13/capas/`.

## Cómo está hecho (léelo antes de tocar capas)

* **Las capas viven en `body`**: colores SÓLO con tokens del kit (`--sup`, `--sup2`, `--fondo`,
  `--tinta*`, `--linea`, `--enlace`, `--accion`, `--tonal*`, `--mal-*`, `--ok-*`). Los `--ag-*`
  re-apuntados de la raíz v2 (AG1) no llegan allí.
* **Piel genérica** (`globals.css`, «CAPAS E INTERACCIONES V2»): `.ag-capa` (anclada, radio 18, contorno
  1 px `--linea` + `--sombra-capa`, relleno 20), `.ag-capa--centro` (radio 20), `.ag-hoja` (radio 22 arriba),
  `.ag-capa-cab/-titulo` (17/700), `.ag-capa-cerrar` (44; 36 en `ih`/`esc`), `.ag-capa-campo`
  (rótulo 13/600, campo `--sup2` sin borde, 44/16 táctil, 40/15 en `esc`), `.ag-capa-boton` (quieto
  `--sup2` / principal `--accion`, 44; 40 en `ih`/`esc`), `.ag-opciones` (recuadro `--fondo`),
  «Registrar…» en `--ok-*`. Con eso salen al kit, sin tocar su TSX, la burbuja de alta, «Convertir en
  cita», la ventana de ligar, el buscador, «Ir a una fecha», la campana, el engrane y la leyenda.
* **La alerta de confirmación** (`ConfirmModal`) con `verbo` es la del catálogo (`.k-capa`/`.k-al`):
  pregunta como título, resto como mensaje (`partirPregunta`), icono en círculo, secundario
  («Volver» si se cancela algo, «Cancelar» si no) y principal con verbo. El nombre del diálogo sigue
  siendo el texto ENTERO (título + mensaje): los localizadores por nombre no cambian. Sin `verbo` es la
  de siempre, letra por letra: eso ve la agenda con la v2 APAGADA y la configuración (AG9).
