import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  FileSpreadsheet,
  UploadCloud,
  Download,
  History,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Loader2,
  Layers,
  Boxes,
  UserCheck,
  ListChecks,
  Hash,
  ShieldCheck,
  FileWarning,
  RotateCcw,
  Eye,
  Search,
  Trash2,
  PackagePlus,
  Info,
  Lock,
} from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { Progress } from "../ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { toast } from "sonner";
import { CatalogProduct, DEMO_CATALOG, ImportRow, RawRow, buildRows, demoRows, findProduct, setCatalog, statusOf } from "./matching";
import { fetchCatalog } from "./catalog";
import { getCurrentUser } from "../../lib/supabase";
import { commitImport, fetchImportHistory } from "./commit";
import { Pagination, Stat, Stepper, panel } from "./parts";
import { ReviewStep } from "./ReviewStep";

type View = "wizard" | "result" | "history";
type HistStatus = "Pendiente" | "Procesando" | "Completado" | "Completado con errores" | "Fallido";

interface HistItem {
  id: string;
  file: string;
  date: string;
  user: string;
  products: number;
  units: number;
  status: HistStatus;
  fp?: string;
  note?: string;
}

interface FileInfo {
  name: string;
  size: number;
  raw: RawRow[];
  cols: { header: string; role: string }[];
  demo: boolean;
}

const STEPS = ["Cargar archivo", "Revisar coincidencias", "Validar importación", "Confirmar ingresos"];

const HIST_STYLE: Record<HistStatus, string> = {
  Pendiente: "bg-zinc-100 text-zinc-700 border-zinc-300",
  Procesando: "bg-sky-50 text-sky-800 border-sky-200",
  Completado: "bg-emerald-50 text-emerald-800 border-emerald-200",
  "Completado con errores": "bg-amber-50 text-amber-800 border-amber-200",
  Fallido: "bg-red-50 text-red-700 border-red-200",
};

const kb = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
const stamp = (d: Date = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

const clean = (v: unknown) => String(v ?? "").replace(/^"|"$/g, "").trim();
const fold = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function parseMatrix(matrix: unknown[][]): { raw: RawRow[]; cols: FileInfo["cols"] } | string {
  const grid = matrix.map((r) => r.map(clean)).filter((r) => r.some(Boolean));
  if (grid.length < 2) return "El archivo no contiene filas de datos.";
  const idx = (head: string[], re: RegExp) => head.findIndex((h) => re.test(fold(h)));
  // La fila de encabezados es la primera (de las 10 primeras) que contenga una columna de cantidad
  const hi = grid.slice(0, 10).findIndex((r) => idx(r, /^(cantidad|cant|qty|unidades)/) >= 0);
  if (hi < 0) return "No se encontró la columna “Cantidad”. Revisa los encabezados del archivo.";
  const head = grid[hi];
  const ic = idx(head, /^(codigo|sku|ref)/);
  const ip = idx(head, /^(producto|nombre|descripcion)/);
  const iq = idx(head, /^(cantidad|cant|qty|unidades)/);
  if (ic < 0 && ip < 0) return "No se encontró ninguna columna “Código” ni “Producto”.";
  const raw = grid.slice(hi + 1).map((c) => ({
    code: ic >= 0 ? c[ic] ?? "" : "",
    name: ip >= 0 ? c[ip] ?? "" : "",
    qty: c[iq] === "" || c[iq] === undefined ? NaN : Number(c[iq].replace(",", ".")),
  }));
  const cols: FileInfo["cols"] = [];
  if (ic >= 0) cols.push({ header: head[ic], role: "Código" });
  if (ip >= 0) cols.push({ header: head[ip], role: "Producto" });
  cols.push({ header: head[iq], role: "Cantidad" });
  return { raw, cols };
}

async function readFileMatrix(f: File): Promise<unknown[][]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error("El libro no tiene hojas.");
  const m = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  // CSV con punto y coma: SheetJS lo deja en una sola columna
  const semi = m.length > 0 && m.every((r) => r.length <= 1) && m.some((r) => String(r[0] ?? "").includes(";"));
  return semi ? m.map((r) => String(r[0] ?? "").split(";")) : m;
}

