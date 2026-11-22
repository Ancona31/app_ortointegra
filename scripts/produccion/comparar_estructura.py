#!/usr/bin/env python3
"""Compara dos fotos de estructura (JSONL de catalogo.sql), objeto por objeto.

Lo llama comparar-estructura.sh, que se encarga de extraer las fotos. Uso directo:
  python3 -I comparar_estructura.py A.jsonl B.jsonl [--esperadas F] [--tsv F] [--json F]
         [--esquemas RE] [--excluir-esquemas RE] [--tipos LISTA] [--excluir-tipos LISTA]
         [--etiquetas A,B]

Salida: 0 = sin diferencias inesperadas; 1 = hay alguna; 2 = error de uso.
"""
import argparse
import difflib
import fnmatch
import json
import re
import sys

# Campos largos: se comparan por su md5 y se enseñan como diff.
LARGOS = {"cuerpo": "md5_cuerpo", "definicion_vista": "md5_vista"}
ESTADOS = {"solo_a", "solo_b", "distinto"}


def cargar(ruta):
    objetos = {}
    with open(ruta, encoding="utf-8") as f:
        for n, linea in enumerate(f, 1):
            linea = linea.strip()
            if not linea.startswith("{"):
                continue  # etiquetas de psql u otras líneas que no son filas
            try:
                o = json.loads(linea)
            except json.JSONDecodeError as e:
                sys.exit(f"error: {ruta}:{n}: JSON inválido ({e})")
            objetos[(o["t"], o["k"])] = o
    if not objetos:
        sys.exit(f"error: {ruta} no trae ninguna fila de catálogo")
    return objetos


def cargar_esperadas(ruta):
    reglas = []
    try:
        f = open(ruta, encoding="utf-8")
    except OSError as e:
        print(f"error: no se puede leer la lista de esperadas: {e}", file=sys.stderr)
        sys.exit(2)
    with f:
        for n, linea in enumerate(f, 1):
            linea = linea.rstrip("\n")
            if not linea.strip() or linea.lstrip().startswith("#"):
                continue
            partes = linea.split("\t")
            if len(partes) != 4 or not partes[3].strip():
                sys.exit(f"error: {ruta}:{n}: se esperan 4 columnas separadas por TAB "
                         "(estado, tipo, clave, razón) y la razón no puede ir vacía")
            estado, tipo, clave, razon = (p.strip() for p in partes)
            if estado != "*" and estado not in ESTADOS:
                sys.exit(f"error: {ruta}:{n}: estado «{estado}» no es solo_a, solo_b, distinto ni *")
            reglas.append({"estado": estado, "tipo": tipo, "clave": clave,
                           "razon": razon, "linea": n, "usada": 0})
    return reglas


def filtrar(objs, a):
    out = {}
    for key, o in objs.items():
        esq = o.get("s")
        if a.tipos and o["t"] not in a.tipos:
            continue
        if a.excluir_tipos and o["t"] in a.excluir_tipos:
            continue
        if esq is not None:
            if a.esquemas and not re.search(a.esquemas, esq):
                continue
            if a.excluir_esquemas and re.search(a.excluir_esquemas, esq):
                continue
        out[key] = o
    return out


def comparar(A, B):
    difs = []
    for key in sorted(set(A) | set(B)):
        t, k = key
        oa, ob = A.get(key), B.get(key)
        base = {"tipo": t, "esquema": (oa or ob).get("s"), "clave": k}
        if ob is None:
            difs.append({**base, "estado": "solo_a", "campos": {}, "a": oa["v"], "b": None})
        elif oa is None:
            difs.append({**base, "estado": "solo_b", "campos": {}, "a": None, "b": ob["v"]})
        else:
            va, vb = oa["v"], ob["v"]
            campos = {}
            for c in sorted(set(va) | set(vb)):
                if c in LARGOS:
                    continue
                if va.get(c) != vb.get(c):
                    campos[c] = [va.get(c), vb.get(c)]
            if campos:
                difs.append({**base, "estado": "distinto", "campos": campos, "a": va, "b": vb})
    return difs


def explicar(d, reglas):
    for r in reglas:
        if r["estado"] not in ("*", d["estado"]):
            continue
        if not fnmatch.fnmatchcase(d["tipo"], r["tipo"]):
            continue
        if not fnmatch.fnmatchcase(d["clave"], r["clave"]):
            continue
        r["usada"] += 1
        return r["razon"]
    return None


