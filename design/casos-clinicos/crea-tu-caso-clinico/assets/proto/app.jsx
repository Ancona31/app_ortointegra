/* App — router del módulo "Crea tu Caso Clínico" */
(function () {
  const { useState } = React;
  const Shell = window.Shell;

  function App() {
    const [route, setRoute] = useState("list"); // list | editor | export
    const [annot, setAnnot] = useState(null);    // imagen a anotar o null

    const openAnnot = (m) => setAnnot(m && m.cover ? m.cover : "linear-gradient(150deg,#1f3a52,#0c1722)");

    return (
      <Shell active="casos" onNav={(id) => { if (id === "casos") setRoute("list"); }}>
        {route === "list" && (
          <window.CaseList onOpen={() => setRoute("editor")} onNew={() => setRoute("editor")} />
        )}
        {route === "editor" && (
          <window.CaseEditor
            onBack={() => setRoute("list")}
            onAnnotate={openAnnot}
            onExport={() => setRoute("export")} />
        )}
        {route === "export" && (
          <window.ExportScreen
            onBack={() => setRoute("editor")}
            onFix={() => openAnnot(null)}
            hasFace={true} />
        )}

        {annot && (
          <window.Annotator
            image={annot}
            onClose={() => setAnnot(null)}
            onDone={() => setAnnot(null)} />
        )}
      </Shell>
    );
  }

  ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
