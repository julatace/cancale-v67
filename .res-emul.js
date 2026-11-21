        // 5.414 (`toutinterface`) : sans page servie par l'audit, une FAUSSE PAGE vinted.fr minimale répond aux étapes
        //    (`__vrmFormulaire`) : c'est ELLE qui envoie ses requêtes à faux Vinted (origine « page », la forme que la vraie
        //    page envoie), comme le fait Vinted quand VRM clique. Le service worker n'en fabrique aucune. Les audits
        //    d'avant gardent ainsi leurs juges (ordre, corps, refus, plafonds) sur ce que la page envoie.
        //    `ctx.__vrmPage` (réglable par l'audit) : { vu:false } (le message/l'offre n'apparaît pas), { manque:'nom' }
        //    (un élément introuvable), { captcha:true }, { favoriConv: id } (conversation déjà là, aucune création).
        if (Array.isArray(files) && files.includes('vrm-formulaire.js') && (!ctx.__vrmFormulaire || ctx.__vrmFormulaire.__emule)) {
          const st = ctx.__vrmPageEtat = ctx.__vrmPageEtat || { champs: {} };
          const tab = t;
          const emule = async (etape, d0) => {
            const d = d0 || {}, opt = ctx.__vrmPage || {};
            const chemin = (() => { try { return new URL(tab.url).pathname; } catch (_) { return '/'; } })();
            (j.etapesPage = j.etapesPage || []).push({ etape, quoi: d.quoi, chemin });
            if (opt.captcha) return { ok: false, code: 'captcha', chemin };
            if (opt.manque && (opt.manqueEtape ? opt.manqueEtape === etape : true)) return { ok: false, code: 'selecteur', manque: opt.manque, chemin };
            const envoi = async (m, p, corps) => {
              const r = await ctx.fetch(p, { method: m, headers: { 'content-type': 'application/json' }, body: corps == null ? undefined : JSON.stringify(corps) });
              let json = null; try { json = await r.json(); } catch (_) { json = null; }
              return { status: r.status, ok: r.status >= 200 && r.status < 300, json, corps: corps == null ? null : JSON.stringify(corps), chemin: p };
            };
            const id = (v) => /^[1-9]\d{0,19}$/.test(String(v || ''));
            switch (etape) {
              case 'etat': return { ok: true, chemin };
              case 'ouvrirVente': case 'formulairePret': st.champs = {}; return { ok: true, chemin };
              case 'ouvrir': return new RegExp(String(d.chemin || '^/')).test(chemin) ? { ok: true, chemin } : { ok: false, code: 'identite', chemin };
              case 'photos': { const n = (d.photos || []).length; if (!n) return { ok: false, code: 'photos-absentes' }; for (let i = 0; i < n; i++) { const r = await envoi('POST', '/api/v2/photos', { nom: d.photos[i].nom }); if (!r.ok) return { ok: false, code: 'refus', status: r.status, json: r.json }; } return { ok: true, n }; }
              case 'champ': st.champs[d.quoi] = d; return { ok: true };
              case 'brouillon': { const s = st.champs; const draft = { id: null, title: s.titre && s.titre.valeur, description: s.description && s.description.valeur, price: s.prix && String(s.prix.valeur), catalog_id: s.categorie && s.categorie.id, brand_id: s.marque && s.marque.id, color_ids: s.couleurs && s.couleurs.ids, package_size_id: s.colis && s.colis.id, item_attributes: [{ code: 'size', ids: s.taille ? [s.taille.id] : [] }, { code: 'condition', ids: s.etat ? [s.etat.id] : [] }] }; return { ok: true, rep: await envoi('POST', '/api/v2/item_upload/drafts', { draft }) }; }
              case 'supprimer': if (!new RegExp(`^/items/${d.id}(?:-[^/]*)?/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('POST', `/api/v2/items/${d.id}/delete`, null) };
              case 'publier': return { ok: true, rep: await envoi('POST', `/api/v2/item_upload/drafts/${d.draftId}/completion`, { draft: { id: Number(d.draftId) } }) };
              case 'favoriOuvrir': {
                if (!id(d.itemId) || !id(d.receiverId)) return { ok: false, code: 'etape' };
                if (opt.favoriConv) { tab.url = `https://www.vinted.fr/inbox/${opt.favoriConv}`; return { ok: true, rep: null, conv: String(opt.favoriConv), envoye: false }; }
                const rep = await envoi('POST', '/api/v2/conversations', { initiator: 'seller_enters_notification', item_id: String(d.itemId), opposite_user_id: String(d.receiverId) });
                const conv = rep && rep.json && rep.json.conversation && id(rep.json.conversation.id) ? String(rep.json.conversation.id) : '';
                if (conv) tab.url = `https://www.vinted.fr/inbox/${conv}`;
                return { ok: true, rep, conv, envoye: true };
              }
              case 'message': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; { const rep = await envoi('POST', `/api/v2/conversations/${d.conv}/replies`, { reply: { body: String(d.texte), photo_temp_uuids: null, is_personal_data_sharing_check_skipped: false } }); return { ok: true, rep, vu: rep.ok && opt.vu !== false }; }
              case 'offre': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; { const p = Number(d.prix); const rep = await envoi('POST', `/api/v2/transactions/${d.tx}/offers`, { offer: { currency: 'EUR', price: Math.round(p * 100) % 100 ? p.toFixed(2) : String(Math.round(p)) } }); return { ok: true, rep, vu: rep.ok && opt.vu !== false && opt.offreVue !== false }; }
              case 'repondreOffre': if (!new RegExp(`^/inbox/${d.conv}/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; { const rep = await envoi('PUT', `/api/v2/transactions/${d.tx}/offer_requests/${d.oid}/${d.accepter ? 'accept' : 'reject'}`, null); return { ok: true, rep, vu: true, autre: false }; }
              case 'masquer': if (!new RegExp(`^/items/${d.id}(?:-[^/]*)?/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('PUT', `/api/v2/items/${d.id}/is_hidden`, { is_hidden: !!d.voulu }), vu: true };
              case 'prix': if (!new RegExp(`^/items/${d.id}/edit/?$`).test(chemin)) return { ok: false, code: 'identite', chemin }; return { ok: true, rep: await envoi('PUT', `/api/v2/item_upload/items/${d.id}`, { item: { id: Number(d.id), price: String(d.prix), ...(d.titre ? { title: String(d.titre) } : {}) } }) };
              case 'reponse': return { ok: false, code: 'sans-reponse' };
              default: return { ok: false, code: 'etape' };
            }
          };
          emule.__emule = true;
          ctx.__vrmFormulaire = emule;
        }
