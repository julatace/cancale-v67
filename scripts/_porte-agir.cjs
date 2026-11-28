// ════════════════════════════════════════════════════════════════════════════
//  LA RÈGLE « AGIR DEPUIS VRM SI L'EXTENSION EST CONNECTÉE » — partagée par les audits (25 nov.)
//  Julien, 24 nov. : « Je vais devoir répondre à mes messages, republier dans l'application, faire absolument
//  tout si l'extension est connectée. Si l'extension n'est pas connectée sur un compte, on peut voir les données
//  mais on ne peut pas agir dessus. » (remplace le « tout dans le panneau » du 20 nov. ; CLAUDE.md §3)
//
//  Un geste de plateforme lancé depuis un écran se juge en DEUX moitiés, toutes deux exigées :
//   1. EXÉCUTÉ : la porte (src/agir/porte.js sur la règle src/agir/peutAgir.js), servie de faits inventés —
//      · connecté (compte de l'onglet) ⇒ SA confirmation d'abord (refusée ⇒ rien), puis UNE commande pour CET
//        article (ses identifiants dans `args`) déposée pour l'extension ;
//      · pas connecté (autre compte, pas de faits) ⇒ RIEN n'est déposé ; le panneau (ou la lecture seule) pour CET
//        article ;
//   2. LU dans l'écran : le geste passe par la porte (un appel de porte sur CET article) ET garde le repli sur CET
//      article (panneau / bouton d'extension). Chaque moitié lue est rejouée SANS la porte (les appels de porte
//      retirés du code) : elle doit alors échouer — un contrôle qui ne peut pas échouer est pire qu'absent (§6.1).
//  Mutation : `MUTATION_PORTE=1` retire la garde de la porte (envoyerGeste / agirOuPanneau / republierDansApp)
//  dans une copie : chaque contrôle qui s'appuie sur cette règle doit rougir.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { pathToFileURL } = require('url');
const SRC = path.join(__dirname, '..', 'src');

// Les appels de PORTE reconnus dans un écran (src/agir/*) : un seul suffit pour la moitié « lue ».
const APPELS_PORTE = ['agirOuPanneau', 'envoyerGeste', 'envoyerSerie', 'republierDansApp', 'agirMaintenant', 'usePeutAgir', 'useCompteAgir',
  'supprimerLbcAgir', 'publierLbcAgir', 'publierLbcDepuisVrm', 'pauseLbcAgir', 'republierAgir', 'BoutonAgir', 'BaisseSerieAgir', 'RepondreAgir', 'OffreAgir', 'peutAgir'];
// (un alias d'import compte : `agirOuPanneauC`, `usePeutAgirC`…)
const RE_PORTE = new RegExp('\\b(?:' + APPELS_PORTE.join('|') + ')\\w*');
const sansPorte = (code) => String(code || '').replace(new RegExp('\\b(?:' + APPELS_PORTE.join('|') + ')\\w*', 'g'), 'geste_sans_porte');

const MUTATION = process.env.MUTATION_PORTE === '1';
const GARDES = [
  ["  if (!v.ok) return { ok: false, raison: v.raison, verdict: v };\n", ''],
  ["  if (!v.ok) { if (typeof panneau === 'function') { panneau(); return { panneau: true }; } return { ok: false, verdict: v }; }\n", ''],
  ["  const ok = l0.filter((a) => agirMaintenant('vinted', a.compte, 'republier', 'file').ok);", '  const ok = l0;'],
];
async function chargerPorte() {
  if (!MUTATION) return { P: await import(pathToFileURL(path.join(SRC, 'agir', 'peutAgir.js')).href), Porte: await import(pathToFileURL(path.join(SRC, 'agir', 'porte.js')).href) };
  const dir = fs.mkdtempSync(path.join(SRC, 'agir', '.mutation-'));
  process.on('exit', () => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} });   // jamais laissée dans src/
  try {
    let porte = fs.readFileSync(path.join(SRC, 'agir', 'porte.js'), 'utf8');
    for (const [a, b] of GARDES) { if (!porte.includes(a)) throw new Error('mutation : garde introuvable ' + a.trim().slice(0, 60)); porte = porte.replace(a, b); }
    const vraie = pathToFileURL(path.join(SRC, 'agir', 'peutAgir.js')).href;
    if (!porte.includes("from './peutAgir.js'")) throw new Error('mutation : import de la règle introuvable');
    fs.writeFileSync(path.join(dir, 'porte.js'), porte.replace("from './peutAgir.js'", `from '${vraie}'`));
    return { P: await import(vraie), Porte: await import(pathToFileURL(path.join(dir, 'porte.js')).href) };
  } finally { /* retirée à la sortie (process.on('exit')) */ }
}

