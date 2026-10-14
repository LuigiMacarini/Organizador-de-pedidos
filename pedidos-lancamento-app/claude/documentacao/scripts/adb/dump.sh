#!/bin/bash
# Uso: dump.sh [filtro]
# Lê a tela atual do aparelho (uiautomator) e lista os elementos com texto, descrição ou clicáveis, com o centro (x,y).
# Serve para mapear telas antes de automatizar um roteiro. A leitura faz o app trabalhar um pouco: não use durante medições.
export MSYS_NO_PATHCONV=1
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
D="$(cd "$(dirname "$0")" && pwd -W)"   # caminho no formato C:/..., que o Node do Windows entende
T="${TCC_TRABALHO:-C:/dev/tcc-ferramentas/adb}"; mkdir -p "$T"   # arquivos de trabalho, fora do repositório
timeout 30 "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1
timeout 20 "$ADB" exec-out cat /sdcard/ui.xml > "$T/ui.xml" 2>/dev/null
node "$D/ui.js" "$1" < "$T/ui.xml"
