/* ============================================================
   Editor de anotaciones — estilo "stories", funcional.
   Herramientas: mover, flecha, círculo, texto, trazo, blur, ángulo Cobb.
   Coordenadas guardadas como fracciones [0..1] → responsive.
   ============================================================ */
(function () {
  const { useState, useRef, useEffect, useCallback } = React;
  const I = window.Icons;

  const COLORS = [
    { v: "var", c: "#ef4444", name: "Patología" },
    { c: "#f59e0b", name: "Atención" },
    { c: "#16a34a", name: "Normal" },
    { c: "#2f6fb0", name: "Marca" },
    { c: "#ffffff", name: "Blanco" },
  ];
  const TOOLS = [
    { id: "move", icon: "Move", label: "Mover" },
    { id: "arrow", icon: "Arrow", label: "Flecha" },
    { id: "circle", icon: "Circle", label: "Círculo" },
    { id: "text", icon: "Type", label: "Texto" },
    { id: "pen", icon: "Pen", label: "Trazo" },
    { id: "blur", icon: "Blur", label: "Difuminar" },
    { id: "angle", icon: "Angle", label: "Ángulo" },
  ];

  let _id = 0; const uid = () => "a" + (++_id);

  function angleBetween(a, b) {
    const da = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
    const db = Math.atan2(b.y2 - b.y1, b.x2 - b.x1);
    let deg = Math.abs((da - db) * 180 / Math.PI) % 180;
    if (deg > 90) deg = 180 - deg;
    return deg;
  }

  const W = 300, H = 400; // espacio de coordenadas fijo del lienzo (3:4)

  function Annotator({ image, onClose, onDone }) {
    const canvasRef = useRef(null);
    const [tool, setTool] = useState("arrow");
    const [color, setColor] = useState("#ef4444");
    const [brushSize, setBrushSize] = useState(1);
    const [items, setItems] = useState([
      { id: uid(), type: "angle", color: "#2f6fb0", size: 1,
        a: { x1: .30, y1: .34, x2: .62, y2: .30 },
        b: { x1: .33, y1: .66, x2: .60, y2: .72 } },
    ]);
    const [history, setHistory] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [draft, setDraft] = useState(null);
    const [sel, setSel] = useState(null);
    const [editingText, setEditingText] = useState(null);
    const drag = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
      if (editingText && inputRef.current) {
        const el = inputRef.current;
        requestAnimationFrame(() => { el.focus(); el.select && el.select(); });
      }
    }, [editingText]);

    const pushHistory = useCallback((next) => {
      setHistory((h) => [...h, items]); setRedoStack([]); setItems(next);
    }, [items]);

    const frac = (e) => {
      const r = canvasRef.current.getBoundingClientRect();
      const cx = (e.touches ? e.touches[0].clientX : e.clientX);
      const cy = (e.touches ? e.touches[0].clientY : e.clientY);
      return { x: Math.min(1, Math.max(0, (cx - r.left) / r.width)),
               y: Math.min(1, Math.max(0, (cy - r.top) / r.height)) };
    };

    // ---- pointer en canvas ----
    const onDown = (e) => {
      if (editingText) { commitText(); return; }
      const p = frac(e);
      if (tool === "move") { setSel(null); return; }
      if (tool === "text") {
        const it = { id: uid(), type: "text", color, size: brushSize, x: p.x, y: p.y, text: "" };
        pushHistory([...items, it]); setEditingText(it.id); setSel(it.id); setTool("move");
        return;
      }
      if (tool === "angle") {
        const it = { id: uid(), type: "angle", color, size: brushSize,
          a: { x1: p.x - .12, y1: p.y - .07, x2: p.x + .12, y2: p.y - .09 },
          b: { x1: p.x - .12, y1: p.y + .09, x2: p.x + .12, y2: p.y + .07 } };
        pushHistory([...items, it]); setSel(it.id); setTool("move");
        return;
      }
      if (tool === "pen") { try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {} setDraft({ id: uid(), type: "pen", color, size: brushSize, pts: [p] }); return; }
      // arrow / circle / blur → rubber band
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
      setDraft({ id: uid(), type: tool, color, size: brushSize, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    };
    const onMove = (e) => {
      if (!draft) return;
      const p = frac(e);
      if (draft.type === "pen") setDraft({ ...draft, pts: [...draft.pts, p] });
      else setDraft({ ...draft, x2: p.x, y2: p.y });
    };
    const onUp = () => {
      if (!draft) return;
      const valid = draft.type === "pen" ? draft.pts.length > 1
        : Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > .02;
      if (valid) pushHistory([...items, draft]);
      setDraft(null);
    };

    // ---- drag de handles / mover item ----
    const startHandle = (e, itemId, key) => {
      e.stopPropagation();
      drag.current = { itemId, key, moved: false, before: items };
      const move = (ev) => {
        const p = frac(ev); drag.current.moved = true;
        setItems((arr) => arr.map((it) => {
          if (it.id !== drag.current.itemId) return it;
          return applyHandle(it, key, p);
        }));
      };
      const up = () => {
        if (drag.current && drag.current.moved) { setHistory((h) => [...h, drag.current.before]); setRedoStack([]); }
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        drag.current = null;
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    function applyHandle(it, key, p) {
      if (key === "move") {
        const dx = p.x - it._gx, dy = p.y - it._gy;
        return translateItem({ ...it }, dx, dy, p);
      }
      if (it.type === "angle") {
        const [seg, pt] = key.split(".");
        return { ...it, [seg]: { ...it[seg], [pt + "1"]: pt === "p" ? p.x : it[seg].x1 } };
      }
      const nk = { ...it }; nk[key.x] = p.x; nk[key.y] = p.y; return nk;
    }
    function translateItem(it, dx, dy, p) {
      it._gx = p.x; it._gy = p.y; return it;
    }

    // mover item completo (tool move)
    const startMoveItem = (e, it) => {
      if (tool !== "move") return;
      e.stopPropagation(); setSel(it.id);
      const start = frac(e); const before = items;
      let moved = false;
      const move = (ev) => {
        const p = frac(ev); const dx = p.x - start.x, dy = p.y - start.y; moved = true;
        start.x = p.x; start.y = p.y;
        setItems((arr) => arr.map((x) => x.id === it.id ? shift(x, dx, dy) : x));
      };
      const up = () => {
        if (moved) { setHistory((h) => [...h, before]); setRedoStack([]); }
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };
    function shift(it, dx, dy) {
      const c = { ...it };
      if (c.type === "text") { c.x += dx; c.y += dy; }
      else if (c.type === "pen") { c.pts = c.pts.map((q) => ({ x: q.x + dx, y: q.y + dy })); }
      else if (c.type === "angle") {
        c.a = { x1: c.a.x1 + dx, y1: c.a.y1 + dy, x2: c.a.x2 + dx, y2: c.a.y2 + dy };
        c.b = { x1: c.b.x1 + dx, y1: c.b.y1 + dy, x2: c.b.x2 + dx, y2: c.b.y2 + dy };
      } else { c.x1 += dx; c.y1 += dy; c.x2 += dx; c.y2 += dy; }
      return c;
    }
    const moveEndpoint = (e, it, seg, n) => {
      e.stopPropagation();
      const before = items; let moved = false;
      const move = (ev) => {
        const p = frac(ev); moved = true;
        setItems((arr) => arr.map((x) => {
          if (x.id !== it.id) return x;
          const c = { ...x, [seg]: { ...x[seg] } };
          c[seg]["x" + n] = p.x; c[seg]["y" + n] = p.y; return c;
        }));
      };
      const up = () => {
        if (moved) { setHistory((h) => [...h, before]); setRedoStack([]); }
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    // mover un extremo de flecha/círculo (which = "1" o "2") → reorientar/redimensionar
    const moveVertex = (e, it, which) => {
      e.stopPropagation(); setSel(it.id);
      const before = items; let moved = false;
      const move = (ev) => {
        const p = frac(ev); moved = true;
        setItems((arr) => arr.map((x) => x.id === it.id
          ? { ...x, ["x" + which]: p.x, ["y" + which]: p.y } : x));
      };
      const up = () => {
        if (moved) { setHistory((h) => [...h, before]); setRedoStack([]); }
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    // tap = editar · arrastre = mover (funciona con cualquier herramienta)
    const onTextPointerDown = (e, it) => {
      e.stopPropagation();
      setSel(it.id);
      const start = frac(e); let moved = false; const before = items;
      const move = (ev) => {
        const p = frac(ev); const dx = p.x - start.x, dy = p.y - start.y;
        if (Math.abs(dx) > .005 || Math.abs(dy) > .005) moved = true;
        start.x = p.x; start.y = p.y;
        setItems((arr) => arr.map((x) => x.id === it.id ? shift(x, dx, dy) : x));
      };
      const up = () => {
        if (moved) { setHistory((h) => [...h, before]); setRedoStack([]); }
        else { setEditingText(it.id); }
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    };

    const commitText = () => {
      setItems((arr) => arr.filter((it) => !(it.type === "text" && it.text.trim() === "")));
      setEditingText(null);
    };

    // seleccionar una anotación (con cualquier herramienta); en Mover también arrastra
    const selectItem = (e, it) => {
      e.stopPropagation();
      if (tool === "move") startMoveItem(e, it);
      else setSel(it.id);
    };
    const setTextValue = (id, v) => setItems((arr) => arr.map((it) => it.id === id ? { ...it, text: v } : it));

    const undo = () => { if (!history.length) return; const prev = history[history.length - 1]; setRedoStack((r) => [items, ...r]); setItems(prev); setHistory((h) => h.slice(0, -1)); setSel(null); };
    const redo = () => { if (!redoStack.length) return; const nx = redoStack[0]; setHistory((h) => [...h, items]); setItems(nx); setRedoStack((r) => r.slice(1)); };
    const delSel = () => { if (!sel) return; pushHistory(items.filter((it) => it.id !== sel)); setSel(null); };

    // ---- tamaño / grosor ----
    const SIZES = [0.6, 1, 1.6, 2.4];
    const selItem = items.find((it) => it.id === sel);
    const sizeTarget = selItem && selItem.type !== "blur" ? selItem : null;
    const activeSize = sizeTarget ? (sizeTarget.size || 1) : brushSize;
    const applySize = (v) => {
      if (sizeTarget) pushHistory(items.map((it) => it.id === sizeTarget.id ? { ...it, size: v } : it));
      else setBrushSize(v);
    };

    const px = (f) => f * W, py = (f) => f * H;
    const all = draft ? [...items, draft] : items;

    return (
      <div className="annot">
        {/* top bar */}
        <div className="annot-top">
          <button className="annot-icon-btn" onClick={onClose}><I.ChevronLeft size={22} /></button>
          <div className="annot-top-mid">
            <button className="annot-icon-btn" onClick={undo} disabled={!history.length}><I.Undo size={20} /></button>
            <button className="annot-icon-btn" onClick={redo} disabled={!redoStack.length}><I.Redo size={20} /></button>
            {sel && <button className="annot-icon-btn danger" onClick={delSel} title="Eliminar selección"><I.Trash size={19} /></button>}
          </div>
          <button className="annot-done" onClick={() => onDone(items)}><I.Check size={18} /> Listo</button>
        </div>

        {/* stage */}
        <div className="annot-stage">
          <div className="annot-canvas-wrap">
            <div ref={canvasRef} className="annot-canvas" style={{ background: image }}
                 onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
              <div className="annot-grid" />

              {/* blur regions (debajo del SVG) */}
              {all.filter((it) => it.type === "blur").map((it) => {
                const x = Math.min(it.x1, it.x2) * 100, y = Math.min(it.y1, it.y2) * 100;
                const w = Math.abs(it.x2 - it.x1) * 100, h = Math.abs(it.y2 - it.y1) * 100;
                return <div key={it.id} className="blur-region" onPointerDown={(e) => startMoveItem(e, it)}
                  style={{ left: x + "%", top: y + "%", width: w + "%", height: h + "%",
                           outline: sel === it.id ? "2px solid #fff" : "none" }} />;
              })}

              {/* SVG vectores */}
              <svg className="annot-svg" width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
                <defs>
                  {COLORS.map((c) => (
                    <marker key={c.c} id={"ah-" + c.c.replace("#","")} markerWidth="9" markerHeight="9"
                            refX="6" refY="4.5" orient="auto">
                      <path d="M1 1 L8 4.5 L1 8 Z" fill={c.c} />
                    </marker>
                  ))}
                </defs>
                {all.map((it) => {
                  const sz = it.size || 1;
                  const onSel = sel === it.id;
                  if (it.type === "arrow") return (
                    <g key={it.id}>
                      <line x1={px(it.x1)} y1={py(it.y1)} x2={px(it.x2)} y2={py(it.y2)} stroke="transparent" strokeWidth="22" strokeLinecap="round" onPointerDown={(e) => selectItem(e, it)} style={{ cursor: tool === "move" ? "move" : "crosshair" }} />
                      {onSel && <line x1={px(it.x1)} y1={py(it.y1)} x2={px(it.x2)} y2={py(it.y2)} stroke="#fff" strokeWidth={4 * sz + 6} strokeLinecap="round" opacity=".35" pointerEvents="none" />}
                      <line x1={px(it.x1)} y1={py(it.y1)} x2={px(it.x2)} y2={py(it.y2)} stroke={it.color} strokeWidth={4 * sz} strokeLinecap="round" markerEnd={`url(#ah-${it.color.replace("#","")})`} pointerEvents="none" />
                      {onSel && ["1","2"].map((n) => (
                        <circle key={n} cx={px(it["x"+n])} cy={py(it["y"+n])} r="11" fill="#fff" stroke={it.color} strokeWidth="2.5"
                          onPointerDown={(e) => moveVertex(e, it, n)} style={{ cursor: "grab" }} />
                      ))}
                    </g>
                  );
                  if (it.type === "circle") {
                    const cx = (it.x1 + it.x2) / 2, cy = (it.y1 + it.y2) / 2;
                    const rx = Math.abs(px(it.x2) - px(it.x1)) / 2, ry = Math.abs(py(it.y2) - py(it.y1)) / 2;
                    return (
                      <g key={it.id}>
                        <ellipse cx={px(cx)} cy={py(cy)} rx={rx} ry={ry} fill="none" stroke="transparent" strokeWidth="22" onPointerDown={(e) => selectItem(e, it)} style={{ cursor: tool === "move" ? "move" : "crosshair", pointerEvents: "stroke" }} />
                        {onSel && <ellipse cx={px(cx)} cy={py(cy)} rx={rx} ry={ry} fill="none" stroke="#fff" strokeWidth={4 * sz + 6} opacity=".35" pointerEvents="none" />}
                        <ellipse cx={px(cx)} cy={py(cy)} rx={rx} ry={ry} fill="none" stroke={it.color} strokeWidth={4 * sz} pointerEvents="none" />
                        {onSel && ["1","2"].map((n) => (
                          <circle key={n} cx={px(it["x"+n])} cy={py(it["y"+n])} r="11" fill="#fff" stroke={it.color} strokeWidth="2.5"
                            onPointerDown={(e) => moveVertex(e, it, n)} style={{ cursor: "nwse-resize" }} />
                        ))}
                      </g>
                    );
                  }
                  if (it.type === "pen") {
                    const dpath = it.pts.map((q, i) => (i ? "L" : "M") + px(q.x) + " " + py(q.y)).join(" ");
                    return (
                      <g key={it.id}>
                        <path d={dpath} fill="none" stroke="transparent" strokeWidth="22" strokeLinecap="round" strokeLinejoin="round" onPointerDown={(e) => selectItem(e, it)} style={{ cursor: tool === "move" ? "move" : "crosshair" }} />
                        {onSel && <path d={dpath} fill="none" stroke="#fff" strokeWidth={4 * sz + 6} strokeLinecap="round" strokeLinejoin="round" opacity=".35" pointerEvents="none" />}
                        <path d={dpath} fill="none" stroke={it.color} strokeWidth={4 * sz} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
                      </g>
                    );
                  }
                  if (it.type === "angle") {
                    const ang = angleBetween(it.a, it.b);
                    const mx = (px(it.a.x2) + px(it.b.x2)) / 2, my = (py(it.a.y2) + py(it.b.y2)) / 2;
                    const on = sel === it.id;
                    return (
                      <g key={it.id}>
                        {/* hit-lines invisibles y anchas para seleccionar/mover el ángulo */}
                        {["a","b"].map((seg) => (
                          <line key={"hit"+seg} x1={px(it[seg].x1)} y1={py(it[seg].y1)} x2={px(it[seg].x2)} y2={py(it[seg].y2)}
                            stroke="transparent" strokeWidth="22" strokeLinecap="round"
                            onPointerDown={(e) => selectItem(e, it)}
                            style={{ cursor: tool === "move" ? "move" : "pointer" }} />
                        ))}
                        <line x1={px(it.a.x1)} y1={py(it.a.y1)} x2={px(it.a.x2)} y2={py(it.a.y2)} stroke={it.color} strokeWidth={3.5 * sz} strokeLinecap="round" strokeDasharray={(2 * sz) + " " + (7 * sz)} pointerEvents="none" />
                        <line x1={px(it.b.x1)} y1={py(it.b.y1)} x2={px(it.b.x2)} y2={py(it.b.y2)} stroke={it.color} strokeWidth={3.5 * sz} strokeLinecap="round" strokeDasharray={(2 * sz) + " " + (7 * sz)} pointerEvents="none" />
                        {["a","b"].map((seg) => ["1","2"].map((n) => (
                          <circle key={seg+n} cx={px(it[seg]["x"+n])} cy={py(it[seg]["y"+n])} r="9"
                            fill="#fff" stroke={it.color} strokeWidth="2.5"
                            onPointerDown={(e) => moveEndpoint(e, it, seg, n)}
                            style={{ cursor: "grab" }} />
                        )))}
                        <g transform={`translate(${mx}, ${my})`} onPointerDown={(e) => selectItem(e, it)} style={{ cursor: tool === "move" ? "move" : "pointer" }}>
                          <rect x="-36" y="-23" width="72" height="46" rx="12" fill="transparent" />
                          {on && <rect x="-30" y="-19" width="60" height="34" rx="11" fill="none" stroke="#fff" strokeWidth="2" />}
                          <rect x="-26" y="-15" width="52" height="26" rx="8" fill={it.color} />
                          <text x="0" y="3" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" fontFamily="var(--font)" pointerEvents="none">{ang.toFixed(0)}°</text>
                        </g>
                      </g>
                    );
                  }
                  return null;
                })}
              </svg>

              {/* etiquetas de texto (HTML editable) */}
              {all.filter((it) => it.type === "text").map((it) => (
                <div key={it.id} className="text-label"
                     style={{ left: it.x * 100 + "%", top: it.y * 100 + "%", fontSize: (15 * (it.size || 1)) + "px", color: "#fff", background: it.color, outline: sel === it.id ? "2px solid #fff" : "none", whiteSpace: "normal", width: "min(82%, " + (Math.max(4, (it.text || "texto").length) * 0.62).toFixed(1) + "em)", textAlign: "center", overflowWrap: "anywhere" }}
                     onPointerDown={(e) => onTextPointerDown(e, it)}>
                  {editingText === it.id
                    ? <input ref={inputRef} className="text-input-inline" value={it.text}
                        size={Math.max(6, (it.text || "").length + 1)}
                        onChange={(e) => setTextValue(it.id, e.target.value)}
                        onBlur={commitText} onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && commitText()}
                        placeholder="Escribe…" onPointerDown={(e) => e.stopPropagation()} />
                    : <span>{it.text || "texto"}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* controles tool-específicos */}
        {tool === "blur" && <div className="annot-hint"><I.Blur size={15} /> Arrastra sobre la cara, tatuaje o marca a ocultar</div>}
        {tool === "angle" && <div className="annot-hint"><I.Angle size={15} /> Toca para colocar el medidor · arrastra los puntos a los platillos vertebrales</div>}

        {/* paleta de color + tamaño */}
        <div className="annot-controls">
          <div className="annot-colors">
            {COLORS.map((c) => (
              <button key={c.c} className={"swatch" + (color === c.c ? " on" : "")} title={c.name}
                style={{ background: c.c, borderColor: c.c === "#ffffff" ? "#cbd5e1" : c.c }}
                onClick={() => setColor(c.c)} />
            ))}
          </div>
          <div className="annot-sizes" title={sizeTarget ? "Tamaño de la selección" : "Tamaño de la anotación"}>
            {SIZES.map((s, i) => (
              <button key={s} className={"sizedot" + (Math.abs(activeSize - s) < .001 ? " on" : "")}
                onClick={() => applySize(s)} aria-label={"Tamaño " + (i + 1)}>
                <span style={{ width: (7 + i * 5) + "px", height: (7 + i * 5) + "px" }} />
              </button>
            ))}
          </div>
        </div>

        {/* dock de herramientas */}
        <div className="annot-dock">
          {TOOLS.map((t) => {
            const Ico = I[t.icon];
            return (
              <button key={t.id} className={"dock-tool" + (tool === t.id ? " on" : "")} onClick={() => { setTool(t.id); setSel(null); }}>
                <Ico size={22} /><span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  window.Annotator = Annotator;
})();
