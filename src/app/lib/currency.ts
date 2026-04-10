// Utilidades para formatear moneda colombiana (COP)

export function formatCOP(amount: number | undefined | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '0';
  }
  return amount.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCOPWithLabel(amount: number | undefined | null): string {
  return `COP ${formatCOP(amount)}`;
}