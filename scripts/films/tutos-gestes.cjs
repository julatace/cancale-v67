// ════════════════════════════════════════════════════════════════════════════
//  LES TUTOS EN MOUVEMENT (23 nov., Julien : « fais un vrai accompagnement, n'hésite
//  pas à faire du motion design pour expliquer ») — cinq films courts (15–45 s), UN
//  geste clé chacun, tournés dans la VRAIE app (dist/) avec le monde INVENTÉ des films
//  (`_monde.cjs` : pseudos, codes, montants fabriqués — dépôt public) :
//    relier-compte · imprimer · numeroter · relier-achat · benefice
//  Le « motion design » est celui du moteur des films (`_commun.cjs`) : l'iPhone posé sur
//  la scène gris-ardoise de vrm.center, la caméra qui s'approche du geste (`viser`), le
//  doigt qui touche (`toucher` : l'onde), le défilement réel, un carton de fin.
//
//  ⚠️ AUCUN TEXTE INCRUSTÉ : sous-titres en pistes `.vtt`, cinq langues (fr en es it de),
//     la même phrase au même instant (comme la vidéo de 45 s de l'accueil).
//  ⚠️ PAS DE SON, pas de voix : rien d'imposé.
//  ⚠️ L'app est filmée dans son apparence d'aujourd'hui (CLAIRE, « toute l'app en gris
//     clair ») : à tourner APRÈS la fusion de la nouvelle apparence sur main.
//  ⚠️ `prefers-reduced-motion` : c'est le LECTEUR qui le respecte (rien ne part tout seul,
//     jamais en boucle, l'affiche fixe d'abord) — cf. src/accueil/AccueilVideo.jsx.
//
//  Sortie : 720 × 1280, H.264, 30 i/s, `+faststart`, ≤ 45 s, ≤ 1,8 Mo, affiche 360 × 640.
//    npm run build                                         # ⚠️ jamais pendant un tournage
//    FILMS_SORTIE=/hors/du/depot node scripts/films/tutos-gestes.cjs          # les cinq
//    GESTES=imprimer,benefice node scripts/films/tutos-gestes.cjs               # quelques-uns
//    PUBLIER=1 node scripts/films/tutos-gestes.cjs   # + copie dans public/aide/tutos/ (+ tutos.json)
// ════════════════════════════════════════════════════════════════════════════
'use strict';
process.env.IPS = process.env.IPS || (process.env.BROUILLON ? '6' : '30');
process.env.FILMS_ECHELLE = process.env.FILMS_ECHELLE || String(720 / 540);
process.env.FILMS_DEBIT = process.env.FILMS_DEBIT || '480k';
process.env.CRF = process.env.CRF || '30';
const path = require('path'), fs = require('fs'), crypto = require('crypto');
const { execFileSync } = require('child_process');
const { Film, lancerNavigateur, fermerServeur, sortie } = require('./_commun.cjs');
const { monde } = require('./_monde.cjs');

