// Monta la locución sobre la música y entrega el MP4 final.
// La toma del cliente entra entera, desplazada VO_OFFSET; se procesa (filtro, EQ, compresión),
// la música se comprime con la voz como llave y el conjunto se normaliza a -14 LUFS.
// El vídeo pasa de 60 a 30 fps promediando pares de fotogramas (obturador de 180°).
import path from 'node:path';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { DURATION, VO_OFFSET, cut } from '../src/timeline.js';

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

// Sonido real del clip del Evo VI: sus petardeos mientras se ve el coche («Coches imposibles»), bajo la voz.
const clipWav = r('out', 'tmp', 'clip.wav');
const at1 = Math.round(cut(1) * 1000), clipDur = cut(2) - cut(1) + 0.3;
ff(['-i', r('build', 'clip-audio.wav'), '-filter_complex',
  `[0:a]atrim=0:${clipDur},afade=t=in:d=0.05,afade=t=out:st=${clipDur - 0.35}:d=0.35,adelay=${at1}|${at1},volume=-3dB,`
  + `apad=whole_dur=${DURATION},atrim=0:${DURATION}[c]`,
  '-map', '[c]', '-c:a', 'pcm_f32le', clipWav]);

const mixWav = r('out', 'tmp', 'mix-pre.wav');
ff(['-i', voWav, '-i', r('out', 'music.wav'), '-i', clipWav, '-filter_complex',
  '[0:a]asplit=3[vk][vk2][vm];[1:a]volume=-8dB[m];'
  + '[m][vk]sidechaincompress=threshold=0.04:ratio=3.5:attack=25:release=350:knee=4[md];'
  + '[2:a][vk2]sidechaincompress=threshold=0.03:ratio=4:attack=10:release=220:knee=4[cd];'
  + '[vm][md][cd]amix=inputs=3:normalize=0[out]',
  '-map', '[out]', '-c:a', 'pcm_f32le', mixWav]);

// Normalización de sonoridad en dos pasadas (modo lineal).
const report = execFileSync('bash', ['-c', `ffmpeg -hide_banner -i "${mixWav}" -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1`]).toString();
const st = JSON.parse(report.slice(report.lastIndexOf('{'), report.lastIndexOf('}') + 1));
const mixFinal = r('out', 'tmp', 'mix.wav');
ff(['-i', mixWav, '-af', `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${st.input_i}:measured_TP=${st.input_tp}:measured_LRA=${st.input_lra}:measured_thresh=${st.input_thresh}:offset=${st.target_offset}:linear=true,aresample=48000`,
  '-c:a', 'pcm_s24le', mixFinal]);

const final = r('out', 'promo-evoheritage.mp4');
ff(['-i', r('out', 'render-60fps.mp4'), '-i', mixFinal,
  '-filter_complex', '[0:v]tmix=frames=2:weights=1 1,fps=30,format=yuv420p[v]',
  '-map', '[v]', '-map', '1:a',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-profile:v', 'high', '-level', '4.2',
  '-x264-params', 'keyint=60:min-keyint=30', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
  '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart', '-t', String(DURATION), final]);
console.log('final ->', final);
