import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, CalendarDays, FolderOpen, Save, Loader2, StickyNote } from "lucide-react";
import { apiGet, apiPatch } from "@/lib/api";
import type { SavedOut } from "@/lib/types";
import { EVENT_TYPE_LABELS, fmtDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, RowSkeleton } from "@/components/common";
import { NewsRow } from "@/components/NewsCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export default function SavedPage() {
  const [collection, setCollection] = useState("todas");
  const [editing, setEditing] = useState<{ id: string; note: string; collection: string } | null>(null);
  const queryClient = useQueryClient();

  const saved = useQuery({
    queryKey: ["saved"],
    queryFn: () => apiGet<SavedOut>("/saved"),
    retry: false,
  });

  const patchNews = useMutation({
    mutationFn: (payload: { id: string; collection_name: string; personal_note: string }) =>
      apiPatch(`/saved/news/${payload.id}`, {
        collection_name: payload.collection_name,
        personal_note: payload.personal_note,
      }),
    onSuccess: () => {
      toast.success("Coleção e nota atualizadas");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["saved"] });
    },
    onError: () => toast.error("Não foi possível salvar as alterações."),
  });

  const newsEntries = (saved.data?.news ?? []).filter(
    (e) => collection === "todas" || e.collection_name === collection,
  );
  const eventEntries = saved.data?.events ?? [];
  const collections = saved.data?.collections ?? [];

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Minha Coleção</h1>
        <p className="mt-1 text-sm text-[#9AA3B5]">
          Notícias e datas salvas, organizadas em coleções com notas privadas. O estado de leitura é individual da
          sua conta.
        </p>
      </header>

      <Tabs defaultValue="news">
        <TabsList variant="line">
          <TabsTrigger value="news" data-testid="saved-tab-news" className="gap-1.5">
            <Bookmark size={14} /> Notícias ({saved.data?.news.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="events" data-testid="saved-tab-events" className="gap-1.5">
            <CalendarDays size={14} /> Datas ({eventEntries.length})
          </TabsTrigger>
          <TabsTrigger value="collections" data-testid="saved-tab-collections" className="gap-1.5">
            <FolderOpen size={14} /> Coleções ({collections.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="news" className="mt-4 space-y-3">
          {collections.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                data-testid="saved-collection-todas"
                onClick={() => setCollection("todas")}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs",
                  collection === "todas"
                    ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F4F5FA]"
                    : "border-[#28324D] bg-[#10131D] text-[#9AA3B5]",
                )}
              >
                Todas ({saved.data?.news.length ?? 0})
              </button>
              {collections.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  data-testid={`saved-collection-${c.name}`}
                  onClick={() => setCollection(c.name)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs",
                    collection === c.name
                      ? "border-[#8B5CF6] bg-[#8B5CF6]/15 text-[#F4F5FA]"
                      : "border-[#28324D] bg-[#10131D] text-[#9AA3B5]",
                  )}
                >
                  {c.name} ({c.count})
                </button>
              ))}
            </div>
          )}

          {saved.isLoading && <div className="space-y-2.5">{[0, 1].map((i) => <RowSkeleton key={i} />)}</div>}
          {saved.isError && <EmptyState title="Coleção indisponível" description="Não foi possível carregar seus itens salvos." />}
          {!saved.isLoading && !saved.isError && newsEntries.length === 0 && (
            <EmptyState
              icon={<Bookmark size={30} />}
              title="Nenhuma notícia salva"
              description="Use o botão Salvar em qualquer notícia do feed ou do News Center."
              action={
                <Button variant="outline" className="mt-2 border-[#28324D]" render={<Link to="/news">Ir ao News Center</Link>} />
              }
            />
          )}

          {newsEntries.map((entry) =>
            entry.news ? (
              <div key={entry.news.id} className="space-y-1.5" data-testid={`saved-entry-${entry.news.id}`}>
                <NewsRow item={entry.news} />
                <div className="flex flex-wrap items-center gap-2 pl-1">
                  <Badge variant="outline" className="border-[#8B5CF6]/40 text-[10px] text-[#C7D2FE]">
                    {entry.collection_name}
                  </Badge>
                  <span className="font-mono text-[10px] text-[#9AA3B5]">Salva {timeAgo(entry.saved_at)}</span>
                  {entry.personal_note && (
                    <span className="flex items-center gap-1 text-[11px] italic text-[#9AA3B5]">
                      <StickyNote size={11} /> {entry.personal_note}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid={`saved-edit-${entry.news.id}`}
                    onClick={() =>
                      setEditing({
                        id: entry.news!.id,
                        note: entry.personal_note ?? "",
                        collection: entry.collection_name,
                      })
                    }
                    className="h-7 px-2 text-xs text-[#22D3EE]"
                  >
                    Editar coleção e nota
                  </Button>
                </div>
              </div>
            ) : null,
          )}
        </TabsContent>

        <TabsContent value="events" className="mt-4 space-y-2.5">
          {eventEntries.length === 0 && (
            <EmptyState
              icon={<CalendarDays size={30} />}
              title="Nenhuma data salva"
              description="Salve lançamentos e eventos no Calendário Gamer para acompanhá-los aqui."
              action={
                <Button variant="outline" className="mt-2 border-[#28324D]" render={<Link to="/calendar">Abrir calendário</Link>} />
              }
            />
          )}
          {eventEntries.map((entry) =>
            entry.event ? (
              <div
                key={entry.event.id}
                data-testid={`saved-event-${entry.event.id}`}
                className="rounded-xl border border-[#1A2033] bg-[#10131D] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge variant="outline" className="border-[#22D3EE]/40 text-[10px] text-[#67E8F9]">
                    {EVENT_TYPE_LABELS[entry.event.event_type] ?? entry.event.event_type}
                  </Badge>
                  <span className="font-mono text-[10px] text-[#9AA3B5]">
                    {fmtDate(entry.event.starts_at)} · {timeAgo(entry.event.starts_at)}
                  </span>
                </div>
                <p className="mt-2 font-heading text-sm font-semibold text-[#F4F5FA]">{entry.event.title}</p>
                <p className="mt-1 text-xs text-[#9AA3B5]">{entry.event.description}</p>
                {entry.reminder && (
                  <Badge variant="outline" className="mt-2 border-[#10B981]/40 text-[10px] text-[#6EE7B7]">
                    Lembrete interno ativo
                  </Badge>
                )}
              </div>
            ) : null,
          )}
        </TabsContent>

        <TabsContent value="collections" className="mt-4">
          {collections.length === 0 ? (
            <EmptyState
              icon={<FolderOpen size={30} />}
              title="Nenhuma coleção criada"
              description="Ao salvar uma notícia você pode atribuí-la a uma coleção personalizada."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  data-testid={`collection-card-${c.name}`}
                  onClick={() => setCollection(c.name)}
                  className="card-hover rounded-xl border border-[#1A2033] bg-[#10131D] p-4 text-left"
                >
                  <FolderOpen size={18} className="text-[#8B5CF6]" />
                  <p className="mt-2.5 font-heading text-sm font-semibold text-[#F4F5FA]">{c.name}</p>
                  <p className="font-mono text-[10px] text-[#9AA3B5]">{c.count} item(ns)</p>
                </button>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Editor de coleção e nota */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md border-[#28324D] bg-[#10131D]" data-testid="saved-edit-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Organizar item salvo</DialogTitle>
            <DialogDescription>Defina a coleção e uma nota privada para este item.</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="collection">Coleção</Label>
                <Input
                  id="collection"
                  value={editing.collection}
                  onChange={(e) => setEditing({ ...editing, collection: e.target.value })}
                  placeholder="Ex.: Ler depois"
                  data-testid="saved-collection-input"
                  className="border-[#28324D] bg-[#0B0E17]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">Nota privada</Label>
                <Textarea
                  id="note"
                  rows={3}
                  value={editing.note}
                  onChange={(e) => setEditing({ ...editing, note: e.target.value })}
                  placeholder="Por que isso importa para você…"
                  data-testid="saved-note-input"
                  className="border-[#28324D] bg-[#0B0E17]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              data-testid="saved-save-button"
              disabled={patchNews.isPending}
              onClick={() =>
                editing &&
                patchNews.mutate({
                  id: editing.id,
                  collection_name: editing.collection || "Geral",
                  personal_note: editing.note,
                })
              }
              className="gap-1.5 bg-[#8B5CF6] text-white hover:bg-[#7C4DF4]"
            >
              {patchNews.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
