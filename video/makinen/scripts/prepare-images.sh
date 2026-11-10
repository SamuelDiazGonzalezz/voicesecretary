#!/usr/bin/env bash
# Prepara las fotos del cliente (escala, nitidez y grado suave) y extrae los tramos del vídeo de archivo,
# recortados para dejar fuera la mosca de la cadena, la marca del usuario que lo subió y los rótulos.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img build/clip
for f in assets/img/*; do
  n=$(basename "${f%.*}")
  [ "$n" = "logo" ] && { cp "$f" build/img/logo.png; continue; }
  crop="iw:ih:0:0"
  [ "$n" = "escort1000lagos" ] && crop="iw:ih*0.63:0:0"   # solo la foto: fuera la tarjeta con firma y patrocinador
  ffmpeg -v error -y -i "$f" -vf "crop=$crop,scale='if(lt(ih,1300),-2,iw)':'if(lt(ih,1300),1300,ih)':flags=lanczos,unsharp=5:5:0.6:5:5:0.0,eq=contrast=1.04:saturation=1.03" -q:v 2 "build/img/$n.jpg"
done
# Tramos del vídeo de archivo (640×360): recorte fijo por tramo y escalado 2× con reducción de ruido suave.
python3 -I - <<'PY'
import json, subprocess, os
clips = json.load(open('scripts/clips.json'))
for k, v in clips.items():
    os.makedirs(f'build/clip/{k}', exist_ok=True)
    c = v['crop']
    vf = (f'crop={c[2]}:{c[3]}:{c[0]}:{c[1]},' if c else '') + 'scale=1280:720:flags=lanczos,hqdn3d=1.5:1.5:4:4,unsharp=5:5:0.5:5:5:0.0,eq=contrast=1.05:saturation=1.06'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(v['from']), '-t', str(v['dur']), '-i', 'assets/clip/makinen.mp4', '-vf', vf, '-q:v', '2', f'build/clip/{k}/f%03d.jpg'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(v['from']), '-t', str(v['dur']), '-i', 'assets/clip/makinen.mp4', '-vn', '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', f'build/clip/{k}.wav'], check=True)
    print(k, len(os.listdir(f'build/clip/{k}')), 'fotogramas')
PY
