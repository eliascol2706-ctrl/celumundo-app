import { useState, useEffect } from 'react';
import { Search, Plus, Package, TrendingUp, ArrowRightLeft, DollarSign, ChevronLeft, ChevronRight, Trash2, Edit, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { formatCOP } from '../lib/currency';
import { getExchanges, getAllProducts, getInvoices, addExchange, deleteExchange, finalizeExchange, cancelExchange, getCurrentUser, getExchangesStats, extractColombiaDate, getColombiaDateTime, type Exchange, type Product, type Invoice } from '../lib/supabase';
import { extractIds } from '../lib/unit-ids-utils';
import { toast } from 'sonner';

export default function Exchanges() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [exchangeType, setExchangeType] = useState<'invoice' | 'direct' | 'pending'>('direct');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Estados para el modal de selección de productos
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [selectingFor, setSelectingFor] = useState<'original' | 'new'>('original');
  const [productSearchTerm, setProductSearchTerm] = useState('');

  // Estadísticas
  const [stats, setStats] = useState({
    totalExchanges: 0,
    exchangesByInvoice: 0,
    directExchanges: 0,
    totalPositiveDifference: 0,
    totalNegativeDifference: 0,
  });

  // Formulario - Datos generales
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');
  
  // Producto Original (que se devuelve)
  const [originalProduct, setOriginalProduct] = useState<Product | null>(null);
  const [originalQuantity, setOriginalQuantity] = useState(1);
  const [originalPrice, setOriginalPrice] = useState(0);
  const [originalUnitIds, setOriginalUnitIds] = useState<string[]>([]);
  
  // Producto Nuevo (que se lleva)
  const [newProduct, setNewProduct] = useState<Product | null>(null);
  const [newQuantity, setNewQuantity] = useState(1);
  const [newPrice, setNewPrice] = useState(0);
  const [newUnitIds, setNewUnitIds] = useState<string[]>([]);
  
  // Diferencia de precio
  const [paymentMethod, setPaymentMethod] = useState(''); // Mantener por compatibilidad
  const [paymentCash, setPaymentCash] = useState(0);
  const [paymentTransfer, setPaymentTransfer] = useState(0);
  const [paymentOther, setPaymentOther] = useState(0);
  const [notes, setNotes] = useState('');

  // Modal de finalización de cambio pendiente
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [exchangeToFinalize, setExchangeToFinalize] = useState<Exchange | null>(null);
  const [finalizeNewProduct, setFinalizeNewProduct] = useState<Product | null>(null);
  const [finalizeNewQuantity, setFinalizeNewQuantity] = useState(1);
  const [finalizeNewPrice, setFinalizeNewPrice] = useState(0);
  const [finalizeNewUnitIds, setFinalizeNewUnitIds] = useState<string[]>([]);
  const [finalizePaymentCash, setFinalizePaymentCash] = useState(0);
  const [finalizePaymentTransfer, setFinalizePaymentTransfer] = useState(0);
  const [finalizePaymentOther, setFinalizePaymentOther] = useState(0);

  const itemsPerPage = 10;
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [exchangesData, productsData, invoicesData, statsData] = await Promise.all([
        getExchanges(),
        getAllProducts(),
        getInvoices(),
        getExchangesStats()
      ]);
      setExchanges(exchangesData);
      setProducts(productsData);
      setInvoices(invoicesData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setExchangeType('direct');
    setSelectedInvoice(null);
    setInvoiceSearch('');
    setOriginalProduct(null);
    setOriginalQuantity(1);
    setOriginalPrice(0);
    setOriginalUnitIds([]);
    setNewProduct(null);
    setNewQuantity(1);
    setNewPrice(0);
    setNewUnitIds([]);
    setPaymentMethod('');
    setPaymentCash(0);
    setPaymentTransfer(0);
    setPaymentOther(0);
    setNotes('');
  };

  const handleSelectInvoice = (invoiceNumber: string) => {
    const invoice = invoices.find(inv => inv.number === invoiceNumber);
    if (invoice) {
      setSelectedInvoice(invoice);
      setInvoiceSearch(invoiceNumber);
    }
  };

  const handleSelectOriginalFromInvoice = (productId: string) => {
    if (!selectedInvoice) return;
    
    const invoiceItem = selectedInvoice.items.find(item => item.productId === productId);
    const product = products.find(p => p.id === productId);
    
    if (invoiceItem && product) {
      setOriginalProduct(product);
      setOriginalQuantity(1);
      setOriginalPrice(invoiceItem.price);
      
      // Si el producto usa IDs únicas, obtenerlas del item de la factura
      if (product.use_unit_ids && invoiceItem.unitIds) {
        setOriginalUnitIds(invoiceItem.unitIds.slice(0, 1));
      }
    }
  };

  const handleSelectOriginalProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setOriginalProduct(product);
      setOriginalPrice(product.final_price);
      setOriginalUnitIds([]);
    }
  };

  const handleSelectNewProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      // Si estamos en el modal de finalización
      if (finalizeDialogOpen) {
        setFinalizeNewProduct(product);
        setFinalizeNewPrice(product.final_price);

        if (product.use_unit_ids && product.registered_ids) {
          const ids = extractIds(product.registered_ids);
          setFinalizeNewUnitIds(ids.slice(0, finalizeNewQuantity));
        } else {
          setFinalizeNewUnitIds([]);
        }
      } else {
        // Modal de crear cambio nuevo
        setNewProduct(product);
        setNewPrice(product.final_price);

        if (product.use_unit_ids && product.registered_ids) {
          const ids = extractIds(product.registered_ids);
          setNewUnitIds(ids.slice(0, newQuantity));
        } else {
          setNewUnitIds([]);
        }
      }
    }
  };

  const handleOriginalQuantityChange = (qty: number) => {
    if (!originalProduct) return;
    setOriginalQuantity(qty);

    // Ajustar IDs únicas si aplica
    if (originalProduct.use_unit_ids) {
      if (exchangeType === 'invoice' && selectedInvoice) {
        // Si es de factura, mantener las IDs de la factura hasta la cantidad
        const invoiceItem = selectedInvoice.items.find(item => item.productId === originalProduct.id);
        if (invoiceItem?.unitIds) {
          setOriginalUnitIds(invoiceItem.unitIds.slice(0, qty));
        }
      } else {
        // Para cambios directos y pendientes, limpiar las IDs cuando cambia la cantidad
        setOriginalUnitIds([]);
      }
    }
  };

  const handleNewQuantityChange = (qty: number) => {
    if (!newProduct) return;
    setNewQuantity(qty);

    // Limpiar IDs si la cantidad cambió
    if (newProduct.use_unit_ids) {
      setNewUnitIds([]);
    }
  };

  const calculatePriceDifference = () => {
    const originalTotal = originalPrice * originalQuantity;
    const newTotal = newPrice * newQuantity;
    return newTotal - originalTotal;
  };

  const validateForm = (): string | null => {
    if (!originalProduct) return 'Selecciona el producto original';

    // Para cambios pendientes, no se requiere producto nuevo
    if (exchangeType !== 'pending') {
      if (!newProduct) return 'Selecciona el producto nuevo';
      if (originalProduct.id === newProduct.id) return 'Los productos deben ser diferentes';
      if (newQuantity <= 0) return 'La cantidad nueva debe ser mayor a 0';

      // Validar stock del producto nuevo
      if (newProduct.stock < newQuantity) {
        return `Stock insuficiente de ${newProduct.name}. Disponible: ${newProduct.stock}`;
      }

      // Validar IDs únicas del producto nuevo
      if (newProduct.use_unit_ids) {
        if (!newProduct.registered_ids || newProduct.registered_ids.length < newQuantity) {
          return `No hay suficientes IDs únicas disponibles de ${newProduct.name}`;
        }
        if (newUnitIds.length !== newQuantity) {
          return `Debes seleccionar ${newQuantity} ID(s) única(s) del producto nuevo`;
        }
      }
    }

    if (originalQuantity <= 0) return 'La cantidad original debe ser mayor a 0';

    // Validar IDs únicas del producto original si es cambio directo
    if (exchangeType === 'direct' && originalProduct.use_unit_ids) {
      if (originalUnitIds.length !== originalQuantity) {
        return `Debes especificar ${originalQuantity} ID(s) única(s) del producto original`;
      }
    }

    // Validar método de pago si hay diferencia (solo para cambios no pendientes)
    if (exchangeType !== 'pending') {
      const difference = calculatePriceDifference();
      if (difference !== 0) {
        const totalPayment = paymentCash + paymentTransfer + paymentOther;
        if (Math.abs(totalPayment - Math.abs(difference)) > 0.01) {
          return `El total de pagos debe ser igual a la diferencia: ${formatCOP(Math.abs(difference))}`;
        }
      }
    }

    return null;
  };

  const handleDelete = async (exchangeId: string, exchangeNumber: string) => {
    if (!confirm(`¿Estás seguro de eliminar el cambio ${exchangeNumber}?\n\nEsto revertirá los movimientos de inventario.`)) {
      return;
    }

    setIsLoading(true);
    try {
      const success = await deleteExchange(exchangeId);
      if (success) {
        toast.success('Cambio eliminado exitosamente');
        await loadData();
      } else {
        toast.error('Error al eliminar el cambio');
      }
    } catch (error) {
      console.error('Error deleting exchange:', error);
      toast.error('Error al eliminar el cambio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    if (!originalProduct || !currentUser) return;
    if (exchangeType !== 'pending' && !newProduct) return;

    setIsLoading(true);
    try {
      const originalTotal = originalPrice * originalQuantity;

      if (exchangeType === 'pending') {
        // Para cambios pendientes, solo registrar el producto original
        const exchangeData = {
          date: getColombiaDateTime().toISOString(),
          type: exchangeType,
          status: 'pending' as const,
          invoice_id: undefined,
          invoice_number: undefined,
          customer_name: undefined,
          original_product_id: originalProduct.id,
          original_product_name: originalProduct.name,
          original_quantity: originalQuantity,
          original_price: originalPrice,
          original_total: originalTotal,
          original_unit_ids: originalProduct.use_unit_ids ? originalUnitIds : undefined,
          notes: notes || undefined,
          registered_by: currentUser.username,
        };

        const result = await addExchange(exchangeData);

        if (result) {
          toast.success('Cambio pendiente registrado exitosamente');
          setIsDialogOpen(false);
          loadData();
        } else {
          toast.error('Error al registrar el cambio pendiente');
        }
      } else {
        // Para cambios directos o por factura
        const priceDifference = calculatePriceDifference();
        const newTotal = newPrice * newQuantity;

        const exchangeData = {
          date: getColombiaDateTime().toISOString(),
          type: exchangeType,
          status: 'completed' as const,
          invoice_id: exchangeType === 'invoice' ? selectedInvoice?.id : undefined,
          invoice_number: exchangeType === 'invoice' ? selectedInvoice?.number : undefined,
          customer_name: exchangeType === 'invoice' ? selectedInvoice?.customer_name : undefined,
          original_product_id: originalProduct.id,
          original_product_name: originalProduct.name,
          original_quantity: originalQuantity,
          original_price: originalPrice,
          original_total: originalTotal,
          original_unit_ids: originalProduct.use_unit_ids ? originalUnitIds : undefined,
          new_product_id: newProduct!.id,
          new_product_name: newProduct!.name,
          new_quantity: newQuantity,
          new_price: newPrice,
          new_total: newTotal,
          new_unit_ids: newProduct!.use_unit_ids ? newUnitIds : undefined,
          price_difference: priceDifference,
          payment_method: priceDifference !== 0 ? (
            (paymentCash > 0 ? 1 : 0) + (paymentTransfer > 0 ? 1 : 0) + (paymentOther > 0 ? 1 : 0) > 1
              ? 'Mixto'
              : paymentCash > 0 ? 'Efectivo' : paymentTransfer > 0 ? 'Transferencia' : 'Otro'
          ) : undefined,
          payment_amount: Math.abs(priceDifference),
          payment_cash: paymentCash,
          payment_transfer: paymentTransfer,
          payment_other: paymentOther,
          notes: notes || undefined,
          registered_by: currentUser.username,
        };

        const result = await addExchange(exchangeData);

        if (result) {
          toast.success('Cambio registrado exitosamente');
          setIsDialogOpen(false);
          loadData();
        } else {
          toast.error('Error al registrar el cambio');
        }
      }
    } catch (error) {
      console.error('Error submitting exchange:', error);
      toast.error('Error al procesar el cambio');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar cambios por búsqueda
  const filteredExchanges = exchanges.filter(exchange => {
    const searchLower = searchTerm.toLowerCase();
    return (
      exchange.exchange_number.toLowerCase().includes(searchLower) ||
      exchange.original_product_name.toLowerCase().includes(searchLower) ||
      exchange.new_product_name.toLowerCase().includes(searchLower) ||
      exchange.customer_name?.toLowerCase().includes(searchLower) ||
      exchange.invoice_number?.toLowerCase().includes(searchLower)
    );
  });

  // Paginación
  const totalPages = Math.ceil(filteredExchanges.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExchanges = filteredExchanges.slice(startIndex, startIndex + itemsPerPage);

  const priceDifference = calculatePriceDifference();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Cambios</h2>
          <p className="text-muted-foreground mt-1">Gestión de intercambio de productos</p>
        </div>
        <Button onClick={handleOpenDialog} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Cambio
        </Button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Total Cambios
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalExchanges}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Por Factura
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.exchangesByInvoice}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Diferencias Cobradas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              COP {formatCOP(stats.totalPositiveDifference)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Diferencias Devueltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              COP {formatCOP(stats.totalNegativeDifference)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por número, producto, cliente..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de Cambios */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Cambios</CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedExchanges.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay cambios registrados</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-sm font-medium">Número</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Fecha</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Estado</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Tipo</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto Original</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto Nuevo</th>
                      <th className="text-right py-3 px-3 text-sm font-medium">Diferencia</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Registrado por</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExchanges.map((exchange) => (
                      <tr key={exchange.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-3 text-sm font-medium">{exchange.exchange_number}</td>
                        <td className="py-3 px-3 text-sm">
                          {new Date(exchange.date).toLocaleDateString('es-ES')}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            exchange.status === 'completed'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : exchange.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                              : 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300'
                          }`}>
                            {exchange.status === 'completed' ? 'Completado' : exchange.status === 'pending' ? 'Pendiente' : 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            exchange.type === 'invoice'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : exchange.type === 'pending'
                              ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                              : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                          }`}>
                            {exchange.type === 'invoice' ? 'Por Factura' : exchange.type === 'pending' ? 'En Espera' : 'Directo'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          <div>{exchange.original_product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Cant: {exchange.original_quantity} × COP {formatCOP(exchange.original_price)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {exchange.new_product_name ? (
                            <>
                              <div>{exchange.new_product_name}</div>
                              <div className="text-xs text-muted-foreground">
                                Cant: {exchange.new_quantity} × COP {formatCOP(exchange.new_price)}
                              </div>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Por definir</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right">
                          {exchange.price_difference !== undefined && exchange.price_difference !== null ? (
                            <span className={`text-sm font-medium ${
                              exchange.price_difference > 0
                                ? 'text-green-600 dark:text-green-400'
                                : exchange.price_difference < 0
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-muted-foreground'
                            }`}>
                              {exchange.price_difference > 0 ? '+' : ''}
                              COP {formatCOP(Math.abs(exchange.price_difference))}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm">{exchange.registered_by}</td>
                        <td className="py-3 px-3">
                          <div className="flex items-center justify-center gap-2">
                            {exchange.status === 'pending' ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setExchangeToFinalize(exchange);
                                    setFinalizeNewProduct(null);
                                    setFinalizeNewQuantity(1);
                                    setFinalizeNewPrice(0);
                                    setFinalizeNewUnitIds([]);
                                    setFinalizePaymentCash(0);
                                    setFinalizePaymentTransfer(0);
                                    setFinalizePaymentOther(0);
                                    setFinalizeDialogOpen(true);
                                  }}
                                  disabled={isLoading}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                                  title="Finalizar cambio"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={async () => {
                                    if (confirm(`¿Cancelar el cambio ${exchange.exchange_number}?\n\nSe restaurará el stock del producto original.`)) {
                                      setIsLoading(true);
                                      try {
                                        const success = await cancelExchange(exchange.id);
                                        if (success) {
                                          toast.success('Cambio cancelado exitosamente');
                                          await loadData();
                                        } else {
                                          toast.error('Error al cancelar el cambio');
                                        }
                                      } catch (error) {
                                        console.error('Error canceling exchange:', error);
                                        toast.error('Error al cancelar el cambio');
                                      } finally {
                                        setIsLoading(false);
                                      }
                                    }
                                  }}
                                  disabled={isLoading}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                  title="Cancelar cambio"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            ) : exchange.status === 'completed' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(exchange.id, exchange.exchange_number)}
                                disabled={isLoading}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                title="Eliminar cambio"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground">
                    Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredExchanges.length)} de {filteredExchanges.length} cambios
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm">
                      Página {currentPage} de {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog Nuevo Cambio */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Cambio</DialogTitle>
            <DialogDescription>
              Complete el formulario para registrar un cambio de producto.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Tipo de Cambio */}
            <div className="space-y-2">
              <Label>Tipo de Cambio</Label>
              <Select value={exchangeType} onValueChange={(value: 'invoice' | 'direct' | 'pending') => {
                setExchangeType(value);
                resetForm();
                setExchangeType(value);
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="direct">Cambio Directo</SelectItem>
                  <SelectItem value="invoice">Cambio por Factura</SelectItem>
                  <SelectItem value="pending">En espera de cambio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Buscar Factura (solo si es por factura) */}
            {exchangeType === 'invoice' && (
              <div className="space-y-2">
                <Label>Factura</Label>
                <Select value={selectedInvoice?.number || ''} onValueChange={handleSelectInvoice}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar factura" />
                  </SelectTrigger>
                  <SelectContent>
                    {invoices
                      .filter(inv => inv.status === 'paid' || inv.status === 'partial_return')
                      .slice(0, 50)
                      .map(inv => (
                        <SelectItem key={inv.id} value={inv.number}>
                          {inv.number} - {inv.customer_name || 'Sin nombre'} - COP {formatCOP(inv.total)}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedInvoice && (
                  <p className="text-sm text-muted-foreground">
                    Cliente: {selectedInvoice.customer_name || 'N/A'} | Total: COP {formatCOP(selectedInvoice.total)}
                  </p>
                )}
              </div>
            )}

            <div className={`grid gap-6 ${exchangeType === 'pending' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
              {/* Producto Original */}
              <div className="space-y-4 p-4 border border-border rounded-lg">
                <h3 className="font-semibold text-lg">Producto que Devuelve</h3>
                
                {exchangeType === 'invoice' && selectedInvoice ? (
                  <div className="space-y-2">
                    <Label>Producto Original (de la factura)</Label>
                    <Select value={originalProduct?.id || ''} onValueChange={handleSelectOriginalFromInvoice}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar producto de la factura" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedInvoice.items.map(item => (
                          <SelectItem key={item.productId} value={item.productId}>
                            {item.productName} (Cant: {item.quantity})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Producto Original</Label>
                    {originalProduct ? (
                      <div className="p-3 border border-green-500 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-950/30">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-semibold text-green-900 dark:text-green-100">{originalProduct.name}</p>
                            <p className="text-xs text-green-700 dark:text-green-300">{originalProduct.code}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOriginalProduct(null)}
                            className="text-red-500 hover:text-red-700"
                          >
                            ✕
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Stock:</span>
                            <span className="ml-1 font-medium">{originalProduct.stock}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Precio:</span>
                            <span className="ml-1 font-medium">COP {formatCOP(originalProduct.final_price)}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full h-20 border-dashed border-2 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-500"
                        onClick={() => {
                          setSelectingFor('original');
                          setProductSearchTerm('');
                          setProductSelectorOpen(true);
                        }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-6 w-6 text-muted-foreground" />
                          <span className="text-sm font-medium">SELECCIONAR PRODUCTO</span>
                        </div>
                      </Button>
                    )}
                  </div>
                )}

                {originalProduct && (
                  <>
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={originalQuantity}
                        onChange={(e) => handleOriginalQuantityChange(parseInt(e.target.value) || 1)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Precio Unitario</Label>
                      <Input
                        type="number"
                        min="0"
                        value={originalPrice}
                        onChange={(e) => setOriginalPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {originalProduct.use_unit_ids && (exchangeType === 'direct' || exchangeType === 'pending') && (
                      <div className="space-y-2">
                        <Label>IDs Únicas (Se requieren {originalQuantity} ID(s) de 4 dígitos)</Label>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                          {Array.from({ length: originalQuantity }).map((_, index) => (
                            <div key={index} className="space-y-1">
                              <Label className="text-xs text-muted-foreground text-center block">#{index + 1}</Label>
                              <Input
                                placeholder="0001"
                                maxLength={4}
                                value={originalUnitIds[index] || ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  const newIds = [...originalUnitIds];
                                  newIds[index] = value.padStart(4, '0');
                                  setOriginalUnitIds(newIds.filter(id => id && id !== '0000'));
                                }}
                                className="font-mono text-center text-sm h-9"
                              />
                            </div>
                          ))}
                        </div>
                        {originalUnitIds.length !== originalQuantity && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠️ Debes ingresar exactamente {originalQuantity} ID(s)
                          </p>
                        )}
                      </div>
                    )}

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Total Original:</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        COP {formatCOP(originalPrice * originalQuantity)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Producto Nuevo - Ocultar cuando es pending */}
              {exchangeType !== 'pending' && (
                <div className="space-y-4 p-4 border border-border rounded-lg">
                  <h3 className="font-semibold text-lg">Producto que Lleva</h3>
                
                <div className="space-y-2">
                  <Label>Producto Nuevo</Label>
                  {newProduct ? (
                    <div className="p-3 border border-blue-500 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-blue-900 dark:text-blue-100">{newProduct.name}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">{newProduct.code}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNewProduct(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Stock:</span>
                          <span className="ml-1 font-medium">{newProduct.stock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Precio:</span>
                          <span className="ml-1 font-medium">COP {formatCOP(newProduct.final_price)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 border-dashed border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-500"
                      onClick={() => {
                        setSelectingFor('new');
                        setProductSearchTerm('');
                        setProductSelectorOpen(true);
                      }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm font-medium">SELECCIONAR PRODUCTO</span>
                      </div>
                    </Button>
                  )}
                </div>

                {newProduct && (
                  <>
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        max={newProduct.stock}
                        value={newQuantity}
                        onChange={(e) => handleNewQuantityChange(parseInt(e.target.value) || 1)}
                      />
                      <p className="text-xs text-muted-foreground">Stock disponible: {newProduct.stock}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Precio Unitario</Label>
                      <Input
                        type="number"
                        min="0"
                        value={newPrice}
                        onChange={(e) => setNewPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {newProduct.use_unit_ids && (
                      <div className="space-y-2">
                        <Label>IDs Únicas (Se requieren {newQuantity} ID(s) de 4 dígitos)</Label>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                          {Array.from({ length: newQuantity }).map((_, index) => (
                            <div key={index} className="space-y-1">
                              <Label className="text-xs text-muted-foreground text-center block">#{index + 1}</Label>
                              <Input
                                placeholder="0001"
                                maxLength={4}
                                value={newUnitIds[index] || ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  const newIds = [...newUnitIds];
                                  newIds[index] = value.padStart(4, '0');
                                  setNewUnitIds(newIds.filter(id => id && id !== '0000'));
                                }}
                                className="font-mono text-center text-sm h-9"
                              />
                            </div>
                          ))}
                        </div>
                        {newUnitIds.length !== newQuantity && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠️ Debes ingresar exactamente {newQuantity} ID(s)
                          </p>
                        )}
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          💡 IDs disponibles: {extractIds(newProduct.registered_ids || []).slice(0, 10).join(', ')}
                          {extractIds(newProduct.registered_ids || []).length > 10 && '...'}
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Total Nuevo:</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        COP {formatCOP(newPrice * newQuantity)}
                      </p>
                    </div>
                  </>
                )}
                </div>
              )}
            </div>

            {/* Diferencia de Precio - Solo para cambios no pendientes */}
            {exchangeType !== 'pending' && originalProduct && newProduct && (
              <div className="p-4 border-2 border-dashed rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-lg">Diferencia de Precio</h3>
                  <div className={`text-2xl font-bold ${
                    priceDifference > 0
                      ? 'text-green-600 dark:text-green-400'
                      : priceDifference < 0
                      ? 'text-orange-600 dark:text-orange-400'
                      : 'text-muted-foreground'
                  }`}>
                    {priceDifference > 0 ? '+' : ''}COP {formatCOP(Math.abs(priceDifference))}
                  </div>
                </div>

                {priceDifference > 0 && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">
                      Cliente paga diferencia
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Efectivo</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paymentCash || ''}
                          onChange={(e) => setPaymentCash(parseFloat(e.target.value) || 0)}
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Transferencia</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paymentTransfer || ''}
                          onChange={(e) => setPaymentTransfer(parseFloat(e.target.value) || 0)}
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nequi</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paymentOther || ''}
                          onChange={(e) => setPaymentOther(parseFloat(e.target.value) || 0)}
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Daviplata</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          disabled
                          title="Usar el campo Nequi para Daviplata y otros"
                          className="text-lg font-semibold opacity-50"
                        />
                      </div>
                    </div>
                    <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                      <p className="text-xs text-green-700 dark:text-green-300">
                        Total ingresado: <span className="font-bold">COP {formatCOP(paymentCash + paymentTransfer + paymentOther)}</span>
                      </p>
                      {Math.abs((paymentCash + paymentTransfer + paymentOther) - priceDifference) > 0.01 && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          ⚠️ Debe sumar exactamente COP {formatCOP(priceDifference)}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {priceDifference < 0 && (
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      Se devuelve al cliente
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label>Efectivo</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paymentCash || ''}
                          onChange={(e) => setPaymentCash(parseFloat(e.target.value) || 0)}
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Transferencia</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paymentTransfer || ''}
                          onChange={(e) => setPaymentTransfer(parseFloat(e.target.value) || 0)}
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nequi</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          value={paymentOther || ''}
                          onChange={(e) => setPaymentOther(parseFloat(e.target.value) || 0)}
                          className="text-lg font-semibold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Daviplata</Label>
                        <Input
                          type="number"
                          min="0"
                          placeholder="0"
                          disabled
                          title="Usar el campo Nequi para Daviplata y otros"
                          className="text-lg font-semibold opacity-50"
                        />
                      </div>
                    </div>
                    <div className="p-2 bg-orange-50 dark:bg-orange-950/30 rounded">
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Total a devolver: <span className="font-bold">COP {formatCOP(paymentCash + paymentTransfer + paymentOther)}</span>
                      </p>
                      {Math.abs((paymentCash + paymentTransfer + paymentOther) - Math.abs(priceDifference)) > 0.01 && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          ⚠️ Debe sumar exactamente COP {formatCOP(Math.abs(priceDifference))}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {priceDifference === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay diferencia de precio
                  </p>
                )}
              </div>
            )}

            {/* Notas - Mostrar solo para cambios pendientes */}
            {exchangeType === 'pending' && (
              <div className="space-y-2">
                <Label>Notas {exchangeType === 'pending' && '(Requerido para cambios pendientes)'}</Label>
                <Textarea
                  placeholder="Información adicional sobre el cambio pendiente..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* Botones */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Procesando...' : 'Registrar Cambio'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Selección de Productos */}
      <Dialog open={productSelectorOpen} onOpenChange={setProductSelectorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {selectingFor === 'original' ? 'Seleccionar Producto Original' : 'Seleccionar Producto Nuevo'}
            </DialogTitle>
            <DialogDescription>
              Busca y selecciona el producto para el cambio.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Buscador */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar por código, nombre o precio..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
                autoFocus
              />
            </div>

            {/* Lista de productos */}
            <div className="flex-1 overflow-y-auto border border-border rounded-lg">
              {(() => {
                const filtered = products.filter(product => {
                  const search = productSearchTerm.toLowerCase();
                  
                  // Si estamos seleccionando producto nuevo, filtrar solo los que tengan stock
                  if (selectingFor === 'new' && product.stock <= 0) {
                    return false;
                  }
                  
                  return (
                    product.code.toLowerCase().includes(search) ||
                    product.name.toLowerCase().includes(search) ||
                    product.category.toLowerCase().includes(search) ||
                    product.final_price.toString().includes(search)
                  );
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No se encontraron productos</p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {filtered.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          if (selectingFor === 'original') {
                            handleSelectOriginalProduct(product.id);
                          } else {
                            handleSelectNewProduct(product.id);
                          }
                          setProductSelectorOpen(false);
                        }}
                        className="p-4 border border-border rounded-lg hover:border-green-500 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all text-left group"
                      >
                        {/* Código */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-mono font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                            {product.code}
                          </span>
                          {product.use_unit_ids && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                              🔢 IDs
                            </span>
                          )}
                        </div>

                        {/* Nombre */}
                        <h4 className="font-semibold text-base mb-1 line-clamp-2 group-hover:text-green-600 dark:group-hover:text-green-400">
                          {product.name}
                        </h4>

                        {/* Categoría */}
                        <p className="text-xs text-muted-foreground mb-3">{product.category}</p>

                        {/* Información */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Stock:</span>
                            <span className={`font-bold ${
                              product.stock <= 5
                                ? 'text-red-600 dark:text-red-400'
                                : product.stock <= 10
                                ? 'text-yellow-600 dark:text-yellow-400'
                                : 'text-green-600 dark:text-green-400'
                            }`}>
                              {product.stock} unid.
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Precio:</span>
                            <span className="font-bold text-green-600 dark:text-green-400">
                              {formatCOP(product.final_price)}
                            </span>
                          </div>

                          {product.use_unit_ids && product.registered_ids && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">IDs Disp:</span>
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {product.registered_ids.length}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Botón visual de selección */}
                        <div className="mt-3 pt-3 border-t border-border">
                          <div className="text-center text-xs font-medium text-green-600 dark:text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                            ✓ Click para seleccionar
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Contador */}
            {(() => {
              const filtered = products.filter(product => {
                const search = productSearchTerm.toLowerCase();
                if (selectingFor === 'new' && product.stock <= 0) return false;
                return (
                  product.code.toLowerCase().includes(search) ||
                  product.name.toLowerCase().includes(search) ||
                  product.category.toLowerCase().includes(search) ||
                  product.final_price.toString().includes(search)
                );
              });

              return (
                <p className="text-sm text-muted-foreground text-center">
                  Mostrando {filtered.length} de {selectingFor === 'new' ? products.filter(p => p.stock > 0).length : products.length} productos
                </p>
              );
            })()}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setProductSelectorOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Finalización de Cambio Pendiente */}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Finalizar Cambio Pendiente</DialogTitle>
            <DialogDescription>
              Complete la información del producto nuevo y el método de pago
            </DialogDescription>
          </DialogHeader>

          {exchangeToFinalize && (
            <div className="space-y-6">
              {/* Información del Producto Devuelto */}
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                <h3 className="font-semibold text-lg mb-3 text-green-900 dark:text-green-100">
                  Producto Devuelto
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Producto:</span>
                    <p className="font-semibold">{exchangeToFinalize.original_product_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Cantidad:</span>
                    <p className="font-semibold">{exchangeToFinalize.original_quantity}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Precio Unitario:</span>
                    <p className="font-semibold">COP {formatCOP(exchangeToFinalize.original_price)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>
                    <p className="font-semibold text-green-600 dark:text-green-400">
                      COP {formatCOP(exchangeToFinalize.original_total)}
                    </p>
                  </div>
                </div>
                {exchangeToFinalize.notes && (
                  <div className="mt-3 pt-3 border-t border-green-200 dark:border-green-800">
                    <span className="text-muted-foreground text-sm">Notas:</span>
                    <p className="text-sm mt-1">{exchangeToFinalize.notes}</p>
                  </div>
                )}
              </div>

              {/* Selector de Producto Nuevo */}
              <div className="space-y-4 p-4 border border-border rounded-lg">
                <h3 className="font-semibold text-lg">Producto que Lleva el Cliente</h3>

                <div className="space-y-2">
                  <Label>Producto Nuevo</Label>
                  {finalizeNewProduct ? (
                    <div className="p-3 border border-blue-500 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-blue-900 dark:text-blue-100">{finalizeNewProduct.name}</p>
                          <p className="text-xs text-blue-700 dark:text-blue-300">{finalizeNewProduct.code}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setFinalizeNewProduct(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ✕
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Stock:</span>
                          <span className="ml-1 font-medium">{finalizeNewProduct.stock}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Precio:</span>
                          <span className="ml-1 font-medium">COP {formatCOP(finalizeNewProduct.final_price)}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-20 border-dashed border-2 hover:bg-blue-50 dark:hover:bg-blue-950/20 hover:border-blue-500"
                      onClick={() => {
                        setSelectingFor('new');
                        setProductSearchTerm('');
                        setProductSelectorOpen(true);
                      }}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Package className="h-6 w-6 text-muted-foreground" />
                        <span className="text-sm font-medium">SELECCIONAR PRODUCTO</span>
                      </div>
                    </Button>
                  )}
                </div>

                {finalizeNewProduct && (
                  <>
                    <div className="space-y-2">
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        max={finalizeNewProduct.stock}
                        value={finalizeNewQuantity}
                        onChange={(e) => {
                          const qty = parseInt(e.target.value) || 1;
                          setFinalizeNewQuantity(qty);
                          // Limpiar IDs cuando cambia la cantidad
                          if (finalizeNewProduct.use_unit_ids) {
                            setFinalizeNewUnitIds([]);
                          }
                        }}
                      />
                      <p className="text-xs text-muted-foreground">Stock disponible: {finalizeNewProduct.stock}</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Precio Unitario</Label>
                      <Input
                        type="number"
                        min="0"
                        value={finalizeNewPrice}
                        onChange={(e) => setFinalizeNewPrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {finalizeNewProduct.use_unit_ids && (
                      <div className="space-y-2">
                        <Label>IDs Únicas (Se requieren {finalizeNewQuantity} ID(s) de 4 dígitos)</Label>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                          {Array.from({ length: finalizeNewQuantity }).map((_, index) => (
                            <div key={index} className="space-y-1">
                              <Label className="text-xs text-muted-foreground text-center block">#{index + 1}</Label>
                              <Input
                                placeholder="0001"
                                maxLength={4}
                                value={finalizeNewUnitIds[index] || ''}
                                onChange={(e) => {
                                  const value = e.target.value.replace(/\D/g, '').slice(0, 4);
                                  const newIds = [...finalizeNewUnitIds];
                                  newIds[index] = value.padStart(4, '0');
                                  setFinalizeNewUnitIds(newIds.filter(id => id && id !== '0000'));
                                }}
                                className="font-mono text-center text-sm h-9"
                              />
                            </div>
                          ))}
                        </div>
                        {finalizeNewUnitIds.length !== finalizeNewQuantity && (
                          <p className="text-xs text-red-600 dark:text-red-400">
                            ⚠️ Debes ingresar exactamente {finalizeNewQuantity} ID(s)
                          </p>
                        )}
                        <p className="text-xs text-blue-600 dark:text-blue-400">
                          💡 IDs disponibles: {extractIds(finalizeNewProduct.registered_ids || []).slice(0, 10).join(', ')}
                          {extractIds(finalizeNewProduct.registered_ids || []).length > 10 && '...'}
                        </p>
                      </div>
                    )}

                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Total Nuevo Producto:</p>
                      <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        COP {formatCOP(finalizeNewPrice * finalizeNewQuantity)}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Diferencia de Precio y Métodos de Pago */}
              {finalizeNewProduct && (() => {
                const newTotal = finalizeNewPrice * finalizeNewQuantity;
                const originalTotal = exchangeToFinalize.original_total;
                const difference = newTotal - originalTotal;

                return (
                  <div className="p-4 border-2 border-dashed rounded-lg">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-lg">Diferencia de Precio</h3>
                      <div className={`text-2xl font-bold ${
                        difference > 0
                          ? 'text-green-600 dark:text-green-400'
                          : difference < 0
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-muted-foreground'
                      }`}>
                        {difference > 0 ? '+' : ''}COP {formatCOP(Math.abs(difference))}
                      </div>
                    </div>

                    {difference !== 0 && (
                      <div className="space-y-4">
                        <p className={`text-sm font-medium ${
                          difference > 0
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-orange-700 dark:text-orange-300'
                        }`}>
                          {difference > 0 ? 'Cliente paga diferencia' : 'Se devuelve al cliente'}
                        </p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label>Efectivo</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={finalizePaymentCash || ''}
                              onChange={(e) => setFinalizePaymentCash(parseFloat(e.target.value) || 0)}
                              className="text-lg font-semibold"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Transferencia</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={finalizePaymentTransfer || ''}
                              onChange={(e) => setFinalizePaymentTransfer(parseFloat(e.target.value) || 0)}
                              className="text-lg font-semibold"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Nequi / Daviplata</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={finalizePaymentOther || ''}
                              onChange={(e) => setFinalizePaymentOther(parseFloat(e.target.value) || 0)}
                              className="text-lg font-semibold"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="opacity-50">Otro</Label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              disabled
                              title="Usar el campo Nequi/Daviplata"
                              className="text-lg font-semibold opacity-50"
                            />
                          </div>
                        </div>

                        <div className={`p-2 rounded ${
                          difference > 0
                            ? 'bg-green-50 dark:bg-green-950/30'
                            : 'bg-orange-50 dark:bg-orange-950/30'
                        }`}>
                          <p className={`text-xs ${
                            difference > 0
                              ? 'text-green-700 dark:text-green-300'
                              : 'text-orange-700 dark:text-orange-300'
                          }`}>
                            Total ingresado: <span className="font-bold">
                              COP {formatCOP(finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther)}
                            </span>
                          </p>
                          {Math.abs((finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther) - Math.abs(difference)) > 0.01 && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              ⚠️ Debe sumar exactamente COP {formatCOP(Math.abs(difference))}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {difference === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No hay diferencia de precio
                      </p>
                    )}
                  </div>
                );
              })()}

              {/* Botones */}
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setFinalizeDialogOpen(false)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button
                  onClick={async () => {
                    if (!finalizeNewProduct) {
                      toast.error('Selecciona el producto nuevo');
                      return;
                    }

                    const newTotal = finalizeNewPrice * finalizeNewQuantity;
                    const difference = newTotal - exchangeToFinalize.original_total;

                    if (difference !== 0) {
                      const totalPayment = finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther;
                      if (Math.abs(totalPayment - Math.abs(difference)) > 0.01) {
                        toast.error(`El total de pagos debe ser igual a la diferencia: ${formatCOP(Math.abs(difference))}`);
                        return;
                      }
                    }

                    if (finalizeNewProduct.stock < finalizeNewQuantity) {
                      toast.error(`Stock insuficiente de ${finalizeNewProduct.name}`);
                      return;
                    }

                    setIsLoading(true);
                    try {
                      // Calcular payment_method
                      const paymentCount = (finalizePaymentCash > 0 ? 1 : 0) +
                                          (finalizePaymentTransfer > 0 ? 1 : 0) +
                                          (finalizePaymentOther > 0 ? 1 : 0);

                      let calculatedPaymentMethod = undefined;
                      if (difference !== 0) {
                        if (paymentCount > 1) {
                          calculatedPaymentMethod = 'Mixto';
                        } else if (finalizePaymentCash > 0) {
                          calculatedPaymentMethod = 'Efectivo';
                        } else if (finalizePaymentTransfer > 0) {
                          calculatedPaymentMethod = 'Transferencia';
                        } else if (finalizePaymentOther > 0) {
                          calculatedPaymentMethod = 'Nequi';
                        }
                      }

                      const success = await finalizeExchange(
                        exchangeToFinalize.id,
                        {
                          new_product_id: finalizeNewProduct.id,
                          new_product_name: finalizeNewProduct.name,
                          new_quantity: finalizeNewQuantity,
                          new_price: finalizeNewPrice,
                          new_unit_ids: finalizeNewProduct.use_unit_ids ? finalizeNewUnitIds : undefined,
                          payment_method: calculatedPaymentMethod,
                          payment_cash: finalizePaymentCash,
                          payment_transfer: finalizePaymentTransfer,
                          payment_other: finalizePaymentOther,
                        }
                      );

                      if (success) {
                        toast.success('Cambio finalizado exitosamente');
                        setFinalizeDialogOpen(false);
                        await loadData();
                      } else {
                        toast.error('Error al finalizar el cambio');
                      }
                    } catch (error) {
                      console.error('Error finalizing exchange:', error);
                      toast.error('Error al procesar la finalización');
                    } finally {
                      setIsLoading(false);
                    }
                  }}
                  disabled={isLoading}
                >
                  {isLoading ? 'Procesando...' : 'Finalizar Cambio'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}