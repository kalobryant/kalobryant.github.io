'use strict';
/* ===== Characters, items, dialog and room layouts ===== */

const PAL = {
  player:    { id: 'player', skin: '#f0b080', hair: '#5a3010', shirt: '#20a040', pants: '#404858', shoes: '#e8e8e8', zip: true },
  poll:      { id: 'poll', skin: '#c88050', hair: '#d8d8d8', shirt: '#8048c0', pants: '#303030', shoes: '#202020', glasses: true },
  monitor:   { id: 'monitor', skin: '#8c5030', hair: '#202020', shirt: '#f8f8f8', pants: '#283048', shoes: '#202020', vest: '#f8c000', prop: 'clipboard' },
  collector: { id: 'collector', skin: '#f0c098', hair: '#b06020', shirt: '#d8d8d8', pants: '#585858', shoes: '#202020', vest: '#38a8f0', prop: 'box', long: true },
  collector2:{ id: 'collector2', skin: '#6c3c20', hair: '#101010', shirt: '#d8d8d8', pants: '#383838', shoes: '#202020', vest: '#38a8f0', prop: 'box' },
  talker:    { id: 'talker', skin: '#f8c8a0', hair: '#c8c8c8', shirt: '#e040a0', pants: '#4c3c78', shoes: '#202020', glasses: true, long: true },
  talker2:   { id: 'talker2', skin: '#a86030', hair: '#383838', shirt: '#f08030', pants: '#384048', shoes: '#202020' },
  hangry:    { id: 'hangry', skin: '#d89060', hair: '#402010', shirt: '#887050', pants: '#303848', shoes: '#202020', brow: true },
  undecided: { id: 'undecided', skin: '#f8d0b0', hair: '#e8b030', shirt: '#58c8b0', pants: '#605070', shoes: '#202020', long: true },
  v1: { id: 'v1', skin: '#f0c098', hair: '#202020', shirt: '#c8a8f8', pants: '#383848', shoes: '#202020' },
  v2: { id: 'v2', skin: '#8c5030', hair: '#101010', shirt: '#f8d858', pants: '#484040', shoes: '#202020', long: true },
  v3: { id: 'v3', skin: '#e0a070', hair: '#804010', shirt: '#909090', pants: '#283048', shoes: '#202020' },
  v4: { id: 'v4', skin: '#f8d0b0', hair: '#d8a040', shirt: '#f87858', pants: '#404858', shoes: '#202020', long: true },
  v5: { id: 'v5', skin: '#6c3c20', hair: '#c8c8c8', shirt: '#68b8f8', pants: '#303030', shoes: '#202020', glasses: true },
  v6: { id: 'v6', skin: '#c88050', hair: '#301808', shirt: '#b8e070', pants: '#504838', shoes: '#202020' },
  kid1: { id: 'kid1', skin: '#e0a070', hair: '#301808', shirt: '#f8a8c8', pants: '#4060b0', shoes: '#f8f8f8' },
  kid2: { id: 'kid2', skin: '#f8d0b0', hair: '#e8c040', shirt: '#80d080', pants: '#805030', shoes: '#f8f8f8' }
};

