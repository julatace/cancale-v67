// Fusion du fil par identités : partagée avec le service worker.
export function fusionnerConversation(avant, neuf) {
  const a = avant && (avant.conversation || avant), n = neuf && (neuf.conversation || neuf);
  if (!n || !Array.isArray(n.messages)) return null;
  if (a?.id != null && n.id != null && String(a.id) !== String(n.id)) return null;
  const messages = [], index = new Map();
  for (const m of [...(Array.isArray(a?.messages) ? a.messages : []), ...n.messages]) {
    if (!m || typeof m !== 'object') continue;
    const id = m.id ?? m.entity?.id;
    const cle = id == null || String(id).trim() === '' ? null : String(m.entity_type || '') + ':' + String(id);
    if (cle != null && index.has(cle)) {
      const i = index.get(cle), ancien = messages[i], entity = { ...(ancien.entity || {}), ...(m.entity || {}) };
      if (m.entity_type === 'offer_request_message') {
        // Identité immuable de l'offre : une contradiction ne se résout pas au hasard.
        for (const k of ['transaction_id', 'offer_request_id'])
          if (ancien.entity?.[k] != null && m.entity?.[k] != null && String(ancien.entity[k]) !== String(m.entity[k])) return null;
        // Une copie en attente ne réouvre jamais la même offre déjà traitée/précédente.
        if (entity.status === 10 && ([20,30].includes(ancien.entity?.status) || ancien.entity?.current === false || /expir|annul|cancel|retir/i.test(ancien.entity?.status_title || ''))) {
          for (const k of ['status','status_title','current']) entity[k] = ancien.entity?.[k];
        }
      }
      messages[i] = { ...ancien, ...m, ...(ancien.entity || m.entity ? {entity} : {}) };
    }
    else { if (cle != null) index.set(cle, messages.length); messages.push(m); }
  }
  const ts = m => { const v = m.created_at_ts ?? m.entity?.created_at_ts ?? m.created_at ?? m.entity?.created_at; const num = Number(v); return v == null ? 0 : Number.isFinite(num) ? (num < 1e12 ? num * 1000 : num) : (Date.parse(v) || 0); };
  messages.sort((x,y) => ts(x) - ts(y));
  const conversation = { ...(a || {}), ...n, messages };
  return neuf.conversation ? { ...neuf, conversation } : conversation;
}
