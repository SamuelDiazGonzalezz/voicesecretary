// Barrido rápido: evalúa seek(t) en los 3000 cuadros a baja resolución para cazar excepciones
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('/opt/node-tools/node_modules/playwright');
const [w, h] = (process.argv[2] || '480x270').split('x');
const b = await pw.chromium.launch();
const p = await b.newPage({ viewport: { width: +w, height: +h } });
await p.goto(`file://${process.cwd()}/src/index.html?render=1&mb=1&w=${w}&h=${h}`);
await p.evaluate(() => window.__ready);
const errs = await p.evaluate(() => { const e = []; for (let f = 0; f < 3000; f++) { try { window.renderFrame(f); } catch (x) { e.push(f + ': ' + x.message); } } return e; });
console.log(w + 'x' + h, errs.length ? errs.slice(0, 10) : 'sin errores');
await b.close();
