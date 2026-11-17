#!/usr/bin/env bash
# Re-renderiza tramos concretos y los empalma en out/render-60fps.mp4 sin volver a renderizar todo.
# Uso: scripts/splice.sh desde1 hasta1 [desde2 hasta2 ...]   (tiempos en la rejilla de fotogramas)
set -euo pipefail
cd "$(dirname "$0")/.."
src=out/tmp/render-base.mp4
[ -f "$src" ] || mv out/render-60fps.mp4 "$src"
args=(); filt=""; n=0; prev=0
seg=0
while [ $# -gt 0 ]; do
  a=$1; b=$2; shift 2
  node scripts/render.mjs --fps 60 --from "$a" --to "$b" --out "out/tmp/seg$seg.mp4" | tail -1
  args+=(-ss "$prev" -t "$(python3 -c "print($a-$prev)")" -i "$src" -i "out/tmp/seg$seg.mp4")
  filt+="[$n:v]setpts=PTS-STARTPTS[v$n];[$((n+1)):v]setpts=PTS-STARTPTS[v$((n+1))];"
  n=$((n+2)); prev=$b; seg=$((seg+1))
done
args+=(-ss "$prev" -i "$src")
filt+="[$n:v]setpts=PTS-STARTPTS[v$n];"
for k in $(seq 0 $n); do filt+="[v$k]"; done
filt+="concat=n=$((n+1)):v=1[v]"
ffmpeg -v error -y "${args[@]}" -filter_complex "$filt" -map "[v]" -c:v libx264 -preset fast -crf 10 -pix_fmt yuv444p -r 60 out/render-60fps.mp4
ffprobe -v error -count_frames -show_entries stream=nb_read_frames -of csv=p=0 out/render-60fps.mp4
