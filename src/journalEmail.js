// ── « TES EMAILS, CE QUE VRM EN A FAIT » : LA PHRASE DE CHAQUE EMAIL ────────
// (31 oct., demande de Julien : « mettre ce que l'app reçoit par mail de façon
// plus claire pour le vendeur, comme ça s'il y a une erreur c'est plus simple »)
//
// Une seule règle, pure, lue par le journal (src/JournalEmails.jsx) et par ses
// bancs. Elle part du RÉSUMÉ écrit au classement (api/_lib/resume-email.js) :
// de qui, ce que c'est, ce que VRM a fait, l'état, et — s'il faut vérifier —
// la RAISON en français et le GESTE à faire.
//
// ⚠️ §5 IDENTITÉ : le lien vers « la chose concernée » ne passe que par une
//    identité lue dans l'email (n° de transaction, n° de suivi, N° lu dans
//    l'email). Un N° retrouvé par le TITRE (`nt`) n'ouvre rien : il est dit « à
//    vérifier sur ton carton ».
// ⚠️ « Pas su » ≠ « rien » : un email classé avant le résumé dit « classé avant
//    le 31 oct. — détail non gardé », jamais une action inventée.

export const ETATS_JOURNAL = {
  range: { picto: '✓', mot: 'Rangé' },
  verifier: { picto: '⚠', mot: 'À vérifier' },
  incompris: { picto: '✗', mot: 'Pas compris' },
  reessai: { picto: '↻', mot: 'En attente de réessai' },
  delie: { picto: '–', mot: 'Délié par toi' },
};

export const FILTRES_TYPE = [
  ['', 'Tous les types'],
  ['colis', 'Colis et retraits'],
  ['bordereau', 'Bordereaux'],
  ['vente', 'Ventes et versements'],
  ['achat', 'Reçus d’achat'],
  ['messages', 'Offres, messages, favoris'],
  ['incompris', 'Pas compris'],
  ['autre', 'Informations'],
];

const ONGLETS = { cat_bord: 'Ouvrir Colis', cat_achats: 'Ouvrir Achats', cat_ventes: 'Ouvrir Ventes', cat_msg: 'Ouvrir Messages', cat_annonces: 'Ouvrir Annonces' };
const lien = (tab) => (tab ? { tab, label: ONGLETS[tab] } : null);
const maj = (s) => { const t = String(s || '').trim(); return t ? t[0].toLocaleUpperCase('fr') + t.slice(1) : ''; };
const euros = (m) => { const t = String(m || '').trim(); return t ? `${t.replace('.', ',')} €` : ''; };
// Un code de retrait se lit par groupes de trois (« 418 205 »).
export const codeLisible = (c) => { const t = String(c || '').replace(/\s+/g, ''); return /^\d{6,}$/.test(t) ? t.replace(/(\d{3})(?=\d)/g, '$1 ') : String(c || '').trim(); };

// DE QUI : l'expéditeur lisible. Un affichage, jamais une identité (c'est
// l'adresse de RÉCEPTION qui décide du vendeur, §5).
export function expediteurLisible(from) {
  const f = String(from || '').toLowerCase();
  if (!f.trim()) return 'Expéditeur non lu';
  if (/mondial\s*relay|mondialrelay/.test(f)) return 'Mondial Relay';
  if (/chronopost/.test(f)) return 'Chronopost';
  if (/colissimo|laposte/.test(f)) return 'La Poste';
  if (/relaiscolis|relais\s*colis/.test(f)) return 'Relais Colis';
  if (/vintedgo|vinted\s*go\b/.test(f)) return 'Vinted Go';
  if (/vinted/.test(f)) return 'Vinted';
  if (/leboncoin/.test(f)) return 'Leboncoin';
  if (/ebay/.test(f)) return 'eBay';
  if (/vestiaire/.test(f)) return 'Vestiaire Collective';
  const brut = String(from || '');
  const nom = brut.replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
  if (nom && !nom.includes('@')) return nom.slice(0, 40);
  const dom = (brut.match(/@([a-z0-9.-]+)/i) || [])[1];
  return dom ? dom.slice(0, 40) : 'Expéditeur non lu';
}

const POURQUOI_PAS_DELIER = {
  bordereau: 'Ce bordereau est relié par le n° de transaction que Vinted a écrit dedans : il appartient à cette vente et à aucune autre. Si le N° de rangement est faux, corrige-le dans Colis.',
  suivi: 'Ce colis est relié par son n° de suivi, écrit dans l’email par le transporteur : rien n’a été deviné.',
};

