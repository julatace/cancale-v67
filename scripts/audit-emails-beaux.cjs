#!/usr/bin/env node
// scripts/audit-emails-beaux.cjs
// ════════════════════════════════════════════════════════════════════════════
// AUDIT « DES E-MAILS BEAUX, CLAIRS, COURTS ET PAREILS » (17 nov., Julien :
// « Améliore les emails aussi »). Il EXÉCUTE chaque fabrique d'e-mail de VRM
// (scripts/emails-catalogue.cjs : essai j1/j3/j6, bilan du mois complet et partiel,
// preuve d'adresse, e-mail d'essai, essai de la boîte des factures, avis avant
// suppression, suppression demandée, compte supprimé, facture et avoir Pro) dans
// les CINQ langues de l'app, sur des données inventées, et juge :
//   B1 la forme commune (api/_lib/mail-verre.js) : fond, tête, carte, feuille commune ;
//   B2 le nombre de boutons : UN (zéro seulement pour ce qui n'a rien à ouvrir) — et
//      chaque bouton est « à toute épreuve » sous Outlook (un `v:roundrect` VML, même
//      adresse, même mot) ;
//   B3 le texte brut : jamais vide, il porte le titre et l'adresse du bouton ;
//   B4 aucun pixel espion : aucune image hors du logo hébergé (aucune sur la facture
//      d'un vendeur), aucune image de 1 px, aucun lien d'image vers un autre site ;
//   B5 chaque montant donné se lit TEL QUEL (la règle de l'app : `eurosMail`), et
//      aucun autre montant n'apparaît (rien d'inventé) ;
//   B6 le sujet : non vide, 70 caractères au plus ;
//   B7 la langue : `lang` du document, aucun trou `{…}` resté, le titre et le sujet
//      changent avec la langue (sauf la facture : langue de l'acheteur), et la table
//      api/_lib/mail-textes.js a les MÊMES clés, non vides, dans les cinq langues ;
//   B8 qui envoie : la signature « VRM · vrm.center » au pied de chaque e-mail de VRM,
//      jamais dans la facture d'un vendeur ; « Gérer mes e-mails » sur les facultatifs.
// `--mutations` : chaque règle doit rougir sur un e-mail abîmé exprès.
// ════════════════════════════════════════════════════════════════════════════
'use strict';
const path = require('path');
const { pathToFileURL } = require('url');
const RACINE = path.resolve(process.argv.find((a) => a.startsWith('--racine='))?.slice(9) || path.join(__dirname, '..'));
const { catalogue } = require('./emails-catalogue.cjs');

const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
const FACULTATIFS = new Set(['essai-j1', 'essai-j3', 'essai-j6', 'bilan', 'bilan-partiel']);
const PIED = 'data-vv="pied"';

