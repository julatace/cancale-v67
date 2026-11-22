// ════════════════════════════════════════════════════════════════════════════
//  BANC « LA SAISIE EST GARDÉE » (22 nov., audit complet de l'extension)
//
//  Mesuré le 22 nov. sur la 5.436.0 (vrai panneau relié au vrai fond, `_pont-panneau.cjs`) : chaque rendu du panneau
//  REMPLACE ses enfants. Pendant qu'il tape dans un champ (chercher une annonce, écrire un message aux favoris, régler
//  un seuil), un rendu retirait le curseur du champ — et un rendu arrive SANS lui :
//   · un état qui change dans `chrome.storage.local` (une capture finie écrit `vrmFlux`, une pause, un compte) ;
//   · l'onglet qui redevient visible ;
//   · la souris qui revient sur le panneau (depuis la barre d'onglets, une autre fenêtre) : elle relançait en plus une
//     lecture d'état (`etat`) et un rendu complet à CHAQUE passage, panneau déjà ouvert.
//  On juge, sur chaque page du grand panneau qui a un champ de texte, à l'ordinateur et au téléphone :
//   G1  après chacun des trois événements, le MÊME champ a toujours le curseur, sa valeur tapée et sa sélection ;
//   G2  la souris qui revient sur le grand panneau ouvert n'envoie AUCUN message au fond ;
//   G3  le rendu a bien eu lieu (le banc ne juge pas un panneau figé) : un changement d'état est répercuté.
//  `BANC_EXT=<arbre d'avant>/vinted-sync-extension` : rouge attendu sur la 5.436.0 d'avant. Tout est inventé.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const P = require('./_pont-panneau.cjs');

let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 500) : ''}`); } };
const PAGES = ['annonces', 'ventes', 'messages', 'favoris', 'automatisations', 'parametres'];

// Le champ de texte visible de la page (le dernier), où il tape ; ce qu'on relit ensuite.
const TAPER = () => {
  const r = document.getElementById('vrm-badge').shadowRoot, vis = (el) => el.getClientRects().length > 0;
  const champs = Array.from(r.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=number]):not([type=time]):not([type=range]):not([type=file]), textarea')).filter((c) => vis(c) && !c.disabled && !c.readOnly);
  const c = champs[champs.length - 1]; if (!c) return null;
  c.focus();
  const set = Object.getOwnPropertyDescriptor(c.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype, 'value').set;
  set.call(c, (c.value || '') + ' banc tape');
  c.dispatchEvent(new Event('input', { bubbles: true }));
  // Le rendu que `input` a pu déclencher est passé : on se replace (ou on constate qu'il a déjà perdu le curseur).
  return true;
};
const LIRE = () => {
  const r = document.getElementById('vrm-badge').shadowRoot, f = r.activeElement;
  if (!f) return { champ: null };
  let deb = null, fin = null; try { deb = f.selectionStart; fin = f.selectionEnd; } catch (_) {}
  return { champ: f.tagName + '|' + Array.from(f.attributes).filter((a) => /^data-/.test(a.name)).map((a) => a.name + '=' + a.value).sort().join(','), valeur: f.value, deb, fin, connecte: f.isConnected };
};
const PLACER = () => { const r = document.getElementById('vrm-badge').shadowRoot, f = r.activeElement; if (!f || typeof f.setSelectionRange !== 'function') return false; try { f.setSelectionRange(2, 5); } catch (_) { return false; } f.__marque = true; return true; };
const MARQUE = () => { const r = document.getElementById('vrm-badge').shadowRoot, f = r.activeElement; return !!(f && f.__marque); };

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const cfg of [{ nom: '1512', largeur: 1512, hauteur: 900 }, { nom: '390', largeur: 390, hauteur: 844, mobile: true }]) {
      console.log(`\n${cfg.nom}`);
      let pagesJugees = 0, rendus = 0;
      for (const page of PAGES) {
        const m = await P.monde({ store: { vrmChoixComptes: { [P.UID]: { choix: 'oui', login: 'shop_sophie', at: Date.now() - P.J } } } });
        const t = await P.ouvrir(nav, m, cfg);
        try {
          await t.montrer();
          await t.pg.evaluate((p) => { const r = document.getElementById('vrm-badge').shadowRoot; let b = Array.from(r.querySelectorAll(`[data-onglet-b="${p}"]`)).find((x) => x.getClientRects().length); if (!b) { const plus = r.querySelector('[data-vx-plus]'); if (plus) plus.click(); b = r.querySelector(`[data-onglet-b="${p}"]`); } if (b) b.click(); }, page);
          await t.pg.waitForTimeout(1500);
          const EVENEMENTS = [
            ['un état change (vrmFlux)', async () => { await m.f.ctx.chrome.storage.local.set({ vrmFlux: { okAt: Date.now(), banc: Math.random() } }); }],
            ['l’onglet redevient visible', async () => { await t.pg.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); }],
            ...(cfg.mobile ? [] : [['la souris revient sur le panneau', async () => { await t.pg.evaluate(() => document.getElementById('vrm-badge').dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse', clientX: 700, clientY: 400 }))); }]]),
          ];
          let aChamp = false;
          for (const [nom, declencher] of EVENEMENTS) {
            if (!(await t.pg.evaluate(TAPER))) break;
            aChamp = true;
            await t.pg.waitForTimeout(350);
            await t.pg.evaluate(PLACER);
            const avant = await t.pg.evaluate(LIRE), n0 = t.messages.length;
            await declencher();
            await t.pg.waitForTimeout(1300);
            const apres = await t.pg.evaluate(LIRE), memeNoeud = await t.pg.evaluate(MARQUE);
            if (!memeNoeud) rendus++;
            dit(!!avant.champ && apres.champ === avant.champ && apres.valeur === avant.valeur && apres.deb === avant.deb && apres.fin === avant.fin && apres.connecte === true,
              `G1 ${cfg.nom} · ${page} · ${nom} : le champ garde le curseur, la valeur et la sélection`, JSON.stringify({ avant, apres }));
            if (/souris/.test(nom)) dit(t.messages.length === n0, `G2 ${cfg.nom} · ${page} : la souris qui revient sur le panneau ouvert n’envoie rien au fond`, t.messages.slice(n0).map((e) => e.msg.action).join(','));
          }
          if (aChamp) pagesJugees++;
          dit(t.erreurs.length === 0, `${cfg.nom} · ${page} : aucune erreur de page`, t.erreurs.join(' | '));
        } finally { await t.fermer(); }
      }
      dit(pagesJugees >= 4, `${cfg.nom} : au moins quatre pages ont un champ de texte jugé (${pagesJugees})`);
      dit(rendus >= 4, `G3 ${cfg.nom} : le rendu a bien eu lieu (le champ a été REMPLACÉ ${rendus} fois, et retrouvé)`);
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} saisie gardée : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
