#!/bin/sh
# Regenera, ensambla y captura. Uso: VP=ext,esc T=Claro E=inicio sh tmp-ec-run.sh
S=/tmp/claude-0/-home-user-app-ortointegra/c6f872cd-9586-537f-8cbb-7c91e620cbb1/scratchpad
cd $S/entrega/final-expediente && python3 tmp-ec-gen.py >/dev/null && python3 ../kit/build.py . "Expediente del paciente" >/dev/null && (printf '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'; cat pagina.html) > tmp-ver.html && cd $S/tools && node tmp-fe2-cap.js
