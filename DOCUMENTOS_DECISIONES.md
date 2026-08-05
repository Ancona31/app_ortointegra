> **AVISO — 2026-08-04.** Este documento es histórico. El §2 (tipografía y
> uso de color) quedó superado por el brief v2 y por la sesión de rediseño.
> La fuente de verdad vigente es `DOCUMENTOS_HANDOFF.md`. Donde ambos se
> contradigan, manda el handoff.
>
> El "siguiente paso ejecutable" que menciona abajo ya se ejecutó: la auditoría
> está en `DOCUMENTOS_AUDITORIA.md` y el rediseño de los 8 formatos cerró.
> El siguiente paso real es el Paso 0 de `PLAN_FASE1_DOCUMENTOS.md`.


# Proyecto: Sistema de documentos — Decisiones de planeación

> Estado: planeación cerrada salvo 4 decisiones pendientes (ver final).
> Siguiente paso ejecutable: correr `AUDITORIA_DOCUMENTOS_PROMPT.md` en Claude Code.
> Este documento registra **decisiones**, no implementación. El plan operativo se escribe después de la auditoría.

---

## 1. Arquitectura

**Refactor a sistema de tres capas.** No se rediseñan 8 documentos por separado.

1. **Tokens** — paleta, escala tipográfica, escala de espaciado sobre retícula de 4 pt, grosores, márgenes. Archivo único de constantes.
2. **Chasis** — `DocumentoBase`, `Membrete`, `PieDePagina`, `BloquePaciente`, `Campo`, `Seccion`, `Tabla`, `BloqueFirmas`, `Marca`, `TextoRico`.
3. **Formatos** — declaran título, bloques, orden y tabla propia. Nada más.

**Regla anti-divergencia**: si dos formatos necesitan lo mismo pero distinto, no se bifurca el chasis, se le agrega una prop. Sin excepciones.

**Criterio de éxito medible**: ningún archivo de formato contiene un color, tamaño de fuente o padding literal, y cabe en menos de ~80 líneas. Si un formato queda en 300 líneas, el chasis está incompleto.

**Los 8 documentos son 5 arquetipos:**

| Arquetipo | Formatos |
|---|---|
| A — Solicitud | Laboratorio, Imagen |
| B — Prescripción / Plan | Receta, Plan de Suplementación |
| C — Narrativo | Escrito Médico |
| D — Con contrafirma del paciente | Internamiento, Consentimiento |
| E — Financiero | Honorarios |

El `ConsultorioActivoContext` se consume **una sola vez**, en `Membrete`. La regla permanente pasa a cumplirse por construcción.

---

## 2. Diseño visual

Objetivo: calidad de imprenta. El costo de impresión no es restricción.

- **Chasis neutro.** Negro y grises sobre blanco, reglas finas, jerarquía por peso y tamaño. La elegancia no puede depender del color.
- **El acento del médico aparece en 3–4 lugares definidos por el chasis.** El color es configurable por médico, así que el diseño debe verse bien con cualquier color.
- **Los tonos se derivan programáticamente** del color elegido. El médico no elige paleta completa.
- **Validación de contraste obligatoria al guardar** (mínimo 4.5:1). Si el color elegido no alcanza, el texto encima pasa a oscuro automáticamente en lugar de blanco. Hoy esto es un bug latente.
- **Todo debe sobrevivir en escala de grises.** Nada puede significar solo por color.
- **Dos familias tipográficas**: serif de texto para párrafos largos, humanista para etiquetas y datos.
- **Medida de línea 65–75 caracteres.** Hoy el consentimiento va a ~100.
- **Números tabulares** en Honorarios.
- **Margen izquierdo mayor** que el derecho, para perforado y engrapado.
- Papel Carta (612×792 pt). Ya es correcto, se conserva.

### Marca de agua

**Se elimina del área de contenido.** Se imprime borrosa (131 ppi), estorba la lectura y es un recurso de plantilla, no de imprenta. Su función la cumplen membrete, folio y QR.

**El mecanismo se reutiliza para estados**: `SIN FIRMAR`, `BORRADOR`, `COPIA`, `SIN VALIDEZ — VISTA PREVIA`.

