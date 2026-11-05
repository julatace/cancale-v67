#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT — LES EMAILS DE VENTE VESTIAIRE COLLECTIVE (2 novembre)
// ════════════════════════════════════════════════════════════════════════════
// Exécute la VRAIE route `api/email-inbound.js` (§4.10) contre une fausse base
// Supabase servie dans sa forme réelle (app_data owner/id/data, `owner=eq.`,
// `data->>rev=eq.|is.null`, PATCH `return=representation`), sur des emails
// FABRIQUÉS fidèles à la forme reçue par Julien le 2 nov. (HTML en tableaux,
// version texte, et email BRUT MIME en quoted-printable avec un sujet encodé
// RFC 2047). Aucune donnée réelle : annonce, marque, montants, adresses inventés.
//
// Ce qui est prouvé :
//   V  la vente est reconnue : productId (sujet = Réf), « Vous gagnez » exact en
//      EUR (jamais le prix de vente à sa place), date limite 23:59:59 heure de
//      Paris, date de vente, étiquette, photo de CETTE annonce ;
//   D  UNE vente : déjà lue par l'extension (même productId, même sous une autre
//      clé) ⇒ complétée, jamais doublée ; `aExpedier` et l'état d'une vente
//      connue ne bougent pas ; un montant sûr n'est jamais remplacé ; rejeu ⇒
//      rien de plus ;
//   I  deux références différentes ⇒ rien rangé, email gardé entier ;
//   Q  adresse de réception inconnue ⇒ quarantaine au propriétaire NEUTRE, rien
//      dans les ventes de personne ;
//   E  lecture de `vc_ventes` ratée / écriture ratée ⇒ 503, rien d'écrit ;
//   R  les règles de l'app : la vente est « à poster » (colisVcAPoster), son
//      argent compte (montantRecuVc), le CA reste daté au VERSEMENT (aucun
//      `verseLe` posé par l'email de vente) ;
//   A  un autre email Vestiaire (forme pas apprise) est gardé ENTIER, jamais
//      pris pour une vente Vinted.
'use strict';
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

