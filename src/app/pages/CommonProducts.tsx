import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Package,
  Calendar,
  DollarSign,
  FileText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  User,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { supabase, getCurrentCompany } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';

interface CommonProduct {
  id: string;
  company: 'celumundo' | 'repuestos';
  invoice_id: string;
  invoice_number: string;
  product_name: string;
  price: number;
  quantity: number;
  total: number;
  created_by: string;
  created_at: string;
}

export function CommonProducts() {
  const navigate = useNavigate();
  const [commonProducts, setCommonProducts] = useState<CommonProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'currentMonth' | 'previousMonth' | 'all'>('today');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  useEffect(() => {
    loadCommonProducts();
  }, []);

  const loadCommonProducts = async () => {
    setLoading(true);
    try {
      const company = getCurrentCompany();
      const { data, error } = await supabase
        .from('common_products')
        .select('*')
        .eq('company', company)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCommonProducts(data || []);
    } catch (error) {
      console.error('Error loading common products:', error);
      toast.error('Error al cargar productos comunes');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredProducts = () => {
    let filtered = [...commonProducts];

    // Filtro de búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (item) =>
          item.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.created_by.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de periodo
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const previousMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const previousMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    if (periodFilter === 'today') {
      filtered = filtered.filter((item) => item.created_at.startsWith(todayStr));
    } else if (periodFilter === 'yesterday') {
      filtered = filtered.filter((item) => item.created_at.startsWith(yesterdayStr));
    } else if (periodFilter === 'currentMonth') {
      filtered = filtered.filter((item) => {
        const date = new Date(item.created_at);
        return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
      });
    } else if (periodFilter === 'previousMonth') {
      filtered = filtered.filter((item) => {
        const date = new Date(item.created_at);
        return date.getMonth() === previousMonth && date.getFullYear() === previousMonthYear;
      });
    }

    return filtered;
  };

  const getPaginatedProducts = () => {
    const filtered = getFilteredProducts();
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filtered.slice(startIndex, endIndex);
  };

  const getTotalPages = () => {
    return Math.ceil(getFilteredProducts().length / itemsPerPage);
  };

  const getStats = () => {
    const filtered = getFilteredProducts();
    const totalSales = filtered.reduce((sum, item) => sum + item.total, 0);
    const totalQuantity = filtered.reduce((sum, item) => sum + item.quantity, 0);
    const totalItems = filtered.length;

    return { totalSales, totalQuantity, totalItems };
  };

  const stats = getStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-3">
            <Package className="w-8 h-8 text-green-600" />
            Productos Comunes
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
            Registro de productos comunes vendidos en facturas
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate(-1)}
          className="w-full sm:w-auto"
        >
          <ChevronLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Total Ventas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCOP(stats.totalSales)}
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Unidades Vendidas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">
              {stats.totalQuantity}
            </p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 dark:border-purple-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Total Registros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-purple-600">
              {stats.totalItems}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <Card>
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Búsqueda */}
            <div className="space-y-2">
              <Label>Buscar</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Producto, factura o usuario..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Periodo */}
            <div className="space-y-2">
              <Label>Periodo</Label>
              <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hoy</SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="currentMonth">Mes Actual</SelectItem>
                  <SelectItem value="previousMonth">Mes Anterior</SelectItem>
                  <SelectItem value="all">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Productos Comunes */}
      <Card>
        <CardHeader className="border-b border-zinc-200 dark:border-zinc-800">
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Registro de Productos Comunes
            <Badge variant="outline" className="ml-2">
              {getFilteredProducts().length} {getFilteredProducts().length === 1 ? 'producto' : 'productos'}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12">
              <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-zinc-500 dark:text-zinc-400">Cargando productos comunes...</p>
            </div>
          ) : getFilteredProducts().length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-500 dark:text-zinc-400">No hay productos comunes registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Producto</th>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Factura</th>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Cantidad</th>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Precio Unit.</th>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Total</th>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Usuario</th>
                    <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {getPaginatedProducts().map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="w-4 h-4 text-green-600" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {item.product_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-blue-600" />
                          <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
                            #{item.invoice_number}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
                          {item.quantity}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatCOP(item.price)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-bold text-green-600">
                          {formatCOP(item.total)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-purple-600" />
                          <span className="text-sm text-zinc-900 dark:text-zinc-100">
                            {item.created_by}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-zinc-400" />
                          <span className="text-xs text-zinc-500 dark:text-zinc-400">
                            {new Date(item.created_at).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Paginación */}
          {!loading && getFilteredProducts().length > 0 && getTotalPages() > 1 && (
            <div className="px-4 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, getFilteredProducts().length)} de {getFilteredProducts().length}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-sm text-zinc-600 dark:text-zinc-400 min-w-[80px] text-center">
                    Página {currentPage} de {getTotalPages()}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(getTotalPages(), prev + 1))}
                    disabled={currentPage === getTotalPages()}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default CommonProducts;
