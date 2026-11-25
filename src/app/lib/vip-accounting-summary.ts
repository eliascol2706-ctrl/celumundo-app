import type { VipLedger } from './vip-accounting';

type Row = Record<string, any>;
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const itemsOf = (items: unknown): Row[] => {
  if (Array.isArray(items)) return items;
  if (typeof items === 'string') {
    try { const parsed = JSON.parse(items); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  return [];
};
const costOf = (items: unknown): number | null => {
  const rows = itemsOf(items);
  if (!rows.length || rows.some(item =>
    typeof item.costAtSale !== 'number' || !Number.isFinite(item.costAtSale) || item.costAtSale < 0
  )) return null;
  return rows.reduce((sum, item) => sum + item.costAtSale * amount(item.quantity), 0);
};
const netOf = (row: Row) => amount(row.total) - amount(row.tax);
const refundedCash = (row: Row) => {
  const method = String(row.refund_method || '').toLowerCase();
  if (['efectivo', 'cash'].includes(method)) return amount(row.total);
  const match = method.match(/(?:mixto:|,)efectivo=([\d.]+)/);
  return match ? amount(match[1]) : 0;
};

export function summarizeVip(ledger: VipLedger) {
  let revenue = 0;
  let cost = 0;
  let missingCosts = 0;
  let cash = 0;
  const realized = ledger.invoices.filter(inv =>
    inv.is_vip === true && (
      ['paid', 'partial_return', 'returned'].includes(inv.status) ||
      (inv.is_credit && inv.status === 'pending')
    ),
  );
  for (const invoice of realized) {
    const returns = ledger.returns.filter(row => row.invoice_id === invoice.id);
    const notes = ledger.credit_notes.filter(row => row.invoice_id === invoice.id && row.status === 'issued');
    const exchanges = ledger.exchanges.filter(row => row.invoice_id === invoice.id && row.status === 'completed');
    revenue += netOf(invoice);
    const invoiceCost = costOf(invoice.items);
    if (invoiceCost === null) missingCosts++;
    else cost += invoiceCost;
    if (!invoice.is_credit) cash += amount(invoice.payment_cash);

    for (const refund of [...returns, ...notes]) {
      revenue -= netOf(refund);
      cash -= refundedCash(refund);
      const restoredCost = costOf(refund.items);
      if (restoredCost === null) missingCosts++;
      else cost -= restoredCost;
    }
    for (const exchange of exchanges) {
      revenue += amount(exchange.price_difference);
      const returnedCost = costOf(exchange.original_products);
      const deliveredCost = costOf(exchange.new_products);
      if (returnedCost === null || deliveredCost === null) missingCosts++;
      else cost += deliveredCost - returnedCost;
      cash += Math.sign(amount(exchange.price_difference)) * amount(exchange.payment_cash);
    }
  }
  const realizedIds = new Set(realized.map(inv => inv.id));
  cash += ledger.credit_payments.filter(payment =>
    realizedIds.has(payment.invoice_id) &&
    ['cash', 'efectivo'].includes(String(payment.payment_method).toLowerCase()),
  ).reduce((sum, payment) => sum + amount(payment.amount), 0);
  return {
    count: realized.length, revenue, cash, missingCosts,
    profit: missingCosts ? null : revenue - cost,
  };
}
