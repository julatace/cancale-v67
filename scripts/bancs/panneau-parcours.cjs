// ════════════════════════════════════════════════════════════════════════════
//  BANC « LES PARCOURS DU PANNEAU, DE BOUT EN BOUT, AVEC LE VRAI FOND » (22 nov., audit complet de l'extension)
//
//  Le banc « tout toucher » touche chaque contrôle une fois. Ici, les gestes à plusieurs temps qu'un toucher isolé ne
//  finit pas (un fichier à donner, une confirmation après un choix), joués dans le VRAI panneau relié au VRAI
//  `background.js` (`_pont-panneau.cjs`) :
//   S  Sauvegarde ⇄ restauration : « Sauvegarder mes réglages » ⇒ le fond rend le fichier ; un fichier qui n'est pas une
//      sauvegarde ⇒ refusé avec la raison ; le MÊME fichier rendu au panneau (« Restaurer », un vrai champ de fichier) ⇒
//      aperçu accepté (un jeton), « Rien à changer » et UN bouton — jamais « Remplacer 0 réglages ? » ; chaque message a
//      la forme que le fond lit (`exporter`, `apercu` + texte, `annuler`). (La restauration confirmée d'un fichier qui
//      change des réglages est jugée par audit-sauvegarde-reglages et le banc sauvegarde-reglages-panneau.)
//   M  Articles ▸ cocher ▸ « Masquer » ▸ confirmer : `masquerCarte` part avec `confirme: true` et LES annonces cochées ;
//      « Annuler » n'envoie rien.
//   P  Articles ▸ cocher ▸ « Baisser le prix » ▸ −10 % ▸ avant / après ▸ confirmer : `prixCarte` part avec le prix VU
//      et le prix voulu de chaque annonce cochée ; le fond répond (rangé, ou refusé avec la raison) et l'écran le dit.
//   F  Favoris ▸ cocher ▸ « Envoyer » ▸ « Confirmer l'envoi » : `favorisCarte` `lancer` part avec SA sélection et
//      `confirme: true`, au compte de l'onglet ; la vraie file du serveur la reçoit.
//  `BANC_EXT=<arbre>/vinted-sync-extension` : une autre copie. Tout est inventé.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
require('./_porte-banc.cjs');
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const P = require('./_pont-panneau.cjs');
const SORTIE = process.env.BANC_CAPTURES ? path.join(process.env.BANC_CAPTURES, 'panneau-parcours') : path.join(__dirname, 'captures', 'panneau-parcours');

let ko = 0, ok = 0;
const J = (x) => { try { return String(JSON.stringify(x)); } catch (_) { return String(x); } };
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`  ✅ ${quoi}`); } else { ko++; console.log(`  ❌ ${quoi}${detail ? ' — ' + String(detail).slice(0, 700) : ''}`); } };
const essaie = async (quoi, fn) => { try { await fn(); } catch (e) { ko++; console.log(`  ❌ ${quoi} — a levé : ${String(e && e.message).slice(0, 300)}`); } };

