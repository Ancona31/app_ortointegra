#!/bin/sh
# Regenera las tres vistas y ensambla la página
S=/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
cd $S/entrega/docs-b && python3 tmp-dcb3-gen.py && python3 $S/entrega/kit/build.py $S/entrega/docs-b "Documentos 2" >/dev/null && \
(printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html && echo ok
