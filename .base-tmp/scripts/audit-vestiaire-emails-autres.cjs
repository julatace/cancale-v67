#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES AUTRES E-MAILS DE VESTIAIRE COLLECTIVE (9 nov.)
// ════════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE route `api/email-inbound.js` (§4.10) contre la fausse base de
// audit-vestiaire-email.cjs (forme réelle : owner/id/data, `data->>rev`, PATCH),
// sur les FORMES RÉELLES relevées par Julien le 9 nov. — valeurs INVENTÉES
// (réfs, marques, titres, prix, pseudos) : le dépôt est public.
//   R  « Il vous reste N jours pour expédier votre vente (#N) » : la limite de CETTE vente ;
//   A  « Annonce en attente de validation » / « … vient d'être mis en ligne » : l'annonce de SA Ref ;
//   O  contre-offre / offre acceptée : montant + échéance, jamais l'acheteur, jamais une vente ;
//   M  « Augmentez vos chances de vendre » : conservé, rien tiré ;
//   E  lecture / écriture ratée ⇒ 503.
'use strict';
require(require('path').join(__dirname, '_horloge-notif.cjs'));
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'cle-service-audit';
const path = require('path');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (c, l, d = '') => { if (c) { ok++; console.log('✅ ' + l); } else { ko++; console.log('❌ ' + l + (d ? ' — ' + d : '')); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.stack || e).slice(0, 400)); } };

const J = '11111111-1111-4111-8111-111111111111';
const NEUTRE = '00000000-0000-0000-0000-000000000000';
const ADR = 'relais-vc-test_9x@privaterelay.appleid.com';   // adresse « Masquer mon e-mail » inventée
const PID = '40000123';

// ── La fausse base ─────────────────────────────────────────────────────────
let base = new Map();
let etat = {};
const k = (o, i) => o + '|' + i;
const rep = (corps, status = 200) => new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status, headers: { 'content-type': status >= 500 ? 'text/html' : 'application/json' } });
global.fetch = async (url, o = {}) => {
  const u = new URL(String(url));
  if (!u.pathname.endsWith('/rest/v1/app_data')) return rep([]);
  const q = u.searchParams;
  const methode = (o.method || 'GET').toUpperCase();
  const id = (q.get('id') || '').replace(/^eq\./, '');
  const owner = (q.get('owner') || '').replace(/^eq\./, '');
  if (methode === 'GET') {
    if (q.get('select') === 'owner' && q.get('limit') === '1') return rep([{ owner: J }]);
    if (id === 'vrm_email_owners') return rep([{ owner: J, data: { adresses: { [ADR]: { owner: J } } } }]);
    if (String(q.get('id') || '').startsWith('like.vrm_email_preuve_') || /vrm_email_preuve_/.test(u.search)) {
      const { idPreuve } = await import(path.join(R, 'api/_lib/preuve-adresse.js'));
      return rep([{ id: idPreuve(J, ADR), owner: J, adresse: ADR, etat: 'prouvee' }]);
    }
    if (etat.lectureKO && id === etat.lectureKO) return rep('<html>522</html>', 522);
    if (!id || !owner) return rep([]);
    const d = base.get(k(owner, id));
    return rep(d === undefined ? [] : [{ id, data: d }]);
  }
  if (methode === 'POST') {
    const lignes = JSON.parse(o.body || '[]');
    if (etat.ecritureKO && lignes.some((l) => String(l.id).startsWith(etat.ecritureKO))) return rep('<html>503</html>', 503);
    const ignore = /ignore-duplicates/.test(((o.headers || {}).Prefer) || '');
    const out = [];
    for (const l of lignes) {
      if (!l.owner) return rep({ message: 'sans vendeur' }, 400);
      if (ignore && base.has(k(l.owner, l.id))) continue;
      base.set(k(l.owner, l.id), JSON.parse(JSON.stringify(l.data))); out.push({ id: l.id });
    }
    return rep(ignore ? out : '', 201);
  }
  if (methode === 'PATCH') {
    const kk = k(owner, id);
    if (!owner || !base.has(kk)) return rep([]);
    const d = base.get(kk);
    const rev = q.get('data->>rev');
    if (rev === 'is.null' ? d.rev != null : rev && String(d.rev) !== rev.replace(/^eq\./, '')) return rep([]);
    if (etat.ecritureKO && id.startsWith(etat.ecritureKO)) return rep('<html>503</html>', 503);
    base.set(kk, JSON.parse(o.body).data);
    return rep([{ id }]);
  }
  return rep([]);
};


