import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCOP } from '../lib/currency';
import { addMonthlyClosure, getCurrentUser, getColombiaDate } from '../lib/supabase';
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
    ingresosPorFactura?: number; // NUEVO: Ingresos por factura (todas las facturas + impacto cambios)
    exchangeImpact?: number; // NUEVO: Impacto de cambios por separado
  };
  monthToClose: string; // NUEVO: Mes que se está cerrando (formato YYYY-MM)
  onSuccess: () => void;
}

export function MonthlyClosureDialog({
  open,
  onOpenChange,
  monthlyStats,
  monthToClose,
  onSuccess
}: MonthlyClosureDialogProps) {
  const [phase, setPhase] = useState<Phase>(1);
  const [closedByName, setClosedByName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [showJustification, setShowJustification] = useState(false);

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

        await addMonthlyClosure({
          month: currentMonth,
          year: currentYear,
          total_revenue: monthlyStats.ingresosPorFactura || 0, // NUEVO: Ingresos por factura (dato real a guardar)
          total_invoices: monthlyStats.totalInvoices,
          daily_closures_count: monthlyStats.closures.length,
          real_profit: monthlyStats.realProfit, // Ganancias reales (calculadas con ingresosPorFactura)
          profit_generated: profitGenerated, // Ganancia de todas las ventas del mes
          profit_collected: profitCollected, // Ganancia de facturas pagadas al 100%
          total_credit_payments: monthlyStats.totalCreditPayments || 0, // Abonos de créditos del mes
          profit_from_credit: monthlyStats.profitFromCredit || 0, // Ganancias de facturas a crédito del mes
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

                {/* Ingresos Netos Card - Full Width - CARD MÁS IMPORTANTE */}
                <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-emerald-900 dark:text-emerald-100">Ingresos del Mes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 space-y-6">
                        {/* NUEVO: Ingresos por Facturas */}
                        <div className="pb-4 border-b border-emerald-300 dark:border-emerald-700">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2 font-semibold">
                            💰 Ingresos por Facturas
                          </p>
                          <div className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
                            COP {formatCOP(monthlyStats.ingresosPorFactura || 0)}
                          </div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
                            Todas las facturas del mes (regulares, crédito y parciales) + impacto por cambios
                          </p>
                        </div>

                        {/* Ingresos Netos (con abonos) */}
                        <div>
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2 font-semibold">
                            💵 Ingresos Netos (Efectivo Recibido)
                          </p>
                          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                            COP {formatCOP(monthlyStats.netRevenue + (monthlyStats.totalCreditPayments || 0))}
                          </div>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                            Facturas pagadas + Abonos de créditos
                          </p>
                          <div className="mt-2 space-y-1">
                            {(monthlyStats.serviceRevenue || 0) > 0 && (
                              <p className="text-xs text-blue-600 dark:text-blue-400">
                                • Servicio Técnico: COP {formatCOP(monthlyStats.serviceRevenue || 0)}
                              </p>
                            )}
                            {(monthlyStats.totalCreditPayments || 0) > 0 && (
                              <p className="text-xs text-purple-600 dark:text-purple-400">
                                • Abonos de Créditos: COP {formatCOP(monthlyStats.totalCreditPayments || 0)}
                              </p>
                            )}
                            {(monthlyStats.exchangeImpact || 0) !== 0 && (
                              <p className={`text-xs ${(monthlyStats.exchangeImpact || 0) > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                • Impacto de Cambios: {(monthlyStats.exchangeImpact || 0) > 0 ? '+' : ''}COP {formatCOP(monthlyStats.exchangeImpact || 0)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Ganancias Reales */}
                        <div className="pt-4 border-t border-emerald-300 dark:border-emerald-700">
                          <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2 font-semibold">
                            📊 Ganancias Reales
                          </p>
                          <div className={`text-3xl font-bold ${
                            monthlyStats.realProfit >= 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            COP {formatCOP(monthlyStats.realProfit)}
                          </div>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                            Ingresos por factura - Costos - Gastos
                          </p>
                          <div className="mt-2 space-y-1 text-xs">
                            <p className="text-cyan-600 dark:text-cyan-400">
                              Ingresos por factura: COP {formatCOP(monthlyStats.ingresosPorFactura || 0)}
                            </p>
                            <p className="text-orange-600 dark:text-orange-400">
                              - Costos productos: COP {formatCOP(monthlyStats.totalProductCost)}
                            </p>
                            <p className="text-red-600 dark:text-red-400">
                              - Gastos: COP {formatCOP(monthlyStats.totalExpenses)}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <div className="text-sm space-y-3">
                          <div>
                            <p className="text-zinc-600 dark:text-zinc-400 font-semibold mb-2">
                              💰 Ingresos por Facturas:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300 text-xs">
                              <li>Todas las facturas del mes</li>
                              <li>Regulares, a crédito y parciales</li>
                              <li>Más impacto de cambios</li>
                            </ul>
                          </div>
                          <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                            <p className="text-zinc-600 dark:text-zinc-400 font-semibold mb-2">
                              💵 Ingresos Netos:
                            </p>
                            <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300 text-xs">
                              <li>Facturas pagadas completamente</li>
                              <li>Facturas con devolución parcial</li>
                              <li className="text-purple-600 dark:text-purple-400">Abonos de créditos recibidos</li>
                              {(monthlyStats.serviceRevenue || 0) > 0 && (
                                <li className="text-blue-600 dark:text-blue-400">Servicio Técnico pagado</li>
                              )}
                            </ul>
                          </div>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                            Las devoluciones completas no se cuentan ya que la factura pasa a estado "Devuelta"
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Final Stats */}
                <div className="space-y-6">
                  {/* Primera fila: Métricas principales */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <Card className="border-green-200 dark:border-green-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <span className="text-lg">💰</span>
                          Ingresos Totales del Mes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-green-600 dark:text-green-400 mb-2">
                          {formatCOP(monthlyStats.totalRevenue)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Suma de todos los cierres diarios
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <span className="text-lg">📋</span>
                          Facturas Totales
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-4xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                          {monthlyStats.totalInvoices}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {monthlyStats.closures.length} cierres diarios
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-orange-200 dark:border-orange-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <span className="text-lg">⏳</span>
                          Crédito Pendiente
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">
                          {formatCOP(monthlyStats.totalPendingCredit)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Saldo pendiente total
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Segunda fila: Ganancias y pagos */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <Card className="border-indigo-200 dark:border-indigo-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <span className="text-lg">💎</span>
                          Ganancias Reales
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-3xl font-bold mb-3 ${
                          monthlyStats.realProfit >= 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {formatCOP(monthlyStats.realProfit)}
                        </div>
                        <div className="space-y-2 pt-3 border-t border-indigo-200 dark:border-indigo-800">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Costo productos:</span>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              {formatCOP(monthlyStats.totalProductCost)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">Gastos:</span>
                            <span className="font-medium text-red-600 dark:text-red-400">
                              {formatCOP(monthlyStats.totalExpenses)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="border-purple-200 dark:border-purple-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <span className="text-lg">💵</span>
                          Abonos de Créditos
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                          {formatCOP(monthlyStats.totalCreditPayments || 0)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Pagos recibidos del mes
                        </p>
                      </CardContent>
                    </Card>

                    <Card className="border-cyan-200 dark:border-cyan-800">
                      <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                          <span className="text-lg">📊</span>
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
                        <p className="text-sm text-muted-foreground">
                          Utilidad de facturas a crédito
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Explicación de Diferencia entre Ingresos Totales e Ingresos Netos */}
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300 dark:border-amber-800">
                  <CardHeader>
                    <button
                      onClick={() => setShowJustification(!showJustification)}
                      className="w-full flex items-center justify-between text-left hover:opacity-80 transition-opacity"
                    >
                      <CardTitle className="text-base font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Justificación: ¿Por qué difieren los Ingresos del Mes y los Ingresos Netos?
                      </CardTitle>
                      {showJustification ? (
                        <ChevronUp className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-amber-700 dark:text-amber-300" />
                      )}
                    </button>
                  </CardHeader>
                  {showJustification && (
                    <CardContent>
                    <div className="space-y-4">
                      {/* Resumen de la diferencia */}
                      <div className="bg-white/70 dark:bg-zinc-900/70 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mb-1">Ingresos del Mes (Cierres)</p>
                            <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                              COP {formatCOP(monthlyStats.totalRevenue)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-1">Ingresos Netos (Facturas)</p>
                            <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                              COP {formatCOP(monthlyStats.netRevenue)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-zinc-700 dark:text-zinc-300 mb-1">Diferencia</p>
                            <p className={`text-xl font-bold ${
                              Math.abs(monthlyStats.totalRevenue - monthlyStats.netRevenue) < 1000
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-orange-600 dark:text-orange-400'
                            }`}>
                              COP {formatCOP(Math.abs(monthlyStats.totalRevenue - monthlyStats.netRevenue))}
                            </p>
                          </div>
                        </div>

                        {/* Explicación detallada */}
                        <div className="space-y-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                          <div>
                            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">
                              📊 Cálculo: Ingresos del Mes (Basado en Cierres Diarios)
                            </p>
                            <div className="pl-4 space-y-1 text-sm text-amber-800 dark:text-amber-200">
                              <p>• Suma de todos los cierres diarios del mes</p>
                              <p>• Incluye todas las facturas registradas cada día, sin importar su estado final</p>
                              <p>• Puede incluir facturas que luego fueron devueltas completamente</p>
                              <p className="font-mono text-xs bg-amber-100 dark:bg-amber-900/30 p-2 rounded mt-2">
                                = Suma de {monthlyStats.closures.length} cierres diarios = COP {formatCOP(monthlyStats.totalRevenue)}
                              </p>
                            </div>
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 mb-2">
                              💰 Cálculo: Ingresos Netos (Basado en Estado de Facturas)
                            </p>
                            <div className="pl-4 space-y-1 text-sm text-emerald-800 dark:text-emerald-200">
                              <p>• Evalúa cada factura individualmente según su estado actual</p>
                              <p>• Solo cuenta facturas con estado "Pagada" o "Parcialmente Devuelta"</p>
                              <p>• Excluye automáticamente facturas con estado "Devuelta Completa"</p>
                              <p>• Incluye el impacto de cambios (diferencias de precio)</p>
                              <p className="font-mono text-xs bg-emerald-100 dark:bg-emerald-900/30 p-2 rounded mt-2">
                                = Facturas Pagadas + Facturas Parcialmente Devueltas + Impacto Cambios = COP {formatCOP(monthlyStats.netRevenue)}
                              </p>
                            </div>
                          </div>

                          <div className="bg-orange-100 dark:bg-orange-900/30 p-3 rounded-lg border border-orange-300 dark:border-orange-700">
                            <p className="text-sm font-semibold text-orange-900 dark:text-orange-100 mb-2">
                              ⚠️ ¿Por qué hay diferencia?
                            </p>
                            <div className="text-xs text-orange-800 dark:text-orange-200 space-y-1">
                              <p>
                                <strong>Motivo principal:</strong> Los cierres diarios capturan el momento en que se creó la factura,
                                pero los Ingresos Netos reflejan el estado actual de cada factura.
                              </p>
                              <p className="mt-2">
                                <strong>Ejemplos de diferencias:</strong>
                              </p>
                              <ul className="list-disc list-inside pl-2 space-y-1">
                                <li>Una factura incluida en un cierre diario puede haber sido devuelta completamente después</li>
                                <li>Una factura parcialmente devuelta cuenta su total en cierres, pero su impacto real es menor</li>
                                <li>Los cambios de productos generan diferencias de precio que se reflejan solo en Ingresos Netos</li>
                              </ul>
                            </div>
                          </div>

                          <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg border border-green-300 dark:border-green-700">
                            <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-1">
                              ✅ Conclusión
                            </p>
                            <p className="text-xs text-green-800 dark:text-green-200">
                              Los <strong>Ingresos Netos</strong> son más precisos porque consideran el estado final de cada operación,
                              mientras que los <strong>Ingresos del Mes</strong> son un registro histórico del momento del cierre.
                              Ambos valores son correctos, pero miden cosas diferentes.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  )}
                </Card>

                {/* Nota explicativa */}
                <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Nota:</strong> Los <strong>Ingresos Totales del Mes</strong> (basados en los cierres diarios) y los <strong>Ingresos Netos</strong> no siempre concordarán exactamente.
                    Los Ingresos Netos evalúan factura por factura considerando solo aquellas que están pagadas o con devolución parcial, excluyendo automáticamente las devoluciones completas,
                    lo que proporciona un cálculo más exacto y preciso del dinero realmente obtenido en el mes.
                  </p>
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
  );
}