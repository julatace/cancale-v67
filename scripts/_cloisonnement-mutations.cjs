// Les trous INJECTÉS de `audit-cloisonnement.cjs --prouve` : chacun, posé dans
// une copie de l'arbre, doit faire rougir l'audit (§6.1 : un contrôle qui ne
// peut pas échouer est pire qu'absent). Chacun est un trou réaliste : celui
// qu'une modification pressée pourrait vraiment ouvrir.
module.exports = [
  {
    nom: 'lire le texte d\'un e-mail sans filtre de vendeur (clé de service)',
    fichier: 'api/_lib/reception-email.js', route: 'email-rattacher.js',
    de: 'lire(`owner=eq.${encodeURIComponent(owner)}&id=eq.email_texte_${m[1]}',
    vers: 'lire(`id=eq.email_texte_${m[1]}',
  },
  {
    nom: 'croire le `sub` du jeton sans demander à Supabase',
    fichier: 'api/_lib/session.js', route: 'compte.js',
    de: 'if (!jeton || jeton.split(\'.\').length !== 3 || jeton.length > 4096) return null;',
    vers: 'if (!jeton || jeton.split(\'.\').length !== 3 || jeton.length > 4096) return null;\n  try { const j = JSON.parse(Buffer.from(jeton.split(\'.\')[1], \'base64url\').toString()); if (j.sub) return { id: j.sub, email: \'\', emailConfirme: true, created_at: \'\' }; } catch (_) {}',
  },
  {
    nom: 'renouveler les comptes Vinted de TOUS les vendeurs (filtre retiré)',
    fichier: 'api/vinted-refresh.js', route: 'vinted-refresh.js',
    de: 'const filtre = `&owner=eq.${encodeURIComponent(u.id)}`;',
    vers: 'const filtre = \'\'; const _sansGarde = true;',
    puis: [['accounts.some(a => a.owner !== u.id)', 'false']],
  },
  {
    nom: 'prendre le vendeur dans un paramètre `owner` passé à la main (étiquettes)',
    fichier: 'api/relais.js', route: 'relais.js',
    de: 'await contexteVendeur.run({ owner: u.id }, async () => {',
    vers: 'await contexteVendeur.run({ owner: (req.body && req.body.owner) || u.id }, async () => {',
  },
  {
    nom: 'widget : servir le premier vendeur venu sans clé',
    fichier: 'api/widget.js', route: 'widget.js',
    de: 'if (mains.length === 1 && !mains[0].vrm_widget_token) return mains[0].owner || \'\';',
    vers: 'if (mains.length >= 1) return mains[0].owner || \'\';',
  },
  {
    nom: 'proxy Vinted : lire le compte Vinted sans le filtre du vendeur, clé de service',
    fichier: 'api/vinted-proxy.js', route: 'vinted-proxy.js',
    de: 'const lignes = await lireCommeVendeur(req, `vinted_accounts?select=owner,access_token,refresh_token,anon_id,csrf_token,domain&vinted_user_id=eq.${encodeURIComponent(uid)}${filtre}&limit=1`);',
    vers: 'const lignes = await (await fetch(`${process.env.SUPABASE_URL}/rest/v1/vinted_accounts?select=owner,access_token,refresh_token,anon_id,csrf_token,domain&vinted_user_id=eq.${encodeURIComponent(uid)}&limit=1`, { headers: { apikey: process.env.SUPABASE_SERVICE_KEY } })).json(); if (lignes[0]) { res.status(200).json({ compte: lignes[0] }); return; }',
  },
];
