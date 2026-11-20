export const ENEMIES = [
  { name: 'Gloomrat', shape: 'beast', color: 0x6b5242, hp: 10, dmg: 3, speed: 4.6, xp: 7, minFloor: 1 },
  { name: 'Sludgeling', shape: 'blob', color: 0x59a040, hp: 16, dmg: 3, speed: 2.6, xp: 8, minFloor: 1 },
  { name: 'Bonechatter', shape: 'skel_minion', color: 0xdcd4b8, hp: 20, dmg: 4, speed: 3.4, xp: 11, minFloor: 1 },
  { name: 'Cinderwisp', shape: 'wisp', color: 0xff8026, hp: 14, dmg: 5, speed: 3.0, xp: 13, minFloor: 2, ranged: true },
  { name: 'Grave Archer', shape: 'skel_rogue', color: 0xc8c0a8, hp: 16, dmg: 5, speed: 3.2, xp: 14, minFloor: 2, ranged: true, boltColor: 0xd8d8d0 },
  { name: 'Grey Wretch', shape: 'alien', color: 0x6fbf6f, hp: 22, dmg: 5, speed: 3.9, xp: 15, minFloor: 2 },
  { name: 'Thornback Brute', shape: 'brute', color: 0x4d7359, tint: 0x88bb88, hp: 55, dmg: 9, speed: 2.8, xp: 30, minFloor: 3 },
  { name: 'Hollow Sentinel', shape: 'skel_warrior', color: 0x808fbf, tint: 0xb0b8e0, hp: 42, dmg: 8, speed: 3.2, xp: 24, minFloor: 4 },
  { name: 'Bone Hexer', shape: 'skel_mage', color: 0x9966ff, tint: 0xd0c0ff, hp: 26, dmg: 9, speed: 2.8, xp: 26, minFloor: 5, ranged: true, boltColor: 0xaa66ff },
  { name: 'Mirewitch', shape: 'wisp', color: 0x8c4dd9, hp: 30, dmg: 9, speed: 2.8, xp: 28, minFloor: 6, ranged: true },
  { name: 'Gravecrawler', shape: 'beast', color: 0x40404d, hp: 36, dmg: 10, speed: 4.2, xp: 26, minFloor: 8 },
  { name: 'Frostbone Reaver', shape: 'skel_warrior', color: 0x9fd8ff, tint: 0xbfe8ff, emissive: 0x113355, hp: 48, dmg: 10, speed: 3.3, xp: 30, minFloor: 12 },
  { name: 'Grey Zapper', shape: 'alien', color: 0x66ffcc, tint: 0xaaddff, emissive: 0x0a3a3a, hp: 30, dmg: 10, speed: 3.2, xp: 28, minFloor: 10, ranged: true, boltColor: 0x66ffcc },
  { name: 'Ember Imp', shape: 'wisp', color: 0xff3d1a, hp: 28, dmg: 11, speed: 3.6, xp: 28, minFloor: 15, ranged: true },
  { name: 'Drowned Thrall', shape: 'skel_minion', color: 0x4d8c80, tint: 0x6fb0a0, hp: 40, dmg: 10, speed: 3.6, xp: 27, minFloor: 18 },
  { name: 'Venomspitter', shape: 'skel_rogue', color: 0x66cc33, tint: 0x99dd66, emissive: 0x113300, hp: 34, dmg: 12, speed: 3.2, xp: 30, minFloor: 22, ranged: true, boltColor: 0x77ee33 },
  { name: 'Ironhide Ogre', shape: 'brute', color: 0x5a5a66, tint: 0x8888a0, hp: 90, dmg: 14, speed: 2.7, xp: 44, minFloor: 28 },
  { name: 'Void Grey', shape: 'alien', color: 0x9966ff, tint: 0xc09aff, emissive: 0x220055, hp: 44, dmg: 14, speed: 4.2, xp: 36, minFloor: 30 },
  { name: 'Void Hexer', shape: 'skel_mage', color: 0x3d1a66, tint: 0x6a3d99, emissive: 0x220044, hp: 38, dmg: 13, speed: 2.9, xp: 34, minFloor: 35, ranged: true, boltColor: 0x9933ff },
  { name: 'Abyssal Hound', shape: 'beast', color: 0x1a0d26, hp: 46, dmg: 13, speed: 4.8, xp: 32, minFloor: 42 },
  { name: 'Stormcaller', shape: 'wisp', color: 0x66ccff, hp: 40, dmg: 14, speed: 3.0, xp: 36, minFloor: 50, ranged: true },
  { name: 'Abyssal Grey', shape: 'alien', color: 0x663399, tint: 0x8855cc, emissive: 0x330066, hp: 60, dmg: 16, speed: 3.4, xp: 44, minFloor: 55, ranged: true, boltColor: 0xaa44ff },
  { name: 'Obsidian Knight', shape: 'skel_warrior', color: 0x1a1a1f, tint: 0x33333d, emissive: 0x330800, hp: 70, dmg: 15, speed: 3.3, xp: 42, minFloor: 60 },
  { name: 'Wellspawn Horror', shape: 'blob', color: 0x2a0d33, hp: 80, dmg: 15, speed: 3.0, xp: 40, minFloor: 70 },
  { name: 'Deep Tyrant', shape: 'brute', color: 0x330d0d, tint: 0x662222, emissive: 0x330000, hp: 120, dmg: 18, speed: 2.9, xp: 56, minFloor: 82 },
];
export const BOSSES = [
  { name: 'The Drowned Warden', shape: 'skel_warrior', color: 0x33668c, tint: 0x6699cc },
  { name: 'Mother of Cinders', shape: 'skel_mage', color: 0xff4d1a, tint: 0xff9966, ranged: true, boltColor: 0xff5522 },
  { name: 'Graveroot Colossus', shape: 'brute', color: 0x59472e, tint: 0xaa8866 },
  { name: 'The Pale Visitor', shape: 'alien', color: 0x88ff99, tint: 0xaaffcc, ranged: true, boltColor: 0x66ffaa },
  { name: 'The Lantern-Eater', shape: 'skel_warrior', color: 0x261f33, tint: 0x554466 },
];
// the guardian at the bottom of the Wells (floor 100)
export const FINAL_BOSS = { name: 'The Hollow King', shape: 'skel_mage', color: 0x6a2aff, tint: 0x6a4aa0, ranged: true, boltColor: 0xa060ff, final: true };
export const QUEST_GIVER = 'Warden Ilsa Corvane';
export const FAME_STEPS = [0, 40, 120, 300, 600, 1000, 1600, 2500, 4000];
export const FAME_RANKS = ['Unknown', 'Local Curiosity', 'Well-Spoken Of', 'Trusted Delver', 'Hero of Hollowmere', 'Wellbreaker', 'Legend of the Deep', 'Myth-Touched', 'Undying Name'];
