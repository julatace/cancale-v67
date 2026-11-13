// ════════════════════════════════════════════════════════════════════════════
//  GARDIEN — FAMILLE « STOCKAGE PROTÉGÉ, ÉCOUTEURS NETTOYÉS, CLÉS STABLES »
//  (11 nov., familles de l'app)
//   A. src/stockageSur.js exécuté contre un `localStorage` qui LÈVE (Safari privé,
//      quota plein) : rien ne lève, la valeur par défaut revient ;
//   B. CLIQUET : un `localStorage.getItem/setItem/removeItem` ou un `JSON.parse` sans
//      `try` devant lui ne peut que diminuer (plafond par fichier ; Stats : 0) ;
//      la synchro (lireLocalSync, poserFusionLocale) lève EXPRÈS : un stockage illisible
//      doit l'arrêter, jamais pousser une liste vide au nuage (§5) ;
//   C. chaque effet React qui pose un écouteur sur window/document le retire, et chaque
//      `setInterval` d'un effet a son `clearInterval` ;
//   D. CLIQUET : `key={i}` (index) ne peut que diminuer.
//    node scripts/audit-stockage-sur.cjs            → contrôle
//    node scripts/audit-stockage-sur.cjs --prouve   → chaque mutation doit faire rougir
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs');
const path = require('path');
const { prouver, sansCommentaires, fichiers } = require('./_mutations-gardien.cjs');

const R = process.env.VRM_RACINE || path.join(__dirname, '..');