def corto(v, n=300):
    s = json.dumps(v, ensure_ascii=False) if not isinstance(v, str) else v
    return s if len(s) <= n else s[:n] + f"… ({len(s)} car.)"


def imprimir(difs, etq):
    ea, eb = etq
    actual = None
    for d in difs:
        if d["tipo"] != actual:
            actual = d["tipo"]
            print(f"\n== {actual} ==")
        marca = f"  [esperada: {d['razon']}]" if d.get("razon") else "  [INESPERADA]"
        if d["estado"] == "solo_a":
            print(f"- sólo en {ea}: {d['clave']}{marca}")
            print(f"    {corto(d['a'])}")
        elif d["estado"] == "solo_b":
            print(f"+ sólo en {eb}: {d['clave']}{marca}")
            print(f"    {corto(d['b'])}")
        else:
            print(f"~ distinto: {d['clave']}{marca}")
            for c, (x, y) in d["campos"].items():
                print(f"    {c}:")
                print(f"      {ea}: {corto(x)}")
                print(f"      {eb}: {corto(y)}")
                largo = next((l for l, m in LARGOS.items() if m == c), None)
                if largo:
                    la = (d["a"].get(largo) or "").splitlines()
                    lb = (d["b"].get(largo) or "").splitlines()
                    diff = list(difflib.unified_diff(la, lb, ea, eb, lineterm="", n=2))
                    for linea in diff[:80]:
                        print(f"      | {linea}")
                    if len(diff) > 80:
                        print(f"      | … ({len(diff) - 80} líneas más)")


def esc(v):
    if v is None:
        return ""
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    return s.replace("\\", "\\\\").replace("\t", "\\t").replace("\n", "\\n").replace("\r", "\\r")


def escribir_tsv(ruta, difs):
    with open(ruta, "w", encoding="utf-8") as f:
        f.write("estado\ttipo\tesquema\tclave\tcampo\tvalor_a\tvalor_b\tesperada\n")
        for d in difs:
            filas = d["campos"].items() if d["campos"] else [("", (d["a"], d["b"]))]
            for c, (x, y) in filas:
                f.write("\t".join(esc(z) for z in (d["estado"], d["tipo"], d["esquema"], d["clave"],
                                                   c, x, y, d.get("razon"))) + "\n")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("a")
    p.add_argument("b")
    p.add_argument("--esperadas")
    p.add_argument("--tsv")
    p.add_argument("--json")
    p.add_argument("--esquemas")
    p.add_argument("--excluir-esquemas")
    p.add_argument("--tipos", type=lambda s: set(s.split(",")))
    p.add_argument("--excluir-tipos", type=lambda s: set(s.split(",")))
    p.add_argument("--etiquetas", default="A,B")
    p.add_argument("--silencioso", action="store_true", help="no imprime las diferencias esperadas")
    a = p.parse_args()
    etq = (a.etiquetas.split(",") + ["B"])[:2]

    A, B = filtrar(cargar(a.a), a), filtrar(cargar(a.b), a)
    reglas = cargar_esperadas(a.esperadas) if a.esperadas else []
    difs = comparar(A, B)
    for d in difs:
        d["razon"] = explicar(d, reglas)

    visibles = [d for d in difs if not (a.silencioso and d["razon"])]
    imprimir(visibles, etq)
    if a.tsv:
        escribir_tsv(a.tsv, difs)
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(difs, f, ensure_ascii=False, indent=1)

    inesperadas = [d for d in difs if not d["razon"]]
    sin_uso = [r for r in reglas if not r["usada"]]
    print(f"\nResumen: {len(A)} objetos en {etq[0]}, {len(B)} en {etq[1]}; "
          f"{len(difs)} diferencias ({len(difs) - len(inesperadas)} esperadas, {len(inesperadas)} inesperadas).")
    for r in sin_uso:
        print(f"aviso: la diferencia esperada de la línea {r['linea']} ({r['tipo']} {r['clave']}) no apareció; "
              "¿sigue haciendo falta?")
    return 1 if inesperadas else 0


if __name__ == "__main__":
    sys.exit(main())
