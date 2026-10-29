const $ = (id) => document.getElementById(id);
async function lire() {
  await new Promise((r) => chrome.runtime.sendMessage({ obs: 'vider' }, () => r()));
  return chrome.storage.local.get(['obsJournal', 'obsActif']);
}
function rapport(j) {
  const t0 = j.length ? j[0].t : 0;
  return JSON.stringify({
    outil: 'VRM Observateur 1.0.0',
    genereLe: new Date().toISOString(),
    n: j.length,
    // t = millisecondes depuis la première requête, d = depuis la précédente
    requetes: j.map((e, i) => Object.assign({ t: e.t - t0, d: i ? e.t - j[i - 1].t : 0, heure: new Date(e.t).toISOString() }, e, { t: undefined })),
  }, (k, v) => (v === undefined ? undefined : v), 1);
}
async function maj() {
  const s = await lire();
  const j = s.obsJournal || [];
  const on = s.obsActif !== false;
  $('etat').textContent = (on ? 'Enregistre · ' : 'En pause · ') + j.length + ' requête' + (j.length > 1 ? 's' : '') + ' notée' + (j.length > 1 ? 's' : '');
  $('bascule').textContent = on ? 'Mettre en pause' : 'Reprendre';
}
$('bascule').onclick = async () => {
  const s = await chrome.storage.local.get('obsActif');
  await chrome.storage.local.set({ obsActif: s.obsActif === false });
  maj();
};
$('copier').onclick = async () => {
  const s = await lire();
  const txt = rapport(s.obsJournal || []);
  try { await navigator.clipboard.writeText(txt); $('etat').textContent = 'Rapport copié (' + txt.length + ' caractères).'; }
  catch (_) { $('etat').textContent = 'Copie refusée — utilise « Télécharger ».'; }
};
$('telecharger').onclick = async () => {
  const s = await lire();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rapport(s.obsJournal || [])], { type: 'application/json' }));
  a.download = 'vrm-observateur-' + Date.now() + '.json';
  a.click();
};
$('effacer').onclick = async () => { if (confirm('Effacer toutes les requêtes notées ?')) { await chrome.storage.local.set({ obsJournal: [] }); maj(); } };
maj();
setInterval(maj, 3000);
