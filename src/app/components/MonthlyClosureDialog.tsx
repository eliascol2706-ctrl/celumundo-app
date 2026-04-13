import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCOP } from '../lib/currency';
import { addMonthlyClosure, getCurrentUser } from '../lib/supabase';
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
  };
  onSuccess: () => void;
}

export function MonthlyClosureDialog({ 
  open, 
  onOpenChange, 
  monthlyStats,
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
        const currentMonth = new Date().toISOString().substring(0, 7);
        const currentYear = new Date().getFullYear();

        await addMonthlyClosure({
          month: currentMonth,
          year: currentYear,
          total_revenue: monthlyStats.netRevenue, // Ingresos netos (facturas pagadas + parcialmente devueltas)
          total_invoices: monthlyStats.totalInvoices,
          daily_closures_count: monthlyStats.closures.length,
          real_profit: monthlyStats.realProfit, // Ganancias reales (ventas - costos - gastos)
          closed_by: closedByName.trim(),
          closed_at: new Date().toISOString(),
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
                <span>Cierre Mensual - Fase {phase} de 2</span>
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  <X className="h-5 w-5" />
                </Button>
              </DialogTitle>
              <DialogDescription>
                Revisa los detalles del cierre mensual antes de finalizar.
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
                {/* Final Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ingresos Totales del Mes
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                        COP {formatCOP(monthlyStats.totalRevenue)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Suma de todos los cierres diarios
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Facturas Totales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">{monthlyStats.totalInvoices}</div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {monthlyStats.closures.length} cierres diarios
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Crédito Pendiente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                        COP {formatCOP(monthlyStats.totalPendingCredit)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Saldo pendiente total
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ganancias Reales
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${
                        monthlyStats.realProfit >= 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        COP {formatCOP(monthlyStats.realProfit)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ventas - Costos - Gastos
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-zinc-600 dark:text-zinc-400">
                          Costo productos: COP {formatCOP(monthlyStats.totalProductCost)}
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400">
                          Gastos: COP {formatCOP(monthlyStats.totalExpenses)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Ingresos Netos Card - Full Width */}
                <Card className="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                      Ingresos Netos del Mes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 space-y-6">
                        <div>
                          <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                            COP {formatCOP(monthlyStats.netRevenue)}
                          </div>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                            Total de facturas pagadas y parcialmente devueltas
                          </p>
                        </div>

                        <div className="pt-4 border-t border-emerald-300 dark:border-emerald-700">
                          <div className={`text-3xl font-bold ${
                            (monthlyStats.netRevenue - monthlyStats.totalExpenses) >= 0
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}>
                            COP {formatCOP(monthlyStats.netRevenue - monthlyStats.totalExpenses)}
                          </div>
                          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-2">
                            Ingresos netos restando gastos del mes
                          </p>
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            Gastos: COP {formatCOP(monthlyStats.totalExpenses)}
                          </p>
                        </div>
                      </div>
                      <div className="flex-shrink-0 bg-white/50 dark:bg-zinc-900/50 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                        <div className="text-sm space-y-1">
                          <p className="text-zinc-600 dark:text-zinc-400">
                            Este valor incluye:
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-zinc-700 dark:text-zinc-300">
                            <li>Facturas pagadas completamente</li>
                            <li>Facturas con devolución parcial</li>
                          </ul>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                            Las devoluciones completas no se cuentan ya que la factura pasa a estado "Devuelta"
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Explicación de Diferencia entre Ingresos Totales e Ingresos Netos */}
                <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-300 dark:border-amber-800">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-2">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Justificación: ¿Por qué difieren los Ingresos del Mes y los Ingresos Netos?
                    </CardTitle>
                  </CardHeader>
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