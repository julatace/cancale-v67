// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE M « UNE MAIN » (17 nov.) — page autonome, aucune dépendance, rien de src/.
//  Le HAUT se lit (le champ vert bouteille : le nom, le menu du compte, LE chiffre) ; le BAS se
//  touche (un contrôle segmenté, la recherche à la Safari + LE geste, la barre d'onglets) ; une ligne
//  se GLISSE (action), s'APPUIE longuement (menu), se TOUCHE (feuille à deux crans).
//  Signature : l'ÉTIQUETTE KRAFT — le N° est celui écrit sur le carton, il a la matière du carton
//  (sur chaque ligne, sur la fiche) ; les colis à retirer sont des étiquettes de colis qu'on fait défiler.
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
  const euros = (c, signe) => { if (c == null) return '—'; const s = (Math.abs(c) / 100).toLocaleString('fr-FR', { minimumFractionDigits: c % 100 ? 2 : 0, maximumFractionDigits: 2 }); return (c < 0 ? '−' : signe ? '+' : '') + s + '<span class="eur">€</span>'; };
  const tz = { timeZone: 'Europe/Paris' };
  const debutJour = (t) => { const d = new Date(new Date(t).toLocaleString('en-US', tz)); const d0 = new Date(d); d0.setHours(0, 0, 0, 0); return t - (d - d0); };
  const jour = (iso) => { const t = Date.parse(iso); if (!t) return ''; const dj = Math.round((debutJour(t) - debutJour(NOW)) / J);
    if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
    if (dj > 1 && dj < 7) return new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', ...tz });
    return new Date(t).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', ...tz }); };
  const heure = (iso) => new Date(Date.parse(iso)).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', ...tz });
  const mois = new Date(NOW).toLocaleDateString('fr-FR', { month: 'long', ...tz });
  const debutMois = Date.parse('2026-11-01T00:00:00+01:00');

  // ══ LA PAIRE, dessinée une fois proprement (aucune photo réelle, aucun logo de marque) ══
  // Trois formes (basse, course, montante), de profil, posées sur un fond uni éclairé du haut, avec leur ombre.
  let nId = 0;
  const FORMES = {
    basse: (c) => `
<path d="M14 76c-3-9-2-21 3-28 3-4 7-5 12-4l16 3c6 1 10-2 14-8l4-6c2-3 6-4 9-2l5 3c9 5 21 14 37 21 14 6 29 8 37 13 4 2 5 6 4 8z" fill="${c.haut}"/>
<path d="M14 76c-3-9-2-21 3-28 3 4 6 14 7 28z" fill="${c.deco}"/>
<path d="M44 76c6-13 20-21 38-22 15-1 27 4 33 12l-3 10z" fill="${c.deco}" opacity=".92"/>
<path d="M128 62c11 1 23 4 27 9 1 2 1 4 0 5h-30c-1-5 0-10 3-14z" fill="${c.deco}" opacity=".9"/>
<path d="M20 48c8-4 22-2 34 0" fill="none" stroke="#1b1b1b" stroke-opacity=".35" stroke-width="1.2" stroke-linecap="round"/>
<path d="M68 38l4 4M74 41l4 4M80 44l4 4M86 47l4 4M92 50l4 4" stroke="${c.detail}" stroke-width="2" stroke-linecap="round"/>
<path d="M10 76h146c3 0 4 2 3 5l-1 3c-1 3-3 4-6 4H16c-4 0-6-2-6-5z" fill="${c.semelle}"/>
<path d="M11 83h147" stroke="#1b1b1b" stroke-opacity=".18" stroke-width="1"/>`,
    course: (c) => `
<path d="M14 66c-3-10-1-22 5-28 4-3 9-3 13-1l14 6c6 2 10-1 14-7l4-6c2-3 6-4 9-2l7 5c10 7 24 15 40 21 13 5 26 6 32 12l2 3z" fill="${c.haut}"/>
<path d="M14 66c-3-10-1-22 5-28 5 6 9 16 10 28z" fill="${c.deco}"/>
<path d="M42 66c10-14 28-21 48-18 12 2 21 9 24 18z" fill="${c.deco}" opacity=".9"/>
<path d="M126 56c12 2 22 4 27 10h-30c0-4 1-8 3-10z" fill="${c.deco}" opacity=".85"/>
<path d="M70 34l4 4M76 38l4 4M82 42l4 4M88 46l4 4" stroke="${c.detail}" stroke-width="2" stroke-linecap="round"/>
<path d="M9 72c0-4 4-7 10-7h124c9 0 15 4 15 10 0 6-6 10-14 10H21c-8 0-12-5-12-13z" fill="${c.semelle}"/>
<path d="M30 76c14-5 26 3 40-1s26-5 40 0 24 3 34-1" fill="none" stroke="${c.detail}" stroke-width="2.4" stroke-linecap="round" opacity=".85"/>
<path d="M20 85h124c3 0 4 3 2 4l-2 1H24c-3 0-5-2-4-5z" fill="#2a2a28"/>`,
    montante: (c) => `
<path d="M18 80c-3-20-2-44 2-60 1-6 6-9 12-8l17 4c4 1 6 4 7 9l4 14c3 7 13 14 30 20 21 6 44 8 58 14 4 2 5 5 4 7z" fill="${c.haut}"/>
<path d="M124 66c12 0 25 3 29 9 1 2 0 4-1 5h-31c-1-5 0-10 3-14z" fill="${c.semelle}"/>
<circle cx="30" cy="44" r="6" fill="${c.semelle}"/>
<path d="M44 20l3 3M50 30l3 3M55 40l3 3M62 48l3 3M71 54l3 3" stroke="${c.detail}" stroke-width="2.2" stroke-linecap="round"/>
<path d="M12 80h142c3 0 4 3 3 6l-1 2c-1 2-3 3-6 3H18c-4 0-6-2-6-5z" fill="${c.semelle}"/>
<path d="M13 84h143" stroke="#1b1b1b" stroke-width="1.2" stroke-opacity=".55"/>`,
  };
  const paire = (look, t = 56, cls = '') => {
    const id = 'g' + (++nId); const l = look || { forme: 'basse', haut: '#ddd', deco: '#999', semelle: '#f4f4f2', detail: '#333' };
    const dy = l.forme === 'montante' ? 34 : 38;
    return `<svg class="ph ${cls}" width="${t}" height="${t}" viewBox="${cls === 'ph-grand' ? '0 30 168 108' : '6 24 156 156'}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs><radialGradient id="${id}f" cx=".5" cy=".18" r=".95"><stop offset="0" class="ph-f1"/><stop offset="1" class="ph-f2"/></radialGradient>
<linearGradient id="${id}l" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect width="168" height="168" fill="url(#${id}f)"/>
<ellipse cx="86" cy="${dy + 90}" rx="68" ry="6" fill="#000" opacity=".13"/>
<g transform="translate(0 ${dy})" stroke="#1b1b1b" stroke-opacity=".5" stroke-width=".8" stroke-linejoin="round">${FORMES[l.forme](l)}</g>
<g transform="translate(0 ${dy})"><path d="M18 46c20-6 50-10 80 4" fill="none" stroke="url(#${id}l)" stroke-width="10" opacity=".6"/></g></svg>`;
  };

  // ── Les icônes : un seul jeu (dessin façon Lucide), trait 1,75, bouts ronds. ──
  const ICO = {
    soleil: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    etiquette: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    colis: '<path d="M11 21.7a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7z"/><path d="M12 22V12M3.3 7 12 12l8.7-5M7.5 4.3l9 5.1"/>',
    sac: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
    portefeuille: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    loupe: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>', aide: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>', bas: '<path d="m6 9 6 6 6-6"/>', imprimer: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
    republier: '<path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/>', crayon: '<path d="M21.2 6.8a2.8 2.8 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z"/>',
    coche: '<path d="M20 6 9 17l-5-5"/>', qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    copier: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12s-8-7-8-12a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  };
  const I = (n, t = 22, w = 1.75) => `<svg class="ico" width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICO[n]}</svg>`;
  // L'ÉTIQUETTE KRAFT du N° (la signature) : la matière du carton, un œillet, le chiffre au serif.
  const tag = (n, cls = '') => (n ? `<span class="tag ${cls}"><span class="tag-o"></span><span class="tag-n">${esc(n)}</span></span>` : `<span class="tag tag-vide ${cls}"><span class="tag-o"></span><span class="tag-n">sans N°</span></span>`);

  // ── Ce que la fixture dit, par identité (jamais par titre) ──
  const ventes = F.ventes, achats = F.achats, annonces = F.annonces;
  const aEnvoyer = ventes.filter((v) => v.etat === 'a_envoyer').sort((a, b) => (a.bordereau ? Date.parse(a.bordereau.limite) : 9e15) - (b.bordereau ? Date.parse(b.bordereau.limite) : 9e15));
  const aImprimer = aEnvoyer.filter((v) => v.bordereau);
  const enRoute = ventes.filter((v) => v.etat === 'en_route'), payees = ventes.filter((v) => v.etat === 'payee');
  const duJour = ventes.filter((v) => Date.parse(v.date) >= debutJour(NOW));
  const sansCout = ventes.filter((v) => v.cout == null);
  const versees = payees.filter((v) => v.verseLe && Date.parse(v.verseLe) >= debutMois).sort((a, b) => Date.parse(b.verseLe) - Date.parse(a.verseLe));
  const avecCout = ventes.filter((v) => v.cout != null);
  const dorment = annonces.filter((a) => NOW - Date.parse(a.enLigneLe) > 60 * J).sort((a, b) => Date.parse(a.enLigneLe) - Date.parse(b.enLigneLe)), sansNum = annonces.filter((a) => !a.numero);
  const sansCase = annonces.filter((a) => a.numero && !a.cas);
  const colisTri = [...F.colis].sort((a, b) => Date.parse(a.limite) - Date.parse(b.limite));
  const achRoute = achats.filter((a) => a.etat === 'en_route'), achArrives = achats.filter((a) => a.etat === 'arrive');

  const lire = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)));
  const aller = (r) => { location.hash = new URLSearchParams(Object.entries(r).filter(([, v]) => v)).toString(); };

  // ── LA LIGNE : vignette 56, l'étiquette du N° et le titre dessous, le prix à droite (serif), UN état sous
  //    le prix, un chevron ; séparateurs inset. Glisser = l'action ; appui long = le menu ; toucher = la feuille.
  const ligne = ({ cle, visuel, n, mot, sous, valeur, etat, ambre, geste, ouvrir, glisse, menu }) => `
<li class="li${glisse ? ' is-ouverte' : ''}" data-cle="${esc(cle)}">
  ${geste ? `<button class="li-geste" type="button" tabindex="-1" data-geste="${esc(cle)}">${I(geste.ico, 22)}<span>${esc(geste.mot)}</span></button>` : ''}
  <button class="li-corps" type="button" ${ouvrir ? `data-ouvrir="${esc(ouvrir)}"` : ''} ${geste ? 'data-glisse=""' : ''} ${menu ? `data-menu="${esc(menu)}"` : ''}>
    <span class="li-v">${visuel}</span>
    <span class="li-m">${n !== undefined ? tag(n) : `<span class="li-mot">${mot}</span>`}<span class="li-sous">${esc(sous || '')}</span>${etat ? `<span class="li-etat${ambre ? ' is-ambre' : ''}">${etat}</span>` : ''}</span>
    <span class="li-d">${valeur != null ? `<span class="li-val">${valeur}</span>` : ''}</span>
    ${ouvrir ? `<span class="li-chev">${I('chevron', 16, 2)}</span>` : ''}
  </button>
</li>`;
  // Un GROUPE : son titre, son compteur, et son geste (un lien) quand il en a un.
  const groupe = (titre, n, lignes, { cle, action, plus } = {}) => `<section class="gr" data-groupe="${esc(cle || titre || '')}">${titre ? `<h2 class="gr-t"><span class="gr-nom">${esc(titre)}${n != null ? ` <span class="gr-n">${nb(n)}</span>` : ''}</span>${action ? `<button class="gr-a" type="button" data-ouvrir="${esc(action.ouvrir)}">${esc(action.mot)}</button>` : ''}</h2>` : ''}<ul class="carte">${lignes.join('')}${plus ? `<li class="li-plus"><button type="button" data-ouvrir="${esc(plus.ouvrir)}"><span>${esc(plus.mot)}</span>${I('chevron', 16, 2)}</button></li>` : ''}</ul></section>`;
  const venteLigne = (v, etat, ambre, o = {}) => ligne({ cle: v.tx, visuel: paire(v.look), n: v.numero, sous: v.titre, valeur: euros(v.prix), etat, ambre, ouvrir: v.numero, menu: v.numero, ...o });
  const avant = (v) => { const h = (Date.parse(v.bordereau.limite) - NOW) / H; return [`${h < 36 ? '<i class="pt"></i>' : ''}avant ${heure(v.bordereau.limite)}`, h < 36]; };

  // ══ LES CINQ ÉCRANS ══ chacun : nom, chiffre, légende, segments (2–3), plein, corps.
  const ECRANS = {
    journee(r) {
      const imp = aImprimer.slice(0, 3).map((v) => { const [e, a] = avant(v); return venteLigne(v, `${jour(v.bordereau.limite)} ${e}`.replace(/^(\S+) (<i class="pt"><\/i>)?avant /, '$2$1 '), a, { geste: { mot: 'Imprimer', ico: 'imprimer' } }); });
      const ret = colisTri.slice(0, 2).map((c) => ligne({ cle: c.id, visuel: paire(c.look), mot: `<span class="code">${esc(c.code)}</span>`, sous: c.point, etat: `<i class="pt"></i>${jour(c.limite)}`, ambre: true, ouvrir: 'colis:' + c.id }));
      const ran = sansCase.slice(0, 2).map((a) => ligne({ cle: a.id, visuel: paire(a.look), n: a.numero, sous: a.titre, valeur: euros(a.prix), ouvrir: a.numero }));
      const prix = sansCout.slice(0, 2).map((v) => venteLigne(v, 'coût —'));
      const corps = r.seg === 'vendu' ? groupe(null, null, duJour.map((v) => venteLigne(v, heure(v.date))))
        : groupe('À imprimer', aImprimer.length, imp, { cle: 'imprimer', plus: aImprimer.length > 3 ? { mot: `Les ${aImprimer.length} bordereaux`, ouvrir: 'ecran:ventes' } : null })
        + groupe('À retirer', F.colis.length, ret, { cle: 'retirer', action: { mot: 'Codes', ouvrir: 'colis:' + colisTri[0].id }, plus: F.colis.length > 2 ? { mot: `Les ${F.colis.length} colis`, ouvrir: 'ecran:achats' } : null })
        + groupe('À ranger', sansCase.length, ran, { cle: 'ranger', action: { mot: 'Ranger', ouvrir: 'ecran:annonces' } })
        + groupe('Prix d’achat à saisir', sansCout.length, prix, { cle: 'prix', action: { mot: 'Saisir', ouvrir: 'ecran:argent' } });
      return { nom: 'Journée', titre: new Date(NOW).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', ...tz }), chiffre: euros(duJour.reduce((t, v) => t + v.prix, 0)), legende: `vendu aujourd’hui · ${duJour.length} ventes`,
        segments: [['', 'À faire'], ['vendu', 'Vendu aujourd’hui']], plein: aImprimer.length ? { mot: `Imprimer ${aImprimer.length}`, ico: 'imprimer' } : null, corps };
    },
    ventes(r) {
      let corps;
      if (r.seg === 'route') corps = groupe(null, null, enRoute.map((v) => venteLigne(v, `vendue ${jour(v.date)}`)));
      else if (r.seg === 'payees') corps = groupe(null, null, payees.map((v) => venteLigne(v, v.verseLe ? `versée ${jour(v.verseLe)}` : '—')));
      else {
        const g = new Map(); let i = 0;
        for (const v of aEnvoyer) { const k = v.bordereau ? 'À poster ' + jour(v.bordereau.limite) : 'Bordereau pas encore reçu'; if (!g.has(k)) g.set(k, []); g.get(k).push(v); }
        corps = [...g.entries()].map(([k, vs]) => groupe(k, vs.length, vs.map((v) => { i++; const [e, a] = v.bordereau ? avant(v) : [`vendue ${jour(v.date)}`, false];
          return venteLigne(v, e, a, { geste: v.bordereau ? { mot: 'Imprimer', ico: 'imprimer' } : null, glisse: r.glisse === '1' && i === 2 }); }), { cle: k })).join('');
      }
      return { nom: 'Ventes', chiffre: nb(aEnvoyer.length), legende: 'à envoyer', segments: [['', 'À envoyer'], ['route', 'En route'], ['payees', 'Payées']],
        plein: aImprimer.length ? { mot: `Imprimer ${aImprimer.length}`, ico: 'imprimer' } : null, corps };
    },
    annonces(r) {
      const l = r.seg === 'dorment' ? dorment : r.seg === 'sansnum' ? sansNum : annonces;
      const corps = groupe(null, null, l.map((a, i) => { const j = Math.floor((NOW - Date.parse(a.enLigneLe)) / J);
        return ligne({ cle: a.id, visuel: paire(a.look), n: a.numero, sous: a.titre, valeur: euros(a.prix), etat: `${j > 60 ? '<i class="pt"></i>' : ''}${j === 0 ? 'aujourd’hui' : j + ' j'}`, ambre: j > 60,
          geste: { mot: 'Republier', ico: 'republier' }, ouvrir: a.numero || 'x', menu: a.numero, glisse: r.glisse === '1' && i === 1 }); }));
      return { nom: 'Annonces', chiffre: nb(annonces.length), legende: 'en ligne', segments: [['', 'En ligne'], ['dorment', 'Qui dorment'], ['sansnum', 'Sans N°']],
        plein: F.aPublier.length ? { mot: `Publier ${F.aPublier.length}`, ico: 'etiquette' } : null, corps };
    },
    achats(r) {
      let corps;
      if (r.seg === 'route' || r.seg === 'arrives') corps = groupe(null, null, (r.seg === 'route' ? achRoute : achArrives).map((a) => ligne({ cle: a.tx, visuel: paire(a.look), mot: esc(a.titre), sous: `acheté ${jour(a.date)}`, valeur: euros(a.prix), etat: r.seg === 'arrives' ? '<i class="pt"></i>à numéroter' : '', ambre: r.seg === 'arrives' })));
      else corps = `<section class="passes" aria-label="Colis à retirer"><div class="passes-r">${colisTri.map((c, i) => passe(c, i)).join('')}</div><div class="passes-p" aria-hidden="true">${colisTri.map((c, i) => `<i class="${i ? '' : 'is-on'}"></i>`).join('')}</div></section>`
        + groupe('En route', achRoute.length, achRoute.slice(0, 3).map((a) => ligne({ cle: a.tx, visuel: paire(a.look), mot: esc(a.titre), sous: `acheté ${jour(a.date)}`, valeur: euros(a.prix) })), { cle: 'route', plus: { mot: `Les ${achRoute.length} achats en route`, ouvrir: 'seg:route' } });
      return { nom: 'Achats', chiffre: nb(F.colis.length), legende: `à retirer · ${new Set(F.colis.map((c) => c.point)).size} points relais`, segments: [['', 'À retirer'], ['route', 'En route'], ['arrives', 'Arrivés']],
        plein: { mot: 'Montrer le code', ico: 'qr', ouvrir: 'colis:' + colisTri[0].id }, corps };
    },
    argent() {
      const dispo = F.portemonnaie.reduce((t, x) => t + x.dispo, 0), attente = F.portemonnaie.reduce((t, x) => t + x.attente, 0);
      const benef = avecCout.reduce((t, v) => t + v.prix - v.cout, 0);
      const corps = groupe(null, null, [ligne({ cle: 'urssaf', visuel: `<span class="tuile">${I('portefeuille', 24)}</span>`, mot: 'URSSAF', sous: `déclaration de ${mois}`, valeur: '—', etat: '<i class="pt"></i>régime à choisir', ambre: true, ouvrir: 'x' })], { cle: 'urssaf' })
        + groupe(`Versements de ${mois}`, versees.length, versees.map((v) => venteLigne(v, jour(v.verseLe))), { cle: 'versements' });
      return { nom: 'Argent', chiffre: euros(versees.reduce((t, v) => t + v.prix, 0)), legende: `reçu en ${mois}`,
        stats: [['Disponible', euros(dispo)], ['En attente', euros(attente)], ['Bénéfice', `≥ ${euros(benef)}`]],
        segments: [['', mois.replace(/^./, (c) => c.toUpperCase())], ['octobre', 'Octobre'], ['annee', '2026']], plein: sansCout.length ? { mot: `Saisir ${sansCout.length} prix`, ico: 'crayon' } : null, corps };
    },
  };
  // UNE ÉTIQUETTE DE COLIS par colis (la carte de passe de VRM) : le lieu, la date limite, le code en grand, le QR s'il a été ENVOYÉ.
  function passe(c, i) {
    const qr = c.qr ? `<svg class="qr" viewBox="-1 -1 ${c.qr.n + 2} ${c.qr.n + 2}" role="img" aria-label="QR envoyé par ${esc(c.transporteur)}"><rect x="-1" y="-1" width="${c.qr.n + 2}" height="${c.qr.n + 2}" fill="#fff"/><path d="${c.qr.d}" fill="#111"/></svg>` : `<span class="qr qr-sans">${I('qr', 28, 1.5)}<span>code seul</span></span>`;
    return `<button type="button" class="passe" data-ouvrir="colis:${esc(c.id)}" aria-label="Colis ${i + 1} sur ${F.colis.length}">
  <span class="passe-h"><span class="passe-lieu">${I('pin', 18)}<span>${esc(c.point)}</span></span><span class="passe-lim"><i class="pt"></i>${esc(jour(c.limite))}</span></span>
  <span class="passe-c">${qr}<span class="passe-code"><span class="passe-k">Code</span><span class="passe-v">${esc(c.code)}</span></span></span>
  <span class="passe-b">${paire(c.look, 40)}<span class="passe-art">${esc(c.art)}</span><span class="passe-t">${esc(c.transporteur)}</span></span>
</button>`;
  }
  const NOMS = [['journee', 'Journée', 'soleil'], ['annonces', 'Annonces', 'etiquette'], ['ventes', 'Ventes', 'colis'], ['achats', 'Achats', 'sac'], ['argent', 'Argent', 'portefeuille']];

  // ══ LES FEUILLES ══
  const fiche = (numero) => {
    const v = ventes.find((x) => x.numero === numero); const a = annonces.find((x) => x.numero === numero);
    const o = v || a; if (!o) return null;
    const vie = [];
    if (v && v.achat) vie.push(['fait', 'Achetée', `${jour(v.achat.date)} · ${euros(v.achat.prix)}`]); else vie.push([v && v.cout != null ? 'fait' : 'passu', 'Achat', v && v.cout != null ? 'coût saisi' : '—']);
    vie.push(o.cas ? ['fait', `Rangée en ${o.cas}`, ''] : ['passu', 'Case', '—']);
    vie.push(['fait', v ? 'Était en ligne' : 'En ligne', o.enLigneLe ? `${Math.floor(((v ? Date.parse(v.date) : NOW) - Date.parse(o.enLigneLe)) / J)} j · ${o.fav} favoris` : '—']);
    if (v) {
      vie.push(['fait', 'Vendue', jour(v.date)]);
      if (v.etat === 'a_envoyer') { vie.push(v.bordereau ? ['fait', 'Bordereau reçu', jour(v.bordereau.recu)] : ['passu', 'Bordereau', 'pas encore reçu']); vie.push(['geste', 'À poster', v.bordereau ? `avant ${jour(v.bordereau.limite)} ${heure(v.bordereau.limite)}` : '—']); }
      else vie.push(['fait', v.etat === 'payee' ? 'Livrée' : 'Envoyée', '']);
      vie.push(v.verseLe ? ['fait', 'Argent versé', jour(v.verseLe)] : ['avenir', 'Argent', 'à la confirmation']);
    } else vie.push(['avenir', 'Vente', '']);
    const marge = v && v.cout != null ? v.prix - v.cout : null;
    const corps = `<div class="fi-photo">${paire(o.look, 220, 'ph-grand')}${tag(numero, 'tag-grand')}</div>
<p class="fi-titre">${esc(o.titre)}</p><p class="fi-compte">${esc(o.compte)}</p>
<dl class="trio"><div><dt>${v ? 'Vendue' : 'Prix'}</dt><dd>${euros(o.prix)}</dd></div><div><dt>Coût</dt><dd>${euros(v ? v.cout : null)}</dd></div><div><dt>Marge</dt><dd>${marge == null ? '—' : euros(marge, true)}</dd></div></dl>
<ol class="vie">${vie.map(([e, t, d]) => `<li class="vie-e is-${e}"><span class="vie-p">${e === 'fait' ? I('coche', 14, 2.4) : ''}</span><span class="vie-t">${esc(t)}</span><span class="vie-d${e === 'geste' ? ' is-ambre' : ''}">${d}</span></li>`).join('')}</ol>`;
    const pied = v && v.etat === 'a_envoyer' && v.bordereau ? `<button class="plein plein-l" type="button" data-plein="">${I('imprimer', 20)}<span>Imprimer le bordereau</span></button>` : !v ? `<button class="plein plein-l" type="button" data-plein="">${I('republier', 20)}<span>Republier</span></button>` : '';
    return { corps, pied, label: `N° ${numero}` };
  };
  const feuilleColis = (id) => {
    const c = F.colis.find((x) => x.id === id); if (!c) return null;
    const qr = c.qr ? `<svg class="qr qr-grand" viewBox="-2 -2 ${c.qr.n + 4} ${c.qr.n + 4}" role="img" aria-label="QR de retrait envoyé par ${esc(c.transporteur)}"><rect x="-2" y="-2" width="${c.qr.n + 4}" height="${c.qr.n + 4}" fill="#fff"/><path d="${c.qr.d}" fill="#111"/></svg>` : '';
    const corps = `<div class="re"><p class="re-lieu">${esc(c.point)}</p><p class="re-adr">${esc(c.adresse)} · ${esc(c.transporteur)}</p>${qr}<div class="re-code" aria-label="Code de retrait ${esc(c.code)}">${esc(c.code)}</div><p class="re-art"><i class="pt"></i>avant ${esc(jour(c.limite))} · ${esc(c.art)}</p></div>`;
    return { corps, pied: `<button class="plein plein-l" type="button" data-plein="">${I('coche', 20, 2.2)}<span>C’est retiré</span></button>`, label: `Code ${c.code}`, cran: 'ajuste' };
  };
  // LE MENU CONTEXTUEL (appui long sur une ligne) : les gestes de la paire.
  const menuDe = (numero) => `<div class="voile voile-menu" data-fermer=""><div class="menu" role="menu" aria-label="N° ${esc(numero)}"><div class="menu-t">${tag(numero)}</div><button role="menuitem" type="button"><span>Ouvrir la fiche</span>${I('chevron', 20)}</button><button role="menuitem" type="button"><span>Imprimer le bordereau</span>${I('imprimer', 20)}</button><button role="menuitem" type="button"><span>Republier</span>${I('republier', 20)}</button><button role="menuitem" type="button"><span>Copier le N°</span>${I('copier', 20)}</button></div></div>`;

  // ══ LE RENDU ══
  function rendre() {
    const r = lire(); const e = ECRANS[r.ecran] ? r.ecran : 'journee';
    const V = ECRANS[e](r);
    const f = r.fiche ? fiche(r.fiche) : r.colis ? feuilleColis(r.colis) : null;
    document.title = `VRM · ${V.nom}`;
    $app.dataset.ecran = e;
    const seg = r.seg || '';
    $app.innerHTML = `
<header class="lire" data-zone="lire">
  <div class="lire-l"><h1 class="titre">${esc(V.titre || V.nom)}</h1><button class="aide" type="button" aria-label="Comment marche ${esc(V.nom)}">${I('aide', 22)}</button></div>
  <button class="compte" type="button" aria-haspopup="menu"><span>Tous les comptes</span>${I('bas', 16, 2)}</button>
  <p class="affiche"><span class="chiffre">${V.chiffre}</span><span class="legende">${esc(V.legende)}</span></p>
  ${V.stats ? `<dl class="stats">${V.stats.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>` : ''}
</header>
<main class="liste" data-zone="liste">${V.corps}</main>
<div class="pouce" data-zone="pouce">
  <div class="seg" role="tablist" aria-label="Afficher" style="--n:${V.segments.length};--i:${Math.max(0, V.segments.findIndex(([k]) => k === seg))}"><span class="seg-curseur" aria-hidden="true"></span>${V.segments.map(([k, m]) => `<button class="seg-b" role="tab" type="button" aria-selected="${seg === k}" data-seg="${k}">${esc(m)}</button>`).join('')}</div>
  <div class="pouce-l"><label class="cherche">${I('loupe', 20)}<input type="search" enterkeyhint="search" placeholder="Chercher" aria-label="Chercher dans ${esc(V.nom)}"></label>${V.plein ? `<button class="plein" type="button" data-plein="" ${V.plein.ouvrir ? `data-ouvrir="${V.plein.ouvrir}"` : ''}>${I(V.plein.ico, 20)}<span>${esc(V.plein.mot)}</span></button>` : ''}</div>
  <nav class="onglets" aria-label="Écrans">${NOMS.map(([k, m, ic]) => `<button class="onglet" type="button" data-ecran="${k}" ${k === e ? 'aria-current="page"' : ''}>${I(ic, 24, k === e ? 2.1 : 1.6)}<span>${m}</span></button>`).join('')}</nav>
</div>
${f ? `<div class="voile" data-fermer=""><div class="feuille is-${r.cran || f.cran || 'moyen'}" role="dialog" aria-modal="true" aria-label="${esc(f.label)}"><div class="poignee"><span></span></div><div class="feuille-c">${f.corps}</div>${f.pied ? `<div class="feuille-p">${f.pied}</div>` : ''}</div></div>` : ''}
${r.menu ? menuDe(r.menu) : ''}`;
    brancher(r, e);
  }

  function brancher(r, e) {
    $app.querySelectorAll('[data-ecran]').forEach((b) => b.addEventListener('click', () => aller({ ecran: b.dataset.ecran })));
    $app.querySelectorAll('[data-seg]').forEach((b) => b.addEventListener('click', () => aller({ ecran: e, seg: b.dataset.seg })));
    const ouvrir = (v) => { if (!v || v === 'x') return; if (v.startsWith('ecran:')) return aller({ ecran: v.slice(6) }); if (v.startsWith('seg:')) return aller({ ecran: e, seg: v.slice(4) });
      if (v.startsWith('colis:')) return aller({ ecran: e, seg: r.seg, colis: v.slice(6) }); aller({ ecran: e, seg: r.seg, fiche: v }); };
    $app.querySelectorAll('[data-ouvrir]').forEach((b) => b.addEventListener('click', () => { const li = b.closest('.li'); if (li && li.classList.contains('is-ouverte')) { li.classList.remove('is-ouverte'); return; } if (b.dataset.tenu) { delete b.dataset.tenu; return; } ouvrir(b.dataset.ouvrir); }));
    $app.querySelectorAll('.voile').forEach((v) => { const fer = () => aller({ ecran: e, seg: r.seg }); v.addEventListener('click', (ev) => { if (ev.target === v) fer(); }); const f = v.querySelector('.feuille'); if (f) poignee(f, fer); });
    $app.querySelectorAll('[data-glisse]').forEach(glisser);
    $app.querySelectorAll('[data-menu]').forEach(appuiLong);
    const rail = $app.querySelector('.passes-r'); if (rail) rail.addEventListener('scroll', () => { const i = Math.round(rail.scrollLeft / (rail.firstElementChild.offsetWidth + 12)); rail.parentNode.querySelectorAll('.passes-p i').forEach((x, k) => x.classList.toggle('is-on', k === i)); }, { passive: true });
  }
  addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $app.querySelector('.voile')) { const r = lire(); aller({ ecran: r.ecran, seg: r.seg }); } });

  // LE GLISSEMENT : 1:1 après 10 px dans l'axe, élastique au-delà du bord, s'ouvre sur son geste (96 px) selon la distance OU la vitesse.
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
      li.classList.remove('is-tenue'); btn.style.transform = ''; li.classList.toggle('is-ouverte', s.x < -48 || vit < -0.3); btn.dataset.tenu = '1'; setTimeout(() => delete btn.dataset.tenu, 50); s = null; };
    btn.addEventListener('pointerup', fin); btn.addEventListener('pointercancel', fin);
  }
  function appuiLong(btn) {
    let t = null, x0 = 0, y0 = 0;
    btn.addEventListener('pointerdown', (ev) => { x0 = ev.clientX; y0 = ev.clientY; t = setTimeout(() => { btn.dataset.tenu = '1'; aller({ ...lire(), menu: btn.dataset.menu }); }, 480); });
    btn.addEventListener('pointermove', (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) clearTimeout(t); });
    ['pointerup', 'pointercancel'].forEach((k) => btn.addEventListener(k, () => clearTimeout(t)));
    btn.addEventListener('contextmenu', (ev) => { ev.preventDefault(); aller({ ...lire(), menu: btn.dataset.menu }); });
  }
  // LA FEUILLE : tirée vers le haut ⇒ grand cran ; vers le bas ⇒ moyen, puis fermée. La vitesse compte autant que la distance.
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
  let vue = ''; const cleVue = () => { const r = lire(); return (r.ecran || '') + '|' + (r.seg || ''); };
  addEventListener('hashchange', () => { rendre(); const k = cleVue(); if (k !== vue) { vue = k; scrollTo(0, 0); document.body.classList.remove('is-replie'); } });
  vue = cleVue();
  rendre();
})();
