// ═══════════════════════════════════════════════════════════════════════════
// L'HISTORIQUE eBAY DÈS LE PREMIER JOUR (11 nov., lot import-historique-sites)
// ═══════════════════════════════════════════════════════════════════════════
// Julien : « récupérer TOUT l'historique de ventes et d'achats sur Leboncoin,
// eBay et Vestiaire, comme pour Vinted, pour avoir stats et compta complètes
// dès le premier jour ».
//
// eBay se lit CÔTÉ SERVEUR (l'API officielle, le jeton du vendeur) :
//   · VENTES — Fulfillment `getOrders` sans filtre ne rend que les 90 derniers
//     jours. On remonte le temps par FENÊTRES de 90 jours
//     (`filter=creationdate:[de..a]`), page par page (`limit`/`offset`), de la
//     plus récente à la plus ancienne. La période maximale est celle qu'eBay
//     SERT : une fenêtre qu'eBay refuse (400, date trop ancienne) arrête la
//     lecture là (« eBay ne remonte pas plus loin »), jamais devinée ; et une
//     borne de sûreté de 3 ans (`HISTORIQUE_MAX_JOURS`) quoi qu'il arrive.
//   · ACHATS — eBay ne les sert que sur 60 jours (`GetMyeBayBuying`,
//     `DurationInDays` ≤ 60) : ils restent lus en direct (eBay → Achats). La
//     ligne le DIT (`achats.limiteJours: 60`), sans rien promettre de plus.
//
// RÈGLES (§4, §5) :
//   · UN appel = UNE étape bornée (au plus `HISTORIQUE_PAGES_PAR_APPEL` pages) :
//     l'app rappelle tant que ce n'est pas fini ; la REPRISE est dans la ligne
//     `import_ebay{suffixe}` (curseur : fin de fenêtre + offset).
//   · FUSION par n° de commande (`orderId`) dans `ebay_orders{suffixe}` : une
//     commande déjà rangée n'est JAMAIS remplacée (la synchronisation l'a
//     entière) ; une commande neuve entre ALLÉGÉE (ni acheteur, ni adresse, ni
//     note — rien de personnel n'est gardé pour l'historique). Jamais par titre.
//   · Une page que la base n'a pas prise n'avance PAS (relue à l'appel suivant).
//   · Une réponse d'une forme inconnue (pas de tableau `orders`, une commande
//     sans `orderId`) n'écrit RIEN.
//   · Déjà fini ⇒ AUCUN appel à eBay (« base complète ⇒ aucune lecture »).
//   · `depuisDebut` (SON clic « Tout récupérer ») repart de maintenant.
//   · Lecture seule chez eBay : des GET, rien d'autre.
// ═══════════════════════════════════════════════════════════════════════════

export const HISTORIQUE_FENETRE_JOURS = 90;
export const HISTORIQUE_MAX_JOURS = 3 * 365;
export const HISTORIQUE_LIMITE = 200;
export const HISTORIQUE_PAGES_PAR_APPEL = 3;
export const HISTORIQUE_ACHATS_JOURS = 60;
const JOUR = 86400000;
const echec = (error, status = 502, reason) => ({ status, body: { ok: false, error, ...(reason ? { reason } : {}) } });

// Une commande pour l'HISTORIQUE : tout ce que les règles de l'app lisent
// (montant reçu, frais, statut, lignes et SKU, annulation, dates), rien de la
// personne (acheteur, adresse de livraison, notes).
export function commandeAllegee(o, now) {
  if (!o || typeof o !== 'object' || typeof o.orderId !== 'string' || !o.orderId.trim()) return null;
  const c = JSON.parse(JSON.stringify(o));
  delete c.buyer; delete c.buyerCheckoutNotes;
  if (Array.isArray(c.fulfillmentStartInstructions)) {
    c.fulfillmentStartInstructions = c.fulfillmentStartInstructions.map((f) => {
      if (!f || typeof f !== 'object') return f;
      const g = { ...f };
      if (g.shippingStep && typeof g.shippingStep === 'object') { g.shippingStep = { ...g.shippingStep }; delete g.shippingStep.shipTo; }
      delete g.finalDestinationAddress; delete g.pickupStep;
      return g;
    });
  }
  return { ...c, _historique: true, _capturedAt: now };
}

