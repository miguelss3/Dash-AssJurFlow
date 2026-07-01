const admin = require("firebase-admin");
const functions = require("firebase-functions");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAILS = new Set(["miguelss3@yahoo.com.br"]);

const ALLOWED_ORIGINS = new Set([
  "https://assjur-flow-12rm.web.app",
  "https://assjur-flow-12rm.firebaseapp.com",
  "https://assjurflow.app.br",
  "http://localhost:5173",
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.has(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Vary", "Origin");
}

function normalizeText(value) {
  return String(value || "").trim().toUpperCase();
}

function parseBooleanLike(value) {
  if (value === true) return true;
  const normalized = normalizeText(value);
  return normalized === "SIM" || normalized === "TRUE" || normalized === "1";
}

function profileIndicatesAdmin(profile, email) {
  if (email && ADMIN_EMAILS.has(String(email).trim().toLowerCase())) return true;
  if (!profile) return false;

  const role = normalizeText(profile.role);
  const cargo = normalizeText(profile.cargo);
  const setor = normalizeText(profile.setor);

  return (
    parseBooleanLike(profile.isChefe) ||
    role.includes("CHEFE") ||
    cargo.includes("CHEFE") ||
    cargo === "ADMIN UNIVERSAL" ||
    setor === "CHEFE ASSEAPASSJUR"
  );
}

async function loadCallerProfile(uid, email) {
  if (!uid) return null;

  const directDoc = await db.collection("usuarios").doc(uid).get();
  if (directDoc.exists) {
    return directDoc.data() || null;
  }

  const byUid = await db.collection("usuarios").where("uid", "==", uid).limit(1).get();
  if (!byUid.empty) {
    return byUid.docs[0].data() || null;
  }

  if (email) {
    const byEmail = await db.collection("usuarios").where("email", "==", email).limit(1).get();
    if (!byEmail.empty) {
      return byEmail.docs[0].data() || null;
    }
  }

  return null;
}

async function resolveTargetUser(data) {
  const uid = String(data && data.uid ? data.uid : "").trim();
  const email = String(data && data.email ? data.email : "").trim().toLowerCase();

  if (uid) {
    try {
      return { uid, userRecord: await auth.getUser(uid) };
    } catch (e) {
      const code = String(e && e.code ? e.code : "");
      const uidInvalidoOuAusente = code === "auth/user-not-found" || code === "auth/invalid-uid";

      // Compatibilidade com cadastros legados: alguns documentos usam ID diferente do UID do Auth.
      // Se o UID informado não existir no Authentication, tenta localizar pelo e-mail.
      if (uidInvalidoOuAusente && email) {
        try {
          const userRecord = await auth.getUserByEmail(email);
          return { uid: userRecord.uid, userRecord };
        } catch (emailErr) {
          const emailCode = String(emailErr && emailErr.code ? emailErr.code : "");
          if (emailCode === "auth/user-not-found") {
            throw new Error("user-not-found");
          }
          throw emailErr;
        }
      }

      if (uidInvalidoOuAusente) {
        throw new Error("user-not-found");
      }

      throw e;
    }
  }

  if (email) {
    try {
      const userRecord = await auth.getUserByEmail(email);
      return { uid: userRecord.uid, userRecord };
    } catch (e) {
      const code = String(e && e.code ? e.code : "");
      if (code === "auth/user-not-found") {
        throw new Error("user-not-found");
      }
      throw e;
    }
  }

  throw new Error("invalid-argument: UID ou email do usuário são obrigatórios.");
}

exports.deleteUserAccount = functions.region("us-central1").https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "unauthenticated", message: "Usuário não autenticado." });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (e) {
      console.error("verifyIdToken failed:", e.message);
      res.status(401).json({ error: "unauthenticated", message: "Token inválido." });
      return;
    }

    const callerUid = decodedToken.uid;
    const callerEmail = String(decodedToken.email || "").trim().toLowerCase();

    let callerProfile = null;
    try {
      callerProfile = await loadCallerProfile(callerUid, callerEmail);
    } catch (e) {
      console.error("loadCallerProfile failed:", e.message);
    }

    if (!profileIndicatesAdmin(callerProfile, callerEmail)) {
      console.log("permission-denied for:", callerEmail, "profile:", JSON.stringify(callerProfile));
      res.status(403).json({ error: "permission-denied", message: "Somente perfis administrativos podem excluir usuários." });
      return;
    }

    // Suporte a body como Buffer (caso Content-Type não seja detectado)
    let data = req.body || {};
    if (Buffer.isBuffer(data)) {
      try { data = JSON.parse(data.toString()); } catch { data = {}; }
    }
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = {}; }
    }

    let uid, userRecord;
    try {
      ({ uid, userRecord } = await resolveTargetUser(data));
    } catch (e) {
      console.error("resolveTargetUser failed:", e.message, "data:", JSON.stringify(data));
      if (String(e.message || "") === "user-not-found") {
        res.status(404).json({ error: "user-not-found", message: "Usuário não encontrado no Firebase Authentication." });
        return;
      }
      res.status(400).json({ error: "invalid-argument", message: e.message || "UID ou email inválidos." });
      return;
    }

    if (uid === callerUid) {
      res.status(400).json({ error: "failed-precondition", message: "Autoexclusão não é permitida." });
      return;
    }

    try {
      await auth.deleteUser(uid);
    } catch (e) {
      console.error("auth.deleteUser failed:", e.message);
      res.status(500).json({ error: "internal", message: "Erro ao deletar usuário do Authentication: " + e.message });
      return;
    }

    const agoraISO = new Date().toISOString();
    const batch = db.batch();

    const perfilCanonicoRef = db.collection("usuarios").doc(uid);
    batch.set(perfilCanonicoRef, {
      ativo: false,
      authRemovido: true,
      authRemovidoEm: agoraISO,
      authRemovidoPorUid: callerUid,
      authRemovidoPorEmail: callerEmail,
      uid,
      email: String(userRecord.email || (data && data.email) || "").trim().toLowerCase() || null,
    }, { merge: true });

    const docsPorUid = await db.collection("usuarios").where("uid", "==", uid).get();
    docsPorUid.docs.forEach((docSnap) => {
      batch.set(docSnap.ref, {
        ativo: false,
        authRemovido: true,
        authRemovidoEm: agoraISO,
        authRemovidoPorUid: callerUid,
        authRemovidoPorEmail: callerEmail,
      }, { merge: true });
    });

    const emailAlvo = String(userRecord.email || (data && data.email) || "").trim().toLowerCase();
    if (emailAlvo) {
      const docsPorEmail = await db.collection("usuarios").where("email", "==", emailAlvo).get();
      docsPorEmail.docs.forEach((docSnap) => {
        batch.set(docSnap.ref, {
          ativo: false,
          authRemovido: true,
          authRemovidoEm: agoraISO,
          authRemovidoPorUid: callerUid,
          authRemovidoPorEmail: callerEmail,
        }, { merge: true });
      });
    }

    try {
      await batch.commit();
    } catch (e) {
      console.error("Firestore batch error (auth já removido):", e.message);
    }

    res.json({ ok: true, uid });

  } catch (e) {
    console.error("deleteUserAccount unhandled error:", e.message, e.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: "internal", message: e.message || "Erro interno." });
    }
  }
});

