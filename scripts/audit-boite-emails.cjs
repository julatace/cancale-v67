// ════════════════════════════════════════════════════════════════════════════
//  L'ÉCRAN « E-MAILS » (5 nov.) — la règle EXÉCUTÉE
//
//  1. UNE règle de rubrique (api/_lib/boite-email.js) : l'étiquette d'une ligne
//     (`rubriqueEmail`) et le filtre envoyé à la base (`filtreBoite`) disent la
//     MÊME chose, rubrique par rubrique, sur des lignes de forme réelle.
//  2. La VRAIE route `api/email-inbound.js` garde la LISTE des pièces jointes
//     (nom, type, poids) sur la ligne de suivi — jamais leur contenu.
//  3. La VRAIE route `api/email-rattacher.js?mode=journal` exécutée sur une base
//     servie dans sa vraie forme (projection, chemins `data->a->>b`, filtres
//     `in.`/`not.in.`/`not.is.null`/`cs.`) : `boite=` filtre côté base, rubrique
//     inconnue ⇒ 400, `lire=` rend UN email (texte + pièces) sous SON owner,
//     jamais `select=data`, panne ⇒ 503.
//  4. Le lien « Voir dans VRM » ne part que d'une IDENTITÉ (§5) ; le corps est
//     nettoyé en texte ; « Relier ma boîte » n'appelle rien et n'invente que des
//     adresses `.test`.
//  5. L'app monte l'écran (`tab==='emails'`), l'annonce dans la navigation et
//     l'accepte dans `?tab=`.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const fs = require('fs');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };
const J = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

// La valeur d'un chemin PostgREST (`data->>type`, `data->resume->>code`, `data->pieces`).
const chemin = (x, expr) => {
  if (expr === 'id') return x.id;
  if (expr === 'data') return x.data;
  const parts = expr.split(/->>?/);
  if (parts[0] !== 'data') return undefined;
  let v = x.data;
  for (const k of parts.slice(1)) { if (v == null || typeof v !== 'object') return undefined; v = v[k]; }
  if (/->>[^>]*$/.test(expr) && v != null && typeof v === 'object') return JSON.stringify(v);
  return v;
};
// Un filtre PostgREST sur une ligne.
const garde = (x, k, v) => {
  const val = chemin(x, k);
  const s = val == null ? null : String(val);
  if (v.startsWith('eq.')) return s === v.slice(3);
  if (v.startsWith('in.(')) return s != null && v.slice(4, -1).split(',').includes(s);
  if (v.startsWith('not.in.(')) return s != null && !v.slice(8, -1).split(',').includes(s);
  if (v === 'not.is.null') return val != null;
  if (v === 'is.null') return val == null;
  if (v.startsWith('cs.')) { const l = JSON.parse(v.slice(3)); return Array.isArray(val) && l.every((a) => val.includes(a)); }
  throw new Error('filtre non servi : ' + k + '=' + v);
};

