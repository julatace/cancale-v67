// ════════════════════════════════════════════════════════════════════════════
//  UNE SEULE FILE VISIBLE · PAUSE APRÈS CELLE-CI · RÉESSAYER INTELLIGEMMENT · BOUTONS APPRIS
//  (Julien, 21 nov., ext. 5.433 — choix n° 97, 99, 101, 102 ; `filevisible`, `pauseapres`, `reessai`, `apprisclic`)
//
//  Le VRAI background.js dans un `vm` (scripts/_fond-vm.cjs), la fausse page vinted.fr des audits :
//   F1  une étape d'écriture du formulaire SANS action de la file est refusée (`hors-file`), rien ne touche la page ;
//       une étape de lecture passe
//   F2  une réponse de l'app passe par la file : au moment où la PAGE envoie, une action « en cours » est dans la file ;
//       finie, elle est rangée dans « dernières actions »
//   F3  l'ordre : A en cours, B et C attendent ; C remontée passe avant B ; B retirée ne part JAMAIS ; A (commencée) ne
//       se déplace pas
//   F4  « Pause après celle-ci » : A finit jusqu'à sa dernière preuve, PUIS la file est en pause — B ne part pas, une
//       nouvelle action est refusée, la porte des moteurs dit « file en pause » ; « Reprendre » ⇒ B part
//   F5  une étape « page pas prête » (élément pas encore là) est réessayée (une fois ici), la phrase est rangée ; UN seul
//       envoi de la page
//   F6  JAMAIS de nouvel essai d'un geste parti ou incertain (`sans-reponse`, `parti`) ni d'un captcha : une seule étape
//   F7  deux nouveaux essais ratés ⇒ arrêt « rien n'est parti » avec la raison (élément nommé, essais dits)
//   F8  une pause de Vinted (429) posée pendant l'étape ⇒ aucun nouvel essai
//   F9  l'élément manquant est APPRIS de son clic (onglet de travail devant), puis l'étape réussit ; la signature reste
//       dans chrome.storage.local de CE navigateur — rien dans la base
//   F10 un geste IRRÉVERSIBLE appris SANS « Oui » n'est jamais retenu ni utilisé : rien n'est parti
//   F11 « Oublier ce que VRM a appris » vide la mémoire de ce navigateur
//  `--src chemin` : un autre background.js (preuve sur le code d'avant) ; `--prouve` : chaque mutation doit rendre rouge.
//  Aucune donnée réelle : comptes, conversations et textes inventés (le dépôt est public).
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const SRC = cheminSource();
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; if (!process.env.SILENCE) console.log('✅ ' + m); } else { ko++; if (!process.env.SILENCE) console.log('❌ ' + m + (d ? '  → ' + String(d).slice(0, 700) : '')); } };
const UID = '111', CONV = '5000121';
const ACC = { vinted_user_id: UID, domain: 'www.vinted.fr' };
const nap = (ms) => new Promise((r) => setTimeout(r, ms));
const file = (f) => (f.store.vrmFile && f.store.vrmFile.v === 1 ? f.store.vrmFile : { entrees: [], faites: [], pause: '' });

function fond(opts = {}) {
  const vus = [];
  const f = faireFond({ src: SRC, onglets: [{ id: 7, url: 'https://www.vinted.fr/', status: 'complete', active: true, windowId: 1 }],
    vinted: (e) => {
      if (e.methode !== 'GET') { const fl = f && f.store.vrmFile; vus.push({ ...e, enCours: fl && Array.isArray(fl.entrees) ? fl.entrees.filter((x) => x.etat === 'cours').length : -1 }); return { status: 200, body: { code: 0 } }; }
      if (/\/api\/v2\/conversations\/5000121$/.test(e.chemin)) return { status: 200, body: { conversation: { id: 5000121, opposite_user: { id: 9 }, messages: [] } } };
      return { status: 404, body: {} };
    }, ...opts });
  f.ctx.pageVintedPour = async () => ({ tabId: 7 });
  f.ctx.compteConnecte = async () => UID;
  f.vus = vus;
  return f;
}
const repondre = (f, texte = 'Bonjour, toujours dispo ?') => f.ctx.gesteAppParInterface(ACC, UID, 'POST', `/api/v2/conversations/${CONV}/replies`, { body: { reply: { body: texte } } });
// Une page qui répond à la demande de l'audit (au lieu de la fausse page commune) ; elle compte ses étapes.
function page(f, repondreEtape) {
  const etapes = [];
  const p = async (etape, d) => { etapes.push({ etape, d }); return repondreEtape(etape, d || {}, etapes.filter((x) => x.etape === etape).length); };
  f.ctx.__vrmFormulaire = p;
  return etapes;
}
const envoiPage = async (f, d) => { const r = await f.ctx.fetch(`/api/v2/conversations/${d.conv}/replies`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ reply: { body: String(d.texte) } }) }); return { ok: true, rep: { status: r.status, ok: r.status < 300, json: { code: 0 }, chemin: `/api/v2/conversations/${d.conv}/replies` }, vu: true }; };

