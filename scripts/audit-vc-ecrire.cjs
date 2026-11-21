// ════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE : ÉCRIRE UN MESSAGE PAR L'INTERFACE DE LA PAGE (21 nov., ext. 5.412.0)
//
//  Julien : « au moins pouvoir lire les messages et écrire aux personnes, sans forcément
//  automatiser » ; puis (21 nov.) « on ne fait plus les requêtes » pour les ÉCRITURES.
//  Ce qui doit rester vrai — le VRAI vc-inject.js et le VRAI vc-ecrire.js dans un VRAI Chromium
//  (une page vestiairecollective.com INVENTÉE : un champ, un bouton « Envoyer », une messagerie
//  « Stream » servie par le banc), puis le VRAI background.js dans `_fond-vm.cjs` :
//   E1  apprendre : SON envoi à la main (frappes et clic VRAIS) ⇒ le champ et le bouton retenus dans
//       CE navigateur (signature, jamais son texte) ; la base ne reçoit que « appris ».
//   E2  écrire : sur l'ordre du fond, le texte est tapé LETTRE À LETTRE dans le champ de la page, le bouton
//       touché, et « fait » SEULEMENT quand la page a envoyé CE texte dans CETTE conversation.
//   E3  le bon destinataire par identifiant : adresse sans la conversation, page sur une AUTRE
//       conversation, autre compte ⇒ rien n'est tapé.
//   E4  rien d'ambigu : deux champs, un champ déjà rempli ⇒ rien n'est tapé.
//   E5  la page n'envoie pas ⇒ « pas vu », jamais « fait ».
//   E6  une vérification VISIBLE (captcha) ⇒ arrêt, rien n'est tapé.
//   E7  plus aucune requête d'écriture apprise pour être rejouée (vc-inject ne note plus de recette).
//   F1-F9 le fond : pas appris ⇒ rien ; conversation pas ouverte dans l'onglet ⇒ « ouvrir » (rien tapé,
//       aucune place prise, l'onglet n'est JAMAIS mené ailleurs) ; compte du fil ≠ onglet ⇒ rien ; pause ;
//       plafond ; « fait » ⇒ fil + journal + une place ; arrêté avant ⇒ place rendue ; pas vu ⇒ incertain ;
//       vérification ⇒ pause posée ; l'ordre envoyé est l'INTERFACE (`vcEcrireUI`), jamais une requête.
//   P1-P3 le panneau : le fil et les personnes qui ont aimé, du compte de L'ONGLET seulement, sans nom.
//  Tout est INVENTÉ (le dépôt est public). `--prouve` : chaque règle réaffaiblie doit faire rougir l'audit.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const racine = path.join(__dirname, '..');
const arg = (n, d) => { const i = process.argv.indexOf(n); return i > 0 ? path.resolve(process.argv[i + 1]) : d; };
const F = {
  src: arg('--src', path.join(racine, 'vinted-sync-extension/background.js')),
  inject: arg('--inject', path.join(racine, 'vinted-sync-extension/vc-inject.js')),
  ecrire: arg('--ecrire', path.join(racine, 'vinted-sync-extension/vc-ecrire.js')),
};

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['sansConversation', 'ecrire', "if (co.conv !== conv) return { ok: true, statut: 0, erreur: 'autre-conversation' };", ''],
    ['sansAdresse', 'ecrire', "if (!String(location.href).includes(conv)) return { ok: true, statut: 0, erreur: 'pas-ouverte' };", ''],
    ['sansCompte', 'ecrire', "if (msg.compte && co.moi && String(msg.compte) !== co.moi) return { ok: true, statut: 0, erreur: 'autre-compte' };", ''],
    ['champPlein', 'ecrire', "if (contenu(champ)) return { ok: true, statut: 0, erreur: 'champ-pas-vide' };", ''],
    ['ambigu', 'ecrire', "return { el: liste.length === 1 ? liste[0] : null, n: liste.length };", 'return { el: liste[0] || null, n: liste.length };'],
    ['faitSansVu', 'ecrire', "const r = await Promise.race([vu.then(() => true), attendre(15000).then(() => false)]);", 'const r = true;'],
    ['sansCaptcha', 'ecrire', "if (verificationVisible()) return { ok: true, statut: 0, erreur: 'verification', defi: true };\n      // 1.", '// 1.'],
    ['toutDunCoup', 'ecrire', "for (const ch of [...texte]) {", 'for (const ch of [texte]) {'],
    ['apprendTexte', 'ecrire', "const ui = { champ, envoi, at:", "const ui = { texte: contenu(dernierChamp), champ, envoi, at:"],
    ['recetteRequete', 'inject', 'const RECETTES_REQUETE = false;', 'const RECETTES_REQUETE = true;'],
    ['fondOuvrir', 'src', "if (!tab || !String(tab.url || '').includes(conv)) return { accepte: false, code: 'ouvrir',", "if (false) return { accepte: false, code: 'ouvrir',"],
    ['apprendSansAdresse', 'ecrire', "page: location.pathname.replace(/\\d{3,}/g, '{id}').slice(0, 80), adresse: adresseDe(conv) };", "page: location.pathname.replace(/\\d{3,}/g, '{id}').slice(0, 80), adresse: null };"],
    ['fondSansConv', 'src', "    if (ui.adresse && ui.adresse.sansConv === true) return { accepte: false, code: 'adresse-sans-conv', raison: RAISONS_UI_VC['adresse-sans-conv'] };\n", ''],
    ['fondModeleIgnore', 'src', "  if (m && MODELE_CONV_VC.test(m) && m.split('{conv}').length === 2) return", "  if (false) return"],
    ['fondAppris', 'src', "if (!ui || !ui.champ || !ui.envoi) return { accepte: false, code: 'pas-appris', raison: RAISONS_UI_VC['pas-appris'] };", ''],
    ['fondPasVuFait', 'src', "if (rep.confirme === true) {\n      await rangerVcFil", "if (rep.confirme === true || rep.envoye === true) {\n      await rangerVcFil"],
    ['fondPlafond', 'src', "const cpt = await compterAction('vc:' + o.compte, ACTIONS_MAX_HEURE);\n    if (!cpt.ok && cpt.code === 'stockage') return { accepte: false, code: 'stockage', raison: RAISON_STOCKAGE };\n    if (!cpt.ok) return { accepte: false, code: 'plafond',", "const cpt = { ok: true, at: Date.now() };\n    if (!cpt.ok) return { accepte: false, code: 'plafond',"],
    ['fondRendre', 'src', "    await rendreActions('vc:' + o.compte, depuis, 1);\n    return { accepte: false, code: e || 'arrete',", "    return { accepte: false, code: e || 'arrete',"],
    ['fondPause', 'src', "      await poserPauseVc(403, null);\n      if (!(rep.envoye || rep.tape))", "      if (!(rep.envoye || rep.tape))"],
    ['panneauCompte', 'src', "    if (String(it.compte || '') !== moi) continue;                     // un autre compte : jamais montré ici", ''],
    ['filCompte', 'src', "  if (String((rows[0] && rows[0].compte) || '') !== moi) return { ok: false, code: 'autre-compte', raison: 'Cette conversation n’est pas sur le compte de cet onglet.' };", ''],
  ];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-vc-ecrire-'));
  let tous = true;
  for (const [nom, cle, avant, apres] of MUT) {
    const txt = fs.readFileSync(F[cle], 'utf8');
    if (!txt.includes(avant)) { console.log(`❌ mutation ${nom} : texte introuvable`); tous = false; continue; }
    const fichier = path.join(tmp, nom + '-' + path.basename(F[cle]));
    fs.writeFileSync(fichier, txt.replace(avant, apres));
    const args = [__filename, '--' + cle, fichier];
    for (const k of Object.keys(F)) if (k !== cle) args.push('--' + k, F[k]);
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 600000 });
    const rouges = ((r.stdout || '').match(/^❌/gm) || []).length;
    const ok = r.status !== 0 && rouges > 0;
    if (!ok) tous = false;
    console.log(`${ok ? '✅' : '❌'} mutation « ${nom} » ⇒ ${rouges} contrôle(s) rouge(s)${ok ? '' : ' — LA RÈGLE N’EST PAS PROTÉGÉE'}`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(tous ? '\n✅ chaque règle réaffaiblie fait rougir l’audit' : '\n❌ une mutation passe inaperçue');
  process.exit(tous ? 0 : 1);
}

