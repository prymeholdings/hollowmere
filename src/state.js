import { generate, itemColor, sellPrice } from './items.js';
import { ENEMIES, QUEST_GIVER, FAME_STEPS, FAME_RANKS } from './data.js';
import { randi, pick, sfx } from './util.js';

const SAVE_KEY = 'hollowmere_save_v2';
export const SKILL_ZERO = { firebolt: 0, lightning: 0, nova: 0, meteor: 0, blizzard: 0, heal: 0, bones: 0, whirlwind: 0, slam: 0, earthquake: 0, knives: 0, blink: 0, smoke: 0, blades: 0, warcry: 0,
  mastery: 0, toughness: 0, brutality: 0, second_wind: 0, arcane_flow: 0, elemental: 0, swift_feet: 0, pet_bond: 0, lethality: 0, bloodthirst: 0, fortune: 0 };
export const BACKPACK_MAX = 40;

export const G = {
  level: null, player: null, pet: null, main: null,
  onMessage: () => {},
};

export function msg(t, c = '#e6e6e6') { G.onMessage(t, c); }

export function reset() {
  Object.assign(G, {
    heroName: 'Wanderer', cls: 'Knight', look: { cape: '#8c1f1f', hooded: false, helm: true, gear: 0, tint: '#ffffff', height: 1, capeOn: true, pet: 'fox' }, lvl: 1, xp: 0, statPoints: 0, skillPoints: 1,
    base: { str: 10, dex: 10, vit: 10, mag: 10 },
    skills: { ...SKILL_ZERO },
    hotbar: { rmb: 'firebolt', q: 'heal', w: 'nova', e: 'lightning', r: 'meteor' }, cds: {},
    gold: 80, fame: 0, fameRank: 0, hpPotions: 4, mpPotions: 2, scrolls: 2,
    equipment: {
      weapon: { base: 'Rusted Shortblade', name: 'Rusted Shortblade', slot: 'weapon', rarity: 0, ilvl: 1, req: 1, dmg: [2, 5], affixes: {}, value: 6 },
      offhand: null, helm: null,
      armor: { base: 'Padded Tunic', name: 'Padded Tunic', slot: 'armor', rarity: 0, ilvl: 1, req: 1, armor: 3, affixes: {}, value: 6 },
      ring: null, amulet: null,
    },
    backpack: [], deepest: 0, portalFloor: 0, quest: null, questOffer: null,
    petName: 'Pip', petForm: '', petFormTime: 0, petAwayTime: 0, petPendingGold: 0,
    shopStock: [], currentFloor: 0, kills: 0, fishCaught: 0, buffs: {},
  });
  G.hp = maxHp(); G.mp = maxMp();
}

export function itemBonus(s) {
  let t = 0;
  for (const k in G.equipment) { const it = G.equipment[k]; if (it) t += it.affixes[s] || 0; }
  return t;
}
export const stat = (s) => G.base[s] + itemBonus(s);
export const maxHp = () => (40 + stat('vit') * 5 + G.lvl * 6 + itemBonus('life')) * (1 + 0.08 * (G.skills.toughness || 0));
export const maxMp = () => (14 + stat('mag') * 3 + G.lvl * 2 + itemBonus('mana')) * (1 + 0.06 * (G.skills.arcane_flow || 0));
export function armor() {
  let a = itemBonus('armor');
  for (const k in G.equipment) { const it = G.equipment[k]; if (it && it.armor) a += it.armor; }
  return a + stat('dex') * 0.3 + (G.skills.toughness || 0) * 5 + (G.buffs.warcry > 0 ? 40 : 0);
}
export function weaponDamage() {
  const w = G.equipment.weapon;
  const d = w ? w.dmg : [1, 3];
  let mult = 1 + stat('str') * 0.025 + G.skills.mastery * 0.1 + itemBonus('dmg_pct') / 100;
  if (G.buffs.power > 0) mult *= 1.5;
  if (G.buffs.warcry > 0) mult *= 1.3;
  const flat = itemBonus('dmg');
  return [(d[0] + flat) * mult, (d[1] + flat) * mult];
}
export const rollDamage = () => { const d = weaponDamage(); return d[0] + Math.random() * (d[1] - d[0]); };
export const attackSpeed = () => 1.15 * (1 + stat('dex') * 0.008 + itemBonus('aspd') / 100 + G.skills.mastery * 0.03) * (G.buffs.speed > 0 ? 1.3 : 1);
export const critChance = () => 0.05 + stat('dex') * 0.002 + (G.skills.lethality || 0) * 0.015;
export const critMult = () => 2 + (G.skills.brutality || 0) * 0.15;
export const petDamage = () => (3 + G.lvl * 1.4) * (1 + 0.15 * G.skills.pet_bond);
export const petMaxHp = () => (35 + G.lvl * 10) * (1 + 0.15 * G.skills.pet_bond);
export const xpToNext = () => Math.floor(50 * Math.pow(G.lvl, 1.55));
export const fameTitle = () => FAME_RANKS[G.fameRank];

