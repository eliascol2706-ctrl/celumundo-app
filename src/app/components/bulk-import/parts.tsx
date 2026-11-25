import { ReactNode } from "react";
import {
  Check,
  CheckCircle2,
  Sparkles,
  UserCheck,
  CircleSlash,
  AlertOctagon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { RowStatus } from "./matching";

export const panel = "bg-white border border-zinc-200 rounded-lg shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

const STATUS_META: Record<RowStatus, { label: string; cls: string; icon: ReactNode }> = {
  exact: { label: "Coincidencia exacta", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  suggested: { label: "Sugerida", cls: "bg-amber-50 text-amber-800 border-amber-200", icon: <Sparkles className="h-3 w-3" /> },
  manual: { label: "Confirmado manual", cls: "bg-sky-50 text-sky-800 border-sky-200", icon: <UserCheck className="h-3 w-3" /> },
  none: { label: "Sin coincidencia", cls: "bg-zinc-100 text-zinc-700 border-zinc-300", icon: <CircleSlash className="h-3 w-3" /> },
  error: { label: "Error de validación", cls: "bg-red-50 text-red-700 border-red-200", icon: <AlertOctagon className="h-3 w-3" /> },
};
export const STATUS_LABEL = Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.label])) as Record<RowStatus, string>;

export function StatusBadge({ status }: { status: RowStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${m.cls}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

export function Stat({
  label,
  value,
  icon,
  tone = "neutral",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  hint?: string;
}) {
  const tones = {
    neutral: "bg-zinc-100 text-zinc-600",
    good: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    bad: "bg-red-50 text-red-700",
    info: "bg-sky-50 text-sky-700",
  };
  return (
    <div className={`${panel} flex items-center gap-3 px-3.5 py-3`}>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${tones[tone]}`}>{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-xl font-semibold leading-tight tabular-nums text-zinc-900">{value}</span>
          {hint && <span className="text-xs text-zinc-500">{hint}</span>}
        </div>
      </div>
    </div>
  );
}

export function Stepper({
  steps,
  current,
  maxReached,
  onGo,
}: {
  steps: string[];
  current: number;
  maxReached: number;
  onGo: (i: number) => void;
}) {
  return (
    <ol className={`${panel} flex items-center gap-2 overflow-x-auto px-4 py-3`}>
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const clickable = i <= maxReached && i !== current && current < 3;
        return (
          <li key={s} className="flex flex-1 items-center gap-2 last:flex-none">
            <button
              disabled={!clickable}
              onClick={() => onGo(i)}
              className={`flex items-center gap-2.5 whitespace-nowrap rounded-md py-1 pr-2 text-left transition-colors ${
                clickable ? "cursor-pointer hover:bg-zinc-50" : "cursor-default"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${
                  done
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : active
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700 ring-4 ring-emerald-100"
                    : "border-zinc-300 bg-white text-zinc-500"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-sm ${active ? "font-semibold text-zinc-900" : done ? "font-medium text-zinc-700" : "text-zinc-500"}`}>
                {s}
              </span>
            </button>
            {i < steps.length - 1 && <div className={`h-px min-w-6 flex-1 ${done ? "bg-emerald-500" : "bg-zinc-200"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

export function Pagination({
  page,
  pages,
  total,
  size,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const btn = "flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:opacity-40 disabled:hover:bg-white";
  return (
    <div className="flex items-center justify-between gap-3 border-t border-zinc-200 px-3 py-2 text-xs text-zinc-600">
      <span className="tabular-nums">
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(1)} aria-label="Primera página">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Anterior">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="px-2 tabular-nums">
          Página {page} / {pages}
        </span>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Siguiente">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button className={btn} disabled={page >= pages} onClick={() => onPage(pages)} aria-label="Última página">
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export function SimBar({ value }: { value: number }) {
  const color = value >= 90 ? "bg-emerald-500" : value >= 70 ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className="w-9 text-right text-xs font-semibold tabular-nums text-zinc-700">{value}%</span>
    </div>
  );
}
