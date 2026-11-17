// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE J2 « Studio × Premium » (17 nov.) — page autonome, n'importe RIEN de src/.
//  Du Studio actuel : le fond bleu dégradé (et sa nuit), la barre du bas icônes + libellés, les logos de
//  plateforme et le choix du compte (UN menu sous le titre), la plaque N°, l'ambre = geste à faire.
//  De J : le chiffre en affiche (son mot sur la même ligne de base), les paires en photo, les passes
//  Wallet (un point = une carte, QR et code en grand), Annonces en grille ou en liste, UN bouton plein
//  au pouce, des filtres en mots, aucun bouton répété sur les lignes (glisser / appui long), aucun « + ».
//  Police : celle du système (SF Pro ; Inter embarquée pour les captures), chiffres tabulaires.
//  Écrans : #ecran=journee|ventes|achats|annonces|argent (&vue=, &mode=liste, &glisse=1, &fiche=<tx>) ; ?theme=clair|sombre.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const D = window.VRM_J; const { NOW, J } = D; const V = window.VRM_J_VISUELS;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
  const euros = (c, signe) => {
    if (c == null) return '—';
    const s = (Math.abs(c) / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
    return (signe ? (c < 0 ? '−' : '+') : c < 0 ? '−' : '') + s + ' €';
  };
  const quand = (t) => {
    if (t == null) return '';
    const d = new Date(t), n = new Date(NOW);
    const j0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
    const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - j0) / J);
    if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
    if (dj > 1 && dj < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  const ico = (n, t = 24) => V.ico(n, t);
  const img = (p) => `<img class="k-img" src="${V.basket(p.coloris || 0)}" alt="" loading="lazy" decoding="async">`;
  const titreDe = (p) => `${p.titre}${p.taille ? ', taille ' + p.taille : ''}`;

  // ── Calculs (sur la fixture, une seule fois) ──
  const aEnvoyer = D.ventes.filter((v) => v.etat === 'envoyer').sort((a, b) => (a.limite || a.estimee) - (b.limite || b.estimee));
  const prets = aEnvoyer.filter((v) => v.bord);
  const presse = (t) => t != null && t - NOW < 2 * J;
  const versees = D.ventes.filter((v) => v.etat === 'versee').sort((a, b) => Date.parse(b.versee) - Date.parse(a.versee));
  const debutMois = new Date(new Date(NOW).getFullYear(), new Date(NOW).getMonth(), 1).getTime();
  const ceMois = versees.filter((v) => Date.parse(v.versee) >= debutMois);
  const recuMois = ceMois.reduce((t, v) => t + v.prix, 0);
  const avecCout = ceMois.filter((v) => v.cout != null);
  const benef = avecCout.reduce((t, v) => t + v.prix - v.cout, 0);
  const sansCout = D.ventes.filter((v) => v.cout == null).length;
  const points = (() => { const g = new Map(); for (const c of D.colis) { if (!g.has(c.point)) g.set(c.point, { nom: c.point, adresse: c.adresse, colis: [] }); g.get(c.point).colis.push(c); } return [...g.values()].map((p) => ({ ...p, limite: Math.min(...p.colis.map((c) => c.limite)) })).sort((a, b) => a.limite - b.limite); })();
  const achatDe = (id) => D.achats.find((a) => a.id === id);
  const dorment = D.annonces.filter((a) => a.age > 60);

  // ── Pièces ──
  const plaque = (n) => (n ? `<span class="k-plaque" data-numero="${esc(n)}">N° ${esc(n)}</span>` : '');
  const ambre = (t) => `<span class="k-ambre"><i class="k-point" aria-hidden="true"></i>${t}</span>`;
  const limiteTexte = (v) => (v.limite ? (presse(v.limite) ? ambre('avant ' + quand(v.limite)) : 'avant ' + quand(v.limite)) : 'estimée ' + quand(v.estimee));
  const heros = (n, mot, sous) => `<section class="k-heros" data-heros><p class="k-heros-n" data-chiffre>${n}</p><div class="k-heros-txt"><p class="k-heros-mot">${mot}</p>${sous ? `<p class="k-heros-sous">${sous}</p>` : ''}</div></section>`;
  const filtres = (items, actif, lien, extra = '') => `<div class="k-filtres-ligne"><nav class="k-filtres" role="tablist">${items.map(([cle, nom]) => `<a role="tab" class="k-filtre" href="${lien(cle)}" aria-selected="${cle === actif}" data-vue="${cle}">${nom}</a>`).join('')}</nav>${extra}</div>`;
  // Une ligne : vignette 56, titre 17, sous-titre 15, valeur à droite, chevron. AUCUN bouton dedans :
  // glisser vers la gauche ⇒ ses gestes ; appui long ⇒ le menu ; toucher ⇒ la fiche.
  const ligne = (p, droite, sous, cle, glisse) => `<div class="k-ligne-cadre${glisse ? ' is-glisse' : ''}" data-ligne="${esc(cle)}">${glisse ? `<span class="k-glisse-gestes" aria-hidden="true"><span class="k-glisse-a">${ico('imprimer', 22)}Imprimer</span><span class="k-glisse-b">${ico('plus', 22)}Plus</span></span>` : ''}<a class="k-ligne" href="#"><span class="k-vignette">${img(p)}</span><span class="k-ligne-corps"><span class="k-ligne-titre">${esc(titreDe(p))}</span><span class="k-ligne-sous">${sous}</span></span><span class="k-ligne-droite">${droite}</span>${ico('chevron', 18)}</a></div>`;
  const groupe = (titre, n, corps) => `<section class="k-groupe"><h2 class="k-entete">${titre}${n != null ? `<span>${nb(n)}</span>` : ''}</h2><div class="k-porcelaine">${corps}</div></section>`;

  function qr(texte) {
    try { const q = window.qrcode(0, 'M'); q.addData(String(texte)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (_) { return ''; }
  }
  function pass(p) {
    const c = p.colis[0]; const a = achatDe(c.achat);
    return `<article class="k-pass is-devant" data-point="${esc(p.nom)}" data-devant>
      <header class="k-pass-tete"><span class="k-pass-ico">${ico('epingle', 20)}</span><span><b>${esc(p.nom)}</b><small>${esc(p.adresse)}</small></span></header>
      <p class="k-pass-avant">${presse(c.limite) ? ambre('À retirer avant ' + quand(c.limite)) : 'À retirer avant ' + quand(c.limite)}<span>${esc(c.transporteur)}</span></p>
      <div class="k-pass-qr" data-code="${esc(c.code)}">${qr(c.code)}</div>
      <p class="k-pass-code" data-chiffre>${esc(c.code)}</p>
      <div class="k-pass-pied"><span class="k-pass-vignette">${a ? img(a) : ''}</span><span><b>${esc(a ? titreDe(a) : '—')}</b><small>${esc(c.suivi)}</small></span></div>
      ${p.colis.length > 1 ? `<p class="k-pass-pages" aria-label="colis 1 sur ${p.colis.length}">${p.colis.map((_, i) => `<i class="${i ? '' : 'is-actif'}"></i>`).join('')}</p>` : ''}
    </article>`;
  }
  function pile(mini) {
    if (!points.length) return '<p class="k-vide">Rien à retirer</p>';
    const [devant, ...dos] = points;
    if (mini) {
      return `<a class="k-pile is-mini" href="#ecran=achats" data-pile>${dos.slice(0, 2).map(() => '<span class="k-pass is-dos"></span>').join('')}
        <span class="k-pass is-mini-devant"><span class="k-mini-haut"><span class="k-pass-ico">${ico('epingle', 18)}</span><b>${esc(devant.nom)}</b><span class="k-mini-code" data-chiffre>${esc(devant.colis[0].code)}</span></span><span class="k-mini-sous">${nb(D.colis.length)} colis à ${nb(points.length)} points · ${presse(devant.limite) ? ambre('le premier avant ' + quand(devant.limite)) : 'le premier avant ' + quand(devant.limite)}</span></span></a>`;
    }
    return `<div class="k-pile" data-pile>${dos.reverse().map((p) => `<a class="k-pass is-dos" href="#" data-point="${esc(p.nom)}"><span class="k-pass-ico">${ico('epingle', 18)}</span><b>${esc(p.nom)}</b><span>${nb(p.colis.length)} colis</span></a>`).join('')}${pass(devant)}</div>`;
  }
  function courbe() {
    const n = new Date(NOW).getDate(); const t = new Array(n).fill(0);
    for (const v of ceMois) { const j = new Date(v.versee).getDate() - 1; t[j] += v.prix; }
    let c = 0; const cum = t.map((v) => (c += v));
    const W = 1000, H = 120, max = Math.max(1, ...cum);
    const pts = cum.map((v, i) => [(i / (n - 1)) * (W - 24), H - 8 - (v / max) * (H - 24)]);
    let d = `M0 ${pts[0][1].toFixed(1)}`; for (let i = 1; i < pts.length; i++) d += ` H${pts[i][0].toFixed(1)} V${pts[i][1].toFixed(1)}`;
    const [lx, ly] = pts[pts.length - 1];
    return `<figure class="k-courbe" data-courbe><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d} V${H} H0 Z" class="k-courbe-aire"/><path d="${d}" class="k-courbe-trait" vector-effect="non-scaling-stroke"/></svg><span class="k-courbe-pt" style="left:${(lx / W) * 100}%;top:${(ly / H) * 100}%"></span><figcaption><span>1er nov.</span><span>aujourd’hui</span></figcaption></figure>`;
  }
  const ecartBord = () => `${nb(prets.length)} bordereaux prêts${aEnvoyer.length > prets.length ? ` · ${nb(aEnvoyer.length - prets.length)} sans bordereau` : ''}`;

  // ════════════ LES ÉCRANS ════════════
  const ECRANS = {
    journee() {
      const faire = [
        ['achats', 'À retirer', `${nb(D.colis.length)} colis à ${nb(points.length)} points`, presse(points[0] && points[0].limite), 'epingle'],
        ['argent', 'Prix d’achat à saisir', `${nb(sansCout)} ventes sans coût`, false, 'crayon'],
        ['annonces&vue=dorment', 'Qui dorment', `${nb(dorment.length)} en ligne depuis plus de 60 jours`, false, 'horloge'],
        ['annonces&vue=publier', 'À publier', `${nb(D.aPublier.length)} paires rangées`, false, 'plus'],
      ];
      return `<div class="k-ecran k-e-journee"><div class="k-col-a">
        ${heros(nb(aEnvoyer.length), 'colis à envoyer', ecartBord())}
        <div class="k-bande" data-bande>${aEnvoyer.map((v) => `<a class="k-bande-paire" href="#ecran=ventes&fiche=${v.tx}" data-ligne="v${v.tx}"><span class="k-bande-photo">${img(v)}${plaque(v.numero)}</span><span class="k-bande-prix">${euros(v.prix)}</span><span class="k-bande-quand">${v.limite ? (presse(v.limite) ? ambre(quand(v.limite)) : quand(v.limite)) : 'estimée'}</span></a>`).join('')}</div>
        <section class="k-groupe"><h2 class="k-entete">À retirer<span>${nb(D.colis.length)}</span></h2>${pile(true)}</section></div>
        <div class="k-col-b"><section class="k-groupe"><h2 class="k-entete">À faire</h2><div class="k-porcelaine">${faire.slice(1).map(([e, t, s, a, i]) => `<a class="k-ligne k-ligne-simple" href="#ecran=${e}"><span class="k-ligne-ico">${ico(i, 22)}</span><span class="k-ligne-corps"><span class="k-ligne-titre">${t}</span><span class="k-ligne-sous">${a ? ambre(s) : s}</span></span>${ico('chevron', 18)}</a>`).join('')}</div></section></div></div>`;
    },
    ventes(vue, mode, glisse) {
      vue = vue || 'envoyer';
      const f = filtres([['envoyer', 'À envoyer'], ['route', 'En route'], ['toutes', 'Toutes']], vue, (c) => `#ecran=ventes&vue=${c}`);
      if (vue === 'envoyer') {
        const g = [['Avant demain soir', aEnvoyer.filter((v) => presse(v.limite))], ['Cette semaine', aEnvoyer.filter((v) => v.limite && !presse(v.limite))], ['Date estimée', aEnvoyer.filter((v) => !v.limite)]].filter(([, l]) => l.length);
        let k = 0;
        return `<div class="k-ecran">${heros(nb(aEnvoyer.length), 'colis à envoyer', ecartBord())}${f}
          ${g.map(([t, l]) => groupe(t, l.length, l.map((v) => ligne(v, `<b>${euros(v.prix)}</b>`, `${plaque(v.numero)}<span>${v.bord ? limiteTexte(v) : ambre('bordereau attendu')}</span>`, 'v' + v.tx, glisse && k++ === 1)).join(''))).join('')}</div>`;
      }
      const l = vue === 'route' ? D.ventes.filter((v) => v.etat === 'route') : D.ventes;
      return `<div class="k-ecran">${heros(nb(l.length), vue === 'route' ? 'en route vers l’acheteur' : 'ventes ce mois')}${f}
        ${groupe('', null, l.map((v) => ligne(v, `<b>${euros(v.prix)}</b>`, `${plaque(v.numero)}<span>vendue ${quand(Date.parse(v.vendue))}</span>`, 'v' + v.tx)).join(''))}</div>`;
    },
    achats() {
      const enRoute = D.achats.filter((a) => a.etat === 'route'), arrives = D.achats.filter((a) => a.etat === 'arrive');
      return `<div class="k-ecran k-e-achats"><div class="k-col-a">${heros(nb(D.colis.length), 'colis à retirer', `à ${nb(points.length)} points relais`)}${pile(false)}</div><div class="k-col-b">
        ${groupe('En route', enRoute.length, enRoute.map((a) => ligne(a, `<b>${euros(a.prix)}</b>`, `<span>${quand(Date.parse(a.date))} · ${esc(a.vendeur)}</span>`, a.id)).join(''))}
        ${groupe('Arrivés, à numéroter', arrives.length, arrives.map((a) => ligne(a, `<b>${euros(a.prix)}</b>`, `<span>${quand(Date.parse(a.date))} · ${esc(a.vendeur)}</span>`, a.id)).join(''))}
        </div></div>`;
    },
    annonces(vue, mode) {
      vue = vue || 'enligne';
      const l = vue === 'dorment' ? dorment.slice().sort((a, b) => b.age - a.age) : vue === 'publier' ? D.aPublier : D.annonces.slice().sort((a, b) => a.age - b.age);
      const mot = vue === 'dorment' ? 'en ligne depuis plus de 60 jours' : vue === 'publier' ? 'paires rangées à publier' : 'annonces en ligne';
      const liste = mode === 'liste';
      const bascule = `<a class="k-rond" href="#ecran=annonces&vue=${vue}${liste ? '' : '&mode=liste'}" aria-label="${liste ? 'Voir en grille' : 'Voir en liste'}" data-bascule>${ico(liste ? 'grille' : 'liste', 22)}</a>`;
      const f = filtres([['enligne', 'En ligne'], ['dorment', 'Qui dorment'], ['publier', 'À publier']], vue, (c) => `#ecran=annonces&vue=${c}${liste ? '&mode=liste' : ''}`, bascule);
      const meta = (a) => (a.age != null ? `${a.age > 60 ? ambre(a.age + ' j') : a.age + ' j'}${a.fav ? `<span class="k-fav">${ico('coeur', 14)}${a.fav}</span>` : ''}` : `case ${esc(a.case)}`);
      const corps = liste
        ? groupe('', null, l.map((a) => ligne(a, `<b>${a.prix != null ? euros(a.prix) : '—'}</b>`, `${plaque(a.numero)}<span class="k-meta">${meta(a)}</span>`, a.id)).join(''))
        : `<div class="k-grille" data-grille>${l.map((a) => `<a class="k-tuile" href="#" data-ligne="${a.id}"><span class="k-tuile-photo">${img(a)}${plaque(a.numero)}</span><span class="k-tuile-texte"><span class="k-tuile-haut"><b>${a.prix != null ? euros(a.prix) : 'achat ' + euros(a.cout)}</b><span class="k-meta">${meta(a)}</span></span><span class="k-tuile-titre">${esc(titreDe(a))}</span></span></a>`).join('')}</div>`;
      return `<div class="k-ecran k-e-annonces">${heros(nb(l.length), mot)}${f}${corps}</div>`;
    },
    argent() {
      const [ent, dec] = (euros(recuMois).replace(/ €$/, '')).split(',');
      return `<div class="k-ecran k-e-argent"><div class="k-col-a">
        <section class="k-heros" data-heros><p class="k-heros-n" data-chiffre>${ent}${dec ? `<span class="k-dec">,${dec}</span>` : ''}<span class="k-eur"> €</span></p><div class="k-heros-txt"><p class="k-heros-mot">reçus en novembre</p><p class="k-heros-sous">${nb(ceMois.length)} versements</p></div></section>
        <div class="k-porcelaine k-argent-carte">${courbe()}
        <dl class="k-quatre" data-quatre>
          <div><dt>disponible sur Vinted</dt><dd>${euros(D.porteMonnaie.disponible)}</dd></div>
          <div><dt>en attente</dt><dd>${euros(D.porteMonnaie.attente)}</dd></div>
          <div><dt>${avecCout.length < ceMois.length ? 'bénéfice, au moins' : 'bénéfice'}</dt><dd>${euros(benef, true)}</dd></div>
          <div><dt>coûts saisis</dt><dd>${nb(avecCout.length)} sur ${nb(ceMois.length)}</dd></div>
        </dl></div></div><div class="k-col-b">
        ${groupe('Versements', versees.length, versees.map((v) => ligne(v, `<b>${euros(v.prix)}</b><small>${v.cout != null ? euros(v.prix - v.cout, true) : 'coût —'}</small>`, `${plaque(v.numero)}<span>${quand(Date.parse(v.versee))}</span>`, 'r' + v.tx)).join(''))}
        </div></div>`;
    },
  };
  // La fiche d'une paire : une FEUILLE à détentes (moyenne / grande), retour par glissement.
  function fiche(tx) {
    const v = D.ventes.find((x) => x.tx === tx); if (!v) return '';
    return `<div class="k-voile" aria-hidden="true"></div><section class="k-feuille" role="dialog" aria-label="Fiche de la paire N° ${esc(v.numero)}" data-feuille>
      <span class="k-poignee" aria-hidden="true"></span>
      <div class="k-feuille-haut"><span class="k-feuille-photo">${img(v)}</span><div><p class="k-feuille-titre">${esc(titreDe(v))}</p><p class="k-ligne-sous">${plaque(v.numero)}<span>${esc(v.compte)}</span></p></div></div>
      <div class="k-porcelaine k-feuille-faits">
        <div class="k-fait"><span>${ico('horloge', 20)}À envoyer</span><b>${limiteTexte(v)}</b></div>
        <div class="k-fait"><span>${ico('ventes', 20)}Acheteur</span><b>${esc(v.acheteur)}</b></div>
        <div class="k-fait"><span>${ico('euro', 20)}Vendue</span><b>${euros(v.prix)}</b></div>
        <div class="k-fait"><span>${ico('achats', 20)}Coût saisi</span><b>${euros(v.cout)}</b></div>
      </div>
      <button type="button" class="k-geste k-geste-feuille" data-plein>${ico('imprimer', 22)}<span>Imprimer le bordereau</span></button>
    </section>`;
  }
  const GESTES = {
    journee: prets.length ? [`Imprimer ${prets.length} bordereaux`, 'imprimer'] : null,
    ventes: prets.length ? [`Imprimer ${prets.length} bordereaux`, 'imprimer'] : null,
    achats: points.length ? ['Afficher le code en grand', 'agrandir'] : null,
    annonces: D.aPublier.length ? [`Publier ${D.aPublier.length} paires rangées`, 'plus'] : null,
    argent: sansCout ? [`Saisir ${sansCout} prix d’achat`, 'crayon'] : null,
  };
  const NOMS = [['journee', 'Aujourd’hui', 'aujourdhui'], ['annonces', 'Annonces', 'annonces'], ['achats', 'Achats', 'achats'], ['ventes', 'Ventes', 'ventes'], ['argent', 'Argent', 'argent']];
  const AFAIRE = { ventes: [aEnvoyer.length, 'colis à envoyer'], achats: [D.colis.length, 'colis à retirer'] };

  function rendre() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    const ecran = ECRANS[p.get('ecran')] ? p.get('ecran') : 'journee';
    const [, nom] = NOMS.find(([c]) => c === ecran);
    const g = GESTES[ecran];
    const nav = NOMS.map(([c, n, i]) => { const a = AFAIRE[c] && AFAIRE[c][0] ? AFAIRE[c] : null; return `<a class="k-onglet" href="#ecran=${c}" ${c === ecran ? 'aria-current="page"' : ''} data-nav="${c}" aria-label="${n}${a ? `, ${a[0]} ${a[1]}` : ''}"><span class="k-onglet-i">${ico(i, 26)}${a ? `<b class="k-badge" aria-hidden="true">${a[0]}</b>` : ''}</span><span class="k-onglet-mot">${n}</span></a>`; }).join('');
    const compte = `<button type="button" class="k-compte" aria-haspopup="menu" data-compte><span class="k-logos" aria-hidden="true"><span class="k-logo is-vinted">V</span><span class="k-logo is-lbc">lbc</span></span><span>Vinted · ${D.COMPTES.length} comptes</span>${ico('bas', 16)}</button>`;
    const geste = g ? `<button type="button" class="k-geste" data-plein>${ico(g[1], 22)}<span>${g[0]}</span></button>` : '';
    $('#app').innerHTML = `
      <aside class="k-cote"><p class="k-marque">VRM</p>${compte}<nav class="k-cote-nav">${nav}</nav></aside>
      <div class="k-page" data-espace="${ecran}">
        <header class="k-tete"><div class="k-tete-g"><h1>${nom}</h1>${compte}</div><span class="k-tete-d">${g ? `<span class="k-geste-haut">${geste}</span>` : ''}<button type="button" class="k-rond" aria-label="Chercher un N°, un code, un pseudo">${ico('chercher', 22)}</button><button type="button" class="k-rond" aria-label="Comment marche cet écran">${ico('aide', 22)}</button></span></header>
        <main class="k-main">${ECRANS[ecran](p.get('vue'), p.get('mode'), p.get('glisse') === '1')}</main>
        ${geste ? `<div class="k-geste-zone">${geste}</div>` : ''}
      </div>
      <nav class="k-barre" aria-label="Écrans">${nav}</nav>
      ${p.get('fiche') ? fiche(p.get('fiche')) : ''}`;
    document.body.classList.toggle('a-feuille', !!p.get('fiche'));
    window.scrollTo(0, 0);
  }
  const theme = new URLSearchParams(location.search).get('theme');
  document.documentElement.dataset.theme = theme === 'sombre' ? 'sombre' : 'clair';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'sombre' ? '#15263D' : '#EEF6FD');
  addEventListener('hashchange', rendre);
  rendre();
  document.documentElement.dataset.pret = '1';
})();
