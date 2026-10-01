'use strict';
// ============================================================================
//  Chatter: the cast talks. Heroes quip when they drop in or pull off a big
//  kill, soldiers shout when they spot you, panic, throw or charge (the shouts
//  double as warnings), and General Grimm heckles over the radio.
//  All lines are our own - nothing quoted from films.
// ============================================================================

const HERO_LINES = {
  havoc: ['LOCK AND LOAD!', "LET'S MAKE SOME NOISE!", 'TIME TO WORK!'],
  buck: ['HOWDY, PARTNER!', 'GIDDY UP!', 'YEEHAW!'],
  scorch: ['WHO ORDERED BARBECUE?', 'WELL DONE, ANYONE?', 'LIGHT IT UP!'],
  ronin: ['...', 'MY BLADE IS READY.', 'SILENCE.'],
  chrono: ['RIGHT ON TIME.', 'TICK TOCK!', "I'VE SEEN HOW THIS ENDS."],
  boomer: ['KA-BOOM TIME!', 'STAND BACK!', 'ROCKETS READY!'],
  skyhawk: ["SKY'S THE LIMIT!", 'COMING IN HOT!', 'WHEELS UP!'],
  brutus: ['MEET BERTHA!', 'SPIN IT UP!', 'WHO WANTS SOME?'],
  ricochet: ['HEADS UP!', 'CATCH!', 'WHAT GOES AROUND...'],
  deadeye: ['ONE SHOT.', 'I NEVER MISS.', 'TARGET ACQUIRED.'],
  phantom: ["YOU DIDN'T SEE ME.", 'GHOST MODE.', 'SHHH...'],
  volt: ['FEEL THE POWER!', 'SHOCKING, RIGHT?', 'CHARGED UP!'],
};
// after a triple kill or better
const HERO_BRAGS = ['TOO EASY!', 'NEXT!', "WHO'S NEXT?", "THAT'S HOW IT'S DONE!", 'BOOM!', 'CLEAN SWEEP!'];

const ENEMY_LINES = {
  spot: ['THERE HE IS!', 'INTRUDER!', 'GET HIM!', 'HOSTILE!', "WHO'S THAT?", 'OVER THERE!'],
  panic: ['RUN!', 'MEDIC!', 'NOPE!', 'MAMA!', 'RETREAT!', 'NOT AGAIN!'],
  bomber: ['CATCH!', 'SPECIAL DELIVERY!', 'HOT POTATO!'],
  grenade: ['FIRE IN THE HOLE!', 'CATCH!', 'GRENADE OUT!'],
  dog: ['WOOF!', 'GRRR!'],
  cheer: ['GOT HIM!', 'HA HA!', 'TOO EASY!'], // a hero goes down (1.32)
};

// General Grimm on the radio: one line for each campaign mission...
const GRIMM_MISSION = [
  'ONE SOLDIER? HAH! WAKE ME WHEN HE IS DEAD.',
  'WHO KEEPS BLOWING UP MY BRIDGES?!',
  "IF I CAN'T HAVE THIS BASE, NOBODY CAN!",
  'COLONEL, HIDE! AND STOP EATING MY SNACKS!',
  'MEET IRON HOG. HE IS HUNGRY.',
  'HANDS OFF MY FUEL, YOU SAND RAT!',
  'THE DESERT WILL EAT YOU ALIVE. I HOPE.',
  'MY BEST COLONEL IS WAITING. HE HAS A PISTOL!',
  'OOPS. I PRESSED THE BIG RED BUTTON AGAIN.',
  'SKYREAPER WILL SHOW YOU WHO OWNS THE SKY!',
  'GUARD THE FUEL! IT IS COLD OUT THERE!',
  'BURY THEM IN SNOW! AND FIRE! AND MORE SNOW!',
  'COLONEL, PUT ON A SCARF. AND RUN.',
  'YOU ARE ALMOST AT MY DOOR. WIPE YOUR BOOTS.',
  'ENOUGH! I WILL DO THIS MYSELF!',
];
// ...pools for Arcade stages and the daily mission, by objective...
const GRIMM_GOAL = {
  extract: ['NOBODY LEAVES MY BASE ALIVE!', 'YOU AGAIN? GET THEM!', 'SEND EVERYONE! AND THE DOGS!'],
  target: ['PROTECT THE COLONEL, YOU FOOLS!', 'COLONEL, RUN! YOU ARE GOOD AT THAT.'],
  depots: ['GUARD THE FUEL DEPOTS!', 'NOT THE FUEL! ANYTHING BUT THE FUEL!'],
  escape: ["IF I CAN'T HAVE IT, NOBODY CAN!", 'OOPS. BIG RED BUTTON.'],
  boss: ['YOU WILL NEVER GET PAST MY PET!', 'I HAVE A SURPRISE FOR YOU!'],
};
// ...and for the big moments
const GRIMM_BOSS = { tank: 'IRON HOG, FLATTEN THEM!', gunship: 'SKYREAPER, CLEAR THE SKIES!', mech: 'GRIMM WALKER ONLINE! HAHAHA!' };
const GRIMM_BOSS_DOWN = { tank: 'MY TANK! I JUST HAD IT WAXED!', gunship: 'THAT WAS A RENTAL!', mech: 'NOOO! THIS IS NOT OVER!' };
const GRIMM_TARGET_DOWN = 'THE COLONEL?! FINE. I NEVER LIKED HIM.';
const GRIMM_DEPOTS_DOWN = 'MY FUEL! HOW WILL I HEAT MY BATH NOW?';

function grimmStartLine(W) {
  if (!W.arcade && !W.daily && W.levelIndex >= 0) return GRIMM_MISSION[W.levelIndex] || null;
  return pick(GRIMM_GOAL[W.goal] || GRIMM_GOAL.extract);
}
