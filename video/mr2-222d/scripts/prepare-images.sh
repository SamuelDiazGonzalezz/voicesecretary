#!/usr/bin/env bash
# Reescala las fotos con Lanczos y una máscara de enfoque suave, aplica un etalonaje común y
# extrae los 9 primeros segundos del clip del cliente (fotogramas y sonido).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img build/clip
grade="eq=contrast=1.06:saturation=1.03:gamma=0.98"
up() { ffmpeg -v error -y -i "assets/img/$1.jpg" -vf "scale=iw*$3:ih*$3:flags=lanczos,unsharp=5:5:0.5:5:5:0.0,$grade" -q:v 1 "build/img/$2.jpg"; }
up celica celica 1.6
up museo-frente museoFrente 1.2
up habitaculo habitaculo 1.2
up puerta puerta 1.2
up calles-grupo-b callesB 1.9
up fia fia 1.6
up coleccion coleccion 1.1
up trasera trasera 3
up cenital cenital 2.8
up peugeot peugeot 1.2
up plano plano 2.2
up lateral lateral 1.9
up zaga zaga 1.9
up mr2-rayosx mr2 1.0
up escondido escondido 2.6
cp assets/img/evo-heritage-logo.png build/img/logo.png
ffmpeg -v error -y -t 9 -i assets/clip/mr2-222d.mp4 -vf "scale=1280:746:flags=lanczos,unsharp=5:5:0.5:5:5:0.0,eq=contrast=1.05:saturation=1.05" -q:v 2 build/clip/f%03d.jpg
ffmpeg -v error -y -t 9 -i assets/clip/mr2-222d.mp4 -vn -ac 2 -ar 48000 -c:a pcm_f32le build/clip-audio.wav