### Logo

- **Logo de Spinus**: SVG.
- **Logo del médico**: se sube en cualquier formato y se **normaliza en el ingest, no en el render**. Genera derivados (`logo_membrete` ~128 px, `logo_mono`). Requisitos y **vista previa** en la UI del perfil.
- El logo vive en una caja de tamaño fijo con padding propio. No puede romper la retícula.
- Existe opción **"sin logo, solo tipografía"**, presentada como alternativa legítima.

---

## 3. Integridad documental

- **Paginación "X de Y" en todos los documentos.** Hoy no existe en ninguno. Es el hallazgo más grave: un consentimiento de 4 hojas firmado solo en la última no tiene nada que ate la hoja 1 a la de firmas.
- **Folio visible en todas las páginas.**
- **Fecha y hora** de elaboración.
- **Regla de campo vacío**, resuelta en el componente `Campo`: línea para llenar a mano si es rellenable, colapso si es opcional. **Nunca una caja con etiqueta y nada debajo.**
- `Riesgos específicos` del consentimiento pasa a bloqueante.
- Anestesiólogo condicional; los dos testigos permanecen fijos (NOM-004).
- **Honorarios**: título `COTIZACIÓN / RECIBO DE HONORARIOS` y leyenda `Documento informativo — no es comprobante fiscal (CFDI)` en jerarquía visible, no en gris de 6 pt al pie.
- `formato_version` en el registro de cada documento. **Los documentos históricos nunca se regeneran.**

---

## 4. Fuera de alcance — decisión de producto cerrada

> Spinus no valida el contenido clínico de las plantillas ni de los documentos. Sin validación de dosis, alergias, interacciones, duplicidad terapéutica ni de precios de referencia. El contenido es responsabilidad del médico que lo crea y lo aplica. El sistema solo garantiza que el contenido aplicado sea **visible y editable** antes de emitir.

Razón adicional: emitir juicios clínicos movería a Spinus hacia la categoría de software de apoyo a la decisión clínica, regulatoriamente más pesada. Confirmar con asesoría regulatoria.

---

## 5. Plantillas

**Principio: una plantilla guarda datos, nunca un documento.** Por eso el rediseño visual y las plantillas son ortogonales — una plantilla creada hoy sigue cargando en el formato nuevo.

- **Una sola tabla** `plantillas_documento`: `id`, `medico_id`, `tipo_documento`, `nombre`, `payload jsonb`, `version`, `activa`, `usos`, `ultimo_uso`, timestamps.
- Payload validado con schema de Zod **por tipo de documento**.
- **Disponible en los 8 formatos**, no en algunos. El formato #9 la hereda gratis.
- El contenido aplicado queda siempre visible y editable antes de emitir.
- La lista de plantillas muestra fecha de última actualización (dato del médico, sin juicios).
- **La firma del médico no se guarda en la plantilla.** Se toma del perfil al generar cada instancia.

### Plantilla ≠ borrador

Dos conceptos distintos que no comparten estado:

- **Plantilla**: molde reutilizable, **sin paciente**, sin firmas.
- **Borrador**: instancia concreta **de un paciente**, no sellada. Nace al aplicar una plantilla o desde cero.

### Consentimiento — caso especial

El documento emitido guarda `plantilla_id`, `plantilla_version` y **snapshot del texto consentido**. Si el texto de riesgos cambia en el futuro, debe poder demostrarse el texto exacto que el paciente firmó.

Esto **no contradice** la regla del `ConsultorioActivoContext`: esa regla es sobre datos de presentación, que siempre deben ser vigentes. El texto consentido es evidencia, y la evidencia se congela.

**Secuencia obligatoria**: cerrar el esquema de campos por arquetipo → rediseño → plantillas. Al revés, hay que migrar plantillas.

---

## 6. QR y verificación

**El QR se conserva y se extiende a los 8 formatos.**

