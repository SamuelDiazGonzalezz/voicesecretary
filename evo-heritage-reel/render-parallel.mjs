// Orquestador: reparte los frames en trozos contiguos entre N procesos de render.mjs
// (cada uno con su Chromium) y concatena los segmentos + audio en el MP4 final.
// Uso: node render-parallel.mjs --workers 3 --w 3840 --h 2160 --out out/evo-heritage-reel-4k.mp4
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
const total = TL.fps * TL.duration, n = +(args.workers || 3), W = args.w || 3840, H = args.h || 2160;
fs.mkdirSync('out/seg', { recursive: true });
execFileSync('python3', ['audio/synth.py', 'out/audio.wav'], { stdio: 'inherit' });
const chunk = Math.ceil(total / n);
const jobs = [];
for (let i = 0; i < n; i++) {
  const from = i * chunk, to = Math.min(total, from + chunk), seg = `out/seg/seg${i}.mp4`;
  jobs.push(new Promise((res, rej) => {
    const p = spawn('node', ['render.mjs', '--w', W, '--h', H, '--from', from, '--to', to, '--out', seg, '--crf', '8', '--preset', 'medium'], { stdio: ['ignore', 'pipe', 'inherit'] });
    p.stdout.on('data', (d) => process.stdout.write(`[w${i}] ${d}`));
    p.on('close', (c) => (c === 0 ? res(seg) : rej(new Error('worker ' + i + ' code ' + c))));
  }));
}
const segs = await Promise.all(jobs);
fs.writeFileSync('out/seg/list.txt', segs.map((s) => `file '${s.replace('out/seg/', '')}'`).join('\n'));
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', 'out/seg/list.txt', '-i', 'out/audio.wav',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', args.crf || '17', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-tune', 'film', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '320k', '-shortest', args.out || 'out/evo-heritage-reel-4k.mp4'], { stdio: 'inherit' });
console.log('listo:', args.out || 'out/evo-heritage-reel-4k.mp4');
