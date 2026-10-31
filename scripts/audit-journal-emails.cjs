// ════════════════════════════════════════════════════════════════════════════
//  « TES EMAILS, CE QUE VRM EN A FAIT » — la règle EXÉCUTÉE (31 oct.)
//
//  1. La VRAIE route `api/email-inbound.js` est exécutée sur des emails de
//     forme réelle (données inventées) : la ligne de suivi `email_reception_*`
//     porte un RÉSUMÉ court (type, identités lues, raison « à vérifier »), le
//     texte lisible vit dans SA ligne (`email_texte_*`), jamais dans la liste.
//  2. La VRAIE route `api/email-rattacher.js?mode=journal` est exécutée sur une
//     base servie dans sa VRAIE forme (projection `select=` honorée) : jamais
//     `select=data`, filtre par l'owner de la SESSION, page de 20, poids d'une
//     page mesuré, texte lu un email à la fois, panne ⇒ 503.
//  3. La phrase (src/journalEmail.js) : chaque type → la bonne phrase et le bon
//     lien ; sans identité ⇒ « à vérifier » avec la raison ; un N° retrouvé par
//     le TITRE n'ouvre rien ; 50 reçus au même titre ne se confondent pas.
//  §4.10 : une fonction serverless n'est vérifiée que si on l'EXÉCUTE.
// ════════════════════════════════════════════════════════════════════════════
const path = require('path');
const R = path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 300)); } };

const J = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const LIGNE_J = { owner: J, data: { adresses: { 'recu@vrm.center': { owner: J } } } };