// Des faits INVENTÉS (forme de audit-agir-si-connecte) : CE navigateur a l'extension branchée, l'onglet Vinted sur A,
// Leboncoin sur lbcA, Vestiaire sur vcA ; B, lbcB, vcB ne sont ouverts nulle part.
function faitsInventes(P) {
  const T = Date.now(), MOI = '0f0e0d0c-0000-4000-8000-000000000001', ICI = 'aaaaaaaaaaaaaaaa';
  const caps = {}; for (const site of Object.keys(P.GESTES_AGIR)) for (const g of Object.values(P.GESTES_AGIR[site])) { caps[g.cap] = '5.100.0'; if (g.distCap) caps[g.distCap] = '5.100.0'; }
  caps.adistance = '5.100.0';
  const noms = { vinted: { 41000001: 'boutique', 41000002: 'boutique' }, leboncoin: { lbcA: 'boutique', lbcB: 'boutique' }, vestiaire: { vcA: 'boutique', vcB: 'boutique' } };
  return { maintenant: T, attendue: '5.450.1', capacites: caps, telephone: false, brancheEnCours: false, moi: { id: MOI, email: 'x@y.z' },
    ext: { present: true, appelsFinis: true, installeeIci: true, version: '5.450.1', plusieurs: [], perime: false,
      etat: { ok: true, vrm: { connecte: true, user_id: MOI, email: 'x@y.z' }, vinted: { uid: '41000001', login: 'boutique' }, ici: { appareil: ICI } } },
    presences: [{ id: ICI, atMs: T - 30000, allume: true, ver: '5.450.1', nav: 'chrome', sys: 'mac', comptes: [{ site: 'vinted', id: '41000001', nom: 'boutique' }, { site: 'leboncoin', id: 'lbcA', nom: 'boutique' }, { site: 'vestiaire', id: 'vcA', nom: 'boutique' }], retenues: [], enCours: '', rt: '' }],
    appareils: [], toutArrete: null, ebay: { principal: true }, noms };
}

