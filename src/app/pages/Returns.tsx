import { useState, useEffect } from 'react';
import { RotateCcw, Search, Plus, X, AlertCircle, CheckCircle, Package } from 'lucide-react';
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
                {filteredReturns.map((ret) => (
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
                {filteredReturns.length === 0 && (
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
              <Select 
                value={selectedInvoice?.id || ''} 
                onValueChange={handleInvoiceSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una factura..." />
                </SelectTrigger>
                <SelectContent>
                  {getEligibleInvoices().map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.number} - {invoice.customer_name || 'Sin nombre'} - {formatCOP(invoice.total)} - {new Date(invoice.date).toLocaleDateString('es-ES')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
    </div>
  );
}