import {
  supabase,
  getCurrentCompany,
  getCurrentUser,
  addMovement,
  addMovementReceipt,
  updateProduct,
  logActivity,
} from "../../lib/supabase";

export interface CommitGroup {
  productId: string;
  code: string;
  name: string;
  qty: number;
  sourceRows: number[];
}

export interface CommitResult {
  reference: string;
  ok: number;
  failed: { code: string; error: string }[];
  totalUnits: number;
  receiptId?: string;
  status: "Completado" | "Completado con errores" | "Fallido";
  stock: Record<string, { before: number; after: number }>;
}

export interface BulkImportRecord {
  id: string;
  reference: string;
  file_name: string;
  user_name: string;
  products: number;
  units: number;
  status: string;
  note: string | null;
  fingerprint: string;
  created_at: string;
}

export const nextReference = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `IMP-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
};

export async function fetchImportHistory(): Promise<BulkImportRecord[]> {
  const { data, error } = await supabase
    .from("bulk_imports")
    .select("*")
    .eq("company", getCurrentCompany())
    .order("created_at", { ascending: false })
    .limit(200);
  // PGRST205: la tabla aún no existe (falta ejecutar bulk_imports.sql); se trata como historial vacío
  if (error) {
    if ((error as any).code === "PGRST205") {
      console.warn("[bulk-import] La tabla bulk_imports no existe todavía. Ejecuta bulk_imports.sql en Supabase.");
      return [];
    }
    throw error;
  }
  return (data ?? []) as BulkImportRecord[];
}

/** Aplica la importación: actualiza stock, genera movimientos, comprobante, historial y registro de actividad. */
export async function commitImport(
  groups: CommitGroup[],
  file: { name: string; fingerprint: string },
  onProgress: (pct: number) => void
): Promise<CommitResult> {
  const reference = nextReference();
  const userName = getCurrentUser()?.username || "Usuario";
  const reason = `Carga masiva: ${file.name}`;
  const failed: CommitResult["failed"] = [];
  const processed: any[] = [];
  const stock: CommitResult["stock"] = {};

  for (let i = 0; i < groups.length; i++) {
    const g = groups[i];
    try {
      const { data: p, error } = await supabase.from("products").select("*").eq("id", g.productId).single();
      if (error || !p) throw new Error("Producto no encontrado");
      const before = Number(p.stock) || 0;
      const after = before + g.qty;
      await updateProduct(p.id, { stock: after });
      try {
        await addMovement({
          type: "entry",
          product_id: p.id,
          product_name: p.name,
          quantity: g.qty,
          reason,
          reference,
          user_name: userName,
          unit_ids: [],
        });
      } catch (e) {
        await updateProduct(p.id, { stock: before }); // revertir stock si falla el movimiento
        throw e;
      }
      stock[g.code] = { before, after };
      processed.push({
        productId: p.id,
        productCode: p.code,
        productName: p.name,
        quantity: g.qty,
        currentCost: p.current_cost ?? 0,
        finalCost: p.current_cost ?? 0,
        unitIds: [],
        unitIdNotes: {},
      });
    } catch (e: any) {
      failed.push({ code: g.code, error: e?.message || "Error desconocido" });
    }
    onProgress(((i + 1) / groups.length) * 95);
  }

  const totalUnits = processed.reduce((a, x) => a + x.quantity, 0);
  const totalCost = processed.reduce((a, x) => a + x.finalCost * x.quantity, 0);
  let receiptId: string | undefined;
  if (processed.length) {
    try {
      const r = await addMovementReceipt({
        type: "entry",
        reference,
        reason,
        date: new Date().toISOString(),
        user_name: userName,
        items: processed,
        total_units: totalUnits,
        total_products: processed.length,
        total_cost: totalCost,
      } as any);
      receiptId = r?.id;
    } catch (e) {
      console.error("Error guardando comprobante de carga masiva:", e);
    }
  }

  const status: CommitResult["status"] = !processed.length ? "Fallido" : failed.length ? "Completado con errores" : "Completado";
  const note = failed.length ? `${failed.length} producto(s) con error: ${failed.map((f) => f.code).join(", ")}`.slice(0, 500) : null;

  const { error: histErr } = await supabase.from("bulk_imports").insert({
    company: getCurrentCompany(),
    reference,
    file_name: file.name,
    user_name: userName,
    products: processed.length,
    units: totalUnits,
    status,
    note,
    fingerprint: file.fingerprint,
    receipt_id: receiptId ?? null,
    details: { failed, items: processed.map((x) => ({ code: x.productCode, qty: x.quantity })) },
  });
  if (histErr) console.warn("Error guardando historial de importación (¿existe la tabla bulk_imports?):", histErr);

  if (processed.length) {
    logActivity({
      type: "cargo_inventario",
      reference,
      description: `Carga masiva — ${file.name} — ${processed.length} producto(s), ${totalUnits} unidad(es)`,
      amount: totalCost,
      metadata: { receipt_id: receiptId, file: file.name, failed, bulk: true },
    });
  }

  onProgress(100);
  return { reference, ok: processed.length, failed, totalUnits, receiptId, status, stock };
}
