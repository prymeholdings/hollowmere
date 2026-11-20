import { generate, itemColor, sellPrice, starterItem, gemEffect, upgradeItem, isTwoHanded, displayName, SOCKET_SLOTS, makeGem, GEMS } from './items.js';
import { ENEMIES, QUEST_GIVER, FAME_STEPS, FAME_RANKS } from './data.js';
import { randi, pick, sfx } from './util.js';
import { petRec, petBonus, ensurePets } from './pets.js';
import { zodiacBonus } from './zodiac.js';
import { perkBonus, liveBuff } from './perks.js';
import { Settings } from './settings.js';

const SAVE_KEY = 'hollowmere_save_v2';
export const SKILL_ZERO = { firebolt: 0, lightning: 0, nova: 0, meteor: 0, blizzard: 0, heal: 0, bones: 0, whirlwind: 0, slam: 0, earthquake: 0, knives: 0, blink: 0, smoke: 0, blades: 0, warcry: 0,
  mastery: 0, toughness: 0, brutality: 0, second_wind: 0, arcane_flow: 0, elemental: 0, swift_feet: 0, pet_bond: 0, lethality: 0, bloodthirst: 0, fortune: 0,
  ice_lance: 0, venom: 0, fire_wall: 0, toxic_cloud: 0, glacial: 0, ball_lightning: 0, inferno: 0, cataclysm: 0, pyromancy: 0, cryomancy: 0, conduit: 0 };
export const BACKPACK_MAX = 40;

export const G = {
  level: null, player: null, pet: null, main: null,
  onMessage: () => {},
};

export function msg(t, c = '#e6e6e6') { G.onMessage(t, c); }

export function reset() {
  bonusCache = null;
  Object.assign(G, {
    slotId: null,
    heroName: 'Wanderer', cls: 'Knight', look: { cape: '#8c1f1f', hooded: false, helm: true, gear: 0, tint: '#ffffff', height: 1, capeOn: true, pet: 'fox' }, lvl: 1, xp: 0, statPoints: 0, skillPoints: 1,
    base: { str: 10, dex: 10, vit: 10, mag: 10 },
    skills: { ...SKILL_ZERO },
    hotbar: { rmb: 'firebolt', q: 'heal', w: 'nova', e: 'lightning', r: 'meteor' }, cds: {},
    gold: 80, fame: 0, fameRank: 0, hpPotions: 4, mpPotions: 2, scrolls: 2,
    equipment: {
      weapon: starterItem('Knife'),
      offhand: null, helm: null,
      armor: { base: 'Rusted Leathers', name: 'Rusted Leathers', type: 'leathers', mat: 'rusted', slot: 'armor', rarity: 0, ilvl: 1, req: 1, armor: 4, affixes: { dex: 1 }, sockets: 0, gems: [], value: 6 },
      ring: null, amulet: null, shoulders: null, gloves: null, shirt: null, belt: null, pants: null, boots: null,
    },
    backpack: [], deepest: 0, portalFloor: 0, quest: null, questOffer: null,
    petName: 'Pip', petSpecies: 'fox', pets: null, petForm: '', petFormTime: 0, petAwayTime: 0, petPendingGold: 0,
    stars: {}, shopStock: [], currentFloor: 0, kills: 0, fishCaught: 0, fishLuck: 0, wellsCleared: 0, buffs: {}, timeOfDay: 0.34,
  });
  G.hp = maxHp(); G.mp = maxMp();
}

