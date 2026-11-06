// ── LE HTML D'ORIGINE D'UN E-MAIL « À GESTE », ASSAINI (6 nov., décision de Julien) ──
// « Garder pendant 30 jours le HTML d'origine ASSAINI des seuls e-mails à geste,
// pour que l'e-mail ouvert dans VRM s'affiche comme dans Mail. » Base : ~236 Mo
// sur 500, ~100 e-mails par jour.
//
// UNE règle (§11), lue par la réception (api/email-inbound.js, `repondre`), par
// la lecture d'UN e-mail (api/_lib/reception-email.js, `lireEmailBoite` — qui
// RÉ-ASSAINIT ce qu'elle relit) et par la purge du cron du matin
// (api/ship-reminders.js). Rien de tout ça n'est une fonction de plus.
//
//   · `emailAGeste(type, resume)` : quels e-mails gardent leur HTML — colis à
//     retirer (code lu ou « au point relais »), vente (Vinted, Vestiaire, et ce
//     que la route range comme telle), bordereau, achat, offre. Rien d'autre (les
//     37 % de « rien à faire » n'ont pas besoin de leur mise en page).
//   · `assainirHtml(html)` : une LISTE BLANCHE de balises et d'attributs, appliquée
//     par un lecteur écrit ici (aucune dépendance) qui RÉÉCRIT tout ce qu'il garde
//     (nom de balise de la liste, attributs ré-échappés, texte où « < » est
//     échappé) : ce que le navigateur relira est exactement ce qui a été jugé.
//       – supprimés avec leur contenu : script, style dangereux (voir plus bas),
//         iframe, frame, object, embed, applet, form (la balise), svg, math,
//         template, noscript, textarea, select, title, head/meta/link/base ;
//       – aucun attribut `on…`, aucun `id`/`name`, aucun `srcset`, `background`,
//         `action`, `formaction`, `xlink:href` ;
//       – un lien n'est gardé qu'en http(s), mailto ou tel (entités décodées,
//         blancs retirés AVANT le jugement : « java&#x09;script: » ne passe pas),
//         toujours `target="_blank" rel="noopener noreferrer"` ;
//       – CSS (attribut `style` et bloc `<style>`) : commentaires et barres
//         obliques inverses retirés, `url(…)`, `image-set(…)`, `expression(…)`,
//         `@import`, `@font-face`, `behavior`, `-moz-binding`, `javascript:`
//         neutralisés — aucun chargement distant ne part d'une feuille de style ;
//       – les images distantes ne sont PAS chargées : leur adresse (https
//         seulement) passe dans `data-vrm-src` ; l'écran ne la remet en `src` que
//         sur SON geste « Afficher les images » ; les images en ligne (`data:`
//         png/gif/jpeg/webp) restent ; `cid:` et le reste sont retirés ;
//       – les PIXELS DE SUIVI (≤ 2 px, cachés, ou d'une adresse d'ouverture) sont
//         supprimés, même après le geste.
//   · Plafond : HTML_MAX octets assainis (150 Ko). Au-delà, rien n'est gardé que
//     le poids, et l'écran le dit (« trop lourd, le texte seul »).
//   · `HTML_JOURS` : la ligne vit 30 jours (purge du cron ; la lecture refuse
//     aussi une ligne plus vieille — une purge ratée ne montre rien de plus).
//
// ⚠️ Une ligne À PART (`email_html_{empreinte}`, même empreinte que
//    `email_reception_*` et `email_texte_*`) : aucune lecture de liste ne la lit
//    (`audit-emails-html` le vérifie), l'export complet l'écarte.
// ⚠️ L'écran l'affiche dans un cadre isolé (src/CadreEmail.jsx : `sandbox` SANS
//    `allow-scripts`, sa propre CSP) — ce module n'est pas la seule barrière, mais
//    il est la première.

export const HTML_MAX = 150 * 1024;
export const HTML_BRUT_MAX = 3 * 1024 * 1024;   // au-delà, on n'essaie même pas (temps de calcul)
export const HTML_JOURS = 30;
export const HTML_VERSION = 1;
export const PREFIXE_HTML = 'email_html_';
export const idHtml = (cle) => (/^[0-9a-f]{16,64}$/.test(String(cle || '')) ? PREFIXE_HTML + cle : null);

