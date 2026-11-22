// ════════════════════════════════════════════════════════════════════════
//  LE FORMULAIRE DE VINTED REMPLI COMME UNE PERSONNE (22 nov., ext. 5.437)
//  1. le VRAI background.js (vm) : `ordreChampsVariable` — l'ordre varie (≥ 10 ordres sur 300 tirages, le titre parfois
//     avant la catégorie), la catégorie TOUJOURS avant taille / marque / couleurs / état / colis / unisexe, les VALEURS
//     identiques (mêmes objets, aucun ajouté ni perdu) ; les trois chemins (republier, fiche, mise en ligne d'un
//     brouillon) l'utilisent ; la description part avec SON mode (« coller » par défaut, « taper » si réglé) ;
//  2. le VRAI vrm-formulaire.js (vm, fausse page minimale) : le titre tapé lettre par lettre à un rythme VARIABLE et borné
//     (45 ms à ~1 s, jamais tous égaux), la valeur exacte ; la description « coller » = UN `paste` puis UN `input`
//     `insertFromPaste`, la valeur exacte, jamais deux fois ; « taper » = des rafales (pauses 0,3–1,5 s), la valeur exacte ;
//  3. rien n'est maquillé : aucun `isTrusted`, aucun `chrome.debugger`, aucun événement de souris inventé.
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const R = path.join(__dirname, '..');
const BG0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : cheminSource();
const F0 = process.env.FORM_SRC ? path.resolve(process.env.FORM_SRC) : path.join(R, 'vinted-sync-extension/vrm-formulaire.js');
const MUTATIONS = {
  categorie: ["const libres = reste.map((c, i) => [c, i]).filter(([[q]]) => catFaite || !APRES_CATEGORIE.has(q));", "const libres = reste.map((c, i) => [c, i]);"],
  fixe: ["const [c, i] = libres[Math.min(libres.length - 1, Math.floor(hasard() * libres.length))];", "const [c, i] = libres[0];"],
  mode: ["const d = quoi === 'description' ? Object.assign({}, d0, { mode: modeD }) : d0;\n    await pauseFormulaire('champ', uid);\n    { const s = await arret();", "const d = d0;\n    await pauseFormulaire('champ', uid);\n    { const s = await arret();"],
  rythme: ["if (R === 'lettres') { const d = delaiLettre(ch); noterDelai('lettre', d); await attenteFrappe(d); }", "if (R === 'lettres') { noterDelai('lettre', 0); }"],
  coller: ["const ok = q === 'description' && d.mode !== 'taper' ? await coller(a.el, v)", "const ok = false ? await coller(a.el, v)"],
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
let BG = BG0, FORM = F0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut];
  for (const [src, k] of [[BG0, 'bg'], [F0, 'form']]) { const s = fs.readFileSync(src, 'utf8'); if (!s.includes(a)) continue; const p = path.join(os.tmpdir(), `fr-${k}-${mut}-${process.pid}.js`); fs.writeFileSync(p, s.split(a).join(b)); if (k === 'bg') BG = p; else FORM = p; }
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + String(d).slice(0, 400) : '')); } };

