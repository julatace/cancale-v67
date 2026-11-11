// audit-suivi-commandes.cjs — LE SUIVI DES COMMANDES EN COURS (11 nov. 2026, lot `suivi-commandes`)
//
// Julien (11 nov.) : « intègre les numéros de suivi sur les commandes en cours, comme ça tu regardes leur
// statut pour voir la cohérence ; est-ce que tu regardes les infos de suivi ? ».
// Ce qui est EXÉCUTÉ ici (données INVENTÉES, réponses de transporteurs SIMULÉES à la forme mesurée du
// code existant — aucune requête réelle) :
//   §1 chaque transporteur : la réponse simulée → l'analyseur du code (Chronopost/Shop2Shop, Vinted Go,
//      Mondial Relay/InPost `_mvc`) → la ligne rangée → le DERNIER statut affiché (« … · Vannes · hier 18:02 ») ;
//      Colissimo/La Poste, Relais Colis, DPD, UPS, GLS : jamais interrogés (aucune route mesurée), leur statut
//      vient de l'e-mail du même n° (source « e-mail »), un lien public ou une recherche dite comme telle ;
//   §2 les incohérences, chacune PROUVÉE et datée — et « pas su » ne l'est jamais (pas de lecture, lecture
//      de plus de 24 h, lecture faite avant le fait, limite estimée, état Vinted lu avant la livraison) ;
//   §3 le serveur : un colis vendu pris en charge reste lu (6 h) jusqu'à la fin, les « pas encore partis »
//      d'abord, Vestiaire « envoyée » comprise, Mondial Relay sortant jamais (code postal de l'acheteur) ;
//   §4 l'identité : 50 ventes au même titre, un seul n° lu ⇒ une seule commande dit ce statut ;
//   §5 l'app : la carte (Envoyés, À envoyer, Achats en route), Ma journée « N à vérifier », mêmes règles.
// Usage : node scripts/audit-suivi-commandes.cjs  (RACINE=<arbre> : l'arbre d'avant)
//         node scripts/audit-suivi-commandes.cjs --prouve   (chaque mutation doit faire tomber un contrôle)
require('./_source-app.cjs').brancher();
const path = require('path'), fs = require('fs'), os = require('os');
const { spawnSync } = require('child_process');
const RACINE = process.env.RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'pas-su-decide': ['api/_lib/suivi-commandes.js', '  if (lu == null || maintenant - lu > LECTURE_FRAICHE_MS || lu > maintenant + 600000) return false;', '  if (lu == null) return false;'],
  'avant-le-fait': ['api/_lib/suivi-commandes.js', '  return apres == null || lu >= apres;', '  return true;'],
  'limite-estimee': ['api/_lib/suivi-commandes.js', '  const jl = limiteSure ? joursAvantLimite(msDe(limiteMs), maintenant) : null;', '  const jl = joursAvantLimite(msDe(limiteMs), maintenant);'],
  'vinted-lu-avant': ['api/_lib/suivi-commandes.js', '&& msDe(vinted.luAt) >= etAt + SEUIL_FINALISE_MS', ''],
  'suivi-arrete-a-la-prise': ['api/_lib/depart-colis.js', '  return e + (pris ? RYTHME_SUIVI_MS : RYTHME_DEPART_MS);', '  return pris ? Infinity : e + RYTHME_DEPART_MS;'],
  'partis-d-abord': ['api/_lib/depart-colis.js', 'items.sort((a, b) => (a.pris - b.pris) ||', 'items.sort((a, b) => (b.pris - a.pris) ||'],
  'source-plus-fraiche': ['api/_lib/suivi-commandes.js', '  cands.sort((a, b) => ((b.at ?? -Infinity) - (a.at ?? -Infinity)) || (b.rang - a.rang));', '  cands.sort((a, b) => (a.rang - b.rang));'],
};
if (process.argv.includes('--prouve')) {
  let n = 0, ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    n++;
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-suivi-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(RACINE, x), path.join(t, x), { recursive: true });
    try { fs.symlinkSync(fs.realpathSync(path.join(RACINE, 'node_modules')), path.join(t, 'node_modules')); } catch (_) {}
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (src.split(de).length !== 2) { console.log(`❌ mutation ${nom} : ancre introuvable ou pas unique dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, RACINE: t }, encoding: 'utf8', timeout: 120000 });
    const rouges = (String(r.stdout || '').match(/^\s*✗/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ok = 0, ko = 0;
const dit = (c, m, d = '') => { if (c) { ok++; console.log('  ✓ ' + m); } else { ko++; console.log('  ✗ ' + m + (d ? '\n      ' + d : '')); } };
const H = 3600000, J = 24 * H;
// Midi à Paris, un mardi : « hier » et « aujourd'hui » sans ambiguïté.
const NOW = Date.parse('2026-11-10T11:00:00Z');
const iso = (ms) => new Date(ms).toISOString();

// ── LES RÉPONSES SIMULÉES, À LA FORME DU CODE EXISTANT ──────────────────────
const cpEv = (code, ms, libelle, office = 'VANNES - FR - TABAC TEST', infos = '') => ({ code, ms, libelle, office, infos });
const cpXml = (sky, evs) => `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><ns1:trackSkybillV2Response xmlns:ns1="http://cxf.tracking.soap.chronopost.fr/"><return><errorCode>0</errorCode><listEventInfoComp>${evs.map((e) => `<events><code>${e.code}</code><eventDate>${iso(e.ms)}</eventDate><eventLabel>${e.libelle}</eventLabel><officeLabel>${e.office}</officeLabel><zipCode>56000</zipCode>${e.infos}</events>`).join('')}<skybillNumber>${sky}</skybillNumber></listEventInfoComp></return></ns1:trackSkybillV2Response></soap:Body></soap:Envelope>`;
const vgJson = (evs) => JSON.stringify({ tracking_events: evs.map((e, i) => ({ id: 'e' + i, message: e.message || e.group, timestamp: iso(e.ms), metadata: { address: e.address || '' }, group: e.group, state: 'delivery' })), meta: {} });
// Mondial Relay `_mvc` : {Success, Message} où Message est un fragment HTML (forme d'audit-mondialrelay-serveur).
const ent = (s) => s.replace(/é/g, '&#233;').replace(/è/g, '&#232;').replace(/à/g, '&#224;').replace(/'/g, '&#39;');
const ETAPES = ["Colis en préparation chez l'expéditeur", 'Colis remis à Mondial Relay', "Colis sur l'agence de livraison", 'Colis disponible au point de retrait', 'Colis livré au destinataire'];
function mrFragment({ n, cp, k, jours }) {
  const ul = `<ul class="timeline suivi center-element"> ${ETAPES.map((e, i) => `<li${i < k ? ' class="validate"' : ''}> <p>${ent(e)}</p> </li>`).join(' ')} </ul>`;
  const blocs = jours.map(([date, evs]) => `<div class="infos-account"> <div class="bloc mb-0 infos-colis suivre pt10"> <div class="col-xs-4 col-sm-2 col-md-2 col-lg-2 f-left"> <p>${date}</p> </div> <div class="col-xs-7 col-sm-7 col-md-7 col-lg-7 f-left"> <h5>${ent(evs[0][1])}</h5> </div> </div> <div class="bloc bg-white detail-infos"> ${evs.map(([h, l]) => `<div class="step-suivi"> <div class="col-xs-4 col-sm-3 col-md-3 "> <p class="center">${h}</p> </div> <div class="col-xs-8 col-sm-9 col-md-9"> <p>${ent(l)}</p> </div> </div>`).join(' ')} </div> </div>`).join(' ');
  const scripts = `<script type="text/javascript"> var numeroExpedition = '${n}'; </script> <script> dataLayer.push({ 'event': 'Suivi de Colis', 'CodePostal' : '${cp}', 'Pays' : 'FR' }); </script>`;
  return JSON.stringify({ Success: true, ModelState: [], Message: `<div class="grid"> <div class="row"> ${ul} </div> <div class="row"> ${blocs} </div> </div> ${scripts}`, Action: 'ReplaceDiv', Data: false });
}

(async () => {
  let S = null, D = null, T = null;
  try { S = await import('file://' + path.join(RACINE, 'api/_lib/suivi-commandes.js')); } catch (e) { dit(false, 'api/_lib/suivi-commandes.js existe (la règle du suivi des commandes)', String(e.message).slice(0, 160)); }
  D = await import('file://' + path.join(RACINE, 'api/_lib/depart-colis.js'));
  T = await import('file://' + path.join(RACINE, 'api/_lib/transporteurs.js'));
  const SC = await import('file://' + path.join(RACINE, 'api/_lib/suivi-colis.js'));
  const fn = (o, k) => (o && typeof o[k] === 'function' ? o[k] : () => { throw new Error(k + ' absente'); });
  const essaie = (titre, f) => { console.log(titre); try { f(); } catch (e) { dit(false, titre + ' s’exécute', String(e && e.message).slice(0, 200)); } };
  const statut = (o) => fn(S, 'dernierStatut')({ maintenant: NOW, ...o });
  const vente = (o) => fn(S, 'incoherencesVente')({ maintenant: NOW, ...o });
  const achat = (o) => fn(S, 'incoherencesAchat')({ maintenant: NOW, ...o });
  const codes = (l) => (Array.isArray(l) ? l.map((x) => x.code).sort().join(',') : '?');
  const depApres = (avant, lu, carrier, suivi, at = NOW - H) => {
    const reel = Date.now; Date.now = () => at;
    try { return D.ligneDepartApresEssai(avant, lu, { carrier, suivi, maintenant: at }); } finally { Date.now = reel; }
  };

  essaie('§1 chaque transporteur : réponse simulée → statut affiché', () => {
    // Chronopost (et Shop2Shop, qui EST Chronopost) : pris en charge hier soir, en transit à Vannes.
    const N = 'XW000000101TS';
    const lu = T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DC', NOW - 40 * H, 'Envoi en cours de préparation'), cpEv('DB', NOW - 17 * H, 'Pris en charge en agence'), cpEv('TT', NOW - 15 * H, 'Envoi en cours d’acheminement')]), { suivi: N });
    const l = depApres(null, lu, 'chronopost', N);
    const s = statut({ transporteur: l, sens: 'sortant' });
    dit(s && s.source === 'transporteur' && /^En transit · Vannes · hier \d\d:\d\d$/.test(s.texte) && /^lu chez Chronopost il y a 1 h$/.test(s.sourceTexte), 'Chronopost : « En transit · Vannes · hier 20:00 — lu chez Chronopost il y a 1 h »', JSON.stringify(s));
    const l1 = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DC', NOW - 40 * H, 'Prépa'), cpEv('DB', NOW - 17 * H, 'Pris en charge', 'LYON - FR - AGENCE')]), { suivi: N }), 'chronopost', N);
    dit(statut({ transporteur: l1 }).texte.startsWith('Pris en charge · Lyon · hier'), 'Chronopost, dernier évènement = la prise en charge ⇒ « Pris en charge · Lyon · hier … »', statut({ transporteur: l1 }).texte);
    dit(D.carrierDepart('Shop2Shop', N) === 'chronopost' && D.carrierDepart('Pickup', N) === 'chronopost', 'Shop2Shop / Pickup ⇒ lu chez Chronopost');
    const l2 = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DB', NOW - 40 * H, 'Pris en charge'), cpEv('AB', NOW - 3 * H, 'Colis disponible au point de retrait', 'RENNES - FR', '<infoCompList><name>Point de livraison</name><value>TABAC DU MARCHE - 1 RUE X - 35000 - RENNES</value></infoCompList>')]), { suivi: N }), 'chronopost', N);
    const s2 = statut({ transporteur: l2, sens: 'sortant' });
    dit(s2 && /^Livré au relais de l’acheteur · /.test(s2.texte) && /aujourd’hui/.test(s2.texte), 'colis VENDU au relais : « Livré au relais de l’acheteur · … · aujourd’hui … » (jamais « à retirer »)', JSON.stringify(s2 && s2.texte));
    // Vinted Go
    const VG = 'VGS1000000000101';
    const lv = depApres(null, T.lireReponseVintedGo(200, 'application/json', vgJson([{ group: 'in_transit', message: 'Colis en transit', ms: NOW - 5 * H, address: 'Plateforme, 69007 LYON, FR' }, { group: 'shipped', ms: NOW - 30 * H }, { group: 'created', ms: NOW - 40 * H }]), { suivi: VG }), 'vinted', VG);
    const sv = statut({ transporteur: lv });
    dit(sv && /^En transit · Lyon · aujourd’hui/.test(sv.texte) && /Vinted Go/.test(sv.sourceTexte), 'Vinted Go : « En transit · Lyon · aujourd’hui … — lu chez Vinted Go … » (la ville après le code postal)', JSON.stringify(sv));
    // Mondial Relay (et InPost, qui EST Mondial Relay) — un ACHAT : la route `_mvc` avec SON code postal.
    const MR = '30000101', CP = '35000';
    const lm = T.lireReponseMondialRelayMvc(200, 'application/json', mrFragment({ n: MR, cp: CP, k: 2, jours: [['09/11/2026', [['18:02', 'Colis remis à Mondial Relay']]]] }), { suivi: MR, cp: CP });
    dit(lm.res === 'ok' && lm.etat === 'en_route', 'Mondial Relay `_mvc` simulé ⇒ en route', `${lm.res}/${lm.etat}`);
    const tm = T.ligneApresEssai(null, lm, { carrier: 'mondialrelay', suivi: MR, voie: 'mr-fr-mvc', maintenant: NOW - 2 * H, cp: CP });
    const sm = statut({ transporteur: tm, sens: 'entrant' });
    dit(sm && /^En transit · hier 18:02$/.test(sm.texte) && /Mondial Relay/.test(sm.sourceTexte), 'Mondial Relay (achat) : « En transit · hier 18:02 — lu chez Mondial Relay »', JSON.stringify(sm));
    dit(D.carrierDepart('Mondial Relay', MR) === null && D.carrierDepart('InPost', MR) === null, 'Mondial Relay / InPost VENDU : jamais lu comme départ (code postal de l’acheteur, jamais deviné)');
    const lien = fn(S, 'lienPublic')(SC.lienSuivi, 'InPost', MR);
    dit(lien && /mondialrelay\.fr/.test(lien.url) && lien.site, 'InPost ⇒ la page publique Mondial Relay', lien && lien.url);
    // Les transporteurs que VRM ne lit pas : jamais interrogés, statut par l'e-mail du MÊME n°.
    const autres = [['Colissimo', '6A12345678901', 'site'], ['La Poste', '6A12345678902', 'site'], ['UPS', '1Z999AA10123456784', 'site'], ['DPD', '25000000000001', 'recherche'], ['GLS', '50000000001', 'recherche'], ['Relais Colis', 'RC000000000001', 'recherche']];
    const sortants = autres.map(([t, n], i) => ({ cle: 'vc:' + i, suivi: n, transporteur: t, venteMs: NOW - 2 * J }));
    dit(D.departsAInterroger({ sortants, maintenant: NOW, max: 50, parTransporteur: 50 }).length === 0, 'Colissimo, La Poste, UPS, DPD, GLS, Relais Colis : AUCUNE requête (pas de route publique mesurée, aucune clé payante)');
    const liens = autres.map(([t, n, attendu]) => { const x = fn(S, 'lienPublic')(SC.lienSuivi, t, n); return x && (x.site ? 'site' : 'recherche') === attendu; });
    dit(liens.every(Boolean), 'leur lien : La Poste et UPS ⇒ leur page publique ; DPD, GLS, Relais Colis ⇒ une RECHERCHE dite comme telle', JSON.stringify(liens));
    const se = statut({ email: { status: 'transit', receivedAt: iso(NOW - 26 * H) } });
    dit(se && se.source === 'email' && /^En transit · hier/.test(se.texte) && /^e-mail du hier/.test(se.sourceTexte), 'statut par l’e-mail du même n° : « En transit · hier … — e-mail du hier … »', JSON.stringify(se));
    dit(statut({}) === null && statut({ transporteur: { carrier: 'chronopost', essaiRes: 'passu', essai: iso(NOW) } }) === null, 'rien de lu (ou une lecture ratée) ⇒ aucun statut (jamais « en transit » deviné)');
    // La source la plus FRAÎCHE l'emporte ; à égalité, le transporteur.
    const plusFrais = statut({ transporteur: l1, email: { status: 'available', receivedAt: iso(NOW - H) } });
    dit(plusFrais && plusFrais.source === 'email', 'l’e-mail plus récent que la lecture du transporteur ⇒ c’est lui qui parle', JSON.stringify(plusFrais && plusFrais.source));
    const vint = statut({ transporteur: l, vinted: { texte: 'Colis livré', at: NOW - 30 * H, cap: NOW - 20 * H } });
    dit(vint && vint.source === 'transporteur', 'Vinted plus ancien que le transporteur ⇒ le transporteur parle', JSON.stringify(vint && vint.source));
    const vLu = statut({ transporteur: l, vinted: { texte: 'Colis en route', cap: NOW - 10 * 60000 } });
    dit(vLu && vLu.source === 'transporteur', 'Vinted lu il y a 10 min, sans date d’évènement ⇒ ne passe pas devant le transporteur', JSON.stringify(vLu && vLu.source));
    const vSeul = statut({ vinted: { texte: 'Colis en route', cap: NOW - H } });
    dit(vSeul && vSeul.texte === '« Colis en route »' && vSeul.sourceTexte === 'lu sur Vinted il y a 1 h', 'Vinted seul, sans date d’évènement : le texte, jamais une heure inventée — « lu sur Vinted il y a 1 h »', JSON.stringify(vSeul));
  });

  essaie('§2 les incohérences : prouvées et datées, « pas su » jamais', () => {
    const N = 'XW000000201TS';
    const pasPris = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DC', NOW - 5 * J, 'Envoi en cours de préparation')]), { suivi: N }), 'chronopost', N, NOW - 2 * H);
    const env = { at: NOW - 4 * J, source: 'colis-fait' };
    const r1 = vente({ depart: pasPris, envoye: env });
    dit(codes(r1) === 'pas-pris' && /il y a 4 j\. Chronopost ne l’a pas pris en charge\./.test(r1[0].texte) && r1[0].geste, '« Noté déposé il y a 4 j. Chronopost ne l’a pas pris en charge. » + un geste', JSON.stringify(r1));
    dit(vente({ depart: pasPris, envoye: { at: NOW - 2 * J, source: 'colis-fait' } }).length === 0, 'envoyé il y a 2 j seulement ⇒ rien (le seuil est 3 j)');
    dit(vente({ depart: null, envoye: env }).length === 0, 'aucune lecture du transporteur ⇒ rien (pas su)');
    const vieux = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DC', NOW - 5 * J, 'Prépa')]), { suivi: N }), 'chronopost', N, NOW - 30 * H);
    dit(vente({ depart: vieux, envoye: { at: NOW - 6 * J, source: 'colis-fait' } }).length === 0, 'lecture de plus de 24 h (pourtant faite après le délai) ⇒ rien : elle ne prouve plus « pas encore »');
    const avantFait = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DC', NOW - 5 * J, 'Prépa')]), { suivi: N }), 'chronopost', N, NOW - 2 * H);
    dit(vente({ depart: avantFait, envoye: { at: NOW - 3 * J - H, source: 'colis-fait' } }).length === 0, 'lecture faite moins de 3 j après « envoyé » ⇒ rien (elle ne couvre pas le délai)');
    // Livré, Vinted pas finalisé.
    const livre = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml(N, [cpEv('DB', NOW - 8 * J, 'Pris en charge'), cpEv('D', NOW - 5 * J, 'Livré', 'RENNES - FR', '<infoCompList><name>Type de retrait</name><value>Destinataire</value></infoCompList>')]), { suivi: N }), 'chronopost', N, NOW - 2 * H);
    const r2 = vente({ depart: livre, vinted: { finalisee: false, retour: false, luAt: NOW - H } });
    dit(codes(r2) === 'livre-pas-finalise' && /^Livré le \d+ nov\. selon Chronopost\. Vinted n’a pas finalisé\.$/.test(r2[0].texte), '« Livré le 5 nov. selon Chronopost. Vinted n’a pas finalisé. »', JSON.stringify(r2));
    dit(vente({ depart: livre, vinted: { finalisee: false, luAt: NOW - 5 * J - H } }).length === 0, 'Vinted lu AVANT la livraison ⇒ rien (une lecture d’avant ne contredit rien)');
    dit(vente({ depart: livre, vinted: null }).length === 0 && vente({ depart: livre, vinted: { finalisee: null, luAt: NOW } }).length === 0, 'état Vinted pas su (ou bloqué/annulé) ⇒ rien');
    dit(vente({ depart: livre, vinted: { finalisee: true, luAt: NOW } }).length === 0, 'finalisée ⇒ rien');
    // Bordereau imprimé, pas déposé, limite LUE demain.
    const demain = NOW + 22 * H;   // le lendemain, à Paris
    const r3 = vente({ depart: pasPris, imprime: { at: NOW - 6 * H }, limiteMs: demain, limiteSure: true });
    dit(codes(r3) === 'imprime-pas-depose' && /Limite demain\./.test(r3[0].texte), '« Bordereau imprimé, pas encore déposé. Limite demain. »', JSON.stringify(r3));
    dit(vente({ depart: pasPris, imprime: { at: NOW - 6 * H }, limiteMs: demain, limiteSure: false }).length === 0, 'limite seulement ESTIMÉE (vente + 7 j) ⇒ rien');
    dit(vente({ depart: pasPris, imprime: { at: NOW - 6 * H }, limiteMs: NOW + 5 * J, limiteSure: true }).length === 0, 'limite dans 5 jours ⇒ rien');
    dit(vente({ depart: pasPris, imprime: { at: NOW - H }, limiteMs: demain, limiteSure: true }).length === 0, 'lecture du transporteur faite AVANT l’impression ⇒ rien');
    // Retour, incident.
    const ret = { carrier: 'vinted', etat: 'retour_expediteur', lu: iso(NOW - H), etatAt: iso(NOW - 5 * H), essaiRes: 'ok' };
    dit(codes(vente({ depart: ret })) === 'retour' && codes(vente({ depart: ret, vinted: { retour: true, luAt: NOW } })) === '', 'colis en retour ⇒ dit, sauf si Vinted le dit déjà');
    dit(codes(vente({ depart: { carrier: 'chronopost', etat: 'incident', detail: 'quitte_relais', lu: iso(NOW - H) } })) === '', '« a quitté le relais » (celui de l’ACHETEUR) n’est pas une incohérence du vendeur');
    // Achats.
    const A = 'XW000000301TS';
    const lab = T.ligneApresEssai(null, T.lireReponseChronopost(200, 'text/xml', cpXml(A, [cpEv('DC', NOW - 4 * J, 'Envoi en cours de préparation')]), { suivi: A }), { carrier: 'chronopost', suivi: A, maintenant: NOW - 3 * H });
    const a1 = achat({ transp: lab });
    dit(codes(a1) === 'pas-depose-vendeur' && /^Étiquette créée il y a 4 j\. Pas encore chez Chronopost\.$/.test(a1[0].texte) && /vendeur/.test(a1[0].geste), 'achat : « Étiquette créée il y a 4 j. Pas encore chez Chronopost. » + « Écris au vendeur »', JSON.stringify(a1));
    const labVieux = T.ligneApresEssai(null, T.lireReponseChronopost(200, 'text/xml', cpXml(A, [cpEv('DC', NOW - 4 * J, 'Prépa')]), { suivi: A }), { carrier: 'chronopost', suivi: A, maintenant: NOW - 2 * J });
    dit(achat({ transp: labVieux }).length === 0 && achat({ transp: null }).length === 0, 'achat : lecture ancienne ou absente ⇒ rien');
    const dispo = T.ligneApresEssai(null, T.lireReponseChronopost(200, 'text/xml', cpXml(A, [cpEv('AB', NOW - 3 * H, 'Colis disponible au point de retrait')]), { suivi: A }), { carrier: 'chronopost', suivi: A, maintenant: NOW - H });
    dit(achat({ transp: dispo }).length === 0, 'achat au relais : rien ici (c’est « À retirer »)');
    dit(fn(S, 'nbAVerifier')([{ incoherences: r1 }, { incoherences: [] }, { incoherences: a1 }]) === 2 && fn(S, 'nbAVerifier')(null) === null, 'le compteur compte les COMMANDES, et « pas su » reste « pas su »');
    // Les phrases : ≤ 12 mots chacune.
    const phrases = [...r1, ...r2, ...r3, ...vente({ depart: ret }), ...a1, ...achat({ transp: { ...ret, carrier: 'chronopost' } }), ...achat({ transp: { carrier: 'vinted', etat: 'incident', lu: iso(NOW) } })].flatMap((x) => [x.texte, x.geste]).flatMap((t) => t.split(/(?<=\.)\s+/));
    const longues = phrases.filter((p) => p.split(/\s+/).filter(Boolean).length > 12);
    dit(longues.length === 0, 'chaque phrase tient en 12 mots au plus', longues.join(' | '));
    dit(fn(S, 'estEnCours')({ transporteur: livre }) === false && fn(S, 'estEnCours')({ transporteur: pasPris }) === true && fn(S, 'estEnCours')({ transporteur: pasPris, finalisee: true }) === false, 'livré ou finalisé ⇒ sort des « en cours »');
  });

  essaie('§3 le serveur : suivi jusqu’à la fin, borné', () => {
    const lap = (avant, lu, at) => depApres(avant, lu, 'chronopost', 'XW000000401TS', at);
    const l1 = lap(null, T.lireReponseChronopost(200, 'text/xml', cpXml('XW000000401TS', [cpEv('DB', NOW - 20 * H, 'Pris en charge')]), { suivi: 'XW000000401TS' }), NOW - H);
    dit(D.prochainEssaiDepart(l1) === NOW - H + 6 * H, 'pris en charge ⇒ relu dans 6 h', String((D.prochainEssaiDepart(l1) - (NOW - H)) / H) + ' h');
    const ancien = { suivi: 'XW000000402TS', carrier: 'chronopost', priseAt: iso(NOW - 48 * H), essai: iso(NOW - 7 * H), essaiRes: 'ok', fini: true, etat: 'en_route' };
    dit(D.prochainEssaiDepart(ancien) <= NOW, 'une ligne du 8 nov. (`fini` posé à la prise en charge) est reprise par le suivi', String(D.prochainEssaiDepart(ancien)));
    const mort = { suivi: 'XW000000403TS', carrier: 'chronopost', essai: iso(NOW - 7 * H), essaiRes: 'expire', fini: true };
    dit(D.prochainEssaiDepart(mort) === Infinity, 'n° expiré ⇒ jamais relu');
    const sortants = [
      { cle: 'vc:a', suivi: 'XW000000402TS', transporteur: 'Chronopost', venteMs: NOW - 4 * J },
      { cle: 'vc:b', suivi: 'XW000000404TS', transporteur: 'Chronopost', venteMs: NOW - J },
    ];
    const it = D.departsAInterroger({ sortants, departs: new Map([['XW000000402TS', ancien]]), maintenant: NOW, max: 1, parTransporteur: 1 });
    dit(it.length === 1 && it[0].suivi === 'XW000000404TS', 'une place : le colis PAS ENCORE parti passe avant le suivi d’un parti', JSON.stringify(it));
    const vc = D.sortantsDuVendeur({ vcVentes: { e: { suivi: 'XW000000405TS', etat: 'shipped', aExpedier: false }, l: { suivi: 'XW000000406TS', etat: 'delivered', aExpedier: false }, x: { suivi: 'XW000000407TS', etat: 'cancelled', aExpedier: false } } });
    dit(vc.length === 1 && vc[0].suivi === 'XW000000405TS', 'Vestiaire : « envoyée » est suivie ; livrée ou annulée, non', JSON.stringify(vc));
  });

  essaie('§4 l’identité : 50 ventes au même titre, un seul n° lu', () => {
    const lignes = Array.from({ length: 50 }, (_, i) => ({ cle: 'v' + i, titre: 'Nike Dunk Low Panda 42', suivi: `XW${String(500000000 + i)}TS` }));
    const lu = depApres(null, T.lireReponseChronopost(200, 'text/xml', cpXml('XW500000017TS', [cpEv('DB', NOW - 20 * H, 'Pris en charge')]), { suivi: 'XW500000017TS' }), 'chronopost', 'XW500000017TS');
    const departs = new Map([[lu.suivi, lu]]);
    const avecStatut = lignes.filter((x) => statut({ transporteur: departs.get(x.suivi) || null }));
    dit(avecStatut.length === 1 && avecStatut[0].cle === 'v17', 'une seule commande dit ce statut : celle de CE n°', avecStatut.map((x) => x.cle).join(','));
  });

  console.log('§5 l’app : les cartes et Ma journée lisent la MÊME règle');
  const lit = (f) => { try { return fs.readFileSync(path.join(RACINE, f), 'utf8'); } catch (_) { return ''; } };
  const app = lit('src/App.jsx'), comp = lit('src/SuiviCommande.jsx');
  dit(/from '\.\.\/api\/_lib\/suivi-commandes\.js'/.test(app) && /import SuiviCommande from '\.\/SuiviCommande\.jsx'/.test(app), 'App importe la règle et la carte');
  const fv = (app.match(/const suiviVente = \(x\) => \{[\s\S]*?\n  \};/) || [''])[0];
  dit(/x\.b && x\.b\.suivi/.test(fv) && /x\.v && x\.v\.suivi/.test(fv) && !/titre|title|marque|brand|taille/.test(fv), 'le n° d’une vente vient de SON bordereau ou de SA vente Vestiaire — jamais du titre', fv.slice(0, 120));
  dit(/const sv = suiviVente\(x\);[\s\S]{0,200}<SuiviCommande /.test(app), 'Ventes · Envoyés : la carte de suivi sur chaque colis en cours');
  dit(/code === 'imprime-pas-depose'[\s\S]{0,200}<SuiviCommande /.test(app), 'Ventes · À envoyer : seulement « imprimé, pas déposé »');
  dit(/suiviAchat\(o, su,[\s\S]{0,1200}<SuiviCommande [^>]*sansStatut/.test(app), 'Achats en route : n°, lien, incohérence (le statut reste dit une fois par `LigneTransporteur`)');
  dit(/const aVerifier = commandesAVerifier\(\);/.test(app) && /data-journee-suivi-verifier=/.test(app) && /\(aVerifier\.n \? 1 : 0\)/.test(app), 'Ma journée : « N commandes à vérifier », compté dans les gestes');
  dit(/const commandesAVerifier = \(\) => \{[\s\S]{0,300}suiviVente\(x\)[\s\S]{0,700}suiviAchat\(o, su/.test(app), 'Ma journée compte avec les MÊMES fonctions que les cartes');
  dit(/cap:meta->>capturedAt'/.test(app) && /cap: r\.cap \|\| null/.test(app), 'l’état Vinted porte l’heure de SA lecture (une incohérence se fonde sur une lecture datée)');
  dit(/data-suivi-copier=/.test(comp) && /navigator\.clipboard\.writeText\(suivi\)/.test(comp) && /data-suivi-lien=/.test(comp), 'la carte : n° copiable d’un tap, lien public');
  dit(/x\.prisEnCharge \|\| x\.change/.test(app), 'l’app relit les départs quand un colis suivi bouge');
  console.log(ko ? `\n❌ ${ko} contrôle(s) rouge(s), ${ok} vert(s).` : `\n✅ suivi des commandes : ${ok} contrôles verts.`);
  process.exit(ko ? 1 : 0);
})();
