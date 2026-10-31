#!/usr/bin/env bash
# Reescala las fotos con Lanczos y una máscara de enfoque suave, y aplica un etalonaje común.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img
grade="eq=contrast=1.06:saturation=1.06:gamma=0.98"
up() { ffmpeg -v error -y -i "assets/img/$1.jpg" -vf "scale=iw*$3:ih*$3:flags=lanczos,unsharp=5:5:0.55:5:5:0.0,$grade" -q:v 1 "build/img/$2.jpg"; }
up polvo-publico polvo 1.9
up piloto-agachado agachado 2
up shell-publico shell 1.5
ffmpeg -v error -y -i assets/img/despiece.jpg -vf "crop=1896:1080:12:0,$grade" -q:v 1 build/img/despiece.jpg
up almeja almeja 1.5
up arbol-polvo arbol 1.6
up nieve nieve 1.2
up habitaculo habitaculo 1.5
up piloto-volante volante 2.9
up calle-gris calle 1.5
up numero4-publico n4 2.6
up salonen salonen 2
cp assets/img/evo-heritage-logo.png build/img/logo.png