const ITEMS = {
  phone:    { name: 'PHONE', icon: 'phone', desc: 'FAKE A CALL TO ESCAPE SMALL TALK. NEVER WHERE A MONITOR CAN SEE YOU NEAR THE BOOTHS.' },
  screen:   { name: 'PRIVACY SCREEN', icon: 'screen', desc: 'A SPARE BOOTH DIVIDER. Z TO HIDE BEHIND IT. YOU MOVE SLOWLY, BUT NOBODY NOTICES YOU.' },
  sticker:  { name: 'STICKER', icon: 'sticker', count: true, desc: '"I VOTED" STICKERS. TOSS ONE TO DISTRACT PEOPLE. KIDS LOVE THEM.' },
  juice:    { name: 'JUICE BOX', icon: 'juice', count: true, desc: 'APPLE JUICE. A CRYING KID WOULD LOVE THIS.' },
  granola:  { name: 'GRANOLA BAR', icon: 'granola', count: true, desc: 'SLIGHTLY CRUSHED. CURES HANGRY.' },
  sample:   { name: 'SAMPLE BALLOT', icon: 'sample', count: true, desc: "EXPLAINS EVERYTHING ON THE BALLOT. GIVE IT TO SOMEONE WHO DIDN'T READ AHEAD." },
  coffee:   { name: 'COFFEE', icon: 'coffee', count: true, desc: 'DRINK FOR +3 PATIENCE AND A SPEED BOOST. MONITORS CALL THAT RUNNING.' },
  earplugs: { name: 'EARPLUGS', icon: 'earplugs', desc: 'Z TO PUT THEM IN OR TAKE THEM OUT. CRYING STOPS DRAINING YOUR PATIENCE.' },
  card:     { name: 'DISTRICT CARD', icon: 'card', passive: true, desc: 'DISTRICT 7. BOOTH 4. LAMINATED, SOMEHOW.' },
  pen:      { name: 'PEN', icon: 'pen', passive: true, desc: "THE POLL WORKER'S PEN. THEY WANT IT BACK." },
  ballot:   { name: 'BALLOT', icon: 'ballot', passive: true, desc: 'YOUR BALLOT. MARK IT IN BOOTH 4, THEN FEED IT TO THE SCANNER.' }
};
const USABLE = ['phone', 'screen', 'sticker', 'juice', 'granola', 'sample', 'coffee', 'earplugs'];

const CROWD_LINES = [
  "I'VE BEEN IN LINE SINCE 6 AM. I BROUGHT A FOLDING CHAIR. I FORGOT TO UNFOLD IT.",
  "IS THIS THE LINE FOR DISTRICT 3? I'M ASKING EVERYONE. I'M ALREADY IN IT.",
  "NO CUTTING. I'M NOT A MONITOR, I JUST FEEL STRONGLY ABOUT IT.",
  'MY FEET HURT. DEMOCRACY HURTS. WORTH IT, THOUGH.',
  "THERE'S A BAKE SALE OUTSIDE. I CAN'T LEAVE. I'LL LOSE MY SPOT."
];
const BOOTH_LINES = [
  "OCCUPIED! I'M READING EVERY WORD. TWICE.",
  "BOOTH TAKEN. I'M ON THE DOG CATCHER RACE. IT'S A TOUGH ONE.",
  "ONE SEC, I'M CHECKING THE BACK OF THE BALLOT. THERE'S NO BACK. I'M CHECKING ANYWAY."
];
const WANDER_LINES = [
  'SORRY! EXCUSE ME! SORRY!',
  'HAVE YOU SEEN MY KID? ...OH, THERE THEY ARE. NEVER MIND.',
  'WHERE IS THE BATHROOM? IS VOTING NEAR THE BATHROOM?'
];
const MONITOR_LINES = [
  "I'M AN ELECTION MONITOR. I MAKE SURE EVERYTHING HERE GOES BY THE RULES.",
  "FUN FACT: NO CAMPAIGN SHIRTS OR BUTTONS NEAR THE POLLS. IT'S CALLED ELECTIONEERING.",
  'CARRY ON, VOTER. NO CUTTING, NO RUNNING, NO PHONES BY THE BOOTHS.'
];
const COLLECTOR_TALK = [
  'BALLOTS GO IN THE SCANNER. I JUST... SUPERVISE. ENTHUSIASTICALLY.',
  "IF YOU MAKE A MISTAKE ON YOUR BALLOT, YOU CAN ASK A POLL WORKER FOR A NEW ONE. ISN'T THAT NICE?"
];
const PHONE_LINES = [
  'YOU CHECK YOUR PHONE. 47 NEW MESSAGES. ALL FROM THE GROUP CHAT.',
  'YOU CHECK YOUR PHONE. YOUR AUNT SENT A BLURRY PHOTO OF A SANDWICH.',
  "YOU CHECK YOUR PHONE. IT'S AT 4%. OF COURSE IT IS."
];
const CAUGHT_LINES = {
  line: 'EXCUSE ME, VOTER. NO CUTTING. THE BACK OF THE LINE IS THAT WAY.',
  run: 'WHOA, WHOA. NO RUNNING IN THE POLLING PLACE. BACK OF THE LINE, PLEASE.',
  phone: 'NO PHONES NEAR THE BOOTHS, PLEASE. BALLOT SELFIES ARE A NO-NO. BACK OF THE LINE.'
};
const SAMPLE_TEXT = 'SAMPLE BALLOT: MEASURE A (LIBRARY HOURS), MEASURE B (ELM ST. CROSSWALK), TOWN DOG CATCHER. HANDY FOR ANYONE WHO DIDN\'T READ AHEAD.';

