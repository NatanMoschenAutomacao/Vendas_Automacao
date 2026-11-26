import type { Metadata } from "next";
import { FormLogin } from "./form";

export const metadata: Metadata = { title: "Entrar" };

export default function PaginaLogin() {
  return <FormLogin />;
}
