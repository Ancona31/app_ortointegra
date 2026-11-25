/**
 * Catálogo de estudios de imagen de la solicitud de imagenología (maqueta
 * aprobada `solicitud-imagen.html`, investigación en `catalogo-imagen.json`).
 * Sólo datos: la lógica (componer, interpretar, buscar, qué falta) vive en
 * `src/components/documentos/imagenCompuesta.ts`.
 *
 * ⚠️ NO ES LO QUE SE GUARDA. Cada estudio sigue guardándose como cuatro
 * cadenas (`tipo`, `region`, `proyecciones`, `indicacion`) que leen el PDF, el
 * expediente, el búnker y las plantillas; este catálogo sólo ayuda a
 * componerlas. Cambiar un nombre aquí cambia lo que imprimen las solicitudes
 * NUEVAS, y hace que las guardadas con el nombre viejo se reabran en «Otro»
 * (intactas): no se pierde nada, pero ya no se reconocen.
 *
 * `verificar: true` = entrada sin fuente confirmada (la investigación no pudo
 * leer la página entera o es criterio propio). Lista para revisar con el
 * dueño o un radiólogo.
 *
 * `lado` presente = la región tiene lateralidad y el lado es obligatorio. Su
 * valor es la concordancia del adjetivo: «Rodilla derecha» (`a`), «Hombro
 * derecho» (`o`), «Ortejos derechos» (`os`), «Partes blandas derechas» (`as`).
 *
 * Fuera del catálogo a propósito (decisión del dueño): la electromiografía y
 * cualquier estudio que no sea de imagen. Quien lo necesite usa «Otro».
 */

export type IdModalidad = 'rx' | 'tc' | 'rm' | 'us' | 'dxa' | 'mx' | 'mn' | 'pet' | 'fl' | 'eco' | 'otro'
export type Concordancia = 'a' | 'o' | 'as' | 'os'

export interface RegionImagen {
  nombre: string
  lado?: Concordancia
  /** Proyecciones de rutina (premarcadas). Sólo en modalidades con proyecciones. */
  rutina?: readonly string[]
  /** Proyecciones especiales (para añadir). */
  especiales?: readonly string[]
  verificar?: true
}

export interface GrupoImagen {
  nombre: string
  regiones: readonly RegionImagen[]
}

export interface ModalidadImagen {
  id: IdModalidad
  /** Nombre que va al PDF (tipo de estudio). */
  nombre: string
  /** Rótulo de la ficha y de la etiqueta de la línea plegada. */
  corto: string
  /** Contraste (TC/RM) o tipo de mastografía; vacío = no se pregunta. */
  contrastes: readonly string[]
  proyecciones: boolean
  grupos: readonly GrupoImagen[]
}

