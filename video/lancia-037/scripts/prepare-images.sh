#!/usr/bin/env bash
# Reescala las fotos con Lanczos y una máscara de enfoque suave, y aplica un etalonaje común.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img
grade="eq=contrast=1.06:saturation=1.07:gamma=0.98"
up() { ffmpeg -v error -y -i "assets/img/$1" -vf "scale=iw*$2:ih*$2:flags=lanczos,unsharp=5:5:0.6:5:5:0.0,$grade" -q:v 1 "build/img/$1"; }
up salon.jpg 1.5
up pista.jpg 2
up stand-martini.jpg 3
up motor-maqueta.jpg 1.5
cp assets/img/evo-heritage-logo.png build/img/logo.png
