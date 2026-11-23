// ════════════════════════════════════════════════════════════════════════
//  MESSAGES AUX FAVORIS AUTOMATIQUES — LE PILOTE DU FOND (22 nov., ext. 5.437)
//  Le VRAI background.js dans un vm. On juge `piloteFavorisTick` :
//   P1. éteint (son interrupteur, par compte) ⇒ rien n'est demandé à VRM ni à Vinted ;
//   P2. allumé ⇒ un favori demandé, envoyé, compté au BILAN du jour (par compte) ;
//   P3. un favori SAUTÉ (déjà au prix mini, vendu, déjà contacté) ⇒ compté avec SA raison, noté au journal du compte ;
//   P4. vérification visible (captcha) ou « Tout arrêter » ⇒ ARRÊT, rien n'est demandé ;
//   P5. un autre compte / pas d'onglet ⇒ rien (jamais deux comptes à la fois) ; au retour du compte, il reprend seul ;
//   P6. au geste : le mode auto saute, AVANT toute écriture, une annonce déjà au plancher (prix mini / achat + 10 %).
//  `--prouve` : chaque mutation doit rendre l'audit ROUGE.
// ════════════════════════════════════════════════════════════════════════
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
const args = process.argv.slice(2);
const BG0 = process.env.BG_SRC ? path.resolve(process.env.BG_SRC) : cheminSource();
const MUTATIONS = {
  bilan: ["    st.bilan = bilanPiloteFavoris(st.bilan, uid, envoye ? 'envoye' : 'saute', raison, maintenant);", ''],
  eteint: ["    if (!r.actif) return fin('eteint', { uid });", ''],
  captcha: ["    if (av && av.stop) return fin(av.stop, { uid });", ''],
  sousMini: ["if(pl&&Number(px)>0&&pl.c>=Math.round(Number(px)*100)){noterDiag('favori_auto_sous_prix_mini');return rep('ignore',0,'sous_prix_mini');}", ''],
};
if (args.includes('--prouve')) {
  let rates = 0;
  for (const m of Object.keys(MUTATIONS)) {
    let rouge = false;
    try { execFileSync(process.execPath, [__filename, `--mutation=${m}`], { stdio: 'pipe', timeout: 300000 }); } catch (e) { rouge = e.status === 1; }
    console.log(`${rouge ? '✅' : '❌'} mutation ${m} ⇒ ${rouge ? 'rouge' : 'RESTE VERT'}`); if (!rouge) rates++;
  }
  console.log(rates ? `\n❌ ${rates} mutation(s) non détectée(s)` : `\n✅ ${Object.keys(MUTATIONS).length}/${Object.keys(MUTATIONS).length} mutations détectées`);
  process.exit(rates ? 1 : 0);
}
let BG = BG0;
const mut = (args.find((a) => a.startsWith('--mutation=')) || '').slice(11);
if (mut) {
  const [a, b] = MUTATIONS[mut]; const s = fs.readFileSync(BG0, 'utf8');
  if (!s.includes(a)) { console.log('mutation introuvable : ' + mut); process.exit(2); }
  BG = path.join(os.tmpdir(), `pf-${mut}-${process.pid}.js`); fs.writeFileSync(BG, s.split(a).join(b));
}
let ok = 0, ko = 0;
const dit = (c, m, d) => { if (c) { ok++; console.log('✅ ' + m); } else { ko++; console.log('❌ ' + m + (d !== undefined ? '  → ' + JSON.stringify(d).slice(0, 400) : '')); } };
const UID = '111';
function monde({ actif = true, stop = null, onglet = UID, reponse = { ok: true, data: { json: { resultat: 'envoye' } } } } = {}) {
  const f = faireFond({ src: BG, connecte: UID });
  const C = f.ctx; const appels = [];
  C.horsLigne = () => false;
  C.lireEtatFavorisCarte = async () => null;
  C.compteOngletPourAuto = async () => onglet;
  C.attenteAvantFavori = async () => (stop ? { stop } : { ms: 0 });
  C.apiFavorisCarte = async (uid, quoi) => { appels.push(quoi || 'lire'); if (!quoi) return { ok: true, json: { vue: { auto: { reglages: { actif } } } } }; if (quoi === 'auto') return { ok: true, json: { ajoute: true } }; if (quoi === 'suivant') return { ok: true, json: { travail: { jeton: '00000000-0000-0000-0000-000000000001', auto: true } } }; return { ok: true, json: {} }; };
  C.executerPourAppCoeur = async () => { appels.push('envoi'); return reponse; };
  return { f, C, appels };
}
const bilan = async (C) => (((await C.chrome.storage.local.get('vrmPiloteFavoris')).vrmPiloteFavoris || {}).bilan || {})[UID];