// Sum of a stat over all equipped items, including socketed gems. Cached per frame-ish via a version key.
let bonusCache = null, bonusRefs = [];
function bonusTable() {
  const refs = Object.values(G.equipment);
  if (bonusCache && refs.length === bonusRefs.length && refs.every((r, i) => r === bonusRefs[i])) return bonusCache;
  const t = {};
  const add = (k, v) => { t[k] = (t[k] || 0) + v; };
  for (const slot in G.equipment) {
    const it = G.equipment[slot];
    if (!it) continue;
    for (const k in it.affixes) add(k, it.affixes[k]);
    if (it.gems) for (const g of it.gems) if (g) { const [k, v] = gemEffect(g, slot); add(k, v); }
  }
  zodiacBonus(add);
  perkBonus(add);
  if (t.all) for (const k of ['str', 'dex', 'vit', 'mag']) add(k, t.all);
  bonusCache = t; bonusRefs = refs;
  return t;
}
export const invalidateBonus = () => { bonusCache = null; };
export function itemBonus(s) { return (bonusTable()[s] || 0) + liveBuff(s); }
export const stat = (s) => G.base[s] + itemBonus(s);
export const elementalDamage = () => ({ fire: itemBonus('fire'), cold: itemBonus('cold'), light: itemBonus('light'), poison: itemBonus('poison') });
export const maxHp = () => (40 + stat('vit') * 5 + G.lvl * 6 + itemBonus('life')) * (1 + 0.08 * (G.skills.toughness || 0)) * (1 + itemBonus('life_pct') / 100);
export const maxMp = () => (14 + stat('mag') * 3 + G.lvl * 2 + itemBonus('mana')) * (1 + 0.06 * (G.skills.arcane_flow || 0)) * (1 + itemBonus('mana_pct') / 100);
export function armor() {
  let a = itemBonus('armor');
  for (const k in G.equipment) { const it = G.equipment[k]; if (it && it.armor) a += it.armor; }
  return (a + stat('dex') * 0.3 + (G.skills.toughness || 0) * 5 + (G.buffs.warcry > 0 ? 40 : 0) + petBonus('armor')) * (1 + itemBonus('armor_pct') / 100);
}
export function weaponDamage() {
  const w = G.equipment.weapon;
  const d = w ? w.dmg : [1, 3];
  let mult = 1 + stat('str') * 0.025 + G.skills.mastery * 0.1 + (itemBonus('dmg_pct') + petBonus('dmg_pct')) / 100;
  if (G.buffs.power > 0) mult *= 1.5;
  if (G.buffs.warcry > 0) mult *= 1.3;
  const flat = itemBonus('dmg');
  return [(d[0] + flat) * mult, (d[1] + flat) * mult];
}
export const rollDamage = () => { const d = weaponDamage(); return d[0] + Math.random() * (d[1] - d[0]); };
export const attackSpeed = () => 1.15 * (1 + stat('dex') * 0.008 + itemBonus('aspd') / 100 + G.skills.mastery * 0.03) * (G.buffs.speed > 0 ? 1.3 : 1);
export const critChance = () => Math.min(0.75, 0.05 + stat('dex') * 0.002 + (G.skills.lethality || 0) * 0.015 + itemBonus('crit') / 100);
export const critMult = () => 2 + (G.skills.brutality || 0) * 0.15 + itemBonus('crit_dmg') / 100;
export const petDamage = () => (3 + petRec().lvl * 1.5 + G.lvl * 0.9) * (1 + 0.15 * G.skills.pet_bond) * (1 + itemBonus('pet_pct') / 100);
export const petMaxHp = () => (35 + petRec().lvl * 9 + G.lvl * 6) * (1 + 0.15 * G.skills.pet_bond) * (1 + itemBonus('pet_pct') / 100);
export const xpToNext = () => Math.floor(50 * Math.pow(G.lvl, 1.55));
export const fameTitle = () => FAME_RANKS[G.fameRank];

