#!/usr/bin/env node
// audit-favoris-perso (21 nov., ext. 5.417, `favorisperso2`) — SES MESSAGES AUX FAVORIS, PERSONNALISÉS.
// Julien (21 nov.) : « pour les messages aux favoris ça doit être beaucoup mieux, on n'a pas la possibilité de
// personnaliser, améliore ça ». Ce banc EXÉCUTE la règle du choix (<favoris-perso-regle>) telle qu'elle est DANS
// background.js (le fichier livré), avec le bloc <reglages-auto-ligne> du même fichier :
//  P1. les deux copies (src/favorisPerso.js et background.js) sont identiques (--recopie la refait) ;
//  P2. variables : {prénom} = le pseudo lu (jamais un prénom tiré du pseudo), {marque} {taille} {prix_offre} {remise}
//      posées quand elles sont SUES ; pas sues ⇒ la version est sautée, jamais un trou ; variable inconnue ⇒ refusée ;
//  P3. conditions : heure (plage, y compris par-dessus minuit), jour, prix (de X à Y), marque ; valeur pas sue ⇒ FAUX ;
//  P4. priorité : la plus précise, puis la plus haute ; UNE seule règle ; lot avant les règles ; défaut à la fin ;
//      une règle dont aucune version ne peut partir laisse passer la suivante ;
//  P5. aléa : 200 tirages, chaque version possible sort ; jamais deux fois de suite la même au même acheteur, puis au
//      compte ; une seule version possible ⇒ elle (jamais rien) ;
//  P6. texte interdit (règle des mots qui font bannir) ou déjà refusé par Vinted : jamais tiré ; aucune ⇒ refus dit ;
//  P7. rétro-compatibilité : sans version « 1 article » écrite, les textes d'avant (message + variantes + lot) servent,
//      leurs n° (1 à 5) gardés ; `fpReglage` normalise (bornes, ids, règle sans condition écartée, `actif` toujours faux) ;
//  P8. l'offre : le prix posé dans {prix_offre} / {prix} est celui de `offreAvecPlancher` (remontée au plancher prix mini,
//      sinon achat + 10 %, au % réglé sans plancher) — exécuté sur le vrai background.js ;
//  P9. statistiques : envoyés, avec offre, vendus dans les 14 j (annonce du message = annonce vendue) ; « non mesuré »
//      sous 10 envois ; une vente sans date n'est comptée nulle part ;
//  P10. le moteur appelle la règle : `executerMessageFavori` passe par `choixMessageFavori` (une seule fois), le texte qui
//      annonce une offre ({prix_offre}, {remise}) fait partir l'offre AVANT lui, la version notée est la clé choisie.
// --prouve : chaque règle affaiblie (mutation du bloc dans une copie) ⇒ au moins un rouge.
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..');
const F_SRC = path.join(R, 'src/favorisPerso.js'), F_BG = path.join(R, 'vinted-sync-extension/background.js');
const DEB = '// <favoris-perso-regle>', FIN = '// </favoris-perso-regle>';
const RDEB = '// <reglages-auto-ligne>', RFIN = '// </reglages-auto-ligne>';
const MDEB = '// <message-sur-regle>', MFIN = '// </message-sur-regle>';
const bloc = (t, a = DEB, b = FIN) => { const i = t.indexOf(a), j = t.indexOf(b); return i < 0 || j < 0 ? null : t.slice(i, j + b.length); };
if (process.argv.includes('--recopie')) {
  const b = bloc(fs.readFileSync(F_SRC, 'utf8')); let bg = fs.readFileSync(F_BG, 'utf8'); const vieux = bloc(bg);
  if (!b) { console.log('❌ bloc introuvable dans src/favorisPerso.js'); process.exit(1); }
  if (vieux) bg = bg.replace(vieux, b);
  else { const ancre = '// ══ 5.410.3 (`favorisbleam`)'; const i = bg.indexOf(ancre); if (i < 0) { console.log('❌ ancre introuvable'); process.exit(1); } bg = bg.slice(0, i) + b + '\n' + bg.slice(i); }
  fs.writeFileSync(F_BG, bg); console.log('✅ bloc <favoris-perso-regle> recopié dans background.js'); process.exit(0);
}
const fonction = (t, nom) => { const i = t.search(new RegExp(`(?:async )?function ${nom}\\(`)); if (i < 0) throw new Error('absente : ' + nom); let p = t.indexOf('{', t.indexOf(')', i)), n = 0, j = p; for (; j < t.length; j++) { if (t[j] === '{') n++; else if (t[j] === '}') { n--; if (!n) break; } } return t.slice(i, j + 1); };

