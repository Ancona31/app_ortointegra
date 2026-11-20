#!/bin/sh
set -e
cd /tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/entrega/docs-a
python3 tmp-gen.py
python3 /tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/entrega/kit/build.py /tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad/entrega/docs-a "Documentos 1"
{ printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html; } > tmp-ver.html
