#!/usr/bin/env bash
# Copia las fotos (ya graduadas en los proyectos anteriores) y extrae el clip del Evo VI (segundos 9 a 16) y su sonido.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img build/clip
cp assets/img/*.jpg assets/img/logo.png build/img/
ffmpeg -v error -y -ss 9 -t 7 -i assets/clip/evo6-antilag.mp4 -vf "scale=1280:720:flags=lanczos,unsharp=5:5:0.5:5:5:0.0,eq=contrast=1.06:saturation=1.08" -q:v 2 build/clip/f%03d.jpg
ffmpeg -v error -y -ss 9 -t 7 -i assets/clip/evo6-antilag.mp4 -vn -ac 2 -ar 48000 -c:a pcm_f32le build/clip-audio.wav
echo "imágenes y clip listos"
