// Home screen icons per app: one family look (navy → royal blue, white symbol, red accent).
// Each value is a complete 180×180 SVG; AppleIcon/AppIcon render it as an image.

const R = '#e63946'; // red
const W = '#ffffff';

const frame = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a5bd7"/><stop offset="1" stop-color="#0b1f4d"/></linearGradient>
<radialGradient id="gl" cx="0.25" cy="0.15" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="180" height="180" fill="url(#bg)"/>
<rect width="180" height="180" fill="url(#gl)"/>

${body}
</svg>`;

export const APP_ICONS: Record<string, string> = {
  // Portal: house with a red heart in the door
  portal: frame(`
<path d="M90 38 L146 86 V140 a6 6 0 0 1 -6 6 H40 a6 6 0 0 1 -6 -6 V86 Z" fill="${W}"/>
<path d="M28 90 L90 36 L152 90" fill="none" stroke="${R}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M90 128 C70 114 66 104 72 97 C77 91 86 93 90 100 C94 93 103 91 108 97 C114 104 110 114 90 128Z" fill="${R}"/>`),

  // Tasks: card with red check and two lines
  tasks: frame(`
<rect x="40" y="34" width="100" height="116" rx="16" fill="${W}"/>
<path d="M58 84 l16 16 l34 -38" fill="none" stroke="${R}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="58" y="116" width="64" height="8" rx="4" fill="#2a5bd7"/>
<rect x="58" y="130" width="40" height="8" rx="4" fill="#2a5bd7" opacity="0.5"/>
<rect x="70" y="26" width="40" height="16" rx="8" fill="${R}"/>`),

  // Recipes: cooking pot with red steam
  recipes: frame(`
<path d="M66 60 q-8 -10 0 -20 q8 -10 0 -20" fill="none" stroke="${R}" stroke-width="7" stroke-linecap="round"/>
<path d="M90 60 q-8 -10 0 -20 q8 -10 0 -20" fill="none" stroke="${W}" stroke-width="7" stroke-linecap="round" opacity="0.85"/>
<path d="M114 60 q-8 -10 0 -20 q8 -10 0 -20" fill="none" stroke="${R}" stroke-width="7" stroke-linecap="round"/>
<rect x="30" y="72" width="120" height="14" rx="7" fill="${R}"/>
<path d="M40 86 H140 V124 a22 22 0 0 1 -22 22 H62 a22 22 0 0 1 -22 -22 Z" fill="${W}"/>
<rect x="22" y="96" width="20" height="10" rx="5" fill="${W}"/>
<rect x="138" y="96" width="20" height="10" rx="5" fill="${W}"/>`),

  // Travel: paper plane with red dashed route
  travel: frame(`
<path d="M28 140 C60 150 70 110 96 104" fill="none" stroke="${R}" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 14"/>
<path d="M144 40 L34 88 L76 100 Z" fill="${W}"/>
<path d="M144 40 L76 100 L92 140 Z" fill="#dfe8ff"/>
<path d="M144 40 L76 100 L82 126 Z" fill="${R}"/>`),

  // Notes: notepad with lines and red pencil
  notes: frame(`
<rect x="36" y="32" width="92" height="118" rx="12" fill="${W}"/>
<rect x="36" y="32" width="92" height="22" rx="11" fill="${R}"/>
<rect x="36" y="44" width="92" height="10" fill="${R}"/>
<rect x="50" y="72" width="64" height="7" rx="3.5" fill="#2a5bd7"/>
<rect x="50" y="90" width="52" height="7" rx="3.5" fill="#2a5bd7" opacity="0.6"/>
<rect x="50" y="108" width="40" height="7" rx="3.5" fill="#2a5bd7" opacity="0.35"/>
<g transform="rotate(40 128 116)"><rect x="118" y="64" width="20" height="78" rx="4" fill="${R}"/><rect x="118" y="64" width="20" height="12" rx="4" fill="${W}"/><path d="M118 142 L128 162 L138 142Z" fill="#ffd9b8"/><path d="M125 156 L128 162 L131 156Z" fill="#0b1f4d"/></g>`),

  // Documents: stacked folders, red tab
  documents: frame(`
<rect x="44" y="40" width="96" height="86" rx="10" fill="${W}" opacity="0.45"/>
<path d="M30 62 a8 8 0 0 1 8 -8 H74 l12 12 H142 a8 8 0 0 1 8 8 V140 a8 8 0 0 1 -8 8 H38 a8 8 0 0 1 -8 -8 Z" fill="${W}"/>
<path d="M30 62 a8 8 0 0 1 8 -8 H74 l12 12 H30 Z" fill="${R}"/>
<rect x="50" y="92" width="80" height="8" rx="4" fill="#2a5bd7"/>
<rect x="50" y="110" width="56" height="8" rx="4" fill="#2a5bd7" opacity="0.5"/>`),

  // Finance: rising bars with red arrow
  finance: frame(`
<rect x="36" y="110" width="24" height="38" rx="5" fill="${W}" opacity="0.7"/>
<rect x="70" y="88" width="24" height="60" rx="5" fill="${W}" opacity="0.85"/>
<rect x="104" y="64" width="24" height="84" rx="5" fill="${W}"/>
<path d="M30 96 L66 66 L90 80 L138 36" fill="none" stroke="${R}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M116 32 H144 V60" fill="none" stroke="${R}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`),

  // Sport: stopwatch with red pulse
  sport: frame(`
<rect x="80" y="24" width="20" height="14" rx="4" fill="${W}"/>
<circle cx="90" cy="98" r="56" fill="${W}"/>
<circle cx="90" cy="98" r="44" fill="none" stroke="#2a5bd7" stroke-width="4" opacity="0.25"/>
<path d="M40 100 H64 L74 78 L88 122 L102 84 L110 100 H140" fill="none" stroke="${R}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
<rect x="132" y="44" width="18" height="10" rx="5" fill="${W}" transform="rotate(45 141 49)"/>`),
};

export function appIconDataUrl(moduleKey: string | undefined): string {
  const svg = APP_ICONS[moduleKey ?? 'portal'] ?? APP_ICONS.portal;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}
