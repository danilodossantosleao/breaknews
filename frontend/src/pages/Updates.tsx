import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, Check, Loader2, History, ExternalLink, Clock, Package } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { LibraryItem, UpdateItem, UpdatePage } from "@/lib/types";
import { UPDATE_CATEGORY_LABELS, fmtDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, RowSkeleton, SafeImage } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORIES: Record<string, string> = {
  todos: "Todas as categorias",
  patch: "Patches",
  dlc: "DLCs",
  expansao: "Expansões",
  evento: "Eventos",
  trailer: "Trailers",
};

export default function UpdatesPage() {
  const [scope, setScope] = useState<"tracked" | "all">("tracked");
  const [game, setGame] = useState("todos");
  const [category, setCategory] = useState("todos");
  const queryClient = useQueryClient();

  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet<LibraryItem[]>("/library"),
    retry: false,
  });

  const params = new URLSearchParams({ scope, page_size: "40" });
  if (game !== "todos") params.set("game_id", game);
  if (category !== "todos") params.set("category", category);

  const updates = useQuery({
    queryKey: ["updates", params.toString()],
    queryFn: () => apiGet<UpdatePage>(`/updates?${params.toString()}`),
    retry: false,
  });

  const readAll = useMutation({
    mutationFn: () => apiPost<{ updated: number }>("/updates/read-all"),
    onSuccess: (res) => {
      toast.success(`${res.updated} atualização(ões) marcada(s) como lida(s)`);
      queryClient.invalidateQueries({ queryKey: ["updates"] });
    },
    onError: () => toast.error("Não foi possível marcar todas como lidas."),
  });

  const items = updates.data?.items ?? [];
  const pending = items.filter((u) => !u.is_read).length;
  const recent = items.filter((u) => u.is_recent).length;
  const dlcCount = items.filter((u) => u.category === "dlc" || u.category === "expansao").length;

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Updates Tracker</h1>
          <p className="mt-1 text-sm text-[#9AA3B5]">
            Patches, DLCs e expansões dos seus jogos. A data exibida é a de publicação das notas, não a de
            disponibilização do conteúdo.
          </p>
        </div>
        <Button
          size="sm"
          data-testid="updates-read-all-button"
          onClick={() => readAll.mutate()}
          disabled={readAll.isPending}
          className="gap-1.5 bg-[#8B5CF6] text-xs text-white hover:bg-[#7C4DF4]"
        >
          {readAll.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
          Marcar todas como lidas
        </Button>
      </header>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Indicator label="Total catalogado" value={updates.data?.total ?? 0} tone="text-[#C7D2FE]" testid="updates-stat-total" />
        <Indicator label="Atualizações recentes" value={recent} tone="text-[#6EE7B7]" testid="updates-stat-recent" />
        <Indicator label="Aguardando leitura" value={pending} tone="text-[#FCD34D]" testid="updates-stat-pending" />
        <Indicator label="DLCs e expansões" value={dlcCount} tone="text-[#F0ABFC]" testid="updates-stat-dlc" />
      </div>

      <Tabs value={scope} onValueChange={(v) => setScope(v as "tracked" | "all")}>
        <TabsList variant="line">
          <TabsTrigger value="tracked" data-testid="updates-scope-tracked">Meus jogos</TabsTrigger>
          <TabsTrigger value="all" data-testid="updates-scope-all">Catálogo completo</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={game} onValueChange={setGame}>
          <SelectTrigger size="sm" data-testid="updates-filter-game" className="w-44 border-[#28324D] bg-[#10131D] text-xs">
            <SelectValue>
              {(v) =>
                v === "todos"
                  ? "Todos os jogos"
                  : (library.data ?? []).find((i) => i.game.id === v)?.game.title ?? "Jogo"
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os jogos</SelectItem>
            {(library.data ?? []).map((i) => (
              <SelectItem key={i.game.id} value={i.game.id}>{i.game.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger size="sm" data-testid="updates-filter-category" className="w-44 border-[#28324D] bg-[#10131D] text-xs">
            <SelectValue>{(v) => CATEGORIES[v as string] ?? "Categoria"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {updates.isLoading && <div className="space-y-2.5">{[0, 1, 2, 3].map((i) => <RowSkeleton key={i} />)}</div>}

      {updates.isError && (
        <EmptyState title="Updates indisponíveis" description="Não foi possível carregar o histórico agora." />
      )}

      {!updates.isLoading && !updates.isError && items.length === 0 && (
        <EmptyState
          icon={<History size={30} />}
          title="Nenhuma atualização catalogada"
          description={
            scope === "tracked"
              ? "Adicione jogos à biblioteca ou veja o catálogo completo para acompanhar patches."
              : "Nenhum patch registrado no catálogo ainda."
          }
        />
      )}

      <div className="space-y-3" data-testid="updates-list">
        {items.map((item) => <UpdateRow key={item.id} item={item} />)}
      </div>
    </div>
  );
}

function Indicator({ label, value, tone, testid }: { label: string; value: number; tone: string; testid: string }) {
  return (
    <div data-testid={testid} className="rounded-xl border border-[#1A2033] bg-[#10131D] p-3.5">
      <p className={cn("font-heading text-2xl font-bold", tone)}>{value}</p>
      <p className="mt-0.5 text-[11px] text-[#9AA3B5]">{label}</p>
    </div>
  );
}

function UpdateRow({ item }: { item: UpdateItem }) {
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: () => apiPost(`/updates/${item.id}/read`, { is_read: !item.is_read }),
    onSuccess: () => {
      toast.success(item.is_read ? "Marcada como não lida" : "Marcada como lida");
      queryClient.invalidateQueries({ queryKey: ["updates"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
    onError: () => toast.error("Não foi possível atualizar o estado."),
  });

  return (
    <article
      data-testid={`update-card-${item.id}`}
      className={cn(
        "flex gap-3.5 rounded-xl border bg-[#10131D] p-4 transition-colors",
        item.is_read ? "border-[#1A2033] opacity-85" : "border-[#28324D] hover:border-[#8B5CF6]/40",
      )}
    >
      <Link to={`/game/${item.game_id}`} className="shrink-0" data-testid={`update-game-link-${item.id}`}>
        <SafeImage
          src={item.game_cover}
          alt={item.game_title ?? ""}
          fallbackLabel={(item.game_title ?? "NX").slice(0, 2)}
          className="h-20 w-14 rounded object-cover"
        />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.version ? (
            <span className="rounded bg-[#171B29] px-1.5 py-0.5 font-mono text-[10px] text-[#67E8F9]">
              {item.version}
            </span>
          ) : (
            <span className="font-mono text-[10px] text-[#9AA3B5]">Versão não informada</span>
          )}
          <Badge variant="outline" className="border-[#28324D] text-[10px] text-[#9AA3B5]">
            {UPDATE_CATEGORY_LABELS[item.category] ?? item.category}
          </Badge>
          {item.is_recent && <Badge className="bg-[#10B981] text-[10px] text-white">Atualização recente</Badge>}
          {(item.category === "dlc" || item.category === "expansao") && (
            <Badge variant="outline" className="border-[#8B5CF6]/40 text-[10px] text-[#F0ABFC]">
              <Package size={10} className="mr-1" /> Nova DLC
            </Badge>
          )}
          {!item.is_read && (
            <Badge variant="outline" className="border-[#F59E0B]/40 text-[10px] text-[#FCD34D]">
              Aguardando leitura
            </Badge>
          )}
        </div>

        <h3 className="mt-2 font-heading text-[15px] font-semibold text-[#F4F5FA]">{item.title}</h3>
        <Link
          to={`/game/${item.game_id}`}
          className="font-mono text-[10px] text-[#C7D2FE] hover:text-[#8B5CF6]"
        >
          {item.game_title ?? "Jogo não informado"}
        </Link>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#9AA3B5]">{item.summary || "Resumo não informado."}</p>

        {item.highlights.length > 0 && (
          <ul className="mt-2 space-y-1">
            {item.highlights.map((h, i) => (
              <li key={i} className="flex gap-2 text-xs text-[#C8CEDC]">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#22D3EE]" />
                {h}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 font-mono text-[10px] text-[#9AA3B5]">
            <Clock size={10} /> Publicado {fmtDate(item.published_at)} · {timeAgo(item.published_at)}
          </span>
          <Button
            variant="ghost"
            size="sm"
            data-testid={`update-read-${item.id}`}
            onClick={() => toggle.mutate()}
            disabled={toggle.isPending}
            className={cn("gap-1.5 px-2 text-xs", item.is_read ? "text-[#6EE7B7]" : "text-[#9AA3B5]")}
          >
            {toggle.isPending ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            {item.is_read ? "Lida" : "Marcar lida"}
          </Button>
          {item.patch_notes_url ? (
            <Button
              variant="ghost"
              size="sm"
              data-testid={`update-notes-${item.id}`}
              className="gap-1.5 px-2 text-xs text-[#22D3EE]"
              render={
                <a href={item.patch_notes_url} target="_blank" rel="noopener noreferrer nofollow">
                  <ExternalLink size={12} /> Notas oficiais
                </a>
              }
            />
          ) : (
            <span className="font-mono text-[10px] text-[#9AA3B5]">Notas oficiais não informadas</span>
          )}
        </div>
      </div>
    </article>
  );
}
