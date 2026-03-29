import { formatCOP } from '../lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { RotateCcw } from 'lucide-react';
import type { Return, Invoice } from '../lib/supabase';

interface ReturnsReportCardProps {
  returns: Return[];
  invoices: Invoice[];
  period: 'all' | 'month' | 'day';
}

export function ReturnsReportCard({ returns, invoices, period }: ReturnsReportCardProps) {
  // Filtrar devoluciones según período
  const filteredReturns = (() => {
    if (period === 'all') return returns;
    
    const now = new Date();
    if (period === 'month') {
      return returns.filter(ret => {
        const retDate = new Date(ret.date);
        return retDate.getMonth() === now.getMonth() && retDate.getFullYear() === now.getFullYear();
      });
    }
    
    if (period === 'day') {
      const today = now.toISOString().split('T')[0];
      return returns.filter(ret => ret.date.startsWith(today));
    }
    
    return returns;
  })();

  const totalReturns = filteredReturns.length;
  const totalReturnAmount = filteredReturns.reduce((sum, ret) => sum + ret.total, 0);
  const fullReturns = filteredReturns.filter(r => r.type === 'full').length;
  const partialReturns = filteredReturns.filter(r => r.type === 'partial').length;

  // Calcular productos más devueltos
  const productReturns: { [key: string]: { name: string; count: number; amount: number } } = {};
  filteredReturns.forEach(ret => {
    ret.items.forEach(item => {
      if (!productReturns[item.productId]) {
        productReturns[item.productId] = { name: item.productName, count: 0, amount: 0 };
      }
      productReturns[item.productId].count += item.quantity;
      productReturns[item.productId].amount += item.total;
    });
  });

  const topReturnedProducts = Object.values(productReturns)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calcular tasa de devolución
  const relevantInvoices = (() => {
    if (period === 'all') return invoices.filter(inv => 
      inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned'
    );
    
    const now = new Date();
    if (period === 'month') {
      return invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return (invDate.getMonth() === now.getMonth() && 
                invDate.getFullYear() === now.getFullYear() &&
                (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned'));
      });
    }
    
    if (period === 'day') {
      const today = now.toISOString().split('T')[0];
      return invoices.filter(inv => 
        inv.date.startsWith(today) &&
        (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned')
      );
    }
    
    return [];
  })();

  const returnRate = relevantInvoices.length > 0 
    ? ((filteredReturns.length / relevantInvoices.length) * 100).toFixed(2)
    : '0.00';

  const periodTitles = {
    all: 'Total General',
    month: 'Del Mes',
    day: 'Del Día'
  };

  return (
    <Card className="border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
          <RotateCcw className="h-5 w-5" />
          Devoluciones {periodTitles[period]}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estadísticas principales */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-muted-foreground">Total Devoluciones</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{totalReturns}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-muted-foreground">Monto Devuelto</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-400">{formatCOP(totalReturnAmount)}</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-muted-foreground">Tasa de Devolución</p>
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">{returnRate}%</p>
          </div>
          
          <div className="bg-white dark:bg-gray-900 p-3 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-xs text-muted-foreground">Tipos</p>
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {fullReturns} completas / {partialReturns} parciales
            </p>
          </div>
        </div>

        {/* Productos más devueltos */}
        {topReturnedProducts.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-red-700 dark:text-red-400">Productos Más Devueltos:</h4>
            <div className="space-y-2">
              {topReturnedProducts.map((product, index) => (
                <div key={index} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border border-red-200 dark:border-red-800">
                  <div>
                    <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.count} unidades</p>
                  </div>
                  <p className="font-bold text-red-700 dark:text-red-400 text-sm">{formatCOP(product.amount)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de devoluciones recientes (solo para diario y mensual) */}
        {period !== 'all' && filteredReturns.length > 0 && (
          <div>
            <h4 className="font-medium mb-2 text-red-700 dark:text-red-400">Devoluciones Recientes:</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {filteredReturns.slice(0, 10).map((ret) => (
                <div key={ret.id} className="flex items-center justify-between bg-white dark:bg-gray-900 p-2 rounded border border-red-200 dark:border-red-800 text-sm">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{ret.return_number}</p>
                    <p className="text-xs text-muted-foreground">
                      Factura: {ret.invoice_number} • {ret.type === 'full' ? 'Completa' : 'Parcial'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-red-700 dark:text-red-400">{formatCOP(ret.total)}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ret.date).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalReturns === 0 && (
          <p className="text-center text-muted-foreground py-4">
            No hay devoluciones {period === 'all' ? 'registradas' : period === 'month' ? 'este mes' : 'hoy'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}