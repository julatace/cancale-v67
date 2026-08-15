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

// ── COMPTE VRM ────────────────────────────────────────────────────────────────
// L'extension peut s'identifier ELLE-MÊME (email + mot de passe), sans passer
// par l'app. ⚠️ On dit la vérité sur ce que ça protège : tant que la base ne
// sépare pas les vendeurs (colonne `owner` + RLS), se connecter ne cloisonne
// RIEN — ça prépare, ça ne protège pas encore. Promettre l'inverse serait
// exactement le genre de mensonge qui fait fuiter des données.
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function rendreAuth(e) {
  const box = document.getElementById('auth');
  if (!box) return;
  const note = e && e.cloisonne
    ? "Tes captures sont enregistrées sous ton compte."
    : "La séparation des comptes n'est pas encore activée en base : se connecter prépare le terrain, mais ne cloisonne pas encore les données.";
  if (e && e.connecte) {
    box.innerHTML = `<div class="who"><span class="dot"></span><span class="nom">${esc(e.email || 'connecté')}</span></div>
      <div class="muted" style="margin-top:0">${note}</div>
      <button class="sec" id="outBtn">Se déconnecter</button>`;
    document.getElementById('outBtn').addEventListener('click', () => {
      chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogout' }, () => chargerAuth());
    });
    return;
  }
  const expiree = e && e.expiree;
  box.innerHTML = `<div class="who"><span class="dot ${expiree ? 'warn' : 'off'}"></span><span class="nom">${expiree ? 'Session expirée' : 'Non connecté'}</span></div>
    <div class="muted" style="margin-top:0">${expiree ? 'Ta session a expiré — retape ton mot de passe.' : note}</div>
    <input id="mail" type="email" placeholder="Email" autocomplete="username">
    <input id="pw" type="password" placeholder="Mot de passe" autocomplete="current-password">
    <button id="inBtn">Se connecter</button>
    <div class="err" id="authErr" hidden></div>`;
  const err = document.getElementById('authErr');
  const go = () => {
    const email = document.getElementById('mail').value, password = document.getElementById('pw').value;
    const btn = document.getElementById('inBtn');
    btn.textContent = 'Connexion…'; btn.disabled = true; err.hidden = true;
    chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authLogin', email, password }, (r) => {
      btn.textContent = 'Se connecter'; btn.disabled = false;
      if (r && r.ok) chargerAuth();
      else { err.textContent = (r && r.error) || 'Connexion refusée.'; err.hidden = false; }
    });
  };
  document.getElementById('inBtn').addEventListener('click', go);
  // Entrée depuis le champ mot de passe : sinon il faut viser le bouton.
  document.getElementById('pw').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') go(); });
}

function chargerAuth() {
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'authEtat' }, (r) => rendreAuth(r || {}));
}
chargerAuth();

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
