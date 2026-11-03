#!/usr/bin/env bash
# Reescala las fotos con Lanczos y una máscara de enfoque suave, aplica un etalonaje común y
# extrae los fotogramas del clip del cliente (segundos 9 a 16) y su sonido.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img build/clip
grade="eq=contrast=1.06:saturation=1.05:gamma=0.98"
up() { ffmpeg -v error -y -i "assets/img/$1.jpg" -vf "scale=iw*$3:ih*$3:flags=lanczos,unsharp=5:5:0.55:5:5:0.0,$grade" -q:v 1 "build/img/$2.jpg"; }
up turbo-blanco turboBlanco 1.5
up llamas-205 llamas 2.7
up asistencia-roja asistencia 1.8
up mariposas mariposas 1.6
up asistencia-renault renault 1.8
up taller taller 1.5
up 205-abierto abierto 3.4
up vano-subaru vanoSubaru 1.2
up pedales pedales 4.1
up impreza-bosque bosque 2.4
up impreza-presentacion presentacion 3.2
up turbo-colector turboColector 3.5
cp assets/img/evo-heritage-logo.png build/img/logo.png
ffmpeg -v error -y -ss 9 -t 7 -i assets/clip/evo6-antilag.mp4 -vf "scale=1280:720:flags=lanczos,unsharp=5:5:0.5:5:5:0.0,eq=contrast=1.06:saturation=1.08" -q:v 2 build/clip/f%03d.jpg
ffmpeg -v error -y -ss 9 -t 7 -i assets/clip/evo6-antilag.mp4 -vn -ac 2 -ar 48000 -c:a pcm_f32le build/clip-audio.wav