// ── QUELS E-MAILS ────────────────────────────────────────────────────────────
const TYPES_GESTE = new Set(['vente', 'vente-vestiaire', 'bordereau', 'achat', 'offre']);
export function emailAGeste(type, resume) {
  const t = String(type || '');
  if (TYPES_GESTE.has(t)) return true;
  if (t === 'suivi') {
    const r = resume && typeof resume === 'object' && !Array.isArray(resume) ? resume : {};
    if (r.sens === 'sortant') return false;
    return (typeof r.code === 'string' && r.code.trim() !== '') || r.st === 'available';
  }
  return false;
}
// La ligne est-elle encore dans ses 30 jours ? (`at` illisible ⇒ non : pas su ≠ oui)
export function htmlEncoreGarde(at, maintenant = Date.now()) {
  const t = Date.parse(at || '');
  return Number.isFinite(t) && maintenant - t <= HTML_JOURS * 864e5 && t <= maintenant + 36e5;
}
export const limitePurge = (maintenant = Date.now()) => new Date(maintenant - HTML_JOURS * 864e5).toISOString();

// ── LES LISTES BLANCHES ──────────────────────────────────────────────────────
const BALISES = new Set(['a', 'abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'big', 'blockquote', 'br', 'caption', 'center', 'cite', 'code', 'col', 'colgroup', 'dd', 'del', 'dfn', 'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'font', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'ins', 'kbd', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q', 's', 'samp', 'section', 'small', 'span', 'strike', 'strong', 'sub', 'summary', 'details', 'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'time', 'tr', 'tt', 'u', 'ul', 'var', 'wbr']);
const VIDES = new Set(['br', 'col', 'hr', 'img', 'wbr']);
// Supprimées AVEC leur contenu (le texte qu'elles portent n'est pas un message).
const BRUT = new Set(['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);
const AVEC_CONTENU = new Set(['svg', 'math', 'object', 'applet', 'template', 'select', 'frameset', 'audio', 'video', 'canvas', 'map', 'picture', 'head']);
const ATTR_COMMUNS = new Set(['align', 'valign', 'bgcolor', 'border', 'cellpadding', 'cellspacing', 'color', 'colspan', 'rowspan', 'dir', 'face', 'height', 'width', 'hspace', 'vspace', 'size', 'style', 'title', 'lang', 'class', 'role', 'nowrap', 'scope', 'span', 'start', 'type', 'summary', 'abbr', 'headers', 'datetime', 'reversed', 'open']);
const ATTR_PROPRES = { a: new Set(['href']), img: new Set(['src', 'alt', 'data-vrm-src']) };

// ── DÉCODER CE QUE LE NAVIGATEUR DÉCODERA (pour JUGER) ──────────────────────
const NOMMEES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', tab: '\t', newline: '\n', colon: ':', sol: '/', lpar: '(', rpar: ')', period: '.', comma: ',', semi: ';', equals: '=', excl: '!', num: '#', percnt: '%', bsol: '\\', ast: '*', plus: '+', quest: '?', lowbar: '_', hyphen: '-', dash: '-' };
const point = (n) => (n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '\ufffd');
export function decoderAttr(v) {
  // UNE passe (comme le navigateur) : « &#38;amp; » donne « &amp; », pas « & ».
  return String(v == null ? '' : v).replace(/&(?:#x([0-9a-f]{1,8});?|#(\d{1,9});?|([a-z]{2,10});?)/gi,
    (m, h, d, n) => (h ? point(parseInt(h, 16)) : d ? point(Number(d)) : NOMMEES[n.toLowerCase()] != null ? NOMMEES[n.toLowerCase()] : m));
}
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── LES ADRESSES ─────────────────────────────────────────────────────────────
// Tout blanc et tout caractère de contrôle retiré (le navigateur les retire aussi
// d'une adresse avant de lire son schéma) ; puis la liste blanche des schémas.
const sansBlancs = (u) => String(u).replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, '');
export function lienPermis(brut) {
  const u = sansBlancs(decoderAttr(brut));
  if (/^https?:\/\/[^/\\]/i.test(u) || /^mailto:[^:]/i.test(u) || /^tel:[+\d(]/i.test(u)) return u.slice(0, 2000);
  return null;
}
const IMAGE_EN_LIGNE = /^data:image\/(?:png|gif|jpe?g|webp);base64,[a-z0-9+/=]+$/i;
export function imagePermise(brut) {
  const u = sansBlancs(decoderAttr(brut));
  if (IMAGE_EN_LIGNE.test(u)) return { enLigne: u };
  if (/^https?:\/\/[^/\\]/i.test(u)) return { distante: u.replace(/^http:/i, 'https:').slice(0, 2000) };
  return null;
}
// Une adresse d'ouverture (pixel de suivi) : chemins usuels des outils d'envoi.
const ADRESSE_PIXEL = /\/(?:open|opens|track(?:ing)?\/open|pixel|beacon|wf\/open|o\.gif|e\/o|t\.gif|imp)(?:[/?.]|$)/i;

// ── LE CSS ───────────────────────────────────────────────────────────────────
// Un chargement distant ne part JAMAIS d'une feuille de style (url, image-set…),
// et rien de ce qui a exécuté du code un jour (expression, behavior, binding).
function cssPropre(css) {
  return String(css || '')
    .replace(/\/\*[\s\S]*?(?:\*\/|$)/g, ' ')
    .replace(/[\\<>]/g, '')
    .replace(/@import[^;{}]*;?/gi, '')
    .replace(/@font-face\s*\{[^}]*\}?/gi, '')
    .replace(/@(?:namespace|charset)[^;{}]*;?/gi, '')
    .replace(/\b(?:url|image-set|-webkit-image-set|image|cross-fade|-webkit-cross-fade|element|src)\s*\((?:"[^"]*"|'[^']*'|[^)])*\)?/gi, 'none')
    .replace(/expression\s*\(/gi, 'x(')
    .replace(/(?:behaviou?r|-moz-binding|-ms-behavior)\s*:/gi, 'x-:')
    .replace(/(?:java|vb|live)script\s*:/gi, 'x:');
}
function styleAttr(v) {
  const t = cssPropre(decoderAttr(v));
  const out = [];
  for (const d of t.split(';')) {
    const i = d.indexOf(':');
    if (i < 1) continue;
    const prop = d.slice(0, i).trim().toLowerCase();
    const val = d.slice(i + 1).trim();
    // Une déclaration neutralisée (`x(`, `x:`) part entière : rien d'à moitié jugé ne reste.
    if (!/^-?[a-z][a-z-]{0,40}$/.test(prop) || !val || /^x-$/.test(prop) || /(?:^|[^a-z-])x[(:]/i.test(val)) continue;
    out.push(prop + ':' + val);
  }
  return out.join(';').slice(0, 3000);
}
const estCache = (style) => /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\.0*)?\s*(?:;|$|!)|max-height\s*:\s*0(?:px)?\s*(?:;|$|!))/i.test(style);
const px = (v) => { const m = /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(String(v == null ? '' : v)); return m ? Number(m[1]) : null; };
const pxStyle = (style, prop) => { const m = new RegExp('(?:^|;)\\s*' + prop + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px', 'i').exec(style || ''); return m ? Number(m[1]) : null; };

// ── LE LECTEUR ───────────────────────────────────────────────────────────────
// Lit une balise à partir de `i` (sur « < ») ; rend { nom, fin, attrs, ferme, j }
// ou null (ce n'est pas une balise : le « < » devient du texte).
function lireBalise(s, i) {
  let j = i + 1;
  const fin = s[j] === '/';
  if (fin) j++;
  if (!/[a-zA-Z]/.test(s[j] || '')) return null;
  const debut = j;
  while (j < s.length && !/[\s/>]/.test(s[j])) j++;
  const nom = s.slice(debut, j).toLowerCase();
  const attrs = [];
  let ferme = false;
  for (;;) {
    while (j < s.length && /[\s/]/.test(s[j])) { if (s[j] === '/' && s[j + 1] === '>') ferme = true; j++; }
    if (j >= s.length) return null;        // balise jamais refermée : du texte, échappé
    if (s[j] === '>') { j++; break; }
    const da = j;
    j++;                                   // un « = » en tête fait partie du nom (règle du navigateur)
    while (j < s.length && !/[\s/>=]/.test(s[j])) j++;
    const an = s.slice(da, j).toLowerCase();
    while (j < s.length && /\s/.test(s[j])) j++;
    let val = '';
    if (s[j] === '=') {
      j++;
      while (j < s.length && /\s/.test(s[j])) j++;
      const q = s[j];
      if (q === '"' || q === "'") { const k = s.indexOf(q, j + 1); if (k < 0) return null; val = s.slice(j + 1, k); j = k + 1; }
      else { const dv = j; while (j < s.length && !/[\s>]/.test(s[j])) j++; val = s.slice(dv, j); }
    }
    attrs.push([an, val]);
  }
  return { nom, fin, attrs, ferme, j };
}
// La fin d'un élément « brut » (script, style…) : `</nom` suivi d'un blanc, « / » ou « > ».
function finBrute(s, j, nom) {
  const re = new RegExp('</' + nom + '[\\s/>]', 'ig');
  re.lastIndex = j;
  const m = re.exec(s);
  if (!m) return { contenu: s.slice(j), j: s.length };
  const k = s.indexOf('>', m.index);
  return { contenu: s.slice(j, m.index), j: k < 0 ? s.length : k + 1 };
}
// La fin d'un élément supprimé avec son contenu (svg, object…), imbrications comptées.
function finImbriquee(s, j, nom) {
  const re = new RegExp('<(/?)' + nom + '(?=[\\s/>])', 'ig');
  re.lastIndex = j;
  let prof = 1, m;
  while ((m = re.exec(s))) {
    prof += m[1] ? -1 : 1;
    if (prof === 0) { const k = s.indexOf('>', m.index); return k < 0 ? s.length : k + 1; }
  }
  return s.length;
}

function attributs(nom, attrs, compte) {
  const permis = ATTR_PROPRES[nom];
  const out = [];
  let style = '', w = null, h = null, src = null, alt = null;
  for (const [an, v] of attrs) {
    if (!(ATTR_COMMUNS.has(an) || (permis && permis.has(an)))) { compte.attributs++; continue; }
    if (an === 'style') { style = styleAttr(v); continue; }
    if (an === 'href') { const u = lienPermis(v); if (u) out.push(['href', u]); else compte.liensRetires++; continue; }
    if (an === 'src' || an === 'data-vrm-src') { if (src == null) src = v; continue; }
    if (an === 'alt') { alt = decoderAttr(v).slice(0, 300); continue; }
    const d = decoderAttr(v).replace(/[\u0000-\u001f]/g, '').slice(0, 300);
    if (an === 'width') w = px(d);
    if (an === 'height') h = px(d);
    if (an === 'class' || an === 'title') { out.push([an, d]); continue; }
    if (an === 'face' || an === 'lang' || an === 'role' || an === 'type') { if (/^[\w ,.'"-]{0,120}$/.test(d)) out.push([an, d]); continue; }
    if (/^[\w#%.,\s-]{0,60}$/.test(d)) out.push([an, d]);
  }
  if (nom === 'img') {
    const sw = pxStyle(style, 'width'), sh = pxStyle(style, 'height');
    const lw = sw != null ? sw : w, lh = sh != null ? sh : h;
    const im = src == null ? null : imagePermise(src);
    if (!im) return { retirer: 'image' };
    if ((lw != null && lw <= 2) || (lh != null && lh <= 2) || estCache(style) || (im.distante && ADRESSE_PIXEL.test(im.distante))) return { retirer: 'pixel' };
    if (im.enLigne) out.unshift(['src', im.enLigne]);
    else { out.unshift(['data-vrm-src', im.distante]); compte.images++; }
    if (alt != null) out.push(['alt', alt]);
  }
  if (nom === 'a' && out.some(([k]) => k === 'href')) { out.push(['target', '_blank'], ['rel', 'noopener noreferrer']); compte.liens++; }
  if (style) out.push(['style', style]);
  return { texte: out.map(([k, v]) => ` ${k}="${echapper(v)}"`).join('') };
}

// Rend { ok:true, html, octets, images, pixels, liens, sombre } · { ok:false, trop:true, octets }
// · { ok:false, vide:true }. Ne lève jamais (une entrée bizarre ⇒ ce qu'on a pu lire).
export function assainirHtml(entree) {
  const s = typeof entree === 'string' ? entree.replace(/\u0000/g, '') : '';
  const brutOctets = Buffer.byteLength(s, 'utf8');
  if (!s.trim()) return { ok: false, vide: true };
  if (brutOctets > HTML_BRUT_MAX) return { ok: false, trop: true, octets: brutOctets };
  const compte = { images: 0, pixels: 0, liens: 0, liensRetires: 0, attributs: 0, balises: 0 };
  const o = [];
  let i = 0, pre = 0;
  const pile = [];
  while (i < s.length) {
    const k = s.indexOf('<', i);
    const texte = s.slice(i, k < 0 ? s.length : k);
    if (texte) o.push((pre ? texte : texte.replace(/[ \t\r\n\f]{2,}/g, (m) => (/\n/.test(m) ? '\n' : ' '))).replace(/>/g, '&gt;'));
    if (k < 0) break;
    i = k;
    // Commentaires, déclarations, instructions : rien n'en sort.
    if (s.startsWith('<!--', i)) { const f = s.indexOf('-->', i + 4); const f2 = s.indexOf('--!>', i + 4); const fin = [f, f2].filter((x) => x >= 0).sort((a, b) => a - b)[0]; i = fin == null ? s.length : fin + (fin === f ? 3 : 4); continue; }
    if (s[i + 1] === '!' || s[i + 1] === '?') { const f = s.indexOf('>', i); i = f < 0 ? s.length : f + 1; continue; }
    const b = lireBalise(s, i);
    if (!b) { o.push('&lt;'); i++; continue; }
    i = b.j;
    const nom = b.nom;
    if (b.fin) {
      if (nom === 'body') { if (pile.includes('div-corps')) { o.push('</div>'); pile.splice(pile.lastIndexOf('div-corps'), 1); } continue; }
      if (BALISES.has(nom) && !VIDES.has(nom)) { const p = pile.lastIndexOf(nom); if (p >= 0) { pile.splice(p, 1); o.push(`</${nom}>`); if (nom === 'pre') pre = Math.max(0, pre - 1); } }
      continue;
    }
    if (nom === 'plaintext') break;
    if (BRUT.has(nom)) {
      const f = finBrute(s, i, nom); i = f.j;
      if (nom === 'style') { const css = cssPropre(f.contenu).trim(); if (css) o.push(`<style>${css}</style>`); }
      else compte.balises++;
      continue;
    }
    if (AVEC_CONTENU.has(nom)) {
      // `<head>` n'est pas supprimé avec son contenu : ses `<style>` comptent (le reste n'est pas gardé).
      if (nom === 'head') continue;
      if (!b.ferme) i = finImbriquee(s, i, nom);
      compte.balises++;
      continue;
    }
    if (nom === 'body') { const a = attributs('div', b.attrs, compte); o.push(`<div data-vrm-corps=""${a.texte || ''}>`); pile.push('div-corps'); continue; }
    if (!BALISES.has(nom)) { compte.balises++; continue; }
    const a = attributs(nom, b.attrs, compte);
    if (a.retirer) { if (a.retirer === 'pixel') compte.pixels++; continue; }
    if (VIDES.has(nom)) { o.push(`<${nom}${a.texte}>`); continue; }
    o.push(`<${nom}${a.texte}>`);
    pile.push(nom);
    if (nom === 'pre') pre++;
    if (pile.length > 400) break;          // une imbrication absurde ne fait pas tomber la route
  }
  for (let p = pile.length - 1; p >= 0; p--) o.push(pile[p] === 'div-corps' ? '</div>' : `</${pile[p]}>`);
  const html = o.join('').trim();
  const octets = Buffer.byteLength(html, 'utf8');
  if (!html) return { ok: false, vide: true };
  if (octets > HTML_MAX) return { ok: false, trop: true, octets };
  // L'e-mail sait-il se mettre en sombre ? (l'écran garde sinon un fond clair dans le cadre)
  const sombre = /prefers-color-scheme\s*:\s*dark/i.test(html);
  return { ok: true, html, octets, images: compte.images, pixels: compte.pixels, liens: compte.liens, sombre };
}

// La ligne rangée à la réception (`data`), ou null si cet e-mail n'en a pas.
export function ligneHtml({ type, resume, html, at }) {
  if (!emailAGeste(type, resume)) return null;
  if (typeof html !== 'string' || !html.trim()) return null;
  const r = assainirHtml(html);
  if (r.ok) return { v: HTML_VERSION, at, html: r.html, octets: r.octets, images: r.images, pixels: r.pixels, sombre: r.sombre ? 1 : 0 };
  if (r.trop) return { v: HTML_VERSION, at, trop: 1, octets: r.octets };
  return null;
}

// Ce que l'écran reçoit (`origine` de lireEmailBoite), depuis la ligne relue :
//   { etat:'garde', html, images, pixels, sombre } · { etat:'trop', octets }
//   · { etat:'absent', raison } — `null` (pas su) est décidé par l'appelant.
// ⚠️ Ce qui est relu est RÉ-ASSAINI : la garantie ne dépend pas de qui a écrit la ligne.
export function origineLue(ligne, { type, resume, at } = {}, maintenant = Date.now()) {
  const geste = emailAGeste(type, resume);
  if (!ligne) return { etat: 'absent', raison: !geste ? 'pas-a-geste' : !htmlEncoreGarde(at, maintenant) ? 'trop-vieux' : 'non-garde' };
  if (!htmlEncoreGarde(ligne.at, maintenant)) return { etat: 'absent', raison: 'trop-vieux' };
  if (String(ligne.trop || '') === '1' || ligne.trop === true) return { etat: 'trop', octets: Number(ligne.octets) || null };
  if (typeof ligne.html !== 'string') return { etat: 'absent', raison: 'non-garde' };
  const r = assainirHtml(ligne.html);
  if (!r.ok) return r.trop ? { etat: 'trop', octets: r.octets } : { etat: 'absent', raison: 'non-garde' };
  return { etat: 'garde', html: r.html, images: r.images, pixels: Number(ligne.pixels) || 0, sombre: r.sombre };
}
