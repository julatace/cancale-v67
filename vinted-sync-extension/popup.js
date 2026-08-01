// popup.js — petit tableau de bord de l'extension.
function render(list, lastSync) {
  const el = document.getElementById('accounts');
  if (!list || !list.length) { el.innerHTML = '<div class="row"><span class="dot off"></span>Aucun compte détecté (connecte-toi sur vinted.fr)</div>'; return; }
  el.innerHTML = list.map(a => `<div class="row"><span class="dot"></span>${a.domain} — compte ${a.uid}</div>`).join('');
  if (lastSync) {
    const d = new Date(lastSync);
    document.getElementById('status').textContent = 'Dernière synchro : ' + d.toLocaleTimeString('fr-FR');
  }
}

chrome.storage.local.get(['lastAccounts', 'lastSync'], (r) => render(r.lastAccounts, r.lastSync));

document.getElementById('syncBtn').addEventListener('click', () => {
  const s = document.getElementById('status');
  s.textContent = 'Synchronisation…';
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'syncNow' }, (resp) => {
    if (resp && resp.ok) { render(resp.accounts, Date.now()); s.textContent = 'Synchronisé ✓'; }
    else { s.textContent = 'Échec — réessaie'; }
  });
});
