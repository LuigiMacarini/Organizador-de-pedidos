#!/bin/bash
# Roteiro de conferência automático no A54, pelo adb: mesmos passos da conferência manual de 13/10 (doc, seção 4.9).
# Diferença: o cliente novo é preenchido e descartado (não salva), porque cliente com pedidos não pode ser excluído;
# o pedido de teste usa o cliente "Teste Tcc" que já existe. Cada passo é registrado em roteiro.log.
# Segurança: a navegação acha os botões pelo nome; se um botão importante não aparece, o roteiro fecha o app e para.
export MSYS_NO_PATHCONV=1
ADB="$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe"
D="$(cd "$(dirname "$0")" && pwd -W)"   # caminho no formato C:/..., que o Node do Windows entende
T="${TCC_TRABALHO:-C:/dev/tcc-ferramentas/adb}"; mkdir -p "$T"   # arquivos de trabalho, fora do repositório
LOG="$T/roteiro.log"
PKG=com.example.pedidoslancamento

log() { echo "$(date +%H:%M:%S) $*" | tee -a "$LOG"; }
garante() {
  for i in 1 2 3 4 5 6; do
    [ "$(timeout 10 "$ADB" get-state 2>/dev/null)" = "device" ] && return 0
    log "adb perdeu o aparelho; reiniciando o servidor (tentativa $i)"
    timeout 15 "$ADB" kill-server >/dev/null 2>&1; sleep 2; timeout 20 "$ADB" start-server >/dev/null 2>&1; sleep 3
  done
  log "ERRO: o aparelho não voltou"; return 1
}
sh_() { garante && timeout 25 "$ADB" shell "$@" 2>/dev/null | tr -d '\r'; }
tap() { sh_ input tap "$1" "$2" >/dev/null; }
swipe() { sh_ input swipe "$1" "$2" "$3" "$4" "${5:-350}" >/dev/null; }
texto() { sh_ input text "$1" >/dev/null; }
tecla() { sh_ input keyevent "$1" >/dev/null; }
dump() { garante && timeout 30 "$ADB" shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; timeout 20 "$ADB" exec-out cat /sdcard/ui.xml > "$T/ui.xml" 2>/dev/null; }
acha() { dump; node "$D/acha.js" "$1" < "$T/ui.xml"; }
toca() {
  local xy; xy=$(acha "$1")
  if [ -z "$xy" ]; then log "NÃO ACHEI: ${2:-$1}"; return 1; fi
  tap $xy; log "toquei: ${2:-$1} em ($xy)"
}
restaura() { sh_ settings put global stay_on_while_plugged_in "${STAY_ANTES:-0}" >/dev/null; }
aborta() {
  log "ABORTADO: $1 (fecho o app sem salvar nada pendente)"
  sh_ am force-stop $PKG >/dev/null; restaura; kill $LOGCAT_PID 2>/dev/null; log "FIM DO ROTEIRO (abortado)"; exit 1
}
precisa() { toca "$1" "$2" || aborta "não achei \"${2:-$1}\""; }
rola() { # rola <segundos> : sobe e desce a lista (sem leituras de tela)
  local fim=$(( $(date +%s) + $1 ))
  while [ "$(date +%s)" -lt "$fim" ]; do swipe 540 1750 540 850 350; sleep 1.2; swipe 540 850 540 1750 350; sleep 1.2; done
}
aba() { # aba PEDIDOS|CLIENTES|ROTAS : se a barra de abas não está visível, volta uma tela antes
  [ -z "$(acha ", $1\$")" ] && { toca "Navegar para cima" "voltar"; sleep 2; }
  precisa ", $1\$" "aba $1"
}

: > "$LOG"
log "INÍCIO DO ROTEIRO AUTOMÁTICO"
garante || exit 1
STAY_ANTES=$(sh_ settings get global stay_on_while_plugged_in)
sh_ svc power stayon usb >/dev/null
sh_ am force-stop $PKG >/dev/null
timeout 10 "$ADB" logcat -c 2>/dev/null
"$ADB" logcat -v time ActivityTaskManager:I '*:S' > "$T/logcat-janelas.txt" 2>/dev/null &
LOGCAT_PID=$!
sleep 5

log "PASSO 1: abrir o app e ficar 45 s parado na lista de Pedidos"
sh_ monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null; sleep 45

log "PASSO 2: rolar a lista de Pedidos por 30 s"
rola 30

log "PASSO 3: aba Clientes, rolando por 30 s"
aba CLIENTES; sleep 2; rola 26