// Une fausse page minimale : un champ (input / textarea) qui note chaque événement reçu.
function page() {
  const evs = [];
  class Ev { constructor(type, o = {}) { this.type = type; Object.assign(this, o); this.defaultPrevented = false; } preventDefault() { this.defaultPrevented = true; } }
  class InputEvent extends Ev {} class FocusEvent extends Ev {} class ClipboardEvent extends Ev {}
  class DataTransfer { constructor() { this.d = {}; } setData(k, v) { this.d[k] = v; } getData(k) { return this.d[k] || ''; } }
  class HTMLInputElement { constructor(id) { this.id = id; this._v = ''; this.isContentEditable = false; } focus() {} blur() {} dispatchEvent(e) { evs.push({ id: this.id, type: e.type, inputType: e.inputType, data: e.data, v: this._v }); return true; } closest() { return null; } getBoundingClientRect() { return { width: 100, height: 30, top: 0, left: 0, bottom: 30, right: 100 }; } }
  Object.defineProperty(HTMLInputElement.prototype, 'value', { get() { return this._v; }, set(v) { this._v = String(v); }, configurable: true });
  class HTMLTextAreaElement extends HTMLInputElement {}
  const els = { '#title': new HTMLInputElement('titre'), '#description': new HTMLTextAreaElement('description'), '#price': new HTMLInputElement('prix') };
  let t = 0;
  const ctx = {
    console, Math, Date, JSON, Promise, Array, Object, String, Number, RegExp, Set, Map, WeakMap, Error, encodeURIComponent,
    location: { hostname: 'www.vinted.fr', pathname: '/items/new', href: 'https://www.vinted.fr/items/new' },
    performance: { now: () => t },
    MessageChannel: class { constructor() { const self = this; this.port1 = { onmessage: null }; this.port2 = { postMessage() { t += 1; Promise.resolve().then(() => self.port1.onmessage && self.port1.onmessage({})); } }; } },
    setTimeout: (f) => { Promise.resolve().then(f); return 1; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    InputEvent, Event: Ev, FocusEvent, ClipboardEvent, DataTransfer, HTMLInputElement, HTMLTextAreaElement,
    innerWidth: 1000, innerHeight: 800, getComputedStyle: () => ({ display: 'block', visibility: 'visible', opacity: '1' }),
    sessionStorage: { setItem() {}, getItem() { return null; } },
    document: { querySelector: (s) => els[s] || null, querySelectorAll: () => [], body: { innerText: '' } },
  };
  ctx.globalThis = ctx;
  ctx.__vrmDelaisVus = [];
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(FORM, 'utf8'), ctx);
  return { ctx, evs, els };
}