let ko = 0;
const dit = (ok, nom, det) => { if (!ok) ko++; console.log(`${ok ? '✅' : '❌'} ${nom}${ok || !det ? '' : ' — ' + det}`); };
const ORIGINE = 'https://fr.vestiairecollective.com';
const STREAM = 'https://chat.stream-io-api.com';
const MOI = '11112222', ACH = '33334444', ART = '66668888', CONV = `${ACH}-${ART}`, AUTRE = '55557777-99990000';
const SECRET_TEXTE = 'Bonjour, je peux envoyer lundi 😊';

// La page INVENTÉE : un champ, un bouton, la messagerie de la page (comme Stream : `user_id` dans l'adresse).
const PAGE = (o) => `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="fil"></div>
<textarea data-testid="chat-input" rows="3" style="width:300px;height:60px">${o.plein ? 'brouillon à lui' : ''}</textarea>
${o.deux ? '<textarea data-testid="chat-input" rows="3" style="width:300px;height:60px"></textarea>' : ''}
<button type="button" data-testid="send-message" style="width:90px;height:40px">Envoyer</button>
<button type="button" style="width:90px;height:40px">Annuler</button>
${o.captcha ? '<iframe src="https://geo.captcha-delivery.com/captcha/?x=1" style="width:400px;height:300px"></iframe>' : ''}
<script>
  const q = new URLSearchParams(location.search);
  const conv = q.get('id') || ${JSON.stringify(o.convPage || '')};
  const ouverte = ${JSON.stringify(o.ouverte || '')} || conv;
  window.__frappes = 0;
  document.addEventListener('input', () => { window.__frappes++; }, true);
  window.__envoyes = [];
  const base = '${STREAM}/channels/messaging/';
  const qs = '?user_id=${o.moi || MOI}&connection_id=c-1&api_key=cle-banc';
  if (ouverte) fetch(base + ouverte + '/query' + qs, { method: 'POST', body: '{}' });
  document.querySelector('[data-testid="send-message"]').addEventListener('click', () => {
    const t = document.querySelector('textarea').value;
    if (${o.muet ? 'true' : 'false'} || !t.trim()) return;
    window.__envoyes.push(t);
    fetch(base + conv + '/message' + qs, { method: 'POST', body: JSON.stringify({ message: { id: '${MOI}-a1b2c3d4-e5f6', text: t, mentioned_users: [] } }) });
    document.querySelector('textarea').value = '';
  });
</script></body></html>`;

