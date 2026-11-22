#!/usr/bin/env python3
"""Genera el SQL que crea en un clon los roles de una foto (05-catalogo.jsonl).

`supabase db dump --role-only` omite a propósito los roles reservados de
Supabase (anon, authenticated, supabase_*…), y la imagen de Postgres no trae
todos los que tiene un proyecto (p. ej. supabase_realtime_admin o
supabase_functions_admin). Esto crea los que falten, con los atributos de la
foto, SIN contraseña (las contraseñas no están en la foto) y sin tocar los que
ya existen salvo para igualar sus atributos. Las membresías van al final.
Se ejecuta como superusuario (supabase_admin) en el clon.

  python3 -I roles_desde_catalogo.py 05-catalogo.jsonl > roles-clon.sql
"""
import json
import sys


def ident(x):
    return '"' + x.replace('"', '""') + '"'


def main(ruta):
    roles = []
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            if linea.startswith("{"):
                o = json.loads(linea)
                if o["t"] == "rol":
                    roles.append((o["k"], o["v"]))
    out = ["-- generado por roles_desde_catalogo.py; sin contraseñas", "SET client_min_messages = warning;"]
    for nombre, v in sorted(roles):
        attrs = " ".join([
            "SUPERUSER" if v["superusuario"] else "NOSUPERUSER",
            "INHERIT" if v["hereda"] else "NOINHERIT",
            "CREATEROLE" if v["crea_roles"] else "NOCREATEROLE",
            "CREATEDB" if v["crea_bd"] else "NOCREATEDB",
            "LOGIN" if v["login"] else "NOLOGIN",
            "REPLICATION" if v["replicacion"] else "NOREPLICATION",
            "BYPASSRLS" if v["bypassrls"] else "NOBYPASSRLS",
            f"CONNECTION LIMIT {int(v['limite_conexiones'])}",
        ])
        lit = "'" + nombre.replace("'", "''") + "'"
        out.append(f"DO $r$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = {lit}) "
                   f"THEN CREATE ROLE {ident(nombre)}; END IF; END $r$;")
        out.append(f"ALTER ROLE {ident(nombre)} {attrs};")
    for nombre, v in sorted(roles):
        for g in filter(None, (v.get("miembro_de") or "").split(",")):
            admin = g.endswith("*")
            g = g.rstrip("*")
            out.append(f"GRANT {ident(g)} TO {ident(nombre)}{' WITH ADMIN OPTION' if admin else ''};")
    print("\n".join(out))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("uso: roles_desde_catalogo.py 05-catalogo.jsonl")
    main(sys.argv[1])
