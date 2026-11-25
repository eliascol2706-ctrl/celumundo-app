import { Fragment, useMemo, useState } from "react";
import {
  Search,
  ArrowUpDown,
  Pencil,
  Replace,
  Check,
  Layers,
  List,
  ChevronDown,
  ChevronRight,
  FileSearch,
  X,
  ListChecks,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import {
  getCatalog,
  searchCatalog,
  ImportRow,
  RowStatus,
  findProduct,
  normalize,
  rank,
  similarity,
  statusOf,
  validQty,
} from "./matching";
import { Pagination, SimBar, StatusBadge, STATUS_LABEL, panel } from "./parts";

const PAGE = 12;
type SortKey = "n" | "orig" | "qty" | "status";
const ORDER: Record<RowStatus, number> = { error: 0, none: 1, suggested: 2, manual: 3, exact: 4 };
const origText = (r: ImportRow) => r.origName || r.origCode;

export function ReviewStep({
  rows,
  setRows,
  initialFilter,
}: {
  rows: ImportRow[];
  setRows: (fn: (r: ImportRow[]) => ImportRow[]) => void;
  initialFilter?: "all" | "pending";
}) {
  const [filter, setFilter] = useState<"all" | "pending" | RowStatus>(initialFilter ?? "all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "n", dir: 1 });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [picker, setPicker] = useState<number[] | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length, pending: 0, exact: 0, suggested: 0, manual: 0, none: 0, error: 0 };
    rows.forEach((r) => {
      const s = statusOf(r);
      c[s]++;
      if (s !== "exact" && s !== "manual") c.pending++;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      const s = statusOf(r);
      if (filter === "pending" && (s === "exact" || s === "manual")) return false;
      if (filter !== "all" && filter !== "pending" && s !== filter) return false;
      if (!q) return true;
      const p = findProduct(r.productCode);
      return `${r.origName} ${r.origCode} ${p?.name ?? ""} ${p?.code ?? ""}`.toLowerCase().includes(q);
    });
    return list.sort((a, b) => {
      const d =
        sort.key === "n" ? a.n - b.n
        : sort.key === "qty" ? a.qty - b.qty
        : sort.key === "orig" ? origText(a).localeCompare(origText(b))
        : ORDER[statusOf(a)] - ORDER[statusOf(b)];
      return d * sort.dir || a.n - b.n;
    });
  }, [rows, filter, query, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const visible = filtered.slice((cur - 1) * PAGE, cur * PAGE);

  const groups = useMemo(() => {
    const m = new Map<string, ImportRow[]>();
    rows.forEach((r) => {
      if (!r.productCode) return;
      m.set(r.productCode, [...(m.get(r.productCode) ?? []), r]);
    });
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [rows]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: 1 }));
  const setQty = (id: number, v: string) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, qty: v === "" ? NaN : Number(v) } : r)));
  const confirmRows = (ids: number[]) =>
    setRows((rs) =>
      rs.map((r) => (ids.includes(r.id) && r.kind === "suggested" ? { ...r, kind: "manual", method: "Confirmado manualmente" } : r))
    );

  const assign = (ids: number[], code: string, same: boolean) => {
    const keys = new Set(rows.filter((r) => ids.includes(r.id)).map((r) => normalize(origText(r)).join(" ")));
    setRows((rs) =>
      rs.map((r) =>
        ids.includes(r.id) || (same && r.kind !== "exact" && keys.has(normalize(origText(r)).join(" ")))
          ? { ...r, productCode: code, kind: "manual", method: "Asignación manual", ambiguous: false, score: similarity(origText(r), findProduct(code)!.name) }
          : r
      )
    );
    setPicker(null);
    setSel(new Set());
  };

  const allOnPage = visible.length > 0 && visible.every((r) => sel.has(r.id));
  const selSuggested = [...sel].filter((id) => rows.find((r) => r.id === id)?.kind === "suggested");

  const chips: { k: "all" | "pending" | RowStatus; label: string }[] = [
    { k: "all", label: "Todas" },
    { k: "pending", label: "Pendientes" },
    { k: "suggested", label: "Sugeridas" },
    { k: "none", label: "Sin coincidencia" },
    { k: "error", label: "Errores" },
    { k: "manual", label: "Manuales" },
    { k: "exact", label: "Exactas" },
  ];

  const Th = ({ k, children, className = "" }: { k?: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500 ${className}`}>
      {k ? (
        <button onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-zinc-900">
          {children}
          <ArrowUpDown className={`h-3 w-3 ${sort.key === k ? "text-emerald-600" : "opacity-40"}`} />
        </button>
      ) : (
        children
      )}
    </th>
  );

  return (
    <div className={`${panel} overflow-hidden`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar por nombre o código…"
            className="h-8 bg-white pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {chips.map((c) => (
            <button
              key={c.k}
              onClick={() => {
                setFilter(c.k);
                setPage(1);
              }}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                filter === c.k ? "border-emerald-600 bg-emerald-600 text-white" : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {c.label}
              <span className={`tabular-nums ${filter === c.k ? "text-emerald-100" : "text-zinc-400"}`}>{counts[c.k]}</span>
            </button>
          ))}
        </div>
        <div className="ml-auto inline-flex rounded-md border border-zinc-200 p-0.5">
          {[
            { g: false, icon: <List className="h-3.5 w-3.5" />, label: "Filas" },
            { g: true, icon: <Layers className="h-3.5 w-3.5" />, label: "Agrupado" },
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => setGrouped(o.g)}
              className={`inline-flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium ${
                grouped === o.g ? "bg-zinc-900 text-white" : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {o.icon}
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk bar */}
      {sel.size > 0 && !grouped && (
        <div className="flex flex-wrap items-center gap-2 border-b border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-900">{sel.size} seleccionadas</span>
          <Button size="sm" variant="outline" className="h-7 bg-white text-xs" disabled={!selSuggested.length} onClick={() => { confirmRows(selSuggested); setSel(new Set()); }}>
            <ListChecks className="mr-1.5 h-3.5 w-3.5" />
            Confirmar sugerencias ({selSuggested.length})
          </Button>
          <Button size="sm" variant="outline" className="h-7 bg-white text-xs" onClick={() => setPicker([...sel])}>
            <Replace className="mr-1.5 h-3.5 w-3.5" />
            Asignar un producto a todas
          </Button>
          <button className="ml-auto text-xs text-emerald-800 underline-offset-2 hover:underline" onClick={() => setSel(new Set())}>
            Limpiar selección
          </button>
        </div>
      )}

      {/* Table */}
      {grouped ? (
        <div className="max-h-[540px] overflow-auto">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-zinc-50">
              <tr className="border-b border-zinc-200">
                <Th className="w-8"> </Th>
                <Th>Código</Th>
                <Th>Producto asignado</Th>
                <Th className="text-right">Filas Excel</Th>
                <Th className="text-right">Cantidad total</Th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([code, rs]) => {
                const p = findProduct(code)!;
                const isOpen = open.has(code);
                const total = rs.reduce((a, r) => a + (validQty(r.qty) ? r.qty : 0), 0);
                return (
                  <Fragment key={code}>
                    <tr
                      className="cursor-pointer border-b border-zinc-100 hover:bg-zinc-50"
                      onClick={() => setOpen((o) => { const n = new Set(o); n.has(code) ? n.delete(code) : n.add(code); return n; })}
                    >
                      <td className="px-3 py-2 text-zinc-400">{isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-700">{p.code}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{p.name}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{rs.length}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums">{total}</td>
                    </tr>
                    {isOpen &&
                      rs.map((r) => (
                        <tr key={`${code}-${r.id}`} className="border-b border-zinc-100 bg-zinc-50/70 text-xs text-zinc-600">
                          <td />
                          <td className="px-3 py-1.5 tabular-nums">Fila {r.n}</td>
                          <td className="px-3 py-1.5">
                            <span className="text-zinc-400">Original: </span>“{origText(r)}” · <StatusBadge status={statusOf(r)} />
                          </td>
                          <td />
                          <td className="px-3 py-1.5 text-right tabular-nums">{Number.isNaN(r.qty) ? "—" : r.qty}</td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-500">
            Las filas con el mismo producto se suman al generar los movimientos; las filas originales se conservan para auditoría.
          </p>
        </div>
      ) : (
        <>
          <div className="max-h-[540px] overflow-auto">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead className="sticky top-0 z-10 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="w-9 px-3 py-2">
                    <Checkbox
                      checked={allOnPage}
                      onCheckedChange={(v) =>
                        setSel((s) => {
                          const n = new Set(s);
                          visible.forEach((r) => (v ? n.add(r.id) : n.delete(r.id)));
                          return n;
                        })
                      }
                      aria-label="Seleccionar página"
                    />
                  </th>
                  <Th k="n" className="w-12">Fila</Th>
                  <Th k="orig">Identificador Excel</Th>
                  <Th>Producto asignado</Th>
                  <Th k="qty" className="text-right">Cant.</Th>
                  <Th>Método</Th>
                  <Th k="status">Estado</Th>
                  <Th className="text-right">Acción</Th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const s = statusOf(r);
                  const p = findProduct(r.productCode);
                  const needs = s === "suggested" || s === "none";
                  return (
                    <tr
                      key={r.id}
                      className={`border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 ${
                        s === "error" ? "bg-red-50/40" : sel.has(r.id) ? "bg-emerald-50/50" : ""
                      }`}
                    >
                      <td className="px-3 py-1.5">
                        <Checkbox
                          checked={sel.has(r.id)}
                          onCheckedChange={(v) => setSel((x) => { const n = new Set(x); v ? n.add(r.id) : n.delete(r.id); return n; })}
                          aria-label={`Seleccionar fila ${r.n}`}
                        />
                      </td>
                      <td className="px-3 py-1.5 tabular-nums text-zinc-500">{r.n}</td>
                      <td className="max-w-[240px] px-3 py-1.5">
                        <div className="truncate font-medium text-zinc-900" title={origText(r)}>
                          {r.origName || <span className="font-mono text-xs">{r.origCode}</span>}
                        </div>
                        {r.origName && r.origCode && <div className="font-mono text-[11px] text-zinc-500">{r.origCode}</div>}
                      </td>
                      <td className="max-w-[280px] px-3 py-1.5">
                        {p ? (
                          <>
                            <div className="truncate text-zinc-900" title={p.name}>{p.name}</div>
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-500">
                              {p.code}
                              {s === "suggested" && <span className="rounded bg-amber-100 px-1 font-sans font-semibold text-amber-800">{r.score}%</span>}
                              {r.ambiguous && <span className="rounded bg-zinc-100 px-1 font-sans text-zinc-600">ambigua</span>}
                            </div>
                          </>
                        ) : (
                          <span className="text-zinc-400">— Sin asignar —</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <input
                          type="number"
                          value={Number.isNaN(r.qty) ? "" : r.qty}
                          onChange={(e) => setQty(r.id, e.target.value)}
                          aria-label={`Cantidad fila ${r.n}`}
                          className={`h-7 w-16 rounded-md border bg-white px-2 text-right text-[13px] tabular-nums outline-none focus:ring-2 ${
                            validQty(r.qty) ? "border-zinc-200 focus:ring-emerald-200" : "border-red-400 bg-red-50 text-red-700 focus:ring-red-200"
                          }`}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-xs text-zinc-600">{r.method}</td>
                      <td className="px-3 py-1.5"><StatusBadge status={s} /></td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex justify-end gap-1">
                          {s === "suggested" && (
                            <Button size="sm" variant="outline" className="h-7 border-emerald-300 px-2 text-xs text-emerald-700 hover:bg-emerald-50" onClick={() => confirmRows([r.id])}>
                              <Check className="mr-1 h-3.5 w-3.5" />Confirmar
                            </Button>
                          )}
                          <Button size="sm" variant={needs ? "default" : "ghost"} className="h-7 px-2 text-xs" onClick={() => setPicker([r.id])}>
                            {needs ? <Search className="mr-1 h-3.5 w-3.5" /> : <Pencil className="mr-1 h-3.5 w-3.5" />}
                            {s === "none" ? "Buscar" : needs ? "Revisar" : "Cambiar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 text-zinc-500"><FileSearch className="h-5 w-5" /></div>
                <p className="text-sm font-medium text-zinc-800">
                  {filter === "pending" && !query ? "No quedan filas pendientes" : "Ninguna fila coincide con el filtro"}
                </p>
                <p className="text-xs text-zinc-500">
                  {filter === "pending" && !query ? "Todo está identificado. Puedes continuar a validar." : "Prueba con otro estado o término de búsqueda."}
                </p>
                {(query || filter !== "all") && (
                  <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => { setQuery(""); setFilter("all"); }}>
                    <X className="mr-1 h-3 w-3" />Quitar filtros
                  </Button>
                )}
              </div>
            )}
          </div>
          <Pagination page={cur} pages={pages} total={filtered.length} size={PAGE} onPage={setPage} />
        </>
      )}

      <ProductPicker
        ids={picker}
        rows={rows}
        onClose={() => setPicker(null)}
        onPick={assign}
      />
    </div>
  );
}

function ProductPicker({
  ids,
  rows,
  onClose,
  onPick,
}: {
  ids: number[] | null;
  rows: ImportRow[];
  onClose: () => void;
  onPick: (ids: number[], code: string, same: boolean) => void;
}) {
  const [q, setQ] = useState("");
  const [same, setSame] = useState(true);
  const target = ids ? rows.filter((r) => ids.includes(r.id)) : [];
  const single = target.length === 1 ? target[0] : null;
  const ref = single ? origText(single) : "";
  const sameCount = single ? rows.filter((r) => r.id !== single.id && r.kind !== "exact" && normalize(origText(r)).join(" ") === normalize(ref).join(" ")).length : 0;

  const list = useMemo(() => {
    if (!q.trim()) return single ? rank(ref, 6) : getCatalog().slice(0, 8).map((p) => ({ p, score: 0 }));
    return searchCatalog(q)
      .map((p) => ({ p, score: single ? similarity(ref, p.name) : 0 }))
      .sort((a, b) => b.score - a.score);
  }, [q, single, ref]);

  return (
    <Dialog open={!!ids} onOpenChange={(o) => { if (!o) { onClose(); setQ(""); } }}>
      <DialogContent className="max-w-xl gap-0 p-0">
        <DialogHeader className="border-b border-zinc-200 p-5 pb-4">
          <DialogTitle className="text-base">{single ? "Asignar producto" : `Asignar producto a ${target.length} filas`}</DialogTitle>
          <DialogDescription className="sr-only">Selecciona el producto del inventario que corresponde a la fila del Excel.</DialogDescription>
          {single ? (
            <div className="mt-2 grid grid-cols-[1fr_auto] gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm">
              <div className="min-w-0">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Texto original · fila {single.n}</div>
                <div className="truncate font-semibold text-zinc-900">“{single.origName || single.origCode}”</div>
                {single.origCode && single.origName && <div className="font-mono text-xs text-zinc-500">Código: {single.origCode}</div>}
              </div>
              <div className="text-right">
                <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Cantidad</div>
                <div className="font-semibold tabular-nums">{Number.isNaN(single.qty) ? "—" : single.qty}</div>
              </div>
            </div>
          ) : (
            <p className="mt-1 text-sm text-zinc-600">El producto elegido se aplicará a todas las filas seleccionadas. Se conservan los identificadores originales.</p>
          )}
        </DialogHeader>
        <div className="p-5 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar otro producto por código o nombre…" className="h-9 bg-white pl-8" />
          </div>
          <div className="mb-1.5 mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            {q ? `${list.length} resultados` : single ? "Sugerencias por similitud" : "Catálogo"}
          </div>
          <ul className="max-h-[300px] divide-y divide-zinc-100 overflow-auto rounded-md border border-zinc-200">
            {list.map(({ p, score }) => (
              <li key={p.code} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-zinc-900">{p.name}</div>
                  <div className="font-mono text-[11px] text-zinc-500">{p.code} · stock {p.stock}</div>
                </div>
                {single && <SimBar value={score} />}
                <Button size="sm" className="h-7 px-2.5 text-xs" onClick={() => { onPick(ids!, p.code, same && sameCount > 0); setQ(""); }}>
                  Seleccionar
                </Button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-8 text-center text-sm text-zinc-500">No hay productos con “{q}”.</li>}
          </ul>
          {sameCount > 0 && (
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-zinc-700">
              <Checkbox checked={same} onCheckedChange={(v) => setSame(!!v)} />
              Aplicar también a {sameCount} {sameCount === 1 ? "fila" : "filas"} con el mismo texto original
            </label>
          )}
          <p className="mt-3 text-xs text-zinc-500">Los porcentajes indican similitud con el texto original. Ninguna sugerencia se aplica sin tu confirmación.</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
