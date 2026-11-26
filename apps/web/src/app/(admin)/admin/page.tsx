import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CabecalhoDePagina, Card, Badge } from "@/ui/card";
import { SECOES_ADMIN } from "@/features/secoes-admin";

export default function VisaoGeralAdmin() {
  return (
    <>
      <CabecalhoDePagina
        titulo="Administração"
        descricao="Toda a inteligência técnica do configurador é cadastrada aqui."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {SECOES_ADMIN.map((s) =>
          s.href ? (
            <Link key={s.titulo} href={s.href} className="group">
              <Card className="h-full p-5 transition-colors group-hover:border-marca-500">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-grafite-900">{s.titulo}</h2>
                  <ArrowRight className="size-4 text-gray-300 group-hover:text-marca-600" />
                </div>
                <p className="mt-1 text-sm text-gray-500">{s.descricao}</p>
              </Card>
            </Link>
          ) : (
            <Card key={s.titulo} className="h-full bg-gray-50/50 p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-400">{s.titulo}</h2>
                <Badge>Fase {String(s.fase).padStart(2, "0")}</Badge>
              </div>
              <p className="mt-1 text-sm text-gray-400">{s.descricao}</p>
            </Card>
          ),
        )}
      </div>
    </>
  );
}
