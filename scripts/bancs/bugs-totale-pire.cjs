// ═════════════════════════════════════════════════════════════════════════════
//  BANC « BUGS-TOTALE — LE PIRE RÉALISTE » (22 nov., break-ui) : la base de volume passée au pire plausible
//  (`_bt-commun.cjs` `pire`) — titres très longs (108 caractères), emoji, titre d'un mot, sans photo, 12 450 €,
//  pseudo de 40 caractères. Sur chaque écran, au téléphone (390) et à l'ordinateur (1512), clair et sombre :
//  rien ne déborde de l'écran, aucun « undefined / NaN / [object Object] », aucune clé de traduction brute,
//  aucun montant coupé, le « ⋯ » ou le prix d'une rangée reste dans l'écran.
//  VUES=tel,ordi,tel-sombre,ordi-sombre (défaut tel,ordi)  SORTIE=<dossier>
// ═════════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs'), os = require('os');
const B = require('./_bt-commun.cjs');
const SORTIE = process.env.SORTIE || path.join(os.tmpdir(), 'vrm-bancs', 'bugs-totale-pire');
fs.mkdirSync(SORTIE, { recursive: true });
const VUES = String(process.env.VUES || 'tel,ordi').split(',').map((x) => x.trim()).filter(Boolean);
const ECRANS = String(process.env.ECRANS || 'journee,annonces,ventes,achats,compta,dashboard,messages,garage,settings,vintedaccounts').split(',');
const { dit, fin } = B.journal('bugs-totale-pire');

const sonde = () => {
  const W = innerWidth;
  const vis = (e) => { const b = e.getBoundingClientRect(); const s = getComputedStyle(e); return b.width > 0 && b.height > 0 && s.visibility !== 'hidden' && !e.closest('[hidden],[inert],[aria-hidden="true"]'); };
  const defile = (e) => { for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const s = getComputedStyle(x); if (/(auto|scroll|hidden|clip)/.test(s.overflowX) && x.scrollWidth > x.clientWidth + 1) return true; } return false; };
  const racine = document.querySelector('.vrm-main') || document.body;
  const texte = (racine.innerText || '').replace(/\s+/g, ' ');
  const faux = (texte.match(/.{0,30}(\bundefined\b|\bNaN\b|\[object Object\]|Infinity|\{[a-z]+\}).{0,30}/g) || []).slice(0, 4);
  const fuites = [];
  for (const e of racine.querySelectorAll('*')) {
    if (fuites.length > 5) break;
    const b = e.getBoundingClientRect();
    if (b.width > 0 && b.right > W + 2 && b.left < W && vis(e) && !defile(e)) fuites.push(`${e.tagName.toLowerCase()}.${String(e.className || '').split(' ')[0]} « ${(e.innerText || '').trim().slice(0, 30)} » → ${Math.round(b.right)}`);
  }
  // Un montant n'est jamais coupé (« 12 4… ») : un élément qui porte un « € » et dont le texte dépasse sa boîte.
  const montants = [];
  for (const e of racine.querySelectorAll('*')) {
    if (montants.length > 4) break;
    if (!vis(e) || e.childElementCount > 2) continue;
    const t = (e.textContent || '').trim();
    if (!/\d\s?€$/.test(t) || t.length > 14) continue;
    if (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible') montants.push(t);
  }
  return { deborde: document.documentElement.scrollWidth > W + 1 ? document.documentElement.scrollWidth : 0, faux, fuites, montants, ecran: (document.querySelector('#vrm-contenu') || {}).dataset ? document.querySelector('#vrm-contenu').dataset.ecran : '' };
};

async function main() {
  const { srv, ICI } = await B.serveur();
  const nav = await B.navigateur();
  try {
    for (const vue of VUES) {
      const base = B.pire(B.fabriquer({ volumeReel: true, annonces: 300 }));
      const { ctx, pg, J } = await B.ouvrir(nav, vue, base);
      try {
        await B.demarrer(pg, ICI, 'journee');
        await pg.locator('[data-toast-numeros] .n-toast-action').click({ timeout: 1500 }).catch(() => {});
        for (const e of ECRANS) {
          const e0 = J.erreurs.length;
          await B.aller(pg, e, 3500);
          const hauts = [];
          for (let i = 0; i < 3; i++) {
            hauts.push(await pg.evaluate(sonde));
            await pg.screenshot({ path: path.join(SORTIE, `${vue}-${e}-${i}.png`) }).catch(() => {});
            await pg.evaluate(() => { const el = [document.scrollingElement, ...document.querySelectorAll('.vrm-main, [data-defile]')].filter((x) => x && x.scrollHeight > x.clientHeight + 20).sort((a, b) => b.scrollHeight - a.scrollHeight)[0]; if (el) el.scrollTop += el.clientHeight * 0.9; });
            await pg.waitForTimeout(400);
          }
          await pg.evaluate(() => { for (const el of [document.scrollingElement, ...document.querySelectorAll('.vrm-main, [data-defile]')]) if (el) el.scrollTop = 0; });
          const tout = (k) => [...new Set(hauts.flatMap((h) => (Array.isArray(h[k]) ? h[k] : h[k] ? [String(h[k])] : [])))];
          dit(vue, `${e} : rien ne déborde de l'écran`, !tout('deborde').length && !tout('fuites').length, [...tout('deborde'), ...tout('fuites')].slice(0, 5).join(' | '));
          dit(vue, `${e} : aucun undefined / NaN`, !tout('faux').length, tout('faux').join(' | '));
          dit(vue, `${e} : aucun montant coupé`, !tout('montants').length, tout('montants').join(' | '));
          const err = [...new Set(J.erreurs.slice(e0))].filter((x) => !/Service Worker registration blocked|language detection/.test(x));
          dit(vue, `${e} : aucune erreur`, !err.length, err.slice(0, 3).join(' ¦ '));
        }
      } catch (e) { dit(vue, 'le parcours a pu jouer', false, e && e.message); }
      await ctx.close();
    }
  } finally { await nav.close(); srv.close(); }
  process.exit(fin(SORTIE) ? 1 : 0);
}
main();