(async () => {
  // ── 1. LE CLASSEMENT ÉCRIT LE RÉSUMÉ ─────────────────────────────────────
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-journal';
  const ecrites = [];
  let etat = {};
  const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
  global.fetch = async (url, opts = {}) => {
    const u = decodeURIComponent(String(url));
    if (!u.includes('/rest/v1/')) return rep({});
    if ((opts.method || 'GET') === 'POST') {
      if (etat.ecritureKO) return rep('<html>503</html>', 503);
      try { JSON.parse(opts.body || '[]').forEach((x) => ecrites.push({ id: x.id, owner: x.owner || '', data: x.data })); } catch (_) {}
      return rep('', 201);
    }
    if (/select=owner&limit=1/.test(u)) return rep([{ owner: J }]);
    if (/id=eq\.vrm_email_owners/.test(u)) return rep([LIGNE_J]);
    if (/vrm_email_preuve_/.test(u)) { const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js')); return rep([{ id: idPreuve(J, 'recu@vrm.center'), owner: J, adresse: 'recu@vrm.center', etat: 'prouvee' }]); }
    return rep([]);
  };
  const faireRes = () => { const x = { code: null, corps: null }; x.status = (n) => { x.code = n; return x; }; x.json = (o) => { x.corps = o; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?journal');
  let n = 0;
  const envoyer = async (mail, e = {}) => {
    etat = e; ecrites.length = 0; n++;
    const res = faireRes();
    await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-journal' }, body: { messageId: `<journal-${n}@banc>`, to: 'recu@vrm.center', html: '', attachments: [], ...mail } }, res);
    const suivi = ecrites.find((x) => x.id.startsWith('email_reception_'));
    const texte = ecrites.find((x) => x.id.startsWith('email_texte_'));
    return { code: res.code, corps: res.corps, suivi, texte, ecrites: ecrites.slice() };
  };
  const PDF = { filename: 'Bordereau-Vinted-12345678901.pdf', contentType: 'application/pdf', contentB64: Buffer.from('%PDF-1.4 banc').toString('base64') };

  await essaie('bordereau', async () => {
    const o = await envoyer({ from: "L'équipe Vinted <no-reply@vinted.fr>", subject: "Bordereau d'envoi pour Nike Air Max 90 T42", text: "Ton bordereau d'envoi est prêt.\nN° de transaction : 12345678901\nÀ expédier avant le 05/11/2026 pour éviter l'annulation.", attachments: [PDF] });
    const r = o.suivi && o.suivi.data.resume;
    dit(o.code === 200 && r && r.t === 'bordereau' && r.tx === '12345678901' && r.pdf === 1 && /Nike Air Max 90/.test(r.a || ''), 'bordereau : le résumé porte le n° de transaction LU et l’article', JSON.stringify(r));
    dit(o.suivi && o.suivi.data.etat === 'integre' && !r.av, 'bordereau lu, PDF joint, sans N° deviné : « rangé »', o.suivi && o.suivi.data.etat);
    dit(o.suivi && JSON.stringify(r).length <= 200, 'le résumé pèse quelques dizaines d’octets (≤ 200)', String(JSON.stringify(r || {}).length));
    dit(o.suivi && !('texte' in o.suivi.data) && !JSON.stringify(o.suivi.data).includes('PDF-1.4') && !JSON.stringify(o.suivi.data).includes(PDF.contentB64), 'la ligne de suivi ne porte ni le texte ni la pièce jointe');
    dit(o.texte && o.texte.owner === J && /N° de transaction/.test(o.texte.data.texte) && o.texte.id === o.suivi.id.replace('email_reception_', 'email_texte_'), 'le texte lisible vit dans SA ligne, sous le même vendeur, même empreinte');
  });
  await essaie('bordereau sans PDF', async () => {
    const o = await envoyer({ from: 'no-reply@vinted.fr', subject: "Bordereau d'envoi pour Adidas Samba", text: 'N° de transaction : 22223333444' });
    const r = o.suivi && o.suivi.data.resume;
    dit(r && r.av === 'sans-pdf' && o.suivi.data.etat === 'a-verifier', 'bordereau sans PDF : « à vérifier », raison sans-pdf', JSON.stringify(r));
  });
  await essaie('bordereau illisible', async () => {
    const o = await envoyer({ from: 'no-reply@vinted.fr', subject: "Bordereau d'envoi pour Nike Dunk", text: 'Ton bordereau est prêt.' });
    const r = o.suivi && o.suivi.data.resume;
    dit(r && r.t === 'bordereau' && r.av === 'analyse' && !r.tx && o.suivi.data.etat === 'a-verifier', 'bordereau sans n° de transaction : « à vérifier », relié à RIEN (jamais par le titre)', JSON.stringify(r));
    dit(o.ecrites.some((x) => x.id.startsWith('email_inconnu_')), 'et l’email est gardé entier (on ne jette rien)');
  });
  await essaie('code de retrait', async () => {
    const o = await envoyer({ from: 'Mondial Relay <noreply@mondialrelay.fr>', subject: 'Votre colis 12345678 est disponible 📦', text: 'Bonjour,\nVotre colis est disponible.\nVotre code de retrait est 418205\nPoint Relais\nRelais Tabac du Port\n17 Rue du Port\n56000 Vannes\nHoraires' });
    const r = o.suivi && o.suivi.data.resume;
    dit(r && r.t === 'suivi' && r.st === 'available' && r.code === '418205' && r.s === '12345678' && /Tabac du Port/.test(r.lieu || ''), 'code de retrait : code, lieu et n° de suivi dans le résumé', JSON.stringify(r));
    dit(o.suivi.data.etat === 'integre', 'un colis relié par son n° de suivi est « rangé »');
  });
  await essaie('reçu d’achat', async () => {
    const o = await envoyer({ from: 'Vinted <no-reply@vinted.fr>', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', text: 'Merci pour ton achat !\nMontant payé : 45,00 €\n*N° de transaction* 98765432101\n' });
    const r = o.suivi && o.suivi.data.resume;
    dit(r && r.t === 'achat' && r.tx === '98765432101' && /^email_achat_/.test(r.id || '') && o.ecrites.some((x) => x.id === r.id), 'reçu : n° de transaction et id de SA ligne (celle qui vient d’être écrite)', JSON.stringify(r));
    const s = await envoyer({ from: 'Vinted <no-reply@vinted.fr>', subject: 'Ton reçu pour la commande « Nike Air Force 1 »', text: 'Merci pour ton achat !\nMontant payé : 45,00 €\n' });
    const r2 = s.suivi && s.suivi.data.resume;
    dit(r2 && r2.t === 'achat' && !r2.tx && r2.av === 'sans-tx' && s.suivi.data.etat === 'a-verifier', 'reçu au MÊME titre sans n° : « à vérifier », relié à aucun achat', JSON.stringify(r2));
  });
  await essaie('vente', async () => {
    const o = await envoyer({ from: 'no-reply@vinted.fr', subject: 'Ton article est vendu !', text: 'acheteur-de-banc a acheté [Nike Air Max 90] 42,00 €\nPrépare ton colis.' });
    const r = o.suivi && o.suivi.data.resume;
    dit(r && r.t === 'vente', 'vente : résumé « vente »', JSON.stringify(r));
  });
  await essaie('email inconnu', async () => {
    const o = await envoyer({ from: 'inconnu@exemple.test', subject: 'Une forme jamais vue', text: 'Bonjour <script>alert(1)</script> rien de connu ici.' });
    const r = o.suivi && o.suivi.data.resume;
    dit(r && r.t === 'incompris' && r.av === 'incompris' && o.suivi.data.etat === 'a-verifier', 'aucune règle : « pas compris », gardé', JSON.stringify(r));
    dit(o.ecrites.some((x) => x.id.startsWith('email_inconnu_')), 'il est conservé entier');
    dit(o.texte && !/<script/i.test(o.texte.data.texte), 'le texte gardé est du TEXTE : aucune balise', o.texte && o.texte.data.texte);
  });
  await essaie('texte borné', async () => {
    const o = await envoyer({ from: 'inconnu@exemple.test', subject: 'Long', text: 'x'.repeat(9000) });
    dit(o.texte && o.texte.data.texte.length <= 1501, 'le texte gardé est plafonné (1 500 caractères)', String(o.texte && o.texte.data.texte.length));
  });
  await essaie('panne', async () => {
    const o = await envoyer({ from: 'no-reply@vinted.fr', subject: 'Ton article est vendu !', text: 'x a acheté [Paire] 10,00 €' }, { ecritureKO: true });
    dit(o.code === 503, 'écriture ratée : 503 (le collecteur rejoue), jamais 200', String(o.code));
  });

  // ── 1 bis. LA RÈGLE DU RÉSUMÉ, ISOLÉE ────────────────────────────────────
  const { resumeClassement, texteBorne } = await import(path.join(R, 'api/_lib/resume-email.js'));
  {
    const r = resumeClassement(200, { type: 'bordereau', transaction: '123456789', numero: '42', pdf: true }, { parTitre: true, article: 'Nike' });
    dit(r.nt === 1 && r.av === 'num-titre', 'un N° retrouvé par le TITRE est marqué et met l’email « à vérifier »', JSON.stringify(r));
    const s = resumeClassement(200, { type: 'bordereau', transaction: '123456789', numero: '42', pdf: true }, { parTitre: false });
    dit(!s.nt && !s.av, 'un N° lu dans l’email n’est pas « à vérifier »', JSON.stringify(s));
    dit(resumeClassement(500, {}, {}).t === 'panne', 'un incident résume « panne » (à réessayer)');
    dit(texteBorne('<b>gras</b>\n\n\n\nfin') === 'gras\n\nfin', 'texteBorne retire les balises et resserre');
    dit(!('code' in resumeClassement(200, { type: 'suivi', carrier: 'mondialrelay', suivi: '', status: 'info' }, {})), '« pas su » est ABSENT, jamais une valeur vide');
  }

  // ── 2. LA ROUTE DU JOURNAL, SERVIE DANS SA VRAIE FORME ────────────────────
  const { lectureEmail } = await import(path.join(R, 'src/journalEmail.js'));
  const lignes = [];
  const types = [
    ['bordereau', { v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, a: 'Nike Air Max 90' }, 'integre'],
    ['suivi', { v: 1, t: 'suivi', tr: 'mondialrelay', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port' }, 'integre'],
    ['achat', { v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_abc123' }, 'integre'],
    ['achat', { v: 1, t: 'achat', a: 'Nike Air Force 1', px: '45,00', av: 'sans-tx' }, 'a-verifier'],
    ['ignoré', { v: 1, t: 'incompris', av: 'incompris' }, 'a-verifier'],
    ['vente', null, 'integre'],
  ];
  for (let i = 0; i < 45; i++) {
    const [type, resume, et] = types[i % types.length];
    lignes.push({ owner: i === 3 ? B : J, id: `email_reception_${String(i).padStart(2, '0')}${'a'.repeat(62)}`, data: { at: new Date(Date.UTC(2026, 9, 31, 12, 0) - i * 60000).toISOString(), etat: et, type, subject: `Sujet ${i} ` + 'é'.repeat(80), from: 'Vinted <no-reply@vinted.fr>', adresses: ['recu@vrm.center'], resume, sourceDate: null, raison: '', documentsVerifies: false, suppressionAutorisee: false } });
  }
  lignes.push({ owner: J, id: 'email_texte_00' + 'a'.repeat(62), data: { texte: 'Bonjour <img src=x onerror=alert(1)> le texte', at: '2026-10-31T12:00:00Z' } });
  lignes.push({ owner: B, id: 'email_texte_03' + 'a'.repeat(62), data: { texte: 'SECRET DE B' } });
  const lectures = [];
  let panne = false;
  // La base, servie comme PostgREST : `select=` projette, `owner=eq.`, `id=like.`/`eq.`,
  // `data->>x=eq.`, `data->>type=in.()`, `data->adresses=cs.[]`, `limit`/`offset`.
  const servir = (url) => {
    const u = new URL(url), p = u.searchParams;
    lectures.push(decodeURIComponent(u.search));
    if (panne && /email_reception/.test(p.get('id') || '')) return rep('<html>522</html>', 522);
    const owner = (p.get('owner') || '').replace(/^eq\./, '');
    if (u.pathname.endsWith('/vinted_accounts')) return rep([]);
    let r = lignes.filter((x) => x.owner === owner);
    const id = p.get('id') || '';
    if (id.startsWith('eq.')) r = r.filter((x) => x.id === id.slice(3));
    else if (id.startsWith('like.')) { const pre = id.slice(5).replace(/\*$/, ''); r = r.filter((x) => x.id.startsWith(pre)); }
    else if (id.startsWith('in.')) { const l = id.slice(4, -1).split(','); r = r.filter((x) => l.includes(x.id)); }
    for (const [k, v] of p.entries()) {
      const m = /^data->>?(\w+)$/.exec(k); if (!m) continue;
      if (v.startsWith('eq.')) r = r.filter((x) => String(x.data[m[1]] ?? '') === v.slice(3));
      if (v.startsWith('in.(')) { const l = v.slice(4, -1).split(','); r = r.filter((x) => l.includes(String(x.data[m[1]] ?? ''))); }
      if (v.startsWith('cs.')) { const l = JSON.parse(v.slice(3)); r = r.filter((x) => Array.isArray(x.data[m[1]]) && l.every((a) => x.data[m[1]].includes(a))); }
    }
    r.sort((a, b) => String(b.data.at || '').localeCompare(String(a.data.at || '')) || a.id.localeCompare(b.id));
    const off = Number(p.get('offset') || 0), lim = Number(p.get('limit') || 1000);
    r = r.slice(off, off + lim);
    const sel = p.get('select') || '*';
    const proj = (x) => {
      if (sel === '*') return x;
      const o = {};
      for (const champ of sel.split(',')) {
        const [alias, expr] = champ.includes(':') ? champ.split(':') : [champ, champ];
        if (expr === 'id') o[alias] = x.id; else if (expr === 'data') o[alias] = x.data;
        else { const mm = /^data->>?(\w+)$/.exec(expr); if (mm) o[alias] = x.data[mm[1]] === undefined ? null : x.data[mm[1]]; else if (expr === 'emails' || expr === 'labels') o[alias] = null; }
        if (/^data->vinted_account_(emails|labels)$/.test(expr)) o[alias] = (x.data[expr.replace('data->', '')]) || null;
      }
      return o;
    };
    return rep(r.map(proj));
  };
  global.fetch = async (url, opts = {}) => {
    const s = String(url);
    if (s.includes('/auth/v1/user')) return (opts.headers && (opts.headers.Authorization || opts.headers.authorization)) === 'Bearer session-J' ? rep({ id: J }) : rep({}, 401);
    if (/select=owner&limit=1/.test(s)) return rep([{ owner: J }]);
    if (s.includes('/rest/v1/')) return servir(s);
    return rep({});
  };
  const rattacher = await import('file://' + path.join(R, 'api', 'email-rattacher.js') + '?journal');
  const appeler = async (query, auth = 'Bearer session-J') => { const r = faireRes(); await rattacher.default({ method: 'GET', query: { mode: 'journal', ...query }, headers: auth ? { authorization: auth } : {} }, r); return r; };

  await essaie('journal : session', async () => {
    lectures.length = 0;
    const r = await appeler({}, '');
    dit(r.code === 401 && lectures.length === 0, 'sans session : 401, aucune lecture');
  });
  await essaie('journal : page', async () => {
    lectures.length = 0;
    const r = await appeler({ owner: B });
    const b = r.corps;
    dit(r.code === 200 && b.ok && b.emails.length === 20 && b.suite === true, 'une page = 20 emails, et la suite est annoncée', `${r.code} ${b && b.emails && b.emails.length}`);
    dit(lectures.every((q) => !/owner=eq\.2222/.test(q)), 'le paramètre `owner` est ignoré : seul le vendeur de la SESSION est lu');
    const recep = lectures.filter((q) => /email_reception/.test(q));
    dit(recep.length && recep.every((q) => !/select=(id,)?data(&|$)/.test(q) && !/texte/.test(q)), 'jamais `select=data` ni le texte dans la liste (§4.4)', recep.join(' | '));
    dit(!JSON.stringify(b).includes('SECRET') && !JSON.stringify(b).includes('<img'), 'aucun texte d’email dans la page');
    const poids = Buffer.byteLength(JSON.stringify(b));
    console.log(`   ↳ poids d'une page du journal : ${poids} octets (20 emails, sujets de 90 caractères accentués)`);
    dit(poids < 30000, `une page pèse moins de 30 Ko (${poids} o)`);
    dit(b.compteurs && b.compteurs.sur === 44 && b.compteurs.aVerifier === 13 && b.compteurs.incompris === 7, 'compteurs sur SES emails, avec leur couverture', JSON.stringify(b.compteurs));
    dit(b.emails[0].resume && b.emails[0].resume.tx === '12345678901', 'le résumé arrive tel qu’écrit');
    const p2 = (await appeler({ page: '2' })).corps;
    dit(p2.emails.length === 4 && p2.suite === false, 'la dernière page s’arrête et le dit', `${p2.emails.length}`);
  });
  await essaie('journal : filtres', async () => {
    const v = (await appeler({ etat: 'a-verifier' })).corps;
    dit(v.emails.length > 0 && v.emails.every((e) => e.etat === 'a-verifier'), 'filtre « à vérifier » appliqué par la base', String(v.emails.length));
    const t = (await appeler({ type: 'achat' })).corps;
    dit(t.emails.length > 0 && t.emails.every((e) => e.type === 'achat'), 'filtre par type', String(t.emails.length));
    const a = (await appeler({ adresse: 'autre@vrm.center' })).corps;
    dit(a.emails.length === 0, 'filtre par adresse : une autre adresse ne rend rien');
    const a2 = (await appeler({ adresse: 'Recu@VRM.center' })).corps;
    dit(a2.emails.length === 20, 'filtre par adresse normalisée');
  });
  await essaie('journal : compteurs seuls', async () => {
    lectures.length = 0;
    const c = (await appeler({ compte: '1' })).corps;
    dit(c.ok && c.compteurs.aVerifier === 13 && !c.emails, 'Colis : les compteurs seuls');
    dit(lectures.length === 1 && /select=etat:data->>etat,type:data->>type/.test(lectures[0]), 'une seule lecture, deux scalaires par email', lectures.join(' | '));
  });
  await essaie('journal : texte', async () => {
    lectures.length = 0;
    const t = (await appeler({ texte: 'email_reception_00' + 'a'.repeat(62) })).corps;
    dit(t.ok && t.texte === 'Bonjour <img src=x onerror=alert(1)> le texte', 'le texte d’UN email, sur demande');
    dit(lectures.length === 1 && /id=eq\.email_texte_00a+&/.test(lectures[0]) && /owner=eq\.1111/.test(lectures[0]), 'une lecture, une ligne, sous son owner', lectures.join(' | '));
    const autre = (await appeler({ texte: 'email_reception_03' + 'a'.repeat(62) })).corps;
    dit(autre.ok && autre.texte === null, 'le texte d’un AUTRE vendeur n’est jamais rendu (même id)', JSON.stringify(autre));
    const mauvais = await appeler({ texte: 'main' });
    dit(mauvais.code === 400, 'un identifiant qui n’est pas une ligne de suivi : 400', String(mauvais.code));
  });
  await essaie('journal : panne', async () => {
    panne = true;
    const r = await appeler({});
    panne = false;
    dit(r.code === 503, 'lecture ratée : 503 — jamais une liste vide', String(r.code));
  });

  // ── 3. LA PHRASE ─────────────────────────────────────────────────────────
  const L = (resume, extra = {}) => lectureEmail({ id: 'x', from: 'Vinted <no-reply@vinted.fr>', subject: 'Sujet', etat: 'integre', type: resume && resume.t, resume, ...extra });
  {
    const b = L({ v: 1, t: 'bordereau', tx: '12345678901', n: '42', pdf: 1, a: 'Nike Air Max 90' });
    dit(b.etat === 'range' && b.quoi === 'Bordereau de la vente Nike Air Max 90' && /Ajouté aux colis à expédier · vente n° 12345678901 · N°42/.test(b.fait) && b.lien.tab === 'cat_bord' && b.num === '42', 'bordereau : phrase, lien Colis, N° lu', JSON.stringify(b));
    const bt = L({ v: 1, t: 'bordereau', tx: '12345678901', n: '42', nt: 1, pdf: 1, av: 'num-titre' });
    dit(bt.etat === 'verifier' && bt.num === null && !/N°42/.test(bt.fait) && /titre/.test(bt.raison) && /carton/.test(bt.geste), 'N° par le titre : « à vérifier », raison + geste, AUCUN lien vers ce N°', JSON.stringify(bt));
    dit(b.delier && b.delier.offert === false && /transaction/.test(b.delier.pourquoi), 'bordereau : « Ce n’est pas ça » non proposé, et dit pourquoi');
    const c = L({ v: 1, t: 'suivi', s: '12345678', st: 'available', code: '418205', lieu: 'Relais Tabac du Port' });
    dit(c.quoi === 'Code de retrait 418 205 chez Relais Tabac du Port' && c.fait === 'Rangé avec le colis n° 12345678' && c.lien.tab === 'cat_bord' && c.de === 'Vinted', 'code de retrait : « Code de retrait 418 205 chez … »', JSON.stringify(c));
    const lv = L({ v: 1, t: 'suivi', s: 'XX1', st: 'delivered' }, { from: 'Chronopost <x@chronopost.fr>' });
    dit(lv.quoi === 'Colis livré' && lv.de === 'Chronopost' && lv.lien.tab === 'cat_achats', 'colis livré : de Chronopost, lien Achats', JSON.stringify(lv));
    const ss = L({ v: 1, t: 'suivi', st: 'available', av: 'sans-suivi' });
    dit(ss.etat === 'verifier' && /n° de suivi/.test(ss.raison) && !ss.cible, 'colis sans n° : « à vérifier », relié à rien');
    const a = L({ v: 1, t: 'achat', tx: '98765432101', a: 'Nike Air Force 1', px: '45,00', id: 'email_achat_abc' });
    dit(a.etat === 'range' && a.quoi === 'Reçu d’achat · Nike Air Force 1 (45,00 €)' && a.fait === 'Reçu rangé avec ton achat n° 98765432101' && a.delier.offert && a.lien.tab === 'cat_achats', 'reçu : phrase, lien Achats, « Ce n’est pas ça » proposé', JSON.stringify(a));
    const ad = lectureEmail({ id: 'x', from: '', subject: 's', etat: 'integre', resume: { v: 1, t: 'achat', tx: '98765432101', id: 'email_achat_abc' } }, { email_achat_abc: { tx: '98765432101' } });
    dit(ad.etat === 'delie' && ad.delier.delie && /Délié par toi/.test(ad.fait), 'reçu délié par lui : dit, et réversible (« Relier à nouveau »)');
    const st = L({ v: 1, t: 'achat', a: 'Nike Air Force 1', av: 'sans-tx' });
    dit(st.etat === 'verifier' && /transaction/.test(st.raison) && !st.cible && !st.delier, 'reçu sans n° : « à vérifier », jamais relié par le titre');
    const inc = L({ v: 1, t: 'incompris', av: 'incompris' }, { subject: 'Forme inconnue' });
    dit(inc.etat === 'incompris' && /jamais jeté/.test(inc.fait), 'pas compris : gardé, jamais jeté');
    const err = lectureEmail({ id: 'x', etat: 'erreur', subject: 'S', resume: { v: 1, t: 'panne', av: 'panne' } });
    dit(err.etat === 'reessai' && /renvoyer tout seul/.test(err.fait), 'en attente de réessai');
    const ancien = lectureEmail({ id: 'x', etat: 'integre', type: 'bordereau', subject: 'Vieux bordereau', resume: null });
    dit(ancien.fait === 'Classé avant le 31 oct. — détail non gardé.' && ancien.etat === 'range' && ancien.lien.tab === 'cat_bord', 'un email d’avant le résumé : « classé avant le 31 oct. — détail non gardé »');
    const o = L({ v: 1, t: 'offre', mt: '35', de: 'marie_b', a: 'Nike Dunk' });
    dit(o.quoi === 'Offre de 35 € de marie_b sur Nike Dunk' && o.lien.tab === 'cat_msg', 'offre : phrase et lien Messages', o.quoi);
    // 50 reçus au même titre : chacun ne dit que SON n° ; aucun sans n° n'est relié.
    const recus = Array.from({ length: 50 }, (_, i) => L({ v: 1, t: 'achat', a: 'Nike Air Force 1', px: '45,00', ...(i % 5 ? { tx: String(10000000000 + i), id: 'email_achat_' + i } : { av: 'sans-tx' }) }));
    const bons = recus.every((x, i) => (i % 5 ? x.fait === `Reçu rangé avec ton achat n° ${10000000000 + i}` && x.cible.v === String(10000000000 + i) : x.cible === null && x.etat === 'verifier'));
    dit(bons, '50 reçus au même titre : chacun son n°, les sans-n° à vérifier — aucune ressemblance');
    dit(L({ v: 1, t: 'suivi', st: 'available', code: 'X12345' }, { from: 'noreply@vinted.com' }).de === 'Vinted' && lectureEmail({ from: 'Leboncoin <a@leboncoin.fr>', resume: { t: 'information' } }).de === 'Leboncoin' && lectureEmail({ from: 'eBay <ebay@ebay.fr>', resume: { t: 'information' } }).de === 'eBay', 'de qui : Vinted, Leboncoin, eBay lisibles');
  }

  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert'} (${ok} contrôles)`);
  process.exit(ko ? 1 : 0);
})();
