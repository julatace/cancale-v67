// ════════════════════════════════════════════════════════════════════════════
//  LA BOÎTE E-MAILS DU MONDE DES FILMS (13 nov., lot 49) — INVENTÉE.
//  Le monde de `_monde.cjs` + la route `/api/email-rattacher?mode=journal`
//  servie par la VRAIE fonction du serveur (`api/_lib/reception-email.js`,
//  `lireJournalEmail` / `lireEmailBoite`) sur une poignée d'e-mails fabriqués,
//  dans la forme de la base (`email_reception_*` + `email_texte_*`, le registre
//  des adresses, les lus). Les e-mails racontent le même monde : le code 480215
//  au Relais du Marché, le bordereau de l'Asics N°23, une offre, une vente.
//  Adresses en `.test`, pseudos inventés : rien ne vient d'une vraie boîte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { monde, T0 } = require('./_monde.cjs');
const RACINE = path.join(__dirname, '..', '..');
const { servir } = require(path.join(RACINE, 'scripts', 'bancs', '_minipgrest.cjs'));

const OWNER = '5f1e0c55-2b1d-4c3e-9f00-00000000f11a';
const ADR = 'atelier.basket@exemple.test';
const VINTED = "\"L'équipe Vinted\" <no-reply@vinted.fr>";
const MR = 'Mondial Relay <noreply@mondialrelay.fr>';
const iso = (ms) => new Date(ms).toISOString();
const H = 3600e3;

function emails() {
  const rows = [];
  const lim = (j) => iso(T0 + j * 24 * H).slice(0, 10);
  // [heures avant, type, de, sujet, résumé, texte, état]
  const E = [
    [0.3, 'suivi', MR, 'Votre colis 57203318 est disponible 📦', { v: 1, t: 'suivi', tr: 'mondialrelay', s: '57203318', st: 'available', code: '259036', lieu: 'Relais du Marché, 14 rue des Glycines, 35000 Rennes', lim: lim(6) },
      'Votre colis n° 57203318 est disponible !\n\nCODE DE RETRAIT\n\n259036\n\nPOINT RELAIS\n\nRelais du Marché, 14 rue des Glycines, 35000 Rennes'],
    [1.1, 'offre', VINTED, 'Nouvelle offre pour Nike Air Max 90 blanche T42', { v: 1, t: 'offre', a: 'Nike Air Max 90 blanche T42', mt: '72,00' },
      'Quelqu’un te propose d’acheter Nike Air Max 90 blanche T42 à un prix plus bas.\n\nNouvelle offre : 72,00 € au lieu de 85,00 €'],
    [6, 'bordereau', VINTED, `Bordereau d'envoi Vinted - à utiliser avant le ${lim(2).split('-').reverse().join('/')} pour Asics Japan S blanche T40`, { v: 1, t: 'bordereau', tx: '81001', a: 'Asics Japan S blanche T40', n: '23', pdf: 1, tp: 1 },
      'Retrouve ton bordereau d’envoi en pièce jointe de cet e-mail.\n\nArticle : Asics Japan S blanche T40\nN° de transaction : 81001'],
    [8.5, 'vente', VINTED, 'Ton article s’est vendu !', { v: 1, t: 'vente', a: 'Asics Japan S blanche T40', px: '44.00', ps: 'acheteuse-inventee' },
      'Ton article Asics Japan S blanche T40 s’est vendu : 44,00 €.\n\nExpédie cette commande au cours des 5 prochains jours.'],
    [20, 'suivi', MR, 'Votre colis 61847007 est disponible 📦', { v: 1, t: 'suivi', tr: 'mondialrelay', s: '61847007', st: 'available', code: '480215', lieu: 'Relais du Marché, 14 rue des Glycines, 35000 Rennes', lim: lim(5) },
      'Votre colis n° 61847007 est disponible !\n\nCODE DE RETRAIT\n\n480215'],
    [26, 'finalisation', VINTED, 'Ta commande est terminée', { v: 1, t: 'finalisation', mt: '68,00' }, 'L’argent est sur ton porte-monnaie.'],
    [30, 'connu-sans-action', VINTED, 'Tu as reçu une nouvelle évaluation', { v: 1, t: 'connu-sans-action', f: 'évaluation' }, 'Un membre t’a laissé une évaluation.'],
    [44, 'favori', VINTED, 'Quelqu’un a ajouté ton article à ses favoris', { v: 1, t: 'favori' }, 'Ton article plaît !'],
  ];
  E.forEach(([h, type, from, subject, resume, texte], i) => {
    const at = iso(T0 - h * H), cle = String(i + 1).padStart(2, '0') + 'f11a'.repeat(15);
    rows.push({ owner: OWNER, id: `email_reception_${cle}`, data: { at, etat: 'integre', type, subject, from, adresses: [ADR], receivedAt: at, sourceDate: iso(T0 - h * H - 40e3), messageId: `<film-${i}@exemple.test>`, raison: '', documentsVerifies: false, suppressionAutorisee: false, resume, pieces: type === 'bordereau' ? [{ n: 'Bordereau-81001.pdf', t: 'application/pdf', o: 52311 }] : [] } });
    rows.push({ owner: OWNER, id: `email_texte_${cle}`, data: { texte, at } });
  });
  // Lus : tout jusqu'à hier ; les plus récents ne le sont pas (points bleus).
  rows.push({ owner: OWNER, id: 'vrm_emails_lus', data: { v: 1, jusqua: iso(T0 - 25 * H), lus: [], nonlus: [], rev: 1 } });
  rows.push({ owner: OWNER, id: 'main', data: { vinted_account_emails: { 4101: ADR } } });
  rows.push({ owner: OWNER, id: 'vrm_email_owners', data: { adresses: { [ADR]: { owner: OWNER } } } });
  return rows;
}

function mondeEmails() {
  const m = monde();
  const rows = emails();
  const comptes = [{ owner: OWNER, vinted_user_id: '4101', login: 'atelier.basket' }];
  const fetcher = async (u) => {
    const url = new URL(u);
    const table = url.pathname.split('/').pop();
    if (table === 'vinted_accounts') return { ok: true, status: 200, json: async () => comptes.map((c) => ({ vinted_user_id: c.vinted_user_id, login: c.login })) };
    const { body } = servir(rows, u, {});
    return { ok: true, status: 200, json: async () => body };
  };
  let route = null;
  m.api = async (u, methode) => {
    const url = new URL(u);
    if (url.pathname !== '/api/email-rattacher') return undefined;
    const q = Object.fromEntries(url.searchParams.entries());
    if (q.mode !== 'journal') return undefined;
    if (methode !== 'GET') return { body: { ok: true } };
    route = route || await import(path.join(RACINE, 'api', '_lib', 'reception-email.js'));
    const opts = { owner: OWNER, url: 'http://base.test', headers: {}, fetcher };
    try {
      const j = q.lire ? await route.lireEmailBoite({ ...opts, id: q.lire, maintenant: T0 })
        : await route.lireJournalEmail({ ...opts, page: q.page, etat: q.etat || '', type: q.type || '', adresse: q.adresse || '', boite: q.boite || '', cherche: q.cherche || '', compteSeul: q.compte === '1', nonlus: q.nonlus === '1', parPage: Number.parseInt(q.parPage, 10) || undefined });
      return { body: j };
    } catch (e) { return { status: 503, body: { ok: false, error: String(e && e.message) } }; }
  };
  return m;
}

module.exports = { mondeEmails, emails };
