// api/_lib/gabarit-email.js
// ════════════════════════════════════════════════════════════════════════════
// LA FORME DES E-MAILS QUE VRM ENVOIE (5 nov., Julien : « améliore les mails ça
// doit être plus clair stp ça doit être bcp plus clair »).
// ════════════════════════════════════════════════════════════════════════════
// Une seule forme, la même pour chaque e-mail parti de VRM (rappels de l'essai,
// lien de confirmation d'adresse) :
//   1. un TITRE qui dit ce que c'est ;
//   2. une ou deux phrases courtes : ce qu'il faut faire ;
//   3. UN bouton (un seul lien d'action) ;
//   4. en petit, le pied (pourquoi on reçoit ce message, comment l'arrêter).
// Le texte brut dit la même chose dans le même ordre (le bouton y devient
// « Mot : adresse »). Sans jargon, sans donnée réelle : les gabarits ne portent
// que ce que l'appelant leur donne.
// ⚠️ Tout est échappé : aucune valeur ne peut écrire du HTML dans l'e-mail.
export const echapperHtml = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const POLICE = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

// titre   : la ligne qui dit ce que c'est (« Ton essai se termine demain »)
// paras   : phrases courtes, dans l'ordre
// liste   : (facultatif) des lignes, une par chose, juste après `paras`
// chiffres: (facultatif, 8 nov., bilan du mois) [[libellé, valeur, note?]] — un
//           tableau sobre, chiffres alignés ; « — » pour un chiffre pas su
// suite   : (facultatif) phrases après la liste
// bouton  : { mot, url } — LE lien d'action (un seul)
// apres   : (facultatif) une phrase en petit sous le bouton
// pied    : { texte, lien?, motLien? } — en petit, à la fin ; `lien` n'apparaît
//           dans le HTML que sous `motLien`, et en entier dans le texte brut.
export function gabaritEmail({ titre, paras = [], liste = [], chiffres = [], suite = [], bouton = null, apres = '', pied = null }) {
  const lignes = [titre, '', ...paras.flatMap((p) => [p, ''])];
  if (liste.length) lignes.push(...liste.map((x) => `· ${x}`), '');
  if (chiffres.length) lignes.push(...chiffres.map(([l, v, n]) => `${l} : ${v}${n ? ` (${n})` : ''}`), '');
  lignes.push(...suite.flatMap((x) => [x, '']));
  if (bouton) lignes.push(`${bouton.mot} : ${bouton.url}`, '');
  if (apres) lignes.push(apres, '');
  if (pied) lignes.push('—', pied.lien ? `${pied.texte} ${pied.motLien ? pied.motLien[0].toUpperCase() + pied.motLien.slice(1) : 'Lien'} : ${pied.lien}` : pied.texte);
  const texte = lignes.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const p = (t, style = '') => `<p style="margin:0 0 14px;${style}">${echapperHtml(t)}</p>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${echapperHtml(titre)}</title></head>`
    + `<body style="margin:0;padding:24px 16px;background:#ffffff;color:#1d1d1f;font:16px/1.5 ${POLICE}">`
    + `<div style="max-width:520px;margin:0 auto">`
    + `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;font-weight:700;color:#1d1d1f">${echapperHtml(titre)}</h1>`
    + paras.map((t) => p(t)).join('')
    + (liste.length ? `<ul style="margin:0 0 16px;padding:0 0 0 20px">${liste.map((x) => `<li style="margin:0 0 8px">${echapperHtml(x)}</li>`).join('')}</ul>` : '')
    + (chiffres.length ? `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:4px 0 18px;border-collapse:collapse;background:#f5f5f7;border-radius:14px">${chiffres.map(([l, v, n], i) => `<tr><td style="padding:12px 16px;${i ? 'border-top:1px solid #e5e5ea;' : ''}vertical-align:top"><div style="font-size:15px;color:#1d1d1f">${echapperHtml(l)}</div>${n ? `<div style="font-size:13px;color:#6e6e73;margin-top:2px">${echapperHtml(n)}</div>` : ''}</td><td style="padding:12px 16px;${i ? 'border-top:1px solid #e5e5ea;' : ''}text-align:right;vertical-align:top;white-space:nowrap;font-size:17px;font-weight:600;color:#1d1d1f;font-variant-numeric:tabular-nums">${echapperHtml(v)}</td></tr>`).join('')}</table>` : '')
    + suite.map((t) => p(t)).join('')
    + (bouton ? `<p style="margin:20px 0 18px"><a href="${echapperHtml(bouton.url)}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:#0071e3;color:#ffffff;font-weight:600;text-decoration:none">${echapperHtml(bouton.mot)}</a></p>` : '')
    + (apres ? p(apres, 'color:#6e6e73;font-size:14px') : '')
    + (pied ? `<hr style="border:0;border-top:1px solid #e5e5ea;margin:24px 0 12px"><p style="margin:0;color:#6e6e73;font-size:12px">${echapperHtml(pied.texte)}${pied.lien ? ` <a href="${echapperHtml(pied.lien)}" style="color:#6e6e73">${echapperHtml(pied.motLien || 'lien')}</a>` : ''}</p>` : '')
    + `</div></body></html>`;
  return { texte, html };
}
