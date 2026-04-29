import { useState, useEffect } from 'react';
import { Package, DollarSign, TrendingDown, AlertCircle, Eye, TrendingUp, BarChart3, ShoppingCart, Sparkles } from 'lucide-react';
import { getAllProducts, getInvoices, getExpenses, type Product, type Invoice, type Expense } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { formatCOP } from '../lib/currency';

interface SalesAnalysisData {
  topSellingProducts: Array<{ name: string; code: string; quantity: number; revenue: number }>;
  topRevenueProducts: Array<{ name: string; code: string; quantity: number; revenue: number }>;
  salesByCategory: Array<{ category: string; quantity: number; revenue: number }>;
  monthlyComparison: Array<{ month: string; sales: number; invoices: number }>;
  totalRevenue: number;
  totalProductsSold: number;
  averageTicket: number;
}

export default function Reports() {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllLowStockDialog, setShowAllLowStockDialog] = useState(false);

  // Estados para análisis de ventas
  const [analyzingSales, setAnalyzingSales] = useState(false);
  const [salesAnalysis, setSalesAnalysis] = useState<SalesAnalysisData | null>(null);
  const [showSalesAnalysis, setShowSalesAnalysis] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsData, invoicesData, expensesData] = await Promise.all([
        getAllProducts(),
        getInvoices(),
        getExpenses(),
      ]);
      setProducts(productsData);
      setInvoices(invoicesData);
      setExpenses(expensesData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Analizar ventas del mes
  const analyzeMonthlySales = async () => {
    setAnalyzingSales(true);
    setShowSalesAnalysis(true);

    const startTime = Date.now();

    try {
      // Obtener facturas del mes actual (incluyendo crédito y regulares)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return (
          invDate.getMonth() === currentMonth &&
          invDate.getFullYear() === currentYear &&
          (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'pending')
        );
      });

      // Analizar productos vendidos
      const productSales: Map<string, { name: string; code: string; quantity: number; revenue: number; category: string }> = new Map();

      monthInvoices.forEach(invoice => {
        invoice.items?.forEach((item: any) => {
          const existing = productSales.get(item.productId);
          const itemRevenue = (item.price || 0) * (item.quantity || 0);

          if (existing) {
            existing.quantity += item.quantity || 0;
            existing.revenue += itemRevenue;
          } else {
            const product = products.find(p => p.id === item.productId);
            productSales.set(item.productId, {
              name: item.productName || item.product_name || 'Desconocido',
              code: item.productCode || product?.code || '-',
              quantity: item.quantity || 0,
              revenue: itemRevenue,
              category: product?.category || 'Sin categoría'
            });
          }
        });
      });

      // Top 10 productos más vendidos por cantidad
      const topSelling = Array.from(productSales.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Top 10 productos que más generaron ingresos
      const topRevenue = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Ventas por categoría
      const categoryMap: Map<string, { quantity: number; revenue: number }> = new Map();
      Array.from(productSales.values()).forEach(product => {
        const existing = categoryMap.get(product.category);
        if (existing) {
          existing.quantity += product.quantity;
          existing.revenue += product.revenue;
        } else {
          categoryMap.set(product.category, {
            quantity: product.quantity,
            revenue: product.revenue
          });
        }
      });

      const salesByCategory = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      // Comparación mensual (últimos 6 meses)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthInvoicesForPeriod = invoices.filter(inv => {
          const invDate = new Date(inv.date);
          return (
            invDate.getMonth() === date.getMonth() &&
            invDate.getFullYear() === date.getFullYear() &&
            (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'pending')
          );
        });

        const monthName = date.toLocaleDateString('es-ES', { month: 'short' });
        monthlyData.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          sales: monthInvoicesForPeriod.reduce((sum, inv) => sum + inv.total, 0),
          invoices: monthInvoicesForPeriod.length
        });
      }

      // Calcular totales
      const totalRevenue = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalProductsSold = Array.from(productSales.values()).reduce((sum, p) => sum + p.quantity, 0);
      const averageTicket = monthInvoices.length > 0 ? totalRevenue / monthInvoices.length : 0;

      const analysis: SalesAnalysisData = {
        topSellingProducts: topSelling,
        topRevenueProducts: topRevenue,
        salesByCategory,
        monthlyComparison: monthlyData,
        totalRevenue,
        totalProductsSold,
        averageTicket
      };

      // Asegurar que la animación dure al menos 5 segundos
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 5000 - elapsed);

      await new Promise(resolve => setTimeout(resolve, remainingTime));

      setSalesAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing sales:', error);
    } finally {
      setAnalyzingSales(false);
    }
  };

  // Productos en stock bajo
  const lowStockProducts = products
    .filter(p => {
      const minStock = p.min_stock || 0;
      return p.stock <= minStock && minStock > 0;
    })
    .sort((a, b) => a.stock - b.stock);

  const top5LowStock = lowStockProducts.slice(0, 5);

  // Ventas del mes (facturas pagadas y parcialmente devueltas)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const monthlyInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    return (
      invDate.getMonth() === currentMonth &&
      invDate.getFullYear() === currentYear &&
      (inv.status === 'paid' || inv.status === 'partially_returned')
    );
  });

  const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const monthlyInvoiceCount = monthlyInvoices.length;

  // Total gastos
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Gastos por categoría
  const expensesByCategory: { [key: string]: number } = {};
  expenses.forEach(expense => {
    const category = expense.category || 'Sin categoría';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
  });

  const expenseCategoryData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Colores para la gráfica
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Reportes</h2>
          <p className="text-muted-foreground mt-1">Resumen y análisis del negocio</p>
        </div>
        <Button
          onClick={analyzeMonthlySales}
          className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          Análisis de Ventas
        </Button>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Productos en Stock Bajo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Productos por debajo del mínimo
            </p>
          </CardContent>
        </Card>

        {/* Ventas del Mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{monthlyInvoiceCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {formatCOP(monthlySales)}
            </p>
          </CardContent>
        </Card>

        {/* Total Gastos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCOP(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Todos los gastos registrados
            </p>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlySales - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCOP(monthlySales - totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ventas - Gastos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos en Stock Bajo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-red-600" />
              Productos en Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No hay productos en stock bajo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {top5LowStock.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Código: {product.code}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-red-600">{product.stock}</p>
                      <p className="text-xs text-muted-foreground">Min: {product.min_stock}</p>
                    </div>
                  </div>
                ))}
                {lowStockProducts.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => setShowAllLowStockDialog(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver todos los productos en stock bajo ({lowStockProducts.length})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gastos por Categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              Gastos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCategoryData.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No hay gastos registrados</p>
              </div>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseCategoryData.map((entry, index) => (
                        <Cell key={`expense-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCOP(value)} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Leyenda con totales */}
                <div className="space-y-2">
                  {expenseCategoryData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                      <span className="text-muted-foreground">{formatCOP(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para ver todos los productos en stock bajo */}
      <Dialog open={showAllLowStockDialog} onOpenChange={setShowAllLowStockDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Todos los Productos en Stock Bajo ({lowStockProducts.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">Código: {product.code}</p>
                  <p className="text-sm text-muted-foreground">Categoría: {product.category}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-red-600">{product.stock}</p>
                  <p className="text-sm text-muted-foreground">Mínimo: {product.min_stock}</p>
                  <p className="text-sm text-muted-foreground">
                    Faltante: {product.min_stock - product.stock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Análisis de Ventas */}
      <Dialog open={showSalesAnalysis} onOpenChange={setShowSalesAnalysis}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className={analyzingSales ? 'sr-only' : ''}>
            <DialogTitle>
              {analyzingSales ? 'Analizando Ventas' : 'Análisis de Ventas del Mes'}
            </DialogTitle>
            <DialogDescription>
              {analyzingSales ? 'Calculando y analizando datos de ventas...' : 'Resumen completo de ventas y análisis de productos'}
            </DialogDescription>
          </DialogHeader>
          {analyzingSales ? (
            // Pantalla de carga animada
            <div className="min-h-[600px] flex items-center justify-center p-12 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950">
              <div className="text-center space-y-8">
                {/* Animación de carga */}
                <div className="relative">
                  {/* Círculo exterior rotando */}
                  <div className="w-32 h-32 mx-auto">
                    <div className="absolute inset-0 border-8 border-blue-200 dark:border-blue-800 rounded-full"></div>
                    <div className="absolute inset-0 border-8 border-transparent border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  </div>

                  {/* Icono central pulsante */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse">
                      <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>

                  {/* Partículas flotantes */}
                  <div className="absolute -top-4 -left-4 w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="absolute -top-4 -right-4 w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="absolute -bottom-4 -left-4 w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  <div className="absolute -bottom-4 -right-4 w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }}></div>
                </div>

                {/* Texto animado */}
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                    Calculando y analizando ventas
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-pink-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Procesando datos de facturas y productos...
                  </p>
                </div>

                {/* Barra de progreso indeterminada */}
                <div className="w-64 mx-auto">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-[shimmer_2s_ease-in-out_infinite]"
                      style={{
                        width: '50%',
                        animation: 'shimmer 2s ease-in-out infinite'
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes shimmer {
                  0%, 100% { transform: translateX(-100%); }
                  50% { transform: translateX(200%); }
                }
              `}</style>
            </div>
          ) : salesAnalysis ? (
            // Contenido del análisis
            <div className="p-6 space-y-6">
              {/* Título visible */}
              <div className="flex items-center gap-2 text-2xl font-bold">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                Análisis de Ventas del Mes
              </div>

              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Ingresos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCOP(salesAnalysis.totalRevenue)}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Del mes actual
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Productos Vendidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {salesAnalysis.totalProductsSold.toLocaleString()}
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Unidades totales
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Ticket Promedio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCOP(salesAnalysis.averageTicket)}
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Por factura
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficas y análisis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Productos más vendidos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-green-600" />
                      Top 10 Más Vendidos (Cantidad)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesAnalysis.topSellingProducts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="code" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Código: {data.code}</p>
                                  <p className="text-sm text-green-600 font-bold mt-1">Vendidos: {data.quantity}</p>
                                  <p className="text-sm text-blue-600">Ingresos: {formatCOP(data.revenue)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="quantity" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Productos que más generaron */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      Top 10 Mayor Ingreso
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesAnalysis.topRevenueProducts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="code" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Código: {data.code}</p>
                                  <p className="text-sm text-blue-600 font-bold mt-1">Ingresos: {formatCOP(data.revenue)}</p>
                                  <p className="text-sm text-green-600">Vendidos: {data.quantity}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Ventas por categoría */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-600" />
                      Ventas por Categoría
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salesAnalysis.salesByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="revenue"
                        >
                          {salesAnalysis.salesByCategory.map((entry, index) => (
                            <Cell key={`category-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCOP(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {salesAnalysis.salesByCategory.slice(0, 5).map((cat, index) => (
                        <div key={cat.category} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span>{cat.category}</span>
                          </div>
                          <span className="font-semibold">{formatCOP(cat.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Tendencia mensual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                      Tendencia (Últimos 6 Meses)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={salesAnalysis.monthlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                                  <p className="font-semibold text-sm">{data.month}</p>
                                  <p className="text-sm text-blue-600 font-bold">Ventas: {formatCOP(data.sales)}</p>
                                  <p className="text-sm text-green-600">Facturas: {data.invoices}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Tablas detalladas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tabla de más vendidos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalle de Más Vendidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left p-2">#</th>
                            <th className="text-left p-2">Producto</th>
                            <th className="text-right p-2">Cant.</th>
                            <th className="text-right p-2">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesAnalysis.topSellingProducts.map((product, index) => (
                            <tr key={`top-selling-${index}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.code}</div>
                              </td>
                              <td className="p-2 text-right font-semibold text-green-600">{product.quantity}</td>
                              <td className="p-2 text-right text-blue-600">{formatCOP(product.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabla de mayor ingreso */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalle de Mayor Ingreso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left p-2">#</th>
                            <th className="text-left p-2">Producto</th>
                            <th className="text-right p-2">Ingresos</th>
                            <th className="text-right p-2">Cant.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesAnalysis.topRevenueProducts.map((product, index) => (
                            <tr key={`top-revenue-${index}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.code}</div>
                              </td>
                              <td className="p-2 text-right font-semibold text-blue-600">{formatCOP(product.revenue)}</td>
                              <td className="p-2 text-right text-green-600">{product.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setShowSalesAnalysis(false)}>
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
