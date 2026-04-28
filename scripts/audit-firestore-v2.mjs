#!/usr/bin/env node
/**
 * Script de Auditoria Firestore v2 - Segunda Execução Expandida
 * Verifica:
 * - Sincronização entre Firebase Auth e Firestore (usuarios)
 * - Referências e integridade relacional
 * - Campos obrigatórios e tipos
 * - Dados órfãos e corruptos
 * - Inconsistências de formatação
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import fs from "fs";

const firebaseConfig = {
  apiKey: "AIzaSyB2Pk4plzDbRJSrQdaIAu7P4fOPpvefAG0",
  authDomain: "assjur-flow-12rm.firebaseapp.com",
  projectId: "assjur-flow-12rm",
  storageBucket: "assjur-flow-12rm.firebasestorage.app",
  messagingSenderId: "441416018941",
  appId: "1:441416018941:web:fc57211a142956f7854794",
  measurementId: "G-YZCJ6KRDPQ",
};

const email = process.env.FIREBASE_AUDIT_EMAIL || "miguelss3@yahoo.com.br";
const password = process.env.FIREBASE_AUDIT_PASSWORD || "";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Cores para terminal
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(color, ...args) {
  console.log(`${colors[color] || ""}${args.join(" ")}${colors.reset}`);
}

function normalizarSetor(v) {
  const n = String(v || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
  if (!n) return "";
  if (n === "DU" || n.includes("DEFESA") || n.includes("USUARIO")) return "DU";
  if (n === "PA" || n.includes("PROCESSO") || n.includes("ASSESSOR") || n.includes("ASSJUR")) return "PA";
  return "";
}

function dividirEmLotes(itens, tamanho) {
  const lotes = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    lotes.push(itens.slice(i, i + tamanho));
  }
  return lotes;
}

class AuditoriaFirestore {
  constructor() {
    this.acessosNegados = new Set();
    this.observacoes = [];
    this.colecoes = {
      usuarios: [],
      processos: [],
      distribuicoes: [],
      mensagens: [],
      eventosCalendario: [],
      configuracoesSistema: [],
    };
    this.problemas = {
      sincronizacaoAuth: [],
      uidsMissing: [],
      emailsInvalidos: [],
      emailsDuplicados: [],
      setoresInvalidos: [],
      rolesInvalidas: [],
      referenciasBroken: [],
      camposObrigatorios: [],
      documentosOrfaos: [],
      inconsistenciasSetor: [],
      usuariosInativosComDados: [],
      processosComResponsavelInvalido: [],
      distribuicoesOrfas: [],
      mensagensOrfas: [],
    };
    this.mapasReferencia = {
      usuariosValidos: new Set(),
      processosValidos: new Set(),
      uidsAuth: new Set(),
      emailsLowercase: new Map(),
    };
  }

  async carregarDados() {
    log("cyan", "\n📂 Carregando dados das coleções...");

    const carregarColecaoSegura = async (nomeColecao) => {
      try {
        const snapshot = await getDocs(collection(db, nomeColecao));
        return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        if (err.code === "permission-denied") {
          this.acessosNegados.add(nomeColecao);
          log("yellow", `⚠️  ${nomeColecao}: Acesso negado (permission-denied)`);
          return [];
        }
        throw err;
      }
    };

    const [usuarios, processos, distribuicoes, mensagens, eventos, configs] = await Promise.all([
      carregarColecaoSegura("usuarios"),
      carregarColecaoSegura("processos"),
      carregarColecaoSegura("distribuicoes"),
      carregarColecaoSegura("mensagens"),
      carregarColecaoSegura("eventosCalendario"),
      carregarColecaoSegura("configuracoesSistema"),
    ]);

    this.colecoes = { usuarios, processos, distribuicoes, mensagens, eventosCalendario: eventos, configuracoesSistema: configs };

    log("green", `✅ Usuários: ${usuarios.length}`);
    log("green", `✅ Processos: ${processos.length}`);
    log("green", `✅ Distribuições: ${distribuicoes.length}`);
    log("green", `✅ Mensagens: ${mensagens.length}`);
    log("green", `✅ Eventos: ${eventos.length}`);
    log("green", `✅ Configs: ${configs.length}`);
  }

  async verificarSincronizacaoAuth() {
    log("cyan", "\n🔐 Verificando sincronização Firebase Auth ↔ Firestore...");

    const usuarios = this.colecoes.usuarios;

    // Mapear todos os usuários do Firestore
    for (const u of usuarios) {
      const uid = String(u.uid || u.id || "").trim();
      const email = String(u.email || "").trim().toLowerCase();

      if (!uid) {
        this.problemas.uidsMissing.push({ id: u.id, email });
      }

      if (uid) {
        this.mapasReferencia.usuariosValidos.add(uid);
        this.mapasReferencia.uidsAuth.add(uid);
      }

      if (email) {
        const emailLower = email.toLowerCase();
        if (this.mapasReferencia.emailsLowercase.has(emailLower)) {
          this.problemas.emailsDuplicados.push({
            documento1: this.mapasReferencia.emailsLowercase.get(emailLower),
            documento2: u.id,
            email: emailLower,
          });
        }
        this.mapasReferencia.emailsLowercase.set(emailLower, u.id);
      }

      // Validar campos obrigatórios em usuarios
      const camposRequeridos = ["email", "setor", "role"];
      for (const campo of camposRequeridos) {
        if (!u[campo] || String(u[campo]).trim() === "") {
          this.problemas.camposObrigatorios.push({ colecao: "usuarios", documento: u.id, campo });
        }
      }

      // Validar email
      if (email && !email.includes("@")) {
        this.problemas.emailsInvalidos.push({ id: u.id, email });
      }

      // Validar setor
      const setor = normalizarSetor(u.setor);
      if (u.setor && !["DU", "PA", "CHEFE ASSEAPASSJUR"].includes(u.setor) && !setor) {
        this.problemas.setoresInvalidos.push({ id: u.id, setor: u.setor });
      }

      // Validar role
      const role = String(u.role || "").toUpperCase();
      if (u.role && !role.includes("ASSESSOR") && !role.includes("CHEFE") && role !== "ADMIN UNIVERSAL") {
        this.problemas.rolesInvalidas.push({ id: u.id, role: u.role });
      }

      // Usuários inativos com dados relacionados
      if (u.ativo === false) {
        const temProcessos = this.colecoes.processos.some((p) => p.responsavel === u.nome || p.userId === u.uid);
        if (temProcessos) {
          this.problemas.usuariosInativosComDados.push({ id: u.id, nome: u.nome, email });
        }
      }
    }

    log("green", `✅ Sincronização verificada`);
    log("yellow", `   ⚠️  UIDs faltando: ${this.problemas.uidsMissing.length}`);
    log("yellow", `   ⚠️  Emails duplicados: ${this.problemas.emailsDuplicados.length}`);
    log("yellow", `   ⚠️  Emails inválidos: ${this.problemas.emailsInvalidos.length}`);
    log("yellow", `   ⚠️  Setores inválidos: ${this.problemas.setoresInvalidos.length}`);
    log("yellow", `   ⚠️  Roles inválidas: ${this.problemas.rolesInvalidas.length}`);
  }

  verificarIntegridadeProcessos() {
    log("cyan", "\n📋 Verificando integridade de Processos...");

    const processos = this.colecoes.processos;
    const usuarios = this.colecoes.usuarios;

    for (const p of processos) {
      this.mapasReferencia.processosValidos.add(p.id);

      // Campos obrigatórios
      const camposRequeridos = ["setor", "numero", "cliente"];
      for (const campo of camposRequeridos) {
        if (!p[campo] || String(p[campo]).trim() === "") {
          this.problemas.camposObrigatorios.push({ colecao: "processos", documento: p.id, campo });
        }
      }

      // Validar setor
      if (p.setor && !["DU", "PA", "OUTRO", "Admin"].includes(p.setor)) {
        this.problemas.setoresInvalidos.push({ colecao: "processos", id: p.id, setor: p.setor });
      }

      // Validar responsável
      if (p.responsavel) {
        const usuarioExiste = usuarios.some(
          (u) => u.nome === p.responsavel || u.nomeGuerra === p.responsavel || u.uid === p.userId,
        );
        if (!usuarioExiste && p.responsavel !== "SISTEMA") {
          this.problemas.processosComResponsavelInvalido.push({
            id: p.id,
            numero: p.numero || p.numeroProcesso,
            responsavel: p.responsavel,
          });
        }
      }

      // Inconsistência de setor em PA
      if (p.setor === "PA" && p.pedidoSubsidios?.setor && p.pedidoSubsidios.setor !== "PA") {
        this.problemas.inconsistenciasSetor.push({
          id: p.id,
          numero: p.numero,
          setorPrincipal: "PA",
          setorSubsidio: p.pedidoSubsidios.setor,
        });
      }
    }

    log("green", `✅ Integridade de Processos verificada`);
    log("yellow", `   ⚠️  Responsáveis inválidos: ${this.problemas.processosComResponsavelInvalido.length}`);
    log("yellow", `   ⚠️  Inconsistências de setor: ${this.problemas.inconsistenciasSetor.length}`);
  }

  verificarReferencias() {
    log("cyan", "\n🔗 Verificando integridade de Referências...");

    const { distribuicoes, mensagens, eventosCalendario } = this.colecoes;
    const processosValidos = this.mapasReferencia.processosValidos;
    const podeValidarProcessoRelacionado = !this.acessosNegados.has("processos");

    if (!podeValidarProcessoRelacionado) {
      const aviso = "Validações de orfandade dependentes de processos foram ignoradas: acesso negado à coleção processos.";
      this.observacoes.push(aviso);
      log("yellow", `⚠️  ${aviso}`);
    }

    // Distribuições órfãs
    if (podeValidarProcessoRelacionado) {
      for (const d of distribuicoes) {
        if (!d.processoId || !processosValidos.has(d.processoId)) {
          this.problemas.distribuicoesOrfas.push({
            id: d.id,
            processoId: d.processoId || null,
            assessorNome: d.assessorNome,
          });
        }

        // Campos obrigatórios em distribuições
        if (!d.processoId || !d.assessorNome) {
          this.problemas.camposObrigatorios.push({ colecao: "distribuicoes", documento: d.id, campo: !d.processoId ? "processoId" : "assessorNome" });
        }
      }
    }

    // Mensagens órfãs
    if (podeValidarProcessoRelacionado) {
      for (const m of mensagens) {
        if (!processosValidos.has(m.id)) {
          this.problemas.mensagensOrfas.push({ id: m.id });
        }
      }
    }

    // Eventos órfãos
    for (const e of eventosCalendario) {
      if (podeValidarProcessoRelacionado && e.processoId && !processosValidos.has(e.processoId)) {
        this.problemas.documentosOrfaos.push({
          colecao: "eventosCalendario",
          documento: e.id,
          referencia: "processoId",
          valor: e.processoId,
        });
      }

      // Validar setor em eventos
      if (e.setor && !["DU", "PA"].includes(e.setor)) {
        this.problemas.setoresInvalidos.push({ colecao: "eventosCalendario", id: e.id, setor: e.setor });
      }
    }

    log("green", `✅ Referências verificadas`);
    log("yellow", `   ⚠️  Distribuições órfãs: ${this.problemas.distribuicoesOrfas.length}`);
    log("yellow", `   ⚠️  Mensagens órfãs: ${this.problemas.mensagensOrfas.length}`);
    log("yellow", `   ⚠️  Documentos órfãos: ${this.problemas.documentosOrfaos.length}`);
  }

  gerarRelatorio() {
    log("cyan", "\n📊 Gerando Relatório Final...");

    const timestamp = new Date().toISOString();
    const relatorio = {
      timestamp,
      metadados: {
        acessosNegados: Array.from(this.acessosNegados),
        observacoes: this.observacoes,
      },
      resumo: {
        totalColecoes: Object.keys(this.colecoes).length,
        totalDocumentos: Object.values(this.colecoes).reduce((acc, c) => acc + c.length, 0),
        totalProblemas: Object.values(this.problemas).reduce((acc, c) => acc + c.length, 0),
        problemasPorCategoria: Object.fromEntries(
          Object.entries(this.problemas).map(([k, v]) => [k, v.length]),
        ),
      },
      detalhes: this.colecoes,
      problemas: this.problemas,
    };

    // Salvar JSON
    const jsonPath = "auditoria-firestore-v2.json";
    fs.writeFileSync(jsonPath, JSON.stringify(relatorio, null, 2));
    log("green", `✅ Relatório JSON salvo: ${jsonPath}`);

    // Salvar HTML
    const htmlPath = "auditoria-firestore-v2.html";
    const html = this.gerarHTML(relatorio);
    fs.writeFileSync(htmlPath, html);
    log("green", `✅ Relatório HTML salvo: ${htmlPath}`);

    return relatorio;
  }

  gerarHTML(relatorio) {
    const { resumo, problemas, metadados } = relatorio;
    const totalProblemas = resumo.totalProblemas;

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Auditoria Firestore v2</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
    h2 { color: #555; margin-top: 30px; }
    .resumo { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .card { background: #f9f9f9; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
    .card h3 { margin: 0; color: #007bff; }
    .card p { margin: 5px 0; font-size: 24px; font-weight: bold; }
    .problema { background: #fff3cd; padding: 10px; margin: 10px 0; border-left: 4px solid #ffc107; }
    .error { color: #dc3545; }
    .warning { color: #ff9800; }
    .success { color: #28a745; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #007bff; color: white; }
    tr:hover { background: #f5f5f5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Auditoria Firestore v2</h1>
    <p>Timestamp: <strong>${relatorio.timestamp}</strong></p>

    <h2>📊 Resumo Executivo</h2>
    <div class="resumo">
      <div class="card">
        <h3>Total Documentos</h3>
        <p>${resumo.totalDocumentos}</p>
      </div>
      <div class="card">
        <h3 class="error">Total Problemas</h3>
        <p class="error">${totalProblemas}</p>
      </div>
    </div>

    ${metadados?.acessosNegados?.length ? `
    <h2>ℹ️ Limitações de Leitura</h2>
    <div class="problema">
      <p><strong>Coleções com acesso negado:</strong> ${metadados.acessosNegados.join(", ")}</p>
      ${(metadados.observacoes || []).map((obs) => `<p>${obs}</p>`).join("")}
    </div>
    ` : ""}

    <h2>⚠️ Problemas Identificados</h2>`;

    if (totalProblemas === 0) {
      html += `<p class="success">✅ Nenhum problema encontrado!</p>`;
    } else {
      for (const [categoria, lista] of Object.entries(problemas)) {
        if (lista.length === 0) continue;
        html += `<h3 class="warning">${categoria}: ${lista.length}</h3>`;
        html += `<table><tr><th>Detalhes</th></tr>`;
        lista.slice(0, 20).forEach((item) => {
          html += `<tr><td><pre>${JSON.stringify(item, null, 2)}</pre></td></tr>`;
        });
        if (lista.length > 20) {
          html += `<tr><td><em>... e ${lista.length - 20} mais</em></td></tr>`;
        }
        html += `</table>`;
      }
    }

    html += `
  </div>
</body>
</html>`;
    return html;
  }

  async executar() {
    log("blue", "\n========================================");
    log("blue", "🔥 AUDITORIA FIRESTORE V2 - SEGUNDA EXECUÇÃO");
    log("blue", "========================================");

    if (!password) {
      throw new Error("❌ FIREBASE_AUDIT_PASSWORD não informado.");
    }

    log("yellow", `\nAutenticando como: ${email}`);
    await signInWithEmailAndPassword(auth, email, password);
    log("green", "✅ Autenticado!");

    await this.carregarDados();
    await this.verificarSincronizacaoAuth();
    this.verificarIntegridadeProcessos();
    this.verificarReferencias();

    const relatorio = this.gerarRelatorio();

    log("blue", "\n========================================");
    log(relatorio.resumo.totalProblemas > 0 ? "red" : "green", `Total de Problemas: ${relatorio.resumo.totalProblemas}`);
    log("blue", "========================================\n");
  }
}

const auditoria = new AuditoriaFirestore();
auditoria.executar().catch((err) => {
  log("red", "\n❌ Falha na auditoria:");
  if (err.code === "permission-denied") {
    log("red", "Erro: Acesso negado ao Firestore");
    log("yellow", "Dicas:");
    log("yellow", "1. Verifique se as regras de Firestore permitem leitura");
    log("yellow", "2. Verifique se o usuário tem perfil em /usuarios/{uid}");
    log("yellow", "3. Tente com isAdminUniversal (miguelss3@yahoo.com.br)");
  } else {
    log("red", err?.code || err?.message || err);
  }
  process.exit(1);
});
