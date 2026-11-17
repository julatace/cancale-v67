// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE I « L'ÉPURE » — page blanche autonome (n'importe RIEN de src/).
//  Things 3, Rappels, iA Writer : la typographie porte tout. Trois tailles par écran
//  (40 fin · 17 · 13), aucune carte, aucune bordure, aucune capsule : l'espace sépare.
//  Une puce de 6 px pour l'état (ambre : à toi de jouer · creuse : ça attend un autre).
//  Le N° du carton en colonne, comme un registre. UNE bande d'action en bas, au pouce,
//  le seul bleu de l'écran ; les gestes secondaires : appui long → feuille (téléphone),
//  volet de droite (ordinateur). Barre du bas en MOTS, sans icônes.
//  Route dans le hash : #ecran=ventes&vue=route&feuille=vente:tx124 ; ?theme=sombre ; ?fond=bleu.
// ════════════════════════════════════════════════════════════════════════════
(() => {
  const F = window.VRM_FIXTURE;
  const J = 86400000;
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const nb = (n) => (n == null ? '—' : Number(n).toLocaleString('fr-FR'));
  const euros = (v) => (v == null ? '—' : v.toLocaleString('fr-FR', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €');
  const debutJour = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const jourCourt = (d) => {
    const dj = Math.round((debutJour(d) - debutJour(F.AUJ)) / J);
    if (dj === 0) return 'aujourd’hui'; if (dj === -1) return 'hier'; if (dj === 1) return 'demain';
    if (Math.abs(dj) < 7) return d.toLocaleDateString('fr-FR', { weekday: 'long' }) + (dj < 0 ? ' dernier' : '');
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };
  const avant = (d) => { const j = jourCourt(d); return j === 'aujourd’hui' ? 'avant ce soir' : j === 'demain' ? 'avant demain soir' : 'avant ' + j; };
  const code = (c) => c.replace(/(\d{3})(?=\d)/g, '$1 ');

  // ── Ce que chaque écran sait (tout calculé depuis la fixture) ──
  const D = (() => {
    const envoyer = F.ventes.filter((v) => v.etat === 'envoyer');
    const prets = envoyer.filter((v) => v.bord).sort((a, b) => a.limite - b.limite);
    const attente = envoyer.filter((v) => !v.bord);
    const route = F.ventes.filter((v) => v.etat === 'route');
    const finies = F.ventes.filter((v) => v.etat === 'finie').sort((a, b) => b.verse - a.verse);
    const sansCout = F.ventes.filter((v) => v.cout == null);
    const debutMois = new Date(F.AUJ.getFullYear(), F.AUJ.getMonth(), 1).getTime();
    const vendu = F.ventes.filter((v) => v.vendu.getTime() >= debutMois).reduce((t, v) => t + v.prix, 0);
    const recu = finies.filter((v) => v.verse.getTime() >= debutMois).reduce((t, v) => t + v.prix, 0);
    const points = [];
    for (const c of F.colis) { let p = points.find((x) => x.nom === c.point); if (!p) points.push(p = { nom: c.point, adresse: c.adresse, limite: c.limite, colis: [] }); p.colis.push(c); if (c.limite < p.limite) p.limite = c.limite; }
    const enRoute = F.achats.filter((a) => a.etat === 'route');
    const arrives = F.achats.filter((a) => a.etat === 'arrive');
    const dorment = F.annonces.filter((a) => a.jours > 60);
    const sansNum = F.annonces.filter((a) => !a.num);
    return { envoyer, prets, attente, route, finies, sansCout, vendu, recu, points, enRoute, arrives, dorment, sansNum };
  })();

  const ECRANS = [['jour', 'Aujourd’hui'], ['ventes', 'Ventes'], ['achats', 'Achats'], ['annonces', 'Annonces'], ['argent', 'Argent']];
  const GESTE = {
    jour: `Imprimer ${D.prets.length} bordereaux`, ventes: `Imprimer ${D.prets.length} bordereaux`,
    achats: `Montrer les ${F.colis.length} codes`, annonces: `Republier ${D.dorment.length} qui dorment`, argent: `Saisir ${D.sansCout.length} prix d’achat`,
  };
  const AFAIRE = { jour: 0, ventes: D.prets.length, achats: F.colis.length + D.arrives.length, annonces: D.dorment.length + D.sansNum.length, argent: D.sansCout.length };

  // ── Pièces ──
  const ICO = {
    loupe: '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>',
    reglages: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    bas: '<path d="m7 10 5 5 5-5"/>', fleche: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  };
  const ico = (n, t = 22) => `<svg class="ico" width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[n]}</svg>`;
  const qr = (texte, t) => {
    const q = qrcode(0, 'M'); q.addData(texte); q.make();
    const n = q.getModuleCount(); let d = '';
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.isDark(y, x)) d += `M${x} ${y}h1v1h-1z`;
    return `<svg class="qr" width="${t}" height="${t}" viewBox="-2 -2 ${n + 4} ${n + 4}" shape-rendering="crispEdges" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
  };
  const puce = (e) => `<span class="puce is-${e || 'rien'}" aria-hidden="true"></span>`;
  // Une rangée de registre : puce · N° · titre (2 lignes au plus, jamais coupé) + détail · valeur.
  const rangee = ({ etat, num, sansNum, titre, detail, valeur, valeurDetail, aller, feuille, choisi }) => `
    <button type="button" class="rangee${sansNum ? ' sans-num' : ''}${choisi ? ' is-choisi' : ''}"${aller ? ` data-aller="${esc(aller)}"` : ''}${feuille ? ` data-feuille="${esc(feuille)}"` : ''}>
      ${puce(etat)}${sansNum ? '' : `<span class="num${num ? '' : ' is-vide'}">${esc(num || '—')}</span>`}
      <span class="corps"><span class="titre">${esc(titre)}</span>${detail ? `<span class="detail">${esc(detail)}</span>` : ''}</span>
      ${valeur != null ? `<span class="valeur">${esc(valeur)}${valeurDetail ? `<span class="detail">${esc(valeurDetail)}</span>` : ''}</span>` : ''}
    </button>`;
  const groupe = (nom, corps, a) => `<section class="groupe">${nom ? `<h2 class="entete"><span>${esc(nom)}</span>${a ? `<span>${esc(a)}</span>` : ''}</h2>` : ''}<div class="liste">${corps}</div></section>`;
  const vues = (ecran, actif, l) => `<nav class="vues" aria-label="Vues">${l.map(([c, nom, n]) => `<button type="button" class="vue" aria-pressed="${c === actif}" data-aller="ecran=${ecran}&vue=${c}">${esc(nom)}${n != null ? `<span class="vue-n">${nb(n)}</span>` : ''}</button>`).join('')}</nav>`;

  // ════════ LES ÉCRANS ════════
  const ecrans = {
    jour: () => {
      const p0 = D.prets[0], pt = D.points[0];
      return groupe('À faire', [
        rangee({ sansNum: true, etat: 'geste', titre: 'Envoyer', valeur: nb(D.envoyer.length), detail: p0 ? `le premier ${avant(p0.limite)}` : null, aller: 'ecran=ventes' }),
        rangee({ sansNum: true, etat: 'geste', titre: 'Retirer', valeur: nb(F.colis.length), detail: `${pt.nom} ${avant(pt.limite)}`, aller: 'ecran=achats' }),
        rangee({ sansNum: true, etat: 'geste', titre: 'Répondre aux offres', valeur: nb(F.offres.length), detail: `${euros(F.offres[0].montant)} pour ${F.offres[0].titre}` }),
        rangee({ sansNum: true, etat: 'geste', titre: 'Numéroter les achats arrivés', valeur: nb(D.arrives.length), aller: 'ecran=achats&vue=arrives' }),
      ].join(''))
        + groupe('Ça avance sans toi', [
          rangee({ sansNum: true, etat: 'attente', titre: 'Colis vers tes acheteurs', valeur: nb(D.route.length), aller: 'ecran=ventes&vue=route' }),
          rangee({ sansNum: true, etat: 'attente', titre: 'Achats en route vers toi', valeur: nb(D.enRoute.length), aller: 'ecran=achats&vue=route' }),
        ].join(''))
        + groupe('Novembre', [
          rangee({ sansNum: true, titre: 'Vendu', valeur: euros(D.vendu), detail: `${nb(F.ventes.length)} ventes`, aller: 'ecran=argent' }),
          rangee({ sansNum: true, titre: 'Reçu', valeur: euros(D.recu), detail: 'daté au jour du versement', aller: 'ecran=argent' }),
        ].join(''));
    },
    ventes: (vue, choisi) => {
      const v = vue || 'envoyer';
      const tete = vues('ventes', v, [['envoyer', 'À envoyer', D.envoyer.length], ['route', 'En route'], ['toutes', 'Toutes']]);
      const r = (x, etat, droite) => rangee({ etat, num: x.num, titre: x.titre, detail: x.acheteur, valeur: euros(x.prix), valeurDetail: droite, feuille: 'vente:' + x.tx, choisi: choisi === 'vente:' + x.tx });
      if (v === 'envoyer') return tete + groupe('Prêts à imprimer', D.prets.map((x) => r(x, 'geste', jourCourt(x.limite))).join(''))
        + groupe('Bordereau pas encore reçu', D.attente.map((x) => r(x, 'attente', 'vers ' + jourCourt(x.estimee))).join(''));
      const l = v === 'route' ? D.route : [...F.ventes].sort((a, b) => b.vendu - a.vendu);
      return tete + groupe('', l.map((x) => r(x, v === 'route' ? 'attente' : 'rien', jourCourt(x.vendu))).join(''));
    },
    achats: (vue, choisi) => {
      const v = vue || 'retirer';
      const tete = vues('achats', v, [['retirer', 'À retirer', F.colis.length], ['route', 'En route'], ['arrives', 'Arrivés']]);
      if (v === 'retirer') return tete + D.points.map((p) => `
        <section class="groupe point">
          <h2 class="point-nom">${esc(p.nom)}</h2>
          <p class="point-ou">${esc(p.adresse)} · <span class="ambre">${esc(avant(p.limite))}</span></p>
          <div class="liste">${p.colis.map((c) => `
            <button type="button" class="rangee colis sans-num${choisi === 'codes:' + c.code ? ' is-choisi' : ''}" data-feuille="codes:${c.code}">
              ${puce('geste')}<span class="corps"><span class="titre code">${code(c.code)}</span><span class="detail">${esc(c.titre)}</span></span>${qr(c.code, 36)}
            </button>`).join('')}</div>
        </section>`).join('');
      const l = v === 'route' ? D.enRoute : D.arrives;
      return tete + groupe(v === 'arrives' ? 'À numéroter' : '', l.map((a) => rangee({ sansNum: true, etat: v === 'route' ? 'attente' : 'geste', titre: a.titre, detail: `${v === 'route' ? 'acheté' : 'arrivé'} ${jourCourt(a.date)} · ${a.compte}`, valeur: euros(a.prix) })).join(''));
    },
    annonces: (vue, choisi) => {
      const v = vue || 'enligne';
      const tete = vues('annonces', v, [['enligne', 'En ligne', F.annonces.length], ['dorment', 'Qui dorment'], ['sansnum', 'Sans N°']]);
      const l = v === 'dorment' ? D.dorment : v === 'sansnum' ? D.sansNum : [...F.annonces].sort((a, b) => a.jours - b.jours);
      const parCompte = F.comptes.map((c) => [c, l.filter((a) => a.compte === c)]).filter(([, g]) => g.length);
      return tete + `<label class="cherche">${ico('loupe', 18)}<input type="search" placeholder="N°, titre, taille" aria-label="Chercher une annonce" enterkeyhint="search"></label>`
        + parCompte.map(([c, g]) => groupe(c, g.map((a) => rangee({
          etat: !a.num || a.jours > 60 ? 'geste' : 'rien', num: a.num, titre: a.titre,
          detail: [`${a.jours} j en ligne`, a.fav ? `${a.fav} favoris` : null].filter(Boolean).join(' · '),
          valeur: euros(a.prix), feuille: 'annonce:' + a.id, choisi: choisi === 'annonce:' + a.id,
        })).join(''))).join('');
    },
    argent: () => {
      const sur = F.ventes.length;
      return `<div class="affiche"><p class="affiche-n">${euros(D.recu)}</p><p class="detail">reçu en novembre, daté au jour du versement</p></div>`
        + groupe('', [
          rangee({ sansNum: true, titre: 'Vendu en novembre', valeur: euros(D.vendu), detail: `${nb(sur)} ventes, toutes plateformes` }),
          rangee({ sansNum: true, titre: 'Disponible sur Vinted', valeur: euros(F.porteMonnaie.disponible) }),
          rangee({ sansNum: true, etat: 'attente', titre: 'En attente', valeur: euros(F.porteMonnaie.attente), detail: 'versé quand l’acheteur confirme' }),
          rangee({ sansNum: true, etat: 'geste', titre: 'Bénéfice', valeur: '—', detail: `${nb(D.sansCout.length)} prix d’achat manquants sur ${nb(sur)}` }),
          rangee({ sansNum: true, etat: 'geste', titre: 'URSSAF', valeur: '—', detail: 'choisis ton statut' }),
        ].join(''))
        + groupe('Derniers versements', D.finies.map((x) => rangee({ num: x.num, titre: x.titre, detail: `versé ${jourCourt(x.verse)}`, valeur: euros(x.prix) })).join(''));
    },
  };

  // ════════ LES FEUILLES (téléphone) = LE VOLET (ordinateur) ════════
  const photo = (t) => { let h = 0; for (const c of t) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `<span class="f-photo" style="--t:${h % 360}" aria-hidden="true"><svg viewBox="0 0 200 120"><path d="M14 92c4-20 22-28 40-34l26-14c10-6 16-16 28-16 9 0 14 9 22 13 16 8 30 10 36 22 4 8 4 18 2 29H14z" fill="currentColor"/><path d="M14 92h154l-1 9c-30 4-110 4-148 1-4-1-6-5-5-10z" fill="var(--fond)"/></svg></span>`; };
  const gestes = (l) => `<div class="f-gestes">${l.map((g) => `<button type="button" class="f-geste">${esc(g)}</button>`).join('')}</div>`;
  const feuilles = {
    annonce: (id) => {
      const a = F.annonces.find((x) => x.id === id); if (!a) return '';
      return `<div class="f-tete">${photo(a.titre)}<span class="corps"><span class="titre">${esc(a.titre)}</span><span class="detail">${esc([a.num ? 'N° ' + a.num : 'sans N°', a.case ? 'case ' + a.case : null, euros(a.prix)].filter(Boolean).join(' · '))}</span></span></div>`
        + gestes(['Baisser le prix', 'Republier', 'Mettre en pause', 'Ouvrir sur Vinted', 'Copier le lien', a.num ? `Tout sur le N° ${a.num}` : 'Donner un N°']);
    },
    vente: (tx) => {
      const v = F.ventes.find((x) => x.tx === tx); if (!v) return '';
      const quand = v.etat === 'envoyer' ? (v.limite ? `<span class="ambre">À envoyer ${esc(avant(v.limite))}</span>` : `Date limite pas lue · vers ${esc(jourCourt(v.estimee))}`) : esc(v.etat === 'route' ? 'En route' : 'Livrée · versée');
      return `<div class="f-tete">${photo(v.titre)}<span class="corps"><span class="titre">${esc(v.titre)}</span><span class="detail">${esc(['N° ' + v.num, v.case ? 'case ' + v.case : null, euros(v.prix)].filter(Boolean).join(' · '))}</span></span></div>`
        + `<p class="detail f-ligne">${quand}${v.suivi ? ' · suivi ' + esc(v.suivi) : ''}</p>`
        + gestes([v.bord ? 'Imprimer le bordereau' : null, `Écrire à ${v.acheteur}`, 'Ouvrir sur Vinted', `Tout sur le N° ${v.num}`].filter(Boolean));
    },
    codes: (c0) => {
      const i = Math.max(0, F.colis.findIndex((c) => c.code === c0)); const c = F.colis[i];
      return `<div class="f-code"><span class="qr-fond">${qr(c.code, 216)}</span><p class="affiche-n">${code(c.code)}</p><p class="titre">${esc(c.titre)}</p><p class="detail">${esc(c.point)} · <span class="ambre">${esc(avant(c.limite))}</span></p></div>
        <div class="f-pas"><button type="button" class="f-geste"${i === 0 ? ' disabled' : ` data-feuille="codes:${F.colis[i - 1].code}"`}>Précédent</button><span class="detail">${i + 1} sur ${F.colis.length}</span><button type="button" class="f-geste"${i === F.colis.length - 1 ? ' disabled' : ` data-feuille="codes:${F.colis[i + 1].code}"`}>Suivant</button></div>`;
    },
    comptes: () => `<p class="detail f-ligne">Montrer</p>` + `<div class="f-gestes"><button type="button" class="f-geste" aria-pressed="true">Tous les comptes</button>${F.comptes.map((c) => `<button type="button" class="f-geste">${esc(c)}</button>`).join('')}</div>`,
  };

  // ════════ LE RENDU ════════
  const large = () => window.matchMedia('(min-width: 1100px)').matches;
  const lire = () => { const p = new URLSearchParams(location.hash.replace(/^#/, '')); return { ecran: p.get('ecran') || 'jour', vue: p.get('vue') || '', feuille: p.get('feuille') || '' }; };
  const date = F.AUJ.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  function rendre() {
    const r = lire(); const L = large();
    const [nomE] = ECRANS.filter(([c]) => c === r.ecran).map(([, n]) => n); const ecran = nomE ? r.ecran : 'jour';
    let [fT, fId] = r.feuille.split(/:(.*)/s);
    // L'ordinateur : le volet montre la rangée choisie, sinon la première de la liste.
    if (L && !fT) {
      if (ecran === 'ventes' && (!r.vue || r.vue === 'envoyer')) { fT = 'vente'; fId = D.prets[0].tx; }
      if (ecran === 'achats' && (!r.vue || r.vue === 'retirer')) { fT = 'codes'; fId = F.colis[0].code; }
      if (ecran === 'annonces') { fT = 'annonce'; fId = F.annonces.slice().sort((a, b) => a.jours - b.jours).find((a) => a.num).id; }
    }
    const choisi = fT ? fT + ':' + fId : '';
    let volet = L && fT && fT !== 'comptes' ? feuilles[fT](fId) : '';
    // Aujourd'hui et Argent, à l'ordinateur : le volet porte ce qui se décide sans quitter l'écran.
    if (L && !volet && ecran === 'jour') volet = `<p class="detail f-ligne">Offres à trancher</p>` + F.offres.map((o) => `<div class="v-offre"><span class="titre">${esc(o.titre)}</span><span class="detail">${esc(o.acheteur)} propose ${esc(euros(o.montant))} · affichée ${esc(euros(o.prix))}</span><span class="v-gestes"><button type="button" class="f-geste">Accepter</button><button type="button" class="f-geste">Contre-offre</button><button type="button" class="f-geste">Refuser</button></span></div>`).join('');
    if (L && !volet && ecran === 'argent') volet = `<p class="detail f-ligne">Vendu en novembre, par compte</p>` + F.comptes.map((c) => { const l = F.ventes.filter((v) => v.compte === c); return `<div class="v-compte"><span class="corps"><span class="titre">${esc(c)}</span><span class="detail">${nb(l.length)} ventes</span></span><span class="valeur">${esc(euros(l.reduce((t, v) => t + v.prix, 0)))}</span></div>`; }).join('');
    const sous = ecran === 'jour' ? `<p class="sous">${esc(date)}</p>` : ecran === 'argent' ? '' : `<button type="button" class="sous filtre" data-feuille="comptes:">Tous les comptes · toutes les plateformes${ico('bas', 16)}</button>`;
    document.getElementById('app').innerHTML = `
      <div class="racine${L ? ' is-large' : ''}${volet ? ' a-volet' : ''}" data-ecran="${ecran}">
        ${L ? `<aside class="cote"><p class="marque">VRM</p><label class="cherche cherche-cote">${ico('loupe', 16)}<input type="search" placeholder="Chercher" aria-label="Chercher partout"></label>
          <nav class="cote-nav">${ECRANS.map(([c, n]) => `<button type="button" class="cote-lien" ${c === ecran ? 'aria-current="page"' : ''} data-aller="ecran=${c}"><span>${esc(n)}</span>${AFAIRE[c] ? puce('geste') : ''}</button>`).join('')}</nav>
          <button type="button" class="cote-lien cote-pied"><span>Réglages</span></button></aside>` : ''}
        <main class="main">
          <header class="tete"><h1 class="h1">${esc(nomE || 'Aujourd’hui')}</h1>
            ${L ? '' : `<div class="tete-ronds"><button type="button" class="rond" aria-label="Chercher">${ico('loupe')}</button>${ecran === 'jour' ? `<button type="button" class="rond" aria-label="Réglages">${ico('reglages')}</button>` : ''}</div>`}</header>
          ${sous}
          <div class="page">${ecrans[ecran](r.vue, choisi)}</div>
          <div class="pied"><button type="button" class="plein" data-plein ${ecran === 'achats' ? `data-feuille="codes:${F.colis[0].code}"` : ''}><span>${esc(GESTE[ecran])}</span>${ico('fleche', 20)}</button></div>
        </main>
        ${volet ? `<aside class="volet" aria-label="Gestes">${volet}</aside>` : ''}
        ${L ? '' : `<nav class="barre" aria-label="Écrans">${ECRANS.map(([c, n]) => `<button type="button" class="onglet" ${c === ecran ? 'aria-current="page"' : ''} data-aller="ecran=${c}">${esc(n)}</button>`).join('')}</nav>`}
        ${!L && fT ? `<div class="voile" data-fermer><div class="feuille" role="dialog" aria-modal="true"><span class="poignee" aria-hidden="true"></span>${feuilles[fT](fId)}</div></div>` : ''}
      </div>`;
  }
  // Toucher : aller, ouvrir une feuille ; appui long (450 ms) ou clic droit sur une rangée : sa feuille.
  let minuteur = null, longFait = false;
  const route = (x) => { location.hash = x; };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.rangee[data-feuille]'); longFait = false;
    if (b) minuteur = setTimeout(() => { longFait = true; ouvrirFeuille(b.dataset.feuille); }, 450);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => document.addEventListener(t, () => clearTimeout(minuteur)));
  const ouvrirFeuille = (f) => { const p = new URLSearchParams(location.hash.replace(/^#/, '')); p.set('feuille', f); route(p.toString()); };
  document.addEventListener('click', (e) => {
    if (longFait) { longFait = false; return; }
    if (e.target.matches('[data-fermer]')) { const p = new URLSearchParams(location.hash.replace(/^#/, '')); p.delete('feuille'); route(p.toString()); return; }
    const a = e.target.closest('[data-aller]'); if (a) { route(a.dataset.aller); return; }
    const f = e.target.closest('[data-feuille]'); if (f && (large() || !f.classList.contains('rangee') || f.classList.contains('colis'))) ouvrirFeuille(f.dataset.feuille);
  });
  document.addEventListener('contextmenu', (e) => { const b = e.target.closest('.rangee[data-feuille]'); if (b) { e.preventDefault(); ouvrirFeuille(b.dataset.feuille); } });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.querySelector('[data-fermer]')?.click(); });
  window.addEventListener('hashchange', rendre);
  window.matchMedia('(min-width: 1100px)').addEventListener('change', rendre);
  const q = new URLSearchParams(location.search);
  const sombre = q.get('theme') === 'sombre' || (q.get('theme') !== 'clair' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = sombre ? 'dark' : 'light';
  if (q.get('fond') === 'bleu') document.documentElement.dataset.fond = 'bleu';
  document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--fond').trim());
  rendre();
})();
