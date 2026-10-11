#!/usr/bin/env python3
"""
GACMARK showreel — banda sonora sintetizada desde cero (solo numpy).

Sin muestras: cada sonido sale de osciladores, ruido con semilla y filtros
en el dominio de la frecuencia. 96 BPM -> negra = 0.625 s, compás = 2.5 s,
20 compases = 50 s exactos. Los tiempos de corte del vídeo (src/showreel.js)
están anclados a esta misma rejilla.

Uso: python3 music.py salida.wav
"""
import sys
import wave
import numpy as np

SR = 48000
BPM = 96
BEAT = 60.0 / BPM          # 0.625 s
BAR = BEAT * 4             # 2.5 s
DUR = 50.0
N = int(SR * DUR)
rng = np.random.default_rng(20261011)  # semilla fija: render determinista


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def tvec(n):
    return np.arange(n) / SR


# ---------------------------------------------------------------- buses
BUSES = {k: np.zeros((2, N)) for k in
         ("pad", "bass", "kick", "drums", "arp", "bell", "fx", "impact")}


def add(bus, start, sig, pan=0.0, gain=1.0):
    """Suma una señal mono (o estéreo 2xn) en un bus con paneo de potencia constante."""
    i0 = int(round(start * SR))
    if sig.ndim == 1:
        a = (pan + 1) * np.pi / 4
        sig = np.vstack([sig * np.cos(a), sig * np.sin(a)])
    n = sig.shape[1]
    if i0 >= N or i0 + n <= 0:
        return
    s0 = max(0, -i0)
    i0c = max(i0, 0)
    i1 = min(N, i0 + n)
    BUSES[bus][:, i0c:i1] += gain * sig[:, s0:s0 + (i1 - i0c)]


