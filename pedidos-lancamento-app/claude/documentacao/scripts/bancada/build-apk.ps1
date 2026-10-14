$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$env:ANDROID_HOME = $sdk
$env:Path = "$sdk\platform-tools;$sdk\cmdline-tools\latest\bin;$env:Path"
$env:SENTRY_DISABLE_AUTO_UPLOAD = 'true'
$env:CI = '1'
$env:GRADLE_OPTS = '-Dorg.gradle.daemon=false'

Set-Location 'C:\dev\org\pedidos-lancamento-app\android'
& .\gradlew.bat app:assembleRelease -x lint -x test --build-cache
$gradleExit = $LASTEXITCODE
Write-Output "GRADLE_EXIT=$gradleExit"

if ($gradleExit -eq 0) {
  $adb = Join-Path $sdk 'platform-tools\adb.exe'
  & $adb install --user 0 -r 'app\build\outputs\apk\release\app-release.apk'
  Write-Output "INSTALL_EXIT=$LASTEXITCODE"
  & $adb shell monkey -p com.example.pedidoslancamento -c android.intent.category.LAUNCHER 1 | Out-Null
  Write-Output 'LAUNCHED'
}