log "PASSO 4: novo cliente (preenche e volta sem salvar)"
precisa "^\+ Novo$" "+ Novo (cliente)"; sleep 3
precisa "Nome do cliente" "campo Nome"; sleep 1; texto "TESTE"; sleep 1; texto "%sTCC"; sleep 1; texto "%sAUTO"; sleep 2
precisa "Digite rua" "campo Endereço"; sleep 1; texto "Rua%sSete"; sleep 2; texto "%sde%sSetembro"; sleep 10
tecla KEYCODE_BACK; sleep 12
precisa "Navegar para cima" "voltar sem salvar"; sleep 2

log "PASSO 5: novo pedido para o cliente Teste Tcc"
aba PEDIDOS; sleep 2
precisa "^\+ Novo$" "+ Novo (pedido)"; sleep 3
precisa "^Selecionar cliente" "Selecionar cliente"; sleep 3
precisa "^Teste Tcc$" "cliente Teste Tcc"; sleep 3
precisa "Aumentar quantidade de .gua Sanit.ria 5L$" "+ Água Sanitária 5L"; sleep 2
precisa "Aumentar quantidade de Cloro 5L$" "+ Cloro 5L"; sleep 8
precisa "REVISAR PEDIDO" "Revisar pedido"; sleep 6
[ -n "$(acha '^Teste Tcc$')" ] || aborta "a revisão não mostra o cliente Teste Tcc"
precisa "FINALIZAR LAN.AMENTO" "Finalizar lançamento (salva o pedido)"; sleep 8

log "PASSO 6: nova rota com o pedido de teste"
aba ROTAS; sleep 3
precisa "\+ Nova rota" "+ Nova rota"; sleep 3
precisa "^Teste Tcc" "pedido do Teste Tcc"; sleep 3
precisa "criar rota com 1 pedido" "Criar rota com 1 pedido"; sleep 8

log "PASSO 7: iniciar a rota"
[ -n "$(acha 'Teste Tcc')" ] || aborta "a tela da rota não mostra o Teste Tcc"
precisa "INICIAR ROTA" "Iniciar rota"; sleep 10
MAPA=$(acha "Google Map"); [ -z "$MAPA" ] && MAPA="540 600"
read MX MY <<< "$MAPA"
log "PASSO 7b: 30 s mexendo no mapa (centro $MX,$MY)"
FIM=$(( $(date +%s) + 30 ))
while [ "$(date +%s)" -lt "$FIM" ]; do
  swipe "$MX" "$MY" $((MX + 250)) "$MY" 400; sleep 1; swipe $((MX + 250)) "$MY" "$MX" "$MY" 400; sleep 1
  swipe "$MX" "$MY" "$MX" $((MY + 150)) 400; sleep 1; swipe "$MX" $((MY + 150)) "$MX" "$MY" 400; sleep 1
done
log "PASSO 7c: 150 s parado na tela da rota"
sleep 150

log "PASSO 8: limpeza (cancelar a rota e arquivar o pedido de teste)"
[ -n "$(acha 'Teste Tcc')" ] || aborta "antes de cancelar: a tela não mostra o Teste Tcc"
precisa "CANCELAR ROTA" "Cancelar rota"; sleep 3
precisa "id:android:id/button1" "confirmar o cancelamento"; sleep 6
aba PEDIDOS; sleep 3
precisa "Buscar por cliente" "busca de pedidos"; sleep 1; texto "Teste"; sleep 3
# Com o teclado aberto, o 1º toque na lista só fecha o teclado (padrão do React Native); o 2º abre o pedido.
toca "itens . [0-9]+ unidade" "pedido do Teste Tcc (fecha o teclado)"; sleep 2
precisa "itens . [0-9]+ unidade" "pedido do Teste Tcc"; sleep 4
[ -n "$(acha '^ETAPA [12]/2$')" ] || aborta "o pedido não abriu"
[ -n "$(acha '^Teste Tcc')" ] || aborta "antes de arquivar: o pedido não é do Teste Tcc"
[ -n "$(acha 'REVISAR PEDIDO')" ] && { precisa "REVISAR PEDIDO" "Revisar pedido"; sleep 4; }
swipe 540 1800 540 700 400; sleep 2; swipe 540 1800 540 700 400; sleep 2
precisa "ARQUIVAR PEDIDO" "Arquivar pedido"; sleep 3
[ -n "$(acha '^Arquivar pedido$')" ] || aborta "a confirmação não é de arquivamento"
precisa "id:android:id/button1" "confirmar o arquivamento"; sleep 6

log "PASSO 9: sair do app e esperar 15 s"
tecla KEYCODE_HOME; sleep 15
restaura
kill $LOGCAT_PID 2>/dev/null
log "FIM DO ROTEIRO"
