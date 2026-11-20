# Rediseño Spinus — estado al 20-nov-2026

Planeación y maquetas del rediseño estético (sin backend) de la app autenticada, para teléfono, iPhone Duo (cerrado, abierto horizontal, abierto vertical) y computadora. Basado en el skill apple-design.

## Dónde está cada cosa
- `kit/BRIEF.md` y `kit/CALMA.md` (§1–§24): reglas de diseño y todas las decisiones aprobadas. LEER PRIMERO.
- `kit/base.css`: tokens (claro/oscuro) y marcos de dispositivo. `kit/build.py`: ensamblador de páginas.
- `informes/`: auditoría inicial (tipografía, color, movimiento, navegación, inventario de 395 funciones).
- Páginas publicadas (fuente en cada carpeta, `pagina.html`):
  - Dashboard: `dashboard-final/` — https://claude.ai/artifact/3zBv6wa5fyBrv6Qx2xboNE
  - Pacientes y expediente: `pub-pacientes/` (fuentes en `final-lista/`, `final-form/`, `final-expediente/`) — https://claude.ai/artifact/Ab3wropQKESXN8iudfrets
  - Nota médica: `pub-nota/` (fuentes `final-nota/`, `final-consulta/`) — https://claude.ai/artifact/PSNZ7UBsU8sehQvJZkFAZe
  - Documentos: `pub-documentos/` (fuentes `docs-a/`, `docs-b/`, `docs-c/`) — https://claude.ai/artifact/6kCw3X3UUZr43aZ1cDdTR1
  - Cuenta y administración: `tanda4/` (fuentes `perfil/`, `admin/`, `lectura/`) — https://claude.ai/artifact/RPU3HgVmgtgow79NJH4wGt

## Fuera de alcance
Calculadoras clínicas y visor DICOM (se eliminarán), super-admin, páginas públicas, háptica. El lanzador `/inicio` se retira al final del proyecto (bloque aparte; toca guardas de sesión).

## Pendiente, en orden
1. Esperar a que cierre `feature/agenda-v2`. Re-auditar SOLO la agenda (tipografía, tokens, apple-design) y maquetar agenda v2 + configuración. Incluye el botón «¿No es una cita?» y el flujo de ligado tal como queden en esa rama.
2. Capas compartidas (alertas, modales, hojas, menús, avisos, vacíos, errores, carga) como catálogo con movimiento.
3. Plan de implementación por bloques pequeños.
4. Implementación desde la sesión en la nube (falta confirmar: rama, punto de partida = punta de agenda-v2, y levantar el solo-lectura). Pushes los mínimos; parada temprana en el Duo real tras cimientos + navegación; QA final en preview de Vercel (apunta a la base real, pacientes de prueba con consentimiento); merge local por el usuario, sin PR.

## Flojos conocidos de las maquetas
- Duo horizontal: con el principal a la derecha, algunos botones cruzan el pliegue (decisión del usuario: no condicionar por el pliegue).
- Dashboard `ext`: la leyenda «Estados» tapa dos filas al abrirse; leyenda y «Ver en la agenda» sin revisar en oscuro.
- Nota: papelera de receta monta unos píxeles en `ih`/`esc`. Partición de palabras sin verificar en Safari.
- Consentimiento/Honorarios: «Faltan N campos» a la izquierda con botones a la derecha.
- Usuarios y Facturación en `iv`: mitad inferior vacía.

## Deuda técnica detectada (funcionalidad/backend; anotar en DEUDA_TECNICA.md al implementar)
- «Eliminar expediente» promete borrado permanente vs. borrado lógico.
- Saludo del dashboard usa solo la primera palabra del nombre («José de Jesús» → «José»).
- Validaciones con globos nativos en inglés; asistente de agenda no vuelve arriba (`PrimeraVez.tsx:239`).
- CLAUDE.md desactualizado (focus trap de ModalShell ya existe; RESUMEN_DASHBOARD obsoleto).
- Ayuda: sello «AES-256-GCM» marcado como inflado en código; guía DICOM; «Mi perfil → Facturación» incorrecto; atajos sin los de agenda v2; guías de suplementación/internamiento desfasadas.
- Plan gratuito «0/0» asistentes; «Reactivar suscripción» lleva a la misma página.
- Fecha ficticia 1 de enero para pacientes solo con edad; comentario «LFPDPPP Art. 9» de ley abrogada.
- «Desconectar» Google y «Eliminar» firma sin confirmación; placeholder de universidad real.
- Notas de medición truncadas a 50 con resto en `title`; «Documento eliminado» al borrar archivo.
- «conexion», «bunker», «Escrito medico» sin acentos; fila de envío muestra correo anterior; `?cita=` sin señal visible.
- Nombres de orden inconsistentes en la lista; «Registra tu primer paciente» con filtros sin resultados.
