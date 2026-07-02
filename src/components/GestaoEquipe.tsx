import { useState, useEffect } from "react";
import { collection, getDocs, updateDoc, doc, deleteField, setDoc } from "firebase/firestore";
import { updateEmail } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { useAuth, type AuthUser } from "@/hooks/useAuth";
import { nomeMilitarUsuario } from "@/lib/userProfiles";

const PALETA_CORES = [
  "#b91c1c",
  "#c2410c",
  "#FFD400",
  "#4d7c0f",
  "#047857",
  "#0e7490",
  "#1d4ed8",
  "#a21caf",
  "#be185d",
  "#334155",
];

// Paleta(s) anterior(es). Usada para migrar automaticamente os assessores
// que já tinham escolhido uma cor antes dos ajustes de contraste — sem
// isso, quem já tinha cor definida continuaria vendo o tom antigo até
// reabrir e reselecionar manualmente. Inclui a paleta original (mais clara)
// e a intermediária (roxo/violeta muito parecido com o azul), ambas
// convergindo para a paleta atual.
const PALETA_CORES_ANTIGA: Record<string, string> = {
  "#ef4444": "#b91c1c",
  "#f97316": "#c2410c",
  "#eab308": "#FFD400",
  "#a16207": "#FFD400", // amarelo intermediário, escuro/amarronzado demais
  "#84cc16": "#4d7c0f",
  "#10b981": "#047857",
  "#06b6d4": "#0e7490",
  "#3b82f6": "#1d4ed8",
  "#8b5cf6": "#a21caf",
  "#6d28d9": "#a21caf", // roxo intermediário, muito parecido com o azul
  "#ec4899": "#be185d",
  "#64748b": "#334155",
};

interface Usuario extends AuthUser {
  id?: string;
  ativo?: boolean;
  dataCadastro?: string;
  atualizadoEm?: string;
  corCard?: string;
}

