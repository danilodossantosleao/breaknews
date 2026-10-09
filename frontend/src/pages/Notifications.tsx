import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, CheckCheck, Loader2, BellOff, Info } from "lucide-react";
import { apiGet, apiPatch, apiPost } from "@/lib/api";
import type { NotificationList, PrefItem, SyncLogOut } from "@/lib/types";
import { CATEGORY_LABELS, CATEGORY_STYLES, FREQUENCY_LABELS, timeAgo, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, RowSkeleton } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const notif = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiGet<NotificationList>("/notifications"),
    retry: false,
  });
  const prefs = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => apiGet<PrefItem[]>("/notifications/preferences"),
    retry: false,
  });
  const lastSync = useQuery({
    queryKey: ["sync-last"],
    queryFn: () => apiGet<SyncLogOut | null>("/sync/last"),
    retry: false,
  });

  const readOne = useMutation({
    mutationFn: (id: string) => apiPost(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAll = useMutation({
    mutationFn: () => apiPost<{ updated: number }>("/notifications/read-all"),
    onSuccess: (res) => {
      toast.success(`${res.updated} notificação(ões) marcada(s) como lida(s)`);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: () => toast.error("Não foi possível marcar todas como lidas."),
  });

  const updatePref = useMutation({
    mutationFn: (payload: { category: string; patch: { enabled?: boolean; frequency?: string } }) =>
      apiPatch<PrefItem>(`/notifications/preferences/${payload.category}`, payload.patch),
    onSuccess: () => {
      toast.success("Preferência atualizada");
      queryClient.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: () => toast.error("Não foi possível atualizar a preferência."),
  });

  const items = notif.data?.items ?? [];

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Notificações</h1>
          <p className="mt-1 text-sm text-[#9AA3B5]">
            Alertas internos do site sobre os jogos que você acompanha.
          </p>
        </div>
        <Button
          size="sm"
          data-testid="notifications-read-all-button"
          onClick={() => readAll.mutate()}
          disabled={readAll.isPending || (notif.data?.unread ?? 0) === 0}
          className="gap-1.5 bg-[#8B5CF6] text-xs text-white hover:bg-[#7C4DF4]"
        >
          {readAll.isPending ? <Loader2 size={13} className="animate-spin" /> : <CheckCheck size={13} />}
          Marcar todas como lidas
        </Button>
      </header>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#22D3EE]/25 bg-[#0E7490]/10 p-3.5">
        <Info size={15} className="mt-0.5 shrink-0 text-[#67E8F9]" />
        <div className="text-xs leading-relaxed text-[#C8CEDC]">
          <p>
            As notificações são geradas a cada sincronização do servidor — não em tempo real. Push, e-mail e
            integrações externas não estão configurados neste ambiente.
          </p>
          <p className="mt-1 font-mono text-[10px] text-[#9AA3B5]" data-testid="notifications-sync-info">
            {lastSync.data?.finished_at
              ? `Última sincronização: ${fmtDateTime(lastSync.data.finished_at)} · status ${lastSync.data.status}`
              : "Nenhuma sincronização registrada ainda"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="alerts">
        <TabsList variant="line">
          <TabsTrigger value="alerts" data-testid="notifications-tab-alerts" className="gap-1.5">
            <Bell size={14} /> Alertas ({notif.data?.unread ?? 0} não lidos)
          </TabsTrigger>
          <TabsTrigger value="prefs" data-testid="notifications-tab-prefs">
            Preferências
          </TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="mt-4 space-y-2.5">
          {notif.isLoading && <div className="space-y-2.5">{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</div>}
          {notif.isError && <EmptyState title="Alertas indisponíveis" description="Não foi possível carregar suas notificações." />}
          {!notif.isLoading && !notif.isError && items.length === 0 && (
            <EmptyState
              icon={<BellOff size={30} />}
              title="Nenhuma notificação"
              description="Quando houver novidades dos seus jogos, elas aparecem aqui."
              action={
                <Button variant="outline" className="mt-2 border-[#28324D]" render={<Link to="/library">Ver minha biblioteca</Link>} />
              }
            />
          )}
          {items.map((n) => (
            <article
              key={n.id}
              data-testid={`notification-${n.id}`}
              className={cn(
                "flex items-start gap-3 rounded-xl border bg-[#10131D] p-3.5",
                n.is_read ? "border-[#1A2033] opacity-80" : "border-[#28324D]",
              )}
            >
              {!n.is_read && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#8B5CF6]" aria-label="Não lida" />}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px]", CATEGORY_STYLES[n.category] ?? "border-[#28324D] text-[#9AA3B5]")}
                  >
                    {CATEGORY_LABELS[n.category] ?? n.category}
                  </Badge>
                  <span className="font-mono text-[10px] text-[#9AA3B5]">{timeAgo(n.created_at)}</span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-[#F4F5FA]">{n.title}</p>
                {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-[#9AA3B5]">{n.body}</p>}
                <div className="mt-2 flex gap-1.5">
                  {n.game_id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`notification-game-${n.id}`}
                      className="h-7 px-2 text-xs text-[#22D3EE]"
                      render={<Link to={`/game/${n.game_id}`}>Abrir jogo</Link>}
                    />
                  )}
                  {!n.is_read && (
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid={`notification-read-${n.id}`}
                      onClick={() => readOne.mutate(n.id)}
                      className="h-7 px-2 text-xs text-[#9AA3B5]"
                    >
                      Marcar como lida
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </TabsContent>

        <TabsContent value="prefs" className="mt-4 space-y-2.5">
          <p className="text-xs text-[#9AA3B5]">
            Escolha quais categorias geram alertas e com que frequência você quer ser avisado.
          </p>
          {prefs.isLoading && <div className="space-y-2">{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</div>}
          {(prefs.data ?? []).map((pref) => (
            <div
              key={pref.category}
              data-testid={`pref-row-${pref.category}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#1A2033] bg-[#10131D] p-3.5"
            >
              <div className="flex items-center gap-2.5">
                <Checkbox
                  id={`pref-${pref.category}`}
                  checked={pref.enabled}
                  data-testid={`pref-toggle-${pref.category}`}
                  onCheckedChange={(checked) =>
                    updatePref.mutate({ category: pref.category, patch: { enabled: !!checked } })
                  }
                />
                <Label htmlFor={`pref-${pref.category}`} className="cursor-pointer text-sm text-[#F4F5FA]">
                  {CATEGORY_LABELS[pref.category] ?? pref.category}
                </Label>
              </div>
              <Select
                value={pref.frequency}
                onValueChange={(v) => updatePref.mutate({ category: pref.category, patch: { frequency: v } })}
              >
                <SelectTrigger
                  size="sm"
                  data-testid={`pref-frequency-${pref.category}`}
                  className="w-44 border-[#28324D] bg-[#0B0E17] text-xs"
                >
                  <SelectValue>{(v) => FREQUENCY_LABELS[v as string] ?? "Frequência"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
