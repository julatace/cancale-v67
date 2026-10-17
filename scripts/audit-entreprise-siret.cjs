// AUDIT — SIRET → nom de l'entreprise (17 octobre).
// Exécute la VRAIE règle (`api/_lib/entreprise.js`) contre un faux registre :
//   · un SIREN égal ⇒ le nom ; l'adresse SEULEMENT pour l'établissement exact ;
//   · un résultat au SIREN différent (la recherche plein texte rend « ce qui
//     ressemble ») ⇒ « inconnu », jamais ce nom-là (§5) ;
//   · registre muet, en erreur, ou forme illisible ⇒ 503 « pas su », jamais
//     « inconnu » (trois états) ;
//   · un numéro de la mauvaise longueur ⇒ 400, aucun appel ;
//   · la route exige une session (pas un relais ouvert).
'use strict';
const path = require('path'), fs = require('fs');
let ko = 0;
const dit = (bon, quoi, det) => { if (!bon) ko++; console.log(`${bon ? 'OK ' : 'KO '} ${quoi}${!bon && det ? ' — ' + det : ''}`); };
const RACINE = path.join(__dirname, '..');

(async () => {
  let mod;
  try { mod = await import(path.join(RACINE, 'api', '_lib', 'entreprise.js')); }
  catch (e) { dit(false, 'la règle existe (api/_lib/entreprise.js)', String(e.message).slice(0, 120)); return fin(); }
  const { routeEntreprise } = mod;
  const rep = (status, body) => async () => ({ ok: status < 400, status, json: async () => body });
  const lu = [];
  const espion = (fn) => async (url, o) => { lu.push(url); return fn(url, o); };
  const SIRET = '12345678900021';
  const registre = {
    results: [
      { siren: '999999999', nom_complet: 'SHOP QUI RESSEMBLE', siege: { siret: '99999999900011', adresse: '1 rue Faux', code_postal: '75001', libelle_commune: 'PARIS' } },
      { siren: '123456789', nom_raison_sociale: 'LA RESERVE', nom_complet: 'LA RESERVE (LA RÉSERVE)',
        siege: { siret: '12345678900013', adresse: '2 rue Siège', code_postal: '35000', libelle_commune: 'RENNES' },
        matching_etablissements: [{ siret: SIRET, adresse: '33 boulevard Gabriel Guist’Hau', code_postal: '44000', libelle_commune: 'NANTES' }] },
    ],
  };

  let r = await routeEntreprise(SIRET, espion(rep(200, registre)));
  dit(r.status === 200 && r.body.etat === 'trouve', 'un SIREN égal ⇒ trouvé', JSON.stringify(r.body));
  dit(r.body.nom === 'LA RESERVE', 'le nom est celui du SIREN exact, pas celui qui ressemble', r.body.nom);
  dit(r.body.ville === 'NANTES' && r.body.codePostal === '44000', 'l’adresse est celle de l’établissement EXACT (pas le siège)', `${r.body.codePostal} ${r.body.ville}`);
  dit(lu.length === 1 && /recherche-entreprises\.api\.gouv\.fr/.test(lu[0]) && lu[0].includes(SIRET), 'le registre public est interrogé une fois, avec le numéro', lu.join(' | '));

  r = await routeEntreprise('12345678900099', rep(200, registre));
  dit(r.body.etat === 'trouve' && !r.body.etabTrouve && r.body.adresse === '', 'SIREN connu mais établissement inconnu ⇒ le nom, et AUCUNE adresse devinée', JSON.stringify(r.body));

  r = await routeEntreprise('55555555500017', rep(200, registre));
  dit(r.status === 200 && r.body.etat === 'inconnu', 'aucun SIREN égal ⇒ « inconnu », jamais « SHOP QUI RESSEMBLE »', JSON.stringify(r.body));

  r = await routeEntreprise(SIRET, async () => { throw new Error('réseau'); });
  dit(r.status === 503 && r.body.code === 'pas-su', 'registre injoignable ⇒ 503 pas su', JSON.stringify(r));
  r = await routeEntreprise(SIRET, rep(500, {}));
  dit(r.status === 503, 'registre en erreur ⇒ 503 pas su', String(r.status));
  r = await routeEntreprise(SIRET, async () => ({ ok: true, status: 200, json: async () => { throw new Error('html'); } }));
  dit(r.status === 503, 'réponse illisible (HTML) ⇒ 503 pas su, pas « inconnu »', String(r.status));

  lu.length = 0;
  r = await routeEntreprise('1234', espion(rep(200, registre)));
  dit(r.status === 400 && lu.length === 0, 'un numéro de la mauvaise longueur ⇒ 400, aucun appel', `${r.status} · ${lu.length} appel(s)`);

  const src = fs.readFileSync(path.join(RACINE, 'api', 'compte.js'), 'utf8');
  const corps = (/async function entreprise\(req, res\) \{([\s\S]*?)\n\}/.exec(src) || [])[1] || '';
  dit(/vendeurExige\(req, res\)/.test(corps) && /if \(!vendeur\) return;/.test(corps), 'la route exige une session avant tout appel', corps ? '' : 'mode absent');
  dit(/mode === 'entreprise'/.test(src), 'le mode est branché dans api/compte.js (aucune 13ᵉ fonction)', '');
  fin();
})();
function fin() { console.log(ko ? `\n❌ SIRET → entreprise : ${ko} rouge(s)` : '\n✅ SIRET → entreprise : par identité, trois états'); process.exit(ko ? 1 : 0); }
