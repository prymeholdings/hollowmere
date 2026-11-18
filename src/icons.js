// Hand-made SVG icons for items and skills (original artwork).
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
  potion_hp: `<path d="M26 8 L38 8 L38 20 C48 24 52 32 52 40 C52 52 42 58 32 58 C22 58 12 52 12 40 C12 32 16 24 26 20 Z" fill="#c81e1e" stroke="#333" stroke-width="2"/><rect x="24" y="4" width="16" height="6" fill="${D}"/><circle cx="24" cy="38" r="4" fill="#fff" opacity="0.5"/>`,
  potion_mp: `<path d="M26 8 L38 8 L38 20 C48 24 52 32 52 40 C52 52 42 58 32 58 C22 58 12 52 12 40 C12 32 16 24 26 20 Z" fill="#2a4ad8" stroke="#333" stroke-width="2"/><rect x="24" y="4" width="16" height="6" fill="${D}"/><circle cx="24" cy="38" r="4" fill="#fff" opacity="0.5"/>`,
  portal: `<circle cx="32" cy="32" r="22" fill="none" stroke="#7aa0ff" stroke-width="6"/><circle cx="32" cy="32" r="12" fill="#3a5acc" opacity="0.7"/><circle cx="32" cy="32" r="5" fill="#cfe0ff"/>`,
  attack: `<path d="M44 8 L56 8 L56 20 L28 48 L22 42 Z" fill="${M}" stroke="#333" stroke-width="1.5"/><path d="M16 38 L26 48 L22 52 L12 42 Z" fill="${G}"/>`,
  mastery: `<path d="M20 8 L44 56 M44 8 L20 56" stroke="${M}" stroke-width="6" stroke-linecap="round"/><circle cx="32" cy="32" r="8" fill="${G}"/>`,
  pet_bond: `<path d="M32 54 C10 40 8 22 20 16 C26 13 30 16 32 20 C34 16 38 13 44 16 C56 22 54 40 32 54 Z" fill="#e07a3a" stroke="#333" stroke-width="2"/>`,
  toughness: `<path d="M32 6 L54 14 C54 36 46 50 32 58 C18 50 10 36 10 14 Z" fill="#6a7a8a" stroke="#333" stroke-width="2"/><path d="M22 32 L30 40 L44 24" stroke="#cfe" stroke-width="5" fill="none"/>`,
};
export function skillIcon(key) {
  const glow = { fire: '#ff8a3a', bolt: '#8ac8ff', frost: '#9fe8ff', meteor: '#ff6a2a', heal: '#7dff9a', skull: '#9aff9a', whirl: '#ffffff', slam: '#e0a050', knives: '#cfd8e0', blink: '#a46aff', cry: '#ff5a3a' }[key] || '#ffffff';
  return wrap(SK[key] || SK.attack, glow);
}
