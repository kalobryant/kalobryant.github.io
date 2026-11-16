'use strict';
/* Tiny chiptune engine: square/triangle/noise voices via WebAudio. All music here is original. */
const Sound = (() => {
  let ac = null, master = null, musicGain = null, sfxGain = null, noiseBuf = null;
  let muted = false, track = null, pending = null, step = 0, nextT = 0, timer = null;
  const mf = m => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ac.destination);
    musicGain = ac.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
    sfxGain = ac.createGain(); sfxGain.gain.value = 0.35; sfxGain.connect(master);
    noiseBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.25), ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (pending) play(pending);
  }

  function osc(type, freq, t, dur, vol, dest, slide) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(t, dur, vol, dest) {
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = 5000;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t); s.stop(t + dur + 0.01);
  }

  const SFX = {
    blip: t => osc('square', 990, t, 0.03, 0.10, sfxGain),
    select: t => osc('square', 660, t, 0.05, 0.25, sfxGain),
    alert: t => { osc('square', 880, t, 0.07, 0.4, sfxGain); osc('square', 1320, t + 0.08, 0.14, 0.4, sfxGain); },
    pickup: t => [660, 880, 1320].forEach((f, i) => osc('square', f, t + i * 0.06, 0.08, 0.3, sfxGain)),
    help: t => [523, 659, 784, 1047].forEach((f, i) => osc('square', f, t + i * 0.08, 0.1, 0.3, sfxGain)),
    bump: t => osc('square', 120, t, 0.08, 0.4, sfxGain, 70),
    ring: t => { for (let i = 0; i < 8; i++) osc('square', i % 2 ? 1180 : 940, t + i * 0.07, 0.06, 0.22, sfxGain); },
    reject: t => osc('sawtooth', 220, t, 0.3, 0.3, sfxGain, 90),
    accept: t => { osc('square', 784, t, 0.08, 0.3, sfxGain); osc('square', 1047, t + 0.09, 0.15, 0.3, sfxGain); },
    caught: t => [660, 523, 392, 262].forEach((f, i) => osc('square', f, t + i * 0.1, 0.1, 0.3, sfxGain)),
    toss: t => osc('square', 500, t, 0.12, 0.25, sfxGain, 1200),
    cry: t => { osc('triangle', 700, t, 0.18, 0.22, sfxGain, 950); osc('triangle', 900, t + 0.18, 0.25, 0.22, sfxGain, 600); },
    scribble: t => { for (let i = 0; i < 8; i++) noise(t + i * 0.09, 0.06, 0.3, sfxGain); },
    gulp: t => { osc('triangle', 300, t, 0.1, 0.4, sfxGain, 180); osc('triangle', 300, t + 0.15, 0.1, 0.4, sfxGain, 180); },
    whirr: t => osc('sawtooth', 110, t, 0.6, 0.15, sfxGain, 260),
    fanfare: t => [[67, 0], [72, .12], [76, .24], [79, .36], [76, .6], [79, .72], [84, .84]]
      .forEach(([m, d], i) => osc('square', mf(m), t + d, i === 6 ? 0.7 : 0.11, 0.3, sfxGain))
  };

  function bassFrom(roots) { const o = []; for (const r of roots) o.push(r, 0, r, r + 12, 0, r, r + 12, r); return o; }
  const TRACKS = {
    sneak: {
      bpm: 132, hat: true, leadVol: 0.16, leadLen: 0.85,
      bass: bassFrom([45, 45, 41, 43, 45, 45, 41, 40]),
      lead: [69, 0, 72, 0, 71, 69, 0, 64, 0, 0, 67, 69, 0, 0, 0, 0,
             65, 0, 69, 0, 67, 65, 0, 64, 0, 0, 62, 64, 0, 0, 0, 0,
             69, 0, 72, 0, 74, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 0,
             65, 0, 69, 0, 72, 71, 69, 67, 64, 0, 0, 0, 68, 0, 0, 0]
    },
    title: {
      bpm: 100, hat: false, leadVol: 0.14, leadLen: 1.6,
      bass: bassFrom([45, 41, 48, 43]).map((n, i) => (i % 2 ? 0 : n)),
      lead: [69, 0, 0, 0, 76, 0, 0, 0, 74, 0, 72, 0, 71, 0, 0, 0,
             72, 0, 0, 0, 71, 0, 0, 0, 69, 0, 67, 0, 69, 0, 0, 0]
    }
  };

  function schedule() {
    if (!track || !ac) return;
    const sd = 60 / track.bpm / 2;
    while (nextT < ac.currentTime + 0.12) {
      const i = step % track.lead.length;
      const b = track.bass[i % track.bass.length];
      if (b) osc('triangle', mf(b), nextT, sd * 0.9, 0.5, musicGain);
      const l = track.lead[i];
      if (l) osc('square', mf(l), nextT, sd * track.leadLen, track.leadVol, musicGain);
      if (track.hat && i % 2 === 1) noise(nextT, 0.03, 0.12, musicGain);
      nextT += sd; step++;
    }
  }
  function play(name) {
    pending = name;
    if (!ac) return;
    track = TRACKS[name] || null; step = 0; nextT = ac.currentTime + 0.05;
    if (!timer) timer = setInterval(schedule, 25);
  }
  function stop() { track = null; pending = null; }
  function sfx(n) { if (ac && SFX[n]) SFX[n](ac.currentTime + 0.01); }
  function toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : 0.5; return muted; }
  return { init, sfx, play, stop, toggleMute, get muted() { return muted; } };
})();
