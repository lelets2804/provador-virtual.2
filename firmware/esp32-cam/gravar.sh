#!/usr/bin/env bash
set -e

PASTA="$(cd "$(dirname "$0")" && pwd)"
BUILD="${TMPDIR:-/tmp}/provador-esp32cam-build"
FQBN="esp32:esp32:esp32cam"
MONITOR_CFG="baudrate=115200,dtr=off,rts=off"

SO_MONITOR=0
if [ "$1" = "--monitor" ]; then
  SO_MONITOR=1
  shift
fi
PORTA="${1:-/dev/ttyUSB0}"

if [ "$SO_MONITOR" = "1" ]; then
  exec arduino-cli monitor --port "$PORTA" --config "$MONITOR_CFG"
fi

if [ ! -f "$PASTA/secrets.h" ]; then
  echo "Crie firmware/esp32-cam/secrets.h a partir de secrets.example.h (nome e senha do Wi-Fi)." >&2
  exit 1
fi

echo "Compilando..."
arduino-cli compile --fqbn "$FQBN" --build-path "$BUILD" "$PASTA"

echo "Gravando na $PORTA... (se ficar em 'Connecting...', segure IO0, toque em RST e solte IO0)"
arduino-cli upload --fqbn "$FQBN" --port "$PORTA" --input-dir "$BUILD" "$PASTA"

echo "Abrindo monitor serial (Ctrl+C para sair). Toque em RST se nada aparecer."
arduino-cli monitor --port "$PORTA" --config "$MONITOR_CFG"