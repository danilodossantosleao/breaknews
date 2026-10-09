import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Zap, Loader2, ArrowRight, Newspaper, CalendarDays, LibraryBig } from "lucide-react";
import { ApiError, apiPost } from "@/lib/api";
import type { UserOut } from "@/lib/types";
import { beginSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1601042879364-f3947d3f9c16?auto=format&fit=crop&w=1400&q=80";

function errMessage(err: unknown, fallback: string) {
  if (err instanceof ApiError) {
    const detail = (err.body as { detail?: unknown })?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) return "Verifique os campos informados.";
  }
  return fallback;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh bg-[#080A10] lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 size-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-linear-to-br from-[#080A10]/80 via-[#10131D]/70 to-[#8B5CF6]/25" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-[#8B5CF6] to-[#22D3EE] shadow-[0_0_24px_rgba(139,92,246,0.5)]">
              <Zap size={22} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <span className="neon-text font-heading text-2xl font-bold">NEXUS</span>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#9AA3B5]">Gaming Hub</p>
            </div>
          </div>
          <div className="max-w-md space-y-5">
            <h1 className="font-heading text-4xl leading-tight font-bold text-white">
              Seu universo gamer.
              <br />
              <span className="neon-text">Em um só lugar.</span>
            </h1>
            <p className="text-[#C8CEDC]">
              Notícias, atualizações e descobertas dos jogos que fazem parte da sua coleção — sem navegar entre
              dezenas de sites.
            </p>
            <ul className="space-y-2.5 text-sm text-[#9AA3B5]">
              {[
                { icon: LibraryBig, text: "Biblioteca pessoal com status, notas e tags" },
                { icon: Newspaper, text: "Feed consolidado com fontes oficiais e imprensa" },
                { icon: CalendarDays, text: "Calendário de lançamentos, DLCs e eventos" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2.5">
                  <Icon size={15} className="shrink-0 text-[#22D3EE]" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-[#9AA3B5]">
            Catálogo em modo demonstração · dados pessoais sempre privados
          </p>
        </div>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<UserOut>("/auth/login", body),
    onSuccess: (user) => {
      beginSession();
      toast.success(`Bem-vindo de volta, ${user.display_name}!`);
      navigate(user.onboarding_done ? "/" : "/onboarding", { replace: true });
    },
    onError: (err) => toast.error(errMessage(err, "Não foi possível entrar agora.")),
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ email: email.trim(), password });
  };

  const loginDemo = () => mutation.mutate({ email: "demo@nexus.gg", password: "nexus123" });

  return (
    <AuthShell>
      <div className="mb-7 lg:hidden">
        <span className="neon-text font-heading text-2xl font-bold">NEXUS</span>
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#9AA3B5]">Gaming Hub</p>
      </div>
      <h2 className="font-heading text-2xl font-bold text-[#F4F5FA]">Entrar na sua central</h2>
      <p className="mt-1.5 mb-6 text-sm text-[#9AA3B5]">Acompanhe os jogos que importam para você.</p>

      <form onSubmit={submit} className="space-y-4" data-testid="login-form">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            data-testid="login-email-input"
            className="bg-[#10131D]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <Input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••"
            data-testid="login-password-input"
            className="bg-[#10131D]"
          />
        </div>
        <Button
          type="submit"
          disabled={mutation.isPending}
          data-testid="login-submit-button"
          className="w-full gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
        >
          {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          Entrar
        </Button>
      </form>

      <Button
        variant="outline"
        onClick={loginDemo}
        disabled={mutation.isPending}
        data-testid="login-demo-button"
        className="mt-3 w-full border-[#28324D] text-[#C8CEDC]"
      >
        Entrar com a conta de demonstração
      </Button>

      <p className="mt-6 text-center text-sm text-[#9AA3B5]">
        Ainda não tem conta?{" "}
        <Link to="/register" data-testid="link-register" className="font-medium text-[#22D3EE] hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthShell>
  );
}

export function RegisterPage() {
  const [form, setForm] = useState({ display_name: "", email: "", password: "" });
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: () => apiPost<UserOut>("/auth/register", { ...form, email: form.email.trim() }),
    onSuccess: (user) => {
      beginSession();
      toast.success(`Conta criada. Vamos configurar sua central, ${user.display_name}!`);
      navigate("/onboarding", { replace: true });
    },
    onError: (err) => toast.error(errMessage(err, "Não foi possível criar a conta.")),
  });

  return (
    <AuthShell>
      <h2 className="font-heading text-2xl font-bold text-[#F4F5FA]">Criar sua conta NEXUS</h2>
      <p className="mt-1.5 mb-6 text-sm text-[#9AA3B5]">Leva menos de um minuto para montar sua central gamer.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
        className="space-y-4"
        data-testid="register-form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="name">Nome de exibição</Label>
          <Input
            id="name"
            required
            minLength={2}
            value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })}
            placeholder="Seu gamertag"
            data-testid="register-name-input"
            className="bg-[#10131D]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="remail">E-mail</Label>
          <Input
            id="remail"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="voce@email.com"
            data-testid="register-email-input"
            className="bg-[#10131D]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rpassword">Senha</Label>
          <Input
            id="rpassword"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="mínimo de 6 caracteres"
            data-testid="register-password-input"
            className="bg-[#10131D]"
          />
        </div>
        <Button
          type="submit"
          disabled={mutation.isPending}
          data-testid="register-submit-button"
          className="w-full gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
        >
          {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
          Criar conta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-[#9AA3B5]">
        Já tem conta?{" "}
        <Link to="/login" data-testid="link-login" className="font-medium text-[#22D3EE] hover:underline">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
