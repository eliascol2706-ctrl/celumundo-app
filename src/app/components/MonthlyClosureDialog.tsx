import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, Package } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCOP } from '../lib/currency';
import { addMonthlyClosure, getCurrentUser, getColombiaDate, extractColombiaDate } from '../lib/supabase';
import { toast } from 'sonner';

type Phase = 1 | 2;

interface MonthlyClosureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  monthlyStats: {
    totalRevenue: number;
    totalInvoices: number;
    totalPendingCredit: number;
    totalExpenses: number;
    closures: any[];
    comparisonData: any[];
    dailySalesData: any[];
    creditComparisonData: any[];
    netRevenue: number;
    totalProductCost: number;
    realProfit: number;
    currentMonthRevenue: number;
    serviceRevenue?: number; // Ingresos de servicio técnico
    totalCreditPayments?: number; // NUEVO: Total de abonos de créditos del mes
    profitFromCredit?: number; // NUEVO: Ganancias de facturas a crédito del mes
    ingresosPorFactura?: number; // Total facturas en confirmación (pending_confirmation)
    ingresoNetos?: number; // Ingresos netos: regulares pagadas + todas las de crédito
    allCreditTotal?: number; // Total facturas a crédito del mes
    exchangeImpact?: number; // Impacto de cambios por separado
  };
  monthToClose: string; // NUEVO: Mes que se está cerrando (formato YYYY-MM)
  invoices?: any[]; // NUEVO: Facturas para justificativo de diferencia
  exchanges?: any[]; // NUEVO: Cambios para justificativo de diferencia
  returns?: any[]; // NUEVO: Devoluciones para justificativo de diferencia
  creditNotes?: any[]; // NUEVO: Notas de crédito del mes
  onSuccess: () => void;
}

