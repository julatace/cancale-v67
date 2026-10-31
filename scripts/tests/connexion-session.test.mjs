import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const source = fs.readFileSync(
  new URL("../../src/App.jsx", import.meta.url),
  "utf8",
);
const code =
  source.slice(
    source.indexOf("const authSignIn  ="),
    source.indexOf("// ── CONFIRMER EN COLLANT"),
  ) + ";globalThis.connecter=authSignIn;";
function banc(reponse) {
  let session = null,
    demande;
  const c = vm.createContext({
    authCall: async (route, corps) => {
      demande = { route, corps };
      return reponse;
    },
    sessionFrom: (j) => j,
    writeSession: (s) => {
      session = s;
    },
  });
  vm.runInContext(code, c);
  return {
    connecter: () => c.connecter(" Client@exemple.test ", "Secret123"),
    get session() {
      return session;
    },
    get demande() {
      return demande;
    },
  };
}
test("connexion : une réponse 200 incomplète ne crée pas de fausse session", async () => {
  for (const json of [
    null,
    {},
    [],
    { access_token: "jeton" },
    { access_token: " ", user: { id: "client" } },
    { access_token: "jeton", user: {} },
    { access_token: 42, user: { id: "client" } },
  ]) {
    const b = banc({ ok: true, json });
    const r = await b.connecter();
    assert.equal(r.ok, false);
    assert.match(r.error, /pas pu être confirmée/);
    assert.equal(b.session, null);
  }
});
test("connexion : seule une réponse portant le jeton et son utilisateur est enregistrée", async () => {
  const j = { access_token: "jeton", user: { id: "client" } };
  const b = banc({ ok: true, json: j });
  assert.equal((await b.connecter()).ok, true);
  assert.equal(b.session, j);
  assert.equal(b.demande.corps.email, "client@exemple.test");
});
test("connexion : confirmation attendue et identifiants refusés restent distincts", async () => {
  const b = banc({ ok: false, error: "Email not confirmed" });
  assert.equal((await b.connecter()).needsConfirm, true);
  assert.equal(b.session, null);
  const c = banc({ ok: false, error: "Invalid login credentials" });
  assert.equal((await c.connecter()).error, "Email ou mot de passe incorrect.");
  assert.equal(c.session, null);
});

test("connexion : panne du service et limitation restent compréhensibles", async () => {
  for (const [status, texte] of [
    [503, /momentanément indisponible/],
    [429, /Trop de tentatives/],
  ]) {
    const b = banc({ ok: false, status, error: "Internal service error" });
    assert.match((await b.connecter()).error, texte);
    assert.equal(b.session, null);
  }
});

const codeConfirmation =
  source.slice(
    source.indexOf("const authConfirmFromLink ="),
    source.indexOf("// Renvoyer l'email de confirmation"),
  ) + ";globalThis.confirmer=authConfirmFromLink;";
function confirmerAvec(json) {
  let session = null,
    appels = 0;
  const c = vm.createContext({
    URL,
    URLSearchParams,
    authCall: async () => {
      appels++;
      return { ok: true, json };
    },
    writeSession: (s) => {
      session = s;
    },
    sessionFrom: (j) => j,
  });
  vm.runInContext(codeConfirmation, c);
  return {
    get appels() {
      return appels;
    },
    confirmer: (
      raw = "https://projet.supabase.co/auth/v1/verify?type=signup&token_hash=abcdef",
    ) => c.confirmer(raw, "client@exemple.test"),
    get session() {
      return session;
    },
  };
}
test("confirmation : une réponse vide ou un jeton sans identité ne devient pas une réussite", async () => {
  for (const json of [
    null,
    {},
    [],
    { access_token: "jeton" },
    { user: { id: "client" } },
    { id: "client", email_confirmed_at: "" },
  ]) {
    const b = confirmerAvec(json);
    assert.equal((await b.confirmer()).ok, false);
    assert.equal(b.session, null);
  }
});
test("confirmation : adresse confirmée seule et connexion effective restent distinctes", async () => {
  const b = confirmerAvec({
    id: "client",
    email_confirmed_at: "2026-10-30T00:00:00Z",
  });
  assert.equal((await b.confirmer()).connected, false);
  assert.equal(b.session, null);
  const c = confirmerAvec({ access_token: "jeton", user: { id: "client" } });
  assert.equal((await c.confirmer()).connected, true);
  assert.equal(c.session.user.id, "client");
});

