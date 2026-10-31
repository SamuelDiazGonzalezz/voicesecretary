// Hoja de contactos del MP4 final: un fotograma cada 5 s en una rejilla de 8 × 9.
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', path.join(root, 'out', 'peugeot-205-t16.mp4'), '-vf',
  'fps=1/5,scale=384:216,tile=8x9:padding=8:margin=8:color=0x222222', '-frames:v', '1', '-q:v', '2',
  path.join(root, 'out', 'hoja-de-contactos.jpg')]);
console.log('hoja -> out/hoja-de-contactos.jpg');
