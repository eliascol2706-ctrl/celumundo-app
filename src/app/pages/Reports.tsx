import { useState, useEffect } from 'react';
import { Package, DollarSign, TrendingDown, AlertCircle, Eye, TrendingUp } from 'lucide-react';
import { getAllProducts, getInvoices, getExpenses, type Product, type Invoice, type Expense } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { formatCOP } from '../lib/currency';

export default function Reports() {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllLowStockDialog, setShowAllLowStockDialog] = useState(false);

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
      <div>
        <h2 className="text-3xl font-bold">Reportes</h2>
        <p className="text-muted-foreground mt-1">Resumen y análisis del negocio</p>
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
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
    </div>
  );
}
