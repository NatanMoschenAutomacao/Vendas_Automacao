"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function LinkNav({
  href,
  exato,
  children,
  className,
}: {
  href: string;
  exato?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const caminho = usePathname();
  const ativo = exato ? caminho === href : caminho === href || caminho.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={ativo ? "page" : undefined}
      className={cn(
        "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        ativo ? "bg-marca-50 text-marca-700" : "text-gray-600 hover:bg-gray-50 hover:text-grafite-800",
        className,
      )}
    >
      {children}
    </Link>
  );
}
