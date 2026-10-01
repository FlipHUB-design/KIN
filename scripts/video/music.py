"""Original background track for the KIN video: warm pads, a plucked arpeggio,
sub bass and a light beat, about 104 BPM. Written from scratch, so it's free to use.

Usage: python3 music.py seconds out.wav
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

SR = 44100
BPM = 104
BEAT = 60 / BPM
BAR = 4 * BEAT
rng = np.random.default_rng(7)

def hz(n): return 440.0 * 2 ** ((n - 69) / 12)

# Fmaj7 - G6 - Em7 - Am7 (MIDI notes), a hopeful, modern progression
CHORDS = [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 67]]
ROOTS = [41, 43, 40, 45]

def lp(x, cut, order=2): return sosfilt(butter(order, cut, "low", fs=SR, output="sos"), x)
def hp(x, cut, order=2): return sosfilt(butter(order, cut, "high", fs=SR, output="sos"), x)

def env(n, a, r):
    e = np.ones(n); ai = int(a * SR); ri = int(r * SR)
    if ai: e[:ai] = np.linspace(0, 1, ai)
    if ri: e[-ri:] *= np.linspace(1, 0, ri)
    return e

def saw(f, t): return 2 * ((t * f) % 1) - 1

def pad(chord, dur):
    t = np.arange(int(dur * SR)) / SR; x = np.zeros_like(t)
    for n in chord:
        for det in (-0.12, 0.0, 0.11):
            x += saw(hz(n + 12) * 2 ** (det / 12), t + rng.random())
    x = lp(x, 1400) * env(len(t), 0.6, 0.8)
    return x / 14

def pluck(n, dur=0.45):
    t = np.arange(int(dur * SR)) / SR
    f = hz(n)
    x = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) + 0.12 * np.sign(np.sin(2 * np.pi * f * t))) * np.exp(-t * 9)
    return x * env(len(t), 0.004, 0.05) * 0.32

def bass(n, dur):
    t = np.arange(int(dur * SR)) / SR
    x = np.sin(2 * np.pi * hz(n) * t) + 0.25 * np.sin(2 * np.pi * hz(n + 12) * t)
    return x * env(len(t), 0.01, 0.06) * 0.42

def kick():
    t = np.arange(int(0.35 * SR)) / SR
    f = 50 + 110 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.85

def hat(open_=False):
    n = int((0.18 if open_ else 0.05) * SR)
    x = hp(rng.standard_normal(n), 7000) * np.exp(-np.arange(n) / SR * (18 if open_ else 70))
    return x * 0.12

def clap():
    n = int(0.2 * SR); x = rng.standard_normal(n)
    x = sosfilt(butter(2, [900, 2500], "band", fs=SR, output="sos"), x) * np.exp(-np.arange(n) / SR * 22)
    return x * 0.35

def add(buf, x, at, pan=0.0):
    i = int(at * SR)
    if i >= buf.shape[1]: return
    x = x[: buf.shape[1] - i]
    buf[0, i:i + len(x)] += x * (1 - max(0, pan))
    buf[1, i:i + len(x)] += x * (1 + min(0, pan))

def render(seconds):
    bars = int(np.ceil(seconds / BAR)) + 1
    total = int(bars * BAR * SR)
    pads = np.zeros((2, total)); music = np.zeros((2, total)); drums = np.zeros((2, total))
    duck = np.ones(total)
    K, H, HO, C = kick(), hat(), hat(True), clap()
    full_from, break_at = 4, max(8, bars // 2 - 2)
    for b in range(bars):
        t0 = b * BAR; ci = b % 4; ch = CHORDS[ci]
        add(pads, pad(ch, BAR + 0.6), t0, 0)
        breakdown = break_at <= b < break_at + 2
        outro = b >= bars - 2
        # arpeggio: 8th notes over chord tones, an octave up, ping-pong panned
        arp = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[3] + 12, ch[2] + 12, ch[1] + 12, ch[3] + 12, ch[2] + 24]
        for i, n in enumerate(arp):
            if b < 2 and i % 2: continue
            add(music, pluck(n), t0 + i * BEAT / 2, 0.35 if i % 2 else -0.35)
        if b >= 2 and not breakdown:
            for i in range(8):
                add(music, bass(ROOTS[ci] if i != 7 else ROOTS[ci] + 7, BEAT / 2 * 0.9), t0 + i * BEAT / 2)
        if b >= full_from and not breakdown and not outro:
            for beat in range(4):
                at = t0 + beat * BEAT
                add(drums, K, at); s = int(at * SR)
                d = np.minimum(1, 0.45 + np.linspace(0, 0.55, int(0.28 * SR)))
                duck[s:s + len(d)] = np.minimum(duck[s:s + len(d)], d[: max(0, min(len(d), total - s))])
                add(drums, H, at + BEAT / 2, 0.2)
                if beat in (1, 3) and b >= full_from + 4: add(drums, C, at)
                if beat == 3 and b % 2: add(drums, HO, at + BEAT / 2, -0.2)
    # simple stereo echo on the arpeggio
    d = int(BEAT * 0.75 * SR); echo = np.zeros_like(music)
    echo[0, d:] = music[1, :-d] * 0.32; echo[1, d:] = music[0, :-d] * 0.32
    mix = pads * duck * 0.9 + (music + lp(echo, 3500)) * (0.6 + 0.4 * duck) + drums
    mix = mix[:, : int(seconds * SR)]
    n = mix.shape[1]; fade = np.ones(n)
    fi, fo = int(1.5 * SR), int(3.5 * SR)
    fade[:fi] = np.linspace(0, 1, fi); fade[-fo:] = np.linspace(1, 0, fo)
    mix *= fade
    mix = np.tanh(mix * 1.1)
    mix /= np.max(np.abs(mix)) / 0.89
    return mix

if __name__ == "__main__":
    secs = float(sys.argv[1]); out = sys.argv[2]
    wavfile.write(out, SR, (render(secs).T * 32767).astype(np.int16))
