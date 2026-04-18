import { useState, useEffect } from 'react';
import { Search, Plus, Package, Clock, Send, RotateCcw, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Barcode } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatCOP } from '../lib/currency';
import { getWarranties, getAllProducts, addWarranty, getCurrentUser, getWarrantiesStats, updateWarrantyStatus, type Warranty, type Product } from '../lib/supabase';
import { toast } from 'sonner';

export default function Warranties() {
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Modal de selección de productos
  const [productSelectorOpen, setProductSelectorOpen] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');

  // Estadísticas
  const [stats, setStats] = useState({
    totalWarranties: 0,
    pendingWarranties: 0,
    sentWarranties: 0,
    returnedWarranties: 0,
    resolvedWarranties: 0,
    cancelledWarranties: 0,
    totalActiveUnits: 0,
    resolutionRate: 0,
  });

  // Formulario - Nueva Garantía
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [unitIds, setUnitIds] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [discountFromStock, setDiscountFromStock] = useState(true);

  // Formulario - Actualizar Estado
  const [selectedWarranty, setSelectedWarranty] = useState<Warranty | null>(null);
  const [newStatus, setNewStatus] = useState<Warranty['status']>('pending');
  const [statusNotes, setStatusNotes] = useState('');

  const itemsPerPage = 10;
  const currentUser = getCurrentUser();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [warrantiesData, productsData, statsData] = await Promise.all([
        getWarranties(),
        getAllProducts(),
        getWarrantiesStats()
      ]);
      setWarranties(warrantiesData);
      setProducts(productsData);
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
    setSelectedProduct(null);
    setQuantity(1);
    setUnitIds([]);
    setNotes('');
    setDiscountFromStock(true);
    setBarcodeInput('');
  };

  const handleSelectProduct = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProduct(product);
      
      // Si el producto usa IDs únicas, seleccionar automáticamente las primeras disponibles
      if (product.use_unit_ids && product.registered_ids) {
        setUnitIds(product.registered_ids.slice(0, quantity));
      } else {
        setUnitIds([]);
      }
    }
  };

  const handleBarcodeSearch = () => {
    if (!barcodeInput.trim()) return;

    const product = products.find(p => 
      p.code.toLowerCase() === barcodeInput.toLowerCase().trim()
    );

    if (product) {
      handleSelectProduct(product.id);
      setProductSelectorOpen(false);
      setBarcodeInput('');
      toast.success(`Producto encontrado: ${product.name}`);
    } else {
      toast.error('Producto no encontrado');
    }
  };

  const handleQuantityChange = (qty: number) => {
    if (!selectedProduct) return;
    setQuantity(qty);
    
    // Ajustar IDs únicas si aplica
    if (selectedProduct.use_unit_ids && selectedProduct.registered_ids) {
      setUnitIds(selectedProduct.registered_ids.slice(0, qty));
    }
  };

  const validateForm = (): string | null => {
    if (!selectedProduct) return 'Selecciona un producto';
    if (quantity <= 0) return 'La cantidad debe ser mayor a 0';
    if (!notes.trim()) return 'Describe el motivo de la garantía';
    
    // Validar stock si se descuenta
    if (discountFromStock && selectedProduct.stock < quantity) {
      return `Stock insuficiente. Disponible: ${selectedProduct.stock}`;
    }
    
    // Validar IDs únicas si aplica
    if (selectedProduct.use_unit_ids) {
      if (discountFromStock && (!selectedProduct.registered_ids || selectedProduct.registered_ids.length < quantity)) {
        return `No hay suficientes IDs únicas disponibles`;
      }
      if (discountFromStock && unitIds.length !== quantity) {
        return `Debes seleccionar ${quantity} ID(s) única(s)`;
      }
    }
    
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    if (!selectedProduct || !currentUser) return;

    setIsLoading(true);
    try {
      const warrantyData = {
        date: new Date().toISOString(),
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        product_code: selectedProduct.code,
        quantity: quantity,
        unit_ids: selectedProduct.use_unit_ids && discountFromStock ? unitIds : undefined,
        notes: notes.trim(),
        discount_from_stock: discountFromStock,
        status: 'pending' as const,
        registered_by: currentUser.username,
      };

      const result = await addWarranty(warrantyData);

      if (result) {
        toast.success('Garantía registrada exitosamente');
        setIsDialogOpen(false);
        loadData();
      } else {
        toast.error('Error al registrar la garantía');
      }
    } catch (error) {
      console.error('Error submitting warranty:', error);
      toast.error('Error al procesar la garantía');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenStatusDialog = (warranty: Warranty) => {
    setSelectedWarranty(warranty);
    setNewStatus(warranty.status);
    setStatusNotes('');
    setIsStatusDialogOpen(true);
  };

  const handleUpdateStatus = async () => {
    if (!selectedWarranty || !currentUser) return;

    if (!statusNotes.trim() && newStatus !== selectedWarranty.status) {
      toast.error('Agrega una nota sobre el cambio de estado');
      return;
    }

    setIsLoading(true);
    try {
      const notesData = {
        sent_notes: newStatus === 'sent' ? statusNotes : undefined,
        return_notes: newStatus === 'returned' ? statusNotes : undefined,
        resolution_notes: newStatus === 'resolved' || newStatus === 'cancelled' ? statusNotes : undefined,
      };

      const result = await updateWarrantyStatus(
        selectedWarranty.id,
        newStatus,
        notesData,
        currentUser.username
      );

      if (result) {
        toast.success('Estado actualizado exitosamente');
        setIsStatusDialogOpen(false);
        loadData();
      } else {
        toast.error('Error al actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Error al procesar la actualización');
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrar garantías
  const filteredWarranties = warranties.filter(warranty => {
    const matchesSearch = searchTerm.toLowerCase() === '' ||
      warranty.warranty_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warranty.product_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warranty.product_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      warranty.notes?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || warranty.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Paginación
  const totalPages = Math.ceil(filteredWarranties.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedWarranties = filteredWarranties.slice(startIndex, startIndex + itemsPerPage);

  const getStatusColor = (status: Warranty['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300';
      case 'sent':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300';
      case 'returned':
        return 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300';
      case 'resolved':
        return 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300';
      case 'cancelled':
        return 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300';
    }
  };

  const getStatusLabel = (status: Warranty['status']) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'sent': return 'Enviada';
      case 'returned': return 'Devuelta';
      case 'resolved': return 'Resuelta';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Garantías</h2>
          <p className="text-muted-foreground mt-1">Control de productos en garantía</p>
        </div>
        <Button onClick={handleOpenDialog} disabled={isLoading}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva Garantía
        </Button>
      </div>

      {/* Tarjetas de Estadísticas */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Package className="h-4 w-4" />
              Total Garantías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalWarranties}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {stats.pendingWarranties}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Send className="h-4 w-4" />
              Enviadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.sentWarranties}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Resueltas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.resolvedWarranties}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col md:flex-row items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar por número, producto o notas..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => {
          setStatusFilter(value);
          setCurrentPage(1);
        }}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="returned">Devuelta</SelectItem>
            <SelectItem value="resolved">Resuelta</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Garantías */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de Garantías</CardTitle>
        </CardHeader>
        <CardContent>
          {paginatedWarranties.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No hay garantías registradas</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-sm font-medium">Número</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Fecha</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Cant.</th>
                      <th className="text-left py-3 px-3 text-sm font-medium">Motivo</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Stock</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Estado</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedWarranties.map((warranty) => (
                      <tr key={warranty.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-3 text-sm font-medium">{warranty.warranty_number}</td>
                        <td className="py-3 px-3 text-sm">
                          {new Date(warranty.date).toLocaleDateString('es-ES')}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          <div>{warranty.product_name}</div>
                          <div className="text-xs text-muted-foreground">{warranty.product_code}</div>
                        </td>
                        <td className="py-3 px-3 text-center text-sm font-medium">
                          {warranty.quantity}
                        </td>
                        <td className="py-3 px-3 text-sm">
                          <div className="max-w-xs truncate" title={warranty.notes || ''}>
                            {warranty.notes || 'Sin notas'}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            warranty.discount_from_stock
                              ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                          }`}>
                            {warranty.discount_from_stock ? 'Sí' : 'No'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(warranty.status)}`}>
                            {getStatusLabel(warranty.status)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenStatusDialog(warranty)}
                            disabled={warranty.status === 'resolved' || warranty.status === 'cancelled'}
                          >
                            Actualizar
                          </Button>
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
                    Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, filteredWarranties.length)} de {filteredWarranties.length} garantías
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

      {/* Dialog Nueva Garantía */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nueva Garantía</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Selección de Producto */}
            <div className="space-y-2">
              <Label>Producto</Label>
              {selectedProduct ? (
                <div className="p-3 border border-green-500 dark:border-green-600 rounded-lg bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-semibold text-green-900 dark:text-green-100">{selectedProduct.name}</p>
                      <p className="text-xs text-green-700 dark:text-green-300">{selectedProduct.code}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedProduct(null)}
                      className="text-red-500 hover:text-red-700"
                    >
                      ✕
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Stock:</span>
                      <span className="ml-1 font-medium">{selectedProduct.stock}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Precio:</span>
                      <span className="ml-1 font-medium">COP {formatCOP(selectedProduct.final_price)}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-20 border-dashed border-2 hover:bg-green-50 dark:hover:bg-green-950/20 hover:border-green-500"
                  onClick={() => {
                    setProductSearchTerm('');
                    setBarcodeInput('');
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

            {selectedProduct && (
              <>
                <div className="space-y-2">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                  />
                </div>

                {selectedProduct.use_unit_ids && discountFromStock && (
                  <div className="space-y-2">
                    <Label>IDs Únicas</Label>
                    <Input
                      value={unitIds.join(',')}
                      readOnly
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">
                      IDs seleccionadas automáticamente: {unitIds.length} de {quantity} requeridas
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Motivo de la Garantía *</Label>
                  <Textarea
                    placeholder="Describe el problema o defecto del producto..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="discountStock"
                    checked={discountFromStock}
                    onCheckedChange={(checked) => setDiscountFromStock(checked as boolean)}
                  />
                  <label
                    htmlFor="discountStock"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Descontar del stock disponible
                  </label>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {discountFromStock
                    ? '⚠️ El stock se reducirá cuando se registre la garantía'
                    : 'ℹ️ El stock NO se modificará (útil para productos ya enviados)'
                  }
                </p>
              </>
            )}

            {/* Botones */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isLoading}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? 'Procesando...' : 'Registrar Garantía'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Selección de Productos */}
      <Dialog open={productSelectorOpen} onOpenChange={setProductSelectorOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Seleccionar Producto</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* Escáner de Código de Barras */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Barcode className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Escanea o escribe el código de barras..."
                  value={barcodeInput}
                  onChange={(e) => setBarcodeInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleBarcodeSearch();
                    }
                  }}
                  className="pl-10"
                  autoFocus
                />
              </div>
              <Button onClick={handleBarcodeSearch}>
                <Search className="h-4 w-4 mr-2" />
                Buscar
              </Button>
            </div>

            {/* Buscador Manual */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="O busca manualmente por nombre, código o categoría..."
                value={productSearchTerm}
                onChange={(e) => setProductSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Lista de productos */}
            <div className="flex-1 overflow-y-auto border border-border rounded-lg">
              {(() => {
                const filtered = products.filter(product => {
                  const search = productSearchTerm.toLowerCase();
                  return (
                    product.code.toLowerCase().includes(search) ||
                    product.name.toLowerCase().includes(search) ||
                    product.category.toLowerCase().includes(search)
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
                          handleSelectProduct(product.id);
                          setProductSelectorOpen(false);
                        }}
                        className="p-4 border border-border rounded-lg hover:border-green-500 dark:hover:border-green-600 hover:bg-green-50 dark:hover:bg-green-950/20 transition-all text-left group"
                      >
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

                        <h4 className="font-semibold text-base mb-1 line-clamp-2 group-hover:text-green-600 dark:group-hover:text-green-400">
                          {product.name}
                        </h4>

                        <p className="text-xs text-muted-foreground mb-3">{product.category}</p>

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

                          {product.use_unit_ids && product.registered_ids && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">IDs Disp:</span>
                              <span className="font-medium text-blue-600 dark:text-blue-400">
                                {product.registered_ids.length}
                              </span>
                            </div>
                          )}
                        </div>

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

            <p className="text-sm text-muted-foreground text-center">
              Mostrando {products.filter(p => {
                const search = productSearchTerm.toLowerCase();
                return p.code.toLowerCase().includes(search) ||
                  p.name.toLowerCase().includes(search) ||
                  p.category.toLowerCase().includes(search);
              }).length} de {products.length} productos
            </p>
          </div>

          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setProductSelectorOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Actualizar Estado */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Estado de Garantía</DialogTitle>
          </DialogHeader>

          {selectedWarranty && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-sm font-medium">{selectedWarranty.warranty_number}</p>
                <p className="text-xs text-muted-foreground mt-1">{selectedWarranty.product_name}</p>
              </div>

              <div className="space-y-2">
                <Label>Nuevo Estado</Label>
                <Select value={newStatus} onValueChange={(value: Warranty['status']) => setNewStatus(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="sent">Enviada</SelectItem>
                    <SelectItem value="returned">Devuelta</SelectItem>
                    <SelectItem value="resolved">Resuelta</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas del Cambio *</Label>
                <Textarea
                  placeholder="Describe el cambio de estado..."
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  rows={3}
                />
              </div>

              {newStatus === 'resolved' && selectedWarranty.discount_from_stock && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    ℹ️ Al marcar como "Resuelta", el producto se devolverá automáticamente al inventario.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)} disabled={isLoading}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateStatus} disabled={isLoading}>
                  {isLoading ? 'Actualizando...' : 'Actualizar'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