export function MonthlyClosureDialog({
  open,
  onOpenChange,
  monthlyStats,
  monthToClose,
  invoices = [],
  exchanges = [],
  returns = [],
  creditNotes = [],
  onSuccess
}: MonthlyClosureDialogProps) {
  const [phase, setPhase] = useState<Phase>(1);
  const [closedByName, setClosedByName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const currentUser = getCurrentUser();

  const resetDialog = () => {
    setPhase(1);
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

  const handleFinalizeClosure = async () => {
    if (!closedByName.trim()) {
      toast.error('Por favor, ingresa el nombre de quien realiza el cierre');
      return;
    }

    setIsLoading(true);

    // Simular procesamiento
    setTimeout(async () => {
      try {
        // Usar el mes que se está cerrando en lugar del mes actual
        const currentMonth = monthToClose; // YYYY-MM
        const currentYear = parseInt(monthToClose.substring(0, 4), 10);

        // Obtener fecha y hora de Colombia en formato ISO
        const now = new Date();
        const formatter = new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        const parts = formatter.formatToParts(now);
        const get = (type: string) => parts.find(p => p.type === type)?.value || '';
        const closedAtISO = `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}-05:00`;

        // Calcular profit_generated y profit_collected sumando los cierres diarios
        const profitGenerated = monthlyStats.closures.reduce((sum, closure) => {
          return sum + (closure.profit_generated || 0);
        }, 0);

        const profitCollected = monthlyStats.closures.reduce((sum, closure) => {
          return sum + (closure.profit_collected || 0);
        }, 0);

        // Calcular total de notas de crédito del mes
        const creditNotesTotal = creditNotes
          .filter(cn => {
            if (!cn.date || cn.status !== 'issued') return false;
            const cnDate = extractColombiaDate(cn.date);
            return cnDate.substring(0, 7) === monthToClose;
          })
          .reduce((sum, cn) => sum + (cn.total || 0), 0);

        const totalClosuresIncome = monthlyStats.closures.reduce((s, c) => s + (c.total || 0), 0);
        const cashRegisterTotal = monthlyStats.closures.reduce((s, c) => s + (c.cash_register_total || 0), 0);
        const gananciasNetas = profitGenerated + profitCollected;
        const finalProfit = gananciasNetas - monthlyStats.totalExpenses;

        await addMonthlyClosure({
          month: currentMonth,
          year: currentYear,
          total_revenue: monthlyStats.ingresoNetos || 0,
          total_invoices: monthlyStats.totalInvoices,
          daily_closures_count: monthlyStats.closures.length,
          real_profit: monthlyStats.realProfit,
          profit_generated: profitGenerated,
          profit_collected: profitCollected,
          credit_notes_total: creditNotesTotal,
          total_closures_income: totalClosuresIncome,
          cash_register_total: cashRegisterTotal,
          final_profit: finalProfit,
          total_pending_credit: monthlyStats.totalPendingCredit || 0,
          total_credit_payments: monthlyStats.totalCreditPayments || 0,
          closed_by: closedByName.trim(),
          closed_at: closedAtISO,
        });

        setIsLoading(false);
        setIsSuccess(true);

        setTimeout(() => {
          resetDialog();
          onOpenChange(false);
          onSuccess();
          toast.success('Cierre mensual realizado exitosamente');
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
              <DialogTitle>Procesando Cierre Mensual</DialogTitle>
              <DialogDescription id="status-description">
                El cierre mensual está siendo procesado
              </DialogDescription>
            </DialogHeader>
            <div className="py-16 text-center">
              <Loader2 className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 animate-spin mb-4" />
              <h3 className="text-xl font-bold mb-2">Procesando Cierre Mensual...</h3>
              <p className="text-muted-foreground">Por favor espera un momento</p>
            </div>
          </>
        ) : isSuccess ? (
          <>
            <DialogHeader className="sr-only">
              <DialogTitle>Cierre Mensual Exitoso</DialogTitle>
              <DialogDescription id="status-description">
                El cierre mensual ha sido completado con éxito
              </DialogDescription>
            </DialogHeader>
            <div className="py-16 text-center">
              <CheckCircle className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 mb-4" />
              <h3 className="text-xl font-bold mb-2">¡Cierre Mensual Realizado Exitosamente!</h3>
              <p className="text-muted-foreground">El cierre mensual ha sido registrado correctamente</p>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Cierre Mensual {new Date(monthToClose + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })} - Fase {phase} de 2</span>
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  <X className="h-5 w-5" />
                </Button>
              </DialogTitle>
              <DialogDescription>
                Revisa los detalles del cierre mensual de {new Date(monthToClose + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' })} antes de finalizar.
              </DialogDescription>
            </DialogHeader>

            {/* Phase 1: Charts and Comparisons */}
            {phase === 1 && (
              <div className="space-y-6">
                {/* Sales Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparación de Ventas con Mes Anterior</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyStats.comparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                        <Legend />
                        <Bar dataKey="ventas" fill="#16a34a" name="Ventas" />
                      </BarChart>
                    </ResponsiveContainer>
                    {monthlyStats.comparisonData.length >= 2 && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          {monthlyStats.comparisonData[1].ventas > monthlyStats.comparisonData[0].ventas ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ↑ Incremento de COP {formatCOP(monthlyStats.comparisonData[1].ventas - monthlyStats.comparisonData[0].ventas)}
                            </span>
                          ) : monthlyStats.comparisonData[1].ventas < monthlyStats.comparisonData[0].ventas ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              ↓ Disminución de COP {formatCOP(monthlyStats.comparisonData[0].ventas - monthlyStats.comparisonData[1].ventas)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">Sin cambios</span>
                          )}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Credits Comparison Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Comparación de Créditos con Mes Anterior</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyStats.creditComparisonData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                        <Legend />
                        <Bar dataKey="creditos" fill="#f59e0b" name="Créditos Pendientes" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Daily Sales Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Días con Más Ventas del Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={monthlyStats.dailySalesData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="day" />
                        <YAxis />
                        <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="sales" 
                          stroke="#16a34a" 
                          strokeWidth={2} 
                          name="Ventas Diarias"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={handleClose}>
                    Cancelar Cierre
                  </Button>
                  <Button onClick={() => setPhase(2)}>
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Phase 2: Final Summary */}
            {phase === 2 && (
              <div className="space-y-6">
                {/* Servicio Técnico Alert */}
                {(monthlyStats.serviceRevenue || 0) > 0 && (
                  <Card className="border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0 bg-blue-600 dark:bg-blue-500 text-white rounded-full p-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                            Servicio Técnico incluido en Ingresos Netos
                          </h4>
                          <p className="text-xs text-blue-700 dark:text-blue-300">
                            Este mes incluye <span className="font-bold">COP {formatCOP(monthlyStats.serviceRevenue || 0)}</span> de ingresos del módulo de Servicio Técnico
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 3 cards: Ingresos del Mes | Ingresos de Caja | Ganancias Netas */}
                {(() => {
                  const totalIngresosMes = monthlyStats.closures.reduce((s, c) => s + (c.total || 0), 0);
                  const totalIngresoCaja = monthlyStats.closures.reduce((s, c) => s + (c.cash_register_total || 0), 0);
                  const totalGananciasRegulares = monthlyStats.closures.reduce((s, c) => s + (c.profit_collected || 0), 0);
                  const totalGananciasCredito = monthlyStats.closures.reduce((s, c) => s + (c.profit_generated || 0), 0);
                  const totalGananciasNetas = totalGananciasRegulares + totalGananciasCredito;

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Ingresos del Mes */}
                      <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">💵 Ingresos del Mes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                            COP {formatCOP(totalIngresosMes)}
                          </div>
                          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                            Suma de totales de cierres diarios
                          </p>
                        </CardContent>
                      </Card>

                      {/* Ingresos de Caja */}
                      <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30 border-cyan-200 dark:border-cyan-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">🏧 Ingresos de Caja</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                            COP {formatCOP(totalIngresoCaja)}
                          </div>
                          <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-2">
                            Suma de ingresos por caja de cierres diarios
                          </p>
                        </CardContent>
                      </Card>

                      {/* Ganancias Netas */}
                      <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-semibold text-blue-700 dark:text-blue-300">📊 Ganancias Netas</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className={`text-3xl font-bold mb-3 ${totalGananciasNetas >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                            COP {formatCOP(totalGananciasNetas)}
                          </div>
                          <div className="pt-3 border-t border-blue-200 dark:border-blue-800 space-y-2">
                            <div className="flex justify-between text-xs">
                              <span className="text-blue-600 dark:text-blue-400">Regulares</span>
                              <span className="font-semibold text-blue-700 dark:text-blue-300">COP {formatCOP(totalGananciasRegulares)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-purple-600 dark:text-purple-400">Crédito</span>
                              <span className="font-semibold text-purple-700 dark:text-purple-300">COP {formatCOP(totalGananciasCredito)}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })()}

                {/* Final Stats */}
                <div className="space-y-5">
                  {/* Primera fila: Ganancias Reales destacada */}
                  {(() => {
                      const gananciasNetas = monthlyStats.closures.reduce((s, c) => s + (c.profit_collected || 0) + (c.profit_generated || 0), 0);
                      const resultado = gananciasNetas - monthlyStats.totalExpenses;
                      return (
                        <Card className="border-indigo-200 dark:border-indigo-800">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">💎 Ganancia Final del Mes</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className={`text-3xl font-bold mb-3 ${resultado >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-600 dark:text-red-400'}`}>
                              COP {formatCOP(resultado)}
                            </div>
                            <div className="pt-3 border-t border-indigo-200 dark:border-indigo-800 space-y-2">
                              <div className="flex justify-between text-xs">
                                <span className="text-emerald-600 dark:text-emerald-400">Ganancias netas</span>
                                <span className="font-semibold text-emerald-700 dark:text-emerald-300">COP {formatCOP(gananciasNetas)}</span>
                              </div>
                              <div className="flex justify-between text-xs">
                                <span className="text-red-600 dark:text-red-400">- Gastos operativos</span>
                                <span className="font-semibold text-red-700 dark:text-red-300">COP {formatCOP(monthlyStats.totalExpenses)}</span>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })()}

                  {/* Segunda fila: 2x2 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card className="border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
                          <span className="text-xl">📋</span>
                          Facturas Totales
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                          {monthlyStats.totalInvoices}
                        </div>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          {monthlyStats.closures.length} cierres diarios
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-orange-800 dark:text-orange-200 flex items-center gap-2">
                          <span className="text-xl">⏳</span>
                          Crédito Pendiente
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                          {formatCOP(monthlyStats.totalPendingCredit)}
                        </div>
                        <p className="text-xs text-orange-700 dark:text-orange-300">
                          Saldo pendiente total
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2">
                          <span className="text-xl">💵</span>
                          Abonos de Créditos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                          {formatCOP(monthlyStats.totalCreditPayments || 0)}
                        </div>
                        <p className="text-xs text-purple-700 dark:text-purple-300">
                          Pagos recibidos en el mes
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-cyan-300 dark:border-cyan-700 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-cyan-800 dark:text-cyan-200 flex items-center gap-2">
                          <span className="text-xl">📊</span>
                          Ganancias de Créditos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-3xl font-bold mb-2 ${
                          (monthlyStats.profitFromCredit || 0) >= 0
                            ? 'text-cyan-600 dark:text-cyan-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCOP(monthlyStats.profitFromCredit || 0)}
                        </div>
                        <p className="text-xs text-cyan-700 dark:text-cyan-300">
                          Utilidad de facturas a crédito
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                </div>


                {/* Closures Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle>Resumen de Cierres Diarios</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-3 text-sm font-medium">Fecha</th>
                            <th className="text-center py-2 px-3 text-sm font-medium">Facturas</th>
                            <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                            <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyStats.closures.map((closure) => (
                            <tr key={closure.id} className="border-b border-border">
                              <td className="py-2 px-3 text-sm">
                                {new Date(closure.date).toLocaleDateString('es-ES')}
                              </td>
                              <td className="py-2 px-3 text-center text-sm">{closure.totalInvoices}</td>
                              <td className="py-2 px-3 text-right text-sm font-medium">
                                COP {formatCOP(closure.total)}
                              </td>
                              <td className="py-2 px-3 text-sm">{closure.closedBy}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

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
                  <Button variant="outline" onClick={() => setPhase(1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Volver
                  </Button>
                  <Button 
                    onClick={handleFinalizeClosure}
                    disabled={!closedByName.trim()}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Finalizar Cierre
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    </>
  );
}