// Fusion par n° de commande : seules les commandes ABSENTES entrent. Rend la
// ligne neuve et le nombre ajouté, ou `undefined` (rien à écrire).
export function fusionHistoriqueEbay(courant, orders, now) {
  const d = courant && typeof courant === 'object' ? courant : {};
  const deja = new Set((Array.isArray(d.orders) ? d.orders : []).map((o) => o && o.orderId).filter((x) => typeof x === 'string'));
  const neuves = [];
  for (const o of orders) {
    if (deja.has(o.orderId)) continue;
    const a = commandeAllegee(o, now);
    if (a) { neuves.push(a); deja.add(o.orderId); }
  }
  if (!neuves.length) return { ligne: undefined, ajoutees: 0 };
  return { ligne: { ...d, orders: [...(Array.isArray(d.orders) ? d.orders : []), ...neuves] }, ajoutees: neuves.length };
}

// Une page de `getOrders` lisible : un tableau `orders`, chaque commande avec son n°.
export function pageCommandesLisible(data) {
  return !!(data && Array.isArray(data.orders) && data.orders.every((o) => o && typeof o.orderId === 'string' && o.orderId.trim()));
}

// eBay refuse une fenêtre trop ancienne : 400 qui parle de la date de création.
export function refusDate(rep) {
  if (!rep || rep.status !== 400) return false;
  const errs = rep.data && Array.isArray(rep.data.errors) ? rep.data.errors : [];
  const txt = errs.map((e) => [e && e.message, e && e.longMessage, ...(Array.isArray(e && e.parameters) ? e.parameters.map((p) => p && p.value) : [])].join(' ')).join(' ') + ' ' + String(rep.raw || '');
  return /creation\s*date|creationdate|date range|too old|older than|range/i.test(txt);
}

export function etatNeuf(now, demande) {
  return { v: 1, type: 'import', plateforme: 'ebay', debut: now, demande: !!demande, at: now,
    ventes: { lus: 0, total: null, pages: 0, fini: false }, achats: { lus: 0, total: null, pages: 0, fini: true, limiteJours: HISTORIQUE_ACHATS_JOURS },
    curseur: { fin: new Date(now).toISOString(), offset: 0, fenetres: 0 }, borne: null, raisonFin: null, fin: null, cause: null };
}

// Le résumé que lit l'app (`src/importSites.js`) : la même forme que Vinted.
export function resumeHistoriqueEbay(st) {
  const fini = !!(st && st.ventes && st.ventes.fini);
  return { ...st, etat: fini ? 'fini' : (st.cause ? 'pause' : ((st.ventes.lus > 0 || st.ventes.pages > 0) ? 'encours' : 'attente')) };
}

