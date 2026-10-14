param(
  [int]$MaxMinutos = 60,
  [string]$LogRodadas = 'C:\dev\tcc-ferramentas\rodadas-ab\rodadas.log'
)
# Reinicia o servidor do adb quando ele perde o aparelho, mas o Windows ainda enxerga a interface ADB.
# Para quando o log das rodadas (saída de rodadas-ab.ps1 redirecionada para $LogRodadas) registra RODADAS_CONCLUIDAS.
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$log = $LogRodadas
$fim = (Get-Date).AddMinutes($MaxMinutos)
while ((Get-Date) -lt $fim) {
  Start-Sleep -Seconds 10
  if ((Test-Path $log) -and (Select-String -Path $log -Pattern 'RODADAS_CONCLUIDAS' -Quiet)) { break }
  $st = "$(& $adb get-state 2>$null)".Trim()
  if ($st -ne 'device') {
    $usb = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -match 'ADB Interface' -and $_.Status -eq 'OK' }
    if ($usb) {
      & $adb kill-server 2>$null | Out-Null
      Start-Sleep -Seconds 2
      & $adb start-server 2>$null | Out-Null
      Start-Sleep -Seconds 3
      Write-Output "$(Get-Date -Format 'HH:mm:ss') adb reiniciado (estado era '$st', agora '$("$(& $adb get-state 2>$null)".Trim())')"
    }
  }
}
Write-Output 'VIGIA_ENCERRADO'
