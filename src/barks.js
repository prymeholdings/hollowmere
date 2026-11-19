// Spoken lines: the hero mutters and swears as they fight through the Wells, townsfolk grumble, and
// monsters jeer. Every line is [strong, clean]; the Profanity setting picks which one is shown,
// and the Barks setting turns the chatter off. Speech shows as a bubble over the speaker and in the log.
import { G, msg } from './state.js';
import { Settings } from './settings.js';

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

const HERO = {
  kill: [
    ['Fuck you very much.', 'Thank you, and goodnight.'],
    ['Die slower next time, you bastard.', 'Stay down this time.'],
    ['Piss-poor excuse for a monster.', 'Weak. Not even a warm-up.'],
    ['Eat shit and bleed.', 'Choke on that.'],
    ['Back to hell, asshole.', 'Back where you came from.'],
    ['Bastard never saw it coming.', 'Never saw it coming.'],
    ['That felt fucking good.', 'That felt good.'],
    ['Next cunt in line!', 'Who is next?'],
    ['Goddamn mess. Worth it.', 'Messy. Worth it.'],
  ],
  streak: [
    ['I am a fucking storm of murder!', 'Nothing can stop me today!'],
    ['Bring the whole damn graveyard!', 'Bring the whole graveyard!'],
    ['Fucking unstoppable, you shitheads!', 'You cannot stop me!'],
  ],
  bigkill: [
    ['Holy shit, he exploded.', 'Well. That was thorough.'],
    ['Wear that, you son of a bitch!', 'Wear that, you brute!'],
    ['Fucking confetti.', 'Messy confetti.'],
  ],
  hurt: [
    ['Ow! Fuck!', 'Ow! That hurt!'],
    ['Son of a bitch!', 'You will pay for that!'],
    ['Goddamn it!', 'Blast it!'],
    ['That fucking hurt, you prick.', 'That hurt, you brute.'],
  ],
  low: [
    ['Shit, shit, shit. Potion. Now.', 'Not good. Potion. Now.'],
    ['I am bleeding like a stuck pig, fuck.', 'I am bleeding badly.'],
    ['Not dying here. Not in this shithole.', 'Not dying here. Not today.'],
  ],
  potion: [
    ['Tastes like piss. Works like magic.', 'Tastes foul. Works well.'],
    ['Ahh. Fuck, that is better.', 'Ahh. That is better.'],
  ],
  mana: [['Cold as a witch\'s tit, and just as helpful.', 'Cold and bitter, and just what I needed.']],
  down: [
    ['Deeper we go. Fuck my life.', 'Deeper we go.'],
    ['Smells like rot and bad decisions.', 'Smells like rot and bad decisions.'],
    ['Whatever is down here, I will gut it.', 'Whatever is down here, I will beat it.'],
    ['Another damn staircase.', 'Another staircase.'],
    ['Who builds a goddamn dungeon this big?', 'Who builds a dungeon this big?'],
  ],
  boss: [
    ['Oh, you big ugly bastard.', 'Oh, you big ugly brute.'],
    ['Fuck me, that thing is huge.', 'Gods, that thing is huge.'],
    ['Time to bleed a god-damned king.', 'Time to fell a king.'],
  ],
  bossdown: [
    ['Fuck yeah! Kneel, you corpse!', 'Yes! Kneel, you corpse!'],
    ['And stay dead, you prick.', 'And stay dead.'],
  ],
  loot: [
    ['Oh, hello, you beautiful bastard.', 'Oh, hello, beautiful.'],
    ['Fuck yes. Shiny.', 'Yes. Shiny.'],
    ['Now that is some good shit.', 'Now that is a find.'],
  ],
  level: [
    ['Level up, you fucking beauty!', 'Level up! Marvellous!'],
    ['Stronger, meaner, angrier. Good.', 'Stronger, tougher. Good.'],
  ],
  portal: [['Damn magic gives me the shits.', 'Magic makes my stomach turn.']],
  town: [
    ['Home. Now where is the goddamn ale?', 'Home. Now where is the ale?'],
    ['Smells better than the dungeon, at least. Fuck.', 'Smells better than the dungeon, at least.'],
  ],
  fishCatch: [['Got you, you slippery bastard.', 'Got you, you slippery thing.']],
  fishLose: [['Fucking fish. Fucking pond.', 'Wretched fish. Wretched pond.']],
  idle: [
    ['Cold, dark, wet, and full of dead cunts. Lovely.', 'Cold, dark, wet and full of the dead. Lovely.'],
    ['I could be drinking right now. Fuck.', 'I could be drinking right now.'],
    ['Something is watching. Fuck it.', 'Something is watching. Let it.'],
    ['My feet are soaked. Piss on this place.', 'My feet are soaked. Curse this place.'],
    ['If I die down here, I am haunting someone.', 'If I die down here, I am haunting someone.'],
    ['Everything down here wants me dead. Rude.', 'Everything down here wants me dead. Rude.'],
    ['Smells like ass and old blood.', 'Smells like old blood.'],
  ],
  death: [
    ['Fuck... this... hurts...', 'This... hurts...'],
    ['Shit. Not again.', 'Not again.'],
  ],
  cast: [
    ['Burn, you shit!', 'Burn!'],
    ['Get fucked!', 'Take that!'],
    ['Suck on this!', 'Try this!'],
  ],
};

