import { useState, useEffect } from 'react';
import { RotateCcw, Search, Plus, X, AlertCircle, CheckCircle, Package, FileText, Calendar } from 'lucide-react';
import { 
  getInvoices, 
  getReturns, 
  addReturn, 
  getProducts,
  updateProduct,
  getCurrentUser,
  getCurrentCompany,
  type Invoice, 
  type Return 
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';

export function Returns() {
  const [returns, setReturns] = useState<Return[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isReturnDialogOpen, setIsReturnDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [returnType, setReturnType] = useState<'full' | 'partial'>('full');
  const [selectedItems, setSelectedItems] = useState<{ [key: string]: number }>({});
  const [returnReason, setReturnReason] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'full' | 'partial'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Estados para el modal de selección de facturas
  const [isInvoiceSelectorOpen, setIsInvoiceSelectorOpen] = useState(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoicePeriodFilter, setInvoicePeriodFilter] = useState<'today' | 'yesterday' | 'current_month' | 'last_month' | 'all'>('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [returnsData, invoicesData, productsData] = await Promise.all([
      getReturns(),
      getInvoices(),
      getProducts(),
    ]);
    setReturns(returnsData);
    setInvoices(invoicesData);
    setProducts(productsData);
  };

  // Obtener facturas elegibles para devolución (pagadas o con devolución parcial)
  const getEligibleInvoices = () => {
    return invoices.filter(inv => inv.status === 'paid' || inv.status === 'partial_return');
  };

  const handleOpenReturnDialog = () => {
    setSelectedInvoice(null);
    setReturnType('full');
    setSelectedItems({});
    setReturnReason('');
    setIsReturnDialogOpen(true);
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      // Inicializar cantidades seleccionadas con el máximo disponible
      const initialItems: { [key: string]: number } = {};
      invoice.items.forEach(item => {
        initialItems[item.productId] = item.quantity;
      });
      setSelectedItems(initialItems);
    }
  };

  const handleQuantityChange = (productId: string, quantity: number) => {
    setSelectedItems(prev => ({
      ...prev,
      [productId]: Math.max(0, quantity),
    }));
  };

  const calculateReturnTotal = () => {
    if (!selectedInvoice) return 0;
    
    if (returnType === 'full') {
      return selectedInvoice.total;
    } else {
      // Para devolución parcial, calcular subtotal + IVA proporcionalmente
      const returnSubtotal = selectedInvoice.items.reduce((sum, item) => {
        const quantity = selectedItems[item.productId] || 0;
        if (quantity > 0) {
          return sum + (item.price * quantity);
        }
        return sum;
      }, 0);
      
      // Calcular el IVA proporcionalmente
      let returnTax = 0;
      if (selectedInvoice.subtotal > 0) {
        const taxRate = selectedInvoice.tax / selectedInvoice.subtotal;
        returnTax = returnSubtotal * taxRate;
      }
      
      return returnSubtotal + returnTax;
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedInvoice) {
      toast.error('Debes seleccionar una factura');
      return;
    }

    if (!returnReason.trim()) {
      toast.error('Debes indicar un motivo para la devolución');
      return;
    }

    if (returnType === 'partial') {
      const hasSelectedItems = Object.values(selectedItems).some(qty => qty > 0);
      if (!hasSelectedItems) {
        toast.error('Debes seleccionar al menos un producto para devolver');
        return;
      }
    }

    try {
      setIsSubmitting(true);
      // Generar número de devolución
      const returnCount = returns.length + 1;
      const returnNumber = `DEV-${new Date().getFullYear()}-${returnCount.toString().padStart(4, '0')}`;

      // Preparar items de la devolución
      const returnItems = returnType === 'full'
        ? selectedInvoice.items
        : selectedInvoice.items
            .map(item => {
              const returnQuantity = selectedItems[item.productId] || 0;
              if (returnQuantity === 0) return null;
              
              // Si el producto usa IDs, tomar solo las primeras N IDs según cantidad devuelta
              let returnUnitIds: string[] = [];
              if (item.unitIds && item.unitIds.length > 0) {
                returnUnitIds = item.unitIds.slice(0, returnQuantity);
              }
              
              return {
                ...item,
                quantity: returnQuantity,
                total: item.price * returnQuantity,
                unitIds: returnUnitIds
              };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

      // Calcular subtotal y tax proporcionalmente
      let returnSubtotal = 0;
      let returnTax = 0;
      let returnTotal = 0;

      if (returnType === 'full') {
        returnSubtotal = selectedInvoice.subtotal;
        returnTax = selectedInvoice.tax;
        returnTotal = selectedInvoice.total;
      } else {
        // Para devolución parcial, calcular proporcionalmente
        const originalSubtotal = selectedInvoice.subtotal;
        const originalTotal = selectedInvoice.total;
        
        returnSubtotal = returnItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        // Calcular el IVA proporcionalmente
        if (originalSubtotal > 0) {
          const taxRate = selectedInvoice.tax / originalSubtotal;
          returnTax = returnSubtotal * taxRate;
        }
        
        returnTotal = returnSubtotal + returnTax;
      }

      // Crear devolución
      const currentUser = getCurrentUser();
      const company = getCurrentCompany();
      const newReturn: Omit<Return, 'id'> = {
        company,
        return_number: returnNumber,
        invoice_id: selectedInvoice.id,
        invoice_number: selectedInvoice.number,
        customer_name: selectedInvoice.customer_name,
        customer_document: selectedInvoice.customer_document,
        type: returnType,
        items: returnItems,
        subtotal: returnSubtotal,
        tax: returnTax,
        total: returnTotal,
        reason: returnReason,
        processed_by: currentUser?.username || 'unknown',
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      };

      await addReturn(newReturn);

      toast.success(`Devolución ${returnNumber} registrada correctamente`);
      setIsReturnDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Error al registrar devolución:', error);
      toast.error('Error al registrar la devolución');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset page cuando cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType]);

  // Filtrar facturas por período y búsqueda
  const getFilteredInvoicesForSelector = () => {
    let filtered = getEligibleInvoices();
    const now = new Date();
    
    // Filtrar por período
    if (invoicePeriodFilter !== 'all') {
      filtered = filtered.filter(invoice => {
        const invoiceDate = new Date(invoice.date);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        switch (invoicePeriodFilter) {
          case 'today':
            return invoiceDate >= today;
          case 'yesterday':
            return invoiceDate >= yesterday && invoiceDate < today;
          case 'current_month':
            return invoiceDate.getMonth() === now.getMonth() && 
                   invoiceDate.getFullYear() === now.getFullYear();
          case 'last_month': {
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            return invoiceDate >= lastMonth && invoiceDate < currentMonth;
          }
          default:
            return true;
        }
      });
    }
    
    // Filtrar por búsqueda
    if (invoiceSearchTerm.trim()) {
      filtered = filtered.filter(invoice =>
        invoice.number.toLowerCase().includes(invoiceSearchTerm.toLowerCase()) ||
        (invoice.customer_name?.toLowerCase() || '').includes(invoiceSearchTerm.toLowerCase())
      );
    }
    
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleOpenInvoiceSelector = () => {
    setInvoiceSearchTerm('');
    setInvoicePeriodFilter('all');
    setIsInvoiceSelectorOpen(true);
  };

  const handleSelectInvoiceFromModal = (invoice: Invoice) => {
    handleInvoiceSelect(invoice.id);
    setIsInvoiceSelectorOpen(false);
  };

  // Filtrar devoluciones
  const getFilteredReturns = () => {
    let filtered = returns;

    // Filtrar por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(ret => ret.type === filterType);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(ret =>
        ret.return_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ret.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        ret.reason.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const filteredReturns = getFilteredReturns();

  // Paginación
  const totalPages = Math.ceil(filteredReturns.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReturns = filteredReturns.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Devoluciones</h2>
          <p className="text-muted-foreground mt-1">Gestión de devoluciones de facturas</p>
        </div>
        <Button onClick={handleOpenReturnDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Devolución
        </Button>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">
              Total Devoluciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{returns.length}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700">
              Monto Devuelto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {formatCOP(returns.reduce((sum, ret) => sum + ret.total, 0))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700">
              Dev. Completas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700">
              {returns.filter(r => r.type === 'full').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700">
              Dev. Parciales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700">
              {returns.filter(r => r.type === 'partial').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por número, factura o motivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las devoluciones</SelectItem>
                <SelectItem value="full">Solo Devoluciones Completas</SelectItem>
                <SelectItem value="partial">Solo Devoluciones Parciales</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de devoluciones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-600" />
            Historial de Devoluciones
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-3 text-sm font-medium">Número</th>
                  <th className="text-left py-2 px-3 text-sm font-medium">Factura</th>
                  <th className="text-left py-2 px-3 text-sm font-medium">Tipo</th>
                  <th className="text-left py-2 px-3 text-sm font-medium">Fecha</th>
                  <th className="text-left py-2 px-3 text-sm font-medium">Motivo</th>
                  <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                  <th className="text-center py-2 px-3 text-sm font-medium">Productos</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReturns.map((ret) => (
                  <tr key={ret.id} className="border-b border-border hover:bg-muted/50">
                    <td className="py-3 px-3 text-sm font-medium">{ret.return_number}</td>
                    <td className="py-3 px-3 text-sm">{ret.invoice_number}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        ret.type === 'full'
                          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                      }`}>
                        {ret.type === 'full' ? 'Completa' : 'Parcial'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-sm">
                      {new Date(ret.date).toLocaleDateString('es-ES')}
                    </td>
                    <td className="py-3 px-3 text-sm max-w-xs truncate">{ret.reason}</td>
                    <td className="py-3 px-3 text-right text-sm font-bold text-red-600 dark:text-red-400">
                      {formatCOP(ret.total)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex flex-col gap-1">
                        {ret.items.map((item, idx) => (
                          <div key={idx} className="text-xs text-muted-foreground">
                            {item.productName} x{item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedReturns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      {searchTerm || filterType !== 'all'
                        ? 'No se encontraron devoluciones con los filtros aplicados'
                        : 'No hay devoluciones registradas'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1} - {Math.min(endIndex, filteredReturns.length)} de {filteredReturns.length} devoluciones
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
                      return <span key={page} className="px-2 text-muted-foreground">...</span>;
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

      {/* Dialog de nueva devolución */}
      <Dialog open={isReturnDialogOpen} onOpenChange={setIsReturnDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600" />
              Nueva Devolución
            </DialogTitle>
            <DialogDescription>
              Selecciona una factura y configura los detalles de la devolución
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Selección de factura */}
            <div className="space-y-2">
              <Label>Seleccionar Factura</Label>
              {selectedInvoice ? (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{selectedInvoice.number}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {selectedInvoice.customer_name || 'Sin nombre'} • {formatCOP(selectedInvoice.total)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleOpenInvoiceSelector}
                      >
                        Cambiar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full justify-start h-auto py-3"
                  onClick={handleOpenInvoiceSelector}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  <span>Selecciona una factura...</span>
                </Button>
              )}
            </div>

            {selectedInvoice && (
              <>
                {/* Información de factura */}
                <Card className="bg-muted/50">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="font-medium">Número:</span> {selectedInvoice.number}
                      </div>
                      <div>
                        <span className="font-medium">Cliente:</span> {selectedInvoice.customer_name || 'N/A'}
                      </div>
                      <div>
                        <span className="font-medium">Fecha:</span> {new Date(selectedInvoice.date).toLocaleDateString('es-ES')}
                      </div>
                      <div>
                        <span className="font-medium">Total:</span> {formatCOP(selectedInvoice.total)}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Tipo de devolución */}
                <div className="space-y-2">
                  <Label>Tipo de Devolución</Label>
                  <Select value={returnType} onValueChange={(value: any) => setReturnType(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full">Devolución Completa</SelectItem>
                      <SelectItem value="partial">Devolución Parcial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Productos (si es parcial) */}
                {returnType === 'partial' && (
                  <div className="space-y-2">
                    <Label>Productos a Devolver</Label>
                    <div className="border border-border rounded-lg p-4 space-y-3">
                      {selectedInvoice.items.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between gap-4 p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <p className="font-medium text-sm">{item.productName}</p>
                            <p className="text-xs text-muted-foreground">
                              Precio: {formatCOP(item.price)} | Cant. facturada: {item.quantity}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`qty-${item.productId}`} className="text-xs">Cantidad:</Label>
                            <Input
                              id={`qty-${item.productId}`}
                              type="number"
                              min="0"
                              max={item.quantity}
                              value={selectedItems[item.productId] || 0}
                              onChange={(e) => handleQuantityChange(item.productId, parseInt(e.target.value) || 0)}
                              className="w-20"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivo */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Motivo de la Devolución *</Label>
                  <Input
                    id="reason"
                    type="text"
                    placeholder="Ej: Producto defectuoso, Error en pedido, etc."
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                  />
                </div>

                {/* Total a devolver */}
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-red-700">Total a Devolver:</span>
                      <span className="text-2xl font-bold text-red-700">
                        {formatCOP(calculateReturnTotal())}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Advertencia */}
                <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div className="text-sm text-yellow-700">
                    <p className="font-medium">Importante:</p>
                    <p>El stock de los productos devueltos se reintegrará automáticamente al inventario.</p>
                  </div>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsReturnDialogOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleConfirmReturn}
              disabled={!selectedInvoice || !returnReason.trim() || isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Confirmar Devolución
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de selección de facturas */}
      <Dialog open={isInvoiceSelectorOpen} onOpenChange={setIsInvoiceSelectorOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Seleccionar Factura
            </DialogTitle>
            <DialogDescription>
              Busca y selecciona una factura para procesar la devolución
            </DialogDescription>
          </DialogHeader>

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 py-4">
            {/* Buscador */}
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Buscar por número o cliente..."
                value={invoiceSearchTerm}
                onChange={(e) => setInvoiceSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Filtros de período */}
            <Button
              variant={invoicePeriodFilter === 'today' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInvoicePeriodFilter('today')}
              className="text-xs"
            >
              Hoy
            </Button>
            <Button
              variant={invoicePeriodFilter === 'yesterday' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInvoicePeriodFilter('yesterday')}
              className="text-xs"
            >
              Ayer
            </Button>
            <Button
              variant={invoicePeriodFilter === 'current_month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInvoicePeriodFilter('current_month')}
              className="text-xs"
            >
              Mes Actual
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              variant={invoicePeriodFilter === 'last_month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInvoicePeriodFilter('last_month')}
              className="text-xs"
            >
              Mes Pasado
            </Button>
            <Button
              variant={invoicePeriodFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInvoicePeriodFilter('all')}
              className="text-xs md:col-span-2"
            >
              Todas las Facturas
            </Button>
          </div>

          {/* Lista de facturas */}
          <div className="flex-1 overflow-y-auto border border-border rounded-lg mt-4">
            <div className="space-y-2 p-4">
              {getFilteredInvoicesForSelector().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No se encontraron facturas</p>
                  <p className="text-sm mt-1">Intenta ajustar los filtros</p>
                </div>
              ) : (
                getFilteredInvoicesForSelector().map((invoice) => (
                  <Card
                    key={invoice.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors border-border"
                    onClick={() => handleSelectInvoiceFromModal(invoice)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            <span className="font-semibold">{invoice.number}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                              {invoice.invoice_type === 'regular' ? 'Regular' : 'Al Mayor'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Cliente:</span>{' '}
                              <span className="font-medium">{invoice.customer_name || 'Sin nombre'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Fecha:</span>{' '}
                              <span>{new Date(invoice.date).toLocaleDateString('es-ES')}</span>
                            </div>
                          </div>

                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Productos:</span>{' '}
                            {invoice.items.slice(0, 3).map(item => item.productName).join(', ')}
                            {invoice.items.length > 3 && ` +${invoice.items.length - 3} más`}
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <div className="text-xl font-bold text-primary">
                            {formatCOP(invoice.total)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {invoice.items.length} {invoice.items.length === 1 ? 'producto' : 'productos'}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsInvoiceSelectorOpen(false)}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}