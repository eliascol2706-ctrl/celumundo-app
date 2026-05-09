import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  FileText,
  Calendar,
  Save,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Package,
  Wallet,
  Clock
} from 'lucide-react';
import {
  getInvoices,
  getExpenses,
  getAllProducts,
  getColombiaDate,
  extractColombiaDate,
  getCurrentCompany,
  getCreditPayments,
  getExchanges,
  calculateExchangeImpact,
  type Invoice,
  type Expense,
  type CreditPayment,
  type Exchange
} from '../lib/supabase';
import { getServiceOrders, type ServiceOrder } from '../lib/service-orders';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { supabase } from '../lib/supabase';

interface FinancialClosure {
  id: string;
  company: 'celumundo' | 'repuestos';
  closure_timestamp: string;
  total_revenue: number;
  paid_invoices_revenue: number;
  credit_invoices_revenue: number;
  partial_returns_adjustment: number;
  service_revenue: number;
  exchanges_impact: number;
  pending_credit: number;
  credit_payments: number;
  product_costs: number;
  total_expenses: number;
  gross_profit: number;
  net_profit: number;
  total_invoices: number;
  paid_invoices: number;
  credit_invoices: number;
  partial_return_invoices: number;
  period_start: string | null;
  period_end: string;
  notes?: string;
  closed_by: string;
  created_at?: string;
  updated_at?: string;
}

