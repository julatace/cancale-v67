// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE J « PREMIUM » — page autonome (17 nov.). N'importe RIEN de src/.
//  Écrans : #ecran=journee|ventes|achats|annonces|argent (&vue=liste) ; thème : ?theme=clair|sombre (sombre par défaut).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const D = window.VRM_J; const { NOW, J } = D;
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

  // ── Les photos : ILLUSTRATIONS inventées (une basket de profil, fond de studio), jamais des photos réelles ──
  const COLORIS = [
    ['#f2f1ed', '#cfcbc2', '#202022', '#bba886'], ['#1d1d20', '#38383d', '#efe9dd', '#b88a5a'], ['#ece6d8', '#2f6b4f', '#f4f1ea', '#e2dac8'],
    ['#868a91', '#4a4e56', '#cdd0d5', '#2b2d31'], ['#d6dae0', '#97a0ad', '#f4f5f7', '#3a4a6b'], ['#f5f5f3', '#1c1c1e', '#f5f5f3', '#e0e0de'],
    ['#1f2e57', '#efebe3', '#e6e0d2', '#c7a77a'], ['#b5b9c0', '#6b7079', '#e6e8ec', '#9da3ad'], ['#141416', '#efefed', '#fafafa', '#141416'],
    ['#fbfbfa', '#e3e3e1', '#ffffff', '#cfcfcd'], ['#6c1e2a', '#efe7da', '#ede5d7', '#c49a6c'], ['#eceff2', '#b4bbc6', '#ffffff', '#5a6474'],
    ['#f7f5f0', '#b8202e', '#f1ebdf', '#2b2b2b'], ['#d9cbb0', '#a88d63', '#efe6d4', '#6c5838'], ['#f7f5f0', '#c8102e', '#f1ebdf', '#2b2b2b'],
  ];
  const FONDS = [['#e8e5df', '#cfcac2'], ['#e2e5e9', '#c7cbd1'], ['#e7e2d9', '#cdc6b9'], ['#dfe2df', '#c4c9c4']];
  const cachePhotos = new Map();
  function photo(graine, coloris) {
    const cle = graine + '|' + coloris; if (cachePhotos.has(cle)) return cachePhotos.get(cle);
    let h = 2166136261; for (const c of String(graine)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
    const [dessus, panneau, semelle, lacet] = COLORIS[coloris % COLORIS.length]; const [f1, f2] = FONDS[h % FONDS.length];
    const r = ((h >>> 5) % 7) - 4;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800"><defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${f1}"/><stop offset="1" stop-color="${f2}"/></linearGradient><radialGradient id="o" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".32"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><linearGradient id="l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs><rect width="800" height="800" fill="url(#f)"/><ellipse cx="405" cy="600" rx="340" ry="34" fill="url(#o)"/><g transform="translate(400 440) scale(.84) translate(-400 -440) rotate(${r} 400 450)"><path d="M100 520C108 450 165 422 232 401L316 362C349 341 371 298 414 294C447 292 469 325 502 341C569 372 652 380 705 411C736 430 740 473 730 512V542H100Z" fill="${dessus}"/><path d="M232 401C278 418 330 470 360 542H248C228 502 206 470 164 440Z" fill="${panneau}" opacity=".92"/><path d="M502 341C564 372 645 380 705 411C728 425 736 448 734 476C654 450 562 442 470 468C478 418 489 377 502 341Z" fill="${panneau}" opacity=".92"/><path d="M328 452C420 419 542 429 645 470V487C542 452 420 446 328 474Z" fill="${panneau}"/><path d="M298 380 330 419M331 364 361 403M364 348 392 387M397 333 421 370" stroke="${lacet}" stroke-width="10" stroke-linecap="round"/><path d="M100 520C108 450 165 422 232 401L316 362C349 341 371 298 414 294C447 292 469 325 502 341C569 372 652 380 705 411C736 430 740 473 730 512V542H100Z" fill="url(#l)"/><path d="M94 542H734L730 577C604 591 300 593 124 583C104 581 92 565 94 542Z" fill="${semelle}"/><path d="M112 568C300 579 562 579 730 567" stroke="#000" stroke-opacity=".13" stroke-width="4" fill="none"/></g></svg>`;
    const u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); cachePhotos.set(cle, u); return u;
  }
  const img = (p, cls = '') => `<img class="j-img ${cls}" src="${photo(p.numero || p.id || p.titre, p.coloris || 0)}" alt="" loading="lazy" decoding="async">`;
  const titreDe = (p) => `${p.titre}${p.taille ? ', taille ' + p.taille : ''}`;

  // ── Icônes (dessinées, trait 1,5) ──
  const ICO = {
    aide: '<circle cx="12" cy="12" r="8.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M9.6 9.6a2.4 2.4 0 1 1 3.3 2.2c-.6.3-.9.8-.9 1.4v.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="12" cy="16.6" r=".95" fill="currentColor"/>',
    chercher: '<circle cx="10.5" cy="10.5" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="m15 15 5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    grille: '<path d="M4.75 4.75h6v6h-6zm8.5 0h6v6h-6zm-8.5 8.5h6v6h-6zm8.5 0h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    liste: '<path d="M4.75 6.5h14.5M4.75 12h14.5M4.75 17.5h14.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
    fleche: '<path d="M5 12h13.5M13 6.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
    coeur: '<path d="M12 19.2s-7-4.3-7-9.2A3.8 3.8 0 0 1 12 8a3.8 3.8 0 0 1 7 2c0 4.9-7 9.2-7 9.2z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  };
  const ico = (n, t = 24) => `<svg class="j-ico" width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true">${ICO[n]}</svg>`;

  // ── Calculs (sur la fixture, une seule fois) ──
  const aEnvoyer = D.ventes.filter((v) => v.etat === 'envoyer').sort((a, b) => (a.limite || a.estimee) - (b.limite || b.estimee));
  const prets = aEnvoyer.filter((v) => v.bord);
  const urgents = aEnvoyer.filter((v) => v.limite && v.limite - NOW < 2 * J);
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
  const numero = (n) => (n ? `<span class="j-num" data-numero="${esc(n)}">N° ${esc(n)}</span>` : '');
  const ambre = (t) => `<span class="j-ambre"><i class="j-point"></i>${t}</span>`;
  const limiteTexte = (v) => (v.limite ? (v.limite - NOW < 2 * J ? ambre('avant ' + quand(v.limite)) : 'avant ' + quand(v.limite)) : 'date estimée, ' + quand(v.estimee));
  const heros = (n, mot, sous) => `<section class="j-heros" data-heros><p class="j-heros-n" data-chiffre>${n}</p><p class="j-heros-mot">${mot}</p>${sous ? `<p class="j-heros-sous">${sous}</p>` : ''}</section>`;
  const onglets = (items, actif, ecran, extra = '') => `<div class="j-onglets-ligne"><nav class="j-onglets" role="tablist">${items.map(([cle, nom]) => `<a role="tab" class="j-onglet" href="#ecran=${ecran}&vue=${cle}" aria-selected="${cle === actif}" data-vue="${cle}">${nom}</a>`).join('')}</nav>${extra}</div>`;
  const rangee = (p, droite, sous, cle) => `<a class="j-rangee" href="#" data-ligne="${esc(cle)}"><span class="j-rangee-photo">${img(p)}</span><span class="j-rangee-corps"><span class="j-rangee-titre">${esc(titreDe(p))}</span><span class="j-rangee-sous">${sous}</span></span><span class="j-rangee-droite">${droite}</span></a>`;
  const groupe = (titre, n, corps) => `<section class="j-groupe"><h2 class="j-entete">${titre}<span>${nb(n)}</span></h2>${corps}</section>`;

  function pass(p, i) {
    const c = p.colis[0];
    const a = achatDe(c.achat);
    return `<article class="j-pass is-devant" data-point="${esc(p.nom)}" data-devant>
      <header class="j-pass-tete"><h3>${esc(p.nom)}</h3><p>${esc(p.adresse)}</p></header>
      <div class="j-pass-qr" data-code="${esc(c.code)}">${qr(c.code)}</div>
      <p class="j-pass-code" data-chiffre>${esc(c.code)}</p>
      <dl class="j-pass-pied">
        <div><dt>Colis</dt><dd>${esc(a ? titreDe(a) : '—')}</dd></div>
        <div><dt>Avant</dt><dd>${c.limite - NOW < 2 * J ? ambre(quand(c.limite)) : quand(c.limite)}</dd></div>
        <div><dt>${esc(c.transporteur)}</dt><dd class="j-pass-suivi">${esc(c.suivi)}</dd></div>
      </dl>
      ${p.colis.length > 1 ? `<p class="j-pass-pages"><b>1</b> sur ${p.colis.length} colis à ce point</p>` : ''}
    </article>`;
  }
  function qr(texte) {
    try { const q = window.qrcode(0, 'M'); q.addData(String(texte)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); } catch (_) { return ''; }
  }
  function pile(mini) {
    if (!points.length) return '<p class="j-vide">Rien à retirer</p>';
    const [devant, ...dos] = points;
    if (mini) {
      return `<a class="j-pile is-mini" href="#ecran=achats" data-pile>${dos.slice(0, 2).reverse().map((p, k) => `<span class="j-pass is-dos" style="--k:${k}"></span>`).join('')}
        <span class="j-pass is-mini-devant"><span class="j-mini-nom">${esc(devant.nom)}</span><span class="j-mini-code" data-chiffre>${esc(devant.colis[0].code)}</span><span class="j-mini-sous">${nb(D.colis.length)} colis, ${nb(points.length)} points · ${devant.limite - NOW < 2 * J ? ambre('le premier avant ' + quand(devant.limite)) : 'le premier avant ' + quand(devant.limite)}</span></span></a>`;
    }
    return `<div class="j-pile" data-pile>${dos.reverse().map((p) => `<a class="j-pass is-dos" href="#" data-point="${esc(p.nom)}"><span>${esc(p.nom)}</span><span>${nb(p.colis.length)} colis</span></a>`).join('')}${pass(devant)}</div>`;
  }
  function courbe() {
    const n = new Date(NOW).getDate(); const t = new Array(n).fill(0);
    for (const v of ceMois) { const j = new Date(v.versee).getDate() - 1; t[j] += v.prix; }
    let c = 0; const cum = t.map((v) => (c += v));
    const W = 1000, H = 240, max = Math.max(1, ...cum);
    const pts = cum.map((v, i) => [(i / (n - 1)) * W, H - 12 - (v / max) * (H - 36)]);
    // En marches (un versement = une marche) : la forme dit la vérité de la donnée.
    let d = `M0 ${pts[0][1].toFixed(1)}`; for (let i = 1; i < pts.length; i++) d += ` H${pts[i][0].toFixed(1)} V${pts[i][1].toFixed(1)}`;
    const [lx, ly] = pts[pts.length - 1];
    return `<figure class="j-courbe" data-courbe><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${d} V${H} H0 Z" class="j-courbe-aire"/><path d="${d}" class="j-courbe-trait" vector-effect="non-scaling-stroke"/></svg><span class="j-courbe-pt" style="left:${(lx / W) * 100}%;top:${(ly / H) * 100}%"></span><figcaption><span>1er novembre</span><span>aujourd’hui</span></figcaption></figure>`;
  }

  // ════════════ LES ÉCRANS ════════════
  const ECRANS = {
    journee() {
      const v = aEnvoyer[0];
      return `<div class="j-ecran j-e-journee">
        <div class="j-col-a">${heros(nb(aEnvoyer.length), 'colis à envoyer', urgents.length ? ambre(`${nb(urgents.length)} avant demain soir`) : '')}
        <a class="j-vedette" href="#ecran=ventes" data-vedette><span class="j-vedette-photo">${img(v, 'is-grand')}${numero(v.numero)}</span>
          <span class="j-vedette-texte"><span class="j-vedette-titre">${esc(titreDe(v))}</span><span class="j-vedette-sous"><span>${limiteTexte(v)} · ${esc(v.acheteur)}</span><b>${euros(v.prix)}</b></span></span></a></div>
        <div class="j-col-b">
        <section class="j-groupe"><h2 class="j-entete">À retirer<span>${nb(D.colis.length)}</span></h2>${pile(true)}</section>
        <section class="j-groupe"><h2 class="j-entete">Novembre</h2><div class="j-paire-chiffres"><a href="#ecran=argent"><b>${euros(recuMois)}</b><span>reçus</span></a><a href="#ecran=ventes&vue=toutes"><b>${nb(D.ventes.length)}</b><span>ventes</span></a></div></section>
        </div></div>`;
    },
    ventes(vue) {
      vue = vue || 'envoyer';
      const tabs = onglets([['envoyer', 'À envoyer'], ['route', 'En route'], ['toutes', 'Toutes']], vue, 'ventes');
      if (vue === 'envoyer') {
        const g = [['Avant demain soir', aEnvoyer.filter((v) => v.limite && v.limite - NOW < 2 * J)], ['Cette semaine', aEnvoyer.filter((v) => v.limite && v.limite - NOW >= 2 * J)], ['Date estimée', aEnvoyer.filter((v) => !v.limite)]].filter(([, l]) => l.length);
        return `<div class="j-ecran">${heros(nb(aEnvoyer.length), 'colis à envoyer', `${nb(prets.length)} bordereaux prêts`)}${tabs}
          ${g.map(([t, l]) => groupe(t, l.length, `<div class="j-liste">${l.map((v) => rangee(v, `<b>${euros(v.prix)}</b>`, `${numero(v.numero)}<span>${limiteTexte(v)}</span>`, 'v' + v.tx)).join('')}</div>`)).join('')}</div>`;
      }
      const l = vue === 'route' ? D.ventes.filter((v) => v.etat === 'route') : D.ventes;
      return `<div class="j-ecran">${heros(nb(l.length), vue === 'route' ? 'en route vers l’acheteur' : 'ventes ce mois')}${tabs}
        <div class="j-liste">${l.map((v) => rangee(v, `<b>${euros(v.prix)}</b>`, `${numero(v.numero)}<span>vendue ${quand(Date.parse(v.vendue))}</span>`, 'v' + v.tx)).join('')}</div></div>`;
    },
    achats() {
      const enRoute = D.achats.filter((a) => a.etat === 'route'), arrives = D.achats.filter((a) => a.etat === 'arrive');
      return `<div class="j-ecran j-e-achats"><div class="j-col-a">${pile(false)}</div><div class="j-col-b">
        ${groupe('En route', enRoute.length, `<div class="j-liste">${enRoute.map((a) => rangee(a, `<b>${euros(a.prix)}</b>`, `<span>${quand(Date.parse(a.date))} · ${esc(a.vendeur)}</span>`, a.id)).join('')}</div>`)}
        ${groupe('Arrivés, à numéroter', arrives.length, `<div class="j-liste">${arrives.map((a) => rangee(a, `<b>${euros(a.prix)}</b>`, `<span>${quand(Date.parse(a.date))} · ${esc(a.vendeur)}</span>`, a.id)).join('')}</div>`)}
        </div></div>`;
    },
    annonces(vue, mode) {
      vue = vue || 'enligne';
      const l = vue === 'dorment' ? dorment.slice().sort((a, b) => b.age - a.age) : vue === 'publier' ? D.aPublier : D.annonces.slice().sort((a, b) => a.age - b.age);
      const mot = vue === 'dorment' ? 'en ligne depuis plus de 60 jours' : vue === 'publier' ? 'paires rangées, à mettre en ligne' : 'annonces en ligne';
      const liste = mode === 'liste';
      const bascule = `<a class="j-bouton-icone" href="#ecran=annonces&vue=${vue}${liste ? '' : '&mode=liste'}" aria-label="${liste ? 'Voir en grille' : 'Voir en liste'}" data-bascule>${ico(liste ? 'grille' : 'liste', 22)}</a>`;
      const tabs = onglets([['enligne', 'En ligne'], ['dorment', 'Qui dorment'], ['publier', 'À publier']], vue, 'annonces', '@BASCULE@').replace(/&vue=(\w+)"/g, (m, v) => `&vue=${v}${liste ? '&mode=liste' : ''}"`).replace('@BASCULE@', bascule);
      const meta = (a) => (a.age != null ? `${a.age > 60 ? ambre(a.age + ' j') : a.age + ' j'}${a.fav ? `<span class="j-fav">${ico('coeur', 14)}${a.fav}</span>` : ''}` : `case ${esc(a.case)}`);
      const corps = liste
        ? `<div class="j-liste">${l.map((a) => rangee(a, `<b>${euros(a.prix)}</b>`, `${numero(a.numero)}<span class="j-meta">${meta(a)}</span>`, a.id)).join('')}</div>`
        : `<div class="j-grille" data-grille>${l.map((a) => `<a class="j-tuile" href="#" data-ligne="${a.id}"><span class="j-tuile-photo">${img(a)}${numero(a.numero)}</span><span class="j-tuile-texte"><span class="j-tuile-haut"><b>${a.prix != null ? euros(a.prix) : 'achat ' + euros(a.cout)}</b><span class="j-meta">${meta(a)}</span></span><span class="j-tuile-titre">${esc(titreDe(a))}</span></span></a>`).join('')}</div>`;
      return `<div class="j-ecran j-e-annonces">${heros(nb(l.length), mot)}${tabs}${corps}</div>`;
    },
    argent() {
      const [ent, dec] = (euros(recuMois).replace(/ €$/, '')).split(',');
      return `<div class="j-ecran j-e-argent"><div class="j-col-a">
        <section class="j-heros" data-heros><p class="j-heros-n" data-chiffre>${ent}${dec ? `<span class="j-dec">,${dec}</span>` : ''}<span class="j-eur">€</span></p><p class="j-heros-mot">reçus en novembre</p><p class="j-heros-sous">${nb(ceMois.length)} versements</p></section>
        ${courbe()}
        <dl class="j-quatre" data-quatre>
          <div><dt>disponible sur Vinted</dt><dd>${euros(D.porteMonnaie.disponible)}</dd></div>
          <div><dt>en attente</dt><dd>${euros(D.porteMonnaie.attente)}</dd></div>
          <div><dt>${avecCout.length < ceMois.length ? 'bénéfice, au moins' : 'bénéfice'}</dt><dd>${euros(benef, true)}</dd></div>
          <div><dt>coûts saisis</dt><dd>${nb(avecCout.length)} sur ${nb(ceMois.length)}</dd></div>
        </dl></div><div class="j-col-b">
        ${groupe('Versements', versees.length, `<div class="j-liste">${versees.map((v) => rangee(v, `<b>${euros(v.prix)}</b><small>${v.cout != null ? euros(v.prix - v.cout, true) : 'coût —'}</small>`, `${numero(v.numero)}<span>${quand(Date.parse(v.versee))}</span>`, 'r' + v.tx)).join('')}</div>`)}
        </div></div>`;
    },
  };
  const GESTES = {
    journee: prets.length ? ['Imprimer les bordereaux', prets.length] : null,
    ventes: prets.length ? ['Imprimer les bordereaux', prets.length] : null,
    achats: points.length ? ['Afficher le code en grand', null] : null,
    annonces: D.aPublier.length ? ['Publier les paires rangées', D.aPublier.length] : null,
    argent: sansCout ? ['Saisir les prix d’achat', sansCout] : null,
  };
  const NOMS = [['journee', 'Aujourd’hui'], ['annonces', 'Annonces'], ['achats', 'Achats'], ['ventes', 'Ventes'], ['argent', 'Argent']];
  const AFAIRE = { ventes: urgents.length > 0, achats: points.some((p) => p.limite - NOW < 2 * J) };

  function rendre() {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    const ecran = ECRANS[p.get('ecran')] ? p.get('ecran') : 'journee';
    const nom = NOMS.find(([c]) => c === ecran)[1];
    const g = GESTES[ecran];
    const date = new Date(NOW).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const nav = NOMS.map(([c, n]) => `<a class="j-nav-item" href="#ecran=${c}" ${c === ecran ? 'aria-current="page"' : ''} data-nav="${c}">${n}${AFAIRE[c] ? '<i class="j-point" aria-label="à faire"></i>' : ''}</a>`).join('');
    const geste = g ? `<button type="button" class="j-geste" data-plein><span>${g[0]}</span>${g[1] != null ? `<b>${g[1]}</b>` : ico('fleche', 22)}</button>` : '';
    $('#app').innerHTML = `
      <aside class="j-cote"><p class="j-marque">VRM</p><nav class="j-cote-nav">${nav}</nav><p class="j-cote-pied">${esc(D.COMPTES.length)} comptes Vinted</p></aside>
      <div class="j-page">
        <header class="j-tete"><h1>${nom}</h1>${ecran === 'journee' ? `<p class="j-tete-date">${date}</p>` : ''}<span class="j-tete-actions"><button type="button" class="j-bouton-icone" aria-label="Chercher un N°, un code, un pseudo">${ico('chercher', 22)}</button><button type="button" class="j-bouton-icone" aria-label="Comment marche cet écran">${ico('aide', 22)}</button></span></header>
        <main class="j-main">${ECRANS[ecran](p.get('vue'), p.get('mode'))}</main>
        ${geste ? `<div class="j-geste-zone">${geste}</div>` : ''}
      </div>
      <nav class="j-barre" aria-label="Écrans">${nav}</nav>`;
    document.documentElement.dataset.ecran = ecran;
    window.scrollTo(0, 0);
  }
  const theme = new URLSearchParams(location.search).get('theme');
  document.documentElement.dataset.theme = theme === 'clair' ? 'clair' : 'sombre';
  document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'clair' ? '#f1f0ec' : '#000000');
  addEventListener('hashchange', rendre);
  rendre();
  document.documentElement.dataset.pret = '1';
})();
