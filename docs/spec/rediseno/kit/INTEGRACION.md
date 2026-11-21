# Pasada de integración de la agenda (obligatoria)

El dueño abrió la maqueta, pulsó «Más opciones» y le salió una tarjeta «Reservado a otro agente». Eso era válido mientras se trabajaba en paralelo. YA NO: todas las piezas existen. Reglas:

1. DENTRO DEL MARCO no puede aparecer nunca un marcador de reparto del trabajo: nada de «reservado a otro agente», «lo dibuja otro agente», «hueco documentado», «agente de X», ni tarjetas o avisos que expliquen que algo está en otra parte. Cada botón, fila, enlace o gesto que hoy exista en la app lleva a su PIEZA REAL.
2. La pieza real se copia de la carpeta que la hizo (marcado + CSS con su acotación; lee su generador y su `PIEZAS*.md`):
   - Burbuja de cita, preguntas/confirmaciones, burbuja de alta, tarjeta al pasar el ratón → `S/entrega/ag-burbuja/`
   - Formulario completo de cita, evento y bloqueo, reagendar, convertir en cita, confirmaciones al arrastrar, invitar por correo → `S/entrega/ag-form/`
   - Cita por ligar, Google por asignar, ligar paciente, «¿No es una cita?», eventos de Google → `S/entrega/ag-ligado/`
   - Buscar, campana, opciones, ir a fecha, leyenda, atajos, huecos disponibles, plegar menú → `S/entrega/ag-herr/`
   - Configuración → `S/entrega/ag-config/` · Asistente de primera vez → `S/entrega/ag-pv/`
   - Día, 3 días, barra, rejilla, bloque, panel del día → `S/entrega/agenda-base/` · Semana y gestos → `ag-semana/` · Mes y «+N más» → `ag-mes/`
   - Navegación, aviso de datos pendientes, consultorio, paleta, cajón → `S/entrega/cromo/`
   Usa siempre la versión ACTUAL de esas carpetas (barra de cuatro vistas, textos unificados, verbos en las confirmaciones, «Invitar»/«No invitar», etc.).
3. Si copiar una pieza grande es desproporcionado para un camino secundario, el control puede llevar a otra vista de la MISMA página publicada (desplazamiento + realce de esa sección y apertura del estado correspondiente). Páginas: Calendario = agenda-base(Día, 3 días) + ag-semana + ag-mes; Cita = ag-burbuja + ag-form + ag-ligado; Herramientas y configuración = ag-herr + ag-config + ag-pv. Entre páginas distintas no se puede enlazar: ahí se copia la pieza.
4. Las fichas «Especificación» (fuera del marco) tampoco hablan de agentes: donde decían «lo dibuja otro agente» dicen dónde está la pieza («ver "Formulario de cita" en la página Cita»).
5. Lo que de verdad no se dibuja porque no tiene parte visual (enlaces profundos, permisos) se dice en la ficha con esas palabras, no dentro del marco.
6. Comprobación con guion: recorre TODOS los controles internos de tus vistas en `esc` y `ext` (clic en cada botón/fila/enlace del marco, en cada estado de la tira) y detecta: texto «agente», «reservado», «hueco», «maqueta» dentro del marco; clics sin efecto en controles que hoy sí hacen algo. Entrega la tabla «control → a dónde lleva ahora». Pasa también `node S/tools/chk-botones.js <tu pagina.html> --vp ext,tel`.
Informe breve: tabla de caminos corregidos, caminos que siguen sin pieza real y por qué, archivos.
