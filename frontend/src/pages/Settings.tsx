import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Loader2, LogOut, Sun, Moon, RefreshCw, Database, Sparkles } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { SyncLogOut, UserOut } from "@/lib/types";
import { useAIStatus, useMe } from "@/hooks/useMe";
import { endSession } from "@/lib/session";
import {
  FREQUENCY_LABELS, GENRE_OPTIONS, PLATFORM_OPTIONS, fmtDateTime, initials,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function SettingsPage() {
  const { data: me } = useMe();
  const ai = useAIStatus();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    display_name: "",
    avatar_url: "",
    theme: "dark",
    notification_frequency: "diario",
    favorite_platforms: [] as string[],
    favorite_genres: [] as string[],
  });

  useEffect(() => {
    if (me) {
      setForm({
        display_name: me.display_name,
        avatar_url: me.avatar_url ?? "",
        theme: me.theme,
        notification_frequency: me.notification_frequency,
        favorite_platforms: me.favorite_platforms,
        favorite_genres: me.favorite_genres,
      });
      document.documentElement.classList.toggle("dark", me.theme !== "light");
      document.documentElement.classList.toggle("light", me.theme === "light");
    }
  }, [me?.id, me?.theme]);

  const lastSync = useQuery({
    queryKey: ["sync-last"],
    queryFn: () => apiGet<SyncLogOut | null>("/sync/last"),
    retry: false,
  });

  const save = useMutation({
    mutationFn: () =>
      apiPatch<UserOut>("/auth/profile", {
        display_name: form.display_name,
        avatar_url: form.avatar_url || null,
        theme: form.theme,
        notification_frequency: form.notification_frequency,
        favorite_platforms: form.favorite_platforms,
        favorite_genres: form.favorite_genres,
      }),
    onSuccess: (user) => {
      toast.success("Preferências salvas");
      document.documentElement.classList.toggle("dark", user.theme !== "light");
      document.documentElement.classList.toggle("light", user.theme === "light");
      queryClient.invalidateQueries({ queryKey: ["me"] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
    },
    onError: () => toast.error("Não foi possível salvar suas preferências."),
  });

  const sync = useMutation({
    mutationFn: () => apiPost<SyncLogOut>("/sync"),
    onSuccess: (log) => {
      toast.success(
        log.demo_fallback
          ? "Nenhuma fonte externa respondeu — conteúdo demo mantido"
          : `${log.items_inserted} novo(s) item(ns) de ${log.sources_ok} fonte(s)`,
      );
      queryClient.invalidateQueries();
    },
    onError: () => toast.error("Sincronização indisponível agora."),
  });

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

  return (
    <div className="max-w-3xl space-y-6 animate-fade-up">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Perfil e Configurações</h1>
        <p className="mt-1 text-sm text-[#9AA3B5]">
          Suas preferências ficam salvas na conta e são aplicadas ao entrar novamente.
        </p>
      </header>

      {/* Perfil */}
      <section className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-5">
        <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Perfil</h2>
        <div className="mt-4 flex items-start gap-4">
          <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#8B5CF6]/50 bg-[#171B29] font-heading text-lg font-bold text-[#C7D2FE]">
            {form.avatar_url ? (
              <img src={form.avatar_url} alt="" className="size-full object-cover" onError={() => setForm({ ...form, avatar_url: "" })} />
            ) : (
              initials(form.display_name)
            )}
          </div>
          <div className="flex-1 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="display_name">Nome de exibição</Label>
              <Input
                id="display_name"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                data-testid="settings-name-input"
                className="border-[#28324D] bg-[#0B0E17]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="avatar">URL do avatar (https)</Label>
              <Input
                id="avatar"
                value={form.avatar_url}
                onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                placeholder="https://…"
                data-testid="settings-avatar-input"
                className="border-[#28324D] bg-[#0B0E17]"
              />
            </div>
            <p className="font-mono text-[10px] text-[#9AA3B5]">
              E-mail da conta: {me?.email ?? "—"} · idioma: português (Brasil)
            </p>
          </div>
        </div>
      </section>

      {/* Aparência */}
      <section className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-5">
        <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Aparência</h2>
        <p className="mt-1 mb-3 text-xs text-[#9AA3B5]">O tema escuro é a identidade padrão do NEXUS.</p>
        <div className="flex gap-2">
          <Button
            variant={form.theme === "dark" ? "default" : "outline"}
            size="sm"
            data-testid="settings-theme-dark"
            onClick={() => setForm({ ...form, theme: "dark" })}
            className={cn("gap-1.5 text-xs", form.theme === "dark" ? "bg-[#8B5CF6] text-white" : "border-[#28324D]")}
          >
            <Moon size={13} /> Escuro
          </Button>
          <Button
            variant={form.theme === "light" ? "default" : "outline"}
            size="sm"
            data-testid="settings-theme-light"
            onClick={() => setForm({ ...form, theme: "light" })}
            className={cn("gap-1.5 text-xs", form.theme === "light" ? "bg-[#8B5CF6] text-white" : "border-[#28324D]")}
          >
            <Sun size={13} /> Claro
          </Button>
        </div>
      </section>

      {/* Preferências de jogo */}
      <section className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-5">
        <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Preferências de jogos</h2>
        <p className="mt-1 mb-4 text-xs text-[#9AA3B5]">Usadas para montar as recomendações da página Explorar.</p>

        <Label className="mb-2 block">Plataformas favoritas</Label>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {PLATFORM_OPTIONS.map((p) => (
            <Chip
              key={p}
              label={p}
              active={form.favorite_platforms.includes(p)}
              testid={`settings-platform-${p}`}
              onClick={() => setForm({ ...form, favorite_platforms: toggleIn(form.favorite_platforms, p) })}
            />
          ))}
        </div>

        <Label className="mb-2 block">Gêneros favoritos</Label>
        <div className="flex flex-wrap gap-1.5">
          {GENRE_OPTIONS.map((g) => (
            <Chip
              key={g}
              label={g}
              active={form.favorite_genres.includes(g)}
              testid={`settings-genre-${g}`}
              onClick={() => setForm({ ...form, favorite_genres: toggleIn(form.favorite_genres, g) })}
            />
          ))}
        </div>
      </section>

      {/* Notificações */}
      <section className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-5">
        <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Notificações</h2>
        <p className="mt-1 mb-3 text-xs text-[#9AA3B5]">
          Frequência geral dos alertas internos. Ajustes por categoria ficam na página Notificações.
        </p>
        <Select
          value={form.notification_frequency}
          onValueChange={(v) => setForm({ ...form, notification_frequency: v })}
        >
          <SelectTrigger data-testid="settings-frequency-select" className="w-56 border-[#28324D] bg-[#0B0E17]">
            <SelectValue>{(v) => FREQUENCY_LABELS[v as string] ?? "Frequência"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      {/* Dados e integrações */}
      <section className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-5">
        <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Dados e integrações</h2>
        <div className="mt-3 space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] p-3">
            <Database size={14} className="text-[#A78BFA]" />
            <span className="flex-1 text-[#C8CEDC]">Catálogo de jogos</span>
            <Badge variant="outline" className="border-[#F59E0B]/40 text-[10px] text-[#FCD34D]" data-testid="settings-catalog-mode">
              Modo demonstração
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] p-3">
            <RefreshCw size={14} className="text-[#67E8F9]" />
            <span className="flex-1 text-[#C8CEDC]">
              Fontes de notícias (feeds RSS oficiais e imprensa)
              <br />
              <span className="font-mono text-[10px] text-[#9AA3B5]" data-testid="settings-last-sync">
                {lastSync.data?.finished_at
                  ? `Última sincronização ${fmtDateTime(lastSync.data.finished_at)} · ${lastSync.data.items_inserted} novos · status ${lastSync.data.status}`
                  : "Nenhuma sincronização registrada"}
              </span>
            </span>
            <Button
              variant="outline"
              size="sm"
              data-testid="settings-sync-button"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              className="gap-1.5 border-[#28324D] text-xs"
            >
              {sync.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sincronizar agora
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#1A2033] bg-[#0B0E17] p-3">
            <Sparkles size={14} className="text-[#22D3EE]" />
            <span className="flex-1 text-[#C8CEDC]">Resumos por IA</span>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px]",
                ai.data?.enabled ? "border-[#10B981]/40 text-[#6EE7B7]" : "border-[#28324D] text-[#9AA3B5]",
              )}
              data-testid="settings-ai-status"
            >
              {ai.data?.enabled ? "Ativo" : "Não configurado"}
            </Badge>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button
          data-testid="settings-save-button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
        >
          {save.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Salvar preferências
        </Button>
        <Button
          variant="outline"
          data-testid="settings-logout-button"
          onClick={() => endSession()}
          className="gap-2 border-[#EF4444]/40 text-[#FCA5A5]"
        >
          <LogOut size={15} /> Sair da conta
        </Button>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
  testid,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testid: string;
}) {
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F4F5FA]"
          : "border-[#28324D] bg-[#0B0E17] text-[#9AA3B5] hover:border-[#8B5CF6]/50 hover:text-[#F4F5FA]",
      )}
    >
      {label}
    </button>
  );
}