(async () => {
  let MT, MV;
  try {
    MT = await import(pathToFileURL(path.join(RACINE, 'api/_lib/mail-textes.js')).href);
    MV = await import(pathToFileURL(path.join(RACINE, 'api/_lib/mail-verre.js')).href);
  } catch (e) { console.error('❌ api/_lib/mail-textes.js ou mail-verre.js absent : aucun e-mail n’a ses mots dans les cinq langues —', String(e.message).split('\n')[0]); process.exit(1); }
  const V = MV.VERRE, FEUILLE = MV.styleVerre();
  const parLangue = {};
  for (const l of LANGUES) parLangue[l] = await catalogue(RACINE, l);

  // Les montants écrits dans un texte (« 1 842,50 € », « €1,842.50 », « 1.842,50 € »).
  const montantsLus = (t) => [...String(t).matchAll(/€\s?\d[\d.,   ]*\d|\d[\d.,   ]*\d\s?€/g)].map((x) => x[0].replace(/\s+$/, ''));

  function regles(mailsParLangue, T = MT.TEXTES_MAIL) {
    const f = [];
    const exige = (ok, quoi) => { if (!ok) f.push(quoi); };
    // B7 — la table des mots : mêmes clés, non vides, partout.
    const cles = Object.keys(T.fr);
    for (const l of LANGUES) {
      exige(T[l] && typeof T[l] === 'object', `B7 ${l} : table absente`);
      if (!T[l]) continue;
      const manque = cles.filter((k) => typeof T[l][k] !== 'string' || !T[l][k].trim());
      const enTrop = Object.keys(T[l]).filter((k) => !(k in T.fr));
      exige(!manque.length, `B7 ${l} : clé(s) absente(s) ou vide(s) : ${manque.slice(0, 5).join(', ')}`);
      exige(!enTrop.length, `B7 ${l} : clé(s) inconnue(s) du français : ${enTrop.slice(0, 5).join(', ')}`);
      const trous = cles.filter((k) => T[l][k] && JSON.stringify((T.fr[k].match(/\{\w+\}/g) || []).sort()) !== JSON.stringify((T[l][k].match(/\{\w+\}/g) || []).sort()));
      exige(!trous.length, `B7 ${l} : trous {…} différents du français : ${trous.slice(0, 5).join(', ')}`);
    }
    for (const l of LANGUES) {
      for (const m of mailsParLangue[l]) {
        const n = `${m.id} [${l}]`;
        const h = m.html, t = m.texte;
        const sansOutlook = h.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, '');
        // B1
        exige(h.includes(FEUILLE) && h.includes('data-vv="fond"') && h.includes('data-vv="carte"') && h.includes('data-vv="tete"'), `B1 ${n} : la forme commune (mail-verre.js) n’est pas utilisée`);
        // B2
        const corps = sansOutlook.split(PIED)[0];
        const liens = (corps.match(/<a\s/g) || []).length;
        const pleins = (h.match(/<td[^>]*data-vv="plein"/g) || []).length;
        const vml = [...h.matchAll(/<v:roundrect\b[^>]*href="([^"]*)"[^>]*>[\s\S]*?<center[^>]*>([\s\S]*?)<\/center>/g)];
        const aHref = [...corps.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)];
        exige(liens === m.bouton && pleins === m.bouton, `B2 ${n} : ${liens} lien(s) d’action et ${pleins} bouton(s) — ${m.bouton} attendu`);
        exige(vml.length === m.bouton && (!m.bouton || (aHref[0] && vml[0][1] === aHref[0][1] && vml[0][2] === aHref[0][2])), `B2 ${n} : bouton pas « à toute épreuve » sous Outlook (VML ${vml.length}, même adresse et même mot)`);
        // B3
        const titre = (/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(h) || [])[1] || '';
        const dec = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
        exige(t.trim().length > 30 && (m.marque || t.includes(dec(titre))) && (!m.bouton || (aHref[0] && t.includes(dec(aHref[0][1])))), `B3 ${n} : texte brut vide, ou sans le titre / l’adresse du bouton`);
        // B4
        const imgs = [...h.matchAll(/<img\b[^>]*>/gi)].map((x) => x[0]);
        const bonnes = imgs.filter((i) => i.includes(`src="${V.logo}"`) && !/width="1"|height="1"/.test(i));
        exige(m.marque ? imgs.length === 0 : (imgs.length === 1 && bonnes.length === 1), `B4 ${n} : image(s) en trop (pixel espion ?) : ${imgs.map((i) => i.slice(0, 80)).join(' | ')}`);
        exige(!/background(-image)?\s*[:=]\s*["']?url\(/i.test(h.replace(FEUILLE, '')) && !/<(?:iframe|object|embed|script)\b/i.test(h), `B4 ${n} : ressource distante ou script`);
        // B5
        const attendus = [...(m.montants || []).map((x) => MT.eurosMail(x, l)), ...(m.montantsCentimes || []).map((c) => MT.eurosFr(c / 100))];
        const lus = montantsLus(t);
        // La facture : son texte brut est SON message, mot pour mot (audit-facture-en-tva F15) ;
        // le montant du PDF se lit dans le petit tableau du HTML.
        for (const a of attendus) exige((m.marque || t.includes(a)) && dec(h).includes(a), `B5 ${n} : le montant « ${a} » ne se lit pas tel quel`);
        const autres = lus.filter((x) => !attendus.includes(x));
        exige(!autres.length, `B5 ${n} : montant(s) qui ne viennent d’aucune donnée : ${autres.join(' · ')}`);
        // B6
        exige(m.sujet.trim().length > 0 && [...m.sujet].length <= 70, `B6 ${n} : sujet vide ou trop long (${[...m.sujet].length} car.) : ${m.sujet}`);
        // B7
        if (!m.marque) {
          exige(new RegExp(`<html lang="${l}"`).test(h), `B7 ${n} : lang du document`);
          exige(!/\{[a-zA-Z]+\}/.test(t + h + m.sujet), `B7 ${n} : un trou {…} n’a pas été rempli`);
          if (l !== 'fr') {
            const fr = mailsParLangue.fr.find((x) => x.id === m.id);
            exige(fr && fr.sujet !== m.sujet && !t.includes(fr.texte.split('\n')[0]), `B7 ${n} : sujet ou titre resté en français`);
          }
        }
        // B8
        const pied = sansOutlook.split(PIED)[1] || '';
        exige(m.marque ? !/VRM/.test(h.replace(/xmlns:[a-z]="[^"]*"/g, '')) : (/>vrm\.center<\/a>/.test(pied) && /VRM/.test(pied) && /vrm\.center$/m.test(t.split('\n—\n')[1] || '')), `B8 ${n} : ${m.marque ? 'VRM nommé dans la facture d’un vendeur' : 'qui envoie (VRM · vrm.center) absent du pied'}`);
        if (!m.marque) exige(/section=notifications/.test(pied) === FACULTATIFS.has(m.id), `B8 ${n} : « Gérer mes e-mails » ${FACULTATIFS.has(m.id) ? 'absent d’un e-mail facultatif' : 'sur un e-mail obligatoire'}`);
      }
    }
    return f;
  }

  // B9 — le lien de preuve d'adresse renvoyé vers la boîte n'est jamais pris pour une vente :
  // email-inbound.js reconnaît son sujet dans les cinq langues.
  const PA = await import(pathToFileURL(path.join(RACINE, 'api/_lib/preuve-adresse.js')).href);
  const inbound = require('fs').readFileSync(path.join(RACINE, 'api/email-inbound.js'), 'utf8');
  const reconnus = (PA.SUJETS_PREUVE || []).filter((x) => /confirme ton adresse/i.test(x) || inbound.includes(x));
  const fautesB9 = (PA.SUJETS_PREUVE || []).length === 5 && reconnus.length === 5 ? [] : ['B9 email-inbound.js ne reconnaît pas les cinq sujets du lien de preuve d’adresse'];
  const fautes = regles(parLangue);
  fautes.push(...fautesB9);
  for (const x of fautes) console.error('❌ ' + x);
  const n = LANGUES.reduce((s, l) => s + parLangue[l].length, 0);
  if (!fautes.length) console.log(`✅ ${parLangue.fr.length} e-mails × ${LANGUES.length} langues (${n} rendus) : forme commune, un bouton à toute épreuve (VML), texte brut, aucun pixel, montants tels quels, sujets ≤ 70, cinq langues complètes, qui envoie`);
  let rouge = fautes.length;

  if (process.argv.includes('--mutations')) {
    const muter = (fn) => Object.fromEntries(LANGUES.map((l) => [l, parLangue[l].map((m) => fn({ ...m }, l))]));
    const T2 = JSON.parse(JSON.stringify(MT.TEXTES_MAIL));
    const mutations = [
      ['B1 forme commune retirée', () => regles(muter((m) => (m.id === 'preuve' ? { ...m, html: m.html.split('data-vv="carte"').join('data-x="carte"') } : m)))],
      ['B2 deux boutons', () => regles(muter((m) => (m.id === 'essai-j1' ? { ...m, html: m.html.replace(/(<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 20px">[\s\S]*?<\/table>)/, '$1$1') } : m)))],
      ['B2 bouton VML d’Outlook retiré', () => regles(muter((m) => (m.id === 'bilan' ? { ...m, html: m.html.replace(/<!--\[if mso\]><v:roundrect[\s\S]*?<!\[endif\]-->/g, '') } : m)))],
      ['B3 texte brut vide', () => regles(muter((m) => (m.id === 'mail-essai' ? { ...m, texte: '' } : m)))],
      ['B4 pixel espion', () => regles(muter((m) => (m.id === 'demande' ? { ...m, html: m.html.replace('</body>', '<img src="https://suivi.exemple.test/o.gif" width="1" height="1" alt=""></body>') } : m)))],
      ['B5 montant changé (bilan)', () => regles(muter((m) => (m.id === 'bilan' ? { ...m, texte: m.texte.split(MT.eurosMail(1842.5, 'fr')).join(MT.eurosMail(1842, 'fr')) } : m)))],
      ['B5 montant inventé', () => regles(muter((m) => (m.id === 'essai-j6' ? { ...m, texte: m.texte + '\nPrix : 16,99 €' } : m)))],
      ['B6 sujet trop long', () => regles(muter((m) => (m.id === 'avis' ? { ...m, sujet: m.sujet + ' — '.repeat(30) } : m)))],
      ['B7 clé allemande absente', () => { const T = JSON.parse(JSON.stringify(T2)); delete T.de['bilan.bouton']; return regles(parLangue, T); }],
      ['B7 sujet resté en français', () => regles(muter((m, l) => (m.id === 'essai-j3' && l === 'it' ? { ...m, sujet: parLangue.fr.find((x) => x.id === 'essai-j3').sujet } : m)))],
      ['B7 trou pas rempli', () => regles(muter((m) => (m.id === 'demande' ? { ...m, texte: m.texte + ' {quand}' } : m)))],
      ['B8 signature retirée', () => regles(muter((m) => (m.id === 'supprime' ? { ...m, html: m.html.split('>vrm.center</a>').join('></a>') } : m)))],
      ['B8 VRM dans la facture', () => regles(muter((m) => (m.id === 'facture' ? { ...m, html: m.html.replace('</body>', '<p style="margin:0">Envoyé par VRM</p></body>') } : m)))],
    ];
    for (const [nom, fn] of mutations) {
      const k = fn().length;
      if (k) console.log(`✅ mutation « ${nom} » : vue (${k})`);
      else { console.error(`❌ mutation « ${nom} » : passe inaperçue`); rouge++; }
    }
  }
  if (rouge) { console.error(`❌ ${rouge} rouge(s)`); process.exit(1); }
  console.log('OK : les e-mails de VRM sont beaux, clairs, courts et pareils, dans les cinq langues.');
})().catch((e) => { console.error('❌ l’audit a levé :', e && e.stack); process.exit(1); });
