// Relais installé avant les premières réponses réseau de Leboncoin.
(function(){
  if(window.__vrmLbcRelayLoaded)return;window.__vrmLbcRelayLoaded=true;
  const vus=new Set();
  // L'observateur réseau MAIN world (lbc-inject.js) est injecté via le manifest
  // (content_script world:MAIN) → immunisé à la CSP de Leboncoin. Ici on ne fait
  // que RELAYER au background ce qu'il capte (window.postMessage).
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const d = event.data;
    if(d?.__tag==='CANCALE_LBC_CAPTEUR'&&d.kind==='pret'){window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*');return;}
    if (!d || d.__tag !== 'CANCALE_LBC') return;
    if(Number.isSafeInteger(d.__vrmSequence)){if(vus.has(d.__vrmSequence))return;vus.add(d.__vrmSequence);if(vus.size>256)vus.delete(vus.values().next().value);}
    if (d.kind === 'lbcraw' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcRaw', url: d.url, body: d.body, session: typeof d.session === 'string' ? d.session.slice(0, 64) : '' }); } catch (_) {} }
    else if (d.kind === 'lbccatalogue' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcCatalogue', url: d.url, body: d.body, coupe: !!d.coupe }); } catch (_) {} }
    else if (d.kind === 'lbcenvoi' && d.cles) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcEnvoi', url: d.url, methode: d.methode || '', cles: d.cles }); } catch (_) {} }
    else if (d.kind === 'lbcvente' && d.body) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcVente', url: d.url, body: d.body, coupe: !!d.coupe }); } catch (_) {} }
    else if (d.kind === 'lbcpaths' && d.paths) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcPaths', paths: d.paths, url: location.href }); } catch (_) {} }
    else if (d.kind === 'lbcschema' && d.cles) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcSchema', endpoint: d.endpoint, cles: d.cles }); } catch (_) {} }
    // La messagerie : le NOMBRE de non-lus d'un compte, et la liste de ses comptes
    // liés (sans email). Jamais un texte de message (voir lbc-inject.js).
    else if (d.kind === 'lbcmsgcompteur' && d.userId) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcMsgCompteur', userId: String(d.userId).slice(0, 64), unread: Number(d.unread) }); } catch (_) {} }
    else if (d.kind === 'lbccomptes' && Array.isArray(d.comptes)) { try { chrome.runtime.sendMessage({ from: 'cancale-lbc', action: 'lbcComptes', comptes: d.comptes.slice(0, 10).map((c) => ({ id: String(c.id || '').slice(0, 64), name: String(c.name || '').slice(0, 60), pro: !!c.pro })) }); } catch (_) {} }
  }, false);
  window.postMessage({__tag:'CANCALE_LBC_RELAY',kind:'pret'},'*');
})();