const R = (pg, fn, a) => pg.evaluate(fn, a);
const clic = async (pg, sel, ms = 700) => { const fait = await R(pg, (s) => { const r = document.getElementById('vrm-badge').shadowRoot; const b = Array.from(r.querySelectorAll(s)).find((x) => x.getClientRects().length && !x.disabled); if (!b) return false; b.scrollIntoView({ block: 'center' }); b.click(); return true; }, sel); await pg.waitForTimeout(ms); return fait; };
const page = async (t, p) => { await R(t.pg, (p) => { const r = document.getElementById('vrm-badge').shadowRoot; let b = Array.from(r.querySelectorAll(`[data-onglet-b="${p}"]`)).find((x) => x.getClientRects().length); if (!b) { const plus = r.querySelector('[data-vx-plus]'); if (plus) plus.click(); b = r.querySelector(`[data-onglet-b="${p}"]`); } if (b) b.click(); }, p); await t.pg.waitForTimeout(1500); };
const texte = (pg) => R(pg, () => (document.getElementById('vrm-badge').shadowRoot.querySelector('.carte').innerText || '').replace(/\s+/g, ' '));
const visibles = (pg, sel) => R(pg, (s) => Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll(s)).filter((x) => x.getClientRects().length).length, sel);
const depuis = (t, n0, action, quoi) => t.messages.slice(n0).filter((e) => e.msg.action === action && (quoi === undefined || e.msg.quoi === quoi));
const cap = async (pg, nom) => { try { fs.mkdirSync(SORTIE, { recursive: true }); await pg.screenshot({ path: path.join(SORTIE, nom + '.png') }); } catch (_) {} };
// Chaque case cochée re-rend la liste : la seconde case se retrouve APRÈS le rendu (jamais un nœud d'avant).
const cocherDeux = async (pg) => { const ids = []; for (let i = 0; i < 2; i++) { const id = await R(pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; const c = Array.from(r.querySelectorAll('[data-ann-sel]')).find((x) => !x.checked && x.getClientRects().length); if (!c) return null; c.click(); return c.getAttribute('data-ann-sel'); }); if (id) ids.push(id); await pg.waitForTimeout(450); } return ids; };
const STORE = () => ({ vrmChoixComptes: { [P.UID]: { choix: 'oui', login: 'shop_sophie', at: Date.now() - P.J } } });

