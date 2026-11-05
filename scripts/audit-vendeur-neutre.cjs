#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — VRM VENDU À D'AUTRES : AUCUN VENDEUR NE LIT CE QUI EST À JULIEN
// (1er novembre 2026, audit « un autre vendeur que Julien », 19 défauts)
// ═══════════════════════════════════════════════════════════════════════════
// Julien vend VRM à d'autres revendeurs : « fais tout comme un pro, il ne doit
// y avoir aucune erreur possible ». Ce contrôle interdit désormais :
//   A. tout TEXTE affiché (chaîne, texte JSX, gabarit — commentaires exclus,
//      lus par Babel) de `src/` et `api/` qui nomme Julien ou ses boutiques
//      (Cancale, Julien, hopcancale, vrm.vinted35, angeled92, vanessa5723,
//      shopcancale). Seules exceptions : les deux adresses de SERVICE de VRM
//      (boîte collective, contact) là où elles sont définies, et les noms
//      d'animation CSS internes (`cancaleFadeIn`…), jamais affichés ;
//   B. une CONSIGNE D'ADMINISTRATEUR (redémarrer le projet Supabase, poser une
//      variable sur Vercel, configurer eBay Developer, VAPID, la clé IA) qui ne
//      soit pas sous une condition `proprio` (useEstProprietaire) ;
//   C. (route exécutée) un code de validation Gmail rendu à un AUTRE vendeur
//      que celui qui a prouvé l'adresse source — et le lien de validation rangé
//      quelque part ; non attribuable ⇒ quarantaine ;
//   D. (route exécutée) une facture Pro d'un autre vendeur mise « en file
//      d'envoi » (que rien n'envoie) ;
//   E. (route exécutée) `GET /api/ai` qui dit « prête » à un autre vendeur que
//      le propriétaire (§2.9 : la clé du serveur est la sienne) ;
//   F. (route exécutée) le widget qui ne trouve plus un vendeur au-delà des
//      1 000 premières lignes (§4.5).
// `--src <arbre>` le lance sur un autre arbre (preuve sur le code d'avant :
// `git archive origin/main | tar -x -C /tmp/avant`, puis `--src /tmp/avant`).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : ''; };
const RACINE = arg('--src') ? path.resolve(arg('--src')) : path.join(__dirname, '..');
const parser = require(path.join(__dirname, '..', 'node_modules', '@babel', 'parser'));

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'le contrôle a levé : ' + String((e && e.stack) || e).slice(0, 300)); } };

// ── A et B : les textes, lus par Babel ──────────────────────────────────────
const fichiers = [];
(function marche(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) marche(p); else if (/\.(js|jsx|mjs)$/.test(e.name)) fichiers.push(p);
  }
})(path.join(RACINE, 'src'));
(function marche(d) {
  if (!fs.existsSync(d)) return;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) marche(p); else if (/\.(js|mjs)$/.test(e.name)) fichiers.push(p);
  }
})(path.join(RACINE, 'api'));

