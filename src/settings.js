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
  // mature content (both on by default, both can be switched off)
  gore: 'max', // off | low | max
  profanity: true,
  barks: true,
  grit: 'gritty', // gritty | classic
  realistic: true, // realistic human models (off = the stylised heroes)
  // interface
  uiScale: 1, hudOpacity: 1, theme: 'bronze', showMinimap: true, showLog: true,
  pcStick: true, touchSize: 1, touchOpacity: 0.9, leftHanded: false,
};
export function loadSettings() {
  let saved = null; try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  // phones and tablets start on the fastest settings
  if (!saved && typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) Object.assign(Settings, { quality: 'low', renderScale: 0.8, showHelp: false });
  try { Object.assign(Settings, JSON.parse(saved || '{}')); } catch (e) { /* defaults */ }
  // realistic characters are always on (older versions could switch them off after a graphics hiccup)
  Settings.realistic = true;
  // laptops with integrated graphics (shared video memory) start one step lower; done once, the player can raise it again
  if (!Settings.gpuTuned) {
    Settings.gpuTuned = 1;
    const gpu = gpuName();
    Settings.gpu = gpu;
    if (/Radeon\(TM\) Graphics|Radeon Graphics|Vega|Intel|UHD|Iris|Mali|Adreno|PowerVR|SwiftShader|llvmpipe/i.test(gpu) && !/RX|Pro W|Arc/i.test(gpu)) {
      if (Settings.quality === 'high' || Settings.quality === 'ultra') Settings.quality = 'medium';
      Settings.renderScale = Math.min(Settings.renderScale || 1, 0.9);
      Settings.integratedGpu = true;
    }
    try { localStorage.setItem(KEY, JSON.stringify(Settings)); } catch (e) { /* storage blocked */ }
  }
  syncAudio();
}
export function saveSettings() { try { localStorage.setItem(KEY, JSON.stringify(Settings)); } catch (e) { /* storage blocked */ } syncAudio(); }
function syncAudio() { Audio.vol.master = Settings.master; Audio.vol.music = Settings.music; Audio.vol.sfx = Settings.sfx; applyVolumes(); }

export function gpuName() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
    if (!gl) return '';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const n = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return String(n || '');
  } catch (e) { return ''; }
}