/* Fictional, deliberately low-stakes, non-partisan contests. */
const BALLOT = [
  { q: 'MEASURE A: KEEP THE PUBLIC LIBRARY OPEN UNTIL 9 PM?', opts: ['YES', 'NO'] },
  { q: 'MEASURE B: PAINT A NEW CROSSWALK ON ELM STREET?', opts: ['YES', 'NO'] },
  { q: 'TOWN DOG CATCHER (VOTE FOR ONE)', opts: ['B. BARKLEY', 'P. WHISKERS'] }
];

const HL = 'HOTLINE';
const CALLS = {
  intro: [
    [HL, 'VOTER, DO YOU COPY? THIS IS THE HOTLINE.'],
    ['VOTER', 'LOUD AND CLEAR. WHY DOES A POLLING PLACE HAVE A HOTLINE?'],
    [HL, "DON'T WORRY ABOUT IT. YOUR MISSION: MARK YOUR BALLOT IN BOOTH 4, THEN FEED IT TO THE SCANNER."],
    [HL, "IT'S PACKED IN THERE. DON'T CUT THE LINE, DON'T RUN, AND KEEP YOUR PHONE AWAY FROM THE BOOTHS. ELECTION MONITORS ARE WATCHING."],
    [HL, "PEOPLE IN YOUR WAY USUALLY JUST NEED SOMETHING. HELP THEM AND THEY'LL GET OUT OF YOUR WAY."],
    [HL, 'ARROWS MOVE. Z USES YOUR ITEM OR TALKS. X SWITCHES ITEMS. C CALLS ME. ENTER PAUSES.'],
    ['VOTER', 'COPY THAT.']
  ],
  room2: [
    [HL, "THAT'S THE BOOTH ROOM. YOU'RE DISTRICT 7, SO BOOTH 4 IS YOURS."],
    [HL, 'LOOKS LIKE SOMEONE IN FRONT OF IT IS... STILL DECIDING.'],
    [HL, "AND REMEMBER: IF A MONITOR SEES YOU ON YOUR PHONE IN HERE, IT'S BACK OF THE LINE."],
    ['VOTER', 'NOT EVEN FOR A BALLOT SELFIE?'],
    [HL, 'ESPECIALLY NOT FOR A BALLOT SELFIE.']
  ],
  room3: [
    [HL, "THE SCANNER'S AT THE TOP OF THE ROOM. ALMOST THERE."],
    [HL, "WATCH OUT FOR THE BALLOT COLLECTORS. THEY LOVE TO 'HELP.' IF THEY SPOT YOU, YOU'RE IN FOR A LECTURE."]
  ],
  jam: [
    [HL, 'VOTER! COME IN! THE SCANNER IS JAMMED!'],
    ['VOTER', 'OF COURSE IT IS.'],
    [HL, "IT'S OLD AND IT'S PICKY. PRESS Z WHEN THE MARKER IS IN THE GREEN ZONE."],
    [HL, 'IT NEEDS THREE CLEAN FEEDS. EVERY REJECT COSTS YOU PATIENCE.']
  ],
  end: [
    [HL, 'BALLOT ACCEPTED. NICE WORK, VOTER.'],
    [HL, 'YOU MADE IT THROUGH THE CROWD WITHOUT LOSING YOUR COOL.'],
    ['VOTER', 'SEE YOU NEXT ELECTION.'],
    [HL, "...THERE'S A PRIMARY IN THE SPRING."],
    ['VOTER', '...']
  ]
};

