import { Audio, applyVolumes } from './audio.js';
const KEY = 'hollowmere_settings_v1';
export const Settings = {
  master: 0.8, music: 0.55, sfx: 0.8,
  quality: 'high', // low | medium | high | ultra
  renderScale: 1,
  sharpen: 0.35,
  damageNumbers: true,
  showHelp: true,
  screenShake: true,
  autoLoot: true,
  autoAttack: false, // attack nearby foes on your own
  autoMode: 'basic', // 'basic' or a hotbar slot: rmb q w e r
  autoRange: 8,
};
export function loadSettings() {
  const saved = localStorage.getItem(KEY);
  // phones and tablets start on the fastest settings
  if (!saved && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) Object.assign(Settings, { quality: 'low', renderScale: 0.8, showHelp: false });
  try { Object.assign(Settings, JSON.parse(saved || '{}')); } catch (e) { /* defaults */ }
  syncAudio();
}
export function saveSettings() { localStorage.setItem(KEY, JSON.stringify(Settings)); syncAudio(); }
function syncAudio() { Audio.vol.master = Settings.master; Audio.vol.music = Settings.music; Audio.vol.sfx = Settings.sfx; applyVolumes(); }
