p='vinted-sync-extension/vrm-formulaire.js'
s=open(p,encoding='utf8').read()
add=open('.res-aides.js',encoding='utf8').read()
anchor='  const ETAPES = {\n'
assert s.count(anchor)==1
s=s.replace(anchor, add+anchor)
old='''  async function saisir(el, texte) {
    const poser = setterDe(el);'''
new='''  async function saisir(el, texte, opts) {
    // 5.414 : un champ « contenteditable » (messagerie) reçoit le texte de la même façon, lettre à lettre.
    if (el && el.isContentEditable) {
      try { el.focus(); } catch (_) {}
      el.textContent = ''; el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      let v = '';
      for (const ch of Array.from(String(texte))) { v += ch; el.textContent = v; el.dispatchEvent(new InputEvent('input', { bubbles: true, data: ch, inputType: ch === '\\n' ? 'insertLineBreak' : 'insertText' })); await ceder(); }
      return String(el.textContent) === String(texte);
    }
    const poser = setterDe(el);'''
assert old in s; s=s.replace(old,new)
old2='''    el.dispatchEvent(new Event('change', { bubbles: true }));
    try { el.blur(); } catch (_) {}
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return el.value === String(texte);'''
new2='''    el.dispatchEvent(new Event('change', { bubbles: true }));
    if (!(opts && opts.garderFocus)) { try { el.blur(); } catch (_) {} el.dispatchEvent(new FocusEvent('focusout', { bubbles: true })); }
    return el.value === String(texte);'''
assert old2 in s; s=s.replace(old2,new2)
old3="const f = (e) => { if (e && e.methode === methode && re.test(e.chemin)) fin({ status: e.status, ok: e.status >= 200 && e.status < 300, json: e.json, corps: e.corps, texte: e.texte || '', dd: !!e.dd }); };"
new3="const f = (e) => { if (e && e.methode === methode && re.test(e.chemin)) fin({ status: e.status, ok: e.status >= 200 && e.status < 300, json: e.json, corps: e.corps, texte: e.texte || '', dd: !!e.dd, chemin: e.chemin }); };"
assert old3 in s; s=s.replace(old3,new3)
old4='''    async supprimer(d) {
      const b = await attendre(SEL.supprimer, 20000);'''
new4='''    async supprimer(d) {
      // 5.414 : la page montrée est celle de CETTE annonce (son identifiant dans l'adresse), sinon rien n'est touché.
      if (!new RegExp(`^/items/${String(d && d.id)}(?:-[^/]*)?/?$`).test(location.pathname)) return { ok: false, code: 'identite', chemin: location.pathname };
      const b = await attendre(SEL.supprimer, 20000);'''
assert old4 in s; s=s.replace(old4,new4)
open(p,'w',encoding='utf8').write(s)
print('ok')
