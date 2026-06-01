/* Pantalla: Vista previa de exports + selector de formato/plantilla + privacidad */
(function () {
  const { useState } = React;
  const I = window.Icons;
  const D = window.SpinusData;

  /* ---------- Vista previa compuesta ---------- */
  function Preview({ format, template, accent, watermark, contact }) {
    const ratio = { pdf: "8.5/11", story: "9/16", carrusel: "4/5", feed: "1/1" }[format];
    const isDark = template === "marca";
    const isFun = template === "divulgativo";
    const bg = isDark ? "var(--navy-card-grad)"
      : isFun ? "linear-gradient(160deg,#eafaf6,#e7f1fd)"
      : "#ffffff";
    const ink = isDark ? "#fff" : "var(--ink)";
    const sub = isDark ? "rgba(255,255,255,.7)" : "var(--muted)";

    return (
      <div className={"prev prev-" + template} style={{ aspectRatio: ratio, background: bg, color: ink }}>
        {/* franja superior / marca */}
        <div className="prev-head">
          <div className="prev-logo" style={{ background: isDark ? "rgba(255,255,255,.12)" : accent }}>
            <I.Layers size={16} />
          </div>
          <div className="prev-head-txt">
            <b style={{ color: ink }}>Dr. {D.doctor.name.split(" ").slice(0,2).join(" ")}</b>
            <span style={{ color: sub }}>{isFun ? "Cirugía de columna" : "Cirugía de Columna · Ortopedia"}</span>
          </div>
          {template === "academico" && <span className="prev-badge" style={{ borderColor: accent, color: accent }}>CASO CLÍNICO</span>}
        </div>

        {/* título */}
        <div className="prev-title" style={{ color: ink }}>
          {isFun ? "Así enderezamos una columna con escoliosis 🦴" : "Escoliosis idiopática — corrección instrumentada"}
        </div>

        {/* comparativo de imágenes con anotación */}
        <div className={"prev-compare" + (format === "story" ? " stacked" : "")}>
          <figure className="prev-fig">
            <div className="prev-img" style={{ background: "linear-gradient(150deg,#1f3a52,#0c1722)" }}>
              <div className="case-cover-grid" />
              <svg viewBox="0 0 100 130" className="prev-anno" preserveAspectRatio="none">
                <line x1="28" y1="42" x2="64" y2="38" stroke={accent} strokeWidth="2" strokeDasharray="1.5 5" />
                <line x1="32" y1="86" x2="62" y2="92" stroke={accent} strokeWidth="2" strokeDasharray="1.5 5" />
              </svg>
              <span className="prev-deg" style={{ background: accent }}>58°</span>
            </div>
            <figcaption>Pre-op</figcaption>
          </figure>
          <div className="prev-arrow" style={{ color: accent }}><I.ChevronRight size={20} /></div>
          <figure className="prev-fig">
            <div className="prev-img" style={{ background: "linear-gradient(150deg,#1b3340,#0a141c)" }}>
              <div className="case-cover-grid" />
              <span className="prev-deg" style={{ background: "var(--green)" }}>12°</span>
            </div>
            <figcaption>Post-op</figcaption>
          </figure>
        </div>

        {/* texto / datos */}
        {template === "clinico" && (
          <div className="prev-chips">
            <span style={{ background: "var(--accent-soft)", color: "var(--accent-strong)" }}>Cobb 58° → 12°</span>
            <span style={{ background: "var(--green-soft)", color: "var(--green-ink)" }}>Artrodesis T4–L3</span>
            <span style={{ background: "var(--bg-sunken)", color: "var(--muted)" }}>12 meses</span>
          </div>
        )}
        {(template === "academico" || template === "marca" || template === "divulgativo") && (
          <p className="prev-caption" style={{ color: sub }}>
            {isFun
              ? "Pasó de 58° a 12°. Recuperó estatura y volvió al deporte. ¡La cirugía de columna cambia vidas! 💪"
              : "Corrección de deformidad de 58° a 12° mediante artrodesis posterior instrumentada. Evolución favorable a 12 meses."}
          </p>
        )}

        <div className="prev-foot-spacer" />

        {/* pie: marca de agua + contacto + legal */}
        <div className="prev-foot">
          {watermark && (
            <div className="prev-wm" style={{ color: sub }}>
              <span className="prev-wm-dot" style={{ background: accent }} />
              {contact ? <span>{D.doctor.handle} · {D.doctor.phone}</span> : <span>Dr. {D.doctor.name.split(" ")[1]} · {D.doctor.city}</span>}
            </div>
          )}
          <div className="prev-legal" style={{ color: isDark ? "rgba(255,255,255,.4)" : "var(--muted-2)" }}>
            Material con fines educativos · Publicado con consentimiento del paciente · No constituye consejo médico.
          </div>
        </div>

        {format === "carrusel" && <div className="prev-dots"><span className="on"/><span/><span/><span/></div>}
      </div>
    );
  }

  /* ---------- Modal de privacidad (verificación manual, sin IA) ---------- */
  function PrivacyGate({ onClose, onFix, onConfirm }) {
    const [consent, setConsent] = useState(false);
    const [anon, setAnon] = useState(false);
    const ready = consent && anon;
    return (
      <div className="modal-scrim" onClick={onClose}>
        <div className="modal priv-modal" onClick={(e) => e.stopPropagation()}>
          <div className="priv-icon"><I.Shield size={26} /></div>
          <h2>Antes de publicar en redes</h2>
          <p className="priv-lead">Spinus protege a tus pacientes según la <b>NOM-024-SSA3</b> y la <b>LFPDPPP</b>. Confirma estos dos puntos:</p>

          <label className="priv-check">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Cuento con el <b>consentimiento informado</b> del paciente para publicar este material con fines educativos/divulgativos.</span>
          </label>

          <label className="priv-check">
            <input type="checkbox" checked={anon} onChange={(e) => setAnon(e.target.checked)} />
            <span>Verifiqué que la imagen <b>no muestra rostros, tatuajes ni datos identificables</b> — o los difuminé.</span>
          </label>
          <button className="priv-fix" onClick={onFix}><I.Blur size={15} /> Abrir herramienta de difuminado</button>

          <div className="priv-legal-note">
            <I.FileText size={15} />
            <span>Se añadirá automáticamente el aviso legal: <i>«Material educativo · Publicado con consentimiento · No constituye consejo médico.»</i></span>
          </div>

          <div className="modal-actions">
            <button className="btn btn-quiet" onClick={onClose}>Cancelar</button>
            <button className={"btn btn-primary" + (ready ? "" : " disabled")} disabled={!ready} onClick={onConfirm}>
              <I.Share size={16} /> Compartir
            </button>
          </div>
        </div>
      </div>
    );
  }

  function FormatCard({ f, on, onClick }) {
    const Ico = I[f.icon];
    return (
      <button className={"fmt-card" + (on ? " on" : "")} onClick={onClick}>
        <span className="fmt-ico"><Ico size={20} /></span>
        <span className="fmt-txt"><b>{f.name}</b><small>{f.sub}</small></span>
        <span className="fmt-ratio">{f.ratio}</span>
      </button>
    );
  }

  function ExportScreen({ onBack, onFix, hasFace = true }) {
    const [format, setFormat] = useState("story");
    const [template, setTemplate] = useState("clinico");
    const [accent, setAccent] = useState("#1a3a5c");
    const [watermark, setWatermark] = useState(true);
    const [contact, setContact] = useState(true);
    const [gate, setGate] = useState(false);
    const [shared, setShared] = useState(false);

    const accents = ["#1a3a5c", "#2f6fb0", "#0d9488", "#7c5cf0"];

    return (
      <div className="export">
        <div className="editor-top">
          <button className="back-link" onClick={onBack}><I.ChevronLeft size={18} /> Editor del caso</button>
          <div className="editor-top-actions">
            <button className="btn btn-quiet"><I.Download size={16} /> Descargar</button>
            <button className="btn btn-primary" onClick={() => setGate(true)}><I.Share size={16} /> Compartir a redes</button>
          </div>
        </div>

        <div className="export-grid">
          {/* panel izquierdo */}
          <div className="export-panel">
            <div className="exp-section">
              <div className="exp-label">Formato</div>
              <div className="fmt-list">
                {D.formats.map((f) => <FormatCard key={f.id} f={f} on={format === f.id} onClick={() => setFormat(f.id)} />)}
              </div>
            </div>

            <div className="exp-section">
              <div className="exp-label">Plantilla</div>
              <div className="tpl-list">
                {D.templates.map((t) => (
                  <button key={t.id} className={"tpl-card" + (template === t.id ? " on" : "")} onClick={() => setTemplate(t.id)}>
                    <span className="tpl-swatch" style={{ background: `var(${t.accentVar})` }} />
                    <span className="tpl-txt"><b>{t.name}</b><small>{t.sub}</small></span>
                    {template === t.id && <I.Check size={16} />}
                  </button>
                ))}
              </div>
              <p className="tpl-desc">{(D.templates.find((t) => t.id === template) || {}).desc}</p>
            </div>

            <div className="exp-section">
              <div className="exp-label">Tu toque <span className="exp-label-hint">— marca del médico</span></div>
              <div className="brand-row">
                <span>Color de acento</span>
                <div className="accent-swatches">
                  {accents.map((a) => <button key={a} className={"acc" + (accent === a ? " on" : "")} style={{ background: a }} onClick={() => setAccent(a)} />)}
                </div>
              </div>
              <div className="switch-row brand-switch">
                <span><I.Bookmark size={15} /> Marca de agua (logo + nombre)</span>
                <button className={"switch" + (watermark ? " on" : "")} onClick={() => setWatermark(!watermark)}><span /></button>
              </div>
              <div className="switch-row brand-switch">
                <span><I.Phone size={15} /> Mostrar contacto / redes</span>
                <button className={"switch" + (contact ? " on" : "")} onClick={() => setContact(!contact)}><span /></button>
              </div>
            </div>

            <div className="exp-privacy-note">
              <I.Lock size={15} />
              <span>Los exports a redes incluyen <b>aviso legal automático</b> y exigen confirmar el consentimiento del paciente.</span>
            </div>
          </div>

          {/* preview */}
          <div className="export-stage">
            <div className="stage-bar">
              <span className="pill pill-gray">{(D.formats.find((f) => f.id === format) || {}).name}</span>
              <span className="pill pill-gray">{(D.templates.find((t) => t.id === template) || {}).name}</span>
            </div>
            <div className="stage-canvas">
              <Preview format={format} template={template} accent={accent} watermark={watermark} contact={contact} />
            </div>
            {format === "carrusel" && <p className="stage-foot">4 láminas · desliza en Instagram</p>}
          </div>
        </div>

        {gate && <PrivacyGate onClose={() => setGate(false)} onFix={() => { setGate(false); onFix(); }} onConfirm={() => { setGate(false); setShared(true); }} />}
        {shared && (
          <div className="modal-scrim" onClick={() => setShared(false)}>
            <div className="modal share-done" onClick={(e) => e.stopPropagation()}>
              <div className="share-check"><I.Check size={30} /></div>
              <h2>Listo para compartir</h2>
              <p>Se abrirá el menú de tu teléfono para publicar en Instagram, Facebook o WhatsApp.</p>
              <button className="btn btn-primary btn-lg" onClick={() => setShared(false)}>Entendido</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.ExportScreen = ExportScreen;
})();
