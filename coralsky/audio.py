"""Música y efectos de sonido sintetizados para el video de Coral Sky.

Uso: python3 audio.py eventos.json duracion_segundos salida.wav
eventos.json = [{"t": segundos, "type": "click|key|whoosh|swoosh|ding|pop|notify|success|shimmer|riser"}, ...]
"""
import json, sys, wave
import numpy as np

SR = 44100
rng = np.random.default_rng(7)


def t_arr(dur):
    return np.arange(int(dur * SR)) / SR


def env_adsr(n, a, d, s, r, sus_level=0.7):
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    s = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, a, endpoint=False), np.linspace(1, sus_level, d, endpoint=False),
                        np.full(s, sus_level), np.linspace(sus_level, 0, r)])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def lowpass_fft(x, cutoff, slope=2.0):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= 1 / np.sqrt(1 + (f / cutoff) ** (2 * slope))
    return np.fft.irfft(X, len(x))


def bandpass_fft(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR)
    X *= ((f > lo) & (f < hi)).astype(float)
    return np.fft.irfft(X, len(x))


def onepole_sweep(x, c0, c1):
    """Low-pass with cutoff sweeping from c0 to c1 Hz (for whooshes)."""
    y = np.zeros_like(x)
    cs = np.geomspace(c0, c1, len(x))
    a = 1 - np.exp(-2 * np.pi * cs / SR)
    prev = 0.0
    for i in range(len(x)):
        prev += a[i] * (x[i] - prev)
        y[i] = prev
    return y


def reverb(x, seconds=2.2, mix=0.25):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.linspace(0, 7, n))
    ir = lowpass_fft(ir, 5000)
    ir /= np.sqrt(np.sum(ir ** 2))
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    wet = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:len(x)]
    return x * (1 - mix) + wet * mix * 0.9


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


# ---------------------------------------------------------------- music
BPM = 98
BEAT = 60 / BPM
BAR = 4 * BEAT
# F maj7, A m7, D m7, Bb maj7  (warm, summery)
CHORDS = [[53, 57, 60, 64], [57, 60, 64, 67], [50, 53, 57, 60], [46, 50, 53, 57]]
BASS = [41, 45, 38, 46]


def add(buf, sig, start):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[:j - i]


def pad_voice(f, dur):
    t = t_arr(dur)
    s = np.zeros_like(t)
    for k, amp in [(1, 1), (2, .35), (3, .18), (4, .08)]:
        for det in (-0.12, 0.12):
            s += amp * np.sin(2 * np.pi * f * k * (1 + det / 100) * t + rng.uniform(0, 6))
    return s * env_adsr(len(t), 0.6, 0.6, 0, 0.9, 0.8)


def marimba(f, dur=0.6):
    t = t_arr(dur)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 4 * t) * np.exp(-t * 30) + 0.1 * np.sin(2 * np.pi * f * 10 * t) * np.exp(-t * 60)
    return s * np.exp(-t * 7) * np.minimum(1, t * 400)


def bass_note(f, dur):
    t = t_arr(dur)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * 2 * f * t)
    return s * env_adsr(len(t), 0.01, 0.15, 0, 0.12, 0.75)


def kick():
    t = t_arr(0.45)
    f = 45 + 85 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 7.5) * 1.0


def clap():
    t = t_arr(0.3)
    n = bandpass_fft(rng.standard_normal(len(t)), 900, 5000)
    e = np.exp(-t * 22) * (1 + 0.6 * (np.sin(2 * np.pi * 90 * t) > 0) * np.exp(-t * 80))
    return n * e * 0.4


def shaker(open_=False):
    t = t_arr(0.18 if open_ else 0.07)
    n = bandpass_fft(rng.standard_normal(len(t)), 6000, 14000)
    return n * np.exp(-t * (18 if open_ else 55)) * (0.11 if open_ else 0.075)


def music(duration, drop_at, outro_at):
    L = int((duration + 3) * SR)
    pads = np.zeros(L); plk = np.zeros(L); bas = np.zeros(L); drm = np.zeros(L); side = np.ones(L)
    bars = int(duration / BAR) + 2
    arp = [0, 2, 1, 3, 2, 1, 3, 2]
    for b in range(bars):
        t0 = b * BAR
        ch = CHORDS[b % 4]
        for m in ch:
            add(pads, pad_voice(note(m), BAR + 0.4) * 0.07, t0)
        for i in range(8):
            m = ch[arp[i]] + 12 + (12 if i in (3, 6) else 0)
            vel = 0.22 if i % 2 == 0 else 0.15
            add(plk, marimba(note(m)) * vel, t0 + i * BEAT / 2)
        in_groove = drop_at <= t0 < outro_at
        if in_groove:
            add(bas, bass_note(note(BASS[b % 4] - 12), BEAT * 1.4) * 0.5, t0)
            add(bas, bass_note(note(BASS[b % 4] - 12), BEAT * 0.9) * 0.4, t0 + BEAT * 1.5)
            add(bas, bass_note(note(BASS[b % 4]), BEAT * 0.9) * 0.3, t0 + BEAT * 3)
            for k in range(4):
                add(drm, kick() * 0.75, t0 + k * BEAT)
                i = int((t0 + k * BEAT) * SR)
                dip = np.interp(np.arange(int(BEAT * SR)), [0, int(0.02 * SR), int(0.28 * SR)], [1, 0.55, 1])
                side[i:i + len(dip)] = np.minimum(side[i:i + len(dip)], dip[:max(0, min(len(dip), L - i))])
            for k in (1, 3):
                add(drm, clap(), t0 + k * BEAT)
            for k in range(16):
                add(drm, shaker(open_=(k % 4 == 2)), t0 + k * BEAT / 4 + 0.012 * (k % 2))
    pads = lowpass_fft(pads, 2200)
    plk_delay = np.zeros(L)
    d = int(BEAT * 0.75 * SR)
    plk_delay[d:] += plk[:-d] * 0.32
    plk_delay[2 * d:] += plk[:-2 * d] * 0.12
    plk = plk + lowpass_fft(plk_delay, 3500)
    mix = pads * side + plk + bas * side + drm
    mix = reverb(mix, 2.4, 0.22)
    t = np.arange(L) / SR
    fade_in = np.clip(t / 1.2, 0, 1)
    fade_out = np.clip((duration - t) / 3.5, 0, 1)
    swell = np.interp(t, [0, drop_at - 2, drop_at], [0.75, 0.85, 1.0])
    return (mix * fade_in * fade_out * swell)[:int(duration * SR)]


