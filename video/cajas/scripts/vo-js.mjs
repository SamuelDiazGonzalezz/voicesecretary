// Convierte el mapa de la locución (out/vo-map.json) en un módulo para el render y el audio.
import fs from 'node:fs';
const map = JSON.parse(fs.readFileSync(new URL('../out/vo-map.json', import.meta.url)));
const rows = map.map((r) => `  [${r.start.toFixed(2)}, ${r.end.toFixed(2)}, ${JSON.stringify(r.text)}],`).join('\n');
fs.writeFileSync(new URL('../src/vo.js', import.meta.url),
  `// Generado por scripts/vo-js.mjs a partir de scripts/align.py: [inicio, fin, texto] en la toma original.\nexport const VO_RAW = [\n${rows}\n];\n`);
console.log('src/vo.js', map.length, 'cláusulas');
