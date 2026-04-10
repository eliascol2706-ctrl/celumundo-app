import { useEffect, useState } from 'react';
import { Plus, Search, Pencil, Trash2, DollarSign, Filter, Calendar } from 'lucide-react';
import { getExpenses, addExpense, updateExpense, deleteExpense, type Expense } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';

export function Expenses() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevenir doble clic
  const [dateFilter, setDateFilter] = useState<'all' | 'month' | 'custom'>('all');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: '',
    amount: '',
    paymentMethod: '',
    supplier: '',
    reference: '',
    status: 'pending' as 'pending' | 'paid',
  });

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    const data = await getExpenses();
    setExpenses(data.sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    ));
  };

  // Filtrar gastos por fecha
  const getFilteredByDateExpenses = () => {
    let filtered = expenses;
    
    if (dateFilter === 'month') {
      filtered = expenses.filter(expense => {
        const expenseDate = new Date(expense.date);
        const [year, month] = selectedMonth.split('-');
        return expenseDate.getFullYear() === parseInt(year) && 
               expenseDate.getMonth() + 1 === parseInt(month);
      });
    } else if (dateFilter === 'custom' && dateFrom && dateTo) {
      filtered = expenses.filter(expense => {
        const expenseDate = new Date(expense.date).toISOString().split('T')[0];
        return expenseDate >= dateFrom && expenseDate <= dateTo;
      });
    }
    
    return filtered;
  };

  const dateFilteredExpenses = getFilteredByDateExpenses();

  const filteredExpenses = dateFilteredExpenses.filter(expense =>
    expense.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
    expense.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Paginación
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  // Reset page cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, dateFilter, selectedMonth, dateFrom, dateTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir doble clic
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      await addExpense({
        date: formData.date,
        category: formData.category,
        description: formData.description,
        amount: parseFloat(formData.amount),
        payment_method: formData.paymentMethod,
        supplier: formData.supplier,
        reference: formData.reference,
        status: formData.status,
      });

      toast.success('Gasto registrado correctamente');
      setIsDialogOpen(false);
      setFormData({
        date: new Date().toISOString().split('T')[0],
        category: '',
        description: '',
        amount: '',
        paymentMethod: '',
        supplier: '',
        reference: '',
        status: 'pending',
      });
      loadExpenses();
    } catch (error) {
      console.error('Error al registrar gasto:', error);
      toast.error('Error al registrar el gasto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, description: string) => {
    if (confirm(`¿Estás seguro de eliminar el gasto "${description}"?`)) {
      await deleteExpense(id);
      toast.success('Gasto eliminado');
      loadExpenses();
    }
  };

  const handleStatusChange = async (id: string, status: Expense['status']) => {
    await updateExpense(id, { status });
    toast.success('Estado actualizado');
    loadExpenses();
  };

  // Calcular estadísticas
  const totalExpenses = dateFilteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const paidExpenses = dateFilteredExpenses.filter(exp => exp.status === 'paid').reduce((sum, exp) => sum + exp.amount, 0);
  const pendingExpenses = dateFilteredExpenses.filter(exp => exp.status === 'pending').reduce((sum, exp) => sum + exp.amount, 0);

  // Gastos por categoría
  const expensesByCategory: { [key: string]: number } = {};
  dateFilteredExpenses.forEach(expense => {
    expensesByCategory[expense.category] = (expensesByCategory[expense.category] || 0) + expense.amount;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gastos</h2>
          <p className="text-muted-foreground mt-1">Control y gestión de gastos</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Gasto
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Total Gastos
            </CardTitle>
            <DollarSign className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCOP(totalExpenses)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Todos los gastos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Gastos Pagados
            </CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCOP(paidExpenses)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Completados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Gastos Pendientes
            </CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {formatCOP(pendingExpenses)}
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Por pagar</p>
          </CardContent>
        </Card>
      </div>

      {/* Gastos por categoría */}
      <Card>
        <CardHeader>
          <CardTitle>Gastos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(expensesByCategory).map(([category, amount]) => (
              <div key={category} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-600 dark:text-gray-400">{category}</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {formatCOP(amount)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Filtros de Fecha */}
      <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-green-600 dark:text-green-400" />
            Filtrar por Fecha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Tipo de filtro */}
            <div className="space-y-2">
              <Label>Tipo de Filtro</Label>
              <Select value={dateFilter} onValueChange={(value: any) => setDateFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los tiempos</SelectItem>
                  <SelectItem value="month">Por Mes</SelectItem>
                  <SelectItem value="custom">Rango Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Selector de mes */}
            {dateFilter === 'month' && (
              <div className="space-y-2">
                <Label>Seleccionar Mes</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                />
              </div>
            )}

            {/* Rango personalizado */}
            {dateFilter === 'custom' && (
              <>
                <div className="space-y-2">
                  <Label>Desde</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Hasta</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="border-green-300 dark:border-green-700 focus:border-green-500 dark:focus:border-green-400"
                  />
                </div>
              </>
            )}
          </div>

          {/* Información del filtro activo */}
          <div className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-900 p-3 rounded-lg border border-green-200 dark:border-green-800">
            {dateFilter === 'all' && (
              <span>📊 Mostrando <strong className="text-gray-900 dark:text-gray-100">todos los gastos</strong> sin límite de fecha</span>
            )}
            {dateFilter === 'month' && (
              <span>📅 Mostrando gastos del mes: <strong className="text-gray-900 dark:text-gray-100">{new Date(selectedMonth + '-01').toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</strong></span>
            )}
            {dateFilter === 'custom' && dateFrom && dateTo && (
              <span>📅 Mostrando gastos desde <strong className="text-gray-900 dark:text-gray-100">{new Date(dateFrom).toLocaleDateString('es-ES')}</strong> hasta <strong className="text-gray-900 dark:text-gray-100">{new Date(dateTo).toLocaleDateString('es-ES')}</strong></span>
            )}
            {dateFilter === 'custom' && (!dateFrom || !dateTo) && (
              <span className="text-yellow-600 dark:text-yellow-400">⚠️ Selecciona ambas fechas para aplicar el filtro personalizado</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Buscador */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Buscar gastos por descripción, categoría, proveedor o referencia..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lista de gastos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gastos ({filteredExpenses.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Fecha</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Categoría</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Descripción</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Proveedor</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Monto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Método de Pago</th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Estado</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedExpenses.map((expense) => (
                  <tr key={expense.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(expense.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                        {expense.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{expense.description}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Ref: {expense.reference}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {expense.supplier}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-red-600 dark:text-red-400">
                      {formatCOP(expense.amount)}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {expense.payment_method}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Select
                        value={expense.status}
                        onValueChange={(value) => handleStatusChange(expense.id, value as Expense['status'])}
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">
                            <span className="text-yellow-700 dark:text-yellow-400">Pendiente</span>
                          </SelectItem>
                          <SelectItem value="paid">
                            <span className="text-green-700 dark:text-green-400">Pagado</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(expense.id, expense.description)}
                      >
                        <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {paginatedExpenses.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No se encontraron gastos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredExpenses.length)} de {filteredExpenses.length} gastos
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
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="min-w-[40px]"
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2 text-gray-500">...</span>;
                    }
                    return null;
                  })}
                </div>
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

      {/* Dialog para crear gasto */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Gasto</DialogTitle>
            <DialogDescription>
              Ingresa los detalles del gasto empresarial
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="date">Fecha</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alquiler">Alquiler</SelectItem>
                    <SelectItem value="Servicios">Servicios</SelectItem>
                    <SelectItem value="Suministros">Suministros</SelectItem>
                    <SelectItem value="Salarios">Salarios</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Transporte">Transporte</SelectItem>
                    <SelectItem value="Mantenimiento">Mantenimiento</SelectItem>
                    <SelectItem value="Otros">Otros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe el gasto..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">Monto</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Método de Pago</Label>
                <Select 
                  value={formData.paymentMethod} 
                  onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Efectivo">Efectivo</SelectItem>
                    <SelectItem value="Tarjeta de crédito">Tarjeta de crédito</SelectItem>
                    <SelectItem value="Tarjeta de débito">Tarjeta de débito</SelectItem>
                    <SelectItem value="Transferencia bancaria">Transferencia bancaria</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplier">Proveedor</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Nombre del proveedor"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="reference">Referencia</Label>
                <Input
                  id="reference"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  placeholder="Ej: FAC-001, Recibo #123"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Estado</Label>
                <Select 
                  value={formData.status} 
                  onValueChange={(value) => setFormData({ ...formData, status: value as 'pending' | 'paid' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="paid">Pagado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Registrando...' : 'Registrar Gasto'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}