const ANCIEN = 'Classé avant le 31 oct. — détail non gardé.';
const ongletDuType = { suivi: 'cat_bord', bordereau: 'cat_bord', achat: 'cat_achats', vente: 'cat_ventes', finalisation: 'cat_ventes', offre: 'cat_msg', message: 'cat_msg', favori: 'cat_annonces', action: 'cat_msg' };
const TYPES_ANCIENS = { suivi: 'Suivi de colis', bordereau: 'Bordereau', achat: 'Reçu d’achat', vente: 'Vente', finalisation: 'Versement', offre: 'Offre', message: 'Message', favori: 'Favori', action: 'Demande Vinted', 'connu-sans-action': 'Information', information: 'Information', ignoré: 'Email non reconnu' };

// e : une ligne du journal (route `mode=journal`) ; delies : { [id de la ligne
// du reçu]: { tx } } — les reçus que LUI a déliés (« Ce n'est pas ça »).
export function lectureEmail(e, delies = {}) {
  const de = expediteurLisible(e && e.from);
  const sujet = String((e && e.subject) || '').trim() || 'Email sans objet';
  const r = e && e.resume && typeof e.resume === 'object' ? e.resume : null;
  const base = { de, sujet, num: null, lien: null, raison: '', geste: '', delier: null, cible: null };

  if ((e && e.etat === 'erreur') || (r && r.t === 'panne')) {
    return { ...base, etat: 'reessai', quoi: sujet, fait: 'Pas encore rangé : le service de réception va le renvoyer tout seul.',
      raison: 'Le rangement n’a pas été confirmé (serveur de données injoignable ou traitement interrompu).',
      geste: 'Rien à faire : il revient tout seul. S’il est encore là dans une heure, regarde l’onglet Réception.' };
  }
  if (!r) {
    const ancienIncompris = e && e.type === 'ignoré';
    return { ...base, etat: ancienIncompris ? 'incompris' : e && e.etat === 'integre' ? 'range' : 'verifier',
      quoi: `${TYPES_ANCIENS[e && e.type] || 'Email'} · « ${sujet} »`, fait: ANCIEN,
      raison: e && e.etat === 'integre' ? '' : ancienIncompris ? 'Aucune règle de VRM ne le reconnaissait. Il est gardé, jamais jeté.' : 'Classé avant le 31 oct. : la raison n’a pas été gardée.',
      geste: e && e.etat === 'integre' ? '' : 'Ouvre l’original dans ta messagerie pour vérifier.',
      lien: lien(ongletDuType[e && e.type]) };
  }

  const t = r.t;
  let o;
  switch (t) {
    case 'suivi': {
      const lieu = r.lieu ? ` chez ${r.lieu}` : '';
      const quoi = r.st === 'available' ? (r.code ? `Code de retrait ${codeLisible(r.code)}${lieu}` : `Colis arrivé au point de retrait${lieu}`)
        : r.st === 'delivered' ? (r.sens === 'sortant' ? 'Ton acheteur a retiré son colis' : 'Colis livré')
        : r.st === 'transit' ? 'Colis en route'
        : r.st === 'retour' ? 'Colis reparti chez l’expéditeur'
        : 'Nouvelles d’un colis';
      o = { quoi: r.lim && r.st === 'available' ? `${quoi} · à retirer avant le ${r.lim}` : quoi,
        fait: r.s ? `Rangé avec le colis n° ${r.s}` : 'Gardé, relié à aucun colis',
        lien: lien(r.sens === 'sortant' && r.st === 'delivered' ? 'cat_ventes' : r.st === 'delivered' ? 'cat_achats' : 'cat_bord'),
        cible: r.s ? { k: 'suivi', v: r.s } : null };
      if (r.av === 'sans-suivi') Object.assign(o, { raison: 'Je n’ai pas trouvé le n° de suivi dans cet email : je ne sais pas à quel colis il appartient.', geste: 'Lis le texte ci-dessous ; si c’est un de tes colis, retrouve-le dans Colis par son code.' });
      o.delier = { offert: false, pourquoi: POURQUOI_PAS_DELIER.suivi };
      break;
    }
    case 'bordereau': {
      if (r.av === 'analyse') {
        o = { quoi: `Bordereau · « ${sujet} »`, fait: 'Gardé entier, relié à aucune vente',
          raison: 'Je reconnais un bordereau, mais je n’ai pas su lire à quelle vente il appartient.',
          geste: 'Imprime-le depuis la vente sur Vinted. Rien n’a été relié par le titre.', lien: lien('cat_bord') };
        break;
      }
      const numSur = r.n && !r.nt;
      o = { quoi: `Bordereau de la vente ${r.a ? r.a : 'n° ' + (r.tx || '?')}`,
        fait: `Ajouté aux colis à expédier · vente n° ${r.tx}${numSur ? ` · N°${r.n}` : ''}${r.tp ? ' · déjà tamponné' : ''}`,
        lien: lien('cat_bord'), num: numSur ? String(r.n) : null, cible: { k: 'tx', v: r.tx } };
      if (r.av === 'num-titre') Object.assign(o, { raison: `Le N°${r.n} a été retrouvé par le titre de l’annonce, pas lu dans l’email : il peut désigner une autre paire.`, geste: 'Vérifie ce N° sur ton carton avant d’imprimer le bordereau (Colis).' });
      if (r.av === 'sans-pdf') Object.assign(o, { raison: 'L’email ne portait pas de PDF : il n’y a rien à imprimer depuis VRM.', geste: 'Télécharge le bordereau depuis la vente sur Vinted.' });
      o.delier = { offert: false, pourquoi: POURQUOI_PAS_DELIER.bordereau };
      break;
    }
    case 'finalisation':
      o = { quoi: `Argent reçu${r.mt ? ` : ${euros(r.mt)}` : ''}${r.a ? ` · ${r.a}` : ''}`, fait: 'Gardé avec tes versements Vinted', lien: lien('cat_ventes') };
      break;
    case 'achat': {
      const d = r.id && delies && delies[r.id];
      o = { quoi: `Reçu d’achat${r.a ? ` · ${r.a}` : ''}${r.px ? ` (${euros(r.px)})` : ''}`,
        fait: r.tx ? (d ? `Délié par toi de l’achat n° ${r.tx}` : `Reçu rangé avec ton achat n° ${r.tx}`) : 'Gardé, relié à aucun achat',
        lien: lien('cat_achats'), cible: r.tx ? { k: 'tx', v: r.tx } : null };
      if (r.av === 'sans-tx') Object.assign(o, { raison: 'Je n’ai pas trouvé le n° de transaction dans ce reçu : il n’est relié à aucun achat (jamais par le titre).', geste: 'Retrouve-le dans Achats → Reçus d’achat par email.' });
      if (r.tx && r.id) o.delier = { offert: true, id: r.id, tx: r.tx, delie: !!d };
      if (d) o.etat = 'delie';
      break;
    }
    case 'vente': {
      if (r.av === 'analyse') {
        o = { quoi: `Vente · « ${sujet} »`, fait: 'Gardé entier, rien noté',
          raison: 'Je reconnais une vente, mais je n’ai pas su lire l’article ni le prix.',
          geste: 'Vérifie la vente dans Ventes : elle arrive aussi par l’extension.', lien: lien('cat_ventes') };
        break;
      }
      o = { quoi: `Vente${r.a ? ` : ${r.a}` : ''}${r.px ? ` · ${euros(r.px)}` : ''}${r.ps ? ` · à ${r.ps}` : ''}`,
        fait: `Notée, notification envoyée${r.n ? ` · N°${r.n}` : ''}${r.fac ? ` · facture ${r.fac}` : ''}`,
        lien: lien('cat_ventes'), num: r.n ? String(r.n) : null };
      break;
    }
    case 'offre':
      o = { quoi: `Offre${r.mt ? ` de ${euros(r.mt)}` : ''}${r.de ? ` de ${r.de}` : ''}${r.a ? ` sur ${r.a}` : ''}`, fait: 'Notification envoyée', lien: lien('cat_msg') };
      break;
    case 'message':
      o = { quoi: `Message${r.de ? ` de ${r.de}` : ''}${r.a ? ` à propos de ${r.a}` : ''}`, fait: 'Notification envoyée', lien: lien('cat_msg') };
      break;
    case 'favori':
      o = { quoi: `${r.de || 'Quelqu’un'} a mis ${r.a ? `« ${r.a} »` : 'ton article'} en favori`, fait: 'Notification envoyée', lien: lien('cat_annonces') };
      break;
    case 'action':
      o = { quoi: maj(r.f) || `« ${sujet} »`, fait: 'Notification envoyée — la réponse se fait sur Vinted', lien: lien(/achat/i.test(r.f || '') ? 'cat_achats' : 'cat_msg') };
      break;
    case 'connu-sans-action':
      o = { quoi: maj(r.f) || `« ${sujet} »`, fait: 'Rien à faire — gardé' };
      break;
    case 'incompris':
      o = { quoi: `« ${sujet} »`, fait: 'Gardé entier, jamais jeté', etat: 'incompris',
        raison: 'Aucune règle de VRM ne reconnaît cet email.', geste: 'Lis-le ci-dessous : s’il compte pour toi, traite-le sur Vinted ou dans ta messagerie.' };
      break;
    default:
      o = { quoi: `« ${sujet} »`, fait: 'Gardé' };
  }
  const etat = o.etat || (r.av ? 'verifier' : 'range');
  return { ...base, ...o, etat };
}