let preuve = null;
// La moitié EXÉCUTÉE : rend { ok, fautes[] } (une fois par processus).
async function porteTient() {
  if (preuve) return preuve;
  preuve = (async () => {
    const fautes = [];
    let P, Porte;
    try { ({ P, Porte } = await chargerPorte()); } catch (e) { return { ok: false, fautes: ['la porte ne se charge pas : ' + (e && e.message)] }; }
    const deposes = [];
    Porte.poserEnvoiAgir({ deposer: async (c) => { deposes.push(c); return { id: 'cmd' + deposes.length }; } });
    const prev = typeof globalThis.window;
    if (prev === 'undefined') globalThis.window = { dispatchEvent() {} };
    try {
      const faits = faitsInventes(P);
      for (const [site, A, B, geste, dist] of [['vinted', '41000001', '41000002', 'repondre', 'repondre'], ['leboncoin', 'lbcA', 'lbcB', 'supprimer', 'supprimer'], ['vestiaire', 'vcA', 'vcB', 'repondre', 'repondre']]) {
        // Pas de faits : lecture seule, rien ne part.
        Porte.poserFaitsAgir(null); deposes.length = 0;
        let panneaux = [];
        const r0 = await Porte.agirOuPanneau({ site, compte: A, geste, distGeste: dist, args: { id: 'X-' + site }, panneau: () => panneaux.push('X-' + site) });
        if (deposes.length || !(r0 && r0.panneau) || panneaux.join() !== 'X-' + site) fautes.push(`${site} : sans faits (pas su) ⇒ rien ne part, le panneau de CET article`);
        Porte.poserFaitsAgir(faits);
        // Un AUTRE compte que celui de l'onglet : rien ne part, le panneau de CET article.
        deposes.length = 0; panneaux = [];
        const r1 = await Porte.agirOuPanneau({ site, compte: B, geste, distGeste: dist, args: { id: 'B-' + site }, panneau: () => panneaux.push('B-' + site) });
        if (deposes.length || !(r1 && r1.panneau) || panneaux.join() !== 'B-' + site) fautes.push(`${site} : compte pas connecté ⇒ rien ne part, le panneau de CET article`);
        const e1 = await Porte.envoyerGeste({ site, compte: B, geste, distGeste: dist, args: { id: 'B2-' + site } });
        if (deposes.length || (e1 && e1.ok)) fautes.push(`${site} : envoyerGeste au nom d'un compte pas connecté ⇒ rien`);
        // Connecté : SA confirmation refusée ⇒ rien ; acceptée ⇒ UNE commande pour CET article.
        deposes.length = 0; let conf = 0;
        await Porte.agirOuPanneau({ site, compte: A, geste, distGeste: dist, args: { id: 'A-' + site }, confirmer: async () => { conf++; return false; }, panneau: () => fautes.push(`${site} : connecté ⇒ pas le panneau`) });
        if (conf !== 1 || deposes.length) fautes.push(`${site} : connecté, confirmation refusée ⇒ rien ne part`);
        await Porte.agirOuPanneau({ site, compte: A, geste, distGeste: dist, args: { id: 'A-' + site }, confirmer: async () => true });
        if (deposes.length !== 1 || deposes[0].args.id !== 'A-' + site || String(deposes[0].compte) !== A || deposes[0].geste !== dist || deposes[0].confirme !== true) fautes.push(`${site} : connecté, confirmé ⇒ UNE commande pour CET article, au nom de CE compte — ${JSON.stringify(deposes)}`);
      }
      // Republier depuis l'app : seules les annonces d'un compte connecté partent, après UNE confirmation.
      deposes.length = 0;
      const rr = await Porte.republierDansApp([{ compte: '41000001', id: '9001' }, { compte: '41000002', id: '9002' }], async () => true);
      if (deposes.length !== 1 || deposes[0].args.id !== '9001' || !rr || rr.refusees !== 1) fautes.push('republier : seule l’annonce du compte connecté part — ' + JSON.stringify(deposes));
    } catch (e) { fautes.push('exception : ' + (e && e.message)); }
    finally { if (prev === 'undefined') delete globalThis.window; Porte.poserEnvoiAgir(null); Porte.poserFaitsAgir(null); }
    return { ok: !fautes.length, fautes };
  })();
  return preuve;
}

// La moitié LUE : `code` (le geste dans l'écran), `porte` (regex : l'appel de porte sur CET article), `repli` (regex : le
// panneau / bouton d'extension sur CET article). Les deux doivent tenir, et `porte` doit ÉCHOUER une fois la porte retirée.
function lue(code, porte, repli) {
  const c = String(code || '');
  const fautes = [];
  if (!c) fautes.push('le geste est introuvable dans l’écran');
  if (!RE_PORTE.test(c) || !porte.test(c)) fautes.push('le geste ne passe pas par la porte (peutAgir) sur CET article');
  if (repli && !repli.test(c)) fautes.push('pas connecté : le repli (panneau / lecture seule) sur CET article manque');
  if (porte.test(sansPorte(c))) fautes.push('contrôle sans effet : il tient même porte retirée');
  return fautes;
}

// Les deux moitiés. Rend { ok, detail }.
async function regle({ code, porte, repli }) {
  const f = lue(code, porte, repli);
  const p = await porteTient();
  const fautes = f.concat(p.ok ? [] : p.fautes);
  return { ok: !fautes.length, detail: fautes.join(' · ') };
}

