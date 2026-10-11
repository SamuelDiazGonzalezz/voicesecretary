// Render cuadro a cuadro con Chromium headless + ffmpeg.
//   node render/render.mjs --w 1920 --h 1080 --out out/video.mp4 [--workers 3] [--mb 5]
//   node render/render.mjs --stills 0.6,12.5,30 --w 1920 --h 1080   (fotogramas sueltos a out/stills)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1920), H = +arg('h', 1080), FPS = +arg('fps', 60), DUR = +arg('dur', 50);
const WORKERS = +arg('workers', 3), MB = +arg('mb', 5);
const OUT = path.resolve(ROOT, arg('out', `out/gacmark_showreel_${W}x${H}_${FPS}fps.mp4`));
const STILLS = arg('stills', null);
const FROM = +arg('from', 0), TO = +arg('to', Math.round(DUR * FPS));
const url = `file://${ROOT}/src/index.html?render=1&w=${W}&h=${H}&fps=${FPS}&mb=${MB}`;

const browser = await pw.chromium.launch({
  executablePath: fs.existsSync('/opt/pw-browsers/chromium') ? undefined : undefined,
  args: ['--disable-gpu-vsync', '--allow-file-access-from-files', '--force-color-profile=srgb'],
});

async function openPage() {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('PAGEERROR', e));
  page.on('console', m => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.__ready);
  return page;
}
const shot = page => page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: W, height: H } });

if (STILLS) {
  const page = await openPage();
  const dir = path.join(ROOT, 'out/stills'); fs.mkdirSync(dir, { recursive: true });
  for (const s of STILLS.split(',')) {
    const f = Math.round(+s * FPS);
    const t0 = Date.now();
    await page.evaluate(f => window.renderFrame(f), f);
    const buf = await shot(page);
    const file = path.join(dir, `${W}x${H}_${(+s).toFixed(3)}.png`);
    fs.writeFileSync(file, buf);
    console.log(file, Date.now() - t0, 'ms');
  }
  await browser.close();
  process.exit(0);
}

// vídeo: cada worker renderiza un tramo contiguo y lo codifica sin pérdidas visibles
const total = TO - FROM;
const per = Math.ceil(total / WORKERS);
const tmp = path.join(ROOT, 'out/tmp'); fs.mkdirSync(tmp, { recursive: true });
const t0 = Date.now();
let done = 0;
const parts = await Promise.all(Array.from({ length: WORKERS }, async (_, k) => {
  const a = FROM + k * per, b = Math.min(TO, a + per);
  const file = path.join(tmp, `part_${W}x${H}_${k}.mp4`);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '10', '-pix_fmt', 'yuv420p', '-r', String(FPS), file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const page = await openPage();
  for (let f = a; f < b; f++) {
    await page.evaluate(f => window.renderFrame(f), f);
    const buf = await shot(page);
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    done++;
    if (done % 60 === 0) {
      const el = (Date.now() - t0) / 1000;
      console.log(`${done}/${total} cuadros  ${el.toFixed(0)} s  ETA ${(el / done * (total - done)).toFixed(0)} s`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await page.close();
  return file;
}));
await browser.close();
const list = path.join(tmp, `list_${W}x${H}.txt`);
fs.writeFileSync(list, parts.map(p => `file '${p}'`).join('\n'));
const audio = path.join(ROOT, 'out/music.wav');
const run = a => new Promise((res, rej) => { const p = spawn('ffmpeg', a, { stdio: 'inherit' }); p.on('close', c => c ? rej(new Error('ffmpeg ' + c)) : res()); });
await run(['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-i', audio,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', String(arg('crf', 17)), '-maxrate', '13M', '-bufsize', '26M', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
  '-r', String(FPS), '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-t', String(DUR), OUT]);
console.log('OK', OUT, ((Date.now() - t0) / 1000).toFixed(0), 's');