# ---------------------------------------------------------------- filtros
def fft_filter(x, lo=None, hi=None, order=4):
    """Paso-banda suave (respuesta tipo Butterworth en magnitud) vía FFT."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    H = np.ones_like(f)
    if hi:
        H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(X * H, n)


def sweep_filter(x, lo_curve, hi_curve, block=2048):
    """Filtro variable en el tiempo: overlap-add con ventanas de Hann."""
    n = len(x)
    hop = block // 2
    win = np.hanning(block)
    out = np.zeros(n + block)
    xp = np.concatenate([x, np.zeros(block)])
    f = np.fft.rfftfreq(block, 1 / SR)
    for s in range(0, n, hop):
        c = min(s + hop, n - 1)
        lo, hi = lo_curve[c], hi_curve[c]
        H = (1 / np.sqrt(1 + (f / hi) ** 8)) * (1 / np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** 8))
        seg = np.fft.irfft(np.fft.rfft(xp[s:s + block] * win) * H, block)
        out[s:s + block] += seg
    return out[:n]


# ---------------------------------------------------------------- instrumentos
def saw_additive(f, n, cutoff, phase_seed=0):
    """Diente de sierra limitado en banda por síntesis aditiva + 'filtro' de 24 dB/oct
    aplicado a cada armónico (cutoff puede ser escalar o vector en el tiempo)."""
    t = tvec(n)
    out = np.zeros(n)
    cmax = float(np.max(cutoff))
    K = int(min(80, 18000 / f, 3.5 * cmax / f + 2))
    pr = np.random.default_rng(phase_seed)
    for k in range(1, K + 1):
        w = 1 / np.sqrt(1 + (k * f / cutoff) ** 4)
        out += (w / k) * np.sin(2 * np.pi * k * f * t + pr.uniform(0, 2 * np.pi))
    return out


def env_adsr(n, a, d, s, r, total=None):
    t = tvec(n)
    total = total if total is not None else n / SR
    e = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel_start = total - r
    e = np.where(t > rel_start, e * np.clip(1 - (t - rel_start) / r, 0, 1), e)
    return e


def pad_chord(start, notes, length, bright=1.0, gain=0.11):
    n = int((length + 0.9) * SR)
    t = tvec(n)
    cutoff = 380 + 1500 * bright * (0.5 - 0.5 * np.cos(np.minimum(t / length, 1) * np.pi)) \
        + 140 * np.sin(2 * np.pi * 0.31 * t)
    e = env_adsr(n, 0.35, 1.0, 0.85, 0.9)
    for j, m in enumerate(notes):
        for d, pan in ((-0.09, -0.6), (0.0, 0.0), (0.085, 0.6)):
            f = mtof(m + d)
            s = saw_additive(f, n, cutoff, phase_seed=int(m * 100 + d * 1000 + start * 10)) * e
            add("pad", start, s, pan=pan * 0.8, gain=gain / len(notes))


def bass_note(start, m, length, gain=0.42):
    n = int((length + 0.15) * SR)
    t = tvec(n)
    f = mtof(m)
    s = np.sin(2 * np.pi * f * t) + 0.28 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    s = np.tanh(1.6 * s) * env_adsr(n, 0.012, 0.6, 0.7, 0.15)
    add("bass", start, s, gain=gain)


def kick(start, gain=0.9):
    n = int(0.7 * SR)
    t = tvec(n)
    f = 44 + 120 * np.exp(-t / 0.032)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.34)
    click = fft_filter(rng.standard_normal(n), lo=1500, hi=9000) * np.exp(-t / 0.0025) * 0.35
    add("kick", start, np.tanh(1.8 * (s + click)), gain=gain)


def clap(start, gain=0.5, pan=0.0):
    n = int(0.6 * SR)
    t = tvec(n)
    nz = fft_filter(rng.standard_normal(n), lo=900, hi=7000)
    e = np.zeros(n)
    for k, off in enumerate((0, 0.011, 0.023)):
        tt = t - off
        e += np.where(tt >= 0, np.exp(-np.maximum(tt, 0) / 0.006), 0) * (0.8 if k < 2 else 1)
    tail = np.where(t > 0.023, np.exp(-(t - 0.023) / 0.17), 0)
    body = np.sin(2 * np.pi * 182 * t) * np.exp(-t / 0.07) * 0.45
    add("drums", start, nz * (e * 0.6 + tail) * 0.7 + body, pan=pan, gain=gain)


def hat(start, gain=0.12, open_=False, pan=0.25):
    n = int((0.35 if open_ else 0.09) * SR)
    t = tvec(n)
    nz = fft_filter(rng.standard_normal(n), lo=7500, hi=16000)
    s = nz * np.exp(-t / (0.11 if open_ else 0.028))
    add("drums", start, s, pan=pan, gain=gain)


def pluck(start, m, gain=0.09, pan=0.0):
    n = int(0.9 * SR)
    t = tvec(n)
    cutoff = 300 + 4200 * np.exp(-t / 0.09)
    s = saw_additive(mtof(m), n, cutoff, phase_seed=int(start * 1000)) * np.exp(-t / 0.28)
    s *= np.minimum(t / 0.002, 1)
    # eco ping-pong de corchea con puntillo, sin recursión: copias desplazadas
    dl = int(BEAT * 0.75 * SR)
    out = np.zeros((2, n + dl * 5))
    out[0, :n] += s
    out[1, :n] += s
    for k in range(1, 5):
        ch = k % 2
        out[ch, k * dl:k * dl + n] += s * (0.42 ** k)
    a = (pan + 1) * np.pi / 4
    out[0] *= np.cos(a) * 1.41
    out[1] *= np.sin(a) * 1.41
    add("arp", start, out, gain=gain)


def bell(start, m, gain=0.16, pan=0.0, decay=1.8):
    n = int((decay * 2.5) * SR)
    t = tvec(n)
    fc = mtof(m)
    idx = 5.0 * np.exp(-t / 0.35)
    s = np.sin(2 * np.pi * fc * t + idx * np.sin(2 * np.pi * fc * 1.4 * t))
    s += 0.35 * np.sin(2 * np.pi * fc * 2.0 * t) * np.exp(-t / 0.5)
    s *= np.exp(-t / decay) * np.minimum(t / 0.003, 1)
    add("bell", start, s, pan=pan, gain=gain)


def impact(at, gain=1.0, size=1.0):
    n = int(4.0 * SR)
    t = tvec(n)
    f = 26 + 70 * np.exp(-t / 0.25)
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (1.1 * size))
    nz = fft_filter(rng.standard_normal(n), hi=2600, lo=60) * np.exp(-t / (0.22 * size))
    crack = fft_filter(rng.standard_normal(n), lo=3000) * np.exp(-t / 0.03) * 0.5
    s = np.tanh(1.4 * (boom * 1.0 + nz * 0.55 + crack))
    add("impact", at, s, gain=gain)


def riser(t0, t1, gain=0.22, lo_end=7000):
    n = int((t1 - t0) * SR)
    t = tvec(n)
    x = t / (t1 - t0)
    nz = rng.standard_normal(n)
    centre = 250 * (lo_end / 250) ** (x ** 1.5)
    f = sweep_filter(nz, centre * 0.6, centre * 1.6)
    tone_f = 180 * (6.0 ** (x ** 2))
    tone = np.sin(2 * np.pi * np.cumsum(tone_f) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * (4 + 18 * x) * t))
    s = (f * 0.8 + tone * 0.18) * (x ** 2.2)
    s[-int(0.004 * SR):] *= np.linspace(1, 0, int(0.004 * SR))
    st = np.vstack([s * (0.8 + 0.2 * np.sin(9 * t)), s * (0.8 + 0.2 * np.cos(9 * t))])
    add("fx", t0, st, gain=gain)


def whoosh(at, gain=0.2, length=0.8, direction=1):
    """Barrido de ruido centrado en el corte (pico en 'at')."""
    n = int(length * SR)
    t = tvec(n)
    x = t / length
    e = np.exp(-((x - 0.62) / 0.2) ** 2)
    centre = 500 + 3500 * np.exp(-((x - 0.62) / 0.25) ** 2)
    s = sweep_filter(rng.standard_normal(n), centre * 0.5, centre * 2.0) * e
    pan = np.clip((x - 0.5) * 2 * direction, -1, 1)
    a = (pan + 1) * np.pi / 4
    add("fx", at - 0.62 * length, np.vstack([s * np.cos(a), s * np.sin(a)]), gain=gain)


def tick(at, gain=0.25):
    n = int(0.25 * SR)
    t = tvec(n)
    s = np.sin(2 * np.pi * 2100 * t) * np.exp(-t / 0.012) + 0.4 * np.sin(2 * np.pi * 3170 * t) * np.exp(-t / 0.02)
    add("fx", at, s, gain=gain)


def rev_cymbal(t0, t1, gain=0.18):
    n = int((t1 - t0) * SR)
    t = tvec(n)
    x = t / (t1 - t0)
    s = fft_filter(rng.standard_normal(n), lo=4500, hi=15000) * (x ** 3)
    add("fx", t0, np.vstack([s, np.roll(s, 37)]), gain=gain)


# ---------------------------------------------------------------- arreglo
DM = [50, 53, 57, 62]
BB = [46, 50, 53, 58]
FM = [48, 53, 57, 60]
CM = [48, 52, 55, 60]
DM9 = [50, 53, 57, 60, 64, 69]
PROG = [DM, BB, FM, CM]
ROOT = {id(DM): 38, id(BB): 34, id(FM): 41, id(CM): 36}

for b in range(18):
    ch = PROG[b % 4]
    t0 = b * BAR
    bright = 0.35 if b < 2 else (0.7 if b < 4 else (1.0 if b < 16 else 1.25))
    pad_chord(t0, ch, BAR, bright=bright, gain=0.12 if b < 2 else 0.1)
    if b >= 2:
        if b < 4:
            bass_note(t0, ROOT[id(ch)], BAR - 0.05, gain=0.32)
        else:
            # pulso de bajo sincopado
            for k, (pos, ln) in enumerate(((0, 1.5), (1.5, 1.0), (2.75, 0.5), (3.25, 0.7))):
                if t0 + pos * BEAT < 44.375:
                    bass_note(t0 + pos * BEAT, ROOT[id(ch)] + (12 if k == 2 else 0), ln * BEAT, gain=0.36)

# acorde final (Dm9) en el impacto del logo
pad_chord(45.0, DM9, 4.6, bright=0.9, gain=0.16)
bass_note(45.0, 26, 4.5, gain=0.5)

# sub-drone del intro
n = int(5.2 * SR)
tt = tvec(n)
drone = np.sin(2 * np.pi * mtof(38) * tt) * np.minimum(tt / 2.0, 1) * np.exp(-np.maximum(tt - 4.6, 0) / 0.2)
add("bass", 0, drone, gain=0.22)

# batería: medio tiempo, entra en 5.0 s, completa en 10 s, corte en 44.375 s
kicks = []
for b in range(2, 18):
    t0 = b * BAR
    pattern = [0, 1.5] if b < 4 else [0, 1.5, 2.75 if b % 2 else 3.5]
    for p in pattern:
        tk = t0 + p * BEAT
        if tk < 44.3:
            kick(tk, gain=0.75 if b < 4 else 0.9)
            kicks.append(tk)
    if b >= 2:
        clap(t0 + 2 * BEAT, gain=0.38 if b < 4 else 0.5)
    if b >= 3:
        for k in range(8):
            th = t0 + k * BEAT / 2
            if th >= 44.3:
                continue
            accent = 1.0 if k % 2 == 1 else 0.55
            hat(th, gain=0.1 * accent * (1.25 if b >= 16 else 1), open_=(k == 7 and b % 2 == 1), pan=0.3)
            if b >= 4 and k in (3, 6):
                hat(th + BEAT / 4, gain=0.05, pan=-0.3)

# redobles antes de 20, 30, 40 s
for c in (20.0, 30.0, 40.0):
    for k in range(4):
        clap(c - BEAT + k * BEAT / 4, gain=0.12 + 0.07 * k, pan=-0.3 + 0.2 * k)

# arpegio desde 10 s
ARP = [0, 1, 2, 3, 2, 1, 2, 3]
for b in range(4, 18):
    ch = PROG[b % 4]
    oct_ = 24 if b >= 16 else 12
    for k in range(8):
        tn = b * BAR + k * BEAT / 2
        if tn >= 44.3:
            continue
        pluck(tn, ch[ARP[k]] + oct_, gain=0.075 if b < 16 else 0.09, pan=-0.4 + 0.8 * (k % 2))

# campanas: motivo del intro y del lema
for tb, m, g in ((0.625, 74, 0.13), (1.875, 81, 0.11), (3.125, 77, 0.1), (3.75, 76, 0.12)):
    bell(tb, m, gain=g, pan=-0.3 if m % 2 else 0.3)
for tb, m, g in ((45.0, 74, 0.2), (45.0, 81, 0.14), (47.5, 81, 0.14), (48.125, 86, 0.14), (48.75, 88, 0.12)):
    bell(tb, m, gain=g, decay=2.4)

# FX y transiciones
riser(2.6, 5.0, gain=0.24)
rev_cymbal(3.4, 5.0)
impact(5.0, gain=0.85)
impact(7.5, gain=0.55, size=0.6)
whoosh(7.5, gain=0.25, length=0.9)
riser(8.2, 10.0, gain=0.16, lo_end=5000)
tick(9.375, gain=0.2)
impact(10.0, gain=0.7)
for i, c in enumerate((15.0, 20.0, 25.0, 30.0, 35.0, 40.0)):
    whoosh(c, gain=0.22, direction=1 if i % 2 == 0 else -1)
    tick(c, gain=0.16)
    impact(c, gain=0.28, size=0.5)
riser(42.5, 44.375, gain=0.26, lo_end=9000)
rev_cymbal(43.2, 45.0, gain=0.22)
impact(45.0, gain=1.0, size=1.5)

# ---------------------------------------------------------------- mezcla
t = tvec(N)
duck = np.ones(N)
for tk in kicks:
    i0 = int(tk * SR)
    w = int(0.45 * SR)
    seg = 1 - 0.55 * np.exp(-tvec(w) / 0.14) * np.minimum(tvec(w) / 0.004, 1)
    i1 = min(N, i0 + w)
    duck[i0:i1] = np.minimum(duck[i0:i1], seg[:i1 - i0])

for k in ("pad", "bass", "arp"):
    BUSES[k] *= duck

# corte dramático 44.375 -> 45.0: solo quedan riser y platillo invertido
gate = np.ones(N)
g0, g1 = int(44.375 * SR), int(45.0 * SR)
fade = int(0.03 * SR)
gate[g0:g0 + fade] = np.linspace(1, 0, fade)
gate[g0 + fade:g1] = 0
for k in ("pad", "bass", "arp", "drums", "kick"):
    BUSES[k] *= gate


def reverb(x, seconds=3.2, decay=0.85, hi=6000, seed=7):
    n = int(seconds * SR)
    r = np.random.default_rng(seed)
    tt = tvec(n)
    ir = np.zeros((2, n))
    for ch in range(2):
        ir[ch] = fft_filter(r.standard_normal(n), hi=hi, lo=150) * np.exp(-tt / decay)
        ir[ch, :int(0.012 * SR)] = 0  # pre-delay
    ir /= np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))
    out = np.zeros_like(x)
    L = 1 << int(np.ceil(np.log2(x.shape[1] + n)))
    for ch in range(2):
        y = np.fft.irfft(np.fft.rfft(x[ch], L) * np.fft.rfft(ir[ch], L), L)
        out[ch] = y[:x.shape[1]]
    return out


send = (BUSES["pad"] * 0.5 + BUSES["arp"] * 0.6 + BUSES["bell"] * 0.9 + BUSES["drums"] * 0.25
        + BUSES["fx"] * 0.4 + BUSES["impact"] * 0.5)
wet = reverb(send)

mix = (BUSES["pad"] * 1.0 + BUSES["bass"] * 0.9 + BUSES["kick"] * 0.85 + BUSES["drums"] * 0.8
       + BUSES["arp"] * 0.8 + BUSES["bell"] * 0.8 + BUSES["fx"] * 0.9 + BUSES["impact"] * 0.9 + wet * 0.55)

# fundido de entrada mínimo y salida natural
mix[:, :int(0.01 * SR)] *= np.linspace(0, 1, int(0.01 * SR))
mix[:, -int(1.2 * SR):] *= np.linspace(1, 0, int(1.2 * SR)) ** 1.5

# master: saturación suave + normalización a -1 dBFS
mix = np.tanh(mix * 1.3) / np.tanh(1.3)
mix *= 0.89 / np.max(np.abs(mix))

out = sys.argv[1] if len(sys.argv) > 1 else "music.wav"
pcm = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
with wave.open(out, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("ok", out, mix.shape[1] / SR, "s")