/*
  Map legend (16x12 tiles, 16px each):
  # wall   b wall w/ bunting   v wall w/ VOTE poster   . floor
  L taped line area (cutting zone)   = rope stanchion   T table   B voting booth
  S ballot scanner   F water fountain   P plant   C chair   x trash can   E exit door
*/
const ROOMS = [
  {
    name: 'CHECK-IN', floor: 'lin', exits: { right: 1 },
    map: [
      '##bb##vv##bb####',
      '#..............#',
      '#..TTTTTT......#',
      '#..............#',
      '#P.............#',
      '#...............',
      '#...............',
      '#P.............#',
      '#..............#',
      '#.CC.......x...#',
      '#..............#',
      '######EE########'
    ],
    ents: [
      { t: 'poll', x: 5, y: 1, dir: 0, pal: 'poll' },
      { t: 'wander', x: 10, y: 5, pal: 'v3', area: [8, 4, 14, 8] },
      { t: 'wander', x: 4, y: 8, pal: 'v5', area: [1, 7, 6, 10] }
    ],
    pickups: [
      { id: 'screen', item: 'screen', n: 1, x: 13, y: 2 },
      { id: 'juice', item: 'juice', n: 1, x: 13, y: 9 }
    ]
  },
  {
    name: 'THE LINE', floor: 'wood', exits: { left: 0, right: 2 }, call: true,
    map: [
      '####vv####bb####',
      '#.....=LLL=....#',
      '#.....=LLL=....#',
      '#F....=LLL=....#',
      '#.....=LLL=....#',
      '......LLLLL.....',
      '......LLLLL.....',
      '#.....=LLL=....#',
      '#.....=LLL=....#',
      '#.....=LLL=....#',
      '#..............#',
      '################'
    ],
    ents: [
      { t: 'queue', x: 7, y: 1, pal: 'v1', dir: 1 }, { t: 'queue', x: 9, y: 1, pal: 'v2', dir: 1 },
      { t: 'queue', x: 8, y: 2, pal: 'v4', dir: 1 }, { t: 'queue', x: 7, y: 3, pal: 'v6', dir: 1 },
      { t: 'queue', x: 9, y: 4, pal: 'v3', dir: 1 }, { t: 'queue', x: 8, y: 7, pal: 'v5', dir: 1 },
      { t: 'queue', x: 7, y: 8, pal: 'v2', dir: 1 }, { t: 'queue', x: 9, y: 8, pal: 'v1', dir: 1 },
      { t: 'queue', x: 7, y: 9, pal: 'v6', dir: 1 }, { t: 'queue', x: 8, y: 9, pal: 'v4', dir: 1 },
      { t: 'queue', x: 9, y: 9, pal: 'v3', dir: 1 },
      { t: 'kid', x: 3, y: 2, pal: 'kid1', flag: 'kid1',
        hint: 'MY GRANDMA SAYS THE MONITOR STOPS IN THE MIDDLE AND STARES AT THE LINE. THEN THEY WALK AWAY AGAIN.' },
      { t: 'talker', x: 1, y: 7, pal: 'talker', name: 'CHATTY VOTER',
        path: [{ x: 1, y: 7, wait: 1.2, face: 3 }, { x: 5, y: 7, wait: 1.2, face: 2 }],
        lines: ["OH HI! DON'T WE GO TO THE SAME DENTIST?",
                "MY DENTIST SAYS I GRIND MY TEETH WHEN I VOTE. ISN'T THAT FUNNY?",
                "ANYWAY, I'LL LET YOU GO. ...SO ANYWAY, THE DENTIST..."] },
      { t: 'hangry', x: 8, y: 10, flag: 'hangry', dir: 0 },
      { t: 'monitor', x: 12, y: 1,
        path: [{ x: 12, y: 1, wait: 1.2, face: 0 }, { x: 12, y: 5, wait: 2, face: 2 },
               { x: 12, y: 9, wait: 1.2, face: 1 }, { x: 12, y: 5, wait: 2, face: 2 }] },
      { t: 'wander', x: 13, y: 8, pal: 'v5', area: [11, 7, 14, 10] }
    ],
    pickups: [
      { id: 'granola', item: 'granola', n: 1, x: 2, y: 9 },
      { id: 'earplugs', item: 'earplugs', n: 1, x: 1, y: 10 }
    ]
  },
  {
    name: 'VOTING BOOTHS', floor: 'lin', exits: { left: 1, right: 3 }, call: true, phoneRule: true,
    booths: { 2: 1, 4: 2, 6: 3, 8: 4, 10: 5, 12: 6 },
    map: [
      '####bb####bb####',
      '#.B.B.B.B.B.B..#',
      '#..............#',
      '#..............#',
      '#..............#',
      '................',
      '................',
      '#..............#',
      '#..P.......CC..#',
      '#..............#',
      '#..x...........#',
      '################'
    ],
    ents: [
      { t: 'queue', x: 2, y: 2, pal: 'v2', dir: 1, booth: true },
      { t: 'queue', x: 4, y: 2, pal: 'v6', dir: 1, booth: true },
      { t: 'queue', x: 6, y: 2, pal: 'v1', dir: 1, booth: true },
      { t: 'queue', x: 10, y: 2, pal: 'v4', dir: 1, booth: true },
      { t: 'undecided', x: 8, y: 2, dir: 1, flag: 'undecided' },
      { t: 'monitor', x: 2, y: 4,
        path: [{ x: 2, y: 4, wait: 1.5, face: 1 }, { x: 13, y: 4, wait: 1.5, face: 1 }] },
      { t: 'talker', x: 3, y: 7, pal: 'talker2', name: 'COOKIE ENTHUSIAST',
        path: [{ x: 3, y: 7, wait: 1, face: 3 }, { x: 12, y: 7, wait: 1, face: 2 }],
        lines: ['DO YOU KNOW IF THEY STILL HAVE COOKIES HERE?',
                'IN 2008 THEY HAD COOKIES. OATMEAL RAISIN, BUT STILL. IT WAS A GESTURE.',
                "I'M WRITING A LETTER ABOUT THE COOKIES. WANT TO SIGN IT?"] },
      { t: 'wander', x: 13, y: 9, pal: 'v3', area: [9, 9, 14, 10] }
    ],
    pickups: [
      { id: 'coffee', item: 'coffee', n: 2, x: 14, y: 10 },
      { id: 'sticker2', item: 'sticker', n: 2, x: 1, y: 9 }
    ]
  },
  {
    name: 'BALLOT SCANNER', floor: 'wood', exits: { left: 2 }, call: true,
    map: [
      '######vv########',
      '#......SS......#',
      '#..............#',
      '#..............#',
      '#..............#',
      '...............#',
      '...............#',
      '#..............#',
      '#.P..........P.#',
      '#..............#',
      '#..............#',
      '################'
    ],
    ents: [
      { t: 'collector', x: 2, y: 3, pal: 'collector', name: 'BALLOT COLLECTOR',
        path: [{ x: 2, y: 3, wait: 1, face: 0 }, { x: 13, y: 3, wait: 1, face: 0 }],
        lines: ['OOH, IS THAT A BALLOT? FACE DOWN! FACE DOWN!',
                "DID YOU CHECK THE BACK? THERE'S ALWAYS A BACK. ...THIS ONE DOESN'T HAVE A BACK."] },
      { t: 'collector', x: 4, y: 9, pal: 'collector2', name: 'BALLOT COLLECTOR',
        path: [{ x: 4, y: 4, wait: 1, face: 3 }, { x: 4, y: 9, wait: 1, face: 3 }],
        lines: ['STOP RIGHT THERE! DID YOU USE A BLACK PEN? BLUE IS OKAY TOO.',
                "ALSO, DON'T FOLD IT. OR DO. I'M ACTUALLY NOT SURE."] },
      { t: 'kid', x: 12, y: 9, pal: 'kid2', flag: 'kid2',
        hint: "THE BALLOT PEOPLE ONLY LOOK WHERE THEY'RE WALKING. AND THEY TALK A LOT." },
      { t: 'wander', x: 9, y: 7, pal: 'v6', area: [7, 6, 11, 8] }
    ],
    pickups: []
  }
];