export function BulkImportModule({ onBack }: { onBack: () => void }) {
  const [view, setView] = useState<View>("wizard");
  const [step, setStep] = useState(0);
  const [maxStep, setMaxStep] = useState(0);
  const [phase, setPhase] = useState<"idle" | "reading" | "error" | "ready">("idle");
  const [error, setError] = useState("");
  const [file, setFile] = useState<FileInfo | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [drag, setDrag] = useState(false);
  const [history, setHistory] = useState<HistItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<HistItem | null>(null);
  const [detail, setDetail] = useState<HistItem | null>(null);
  const [reviewFilter, setReviewFilter] = useState<"all" | "pending">("all");
  const [reviewKey, setReviewKey] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const [cat, setCat] = useState<{ state: "loading" | "ready" | "error"; products: CatalogProduct[] }>({ state: "loading", products: [] });
  const [demoMode, setDemoMode] = useState(false);
  const [imported, setImported] = useState(false);

  const loadCatalog = () => {
    setCat({ state: "loading", products: [] });
    fetchCatalog()
      .then((products) => {
        setCatalog(products);
        setCat({ state: "ready", products });
      })
      .catch((e) => {
        console.error("Error cargando catálogo:", e);
        setCat({ state: "error", products: [] });
      });
  };
  useEffect(() => {
    fetchImportHistory()
      .then((rows) =>
        setHistory(
          rows.map((r) => ({
            id: r.reference,
            file: r.file_name,
            date: stamp(new Date(r.created_at)),
            user: r.user_name || "—",
            products: r.products,
            units: r.units,
            status: r.status as HistStatus,
            fp: r.fingerprint,
            note: r.note ?? undefined,
          }))
        )
      )
      .catch((e) => console.error("Historial de importaciones no disponible (¿tabla bulk_imports creada?):", e));
    loadCatalog();
  }, []);

  // ---------- Derivados ----------
  const stats = useMemo(() => {
    const s = { total: rows.length, ok: 0, manual: 0, suggested: 0, none: 0, error: 0, ambiguous: 0 };
    rows.forEach((r) => {
      const st = statusOf(r);
      if (st === "exact" || st === "manual") s.ok++;
      if (st === "manual") s.manual++;
      if (st === "suggested") s.suggested++;
      if (st === "none") s.none++;
      if (st === "error") s.error++;
      if (r.ambiguous && st === "manual") s.ambiguous++;
    });
    return s;
  }, [rows]);

  const groups = useMemo(() => {
    const m = new Map<string, { rows: ImportRow[]; total: number }>();
    rows.forEach((r) => {
      const st = statusOf(r);
      if (!r.productCode || (st !== "exact" && st !== "manual")) return;
      const g = m.get(r.productCode) ?? { rows: [], total: 0 };
      g.rows.push(r);
      g.total += r.qty;
      m.set(r.productCode, g);
    });
    return [...m.entries()].map(([code, g]) => ({ code, ...g, product: findProduct(code)! })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const pendingCount = stats.suggested + stats.none + stats.error;
  const totalUnits = groups.reduce((a, g) => a + g.total, 0);
  const dupGroups = groups.filter((g) => g.rows.length > 1);
  const fingerprint = file ? `${file.name}|${file.size}|${rows.length}|${totalUnits}` : "";
  const alreadyRun = history.find((h) => h.fp === fingerprint);
  const blocked = pendingCount > 0;

  const headerStatus = (() => {
    if (view === "history") return { label: "Consultando historial", cls: "bg-zinc-100 text-zinc-700 border-zinc-300", dot: "bg-zinc-400" };
    if (view === "result") return { label: "Importación completada", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" };
    if (progress !== null) return { label: "Procesando…", cls: "bg-sky-50 text-sky-800 border-sky-200", dot: "bg-sky-500 animate-pulse" };
    if (phase !== "ready") return { label: "Sin archivo", cls: "bg-zinc-100 text-zinc-700 border-zinc-300", dot: "bg-zinc-400" };
    if (step === 3 && !blocked) return { label: "Lista para confirmar", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" };
    if (blocked) return { label: `En revisión · ${pendingCount} pendientes`, cls: "bg-amber-50 text-amber-800 border-amber-200", dot: "bg-amber-500" };
    return { label: "Revisión completa", cls: "bg-emerald-50 text-emerald-800 border-emerald-200", dot: "bg-emerald-500" };
  })();

  // ---------- Acciones ----------
  const fail = (msg: string) => {
    setError(msg);
    setPhase("error");
    setFile(null);
  };

  const load = (info: FileInfo) => {
    setPhase("reading");
    setError("");
    setTimeout(() => {
      setFile(info);
      setRows(buildRows(info.raw));
      setPhase("ready");
    }, 900);
  };

  const demo = (name = "ingreso_mercancia_junio.xlsx", size = 48_230) => {
    setCatalog(DEMO_CATALOG);
    setDemoMode(true);
    load({
      name,
      size,
      raw: demoRows(),
      demo: true,
      cols: [{ header: "Código", role: "Código" }, { header: "Producto", role: "Producto" }, { header: "Cantidad", role: "Cantidad" }],
    });
  };

  const handleFile = (f?: File) => {
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls", "csv"].includes(ext)) return fail(`El formato “.${ext ?? "?"}” no es compatible. Usa XLSX, XLS o CSV.`);
    if (f.size > 10 * 1048576) return fail("El archivo supera el límite de 10 MB.");
    if (cat.state !== "ready") return fail(cat.state === "loading" ? "El catálogo de productos aún se está cargando. Intenta de nuevo en unos segundos." : "No se pudo cargar el catálogo de productos. Reintenta la conexión e inténtalo otra vez.");
    setCatalog(cat.products);
    setDemoMode(false);
    setPhase("reading");
    readFileMatrix(f)
      .then((m) => {
        const res = parseMatrix(m);
        if (typeof res === "string") return fail(res);
        load({ name: f.name, size: f.size, raw: res.raw, cols: res.cols, demo: false });
      })
      .catch(() => fail("No se pudo leer el archivo. Verifica que no esté dañado ni protegido con contraseña."));
  };

  const reset = () => {
    if (imported) {
      loadCatalog();
      setImported(false);
    }
    if (!imported && cat.state === "ready") setCatalog(cat.products);
    setDemoMode(false);
    setView("wizard");
    setStep(0);
    setMaxStep(0);
    setPhase("idle");
    setFile(null);
    setRows([]);
    setResult(null);
    setProgress(null);
  };

  const go = (i: number) => {
    setStep(i);
    setMaxStep((m) => Math.max(m, i));
  };

  const goReview = (filter: "all" | "pending") => {
    setReviewFilter(filter);
    setReviewKey((k) => k + 1);
    setStep(1);
  };

  const template = async (fmt: "csv" | "xlsx" | "xls") => {
    const data = [
      ["Código", "Producto", "Cantidad"],
      ["SAM-A15", "Samsung Galaxy A15 128GB", 10],
      ["IP13-128", "iPhone 13 128GB", 5],
    ];
    if (fmt === "csv") {
      download("plantilla_importacion_inventario.csv", data.map((r) => r.join(",")).join("\n"));
    } else {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = [{ wch: 14 }, { wch: 34 }, { wch: 10 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
      XLSX.writeFile(wb, `plantilla_importacion_inventario.${fmt}`, { bookType: fmt === "xls" ? "biff8" : "xlsx" });
    }
    toast.success(`Plantilla .${fmt} descargada`);
  };

  const execute = async () => {
    setConfirmOpen(false);
    setProgress(0);
    if (demoMode) {
      // Archivo de ejemplo: simulación local, no escribe en la base de datos
      const t = setInterval(() => {
        setProgress((p) => {
          const n = (p ?? 0) + 7 + Math.random() * 9;
          if (n >= 100) {
            clearInterval(t);
            const item: HistItem = { id: `DEMO-${String(history.length + 1).padStart(4, "0")}`, file: file!.name, date: stamp(), user: "Demo", products: groups.length, units: totalUnits, status: "Completado", fp: fingerprint, note: "Simulación: no se modificó el inventario." };
            setHistory((h) => [item, ...h]);
            setResult(item);
            setProgress(null);
            setView("result");
            toast.success("Simulación completada (sin cambios en inventario)");
            return 100;
          }
          return n;
        });
      }, 220);
      return;
    }
    try {
      const res = await commitImport(
        groups.map((g) => ({ productId: g.product.id, code: g.code, name: g.product.name, qty: g.total, sourceRows: g.rows.map((r) => r.n) })),
        { name: file!.name, fingerprint },
        (pct) => setProgress(pct)
      );
      const item: HistItem = {
        id: res.reference,
        file: file!.name,
        date: stamp(),
        user: getCurrentUser()?.username || "Usuario",
        products: res.ok,
        units: res.totalUnits,
        status: res.status,
        fp: fingerprint,
        note: res.failed.length ? `${res.failed.length} producto(s) con error: ${res.failed.map((f) => f.code).join(", ")}` : undefined,
      };
      setHistory((h) => [item, ...h]);
      setProgress(null);
      if (res.status === "Fallido") {
        toast.error("No se pudo registrar ningún ingreso. Revisa la conexión e inténtalo de nuevo.");
        return;
      }
      setResult(item);
      setView("result");
      if (res.failed.length) toast.warning(`Importación con errores: ${res.failed.length} producto(s) no se ingresaron`);
      else toast.success("Ingreso de inventario registrado");
      setImported(true);
    } catch (e) {
      console.error(e);
      setProgress(null);
      toast.error("Error inesperado durante la importación");
    }
  };

  const report = () => {
    if (!result) return;
    const lines = ["Movimiento,Código,Producto,Cantidad,Stock anterior,Stock nuevo,Filas origen"];
    groups.forEach((g, i) =>
      lines.push(`MOV-${result.id.slice(-4)}-${String(i + 1).padStart(3, "0")},${g.code},"${g.product.name}",${g.total},${g.product.stock},${g.product.stock + g.total},${g.rows.map((r) => r.n).join(" ")}`)
    );
    download(`reporte_${result.id}.csv`, lines.join("\n"));
  };

  // ---------- Render ----------
  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={onBack} className="mb-1.5 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition-colors hover:text-emerald-700">
            <ArrowLeft className="h-3.5 w-3.5" /> Movimientos de inventario
          </button>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Importación masiva de inventario</h2>
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${headerStatus.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${headerStatus.dot}`} />
              {headerStatus.label}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Importa productos desde Excel y registra múltiples entradas de mercancía en una sola operación.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(view === "history" ? (result ? "result" : "wizard") : "history")}>
            <History className="mr-1.5 h-4 w-4" />
            {view === "history" ? "Volver al importador" : "Historial"}
          </Button>
          <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" />Descargar plantilla</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => template("xlsx")}>Excel (.xlsx)</DropdownMenuItem><DropdownMenuItem onClick={() => template("xls")}>Excel 97-2003 (.xls)</DropdownMenuItem><DropdownMenuItem onClick={() => template("csv")}>CSV (.csv)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </div>

      {view === "history" && <HistoryView items={history} onDetail={setDetail} />}

      {view === "result" && result && (
        <ResultView result={result} groups={groups} onHistory={() => setView("history")} onReport={report} onNew={reset} />
      )}

      {view === "wizard" && (
        <>
          <Stepper steps={STEPS} current={step} maxReached={maxStep} onGo={setStep} />

          {/* PASO 1 */}
          {step === 0 && (
            <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs">
                  {cat.state === "loading" && <span className="inline-flex items-center gap-1.5 text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando catálogo de productos…</span>}
                  {cat.state === "ready" && <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Catálogo conectado · {cat.products.length.toLocaleString("es-CO")} productos</span>}
                  {cat.state === "error" && (
                    <span className="inline-flex items-center gap-1.5 text-red-700"><XCircle className="h-3.5 w-3.5" />No se pudo cargar el catálogo.
                      <button onClick={loadCatalog} className="font-semibold underline underline-offset-2">Reintentar</button>
                    </span>
                  )}
                  {demoMode && <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">Modo demostración · catálogo de ejemplo</span>}
                </div>
                <div
                  onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                  onDragLeave={() => setDrag(false)}
                  onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
                  className={`${panel} flex flex-col items-center border-dashed px-6 py-12 text-center transition-colors ${
                    drag ? "border-emerald-500 bg-emerald-50/60" : phase === "error" ? "border-red-300 bg-red-50/30" : "border-zinc-300"
                  }`}
                >
                  {phase === "reading" ? (
                    <>
                      <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
                      <p className="mt-4 text-base font-semibold text-zinc-900">Leyendo archivo…</p>
                      <p className="mt-1 text-sm text-zinc-500">Detectando columnas y buscando coincidencias en el catálogo</p>
                    </>
                  ) : (
                    <>
                      <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${phase === "error" ? "bg-red-100 text-red-600" : "bg-emerald-50 text-emerald-700"}`}>
                        {phase === "error" ? <FileWarning className="h-7 w-7" /> : <FileSpreadsheet className="h-7 w-7" />}
                      </div>
                      {phase === "error" ? (
                        <>
                          <p className="mt-4 text-base font-semibold text-red-700">No pudimos leer el archivo</p>
                          <p className="mt-1 max-w-md text-sm text-red-600">{error}</p>
                        </>
                      ) : (
                        <>
                          <p className="mt-4 text-base font-semibold text-zinc-900">Arrastra tu archivo aquí</p>
                          <p className="mt-1 text-sm text-zinc-500">O selecciona un archivo desde tu dispositivo</p>
                        </>
                      )}
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <Button onClick={() => input.current?.click()}>
                          <UploadCloud className="mr-1.5 h-4 w-4" />
                          {phase === "error" ? "Intentar con otro archivo" : phase === "ready" ? "Cambiar archivo" : "Seleccionar archivo"}
                        </Button>
                        {phase !== "ready" && (
                          <Button variant="outline" onClick={() => demo()}>Usar archivo de ejemplo</Button>
                        )}
                      </div>
                      <p className="mt-4 text-xs text-zinc-500">Formatos admitidos: XLSX, XLS y CSV · máx. 10 MB</p>
                    </>
                  )}
                  <input ref={input} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} />
                </div>

                {phase === "ready" && file && (
                  <div className={`${panel} p-4`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700"><FileSpreadsheet className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-zinc-900">{file.name}</div>
                        <div className="text-xs text-zinc-500">{kb(file.size)} · {file.raw.length} filas detectadas</div>
                      </div>
                      <button onClick={reset} className="rounded-md p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600" aria-label="Quitar archivo">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-4 border-t border-zinc-100 pt-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Columnas identificadas</div>
                      <div className="flex flex-wrap gap-2">
                        {file.cols.map((c) => (
                          <span key={c.role} className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs">
                            <span className="font-medium text-zinc-800">{c.header}</span>
                            <ArrowRight className="h-3 w-3 text-zinc-400" />
                            <span className="font-semibold text-emerald-700">{c.role}</span>
                          </span>
                        ))}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-600">
                        <span><b className="tabular-nums text-zinc-900">{stats.ok}</b> con código exacto reconocido</span>
                        <span><b className="tabular-nums text-zinc-900">{stats.total - stats.ok}</b> requerirán revisión</span>
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button onClick={() => goReview("all")}>Continuar a revisión <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>

              <aside className={`${panel} h-fit p-4 text-sm`}>
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Estructuras aceptadas</div>
                {[
                  { t: "Formato A · por código", h: ["Código", "Cantidad"], r: [["SAM-A15", "10"], ["IP13-128", "5"]] },
                  { t: "Formato B · por nombre", h: ["Producto", "Cantidad"], r: [["Samsung Galaxy A15", "10"], ["iPhone 13 128GB", "5"]] },
                ].map((f) => (
                  <div key={f.t} className="mb-3">
                    <div className="mb-1 text-xs font-medium text-zinc-700">{f.t}</div>
                    <table className="w-full overflow-hidden rounded-md border border-zinc-200 text-xs">
                      <thead className="bg-zinc-50"><tr>{f.h.map((h, i) => <th key={h} className={`px-2 py-1 font-semibold text-zinc-600 ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
                      <tbody>{f.r.map((r) => <tr key={r[0]} className="border-t border-zinc-100"><td className="px-2 py-1 font-mono">{r[0]}</td><td className="px-2 py-1 text-right tabular-nums">{r[1]}</td></tr>)}</tbody>
                    </table>
                  </div>
                ))}
                <p className="text-xs text-zinc-500">También puedes incluir código y nombre en el mismo archivo.</p>
                <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3 text-xs text-zinc-600">
                  <p className="flex gap-2"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Solo los códigos exactos se confirman solos.</p>
                  <p className="flex gap-2"><Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />Verás una vista previa antes de ingresar nada.</p>
                </div>
                <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm" className="mt-4 w-full"><Download className="mr-1.5 h-4 w-4" />Descargar plantilla</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => template("xlsx")}>Excel (.xlsx)</DropdownMenuItem><DropdownMenuItem onClick={() => template("xls")}>Excel 97-2003 (.xls)</DropdownMenuItem><DropdownMenuItem onClick={() => template("csv")}>CSV (.csv)</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              </aside>
            </div>
          )}

          {/* PASO 2 */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Stat label="Total de filas" value={stats.total} icon={<ListChecks className="h-4 w-4" />} />
                <Stat label="Confirmadas" value={stats.ok} icon={<CheckCircle2 className="h-4 w-4" />} tone="good" hint={`${Math.round((stats.ok / Math.max(1, stats.total)) * 100)}%`} />
                <Stat label="Pendientes de revisión" value={stats.suggested + stats.error} icon={<AlertTriangle className="h-4 w-4" />} tone="warn" />
                <Stat label="No encontrados" value={stats.none} icon={<XCircle className="h-4 w-4" />} tone={stats.none ? "bad" : "neutral"} />
              </div>
              <ReviewStep key={reviewKey} rows={rows} setRows={setRows} initialFilter={reviewFilter} />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => go(0)}><ArrowLeft className="mr-1.5 h-4 w-4" />Cargar otro archivo</Button>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${blocked ? "text-amber-700" : "text-emerald-700"}`}>
                    {blocked ? `${pendingCount} productos pendientes de resolver` : "Todas las filas están identificadas"}
                  </span>
                  <Button onClick={() => go(2)}>Validar importación<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 3 */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                <Stat label="Identificados" value={groups.length} icon={<Boxes className="h-4 w-4" />} tone="good" />
                <Stat label="Unidades a ingresar" value={totalUnits.toLocaleString("es-CO")} icon={<PackagePlus className="h-4 w-4" />} tone="good" />
                <Stat label="Corregidos a mano" value={stats.manual} icon={<UserCheck className="h-4 w-4" />} tone="info" />
                <Stat label="Con errores" value={stats.error} icon={<XCircle className="h-4 w-4" />} tone={stats.error ? "bad" : "neutral"} />
                <Stat label="Pendientes" value={stats.suggested + stats.none} icon={<AlertTriangle className="h-4 w-4" />} tone={stats.suggested + stats.none ? "warn" : "neutral"} />
              </div>

              <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
                <div className={`${panel} overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-2.5">
                    <h3 className="text-sm font-semibold text-zinc-900">Resumen por producto</h3>
                    <span className="text-xs text-zinc-500">{groups.length} productos · {groups.length} movimientos de entrada</span>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    <table className="w-full text-[13px]">
                      <thead className="sticky top-0 bg-zinc-50">
                        <tr className="border-b border-zinc-200 text-[11px] uppercase tracking-wide text-zinc-500">
                          <th className="px-4 py-2 text-left font-semibold">Código</th>
                          <th className="px-4 py-2 text-left font-semibold">Producto</th>
                          <th className="px-4 py-2 text-right font-semibold">Filas</th>
                          <th className="px-4 py-2 text-right font-semibold">Cantidad total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((g) => (
                          <tr key={g.code} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                            <td className="px-4 py-1.5 font-mono text-xs text-zinc-700">{g.code}</td>
                            <td className="px-4 py-1.5 text-zinc-900">{g.product.name}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-zinc-500">{g.rows.length > 1 ? <span className="rounded bg-sky-50 px-1.5 text-sky-700">{g.rows.length}×</span> : 1}</td>
                            <td className="px-4 py-1.5 text-right font-semibold tabular-nums">{g.total}</td>
                          </tr>
                        ))}
                        {groups.length === 0 && (
                          <tr><td colSpan={4} className="py-12 text-center text-sm text-zinc-500">Aún no hay productos identificados para importar.</td></tr>
                        )}
                      </tbody>
                      {groups.length > 0 && (
                        <tfoot className="sticky bottom-0 bg-zinc-50">
                          <tr className="border-t border-zinc-200 font-semibold"><td colSpan={3} className="px-4 py-2 text-right text-zinc-600">Total unidades</td><td className="px-4 py-2 text-right tabular-nums">{totalUnits}</td></tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>

                <div className={`${panel} h-fit p-4`}>
                  <h3 className="mb-3 text-sm font-semibold text-zinc-900">Advertencias</h3>
                  <div className="space-y-2">
                    {stats.suggested + stats.none > 0 && (
                      <Warn level="block" title={`${stats.suggested + stats.none} productos sin asignar`} text="Hay filas sugeridas o sin coincidencia. Confirma o asigna un producto real." action="Ir a corregir" onAction={() => goReview("pending")} />
                    )}
                    {stats.error > 0 && (
                      <Warn level="block" title={`${stats.error} cantidades inválidas`} text="Las cantidades deben ser números enteros mayores a cero." action="Corregir cantidades" onAction={() => goReview("pending")} />
                    )}
                    {stats.ambiguous > 0 && (
                      <Warn level="warn" title={`${stats.ambiguous} identificadores ambiguos`} text="Varias referencias tenían similitud parecida. Se resolvieron manualmente." />
                    )}
                    {dupGroups.length > 0 && (
                      <Warn level="warn" title={`${dupGroups.length} productos repetidos en el archivo`} text={`Se sumarán sus cantidades en un solo movimiento (ej. ${dupGroups[0].product.name}: ${dupGroups[0].total} u.). Las filas originales se conservan.`} />
                    )}
                    {!blocked && (
                      <Warn level="ok" title="Sin errores bloqueantes" text="Todos los productos están identificados y las cantidades son válidas." />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button variant="outline" onClick={() => goReview(blocked ? "pending" : "all")}><ArrowLeft className="mr-1.5 h-4 w-4" />Volver y corregir</Button>
                <div className="flex items-center gap-3">
                  {blocked && <span className="flex items-center gap-1.5 text-sm text-red-700"><Lock className="h-3.5 w-3.5" />Resuelve los {pendingCount} pendientes para continuar</span>}
                  <Button disabled={blocked} onClick={() => go(3)}>Continuar a confirmación<ArrowRight className="ml-1.5 h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )}

          {/* PASO 4 */}
          {step === 3 && file && (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className={`${panel} p-6`}>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><PackagePlus className="h-5 w-5" /></div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-900">Todo listo para ingresar mercancía</h3>
                    <p className="text-sm text-zinc-500">Revisa el resumen final. Esta acción no se puede ejecutar dos veces.</p>
                  </div>
                </div>
                <dl className="mt-5 grid grid-cols-2 divide-zinc-100 overflow-hidden rounded-md border border-zinc-200 sm:grid-cols-4 sm:divide-x">
                  {[
                    { l: "Archivo", v: file.name, small: true },
                    { l: "Productos", v: groups.length },
                    { l: "Unidades totales", v: totalUnits.toLocaleString("es-CO") },
                    { l: "Movimientos", v: groups.length },
                  ].map((d) => (
                    <div key={d.l} className="min-w-0 border-b border-zinc-100 p-3.5 sm:border-b-0">
                      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{d.l}</dt>
                      <dd className={`mt-0.5 truncate font-semibold tabular-nums text-zinc-900 ${d.small ? "text-sm leading-7" : "text-xl"}`} title={String(d.v)}>{d.v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-4 flex gap-2.5 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  Esta operación generará movimientos de entrada en el inventario. Las cantidades se incorporarán al stock existente y quedarán registradas en el historial.
                </div>
                <ul className="mt-4 grid gap-1.5 text-xs text-zinc-600 sm:grid-cols-2">
                  {[
                    "El stock no se modifica directamente: cada producto genera un movimiento de entrada.",
                    "Se conserva el texto original del Excel de cada fila.",
                    "Cada operación queda registrada con usuario, fecha e ID.",
                    "Protegida contra doble ejecución del mismo archivo.",
                  ].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{t}</li>
                  ))}
                </ul>
                {alreadyRun && (
                  <div className="mt-4 flex gap-2.5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>Este archivo ya fue importado en <b>{alreadyRun.id}</b> ({alreadyRun.date}). Para evitar duplicados no es posible ejecutarlo de nuevo.</span>
                  </div>
                )}
                {progress !== null && (
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs text-zinc-600"><span>Generando movimientos de entrada…</span><span className="tabular-nums">{Math.min(100, Math.round(progress))}%</span></div>
                    <Progress value={Math.min(100, progress)} className="h-2" />
                  </div>
                )}
                <div className="mt-6 flex flex-wrap justify-between gap-2">
                  <Button variant="outline" disabled={progress !== null} onClick={() => go(2)}><ArrowLeft className="mr-1.5 h-4 w-4" />Volver a revisar</Button>
                  <Button disabled={progress !== null || !!alreadyRun || blocked} onClick={() => setConfirmOpen(true)}>
                    {progress !== null ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                    Confirmar ingreso de inventario
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Ingresar {totalUnits} unidades al inventario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se generarán {groups.length} movimientos de entrada a partir de “{file?.name}”. Esta acción no se puede deshacer desde el importador.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={execute}>Sí, ingresar mercancía</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-md">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">{detail.id}</DialogTitle>
                <DialogDescription>{detail.file}</DialogDescription>
              </DialogHeader>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {[["Fecha", detail.date], ["Responsable", detail.user], ["Productos", detail.products], ["Unidades", detail.units], ["Movimientos", detail.status === "Fallido" || detail.status === "Pendiente" ? 0 : detail.products]].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-[11px] uppercase tracking-wide text-zinc-500">{k}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
                ))}
                <div><dt className="text-[11px] uppercase tracking-wide text-zinc-500">Estado</dt><dd><HistBadge s={detail.status} /></dd></div>
              </dl>
              {detail.note && <p className="rounded-md border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{detail.note}</p>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Warn({ level, title, text, action, onAction }: { level: "block" | "warn" | "ok"; title: string; text: string; action?: string; onAction?: () => void }) {
  const m = {
    block: { c: "border-red-200 bg-red-50", t: "text-red-800", i: <XCircle className="h-4 w-4 text-red-600" /> },
    warn: { c: "border-amber-200 bg-amber-50", t: "text-amber-900", i: <AlertTriangle className="h-4 w-4 text-amber-600" /> },
    ok: { c: "border-emerald-200 bg-emerald-50", t: "text-emerald-900", i: <CheckCircle2 className="h-4 w-4 text-emerald-600" /> },
  }[level];
  return (
    <div className={`flex gap-2.5 rounded-md border p-3 ${m.c}`}>
      <div className="mt-0.5 shrink-0">{m.i}</div>
      <div className="min-w-0 text-sm">
        <div className={`font-semibold ${m.t}`}>
          {title}
          {level === "block" && <span className="ml-1.5 rounded bg-red-100 px-1 text-[10px] font-semibold uppercase text-red-700">Bloquea</span>}
        </div>
        <p className="mt-0.5 text-xs text-zinc-700">{text}</p>
        {action && <button onClick={onAction} className="mt-1.5 text-xs font-semibold text-red-700 underline-offset-2 hover:underline">{action} →</button>}
      </div>
    </div>
  );
}

function HistBadge({ s }: { s: HistStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${HIST_STYLE[s]}`}>
      {s === "Procesando" && <Loader2 className="h-3 w-3 animate-spin" />}
      {s}
    </span>
  );
}

function ResultView({
  result,
  groups,
  onHistory,
  onReport,
  onNew,
}: {
  result: HistItem;
  groups: { code: string; total: number; rows: ImportRow[]; product: { name: string; stock: number } }[];
  onHistory: () => void;
  onReport: () => void;
  onNew: () => void;
}) {
  const [page, setPage] = useState(1);
  const size = 10;
  const pages = Math.max(1, Math.ceil(groups.length / size));
  return (
    <div className="space-y-4">
      <div className={`${panel} flex flex-wrap items-center gap-4 border-emerald-200 bg-emerald-50/50 p-5`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-white"><CheckCircle2 className="h-6 w-6" /></div>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-zinc-900">Importación completada</h3>
          <p className="text-sm text-zinc-600">Las entradas quedaron registradas en el historial de movimientos.</p>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div><div className="text-[11px] uppercase tracking-wide text-zinc-500">ID de importación</div><div className="font-mono font-semibold">{result.id}</div></div>
          <div><div className="text-[11px] uppercase tracking-wide text-zinc-500">Fecha y hora</div><div className="font-semibold tabular-nums">{result.date}</div></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Procesados" value={groups.length} icon={<CheckCircle2 className="h-4 w-4" />} tone="good" hint="productos" />
        <Stat label="Movimientos generados" value={groups.length} icon={<Layers className="h-4 w-4" />} tone="good" />
        <Stat label="Unidades ingresadas" value={result.units.toLocaleString("es-CO")} icon={<PackagePlus className="h-4 w-4" />} tone="info" />
        <Stat label="Con errores" value={0} icon={<XCircle className="h-4 w-4" />} />
      </div>
      <div className={`${panel} overflow-hidden`}>
        <div className="border-b border-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-900">Movimientos procesados</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
              <tr className="border-b border-zinc-200">
                <th className="px-4 py-2 text-left font-semibold">Movimiento</th>
                <th className="px-4 py-2 text-left font-semibold">Producto</th>
                <th className="px-4 py-2 text-right font-semibold">Entrada</th>
                <th className="px-4 py-2 text-right font-semibold">Stock</th>
                <th className="px-4 py-2 text-left font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody>
              {groups.slice((page - 1) * size, page * size).map((g, i) => (
                <tr key={g.code} className="border-b border-zinc-100">
                  <td className="px-4 py-1.5 font-mono text-xs text-zinc-600">MOV-{result.id.slice(-4)}-{String((page - 1) * size + i + 1).padStart(3, "0")}</td>
                  <td className="px-4 py-1.5"><div className="text-zinc-900">{g.product.name}</div><div className="font-mono text-[11px] text-zinc-500">{g.code}</div></td>
                  <td className="px-4 py-1.5 text-right font-semibold tabular-nums text-emerald-700">+{g.total}</td>
                  <td className="px-4 py-1.5 text-right tabular-nums text-zinc-600">{g.product.stock} → <b className="text-zinc-900">{g.product.stock + g.total}</b></td>
                  <td className="px-4 py-1.5"><span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Registrado</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} pages={pages} total={groups.length} size={size} onPage={setPage} />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onHistory}><History className="mr-1.5 h-4 w-4" />Ver historial de importaciones</Button>
        <Button variant="outline" onClick={onReport}><Download className="mr-1.5 h-4 w-4" />Descargar reporte</Button>
        <Button onClick={onNew}><RotateCcw className="mr-1.5 h-4 w-4" />Realizar nueva importación</Button>
      </div>
    </div>
  );
}

function HistoryView({ items, onDetail }: { items: HistItem[]; onDetail: (h: HistItem) => void }) {
  const [q, setQ] = useState("");
  const [st, setSt] = useState<"all" | HistStatus>("all");
  const list = items.filter((h) => (st === "all" || h.status === st) && `${h.id} ${h.file} ${h.user}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className={`${panel} overflow-hidden`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2.5">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar ID, archivo o usuario…" className="h-8 bg-white pl-8 text-sm" />
        </div>
        <select value={st} onChange={(e) => setSt(e.target.value as "all" | HistStatus)} className="h-8 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700">
          <option value="all">Todos los estados</option>
          {(Object.keys(HIST_STYLE) as HistStatus[]).map((s) => <option key={s}>{s}</option>)}
        </select>
        <span className="ml-auto text-xs text-zinc-500">{list.length} importaciones</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead className="bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
            <tr className="border-b border-zinc-200">
              {["Identificador", "Archivo", "Fecha", "Responsable", "Productos", "Unidades", "Estado", ""].map((h, i) => (
                <th key={h + i} className={`px-3 py-2 font-semibold ${i === 4 || i === 5 ? "text-right" : "text-left"}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((h) => (
              <tr key={h.id} className="border-b border-zinc-100 hover:bg-zinc-50/70">
                <td className="px-3 py-2 font-mono text-xs font-semibold text-zinc-800"><Hash className="mr-0.5 inline h-3 w-3 text-zinc-400" />{h.id}</td>
                <td className="max-w-[240px] truncate px-3 py-2 text-zinc-900" title={h.file}><FileSpreadsheet className="mr-1.5 inline h-3.5 w-3.5 text-emerald-600" />{h.file}</td>
                <td className="px-3 py-2 tabular-nums text-zinc-600">{h.date}</td>
                <td className="px-3 py-2 text-zinc-700">{h.user}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.products}</td>
                <td className="px-3 py-2 text-right tabular-nums">{h.units}</td>
                <td className="px-3 py-2"><HistBadge s={h.status} /></td>
                <td className="px-3 py-2 text-right"><Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => onDetail(h)}><Eye className="mr-1 h-3.5 w-3.5" />Detalle</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length === 0 && <div className="py-14 text-center text-sm text-zinc-500">No hay importaciones que coincidan con tu búsqueda.</div>}
      </div>
    </div>
  );
}
