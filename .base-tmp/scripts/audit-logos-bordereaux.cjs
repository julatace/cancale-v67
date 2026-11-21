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
    dit(!!(m && /<path/.test(m.svg || '') && m.svg === V.DESSINS_TRANSPORTEURS.mondialrelay.svg && m.fond === V.DESSINS_TRANSPORTEURS.mondialrelay.fond), 'A le dessin montré pour « InPost » est le tracé Mondial Relay (framboise)', m && m.fond);
    // (11 nov., photos de VRAIS bordereaux) Mondial Relay : framboise (teinte 320–345°), point + « r » blancs, petit carré rose ;
    // Chronopost ET Shop2Shop : le cube (un hexagone encre, aucun mot-symbole écrit) ; « InPost » s'appelle Mondial Relay.
    const teinte = (h) => { const r = parseInt(h.slice(1, 3), 16) / 255, g = parseInt(h.slice(3, 5), 16) / 255, b = parseInt(h.slice(5, 7), 16) / 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return -1; let t = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; t *= 60; return t < 0 ? t + 360 : t; };
    const dmr = V.DESSINS_TRANSPORTEURS.mondialrelay;
    dit(teinte(dmr.fond) >= 320 && teinte(dmr.fond) <= 345 && (dmr.svg.match(/<circle/g) || []).length === 1 && /<rect/.test(dmr.svg) && !/<text/.test(dmr.svg), 'A Mondial Relay = le logo du bordereau (framboise, point, « r », carré)', dmr.fond);
    for (const k of ['chronopost', 'shop2shop']) { const d = V.DESSINS_TRANSPORTEURS[k]; dit(!!d && !/<text/.test(d.svg) && /M20 0L40 11V30\.5L20 42L0 30\.5V11Z/.test(d.svg) && V.DESSINS_TRANSPORTEURS.chronopost.svg === V.DESSINS_TRANSPORTEURS.shop2shop.svg, `A ${k} = le cube Chronopost du bordereau (aucun mot-symbole)`, d && d.svg.slice(0, 60)); }
    dit(V.TRANSPORTEURS.inpost.nom === 'Mondial Relay' && V.TRANSPORTEURS.shop2shop.nom === 'Chronopost Shop2Shop', 'A les noms : « InPost » ⇒ Mondial Relay, « Shop2Shop » ⇒ Chronopost Shop2Shop', V.TRANSPORTEURS.inpost.nom + ' / ' + V.TRANSPORTEURS.shop2shop.nom);
    for (const k of ['mondialrelay', 'chronopost', 'colissimo', 'relaiscolis', 'ups', 'dpd', 'gls', 'colisprive', 'inpost', 'vinted', 'shop2shop', 'laposte']) dit(!!(V.DESSINS_TRANSPORTEURS[k] && V.DESSINS_TRANSPORTEURS[k].svg), `A un dessin SVG pour ${k} (planche)`);
    dit(!/https?:\/\//.test(JSON.stringify(V.DESSINS_TRANSPORTEURS).replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')), 'A aucun dessin ne charge quoi que ce soit (aucune adresse)');
    // (13 nov., Julien : « les logos Chronopost ne sont pas bons, ils ne doivent pas être jaunes ») On juge les COULEURS
    // (teinte calculée), pas l'orthographe : la tuile Chronopost (et Shop2Shop, le même cube) n'est pas jaune, son cube est
    // bleu ; aucun dessin ne porte un rouge (réservé au doublon de N°, §7) ni un violet (refusé, §3) — les mêmes définitions
    // que `audit-rouge-doublon` et `audit-violet` ; la tuile `marque` et le dessin ont le même fond (une seule vérité).
    const hslDe = (h) => { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); let [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; let t = 0, s = 0; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); t = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; t *= 60; } return { t, s, l, c: mx - mn }; };
    const jaune = (h) => { const x = hslDe(h); return x.t >= 40 && x.t <= 65 && x.s >= 0.5 && x.l >= 0.3 && x.l <= 0.85; };
    const rouge = (h) => { const x = hslDe(h); return (x.t >= 345 || x.t <= 12) && x.s >= 0.45 && x.l >= 0.25 && x.l <= 0.75; };
    const violet = (h) => { const x = hslDe(h); return x.t >= 260 && x.t <= 320 && x.s >= 0.25 && x.c >= 0.12 && x.l >= 0.12 && x.l <= 0.92; };
    const couleurs = (d) => [d.fond, ...((d.svg || '').match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || [])];
    for (const k of ['chronopost', 'shop2shop']) {
      const d = V.DESSINS_TRANSPORTEURS[k], m = V.marqueDuTransporteur(k);
      const cs = couleurs(d).filter((c) => !/^#(f{3}|f{6})$/i.test(c));
      dit(!couleurs(d).some(jaune) && !jaune(m.fond), `A ${k} : aucune couleur jaune (ni la tuile, ni le dessin)`, couleurs(d).join(' '));
      const t = hslDe((/<path fill="(#[0-9a-fA-F]{6})" d="M20 0L40 11/.exec(d.svg) || [])[1] || '#000000');
      dit(t.t >= 190 && t.t <= 215 && t.s >= 0.6, `A ${k} : le cube est BLEU (teinte 190–215°, la couleur de la marque)`, `${Math.round(t.t)}° · ${cs.join(' ')}`);
    }
    for (const [k, d] of Object.entries(V.DESSINS_TRANSPORTEURS)) {
      const cs = couleurs(d);
      dit(!cs.some(rouge), `A ${k} : aucun rouge (§7 : le rouge est au doublon de N°)`, cs.filter(rouge).join(' '));
      dit(!cs.some(violet), `A ${k} : aucun violet (§3 : refusé)`, cs.filter(violet).join(' '));
      dit(!V.TRANSPORTEURS[k] || V.TRANSPORTEURS[k].marque.fond.toUpperCase() === d.fond.toUpperCase(), `A ${k} : la tuile \`marque\` et le dessin ont le même fond`, V.TRANSPORTEURS[k] && `${V.TRANSPORTEURS[k].marque.fond} ≠ ${d.fond}`);
    }
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
