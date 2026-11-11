#!/usr/bin/env node
// AUDIT (10 nov.) — « VOTRE COLIS A CHANGÉ DE PLAN » : UN CHANGEMENT DE POINT RELAIS N'EST NI
// UNE ARRIVÉE NI UNE LIVRAISON.
// Julien (capture iPhone du 10 nov.) : l'e-mail Mondial Relay « Votre colis a changé de plan »
// (le point prévu est indisponible, le colis part vers un nouveau point) était montré livré /
// à retirer — « Regarde le colis a pas été livré c'est pas bon ».
//
// Il EXÉCUTE les vraies fonctions, jamais une copie :
//   A. `etatColisDepuisTexte` / `changementDeRelais` (api/_lib/etat-colis-email.js) : le SUJET
//      d'abord (§5), une phrase du corps qui le CONSTATE ensuite, jamais une condition ;
//   B. `parseCarrierEmail` (api/email-inbound.js) : en route, « Point relais changé », le NOUVEAU
//      point lu (jamais l'ancien) ;
//   C. `relireLigneSuivi` (api/_lib/suivi-colis.js) : une ligne rangée AVANT (livré / à retirer)
//      est relue en route — l'app, le widget et le rappel du matin la relisent ;
//   D. `colisRelaisChange` / `lienItineraire` (src/relaisChange.js) : l'alerte ambre et son
//      itinéraire ; un autre e-mail du même n° qui dit le colis arrivé l'emporte ;
//   E. le branchement dans l'app (l'alerte rendue sur À retirer et En route).
// `--prouve` : réaffaiblit chaque correction, chacune doit rendre ROUGE.
// §6.1 : lancé sur l'arbre d'avant (AUDIT_RACINE=<arbre>), il est rouge.
// Données INVENTÉES (le dépôt est public) : aucun n°, code ni adresse réels.
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');

const MUTATIONS = {
  'sujet-ignore': ['api/_lib/etat-colis-email.js', " if(SUJET_CHANGEMENT_RELAIS.test(s)){const l=lire(sujet);", " if(false){const l=lire(sujet);"],
  'corps-ignore': ['api/_lib/etat-colis-email.js', " if(phrases(corps).some((p)=>!CONDITION.test(p)&&CORPS_CHANGEMENT_RELAIS.some((r)=>r.test(p))))return 'transit';", ''],
  'condition-oubliee': ['api/_lib/etat-colis-email.js', "return phrases(corps).some((p)=>!CONDITION.test(p)&&CORPS_CHANGEMENT_RELAIS", "return phrases(corps).some((p)=>CORPS_CHANGEMENT_RELAIS"],
  'ancien-point-garde': ['api/email-inbound.js', "lieu = nouveauPointDansTexte(txt);", "lieu = lieu;"],
  'pas-de-drapeau': ['api/email-inbound.js', "const relaisChange = status === 'transit' && changementDeRelais(mail.subject, txt);", "const relaisChange = false;"],
  'relecture-oubliee': ['api/_lib/suivi-colis.js', "if (etat === 'transit' && changementDeRelais(d.subject || d.sujet || '') && d.status !== 'transit')", "if (false)"],
  'arrivee-ignoree': ['src/relaisChange.js', "if (!n || finis.has(n) || vus.has(n)) continue;", "if (!n || vus.has(n)) continue;"],
  'alerte-pas-rendue': ['src/App.jsx', "<AlerteRelaisChange lignes={tracking} C={C} transp={transpMap}/>", "null"],
};
if (process.argv.includes('--prouve')) {
  let ok = 0;
  for (const [nom, [f, de, vers]] of Object.entries(MUTATIONS)) {
    const t = fs.mkdtempSync(path.join(os.tmpdir(), 'mut-relais-'));
    for (const x of ['api', 'src', 'package.json']) fs.cpSync(path.join(R, x), path.join(t, x), { recursive: true });
    fs.symlinkSync(fs.realpathSync(path.join(R, 'node_modules')), path.join(t, 'node_modules'));
    const src = fs.readFileSync(path.join(t, f), 'utf8');
    if (!src.includes(de)) { console.log(`❌ mutation ${nom} : ancre introuvable dans ${f}`); fs.rmSync(t, { recursive: true, force: true }); continue; }
    fs.writeFileSync(path.join(t, f), src.replace(de, vers));
    const r = spawnSync(process.execPath, [__filename], { env: { ...process.env, AUDIT_RACINE: t }, encoding: 'utf8' });
    const rouges = (r.stdout.match(/^❌/gm) || []).length;
    const tombe = r.status !== 0 && rouges > 0;
    if (tombe) ok++;
    console.log(`${tombe ? '✅' : '❌'} mutation « ${nom} » ⇒ ${tombe ? rouges + ' rouge(s)' : 'VERTE (le contrôle ne la voit pas)'}`);
    fs.rmSync(t, { recursive: true, force: true });
  }
  const n = Object.keys(MUTATIONS).length;
  console.log(ok === n ? `\n✅ ${ok}/${n} mutations attrapées` : `\n❌ ${n - ok} mutation(s) non attrapée(s)`);
  process.exit(ok === n ? 0 : 1);
}