(async () => {
  const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--no-sandbox', '--no-proxy-server'] });
  try {
    for (const cfg of [{ nom: '390', largeur: 390, hauteur: 844, mobile: true, orion: true }, { nom: '1512', largeur: 1512, hauteur: 900 }]) {
      console.log(`\n${cfg.nom}`);

      await essaie(`S ${cfg.nom}`, async () => {
        const m = await P.monde({ store: STORE() });
        const t = await P.ouvrir(nav, m, cfg);
        try {
          await t.montrer(); await page(t, 'parametres');
          let n0 = t.messages.length;
          const a = await clic(t.pg, '[data-sr-sauver]', 1200);
          const ex = depuis(t, n0, 'sauvegardeReglages', 'exporter')[0];
          dit(a && ex && ex.rep && ex.rep.ok === true && typeof ex.rep.texte === 'string' && ex.rep.texte.length > 20 && /\.json$/.test(String(ex.rep.nom || '')), `S ${cfg.nom} : « Sauvegarder » ⇒ le fond rend un fichier .json`, J(ex && ex.rep).slice(0, 200));
          const telecharge = await R(t.pg, () => { const x = document.querySelector('a[data-sr-telecharge]'); return x ? { nom: x.getAttribute('download'), blob: /^blob:/.test(x.href) } : null; });
          dit(telecharge && telecharge.blob && /\.json$/.test(telecharge.nom || ''), `S ${cfg.nom} : le fichier est proposé au téléchargement sous son nom`, J(telecharge));
          if (!(ex && ex.rep && ex.rep.texte)) return;
          // Un fichier qui n'est PAS une sauvegarde.
          const faux = path.join(os.tmpdir(), `vrm-banc-faux-${process.pid}.json`); fs.writeFileSync(faux, '{"bonjour":"ceci n’est pas une sauvegarde VRM"}');
          const store0 = JSON.stringify(m.f.store);
          n0 = t.messages.length;
          const champ = await t.pg.evaluateHandle(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-sr-fichier]'));
          dit(!!champ.asElement(), `S ${cfg.nom} : le champ « Restaurer » existe`);
          if (!champ.asElement()) return;
          await champ.asElement().setInputFiles(faux); await t.pg.waitForTimeout(1200);
          const apF = depuis(t, n0, 'sauvegardeReglages', 'apercu')[0];
          const txF = await texte(t.pg);
          dit(apF && apF.rep && apF.rep.ok === false && String(apF.rep.raison || '').length > 8 && txF.includes(String(apF.rep.raison).slice(0, 30)) && (await visibles(t.pg, '[data-sr-oui]')) === 0, `S ${cfg.nom} : un fichier qui n’est pas une sauvegarde ⇒ refusé, la raison est à l’écran, rien à confirmer`, J(apF && apF.rep).slice(0, 200));
          try { fs.unlinkSync(faux); } catch (_) {}
          // Le VRAI fichier rendu par le fond.
          const vrai = path.join(os.tmpdir(), `vrm-banc-sauvegarde-${process.pid}.json`); fs.writeFileSync(vrai, ex.rep.texte);
          n0 = t.messages.length;
          const champ2 = await t.pg.evaluateHandle(() => document.getElementById('vrm-badge').shadowRoot.querySelector('[data-sr-fichier]'));
          await champ2.asElement().setInputFiles(vrai); await t.pg.waitForTimeout(1300);
          const ap1 = depuis(t, n0, 'sauvegardeReglages', 'apercu')[0];
          dit(ap1 && ap1.msg.texte === ex.rep.texte && ap1.rep && ap1.rep.ok === true && typeof ap1.rep.jeton === 'string' && ap1.rep.jeton.length > 6, `S ${cfg.nom} : le fichier rendu au panneau ⇒ aperçu accepté par le fond (un jeton)`, J(ap1 && ap1.rep).slice(0, 240));
          await cap(t.pg, `sauvegarde-apercu-${cfg.nom}`);
          // Rien n'a changé depuis la sauvegarde : « Rien à changer », UN bouton pour fermer, aucune question « Remplacer 0 réglages ? ».
          const txR = await texte(t.pg);
          dit(ap1 && ap1.rep && Array.isArray(ap1.rep.changements) && ap1.rep.changements.length === 0 && (await visibles(t.pg, '[data-sr-oui]')) === 0 && (await visibles(t.pg, '[data-sr-non]')) === 1 && !/\b0 r[ée]glage/.test(txR), `S ${cfg.nom} : rien n’a changé depuis ⇒ « Rien à changer », pas de question « Remplacer 0 réglages ? », un seul bouton`, J({ n: ap1 && ap1.rep && ap1.rep.changements && ap1.rep.changements.length, q: /\b0 r[ée]glage/.test(txR) }));
          n0 = t.messages.length;
          await clic(t.pg, '[data-sr-non]', 700);
          dit(depuis(t, n0, 'sauvegardeReglages', 'annuler').length === 1 && (await visibles(t.pg, '[data-sr-apercu]')) === 0 && (await visibles(t.pg, '[data-sr-sauver]')) === 1, `S ${cfg.nom} : « Fermer » ⇒ l’aperçu part, le fond est prévenu (annuler), les deux boutons reviennent`);
          await cap(t.pg, `sauvegarde-fin-${cfg.nom}`);
          try { fs.unlinkSync(vrai); } catch (_) {}
          dit(t.erreurs.length === 0 && !t.messages.some((e) => e.muet || e.leve), `S ${cfg.nom} : aucune erreur de page, aucun message muet`, t.erreurs.join(' | '));
        } finally { await t.fermer(); }
      });

      await essaie(`M ${cfg.nom}`, async () => {
        const m = await P.monde({ store: STORE() });
        const t = await P.ouvrir(nav, m, cfg);
        try {
          await t.montrer(); await page(t, 'annonces');
          const ids = await cocherDeux(t.pg);
          const choisir = (v) => R(t.pg, (v) => { const r = document.getElementById('vrm-badge').shadowRoot; const s = r.querySelector('[data-ann-action]'); if (!s || s.disabled) return false; s.value = v; s.dispatchEvent(new Event('change', { bubbles: true })); return true; }, v);
          dit(ids.length === 2 && (await choisir('masquer')), `M ${cfg.nom} : deux annonces cochées, « Masquer » choisi`);
          await t.pg.waitForTimeout(600);
          let n0 = t.messages.length;
          await clic(t.pg, '[data-ann-confirme-non]', 600);
          dit(depuis(t, n0, 'masquerCarte').length === 0, `M ${cfg.nom} : « Annuler » n’envoie rien`);
          await choisir('masquer'); await t.pg.waitForTimeout(600);
          n0 = t.messages.length;
          await clic(t.pg, '[data-ann-confirme-ok]', 1500);
          const ms = depuis(t, n0, 'masquerCarte')[0];
          dit(ms && ms.msg.confirme === true && J((ms.msg.ids || []).map(String).sort()) === J(ids.slice().sort()) && ms.rep && typeof ms.rep.ok === 'boolean', `M ${cfg.nom} : « Masquer sur Vinted » confirmé ⇒ masquerCarte part avec SA confirmation et LES deux annonces cochées ; le fond répond`, J(ms && { m: ms.msg, r: ms.rep }).slice(0, 300));
          const tx = await texte(t.pg);
          dit(ms && ms.rep && (ms.rep.ok || tx.includes(String(ms.rep.raison || '').slice(0, 25)) || (await visibles(t.pg, '[data-ann-resultat]')) > 0), `M ${cfg.nom} : l’issue (fait, ou refusé avec la raison) est à l’écran`, J(ms && ms.rep).slice(0, 200));
          await cap(t.pg, `masquer-${cfg.nom}`);
          dit(t.erreurs.length === 0 && !t.messages.some((e) => e.muet || e.leve), `M ${cfg.nom} : aucune erreur de page, aucun message muet`, t.erreurs.join(' | '));
        } finally { await t.fermer(); }
      });

      await essaie(`P ${cfg.nom}`, async () => {
        const m = await P.monde({ store: STORE() });
        const t = await P.ouvrir(nav, m, cfg);
        try {
          await t.montrer(); await page(t, 'annonces');
          const ids = await cocherDeux(t.pg);
          await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; const s = r.querySelector('[data-ann-action]'); s.value = 'baisser'; s.dispatchEvent(new Event('change', { bubbles: true })); });
          await t.pg.waitForTimeout(1200);
          dit(await clic(t.pg, '[data-prix-pct="10"]', 600), `P ${cfg.nom} : « −10 % » se touche`);
          const voulus = await R(t.pg, () => Object.fromEntries(Array.from(document.getElementById('vrm-badge').shadowRoot.querySelectorAll('[data-prix-nouveau]')).map((i) => [i.getAttribute('data-prix-nouveau'), i.value])));
          let n0 = t.messages.length;
          await clic(t.pg, '[data-prix-confirmer]', 900);   // « Voir l'avant / après »
          const direct = depuis(t, n0, 'prixCarte');
          if (!direct.length) { await cap(t.pg, `prix-avant-apres-${cfg.nom}`); await clic(t.pg, '[data-prix-confirmer], [data-aa-confirmer], [data-geste-confirmer]', 1500); }
          const px = depuis(t, n0, 'prixCarte')[0];
          const itemsOk = px && Array.isArray(px.msg.items) && px.msg.items.length === 2 && px.msg.items.every((x) => ids.includes(String(x.id)) && Number(x.prix) > 0 && Number(x.prixVu) > 0 && Number(x.prix) < Number(x.prixVu));
          dit(px && px.msg.confirme === true && itemsOk, `P ${cfg.nom} : prixCarte part avec SA confirmation, le prix VU et le prix voulu (plus bas) de chaque annonce cochée`, J(px ? px.msg : { voulus, vus: await visibles(t.pg, 'button') }).slice(0, 400));
          dit(px && px.rep && typeof px.rep.ok === 'boolean' && (px.rep.ok || px.rep.code), `P ${cfg.nom} : le fond répond (rangé, ou refusé avec un code)`, J(px && px.rep).slice(0, 300));
          await cap(t.pg, `prix-fin-${cfg.nom}`);
          dit(t.erreurs.length === 0 && !t.messages.some((e) => e.muet || e.leve), `P ${cfg.nom} : aucune erreur de page, aucun message muet`, t.erreurs.join(' | '));
        } finally { await t.fermer(); }
      });

      await essaie(`F ${cfg.nom}`, async () => {
        const m = await P.monde({ store: STORE() });
        const t = await P.ouvrir(nav, m, cfg);
        try {
          await t.montrer(); await page(t, 'favoris'); await t.pg.waitForTimeout(1200);
          const coches = await R(t.pg, () => { const r = document.getElementById('vrm-badge').shadowRoot; const cs = Array.from(r.querySelectorAll('input[type=checkbox][data-fav-coche], input[type=checkbox][data-fav6-sel], .table6 input[type=checkbox]:not([data-fav-tout])')).filter((c) => c.getClientRects().length && !c.disabled); const pris = cs.filter((c) => !c.checked).slice(0, 2); for (const c of pris) c.click(); return { n: cs.length, coches: Array.from(r.querySelectorAll('.table6 input[type=checkbox]:checked')).length }; });
          await t.pg.waitForTimeout(600);
          dit(coches.n >= 2, `F ${cfg.nom} : la liste des favoris a des cases (${coches.n})`, J(coches));
          let n0 = t.messages.length;
          const env = await clic(t.pg, '[data-fav-envoyer]', 1500);
          await cap(t.pg, `favoris-confirmer-${cfg.nom}`);
          // La feuille d'envoi avance étape par étape (« Suivant ») jusqu'à l'envoi — ou s'arrête et dit ce qui manque.
          let conf = 0;
          for (let i = 0; i < 6 && !depuis(t, n0, 'favorisCarte', 'lancer').length; i++) { if (!(await clic(t.pg, '[data-fav-etape-suivant], [data-fav-etape-confirmer], [data-fav-confirmer]', 1300))) break; conf++; }
          const la = depuis(t, n0, 'favorisCarte', 'lancer')[0];
          if (!la) {
            // Sans message écrit pour ce compte, la feuille ne va pas plus loin : rien n'est parti, et elle dit quoi faire.
            const tx = await texte(t.pg), pe = depuis(t, n0, 'favorisPerso', 'envoi')[0];
            dit(env && pe && pe.rep && pe.rep.ok === true && m.sv.lancers.length === 0 && /message/i.test(tx) && !t.messages.slice(n0).some((e) => e.muet || e.leve), `F ${cfg.nom} : aucun message écrit pour ce compte ⇒ la feuille s’arrête et dit quoi écrire, RIEN ne part (aucun lancer)`, J({ env, conf, vus: t.messages.slice(n0).map((e) => e.msg.action + ':' + (e.msg.quoi || '')) }).slice(0, 400));
            await cap(t.pg, `favoris-fin-${cfg.nom}`);
            return;
          }
          dit(env && la && la.msg.confirme === true && String(la.msg.uid) === P.UID && Array.isArray(la.msg.selection) && la.msg.selection.length >= 1, `F ${cfg.nom} : « Envoyer » puis « Confirmer » ⇒ favorisCarte lancer part avec SA confirmation, le compte de l’onglet et SA sélection`, J({ env, conf, m: la && la.msg, vus: t.messages.slice(n0).map((e) => e.msg.action + ':' + (e.msg.quoi || '')) }).slice(0, 500));
          dit(la && la.rep && typeof la.rep.ok === 'boolean' && (la.rep.ok || la.rep.code), `F ${cfg.nom} : le fond répond (lancé, ou refusé avec un code)`, J(la && la.rep).slice(0, 300));
          dit(!la || !la.rep || !la.rep.ok || (m.sv.lancers.length === 1 && J(m.sv.lancers[0].slice().sort()) === J(la.msg.selection.slice().sort())), `F ${cfg.nom} : la file du serveur reçoit exactement SA sélection, une fois`, J(m.sv.lancers));
          await cap(t.pg, `favoris-fin-${cfg.nom}`);
          dit(t.erreurs.length === 0 && !t.messages.some((e) => e.muet || e.leve), `F ${cfg.nom} : aucune erreur de page, aucun message muet`, t.erreurs.join(' | '));
        } finally { await t.fermer(); }
      });
    }
  } finally { await nav.close(); }
  console.log(`\n${ko ? '❌' : '✅'} parcours du panneau : ${ok} bon(s), ${ko} défaut(s)`);
  process.exit(ko ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
