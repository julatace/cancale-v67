// ══════════════════════════════════════════════════════════════════════════════
//  RÉPONSES RAPIDES SANS IA (21 nov. 2026, ext. 5.421.0, `reponsesrapides`)
//  docs/passation/2026-11-21-ext-5421.md
// ══════════════════════════════════════════════════════════════════════════════
// Julien (21 nov., choix n° 4) : dans le panneau (fil d'une conversation Vinted, Leboncoin, Vestiaire) et dans
// l'écran Messages de l'app, reconnaître les questions courantes PAR MOTS-CLÉS (fr, en, es, it, de) et proposer
// SA réponse toute prête, remplie avec les infos de CETTE paire. AUCUNE IA, aucun réseau, aucune clé (§2.9) :
// ce module ne fait que comparer des mots et poser des variables.
//   · catégories : disponibilité, taille/pointure, envoi/délai, lot, dernier prix/négociation, état/défauts,
//     authenticité, photos en plus, échange ;
//   · SES modèles par catégorie (éditables dans le panneau, `vrm_reponses_rapides` de la ligne `vrm_reglages_auto`) ;
//     sans modèle à lui pour une catégorie : le modèle par défaut, dans la LANGUE DU MESSAGE ;
//   · variables {pseudo} {article} {taille} {prix} {prix_mini} — posées seulement si elles sont SUES (par identité
//     de l'annonce de la conversation, jamais par titre) ; une variable pas sue ⇒ la version est SAUTÉE (jamais un
//     trou) ; {prix_mini} n'est posé que s'il a choisi de le dire (`revelerMini`, éteint par défaut) ;
//   · « toujours disponible » n'est jamais proposé sous une annonce prouvée partie (`partie`) ;
//   · rien n'est envoyé ici : l'envoi est SON toucher « Envoyer » (par l'interface de la page).
// Le bloc <reponses-rapides-regle> est recopié TEL QUEL dans vinted-sync-extension/background.js
// (node scripts/audit-reponses-rapides.cjs --recopie) ; l'audit exécute la copie livrée.
// <reponses-rapides-regle> — la RÈGLE, recopiée telle quelle dans background.js (node scripts/audit-reponses-rapides.cjs --recopie).
const RR_LANGUES = ['fr', 'en', 'es', 'it', 'de'];
const RR_CATEGORIES = ['dispo', 'taille', 'envoi', 'lot', 'prix', 'etat', 'authenticite', 'photos', 'echange'];
const RR_VARIABLES = ['pseudo', 'article', 'taille', 'prix', 'prix_mini'];
const RR_TEXTE_MAX = 1000, RR_VERSIONS_MAX = 5, RR_PROPOSITIONS_MAX = 3;
// Minuscules, sans accents, ponctuation ⇒ espace ; « größe » ⇒ « grosse ».
function rrNormaliser(t) {
  return ' ' + String(t == null ? '' : t).toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[’'`´]/g, ' ').replace(/[^a-z0-9½]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
}
// Les mots de chaque catégorie, par langue. Un mot se repère ENTIER ; « mot* » repère le début d'un mot ; une
// expression est une suite de mots. Liste FERMÉE : un mot trop courant (« vrai », « echt », « colis ») n'y est pas,
// il ferait des faux positifs (comptés par l'audit sur un corpus de phrases inventées).
const RR_MOTS = {
  dispo: {
    fr: ['dispo', 'disponible', 'toujours dispo*', 'encore dispo*', 'toujours en vente', 'encore en vente', 'est elle vendue', 'est il vendu', 'deja vendu*', 'tu l as encore', 'vous l avez encore'],
    en: ['available', 'still available', 'still have', 'still for sale', 'is it sold', 'sold already', 'still got'],
    es: ['disponible', 'sigue disponible', 'aun disponible', 'todavia disponible', 'lo tienes', 'la tienes', 'sigue a la venta', 'esta vendid*'],
    it: ['disponibile', 'ancora disponibile', 'ce l hai ancora', 'ancora in vendita', 'gia vendut*'],
    de: ['verfugbar', 'noch verfugbar', 'noch da', 'noch zu haben', 'noch zu verkaufen', 'schon verkauft', 'noch erhaltlich'],
  },
  taille: {
    fr: ['taille', 'tailles', 'pointure', 'chausse*', 'taille grand', 'taille petit', 'taille normalement'],
    en: ['size', 'sizing', 'fit', 'fits', 'true to size', 'run small', 'run big', 'runs small', 'runs big', 'tts'],
    es: ['talla', 'tallaje', 'horma', 'que numero', 'numero calzas'],
    it: ['taglia', 'calzata', 'vestibilita', 'calza*', 'che numero'],
    de: ['grosse', 'passform', 'fallt klein', 'fallt gross', 'fallen klein', 'fallen gross', 'schuhgrosse'],
  },
  envoi: {
    fr: ['envoi', 'envois', 'envoyer', 'envoyez', 'envoies', 'expedi*', 'livraison', 'delai', 'delais', 'quand tu envoie*', 'sous combien de temps'],
    en: ['ship', 'shipping', 'ships', 'delivery', 'dispatch*', 'when can you send', 'how long'],
    es: ['envio', 'enviar', 'envias', 'mandar', 'mandas', 'plazo de entrega'],
    it: ['spedi*', 'invio', 'inviare', 'consegna'],
    de: ['versand', 'versenden', 'verschick*', 'lieferung', 'schickst'],
  },
  lot: {
    fr: ['lot', 'lots', 'les deux', 'les 2', 'ensemble', 'plusieurs articles', 'prendre aussi', 'avec l autre'],
    en: ['bundle', 'bundles', 'both', 'together', 'the two', 'several items', 'buy two'],
    es: ['lote', 'los dos', 'las dos', 'juntos', 'juntas', 'ambos', 'pack'],
    it: ['lotto', 'entrambi', 'entrambe', 'insieme', 'tutti e due', 'tutte e due'],
    de: ['paket', 'beide', 'zusammen', 'bundle'],
  },
  prix: {
    fr: ['prix', 'baisser', 'baisse', 'dernier prix', 'meilleur prix', 'negociable', 'negocier', 'reduc*', 'moins cher', 'petit geste', 'combien'],
    en: ['price', 'lowest', 'best price', 'negotiable', 'discount', 'cheaper', 'last price', 'how much'],
    es: ['precio', 'rebaja*', 'negociable', 'descuento', 'ultimo precio', 'mas barato', 'cuanto'],
    it: ['prezzo', 'sconto', 'trattabile', 'ultimo prezzo', 'meno caro', 'quanto'],
    de: ['preis', 'verhandelbar', 'rabatt', 'letzter preis', 'gunstiger', 'vb', 'wie viel'],
  },
  etat: {
    fr: ['defaut', 'defauts', 'etat', 'abime*', 'tache', 'taches', 'usure', 'usee', 'usees', 'trou', 'rayure*', 'dechir*'],
    en: ['defect*', 'flaw', 'flaws', 'condition', 'damage*', 'stain*', 'scuff*', 'worn', 'hole', 'scratch*'],
    es: ['defecto*', 'estado', 'mancha*', 'desgaste', 'rotura*', 'roto', 'rota', 'aranazo*', 'usad*'],
    it: ['difett*', 'condizion*', 'macchi*', 'usura', 'stato', 'rovinat*', 'graffi*', 'buco'],
    de: ['mangel', 'mangeln', 'zustand', 'fleck*', 'schaden', 'gebrauchsspuren', 'kratzer', 'loch', 'beschadig*'],
  },
  authenticite: {
    fr: ['authentique*', 'authenticite', 'vraie paire', 'vrai ou faux', 'contrefacon*', 'fake', 'replique', 'originale', 'originales', 'legit', 'facture', 'preuve d achat', 'ticket de caisse'],
    en: ['authentic*', 'genuine', 'fake', 'legit', 'real or fake', 'replica', 'receipt', 'proof of purchase'],
    es: ['autentic*', 'original', 'originales', 'falso', 'falsa', 'falsas', 'falsos', 'replica', 'factura'],
    it: ['autentic*', 'originale', 'originali', 'falso', 'falsi', 'falsa', 'false', 'scontrino', 'fattura'],
    de: ['echtheit', 'ist das echt', 'sind die echt', 'original', 'originale', 'falschung', 'rechnung', 'kassenbon'],
  },
  photos: {
    fr: ['photo', 'photos', 'plus de photo*', 'autre photo*', 'video', 'videos'],
    en: ['photo', 'photos', 'picture', 'pictures', 'pic', 'pics', 'video', 'videos'],
    es: ['foto', 'fotos', 'video', 'videos'],
    it: ['foto', 'video'],
    de: ['foto', 'fotos', 'bild', 'bilder', 'video', 'videos'],
  },
  echange: {
    fr: ['echange', 'echanges', 'echanger', 'troc', 'troquer'],
    en: ['trade', 'swap', 'exchange'],
    es: ['intercambio', 'intercambiar', 'intercambias', 'hacer cambio'],
    it: ['scambio', 'scambi', 'scambiare', 'baratto'],
    de: ['tausch', 'tauschen', 'tauscht', 'tauschst'],
  },
};
// Les petits mots qui disent la langue (en plus des mots des catégories).
const RR_OUTILS = {
  fr: ['bonjour', 'bonsoir', 'salut', 'est', 'elle', 'il', 'encore', 'toujours', 'vous', 'merci', 'quelle', 'quel', 'svp', 'avez', 'est ce', 'je', 'oui', 'la', 'le', 'des', 'une', 'tu', 'possible'],
  en: ['hi', 'hello', 'hey', 'is', 'still', 'the', 'you', 'what', 'thanks', 'please', 'it', 'do', 'does', 'any', 'are', 'how', 'can', 'would'],
  es: ['hola', 'buenas', 'sigue', 'esta', 'gracias', 'que', 'tienes', 'el', 'por', 'favor', 'cual', 'hay', 'tiene', 'puedes', 'es', 'la', 'me'],
  it: ['ciao', 'salve', 'ancora', 'grazie', 'che', 'sono', 'della', 'hai', 'quale', 'per', 'favore', 'puoi', 'il', 'e', 'la', 'ci', 'mi'],
  de: ['hallo', 'ist', 'noch', 'danke', 'die', 'der', 'das', 'sie', 'du', 'welche', 'gibt', 'es', 'wie', 'bitte', 'kannst', 'haben', 'ich'],
};
const rrEchapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const _rrRe = new Map();
function rrMotRe(m) {
  if (!_rrRe.has(m)) {
    const prefixe = m.endsWith('*');
    const corps = rrEchapper(rrNormaliser(prefixe ? m.slice(0, -1) : m).trim());
    _rrRe.set(m, new RegExp(' ' + corps + (prefixe ? '[a-z0-9]*' : '') + ' '));
  }
  return _rrRe.get(m);
}
const rrContient = (n, m) => rrMotRe(m).test(n);
// La langue du message : celle qui a le plus de mots repérés. Égalité ou rien ⇒ null (la langue de l'interface).
function rrLangue(texte) {
  const n = rrNormaliser(texte);
  const score = {};
  for (const l of RR_LANGUES) {
    let s = 0;
    for (const m of RR_OUTILS[l]) if (rrContient(n, m)) s += 1;
    for (const c of RR_CATEGORIES) for (const m of RR_MOTS[c][l]) if (rrContient(n, m)) s += 2;
    score[l] = s;
  }
  const tri = RR_LANGUES.slice().sort((a, b) => score[b] - score[a]);
  if (!score[tri[0]] || score[tri[0]] === score[tri[1]]) return null;
  return tri[0];
}
// Les catégories repérées : [{ cat, langue }] dans l'ordre de RR_CATEGORIES (toutes langues : « dispo ? size 43 ? »).
function rrQuestions(texte) {
  const n = rrNormaliser(texte);
  if (n.trim().length < 2) return [];
  const out = [];
  for (const cat of RR_CATEGORIES) {
    for (const l of RR_LANGUES) {
      if (RR_MOTS[cat][l].some((m) => rrContient(n, m))) { out.push({ cat, langue: l }); break; }
    }
  }
  return out;
}
// Ce qui attend une réponse dans un fil : les messages de l'ACHETEUR arrivés après le dernier message du vendeur.
// `messages` : [{ deMoi, texte }] dans l'ordre ; un message sans auteur sûr (deMoi ni vrai ni faux) arrête la lecture.
function rrQuestionEnAttente(messages) {
  const l = Array.isArray(messages) ? messages : [];
  const out = [];
  for (let i = l.length - 1; i >= 0; i--) {
    const m = l[i]; if (!m) continue;
    if (m.deMoi !== false) break;
    const t = String(m.texte || '').trim(); if (t) out.unshift(t);
    if (out.length >= 3) break;
  }
  return out.join(' \n ').slice(0, 1200);
}
// Les modèles par défaut : des mots envoyés à l'acheteur, dans SA langue. Rien n'y est promis qu'il n'ait dit
// (aucun délai chiffré, aucun état) ; la version à {prix_mini} ne sert que s'il a choisi de dire son prix mini.
const RR_DEFAUTS = {
  dispo: { fr: ['Bonjour {pseudo}, oui, {article} est toujours disponible.'], en: ['Hi {pseudo}, yes, {article} is still available.'], es: ['Hola {pseudo}, sí, {article} sigue disponible.'], it: ['Ciao {pseudo}, sì, {article} è ancora disponibile.'], de: ['Hallo {pseudo}, ja, {article} ist noch verfügbar.'] },
  taille: { fr: ['Bonjour {pseudo}, c’est une taille {taille}, celle indiquée sur l’annonce.'], en: ['Hi {pseudo}, it’s a size {taille}, as shown on the listing.'], es: ['Hola {pseudo}, es una talla {taille}, la indicada en el anuncio.'], it: ['Ciao {pseudo}, è una taglia {taille}, quella indicata nell’annuncio.'], de: ['Hallo {pseudo}, es ist Größe {taille}, wie in der Anzeige angegeben.'] },
  envoi: { fr: ['Bonjour {pseudo}, j’envoie rapidement après l’achat, avec le suivi de la plateforme.'], en: ['Hi {pseudo}, I ship quickly after purchase, with the platform’s tracking.'], es: ['Hola {pseudo}, envío rápido tras la compra, con el seguimiento de la plataforma.'], it: ['Ciao {pseudo}, spedisco subito dopo l’acquisto, con il tracciamento della piattaforma.'], de: ['Hallo {pseudo}, ich versende schnell nach dem Kauf, mit Sendungsverfolgung der Plattform.'] },
  lot: { fr: ['Bonjour {pseudo}, oui, je fais des lots : ajoute les articles qui te plaisent dans un lot et fais-moi une offre.'], en: ['Hi {pseudo}, yes, I do bundles: add the items you like to a bundle and send me an offer.'], es: ['Hola {pseudo}, sí, hago lotes: añade los artículos que te gusten a un lote y hazme una oferta.'], it: ['Ciao {pseudo}, sì, faccio lotti: aggiungi gli articoli che ti piacciono a un lotto e fammi un’offerta.'], de: ['Hallo {pseudo}, ja, ich mache Pakete: leg die Artikel, die dir gefallen, in ein Paket und mach mir ein Angebot.'] },
  prix: { fr: ['Bonjour {pseudo}, je peux descendre à {prix_mini} pour {article}.', 'Bonjour {pseudo}, {article} est à {prix} : tu peux me faire une offre avec le bouton « Faire une offre ».'], en: ['Hi {pseudo}, I can go down to {prix_mini} for {article}.', 'Hi {pseudo}, {article} is {prix}: you can send me an offer with the “Make an offer” button.'], es: ['Hola {pseudo}, puedo bajar a {prix_mini} por {article}.', 'Hola {pseudo}, {article} cuesta {prix}: puedes hacerme una oferta con el botón «Hacer una oferta».'], it: ['Ciao {pseudo}, posso scendere a {prix_mini} per {article}.', 'Ciao {pseudo}, {article} costa {prix}: puoi farmi un’offerta con il pulsante «Fai un’offerta».'], de: ['Hallo {pseudo}, ich kann für {article} auf {prix_mini} runtergehen.', 'Hallo {pseudo}, {article} kostet {prix}: du kannst mir über „Preis vorschlagen“ ein Angebot machen.'] },
  etat: { fr: ['Bonjour {pseudo}, tout est décrit dans l’annonce et visible sur les photos ; dis-moi si tu veux voir un détail.'], en: ['Hi {pseudo}, everything is described in the listing and visible in the photos; tell me if you want to see a detail.'], es: ['Hola {pseudo}, todo está descrito en el anuncio y se ve en las fotos; dime si quieres ver algún detalle.'], it: ['Ciao {pseudo}, è tutto descritto nell’annuncio e visibile nelle foto; dimmi se vuoi vedere un dettaglio.'], de: ['Hallo {pseudo}, alles ist in der Anzeige beschrieben und auf den Fotos zu sehen; sag mir, wenn du ein Detail sehen willst.'] },
  authenticite: { fr: ['Bonjour {pseudo}, je ne vends que des articles authentiques ; tu peux aussi demander la vérification proposée par la plateforme.'], en: ['Hi {pseudo}, I only sell authentic items; you can also ask for the platform’s verification.'], es: ['Hola {pseudo}, solo vendo artículos auténticos; también puedes pedir la verificación de la plataforma.'], it: ['Ciao {pseudo}, vendo solo articoli autentici; puoi anche chiedere la verifica della piattaforma.'], de: ['Hallo {pseudo}, ich verkaufe nur echte Artikel; du kannst auch die Echtheitsprüfung der Plattform anfragen.'] },
  photos: { fr: ['Bonjour {pseudo}, bien sûr, je t’envoie d’autres photos de {article} dès que possible.'], en: ['Hi {pseudo}, sure, I’ll send you more photos of {article} as soon as I can.'], es: ['Hola {pseudo}, claro, te mando más fotos de {article} en cuanto pueda.'], it: ['Ciao {pseudo}, certo, ti mando altre foto di {article} appena posso.'], de: ['Hallo {pseudo}, klar, ich schicke dir so bald wie möglich weitere Fotos von {article}.'] },
  echange: { fr: ['Bonjour {pseudo}, désolé, je ne fais pas d’échange, seulement la vente.'], en: ['Hi {pseudo}, sorry, I don’t do trades, only sales.'], es: ['Hola {pseudo}, lo siento, no hago intercambios, solo venta.'], it: ['Ciao {pseudo}, mi dispiace, non faccio scambi, solo vendita.'], de: ['Hallo {pseudo}, sorry, ich tausche nicht, nur Verkauf.'] },
};
// Une version écrite par lui : texte non vide, borné, variables connues seulement, accolades fermées.
function rrErreurTexte(t) {
  const s = String(t == null ? '' : t);
  if (!s.trim()) return 'vide';
  if (s.length > RR_TEXTE_MAX) return 'long';
  const sans = s.replace(/\{([a-z_]+)\}/g, (x, v) => (RR_VARIABLES.includes(v) ? '' : '\u0000'));
  if (sans.includes('\u0000')) return 'variable';
  if (/[{}]/.test(sans)) return 'accolade';
  return '';
}
// SON réglage normalisé : { v, modeles: { cat: [texte] } (5 versions au plus), revelerMini } — éteint par défaut,
// une version refusée par `rrErreurTexte` n'est pas gardée.
function rrReglage(o) {
  const x = o && typeof o === 'object' && !Array.isArray(o) ? o : {};
  const m0 = x.modeles && typeof x.modeles === 'object' && !Array.isArray(x.modeles) ? x.modeles : {};
  const modeles = {};
  for (const c of RR_CATEGORIES) {
    const l = (Array.isArray(m0[c]) ? m0[c] : []).map((t) => String(t == null ? '' : t).trim()).filter((t) => !rrErreurTexte(t));
    const u = [...new Set(l)].slice(0, RR_VERSIONS_MAX);
    if (u.length) modeles[c] = u;
  }
  return { v: 1, modeles, revelerMini: x.revelerMini === true };
}
// « 59 € » · « 47,50 € » — un prix posé dans un message.
function rrEuros(v) {
  const n = Number(v); if (!(Number.isFinite(n) && n > 0)) return '';
  const c = Math.round(n * 100);
  return (c % 100 ? (c / 100).toFixed(2).replace('.', ',') : String(c / 100)) + ' €';
}
// Pose les variables. `vars` : { pseudo, article, taille, prix, prix_mini } (prix en euros, nombre) ;
// rend { texte } ou { manque: 'nom' } — une variable pas sue, ou {prix_mini} sans SON accord, saute la version.
function rrRemplir(texte, vars, opts) {
  const v = vars && typeof vars === 'object' ? vars : {};
  const o = opts && typeof opts === 'object' ? opts : {};
  let manque = '';
  const t = String(texte == null ? '' : texte).replace(/\{([a-z_]+)\}/g, (x, nom) => {
    if (manque) return x;
    if (nom === 'prix_mini' && o.revelerMini !== true) { manque = 'prix_mini_cache'; return x; }
    const brut = nom === 'prix' || nom === 'prix_mini' ? rrEuros(v[nom]) : String(v[nom] == null ? '' : v[nom]).replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!brut) { manque = nom; return x; }
    return brut;
  });
  return manque ? { manque } : { texte: t.trim() };
}
// LES PROPOSITIONS d'un fil : [{ cat, langue, texte, version, sienne } | { cat, langue, manque }], au plus 3.
//  ctx : { messages | texte, reglage (rrReglage), vars, langueUi, partie (annonce prouvée partie), sur (texte → bool,
//        la règle des mots qui font bannir), derniere ({ cat: version }), hasard }
function rrPropositions(ctx) {
  const c = ctx && typeof ctx === 'object' ? ctx : {};
  const question = typeof c.texte === 'string' ? c.texte : rrQuestionEnAttente(c.messages);
  const qs = rrQuestions(question);
  if (!qs.length) return { question, propositions: [] };
  const langue = rrLangue(question) || (RR_LANGUES.includes(c.langueUi) ? c.langueUi : 'fr');
  const R = rrReglage(c.reglage);
  const hasard = typeof c.hasard === 'function' ? c.hasard : Math.random;
  const sur = typeof c.sur === 'function' ? c.sur : () => true;
  const out = [];
  for (const { cat } of qs) {
    if (out.length >= RR_PROPOSITIONS_MAX) break;
    if (cat === 'dispo' && c.partie === true) { out.push({ cat, langue, manque: 'partie' }); continue; }
    const siennes = R.modeles[cat] || null;
    const versions = siennes || RR_DEFAUTS[cat][langue] || RR_DEFAUTS[cat].fr;
    const possibles = []; let manque = '';
    versions.forEach((tx, i) => {
      const r = rrRemplir(tx, c.vars, { revelerMini: R.revelerMini });
      if (r.manque) { if (!manque) manque = r.manque; return; }
      if (!sur(r.texte)) { if (!manque) manque = 'texte_interdit'; return; }
      possibles.push({ i, texte: r.texte });
    });
    if (!possibles.length) { out.push({ cat, langue, manque: manque || 'aucune' }); continue; }
    // Une version au hasard parmi les possibles, jamais la dernière proposée pour cette catégorie (s'il y en a une autre).
    const dern = c.derniere && typeof c.derniere === 'object' ? c.derniere[cat] : null;
    const pool = possibles.length > 1 && dern != null ? possibles.filter((p) => p.i !== dern) : possibles;
    const p = pool[Math.min(pool.length - 1, Math.floor(hasard() * pool.length))];
    out.push({ cat, langue, texte: p.texte, version: p.i, sienne: !!siennes });
  }
  return { question, langue, propositions: out };
}
// </reponses-rapides-regle>
export { RR_LANGUES, RR_CATEGORIES, RR_VARIABLES, RR_MOTS, RR_DEFAUTS, RR_TEXTE_MAX, RR_VERSIONS_MAX, rrNormaliser, rrContient, rrLangue, rrQuestions, rrQuestionEnAttente, rrErreurTexte, rrReglage, rrRemplir, rrEuros, rrPropositions };
