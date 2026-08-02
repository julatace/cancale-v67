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
  const rows = (fresh || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));
  if (!rows.length) {
    fr.innerHTML = '<div class="row"><span class="dot off"></span>Rien de capté pour l\'instant</div>';
  } else {
    fr.innerHTML = rows.map(r => {
      const a = age(r.at);
      const vide = !(r.n || 0);
      const etat = vide ? '' : a.etat;           // pas d'alerte rouge sur un compte sans annonce
      const info = vide ? 'aucune annonce' : `${r.n} annonces · ${a.txt}`;
      return `<div class="row"><span class="dot ${etat === 'ok' ? '' : etat}"></span><span class="nom">${r.login || '#' + r.uid}</span><span class="age">${info}</span></div>`;
    }).join('');
    // Un compte SANS AUCUNE ANNONCE (0) n'a rien a rafraichir : le compter
    // comme « annonces qui datent » faisait crier « 25 jours » alors que tous
    // les comptes actifs venaient d'etre moissonnes.
    const vieux = rows.filter(r => (r.n || 0) > 0 && (!r.at || Date.now() - r.at > 2 * JOUR));
    const vides = rows.filter(r => !(r.n || 0));
    document.getElementById('tip').innerHTML = vieux.length
      ? `<div class="tip">${vieux.length} compte${vieux.length > 1 ? 's' : ''} dont les annonces datent. Connecte-toi dessus sur vinted.fr et ouvre ton <b>dressing</b> : elles se remettront a jour toutes seules.</div>`
      : (vides.length ? `<div class="muted">${vides.length} compte${vides.length > 1 ? 's' : ''} sans annonce en ligne — rien a rafraichir.</div>` : '');
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
