// Monta la locución sobre la música y entrega el MP4 final.
// La toma del cliente entra entera, desplazada VO_OFFSET; se procesa (filtro, EQ, compresión),
// la música se comprime con la voz como llave y el conjunto se normaliza a -14 LUFS.
// El vídeo pasa de 60 a 30 fps promediando pares de fotogramas (obturador de 180°).
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DURATION, VO_OFFSET } from '../src/timeline.js';
import { CLIP_USE } from '../src/scenes.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const r = (...p) => path.join(root, ...p);
const ff = (args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
fs.mkdirSync(r('out', 'tmp'), { recursive: true });

const ms = Math.round(VO_OFFSET * 1000);
const voWav = r('out', 'tmp', 'vo.wav');
ff(['-i', r('vo', 'take.mp3'), '-af',
  `aresample=48000,adelay=${ms}|${ms},highpass=f=70,equalizer=f=250:t=q:w=1.1:g=-2,equalizer=f=3000:t=q:w=1.2:g=2,`
  + 'equalizer=f=9500:t=h:w=0.7:g=1.5,acompressor=threshold=-22dB:ratio=3:attack=4:release=90:makeup=3dB,'
  + `apad=whole_dur=${DURATION},atrim=0:${DURATION}`,
  '-ac', '2', '-c:a', 'pcm_f32le', voWav]);

// Sonido real del coche en cada tramo de onboard: el mismo trozo y la misma cámara lenta que la imagen.
// (CLIP_USE: [ventana, ventana, tramo, inicio del plano, fin del plano, desde, velocidad])
const uses = CLIP_USE.map(([, , seg, s0, s1, from, speed]) => ({ seg, s0, s1, from, speed }));
const clipWav = r('out', 'tmp', 'clip.wav');
{
  const inputs = [], parts = [];
  uses.forEach((u, i) => {
    inputs.push('-i', r('build', 'clip', `${u.seg}.wav`));
    const d = u.s1 - u.s0, at = Math.round(u.s0 * 1000);
    parts.push(`[${i}:a]asetrate=${Math.round(48000 * u.speed)},aresample=48000,atrim=start=${(u.from / u.speed).toFixed(3)}:duration=${d.toFixed(3)},asetpts=PTS-STARTPTS,`
      + `afade=t=in:d=0.25,afade=t=out:st=${(d - 0.35).toFixed(3)}:d=0.35,adelay=${at}|${at},apad=whole_dur=${DURATION}[c${i}]`);
  });
  ff([...inputs, '-filter_complex', parts.join(';') + ';' + uses.map((_, i) => `[c${i}]`).join('') + `amix=inputs=${uses.length}:normalize=0,atrim=0:${DURATION},volume=-4dB[c]`,
    '-map', '[c]', '-c:a', 'pcm_f32le', clipWav]);
}

// La música baja (unos −10 dB) mientras se ven los onboards, con rampas de 0,4 s; la voz no se toca.
const musicDuck = r('out', 'tmp', 'music-duck.wav');
{
  const buf = fs.readFileSync(r('out', 'music.wav'));
  let off = 12; while (buf.toString('ascii', off, off + 4) !== 'data') off += 8 + buf.readUInt32LE(off + 4);
  const data = off + 8, n = buf.readUInt32LE(off + 4) / 8, SR = 48000;
  const duck = 10 ** (-10 / 20), ramp = 0.4;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    let g = 1;
    for (const u of uses) {
      const k = Math.min(1, Math.max(0, (t - (u.s0 - ramp)) / ramp), Math.max(0, ((u.s1 + ramp) - t) / ramp));
      g = Math.min(g, 1 - (1 - duck) * k);
    }
    if (g < 1) { buf.writeFloatLE(buf.readFloatLE(data + i * 8) * g, data + i * 8); buf.writeFloatLE(buf.readFloatLE(data + i * 8 + 4) * g, data + i * 8 + 4); }
  }
  fs.writeFileSync(musicDuck, buf);
}

const mixWav = r('out', 'tmp', 'mix-pre.wav');
ff(['-i', voWav, '-i', musicDuck, '-i', clipWav, '-filter_complex',
  '[0:a]asplit=3[vk][vk2][vm];[1:a]volume=-10dB[m];'
  + '[m][vk]sidechaincompress=threshold=0.04:ratio=3.5:attack=25:release=350:knee=4[md];'
  + '[2:a][vk2]sidechaincompress=threshold=0.05:ratio=2:attack=15:release=250:knee=4[cd];'
  + '[vm][md][cd]amix=inputs=3:normalize=0[out]',
  '-map', '[out]', '-c:a', 'pcm_f32le', mixWav]);

// Normalización de sonoridad en dos pasadas (modo lineal).
const report = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${mixWav}" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1`]).toString();
const st = JSON.parse(report.slice(report.lastIndexOf('{'), report.lastIndexOf('}') + 1));
const mixFinal = r('out', 'tmp', 'mix.wav');
ff(['-i', mixWav, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${st.input_i}:measured_TP=${st.input_tp}:measured_LRA=${st.input_lra}:measured_thresh=${st.input_thresh}:offset=${st.target_offset}:linear=true,aresample=48000`,
  '-c:a', 'pcm_s24le', mixFinal]);

const final = r('out', 'cajas.mp4');
ff(['-i', r('out', 'render-60fps.mp4'), '-i', mixFinal,
  '-filter_complex', '[0:v]tmix=frames=2:weights=1 1,fps=30,format=yuv420p[v]',
  '-map', '[v]', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-profile:v', 'high', '-level', '4.2',
  '-x264-params', 'keyint=60:min-keyint=30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-t', String(DURATION), final]);
console.log('final ->', final);