let ko = 0, ok = 0;
const dit = (c, m, d) => { if (c) ok++; else ko++; console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
const essaie = async (m, f) => { try { await f(); } catch (e) { dit(false, m + ' — le contrôle a pu s’exécuter', String(e && e.message || e).slice(0, 200)); } };
const importer = (p) => import('file://' + path.join(R, p));
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'banc-cle-service';

// L'e-mail INVENTÉ, à la forme de celui de Mondial Relay (n°, enseignes, adresses fictives).
const SUJET = 'Votre colis a changé de plan';
const CORPS = [
  'Bonjour,', '',
  'Votre colis a changé de plan !',
  'Le Point Relais® que vous aviez choisi est temporairement indisponible.', '',
  'Point Relais® initialement prévu :', 'TABAC DE L’ESSAI', '9 RUE FICTIVE', '35260 VILLE-TEST', '',
  'Pas d’inquiétude : votre colis n° 87654321 sera livré dans le Point Relais® suivant :', '',
  'Votre nouveau Point Relais®', 'INTERMARCHE EXEMPLE', '4 AVENUE DE L’ESSAI', '35350 ST MELOIR DES ONDES', '',
  'Vous recevrez un e-mail dès qu’il sera disponible.',
].join('\n');

(async () => {
  console.log('§A la règle des états (sujet d’abord, phrases ensuite)');
  await essaie('A', async () => {
    const m = await importer('api/_lib/etat-colis-email.js');
    dit(m.etatColisDepuisTexte(SUJET, CORPS) === 'transit', '« Votre colis a changé de plan » ⇒ en route (jamais arrivé ni livré)', m.etatColisDepuisTexte(SUJET, CORPS));
    dit(m.etatColisDepuisTexte('Information sur votre colis', CORPS) === 'transit', 'sujet neutre, corps qui CONSTATE le changement de point ⇒ en route', m.etatColisDepuisTexte('Information sur votre colis', CORPS));
    dit(m.etatColisDepuisTexte('Information sur votre colis', 'Votre colis a été redirigé vers un autre Point Relais. Il est livré dans le Point Relais suivant : TABAC EXEMPLE.') === 'transit', '« a été redirigé … est livré dans le point suivant » ⇒ en route, pas livré');
    dit(typeof m.changementDeRelais === 'function' && m.changementDeRelais(SUJET, CORPS) === true, 'changementDeRelais lit le sujet');
    dit(m.changementDeRelais('Où vous livrer en cas de point indisponible ?', 'En cas de Point Relais indisponible, nous livrerons votre colis dans un point proche.') === false, '« en cas de point indisponible » (une condition) n’est PAS un changement');
    dit(m.changementDeRelais('Confirmation de votre envoi', 'Si votre Point Relais est fermé, nous livrerons votre colis dans un point proche.') === false, '« si votre Point Relais est fermé » (une condition) n’est PAS un changement');
    dit(m.etatColisDepuisTexte('Votre colis 87654321 est disponible', 'Il vous attend dans votre nouveau Point Relais : INTERMARCHE EXEMPLE. Code de retrait : 700001') === 'available', 'l’ARRIVÉE au nouveau point (sujet « disponible ») reste une arrivée');
    dit(m.etatColisDepuisTexte('Votre colis a été retiré', 'Merci, votre colis a bien été retiré.') === 'delivered', 'un retrait reste un retrait');
  });

  console.log('§B la lecture de l’e-mail (api/email-inbound.js)');
  await essaie('B', async () => {
    const { parseCarrierEmail } = await importer('api/email-inbound.js');
    const t = parseCarrierEmail({ subject: SUJET, text: CORPS, from: 'noreply@mondialrelay.fr' }, 'mondialrelay', '2026-11-10T09:00:00.000Z');
    dit(t.status === 'transit', 'rangé EN ROUTE', t.status);
    dit(t.status !== 'available' && t.status !== 'delivered', 'jamais « à retirer » ni « livré »');
    dit(t.label === 'Point relais changé', 'libellé « Point relais changé »', t.label);
    dit(t.relaisChange === true, 'drapeau relaisChange rangé');
    dit(/INTERMARCHE EXEMPLE/.test(t.lieu || '') && /35350/.test(t.lieu || ''), 'le NOUVEAU point lu (nom + code postal)', t.lieu);
    dit(!/TABAC DE L|35260/.test(t.lieu || ''), 'jamais l’ancien point', t.lieu);
    dit(t.suivi === '87654321', 'le n° de suivi (l’identité) est lu', t.suivi);
    const sansPoint = parseCarrierEmail({ subject: SUJET, text: 'Votre colis 87654321 a changé de plan : le Point Relais est temporairement indisponible.', from: 'noreply@mondialrelay.fr' }, 'mondialrelay', '2026-11-10T09:00:00.000Z');
    dit(sansPoint.status === 'transit' && !sansPoint.lieu, 'nouveau point pas écrit ⇒ aucun lieu (jamais deviné)', JSON.stringify({ s: sansPoint.status, l: sansPoint.lieu }));
  });

  console.log('§C la relecture des lignes déjà rangées (api/_lib/suivi-colis.js)');
  await essaie('C', async () => {
    const { relireLigneSuivi } = await importer('api/_lib/suivi-colis.js');
    for (const st of ['available', 'delivered']) {
      const d = relireLigneSuivi({ suivi: '87654321', carrier: 'mondialrelay', status: st, statusLabel: st === 'delivered' ? 'Livré / retiré' : 'Arrivé au point de retrait', subject: SUJET, lieu: 'INTERMARCHE EXEMPLE, 4 AVENUE DE L’ESSAI, 35350 ST MELOIR DES ONDES', receivedAt: '2026-11-10T09:00:00.000Z' });
      dit(d.status === 'transit' && d.relaisChange === true && d.statusLabel === 'Point relais changé', `une ligne rangée « ${st} » par cet e-mail est relue EN ROUTE`, JSON.stringify({ s: d.status, l: d.statusLabel }));
    }
    const a = relireLigneSuivi({ suivi: '87654321', carrier: 'mondialrelay', status: 'available', subject: 'Votre colis 87654321 est disponible', code: '700001', lieu: 'INTERMARCHE EXEMPLE, 35350 ST MELOIR DES ONDES' });
    dit(a.status === 'available', 'l’arrivée au nouveau point reste à retirer', a.status);
  });

  console.log('§D l’alerte ambre (src/relaisChange.js)');
  await essaie('D', async () => {
    const m = await importer('src/relaisChange.js');
    const ligne = { suivi: '87654321', carrier: 'mondialrelay', status: 'transit', relaisChange: true, lieu: 'INTERMARCHE EXEMPLE, 4 AVENUE DE L’ESSAI, 35350 ST MELOIR DES ONDES', receivedAt: '2026-11-10T09:00:00.000Z' };
    const maintenant = Date.parse('2026-11-10T12:00:00.000Z');
    const l = m.colisRelaisChange([ligne], { maintenant });
    dit(Array.isArray(l) && l.length === 1 && l[0].nom === 'INTERMARCHE EXEMPLE' && /35350/.test(l[0].adresse), 'le colis redirigé, son nouveau point (nom, adresse) LUS', JSON.stringify(l));
    dit(m.colisRelaisChange(null) === null, 'pas su ⇒ pas su (null)');
    const arrive = { suivi: '87654321', carrier: 'vinted', status: 'available', code: '700001' };
    dit(m.colisRelaisChange([ligne, arrive], { maintenant }).length === 0, 'un autre e-mail du même n° le dit arrivé ⇒ plus d’alerte');
    dit(m.colisRelaisChange([{ ...ligne, sens: 'sortant' }], { maintenant }).length === 0, 'un colis VENDU (sortant) n’est pas un retrait à faire');
    dit(m.colisRelaisChange([ligne], { maintenant: maintenant + 30 * 86400000 }).length === 0, 'au-delà de 21 jours, plus d’alerte');
    const g = m.lienItineraire(ligne.lieu, false), a = m.lienItineraire(ligne.lieu, true);
    dit(g.startsWith('https://www.google.com/maps/dir/?api=1&destination=') && g.includes(encodeURIComponent('35350 ST MELOIR DES ONDES')), 'itinéraire Google Maps vers l’adresse lue', g);
    dit(a.startsWith('https://maps.apple.com/?daddr=') && a.includes(encodeURIComponent('INTERMARCHE EXEMPLE')), 'itinéraire Plans (Apple) vers l’adresse lue', a);
    dit(m.lienItineraire('', true) === '', 'sans adresse lue, aucun lien');
  });

  console.log('§E le branchement');
  await essaie('E', async () => {
    const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    // (11 nov., lot DJ3) « À retirer » est la section de tête d'Achats : sur Achats, l'alerte n'est rendue qu'une
    // fois (par la section), plus dans « En route » de la liste du même écran.
    dit(/\(aFilter==='attente' \|\| \(aFilter==='route' && !modeListeAchats\)\) && <AlerteRelaisChange lignes=\{tracking\} C=\{C\} transp=\{transpMap\}\/>/.test(app), 'l’alerte est rendue sur À retirer (une fois sur Achats), sur les lignes RELUES (`tracking`) et ce que dit le transporteur (10 nov.)');
    const comp = fs.readFileSync(path.join(R, 'src/AlerteRelaisChange.jsx'), 'utf8');
    dit(/C\.warn/.test(comp) && /Point relais changé/.test(comp) && /data-relais-change-itineraire/.test(comp), 'ambre (C.warn), « Point relais changé », bouton Itinéraire');
  });

  console.log(`\n${ok} vérifications, ${ko} en échec`);
  process.exit(ko ? 1 : 0);
})();