let chromium;
try { ({ chromium } = require('playwright')); } catch (_) { ({ chromium } = require(path.join(racine, 'node_modules', 'playwright'))); }
const INJ = fs.readFileSync(F.inject, 'utf8');
const ECR = fs.readFileSync(F.ecrire, 'utf8');
// `chrome.*` minimal du monde isolé (le banc tient vc-ecrire.js dans la page : la DOM est la même).
const CHROME = `window.__envois = []; window.__store = window.__store || {}; window.__ecoutes = [];
window.chrome = { runtime: { id: 'x', lastError: null, sendMessage: (m, cb) => { window.__envois.push(JSON.parse(JSON.stringify(m))); if (cb) cb({ ok: true }); }, onMessage: { addListener: (f) => window.__ecoutes.push(f) } },
  storage: { local: { get: async (k) => { const o = {}; for (const c of [].concat(k)) if (window.__store[c] !== undefined) o[c] = JSON.parse(JSON.stringify(window.__store[c])); return o; }, set: async (o) => { Object.assign(window.__store, JSON.parse(JSON.stringify(o))); } } } };
window.__ordre = (msg) => new Promise((res) => { let rendu = false; for (const f of window.__ecoutes) { const r = f(msg, { id: 'x' }, (x) => { rendu = true; res(x); }); if (r === true) return; } if (!rendu) res(undefined); });`;

