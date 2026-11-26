// ════════════════════════════════════════════════════════════════════════
//  LES GESTES D'UN FAVORI COMME UNE PERSONNE (25 nov., ext. 5.453 — `favorishumains`)
//  Julien : « tu dois faire tous les gestes que je fais pour faire les favoris », « ça doit être humain » (sans être lent).
//  Le VRAI vrm-formulaire.js, dans un `vm`, sur une fausse page de conversation Vinted minimale (champ, « Envoyer » ÉTEINT tant
//  que le champ est vide — la forme courante d'une messagerie ; « Faire une offre », sa fenêtre, « Proposer ») :
//   G1 `taper` : le texte EXACT tapé lettre à lettre (rythme variable, borné, ramené au temps d'écriture tiré par le fond),
//      un temps de lecture d'abord — et RIEN n'est envoyé ;
//   G2 l'étape rappelée trouve le texte déjà là : pas de seconde frappe, une hésitation, « Envoyer », UN message, vu ;
//   G3 « Envoyer » éteint avant la frappe n'arrête plus rien (il est cherché APRÈS la frappe) ;
//   G4 l'offre : hésitation avant « Faire une offre », la fenêtre regardée, le prix tapé, hésitation avant « Proposer » ;
//   G5 jamais deux fois de suite le même temps d'hésitation ;
//   G6 une vérification (captcha) pendant la frappe : arrêt, rien n'est parti ;
//   G7 rien de maquillé (ni isTrusted, ni souris inventée, ni débogueur).
//  `FORM_SRC=<fichier>` : la preuve sur une autre copie (le code d'avant). `--prouve` : chaque mutation rend l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { execFileSync } = require('child_process');
const R = path.join(__dirname, '..');
const F0 = process.env.FORM_SRC ? path.resolve(process.env.FORM_SRC) : path.join(R, 'vinted-sync-extension/vrm-formulaire.js');
const args = process.argv.slice(2);
const MUTATIONS = {
  envoyerAvant: ["      if (!h) { const env = ouAppris('message-envoyer', boutonEnvoyer(champ));", "      { const env = ouAppris('message-envoyer', boutonEnvoyer(champ));"],
  taperEnvoie: ["      if (h && d.taper === true) return", "      if (false) return"],
  hesitation: ["const ms = tirerUnique('hesite', 250, 900); noterDelai('hesite:envoyer', ms); await attenteFrappe(ms);", "const ms = 0; noterDelai('hesite:envoyer', ms);"],
  frappe: ["          const t = await taperHumain(champ, texte, Number(d && d.frappeMs) || 0);", "          const t = { ok: await saisir(champ, texte, { garderFocus: true }) };"],
  unique: ["for (let i = 0; i < 6 && _derniers[k] != null && Math.round(ms / 10) === Math.round(_derniers[k] / 10); i++)", "for (let i = 0; i < 0; i++)"],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`); if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let FORM = F0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(F0, 'utf8');
  if (!s.includes(a)) { console.log('❌ mutation introuvable : ' + mut); process.exit(1); }
  FORM = path.join(os.tmpdir(), `fgh-${mut}-${process.pid}.js`); fs.writeFileSync(FORM, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

// Une fausse conversation Vinted (/inbox/301) : un champ (textarea), « Envoyer » éteint tant que le champ est vide,
// « Faire une offre » qui ouvre une fenêtre (champ du prix + « Proposer »). Les requêtes de la PAGE sont notées.
function page(opts = {}) {
  const posts = [], clics = [], evs = [];
  let t = 0, captchaVisible = false, dialogueOuvert = false;
  class Ev { constructor(type, o = {}) { this.type = type; Object.assign(this, o); this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } }
  class InputEvent extends Ev {} class FocusEvent extends Ev {}
  class El {
    constructor(tag, a = {}) { this.tagName = tag.toUpperCase(); this.attrs = Object.assign({}, a.attrs || {}); this.texte = a.texte || ''; this.parent = a.parent || null; this.offsetParent = {}; this.isConnected = true; this.isContentEditable = false; this.readOnly = false; this._dis = a.dis || null; this.type = a.type || ''; this.enfants = []; this.surClic = a.surClic || null; }
    get disabled() { return this._dis ? this._dis() : false; }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } hasAttribute(k) { return k in this.attrs; }
    get innerText() { return this.texte; } get textContent() { return this.texte; } set textContent(v) { this.texte = String(v); }
    getClientRects() { return [1]; } getBoundingClientRect() { return { width: 100, height: 40, top: 10, left: 10, bottom: 50, right: 110 }; }
    scrollIntoView() { clics.push('defile:' + (this.attrs['aria-label'] || this.tagName)); }
    focus() {} blur() {}
    dispatchEvent(e) { evs.push({ type: e.type, inputType: e.inputType, el: this.tagName }); return true; }
    contains(x) { let e = x; while (e) { if (e === this) return true; e = e.parent; } return false; }
    closest(sel) { let e = this; while (e) { if (e.correspond(sel)) return e; e = e.parent; } return null; }
    correspond(sel) { return String(sel).split(',').some((s) => { s = s.trim(); if (s === 'form') return this.tagName === 'FORM'; if (/role="dialog"|aria-modal/.test(s)) return this.attrs.role === 'dialog'; return false; }); }
    querySelectorAll(sel) { const tous = []; const parc = (e) => { for (const c of e.enfants) { tous.push(c); parc(c); } }; parc(this); return tous.filter((e) => e.matchSel(sel)); }
    matchSel(sel) {
      return String(sel).split(',').some((s) => { s = s.trim();
        if (s === 'button, [role="button"], a[href]' || s === 'button' || s === '[role="button"]') return this.tagName === 'BUTTON';
        if (s === 'a[href]') return false;
        if (/^button\[type="submit"\]$|^button:not\(\[type\]\)$/.test(s)) return this.tagName === 'BUTTON' && (s.includes('submit') ? this.type === 'submit' : !this.type);
        if (/^textarea\[data-testid\*="message" i\]$/.test(s)) return this.tagName === 'TEXTAREA';
        if (s === 'textarea') return this.tagName === 'TEXTAREA';
        if (/^input\[name="price"\]$/.test(s)) return this.tagName === 'INPUT' && this.attrs.name === 'price';
        if (/role="dialog"|aria-modal|modal/.test(s)) return this.attrs.role === 'dialog' && dialogueOuvert;
        return false; });
    }
    click() { clics.push('clic:' + (this.attrs['aria-label'] || this.tagName)); if (this.surClic) this.surClic(); }
  }
  class HTMLInputElement extends El {} class HTMLTextAreaElement extends HTMLInputElement {}
  Object.defineProperty(HTMLInputElement.prototype, 'value', { get() { return this._v || ''; }, set(v) { this._v = String(v); }, configurable: true });
  const racine = new El('body');
  const form = new El('form', { parent: racine }); racine.enfants.push(form);
  const champ = new HTMLTextAreaElement('textarea', { parent: form, attrs: { 'data-testid': 'conversation-message-input' } }); form.enfants.push(champ);
  const fetchPage = (chemin, corps) => { posts.push({ chemin, corps }); return Promise.resolve({ status: 200, headers: { get: () => '' }, clone() { return { text: () => Promise.resolve(JSON.stringify(chemin.includes('replies') ? { reply: { id: 1 } , conversation: { id: 301 }, code: 0 } : { offer: { id: 2 }, code: 0 })) }; } }); };
  const envoyer = new El('button', { parent: form, type: 'submit', attrs: { 'aria-label': 'Envoyer' }, dis: () => !champ.value, surClic: () => { if (champ.value) { ctx.fetch('/api/v2/conversations/301/replies', { method: 'POST', body: JSON.stringify({ reply: { body: champ.value } }) }); racine.texte += '\n' + champ.value; } } }); form.enfants.push(envoyer);
  const dl = new El('div', { parent: racine, attrs: { role: 'dialog' } });
  const prix = new HTMLInputElement('input', { parent: dl, attrs: { name: 'price' } }); dl.enfants.push(prix);
  const proposer = new El('button', { parent: dl, type: 'submit', attrs: { 'aria-label': 'Proposer' }, surClic: () => { ctx.fetch('/api/v2/transactions/900/offers', { method: 'POST', body: JSON.stringify({ offer: { price: prix.value } }) }); racine.texte += '\nOffre 42 €'; } }); dl.enfants.push(proposer);
  const faireOffre = new El('button', { parent: racine, attrs: { 'aria-label': 'Faire une offre' }, surClic: () => { dialogueOuvert = true; racine.enfants.push(dl); } }); racine.enfants.push(faireOffre);
  if (opts.captchaApres) { const v0 = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'); Object.defineProperty(champ, 'value', { get() { return v0.get.call(this); }, set(v) { v0.set.call(this, v); if (String(v).length >= opts.captchaApres) captchaVisible = true; } }); }
  const ctx = {
    console, Math, Date, JSON, Promise, Array, Object, String, Number, RegExp, Set, Map, WeakMap, Error, encodeURIComponent, URL,
    location: { hostname: 'www.vinted.fr', pathname: '/inbox/301', href: 'https://www.vinted.fr/inbox/301', origin: 'https://www.vinted.fr' },
    performance: { now: () => t },
    MessageChannel: class { constructor() { const self = this; this.port1 = { onmessage: null }; this.port2 = { postMessage() { t += 1; Promise.resolve().then(() => self.port1.onmessage && self.port1.onmessage({})); } }; } },
    setTimeout: (f, ms) => setTimeout(f, Number(ms) > 1000 ? 300 : 0), clearTimeout: (x) => clearTimeout(x), setInterval: (f) => setInterval(f, 50), clearInterval: (x) => clearInterval(x),
    InputEvent, Event: Ev, FocusEvent, HTMLInputElement, HTMLTextAreaElement,
    innerWidth: 1000, innerHeight: 800, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1', overflowY: 'visible' }),
    sessionStorage: { setItem() {}, getItem() { return null; } },
    fetch: (u, init) => fetchPage(String(u), init && init.body),
    document: {
      querySelector: () => null,
      querySelectorAll: (sel) => (/captcha|datadome|ddChallenge|challenges\.cloudflare/.test(sel) ? (captchaVisible ? [Object.assign(new El('iframe'), { getBoundingClientRect: () => ({ width: 300, height: 200, top: 10, left: 10, bottom: 210, right: 310 }) })] : []) : racine.querySelectorAll(sel)),
      getElementById: () => null, body: racine, documentElement: { scrollHeight: 800 },
    },
  };
  ctx.globalThis = ctx; ctx.window = ctx;
  ctx.__vrmDelaisVus = [];
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FORM, 'utf8'), ctx);
  return { ctx, posts, clics, evs, champ, F: ctx.__vrmFormulaire, delais: (re) => ctx.__vrmDelaisVus.filter((x) => re.test(x[0])) };
}
const TEXTE = 'Bonjour ! Elle te plait toujours ? Je te fais un prix si tu veux.';

(async () => {
  // G1 — `taper` : le texte tapé, rien d'envoyé.
  try {
    const p = page();
    const r = await p.F('message', { conv: '301', texte: TEXTE, favori: true, humain: true, taper: true, frappeMs: 14000 });
    const lettres = p.delais(/^(lettre-favori|mot)$/).map((x) => x[1]);
    const total = lettres.reduce((a, b) => a + b, 0);
    dit(r && r.ok === true && r.tape === true && p.champ.value === TEXTE && p.posts.length === 0 && !p.clics.some((c) => /clic:Envoyer/.test(c)), 'G1 « taper » : le texte EXACT dans le champ, RIEN n’est envoyé (ni requête, ni « Envoyer »)', JSON.stringify({ r, v: p.champ.value, posts: p.posts.length, clics: p.clics }));
    dit(lettres.length === Array.from(TEXTE).length && lettres.every((d) => d >= 55 && d <= 900) && new Set(lettres).size > 8, 'G1 tapé lettre à lettre : un temps par lettre, variable, borné (55 ms à 0,9 s)', JSON.stringify(lettres.slice(0, 14)));
    dit(Math.abs(total - 14000) <= 14000 * 0.2, 'G1 la frappe prend le temps d’écriture tiré par le fond (± 20 %)', total);
    const lec = p.delais(/^regarder:message$/);
    dit(lec.length === 1 && lec[0][1] >= 400 && lec[0][1] <= 1400, 'G1 un temps de lecture avant d’écrire (0,4–1,4 s)', JSON.stringify(lec));
    // G2 — rappelée : le texte est déjà là ⇒ pas de seconde frappe, une hésitation, « Envoyer », UN message vu.
    const nIn = p.evs.filter((e) => e.type === 'input').length;
    const r2 = await p.F('message', { conv: '301', texte: TEXTE, favori: true, humain: true });
    const h = p.delais(/^hesite:envoyer$/);
    dit(r2 && r2.ok === true && r2.rep && r2.rep.ok && r2.vu === true && p.posts.length === 1 && /replies$/.test(p.posts[0].chemin) && p.evs.filter((e) => e.type === 'input').length === nIn, 'G2 rappelée : texte déjà là (aucune seconde frappe), « Envoyer », UN message, vu dans le fil', JSON.stringify({ r2, posts: p.posts }));
    dit(h.length === 1 && h[0][1] >= 250 && h[0][1] <= 900 && p.clics.indexOf('defile:Envoyer') >= 0 && p.clics.indexOf('defile:Envoyer') < p.clics.indexOf('clic:Envoyer'), 'G2 « Envoyer » amené à l’écran, une hésitation (0,25–0,9 s), puis touché', JSON.stringify({ h, c: p.clics }));
  } catch (e) { dit(false, 'G1/G2 — exception', e && e.stack); }
  // G3 — « Envoyer » éteint tant que le champ est vide : l'étape ne s'arrête plus avant d'avoir tapé.
  try {
    const p = page();
    const r = await p.F('message', { conv: '301', texte: TEXTE, favori: true });
    dit(r && r.ok === true && p.posts.length === 1 && JSON.parse(p.posts[0].corps).reply.body === TEXTE, 'G3 « Envoyer » éteint avant la frappe : tapé PUIS envoyé (avant : « élément message-envoyer introuvable », 2 réessais, arrêt)', JSON.stringify({ r, posts: p.posts.length }));
  } catch (e) { dit(false, 'G3 — exception', e && e.stack); }
  // G4 — l'offre comme une personne.
  try {
    const p = page();
    const r = await p.F('offre', { conv: '301', tx: '900', prix: 42, favori: true });
    const ho = p.delais(/^hesite:offre$/), hp = p.delais(/^hesite:proposer$/), ro = p.delais(/^regarder:offre$/), lp = p.delais(/^lettre-favori$/);
    dit(r && r.ok === true && p.posts.length === 1 && /offers$/.test(p.posts[0].chemin) && JSON.parse(p.posts[0].corps).offer.price === '42', 'G4 l’offre : « Faire une offre », le prix exact (42), « Proposer », UNE requête de la page', JSON.stringify({ r, posts: p.posts }));
    dit(ho.length === 1 && hp.length === 1 && ro.length === 1 && lp.length === 2 && [ho, hp].every((x) => x[0][1] >= 250 && x[0][1] <= 900) && ro[0][1] >= 400 && ro[0][1] <= 1400, 'G4 hésitation avant « Faire une offre » et « Proposer », la fenêtre regardée, le prix tapé lettre à lettre', JSON.stringify({ ho, hp, ro, lp }));
  } catch (e) { dit(false, 'G4 — exception', e && e.stack); }
  // G5 — jamais deux fois de suite le même temps d'hésitation (sur 40 gestes).
  try {
    const p = page(); const vus = [];
    for (let i = 0; i < 20; i++) { p.champ.value = ''; await p.F('message', { conv: '301', texte: 'Ok ' + i, favori: true }); }
    for (const x of p.delais(/^hesite:/)) vus.push(x[1]);
    dit(vus.length === 20 && vus.every((v, i) => i === 0 || Math.round(v / 10) !== Math.round(vus[i - 1] / 10)) && new Set(vus).size > 12, 'G5 jamais deux fois de suite le même temps d’hésitation', JSON.stringify(vus));
  } catch (e) { dit(false, 'G5 — exception', e && e.stack); }
  // G6 — une vérification apparaît pendant la frappe : arrêt, rien n'est parti.
  try {
    const p = page({ captchaApres: 12 });
    const r = await p.F('message', { conv: '301', texte: TEXTE, favori: true });
    dit(r && r.ok === false && r.code === 'captcha' && !r.parti && p.posts.length === 0, 'G6 captcha pendant la frappe : arrêt, rien n’est parti', JSON.stringify({ r, posts: p.posts.length }));
  } catch (e) { dit(false, 'G6 — exception', e && e.stack); }
  // G7 — rien de maquillé.
  const form = fs.readFileSync(FORM, 'utf8').replace(/\/\/[^\n]*/g, '');
  dit(!/isTrusted\s*[:=]|defineProperty\([^)]*isTrusted/.test(form) && !/new MouseEvent|new PointerEvent|chrome\.debugger/.test(form), 'G7 aucun isTrusted maquillé, aucune souris inventée, aucun débogueur');
  console.log(`\n${ko ? '❌' : '✅'} audit-favoris-gestes-humains : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