if (process.argv.includes('--prouve')) {
  const MUT = [
    ['lireLocal sans garde', 'src/stockageSur.js', "  try { const s = stockage(); if (!s) return defaut; const v = s.getItem(cle); return v == null ? defaut : v; } catch (_) { return defaut; }", "  const s = stockage(); if (!s) return defaut; const v = s.getItem(cle); return v == null ? defaut : v;"],
    ['« Fermer le bilan » : setItem nu', 'src/ecrans/Stats.jsx', "onClick={()=>{ecrireLocal('vinted_last_weekly_recap',isoWeek);setShowWeekly(false);}}", "onClick={()=>{localStorage.setItem('vinted_last_weekly_recap',isoWeek);setShowWeekly(false);}}"],
    ['écouteur de fenêtre jamais retiré', 'src/ModeRelais.jsx', "document.removeEventListener('visibilitychange', vis);", ''],
    ['une clé d’index de plus', 'src/ecrans/Stats.jsx', "{ventes.map((v,i)=>{", "{ventes.map((v,i)=>{ void <b key={i}/>;"],
  ];
  process.exit(prouver(__filename, MUT, R) ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log(`${c ? '✅' : '❌'} ${m}${!c && d ? ' — ' + d : ''}`); };

(async () => {
  console.log('── A · src/stockageSur.js face à un stockage qui LÈVE');
  {
    const leve = { getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); }, removeItem() { throw new Error('SecurityError'); } };
    const avant = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    Object.defineProperty(globalThis, 'localStorage', { value: leve, configurable: true, writable: true });
    let S = null; try { S = await import('file://' + path.join(R, 'src', 'stockageSur.js') + '?leve'); } catch (e) { dit(false, 'src/stockageSur.js se charge', e.message); }
    if (S) {
      let r; try { r = [S.lireLocal('x', 'defaut'), S.ecrireLocal('x', 'v'), S.retirerLocal('x'), S.stockageDispo(), S.lireJSON('{pas du json', []), S.lireJSON('{"a":1}', null)]; } catch (e) { r = 'LÈVE ' + e.message; }
      dit(Array.isArray(r) && r[0] === 'defaut' && r[1] === false && r[2] === false && r[3] === false && Array.isArray(r[4]) && r[5] && r[5].a === 1,
        'stockage illisible : lecture ⇒ défaut, écriture ⇒ false, JSON illisible ⇒ défaut — jamais une exception', JSON.stringify(r));
    }
    const vrai = new Map();
    Object.defineProperty(globalThis, 'localStorage', { value: { getItem: (k) => (vrai.has(k) ? vrai.get(k) : null), setItem: (k, v) => vrai.set(k, String(v)), removeItem: (k) => vrai.delete(k) }, configurable: true, writable: true });
    if (S) dit(S.ecrireLocal('k', { a: 2 }) && S.lireJSON(S.lireLocal('k')).a === 2 && S.stockageDispo(), 'stockage qui marche : écrit, relu', '');
    if (avant) Object.defineProperty(globalThis, 'localStorage', avant); else delete globalThis.localStorage;
  }

  const textes = fichiers(path.join(R, 'src')).map((f) => [path.relative(R, f).split(path.sep).join('/'), sansCommentaires(fs.readFileSync(f, 'utf8'))]);

  // (12 nov., revue fin) Juger la RÈGLE : un appel DANS un bloc `try { … }` (même plus de 3 lignes
  // plus haut) est protégé — on remonte les accolades jusqu'à une accolade ouvrante précédée de `try`.
  // On s'arrête à la première frontière de fonction (`=>` ou `function … (…) {`) : un rappel déclaré
  // dans un try n'est PAS protégé quand il s'exécute plus tard (sauf rappel synchrone, non jugé ici).
  function dansUnTry(t, pos) {
    let prof = 0;
    for (let i = pos - 1; i >= 0; i--) {
      const c = t[i];
      if (c === '}') prof++;
      else if (c === '{') {
        if (prof > 0) { prof--; continue; }
        const avant = t.slice(Math.max(0, i - 120), i);
        if (/\btry\s*$/.test(avant)) return true;
        // un rappel d'une méthode de tableau SYNCHRONE (forEach, map…) s'exécute dans le try qui l'entoure
        if (/\.(?:forEach|map|filter|some|every|reduce|find|findIndex|flatMap)\(\s*(?:\([^()]*\)|[\w$]+)\s*=>\s*$/.test(avant)) continue;
        if (/=>\s*$/.test(avant) || /\bfunction\b[^{};]*\)\s*$/.test(avant) || /^\s*(?:async\s+)?\w+\s*\([^)]*\)\s*$/.test(avant.split('\n').pop())) return false;
      }
    }
    return false;
  }
  console.log('\n── B · Cliquet : stockage et JSON.parse sans `try`');
  {
    // Plafonds au 12 nov. (revue fin : 15 → 4 dans App.jsx, une fois le try ENGLOBANT reconnu — les 11 autres
    // étaient protégés plus de 3 lignes plus haut). App.jsx : lireLocalSync et poserFusionLocale (EXPRÈS : la
    // synchro s'arrête) + deux lectures de « Restaurer une sauvegarde » (l'appelant les attrape et le dit).
    // (12 nov., intégration 12nov-a) + src/tvaMarge.js (paquet g2) : sous un `try` 4 lignes plus haut.
    const PLAFOND = { 'src/App.jsx': 4, 'src/meilleuresSources.js': 1, 'src/sourceAchats.js': 1, 'src/vitesseEnvoi.js': 1, 'src/tvaMarge.js': 1 };
    const trop = [], parF = new Map();
    for (const [rel, t] of textes) {
      if (rel === 'src/stockageSur.js') continue;
      const L = t.split('\n'); let n = 0, debutLigne = 0;
      L.forEach((l, i) => {
        const re = /localStorage\.(getItem|setItem|removeItem)\(|JSON\.parse\((?!\s*JSON\.stringify\()/g; let m;
        while ((m = re.exec(l))) {
          const avant = L.slice(Math.max(0, i - 3), i).join('\n') + '\n' + l.slice(0, m.index);
          if (!/\btry\b|catch\s*\(|\.catch\(|catch\s*\{/.test(avant) && !dansUnTry(t, debutLigne + m.index)) n++;
        }
        debutLigne += l.length + 1;
      });
      const logique = /^src\/coeur\//.test(rel) ? 'src/App.jsx' : rel;   // (13 nov.) src/coeur/* = App.jsx découpé
      parF.set(logique, (parF.get(logique) || 0) + n);
    }
    for (const [rel, n] of parF) if (n > (PLAFOND[rel] || 0)) trop.push(`${rel} ${n} > ${PLAFOND[rel] || 0}`);
    dit(!trop.length, 'pas un stockage ni un JSON.parse nu de plus (Stats, Achats, Ventes : 0)', trop.join(', '));
  }

  console.log('\n── C · Effets : écouteurs de fenêtre retirés, intervalles arrêtés');
  {
    const fuites = [];
    for (const [rel, t] of textes) {
      const re = /\buse(?:Layout)?Effect\(/g; let m;
      while ((m = re.exec(t))) {
        let i = m.index + m[0].length, prof = 1;
        for (; i < t.length && prof > 0; i++) { const c = t[i]; if (c === '(') prof++; else if (c === ')') prof--; }
        const corps = t.slice(m.index, i);
        const n = (r) => (corps.match(r) || []).length;
        const add = n(/\b(?:window|document)\.addEventListener\(/g) - n(/\b(?:window|document)\.addEventListener\([^)]*\{\s*once\s*:\s*true/g);
        const rem = n(/\b(?:window|document)\.removeEventListener\(/g);
        const si = n(/\bsetInterval\(/g), ci = n(/\bclearInterval\(/g);
        if (add > rem || si > ci) fuites.push(`${rel}:${t.slice(0, m.index).split('\n').length} (écouteurs ${add}/${rem}, intervalles ${si}/${ci})`);
      }
    }
    dit(!fuites.length, 'chaque effet retire ses écouteurs window/document et arrête ses intervalles', fuites.slice(0, 6).join(' · '));
  }

  console.log('\n── D · Cliquet : clés React d’index');
  {
    // Plafonds au 11 nov. (après corrections ; Stats : la liste des ventes d'un mois a sa clé).
    // (12 nov., intégration 12nov-a) relevés pour les lots du paquet g2 (Créer sur Vinted, gros lot, sécurité
    // des comptes, suivi-travail, eBay, Leboncoin, Réglages…) : dette NOMMÉE, mesurée à l'intégration.
    const PLAFOND = {'src/ATrancher.jsx':1, 'src/Accueil.jsx':1, 'src/AccueilFilm.jsx':4, 'src/AdresseReception.jsx':3, 'src/AnnoncesACompleter.jsx':1, 'src/AnnoncesInstantanee.jsx':2, 'src/App.jsx':55, 'src/AvisVente.jsx':1, 'src/AvisVinted.jsx':1, 'src/Bienvenue.jsx':2, 'src/BoiteEmails.jsx':9, 'src/CarteRelais.jsx':1, 'src/Chargement.jsx':1, 'src/ChoixPeriode.jsx':5, 'src/ColisVentesInstantanes.jsx':3, 'src/ConfigurationDepart.jsx':1, 'src/ConfigurerTransfert.jsx':1, 'src/EnLigneDeuxFois.jsx':1, 'src/FacturePro.jsx':9, 'src/FavorisVinted.jsx':4, 'src/FichePaire.jsx':4, 'src/InventaireStock.jsx':3, 'src/JourneeInstantanee.jsx':1, 'src/LigneGlissable.jsx':2, 'src/LivrePoliceCarte.jsx':1, 'src/MeilleuresSources.jsx':1, 'src/ModeAutoFavoris.jsx':2, 'src/ModeEmballage.jsx':1, 'src/ModeRelais.jsx':1, 'src/OutilsArticlesVinted.jsx':1, 'src/OutilsParcours.jsx':1, 'src/ParcoursArrivee.jsx':2, 'src/PreparerColis.jsx':2, 'src/RelierBoite.jsx':2, 'src/RepartitionAnneau.jsx':1, 'src/Room3D.jsx':1, 'src/Squelette.jsx':8, 'src/Tournee.jsx':3, 'src/ToutVaBien.jsx':3, 'src/Visionneuse.jsx':1, 'src/VisiteBulles.jsx':1, 'src/accueil-carte.jsx':1, 'src/accueil-scenes.jsx':3, 'src/communaute/Accompagnement.jsx':4, 'src/communaute/Communaute.jsx':3, 'src/communaute/Formateur.jsx':1, 'src/composants/AideEcran.jsx':3, 'src/composants/ImportAchats.jsx':1, 'src/composants/ImportStock.jsx':2, 'src/composants/InfoPop.jsx':1, 'src/composants/MesuresTerrain.jsx':1, 'src/composants/NoteSatisfaction.jsx':1, 'src/composants/SignalerProbleme.jsx':5, 'src/composants/TableauProprietaire.jsx':1, 'src/design/CarteMois.jsx':1, 'src/design/CarteStats.jsx':2, 'src/ebayGestion.jsx':4, 'src/ecrans/Achats.jsx':1, 'src/ecrans/Compta.jsx':9, 'src/ecrans/Ebay.jsx':5, 'src/ecrans/Leboncoin.jsx':10, 'src/ecrans/PrixMarche.jsx':1, 'src/ecrans/Reglages.jsx':10, 'src/ecrans/Republier.jsx':6, 'src/ecrans/Stats.jsx':10, 'src/ecrans/Stock.jsx':5, 'src/operations/Operations.jsx':1, 'src/operations/Syntheses.jsx':1, 'src/ArgentPlus.jsx':4, 'src/CreerSurVinted.jsx':2, 'src/FavorisEtapes.jsx':2, 'src/GrosLot.jsx':1, 'src/HistoriqueSites.jsx':1, 'src/PasEnLigne.jsx':1, 'src/RangerAchat.jsx':2, 'src/RepubProgramme.jsx':1, 'src/SecuriteComptes.jsx':2, 'src/composants/SuiviTravail.jsx':3, 'src/ebay/ConnexionEbayGuidee.jsx':1, 'src/ebay/FenetresEbay.jsx':1, 'src/ecrans/FilsTous.jsx':1};
    const trop = [];
    let total = 0;
    const parCle = new Map();
    for (const [rel, t] of textes) {
      const n = (t.match(/key=\{(?:i|idx|ix|index|j|k|n)\}/g) || []).length; total += n;
      const logique = /^src\/coeur\//.test(rel) ? 'src/App.jsx' : rel;   // (13 nov.) src/coeur/* = App.jsx découpé
      parCle.set(logique, (parCle.get(logique) || 0) + n);
    }
    for (const [rel, n] of parCle) { const max = PLAFOND[rel] || 0; if (n > max) trop.push(`${rel} ${n} > ${max}`); }
    dit(!trop.length, `pas une clé d’index de plus (${total} au total, liste d’éléments à id ⇒ son id)`, trop.join(', '));
  }

  console.log(`\n${ko ? '❌' : '✅'} stockage protégé · écouteurs · clés : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
