import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, CalendarDays, List, Bookmark, BookmarkCheck, BellRing, Bell, Loader2,
} from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import type { EventItem } from "@/lib/types";
import { EVENT_TYPE_LABELS, RELEASE_STATUS_LABELS, fmtDate, fmtDateTime, daysUntil } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, RowSkeleton, SafeImage } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TYPES: Record<string, string> = {
  todos: "Todos os tipos",
  lancamento: "Lançamentos",
  dlc: "DLCs",
  beta: "Betas e testes",
  evento: "Eventos",
  showcase: "Showcases",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<"mes" | "lista">("mes");
  const [type, setType] = useState("todos");
  const [onlyTracked, setOnlyTracked] = useState(false);

  const month = monthKey(cursor);
  const params = new URLSearchParams();
  if (view === "lista") params.set("upcoming", "true");
  else params.set("month", month);
  if (type !== "todos") params.set("event_type", type);
  if (onlyTracked) params.set("tracked", "true");

  const events = useQuery({
    queryKey: ["events", params.toString()],
    queryFn: () => apiGet<EventItem[]>(`/events?${params.toString()}`),
    retry: false,
  });

  const items = events.data ?? [];

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
    const leading = first.getDay();
    const cells: { day: number | null; events: EventItem[] }[] = [];
    for (let i = 0; i < leading; i++) cells.push({ day: null, events: [] });
    for (let day = 1; day <= daysInMonth; day++) {
      const dayEvents = items.filter((e) => {
        if (!e.starts_at) return false;
        const d = new Date(e.starts_at);
        return d.getDate() === day && d.getMonth() === cursor.getMonth() && d.getFullYear() === cursor.getFullYear();
      });
      cells.push({ day, events: dayEvents });
    }
    while (cells.length % 7 !== 0) cells.push({ day: null, events: [] });
    return cells;
  }, [cursor, items]);

  const monthLabel = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const today = new Date();

  return (
    <div className="space-y-5 animate-fade-up">
      <header>
        <h1 className="font-heading text-2xl font-bold text-[#F4F5FA]">Calendário Gamer</h1>
        <p className="mt-1 text-sm text-[#9AA3B5]">
          Lançamentos, DLCs, betas e eventos. Datas exibidas no seu horário local quando a fonte informa o fuso;
          itens marcados como estimados ou a anunciar não são oficiais.
        </p>
      </header>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={view} onValueChange={(v) => setView(v as "mes" | "lista")}>
          <TabsList variant="line">
            <TabsTrigger value="mes" data-testid="calendar-view-month" className="gap-1.5">
              <CalendarDays size={14} /> Mensal
            </TabsTrigger>
            <TabsTrigger value="lista" data-testid="calendar-view-list" className="gap-1.5">
              <List size={14} /> Lista
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap items-center gap-2">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger size="sm" data-testid="calendar-filter-type" className="w-40 border-[#28324D] bg-[#10131D] text-xs">
              <SelectValue>{(v) => TYPES[v as string] ?? "Tipo"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TYPES).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={onlyTracked ? "default" : "outline"}
            size="sm"
            data-testid="calendar-filter-tracked"
            onClick={() => setOnlyTracked(!onlyTracked)}
            className={cn("text-xs", onlyTracked ? "bg-[#8B5CF6] text-white" : "border-[#28324D] text-[#9AA3B5]")}
          >
            Somente jogos seguidos
          </Button>
        </div>
      </div>

      {view === "mes" && (
        <>
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Mês anterior"
              data-testid="calendar-prev-month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="border-[#28324D]"
            >
              <ChevronLeft size={15} />
            </Button>
            <h2 className="font-heading text-base font-bold capitalize text-[#F4F5FA]" data-testid="calendar-month-label">
              {monthLabel}
            </h2>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Próximo mês"
              data-testid="calendar-next-month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="border-[#28324D]"
            >
              <ChevronRight size={15} />
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#1A2033]">
            <div className="grid grid-cols-7 border-b border-[#1A2033] bg-[#0B0E17]">
              {WEEKDAYS.map((d) => (
                <div key={d} className="px-2 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-[#9AA3B5]">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-[#1A2033]" data-testid="calendar-grid">
              {grid.map((cell, i) => {
                const isToday =
                  cell.day === today.getDate() &&
                  cursor.getMonth() === today.getMonth() &&
                  cursor.getFullYear() === today.getFullYear();
                return (
                  <div
                    key={i}
                    className={cn(
                      "min-h-20 bg-[#10131D] p-1.5 md:min-h-24",
                      !cell.day && "bg-[#0B0E17]/60",
                      isToday && "bg-[#8B5CF6]/8 ring-1 ring-inset ring-[#8B5CF6]/40",
                    )}
                  >
                    {cell.day && (
                      <>
                        <span className={cn("font-mono text-[10px]", isToday ? "text-[#22D3EE]" : "text-[#9AA3B5]")}>
                          {cell.day}
                        </span>
                        <div className="mt-1 space-y-1">
                          {cell.events.slice(0, 2).map((e) => (
                            <div
                              key={e.id}
                              data-testid={`calendar-cell-event-${e.id}`}
                              title={e.title}
                              className="truncate rounded border border-[#8B5CF6]/30 bg-[#8B5CF6]/12 px-1 py-0.5 text-[9px] text-[#C7D2FE]"
                            >
                              {e.title}
                            </div>
                          ))}
                          {cell.events.length > 2 && (
                            <p className="px-1 font-mono text-[9px] text-[#67E8F9]">+{cell.events.length - 2}</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {events.isLoading && <div className="space-y-2.5">{[0, 1, 2].map((i) => <RowSkeleton key={i} />)}</div>}

      {events.isError && (
        <EmptyState title="Agenda indisponível" description="Não foi possível carregar os eventos agora." />
      )}

      {!events.isLoading && !events.isError && items.length === 0 && (
        <EmptyState
          icon={<CalendarDays size={30} />}
          title={view === "mes" ? "Nenhum evento neste mês" : "Nenhuma data futura"}
          description="Navegue entre os meses, troque o filtro de tipo ou desative o filtro de jogos seguidos."
        />
      )}

      {items.length > 0 && (
        <div className="space-y-2.5" data-testid="calendar-event-list">
          <h2 className="font-heading text-base font-bold text-[#F4F5FA]">
            {view === "mes" ? `Eventos de ${monthLabel}` : "Próximas datas"}
          </h2>
          {items.map((e) => <EventRow key={e.id} item={e} />)}
        </div>
      )}
    </div>
  );
}

function EventRow({ item }: { item: EventItem }) {
  const queryClient = useQueryClient();
  const mutate = useMutation({
    mutationFn: (patch: { is_saved?: boolean; reminder?: boolean }) =>
      apiPost(`/events/${item.id}/state`, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["saved"] });
    },
    onError: () => toast.error("Não foi possível salvar essa ação."),
  });

  const left = daysUntil(item.starts_at);

  return (
    <article
      data-testid={`event-card-${item.id}`}
      className="flex gap-3.5 rounded-xl border border-[#1A2033] bg-[#10131D] p-4 transition-colors hover:border-[#22D3EE]/40"
    >
      {item.game_id ? (
        <Link to={`/game/${item.game_id}`} className="shrink-0">
          <SafeImage
            src={item.game_cover}
            alt={item.game_title ?? ""}
            fallbackLabel={(item.game_title ?? "NX").slice(0, 2)}
            className="h-20 w-14 rounded object-cover"
          />
        </Link>
      ) : (
        <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded border border-[#28324D] bg-[#171B29]">
          <CalendarDays size={18} className="text-[#8B5CF6]" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" className="border-[#22D3EE]/40 text-[10px] text-[#67E8F9]">
            {EVENT_TYPE_LABELS[item.event_type] ?? item.event_type}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              item.date_status === "confirmado"
                ? "border-[#10B981]/40 text-[#6EE7B7]"
                : item.date_status === "estimado"
                  ? "border-[#F59E0B]/40 text-[#FCD34D]"
                  : "border-[#28324D] text-[#9AA3B5]",
            )}
            data-testid={`event-status-${item.id}`}
          >
            {RELEASE_STATUS_LABELS[item.date_status] ?? item.date_status}
          </Badge>
          {left != null && left >= 0 && (
            <span className="font-mono text-[10px] text-[#A78BFA]">
              {left === 0 ? "é hoje" : `em ${left} dia${left === 1 ? "" : "s"}`}
            </span>
          )}
        </div>
        <h3 className="mt-2 font-heading text-[15px] font-semibold text-[#F4F5FA]">{item.title}</h3>
        {item.game_title && (
          <Link to={`/game/${item.game_id}`} className="font-mono text-[10px] text-[#C7D2FE] hover:text-[#8B5CF6]">
            {item.game_title}
          </Link>
        )}
        <p className="mt-1.5 text-[13px] text-[#9AA3B5]">{item.description}</p>
        <p className="mt-1.5 font-mono text-[10px] text-[#9AA3B5]">
          {fmtDateTime(item.starts_at)} ({item.timezone_label}) · {fmtDate(item.starts_at)}
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            data-testid={`event-save-${item.id}`}
            onClick={() => {
              mutate.mutate({ is_saved: !item.is_saved });
              toast.success(item.is_saved ? "Data removida da coleção" : "Data salva em Minha Coleção");
            }}
            className={cn("gap-1.5 px-2 text-xs", item.is_saved ? "text-[#A78BFA]" : "text-[#9AA3B5]")}
          >
            {mutate.isPending ? <Loader2 size={12} className="animate-spin" /> : item.is_saved ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
            {item.is_saved ? "Salva" : "Salvar data"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid={`event-reminder-${item.id}`}
            onClick={() => {
              mutate.mutate({ reminder: !item.reminder });
              toast.success(item.reminder ? "Lembrete interno desativado" : "Lembrete interno ativado");
            }}
            className={cn("gap-1.5 px-2 text-xs", item.reminder ? "text-[#67E8F9]" : "text-[#9AA3B5]")}
          >
            {item.reminder ? <BellRing size={12} /> : <Bell size={12} />}
            {item.reminder ? "Lembrete ativo" : "Ativar lembrete"}
          </Button>
        </div>
      </div>
    </article>
  );
}