// ── Les e-mails fabriqués : formes RÉELLES du 9 nov., valeurs INVENTÉES ──────
const FROM = '"Vestiaire Collective" <noreply_at_vestiairecollective_com_ab12cd34ef@privaterelay.appleid.com>';
const P1 = '40000777', P2 = '40000888';
let n = 0;
const mail = (subject, html, extra = {}) => ({ messageId: `<vca-${++n}@banc>`, from: FROM, to: ADR, subject, text: '', html, attachments: [], source: 'gmail-v2', sourceDate: '2026-11-10T09:00:00.000Z', ...extra });
const BLOC = (ref, marque, titre, extra = '') => `<tr><td><div>Ref&nbsp;: ${ref}</div><div><b>${marque}</b></div><div>${titre}</div>${extra}</td></tr>`;
const RAPPEL = (ref = P1, sujetRef = P1) => mail(`Il vous reste 6 jours pour expédier votre vente (#${sujetRef})`, `<table><tr><td><h1>N'oubliez pas d'expédier votre article</h1></td></tr>
<tr><td><p>Expédiez votre article avant le lundi 16 novembre, ou votre vente sera automatiquement annulée.</p></td></tr>${BLOC(ref, 'PRADA', 'Sac Re-Edition nylon')}</table>`);
const ATTENTE = () => mail('Annonce en attente de validation', `<table><tr><td>En attente de validation</td><td>07/11/26</td><td>Examinée</td><td>En ligne</td></tr>
${BLOC(P2, 'CELINE', 'Bottines Margaret', '<div>Prix de vente&nbsp;: 180 €</div><div>Pour vous&nbsp;: 144,00 €</div>')}</table>`);
const EN_LIGNE = () => mail('Votre Bottines Margaret Celine vient d’être mis en ligne', `<table><tr><td><div>Ref: ${P2}</div><div><b>CELINE</b></div><div>Bottines Margaret</div>
<div style="color:#999">La marque est passée de Céline à Celine.</div><div>Prix: 180 €</div><div>Vous gagnez: 144,00 €</div></td></tr></table>`);
const CONTRE = () => mail('Lunaire77 a fait une contre-offre', `<table><tr><td>OFFRES</td></tr><tr><td><h1>Contre-offre reçue</h1></td></tr>
<tr><td><b>CELINE</b> Bottines <s>180 €</s> 150,50 €</td></tr><tr><td>Contre-offre reçue : 150,50 €</td></tr>
<tr><td>Un acheteur a fait une contre-offre ! Vous n'avez que 48 heures pour l'accepter, la rejeter ou faire une autre contre-offre.</td></tr>
<tr><td><a href="https://www.vestiairecollective.com/fr/offers/1234567/?utm=x">Répondre à l'offre</a></td></tr></table>`);
const ACCEPTEE = () => mail('Lunaire77 a accepté votre offre !', `<table><tr><td>OFFRES</td></tr><tr><td><h1>Offre acceptée</h1></td></tr>
<tr><td><b>CELINE</b> Bottines <s>180 €</s> 160 €</td></tr><tr><td>Offre acceptée : 160 €</td></tr>
<tr><td>Bonne nouvelle Marius ! Votre offre à 160 € pour cet article a été acceptée par l'acheteur. Il a maintenant 24 heures pour profiter de ce prix réduit avant que l'offre n'expire.</td></tr></table>`);
const MARKETING = () => mail('Augmentez vos chances de vendre', `<table><tr><td>Prix recommandé : 150 €</td></tr><tr><td>Articles similaires vendus</td></tr><tr><td>${BLOC(P2, 'CELINE', 'Bottines Margaret')}</td></tr></table>`);

