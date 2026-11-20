// Difficulty levels: tougher foes, more of them, and bigger rewards (experience, gold, magic find).
import { Settings } from './settings.js';

export const DIFFICULTIES = {
  easy: { name: 'Easy', hp: 0.7, dmg: 0.6, xp: 0.85, gold: 1, mf: 0, mobs: 0.85, note: 'Weaker foes, a bit less experience' },
  normal: { name: 'Normal', hp: 1, dmg: 1, xp: 1, gold: 1, mf: 0, mobs: 1, note: 'The intended challenge' },
  hard: { name: 'Hard', hp: 1.6, dmg: 1.4, xp: 1.6, gold: 1.35, mf: 30, mobs: 1.15, note: '+60% experience, +35% gold, +30% magic find' },
  nightmare: { name: 'Nightmare', hp: 2.6, dmg: 2, xp: 2.4, gold: 1.75, mf: 70, mobs: 1.3, note: '+140% experience, +75% gold, +70% magic find' },
  hell: { name: 'Hell', hp: 4, dmg: 3, xp: 3.5, gold: 2.3, mf: 130, mobs: 1.5, note: '+250% experience, +130% gold, +130% magic find' },
};
export const diff = () => DIFFICULTIES[Settings.difficulty] || DIFFICULTIES.normal;
