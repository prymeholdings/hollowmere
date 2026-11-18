export const ENEMIES = [
  { name: 'Gloomrat', shape: 'beast', color: 0x6b5242, hp: 10, dmg: 3, speed: 4.6, xp: 7, minFloor: 1 },
  { name: 'Sludgeling', shape: 'blob', color: 0x59a040, hp: 16, dmg: 3, speed: 2.6, xp: 8, minFloor: 1 },
  { name: 'Bonechatter', shape: 'skel_minion', color: 0xdcd4b8, hp: 20, dmg: 4, speed: 3.4, xp: 11, minFloor: 1 },
  { name: 'Cinderwisp', shape: 'wisp', color: 0xff8026, hp: 14, dmg: 5, speed: 3.0, xp: 13, minFloor: 2, ranged: true },
  { name: 'Grave Archer', shape: 'skel_rogue', color: 0xc8c0a8, hp: 16, dmg: 5, speed: 3.2, xp: 14, minFloor: 2, ranged: true, boltColor: 0xd8d8d0 },
  { name: 'Thornback Brute', shape: 'brute', color: 0x4d7359, tint: 0x88bb88, hp: 55, dmg: 9, speed: 2.8, xp: 30, minFloor: 3 },
  { name: 'Hollow Sentinel', shape: 'skel_warrior', color: 0x808fbf, tint: 0xb0b8e0, hp: 42, dmg: 8, speed: 3.2, xp: 24, minFloor: 4 },
  { name: 'Bone Hexer', shape: 'skel_mage', color: 0x9966ff, tint: 0xd0c0ff, hp: 26, dmg: 9, speed: 2.8, xp: 26, minFloor: 5, ranged: true, boltColor: 0xaa66ff },
  { name: 'Mirewitch', shape: 'wisp', color: 0x8c4dd9, hp: 30, dmg: 9, speed: 2.8, xp: 28, minFloor: 6, ranged: true },
  { name: 'Gravecrawler', shape: 'beast', color: 0x40404d, hp: 36, dmg: 10, speed: 4.2, xp: 26, minFloor: 8 },
];
export const BOSSES = [
  { name: 'The Drowned Warden', shape: 'skel_warrior', color: 0x33668c, tint: 0x6699cc },
  { name: 'Mother of Cinders', shape: 'skel_mage', color: 0xff4d1a, tint: 0xff9966, ranged: true, boltColor: 0xff5522 },
  { name: 'Graveroot Colossus', shape: 'brute', color: 0x59472e, tint: 0xaa8866 },
  { name: 'The Lantern-Eater', shape: 'skel_warrior', color: 0x261f33, tint: 0x554466 },
];
export const QUEST_GIVER = 'Warden Ilsa Corvane';
export const FAME_STEPS = [0, 40, 120, 300, 600, 1000, 1600, 2500, 4000];
export const FAME_RANKS = ['Unknown', 'Local Curiosity', 'Well-Spoken Of', 'Trusted Delver', 'Hero of Hollowmere', 'Wellbreaker', 'Legend of the Deep', 'Myth-Touched', 'Undying Name'];