export function GestaoEquipe() {
  const { user: usuarioLogado } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroCarregarUsuarios, setErroCarregarUsuarios] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    posto: "",
    setor: "DU",
    nome: "",
    nomeGuerra: "",
    telefone: "",
    email: "",
    senha: "",
    isChefe: "Não",
    corCard: "",
  });

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    try {
      setErroCarregarUsuarios(null);
      const snapshot = await getDocs(collection(db, "usuarios"));
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Usuario[];

      // Migra silenciosamente quem ainda está com uma cor da paleta antiga
      // (mais clara) para o tom mais forte equivalente, preservando a cor
      // de cada assessor.
      const paraMigrar = lista.filter((u) => u.corCard && PALETA_CORES_ANTIGA[u.corCard]);
      if (paraMigrar.length > 0) {
        await Promise.all(
          paraMigrar.map(async (u) => {
            const corNova = PALETA_CORES_ANTIGA[u.corCard as string];
            u.corCard = corNova;
            if (!u.id) return;
            try {
              await updateDoc(doc(db, "usuarios", u.id), { corCard: corNova });
            } catch (err) {
              console.error(`Erro ao migrar cor do usuário ${u.id}:`, err);
            }
          }),
        );
      }

      setUsuarios(lista.filter((u) => u.ativo !== false));
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      setErroCarregarUsuarios("Acesso restrito ao Administrador.");
      toast.error("Erro de permissão: Acesso recusado pelo servidor.");
    }
  }

  function resetarForm() {
    setFormData({
      posto: "",
      setor: "DU",
      nome: "",
      nomeGuerra: "",
      telefone: "",
      email: "",
      senha: "",
      isChefe: "Não",
      corCard: "",
    });
    setEditando(null);
  }

  function editarUsuario(usuario: Usuario) {
    setEditando(usuario);
    setFormData({
      posto: usuario.posto || "",
      setor: usuario.setor || "DU",
      nome: usuario.nome || "",
      nomeGuerra: usuario.nomeGuerra || "", // CORREÇÃO: Removido a propriedade fantasma 'text'
      telefone: usuario.telefone || "",
      email: usuario.email || "",
      senha: "",
      isChefe: usuario.isChefe ? "Sim" : "Não",
      corCard: usuario.corCard || "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    try {
      const agoraISO = new Date().toISOString();
      const dadosUsuario: Partial<Usuario> = {
        posto: formData.posto,
        setor: formData.setor,
        nome: formData.nome,
        nomeGuerra: formData.nomeGuerra,
        telefone: formData.telefone,
        email: formData.email.trim().toLowerCase(),
        isChefe: formData.isChefe === "Sim",
        role: formData.isChefe === "Sim" ? `Chefe ${formData.setor}` : "ASSESSOR",
        cargo: formData.isChefe === "Sim" ? `Chefe ${formData.setor}` : deleteField() as unknown as string,
        secao: formData.setor,
        ativo: true,
        atualizadoEm: agoraISO,
        corCard: formData.corCard || (deleteField() as unknown as string),
      };

      if (editando?.id) {
        const emailAnterior = String(editando.email || "").trim().toLowerCase();
        const emailNovo = formData.email.trim().toLowerCase();
        const mudouEmail = !!emailNovo && emailNovo !== emailAnterior;

        if (mudouEmail) {
          const uidEditado = editando.uid;
          const uidLogado = auth.currentUser?.uid || usuarioLogado?.uid;
          const emailLogado = String(auth.currentUser?.email || usuarioLogado?.email || "").trim().toLowerCase();
          const ehProprioPerfil = (
            !!uidEditado
            && !!uidLogado
            && uidEditado === uidLogado
          ) || (
            !!emailAnterior
            && !!emailLogado
            && emailAnterior === emailLogado
          );

          if (!ehProprioPerfil) {
            alert("Alteração de e-mail de outro usuário não é permitida por aqui.");
            setSalvando(false);
            return;
          }

          if (auth.currentUser) {
            try {
              await updateEmail(auth.currentUser, emailNovo);
            } catch (authError: unknown) {
              const err = authError as { code?: string };
              if (err.code === "auth/requires-recent-login") {
                alert("Para alterar seu e-mail de acesso, faça login novamente.");
              } else {
                alert("Não foi possível atualizar o e-mail de acesso.");
              }
              setSalvando(false);
              return;
            }
          }
        }

        const uidCanonico = String(editando.uid || editando.id || "").trim();
        if (!uidCanonico) {
          alert("Usuário sem UID válido.");
          setSalvando(false);
          return;
        }

        const dadosCanonicos: Partial<Usuario> = {
          ...dadosUsuario,
          uid: uidCanonico,
          dataCadastro: editando.dataCadastro || agoraISO,
        };

        await setDoc(doc(db, "usuarios", uidCanonico), dadosCanonicos, { merge: true });

        if (editando.id !== uidCanonico) {
          await updateDoc(doc(db, "usuarios", editando.id), {
            ativo: false,
            atualizadoEm: agoraISO,
            migradoParaUid: uidCanonico,
          });
        }
      } else {
        if (!formData.senha || formData.senha.length < 6) {
          alert("Senha deve ter no mínimo 6 caracteres");
          setSalvando(false);
          return;
        }

        try {
          const tokenAdmin = await auth.currentUser?.getIdToken();
          if (!tokenAdmin) {
            alert("Sessão expirada. Faça login novamente.");
            setSalvando(false);
            return;
          }

          const nomeExibicao = String(dadosUsuario.nome || "").trim() || formData.email;

          const response = await fetch("/api/criarUsuarioAdmin", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${tokenAdmin}`,
            },
            body: JSON.stringify({
              email: formData.email,
              senha: formData.senha,
              nomeExibicao,
            }),
          });

          const payload = await response.json().catch(() => ({}));

          if (!response.ok || !payload.ok || !payload.uid) {
            alert("Erro ao criar conta de usuário. Verifique os dados.");
            setSalvando(false);
            return;
          }

          dadosUsuario.uid = payload.uid;
          dadosUsuario.dataCadastro = agoraISO;

          await setDoc(doc(db, "usuarios", payload.uid), dadosUsuario, { merge: true });
        } catch (authError: unknown) {
          alert("Erro ao criar conta de usuário.");
          setSalvando(false);
          return;
        }
      }

      await carregarUsuarios();
      resetarForm();
    } catch (error) {
      alert("Erro ao salvar usuário.");
    } finally {
      setSalvando(false);
    }
  }

  async function removerUsuario(usuario: Usuario) {
    if (!usuario.id) return;
    const uidUsuario = String(usuario.uid || usuario.id || "").trim();
    const uidLogado = String(auth.currentUser?.uid || usuarioLogado?.uid || "").trim();

    if (uidUsuario && uidLogado && uidUsuario === uidLogado) {
      toast.error("Autoexclusão não é permitida por esta tela.");
      return;
    }

    const confirmado = window.confirm(`Confirmar remoção de ${usuario.nome}?`);
    if (!confirmado) return;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("unauthenticated");

      const response = await fetch("/api/deleteUserAccount", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ uid: uidUsuario || undefined, email: usuario.email || undefined }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        console.error("deleteUserAccount error:", response.status, errorBody);
        throw new Error(errorBody.message || `Erro ${response.status} ao remover`);
      }

      await carregarUsuarios();
      toast.success(`${usuario.nome} removido.`);
    } catch {
      try {
        await updateDoc(doc(db, "usuarios", usuario.id), {
          ativo: false,
          excluidoEm: new Date().toISOString(),
          excluidoPorUid: uidLogado || null,
        });
        await carregarUsuarios();
        toast.warning(`${usuario.nome} foi desativado.`);
      } catch {
        toast.error("Erro ao remover usuário.");
      }
    }
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* FORMULÁRIO */}
      <Card className="xl:col-span-1 p-6 shadow-lg h-fit xl:sticky xl:top-6">
        <div className="mb-4">
          <h3 className="font-extrabold text-lg text-foreground">
            {editando ? "Editar Integrante" : "Novo Integrante"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Gestão de acessos da equipe AssJur.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Posto / Grad</label>
              <select required value={formData.posto} onChange={(e) => setFormData({ ...formData, posto: e.target.value })} className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background">
                <option value="" disabled>---</option>
                <option value="Sgt">Sgt</option>
                <option value="Ten">Ten</option>
                <option value="Cap">Cap</option>
                <option value="Maj">Maj</option>
                <option value="TC">TC</option>
                <option value="Cel">Cel</option>
                <option value="Civil">Civil</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Setor</label>
              <select value={formData.setor} onChange={(e) => setFormData({ ...formData, setor: e.target.value })} className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background">
                <option value="Chefe AsseApAssJur">Chefe AsseApAssJur</option>
                <option value="DU">DU</option>
                <option value="PA">PA</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Nome Completo</label>
            <Input required value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} placeholder="Ex: Miguel Silva Santos" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Nome de Guerra</label>
              <Input required value={formData.nomeGuerra} onChange={(e) => setFormData({ ...formData, nomeGuerra: e.target.value })} placeholder="Ex: Miguel" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Telefone</label>
              {/* CORREÇÃO: Removida a propriedade fantasma 'telephone' do payload do setFormData */}
              <Input type="tel" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} placeholder="(92) 99999-9999" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">E-mail de Acesso</label>
            <Input type="email" required value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="usuario@dominio.mil.br" />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">Senha Inicial</label>
            <Input type="password" autoComplete="current-password" minLength={6} value={formData.senha} onChange={(e) => setFormData({ ...formData, senha: e.target.value })} placeholder="Mínimo de 6 caracteres" required={!editando} />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">É Chefe?</label>
            <select value={formData.isChefe} onChange={(e) => setFormData({ ...formData, isChefe: e.target.value })} className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background">
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-2">Cor de Destaque do Card</label>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setFormData({ ...formData, corCard: "" })} className={`h-8 rounded-lg px-2 text-[11px] font-semibold border transition-colors ${!formData.corCard ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}>Padrão</button>
              {PALETA_CORES.map((cor) => (
                <button key={cor} type="button" onClick={() => setFormData({ ...formData, corCard: cor })} className={`h-8 w-8 rounded-full border-2 transition-transform ${formData.corCard === cor ? "border-slate-900 scale-110" : "border-white"}`} style={{ backgroundColor: cor }} />
              ))}
            </div>
          </div>

          <Button type="submit" disabled={salvando} className="w-full">
            {salvando ? "Salvando..." : editando ? "Atualizar" : "Cadastrar"}
          </Button>
          {editando && <Button type="button" variant="outline" onClick={resetarForm} className="w-full">Cancelar</Button>}
        </form>
      </Card>

      {/* LISTAGEM BLINDADA CONTRA QUEDAS */}
      <div className="xl:col-span-2 space-y-4">
        <div className="mb-4">
          <h3 className="font-bold text-lg text-foreground">Integrantes Cadastrados ({usuarios.length})</h3>
          <p className="text-xs text-muted-foreground mt-1">Membros com permissões ativas no sistema.</p>
        </div>

        {erroCarregarUsuarios ? (
          <Card className="p-12 text-center border-2 border-dashed border-destructive/30 bg-destructive/5">
            <p className="text-sm text-destructive font-bold">{erroCarregarUsuarios}</p>
            <p className="text-xs text-muted-foreground mt-2">Apenas chefias autorizadas ou administradores possuem credenciais de consulta a este painel.</p>
          </Card>
        ) : usuarios.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed">
            <p className="text-sm text-muted-foreground">Nenhum usuário cadastrado ainda ou buscando dados...</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {usuarios.map((usuario) => (
              <Card key={usuario.id} className="p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${usuario.setor === "DU" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-purple-50 text-purple-700 border border-purple-200"}`}>{usuario.setor}</span>
                      {usuario.isChefe && <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-300">Chefe</span>}
                      {/* RESTAURAÇÃO: Renderiza novamente a bolinha com a cor do assessor */}
                      {usuario.corCard && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider border border-slate-300 bg-slate-50 text-slate-700">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: usuario.corCard }} />
                          Cor Card
                        </span>
                      )}
                    </div>
                    <p className="font-extrabold text-lg text-foreground">
                      {(() => {
                        try {
                          return nomeMilitarUsuario(usuario) || usuario.nome || "Integrante";
                        } catch {
                          return usuario.nome || "Integrante";
                        }
                      })()}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{usuario.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => editarUsuario(usuario)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => removerUsuario(usuario)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default GestaoEquipe;