# Compila e grava o firmware na ESP32-CAM e abre o monitor serial.
# Uso: npm run cam:gravar            (porta padrão COM6)
#      npm run cam:monitor           (só abre o monitor serial)
#      npm run cam:gravar -- COM3    (outra porta)
param([string]$Porta = "COM6", [switch]$SoMonitor)

$ErrorActionPreference = "Stop"
$pasta = $PSScriptRoot
$cli = "$env:LOCALAPPDATA\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe"
if (-not (Test-Path $cli)) { $cli = "arduino-cli" }

if ($SoMonitor) {
  & $cli monitor --port $Porta --config baudrate=115200,dtr=off,rts=off
  exit $LASTEXITCODE
}

if (-not (Test-Path "$pasta\secrets.h")) {
  Write-Host "Crie firmware\esp32-cam\secrets.h a partir de secrets.example.h (nome e senha do Wi-Fi)." -ForegroundColor Red
  exit 1
}

Write-Host "Compilando..." -ForegroundColor Cyan
& $cli compile --fqbn esp32:esp32:esp32cam --build-path "$env:TEMP\provador-esp32cam-build" $pasta
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Gravando na $Porta... (se ficar em 'Connecting...', segure IO0, toque em RST e solte IO0)" -ForegroundColor Cyan
& $cli upload --fqbn esp32:esp32:esp32cam --port $Porta --input-dir "$env:TEMP\provador-esp32cam-build" $pasta
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Abrindo monitor serial (Ctrl+C para sair). Toque em RST se nada aparecer." -ForegroundColor Cyan
& $cli monitor --port $Porta --config baudrate=115200,dtr=off,rts=off
