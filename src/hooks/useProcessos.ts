import { useState, useEffect } from "react";
import { collection, query, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase"; // Aponta para o arquivo que criamos no Passo 1

// Define a estrutura do seu Processo baseada no seu banco real
export interface Processo {
  id: string;
  nup: string;
  interessado: string;
  assunto?: string;
  status?: string; 
  prazoFatal?: string;
  tipo?: string; 
  // O [key: string] permite que o TypeScript aceite outros campos (ex: dataCriacao, responsavel)
  [key: string]: any; 
}

export function useProcessos() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    // Aponta para a coleção "processos" real da 12ª RM no Firestore
    const processosRef = collection(db, "processos");
    
    // Inicia a query. Como combinamos, aqui estamos puxando TODOS os dados reais.
    const q = query(processosRef);

    // O onSnapshot fica "ouvindo" o banco. Qualquer mudança reflete na tela na hora.
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const listaProcessos: Processo[] = [];
        snapshot.forEach((doc) => {
          listaProcessos.push({ id: doc.id, ...doc.data() } as Processo);
        });
        
        setProcessos(listaProcessos);
        setCarregando(false);
      },
      (err) => {
        console.error("Erro ao buscar processos do Firebase:", err);
        setErro(err.message);
        setCarregando(false);
      }
    );

    // Desliga o ouvinte quando o usuário sai da tela, economizando memória
    return () => unsubscribe();
  }, []);

  return { processos, carregando, erro };
}