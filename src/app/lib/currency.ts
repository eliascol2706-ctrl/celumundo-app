// Utilidades para formatear moneda colombiana (COP)

export function formatCOP(amount: number): string {
  return amount.toLocaleString('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatCOPWithLabel(amount: number): string {
  return `COP ${formatCOP(amount)}`;
}
