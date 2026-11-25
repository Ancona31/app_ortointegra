"""F5 · Resume la salida de medir-disparadores.sh (una línea JSON por corrida).

    python3 -I supabase/fusion/notas/F5/resumir-medicion.py medicion.jsonl ANTES [DESPUES...]

Por operación y rol: la mediana (de las medianas de cada vuelta) del costo total
de UNA sentencia en µs, y la suma de µs por fila de los disparadores BEFORE de
F5 según EXPLAIN (ANALYZE) (mediana de las vueltas). Delta contra ANTES.
"""
import json
import statistics
import sys
from collections import defaultdict

F5 = ("trg_appointments_horario_bloqueado", "trg_appointments_proteger_")


def es_f5(nombre: str) -> bool:
    return nombre.startswith(F5)


def main() -> None:
    ruta, contenedores = sys.argv[1], sys.argv[2:]
    tot = defaultdict(list)
    f5 = defaultdict(list)
    por_disp = defaultdict(list)
    for linea in open(ruta, encoding="utf-8"):
        d = json.loads(linea)
        r = d["r"]
        k = (r["op"], r["rol"], d["contenedor"])
        tot[k].append(float(r["mediana_us"]))
        disp = r["disparadores"] or {}
        f5[k].append(sum(v["us_por_llamada"] * v["llamadas"] / r["n"] for n, v in disp.items() if es_f5(n)))
        for n, v in disp.items():
            if not n.startswith("RI_"):
                por_disp[k + (n,)].append(v["us_por_llamada"])
    ops = sorted({(k[0], k[1]) for k in tot}, key=lambda x: (x[1], x[0]))
    cab = ["op", "rol"] + [f"{c} total µs" for c in contenedores] + [f"{c} F5 µs/fila" for c in contenedores]
    print("| " + " | ".join(cab) + " |")
    print("|" + "---|" * len(cab))
    for op, rol in ops:
        base_t = statistics.median(tot[(op, rol, contenedores[0])])
        base_f = statistics.median(f5[(op, rol, contenedores[0])])
        celdas = [op, rol]
        for c in contenedores:
            m = statistics.median(tot[(op, rol, c)])
            celdas.append(f"{m:.1f}" + ("" if c == contenedores[0] else f" ({(m - base_t) / base_t * 100:+.1f} %)"))
        for c in contenedores:
            m = statistics.median(f5[(op, rol, c)])
            celdas.append(f"{m:.2f}" + ("" if c == contenedores[0] else f" ({m - base_f:+.2f})"))
        print("| " + " | ".join(celdas) + " |")
    print()
    print("Disparadores (µs por llamada, mediana de las vueltas):")
    for op, rol in ops:
        for c in contenedores:
            filas = sorted((k[3], statistics.median(v)) for k, v in por_disp.items() if k[:3] == (op, rol, c))
            print(f"  {op:12} {rol:13} {c:16} " + ", ".join(f"{n.replace('trg_appointments_', '')}={t:.1f}" for n, t in filas))


if __name__ == "__main__":
    main()
