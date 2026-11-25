# Rediseño Spinus — estado al 21-nov-2026

Rediseño SOLO estético (sin backend ni funcionalidad; no se pierde ninguna función) de toda la app autenticada, para teléfono, iPhone Duo (cerrado, abierto horizontal, abierto vertical) y computadora, según el skill `.agents/skills/apple-design/SKILL.md`. Este directorio es planeación y maquetas: nada de aquí es código de la app.

## Leer primero
- `kit/BRIEF.md`, `kit/CALMA.md` (§1–§29: TODAS las reglas y decisiones aprobadas por el dueño), `kit/INTEGRACION.md`, `kit/AGENDA-FASE2.md`.
- `kit/base.css` (tokens y marcos de dispositivo) y `kit/build.py` (ensambla `vista-*.html` de una carpeta en `pagina.html`).
- `agenda-base/PIEZAS.md` (piezas del calendario, regla de botones §13, integración §14) y `ag-mes/PIEZAS-MES.md`.
- `informes/`: auditoría inicial, `agenda-v2-auditoria.md` (commit 951e31b3 de feature/agenda-v2), `cromo-global-faltantes.md`, `botones-desbordados.md`.

## Páginas publicadas (maquetas navegables) y sus carpetas fuente
| Página | Carpetas |
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

En este respaldo van las vistas (`vista-*.html`) y sus fuentes (generadores `tmp-*.py`, CSS, JS, guiones de build). No van las páginas ensambladas (se rehacen con `kit/build.py`), ni capturas ni copias `.bak`. Los generadores usan rutas absolutas de la carpeta temporal de la sesión original: al retomarlos hay que ajustar la ruta base.

## Fuera de alcance
Calculadoras clínicas y visor DICOM (se eliminarán), super-admin, páginas públicas (incluidas `/reservar` y `/confirmar`), agenda v1, háptica. El lanzador `/inicio` se retira al final (bloque aparte; toca guardas de sesión).

## Pendiente, en orden
1. Revisión del dueño de las cuatro páginas de la agenda (ya integradas) y retoques.
2. Pasada final sobre las páginas anteriores a la agenda (pacientes, nota, documentos, cuenta): textos contra el código (los agentes de las primeras tandas inventaron algunos), capas en Duo cerrado como tarjeta centrada (§26), navegación con aviso de datos pendientes y logo (§28), y `tools/chk-botones.js`.
3. Plan de implementación por bloques pequeños, para revisión del dueño.
4. Implementación: partir de la punta de `feature/agenda-v2`; pushes los mínimos; parada temprana para probar cimientos y navegación en el Duo real; QA final en preview de Vercel (base real, pacientes de prueba con consentimiento); merge local por el dueño, sin PR. La agenda es el ÚLTIMO bloque y el de más riesgo: no cambiar textos, roles ni identificadores que usan las pruebas e2e. «3 días» como cuarta vista siempre disponible es un cambio pequeño de comportamiento (§29.1).

## Lecciones de proceso (aplicar siempre)
- Todo agente entrega la tabla «ítem del inventario → dónde está / FALTA» (§28).
- Una tanda en paralelo no se publica sin pasada de integración (`kit/INTEGRACION.md`).
- Antes de publicar, el orquestador comprueba sobre la página FINAL: restos de reparto (grep), errores de consola y `chk-botones.js`. No fiarse solo del informe del agente.
- Textos: los de hoy, verificados en el código; los nuevos se proponen aparte.

## Decisiones de texto nuevas ya aprobadas
«Agendada desde Google Calendar» / «Desde Google Calendar»; «Reservó por enlace» / «Por enlace»; «Ligar paciente e iniciar consulta»; «¿No es una cita?»; «Sin coincidencias.»; «Invitar» / «No invitar»; «Es otra persona» + «Si es otra persona, se creará el registro de todos modos.»; «funciones», «Prueba»; verbos en confirmaciones («Mover», «Guardar», «Cancelar cita», «Volver»…); rótulos «Fecha y hora», «Detalles»; encabezados de mediciones «Analito · Último valor · Estado · Fecha».

## Deuda técnica detectada (funcionalidad/backend; anotar en DEUDA_TECNICA.md al implementar; no se toca en el rediseño)
- «Eliminar expediente» promete borrado permanente vs. borrado lógico.
- Saludo del dashboard usa solo la primera palabra del nombre («José de Jesús» → «José»).
- Asistente de agenda no vuelve arriba al cambiar de paso (`PrimeraVez.tsx:239`, `window.scrollTo` no mueve el contenedor real).
- Cancelar/eliminar cita desde el formulario actúa sin confirmación (se añade al rediseñar, §29.2); estirar un evento guarda sin preguntar.
- «Terminar después» con un paso inválido no guarda y no lo dice.
- `ConfiguracionCalendario` (~1 400 líneas) y `OnboardingGuide`: código muerto. `HorarioModal` no se abre con la agenda v2.
- Enlaces de reserva dan 404 en producción mientras el aviso de privacidad diga «PENDIENTE DE REVISIÓN LEGAL».
- «Reservó Revisión de estudios» al ligar un evento de Google (`PanelLigarCita.tsx:41`); «Agendar» toma la hora sin redondear; código de reserva inválido muestra 404 en inglés.
- Burbuja de evento de todo el día mostraría «00:00 – 00:00 · 1440 min» (sin verificar en vivo).
- `FaltaParaEnlace.tsx:57` enlaza a `#config-disponibilidad`, que ya no existe; la secretaria ve filas de duración sin saber de qué consultorio.
- Paleta ⌘K: promete «solo nombre, teléfono y motivo» y pide otra cosa; cita «LFPDPPP Art. 9» (ley abrogada); sin `role="dialog"` ni nombres accesibles. Otro comentario «LFPDPPP Art. 9» en el código.
- Aviso de revocación al cerrar sesión desaparece al navegar a /login (`Sidebar.tsx:477-481`).
- Placeholders con nombres reales («Ej: Clínica Ortointegra», universidad real).
- Error al guardar duplicado (banda + aviso) en los 8 formularios de documentos; avisos sin rol de accesibilidad; duraciones de aviso dispares.
- Validaciones con globos nativos en inglés; «conexion», «bunker», «Escrito medico» sin acentos.
- CLAUDE.md desactualizado (focus trap de ModalShell ya existe; RESUMEN_DASHBOARD obsoleto).
- Ayuda: sello «AES-256-GCM» marcado como inflado en código; guía DICOM; «Mi perfil → Facturación» incorrecto; atajos sin los de agenda v2; guías desfasadas.
- Plan gratuito «0/0» asistentes; «Reactivar suscripción» lleva a la misma página.
- Fecha ficticia 1 de enero para pacientes solo con edad; «Desconectar» Google y «Eliminar» firma sin confirmación.
- Notas de medición truncadas a 50 con resto en `title`; «Documento eliminado» al borrar archivo; fila de envío muestra correo anterior; `?cita=` sin señal visible.
- Unas 13 pruebas e2e de la agenda dependen de la hora o del día (reporte de la tanda M).
