// Content profiles. The engine, choreography and soundtrack are shared; a
// profile supplies every word and number that appears on screen.
//
//   index.html?profile=saurabh        node tools/render.mjs video --profile saurabh

const CLAUDE = {
  id: 'claude',
  hud: { name: 'CLAUDE', tag: 'MOTION REEL ’26' },
  shots: ['IGNITION', 'KINETIC TYPE', 'GEOMETRY', 'PARTICLES', 'DIMENSION', 'DATA', 'MONTAGE', 'SIGNATURE'],
  ignition: {
    word: 'MOTION',
    portal: 4, // index of the "O" the camera dives through
    point: ['POINT', 'X 960  Y 540'],
    line: ['LINE', null], // null: live width/height readout
    type: ['TYPE', 'ROBOTO FLEX', null], // null: live variable-axis readout
  },
  type: { l1: 'TIMING', l2: 'is', l3: 'EVERYTHING.' },
  geometry: { stats: [] },
  particles: { caption: null },
  dimension: { ring: 'DIMENSION — DEPTH — FORM — LIGHT — '.repeat(2), lower: null },
  data: {
    title: 'RENDER COST / SHOT',
    subtitle: 'MS PER FRAME · 1920×1080 · SWIFTSHADER',
    headline: 'Every frame, measured.',
    // Per-shot average frame time (ms), from `node tools/render.mjs bench`.
    values: [664, 1150, 1161, 1418, 3544, 530, 734, 560],
    labels: ['IGN', 'TYPE', 'GEO', 'PART', 'DIM', 'DATA', 'MONT', 'SIGN'],
    highlight: 4,
    cards: [
      { kind: 'odometer', label: 'FRAMES', right: '15.000 S @ 60 FPS', value: 900, digits: 3 },
      { kind: 'ring', label: 'KEYFRAMES', caption: 'every curve is a function' },
      { kind: 'toggle', label: 'MOTION BLUR', caption: '16 SAMPLES · 180° SHUTTER' },
    ],
  },
  montage: {
    word: 'MOTION',
    cycle: ['MOTION', 'motion', 'MOTION', 'MOTION', 'MOTION', 'MOTION'],
    captions: null,
  },
  signature: {
    name: 'Claude',
    left: 'MOTION DESIGNER',
    right: 'SHOWREEL 2026',
    tagline: 'every frame, written in code.',
    contact: null,
  },
};

// Saurabh Nawale: every figure below comes from the resume (Sep 2026), the
// LinkedIn analytics dashboard (Sep 2026) or LinkedIn's weekly digest emails.
const SAURABH = {
  id: 'saurabh',
  hud: { name: 'SAURABH NAWALE', tag: 'SALES REEL ’26' },
  shots: ['THE FUNNEL', 'NET-NEW ARR', 'QUOTA', 'OUTBOUND', 'PIPELINE', 'REACH', 'HIGHLIGHTS', 'SIGNATURE'],
  ignition: {
    word: 'CLOSER',
    portal: 2,
    point: ['PROSPECT', '1,000+ CONTACTS'],
    line: ['PIPELINE', { prefix: '$', to: 1.5, dp: 1, suffix: 'M BUILT' }], // counts up as the line grows
    type: ['CLOSE', '$750K+ NET-NEW ARR', '122% OF QUOTA'],
  },
  type: { l1: '$750K+', l2: 'net-new', l3: 'ARR CLOSED.' },
  geometry: {
    // Stat tiles set into the Bauhaus grid (column, row of the 8×5 grid).
    stats: [
      { c: 1, r: 1, value: '122%', label: 'Q2 QUOTA', bg: 'flame', fg: 'ink' },
      { c: 4, r: 1, value: '$750K+', label: 'NET-NEW ARR', bg: 'ink', fg: 'paper' },
      { c: 6, r: 1, value: '110%', label: 'Q4 QUOTA', bg: 'cobalt', fg: 'paper' },
      { c: 2, r: 2, value: '100+', label: 'ACCOUNTS', bg: 'paper', fg: 'ink' },
      { c: 5, r: 2, value: '90%', label: 'C-SUITE WIN RATE', bg: 'sun', fg: 'ink' },
      { c: 0, r: 3, value: '7+', label: 'YEARS IN B2B SALES', bg: 'ink', fg: 'flame' },
      { c: 3, r: 3, value: '$50–80K', label: 'ACV · AI AGENTIC', bg: 'paper', fg: 'cobalt' },
      { c: 7, r: 3, value: 'Sales Shark', serif: true, label: 'AWARD · SPYNE.AI', bg: 'flame', fg: 'paper' },
    ],
  },
  particles: {
    caption: { kicker: 'OUTBOUND ENGINE', big: '1,000+ contacts', small: 'SCORED · WAVE-BASED · NA · EU · LATAM' },
  },
  dimension: {
    ring: 'EMEA — APAC — NORTH AMERICA — '.repeat(2),
    lower: {
      kicker: 'PIPELINE BUILT',
      big: '$1.5M',
      serif: 'with Europe’s 5th-largest auto group',
      small: 'VAN MOSSEL AUTOMOTIVE GROUP · 6+ STAKEHOLDERS',
    },
  },
  data: {
    title: 'LINKEDIN IMPRESSIONS · RUNNING TOTAL',
    subtitle: 'WEEKLY LINKEDIN DIGESTS · JUN → SEP 2026',
    headline: 'Numbers, not adjectives.',
    // Running total of the post impressions in LinkedIn's weekly digests:
    // 15+17+18+183 to Jun 23, then +5+7, +386, +56, +37, +348, +802, +271.
    values: [233, 245, 631, 687, 724, 1072, 1874, 2145],
    labels: ['JUN 23', 'AUG 4', 'AUG 18', 'AUG 25', 'SEP 1', 'SEP 8', 'SEP 15', 'SEP 22'],
    highlight: 7,
    cards: [
      { kind: 'odometer', label: 'LINKEDIN FOLLOWERS', right: '+1% WEEK OVER WEEK', up: true, value: 6981, digits: 4 },
      {
        kind: 'pair',
        items: [
          { value: 322, label: 'PROFILE VIEWERS · 90 DAYS' },
          { value: 98, label: 'SEARCH APPEARANCES · 1 WEEK' },
        ],
      },
      { kind: 'social', label: 'ALSO WRITING ON', text: 'LLMs & AI agents', handle: 'X  @Saurabhnawale_', button: ['Follow', 'Following'] },
    ],
  },
  montage: {
    word: 'CLOSER',
    cycle: ['$750K+', '122%', '$1.5M', '100+', '6,981', '7+ YRS'],
    captions: ['NET-NEW ARR', 'Q2 QUOTA', 'PIPELINE BUILT', 'ACCOUNTS', 'LINKEDIN FOLLOWERS', 'IN B2B SALES'],
  },
  signature: {
    name: 'Saurabh Nawale',
    left: 'SENIOR ACCOUNT EXECUTIVE',
    right: 'AI · CLOUD · SAAS',
    tagline: '7+ years. $750K+ closed. 122% of quota.',
    contact: 'linkedin.com/in/saurabhnawale   ·   X  @Saurabhnawale_',
  },
};

export const PROFILES = { claude: CLAUDE, saurabh: SAURABH };

// The active profile (set once at boot, read by every scene).
export let P = CLAUDE;
export function setProfile(id) {
  P = PROFILES[id] || CLAUDE;
  return P;
}
