import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Trash2, Heart, Plus, Save, Loader2, ExternalLink, CalendarDays,
  History, Package, Newspaper, Bookmark, Gamepad2, Clock,
} from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import type { EventItem, GameDetailOut, LibraryItem, NewsPage, UpdatePage } from "@/lib/types";
import {
  EVENT_TYPE_LABELS, RELEASE_STATUS_LABELS, STATUS_LABELS, UPDATE_CATEGORY_LABELS,
  fmtDate, timeAgo,
} from "@/lib/format";
import { CardSkeleton, EmptyState, RatingInput, SafeImage, StatusBadge } from "@/components/common";
import { NewsRow } from "@/components/NewsCard";
import { CatalogCard } from "@/components/GameCards";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const LIB_KEYS = ["library", "dashboard-summary", "explore"];

export default function GameDetailPage() {
  const { gameId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const game = useQuery({
    queryKey: ["game", gameId],
    queryFn: () => apiGet<GameDetailOut>(`/games/${gameId}`),
    retry: false,
  });
  const library = useQuery({
    queryKey: ["library"],
    queryFn: () => apiGet<LibraryItem[]>("/library"),
    retry: false,
  });
  const news = useQuery({
    queryKey: ["game-news", gameId],
    queryFn: () => apiGet<NewsPage>(`/news?game_id=${gameId}&page_size=12`),
    retry: false,
    enabled: !!gameId,
  });
  const updates = useQuery({
    queryKey: ["game-updates", gameId],
    queryFn: () => apiGet<UpdatePage>(`/updates?game_id=${gameId}&page_size=20`),
    retry: false,
    enabled: !!gameId,
  });
  const events = useQuery({
    queryKey: ["game-events", gameId],
    queryFn: () => apiGet<EventItem[]>("/events?upcoming=true"),
    retry: false,
    enabled: !!gameId,
  });

  const libItem = (library.data ?? []).find((i) => i.game.id === gameId);
  const ownedIds = new Set((library.data ?? []).map((i) => i.game.id));

  // Estado local do painel pessoal
  const [form, setForm] = useState({
    status: "quero_jogar",
    platform: "",
    personal_rating: null as number | null,
    personal_notes: "",
    started_at: "",
    completed_at: "",
    hours_played: "",
    tags: "",
  });

  useEffect(() => {
    if (libItem) {
      setForm({
        status: libItem.status,
        platform: libItem.platform ?? "",
        personal_rating: libItem.personal_rating,
        personal_notes: libItem.personal_notes ?? "",
        started_at: libItem.started_at ?? "",
        completed_at: libItem.completed_at ?? "",
        hours_played: libItem.hours_played != null ? String(libItem.hours_played) : "",
        tags: libItem.tags.join(", "),
      });
    }
  }, [libItem?.id, libItem?.updated_at]);

  const addMutation = useMutation({
    mutationFn: () => apiPost<LibraryItem>("/library", { game_id: gameId, status: "quero_jogar" }),
    onSuccess: () => {
      toast.success("Jogo adicionado à biblioteca");
      LIB_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
    onError: () => toast.error("Não foi possível adicionar agora."),
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      apiPatch<LibraryItem>(`/library/${libItem!.id}`, {
        status: form.status,
        platform: form.platform || null,
        personal_rating: form.personal_rating,
        personal_notes: form.personal_notes || null,
        started_at: form.started_at || null,
        completed_at: form.completed_at || null,
        hours_played: form.hours_played ? Number(form.hours_played) : null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Informações pessoais salvas");
      LIB_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
    onError: () => toast.error("Não foi possível salvar as alterações."),
  });

  const favMutation = useMutation({
    mutationFn: () => apiPatch<LibraryItem>(`/library/${libItem!.id}`, { is_favorite: !libItem!.is_favorite }),
    onSuccess: (updated) => {
      toast.success(updated.is_favorite ? "Marcado como favorito" : "Removido dos favoritos");
      LIB_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
    },
  });

  const removeMutation = useMutation({
    mutationFn: () => apiDelete(`/library/${libItem!.id}`),
    onSuccess: () => {
      toast.success("Jogo removido da biblioteca");
      LIB_KEYS.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      navigate("/library");
    },
    onError: () => toast.error("Não foi possível remover agora."),
  });

  if (game.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-56 animate-pulse rounded-2xl bg-[#10131D]" />
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <CardSkeleton key={i} />)}</div>
      </div>
    );
  }

  if (game.isError || !game.data) {
    return (
      <EmptyState
        icon={<Gamepad2 size={32} />}
        title="Jogo não encontrado"
        description="O título não existe no catálogo ou foi removido."
        action={
          <Button variant="outline" className="mt-2 border-[#28324D]" render={<Link to="/library">Voltar à biblioteca</Link>} />
        }
      />
    );
  }

  const g = game.data;
  const gameEvents = (events.data ?? []).filter((e) => e.game_id === gameId);
  const dlcs = (updates.data?.items ?? []).filter((u) => u.category === "dlc" || u.category === "expansao");
  const patches = (updates.data?.items ?? []).filter((u) => u.category !== "dlc" && u.category !== "expansao");
  const savedNews = (news.data?.items ?? []).filter((n) => n.saved);

  return (
    <div className="space-y-6 animate-fade-up">
      <Button
        variant="ghost"
        size="sm"
        data-testid="game-back-button"
        className="gap-1.5 text-xs text-[#9AA3B5]"
        render={<Link to="/library"><ArrowLeft size={14} /> Voltar à biblioteca</Link>}
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-2xl border border-[#1A2033]">
        <SafeImage
          src={g.background_url}
          alt=""
          className="absolute inset-0 size-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-linear-to-t from-[#080A10] via-[#080A10]/85 to-[#080A10]/40" />
        <div className="relative flex flex-col gap-5 p-5 md:flex-row md:p-7">
          <SafeImage
            src={g.cover_url}
            alt={g.title}
            fallbackLabel={g.title.slice(0, 2)}
            className="h-56 w-40 shrink-0 self-start rounded-xl border border-[#28324D] object-cover shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-[#22D3EE]/40 text-[10px] text-[#67E8F9]">
                {RELEASE_STATUS_LABELS[g.release_date_status] ?? g.release_date_status}
              </Badge>
              {g.franchise && (
                <Badge variant="outline" className="border-[#8B5CF6]/40 text-[10px] text-[#C7D2FE]">
                  {g.franchise}
                </Badge>
              )}
              {g.is_free && <Badge className="bg-[#10B981] text-[10px] text-white">Gratuito</Badge>}
            </div>
            <h1 className="mt-2.5 font-heading text-2xl font-bold text-[#F4F5FA] md:text-3xl" data-testid="game-title">
              {g.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#C8CEDC]">{g.description}</p>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <Meta label="Lançamento" value={fmtDate(g.release_date)} />
              <Meta label="Desenvolvedora" value={g.developer ?? "Não informado"} />
              <Meta label="Publicadora" value={g.publisher ?? "Não informado"} />
              <Meta label="Gêneros" value={g.genres.join(", ") || "Não informado"} />
            </dl>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {g.platforms.map((p) => (
                <span key={p} className="rounded border border-[#22D3EE]/25 bg-[#0E7490]/20 px-2 py-0.5 font-mono text-[10px] text-[#67E8F9]">
                  {p}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {libItem ? (
                <>
                  <StatusBadge status={libItem.status} />
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="game-favorite-button"
                    onClick={() => favMutation.mutate()}
                    className="gap-1.5 border-[#28324D] text-xs"
                  >
                    <Heart size={13} className={libItem.is_favorite ? "fill-[#8B5CF6] text-[#8B5CF6]" : ""} />
                    {libItem.is_favorite ? "Favorito" : "Favoritar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="game-remove-button"
                    onClick={() => setConfirmOpen(true)}
                    className="gap-1.5 border-[#EF4444]/40 text-xs text-[#FCA5A5]"
                  >
                    <Trash2 size={13} /> Remover da biblioteca
                  </Button>
                </>
              ) : (
                <Button
                  size="sm"
                  data-testid="game-add-button"
                  onClick={() => addMutation.mutate()}
                  disabled={addMutation.isPending}
                  className="gap-1.5 bg-[#8B5CF6] text-xs text-white hover:bg-[#7C4DF4]"
                >
                  {addMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Adicionar à biblioteca
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                disabled
                data-testid="game-trailer-button"
                className="gap-1.5 text-xs text-[#9AA3B5]"
                title="Trailer não informado pela fonte"
              >
                <ExternalLink size={13} /> Trailer não informado
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Painel pessoal */}
      {libItem && (
        <section className="rounded-2xl border border-[#1A2033] bg-[#10131D] p-5" data-testid="game-personal-panel">
          <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">Meu progresso</h2>
          <p className="mt-1 mb-4 text-xs text-[#9AA3B5]">
            Dados pessoais e privados. Horas jogadas são informadas manualmente — não há sincronização com plataformas.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Status pessoal</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger data-testid="game-status-select" className="border-[#28324D] bg-[#0B0E17]">
                    <SelectValue>{(v) => STATUS_LABELS[v as string] ?? "Status"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Plataforma em que jogo</Label>
                <Select value={form.platform || "nao_informado"} onValueChange={(v) => setForm({ ...form, platform: v === "nao_informado" ? "" : v })}>
                  <SelectTrigger data-testid="game-platform-select" className="border-[#28324D] bg-[#0B0E17]">
                    <SelectValue>{(v) => (v === "nao_informado" ? "Não informado" : (v as string))}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao_informado">Não informado</SelectItem>
                    {g.platforms.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="started">Comecei em</Label>
                  <Input
                    id="started"
                    type="date"
                    value={form.started_at}
                    onChange={(e) => setForm({ ...form, started_at: e.target.value })}
                    data-testid="game-started-input"
                    className="border-[#28324D] bg-[#0B0E17]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="finished">Terminei em</Label>
                  <Input
                    id="finished"
                    type="date"
                    value={form.completed_at}
                    onChange={(e) => setForm({ ...form, completed_at: e.target.value })}
                    data-testid="game-completed-input"
                    className="border-[#28324D] bg-[#0B0E17]"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hours">Tempo jogado (horas, manual)</Label>
                <Input
                  id="hours"
                  type="number"
                  min={0}
                  step="0.5"
                  value={form.hours_played}
                  onChange={(e) => setForm({ ...form, hours_played: e.target.value })}
                  placeholder="Não informado"
                  data-testid="game-hours-input"
                  className="border-[#28324D] bg-[#0B0E17]"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nota pessoal</Label>
                <div className="rounded-lg border border-[#28324D] bg-[#0B0E17] p-3">
                  <RatingInput value={form.personal_rating} onChange={(v) => setForm({ ...form, personal_rating: v })} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tags">Tags personalizadas (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  value={form.tags}
                  onChange={(e) => setForm({ ...form, tags: e.target.value })}
                  placeholder="co-op, platina, rejogar"
                  data-testid="game-tags-input"
                  className="border-[#28324D] bg-[#0B0E17]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Comentários privados</Label>
                <Textarea
                  id="notes"
                  rows={4}
                  value={form.personal_notes}
                  onChange={(e) => setForm({ ...form, personal_notes: e.target.value })}
                  placeholder="Anotações só suas sobre este jogo…"
                  data-testid="game-notes-input"
                  className="border-[#28324D] bg-[#0B0E17]"
                />
              </div>
            </div>
          </div>
          <Button
            data-testid="game-save-button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="mt-4 gap-2 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar alterações
          </Button>
        </section>
      )}

      {/* Abas do miniportal */}
      <Tabs defaultValue="news">
        <TabsList variant="line" className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="news" data-testid="game-tab-news" className="gap-1.5">
            <Newspaper size={14} /> Notícias ({news.data?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="updates" data-testid="game-tab-updates" className="gap-1.5">
            <History size={14} /> Atualizações ({patches.length})
          </TabsTrigger>
          <TabsTrigger value="dlc" data-testid="game-tab-dlc" className="gap-1.5">
            <Package size={14} /> DLCs ({dlcs.length})
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="game-tab-events" className="gap-1.5">
            <CalendarDays size={14} /> Eventos ({gameEvents.length})
          </TabsTrigger>
          <TabsTrigger value="saved" data-testid="game-tab-saved" className="gap-1.5">
            <Bookmark size={14} /> Salvas ({savedNews.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="mt-4 space-y-2.5">
          {news.isLoading && <CardSkeleton />}
          {!news.isLoading && (news.data?.items.length ?? 0) === 0 && (
            <EmptyState title="Sem notícias catalogadas" description="Nenhuma notícia vinculada a este jogo foi coletada até agora." />
          )}
          {(news.data?.items ?? []).map((item) => <NewsRow key={item.id} item={item} />)}
        </TabsContent>

        <TabsContent value="updates" className="mt-4 space-y-2.5">
          {patches.length === 0 && (
            <EmptyState title="Histórico vazio" description="Nenhum patch oficial catalogado para este título." />
          )}
          {patches.map((u) => <UpdateBlock key={u.id} item={u} />)}
        </TabsContent>

        <TabsContent value="dlc" className="mt-4 space-y-2.5">
          {dlcs.length === 0 && (
            <EmptyState title="Nenhuma DLC registrada" description="Nenhuma expansão ou DLC catalogada por enquanto." />
          )}
          {dlcs.map((u) => <UpdateBlock key={u.id} item={u} />)}
        </TabsContent>

        <TabsContent value="events" className="mt-4 space-y-2.5">
          {gameEvents.length === 0 && (
            <EmptyState title="Nenhum evento previsto" description="Não há datas futuras confirmadas para este jogo." />
          )}
          {gameEvents.map((e) => (
            <div key={e.id} data-testid={`game-event-${e.id}`} className="rounded-lg border border-[#1A2033] bg-[#10131D] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="border-[#22D3EE]/30 text-[10px] text-[#67E8F9]">
                  {EVENT_TYPE_LABELS[e.event_type] ?? e.event_type}
                </Badge>
                <span className="font-mono text-[10px] text-[#9AA3B5]">
                  {fmtDate(e.starts_at)} · {RELEASE_STATUS_LABELS[e.date_status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium text-[#F4F5FA]">{e.title}</p>
              <p className="mt-1 text-xs text-[#9AA3B5]">{e.description}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="saved" className="mt-4 space-y-2.5">
          {savedNews.length === 0 && (
            <EmptyState title="Nenhuma notícia salva" description="Salve notícias deste jogo para encontrá-las aqui." />
          )}
          {savedNews.map((item) => <NewsRow key={item.id} item={item} />)}
        </TabsContent>
      </Tabs>

      {/* Semelhantes */}
      {g.similar.length > 0 && (
        <section>
          <h2 className="mb-4 font-heading text-lg font-bold text-[#F4F5FA]">Jogos semelhantes</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {g.similar.map(({ game: similar }) => (
              <CatalogCard key={similar.id} game={similar} owned={ownedIds.has(similar.id)} />
            ))}
          </div>
        </section>
      )}

      {/* Confirmação de remoção */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-md border-[#28324D] bg-[#10131D]" data-testid="remove-confirm-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Remover da biblioteca?</DialogTitle>
            <DialogDescription>
              {g.title} sairá da sua biblioteca e suas notas, nota pessoal e tags serão apagadas. O jogo continua no
              catálogo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="border-[#28324D]" data-testid="remove-cancel-button">Cancelar</Button>} />
            <Button
              variant="destructive"
              data-testid="remove-confirm-button"
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              className="gap-1.5"
            >
              {removeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] uppercase tracking-wider text-[#22D3EE]">{label}</dt>
      <dd className="mt-0.5 text-[#F4F5FA]">{value}</dd>
    </div>
  );
}

function UpdateBlock({ item }: { item: UpdatePage["items"][number] }) {
  return (
    <div data-testid={`game-update-${item.id}`} className="rounded-lg border border-[#1A2033] bg-[#10131D] p-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {item.version && (
          <span className="rounded bg-[#171B29] px-1.5 py-0.5 font-mono text-[10px] text-[#67E8F9]">{item.version}</span>
        )}
        <Badge variant="outline" className="border-[#28324D] text-[10px] text-[#9AA3B5]">
          {UPDATE_CATEGORY_LABELS[item.category] ?? item.category}
        </Badge>
        {item.is_recent && <Badge className="bg-[#10B981] text-[10px] text-white">Recente</Badge>}
        <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-[#9AA3B5]">
          <Clock size={10} /> {fmtDate(item.published_at)}
        </span>
      </div>
      <p className="mt-2 text-sm font-semibold text-[#F4F5FA]">{item.title}</p>
      <p className="mt-1 text-xs text-[#9AA3B5]">{item.summary || "Resumo não informado."}</p>
      {item.highlights.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.highlights.map((h, i) => (
            <li key={i} className="flex gap-2 text-xs text-[#C8CEDC]">
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[#8B5CF6]" />
              {h}
            </li>
          ))}
        </ul>
      )}
      {item.patch_notes_url ? (
        <a
          href={item.patch_notes_url}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-2 inline-flex items-center gap-1 text-xs text-[#22D3EE] hover:underline"
        >
          Notas oficiais <ExternalLink size={11} />
        </a>
      ) : (
        <p className="mt-2 font-mono text-[10px] text-[#9AA3B5]">Link das notas oficiais não informado</p>
      )}
    </div>
  );
}