export const MAX_LEVEL = 200;
export const MAX_FLOOR = 100;
export function addXp(n) {
  if (G.lvl >= MAX_LEVEL) { G.xp = 0; return; }
  G.xp += Math.round(n * (1 + itemBonus('xp_pct') / 100));
  while (G.lvl < MAX_LEVEL && G.xp >= xpToNext()) {
    G.xp -= xpToNext();
    G.lvl++; G.statPoints += 5; G.skillPoints += 1;
    G.hp = maxHp(); G.mp = maxMp();
    msg(`Level up! You are now level ${G.lvl}. Press C for attributes and K for skills.`, '#ffd84d');
    sfx('level');
    G.main?.onLevelUp();
  }
  if (G.lvl >= MAX_LEVEL) { G.xp = 0; msg(`You have reached the highest level, ${MAX_LEVEL}.`, '#ffd84d'); }
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
  // two-handed weapons free the off-hand; an off-hand replaces a two-handed weapon
  if (it.slot === 'weapon' && isTwoHanded(it) && G.equipment.offhand) {
    if (G.backpack.length >= BACKPACK_MAX) { msg('Your backpack is full. Make room for your off-hand first.', '#ff6666'); return; }
    G.backpack.push(G.equipment.offhand); G.equipment.offhand = null;
    msg('Two-handed weapon: your off-hand was moved to your backpack.', '#b8a888');
  }
  if (it.slot === 'offhand' && isTwoHanded(G.equipment.weapon)) {
    if (G.backpack.length >= BACKPACK_MAX) { msg('Your backpack is full.', '#ff6666'); return; }
    G.backpack.push(G.equipment.weapon); G.equipment.weapon = null;
    msg('Your two-handed weapon was moved to your backpack.', '#b8a888');
  }
  const idx = G.backpack.indexOf(it);
  G.backpack.splice(idx, 1);
  const old = G.equipment[it.slot];
  G.equipment[it.slot] = it;
  if (old) G.backpack.splice(idx, 0, old);
  invalidateBonus(); clampVitals(); sfx('pick');
  G.player?.refreshVisuals();
}
// put a gem from the backpack into an item's first empty socket
export function socketGem(gemIdx, item) {
  const gem = G.backpack[gemIdx];
  if (!gem || gem.slot !== 'gem' || !item) return false;
  upgradeItem(item);
  let at = -1;
  for (let i = 0; i < item.sockets; i++) if (!item.gems[i]) { at = i; break; }
  if (at < 0) { msg('That item has no empty socket.', '#ff6666'); return false; }
  item.gems[at] = { gem: gem.gem, tier: gem.tier };
  packTake(gemIdx);
  invalidateBonus(); clampVitals(); sfx('gold');
  msg(`${gem.name} socketed into ${displayName(item)}.`, '#99ddff');
  G.player?.refreshVisuals();
  return true;
}
export function socketTargets() {
  const out = [];
  for (const s of SOCKET_SLOTS) { const it = G.equipment[s]; if (it && it.sockets > (it.gems || []).filter(Boolean).length) out.push({ it, where: 'eq' }); }
  for (const it of G.backpack) if (SOCKET_SLOTS.includes(it.slot) && it.sockets > (it.gems || []).filter(Boolean).length) out.push({ it, where: 'bp' });
  return out;
}
export function unequip(slot) {
  const it = G.equipment[slot];
  if (!it) return;
  if (G.backpack.length >= BACKPACK_MAX) { msg('Your backpack is full.', '#ff6666'); return; }
  G.equipment[slot] = null; G.backpack.push(it);
  invalidateBonus(); clampVitals(); G.player?.refreshVisuals();
}
// ---- stacking: identical gems and fish share one backpack slot (item.n = how many)
export const stackable = (it) => it && (it.slot === 'gem' || it.slot === 'fish');
const sameStack = (a, b) => a.slot === b.slot && a.name === b.name && a.tier === b.tier && a.form === b.form;
export const packCount = (it) => it.n || 1;
export function packRoom(it) { return G.backpack.length < BACKPACK_MAX || (stackable(it) && G.backpack.some((x) => stackable(x) && sameStack(x, it))); }
export function packAdd(it) {
  if (stackable(it)) { const ex = G.backpack.find((x) => stackable(x) && sameStack(x, it)); if (ex) { ex.n = packCount(ex) + packCount(it); return true; } }
  G.backpack.push(it); return true;
}
// remove one unit from slot i and return it
export function packTake(i) {
  const it = G.backpack[i];
  if (!it) return null;
  if (packCount(it) > 1) { it.n = packCount(it) - 1; return { ...it, n: 1 }; }
  G.backpack.splice(i, 1); return it;
}
// merge duplicates in older saves
export function restack() {
  const out = [];
  for (const it of G.backpack) { const ex = stackable(it) && out.find((x) => stackable(x) && sameStack(x, it)); if (ex) ex.n = packCount(ex) + packCount(it); else out.push(it); }
  G.backpack = out;
}
// rough worth of a piece of gear, used to decide whether a pickup beats what is worn
const SCORE_W = { str: 2, dex: 2, vit: 2, mag: 2, life: 0.8, mana: 0.4, dmg: 3, dmg_pct: 2, armor: 1, aspd: 2.5, leech: 3, crit: 3, spell: 2, regen: 1.5, fire: 1, cold: 1, light: 1, poison: 1, gold_find: 0.5, magic_find: 0.8 };
export function gearScore(it) {
  if (!it) return 0;
  let s = (it.armor || 0) * 1.2 + (it.rarity || 0) * 2;
  for (const k in it.affixes || {}) s += (it.affixes[k] || 0) * (SCORE_W[k] ?? 1);
  for (const g of it.gems || []) if (g) s += 4 + g.tier * 3;
  return s;
}
const AUTO_SLOTS = new Set(['helm', 'armor', 'shoulders', 'gloves', 'shirt', 'belt', 'pants', 'boots', 'ring', 'amulet']);
// armour (never weapons or off-hands) goes straight on when its slot is empty or it is clearly better
function autoEquip(it) {
  if (Settings.autoEquip === false) return;
  if (!it || !AUTO_SLOTS.has(it.slot) || !(it.slot in G.equipment) || (it.req || 0) > G.lvl) return;
  const cur = G.equipment[it.slot];
  if (cur && gearScore(it) <= gearScore(cur) * 1.05 + 0.5) return;
  const i = G.backpack.indexOf(it);
  if (i < 0) return;
  equipFromPack(i);
  if (G.equipment[it.slot] === it) msg(`Auto-equipped ${displayName(it)}${cur ? ` (better than your ${displayName(cur)})` : ''}`, '#9fd8a0');
}
export function pickupItem(it) {
  if (!packRoom(it)) { msg('Your backpack is full!', '#ff6666'); return false; }
  packAdd(it);
  msg(`Picked up ${displayName(it)}`, '#' + itemColor(it).toString(16).padStart(6, '0'));
  sfx('pick');
  autoEquip(it);
  if ((it.rarity || 0) >= 2) G.main?.barkLoot?.();
  return true;
}
export function feedPet(i) {
  const it = G.backpack[i];
  if (!it || it.slot !== 'fish') return;
  if (G.petAwayTime > 0 || !G.pet || G.pet.dead) { msg(`${G.petName} isn't here right now.`); return; }
  packTake(i);
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
function petSell(pred, label) {
  if (G.petAwayTime > 0 || !G.pet || G.pet.dead) { msg(`${G.petName} isn't here right now.`); return; }
  let total = 0, count = 0;
  for (let i = G.backpack.length - 1; i >= 0; i--) {
    const it = G.backpack[i];
    if (pred(it)) { total += sellPrice(it) * packCount(it); count += packCount(it); G.backpack.splice(i, 1); }
  }
  if (!count) { msg(`You have nothing ${label} to send to town.`); return; }
  G.petPendingGold += total; G.petAwayTime = 25;
  msg(`${G.petName} trots off to town to sell ${count} items. Back in 25 seconds.`, '#99e6ff');
  G.pet.goAway();
}
export function petSellCommons() { petSell((it) => it.rarity === 0, 'common'); }
export function petSellMagic() { petSell((it) => it.rarity === 1 && it.slot !== 'gem' && it.slot !== 'fish', 'magic'); }
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
  // a couple of gems (finer ones once the hero has gone deeper)
  for (let i = 0; i < 2; i++) G.shopStock.push(makeGem(pick(Object.keys(GEMS)), Math.min(2, Math.floor(G.deepest / 30))));
}

