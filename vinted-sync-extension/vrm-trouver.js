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
// ════════════════════════════════════════════════════════════════════════════
(() => {
  if (globalThis.__vrmTrouver && globalThis.__vrmTrouverV === 1) return;
  const norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
  const deVrm = (el) => { try { return !!(el && el.closest && el.closest('#vrm-travail, [data-vrm-hote], #vrm-action-gel, [data-vrm]')); } catch (_) { return false; } };
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
  const compteur = (el) => { try { return [...el.querySelectorAll('span, div, sup')].some((x) => /^\d{1,3}\+?$/.test(String(x.textContent || '').trim()) && x.children.length === 0); } catch (_) { return false; } };

  const LANGUES = {
    notif: '(?:notifications?|notifiche|notificaciones|benachrichtigungen|meldingen|powiadomienia)',
    voirTout: /^(?:voir tout|tout voir|voir toutes(?: les notifications)?|see all|view all|show all|ver todo|ver todas|vedi tutto|vedi tutte|mostra tutto|alle anzeigen|alle ansehen)(?: [›>→])?$/,
  };
  const RE_CLOCHE = new RegExp(`^(?:(?:mes|my|le mie|meine|mis) |(?:(?:ouvrir|afficher|voir|fermer|masquer|open|show|view|close|hide|apri|chiudi|abrir|cerrar|offnen|schliessen) (?:les |the |le |las |die )?))?${LANGUES.notif}(?:\\s*[:·,–-]?\\s*\\(?[0-9]{1,5}\\+?\\)?(?: (?:non lues?|unread|non lette|sin leer|ungelesen|nouvelles?|new|nuove|nuevas|neu))?)?$`);
  const RE_ENVOYER = /^(envoyer|envoyer le message|send|send message|invia|invia messaggio|enviar|enviar mensaje|senden|nachricht senden)$/;
  const RE_FAIRE_OFFRE = /^(faire une offre|proposer un prix|proposer une offre|make an offer|offer a price|fai un'offerta|fare un'offerta|proponi un prezzo|hacer una oferta|haz una oferta|proponer un precio|preis vorschlagen|angebot machen|ein angebot machen)$/;
  const RE_VALIDER_OFFRE = /^(proposer|envoyer|envoyer l'offre|faire l'offre|faire une offre|proposer l'offre|offer|send|send offer|make offer|make an offer|submit|invia|invia offerta|proponi|enviar|enviar oferta|ofrecer|senden|angebot senden|anbieten)$/;
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
  };

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
    const def = ELEMENTS[nom];
    const c = ctx || {};
    if (!def) return { el: null, nom, inconnu: true, essais: [] };
    let racine = document;
    if (def.racine) { racine = def.racine(); if (!racine) return { el: null, nom, essais: [{ s: 'racine', n: 0 }] }; }
    const tous = [...racine.querySelectorAll(def.candidats)].slice(0, 4000).filter((el) => visible(el) && (!def.garder || def.garder(el, c)));
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

  globalThis.__vrmTrouver = { trouver, attendre, versionPage, elements: Object.keys(ELEMENTS), RE_CLOCHE, RE_VOIR_TOUT: LANGUES.voirTout };
  globalThis.__vrmTrouverV = 1;
})();