- **Folio y token son campos separados.** El folio es identificador humano, impreso y permanente. El token es secreto de acceso, ≥128 bits de fuente criptográfica, revocable y caducable. Solo el token va en el QR.
- **La página de verificación no muestra contenido clínico.** Ni medicamentos ni diagnóstico. Muestra: autenticidad, tipo, folio, fecha y hora, médico (nombre y cédula), **iniciales** del paciente, estado y hash SHA-256.
- **Cuatro estados**: `vigente`, `expirado`, `revocado`, `reemplazado`. Expirado nunca se redacta como "documento no válido".
- **Caducidad por tipo**: receta 90 d · solicitudes y suplementación 180 d · honorarios e internamiento 1 año · **consentimiento sin caducidad**. *(pendiente de confirmación)*
- Revocación manual disponible para el médico.

### No indexación

- `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` **como header HTTP**, más meta tag por redundancia.
- **No poner `Disallow` en robots.txt** para esa ruta: bloquear el crawl impide que Google lea el `noindex`. Se permite el crawl y se excluye del sitemap.
- `Referrer-Policy: no-referrer` y `Cache-Control: no-store`.
- **Open Graph genérico obligatorio.** Sin esto, la vista previa de WhatsApp filtra datos del paciente a Meta.
- Rate limiting contra enumeración. Bitácora de accesos con retención acotada.

**El endpoint de verificación debe soportar el esquema v1 indefinidamente.** Hay QR impresos en manos de pacientes; la verificación no se versiona junto con el formato.

---

## 7. Envío al paciente

**Link, nunca adjunto.** Un adjunto enviado a la dirección equivocada es irreversible; un link se revoca.

- Correo **sin datos clínicos** en cuerpo ni asunto. Asunto genérico.
- Link caducable (30 d para documentos clínicos) y revocable.
- **Segundo factor: fecha de nacimiento del paciente.** Resuelve el correo mal escrito con fricción mínima.
- Descarga el PDF **almacenado**, nunca uno regenerado.
- Diseño agnóstico del canal: habilita WhatsApp después sin rehacer nada.

**El link de descarga y el link del QR son sistemas distintos y no se unifican:**

| | QR de verificación | Link de envío |
|---|---|---|
| Destinatario | terceros (farmacia, hospital, aseguradora) | el paciente |
| Contenido | metadatos, **cero clínico** | PDF completo |
| Acceso | abierto | segundo factor |

---

## 8. Consentimiento informado — ciclo de vida

| Estado | Editable | Firmas | Ubicación |
|---|---|---|---|
| `borrador` | sí | médico, renderizada | Documentos del paciente |
| `en_firma` | **no** | capturándose | Documentos del paciente |
| `firmado` | no | completas | Documentos del paciente, **no en expediente** |
| `sellado` | no | completas | **Expediente. Irreversible.** |

- **Iniciar el proceso de firma congela el contenido clínico** y calcula el hash de lo que el paciente va a leer. *(aceptado)*
- Volver a borrador editable **invalida y descarta las firmas**, con advertencia explícita.
- Un consentimiento firmado **puede permanecer en `firmado` indefinidamente**. Sellar es decisión del médico.
- **Sellar es la firma real del médico**: acto autenticado por sesión, con `user_id`, timestamp de servidor y dispositivo registrados. El trazo impreso es su representación gráfica.
- Botón: **"Iniciar proceso de firma"** (no "validación").

### Dos flujos de firma, ambos terminan en `firmado`

1. **En dispositivo**, presencial, una pantalla por firmante.
2. **Escaneado**: se imprime el preliminar (con marca `SIN FIRMAR`), se firma en papel el día de la cirugía, y el médico sube el escaneo. Se marca `firmado_en_papel`.

**Sin firma remota por link.** Un consentimiento quirúrgico firmado a distancia, sin poder acreditar quién sostuvo el dispositivo, vale menos que uno en papel.

### Captura por firmante

Nombre completo, rol (paciente / familiar / testigo 1 / testigo 2 / anestesiólogo / médico), parentesco si aplica, tipo y número de identificación en texto, timestamp de servidor, y **el trazo con coordenadas y tiempos**, no solo el bitmap.

### Fotografía de identificaciones

**Decisión revisada.** La recomendación inicial era no almacenar identificaciones. Se revirtió: una identificación oficial contiene la firma del titular, lo que permite **cotejo pericial** contra la firma autógrafa capturada. Para testigos —que no son pacientes del médico— es la diferencia entre un trazo anónimo y uno peritable.