async function page(b, o = {}) {
  const ctx = await b.newContext({ viewport: { width: 900, height: 700 } });
  const pg = await ctx.newPage();
  const envoisStream = [];
  await pg.route(`${STREAM}/**`, async (r) => {
    const u = r.request().url();
    const corps = r.request().postData() || '';
    if (/\/message\?/.test(u)) {
      let t = ''; try { t = JSON.parse(corps).message.text; } catch (_) {}
      envoisStream.push({ u, t });
      return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ message: { id: `${MOI}-a1b2c3d4-e5f6`, text: t, type: 'regular', user: { id: o.moi || MOI, name: 'Julien Testeur' }, created_at: '2026-11-21T10:00:00Z' }, duration: '2ms' }) });
    }
    const conv = /channels\/messaging\/([\w-]+)\/query/.exec(u);
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ channel: { id: conv ? conv[1] : 'x', type: 'messaging', cid: 'messaging:' + (conv ? conv[1] : 'x') }, messages: [], read: [] }) });
  });
  await pg.route(`${ORIGINE}/**`, (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: PAGE(o) }));
  await pg.addInitScript({ content: `window.__store = ${JSON.stringify(o.store || {})};` });
  await pg.addInitScript({ content: INJ });
  await pg.goto(`${ORIGINE}/chat${o.sansId ? '' : '?id=' + CONV}`);
  await pg.evaluate(CHROME + '\n' + ECR);
  await pg.waitForTimeout(150);
  return { ctx, pg, envoisStream };
}

