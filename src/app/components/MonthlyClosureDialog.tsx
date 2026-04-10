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
        const closuresIds = monthlyStats.closures.map(c => c.id);

        await addMonthlyClosure({
          month: currentMonth,
          year: currentYear,
          totalRevenue: monthlyStats.totalRevenue,
          totalInvoices: monthlyStats.totalInvoices,
          totalPendingCredit: monthlyStats.totalPendingCredit,
          dailyClosures: closuresIds,
          closedBy: closedByName.trim(),
          closedAt: new Date().toISOString(),
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
                        Ganancias
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className={`text-2xl font-bold ${
                        (monthlyStats.totalRevenue - monthlyStats.totalExpenses) >= 0
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        COP {formatCOP(monthlyStats.totalRevenue - monthlyStats.totalExpenses)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ingresos - Gastos
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                        Gastos: COP {formatCOP(monthlyStats.totalExpenses)}
                      </p>
                    </CardContent>
                  </Card>
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