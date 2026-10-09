import { Link } from "react-router-dom";
import { Zap, Home, LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-5 bg-[#080A10] px-5 text-center">
      <div className="relative">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-linear-to-br from-[#8B5CF6] to-[#22D3EE] shadow-[0_0_30px_rgba(139,92,246,0.5)]">
          <Zap size={26} className="text-white" strokeWidth={2.5} />
        </div>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-[#22D3EE]">Erro 404 · sinal perdido</p>
      <h1 className="font-heading text-5xl font-bold text-[#F4F5FA] md:text-6xl">
        <span className="neon-text">404</span>
      </h1>
      <p className="max-w-md text-sm text-[#9AA3B5]">
        A página que você tentou acessar não existe nesta central. Verifique o endereço ou volte ao comando
        principal.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2.5">
        <Button
          data-testid="notfound-home-button"
          className="gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
          render={<Link to="/"><Home size={15} /> Voltar ao Dashboard</Link>}
        />
        <Button
          variant="outline"
          data-testid="notfound-library-button"
          className="gap-2 border-[#28324D] text-[#C8CEDC]"
          render={<Link to="/library"><LibraryBig size={15} /> Minha Biblioteca</Link>}
        />
      </div>
    </div>
  );
}
