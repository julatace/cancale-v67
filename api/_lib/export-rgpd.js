// ════════════════════════════════════════════════════════════════════════════
// « TÉLÉCHARGER TOUTES MES DONNÉES » — RGPD art. 15 et 20 (12 nov., lot
// agent2-ouverture-clients, validé par Julien : « indispensable »)
// ════════════════════════════════════════════════════════════════════════════
// Généré CÔTÉ SERVEUR, pour le compte de SA session (jeton vérifié par Supabase),
// page par page (`suite`) : chaque réponse reste sous la limite de Vercel
// (4,5 Mo), une ligne trop grande part en plusieurs morceaux du MÊME fichier.
// L'app assemble les morceaux dans un zip (un seul dossier) — elle n'ajoute rien.
//
// CE QUI PART : toutes ses lignes `app_data` (ventes, achats, annonces captées,
// e-mails rangés, réglages, factures Pro…), ses comptes de revente (identifiant,
// pseudo, site), son abonnement, son parrainage (son code, des NOMBRES), les
// signalements qu'il a envoyés, ses adresses prouvées, son e-mail de connexion.
// CE QUI NE PART PAS, et le fichier LISEZMOI le dit :
//   · les PDF de bordereau, pièces jointes d'e-mails, HTML bruts, transactions
//     brutes (lourds, ils se retéléchargent) : leur RÉSUMÉ part (id, date, `meta`) ;
//   · les jetons et clés (Vinted, eBay, widget, Photoroom, téléphones) : un
//     fichier téléchargé ne doit jamais pouvoir ouvrir un compte ;
//   · l'identité des AUTRES (le parrain, les filleuls) : seulement des nombres.
// ⚠️ CHAQUE lecture porte `owner=eq.<lui>` (ou, sous le propriétaire neutre /
//    le propriétaire de l'installation, `data->>owner` / `data->>de` = lui) ;
//    `scripts/audit-export-rgpd.cjs` sert deux vendeurs et exige que rien de
//    l'autre ne sorte. Lecture ratée ⇒ 503 : jamais une page vide qui aurait
//    l'air complète (« rien lu » ≠ « rien »).
// ════════════════════════════════════════════════════════════════════════════
import { sbCle } from './cle.js';
import { PROPRIETAIRE_NEUTRE } from './proprietaire-email.js';

