export type MedicamentoDB = {
  nombre_comercial: string
  principio_activo: string
  presentacion: string
  dosis_sugerida: string
}

export const MEDICAMENTOS: MedicamentoDB[] = [

  // ══════════════════════════════════════════════════════════════════════
  // AINEs / ANALGÉSICOS NO OPIOIDES
  // ══════════════════════════════════════════════════════════════════════

  // ─── Diclofenaco ──────────────────────────────────────────────────────
  { nombre_comercial: 'Voltaren', principio_activo: 'Diclofenaco sódico', presentacion: 'Tabletas 50 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 5-7 días' },
  { nombre_comercial: 'Voltaren Retard', principio_activo: 'Diclofenaco sódico', presentacion: 'Tabletas 100 mg liberación prolongada', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Cataflam', principio_activo: 'Diclofenaco potásico', presentacion: 'Tabletas 50 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 5-7 días' },
  { nombre_comercial: 'Diclofenaco', principio_activo: 'Diclofenaco sódico', presentacion: 'Solución inyectable 75 mg/3 ml', dosis_sugerida: '75 mg IM cada 12-24 hrs, máximo 2 días' },
  { nombre_comercial: 'Diclofenaco', principio_activo: 'Diclofenaco sódico', presentacion: 'Tabletas 25 mg', dosis_sugerida: '1-2 tabletas cada 8 hrs con alimentos' },

  // ─── Dexketoprofeno ────────────────────────────────────────────────────
  { nombre_comercial: 'Keral', principio_activo: 'Dexketoprofeno trometamol', presentacion: 'Tabletas 25 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 5-7 días' },
  { nombre_comercial: 'Keral', principio_activo: 'Dexketoprofeno trometamol', presentacion: 'Solución inyectable 50 mg/2 ml', dosis_sugerida: '50 mg IM/IV cada 8-12 hrs, máximo 2 días' },
  { nombre_comercial: 'Dexketoprofeno', principio_activo: 'Dexketoprofeno trometamol', presentacion: 'Tabletas 25 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos' },
  { nombre_comercial: 'Enantyum', principio_activo: 'Dexketoprofeno trometamol', presentacion: 'Tabletas 25 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 5-7 días' },
  { nombre_comercial: 'Enantyum', principio_activo: 'Dexketoprofeno trometamol', presentacion: 'Sobres granulado 25 mg', dosis_sugerida: '1 sobre disuelto en agua cada 8 hrs' },

  // ─── Ketoprofeno ───────────────────────────────────────────────────────
  { nombre_comercial: 'Profenid', principio_activo: 'Ketoprofeno', presentacion: 'Cápsulas 100 mg', dosis_sugerida: '1 cápsula cada 12 hrs con alimentos' },
  { nombre_comercial: 'Profenid', principio_activo: 'Ketoprofeno', presentacion: 'Cápsulas 200 mg liberación prolongada', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos' },
  { nombre_comercial: 'Profenid', principio_activo: 'Ketoprofeno', presentacion: 'Solución inyectable 100 mg/2 ml', dosis_sugerida: '100 mg IM cada 12 hrs' },
  { nombre_comercial: 'Ketoprofeno', principio_activo: 'Ketoprofeno', presentacion: 'Cápsulas 50 mg', dosis_sugerida: '1-2 cápsulas cada 8 hrs con alimentos' },
  { nombre_comercial: 'Orudis', principio_activo: 'Ketoprofeno', presentacion: 'Cápsulas 100 mg', dosis_sugerida: '1 cápsula cada 12 hrs con alimentos' },

  // ─── Ibuprofeno ────────────────────────────────────────────────────────
  { nombre_comercial: 'Motrin', principio_activo: 'Ibuprofeno', presentacion: 'Tabletas 800 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 5-7 días' },
  { nombre_comercial: 'Motrin', principio_activo: 'Ibuprofeno', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1-2 tabletas cada 8 hrs con alimentos' },
  { nombre_comercial: 'Advil', principio_activo: 'Ibuprofeno', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1-2 tabletas cada 6-8 hrs con alimentos' },
  { nombre_comercial: 'Ibuprofeno', principio_activo: 'Ibuprofeno', presentacion: 'Tabletas 600 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos' },
  { nombre_comercial: 'Ibuprofen', principio_activo: 'Ibuprofeno', presentacion: 'Cápsulas blandas 400 mg', dosis_sugerida: '1-2 cápsulas cada 8 hrs con alimentos' },

  // ─── Naproxeno ─────────────────────────────────────────────────────────
  { nombre_comercial: 'Flanax', principio_activo: 'Naproxeno sódico', presentacion: 'Tabletas 550 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos' },
  { nombre_comercial: 'Nalgesin', principio_activo: 'Naproxeno sódico', presentacion: 'Tabletas 275 mg', dosis_sugerida: '2 tabletas cada 12 hrs con alimentos' },
  { nombre_comercial: 'Naprosyn', principio_activo: 'Naproxeno', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos' },
  { nombre_comercial: 'Naproxeno', principio_activo: 'Naproxeno sódico', presentacion: 'Tabletas 250 mg', dosis_sugerida: '1-2 tabletas cada 8-12 hrs con alimentos' },

  // ─── Meloxicam ─────────────────────────────────────────────────────────
  { nombre_comercial: 'Mobic', principio_activo: 'Meloxicam', presentacion: 'Tabletas 7.5 mg', dosis_sugerida: '1-2 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Melox', principio_activo: 'Meloxicam', presentacion: 'Tabletas 15 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Meloxicam', principio_activo: 'Meloxicam', presentacion: 'Tabletas 7.5 mg', dosis_sugerida: '1-2 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Meloxicam', principio_activo: 'Meloxicam', presentacion: 'Solución inyectable 15 mg/1.5 ml', dosis_sugerida: '15 mg IM cada 24 hrs por 2-3 días' },

  // ─── Ketorolaco ────────────────────────────────────────────────────────
  { nombre_comercial: 'Dolac', principio_activo: 'Ketorolaco trometamol', presentacion: 'Tabletas 10 mg', dosis_sugerida: '1 tableta cada 6-8 hrs por máximo 5 días' },
  { nombre_comercial: 'Ketorolaco', principio_activo: 'Ketorolaco trometamol', presentacion: 'Tabletas 10 mg', dosis_sugerida: '1 tableta cada 6-8 hrs por máximo 5 días' },
  { nombre_comercial: 'Dolac', principio_activo: 'Ketorolaco trometamol', presentacion: 'Solución inyectable 30 mg/1 ml', dosis_sugerida: '30 mg IM/IV cada 6-8 hrs, máx 5 días' },
  { nombre_comercial: 'Ketorolaco', principio_activo: 'Ketorolaco trometamol', presentacion: 'Solución inyectable 60 mg/2 ml', dosis_sugerida: '30 mg IM/IV cada 6-8 hrs, máx 5 días' },

  // ─── COX-2 selectivos ──────────────────────────────────────────────────
  { nombre_comercial: 'Celebrex', principio_activo: 'Celecoxib', presentacion: 'Cápsulas 100 mg', dosis_sugerida: '2 cápsulas cada 12 hrs con alimentos' },
  { nombre_comercial: 'Celebrex', principio_activo: 'Celecoxib', presentacion: 'Cápsulas 200 mg', dosis_sugerida: '1 cápsula cada 12-24 hrs con alimentos' },
  { nombre_comercial: 'Arcoxia', principio_activo: 'Etoricoxib', presentacion: 'Tabletas 60 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Arcoxia', principio_activo: 'Etoricoxib', presentacion: 'Tabletas 90 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos (máx 8 días en agudo)' },
  { nombre_comercial: 'Arcoxia', principio_activo: 'Etoricoxib', presentacion: 'Tabletas 120 mg', dosis_sugerida: '1 tableta cada 24 hrs en gota aguda, máx 8 días' },
  { nombre_comercial: 'Dynastat', principio_activo: 'Parecoxib', presentacion: 'Polvo inyectable 40 mg', dosis_sugerida: '40 mg IV/IM cada 12 hrs (dolor postquirúrgico)' },
  { nombre_comercial: 'Prexige', principio_activo: 'Lumiracoxib', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1-4 tabletas cada 24 hrs con alimentos' },

  // ─── Otros AINEs ───────────────────────────────────────────────────────
  { nombre_comercial: 'Piroxicam', principio_activo: 'Piroxicam', presentacion: 'Cápsulas 20 mg', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos' },
  { nombre_comercial: 'Feldene', principio_activo: 'Piroxicam', presentacion: 'Cápsulas 20 mg', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos' },
  { nombre_comercial: 'Feldene Flash', principio_activo: 'Piroxicam', presentacion: 'Tabletas dispersables 20 mg', dosis_sugerida: '1 tableta cada 24 hrs (disolver en boca)' },
  { nombre_comercial: 'Nimesulida', principio_activo: 'Nimesulida', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos por 7-10 días' },
  { nombre_comercial: 'Aulin', principio_activo: 'Nimesulida', presentacion: 'Sobres granulado 100 mg', dosis_sugerida: '1 sobre disuelto en agua cada 12 hrs con alimentos' },
  { nombre_comercial: 'Indocin', principio_activo: 'Indometacina', presentacion: 'Cápsulas 25 mg', dosis_sugerida: '1-2 cápsulas cada 8-12 hrs con alimentos' },
  { nombre_comercial: 'Indometacina', principio_activo: 'Indometacina', presentacion: 'Cápsulas 50 mg', dosis_sugerida: '1 cápsula cada 8-12 hrs con alimentos' },
  { nombre_comercial: 'Airtal', principio_activo: 'Aceclofenaco', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos' },
  { nombre_comercial: 'Aceclofenaco', principio_activo: 'Aceclofenaco', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos' },
  { nombre_comercial: 'Lornoxicam', principio_activo: 'Lornoxicam', presentacion: 'Tabletas 8 mg', dosis_sugerida: '1 tableta cada 8-12 hrs con alimentos' },
  { nombre_comercial: 'Tenoxicam', principio_activo: 'Tenoxicam', presentacion: 'Tabletas 20 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Tilcotil', principio_activo: 'Tenoxicam', presentacion: 'Tabletas 20 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Acemetacina', principio_activo: 'Acemetacina', presentacion: 'Cápsulas 60 mg', dosis_sugerida: '1 cápsula cada 8 hrs con alimentos' },
  { nombre_comercial: 'Rantudil', principio_activo: 'Acemetacina', presentacion: 'Cápsulas 60 mg', dosis_sugerida: '1 cápsula cada 8 hrs con alimentos' },

  // ─── Paracetamol / Metamizol ───────────────────────────────────────────
  { nombre_comercial: 'Tylenol', principio_activo: 'Paracetamol', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1-2 tabletas cada 6-8 hrs, máx 8 tabletas/día' },
  { nombre_comercial: 'Tempra', principio_activo: 'Paracetamol', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1-2 tabletas cada 6-8 hrs, máx 8 tabletas/día' },
  { nombre_comercial: 'Paracetamol', principio_activo: 'Paracetamol', presentacion: 'Tabletas 1 g', dosis_sugerida: '1 tableta cada 6-8 hrs, máx 4 g/día' },
  { nombre_comercial: 'Nolotil', principio_activo: 'Metamizol sódico', presentacion: 'Cápsulas 575 mg', dosis_sugerida: '1-2 cápsulas cada 6-8 hrs' },
  { nombre_comercial: 'Dipirona', principio_activo: 'Metamizol sódico', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1-2 tabletas cada 6-8 hrs' },
  { nombre_comercial: 'Metamizol', principio_activo: 'Metamizol sódico', presentacion: 'Solución inyectable 1 g/2 ml', dosis_sugerida: '1-2 g IM/IV cada 6-8 hrs según dolor' },
  { nombre_comercial: 'Buscapina Compositum', principio_activo: 'Butilescopolamina / Metamizol', presentacion: 'Tabletas 10/500 mg', dosis_sugerida: '1-2 tabletas cada 8 hrs' },
  { nombre_comercial: 'Buscapina Compositum N', principio_activo: 'Butilescopolamina / Metamizol', presentacion: 'Solución inyectable 20/2500 mg/5 ml', dosis_sugerida: '1 ampolleta IM cada 8 hrs' },

  // ══════════════════════════════════════════════════════════════════════
  // RELAJANTES MUSCULARES
  // ══════════════════════════════════════════════════════════════════════
  { nombre_comercial: 'Flexeril', principio_activo: 'Ciclobenzaprina', presentacion: 'Tabletas 10 mg', dosis_sugerida: '1 tableta cada 8 hrs (preferentemente noche)' },
  { nombre_comercial: 'Ciclobenzaprina', principio_activo: 'Ciclobenzaprina', presentacion: 'Tabletas 5 mg', dosis_sugerida: '1 tableta cada 8 hrs' },
  { nombre_comercial: 'Robaxin', principio_activo: 'Metocarbamol', presentacion: 'Tabletas 750 mg', dosis_sugerida: '2 tabletas cada 8 hrs los primeros 2-3 días, luego 1 tableta cada 8 hrs' },
  { nombre_comercial: 'Metocarbamol', principio_activo: 'Metocarbamol', presentacion: 'Tabletas 500 mg', dosis_sugerida: '2 tabletas cada 8 hrs' },
  { nombre_comercial: 'Soma', principio_activo: 'Carisoprodol', presentacion: 'Tabletas 350 mg', dosis_sugerida: '1 tableta cada 8 hrs y al acostarse' },
  { nombre_comercial: 'Carisoprodol', principio_activo: 'Carisoprodol', presentacion: 'Tabletas 350 mg', dosis_sugerida: '1 tableta cada 8 hrs y al acostarse' },
  { nombre_comercial: 'Mydocalm', principio_activo: 'Tolperisona', presentacion: 'Tabletas 150 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos' },
  { nombre_comercial: 'Tolperisona', principio_activo: 'Tolperisona', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1-2 tabletas cada 8 hrs con alimentos' },
  { nombre_comercial: 'Lioresal', principio_activo: 'Baclofeno', presentacion: 'Tabletas 10 mg', dosis_sugerida: '1 tableta cada 8 hrs, aumentar gradualmente cada 3 días' },
  { nombre_comercial: 'Baclofeno', principio_activo: 'Baclofeno', presentacion: 'Tabletas 25 mg', dosis_sugerida: '1 tableta cada 8-12 hrs, ajustar según respuesta' },
  { nombre_comercial: 'Sibaril', principio_activo: 'Tizanidina', presentacion: 'Tabletas 2 mg', dosis_sugerida: '1-2 tabletas cada 8 hrs' },
  { nombre_comercial: 'Tizanidina', principio_activo: 'Tizanidina', presentacion: 'Tabletas 4 mg', dosis_sugerida: '1 tableta cada 8-12 hrs' },
  { nombre_comercial: 'Orfenadrina', principio_activo: 'Orfenadrina', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Norflex', principio_activo: 'Orfenadrina', presentacion: 'Tabletas 100 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Norflex', principio_activo: 'Orfenadrina', presentacion: 'Solución inyectable 60 mg/2 ml', dosis_sugerida: '60 mg IM/IV cada 12 hrs' },
  { nombre_comercial: 'Dantrium', principio_activo: 'Dantroleno', presentacion: 'Cápsulas 25 mg', dosis_sugerida: '1 cápsula cada 8 hrs, aumentar gradualmente hasta 100 mg cada 8 hrs' },
  { nombre_comercial: 'Valium', principio_activo: 'Diazepam', presentacion: 'Tabletas 5 mg', dosis_sugerida: '1 tableta cada 8-12 hrs (espasmo muscular agudo)' },
  { nombre_comercial: 'Diazepam', principio_activo: 'Diazepam', presentacion: 'Tabletas 10 mg', dosis_sugerida: '½-1 tableta cada 8-12 hrs' },
  { nombre_comercial: 'Muscoril', principio_activo: 'Tiocolchicósido', presentacion: 'Cápsulas 4 mg', dosis_sugerida: '1 cápsula cada 12 hrs por máximo 7 días' },
  { nombre_comercial: 'Tiocolchicósido', principio_activo: 'Tiocolchicósido', presentacion: 'Solución inyectable 4 mg/2 ml', dosis_sugerida: '4-8 mg IM cada 12 hrs por máximo 5 días' },
  { nombre_comercial: 'Lumirelax', principio_activo: 'Methocarbamol + Ibuprofeno', presentacion: 'Tabletas 400/200 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos' },
  { nombre_comercial: 'Yurelax', principio_activo: 'Ciclobenzaprina + Diclofenaco', presentacion: 'Tabletas 5/50 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos' },

  // ══════════════════════════════════════════════════════════════════════
  // OPIOIDES / ANALGÉSICOS FUERTES
  // ══════════════════════════════════════════════════════════════════════
  { nombre_comercial: 'Tramal', principio_activo: 'Tramadol', presentacion: 'Cápsulas 50 mg', dosis_sugerida: '1-2 cápsulas cada 6-8 hrs, máx 400 mg/día' },
  { nombre_comercial: 'Tramadol', principio_activo: 'Tramadol', presentacion: 'Tabletas 100 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12-24 hrs, máx 400 mg/día' },
  { nombre_comercial: 'Tramal Long', principio_activo: 'Tramadol', presentacion: 'Tabletas 100 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12-24 hrs' },
  { nombre_comercial: 'Tramal', principio_activo: 'Tramadol', presentacion: 'Solución inyectable 100 mg/2 ml', dosis_sugerida: '100 mg IV/IM cada 6-8 hrs, diluir en SF' },
  { nombre_comercial: 'Tramacet', principio_activo: 'Tramadol / Paracetamol', presentacion: 'Tabletas 37.5/325 mg', dosis_sugerida: '1-2 tabletas cada 6-8 hrs, máx 8 tabletas/día' },
  { nombre_comercial: 'Zaldiar', principio_activo: 'Tramadol / Paracetamol', presentacion: 'Tabletas 37.5/325 mg', dosis_sugerida: '1-2 tabletas cada 6-8 hrs, máx 8 tabletas/día' },
  { nombre_comercial: 'Tapentadol', principio_activo: 'Tapentadol', presentacion: 'Tabletas 50 mg', dosis_sugerida: '1 tableta cada 4-6 hrs según dolor, máx 500 mg/día' },
  { nombre_comercial: 'Nucynta', principio_activo: 'Tapentadol', presentacion: 'Tabletas 100 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs, ajustar según respuesta' },
  { nombre_comercial: 'Palexia', principio_activo: 'Tapentadol', presentacion: 'Tabletas 50 mg', dosis_sugerida: '1 tableta cada 4-6 hrs, máx 500 mg/día' },
  { nombre_comercial: 'Palexia Retard', principio_activo: 'Tapentadol', presentacion: 'Tabletas 100 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Codeína', principio_activo: 'Codeína fosfato', presentacion: 'Tabletas 30 mg', dosis_sugerida: '1 tableta cada 4-6 hrs según necesidad' },
  { nombre_comercial: 'Codeína', principio_activo: 'Codeína fosfato', presentacion: 'Tabletas 60 mg', dosis_sugerida: '1 tableta cada 6-8 hrs según necesidad' },
  { nombre_comercial: 'Tylex', principio_activo: 'Paracetamol / Codeína', presentacion: 'Cápsulas 500/30 mg', dosis_sugerida: '1-2 cápsulas cada 4-6 hrs, máx 8 cápsulas/día' },
  { nombre_comercial: 'Morfina', principio_activo: 'Sulfato de morfina', presentacion: 'Tabletas 10 mg liberación inmediata', dosis_sugerida: '5-15 mg cada 4 hrs, ajustar según respuesta' },
  { nombre_comercial: 'Morfina LP', principio_activo: 'Sulfato de morfina', presentacion: 'Tabletas 30 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs (no masticar)' },
  { nombre_comercial: 'MST Continus', principio_activo: 'Sulfato de morfina', presentacion: 'Tabletas 15 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Morfina', principio_activo: 'Cloruro de morfina', presentacion: 'Solución inyectable 10 mg/1 ml', dosis_sugerida: '5-10 mg SC/IM cada 4 hrs, titular según dolor' },
  { nombre_comercial: 'OxyContin', principio_activo: 'Oxicodona', presentacion: 'Tabletas 10 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs (no masticar)' },
  { nombre_comercial: 'OxyContin', principio_activo: 'Oxicodona', presentacion: 'Tabletas 20 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'OxyContin', principio_activo: 'Oxicodona', presentacion: 'Tabletas 40 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Oxynorm', principio_activo: 'Oxicodona', presentacion: 'Cápsulas 5 mg liberación inmediata', dosis_sugerida: '1-2 cápsulas cada 4-6 hrs (rescate)' },
  { nombre_comercial: 'Targinact', principio_activo: 'Oxicodona / Naloxona', presentacion: 'Tabletas 10/5 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Durogesic', principio_activo: 'Fentanilo transdérmico', presentacion: 'Parche 12 mcg/hr', dosis_sugerida: '1 parche cada 72 hrs (iniciar en opioides ingenuos)' },
  { nombre_comercial: 'Durogesic', principio_activo: 'Fentanilo transdérmico', presentacion: 'Parche 25 mcg/hr', dosis_sugerida: '1 parche cada 72 hrs' },
  { nombre_comercial: 'Durogesic', principio_activo: 'Fentanilo transdérmico', presentacion: 'Parche 50 mcg/hr', dosis_sugerida: '1 parche cada 72 hrs' },
  { nombre_comercial: 'Durogesic', principio_activo: 'Fentanilo transdérmico', presentacion: 'Parche 75 mcg/hr', dosis_sugerida: '1 parche cada 72 hrs' },
  { nombre_comercial: 'Fentanilo', principio_activo: 'Fentanilo', presentacion: 'Solución inyectable 0.05 mg/1 ml', dosis_sugerida: '0.5-1 mcg/kg IV lento, titular según dolor' },
  { nombre_comercial: 'Abstral', principio_activo: 'Fentanilo', presentacion: 'Tabletas sublinguales 100 mcg', dosis_sugerida: '100-800 mcg sublingual (rescate en dolor irruptivo)' },
  { nombre_comercial: 'Actiq', principio_activo: 'Fentanilo citrato', presentacion: 'Aplicador bucal 200 mcg', dosis_sugerida: '200-1600 mcg transmucoso (dolor irruptivo)' },
  { nombre_comercial: 'Norspan', principio_activo: 'Buprenorfina transdérmica', presentacion: 'Parche 5 mcg/hr', dosis_sugerida: '1 parche cada 7 días (cambiar el mismo día de la semana)' },
  { nombre_comercial: 'Norspan', principio_activo: 'Buprenorfina transdérmica', presentacion: 'Parche 10 mcg/hr', dosis_sugerida: '1 parche cada 7 días' },
  { nombre_comercial: 'Norspan', principio_activo: 'Buprenorfina transdérmica', presentacion: 'Parche 20 mcg/hr', dosis_sugerida: '1 parche cada 7 días' },
  { nombre_comercial: 'Transtec', principio_activo: 'Buprenorfina transdérmica', presentacion: 'Parche 35 mcg/hr', dosis_sugerida: '1 parche cada 4 días (96 hrs)' },
  { nombre_comercial: 'Hidromorfona', principio_activo: 'Hidromorfona', presentacion: 'Tabletas 2 mg liberación inmediata', dosis_sugerida: '1-2 tabletas cada 4-6 hrs, ajustar según respuesta' },
  { nombre_comercial: 'Palladone', principio_activo: 'Hidromorfona', presentacion: 'Cápsulas 4 mg', dosis_sugerida: '1 cápsula cada 4-6 hrs' },
  { nombre_comercial: 'Nubain', principio_activo: 'Nalbufina', presentacion: 'Solución inyectable 10 mg/1 ml', dosis_sugerida: '10-20 mg IM/IV/SC cada 3-6 hrs según dolor' },
  { nombre_comercial: 'Metadona', principio_activo: 'Metadona', presentacion: 'Tabletas 5 mg', dosis_sugerida: 'Dosis individualizada, iniciar 2.5-5 mg cada 8-12 hrs (especialista)' },
  { nombre_comercial: 'Meperidina', principio_activo: 'Meperidina (Petidina)', presentacion: 'Solución inyectable 100 mg/2 ml', dosis_sugerida: '50-100 mg IM cada 3-4 hrs (uso hospitalario)' },
  { nombre_comercial: 'Dolantina', principio_activo: 'Meperidina', presentacion: 'Solución inyectable 100 mg/2 ml', dosis_sugerida: '50-100 mg IM cada 3-4 hrs' },
  { nombre_comercial: 'Naloxona', principio_activo: 'Naloxona', presentacion: 'Solución inyectable 0.4 mg/1 ml', dosis_sugerida: '0.4-2 mg IV/IM (reversión de opioides, repetir cada 2-3 min)' },

  // ══════════════════════════════════════════════════════════════════════
  // NEUROPÁTICOS / DOLOR CRÓNICO
  // ══════════════════════════════════════════════════════════════════════
  { nombre_comercial: 'Lyrica', principio_activo: 'Pregabalina', presentacion: 'Cápsulas 25 mg', dosis_sugerida: '1 cápsula cada 8-12 hrs (dosis inicial)' },
  { nombre_comercial: 'Lyrica', principio_activo: 'Pregabalina', presentacion: 'Cápsulas 75 mg', dosis_sugerida: '1 cápsula cada 12 hrs, puede aumentarse a 150 mg c/12 hrs' },
  { nombre_comercial: 'Lyrica', principio_activo: 'Pregabalina', presentacion: 'Cápsulas 150 mg', dosis_sugerida: '1 cápsula cada 12 hrs' },
  { nombre_comercial: 'Lyrica', principio_activo: 'Pregabalina', presentacion: 'Cápsulas 300 mg', dosis_sugerida: '1 cápsula cada 12 hrs (dosis máxima 600 mg/día)' },
  { nombre_comercial: 'Lyrica CR', principio_activo: 'Pregabalina', presentacion: 'Tabletas 165 mg liberación prolongada', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Lyrica CR', principio_activo: 'Pregabalina', presentacion: 'Tabletas 330 mg liberación prolongada', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Pregabalina', principio_activo: 'Pregabalina', presentacion: 'Cápsulas 50 mg', dosis_sugerida: '1 cápsula cada 8 hrs' },
  { nombre_comercial: 'Neurontin', principio_activo: 'Gabapentina', presentacion: 'Cápsulas 100 mg', dosis_sugerida: '1 cápsula cada 8 hrs (titulación inicial)' },
  { nombre_comercial: 'Neurontin', principio_activo: 'Gabapentina', presentacion: 'Cápsulas 300 mg', dosis_sugerida: '1 cápsula cada 8 hrs, aumentar gradualmente' },
  { nombre_comercial: 'Neurontin', principio_activo: 'Gabapentina', presentacion: 'Cápsulas 400 mg', dosis_sugerida: '1 cápsula cada 8 hrs' },
  { nombre_comercial: 'Gabapentina', principio_activo: 'Gabapentina', presentacion: 'Cápsulas 600 mg', dosis_sugerida: '1 cápsula cada 8-12 hrs (máx 3600 mg/día)' },
  { nombre_comercial: 'Gabapentina', principio_activo: 'Gabapentina', presentacion: 'Cápsulas 800 mg', dosis_sugerida: '1 cápsula cada 8 hrs' },
  { nombre_comercial: 'Horizant', principio_activo: 'Gabapentina enacarbil', presentacion: 'Tabletas 300 mg liberación prolongada', dosis_sugerida: '1-2 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Cymbalta', principio_activo: 'Duloxetina', presentacion: 'Cápsulas 30 mg', dosis_sugerida: '1 cápsula cada 24 hrs (dosis inicial)' },
  { nombre_comercial: 'Cymbalta', principio_activo: 'Duloxetina', presentacion: 'Cápsulas 60 mg', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos' },
  { nombre_comercial: 'Duloxetina', principio_activo: 'Duloxetina', presentacion: 'Cápsulas 90 mg', dosis_sugerida: '1 cápsula cada 24 hrs (máx 120 mg/día)' },
  { nombre_comercial: 'Amitriptilina', principio_activo: 'Amitriptilina', presentacion: 'Tabletas 10 mg', dosis_sugerida: '1-3 tabletas en la noche al acostarse (iniciar con 10 mg)' },
  { nombre_comercial: 'Tryptizol', principio_activo: 'Amitriptilina', presentacion: 'Tabletas 25 mg', dosis_sugerida: '1 tableta en la noche al acostarse' },
  { nombre_comercial: 'Amitriptilina', principio_activo: 'Amitriptilina', presentacion: 'Tabletas 75 mg', dosis_sugerida: '1 tableta en la noche al acostarse' },
  { nombre_comercial: 'Nortriptilina', principio_activo: 'Nortriptilina', presentacion: 'Cápsulas 25 mg', dosis_sugerida: '1-3 cápsulas en la noche al acostarse' },
  { nombre_comercial: 'Pamelor', principio_activo: 'Nortriptilina', presentacion: 'Cápsulas 10 mg', dosis_sugerida: '1-3 cápsulas en la noche al acostarse' },
  { nombre_comercial: 'Tegretol', principio_activo: 'Carbamazepina', presentacion: 'Tabletas 200 mg', dosis_sugerida: '1 tableta cada 12 hrs, aumentar gradualmente según respuesta' },
  { nombre_comercial: 'Carbamazepina', principio_activo: 'Carbamazepina', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Tegretol CR', principio_activo: 'Carbamazepina', presentacion: 'Tabletas 400 mg liberación prolongada', dosis_sugerida: '1 tableta cada 12-24 hrs' },
  { nombre_comercial: 'Oxcarbazepina', principio_activo: 'Oxcarbazepina', presentacion: 'Tabletas 300 mg', dosis_sugerida: '1 tableta cada 12 hrs, aumentar 300 mg/semana según respuesta' },
  { nombre_comercial: 'Trileptal', principio_activo: 'Oxcarbazepina', presentacion: 'Tabletas 600 mg', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Versatis', principio_activo: 'Lidocaína', presentacion: 'Parche 5% (700 mg)', dosis_sugerida: '1-3 parches en zona afectada 12 hrs con parche / 12 hrs sin parche' },
  { nombre_comercial: 'Lidoderm', principio_activo: 'Lidocaína', presentacion: 'Parche 5% (700 mg)', dosis_sugerida: '1-3 parches en zona afectada 12 hrs / 12 hrs' },
  { nombre_comercial: 'Zostrix', principio_activo: 'Capsaicina', presentacion: 'Crema 0.025%', dosis_sugerida: 'Aplicar 3-4 veces al día en zona afectada (puede arder al inicio)' },
  { nombre_comercial: 'Zostrix HP', principio_activo: 'Capsaicina', presentacion: 'Crema 0.075%', dosis_sugerida: 'Aplicar 3-4 veces al día en zona afectada' },
  { nombre_comercial: 'Qutenza', principio_activo: 'Capsaicina', presentacion: 'Parche 8% (179 mg)', dosis_sugerida: 'Aplicación única por 30-60 min (uso hospitalario especializado)' },
  { nombre_comercial: 'Rivotril', principio_activo: 'Clonazepam', presentacion: 'Tabletas 0.5 mg', dosis_sugerida: '1 tableta cada 12 hrs o en la noche (dolor neuropático)' },
  { nombre_comercial: 'Rivotril', principio_activo: 'Clonazepam', presentacion: 'Tabletas 2 mg', dosis_sugerida: '½-1 tableta en la noche' },
  { nombre_comercial: 'Neurobión Forte', principio_activo: 'Vitaminas B1 / B6 / B12', presentacion: 'Tabletas 100/200/200 mcg', dosis_sugerida: '1 tableta cada 24 hrs (neuropatía periférica)' },
  { nombre_comercial: 'Neurobión', principio_activo: 'Vitaminas B1 / B6 / B12', presentacion: 'Solución inyectable 3 ml', dosis_sugerida: '1 ampolleta IM cada 24 hrs por 10-14 días' },
  { nombre_comercial: 'Vitamina B12', principio_activo: 'Cianocobalamina', presentacion: 'Tabletas 1000 mcg', dosis_sugerida: '1 tableta cada 24 hrs (neuropatía por deficiencia)' },
  { nombre_comercial: 'Metilcobalamina', principio_activo: 'Metilcobalamina', presentacion: 'Cápsulas 1000 mcg', dosis_sugerida: '1 cápsula cada 24 hrs' },
  { nombre_comercial: 'Ácido alfa-lipoico', principio_activo: 'Ácido alfa-lipoico', presentacion: 'Tabletas 600 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas (neuropatía diabética)' },
  { nombre_comercial: 'Thioctacid', principio_activo: 'Ácido alfa-lipoico', presentacion: 'Tabletas 600 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas' },
  { nombre_comercial: 'Topamax', principio_activo: 'Topiramato', presentacion: 'Tabletas 25 mg', dosis_sugerida: 'Iniciar 25 mg/noche, aumentar 25 mg cada semana según respuesta' },
  { nombre_comercial: 'Topiramato', principio_activo: 'Topiramato', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1 tableta cada 12 hrs' },
  { nombre_comercial: 'Venlafaxina', principio_activo: 'Venlafaxina', presentacion: 'Cápsulas 75 mg liberación prolongada', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos (dolor neuropático)' },
  { nombre_comercial: 'Effexor XR', principio_activo: 'Venlafaxina', presentacion: 'Cápsulas 150 mg liberación prolongada', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos' },

  // ══════════════════════════════════════════════════════════════════════
  // CORTICOSTEROIDES
  // ══════════════════════════════════════════════════════════════════════
  { nombre_comercial: 'Prednisona', principio_activo: 'Prednisona', presentacion: 'Tabletas 5 mg', dosis_sugerida: '1-4 tabletas cada 24 hrs con alimentos (esquema decreciente)' },
  { nombre_comercial: 'Prednisona', principio_activo: 'Prednisona', presentacion: 'Tabletas 20 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Prednisona', principio_activo: 'Prednisona', presentacion: 'Tabletas 50 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Medrol', principio_activo: 'Metilprednisolona', presentacion: 'Tabletas 4 mg', dosis_sugerida: 'Según Dosepack: esquema decreciente 8 días' },
  { nombre_comercial: 'Medrol', principio_activo: 'Metilprednisolona', presentacion: 'Tabletas 16 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Solu-Medrol', principio_activo: 'Metilprednisolona', presentacion: 'Polvo inyectable 40 mg', dosis_sugerida: '40-125 mg IV/IM según indicación' },
  { nombre_comercial: 'Solu-Medrol', principio_activo: 'Metilprednisolona', presentacion: 'Polvo inyectable 125 mg', dosis_sugerida: '125-1000 mg IV según indicación (pulsos)' },
  { nombre_comercial: 'Decadrón', principio_activo: 'Dexametasona', presentacion: 'Tabletas 0.75 mg', dosis_sugerida: '2-4 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Dexametasona', principio_activo: 'Dexametasona', presentacion: 'Tabletas 1.5 mg', dosis_sugerida: '1-2 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Dexametasona', principio_activo: 'Dexametasona', presentacion: 'Solución inyectable 4 mg/1 ml', dosis_sugerida: '4-8 mg IM/IV cada 8-24 hrs según indicación' },
  { nombre_comercial: 'Dexametasona', principio_activo: 'Dexametasona', presentacion: 'Solución inyectable 8 mg/2 ml', dosis_sugerida: '4-8 mg IM/IV según indicación' },
  { nombre_comercial: 'Celestone', principio_activo: 'Betametasona', presentacion: 'Tabletas 0.5 mg', dosis_sugerida: '1-4 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Deflazacort', principio_activo: 'Deflazacort', presentacion: 'Tabletas 6 mg', dosis_sugerida: '1-2 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Calcort', principio_activo: 'Deflazacort', presentacion: 'Tabletas 30 mg', dosis_sugerida: '1 tableta cada 24 hrs con alimentos' },
  { nombre_comercial: 'Hidrocortisona', principio_activo: 'Hidrocortisona', presentacion: 'Tabletas 20 mg', dosis_sugerida: '10-20 mg en la mañana y 5-10 mg en la tarde' },
  { nombre_comercial: 'Solu-Cortef', principio_activo: 'Hidrocortisona', presentacion: 'Polvo inyectable 100 mg', dosis_sugerida: '100-500 mg IV según indicación' },

  // ══════════════════════════════════════════════════════════════════════
  // INFILTRACIONES / ANESTÉSICOS LOCALES / USO INTRAARTICULAR
  // ══════════════════════════════════════════════════════════════════════
  { nombre_comercial: 'Lidocaína', principio_activo: 'Lidocaína clorhidrato', presentacion: 'Solución inyectable 1% 50 ml', dosis_sugerida: 'Infiltración local: 1-10 ml según zona (máx 4.5 mg/kg)' },
  { nombre_comercial: 'Xylocaína', principio_activo: 'Lidocaína clorhidrato', presentacion: 'Solución inyectable 2% 20 ml', dosis_sugerida: 'Bloqueo / infiltración: 1-5 ml según zona' },
  { nombre_comercial: 'Lidocaína con epinefrina', principio_activo: 'Lidocaína / Epinefrina', presentacion: 'Solución inyectable 2% 1:100,000', dosis_sugerida: 'Infiltración local: 1-5 ml (no usar en dedos, nariz, pene, orejas)' },
  { nombre_comercial: 'Marcaína', principio_activo: 'Bupivacaína', presentacion: 'Solución inyectable 0.25% 20 ml', dosis_sugerida: 'Bloqueo nervioso: 10-20 ml según técnica' },
  { nombre_comercial: 'Marcaína', principio_activo: 'Bupivacaína', presentacion: 'Solución inyectable 0.5% 20 ml', dosis_sugerida: 'Bloqueo nervioso: 5-20 ml según técnica (máx 2.5 mg/kg)' },
  { nombre_comercial: 'Naropin', principio_activo: 'Ropivacaína', presentacion: 'Solución inyectable 0.2% 200 ml', dosis_sugerida: 'Infusión continua: 6-14 ml/hr para analgesia epidural' },
  { nombre_comercial: 'Naropin', principio_activo: 'Ropivacaína', presentacion: 'Solución inyectable 0.75% 20 ml', dosis_sugerida: 'Bloqueo nervioso: 10-30 ml según técnica' },
  { nombre_comercial: 'Mepivacaína', principio_activo: 'Mepivacaína', presentacion: 'Solución inyectable 1% 20 ml', dosis_sugerida: 'Infiltración: 1-10 ml según zona' },
  { nombre_comercial: 'Mepivacaína', principio_activo: 'Mepivacaína', presentacion: 'Solución inyectable 2% 20 ml', dosis_sugerida: 'Bloqueo: 5-20 ml según técnica (máx 5-6 mg/kg)' },
  { nombre_comercial: 'Kenacort-A', principio_activo: 'Triamcinolona acetónida', presentacion: 'Suspensión inyectable 40 mg/1 ml', dosis_sugerida: 'IA grande (rodilla, hombro): 20-40 mg; IA pequeña: 5-10 mg' },
  { nombre_comercial: 'Triamcinolona', principio_activo: 'Triamcinolona acetónida', presentacion: 'Suspensión inyectable 10 mg/1 ml', dosis_sugerida: 'IA pequeña: 5-10 mg; peritendinosa: 5-20 mg' },
  { nombre_comercial: 'Depo-Medrol', principio_activo: 'Metilprednisolona acetato', presentacion: 'Suspensión inyectable 40 mg/1 ml', dosis_sugerida: 'IA grande: 40-80 mg; IA pequeña: 20-40 mg; bursa: 20-40 mg' },
  { nombre_comercial: 'Depo-Medrol', principio_activo: 'Metilprednisolona acetato', presentacion: 'Suspensión inyectable 80 mg/2 ml', dosis_sugerida: 'IA grande: 40-80 mg' },
  { nombre_comercial: 'Diprophos', principio_activo: 'Betametasona dipropionato / fosfato sódico', presentacion: 'Suspensión inyectable 7 mg/1 ml', dosis_sugerida: 'IA grande: 1-2 ml; IA pequeña: 0.25-0.5 ml; bursa: 1-2 ml' },
  { nombre_comercial: 'Celestone Soluspan', principio_activo: 'Betametasona dipropionato / fosfato sódico', presentacion: 'Suspensión inyectable 6 mg/1 ml', dosis_sugerida: 'IA: 0.5-2 ml según articulación' },
  { nombre_comercial: 'Ostenil', principio_activo: 'Hialuronato de sodio', presentacion: 'Jeringa precargada 20 mg/2 ml', dosis_sugerida: '1 inyección IA semanal por 3-5 semanas' },
  { nombre_comercial: 'Ostenil Plus', principio_activo: 'Hialuronato de sodio', presentacion: 'Jeringa precargada 40 mg/2 ml', dosis_sugerida: '1 inyección IA única o 1 semanal por 3 semanas' },
  { nombre_comercial: 'Synvisc', principio_activo: 'Hylan G-F 20', presentacion: 'Jeringa precargada 16 mg/2 ml', dosis_sugerida: '1 inyección IA semanal por 3 semanas' },
  { nombre_comercial: 'Synvisc-One', principio_activo: 'Hylan G-F 20', presentacion: 'Jeringa precargada 48 mg/6 ml', dosis_sugerida: '1 inyección IA única' },
  { nombre_comercial: 'Durolane', principio_activo: 'Hialuronato de sodio estabilizado', presentacion: 'Jeringa precargada 60 mg/3 ml', dosis_sugerida: '1 inyección IA única' },
  { nombre_comercial: 'Supartz', principio_activo: 'Hialuronato de sodio', presentacion: 'Jeringa precargada 25 mg/2.5 ml', dosis_sugerida: '1 inyección IA semanal por 5 semanas' },
  { nombre_comercial: 'Euflexxa', principio_activo: 'Hialuronato de sodio', presentacion: 'Jeringa precargada 20 mg/2 ml', dosis_sugerida: '1 inyección IA semanal por 3 semanas' },
  { nombre_comercial: 'PRP Autólogo', principio_activo: 'Plasma Rico en Plaquetas', presentacion: 'Preparación autóloga variable', dosis_sugerida: 'Infiltración IA o peritendinosa, 1-3 ml según protocolo, 1-3 sesiones' },

  // ─── Tópicos ortopédicos ───────────────────────────────────────────────
  { nombre_comercial: 'Voltaren Emulgel', principio_activo: 'Diclofenaco dietilamonio', presentacion: 'Gel 1% 100 g', dosis_sugerida: 'Aplicar 2-4 g en zona afectada cada 8-12 hrs, máx 3 semanas' },
  { nombre_comercial: 'Voltaren Emulgel Forte', principio_activo: 'Diclofenaco dietilamonio', presentacion: 'Gel 2% 100 g', dosis_sugerida: 'Aplicar 2-4 g en zona afectada cada 12 hrs' },
  { nombre_comercial: 'Flector Parche', principio_activo: 'Diclofenaco epolamina', presentacion: 'Parche 140 mg', dosis_sugerida: '1 parche en zona afectada cada 12 hrs, máx 3 semanas' },
  { nombre_comercial: 'Diclofenaco Parche', principio_activo: 'Diclofenaco sódico', presentacion: 'Parche 140 mg', dosis_sugerida: '1 parche en zona afectada cada 12 hrs' },
  { nombre_comercial: 'Ketoprofeno Gel', principio_activo: 'Ketoprofeno', presentacion: 'Gel 2.5% 60 g', dosis_sugerida: 'Aplicar 2-3 g en zona afectada cada 8-12 hrs' },
  { nombre_comercial: 'Ibuprofeno Gel', principio_activo: 'Ibuprofeno', presentacion: 'Gel 5% 60 g', dosis_sugerida: 'Aplicar 4-10 cm de gel en zona afectada cada 8 hrs' },
  { nombre_comercial: 'Piroxicam Gel', principio_activo: 'Piroxicam', presentacion: 'Gel 0.5% 60 g', dosis_sugerida: 'Aplicar 1-2 g en zona afectada cada 8-12 hrs' },
  { nombre_comercial: 'Nimesulida Gel', principio_activo: 'Nimesulida', presentacion: 'Gel 3% 30 g', dosis_sugerida: 'Aplicar 3 cm de gel en zona afectada cada 12 hrs' },
  { nombre_comercial: 'Traumeel Gel', principio_activo: 'Complejo homeopático antiinflamatorio', presentacion: 'Gel 50 g', dosis_sugerida: 'Aplicar en zona afectada 2-3 veces al día' },
  { nombre_comercial: 'Capsicina Crema', principio_activo: 'Capsaicina', presentacion: 'Crema 0.025%', dosis_sugerida: 'Aplicar 3-4 veces al día en zona afectada (puede arder al inicio)' },

  // ══════════════════════════════════════════════════════════════════════
  // GASTROPROTECTORES (uso habitual con AINEs/corticosteroides)
  // ══════════════════════════════════════════════════════════════════════
  { nombre_comercial: 'Omeprazol', principio_activo: 'Omeprazol', presentacion: 'Cápsulas 20 mg', dosis_sugerida: '1 cápsula cada 24 hrs en ayunas, 30 min antes del desayuno' },
  { nombre_comercial: 'Omeprazol', principio_activo: 'Omeprazol', presentacion: 'Cápsulas 40 mg', dosis_sugerida: '1 cápsula cada 24 hrs en ayunas' },
  { nombre_comercial: 'Prilosec', principio_activo: 'Omeprazol', presentacion: 'Cápsulas 20 mg', dosis_sugerida: '1 cápsula cada 24 hrs en ayunas' },
  { nombre_comercial: 'Pantoprazol', principio_activo: 'Pantoprazol', presentacion: 'Tabletas 40 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas' },
  { nombre_comercial: 'Protonix', principio_activo: 'Pantoprazol', presentacion: 'Tabletas 40 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas' },
  { nombre_comercial: 'Nexium', principio_activo: 'Esomeprazol', presentacion: 'Cápsulas 40 mg', dosis_sugerida: '1 cápsula cada 24 hrs en ayunas' },
  { nombre_comercial: 'Esomeprazol', principio_activo: 'Esomeprazol', presentacion: 'Cápsulas 20 mg', dosis_sugerida: '1 cápsula cada 24 hrs en ayunas' },
  { nombre_comercial: 'Prevacid', principio_activo: 'Lansoprazol', presentacion: 'Cápsulas 30 mg', dosis_sugerida: '1 cápsula cada 24 hrs en ayunas' },
  { nombre_comercial: 'Rabeprazol', principio_activo: 'Rabeprazol', presentacion: 'Tabletas 20 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas' },
  { nombre_comercial: 'Ulsen', principio_activo: 'Sucralfato', presentacion: 'Tabletas 1 g', dosis_sugerida: '1 tableta cada 8 hrs en ayunas, 1 hr antes de alimentos' },
  { nombre_comercial: 'Misoprostol', principio_activo: 'Misoprostol', presentacion: 'Tabletas 200 mcg', dosis_sugerida: '1 tableta cada 6-8 hrs con alimentos (protección gástrica con AINEs)' },
  { nombre_comercial: 'Cytotec', principio_activo: 'Misoprostol', presentacion: 'Tabletas 200 mcg', dosis_sugerida: '1 tableta cada 6-8 hrs con alimentos' },

  // ══════════════════════════════════════════════════════════════════════
  // ANTIBIÓTICOS — AMPLIO ESPECTRO
  // ══════════════════════════════════════════════════════════════════════

  // ─── Penicilinas ───────────────────────────────────────────────────────
  { nombre_comercial: 'Amoxil', principio_activo: 'Amoxicilina', presentacion: 'Cápsulas 500 mg', dosis_sugerida: '1 cápsula cada 8 hrs por 7-10 días' },
  { nombre_comercial: 'Amoxicilina', principio_activo: 'Amoxicilina', presentacion: 'Cápsulas 250 mg', dosis_sugerida: '1-2 cápsulas cada 8 hrs por 7-10 días' },
  { nombre_comercial: 'Amoxicilina', principio_activo: 'Amoxicilina', presentacion: 'Tabletas 1 g', dosis_sugerida: '1 tableta cada 12 hrs por 7-10 días' },
  { nombre_comercial: 'Augmentin', principio_activo: 'Amoxicilina / Ácido clavulánico', presentacion: 'Tabletas 875/125 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos por 7-10 días' },
  { nombre_comercial: 'Amoclave', principio_activo: 'Amoxicilina / Ácido clavulánico', presentacion: 'Tabletas 500/125 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 7-10 días' },
  { nombre_comercial: 'Clavulin', principio_activo: 'Amoxicilina / Ácido clavulánico', presentacion: 'Tabletas 875/125 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos por 7-10 días' },
  { nombre_comercial: 'Ampicilina', principio_activo: 'Ampicilina', presentacion: 'Cápsulas 500 mg', dosis_sugerida: '1 cápsula cada 6 hrs en ayunas por 7-10 días' },
  { nombre_comercial: 'Dicloxacilina', principio_activo: 'Dicloxacilina', presentacion: 'Cápsulas 500 mg', dosis_sugerida: '1 cápsula cada 6 hrs en ayunas por 7-10 días (infecciones estafilocócicas)' },
  { nombre_comercial: 'Dicloxacilina', principio_activo: 'Dicloxacilina', presentacion: 'Cápsulas 250 mg', dosis_sugerida: '1-2 cápsulas cada 6 hrs en ayunas' },
  { nombre_comercial: 'Unasyn oral', principio_activo: 'Ampicilina / Sulbactam', presentacion: 'Tabletas 375 mg', dosis_sugerida: '1 tableta cada 8 hrs con alimentos por 7-10 días' },
  { nombre_comercial: 'Piperacilina/Tazobactam', principio_activo: 'Piperacilina / Tazobactam', presentacion: 'Polvo inyectable 4.5 g', dosis_sugerida: '4.5 g IV cada 6-8 hrs (uso hospitalario)' },
  { nombre_comercial: 'Tazocin', principio_activo: 'Piperacilina / Tazobactam', presentacion: 'Polvo inyectable 2.25 g', dosis_sugerida: '2.25-4.5 g IV cada 6-8 hrs (uso hospitalario)' },

  // ─── Cefalosporinas ────────────────────────────────────────────────────
  { nombre_comercial: 'Keflex', principio_activo: 'Cefalexina', presentacion: 'Cápsulas 500 mg', dosis_sugerida: '1-2 cápsulas cada 6 hrs por 7-10 días' },
  { nombre_comercial: 'Cefalexina', principio_activo: 'Cefalexina', presentacion: 'Cápsulas 250 mg', dosis_sugerida: '1-2 cápsulas cada 6 hrs' },
  { nombre_comercial: 'Duracef', principio_activo: 'Cefadroxilo', presentacion: 'Cápsulas 500 mg', dosis_sugerida: '1 cápsula cada 12 hrs por 7-10 días' },
  { nombre_comercial: 'Cefadroxil', principio_activo: 'Cefadroxilo', presentacion: 'Cápsulas 1 g', dosis_sugerida: '1 cápsula cada 24 hrs por 7-10 días' },
  { nombre_comercial: 'Cefalotina', principio_activo: 'Cefalotina', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1-2 g IV/IM cada 6 hrs (profilaxis quirúrgica / tratamiento)' },
  { nombre_comercial: 'Zinnat', principio_activo: 'Cefuroxima', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos por 7-10 días' },
  { nombre_comercial: 'Cefuroxima', principio_activo: 'Cefuroxima', presentacion: 'Polvo inyectable 750 mg', dosis_sugerida: '750 mg IM/IV cada 8 hrs' },
  { nombre_comercial: 'Cefaclor', principio_activo: 'Cefaclor', presentacion: 'Cápsulas 500 mg', dosis_sugerida: '1 cápsula cada 8 hrs por 7-10 días' },
  { nombre_comercial: 'Suprax', principio_activo: 'Cefixima', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1 tableta cada 24 hrs por 7-14 días' },
  { nombre_comercial: 'Cefixima', principio_activo: 'Cefixima', presentacion: 'Tabletas 200 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-14 días' },
  { nombre_comercial: 'Omnicef', principio_activo: 'Cefdinir', presentacion: 'Cápsulas 300 mg', dosis_sugerida: '1 cápsula cada 12 hrs por 7-10 días' },
  { nombre_comercial: 'Rocephin', principio_activo: 'Ceftriaxona', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1-2 g IV/IM cada 24 hrs (uso hospitalario/ambulatorio)' },
  { nombre_comercial: 'Ceftriaxona', principio_activo: 'Ceftriaxona', presentacion: 'Polvo inyectable 500 mg', dosis_sugerida: '500 mg-1 g IM cada 24 hrs' },
  { nombre_comercial: 'Cefotaxima', principio_activo: 'Cefotaxima', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1-2 g IV cada 8-12 hrs (uso hospitalario)' },
  { nombre_comercial: 'Ceftazidima', principio_activo: 'Ceftazidima', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1-2 g IV cada 8-12 hrs (Pseudomonas)' },
  { nombre_comercial: 'Cefepima', principio_activo: 'Cefepima', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1-2 g IV cada 8-12 hrs (4ª generación)' },
  { nombre_comercial: 'Ceftarolina', principio_activo: 'Ceftarolina fosamil', presentacion: 'Polvo inyectable 600 mg', dosis_sugerida: '600 mg IV cada 12 hrs (SARM)' },

  // ─── Carbapenems ───────────────────────────────────────────────────────
  { nombre_comercial: 'Primaxin', principio_activo: 'Imipenem / Cilastatina', presentacion: 'Polvo inyectable 500 mg', dosis_sugerida: '500 mg IV cada 6-8 hrs (uso hospitalario)' },
  { nombre_comercial: 'Imipenem', principio_activo: 'Imipenem / Cilastatina', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '500 mg-1 g IV cada 6-8 hrs' },
  { nombre_comercial: 'Merrem', principio_activo: 'Meropenem', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1-2 g IV cada 8 hrs (uso hospitalario)' },
  { nombre_comercial: 'Meropenem', principio_activo: 'Meropenem', presentacion: 'Polvo inyectable 500 mg', dosis_sugerida: '500 mg-1 g IV cada 8 hrs' },
  { nombre_comercial: 'Invanz', principio_activo: 'Ertapenem', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1 g IV/IM cada 24 hrs (uso ambulatorio/hospitalario)' },
  { nombre_comercial: 'Ertapenem', principio_activo: 'Ertapenem', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1 g IV/IM cada 24 hrs' },

  // ─── Macrólidos ────────────────────────────────────────────────────────
  { nombre_comercial: 'Zithromax', principio_activo: 'Azitromicina', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 24 hrs por 3-5 días' },
  { nombre_comercial: 'Azitromicina', principio_activo: 'Azitromicina', presentacion: 'Tabletas 250 mg', dosis_sugerida: '2 tabletas el día 1, luego 1 tableta cada 24 hrs por 4 días' },
  { nombre_comercial: 'Klaricid', principio_activo: 'Claritromicina', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-14 días' },
  { nombre_comercial: 'Claritromicina', principio_activo: 'Claritromicina', presentacion: 'Tabletas 250 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-14 días' },
  { nombre_comercial: 'Klaricid XL', principio_activo: 'Claritromicina', presentacion: 'Tabletas 500 mg liberación prolongada', dosis_sugerida: '1-2 tabletas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Eritromicina', principio_activo: 'Eritromicina etilsuccinato', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 6-8 hrs con alimentos por 7-10 días' },

  // ─── Quinolonas / Fluoroquinolonas ─────────────────────────────────────
  { nombre_comercial: 'Ciprobay', principio_activo: 'Ciprofloxacino', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-14 días' },
  { nombre_comercial: 'Ciprofloxacino', principio_activo: 'Ciprofloxacino', presentacion: 'Tabletas 750 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-14 días (infecciones óseas)' },
  { nombre_comercial: 'Ciprofloxacino', principio_activo: 'Ciprofloxacino', presentacion: 'Solución inyectable 200 mg/100 ml', dosis_sugerida: '200-400 mg IV cada 12 hrs' },
  { nombre_comercial: 'Tavanic', principio_activo: 'Levofloxacino', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 24 hrs por 7-14 días' },
  { nombre_comercial: 'Levofloxacino', principio_activo: 'Levofloxacino', presentacion: 'Tabletas 750 mg', dosis_sugerida: '1 tableta cada 24 hrs por 5-7 días' },
  { nombre_comercial: 'Levofloxacino', principio_activo: 'Levofloxacino', presentacion: 'Solución inyectable 500 mg/100 ml', dosis_sugerida: '500-750 mg IV cada 24 hrs' },
  { nombre_comercial: 'Avelox', principio_activo: 'Moxifloxacino', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1 tableta cada 24 hrs por 5-10 días' },
  { nombre_comercial: 'Moxifloxacino', principio_activo: 'Moxifloxacino', presentacion: 'Solución inyectable 400 mg/250 ml', dosis_sugerida: '400 mg IV cada 24 hrs' },
  { nombre_comercial: 'Norfloxacino', principio_activo: 'Norfloxacino', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1 tableta cada 12 hrs en ayunas por 7-10 días' },
  { nombre_comercial: 'Ofloxacino', principio_activo: 'Ofloxacino', presentacion: 'Tabletas 400 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-14 días' },
  { nombre_comercial: 'Delafloxacino', principio_activo: 'Delafloxacino', presentacion: 'Tabletas 450 mg', dosis_sugerida: '1 tableta cada 12 hrs por 5-14 días (SARM-susceptible)' },

  // ─── Tetraciclinas ─────────────────────────────────────────────────────
  { nombre_comercial: 'Vibramycin', principio_activo: 'Doxiciclina', presentacion: 'Cápsulas 100 mg', dosis_sugerida: '1 cápsula cada 12 hrs con alimentos por 7-14 días' },
  { nombre_comercial: 'Doxiciclina', principio_activo: 'Doxiciclina', presentacion: 'Tabletas 100 mg', dosis_sugerida: '1 tableta cada 12 hrs con alimentos por 7-14 días' },
  { nombre_comercial: 'Minociclina', principio_activo: 'Minociclina', presentacion: 'Cápsulas 100 mg', dosis_sugerida: '1 cápsula cada 12 hrs con alimentos' },
  { nombre_comercial: 'Minocin', principio_activo: 'Minociclina', presentacion: 'Cápsulas 50 mg', dosis_sugerida: '1-2 cápsulas cada 12 hrs con alimentos' },

  // ─── Aminoglucósidos ───────────────────────────────────────────────────
  { nombre_comercial: 'Gentamicina', principio_activo: 'Gentamicina', presentacion: 'Solución inyectable 80 mg/2 ml', dosis_sugerida: '3-5 mg/kg/día IM/IV en 1-3 dosis (monitorizar función renal)' },
  { nombre_comercial: 'Amikacina', principio_activo: 'Amikacina', presentacion: 'Solución inyectable 500 mg/2 ml', dosis_sugerida: '15-20 mg/kg/día IM/IV (monitorizar niveles)' },
  { nombre_comercial: 'Tobramicina', principio_activo: 'Tobramicina', presentacion: 'Solución inyectable 80 mg/2 ml', dosis_sugerida: '3-5 mg/kg/día IM/IV en 1-3 dosis' },

  // ─── Lincosamidas ──────────────────────────────────────────────────────
  { nombre_comercial: 'Dalacin C', principio_activo: 'Clindamicina', presentacion: 'Cápsulas 300 mg', dosis_sugerida: '1 cápsula cada 8 hrs por 7-10 días' },
  { nombre_comercial: 'Clindamicina', principio_activo: 'Clindamicina', presentacion: 'Cápsulas 150 mg', dosis_sugerida: '1-2 cápsulas cada 6-8 hrs' },
  { nombre_comercial: 'Dalacin C', principio_activo: 'Clindamicina', presentacion: 'Solución inyectable 300 mg/2 ml', dosis_sugerida: '600-900 mg IV cada 8 hrs (infecciones óseas/articulares graves)' },
  { nombre_comercial: 'Clindamicina', principio_activo: 'Clindamicina', presentacion: 'Solución inyectable 600 mg/4 ml', dosis_sugerida: '600-900 mg IV cada 8 hrs' },

  // ─── Nitroimidazoles ───────────────────────────────────────────────────
  { nombre_comercial: 'Flagyl', principio_activo: 'Metronidazol', presentacion: 'Tabletas 500 mg', dosis_sugerida: '1 tableta cada 8 hrs por 7-10 días (infecciones anaerobias)' },
  { nombre_comercial: 'Metronidazol', principio_activo: 'Metronidazol', presentacion: 'Solución inyectable 500 mg/100 ml', dosis_sugerida: '500 mg IV cada 8 hrs (uso hospitalario)' },
  { nombre_comercial: 'Tinidazol', principio_activo: 'Tinidazol', presentacion: 'Tabletas 500 mg', dosis_sugerida: '2 g dosis única o 1 g cada 12 hrs por 5 días' },

  // ─── Glicopéptidos ─────────────────────────────────────────────────────
  { nombre_comercial: 'Vancocin', principio_activo: 'Vancomicina', presentacion: 'Polvo inyectable 500 mg', dosis_sugerida: '15-20 mg/kg IV cada 8-12 hrs (SARM, uso hospitalario)' },
  { nombre_comercial: 'Vancomicina', principio_activo: 'Vancomicina', presentacion: 'Polvo inyectable 1 g', dosis_sugerida: '1 g IV cada 12 hrs (ajustar según niveles)' },
  { nombre_comercial: 'Teicoplanina', principio_activo: 'Teicoplanina', presentacion: 'Polvo inyectable 400 mg', dosis_sugerida: 'Carga: 400 mg IV/IM cada 12 hrs × 3; mantenimiento: 400 mg/día' },

  // ─── Sulfonamidas ──────────────────────────────────────────────────────
  { nombre_comercial: 'Bactrim', principio_activo: 'Trimetoprim / Sulfametoxazol', presentacion: 'Tabletas 160/800 mg', dosis_sugerida: '1 tableta cada 12 hrs por 7-10 días' },
  { nombre_comercial: 'Bactrim F', principio_activo: 'Trimetoprim / Sulfametoxazol', presentacion: 'Tabletas 160/800 mg', dosis_sugerida: '1 tableta cada 12 hrs' },

  // ─── Oxazolidinonas / Otros ────────────────────────────────────────────
  { nombre_comercial: 'Zyvox', principio_activo: 'Linezolid', presentacion: 'Tabletas 600 mg', dosis_sugerida: '1 tableta cada 12 hrs por 10-14 días (SARM)' },
  { nombre_comercial: 'Linezolid', principio_activo: 'Linezolid', presentacion: 'Solución inyectable 600 mg/300 ml', dosis_sugerida: '600 mg IV cada 12 hrs' },
  { nombre_comercial: 'Sivextro', principio_activo: 'Tedizolid', presentacion: 'Tabletas 200 mg', dosis_sugerida: '1 tableta cada 24 hrs por 6 días (infecciones de piel y tejidos blandos)' },
  { nombre_comercial: 'Cubicin', principio_activo: 'Daptomicina', presentacion: 'Polvo inyectable 500 mg', dosis_sugerida: '4-6 mg/kg IV cada 24 hrs (infecciones por SARM)' },
  { nombre_comercial: 'Rifampicina', principio_activo: 'Rifampicina', presentacion: 'Cápsulas 300 mg', dosis_sugerida: '600 mg/día en 2 dosis en ayunas (osteomielitis, combinada)' },
  { nombre_comercial: 'Fosfomicina', principio_activo: 'Fosfomicina trometamol', presentacion: 'Sobres 3 g', dosis_sugerida: '1 sobre disuelto en agua dosis única (IVU no complicada)' },
  { nombre_comercial: 'Monurol', principio_activo: 'Fosfomicina trometamol', presentacion: 'Sobres 3 g', dosis_sugerida: '1 sobre disuelto en agua dosis única' },
  { nombre_comercial: 'Tigeciclina', principio_activo: 'Tigeciclina', presentacion: 'Polvo inyectable 50 mg', dosis_sugerida: '100 mg IV dosis inicial, luego 50 mg cada 12 hrs' },
  { nombre_comercial: 'Colistina', principio_activo: 'Colistimetato sódico', presentacion: 'Polvo inyectable 150 mg', dosis_sugerida: 'Según peso y función renal (gramnegativos multirresistentes)' },

  // ══════════════════════════════════════════════════════════════════════
  // ANTIOSTEOPOROSIS / METABOLISMO ÓSEO
  // ══════════════════════════════════════════════════════════════════════

  // ─── Bisfosfonatos ─────────────────────────────────────────────────────
  { nombre_comercial: 'Fosamax', principio_activo: 'Alendronato sódico', presentacion: 'Tabletas 70 mg', dosis_sugerida: '1 tableta semanal en ayunas con 240 ml agua, mantenerse de pie 30 min' },
  { nombre_comercial: 'Alendronato', principio_activo: 'Alendronato sódico', presentacion: 'Tabletas 10 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas con agua, de pie 30 min' },
  { nombre_comercial: 'Actonel', principio_activo: 'Risedronato sódico', presentacion: 'Tabletas 35 mg', dosis_sugerida: '1 tableta semanal en ayunas con 240 ml agua, de pie 30 min' },
  { nombre_comercial: 'Actonel', principio_activo: 'Risedronato sódico', presentacion: 'Tabletas 5 mg', dosis_sugerida: '1 tableta cada 24 hrs en ayunas con agua, de pie 30 min' },
  { nombre_comercial: 'Risedronato', principio_activo: 'Risedronato sódico', presentacion: 'Tabletas 150 mg', dosis_sugerida: '1 tableta mensual en ayunas con agua, mantenerse de pie 30 min' },
  { nombre_comercial: 'Bonviva', principio_activo: 'Ibandronato sódico', presentacion: 'Tabletas 150 mg', dosis_sugerida: '1 tableta mensual en ayunas con agua, de pie 60 min' },
  { nombre_comercial: 'Ibandronato', principio_activo: 'Ibandronato sódico', presentacion: 'Tabletas 150 mg', dosis_sugerida: '1 tableta mensual en ayunas con agua' },
  { nombre_comercial: 'Bonviva IV', principio_activo: 'Ibandronato sódico', presentacion: 'Solución inyectable 3 mg/3 ml', dosis_sugerida: '3 mg IV cada 3 meses (infusión >15 seg)' },
  { nombre_comercial: 'Reclast', principio_activo: 'Ácido zoledrónico', presentacion: 'Solución IV 5 mg/100 ml', dosis_sugerida: '5 mg IV anual (infusión >15 min)' },
  { nombre_comercial: 'Zometa', principio_activo: 'Ácido zoledrónico', presentacion: 'Solución IV 4 mg/100 ml', dosis_sugerida: '4 mg IV cada 3-4 semanas (metástasis ósea) o 4 mg anual' },
  { nombre_comercial: 'Ácido zoledrónico', principio_activo: 'Ácido zoledrónico', presentacion: 'Solución IV 5 mg/100 ml', dosis_sugerida: '5 mg IV una vez al año (osteoporosis)' },

  // ─── Anticuerpos monoclonales / Biológicos ─────────────────────────────
  { nombre_comercial: 'Prolia', principio_activo: 'Denosumab', presentacion: 'Jeringa precargada 60 mg/1 ml', dosis_sugerida: '60 mg SC cada 6 meses (asociar calcio + vitamina D)' },
  { nombre_comercial: 'Xgeva', principio_activo: 'Denosumab', presentacion: 'Vial 120 mg/1.7 ml', dosis_sugerida: '120 mg SC cada 4 semanas (metástasis ósea)' },
  { nombre_comercial: 'Evenity', principio_activo: 'Romosozumab', presentacion: 'Jeringa precargada 105 mg/1.17 ml', dosis_sugerida: '2 inyecciones SC (210 mg) una vez al mes por 12 meses' },

  // ─── Anabólicos óseos ──────────────────────────────────────────────────
  { nombre_comercial: 'Forteo', principio_activo: 'Teriparatida', presentacion: 'Pluma inyectable 250 mcg/ml (2.4 ml)', dosis_sugerida: '20 mcg SC cada 24 hrs (máx 2 años de tratamiento)' },
  { nombre_comercial: 'Tymlos', principio_activo: 'Abaloparatida', presentacion: 'Pluma inyectable 3120 mcg/1.56 ml', dosis_sugerida: '80 mcg SC cada 24 hrs (máx 18 meses)' },

  // ─── Moduladores selectivos de estrógeno (SERM) ────────────────────────
  { nombre_comercial: 'Evista', principio_activo: 'Raloxifeno', presentacion: 'Tabletas 60 mg', dosis_sugerida: '1 tableta cada 24 hrs con o sin alimentos' },
  { nombre_comercial: 'Raloxifeno', principio_activo: 'Raloxifeno', presentacion: 'Tabletas 60 mg', dosis_sugerida: '1 tableta cada 24 hrs' },

  // ─── Calcitonina ───────────────────────────────────────────────────────
  { nombre_comercial: 'Miacalcic', principio_activo: 'Calcitonina de salmón', presentacion: 'Spray nasal 200 UI/dosis', dosis_sugerida: '1 puff nasal alternando fosas nasales cada 24 hrs' },
  { nombre_comercial: 'Calcitonina', principio_activo: 'Calcitonina de salmón', presentacion: 'Solución inyectable 100 UI/1 ml', dosis_sugerida: '100 UI SC/IM cada 24 hrs (fractura aguda, dolor)' },

  // ─── Calcio + Vitamina D ───────────────────────────────────────────────
  { nombre_comercial: 'Caltrate', principio_activo: 'Calcio carbonato + Vitamina D3', presentacion: 'Tabletas 600 mg / 400 UI', dosis_sugerida: '1 tableta cada 12 hrs con alimentos' },
  { nombre_comercial: 'Os-Cal', principio_activo: 'Calcio carbonato + Vitamina D3', presentacion: 'Tabletas 500 mg / 200 UI', dosis_sugerida: '1 tableta cada 12 hrs con alimentos' },
  { nombre_comercial: 'Calcium Sandoz', principio_activo: 'Calcio gluconolactato + carbonato', presentacion: 'Tabletas efervescentes 500 mg Ca', dosis_sugerida: '1-2 tabletas disueltas en agua cada 24 hrs' },
  { nombre_comercial: 'Vitamina D3', principio_activo: 'Colecalciferol', presentacion: 'Cápsulas 5000 UI', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos (déficit / osteoporosis)' },
  { nombre_comercial: 'Vitamina D3', principio_activo: 'Colecalciferol', presentacion: 'Cápsulas 2000 UI', dosis_sugerida: '1-2 cápsulas cada 24 hrs con alimentos (mantenimiento)' },
  { nombre_comercial: 'Vitamina D3', principio_activo: 'Colecalciferol', presentacion: 'Gotas 400 UI/gota', dosis_sugerida: '10-20 gotas cada 24 hrs con alimentos' },
  { nombre_comercial: 'Calcifediol', principio_activo: 'Calcifediol (25-OH vitamina D)', presentacion: 'Cápsulas blandas 266 mcg', dosis_sugerida: '1 cápsula quincenal o mensual (ajustar según niveles séricos)' },
  { nombre_comercial: 'Hidroferol', principio_activo: 'Calcifediol', presentacion: 'Ampollas bebibles 0.266 mg', dosis_sugerida: '1 ampolla mensual o quincenal (según 25-OH vitamina D)' },
  { nombre_comercial: 'Calcitriol', principio_activo: 'Calcitriol (1,25-dihidroxivitamina D3)', presentacion: 'Cápsulas 0.25 mcg', dosis_sugerida: '1 cápsula cada 24 hrs (insuficiencia renal / hipoparatiroidismo)' },
  { nombre_comercial: 'Rocaltrol', principio_activo: 'Calcitriol', presentacion: 'Cápsulas 0.5 mcg', dosis_sugerida: '1 cápsula cada 24 hrs' },
  { nombre_comercial: 'Vitamina D3 + K2', principio_activo: 'Colecalciferol / Menaquinona-7', presentacion: 'Cápsulas 5000 UI / 100 mcg', dosis_sugerida: '1 cápsula cada 24 hrs con alimentos' },
  { nombre_comercial: 'Ranelato de estroncio', principio_activo: 'Ranelato de estroncio', presentacion: 'Sobres 2 g', dosis_sugerida: '1 sobre disuelto en agua cada noche al acostarse (en ayunas)' },
]