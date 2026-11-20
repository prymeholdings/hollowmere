// Hand-made SVG icons for items and skills (original artwork). Equipment and gems use 3D-rendered icons.
import { itemIconURL } from './iconrender.js';
import { skill3dURL, requestSkill3d, skill3dSVG } from './skillicon3d.js';
const wrap = (inner, c1, c2 = '#000') => `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="g" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${c1}" stop-opacity="0.35"/><stop offset="1" stop-color="${c2}" stop-opacity="0"/></radialGradient></defs><rect width="64" height="64" fill="url(#g)"/>${inner}</svg>`;
const M = '#d8dde4', D = '#5a4630', G = '#e8c35a';
const ITEM = {
  sword: `<path d="M44 8 L56 8 L56 20 L28 48 L22 42 Z" fill="${M}" stroke="#333" stroke-width="1.5"/><path d="M16 38 L26 48 L22 52 L12 42 Z" fill="${G}" stroke="#333"/><path d="M14 50 L8 56" stroke="${D}" stroke-width="6" stroke-linecap="round"/>`,
  axe: `<path d="M18 54 L44 14" stroke="${D}" stroke-width="5" stroke-linecap="round"/><path d="M36 10 C52 8 58 22 52 32 L40 24 Z" fill="${M}" stroke="#333" stroke-width="1.5"/>`,
  staff: `<path d="M16 56 L44 18" stroke="${D}" stroke-width="5" stroke-linecap="round"/><circle cx="46" cy="14" r="8" fill="#7fd0ff" stroke="#246" stroke-width="2"/><circle cx="44" cy="12" r="3" fill="#fff"/>`,
  dagger: `<path d="M40 10 L48 16 L28 40 L22 34 Z" fill="${M}" stroke="#333" stroke-width="1.5"/><path d="M16 32 L30 46" stroke="${G}" stroke-width="4"/><path d="M20 44 L12 52" stroke="${D}" stroke-width="6" stroke-linecap="round"/>`,
  pick: `<path d="M20 56 L40 12" stroke="${D}" stroke-width="5" stroke-linecap="round"/><path d="M14 18 C28 6 46 6 56 16 L40 16 Z" fill="${M}" stroke="#333" stroke-width="1.5"/>`,
  shield: `<path d="M32 8 L54 16 C54 36 46 50 32 58 C18 50 10 36 10 16 Z" fill="#8a5a2a" stroke="#333" stroke-width="2"/><path d="M32 14 L48 20 C48 34 42 44 32 51 C22 44 16 34 16 20 Z" fill="${M}" opacity="0.5"/><circle cx="32" cy="30" r="5" fill="${G}"/>`,
  helm: `<path d="M12 40 C12 18 52 18 52 40 L52 48 L12 48 Z" fill="${M}" stroke="#333" stroke-width="2"/><rect x="20" y="36" width="24" height="5" fill="#222"/><path d="M32 14 L32 24" stroke="#c33" stroke-width="5"/>`,
  armor: `<path d="M18 12 L26 10 C28 16 36 16 38 10 L46 12 L54 22 L46 28 L46 54 L18 54 L18 28 L10 22 Z" fill="#8a6a4a" stroke="#333" stroke-width="2"/><path d="M24 24 L40 24 M24 32 L40 32 M24 40 L40 40" stroke="#5a4630" stroke-width="2"/>`,
  ring: `<circle cx="32" cy="36" r="14" fill="none" stroke="${G}" stroke-width="6"/><path d="M26 16 L32 8 L38 16 L32 22 Z" fill="#c43cff" stroke="#333"/>`,
  amulet: `<path d="M14 10 C18 30 46 30 50 10" fill="none" stroke="${G}" stroke-width="3"/><circle cx="32" cy="40" r="11" fill="#e05a2a" stroke="${G}" stroke-width="4"/><circle cx="29" cy="37" r="3" fill="#fff" opacity="0.7"/>`,
  fish: `<path d="M10 32 C20 16 42 16 50 32 C42 48 20 48 10 32 Z" fill="#6fb6e8" stroke="#235" stroke-width="2"/><path d="M50 32 L60 22 L60 42 Z" fill="#4a90c8"/><circle cx="20" cy="29" r="2.5" fill="#000"/>`,
  boot: `<path d="M20 10 L36 10 L36 38 L54 44 L54 54 L18 54 Z" fill="#6a4a2a" stroke="#333" stroke-width="2"/>`,
};
export function itemIcon(it, rarityColor) {
  const url = itemIconURL(it);
  if (url) return `<img class="icon3d" src="${url}" draggable="false" alt="">`;
  let k = 'sword';
  if (it.slot === 'fish') k = it.name === 'Old Boot' ? 'boot' : 'fish';
  else if (it.slot === 'weapon') k = /Axe/.test(it.base) ? 'axe' : /Staff/.test(it.base) ? 'staff' : /Pick/.test(it.base) ? 'pick' : /Dagger|Shortblade/.test(it.base) ? 'dagger' : 'sword';
  else if (it.slot === 'offhand') k = 'shield';
  else k = it.slot;
  return wrap(ITEM[k] || ITEM.sword, rarityColor);
}
const SK = {
  fire: `<path d="M32 6 C40 20 50 26 46 42 C44 52 38 58 32 58 C22 58 16 50 18 40 C20 32 26 30 26 22 C30 26 30 30 32 32 C34 24 30 14 32 6 Z" fill="#ff7a1a"/><path d="M32 30 C36 38 40 42 38 50 C36 54 28 54 26 48 C26 42 30 40 32 30 Z" fill="#ffd34a"/>`,
  bolt: `<path d="M36 4 L14 36 L30 36 L24 60 L50 24 L34 24 Z" fill="#a8d8ff" stroke="#3a6aaa" stroke-width="2"/>`,
  frost: `<g stroke="#bfeaff" stroke-width="4" stroke-linecap="round"><path d="M32 6 L32 58"/><path d="M9 19 L55 45"/><path d="M9 45 L55 19"/><path d="M26 10 L32 16 L38 10 M26 54 L32 48 L38 54"/></g>`,
  meteor: `<path d="M8 8 L34 34" stroke="#ff9a3a" stroke-width="8" stroke-linecap="round" opacity="0.6"/><circle cx="40" cy="40" r="14" fill="#7a3a1a" stroke="#ff6a1a" stroke-width="4"/><circle cx="36" cy="36" r="4" fill="#ffb24a"/>`,
  heal: `<circle cx="32" cy="32" r="22" fill="#2a6a3a" opacity="0.6"/><path d="M26 14 L38 14 L38 26 L50 26 L50 38 L38 38 L38 50 L26 50 L26 38 L14 38 L14 26 L26 26 Z" fill="#7dff9a" stroke="#1a4a2a" stroke-width="2"/>`,
  skull: `<path d="M14 30 C14 14 50 14 50 30 C50 38 46 40 44 44 L44 52 L20 52 L20 44 C18 40 14 38 14 30 Z" fill="#e8e0c8" stroke="#333" stroke-width="2"/><circle cx="24" cy="32" r="5" fill="#2a2" /><circle cx="40" cy="32" r="5" fill="#2a2"/><path d="M28 46 L28 52 M32 46 L32 52 M36 46 L36 52" stroke="#333" stroke-width="2"/>`,
  whirl: `<g fill="none" stroke="#e8e0d0" stroke-width="5" stroke-linecap="round"><path d="M32 32 m-20 0 a20 20 0 1 1 20 20"/><path d="M32 32 m-11 0 a11 11 0 1 1 11 11"/></g><path d="M44 10 L56 10 L56 22 Z" fill="${M}"/>`,
  slam: `<path d="M22 6 L42 6 L42 26 L22 26 Z" fill="#888" stroke="#333" stroke-width="2"/><path d="M30 26 L30 40" stroke="${D}" stroke-width="5"/><path d="M6 54 L18 44 L24 52 L32 42 L40 52 L46 44 L58 54" stroke="#e0a050" stroke-width="4" fill="none"/>`,
  knives: `<g fill="${M}" stroke="#333" stroke-width="1.5"><path d="M30 6 L34 6 L34 40 L30 40 Z"/><path d="M12 14 L16 12 L28 44 L24 46 Z"/><path d="M48 12 L52 14 L40 46 L36 44 Z"/></g><path d="M26 44 L38 44 L36 56 L28 56 Z" fill="${D}"/>`,
  blink: `<circle cx="20" cy="40" r="10" fill="#6a3acc" opacity="0.5"/><circle cx="44" cy="22" r="12" fill="#a46aff"/><path d="M24 36 L40 26" stroke="#d8c0ff" stroke-width="3" stroke-dasharray="4 4"/>`,
  cry: `<path d="M10 24 L22 24 L36 12 L36 52 L22 40 L10 40 Z" fill="#c84a3a" stroke="#333" stroke-width="2"/><path d="M44 20 C50 26 50 38 44 44 M50 14 C60 24 60 40 50 50" stroke="#ffb07a" stroke-width="3" fill="none"/>`,
  blizzard: `<g fill="#cff4ff"><path d="M8 14 C14 6 26 6 30 12 C36 6 50 8 52 18 C58 18 60 26 54 28 L10 28 C4 26 4 18 8 14 Z" fill="#7a9ab8"/></g><g stroke="#e8fbff" stroke-width="3" stroke-linecap="round"><path d="M16 36 L12 46 M30 34 L26 48 M44 36 L40 50 M22 48 L19 56 M38 50 L35 58"/></g>`,
  quake: `<path d="M4 40 L60 40 L60 60 L4 60 Z" fill="#6a5034"/><path d="M32 40 L28 48 L34 52 L30 60" stroke="#ffb050" stroke-width="3" fill="none"/><path d="M14 40 L18 46 M48 40 L44 47" stroke="#ffb050" stroke-width="2"/><g fill="#9a7a50"><rect x="10" y="22" width="8" height="8" transform="rotate(20 14 26)"/><rect x="44" y="16" width="10" height="10" transform="rotate(-15 49 21)"/><rect x="28" y="10" width="7" height="7"/></g><path d="M6 34 C20 28 44 28 58 34" stroke="#e0c090" stroke-width="2" fill="none" opacity="0.7"/>`,
  smoke: `<g fill="#8a8a9a"><circle cx="22" cy="38" r="14"/><circle cx="38" cy="32" r="16"/><circle cx="46" cy="44" r="11"/><circle cx="28" cy="48" r="10"/></g><circle cx="20" cy="18" r="7" fill="#333" stroke="#111"/><path d="M24 13 L30 7" stroke="#ffb050" stroke-width="2"/>`,
  blades: `<g fill="${M}" stroke="#333" stroke-width="1.2"><path d="M14 4 L18 4 L18 30 L16 36 L14 30 Z"/><path d="M30 10 L34 10 L34 40 L32 46 L30 40 Z"/><path d="M46 2 L50 2 L50 26 L48 32 L46 26 Z"/></g><path d="M6 56 L58 56" stroke="#8a8a9a" stroke-width="3"/><path d="M12 52 L20 52 M28 50 L36 50 M44 52 L52 52" stroke="#cfd8e0" stroke-width="2"/>`,
  brutal: `<path d="M32 6 L40 24 L58 26 L44 38 L48 58 L32 48 L16 58 L20 38 L6 26 L24 24 Z" fill="#c83a2a" stroke="#333" stroke-width="2"/><path d="M26 30 L38 30 M32 24 L32 40" stroke="#ffd0a0" stroke-width="3"/>`,
  wind: `<g fill="none" stroke="#9fffc0" stroke-width="4" stroke-linecap="round"><path d="M8 22 L40 22 C48 22 50 12 42 10"/><path d="M8 34 L50 34 C58 34 60 46 50 48"/><path d="M14 46 L32 46"/></g><path d="M32 52 C26 46 22 42 26 38 C30 36 32 40 32 40 C32 40 34 36 38 38 C42 42 38 46 32 52 Z" fill="#e05a5a"/>`,
  arcane: `<circle cx="32" cy="32" r="24" fill="none" stroke="#7aa0ff" stroke-width="3"/><path d="M32 10 L36 28 L54 32 L36 36 L32 54 L28 36 L10 32 L28 28 Z" fill="#a8c8ff"/><circle cx="32" cy="32" r="5" fill="#fff"/>`,
  elemental: `<path d="M32 6 L46 30 L32 58 L18 30 Z" fill="#3a2a5a" stroke="#c8a8ff" stroke-width="2"/><path d="M32 12 L40 30 L32 30 Z" fill="#ff7a1a"/><path d="M32 30 L40 30 L32 52 Z" fill="#9fe8ff"/><path d="M32 30 L24 30 L32 12 Z" fill="#ffe26a"/><path d="M24 30 L32 30 L32 52 Z" fill="#7a5aff"/>`,
  feet: `<path d="M18 50 C14 40 18 30 24 30 C30 30 30 40 28 50 Z" fill="#c8a070" stroke="#333" stroke-width="1.5"/><path d="M38 40 C34 30 38 20 44 20 C50 20 50 30 48 40 Z" fill="#c8a070" stroke="#333" stroke-width="1.5"/><path d="M4 56 L16 56 M2 46 L12 46 M30 34 L40 34" stroke="#9fd8ff" stroke-width="2" stroke-linecap="round"/>`,
  lethal: `<circle cx="32" cy="32" r="22" fill="none" stroke="#e05a5a" stroke-width="3"/><circle cx="32" cy="32" r="12" fill="none" stroke="#e05a5a" stroke-width="3"/><path d="M32 4 L32 22 M32 42 L32 60 M4 32 L22 32 M42 32 L60 32" stroke="#ffd0d0" stroke-width="3"/><circle cx="32" cy="32" r="3" fill="#ff3a3a"/>`,
  blood: `<path d="M32 6 C40 20 50 30 50 40 C50 52 42 58 32 58 C22 58 14 52 14 40 C14 30 24 20 32 6 Z" fill="#a8141e" stroke="#333" stroke-width="2"/><path d="M24 40 C24 46 28 50 32 50" stroke="#ff8a8a" stroke-width="3" fill="none"/>`,
  fortune: `<circle cx="26" cy="40" r="14" fill="${G}" stroke="#7a5a1a" stroke-width="2"/><circle cx="40" cy="28" r="14" fill="#f8d870" stroke="#7a5a1a" stroke-width="2"/><path d="M36 22 L44 22 M40 18 L40 38 M36 34 L44 34" stroke="#7a5a1a" stroke-width="2.5"/><path d="M50 8 L52 13 L57 14 L52 16 L50 21 L48 16 L43 14 L48 13 Z" fill="#fff"/>`,
  icelance: `<path d="M54 10 L46 30 L22 54 L10 54 L10 42 L34 18 Z" fill="#bfeeff" stroke="#2a6a9a" stroke-width="2"/><path d="M54 10 L40 22 L46 30 Z" fill="#ffffff"/><path d="M18 46 L40 24" stroke="#ffffff" stroke-width="2" opacity="0.7"/><circle cx="14" cy="50" r="6" fill="#9fe0ff" opacity="0.5"/>`,
  venom: `<path d="M32 8 C42 22 50 30 50 40 C50 52 42 58 32 58 C22 58 14 52 14 40 C14 30 22 22 32 8 Z" fill="#4aa020" stroke="#1a4a0a" stroke-width="2"/><circle cx="26" cy="40" r="5" fill="#b8ff7a"/><circle cx="38" cy="46" r="3" fill="#b8ff7a"/><path d="M22 24 C18 18 22 12 26 14" stroke="#9aff5a" stroke-width="2" fill="none"/>`,
  firewall: `<path d="M4 58 L60 58 L60 52 L4 52 Z" fill="#5a2a10"/><g fill="#ff6a1a"><path d="M8 52 C6 40 14 34 12 22 C18 30 20 38 18 52 Z"/><path d="M20 52 C18 36 28 30 26 12 C34 24 36 38 32 52 Z"/><path d="M34 52 C32 38 40 30 40 16 C48 28 48 40 44 52 Z"/><path d="M46 52 C44 42 52 36 52 26 C58 34 58 44 56 52 Z"/></g><g fill="#ffd04a"><path d="M24 52 C24 44 28 40 28 32 C32 40 32 46 30 52 Z"/><path d="M38 52 C38 44 42 42 42 34 C46 42 46 48 42 52 Z"/></g>`,
  toxic: `<g fill="#5fbf2a" opacity="0.85"><circle cx="20" cy="36" r="13"/><circle cx="36" cy="28" r="15"/><circle cx="46" cy="40" r="11"/><circle cx="30" cy="46" r="11"/></g><circle cx="26" cy="32" r="4" fill="#d8ff9a"/><circle cx="40" cy="38" r="3" fill="#d8ff9a"/><path d="M26 54 L28 60 M38 54 L36 60" stroke="#8ae05a" stroke-width="3" stroke-linecap="round"/>`,
  glacial: `<g stroke="#2a6a9a" stroke-width="1.5"><path d="M32 4 L40 56 L24 56 Z" fill="#cff4ff"/><path d="M16 22 L24 58 L8 58 Z" fill="#9fe0ff"/><path d="M48 18 L56 58 L40 58 Z" fill="#9fe0ff"/></g><path d="M32 4 L34 30 L28 30 Z" fill="#ffffff"/><path d="M2 60 L62 60" stroke="#bfeeff" stroke-width="3"/>`,
  ballzap: `<circle cx="32" cy="32" r="16" fill="#3a4ad8" opacity="0.5"/><circle cx="32" cy="32" r="10" fill="#c8d0ff"/><circle cx="29" cy="29" r="4" fill="#ffffff"/><g stroke="#d8e0ff" stroke-width="2.5" fill="none" stroke-linecap="round"><path d="M32 6 L28 12 L34 14 L30 20"/><path d="M58 32 L52 28 L50 34 L44 30"/><path d="M8 36 L14 40 L16 34 L22 38"/><path d="M40 58 L38 50 L44 50 L40 44"/></g>`,
  inferno: `<path d="M6 32 C20 20 36 16 58 10 C50 22 56 28 58 32 C56 36 50 42 58 54 C36 48 20 44 6 32 Z" fill="#ff5a1a"/><path d="M14 32 C26 26 38 24 50 22 C46 28 48 32 50 32 C48 34 46 38 50 42 C38 40 26 38 14 32 Z" fill="#ffb030"/><path d="M22 32 C30 30 36 29 42 29 C40 31 40 33 42 35 C36 35 30 34 22 32 Z" fill="#fff0a0"/><circle cx="8" cy="32" r="5" fill="#7a2a0a"/>`,
  cataclysm: `<circle cx="32" cy="32" r="26" fill="#1a1028" stroke="#c8a8ff" stroke-width="2"/><path d="M18 14 L28 30 L22 30 L30 46" stroke="#c8d0ff" stroke-width="3" fill="none"/><circle cx="44" cy="20" r="7" fill="#ff6a1a"/><path d="M38 14 L44 20" stroke="#ffb030" stroke-width="3"/><path d="M40 44 L46 36 L52 44 L46 54 Z" fill="#9fe0ff"/><path d="M12 48 C18 42 22 50 28 46" stroke="#77ee33" stroke-width="3" fill="none"/>`,
  pyro: `<circle cx="32" cy="34" r="22" fill="none" stroke="#ff8a3a" stroke-width="3"/><path d="M32 12 C38 22 44 26 42 38 C40 46 36 50 32 50 C26 50 22 44 22 38 C22 32 26 30 26 24 C29 28 30 30 32 32 C33 26 30 18 32 12 Z" fill="#ff6a1a"/><path d="M32 32 C35 38 37 40 36 45 C35 48 29 48 28 44 C28 40 31 38 32 32 Z" fill="#ffd34a"/>`,
  cryo: `<circle cx="32" cy="32" r="22" fill="none" stroke="#9fe8ff" stroke-width="3"/><g stroke="#e8fbff" stroke-width="3.5" stroke-linecap="round"><path d="M32 14 L32 50"/><path d="M16 23 L48 41"/><path d="M16 41 L48 23"/></g><circle cx="32" cy="32" r="5" fill="#9fe8ff"/>`,
  conduit: `<circle cx="32" cy="32" r="22" fill="none" stroke="#b8c8ff" stroke-width="3"/><path d="M36 10 L20 34 L30 34 L26 54 L44 28 L34 28 Z" fill="#c8d0ff" stroke="#3a4aa0" stroke-width="1.5"/><circle cx="50" cy="48" r="5" fill="#77ee33"/>`,
  potion_hp: `<path d="M26 8 L38 8 L38 20 C48 24 52 32 52 40 C52 52 42 58 32 58 C22 58 12 52 12 40 C12 32 16 24 26 20 Z" fill="#c81e1e" stroke="#333" stroke-width="2"/><rect x="24" y="4" width="16" height="6" fill="${D}"/><circle cx="24" cy="38" r="4" fill="#fff" opacity="0.5"/>`,
  potion_mp: `<path d="M26 8 L38 8 L38 20 C48 24 52 32 52 40 C52 52 42 58 32 58 C22 58 12 52 12 40 C12 32 16 24 26 20 Z" fill="#2a4ad8" stroke="#333" stroke-width="2"/><rect x="24" y="4" width="16" height="6" fill="${D}"/><circle cx="24" cy="38" r="4" fill="#fff" opacity="0.5"/>`,
  portal: `<circle cx="32" cy="32" r="22" fill="none" stroke="#7aa0ff" stroke-width="6"/><circle cx="32" cy="32" r="12" fill="#3a5acc" opacity="0.7"/><circle cx="32" cy="32" r="5" fill="#cfe0ff"/>`,
  attack: `<path d="M44 8 L56 8 L56 20 L28 48 L22 42 Z" fill="${M}" stroke="#333" stroke-width="1.5"/><path d="M16 38 L26 48 L22 52 L12 42 Z" fill="${G}"/>`,
  mastery: `<path d="M20 8 L44 56 M44 8 L20 56" stroke="${M}" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="32" r="8" fill="${G}"/>`,
  pet_bond: `<path d="M32 54 C10 40 8 22 20 16 C26 13 30 16 32 20 C34 16 38 13 44 16 C56 22 54 40 32 54 Z" fill="#e07a3a" stroke="#333" stroke-width="2"/>`,
  toughness: `<path d="M32 6 L54 14 C54 36 46 50 32 58 C18 50 10 36 10 14 Z" fill="#6a7a8a" stroke="#333" stroke-width="2"/><path d="M22 32 L30 40 L44 24" stroke="#cfe" stroke-width="5" fill="none"/>`,
};
export const EXTRA = {};
export function skillIcon(key) {
  // the 3D emblem when it has been rendered; otherwise the flat icon, tagged so the emblem replaces it later
  const u = skill3dURL(key);
  if (u) return skill3dSVG(key, u);
  if (typeof document !== 'undefined') requestSkill3d(key);
  return flatSkillIcon(key).replace('<svg ', `<svg data-sk="${key}" `);
}
function flatSkillIcon(key) {
  if (EXTRA[key]) return wrap(EXTRA[key].inner, EXTRA[key].glow);
  const glow = { icelance: '#9fe8ff', venom: '#77ee33', firewall: '#ff7a2a', toxic: '#77dd33', glacial: '#bfeeff', ballzap: '#a8b8ff', inferno: '#ff6a1a', cataclysm: '#c8a8ff', pyro: '#ff8a3a', cryo: '#9fe8ff', conduit: '#b8c8ff', fire: '#ff8a3a', bolt: '#8ac8ff', frost: '#9fe8ff', meteor: '#ff6a2a', heal: '#7dff9a', skull: '#9aff9a', whirl: '#ffffff', slam: '#e0a050', knives: '#cfd8e0', blink: '#a46aff', cry: '#ff5a3a', blizzard: '#9fe8ff', quake: '#e0a050', smoke: '#aaaaaa', blades: '#cfd8e0', brutal: '#ff5a3a', wind: '#9fffc0', arcane: '#8ab8ff', elemental: '#c8a8ff', feet: '#9fd8ff', lethal: '#ff6a6a', blood: '#ff3a4a', fortune: '#ffd84d', mastery: '#ffd84d', toughness: '#bfe0ff', pet_bond: '#ff9a5a' }[key] || '#ffffff';
  return wrap(SK[key] || SK.attack, glow);
}
