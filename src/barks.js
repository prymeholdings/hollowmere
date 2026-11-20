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


// ---- the filthy expansion: many more lines everywhere, merged into the pools above
const MORE_HERO = {
  kill: [
    ['Lie down, shit-for-brains.', 'Lie down.'],
    ['Your mother should have swallowed you.', 'Your mother would be disappointed.'],
    ['Splat, motherfucker.', 'Splat.'],
    ['That is what you get for having a face like a slapped arse.', 'That is what you get.'],
    ['Go cry to whatever fucked your mum.', 'Go cry about it.'],
    ['Cheap bastard died broke. Not even a copper.', 'Not even a copper.'],
    ['I have taken shits tougher than you.', 'I have met puddles tougher than you.'],
    ['Off you pop, dickhead.', 'Off you go.'],
    ['Another one bites the fucking dust.', 'Another one bites the dust.'],
    ['Rest in pieces, cockwomble.', 'Rest in pieces.'],
    ['You fought like a drunk goat with the runs.', 'You fought like a drunk goat.'],
    ['Gutted like a fish, you smelly prick.', 'Gutted like a fish.'],
    ['I would piss on your corpse, but I am saving it for your friends.', 'Next.'],
    ['Fuck me, that was satisfying.', 'That was satisfying.'],
    ['Thanks for the exercise, fuckface.', 'Thanks for the exercise.'],
    ['Somebody mop up this sad sack of shit.', 'Somebody mop that up.'],
    ['Twat down. Who is next?', 'One down. Who is next?'],
    ['Should have stayed in bed, wanker.', 'Should have stayed in bed.'],
    ['You died like you lived. Ugly and fucking useless.', 'You died like you lived.'],
    ['Bollocks to you and your whole rotten family tree.', 'So much for your family tree.'],
    ['Smell that? That is you shitting yourself on the way out.', 'Smell that? Fear.'],
    ['Get in the fucking ground.', 'Into the ground with you.'],
    ['Daddy issues solved. Permanently.', 'Problem solved.'],
  ],
  streak: [
    ['I am drowning in blood and I fucking love it!', 'Nothing can stop me!'],
    ['Line up, you bone-bags, I have got all night and a hard-on for violence!', 'Line up, I have all night!'],
    ['Somebody write a song about this shit!', 'Somebody write a song about this!'],
    ['Look at me! I am the god of fucking slaughter!', 'Look at me go!'],
    ['Next round is on your corpses, cunts!', 'Next round is on you!'],
  ],
  bigkill: [
    ['Ha! Look at his guts go! Like a piñata full of sausages!', 'Ha! What a mess!'],
    ['Somebody is going to need a fucking bucket.', 'Somebody will need a bucket.'],
    ['Blew him apart like a fat man in a privy.', 'Blew him apart.'],
    ['That arm is going in my trophy pile.', 'That one is going in my trophy pile.'],
    ['Heads up! Ha. Literally.', 'Heads up!'],
    ['I have got your liver on my boot, you disgusting fuck.', 'Something is on my boot.'],
    ['Spaghetti and meatballs, anyone?', 'Well, that was thorough.'],
  ],
  hurt: [
    ['Fuck me sideways!', 'Ow!'],
    ['Oh, you cheeky cunt!', 'Oh, you cheeky thing!'],
    ['Right in the fucking kidney!', 'Right in the kidney!'],
    ['My bollocks! Not the bollocks!', 'Oof! Low blow!'],
    ['Bastard bit me! Who bites?!', 'It bit me! Who bites?'],
    ['Shit on a stick, that stings!', 'That stings!'],
    ['Do that again and I will skull-fuck your eye socket!', 'Do that again and you are finished!'],
    ['Ow! Fucking ow! Fuck!', 'Ow! Ow!'],
  ],
  low: [
    ['I am pissing blood here, help!', 'I am badly hurt!'],
    ['If I die, burn my diary. And my fucking browser history.', 'If I die, burn my diary.'],
    ['Shit. I can see my own ribs.', 'I can see my own ribs.'],
    ['Mother of fuck, I am leaking.', 'I am leaking.'],
    ['Not like this. Not in a fucking basement.', 'Not like this.'],
  ],
  potion: [
    ['Tastes like a goblin jizzed in a lemon. Delicious.', 'Tastes like a goblin squeezed a lemon.'],
    ['Down the hatch, up the arse. Ahh.', 'Down the hatch.'],
    ['Better than sex. Well. Better than the sex I get.', 'Better than a hot meal.'],
    ['Oh fuck yes, that is the good shit.', 'Oh yes, that is the good stuff.'],
  ],
  down: [
    ['Deeper. That is what she said.', 'Deeper we go.'],
    ['Down another hole. Story of my fucking love life.', 'Down another hole.'],
    ['It smells like a troll farted in a tomb down here.', 'It smells awful down here.'],
    ['Lower and lower. Like my standards.', 'Lower and lower.'],
    ['Fuck these stairs and fuck whoever carved them.', 'Curse these stairs.'],
    ['Somebody shat down here. Recently. And it was big.', 'Something big lives down here.'],
  ],
  boss: [
    ['You are one ugly motherfucker.', 'You are one ugly brute.'],
    ['I bet your mum still wipes your arse, big boy.', 'Big boy, are you?'],
    ['Bigger they are, the harder I fuck them up.', 'The bigger they are, the harder they fall.'],
    ['Oh look, a boss. I am going to wear your skull as a hat.', 'Oh look, a boss.'],
    ['Come on then, you overgrown bag of dicks!', 'Come on then, you overgrown brute!'],
  ],
  bossdown: [
    ['Who is the king now, bitch?', 'Who is the king now?'],
    ['Biggest shit I have ever taken. Figuratively.', 'Biggest one yet.'],
    ['Lie there and think about what a pussy you were.', 'Lie there and think about it.'],
  ],
  loot: [
    ['Ooh, shiny. Mine. Fuck off.', 'Ooh, shiny. Mine.'],
    ['Look at that. I am getting a little stiff.', 'Look at that. Lovely.'],
    ['Daddy likes.', 'I like that.'],
    ['Wrap it up, I am taking it home to bed.', 'Wrap it up, I am taking it home.'],
  ],
  level: [
    ['Bigger, harder, angrier. Like my ex.', 'Bigger, harder, angrier.'],
    ['Feel that? That is pure fucking power.', 'Feel that? Pure power.'],
  ],
  town: [
    ['Back in town. Where are the whores? I mean, the shops.', 'Back in town. Where are the shops?'],
    ['Same shitty town, same shitty people. Love it.', 'Same town, same people. Love it.'],
    ['Who keeps pissing in the well? I can taste it.', 'Who keeps spitting in the well?'],
  ],
  idle: [
    ['Why did the skeleton not fuck anyone? He had no balls. Or the guts.', 'Why did the skeleton stay home? No guts.'],
    ['What is the difference between a lich and my ex? The lich is warmer.', 'A lich is warmer than my ex.'],
    ['I have seen more life in a tavern pisser.', 'Dead quiet in here.'],
    ['How many skeletons does it take to light a torch? None, they just sit in the dark and wank.', 'How many skeletons does it take to light a torch? None.'],
    ['I once shagged a mermaid. Never again. Fish breath AND fish fingers.', 'I once met a mermaid. Fish breath.'],
    ['These dungeons have worse plumbing than my grandad.', 'These dungeons have terrible plumbing.'],
    ['My sword is long, hard and covered in someone else. Just like the stories.', 'My sword has seen things.'],
    ['Wet, dark, tight corridors. My kind of night.', 'Wet, dark corridors. Great.'],
    ['I need a drink, a bath and a very bad decision.', 'I need a drink and a bath.'],
    ['I bet the king of this place has a tiny crown. Overcompensating.', 'I bet the king has a tiny crown.'],
    ['If a skeleton farts down here, is it just a breeze?', 'If a skeleton sighs, is it a breeze?'],
    ['Note to self: never lick the green walls again.', 'Note to self: never touch the green walls.'],
    ['Somewhere a bard is writing a song about my arse. As he should.', 'Somewhere a bard is writing about me.'],
    ['Hello? Any monsters want to die? Free stabbings!', 'Hello? Any monsters out there?'],
    ['My piss is glowing. That cannot be good.', 'My water is glowing. Odd.'],
    ['I am bored. Somebody come bleed.', 'I am bored.'],
    ['This place is a shithole. A haunted, damp, fucking shithole.', 'This place is a damp, haunted hole.'],
    ['I would kill for a sandwich. I would kill for most things, actually.', 'I would kill for a sandwich.'],
  ],
  death: [
    ['Fuck... tell my mum... she still owes me money...', 'Tell my mum...'],
    ['Oh, bollocks.', 'Oh, no.'],
    ['Killed by a fucking... that? Embarrassing.', 'Killed by that? Embarrassing.'],
  ],
  cast: [
    ['Eat fire, you crusty fuck!', 'Eat fire!'],
    ['Sit on this and spin!', 'Spin on this!'],
    ['Taste the rainbow, cunt!', 'Taste the rainbow!'],
    ['Here comes the pain, you shit-stain!', 'Here comes the pain!'],
    ['Abra-ca-fuck-you!', 'Abracadabra!'],
    ['Have some magic up your arse!', 'Have some magic!'],
  ],
};
const MORE_NPC = {
  merchant: [
    ['Touch it, you bought it. Lick it, you married it.', 'Touch it, you bought it.'],
    ['Discounts are for virgins and the dead. Which are you?', 'No discounts today.'],
    ['I have sold to kings and whores. You are dressed like neither.', 'I have sold to kings. You are not one.'],
    ['Haggle with me again and I will shove that sword up where the sun never shines.', 'Haggle again and I will raise my prices.'],
  ],
  quest: [
    ['Kill things, take their shit, come back. Not complicated.', 'Kill things, take their loot, come back.'],
    ['Last hero who took this job came back in three bags. Good luck!', 'Last hero did not come back. Good luck!'],
    ['If you die, can I have your boots?', 'If you fall, can I have your boots?'],
  ],
  blacksmith: [
    ['I hammer steel all day. Your wife says I hammer other things too.', 'I hammer steel all day.'],
    ['This blade could split a troll from arsehole to breakfast.', 'This blade could split a troll.'],
    ['Do not fucking touch the anvil. It bites.', 'Do not touch the anvil.'],
  ],
  healer: [
    ['Bend over, this goes in the back.', 'Hold still, this will sting.'],
    ['I have pulled arrows out of places you do not want to know.', 'I have pulled arrows out of strange places.'],
    ['Stop bleeding on the clean sheets, you selfish shit.', 'Stop bleeding on the clean sheets.'],
  ],
  beastmaster: [
    ['My dog has more brains than you and he licks his own balls.', 'My dog is smarter than you.'],
    ['Pets love you no matter how much of a cunt you are.', 'Pets love you no matter what.'],
  ],
  villager: [
    ['Oi, hero! My wife says you have a nice arse. I say it is average.', 'Oi, hero! My wife says hello.'],
    ['I shat in the river and now the fish talk to me. Fucking Wells.', 'The fish talk to me now. Odd Wells.'],
    ['Got any spare coin? No? Then fuck off.', 'Got any spare coin? No? Pity.'],
    ['You look like a goat shagged a bucket of mud.', 'You look like you rolled in mud.'],
    ['My nan could clear that dungeon. Drunk. With one tit.', 'My nan could clear that dungeon.'],
    ['Saw a skeleton humping a barrel last night. Real story.', 'Saw a skeleton dancing on a barrel last night.'],
    ['Every hero says they will save us. Every hero comes back in a fucking jar.', 'Every hero says they will save us.'],
    ['Bugger off, I am busy doing fuck all.', 'Go away, I am busy.'],
    ['The tavern ale tastes like a horse pissed in a boot. Still drink it.', 'The tavern ale is awful. Still drink it.'],
    ['My husband says his sword is huge. It is a fucking dagger.', 'My husband boasts about his sword.'],
    ['You smell like a dead rat fucked a wet dog.', 'You smell like a wet dog.'],
    ['Shit, it is the hero. Hide the good beer.', 'It is the hero. Hide the good ale.'],
    ['Go kill something and stop staring at my melons. I sell melons. Stop it.', 'Go kill something. I am busy selling melons.'],
    ['I have got piles the size of plums and you are blocking the road.', 'You are blocking the road.'],
    ['Do you know the difference between you and a skeleton? The skeleton has a backbone.', 'Even skeletons have backbones.'],
    ['Bloody heroes. All sword, no brains, and the clap.', 'Bloody heroes. All sword, no brains.'],
    ['Back from the dead again? Like a fucking herpes sore.', 'Back from the dead again?'],
    ['My goat died. Not your fault. Still, fuck you.', 'My goat died. Sad day.'],
    ['I would tell you a joke about the Wells but it stinks. Like your breath.', 'I would tell a joke but it stinks.'],
    ['Lost three sons in that hole. Well, two. The third just likes it down there.', 'Lost my sons to that hole.'],
  ],
};
const MORE_FOE = [
  ['I will wear your skin as a fucking onesie!', 'I will wear your cloak!'],
  ['Your skull will be my piss pot!', 'Your skull will be my cup!'],
  ['I will eat your eyes like grapes!', 'I will have your eyes!'],
  ['Come closer, I want to smell your fear-shit!', 'Come closer, I smell your fear!'],
  ['Your mum screamed louder than this last night!', 'Your mother screamed louder than this!'],
  ['I am going to floss with your intestines!', 'I am going to tie you in knots!'],
  ['Look at this sweaty little cunt!', 'Look at this sweaty little worm!'],
  ['Run home and cry into your dick-sock!', 'Run home and cry!'],
  ['I will rip off your arm and beat you with it!', 'I will beat you with your own arm!'],
  ['You fight like a constipated priest!', 'You fight like a tired priest!'],
  ['Fresh meat! Tender and full of shit!', 'Fresh meat!'],
  ['Kneel and kiss my rotten arse!', 'Kneel before me!'],
  ['I will hang your bollocks from my belt!', 'I will hang your trophy from my belt!'],
  ['Stab me, you soft fucking noodle!', 'Hit me, you soft noodle!'],
  ['Even the rats laugh at you!', 'Even the rats laugh at you!'],
  ['Your god is dead and I pissed on him!', 'Your god cannot help you!'],
];
const MORE_FOE_DEATH = [
  ['My... fucking... legs...', 'My... legs...'],
  ['Mummy...', 'Mother...'],
  ['You... absolute... cunt...', 'You... wretch...'],
  ['I shat myself... worth it...', 'Ugh...'],
  ['Not... my... dick...', 'Not... like... this...'],
  ['Tell my wife... she was shit in bed...', 'Tell my wife...'],
];
for (const k in MORE_HERO) (HERO[k] ||= []).push(...MORE_HERO[k]);
for (const k in MORE_NPC) (NPC[k] ||= []).push(...MORE_NPC[k]);
FOE.push(...MORE_FOE);
FOE_DEATH.push(...MORE_FOE_DEATH);

