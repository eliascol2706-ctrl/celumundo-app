import { supabase, getCurrentCompany } from "../../lib/supabase";
import { CatalogProduct } from "./matching";

/** Carga el catálogo completo de la empresa activa (paginado: Supabase limita a 1000 filas por consulta). */
export async function fetchCatalog(): Promise<CatalogProduct[]> {
  const company = getCurrentCompany();
  const size = 1000;
  const out: CatalogProduct[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await supabase
      .from("products")
      .select("id, code, name, description, stock")
      .eq("company", company)
      .order("code")
      .range(from, from + size - 1);
    if (error) throw error;
    (data ?? []).forEach((p) =>
      out.push({ id: p.id, code: p.code, name: p.name || p.description || p.code, description: p.description ?? "", stock: Number(p.stock) || 0 })
    );
    if (!data || data.length < size) break;
  }
  return out;
}