# ---------------------------------------------------------------- sfx
def sfx_click():
    t = t_arr(0.06)
    s = np.sin(2 * np.pi * 2200 * t) * np.exp(-t * 140) + 0.4 * bandpass_fft(rng.standard_normal(len(t)), 2000, 9000) * np.exp(-t * 250)
    return s * 0.42


def sfx_key():
    t = t_arr(0.035)
    f = rng.uniform(1500, 1900)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 260) + 0.5 * bandpass_fft(rng.standard_normal(len(t)), 3000, 10000) * np.exp(-t * 400)
    return s * 0.22


def sfx_whoosh(dur=0.42, c0=300, c1=3200, vol=0.2):
    n = rng.standard_normal(int(dur * SR))
    s = onepole_sweep(n, c0, c1)
    t = t_arr(dur)
    e = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.5
    return s * e * vol


def sfx_swoosh():
    s = sfx_whoosh(0.85, 250, 4500, 0.24)
    t = t_arr(0.85)
    s += 0.05 * np.sin(2 * np.pi * np.cumsum(np.geomspace(500, 1500, len(t))) / SR) * np.sin(np.pi * t / 0.85)
    return s


def bell(f, dur=1.4, vol=0.25):
    t = t_arr(dur)
    s = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.2) + 0.45 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t * 6) + 0.2 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t * 10)
    return s * np.minimum(1, t * 600) * vol


def sfx_ding():
    s = np.zeros(int(1.6 * SR))
    add(s, bell(note(91), 1.4, 0.22), 0)
    add(s, bell(note(96), 1.2, 0.16), 0.09)
    return s


def sfx_pop():
    t = t_arr(0.12)
    f = 300 + 700 * np.exp(-t * 40)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.35


def sfx_notify():
    s = np.zeros(int(1.4 * SR))
    add(s, bell(note(88), 1.0, 0.16), 0)
    add(s, bell(note(93), 1.2, 0.16), 0.12)
    return s


def sfx_success():
    s = np.zeros(int(2.6 * SR))
    for i, m in enumerate([84, 88, 91, 96, 100]):
        add(s, bell(note(m), 1.6, 0.15), i * 0.075)
    sp = bandpass_fft(rng.standard_normal(int(1.2 * SR)), 7000, 15000)
    sp *= np.exp(-t_arr(1.2) * 3) * (rng.random(len(sp)) > 0.985) * 1.4
    add(s, sp * 0.4, 0.3)
    return s


def sfx_shimmer():
    s = np.zeros(int(2.4 * SR))
    for i, m in enumerate([72, 76, 79, 84, 88, 91]):
        add(s, bell(note(m), 1.6, 0.09), i * 0.12)
    return s


def sfx_riser():
    dur = 1.8
    n = rng.standard_normal(int(dur * SR))
    s = onepole_sweep(n, 200, 7000)
    t = t_arr(dur)
    return s * (t / dur) ** 2.2 * 0.22


SFX = {'click': sfx_click, 'key': sfx_key, 'whoosh': sfx_whoosh, 'swoosh': sfx_swoosh, 'ding': sfx_ding, 'pop': sfx_pop,
       'notify': sfx_notify, 'success': sfx_success, 'shimmer': sfx_shimmer, 'riser': sfx_riser}


def main():
    events = json.load(open(sys.argv[1]))
    dur = float(sys.argv[2])
    out = sys.argv[3]
    drop = next((e['t'] for e in events if e['type'] == 'drop'), 6.5)
    outro = next((e['t'] for e in events if e['type'] == 'outro'), dur - 6)
    m = music(dur, drop, outro)
    fx = np.zeros(len(m) + SR * 3)
    cache = {}
    for e in events:
        k = e['type']
        if k not in SFX:
            continue
        sig = SFX[k]() if k in ('key', 'whoosh') else cache.setdefault(k, SFX[k]())
        add(fx, sig, max(0, e['t']))
    fx = reverb(fx[:len(m)], 1.0, 0.12)
    mix = m * 0.85 + fx * 0.9
    mix = np.tanh(mix * 1.3) / np.tanh(1.3)
    mix *= 0.89 / max(1e-6, np.max(np.abs(mix)))
    st = np.stack([mix, mix], axis=1)
    pcm = (st * 32767).astype(np.int16)
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print('ok', out, dur, len(events))


if __name__ == '__main__':
    main()