export const MODALIDADES_IMAGEN: readonly ModalidadImagen[] = [
  {
    id: 'rx', nombre: 'Radiografía', corto: 'Rx',
    contrastes: [], proyecciones: true,
    grupos: [
      { nombre: 'Columna', regiones: [
        { nombre: 'Columna cervical', rutina: ['AP', 'Lateral', 'Transoral (odontoides)'], especiales: ['Oblicuas', 'Dinámicas (flexión y extensión)', 'Nadador (unión cervicotorácica)'] },
        { nombre: 'Columna dorsal', rutina: ['AP', 'Lateral'], especiales: ['Nadador (unión cervicotorácica)'] },
        { nombre: 'Columna lumbar', rutina: ['AP', 'Lateral'], especiales: ['Oblicuas', 'Dinámicas (flexión y extensión)', 'Lateral localizada L5-S1', 'Ferguson'] },
        { nombre: 'Columna lumbosacra', rutina: ['AP', 'Lateral'], especiales: ['Lateral localizada L5-S1', 'Oblicuas', 'Dinámicas (flexión y extensión)'], verificar: true },
        { nombre: 'Sacro y cóccix', rutina: ['AP de sacro', 'Lateral de sacro y cóccix', 'AP de cóccix'], especiales: [] },
        { nombre: 'Columna completa en bipedestación (panorámica)', rutina: ['PA o AP en bipedestación', 'Lateral en bipedestación'], especiales: ['Inclinaciones laterales (bending)'] },
        { nombre: 'Articulaciones sacroilíacas', rutina: ['AP (axial)'], especiales: ['Oblicuas'], verificar: true },
      ] },
      { nombre: 'Miembro torácico', regiones: [
        { nombre: 'Hombro', lado: 'o', rutina: ['AP', 'Escapular en Y'], especiales: ['AP verdadera (Grashey)', 'Axilar', 'Stryker', 'West Point', 'Zanca', 'Rotación interna y externa'] },
        { nombre: 'Articulación acromioclavicular', lado: 'a', rutina: ['AP', 'Zanca'], especiales: ['Comparativa bilateral', 'Con carga (estrés)'], verificar: true },
        { nombre: 'Clavícula', lado: 'a', rutina: ['AP', 'AP con angulación cefálica'], especiales: [] },
        { nombre: 'Escápula', lado: 'a', rutina: ['AP', 'Lateral (escapular en Y)'], especiales: [], verificar: true },
        { nombre: 'Húmero', lado: 'o', rutina: ['AP', 'Lateral'], especiales: [] },
        { nombre: 'Codo', lado: 'o', rutina: ['AP', 'Lateral'], especiales: ['Oblicuas', 'Cabeza radial-cóndilo (Greenspan)'], verificar: true },
        { nombre: 'Antebrazo', lado: 'o', rutina: ['AP', 'Lateral'], especiales: [] },
        { nombre: 'Muñeca', lado: 'a', rutina: ['PA', 'Lateral', 'Oblicua'], especiales: ['Serie de escafoides (PA con desviación cubital y PA angulada)'] },
        { nombre: 'Mano', lado: 'a', rutina: ['PA', 'Oblicua', 'Lateral'], especiales: [] },
        { nombre: 'Dedos de la mano', lado: 'a', rutina: ['PA', 'Oblicua', 'Lateral'], especiales: [] },
        { nombre: 'Pulgar', lado: 'o', rutina: ['AP o PA', 'Oblicua', 'Lateral'], especiales: [] },
      ] },
      { nombre: 'Pelvis y cadera', regiones: [
        { nombre: 'Pelvis', rutina: ['AP'], especiales: ['Inlet (entrada)', 'Outlet (salida)', 'Judet (oblicuas alar y obturatriz)', 'Flamenco (sínfisis)'] },
        { nombre: 'Cadera', lado: 'a', rutina: ['AP de pelvis', 'Lateral de la cadera afectada'], especiales: ['Lateral con rayo horizontal (cross-table)', 'Rana (Lauenstein)', 'Dunn (45° o 90°)', 'Falso perfil'] },
        { nombre: 'Fémur', lado: 'o', rutina: ['AP', 'Lateral'], especiales: [], verificar: true },
      ] },
      { nombre: 'Miembro pélvico', regiones: [
        { nombre: 'Rodilla', lado: 'a', rutina: ['AP', 'Lateral'], especiales: ['AP con carga (bipedestación)', 'PA con flexión a 45° con carga (Rosenberg)', 'Axial de rótula (Merchant)', 'Túnel intercondíleo', 'Oblicuas'] },
        { nombre: 'Rodillas comparativas con carga', rutina: ['AP con carga bilateral'], especiales: ['Rosenberg bilateral', 'Axial de rótulas bilateral'], verificar: true },
        { nombre: 'Pierna (tibia y peroné)', lado: 'a', rutina: ['AP', 'Lateral'], especiales: [], verificar: true },
        { nombre: 'Tobillo', lado: 'o', rutina: ['AP', 'Lateral', 'Mortaja'], especiales: ['Con estrés (varo/valgo, cajón)'] },
        { nombre: 'Pie', lado: 'o', rutina: ['Dorsoplantar', 'Oblicua', 'Lateral'], especiales: ['Con carga (dorsoplantar y lateral)'] },
        { nombre: 'Calcáneo', lado: 'o', rutina: ['Lateral', 'Axial (Harris)'], especiales: [] },
        { nombre: 'Ortejos', lado: 'os', rutina: ['Dorsoplantar', 'Oblicua', 'Lateral'], especiales: [], verificar: true },
        { nombre: 'Miembros pélvicos completos en bipedestación (ortorradiografía)', rutina: ['AP en bipedestación'], especiales: [], verificar: true },
      ] },
      { nombre: 'Tórax y abdomen', regiones: [
        { nombre: 'Tórax', rutina: ['PA', 'Lateral'], especiales: ['AP en decúbito (portátil)'], verificar: true },
        { nombre: 'Parrilla costal', lado: 'a', rutina: ['AP o PA', 'Oblicua'], especiales: [], verificar: true },
        { nombre: 'Esternón', rutina: ['Oblicua', 'Lateral'], especiales: [], verificar: true },
        { nombre: 'Abdomen', rutina: ['AP en decúbito'], especiales: ['De pie (bipedestación)', 'Decúbito lateral con rayo horizontal'], verificar: true },
      ] },
      { nombre: 'Cráneo y cara', regiones: [
        { nombre: 'Cráneo', rutina: ['AP o PA', 'Lateral'], especiales: ['Towne'], verificar: true },
        { nombre: 'Senos paranasales', rutina: ['Waters'], especiales: ['Caldwell', 'Lateral'], verificar: true },
        { nombre: 'Huesos de la cara', rutina: ['Waters', 'Caldwell', 'Lateral'], especiales: [], verificar: true },
        { nombre: 'Huesos nasales', rutina: ['Lateral'], especiales: ['Waters'], verificar: true },
        { nombre: 'Mandíbula', rutina: ['PA', 'Oblicuas'], especiales: ['Panorámica dental (ortopantomografía)'], verificar: true },
        { nombre: 'Articulación temporomandibular', lado: 'a', rutina: ['Boca abierta y cerrada'], especiales: [], verificar: true },
      ] },
    ],
  },
  {
    id: 'tc', nombre: 'Tomografía (TAC)', corto: 'TC',
    contrastes: ['Simple', 'Contrastada', 'Simple y contrastada'], proyecciones: false,
    grupos: [
      { nombre: 'Cabeza y cuello', regiones: [
        { nombre: 'Cráneo' },
        { nombre: 'Senos paranasales' },
        { nombre: 'Macizo facial' },
        { nombre: 'Órbitas' },
        { nombre: 'Oídos (peñascos)', verificar: true },
        { nombre: 'Cuello' },
      ] },
      { nombre: 'Tronco', regiones: [
        { nombre: 'Tórax' },
        { nombre: 'Tórax de alta resolución', verificar: true },
        { nombre: 'Abdomen' },
        { nombre: 'Abdomen y pelvis' },
        { nombre: 'Pelvis' },
        { nombre: 'Tórax, abdomen y pelvis' },
        { nombre: 'Urotomografía', verificar: true },
      ] },
      { nombre: 'Columna', regiones: [
        { nombre: 'Columna cervical' },
        { nombre: 'Columna dorsal' },
        { nombre: 'Columna lumbar' },
        { nombre: 'Columna lumbosacra' },
        { nombre: 'Columna completa' },
        { nombre: 'Articulaciones sacroilíacas' },
      ] },
      { nombre: 'Musculoesquelético', regiones: [
        { nombre: 'Hombro', lado: 'o' },
        { nombre: 'Codo', lado: 'o' },
        { nombre: 'Muñeca', lado: 'a' },
        { nombre: 'Mano', lado: 'a' },
        { nombre: 'Pelvis ósea y acetábulos' },
        { nombre: 'Cadera', lado: 'a' },
        { nombre: 'Rodilla', lado: 'a' },
        { nombre: 'Tobillo', lado: 'o' },
        { nombre: 'Pie', lado: 'o' },
        { nombre: 'Calcáneo', lado: 'o' },
      ] },
      { nombre: 'Angiotomografía', regiones: [
        { nombre: 'Angio-TC de cerebro', verificar: true },
        { nombre: 'Angio-TC de cuello (carótidas)', verificar: true },
        { nombre: 'Angio-TC de tórax (tromboembolia pulmonar)', verificar: true },
        { nombre: 'Angio-TC de aorta', verificar: true },
        { nombre: 'Angio-TC de miembros inferiores', verificar: true },
        { nombre: 'Angio-TC coronaria', verificar: true },
      ] },
    ],
  },
  {
    id: 'rm', nombre: 'Resonancia magnética', corto: 'RM',
    contrastes: ['Simple', 'Contrastada', 'Simple y contrastada'], proyecciones: false,
    grupos: [
      { nombre: 'Neurológico', regiones: [
        { nombre: 'Encéfalo' },
        { nombre: 'Hipófisis (silla turca)' },
        { nombre: 'Órbitas' },
        { nombre: 'Oídos (conductos auditivos internos)', verificar: true },
        { nombre: 'Plexo braquial', lado: 'o', verificar: true },
      ] },
      { nombre: 'Columna', regiones: [
        { nombre: 'Columna cervical' },
        { nombre: 'Columna dorsal' },
        { nombre: 'Columna lumbar' },
        { nombre: 'Columna lumbosacra' },
        { nombre: 'Columna completa' },
        { nombre: 'Articulaciones sacroilíacas' },
      ] },
      { nombre: 'Musculoesquelético', regiones: [
        { nombre: 'Hombro', lado: 'o' },
        { nombre: 'Brazo', lado: 'o' },
        { nombre: 'Codo', lado: 'o' },
        { nombre: 'Antebrazo', lado: 'o' },
        { nombre: 'Muñeca', lado: 'a' },
        { nombre: 'Mano', lado: 'a' },
        { nombre: 'Pelvis' },
        { nombre: 'Cadera', lado: 'a' },
        { nombre: 'Muslo', lado: 'o' },
        { nombre: 'Rodilla', lado: 'a' },
        { nombre: 'Pierna', lado: 'a' },
        { nombre: 'Tobillo', lado: 'o' },
        { nombre: 'Pie', lado: 'o' },
        { nombre: 'Miembros pélvicos (bilateral)', verificar: true },
      ] },
      { nombre: 'Cuerpo', regiones: [
        { nombre: 'Cuello' },
        { nombre: 'Abdomen' },
        { nombre: 'Colangiorresonancia', verificar: true },
        { nombre: 'Pelvis' },
        { nombre: 'Próstata', verificar: true },
        { nombre: 'Mama (bilateral)', verificar: true },
        { nombre: 'Corazón', verificar: true },
      ] },
      { nombre: 'Angiorresonancia', regiones: [
        { nombre: 'Angio-RM de cerebro', verificar: true },
        { nombre: 'Angio-RM de cuello', verificar: true },
        { nombre: 'Angio-RM de miembros inferiores', verificar: true },
      ] },
    ],
  },
  {
    id: 'us', nombre: 'Ultrasonido', corto: 'US',
    contrastes: [], proyecciones: false,
    grupos: [
      { nombre: 'Abdomen y pelvis', regiones: [
        { nombre: 'Abdominal completo' },
        { nombre: 'Abdominal superior' },
        { nombre: 'Hígado y vías biliares' },
        { nombre: 'Renal y vías urinarias' },
        { nombre: 'Vesical y prostático (suprapúbico)', verificar: true },
        { nombre: 'Pélvico ginecológico' },
        { nombre: 'Endovaginal', verificar: true },
        { nombre: 'Obstétrico' },
        { nombre: 'Pared abdominal y hernias', verificar: true },
        { nombre: 'Región inguinal', lado: 'a', verificar: true },
      ] },
      { nombre: 'Cuello y superficiales', regiones: [
        { nombre: 'Tiroides' },
        { nombre: 'Cuello' },
        { nombre: 'Mama', lado: 'a' },
        { nombre: 'Testicular' },
        { nombre: 'Partes blandas', lado: 'as' },
      ] },
      { nombre: 'Musculoesquelético', regiones: [
        { nombre: 'Hombro', lado: 'o' },
        { nombre: 'Codo', lado: 'o' },
        { nombre: 'Muñeca', lado: 'a' },
        { nombre: 'Mano', lado: 'a' },
        { nombre: 'Cadera', lado: 'a' },
        { nombre: 'Cadera del lactante (displasia)', verificar: true },
        { nombre: 'Rodilla', lado: 'a' },
        { nombre: 'Tobillo', lado: 'o' },
        { nombre: 'Pie', lado: 'o' },
        { nombre: 'Tendón de Aquiles', lado: 'o', verificar: true },
      ] },
      { nombre: 'Doppler', regiones: [
        { nombre: 'Doppler venoso de miembros inferiores', lado: 'os' },
        { nombre: 'Doppler arterial de miembros inferiores', lado: 'os' },
        { nombre: 'Doppler venoso de miembros superiores', lado: 'os' },
        { nombre: 'Doppler arterial de miembros superiores', lado: 'os' },
        { nombre: 'Doppler carotídeo' },
        { nombre: 'Doppler renal', verificar: true },
        { nombre: 'Doppler testicular', verificar: true },
      ] },
    ],
  },
  {
    id: 'dxa', nombre: 'Densitometría ósea', corto: 'DXA',
    contrastes: [], proyecciones: false,
    grupos: [
      { nombre: 'Sitios', regiones: [
        { nombre: 'Columna lumbar y cadera' },
        { nombre: 'Antebrazo (radio 33 %)' },
        { nombre: 'Cuerpo completo (composición corporal)', verificar: true },
      ] },
    ],
  },
  {
    id: 'mx', nombre: 'Mastografía', corto: 'Mx',
    contrastes: ['De tamizaje', 'Diagnóstica'], proyecciones: true,
    grupos: [
      { nombre: 'Mama', regiones: [
        { nombre: 'Mamas (bilateral)', rutina: ['Craneocaudal', 'Mediolateral oblicua'], especiales: ['Compresión focalizada', 'Magnificación'], verificar: true },
        { nombre: 'Mama unilateral', lado: 'a', rutina: ['Craneocaudal', 'Mediolateral oblicua'], especiales: ['Compresión focalizada', 'Magnificación'], verificar: true },
      ] },
    ],
  },
  {
    id: 'mn', nombre: 'Medicina nuclear', corto: 'MN',
    contrastes: [], proyecciones: false,
    grupos: [
      { nombre: 'Gammagrafías', regiones: [
        { nombre: 'Ósea (rastreo corporal total)', verificar: true },
        { nombre: 'Ósea trifásica', lado: 'a', verificar: true },
        { nombre: 'Con leucocitos marcados (infección)', verificar: true },
        { nombre: 'Tiroidea', verificar: true },
        { nombre: 'Paratiroides', verificar: true },
        { nombre: 'Renal', verificar: true },
        { nombre: 'Perfusión miocárdica', verificar: true },
        { nombre: 'Pulmonar ventilación/perfusión', verificar: true },
      ] },
    ],
  },
  {
    id: 'pet', nombre: 'PET-CT', corto: 'PET',
    contrastes: [], proyecciones: false,
    grupos: [
      { nombre: 'Radiotrazador', regiones: [
        { nombre: 'FDG cuerpo completo', verificar: true },
        { nombre: 'PSMA', verificar: true },
        { nombre: 'Otro radiotrazador', verificar: true },
      ] },
    ],
  },
  {
    id: 'fl', nombre: 'Estudios contrastados (fluoroscopía)', corto: 'Fluoro',
    contrastes: [], proyecciones: false,
    grupos: [
      { nombre: 'Estudios', regiones: [
        { nombre: 'Serie esofagogastroduodenal', verificar: true },
        { nombre: 'Esofagograma', verificar: true },
        { nombre: 'Tránsito intestinal', verificar: true },
        { nombre: 'Colon por enema', verificar: true },
        { nombre: 'Urografía excretora', verificar: true },
        { nombre: 'Cistouretrografía miccional', verificar: true },
        { nombre: 'Histerosalpingografía', verificar: true },
        { nombre: 'Fistulografía', verificar: true },
        { nombre: 'Mielografía', verificar: true },
        { nombre: 'Artrografía', lado: 'a', verificar: true },
        { nombre: 'Angiografía por cateterismo', verificar: true },
      ] },
    ],
  },
  {
    id: 'eco', nombre: 'Ecocardiograma', corto: 'Eco',
    contrastes: [], proyecciones: false,
    grupos: [
      { nombre: 'Tipo', regiones: [
        { nombre: 'Transtorácico', verificar: true },
        { nombre: 'Transesofágico', verificar: true },
        { nombre: 'De estrés', verificar: true },
      ] },
    ],
  },
  {
    id: 'otro', nombre: 'Otro', corto: 'Otro',
    contrastes: [], proyecciones: false,
    grupos: [],
  },
]
