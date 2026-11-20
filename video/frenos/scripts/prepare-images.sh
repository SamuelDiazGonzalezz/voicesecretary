#!/usr/bin/env bash
# Prepara las fotos del cliente y extrae los tramos del onboard (a 30 fps; la cámara lenta funde fotogramas).
# Del onboard solo se usa la imagen 4:3 central (sin las bandas desenfocadas) y se recorta la franja inferior derecha,
# donde va la marca de agua del distribuidor.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img build/clip
for f in assets/img/*; do
  n=$(basename "${f%.*}")
  [ "$n" = "logo" ] && { cp "$f" build/img/logo.png; continue; }
  ffmpeg -v error -y -i "$f" -vf "scale='if(lt(ih,1300),-2,iw)':'if(lt(ih,1300),1300,ih)':flags=lanczos,unsharp=5:5:0.6:5:5:0.0,eq=contrast=1.04:saturation=1.03" -q:v 2 "build/img/$n.jpg"
done
python3 -I - <<'PY'
import json, subprocess, os
for k, v in json.load(open('scripts/clips.json')).items():
    os.makedirs(f'build/clip/{k}', exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(v['from']), '-t', str(v['dur']), '-i', 'assets/clip/onboard.mp4',
                    '-vf', 'crop=440:316:80:0,scale=1600:-2:flags=lanczos,unsharp=5:5:0.5:5:5:0.0,fps=30,eq=contrast=1.05:saturation=1.06', '-q:v', '3', f'build/clip/{k}/f%03d.jpg'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(v['from']), '-t', str(v['dur']), '-i', 'assets/clip/onboard.mp4',
                    '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', f'build/clip/{k}.wav'], check=True)
    print(k, len(os.listdir(f'build/clip/{k}')))
PY
