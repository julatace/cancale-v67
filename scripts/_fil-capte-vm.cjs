// (16 nov., ext. 5.398) Le faux Vinted rend le FIL tel qu'il est chez lui : le moteur d'offres
// relit la conversation (`GET /api/v2/conversations/{id}`) juste avant d'accepter ou de refuser.
// `filCapte(lignes, suite)` : un répondeur de `_fond-vm.cjs` qui sert la conversation CAPTÉE
// (`harvest_{uid}_conv_*`, payload.conversation) dont l'id est demandé, sinon passe à `suite`.
function filCapte(lignes, suite = () => ({ status: 200, body: {} })) {
  return (e) => {
    const m = /^\/api\/v2\/conversations\/([\w-]+)$/.exec(String(e && e.chemin || ''));
    if (m && e.methode === 'GET') {
      for (const [k, l] of Object.entries(lignes || {})) {
        const c = /^harvest_\d+_conv_/.test(k) && l && l.payload && l.payload.conversation;
        if (c && String(c.id) === m[1]) return { status: 200, body: { conversation: c } };
      }
    }
    return suite(e);
  };
}
module.exports = { filCapte };
