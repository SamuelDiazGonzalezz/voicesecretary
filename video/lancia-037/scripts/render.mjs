// Renderiza el spot fotograma a fotograma con Chromium sin interfaz y lo codifica con ffmpeg.
// Uso: node scripts/render.mjs [--stills t1,t2,...] [--fps 60] [--out out/video.mp4] [--from 0 --to 45]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright-core';
import { W, H, DURATION } from '../src/timeline.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const fps = Number(arg('--fps', 60));
const out = path.resolve(root, arg('--out', 'out/render-60fps.mp4'));
const from = Number(arg('--from', 0));
const to = Number(arg('--to', DURATION));
const stills = arg('--stills', null);
const workers = Number(arg('--workers', 3));

const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.jpg': 'image/jpeg', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] ?? 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const url = `http://127.0.0.1:${server.address().port}/src/index.html?still`;

const browser = await chromium.launch({
  args: ['--disable-gpu-vsync', '--force-color-profile=srgb', '--font-render-hinting=none'],
});

async function openPage() {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => { console.error('pageerror', e); process.exit(1); });
  page.on('console', (m) => { if (m.type() === 'error') console.error('console', m.text()); });
  await page.goto(url);
  await page.evaluate(() => window.ready);
  return page;
}

const grab = (page, t) => page.evaluate(async (tt) => {
  window.seek(tt);
  const blob = await new Promise((ok) => window.canvas.toBlob(ok, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return btoa(s);
}, t);

if (stills) {
  const page = await openPage();
  const dir = path.resolve(root, arg('--dir', 'out/stills'));
  fs.mkdirSync(dir, { recursive: true });
  for (const s of stills.split(',')) {
    const t = Number(s);
    fs.writeFileSync(path.join(dir, `t${t.toFixed(2).padStart(5, '0')}.png`), Buffer.from(await grab(page, t), 'base64'));
  }
  console.log('stills ->', dir);
} else {
  const n = Math.round((to - from) * fps);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '10', '-pix_fmt', 'yuv444p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const pages = await Promise.all(Array.from({ length: workers }, openPage));
  const pending = new Map();
  let next = 0, written = 0;
  const t0 = Date.now();
  const flush = async () => {
    while (pending.has(written)) {
      const buf = pending.get(written);
      pending.delete(written);
      if (!ff.stdin.write(buf)) await new Promise((ok) => ff.stdin.once('drain', ok));
      written++;
      if (written % (fps * 2) === 0) console.log(`${written}/${n} · ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    }
  };
  await Promise.all(pages.map(async (page) => {
    while (next < n) {
      const i = next++;
      pending.set(i, Buffer.from(await grab(page, from + i / fps), 'base64'));
      // Evita acumular demasiados fotogramas en memoria.
      while (pending.size > 40 && !pending.has(written)) await new Promise((ok) => setTimeout(ok, 5));
      await flush();
    }
  }));
  await flush();
  ff.stdin.end();
  await new Promise((ok) => ff.on('close', ok));
  console.log('video ->', out, `${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
server.close();
