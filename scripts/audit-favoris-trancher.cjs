// ════════════════════════════════════════════════════════════════════════════
//  « C'EST PARTI » / « PAS PARTI » — SON choix tranche UN envoi incertain (26 nov., ext. 5.453.2)
//
//  Julien (26 nov., 5.453.1) : « Pas parti · Vérifie les envois incertains sur Vinted avant de préparer une nouvelle
//  file. » — toute la file des favoris bloquée par UN envoi incertain, sans aucun geste pour en sortir. On juge, sur la
//  VRAIE file du serveur (api/_lib/favoris-file.js) :
//   T1. (5.455.8) un incertain ne bloque que LUI (jamais renvoyé automatiquement) : un nouvel envoi aux autres part ;
//   T2. « C'est parti » ⇒ envoyé, jamais recontacté ; la nouvelle file part ;
//   T3. « Pas parti » ⇒ refusé SANS écriture (ecrits 0) : il peut être choisi à nouveau, par lui ;
//   T4. trancher un envoi qui n'est pas incertain, ou sans choix clair ⇒ refusé, rien ne change ;
//   T5. l'extension porte le chemin (favorisCarte « trancher », route « trancher ») et le panneau les deux boutons sur la ligne.
//  `node scripts/audit-favoris-trancher.cjs`. Données inventées.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const { pathToFileURL } = require('url');
const R = path.join(__dirname, '..');
let ok = 0, ko = 0;
const dit = (b, q, d) => { if (b) { ok++; console.log('✅ ' + q); } else { ko++; console.log('❌ ' + q + (d != null ? ' — ' + String(d).slice(0, 300) : '')); } };
(async () => {
  const FF = await import(pathToFileURL(path.join(R, 'api', '_lib', 'favoris-file.js')).href);
  const owner = '0f0e0d0c-0000-4000-8000-000000000001', T = 1795000000000;
  const cible = (n) => ({ notificationId: 'n-' + n, itemId: String(91010000 + n), recipientId: String(3000000 + n), initiator: 'acheteur_' + n });
  const lancer = (d, l, t) => FF.lancerFile(d, { owner, targets: l, message: 'Bonjour, ton favori est toujours dispo !', intervalleMinutes: 0, maintenant: t, lot: 'L' + t });
  const avecIncertain = () => { let d = lancer(null, [cible(1), cible(2)], T).data; const g = d.groupes[owner]; g.jobs[0].etat = 'incertain'; g.jobs[1].etat = 'annule'; g.active = false; return d; };
  // T1
  // 5.455.8 (Julien, 28 nov. : « un envoi ne peut pas échouer ») : un envoi incertain ne bloque plus TOUTE la file — seulement LUI
  //    (jamais renvoyé : relancé, il est refusé « déjà préparé ») ; les autres favoris partent.
  { let e = null, r = null; try { r = lancer(avecIncertain(), [cible(3)], T + 1000); } catch (x) { e = x; }
    let e2 = null; try { lancer(avecIncertain(), [cible(1)], T + 1000); } catch (x) { e2 = x; }
    dit(!e && r && r.valeur.active === true && r.valeur.jobs.some((j) => j.notificationId === 'n-3' && j.etat === 'attente') && e2 && /déjà été préparés/.test(e2.message), 'T1 un envoi incertain ne bloque que LUI (jamais renvoyé) : un nouvel envoi aux autres part', JSON.stringify({ e: e && e.message, e2: e2 && e2.message })); }
  // T2
  { const d0 = avecIncertain(); const r = FF.trancherIncertain(d0, { owner, notificationId: 'n-1', parti: true, maintenant: T + 2000 });
    const j = r.data.groupes[owner].jobs.find((x) => x.notificationId === 'n-1');
    dit(j.etat === 'envoye' && j.tranche === 'parti', 'T2 « C’est parti » ⇒ envoyé', JSON.stringify(j));
    let e = null, l = null; try { l = lancer(r.data, [cible(1), cible(3)], T + 3000); } catch (x) { e = x; }
    const nouveaux = l ? l.data.groupes[owner].jobs.filter((x) => x.etat === 'attente').map((x) => x.notificationId) : [];
    dit(!e && JSON.stringify(nouveaux) === '["n-3"]', 'T2 la nouvelle file part, sans recontacter celui qui est parti', e ? e.message : JSON.stringify(nouveaux)); }
  // T3
  { const d0 = avecIncertain(); const r = FF.trancherIncertain(d0, { owner, notificationId: 'n-1', parti: false, maintenant: T + 2000 });
    const j = r.data.groupes[owner].jobs.find((x) => x.notificationId === 'n-1');
    dit(j.etat === 'refuse' && j.ecrits === 0 && j.tranche === 'pas_parti', 'T3 « Pas parti » ⇒ refusé sans écriture', JSON.stringify(j));
    let e = null, l = null; try { l = lancer(r.data, [cible(1)], T + 3000); } catch (x) { e = x; }
    dit(!e && l.data.groupes[owner].jobs.some((x) => x.notificationId === 'n-1' && x.etat === 'attente'), 'T3 il peut être choisi à nouveau (par lui)', e && e.message); }
  // T4
  { const d0 = avecIncertain(); let e1 = null, e2 = null; try { FF.trancherIncertain(d0, { owner, notificationId: 'n-2', parti: true, maintenant: T }); } catch (x) { e1 = x; } try { FF.trancherIncertain(d0, { owner, notificationId: 'n-1', parti: 'oui', maintenant: T }); } catch (x) { e2 = x; }
    dit(e1 && e2 && d0.groupes[owner].jobs[0].etat === 'incertain', 'T4 un envoi pas incertain, ou un choix pas clair ⇒ refusé, rien ne change', [e1 && e1.message, e2 && e2.message].join(' | ')); }
  // T5
  const BG = fs.readFileSync(path.join(R, 'vinted-sync-extension', 'background.js'), 'utf8'), BA = fs.readFileSync(path.join(R, 'vinted-sync-extension', 'vrm-badge.js'), 'utf8'), API = fs.readFileSync(path.join(R, 'api', '_lib', 'favoris.js'), 'utf8');
  dit(/if \(quoi === 'trancher'\)[\s\S]{0,600}apiFavorisCarte\(o\.uid, 'trancher', \{ notificationId: nid, parti: msg\.parti \}\)/.test(BG) && /c\.action==='trancher'\)decision=d=>trancherIncertain/.test(API), 'T5 l’extension et la route portent « trancher »');
  dit(/et\.k === 'verifier' \? `<span class="tr6"[^`]*data-fav6-trancher="parti"[^`]*data-fav6-trancher="pas"/.test(BA) && /quoi: 'trancher', uid, notificationId, parti/.test(BA), 'T5 le panneau : « C’est parti » / « Pas parti » sur la ligne à vérifier');
  console.log(`\n${ko ? '❌' : '✅'} audit-favoris-trancher : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