const RACINE = path.join(__dirname, '..', '..');
const PUBLIC = path.join(RACINE, 'public', 'aide', 'tutos');
const POIDS_MAX = 1.8 * 1024 * 1024, DUREE_MIN = 15, DUREE_MAX = 45;
const LANGUES = ['fr', 'en', 'es', 'it', 'de'];
const hms = (t) => { const ms = Math.max(0, Math.round(t * 1000)); const h = Math.floor(ms / 36e5), m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`; };

// Les phrases : courtes (une ligne sur un téléphone), ce que VRM fait VRAIMENT (CLAUDE.md §2, §3, §5).
const P = {
  // Relier un compte : l'extension, dans le navigateur de l'ordinateur, lit le compte ouvert dans l'onglet.
  'compte.1': { fr: 'Tes comptes de vente, au même endroit.', en: 'All your selling accounts, in one place.', es: 'Todas tus cuentas de venta, en un solo lugar.', it: 'Tutti i tuoi account di vendita, in un solo posto.', de: 'Alle deine Verkaufskonten an einem Ort.' },
  'compte.2': { fr: 'Sur l’ordinateur, l’extension VRM lit le compte ouvert dans l’onglet.', en: 'On your computer, the VRM extension reads the account open in the tab.', es: 'En el ordenador, la extensión VRM lee la cuenta abierta en la pestaña.', it: 'Sul computer, l’estensione VRM legge l’account aperto nella scheda.', de: 'Am Computer liest die VRM-Erweiterung das im Tab geöffnete Konto.' },
  'compte.3': { fr: 'Ouvre ton compte sur le site : il se relie tout seul.', en: 'Open your account on the site: it links itself.', es: 'Abre tu cuenta en el sitio: se vincula sola.', it: 'Apri il tuo account sul sito: si collega da solo.', de: 'Öffne dein Konto auf der Website: Es verbindet sich von selbst.' },
  'compte.4': { fr: 'Chaque compte relié, avec l’heure de sa dernière lecture.', en: 'Every linked account, with the time it was last read.', es: 'Cada cuenta vinculada, con la hora de su última lectura.', it: 'Ogni account collegato, con l’ora dell’ultima lettura.', de: 'Jedes verbundene Konto, mit der Zeit des letzten Lesens.' },
  // Imprimer ses bordereaux : Ventes → À envoyer → « Imprimer N » ; le N° tamponné.
  'impr.1': { fr: 'Ventes : en haut, les colis à envoyer.', en: 'Sales: parcels to send come first.', es: 'Ventas: arriba, los paquetes por enviar.', it: 'Vendite: in alto, i pacchi da spedire.', de: 'Verkäufe: Oben die zu versendenden Pakete.' },
  'impr.2': { fr: 'Chaque colis porte le N° de rangement de sa paire.', en: 'Each parcel shows the storage No. of its item.', es: 'Cada paquete lleva el N.º de almacenaje de su artículo.', it: 'Ogni pacco riporta il N° di magazzino del suo articolo.', de: 'Jedes Paket trägt die Lagernummer seines Artikels.' },
  'impr.3': { fr: 'Un geste : tous les bordereaux s’impriment.', en: 'One tap: all the labels print.', es: 'Un gesto: se imprimen todas las etiquetas.', it: 'Un gesto: si stampano tutte le etichette.', de: 'Ein Tipp: Alle Etiketten werden gedruckt.' },
  'impr.4': { fr: 'Le N° est tamponné dessus : tu emballes la bonne paire.', en: 'The No. is stamped on it: you pack the right item.', es: 'El N.º va sellado: empaquetas el artículo correcto.', it: 'Il N° è stampato sopra: imballi l’articolo giusto.', de: 'Die Nummer ist aufgedruckt: Du packst den richtigen Artikel.' },
  // Numéroter et ranger : chaque annonce a son N° (jamais redonné), le Stock montre où il est rangé.
  'num.1': { fr: 'Chaque annonce reçoit un N° de rangement.', en: 'Every listing gets a storage No.', es: 'Cada anuncio recibe un N.º de almacenaje.', it: 'Ogni annuncio riceve un N° di magazzino.', de: 'Jede Anzeige bekommt eine Lagernummer.' },
  'num.2': { fr: 'Écris-le sur sa boîte. Il n’est jamais redonné.', en: 'Write it on its box. It is never reused.', es: 'Escríbelo en su caja. Nunca se reutiliza.', it: 'Scrivilo sulla sua scatola. Non viene mai riassegnato.', de: 'Schreib sie auf den Karton. Sie wird nie neu vergeben.' },
  'num.3': { fr: 'Le Stock : tes boîtes rangées par N°.', en: 'Stock: your boxes, sorted by No.', es: 'Stock: tus cajas, ordenadas por N.º', it: 'Stock: le tue scatole, in ordine di N°.', de: 'Lager: deine Kartons, nach Nummer sortiert.' },
  'num.4': { fr: 'Une vente ? Le N° te dit quelle boîte ouvrir.', en: 'A sale? The No. tells you which box to open.', es: '¿Una venta? El N.º te dice qué caja abrir.', it: 'Una vendita? Il N° ti dice quale scatola aprire.', de: 'Ein Verkauf? Die Nummer sagt dir, welchen Karton du öffnest.' },
  // Relier un achat : une vente sans achat ⇒ SON clic choisit l'achat ; jamais deviné (§5).
  'achat.1': { fr: 'Une vente sans son achat : le bénéfice est inconnu.', en: 'A sale without its purchase: the profit is unknown.', es: 'Una venta sin su compra: el beneficio es desconocido.', it: 'Una vendita senza il suo acquisto: il guadagno è sconosciuto.', de: 'Ein Verkauf ohne seinen Einkauf: Der Gewinn ist unbekannt.' },
  'achat.2': { fr: 'Touche « Relier » : VRM te propose tes achats.', en: 'Tap “Link”: VRM shows your purchases.', es: 'Toca «Vincular»: VRM te muestra tus compras.', it: 'Tocca «Collega»: VRM ti propone i tuoi acquisti.', de: 'Tippe auf „Verknüpfen“: VRM zeigt deine Einkäufe.' },
  'achat.3': { fr: 'C’est toi qui choisis. VRM ne devine jamais.', en: 'You choose. VRM never guesses.', es: 'Eliges tú. VRM nunca adivina.', it: 'Scegli tu. VRM non indovina mai.', de: 'Du wählst. VRM rät nie.' },
  'achat.4': { fr: 'Le prix d’achat est relié : le bénéfice se calcule.', en: 'The purchase price is linked: the profit is worked out.', es: 'El precio de compra queda vinculado: se calcula el beneficio.', it: 'Il prezzo d’acquisto è collegato: il guadagno si calcola.', de: 'Der Einkaufspreis ist verknüpft: Der Gewinn wird berechnet.' },
  // Lire son bénéfice : Argent ; ce qui manque est dit (« au moins », « sur N »), jamais 0 pour « pas su ».
  'ben.1': { fr: 'Argent : ce que tu as vendu ce mois-ci.', en: 'Money: what you sold this month.', es: 'Dinero: lo que vendiste este mes.', it: 'Soldi: quanto hai venduto questo mese.', de: 'Geld: was du diesen Monat verkauft hast.' },
  'ben.2': { fr: 'Le bénéfice : ventes moins prix d’achat et frais.', en: 'Profit: sales minus purchase prices and fees.', es: 'Beneficio: ventas menos precios de compra y comisiones.', it: 'Guadagno: vendite meno prezzi d’acquisto e commissioni.', de: 'Gewinn: Verkäufe minus Einkaufspreise und Gebühren.' },
  'ben.3': { fr: 'Un prix d’achat manque ? VRM le dit, à côté du chiffre.', en: 'A purchase price missing? VRM says so, next to the figure.', es: '¿Falta un precio de compra? VRM lo dice, junto a la cifra.', it: 'Manca un prezzo d’acquisto? VRM lo dice, accanto alla cifra.', de: 'Fehlt ein Einkaufspreis? VRM sagt es, neben der Zahl.' },
  'ben.4': { fr: 'Et le reçu, à la date du versement : ce qu’on déclare.', en: 'And what you received, dated on payout: what you declare.', es: 'Y lo cobrado, en la fecha del pago: lo que se declara.', it: 'E l’incassato, alla data del versamento: quello che si dichiara.', de: 'Und das Erhaltene, zum Auszahlungsdatum: das, was du angibst.' },
  fin: { fr: 'VRM : tes ventes, tes colis et ta compta, au même endroit.', en: 'VRM: your sales, parcels and accounts, in one place.', es: 'VRM: tus ventas, paquetes y cuentas, en un solo lugar.', it: 'VRM: vendite, pacchi e contabilità, in un solo posto.', de: 'VRM: Verkäufe, Pakete und Buchhaltung an einem Ort.' },
};

// La première cible PRÉSENTE parmi plusieurs (les écrans changent : un tuto ne tombe pas pour un attribut renommé,
// il prend la cible suivante — et le dit s'il n'en trouve aucune).
async function une(f, sels) {
  for (const s of sels) { const ok = await f.app.evaluate((x) => !!window.__filmQ(x), s).catch(() => false); if (ok) return s; }
  console.log(`  (aucune cible parmi : ${sels.join(' | ')})`); return null;
}
async function voir(f, sels, o = {}) { const s = await une(f, sels); if (!s) return null; if (o.defiler !== false) await f.defilerVers(s, { marge: o.marge || 160, dur: 0.9 }); await f.viser(s, { zoom: o.zoom || 1.38, dur: o.dur || 1.0, dy: o.dy || 0 }); return s; }
async function entree(f) { f.telY = f.F.h; f.telOpacite = 0; await f.jouer(0.3); await f.entree(1.0); await f.jouer(0.4); f.cle('apercu'); }
// La feuille d'impression du système et le lecteur PDF de Chromium sans écran : coupés (rien d'autre ne change).
async function sansImpression(f) {
  await f.app.evaluate(() => {
    window.print = () => {};
    const sa = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (n, v) { if (this.tagName === 'IFRAME' && n === 'src' && /^blob:/.test(String(v))) return; return sa.call(this, n, v); };
    const d = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    Object.defineProperty(HTMLIFrameElement.prototype, 'src', { get: d.get, set(v) { if (/^blob:/.test(String(v))) return; d.set.call(this, v); }, configurable: true });
  });
}

const GESTES = {
  'relier-compte': { tab: 'vintedaccounts', async jouer(f, dire) {
    dire('compte.1'); await entree(f);
    await voir(f, ['[data-comptes-lies]', '[data-compte-vendeur]', 'texte:vendeuse_a'], { zoom: 1.3 });
    await f.jouer(2.6);
    dire('compte.2');
    await voir(f, ['texte:extension', 'texte:Extension', '[data-compte-action]'], { zoom: 1.3 });
    await f.jouer(3.6);
    dire('compte.3');
    await voir(f, ['[data-compte-action]', 'texte:Relier', 'texte:Ajouter un compte'], { zoom: 1.38 });
    await f.jouer(3.6); f.cle('relier');
    dire('compte.4'); f.repos_(0.8);
    await voir(f, ['[data-compte-puce]', 'texte:vendeuse_b', '[data-comptes-lies]'], { zoom: 1.3 });
    await f.jouer(3.4);
    dire('fin'); await f.fin('vrm.center', 3.0);
  } },
  imprimer: { tab: 'ventes', async preparer(f) { await sansImpression(f); }, async jouer(f, dire) {
    dire('impr.1'); await entree(f);
    await voir(f, ['[data-imprimer-prets]', 'texte:À envoyer'], { zoom: 1.3, dy: -160, defiler: false });
    await f.jouer(2.4);
    dire('impr.2');
    await voir(f, ['texte:N°', '[data-carte-vente]'], { zoom: 1.45, dy: -40 });
    await f.jouer(3.2); f.cle('numero');
    dire('impr.3');
    const b = await voir(f, ['[data-imprimer-prets]', 'texte:Imprimer'], { zoom: 1.38 });
    if (b) await f.toucher(b, { avant: 0.4, apres: 0.5, clic: true });   // (24 nov.) le bouton fixe du bas reçoit un vrai clic
    await f.attendreQue('[data-impr-papier-choix="normale"]', 4);
    f.repos_(0.8); await f.jouer(2.0); f.cle('imprimer');
    dire('impr.4');
    const c = await voir(f, ['[data-impr-papier-choix="normale"]'], { zoom: 1.3, defiler: false });
    await f.jouer(1.6);
    if (c) await f.toucher(c, { avant: 0.3, apres: 0.3 });
    await f.jouer(1.6);
    dire('fin'); await f.fin('vrm.center', 3.0);
  } },
  numeroter: { tab: 'annonces', async jouer(f, dire) {
    dire('num.1'); await entree(f);
    // (24 nov.) Les listes arrivent par paquets : la rangée visée (N°4, `data-eg-article`) est DÉJÀ à l'écran, pas une 16e encore à venir.
    await voir(f, ['[data-eg-article="vinted#7103"]', '0@[data-ad-rangee]', '0@[data-carte-annonce]'], { zoom: 1.38, marge: 120 });
    await f.jouer(3.0); f.cle('numero');
    dire('num.2');
    await voir(f, ['[data-eg-article="vinted#7103"] .n-plaque', '0@[data-ad-rangee] .n-plaque', '0@[data-carte-annonce] [data-num]'], { zoom: 1.6, defiler: false });
    await f.jouer(3.4);
    dire('num.3'); f.repos_(0.8); await f.jouer(0.6);
    // (24 nov.) Au téléphone, le Stock n'est plus dans la barre du bas : on le montre s'il y est, sinon on y va (coupe : fondu enchaîné, aucune image noire).
    const st = await une(f, ['[data-n-onglet="garage"]', '[data-onglet="garage"]', 'a[href*="tab=garage"]']);
    if (st) await f.toucher(st, { apres: 0.6 }); else await f.coupe(null, { tab: 'garage', fondu: 0.6 });
    await f.attendreQue('[data-garage], [data-stock], h1', 4);
    await voir(f, ['[data-case-num]', '[data-stock-case]', 'texte:16'], { zoom: 1.3 });
    await f.jouer(3.2); f.cle('stock');
    dire('num.4'); f.repos_(0.8); await f.jouer(3.0);
    dire('fin'); await f.fin('vrm.center', 3.0);
  } },
  // (24 nov.) Le monde du tuto : la vente N°23 sans prix d'achat, son achat reçu à relier (`achatARelier`, _monde.cjs).
  'relier-achat': { tab: 'ventes', monde: { achatARelier: true }, async jouer(f, dire) {
    dire('achat.1'); await entree(f);
    await voir(f, ['[data-vt-relier="libre"]', 'texte:Prix d’achat', '[data-carte-vente]'], { zoom: 1.45, dy: -40 });
    await f.jouer(3.2);
    dire('achat.2');
    const r = await une(f, ['[data-vt-relier="libre"]', 'texte:Relier', '[data-relier-ouvrir]']);
    if (r) await f.toucher(r, { avant: 0.4, apres: 0.6 });
    await f.attendreQue('[data-relier-feuille]', 4);
    f.repos_(0.8); await f.jouer(1.6); f.cle('feuille');
    dire('achat.3');
    const a = await voir(f, ['[data-relier-feuille] [data-la-relier]', '[data-relier-feuille] [data-relier-achat]', '[data-relier-feuille] button'], { zoom: 1.3 });
    await f.jouer(2.4);
    if (a) await f.toucher(a, { avant: 0.4, apres: 0.6 });
    const oui = await une(f, ['[data-relier-feuille] [data-la-oui]']);
    if (oui) { await f.viser(oui, { zoom: 1.3, dur: 0.8 }); await f.jouer(1.0); await f.toucher(oui, { avant: 0.3, apres: 0.6 }); }
    dire('achat.4'); f.repos_(0.8); await f.jouer(3.4); f.cle('relie');
    dire('fin'); await f.fin('vrm.center', 3.0);
  } },
  // (24 nov.) Ventes d'abord (hors champ) : Argent montre alors les chiffres calculés, pas « Pas encore calculé ».
  benefice: { tab: ['ventes', 'compta'], async jouer(f, dire) {
    dire('ben.1'); await entree(f);
    await voir(f, ['texte:Vendu', '[data-fu-case="vendu-mois"]'], { zoom: 1.38 });
    await f.jouer(3.0); f.cle('vendu');
    dire('ben.2');
    await voir(f, ['texte:Bénéfice'], { zoom: 1.38 });
    await f.jouer(3.4);
    dire('ben.3');
    await voir(f, ['texte:prix d’achat à saisir', 'texte:prix d’achat manquants', 'texte:Bénéfice'], { zoom: 1.5 });
    await f.jouer(3.4); f.cle('manque');
    dire('ben.4');
    await voir(f, ['texte:Reçu', 'texte:Déclarer'], { zoom: 1.38 });
    await f.jouer(3.4);
    dire('fin'); await f.fin('vrm.center', 3.0);
  } },
};

function vtt(cues, duree, l) {
  const out = ['WEBVTT', ''];
  cues.forEach((c, i) => {
    const fin = Math.min(duree, cues[i + 1] ? cues[i + 1].t : duree);
    out.push(String(i + 1), `${hms(c.t)} --> ${hms(fin)}`, P[c.cle][l], '');
  });
  return out.join('\n');
}

async function tournerUn(nav, cle) {
  const g = GESTES[cle];
  const f = new Film({ nom: 'tuto-' + cle, format: 'portrait', monde: monde(g.monde || {}), tab: g.tab });
  await f.demarrer(nav);
  if (g.preparer) await g.preparer(f);
  const dossier = sortie('tutos');
  const fichier = path.join(dossier, `${cle}.mp4`);
  const cues = [];
  await f.enregistrer(fichier);
  try { await g.jouer(f, (c) => cues.push({ cle: c, t: f.t })); }
  catch (e) { try { f.ff.kill('SIGKILL'); } catch (_) {} try { await f.ctx.close(); } catch (_) {} throw e; }
  const r = await f.finir();
  for (const l of LANGUES) fs.writeFileSync(path.join(dossier, `${cle}.${l}.vtt`), vtt(cues, r.duree, l));
  const cles = fs.readdirSync(dossier).filter((x) => x.startsWith(`${cle}-cle`) && x.endsWith('.png')).sort();
  if (cles.length) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', path.join(dossier, cles[0]), '-vf', 'scale=360:640', '-q:v', '6', path.join(dossier, `${cle}.jpg`)]);
  let audio = '';
  try { audio = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', fichier]).toString().trim(); } catch (_) { audio = '?'; }
  const ok = r.poids <= POIDS_MAX && r.duree >= DUREE_MIN && r.duree <= DUREE_MAX + 0.05 && audio === '' && fs.existsSync(path.join(dossier, `${cle}.jpg`));
  console.log(`${ok ? '✅' : '❌'} ${cle} : ${r.duree.toFixed(1)} s, ${(r.poids / 1048576).toFixed(2)} Mo, son : ${audio === '' ? 'aucun' : audio}${r.erreurs.length ? ' — erreurs de page : ' + r.erreurs.join(' | ') : ''}`);
  return { cle, ok, duree: r.duree, dossier };
}

if (require.main === module) {
  (async () => {
    const voulus = String(process.env.GESTES || Object.keys(GESTES).join(',')).split(',').map((x) => x.trim()).filter((x) => GESTES[x]);
    const res = [];
    // Un navigateur neuf par film (l'horloge figée d'un tournage ne se rembobine pas pour le suivant).
    for (const cle of voulus) { const nav = await lancerNavigateur(); try { res.push(await tournerUn(nav, cle)); } finally { await nav.close(); fermerServeur(); } }
    const bons = res.filter((r) => r.ok);
    if (process.env.PUBLIER && !process.env.BROUILLON && bons.length) {
      fs.mkdirSync(PUBLIC, { recursive: true });
      const reg = path.join(PUBLIC, 'tutos.json');
      let r = {}; try { r = JSON.parse(fs.readFileSync(reg, 'utf8')); } catch (_) { r = {}; }
      const h = (p) => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
      const { empreinteDesign } = require('../_empreinte-design.cjs');
      for (const b of bons) {
        for (const x of ['mp4', 'jpg', ...LANGUES.map((l) => `${l}.vtt`)]) fs.copyFileSync(path.join(b.dossier, `${b.cle}.${x}`), path.join(PUBLIC, `${b.cle}.${x}`));
        r[b.cle] = { mp4: h(path.join(PUBLIC, `${b.cle}.mp4`)), jpg: h(path.join(PUBLIC, `${b.cle}.jpg`)), duree: Number(b.duree.toFixed(1)), design: empreinteDesign(), modeExemple: true };
      }
      fs.writeFileSync(reg, JSON.stringify(r, null, 1) + '\n');
    }
    if (bons.length !== res.length) process.exitCode = 1;
  })().catch((e) => { console.error(e); process.exit(1); });
}
module.exports = { P, GESTES, LANGUES };