(async () => {
  try {
    const e = monde({ actif: false });
    await e.C.piloteFavorisTick(Date.now());
    dit(!e.appels.includes('auto') && !e.appels.includes('envoi'), 'P1 éteint (son interrupteur) : rien n’est demandé ni envoyé', e.appels);
    const a = monde();
    const r = await a.C.piloteFavorisTick(Date.now());
    const b = await bilan(a.C);
    dit(r.etat === 'envoye' && a.appels.includes('envoi') && b && b.envoyes === 1, 'P2 allumé : un favori envoyé, compté au bilan du jour du compte', { r, b });
    const s = monde({ reponse: { ok: true, data: { json: { resultat: 'ignore', raison: 'sous_prix_mini' } } } });
    const rs = await s.C.piloteFavorisTick(Date.now());
    const bs = await bilan(s.C);
    const jr = ((await s.C.chrome.storage.local.get('vrmJournal')).vrmJournal || {})[UID] || [];
    dit(rs.etat === 'refuse' && bs && bs.envoyes === 0 && bs.sautes.sous_prix_mini === 1 && jr.some((x) => x.s === 'favori_auto_saute'), 'P3 sauté (déjà au prix mini) : compté avec sa raison, noté au journal', { rs, bs, jr });
    for (const stop of ['verification', 'tout-arrete']) {
      const c = monde({ stop });
      const rc = await c.C.piloteFavorisTick(Date.now());
      dit(rc.etat === stop && !c.appels.includes('auto') && !c.appels.includes('envoi'), `P4 ${stop === 'verification' ? 'vérification visible' : '« Tout arrêter »'} ⇒ ARRÊT, rien n’est demandé`, { rc, ap: c.appels });
    }
    const o = monde({ onglet: null });
    const ro = await o.C.piloteFavorisTick(Date.now());
    dit(ro.etat === 'onglet' && !o.appels.length, 'P5 pas d’onglet sur ce compte : rien (jamais un autre compte)', { ro, ap: o.appels });
    o.C.compteOngletPourAuto = async () => UID;
    const ro2 = await o.C.piloteFavorisTick(Date.now() + 6 * 60000);
    dit(ro2.etat === 'envoye', 'P5 au retour du compte, il reprend seul (au tour suivant)', ro2);
    const src = fs.readFileSync(BG, 'utf8');
    dit(/if\(body&&body\.auto===true&&offre\)\{const pl=await plancherFavori\(body\.itemId\)[^\n]*return rep\('ignore',0,'sous_prix_mini'\);\}\}/.test(src) && src.indexOf("return rep('ignore',0,'sous_prix_mini')") < src.indexOf("etape('cloche');"), 'P6 au geste : une annonce déjà au plancher est sautée AVANT toute écriture (aucune conversation ouverte)');
  } catch (e) { dit(false, 'exception', e && e.stack); }
  console.log(`\n${ko ? '❌' : '✅'} audit-favoris-auto-pilote : ${ok} vert(s), ${ko} rouge(s)`);
  process.exit(ko ? 1 : 0);
})();