(async () => {
  const { RUBRIQUES_BOITE, rubriqueEmail, dansRubrique, filtreBoite, listePieces } = await import(path.join(R, 'api/_lib/boite-email.js'));

  // ── 1. UNE RÈGLE, DEUX LECTURES ────────────────────────────────────────────
  const formes = [
    { type: 'vente', resume: { t: 'vente' } }, { type: 'finalisation', resume: null }, { type: 'vente-vestiaire', resume: { t: 'vente-vestiaire', p: '123' } },
    { type: 'achat', resume: { t: 'achat', tx: '1' } }, { type: 'suivi', resume: { t: 'suivi', s: 'X1', code: '418205' } },
    { type: 'suivi', resume: { t: 'suivi', s: 'X2' } }, { type: 'suivi', resume: null }, { type: 'bordereau', resume: { t: 'bordereau', tx: '9' } },
    { type: 'offre', resume: { t: 'offre' } }, { type: 'message', resume: null }, { type: 'favori', resume: null }, { type: 'action', resume: null },
    { type: 'connu-sans-action', resume: { t: 'connu-sans-action' } }, { type: 'information', resume: null }, { type: 'ignoré', resume: { t: 'incompris' } },
  ];
  for (const { id } of RUBRIQUES_BOITE.filter((x) => x.id)) {
    const f = filtreBoite(id);
    const parBase = formes.filter((e) => f.split('&').every((kv) => { const [k, v] = kv.split('='); return garde({ id: 'x', data: e }, decodeURIComponent(k), decodeURIComponent(v)); }));
    const parEcran = formes.filter((e) => dansRubrique(e, id));
    dit(JSON.stringify(parBase) === JSON.stringify(parEcran) && parEcran.length > 0, `rubrique « ${id} » : la base et l'écran montrent les mêmes ${parEcran.length} formes`, `${parBase.length} / ${parEcran.length}`);
  }
  dit(rubriqueEmail({ type: 'suivi', resume: null }) === 'colis', 'un suivi rangé AVANT le résumé (code pas lu) est « Colis », jamais « Codes » (pas su ≠ oui)');
  dit(rubriqueEmail({ type: 'suivi', resume: { code: '   ' } }) === 'colis', 'un code vide n’est pas un code');
  dit(rubriqueEmail({ type: 'achat', subject: 'Ton article est vendu', resume: null }) === 'achats' && rubriqueEmail({ type: 'information', subject: 'Votre code de retrait 123456', resume: null }) === 'autres', 'la rubrique se lit sur le TYPE posé au classement, jamais sur le sujet');
  dit(filtreBoite('nimporte') === '', 'rubrique inconnue : aucun filtre fabriqué');
  {
    const lp = listePieces([{ filename: 'Bordereau-1.pdf', contentType: 'application/pdf', contentB64: Buffer.from('x'.repeat(3000)).toString('base64') }, ...Array.from({ length: 14 }, (_, i) => ({ filename: 'p' + i + '\u0007.png', contentType: 'image/png' }))]);
    dit(lp.length === 10 && lp[0].n === 'Bordereau-1.pdf' && lp[0].o === 3000 && !('contentB64' in lp[0]) && !JSON.stringify(lp).includes('eHh4'), 'pièces : 10 au plus, nom/type/poids, JAMAIS le contenu', JSON.stringify(lp[0]));
    dit(lp[1].n === 'p0.png' && !('o' in lp[1]), 'pièce sans contenu : poids absent (pas « 0 »), caractères de contrôle retirés');
  }

  // ── 2. LE CLASSEMENT GARDE LA LISTE DES PIÈCES ─────────────────────────────
  await essaie('classement', async () => {
    process.env.VRM_OWNER_UID = J;
    process.env.EMAIL_INBOUND_SECRET = 'cle-banc-boite';
    const ecrites = [];
    global.fetch = async (url, opts = {}) => {
      const u = decodeURIComponent(String(url));
      if (!u.includes('/rest/v1/')) return rep({});
      if ((opts.method || 'GET') === 'POST') { try { JSON.parse(opts.body || '[]').forEach((x) => ecrites.push(x)); } catch (_) {} return rep('', 201); }
      if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
      if (/id=eq\.vrm_email_owners/.test(u)) return rep([{ owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } } } }]);
      if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(J, 'recu@vrm.center'), owner: J, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
      return rep([]);
    };
    const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?boite');
    const res = faireRes();
    const contenu = Buffer.from('%PDF-1.4 ' + 'z'.repeat(5000)).toString('base64');
    await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-boite' }, body: { messageId: '<boite-1@banc>', to: 'recu@vrm.center', from: 'inconnu@exemple.test', subject: 'Une forme jamais vue', text: 'Bonjour', html: '', attachments: [{ filename: 'facture.pdf', contentType: 'application/pdf', contentB64: contenu }, { filename: 'photo.jpg', contentType: 'image/jpeg', contentB64: Buffer.from('jpg').toString('base64') }] } }, res);
    const suivi = ecrites.find((x) => String(x.id).startsWith('email_reception_'));
    const p = suivi && suivi.data && suivi.data.pieces;
    dit(Array.isArray(p) && p.length === 2 && p[0].n === 'facture.pdf' && p[0].t === 'application/pdf' && p[0].o > 5000 && p[1].n === 'photo.jpg', 'la ligne de suivi porte la liste des pièces (nom, type, poids)', JSON.stringify(p).slice(0, 200));
    dit(suivi && !JSON.stringify(suivi.data).includes(contenu.slice(0, 40)) && JSON.stringify(suivi.data).length < 2000, 'aucun contenu de pièce jointe sur la ligne de suivi (§4.4)', suivi && String(JSON.stringify(suivi.data).length));
  });

  // ── 3. LA ROUTE : boite=, lire= ────────────────────────────────────────────
  const lignes = [];
  const typesL = [
    ['vente', { v: 1, t: 'vente', a: 'Paire', px: '40', n: '12' }, 'integre'],
    ['suivi', { v: 1, t: 'suivi', s: 'MR123', st: 'available', code: '418205' }, 'integre'],
    ['suivi', { v: 1, t: 'suivi', s: 'CH456', st: 'transit' }, 'integre'],
    ['bordereau', { v: 1, t: 'bordereau', tx: '1234567', pdf: 1 }, 'integre'],
    ['achat', { v: 1, t: 'achat', tx: '7654321', pdf: 0 }, 'integre'],
    ['offre', { v: 1, t: 'offre', mt: '30' }, 'integre'],
    ['ignoré', { v: 1, t: 'incompris', av: 'incompris' }, 'a-verifier'],
  ];
  for (let i = 0; i < 28; i++) {
    const [type, resume, etat] = typesL[i % typesL.length];
    lignes.push({ owner: i === 5 ? B : J, id: `email_reception_${String(i).padStart(2, '0')}${'c'.repeat(62)}`, data: { at: new Date(Date.UTC(2026, 10, 5, 12) - i * 60000).toISOString(), etat, type, subject: `Sujet ${i}`, from: 'Vinted <no-reply@vinted.fr>', adresses: ['recu@vrm.center'], resume, sourceDate: null, receivedAt: '2026-11-05T12:00:00Z', ...(i === 0 ? { pieces: [{ n: 'Bordereau.pdf', t: 'application/pdf', o: 48000 }] } : {}) } });
  }
  lignes.push({ owner: J, id: 'email_texte_00' + 'c'.repeat(62), data: { texte: 'Bonjour <img src=x onerror=alert(1)>' } });
  lignes.push({ owner: B, id: 'email_texte_05' + 'c'.repeat(62), data: { texte: 'SECRET DE B' } });
  const lectures = [];
  let panne = false;
  const servir = (url) => {
    const u = new URL(url), p = u.searchParams;
    lectures.push(decodeURIComponent(u.search));
    if (panne && /email_reception/.test(p.get('id') || '')) return rep('<html>522</html>', 522);
    if (u.pathname.endsWith('/vinted_accounts')) return rep([]);
    const owner = (p.get('owner') || '').replace(/^eq\./, '');
    let r = lignes.filter((x) => x.owner === owner);
    const id = p.get('id') || '';
    if (id.startsWith('eq.')) r = r.filter((x) => x.id === id.slice(3));
    else if (id.startsWith('like.')) { const pre = id.slice(5).replace(/\*$/, ''); r = r.filter((x) => x.id.startsWith(pre)); }
    for (const [k, v] of p.entries()) if (k.startsWith('data')) r = r.filter((x) => garde(x, k, v));
    r.sort((a, b) => String(b.data.at || '').localeCompare(String(a.data.at || '')) || a.id.localeCompare(b.id));
    const off = Number(p.get('offset') || 0), lim = Number(p.get('limit') || 1000);
    r = r.slice(off, off + lim);
    const sel = p.get('select') || '*';
    const proj = (x) => { if (sel === '*') return x; const o = {}; for (const champ of sel.split(',')) { const [alias, expr] = champ.includes(':') ? champ.split(':') : [champ, champ]; const v = chemin(x, expr); o[alias] = v === undefined ? null : v; } return o; };
    return rep(r.map(proj));
  };
  global.fetch = async (url, opts = {}) => {
    const s = String(url);
    if (s.includes('/auth/v1/user')) return (opts.headers && (opts.headers.Authorization || opts.headers.authorization)) === 'Bearer session-J' ? rep({ id: J }) : rep({}, 401);
    if (/select=owner&limit=1/.test(s)) return rep([{ owner: J }]);
    if (s.includes('/rest/v1/')) return servir(s);
    return rep({});
  };
  const rattacher = await import('file://' + path.join(R, 'api', 'email-rattacher.js') + '?boite');
  const appeler = async (query, auth = 'Bearer session-J') => { const r = faireRes(); await rattacher.default({ method: 'GET', query: { mode: 'journal', ...query }, headers: auth ? { authorization: auth } : {} }, r); return r; };

  await essaie('route : rubriques', async () => {
    for (const { id } of RUBRIQUES_BOITE.filter((x) => x.id)) {
      lectures.length = 0;
      const r = await appeler({ boite: id });
      const e = r.corps && r.corps.emails;
      const attendus = lignes.filter((x) => x.owner === J && x.id.startsWith('email_reception_') && dansRubrique(x.data, id)).length;
      dit(r.code === 200 && Array.isArray(e) && e.length === Math.min(20, attendus) && e.every((x) => dansRubrique(x, id)), `boite=${id} : filtré PAR LA BASE (${e && e.length} emails)`, `${r.code} ${e && e.length}/${attendus}`);
    }
    const c = (await appeler({ boite: 'codes' })).corps;
    dit(c.emails.every((x) => x.resume && x.resume.code === '418205'), 'Codes de retrait : seulement les emails dont un code a été LU');
    dit(c.compteurs && c.compteurs.parRubrique && c.compteurs.parRubrique.codes === 4 && c.compteurs.parRubrique.colis === 12 && c.compteurs.parRubrique.ventes === 4, 'compteurs par rubrique, même règle que l’étiquette (Colis compte aussi les codes)', JSON.stringify(c.compteurs && c.compteurs.parRubrique));
    const mauvais = await appeler({ boite: 'tout;drop' });
    dit(mauvais.code === 400, 'rubrique inconnue : 400, aucune lecture élargie', String(mauvais.code));
    const recep = lectures.filter((q) => /email_reception/.test(q));
    dit(recep.length && recep.every((q) => !/select=(id,)?data(&|$|,)/.test(q)), 'jamais `select=data` (§4.4)', recep.join(' | ').slice(0, 300));
    const l0 = (await appeler({})).corps.emails.find((x) => x.id.startsWith('email_reception_00'));
    dit(l0 && l0.pj === 1 && !('pieces' in l0), 'la liste dit le NOMBRE de pièces, pas leur détail');
  });
  // (revue du 5 nov.) Les compteurs suivent le COMPTE choisi : sinon « Ventes 4 »
  // s'affiche à côté d'une liste filtrée sur une adresse qui n'en a qu'une.
  await essaie('route : compteurs par compte', async () => {
    const ajout = [0, 1, 2].map((i) => ({ owner: J, id: `email_reception_9${i}${'e'.repeat(61)}`, data: { at: new Date(Date.UTC(2026, 10, 1) - i * 60000).toISOString(), etat: 'integre', type: 'vente', subject: `Autre ${i}`, from: 'Vinted <no-reply@vinted.fr>', adresses: ['autre@vrm.center'], resume: { v: 1, t: 'vente' } } }));
    lignes.push(...ajout);
    try {
      const r = (await appeler({ adresse: 'autre@vrm.center' })).corps;
      const pr = r && r.compteurs && r.compteurs.parRubrique;
      dit(r && r.emails.length === 3 && r.compteurs.sur === 3 && pr && pr.ventes === 3 && pr.colis === 0 && pr.codes === 0, 'compte choisi : les compteurs par rubrique portent sur SES e-mails, pas sur tous', JSON.stringify(r && r.compteurs));
      dit(r && r.compteurs.adresse === 'autre@vrm.center', 'compte choisi : les compteurs disent sur quelle adresse ils portent', JSON.stringify(r && r.compteurs));
      const tous = (await appeler({})).corps;
      dit(tous.compteurs.parRubrique.ventes === 7 && !tous.compteurs.adresse, 'sans compte choisi : tous les e-mails comptés', JSON.stringify(tous.compteurs.parRubrique));
    } finally { lignes.splice(lignes.length - ajout.length, ajout.length); }
  });
  await essaie('route : lire', async () => {
    lectures.length = 0;
    const r = await appeler({ lire: 'email_reception_00' + 'c'.repeat(62) });
    const e = r.corps && r.corps.email;
    dit(r.code === 200 && e && e.subject === 'Sujet 0' && e.texte === 'Bonjour <img src=x onerror=alert(1)>' && e.pieces.length === 1 && e.pieces[0].n === 'Bordereau.pdf' && e.pieces[0].o === 48000, 'lire : sujet, texte gardé, pièces listées', JSON.stringify(e).slice(0, 300));
    dit(lectures.every((q) => /owner=eq\.1111/.test(q) || /vinted_accounts/.test(q)) && lectures.every((q) => !/select=data(&|$)/.test(q) || /vrm_email_owners|panel_comptes_etat/.test(q)), 'lire : sous SON owner, ligne de suivi en scalaires projetés', lectures.join(' | ').slice(0, 400));
    dit(e && e.texteCoupe === false, 'texte entier : pas dit « extrait »', JSON.stringify(e && e.texteCoupe));
    lignes.push({ owner: J, id: 'email_texte_02' + 'c'.repeat(62), data: { texte: 'y'.repeat(1500) + '…' } });
    try {
      const c = (await appeler({ lire: 'email_reception_02' + 'c'.repeat(62) })).corps.email;
      dit(c && c.texte.length === 1501 && c.texteCoupe === true, 'texte coupé à la réception (1 500 caractères + « … ») : la route dit que c’est un EXTRAIT, jamais présenté comme le message entier', JSON.stringify(c && { l: c.texte && c.texte.length, coupe: c.texteCoupe }));
    } finally { lignes.pop(); }
    const sans = (await appeler({ lire: 'email_reception_01' + 'c'.repeat(62) })).corps.email;
    dit(sans && sans.pieces === null && sans.texte === null, 'email rangé avant le 5 nov. : pièces `null` (pas su), jamais « aucune »');
    const autre = (await appeler({ lire: 'email_reception_05' + 'c'.repeat(62) })).corps;
    dit(autre.ok && autre.email === null, 'l’email d’un AUTRE vendeur n’est jamais rendu (même id)', JSON.stringify(autre).slice(0, 200));
    dit((await appeler({ lire: 'main' })).code === 400, 'identifiant qui n’est pas une ligne de suivi : 400');
    dit((await appeler({ lire: 'email_reception_00' + 'c'.repeat(62) }, '')).code === 401, 'sans session : 401');
    panne = true; const p = await appeler({ lire: 'email_reception_00' + 'c'.repeat(62) }); const l = await appeler({ boite: 'ventes' }); panne = false;
    dit(p.code === 503 && l.code === 503, 'lecture ratée : 503 — jamais une liste vide ni un email vide', `${p.code} ${l.code}`);
  });

  // ── 4. IDENTITÉ, CORPS, « RELIER MA BOÎTE » ────────────────────────────────
  const { objetRelie, nettoyerCorps, poidsLisible, titreSimple, titreEnClair, groupesParJour } = await import(path.join(R, 'src/boiteEmails.js'));
  const E = (resume, extra = {}) => ({ id: 'x', from: 'Vinted <no-reply@vinted.fr>', subject: 'Nike Air Max 90', etat: 'integre', type: resume && resume.t, resume, ...extra });
  {
    const b = objetRelie(E({ v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1 }));
    dit(b && b.k === 'colis' && b.url === '?tab=cat_bord&cible=colis&tx=12345678901', 'bordereau : le colis de SA vente, par n° de transaction', JSON.stringify(b));
    const s = objetRelie(E({ v: 1, t: 'suivi', s: 'MR123', st: 'available', code: '418205' }));
    dit(s && s.url === '?tab=cat_bord&cible=retrait&suivi=MR123', 'code de retrait : le colis par son n° de suivi', JSON.stringify(s));
    dit(objetRelie(E({ v: 1, t: 'suivi', s: 'MR123', st: 'delivered', sens: 'sortant' })) === null, 'colis SORTANT : pas de cible « à retirer » inventée');
    dit(objetRelie(E({ v: 1, t: 'suivi', st: 'available', av: 'sans-suivi' })) === null, 'suivi sans n° : relié à rien');
    const nt = objetRelie(E({ v: 1, t: 'bordereau', tx: '1', n: '42', nt: 1, pdf: 1, av: 'num-titre' }));
    dit(nt && nt.k === 'colis' && !nt.num, 'N° retrouvé par le TITRE : on ouvre le colis par la transaction, jamais « Tout sur le N°42 »', JSON.stringify(nt));
    const a = objetRelie(E({ v: 1, t: 'achat', tx: '7654321', id: 'email_achat_x' }));
    dit(a && a.url === '?tab=achats&cible=achat&tx=7654321', 'reçu d’achat : SON achat, par n° de transaction');
    dit(objetRelie(E({ v: 1, t: 'achat', tx: '7654321', id: 'email_achat_x' }), { email_achat_x: { tx: '7654321' } }) === null, 'reçu délié par lui (« Ce n’est pas ça ») : plus de lien');
    const v = objetRelie(E({ v: 1, t: 'vente', n: '12' }));
    dit(v && v.k === 'num' && v.num === '12', 'vente : « Tout sur le N°12 » (N° lu dans l’email)');
    dit(objetRelie(E(null, { type: 'bordereau' })) === null && objetRelie(E({ v: 1, t: 'panne', av: 'panne' })) === null, 'email d’avant le résumé ou en attente : relié à rien');
    const memes = Array.from({ length: 50 }, (_, i) => objetRelie(E({ v: 1, t: 'achat', a: 'Nike Air Max 90', px: '45', av: 'sans-tx', id: 'email_achat_' + i })));
    dit(memes.every((x) => x === null), '50 reçus au même titre sans n° : aucun n’est relié (aucune ressemblance)');
    const corps = nettoyerCorps('Bonjour​  toi\n\n\n\nSuivre : https://track.exemple.test/' + 'a'.repeat(120) + '\nFin');
    dit(corps === 'Bonjour toi\n\nSuivre : [lien track.exemple.test]\nFin', 'corps nettoyé : invisibles retirés, lien de pistage réduit à son domaine, lignes resserrées', JSON.stringify(corps));
    // (5 nov., soir) Une balise restée dans le texte n'est plus AFFICHÉE en texte :
    // elle est retirée (le texte reste), une entité qui cachait une balise aussi,
    // une balise coupée en fin de texte aussi. Rien n'est interprété (React).
    const sale = nettoyerCorps('Bonjour <b>toi</b><img src=x onerror="alert(1)"> &amp; &lt;img src=y&gt;fin<style>p{color:red}</style>\nSuite<div class="x');
    dit(nettoyerCorps(null) === null && nettoyerCorps('<b>x</b>') === 'x' && sale === 'Bonjour toi & fin\nSuite' && !/[<>]/.test(sale), 'corps absent ⇒ null ; balises retirées (jamais affichées, jamais interprétées), le texte gardé', JSON.stringify(sale));
    dit(nettoyerCorps('Prix < 30 € et 2 > 1') === 'Prix < 30 € et 2 > 1', 'un « < » qui n’ouvre pas de balise reste (le texte n’est pas abîmé)', JSON.stringify(nettoyerCorps('Prix < 30 € et 2 > 1')));
    dit(poidsLisible(48000) === '47 Ko' && poidsLisible(null) === '' && poidsLisible(3 * 1024 * 1024) === '3,0 Mo', 'poids lisible ; inconnu ⇒ rien d’écrit');
    // (5 nov., soir) CE QUE C'EST, en mots simples — tiré du résumé rangé, jamais du sujet.
    const clair = (resume, extra) => titreEnClair(titreSimple(E(resume, extra))).replace(/\s+/g, ' ');
    dit(clair({ v: 1, t: 'suivi', s: 'MR1', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '2026-11-09' }) === 'Colis à retirer · Relais Tabac du Port · code 418 205 · avant le 9 nov.', 'code de retrait : « Colis à retirer · lieu · code · avant le »', clair({ v: 1, t: 'suivi', s: 'MR1', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '2026-11-09' }));
    dit(clair({ v: 1, t: 'suivi', s: 'MR1', st: 'available' }) === 'Colis à retirer · code pas encore lu', 'code non lu : « code pas encore lu » (pas su ≠ inventé)');
    dit(clair({ v: 1, t: 'bordereau', tx: '1', n: '42', pdf: 1, a: 'Nike Air Max 90' }) === 'Vendu · Nike Air Max 90 · N°42 · bordereau prêt', 'bordereau : « Vendu · article · N° · bordereau prêt »');
    dit(!/42/.test(clair({ v: 1, t: 'bordereau', tx: '1', n: '42', nt: 1, pdf: 1, av: 'num-titre', a: 'Nike Air Max 90' })), '§5 un N° retrouvé par le TITRE n’est jamais écrit en tête de ligne');
    dit(clair({ v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' }) === 'Newsletter Vinted — rien à faire' && clair({ v: 1, t: 'connu-sans-action', f: 'commande mise à jour (le statut vient de la moisson)' }) === 'Commande mise à jour — rien à faire', 'information : « … — rien à faire », sans parenthèse technique');
    dit(clair({ v: 1, t: 'achat', tx: '7', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_x' }) === 'Achat · reçu de commande · Nike Air Force 1 · 45,00 €', 'achat : « Achat · reçu de commande · article · prix »');
    dit(clair(null, { type: 'bordereau', subject: 'Bordereau d’envoi pour Vans Old Skool' }) === 'Vendu · bordereau · détail non gardé', 'e-mail d’avant le résumé : « détail non gardé », jamais un détail tiré du sujet');
    dit(clair({ v: 1, t: 'panne', av: 'panne' }, { etat: 'erreur' }) === 'En cours de rangement — rien à faire', 'en attente de réessai : dit, rien à faire');
    const sujets = ['Votre colis 999 est disponible', 'Ton article est vendu !', 'Bordereau d’envoi pour Nike'];
    dit(sujets.every((s) => !clair({ v: 1, t: 'vente', a: 'Adidas Samba' }, { subject: s }).includes(s)), 'le sujet brut n’est jamais la tête de ligne');
    const T = Date.UTC(2026, 10, 5, 15, 0);
    const g = groupesParJour([{ id: 'a', at: new Date(T - 6e4).toISOString() }, { id: 'b', at: null }, { id: 'c', at: new Date(T - 20 * 36e5).toISOString() }, { id: 'd', sourceDate: new Date(T - 50 * 36e5).toISOString(), at: new Date(T).toISOString() }], T);
    dit(g.map((x) => x.mot)[0] === 'Aujourd’hui' && g[g.length - 1].mot === 'Date non lue' && g.reduce((s, x) => s + x.emails.length, 0) === 4 && g.some((x) => x.mot === 'Hier'), 'groupés par jour : Aujourd’hui, Hier, …, « Date non lue » en dernier, chaque e-mail une fois', JSON.stringify(g.map((x) => [x.mot, x.emails.map((e) => e.id)])));
    // (v33, « tu peux faire mieux ») UNE LIGNE = nature · essentiel · geste, rangée
    // depuis `titreSimple` (une seule source) ; le geste est marqué, l'ambre rare.
    const { ligneEmail, gesteAmbre, monogramme, joursAvant } = await import(path.join(R, 'src/boiteEmails.js'));
    const L = (resume, extra) => ligneEmail(E(resume, extra), {}, T);
    const nbsp = (x) => String(x).replace(/ /g, ' ');
    const ret = L({ v: 1, t: 'suivi', s: 'MR1', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '2026-11-09' });
    dit(ret.titre === 'Colis à retirer' && nbsp(ret.essentiel.join(' · ')) === 'code 418 205 · Relais Tabac du Port' && ret.geste && ret.geste.k === 'retrait' && nbsp(ret.geste.mot) === 'avant le 9 nov.' && !gesteAmbre(ret.geste), 'ligne d’un code de retrait : le CODE en tête de l’essentiel, le délai à part (geste), sans ambre à 4 jours', JSON.stringify(ret));
    const dem = L({ v: 1, t: 'vente-vestiaire', a: 'Jordan 1 Mid', mt: '82,40', lim: '2026-11-06' });
    const auj = L({ v: 1, t: 'suivi', s: 'X', st: 'available', lim: '05/11/2026' });
    const passe = L({ v: 1, t: 'suivi', s: 'X', st: 'available', lim: '01/11/2026' });
    const sansAn = L({ v: 1, t: 'suivi', s: 'X', st: 'available', lim: '06/11' });
    dit(dem.geste.k === 'envoi' && dem.geste.proche && gesteAmbre(dem.geste) && /\(demain\)$/.test(dem.geste.mot) && auj.geste.proche && /aujourd’hui/.test(auj.geste.mot) && passe.geste.passe && !gesteAmbre(passe.geste) && /délai passé/.test(passe.geste.mot) && !sansAn.geste.proche, 'délai LU : ambre à moins de 48 h (aujourd’hui, demain) ; passé ⇒ « délai passé » sans ambre ; date sans année ⇒ jamais « proche » (pas su)', JSON.stringify([dem.geste, auj.geste, passe.geste, sansAn.geste]));
    const bo = L({ v: 1, t: 'bordereau', tx: '1', n: '42', pdf: 1, a: 'Nike Air Max 90' });
    const ve = L({ v: 1, t: 'vente', a: 'Adidas Samba', px: '55', n: '17' });
    const ac = L({ v: 1, t: 'achat', tx: '7', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_x' });
    dit(bo.essentiel.join(' · ') === 'N°42 · Nike Air Max 90' && bo.geste.k === 'bordereau' && bo.geste.mot === 'bordereau prêt' && ve.essentiel.join(' · ') === 'N°17 · 55 € · Adidas Samba' && !ve.geste && ac.essentiel.join(' · ') === '45,00 € · Nike Air Force 1' && !ac.geste, 'faits courts d’abord (N°, montant), le nom de l’article en dernier ; « bordereau prêt » est le geste ; « reçu de commande » se tait sur la ligne', JSON.stringify([bo, ve, ac]));
    const nl = L({ v: 1, t: 'connu-sans-action', f: 'newsletter Vinted' });
    const inc = L({ v: 1, t: 'incompris' }, { etat: 'a-verifier' });
    const att = L({ v: 1, t: 'bordereau', tx: '1', n: '4', pdf: 1 }, { etat: 'erreur' });
    dit(nl.rien && !nl.geste && inc.geste.k === 'verifier' && inc.geste.mot === 'à vérifier' && gesteAmbre(inc.geste) && inc.essentiel.length === 0 && att.geste.mot === 'en attente', '« rien à faire » marqué ; « à vérifier » prime (ambre) ; « en attente » pour une erreur de rangement', JSON.stringify([nl, inc, att]));
    const ntl = L({ v: 1, t: 'bordereau', tx: '1', n: '42', nt: 1, pdf: 1, av: 'num-titre', a: 'Nike Air Max 90' });
    const anc = L(null, { type: 'bordereau', subject: 'Bordereau d’envoi pour Vans Old Skool' });
    dit(!/42/.test(JSON.stringify(ntl)) && anc.essentiel.join() === 'détail non gardé' && !anc.geste && !/Vans/.test(JSON.stringify(anc)), '§5 la ligne n’écrit jamais un N° retrouvé par le titre ; un e-mail ancien ne reçoit ni détail ni geste tirés du sujet');
    // Une seule source : chaque mot de la ligne est un détail de `titreSimple` (ou son délai réécrit).
    const toutes = [ret, dem, bo, ve, ac, nl, inc, ntl, anc];
    const sources = [{ v: 1, t: 'suivi', s: 'MR1', st: 'available', code: '418205', lieu: 'Relais Tabac du Port', lim: '2026-11-09' }, { v: 1, t: 'vente-vestiaire', a: 'Jordan 1 Mid', mt: '82,40', lim: '2026-11-06' }, { v: 1, t: 'bordereau', tx: '1', n: '42', pdf: 1, a: 'Nike Air Max 90' }, { v: 1, t: 'vente', a: 'Adidas Samba', px: '55', n: '17' }, { v: 1, t: 'achat', tx: '7', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_x' }];
    dit(sources.every((r, i) => toutes[i].essentiel.every((x) => titreSimple(E(r)).details.includes(x))), 'chaque mot de l’essentiel est un détail de titreSimple (rien d’ajouté)');
    dit(monogramme('Mondial Relay') === 'MR' && monogramme('Chronopost') === 'C' && monogramme('La Poste') === 'LP' && monogramme('exemple.test') === 'E' && monogramme('Expéditeur non lu') === '?' && monogramme('') === '?', 'monogramme neutre : « MR », « C », « LP », un domaine ⇒ sa première lettre, inconnu ⇒ « ? »');
    dit(joursAvant('2026-11-06', T) === 1 && joursAvant('05/11/2026', T) === 0 && joursAvant('06/11', T) === null && joursAvant('n’importe', T) === null, 'joursAvant : date LUE avec son année, sinon null (pas su)');
  }
  {
    const { MESSAGERIES, EXPEDITEURS, ADRESSE_EXEMPLE, BOITE_VRM_EXEMPLE, regleFiltre } = await import(path.join(R, 'src/relierBoite.js'));
    const { ADRESSE_COLLECTRICE } = await import(path.join(R, 'api/_lib/proprietaire-email.js'));
    dit(['gmail', 'icloud', 'outlook', 'fai', 'autre'].every((id) => MESSAGERIES.some((m) => m.id === id && m.etapes.length >= 4)), 'cinq messageries (Gmail, iCloud, Outlook, Orange/SFR/Free, autre), chacune étape par étape');
    dit(['vinted', 'mondialrelay', 'chronopost', 'vintedgo', 'relaiscolis', 'leboncoin', 'ebay', 'vestiaire'].every((id) => EXPEDITEURS.some((x) => x.id === id)), 'les huit expéditeurs demandés');
    dit(/\.test$/.test(ADRESSE_EXEMPLE) && /\.test$/.test(BOITE_VRM_EXEMPLE) && ADRESSE_EXEMPLE !== ADRESSE_COLLECTRICE, 'adresses de la scène INVENTÉES (domaine .test réservé)');
    const g = regleFiltre('gmail', ['vinted', 'mondialrelay']);
    dit(g.texte === 'vinted OR mondialrelay' && g.lignes.length === 1, 'Gmail : une ligne pour le champ « De »', JSON.stringify(g));
    const ic = regleFiltre('icloud', ['vinted', 'ebay']);
    dit(ic.lignes.length === 2 && /vinted/.test(ic.lignes[0]), 'iCloud : une règle par expéditeur');
    dit(regleFiltre('gmail', []).texte === '', 'aucun expéditeur coché : aucune règle');
    const sans = (f) => fs.readFileSync(path.join(R, f), 'utf8').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const page = sans('src/RelierBoite.jsx') + sans('src/relierBoite.js');
    dit(!/\bfetch\s*\(|requeteJson|XMLHttpRequest|sendBeacon|['"`]\/api\//.test(page.replace(/^import[^\n]*$/gm, '')), '« Relier ma boîte » n’appelle AUCUNE route : rien d’envoyé à personne');
    dit(/prefers-reduced-motion/.test(fs.readFileSync(path.join(R, 'src/boite-emails.css'), 'utf8')) && /prefers-reduced-motion/.test(page), 'mouvement réduit respecté (CSS figée, lecture auto coupée)');
    const ecran = sans('src/BoiteEmails.jsx');
    dit(!/dangerouslySetInnerHTML|innerHTML/.test(ecran + page), 'aucun HTML injecté : le corps est du texte');
  }

  // ── 5. L'APP ──────────────────────────────────────────────────────────────
  {
    const APP = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    // (5 nov.) La liste blanche de `goto` est `ONGLETS_LIENS` (une seule liste, aussi pour la reprise ; `TABS_OK` la reprend).
    const tabs = (/const (?:TABS_OK|ONGLETS_LIENS)=\[([^\]]*)\]/.exec(APP) || [])[1] || '';
    dit(/'emails'/.test(tabs), '`?tab=emails` accepté (liste blanche de `goto`)');
    dit(/\{id:'emails',\s*icon:'mail',\s*label:'E-mails'\}/.test(APP), 'l’écran est dans la navigation (icône « mail », nom nu)');
    dit((APP.match(/tab==='emails'&&<Suspense/g) || []).length === 1 && /lazy\(\(\) => import\("\.\/BoiteEmails\.jsx"\)\)/.test(APP), 'l’écran est MONTÉ (une fois, chargé à la demande)');
    const css = fs.readFileSync(path.join(R, 'src/boite-emails.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    dit(!/inline-flex/.test(css) && !/-webkit-overflow-scrolling/.test(css) && !/#(?:FF3B30|FF453A|D70015|C00|E00)/i.test(css), 'styles : pas d’inline-flex, pas de défilement tactile WebKit, pas de rouge');
  }

  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s)` : `\n✅ tout est vert (${ok} contrôles)`);
  process.exit(ko ? 1 : 0);
})();