export function addXp(n) {
  G.xp += n;
  while (G.xp >= xpToNext()) {
    G.xp -= xpToNext();
    G.lvl++; G.statPoints += 5; G.skillPoints += 1;
    G.hp = maxHp(); G.mp = maxMp();
    msg(`Level up! You are now level ${G.lvl}. Press C for attributes and K for skills.`, '#ffd84d');
    sfx('level');
    G.main?.onLevelUp();
  }
}
export function addFame(n) {
  G.fame += n;
  msg(`+${n} fame`, '#c99bff');
  while (G.fameRank < FAME_STEPS.length - 1 && G.fame >= FAME_STEPS[G.fameRank + 1]) {
    G.fameRank++; G.skillPoints++;
    msg(`Your fame grows! You are now known as: ${FAME_RANKS[G.fameRank]} (+1 skill point)`, '#c99bff');
  }
}

export function clampVitals() { G.hp = Math.min(G.hp, maxHp()); G.mp = Math.min(G.mp, maxMp()); }

export function equipFromPack(i) {
  const it = G.backpack[i];
  if (!it || !(it.slot in G.equipment)) { msg("That can't be equipped."); return; }
  if (it.req > G.lvl) { msg(`You need to be level ${it.req} to use that.`, '#ff6666'); return; }
  G.backpack.splice(i, 1);
  const old = G.equipment[it.slot];
  G.equipment[it.slot] = it;
  if (old) G.backpack.splice(i, 0, old);
  clampVitals(); sfx('pick');
  G.player?.refreshVisuals();
}
export function unequip(slot) {
  const it = G.equipment[slot];
  if (!it) return;
  if (G.backpack.length >= BACKPACK_MAX) { msg('Your backpack is full.', '#ff6666'); return; }
  G.equipment[slot] = null; G.backpack.push(it);
  clampVitals(); G.player?.refreshVisuals();
}
export function pickupItem(it) {
  if (G.backpack.length >= BACKPACK_MAX) { msg('Your backpack is full!', '#ff6666'); return false; }
  G.backpack.push(it);
  msg(`Picked up ${it.name}`, '#' + itemColor(it).toString(16).padStart(6, '0'));
  sfx('pick');
  return true;
}
export function feedPet(i) {
  const it = G.backpack[i];
  if (!it || it.slot !== 'fish') return;
  if (G.petAwayTime > 0 || !G.pet || G.pet.dead) { msg(`${G.petName} isn't here right now.`); return; }
  G.backpack.splice(i, 1);
  if (!it.form) {
    msg(`${G.petName} sniffs the ${it.name} and eats it anyway.`);
    G.pet.hp = Math.min(G.pet.maxHp, G.pet.hp + G.pet.maxHp * 0.3);
    return;
  }
  G.petForm = it.form; G.petFormTime = 150;
  msg(`${G.petName} eats the ${it.name} and transforms!`, '#99e6ff');
  sfx('heal');
  G.pet.applyForm();
}
export function petSellCommons() {
  if (G.petAwayTime > 0 || !G.pet || G.pet.dead) { msg(`${G.petName} isn't here right now.`); return; }
  let total = 0, count = 0;
  for (let i = G.backpack.length - 1; i >= 0; i--) {
    const it = G.backpack[i];
    if (it.rarity === 0) { total += sellPrice(it); count++; G.backpack.splice(i, 1); }
  }
  if (!count) { msg('You have nothing common to send to town.'); return; }
  G.petPendingGold += total; G.petAwayTime = 25;
  msg(`${G.petName} trots off to town to sell ${count} items. Back in 25 seconds.`, '#99e6ff');
  G.pet.goAway();
}
export function tick(dt) {
  for (const k in G.buffs) if (G.buffs[k] > 0) G.buffs[k] -= dt;
  for (const k in G.cds) if (G.cds[k] > 0) G.cds[k] -= dt;
  if (G.petFormTime > 0) {
    G.petFormTime -= dt;
    if (G.petFormTime <= 0) { G.petForm = ''; msg(`${G.petName} returns to normal.`); G.pet?.applyForm(); }
  }
  if (G.petAwayTime > 0) {
    G.petAwayTime -= dt;
    if (G.petAwayTime <= 0) {
      G.gold += G.petPendingGold; sfx('gold');
      msg(`${G.petName} is back with ${G.petPendingGold} gold!`, '#ffd84d');
      G.petPendingGold = 0; G.pet?.comeBack();
    }
  }
}

