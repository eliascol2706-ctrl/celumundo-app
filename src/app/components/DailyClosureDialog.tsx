import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, FileText, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCOP } from '../lib/currency';
import { addDailyClosure, getCurrentUser, getColombiaDate } from '../lib/supabase';
import { toast } from 'sonner';

type Phase = 1 | 2 | 3;

interface DailyClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dailyStats: {
    totalInvoices: number;
    regularInvoices: number;
    wholesaleInvoices: number;
    invoices: any[];
    grossRevenue: number;
    totalReturns: number;
    netRevenue: number;
    pendingCreditBalance: number;
    creditInvoices: number;
    creditPayments?: any[]; // Abonos a créditos del día
    exchanges?: any[]; // Cambios del día
    returns?: any[]; // Devoluciones del día
    serviceRevenue?: number; // NUEVO: Ingresos de servicio técnico
  };
  dayToClose: string; // YYYY-MM-DD date to close
  hourlyData: any[];
  topProducts: any[];
  products: any[]; // Lista de productos para calcular costos
  expenses?: any[]; // Gastos del día
  creditNotes?: any[]; // NUEVO: Notas de crédito del día
  onSuccess: () => void;
}

export function DailyClosureDialog({
  open,
  onOpenChange,
  dailyStats,
  dayToClose,
  hourlyData,
  topProducts,
  products,
  expenses,
  creditNotes,
  onSuccess
}: DailyClosureDialogProps) {
  const [phase, setPhase] = useState<Phase>(1);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'regular' | 'wholesale'>('all');
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [showExchangeDetails, setShowExchangeDetails] = useState(false);
  const [showProfitDetails, setShowProfitDetails] = useState(false);
  const [closedByName, setClosedByName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const currentUser = getCurrentUser();

  // Calcular el costo de los productos vendidos
  // Base: mismas facturas que Ingresos Totales del Día
  // (regulares pagadas + todos los créditos activos, excluyendo anuladas/canceladas)
  const calculateTotalCost = () => {
    let totalCost = 0;

    dailyStats.invoices.forEach(invoice => {
      const isRegularPaid = !invoice.is_credit && (invoice.status === 'paid' || invoice.status === 'partial_return');
      const isActiveCredit = invoice.is_credit && invoice.status !== 'anulada' && invoice.status !== 'cancelled' && invoice.status !== 'pending_confirmation';

      if (isRegularPaid || isActiveCredit) {
        invoice.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            totalCost += product.current_cost * item.quantity;
          }
        });
      }
    });

    return totalCost;
  };

  // Calcular utilidad perdida por devoluciones del día
  const calculateReturnsProfitImpact = () => {
    let lostProfit = 0;
    (dailyStats.returns || []).forEach((ret: any) => {
      if (!ret.items) return;
      ret.items.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        const cost = product?.current_cost || 0;
        const profit = (item.price || 0) - cost;
        lostProfit += profit * item.quantity;
      });
    });
    return lostProfit;
  };

  // Calcular ganancia POR CRÉDITO: Solo facturas a crédito del día
  const calculateProfitGenerated = () => {
    let totalRevenue = 0;
    let totalCost = 0;

    dailyStats.invoices.forEach(invoice => {
      // Solo facturas a crédito activas (excluir anuladas, canceladas y pending_confirmation)
      if (invoice.is_credit && invoice.status !== 'pending_confirmation' && invoice.status !== 'anulada' && invoice.status !== 'cancelled') {
        totalRevenue += invoice.total || 0;

        invoice.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            totalCost += product.current_cost * item.quantity;
          }
        });
      }
    });

    return totalRevenue - totalCost;
  };

  // Calcular ganancia COBRADA: Solo ventas pagadas al 100% o parcialmente devueltas
  const calculateProfitCollected = () => {
    let totalRevenue = 0;
    let totalCost = 0;

    dailyStats.invoices.forEach(invoice => {
      // Solo facturas completamente pagadas o parcialmente devueltas
      // EXCLUIR: créditos pendientes Y facturas pendientes de confirmación
      if (invoice.status === 'paid' || invoice.status === 'partial_return') {
        totalRevenue += invoice.total || 0;

        invoice.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId);
          if (product) {
            totalCost += product.current_cost * item.quantity;
          }
        });
      }
    });

    // Sumar impacto de utilidad de cambios del día (profit_difference)
    const exchangeProfitImpact = (dailyStats.exchanges || []).reduce((sum: number, ex: any) => {
      return sum + (Number(ex.profit_difference) || 0);
    }, 0);

    // Restar utilidad perdida por devoluciones
    const returnsProfitImpact = calculateReturnsProfitImpact();

    return totalRevenue - totalCost + exchangeProfitImpact - returnsProfitImpact;
  };

  // Función para manejar el ordenamiento
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Si ya está ordenando por esta columna, cambiar dirección
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Nueva columna, ordenar ascendente por defecto
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const totalCost = calculateTotalCost();

  // Calcular totales de efectivo y transferencias de las facturas del día
  const calculatePaymentTotals = () => {
    let totalCash = 0;
    let totalTransfer = 0; // Solo de facturas
    let cashExchangeImpact = 0;
    let transferExchangeImpact = 0;
    let cashReturns = 0;
    let transferReturns = 0;
    let totalOthers = 0;
    let totalTransferRegular = 0; // Transferencias bancarias normales (solo facturas)
    let totalNequi = 0; // Solo de facturas
    let totalDaviplata = 0; // Solo de facturas
    let totalOtherMethods = 0; // Otros métodos de pago (solo facturas)

    // Sumar pagos de facturas pagadas y parcialmente devueltas del día
    dailyStats.invoices.forEach(invoice => {
      // Solo contar facturas pagadas o parcialmente devueltas (no créditos pendientes)
      if ((invoice.status === 'paid' || invoice.status === 'partial_return') && !invoice.is_credit) {
        const paymentStr = invoice.payment_method || '';
        const invoiceTotal = invoice.total || 0;

        // Verificar si tenemos los campos detallados de pago en la factura
        if (invoice.payment_cash !== undefined || invoice.payment_transfer !== undefined || invoice.payment_other !== undefined) {
          const cash = invoice.payment_cash || 0;
          const transfer = invoice.payment_transfer || 0;
          const other = invoice.payment_other || 0;

          totalCash += cash;
          totalTransfer += transfer; // Transferencias bancarias normales
          totalTransferRegular += transfer;

          // payment_other puede ser Nequi, Daviplata u otros - detectar según payment_method
          if (other > 0) {
            const paymentLower = paymentStr.toLowerCase();

            if (paymentLower.includes('nequi') && !paymentLower.includes('daviplata')) {
              totalTransfer += other;
              totalNequi += other;
            } else if (paymentLower.includes('daviplata') && !paymentLower.includes('nequi')) {
              totalTransfer += other;
              totalDaviplata += other;
            } else if (paymentLower.includes('nequi') && paymentLower.includes('daviplata')) {
              totalTransfer += other;
              totalOtherMethods += other;
            } else {
              totalTransfer += other;
              totalOtherMethods += other;
            }
          }
        } else {
          // Fallback: parsear desde el payment_method string
          const hasDetailedFormat = paymentStr.includes(':');

          if (hasDetailedFormat) {
            // FORMATO DETALLADO: "Efectivo: 70.000, Transferencia: 29.000"

            // Extraer efectivo
            const cashMatch = paymentStr.match(/Efectivo:\s*([\d,.]+)/i);
            if (cashMatch) {
              const cashValue = parseFloat(cashMatch[1].replace(/\./g, '').replace(/,/g, ''));
              if (!isNaN(cashValue)) {
                totalCash += cashValue;
              }
            }

            // Extraer transferencia
            const transferMatch = paymentStr.match(/Transferencia:\s*([\d,.]+)/i);
            if (transferMatch) {
              const transferValue = parseFloat(transferMatch[1].replace(/\./g, '').replace(/,/g, ''));
              if (!isNaN(transferValue)) {
                totalTransfer += transferValue;
                totalTransferRegular += transferValue;
              }
            }

            // Extraer Nequi
            const nequiMatch = paymentStr.match(/Nequi:\s*([\d,.]+)/i);
            if (nequiMatch) {
              const nequiValue = parseFloat(nequiMatch[1].replace(/\./g, '').replace(/,/g, ''));
              if (!isNaN(nequiValue)) {
                totalTransfer += nequiValue;
                totalNequi += nequiValue;
              }
            }

            // Extraer Daviplata
            const daviplataMatch = paymentStr.match(/Daviplata:\s*([\d,.]+)/i);
            if (daviplataMatch) {
              const daviplataValue = parseFloat(daviplataMatch[1].replace(/\./g, '').replace(/,/g, ''));
              if (!isNaN(daviplataValue)) {
                totalTransfer += daviplataValue;
                totalDaviplata += daviplataValue;
              }
            }

            // Extraer "Otros" (en pagos mixtos, esto es Nequi/Daviplata)
            const otherMatch = paymentStr.match(/Otros:\s*([\d,.]+)/i);
            if (otherMatch) {
              const otherValue = parseFloat(otherMatch[1].replace(/\./g, '').replace(/,/g, ''));
              if (!isNaN(otherValue)) {
                totalTransfer += otherValue;
                totalOtherMethods += otherValue;
              }
            }
          } else {
            // FORMATO SIMPLE: solo el nombre del método (ej: "Nequi", "Efectivo", "Transferencia")
            const paymentLower = paymentStr.toLowerCase().trim();

            if (paymentLower === 'efectivo') {
              totalCash += invoiceTotal;
            } else if (paymentLower === 'transferencia') {
              totalTransfer += invoiceTotal;
              totalTransferRegular += invoiceTotal;
            } else if (paymentLower === 'nequi') {
              totalTransfer += invoiceTotal;
              totalNequi += invoiceTotal;
            } else if (paymentLower === 'daviplata') {
              totalTransfer += invoiceTotal;
              totalDaviplata += invoiceTotal;
            } else if (paymentLower === 'nequi-daviplata') {
              totalTransfer += invoiceTotal;
              totalOtherMethods += invoiceTotal;
            } else if (paymentLower === 'otros') {
              totalTransfer += invoiceTotal;
              totalOtherMethods += invoiceTotal;
            }
          }
        }
      }
    });

    // SUMAR ABONOS A CRÉDITO DEL DÍA (separados - se suman SOLO a totalAbonos, NO a totalCash/totalTransfer)
    // EXCLUIR abonos que son notas de crédito (payment_method: 'nota_credito')
    let totalAbonos = 0;
    if (dailyStats.creditPayments && dailyStats.creditPayments.length > 0) {
      dailyStats.creditPayments.forEach(payment => {
        // Excluir notas de crédito
        if (payment.payment_method === 'nota_credito') {
          return;
        }
        const amount = payment.amount || 0;
        totalAbonos += amount;
      });
    }

    // SUMAR/RESTAR CAMBIOS DEL DÍA
    if (dailyStats.exchanges && dailyStats.exchanges.length > 0) {
      dailyStats.exchanges.forEach(exchange => {
        const cashAmount = exchange.payment_cash || 0;
        const transferAmount = exchange.payment_transfer || 0;
        const priceDifference = exchange.price_difference || 0;

        if (priceDifference > 0) {
          totalCash += cashAmount;
          totalTransfer += transferAmount;
          cashExchangeImpact += cashAmount;
          transferExchangeImpact += transferAmount;
        } else if (priceDifference < 0) {
          totalCash -= cashAmount;
          totalTransfer -= transferAmount;
          cashExchangeImpact -= cashAmount;
          transferExchangeImpact -= transferAmount;
        }
      });
    }

    // Sumar ingresos de servicio técnico
    const serviceRevenue = dailyStats.serviceRevenue || 0;

    // RESTAR NOTAS DE CRÉDITO DEL DÍA — se descuenta el total sin importar el método
    let creditNotesTotal = 0;
    let creditNotesCash = 0;
    let creditNotesTransfer = 0;

    if (creditNotes && creditNotes.length > 0) {
      creditNotes.forEach(cn => {
        const cnTotal = cn.total || 0;
        creditNotesTotal += cnTotal;

        // Rastrear desglose por método para mostrar en UI
        if (cn.refund_method === 'efectivo') {
          totalCash -= cnTotal;
          creditNotesCash += cnTotal;
        } else if (cn.refund_method === 'transferencia') {
          totalTransfer -= cnTotal;
          creditNotesTransfer += cnTotal;
        }
        // Para otros métodos (saldo_a_favor, descuento, etc.) se descuenta del total general abajo
      });
    }

    // RESTAR DEVOLUCIONES DEL DÍA según método de reembolso
    const parseMixedRefund = (method: string) => {
      const result = { efectivo: 0, transfer: 0 };
      if (!method.startsWith('mixto:')) return result;
      method.slice(6).split(',').forEach(part => {
        const [k, v] = part.split('=');
        const val = parseFloat(v) || 0;
        if (k === 'efectivo') result.efectivo += val;
        if (['transferencia', 'nequi', 'daviplata'].includes(k)) result.transfer += val;
      });
      return result;
    };

    (dailyStats.returns || []).forEach((ret: any) => {
      const method = (ret.refund_method || '').toLowerCase();
      const amount = ret.total || 0;
      if (method === 'efectivo') {
        totalCash -= amount;
        cashReturns += amount;
      } else if (['transferencia', 'nequi', 'daviplata'].includes(method)) {
        totalTransfer -= amount;
        transferReturns += amount;
      } else if (method.startsWith('mixto:')) {
        const parsed = parseMixedRefund(method);
        totalCash -= parsed.efectivo;
        totalTransfer -= parsed.transfer;
        cashReturns += parsed.efectivo;
        transferReturns += parsed.transfer;
      }
    });

    // Total bruto de facturas a crédito emitidas hoy (excluye anuladas y canceladas)
    const creditInvoicesTotal = dailyStats.invoices
      .filter(inv => inv.type === 'credit' && inv.status !== 'cancelled' && inv.status !== 'anulada')
      .reduce((sum, inv) => sum + (inv.total || 0), 0);

    return {
      totalCash,
      totalTransfer,
      totalOthers,
      totalAbonos,
      creditInvoicesTotal,
      cashExchangeImpact,
      transferExchangeImpact,
      cashReturns,
      transferReturns,
      transferBreakdown: {
        transferencia: totalTransferRegular,
        nequi: totalNequi,
        daviplata: totalDaviplata,
        otros: totalOtherMethods
      },
      serviceRevenue,
      creditNotesTotal,
      creditNotesCash,
      creditNotesTransfer,
      total: totalCash + totalTransfer + serviceRevenue + creditInvoicesTotal - (creditNotesTotal - creditNotesCash - creditNotesTransfer)
    };
  };

  const paymentTotals = calculatePaymentTotals();

  const resetDialog = () => {
    setPhase(1);
    setInvoiceFilter('all');
    setShowInvoiceDetails(false);
    setShowExchangeDetails(false);
    setClosedByName('');
    setIsLoading(false);
    setIsSuccess(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      resetDialog();
      onOpenChange(false);
    }
  };

  const getInvoicesByFilter = () => {
    if (invoiceFilter === 'all') return dailyStats.invoices;
    return dailyStats.invoices.filter(inv => inv.type === invoiceFilter);
  };

  const handleFinalizeClosure = async () => {
    if (!closedByName.trim()) {
      toast.error('Por favor, ingresa el nombre de quien realiza el cierre');
      return;
    }

    setIsLoading(true);

    // Simular procesamiento
    setTimeout(async () => {
      try {
        const totalCashValue = paymentTotals.totalCash;
        const totalTransferValue = paymentTotals.totalTransfer;
        const total = paymentTotals.total;
        const profitGenerated = calculateProfitGenerated();
        const profitCollected = calculateProfitCollected();

        // Calcular total de productos vendidos
        const totalProductsSold = dailyStats.invoices
          .filter(inv => inv.status === 'paid' || inv.status === 'partial_return')
          .reduce((sum, inv) => {
            return sum + inv.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0);
          }, 0);

        // Total de abonos a créditos
        const creditPaymentsTotal = dailyStats.creditPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

        // Total de gastos del día
        const totalExpenses = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

        // Calcular impacto de cambios
        const exchangeImpact = dailyStats.exchanges?.reduce((sum, ex) => sum + (ex.price_difference || 0), 0) || 0;

        // Total de cartera generada hoy (bruto, sin restar notas de crédito)
        const creditInvoicesTotal = paymentTotals.creditInvoicesTotal || 0;
        const carteraTotal = creditInvoicesTotal;

        console.log('=== DATOS DEL CIERRE DIARIO ===');
        console.log('Total de productos vendidos:', totalProductsSold);
        console.log('Costo de productos:', totalCost);
        console.log('Gastos del día:', totalExpenses);
        console.log('Ingresos servicio técnico:', dailyStats.serviceRevenue || 0);
        console.log('Devoluciones:', dailyStats.totalReturns || 0);
        console.log('Crédito pendiente:', dailyStats.pendingCreditBalance || 0);
        console.log('Abonos a créditos:', creditPaymentsTotal);
        console.log('Impacto de cambios:', exchangeImpact);
        console.log('Total efectivo:', totalCashValue);
        console.log('Total transferencias:', totalTransferValue);
        console.log('Total general:', total);
        console.log('Ganancia generada (crédito):', profitGenerated);
        console.log('Ganancia cobrada (del día):', profitCollected);

        const closureResult = await addDailyClosure({
          date: dayToClose,
          total_invoices: dailyStats.totalInvoices,
          pending_invoices: dailyStats.invoices.filter(inv => inv.status === 'pending').length,
          paid_invoices: dailyStats.invoices.filter(inv => inv.status === 'paid' || inv.status === 'partial_return').length,
          total_cash: totalCashValue,
          total_transfer: totalTransferValue,
          total,
          profit_generated: profitGenerated, // Ganancia por crédito (facturas a crédito del día)
          profit_collected: profitCollected, // Ganancias del día (ventas pagadas)
          total_products_sold: totalProductsSold,
          product_costs: totalCost,
          total_expenses: totalExpenses,
          service_revenue: dailyStats.serviceRevenue || 0,
          total_returns: dailyStats.totalReturns || 0,
          pending_credit: creditInvoicesTotal,
          credit_payments: creditPaymentsTotal,
          exchange_impact: exchangeImpact,
          credit_notes_total: paymentTotals.creditNotesTotal || 0,
          credit_notes_cash: paymentTotals.creditNotesCash || 0,
          credit_notes_transfer: paymentTotals.creditNotesTransfer || 0,
          cash_register_total: paymentTotals.totalCash + paymentTotals.totalTransfer + paymentTotals.totalAbonos,
          closed_by: closedByName.trim(),
          closed_at: new Date().toISOString(),
        });

        if (!closureResult) {
          throw new Error('No se pudo guardar el cierre diario');
        }

        console.log('✅ CIERRE GUARDADO Y VERIFICADO:', closureResult);

        setIsLoading(false);
        setIsSuccess(true);

        setTimeout(() => {
          resetDialog();
          onOpenChange(false);
          onSuccess();
          toast.success('Cierre diario realizado exitosamente');
        }, 2000);
      } catch (error) {
        console.error('Error al finalizar cierre:', error);
        setIsLoading(false);
        toast.error('Error al finalizar el cierre');
      }
    }, 2000);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" aria-describedby={isLoading || isSuccess ? "status-description" : undefined}>
        {isLoading ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Procesando Cierre</DialogTitle>
              <DialogDescription id="status-description">
                El cierre diario está siendo procesado
              </DialogDescription>
            </DialogHeader>
            <div className="py-16 text-center">
              <Loader2 className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2">Procesando Cierre...</h3>
              <p className="text-muted-foreground">Por favor espera un momento</p>
            </div>
          </>
        ) : isSuccess ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Cierre Exitoso</DialogTitle>
              <DialogDescription id="status-description">
                El cierre diario ha sido completado con éxito
              </DialogDescription>
            </DialogHeader>
            <div className="py-16 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">¡Cierre Realizado Exitosamente!</h3>
              <p className="text-muted-foreground">El cierre diario ha sido registrado correctamente</p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                Cierre Diario - Fase {phase} de 3
              </DialogTitle>
              <DialogDescription>
                Revisa los detalles del cierre diario antes de finalizar.
              </DialogDescription>
            </DialogHeader>

            {/* Phase 1: Stats and Charts */}
            {phase === 1 && (
              <div className="space-y-6">
                {/* Servicio Técnico Alert */}
                {(dailyStats.serviceRevenue || 0) > 0 && (
                  <Card className="border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 bg-blue-600 dark:bg-blue-500 text-white rounded-full p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            Servicio Técnico incluido
                          </h4>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Ingresos del Servicio Técnico: <span className="font-bold">COP {formatCOP(dailyStats.serviceRevenue || 0)}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Top Stats */}
                <div className="space-y-4">
                  {/* Fila 1: Ingresos Totales - Card Principal Destacada */}
                  <Card className="border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base font-semibold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        💰 Ingresos Totales del Día
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400 mb-2">
                        COP {formatCOP(paymentTotals.total)}
                      </div>
                      <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-700 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-700 dark:text-emerald-300">💵 Ventas pagadas (efectivo):</span>
                          <span className="font-medium text-emerald-800 dark:text-emerald-200">+{formatCOP(paymentTotals.totalCash)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-emerald-700 dark:text-emerald-300">🏦 Ventas pagadas (transferencia):</span>
                          <span className="font-medium text-emerald-800 dark:text-emerald-200">+{formatCOP(paymentTotals.totalTransfer)}</span>
                        </div>
                        {(paymentTotals.creditInvoicesTotal || 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-blue-600 dark:text-blue-400">📋 Cartera generada hoy:</span>
                            <span className="font-medium text-blue-700 dark:text-blue-300">+{formatCOP(paymentTotals.creditInvoicesTotal || 0)}</span>
                          </div>
                        )}
                        {(paymentTotals.serviceRevenue || 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span className="text-blue-600 dark:text-blue-400">🔧 Servicio técnico:</span>
                            <span className="font-medium text-blue-700 dark:text-blue-300">+{formatCOP(paymentTotals.serviceRevenue || 0)}</span>
                          </div>
                        )}
                        {(() => {
                          const otherCreditNotes = (paymentTotals.creditNotesTotal || 0) - (paymentTotals.creditNotesCash || 0) - (paymentTotals.creditNotesTransfer || 0);
                          if (otherCreditNotes > 0) {
                            return (
                              <div className="flex justify-between text-xs">
                                <span className="text-red-600 dark:text-red-400">📝 Notas crédito (saldo/abono):</span>
                                <span className="font-medium text-red-700 dark:text-red-300">-{formatCOP(otherCreditNotes)}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {dailyStats.exchanges && dailyStats.exchanges.length > 0 && (() => {
                          const exchangeImpact = dailyStats.exchanges.reduce((sum, ex) => sum + (ex.price_difference || 0), 0);
                          if (exchangeImpact !== 0) {
                            return (
                              <div className="flex justify-between text-xs">
                                <span className={exchangeImpact > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-orange-600 dark:text-orange-400'}>
                                  🔄 Excedente cambios:
                                </span>
                                <span className={`font-medium ${exchangeImpact > 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-orange-700 dark:text-orange-300'}`}>
                                  {exchangeImpact > 0 ? '+' : ''}{formatCOP(exchangeImpact)}
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        <div className="mt-4 pt-4 border-t-2 border-emerald-300 dark:border-emerald-600 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/30 p-3 -mx-1">
                          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">🏧 Ingreso por Caja</p>
                          <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mb-3">
                            COP {formatCOP(paymentTotals.totalCash + paymentTotals.totalTransfer + paymentTotals.totalAbonos)}
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-sm">
                              <span className="text-emerald-700 dark:text-emerald-300">💵 Efectivo</span>
                              <span className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCOP(paymentTotals.totalCash)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-emerald-700 dark:text-emerald-300">🏦 Transferencias</span>
                              <span className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCOP(paymentTotals.totalTransfer)}</span>
                            </div>
                            {(paymentTotals.totalAbonos || 0) > 0 && (
                              <div className="flex justify-between text-sm">
                                <span className="text-emerald-700 dark:text-emerald-300">💳 Abonos a crédito</span>
                                <span className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCOP(paymentTotals.totalAbonos)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Card de Cartera del Día */}
                  {((dailyStats.creditInvoices || 0) > 0 || (creditNotes && creditNotes.length > 0)) && (() => {
                    const totalCreditInvoices = dailyStats.invoices
                      .filter(inv => inv.type === 'credit' && inv.status !== 'cancelled' && inv.status !== 'anulada')
                      .reduce((sum: number, inv: any) => sum + (inv.total || 0), 0);
                    const totalCreditNotes = (creditNotes || []).reduce((sum: number, cn: any) => sum + (cn.total || 0), 0);
                    const netCartera = totalCreditInvoices - totalCreditNotes;
                    return (
                      <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                            🏦 Cartera de Hoy
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Facturas a Crédito</p>
                              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {dailyStats.creditInvoices}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-blue-600 dark:text-blue-400 mb-1">Total en Cartera</p>
                              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {formatCOP(totalCreditInvoices)}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
                            Cartera generada hoy — no incluida en ingresos del día
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })()}

                  {/* Card de Devoluciones */}
                  {(dailyStats.returns || []).length > 0 && (
                    <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-red-900 dark:text-red-100 flex items-center gap-2">
                          🔄 Devoluciones del Día
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-4 mb-3">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">N° Devoluciones</p>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400">
                              {(dailyStats.returns || []).length}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Monto Devuelto</p>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400">
                              -{formatCOP(dailyStats.totalReturns || 0)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Utilidad Perdida</p>
                            <p className="text-xl font-bold text-red-600 dark:text-red-400">
                              -{formatCOP(calculateReturnsProfitImpact())}
                            </p>
                          </div>
                        </div>
                        <div className="space-y-1 pt-2 border-t border-red-200 dark:border-red-800">
                          {(dailyStats.returns || []).map((ret: any) => (
                            <div key={ret.id} className="flex justify-between items-center text-xs">
                              <span className="text-muted-foreground font-mono">{ret.return_number}</span>
                              <span className="text-muted-foreground">{ret.customer_name || 'Sin cliente'}</span>
                              <span className="font-medium text-red-600 dark:text-red-400">-{formatCOP(ret.total)}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Fila 2: Ganancias */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-green-200 dark:border-green-800">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-semibold text-green-900 dark:text-green-100 flex items-center gap-2">
                            💎 Ganancias del Día
                          </CardTitle>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowProfitDetails(true)}
                            className="h-7 w-7 p-0 hover:bg-green-100 dark:hover:bg-green-900/30"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-3xl font-bold mb-2 ${
                          calculateProfitCollected() >= 0
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          COP {formatCOP(calculateProfitCollected())}
                        </div>
                        <p className="text-xs text-green-700 dark:text-green-300 mb-3">
                          Utilidad de ventas pagadas
                        </p>
                        <div className="space-y-2 pt-3 border-t border-green-200 dark:border-green-800">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Costo de productos:</span>
                            <span className="font-semibold">COP {formatCOP(totalCost)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Margen:</span>
                            <span className={`font-bold ${
                              (() => {
                                const profit = calculateProfitCollected();
                                const revenue = totalCost + profit;
                                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                                return margin >= 30 ? 'text-green-600 dark:text-green-400' : margin >= 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
                              })()
                            }`}>
                              {(() => {
                                const profit = calculateProfitCollected();
                                const revenue = totalCost + profit;
                                const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
                                return margin.toFixed(1);
                              })()}%
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-2">
                          📊 Ganancias por Crédito
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-3xl font-bold mb-2 ${
                          calculateProfitGenerated() >= 0
                            ? 'text-blue-600 dark:text-blue-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          COP {formatCOP(calculateProfitGenerated())}
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Facturas a crédito del día
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Fila 3: Métodos de Pago */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="border-emerald-200 dark:border-emerald-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
                          💵 Efectivo
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCOP(paymentTotals.totalCash)}
                        </div>
                        <div className="mt-3 pt-2 border-t border-emerald-200 dark:border-emerald-700 space-y-1.5">
                          <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                            <span>📄 Facturas</span>
                            <span className="font-medium">{formatCOP(paymentTotals.totalCash - paymentTotals.cashExchangeImpact + paymentTotals.cashReturns + paymentTotals.creditNotesCash)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300">
                            <span>🔄 Dif. cambios</span>
                            <span className={`font-medium ${paymentTotals.cashExchangeImpact < 0 ? 'text-orange-500' : ''}`}>
                              {paymentTotals.cashExchangeImpact >= 0 ? '+' : ''}{formatCOP(paymentTotals.cashExchangeImpact)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-orange-600 dark:text-orange-400">
                            <span>↩️ Devoluciones</span>
                            <span className="font-medium">-{formatCOP(paymentTotals.cashReturns)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-red-600 dark:text-red-400">
                            <span>📝 Notas crédito</span>
                            <span className="font-medium">-{formatCOP(paymentTotals.creditNotesCash)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-violet-200 dark:border-violet-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-violet-800 dark:text-violet-200 flex items-center gap-2">
                          🏦 Transferencias
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                          {formatCOP(paymentTotals.totalTransfer)}
                        </div>
                        <div className="mt-3 pt-2 border-t border-violet-200 dark:border-violet-700 space-y-1.5">
                          <div className="flex justify-between text-xs text-violet-700 dark:text-violet-300">
                            <span>📄 Facturas</span>
                            <span className="font-medium">{formatCOP(paymentTotals.totalTransfer - paymentTotals.transferExchangeImpact + paymentTotals.transferReturns + paymentTotals.creditNotesTransfer)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-violet-700 dark:text-violet-300">
                            <span>🔄 Dif. cambios</span>
                            <span className={`font-medium ${paymentTotals.transferExchangeImpact < 0 ? 'text-orange-500' : ''}`}>
                              {paymentTotals.transferExchangeImpact >= 0 ? '+' : ''}{formatCOP(paymentTotals.transferExchangeImpact)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-orange-600 dark:text-orange-400">
                            <span>↩️ Devoluciones</span>
                            <span className="font-medium">-{formatCOP(paymentTotals.transferReturns)}</span>
                          </div>
                          <div className="flex justify-between text-xs text-red-600 dark:text-red-400">
                            <span>📝 Notas crédito</span>
                            <span className="font-medium">-{formatCOP(paymentTotals.creditNotesTransfer)}</span>
                          </div>
                          <div className="pt-1 border-t border-violet-200 dark:border-violet-700 space-y-0.5">
                            {paymentTotals.transferBreakdown.transferencia > 0 && (
                              <div className="flex justify-between text-xs text-violet-600 dark:text-violet-400">
                                <span>Transferencia:</span>
                                <span className="font-medium">{formatCOP(paymentTotals.transferBreakdown.transferencia)}</span>
                              </div>
                            )}
                            {paymentTotals.transferBreakdown.nequi > 0 && (
                              <div className="flex justify-between text-xs text-violet-600 dark:text-violet-400">
                                <span>💜 Nequi:</span>
                                <span className="font-medium">{formatCOP(paymentTotals.transferBreakdown.nequi)}</span>
                              </div>
                            )}
                            {paymentTotals.transferBreakdown.daviplata > 0 && (
                              <div className="flex justify-between text-xs text-violet-600 dark:text-violet-400">
                                <span>🔴 Daviplata:</span>
                                <span className="font-medium">{formatCOP(paymentTotals.transferBreakdown.daviplata)}</span>
                              </div>
                            )}
                            {paymentTotals.transferBreakdown.otros > 0 && (
                              <div className="flex justify-between text-xs text-violet-600 dark:text-violet-400">
                                <span>📱 Otros:</span>
                                <span className="font-medium">{formatCOP(paymentTotals.transferBreakdown.otros)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200 dark:border-blue-700">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          💳 Abonos de Créditos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCOP(paymentTotals.totalAbonos || 0)}
                        </div>
                        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                          Pagos a crédito del día
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Notas de Crédito */}
                  <Card className="border-red-200 dark:border-red-700 bg-red-50/30 dark:bg-red-950/20">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-2">
                        📝 Notas de Crédito
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-1">
                        <p className="text-xs text-red-600 dark:text-red-400 mb-1">Total Descontado de Ingresos</p>
                        <div className="text-xl font-bold text-red-800 dark:text-red-200">
                          -{formatCOP(paymentTotals.creditNotesTotal || 0)}
                        </div>
                      </div>
                      {((paymentTotals.creditNotesCash || 0) > 0 || (paymentTotals.creditNotesTransfer || 0) > 0) && (
                        <div className="pt-3 border-t border-red-200 dark:border-red-800 space-y-1 mt-3">
                          {(paymentTotals.creditNotesCash || 0) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-700 dark:text-red-300">💵 Efectivo:</span>
                              <span className="font-semibold text-red-800 dark:text-red-200">-{formatCOP(paymentTotals.creditNotesCash || 0)}</span>
                            </div>
                          )}
                          {(paymentTotals.creditNotesTransfer || 0) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-700 dark:text-red-300">🏦 Transferencia:</span>
                              <span className="font-semibold text-red-800 dark:text-red-200">-{formatCOP(paymentTotals.creditNotesTransfer || 0)}</span>
                            </div>
                          )}
                          {((paymentTotals.creditNotesTotal || 0) - (paymentTotals.creditNotesCash || 0) - (paymentTotals.creditNotesTransfer || 0)) > 0 && (
                            <div className="flex justify-between text-xs">
                              <span className="text-red-700 dark:text-red-300">🔄 Otros métodos:</span>
                              <span className="font-semibold text-red-800 dark:text-red-200">-{formatCOP((paymentTotals.creditNotesTotal || 0) - (paymentTotals.creditNotesCash || 0) - (paymentTotals.creditNotesTransfer || 0))}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </div>

                {/* Hourly Sales Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Ventas por Hora</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={hourlyData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                        <Legend />
                        <Bar dataKey="sales" fill="#16a34a" name="Ventas" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Top Products */}
                <Card>
                  <CardHeader>
                    <CardTitle>Productos Más Vendidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {topProducts.slice(0, 5).map((product, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">{product.quantity} unidades</p>
                          </div>
                          <p className="font-bold text-green-600 dark:text-green-400">
                            COP {formatCOP(product.revenue)}
                          </p>
                        </div>
                      ))}
                      {topProducts.length === 0 && (
                        <p className="text-center text-muted-foreground py-4">No hay datos disponibles</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar Cierre
                  </Button>
                  <Button 
                    onClick={() => setPhase(2)}
                    disabled={paymentTotals.total <= 0}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Phase 2: Invoice Details */}
            {phase === 2 && (
              <div className="space-y-6">
                {/* Invoice Type Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Facturas Totales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{dailyStats.totalInvoices}</div>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto mt-2"
                        onClick={() => { setInvoiceFilter('all'); setShowInvoiceDetails(true); }}
                      >
                        Ver detalles
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Facturas Regulares
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {dailyStats.regularInvoices}
                      </div>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto mt-2"
                        onClick={() => { setInvoiceFilter('regular'); setShowInvoiceDetails(true); }}
                      >
                        Ver detalles
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Facturas Al Mayor
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {dailyStats.wholesaleInvoices}
                      </div>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto mt-2"
                        onClick={() => { setInvoiceFilter('wholesale'); setShowInvoiceDetails(true); }}
                      >
                        Ver detalles
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Facturas a Crédito
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                        {dailyStats.creditInvoices}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Pendiente: {formatCOP(dailyStats.pendingCreditBalance)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Payments and Exchanges Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Pagos de Crédito Recibidos
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                        {dailyStats.creditPayments?.length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Total: {formatCOP(dailyStats.creditPayments?.reduce((sum, p) => sum + p.amount, 0) || 0)}
                      </p>
                      {dailyStats.creditPayments && dailyStats.creditPayments.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <div className="text-xs">
                            💵 Efectivo: {formatCOP(dailyStats.creditPayments.filter(p => p.payment_method?.toLowerCase().includes('efectivo')).reduce((sum, p) => sum + p.amount, 0))}
                          </div>
                          <div className="text-xs">
                            🏦 Transferencia: {formatCOP(dailyStats.creditPayments.filter(p => p.payment_method?.toLowerCase().includes('transferencia')).reduce((sum, p) => sum + p.amount, 0))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Cambios Realizados
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {dailyStats.exchanges?.length || 0}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Cambios del día
                      </p>
                      <Button 
                        variant="link" 
                        className="p-0 h-auto mt-2"
                        onClick={() => { setShowExchangeDetails(true); }}
                      >
                        Ver detalles
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* Invoice Details Table */}
                {showInvoiceDetails && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          Facturas {invoiceFilter === 'all' ? 'Totales' : invoiceFilter === 'regular' ? 'Regulares' : 'Al Mayor'}
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setShowInvoiceDetails(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-sm font-medium">Número</th>
                              <th className="text-left py-2 px-3 text-sm font-medium">Cliente</th>
                              <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Estado</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getInvoicesByFilter().map((invoice) => (
                              <tr key={invoice.id} className="border-b border-border">
                                <td className="py-2 px-3 text-sm">{invoice.number}</td>
                                <td className="py-2 px-3 text-sm">{invoice.customer_name || '-'}</td>
                                <td className="py-2 px-3 text-right text-sm font-medium">
                                  COP {formatCOP(invoice.total)}
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    invoice.status === 'paid'
                                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                      : invoice.status === 'partial_return'
                                      ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                                  }`}>
                                    {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'partial_return' ? 'Dev. Parcial' : 'Pendiente'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Exchange Details Table */}
                {showExchangeDetails && (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>
                          Cambios Realizados
                        </CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => setShowExchangeDetails(false)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto max-h-60">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-sm font-medium">Número</th>
                              <th className="text-left py-2 px-3 text-sm font-medium">Producto Original</th>
                              <th className="text-left py-2 px-3 text-sm font-medium">Producto Nuevo</th>
                              <th className="text-right py-2 px-3 text-sm font-medium">Diferencia</th>
                              <th className="text-left py-2 px-3 text-sm font-medium">Pago</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dailyStats.exchanges?.map((exchange) => {
                              const priceDiff = exchange.price_difference || 0;
                              const cashAmount = exchange.payment_cash || 0;
                              const transferAmount = exchange.payment_transfer || 0;
                              const isPositive = priceDiff > 0;
                              
                              return (
                                <tr key={exchange.id} className="border-b border-border">
                                  <td className="py-2 px-3 text-sm font-medium">{exchange.exchange_number}</td>
                                  <td className="py-2 px-3 text-sm">
                                    <div>{exchange.original_product_name}</div>
                                    <div className="text-xs text-muted-foreground">Cant: {exchange.original_quantity}</div>
                                  </td>
                                  <td className="py-2 px-3 text-sm">
                                    <div>{exchange.new_product_name}</div>
                                    <div className="text-xs text-muted-foreground">Cant: {exchange.new_quantity}</div>
                                  </td>
                                  <td className="py-2 px-3 text-right">
                                    <span className={`text-sm font-medium ${
                                      isPositive
                                        ? 'text-green-600 dark:text-green-400'
                                        : priceDiff < 0
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-muted-foreground'
                                    }`}>
                                      {isPositive ? '+' : ''}{formatCOP(priceDiff)}
                                    </span>
                                    <div className="text-xs text-muted-foreground">
                                      {isPositive ? 'Cliente paga' : priceDiff < 0 ? 'Se devuelve' : 'Sin diferencia'}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-sm">
                                    {cashAmount > 0 && (
                                      <div className="text-xs">
                                        💵 {formatCOP(cashAmount)}
                                      </div>
                                    )}
                                    {transferAmount > 0 && (
                                      <div className="text-xs">
                                        🏦 {formatCOP(transferAmount)}
                                      </div>
                                    )}
                                    {cashAmount === 0 && transferAmount === 0 && (
                                      <span className="text-xs text-muted-foreground">Sin pago</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      
                      {/* Resumen de Cambios */}
                      <div className="mt-4 pt-4 border-t border-border">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Cliente Pagó (Suma)</p>
                            <p className="text-sm font-bold text-green-600 dark:text-green-400">
                              + COP {formatCOP(
                                dailyStats.exchanges
                                  ?.filter(e => (e.price_difference || 0) > 0)
                                  .reduce((sum, e) => sum + (e.payment_cash || 0) + (e.payment_transfer || 0), 0) || 0
                              )}
                            </p>
                          </div>
                          <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">Se Devolvió (Resta)</p>
                            <p className="text-sm font-bold text-red-600 dark:text-red-400">
                              - COP {formatCOP(
                                dailyStats.exchanges
                                  ?.filter(e => (e.price_difference || 0) < 0)
                                  .reduce((sum, e) => sum + (e.payment_cash || 0) + (e.payment_transfer || 0), 0) || 0
                              )}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Actions */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setPhase(1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Button>
                  <Button onClick={() => setPhase(3)}>
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Phase 3: Final Summary */}
            {phase === 3 && (
              <div className="space-y-6">
                {/* Final Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ingresos Totales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        COP {formatCOP(paymentTotals.total)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Facturas Totales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{dailyStats.totalInvoices}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Créditos Pendientes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        COP {formatCOP(dailyStats.pendingCreditBalance)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {dailyStats.creditInvoices} facturas a crédito
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Devoluciones
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        COP {formatCOP(dailyStats.totalReturns)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Monto total devuelto</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Closed By Input */}
                <Card>
                  <CardHeader>
                    <CardTitle>Nombre de quien realiza el cierre</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="closedBy">Nombre completo</Label>
                      <Input
                        id="closedBy"
                        type="text"
                        placeholder="Ingresa tu nombre"
                        value={closedByName}
                        onChange={(e) => setClosedByName(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setPhase(2)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Button>
                  <Button 
                    onClick={handleFinalizeClosure}
                    disabled={!closedByName.trim()}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Iniciar Cierre
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    {/* Dialog de Detalles de Ganancias */}
    <Dialog open={showProfitDetails} onOpenChange={setShowProfitDetails}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de Ganancias por Producto</DialogTitle>
          <DialogDescription>
            Productos vendidos en facturas pagadas del día
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumen General */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Total Vendido</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                  COP {formatCOP(totalCost + calculateProfitCollected())}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Costo Total</p>
                <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                  COP {formatCOP(totalCost)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">Ganancia Total</p>
                <p className="text-xl font-bold text-green-600 dark:text-green-400">
                  COP {formatCOP(calculateProfitCollected())}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Tabla de Productos */}
          <div className="border border-border rounded-lg overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-muted sticky top-0 z-10">
                  <tr>
                    <th className="text-left py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('product')}
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        Producto
                        {sortColumn === 'product' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('invoice')}
                        className="flex items-center gap-1 hover:text-primary mx-auto"
                      >
                        Factura
                        {sortColumn === 'invoice' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('quantity')}
                        className="flex items-center gap-1 hover:text-primary mx-auto"
                      >
                        Cant.
                        {sortColumn === 'quantity' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('unitPrice')}
                        className="flex items-center gap-1 hover:text-primary ml-auto"
                      >
                        Precio Unit.
                        {sortColumn === 'unitPrice' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('totalSale')}
                        className="flex items-center gap-1 hover:text-primary ml-auto"
                      >
                        Total Venta
                        {sortColumn === 'totalSale' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('unitCost')}
                        className="flex items-center gap-1 hover:text-primary ml-auto"
                      >
                        Costo Unit.
                        {sortColumn === 'unitCost' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('totalCost')}
                        className="flex items-center gap-1 hover:text-primary ml-auto"
                      >
                        Costo Total
                        {sortColumn === 'totalCost' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('profit')}
                        className="flex items-center gap-1 hover:text-primary ml-auto"
                      >
                        Ganancia
                        {sortColumn === 'profit' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium">
                      <button
                        onClick={() => handleSort('margin')}
                        className="flex items-center gap-1 hover:text-primary ml-auto"
                      >
                        Margen %
                        {sortColumn === 'margin' ? (
                          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3" />
                        )}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Preparar datos
                    const rows = dailyStats.invoices
                      .filter(inv => inv.status === 'paid' || inv.status === 'partial_return')
                      .flatMap(invoice =>
                        invoice.items
                          .map((item: any, itemIndex: number) => {
                            const product = products.find(p => p.id === item.productId);
                            const unitCost = product?.current_cost || 0;
                            const totalCost = unitCost * item.quantity;
                            const unitPrice = item.price || 0;
                            const totalSale = item.total || 0;
                            const profit = totalSale - totalCost;
                            const margin = totalSale > 0 ? (profit / totalSale) * 100 : 0;

                            return {
                              key: `${invoice.id}-${itemIndex}`,
                              invoice,
                              item,
                              product,
                              unitCost,
                              totalCost,
                              unitPrice,
                              totalSale,
                              profit,
                              margin,
                            };
                          })
                      );

                    // Ordenar datos
                    if (sortColumn) {
                      rows.sort((a, b) => {
                        let aValue: any;
                        let bValue: any;

                        switch (sortColumn) {
                          case 'product':
                            aValue = a.item.productName?.toLowerCase() || '';
                            bValue = b.item.productName?.toLowerCase() || '';
                            break;
                          case 'invoice':
                            aValue = parseInt(a.invoice.number) || 0;
                            bValue = parseInt(b.invoice.number) || 0;
                            break;
                          case 'quantity':
                            aValue = a.item.quantity;
                            bValue = b.item.quantity;
                            break;
                          case 'unitPrice':
                            aValue = a.unitPrice;
                            bValue = b.unitPrice;
                            break;
                          case 'totalSale':
                            aValue = a.totalSale;
                            bValue = b.totalSale;
                            break;
                          case 'unitCost':
                            aValue = a.unitCost;
                            bValue = b.unitCost;
                            break;
                          case 'totalCost':
                            aValue = a.totalCost;
                            bValue = b.totalCost;
                            break;
                          case 'profit':
                            aValue = a.profit;
                            bValue = b.profit;
                            break;
                          case 'margin':
                            aValue = a.margin;
                            bValue = b.margin;
                            break;
                          default:
                            return 0;
                        }

                        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
                        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
                        return 0;
                      });
                    }

                    // Renderizar filas
                    return rows.map(row => (
                      <tr key={row.key} className="border-b border-border hover:bg-muted/50">
                        <td className="py-2 px-4">
                          <div>
                            <p className="font-medium text-sm">{row.item.productName}</p>
                            <p className="text-xs text-muted-foreground">{row.item.productCode || '-'}</p>
                          </div>
                        </td>
                        <td className="py-2 px-4 text-center">
                          <span className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {row.invoice.number}
                          </span>
                        </td>
                        <td className="py-2 px-4 text-center font-medium">{row.item.quantity}</td>
                        <td className="py-2 px-4 text-right text-sm">
                          COP {formatCOP(row.unitPrice)}
                        </td>
                        <td className="py-2 px-4 text-right font-medium text-blue-600 dark:text-blue-400">
                          COP {formatCOP(row.totalSale)}
                        </td>
                        <td className="py-2 px-4 text-right text-sm">
                          COP {formatCOP(row.unitCost)}
                        </td>
                        <td className="py-2 px-4 text-right font-medium text-orange-600 dark:text-orange-400">
                          COP {formatCOP(row.totalCost)}
                        </td>
                        <td className="py-2 px-4 text-right font-bold text-green-600 dark:text-green-400">
                          COP {formatCOP(row.profit)}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <span className={`font-bold ${
                            row.margin >= 30
                              ? 'text-green-600 dark:text-green-400'
                              : row.margin >= 15
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            {row.margin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sección de Cambios */}
          {(dailyStats.exchanges || []).length > 0 && (
            <div>
              <h3 className="font-semibold text-sm mb-2">Impacto de Cambios del Día</h3>
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium">Cambio</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Cliente</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Producto Devuelto</th>
                      <th className="text-left py-3 px-4 text-sm font-medium">Producto Entregado</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">Dif. Precio</th>
                      <th className="text-right py-3 px-4 text-sm font-medium">Dif. Utilidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dailyStats.exchanges || []).map((exchange: any) => {
                      const profitDiff = Number(exchange.profit_difference) || 0;
                      const priceDiff = Number(exchange.price_difference) || 0;
                      const originalNames = (exchange.original_products || []).map((p: any) => `${p.productName} x${p.quantity}`).join(', ') || exchange.original_product_name || '-';
                      const newNames = (exchange.new_products || []).map((p: any) => `${p.productName} x${p.quantity}`).join(', ') || exchange.new_product_name || (exchange.status === 'pending' ? 'En espera' : '-');
                      return (
                        <tr key={exchange.id} className="border-b border-border hover:bg-muted/50">
                          <td className="py-2 px-4">
                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded">{exchange.exchange_number}</span>
                          </td>
                          <td className="py-2 px-4 text-sm">{exchange.customer_name || '-'}</td>
                          <td className="py-2 px-4 text-sm text-red-600 dark:text-red-400">{originalNames}</td>
                          <td className="py-2 px-4 text-sm text-green-600 dark:text-green-400">{newNames}</td>
                          <td className="py-2 px-4 text-right font-medium text-sm">
                            <span className={priceDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {priceDiff >= 0 ? '+' : ''}COP {formatCOP(priceDiff)}
                            </span>
                          </td>
                          <td className="py-2 px-4 text-right font-bold">
                            <span className={profitDiff >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {profitDiff >= 0 ? '+' : ''}COP {formatCOP(profitDiff)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/50">
                    <tr>
                      <td colSpan={5} className="py-2 px-4 text-sm font-semibold text-right">Total impacto utilidad:</td>
                      <td className="py-2 px-4 text-right font-bold">
                        {(() => {
                          const total = (dailyStats.exchanges || []).reduce((sum: number, ex: any) => sum + (Number(ex.profit_difference) || 0), 0);
                          return (
                            <span className={total >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {total >= 0 ? '+' : ''}COP {formatCOP(total)}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Botón de Cerrar */}
          <div className="flex justify-end">
            <Button onClick={() => setShowProfitDetails(false)}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}