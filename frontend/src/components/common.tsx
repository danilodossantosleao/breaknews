import { useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Star, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/format";

export function SafeImage({
  src,
  alt,
  className,
  fallbackLabel,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}) {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-linear-to-br from-[#171B29] via-[#10131D] to-[#0B0E17]",
          className,
        )}
        aria-label={alt}
      >
        <span className="font-heading text-3xl font-bold text-[#28324D]">{fallbackLabel ?? "NX"}</span>
      </div>
    );
  }
  return (
    <img src={src} alt={alt} loading="lazy" onError={() => setError(true)} className={className} />
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span
      data-testid={`status-badge-${status}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-[#171B29] text-[#9AA3B5] border-[#28324D]",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

export function RatingInput({
  value,
  onChange,
  size = 14,
}: {
  value: number | null;
  onChange?: (v: number | null) => void;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5" data-testid="rating-input">
      {Array.from({ length: 10 }, (_, i) => {
        const score = i + 1;
        const filled = (value ?? 0) >= score;
        return (
          <button
            key={score}
            type="button"
            data-testid={`rating-star-${score}`}
            aria-label={`Nota ${score} de 10`}
            disabled={!onChange}
            onClick={() => onChange?.(value === score ? null : score)}
            className={cn("transition-transform", onChange && "hover:scale-125 cursor-pointer disabled:cursor-default")}
          >
            <Star
              size={size}
              className={filled ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#28324D]"}
            />
          </button>
        );
      })}
      <span className="ml-2 font-mono text-xs text-[#9AA3B5]">{value != null ? `${value}/10` : "sem nota"}</span>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div
      data-testid="empty-state"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[#28324D] bg-[#0B0E17]/60 px-6 py-12 text-center"
    >
      {icon && <div className="text-[#8B5CF6]">{icon}</div>}
      <h3 className="font-heading text-lg font-semibold text-[#F4F5FA]">{title}</h3>
      {description && <p className="max-w-md text-sm text-[#9AA3B5]">{description}</p>}
      {action}
    </div>
  );
}

export function SectionHeader({
  title,
  linkTo,
  linkLabel = "Ver tudo",
}: {
  title: string;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-heading text-lg font-bold text-[#F4F5FA]">{title}</h2>
      {linkTo && (
        <Link
          to={linkTo}
          data-testid={`link-all-${title.toLowerCase().replace(/\s+/g, "-")}`}
          className="inline-flex items-center gap-1 text-sm font-medium text-[#22D3EE] hover:text-[#67E8F9]"
        >
          {linkLabel}
          <ChevronRight size={14} />
        </Link>
      )}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-xl border border-[#1A2033] bg-[#10131D]", className)}>
      <div className="aspect-video rounded-t-xl bg-[#171B29]" />
      <div className="space-y-2 p-4">
        <div className="h-3 w-1/3 rounded bg-[#171B29]" />
        <div className="h-4 w-3/4 rounded bg-[#171B29]" />
        <div className="h-3 w-full rounded bg-[#171B29]" />
      </div>
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-3 rounded-lg border border-[#1A2033] bg-[#10131D] p-3">
      <div className="size-12 rounded bg-[#171B29]" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-2/3 rounded bg-[#171B29]" />
        <div className="h-3 w-1/3 rounded bg-[#171B29]" />
      </div>
    </div>
  );
}
