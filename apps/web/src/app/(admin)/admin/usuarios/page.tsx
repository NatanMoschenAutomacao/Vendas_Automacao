import type { Metadata } from "next";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { ROTULO_PERFIL } from "@/server/auth/permissions";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";
import { AcoesUsuario, FormNovoUsuario } from "@/features/usuarios/componentes";

export const metadata: Metadata = { title: "Usuários" };

export default async function PaginaUsuarios() {
  const eu = await exigirPermissaoNaPagina("usuarios:gerenciar");
  const usuarios = await db.usuario.findMany({
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: { id: true, usuario: true, nome: true, perfil: true, ativo: true, trocarSenha: true, bloqueadoAte: true },
  });
  const agora = new Date();
  return (
    <>
      <CabecalhoDePagina
        titulo="Usuários"
        descricao="Não há cadastro aberto: somente o administrador técnico cria contas."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
        <Card className="divide-y divide-gray-100">
          {usuarios.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={u.ativo ? "font-medium text-grafite-800" : "text-gray-400"}>{u.nome}</span>
                  {u.id === eu.id && <Badge tom="marca">Você</Badge>}
                  {!u.ativo && <Badge>Desativado</Badge>}
                  {u.trocarSenha && u.ativo && <Badge tom="aviso">Senha temporária</Badge>}
                  {u.bloqueadoAte && u.bloqueadoAte > agora && <Badge tom="aviso">Bloqueado</Badge>}
                </div>
                <p className="text-xs text-gray-500">
                  {u.usuario} · {ROTULO_PERFIL[u.perfil]}
                </p>
              </div>
              <AcoesUsuario id={u.id} perfil={u.perfil} ativo={u.ativo} eu={u.id === eu.id} />
            </div>
          ))}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Novo usuário</h2>
          <FormNovoUsuario />
        </Card>
      </div>
    </>
  );
}