Alcance:

| Firmante | Identificación |
|---|---|
| Paciente | sí |
| Familiar responsable | sí |
| Testigo 1 y 2 | **sí — el caso de mayor valor** |
| Anestesiólogo | no, basta cédula profesional |
| Médico tratante | no, verificado en onboarding |

**Opcional, no bloqueante.** Si un testigo no trae identificación, no se detiene el procedimiento. El documento sellado refleja de qué firmantes se capturó y de cuáles no.

Cuatro condiciones de implementación:

1. **Embebidas en el PDF, en hoja de anexo al final.** `ANEXO — IDENTIFICACIÓN DE FIRMANTES`, con cada foto etiquetada con nombre y rol del firmante. No intercaladas en el cuerpo: el cuerpo conserva su calidad de impreso, y el anexo agrupado facilita el cotejo (hoja de firmas junto a hoja de anexo).

   *Se evaluó guardarlas como adjunto vinculado fuera del PDF, para reducir su circulación en envíos rutinarios. **Se descartó.** Un documento probatorio fragmentado falla justo cuando se necesita: ante CONAMED o un juzgado hay que entregar un archivo, no un PDF más adjuntos que haya que vincular y acreditar por separado. Además el riesgo que evitaba es marginal — los testigos suelen ser familiares del propio paciente, y una aseguradora que evalúa un reclamo quirúrgico legítimamente requiere el consentimiento completo. Es también la práctica establecida en contratos, actas y poderes notariales.*

2. **Casilla de consentimiento del titular** en la pantalla de captura. Un testigo acepta que su identificación quede anexa —es parte de lo que consiente al ser testigo— y dejar constancia de esa aceptación refuerza el documento en lugar de estorbarlo.
3. **Compresión razonable.** Legible para cotejo pericial sin inflar el peso del consentimiento.
4. **Guía de captura** con encuadre y validación mínima de resolución. Una foto borrosa no sirve para cotejo.

**Captura**: dentro del mismo flujo de firma. Cada firmante pasa por su pantalla, firma, y ahí mismo se fotografía su identificación con la cámara del dispositivo. Un solo paso por persona.

**Costo**: ~1 MB por consentimiento (4 fotos comprimidas). ~240 MB/año por médico activo; ~40 GB/año a 170 médicos. Menos de 1 USD/mes en storage. El costo no es el factor de decisión; la exposición sí.

**Pendiente de definición legal**: al ir embebidas, las identificaciones quedan sujetas a la inmutabilidad del documento sellado y siguen la retención del expediente (5 años por NOM-004). Confirmar con asesoría legal si eso es correcto o si algún supuesto exigiría un tratamiento distinto — la respuesta puede reabrir la decisión de embebido.

### Modal de sellado

Debe mostrar a quién pertenece, cuántas firmas hay, **cuáles faltan**, y que la acción es irreversible. Un modal que solo pregunta "¿está seguro?" se clickea en automático.

Se puede sellar con firmas faltantes — es decisión del médico — pero viéndolo.

### Inmutabilidad real

- Hash SHA-256 del PDF definitivo, guardado en base de datos.
- **El rol del médico no tiene permiso de borrado ni sobrescritura** en el bucket. Si puede borrar desde la app, la inmutabilidad es decorativa.
- Regeneración prohibida por diseño para cualquier documento `sellado`. Sin flag de admin.
- Anular no borra: crea estado nuevo y conserva el archivo.

---

## 9. Expediente

### Entra en este proyecto

- Campo `en_expediente`.
- Opción "Agregar al expediente" en la emisión **y** desde el visor.
- **Metadata completa** en cada PDF y su registro: tipo, fecha y hora, paciente, folio, hash, `formato_version`, estado de firma.

### Reglas

- Defaults: consentimiento y nota médica → sí. Receta, solicitudes, suplementación, internamiento, escrito médico → sí, desmarcable. **Honorarios → no** (documento administrativo, no clínico).
- **Agregar es irreversible.** No existe "quitar del expediente". Un documento erróneo se marca anulado y permanece visible.
- **Anexar no es bloqueante.** La NOM-004 incluye las cartas de consentimiento entre los documentos del expediente, pero la obligación es del médico y del establecimiento, no del software. El sistema **recuerda sin bloquear**: aviso discreto si un consentimiento firmado lleva días sin sellar.

