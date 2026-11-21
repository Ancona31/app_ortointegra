# Rediseño estético de Spinus — especificación para implementar

Rediseño **solo estético** (visual, layout, tipografía, iconografía, movimiento)
de la app autenticada, para teléfono, iPhone Duo (cerrado, abierto horizontal,
abierto vertical) y computadora. Nada de esta carpeta es código de la app: es
el plan, las reglas y los informes que los bloques de implementación siguen.

## Qué hay aquí

| Archivo | Qué es |
|---|---|
| `PLAN.md` | Plan de implementación aprobado: diagnóstico, estrategia (§2), bloques B0–B15 (§3), riesgos (§6), arreglos incluidos y deuda que no se toca (§7). |
| `ESTADO.md` | Estado del diseño al cerrar las maquetas, enlaces a las páginas publicadas, textos nuevos aprobados y deuda detectada. |
| `IMPLEMENTACION-REGISTRO.md` | Registro de la implementación: línea base medida en B0 y tabla de bloques para ir marcando. |
| `kit/IMPLEMENTACION.md` | Reglas obligatorias para quien implementa un bloque (lecturas, reglas duras, verificación, commits, informe). |
| `kit/CALMA.md` | Reglas de diseño y decisiones del dueño (§1–§31). |
| `kit/BRIEF.md` | Brief del rediseño. |
| `kit/base.css` | Tokens del kit (color, insets, marcos de dispositivo) de las maquetas. |
| `agenda-base/PIEZAS.md` | Piezas del calendario, regla de botones (§13) e integración (§14). |
| `ag-mes/PIEZAS-MES.md` | Piezas de la vista Mes. |
| `informes/*.md` | Auditoría de partida: color, tipografía, movimiento, navegación, funciones por componente, capturas, botones desbordados, cromo global y auditoría de la agenda v2 (commit `951e31b3`). |
| `tools/cap-app.js` | Capturas de rutas reales de la app en los cinco formatos, claro y oscuro, con franjas emuladas por CDP. |
| `tools/chk-app.js` | Mediciones sobre la página real: desbordes de botones, controles bajo las franjas, texto < 12 px y áreas de toque < 44 px en táctiles. |

## Las maquetas navegables

Las maquetas completas (vistas `vista-*.html`, sus generadores, CSS, JS y
`kit/build.py`) pesan unos 60 MB y **no están en esta rama**. Viven en la rama
de respaldo `claude/cool-babbage-nn7p37`, carpeta `docs/spec/rediseno/`:

```bash
git fetch origin claude/cool-babbage-nn7p37
git show origin/claude/cool-babbage-nn7p37:docs/spec/rediseno/<carpeta>/<archivo>
# o, en un directorio aparte (no en este árbol):
git worktree add ../maquetas origin/claude/cool-babbage-nn7p37
```

## Páginas publicadas

| Página | Carpetas fuente (en la rama de respaldo) |
|---|---|
| Dashboard — https://claude.ai/artifact/3zBv6wa5fyBrv6Qx2xboNE | `dashboard-final/` |
| Pacientes y expediente — https://claude.ai/artifact/Ab3wropQKESXN8iudfrets | `final-lista/`, `final-expediente/`, `final-form/` |
| Nota médica — https://claude.ai/artifact/PSNZ7UBsU8sehQvJZkFAZe | `final-nota/`, `final-consulta/` |
| Documentos — https://claude.ai/artifact/6kCw3X3UUZr43aZ1cDdTR1 | `docs-a/`, `docs-b/`, `docs-c/` |
| Cuenta y administración — https://claude.ai/artifact/RPU3HgVmgtgow79NJH4wGt | `perfil/`, `admin/`, `lectura/` |
| Capas compartidas — https://claude.ai/artifact/QkNKub8wrVmRL2UhsxuGTu | `capas-a/`, `capas-b/` |
| Navegación y avisos globales — https://claude.ai/artifact/VDoJK5ESNVY7qHEbrjvL1c | `cromo/` |
| Agenda · piezas base — https://claude.ai/artifact/37zhQUE5bqikVAun42Jcv5 | `agenda-base/` |
| Agenda · calendario — https://claude.ai/artifact/UWmb8EhTdNJq6qneEd8Seu | `agenda-base/` (Día, 3 días), `ag-semana/` |
| Agenda · mes — https://claude.ai/artifact/GS2SN3Wd8b9dbQYUiivFod | `ag-mes/` |
| Agenda · cita — https://claude.ai/artifact/Xf5BtgiHqWa32U5EqouGLr | `ag-burbuja/`, `ag-form/`, `ag-ligado/` |
| Agenda · herramientas y configuración — https://claude.ai/artifact/CooHFaiqEeoimZWnTTFDMA | `ag-herr/`, `ag-config/`, `ag-pv/` |

Las páginas son privadas del dueño; la fuente de verdad es la rama de respaldo.

## Rutas en los documentos

`PLAN.md`, `ESTADO.md` y `kit/IMPLEMENTACION.md` se escribieron en la sesión de
diseño y citan rutas de su carpeta temporal (`S/entrega/…`, `S/informes/…`,
`S/tools/…`). Su equivalente en esta rama es esta misma carpeta
(`docs/spec/rediseno/…`); las vistas `vista-*.html` están solo en la rama de
respaldo.
