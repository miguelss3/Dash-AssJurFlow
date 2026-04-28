const admin = require("firebase-admin");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

admin.initializeApp();

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAILS = new Set(["miguelss3@yahoo.com.br"]);

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
  const uid = String(data?.uid || "").trim();
  const email = String(data?.email || "").trim().toLowerCase();

  if (uid) {
    return { uid, userRecord: await auth.getUser(uid) };
  }

  if (email) {
    const userRecord = await auth.getUserByEmail(email);
    return { uid: userRecord.uid, userRecord };
  }

  throw new HttpsError("invalid-argument", "UID ou email do usuário são obrigatórios.");
}

exports.deleteUserAccount = onCall({ region: "us-central1" }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Usuário não autenticado.");
  }

  const callerUid = request.auth.uid;
  const callerEmail = String(request.auth.token.email || "").trim().toLowerCase();
  const callerProfile = await loadCallerProfile(callerUid, callerEmail);

  if (!profileIndicatesAdmin(callerProfile, callerEmail)) {
    throw new HttpsError("permission-denied", "Somente perfis administrativos podem excluir usuários.");
  }

  const { uid, userRecord } = await resolveTargetUser(request.data);

  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "Autoexclusão não é permitida.");
  }

  await auth.deleteUser(uid);

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
    email: String(userRecord.email || request.data?.email || "").trim().toLowerCase() || null,
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

  const emailAlvo = String(userRecord.email || request.data?.email || "").trim().toLowerCase();
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

  return { ok: true, uid };
});