// ---- 0.7.6: even filthier
const MORE2_HERO = {
  kill: [
    ['Down you go, you crusty ballsack.', 'Down you go.'],
    ['Died like he fucked: fast and disappointing.', 'Died fast and disappointing.'],
    ['I have had more fight out of a wet fart.', 'I have had more fight out of a wet sock.'],
    ['Tell the devil I said suck it.', 'Tell the devil I said hello.'],
    ['You smelled like a dead tramp\'s jockstrap anyway.', 'You smelled awful anyway.'],
    ['Another bellend for the pile.', 'Another one for the pile.'],
    ['Should have stayed in your mum\'s basement, you sweaty bollock.', 'Should have stayed home.'],
    ['That was quicker than my wedding night.', 'That was quick.'],
    ['Bye bye, fuckface. Nobody will miss you.', 'Bye bye. Nobody will miss you.'],
    ['I would piss on your grave but you are not worth the water.', 'Not worth the effort.'],
    ['Your corpse is the only useful thing you ever made, twat.', 'Your corpse is useful at last.'],
    ['Lights out, knob jockey.', 'Lights out.'],
  ],
  bigkill: [
    ['CRIT! Look at that, his arse is over there and his face is over here!', 'CRIT! He went everywhere!'],
    ['Exploded like a fat priest at an all-you-can-eat buffet.', 'Exploded like a melon.'],
    ['Somebody get a mop. And a bucket. And a fucking shovel.', 'Somebody get a mop.'],
    ['I just turned that prick into soup.', 'I just turned that into soup.'],
    ['Splattered him like a bird shitting on a statue.', 'Splattered him everywhere.'],
    ['Guts on the wall, dick on the ceiling. Beautiful.', 'Guts on the wall. Beautiful.'],
    ['That\'s not a corpse, that\'s a fucking jigsaw puzzle.', 'That\'s a jigsaw puzzle now.'],
    ['Critical hit, critical shit. He shat himself into orbit.', 'Critical hit! Into orbit!'],
    ['I think I just found his spleen in my boot.', 'I found something in my boot.'],
    ['Rained bollocks. Literally.', 'It rained bits.'],
  ],
  idle: [
    ['I need a drink, a bath and a woman who doesn\'t ask questions. In any order.', 'I need a drink and a bath.'],
    ['My arse crack has been sweating since floor one.', 'I have been sweating since floor one.'],
    ['Who designs a dungeon without a fucking toilet?', 'Who designs a dungeon without a privy?'],
    ['Why do I always end up knee-deep in some poor bastard\'s colon?', 'Why am I always knee-deep in this?'],
    ['Saw a rat humping a skull back there. Even the rats are depressed.', 'Saw a rat chewing a skull back there.'],
    ['I could murder a pie. And then a goblin. Then another pie.', 'I could murder a pie.'],
    ['These boots smell like a troll\'s taint.', 'These boots smell awful.'],
    ['I\'m so bored I could lick a torch.', 'I\'m so bored.'],
    ['What\'s the difference between a goblin and a bag of shit? The bag.', 'Goblins. Ugh.'],
    ['Why did the skeleton not fuck anyone? He had no balls. And no friends..', 'Why are skeletons lonely? No body.'],
    ['I once shagged a barmaid so hard the tavern changed its name.', 'I once caused a tavern to change its name.'],
    ['If I die down here, bury me with my boots on and my cock out.', 'If I die down here, bury me with my boots on.'],
  ],
  town: [
    ['Hollowmere: where the ale is warm and the whores are warmer.', 'Hollowmere: where the ale is warm.'],
    ['Smells like piss and regret. Home sweet home.', 'Smells like home.'],
    ['The mayor has a face like a bulldog licking piss off a nettle.', 'The mayor looks permanently cross.'],
    ['I\'ve seen more life in a dead hooker\'s handbag.', 'This town is very quiet.'],
  ],
  hurt: [
    ['OW, you fucking ballbag!', 'OW!'],
    ['That went right in my piss flaps!', 'That hurt!'],
    ['Hit me again and I\'ll skull-fuck your corpse!', 'Hit me again and you\'ll regret it!'],
    ['Right in the knackers, you cheating shit!', 'Low blow!'],
  ],
  low: [
    ['I\'m leaking like a cheap whore\'s bucket!', 'I\'m leaking badly!'],
    ['Shit shit shit shit SHIT!', 'Oh no no no!'],
    ['If I die, delete my browser history!', 'If I die, burn my diary!'],
  ],
  loot: [
    ['Ooh, shiny. Better than sex. Well, better than sex with you.', 'Ooh, shiny.'],
    ['Finders keepers, dead fuckers weepers.', 'Finders keepers.'],
    ['Came out of his arse, still counts.', 'Still counts.'],
  ],
  level: [
    ['I just got harder than a priest in a choir.', 'I just got stronger.'],
    ['Stronger, faster, and my dick is probably bigger too.', 'Stronger and faster.'],
  ],
  potion: [
    ['Tastes like a goat pissed in honey. Delicious.', 'Tastes awful. Delicious.'],
    ['Down the hatch, up the arse.', 'Down the hatch.'],
  ],
};
const MORE2_NPC = {
  villager: [
    ['Mind the shit on the cobbles. Some of it is the mayor\'s.', 'Mind the cobbles.'],
    ['My husband went into the Wells and came back with crabs. The other kind.', 'My husband came back from the Wells itchy.'],
    ['Oi, hero! My wife says you\'re handsome. I say you look like a ballsack in a cape.', 'My wife says you\'re handsome.'],
    ['I\'d offer you a drink but you look like you\'d drink your own piss.', 'You look thirsty.'],
    ['Last hero who came through shagged my sheep. Keep your hands where I can see them.', 'Keep away from my sheep.'],
    ['Heard you made a ghoul explode. My mother-in-law next, please.', 'Heard you made a ghoul explode.'],
    ['What do you call a hero with no money? A fucking peasant. Welcome home.', 'Welcome home.'],
  ],
  merchant: [
    ['Buy something or fuck off, I\'m not a museum.', 'Buy something or move along.'],
    ['That price? I\'d sooner sell my arsehole. Actually, make an offer.', 'That price? No chance.'],
  ],
  blacksmith: [
    ['I hammer steel all day. Your mum says I hammer other things too.', 'I hammer steel all day.'],
    ['This blade could cut a fart in half.', 'This blade is very sharp.'],
  ],
  healer: [
    ['Drop your trousers. No, not for that. Okay, a little for that.', 'Let me look at those wounds.'],
    ['I\'ve stitched up worse. Mostly from your last trip.', 'I\'ve stitched up worse.'],
  ],
};
const MORE2_FOE = [
  ['I\'ll fuck your skull and wear it as a hat!', 'I\'ll wear your skull as a hat!'],
  ['Come here so I can tea-bag your corpse!', 'Come here and die!'],
  ['Your mum squealed louder than you will!', 'You\'ll squeal!'],
  ['I\'ll use your spine as a back-scratcher!', 'I\'ll use your spine as a back-scratcher!'],
  ['Smells like fresh meat and stale piss!', 'Smells like fresh meat!'],
  ['I\'ll shit down your neck hole!', 'I\'ll end you!'],
  ['Nice arse! I\'ll eat it last!', 'I\'ll eat you last!'],
  ['Your guts are going on my fucking mantelpiece!', 'Your guts are mine!'],
];
const MORE2_FOE_DEATH = [
  ['Tell... my wife... she was a shit lay...', 'Tell... my wife...'],
  ['I... shat... myself...', 'I... am done...'],
  ['Not... the face... you bastard...', 'Not... the face...'],
  ['Fuck... this... job...', 'I... quit...'],
];
for (const k in MORE2_HERO) (HERO[k] ||= []).push(...MORE2_HERO[k]);
for (const k in MORE2_NPC) (NPC[k] ||= []).push(...MORE2_NPC[k]);
FOE.push(...MORE2_FOE);
FOE_DEATH.push(...MORE2_FOE_DEATH);

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
  reset() { cd = 2; idleT = 6; npcT = 3; foeT = 4; streak = 0; streakT = 0; },
  hero(kind, chance = 1, hold = 2.5) {
    if (!Settings.barks || !G.player || G.player.dead || !HERO[kind]) return;
    if (cd > 0 || Math.random() > chance) return;
    if (say(G.player, rnd(HERO[kind]), '#ffe9b0')) cd = hold * 0.5 + Math.random();
  },
  kill(enemy, big) {
    streak++; streakT = 6;
    if (enemy.boss) return this.hero('bossdown', 1, 0);
    if (streak >= 6 && streak % 6 === 0) return this.hero('streak', 0.8, 1);
    if (big) return this.hero('bigkill', 0.9);
    this.hero('kill', 0.4);
    if (Settings.barks && Math.random() < 0.45 && !enemy.boss) say(enemy, rnd(FOE_DEATH), '#e8a090', 1.6);
  },
  npc(ent) {
    const key = ent.kind && NPC[ent.kind] ? ent.kind : 'villager';
    if (Settings.barks && !ent.__sayCd) { ent.__sayCd = 1; setTimeout(() => { ent.__sayCd = 0; }, 3000); say(ent, rnd(NPC[key]), '#f3e6c4', 3.5); }
  },
  villagerLine(v) {
    return Settings.barks && Settings.profanity && Math.random() < 0.85 ? rnd(NPC.villager)[0] : null;
  },
  update(dt) {
    cd -= dt; streakT -= dt; if (streakT <= 0) streak = 0;
    const pl = G.player;
    if (!Settings.barks || !pl || pl.dead || !G.level) return;
    idleT -= dt; npcT -= dt; foeT -= dt;
    const dungeon = G.level.kind === 'dungeon';
    if (idleT <= 0) { idleT = 9 + Math.random() * 10; this.hero(dungeon ? 'idle' : rnd([0, 1, 2]) ? 'idle' : 'town', 1, 1); }
    if (npcT <= 0) {
      npcT = 3 + Math.random() * 4;
      const near = G.level.entities.filter((e) => e.type === 'interact' && e.label && NPC[e.kind] && e.root.position.distanceTo(pl.root.position) < 12);
      if (near.length) { const e = rnd(near); say(e, rnd(NPC[e.kind]), '#f3e6c4', 3.5); }
    }
    if (foeT <= 0) {
      foeT = 3 + Math.random() * 4;
      const near = G.level.entities.filter((e) => e.type === 'enemy' && !e.dead && e.root.visible && e.root.position.distanceTo(pl.root.position) < 11);
      if (near.length) say(rnd(near), rnd(FOE), '#ff9a8a', 2.6);
    }
  },
};
