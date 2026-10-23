// Monta la locución sobre la música y entrega el MP4 final.
// 1. Corta la toma de ElevenLabs en sus 20 frases, ajusta el tempo y las coloca en la línea de tiempo.
// 2. Procesa la voz (filtro, EQ, compresión) y comprime la música con la voz como llave (ducking).
// 3. Normaliza a -14 LUFS (redes sociales) y une con el vídeo, que pasa de 60 a 30 fps
//    promediando pares de fotogramas (obturador de 180°: desenfoque de movimiento real).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { layoutVO, DURATION } from '../src/timeline.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = (...p) => path.join(root, ...p);
const take = r('vo', 'take.mp3');
const music = r('out', 'music.wav');
const video = r('out', 'render-60fps.mp4');
const final = r('out', 'lancia-037.mp4');
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });

const { tempo, lines } = layoutVO();
console.log(`tempo de la locución ×${tempo.toFixed(4)}`);

// --- Locución en su sitio -------------------------------------------------
const parts = lines.map((l, i) => {
  const ms = Math.round(l.start * 1000);
  return `[0:a]atrim=${l.srcIn}:${l.srcOut},asetpts=PTS-STARTPTS,atempo=${tempo.toFixed(5)},`
    + `afade=t=in:d=0.012,afade=t=out:st=${((l.srcOut - l.srcIn) / tempo - 0.03).toFixed(3)}:d=0.03,adelay=${ms}|${ms}[v${i}]`;
});
const voChain = [
  ...parts,
  `${lines.map((_, i) => `[v${i}]`).join('')}amix=inputs=${lines.length}:normalize=0,`
    + 'aresample=48000,highpass=f=75,equalizer=f=280:t=q:w=1.1:g=-2.5,equalizer=f=3200:t=q:w=1.2:g=2,'
    + 'equalizer=f=9500:t=h:w=0.7:g=1.5,acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3dB,'
    + `apad=whole_dur=${DURATION},atrim=0:${DURATION}[vo]`,
].join(';');
fs.mkdirSync(r('out', 'tmp'), { recursive: true });
const voWav = r('out', 'tmp', 'vo.wav');
ff(['-i', take, '-filter_complex', voChain, '-map', '[vo]', '-ac', '2', '-c:a', 'pcm_f32le', voWav]);

// --- Mezcla: música por debajo de la voz con sidechain ----------------------
const mixWav = r('out', 'tmp', 'mix-pre.wav');
ff(['-i', voWav, '-i', music, '-filter_complex',
  '[0:a]asplit=2[vk][vm];[1:a]volume=-11dB[m];'
  + '[m][vk]sidechaincompress=threshold=0.04:ratio=3.5:attack=25:release=320:knee=4[md];'
  + '[vm][md]amix=inputs=2:normalize=0[out]',
  '-map', '[out]', '-c:a', 'pcm_f32le', mixWav]);

// Normalización de sonoridad en dos pasadas (modo lineal).
const report = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${mixWav}" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1`]).toString();
const stats = JSON.parse(report.slice(report.lastIndexOf('{'), report.lastIndexOf('}') + 1));
const mixFinal = r('out', 'tmp', 'mix.wav');
const ln = `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true`;
ff(['-i', mixWav, '-af', `${ln},aresample=48000`, '-c:a', 'pcm_s24le', mixFinal]);

// --- Vídeo final -------------------------------------------------------------
ff(['-i', video, '-i', mixFinal,
  '-filter_complex', '[0:v]tmix=frames=2:weights=1 1,fps=30,format=yuv420p[v]',
  '-map', '[v]', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2',
  '-x264-params', 'keyint=60:min-keyint=30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-t', String(DURATION), final]);
console.log('final ->', final);
