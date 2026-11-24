// ════════════════════════════════════════════════════════════════════════════
//  TROUVER UN ÉLÉMENT DE VINTED — la couche de repérage commune (ext. 5.440, 23 nov.)
//
//  Julien, 23 nov. : « l'extension doit pouvoir tout faire sur Vinted, rends-la
//  intelligente » ; « l'app doit s'adapter toute seule au bouton favoris ». Avant, chaque
//  étape cherchait SON élément d'une seule façon (un nom exact, un data-testid) et, quand
//  Vinted changeait sa page, VRM demandait de « toucher le bouton une fois ». Ici :
//
//   · CHAQUE élément a PLUSIEURS stratégies (nom accessible en 5 langues, data-testid
//     partiel, adresse du lien, icône, classe, position dans l'en-tête…) ; chaque
//     stratégie qui reconnaît un candidat lui donne des points ;
//   · un candidat ne compte que VISIBLE, CLIQUABLE, hors de ce que VRM pose dans la page,
//     et dans le BON contexte (l'en-tête pour la cloche, le formulaire du champ pour
//     « Envoyer », la fenêtre de l'offre pour « Proposer ») ;
//   · le meilleur score gagne s'il est SEUL ; deux candidats au même score ⇒ `ambigu` et
//     rien n'est cliqué (VRM ne choisit jamais au hasard) ;
//   · `attendre` patiente pendant que la page se construit (mutations du DOM + relecture
//     régulière), sans jamais toucher à rien ;
//   · la stratégie qui a marché est RENDUE au fond, qui la retient (chrome.storage.local,
//     par élément et par version de la page) et la repasse la fois suivante : elle compte
//     en premier à score égal — une mémoire AUTOMATIQUE, aucun geste demandé ;
//   · rien trouvé ⇒ un JOURNAL précis : l'élément, chaque stratégie essayée, combien de
//     candidats chacune a vus (jamais un texte de la page, jamais une valeur).
//
//  Injecté dans le monde de la PAGE (avant vrm-formulaire.js). Il ne clique RIEN, ne lit
//  ni n'envoie aucune requête : il désigne un élément, le geste reste à l'étape appelante.
//
//  Pour la republication (la suite annoncée par Julien), les éléments à brancher ensuite
//  sont listés dans docs/passation/2026-11-23-favoris-auto.md (« vendre », « titre »,
//  « photos », « brouillon », « ajouter », « supprimer », « confirmer la suppression »…).
//
//  ══ 5.448 (`adaptatif`, 24 nov.) — TOUS LES SITES ══════════════════════════════════════════
//  Julien : « elle doit pouvoir marcher sur tous les sites, s'adapter » ; « hors de question
//  qu'il y ait encore une erreur ». La même couche sert maintenant Vinted, Leboncoin, Vestiaire
//  et eBay, dans le monde de la PAGE (Vinted) comme dans le monde ISOLÉ des scripts de contenu
//  (Leboncoin, Vestiaire, eBay) — elle ne lit que le DOM :
//   · une TABLE PAR SITE (`ctx.site` ou « site.élément ») : Vinted (+ vendre, titre, description,
//     prix, photos, brouillon, publier, enregistrer, supprimer, confirmer la suppression),
//     Leboncoin (champ du message, « Envoyer », champ du prix), Vestiaire (champ du message,
//     « Envoyer »), eBay (titre, description, prix, référence) ;
//   · `souple(sig)` : un geste APPRIS (la « signature » de son propre clic : balise, quelques
//     attributs, le mot du bouton) que la page a un peu changé — un attribut renommé, une classe —
//     est retrouvé par ce qui reste : chaque morceau de la signature encore vrai donne des points,
//     le mot du bouton (ou son nom accessible) est EXIGÉ quand il a été appris, et le meilleur
//     gagne s'il est SEUL ; sinon rien ;
//   · ne clique RIEN, ne lit ni n'envoie aucune requête (inchangé).
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.__vrmTrouver && globalThis.__vrmTrouverV >= 2) return;
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  const deVrm = (el) => { try { return !!(el && el.closest && el.closest('#vrm-travail, [data-vrm-hote], #vrm-action-gel, [data-vrm], #vrm-badge, [id^="vrm-"]')); } catch (_) { return false; } };
  const visible = (el) => {
    try {
      if (!el || !el.isConnected || deVrm(el)) return false;
      if (el.closest('[inert],[aria-hidden="true"]')) return false;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none') return false;
      if (el.getClientRects().length) return true;
      // Un lien `display: contents` n'a pas de boîte à lui : son contenu compte.
      return st.display === 'contents' && [...el.querySelectorAll('*')].some((e) => e.getClientRects().length);
    } catch (_) { return false; }
  };
  const actif = (b) => !(b.disabled || b.getAttribute('aria-disabled') === 'true');
  const nomAcc = (b) => {
    try {
      const ids = (b.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
      if (ids.length) { const refs = ids.map((i) => document.getElementById(i)); if (!refs.some((x) => !x)) return refs.map((x) => x.textContent || '').join(' '); }
      if (b.hasAttribute('aria-label')) return b.getAttribute('aria-label') || '';
      const t = String(b.innerText || b.textContent || '').trim(); if (t) return t;
      const svgT = b.querySelector && b.querySelector('svg title'); if (svgT && svgT.textContent) return svgT.textContent;
      return b.getAttribute('title') || '';
    } catch (_) { return ''; }
  };
  const attr = (el, n) => { try { return String(el.getAttribute(n) || ''); } catch (_) { return ''; } };
  // Ce qui décrit un élément sans être un texte de la page : data-testid, id, classes, de lui et de ses icônes.
  const signes = (el) => {
    let s = [attr(el, 'data-testid'), el.id || '', typeof el.className === 'string' ? el.className : attr(el, 'class')].join(' ');
    try { for (const k of el.querySelectorAll('[data-testid], svg, use, img')) { s += ' ' + attr(k, 'data-testid') + ' ' + attr(k, 'class') + ' ' + attr(k, 'href') + ' ' + attr(k, 'xlink:href') + ' ' + attr(k, 'alt') + ' ' + attr(k, 'src').replace(/^.*\//, ''); const t = k.querySelector && k.querySelector('title'); if (t) s += ' ' + (t.textContent || ''); } } catch (_) {}
    return norm(s);
  };
  const enTete = (el) => { try { if (el.closest('header, [role="banner"], [data-testid*="header" i]')) return true; const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= 140; } catch (_) { return false; } };
  const chemin = (a) => { try { const u = new URL(a.href, location.href); return u.origin === location.origin ? u.pathname.replace(/\/+$/, '') : ''; } catch (_) { return ''; } };
  // Un compteur (« 3 », « 9+ ») posé dans l'élément : la cloche et l'enveloppe en portent un.
  // 5.448 : le LIBELLÉ d'un champ (ce que la page dit de lui) : nom accessible, <label>, indication, nom, identifiant.
  const libelle = (el) => {
    let t = '';
    try {
      const ids = attr(el, 'aria-labelledby').trim().split(/\s+/).filter(Boolean);
      for (const i of ids) { const x = document.getElementById(i); if (x) t += ' ' + (x.textContent || ''); }
      t += ' ' + attr(el, 'aria-label');
      if (el.labels && el.labels.length) for (const l of el.labels) t += ' ' + (l.textContent || '');
      else { const l = el.closest && el.closest('label'); if (l) t += ' ' + (l.textContent || ''); }
    } catch (_) {}
    return norm(t);
  };
  const indication = (el) => norm(attr(el, 'placeholder') + ' ' + attr(el, 'aria-placeholder') + ' ' + attr(el, 'data-placeholder'));
  const cles = (el) => norm([attr(el, 'name'), el.id || '', attr(el, 'data-testid'), attr(el, 'data-qa-id'), attr(el, 'data-test'), attr(el, 'data-cy')].join(' '));
  // Un champ de RECHERCHE ou de FILTRE n'est jamais un champ de dépôt (le prix d'une paire tombé dans « Prix max », mesuré).
  const RE_PAS_DEPOT = /recherch|search|\bmin\b|\bmax\b|_min\b|_max\b|min_|max_|filtr|filter|\btri\b|sort|code.?postal|zip|mot.?cl|keyword|_nkw|\bq\b/;
  const horsDepot = (el) => { try { return !!el.closest('header, footer, nav, [role="search"], [role="banner"], [role="navigation"], #gh') || RE_PAS_DEPOT.test(cles(el) + ' ' + indication(el) + ' ' + norm(attr(el, 'aria-label')) + ' ' + norm(attr(el, 'type'))); } catch (_) { return true; } };
  const saisissable = (el) => !el.disabled && !el.readOnly && attr(el, 'type') !== 'hidden';
  const compteur = (el) => { try { return [...el.querySelectorAll('span, div, sup')].some((x) => /^\d{1,3}\+?$/.test(String(x.textContent || '').trim()) && x.children.length === 0); } catch (_) { return false; } };

  const LANGUES = {
    notif: '(?:notifications?|notifiche|notificaciones|benachrichtigungen|meldingen|powiadomienia)',
    voirTout: /^(?:voir tout|tout voir|voir toutes(?: les notifications)?|see all|view all|show all|ver todo|ver todas|vedi tutto|vedi tutte|mostra tutto|alle anzeigen|alle ansehen)(?: [›>→])?$/,
  };
  const RE_CLOCHE = new RegExp(`^(?:(?:mes|my|le mie|meine|mis) |(?:(?:ouvrir|afficher|voir|fermer|masquer|open|show|view|close|hide|apri|chiudi|abrir|cerrar|offnen|schliessen) (?:les |the |le |las |die )?))?${LANGUES.notif}(?:\\s*[:·,–-]?\\s*\\(?[0-9]{1,5}\\+?\\)?(?: (?:non lues?|unread|non lette|sin leer|ungelesen|nouvelles?|new|nuove|nuevas|neu))?)?$`);
  const RE_ENVOYER = /^(envoyer|envoyer le message|send|send message|invia|invia messaggio|enviar|enviar mensaje|senden|nachricht senden)$/;
  const RE_FAIRE_OFFRE = /^(faire une offre|proposer un prix|proposer une offre|make an offer|offer a price|fai un'offerta|fare un'offerta|proponi un prezzo|hacer una oferta|haz una oferta|proponer un precio|preis vorschlagen|angebot machen|ein angebot machen)$/;
  const RE_VALIDER_OFFRE = /^(proposer|envoyer|envoyer l'offre|faire l'offre|faire une offre|proposer l'offre|offer|send|send offer|make offer|make an offer|submit|invia|invia offerta|proponi|enviar|enviar oferta|ofrecer|senden|angebot senden|anbieten)$/;
  // 5.448 : les noms exacts des boutons de la republication et du dépôt (5 langues, accents et casse retirés).
  const RE_VENDRE = /^(vends tes articles|vendre|vends|vends maintenant|sell now|sell|sell your items|vendi|vendi ora|vendi subito|vender|vende ya|vende ahora|verkaufen|jetzt verkaufen)$/;
  const RE_BROUILLON = /^(enregistrer (le |en |comme )?brouillon|sauvegarder (le |en |comme )?brouillon|brouillon|save (as )?(a )?draft|save draft|salva (come )?bozza|salva bozza|guardar (como )?borrador|guardar borrador|als entwurf speichern|entwurf speichern)$/;
  const RE_PUBLIER = /^(ajouter|publier|mettre en ligne|upload|add|add item|publish|post|list item|carica|pubblica|aggiungi|subir|publicar|anadir|hochladen|veroffentlichen|hinzufugen)$/;
  const RE_ENREGISTRER = /^(enregistrer|enregistrer les modifications|sauvegarder|mettre a jour|save|save changes|update|salva|salva modifiche|aggiorna|guardar|guardar cambios|actualizar|speichern|anderungen speichern|aktualisieren)$/;
  const RE_SUPPRIMER = /^(supprimer|supprimer l'article|supprimer l'annonce|delete|delete item|delete listing|elimina|elimina articolo|elimina l'articolo|eliminar|eliminar articulo|eliminar el articulo|loschen|artikel loschen)$/;
  const RE_CONFIRMER_SUPPRESSION = /^(supprimer|oui, supprimer|confirmer|confirmer la suppression|supprimer l'article|delete|yes, delete|confirm|delete item|elimina|si, elimina|conferma|eliminar|si, eliminar|confirmar|loschen|ja, loschen|bestatigen)$/;
  const RE_PLACEHOLDER_MSG = /(ecris|ecrire|message|write|type|scrivi|messaggio|escribe|mensaje|schreib|nachricht)/;
  const dansDialogue = (el) => { try { return !!el.closest('[role="dialog"],[aria-modal="true"]'); } catch (_) { return false; } };
  const leDialogue = () => { const l = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-testid*="modal" i]')].filter((x) => visible(x)); const fin = l.filter((el) => !l.some((x) => x !== el && el.contains(x))); return fin.length === 1 ? fin[0] : null; };

  // ── Le catalogue des éléments. Chaque stratégie : [nom, poids, test(candidat, ctx)]. ─────────────
  const ELEMENTS = {
    // La cloche de l'en-tête (bouton qui ouvre la liste, ou lien vers la page des notifications).
    cloche: {
      candidats: 'button, [role="button"], a[href]',
      // Jamais une LIGNE de la liste (le lien d'une notification porte un article ou une personne), jamais « Voir tout ».
      garder: (el) => !el.closest('footer') && !LANGUES.voirTout.test(norm(nomAcc(el))) && !dansDialogue(el) && !el.closest('[role="menuitem"], [role="option"], [role="listitem"]') && !(el.tagName === 'A' && (el.closest('[role="menu"], [role="listbox"], [role="dialog"]') || /\/items\/\d|\/member\/\d|\/inbox\/./.test(chemin(el)) || /[?&](item_id|receiver_id|offering_id)=/.test(String(el.href || '')))),
      strategies: [
        ['nom', 5, (el) => RE_CLOCHE.test(norm(nomAcc(el)))],
        ['testid', 4, (el) => /notif/.test(norm(attr(el, 'data-testid'))) || [...el.querySelectorAll('[data-testid]')].some((k) => /notif/.test(norm(attr(k, 'data-testid'))))],
        ['lien', 4, (el) => el.tagName === 'A' && /notif/i.test(chemin(el))],
        ['icone', 3, (el) => /\b(bell|cloche|notification|notif)[a-z0-9-]*/.test(signes(el)) && !!el.querySelector('svg, img, use')],
        ['controle', 1, (el) => /notif/.test(norm(attr(el, 'aria-controls') + ' ' + attr(el, 'aria-describedby')))],
      ],
      bonus: (el) => (enTete(el) ? 2 : 0) + (attr(el, 'aria-haspopup') || el.hasAttribute('aria-expanded') ? 1 : 0) + (compteur(el) ? 1 : 0),
      seuil: 4,
    },
    // « Voir tout » de la liste de la cloche ouverte (mène à la page complète).
    voirTout: {
      candidats: 'a[href], button, [role="button"]',
      garder: (el) => !el.closest('footer'),
      strategies: [
        ['nom', 4, (el) => LANGUES.voirTout.test(norm(nomAcc(el)))],
        ['lien', 3, (el) => el.tagName === 'A' && /notif/i.test(chemin(el))],
      ],
      bonus: (el) => (el.closest('[role="dialog"], [role="menu"], [role="listbox"], [data-testid*="notification" i], [class*="notification" i]') ? 2 : 0),
      seuil: 6,
    },
    // Le champ du message de la conversation ouverte (hors fenêtre).
    champMessage: {
      candidats: 'textarea, [contenteditable="true"], [role="textbox"], input[type="text"]',
      garder: (el) => !dansDialogue(el) && !el.readOnly && !el.disabled && !/search|recherche/i.test(attr(el, 'type') + ' ' + attr(el, 'name') + ' ' + attr(el, 'data-testid') + ' ' + attr(el, 'role') + ' ' + attr(el, 'aria-label')) && !el.closest('header, [role="banner"], [role="search"]'),
      strategies: [
        ['testid', 4, (el) => /(message|conversation|reply|composer|chat)/.test(norm(attr(el, 'data-testid')))],
        ['nom', 3, (el) => /^(message|body|reply|content|text)$/.test(norm(attr(el, 'name')))],
        ['indication', 3, (el) => RE_PLACEHOLDER_MSG.test(norm(attr(el, 'placeholder') + ' ' + attr(el, 'aria-label') + ' ' + attr(el, 'aria-placeholder') + ' ' + attr(el, 'data-placeholder')))],
        ['zone', 2, (el) => el.tagName === 'TEXTAREA' || (attr(el, 'contenteditable') === 'true' && attr(el, 'role') === 'textbox')],
        ['formulaire', 1, (el) => !!el.closest('form')],
      ],
      bonus: () => 0,
      seuil: 2,
    },
    // « Envoyer » du champ du message (dans SON formulaire d'abord).
    envoyer: {
      candidats: 'button, [role="button"]',
      garder: (el, ctx) => !dansDialogue(el) && actif(el) && !/cancel|close|annul|attach|photo|image|emoji/i.test(attr(el, 'data-testid') + ' ' + attr(el, 'aria-label')) && (!ctx.champ || !ctx.champ.closest('form') || ctx.champ.closest('form').contains(el) || !!el.closest('[data-testid*="composer" i], [data-testid*="message-input" i]')),
      strategies: [
        ['nom', 5, (el) => RE_ENVOYER.test(norm(nomAcc(el)))],
        ['testid', 4, (el) => /(^|[-_ ])send([-_ ]|$)|send[-_]?(button|message)|submit[-_]?message/.test(norm(attr(el, 'data-testid')))],
        ['icone', 2, (el) => /\b(send|paper-?plane|envoyer|arrow-?up)[a-z0-9-]*/.test(signes(el)) && !!el.querySelector('svg, use, img')],
        ['soumettre', 2, (el, ctx) => attr(el, 'type') === 'submit' && !!(ctx.champ && ctx.champ.closest('form') && ctx.champ.closest('form').contains(el))],
      ],
      bonus: (el, ctx) => (ctx.champ && ctx.champ.closest('form') && ctx.champ.closest('form').contains(el) ? 2 : 0),
      seuil: 5,
    },
    // « Faire une offre » dans la conversation.
    boutonOffre: {
      candidats: 'button, [role="button"], a[href]',
      garder: (el) => !dansDialogue(el) && actif(el) && !/accept|decline|reject|cancel/i.test(attr(el, 'data-testid')),
      strategies: [
        ['nom', 5, (el) => RE_FAIRE_OFFRE.test(norm(nomAcc(el)))],
        ['testid', 4, (el) => /make[-_ ]?offer|offer[-_ ]?(button|cta)/.test(norm(attr(el, 'data-testid')))],
      ],
      bonus: () => 0,
      seuil: 4,
    },
    // « Proposer » dans la fenêtre de l'offre.
    offreValider: {
      candidats: 'button, [role="button"]',
      racine: () => leDialogue(),
      garder: (el) => actif(el) && !/cancel|close|annul/i.test(attr(el, 'data-testid') + ' ' + norm(nomAcc(el))),
      strategies: [
        ['nom', 5, (el) => RE_VALIDER_OFFRE.test(norm(nomAcc(el)))],
        ['testid', 3, (el) => /submit|confirm|send|offer/.test(norm(attr(el, 'data-testid')))],
        ['soumettre', 1, (el) => attr(el, 'type') === 'submit'],
      ],
      bonus: () => 0,
      seuil: 5,
    },

    // ── 5.448 : la republication et le dépôt (Vinted). Un sélecteur fixe (data-testid, #id) passe toujours en premier
    //    dans vrm-formulaire.js ; ces tables prennent le relais quand Vinted l'a renommé. ──────────────────────────
    // « Vendre » de l'en-tête (le lien vers le formulaire de dépôt).
    vendre: {
      candidats: 'a[href], button, [role="button"]',
      garder: (el) => !dansDialogue(el) && !el.closest('footer'),
      strategies: [
        ['lien', 4, (el) => el.tagName === 'A' && /^\/items\/new$/.test(chemin(el))],
        ['nom', 4, (el) => RE_VENDRE.test(norm(nomAcc(el)))],
        ['testid', 4, (el) => /upload[-_]?item|sell[-_]?(button|cta|now)/.test(norm(attr(el, 'data-testid')))],
      ],
      bonus: (el) => (enTete(el) ? 1 : 0),
      seuil: 4,
    },
    titre: champ({ cle: /(^|[\s_-])title($|[\s_-])/, lib: /^(titre|title|titolo|titulo|titel)\b/, sauf: /sub|sous/ }),
    description: champ({ cle: /description/, lib: /^(description|decris ton article|descrizione|descripcion|beschreibung)\b/, zone: true }),
    prix: champ({ cle: /(^|[\s_-])price($|[\s_-])|^prix$/, lib: /^(prix|price|prezzo|precio|preis)\b/, nombre: true }),
    // Le champ des photos : un <input type="file"> (caché par la page derrière son bouton : `cache`).
    photos: {
      candidats: 'input[type="file"]',
      cache: true,
      garder: (el) => !el.disabled && !el.closest('header, footer, [role="search"]'),
      strategies: [
        ['testid', 4, (el) => /photo|image|picture|upload/.test(cles(el))],
        ['accepte', 3, (el) => /image/.test(norm(attr(el, 'accept')))],
        ['multiple', 1, (el) => el.hasAttribute('multiple')],
      ],
      bonus: () => 0,
      seuil: 3,
    },
    brouillon: bouton({ nom: RE_BROUILLON, testid: /draft/, sauf: /delete|supprim|cancel|annul/ }),
    publier: bouton({ nom: RE_PUBLIER, testid: /(save|submit|publish|upload)[-_]?(button|cta)|upload[-_]?form[-_]?save/, sauf: /draft|brouillon|delete|cancel|annul|photo/, soumettre: true }),
    enregistrer: bouton({ nom: RE_ENREGISTRER, testid: /(save|submit)[-_]?(button|cta|changes)|upload[-_]?form[-_]?save/, sauf: /draft|brouillon|delete|cancel|annul|photo/, soumettre: true }),
    // « Supprimer » de la page de l'annonce (l'étape vérifie avant que la page est celle de CETTE annonce).
    supprimer: bouton({ nom: RE_SUPPRIMER, testid: /(^|[-_])delete([-_]|$)|delete[-_]?(button|item|cta)|item[-_]?delete/, sauf: /cancel|annul|photo|image/, seuil: 4 }),
    // « Supprimer » / « Confirmer » de la fenêtre de confirmation : DANS la seule fenêtre ouverte, jamais « Annuler ».
    supprimerConfirmer: Object.assign(bouton({ nom: RE_CONFIRMER_SUPPRESSION, testid: /delete|confirm|supprim/, sauf: /cancel|annul|close|ferme|back|retour/, seuil: 4, dialogue: true }), { racine: () => leDialogue() }),
  };

  // ── Fabriques : un BOUTON (nom accessible EXACT en 5 langues, data-testid, mots interdits) et un CHAMP (clés, libellé,
  //    indication) — même règle partout : plusieurs stratégies, un seuil, un seul gagnant. ──────────────────────────
  function bouton(o) {
    return {
      candidats: 'button, [role="button"], input[type="submit"], a[href]',
      garder: (el) => actif(el) && (o.dialogue || !dansDialogue(el)) && !el.closest('header, footer, nav, [role="search"]') && !(o.sauf && o.sauf.test(norm(attr(el, 'data-testid') + ' ' + nomAcc(el) + ' ' + attr(el, 'value')))),
      strategies: [
        ['nom', 5, (el) => o.nom.test(norm(nomAcc(el) || attr(el, 'value')))],
        ['testid', 4, (el) => !!o.testid && o.testid.test(norm(attr(el, 'data-testid') + ' ' + attr(el, 'data-qa-id') + ' ' + attr(el, 'data-test')))],
        ['soumettre', 1, (el) => !!o.soumettre && attr(el, 'type') === 'submit'],
      ],
      bonus: () => 0,
      seuil: o.seuil || 5,
    };
  }
  function champ(o) {
    return {
      candidats: o.zone ? 'textarea, [contenteditable="true"], [role="textbox"]' : 'input, textarea',
      garder: (el) => saisissable(el) && !dansDialogue(el) && !horsDepot(el) && !/^(checkbox|radio|file|submit|button|image|hidden|range|color)$/i.test(attr(el, 'type')) && !(o.sauf && o.sauf.test(cles(el) + ' ' + libelle(el))),
      strategies: [
        ['cle', 4, (el) => o.cle.test(cles(el))],
        ['libelle', 4, (el) => o.lib.test(libelle(el))],
        ['indication', 2, (el) => o.lib.test(indication(el))],
        ['genre', 1, (el) => (o.zone ? el.tagName === 'TEXTAREA' || el.isContentEditable === true : o.nombre ? /^(decimal|numeric)$/.test(attr(el, 'inputmode')) || attr(el, 'type') === 'number' : el.tagName === 'INPUT')],
      ],
      bonus: () => 0,
      seuil: 4,
    };
  }

  // ── 5.448 : LES AUTRES SITES. Mêmes règles ; seuls les noms, les contextes et les exclusions changent. ───────────
  const CHAMP_MESSAGE_COMMUN = {
    candidats: 'textarea, [contenteditable="true"], [role="textbox"]',
    garder: (el) => !dansDialogue(el) && saisissable(el) && !/search|recherche/i.test(attr(el, 'type') + ' ' + attr(el, 'name') + ' ' + attr(el, 'data-testid') + ' ' + attr(el, 'data-qa-id') + ' ' + attr(el, 'aria-label')) && !el.closest('header, [role="banner"], [role="search"]'),
    strategies: [
      ['testid', 4, (el) => /(message|conversation|reply|composer|chat|messaging)/.test(cles(el))],
      ['indication', 3, (el) => RE_PLACEHOLDER_MSG.test(indication(el) + ' ' + norm(attr(el, 'aria-label')))],
      ['zone', 2, (el) => el.tagName === 'TEXTAREA' || el.isContentEditable === true],
      ['formulaire', 1, (el) => !!el.closest('form')],
    ],
    bonus: () => 0,
    seuil: 3,
  };
  const SITES = {
    vinted: ELEMENTS,
    lbc: {
      champMessage: CHAMP_MESSAGE_COMMUN,
      envoyer: ELEMENTS.envoyer,
      champPrix: champ({ cle: /(^|[\s_-])(price|prix)($|[\s_-])/, lib: /^(prix|price|prezzo|precio|preis)\b/, nombre: true }),
    },
    vc: {
      champMessage: CHAMP_MESSAGE_COMMUN,
      envoyer: ELEMENTS.envoyer,
    },
    ebay: {
      titre: champ({ cle: /(^|[\s_-])title($|[\s_-])|^titre$/, lib: /^(titre|title|titolo|titulo|titel)\b/, sauf: /sub|sous/ }),
      description: champ({ cle: /description/, lib: /^(description|descrizione|descripcion|beschreibung)\b/, zone: true }),
      prix: champ({ cle: /(^|[\s_-])(price|prix|startprice|binprice)($|[\s_-])|buy.?it.?now|start.?price/, lib: /^(prix|price|prezzo|precio|preis|sofort-kaufen)\b/, nombre: true }),
      sku: champ({ cle: /(^|[\s_-])sku($|[\s_-])|custom.?label/, lib: /^(sku|reference|etiquette personnalisee|custom label|etichetta personalizzata|etiqueta personalizada|bestandseinheit)\b/ }),
    },
  };
  // Le site d'une page (le nom d'hôte) : la table à prendre quand l'appelant ne l'a pas dit.
  function siteIci() {
    const h = String((typeof location !== 'undefined' && location.hostname) || '');
    if (/(^|\.)leboncoin\.fr$/.test(h)) return 'lbc';
    if (/(^|\.)vestiairecollective\.com$/.test(h)) return 'vc';
    if (/(^|\.)ebay\.[a-z.]+$/.test(h)) return 'ebay';
    return 'vinted';
  }
  function definition(nom, c) {
    let site = c.site || '', n = String(nom || '');
    if (n.includes('.')) { const [a, b] = n.split('.'); site = a; n = b; }
    if (!site) site = SITES.vinted[n] ? 'vinted' : siteIci();
    const t = SITES[site];
    return t && Object.prototype.hasOwnProperty.call(t, n) ? t[n] : null;
  }

  // La version de la page (le numéro de build que Vinted sert) : la mémoire est rangée par version.
  function versionPage() {
    try {
      const nd = document.getElementById('__NEXT_DATA__'); if (nd) { const j = JSON.parse(nd.textContent || '{}'); if (j && j.buildId) return String(j.buildId).slice(0, 40); }
      for (const s of document.querySelectorAll('script[src]')) { const m = /\/_next\/static\/([\w-]{6,40})\//.exec(s.src || ''); if (m && !/^(chunks|css|media)$/.test(m[1])) return m[1]; }
    } catch (_) {}
    return '';
  }

  // UN passage : les candidats, leurs points, le gagnant s'il est seul.
  function trouver(nom, ctx) {
    const c = ctx || {};
    const def = definition(nom, c);
    if (!def) return { el: null, nom, inconnu: true, essais: [] };
    let racine = document;
    if (def.racine) { racine = def.racine(); if (!racine) return { el: null, nom, essais: [{ s: 'racine', n: 0 }] }; }
    const vu = def.cache ? (el) => !!(el && el.isConnected && !deVrm(el)) : visible;
    const tous = [...racine.querySelectorAll(def.candidats)].slice(0, 4000).filter((el) => vu(el) && (!def.garder || def.garder(el, c)));
    const essais = def.strategies.map(([s]) => ({ s, n: 0 }));
    const notes = [];
    for (const el of tous) {
      let score = 0; const vues = [];
      def.strategies.forEach(([s, poids, test], i) => { let ok = false; try { ok = !!test(el, c); } catch (_) { ok = false; } if (ok) { score += poids; vues.push(s); essais[i].n++; } });
      if (!vues.length) continue;
      score += def.bonus ? def.bonus(el, c) : 0;
      if (c.prefere && vues.includes(c.prefere)) score += 0.5;   // la stratégie qui a marché la dernière fois : à égalité, elle passe devant
      notes.push({ el, score, vues });
    }
    // Un candidat qui CONTIENT un autre candidat retenu : l'élément cliquable le plus extérieur seul (une icône dans son bouton).
    const ok = notes.filter((x) => x.score >= def.seuil);
    const ext = ok.filter((x) => !ok.some((y) => y !== x && y.el.contains(x.el)));
    if (!ext.length) return { el: null, nom, essais, vus: notes.length };
    const max = Math.max(...ext.map((x) => x.score));
    const meilleurs = ext.filter((x) => x.score === max);
    if (meilleurs.length !== 1) return { el: null, nom, ambigu: true, essais, n: meilleurs.length };
    const g = meilleurs[0];
    return { el: g.el, nom, strategie: g.vues[0], vues: g.vues, score: g.score, essais };
  }

  // Patienter pendant que la page se construit : relu à chaque mutation (au plus toutes les 120 ms) et toutes les 400 ms.
  function attendre(nom, ctx, ms, estCaptcha) {
    return new Promise((ok) => {
      const fin = Date.now() + Math.max(0, Number(ms) || 0);
      let dernier = null, mo = null, iv = null, prevu = false, fini = false;
      const finir = (r) => { if (fini) return; fini = true; try { mo && mo.disconnect(); } catch (_) {} clearInterval(iv); ok(r); };
      const essayer = () => {
        prevu = false;
        if (fini) return;
        if (typeof estCaptcha === 'function' && estCaptcha()) return finir({ el: null, nom, captcha: true, essais: [] });
        const r = trouver(nom, ctx); dernier = r;
        if (r.el) return finir(r);
        if (Date.now() >= fin) return finir(Object.assign({}, r, { delai: true }));
      };
      try { mo = new MutationObserver(() => { if (!prevu) { prevu = true; setTimeout(essayer, 120); } }); mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-label', 'data-testid', 'class', 'hidden', 'style', 'aria-expanded'] }); } catch (_) { mo = null; }
      iv = setInterval(essayer, 400);
      essayer();
      void dernier;
    });
  }

  // ══ 5.448 — UN GESTE APPRIS QUE LA PAGE A UN PEU CHANGÉ (`souple`) ═══════════════════════════════════════════
  //  `sig` = { tag, attrs: { data-testid, name, role, type, aria-label… }, mot?, ce? } (la signature de SON propre geste,
  //  lbc-ecrire.js / vc-ecrire.js / vrm-appris.js). La recherche exacte (tous les attributs, le mot) n'a rien vu ou en a
  //  vu plusieurs : ici chaque morceau ENCORE vrai donne des points — la balise 2, un attribut stable 2 (aria-label 3),
  //  le mot du bouton 4, le nom accessible égal au mot 4 —, un candidat doit garder AU MOINS la moitié des points
  //  possibles et son MOT (ou son nom accessible) quand il en avait un ; le meilleur gagne s'il est SEUL. `dans` borne la
  //  recherche (la rangée de l'annonce). Rien n'est cliqué ici.
  const ATTRS_SIG = ['data-testid', 'data-test', 'data-qa-id', 'data-cy', 'name', 'role', 'type', 'aria-label'];
  function souple(sig, ctx) {
    const c = ctx || {};
    const essais = [{ s: 'balise', n: 0 }, { s: 'attribut', n: 0 }, { s: 'mot', n: 0 }];
    if (!sig || typeof sig !== 'object' || !/^[a-z][a-z0-9-]{0,20}$/.test(String(sig.tag || ''))) return { el: null, nom: 'appris', essais };
    const attrs = Object.entries(sig.attrs || {}).filter(([k, v]) => ATTRS_SIG.includes(k) && typeof v === 'string' && v);
    const mot = sig.mot ? norm(sig.mot) : '';
    const max = 2 + attrs.reduce((t, [k]) => t + (k === 'aria-label' ? 3 : 2), 0) + (mot ? 4 : 0);
    const famille = /^(button|a|div|span|li|label|input|summary)$/.test(sig.tag) && !sig.ce && sig.tag !== 'input' ? 'button, [role="button"], [role="menuitem"], [role="option"], a[href], label, summary, ' + sig.tag : sig.tag === 'textarea' || sig.ce ? 'textarea, [contenteditable="true"], [role="textbox"]' : sig.tag;
    const racine = c.dans && c.dans.querySelectorAll ? c.dans : document;
    let tous = [];
    try { tous = [...racine.querySelectorAll(famille)].slice(0, 4000).filter((el) => visible(el) && (sig.ce ? el.isContentEditable === true : true) && (!c.garder || c.garder(el))); } catch (_) { tous = []; }
    const notes = [];
    for (const el of tous) {
      let score = 0, motOk = false;
      if (el.tagName.toLowerCase() === sig.tag) { score += 2; essais[0].n++; }
      for (const [k, v] of attrs) if (attr(el, k) === v) { score += k === 'aria-label' ? 3 : 2; essais[1].n++; }
      if (mot) {
        const t = norm(String(el.textContent || '').slice(0, 60)), n = norm(nomAcc(el));
        if (t === mot) { score += 4; motOk = true; essais[2].n++; }
        else if (n === mot) { score += 4; motOk = true; essais[2].n++; }
      }
      if (mot && !motOk) continue;                 // un bouton appris par son mot ne se reconnaît jamais sans lui
      if (score * 2 < max || score < 4) continue;   // au moins la moitié de ce qu'il était, et plus que la seule balise
      notes.push({ el, score });
    }
    // Un conteneur qui porte le même mot qu'un candidat plus intérieur au moins aussi bien noté : l'intérieur seul (c'est lui qui écoute le clic).
    const ext = notes.filter((x) => !notes.some((y) => y !== x && x.el.contains(y.el) && y.score >= x.score));
    if (!ext.length) return { el: null, nom: 'appris', essais, vus: notes.length };
    const best = Math.max(...ext.map((x) => x.score));
    const g = ext.filter((x) => x.score === best);
    if (g.length !== 1) return { el: null, nom: 'appris', ambigu: true, essais, n: g.length };
    return { el: g[0].el, nom: 'appris', strategie: 'souple', score: best, max, essais };
  }

  globalThis.__vrmTrouver = { trouver, attendre, souple, versionPage, siteIci, elements: Object.keys(ELEMENTS), sites: Object.fromEntries(Object.entries(SITES).map(([k, v]) => [k, Object.keys(v)])), RE_CLOCHE, RE_VOIR_TOUT: LANGUES.voirTout };
  globalThis.__vrmTrouverV = 2;
})();
