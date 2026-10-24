// AUDIT « POLITIQUE DE CONFIDENTIALITÉ ↔ HÔTES CONTACTÉS PAR LE NAVIGATEUR »
// (22 octobre, relecture du chantier « carte »).
// Le défaut : en remplaçant la ligne « Nominatim, CARTO » par OpenFreeMap, la
// politique a perdu la seule ligne qui disait que l'écran ACHATS envoie, depuis
// TON navigateur, l'adresse de chaque point relais à la Base Adresse Nationale
// et à Nominatim (géocodage automatique à chaque ouverture). Rien ne liait le
// code à la politique : une déclaration vraie est partie sans que rien ne crie.
// Ce contrôle relit TOUTES les adresses https:// écrites dans le CODE de src/
// (commentaires retirés) et exige que chaque couple (fichier, hôte) soit dans
// une liste FERMÉE, avec sa raison :
//   · « politique » : le navigateur contacte cet hôte tout seul (fetch, image,
//     script, tuiles) ⇒ la politique doit avoir une ligne qui NOMME le service,
//     dit À QUOI il sert ici (l'écran) et QUI envoie (« ton navigateur » / ton
//     adresse IP) — juger le seul nom du service serait vert sur le défaut
//     (Nominatim restait nommé, pour la communauté seulement) ;
//   · « lien » : une adresse que la personne OUVRE d'un clic (rien ne part tout
//     seul) ; « vrm » : VRM lui-même ; « eteint » : chargé seulement quand un
//     réglage l'allume (dit, pas exigé).
// Un couple inconnu ⇒ ROUGE : un nouvel hôte appelé par le navigateur se
// déclare (politique + cette liste), il ne passe pas en silence.
// `--prouve` réaffaiblit la politique ou le code : chaque mutation ⇒ ROUGE.
const fs = require('fs'), path = require('path');
const R = path.join(__dirname, '..');
const PROUVE = process.argv.includes('--prouve');
const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

