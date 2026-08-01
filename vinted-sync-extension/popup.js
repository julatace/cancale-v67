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

// « Copier mon token » : récupère le bundle du compte Vinted connecté et le met
// dans le presse-papier. Julien le colle ensuite dans l'app (Comptes liés →
// « Connecter un compte »).
document.getElementById('copyTokenBtn').addEventListener('click', () => {
  const s = document.getElementById('status');
  s.textContent = 'Récupération du token…';
  chrome.runtime.sendMessage({ from: 'cancale-popup', action: 'copyToken' }, async (resp) => {
    if (!resp || !resp.ok || !resp.bundle) { s.textContent = 'Aucun compte Vinted connecté ici. Connecte-toi sur vinted.fr d\'abord.'; return; }
    const text = JSON.stringify(resp.bundle);
    try {
      await navigator.clipboard.writeText(text);
      s.textContent = 'Token copié ✓ — colle-le dans l\'app';
    } catch (_) {
      // Repli si l'API clipboard est bloquée dans le popup.
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); s.textContent = 'Token copié ✓ — colle-le dans l\'app'; }
      catch (e) { s.textContent = 'Copie impossible — réessaie'; }
      ta.remove();
    }
  });
});
