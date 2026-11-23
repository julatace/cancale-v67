#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════════════
//  AUDIT : L'ANNONCE CRÉÉE PAR VRM GARDE SON IDENTITÉ (19 nov., extension 5.409)
//  EXÉCUTE le vrai `background.js` (scripts/_fond-vm.cjs), base inventée :
//   L · Leboncoin — la soumission `adsubmit/v2/classifieds` (`{ status: 'created', ad_id }`, forme
//       mesurée dans `lbc_catalogue`) est retenue dans l'onglet du dépôt ; à la confirmation du MÊME
//       onglet, `lbc_publiees[ad_id] = { numero }`. Autre onglet, trop vieux, lecture ratée, identifiant
//       déjà rangé sous un AUTRE N° ⇒ rien d'écrit.
//   V · Vestiaire — la publication retenue (identifiant numérique du brouillon, fichiers des photos)
//       relie l'annonce de « Mes annonces » qui porte le MÊME identifiant ou le MÊME fichier photo, et
//       elle seule ; deux possibles ⇒ rien ; une annonce qui porte déjà un AUTRE N° ⇒ jamais réécrite.
//   A · l'app lit `lbc_publiees` comme une identité (`numeroLbcIdentite`).
//  `--src <background.js>` : une autre copie (la preuve sur le code d'avant : rouge, les fonctions n'existent pas).
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path'), fs = require('fs');
const { faireFond, cheminSource } = require('./_fond-vm.cjs');
let ko = 0, n = 0;
const dit = (c, m, d) => { n++; if (!c) ko++; console.log(`${c ? '✅' : '❌'} ${m}${c ? '' : ' — ' + JSON.stringify(d)}`); };
const URL_SOUMISSION = 'https://api.leboncoin.fr/api/adsubmit/v2/classifieds';
const corps = (o) => JSON.stringify(o);
(async () => {
  try {
    // ── L · Leboncoin ──
    {
      const F = faireFond({ src: cheminSource() });
      const { ctx, lignes } = F;
      dit(typeof ctx.noterAnnonceLbcCreee === 'function' && typeof ctx.garderPublieeLbc === 'function', 'L0 · les fonctions existent (noterAnnonceLbcCreee, garderPublieeLbc)', '');
      dit(await ctx.noterAnnonceLbcCreee(URL_SOUMISSION, corps({ status: 'draft', ad_id: 2000000001 }), { tab: { id: 7 } }) === false, 'L1 · une réponse qui n’est pas « created » ne retient rien', '');
      dit(await ctx.noterAnnonceLbcCreee('https://api.leboncoin.fr/api/autre', corps({ status: 'created', ad_id: 2000000001 }), { tab: { id: 7 } }) === false, 'L1 · une autre adresse ne retient rien', '');
      dit(await ctx.noterAnnonceLbcCreee(URL_SOUMISSION, corps({ status: 'created', ad_id: 2000000001 }), { tab: { id: 7 } }) === true, 'L1 · la soumission créée est retenue (onglet du dépôt)', '');
      dit(await ctx.garderPublieeLbc({ source: '9001', numero: '124', tabId: 8 }) === false && !lignes.lbc_publiees, 'L2 · la confirmation d’un AUTRE onglet ne range rien', lignes.lbc_publiees);
      const ok = await ctx.garderPublieeLbc({ source: '9001', numero: '124', tabId: 7 });
      dit(ok === true && lignes.lbc_publiees && lignes.lbc_publiees.publiees['2000000001'] && lignes.lbc_publiees.publiees['2000000001'].numero === '124',
        'L3 · confirmation du MÊME onglet ⇒ lbc_publiees[ad_id] = { numero: 124 }', lignes.lbc_publiees);
      // Une deuxième annonce, déjà rangée sous un autre N° : jamais réécrite.
      await ctx.noterAnnonceLbcCreee(URL_SOUMISSION, corps({ status: 'created', ad_id: 2000000001 }), { tab: { id: 7 } });
      dit(await ctx.garderPublieeLbc({ source: '9002', numero: '125', tabId: 7 }) === false && lignes.lbc_publiees.publiees['2000000001'].numero === '124', 'L4 · un identifiant déjà rangé sous un AUTRE N° n’est jamais réécrit', lignes.lbc_publiees);
      dit(await ctx.garderPublieeLbc({ source: '9002', numero: 'pas un N°', tabId: 7 }) === false, 'L4 · un N° illisible ⇒ rien', '');
    }
    {
      const F = faireFond({ src: cheminSource(), lectureKO: (u) => /lbc_publiees/.test(u) });
      await F.ctx.noterAnnonceLbcCreee(URL_SOUMISSION, corps({ status: 'created', ad_id: 2000000003 }), { tab: { id: 7 } });
      dit(await F.ctx.garderPublieeLbc({ source: '9003', numero: '126', tabId: 7 }) === false && !F.lignes.lbc_publiees, 'L5 · lecture de lbc_publiees ratée ⇒ RIEN écrit', F.lignes.lbc_publiees);
    }
    {
      const F = faireFond({ src: cheminSource(), store: { vrmLbcCreee: { adId: '2000000004', at: Date.now() - 20 * 60000, tabId: 7 } } });
      dit(await F.ctx.garderPublieeLbc({ source: '9004', numero: '127', tabId: 7 }) === false && !F.lignes.lbc_publiees, 'L5 · une soumission de plus de 15 min ⇒ rien', '');
    }
    // ── V · Vestiaire ──
    {
      const F = faireFond({ src: cheminSource() });
      const L = F.ctx.liensPublieesVc, cp = F.ctx.clePhotoDepotVc;
      dit(typeof L === 'function' && typeof cp === 'function' && typeof F.ctx.retenirPublieeVc === 'function', 'V0 · les fonctions existent (retenirPublieeVc, liensPublieesVc)', '');
      const f1 = 'https://images.vestiairecollective.com/images/resized/w=256,q=75/produit/a1b2c3d4e5f6.jpg';
      const lus = { 73000001: { photo: f1 }, 73000002: { photo: 'https://images.vestiairecollective.com/produit/zz9988776655.jpg' }, 73000003: { photo: '' } };
      const p1 = { numero: '124', brouillon: '', photos: [cp('/uploads/a1b2c3d4e5f6.jpg')] };
      const r1 = L([p1], lus, {});
      dit(r1.liens['73000001'] === '124' && Object.keys(r1.liens).length === 1 && r1.faites.size === 1, 'V1 · le MÊME fichier photo ⇒ l’annonce numérique reçoit son lien', r1.liens);
      const r2 = L([{ numero: '125', brouillon: '73000003', photos: [] }], lus, {});
      dit(r2.liens['73000003'] === '125', 'V2 · le même identifiant que le brouillon ⇒ lien', r2.liens);
      const deux = { ...lus, 73000009: { photo: f1 } };
      const r3 = L([p1], deux, {});
      dit(!Object.keys(r3.liens).length && !r3.faites.size, 'V3 · deux annonces possibles ⇒ RIEN (elle reste « à vérifier »)', r3.liens);
      const r4 = L([p1], lus, { 73000001: '99' });
      dit(!Object.keys(r4.liens).length && r4.faites.size === 1, 'V4 · une annonce qui porte déjà un AUTRE N° n’est jamais réécrite', r4.liens);
      dit(cp('https://x.com/a/photo.jpg') === '' && cp('') === '', 'V5 · un nom de fichier générique n’est pas une identité', '');
      await F.ctx.retenirPublieeVc({ productId: 'uuid-uuid', brouillon: '73000003', photos: [], numero: '128' });
      dit(Array.isArray(F.store.vrmVcPubliees) && F.store.vrmVcPubliees.length === 1 && F.store.vrmVcPubliees[0].brouillon === '73000003', 'V6 · la publication est retenue (chrome.storage.local, un worker meurt à 30 s)', F.store.vrmVcPubliees);
      dit(await F.ctx.retenirPublieeVc({ productId: 'x', brouillon: '', photos: [], numero: '129' }) === false, 'V6 · sans identifiant numérique ni photo : rien retenu (les 3 liens d’avant restent « à vérifier »)', '');
    }
    // ── A · l'app lit l'identité ──
    {
      const app = fs.readFileSync(path.join(__dirname, '..', 'src', 'App.jsx'), 'utf8');
      dit(/id=in\.\(lbc_listings,lbc_publiees\)/.test(app) && /if \(ad\.vrmPubliee\) \{ const kp = cleNum\(ad\.vrmPubliee\); if \(kp\) ks\.add\(kp\); \}/.test(app),
        'A1 · l’app lit lbc_publiees avec les annonces (même lecture) et `numeroLbcIdentite` la compte comme une identité', '');
    }
  } catch (e) { dit(false, 'l’audit a planté', String((e && e.stack) || e).slice(0, 300)); }
  console.log(`\n${ko ? '❌' : '✅'} audit-publiees-sites : ${ko ? ko + ' rouge(s) sur ' + n : n + ' contrôles verts'}`);
  process.exit(ko ? 1 : 0);
})();
