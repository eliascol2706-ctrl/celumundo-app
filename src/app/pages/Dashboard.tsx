import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { 
  Package, 
  ShoppingCart, 
  TrendingUp, 
  AlertTriangle,
  Activity,
  DollarSign,
  RotateCcw,
  CreditCard,
  Users,
  AlertCircle,
  FileText,
  Receipt
} from 'lucide-react';
import { getProducts, getInvoices, getAllProducts, getAllInvoices, getMovements, getExpenses, getReturns, getReturnsStats, getExchanges, getCustomers, calculateNetRevenue, getCurrentCompany, getCurrentUser } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCOP } from '../lib/currency';
import { MissingTableAlert } from '../components/MissingTableAlert';

export function Dashboard() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // Redirigir vendedor a facturación
  useEffect(() => {
    if (currentUser?.role === 'seller') {
      navigate('/facturacion', { replace: true });
    }
  }, [currentUser, navigate]);

  const [stats, setStats] = useState({
    totalProducts: 0,
    totalInvoices: 0,
    totalRevenue: 0,
    lowStockProducts: 0,
    recentMovements: 0,
    totalExpenses: 0,
    totalReturns: 0,
    totalReturnAmount: 0,
    netRevenue: 0,
    returnRate: 0,
    totalCreditBalance: 0, // NUEVO: Saldo por cobrar
    totalCustomers: 0, // NUEVO: Total de clientes
    pendingCreditInvoices: 0, // NUEVO: Facturas a crédito pendientes
  });

  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<any[]>([]);
  const [returnsTableMissing, setReturnsTableMissing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // Usar getAllProducts() y getAllInvoices() para obtener TODOS los datos sin límite de 1000
        const products = await getAllProducts();
        const invoices = await getAllInvoices();
        const movements = await getMovements();
        const expenses = await getExpenses();

        // Intentar cargar devoluciones
        let returns: any[] = [];
        let returnsStats = { totalReturns: 0, totalReturnAmount: 0, returnRate: 0, fullReturns: 0, partialReturns: 0 };
        try {
          returns = await getReturns();
          returnsStats = await getReturnsStats();
          setReturnsTableMissing(false);
        } catch (error) {
          if (error instanceof Error && error.message === 'TABLE_NOT_EXISTS') {
            setReturnsTableMissing(true);
            console.warn('⚠️ Tabla "returns" no encontrada - Mostrando alerta al usuario');
          }
        }

        // Cargar cambios (exchanges)
        const exchanges = await getExchanges();

        const customers = await getCustomers();

        const lowStock = products.filter(p => p.stock <= p.min_stock);

        // Calcular ingresos netos (considerando devoluciones y cambios)
        const netRevenue = calculateNetRevenue(invoices, returns, exchanges);
        
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
        
        // Movimientos de los últimos 7 días
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentMovs = movements.filter(m => new Date(m.date) > sevenDaysAgo);

        // Calcular saldo por cobrar y facturas a crédito pendientes
        const totalCreditBalance = invoices
          .filter(i => i.is_credit && i.status === 'pending')
          .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
        const pendingCreditInvoices = invoices
          .filter(i => i.is_credit && i.status === 'pending')
          .length;

        // Calcular impacto de cambios para totalRevenue
        const exchangesImpact = exchanges.reduce((sum, exchange) => {
          if (exchange.price_difference > 0) {
            return sum + exchange.price_difference;
          } else if (exchange.price_difference < 0) {
            return sum + exchange.price_difference;
          }
          return sum;
        }, 0);

        const invoicesTotalRevenue = invoices.filter(i => i.status === 'paid' || i.status === 'partial_return').reduce((sum, inv) => sum + inv.total, 0);

        setStats({
          totalProducts: products.length,
          totalInvoices: invoices.length,
          totalRevenue: invoicesTotalRevenue + exchangesImpact,
          lowStockProducts: lowStock.length,
          recentMovements: recentMovs.length,
          totalExpenses,
          totalReturns: returnsStats.totalReturns,
          totalReturnAmount: returnsStats.totalReturnAmount,
          netRevenue,
          returnRate: returnsStats.returnRate,
          totalCreditBalance, // NUEVO: Saldo por cobrar
          totalCustomers: customers.length, // NUEVO: Total de clientes
          pendingCreditInvoices, // NUEVO: Facturas a crédito pendientes
        });

        setLowStockItems(lowStock.slice(0, 5));

        // Ordenar facturas por fecha (más recientes primero) y tomar las 5 primeras
        const sortedInvoices = [...invoices].sort((a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setRecentInvoices(sortedInvoices.slice(0, 5));
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h2 className="text-3xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Resumen general del sistema</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin h-12 w-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando datos del dashboard...</p>
            <p className="text-xs text-muted-foreground mt-1">Esto puede tardar unos segundos con muchos productos</p>
          </div>
        </div>
      ) : (
        <>
          {/* Tarjetas de estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Productos
            </CardTitle>
            <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalProducts}</div>
            <Link to="/productos" className="text-xs text-green-600 dark:text-green-400 hover:underline mt-1 inline-block">
              Ver inventario →
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Facturas Emitidas
            </CardTitle>
            <FileText className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalInvoices}</div>
            <Link to="/facturacion" className="text-xs text-green-600 dark:text-green-400 hover:underline mt-1 inline-block">
              Ver facturas →
            </Link>
          </CardContent>
        </Card>

        <Card className="hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock Bajo
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats.lowStockProducts}</div>
            <p className="text-xs text-muted-foreground mt-1">Productos requieren atención</p>
          </CardContent>
        </Card>
      </div>

      {/* Tarjetas adicionales de finanzas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-300">Ingresos Netos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
              {formatCOP(stats.totalRevenue)}
            </div>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">Facturas pagadas</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Devoluciones
            </CardTitle>
            <RotateCcw className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {formatCOP(stats.totalReturnAmount)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-red-600 dark:text-red-400">{stats.totalReturns} devoluciones</p>
              <Link to="/devoluciones" className="text-xs text-red-600 dark:text-red-400 hover:underline">
                Ver →
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Gastos
            </CardTitle>
            <Receipt className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {formatCOP(stats.totalExpenses)}
            </div>
            <Link to="/gastos" className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
              Ver gastos →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Dos columnas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos con stock bajo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              Productos con Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No hay productos con stock bajo</p>
            ) : (
              <div className="space-y-3">
                {lowStockItems.map((product) => (
                  <div 
                    key={product.id} 
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{product.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-red-600 dark:text-red-400">{product.stock} uds</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Mín: {product.min_stock}</p>
                    </div>
                  </div>
                ))}
                {lowStockItems.length > 0 && (
                  <Link 
                    to="/productos" 
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline block mt-2"
                  >
                    Ver todos los productos →
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Facturas recientes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
              Facturas Recientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No hay facturas registradas</p>
            ) : (
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div 
                    key={invoice.id} 
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{invoice.number}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{invoice.customer_name || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-gray-100">
                        {formatCOP(invoice.total)}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        invoice.status === 'paid'
                          ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                          : (invoice.status === 'pending' || invoice.status === 'pending_confirmation')
                          ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300'
                          : invoice.status === 'partial_return'
                          ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>
                        {invoice.status === 'paid' ? 'Pagada' : (invoice.status === 'pending' || invoice.status === 'pending_confirmation') ? 'Pendiente' : invoice.status === 'partial_return' ? 'Devolución Parcial' : 'Cancelada'}
                      </span>
                    </div>
                  </div>
                ))}
                <Link 
                  to="/facturacion" 
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline block mt-2"
                >
                  Ver todas las facturas →
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Movimientos recientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Actividad Reciente
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-8 py-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <TrendingUp className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.recentMovements}</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Movimientos últimos 7 días</p>
            </div>
            <div className="h-16 w-px bg-gray-200 dark:bg-gray-700" />
            <div className="text-center">
              <Link 
                to="/movimientos"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                Ver todos los movimientos →
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas adicionales de clientes y crédito */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Total Clientes
            </CardTitle>
            <Users className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
              {stats.totalCustomers}
            </div>
            <Link to="/clientes" className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 inline-block">
              Ver clientes →
            </Link>
          </CardContent>
        </Card>

        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-300">
              Saldo por Cobrar
            </CardTitle>
            <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">
              {formatCOP(stats.totalCreditBalance)}
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-red-600 dark:text-red-400">{stats.pendingCreditInvoices} facturas pendientes</p>
              <Link to="/facturacion" className="text-xs text-red-600 dark:text-red-400 hover:underline">
                Ver →
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerta si la tabla de devoluciones está ausente */}
      {returnsTableMissing && (
        <MissingTableAlert tableName="returns" />
      )}
        </>
      )}
    </div>
  );
}
