p='vinted-sync-extension/background.js'
s=open(p,encoding='utf8').read()
def rep(old,new,n=1):
    global s
    c=s.count(old)
    assert c==n,(c,old[:80])
    s=s.replace(old,new)
rep("""    const ec = await attendreEcriture(uid, acc, tx.texte, 'serie'); if (!ec.ok) return { pasParti: true, code: ec.code };
    return vintedPage(acc, 'POST', `/api/v2/conversations/${a.conv}/replies`, corpsReponseVinted(tx.texte), { timeoutMs: 12000 });
  }));
  if (!r || r.pasParti || pasParti(r)) { if (recu.at) await rendreActions(uid, recu.at, 1); return { pasParti: true, code: r && r.code }; }""",
"""    const ec = await attendreEcriture(uid, acc, tx.texte, 'serie'); if (!ec.ok) return { pasParti: true, code: ec.code };
    // 5.414 (`toutinterface`) : tapé dans le champ de CETTE conversation, « Envoyer », vu dans le fil.
    return interfaceVinted(acc, 'message', { conv: String(a.conv || ''), texte: tx.texte });
  }));
  if (!r || r.pasParti || pasParti(r)) { if (recu.at) await rendreActions(uid, recu.at, 1); return { pasParti: true, code: r && (r.code || r.sansPage) }; }
  if (r.incertain) return { ok: false, code: 'incertain' };   // peut-être parti : noté, JAMAIS renvoyé""")
i=s.index("async function evaluationGeste(uid, a, R) {")
j=s.index("// STOCK AUTO : la paire vendue", i)
s=s[:i]+"""async function evaluationGeste(uid, a, R) {
  // ⚠️ 5.414 (`toutinterface`, Julien, 21 nov. : « on ne fait plus les requêtes ») : l'évaluation n'est plus REJOUÉE par
  //    requête (la forme apprise de SA propre évaluation). Le geste par l'interface (les étoiles, le texte, « Envoyer »)
  //    n'a pas encore été relevé sur la vraie page : RIEN ne part, c'est noté (jamais deux fois pour la même vente) et dit.
  void R; void a;
  noterDiag('bleam_eval_interface_pas_encore');
  try { await noterJournal(uid, 'evaluation_a_faire', { x: a && a.tx, auto: true }); } catch (_) {}
  return { ok: false, code: 'interface-pas-encore', raison: 'laisse l’évaluation sur vinted.fr (la vente → « Laisser une évaluation ») : VRM ne l’envoie plus par requête. Rien n’est parti.' };
}
"""+s[j:]
open(p,'w',encoding='utf8').write(s)
print('ok')