const codeRetour =
  source.slice(
    source.indexOf("const consumeAuthRedirect ="),
    source.indexOf("// Le jeton ne dit pas l'email en clair"),
  ) + ";globalThis.retour=consumeAuthRedirect;";
function retourAvec({ search = "", hash = "", json = {}, me = null } = {}) {
  let session = null,
    nettoyee = false,
    recuperationAuRangement = false;
  const ancienne = {
    session: { access_token: "ancienne", user: { id: "ancien" } },
  };
  const c = vm.createContext({
    URLSearchParams,
    MULTI_USER: true,
    window: { location: { search, hash } },
    sessionStorage: { getItem: () => "verificateur", removeItem() {} },
    localStorage: { getItem: () => null, removeItem() {} },
    PKCE_KEY: "pkce",
    AUTH: ancienne,
    RECOVERY_PENDING: false,
    lireLiaisonOAuth: () => null,
    cleanAuthUrl: () => {
      nettoyee = true;
    },
    authCall: async () => ({ ok: true, json }),
    resultatLiaisonPermis: () => true,
    fetchMe: async () => me,
    sessionFrom: (j) => j,
    writeSession: (s) => {
      recuperationAuRangement = c.RECOVERY_PENDING;
      session = s;
    },
  });
  vm.runInContext(codeRetour, c);
  return {
    retour: () => c.retour(),
    get recuperationAuRangement() {
      return recuperationAuRangement;
    },
    get session() {
      return session;
    },
    get ancienne() {
      return c.AUTH;
    },
    get nettoyee() {
      return nettoyee;
    },
  };
}
test("retour OAuth : erreur déjà décodée avec % ne fait pas disparaître le message", async () => {
  const b = retourAvec({
    search: "?error_description=Action%20100%25%20refus%C3%A9e",
  });
  assert.equal((await b.retour()).error, "Action 100% refusée");
  assert.equal(b.nettoyee, true);
  assert.equal(b.session, null);
});
test("retour OAuth : réponse PKCE incomplète et identité implicite inconnue conservent la session précédente", async () => {
  for (const json of [
    {},
    { access_token: "jeton" },
    { access_token: "jeton", user: { id: " " } },
  ]) {
    const b = retourAvec({ search: "?code=fictif", json });
    assert.match((await b.retour()).error, /pas pu être vérifiée/);
    assert.equal(b.session, null);
    assert.equal(b.ancienne.session.user.id, "ancien");
    assert.equal(b.nettoyee, true);
  }
  const c = retourAvec({
    hash: "#access_token=fictif&type=recovery",
    me: null,
  });
  assert.match((await c.retour()).error, /pas pu être vérifiée/);
  assert.equal(c.session, null);
  assert.equal(c.ancienne.session.user.id, "ancien");
});
test("retour OAuth : session vérifiée acceptée après nettoyage du lien", async () => {
  const b = retourAvec({
    search: "?code=fictif",
    json: { access_token: "jeton", user: { id: "nouveau" } },
  });
  assert.equal((await b.retour()).ok, true);
  assert.equal(b.session.user.id, "nouveau");
  assert.equal(b.nettoyee, true);
  const c = retourAvec({
    hash: "#access_token=fictif&type=recovery",
    me: { id: "nouveau" },
  });
  assert.equal((await c.retour()).recovery, true);
  assert.equal(c.session.user.id, "nouveau");
});

const codeMotDePasse =
  source.slice(
    source.indexOf("const authSetPassword ="),
    source.indexOf("// « Se déconnecter »"),
  ) + ";globalThis.changer=authSetPassword;";
