import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
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
  };
  dayToClose: string; // YYYY-MM-DD date to close
  hourlyData: any[];
  topProducts: any[];
  onSuccess: () => void;
}

export function DailyClosureDialog({ 
  open, 
  onOpenChange, 
  dailyStats,
  dayToClose,
  hourlyData,
  topProducts,
  onSuccess 
}: DailyClosureDialogProps) {
  const [phase, setPhase] = useState<Phase>(1);
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'regular' | 'wholesale'>('all');
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [closedByName, setClosedByName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const currentUser = getCurrentUser();

  // Calcular totales de efectivo y transferencias de las facturas del día
  const calculatePaymentTotals = () => {
    let totalCash = 0;
    let totalTransfer = 0;

    dailyStats.invoices.forEach(invoice => {
      // Solo contar facturas pagadas (no créditos pendientes)
      if (invoice.status === 'paid' && !invoice.is_credit) {
        // Parsear payment_method que viene como string: "Efectivo: $416.500, Transferencia: $30.000"
        const paymentStr = invoice.payment_method || '';
        
        // Extraer efectivo - buscar el patrón completo incluyendo puntos de miles
        const cashMatch = paymentStr.match(/Efectivo:\s*\$?([\d,.]+)/i);
        if (cashMatch) {
          // Remover puntos (separadores de miles) y convertir
          const cashValue = parseFloat(cashMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(cashValue)) {
            totalCash += cashValue;
          }
        }
        
        // Extraer transferencia - buscar el patrón completo incluyendo puntos de miles
        const transferMatch = paymentStr.match(/Transferencia:\s*\$?([\d,.]+)/i);
        if (transferMatch) {
          // Remover puntos (separadores de miles) y convertir
          const transferValue = parseFloat(transferMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(transferValue)) {
            totalTransfer += transferValue;
          }
        }

        // También considerar "Otros" como efectivo
        const otherMatch = paymentStr.match(/Otros:\s*\$?([\d,.]+)/i);
        if (otherMatch) {
          const otherValue = parseFloat(otherMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(otherValue)) {
            totalCash += otherValue; // Sumar "Otros" a efectivo
          }
        }
      }
    });

    return { totalCash, totalTransfer, total: totalCash + totalTransfer };
  };

  const paymentTotals = calculatePaymentTotals();

  const resetDialog = () => {
    setPhase(1);
    setInvoiceFilter('all');
    setShowInvoiceDetails(false);
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

        await addDailyClosure({
          date: dayToClose,
          total_invoices: dailyStats.totalInvoices,
          pending_invoices: dailyStats.invoices.filter(inv => inv.status === 'pending').length,
          paid_invoices: dailyStats.invoices.filter(inv => inv.status === 'paid').length,
          total_cash: totalCashValue,
          total_transfer: totalTransferValue,
          total,
          closed_by: closedByName.trim(),
          closed_at: new Date().toISOString(),
        });

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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <div className="py-16 text-center">
            <Loader2 className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 animate-spin mb-4" />
            <h3 className="text-xl font-bold mb-2">Procesando Cierre...</h3>
            <p className="text-muted-foreground">Por favor espera un momento</p>
          </div>
        ) : isSuccess ? (
          <div className="py-16 text-center">
            <CheckCircle className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">¡Cierre Realizado Exitosamente!</h3>
            <p className="text-muted-foreground">El cierre diario ha sido registrado correctamente</p>
          </div>
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
                {/* Top Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ingresos Totales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        COP {formatCOP(paymentTotals.total)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Efectivo
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCOP(paymentTotals.totalCash)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Transferencias
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                        {formatCOP(paymentTotals.totalTransfer)}
                      </div>
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
                <div className="grid grid-cols-3 gap-4">
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
                                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                                  }`}>
                                    {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
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
  );
}