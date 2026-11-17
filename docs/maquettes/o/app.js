// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE O « GALERIE » — page autonome (n'importe rien de src/), données inventées.
//  Ce sont des chaussures : la PHOTO est l'identité. Une app iOS native de bout en bout
//  (grand titre, recherche intégrée, contrôle segmenté, listes groupées inset, barre d'onglets
//  icône + libellé, feuille à détentes, glissement de ligne, cartes de retrait à faire défiler),
//  et UNE signature : l'ÉTIQUETTE du N° — une petite étiquette de vêtement, encoche et œillet,
//  accrochée à chaque photo (rouge seulement quand deux paires portent le même N°).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const D = window.VRM_O, J = 86400000, M = D.MAINTENANT;
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const euros = (c, signe) => {
    if (c == null) return '—';
    const s = (Math.abs(c) / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 });
    return (signe ? (c < 0 ? '−' : '+') : c < 0 ? '−' : '') + s + ' €';
  };
  const nb = (n) => (n == null ? '—' : n.toLocaleString('fr-FR'));
  const jour = (t) => {
    if (!t) return '';
    const d = new Date(t), n = new Date(M);
    const dj = Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()) - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / J);
    if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
    if (dj > 1 && dj < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long', timeZone: 'Europe/Paris' });
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Europe/Paris' }).replace('.', '');
  };
  // La date limite d'envoi est LUE sur l'e-mail du bordereau ; sans elle on dit le jour de la vente : rien n'est deviné.
  const quand = (v) => (v.limite ? 'avant ' + jour(v.limite) : 'vendue ' + jour(v.date));
  const presse = (v) => !!(v.limite && v.limite - M < 36 * 3600e3);

  // ── Données dérivées ──
  const aEnvoyer = D.ventes.filter((v) => v.etat === 'envoyer').sort((a, b) => (a.limite ? 0 : 1) - (b.limite ? 0 : 1) || (a.limite || a.date) - (b.limite || b.date));
  const aImprimer = aEnvoyer.filter((v) => v.bordereau).length;
  const enRoute = D.ventes.filter((v) => v.etat === 'route');
  const toutes = D.ventes.slice().sort((a, b) => b.date - a.date);
  const debut = new Date(new Date(M).getFullYear(), new Date(M).getMonth(), 1).getTime();
  const duMois = toutes.filter((v) => v.date >= debut);
  const vendu = duMois.reduce((s, v) => s + v.prix, 0);
  const couverts = duMois.filter((v) => v.cout != null);
  const sansCout = duMois.filter((v) => v.cout == null);
  const benefice = couverts.length ? couverts.reduce((s, v) => s + v.prix - v.cout, 0) : null;
  const mois = new Date(M).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
  const points = []; for (const c of D.colis) { let p = points.find((x) => x.point === c.point); if (!p) points.push(p = { point: c.point, adresse: c.adresse, limite: c.limite, colis: [] }); p.colis.push(c); }
  const isDouble = (n) => D.annonces.filter((a) => a.numero === n).length > 1;

  // ── Un seul jeu d'icônes (dessin Lucide, trait 1,75, bouts ronds) ──
  const IC = {
    journee: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
    annonces: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    ventes: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12M7.5 4.27l9 5.15"/>',
    achats: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    argent: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    chercher: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    imprimer: '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3h12v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    bas: '<path d="m6 9 6 6 6-6"/>',
    droite: '<path d="m9 18 6-6-6-6"/>',
    lieu: '<path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
    horloge: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    camion: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    baisse: '<path d="M16 17h6v-6"/><path d="m22 17-8.5-8.5-5 5L2 7"/>',
    republier: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    coche: '<path d="M20 6 9 17l-5-5"/>',
    aide: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    coeur: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
    oeil: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    lien: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    plusRond: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  };
  const ic = (n, t = 22, cls = '') => `<svg class="ic ${cls}" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n]}</svg>`;

  // ── LA SIGNATURE : l'étiquette du N° (encoche + œillet), accrochée à la photo ──
  const etiquette = (n, cls = '') => (n ? `<span class="tag ${cls}${isDouble(n) ? ' is-double' : ''}" data-numero="${esc(n)}"><span class="tag-n">${esc(n)}</span></span>` : '');
  const silhouette = '<svg class="sil" viewBox="0 0 64 40" aria-hidden="true"><path d="M6 30c1-6 6-8 11-10l7-4c2-1.5 4-4 7-4 2.2 0 3.6 2 5.6 3 4.5 2.2 10.4 2.6 14 4.8 2.4 1.4 3 4.4 2.4 7.2v3H6z M8 34h48" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  // Sans photo : le fond de studio et la silhouette au trait — la grille garde son rythme, jamais un trou.
  const photo = (src, n, cls = '', tagCls = '') => `<span class="ph ${cls}"${src ? '' : ' data-sans-photo'}>${src ? `<img src="${src}" alt="" loading="lazy" decoding="async">` : silhouette}${etiquette(n, tagCls)}</span>`;
  const qr = (texte) => { const q = window.qrcode(0, 'M'); q.addData(String(texte)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); };
  const segment = (vals, actif, nom) => `<div class="seg" role="tablist" aria-label="${nom}">${vals.map(([k, l]) => `<button type="button" role="tab" aria-selected="${actif === k}" data-s="${k}">${l}</button>`).join('')}</div>`;
  const grandTitre = (titre, { sous = '', boutons = '', recherche = '' } = {}) => `
    <div class="nav-haut">${boutons}</div>
    <header class="grand"><h1>${titre}</h1>${sous}</header>
    ${recherche ? `<label class="recherche">${ic('chercher', 18)}<input type="search" placeholder="${recherche}" enterkeyhint="search" aria-label="${recherche}"></label>` : ''}`;
  const menuComptes = `<button type="button" class="menu-titre">Tous les comptes${ic('bas', 16)}</button>`;
  const chevron = ic('droite', 18, 'chev');
  // L'état vide : une silhouette et une phrase qui dit quoi faire (jamais une liste blanche muette).
  const vide = (texte) => `<div class="vide">${silhouette}<p>${texte}</p></div>`;
  const ou = (liste, html, texte) => (liste.length ? html : vide(texte));

  // Une ligne de liste iOS : vignette 60, titre 17, sous-titre 15 gris, valeur à droite, chevron ; séparateur inset.
  const rangee = (o, sous, valeur, cle, actions = '') => `<li class="rg${actions ? ' a-glisse' : ''}" data-cle="${cle}">${actions ? `<div class="rg-actions">${actions}</div>` : ''}<button type="button" class="rg-btn" data-f="${cle}">${photo(o.photo, o.numero, 'ph--rg', 'tag--mini')}<span class="rg-txt"><span class="rg-titre">${esc(o.titre)}</span><span class="rg-sous">${sous}</span></span><span class="rg-val">${valeur}</span>${chevron}</button></li>`;

  // ── Écrans ──
  function journee() {
    const date = new Date(M).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
    const groupe = (icone, titre, n, action, corps) => `<section class="carte groupe"><header class="groupe-tete"><span class="groupe-ic">${ic(icone, 20)}</span><h2>${titre}</h2><span class="groupe-n">${n}</span>${action}</header>${corps}</section>`;
    return `
      ${grandTitre('Ma journée', { sous: `<p class="sous">${date[0].toUpperCase() + date.slice(1)}</p>` })}
      ${groupe('ventes', 'À poster', aEnvoyer.length, aImprimer ? `<button type="button" class="act" data-plein>${ic('imprimer', 18)}Imprimer ${aImprimer}</button>` : '',
        `<ul class="bande">${aEnvoyer.map((v) => `<li><button type="button" class="bande-case" data-f="v:${v.tx}" aria-label="${esc(v.titre)}">${photo(v.photo, v.numero, 'ph--bande')}<span class="bande-l ${presse(v) ? 'ambre' : ''}">${quand(v)}</span></button></li>`).join('')}</ul>`)}
      <div class="duo duo--egal">${groupe('lieu', 'À retirer', D.colis.length, `<button type="button" class="act-lien" data-aller="achats">Codes</button>`,
        `<ul class="liste-simple">${points.map((p) => `<li><button type="button" class="ls" data-aller="achats"><span class="ls-txt"><span class="ls-titre">${esc(p.point)}</span><span class="ls-sous"><span class="${p.limite - M < 3 * J ? 'ambre' : ''}">jusqu’à ${jour(p.limite)}</span>, ${p.colis.length} colis</span></span>${chevron}</button></li>`).join('')}</ul>`)}
      ${groupe('argent', 'Prix d’achat à saisir', sansCout.length, `<button type="button" class="act-lien">Saisir</button>`,
        `<ul class="bande">${sansCout.map((v) => `<li><button type="button" class="bande-case" data-f="v:${v.tx}" aria-label="${esc(v.titre)}">${photo(v.photo, v.numero, 'ph--bande')}<span class="bande-l">${euros(v.prix)}</span></button></li>`).join('')}</ul>`)}</div>`;
  }
  function annonces(r) {
    const vue = r.s || 'toutes';
    const liste = vue === 'dorment' ? D.annonces.filter((a) => a.jours > 60) : vue === 'sansphoto' ? D.annonces.filter((a) => !a.photo) : D.annonces;
    return `
      ${grandTitre('Annonces', { sous: menuComptes, boutons: `<button type="button" class="nav-btn" aria-label="Publier une annonce">${ic('plus', 24)}</button>`, recherche: 'N°, modèle, taille' })}
      ${segment([['toutes', 'Toutes'], ['dorment', 'Plus de 60 j'], ['sansphoto', 'Sans photo']], vue, 'Vue')}
      ${liste.length ? '' : vide('Aucune annonce ici.')}<ul class="grille">${liste.map((a) => `<li><button type="button" class="case${r.f === 'a:' + a.id ? ' is-ouverte' : ''}" data-f="a:${a.id}" aria-label="N° ${a.numero}, ${esc(a.titre)}, ${euros(a.prix)}">${photo(a.photo, a.numero)}<span class="case-l"><span class="prix">${euros(a.prix)}</span><span class="gris">${a.jours} j</span></span></button></li>`).join('')}</ul>`;
  }
  function ventes(r) {
    const s = r.s || 'envoyer';
    const actions = () => `<button type="button" class="ga ga--gris">${ic('coche', 20)}Parti</button><button type="button" class="ga ga--accent">${ic('imprimer', 20)}Imprimer</button>`;
    const sousV = (v) => `<span class="${presse(v) ? 'ambre' : ''}">${quand(v)}</span>`;
    let corps;
    if (s === 'envoyer') {
      const bientot = aEnvoyer.filter((v) => v.limite), sansDate = aEnvoyer.filter((v) => !v.limite);
      corps = `<h3 class="entete">Bordereau reçu</h3><ul class="carte">${bientot.map((v) => rangee(v, sousV(v), euros(v.prix), 'v:' + v.tx, actions())).join('')}</ul>
        <h3 class="entete">Date limite pas encore lue</h3><ul class="carte">${sansDate.map((v) => rangee(v, sousV(v), euros(v.prix), 'v:' + v.tx)).join('')}</ul>`;
    } else {
      const l = s === 'route' ? enRoute : toutes;
      corps = l.length ? '' : vide('Aucune vente ici.'); corps += `<ul class="carte">${l.map((v) => rangee(v, `${v.etat === 'envoyer' ? 'À envoyer' : v.etat === 'finie' ? 'Livrée' : 'En route'}, ${jour(v.date)}`, euros(v.prix), 'v:' + v.tx)).join('')}</ul>`;
    }
    return `${grandTitre('Ventes', { sous: menuComptes, boutons: aImprimer ? `<button type="button" class="nav-txt" data-plein>${ic('imprimer', 20)}Imprimer ${aImprimer}</button>` : '' })}
      ${segment([['envoyer', 'À envoyer'], ['route', 'En route'], ['toutes', 'Toutes']], s, 'Ventes')}${corps}`;
  }
  function achats(r) {
    const s = r.s || 'retirer';
    const route = D.achats.filter((a) => a.etat === 'route'), recus = D.achats.filter((a) => a.etat === 'recu');
    let corps;
    if (s === 'retirer') {
      corps = `<div class="passes" role="list">${D.colis.map((c) => `<article class="passe" role="listitem"><button type="button" class="passe-btn" data-f="c:${c.id}" aria-label="Code ${c.code}, ${esc(c.point)}">
          <span class="passe-tete"><span class="passe-lieu">${ic('lieu', 18)}<span><b>${esc(c.point)}</b><span>${esc(c.adresse)}</span></span></span><span class="passe-limite ${c.limite - M < 3 * J ? 'ambre' : ''}">${ic('horloge', 16)}${jour(c.limite)}</span></span>
          <span class="passe-qr">${qr(c.code)}</span>
          <span class="passe-code">${c.code.replace(/(\d{3})(\d{3})/, '$1 $2')}</span>
          <span class="passe-pied">${photo('', '', 'ph--passe')}<span><b>${esc(c.art)}</b><span>${ic('camion', 14)}Mondial Relay</span></span></span>
        </button></article>`).join('')}</div>
        <div class="points-pages" aria-hidden="true">${D.colis.map((_, i) => `<i${i === 0 ? ' class="on"' : ''}></i>`).join('')}</div>
        <h3 class="entete">Arrivent bientôt</h3><ul class="carte">${route.slice(0, 3).map((a) => rangee(a, `En route, ${jour(a.date)}`, euros(a.prix), 'h:' + a.tx)).join('')}</ul>`;
    } else corps = `<ul class="carte">${(s === 'route' ? route : recus).map((a) => rangee(a, `${a.etat === 'recu' ? 'Reçu' : 'En route'}, ${jour(a.date)}`, euros(a.prix), 'h:' + a.tx)).join('')}</ul>`;
    return `${grandTitre('Achats', { sous: menuComptes })}${segment([['retirer', 'À retirer'], ['route', 'En route'], ['recus', 'Reçus']], s, 'Achats')}${corps}`;
  }
  function argent() {
    // L'histogramme du mois : le VENDU par jour (date de vente) — chaque barre est une somme de ventes réelles.
    const jours = new Date(M).getDate();
    const parJour = Array.from({ length: jours }, (_, i) => duMois.filter((v) => new Date(v.date).getDate() === i + 1).reduce((s, v) => s + v.prix, 0));
    const max = Math.max(...parJour, 1);
    return `${grandTitre('Argent', { sous: `<p class="sous">${mois[0].toUpperCase() + mois.slice(1)} 2026</p>`, boutons: `<button type="button" class="nav-btn" aria-label="Comment c’est calculé">${ic('aide', 22)}</button>` })}
      <div class="duo"><section class="carte resume">
        <div class="resume-tete"><span class="gris">Vendu en ${mois}</span><span class="resume-grand">${euros(vendu)}</span></div>
        <div class="barres" role="img" aria-label="Vendu par jour en ${mois}">${parJour.map((x, i) => `<i style="--h:${x ? Math.max(6, Math.round((x / max) * 100)) : 2}%"${i === jours - 1 ? ' class="auj"' : ''}></i>`).join('')}</div>
        <div class="barres-l gris"><span>1er ${mois}</span><span>aujourd’hui</span></div>
        <dl class="resume-deux"><div><dt>Bénéfice, au moins</dt><dd>${euros(benefice, true)}</dd></div><div><dt>Coût saisi</dt><dd>${couverts.length} sur ${duMois.length}</dd></div></dl>
      </section>
      <div><h3 class="entete">Ventes de ${mois}</h3>
      <ul class="carte">${duMois.map((v) => rangee(v, `${v.cout != null ? 'Coût ' + euros(v.cout) : '<span class="ambre">Coût à saisir</span>'}`, euros(v.prix), 'v:' + v.tx)).join('')}</ul></div></div>`;
  }

  // ── La fiche : une feuille à détentes (moyenne, grande), la photo d'abord, les gestes au pouce ──
  function fiche(cle) {
    const t = cle[0], id = cle.slice(2);
    if (t === 'a') { const a = D.annonces.find((x) => x.id === id); if (!a) return null;
      return { photo: a.photo, numero: a.numero, titre: a.titre, sous: `Taille ${a.taille}, ${a.etat.toLowerCase()}`, chiffres: [['Achat', euros(a.cout)], ['Prix', euros(a.prix)], ['En ligne', a.jours + ' j']],
        lignes: [['coeur', 'Favoris', nb(a.fav)], ['oeil', 'Vues', nb(a.vues)], ['annonces', 'Compte', a.compte]], second: ['republier', 'Republier'], premier: ['baisse', 'Baisser le prix'] }; }
    if (t === 'v') { const v = D.ventes.find((x) => x.tx === id); if (!v) return null;
      return { photo: v.photo, numero: v.numero, titre: v.titre, sous: `Vendue ${jour(v.date)} à ${v.pseudo}`, chiffres: [['Achat', euros(v.cout)], ['Vente', euros(v.prix)], ['Marge', v.cout != null ? euros(v.prix - v.cout, true) : '—']],
        lignes: v.etat === 'envoyer' ? [['horloge', 'Date limite', v.limite ? jour(v.limite) : 'pas lue', presse(v)], ['imprimer', 'Bordereau', v.bordereau ? 'reçu' : 'pas encore reçu'], ['camion', 'Suivi', v.suivi || '—'], ['achats', 'Compte', v.compte]] : [['camion', 'État', v.etat === 'finie' ? 'Livrée' : 'En route'], ['achats', 'Compte', v.compte]],
        second: v.etat === 'envoyer' ? ['coche', 'Déjà parti'] : ['camion', 'Suivre le colis'], premier: v.etat === 'envoyer' && v.bordereau ? ['imprimer', 'Imprimer'] : null }; }
    if (t === 'h') { const a = D.achats.find((x) => x.tx === id); if (!a) return null;
      return { photo: a.photo, titre: a.titre, sous: `${a.etat === 'recu' ? 'Reçu' : 'En route'}, acheté ${jour(a.date)}`, chiffres: [['Payé', euros(a.prix)]], lignes: [['achats', 'Compte', a.compte]], second: null, premier: ['lien', 'Relier à une paire'] }; }
    if (t === 'c') { const c = D.colis.find((x) => x.id === id); if (!c) return null;
      return { qr: c.code, titre: c.code.replace(/(\d{3})(\d{3})/, '$1 $2'), code: true, sous: c.art, chiffres: [['Point relais', c.point], ['Jusqu’à', jour(c.limite)]], lignes: [['lieu', 'Adresse', c.adresse], ['camion', 'Suivi', c.id]], second: null, premier: ['coche', 'Je l’ai retiré'] }; }
    return null;
  }
  const ficheHtml = (f, grande) => `<div class="voile" data-fermer></div>
    <aside class="feuille${grande ? ' is-grande' : ''}" role="dialog" aria-modal="true" aria-label="${esc(f.titre)}" tabindex="-1">
      <div class="poignee" data-detente aria-hidden="true"><i></i></div>
      <div class="feuille-haut"><button type="button" class="rond" data-fermer aria-label="Fermer"><svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg></button><button type="button" class="rond" aria-label="Plus">${ic('plusRond', 20)}</button></div>
      <div class="feuille-defile">
        <div class="feuille-photo">${f.qr ? `<span class="feuille-qr">${qr(f.qr)}</span>` : photo(f.photo, f.numero, 'ph--feuille', 'tag--grand')}</div>
        <h2 class="feuille-titre${f.code ? ' is-code' : ''}">${esc(f.titre)}</h2>
        <p class="feuille-sous">${esc(f.sous)}</p>
        <dl class="feuille-chiffres" style="--n:${f.chiffres.length}">${f.chiffres.map(([l, v]) => `<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        <ul class="carte carte--feuille">${f.lignes.map(([i, l, v, amb]) => `<li class="ls ls--info"><span class="ls-ic">${ic(i, 20)}</span><span class="ls-titre">${l}</span><span class="ls-val${amb ? ' ambre' : ''}">${esc(v)}</span></li>`).join('')}</ul>
      </div>
      ${f.premier || f.second ? `<div class="feuille-gestes">${f.second ? `<button type="button" class="bt bt--teinte">${ic(f.second[0], 20)}${f.second[1]}</button>` : ''}${f.premier ? `<button type="button" class="bt bt--plein" data-plein>${ic(f.premier[0], 20)}${f.premier[1]}</button>` : ''}</div>` : ''}
    </aside>`;

  // ── La coque : barre d'onglets (icône + libellé) au téléphone, barre latérale à l'ordinateur ──
  const ECRANS = [['journee', 'Ma journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['argent', 'Argent']];
  const lire = () => { const p = new URLSearchParams(location.hash.slice(1)); return { e: p.get('e') || 'journee', s: p.get('s') || '', f: p.get('f') || '', d: p.get('d') || '', g: p.get('g') || '' }; };
  const ecrire = (x) => { const r = { ...lire(), ...x }; const p = new URLSearchParams(); for (const k of ['e', 's', 'f', 'd', 'g']) if (r[k]) p.set(k, r[k]); location.hash = p.toString(); };
  const racine = document.getElementById('g');
  function rendre() {
    const r = lire();
    const html = ({ journee, annonces, ventes, achats, argent }[r.e] || journee)(r);
    const f = r.f ? fiche(r.f) : null;
    // Un point ambre (pas un nombre : le compte est déjà écrit sur l'écran) : il y a un geste à faire là.
    const pastille = (k) => ((k === 'ventes' && aEnvoyer.length) || (k === 'achats' && D.colis.length) ? `<span class="pastille" aria-label="geste à faire"></span>` : '');
    racine.className = 'app' + (f ? ' a-feuille' : '');
    racine.dataset.ecran = r.e;
    racine.innerHTML = `
      <nav class="lateral" aria-label="Écrans"><p class="marque"><span class="tag tag--marque"><span class="tag-n">VRM</span></span></p>${ECRANS.map(([k, l]) => `<button type="button" class="lat" data-aller="${k}" aria-current="${r.e === k ? 'page' : 'false'}">${ic(k, 20)}<span>${l}</span>${pastille(k)}</button>`).join('')}</nav>
      <main class="ecran"${f ? ' data-sous-feuille' : ''}>${html}</main>
      <nav class="onglets" aria-label="Écrans">${ECRANS.map(([k, l]) => `<button type="button" class="onglet" data-aller="${k}" aria-current="${r.e === k ? 'page' : 'false'}"><span class="onglet-ic">${ic(k, 25)}${pastille(k)}</span><span>${k === 'journee' ? 'Journée' : l}</span></button>`).join('')}</nav>
      ${f ? ficheHtml(f, r.d === 'grande') : ''}`;
    if (r.g) { const li = racine.querySelector(`.rg[data-cle="${r.g}"]`); if (li) li.classList.add('is-glisse'); }
    const fe = racine.querySelector('.feuille'); if (fe) fe.focus({ preventScroll: true });
    brancherGestes();
  }
  // Le glissement d'une ligne (actions à droite) et la poignée de la feuille (moyenne ↔ grande, au geste).
  function brancherGestes() {
    racine.querySelectorAll('.rg.a-glisse .rg-btn').forEach((b) => {
      let x0 = null, dx = 0;
      b.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse') return; x0 = e.clientX; dx = 0; });
      b.addEventListener('pointermove', (e) => { if (x0 == null) return; dx = Math.min(0, e.clientX - x0); if (dx < -10) b.style.transform = `translateX(${Math.max(dx, -200)}px)`; });
      b.addEventListener('pointerup', () => { if (x0 == null) return; b.style.transform = ''; b.closest('.rg').classList.toggle('is-glisse', dx < -60); x0 = null; });
    });
    const p = racine.querySelector('[data-detente]'); if (!p) return;
    let y0 = null;
    p.addEventListener('pointerdown', (e) => { y0 = e.clientY; p.setPointerCapture(e.pointerId); });
    p.addEventListener('pointerup', (e) => { if (y0 == null) return; const dy = e.clientY - y0; y0 = null; const g = lire().d === 'grande'; if (dy > 80 && !g) ecrire({ f: '', d: '' }); else if (dy > 40) ecrire({ d: '' }); else if (dy < -40) ecrire({ d: 'grande' }); else if (Math.abs(dy) < 6) ecrire({ d: g ? '' : 'grande' }); });
  }
  racine.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-aller], [data-s], [data-f], [data-fermer]'); if (!b) return;
    if (b.dataset.aller) { ecrire({ e: b.dataset.aller, s: '', f: '', d: '', g: '' }); scrollTo(0, 0); }
    else if (b.dataset.s) ecrire({ s: b.dataset.s, f: '', g: '' });
    else if (b.dataset.f) ecrire({ f: b.dataset.f, d: '', g: '' });
    else if (b.hasAttribute('data-fermer')) ecrire({ f: '', d: '' });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && lire().f) ecrire({ f: '', d: '' }); });
  addEventListener('hashchange', rendre);
  const th = new URLSearchParams(location.search).get('theme'); if (th) document.documentElement.dataset.theme = th;
  rendre();
})();