// ── Les emails fabriqués (la forme reçue, données inventées) ───────────────
const HTML = ({ pid = PID, ref = PID, gain = '139,50', prix = '150,00', vente = '14/11/26', limite = 'samedi 21 novembre', bouton = true } = {}) => `<!DOCTYPE html><html><head><style>.x{color:#000!important}@media screen{td{padding:0}}</style></head><body>
<table width="100%"><tr><td><img src="https://www.vestiairecollective.com/assets/emails/logo-vc.png" alt="Vestiaire Collective"></td></tr>
<tr><td><h1>Votre article a été vendu&nbsp;: il est temps de l&#39;expédier</h1></td></tr>
<tr><td>Vente confirmée</td><td>${vente}</td><td>Expédié</td><td>Paiement effectué</td></tr>
<tr><td><p>Félicitations ! Merci d&rsquo;expédier votre article avant le ${limite} en utilisant l&#39;étiquette d&#39;expédition prépayée.</p>
<p>Si vous manquez la période d&#39;expédition de 7 jours, votre vente sera automatiquement annulée.</p></td></tr>
${bouton ? `<tr><td><a href="https://click.e.vestiairecollective.com/?qs=abc123" class="btn">Télécharger l&#39;étiquette d&#39;envoi</a></td></tr>` : ''}
<tr><td><h2>Détails de la vente</h2></td></tr>
<tr><td><img src="https://images.vestiairecollective.com/produit/${pid}-1_1.jpg?w=200" width="120"></td>
<td><div>Réf&nbsp;: ${ref}</div><div><b>LOEWE</b></div><div>Pochette en cuir Puzzle</div><div>Envoi Direct</div>
<div>Votre prix de vente&nbsp;: ${prix}&nbsp;€</div><div>Vous gagnez&nbsp;: ${gain}&nbsp;€</div></td></tr>
<tr><td>Recevez votre paiement 72h après la livraison.</td></tr>
<tr><td style="font-size:10px">Vestiaire Collective S.A., société anonyme, RCS Paris — données inventées pour le banc</td></tr></table></body></html>`;
const FROM = '"Vestiaire Collective" <noreply_at_vestiairecollective_com_ab12cd34ef@privaterelay.appleid.com>';
const SUJET = (pid = PID) => `Votre article vient d’être vendu (#${pid})`;
let n = 0;
const json = (o = {}) => ({ messageId: `<vc-${++n}@banc>`, from: FROM, to: ADR, subject: SUJET(o.pid), text: '', html: HTML(o), attachments: [], source: 'gmail-v2', sourceDate: o.sourceDate || '2026-11-14T13:20:00.000Z', ...(o.extra || {}) });
// Le même email en BRUT MIME : sujet RFC 2047, HTML en quoted-printable.
const qp = (s) => Buffer.from(s, 'utf8').toString('binary').split('').map((c) => { const b = c.charCodeAt(0); return (b > 126 || c === '=') ? '=' + b.toString(16).toUpperCase().padStart(2, '0') : c; }).join('').replace(/(.{70})/g, '$1=\r\n');
const mime = (o = {}) => {
  const sujet = '=?UTF-8?Q?' + qp(`Votre article vient d'être vendu (#${o.pid || PID})`).replace(/=\r\n/g, '').replace(/ /g, '_').replace(/\(/g, '=28').replace(/\)/g, '=29') + '?=';
  return [
    `From: ${FROM}`, `To: ${ADR}`, `Subject: ${sujet}`, `Message-ID: <vc-mime-${++n}@banc>`, 'Date: Sat, 14 Nov 2026 14:20:00 +0100', 'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="b1"', '', '--b1', 'Content-Type: text/html; charset="UTF-8"', 'Content-Transfer-Encoding: quoted-printable', '',
    qp(HTML(o)), '--b1--', ''].join('\r\n');
};

const faireRes = () => { const x = { code: null, corps: null }; x.status = (c) => { x.code = c; return x; }; x.json = (b) => { x.corps = b; return x; }; x.setHeader = () => {}; x.end = () => x; return x; };

(async () => {
  process.env.VRM_OWNER_UID = J;
  process.env.EMAIL_INBOUND_SECRET = 'cle-banc-vc';
  const route = await import('file://' + path.join(R, 'api', 'email-inbound.js') + '?vc');
  let regle = {}, lecture = null;
  try { regle = await import(path.join(R, 'api/_lib/vestiaire-regle.js')); } catch (_) {}
  try { lecture = await import(path.join(R, 'api/_lib/vestiaire-email.js')); } catch (_) {}
  const envoyer = async (body, e = {}) => { etat = e; const res = faireRes(); await route.default({ method: 'POST', query: {}, headers: { 'x-vrm-email-key': 'cle-banc-vc' }, body }, res); return res; };
  const ventes = () => ((base.get(k(J, 'vc_ventes')) || {}).ventes) || {};
  const inconnus = (o = J) => [...base.keys()].filter((x) => x.startsWith(o + '|email_inconnu_')).map((x) => base.get(x));

  await essaie('V — vente reconnue (forme Gmail : JSON, HTML en tableaux)', async () => {
    base = new Map();
    const r = await envoyer(json());
    dit(r.code === 200 && r.corps && r.corps.type === 'vente-vestiaire', 'V1 classée « vente Vestiaire », 200', JSON.stringify(r.corps).slice(0, 200));
    const v = ventes()[PID];
    dit(!!v && Object.keys(ventes()).length === 1, 'V2 UNE vente rangée dans vc_ventes sous le productId du sujet', JSON.stringify(ventes()).slice(0, 200));
    dit(v && v.montant && v.montant.valeur === 139.5 && v.montant.devise === 'EUR', 'V3 « Vous gagnez » 139,50 € exact, en EUR (pas le prix de vente 150,00)', JSON.stringify(v && v.montant));
    dit(v && v.limite === '2026-11-21T23:59:59+01:00', 'V4 date limite = 21 nov. 23:59:59 heure de Paris', v && v.limite);
    dit(v && v.date === '2026-11-14T13:20:00.000Z', 'V5 date de vente = l’heure de l’email (même jour que « Vente confirmée »)', v && v.date);
    dit(v && v.aExpedier === true && v.etiquette === true, 'V6 à expédier, étiquette prépayée annoncée', JSON.stringify({ a: v && v.aExpedier, e: v && v.etiquette }));
    dit(v && v.photo === `https://images.vestiairecollective.com/produit/${PID}-1_1.jpg?w=200`, 'V7 photo = celle de CETTE annonce (pas le logo)', v && v.photo);
    dit(v && /LOEWE/.test(v.titre) && /Pochette/.test(v.titre), 'V8 marque + titre pour l’affichage', v && v.titre);
    dit(v && Array.isArray(v.sources) && v.sources.includes('email') && !v.verseLe, 'V9 source « email », aucune date de versement posée (CA daté au versement)', JSON.stringify(v && v.sources));
    const ligne = base.get(k(J, 'vc_email_vente_' + PID));
    dit(ligne && ligne.prixVente && ligne.prixVente.valeur === 150 && ligne.montant.valeur === 139.5, 'V10 l’email tel que lu gardé dans sa ligne (prix de vente 150,00 et gain 139,50)');
    dit(![...base.keys()].some((x) => /\|email_sale_|\|email_track_/.test(x)), 'V11 jamais pris pour une vente Vinted ni pour un suivi de colis');
    const suivi = [...base.entries()].find(([x]) => x.startsWith(J + '|email_reception_'));
    dit(suivi && suivi[1].etat === 'integre' && suivi[1].resume && suivi[1].resume.t === 'vente-vestiaire' && suivi[1].resume.p === PID, 'V12 « ce que VRM en a fait » : vente Vestiaire, intégrée, annonce nommée', JSON.stringify(suivi && suivi[1].resume));
    if (regle.colisVcAPoster) {
      const c = regle.colisVcAPoster({ ventes: ventes(), liens: {} }, Date.parse('2026-11-20T10:00:00Z'));
      dit(Array.isArray(c) && c.length === 1 && c[0].jours === 1, 'R1 Colis → à envoyer : 1 colis, limite demain (règle de l’app)', JSON.stringify(c));
      dit(regle.montantRecuVc(v).eur === 139.5, 'R2 l’argent compte : montantRecuVc = 139,50', JSON.stringify(regle.montantRecuVc(v)));
      dit(regle.dateVersementVc(v) === 0, 'R3 pas de date de versement : aucun mois de CA déclaré (vendu ≠ reçu)');
    } else dit(false, 'R règles de l’app introuvables');
  });

  await essaie('V — même vente en email BRUT (MIME, quoted-printable, sujet RFC 2047)', async () => {
    base = new Map();
    const r = await envoyer({ raw: mime() });
    const v = ventes()[PID];
    dit(r.code === 200 && v && v.montant && v.montant.valeur === 139.5 && v.limite === '2026-11-21T23:59:59+01:00', 'V13 forme MIME brute : même vente, mêmes montant et limite', JSON.stringify(r.corps).slice(0, 200));
  });

  await essaie('D — une seule vente avec l’extension', async () => {
    // L'extension a déjà lu la vente (forme réelle de vc_ventes, mesurée le 2 nov.) — et l'a vue partir.
    const ext = { productId: PID, ref: '', etat: 'shipmentInProgress', date: '2026-11-14 14:25:00', montant: { cle: 'sellerEarning', devise: 'EUR', valeur: 139.5 },
      limite: '2026-11-21T23:59:59+01:00', suivi: 'AB123', transporteur: 'Colissimo', titre: 'Pochette', photo: 'https://images.vestiairecollective.com/p/x.jpg',
      etiquette: true, aExpedier: false, plusAExpedierDepuis: '2026-11-15T09:00:00Z', sources: ['ventes', 'a-expedier'], vuAt: '2026-11-15T09:00:00Z', premiereVue: '2026-11-14T14:30:00Z', compte: '777' };
    base = new Map([[k(J, 'vc_ventes'), { ventes: { [PID]: { ...ext } }, lectures: { 'a-expedier': { at: '2026-11-15T09:00:00Z', total: 0, complet: true } }, capturedAt: '2026-11-15T09:00:00Z' }]]);
    const r = await envoyer(json());
    const vv = ventes(), v = vv[PID];
    dit(r.code === 200 && Object.keys(vv).length === 1, 'D1 toujours UNE vente (pas de doublon)', Object.keys(vv).join(','));
    dit(v.aExpedier === false && v.etat === 'shipmentInProgress' && v.plusAExpedierDepuis, 'D2 un colis parti ne redevient PAS « à expédier »', JSON.stringify({ a: v.aExpedier, e: v.etat }));
    dit(v.montant.cle === 'sellerEarning' && v.titre === 'Pochette' && v.compte === '777' && v.suivi === 'AB123', 'D3 rien de ce que l’extension a lu n’est écrasé');
    dit(v.sources.includes('email') && v.sources.includes('ventes'), 'D4 la source « email » s’ajoute');
    dit(base.get(k(J, 'vc_ventes')).lectures && base.get(k(J, 'vc_ventes')).capturedAt === '2026-11-15T09:00:00Z', 'D5 les lectures de l’extension sont gardées');
    const r2 = await envoyer(json());
    dit(r2.code === 200 && r2.corps.nouvelle === false && Object.keys(ventes()).length === 1, 'D6 rejeu du même email : rien de plus');
    // Montant pas sûr chez l'extension ⇒ le montant sûr de l'email le remplace.
    base = new Map([[k(J, 'vc_ventes'), { ventes: { [PID]: { ...ext, montant: { cle: 'price', devise: 'EUR', valeur: 150 } } } }]]);
    await envoyer(json());
    dit(ventes()[PID].montant.valeur === 139.5 && ventes()[PID].montant.cle === 'vousGagnez', 'D7 un montant « pas sûr » est remplacé par « Vous gagnez »');
    // Rangée sous une AUTRE clé avec le même productId ⇒ c'est elle.
    base = new Map([[k(J, 'vc_ventes'), { ventes: { 'cmd-998877': { ...ext } } }]]);
    await envoyer(json());
    dit(Object.keys(ventes()).length === 1 && ventes()['cmd-998877'].sources.includes('email'), 'D8 même productId sous une autre clé : la même vente', Object.keys(ventes()).join(','));
    // Une AUTRE annonce n'est jamais touchée.
    base = new Map([[k(J, 'vc_ventes'), { ventes: { '40000999': { ...ext, productId: '40000999' } } }]]);
    await envoyer(json());
    dit(Object.keys(ventes()).length === 2 && !ventes()['40000999'].sources.includes('email'), 'D9 une autre annonce (même titre, même marque) n’est jamais touchée');
  });

  await essaie('I — identité', async () => {
    base = new Map();
    const r = await envoyer(json({ ref: '40000777' }));
    dit(r.code === 200 && Object.keys(ventes()).length === 0, 'I1 sujet #40000123 et Réf 40000777 : rien rangé', JSON.stringify(r.corps).slice(0, 160));
    const g = inconnus();
    dit(g.length === 1 && g[0].type === 'inconnu' && /RCS Paris/.test(g[0].brut), 'I2 email gardé ENTIER pour vérification (jamais tronqué)', g[0] && g[0].brut.length);
  });

  await essaie('Q — adresse de réception non prouvée', async () => {
    base = new Map();
    const r = await envoyer(json({ extra: { to: 'inconnu-vc@privaterelay.appleid.com' } }));
    const q = [...base.keys()].filter((x) => x.startsWith(NEUTRE + '|email_quarantaine_'));
    dit(r.code === 200 && r.corps.quarantaine === true && q.length === 1, 'Q1 quarantaine au propriétaire neutre', JSON.stringify(r.corps).slice(0, 160));
    dit(![...base.keys()].some((x) => /vc_ventes|vc_email_vente_/.test(x)), 'Q2 aucune vente rangée chez personne');
  });

  await essaie('E — pannes', async () => {
    base = new Map();
    let r = await envoyer(json(), { lectureKO: 'vc_ventes' });
    dit(r.code === 503 && !base.has(k(J, 'vc_ventes')), 'E1 lecture de vc_ventes ratée ⇒ 503, rien écrit', r.code);
    base = new Map();
    r = await envoyer(json(), { ecritureKO: 'vc_' });
    dit(r.code === 503 && !base.has(k(J, 'vc_ventes')), 'E2 écriture ratée ⇒ 503', r.code);
    base = new Map([[k(J, 'vc_ventes'), { ventes: {} , rev: 4 }]]);
    r = await envoyer(json(), { ecritureKO: 'vc_ventes' });
    dit(r.code === 503 && Object.keys(ventes()).length === 0, 'E3 écriture de vc_ventes refusée ⇒ 503', r.code);
  });

  await essaie('A — un autre email Vestiaire', async () => {
    base = new Map();
    const r = await envoyer({ ...json(), subject: 'Votre article est en route vers notre équipe d’experts', html: '<p>Votre colis a bien été déposé. Il sera livré à nos experts.</p>' + 'x'.repeat(3000) });
    dit(r.code === 200 && !base.has(k(J, 'vc_ventes')) && ![...base.keys()].some((x) => /email_sale_/.test(x)), 'A1 pas une vente, rien rangé dans les ventes');
    const g = inconnus();
    dit(g.length === 1 && g[0].type === 'inconnu' && g[0].brut.length > 3000, 'A2 gardé ENTIER (forme à apprendre)', JSON.stringify(r.corps) + ' ' + JSON.stringify(g.map((x) => [x.type, x.raison, x.brut.length])));
  });

  await essaie('P — fonctions pures', async () => {
    if (!lecture) { dit(false, 'P module api/_lib/vestiaire-email.js absent'); return; }
    const L = lecture;
    dit(L.limiteDuTexte('expédiez votre article avant le lundi 9 novembre', { a: 2026, m: 11 }) === '2026-11-09T23:59:59+01:00', 'P1 « lundi 9 novembre » ⇒ +01:00 (heure d’hiver)');
    dit(L.limiteDuTexte('expédiez votre article avant le jeudi 9 juillet', { a: 2026, m: 7 }) === '2026-07-09T23:59:59+02:00', 'P2 juillet ⇒ +02:00 (heure d’été)');
    dit(L.limiteDuTexte('expédiez votre article avant le lundi 4 janvier', { a: 2026, m: 12 }) === '2027-01-04T23:59:59+01:00', 'P3 vente de décembre, limite en janvier ⇒ année suivante');
    dit(L.limiteDuTexte('expédiez votre article avant le 31 février', { a: 2026, m: 2 }) === '', 'P4 date impossible ⇒ rien (jamais devinée)');
    dit(L.nombreFr('1 203,23') === 1203.23 && L.nombreFr('203,23') === 203.23 && L.nombreFr('abc') === null, 'P5 montants à la française');
    const sans = L.lireEmailVenteVc({ from: FROM, subject: SUJET(), html: '' }, 'Réf : ' + PID + '\nVotre prix de vente : 150,00 €', '2026-11-14T13:20:00Z');
    dit(sans && sans.ok && sans.vente.montant === null, 'P6 « Vous gagnez » absent ⇒ montant null (jamais le prix de vente)');
    const usd = L.lireEmailVenteVc({ from: FROM, subject: SUJET(), html: '' }, 'Vous gagnez : $139.50', '2026-11-14T13:20:00Z');
    dit(usd && usd.ok && usd.vente.montant === null, 'P7 autre devise ⇒ montant null');
    dit(L.lireEmailVenteVc({ from: 'Vinted <no-reply@vinted.fr>', subject: SUJET(), html: '' }, '', '') === null, 'P8 l’expéditeur choisit la lecture : pas Vestiaire ⇒ rien');
    dit(L.photoDeLAnnonce('<img src="https://images.vestiairecollective.com/produit/40000999-1.jpg">', PID) === '', 'P9 photo d’une autre annonce ⇒ rien');
    dit(L.lireEmailVenteVc({ from: FROM, subject: SUJET(), html: '' }, 'Vente confirmée 14/11/26', '2026-11-16T10:00:00Z').vente.date === '2026-11-14', 'P10 email d’un autre jour que la vente ⇒ le jour seul');
  });

  await essaie('J — « Tes emails, ce que VRM en a fait »', async () => {
    const { resumeClassement } = await import(path.join(R, 'api/_lib/resume-email.js'));
    const { lectureEmail } = await import(path.join(R, 'src/journalEmail.js'));
    const r = resumeClassement(200, { type: 'vente-vestiaire', productId: PID, nouvelle: true, gain: '139.50', limite: '2026-11-21T23:59:59+01:00' }, { article: 'LOEWE Pochette' });
    const l = lectureEmail({ subject: SUJET(), etat: 'integre', type: 'vente-vestiaire', resume: r });
    dit(l.etat === 'range' && l.lien && l.lien.tab === 'cat_ventes' && /139,50/.test(l.quoi) && /21\/11/.test(l.fait) && l.fait.includes(PID), 'J1 la phrase dit l’argent reçu, la limite et l’annonce', JSON.stringify(l).slice(0, 200));
    dit(!/paire|chaussure/i.test(l.quoi + l.fait), 'J2 « l’article », jamais « la paire » (un sac n’est pas une paire)');
    const g = lectureEmail({ subject: SUJET(), etat: 'a-verifier', type: 'vente-vestiaire', resume: resumeClassement(200, { type: 'vente-vestiaire', garde: true }, {}) });
    dit(g.etat === 'verifier' && g.raison, 'J3 rien rangé ⇒ « à vérifier » avec la raison');
  });

  console.log(`\n${ok} ✅ · ${ko} ❌`);
  process.exit(ko ? 1 : 0);
})();
