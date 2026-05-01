import { useState, useEffect } from 'react';
import { Search, Plus, Package, TrendingUp, ArrowRightLeft, DollarSign, ChevronLeft, ChevronRight, Trash2, Edit, CheckCircle, XCircle, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { formatCOP } from '../lib/currency';
import { getExchanges, getAllProducts, getInvoices, addExchange, deleteExchange, finalizeExchange, cancelExchange, getCurrentUser, getExchangesStats, extractColombiaDate, getColombiaDateTime, searchProductsForInvoice, type Exchange, type ExchangeProduct, type Product, type Invoice } from '../lib/supabase';
import { extractIds, type UnitIdWithNote } from '../lib/unit-ids-utils';
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
  const [searchedProducts, setSearchedProducts] = useState<Product[]>([]);
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

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

  // Arrays de productos
  const [originalProducts, setOriginalProducts] = useState<ExchangeProduct[]>([]);
  const [newProducts, setNewProducts] = useState<ExchangeProduct[]>([]);

  // Estados temporales para agregar productos
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQuantity, setTempQuantity] = useState(1);
  const [tempPrice, setTempPrice] = useState(0);
  const [tempUnitIds, setTempUnitIds] = useState<string[]>([]);

  // Campo de nombre de cliente
  const [customerName, setCustomerName] = useState('');
  
  // Diferencia de precio
  const [paymentMethod, setPaymentMethod] = useState(''); // Mantener por compatibilidad
  const [paymentCash, setPaymentCash] = useState(0);
  const [paymentTransfer, setPaymentTransfer] = useState(0);
  const [paymentOther, setPaymentOther] = useState(0);
  const [notes, setNotes] = useState('');

  // Modal de finalización de cambio pendiente
  const [finalizeDialogOpen, setFinalizeDialogOpen] = useState(false);
  const [exchangeToFinalize, setExchangeToFinalize] = useState<Exchange | null>(null);
  const [finalizeNewProducts, setFinalizeNewProducts] = useState<ExchangeProduct[]>([]);
  const [finalizeTempProduct, setFinalizeTempProduct] = useState<Product | null>(null);
  const [finalizeTempQuantity, setFinalizeTempQuantity] = useState(1);
  const [finalizeTempPrice, setFinalizeTempPrice] = useState(0);
  const [finalizeTempUnitIds, setFinalizeTempUnitIds] = useState<string[]>([]);
  const [finalizePaymentCash, setFinalizePaymentCash] = useState(0);
  const [finalizePaymentTransfer, setFinalizePaymentTransfer] = useState(0);
  const [finalizePaymentOther, setFinalizePaymentOther] = useState(0);

  const itemsPerPage = 10;
  const currentUser = getCurrentUser();

  // Helper functions para filtrar IDs según contexto
  const getDisabledIds = (product: Product | null): UnitIdWithNote[] => {
    if (!product || !product.registered_ids) return [];
    return product.registered_ids.filter((idObj: UnitIdWithNote) => idObj.disabled === true);
  };

  const getAvailableIds = (product: Product | null): UnitIdWithNote[] => {
    if (!product || !product.registered_ids) return [];
    return product.registered_ids.filter((idObj: UnitIdWithNote) => !idObj.disabled);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Limpiar campos de pago cuando la diferencia es 0
  useEffect(() => {
    if (originalProducts.length > 0 && newProducts.length > 0) {
      const difference = calculatePriceDifference();
      if (difference === 0) {
        setPaymentCash(0);
        setPaymentTransfer(0);
        setPaymentOther(0);
      }
    }
  }, [originalProducts, newProducts]);

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

  const handleSearchProducts = async () => {
    if (!productSearchTerm.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }

    setIsSearchingProducts(true);
    try {
      const results = await searchProductsForInvoice(productSearchTerm);
      setSearchedProducts(results);
      setHasSearched(true);

      if (results.length === 0) {
        toast.info('No se encontraron productos');
      }
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Error al buscar productos');
    } finally {
      setIsSearchingProducts(false);
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
    setOriginalProducts([]);
    setNewProducts([]);
    setTempProduct(null);
    setTempQuantity(1);
    setTempPrice(0);
    setTempUnitIds([]);
    setCustomerName('');
    setPaymentMethod('');
    setPaymentCash(0);
    setPaymentTransfer(0);
    setPaymentOther(0);
    setNotes('');
    // Limpiar búsqueda de productos
    setProductSearchTerm('');
    setSearchedProducts([]);
    setHasSearched(false);
  };

  const handleAddOriginalProduct = () => {
    if (!tempProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (tempQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Validar IDs únicas si aplica
    if (tempProduct.use_unit_ids && tempUnitIds.length !== tempQuantity) {
      toast.error(`Debes seleccionar ${tempQuantity} ID(s) única(s)`);
      return;
    }

    const newProduct: ExchangeProduct = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      quantity: tempQuantity,
      price: tempPrice,
      total: tempPrice * tempQuantity,
      unitIds: tempUnitIds.length > 0 ? tempUnitIds : undefined,
    };

    setOriginalProducts([...originalProducts, newProduct]);

    // Limpiar temporales
    setTempProduct(null);
    setTempQuantity(1);
    setTempPrice(0);
    setTempUnitIds([]);
    setProductSelectorOpen(false);
  };

  const handleRemoveOriginalProduct = (index: number) => {
    setOriginalProducts(originalProducts.filter((_, i) => i !== index));
  };

  const handleAddNewProduct = () => {
    if (!tempProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (tempQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Validar stock
    if (tempProduct.stock < tempQuantity) {
      toast.error(`Stock insuficiente. Disponible: ${tempProduct.stock}`);
      return;
    }

    // Validar IDs únicas si aplica
    if (tempProduct.use_unit_ids) {
      const availableIds = extractIds(tempProduct.registered_ids);
      if (availableIds.length < tempQuantity) {
        toast.error('No hay suficientes IDs únicas disponibles');
        return;
      }
      if (tempUnitIds.length !== tempQuantity) {
        toast.error(`Debes seleccionar ${tempQuantity} ID(s) única(s)`);
        return;
      }
    }

    const newProduct: ExchangeProduct = {
      productId: tempProduct.id,
      productName: tempProduct.name,
      quantity: tempQuantity,
      price: tempPrice,
      total: tempPrice * tempQuantity,
      unitIds: tempUnitIds.length > 0 ? tempUnitIds : undefined,
    };

    setNewProducts([...newProducts, newProduct]);

    // Limpiar temporales
    setTempProduct(null);
    setTempQuantity(1);
    setTempPrice(0);
    setTempUnitIds([]);
    setProductSelectorOpen(false);
  };

  const handleRemoveNewProduct = (index: number) => {
    setNewProducts(newProducts.filter((_, i) => i !== index));
  };

  const handleAddFinalizeProduct = () => {
    if (!finalizeTempProduct) {
      toast.error('Selecciona un producto');
      return;
    }

    if (finalizeTempQuantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    // Validar stock
    if (finalizeTempProduct.stock < finalizeTempQuantity) {
      toast.error(`Stock insuficiente. Disponible: ${finalizeTempProduct.stock}`);
      return;
    }

    // Validar IDs únicas si aplica
    if (finalizeTempProduct.use_unit_ids) {
      const availableIds = extractIds(finalizeTempProduct.registered_ids);
      if (availableIds.length < finalizeTempQuantity) {
        toast.error('No hay suficientes IDs únicas disponibles');
        return;
      }
      if (finalizeTempUnitIds.length !== finalizeTempQuantity) {
        toast.error(`Debes seleccionar ${finalizeTempQuantity} ID(s) única(s)`);
        return;
      }
    }

    const newProduct: ExchangeProduct = {
      productId: finalizeTempProduct.id,
      productName: finalizeTempProduct.name,
      quantity: finalizeTempQuantity,
      price: finalizeTempPrice,
      total: finalizeTempPrice * finalizeTempQuantity,
      unitIds: finalizeTempUnitIds.length > 0 ? finalizeTempUnitIds : undefined,
    };

    setFinalizeNewProducts([...finalizeNewProducts, newProduct]);

    // Limpiar temporales
    setFinalizeTempProduct(null);
    setFinalizeTempQuantity(1);
    setFinalizeTempPrice(0);
    setFinalizeTempUnitIds([]);
    setProductSelectorOpen(false);
  };

  const handleRemoveFinalizeProduct = (index: number) => {
    setFinalizeNewProducts(finalizeNewProducts.filter((_, i) => i !== index));
  };

  const handleSelectTempProduct = (productId: string) => {
    const product = searchedProducts.find(p => p.id === productId);
    if (product) {
      setTempProduct(product);
      setTempPrice(product.final_price);
      setTempQuantity(1);
      setTempUnitIds([]);
      // No cerrar el modal, solo seleccionar el producto
    }
  };

  const handleSelectInvoice = (invoiceNumber: string) => {
    const invoice = invoices.find(inv => inv.number === invoiceNumber);
    if (invoice) {
      setSelectedInvoice(invoice);
      setInvoiceSearch(invoiceNumber);
    }
  };


  const handleSelectFinalizeTempProduct = (productId: string) => {
    // Solo se usa en el modal de finalización
    const product = searchedProducts.find(p => p.id === productId);
    if (product && finalizeDialogOpen) {
      setFinalizeTempProduct(product);
      setFinalizeTempPrice(product.final_price);
      setFinalizeTempQuantity(1);
      setFinalizeTempUnitIds([]);
    }
  };

  const calculatePriceDifference = () => {
    const originalTotal = originalProducts.reduce((sum, p) => sum + p.total, 0);
    const newTotal = newProducts.reduce((sum, p) => sum + p.total, 0);
    return newTotal - originalTotal;
  };

  const validateForm = (): string | null => {
    if (originalProducts.length === 0) {
      return 'Debes agregar al menos un producto original';
    }

    if (exchangeType !== 'pending' && newProducts.length === 0) {
      return 'Debes agregar al menos un producto nuevo';
    }

    if (!customerName.trim()) {
      return 'Debes ingresar el nombre del cliente';
    }

    // Validar diferencia de precio
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

    if (!currentUser) return;

    setIsLoading(true);
    try {
      const exchangeData = {
        type: exchangeType,
        status: exchangeType === 'pending' ? ('pending' as const) : ('completed' as const),
        invoice_id: selectedInvoice?.id,
        invoice_number: selectedInvoice?.number,
        customer_name: customerName,

        // NUEVO: Arrays de productos
        original_products: originalProducts,
        new_products: exchangeType === 'pending' ? [] : newProducts,

        // Compatibilidad con campos antiguos (primer producto de cada array)
        original_product_id: originalProducts[0]?.productId || '',
        original_product_name: originalProducts[0]?.productName || '',
        original_quantity: originalProducts.reduce((sum, p) => sum + p.quantity, 0),
        original_price: originalProducts[0]?.price || 0,
        original_total: originalProducts.reduce((sum, p) => sum + p.total, 0),
        original_unit_ids: originalProducts[0]?.unitIds,

        new_product_id: newProducts[0]?.productId,
        new_product_name: newProducts[0]?.productName,
        new_quantity: newProducts.reduce((sum, p) => sum + p.quantity, 0),
        new_price: newProducts[0]?.price || 0,
        new_total: newProducts.reduce((sum, p) => sum + p.total, 0),
        new_unit_ids: newProducts[0]?.unitIds,

        price_difference: calculatePriceDifference(),
        payment_cash: paymentCash,
        payment_transfer: paymentTransfer,
        payment_other: paymentOther,
        notes: notes,
        registered_by: currentUser?.username || 'Usuario',
      };

      const result = await addExchange(exchangeData);

      if (result) {
        toast.success('Cambio registrado exitosamente');
        setIsDialogOpen(false);
        loadData();
      } else {
        toast.error('Error al registrar el cambio');
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
      exchange.exchange_number?.toLowerCase().includes(searchLower) ||
      exchange.original_product_name?.toLowerCase().includes(searchLower) ||
      exchange.new_product_name?.toLowerCase().includes(searchLower) ||
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
                      <th className="text-left py-3 px-3 text-sm font-medium">Cliente</th>
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
                        <td className="py-3 px-3 text-sm">
                          {exchange.customer_name || <span className="text-muted-foreground italic">Sin nombre</span>}
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
                          {exchange.original_products && exchange.original_products.length > 0 ? (
                            <div className="space-y-1">
                              {exchange.original_products.map((prod, idx) => (
                                <div key={idx}>
                                  <div className="font-medium">{prod.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Cant: {prod.quantity} × COP {formatCOP(prod.price)} = {formatCOP(prod.total)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            // Fallback para registros antiguos
                            <>
                              <div>{exchange.original_product_name}</div>
                              <div className="text-xs text-muted-foreground">
                                Cant: {exchange.original_quantity} × COP {formatCOP(exchange.original_price)}
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          {exchange.new_products && exchange.new_products.length > 0 ? (
                            <div className="space-y-1">
                              {exchange.new_products.map((prod, idx) => (
                                <div key={idx}>
                                  <div className="font-medium">{prod.productName}</div>
                                  <div className="text-xs text-muted-foreground">
                                    Cant: {prod.quantity} × COP {formatCOP(prod.price)} = {formatCOP(prod.total)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : exchange.new_product_name ? (
                            // Fallback para registros antiguos
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
                          {exchange.status === 'pending' ? (
                            <span className="text-xs text-muted-foreground italic">Por definir</span>
                          ) : exchange.price_difference !== undefined && exchange.price_difference !== null ? (
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
                                    setFinalizeNewProducts([]);
                                    setFinalizeTempProduct(null);
                                    setFinalizeTempQuantity(1);
                                    setFinalizeTempPrice(0);
                                    setFinalizeTempUnitIds([]);
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

            {/* Campo Nombre de Cliente */}
            <div className="space-y-2">
              <Label htmlFor="customerName">Nombre del Cliente *</Label>
              <Input
                id="customerName"
                placeholder="Ingresa el nombre del cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            {/* Productos a Devolver (Originales) */}
            <div className="space-y-3">
              <Label>Productos a Devolver</Label>

              {/* Lista de productos agregados */}
              <div className="space-y-2">
                {originalProducts.map((product, index) => (
                  <div key={index} className="flex items-center gap-2 border rounded p-2 bg-red-50 dark:bg-red-950/30">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{product.productName}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        {product.quantity} × {formatCOP(product.price)} = {formatCOP(product.total)}
                      </div>
                      {product.unitIds && product.unitIds.length > 0 && (
                        <div className="text-xs text-gray-500">
                          IDs: {product.unitIds.join(', ')}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveOriginalProduct(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* Botón agregar */}
              <Button
                onClick={() => {
                  setSelectingFor('original');
                  setProductSearchTerm('');
                  setSearchedProducts([]);
                  setHasSearched(false);
                  setProductSelectorOpen(true);
                }}
                className="w-full"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Producto a Devolver
              </Button>
            </div>

            {/* Productos Nuevos (que se entregan) - Ocultar cuando es pending */}
            {exchangeType !== 'pending' && (
              <div className="space-y-3">
                <Label>Productos a Entregar</Label>

                <div className="space-y-2">
                  {newProducts.map((product, index) => (
                    <div key={index} className="flex items-center gap-2 border rounded p-2 bg-green-50 dark:bg-green-950/30">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{product.productName}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {product.quantity} × {formatCOP(product.price)} = {formatCOP(product.total)}
                        </div>
                        {product.unitIds && product.unitIds.length > 0 && (
                          <div className="text-xs text-gray-500">
                            IDs: {product.unitIds.join(', ')}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveNewProduct(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button
                  onClick={() => {
                    setSelectingFor('new');
                    setProductSearchTerm('');
                    setSearchedProducts([]);
                    setHasSearched(false);
                    setProductSelectorOpen(true);
                  }}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto a Entregar
                </Button>
              </div>
            )}

            {/* Diferencia de Precio - Solo para cambios no pendientes */}
            {exchangeType !== 'pending' && originalProducts.length > 0 && newProducts.length > 0 && (
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
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar por código, nombre o precio..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearchProducts();
                    }
                  }}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <Button
                onClick={handleSearchProducts}
                disabled={isSearchingProducts || !productSearchTerm.trim()}
              >
                {isSearchingProducts ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>

            {/* Lista de productos */}
            <div className="flex-1 overflow-y-auto border border-border rounded-lg">
              {(() => {
                // Si no se ha buscado, mostrar mensaje inicial
                if (!hasSearched) {
                  return (
                    <div className="text-center py-12 text-muted-foreground">
                      <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="font-medium">Ingresa un término de búsqueda</p>
                      <p className="text-sm mt-1">Busca por código, nombre, categoría o precio</p>
                    </div>
                  );
                }

                // Filtrar productos según si es para nuevo o original
                const filtered = searchedProducts.filter(product => {
                  // Si estamos seleccionando producto nuevo, filtrar solo los que tengan stock
                  if (selectingFor === 'new' && product.stock <= 0) {
                    return false;
                  }
                  return true;
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
                          // Si estamos en el modal de finalización
                          if (finalizeDialogOpen) {
                            handleSelectFinalizeTempProduct(product.id);
                          } else {
                            // Modal de crear cambio nuevo - usar temp product (no cerrar modal)
                            handleSelectTempProduct(product.id);
                          }
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
            {hasSearched && (() => {
              const filtered = searchedProducts.filter(product => {
                if (selectingFor === 'new' && product.stock <= 0) return false;
                return true;
              });

              return (
                <p className="text-sm text-muted-foreground text-center">
                  Mostrando {filtered.length} producto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
                </p>
              );
            })()}

            {/* Configuración del producto seleccionado */}
            {!finalizeDialogOpen && tempProduct && (
              <div className="space-y-4 p-4 border-2 border-green-500 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-950/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-green-900 dark:text-green-100">
                    Configurar: {tempProduct.name}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTempProduct(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      value={tempQuantity}
                      onChange={(e) => setTempQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio Unitario</Label>
                    <Input
                      type="number"
                      min="0"
                      value={tempPrice}
                      onChange={(e) => setTempPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {tempProduct.use_unit_ids && (
                  <div className="space-y-2">
                    <Label>IDs Únicas (Se requieren {tempQuantity} ID(s))</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Array.from({ length: tempQuantity }).map((_, index) => {
                        const availableForSelection = selectingFor === 'original'
                          ? getDisabledIds(tempProduct).filter(idObj => !tempUnitIds.includes(idObj.id))
                          : getAvailableIds(tempProduct).filter(idObj => !tempUnitIds.includes(idObj.id));

                        return (
                          <div key={index} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">ID #{index + 1}</Label>
                            <Select
                              value={tempUnitIds[index] || ''}
                              onValueChange={(value) => {
                                const newIds = [...tempUnitIds];
                                newIds[index] = value;
                                setTempUnitIds(newIds.filter(id => id));
                              }}
                            >
                              <SelectTrigger className="font-mono text-sm h-9">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableForSelection.map((idObj) => (
                                  <SelectItem key={idObj.id} value={idObj.id} className="font-mono">
                                    {idObj.id} {idObj.note && `(${idObj.note})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                    {tempUnitIds.length !== tempQuantity && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        ⚠️ Debes seleccionar {tempQuantity} ID(s)
                      </p>
                    )}
                    {selectingFor === 'original' && (
                      <p className="text-xs text-orange-600 dark:text-orange-400">
                        💡 IDs inhabilitadas/vendidas: {getDisabledIds(tempProduct).length} disponibles
                      </p>
                    )}
                    {selectingFor === 'new' && (
                      <p className="text-xs text-blue-600 dark:text-blue-400">
                        💡 IDs disponibles: {getAvailableIds(tempProduct).length} en stock
                      </p>
                    )}
                  </div>
                )}

                <div className="p-2 bg-white dark:bg-gray-900 rounded">
                  <p className="text-sm font-medium">Total:</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    COP {formatCOP(tempPrice * tempQuantity)}
                  </p>
                </div>

                <Button
                  onClick={() => {
                    if (selectingFor === 'original') {
                      handleAddOriginalProduct();
                    } else {
                      handleAddNewProduct();
                    }
                  }}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>
            )}

            {/* Configuración del producto para finalización */}
            {finalizeDialogOpen && finalizeTempProduct && (
              <div className="space-y-4 p-4 border-2 border-blue-500 dark:border-blue-600 rounded-lg bg-blue-50 dark:bg-blue-950/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                    Configurar: {finalizeTempProduct.name}
                  </h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFinalizeTempProduct(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Cantidad</Label>
                    <Input
                      type="number"
                      min="1"
                      value={finalizeTempQuantity}
                      onChange={(e) => setFinalizeTempQuantity(parseInt(e.target.value) || 1)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Precio Unitario</Label>
                    <Input
                      type="number"
                      min="0"
                      value={finalizeTempPrice}
                      onChange={(e) => setFinalizeTempPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                {finalizeTempProduct.use_unit_ids && (
                  <div className="space-y-2">
                    <Label>IDs Únicas (Se requieren {finalizeTempQuantity} ID(s))</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {Array.from({ length: finalizeTempQuantity }).map((_, index) => {
                        const availableForSelection = getAvailableIds(finalizeTempProduct).filter(
                          idObj => !finalizeTempUnitIds.includes(idObj.id)
                        );

                        return (
                          <div key={index} className="space-y-1">
                            <Label className="text-xs text-muted-foreground">ID #{index + 1}</Label>
                            <Select
                              value={finalizeTempUnitIds[index] || ''}
                              onValueChange={(value) => {
                                const newIds = [...finalizeTempUnitIds];
                                newIds[index] = value;
                                setFinalizeTempUnitIds(newIds.filter(id => id));
                              }}
                            >
                              <SelectTrigger className="font-mono text-sm h-9">
                                <SelectValue placeholder="Seleccionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableForSelection.map((idObj) => (
                                  <SelectItem key={idObj.id} value={idObj.id} className="font-mono">
                                    {idObj.id} {idObj.note && `(${idObj.note})`}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        );
                      })}
                    </div>
                    {finalizeTempUnitIds.length !== finalizeTempQuantity && (
                      <p className="text-xs text-red-600 dark:text-red-400">
                        ⚠️ Debes seleccionar {finalizeTempQuantity} ID(s)
                      </p>
                    )}
                    <p className="text-xs text-blue-600 dark:text-blue-400">
                      💡 IDs disponibles: {getAvailableIds(finalizeTempProduct).length} en stock
                    </p>
                  </div>
                )}

                <div className="p-2 bg-white dark:bg-gray-900 rounded">
                  <p className="text-sm font-medium">Total:</p>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    COP {formatCOP(finalizeTempPrice * finalizeTempQuantity)}
                  </p>
                </div>

                <Button
                  onClick={handleAddFinalizeProduct}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto
                </Button>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => {
              setProductSelectorOpen(false);
              setTempProduct(null);
              setTempQuantity(1);
              setTempPrice(0);
              setTempUnitIds([]);
              setProductSearchTerm('');
              setSearchedProducts([]);
              setHasSearched(false);
            }}>
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

              {/* Productos a Entregar */}
              <div className="space-y-3">
                <Label>Productos a Entregar</Label>

                {/* Lista de productos agregados */}
                <div className="space-y-2">
                  {finalizeNewProducts.map((product, index) => (
                    <div key={index} className="flex items-center gap-2 border rounded p-2 bg-green-50 dark:bg-green-950/30">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{product.productName}</div>
                        <div className="text-xs text-gray-600 dark:text-gray-400">
                          {product.quantity} × {formatCOP(product.price)} = {formatCOP(product.total)}
                        </div>
                        {product.unitIds && product.unitIds.length > 0 && (
                          <div className="text-xs text-gray-500">
                            IDs: {product.unitIds.join(', ')}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFinalizeProduct(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Botón agregar */}
                <Button
                  onClick={() => {
                    setSelectingFor('new');
                    setProductSearchTerm('');
                    setSearchedProducts([]);
                    setHasSearched(false);
                    setProductSelectorOpen(true);
                  }}
                  className="w-full"
                  variant="outline"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Agregar Producto a Entregar
                </Button>
              </div>

              {/* Diferencia de Precio y Métodos de Pago */}
              {finalizeNewProducts.length > 0 && (() => {
                const newTotal = finalizeNewProducts.reduce((sum, p) => sum + p.total, 0);
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
                    if (finalizeNewProducts.length === 0) {
                      toast.error('Debes agregar al menos un producto a entregar');
                      return;
                    }

                    const newTotal = finalizeNewProducts.reduce((sum, p) => sum + p.total, 0);
                    const difference = newTotal - exchangeToFinalize.original_total;

                    if (difference !== 0) {
                      const totalPayment = finalizePaymentCash + finalizePaymentTransfer + finalizePaymentOther;
                      if (Math.abs(totalPayment - Math.abs(difference)) > 0.01) {
                        toast.error(`El total de pagos debe ser igual a la diferencia: ${formatCOP(Math.abs(difference))}`);
                        return;
                      }
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
                          new_products: finalizeNewProducts,
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