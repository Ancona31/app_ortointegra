/* Pantalla: Lista de casos clínicos (dashboard del módulo) */
(function () {
  const { useState } = React;
  const I = window.Icons;

  const STATUS = {
    borrador:  { cls: "pill-amber", label: "Borrador", icon: "Edit" },
    listo:     { cls: "pill-blue",  label: "Listo para exportar", icon: "Check" },
    publicado: { cls: "pill-green", label: "Publicado", icon: "Globe" },
  };

  function MediaTag({ icon, n }) {
    const Ico = I[icon];
    return <span className="media-tag"><Ico size={13} /> {n}</span>;
  }

  function CaseCard({ c, onOpen }) {
    const st = STATUS[c.status];
    const StIco = I[st.icon];
    return (
      <article className="case-card" onClick={() => onOpen(c)}>
        <div className="case-cover" style={{ background: c.cover }}>
          <div className="case-cover-grid" />
          <div className="case-media-tags">
            {c.media.rx > 0 && <MediaTag icon="Scan" n={c.media.rx} />}
            {c.media.foto > 0 && <MediaTag icon="Camera" n={c.media.foto} />}
            {c.media.video > 0 && <MediaTag icon="Video" n={c.media.video} />}
          </div>
          <span className={"pill case-status " + st.cls}><StIco size={13} /> {st.label}</span>
        </div>
        <div className="case-body">
          <div className="case-region">{c.region}</div>
          <div className="case-title">{c.title}</div>
          <div className="case-meta">
            <span className="case-mono" style={{ background: `var(${c.monoColor})` }}>{c.mono}</span>
            {c.linked
              ? <span><I.Link size={13} style={{ verticalAlign: "-2px" }} /> {c.patient}</span>
              : <span style={{ color: "var(--muted-2)" }}>Caso independiente</span>}
            <span style={{ marginLeft: "auto" }}>{c.updated}</span>
          </div>
        </div>
        <div className="case-foot">
          {c.consent
            ? <span className="consent-flag consent-ok"><I.Shield size={14} /> Consentimiento</span>
            : <span className="consent-flag consent-no"><I.Alert size={14} /> Falta consentimiento</span>}
          <span className="case-foot-spacer" />
          <span className="pill pill-gray">{c.tone.split(" / ")[0]}</span>
        </div>
      </article>
    );
  }

  function CaseList({ onOpen, onNew }) {
    const data = window.SpinusData;
    const [filter, setFilter] = useState("todos");
    const [q, setQ] = useState("");

    let cases = data.cases;
    if (filter !== "todos") cases = cases.filter((c) => c.status === filter);
    if (q.trim()) cases = cases.filter((c) => (c.title + c.region + (c.patient || "")).toLowerCase().includes(q.toLowerCase()));

    const counts = {
      todos: data.cases.length,
      borrador: data.cases.filter((c) => c.status === "borrador").length,
      listo: data.cases.filter((c) => c.status === "listo").length,
      publicado: data.cases.filter((c) => c.status === "publicado").length,
    };

    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="page-eyebrow">Módulo · Documentación clínica</div>
            <h1 className="page-title">Crea tu caso clínico</h1>
            <p className="page-sub">Documenta casos con imágenes, radiografías y video; anótalos y expórtalos para conferencias o redes — sin salir de Spinus.</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={onNew}><I.Plus size={18} /> Nuevo caso</button>
        </div>

        <div className="toolbar">
          <div className="searchbox">
            <I.Search size={18} />
            <input placeholder="Buscar por título, región o paciente…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="seg">
            {[["todos","Todos"],["borrador","Borradores"],["listo","Listos"],["publicado","Publicados"]].map(([k,l]) => (
              <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>
                {l} <span style={{ opacity: .55, fontWeight: 700 }}>{counts[k]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="cases-grid">
          <div className="new-case-card" onClick={onNew}>
            <div className="new-case-plus"><I.Plus size={28} /></div>
            <strong>Crear nuevo caso</strong>
            <span>Desde un paciente del expediente o como caso independiente</span>
          </div>
          {cases.map((c) => <CaseCard key={c.id} c={c} onOpen={onOpen} />)}
        </div>
      </div>
    );
  }

  window.CaseList = CaseList;
})();
