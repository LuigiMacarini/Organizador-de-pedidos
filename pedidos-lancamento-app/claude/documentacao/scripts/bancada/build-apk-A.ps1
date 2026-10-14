param([string]$Saida = 'C:\dev\apks\org-A-sem-medicao.apk')
# Gera a build A do teste de sobrecarga (doc, seção 4.7) a partir da cópia C:\dev\org: sem DSN, o Sentry fica
# inerte e o coletor não liga. O .env original é restaurado no fim, mesmo se a build falhar.
$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_HOME = $sdk
$env:Path = "$sdk\platform-tools;$sdk\cmdline-tools\latest\bin;$env:Path"
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
$env:CI = '1'
$env:GRADLE_OPTS = '-Dorg.gradle.daemon=false'

$app = 'C:\dev\org\pedidos-lancamento-app'
$envFile = Join-Path $app '.env'
$backup = Join-Path $env:TEMP 'org-env-com-dsn.bak'   # backup com segredos: fora de qualquer repositório
Copy-Item $envFile $backup -Force

try {
  # Build A: sem DSN, então o Sentry fica inerte e o coletor não liga.
  $lines = Get-Content $envFile | Where-Object { $_ -notmatch '^\s*EXPO_PUBLIC_SENTRY_DSN\s*=' }
  [IO.File]::WriteAllLines($envFile, $lines)
  Write-Output "DSN removido do .env da copia: $(-not (Select-String -Path $envFile -Pattern 'EXPO_PUBLIC_SENTRY_DSN' -Quiet))"

  # O Metro grava no cache o código já com as variáveis EXPO_PUBLIC_* embutidas;
  # sem limpar, ele reaproveitaria o _layout.tsx transformado com o DSN.
  Remove-Item (Join-Path $env:TEMP 'metro-cache') -Recurse -Force -ErrorAction SilentlyContinue
  Write-Output "cache do Metro limpo antes: $(-not (Test-Path (Join-Path $env:TEMP 'metro-cache')))"

  Set-Location (Join-Path $app 'android')
  # --rerun obriga a regerar o bundle JS (sem ele o Gradle reaproveitaria o bundle com DSN).
  & .\gradlew.bat app:createBundleReleaseJsAndAssets --rerun app:assembleRelease -x lint -x test
  $code = $LASTEXITCODE
  Write-Output "GRADLE_EXIT=$code"
  if ($code -eq 0) {
    Copy-Item 'app\build\outputs\apk\release\app-release.apk' $Saida -Force
    Write-Output 'APK_A_OK'
  }
}
finally {
  # Limpa de novo para que a próxima build (com DSN) não reaproveite o código sem DSN.
  Remove-Item (Join-Path $env:TEMP 'metro-cache') -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item $backup $envFile -Force
  Write-Output "ENV_RESTAURADO: $(Select-String -Path $envFile -Pattern 'EXPO_PUBLIC_SENTRY_DSN' -Quiet)"
}
