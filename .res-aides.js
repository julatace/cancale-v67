  // ── 5.414 : les aides des gestes par l'interface (messagerie, offre, annonce) ─────────────────────────────
  // Un nom accessible (la règle de la cloche des favoris, 5.356) : aria-labelledby, aria-label, texte, title.
  const nomAcc = (b) => {
    try {
      const ids = (b.getAttribute('aria-labelledby') || '').trim().split(/\s+/).filter(Boolean);
      if (ids.length) { const refs = ids.map((i) => document.getElementById(i)); if (refs.some((x) => !x)) return ''; return refs.map((x) => x.textContent || '').join(' '); }
      if (b.hasAttribute('aria-label')) return b.getAttribute('aria-label') || '';
      const t = String(b.innerText || b.textContent || '').trim(); if (t) return t;
      return b.getAttribute('title') || '';
    } catch (_) { return ''; }
  };
  const actif = (b) => !(b.disabled || b.getAttribute('aria-disabled') === 'true');
  // LE bouton d'un geste : nom accessible EXACT (5 langues) ou data-testid reconnu ; jamais un mot interdit ;
  // un seul candidat visible (deux ⇒ `ambigu` : VRM ne choisit pas à ta place).
  function parNom(re, racine, reTestid, reInterdit, dansDialogue) {
    const r = racine || document;
    const tous = [...r.querySelectorAll('button, [role="button"], a[href]')].filter((b) => visible(b) && actif(b) && (dansDialogue || !b.closest('[role="dialog"],[aria-modal="true"]')));
    const c = tous.filter((b) => {
      const tid = b.getAttribute('data-testid') || '';
      if (reInterdit && reInterdit.test(tid)) return false;
      const n = norm(nomAcc(b));
      return (re && re.test(n)) || (reTestid && reTestid.test(tid));
    });
    const plusFin = c.filter((el) => !c.some((x) => x !== el && el.contains(x)));
    return plusFin.length === 1 ? { el: plusFin[0] } : { el: null, ambigu: plusFin.length > 1 };
  }
  const RE_FAIRE_OFFRE = /^(faire une offre|proposer un prix|proposer une offre|make an offer|offer a price|fai un'offerta|fare un'offerta|proponi un prezzo|hacer una oferta|haz una oferta|proponer un precio|preis vorschlagen|angebot machen|ein angebot machen)$/;
  const RE_VALIDER_OFFRE = /^(proposer|envoyer|envoyer l'offre|faire l'offre|faire une offre|proposer l'offre|offer|send|send offer|make offer|make an offer|submit|invia|invia offerta|proponi|enviar|enviar oferta|ofrecer|senden|angebot senden|anbieten)$/;
  const RE_ACCEPTER = /^(accepter|accepter l'offre|accept|accept offer|accetta|accetta l'offerta|aceptar|aceptar oferta|annehmen|akzeptieren|angebot annehmen)$/;
  const RE_REFUSER = /^(refuser|refuser l'offre|decliner|decline|decline offer|reject|rifiuta|rifiuta l'offerta|rechazar|rechazar oferta|ablehnen|angebot ablehnen)$/;
  const RE_MASQUER = /^(masquer|masquer l'article|masquer l'annonce|hide|hide item|nascondi|nascondi l'articolo|ocultar|ocultar articulo|ausblenden|artikel ausblenden)$/;
  const RE_AFFICHER = /^(afficher|afficher l'article|afficher l'annonce|rendre visible|show|show item|unhide|mostra|mostra l'articolo|mostrar|mostrar articulo|einblenden|anzeigen|artikel einblenden)$/;
  const RE_ENVOYER = /^(envoyer|envoyer le message|send|send message|invia|enviar|senden)$/;
  // La fenêtre (dialogue) de Vinted ouverte : une seule visible, sinon rien.
  const dialogue = () => { const l = [...document.querySelectorAll('[role="dialog"], [aria-modal="true"], [data-testid*="modal" i]')].filter((x) => visible(x) && !deVrm(x)); const fin = l.filter((el) => !l.some((x) => x !== el && el.contains(x))); return fin.length === 1 ? fin[0] : null; };
  // Le champ du message (hors fenêtre) : un seul candidat.
  function composeur() {
    const ok = (x) => visible(x) && !x.closest('[role="dialog"],[aria-modal="true"]') && !x.readOnly && !x.disabled;
    for (const s of ['textarea[data-testid*="message" i]', 'textarea[data-testid*="conversation" i]', 'textarea[name="message"]', 'textarea[name="body"]', '[contenteditable="true"][role="textbox"]']) {
      const l = [...document.querySelectorAll(s)].filter(ok);
      if (l.length === 1) return { el: l[0] }; if (l.length > 1) return { el: null, ambigu: true };
    }
    const t = [...document.querySelectorAll('textarea')].filter(ok);
    return t.length === 1 ? { el: t[0] } : { el: null, ambigu: t.length > 1 };
  }
  // « Envoyer » de CE champ : le bouton d'envoi de son formulaire, sinon un seul bouton « Envoyer » de la page.
  function boutonEnvoyer(champ) {
    const f = champ && champ.closest && champ.closest('form');
    if (f) {
      const s = [...f.querySelectorAll('button[type="submit"], button:not([type])')].filter((b) => visible(b) && actif(b) && (RE_ENVOYER.test(norm(nomAcc(b))) || /send|submit/i.test(b.getAttribute('data-testid') || '') || b.type === 'submit'));
      const parNomS = s.filter((b) => RE_ENVOYER.test(norm(nomAcc(b))) || /send/i.test(b.getAttribute('data-testid') || ''));
      const l = parNomS.length ? parNomS : s;
      if (l.length === 1) return { el: l[0] }; if (l.length > 1) return { el: null, ambigu: true };
    }
    return parNom(RE_ENVOYER, document, /(^|[-_])send([-_]|$)|send[-_]?button/i, /cancel|close/i);
  }
  // Le champ du prix d'une fenêtre d'offre : un seul candidat.
  function champPrix(dl) {
    const ok = (x) => visible(x) && !x.disabled && !x.readOnly;
    for (const s of ['input[name="price"]', 'input[name="offer"]', 'input[name*="price" i]', 'input[data-testid*="price" i]', 'input[data-testid*="offer" i]', 'input[inputmode="decimal"]', 'input[type="number"]']) {
      const l = [...dl.querySelectorAll(s)].filter(ok);
      if (l.length === 1) return { el: l[0] }; if (l.length > 1) return { el: null, ambigu: true };
    }
    const t = [...dl.querySelectorAll('input:not([type]), input[type="text"], input[type="tel"]')].filter(ok);
    return t.length === 1 ? { el: t[0] } : { el: null, ambigu: t.length > 1 };
  }
  const texteMontant = (prix) => (Math.round(prix * 100) % 100 === 0 ? String(Math.round(prix)) : (Math.round(prix * 100) / 100).toFixed(2)).replace('.', ',');
  // Le texte de la page (hors champs de saisie, hors VRM) : la preuve qu'un message ou une offre est AFFICHÉ.
  const textePage = () => { try { return norm(String((document.body && document.body.innerText) || '')); } catch (_) { return ''; } };
  function occurrences(texte) {
    const t = norm(texte).slice(0, 80); if (!t) return 0;
    const p = textePage(); let n = 0, i = 0; for (;;) { i = p.indexOf(t, i); if (i < 0) break; n++; i += t.length; } return n;
  }
  function occurrencesPrix(prix) {
    const e = Math.floor(prix), c = Math.round(prix * 100) % 100, cc = String(c).padStart(2, '0');
    const re = c === 0 ? new RegExp(`(^|[^0-9,.])${e}(?:[,.]00)?\\s?€|€\\s?${e}(?:[.,]00)?(?![0-9])`, 'g') : new RegExp(`(^|[^0-9,.])${e}[,.]${cc}\\s?€|€\\s?${e}[.,]${cc}(?![0-9])`, 'g');
    return (textePage().replace(/ | /g, ' ').match(re) || []).length;
  }
  // La cloche : le bouton « Notifications » (nom accessible reconnu), un seul.
  function clocheVisible() {
    const re = /^(?:(?:mes|my|le mie|meine) |(?:(?:ouvrir|afficher|voir|open|show|view) (?:les |the )?))?(?:notifications?|notifiche|notificaciones|benachrichtigungen)(?:\s*[:·,–-]?\s*\(?[0-9]{1,5}\+?\)?(?: (?:non lues?|unread|non lette|sin leer|ungelesen))?)?$/;
    const l = [...document.querySelectorAll('button, [role="button"]')].filter((b) => visible(b) && actif(b) && re.test(norm(nomAcc(b))));
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  // La ligne d'UN favori dans la cloche : son lien capté exact, ou la route native `?item_id=&receiver_id=` dont
  // les DEUX identités sont celles du favori (jamais un titre, jamais un pseudo). Un seul lien visible.
  function lienFavoriVisible(lien, itemId, receiverId) {
    const norme = (v) => { try { const u = new URL(v, location.href); if (u.origin !== location.origin) return null; u.hash = ''; u.searchParams.sort(); return u.href; } catch (_) { return null; } };
    const attendu = norme(lien);
    const natif = (v) => { try { const u = new URL(v, location.href); const ks = [...u.searchParams.keys()].sort().join(','); if (ks !== 'item_id,receiver_id' || u.searchParams.getAll('item_id').length !== 1 || u.searchParams.getAll('receiver_id').length !== 1) return false; return u.origin === location.origin && u.searchParams.get('item_id') === itemId && u.searchParams.get('receiver_id') === receiverId; } catch (_) { return false; } };
    const l = [...document.querySelectorAll('a[href]')].filter((a) => visible(a) && ((attendu && norme(a.href) === attendu) || natif(a.href)));
    return l.length === 1 ? { el: l[0] } : { el: null, ambigu: l.length > 1 };
  }
  async function attendreChemin(re, ms) {
    let r = null; try { r = re instanceof RegExp ? re : new RegExp(String(re || '^/')); } catch (_) { return { ok: false }; }
    const fin = Date.now() + ms;
    for (;;) { if (captcha()) return { captcha: true }; if (r.test(location.pathname)) return { ok: true }; if (Date.now() > fin) return { ok: false }; await nap(150); }
  }
