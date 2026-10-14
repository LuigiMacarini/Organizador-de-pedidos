# Reproduz a falha do EAS sem compilar: --dry-run só monta o grafo de tarefas (nada é executado nem enviado).
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_HOME = $sdk
$env:CI = '1'
$env:GRADLE_OPTS = '-Dorg.gradle.daemon=false'
Set-Location 'C:\dev\org\pedidos-lancamento-app\android'

foreach ($caso in @('sem_variavel', 'com_SENTRY_DISABLE_AUTO_UPLOAD')) {
  Remove-Item Env:SENTRY_DISABLE_AUTO_UPLOAD -ErrorAction SilentlyContinue
  Remove-Item Env:SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD -ErrorAction SilentlyContinue
  if ($caso -eq 'com_SENTRY_DISABLE_AUTO_UPLOAD') { $env:SENTRY_DISABLE_AUTO_UPLOAD = 'true' }
  Write-Output "=== CASO $caso ==="
  & .\gradlew.bat app:assembleRelease -x lint -x test --dry-run 2>&1 |
    Select-String -Pattern 'What went wrong|Could not create task|setIgnoreExitValue|BUILD SUCCESSFUL|BUILD FAILED|uploadSentry' |
    ForEach-Object { $_.Line }
  Write-Output "EXIT_$caso=$LASTEXITCODE"
}
Write-Output 'DRYRUN_CONCLUIDO'