// La carte d'offre Vinted du fil (Comptabilite.jsx) : Accepter (confirmé) · Refuser · Proposer SON mini, DEPUIS VRM par la porte,
// sur CETTE offre (tx + offer_request_id, jamais un titre) ; pas connecté ⇒ boutons éteints avec la raison (BoutonAgir).
// (25 nov.) messages-pro : la carte porte aussi `decrit` (le bandeau « Lecture seule ») et nomme le geste en entier.
function offreVinted(app, agir) {
  const corps = (t, debut) => { const i = t.indexOf(debut); if (i < 0) return ''; const j = t.indexOf('\nexport ', i + 1); return t.slice(i, j < 0 ? i + 3000 : j); };
  return regle({ code: (String(app).match(/<GestesOffreVinted compte=\{[^\n]*/) || [''])[0] + '\n' + corps(String(agir), 'export function GestesOffreVinted('),
    porte: /<GestesOffreVinted compte=\{String\(openConv\.acc\?\.vinted_user_id\|\|''\)\} tx=\{off\.tx\} oid=\{off\.oid\} conv=\{openConv\.convId\} prix=\{off\.prix\} contre=\{contreMini!=null&&contreMini>=1\?contreMini:null\}(?: decrit=\{\w+\})?(?: plancher=\{[^\n]*?)?\/>[\s\S]*envoyerGeste\(\{ (?:\.\.\.base|site: 'vinted', compte, geste: 'offre'), distGeste, args, confirme \}\)[\s\S]*const ids = \{ tx: String\(tx\), oid: String\(oid\)[\s\S]*onClick=\{\(\) => setConfirmer\(true\)\}[\s\S]*partir\('accepter', \{ \.\.\.ids, prix \}, true\)/,
    repli: /<BoutonAgir \{\.\.\.base\} par="file"/ });
}

// Supprimer une annonce Leboncoin (src/ecrans/Leboncoin.jsx `supprimerSurLbc`) : SA confirmation « sans retour » d'abord, puis
// une commande pour CETTE annonce, par la porte ; pas connecté ⇒ le panneau sur CETTE annonce (src/agir/Agir.jsx).
function supprimerLbc(lbc, agir) {
  const corps = (t, debut) => { const i = t.indexOf(debut); if (i < 0) return ''; const j = t.indexOf('\nexport ', i + 1); return t.slice(i, j < 0 ? i + 3000 : j); };
  return regle({ code: (String(lbc).match(/const supprimerSurLbc = \(r\) => [^\n]*/) || [''])[0] + '\n' + corps(String(agir), 'export function supprimerLbcAgir('),
    porte: /supprimerLbcAgir\(r, \{ confirmer: askConfirm[\s\S]*agirOuPanneau\(\{ site: 'leboncoin', compte: compteLbcDe\(r\), geste: 'supprimer'[\s\S]*args: \{ id: String\(r\.id\)[\s\S]*confirmer: \(\) => \(typeof confirmer === 'function' \? confirmer\(\{ title: tr\('agir\.lbc\.supprimerTitre'/,
    repli: /panneau: \(\) => ouvrirPanneau\(\{ site: 'leboncoin'[^\n]*ids: \[String\(r\.id\)\], action: 'supprimer' \}\)/ });
}

// Un geste qui RESTE au panneau (changer un prix, modifier…) : le panneau est lui-même gardé par la porte
// (src/ouvrirPanneau.js : `agirMaintenant(site, compte, gesteDuPanneau(page, action), 'panneau')`, refusé ⇒ rien ne s'ouvre et
// la raison est dite). Le geste doit nommer SON compte et CET article ; la garde de `ouvrirPanneau` est lue (et retirée par
// `MUTATION_PORTE=1`).
function panneauGarde({ code, appel }) {
  let op = fs.readFileSync(path.join(SRC, 'ouvrirPanneau.js'), 'utf8');
  const GARDE = "  if (!v.ok) { try { window.dispatchEvent(new CustomEvent('vrm:agir-refus', { detail: v })); } catch (_) {} return null; }";
  if (MUTATION) op = op.replace(GARDE, '');
  const fautes = [];
  const i = op.indexOf('export function ouvrirPanneau(');
  const corps = i < 0 ? '' : op.slice(i, op.indexOf('\n}', i));
  if (!/const v = agirMaintenant\(o\.site \|\| 'vinted', o\.compte == null \|\| o\.compte === '' \? '\*' : o\.compte, gesteDuPanneau\(o\.page, o\.action\), 'panneau'\);/.test(corps) || !corps.includes(GARDE) || corps.indexOf(GARDE) > corps.indexOf('window.open(')) fautes.push('le panneau n’est plus gardé par la porte (src/ouvrirPanneau.js)');
  if (!appel.test(String(code || ''))) fautes.push('le geste n’ouvre pas le panneau au nom de SON compte sur CET article');
  return { ok: !fautes.length, detail: fautes.join(' · ') };
}

// « Répondre » dans un fil (Vinted, Leboncoin, Vestiaire) : le champ `ComposerReponse` (src/agir/Agir.jsx) — envoi DEPUIS VRM par la
// porte, sur CETTE conversation (`args.conv`), SON compte ; pas connecté ⇒ champ éteint, « lecture seule », la raison dite.
function repondre(ecran, agir, site) {
  const a = String(agir), i = a.indexOf('export function ComposerReponse('), j = i < 0 ? -1 : a.indexOf('\nexport ', i + 1);
  // (25 nov.) la balise jusqu'à `conv={…}` : ses autres props peuvent porter du JSX (`puces={…}`, messages-pro), où `>` apparaît.
  const balise = (String(ecran).match(new RegExp('<ComposerReponse site="' + site + '" compte=\\{[^}]+\\} conv=\\{[^}]+\\}')) || [''])[0];
  return regle({ code: balise + '\n' + (i < 0 ? '' : a.slice(i, j < 0 ? i + 3000 : j)),
    porte: /^<ComposerReponse site="\w+" compte=\{[^}]+\} conv=\{[^}]+\}[\s\S]*const v = usePeutAgir\(site, compte, 'repondre', 'file'\);[\s\S]*envoyerGeste\(\{ site, compte, geste: 'repondre', distGeste: 'repondre', args: \{ conv: String\(conv\), texte: t \} \}\)/,
    // (25 nov.) deux formes du « pas connecté » : le champ éteint (agir-tout) ou la barre « Lecture seule » qui dit la raison
    //    (messages-pro : `if (!v.ok) return (… texteRaison(v) …)`), le bouton d'envoi par la porte ensuite.
    repli: /(?:disabled=\{!v\.ok\}[\s\S]*placeholder=\{v\.ok \? [^\n]*?: tr\('agir\.badge'\)\}|if \(!v\.ok\) return \([\s\S]*?texteRaison\(v\)[\s\S]*?\n  \);)[\s\S]*<BoutonAgir site=\{site\} compte=\{compte\} geste="repondre"/ });
}

// « Publier sur Leboncoin » une fiche : DEPUIS VRM par la porte (le compte Leboncoin ouvert, une commande pour CETTE fiche) ;
// aucun compte ouvert ⇒ le panneau sur CETTE fiche (src/agir/Agir.jsx `publierLbcDepuisVrm`).
function publierLbc(ecran, agir, appel) {
  const a = String(agir), corps = (debut) => { const i = a.indexOf(debut); if (i < 0) return ''; const j = a.indexOf('\nexport ', i + 1); return a.slice(i, j < 0 ? i + 2000 : j); };
  const c = String(ecran);
  return regle({ code: (c.match(appel) || [''])[0] + '\n' + corps('export function publierLbcAgir(') + '\n' + corps('export function compteLbcOuvertAgir(') + '\n' + corps('export function publierLbcDepuisVrm('),
    porte: /publierLbcDepuisVrm\([^\n]*\{ panneau: \(\) => ouvrirPanneau\(\{ site: [^\n]*page: 'publier', ids: \[[^\]]+\], action: 'publier' \}\) \}\)[\s\S]*agirOuPanneau\(\{ site: 'leboncoin', compte, geste: 'publier', distGeste: 'publier', args: \{ id: String\(id\) \}[\s\S]*if \(agirMaintenant\w*\('leboncoin', id, 'publier', 'file'\)\.ok\) return id;[\s\S]*if \(!compte\) \{ if \(typeof panneau === 'function'\) panneau\(\);/,
    repli: /ouvrirPanneau\(\{ site: [^\n]*page: 'publier', ids: \[[^\]]+\], action: 'publier' \}\)/ });
}

module.exports = { faitsInventes, GARDES_PORTE: GARDES, publierLbc, repondre, panneauGarde, supprimerLbc, offreVinted, regle, porteTient, lue, sansPorte, APPELS_PORTE };
