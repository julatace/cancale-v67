#!/usr/bin/env node
// AUDIT : une offre reçue par email doit rendre LE BON MONTANT et l'acheteur.
// ⚠️ Mesuré le 23 août sur les 184 offres archivées : le pseudo de l'acheteur
// était vide sur TOUTES, et le montant sur une bonne partie — soit parce que le
// `text` de l'email n'était qu'une feuille de style, soit parce que la règle
// prenait le PREMIER € du message (donc le prix de l'article, pas l'offre).
// Une offre expire en 24 h : un montant faux vaut moins que pas de montant.
const path = require('path'), fs = require('fs');
let ko = 0;
const ok = (t) => console.log('✅ ' + t);
const nok = (t, d) => { ko++; console.log('❌ ' + t + (d ? ' — ' + d : '')); };

// On découpe les règles telles qu'elles sont dans le fichier (pas de copie).
const SRC = fs.readFileSync(path.resolve(__dirname, '../api/email-inbound.js'), 'utf8');
const bloc = SRC.slice(SRC.indexOf('const montant =\n'), SRC.indexOf("       || '';", SRC.indexOf('const qui =')) + 13);
if (!/const montant =/.test(bloc) || !/const qui =/.test(bloc)) { console.log('❌ règles introuvables dans api/email-inbound.js'); process.exit(1); }
const lire = new Function('textAll', bloc.replace(/\/\/[^\n]*/g, '') + '\nreturn { montant, qui };');

const T = (nom, texte, mAttendu, qAttendu) => {
  let r; try { r = lire(texte); } catch (e) { return nok(nom, 'erreur ' + e.message); }
  const pbs = [];
  if (String(r.montant) !== String(mAttendu)) pbs.push(`montant « ${r.montant || '(vide)'} » au lieu de « ${mAttendu} »`);
  if (qAttendu != null && String(r.qui) !== String(qAttendu)) pbs.push(`acheteur « ${r.qui || '(vide)'} » au lieu de « ${qAttendu} »`);
  pbs.length ? nok(nom, pbs.join(' · ')) : ok(`${nom} → ${r.montant} € de ${r.qui || '(anonyme)'}`);
};

// ⚠️ LE CAS QUI COMPTE : le prix de l'article apparaît AVANT l'offre.
T("le prix de l'article vient avant l'offre",
  "Nouvelle offre pour nike zoom fly 5\nPrix affiché : 45,00 €\nmarie35 t'a fait une offre de 30,00 € pour ton article", '30,00', 'marie35');
T('formulation « t’a fait une offre de X € »',
  "tomj683 t'a fait une offre de 28,00 € pour nike zoom fly 5", '28,00', 'tomj683');
T('apostrophe typographique',
  "lolanisse t’a envoyé une offre de 23,50 € pour adidas spezial", '23,50', 'lolanisse');
T('« propose 25 € »',
  "Un acheteur propose 25,00 € pour ton article\nPrix : 40,00 €", '25,00', null);
T('« 32 € au lieu de 45 € »',
  "Offre reçue : 32,00 € au lieu de 45,00 €", '32,00', null);
T('« de la part de »',
  "Nouvelle offre de la part de julien_c\nMontant de l'offre : 19,00 €", '19,00', 'julien_c');
T('« a fait une offre » (3e personne)',
  "shop_cancale a fait une offre\nOffre : 12,50 €", '12,50', 'shop_cancale');
T('repli : un seul montant dans le message',
  "Tu as reçu une proposition\n17,00 €", '17,00', null);

// Une feuille de style ne doit jamais fournir un montant.
const css = "body { margin: 0 !important; font-size: 14px; } .btn { padding: 10px; }";
const r = lire(css);
(!r.montant && !r.qui) ? ok("du CSS ne fabrique ni montant ni acheteur")
                       : nok("du CSS ne fabrique ni montant ni acheteur", `montant « ${r.montant} », acheteur « ${r.qui} »`);

// Et le handler doit partir du texte utile, pas du `text` brut.
/const corpsTexte = texteUtile\(mail\);/.test(SRC) && !/mail\.text \|\| htmlToText\(mail\.html\)/.test(SRC)
  ? ok('toutes les branches lisent le même texte utile (jamais une feuille de style)')
  : nok('toutes les branches lisent le même texte utile', 'une branche lit encore `mail.text` brut');

console.log(ko ? `\n${ko} offre(s) mal lues.` : '\nLes offres sont lues correctement.');
process.exit(ko ? 1 : 0);