(async () => {
  // 1. L'ordre (le vrai background.js)
  try {
    const f = faireFond({ src: BG });
    const O = f.ctx.ordreChampsVariable;
    if (typeof O !== 'function') dit(false, 'background.js : `ordreChampsVariable` existe');
    else {
      const champs = [['categorie', { id: 1 }], ['titre', { valeur: 'Nike Air Max 90 42' }], ['description', { valeur: 'desc' }], ['marque', { id: 53 }], ['taille', { id: 780 }], ['couleurs', { ids: [12] }], ['colis', { id: 2 }], ['etat', { id: 6 }], ['unisexe', { valeur: true }], ['prix', { valeur: 54 }]];
      const vus = new Set(); let catOk = true, valOk = true, titreAvant = 0;
      for (let i = 0; i < 300; i++) {
        const o = O(champs);
        vus.add(o.map((x) => x[0]).join('>'));
        const ic = o.findIndex((x) => x[0] === 'categorie');
        for (const k of ['taille', 'marque', 'couleurs', 'etat', 'colis', 'unisexe']) if (o.findIndex((x) => x[0] === k) < ic) catOk = false;
        if (o.length !== champs.length || !champs.every((c) => o.filter((x) => x === c).length === 1)) valOk = false;
        if (o.findIndex((x) => x[0] === 'titre') < ic) titreAvant++;
      }
      dit(vus.size >= 10, `l’ordre des champs varie (${vus.size} ordres différents sur 300)`);
      dit(catOk, 'la catégorie est TOUJOURS remplie avant taille, marque, couleurs, état, colis, unisexe');
      dit(valOk, 'les valeurs sont exactement celles de la fiche : mêmes champs, aucun ajouté, aucun perdu, aucun changé');
      dit(titreAvant > 0, 'titre / description / prix peuvent passer avant la catégorie (le formulaire le permet)', titreAvant);
      const sansCat = O([['taille', { id: 1 }], ['etat', { id: 2 }]]);
      dit(sansCat.length === 2, 'sans catégorie à changer (mise en ligne d’un brouillon) : les champs passent quand même');
      dit((await f.ctx.modeDescription()) === 'coller', 'description : « coller » par défaut');
      await f.ctx.poserReglagesCommeBleam({ description: 'taper' });
      dit((await f.ctx.modeDescription()) === 'taper', 'description : « taper » quand il le règle (Paramètres)');
      const bad = await f.ctx.poserReglagesCommeBleam({ description: 'robot' });
      dit(bad && bad.ok === false, 'description : une autre valeur est refusée');
    }
    const s = fs.readFileSync(BG, 'utf8');
    dit((s.match(/of ordreChampsVariable\(/g) || []).length === 3, 'les trois chemins (republier, fiche → Vinted, mise en ligne d’un brouillon) tirent l’ordre');
    dit((s.match(/const d = quoi === 'description' \? Object\.assign\(\{\}, d0, \{ mode: modeD \}\) : d0;/g) || []).length === 2, 'la description part avec SON mode (republier, fiche → Vinted)');
  } catch (e) { dit(false, 'ordre — exception', e && e.stack); }
  // 2. La saisie (le vrai vrm-formulaire.js)
  try {
    const p = page(); const F = p.ctx.__vrmFormulaire;
    const titre = 'Nike Air Max 90, blanche - 42';
    const r1 = await F('champ', { quoi: 'titre', valeur: titre });
    const dl = p.ctx.__vrmDelaisVus.filter((x) => x[0] === 'lettre').map((x) => x[1]);
    dit(r1 && r1.ok && p.els['#title'].value === titre, 'titre : la valeur EXACTE de la fiche', JSON.stringify(r1));
    dit(dl.length === Array.from(titre).length && dl.every((d) => d >= 45 && d <= 1300) && new Set(dl).size > 5, 'titre : tapé lettre par lettre, rythme variable et borné (45 ms à ~1 s)', JSON.stringify(dl.slice(0, 12)));
    const desc = 'Paire portée deux fois, très bon état.\nBoîte d’origine. Envoi soigné sous 48 h.';
    const r2 = await F('champ', { quoi: 'description', valeur: desc });
    const ed = p.evs.filter((e) => e.id === 'description');
    const pastes = ed.filter((e) => e.type === 'paste').length, insP = ed.filter((e) => e.type === 'input' && e.inputType === 'insertFromPaste').length, insT = ed.filter((e) => e.type === 'input' && e.inputType === 'insertText').length;
    dit(r2 && r2.ok && p.els['#description'].value === desc && pastes === 1 && insP === 1 && insT === 0, 'description « coller » (défaut) : UN collage (paste puis input insertFromPaste), la valeur exacte', JSON.stringify({ pastes, insP, insT }));
    const q = page(); const G = q.ctx.__vrmFormulaire;
    const r3 = await G('champ', { quoi: 'description', valeur: desc, mode: 'taper' });
    const raf = q.ctx.__vrmDelaisVus.filter((x) => x[0] === 'rafale').map((x) => x[1]);
    dit(r3 && r3.ok && q.els['#description'].value === desc && raf.length >= 2 && raf.every((d) => d >= 300 && d <= 1500), 'description « taper » : par rafales (pauses 0,3–1,5 s), la valeur exacte', JSON.stringify(raf));
    const r4 = await G('champ', { quoi: 'prix', valeur: 54.5 });
    dit(r4 && r4.ok && q.els['#price'].value === '54,5', 'prix : la valeur exacte (54,5)');
  } catch (e) { dit(false, 'saisie — exception', e && e.stack); }
  // 3. Rien de maquillé
  const form = fs.readFileSync(FORM, 'utf8').replace(/\/\/[^\n]*/g, '');
  const bg = fs.readFileSync(BG, 'utf8').replace(/\/\/[^\n]*/g, '');
  dit(!/isTrusted\s*[:=]|defineProperty\([^)]*isTrusted/.test(form) && !/chrome\.debugger/.test(bg) && !/new MouseEvent|new PointerEvent/.test(form), 'aucun isTrusted maquillé, aucun débogueur (CDP), aucune souris inventée');
  console.log(`\n${ko ? '❌' : '✅'} audit-formulaire-rythme : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