const MOTIF = /cancale|julien|hopcancale|vrm\.vinted35|angeled92|vanessa5723/i;
// Les adresses de SERVICE de VRM (pas une personne) : là où elles sont définies.
const PERMIS = [
  { fichier: /api[\\/]_lib[\\/]proprietaire-email\.js$/, texte: 'vrm.vinted35@gmail.com' },
  { fichier: /src[\\/]contact\.js$/, texte: 'vrm.vinted35+contact@gmail.com' },
];
// Noms d'animation CSS internes (`cancaleFadeIn`) et commentaires CSS d'une feuille
// de style écrite en gabarit : jamais affichés.
const nettoie = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\bcancale[A-Z][A-Za-z]*\b/g, '');
const ADMIN = /Restart project|VAPID_PRIVATE_KEY|EBAY_RUNAME|docs\/ebay-api\.md|AI_API_KEY|supabase\.com\/dashboard|Environment Variables/;
const traces = [], consignes = [];
const contientProprio = (n) => {
  let trouve = false;
  const voir = (x) => { if (trouve || !x || typeof x.type !== 'string') return; if (x.type === 'Identifier' && x.name === 'proprio') { trouve = true; return; } for (const k in x) { if (k === 'loc') continue; const v = x[k]; if (Array.isArray(v)) v.forEach(voir); else if (v && typeof v === 'object' && v.type) voir(v); } };
  voir(n); return trouve;
};
for (const f of fichiers) {
  const src = fs.readFileSync(f, 'utf8');
  let ast;
  try { ast = parser.parse(src, { sourceType: 'unambiguous', plugins: ['jsx'], errorRecovery: true }); } catch (e) { dit(false, 'lecture de ' + path.relative(RACINE, f), e.message); continue; }
  const pile = [];
  const walk = (n) => {
    if (!n || typeof n.type !== 'string') return;
    let t = null;
    if (n.type === 'StringLiteral') t = n.value; else if (n.type === 'JSXText') t = n.value; else if (n.type === 'TemplateElement') t = n.value.cooked;
    if (t) {
      const rel = path.relative(RACINE, f);
      if (MOTIF.test(nettoie(t)) && !PERMIS.some((p) => p.fichier.test(f) && t.trim() === p.texte)) traces.push(`${rel}:${n.loc.start.line} « ${t.replace(/\s+/g, ' ').trim().slice(0, 90)} »`);
      // Un opérande de comparaison (`j.erreur === 'VAPID_PRIVATE_KEY absente'`) n'est pas affiché.
      const compare = pile.length && pile[pile.length - 1].type === 'BinaryExpression';
      if (/^src[\\/]/.test(rel) && ADMIN.test(t) && !compare) {
        // Une consigne d'administrateur doit vivre sous une condition qui nomme `proprio`.
        const garde = pile.some((a) => (a.type === 'ConditionalExpression' && contientProprio(a.test)) || (a.type === 'LogicalExpression' && contientProprio(a.left)) || (a.type === 'IfStatement' && contientProprio(a.test)));
        if (!garde) consignes.push(`${rel}:${n.loc.start.line} « ${t.replace(/\s+/g, ' ').trim().slice(0, 90)} »`);
      }
    }
    pile.push(n);
    for (const k in n) { if (k === 'loc' || /Comments$/.test(k)) continue; const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object' && v.type) walk(v); }
    pile.pop();
  };
  walk(ast.program);
}
dit(fichiers.length > 50, `${fichiers.length} fichiers lus dans src/ et api/`);
dit(traces.length === 0, 'A. aucun texte affiché ne nomme Julien, Cancale ni ses comptes (hors adresses de service de VRM)', traces.slice(0, 12).join(' · ') + (traces.length > 12 ? ` · … (${traces.length})` : ''));
dit(consignes.length === 0, "B. chaque consigne d'administrateur (Supabase, Vercel, eBay Developer, VAPID, clé IA) est sous une condition « proprio »", consignes.slice(0, 10).join(' · ') + (consignes.length > 10 ? ` · … (${consignes.length})` : ''));

// ── C à F : les routes, EXÉCUTÉES sur une fausse base à état (§4.10) ───────
const J = '11111111-1111-1111-1111-111111111111';   // propriétaire de l'installation
const B = '22222222-2222-2222-2222-222222222222';   // une vendeuse (Sophie)
const C = '33333333-3333-3333-3333-333333333333';   // un autre vendeur
const NEUTRE = '00000000-0000-0000-0000-000000000000';
process.env.VRM_OWNER_UID = J;
process.env.EMAIL_INBOUND_SECRET = 'cle-banc-neutre';
process.env.SUPABASE_SERVICE_KEY = 'service-banc-neutre';
const jwt = (sub) => 'x.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.y';
const UTIL = { [jwt(J)]: { id: J, email: 'proprio@vrm.test' }, [jwt(B)]: { id: B, email: 'sophie@exemple.fr' }, [jwt(C)]: { id: C, email: 'c@exemple.fr' } };

let base = [];
const journal = [];
let plafond1000 = false;
const rep = (corps, status = 200, h = {}) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': 'application/json', ...h } });
const champ = (r, chemin) => {
  if (chemin === 'id' || chemin === 'owner') return r[chemin];
  if (chemin === 'data') return r.data;
  const m = /^(data|meta)(->>|->)(.+)$/.exec(chemin); if (!m) return undefined;
  let v = r.data; for (const seg of m[3].split(/->>|->/)) v = v == null ? undefined : v[seg];
  return m[2] === '->>' && v != null && typeof v === 'object' ? JSON.stringify(v) : v;
};
const filtrer = (params) => {
  let rows = base.slice();
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'on_conflict', 'offset'].includes(k)) continue;
    if (k === 'id' && v.startsWith('eq.')) rows = rows.filter((r) => r.id === v.slice(3));
    else if (k === 'id' && v.startsWith('like.')) { const re = new RegExp('^' + v.slice(5).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/[*%]/g, '.*') + '$'); rows = rows.filter((r) => re.test(r.id)); }
    else if (k === 'id' && v.startsWith('in.(')) { const l = v.slice(4, -1).split(','); rows = rows.filter((r) => l.includes(r.id)); }
    else if (k === 'owner' && v.startsWith('eq.')) rows = rows.filter((r) => r.owner === v.slice(3));
    else if (/^(data|meta)->>/.test(k) && v === 'is.null') rows = rows.filter((r) => champ(r, k) == null);
    else if (/^(data|meta)->>/.test(k) && v.startsWith('eq.')) rows = rows.filter((r) => champ(r, k) != null && String(champ(r, k)) === v.slice(3));
    else if (/^(data|meta)->>/.test(k) && v.startsWith('gt.')) rows = rows.filter((r) => champ(r, k) != null && String(champ(r, k)) > v.slice(3));
    else return rows;   // filtre inconnu : on ne restreint pas (lecture large, jamais un faux « rien »)
  }
  return rows;
};
global.fetch = async (url, opts = {}) => {
  const u = decodeURIComponent(String(url));
  const m = (opts.method || 'GET').toUpperCase();
  const auth = String((opts.headers && (opts.headers.Authorization || opts.headers.authorization)) || '').replace(/^Bearer\s+/i, '');
  if (u.includes('/auth/v1/user')) return UTIL[auth] ? rep(UTIL[auth]) : rep({ msg: 'invalid' }, 401);
  if (u.includes('/rest/v1/rpc/')) return rep(true);
  if (!u.includes('/rest/v1/app_data')) return m === 'GET' ? rep([]) : rep('', 201);
  const q = u.split('?')[1] || '';
  const params = q.split('&').filter(Boolean).map((x) => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; });
  const get = (k) => (params.find((p) => p[0] === k) || [])[1];
  if (m === 'POST') {
    let arr = []; try { arr = JSON.parse(opts.body || '[]'); } catch (_) {}
    arr = Array.isArray(arr) ? arr : [arr];
    for (const x of arr) {
      journal.push({ m, owner: x.owner || '', id: x.id, data: x.data });
      const i = base.findIndex((r) => r.id === x.id && r.owner === (x.owner || ''));
      const l = { owner: x.owner || '', id: x.id, data: x.data };
      if (i >= 0) base[i] = l; else base.push(l);
    }
    return rep('', 201);
  }
  if (/^select=owner&limit=1$/.test(q)) return rep([{ owner: J }]);
  let rows = filtrer(params);
  if (m === 'PATCH') { let c = {}; try { c = JSON.parse(opts.body || '{}'); } catch (_) {} for (const r of rows) Object.assign(r, c); return rep(rows.map((r) => ({ id: r.id, owner: r.owner, data: r.data }))); }
  if (m === 'DELETE') { const s = new Set(rows); base = base.filter((r) => !s.has(r)); return rep('', 204); }
  if (get('order')) { const [col, sens] = [get('order').split(',')[0].replace(/\.(asc|desc)$/, ''), /\.desc/.test(get('order')) ? -1 : 1]; rows = rows.slice().sort((a, b) => { const x = String(champ(a, col) ?? ''), y = String(champ(b, col) ?? ''); return x === y ? 0 : (x < y ? -1 : 1) * sens; }); }
  const total = rows.length;
  const mr = /^(\d+)-(\d+)$/.exec(String((opts.headers && (opts.headers.Range || opts.headers.range)) || ''));
  if (mr) rows = rows.slice(+mr[1], +mr[2] + 1);
  if (get('limit')) rows = rows.slice(0, +get('limit'));
  // Supabase : 1 000 lignes au plus par réponse, SANS le dire (§4.5).
  if (plafond1000) rows = rows.slice(0, 1000);
  const sel = get('select');
  const proj = (r) => { if (!sel) return { id: r.id, owner: r.owner, data: r.data }; const o = {}; for (const it of sel.split(',')) { const i = it.indexOf(':'); const [al, ch] = i > 0 ? [it.slice(0, i), it.slice(i + 1)] : [it.replace(/^.*(->>|->)/, ''), it]; const v = champ(r, ch); o[al] = v === undefined ? null : v; } return o; };
  const debut = mr ? +mr[1] : 0;
  return rep(rows.map(proj), 200, mr ? { 'content-range': `${debut}-${debut + rows.length - 1}/${total}` } : {});
};
const faireRes = () => { const x = { code: null, corps: null, h: {} }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = (k, v) => { x.h[k] = v; }; x.send = () => x; x.end = () => x; return x; };
const registre = (owner, adresses) => ({ owner, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(adresses.map((a) => [a, { owner, label: '', at: '2026-10-20T10:00:00Z' }])) } });