// quests
export function makeQuest() {
  const f = Math.max(1, G.deepest + randi(0, 2));
  const r = Math.random();
  let q;
  if (r < 0.55) {
    const en = pick(ENEMIES.filter((e) => e.minFloor <= f)).name;
    const count = randi(8, 14);
    q = { type: 'slay', enemy: en, count, floor: f, title: `Cull the ${en}s`, text: `${en}s have been crawling up out of the Wells at night. Slay ${count} of them, on any floor.` };
  } else if (r < 0.85) {
    q = { type: 'relic', count: 1, floor: f, title: 'The Lost Lantern', text: `A delver dropped an old brass lantern on floor ${f} of the Sunken Wells. Bring it back to me.` };
  } else {
    const bf = Math.ceil(f / 5) * 5;
    q = { type: 'boss', count: 1, floor: bf, title: 'Guardian of the Deep', text: `Something terrible guards floor ${bf}. Find it and end it.` };
  }
  q.progress = 0; q.done = false;
  q.gold = 40 + f * 30 + (q.type === 'boss' ? 60 : 0);
  q.xp = 30 + f * 25;
  q.fame = 10 + f * 6 + (q.type === 'boss' ? 20 : 0);
  return q;
}
export function ensureQuestOffer() { if (!G.questOffer) G.questOffer = makeQuest(); }
export function acceptQuest() { G.quest = G.questOffer; G.questOffer = null; msg(`Quest accepted: ${G.quest.title}`, '#99ff99'); }
export function onKill(name, isBoss) {
  G.kills++;
  const q = G.quest;
  if (!q || q.done) return;
  if (q.type === 'slay' && name === q.enemy) {
    q.progress++;
    if (q.progress >= q.count) { q.done = true; msg(`Quest complete! Return to ${QUEST_GIVER}.`, '#99ff99'); }
    else msg(`${q.title}: ${q.progress}/${q.count}`, '#99ff99');
  } else if (q.type === 'boss' && isBoss && G.currentFloor >= q.floor) {
    q.progress = 1; q.done = true; msg(`Quest complete! Return to ${QUEST_GIVER}.`, '#99ff99');
  }
}
export function turnInQuest() {
  const q = G.quest;
  if (!q || !q.done) return;
  G.gold += q.gold; msg(`Reward: ${q.gold} gold`, '#ffd84d');
  const reward = generate(Math.max(G.lvl, q.floor + 1), 50, 1);
  G.backpack.push(reward);
  msg(`Reward: ${reward.name}`, '#6fa3ff');
  addFame(q.fame); addXp(q.xp);
  G.quest = null;
  sfx('level');
}
export function restockShop() {
  G.shopStock = [];
  const il = Math.max(G.lvl, G.deepest);
  for (let i = 0; i < 10; i++) G.shopStock.push(generate(il + randi(0, 2), 30, i < 4 ? 1 : 0));
}

// saving
const SAVE_FIELDS = ['heroName', 'cls', 'look', 'hotbar', 'lvl', 'xp', 'statPoints', 'skillPoints', 'base', 'skills', 'gold', 'fame', 'fameRank', 'hp', 'mp', 'hpPotions', 'mpPotions', 'scrolls', 'equipment', 'backpack', 'deepest', 'portalFloor', 'quest', 'questOffer', 'petName', 'petForm', 'petFormTime', 'shopStock', 'kills', 'fishCaught'];
export let lastSaved = 0;
function readSaves() {
  const out = [];
  try { const r = localStorage.getItem(SAVE_KEY); if (r) out.push(JSON.parse(r)); } catch (e) { /* corrupt local copy */ }
  try { const r = window.hm && window.hm.loadFile && window.hm.loadFile(); if (r) out.push(JSON.parse(r)); } catch (e) { /* corrupt file copy */ }
  out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return out;
}
export function saveGame() {
  if (!G.heroName || !G.cls) return false;
  const d = { v: 2, savedAt: Date.now() };
  for (const k of SAVE_FIELDS) d[k] = G[k];
  d.gold += G.petPendingGold || 0;
  if (G.level && G.player) {
    const p = G.player.root.position;
    d.loc = { kind: G.level.kind, floor: G.currentFloor || 0, x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
  }
  let json;
  try { json = JSON.stringify(d); } catch (e) { msg('Could not save the game!', '#ff5555'); return false; }
  let ok = false;
  try { localStorage.setItem(SAVE_KEY, json); ok = localStorage.getItem(SAVE_KEY) === json; } catch (e) { /* quota */ }
  try { if (window.hm && window.hm.saveFile) ok = window.hm.saveFile(json) === true || ok; } catch (e) { /* ipc */ }
  if (!ok) { msg('Could not save the game!', '#ff5555'); return false; }
  lastSaved = d.savedAt;
  return true;
}
export const hasSave = () => readSaves().length > 0;
export function savedLoc() { const d = readSaves()[0]; return d && d.loc; }
export function loadGame() {
  const d = readSaves()[0];
  if (!d) return false;
  reset();
  const look0 = { ...G.look };
  for (const k of SAVE_FIELDS) if (k in d) G[k] = d[k];
  G.look = { ...look0, ...(d.look || {}) };
  G.base = { str: 10, dex: 10, vit: 10, mag: 10, ...d.base };
  G.skills = { ...SKILL_ZERO, ...d.skills };
  G.cds = {};
  lastSaved = d.savedAt || 0;
  G.hp = Math.max(1, Math.min(G.hp, maxHp())); G.mp = Math.min(G.mp, maxMp());
  return true;
}
