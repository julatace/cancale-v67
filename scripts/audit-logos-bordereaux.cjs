// ═══════════════════════════════════════════════════════════════════════════
//  LE LOGO DU BORDEREAU (11 nov., lot DJ3)
//  Julien : « Les logos des transporteurs ne sont pas tous bons, je veux ceux qui sont sur les
//  bordereaux ; tu mets InPost mais InPost appartient à Mondial Relay. »
//  Mesuré sur sa base (lecture seule, 11 nov.) : ses e-mails signent « L’équipe Mondial Relay by
//  InPost » ; 19 étiquettes Vinted ne nomment qu'« InPost » (rangées `inpost` dans
//  `vrm_bord_transporteurs`), 3 « Mondial Relay », 8 en nommaient « plusieurs » (rien posé).
//  Règle : en France, « InPost » = le réseau Mondial Relay ⇒ la clé `mondialrelay`, donc le logo
//  Mondial Relay — à la lecture (PDF, e-mail du bordereau, e-mail de suivi) ET à l'affichage (une
//  clé `inpost` rangée avant). Rien d'autre ne change : Chronopost, Colissimo, Vinted Go… restent.
//  EXÉCUTE les vrais modules (src/transporteursVisuels.js, src/colisEnvoyes.js,
//  api/_lib/transporteur-bordereau.js, api/_lib/transporteur-pdf.js) et la fonction `carrierKey`
//  extraite d'App.jsx. `AUDIT_RACINE=dossier` : juger un autre arbre (origin/main, une mutation).
// ═══════════════════════════════════════════════════════════════════════════
const path = require('path'), fs = require('fs');
const R = process.env.AUDIT_RACINE || path.join(__dirname, '..');
let ko = 0, ok = 0;
const dit = (bon, quoi, detail) => { if (bon) { ok++; console.log(`✅ ${quoi}`); } else { ko++; console.log(`❌ ${quoi}${detail != null ? ' — ' + detail : ''}`); } };
const essaie = async (nom, f) => { try { await f(); } catch (e) { dit(false, nom, 'a levé : ' + String(e && e.message || e).slice(0, 200)); } };
const imp = (rel) => import('file://' + path.join(R, rel));
(async () => {
  await essaie('A cleTransporteur', async () => {
    const V = await imp('src/transporteursVisuels.js');
    dit(V.cleTransporteur('InPost') === 'mondialrelay', 'A « InPost » ⇒ Mondial Relay (le logo du bordereau)', V.cleTransporteur('InPost'));
    dit(V.cleTransporteur('inpost') === 'mondialrelay', 'A une clé `inpost` rangée avant est relue Mondial Relay', V.cleTransporteur('inpost'));
    dit(V.cleTransporteur('Mondial Relay by InPost') === 'mondialrelay', 'A « Mondial Relay by InPost » ⇒ Mondial Relay', V.cleTransporteur('Mondial Relay by InPost'));
    for (const [txt, k] of [['Chronopost', 'chronopost'], ['Colissimo', 'colissimo'], ['Vinted Go', 'vinted'], ['Relais Colis', 'relaiscolis'], ['DPD', 'dpd'], ['UPS', 'ups'], ['GLS', 'gls'], ['Shop2Shop', 'shop2shop'], ['Colis Privé', 'colisprive']]) dit(V.cleTransporteur(txt) === k, `A « ${txt} » reste ${k}`, V.cleTransporteur(txt));
    const m = V.marqueDuTransporteur(V.cleTransporteur('InPost'));
    dit(!!(m && /<path/.test(m.svg || '') && m.fond === '#C90547'), 'A le dessin montré pour « InPost » est le tracé Mondial Relay (framboise)', m && m.fond);
    for (const k of ['mondialrelay', 'chronopost', 'colissimo', 'relaiscolis', 'ups', 'dpd', 'gls', 'colisprive', 'inpost', 'vinted', 'shop2shop', 'laposte']) dit(!!(V.DESSINS_TRANSPORTEURS[k] && V.DESSINS_TRANSPORTEURS[k].svg), `A un dessin SVG pour ${k} (planche)`);
    dit(!/https?:\/\//.test(JSON.stringify(V.DESSINS_TRANSPORTEURS).replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'A aucun dessin ne charge quoi que ce soit (aucune adresse)');
  });
  await essaie('B bordereau', async () => {
    const B = await imp('api/_lib/transporteur-bordereau.js');
    dit(B.transporteurDeTexteBordereau('Votre bordereau Mondial Relay by InPost est prêt') === 'mondialrelay', 'B e-mail du bordereau « Mondial Relay by InPost » ⇒ Mondial Relay (plus « plusieurs »)', B.transporteurDeTexteBordereau('Votre bordereau Mondial Relay by InPost est prêt'));
    dit(B.transporteurDeTexteBordereau('Dépose ton colis InPost') === 'mondialrelay', 'B « InPost » seul ⇒ Mondial Relay', B.transporteurDeTexteBordereau('Dépose ton colis InPost'));
    dit(B.transporteurDeTexteBordereau('Mondial Relay ou Chronopost') === '', 'B deux transporteurs vraiment différents ⇒ rien (jamais deviné)');
    const P = await imp('api/_lib/transporteur-pdf.js');
    const d1 = P.decisionTexteBordereau('InPost  Expéditeur  Destinataire  N° colis 12345678');
    dit(d1.etat === 'ok' && d1.t === 'mondialrelay', 'B étiquette PDF qui ne nomme qu’« InPost » ⇒ Mondial Relay', JSON.stringify(d1));
    const d2 = P.decisionTexteBordereau('Mondial Relay  InPost  N° de suivi 12345678');
    dit(d2.etat === 'ok' && d2.t === 'mondialrelay' && d2.s === '12345678', 'B étiquette « Mondial Relay » + « InPost » ⇒ Mondial Relay et son n° (plus « plusieurs »)', JSON.stringify(d2));
  });
  await essaie('C vente', async () => {
    const E = await imp('src/colisEnvoyes.js');
    const t = E.transporteurDeVente({ pdf: { t: 'inpost' } });
    dit(t.cle === 'mondialrelay' && t.source === 'pdf', 'C une vente dont l’étiquette était rangée `inpost` montre Mondial Relay', JSON.stringify(t));
    const c = E.transporteurDeVente({ pdf: { t: 'chronopost' } });
    dit(c.cle === 'chronopost', 'C une étiquette Chronopost reste Chronopost', JSON.stringify(c));
  });
  await essaie('D app et route', async () => {
    const app = fs.readFileSync(path.join(R, 'src/App.jsx'), 'utf8');
    const m = /const carrierKey = \(raw\) => \{[\s\S]*?\n\};/.exec(app);
    dit(!!m, 'D `carrierKey` trouvée dans App.jsx');
    if (m) { const carrierKey = new Function(m[0] + '\nreturn carrierKey;')();
      dit(carrierKey('InPost') === 'mondialrelay', 'D l’app (`carrierKey`) range « InPost » en Mondial Relay', carrierKey('InPost'));
      dit(carrierKey('Chronopost') === 'chronopost' && carrierKey('Vinted Go') === 'vinted', 'D Chronopost et Vinted Go inchangés'); }
    const route = fs.readFileSync(path.join(R, 'api/email-inbound.js'), 'utf8');
    dit(/\/inpost\/\.test\(carrierSrc\) \? 'mondialrelay'/.test(route), 'D la route des e-mails range un e-mail « InPost » en Mondial Relay');
  });
  console.log(ko ? `\n❌ audit-logos-bordereaux : ${ko} rouge(s), ${ok} vert(s)` : `\n✅ audit-logos-bordereaux : ${ok} verts — le logo est celui du bordereau`);
  process.exit(ko ? 1 : 0);
})();
