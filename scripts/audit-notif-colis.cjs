// ═══════════════════════════════════════════════════════════════════════════
// BANC : LE TEXTE DE LA NOTIFICATION D'UN COLIS À RETIRER
//        node scripts/audit-notif-colis.cjs
// ═══════════════════════════════════════════════════════════════════════════
// §4.10 — une fonction serverless n'est vérifiée que si un banc l'EXÉCUTE.
// Julien, 21 sept. : « la notification c'est juste "colis en transit" ou
// "information colis", pas "tu as reçu un colis à tel endroit" ; normalement tu
// reçois l'endroit, le lieu et la date de retrait ». La notif d'un colis ARRIVÉ
// doit donc porter le LIEU et la DATE LIMITE (tirés de l'email), pas seulement
// le n° de suivi.
// On juge la RÈGLE, pas une formule (§6.5) : ce qui est dans l'email doit
// ressortir ; ce qui n'y est pas ne s'invente jamais (§5, mieux vaut un blanc).
const path = require('path');
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log((c ? 'OK  ' : 'KO  ') + m + (d ? ' — ' + d : '')); };

(async () => {
  const mod = await import('file://' + path.join(__dirname, '..', 'api', 'email-inbound.js'));
  const body = mod.bodyNotifColis;
  if (typeof body !== 'function') { console.log('KO  bodyNotifColis introuvable'); process.exit(1); }

  // 1) Colis arrivé, avec lieu + code + date limite (le cas de Julien).
  const b1 = body({ status: 'available', suivi: 'XW12', lieu: 'Maison De La Presse, 40 Rue Du Port, 35260 Cancale', code: '9461', limite: '2026-09-23' }, 'mondialrelay');
  dit(/Maison De La Presse/.test(b1), 'le LIEU du mail est dans la notif — « où aller »', b1);
  dit(/9461/.test(b1), 'le CODE de retrait est dans la notif', b1);
  dit(/23\/09/.test(b1), 'la DATE LIMITE est dans la notif', b1);
  dit(/Mondial Relay/.test(b1), 'le transporteur est nommé', b1);

  // 2) Colis arrivé SANS lieu : on n'invente pas d'endroit (§5).
  const b2 = body({ status: 'available', suivi: 'YY99', code: '' }, 'chronopost');
  dit(!/chez\s/i.test(b2), 'sans lieu dans le mail, aucun endroit inventé', b2);
  dit(/n°YY99|point de retrait/.test(b2), 'il reste actionnable (n° / point de retrait)', b2);
  dit(!/Code/.test(b2), 'sans code, aucun code inventé', b2);

  // 3) Le mot « suivant » n'est PAS un code (§5.72) : jamais affiché.
  const b3 = body({ status: 'available', suivi: 'ZZ', lieu: 'Tabac Le Port', code: 'suivant' }, 'chronopost');
  dit(!/suivant/i.test(b3), 'le faux code « suivant » n\'est jamais montré', b3);

  // 4) En transit / info / livré : le message court, pas de lieu inventé.
  const b4 = body({ status: 'transit', suivi: 'AA', label: 'En transit' }, 'mondialrelay');
  dit(/En transit/.test(b4) && !/à retirer chez/.test(b4), 'un colis EN TRANSIT ne dit pas « à retirer »', b4);

  console.log(ko === 0 ? '\nLa notif de colis dit l\'endroit, le code et la date.' : `\n${ko} contrôle(s) au rouge.`);
  process.exit(ko === 0 ? 0 : 1);
})().catch(e => { console.log('KO  le banc a levé : ' + e.message); process.exit(1); });