### Fuera de este proyecto

El **exportador de expediente completo** (consolidación cronológica, índice, portada, paginación continua, fusión de notas médicas) se va al proyecto de **NOM-024**. Construirlo ahora como "un PDF grandote" significa rehacerlo durante la certificación.

---

## 10. Migración

**No hay migración de datos.** Los PDFs emitidos son archivos inmutables en storage y nunca se regeneran. El refactor solo afecta a documentos nuevos.

Patrón: reemplazo gradual con `documentos/v2/` en paralelo y feature flag server-side por médico (`profiles.documentos_v2`). **El flag es lo que permite trabajar en `main` sin crear ramas.**

### Fase 0 — Andamiaje inerte

- `documentos/v2/` en paralelo. Código actual intacto.
- `formato_version`, default `1`.
- Feature flag por médico.
- **Desacoplar el visor del generador.** Si el visor importa el generador v1, v1 nunca se puede borrar.

### Fase 0.b — Bloqueante antes de escribir v2

`regenerarYSubirPdf`: al encender v2, un documento viejo regenerado saldría con formato nuevo — alteración de un documento entregado, o firmado.

**Decisión: prohibir la regeneración de documentos con `formato_version = 1`.** Si se necesita otro papel, se emite uno nuevo con fecha nueva.

### Fase 1 — Chasis y un arquetipo

Tokens y chasis completos. Un solo formato: **Solicitud de Laboratorio**. Más **ruta de comparación v1/v2 lado a lado** para super-admin. Validación imprimiendo en papel.

### Fase 2 — Los cinco arquetipos

Orden de riesgo ascendente: **A → B → C → E → D**. El consentimiento al final. Un commit por arquetipo, validado en navegador y en papel.

### Fase 3 — Activación gradual

Cuenta de Angel (2 semanas de uso clínico real) → 5 beta testers → médicos nuevos → todos. El flag no se retira hasta semanas sin incidencias.

### Fase 4 — Retiro

Se borra `documentos/v1/`. Solo posible si el visor quedó desacoplado en Fase 0.

---

## 11. Partición en dos entregas

**Entrega 1 — Sistema de documentos.** Chasis, tokens, los 8 formatos, plantillas, QR con folio y token separados. El consentimiento se rediseña **con espacios de firma y estados visuales ya reservados**, pero se sigue emitiendo como hoy: impreso y firmado en papel.

**Entrega 2 — Consentimiento firmado y expediente.** Captura de firmas, los dos flujos, hash e inmutabilidad, `en_expediente`, link de descarga con segundo factor.

Condición: el diseño de la Entrega 1 debe contemplar los cuatro estados y la marca de agua de estado, o el consentimiento se rediseña dos veces.

---

## Pendientes de decisión

Ninguno bloquea la auditoría.

1. **Scope de plantillas** — recomendación: por médico, con Honorarios por consultorio (precios distintos entre Mérida y Umán).
2. **Límite de plantillas por plan** — recomendación: tope en free, sin límite en pago. Fijarlo antes de construir la UI.
3. **Partición en dos entregas** — recomendación: sí. Es la que más impacta el calendario de lanzamiento.
4. **TTL de los enlaces** — recomendación: los valores de la sección 6.

---

## Flujo de trabajo con Claude Design

Claude Design produce **diseño**, no código. El código lo escribe Claude Code después de la aprobación.

1. Cerrar tokens y esquema de campos (requiere la auditoría).
2. **Entregable #1: hoja espécimen.** El chasis en abstracto — membrete, pie, bloque de paciente, encabezado de sección, tabla, bloque de firmas y **los tres estados de `Campo`** lado a lado. Sin documentos todavía. Es el ~70% de lo que se ve en los 8, y es lo que hay que pulir obsesivamente.
3. **Entregable #2**: el chasis aprobado aplicado a los 5 arquetipos.
4. Los 3 formatos restantes se revisan como variantes.