// ── Ce que la politique doit dire, par usage ────────────────────────────────
const SERVICE = {
  'api-adresse.data.gouv.fr': /Base Adresse Nationale/,
  'nominatim.openstreetmap.org': /Nominatim/,
  'tiles.openfreemap.org': /OpenFreeMap/,
  'cdn.discordapp.com': /Discord/,
  'cdn.jsdelivr.net': /jsDelivr/,
  'lgonxzrzjcqthjtbdpzo.supabase.co': /Supabase/,
  'ws.chronopost.fr': /Chronopost/,
  'carrier.vintedgo.com': /Vinted Go/,
};
const USAGES = {
  achats: { quoi: 'géocodage automatique des points relais (écran Achats)', role: /points? relais/i, donnee: /navigateur/i },
  ville: { quoi: 'recherche de ville de la carte de la communauté (repli du navigateur)', role: /communaut/i, donnee: /navigateur/i },
  fond: { quoi: 'fond de la carte de la communauté (tuiles)', role: /carte de la communaut/i, donnee: /adresse IP/i },
  avatar: { quoi: 'photos de profil Discord sur la carte', role: /communaut/i, donnee: /navigateur|adresse IP/i },
  pdfjs: { quoi: 'aperçu des bordereaux (pdf.js)', role: /pdf\.js|aperçu des bordereaux/i, donnee: /navigateur|adresse IP/i },
  ort: { quoi: 'détourage du Studio photo (onnxruntime)', role: /Studio photo|onnxruntime/i, donnee: /navigateur|adresse IP/i },
  base: { quoi: 'la base de données de VRM', role: /./, donnee: /./ },
  // (24 oct.) Le statut public d'un colis, lu par le SERVEUR (Chronopost, Vinted Go).
  transp: { quoi: 'statut public des colis, lu par le serveur', role: /statut public des colis/i, donnee: /n° de suivi[\s\S]*serveur VRM/i },
};
// ── La liste FERMÉE des couples (fichier, hôte) écrits dans le code ─────────
const LIEN = 'lien ouvert d’un clic par la personne (rien ne part tout seul)';
const COUPLES = {
  'src/App.jsx|api-adresse.data.gouv.fr': ['politique', 'achats'],
  'src/App.jsx|nominatim.openstreetmap.org': ['politique', 'achats'],
  'src/App.jsx|cdn.jsdelivr.net': ['politique', 'pdfjs'],
  'src/studioPhoto.js|cdn.jsdelivr.net': ['politique', 'ort'],
  'src/communaute/Communaute.jsx|api-adresse.data.gouv.fr': ['politique', 'ville'],
  'src/fondCarte.js|tiles.openfreemap.org': ['politique', 'fond'],
  'src/communaute/avatarDiscord.js|cdn.discordapp.com': ['politique', 'avatar'],
  'src/App.jsx|lgonxzrzjcqthjtbdpzo.supabase.co': ['politique', 'base'],
  'src/App.jsx|vrm.center': ['vrm', 'VRM lui-même'],
  'src/captcha.js|challenges.cloudflare.com': ['eteint', 'Turnstile : chargé seulement quand la clé de site est posée — la politique devra alors citer Cloudflare (Turnstile)'],
  'src/fondCarte.js|openfreemap.org': ['lien', 'lien de l’attribution de la carte'],
  'src/fondCarte.js|www.openmaptiles.org': ['lien', 'lien de l’attribution de la carte'],
  'src/fondCarte.js|www.openstreetmap.org': ['lien', 'lien de l’attribution de la carte'],
  'src/App.jsx|discord.com': ['lien', 'connexion Discord : le navigateur y va sur le clic de la personne'],
  'src/communaute/Communaute.jsx|discord.com': ['lien', 'connexion Discord : le navigateur y va sur le clic de la personne'],
  'src/App.jsx|supabase.com': ['lien', LIEN],
  'src/App.jsx|vercel.com': ['lien', LIEN],
  'src/App.jsx|www.autoentrepreneur.urssaf.fr': ['lien', LIEN],
  'src/App.jsx|www.chronopost.fr': ['lien', LIEN],
  'src/App.jsx|www.ebay.fr': ['lien', LIEN],
  'src/App.jsx|www.google.com': ['lien', LIEN],
  'src/App.jsx|www.leboncoin.fr': ['lien', LIEN],
  'src/App.jsx|www.mondialrelay.fr': ['lien', LIEN],
  'src/App.jsx|www.vinted.fr': ['lien', LIEN],
  'src/ebayGestion.jsx|www.ebay.fr': ['lien', LIEN],
  'src/ConfigurerTransfert.jsx|mail.google.com': ['lien', LIEN],
  'src/ConfigurerTransfert.jsx|outlook.live.com': ['lien', LIEN],
  'src/ConfigurerTransfert.jsx|www.icloud.com': ['lien', LIEN],
  'src/navigateurExtension.js|play.google.com': ['lien', LIEN],
  // (24 oct.) Le SERVEUR lit le statut public des colis (api/_lib/transporteurs-lecture.js).
  'api/_lib/transporteurs-lecture.js|ws.chronopost.fr': ['politique', 'transp'],
  'api/_lib/transporteurs-lecture.js|carrier.vintedgo.com': ['politique', 'transp'],
  'api/_lib/transporteurs-lecture.js|lgonxzrzjcqthjtbdpzo.supabase.co': ['politique', 'base'],
  'api/_lib/transporteurs-lecture.js|vrm.center': ['vrm', 'le User-Agent honnête de VRM'],
};
// (24 oct.) Ce que la politique doit dire même si l'hôte n'est pas écrit dans
// ces fichiers : Mondial Relay est lu DEPUIS LE NAVIGATEUR, par l'extension
// (le serveur est refusé — mesuré le 24 oct.), avec le n° ET le code postal.
const DECLARATIONS = [
  { quoi: 'Mondial Relay (statut lu par l’extension, n° + code postal, depuis le navigateur)', service: /Mondial Relay/, role: /statut public des colis/i, donnee: /code postal[\s\S]*(navigateur|extension)/i },
];

function couplesDuCode(fichiers) {
  const out = new Map();
  for (const [rel, texte] of fichiers) {
    sansCommentaires(texte).split('\n').forEach((l, i) => {
      for (const m of l.matchAll(/https:\/\/([a-z0-9][a-z0-9.-]*\.[a-z]{2,})/gi)) {
        const k = rel + '|' + m[1].toLowerCase();
        if (!out.has(k)) out.set(k, []);
        out.get(k).push(i + 1);
      }
    });
  }
  return out;
}
const texteCellule = (h) => h.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
function lignesPolitique(html) {
  return [...html.matchAll(/<tr>([\s\S]*?)<\/tr>/g)].map((m) => [...m[1].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => texteCellule(c[1]))).filter((c) => c.length >= 3);
}

