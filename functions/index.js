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
      const code = String(e && e.code ? e.code : "");
      console.error("auth.deleteUser failed:", code, e.message);
      if (code === "auth/user-not-found") {
        res.status(404).json({ error: "user-not-found", message: "Usuário não encontrado no Authentication (pode já ter sido removido)." });
        return;
      }
      res.status(500).json({ error: "internal", message: "Erro ao deletar usuário do Authentication: " + e.message });
      return;
    }

    // Limpeza do Firestore — erros aqui não revertem a exclusão do Auth.
    try {
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

      await batch.commit();
    } catch (firestoreErr) {
      console.error("Firestore cleanup error (auth já removido):", firestoreErr.message);
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

// ──────────────────────────────────────────────────────────────────────────────
// geminiChat — Assistente IA via Google Gemini 1.5 Flash
// Chave da API lida de variável de ambiente GEMINI_KEY (functions/.env)
// Rate limit: 20 perguntas por usuário por dia (Firestore: ia_usage/{uid})
// ──────────────────────────────────────────────────────────────────────────────
exports.geminiChat = functions.region("us-central1").https.onRequest(async (req, res) => {
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
    // Autenticação
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
      res.status(401).json({ error: "unauthenticated", message: "Token inválido." });
      return;
    }

    const uid = decodedToken.uid;

    // Rate limiting: 20 perguntas por dia por usuário
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const rateLimitRef = db.collection("ia_usage").doc(uid);
    const rateLimitDoc = await rateLimitRef.get();

    if (rateLimitDoc.exists) {
      const rlData = rateLimitDoc.data();
      if (rlData.date === today && rlData.count >= 20) {
        res.status(429).json({
          error: "rate-limited",
          message: "Limite diário de 20 perguntas atingido. Tente novamente amanhã.",
        });
        return;
      }
      if (rlData.date === today) {
        await rateLimitRef.update({ count: admin.firestore.FieldValue.increment(1) });
      } else {
        await rateLimitRef.set({ date: today, count: 1 });
      }
    } else {
      await rateLimitRef.set({ date: today, count: 1 });
    }

    // Parse do body
    let body = req.body || {};
    if (Buffer.isBuffer(body)) {
      try { body = JSON.parse(body.toString()); } catch { body = {}; }
    }
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const message = String(body.message || "").trim().slice(0, 1000);
    const context = String(body.context || "").trim().slice(0, 2000);

    if (!message) {
      res.status(400).json({ error: "invalid-argument", message: "Mensagem não pode ser vazia." });
      return;
    }

    const geminiKey = process.env.GEMINI_KEY;
    if (!geminiKey) {
      res.status(503).json({ error: "service-unavailable", message: "Assistente IA não configurado." });
      return;
    }

    const prompt = `Você é um assistente jurídico do sistema AssJur Flow, que auxilia a Assessoria Jurídica da 12ª Região Militar do Brasil na gestão de processos administrativos militares. Responda de forma concisa, profissional e objetiva em português brasileiro. Baseie suas respostas no contexto fornecido. Quando não tiver informação suficiente, diga claramente.

Contexto atual do sistema:
${context}

Pergunta: ${message}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errBody);
      res.status(502).json({ error: "upstream-error", message: "Erro ao consultar a IA. Tente novamente em instantes." });
      return;
    }

    const geminiData = await geminiRes.json();
    const reply =
      geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Não foi possível gerar uma resposta.";

    res.json({ ok: true, reply });
  } catch (e) {
    console.error("geminiChat unhandled error:", e.message, e.stack);
    if (!res.headersSent) {
      res.status(500).json({ error: "internal", message: e.message || "Erro interno." });
    }
  }
});