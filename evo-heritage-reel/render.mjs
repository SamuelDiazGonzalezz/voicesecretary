// Renderizador offline: sirve el proyecto, abre Chromium headless (WebGL por SwiftShader),
// llama a renderFrame(t) frame a frame y envía los PNG a ffmpeg.
// Uso: node render.mjs --w 3840 --h 2160 --from 0 --to 600 --out out/video.mp4 [--every 1] [--stills out/stills]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const W = +(args.w || 3840), H = +(args.h || 2160);
const TL = JSON.parse(fs.readFileSync('timeline.json', 'utf8'));
const FROM = +(args.from || 0), TO = +(args.to || TL.fps * TL.duration), EVERY = +(args.every || 1);
const ROOT = path.resolve('.');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.otf': 'font/otf', '.ttf': 'font/ttf' };

const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/index.html?w=${W}&h=${H}`);
await page.waitForFunction(() => window.ready || window.initError, null, { timeout: 120000 });
const err = await page.evaluate(() => window.initError);
if (err) { console.error(err); process.exit(1); }

let ff = null;
if (args.out) {
  ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(TL.fps / EVERY), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', args.preset || 'slow', '-crf', args.crf || '14', '-pix_fmt', 'yuv420p', '-tune', 'film', args.out], { stdio: ['pipe', 'inherit', 'inherit'] });
}
if (args.stills) fs.mkdirSync(args.stills, { recursive: true });
const t0 = Date.now();
const LIST = args.times ? args.times.split(',').map((x) => Math.round(+x * TL.fps)) : null;
const frames = LIST || Array.from({ length: Math.ceil((TO - FROM) / EVERY) }, (_, i) => FROM + i * EVERY);
for (const f of frames) {
  const t = f / TL.fps;
  const b64 = await page.evaluate((t) => { window.renderFrame(t); return document.querySelector('canvas').toDataURL('image/png').split(',')[1]; }, t);
  const buf = Buffer.from(b64, 'base64');
  if (args.stills) fs.writeFileSync(path.join(args.stills, `f${String(f).padStart(4, '0')}.png`), buf);
  if (ff && !ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
  const done = frames.indexOf(f) + 1, total = frames.length;
  if (done % 10 === 0 || done === total) process.stdout.write(`frame ${f} (${done}/${total}) ${((Date.now() - t0) / done / 1000).toFixed(2)} s/frame\n`);
}
if (ff) { ff.stdin.end(); await new Promise((r) => ff.on('close', r)); }
await browser.close(); server.close();