const AUTH_GOOGLE = 'mx.google.com; dkim=pass header.i=@google.com header.s=20230601 header.b=abc; spf=pass (google.com: domain of forwarding-noreply@google.com designates 209.85.220.69 as permitted sender) smtp.mailfrom=forwarding-noreply@google.com; dmarc=pass (p=REJECT sp=REJECT dis=NONE) header.from=google.com';
let nMsg = 0;
const confirmation = (source, code, { auth = AUTH_GOOGLE, langue = 'fr', codeCorps } = {}) => { nMsg++; return {
  messageId: `<transfert-${nMsg}@google.com>`, from: 'Gmail Team <forwarding-noreply@google.com>', to: 'vrm.vinted35@gmail.com',
  subject: langue === 'fr' ? `(#${code}) Confirmation de transfert Gmail - Recevoir les e-mails de ${source}` : `(#${code}) Gmail Forwarding Confirmation - Receive Mail from ${source}`,
  text: langue === 'fr'
    ? `${source} a demandé à transférer automatiquement les e-mails vers votre adresse vrm.vinted35@gmail.com.\n\nCode de confirmation : ${codeCorps || code}\n\nPour autoriser ${source} à transférer automatiquement les e-mails vers votre adresse, veuillez cliquer sur le lien ci-dessous pour confirmer la demande :\n\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ-secret%5D-banc\n\nSi vous cliquez sur le lien et qu'il ne fonctionne pas, copiez-le.`
    : `${source} has requested to automatically forward mail to your email address vrm.vinted35@gmail.com.\nConfirmation code: ${codeCorps || code}\n\nTo allow ${source} to automatically forward mail to your address, please click the link below to confirm the request:\n\nhttps://mail-settings.google.com/mail/vf-%5BANGjdJ-secret%5D-banc`,
  html: '', attachments: [], authentification: auth, deliveredTo: 'vrm.vinted35@gmail.com', source: 'gmail-shared', sourceDate: '2026-11-01T10:00:00.000Z',
}; };

