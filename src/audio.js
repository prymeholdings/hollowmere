// Original procedural music and sound effects, generated with the Web Audio API.
export const Audio = {
  ctx: null, master: null, music: null, sfxBus: null, reverb: null,
  vol: { master: 0.8, music: 0.55, sfx: 0.8 },
  track: null, nextBeat: 0, beat: 0, timer: null, intensity: 0,
};

function ctx() {
  if (Audio.ctx) return Audio.ctx;
  const C = new (window.AudioContext || window.webkitAudioContext)();
  Audio.ctx = C;
  Audio.master = C.createGain(); Audio.master.connect(C.destination);
  Audio.music = C.createGain(); Audio.music.connect(Audio.master);
  Audio.sfxBus = C.createGain(); Audio.sfxBus.connect(Audio.master);
  // generated reverb impulse
  const len = C.sampleRate * 3;
  const buf = C.createBuffer(2, len, C.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  Audio.reverb = C.createConvolver(); Audio.reverb.buffer = buf;
  const rv = C.createGain(); rv.gain.value = 0.35;
  Audio.reverb.connect(rv); rv.connect(Audio.master);
  applyVolumes();
  return C;
}
export function applyVolumes() {
  if (!Audio.ctx) return;
  Audio.master.gain.value = Audio.vol.master;
  Audio.music.gain.value = Audio.vol.music * 0.5;
  Audio.sfxBus.gain.value = Audio.vol.sfx;
}
export function unlockAudio() { const C = ctx(); if (C.state === 'suspended') C.resume(); }

const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

function voice(t, freq, dur, { type = 'triangle', gain = 0.2, attack = 0.01, release = null, filter = 0, dest, rev = 0.3, detune = 0 } = {}) {
  const C = Audio.ctx;
  const o = C.createOscillator();
  o.type = type; o.frequency.value = freq; o.detune.value = detune;
  const g = C.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
  let node = o;
  if (filter) { const f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(g);
  g.connect(dest || Audio.music);
  if (rev) { const s = C.createGain(); s.gain.value = rev; g.connect(s); s.connect(Audio.reverb); }
  o.start(t); o.stop(t + (release ?? dur) + 0.05);
}
function noise(t, dur, { gain = 0.2, filter = 800, type = 'lowpass', dest, q = 1 } = {}) {
  const C = Audio.ctx;
  const len = Math.floor(C.sampleRate * dur);
  const buf = C.createBuffer(1, len, C.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = C.createBufferSource(); s.buffer = buf;
  const f = C.createBiquadFilter(); f.type = type; f.frequency.value = filter; f.Q.value = q;
  const g = C.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(dest || Audio.music);
  s.start(t);
}

// ---------------- music ----------------
const TRACKS = {
  menu: { bpm: 70, chords: [[50, 57, 62, 65], [48, 55, 60, 64], [46, 53, 58, 62], [45, 52, 57, 61]], scale: [62, 64, 65, 67, 69, 72, 74], mood: 'warm' },
  town: { bpm: 84, chords: [[50, 57, 62, 65], [48, 55, 60, 67], [46, 53, 58, 65], [48, 55, 60, 64]], scale: [62, 64, 65, 67, 69, 71, 72, 74, 76], mood: 'warm' },
  dungeon: { bpm: 62, chords: [[45, 52, 57, 60], [46, 53, 58, 61], [45, 52, 57, 60], [43, 50, 55, 58]], scale: [57, 58, 60, 62, 64, 65, 69], mood: 'dark' },
  // new in 0.4: night in town, a track for each depth band, deep and final guardians
  town_night: { bpm: 58, chords: [[48, 55, 59, 64], [45, 52, 55, 60], [41, 48, 52, 57], [43, 50, 53, 59]], scale: [60, 62, 64, 67, 69, 71, 72, 76], mood: 'night' },
  crypt: { bpm: 66, chords: [[40, 47, 52, 55], [41, 48, 53, 56], [40, 47, 52, 55], [38, 45, 50, 53]], scale: [52, 53, 55, 57, 59, 60, 64], mood: 'dark', drip: true, pulse: true },
  abyss: { bpm: 54, chords: [[38, 45, 50, 53], [36, 43, 48, 51], [34, 41, 46, 50], [33, 40, 45, 48]], scale: [50, 51, 53, 55, 57, 58, 62], mood: 'abyss' },
  ember: { bpm: 88, chords: [[43, 50, 55, 58], [44, 51, 56, 59], [41, 48, 53, 56], [42, 49, 54, 57]], scale: [55, 56, 59, 60, 62, 63, 66, 67], mood: 'tribal' },
  void: { bpm: 50, chords: [[36, 42, 48, 54], [37, 43, 49, 55], [35, 41, 47, 53], [38, 44, 50, 56]], scale: [48, 50, 52, 54, 56, 58, 60], mood: 'void' },
  boss_deep: { bpm: 112, chords: [[40, 47, 52, 55], [41, 48, 53, 57], [36, 43, 48, 52], [39, 46, 51, 54]], scale: [52, 53, 55, 58, 59, 60, 63, 64], mood: 'battle', arp: true },
  final: { bpm: 124, chords: [[38, 45, 50, 53], [34, 41, 46, 50], [36, 43, 48, 52], [37, 44, 49, 52]], scale: [50, 51, 53, 55, 56, 58, 61, 62], mood: 'epic' },
  boss: { bpm: 96, chords: [[45, 52, 57, 60], [46, 53, 58, 62], [41, 48, 53, 57], [44, 51, 56, 59]], scale: [57, 58, 60, 63, 64, 65, 68, 69], mood: 'battle' },
};

// CC0 recorded tracks (generated music is the fallback if one cannot be loaded)
const FILE_TRACKS = { boss: 'assets/music/battle_theme_a.mp3', boss_deep: 'assets/music/battle_theme_a.mp3', final: 'assets/music/battle_theme_a.mp3',
  // supplied by the owner (generated music plays if a file is missing)
  menu: 'assets/music/private/jacobs_prayer.mp3', town: 'assets/music/private/jacobs_prayer.mp3', town_night: 'assets/music/private/chopin_nocturne_72_1.mp3',
  dungeon: 'assets/music/private/lobotomy.mp3', crypt: 'assets/music/private/lobotomy.mp3', ember: 'assets/music/private/lobotomy.mp3',
  abyss: 'assets/music/private/lobotomy.mp3', void: 'assets/music/private/lobotomy.mp3' };
const fileBuf = {};
let fileSrc = null;
function stopFile() { if (fileSrc) { try { fileSrc.stop(); } catch (e) { /* already stopped */ } fileSrc = null; } }
function playFile(name, url) {
  const C = Audio.ctx;
  const go = (buf) => {
    if (Audio.track !== name) return;
    stopFile();
    const s = C.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(Audio.music); s.start();
    fileSrc = s; Audio.fileTrack = name;
  };
  if (fileBuf[url]) return go(fileBuf[url]);
  if (fileBuf[url] === false) return;
  fetch(new URL(url, document.baseURI).href).then((r) => r.arrayBuffer()).then((ab) => C.decodeAudioData(ab)).then((b) => { fileBuf[url] = b; go(b); })
    .catch(() => { fileBuf[url] = false; Audio.fileFailed = name; });
}

export function playMusic(name) {
  ctx();
  if (Audio.track === name) return;
  Audio.track = name;
  stopFile(); Audio.fileTrack = null;
  Audio.beat = 0;
  const C = Audio.ctx;
  Audio.music.gain.cancelScheduledValues(C.currentTime);
  Audio.music.gain.setValueAtTime(0.0001, C.currentTime);
  Audio.music.gain.linearRampToValueAtTime(Audio.vol.music * 0.5, C.currentTime + 2.5);
  Audio.nextBeat = C.currentTime + 0.2;
  if (FILE_TRACKS[name]) playFile(name, FILE_TRACKS[name]);
  if (!Audio.timer) Audio.timer = setInterval(schedule, 80);
}

function schedule() {
  const C = Audio.ctx;
  const T = TRACKS[Audio.track];
  if (!T || !C) return;
  if (Audio.fileTrack === Audio.track) return; // a recorded track is playing
  const spb = 60 / T.bpm / 2; // eighth notes
  while (Audio.nextBeat < C.currentTime + 0.35) {
    const t = Audio.nextBeat;
    const b = Audio.beat;
    const bar = Math.floor(b / 8);
    const chord = T.chords[bar % T.chords.length];
    const step = b % 8;
    if (T.mood === 'warm') {
      if (step === 0) {
        for (const n of chord) voice(t, midi(n), spb * 8, { type: 'sawtooth', gain: 0.025, attack: 0.6, filter: 900, rev: 0.5, detune: (Math.random() - 0.5) * 12 });
        voice(t, midi(chord[0] - 12), spb * 6, { type: 'sine', gain: 0.12, attack: 0.05, rev: 0.1 });
      }
      // plucked arpeggio
      const arp = [0, 2, 1, 3, 2, 1, 3, 2];
      if (Math.random() < 0.85) voice(t, midi(chord[arp[step]] + 12), spb * 3, { type: 'triangle', gain: 0.06, attack: 0.005, release: spb * 3, rev: 0.4 });
      if (step % 4 === 2 && Math.random() < 0.4) voice(t, midi(T.scale[Math.floor(Math.random() * T.scale.length)] + 12), spb * 4, { type: 'sine', gain: 0.05, attack: 0.02, rev: 0.6 });
    } else if (T.mood === 'dark') {
      if (step === 0 && bar % 2 === 0) {
        voice(t, midi(chord[0] - 12), spb * 16, { type: 'sawtooth', gain: 0.05, attack: 2, filter: 260, rev: 0.4 });
        voice(t, midi(chord[0] - 12), spb * 16, { type: 'sawtooth', gain: 0.05, attack: 2, filter: 260, rev: 0.4, detune: 9 });
        voice(t, midi(chord[2]), spb * 16, { type: 'sine', gain: 0.03, attack: 3, rev: 0.7 });
      }
      if (step === 0 || step === 3) voice(t, midi(chord[0] - 24), 0.4, { type: 'sine', gain: step === 0 ? 0.16 : 0.08, attack: 0.005, release: 0.4, rev: 0 });
      if (Math.random() < 0.12) {
        const n = T.scale[Math.floor(Math.random() * T.scale.length)] + 12;
        voice(t, midi(n), 3, { type: 'sine', gain: 0.05, attack: 0.002, release: 3, rev: 0.8 });
        voice(t, midi(n) * 2.76, 1.5, { type: 'sine', gain: 0.015, attack: 0.002, release: 1.5, rev: 0.8 });
      }
      if (step === 6 && Math.random() < 0.3) noise(t, 1.5, { gain: 0.02, filter: 400, type: 'bandpass' });
      if (T.drip && Math.random() < 0.06) { const f = 1200 + Math.random() * 1600; voice(t, f, 0.12, { type: 'sine', gain: 0.03, attack: 0.001, release: 0.12, rev: 0.9 }); voice(t + 0.05, f * 1.5, 0.08, { type: 'sine', gain: 0.015, attack: 0.001, release: 0.08, rev: 0.9 }); }
      if (T.pulse && step % 4 === 0) voice(t, midi(chord[0] - 24), 0.25, { type: 'sine', gain: 0.1, attack: 0.002, release: 0.25, rev: 0 });
    } else if (T.mood === 'night') {
      // soft pad, a music-box melody and distant crickets
      if (step === 0) for (const n of chord) voice(t, midi(n), spb * 8.5, { type: 'sine', gain: 0.028, attack: 1.2, rev: 0.7, detune: (Math.random() - 0.5) * 8 });
      if (step === 0) voice(t, midi(chord[0] - 12), spb * 8, { type: 'sine', gain: 0.07, attack: 0.4, rev: 0.3 });
      if ((step === 0 || step === 3 || step === 5) && Math.random() < 0.75) { const n = T.scale[(bar * 3 + step) % T.scale.length] + 12; voice(t, midi(n), 1.6, { type: 'sine', gain: 0.045, attack: 0.002, release: 1.6, rev: 0.7 }); voice(t, midi(n) * 3, 0.5, { type: 'sine', gain: 0.008, attack: 0.002, release: 0.5, rev: 0.7 }); }
      if (Math.random() < 0.18) for (let k = 0; k < 3; k++) voice(t + k * 0.05, 4200 + Math.random() * 300, 0.03, { type: 'square', gain: 0.004, attack: 0.001, release: 0.03, filter: 5000, rev: 0.5 });
    } else if (T.mood === 'abyss') {
      // the drowned depths: a huge low drone, a wordless choir and slow water swells
      if (step === 0 && bar % 2 === 0) {
        voice(t, midi(chord[0] - 24), spb * 17, { type: 'sawtooth', gain: 0.06, attack: 3, filter: 180, rev: 0.4 });
        for (const n of chord.slice(1)) for (const dt of [-7, 7]) voice(t, midi(n), spb * 16, { type: 'triangle', gain: 0.016, attack: 2.5, filter: 1400, rev: 0.85, detune: dt });
      }
      if (step === 4 && bar % 2 === 1) noise(t, 3, { gain: 0.025, filter: 300, type: 'lowpass' });
      if (Math.random() < 0.07) { const n = T.scale[Math.floor(Math.random() * T.scale.length)]; voice(t, midi(n), 4, { type: 'sine', gain: 0.04, attack: 0.8, release: 3, rev: 0.9 }); }
    } else if (T.mood === 'tribal') {
      // ember halls: war drums, a growling bass and a snake-charmer lead
      if (step === 0 || step === 3 || step === 6 || (step === 7 && bar % 2)) { voice(t, step === 0 ? 55 : 72, 0.3, { type: 'sine', gain: step === 0 ? 0.32 : 0.2, attack: 0.002, release: 0.3, rev: 0.15 }); noise(t, 0.08, { gain: 0.08, filter: 300 }); }
      if (step === 2 || step === 5) noise(t, 0.06, { gain: 0.07, filter: 3000, type: 'bandpass', q: 3 });
      if (step % 2 === 0) voice(t, midi(chord[0] - 12), spb * 1.8, { type: 'sawtooth', gain: 0.05, attack: 0.01, filter: 420, rev: 0.1 });
      if (step === 0 && bar % 2 === 0) for (const n of chord) voice(t, midi(n), spb * 16, { type: 'sawtooth', gain: 0.018, attack: 1.2, filter: 700, rev: 0.6 });
      if (step % 2 === 1 && Math.random() < 0.45) voice(t, midi(T.scale[(b * 5 + bar) % T.scale.length] + 12), spb * 1.6, { type: 'square', gain: 0.022, attack: 0.02, filter: 1600, rev: 0.4 });
    } else if (T.mood === 'void') {
      // the deepest floors: whole-tone shimmer, a heartbeat and reversed swells
      if (step === 0) for (const n of chord) voice(t, midi(n + 12), spb * 8.5, { type: 'sine', gain: 0.02, attack: spb * 7, release: 0.2, rev: 0.9, detune: (Math.random() - 0.5) * 20 });
      if (step === 0 || step === 1) voice(t, 48, 0.22, { type: 'sine', gain: step === 0 ? 0.2 : 0.13, attack: 0.003, release: 0.22, rev: 0.05 });
      if (Math.random() < 0.09) { const n = T.scale[Math.floor(Math.random() * T.scale.length)] + 24; voice(t, midi(n), 2.5, { type: 'triangle', gain: 0.02, attack: 0.002, release: 2.5, rev: 0.95, detune: 30 }); }
      if (step === 4 && Math.random() < 0.3) noise(t, 2.5, { gain: 0.02, filter: 2200, type: 'bandpass', q: 6 });
    } else if (T.mood === 'epic') {
      // the Hollow King: choir stabs, double-kick drums and a driving ostinato
      if (step === 0) for (const n of chord) for (const dt of [-9, 0, 9]) voice(t, midi(n), spb * 8, { type: 'sawtooth', gain: 0.016, attack: 0.08, filter: 1800, rev: 0.6, detune: dt });
      voice(t, midi(chord[0] - 12), spb * 0.8, { type: 'sawtooth', gain: 0.07, attack: 0.004, filter: 600, rev: 0 });
      voice(t + spb / 2, midi(chord[0] - 12), spb * 0.4, { type: 'sawtooth', gain: 0.05, attack: 0.004, filter: 600, rev: 0 });
      if (step % 2 === 0) { voice(t, 58, 0.28, { type: 'sine', gain: 0.32, attack: 0.002, release: 0.28, rev: 0.05 }); noise(t, 0.06, { gain: 0.1, filter: 180 }); }
      if (step === 2 || step === 6) { noise(t, 0.22, { gain: 0.18, filter: 2400, type: 'bandpass' }); voice(t, 190, 0.15, { type: 'triangle', gain: 0.08, attack: 0.002, release: 0.15 }); }
      voice(t, midi(T.scale[[0, 2, 4, 2, 5, 4, 2, 1][step]] + 12), spb * 0.9, { type: 'square', gain: 0.02, attack: 0.005, filter: 2400, rev: 0.25 });
      if (step === 0 && bar % 4 === 3) noise(t, 1.5, { gain: 0.06, filter: 5000, type: 'highpass' });
    } else {
      if (step === 0) for (const n of chord) voice(t, midi(n), spb * 8, { type: 'sawtooth', gain: 0.03, attack: 0.1, filter: 1200, rev: 0.3 });
      if (T.arp) voice(t, midi(chord[[0, 1, 2, 3, 2, 1, 2, 3][step]] + 12), spb * 0.9, { type: 'square', gain: 0.022, attack: 0.004, filter: 2600, rev: 0.2 });
      voice(t, midi(chord[0] - 12), spb * 0.9, { type: 'sawtooth', gain: 0.06, attack: 0.005, filter: 500, rev: 0 });
      if (step === 0 || step === 3 || step === 6) { voice(t, 60, 0.35, { type: 'sine', gain: 0.35, attack: 0.002, release: 0.35, rev: 0.1 }); noise(t, 0.12, { gain: 0.15, filter: 200 }); }
      if (step === 4) noise(t, 0.2, { gain: 0.15, filter: 2500, type: 'bandpass' });
      if (step % 2 === 1 && Math.random() < 0.5) voice(t, midi(T.scale[(b * 3) % T.scale.length] + 12), spb, { type: 'square', gain: 0.025, attack: 0.005, filter: 2000, rev: 0.3 });
    }
    Audio.nextBeat += spb;
    Audio.beat++;
  }
}

// ---------------- sound effects ----------------
export function sfx(kind) {
  if (!Audio.ctx || Audio.ctx.state !== 'running') return;
  const t = Audio.ctx.currentTime;
  const D = Audio.sfxBus;
  const v = (f, d, o) => voice(t, f, d, { dest: D, rev: 0.15, ...o });
  switch (kind) {
    case 'hit': noise(t, 0.08, { gain: 0.35, filter: 1800, dest: D }); v(140, 0.1, { type: 'square', gain: 0.08, filter: 600 }); break;
    case 'crit': noise(t, 0.12, { gain: 0.45, filter: 3000, dest: D }); v(90, 0.2, { type: 'square', gain: 0.12, filter: 800 }); break;
    case 'swing': noise(t, 0.15, { gain: 0.12, filter: 3000, type: 'bandpass', dest: D, q: 0.7 }); break;
    case 'hurt': v(160, 0.18, { type: 'sawtooth', gain: 0.12, filter: 700 }); break;
    case 'gold': v(1320, 0.12, { gain: 0.07 }); setTimeout(() => sfx('gold2'), 60); break;
    case 'gold2': v(1760, 0.15, { gain: 0.06 }); break;
    case 'pick': v(520, 0.1, { gain: 0.08 }); v(780, 0.12, { gain: 0.06 }); break;
    case 'fire': noise(t, 0.35, { gain: 0.25, filter: 900, dest: D }); v(220, 0.3, { type: 'sawtooth', gain: 0.05, filter: 600 }); break;
    case 'boom': noise(t, 0.8, { gain: 0.6, filter: 500, dest: D }); v(55, 0.6, { type: 'sine', gain: 0.4 }); break;
    case 'zap': for (let i = 0; i < 3; i++) v(800 + Math.random() * 1200, 0.08, { type: 'square', gain: 0.05, filter: 4000 }); noise(t, 0.2, { gain: 0.2, filter: 5000, type: 'highpass', dest: D }); break;
    case 'heal': [523, 659, 784, 1046].forEach((f, i) => voice(t + i * 0.06, f, 0.5, { dest: D, gain: 0.06, type: 'sine', rev: 0.5 })); break;
    case 'nova': noise(t, 0.6, { gain: 0.3, filter: 6000, type: 'highpass', dest: D }); v(1200, 0.5, { type: 'sine', gain: 0.05 }); break;
    case 'buff': [392, 494, 587].forEach((f, i) => voice(t + i * 0.08, f, 0.6, { dest: D, gain: 0.07, type: 'square', filter: 1500, rev: 0.4 })); break;
    case 'blink': v(1500, 0.25, { type: 'sine', gain: 0.08 }); v(300, 0.25, { type: 'sine', gain: 0.08 }); break;
    case 'level': [392, 523, 659, 784, 1046].forEach((f, i) => voice(t + i * 0.09, f, 0.8, { dest: D, gain: 0.08, type: 'triangle', rev: 0.6 })); break;
    case 'die': v(110, 0.4, { type: 'sawtooth', gain: 0.1, filter: 400 }); noise(t, 0.3, { gain: 0.15, filter: 600, dest: D }); break;
    case 'splash': noise(t, 0.4, { gain: 0.25, filter: 1200, type: 'bandpass', dest: D }); break;
    case 'squelch': noise(t, 0.16, { gain: 0.3, filter: 700, type: 'lowpass', dest: D }); v(90 + Math.random() * 40, 0.14, { type: 'sine', gain: 0.18 }); break;
    case 'gib': noise(t, 0.5, { gain: 0.5, filter: 450, dest: D }); v(60, 0.35, { type: 'sine', gain: 0.35 }); noise(t + 0.09, 0.2, { gain: 0.25, filter: 800, type: 'lowpass', dest: D }); break;
    case 'bonecrack': noise(t, 0.05, { gain: 0.5, filter: 3500, type: 'highpass', dest: D }); v(220, 0.06, { type: 'square', gain: 0.1, filter: 1200 }); voice(t + 0.05, 160, 0.05, { dest: D, type: 'square', gain: 0.08, filter: 900 }); break;
    case 'grunt': v(95 + Math.random() * 25, 0.22, { type: 'sawtooth', gain: 0.14, filter: 500 }); noise(t, 0.12, { gain: 0.06, filter: 500, dest: D }); break;
    case 'scream': v(420, 0.5, { type: 'sawtooth', gain: 0.09, filter: 1600 }); v(520, 0.45, { type: 'sawtooth', gain: 0.05, filter: 1600 }); break;
    case 'ui': v(880, 0.05, { type: 'sine', gain: 0.04, rev: 0 }); break;
    case 'door': noise(t, 0.5, { gain: 0.2, filter: 300, dest: D }); break;
    case 'legend': [523, 659, 784, 1046, 1318].forEach((f, i) => voice(t + i * 0.05, f, 1.2, { dest: D, gain: 0.07, type: 'sine', rev: 0.8 })); break;
  }
}
