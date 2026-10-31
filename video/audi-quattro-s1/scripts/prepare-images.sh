#!/usr/bin/env bash
# Recortes, reescalado Lanczos con enfoque suave y etalonaje común para todas las fotos.
# Las fotos opcionales (las que faltan) se omiten: el montaje usa su alternativa.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p build/img
grade="eq=contrast=1.07:saturation=1.05:gamma=0.97"
prep() { # origen destino filtro-de-recorte escala
  [ -f "assets/img/$1" ] || { echo "falta $1 (se usará la alternativa)"; return; }
  ffmpeg -v error -y -i "assets/img/$1" -vf "$3scale=iw*$4:ih*$4:flags=lanczos,unsharp=5:5:0.55:5:5:0.0,$grade" -q:v 1 "build/img/$2"
}
prep hero-roc.jpg hero.jpg "" 1
prep vano-motor.jpg vano.jpg "" 1.2
# El despiece lleva logotipo y rótulo impresos: se recorta solo el coche.
prep cutaway.jpg cutaway.jpg "crop=940:585:60:120," 2
# Composición de dos fotos: arriba el quattro de calle, abajo el motor.
prep quattro-y-motor.jpg quattro-calle.jpg "crop=495:314:0:0," 3
prep quattro-y-motor.jpg motor-5c.jpg "crop=495:296:0:322," 3
prep render-blanco.png render.jpg "" 4
# Fotos de competición (opcionales).
prep rally-tierra.jpg rally-tierra.jpg "" 1.6
prep nocturna.jpg nocturna.jpg "" 3
prep rohrl-cockpit.jpg rohrl.jpg "" 2.6
prep curva-publico.jpg curva.jpg "" 2.8
prep tramo-polvo.jpg tramo.jpg "" 2
cp assets/img/evo-heritage-logo.png build/img/logo.png
