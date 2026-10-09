"""Banda sonora 100% sintetizada con numpy (sin samples ni modelos generativos).

Lee timeline.json para que motor, golpes y whooshes caigan en los mismos instantes
que la imagen (las RPM del tacómetro del HUD son literalmente las mismas que suenan).
Uso: python3 audio/synth.py out/audio.wav
"""
import json, sys, wave, math
import numpy as np

SR = 48000
TL = json.load(open('timeline.json'))
DUR = TL['duration']
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(1986)
BEAT = 60 / TL['bpm']


# ------------------------------------------------------------------ utilidades
def keys(arr, t, step=False):
    """Mismo interpolador que src/util.js (inOutSine entre keyframes)."""
    ks = np.array(arr, dtype=float)
    out = np.full_like(t, ks[-1, 1])
    out[t <= ks[0, 0]] = ks[0, 1]
    for (t0, v0), (t1, v1) in zip(ks[:-1], ks[1:]):
        m = (t >= t0) & (t < t1)
        if step:
            out[m] = v0
        else:
            u = (t[m] - t0) / (t1 - t0)
            out[m] = v0 + (v1 - v0) * (-(np.cos(np.pi * u) - 1) / 2)
    return out


def seg(t0, dur):
    a = max(0, int(t0 * SR)); b = min(N, int((t0 + dur) * SR))
    return a, b


