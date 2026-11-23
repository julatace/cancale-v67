#!/usr/bin/env node
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
//  VESTIAIRE : UNE NOTIFICATION SUR L'ORDINATEUR PAR CHANGEMENT DE MODÉRATION (ext. 5.440, 23 nov.)
//
//  Julien : « une notification sur l'ordinateur quand Vestiaire valide, refuse ou demande une correction ». La 5.439
//  appelait déjà `chrome.notifications.create`, mais (1) la permission `notifications` n'était pas au manifeste et
//  (2) l'icône demandée (`icon128.png`) n'existe pas (le fichier est `icon-128.png`) : rien ne s'affichait. On EXÉCUTE le
//  vrai background.js (scripts/_fond-vm.cjs) ; on juge :
//   N1  permission `notifications` au manifeste, et l'icône de la notification existe dans le paquet ;
//   N2  « en attente » → « en ligne » ⇒ UNE notification « Vestiaire a validé : <titre> » ;
//   N3  la même lecture refaite (rien n'a changé) ⇒ aucune nouvelle notification ;
//   N4  « en attente » → « à corriger » puis « à corriger » → « refusée » ⇒ une notification par changement (2 de plus) ;
//   N5  une annonce lue pour la première fois (pas d'état d'avant) ⇒ rien (jamais deviné) ;
//   N6  un clic sur la notification ouvre Vestiaire dans VRM (vrm.center seulement).
//  `--bg <fichier>` : une autre copie ; `--prouve` : mutations. Données inventées.
// ═════════════════════════════════════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const { faireFond } = require('./_fond-vm.cjs');
const R = path.join(__dirname, '..');
const argBg = (() => { const i = process.argv.indexOf('--bg'); return i > 0 ? process.argv[i + 1] : ''; })();
let BG = argBg ? path.resolve(argBg) : path.join(R, 'vinted-sync-extension', 'background.js');
const MAN = path.join(path.dirname(BG), 'manifest.json');
const MUTATIONS = {
  'icone-absente': ["iconUrl: 'icon-128.png', title: 'VRM', message", "iconUrl: 'icon128.png', title: 'VRM', message"],
  // Un ÉTAT (en ligne) au lieu d'un CHANGEMENT : chaque lecture renotifierait.
  'sans-transition': ["  if (!a || !b || a === b) return '';\n  if ((a === 'attente' || a === 'corriger') && b === 'en-ligne') return 'validee';", "  if (!a || !b) return '';\n  if (b === 'en-ligne') return 'validee';"],
};
if (process.argv.includes('--prouve')) {
  let rate = 0;
  for (const m of Object.keys(MUTATIONS)) {
    const r = cp.spawnSync(process.execPath, [__filename, '--mutation=' + m], { encoding: 'utf8' });
    const rouge = r.status === 1 && /❌ N/.test(r.stdout || '');
    console.log(`${rouge ? '✅' : '❌'} mutation « ${m} » ⇒ ${rouge ? 'rouge' : 'PAS rouge'}`); if (!rouge) rate++;
  }
  process.exit(rate ? 1 : 0);
}
const mut = (process.argv.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const s = fs.readFileSync(BG, 'utf8'), M = MUTATIONS[mut];
  if (!M || !s.includes(M[0])) { console.log('mutation introuvable'); process.exit(2); }
  const d = path.join(os.tmpdir(), `bg-vcnotif-${process.pid}.js`); fs.writeFileSync(d, s.split(M[0]).join(M[1])); BG = d;
  process.on('exit', () => { try { fs.unlinkSync(d); } catch (_) {} });
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('  ✅ ' + m); } else { ko++; console.log('  ❌ ' + m + (d ? '  → ' + String(d).slice(0, 400) : '')); } };

(async () => {
  const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  const src = fs.readFileSync(BG, 'utf8');
  const icones = [...src.matchAll(/vrm-vc-mod-[^\n]*?iconUrl: '([^']+)'/g)].map((m) => m[1]);
  dit((man.permissions || []).includes('notifications') && icones.length > 0 && icones.every((i) => fs.existsSync(path.join(R, 'vinted-sync-extension', i))), 'N1 permission `notifications` au manifeste ; l’icône de la notification existe dans le paquet', JSON.stringify({ perms: man.permissions, icones }));

  const f = faireFond({ src: BG, connecte: '111', lignes: { vc_listings: { items: { A1: { id: 'A1', titre: 'Nike Dunk Low 42', statut: 'pending', compte: 'vc1' }, B2: { id: 'B2', titre: 'Jordan 4 41', statut: 'pending', compte: 'vc1' } }, liens: {}, capturedAt: null } } });
  const notifs = [];
  f.ctx.chrome.notifications = { create: (id, o, cb) => { notifs.push({ id, o }); if (cb) cb(id); }, clear: () => {}, onClicked: { addListener: () => {} } };
  const lire = (statuts) => f.ctx.rangerVcAnnoncesMaintenant({ compte: 'vc1', items: Object.entries(statuts).map(([id, statut]) => ({ id, titre: id === 'A1' ? 'Nike Dunk Low 42' : id === 'B2' ? 'Jordan 4 41' : 'Neuve', statut, prix: 100 })), offset: 0, total: Object.keys(statuts).length, lus: Object.keys(statuts).length });
  await lire({ A1: 'on_sale', B2: 'pending' });
  dit(notifs.length === 1 && /Vestiaire a validé : Nike Dunk Low 42/.test(notifs[0].o.message), 'N2 « en attente » → « en ligne » ⇒ UNE notification « Vestiaire a validé : Nike Dunk Low 42 »', JSON.stringify(notifs));
  await lire({ A1: 'on_sale', B2: 'pending' });
  dit(notifs.length === 1, 'N3 la même lecture refaite ⇒ aucune nouvelle notification', notifs.length);
  await lire({ A1: 'on_sale', B2: 'waiting_picture' });
  await lire({ A1: 'on_sale', B2: 'refused' });
  dit(notifs.length === 3 && /correction : Jordan 4 41/.test(notifs[1].o.message) && /refusé : Jordan 4 41/.test(notifs[2].o.message), 'N4 « à corriger » puis « refusée » ⇒ une notification par changement', JSON.stringify(notifs.map((x) => x.o.message)));
  await lire({ A1: 'on_sale', B2: 'refused', C3: 'on_sale' });
  dit(notifs.length === 3, 'N5 une annonce lue pour la première fois ⇒ rien (jamais deviné)', notifs.length);
  dit(/chrome\.notifications\.onClicked\.addListener\(\(id\) => \{ if \(\/\^vrm-vc-mod-\/\.test[^\n]*url: 'https:\/\/vrm\.center\/\?tab=plat_vestiaire'/.test(src), 'N6 un clic sur la notification ouvre Vestiaire dans VRM (vrm.center seulement)');
  console.log(`\n${ko ? '❌' : '✅'} notification de modération Vestiaire : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
