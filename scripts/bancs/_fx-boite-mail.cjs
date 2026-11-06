// ════════════════════════════════════════════════════════════════════════════
//  UNE BOÎTE E-MAILS INVENTÉE, AU VOLUME RÉEL (6 nov., v36 « boîte mail »)
//  ~950 lignes `email_reception_*` dans la FORME de la base (app_data clé-valeur,
//  `data.resume` court, `email_texte_*` à part, registre des adresses, `main`
//  avec `vinted_account_emails`, la table `vinted_accounts`). Les proportions
//  suivent celles MESURÉES chez Julien le 6 nov. (aucune donnée réelle ici : le
//  dépôt est public) : ~37 % d'informations « rien à faire » (commande mise à
//  jour, évaluation…), ~21 % de suivis (colis au relais avec ou sans code lu,
//  en route, livrés), ~12 % d'offres, des favoris en rafale, ~48 % d'e-mails
//  rangés AVANT le résumé (31 oct. : « détail non gardé »), des transferts
//  iCloud, deux comptes à la même adresse… Tout est inventé (adresses `.test`).
//  Déterministe : la même graine donne la même boîte.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const crypto = require('crypto');

const OWNER = '22222222-2222-2222-2222-222222222222';
const MAINTENANT = Date.UTC(2026, 10, 6, 15, 5);
function graine(n) { let s = n >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

const COMPTES = [
  { u: '9001', l: 'boutique-une', adr: 'une@exemple.test' },
  { u: '9002', l: 'boutique-deux', adr: 'deux@exemple.test' },
  { u: '9003', l: 'compte-trois', adr: 'trois@exemple.test' },
  { u: '9004', l: 'compte-quatre', adr: 'deux@exemple.test' },   // deux comptes, une adresse
  { u: '9005', l: 'compte-cinq', adr: 'relais5@privaterelay.appleid.com' },
];
const ADRESSES = ['une@exemple.test', 'deux@exemple.test', 'trois@exemple.test', 'achats@exemple.test'];
const DE = {
  vinted: "\"L'équipe Vinted\" <no-reply@vinted.fr>",
  vintedIcloud: "\"L'équipe Vinted\" <no-reply_at_vinted_fr_ab12@icloud.com> (no-reply@vinted.fr.ab12)",
  vintedGo: 'Vinted Go <no-reply_at_vinted_com_cd34@icloud.com> (no-reply@vinted.com.cd34)',
  mr: 'Mondial Relay <noreply@mondialrelay.fr>',
  mrVinted: 'Mondial Relay via Vinted <shipping@relay.vinted.com>',
  chrono: 'Chronopost Pickup via Vinted <shipping@relay.vinted.com>',
  relaisColis: 'Relais Colis <suivi@relaiscolis.test>',
  laPoste: 'La Poste Colissimo <noreply@laposte.test>',
  shipping: 'shipping@relay.vinted.com',
  lbc: 'leboncoin <noreply@leboncoin.fr>',
  ebay: 'eBay <ebay@reply.ebay.fr>',
  vc: 'Vestiaire Collective <no-reply@vestiairecollective.com>',
  inconnu: 'Un service <contact@service-inconnu.test>',
};
const ARTICLES = ['Nike Air Max 90 blanche taille 42', 'Adidas Samba OG noire taille 40', 'Adidas Spezial bleu marine taille 42,5', 'New Balance 550 crème taille 38', 'Nike Dunk Low Panda taille 44', 'Asics Gel-Lyte III taille 41', 'Salomon XT-6 noir taille 42,5', 'Nike P-6000 argent taille 39', 'Adidas Handball Spezial marron taille 38,5', 'Converse Chuck 70 taille 37'];
const LIEUX = ['RELAIS TABAC DU PORT, 12 RUE DES EMBRUNS, 35000 EXEMPLEVILLE', 'Consigne Vinted Go, Café de la Gare, 3 Place de la Gare, 56000 Exemple-sur-Mer', 'LOCKER 24/7 SUPER MARCHÉ, Rue du Moulin, 35260 ', 'Presse du Marché, 8 avenue des Tilleuls, 29000 Villeneuve-Test'];
const PSEUDOS = ['*acheteuse-une*', '*client_deux*', '*paire.trois*', '*sneaker_quatre*'];
const FAMILLES = ['commande mise à jour (le statut vient de la moisson)', 'commande mise à jour (le statut vient de la moisson)', 'commande mise à jour (le statut vient de la moisson)', 'évaluation', "nouvel article d'un membre suivi", "remboursement d'un de tes achats", 'newsletter Vinted', 'virement du porte-monnaie vers ta banque'];

function construire({ n = 950, seed = 7 } = {}) {
  const r = graine(seed);
  const pick = (l) => l[Math.floor(r() * l.length)];
  const rows = [];
  const iso = (t) => new Date(t).toISOString();
  const jour = (j) => { const a = new Date(MAINTENANT); a.setUTCDate(a.getUTCDate() - j); return a; };
  // Répartition des natures (mesurée chez lui, arrondie).
  const NATURES = [
    ['connu', 37], ['suivi-code', 5], ['suivi-sans', 5], ['suivi-info', 6], ['suivi-route', 4], ['suivi-livre', 1], ['offre', 12], ['favori', 7],
    ['achat', 7], ['action', 5], ['message', 4], ['vente', 2], ['bordereau', 2], ['finalisation', 1], ['incompris', 1],
    ['lbc', 0.4], ['ebay', 0.3], ['vc', 0.4], ['vc-vente', 0.3],
  ];
  const total = NATURES.reduce((s, [, p]) => s + p, 0);
  const nature = () => { let x = r() * total; for (const [k, p] of NATURES) { if ((x -= p) <= 0) return k; } return 'connu'; };
  let t = MAINTENANT - 8 * 60e3;
  let rafale = 0, rafaleNat = '';
  for (let i = 0; i < n; i++) {
    // Les rafales (11 « commande mise à jour » en une minute, 7 favoris…) — mesurées.
    let nat;
    if (rafale > 0) { nat = rafaleNat; rafale--; t -= 30e3 + r() * 60e3; }
    else { nat = nature(); if ((nat === 'connu' || nat === 'favori' || nat === 'suivi-sans') && r() < 0.18) { rafale = 2 + Math.floor(r() * 8); rafaleNat = nat; } t -= (17 * 864e5 / n) * (0.4 + r() * 1.2); }
    const at = iso(t);
    const ancien = t < Date.UTC(2026, 9, 31, 20, 0);   // rangé avant le résumé (31 oct.)
    const a = pick(ARTICLES), adr = r() < 0.08 ? [ADRESSES[0], ADRESSES[1]] : [pick(ADRESSES)];
    let type, from, subject, resume = null, etat = 'integre', texte = '', pieces = ancien ? undefined : [];
    const code = String(100000 + Math.floor(r() * 899999));
    const lim = iso(t + (2 + Math.floor(r() * 6)) * 864e5).slice(0, 10);
    const suivi = String(40000000 + Math.floor(r() * 9999999));
    const tx = String(23900000000 + Math.floor(r() * 99999999));
    switch (nat) {
      case 'connu': { const f = pick(FAMILLES); type = 'connu-sans-action'; from = f === 'newsletter Vinted' ? 'Vinted <news@team.vinted.fr>' : pick([DE.vinted, DE.vintedIcloud]); subject = f.startsWith('commande') ? `Commande mise à jour pour ${a}` : f === 'évaluation' ? 'Tu as reçu une nouvelle évaluation' : f.startsWith('nouvel') ? 'Nouvel article de quelqu’un que tu suis' : f.startsWith('rembourse') ? 'Ton remboursement est en route' : f.startsWith('virement') ? 'Ton virement est en route' : 'Les nouveautés de la semaine'; resume = { v: 1, t: 'connu-sans-action', f }; texte = `E-mail Vinted\n\nBonjour,\n\nLe statut de ta commande ${a} a changé. \nOuvre la conversation pour voir le détail.\n\n[image: Instagram] \n\nCet e-mail t'a été envoyé par Vinted, UAB, adresse inventée. \n . \nSi tu ne souhaites plus recevoir ces e-mails, tu peux modifier tes \npréférences \n .`; break; }
      case 'suivi-code': { const tr = pick(['mondialrelay', 'mondialrelay', 'vinted', 'chronopost', 'relaiscolis']); type = 'suivi'; from = tr === 'mondialrelay' ? pick([DE.mr, DE.mrVinted]) : tr === 'vinted' ? DE.vintedGo : tr === 'chronopost' ? DE.chrono : DE.relaisColis; subject = `Votre colis ${suivi} est disponible 📦`; resume = { v: 1, t: 'suivi', tr, s: suivi, st: 'available', code: tr === 'vinted' ? 'J' + code.slice(1) : code, lieu: pick(LIEUX), lim: r() < 0.85 ? lim : undefined }; if (!resume.lim) delete resume.lim; texte = `Vinted te transfère cet e-mail de la part de Mondial Relay.\n\nVotre colis ${suivi} est disponible 📦\n\nBonne nouvelle,\n\nVotre colis n° ${suivi} est\n\ndisponible !\n\nCODE DE RETRAIT\n\n${code}\n\nPOINT RELAIS ®\n\n${resume.lieu}\n\nRETRAIT JUSQU’AU\n\n${lim.slice(8, 10)}/${lim.slice(5, 7)}\n\nINFO PRATIQUES\n\nHoraires d'ouvertures, photo, itinéraire : https://www.exemple.test/point-relais/${'z'.repeat(80)}\n\nVous pouvez consulter toutes les informations relatives au traitement de vos données personnelles dans notre politique de confidentialité .\n\nTRANSPORTEUR INVENTÉ, 1 avenue de l’exemple, 59000 EXEMPLE`; break; }
      case 'suivi-sans': { type = 'suivi'; etat = 'a-verifier'; from = pick([DE.vinted, DE.vintedIcloud]); subject = `Commande mise à jour pour ${a}`; resume = { v: 1, t: 'suivi', tr: 'autre', st: 'available', av: 'sans-suivi', lieu: LIEUX[0] }; texte = `E-mail Vinted\n\nBonjour,\n\nTon colis a été livré dans le Point Relais ${LIEUX[0]}. Tu peux, dès maintenant, aller le \nrécupérer.\n\nAller sur la conversation\n\n[image: Instagram] \n [image: \nTiktok]\n\nCet e-mail t'a été envoyé par Vinted, UAB, adresse inventée.`; break; }
      case 'suivi-info': { type = 'suivi'; from = pick([DE.mr, DE.mrVinted, DE.shipping]); subject = `Votre colis ${suivi} : il y a du nouveau`; resume = { v: 1, t: 'suivi', tr: 'mondialrelay', s: r() < 0.6 ? suivi : undefined, st: 'info' }; if (!resume.s) delete resume.s; texte = 'Votre colis avance. Suivez-le depuis l’application.'; break; }
      case 'suivi-route': { const sortant = r() < 0.5; type = 'suivi'; from = pick([DE.chrono, DE.mrVinted, DE.laPoste]); subject = `Ton colis ${suivi} est en route`; resume = { v: 1, t: 'suivi', tr: pick(['chronopost', 'mondialrelay', 'colissimo']), s: suivi, st: 'transit', ...(sortant ? { sens: 'sortant' } : {}) }; texte = 'Le colis est en route vers le point relais.'; break; }
      case 'suivi-livre': { type = 'suivi'; from = DE.chrono; subject = 'Votre colis a été livré'; resume = { v: 1, t: 'suivi', tr: 'chronopost', s: suivi, st: 'delivered', sens: 'sortant' }; texte = 'Le destinataire a retiré son colis.'; break; }
      case 'offre': { type = 'offre'; from = pick([DE.vinted, DE.vintedIcloud]); subject = `Nouvelle offre pour ${a}`; const mt = r() < 0.55 ? `${20 + Math.floor(r() * 60)},${pick(['00', '40', '50'])}` : undefined; resume = { v: 1, t: 'offre', a, ...(mt ? { mt } : {}) }; texte = `E-mail Vinted\n\nboutique-une,\n\nquelqu’un te propose d'acheter ${a} à un \nprix plus bas.\n\n[image: Photo] ${mt || ''} €\n\nNouvelle offre :\n${mt || '—'} € au lieu de 54,00 €\n\nRépondre à l'offre\n\nCet e-mail t'a été envoyé par Vinted, UAB, adresse inventée.`; break; }
      case 'favori': { type = 'favori'; from = pick([DE.vinted, DE.vintedIcloud]); subject = 'Quelqu’un a ajouté ton article à ses favoris'; resume = r() < 0.3 ? { v: 1, t: 'favori', a, de: pick(PSEUDOS) } : { v: 1, t: 'favori' }; texte = 'Ton article plaît !'; break; }
      case 'achat': { type = 'achat'; from = pick([DE.vinted, DE.vintedIcloud]); subject = `Ton reçu pour la commande « ${a} »`; const px = `${12 + Math.floor(r() * 40)},${pick(['15', '83', '20'])}`; resume = { v: 1, t: 'achat', tx, a, px, id: 'email_achat_' + tx.slice(-6), pdf: 0 }; texte = `E-mail Vinted\n\nBonjour boutique-une,\n\n*Ton paiement a été reçu. *\n\nReçu pour ta commande Vinted :\n*Vendeur* vendeur-inventé \n*Commande*\n\n${a}\n*Montant payé* ${px} € \nArticle 35,00 € \n*N° de transaction* ${tx}\n\nNous t'enverrons un message dès que le vendeur aura expédié l'article \n${a}. Le vendeur a jusqu'à 7 jours pour envoyer le colis.\n\nL'équipe Vinted\n\nCet e-mail t'a été envoyé par Vinted, UAB, adresse inventée. \n . \nNous sommes tenus de t'envoyer cet e-mail conformément à nos Termes et \nconditions\n\nou à d'autres obligations légales.`; break; }
      case 'action': { type = 'action'; from = pick([DE.vinted, DE.vintedIcloud]); subject = 'Ta commande est arrivée : vérifie-la'; resume = { v: 1, t: 'action', f: 'achat livré, à vérifier avant la date limite' }; texte = 'Vérifie ta commande avant la date limite.'; break; }
      case 'message': { type = 'message'; from = pick([DE.vinted, DE.vintedIcloud]); subject = 'Tu as un nouveau message'; resume = r() < 0.5 ? { v: 1, t: 'message', a } : { v: 1, t: 'message', de: 'Support' }; texte = 'Un membre t’a écrit.'; break; }
      case 'vente': { type = 'vente'; from = pick([DE.vinted, DE.vintedIcloud]); subject = 'Ton article s’est vendu !'; resume = { v: 1, t: 'vente', a, px: `${45 + Math.floor(r() * 40)}.00`, ps: pick(PSEUDOS) }; texte = `E-mail Vinted\n\n​​*Bonjour boutique-une,*\n\n${resume.ps} a acheté\n[image: ${a}] \n${a}\n${resume.px.replace('.', ',')} €\n\nNous transférerons le paiement sur ton porte-monnaie Vinted une fois la \ncommande terminée.\n\nExpédie cette commande au cours des 5 prochains jours.\n\nVoici comment procéder :\n\n1. Rends-toi dans le fil de conversation\n\nentre l’acheteur et toi pour télécharger ton bordereau d’envoi. \n 2. Suis les premières étapes sur Vinted.`; pieces = ancien ? undefined : [{ n: 'formulaire-retour.pdf', t: 'application/pdf', o: 41022 }]; break; }
      case 'bordereau': { type = 'bordereau'; const nt = r() < 0.7; etat = nt ? 'a-verifier' : 'integre'; from = pick([DE.vinted, DE.vintedIcloud]); subject = `Bordereau d'envoi Vinted - à utiliser avant le ${lim.split('-').reverse().join('/')} 10 h 00 pour ${a}`; resume = { v: 1, t: 'bordereau', tx, a, n: String(10 + Math.floor(r() * 140)), ...(nt ? { nt: 1, av: 'num-titre' } : {}), pdf: 1, tp: 1 }; texte = `E-mail Vinted\n\n*Bonjour boutique-une, *\n\nRetrouve ton bordereau d'envoi *en pièce jointe* de cet e-mail.\n\n*Informations d'envoi :*\n*Article :* ${a}\n*N° de suivi :* ${suivi} \n*À envoyer avant le :* ${lim} \n*N° de transaction :* ${tx}\n\n1. *Emballe le ou les articles*\n - L'emballage\n\ndoit être suffisamment solide.\n\n2. *Imprime le bordereau d'envoi et colle-le sur le colis*`; pieces = ancien ? undefined : [{ n: `Bordereau-${tx}.pdf`, t: 'application/pdf', o: 52311 }]; break; }
      case 'finalisation': { type = 'finalisation'; from = pick([DE.vinted, DE.vintedIcloud]); subject = 'Ta commande est terminée'; resume = { v: 1, t: 'finalisation', mt: `${40 + Math.floor(r() * 70)},00` }; texte = 'L’argent est sur ton porte-monnaie.'; break; }
      case 'incompris': { type = 'ignoré'; etat = 'a-verifier'; from = pick([DE.inconnu, 'Google <noreply-accounts@google.test>']); subject = 'Un message que VRM ne connaît pas'; resume = { v: 1, t: 'incompris', av: 'incompris' }; texte = 'Bonjour,\n<script>window.__xss=1</script><img src=x onerror="window.__xss=2"><iframe src="https://piege.test"></iframe>\nVoici un texte <b>sans forme</b> connue &amp; un lien https://exemple.test/aide.'; break; }
      case 'lbc': { type = 'connu-sans-action'; from = DE.lbc; subject = 'Suppression de vos annonces sur leboncoin.fr'; resume = { v: 1, t: 'connu-sans-action', f: 'annonce Leboncoin supprimée' }; texte = `Votre annonce ${a} a bien été supprimée du site leboncoin.fr.`; break; }
      case 'ebay': { type = 'connu-sans-action'; from = DE.ebay; subject = 'Vous avez reçu une question'; resume = { v: 1, t: 'connu-sans-action', f: 'message eBay' }; texte = 'Un acheteur a une question sur votre objet.'; break; }
      case 'vc': { type = 'offre'; from = DE.vc; subject = 'Vous avez reçu une offre'; resume = { v: 1, t: 'offre', a, mt: '70,00' }; texte = 'Une offre vous attend sur Vestiaire Collective.'; break; }
      case 'vc-vente': { type = 'vente-vestiaire'; from = DE.vc; subject = `Votre article ${a} a été vendu`; resume = { v: 1, t: 'vente-vestiaire', p: String(50000000 + i), a, mt: '82,40', lim }; texte = 'Félicitations, votre article a été vendu. Envoyez-le avant la date limite.'; break; }
      default: type = 'information'; from = DE.vinted; subject = 'Information';
    }
    if (ancien) { resume = null; texte = ''; }
    const cle = crypto.createHash('sha256').update('banc-' + seed + '-' + i).digest('hex');
    const data = { at, etat, type, subject, from, adresses: adr, receivedAt: at, sourceDate: iso(t - 40e3), messageId: `<banc-${i}@exemple.test>`, raison: '', documentsVerifies: false, suppressionAutorisee: false };
    if (resume) data.resume = resume;
    if (pieces) data.pieces = pieces;
    rows.push({ owner: OWNER, id: `email_reception_${cle}`, data });
    if (texte) rows.push({ owner: OWNER, id: `email_texte_${cle}`, data: { texte: texte.length > 1500 ? texte.slice(0, 1500) + '…' : texte, at } });
  }
  rows.push({ owner: OWNER, id: 'main', data: { vinted_account_emails: Object.fromEntries(COMPTES.map((c) => [c.u, c.adr])) } });
  rows.push({ owner: OWNER, id: 'vrm_email_owners', data: { adresses: Object.fromEntries(ADRESSES.map((a) => [a, { owner: OWNER }])) } });
  return { owner: OWNER, maintenant: MAINTENANT, rows, comptes: COMPTES.map((c) => ({ owner: OWNER, vinted_user_id: c.u, login: c.l })) };
}
module.exports = { construire, OWNER, MAINTENANT };