def place(buf, sig, t0, gain=1.0, pan=0.0):
    a = int(round(t0 * SR))
    if a >= N: return
    s = sig[: N - a] if a >= 0 else sig[-a:N - a]
    a = max(a, 0)
    l, r = math.cos((pan + 1) * math.pi / 4), math.sin((pan + 1) * math.pi / 4)
    buf[0, a:a + len(s)] += s * gain * l * 1.414
    buf[1, a:a + len(s)] += s * gain * r * 1.414


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass1(x, fc):
    """Paso bajo de un polo vectorizado por bloques (fc constante) vía FFT."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    return np.fft.irfft(X / (1 + 1j * f / fc), len(x))


def highpass(x, fc, order=2):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    H = (1j * f / fc) / (1 + 1j * f / fc)
    return np.fft.irfft(X * H ** order, len(x))


def tv_filter(x, gain_fn, n=2048, hop=512):
    """Filtro variante en el tiempo por STFT. gain_fn(tc, freqs) -> ganancia por bin."""
    win = np.hanning(n)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    out = np.zeros_like(pad); norm = np.zeros_like(pad)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    for start in range(0, len(pad) - n, hop):
        fr = pad[start:start + n] * win
        tc = (start + n / 2 - n) / SR
        g = gain_fn(tc, freqs)
        y = np.fft.irfft(np.fft.rfft(fr) * g, n) * win
        out[start:start + n] += y; norm[start:start + n] += win ** 2
    return (out / np.maximum(norm, 1e-6))[n:n + len(x)]


def band(fc, bw_oct):
    return lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / bw_oct) ** 2)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ batería
def kick(dur=0.45, f0=160, f1=42, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.16)
    click = rng.standard_normal(n) * np.exp(-t / 0.003) * 0.4
    return np.tanh(1.6 * (body + click)) * amp


def clap(dur=0.3):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 900)
    e = np.zeros(n)
    for d in (0, 0.009, 0.018):  # palmada multi-transitorio
        e += (t >= d) * np.exp(-np.maximum(t - d, 0) / (0.012 if d < 0.018 else 0.09))
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.3
    return (nz * e * 0.5 + tone) * 0.8


def hat(dur=0.06, open_=False):
    n = int((0.25 if open_ else dur) * SR); t = np.arange(n) / SR
    nz = highpass(rng.standard_normal(n), 7000, 3)
    return nz * np.exp(-t / (0.08 if open_ else 0.018)) * 0.35


# ------------------------------------------------------------------ sintes (aditivos, filtro por armónico)
def saw_note(freq, dur, cutoff, att=0.005, rel=0.08, detune=0.0, sq=False, cut_env=None):
    n = int(dur * SR); t = np.arange(n) / SR
    y = np.zeros(n)
    K = int(min(60, (SR / 2.2) / freq))
    fc = cutoff * (cut_env(t) if cut_env else 1.0)
    for d in ([0.0] if detune == 0 else [-detune, 0.0, detune]):
        f = freq * (1 + d)
        for k in range(1, K + 1):
            if sq and k % 2 == 0: continue
            a = (1 / k) / (1 + (k * f / fc) ** 4)
            if np.max(a) < 1e-4: break
            y += a * np.sin(2 * np.pi * k * f * t + k * 1.3)
    e = np.minimum(1, t / att) * np.minimum(1, np.maximum(0, (dur - t) / rel))
    return y * e


def pluck(freq, dur=0.3, cutoff=3000):
    return saw_note(freq, dur, cutoff, att=0.002, rel=0.05, sq=True, cut_env=lambda t: 0.15 + np.exp(-t / 0.06)) * np.exp(-np.arange(int(dur * SR)) / SR / 0.12)


# ------------------------------------------------------------------ FX
def whoosh(dur=0.6, f0=300, f1=5000, peak=0.6, amp=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    y = tv_filter(nz, lambda tc, f: band(f0 * (f1 / f0) ** np.clip(tc / dur, 0, 1), 0.7)(f), n=1024, hop=256)
    u = t / dur
    e = np.where(u < peak, (u / peak) ** 2, np.exp(-(u - peak) / (1 - peak) * 4))
    return y * e * amp * 1.4


def riser(dur=1.2, f0=200, f1=6000):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    y = tv_filter(nz, lambda tc, f: band(f0 * (f1 / f0) ** np.clip(tc / dur, 0, 1) ** 2, 0.5)(f), n=1024, hop=256)
    tone = np.sin(2 * np.pi * np.cumsum(110 * 2 ** (2 * t / dur)) / SR) * 0.15
    return (y + tone) * (t / dur) ** 2.2


def impact(amp=1.0, boom_f=55):
    n = int(2.2 * SR); t = np.arange(n) / SR
    f = boom_f * (0.55 + 0.45 * np.exp(-t / 0.25))
    boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.55)
    crack = highpass(rng.standard_normal(n), 1500) * np.exp(-t / 0.05) * 0.5
    body = lowpass1(rng.standard_normal(n), 400) * np.exp(-t / 0.3) * 2.0
    return np.tanh(1.3 * (boom * 1.1 + crack + body)) * amp


def reverse_swell(dur=0.45):
    n = int(dur * SR); t = np.arange(n) / SR
    y = highpass(rng.standard_normal(n), 2500) * (t / dur) ** 3
    return y * 0.35


def beep(freq=1000, dur=0.14):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sign(np.sin(2 * np.pi * freq * t)) * 0.3 + np.sin(2 * np.pi * freq * t) * 0.7) * np.minimum(1, (dur - t) / 0.01) * np.minimum(1, t / 0.002) * 0.25


def tick(freq=3200, dur=0.03):
    n = int(dur * SR); t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.exp(-t / 0.006) * 0.5 + highpass(rng.standard_normal(n), 4000) * np.exp(-t / 0.002) * 0.3


def pop(amp=1.0):
    """Petardeo anti-lag: golpe grave + chasquido + cola de llama."""
    n = int(0.35 * SR); t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * (70 + 120 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05)
    crack = rng.standard_normal(n) * np.exp(-t / 0.006)
    tail = lowpass1(rng.standard_normal(n), 1800) * np.exp(-t / 0.07) * 0.8
    return np.tanh(2.5 * (thump + crack * 0.9 + tail)) * amp


# ------------------------------------------------------------------ MOTOR (4 cilindros turbo)
def engine():
    rpm = keys(TL['rpm'], T)
    gain = keys(TL['engineGain'], T)
    f_fire = np.maximum(rpm, 1) / 60 * 2  # 4T, 4 cilindros
    ph = 2 * np.pi * np.cumsum(f_fire) / SR
    drpm = np.gradient(rpm) * SR
    thr = np.clip(0.35 + drpm / 25000, 0, 1)
    thr = lowpass1(thr, 8)
    y = np.zeros(N)
    orders = [(0.5, 0.35), (1, 1.0), (1.5, 0.25), (2, 0.55), (3, 0.3), (4, 0.22), (5, 0.12), (6, 0.1), (8, 0.06), (10, 0.04)]
    for k, a in orders:
        wob = 1 + 0.15 * np.sin(2 * np.pi * 3.1 * k * T + k)
        y += a * wob * np.sin(k * ph + k * 0.7)
    pulses = (0.5 + 0.5 * np.cos(ph)) ** 10
    rasp = highpass(rng.standard_normal(N), 300) * pulses * (0.6 + 1.2 * thr)
    y = np.tanh((1.6 + 1.6 * thr) * y) + rasp * 0.9
    # silbido del turbo
    boost = lowpass1(np.clip(rpm / 7800, 0, 1) ** 3 * thr, 3)
    whistle = np.sin(2 * np.pi * np.cumsum(2200 + rpm * 0.55) / SR) * boost * 0.06
    # admisión
    intake = tv_filter(rng.standard_normal(N), lambda tc, f: band(400 + 1.2 * float(np.interp(tc, T, rpm)), 1.0)(f)) * thr * 0.25
    out = (y * 0.55 + whistle + intake) * gain * (rpm > 50)
    # motor de arranque antes de la ignición
    a, b = seg(1.05, 0.45)
    ts = T[a:b] - 1.05
    starter = (np.sin(2 * np.pi * 95 * ts) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 9 * ts))) + 0.3 * rng.standard_normal(b - a)) * 0.25
    starter *= np.minimum(1, ts / 0.05)
    out[a:b] += lowpass1(starter, 1500)
    # blow-off valve en cada bajada brusca de RPM (cambios de marcha / levantar)
    bov_times = []
    kk = TL['rpm']
    for (t0, v0), (t1, v1) in zip(kk[:-1], kk[1:]):
        if v0 - v1 > 1500 and t1 - t0 < 0.2 and v1 > 0: bov_times.append(t0)
    return out, rpm, bov_times


def bov(dur=0.42):
    n = int(dur * SR); t = np.arange(n) / SR
    nz = rng.standard_normal(n)
    y = tv_filter(nz, lambda tc, f: band(5200 * 2 ** (-tc / dur * 1.2), 0.6)(f), n=1024, hop=256)
    flutter = 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 26 * t))
    return y * np.exp(-t / 0.12) * flutter * 0.55


# ------------------------------------------------------------------ MÚSICA (Mi menor, 120 BPM)
CH = {'Em': [52, 55, 59, 64], 'C': [48, 52, 55, 60], 'G': [55, 59, 62, 67], 'D': [50, 54, 57, 62]}
ROOT = {'Em': 28, 'C': 36, 'G': 31, 'D': 38}
SECTIONS = [  # (inicio, fin, acorde por compás [2 s], estilo)
    (2.5, 6.5, ['Em', 'C'], 'A'),
    (6.5, 10.5, ['G', 'D'], 'B'),
    (10.5, 14.0, ['Em', 'C'], 'C'),
    (14.0, 17.0, ['G', 'D'], 'D'),
]


def music():
    drums = np.zeros((2, N)); synth = np.zeros((2, N)); pads = np.zeros((2, N))
    kick_times = []
    for (s0, s1, chords, sty) in SECTIONS:
        nb = int(round((s1 - s0) / BEAT))
        for i in range(nb):
            tb = s0 + i * BEAT
            bar = int(i // 4); chord = chords[bar % len(chords)]
            if sty != 'C' or i % 2 == 0:
                place(drums, kick(), tb, 0.95); kick_times.append(tb)
            if i % 2 == 1: place(drums, clap(), tb, 0.55, 0.05)
            sub = 4 if sty == 'B' else 2
            for j in range(sub):
                th = tb + j * BEAT / sub
                if sub == 2 and j == 0: continue
                place(drums, hat(open_=(sty == 'D' and j == 1)), th, 0.32 if j % 2 else 0.18, 0.35)
            # bajo: corcheas con octava
            for j in range(2):
                m = ROOT[chord] + (12 if j == 1 and sty in 'BD' else 0)
                place(synth, saw_note(mtof(m + 12), BEAT / 2 * 0.9, 900 if sty == 'B' else 600, rel=0.03, cut_env=lambda t: 0.3 + np.exp(-t / 0.05)), tb + j * BEAT / 2, 0.42)
            # arpegio en semicorcheas
            if sty in 'BD':
                notes = CH[chord] + [CH[chord][1] + 12]
                for j in range(4):
                    m = notes[(i * 4 + j) % len(notes)] + 12
                    place(synth, pluck(mtof(m), 0.2, 4200 if sty == 'B' else 2600), tb + j * BEAT / 4, 0.12, -0.4 + 0.8 * ((i * 4 + j) % 2))
            if sty in 'AC' and i % 2 == 1:
                for j, m in enumerate(CH[chord][:3]):
                    place(synth, pluck(mtof(m + 12), 0.35, 2200), tb + BEAT / 2 + j * 0.06, 0.12, -0.5 + j * 0.5)
        # pads por compás
        for b in range(int(math.ceil((s1 - s0) / (4 * BEAT)))):
            tb = s0 + b * 4 * BEAT; dur = min(4 * BEAT, s1 - tb)
            chord = chords[b % len(chords)]
            for k, m in enumerate(CH[chord]):
                p = saw_note(mtof(m), dur, 1300, att=0.25, rel=0.3, detune=0.004)
                place(pads, p, tb, 0.06, -0.6 + 0.4 * k)
    # redoble de caja antes del tramo
    for i in range(8):
        place(drums, clap(0.12), 6.0 + i * BEAT / 8, 0.15 + 0.06 * i, 0.0)
    # acorde final con mucho espacio
    for k, m in enumerate([40, 52, 55, 59, 66, 71]):
        place(pads, saw_note(mtof(m), 1.0, 2400, att=0.004, rel=0.9, detune=0.006), 19.0, 0.11 if k else 0.3, -0.5 + 0.2 * k)
    # pad tenue bajo el logo (17-19)
    for k, m in enumerate(CH['Em']):
        place(pads, saw_note(mtof(m), 2.0, 700, att=0.6, rel=0.3, detune=0.004), 17.0, 0.07, -0.5 + 0.33 * k)
    return drums, synth, pads, kick_times


# ------------------------------------------------------------------ montaje
def main(out_path):
    mix = np.zeros((2, N)); fx = np.zeros((2, N)); verb_send = np.zeros((2, N))
    drums, synth, pads, kick_times = music()

    # sidechain: la música "bombea" con el bombo
    duck = np.ones(N)
    for kt in kick_times:
        a, b = seg(kt, 0.3)
        duck[a:b] = np.minimum(duck[a:b], 1 - 0.55 * np.exp(-(T[a:b] - kt) / 0.09))
    music_bus = drums + (synth + pads) * duck
    # filtro de barrido: tramo final del lineup a merch abre; logo con paso bajo
    def lp_curve(tc, f):
        fc = 900 if tc < 2.5 else (20000 if tc < 16.6 else np.interp(tc, [16.6, 17.0, 18.9, 19.0], [20000, 500, 1400, 20000]))
        return 1 / np.sqrt(1 + (f / fc) ** 4)
    music_bus = np.stack([tv_filter(music_bus[c], lp_curve) for c in range(2)])
    mix += music_bus * 0.8
    verb_send += (synth + pads) * 0.35 + drums * 0.08

    # motor
    eng, rpm, bov_times = engine()
    place(mix, eng, 0, 0.8, 0)
    stereo_d = int(0.007 * SR)
    mix[1, stereo_d:] += eng[:-stereo_d] * 0.08
    for bt in bov_times: place(fx, bov(), bt + 0.02, 0.9, 0.3)
    for i, at in enumerate(TL['antilag']):
        place(fx, pop(1.0 - 0.15 * (i % 3)), at, 0.75, (-0.3, 0.25, -0.1)[i % 3])
        place(verb_send, pop(0.5), at, 0.4)

    # grava y piedras en el tramo
    a, b = seg(6.5, 4.0)
    nz = rng.standard_normal(b - a)
    grav = tv_filter(nz, lambda tc, f: band(2400, 1.2)(f)) * 0.08
    rocks = np.zeros(b - a)
    for _ in range(260):
        p = int(rng.uniform(0, b - a - 2000)); L = int(rng.uniform(150, 900))
        rocks[p:p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / (L / 4)) * rng.uniform(0.1, 0.6)
    gravel = (grav + highpass(rocks, 1200) * 0.35) * np.minimum(1, (T[a:b] - 6.5) / 0.1) * np.minimum(1, (10.5 - T[a:b]) / 0.2)
    place(fx, gravel, 6.5, 0.7, -0.2); place(fx, gravel[::-1].copy(), 6.5, 0.5, 0.25)
    # público al paso (Grupo B = gente en la cuneta)
    a, b = seg(7.6, 1.2)
    crowd = tv_filter(rng.standard_normal(b - a), lambda tc, f: band(900, 1.3)(f)) * np.sin(np.pi * np.arange(b - a) / (b - a)) ** 2 * 0.18
    place(fx, crowd, 7.6, 1.0, 0.4)

    # cuenta atrás + ignición
    for ct in TL['countdown']:
        place(fx, beep(1000), ct, 0.9)
        place(verb_send, beep(1000), ct, 0.5)
    place(fx, beep(1500, 0.5), 1.5, 0.6)
    # impactos en cortes clave
    for h in TL['hits']:
        place(fx, reverse_swell(), h - 0.45, 0.8)
        place(fx, impact(1.0 if h in (1.5, 19.0) else 0.75), h, 0.95)
        place(verb_send, impact(0.5), h, 0.5)
    # whooshes de cámara / transiciones
    for i, w in enumerate(TL['whooshes']):
        place(fx, whoosh(0.55, 250, 7000, 0.75), w - 0.4, 0.75, (-0.6, 0.6)[i % 2])
    # whooshes de los desplazamientos del lineup + ticks de aterrizaje
    for i in range(3):
        tmove = 10.5 + i + 0.5
        place(fx, whoosh(0.5, 400, 4000, 0.8), tmove, 0.45, 0.7 - i * 0.3)
        place(fx, tick(2400), tmove + 0.5, 0.5, 0.2)
    # callouts del revelado y letras del logo
    for t0 in (1.0, 1.35, 1.7, 2.05):
        place(fx, tick(3600), 2.5 + t0, 0.35, 0.5)
    for i in range(11):
        place(fx, tick(1800 + i * 90, 0.05), 18.0 + i * 0.06, 0.4, -0.6 + i * 0.12)
    place(fx, riser(1.4, 150, 7000), 15.6, 0.35)
    place(fx, riser(0.9, 200, 5000), 5.6, 0.35)
    # deriva y frenada del coche en el logo
    a, b = seg(17.0, 0.9)
    skid = tv_filter(rng.standard_normal(b - a), lambda tc, f: band(1100 + 300 * np.sin(tc * 40), 0.4)(f)) * np.exp(-(T[a:b] - 17.0) / 0.4) * 0.35
    place(fx, skid, 17.0, 1.0, 0.3)

    mix += fx
    # reverb: convolución con ruido de decaimiento exponencial (estéreo decorrelado)
    L = int(1.9 * SR); tt = np.arange(L) / SR
    for c in range(2):
        ir = rng.standard_normal(L) * np.exp(-tt / 0.45)
        ir = lowpass1(ir, 6000); ir[: int(0.012 * SR)] = 0
        wet = np.fft.irfft(np.fft.rfft(verb_send[c], N + L) * np.fft.rfft(ir, N + L), N + L)[:N]
        mix[c] += wet * 0.06

    # máster: HPF suave, saturación, normalización y fundido final
    mix = np.stack([highpass(mix[c], 25, 1) for c in range(2)])
    mix *= np.minimum(1, (DUR - T) / 0.35)[None, :] * np.minimum(1, T / 0.01)[None, :]
    peak = np.max(np.abs(mix))
    mix = np.tanh(mix / peak * 1.6) / np.tanh(1.6)
    mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
    pcm = (mix.T * 32767).astype('<i2')
    with wave.open(out_path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('ok', out_path, 'rms dBFS', 20 * np.log10(np.sqrt(np.mean(mix ** 2))))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'out/audio.wav')
