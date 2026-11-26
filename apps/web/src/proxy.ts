import { NextResponse, type NextRequest } from "next/server";

// Verificação otimista: só confere se o cookie existe, para mandar quem não
// está logado direto ao login. A verificação real (assinatura, usuário ativo,
// permissão) acontece no servidor, em src/server/auth/dal.ts.
const ROTAS_PUBLICAS = ["/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const temSessao = request.cookies.has("zv_sessao");
  if (!temSessao && !ROTAS_PUBLICAS.includes(pathname)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp)$).*)"],
};