function juger(fichiers, politique, { muet = false } = {}) {
  let ko = 0;
  const dit = (c, m, d) => { if (!c) ko++; if (!muet) console.log((c ? '✅ ' : '❌ ') + m + (d ? ' — ' + d : '')); };
  const couples = couplesDuCode(fichiers);
  const lignes = lignesPolitique(politique);
  dit(lignes.length > 5, 'le tableau des prestataires de la politique se lit', lignes.length + ' lignes');
  const inconnus = [...couples.keys()].filter((k) => !COUPLES[k]);
  dit(inconnus.length === 0, 'chaque adresse https:// du code est dans la liste fermée (politique · lien · VRM · éteint)', inconnus.map((k) => k + ':' + couples.get(k)[0]).join(' · '));
  for (const [k, [classe, quoi]] of Object.entries(COUPLES)) {
    if (!couples.has(k)) { if (!muet) console.log('ℹ️  ' + k + ' : plus écrit dans le code (rien à exiger)'); continue; }
    if (classe !== 'politique') continue;
    const hote = k.split('|')[1], u = USAGES[quoi], service = SERVICE[hote];
    const ligne = lignes.find((c) => service.test(c[0]) && u.role.test(c[1]) && u.donnee.test(c[2]));
    dit(!!ligne, `${k.split('|')[0]} contacte ${hote} (${u.quoi}) : une ligne de la politique nomme le service, dit à quoi il sert ici et qui l’envoie`, ligne ? '« ' + ligne[1].slice(0, 70) + ' »' : 'aucune ligne');
  }
  for (const d of DECLARATIONS) {
    const ligne = lignes.find((c) => d.service.test(c[0]) && d.role.test(c[1]) && d.donnee.test(c[2]));
    dit(!!ligne, `la politique déclare ${d.quoi}`, ligne ? '« ' + ligne[2].slice(0, 70) + ' »' : 'aucune ligne');
  }
  const eteints = Object.entries(COUPLES).filter(([k, [c]]) => c === 'eteint' && couples.has(k));
  if (!muet) for (const [k, [, quoi]] of eteints) console.log('ℹ️  ' + k + ' : ' + quoi);
  return ko;
}

const SERVEUR = ['api/_lib/transporteurs-lecture.js'];
function lireFichiers() {
  const out = [];
  (function marche(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) marche(p); else if (/\.(jsx?|mjs)$/.test(f)) out.push([path.relative(R, p).split(path.sep).join('/'), fs.readFileSync(p, 'utf8')]); } })(path.join(R, 'src'));
  // (24 oct.) + les fichiers SERVEUR qui contactent un tiers au nom du vendeur.
  for (const rel of SERVEUR) { const p = path.join(R, rel); if (fs.existsSync(p)) out.push([rel, fs.readFileSync(p, 'utf8')]); }
  return out;
}

const fichiers = lireFichiers();
const politique = fs.readFileSync(path.join(R, 'public', 'legal', 'confidentialite.html'), 'utf8');
let ko = juger(fichiers, politique);
if (PROUVE) {
  console.log('\n── --prouve : la politique ou le code réaffaibli doit repasser au ROUGE');
  const sansLigne = (motif) => politique.replace(new RegExp('<tr>(?:(?!</tr>)[\\s\\S])*' + motif + '(?:(?!</tr>)[\\s\\S])*</tr>\\s*'), '');
  const MUT = [
    ['la ligne « points relais (écran Achats) » retirée', () => [fichiers, sansLigne('points relais où arrivent tes colis')]],
    ['la ligne Achats dit « le serveur » au lieu du navigateur', () => [fichiers, politique.replace('Adresse du point relais, envoyée par ton navigateur (ton adresse IP)', 'Adresse du point relais, envoyée par le serveur VRM')]],
    ['la ligne jsDelivr retirée', () => [fichiers, sansLigne('jsDelivr')]],
    ['la ligne des photos Discord retirée', () => [fichiers, sansLigne('Photo de profil Discord')]],
    ['la ligne Chronopost / Vinted Go retirée', () => [fichiers, sansLigne('Chronopost \\(groupe La Poste\\)')]],
    ['la ligne Mondial Relay dit « le serveur » au lieu du navigateur', () => [fichiers, politique.replace('envoyés depuis ton navigateur par l’extension VRM', 'envoyés par le serveur VRM')]],
    ['un nouvel hôte contacté par le serveur des transporteurs, non déclaré', () => [fichiers.map(([f, t]) => [f, f === 'api/_lib/transporteurs-lecture.js' ? t + '\nconst sonde = () => fetch(`https://suivi.exemple-tiers.com/v1/x`);\n' : t]), politique]],
    ['un nouvel hôte appelé par le navigateur, non déclaré', () => [fichiers.map(([f, t]) => [f, f === 'src/App.jsx' ? t + '\nconst sonde = () => fetch(`https://api.exemple-tiers.com/v1/x`);\n' : t]), politique]],
  ];
  let prouvees = 0;
  for (const [nom, f] of MUT) {
    const [fi, po] = f();
    if (po === politique && fi === fichiers) { console.log('❌ mutation « ' + nom + ' » : le texte visé n’existe plus'); ko++; continue; }
    const n = juger(fi, po, { muet: true });
    if (n > 0) { prouvees++; console.log(`✅ mutation « ${nom} » ⇒ ${n} contrôle(s) rouge(s)`); }
    else { ko++; console.log(`❌ mutation « ${nom} » : TOUT reste vert — le contrôle ne la voit pas`); }
  }
  console.log(`${prouvees}/${MUT.length} mutations attrapées.`);
}
console.log(ko ? `\n${ko} contrôle(s) rouge(s).` : '\nChaque service que le navigateur contacte tout seul est déclaré dans la politique, avec son usage.');
process.exit(ko ? 1 : 0);
