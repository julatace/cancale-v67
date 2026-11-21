    // ══ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») ══════════════════════════
    // Les gestes de la messagerie, de l'annonce et du formulaire de prix, PAR L'INTERFACE : VRM clique et tape, la
    // PAGE de Vinted envoie SA requête, VRM lit sa réponse puis VÉRIFIE à l'écran (message apparu, offre affichée).
    // Avant chaque geste : la page montrée est la BONNE (identifiants dans l'adresse, jamais un titre) ; un élément
    // introuvable ou ambigu (deux candidats) ⇒ arrêt AVANT le geste, son nom dit (`selecteur`).
    async ouvrir(d) {
      const a = await attendreChemin(d && d.chemin, 20000); if (a.captcha) return vuCaptcha(); if (!a.ok) return { ok: false, code: 'identite', chemin: location.pathname };
      return { ok: true, chemin: location.pathname };
    },
    async favoriOuvrir(d) {
      if (captcha()) return vuCaptcha();
      ecouter();
      const itemId = String((d && d.itemId) || ''), receiverId = String((d && d.receiverId) || ''), lien = String((d && d.lien) || '');
      if (!/^[1-9]\d{0,19}$/.test(itemId) || !/^[1-9]\d{0,19}$/.test(receiverId) || !lien) return { ok: false, code: 'etape' };
      // 1. La cloche : ouverte par SON bouton (un seul candidat, nom accessible reconnu), sauf si la ligne est déjà là.
      let l = lienFavoriVisible(lien, itemId, receiverId);
      if (l.ambigu) return manque('favori-notification-ambigue');
      if (!l.el) {
        const c = clocheVisible(); if (c.ambigu) return manque('cloche-ambigue'); if (!c.el) return manque('cloche');
        if (c.el.getAttribute('aria-expanded') !== 'true') clic(c.el);
        const t = await attendre(() => { const x = lienFavoriVisible(lien, itemId, receiverId); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 15000);
        if (t.captcha) return vuCaptcha(); if (t.absent) return manque('favori-notification'); if (t.el === 'AMBIGU') return manque('favori-notification-ambigue');
        l = { el: t.el };
      }
      // 2. La ligne du favori (le lien porte l'article ET la personne) : un clic ; la page ouvre la conversation.
      let rep = null, repVue = false;
      reponseDe('POST', /\/api\/v2\/conversations\/?$/, 25000, d && d.cle).then((x) => { rep = x; repVue = true; });
      clic(l.el);
      const fin = Date.now() + 25000; let conv = '';
      for (;;) {
        if (captcha()) return Object.assign(vuCaptcha(), { parti: true });
        const m = /^\/inbox\/([1-9]\d{0,19})\/?$/.exec(location.pathname); if (m) conv = m[1];
        if (!conv && rep && rep.json && rep.json.conversation && /^[1-9]\d{0,19}$/.test(String(rep.json.conversation.id))) conv = String(rep.json.conversation.id);
        // La conversation montrée ; la réponse de création attendue encore 3 s (une conversation déjà là n'en a pas).
        if (conv && (repVue || Date.now() > fin - 22000)) break;
        if (Date.now() > fin) break;
        await nap(200);
      }
      if (rep && rep.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!conv) return rep ? { ok: true, rep, conv: '', envoye: true } : { ok: false, code: 'sans-conversation', chemin: location.pathname, parti: true };
      return { ok: true, rep, conv, envoye: !!rep, chemin: location.pathname };
    },
    async message(d) {
      const conv = String((d && d.conv) || ''), texte = String((d && d.texte) || '');
      if (!/^[1-9]\d{0,19}$/.test(conv) || !texte.trim()) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const z = await attendre(() => { const x = composeur(); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (z.captcha) return vuCaptcha(); if (z.absent) return manque('message-champ'); if (z.el === 'AMBIGU') return manque('message-champ-ambigu');
      const champ = z.el;
      { const env = boutonEnvoyer(champ); if (env.ambigu) return manque('message-envoyer-ambigu'); if (!env.el) return manque('message-envoyer'); }
      const avant = occurrences(texte);
      const okT = await saisir(champ, texte, { garderFocus: true });
      if (!okT) return { ok: false, code: 'valeur', manque: 'message-champ' };
      if (captcha()) return vuCaptcha();
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b2 = boutonEnvoyer(champ); if (!b2.el || b2.ambigu) return manque('message-envoyer');
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/conversations/${conv}/replies$`), 30000, d && d.cle);
      clic(b2.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      // La preuve à l'écran : le message est apparu dans le fil (une occurrence de plus qu'avant l'envoi).
      const v = await attendre(() => (occurrences(texte) > avant ? true : null), 12000);
      return { ok: true, rep: r, vu: v.el === true };
    },
    async offre(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), prix = Number(d && d.prix);
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx) || !(prix > 0)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendre(() => { const x = parNom(RE_FAIRE_OFFRE, document, /make[-_]?offer|offer[-_]?(button|cta)/i, /accept|decline|reject|cancel/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque('offre-bouton'); if (b.el === 'AMBIGU') return manque('offre-bouton-ambigu');
      const avant = occurrencesPrix(prix);
      clic(b.el);
      const dl = await attendre(() => dialogue(), 15000); if (dl.captcha) return vuCaptcha(); if (dl.absent) return manque('offre-fenetre');
      const inp = await attendre(() => { const x = champPrix(dl.el); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 10000);
      if (inp.captcha) return vuCaptcha(); if (inp.absent) return manque('offre-prix'); if (inp.el === 'AMBIGU') return manque('offre-prix-ambigu');
      const okT = await saisir(inp.el, texteMontant(prix), { garderFocus: true });
      if (!okT) return { ok: false, code: 'valeur', manque: 'offre-prix' };
      const s = parNom(RE_VALIDER_OFFRE, dl.el, /submit|confirm|send|offer/i, /cancel|close|annul/i, true);
      if (s.ambigu) return manque('offre-valider-ambigu'); if (!s.el) return manque('offre-valider');
      if (captcha()) return vuCaptcha();
      ecouter();
      const att = reponseDe('POST', new RegExp(`/api/v2/transactions/${tx}/offers$`), 30000, d && d.cle);
      clic(s.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      const v = await attendre(() => (occurrencesPrix(prix) > avant ? true : null), 12000);
      return { ok: true, rep: r, vu: v.el === true };
    },
    async repondreOffre(d) {
      const conv = String((d && d.conv) || ''), tx = String((d && d.tx) || ''), oid = String((d && d.oid) || ''), accepter = !!(d && d.accepter);
      if (!/^[1-9]\d{0,19}$/.test(conv) || !/^[1-9]\d{0,19}$/.test(tx) || !/^[1-9]\d{0,19}$/.test(oid)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/inbox/${conv}/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const re = accepter ? RE_ACCEPTER : RE_REFUSER, nom = accepter ? 'offre-accepter' : 'offre-refuser';
      const b = await attendre(() => { const x = parNom(re, document, accepter ? /accept/i : /decline|reject/i, accepter ? /decline|reject|cancel/i : /accept|cancel/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque(nom); if (b.el === 'AMBIGU') return manque(nom + '-ambigu');
      ecouter();
      const att = reponseDe('PUT', new RegExp(`/api/v2/transactions/${tx}/offer_requests/\\d+/${accepter ? 'accept' : 'reject'}$`), 30000, d && d.cle);
      clic(b.el);
      // Une confirmation de Vinted, s'il en montre une : le même verbe (jamais « Annuler »).
      const c = await attendre(() => { const dl = dialogue(); if (!dl) return null; const x = parNom(re, dl, accepter ? /accept|confirm/i : /decline|reject|confirm/i, /cancel|close|annul/i, true); return x.el || null; }, 3000);
      if (c.el) clic(c.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      const autre = !new RegExp(`/offer_requests/${oid}/`).test(String(r.chemin || ''));
      if (!r.ok) return { ok: true, rep: r, vu: false, autre };
      const v = await attendre(() => (parNom(re, document, null, null).el ? null : true), 10000);
      return { ok: true, rep: r, vu: v.el === true, autre };
    },
    async masquer(d) {
      const id = String((d && d.id) || ''), voulu = !!(d && d.voulu);
      if (!/^\d{4,15}$/.test(id)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/items/${id}(?:-[^/]*)?/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const re = voulu ? RE_MASQUER : RE_AFFICHER, nom = voulu ? 'masquer' : 'afficher';
      const b = await attendre(() => { const x = parNom(re, document, voulu ? /(^|[-_])hide([-_]|$)/i : /(^|[-_])(show|unhide)([-_]|$)/i, voulu ? /unhide|show/i : /(^|[-_])hide([-_]|$)/i); return x.el || (x.ambigu ? 'AMBIGU' : null); }, 20000);
      if (b.captcha) return vuCaptcha(); if (b.absent) return manque(nom); if (b.el === 'AMBIGU') return manque(nom + '-ambigu');
      ecouter();
      const att = reponseDe('PUT', new RegExp(`/api/v2/items/${id}/is_hidden$`), 30000, d && d.cle);
      clic(b.el);
      const c = await attendre(() => { const dl = dialogue(); if (!dl) return null; const x = parNom(re, dl, /hide|show|confirm/i, /cancel|close|annul/i, true); return x.el || null; }, 3000);
      if (c.el) clic(c.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      if (!r.ok) return { ok: true, rep: r, vu: false };
      const v = await attendre(() => (parNom(voulu ? RE_AFFICHER : RE_MASQUER, document, null, null).el ? true : null), 10000);
      return { ok: true, rep: r, vu: v.el === true };
    },
    async prix(d) {
      const id = String((d && d.id) || ''), prix = Number(d && d.prix);
      if (!/^\d{4,15}$/.test(id) || !(prix > 0)) return { ok: false, code: 'etape' };
      if (!new RegExp(`^/items/${id}/edit/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const a = await attendre(SEL.prix, 30000); if (a.captcha) return vuCaptcha(); if (a.absent) return manque('prix');
      const b0 = await attendre(SEL.ajouter, 15000); if (b0.captcha) return vuCaptcha(); if (b0.absent) return manque('enregistrer');
      if (d && typeof d.titre === 'string' && d.titre.trim()) {
        const t = await attendre(SEL.titre); if (t.captcha) return vuCaptcha(); if (t.absent) return manque('titre');
        if (!(await saisir(t.el, d.titre))) return { ok: false, code: 'valeur', manque: 'titre' };
      }
      if (!(await saisir(a.el, texteMontant(prix)))) return { ok: false, code: 'valeur', manque: 'prix' };
      if (captcha()) return vuCaptcha();
      const b = await attendre(SEL.ajouter, 15000); if (b.captcha) return vuCaptcha(); if (b.absent) return manque('enregistrer');
      ecouter();
      const att = reponseDe('PUT', new RegExp(`/api/v2/item_upload/items/${id}$`), 60000, d && d.cle);
      clic(b.el);
      const r = await att;
      if (!r) return { ok: false, code: 'sans-reponse', parti: true };
      if (r.captcha) return Object.assign(vuCaptcha(), { parti: true });
      return { ok: true, rep: r };
    },
