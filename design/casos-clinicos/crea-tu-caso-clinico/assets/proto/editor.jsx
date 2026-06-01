/* Pantalla: Crear / Editar caso clínico */
(function () {
  const { useState } = React;
  const I = window.Icons;

  function Slot({ kind, label, onAdd }) {
    const map = { foto: "Camera", video: "Video", rx: "Scan" };
    const Ico = I[map[kind]];
    return (
      <button className={"media-slot slot-" + kind} onClick={onAdd}>
        <span className="slot-ico"><Ico size={24} /></span>
        <span className="slot-label">{label}</span>
      </button>
    );
  }

  function MediaThumb({ m, onAnnotate, onRemove }) {
    return (
      <div className="media-thumb" style={{ background: m.cover }}>
        <div className="case-cover-grid" />
        {m.kind === "rx" && <span className="thumb-kind"><I.Scan size={12} /> Rx</span>}
        {m.kind === "video" && <span className="thumb-kind"><I.Video size={12} /> Video</span>}
        {m.kind === "foto" && <span className="thumb-kind"><I.Camera size={12} /> Foto</span>}
        {m.anno > 0 && <span className="thumb-anno"><I.Edit size={11} /> {m.anno}</span>}
        {!m.consentClean && m.kind === "foto" && <span className="thumb-warn"><I.Alert size={11} /></span>}
        <div className="thumb-actions">
          <button className="thumb-btn" onClick={() => onAnnotate(m)}><I.Edit size={15} /> Anotar</button>
          <button className="thumb-btn icon" onClick={() => onRemove(m)}><I.Trash size={15} /></button>
        </div>
      </div>
    );
  }

  function Field({ label, children, hint }) {
    return (
      <div className="field">
        <label className="field-label">{label}</label>
        {children}
        {hint && <div className="field-hint">{hint}</div>}
      </div>
    );
  }

  function CaseEditor({ onBack, onAnnotate, onExport }) {
    const d = window.SpinusData;
    const [tone, setTone] = useState("serio");
    const [linked, setLinked] = useState(true);
    const [title, setTitle] = useState("Escoliosis idiopática — corrección con instrumentación");
    const [media, setMedia] = useState([
      { id: "m1", kind: "rx", cover: "linear-gradient(150deg,#1f3a52,#0c1722)", anno: 2, consentClean: true },
      { id: "m2", kind: "rx", cover: "linear-gradient(150deg,#243a4d,#101c26)", anno: 0, consentClean: true },
      { id: "m3", kind: "foto", cover: "linear-gradient(150deg,#3a3030,#1a1412)", anno: 0, consentClean: false },
      { id: "m4", kind: "video", cover: "linear-gradient(150deg,#22323f,#0e1820)", anno: 0, consentClean: true },
    ]);
    const addMedia = (kind) => setMedia((m) => [...m, { id: "m" + Date.now(), kind, cover: "linear-gradient(150deg,#26384a,#0f1a24)", anno: 0, consentClean: kind !== "foto" }]);
    const removeMedia = (mm) => setMedia((m) => m.filter((x) => x.id !== mm.id));

    const hasUnconsented = media.some((m) => m.kind === "foto" && !m.consentClean);

    return (
      <div className="editor">
        <div className="editor-top">
          <button className="back-link" onClick={onBack}><I.ChevronLeft size={18} /> Casos</button>
          <div className="editor-top-actions">
            <span className="autosave"><I.Check size={14} /> Guardado · {new Date().toLocaleTimeString("es-MX",{hour:"2-digit",minute:"2-digit"})}</span>
            <button className="btn btn-quiet"><I.Eye size={16} /> Previsualizar</button>
            <button className="btn btn-primary" onClick={onExport}><I.Share size={16} /> Exportar</button>
          </div>
        </div>

        <div className="editor-grid">
          {/* ---- columna principal ---- */}
          <div className="editor-main">
            <input className="editor-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título del caso clínico…" />

            <div className="block">
              <div className="block-head">
                <h3><I.Image size={18} /> Material gráfico</h3>
                <span className="block-hint">Arrastra para reordenar · toca <b>Anotar</b> para resaltar hallazgos</span>
              </div>
              <div className="media-grid">
                {media.map((m) => <MediaThumb key={m.id} m={m} onAnnotate={onAnnotate} onRemove={removeMedia} />)}
              </div>
              <div className="slots-row">
                <Slot kind="foto" label="Foto clínica" onAdd={() => addMedia("foto")} />
                <Slot kind="rx" label="Radiografía / DICOM" onAdd={() => addMedia("rx")} />
                <Slot kind="video" label="Video corto" onAdd={() => addMedia("video")} />
              </div>
            </div>

            <div className="block">
              <div className="block-head"><h3><I.Layers size={18} /> Comparativo antes / después</h3></div>
              <div className="ba-row">
                <div className="ba-card">
                  <div className="ba-img" style={{ background: "linear-gradient(150deg,#1f3a52,#0c1722)" }}><div className="case-cover-grid" /><span className="ba-tag">Pre-op</span></div>
                </div>
                <div className="ba-arrow"><I.ChevronRight size={22} /></div>
                <div className="ba-card">
                  <div className="ba-img" style={{ background: "linear-gradient(150deg,#1b3340,#0a141c)" }}><div className="case-cover-grid" /><span className="ba-tag ba-tag-post">Post-op</span></div>
                </div>
              </div>
            </div>

            <div className="block">
              <div className="block-head"><h3><I.FileText size={18} /> Texto del caso</h3></div>
              <Field label="Resumen clínico">
                <textarea className="editor-textarea" rows={4} defaultValue="Paciente con escoliosis idiopática del adolescente, ángulo de Cobb pre-quirúrgico de 58°. Se realiza artrodesis posterior instrumentada T4–L3 con corrección a 12°…" />
              </Field>
              <div className="tone-row">
                <span className="tone-q">Tono del relato</span>
                <div className="seg">
                  <button className={tone === "serio" ? "on" : ""} onClick={() => setTone("serio")}>Serio / educativo</button>
                  <button className={tone === "relajado" ? "on" : ""} onClick={() => setTone("relajado")}>Relajado / divulgativo</button>
                </div>
              </div>
              <div className="tone-preview">
                {tone === "serio"
                  ? <p><b>Académico.</b> «Corrección de deformidad escoliótica de 58° a 12° mediante artrodesis posterior instrumentada. Evolución radiográfica favorable a 12 meses.»</p>
                  : <p><b>Divulgativo.</b> «Así enderezamos una columna con escoliosis: de 58° a 12°. La paciente recuperó su estatura y volvió a hacer deporte 💪.»</p>}
              </div>
            </div>
          </div>

          {/* ---- rail derecho ---- */}
          <aside className="editor-rail">
            <div className="rail-card">
              <div className="rail-card-head"><I.Link size={16} /> Vínculo con expediente</div>
              <div className="switch-row">
                <span>Asociar a un paciente</span>
                <button className={"switch" + (linked ? " on" : "")} onClick={() => setLinked(!linked)}><span /></button>
              </div>
              {linked
                ? <div className="linked-patient">
                    <span className="case-mono" style={{ background: "var(--anno-blue)" }}>LP</span>
                    <div><b>Leydi M. Poot T.</b><span>Exp. #1043 · 34 a</span></div>
                    <button className="mini-link">Cambiar</button>
                  </div>
                : <div className="indep-note"><I.UserCircle size={15} /> Caso independiente — no se vincula a ningún expediente.</div>}
            </div>

            <div className="rail-card">
              <div className="rail-card-head"><I.Bookmark size={16} /> Clasificación</div>
              <Field label="Región anatómica">
                <div className="select"><span>Columna toracolumbar</span><I.ChevronDown size={16} /></div>
              </Field>
              <Field label="Tipo de caso">
                <div className="select"><span>Pre / Post-operatorio</span><I.ChevronDown size={16} /></div>
              </Field>
            </div>

            <div className={"rail-card consent-card" + (hasUnconsented ? " warn" : "")}>
              <div className="rail-card-head"><I.Shield size={16} /> Privacidad del paciente</div>
              {hasUnconsented
                ? <div className="consent-state warn">
                    <I.Alert size={18} />
                    <div><b>Recuerda anonimizar.</b><span>Difumina rostros, tatuajes y marcas identificables antes de exportar a redes.</span></div>
                  </div>
                : <div className="consent-state ok"><I.Check size={18} /><div><b>Material listo</b><span>Sin datos identificables visibles.</span></div></div>}
              <label className="consent-check">
                <input type="checkbox" /> <span>Cuento con <b>consentimiento informado</b> del paciente para uso del material (NOM-024 / LFPDPPP).</span>
              </label>
            </div>

            <button className="btn btn-primary btn-lg rail-export" onClick={onExport}><I.Share size={18} /> Vista previa y exportar</button>
          </aside>
        </div>
      </div>
    );
  }

  window.CaseEditor = CaseEditor;
})();
