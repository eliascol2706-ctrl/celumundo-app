import { useState, useEffect } from 'react';
import { Search, Plus, Package, TrendingUp, ArrowRightLeft, DollarSign, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { formatCOP } from '../lib/currency';
import { getExchanges, getProducts, getInvoices, addExchange, getCurrentUser, getExchangesStats, extractColombiaDate, type Exchange, type Product, type Invoice } from '../lib/supabase';
import { toast } from 'sonner';

export default function Exchanges() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [exchangeType, setExchangeType] = useState<'invoice' | 'direct'>('direct');
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
  const [paymentMethod, setPaymentMethod] = useState('');
  const [notes, setNotes] = useState('');

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
        getProducts(),
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
      setNewProduct(product);
      setNewPrice(product.final_price);
      
      // Si el producto usa IDs únicas, seleccionar automáticamente las primeras disponibles
      if (product.use_unit_ids && product.registered_ids) {
        setNewUnitIds(product.registered_ids.slice(0, newQuantity));
      } else {
        setNewUnitIds([]);
      }
    }
  };

  const handleOriginalQuantityChange = (qty: number) => {
    if (!originalProduct) return;
    setOriginalQuantity(qty);
    
    // Ajustar IDs únicas si aplica
    if (originalProduct.use_unit_ids) {
      if (exchangeType === 'invoice' && selectedInvoice) {
        const invoiceItem = selectedInvoice.items.find(item => item.productId === originalProduct.id);
        if (invoiceItem?.unitIds) {
          setOriginalUnitIds(invoiceItem.unitIds.slice(0, qty));
        }
      }
    }
  };

  const handleNewQuantityChange = (qty: number) => {
    if (!newProduct) return;
    setNewQuantity(qty);
    
    // Ajustar IDs únicas si aplica
    if (newProduct.use_unit_ids && newProduct.registered_ids) {
      setNewUnitIds(newProduct.registered_ids.slice(0, qty));
    }
  };

  const calculatePriceDifference = () => {
    const originalTotal = originalPrice * originalQuantity;
    const newTotal = newPrice * newQuantity;
    return newTotal - originalTotal;
  };

  const validateForm = (): string | null => {
    if (!originalProduct) return 'Selecciona el producto original';
    if (!newProduct) return 'Selecciona el producto nuevo';
    if (originalProduct.id === newProduct.id) return 'Los productos deben ser diferentes';
    if (originalQuantity <= 0) return 'La cantidad original debe ser mayor a 0';
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
    
    // Validar IDs únicas del producto original si es cambio directo
    if (exchangeType === 'direct' && originalProduct.use_unit_ids) {
      if (originalUnitIds.length !== originalQuantity) {
        return `Debes especificar ${originalQuantity} ID(s) única(s) del producto original`;
      }
    }
    
    // Validar método de pago si hay diferencia positiva
    const difference = calculatePriceDifference();
    if (difference > 0 && !paymentMethod) {
      return 'Debes seleccionar un método de pago para la diferencia';
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    if (!originalProduct || !newProduct || !currentUser) return;

    setIsLoading(true);
    try {
      const priceDifference = calculatePriceDifference();
      const originalTotal = originalPrice * originalQuantity;
      const newTotal = newPrice * newQuantity;

      const exchangeData = {
        date: new Date().toISOString(),
        type: exchangeType,
        invoice_id: exchangeType === 'invoice' ? selectedInvoice?.id : undefined,
        invoice_number: exchangeType === 'invoice' ? selectedInvoice?.number : undefined,
        customer_name: exchangeType === 'invoice' ? selectedInvoice?.customer_name : undefined,
        original_product_id: originalProduct.id,
        original_product_name: originalProduct.name,
        original_quantity: originalQuantity,
        original_price: originalPrice,
        original_total: originalTotal,
        original_unit_ids: originalProduct.use_unit_ids ? originalUnitIds : undefined,
        new_product_id: newProduct.id,
        new_product_name: newProduct.name,
        new_quantity: newQuantity,
        new_price: newPrice,
        new_total: newTotal,
        new_unit_ids: newProduct.use_unit_ids ? newUnitIds : undefined,
        price_difference: priceDifference,
        payment_method: priceDifference !== 0 ? paymentMethod : undefined,
        payment_amount: priceDifference > 0 ? priceDifference : undefined,
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
                      <th className="text-left py-3 px-3 text-sm font-medium">Tipo</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto Original</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto Nuevo</th>
                      <th className="text-right py-3 px-3 text-sm font-medium">Diferencia</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Registrado por</th>
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
                            exchange.type === 'invoice'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                              : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                          }`}>
                            {exchange.type === 'invoice' ? 'Por Factura' : 'Directo'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          <div>{exchange.original_product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Cant: {exchange.original_quantity} × COP {formatCOP(exchange.original_price)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-sm">
                          <div>{exchange.new_product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            Cant: {exchange.new_quantity} × COP {formatCOP(exchange.new_price)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
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
                        </td>
                        <td className="py-3 px-3 text-sm">{exchange.registered_by}</td>
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
          </DialogHeader>

          <div className="space-y-6">
            {/* Tipo de Cambio */}
            <div className="space-y-2">
              <Label>Tipo de Cambio</Label>
              <Select value={exchangeType} onValueChange={(value: 'invoice' | 'direct') => {
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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

                    {originalProduct.use_unit_ids && exchangeType === 'direct' && (
                      <div className="space-y-2">
                        <Label>IDs Únicas</Label>
                        <Input
                          placeholder="Ej: 0001,0002"
                          value={originalUnitIds.join(',')}
                          onChange={(e) => setOriginalUnitIds(e.target.value.split(',').map(id => id.trim()))}
                        />
                        <p className="text-xs text-muted-foreground">
                          Separar con comas. Se requieren {originalQuantity} ID(s)
                        </p>
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

              {/* Producto Nuevo */}
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
                        <Label>IDs Únicas</Label>
                        <Select
                          value={newUnitIds[0] || ''}
                          onValueChange={(value) => {
                            const selectedIds = newProduct.registered_ids?.slice(0, newQuantity) || [];
                            if (selectedIds.includes(value)) {
                              setNewUnitIds(selectedIds.filter(id => newProduct.registered_ids?.indexOf(id) === newProduct.registered_ids?.indexOf(value) ? true : false).slice(0, newQuantity));
                            }
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="IDs seleccionadas automáticamente" />
                          </SelectTrigger>
                          <SelectContent>
                            {newProduct.registered_ids?.slice(0, 10).map(id => (
                              <SelectItem key={id} value={id}>{id}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          IDs seleccionadas: {newUnitIds.join(', ')}
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
            </div>

            {/* Diferencia de Precio */}
            {originalProduct && newProduct && (
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
                  <div className="space-y-2">
                    <Label>Método de Pago (Cliente paga diferencia)</Label>
                    <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar método de pago" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Efectivo">Efectivo</SelectItem>
                        <SelectItem value="Transferencia">Transferencia</SelectItem>
                        <SelectItem value="Tarjeta">Tarjeta</SelectItem>
                        <SelectItem value="Otros">Otros</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {priceDifference < 0 && (
                  <p className="text-sm text-muted-foreground">
                    Se debe devolver COP {formatCOP(Math.abs(priceDifference))} al cliente
                  </p>
                )}

                {priceDifference === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No hay diferencia de precio
                  </p>
                )}
              </div>
            )}

            {/* Notas */}
            <div className="space-y-2">
              <Label>Notas (Opcional)</Label>
              <Textarea
                placeholder="Información adicional sobre el cambio..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

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
    </div>
  );
}