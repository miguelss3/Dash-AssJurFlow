import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { createUserWithEmailAndPassword, Auth } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card } from "./ui/card";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import type { AuthUser } from "@/hooks/useAuth";

interface Usuario extends AuthUser {
  id?: string;
  ativo?: boolean;
}

export function GestaoEquipe() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [salvando, setSalvando] = useState(false);
  
  const [formData, setFormData] = useState({
    posto: "",
    setor: "DU",
    nome: "",
    nomeGuerra: "",
    telefone: "",
    email: "",
    senha: "",
    isChefe: "Não",
  });

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    try {
      const snapshot = await getDocs(collection(db, "usuarios"));
      const lista = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Usuario[];
      setUsuarios(lista.filter((u) => u.ativo !== false));
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
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
    });
    setEditando(null);
  }

  function editarUsuario(usuario: Usuario) {
    setEditando(usuario);
    setFormData({
      posto: usuario.posto || "",
      setor: usuario.setor || "DU",
      nome: usuario.nome || "",
      nomeGuerra: usuario.nomeGuerra || "",
      telefone: usuario.telefone || "",
      email: usuario.email || "",
      senha: "", // Nunca preencher senha ao editar
      isChefe: usuario.isChefe ? "Sim" : "Não",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);

    try {
      const dadosUsuario: Partial<Usuario> = {
        posto: formData.posto,
        setor: formData.setor,
        nome: formData.nome,
        nomeGuerra: formData.nomeGuerra,
        telefone: formData.telefone,
        email: formData.email,
        isChefe: formData.isChefe === "Sim",
        role: formData.isChefe === "Sim" ? `Chefe ${formData.setor}` : "ASSESSOR",
        cargo: formData.isChefe === "Sim" ? `Chefe ${formData.setor}` : undefined,
        secao: formData.setor,
        ativo: true,
      };

      if (editando?.id) {
        // Atualizar usuário existente
        await updateDoc(doc(db, "usuarios", editando.id), dadosUsuario);
        // console.log("✅ Usuário atualizado:", formData.email);
      } else {
        // Criar novo usuário
        if (!formData.senha || formData.senha.length < 6) {
          alert("Senha deve ter no mínimo 6 caracteres");
          setSalvando(false);
          return;
        }

        // Criar conta no Firebase Auth
        try {
          const userCredential = await createUserWithEmailAndPassword(
            auth as Auth,
            formData.email,
            formData.senha
          );
          
          dadosUsuario.uid = userCredential.user.uid;
          
          // Salvar no Firestore
          await addDoc(collection(db, "usuarios"), dadosUsuario);
          // console.log("✅ Novo usuário criado:", formData.email);
        } catch (authError: any) {
          if (authError.code === "auth/email-already-in-use") {
            alert("Este email já está em uso!");
          } else {
            console.error("Erro ao criar usuário:", authError);
            alert("Erro ao criar conta de usuário. Verifique os dados.");
          }
          setSalvando(false);
          return;
        }
      }

      await carregarUsuarios();
      resetarForm();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      alert("Erro ao salvar usuário. Verifique o console.");
    } finally {
      setSalvando(false);
    }
  }

  async function removerUsuario(usuario: Usuario) {
    if (!usuario.id) return;
    
    const confirmacao = confirm(
      `Deseja realmente remover ${usuario.nome}?\n\nO usuário será marcado como inativo.`
    );
    
    if (!confirmacao) return;

    try {
      // Marcar como inativo ao invés de deletar
      await updateDoc(doc(db, "usuarios", usuario.id), { ativo: false });
      await carregarUsuarios();
      // console.log("✅ Usuário removido:", usuario.email);
    } catch (error) {
      console.error("Erro ao remover usuário:", error);
      alert("Erro ao remover usuário.");
    }
  }

  return (
    <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-3 gap-8">
      {/* Formulário */}
      <Card className="xl:col-span-1 p-6 shadow-lg h-fit xl:sticky xl:top-6">
        <div className="mb-4">
          <h3 className="font-extrabold text-lg text-foreground">
            {editando ? "Editar Integrante" : "Novo Integrante"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Os dados são salvos no banco e ficam disponíveis imediatamente na lista ao lado.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Posto / Grad
              </label>
              <select
                required
                value={formData.posto}
                onChange={(e) => setFormData({ ...formData, posto: e.target.value })}
                className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background"
              >
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
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Setor
              </label>
              <select
                value={formData.setor}
                onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
                className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background"
              >
                <option value="Chefe AsseApAssJur">Chefe AsseApAssJur</option>
                <option value="DU">DU</option>
                <option value="PA">PA</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Nome Completo
            </label>
            <Input
              required
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Ex: Miguel Silva Santos"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Nome de Guerra
              </label>
              <Input
                required
                value={formData.nomeGuerra}
                onChange={(e) => setFormData({ ...formData, nomeGuerra: e.target.value })}
                placeholder="Ex: Miguel"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
                Telefone
              </label>
              <Input
                type="tel"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                placeholder="(61) 99999-9999"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              E-mail de Acesso
            </label>
            <Input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="usuario@dominio.mil.br"
              disabled={!!editando}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              Senha Inicial
            </label>
            <Input
              type="password"
              minLength={6}
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              placeholder="Mínimo de 6 caracteres"
              required={!editando}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {editando
                ? "Deixe em branco para manter a senha atual."
                : "Obrigatória para novo usuário."}
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-muted-foreground uppercase mb-1">
              É Chefe?
            </label>
            <select
              value={formData.isChefe}
              onChange={(e) => setFormData({ ...formData, isChefe: e.target.value })}
              className="w-full border border-input rounded-xl p-2.5 text-sm outline-none bg-background"
            >
              <option value="Não">Não</option>
              <option value="Sim">Sim</option>
            </select>
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button type="submit" disabled={salvando} className="w-full">
              {salvando ? (
                "Salvando..."
              ) : editando ? (
                "Atualizar"
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Cadastrar
                </>
              )}
            </Button>
            {editando && (
              <Button
                type="button"
                variant="outline"
                onClick={resetarForm}
                className="w-full"
              >
                Cancelar Edição
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Lista de usuários */}
      <div className="xl:col-span-2 space-y-4">
        <div className="mb-4">
          <h3 className="font-bold text-lg text-foreground">
            Integrantes Cadastrados ({usuarios.length})
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Equipe da Assessoria Jurídica da 12ª RM
          </p>
        </div>

        {usuarios.length === 0 ? (
          <Card className="p-12 text-center border-2 border-dashed">
            <p className="text-sm text-muted-foreground">
              Nenhum usuário cadastrado ainda.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {usuarios.map((usuario) => (
              <Card key={usuario.id} className="p-5 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          usuario.setor === "DU"
                            ? "bg-blue-50 text-blue-700 border border-blue-200"
                            : usuario.setor === "PA"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : "bg-slate-100 text-slate-700 border border-slate-300"
                        }`}
                      >
                        {usuario.setor}
                      </span>
                      {usuario.isChefe && (
                        <span className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase bg-amber-100 text-amber-700 border border-amber-300">
                          Chefe
                        </span>
                      )}
                    </div>
                    <p className="font-extrabold text-lg text-foreground">
                      {usuario.posto} {usuario.nome}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{usuario.email}</p>
                    {usuario.telefone && (
                      <p className="text-sm text-muted-foreground">{usuario.telefone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => editarUsuario(usuario)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removerUsuario(usuario)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