export function creerHistoriqueEbay({ lire, modifier, jeton, json, apiOrigin, maintenant = () => Date.now() }) {
  return async (ctx, b = {}) => {
    const suffixe = (ctx && ctx.compte && ctx.compte.suffixe) || '';
    const ligneEtat = 'import_ebay' + suffixe, ligneCommandes = 'ebay_orders' + suffixe;
    const lu = await lire(ligneEtat, ctx.owner);
    if (lu === undefined) return echec('Ton historique eBay n’a pas pu être relu. Rien n’a été lu chez eBay.', 502, 'pas-su');
    const now = maintenant();
    let st = (b && b.depuisDebut === true) || !lu || lu.v !== 1 || !lu.ventes || !lu.curseur ? etatNeuf(now, b && b.depuisDebut === true) : { ...lu, ventes: { ...lu.ventes }, curseur: { ...lu.curseur } };
    if (st.ventes.fini && !(b && b.depuisDebut === true)) return { status: 200, body: { ok: true, deja: true, etat: resumeHistoriqueEbay(st) } };
    const a = await jeton(ctx);
    if (!a || !a.ok || !a.token) return echec((a && a.error) || 'Compte eBay indisponible.', (a && a.status) || 502, a && a.reason);
    const borneMin = now - HISTORIQUE_MAX_JOURS * JOUR;
    let pages = 0;
    st.cause = null;
    while (pages < HISTORIQUE_PAGES_PAR_APPEL && !st.ventes.fini) {
      const fin = Date.parse(st.curseur.fin);
      if (!Number.isFinite(fin) || fin <= borneMin) { st.ventes.fini = true; st.raisonFin = 'max'; st.borne = new Date(borneMin).toISOString(); break; }
      const de = Math.max(borneMin, fin - HISTORIQUE_FENETRE_JOURS * JOUR);
      const offset = Number.isInteger(st.curseur.offset) && st.curseur.offset >= 0 ? st.curseur.offset : 0;
      const filtre = encodeURIComponent(`creationdate:[${new Date(de).toISOString()}..${new Date(fin).toISOString()}]`);
      const rep = await json(`${apiOrigin}/sell/fulfillment/v1/order?filter=${filtre}&limit=${HISTORIQUE_LIMITE}&offset=${offset}`, a.token);
      pages++;
      if (!rep || !rep.ok) {
        // La période qu'eBay ne sert plus : la lecture s'arrête là (sa limite, mesurée par son refus).
        if (refusDate(rep) && st.curseur.fenetres > 0) { st.ventes.fini = true; st.raisonFin = 'ebay'; st.borne = new Date(fin).toISOString(); break; }
        st.cause = rep && rep.status === 429 ? 'ebay-freine' : 'ebay';
        break;
      }
      if (!pageCommandesLisible(rep.data)) { st.cause = 'forme'; break; }
      const orders = rep.data.orders;
      if (orders.length) {
        let ajoutees = 0;
        const ok = await modifier(ligneCommandes, ctx.owner, (cur) => { const r = fusionHistoriqueEbay(cur, orders, now); ajoutees = r.ajoutees; return r.ligne; });
        // La base n'a pas pris la page : rien n'avance (relue à l'appel suivant).
        if (ok !== true) { st.cause = 'base'; break; }
        st.ventes.ajoutees = (Number(st.ventes.ajoutees) || 0) + ajoutees;
      }
      st.ventes.pages += 1;
      st.ventes.lus += orders.length;
      const total = Number.isInteger(rep.data.total) && rep.data.total >= 0 ? rep.data.total : null;
      const suivant = offset + orders.length;
      if (orders.length && total !== null && suivant < total && suivant <= 10000) st.curseur.offset = suivant;
      else { st.curseur = { fin: new Date(de).toISOString(), offset: 0, fenetres: (Number(st.curseur.fenetres) || 0) + 1 }; st.borne = new Date(de).toISOString(); }
    }
    st.at = now;
    if (st.ventes.fini && !st.fin) { st.fin = now; st.ventes.total = st.ventes.lus; }
    const resume = resumeHistoriqueEbay(st);
    const ecrit = await modifier(ligneEtat, ctx.owner, (cur) => {
      // « Tout récupérer » cliqué ailleurs PENDANT cette étape : sa reprise gagne.
      if (cur && cur.debut && Number(cur.debut) !== Number(st.debut) && !(b && b.depuisDebut === true)) return undefined;
      return { ...resume, capturedAt: new Date(now).toISOString() };
    });
    if (ecrit !== true) return echec('La progression n’a pas pu être notée. Les commandes lues restent rangées.', 502, 'base');
    return { status: 200, body: { ok: true, pages, etat: resume } };
  };
}
