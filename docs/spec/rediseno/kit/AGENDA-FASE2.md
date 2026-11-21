# Agenda v2 — encargo común de la fase 2

S = /tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
Trabajas en maquetas HTML estáticas del rediseño estético de Spinus (PWA médica). El repo `/home/user/app_ortointegra` es de SOLO LECTURA: no escribas nada ahí. Todo va en tu carpeta bajo `S/entrega/`. Responde en español.

## Leer ENTERO antes de dibujar
1. `S/entrega/kit/BRIEF.md` y `S/entrega/kit/CALMA.md` (rigen §11–§28; sobre todo §25–§28).
2. `S/entrega/agenda-base/PIEZAS.md` y las vistas `S/entrega/agenda-base/vista-*.html`: son las PIEZAS BASE aprobadas por el dueño (bloque de cita, rejilla, barra, panel del día, avisos de página, navegación por dispositivo, tokens `--cal-*`). NO las reinterpretes: copia su CSS (`agenda-base/tmp-estilo.css`, `tmp-nav.css`) y su marcado (generadores `tmp-gen.py`, `tmp-vistas.py`) y construye encima. Lo que añadas lleva tu propio prefijo de clase.
3. El catálogo de capas: `S/entrega/capas-a/vista-*.html` (alerta, modal, hoja, menú) y `S/entrega/capas-b/vista-*.html` (aviso, vacío, error, carga). Toda capa tuya es una de esas piezas: `ext` tarjeta centrada en el área de contenido, `tel` hoja inferior arrastrable, `ih`/`iv`/`esc` tarjeta centrada; menús sin velo solo en `esc`.
4. `S/informes/agenda-v2-auditoria.md` (inventario real, commit 951e31b3) y las capturas de hoy en `S/cap-agenda/`. El código real está en el clon `S/app` para textos y comportamiento EXACTOS.
5. El skill `/home/user/app_ortointegra/.agents/skills/apple-design/SKILL.md`.

## Reglas
- Solo visual: ninguna función se pierde ni se añade. Textos exactos de hoy salvo los unificados en CALMA §28. Propuestas de texto o función: aparte, en el informe, sin aplicarlas.
- Cinco marcos por vista (ext, tel, ih, iv, esc), claro y oscuro, tira de maqueta FUERA del marco para cada estado y variante, ficha «Especificación» bajo el marco.
- Tono: el de las piezas base y el dashboard aprobado (ni plano ni saturado; color con significado; iconos de color; sin texto <12 px).
- Datos ficticios de la semilla (Paciente Prueba NN, Dr. Admin Semilla, consultorio Centro).
- Movimiento real en las capas y transiciones (resortes interrumpibles, solo transform/opacity, reduced-motion → fundido).

## Entrega
- Ensambla con `python3 S/entrega/kit/build.py <tu carpeta> "<título>"`.
- Captura con Playwright (ya instalado: `require('playwright')`; base: `S/tools/tmp-ag0-cap.js`) y MIRA con Read cada vista en los cinco marcos en claro y `ext`, `iv`, `esc` en oscuro. Mide: 0 texto <12, áreas de toque ≥44 en táctiles (≥36 en `ih`/`esc`), nada bajo franjas, capas centradas, 0 solapes, 0 errores de consola.
- INFORME FINAL, en este orden: (1) TABLA OBLIGATORIA «ítem del inventario (nº de la auditoría) → dónde está en la maqueta / reservado a otro agente / FALTA»; si algo queda en FALTA, dilo en la primera línea. (2) Qué entregaste. (3) Decisiones que tomaste. (4) Propuestas para el dueño. (5) Qué no quedó bien. (6) Archivos y cómo regenerar.
