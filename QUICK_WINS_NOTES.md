# Quick Wins — Notas de implementación

## QW1 — Diagnósticos múltiples por consulta (✅ Cerrado 2026-04-23)

Implementado y pusheado. Ver commit de feat(consultas): soporte para
múltiples diagnósticos.

## QW2 — Fecha de nacimiento opcional (✅ Cerrado 2026-04-23)

Implementado y pusheado. Cambios:

1. Tipo canónico Paciente.fecha_nacimiento: string → string | null
2. Formularios: removido required + asterisco en 4 entry points
   (nuevo, editar, QuickPatientModal, ConsultaRapidaModal)
3. Microcopy informativo agregado en los 3 modales de creación
4. Guard añadido en /expediente/[id]/estado y DashboardHero
5. Tipos alineados en offline/types.ts y calculadoras/types.ts
6. ALTER TABLE pacientes ALTER COLUMN fecha_nacimiento DROP NOT NULL
   ejecutado manualmente en Supabase (Angel, 2026-04-23)

### Deuda documentada

- Fase B (PDFs): RecetaPdf y ConsentimientoInformadoPdf siguen mostrando
  "—" en celda EDAD cuando fecha_nacimiento es null. Cumple tolerablemente
  la Decisión A pero requiere refactor de layout de celdas para ocultar
  completamente. Diferido por scope atómico.
- agenda/page.tsx mantiene workaround de fecha calculada desde edad.
  Migrar si betatesters reportan confusión.
- ConsentimientoInformadoForm.tsx mantiene campo "edad" como input
  independiente required. Bug distinto de QW2 — discusión UX aparte.
- Calculadoras clínicas (CKD-EPI, Cockcroft-Gault, MDRD, Gradiente A-a,
  Parkland) dependen de edad. Con fecha_nacimiento null reciben undefined.
  Cada calculadora maneja diferente. Validar caso por caso cuando un
  paciente real sin fecha requiera estas calculadoras.