// Lignes LOURDES : seul leur résumé part (motifs `like` de PostgREST).
export const LOURDS = ['harvest_*_txn_*', 'harvest_*_label_*', 'email_bord_*', 'email_html_*', 'email_qpj_*', 'backup_*', 'lbc_catalogue', 'lbc_recon', 'harvest_*_seen_urls', 'harvest_*_wreq_*', 'harvest_*_pickup_points'];
// Lignes SECRÈTES : rien ne part (ni contenu, ni résumé).
export const SECRETS = ['ebay_tokens*', 'push_subs', 'vrm_photoroom_cle', 'photoroom_cle', 'vrm_widget_token', 'vrm_sms_token', 'jeton_*', 'vrm_coffre*'];
// Un champ de jeton, où qu'il soit dans une ligne, est retiré.
const CLE_SECRETE = /^(access_token|refresh_token|csrf_token|id_token|client_secret|password|mot_de_passe|motDePasse|p256dh|auth|secret|cle_api|api_key|apiKey|token)$/i;
export function sansSecrets(v, prof = 0) {
  if (prof > 60 || v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map((x) => sansSecrets(x, prof + 1));
  const o = {};
  for (const k of Object.keys(v)) if (!CLE_SECRETE.test(k)) o[k] = sansSecrets(v[k], prof + 1);
  return o;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MORCEAU = 1500000;          // caractères par réponse (< 4,5 Mo une fois en JSON)
const LOT = 25;                          // lignes lues par appel
export const DOSSIER = (quand = new Date()) => `VRM-mes-donnees-${quand.toISOString().slice(0, 10)}`;
export const nomFichier = (id) => String(id).replace(/[^\w.-]+/g, '_').slice(0, 120) || 'ligne';

const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function lireCurseur(s) {
  if (!s) return { p: 'lignes', a: '', m: 0 };
  try {
    const c = JSON.parse(Buffer.from(String(s), 'base64url').toString('utf8'));
    if (!c || !['lignes', 'resumes', 'compte'].includes(c.p) || typeof c.a !== 'string' || !Number.isInteger(c.m) || c.m < 0 || (c.cur != null && typeof c.cur !== 'string')) return null;
    return c;
  } catch (_) { return null; }
}
const pas = (l) => l.map((x) => `id.not.like.${x}`).join(',');

async function lire(url, service, chemin, fetcher) {
  try {
    const r = await fetcher(`${url}/rest/v1/${chemin}`, { headers: sbCle(service), signal: AbortSignal.timeout(15000) });
    if (r.status === 404) return [];            // table absente ici : rien à exporter
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch (_) { return null; }
}

// Une page de l'export. `utilisateur` : { id, email, created_at } LU dans le jeton
// (jamais un champ envoyé par le navigateur). Rend { code, corps }.
export async function pageExport({ utilisateur, curseur, url, service, proprio = '', fetcher = fetch, maintenant = Date.now() }) {
  if (!utilisateur || !UUID.test(String(utilisateur.id || ''))) return { code: 401, corps: { ok: false, erreur: 'session' } };
  if (!service) return { code: 503, corps: { ok: false, erreur: 'pas-su', message: "Export pas prêt sur ce serveur. Réessaie plus tard." } };
  const c = lireCurseur(curseur);
  if (!c) return { code: 400, corps: { ok: false, erreur: 'curseur' } };
  const o = encodeURIComponent(utilisateur.id);
  const dossier = DOSSIER(new Date(maintenant));
  const pasSu = { code: 503, corps: { ok: false, erreur: 'pas-su', message: "Je n'ai pas pu tout lire. Rien n'est perdu : relance l'export dans un instant." } };
  const morceaux = [];
  let budget = MORCEAU;

  if (c.p === 'lignes') {
    // Curseur : `a` = dernier id ENTIÈREMENT sorti ; `cur` + `m` = une ligne trop
    // grande en cours (ses `m` premiers caractères sont déjà partis).
    const base = `app_data?owner=eq.${o}&and=(${pas(SECRETS)},${pas(LOURDS)})&select=id,updated_at,data&order=id.asc`;
    let a = c.a, suite = null, lues = 0;
    const sortir = (l, depuis) => {
      const donnees = sansSecrets(l.data);
      // Un signalement reçu (propriétaire de l'installation) : jamais l'identifiant de qui l'a envoyé.
      if (/^signalement_/.test(String(l.id)) && donnees && typeof donnees === 'object') delete donnees.de;
      const texte = JSON.stringify({ id: l.id, modifie: l.updated_at || null, donnees }, null, 2);
      const reste = texte.slice(depuis), nom = `${dossier}/donnees/${nomFichier(l.id)}.json`;
      if (reste.length > budget) {
        if (morceaux.length && budget < 50000) return { p: 'lignes', a, cur: l.id, m: depuis };
        morceaux.push({ nom, texte: reste.slice(0, budget) });
        return { p: 'lignes', a, cur: l.id, m: depuis + budget };
      }
      morceaux.push({ nom, texte: reste }); budget -= reste.length; a = l.id; return null;
    };
    if (c.cur) {
      const une = await lire(url, service, `${base}&id=eq.${encodeURIComponent(c.cur)}`, fetcher);
      if (!une) return pasSu;
      if (une[0] && (!une[0].owner || une[0].owner === utilisateur.id)) suite = sortir(une[0], c.m); else a = c.cur;
    }
    if (!suite) {
      const lignes = await lire(url, service, `${base}${a ? `&id=gt.${encodeURIComponent(a)}` : ''}&limit=${LOT}`, fetcher);
      if (!lignes) return pasSu;
      lues = lignes.length;
      for (const l of lignes) {
        if (l.owner && l.owner !== utilisateur.id) continue;                     // défense : jamais la ligne d'un autre
        suite = sortir(l, 0);
        if (suite) break;
      }
      if (!suite) suite = lignes.length < LOT ? { p: 'resumes', a: '', m: 0 } : { p: 'lignes', a, m: 0 };
    }
    return { code: 200, corps: { ok: true, morceaux, suite: enc(suite), fini: false, etape: 'lignes', lues } };
  }
  if (c.p === 'resumes') {
    const filtreA = c.a ? `&id=gt.${encodeURIComponent(c.a)}` : '';
    const ou = `or=(${LOURDS.map((x) => `id.like.${x}`).join(',')})`;
    const lignes = await lire(url, service, `app_data?owner=eq.${o}&${ou}${filtreA}&select=id,updated_at,meta&order=id.asc&limit=500`, fetcher);
    if (!lignes) return pasSu;
    if (lignes.length) morceaux.push({ nom: `${dossier}/resumes/${String(c.m + 1).padStart(3, '0')}.json`, texte: JSON.stringify(lignes.filter((l) => !l.owner || l.owner === utilisateur.id).map((l) => ({ id: l.id, modifie: l.updated_at || null, resume: sansSecrets(l.meta || null) })), null, 2) });
    const suite = lignes.length < 500 ? { p: 'compte', a: '', m: 0 } : { p: 'resumes', a: lignes[lignes.length - 1].id, m: c.m + 1 };
    return { code: 200, corps: { ok: true, morceaux, suite: enc(suite), fini: false, etape: 'resumes', lues: lignes.length } };
  }

  // c.p === 'compte' : tout ce qui n'est pas dans app_data, en une page.
  const [comptes, abo, code, parrain, filleul, preuves, signalements] = await Promise.all([
    lire(url, service, `vinted_accounts?owner=eq.${o}&select=vinted_user_id,login,domain`, fetcher),
    lire(url, service, `abonnements?owner=eq.${o}&select=statut,plan,fin_periode,annule_fin_periode,mode_test,client_stripe`, fetcher),
    lire(url, service, `parrainage_codes?owner=eq.${o}&select=code`, fetcher),
    lire(url, service, `parrainages?parrain=eq.${o}&select=paye_le,credit_parrain_le`, fetcher),
    lire(url, service, `parrainages?filleul=eq.${o}&select=inscrit,paye_le,credit_filleul_le`, fetcher),
    lire(url, service, `app_data?owner=eq.${PROPRIETAIRE_NEUTRE}&id=like.vrm_email_preuve_*&data->>owner=eq.${o}&select=id,updated_at,adresse:data->>adresse`, fetcher),
    proprio ? lire(url, service, `app_data?owner=eq.${encodeURIComponent(proprio)}&id=like.signalement_*&data->>de=eq.${o}&select=id,updated_at,data`, fetcher) : Promise.resolve([]),
  ]);
  if ([comptes, abo, code, parrain, filleul, preuves, signalements].some((x) => x === null)) return pasSu;
  const compte = {
    exporte_le: new Date(maintenant).toISOString(),
    connexion: { email: utilisateur.email || null, compte_cree_le: utilisateur.created_at || null },
    comptes_de_revente: comptes,
    abonnement: abo[0] || null,
    parrainage: {
      ton_code: (code[0] && code[0].code) || null,
      tes_filleuls: { inscrits: parrain.length, ont_paye: parrain.filter((x) => x.paye_le).length, mois_offerts: parrain.filter((x) => x.credit_parrain_le).length },
      parraine: filleul[0] ? { inscrit_le: filleul[0].inscrit || null, mois_offert: !!filleul[0].credit_filleul_le } : null,
    },
    adresses_prouvees: preuves.map((p) => ({ adresse: p.adresse || null, le: p.updated_at || null })),
    signalements_envoyes: signalements.map((s) => { const d = sansSecrets(s.data || {}); delete d.de; return { id: s.id, le: s.updated_at || null, ...d }; }),
  };
  morceaux.push({ nom: `${dossier}/compte.json`, texte: JSON.stringify(compte, null, 2) });
  morceaux.push({ nom: `${dossier}/LISEZMOI.txt`, texte: lisezMoi(maintenant) });
  return { code: 200, corps: { ok: true, morceaux, suite: null, fini: true, etape: 'compte' } };
}

export function lisezMoi(maintenant = Date.now()) {
  const jour = new Date(maintenant).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long', year: 'numeric' });
  return [
    `Tes données VRM — exportées le ${jour}`,
    '',
    'compte.json      : ton e-mail de connexion, tes comptes de revente, ton abonnement, ton parrainage (des nombres), tes adresses prouvées, tes signalements.',
    'donnees/         : un fichier par ligne de tes données (ventes, achats, annonces, e-mails rangés, réglages, factures…), au format JSON.',
    'resumes/         : le résumé des éléments lourds (bordereaux PDF, pièces jointes, transactions brutes) : identifiant, date, résumé.',
    '',
    'Ce qui ne figure pas ici, exprès :',
    ' - les PDF de bordereau et les pièces jointes : ils se retéléchargent depuis la plateforme ou ton e-mail ;',
    ' - les jetons et clés de connexion (Vinted, eBay, widget, Photoroom, téléphones) : un fichier ne doit jamais pouvoir ouvrir un compte ;',
    ' - l’identité des autres personnes (parrain, filleuls) : seulement des nombres.',
    '',
    'Pour corriger ou supprimer : Paramètres → Mon compte. Pour toute question : l’adresse de contact des mentions légales (vrm.center/legal/mentions-legales.html).',
    '',
  ].join('\r\n');
}