function motDePasseAvec(json, { bloque = false, status = 200 } = {}) {
  let expirer,
    nettoye = false,
    signal;
  const c = vm.createContext({
    AUTH: { session: { access_token: "jeton", user: { id: "client" } } },
    SUPABASE_URL: "https://projet.supabase.co",
    SUPABASE_KEY: "publique",
    AbortController,
    setTimeout: (f) => {
      expirer = f;
      return 1;
    },
    clearTimeout: () => {
      nettoye = true;
    },
    fetch: async (_url, o) => {
      signal = o.signal;
      if (bloque)
        return new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(Error("délai"))),
        );
      return { ok: status === 200, status, json: async () => json };
    },
  });
  vm.runInContext(codeMotDePasse, c);
  return {
    changer: () => c.changer("NouveauSecret123"),
    expirer: () => expirer(),
    get nettoye() {
      return nettoye;
    },
    get signal() {
      return signal;
    },
  };
}
test("mot de passe : réponse vide ou autre identité ne deviennent pas une réussite", async () => {
  for (const json of [{}, null, { id: "autre" }]) {
    const b = motDePasseAvec(json);
    assert.equal((await b.changer()).ok, false);
    assert.equal(b.nettoye, true);
  }
  const b = motDePasseAvec({ id: "client" });
  assert.equal((await b.changer()).ok, true);
  assert.equal(b.nettoye, true);
});
test("mot de passe : requête bloquée interrompue et résultat annoncé comme non confirmé", async () => {
  const b = motDePasseAvec(null, { bloque: true });
  const r = b.changer();
  b.expirer();
  assert.equal(b.signal.aborted, true);
  assert.match((await r).error, /pas pu être confirmé/);
  assert.equal(b.nettoye, true);
});

test("lien de récupération : le mode de changement est activé avant la publication de session", async () => {
  for (const opts of [
    { hash: "#access_token=fictif&type=recovery", me: { id: "nouveau" } },
    {
      search: "?code=fictif&type=recovery",
      json: { access_token: "fictif", user: { id: "nouveau" } },
    },
  ]) {
    const b = retourAvec(opts);
    assert.equal((await b.retour()).recovery, true);
    assert.equal(b.recuperationAuRangement, true);
  }
});
test("lien de connexion : une durée vide, négative ou non numérique ne crée pas de session", async () => {
  for (const valeur of [
    "",
    "0",
    "-1",
    "incorrect",
    "3600abc",
    "1e309",
    "1e308",
  ]) {
    const b = retourAvec({
      hash: "#access_token=fictif&expires_in=" + valeur,
      me: { id: "nouveau" },
    });
    assert.match((await b.retour()).error, /pas utilisable/);
    assert.equal(b.session, null);
    assert.equal(b.nettoyee, true);
  }
  const b = retourAvec({
    hash: "#access_token=fictif&expires_in=3600",
    me: { id: "nouveau" },
  });
  assert.equal((await b.retour()).ok, true);
  assert.ok(Number.isFinite(b.session.expires_at));
});
test("confirmation manuelle : un lien de récupération est orienté sans consommer son jeton", async () => {
  for (const raw of [
    "https://projet.supabase.co/auth/v1/verify?type=recovery&token=fictif",
    "https://vrm.center/recuperation.html#type=recovery&token_hash=fictif",
    "?type=recovery&token_hash=fictif",
  ]) {
    const b = confirmerAvec({ access_token: "fictif", user: { id: "client" } });
    const r = await b.confirmer(raw);
    assert.equal(r.ok, false);
    assert.equal(r.recovery, true);
    assert.equal(b.appels, 0);
    assert.equal(b.session, null);
  }
});
const codeNettoyage =
  source.slice(
    source.indexOf("const cleanAuthUrl ="),
    source.indexOf("const consumeAuthRedirect ="),
  ) + ";globalThis.nettoyer=cleanAuthUrl;";
test("retour de connexion : paramètres sensibles encodés et dupliqués effacés sans perdre les filtres", () => {
  let u = new URL(
    "https://vrm.center/?%63ode=fictif&code=autre&tab=achats&recherche=air+max&%72efresh_token=fictif&error_description=e&type=recovery&state=fictif#access_token=fictif",
  );
  const c = vm.createContext({
    URLSearchParams,
    window: {
      get location() {
        return u;
      },
      history: {
        replaceState: (_a, _b, path) => {
          u = new URL(path, u);
        },
      },
    },
  });
  vm.runInContext(codeNettoyage, c);
  c.nettoyer();
  assert.equal(u.hash, "");
  assert.deepEqual(
    [...u.searchParams],
    [
      ["tab", "achats"],
      ["recherche", "air max"],
    ],
  );
  const premiere = u.href;
  c.nettoyer();
  assert.equal(u.href, premiere);
});
