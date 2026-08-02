// popup.js — le tableau de bord de l'extension.
// Il répond à UNE question : « est-ce que mes données sont à jour ? ».
// Avant, il listait seulement les comptes captés — donc on croyait que tout
// allait bien alors que les annonces d'un compte pouvaient dater de 25 jours.
const JOUR = 86400000;

function age(ms) {
  if (!ms) return { txt: 'jamais', etat: 'off' };
  const d = Date.now() - ms;
  const h = d / 3600000;
  const txt = h < 1 ? 'il y a ' + Math.max(1, Math.round(d / 60000)) + ' min'
            : h < 48 ? 'il y a ' + Math.round(h) + ' h'
            : 'il y a ' + Math.round(h / 24) + ' j';
  // Les annonces changent vite (on en poste, on en vend) : au-delà de 2 jours
  // l'app raconte un stock qui n'existe plus.
  const etat = d < 2 * JOUR ? 'ok' : d < 7 * JOUR ? 'warn' : 'off';
  return { txt, etat };
}

function render(list, lastSync, fresh) {
  // Le pseudo n'est pas stocké avec les comptes captés (seulement domaine + id) :
  // on le récupère depuis la liste de fraîcheur, qui, elle, vient de la base.
  const nomDe = {};
  (fresh || []).forEach(r => { if (r.login) nomDe[String(r.uid)] = r.login; });
  const acc = document.getElementById('accounts');
  if (!list || !list.length) {
    acc.innerHTML = '<div class="row"><span class="dot off"></span>Aucun compte détecté — connecte-toi sur vinted.fr</div>';
  } else {
    acc.innerHTML = list.map(a =>
      `<div class="row"><span class="dot"></span><span class="nom">${nomDe[String(a.uid)] || 'compte ' + a.uid}</span><span class="age">${(a.domain || '').replace(/^www\./, '')}</span></div>`
    ).join('');
  }

  const fr = document.getElementById('fresh');
  const rows = (fresh || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  if (!rows.length) {
    fr.innerHTML = '<div class="row"><span class="dot off"></span>Rien de capté pour l\'instant</div>';
  } else {
    fr.innerHTML = rows.map(r => {
      const a = age(r.at);
      return `<div class="row"><span class="dot ${a.etat === 'ok' ? '' : a.etat}"></span><span class="nom">${r.login || '#' + r.uid}</span><span class="age">${a.txt}</span></div>`;
    }).join('');
    const vieux = rows.filter(r => !r.at || Date.now() - r.at > 2 * JOUR);
    document.getElementById('tip').innerHTML = vieux.length
      ? `<div class="tip">${vieux.length} compte${vieux.length > 1 ? 's' : ''} dont les annonces datent. Connecte-toi dessus sur vinted.fr et ouvre ton <b>dressing</b> : elles se remettront à jour toutes seules.</div>`
      : '';
  }

  if (lastSync) {
    document.getElementById('status').textContent = 'Dernière synchro : ' + new Date(lastSync).toLocaleTimeString('fr-FR');
  }
}

function charger() {
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'freshness' }, (resp) => {
    chrome.storage.local.get(['lastAccounts', 'lastSync'], (r) => {
      render(r.lastAccounts, r.lastSync, resp && resp.ok ? resp.fresh : []);
    });
  });
}
charger();

document.getElementById('syncBtn').addEventListener('click', () => {
  const s = document.getElementById('status');
  s.textContent = 'Synchronisation…';
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'syncNow' }, (resp) => {
    if (resp && resp.ok) { s.textContent = 'Synchronisé ✓'; setTimeout(charger, 600); }
    else { s.textContent = 'Échec — réessaie'; }
  });
});
