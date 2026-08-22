#!/usr/bin/env node
// ── LE CODE DE RETRAIT NE DOIT JAMAIS DISPARAÎTRE ────────────────────────────
// Un colis non retiré repart chez l'expéditeur : c'est de l'argent perdu, et
// c'est irréversible. Ce contrôle fige ce qui a été RELEVÉ sur les vrais emails
// de Julien (août 2026) — les URL qui SONT le Pickup Pass, et celles qui n'en
// sont pas. Les deux fichiers doivent trancher pareil (§11 : une règle, un
// endroit ; ici elle est forcément écrite deux fois — serveur et affichage —
// donc on vérifie qu'elles ne divergent pas).
//
// À relancer après toute modification d'`URL_QR_CERTAIN` / `URL_PAS_UN_QR`.
const fs = require('fs');
const path = require('path');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const API = R('api/email-inbound.js'), APP = R('src/App.jsx');
const regex = (src, nom) => {
  const m = new RegExp(`^const ${nom} = (/.*/[a-z]*);`, 'm').exec(src);
  if (!m) throw new Error(`${nom} introuvable`);
  return eval(m[1]);                                          // eslint-disable-line no-eval
};

// VRAIES URL relevées dans les emails Pickup reçus (17 et 19 août 2026).
const VRAIS = [
  'https://avisageng-colis-webexternal.pickup-services.com/api/barcode/DataMatrix?d=FR1971A;09843408317167|81569539',
  'https://avisageng-colis-webexternal.pickup-services.com/api/barcode/AztecCode?d=PICKUPPASS:2.00:FR93638;09447431562792;;',
];
// Ce que les mêmes emails contiennent AUSSI, et qui n'est pas un code.
const FAUX = [
  'https://tracking.network1.pickup.fr/tracking/1/open/pqcmXRuoRrsgCTOEnNad581UDkSJl0FAQb21q5DvN13w',
  'https://avn-webexternal.azureedge.net/avn-prod/FRA_DROPOFF_PICKUP_PARCEL',
  'https://avn-webexternal.azureedge.net/avn-prod/FRA_CHR_LOGO',
  'https://cdn.email-relay.vintedgo.com/banner-icon.png',
  'https://static.chronopost.fr/img/enquete-satisfaction.png',
];

let ko = 0;
const ok = (m) => console.log('✅ ' + m);
const nok = (m, d) => { ko++; console.log('❌ ' + m + (d ? ' — ' + d : '')); };

for (const [nom, src] of [['api/email-inbound.js', API], ['src/App.jsx', APP]]) {
  const CERT = regex(src, 'URL_QR_CERTAIN'), PAS = regex(src, 'URL_PAS_UN_QR');
  // La décision réelle : certain d'abord, liste noire ensuite.
  const affiche = (u) => CERT.test(u) || !PAS.test(u);
  const manques = VRAIS.filter(u => !affiche(u));
  manques.length
    ? nok(`${nom} : les 2 vrais Pickup Pass sont affichés`, `${manques.length} rejeté(s) — le colis serait irretirable`)
    : ok(`${nom} : les 2 vrais Pickup Pass sont affichés`);
  const passent = FAUX.filter(affiche);
  passent.length
    ? nok(`${nom} : mouchards et bannières écartés`, passent.length + ' passe(nt) encore')
    : ok(`${nom} : mouchards et bannières écartés`);
}

// Les deux fichiers doivent dire la MÊME chose sur chaque URL connue.
{
  const dec = (src) => { const C = regex(src, 'URL_QR_CERTAIN'), P = regex(src, 'URL_PAS_UN_QR');
    return (u) => C.test(u) || !P.test(u); };
  const a = dec(API), b = dec(APP);
  const ecarts = [...VRAIS, ...FAUX].filter(u => a(u) !== b(u));
  ecarts.length
    ? nok('serveur et affichage tranchent pareil', ecarts.length + ' désaccord(s)')
    : ok('serveur et affichage tranchent pareil');
}

console.log(ko ? `\n${ko} contrôle(s) en échec — un colis peut devenir irretirable.`
               : '\nLe Pickup Pass ne peut pas disparaître.');
process.exit(ko ? 1 : 0);