const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-vca';
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?vca');
  const envoyer = async (body, e = {}) => { etat = e; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-vca' }, body }, res); return res; };
  const ligne = (id) => base.get(k(J, id));
  const inconnus = () => [...base.keys()].filter((x) => x.startsWith(J + '|email_inconnu_'));
  const tout = () => JSON.stringify([...base.entries()].filter(([x]) => !/email_reception_|email_texte_|email_html_/.test(x)));

  await essaie('R', async () => {
    base = new Map();
    let r = await envoyer(RAPPEL());
    const v = ((ligne('vc_ventes') || {}).ventes || {})[P1];
    dit(r.code === 200 && v && v.limite === '2026-11-16T23:59:59+01:00' && v.productId === P1, 'R1 « Il vous reste 6 jours … (#N) » ⇒ la date limite de CETTE vente (sa réf), 23:59:59 Paris', JSON.stringify([r.corps, v]).slice(0, 300));
    dit(v && !/annul/i.test(JSON.stringify(v)) && !v.verseLe, 'R2 « ou votre vente sera automatiquement annulée » ne constate rien ; aucun versement posé');
    base.set(k(J, 'vc_ventes'), { rev: 3, ventes: { [P1]: { productId: P1, etat: 'Expédié', aExpedier: false, limite: '2026-11-15T23:59:59+01:00', titre: 'Prada' } } });
    r = await envoyer(RAPPEL());
    const v2 = ligne('vc_ventes').ventes[P1];
    dit(v2.aExpedier === false && v2.etat === 'Expédié' && v2.limite === '2026-11-15T23:59:59+01:00', 'R3 une vente connue : ni « à expédier », ni l’état, ni une limite déjà lue ne bougent', JSON.stringify(v2));
    base = new Map();
    const n0 = inconnus().length;
    r = await envoyer(RAPPEL('40000999', P1));
    dit(r.corps && r.corps.garde && !ligne('vc_ventes') && inconnus().length === n0 + 1, 'R4 réf du sujet ≠ Ref du corps ⇒ rien rangé, e-mail gardé entier', JSON.stringify(r.corps));
  });
  await essaie('A', async () => {
    base = new Map();
    let r = await envoyer(ATTENTE());
    let a = ((ligne('vc_email_annonces') || {}).annonces || {})[P2];
    dit(r.code === 200 && a && a.etat === 'attente' && a.prix === 180 && a.gain === 144 && a.marque === 'CELINE', 'A1 « Annonce en attente de validation » ⇒ l’annonce de SA Ref, prix et « pour vous » (ce qui sera versé)', JSON.stringify(a));
    r = await envoyer(EN_LIGNE());
    a = ligne('vc_email_annonces').annonces[P2];
    dit(a.etat === 'en_ligne' && a.attenteLe && a.enLigneLe && a.gain === 144, 'A2 « … vient d’être mis en ligne » (Ref: sans espace) ⇒ la même annonce passe « en ligne »', JSON.stringify(a));
    r = await envoyer(ATTENTE());
    dit(ligne('vc_email_annonces').annonces[P2].etat === 'en_ligne', 'A3 un « en attente » rejoué ne fait jamais redescendre une annonce en ligne');
    dit(!ligne('vc_ventes'), 'A4 une annonce n’est jamais une vente');
  });
  await essaie('O', async () => {
    base = new Map();
    let r = await envoyer(CONTRE());
    let o = Object.values((ligne('vc_email_offres') || {}).offres || {});
    dit(r.code === 200 && o.length === 1 && o[0].type === 'contre_offre' && o[0].montant === 150.5 && o[0].echeance === '2026-11-12T09:00:00.000Z', 'O1 contre-offre ⇒ montant 150,50 € et échéance réception + 48 h', JSON.stringify(o));
    dit(o[0] && o[0].lienForme === 'www.vestiairecollective.com/fr/offers/#######/', 'O2 le lien « Répondre à l’offre » : seule sa FORME est notée (chiffres masqués), jamais une identité', o[0] && o[0].lienForme);
    r = await envoyer(ACCEPTEE());
    o = Object.values(ligne('vc_email_offres').offres);
    const acc = o.find((x) => x.type === 'offre_acceptee');
    dit(acc && acc.montant === 160 && acc.echeance === '2026-11-11T09:00:00.000Z' && !ligne('vc_ventes'), 'O3 offre acceptée ⇒ 160 €, échéance + 24 h, et ce n’est PAS une vente', JSON.stringify(acc));
    dit(!/Lunaire77|Marius/.test(tout()), 'O4 ni le pseudo de l’acheteur ni le prénom du vendeur ne sont rangés (hors journal des e-mails)');
    dit(!ligne('vc_email_annonces') && !(ligne('vc_listings')), 'O5 jamais rattachée à une annonce (aucune réf)');
  });
  await essaie('M', async () => {
    base = new Map();
    const n0 = inconnus().length;
    const r = await envoyer(MARKETING());
    dit(r.code === 200 && [...base.keys()].some((x) => /email_texte_/.test(x)) && inconnus().length === n0 && !ligne('vc_email_annonces') && !ligne('vc_ventes') && !/150/.test(JSON.stringify(ligne('vc_email_offres') || {})), 'M1 « Augmentez vos chances de vendre » : conservé au journal, rien n’en est tiré (aucun prix conseillé)', JSON.stringify(r.corps));
  });
  await essaie('E', async () => {
    base = new Map();
    const r = await envoyer(ATTENTE(), { ecritureKO: 'vc_email_annonces' });
    dit(r.code === 503 && !ligne('vc_email_annonces'), 'E1 écriture ratée ⇒ 503 (le service rejoue), jamais 200');
    const r2 = await envoyer(CONTRE(), { lectureKO: 'vc_email_offres' });
    dit(r2.code === 503 && !ligne('vc_email_offres'), 'E2 lecture ratée ⇒ 503, rien écrit');
  });
  console.log(ko ? `\n❌ audit-vestiaire-emails-autres : ${ko} rouge(s) sur ${ok + ko}` : `\n✅ audit-vestiaire-emails-autres : ${ok} verts`);
  process.exit(ko ? 1 : 0);
})();