export function FinancialClosures() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [closures, setClosures] = useState<FinancialClosure[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [closureNotes, setClosureNotes] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [invoicesData, expensesData, productsData, creditPaymentsData, serviceOrdersData, exchangesData, closuresData] = await Promise.all([
        getInvoices(),
        getExpenses(),
        getAllProducts(),
        getCreditPayments(),
        getServiceOrders(),
        getExchanges(),
        loadClosures()
      ]);

      setInvoices(invoicesData);
      setExpenses(expensesData);
      setProducts(productsData);
      setCreditPayments(creditPaymentsData);
      setServiceOrders(serviceOrdersData);
      setExchanges(exchangesData);
      setClosures(closuresData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const loadClosures = async () => {
    try {
      const company = getCurrentCompany();
      const { data, error } = await supabase
        .from('closures_finances')
        .select('*')
        .eq('company', company)
        .order('closure_timestamp', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading closures:', error);
      return [];
    }
  };

  const getLastClosure = (): FinancialClosure | null => {
    if (closures.length === 0) return null;
    // Los closures ya están ordenados por closure_timestamp descendente
    return closures[0];
  };

  const getPeriodStart = (): string | null => {
    const lastClosure = getLastClosure();
    return lastClosure ? lastClosure.closure_timestamp : null;
  };

  const calculateClosureData = () => {
    const company = getCurrentCompany();
    const periodStart = getPeriodStart();

    console.log('[Cierre Finanzas] Calculando desde:', periodStart || 'Inicio de los tiempos');
    console.log('[Cierre Finanzas] Hasta:', new Date().toISOString());

    // Filtrar facturas del periodo actual
    const periodInvoices = invoices.filter(inv => {
      if (inv.company !== company) return false;
      if (!inv.date) return false;

      // Si hay un cierre anterior, solo contar facturas posteriores a ese cierre
      if (periodStart) {
        const invDate = new Date(inv.date);
        const cutoffDate = new Date(periodStart);
        return invDate > cutoffDate;
      }

      // Si no hay cierres anteriores, contar todas las facturas
      return true;
    });

    console.log('[Cierre Finanzas] Facturas en el periodo:', periodInvoices.length);

    // 1. Ingresos por tipo de factura
    const paidInvoices = periodInvoices.filter(inv =>
      inv.status === 'paid' && !inv.is_credit
    );
    const creditInvoices = periodInvoices.filter(inv => inv.is_credit);
    const partialReturnInvoices = periodInvoices.filter(inv =>
      inv.status === 'partial_return'
    );

    const paidInvoicesRevenue = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const creditInvoicesRevenue = creditInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const partialReturnsAdjustment = partialReturnInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // 2. Ingresos de servicio técnico
    const periodServiceOrders = serviceOrders.filter(order => {
      if (!order.received_date) return false;

      if (periodStart) {
        const orderDate = new Date(order.received_date);
        const cutoffDate = new Date(periodStart);
        return orderDate > cutoffDate && order.payment_status === 'paid' && order.final_price;
      }

      return order.payment_status === 'paid' && order.final_price;
    });
    const serviceRevenue = periodServiceOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);

    // 3. Impacto de cambios
    const periodExchanges = exchanges.filter(exchange => {
      if (!exchange.date) return false;
      if (exchange.status !== 'completed') return false; // Solo cambios completados

      if (periodStart) {
        const exchangeDate = new Date(exchange.date);
        const cutoffDate = new Date(periodStart);
        return exchangeDate > cutoffDate;
      }

      return true;
    });
    const exchangesImpact = calculateExchangeImpact(periodExchanges);

    // 4. Total de ingresos
    const totalRevenue = paidInvoicesRevenue + creditInvoicesRevenue + partialReturnsAdjustment + serviceRevenue + exchangesImpact;

    // 5. Crédito pendiente (TODOS los créditos pendientes, no solo del periodo)
    const allCreditInvoices = invoices.filter(inv =>
      inv.company === company && inv.is_credit
    );
    const pendingCredit = allCreditInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

    // 6. Abonos a créditos del periodo
    const periodCreditPayments = creditPayments.filter(payment => {
      if (!payment.date) return false;

      if (periodStart) {
        const paymentDate = new Date(payment.date);
        const cutoffDate = new Date(periodStart);
        return paymentDate > cutoffDate;
      }

      return true;
    });
    const creditPaymentsTotal = periodCreditPayments.reduce((sum, p) => sum + p.amount, 0);

    // 7. Costo de productos vendidos
    const invoicesForCost = periodInvoices.filter(inv =>
      inv.status !== 'returned' && inv.status !== 'cancelled'
    );

    let productCosts = 0;
    invoicesForCost.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId);
          if (product && product.current_cost) {
            productCosts += product.current_cost * item.quantity;
          }
        });
      }
    });

    // 8. Gastos del periodo
    const periodExpenses = expenses.filter(expense => {
      if (!expense.date) return false;

      if (periodStart) {
        const expenseDate = new Date(expense.date);
        const cutoffDate = new Date(periodStart);
        return expenseDate > cutoffDate;
      }

      return true;
    });
    const totalExpenses = periodExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // 9. Ganancias
    const grossProfit = totalRevenue - productCosts;
    const netProfit = grossProfit - totalExpenses;

    console.log('[Cierre Finanzas] Total Revenue:', totalRevenue);
    console.log('[Cierre Finanzas] Product Costs:', productCosts);
    console.log('[Cierre Finanzas] Total Expenses:', totalExpenses);
    console.log('[Cierre Finanzas] Net Profit:', netProfit);

    return {
      totalRevenue,
      paidInvoicesRevenue,
      creditInvoicesRevenue,
      partialReturnsAdjustment,
      serviceRevenue,
      exchangesImpact,
      pendingCredit,
      creditPayments: creditPaymentsTotal,
      productCosts,
      totalExpenses,
      grossProfit,
      netProfit,
      totalInvoices: periodInvoices.length,
      paidInvoices: paidInvoices.length,
      creditInvoices: creditInvoices.length,
      partialReturnInvoices: partialReturnInvoices.length
    };
  };

  const handleSaveClosure = async () => {
    setIsSaving(true);
    try {
      const company = getCurrentCompany();
      const currentUser = localStorage.getItem('username') || 'Sistema';
      const closureTimestamp = new Date().toISOString(); // Timestamp exacto del cierre
      const periodStart = getPeriodStart();

      const closureData = calculateClosureData();

      const newClosure = {
        company,
        closure_timestamp: closureTimestamp,
        period_start: periodStart,
        period_end: closureTimestamp,
        total_revenue: closureData.totalRevenue,
        paid_invoices_revenue: closureData.paidInvoicesRevenue,
        credit_invoices_revenue: closureData.creditInvoicesRevenue,
        partial_returns_adjustment: closureData.partialReturnsAdjustment,
        service_revenue: closureData.serviceRevenue,
        exchanges_impact: closureData.exchangesImpact,
        pending_credit: closureData.pendingCredit,
        credit_payments: closureData.creditPayments,
        product_costs: closureData.productCosts,
        total_expenses: closureData.totalExpenses,
        gross_profit: closureData.grossProfit,
        net_profit: closureData.netProfit,
        total_invoices: closureData.totalInvoices,
        paid_invoices: closureData.paidInvoices,
        credit_invoices: closureData.creditInvoices,
        partial_return_invoices: closureData.partialReturnInvoices,
        notes: closureNotes,
        closed_by: currentUser
      };

      console.log('[Cierre Finanzas] Guardando cierre:', newClosure);

      const { error } = await supabase
        .from('closures_finances')
        .insert([newClosure]);

      if (error) throw error;

      toast.success('🎉 Cierre financiero guardado exitosamente. Todo se ha reiniciado desde cero.');
      setClosureNotes('');
      await loadData();
    } catch (error) {
      console.error('Error saving closure:', error);
      toast.error('Error al guardar el cierre financiero');
    } finally {
      setIsSaving(false);
    }
  };

  const getComparisonData = () => {
    if (closures.length < 2) return [];

    const sortedClosures = [...closures].sort((a, b) =>
      new Date(a.closure_timestamp).getTime() - new Date(b.closure_timestamp).getTime()
    );

    return sortedClosures.slice(-6).map((closure, index) => {
      const date = new Date(closure.closure_timestamp);
      return {
        label: `Cierre ${index + 1}`,
        fecha: date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        ingresos: closure.total_revenue,
        gastos: closure.total_expenses,
        ganancias: closure.net_profit
      };
    });
  };

  const formatDateTime = (timestamp: string | null) => {
    if (!timestamp) return 'Inicio';
    const date = new Date(timestamp);
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
  };

  const formatDateTimeShort = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString('es-CO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota'
    });
  };

  const calculateDaysSinceLastClosure = (): number => {
    const lastClosure = getLastClosure();
    if (!lastClosure) return 0;

    const now = new Date();
    const lastClosureDate = new Date(lastClosure.closure_timestamp);
    const diffTime = Math.abs(now.getTime() - lastClosureDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-700 dark:text-gray-300">Cargando datos financieros...</p>
        </div>
      </div>
    );
  }

  const closureData = calculateClosureData();
  const comparisonData = getComparisonData();
  const periodStart = getPeriodStart();
  const daysSinceLastClosure = calculateDaysSinceLastClosure();

  // Paginación
  const reversedClosures = [...closures].reverse();
  const totalPages = Math.ceil(reversedClosures.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedClosures = reversedClosures.slice(startIndex, endIndex);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/facturacion/historial')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Gestión de Finanzas
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
                Cierre de Finanzas
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Finaliza tus cuentas y reinicia el contador desde cero
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Información del Periodo Actual */}
        <Card className="border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <Clock className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">
                  Periodo Actual
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Desde:</span>
                    <Badge variant="outline" className="bg-white dark:bg-blue-900/50">
                      {formatDateTime(periodStart)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">Hasta:</span>
                    <Badge variant="outline" className="bg-white dark:bg-blue-900/50">
                      {formatDateTime(new Date().toISOString())}
                    </Badge>
                  </div>
                  {daysSinceLastClosure > 0 && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-3">
                      <strong>Han pasado {daysSinceLastClosure} días</strong> desde el último cierre
                    </p>
                  )}
                  {!periodStart && (
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-3">
                      <strong>Este es el primer cierre.</strong> Se contabilizarán todos los datos desde el inicio.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumen del Cierre Actual */}
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            Resumen Acumulado
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Ingreso Total */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Ingreso Total
                  </CardTitle>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCOP(closureData.totalRevenue)}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">Facturas pagas</span>
                    <span className="font-medium">{formatCOP(closureData.paidInvoicesRevenue)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">Facturas crédito</span>
                    <span className="font-medium">{formatCOP(closureData.creditInvoicesRevenue)}</span>
                  </div>
                  {closureData.serviceRevenue > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400">Servicio técnico</span>
                      <span className="font-medium">{formatCOP(closureData.serviceRevenue)}</span>
                    </div>
                  )}
                  {closureData.exchangesImpact !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600 dark:text-zinc-400">Impacto cambios</span>
                      <span className={`font-medium ${closureData.exchangesImpact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                        {closureData.exchangesImpact >= 0 ? '+' : ''}{formatCOP(closureData.exchangesImpact)}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Crédito Pendiente */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Crédito Pendiente
                  </CardTitle>
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {formatCOP(closureData.pendingCredit)}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">Abonos recibidos</span>
                    <span className="font-medium text-emerald-600">{formatCOP(closureData.creditPayments)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Costo de Productos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Costo de Productos
                  </CardTitle>
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {formatCOP(closureData.productCosts)}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Costo de productos vendidos
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Gastos */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Gastos del Periodo
                  </CardTitle>
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCOP(closureData.totalExpenses)}
                </div>
              </CardContent>
            </Card>

            {/* Ganancias Netas */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                    Ganancias Netas
                  </CardTitle>
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    {closureData.netProfit >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${
                  closureData.netProfit >= 0
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {formatCOP(closureData.netProfit)}
                </div>
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Ganancia bruta</div>
                    <div className="font-medium">{formatCOP(closureData.grossProfit)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Total facturas</div>
                    <div className="font-medium">{closureData.totalInvoices}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Formulario de Cierre */}
        <Card className="border-emerald-300 dark:border-emerald-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Save className="w-5 h-5" />
              Guardar Cierre y Reiniciar Contador
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-semibold mb-1">⚠️ Importante:</p>
                  <p>Al guardar este cierre, se registrará el timestamp exacto de este momento. Todo lo que ocurra DESPUÉS de este cierre contará para el siguiente periodo.</p>
                </div>
              </div>
            </div>

            <div>
              <Label htmlFor="notes">Notas del Cierre (Opcional)</Label>
              <Textarea
                id="notes"
                placeholder="Agrega observaciones o comentarios sobre este cierre..."
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
                rows={4}
                className="mt-2"
              />
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Button
                onClick={handleSaveClosure}
                disabled={isSaving}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {isSaving ? 'Guardando...' : 'Finalizar Cierre Ahora'}
              </Button>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Este cierre no se podrá modificar después de guardar
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Comparación de Cierres */}
        {comparisonData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Comparación de Cierres Anteriores</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="fecha" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatCOP(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="ingresos" stroke="#10b981" name="Ingresos" />
                  <Line type="monotone" dataKey="gastos" stroke="#ef4444" name="Gastos" />
                  <Line type="monotone" dataKey="ganancias" stroke="#3b82f6" name="Ganancias" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Historial de Cierres */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Cierres Financieros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 text-sm font-medium">Fecha y Hora</th>
                    <th className="text-left py-2 px-3 text-sm font-medium">Periodo</th>
                    <th className="text-right py-2 px-3 text-sm font-medium">Ingresos</th>
                    <th className="text-right py-2 px-3 text-sm font-medium">Gastos</th>
                    <th className="text-right py-2 px-3 text-sm font-medium">Ganancias</th>
                    <th className="text-center py-2 px-3 text-sm font-medium">Facturas</th>
                    <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClosures.map((closure, index) => {
                    const isFirst = index === paginatedClosures.length - 1 && currentPage === totalPages;
                    return (
                      <tr key={closure.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-2 px-3 text-sm">
                          {formatDateTimeShort(closure.closure_timestamp)}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          <div className="space-y-1">
                            <div className="text-xs text-zinc-500">Desde: {formatDateTime(closure.period_start)}</div>
                            <div className="text-xs text-zinc-500">Hasta: {formatDateTimeShort(closure.period_end)}</div>
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-medium text-emerald-600 dark:text-emerald-400">
                          {formatCOP(closure.total_revenue)}
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-medium text-red-600 dark:text-red-400">
                          {formatCOP(closure.total_expenses)}
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-bold text-blue-600 dark:text-blue-400">
                          {formatCOP(closure.net_profit)}
                        </td>
                        <td className="py-2 px-3 text-center text-sm">{closure.total_invoices}</td>
                        <td className="py-2 px-3 text-sm">{closure.closed_by}</td>
                      </tr>
                    );
                  })}
                  {paginatedClosures.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No hay cierres registrados. Este será el primer cierre.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {closures.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                <div className="text-sm text-muted-foreground">
                  Mostrando {startIndex + 1} - {Math.min(endIndex, closures.length)} de {closures.length} cierres
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
