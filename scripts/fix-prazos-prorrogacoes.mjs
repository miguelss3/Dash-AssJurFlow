import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { format, parseISO } from 'date-fns';

const firebaseConfig = {
  apiKey: "AIzaSyB2Pk4plzDbRJSrQdaIAu7P4fOPpvefAG0",
  authDomain: "assjur-flow-12rm.firebaseapp.com",
  projectId: "assjur-flow-12rm",
  storageBucket: "assjur-flow-12rm.firebasestorage.app",
  messagingSenderId: "441416018941",
  appId: "1:441416018941:web:6b2e7c46e9b9bfef6c9e4e",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Configurações de prazos padrão
const DEFAULT_PROCESSUAL_DEADLINES = {
  prazoIPMInicialDias: 40,
  prazoIPMProrrogacaoDias: 20,
  prazoSindicanciaInicialDias: 30,
  prazoSindicanciaProrrogacaoDias: 20,
  prazoConselhoInicialDias: 30,
  prazoConselhoProrrogacaoDias: 20,
};

function obterRegraPrazoPA(tipoPA) {
  if (tipoPA === "IPM") {
    return {
      diasIniciais: DEFAULT_PROCESSUAL_DEADLINES.prazoIPMInicialDias,
      diasProrrogacao: DEFAULT_PROCESSUAL_DEADLINES.prazoIPMProrrogacaoDias,
    };
  }
  if (tipoPA === "Sindicância" || tipoPA === "Sindicancia") {
    return {
      diasIniciais: DEFAULT_PROCESSUAL_DEADLINES.prazoSindicanciaInicialDias,
      diasProrrogacao: DEFAULT_PROCESSUAL_DEADLINES.prazoSindicanciaProrrogacaoDias,
    };
  }
  return {
    diasIniciais: DEFAULT_PROCESSUAL_DEADLINES.prazoConselhoInicialDias,
    diasProrrogacao: DEFAULT_PROCESSUAL_DEADLINES.prazoConselhoProrrogacaoDias,
  };
}

function normalizarDataPrazoPA(valor) {
  if (!valor) return undefined;
  const texto = String(valor).trim();
  if (!texto) return undefined;
  const prefixoData = texto.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  if (prefixoData) return prefixoData;
  try {
    const data = parseISO(texto);
    if (Number.isNaN(data.getTime())) return undefined;
    return format(data, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

function calcularPrazoFinalPA(params) {
  const { tipoPA, dataInicioPrazo, dataAssinatura, prorrogacoes } = params;
  const dataBase =
    normalizarDataPrazoPA(dataInicioPrazo) ||
    (tipoPA === "Conselho de Disciplina" || tipoPA === "Conselho de Justificação"
      ? normalizarDataPrazoPA(dataAssinatura)
      : undefined);

  if (!dataBase) return undefined;

  const { diasIniciais, diasProrrogacao } = obterRegraPrazoPA(tipoPA);
  const diasExtras = (prorrogacoes || []).reduce((total, item) => {
    const dias = item?.dias;
    return total + (typeof dias === "number" && Number.isFinite(dias) ? dias : diasProrrogacao);
  }, 0);

  try {
    const dataFinal = parseISO(`${dataBase}T00:00:00`);
    if (Number.isNaN(dataFinal.getTime())) return undefined;
    dataFinal.setDate(dataFinal.getDate() + diasIniciais + diasExtras - 1);
    return format(dataFinal, "yyyy-MM-dd");
  } catch {
    return undefined;
  }
}

async function corrigirPrazos() {
  console.log("🔍 Buscando processos PA com prorrogações...");
  
  try {
    const processosRef = collection(db, "processos");
    const snapshot = await getDocs(processosRef);
    
    let totalProcessos = 0;
    let processosCorrigidos = 0;
    
    for (const docSnap of snapshot.docs) {
      const procData = docSnap.data();
      const prorrogacoes = Array.isArray(procData.prorrogacoes) ? procData.prorrogacoes : [];
      
      // Só processa PA com prorrogações
      if (procData.setor !== "PA" || prorrogacoes.length === 0) {
        continue;
      }
      
      totalProcessos++;
      
      const dataInicio = procData.dataInicioPrazo || "";
      const dataAssin = procData.dataAssinatura || "";
      
      const prazoCalculado = calcularPrazoFinalPA({
        tipoPA: procData.tipoPA,
        dataInicioPrazo: dataInicio,
        dataAssinatura: dataAssin,
        prorrogacoes,
      });
      
      if (!prazoCalculado) {
        console.log(`⚠️  ${procData.numeroProcesso}: não foi possível calcular prazo`);
        continue;
      }
      
      const prazoAtual = procData.prazoFatal || procData.finalPrazo;
      
      if (prazoAtual !== prazoCalculado) {
        console.log(`📝 ${procData.numeroProcesso} (${procData.tipoPA})`);
        console.log(`   Prorrogações: ${prorrogacoes.length}`);
        console.log(`   Prazo anterior: ${prazoAtual}`);
        console.log(`   Prazo calculado: ${prazoCalculado}`);
        
        try {
          const processoRef = doc(db, "processos", docSnap.id);
          await updateDoc(processoRef, {
            prazoFatal: prazoCalculado,
            finalPrazo: prazoCalculado,
            atualizadoEm: Timestamp.now(),
          });
          processosCorrigidos++;
          console.log(`   ✅ Atualizado!\n`);
        } catch (updateError) {
          console.log(`   ❌ Erro ao atualizar: ${updateError.message}\n`);
        }
      }
    }
    
    console.log(`\n📊 Resumo:`);
    console.log(`   Processos PA com prorrogações: ${totalProcessos}`);
    console.log(`   Prazos corrigidos: ${processosCorrigidos}`);
    console.log(`   ✅ Script finalizado!`);
    
  } catch (error) {
    console.error("❌ Erro ao corrigir prazos:", error);
    process.exit(1);
  }
  
  process.exit(0);
}

corrigirPrazos();