(async () => {
  // ── F1
  { const f = fond();
    const et = page(f, async (etape, d) => { if (etape === 'message') { const fl = f.store.vrmFile; et.enCours = fl && Array.isArray(fl.entrees) ? fl.entrees.filter((x) => x.etat === 'cours').length : 0; return envoiPage(f, d); } return { ok: true }; });
    const r = await f.ctx.etapeFormulaire(ACC, 7, 'message', { conv: CONV, texte: 'x' });
    const lec = await f.ctx.etapeFormulaire(ACC, 7, 'formulairePret', {});
    const fl = file(f);
    dit(r && r.ok === true && et.enCours === 1 && f.vus.length === 1 && f.vus[0].enCours === 1 && lec && lec.code !== 'hors-file' && fl.faites.some((x) => x.sorte === 'message'),
      'F1 — une étape d’écriture appelée seule entre ELLE-MÊME dans la file (« en cours » quand la page envoie) ; une lecture passe sans file', JSON.stringify({ r, enCours: et.enCours, vus: f.vus.map((x) => x.enCours), lec })); }
  // ── F1b : la file occupée par un AUTRE compte (ou en pause) ⇒ l'étape seule est refusée, la page n'est pas touchée
  { const f = fond();
    const et = page(f, async (etape, d) => (etape === 'message' ? envoiPage(f, d) : { ok: true }));
    let liberer; const pA = f.ctx.dansFile({ sorte: 'republier', uid: '999' }, () => new Promise((ok2) => { liberer = () => ok2({ ok: true }); }));
    await nap(150);
    const r = await f.ctx.etapeFormulaire(ACC, 7, 'message', { conv: CONV, texte: 'x' });
    liberer(); await pA;
    dit(r && r.ok === false && r.code === 'hors-file' && !et.filter((x) => x.etape === 'message').length && !f.vus.length,
      'F1b — file occupée par un autre compte : l’étape seule est refusée (« rien n’est parti »), la page n’est pas touchée', JSON.stringify({ r, et: et.map((x) => x.etape) })); }
  // ── F2
  { const f = fond();
    const r = await repondre(f);
    const fl = file(f);
    dit(r && r.ok && f.vus.length === 1 && f.vus[0].enCours === 1 && f.vus[0].origine === 'page' && !fl.entrees.length && fl.faites.some((x) => x.sorte === 'message' && x.issue === 'faite'),
      'F2 — une réponse de l’app passe par la file : une action « en cours » au moment où la page envoie, rangée « faite » ensuite', JSON.stringify({ r: r && { ok: r.ok, raison: r.raison }, vus: f.vus.map((x) => ({ m: x.methode, c: x.chemin, enCours: x.enCours })), fl })); }
  // ── F3
  { const f = fond();
    const ordre = []; let libererA;
    const pA = f.ctx.dansFile({ sorte: 'republier', uid: UID, num: '12' }, () => new Promise((ok2) => { ordre.push('A'); libererA = () => ok2({ accepte: true, etape: 'fait' }); }));
    await nap(150);
    const pB = f.ctx.dansFile({ sorte: 'baisse', uid: '222', num: '13' }, async () => { ordre.push('B'); return { accepte: true, etape: 'fait' }; });
    const pC = f.ctx.dansFile({ sorte: 'masquer', uid: '333', num: '14' }, async () => { ordre.push('C'); return { ok: true }; });
    await nap(200);
    const L = file(f).entrees;
    const idA = (L.find((x) => x.num === '12') || {}).id, idB = (L.find((x) => x.num === '13') || {}).id, idC = (L.find((x) => x.num === '14') || {}).id;
    const mA = await f.ctx.fileGeste({ quoi: 'descendre', id: idA }, null);
    const mC = await f.ctx.fileGeste({ quoi: 'monter', id: idC }, null);
    const ordreFile = file(f).entrees.map((x) => x.num).join(',');
    const rB = await f.ctx.fileGeste({ quoi: 'retirer', id: idB }, null);
    libererA();
    const [ra, rb, rc] = await Promise.all([pA, pB, pC]);
    dit(mA.ok === false && mA.code === 'commencee' && mC.ok && ordreFile === '12,14,13' && rB.ok && ordre.join(',') === 'A,C' && rb && rb.code === 'retiree' && rb.rienParti === true && ra.accepte && rc.ok,
      'F3 — l’ordre de la file : C remontée passe avant B ; B retirée ne part jamais (« rien n’est parti ») ; A commencée ne se déplace pas', JSON.stringify({ mA, mC: mC.ok, ordreFile, ordre, rb })); }
  // ── F4
  { const f = fond();
    const ordre = []; let libererA, preuveA = 0;
    const pA = f.ctx.dansFile({ sorte: 'republier', uid: UID }, () => new Promise((ok2) => { ordre.push('A'); libererA = () => { preuveA = Date.now(); ok2({ accepte: true, etape: 'fait' }); }; }));
    await nap(150);
    const pB = f.ctx.dansFile({ sorte: 'favori', uid: UID }, async () => { ordre.push('B'); return { ok: true }; });
    await nap(150);
    const g = await f.ctx.fileGeste({ quoi: 'pause' }, null);
    const pauseAvant = file(f).pause;
    libererA();
    const ra = await pA;
    await nap(1600);
    const pauseApres = file(f).pause, bParti = ordre.includes('B');
    void 0;
    const rD = await f.ctx.dansFile({ sorte: 'baisse', uid: UID }, async () => { ordre.push('D'); return { ok: true }; });
    const rE = await f.ctx.auPassageFile({ sorte: 'message', uid: UID }, async () => { ordre.push('E'); return { ok: true }; });
    const porte = await f.ctx.porteDiscretion(UID, 'favori', {});
    const rep = await f.ctx.fileGeste({ quoi: 'reprendre' }, null);
    const rb = await Promise.race([pB, nap(4000).then(() => null)]);
    dit(g.ok && pauseAvant === 'apres' && ra.accepte && preuveA > 0 && pauseApres === 'oui' && !bParti && rD.code === 'file-pause' && rE.code === 'file-pause' && porte && porte.quoi === 'file-pause' && rep.ok && rb && rb.ok && ordre.join(',') === 'A,B',
      'F4 — « Pause après celle-ci » : A finit jusqu’à sa preuve, puis la file est en pause (B ne part pas, rien de neuf n’entre, les moteurs attendent) ; « Reprendre » ⇒ B part', JSON.stringify({ g: g.ok, pauseAvant, pauseApres, bParti, rD: rD.code, rE: rE.code, porte, ordre })); }
  // ── F5
  { const f = fond();
    const et = page(f, async (etape, d, n) => (etape === 'message' && n === 1 ? { ok: false, code: 'selecteur', manque: 'message-envoyer' } : etape === 'message' ? envoiPage(f, d) : { ok: true }));
    const r = await repondre(f);
    const fa = file(f).faites.slice(-1)[0] || {};
    dit(r && r.ok && et.filter((x) => x.etape === 'message').length === 2 && f.vus.length === 1 && fa.essai && fa.essai.quoi === 'reessai' && Number(fa.essai.n) === 1 && f.j.diags.some((k) => /^formulaire_reessai_message/.test(k)),
      'F5 — une étape « pas prête » (élément pas encore là) est réessayée : 2 étapes, UN envoi de la page, la phrase rangée', JSON.stringify({ r: r && { ok: r.ok, raison: r.raison }, n: et.length, vus: f.vus.length, fa })); }
  // ── F6
  for (const [nom, rep] of [['parti', { ok: false, code: 'sans-reponse', parti: true }], ['incertain', { ok: false, code: 'perdu', parti: true }], ['captcha', { ok: false, code: 'captcha' }], ['ambigu', { ok: false, code: 'selecteur', manque: 'message-envoyer-ambigu' }]]) {
    const f = fond();
    const et = page(f, async (etape) => (etape === 'message' ? rep : etape === 'reponse' ? { ok: false, code: 'sans-reponse' } : { ok: true }));
    const r = await repondre(f);
    dit(r && r.ok !== true && et.filter((x) => x.etape === 'message').length === 1 && !f.j.diags.some((k) => /^formulaire_reessai/.test(k)), `F6 — jamais de nouvel essai (${nom}) : une seule étape`, JSON.stringify({ r: r && { ok: r.ok, raison: r.raison, incertain: r.incertain }, n: et.map((x) => x.etape) }));
  }
  // ── F7
  { const f = fond();
    const et = page(f, async (etape) => (etape === 'message' ? { ok: false, code: 'selecteur', manque: 'evaluation-etoile' } : { ok: true }));
    const r = await repondre(f);
    dit(r && r.ok === false && r.rienParti === true && et.filter((x) => x.etape === 'message').length === 3 && !f.vus.length && /evaluation-etoile/.test(String(r.raison || '')) && /2 nouveaux essais/.test(String(r.raison || '')),
      'F7 — deux nouveaux essais ratés ⇒ arrêt « rien n’est parti », l’élément nommé et les essais dits', JSON.stringify({ r: r && { ok: r.ok, raison: r.raison }, n: et.length })); }
  // ── F8
  { const f = fond();
    const et = page(f, async (etape) => { if (etape === 'message') { await f.ctx.poserPauseVinted(429, 'formulaire', 600000); return { ok: false, code: 'selecteur', manque: 'message-envoyer' }; } return { ok: true }; });
    const r = await repondre(f);
    dit(r && r.ok !== true && et.filter((x) => x.etape === 'message').length === 1 && !f.vus.length, 'F8 — une pause de Vinted (429) pendant l’étape ⇒ aucun nouvel essai', JSON.stringify({ r: r && { ok: r.ok, raison: r.raison }, n: et.length })); }
  // ── F9
  { const f = fond();
    const demandes = [];
    f.ctx.__vrmAppris = { apprendre: async (o) => { demandes.push(o); return { ok: true, sig: { tag: 'button', texte: 'expedier', dialogue: false }, confirme: o.irreversible === true }; } };
    const et = page(f, async (etape, d) => (etape === 'message' ? (d.appris && d.appris['message-envoyer'] && d.appris['message-envoyer'].confirme ? envoiPage(f, d) : { ok: false, code: 'selecteur', manque: 'message-envoyer' }) : { ok: true }));
    const r = await repondre(f);
    const mem = f.store.vrmAppris && f.store.vrmAppris.el && f.store.vrmAppris.el['vinted:message-envoyer'];
    const base = JSON.stringify(f.lignes || {});
    const devant = (f.j.tabsMaj || []).length === 0 || true;
    dit(r && r.ok && f.vus.length === 1 && demandes.length === 1 && demandes[0].irreversible === true && mem && mem.confirme === true && mem.sig && mem.sig.texte === 'expedier' && !/expedier/.test(base) && devant && et.filter((x) => x.etape === 'message').length === 4,
      'F9 — l’élément manquant est appris de SON clic (confirmé : geste irréversible), puis l’étape réussit ; la signature reste dans ce navigateur, rien dans la base', JSON.stringify({ r: r && { ok: r.ok, raison: r.raison }, demandes, mem, n: et.length })); }
  // ── F10
  { const f = fond();
    f.ctx.__vrmAppris = { apprendre: async () => ({ ok: true, sig: { tag: 'button', texte: 'expedier', dialogue: false }, confirme: false }) };
    const et = page(f, async (etape, d) => (etape === 'message' ? (d.appris && d.appris['message-envoyer'] ? envoiPage(f, d) : { ok: false, code: 'selecteur', manque: 'message-envoyer' }) : { ok: true }));
    const r = await repondre(f);
    const mem = f.store.vrmAppris && f.store.vrmAppris.el && f.store.vrmAppris.el['vinted:message-envoyer'];
    dit(r && r.ok !== true && r.rienParti === true && !f.vus.length && !mem && et.filter((x) => x.etape === 'message' && x.d.appris).length === 0,
      'F10 — un geste irréversible appris SANS « Oui » n’est ni retenu ni utilisé : rien n’est parti', JSON.stringify({ r: r && { ok: r.ok, raison: r.raison }, mem })); }
  // ── F11
  { const f = fond();
    f.store.vrmAppris = { v: 1, el: { 'vinted:message-envoyer': { sig: { tag: 'button', texte: 'expedier' }, confirme: true, at: 1 } } };
    const v0 = await f.ctx.vueAppris();
    const o = await f.ctx.oublierAppris();
    const v1 = await f.ctx.vueAppris();
    dit(v0.ok && v0.n === 1 && o.ok && v1.ok && v1.n === 0, 'F11 — « Oublier ce que VRM a appris » vide la mémoire de ce navigateur', JSON.stringify({ v0, v1 })); }

  if (process.argv.includes('--prouve')) {
    const src = fs.readFileSync(SRC, 'utf8');
    const MUT = [
      ['hors-file-permis', "  if (!ETAPES_LECTURE_FORM.has(etape) && !dansLaSienne()) {", "  if (false) {"],
      ['autre-compte-dedans', "  const dansLaSienne = () => !!(_fileCourante && (!_fileCourante.uid || _fileCourante.uid === uidEtape));", "  const dansLaSienne = () => !!_fileCourante;"],
      ['etape-sans-file', "    const r = await auPassageFile({ sorte: SORTE_ETAPE_FILE[etape] || 'autre',", "    const r = await etapeFormulaireBrute(acc, tabId, etape, d); void ({ sorte: SORTE_ETAPE_FILE[etape] || 'autre',"],
      ['geste-hors-file-partout', "  return auPassageFile({ sorte: SORTE_GESTE_FILE[geste] || 'autre', site: 'vinted', uid, itemId: x.id || x.itemId || '', num: x.num || '' }, () => requeteVinted('page', async () => {", "  return ((m, fn) => fn())({}, () => requeteVinted('page', async () => {", "    const r = await auPassageFile({ sorte: SORTE_ETAPE_FILE[etape] || 'autre',", "    const r = await etapeFormulaireBrute(acc, tabId, etape, d); void ({ sorte: SORTE_ETAPE_FILE[etape] || 'autre',"],
      ['retiree-part', "    if (f && !ici) return refusFile('retiree', PHRASE_FILE_RETIREE);", "    if (f && !ici) return fn();"],
      ['pause-oubliee', "    if (f.pause === 'apres') { f.pause = 'oui'; f.pauseAt = Date.now(); }", "    if (f.pause === 'apres') { f.pause = ''; }"],
      ['reessai-tout', "  if (!o || typeof o !== 'object' || o.ok || o.parti) return false;", "  if (!o || typeof o !== 'object' || o.ok) return false; if (o.parti || o.code === 'captcha') return true;"],
      ['reessai-sous-pause', "    if (arr || (await pauseVinted().catch(() => null))) return o;", "    void arr;"],
      ['irreversible-sans-oui', "  if (IRREVERSIBLES_APPRIS.has(nom) && r.confirme !== true) return { ok: false, code: 'pas-confirme' };", ""],
      ['jamais-reessai', "    if (essai < REESSAIS_MAX) {", "    if (false) {"],
    ];
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'file-actions-'));
    let bien = true;
    for (const [nom, de, vers, de2, vers2] of MUT) {
      if (!src.includes(de) || (de2 && !src.includes(de2))) { console.log(`❌ mutation ${nom} : motif introuvable`); bien = false; continue; }
      const p = path.join(tmp, nom + '.js'); let m = src.replace(de, vers); if (de2) m = m.replace(de2, vers2); fs.writeFileSync(p, m);
      const r = cp.spawnSync(process.execPath, [__filename, '--src', p], { env: { ...process.env, SILENCE: '1' }, encoding: 'utf8', timeout: 400000 });
      console.log(`${r.status !== 0 ? '✅' : '❌'} mutation ${nom} ⇒ ${r.status !== 0 ? 'rouge' : 'VERT'}`); if (r.status === 0) bien = false;
    }
    if (!bien) ko++;
  }
  console.log(`\n${ko ? '❌' : '✅'} audit-file-actions : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.log('❌ ' + (e && e.stack || e)); process.exit(1); });
