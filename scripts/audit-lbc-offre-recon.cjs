// ⚠️ MESURE — LES OFFRES LEBONCOIN : SA FORME, JAMAIS SES VALEURS.
//
// Julien, 27 octobre : « à côté du numéro un prix mini, tout au-dessus est accepté…
// pareil pour Leboncoin ». Sur Vinted on a livré le 1-tap (pas de seuil natif).
// Pour Leboncoin, on ne peut PAS voir sa page d'ici (403) : il faut d'abord
// MESURER la forme d'une offre LBC et de son éventuel seuil d'auto-acceptation
// vendeur, puis — à la passe suivante, sur la forme RÉELLE — câbler soit son
// seuil natif (comme eBay), soit le même 1-tap que Vinted.
//
// Mesuré en lisant `lbc-inject.js` : le mouchard de reconnaissance EXISTE DÉJÀ et
// couvre les offres, sans rien ajouter (leçon du tiroir `Nav` : vérifier ce qui
// est branché avant d'ajouter). Pour CHAQUE appel Leboncoin :
//   · `noteEnvoi` → `lbcenvoi` : la FORME du corps d'une écriture (POST/PUT/…) —
//     chemins de clés + TYPE, JAMAIS une valeur. C'est là que vit un seuil posé.
//   · `noteSchema` → `lbcschema` : la FORME d'une réponse JSON — idem.
//   · `noteSeen` → `lbcpaths` : méthode + chemin (ids → {id}) + statut + type.
//
// Ce contrôle charge le VRAI `lbc-inject.js` dans un vrai navigateur, sous le nom
// de leboncoin.fr, joue une offre (une écriture avec un seuil, une lecture de
// réglage de négociation) et EXIGE : la forme part, AUCUNE valeur ne fuit (ni le
// prix, ni le seuil, ni le nom/l'identifiant de l'acheteur, ni le message).
// `--prouve` réaffaiblit le mouchard (il relève les VALEURS) → le contrôle de
// fuite passe au ROUGE (§6.1 : la preuve n'est pas « la fonction n'existait pas »,
// c'est que le banc ATTRAPE la règle fautive).
const { chromium } = require('/home/user/cancale-v67/node_modules/playwright');
const fs = require('fs'), path = require('path');
const racine = path.join(__dirname, '..');
let INJ = fs.readFileSync(path.join(racine, 'vinted-sync-extension', 'lbc-inject.js'), 'utf8');
const PROUVE = process.argv.includes('--prouve');
if (PROUVE) {
  // Réaffaiblissement : la feuille note sa VALEUR au lieu de son seul type.
  const avant = INJ;
  INJ = INJ.replace("if (prefixe) out.push(prefixe + ':' + (v === null ? 'null' : typeof v));",
                    "if (prefixe) out.push(prefixe + ':' + (v === null ? 'null' : String(v)));");
  if (INJ === avant) { console.log('❌ --prouve : point de mutation introuvable (cheminsDeCles a changé)'); process.exit(1); }
}
let ko = 0;
const dit = (c, m, d) => { if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

// Valeurs SENSIBLES, inventées : si l'une d'elles ressort, c'est une fuite.
const PRIX = 4500, SEUIL = 4000, PLANCHER = 3000, ACHETEUR_ID = 424242, ACHETEUR = 'SECRET-ACHETEUR', MSG = 'SECRET-OFFRE-MSG', AD = '2900001';
const REP_OFFRE = JSON.stringify({ offer: { id: '77', status: 'pending', price_cents: PRIX, auto_accept_price_cents: SEUIL, created_at: '2026-10-27T10:00:00Z' }, buyer: { id: ACHETEUR_ID, name: ACHETEUR }, ad: { list_id: AD } });
const REP_REGLAGE = JSON.stringify({ negotiation: { auto_accept_price_cents: SEUIL, min_price_cents: PLANCHER, enabled: true } });
const SENSIBLES = [String(PRIX), String(SEUIL), String(PLANCHER), String(ACHETEUR_ID), ACHETEUR, MSG];

(async () => {
  let b;
  try {
    b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
    const pg = await b.newPage();
    await pg.route('https://www.leboncoin.fr/**', (r) => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>' }));
    await pg.route('https://api.leboncoin.fr/**', (r) => {
      const u = r.request().url();
      const body = /negotiations?\/.*settings|negotiation\/v\d+\/ads/.test(u) ? REP_REGLAGE : REP_OFFRE;
      r.fulfill({ status: 200, contentType: 'application/json', body });
    });
    await pg.goto('https://www.leboncoin.fr/ad/x/' + AD);
    await pg.evaluate(`window.__tout = []; window.addEventListener('message', (e) => { const d = e.data; if (d && d.__tag === 'CANCALE_LBC') window.__tout.push(d); });`);
    await pg.evaluate(INJ);
    // Le vendeur FAIT une offre (écriture avec un seuil), puis LIT le réglage de négociation.
    await pg.evaluate(`(async () => {
      await fetch('https://api.leboncoin.fr/api/negotiation/v1/offers', { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ad_id: '${AD}', buyer_id: ${ACHETEUR_ID}, price_cents: ${PRIX}, auto_accept_price_cents: ${SEUIL}, message: '${MSG}' }) }).then(r => r.text());
      await fetch('https://api.leboncoin.fr/api/negotiation/v1/ads/${AD}/settings').then(r => r.text());
    })()`);
    await pg.waitForTimeout(5000);                 // le relevé des chemins part toutes les 4 s
    const tout = await pg.evaluate('window.__tout');
    const texte = JSON.stringify(tout);

    // 1. La FORME de l'écriture (l'offre + le seuil) part.
    const envois = tout.filter((d) => d.kind === 'lbcenvoi' && /negotiation/.test(String(d.url || '')));
    const clesEnvoi = envois.flatMap((d) => d.cles || []);
    dit(envois.some((d) => /POST/i.test(d.methode)) && clesEnvoi.some((c) => /auto_accept_price_cents:number/.test(c)) && clesEnvoi.some((c) => /price_cents:number/.test(c)),
      'la FORME de l\'offre vendeur (dont le champ de seuil auto_accept) est relevée, en TYPES', clesEnvoi.slice(0, 8).join(' · '));

    // 2. La FORME de la réponse (offre + réglage de négociation) part.
    const schemas = tout.filter((d) => d.kind === 'lbcschema');
    const clesRep = schemas.flatMap((d) => d.cles || []);
    dit(schemas.length >= 1 && clesRep.some((c) => /auto_accept_price_cents:number/.test(c)),
      'la FORME des réponses d\'offre/négociation est relevée (où vit le seuil)', clesRep.filter((c) => /price|accept|status|enabled/.test(c)).slice(0, 8).join(' · '));

    // 3. Méthode + statut de l'appel d'offre (pour le reconnaître parmi des dizaines).
    const chemins = tout.filter((d) => d.kind === 'lbcpaths').flatMap((d) => d.paths || []);
    dit(chemins.some((p) => /POST .*negotiation.*offers.* → 200/.test(p)),
      'le chemin d\'offre est noté avec sa méthode et son statut (POST … → 200)', chemins.filter((p) => /negotiation/.test(p)).slice(0, 3).join(' | '));

    // 4. ⚠️ AUCUNE VALEUR ne fuit (ni prix, ni seuil, ni acheteur, ni message).
    const fuite = SENSIBLES.filter((v) => texte.includes(v));
    dit(fuite.length === 0, '⚠️ aucune valeur sensible ne quitte la page (prix, seuil, acheteur, message)',
      fuite.length ? 'FUITE : ' + fuite.join(', ') : '');

    // 5. Un identifiant brut dans un chemin devient {id}.
    const brut = chemins.filter((p) => new RegExp('\\b' + ACHETEUR_ID + '\\b').test(p) || /\/\d{3,}(?![}])/.test(p.replace('{id}', '')));
    dit(brut.length === 0, 'aucun identifiant brut dans un chemin (ils deviennent {id})', brut.slice(0, 2).join(' | '));
  } catch (e) { dit(false, 'le contrôle a tourné jusqu\'au bout', String(e && e.message).slice(0, 160)); }
  finally { if (b) await b.close(); }
  if (PROUVE) {
    console.log(`\n--prouve : le mouchard RÉAFFAIBLI (relève les valeurs) ${ko ? 'a bien été ATTRAPÉ (rouge)' : 'N\'A PAS été attrapé — le banc ne prouve rien'}`);
    process.exit(ko ? 0 : 1);           // en --prouve, on EXIGE un rouge
  }
  console.log(`\n${ko ? `❌ ${ko} échec(s)` : '✅ tout est vert — la forme des offres Leboncoin est mesurable, sans fuite'}`);
  process.exit(ko ? 1 : 0);
})();
