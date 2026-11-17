// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE O « GALERIE » — page autonome (n'importe rien de src/).
//  Ce sont des chaussures : la PHOTO est l'identité. Fond blanc de galerie (noir la nuit),
//  photos carrées bord à bord, étiquettes de musée, navigation en mots, un seul geste plein :
//  une barre noire pleine largeur au pouce. Trois tailles de texte par écran.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const D = window.VRM_O, J = 86400000, M = D.MAINTENANT;
  const ECRANS = [['journee', 'Journée', 'Ma journée'], ['annonces', 'Annonces', 'Annonces'], ['ventes', 'Ventes', 'Ventes'], ['achats', 'Achats', 'Achats'], ['argent', 'Argent', 'Argent']];
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
  // La date limite d'envoi est LUE sur l'e-mail du bordereau ; sans elle, on dit le jour de la vente (rien deviné).
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
  const benefice = couverts.length ? couverts.reduce((s, v) => s + v.prix - v.cout, 0) : null;
  const mois = new Date(M).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
  const points = []; for (const c of D.colis) { let p = points.find((x) => x.point === c.point); if (!p) points.push(p = { point: c.point, adresse: c.adresse, limite: c.limite, colis: [] }); p.colis.push(c); }

  // ── Pièces ──
  const silhouette = '<svg class="g-silhouette" viewBox="0 0 64 40" aria-hidden="true"><path d="M6 30c1-6 6-8 11-10l7-4c2-1.5 4-4 7-4 2.2 0 3.6 2 5.6 3 4.5 2.2 10.4 2.6 14 4.8 2.4 1.4 3 4.4 2.4 7.2v3H6z M12 34h40" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round"/></svg>';
  // Sans photo : un aplat et une silhouette au trait — la grille garde son rythme, jamais un trou.
  const photo = (src, numero, cls = '') => `<span class="g-photo ${cls}"${src ? '' : ' data-sans-photo'}>${src ? `<img src="${src}" alt="" loading="lazy" decoding="async">` : silhouette}${numero ? `<span class="g-num${isDouble(numero) ? ' is-double' : ''}" data-numero="${esc(numero)}">${esc(numero)}</span>` : ''}</span>`;
  const isDouble = (n) => D.annonces.filter((a) => a.numero === n).length > 1;
  const qr = (texte) => { const q = window.qrcode(0, 'M'); q.addData(String(texte)); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); };
  const onglets = (vals, actif, nom) => `<div class="g-onglets" role="tablist" aria-label="${nom}">${vals.map(([k, l, n]) => `<button type="button" role="tab" aria-selected="${actif === k}" data-s="${k}">${l}${n != null ? `<span class="g-compte">${nb(n)}</span>` : ''}</button>`).join('')}</div>`;
  const tete = (titre, sur, droite = '') => `<header class="g-tete"><div>${sur ? `<p class="g-sur">${sur}</p>` : ''}<h1 class="g-titre">${titre}</h1></div>${droite}</header>`;

  // ── Écrans ──
  function journee() {
    const date = new Date(M).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
    return { dock: aImprimer ? `Imprimer ${aImprimer} bordereaux` : '', html: `
      ${tete('Ma journée', date[0].toUpperCase() + date.slice(1))}
      <dl class="g-chiffres">
        <div><dt>${aEnvoyer.length ? '<i class="g-point"></i>' : ''}À envoyer</dt><dd>${nb(aEnvoyer.length)}</dd></div>
        <div><dt>${D.colis.length ? '<i class="g-point"></i>' : ''}À retirer</dt><dd>${nb(D.colis.length)}</dd></div>
        <div><dt>Vendu en ${mois}</dt><dd>${euros(vendu)}</dd></div>
      </dl>
      <div class="g-rubrique"><h2>À poster</h2><button type="button" class="g-lien" data-aller="ventes">Toutes les ventes</button></div>
      <ul class="g-grille g-grille--journee">${aEnvoyer.map((v) => `<li><button type="button" class="g-case" data-f="v:${v.tx}" aria-label="${esc(v.titre)}">${photo(v.photo, v.numero)}<span class="g-legende"><span class="${presse(v) ? 'g-ambre' : ''}">${quand(v)}</span></span></button></li>`).join('')}</ul>
      <section class="g-ordi-seul"><div class="g-rubrique"><h2>À retirer</h2><button type="button" class="g-lien" data-aller="achats">Tous les achats</button></div>
        <ul class="g-retraits">${D.colis.map((c) => `<li><button type="button" class="g-ligne g-ligne--colis" data-f="c:${c.id}"><span class="g-qr" aria-hidden="true">${qr(c.code)}</span><span class="g-ligne-textes"><span class="g-code">${c.code}</span><span class="g-ligne-meta g-gris">${esc(c.point)} · jusqu’à ${jour(c.limite)}</span></span></button></li>`).join('')}</ul></section>` };
  }
  function annonces(r) {
    const vue = r.s || 'toutes';
    const vieilles = D.annonces.filter((a) => a.jours > 60), sans = D.annonces.filter((a) => !a.photo);
    const liste = vue === 'dorment' ? vieilles : vue === 'sansphoto' ? sans : D.annonces;
    return { dock: 'Publier une annonce', html: `
      ${tete('Annonces', `${nb(D.annonces.length)} en ligne`, '<button type="button" class="g-choix">Tous les comptes<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5"/></svg></button>')}
      <div class="g-outils">
        <label class="g-champ"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM14.6 14.6 19.5 19.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg><input type="search" placeholder="N°, modèle, taille" enterkeyhint="search" aria-label="Chercher une annonce"></label>
        ${onglets([['toutes', 'Toutes', null], ['dorment', 'Plus de 60 j', vieilles.length], ['sansphoto', 'Sans photo', sans.length]], vue, 'Vue')}
      </div>
      <ul class="g-grille" data-grille>${liste.map((a) => `<li><button type="button" class="g-case${r.f === 'a:' + a.id ? ' is-ouverte' : ''}" data-f="a:${a.id}" aria-label="N° ${a.numero}, ${esc(a.titre)}, ${euros(a.prix)}">${photo(a.photo, a.numero)}<span class="g-legende"><span class="g-prix">${euros(a.prix)}</span><span class="g-gris">${a.jours} j</span></span></button></li>`).join('')}</ul>` };
  }
  const ligne = (o, meta, droite, cle) => `<li><button type="button" class="g-ligne" data-f="${cle}">${photo(o.photo, o.numero, 'g-photo--liste')}<span class="g-ligne-textes"><span class="g-ligne-titre">${esc(o.titre)}</span><span class="g-ligne-meta">${meta}</span></span><span class="g-ligne-prix">${droite}</span></button></li>`;
  function ventes(r) {
    const s = r.s || 'envoyer';
    const liste = s === 'envoyer' ? aEnvoyer : s === 'route' ? enRoute : toutes;
    return { dock: s === 'envoyer' && aImprimer ? `Imprimer ${aImprimer} bordereaux` : '', html: `
      ${tete('Ventes')}
      ${onglets([['envoyer', 'À envoyer', aEnvoyer.length], ['route', 'En route', enRoute.length], ['toutes', 'Toutes', null]], s, 'Ventes')}
      <ul class="g-liste">${liste.map((v) => ligne(v, `${v.etat === 'envoyer' ? `<span class="${presse(v) ? 'g-ambre' : 'g-encre'}">${quand(v)}</span>` : `<span class="g-encre">${v.etat === 'finie' ? 'Livrée' : 'En route'}</span>`}<span class="g-gris g-bloc">${esc(v.pseudo)}</span>`, euros(v.prix), 'v:' + v.tx)).join('')}</ul>` };
  }
  function achats(r) {
    const s = r.s || 'retirer';
    const route = D.achats.filter((a) => a.etat === 'route'), recus = D.achats.filter((a) => a.etat === 'recu');
    const corps = s === 'retirer'
      ? points.map((p) => `<section class="g-point-relais"><div class="g-rubrique"><h2>${esc(p.point)}</h2><span class="${p.limite - M < 3 * J ? 'g-ambre' : 'g-gris'}">jusqu’à ${jour(p.limite)}</span></div>
          <ul class="g-liste">${p.colis.map((c) => `<li><button type="button" class="g-ligne g-ligne--colis" data-f="c:${c.id}"><span class="g-qr" aria-hidden="true">${qr(c.code)}</span><span class="g-ligne-textes"><span class="g-code" aria-label="Code ${c.code}">${c.code}</span><span class="g-ligne-meta g-gris">${esc(c.art)}</span></span></button></li>`).join('')}</ul></section>`).join('')
      : `<ul class="g-liste">${(s === 'route' ? route : recus).map((a) => ligne(a, `<span class="g-encre">${a.etat === 'recu' ? 'Reçu' : 'En route'}</span><span class="g-gris"> · ${jour(a.date)}</span>`, euros(a.prix), 'h:' + a.tx)).join('')}</ul>`;
    return { dock: '', html: `${tete('Achats')}${onglets([['retirer', 'À retirer', D.colis.length], ['route', 'En route', route.length], ['recus', 'Reçus', null]], s, 'Achats')}<div class="g-points">${corps}</div>` };
  }
  function argent() {
    return { dock: '', html: `
      ${tete('Argent', '', '<button type="button" class="g-aide" aria-label="Comment c’est calculé">?</button>')}
      <dl class="g-chiffres g-chiffres--argent">
        <div class="g-chiffre-seul"><dt>Vendu en ${mois} · ${duMois.length} ventes</dt><dd>${euros(vendu)}</dd></div>
        <div><dt>Bénéfice, au moins</dt><dd>${euros(benefice, true)}</dd></div>
        <div><dt>Coût saisi</dt><dd>${couverts.length}<span class="g-sur-n">/${duMois.length}</span></dd></div>
      </dl>
      <div class="g-rubrique"><h2>Ventes de ${mois}</h2></div>
      <ul class="g-liste">${duMois.map((v) => ligne(v, `<span class="g-encre">${jour(v.date)}</span><span class="g-gris"> · ${v.cout != null ? 'coût ' + euros(v.cout) : 'coût pas saisi'}</span>`, euros(v.prix), 'v:' + v.tx)).join('')}</ul>` };
  }

  // ── La fiche : la photo en haut, l'étiquette, les gestes en bas ──
  function fiche(cle) {
    const t = cle[0], id = cle.slice(2);
    if (t === 'a') { const a = D.annonces.find((x) => x.id === id); if (!a) return null;
      return { photo: a.photo, numero: a.numero, titre: a.titre, meta: [`Taille ${a.taille}`, a.etat, a.compte], chiffres: [['Achat', euros(a.cout)], ['Prix', euros(a.prix)], ['En ligne', a.jours + ' j']], faits: [['Favoris', nb(a.fav)], ['Vues', nb(a.vues)]], plein: 'Baisser le prix', touche: 'Republier' }; }
    if (t === 'v') { const v = D.ventes.find((x) => x.tx === id); if (!v) return null;
      return { photo: v.photo, numero: v.numero, titre: v.titre, meta: ['à ' + v.pseudo, 'vendue ' + jour(v.date)], chiffres: [['Achat', euros(v.cout)], ['Vente', euros(v.prix)], ['Marge', v.cout != null ? euros(v.prix - v.cout, true) : '—']],
        faits: v.etat === 'envoyer' ? [['Date limite', v.limite ? jour(v.limite) : 'pas lue'], ['Bordereau', v.bordereau ? 'reçu' : 'pas encore reçu'], ['Suivi', v.suivi || '—'], ['Compte', v.compte]] : [['État', v.etat === 'finie' ? 'Livrée' : 'En route'], ['Compte', v.compte]],
        plein: v.etat === 'envoyer' && v.bordereau ? 'Imprimer le bordereau' : '', touche: v.etat === 'envoyer' ? 'Déjà parti' : 'Suivre le colis', presse: v.etat === 'envoyer' && presse(v) }; }
    if (t === 'h') { const a = D.achats.find((x) => x.tx === id); if (!a) return null;
      return { photo: a.photo, titre: a.titre, meta: [a.compte, jour(a.date)], chiffres: [['Payé', euros(a.prix)], ['État', a.etat === 'recu' ? 'Reçu' : 'En route']], faits: [], plein: '', touche: 'Relier à une paire' }; }
    if (t === 'c') { const c = D.colis.find((x) => x.id === id); if (!c) return null;
      return { qr: c.code, titre: c.code, code: true, meta: [c.art], chiffres: [['Point relais', c.point], ['Jusqu’à', jour(c.limite)]], faits: [['Adresse', c.adresse], ['Suivi', c.id]], plein: 'Je l’ai retiré', touche: '' }; }
    return null;
  }
  const ficheHtml = (f) => `<aside class="g-fiche" role="dialog" aria-label="${esc(f.titre)}" tabindex="-1">
    <div class="g-fiche-defile">
      <div class="g-fiche-photo">${f.qr ? `<span class="g-fiche-qr">${qr(f.qr)}</span>` : photo(f.photo, '', 'g-photo--grand')}
        <button type="button" class="g-carre g-carre--gauche" data-fermer aria-label="Fermer"><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg></button>
        <button type="button" class="g-carre g-carre--droite" aria-label="Plus"><svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor"/></svg></button>
      </div>
      <div class="g-fiche-corps">
        ${f.numero ? `<span class="g-num g-num--plat${isDouble(f.numero) ? ' is-double' : ''}">N° ${esc(f.numero)}</span>` : ''}
        <h2 class="g-fiche-titre${f.code ? ' g-code' : ''}">${esc(f.titre)}</h2>
        <p class="g-gris g-fiche-meta">${f.meta.map(esc).join(' · ')}</p>
        <dl class="g-fiche-chiffres">${f.chiffres.map(([l, v]) => `<div><dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
        ${f.faits.length ? `<dl class="g-fiche-faits">${f.faits.map(([l, v]) => `<div${String(v).length > 11 ? ' class="g-long"' : ''}><dt>${l}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      </div>
    </div>
    ${f.plein || f.touche ? `<div class="g-gestes">${f.touche ? `<button type="button" class="g-touche">${f.touche}</button>` : ''}${f.plein ? `<button type="button" class="g-plein" data-plein>${f.plein}</button>` : ''}</div>` : ''}
  </aside>`;

  // ── La coque et la route (#e=…&s=…&f=…) ──
  const lire = () => { const p = new URLSearchParams(location.hash.slice(1)); return { e: p.get('e') || 'journee', s: p.get('s') || '', f: p.get('f') || '' }; };
  const ecrire = (x) => { const r = { ...lire(), ...x }; const p = new URLSearchParams(); for (const k of ['e', 's', 'f']) if (r[k]) p.set(k, r[k]); location.hash = p.toString(); };
  const racine = document.getElementById('g');
  function rendre() {
    const r = lire();
    const e = { journee, annonces, ventes, achats, argent }[r.e] || journee;
    const { html, dock } = e(r);
    const f = r.f ? fiche(r.f) : null;
    const nav = ECRANS.map(([k, court, long]) => `<button type="button" class="g-nav" data-aller="${k}" aria-current="${r.e === k ? 'page' : 'false'}"><span class="g-nav-court">${court}</span><span class="g-nav-long">${long}</span>${k === 'ventes' && aEnvoyer.length ? '<i class="g-point g-point--nav"></i>' : ''}${k === 'achats' && D.colis.length ? '<i class="g-point g-point--nav"></i>' : ''}</button>`).join('');
    racine.className = 'g' + (f ? ' a-fiche' : '') + (dock ? ' a-dock' : '');
    racine.dataset.ecran = r.e;
    racine.innerHTML = `
      <header class="g-entete"><span class="g-marque">VRM</span><nav class="g-navs g-navs--haut" aria-label="Écrans">${nav}</nav></header>
      <main class="g-main"${f ? ' data-sous-fiche' : ''}>${html}${dock ? `<div class="g-dock-ordi"><button type="button" class="g-plein" data-plein>${dock}</button></div>` : ''}</main>
      <div class="g-bas">${dock ? `<button type="button" class="g-plein g-plein--dock" data-plein>${dock}</button>` : ''}<nav class="g-navs g-navs--bas" aria-label="Écrans">${nav}</nav></div>
      ${f ? ficheHtml(f) : ''}`;
    const fi = racine.querySelector('.g-fiche'); if (fi) fi.focus({ preventScroll: true });
  }
  racine.addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.aller) { ecrire({ e: b.dataset.aller, s: '', f: '' }); scrollTo(0, 0); }
    else if (b.dataset.s) ecrire({ s: b.dataset.s, f: '' });
    else if (b.dataset.f) ecrire({ f: b.dataset.f });
    else if (b.hasAttribute('data-fermer')) ecrire({ f: '' });
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && lire().f) ecrire({ f: '' }); });
  addEventListener('hashchange', rendre);
  // Le thème : celui de l'appareil, ou ?theme=sombre|clair (banc).
  const th = new URLSearchParams(location.search).get('theme'); if (th) document.documentElement.dataset.theme = th;
  rendre();
})();