exports.criarUsuarioAdmin = functions.region("us-central1").https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "method-not-allowed" });
    return;
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) {
      res.status(401).json({ error: "unauthenticated", message: "Usuário não autenticado." });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (e) {
      console.error("verifyIdToken failed:", e.message);
      res.status(401).json({ error: "unauthenticated", message: "Token inválido." });
      return;
    }

    const callerUid = decodedToken.uid;
    const callerEmail = String(decodedToken.email || "").trim().toLowerCase();

    let callerProfile = null;
    try {
      callerProfile = await loadCallerProfile(callerUid, callerEmail);
    } catch (e) {
      console.error("loadCallerProfile failed:", e.message);
    }

    if (!profileIndicatesAdmin(callerProfile, callerEmail)) {
      console.log("permission-denied for:", callerEmail, "profile:", JSON.stringify(callerProfile));
      res.status(403).json({ error: "permission-denied", message: "Somente perfis administrativos podem criar usuários." });
      return;
    }

    let data = req.body || {};
    if (Buffer.isBuffer(data)) {
      try { data = JSON.parse(data.toString()); } catch { data = {}; }
    }
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch { data = {}; }
    }

    const email = String(data && data.email ? data.email : "").trim().toLowerCase();
    const senha = String(data && data.senha ? data.senha : "");
    const nomeExibicao = String(data && data.nomeExibicao ? data.nomeExibicao : "").trim();

    if (!email || !senha) {
      res.status(400).json({ error: "invalid-argument", message: "email e senha são obrigatórios." });
      return;
    }

    if (senha.length < 6) {
      res.status(400).json({ error: "invalid-argument", message: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }

    let userRecord;
    try {
      userRecord = await auth.createUser({
        email,
        password: senha,
        displayName: nomeExibicao || undefined,
      });
    } catch (e) {
      const code = String(e && e.code ? e.code : "");
      console.error("auth.createUser failed:", code, e.message);
      if (code === "auth/email-already-exists") {
        res.status(409).json({ error: "email-already-exists", message: "Este email já está em uso." });
        return;
      }
      if (code === "auth/invalid-email") {
        res.status(400).json({ error: "invalid-email", message: "Email inválido." });
        return;
      }
      if (code === "auth/invalid-password") {
        res.status(400).json({ error: "invalid-password", message: "Senha inválida (mínimo 6 caracteres)." });
        return;
      }
      res.status(500).json({ error: "internal", message: "Erro ao criar usuário no Authentication: " + e.message });
      return;
    }

    res.status(200).json({ ok: true, uid: userRecord.uid });
  } catch (e) {
    console.error("criarUsuarioAdmin unhandled error:", e.message, e.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: "internal", message: e.message || "Erro interno." });
    }
  }
});