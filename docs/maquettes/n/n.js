// ════════════════════════════════════════════════════════════════════════════
//  MAQUETTE N — « ZÉRO À FAIRE » — page autonome (n'importe rien de src/).
//  L'accueil est une liste « à faire » GROUPÉE (iOS) : chaque groupe a son compteur et SON geste ;
//  les colis à retirer sont des TICKETS en carton qu'on fait défiler (code en gros, QR réel s'il existe).
//  Quand tout est fait : le carton est vide, « Rien à faire », et le chiffre du jour.
//  Signature : l'ÉTIQUETTE CARTON du N° (kraft, œillet percé) — la même que sur ses vrais cartons.
// ════════════════════════════════════════════════════════════════════════════
(function () {
  const F = window.FIXTURE, NOW = F.MAINTENANT, J = 864e5;
  const ico = window.ico;
  const $ = (s) => document.querySelector(s);
  const att = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const esc = (s) => att(s).replace(/(\w)-(\w)/g, '$1‑$2');
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
  const achatDe = new Map(F.achats.map((a) => [a.tx, a]));
  const graine = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0);

  // ── LES PIÈCES ──────────────────────────────────────────────────────────
  const tag = (n, grand) => (n ? `<span class="tag${grand ? ' tag--grand' : ''}" data-numero="${att(n)}"><i class="tag-oeil"></i><span class="tag-n">N°</span>${esc(n)}</span>` : '<span class="tag tag--sans"><i class="tag-oeil"></i>sans N°</span>');
  const vign = (x, cls = '') => `<span class="vign ${cls}">${window.basket(x.teinte, graine(x.numero || x.tx || x.id))}</span>`;
  const chevron = `<span class="chev">${ico('chevron', 16)}</span>`;
  const urg = (t) => `<span class="${presse(t) ? 'ambre' : ''}">${presse(t) ? '<i class="pt"></i>' : ''}${avant(t)}</span>`;
  const rangee = ({ g, titre, sous, droite, droiteSous, ambre, attrs = '', glisse }) => `
    <div class="rang-glisse${glisse ? ' is-ouverte' : ''}">
      ${glisse ? `<div class="rang-actions">${glisse}</div>` : ''}
      <a class="rang" href="#" ${attrs}>${g || ''}<span class="rang-c"><span class="rang-t">${titre}</span>${sous ? `<span class="rang-s">${sous}</span>` : ''}</span>
      ${droite != null ? `<span class="rang-d"><span class="rang-v">${droite}</span>${droiteSous ? `<span class="rang-ds${ambre ? ' ambre' : ''}">${droiteSous}</span>` : ''}</span>` : ''}${chevron}</a>
    </div>`;
  const groupe = ({ titre, n, action, contenu, cle, nu }) => `<section class="grp" ${cle ? `data-groupe="${cle}"` : ''}>
    <header class="grp-t"><h2>${titre}${n != null ? ` <span class="grp-n">${nb(n)}</span>` : ''}</h2>${action || ''}</header>
    ${nu ? contenu : `<div class="plaque">${contenu}</div>`}</section>`;

  // LE TICKET (un colis au point) : code en gros, QR RÉEL s'il existe, lieu, date limite. Perforé.
  const ticket = (c) => {
    const a = achatDe.get(c.achat);
    return `<article class="ticket" data-ticket="${att(c.suivi)}">
      <div class="ticket-h"><span class="ticket-tr">${esc(c.transporteur)}</span><span class="ticket-lim">${urg(c.limite)}</span></div>
      <div class="ticket-m"><div class="ticket-code"><span class="ticket-l">Code de retrait</span><span class="ticket-v" data-code="${att(c.code)}">${esc(c.code)}</span></div>
        ${c.qr ? `<span class="ticket-qr" data-qr-reel="">${c.qr}</span>` : `<span class="ticket-sansqr">${ico('personne', 22)}<span>Au comptoir, avec ta pièce d’identité</span></span>`}</div>
      <div class="ticket-pied"><span class="ticket-lieu">${ico('epingle', 16)}${esc(c.point)}</span><span class="ticket-art">${vign(a, 'vign--xs')}<span>${esc(a.titre)}</span></span></div>
    </article>`;
  };
  const tickets = (l) => `<div class="tickets" data-tickets="">${l.map(ticket).join('')}</div>`;

  // ── LA FILE DU JOUR (chaque groupe : un compteur, un geste) ───────────────
  const aPoster = F.ventes.filter((v) => v.etat === 'envoyer').sort((a, b) => a.limite.localeCompare(b.limite));
  const premierLot = aPoster.filter((v) => jourParis(v.limite) === jourParis(aPoster[0].limite));
  const sansCout = F.ventes.filter((v) => v.cout == null);
  const nAFaire = aPoster.length + F.colis.length + F.offres.length + sansCout.length;

  // ── LA ROUTE ─────────────────────────────────────────────────────────────
  const route = () => Object.fromEntries(new URLSearchParams(location.hash.slice(1)).entries());
  window.addEventListener('hashchange', rendre);
  document.addEventListener('click', (e) => { const a = e.target.closest('a[href="#"]'); if (a) e.preventDefault(); });

  const ONGLETS = [['afaire', 'À faire', 'boite'], ['commandes', 'Commandes', 'commandes'], ['annonces', 'Annonces', 'annonces'], ['argent', 'Argent', 'argent']];
  const nav = (actif, n) => `<nav class="barre" aria-label="Onglets">${ONGLETS.map(([k, nom, i]) => `<a href="#ecran=${k}" class="onglet" ${actif === k ? 'aria-current="page"' : ''} data-onglet="${k}"><span class="onglet-i">${ico(i, 25)}${k === 'afaire' && n ? `<span class="onglet-b">${n}</span>` : ''}</span><span class="onglet-n">${nom}</span></a>`).join('')}</nav>`;

  // L'en-tête iOS : une barre (actions à droite), le grand titre, la recherche intégrée.
  const entete = ({ titre, droite = '', cherche = true, sous = '' }) => `
    <div class="nb"><span class="nb-titre">${titre}</span><span class="nb-d">${droite}<button class="nb-b" aria-label="Aide">${ico('aide', 22)}</button></span></div>
    <h1 class="gt">${titre}</h1>${sous}
    ${cherche ? `<label class="recherche">${ico('chercher', 17)}<input type="search" placeholder="N°, titre, pseudo, code" enterkeyhint="search"></label>` : ''}`;
  const segmente = (items, actif) => `<div class="seg" role="tablist">${items.map(([k, nom, h]) => `<a href="${h}" role="tab" class="seg-o" ${actif === k ? 'aria-selected="true"' : ''} data-seg="${k}">${nom}</a>`).join('')}</div>`;

  // ══ À FAIRE ═══════════════════════════════════════════════════════════════
  function chiffreJour(cls = '') {
    const auj = F.ventes.filter((v) => dj(v.date) === 0);
    const tot = auj.reduce((t, v) => t + v.prix, 0);
    return `<div class="jour ${cls}" data-chiffre-jour=""><div class="jour-pile">${auj.slice(0, 3).map((v) => vign(v, 'vign--s')).join('')}</div>
      <p class="jour-v">${auj.length ? nb(tot) + '<span class="eur">€</span>' : '0'}</p><p class="jour-l">${auj.length ? `vendus aujourd’hui · ${auj.length} paire${auj.length > 1 ? 's' : ''}` : 'vente aujourd’hui'}</p></div>`;
  }
  function ecranAFaire(r) {
    const date = Maj(new Date(NOW).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' }));
    const profil = `<button class="nb-b" aria-label="Mon profil et les réglages">${ico('personne', 22)}</button>`;
    if (r.fait === 'tout') {
      return entete({ titre: 'À faire', droite: profil, cherche: false, sous: `<p class="gt-sous">${date}</p>` }) + `
        <section class="rien" data-rien-a-faire="">
          <svg class="carton-vide" viewBox="0 0 160 120" aria-hidden="true"><path d="M30 52 80 36l50 16v46l-50 16-50-16z" fill="var(--kraft)"/><path d="M80 68v46l50-16V52z" fill="var(--kraft-ombre)"/><path d="M30 52l50 16 50-16" fill="none" stroke="var(--kraft-trait)" stroke-width="1.5"/><path d="M30 52 12 38l50-16 18 14zM130 52l18-14-50-16-18 14z" fill="var(--kraft-rabat)"/><path d="M58 92l6 2.2v-8l-6-2.2z" fill="var(--kraft-trait)" opacity=".5"/></svg>
          <h2 class="rien-t">Rien à faire</h2><p class="rien-s">Le carton est vide.</p>
          ${chiffreJour('jour--carte')}
        </section>`;
    }
    const lot = premierLot.length;
    const poster = groupe({ cle: 'poster', titre: 'À poster', n: aPoster.length, action: `<button class="b-plein" data-plein="">${ico('imprimer', 17)}Imprimer ${lot}</button>`,
      contenu: aPoster.map((v) => rangee({ g: vign(v), titre: esc(v.titre), sous: `${tag(v.numero)}${urg(v.limite)}`, attrs: `data-vente="${v.tx}"` })).join('') });
    const retirer = groupe({ cle: 'retirer', titre: 'À retirer', n: F.colis.length, contenu: tickets(F.colis), nu: true });
    const offres = groupe({ cle: 'offres', titre: 'Offres', n: F.offres.length, contenu: F.offres.map((o) => { const a = annonceDe.get(o.annonce); return rangee({ g: vign(a), titre: `${eur(o.montant)} <span class="gris">· ${esc(o.pseudo)}</span>`, sous: `${tag(a.numero)}<span>annonce ${eur(a.prix)}</span>`, attrs: `data-offre="${o.conv}"` }); }).join('') });
    const prix = groupe({ cle: 'prix', titre: 'Prix d’achat à saisir', n: sansCout.length, action: '<button class="b-texte">Saisir</button>',
      contenu: sansCout.map((v) => rangee({ g: vign(v), titre: esc(v.titre), sous: `${tag(v.numero)}<span>vendue ${eur(v.prix)}</span>`, attrs: `data-vente="${v.tx}"` })).join('') });
    return entete({ titre: 'À faire', droite: profil, cherche: false, sous: `<p class="gt-sous">${date}</p>` })
      + `<div class="colonnes"><div class="col-g">${poster}${retirer}${offres}${prix}</div><div class="col-d">${chiffreJour('jour--cote')}</div></div>`;
  }

  // ══ COMMANDES ═════════════════════════════════════════════════════════════
  const ETAT_V = { envoyer: ['à poster', true], sansbord: ['bordereau attendu', false], route: ['en route', false], finie: ['finie', false] };
  const parJour = (l, date) => { const g = []; for (const x of l) { const k = Maj(nomJour(date(x))); let G = g.find((y) => y.k === k); if (!G) { G = { k, l: [] }; g.push(G); } G.l.push(x); } return g; };
  function ecranCommandes(r) {
    const vue = r.vue === 'achats' ? 'achats' : 'ventes';
    const haut = entete({ titre: 'Commandes' }) + segmente([['ventes', 'Ventes', '#ecran=commandes&vue=ventes'], ['achats', 'Achats', '#ecran=commandes&vue=achats']], vue);
    if (vue === 'ventes') {
      const l = [...F.ventes].sort((a, b) => b.date.localeCompare(a.date));
      return haut + parJour(l, (v) => v.date).map((g, gi) => groupe({ titre: g.k, n: g.l.length, contenu: g.l.map((v, i) => rangee({ g: vign(v), titre: esc(v.titre), sous: `${tag(v.numero)}<span>${esc(v.compte)}</span>`, droite: eur(v.prix), droiteSous: ETAT_V[v.etat][0], ambre: ETAT_V[v.etat][1], attrs: `data-vente="${v.tx}"`,
        glisse: r.glisse && gi === 0 && i === 1 ? `<button class="act act--gris">${ico('horloge', 20)}Plus tard</button><button class="act act--encre">${ico('imprimer', 20)}Imprimer</button>` : '' })).join('') })).join('');
    }
    const l = F.achats.filter((a) => a.etat !== 'point').sort((a, b) => b.date.localeCompare(a.date));
    const ETAT_A = { route: 'en route', recu: 'reçu' };
    return haut + groupe({ titre: 'Au point relais', n: F.colis.length, contenu: tickets(F.colis), nu: true })
      + parJour(l, (a) => a.date).map((g) => groupe({ titre: g.k, n: g.l.length, contenu: g.l.map((a) => rangee({ g: vign(a), titre: esc(a.titre), sous: `<span>${esc(a.compte)} · ${a.taille}</span>`, droite: eur(a.prix), droiteSous: ETAT_A[a.etat], attrs: `data-achat="${a.tx}"` })).join('') })).join('');
  }

  // ══ ANNONCES (une grille de paires) ═══════════════════════════════════════
  function ecranAnnonces(r) {
    const f = r.filtre || 'enligne';
    const dorment = F.annonces.filter((a) => a.jours > 60), sansN = F.annonces.filter((a) => !a.numero);
    const l = (f === 'dorment' ? dorment : f === 'sansnum' ? sansN : F.annonces).slice().sort((a, b) => a.jours - b.jours);
    return entete({ titre: 'Annonces' })
      + segmente([['enligne', `En ligne <b>${F.annonces.length}</b>`, '#ecran=annonces'], ['dorment', `Qui dorment <b>${dorment.length}</b>`, '#ecran=annonces&filtre=dorment'], ['sansnum', `Sans N° <b>${sansN.length}</b>`, '#ecran=annonces&filtre=sansnum']], f)
      + `<div class="grille" data-grille="">${l.map((a) => `<a href="#" class="carte-p" data-annonce="${a.id}">
          <span class="carte-p-img">${window.basket(a.teinte, graine(a.id))}<span class="carte-p-tag">${tag(a.numero)}</span></span>
          <span class="carte-p-t">${esc(a.titre)}</span>
          <span class="carte-p-b"><span class="carte-p-v">${eur(a.prix)}</span><span class="carte-p-m">${a.jours ? a.jours + ' j' : 'neuve'}${a.favoris ? ` · ${ico('coeur', 12)}${a.favoris}` : ''}</span></span></a>`).join('')}</div>`;
  }

  // ══ ARGENT (le seul écran à chiffres) ═════════════════════════════════════
  function ecranArgent() {
    const mois = new Date(NOW).toLocaleDateString('fr-FR', { month: 'long', timeZone: 'Europe/Paris' });
    const verses = F.ventes.filter((v) => v.verseLe).sort((a, b) => b.verseLe.localeCompare(a.verseLe));
    const ceMois = verses.filter((v) => jourParis(v.verseLe).slice(0, 7) === jourParis(NOW).slice(0, 7));
    const tot = ceMois.reduce((t, v) => t + v.prix, 0);
    const jours = Array.from({ length: 14 }, (_, i) => { const t = NOW - (13 - i) * J; const k = jourParis(t); return { k, v: verses.filter((x) => jourParis(x.verseLe) === k).reduce((s, x) => s + x.prix, 0) }; });
    const max = Math.max(...jours.map((x) => x.v), 1);
    const graph = `<div class="barres" aria-hidden="true">${jours.map((x) => `<span class="barre-j${x.v ? '' : ' is-vide'}" style="height:${x.v ? Math.max(10, Math.round((x.v / max) * 100)) : 3}%"></span>`).join('')}</div><div class="barres-l"><span>3 novembre</span><span>aujourd’hui</span></div>`;
    return entete({ titre: 'Argent', cherche: false })
      + `<section class="heros-argent"><p class="heros-v" data-recu-mois="">${nb(tot)}<span class="eur">€</span></p><p class="heros-l">reçus en ${mois} · ${ceMois.length} versements</p>${graph}</section>
      <div class="plaque synthese"><div><span class="syn-v">${eur(F.portemonnaie.disponible)}</span><span class="syn-l">sur Vinted</span></div><div><span class="syn-v">${eur(F.portemonnaie.attente)}</span><span class="syn-l">en attente</span></div><div><span class="syn-v">—</span><span class="syn-l">statut URSSAF</span></div></div>`
      + groupe({ titre: 'Versements', n: verses.length, contenu: verses.map((v) => rangee({ g: vign(v), titre: esc(v.titre), sous: `${tag(v.numero)}<span>${Maj(nomJour(v.verseLe))}</span>`, droite: eur(v.prix, true), attrs: `data-versement="${v.tx}"` })).join('') });
  }

  // ══ LA FICHE D'UNE PAIRE (feuille à détente moyenne) ══════════════════════
  function fiche(numero) {
    const v = F.ventes.find((x) => x.numero === numero); if (!v) return '';
    const marge = v.cout != null ? v.prix - v.cout : null;
    return `<div class="voile" data-feuille=""></div><section class="feuille" role="dialog" aria-modal="true" aria-label="${att(v.titre)}">
      <span class="poignee"></span>
      <div class="feuille-haut"><div class="feuille-img">${window.basket(v.teinte, graine(v.numero))}</div>
      <div class="feuille-t">${tag(v.numero, true)}<h2>${esc(v.titre)}</h2><p class="gris">${esc(v.compte)} · taille ${v.taille}</p></div></div>
      <div class="plaque"><div class="kv"><span>Achetée</span><b>${eur(v.cout)}</b></div><div class="kv"><span>Vendue</span><b>${eur(v.prix)}</b></div><div class="kv"><span>Reste</span><b>${marge == null ? '—' : eur(marge, true)}</b></div>${v.limite ? `<div class="kv"><span>À poster</span><b>${urg(v.limite)}</b></div>` : ''}</div>
      <button class="b-plein b-plein--large" data-plein="">${ico('imprimer', 18)}Imprimer le bordereau</button>
    </section>`;
  }

  // ── RENDU ────────────────────────────────────────────────────────────────
  const large = () => matchMedia('(min-width: 1100px)').matches;
  function rendre() {
    const r = route();
    const e = ONGLETS.some(([k]) => k === r.ecran) ? r.ecran : 'afaire';
    const n = r.fait === 'tout' ? 0 : nAFaire;
    const corps = e === 'afaire' ? ecranAFaire(r) : e === 'commandes' ? ecranCommandes(r) : e === 'annonces' ? ecranAnnonces(r) : ecranArgent();
    $('#app').innerHTML = `${large() ? `<aside class="cote"><p class="marque">VRM</p>${nav(e, n)}</aside>` : ''}<main class="main main--${e}">${corps}</main>${large() ? '' : nav(e, n)}${r.fiche ? fiche(r.fiche) : ''}`;
    document.documentElement.dataset.ecran = e;
  }
  addEventListener('resize', rendre);
  // Le grand titre se replie en titre de barre au défilement (iOS).
  addEventListener('scroll', () => document.documentElement.toggleAttribute('data-defile', scrollY > 40), { passive: true });
  rendre();
})();
