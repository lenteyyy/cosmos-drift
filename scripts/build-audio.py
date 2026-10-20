"""Render ten original ambient compositions (numpy, no borrowed samples).
Existing scores are retained; use --force to render every piece again.
"""
from pathlib import Path
import tempfile, wave, sys
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / 'public/audio'
ROOT.mkdir(parents=True, exist_ok=True)
SR, LENGTH = 22050, 80
SCORES = [
    ('blue-orbit', 52, 48, [0, 5, 9, 7, 0, -3, 5, 7], [0, 7, 14, 19], [14, 19, 16, 14, 7, 9, 12, 7]),
    ('stellar-tides', 67, 45, [0, 3, 7, 5, 0, 10, 3, 7], [0, 7, 12, 15], [19, 15, 12, 22, 19, 14, 10, 7]),
    ('andromeda', 58, 50, [0, -5, 2, 7, 0, 4, -5, 7], [0, 7, 11, 18], [23, 18, 14, 11, 18, 26, 23, 19]),
    ('silent-expanse', 41, 40, [0, 7, 3, -2, 0, 5, 10, 7], [0, 7, 14, 15], [26, 22, 19, 14, 15, 19, 22, 14]),
    ('event-horizon', 76, 38, [0, 1, -2, 3, 0, -5, 1, -2], [0, 7, 13, 15], [12, 13, 19, 15, 13, 12, 10, 7]),
    ('folded-light', 88, 55, [0, -3, 5, 2, 0, 7, 5, 2], [0, 7, 14, 16], [16, 19, 23, 26, 28, 23, 19, 14]),
    ('abyssal-current', 32, 31, [0, 7, 1, -5, 3, 0, 8, -2], [0, 7, 14, 15], [26, 19, 15, 22, 13, 19, 26, 27]),
    ('intergalactic-rain', 47, 43, [0, 5, -4, 7, 2, 0, -5, 5], [0, 7, 11, 18], [30, 26, 23, 19, 18, 23, 26, 35]),
    ('dark-matter', 28, 29, [0, 1, -5, 6, 0, 8, 3, -2], [0, 7, 13, 19], [31, 26, 25, 19, 20, 26, 32, 25]),
    ('beyond-the-veil', 39, 38, [0, 4, 7, 2, -3, 5, 9, 0], [0, 7, 14, 21], [28, 26, 21, 19, 23, 28, 33, 35]),
]

def freq(note): return 440 * 2 ** ((note-69)/12)
def render(score, index, tmp):
    name, bpm, root, progression, intervals, motif = score
    length = 120 if index >= 6 else LENGTH
    if (ROOT/f'{name}.wav').exists() and '--force' not in sys.argv: return
    rng = np.random.default_rng(940 + index)
    out = np.zeros((SR*length, 2), dtype=np.float32)
    def note(midi, start, duration, gain, pan=0, kind='pad'):
        a, n = int(start*SR), min(int(duration*SR), len(out)-int(start*SR))
        if n <= 0: return
        t = np.arange(n, dtype=np.float32)/SR
        f = freq(midi)
        if kind == 'pad':
            env = np.minimum(t/(4.8 if index>=6 else 2.8), 1) * np.minimum((duration-t)/5, 1)
            tone = (np.sin(2*np.pi*f*t + .22*np.sin(t*.6)) + .32*np.sin(2*np.pi*f*1.0017*t) + .12*np.sin(2*np.pi*f*2*t)) / 1.44
        elif kind == 'bell':
            env = (1-np.exp(-t*35))*np.exp(-t/(1.5+index*.13))
            tone = np.sin(2*np.pi*f*t) + .27*np.sin(2*np.pi*f*2.004*t)*np.exp(-t*2) + .12*np.sin(2*np.pi*f*3.01*t)*np.exp(-t*4)
        elif kind == 'reverse':
            env = np.sin(np.pi*t/duration)**3
            tone = np.sin(2*np.pi*f*t+.4*np.sin(t*.8)) + .18*np.sin(2*np.pi*f*1.5*t)
        else:
            env = (1-np.exp(-t*24))*np.exp(-t/.3)
            tone = np.sin(2*np.pi*f*t + .12*np.sin(2*np.pi*f*2*t))
        tone = tone * env * gain
        out[a:a+n,0] += tone * np.sqrt((1-pan)/2)
        out[a:a+n,1] += tone * np.sqrt((1+pan)/2)
    for bar, shift in enumerate(progression):
        start = bar*(14 if index>=6 else 9.5)
        for j, interval in enumerate(intervals):
            note(root+shift+interval, start, 23 if index>=6 else 14, .12 if j==0 else .047, (j-1.5)*.4)
        note(root+shift-12, start, 21 if index>=6 else 12, .075, 0)
        if index>=6:
            note(root+shift+motif[bar], start+4, 14, .018, np.sin(bar)*.7, 'reverse')
    beat = 60/bpm
    for i, t in enumerate(np.arange(4, length-4, beat*(3 if index>=6 else 2 if index in [0,3] else 1))):
        bar = min(7, int(t/(14 if index>=6 else 9.5)))
        if index==3 and i%3: continue
        if i%16 >= 12 and index!=5: continue  # breathing space between phrases
        note(root+progression[bar]+motif[(i//2+index)%8], t, 9 if index>=6 else 5.5, .019 if index>=6 else .038 if index!=5 else .045, np.sin(i*1.7)*.65, 'bell')
        if index in [1,4,5] and i%2==0:
            note(root+progression[bar]+intervals[i%4]+12, t+beat*.5, 1.1, .023, -.5 if i%4 else .5, 'pluck')
    # Diffuse stereo echoes, slow-moving air and wide reverberant tails.
    dry=out.copy()
    for delay, decay in [(0.37+index*.021,.24),(.79+index*.07,.18),(1.83,.12),(3.37,.07)]:
        n=int(delay*SR)
        out[n:] += dry[:-n,::-1]*decay
    if index>=6:
        for delay,decay in [(4.71,.13),(7.23,.09),(10.61,.055)]:
            n=int(delay*SR); out[n:] += dry[:-n,::-1]*decay
    t=np.arange(len(out),dtype=np.float32)/SR
    for ch in [0,1]:
        air=np.cumsum(rng.normal(0,1,len(out)).astype(np.float32))
        air=air/np.max(np.abs(air))
        out[:,ch] += air*.006*np.sin(t*.13+ch)
    envelope=np.minimum(t/3,1)*np.minimum((length-t)/5,1)
    out *= envelope[:,None]
    out *= .86/max(.001,float(np.max(np.abs(out))))
    pcm=(np.tanh(out)*32767).astype('<i2')
    wav=tmp/f'{name}.wav'
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR); f.writeframes(pcm.tobytes())
    import shutil
    shutil.copyfile(wav, ROOT/f'{name}.wav')
    print(f'Rendered {name}: {length}s',flush=True)

with tempfile.TemporaryDirectory(prefix='cosmos-score-') as folder:
    tmp=Path(folder)
    for i,score in enumerate(SCORES): render(score,i,tmp)