// saving
const SAVE_FIELDS = ['heroName', 'cls', 'look', 'hotbar', 'lvl', 'xp', 'statPoints', 'skillPoints', 'base', 'skills', 'gold', 'fame', 'fameRank', 'hp', 'mp', 'hpPotions', 'mpPotions', 'scrolls', 'equipment', 'backpack', 'deepest', 'portalFloor', 'quest', 'questOffer', 'petName', 'petForm', 'petFormTime', 'shopStock', 'kills', 'fishCaught', 'fishLuck', 'wellsCleared', 'timeOfDay', 'petSpecies', 'pets', 'stars'];
export let lastSaved = 0;
// ---- several heroes: every hero is its own slot (own localStorage key + own file in the PC app), listed on the title menu
const IDX_KEY = 'hollowmere_chars_v1', MIG_KEY = 'hollowmere_chars_migrated';
const slotKey = (id) => 'hollowmere_char_' + id;
const okId = (id) => /^[a-z0-9_-]{1,24}$/i.test(id || '');
const newSlotId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const parseSafe = (r) => { try { const d = r ? JSON.parse(r) : null; return d && typeof d === 'object' ? d : null; } catch (e) { return null; } };
function readSlot(id) {
  if (!okId(id)) return null;
  const out = [];
  try { const d = parseSafe(localStorage.getItem(slotKey(id))); if (d) out.push(d); } catch (e) { /* storage blocked */ }
  try { const d = parseSafe(window.hm && window.hm.slotLoad && window.hm.slotLoad(id)); if (d) out.push(d); } catch (e) { /* ipc */ }
  out.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return out[0] || null;
}
function slotIds() {
  const ids = new Set();
  try { for (const i of JSON.parse(localStorage.getItem(IDX_KEY) || '[]')) if (okId(i)) ids.add(i); } catch (e) { /* none */ }
  try { for (const i of (window.hm && window.hm.slotList && window.hm.slotList()) || []) if (okId(i)) ids.add(i); } catch (e) { /* ipc */ }
  return [...ids];
}
function writeIndex(ids) { try { localStorage.setItem(IDX_KEY, JSON.stringify([...new Set(ids)])); } catch (e) { /* quota */ } }
function writeSlot(id, json) {
  let ok = false;
  try { localStorage.setItem(slotKey(id), json); ok = localStorage.getItem(slotKey(id)) === json; } catch (e) { /* quota */ }
  try { if (window.hm && window.hm.slotSave) ok = window.hm.slotSave(id, json) === true || ok; } catch (e) { /* ipc */ }
  if (ok) writeIndex([...slotIds(), id]);
  return ok;
}
// the single save of older versions becomes the first hero
function migrateLegacy() {
  try { if (localStorage.getItem(MIG_KEY)) return; localStorage.setItem(MIG_KEY, '1'); } catch (e) { return; }
  const old = [];
  try { const d = parseSafe(localStorage.getItem(SAVE_KEY)); if (d) old.push(d); } catch (e) { /* none */ }
  try { const d = parseSafe(window.hm && window.hm.loadFile && window.hm.loadFile()); if (d) old.push(d); } catch (e) { /* none */ }
  old.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  if (old[0] && old[0].heroName && old[0].cls) writeSlot(newSlotId(), JSON.stringify(old[0]));
}
export function listChars() {
  migrateLegacy();
  return slotIds().map((id) => ({ id, d: readSlot(id) })).filter((x) => x.d && x.d.heroName && x.d.cls)
    .map(({ id, d }) => ({ id, name: d.heroName, cls: d.cls, lvl: d.lvl || 1, race: d.look && d.look.race, savedAt: d.savedAt || 0, loc: d.loc, deepest: d.deepest || 0, fame: d.fameRank }))
    .sort((a, b) => b.savedAt - a.savedAt);
}
export const MAX_CHARS = 12;
export function deleteChar(id) {
  if (!okId(id)) return;
  try { localStorage.removeItem(slotKey(id)); } catch (e) { /* ignore */ }
  try { if (window.hm && window.hm.slotDel) window.hm.slotDel(id); } catch (e) { /* ipc */ }
  writeIndex(slotIds().filter((i) => i !== id));
}
export function saveGame() {
  if (!G.heroName || !G.cls) return false;
  if (!okId(G.slotId)) G.slotId = newSlotId();
  const d = { v: 2, savedAt: Date.now() };
  for (const k of SAVE_FIELDS) d[k] = G[k];
  d.gold += G.petPendingGold || 0;
  if (G.level && G.player) {
    const p = G.player.root.position;
    d.loc = { kind: G.level.kind, floor: G.currentFloor || 0, x: +p.x.toFixed(2), z: +p.z.toFixed(2) };
  }
  let json;
  try { json = JSON.stringify(d); } catch (e) { msg('Could not save the game!', '#ff5555'); return false; }
  if (!writeSlot(G.slotId, json)) { msg('Could not save the game!', '#ff5555'); return false; }
  lastSaved = d.savedAt;
  return true;
}
export const hasSave = () => listChars().length > 0;
// ---- moving a save between devices: a short text code ("HM1:" + gzipped JSON in base64url) or a file holding it
const b64u = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (t) => { const s = atob(t.replace(/-/g, '+').replace(/_/g, '/')); const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i); return b; };
const pipe = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
export async function exportSaveCode() {
  if (G.player) saveGame();
  const d = (G.slotId && readSlot(G.slotId)) || (listChars()[0] && readSlot(listChars()[0].id));
  if (!d) return null;
  const json = new TextEncoder().encode(JSON.stringify(d));
  if (typeof CompressionStream === 'undefined') return 'HM0:' + b64u(json);
  return 'HM1:' + b64u(await pipe(json, new CompressionStream('gzip')));
}
export async function parseSaveCode(text) {
  const t = String(text || '').trim().replace(/\s+/g, '');
  let d;
  if (t.startsWith('{')) d = JSON.parse(t);
  else if (t.startsWith('HM1:')) d = JSON.parse(new TextDecoder().decode(await pipe(unb64u(t.slice(4)), new DecompressionStream('gzip'))));
  else if (t.startsWith('HM0:')) d = JSON.parse(new TextDecoder().decode(unb64u(t.slice(4))));
  else throw new Error('This is not a Hollowmere save code.');
  if (!d || typeof d !== 'object' || !d.heroName || !d.cls || !d.base || !d.equipment) throw new Error('The save code is incomplete.');
  return d;
}
// write an imported save as the newest save on this device (it wins over older local copies)
export function storeImportedSave(d) {
  d = { ...d, savedAt: Date.now() };
  return writeSlot(newSlotId(), JSON.stringify(d));
}
export function savedLoc(id) { const d = readSlot(id || (listChars()[0] || {}).id); return d && d.loc; }
export function loadGame(id) {
  id = id || (listChars()[0] || {}).id;
  const d = readSlot(id);
  if (!d) return false;
  reset();
  G.slotId = id;
  const look0 = { ...G.look };
  for (const k of SAVE_FIELDS) if (k in d) G[k] = d[k];
  G.look = { ...look0, ...(d.look || {}) };
  G.base = { str: 10, dex: 10, vit: 10, mag: 10, ...d.base };
  G.skills = { ...SKILL_ZERO, ...d.skills };
  G.stars = { ...(d.stars || {}) };
  for (const k of ['shoulders', 'gloves', 'shirt', 'belt', 'pants', 'boots']) if (!(k in G.equipment)) G.equipment[k] = null; // saves from before the extra slots
  for (const k in G.equipment) if (G.equipment[k]) upgradeItem(G.equipment[k]);
  G.backpack.forEach(upgradeItem); (G.shopStock || []).forEach(upgradeItem);
  if (!d.pets) { G.pets = null; G.petSpecies = 'fox'; ensurePets(); G.pets.fox.coat = (G.look && G.look.pet) || 'fox'; const l = Math.min(60, 1 + Math.floor(G.lvl / 2)); G.pets.fox.lvl = l; G.pets.fox.points = l - 1; }
  ensurePets();
  invalidateBonus();
  G.cds = {};
  lastSaved = d.savedAt || 0;
  G.hp = Math.max(1, Math.min(G.hp, maxHp())); G.mp = Math.min(G.mp, maxMp());
  return true;
}