let uiAppris = null;
async function navigateur() {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  try {
    // E1 — apprendre de SON envoi (frappes et clic VRAIS : isTrusted).
    {
      const { ctx, pg, envoisStream } = await page(b);
      await pg.click('textarea'); await pg.keyboard.type('Merci !'); await pg.click('[data-testid="send-message"]');
      await pg.waitForTimeout(400);
      const st = await pg.evaluate('window.__store'); const env = await pg.evaluate('window.__envois');
      uiAppris = st.vrmVcUi || null;
      dit(envoisStream.length === 1 && !!uiAppris && uiAppris.champ && uiAppris.champ.tag === 'textarea' && uiAppris.champ.attrs['data-testid'] === 'chat-input' && uiAppris.envoi.mode === 'bouton' && uiAppris.envoi.attrs['data-testid'] === 'send-message',
        'E1 · SON envoi à la main ⇒ le champ et le bouton sont retenus (signature : balise, attributs stables)', JSON.stringify(uiAppris));
      dit(!JSON.stringify(st).includes('Merci') && !JSON.stringify(env).includes('Merci'), 'E1 · son TEXTE n’est retenu nulle part (ni la signature, ni ce qui part au fond)', JSON.stringify(env));
      dit(env.some((m) => m.action === 'vcUiAppris' && m.mode === 'bouton' && m.conv === CONV), 'E1 · le fond est prévenu (« appris », le mode), rien d’autre', JSON.stringify(env));
      dit(uiAppris && uiAppris.adresse && uiAppris.adresse.modele === '/chat?id={conv}' && env.some((m) => m.action === 'vcUiAppris' && m.adresse === 'oui'), 'E1 · l’ADRESSE d’une conversation est apprise du même geste (`/chat?id={conv}`, jamais devinée) ; le fond ne reçoit qu’un mot', JSON.stringify(uiAppris && uiAppris.adresse));
      await ctx.close();
    }
    // E1b — la page ne met pas la conversation dans son adresse : appris tel quel (« sans »).
    {
      const { ctx, pg } = await page(b, { sansId: true, convPage: CONV, ouverte: CONV });
      await pg.click('textarea'); await pg.keyboard.type('Merci !'); await pg.click('[data-testid="send-message"]');
      await pg.waitForTimeout(400);
      const st = await pg.evaluate('window.__store'); const env = await pg.evaluate('window.__envois');
      const u = st.vrmVcUi || null;
      dit(u && u.adresse && u.adresse.sansConv === true && !u.adresse.modele && env.some((m) => m.action === 'vcUiAppris' && m.adresse === 'sans'), 'E1b · adresse sans la conversation ⇒ apprise « sans » (pas de forme inventée)', JSON.stringify(u && u.adresse));
      await ctx.close();
    }
    const store = { vrmVcUi: uiAppris };
    // E2 — écrire, sur l'ordre du fond.
    {
      const { ctx, pg, envoisStream } = await page(b, { store });
      const r = await pg.evaluate(`window.__ordre({ from: 'vrm-fond', action: 'vcEcrireUI', conv: ${JSON.stringify(CONV)}, texte: ${JSON.stringify(SECRET_TEXTE)}, compte: '${MOI}' })`);
      const fr = await pg.evaluate('window.__frappes');
      dit(r && r.ok === true && r.confirme === true && r.statut === 200, 'E2 · le message part par la page et « fait » SEULEMENT après l’avoir vu partir', JSON.stringify(r));
      dit(envoisStream.length === 1 && envoisStream[0].t === SECRET_TEXTE && envoisStream[0].u.includes(CONV), 'E2 · c’est la PAGE qui a envoyé CE texte dans CETTE conversation (aucune requête de VRM)', JSON.stringify(envoisStream));
      dit(fr >= [...SECRET_TEXTE].length, 'E2 · tapé lettre à lettre (une frappe par caractère)', `frappes ${fr} / ${[...SECRET_TEXTE].length}`);
      await ctx.close();
    }
    // E3 — le bon destinataire.
    for (const [nom, o, att] of [['adresse sans la conversation', { store, sansId: true }, 'pas-ouverte'], ['la page montre une AUTRE conversation', { store, ouverte: AUTRE }, 'autre-conversation'], ['la page est sur un AUTRE compte', { store, moi: '99998888' }, 'autre-compte']]) {
      const { ctx, pg, envoisStream } = await page(b, o);
      const r = await pg.evaluate(`window.__ordre({ from: 'vrm-fond', action: 'vcEcrireUI', conv: ${JSON.stringify(CONV)}, texte: 'Bonjour', compte: '${MOI}' })`);
      const fr = await pg.evaluate('window.__frappes');
      dit(r && r.erreur === att && !r.confirme && fr === 0 && envoisStream.length === 0, `E3 · ${nom} ⇒ « ${att} », rien n’est tapé`, JSON.stringify({ r, fr, n: envoisStream.length }));
      await ctx.close();
    }
    // E4 — rien d'ambigu.
    for (const [nom, o, att] of [['deux champs de message', { store, deux: true }, 'champ-ambigu'], ['un champ déjà rempli (son brouillon)', { store, plein: true }, 'champ-pas-vide']]) {
      const { ctx, pg, envoisStream } = await page(b, o);
      const r = await pg.evaluate(`window.__ordre({ from: 'vrm-fond', action: 'vcEcrireUI', conv: ${JSON.stringify(CONV)}, texte: 'Bonjour', compte: '${MOI}' })`);
      const fr = await pg.evaluate('window.__frappes');
      dit(r && r.erreur === att && fr === 0 && envoisStream.length === 0, `E4 · ${nom} ⇒ « ${att} », rien n’est tapé`, JSON.stringify({ r, fr }));
      await ctx.close();
    }
    // E5 — la page n'envoie pas.
    {
      const { ctx, pg } = await page(b, { store, muet: true });
      const r = await pg.evaluate(`window.__ordre({ from: 'vrm-fond', action: 'vcEcrireUI', conv: ${JSON.stringify(CONV)}, texte: 'Bonjour', compte: '${MOI}' })`);
      dit(r && r.confirme !== true && r.erreur === 'pas-vu' && r.envoye === true, 'E5 · bouton touché mais rien vu partir ⇒ « pas vu » (jamais « fait »)', JSON.stringify(r));
      await ctx.close();
    }
    // E6 — vérification visible.
    {
      const { ctx, pg } = await page(b, { store, captcha: true });
      const r = await pg.evaluate(`window.__ordre({ from: 'vrm-fond', action: 'vcEcrireUI', conv: ${JSON.stringify(CONV)}, texte: 'Bonjour', compte: '${MOI}' })`);
      const fr = await pg.evaluate('window.__frappes');
      dit(r && r.erreur === 'verification' && r.defi === true && fr === 0, 'E6 · une vérification VISIBLE ⇒ arrêt, rien n’est tapé', JSON.stringify({ r, fr }));
      await ctx.close();
    }
    // E7 — plus de recette de requête.
    {
      const { ctx, pg } = await page(b);
      await pg.evaluate(`window.__tout = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_VC') window.__tout.push(d); });`);
      await pg.click('textarea'); await pg.keyboard.type('Oui'); await pg.click('[data-testid="send-message"]');
      await pg.waitForTimeout(400);
      const tout = await pg.evaluate('window.__tout');
      dit(!tout.some((d) => d.kind === 'vcenvoiappris') && tout.some((d) => d.kind === 'vcenvoivu' && d.conv === CONV), 'E7 · un envoi de la page n’est plus appris comme REQUÊTE à rejouer (seulement « vu », pour la vérification)', JSON.stringify(tout.map((d) => d.kind)));
      await ctx.close();
    }
  } finally { await b.close(); }
}