const NPC = {
  merchant: [
    ['Coin first, you cheap fuck, then look.', 'Coin first, friend, then look.'],
    ['Prices are fair. Fuck off if you disagree.', 'Prices are fair. Go elsewhere if you disagree.'],
    ['Buy something or piss off, the draught is killing my trade.', 'Buy something or go, the draught hurts my trade.'],
  ],
  quest: [
    ['The Wells are fucked, and you are my best hope. Shit.', 'The Wells are cursed, and you are my best hope.'],
    ['Go kill the bastards. Come back rich.', 'Go slay the beasts. Come back rich.'],
  ],
  blacksmith: [
    ['Bring me iron, not your damn feelings.', 'Bring me iron, not your feelings.'],
    ['My hammer has killed better men than you. Hells, it is just a hammer.', 'My hammer is older than you. Mind it.'],
  ],
  healer: [
    ['Bleeding on my floor again. Fucking marvellous.', 'Bleeding on my floor again. Marvellous.'],
    ['I stitch them up, they run back and die. Arse-first idiots.', 'I stitch them up, they run back and die. Foolish.'],
  ],
  beastmaster: [
    ['Hurt that animal and I will cut your damn balls off.', 'Hurt that animal and you will answer to me.'],
    ['Good pets, shit people. That is the rule.', 'Good pets, rough people. That is the rule.'],
  ],
  villager: [
    ['Bloody Wells. Shit stinks since the water turned.', 'The Wells stink since the water turned.'],
    ['My husband went down that hole. Piss on him, he owes me coin.', 'My husband went down that hole. He owes me coin.'],
    ['Fucking crows. Fucking harvest. Fucking everything.', 'Wretched crows. Wretched harvest. Everything.'],
    ['Do not stand there like a prick, speak or move on.', 'Do not stand there, speak or move on.'],
    ['Heard you are the hero. Fuck, we are doomed.', 'Heard you are the hero. We are doomed.'],
    ['Piss off, I am drinking.', 'Leave me be, I am drinking.'],
    ['Watch where you walk, you clumsy ox.', 'Watch where you walk, ox.'],
    ['If one more skeleton knocks, I will shit myself.', 'If one more skeleton knocks, I will faint.'],
  ],
};

