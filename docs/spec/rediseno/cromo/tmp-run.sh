#!/bin/sh
# Regenera las vistas, ensambla y captura. Uso: sh tmp-run.sh <op> [VP=..] [T=..] [E=..]
S=/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
cd $S/entrega/cromo && for f in tmp-v*.py; do python3 $f >/dev/null || exit 1; done && python3 ../kit/build.py . "Navegación y avisos globales" >/dev/null && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html && cd $S/tools && node tmp-cr-cap.js "$@"
