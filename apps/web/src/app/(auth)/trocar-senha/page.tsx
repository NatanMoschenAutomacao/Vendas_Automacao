import type { Metadata } from "next";
import { exigirUsuario } from "@/server/auth/dal";
import { FormTrocaSenha } from "./form";

export const metadata: Metadata = { title: "Trocar senha" };

export default async function PaginaTrocarSenha() {
  const u = await exigirUsuario({ permitirTrocaPendente: true });
  return <FormTrocaSenha obrigatoria={u.trocarSenha} nome={u.nome} />;
}
