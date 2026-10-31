# Alinea el guion con la toma: silencios + núcleos silábicos + programación dinámica.
# Uso: python3 -I scripts/align.py vo/take16.wav vo/guion.txt out/vo-map.json
import sys, re, json, wave, subprocess
import numpy as np

wav, txt, out = sys.argv[1:4]
w = wave.open(wav); sr = w.getframerate()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
dur = len(x) / sr

# Núcleos silábicos: picos de energía de 300 a 2500 Hz con prominencia.
hop, win = 160, 400
n = (len(x) - win) // hop
frames = np.lib.stride_tricks.sliding_window_view(x, win)[::hop][:n]
S = np.abs(np.fft.rfft(frames * np.hanning(win), axis=1)) ** 2
f = np.fft.rfftfreq(win, 1 / sr)
db = 10 * np.log10(S[:, (f > 300) & (f < 2500)].sum(axis=1) + 1e-10)
db = np.convolve(db, np.ones(5) / 5, mode='same')
thr = db.max() - 35
pk = []
for i in range(1, n - 1):
    if db[i] > db[i - 1] and db[i] >= db[i + 1] and db[i] > thr:
        if db[i] - max(db[max(0, i - 25):i].min(), db[i + 1:i + 26].min()) > 3:
            if pk and i - pk[-1] < 8:
                if db[i] > db[pk[-1]]: pk[-1] = i
            else:
                pk.append(i)
peaks = np.array(pk) * hop / sr

# Silencios.
log = subprocess.run(['ffmpeg', '-v', 'info', '-i', wav, '-af', 'silencedetect=noise=-42dB:d=0.12', '-f', 'null', '-'],
                     capture_output=True, text=True).stderr
st = [float(v) for v in re.findall(r'silence_start: ([0-9.]+)', log)]
en = [float(v) for v in re.findall(r'silence_end: ([0-9.]+)', log)]
chunks, prev = [], 0.0
for a, b in zip(st, en):
    if a - prev > 0.08: chunks.append((prev, a))
    prev = b
if dur - prev > 0.08: chunks.append((prev, dur))
csyl = [int(((peaks >= a) & (peaks < b)).sum()) for a, b in chunks]

# Guion en cláusulas, con números y siglas en su forma hablada para contar sílabas.
SPOKEN = {
    '205': 'doscientos cinco', 'T16': 'te dieciséis', '16': 'dieciséis', '80': 'ochenta', '037': 'cero treinta y siete',
    '1.8': 'uno coma ocho', 'KKK': 'ka ka ka', '20': 'veinte', '1': 'uno', '2': 'dos', '350': 'trescientos cincuenta',
    '1984': 'mil novecientos ochenta y cuatro', '1985': 'mil novecientos ochenta y cinco', '1986': 'mil novecientos ochenta y seis',
    '1987': 'mil novecientos ochenta y siete', '88': 'ochenta y ocho', '85': 'ochenta y cinco', '500': 'quinientos',
    '2.5': 'dos coma cinco', '910': 'novecientos diez', '200': 'doscientos', 'S4': 'ese cuatro', 'FIA': 'fia',
}
V = 'aeiouáéíóúü'
def vowels(w):
    nn, prevc = 0, ''
    for c in w:
        if c in V and not (prevc in V and not (prevc in 'aeoáéó' and c in 'aeoáéó')): nn += 1
        prevc = c
    return max(1, nn) if any(c in V for c in w) else max(1, len(w) // 2)

def syl(word):
    w = re.sub(r'[^\wáéíóúüñ.]', '', word.lower()).strip('.')
    if not w: return 0
    for k, v in SPOKEN.items():
        if w == k.lower(): return sum(vowels(p) for p in v.split())
    return vowels(w)

text = open(txt).read().strip()
parts = re.split(r'(?<=[,.:;?!…])\s+', text)
clauses = [p for p in parts if p.strip()]
qsyl = [sum(syl(wd) for wd in c.split()) for c in clauses]

# DP: grupos contiguos de cláusulas ↔ grupos contiguos de fragmentos.
L, Mc = len(clauses), len(chunks)
INF = 1e18
cost = np.full((L + 1, Mc + 1), INF); back = {}
cost[0, 0] = 0
ratio = sum(csyl) / sum(qsyl)
for i in range(L + 1):
    for j in range(Mc + 1):
        if cost[i, j] >= INF: continue
        for a in range(1, 5):
            if i + a > L: break
            q = sum(qsyl[i:i + a]) * ratio
            for b in range(1, 6):
                if j + b > Mc: break
                s = sum(csyl[j:j + b])
                c = cost[i, j] + abs(s - q) / np.sqrt(q + 4) + 0.15 * (a + b - 2)
                if c < cost[i + a, j + b]:
                    cost[i + a, j + b] = c; back[(i + a, j + b)] = (i, j)
i, j = L, Mc
groups = []
while (i, j) != (0, 0):
    pi, pj = back[(i, j)]
    groups.append((pi, i, pj, j)); i, j = pi, pj
groups.reverse()
res = []
for ci0, ci1, cj0, cj1 in groups:
    t0, t1 = chunks[cj0][0], chunks[cj1 - 1][1]
    # Dentro del grupo, reparto por sílabas detectadas.
    inner = [p for p in peaks if t0 <= p < t1]
    tot = sum(qsyl[ci0:ci1]); acc = 0
    for k in range(ci0, ci1):
        f0 = acc / tot; acc += qsyl[k]; f1 = acc / tot
        def at(fr):
            if not inner: return t0 + (t1 - t0) * fr
            idx = min(len(inner) - 1, int(round(fr * (len(inner) - 1))))
            return inner[idx] if 0 < fr < 1 else (t0 if fr == 0 else t1)
        res.append({'i': k, 'start': round(float(at(f0) if k > ci0 else t0), 2), 'end': round(float(at(f1) if k < ci1 - 1 else t1), 2), 'syl': qsyl[k], 'text': clauses[k]})
json.dump(res, open(out, 'w'), ensure_ascii=False, indent=1)
print(f'{len(chunks)} fragmentos, {len(clauses)} cláusulas, sílabas detectadas/guion = {sum(csyl)}/{sum(qsyl)}, coste {cost[L, Mc]:.1f}')
for r in res: print(f"{r['i']:3d} {r['start']:7.2f} {r['end']:7.2f}  {r['text'][:80]}")