const VC_ONGLETS = 'vrmVcOnglets';
function fond({ ui = true, url = `${ORIGINE}/chat?id=${CONV}`, compteOnglet = MOI, compteFil = MOI, rep = { ok: true, statut: 200, confirme: true }, store = {}, lignes = {} } = {}) {
  const f = faireFond({ src: F.src, onglets: [{ id: 41, url, active: true, status: 'complete' }],
    store: Object.assign({ [VC_ONGLETS]: { '41': { compte: compteOnglet, at: Date.now() } }, ...(ui ? { vrmVcUi: uiAppris || { champ: { tag: 'textarea', ce: false, attrs: { 'data-testid': 'chat-input' } }, envoi: { mode: 'bouton', tag: 'button', ce: false, attrs: { 'data-testid': 'send-message' }, mot: 'Envoyer' } } } : {}) }, store),
    lignes: Object.assign({ [`vc_fil_${CONV}`]: { conv: CONV, compte: compteFil, messages: [{ id: 'm-1', t: 'Toujours dispo ?', deMoi: false, at: '2026-11-21T09:00:00Z' }], n: 1 } }, lignes) });
  const ordres = [];
  f.ctx.chrome.tabs.sendMessage = (id, m, o, cb) => { if (m && m.__vmrEvt) { const fn0 = [o, cb].find((x) => typeof x === "function"); if (fn0) fn0(); return Promise.resolve(); } ordres.push({ id, m: JSON.parse(JSON.stringify(m)) }); const r = typeof rep === 'function' ? rep(m) : rep; const fn = [o, cb].find((x) => typeof x === 'function'); if (fn) { fn(r); return; } return Promise.resolve(r); };
  return { f, ordres };
}
const nAct = (f) => ((f.store.vrmActions || {})['vc:' + MOI] || []).length;
async function fondAudit() {
  const go = (f, extra = {}) => f.ctx.repondreVestiaire(Object.assign({ conv: CONV, texte: 'Bonjour, lundi ça va ?' }, extra));
  { const { f, ordres } = fond({ ui: false }); const r = await go(f);
    dit(r.accepte === false && r.code === 'pas-appris' && !ordres.length, 'F1 · rien d’appris ⇒ rien ne part (le geste à faire est dit)', JSON.stringify(r)); }
  { const { f, ordres } = fond({ url: `${ORIGINE}/chat?id=${AUTRE}` }); const r = await go(f);
    dit(r.accepte === false && r.code === 'ouvrir' && r.url === `${ORIGINE}/chat?id=${CONV}` && !ordres.length && nAct(f) === 0 && !(f.j.navigations || []).length, 'F2 · conversation pas ouverte dans l’onglet ⇒ « ouvrir » + son adresse ; rien tapé, aucune place prise, l’onglet n’est pas mené ailleurs', JSON.stringify({ r, n: ordres.length, nav: f.j.navigations })); }
  { const uiM = { champ: { tag: 'textarea', ce: false, attrs: { 'data-testid': 'chat-input' } }, envoi: { mode: 'bouton', tag: 'button', ce: false, attrs: { 'data-testid': 'send-message' }, mot: 'Envoyer' }, adresse: { modele: '/messages/{conv}' } };
    const { f, ordres } = fond({ url: `${ORIGINE}/messages`, store: { vrmVcUi: uiM } }); const r = await go(f);
    dit(r.accepte === false && r.code === 'ouvrir' && r.url === `${ORIGINE}/messages/${CONV}` && !ordres.length, 'F2b · « ouvrir » donne l’adresse dans la forme APPRISE (`/messages/{conv}`)', JSON.stringify(r)); }
  { const uiS = { champ: { tag: 'textarea', ce: false, attrs: { 'data-testid': 'chat-input' } }, envoi: { mode: 'bouton', tag: 'button', ce: false, attrs: { 'data-testid': 'send-message' }, mot: 'Envoyer' }, adresse: { sansConv: true } };
    const { f, ordres } = fond({ url: `${ORIGINE}/chat?id=${CONV}`, store: { vrmVcUi: uiS } }); const r = await go(f);
    dit(r.accepte === false && r.code === 'adresse-sans-conv' && !ordres.length && nAct(f) === 0, 'F2c · Vestiaire ne met pas la conversation dans l’adresse (appris) ⇒ rien n’est tapé, dit (destinataire pas vérifiable)', JSON.stringify(r)); }
  { const { f, ordres } = fond({ compteFil: '99998888' }); const r = await go(f);
    dit(r.accepte === false && !ordres.length, 'F3 · la conversation est sur un autre compte que l’onglet ⇒ rien ne part', JSON.stringify(r)); }
  { const { f, ordres } = fond({ store: { vrmPauseVc: { jusqua: Date.now() + 600000, statut: 429 } } }); const r = await go(f);
    dit(r.accepte === false && r.code === 'vc-pause' && !ordres.length, 'F4 · pause Vestiaire (429/403) ⇒ rien ne part', JSON.stringify(r)); }
  { const t = Date.now(); const { f, ordres } = fond({ store: { vrmActions: { ['vc:' + MOI]: Array.from({ length: 50 }, (_, i) => t - 1000 * (i + 1)) } } }); const r = await go(f);
    dit(r.accepte === false && r.code === 'plafond' && !ordres.length, 'F5 · 50 actions dans l’heure ⇒ rien ne part', JSON.stringify(r)); }
  { const { f, ordres } = fond(); const r = await go(f);
    const fil = f.lignes[`vc_fil_${CONV}`];
    dit(r.accepte === true && r.etape === 'fait' && ordres.length === 1 && ordres[0].m.action === 'vcEcrireUI' && ordres[0].m.compte === MOI && !('recette' in ordres[0].m), 'F6 · l’ordre envoyé à l’onglet est l’INTERFACE (`vcEcrireUI`, compte de l’onglet), jamais une requête à rejouer', JSON.stringify(ordres));
    dit(!!fil && fil.messages.some((m) => m.envoyeParVrm && m.deMoi === true) && nAct(f) === 1 && f.j.journal !== undefined, 'F6 · « fait » ⇒ le message rejoint le fil (« envoyé depuis VRM ») et UNE place est prise', JSON.stringify({ fil: fil && fil.messages, n: nAct(f) }));
    dit(!(f.j.ailleurs || []).some((x) => /vestiaire|stream/i.test(JSON.stringify(x))), 'F6 · le fond n’appelle jamais Vestiaire ni sa messagerie lui-même', JSON.stringify(f.j.ailleurs)); }
  { const { f } = fond({ rep: { ok: true, statut: 0, erreur: 'champ-introuvable' } }); const r = await go(f);
    dit(r.accepte === false && r.code === 'champ-introuvable' && nAct(f) === 0, 'F7 · arrêté avant le clic ⇒ « rien n’est parti », la place est RENDUE', JSON.stringify({ r, n: nAct(f) })); }
  { const { f } = fond({ rep: { ok: true, statut: 0, erreur: 'pas-vu', envoye: true } }); const r = await go(f);
    dit(r.accepte === true && r.etape === 'incertain', 'F8 · bouton touché mais rien vu ⇒ « incertain » (jamais « fait », jamais relancé)', JSON.stringify(r)); }
  { const { f } = fond({ rep: { ok: true, statut: 0, erreur: 'verification', defi: true } }); const r = await go(f);
    const p = f.store.vrmPauseVc;
    dit(r.accepte === true && r.etape === 'refuse' && !!p && Number(p.jusqua) > Date.now(), 'F9 · vérification visible ⇒ arrêt, et la pause Vestiaire est posée', JSON.stringify({ r, p })); }
  { const { f } = fond({ rep: null }); const r = await go(f);
    dit(r.accepte === true && r.etape === 'incertain', 'F9 · onglet muet ⇒ « je ne sais pas si c’est parti »', JSON.stringify(r)); }

  // P — le panneau (compte de l'onglet seulement, jamais un nom).
  const senderVc = { tab: { id: 41, url: `${ORIGINE}/chat?id=${CONV}` }, frameId: 0 };
  { const { f } = fond(); const r = await f.envoyer({ from: 'vrm-badge', action: 'filVcCarte', conv: CONV }, senderVc);
    dit(r && r.ok && r.ouverte === true && Array.isArray(r.messages) && r.messages.length === 1 && r.messages[0].deMoi === false, 'P1 · le panneau lit le FIL de la conversation du compte de l’onglet (et sait qu’elle est ouverte)', JSON.stringify(r)); }
  { const { f } = fond({ compteFil: '99998888' }); const r = await f.envoyer({ from: 'vrm-badge', action: 'filVcCarte', conv: CONV }, senderVc);
    dit(r && r.ok === false && r.code === 'autre-compte', 'P2 · le fil d’un AUTRE compte n’est jamais montré', JSON.stringify(r)); }
  { const { f } = fond({ store: { vrmVcAimes: { [ART]: { [ACH]: '2026-11-20T10:00:00Z', '44443333': '2026-11-21T08:00:00Z' }, '12121212': { [ACH]: '2026-11-21T09:00:00Z' } }, vrmVcAimesEcrits: { [`${ART}|${ACH}`]: '2026-11-21T09:30:00Z' } },
      lignes: { vc_listings: { items: { [ART]: { titre: 'Nike Dunk Low', compte: MOI, prix: { valeur: 120 } }, '12121212': { titre: 'Sac', compte: '99998888' } } } } });
    const r = await f.envoyer({ from: 'vrm-badge', action: 'aimesVcCarte' }, senderVc);
    const a = r && r.articles && r.articles[0];
    dit(r && r.ok && r.articles.length === 1 && a.produit === ART && a.n === 2 && a.ecrits === 1 && a.gens[0].url === `${ORIGINE}/chat?id=44443333-${ART}`, 'P3 · les personnes qui ont aimé : seulement les articles du compte de l’onglet, la conversation de chacune, « déjà écrit »', JSON.stringify(r));
    dit(!/Julien|Testeur|name|pseudo/i.test(JSON.stringify(r)), 'P3 · aucun nom ne sort', JSON.stringify(r)); }
}

(async () => {
  for (const [nom, fn] of [['navigateur', navigateur], ['fond', fondAudit]]) {
    try { await fn(); } catch (e) { dit(false, `${nom} : l’audit a tourné jusqu’au bout`, String((e && e.stack) || e).slice(0, 400)); }
  }
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s)` : '\n✅ écrire sur Vestiaire par l’interface : tout est vert');
  process.exit(ko ? 1 : 0);
})();
