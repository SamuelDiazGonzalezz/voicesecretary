// Hoja de contactos del MP4 final (vertical): un fotograma cada 2 s en una rejilla de 11 × 2.
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(root, 'out', 'promo-evoheritage.mp4'), '-vf',
  'fps=1/2,scale=216:384,tile=11x2:padding=8:margin=8:color=0x222222', '-frames:v', '1', '-q:v', '2',
  path.join(root, 'out', 'hoja-de-contactos.jpg')]);
console.log('hoja -> out/hoja-de-contactos.jpg');