function charger(BG) {
  const b = bloc(BG), r = bloc(BG, RDEB, RFIN), m = bloc(BG, MDEB, MFIN);
  if (!b || !r || !m) throw new Error('bloc absent de background.js');
  const ctx = { Intl, Date, Math, Number, String, Array, Object, Set, Map, JSON, RegExp, isFinite };
  vm.runInNewContext(r + '\n' + m + '\n' + b + '\n;globalThis.__f = { choisirMessageFavori, fpReglage, fpGroupes, fpUneEnvoyable, fpBesoins, statsVersionsFavoris, fpContexteParis, fpErreurTexte, fpVersionSure, texteSurVinted };', ctx);
  return ctx.__f;
}

async function verifier(SRC, BG) {
  const fautes = []; const dit = (ok, f) => { if (!ok) fautes.push(f); };
  dit(bloc(SRC) && bloc(BG) && bloc(SRC) === bloc(BG), 'P1 le bloc <favoris-perso-regle> diffère entre src/favorisPerso.js et background.js (--recopie)');
  let F; try { F = charger(BG); } catch (e) { return ['le bloc ne s’exécute pas : ' + e.message]; }
  const sur = (t) => F.texteSurVinted(t).ok;
  const ch = (x) => F.choisirMessageFavori(Object.assign({ sur, hasard: () => 0, ctx: { heure: 10, jour: 2 } }, x));
  const fav = { pseudo: 'marie_75', article: 'Nike Air Max 90 42', prix: 60, marque: 'Nike', taille: '42' };
  // P2 — variables
  let r = ch({ reglage: { un: [{ id: 'u1', texte: 'Bonjour {prénom}, la {marque} en {taille} à {prix_offre} ({remise}) !' }] }, fav, offre: { prix: 54 } });
  dit(r.ok && r.version.texte === 'Bonjour marie_75, la Nike en 42 à 54 € (10 %) !', 'P2 variables nouvelles mal posées : ' + JSON.stringify(r.version && r.version.texte));
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Bonjour {prénom}' }] }, fav: Object.assign({}, fav, { pseudo: 'jean.dupont' }) });
  dit(r.ok && r.version.texte === 'Bonjour jean.dupont', 'P2 {prénom} n’est pas le pseudo lu (prénom inventé ?) : ' + JSON.stringify(r.version && r.version.texte));
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Bonjour {prénom}' }] }, fav: Object.assign({}, fav, { pseudo: '' }) });
  // 5.450 (coordinateur, simulations F1P) : sans pseudo lu, la version NEUTRE part (le même texte sans le pseudo) — jamais un nom.
  dit(r.ok && r.neutre === true && r.version.texte === 'Bonjour' && !/[{}]/.test(r.version.texte), 'P2 sans pseudo lu : la version neutre, sans nom ni accolade : ' + JSON.stringify(r.version && r.version.texte));
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Bonjour {prénom}, la {marque} ?' }] }, fav: Object.assign({}, fav, { pseudo: '', marque: '' }) });
  dit(!r.ok && r.raison === 'variable', 'P2 un AUTRE manque que le pseudo ({marque}) refuse toujours');
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'La {marque} ?' }, { id: 'u2', texte: 'Elle te plaît ?' }] }, fav: Object.assign({}, fav, { marque: '' }), hasard: () => 0 });
  dit(r.ok && r.version.cle === 'u2', 'P2 une version à {marque} pas sue n’est pas sautée');
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Remise {remise}' }, { id: 'u2', texte: 'Coucou' }] }, fav, offre: null });
  dit(r.ok && r.version.cle === 'u2', 'P2 {remise} sans offre n’est pas sautée');
  dit(F.fpErreurTexte('Salut {nom}') === 'variable' && F.fpErreurTexte('Salut {pseudo') === 'accolade' && F.fpErreurTexte('x'.repeat(2001)) === 'long' && F.fpErreurTexte('Salut {a|b} {prénom}') === '', 'P2 erreurs d’écriture mal dites');
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Salut {Prénom}' }] }, fav });
  dit(!r.ok, 'P2 une variable mal écrite ({Prénom}) part telle quelle');
  // P3 — conditions
  const R3 = { un: [{ id: 'u1', texte: 'Défaut' }], regles: [{ id: 'nuit', heures: { de: 22, a: 6 }, textes: ['Nuit'] }] };
  dit(ch({ reglage: R3, fav, ctx: { heure: 23, jour: 1 } }).regle === 'nuit' && ch({ reglage: R3, fav, ctx: { heure: 3, jour: 1 } }).regle === 'nuit' && ch({ reglage: R3, fav, ctx: { heure: 6, jour: 1 } }).cas === 'un' && ch({ reglage: R3, fav, ctx: { heure: 21, jour: 1 } }).cas === 'un', 'P3 plage d’heures par-dessus minuit mal jugée');
  const R3b = { un: [{ id: 'u1', texte: 'Défaut' }], regles: [{ id: 'we', jours: [0, 6], textes: ['WE'] }, { id: 'cher', prix: { min: 100, max: 200 }, textes: ['Cher'] }, { id: 'nk', marques: ['Nike'], textes: ['Nike'] }] };
  dit(ch({ reglage: R3b, fav, ctx: { heure: 10, jour: 6 } }).regle === 'we' && ch({ reglage: R3b, fav, ctx: { heure: 10, jour: 3 } }).regle === 'nk', 'P3 jour ou marque mal jugé');
  dit(ch({ reglage: R3b, fav: Object.assign({}, fav, { prix: 150, marque: '' }), ctx: { heure: 10, jour: 3 } }).regle === 'cher' && ch({ reglage: R3b, fav: Object.assign({}, fav, { prix: 250, marque: '' }), ctx: { heure: 10, jour: 3 } }).cas === 'un', 'P3 prix de X à Y mal jugé');
  dit(ch({ reglage: R3b, fav: Object.assign({}, fav, { prix: null, marque: '' }), ctx: { heure: 10, jour: 3 } }).cas === 'un', 'P3 prix pas su ⇒ la règle de prix s’applique (pas su ≠ oui)');
  dit(ch({ reglage: R3b, fav: Object.assign({}, fav, { marque: 'nïke ' }), ctx: { heure: 10, jour: 3 } }).regle === 'nk' && ch({ reglage: R3b, fav: Object.assign({}, fav, { marque: 'Nike SB' }), ctx: { heure: 10, jour: 3 } }).cas === 'un', 'P3 marque : égalité exacte (sans accent ni casse) attendue, jamais une ressemblance');
  // P4 — priorité
  const R4 = { un: [{ id: 'u1', texte: 'Défaut' }], lot: [{ id: 'l1', texte: 'Lot' }], regles: [{ id: 'a', heures: { de: 8, a: 20 }, textes: ['A'] }, { id: 'b', heures: { de: 8, a: 20 }, prix: { min: 10 }, textes: ['B'] }, { id: 'c', heures: { de: 8, a: 20 }, prix: { min: 10 }, textes: ['C'] }] };
  dit(ch({ reglage: R4, fav }).regle === 'b', 'P4 la plus précise, puis la plus haute : attendu « b », lu ' + ch({ reglage: R4, fav }).regle);
  dit(ch({ reglage: R4, fav, lotPermis: true }).cas === 'lot' && ch({ reglage: R4, fav, lotPermis: false }).cas === 'regle', 'P4 le lot ne passe pas avant les règles (ou passe sans être permis)');
  const R4b = { un: [{ id: 'u1', texte: 'Défaut' }], regles: [{ id: 'b', prix: { min: 10 }, marques: ['Nike'], textes: ['{taille} seulement'] }, { id: 'a', prix: { min: 10 }, textes: ['A'] }] };
  dit(ch({ reglage: R4b, fav: Object.assign({}, fav, { taille: '' }) }).regle === 'a', 'P4 une règle sans version possible bloque les suivantes');
  // P5 — aléa sans répétition
  const R5 = { un: [{ id: 'u1', texte: 'Un' }, { id: 'u2', texte: 'Deux' }, { id: 'u3', texte: 'Trois' }] };
  const vus = new Set(); let rep = 0;
  for (let i = 0; i < 200; i++) { const x = ch({ reglage: R5, fav, hasard: Math.random, derniere: { acheteur: 'u2', compte: 'u1' } }); vus.add(x.version.cle); if (x.version.cle === 'u2' || x.version.cle === 'u1') rep++; }
  dit(vus.size === 1 && vus.has('u3') && rep === 0, 'P5 la dernière version de l’acheteur ou du compte est retirée : ' + [...vus].join(','));
  const vus2 = new Set(); for (let i = 0; i < 200; i++) vus2.add(ch({ reglage: R5, fav, hasard: Math.random, derniere: { acheteur: 'u2' } }).version.cle);
  dit(vus2.size === 2 && !vus2.has('u2'), 'P5 au même acheteur deux fois de suite la même version : ' + [...vus2].join(','));
  const vus3 = new Set(); for (let i = 0; i < 300; i++) vus3.add(ch({ reglage: R5, fav, hasard: Math.random }).version.cle);
  dit(vus3.size === 3, 'P5 toutes les versions ne sortent pas au hasard : ' + [...vus3].join(','));
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Seule' }] }, fav, derniere: { acheteur: 'u1', compte: 'u1' } });
  dit(r.ok && r.version.cle === 'u1', 'P5 une seule version possible ⇒ rien ne part');
  // P6 — textes interdits / refusés
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Écris-moi sur WhatsApp' }, { id: 'u2', texte: 'Elle est dispo !' }] }, fav, hasard: () => 0 });
  dit(r.ok && r.version.cle === 'u2', 'P6 un texte interdit est tiré');
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Paiement par PayPal ?' }] }, fav });
  dit(!r.ok && r.raison === 'texte_interdit', 'P6 seul texte interdit : pas de refus « texte_interdit »');
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Un' }, { id: 'u2', texte: 'Deux' }] }, fav, refusee: (m) => m === 'Un', hasard: () => 0 });
  dit(r.ok && r.version.cle === 'u2', 'P6 une version refusée par Vinted est retirée');
  r = ch({ reglage: { un: [{ id: 'u1', texte: 'Mon 06 12 34 56 78 : {marque}' }] }, fav });
  dit(!r.ok, 'P6 le texte posé (après variables) n’est pas relu par la règle');
  dit(F.fpUneEnvoyable({ un: [{ texte: 'paypal' }] }, null, sur) === false && F.fpUneEnvoyable(null, { message: 'Salut' }, sur) === true, 'P6 la vérification AVANT écriture ne juge pas les versions');
  // P7 — rétro-compat et normalisation
  r = ch({ reglage: { un: [] }, ancien: { message: 'Bonjour {pseudo}', variantes: ['Salut {pseudo}'], lot: 'Lot !' }, fav, lotPermis: false, derniere: { compte: 'a1' } });
  dit(r.ok && r.source === 'ancien' && r.version.cle === 'a2' && r.version.n === 2, 'P7 sans version écrite, les textes d’avant ne servent pas (ou perdent leur n°)');
  r = ch({ reglage: null, ancien: { message: 'Bonjour', lot: 'Lot !' }, fav, lotPermis: true });
  dit(r.ok && r.cas === 'lot' && r.version.lot === true, 'P7 le message lot d’avant n’est plus utilisé');
  const N = F.fpReglage({ actif: true, un: ['A', { id: 'ZZ', texte: 'B' }, { texte: ' ' }, 'x'.repeat(2001)], regles: [{ textes: ['sans condition'] }, { heures: { de: 9, a: 9 }, textes: ['vide'] }, { prix: { min: 50, max: 10 }, textes: ['bornes'] }, { jours: [1, 1, 9], textes: ['L'] }] });
  dit(N.actif === false && N.un.length === 2 && N.un[0].id === 'u1' && N.un[1].id === 'u2' && N.regles.length === 1 && JSON.stringify(N.regles[0].jours) === '[1]', 'P7 fpReglage ne normalise pas : ' + JSON.stringify(N));
  // P9 — statistiques
  const J = 864e5, t = 1e12;
  const S = F.statsVersionsFavoris([...Array.from({ length: 10 }, (_, i) => ({ k: 'u1', t, i: String(i), o: i < 4 })), { k: 'u2', t, i: '50' }, { k: 'u2', t, i: '51' }, { v: 3, t, i: '52' }],
    new Map([['0', t + 2 * J], ['1', t + 15 * J], ['2', t - J], ['50', null], ['52', t + J]]));
  dit(S.u1 && S.u1.envoyes === 10 && S.u1.avecOffre === 4 && S.u1.vendus === 1 && S.u1.mesure === true, 'P9 statistiques de u1 fausses : ' + JSON.stringify(S.u1));
  dit(S.u2 && S.u2.mesure === false && S.u2.vendus === 0 && S.u2.vendusSansDate === 1 && S.a3 && S.a3.vendus === 1, 'P9 statistiques de u2 / a3 fausses : ' + JSON.stringify([S.u2, S.a3]));
  // P8 / P10 — sur le vrai moteur
  try {
    const off = fonction(BG, 'offreAvecPlancher') + '\n' + (fonction(BG, 'offreFavoriDetail') || ''), pof = fonction(BG, 'prixOffreFavori');   // 5.419 : offreAvecPlancher passe par offreFavoriDetail (la même règle, détaillée)
    const base = { plancher: null };
    const c = { Math, Number, String, noterDiag: () => {}, plancherFavori: async () => base.plancher };
    vm.runInNewContext(pof + '\n' + off + '\n;globalThis.__o = offreAvecPlancher;', c);
    base.plancher = { c: 5000 };
    const a1 = await c.__o('1', 60, { mode: 'pct', valeur: 20, arrondi: false });
    base.plancher = null;
    const a2 = await c.__o('1', 60, { mode: 'pct', valeur: 20, arrondi: false });
    dit(a1.prix === '50.00' && a2.prix === '48.00', 'P8 offre : remontée au plancher / au % réglé sans plancher : ' + JSON.stringify([a1, a2]));
    const ex = fonction(BG, 'executerMessageFavori');
    const nb = (ex.match(/choixMessageFavori\(/g) || []).length;
    dit(nb === 1, 'P10 executerMessageFavori doit appeler choixMessageFavori une fois (lu : ' + nb + ')');
    dit(!/choisirVariante\(envoyables/.test(ex), 'P10 le moteur tire encore le texte par choisirVariante(envoyables, …) (hors de la règle)');
    dit(/annonceOffreFavori\(versionB\.modele\)/.test(ex), 'P10 l’annonce d’une offre n’est pas jugée sur le modèle choisi');
    const ann = vm.runInNewContext(BG.slice(BG.indexOf('const annonceOffreFavori'), BG.indexOf('\n', BG.indexOf('const annonceOffreFavori'))) + ';annonceOffreFavori');
    dit(ann('À {prix_offre} pour toi') && ann('{remise} de moins') && !ann('Elle te plaît {prénom} ?'), 'P10 {prix_offre} / {remise} n’annoncent pas l’offre (elle partirait APRÈS le texte qui la dit)');
    const cm = fonction(BG, 'choixMessageFavori');
    dit(/choisirMessageFavori\(/.test(cm) && /derniere/.test(cm) && /refusee/.test(cm) && /sur:/.test(cm), 'P10 choixMessageFavori n’appelle pas la règle avec ses gardes');
  } catch (e) { fautes.push('P8/P10 : ' + e.message); }
  // P11 — l'enregistrement depuis le panneau (vrai `favorisPersoCarte`) : SON toucher, versions jugées, copie d'avant sûre.
  try {
    const code = [bloc(BG, RDEB, RFIN), bloc(BG, MDEB, MFIN), bloc(BG), fonction(BG, 'prixTexteFavori'), fonction(BG, 'personnaliserMessageFavori'), fonction(BG, 'fpJugerTexte'), fonction(BG, 'fpApercu'), fonction(BG, 'favorisPersoCarte')].join('\n');
    const ecrit = [];
    const c = { Intl, Date, Math, Number, String, Array, Object, Set, Map, JSON, RegExp, isFinite, ongletCarte: () => ({ url: 'https://www.vinted.fr/' }), compteConnecte: async () => '111',
      reglagesFavorisCarte: async (m) => { ecrit.push(['avant', m]); return { ok: true }; }, reglageAutoCarte: async (m) => { ecrit.push(['perso', m]); return { ok: true, relu: true }; } };
    vm.runInNewContext(code + '\n;globalThis.__p = favorisPersoCarte;', c);
    const S = {};
    let r = await c.__p({ quoi: 'enregistrer', reglage: { un: [{ id: 'u1', texte: 'La {marque} en {taille} ?' }] } }, S);
    dit(r.ok === false && r.code === 'sure' && !ecrit.length, 'P11 aucune version « 1 article » sûre : enregistré quand même');
    r = await c.__p({ quoi: 'enregistrer', reglage: { un: [{ id: 'u1', texte: 'Salut' }], regles: [{ prix: { min: 1 }, textes: ['Mon WhatsApp ?'] }] } }, S);
    dit(r.ok === false && r.code === 'texte' && !ecrit.length, 'P11 un texte interdit (dans une règle) est enregistré');
    r = await c.__p({ quoi: 'enregistrer', reglage: { un: [{ id: 'u1', texte: 'La {marque} ?' }, { id: 'u2', texte: 'Bonjour {prénom} !' }] }, offre: { pct: 12, arrondi: true }, rythme: 'prudent' }, S);
    const av = ecrit.find((x) => x[0] === 'avant'), pe = ecrit.find((x) => x[0] === 'perso');
    dit(r.ok && av && av[1].message === 'Bonjour {pseudo} !' && !(av[1].variantes || []).length && av[1].offre && av[1].offre.pct === 12 && av[1].offre.arrondi === true && av[1].rythme === 'prudent', 'P11 la copie d’avant n’est pas la version sûre ({prénom} → {pseudo}), ou l’offre / le rythme manquent : ' + JSON.stringify(av && av[1]));
    dit(pe && pe[1].cle === 'vinted_bleam' && pe[1].valeur.section === 'favMessages' && pe[1].valeur.valeur.un.length === 2 && pe[1].confirme === false, 'P11 SES versions ne vont pas dans vinted_bleam.favMessages : ' + JSON.stringify(pe && pe[1]).slice(0, 200));
    r = await c.__p({ quoi: 'verifier', reglage: { un: [{ id: 'u1', texte: 'Paie par PayPal {pseudo}' }, { id: 'u2', texte: 'Salut {nom}' }] }, favori: { pseudo: 'lea', titre: 'Nike', prix: 50 } }, S);
    dit(r.ok && r.versions.u1.motifs.length && r.versions.u1.motifs[0].code === 'paiement' && r.versions.u2.erreur === 'variable' && r.apercu && r.apercu.ok === false, 'P11 « verifier » ne signale pas un texte refusé / une variable inconnue : ' + JSON.stringify(r).slice(0, 300));
  } catch (e) { fautes.push('P11 : ' + e.message); }
  return fautes;
}

const MUTATIONS = [
  ['P2 prénom inventé', (s) => s.replace("return { prenom: pseudo,", "return { prenom: pseudo.split(/[._-]/)[0].replace(/^./, (c) => c.toUpperCase()),")],
  ['P2 variable pas sue gardée', (s) => s.replace('if (m.length) { m.forEach((k) => manques.add(k)); continue; }', 'if (m.length) { m.forEach((k) => manques.add(k)); }')],
  ['P3 pas su = oui (prix)', (s) => s.replace('if (!(p > 0)) return false; if (r.prix.min', 'if (!(p > 0)) return true; if (r.prix.min')],
  ['P3 minuit', (s) => s.replace('h >= de || h < a', 'h >= de && h < a')],
  ['P4 plus haute d’abord', (s) => s.replace('fpPrecision(y.r) - fpPrecision(x.r) || x.i - y.i', 'x.i - y.i')],
  ['P4 lot après les règles', (s) => s.replace("    if (lotPermis && R.lot.length) g.push", "    if (false) g.push")],
  ['P5 répétition acheteur', (s) => s.replace('for (const k of [d.acheteur, d.compte])', 'for (const k of [d.compte])')],
  ['P6 interdit tiré', (s) => s.replace('if (!sur(texte) || refusee(v.modele))', 'if (refusee(v.modele))')],
  ['P7 ancien ignoré', (s) => s.replace("g.push({ cas: 'un', regle: null, versions: l.map", "g.push({ cas: 'un', regle: null, versions: [].map")],
  ['P9 14 jours', (s) => s.replace('dv - t <= FP_VENDU_JOURS * 864e5', 'true')],
];
(async () => {
  const SRC = fs.readFileSync(F_SRC, 'utf8'), BG = fs.readFileSync(F_BG, 'utf8');
  const prouve = process.argv.includes('--prouve');
  const f = await verifier(SRC, BG);
  if (f.length) { for (const x of f) console.log('❌ ' + x); console.log(`audit-favoris-perso : ${f.length} rouge(s)`); } else console.log('✅ audit-favoris-perso : toutes les règles tiennent (P1–P11)');
  if (!prouve) process.exit(f.length ? 1 : 0);
  let ok = 0;
  for (const [nom, mut] of MUTATIONS) {
    const b = bloc(BG), m = mut(b);
    if (m === b) { console.log(`❌ mutation « ${nom} » : rien n’a changé (le texte cherché a bougé)`); continue; }
    const g = await verifier(SRC.replace(bloc(SRC), m), BG.replace(b, m));
    const vrai = g.filter((x) => !/^P1 /.test(x));
    if (vrai.length) { ok++; console.log(`✅ mutation « ${nom} » ⇒ rouge (${vrai[0].slice(0, 90)})`); } else console.log(`❌ mutation « ${nom} » : aucun rouge`);
  }
  console.log(`--prouve : ${ok}/${MUTATIONS.length} mutations détectées`);
  process.exit(f.length || ok < MUTATIONS.length ? 1 : 0);
})();
