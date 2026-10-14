param(
  [string[]]$Ordem = @('A', 'B', 'A', 'B', 'B', 'A'),
  [int]$Pausa = 30,
  [int]$Estabilizacao = 60,
  [int]$Medicao = 180,
  [int]$MaxTentativas = 3,
  [string]$ApkA = 'C:\dev\apks\org-A-sem-medicao-14733be.apk',
  [string]$ApkB = 'C:\dev\apks\org-B-com-medicao-14733be.apk',
  [string]$Saida = 'C:\dev\tcc-ferramentas\rodadas-ab'
)
# Teste A/B de sobrecarga (doc, seção 4.7): instala A ou B, abre a frio e mede CPU/RSS de fora do app pelo adb.
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$pkg = 'com.example.pedidoslancamento'
$out = $Saida
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Esperar-Aparelho([int]$TimeoutSeg = 600) {
  $fim = (Get-Date).AddSeconds($TimeoutSeg)
  while ((Get-Date) -lt $fim) {
    if ("$(& $adb get-state 2>$null)".Trim() -eq 'device') { return $true }
    Start-Sleep -Seconds 5
  }
  return $false
}

# Resultado da rodada fica em $script:valida (a função não devolve valor, só registra).
function Executar-Rodada([int]$n, [string]$b) {
  $script:valida = $false
  $prefix = Join-Path $out ("r{0}_{1}" -f $n, $b)
  if (-not (Esperar-Aparelho)) { Write-Host "rodada ${n}: aparelho nao voltou em 10 min"; return }
  & $adb shell svc power stayon usb 2>$null | Out-Null

  $apk = $(if ($b -eq 'A') { $ApkA } else { $ApkB })
  $inst = & $adb install -r --user 0 $apk 2>&1 | Out-String
  if ($inst -notmatch 'Success') { Write-Host "rodada ${n}: falha na instalacao: $($inst.Trim())"; return }
  & $adb shell am force-stop $pkg 2>$null | Out-Null
  Start-Sleep -Seconds $Pausa
  & $adb shell monkey -p $pkg -c android.intent.category.LAUNCHER 1 2>$null | Out-Null
  Start-Sleep -Seconds $Estabilizacao

  $appPid = "$(& $adb shell pidof $pkg 2>$null)".Trim()
  if (-not $appPid) { Write-Host "rodada ${n}: app nao esta rodando apos abrir"; return }
  $foco = "$(& $adb shell dumpsys activity activities 2>$null | Select-String 'topResumedActivity|mResumedActivity' | Select-Object -First 1)".Trim()
  $termico = "$(& $adb shell dumpsys thermalservice 2>$null | Select-String 'Thermal Status' | Select-Object -First 1)".Trim()
  $bateria = "$(& $adb shell dumpsys battery 2>$null | Select-String '^\s*level' | Select-Object -First 1)".Trim()
  $inicio = "$(& $adb shell date +%s.%N 2>$null)".Trim()
  $info = "rodada=$n build=$b pid=$appPid inicio=$inicio foco=[$foco] termico=[$termico] bateria=[$bateria]"
  Set-Content -Encoding utf8 -Path "${prefix}_info.txt" -Value $info

  # CPU a cada 1 s e RSS a cada 10 s, lidos de /proc pelo shell (fora do app).
  $cmd = 'for i in $(seq 1 ' + $Medicao + '); do echo T $(date +%s.%N); cat /proc/' + $appPid + '/stat; ' +
    'if [ $((i % 10)) -eq 0 ]; then grep VmRSS /proc/' + $appPid + '/status; fi; sleep 1; done'
  & $adb shell $cmd 2>$null | Set-Content -Encoding utf8 -Path "${prefix}_cpu.txt"
  $segundos = @(Select-String -Path "${prefix}_cpu.txt" -Pattern '^T ').Count

  # PSS uma vez no final: o dumpsys faz o app trabalhar, por isso fica fora da janela de CPU.
  & $adb shell dumpsys meminfo $appPid 2>$null | Set-Content -Encoding utf8 -Path "${prefix}_meminfo.txt"
  $pidDepois = "$(& $adb shell pidof $pkg 2>$null)".Trim()

  $script:valida = ($segundos -ge ($Medicao - 5)) -and ($pidDepois -eq $appPid) -and ($foco -match 'pedidoslancamento')
  Write-Host "rodada $n concluida: build=$b segundos=$segundos pid=$appPid/$pidDepois foco=$($foco -match 'pedidoslancamento') valida=$($script:valida)"
}

try {
  for ($i = 0; $i -lt $Ordem.Count; $i++) {
    $n = $i + 1
    $b = $Ordem[$i]
    for ($t = 1; $t -le $MaxTentativas; $t++) {
      Write-Host "=== Rodada $n (build $b), tentativa $t ==="
      Executar-Rodada $n $b
      if ($script:valida) { break }
      Write-Host "rodada $n invalida, repetindo"
    }
  }
}
finally {
  if (Esperar-Aparelho 60) { & $adb shell svc power stayon false 2>$null | Out-Null; Write-Host 'tela sempre ligada: desativada' }
  else { Write-Host 'ATENCAO: aparelho desconectado, desative Permanecer ativo manualmente' }
  Write-Host 'RODADAS_CONCLUIDAS'
}
