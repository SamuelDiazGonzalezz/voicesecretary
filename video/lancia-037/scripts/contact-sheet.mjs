// Hoja de contactos del MP4 final: un fotograma cada 1,5 s en una rejilla de 6 × 5.
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'out', 'lancia-037.mp4');
const dst = path.join(root, 'out', 'hoja-de-contactos.jpg');
execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf',
  "fps=1/1.5,scale=300:533,tile=6x5:padding=8:margin=8:color=0x222222", '-frames:v', '1', '-q:v', '2', dst]);
console.log('hoja ->', dst);
