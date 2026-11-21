// Les accents d'un e-mail HTML arrivent en ENTITÉS (« commer&ccedil;ant »,
// « Pri&#232;re », « jusqu&rsquo;au »). Mesuré le 23 oct. sur le Chronopost du
// 22 : décodées en ESPACE, elles coupaient les mots (« Pri re de ne pas
// r pondre ») et une date, un lieu ou un code écrits avec un accent ou une
// apostrophe typographique n'étaient plus reconnus. UNE règle (§11) : la route
// des e-mails (htmlToText) et l'app (les lignes déjà rangées, `extraitLieu`,
// `extraitCode`) décodent de la même façon. Une entité inconnue reste telle quelle.
const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', euro: '€', laquo: '«', raquo: '»', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', reg: '®', copy: '©', trade: '™', deg: '°', middot: '·', bull: '•', shy: '',
  eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë', agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', ccedil: 'ç', icirc: 'î', iuml: 'ï',
  ocirc: 'ô', ouml: 'ö', ugrave: 'ù', ucirc: 'û', uuml: 'ü', oelig: 'œ', aelig: 'æ', yuml: 'ÿ' };
const point = (n) => (n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ' ');
export function decoderEntitesHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => point(parseInt(h, 16)))
    .replace(/&#(\d{1,7});/g, (m, d) => point(Number(d)))
    .replace(/&([a-z]+);/gi, (m, nom) => {
      if (nom === 'amp') return m;   // en dernier : « &amp;eacute; » reste « &eacute; »
      if (ENTITES[nom] != null) return ENTITES[nom];
      const bas = nom.toLowerCase();
      return (ENTITES[bas] != null && /^[A-Z]/.test(nom)) ? ENTITES[bas].toUpperCase() : m;
    })
    .replace(/&amp;/gi, '&');
}
