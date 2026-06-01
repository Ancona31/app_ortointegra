/* Spinus — datos de ejemplo para el prototipo "Crea tu Caso Clínico" */
(function () {
  // Placeholder "radiográfico": gradiente oscuro con grid sutil (simula Rx/MRI)
  const rx = (a, b) => `linear-gradient(150deg, ${a}, ${b})`;

  window.SpinusData = {
    doctor: {
      name: "Angel M. Ancona Pérez",
      specialty: "Cirugía de Columna · Ortopedia y Traumatología",
      handle: "@dr.ancona.columna",
      phone: "999 123 4567",
      city: "Mérida, México",
      accent: "#1a3a5c",
    },

    // Estados: borrador, listo, publicado
    cases: [
      {
        id: "c1",
        title: "Escoliosis idiopática — corrección con instrumentación",
        region: "Columna toracolumbar",
        kind: "Pre / Post-operatorio",
        linked: true,
        patient: "L. M. Poot T.",
        status: "listo",
        tone: "Serio / educativo",
        updated: "hace 2 h",
        media: { rx: 4, foto: 2, video: 1 },
        consent: true,
        cover: rx("#1f3a52", "#0c1722"),
        mono: "EI", monoColor: "--anno-blue",
      },
      {
        id: "c2",
        title: "Hernia discal L4-L5 — microdiscectomía",
        region: "Columna lumbar",
        kind: "Caso quirúrgico",
        linked: true,
        patient: "Pruebolio E.",
        status: "borrador",
        tone: "Serio / educativo",
        updated: "hace 4 días",
        media: { rx: 3, foto: 1, video: 0 },
        consent: false,
        cover: rx("#243a4d", "#101c26"),
        mono: "HD", monoColor: "--purple",
      },
      {
        id: "c3",
        title: "Espondilolistesis — evolución radiográfica a 12 meses",
        region: "Columna lumbosacra",
        kind: "Seguimiento",
        linked: false,
        patient: null,
        status: "publicado",
        tone: "Relajado / divulgativo",
        updated: "hace 1 sem",
        media: { rx: 6, foto: 0, video: 0 },
        consent: true,
        cover: rx("#1b3340", "#0a141c"),
        mono: "EL", monoColor: "--green",
      },
      {
        id: "c4",
        title: "Fractura vertebral por compresión — cifoplastía",
        region: "Columna torácica",
        kind: "Antes / Después",
        linked: true,
        patient: "A. Ma.",
        status: "borrador",
        tone: "Serio / educativo",
        updated: "hace 1 sem",
        media: { rx: 2, foto: 2, video: 1 },
        consent: false,
        cover: rx("#2a3a48", "#0e1820"),
        mono: "FV", monoColor: "--amber",
      },
    ],

    // Plantillas de export
    templates: [
      { id: "academico", name: "Académico", sub: "Paper / conferencia", accentVar: "--navy-700",
        desc: "Sobrio, alto contraste, tipografía seria. Para colegas y congresos." },
      { id: "clinico", name: "Clínico", sub: "Ficha comparativa", accentVar: "--accent",
        desc: "Antes/después con etiquetas, datos del caso. Para revisión profesional." },
      { id: "divulgativo", name: "Divulgativo", sub: "Redes accesibles", accentVar: "--grad-teal",
        desc: "Lenguaje cercano, color amable. Para audiencia general." },
      { id: "marca", name: "Marca personal", sub: "Tu identidad", accentVar: "--navy-card-grad",
        desc: "Tu logo y color protagonistas. Para construir marca del médico." },
    ],

    formats: [
      { id: "pdf",      name: "PDF profesional", sub: "Conferencias · colegas", ratio: "Carta", icon: "FileText", w: 150, h: 194 },
      { id: "story",    name: "Story 9:16",      sub: "Instagram · Facebook",   ratio: "1080×1920", icon: "Phone", w: 110, h: 195 },
      { id: "carrusel", name: "Carrusel",        sub: "Instagram (varias)",     ratio: "1080×1350", icon: "Grid",  w: 156, h: 195 },
      { id: "feed",     name: "Imagen feed",     sub: "Post cuadrado",          ratio: "1080×1080", icon: "Square",w: 180, h: 180 },
    ],
  };
})();