(async () => {
  let inbound, preuve, ai, widget, tg;
  await essaie('chargement', async () => {
    inbound = await import('file://' + path.join(RACINE, 'api', 'email-inbound.js'));
    preuve = await import('file://' + path.join(RACINE, 'api', '_lib', 'preuve-adresse.js'));
    ai = await import('file://' + path.join(RACINE, 'api', 'ai.js'));
    widget = await import('file://' + path.join(RACINE, 'api', 'widget.js'));
    tg = await import('file://' + path.join(RACINE, 'api', '_lib', 'transfert-gmail.js')).catch(() => null);
  });
  if (!inbound || !preuve) { console.log(`\n${ok} ✅ · ${ko + 1} ❌ — les routes ne se chargent pas`); process.exit(1); }
  const prouvee = (owner, adresse) => ({ owner: NEUTRE, id: preuve.idPreuve(owner, adresse), data: { owner, adresse, etat: 'prouvee', via: 'lien', prouveeLe: '2026-10-30T10:00:00Z' } });
  const recevoir = async (corps) => { journal.length = 0; const r = faireRes(); await inbound.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-neutre' }, body: JSON.stringify(corps) }, r); return r; };
  const codesDe = (owner) => base.filter((x) => x.owner === owner && /^vrm_gmail_transfert_/.test(x.id));
  const quarantaines = () => base.filter((x) => x.owner === NEUTRE && /^email_quarantaine_/.test(x.id));
  const lienRange = () => base.some((x) => /mail-settings\.google\.com\/mail\/vf-/.test(JSON.stringify(x.data || '')));

  // ── C. Le code de validation Gmail ──────────────────────────────────────
  await essaie('C', async () => {
    dit(!!tg && typeof tg.lireConfirmationTransfert === 'function', 'C. la règle du code de transfert existe (api/_lib/transfert-gmail.js)');
    if (tg) {
      const fr = tg.lireConfirmationTransfert(confirmation('sophie@gmail.com', '123456789'));
      const en = tg.lireConfirmationTransfert(confirmation('sophie@gmail.com', '987654321', { langue: 'en' }));
      dit(fr && fr.source === 'sophie@gmail.com' && fr.code === '123456789' && en && en.code === '987654321', 'C. le message Gmail (français et anglais) se lit : une adresse source, un code', JSON.stringify([fr, en]));
      dit(tg.lireConfirmationTransfert(confirmation('sophie@gmail.com', '123456789', { codeCorps: '111111111' })) === null, 'C. sujet et corps en désaccord sur le code ⇒ rien (jamais un code deviné)');
      dit(tg.lireConfirmationTransfert({ ...confirmation('sophie@gmail.com', '123456789'), from: 'pirate@exemple.fr' }) === null, "C. un autre expéditeur que forwarding-noreply@google.com n'est pas une confirmation");
      dit(tg.authentifieGoogle(AUTH_GOOGLE) && !tg.authentifieGoogle('mx.google.com; dkim=fail header.i=@google.com; dmarc=fail header.from=google.com') && !tg.authentifieGoogle('mx.google.com; dkim=pass header.i=@pirate.com'), 'C. seule une signature Google (DKIM/DMARC pass) est acceptée');
    }
    // Sophie (B) a déclaré ET prouvé sophie@gmail.com ; C a déclaré la même SANS preuve.
    base = [registre(J, ['proprio@boutique.test']), registre(B, ['sophie@gmail.com']), registre(C, ['sophie@gmail.com', 'autre@gmail.com']), prouvee(B, 'sophie@gmail.com')];
    let r = await recevoir(confirmation('sophie@gmail.com', '123456789'));
    const cb = codesDe(B);
    dit(r.code === 200 && cb.length === 1 && cb[0].data.code === '123456789' && cb[0].data.adresse === 'sophie@gmail.com', 'C. le code est rendu à la vendeuse qui a PROUVÉ l’adresse source, dans SA ligne', `HTTP ${r.code} · ${JSON.stringify(cb.map((x) => x.data))}`);
    dit(!codesDe(C).length && !codesDe(J).length, "C. jamais à un autre vendeur — ni à celui qui l'a déclarée sans preuve, ni au propriétaire de l'installation", `C:${codesDe(C).length} J:${codesDe(J).length}`);
    dit(r.corps && r.corps.reception && r.corps.reception.stocke === true, 'C. le script reçoit son accusé (il ne classe le message que sur cet accusé)', JSON.stringify(r.corps && r.corps.reception));
    dit(!lienRange(), 'C. le lien de validation (un clic suffit à valider) n’est rangé nulle part');
    // Adresse que personne n'a prouvée : quarantaine réclamable, rien à personne.
    const avant = quarantaines().length;
    r = await recevoir(confirmation('autre@gmail.com', '222333444'));
    const q = quarantaines().slice(avant);
    dit(r.code === 200 && q.length === 1 && JSON.stringify(q[0].data.adresses) === JSON.stringify(['autre@gmail.com']) && !codesDe(C).length, "C. adresse source non prouvée ⇒ quarantaine (réclamable par celui qui la prouvera), rien rendu", `HTTP ${r.code} · ${JSON.stringify(q.map((x) => x.data.adresses))}`);
    dit(!lienRange(), 'C. même en quarantaine, le lien de validation est retiré');
    // Non signé par Google : quarantaine que PERSONNE ne peut réclamer.
    const av2 = quarantaines().length;
    r = await recevoir(confirmation('sophie@gmail.com', '555666777', { auth: 'mx.google.com; dkim=none; spf=softfail; dmarc=fail header.from=google.com' }));
    const q2 = quarantaines().slice(av2);
    dit(r.code === 200 && q2.length === 1 && Array.isArray(q2[0].data.adresses) && q2[0].data.adresses.length === 0 && !codesDe(B).some((x) => x.data.code === '555666777'), 'C. message non signé par Google ⇒ quarantaine sans destinataire, aucun code rendu (même à Sophie)', `HTTP ${r.code} · ${JSON.stringify(q2.map((x) => x.data.adresses))}`);
    // Le script : il transmet l'en-tête et ne classe que sur l'accusé.
    const gs = fs.readFileSync(path.join(RACINE, 'scripts', 'gmail-forwarder.gs'), 'utf8');
    const fn = (/function confirmationTransfertVRM\(\)\{[\s\S]*?\n\}/.exec(gs) || [''])[0];
    dit(/Authentication-Results/.test(fn) && /accuseValideVRM\(/.test(fn) && fn.indexOf('accuseValideVRM(') < fn.indexOf('classerMessageVRM('), 'C. le script Gmail transmet la signature et ne classe le message qu’après l’accusé de VRM', fn ? fn.slice(0, 120) : 'fonction absente');
  });

  // ── D. Factures Pro : la file d'envoi n'existe que pour le propriétaire ──
  await essaie('D', async () => {
    // La forme d'un email Vinted Pro (celle de audit-routes-revue.cjs), données INVENTÉES.
    const ventePro = (to, tx) => ({ messageId: `<pro-${tx}>`, from: 'no-reply@vinted.fr', to, subject: 'Ton article s\'est vendu !', html: '',
      attachments: [{ filename: `Formulaire-retour-commande-${tx}.pdf`, contentType: 'application/pdf', content: Buffer.from('%PDF-1.4\nbanc\n%%EOF').toString('base64') }],
      text: 'Bonjour boutique_banc,\n\nacheteuse_banc a acheté\n\nAsics Metaspeed banc - Taille 43,5\n\n30,00 €\n\n'
        + 'Nous transférerons le paiement sur ton porte-monnaie Vinted une fois la commande terminée.\nExpédie cette commande au cours des 5 prochains jours.\n'
        + 'En tant que membre Vinted Pro, tu dois envoyer à l\'acheteur 2 documents supplémentaires :\n• Un formulaire de retour de commande.\n• Une facture. Veille à inclure une facture dans le colis avec l\'article.\n\n'
        + 'Coordonnées de l\'acheteur\nAdresse :\nMarie Banc, 12 rue Inventée, Lisbonne, 1000-001, PT, Portugal\nAdresse e-mail :\nmarie.banc@exemple.test\n\nL\'équipe Vinted\n' });
    base = [registre(J, ['proprio@boutique.test']), registre(B, ['sophie@gmail.com']), prouvee(B, 'sophie@gmail.com'),
      { owner: B, id: 'vrm_pro_facture', data: { actif: true, autoSend: true, prefixe: 'FA', nom: 'Sophie Pro' } },
      { owner: J, id: 'vrm_pro_facture', data: { actif: true, autoSend: true, prefixe: 'FA', nom: 'Proprio' } },
      { owner: B, id: 'vrm_invoice_counter', data: 3 }, { owner: J, id: 'vrm_invoice_counter', data: 7 }];
    await recevoir(ventePro('sophie@gmail.com', '24000000001'));
    await recevoir(ventePro('proprio@boutique.test', '24000000002'));
    const fB = base.filter((x) => x.owner === B && /^email_invoice_/.test(x.id)), fJ = base.filter((x) => x.owner === J && /^email_invoice_/.test(x.id));
    // (2 nov.) La facture Pro part de la boîte de CHAQUE vendeur, sur son clic
    // (api/_lib/facture-pro.js) : plus aucune file « queued », pour personne, et
    // aucun numéro donné à l'arrivée de l'email.
    dit(fB.length === 1 && fB[0].data.status === 'draft' && !fB[0].data.number, "D. la vente Pro d'une autre vendeuse : un brouillon sans numéro, jamais « en file d'envoi »", JSON.stringify(fB.map((x) => [x.data.status, x.data.number])));
    dit(fJ.length === 1 && fJ[0].data.status === 'draft' && !fJ[0].data.number, "D. celle du propriétaire : la même règle (plus de file réservée)", JSON.stringify(fJ.map((x) => [x.data.status, x.data.number])));
  });

  // ── E. L'assistant IA : « prête » seulement pour celui que la clé sert ──
  await essaie('E', async () => {
    process.env.AI_API_KEY = 'cle-ia-du-proprietaire';
    const sonde = async (jeton) => { const r = faireRes(); await ai.default({ method: 'GET', query: {}, headers: jeton ? { authorization: 'Bearer ' + jeton } : {} }, r); return r.corps || {}; };
    const [sans, vb, vj] = [await sonde(''), await sonde(jwt(B)), await sonde(jwt(J))];
    dit(sans.ready === false && vb.ready === false, "E. GET /api/ai ne dit pas « prête » à un visiteur ni à un autre vendeur (§2.9 : c'est la clé de Julien)", JSON.stringify({ sans: sans.ready, B: vb.ready }));
    dit(vj.ready === true, "E. … et le dit au propriétaire de l'installation (l'autre sens)", JSON.stringify({ J: vj.ready }));
    delete process.env.AI_API_KEY;
  });

  // ── F. Le widget au-delà de 1 000 vendeurs ──────────────────────────────
  await essaie('F', async () => {
    base = [];
    for (let i = 0; i < 1500; i++) base.push({ owner: 'vendeur-' + String(i).padStart(5, '0'), id: 'main', data: { vrm_widget_token: 'jeton-widget-' + String(i).padStart(5, '0') } });
    plafond1000 = true;
    const r = faireRes();
    await widget.default({ method: 'GET', query: { k: 'jeton-widget-01300' }, headers: {} }, r);
    plafond1000 = false;
    dit(r.code !== 401, 'F. le 1 301ᵉ vendeur retrouve son widget (lecture paginée, §4.5) — pas « clé invalide »', `HTTP ${r.code}`);
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
