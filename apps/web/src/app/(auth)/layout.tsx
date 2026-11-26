import { Logo } from "@/ui/logo";

export default function LayoutAuth({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-gray-50 px-4 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        {children}
      </div>
    </main>
  );
}