const FOE = [
  ['Your guts will make fine rope!', 'You will make fine rope!'],
  ['Fuck you and fuck your mother!', 'Your mother would be ashamed!'],
  ['I will shit on your grave!', 'I will dance on your grave!'],
  ['Come here, you pathetic fuck!', 'Come here, you pathetic fool!'],
  ['Bleed for me, little bitch!', 'Bleed for me, little worm!'],
  ['You smell like cowardice and ass!', 'You smell like cowardice!'],
  ['Hell has a seat for you, cunt.', 'Hell has a seat for you.'],
  ['Die, you meat-sack bastard!', 'Die, meat-sack!'],
];

const FOE_DEATH = [
  ['Fuuuck...', 'Nooo...'],
  ['Shit. Shit. Shit.', 'Ugh. No.'],
  ['Damn you to hell...', 'Curse you...'],
];

const text = (pair) => (Settings.profanity ? pair[0] : pair[1]);
let cd = 0, idleT = 12, npcT = 8, foeT = 9, streak = 0, streakT = 0, lastLow = 0;

function say(ent, pair, color, dur = 3.2) {
  if (!ent || !Settings.barks) return false;
  const t = text(pair);
  G.main.ui.bubble(ent, t, color, dur);
  msg(`${ent === G.player ? (G.heroName || 'You') : (ent.data?.name || ent.label?.text || 'Someone')}: "${t}"`, color);
  return true;
}

export const Barks = {
  reset() { cd = 2; idleT = 12; npcT = 8; foeT = 9; streak = 0; streakT = 0; },
  hero(kind, chance = 1, hold = 2.5) {
    if (!Settings.barks || !G.player || G.player.dead || !HERO[kind]) return;
    if (cd > 0 || Math.random() > chance) return;
    if (say(G.player, rnd(HERO[kind]), '#ffe9b0')) cd = hold + Math.random() * 2;
  },
  kill(enemy, big) {
    streak++; streakT = 6;
    if (enemy.boss) return this.hero('bossdown', 1, 0);
    if (streak >= 6 && streak % 6 === 0) return this.hero('streak', 0.8, 1);
    if (big) return this.hero('bigkill', 0.5);
    this.hero('kill', 0.12);
    if (Settings.barks && Math.random() < 0.18 && !enemy.boss) say(enemy, rnd(FOE_DEATH), '#e8a090', 1.6);
  },
  npc(ent) {
    const key = ent.kind && NPC[ent.kind] ? ent.kind : 'villager';
    if (Settings.barks && !ent.__sayCd) { ent.__sayCd = 1; setTimeout(() => { ent.__sayCd = 0; }, 3000); say(ent, rnd(NPC[key]), '#f3e6c4', 3.5); }
  },
  villagerLine(v) {
    return Settings.barks && Settings.profanity && Math.random() < 0.5 ? rnd(NPC.villager)[0] : null;
  },
  update(dt) {
    cd -= dt; streakT -= dt; if (streakT <= 0) streak = 0;
    const pl = G.player;
    if (!Settings.barks || !pl || pl.dead || !G.level) return;
    idleT -= dt; npcT -= dt; foeT -= dt;
    const dungeon = G.level.kind === 'dungeon';
    if (idleT <= 0) { idleT = 25 + Math.random() * 25; if (dungeon) this.hero('idle', 1, 1); }
    if (npcT <= 0) {
      npcT = 8 + Math.random() * 8;
      const near = G.level.entities.filter((e) => e.type === 'interact' && e.label && NPC[e.kind] && e.root.position.distanceTo(pl.root.position) < 12);
      if (near.length) { const e = rnd(near); say(e, rnd(NPC[e.kind]), '#f3e6c4', 3.5); }
    }
    if (foeT <= 0) {
      foeT = 9 + Math.random() * 9;
      const near = G.level.entities.filter((e) => e.type === 'enemy' && !e.dead && e.root.visible && e.root.position.distanceTo(pl.root.position) < 11);
      if (near.length) say(rnd(near), rnd(FOE), '#ff9a8a', 2.6);
    }
  },
};
