// ═══════════════════════════════════════════════════════════════════════════
// « LITIGES ET RETOURS » — TOUS LES SITES, VENTES ET ACHATS (23 nov., lot litiges-retours)
// ═══════════════════════════════════════════════════════════════════════════
// Julien (validé le 23 nov.) : « un écran Litiges et retours tous sites (Vinted, Leboncoin, eBay,
// Vestiaire) : chaque litige/retour en cours avec son état, sa date limite (lue, jamais inventée ;
// sinon « pas su »), le geste à faire (lien direct) ». Avant ce jour, l'écran ne montrait que les
// litiges et retours de VENTE ; les retours d'ACHAT (un bordereau de retour à déposer avant une date
// lue dans l'e-mail) vivaient seulement dans Achats.
//
// Ce module NE RE-DÉCIDE RIEN (§5, une règle par notion) — il ASSEMBLE :
//   · les ventes : `litigesDesVentes` (src/litigesEcran.js, lui-même `litigesEnCours` de src/litiges.js) ;
//   · les achats : `retoursAchat` (src/retoursAchat.js), classés par `classerRetoursAchat` — un retour
//     REMBOURSÉ est fini (il n'est plus « en cours ») ;
//   · l'état par site : celui des ventes (Vinted, eBay ; Leboncoin et Vestiaire « jamais vu ») et celui
//     des retours d'achat Vinted.
// Mesuré le 23 nov. (lecture seule, sa base) : `lbc_ventes` 16 lignes (stepStatus done 3 · validation 8 ·
// cancelled 5 : des annulations, AUCUN litige), `vc_ventes` 3 ventes sans statut de litige, `ebay_orders`
// 0 commande, 1 transporteur « retour à l'expéditeur » (juillet), e-mails `email_retourdemande_*` 3,
// `email_bordretour_*` 2 ⇒ un litige Leboncoin ou Vestiaire ne SE LIT toujours pas : « jamais vu », jamais
// « aucun ».
// Une ligne = une IDENTITÉ (la carte de sa règle : transaction, conversation, retour eBay, avis d'e-mail).
// La date limite : seulement LUE (`limiteTexte` / `limiteIso`) ; sinon `limiteLue: false` et l'écran dit
// « Date limite non lue ». Le geste : TOUJOURS un lien vers le site (son clic), jamais une action de VRM.
// Trois états (§5) : `encours` · `passu` · `lu`. Module PUR. Exécuté par scripts/audit-litiges-tous-sites.cjs.

const str = (v) => String(v == null ? '' : v);
const ms = (v) => { const t = Date.parse(str(v)); return Number.isFinite(t) ? t : null; };

// Le lien d'un retour d'ACHAT : sa conversation (la commande), sinon sa transaction, sinon la boîte Vinted.
export function gesteRetourAchat(c) {
  const conv = str(c && c.conv).trim(), tx = str(c && c.tx).trim();
  const url = conv ? `https://www.vinted.fr/inbox/${encodeURIComponent(conv)}` : tx ? `https://www.vinted.fr/member/transactions/${encodeURIComponent(tx)}` : 'https://www.vinted.fr/inbox';
  return { url, cle: c && c.etape === 'a-deposer' ? 'deposer' : 'suivre' };
}

// Les étapes d'un retour d'achat qui sont encore « en cours » (un retour remboursé est fini).
export const ETAPES_ACHAT_EN_COURS = new Set(['a-deposer', 'depose', 'en-route', 'revient', 'relais-vendeur', 'recu-vendeur']);

export function litigesEtRetours({ ventes, achats, maintenant = Date.now() } = {}) {
  const lignes = [];
  const parSite = [];
  const manques = [];
  // ── Les ventes ──
  const vLu = !!(ventes && ventes.etat === 'lu');
  for (const p of (ventes && Array.isArray(ventes.plateformes) ? ventes.plateformes : [{ site: 'vinted', etat: ventes === undefined || (ventes && ventes.etat === 'encours') ? 'encours' : 'passu', raison: '' }])) {
    parSite.push({ site: p.site, sens: 'vente', etat: p.etat, raison: p.raison || '' });
  }
  if (vLu) {
    for (const c of ventes.cartes || []) {
      lignes.push({ cle: 'v:' + c.cle, sens: 'vente', site: c.plateforme || 'vinted', genre: c.genre, etape: c.etape || '', num: c.num || '', titre: c.titre || '', compte: c.compte || '',
        limiteIso: c.limite || null, limiteTexte: c.limiteTexte || '', limiteLue: !!c.limiteTexte, presse: !!c.presse, depassee: !!c.depassee,
        geste: c.geste && c.geste.url ? { url: c.geste.url, libelle: c.geste.libelle || '' } : null, depuis: c.depuis || null, carte: c });
    }
  }
  // ── Les retours d'achat (Vinted) ──
  const aEtat = achats === undefined || (achats && achats.etat === 'encours') ? 'encours' : !achats || achats.etat === 'passu' ? 'passu' : 'lu';
  const aManques = achats && Array.isArray(achats.manques) ? achats.manques : [];
  parSite.push({ site: 'vinted', sens: 'achat', etat: aEtat === 'lu' && aManques.length ? 'passu' : aEtat, raison: aManques.length ? `pas lu : ${aManques.join(', ')}` : '' });
  if (aEtat === 'lu') {
    for (const c of achats.cartes || []) {
      if (!c || !ETAPES_ACHAT_EN_COURS.has(c.etape)) continue;
      const lue = !!(c.limiteTexte && ms(c.limiteIso) != null);
      lignes.push({ cle: 'a:' + c.cle, sens: 'achat', site: 'vinted', genre: 'retour-achat', etape: c.etape, num: c.num || '', titre: c.titre || '', compte: c.nomCompte || c.compte || '',
        limiteIso: lue ? c.limiteIso : null, limiteTexte: lue ? c.limiteTexte : '', limiteLue: lue, presse: !!(lue && c.presse), depassee: !!(lue && c.depassee),
        geste: gesteRetourAchat(c), depuis: null, carte: c });
    }
  }
  for (const p of parSite) if (p.etat === 'passu' || p.etat === 'jamais-vu') manques.push(p);
  // Le plus pressé d'abord : pressé, puis la date limite LUE la plus proche, puis sans date (les plus récents d'abord).
  const rang = (l) => (l.depassee ? 2 : 0) + (l.presse ? -1 : 0);
  lignes.sort((a, b) => rang(a) - rang(b)
    || (a.limiteLue === b.limiteLue ? 0 : a.limiteLue ? -1 : 1)
    || ((ms(a.limiteIso) || 0) - (ms(b.limiteIso) || 0))
    || ((ms(b.depuis) || 0) - (ms(a.depuis) || 0))
    || a.cle.localeCompare(b.cle));
  const etat = !ventes || ventes.etat === 'encours' ? (ventes === undefined || (ventes && ventes.etat === 'encours') ? 'encours' : 'passu') : ventes.etat === 'passu' && aEtat !== 'lu' ? 'passu' : 'lu';
  void maintenant;
  const nVentes = lignes.filter((l) => l.sens === 'vente').length, nAchats = lignes.filter((l) => l.sens === 'achat').length;
  return { etat, lignes, parSite, manques, nVentes, nAchats, nPresses: lignes.filter((l) => l.presse).length,
    // « au moins » : un site ou un sens n'a pas pu être lu — le total ne se présente jamais comme complet.
    partiel: manques.length > 0 || aEtat !== 'lu' || !vLu };
}
