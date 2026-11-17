// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE M « UNE MAIN » (17 nov.) — page autonome, aucune dépendance, rien de src/.
//  Le HAUT se lit (un champ vert : le nom, LE chiffre) ; le BAS se touche (filtres, recherche + LE
//  geste, onglets) ; une ligne se GLISSE pour son geste, ou se TOUCHE pour sa feuille (deux crans).
//  Règles de VRM tenues : un N° = une paire (par l'id de SON annonce) ; « — » quand on ne sait pas ;
//  « vendu » à la date de vente, « reçu » à la date de versement ; une date limite pas lue n'est
//  qu'une estimation ; ambre = un geste à faire ; aucun QR fabriqué (seulement celui envoyé).
// ════════════════════════════════════════════════════════════════════════════
(function () {
  'use strict';
  const F = window.FIXTURE; const NOW = Date.parse(F.maintenant);
  const J = 86400000, H = 3600000;
  const $app = document.getElementById('app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
  const euros = (c, signe) => { if (c == null) return '—'; const s = (Math.abs(c) / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }); return (c < 0 ? '−' : signe ? '+' : '') + s + ' €'; };
  const tz = { timeZone: 'Europe/Paris' };
  const debutJour = (t) => { const d = new Date(new Date(t).toLocaleString('en-US', tz)); d.setHours(0, 0, 0, 0); return t - (new Date(new Date(t).toLocaleString('en-US', tz)) - d); };
  const jour = (iso) => { const t = Date.parse(iso); if (!t) return ''; const dj = Math.round((debutJour(t) - debutJour(NOW)) / J);
    if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
    if (dj > 1 && dj < 7) return new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', ...tz });
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...tz }); };
  const heure = (iso) => new Date(Date.parse(iso)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...tz });
  const mois = new Date(NOW).toLocaleDateString('fr-FR', { month: 'long', ...tz });
  const debutMois = Date.parse('2026-11-01T00:00:00+01:00');

  // ── Le dessin d'une paire (aucune photo réelle) : une basket en trait, sa teinte. ──
  const paire = (teinte, t = 56) => `<svg class="ph" width="${t}" height="${t}" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" class="ph-fond"/>
<path d="M9 68c1-9 9-13 18-16l15-8c5-3 8-9 14-9 5 0 8 5 13 8 9 5 17 7 21 14 2 4 2 8 1 11z" fill="hsl(${teinte} 26% 62%)" class="ph-trait"/>
<path d="M9 68h82l-1 6c-24 3-56 3-78 1-3 0-4-3-3-7z" class="ph-semelle ph-trait"/>
<path d="M27 59c9-6 22-7 30-3" class="ph-ligne"/><path d="M45 46l5 5M50 42l5 5M56 39l4 5" class="ph-ligne"/></svg>`;
  const ico = {
    chevron: '<path d="M9 5l7 7-7 7" />', loupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/>', aide: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.4 2.4 0 1 1 3.4 2.2c-.6.3-1 .8-1 1.5v.4"/><path d="M12 16.6v.4"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2"/>', code: '<path d="M4 7h16M4 12h16M4 17h10"/>', imprimer: '<path d="M7 9V4h10v5M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7z"/>',
    republier: '<path d="M19 10a7 7 0 0 0-13-2M5 4v4h4M5 14a7 7 0 0 0 13 2M19 20v-4h-4"/>', crayon: '<path d="M4 20l1-4L16 5l3 3L8 19zM14 7l3 3"/>', coche: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', bas: '<path d="M7 10l5 5 5-5"/>',
  };
  const I = (n, t = 22) => `<svg class="ico" width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ico[n]}</svg>`;

  // ── Ce que la fixture dit, par identité (jamais par titre) ──
  const ventes = F.ventes, achats = F.achats, annonces = F.annonces;
  const aEnvoyer = ventes.filter((v) => v.etat === 'a_envoyer').sort((a, b) => (a.bordereau ? Date.parse(a.bordereau.limite) : 9e15) - (b.bordereau ? Date.parse(b.bordereau.limite) : 9e15));
  const aImprimer = aEnvoyer.filter((v) => v.bordereau);
  const enRoute = ventes.filter((v) => v.etat === 'en_route'), payees = ventes.filter((v) => v.etat === 'payee');
  const duJour = ventes.filter((v) => Date.parse(v.date) >= debutJour(NOW));
  const sansCout = ventes.filter((v) => v.cout == null);
  const versees = payees.filter((v) => v.verseLe && Date.parse(v.verseLe) >= debutMois).sort((a, b) => Date.parse(b.verseLe) - Date.parse(a.verseLe));
  const avecCout = ventes.filter((v) => v.cout != null);
  const dorment = annonces.filter((a) => NOW - Date.parse(a.enLigneLe) > 60 * J), sansNum = annonces.filter((a) => !a.numero);
  const points = []; for (const c of F.colis) { let p = points.find((x) => x.nom === c.point); if (!p) points.push(p = { nom: c.point, adresse: c.adresse, colis: [] }); p.colis.push(c); }
  points.forEach((p) => { p.limite = Math.min(...p.colis.map((c) => Date.parse(c.limite))); }); points.sort((a, b) => a.limite - b.limite);
  const achRoute = achats.filter((a) => a.etat === 'en_route'), achArrives = achats.filter((a) => a.etat === 'arrive');

  // ── La ROUTE (dans l'adresse : #ecran=ventes&filtre=route&fiche=124) ──
  const lire = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const aller = (r) => { location.hash = new URLSearchParams(Object.entries(r).filter(([, v]) => v)).toString(); };

  // ── LA LIGNE : photo 56, le N° en grand (serif), le titre dessous, le prix à droite, UN état. ──
  const ligne = ({ cle, visuel, n, mot, sous, valeur, etat, ambre, geste, ouvrir, glisse }) => `
<li class="li${glisse ? ' is-ouverte' : ''}" data-cle="${esc(cle)}">
  ${geste ? `<button class="li-geste" type="button" tabindex="-1" data-geste="${esc(cle)}">${I(geste.ico, 22)}<span>${esc(geste.mot)}</span></button>` : ''}
  <button class="li-corps" type="button" ${ouvrir ? `data-ouvrir="${esc(ouvrir)}"` : ''} ${geste ? 'data-glisse=""' : ''}>
    <span class="li-v">${visuel}</span>
    <span class="li-m">${n !== undefined ? `<span class="li-n">${n ? `<span class="li-npre">N°</span>${esc(n)}` : '<span class="li-sansn">sans N°</span>'}</span>` : `<span class="li-mot">${mot}</span>`}<span class="li-sous">${esc(sous || '')}</span></span>
    <span class="li-d">${valeur != null ? `<span class="li-val">${valeur}</span>` : ''}${etat ? `<span class="li-etat${ambre ? ' is-ambre' : ''}">${etat}</span>` : ''}</span>
  </button>
</li>`;
  const groupe = (titre, n, lignes, cle) => `<section class="gr" data-groupe="${esc(cle || titre || '')}">${titre ? `<h2 class="gr-t"><span>${esc(titre)}</span>${n != null ? `<span class="gr-n">${nb(n)}</span>` : ''}</h2>` : ''}<ul class="ls">${lignes.join('')}</ul></section>`;
  const venteLigne = (v, etat, ambre, o = {}) => ligne({ cle: v.tx, visuel: paire(v.teinte), n: v.numero, sous: v.titre, valeur: euros(v.prix), etat, ambre, ouvrir: v.numero, ...o });
  const tache = (cle, mot, sous, visuel, etat, versEcran) => ligne({ cle, visuel, mot: esc(mot), sous, valeur: etat ? null : I('chevron', 18), etat: etat ? `<i class="pt"></i>${esc(etat)}` : '', ambre: !!etat, ouvrir: 'ecran:' + versEcran });
  const pile = (teintes) => `<span class="pile">${teintes.slice(0, 3).map((t, i) => `<span class="pile-p" style="--i:${i}">${paire(t, 44)}</span>`).join('')}</span>`;
  const tuile = (n) => `<span class="tuile">${I(n, 24)}</span>`;

  // ══ LES CINQ ÉCRANS ══ chacun : sur (nom), chiffre, légende, filtres, plein, corps.
  const ECRANS = {
    journee(r) {
      const p0 = points[0];
      const corps = r.filtre === 'vendu' ? groupe(null, null, duJour.map((v) => venteLigne(v, heure(v.date))))
        : r.filtre === 'attente' ? groupe(null, null, aEnvoyer.filter((v) => !v.bordereau).map((v) => venteLigne(v, `vendue ${jour(v.date)}`)))
        : groupe(null, null, [
          tache('retirer', `Retirer ${F.colis.length} colis`, `${points.length} points relais · ${p0.nom} d’abord`, tuile('qr'), `avant ${jour(new Date(p0.limite).toISOString())}`, 'achats'),
          tache('ranger', `Ranger ${F.sansCase.length} paires`, 'numérotées, sans case notée', pile(annonces.filter((a) => a.numero && !a.cas).map((a) => a.teinte)), '', 'annonces'),
          tache('publier', `Publier ${F.aPublier.length} paires`, 'rangées, en ligne nulle part', pile(F.aPublier.map((a) => a.teinte)), '', 'annonces'),
          tache('prix', `Saisir ${sansCout.length} prix d’achat`, 'paires vendues sans coût', pile(sansCout.map((v) => v.teinte)), '', 'argent'),
          tache('dorment', `Revoir ${dorment.length} annonces`, 'en ligne depuis plus de 60 jours', pile(dorment.map((a) => a.teinte)), '', 'annonces'),
        ], 'faire') + (duJour.length ? groupe('Vendu aujourd’hui', null, duJour.map((v) => venteLigne(v, heure(v.date))), 'vendu-jour') : '');
      return { sur: new Date(NOW).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...tz }), chiffre: euros(duJour.reduce((t, v) => t + v.prix, 0)), legende: `vendu aujourd’hui · ${duJour.length} ventes`,
        filtres: [['', 'À faire'], ['vendu', 'Vendu aujourd’hui', duJour.length], ['attente', 'Bordereau attendu', aEnvoyer.filter((v) => !v.bordereau).length]],
        plein: aImprimer.length ? { mot: `Imprimer ${aImprimer.length}`, ico: 'imprimer' } : null, corps };
    },
    ventes(r) {
      let corps;
      if (r.filtre === 'route') corps = groupe(null, null, enRoute.map((v) => venteLigne(v, `vendue ${jour(v.date)}`)));
      else if (r.filtre === 'payees') corps = groupe(null, null, payees.map((v) => venteLigne(v, v.verseLe ? `versée ${jour(v.verseLe)}` : '—')));
      else {
        const g = new Map();
        for (const v of aEnvoyer) { const k = v.bordereau ? 'À poster avant ' + jour(v.bordereau.limite) : 'Bordereau pas encore reçu'; if (!g.has(k)) g.set(k, []); g.get(k).push(v); }
        let i = 0;
        corps = [...g.entries()].map(([k, vs]) => groupe(k, vs.length, vs.map((v) => { const h = v.bordereau ? (Date.parse(v.bordereau.limite) - NOW) / H : null; i++;
          return venteLigne(v, v.bordereau ? `${h < 36 ? '<i class="pt"></i>' : ''}${heure(v.bordereau.limite)}` : `vendue ${jour(v.date)}`, h != null && h < 36,
            { geste: v.bordereau ? { mot: 'Imprimer', ico: 'imprimer' } : null, glisse: r.glisse === '1' && i === 2 }); }), k)).join('');
      }
      return { sur: 'Ventes', chiffre: nb(aEnvoyer.length), legende: 'à envoyer', filtres: [['', 'À envoyer'], ['route', 'En route', enRoute.length], ['payees', 'Payées', payees.length]],
        plein: aImprimer.length ? { mot: `Imprimer ${aImprimer.length}`, ico: 'imprimer' } : null, corps };
    },
    annonces(r) {
      const l = r.filtre === 'dorment' ? dorment : r.filtre === 'sansnum' ? sansNum : annonces;
      const corps = groupe(null, null, l.map((a, i) => { const j = Math.floor((NOW - Date.parse(a.enLigneLe)) / J);
        return ligne({ cle: a.id, visuel: paire(a.teinte), n: a.numero, sous: a.titre, valeur: euros(a.prix), etat: `${j > 60 ? '<i class="pt"></i>' : ''}${j === 0 ? 'aujourd’hui' : j + ' j'}`, ambre: j > 60,
          geste: { mot: 'Republier', ico: 'republier' }, ouvrir: a.numero, glisse: r.glisse === '1' && i === 1 }); }));
      return { sur: 'Annonces', chiffre: nb(annonces.length), legende: `en ligne · ${F.comptes.length} comptes`, filtres: [['', 'En ligne'], ['dorment', 'Qui dorment', dorment.length], ['sansnum', 'Sans N°', sansNum.length]],
        plein: F.aPublier.length ? { mot: `Publier ${F.aPublier.length}`, ico: 'republier' } : null, corps };
    },
    achats(r) {
      let corps;
      if (r.filtre === 'route' || r.filtre === 'arrives') corps = groupe(null, null, (r.filtre === 'route' ? achRoute : achArrives).map((a) => ligne({ cle: a.tx, visuel: paire(a.teinte), mot: esc(a.titre), sous: `acheté ${jour(a.date)} · ${a.compte}`, valeur: euros(a.prix), etat: r.filtre === 'arrives' ? '<i class="pt"></i>à numéroter' : '', ambre: r.filtre === 'arrives' })));
      else corps = points.map((p) => `<section class="gr lieu" data-groupe="${esc(p.nom)}"><h2 class="lieu-t"><span>${esc(p.nom)}</span><span class="li-etat is-ambre"><i class="pt"></i>avant ${esc(jour(new Date(p.limite).toISOString()))}</span></h2><p class="lieu-a">${esc(p.adresse)} · ${esc(p.colis[0].transporteur)}</p>
        <ul class="ls">${p.colis.map((c) => ligne({ cle: c.id, visuel: paire(c.teinte), mot: `<span class="code">${esc(c.code)}</span>`, sous: c.art, valeur: c.qr ? `<span class="badge-qr">${I('qr', 20)}</span>` : I('chevron', 18), ouvrir: 'colis:' + c.id })).join('')}</ul></section>`).join('');
      return { sur: 'Achats', chiffre: nb(F.colis.length), legende: `à retirer · ${points.length} points relais`, filtres: [['', 'À retirer'], ['route', 'En route', achRoute.length], ['arrives', 'Arrivés', achArrives.length]],
        plein: { mot: 'Montrer le code', ico: 'qr', ouvrir: 'colis:' + points[0].colis[0].id }, corps };
    },
    argent() {
      const dispo = F.portemonnaie.reduce((t, x) => t + x.dispo, 0), attente = F.portemonnaie.reduce((t, x) => t + x.attente, 0);
      const benef = avecCout.reduce((t, v) => t + v.prix - v.cout, 0);
      const corps = groupe(null, null, [
        ligne({ cle: 'dispo', visuel: tuile('code'), mot: 'Disponible', sous: `sur Vinted · ${F.portemonnaie.length} comptes`, valeur: euros(dispo) }),
        ligne({ cle: 'attente', visuel: tuile('code'), mot: 'En attente', sous: 'ventes pas encore confirmées', valeur: euros(attente) }),
        ligne({ cle: 'benef', visuel: tuile('code'), mot: 'Bénéfice', sous: `au moins · ${avecCout.length} ventes sur ${ventes.length}`, valeur: euros(benef) }),
        ligne({ cle: 'urssaf', visuel: tuile('code'), mot: 'URSSAF', sous: `${mois}`, valeur: '—', etat: '<i class="pt"></i>régime à choisir', ambre: true }),
      ], 'soldes') + groupe(`Versements de ${mois}`, null, versees.map((v) => venteLigne(v, jour(v.verseLe))), 'versements');
      return { sur: 'Argent', chiffre: euros(versees.reduce((t, v) => t + v.prix, 0)), legende: `reçu en ${mois} · ${versees.length} versements`,
        filtres: [['', mois.replace(/^./, (c) => c.toUpperCase())], ['octobre', 'Octobre'], ['annee', '2026']], plein: sansCout.length ? { mot: `Saisir ${sansCout.length} prix`, ico: 'crayon' } : null, corps };
    },
  };
  const NOMS = [['journee', 'Journée'], ['annonces', 'Annonces'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['argent', 'Argent']];

  // ══ LES FEUILLES ══
  const fiche = (numero) => {
    const v = ventes.find((x) => x.numero === numero); const a = annonces.find((x) => x.numero === numero);
    const o = v || a; if (!o) return null;
    const vie = [];
    if (v && v.achat) vie.push(['fait', 'Achetée', `${jour(v.achat.date)} · ${euros(v.achat.prix)}`]); else vie.push([v && v.cout != null ? 'fait' : 'passu', 'Achat', v && v.cout != null ? `coût saisi ${euros(v.cout)}` : '—']);
    vie.push(o.cas ? ['fait', `Case ${o.cas}`, ''] : ['passu', 'Case', '—']);
    vie.push(['fait', v ? 'Était en ligne' : 'En ligne', o.enLigneLe ? `${Math.floor(((v ? Date.parse(v.date) : NOW) - Date.parse(o.enLigneLe)) / J)} j · ${o.fav} favoris` : '—']);
    if (v) {
      vie.push(['fait', 'Vendue', `${jour(v.date)} · ${euros(v.prix)}`]);
      if (v.etat === 'a_envoyer') { vie.push(v.bordereau ? ['fait', 'Bordereau reçu', jour(v.bordereau.recu)] : ['passu', 'Bordereau', 'pas encore reçu']); vie.push(['geste', 'À poster', v.bordereau ? `avant ${jour(v.bordereau.limite)} ${heure(v.bordereau.limite)}` : '—']); }
      else vie.push(['fait', v.etat === 'payee' ? 'Livrée' : 'Envoyée', '']);
      vie.push(v.verseLe ? ['fait', 'Argent versé', jour(v.verseLe)] : ['avenir', 'Argent', 'à la confirmation']);
    } else vie.push(['avenir', 'Vente', '']);
    const marge = v && v.cout != null ? v.prix - v.cout : null;
    const corps = `<div class="fi-tete">${paire(o.teinte, 112)}<div class="fi-id"><div class="fi-n"><span class="li-npre">N°</span>${esc(numero)}</div><p class="fi-titre">${esc(o.titre)}</p><p class="fi-compte">${esc(o.compte)}</p></div></div>
<dl class="trio"><div><dt>${v ? 'Vendue' : 'Prix'}</dt><dd>${euros(o.prix)}</dd></div><div><dt>Coût</dt><dd>${euros(v ? v.cout : null)}</dd></div><div><dt>Marge</dt><dd>${marge == null ? '—' : euros(marge, true)}</dd></div></dl>
<ol class="vie">${vie.map(([e, t, d]) => `<li class="vie-e is-${e}"><span class="vie-p">${e === 'fait' ? I('coche', 14) : ''}</span><span class="vie-t">${esc(t)}</span><span class="vie-d${e === 'geste' ? ' is-ambre' : ''}">${esc(d)}</span></li>`).join('')}</ol>`;
    const pied = v && v.etat === 'a_envoyer' && v.bordereau ? `<button class="plein plein-l" type="button" data-plein="">${I('imprimer', 20)}<span>Imprimer le bordereau</span></button>` : !v ? `<button class="plein plein-l" type="button" data-plein="">${I('republier', 20)}<span>Republier</span></button>` : '';
    return { corps, pied, label: `N° ${numero}` };
  };
  const feuilleColis = (id) => {
    const c = F.colis.find((x) => x.id === id); if (!c) return null;
    const qr = c.qr ? `<svg class="qr" viewBox="-2 -2 ${c.qr.n + 4} ${c.qr.n + 4}" role="img" aria-label="QR de retrait envoyé par ${esc(c.transporteur)}"><rect x="-2" y="-2" width="${c.qr.n + 4}" height="${c.qr.n + 4}" fill="#fff"/><path d="${c.qr.d}" fill="#111"/></svg>` : '';
    const corps = `<div class="re"><p class="re-lieu">${esc(c.point)}</p><p class="re-adr">${esc(c.adresse)} · ${esc(c.transporteur)}</p><div class="re-code" aria-label="Code de retrait ${esc(c.code)}">${esc(c.code.slice(0, 3))}<span class="re-esp"></span>${esc(c.code.slice(3))}</div>${qr}<p class="re-art">${esc(c.art)} · avant ${esc(jour(c.limite))}</p></div>`;
    return { corps, pied: `<button class="plein plein-l" type="button" data-plein="">${I('coche', 20)}<span>C’est retiré</span></button>`, label: `Code ${c.code}`, cran: 'grand' };
  };

  // ══ LE RENDU ══
  function rendre() {
    const r = lire(); const e = ECRANS[r.ecran] ? r.ecran : 'journee';
    const V = ECRANS[e](r);
    const f = r.fiche ? fiche(r.fiche) : r.colis ? feuilleColis(r.colis) : null;
    document.title = `VRM · ${NOMS.find((x) => x[0] === e)[1]}`;
    $app.dataset.ecran = e;
    $app.innerHTML = `
<header class="lire" data-zone="lire">
  <div class="lire-l"><span class="sur">${esc(V.sur)}</span><button class="aide" type="button" aria-label="Comment marche cet écran">${I('aide', 22)}</button></div>
  <p class="affiche"><span class="chiffre">${V.chiffre}</span><span class="legende">${esc(V.legende)}</span></p>
</header>
<main class="liste" data-zone="liste">${V.corps}</main>
<div class="pouce" data-zone="pouce">
  <div class="filtres" role="tablist" aria-label="Filtres">${V.filtres.map(([k, m, n]) => `<button class="filtre" role="tab" type="button" aria-selected="${(r.filtre || '') === k}" data-filtre="${k}"><span>${esc(m)}</span>${(r.filtre || '') !== k && n != null ? `<span class="filtre-n">${nb(n)}</span>` : ''}</button>`).join('')}<button class="filtre filtre-c" type="button"><span>Tous les comptes</span>${I('bas', 16)}</button></div>
  <div class="pouce-l"><label class="cherche">${I('loupe', 20)}<input type="search" enterkeyhint="search" placeholder="Chercher" aria-label="Chercher dans ${esc(NOMS.find((x) => x[0] === e)[1])}"></label>${V.plein ? `<button class="plein" type="button" data-plein="" ${V.plein.ouvrir ? `data-ouvrir="${V.plein.ouvrir}"` : ''}>${I(V.plein.ico, 20)}<span>${esc(V.plein.mot)}</span></button>` : ''}</div>
  <nav class="onglets" aria-label="Écrans">${NOMS.map(([k, m]) => `<button class="onglet" type="button" data-ecran="${k}" ${k === e ? 'aria-current="page"' : ''}>${m}</button>`).join('')}</nav>
</div>
${f ? `<div class="voile" data-fermer=""><div class="feuille is-${r.cran || f.cran || 'moyen'}" role="dialog" aria-modal="true" aria-label="${esc(f.label)}"><div class="poignee"><span></span></div><div class="feuille-c">${f.corps}</div>${f.pied ? `<div class="feuille-p">${f.pied}</div>` : ''}</div></div>` : ''}`;
    brancher(r, e);
  }

  function brancher(r, e) {
    $app.querySelectorAll('[data-ecran]').forEach((b) => b.addEventListener('click', () => aller({ ecran: b.dataset.ecran })));
    $app.querySelectorAll('[data-filtre]').forEach((b) => b.addEventListener('click', () => aller({ ecran: e, filtre: b.dataset.filtre })));
    const ouvrir = (v) => { if (!v) return; if (v.startsWith('ecran:')) return aller({ ecran: v.slice(6) }); if (v.startsWith('colis:')) return aller({ ecran: e, filtre: r.filtre, colis: v.slice(6) }); aller({ ecran: e, filtre: r.filtre, fiche: v }); };
    $app.querySelectorAll('[data-ouvrir]').forEach((b) => b.addEventListener('click', () => { if (b.closest('.li') && b.closest('.li').classList.contains('is-ouverte')) { b.closest('.li').classList.remove('is-ouverte'); return; } ouvrir(b.dataset.ouvrir); }));
    const v = $app.querySelector('.voile');
    if (v) {
      const fer = () => aller({ ecran: e, filtre: r.filtre });
      v.addEventListener('click', (ev) => { if (ev.target === v) fer(); });
      addEventListener('keydown', function k(ev) { if (ev.key === 'Escape') { removeEventListener('keydown', k); fer(); } });
      poignee(v.querySelector('.feuille'), fer);
    }
    $app.querySelectorAll('[data-glisse]').forEach(glisser);
  }

  // LE GLISSEMENT : la ligne suit le doigt 1:1 (après 10 px dans l'axe), résiste au-delà du bord,
  // s'ouvre sur son geste (96 px) ou, lancée jusqu'au bout, fait le geste. Toucher une ligne ouverte la referme.
  function glisser(btn) {
    const li = btn.closest('.li'); let s = null;
    btn.addEventListener('pointerdown', (ev) => { s = { x0: ev.clientX, y0: ev.clientY, base: li.classList.contains('is-ouverte') ? -96 : 0, axe: null, pts: [[ev.clientX, ev.timeStamp]] }; });
    btn.addEventListener('pointermove', (ev) => {
      if (!s) return; const dx = ev.clientX - s.x0, dy = ev.clientY - s.y0;
      if (!s.axe) { if (Math.hypot(dx, dy) < 10) return; s.axe = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'; if (s.axe === 'x') { btn.setPointerCapture(ev.pointerId); li.classList.add('is-tenue'); } }
      if (s.axe !== 'x') return; let x = s.base + dx; if (x > 0) x *= 0.2; s.x = x; s.pts.push([ev.clientX, ev.timeStamp]); if (s.pts.length > 5) s.pts.shift();
      btn.style.transform = `translateX(${x}px)`;
    });
    const fin = () => { if (!s || s.axe !== 'x') { s = null; return; } const [a, b] = [s.pts[0], s.pts[s.pts.length - 1]]; const vit = (b[0] - a[0]) / Math.max(1, b[1] - a[1]);
      li.classList.remove('is-tenue'); btn.style.transform = ''; li.classList.toggle('is-ouverte', s.x < -48 || vit < -0.3); s = null; };
    btn.addEventListener('pointerup', fin); btn.addEventListener('pointercancel', fin);
  }
  // LA FEUILLE : tirée vers le haut ⇒ grand cran ; vers le bas ⇒ cran moyen, puis fermée. Lancer compte autant que tirer.
  function poignee(fe, fermer) {
    const p = fe.querySelector('.poignee'); let s = null;
    p.addEventListener('pointerdown', (ev) => { s = { y0: ev.clientY, t0: ev.timeStamp }; p.setPointerCapture(ev.pointerId); fe.classList.add('is-tenue'); });
    p.addEventListener('pointermove', (ev) => { if (!s) return; const d = ev.clientY - s.y0; fe.style.transform = `translateY(${d < 0 ? d * 0.25 : d}px)`; });
    const fin = (ev) => { if (!s) return; const d = ev.clientY - s.y0, v = d / Math.max(1, ev.timeStamp - s.t0); s = null; fe.classList.remove('is-tenue'); fe.style.transform = '';
      if (d < -40 || v < -0.5) { fe.classList.remove('is-moyen'); fe.classList.add('is-grand'); } else if (d > 100 || v > 0.6) { if (fe.classList.contains('is-grand')) { fe.classList.remove('is-grand'); fe.classList.add('is-moyen'); } else fermer(); } };
    p.addEventListener('pointerup', fin); p.addEventListener('pointercancel', fin);
  }

  // Le BAS se replie quand on descend la liste (comme Safari), revient dès qu'on remonte.
  let y0 = 0; addEventListener('scroll', () => { const y = scrollY; if (Math.abs(y - y0) < 12) return; document.body.classList.toggle('is-replie', y > y0 && y > 160); y0 = y; }, { passive: true });
  const theme = new URLSearchParams(location.search).get('theme');
  document.documentElement.dataset.theme = theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  let vue = ''; const cleVue = () => { const r = lire(); return (r.ecran || '') + '|' + (r.filtre || ''); };
  addEventListener('hashchange', () => { rendre(); const k = cleVue(); if (k !== vue) { vue = k; scrollTo(0, 0); document.body.classList.remove('is-replie'); } });
  vue = cleVue();
  rendre();
})();
