import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, X, Search, RotateCcw } from 'lucide-react';
import { getInvoices, getAllProducts, getDailyClosures, getMonthlyClosures, getExpenses, getReturns, calculateNetRevenue, getColombiaDate, getColombiaDateTime, extractColombiaDate, type Invoice, type Return } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { formatCOP } from '../lib/currency';
import { ReturnsReportCard } from '../components/ReturnsReportCard';

type ReportSection = 'general' | 'monthly' | 'daily' | 'closures';

export function Reports() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<ReportSection>('general');
  const [monthlyInvoiceSearch, setMonthlyInvoiceSearch] = useState('');
  const [monthlyInvoiceFilter, setMonthlyInvoiceFilter] = useState<'all' | 'regular' | 'wholesale'>('all');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [dailyClosures, setDailyClosures] = useState<any[]>([]);
  const [monthlyClosures, setMonthlyClosures] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [invoicesData, productsData, dailyClosuresData, monthlyClosuresData, expensesData, returnsData] = await Promise.all([
      getInvoices(),
      getAllProducts(),
      getDailyClosures(),
      getMonthlyClosures(),
      getExpenses(),
      getReturns(),
    ]);
    setInvoices(invoicesData);
    setProducts(productsData);
    setDailyClosures(dailyClosuresData);
    setMonthlyClosures(monthlyClosuresData);
    setExpenses(expensesData);
    setReturns(returnsData);
  };

  // Calcular datos del reporte general
  const calculateGeneralReport = () => {
    const totalRevenue = invoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    // Calcular gastos totales
    const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const totalExpensesPaid = expenses.filter(exp => exp.status === 'paid').reduce((sum, exp) => sum + exp.amount, 0);
    
    // Gastos por categoría
    const expensesByCategory: { [key: string]: number } = {};
    expenses.forEach(expense => {
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
    });

    const expenseCategoryData = Object.entries(expensesByCategory).map(([category, amount], index) => ({
      id: `${category}-${index}`,
      category,
      gastos: amount,
    }));

    const categorySales: { [key: string]: number } = {};
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};

    invoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          categorySales[product.category] = (categorySales[product.category] || 0) + item.total;
          
          if (!productSales[item.productId]) {
            productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += item.total;
        }
      });
    });

    const categoryData = Object.entries(categorySales).map(([category, amount], index) => ({
      id: `${category}-${index}`,
      category,
      ventas: amount,
    }));

    // Tendencias mensuales (últimos 6 meses) - usando zona horaria de Colombia
    const monthlyTrends = [];
    const colombiaTime = getColombiaDateTime();
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(colombiaTime);
      date.setMonth(date.getMonth() - i);
      const month = date.getMonth();
      const year = date.getFullYear();
      
      const monthInvoices = invoices.filter(inv => {
        const invDate = extractColombiaDate(inv.date);
        if (!invDate) return false;
        const invDateObj = new Date(invDate);
        return invDateObj.getMonth() === month && 
               invDateObj.getFullYear() === year && 
               inv.status === 'paid';
      });

      const revenue = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);

      monthlyTrends.push({
        id: `${year}-${month}`,
        name: date.toLocaleDateString('es-ES', { month: 'short' }),
        ventas: revenue,
      });
    }

    const topProducts = Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalRevenue,
      totalExpenses,
      totalExpensesPaid,
      expenseCategoryData,
      categoryData,
      monthlyTrends,
      topProducts,
    };
  };

  // Calcular datos del reporte mensual
  const calculateMonthlyReport = () => {
    // Usar la fecha de Colombia para obtener mes y año actual
    const colombiaTime = getColombiaDateTime();
    const currentMonth = colombiaTime.getMonth();
    const currentYear = colombiaTime.getFullYear();
    
    const previousMonth = new Date(colombiaTime);
    previousMonth.setMonth(previousMonth.getMonth() - 1);

    // Facturas del mes actual - usando extractColombiaDate para comparar
    const currentMonthInvoices = invoices.filter(inv => {
      const invDate = extractColombiaDate(inv.date);
      if (!invDate) return false;
      const dateObj = new Date(invDate);
      return dateObj.getMonth() === currentMonth && 
             dateObj.getFullYear() === currentYear;
    });

    // Facturas del mes anterior
    const previousMonthInvoices = invoices.filter(inv => {
      const invDate = extractColombiaDate(inv.date);
      if (!invDate) return false;
      const dateObj = new Date(invDate);
      return dateObj.getMonth() === previousMonth.getMonth() && 
             dateObj.getFullYear() === previousMonth.getFullYear();
    });

    // Ingresos totales del mes
    const currentMonthRevenue = currentMonthInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    const previousMonthRevenue = previousMonthInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    // Gastos del mes actual - usando extractColombiaDate
    const currentMonthExpenses = expenses.filter(exp => {
      const expDate = extractColombiaDate(exp.date);
      if (!expDate) return false;
      const dateObj = new Date(expDate);
      return dateObj.getMonth() === currentMonth && 
             dateObj.getFullYear() === currentYear;
    });

    const currentMonthExpensesTotal = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const currentMonthExpensesPaid = currentMonthExpenses
      .filter(exp => exp.status === 'paid')
      .reduce((sum, exp) => sum + exp.amount, 0);

    // Gastos del mes anterior
    const previousMonthExpenses = expenses.filter(exp => {
      const expDate = extractColombiaDate(exp.date);
      if (!expDate) return false;
      const dateObj = new Date(expDate);
      return dateObj.getMonth() === previousMonth.getMonth() && 
             dateObj.getFullYear() === previousMonth.getFullYear();
    });

    const previousMonthExpensesTotal = previousMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Gastos por categoría del mes
    const expensesByCategory: { [key: string]: number } = {};
    currentMonthExpenses.forEach(expense => {
      expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
    });

    const expenseCategoryData = Object.entries(expensesByCategory).map(([category, amount], index) => ({
      id: `${category}-${index}`,
      category,
      gastos: amount,
    }));

    // Producto más vendido del mes
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};
    
    currentMonthInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        if (!productSales[item.productId]) {
          productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
        }
        productSales[item.productId].quantity += item.quantity;
        productSales[item.productId].revenue += item.total;
      });
    });

    const topProduct = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)[0] || { name: 'N/A', quantity: 0, revenue: 0 };

    // Datos comparativos de ventas
    const comparisonData = [
      {
        id: 'prev-month',
        name: previousMonth.toLocaleDateString('es-ES', { month: 'short' }),
        ventas: previousMonthRevenue,
      },
      {
        id: 'current-month',
        name: new Date().toLocaleDateString('es-ES', { month: 'short' }),
        ventas: currentMonthRevenue,
      },
    ];

    // Datos comparativos de gastos
    const expensesComparisonData = [
      {
        id: 'prev-month-exp',
        name: previousMonth.toLocaleDateString('es-ES', { month: 'short' }),
        gastos: previousMonthExpensesTotal,
      },
      {
        id: 'current-month-exp',
        name: new Date().toLocaleDateString('es-ES', { month: 'short' }),
        gastos: currentMonthExpensesTotal,
      },
    ];

    // Utilidad neta del mes (Ingresos - Gastos)
    const netProfit = currentMonthRevenue - currentMonthExpensesPaid;

    return {
      currentMonthInvoices,
      currentMonthRevenue,
      previousMonthRevenue,
      currentMonthExpensesTotal,
      currentMonthExpensesPaid,
      previousMonthExpensesTotal,
      expenseCategoryData,
      expensesComparisonData,
      netProfit,
      topProduct,
      comparisonData,
      totalInvoices: currentMonthInvoices.length,
    };
  };

  // Calcular datos del reporte diario
  const calculateDailyReport = () => {
    // Usar la fecha de Colombia en lugar de la fecha local del navegador
    const today = getColombiaDate(); // YYYY-MM-DD en zona Colombia
    
    // Comparar usando extractColombiaDate para manejar correctamente las fechas con timestamp
    const todayInvoices = invoices.filter(inv => {
      const invoiceDate = extractColombiaDate(inv.date);
      return invoiceDate === today;
    });
    
    const todayRevenue = todayInvoices
      .filter(inv => inv.status === 'paid')
      .reduce((sum, inv) => sum + inv.total, 0);

    // Ventas por hora (simulado - últimas 24 horas)
    const hourlyData = [];
    for (let i = 0; i < 24; i++) {
      const hour = i.toString().padStart(2, '0');
      hourlyData.push({
        hora: `${hour}:00`,
        ventas: Math.random() * 100000, // Simulado
      });
    }

    return {
      todayInvoices,
      todayRevenue,
      hourlyData,
    };
  };

  const generalReport = calculateGeneralReport();
  const monthlyReport = calculateMonthlyReport();
  const dailyReport = calculateDailyReport();

  // Filtrar facturas mensuales
  const getFilteredMonthlyInvoices = () => {
    let filtered = monthlyReport.currentMonthInvoices;

    // Filtrar por tipo
    if (monthlyInvoiceFilter !== 'all') {
      filtered = filtered.filter(inv => inv.type === monthlyInvoiceFilter);
    }

    // Filtrar por búsqueda
    if (monthlyInvoiceSearch) {
      filtered = filtered.filter(inv =>
        inv.number.toLowerCase().includes(monthlyInvoiceSearch.toLowerCase()) ||
        (inv.customer_name || '').toLowerCase().includes(monthlyInvoiceSearch.toLowerCase()) ||
        (inv.customer_document || '').includes(monthlyInvoiceSearch)
      );
    }

    return filtered;
  };

  const getDailyClosures = () => {
    return dailyClosures;
  };

  const getMonthlyClosures = () => {
    return monthlyClosures;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Reportes</h2>
          <p className="text-muted-foreground mt-1">Análisis y estadísticas del sistema</p>
        </div>
        <Button onClick={() => setDrawerOpen(true)}>
          <BarChart3 className="h-4 w-4 mr-2" />
          Abrir Reportes
        </Button>
      </div>

      {/* Vista inicial */}
      <Card>
        <CardContent className="py-12 text-center">
          <BarChart3 className="h-16 w-16 mx-auto text-green-600 dark:text-green-400 mb-4" />
          <h3 className="text-xl font-medium mb-2">Reportes del Sistema</h3>
          <p className="text-muted-foreground mb-6">
            Haz clic en el botón "Abrir Reportes" para ver los análisis detallados
          </p>
        </CardContent>
      </Card>

      {/* Drawer lateral */}
      {drawerOpen && (
        <>
          {/* Overlay */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setDrawerOpen(false)}
          />
          
          {/* Drawer */}
          <div className="fixed right-0 top-0 bottom-0 w-full md:w-3/4 lg:w-2/3 bg-background shadow-2xl z-50 overflow-y-auto">
            <div className="sticky top-0 bg-background border-b border-border z-10">
              <div className="flex items-center justify-between p-6">
                <h3 className="text-2xl font-bold">Reportes del Sistema</h3>
                <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border px-6">
                <button
                  onClick={() => setActiveSection('general')}
                  className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                    activeSection === 'general'
                      ? 'border-green-600 text-green-600 dark:text-green-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Reporte General
                </button>
                <button
                  onClick={() => setActiveSection('monthly')}
                  className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                    activeSection === 'monthly'
                      ? 'border-green-600 text-green-600 dark:text-green-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Reporte del Mes
                </button>
                <button
                  onClick={() => setActiveSection('daily')}
                  className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                    activeSection === 'daily'
                      ? 'border-green-600 text-green-600 dark:text-green-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Reporte Diario
                </button>
                <button
                  onClick={() => setActiveSection('closures')}
                  className={`px-4 py-3 font-medium transition-colors border-b-2 ${
                    activeSection === 'closures'
                      ? 'border-green-600 text-green-600 dark:text-green-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Cierres
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Reporte General */}
              {activeSection === 'general' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Ingresos Totales</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                          COP {formatCOP(generalReport.totalRevenue)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Todas las facturas pagadas</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Gastos Totales</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                          COP {formatCOP(generalReport.totalExpenses)}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">Todos los gastos registrados</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pagados: COP {formatCOP(generalReport.totalExpensesPaid)}
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Ventas por Categoría</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={generalReport.categoryData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                          <Legend />
                          <Bar dataKey="ventas" fill="#16a34a" name="Ventas" key="bar-ventas" />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Gastos por Categoría</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {generalReport.expenseCategoryData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={generalReport.expenseCategoryData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                            <Legend />
                            <Bar dataKey="gastos" fill="#dc2626" name="Gastos" key="bar-gastos" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No hay gastos registrados</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Tendencias Mensuales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={generalReport.monthlyTrends}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                          <Legend />
                          <Line type="monotone" dataKey="ventas" stroke="#16a34a" strokeWidth={2} name="Ventas" key="line-ventas" />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Top 5 Productos Más Vendidos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {generalReport.topProducts.map((product, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                            <div>
                              <p className="font-medium">{product.name}</p>
                              <p className="text-sm text-muted-foreground">{product.quantity} unidades vendidas</p>
                            </div>
                            <div className="text-right">
                              <p className="font-bold text-green-600 dark:text-green-400">
                                COP {formatCOP(product.revenue)}
                              </p>
                            </div>
                          </div>
                        ))}
                        {generalReport.topProducts.length === 0 && (
                          <p className="text-center text-muted-foreground py-4">No hay datos disponibles</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sección de Devoluciones */}
                  <ReturnsReportCard returns={returns} invoices={invoices} period="all" />
                </>
              )}

              {/* Reporte del Mes */}
              {activeSection === 'monthly' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Producto Más Vendido
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold">{monthlyReport.topProduct.name}</p>
                        <p className="text-sm text-muted-foreground">{monthlyReport.topProduct.quantity} unidades</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Ingresos del Mes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold text-green-600 dark:text-green-400">
                          COP {formatCOP(monthlyReport.currentMonthRevenue)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Total de Facturas
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold">{monthlyReport.totalInvoices}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tarjetas de Gastos del Mes */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Gastos del Mes
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-bold text-red-600 dark:text-red-400">
                          COP {formatCOP(monthlyReport.currentMonthExpensesTotal)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Pagados: COP {formatCOP(monthlyReport.currentMonthExpensesPaid)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Utilidad Neta
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className={`text-xl font-bold ${monthlyReport.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          COP {formatCOP(monthlyReport.netProfit)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ingresos - Gastos Pagados
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gastos por Categoría del Mes */}
                  {monthlyReport.expenseCategoryData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle>Gastos por Categoría del Mes</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <BarChart data={monthlyReport.expenseCategoryData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                            <Legend />
                            <Bar dataKey="gastos" fill="#dc2626" name="Gastos" key="bar-monthly-expenses" />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  )}

                  <Card>
                    <CardHeader>
                      <CardTitle>Comparación Mensual de Ventas</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyReport.comparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                          <Legend />
                          <Bar dataKey="ventas" fill="#16a34a" name="Ventas" key="bar-comparison" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          {monthlyReport.currentMonthRevenue > monthlyReport.previousMonthRevenue ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ↑ Incremento de COP {formatCOP(monthlyReport.currentMonthRevenue - monthlyReport.previousMonthRevenue)} respecto al mes anterior
                            </span>
                          ) : monthlyReport.currentMonthRevenue < monthlyReport.previousMonthRevenue ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              ↓ Disminución de COP {formatCOP(monthlyReport.previousMonthRevenue - monthlyReport.currentMonthRevenue)} respecto al mes anterior
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">
                              Sin cambios respecto al mes anterior
                            </span>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Comparación Mensual de Gastos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={monthlyReport.expensesComparisonData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                          <Legend />
                          <Bar dataKey="gastos" fill="#dc2626" name="Gastos" key="bar-expenses" />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-sm">
                          {monthlyReport.currentMonthExpensesTotal > monthlyReport.previousMonthExpensesTotal ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ↑ Incremento de COP {formatCOP(monthlyReport.currentMonthExpensesTotal - monthlyReport.previousMonthExpensesTotal)} respecto al mes anterior
                            </span>
                          ) : monthlyReport.currentMonthExpensesTotal < monthlyReport.previousMonthExpensesTotal ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              ↓ Disminución de COP {formatCOP(monthlyReport.previousMonthExpensesTotal - monthlyReport.currentMonthExpensesTotal)} respecto al mes anterior
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-medium">
                              Sin cambios respecto al mes anterior
                            </span>
                          )}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CRUD de facturas del mes */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Facturas del Mes</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {/* Filtros */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Buscar factura..."
                              value={monthlyInvoiceSearch}
                              onChange={(e) => setMonthlyInvoiceSearch(e.target.value)}
                              className="pl-10"
                            />
                          </div>
                          <Select value={monthlyInvoiceFilter} onValueChange={(value: any) => setMonthlyInvoiceFilter(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Todas las facturas</SelectItem>
                              <SelectItem value="regular">Solo Facturas Regulares</SelectItem>
                              <SelectItem value="wholesale">Solo Facturas Al Mayor</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Tabla */}
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-border">
                                <th className="text-left py-2 px-3 text-sm font-medium">Número</th>
                                <th className="text-left py-2 px-3 text-sm font-medium">Tipo</th>
                                <th className="text-left py-2 px-3 text-sm font-medium">Fecha</th>
                                <th className="text-left py-2 px-3 text-sm font-medium">Cliente</th>
                                <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                                <th className="text-center py-2 px-3 text-sm font-medium">Estado</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getFilteredMonthlyInvoices().map((invoice) => (
                                <tr key={invoice.id} className="border-b border-border hover:bg-muted/50">
                                  <td className="py-2 px-3 text-sm font-medium">{invoice.number}</td>
                                  <td className="py-2 px-3">
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      invoice.type === 'regular' 
                                        ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                                        : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                                    }`}>
                                      {invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 text-sm">
                                    {new Date(invoice.date).toLocaleDateString('es-ES')}
                                  </td>
                                  <td className="py-2 px-3 text-sm">{invoice.customer_name || '-'}</td>
                                  <td className="py-2 px-3 text-right text-sm font-medium text-green-600 dark:text-green-400">
                                    COP {formatCOP(invoice.total)}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className={`px-2 py-1 text-xs rounded-full ${
                                      invoice.status === 'paid'
                                        ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                                        : invoice.status === 'pending'
                                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                                        : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                                    }`}>
                                      {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                              {getFilteredMonthlyInvoices().length === 0 && (
                                <tr>
                                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                    No se encontraron facturas
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Sección de Devoluciones Mensuales */}
                  <ReturnsReportCard returns={returns} invoices={invoices} period="month" />
                </>
              )}

              {/* Reporte Diario */}
              {activeSection === 'daily' && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Ingresos del Día
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                          COP {formatCOP(dailyReport.todayRevenue)}
                        </p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                          Facturas del Día
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-3xl font-bold">{dailyReport.todayInvoices.length}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle>Facturas de Hoy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {dailyReport.todayInvoices.length > 0 ? (
                        <div className="space-y-2">
                          {dailyReport.todayInvoices.map((invoice) => (
                            <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                              <div>
                                <p className="font-medium">{invoice.number}</p>
                                <p className="text-sm text-muted-foreground">
                                  {invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
                                  {invoice.customer_name && ` - ${invoice.customer_name}`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-green-600 dark:text-green-400">
                                  COP {formatCOP(invoice.total)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {invoice.status === 'paid' ? 'Pagada' : invoice.status === 'pending' ? 'Pendiente' : 'Cancelada'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-center text-muted-foreground py-8">No hay facturas hoy</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Sección de Devoluciones Diarias */}
                  <ReturnsReportCard returns={returns} invoices={invoices} period="day" />
                </>
              )}

              {/* Reporte de Cierres */}
              {activeSection === 'closures' && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Cierres Diarios</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-sm font-medium">Fecha</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Facturas</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Pendientes</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Pagas</th>
                              <th className="text-right py-2 px-3 text-sm font-medium">Efectivo</th>
                              <th className="text-right py-2 px-3 text-sm font-medium">Transferencias</th>
                              <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                              <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getDailyClosures().map((closure) => (
                              <tr key={closure.id} className="border-b border-border hover:bg-muted/50">
                                <td className="py-2 px-3 text-sm">
                                  {new Date(closure.date).toLocaleDateString('es-ES')}
                                </td>
                                <td className="py-2 px-3 text-center text-sm">{closure.total_invoices}</td>
                                <td className="py-2 px-3 text-center text-sm">{closure.pending_invoices}</td>
                                <td className="py-2 px-3 text-center text-sm">{closure.paid_invoices}</td>
                                <td className="py-2 px-3 text-right text-sm">COP {formatCOP(closure.total_cash)}</td>
                                <td className="py-2 px-3 text-right text-sm">COP {formatCOP(closure.total_transfer)}</td>
                                <td className="py-2 px-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                                  COP {formatCOP(closure.total)}
                                </td>
                                <td className="py-2 px-3 text-sm">{closure.closed_by}</td>
                              </tr>
                            ))}
                            {getDailyClosures().length === 0 && (
                              <tr>
                                <td colSpan={8} className="py-8 text-center text-muted-foreground">
                                  No hay cierres diarios registrados
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Cierres Mensuales</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-2 px-3 text-sm font-medium">Mes</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Año</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Total Facturas</th>
                              <th className="text-center py-2 px-3 text-sm font-medium">Cierres Diarios</th>
                              <th className="text-right py-2 px-3 text-sm font-medium">Total Generado</th>
                              <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                            </tr>
                          </thead>
                          <tbody>
                            {getMonthlyClosures().map((closure) => (
                              <tr key={closure.id} className="border-b border-border hover:bg-muted/50">
                                <td className="py-2 px-3 text-sm">
                                  {new Date(closure.month + '-01').toLocaleDateString('es-ES', { month: 'long' })}
                                </td>
                                <td className="py-2 px-3 text-center text-sm">{closure.year}</td>
                                <td className="py-2 px-3 text-center text-sm">{closure.total_invoices}</td>
                                <td className="py-2 px-3 text-center text-sm">{closure.daily_closures_count}</td>
                                <td className="py-2 px-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                                  COP {formatCOP(closure.total_revenue)}
                                </td>
                                <td className="py-2 px-3 text-sm">{closure.closed_by}</td>
                              </tr>
                            ))}
                            {getMonthlyClosures().length === 0 && (
                              <tr>
                                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                                  No hay cierres mensuales registrados
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}