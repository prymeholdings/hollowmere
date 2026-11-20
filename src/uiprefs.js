// Interface options from Settings: size, opacity, theme colours, what the HUD shows and touch control layout.
import { Settings } from './settings.js';

export const UI_THEMES = {
  bronze: { name: 'Bronze (default)', gold: '#e8c170', gold2: '#a8823e', p1: '#241c15f5', p2: '#120e0bf5' },
  silver: { name: 'Silver', gold: '#dfe6f0', gold2: '#7f8a9a', p1: '#1b1e24f5', p2: '#0d0f13f5' },
  crimson: { name: 'Crimson', gold: '#ff9a7a', gold2: '#a8402e', p1: '#2a1212f5', p2: '#140808f5' },
  verdant: { name: 'Verdant', gold: '#b8e08a', gold2: '#5f8a3e', p1: '#16211af5', p2: '#0a110cf5' },
  astral: { name: 'Astral', gold: '#c8b0ff', gold2: '#6a52b8', p1: '#1a1630f5', p2: '#0b0918f5' },
};

export function applyUI() {
  if (typeof document === 'undefined' || !document.body) return;
  const r = document.documentElement.style, b = document.body.classList;
  r.setProperty('--uis', String(Settings.uiScale ?? 1));
  r.setProperty('--hudz', String(Settings.hudScale ?? 1));
  r.setProperty('--hudop', String(Settings.hudOpacity ?? 1));
  r.setProperty('--tbs', String(Settings.touchSize ?? 1));
  r.setProperty('--tbo', String(Settings.touchOpacity ?? 1));
  const t = UI_THEMES[Settings.theme] || UI_THEMES.bronze;
  r.setProperty('--gold', t.gold); r.setProperty('--gold2', t.gold2);
  r.setProperty('--p1', t.p1); r.setProperty('--p2', t.p2);
  b.toggle('no-minimap', Settings.showMinimap === false);
  b.toggle('no-log', Settings.showLog === false);
  b.toggle('no-orbs3d', Settings.compactOrbs === true);
  b.toggle('no-portrait', Settings.showPortrait === false);
  b.toggle('lefty', !!Settings.leftHanded);
}
