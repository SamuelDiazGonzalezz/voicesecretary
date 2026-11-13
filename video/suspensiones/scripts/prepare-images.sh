#!/usr/bin/env bash
# Prepara las fotos del cliente (escala, nitidez y grado suave) y extrae los tramos de saltos del vídeo de Polonia 2015.
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
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(v['from']), '-t', str(v['dur']), '-i', 'assets/clip/saltos.mp4',
                    '-vf', 'eq=contrast=1.04:saturation=1.05', '-q:v', '3', f'build/clip/{k}/f%03d.jpg'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(v['from']), '-t', str(v['dur']), '-i', 'assets/clip/saltos.mp4',
                    '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', f'build/clip/{k}.wav'], check=True)
    print(k, len(os.listdir(f'build/clip/{k}')))
PY
