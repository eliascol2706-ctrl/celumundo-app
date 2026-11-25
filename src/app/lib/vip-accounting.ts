import { getCurrentCompany, supabase, type Invoice } from './supabase';
export { summarizeVip } from './vip-accounting-summary';

type Row = Record<string, any>;
export interface VipLedger {
  invoices: Invoice[];
  returns: Row[];
  credit_notes: Row[];
  exchanges: Row[];
  credit_payments: Row[];
}

// Paginate every collection: a database row limit must never silently cap totals.
export async function loadVipLedger(seller?: string): Promise<VipLedger> {
  const read = async (table: string): Promise<Row[]> => {
    const records: Row[] = [];
    for (let page = 0; ; page++) {
      const { data, error } = await supabase.from(`vip_${table}`).select('*')
        .eq('company', getCurrentCompany()).order('id')
        .range(page * 1000, page * 1000 + 999);
      if (error) throw new Error('No se pudo cargar la contabilidad VIP. Verifica la migración SQL.');
      records.push(...(data || []));
      if (!data || data.length < 1000) return records;
    }
  };
  const [rawInvoices, returns, credit_notes, exchanges, credit_payments] = await Promise.all(
    ['invoices', 'returns', 'credit_notes', 'exchanges', 'credit_payments'].map(read),
  );
  const invoices = rawInvoices.filter(inv => !seller || inv.attended_by === seller) as Invoice[];
  const ids = new Set(invoices.map(inv => inv.id));
  const related = (rows: Row[]) => rows.filter(row => ids.has(row.invoice_id));
  return {
    invoices, returns: related(returns), credit_notes: related(credit_notes),
    exchanges: related(exchanges), credit_payments: related(credit_payments),
  };
}
