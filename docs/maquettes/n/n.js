// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE N — « ZÉRO À FAIRE » — page autonome (n'importe rien de src/).
//  Une chose à la fois : l'accueil montre LA chose à faire maintenant, en grand, avec SON geste ;
//  le reste attend dessous (« Ensuite »). Quand tout est fait : « Rien à faire. » et le chiffre du jour.
//  Ventes, Achats, Annonces, Argent : des registres (une colonne N°, une colonne prix), rien d'autre.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const F = window.FIXTURE;
  const NOW = F.MAINTENANT;
  const J = 864e5;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const eur = (v, signe) => (v == null ? '—' : (signe && v > 0 ? '+' : '') + v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €');
  const nb = (n) => n.toLocaleString('fr-FR');
  const jourParis = (t) => new Date(t).toLocaleDateString('fr-CA', { timeZone: 'Europe/Paris' });
  const dj = (t) => Math.round((Date.parse(jourParis(t)) - Date.parse(jourParis(NOW))) / J);
  const heure = (t) => new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  const nomJour = (t) => { const d = dj(t); return d === 0 ? 'aujourd’hui' : d === 1 ? 'demain' : d === -1 ? 'hier' : Math.abs(d) < 7 ? new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' }) : new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }); };
  const avant = (t) => 'avant ' + nomJour(t) + (dj(t) <= 1 ? ' ' + heure(t) : '');
  const presse = (t) => Date.parse(t) - NOW < 2 * J;
  const Maj = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const annonceDe = new Map(F.annonces.map((a) => [a.id, a]));

  // Une vignette DESSINÉE (aucune photo réelle) : la silhouette d'une basket, teinte de la paire.
  const basket = (teinte, t = 72) => `<svg class="vg" width="${t}" height="${t}" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" fill="hsl(${teinte} 22% var(--vg-fond))"/><path d="M12 66c2-11 11-15 20-18l14-8c5-3 8-9 15-9 5 0 7 5 11 7 9 4 17 6 20 12 2 4 2 9 1 16H12z" fill="hsl(${teinte} 48% var(--vg-corps))"/><path d="M12 66h81l-.5 5c-15 2-58 2-78 .5-2 0-3-2-2.5-5.5z" fill="var(--vg-semelle)"/></svg>`;

  // ── LA FILE : chaque chose à faire aujourd'hui = un geste ─────────────────
  function file() {
    const t = [];
    const aPoster = F.ventes.filter((v) => v.etat === 'envoyer');
    const parJour = new Map();
    for (const v of aPoster) { const k = jourParis(v.limite); if (!parJour.has(k)) parJour.set(k, []); parJour.get(k).push(v); }
    for (const [k, l] of parJour) t.push({ cle: 'poster-' + k, sorte: 'À poster', quand: l[0].limite, titre: l.length === 1 ? l[0].titre : `${l.length} colis à poster`, paires: l, geste: l.length === 1 ? 'Imprimer le bordereau' : `Imprimer les ${l.length} bordereaux` });
    const points = new Map();
    for (const c of F.colis) { if (!points.has(c.point)) points.set(c.point, []); points.get(c.point).push(c); }
    for (const [p, l] of points) t.push({ cle: 'retirer-' + p, sorte: 'À retirer', quand: l.reduce((m, c) => (c.limite < m ? c.limite : m), l[0].limite), titre: p, adresse: l[0].adresse, colis: l, geste: l.length === 1 ? 'Colis retiré' : `Les ${l.length} colis retirés` });
    for (const o of F.offres) { const a = annonceDe.get(o.annonce); t.push({ cle: 'offre-' + o.conv, sorte: 'Offre', quand: null, date: o.date, titre: `${eur(o.montant)} pour la ${a.titre}`, offre: o, annonce: a, geste: 'Répondre' }); }
    const sansCout = F.ventes.filter((v) => v.cout == null);
    if (sansCout.length) t.push({ cle: 'prix', sorte: "Prix d'achat", quand: null, titre: `${sansCout.length} ventes sans prix d’achat`, paires: sansCout, geste: `Saisir les ${sansCout.length} prix` });
    const rang = (x) => (x.quand ? Date.parse(x.quand) : x.sorte === 'Offre' ? NOW + 5 * J - (NOW - Date.parse(x.date)) : 9e15);
    return t.sort((a, b) => rang(a) - rang(b));
  }
  const FILE = file();
  const faits = new Set();

  // ── LA ROUTE ─────────────────────────────────────────────────────────────
  const route = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)).entries());
  const aller = (x) => { location.hash = new URLSearchParams(Object.entries(x).filter(([, v]) => v != null && v !== '')).toString(); };
  window.addEventListener('hashchange', rendre);
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-aller]'); if (b) { e.preventDefault(); aller(JSON.parse(b.dataset.aller)); return; }
    const f = e.target.closest('[data-fait]'); if (f) { faits.add(f.dataset.fait); const r = route(); delete r.focus; aller({ ...r, t: Date.now() % 1e5 }); }
  });
  document.addEventListener('input', (e) => { if (e.target.matches('[data-cherche]')) { recherche = e.target.value; rendreListe(); } });
  let recherche = '';

  // ── LA NAVIGATION : quatre mots, sans icônes ────────────────────────────
  const ONGLETS = [['afaire', 'À faire'], ['commandes', 'Commandes'], ['annonces', 'Annonces'], ['argent', 'Argent']];
  function nav(actif, reste) {
    return `<nav class="nav" aria-label="Onglets">${ONGLETS.map(([k, n]) => `<a href="#ecran=${k}" class="nav-o" ${actif === k ? 'aria-current="page"' : ''} data-onglet="${k}"><span>${n}</span>${k === 'afaire' && reste ? `<span class="nav-n">${reste}</span>` : ''}</a>`).join('')}</nav>`;
  }

  // ── À FAIRE ──────────────────────────────────────────────────────────────
  function corpsTache(x, grand) {
    if (x.paires) {
      const l = x.paires.slice(0, grand ? 4 : 4);
      return `<ul class="tuiles" data-n="${l.length}">${l.map((v) => `<li class="tuile">${basket(v.teinte, 160)}<span class="tuile-n"><span class="no">N°</span>${esc(v.numero)}</span></li>`).join('')}</ul>${x.paires.length > l.length ? `<p class="encore">et ${x.paires.length - l.length} de plus</p>` : ''}`;
    }
    if (x.colis) {
      return `<ul class="codes">${x.colis.map((c) => `<li class="code"><span class="code-v" data-code="${esc(c.code)}">${esc(c.code)}</span>${c.qr ? `<span class="code-qr" data-qr-reel="">${c.qr}</span>` : `<span class="code-sans">au comptoir, avec ta pièce d’identité</span>`}<span class="code-art">${esc(F.achats.find((a) => a.tx === c.achat).titre)} · ${esc(c.transporteur)}</span></li>`).join('')}</ul>`;
    }
    if (x.offre) {
      const a = x.annonce;
      return `<div class="offre">${basket(a.teinte, 96)}<dl class="offre-dl"><div><dt>Annonce</dt><dd>${eur(a.prix)}</dd></div><div><dt>Offre</dt><dd>${eur(x.offre.montant)}</dd></div><div><dt>De</dt><dd>${esc(x.offre.pseudo)}</dd></div><div><dt>N°</dt><dd>${esc(a.numero)}</dd></div></dl></div>`;
    }
    return '';
  }
  function focus(x, i, n) {
    const urg = x.quand && presse(x.quand);
    return `<article class="focus" data-focus="${esc(x.cle)}">
      <p class="focus-meta"><span>${esc(x.sorte)}</span>${x.quand ? `<span class="${urg ? 'ambre' : ''}">${urg ? '<i class="pt"></i>' : ''}${avant(x.quand)}</span>` : x.date ? `<span>${Maj(nomJour(x.date))} à ${heure(x.date)}</span>` : ''}</p>
      <h2 class="focus-titre">${esc(x.titre)}</h2>
      ${x.adresse ? `<p class="focus-sous">${esc(x.adresse)}</p>` : ''}
      ${corpsTache(x, true)}
      <div class="focus-gestes">
        <button type="button" class="b-plein" data-plein="" data-fait="${esc(x.cle)}">${esc(x.geste)}</button>
        ${x.offre ? `<div class="b-deux"><button type="button" class="b-trait">Contre-offre</button><button type="button" class="b-trait">Refuser</button></div>` : ''}
      </div>
      ${x.paires ? `<div class="focus-detail">${x.paires.map((v) => ligne({ n: v.numero, titre: v.titre, sous: `${esc(v.compte)} · ${v.taille}`, val: eur(v.prix), etat: v.cout == null ? 'prix d’achat —' : 'acheté ' + eur(v.cout) })).join('')}</div>` : ''}
    </article>`;
  }
  function ligneTache(x, actif) {
    const urg = x.quand && presse(x.quand);
    return `<a href="#ecran=afaire&focus=${encodeURIComponent(x.cle)}" class="tache${actif ? ' is-actif' : ''}" data-tache="${esc(x.cle)}">
      <span class="tache-sorte">${esc(x.sorte)}</span><span class="tache-titre">${esc(x.titre)}</span>
      <span class="tache-quand${urg ? ' ambre' : ''}">${x.quand ? (urg ? '<i class="pt"></i>' : '') + avant(x.quand).replace(/^avant /, '') : ''}</span></a>`;
  }
  function chiffreJour() {
    const auj = F.ventes.filter((v) => dj(v.date) === 0);
    const tot = auj.reduce((t, v) => t + v.prix, 0);
    return `<div class="jour" data-chiffre-jour=""><span class="affiche">${auj.length ? eur(tot).replace(' €', '') + '<span class="eur">€</span>' : '0'}</span><span class="jour-l">${auj.length ? `vendus aujourd’hui · ${auj.length} paire${auj.length > 1 ? 's' : ''}` : 'vente aujourd’hui'}</span></div>`;
  }
  function ecranAFaire(r, large) {
    const reste = r.fait === 'tout' ? [] : FILE.filter((x) => !faits.has(x.cle));
    const date = Maj(new Date(NOW).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }));
    if (!reste.length) {
      return `<header class="tete"><p class="tete-date">${date}</p><button class="rond" aria-label="Mon profil et les réglages">J</button></header>
        <section class="rien" data-rien-a-faire=""><h1 class="rien-t">Rien à faire.</h1>${chiffreJour()}</section>`;
    }
    const i = Math.max(0, reste.findIndex((x) => x.cle === r.focus));
    const x = reste[i];
    const autres = reste.filter((y) => y !== x);
    return `<header class="tete"><p class="tete-date">${date}</p><p class="tete-compte"><b>${i + 1}</b> sur ${reste.length}</p><button class="rond" aria-label="Mon profil et les réglages">J</button></header>
      <div class="afaire">
        ${focus(x, i, reste.length)}
        <section class="ensuite" aria-label="Ensuite">
          <h2 class="t-section">${large ? 'Aujourd’hui' : 'Ensuite'}</h2>
          ${(large ? reste : autres).map((y) => ligneTache(y, large && y === x)).join('')}
          ${large ? chiffreJour() : ''}
        </section>
      </div>`;
  }

  // ── LES REGISTRES ───────────────────────────────────────────────────────
  const correspond = (...ch) => { const q = recherche.trim().toLowerCase(); return !q || ch.join(' ').toLowerCase().includes(q); };
  function tete(titres, actif, filtres, avantRecherche = '') {
    const t = titres.length > 1
      ? `<h1 class="titre bascule">${titres.map(([k, n, h]) => `<a href="${h}" class="bascule-mot" ${actif === k ? 'aria-current="true"' : ''} data-vue="${k}">${n}</a>`).join('<span class="bascule-sep" aria-hidden="true">/</span>')}</h1>`
      : `<h1 class="titre">${titres[0][1]}</h1>`;
    return `<header class="tete tete--liste">${t}<button class="rond rond-aide" aria-label="Aide">?</button></header>${avantRecherche}
      <div class="outils"><label class="cherche"><span class="cherche-l">Chercher</span><input data-cherche type="search" placeholder="un N°, un titre, un pseudo" value="${esc(recherche)}" enterkeyhint="search"></label>${filtres || ''}</div>`;
  }
  const filtres = (items, actif, ecran, extra = {}) => `<nav class="filtres" aria-label="Filtrer">${items.filter(([, , n, k]) => n !== 0 || k === actif).map(([k, nom, n]) => `<a href="#${new URLSearchParams({ ecran, ...extra, filtre: k })}" class="filtre" ${actif === k ? 'aria-current="true"' : ''} data-filtre="${k}">${nom}${n != null ? ` <span class="filtre-n">${nb(n)}</span>` : ''}</a>`).join('')}</nav>`;
  function registre(groupes, cols) {
    return `<div class="registre" data-registre="">${cols ? `<div class="reg-tete" aria-hidden="true">${cols}</div>` : ''}${groupes.filter((g) => g.l.length).map((g) => `<section class="groupe"><h2 class="t-section"><span>${esc(g.nom)}</span><span class="t-n">${g.l.length}</span></h2>${g.l.join('')}</section>`).join('') || '<p class="vide">Rien ne correspond.</p>'}</div>`;
  }
  const grouper = (l, cle) => { const g = []; for (const x of l) { const k = cle(x); let G = g.find((y) => y.nom === k); if (!G) { G = { nom: k, l: [] }; g.push(G); } G.l.push(x.html); } return g; };
  const ligne = ({ n, titre, sous, val, etat, ambre, attrs = '' }) => `<div class="ligne" ${attrs}><span class="l-no">${n ? `<span class="no">N°</span>${esc(n)}` : '<span class="l-sans">—</span>'}</span><span class="l-corps"><span class="l-titre">${esc(titre)}</span><span class="l-sous">${sous}</span></span><span class="l-etat${ambre ? ' ambre' : ''}">${etat || ''}</span><span class="l-val">${val}</span></div>`;

  const ETAT_V = { envoyer: ['à poster', true], sansbord: ['bordereau pas reçu', false], route: ['en route', false], finie: ['finie', false] };
  function ecranCommandes(r) {
    const vue = r.vue === 'achats' ? 'achats' : 'ventes';
    const titres = [['ventes', 'Ventes', '#ecran=commandes&vue=ventes'], ['achats', 'Achats', '#ecran=commandes&vue=achats']];
    if (vue === 'ventes') {
      const f = r.filtre || 'toutes';
      const aPoster = F.ventes.filter((v) => v.etat === 'envoyer');
      const l = (f === 'aposter' ? aPoster : F.ventes).filter((v) => correspond(v.titre, v.numero, v.compte, v.tx)).sort((a, b) => b.date.localeCompare(a.date))
        .map((v) => ({ v, html: ligne({ n: v.numero, titre: v.titre, sous: `${esc(v.compte)} · ${v.taille}`, val: eur(v.prix), etat: ETAT_V[v.etat][0], ambre: ETAT_V[v.etat][1], attrs: `data-vente="${v.tx}"` }) }));
      return tete(titres, vue, filtres([['toutes', 'Toutes', null], ['aposter', 'À poster', aPoster.length]], f, 'commandes', { vue }))
        + `<div data-liste>${registre(grouper(l, (x) => Maj(nomJour(x.v.date))), '<span>N°</span><span>Article</span><span>État</span><span>Prix</span>')}</div>`;
    }
    const auPoint = F.colis.filter((c) => correspond(c.code, c.point, c.suivi));
    const pts = auPoint.map((c) => `<div class="ligne ligne--code" data-colis="${c.suivi}"><span class="l-code">${esc(c.code)}</span><span class="l-corps"><span class="l-titre">${esc(F.achats.find((a) => a.tx === c.achat).titre)}</span><span class="l-sous">${esc(c.point)} · ${c.qr ? 'QR du transporteur' : 'sans QR'}</span></span><span class="l-etat${presse(c.limite) ? ' ambre' : ''}">${avant(c.limite)}</span><span class="l-val"></span></div>`);
    const ETAT_A = { point: 'au point relais', route: 'en route', recu: 'reçu' };
    const l = F.achats.filter((a) => a.etat !== 'point' && correspond(a.titre, a.compte, a.tx)).sort((a, b) => b.date.localeCompare(a.date))
      .map((a) => ({ a, html: ligne({ n: null, titre: a.titre, sous: `${esc(a.compte)} · ${a.taille}`, val: eur(a.prix), etat: ETAT_A[a.etat], attrs: `data-achat="${a.tx}"` }) }));
    return tete(titres, vue, '') + `<div data-liste><div class="registre">${pts.length ? `<section class="groupe"><h2 class="t-section"><span>Au point relais</span><span class="t-n">${pts.length}</span></h2>${pts.join('')}</section>` : ''}</div>${registre(grouper(l, (x) => Maj(nomJour(x.a.date))))}</div>`;
  }
  function ecranAnnonces(r) {
    const f = r.filtre || 'enligne';
    const dorment = F.annonces.filter((a) => a.jours > 60), sansN = F.annonces.filter((a) => !a.numero);
    const base = f === 'dorment' ? dorment : f === 'sansnum' ? sansN : F.annonces;
    const tranche = (a) => (a.jours < 7 ? 'Cette semaine' : a.jours < 30 ? 'Ce mois-ci' : a.jours < 60 ? 'Depuis plus d’un mois' : 'Depuis plus de deux mois');
    const l = base.filter((a) => correspond(a.titre, a.numero, a.compte)).sort((a, b) => a.jours - b.jours)
      .map((a) => ({ a, html: ligne({ n: a.numero, titre: a.titre, sous: `${esc(a.compte)} · ${a.taille}`, val: eur(a.prix), etat: `${a.jours ? a.jours + ' j' : 'aujourd’hui'}${a.favoris ? ' · ' + a.favoris + ' fav.' : ''}`, attrs: `data-annonce="${a.id}"` }) }));
    return tete([['a', 'Annonces']], 'a', filtres([['enligne', 'En ligne', F.annonces.length], ['dorment', 'Qui dorment', dorment.length], ['sansnum', 'Sans N°', sansN.length]], f, 'annonces'))
      + `<div data-liste>${registre(grouper(l, (x) => tranche(x.a)), '<span>N°</span><span>Article</span><span>En ligne</span><span>Prix</span>')}</div>`;
  }
  function ecranArgent() {
    const mois = new Date(NOW).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
    const verses = F.ventes.filter((v) => v.verseLe);
    const ceMois = verses.filter((v) => jourParis(v.verseLe).slice(0, 7) === jourParis(NOW).slice(0, 7));
    const tot = ceMois.reduce((t, v) => t + v.prix, 0);
    const haut = `<section class="argent"><p class="affiche affiche--argent" data-recu-mois="">${nb(tot)}<span class="eur">€</span></p><p class="jour-l">reçus en ${mois} · ${ceMois.length} versements</p>
      <dl class="deux"><div><dt>sur Vinted</dt><dd>${eur(F.portemonnaie.disponible)}</dd></div><div><dt>en attente</dt><dd>${eur(F.portemonnaie.attente)}</dd></div><div><dt>statut URSSAF</dt><dd>—</dd></div></dl></section>`;
    const l = verses.filter((v) => correspond(v.titre, v.numero, v.tx)).sort((a, b) => b.verseLe.localeCompare(a.verseLe))
      .map((v) => ({ v, html: ligne({ n: v.numero, titre: v.titre, sous: esc(v.compte), val: eur(v.prix, true), etat: 'versé', attrs: `data-versement="${v.tx}"` }) }));
    return tete([['a', 'Argent']], 'a', '', haut) + `<div data-liste>${registre(grouper(l, (x) => Maj(nomJour(x.v.verseLe))), '<span>N°</span><span>Article</span><span></span><span>Reçu</span>')}</div>`;
  }

  // ── RENDU ────────────────────────────────────────────────────────────────
  const large = () => matchMedia('(min-width: 1100px)').matches;
  function rendre() {
    const r = route();
    const e = ONGLETS.some(([k]) => k === r.ecran) ? r.ecran : 'afaire';
    const reste = r.fait === 'tout' ? 0 : FILE.filter((x) => !faits.has(x.cle)).length;
    const corps = e === 'afaire' ? ecranAFaire(r, large()) : e === 'commandes' ? ecranCommandes(r) : e === 'annonces' ? ecranAnnonces(r) : ecranArgent();
    $('#app').innerHTML = `${large() ? `<aside class="cote"><p class="marque">VRM</p>${nav(e, reste)}</aside>` : ''}<main class="main main--${e}">${corps}</main>${large() ? '' : nav(e, reste)}`;
    document.documentElement.dataset.ecran = e;
    window.scrollTo(0, 0);
  }
  function rendreListe() { const r = route(); const e = r.ecran; const tmp = document.createElement('div'); tmp.innerHTML = e === 'commandes' ? ecranCommandes(r) : e === 'annonces' ? ecranAnnonces(r) : ecranArgent(); const n = tmp.querySelector('[data-liste]'); const cible = $('[data-liste]'); if (n && cible) cible.replaceWith(n); }
  addEventListener('resize', () => rendre());
  // Le thème : celui de l'appareil, ou forcé par ?theme=sombre|clair (pour les captures).
  const th = new URLSearchParams(location.search).get('theme');
  if (th) document.documentElement.dataset.theme = th === 'sombre' ? 'dark' : 'light';
  rendre();
})();
