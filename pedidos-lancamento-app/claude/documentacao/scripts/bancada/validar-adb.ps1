param(
  [int]$CpuSeconds = 60,
  [int]$MemSamples = 6,
  [int]$MemIntervalSec = 10,
  [string]$Saida = 'C:\dev\tcc-ferramentas\validacao'
)
# Validação do instrumento (doc, seção 4.6): referências do Android lidas pelo adb, fora do app.
# Depois, rode bancada/analisar-validacao.js para comparar com as métricas perf.* do Sentry.
$ErrorActionPreference = 'Stop'
$adb = Join-Path $env:LOCALAPPDATA 'Android\Sdk\platform-tools\adb.exe'
$out = $Saida
New-Item -ItemType Directory -Force -Path $out | Out-Null

$appPid = "$(& $adb shell pidof com.example.pedidoslancamento)".Trim()
if (-not $appPid) { throw 'App nao esta rodando no aparelho.' }

$info = @(
  "PID=$appPid"
  "CLK_TCK=$("$(& $adb shell getconf CLK_TCK)".Trim())"
  "NPROC=$("$(& $adb shell nproc)".Trim())"
  "INICIO_APARELHO=$("$(& $adb shell date +%s.%N)".Trim())"
  "INICIO_PC=$([DateTimeOffset]::Now.ToUnixTimeMilliseconds() / 1000)"
)
$info | Set-Content -Encoding utf8 (Join-Path $out 'info.txt')
$info

# Fase A: CPU a cada 1 s lendo /proc/<pid>/stat (mesma fonte do top), com o relogio do aparelho.
Write-Output "Fase A: CPU por $CpuSeconds s..."
$cpuCmd = 'for i in $(seq 1 ' + $CpuSeconds + '); do echo T $(date +%s.%N); cat /proc/' + $appPid + '/stat; sleep 1; done'
& $adb shell $cpuCmd | Set-Content -Encoding utf8 (Join-Path $out 'cpu_procstat.txt')

# Fase B: memoria via dumpsys meminfo (faz o proprio app trabalhar, por isso fica separada da fase A).
Write-Output "Fase B: memoria, $MemSamples leituras a cada $MemIntervalSec s..."
$memFile = Join-Path $out 'meminfo.txt'
Set-Content -Encoding utf8 -Path $memFile -Value ''
for ($i = 0; $i -lt $MemSamples; $i++) {
  Add-Content -Encoding utf8 -Path $memFile -Value "T $("$(& $adb shell date +%s.%N)".Trim())"
  & $adb shell dumpsys meminfo $appPid | Add-Content -Encoding utf8 -Path $memFile
  Start-Sleep -Seconds $MemIntervalSec
}
Write-Output "FIM_APARELHO=$("$(& $adb shell date +%s.%N)".Trim())"
Write-Output 'VALIDACAO_CAPTURADA'
