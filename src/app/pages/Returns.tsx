import { useState, useEffect } from 'react';
import { RotateCcw, Search, Plus, X, AlertCircle, CheckCircle, Package, FileText, Calendar, Undo2 } from 'lucide-react';
import {
  getInvoices,
  getReturns,
  addReturn,
  revertReturn,
  getAllProducts,
  updateProduct,
  getCurrentUser,
  getCurrentCompany,
  searchProductsForInvoice,
  type Invoice,
  type Return,
  type Product,
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
  const [refundMethod, setRefundMethod] = useState('efectivo');
  const [mixedRefund, setMixedRefund] = useState({ efectivo: 0, transferencia: 0, nequi: 0, daviplata: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'full' | 'partial'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Estados para el modal de selección de facturas
  const [isInvoiceSelectorOpen, setIsInvoiceSelectorOpen] = useState(false);
  const [invoiceSearchTerm, setInvoiceSearchTerm] = useState('');
  const [invoicePeriodFilter, setInvoicePeriodFilter] = useState<'today' | 'yesterday' | 'current_month' | 'last_month' | 'all'>('all');

  // Estados para devolución sin factura
  const [isDirectReturnOpen, setIsDirectReturnOpen] = useState(false);
  const [directReturnProducts, setDirectReturnProducts] = useState<Array<{
    productId: string;
    productName: string;
    price: string;
    quantity: string;
    useUnitIds: boolean;
    disabledIds: Array<{ id: string; note?: string }>;
    unitIds: string[];
  }>>([]);
  const [directReturnReason, setDirectReturnReason] = useState('');
  const [directRefundMethod, setDirectRefundMethod] = useState('efectivo');
  const [directMixedRefund, setDirectMixedRefund] = useState({ efectivo: 0, transferencia: 0, nequi: 0, daviplata: 0 });
  const [isDirectProductSearchOpen, setIsDirectProductSearchOpen] = useState(false);
  const [directProductSearchTerm, setDirectProductSearchTerm] = useState('');
  const [directSearchedProducts, setDirectSearchedProducts] = useState<Product[]>([]);
  const [isSearchingDirect, setIsSearchingDirect] = useState(false);
  const [hasSearchedDirect, setHasSearchedDirect] = useState(false);
  const [isSubmittingDirect, setIsSubmittingDirect] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [returnsData, invoicesData, productsData] = await Promise.all([
      getReturns(),
      getInvoices(),
      getAllProducts(),
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
    setRefundMethod('efectivo');
    setMixedRefund({ efectivo: 0, transferencia: 0, nequi: 0, daviplata: 0 });
    setIsReturnDialogOpen(true);
  };

  const handleInvoiceSelect = (invoiceId: string) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (invoice) {
      setSelectedInvoice(invoice);
      // Inicializar cantidades seleccionadas con el máximo disponible
      // EXCLUIR productos que fueron cambiados (exchanged=true sin fromExchange=true)
      const initialItems: { [key: string]: number } = {};
      invoice.items.forEach(item => {
        // Solo incluir si NO fue cambiado, o si es un producto que vino de un cambio
        if (!item.exchanged || item.fromExchange) {
          initialItems[item.productId] = item.quantity;
        }
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
      // Para devolución completa, calcular solo con productos NO cambiados
      const validItems = selectedInvoice.items.filter(item => !item.exchanged || item.fromExchange);
      const returnSubtotal = validItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      // Calcular el IVA proporcionalmente
      let returnTax = 0;
      if (selectedInvoice.subtotal > 0) {
        const taxRate = selectedInvoice.tax / selectedInvoice.subtotal;
        returnTax = returnSubtotal * taxRate;
      }

      return returnSubtotal + returnTax;
    } else {
      // Para devolución parcial, calcular subtotal + IVA proporcionalmente
      const returnSubtotal = selectedInvoice.items
        .filter(item => !item.exchanged || item.fromExchange)
        .reduce((sum, item) => {
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

    if (refundMethod === 'mixto') {
      const mixedTotal = mixedRefund.efectivo + mixedRefund.transferencia + mixedRefund.nequi + mixedRefund.daviplata;
      const returnTotal = calculateReturnTotal();
      if (Math.abs(mixedTotal - returnTotal) > 1) {
        toast.error(`La suma del reembolso mixto (${formatCOP(mixedTotal)}) debe ser exactamente ${formatCOP(returnTotal)}`);
        return;
      }
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
      // EXCLUIR productos que fueron cambiados (exchanged=true sin fromExchange=true)
      const returnItems = returnType === 'full'
        ? selectedInvoice.items.filter(item => !item.exchanged || item.fromExchange)
        : selectedInvoice.items
            .filter(item => !item.exchanged || item.fromExchange)
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
        refund_method: refundMethod === 'mixto'
          ? `mixto:efectivo=${mixedRefund.efectivo},transferencia=${mixedRefund.transferencia},nequi=${mixedRefund.nequi},daviplata=${mixedRefund.daviplata}`
          : refundMethod,
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

  const handleRevertReturn = async (returnToRevert: Return) => {
    const confirmMessage = `¿Estás seguro de revertir la devolución ${returnToRevert.return_number}?\n\n` +
      `Esto devolverá los productos a la factura ${returnToRevert.invoice_number} y los restará del inventario.`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setIsReverting(true);
      const success = await revertReturn(returnToRevert.id);

      if (success) {
        toast.success('Devolución revertida exitosamente');
        await loadData();
      } else {
        toast.error('Error al revertir la devolución');
      }
    } catch (error) {
      console.error('Error al revertir devolución:', error);
      toast.error('Error al revertir la devolución');
    } finally {
      setIsReverting(false);
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

  // ── Devolución sin Factura ──────────────────────────────────────────────────

  const calculateDirectReturnTotal = () =>
    directReturnProducts.reduce((sum, p) => {
      const price = parseFloat(p.price) || 0;
      const qty = p.useUnitIds ? p.unitIds.length : (parseInt(p.quantity) || 0);
      return sum + price * qty;
    }, 0);

  const handleOpenDirectReturn = () => {
    setDirectReturnProducts([]);
    setDirectReturnReason('');
    setDirectRefundMethod('efectivo');
    setDirectMixedRefund({ efectivo: 0, transferencia: 0, nequi: 0, daviplata: 0 });
    setIsDirectReturnOpen(true);
  };

  const handleSearchDirectProducts = async () => {
    if (!directProductSearchTerm.trim()) {
      toast.error('Ingresa un término de búsqueda');
      return;
    }
    setIsSearchingDirect(true);
    try {
      const results = await searchProductsForInvoice(directProductSearchTerm);
      setDirectSearchedProducts(results);
      setHasSearchedDirect(true);
      if (results.length === 0) toast.info('No se encontraron productos');
    } catch {
      toast.error('Error al buscar productos');
    } finally {
      setIsSearchingDirect(false);
    }
  };

  const handleAddDirectProduct = (product: Product) => {
    if (directReturnProducts.find(p => p.productId === product.id)) {
      toast.error('Este producto ya está en la lista');
      return;
    }
    const disabledIds = (product.registered_ids || [])
      .filter((idObj: any) => idObj.disabled === true)
      .map((idObj: any) => ({ id: idObj.id, note: idObj.note || '' }));
    setDirectReturnProducts(prev => [
      ...prev,
      {
        productId: product.id,
        productName: product.name,
        price: '',
        quantity: '',
        useUnitIds: !!product.use_unit_ids,
        disabledIds,
        unitIds: [],
      },
    ]);
    setIsDirectProductSearchOpen(false);
    setDirectProductSearchTerm('');
    setDirectSearchedProducts([]);
    setHasSearchedDirect(false);
  };

  const handleToggleDirectUnitId = (productId: string, unitId: string) => {
    setDirectReturnProducts(prev => prev.map(p => {
      if (p.productId !== productId) return p;
      const already = p.unitIds.includes(unitId);
      const updated = already ? p.unitIds.filter(id => id !== unitId) : [...p.unitIds, unitId];
      return { ...p, unitIds: updated, quantity: String(updated.length || '') };
    }));
  };

  const handleRemoveDirectProduct = (productId: string) => {
    setDirectReturnProducts(prev => prev.filter(p => p.productId !== productId));
  };

  const handleUpdateDirectProduct = (productId: string, field: 'price' | 'quantity', value: string) => {
    setDirectReturnProducts(prev =>
      prev.map(p => p.productId === productId ? { ...p, [field]: value } : p)
    );
  };

  const handleConfirmDirectReturn = async () => {
    if (directReturnProducts.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    for (const p of directReturnProducts) {
      if (p.price === '' || p.price === undefined) {
        toast.error(`Ingresa el precio de: ${p.productName}`);
        return;
      }
      if (parseFloat(p.price) <= 0) {
        toast.error(`El precio de ${p.productName} debe ser mayor a 0`);
        return;
      }
      if (p.useUnitIds) {
        if (p.unitIds.length === 0) {
          toast.error(`Selecciona al menos una ID para: ${p.productName}`);
          return;
        }
      } else {
        if (p.quantity === '' || p.quantity === undefined) {
          toast.error(`Ingresa la cantidad de: ${p.productName}`);
          return;
        }
        if (parseInt(p.quantity) <= 0) {
          toast.error(`La cantidad de ${p.productName} debe ser mayor a 0`);
          return;
        }
      }
    }

    if (!directReturnReason.trim()) {
      toast.error('Ingresa el motivo de la devolución');
      return;
    }

    const total = calculateDirectReturnTotal();

    if (directRefundMethod === 'mixto') {
      const mixedTotal = directMixedRefund.efectivo + directMixedRefund.transferencia + directMixedRefund.nequi + directMixedRefund.daviplata;
      if (Math.abs(mixedTotal - total) > 1) {
        toast.error(`La suma del reembolso mixto (${formatCOP(mixedTotal)}) debe ser exactamente ${formatCOP(total)}`);
        return;
      }
    }

    const currentUser = getCurrentUser();

    setIsSubmittingDirect(true);
    try {
      const items = directReturnProducts.map(p => {
        const qty = p.useUnitIds ? p.unitIds.length : parseInt(p.quantity);
        return {
          productId: p.productId,
          productName: p.productName,
          price: parseFloat(p.price),
          quantity: qty,
          total: parseFloat(p.price) * qty,
          unitIds: p.useUnitIds ? p.unitIds : [],
        };
      });

      const refundMethodStr = directRefundMethod === 'mixto'
        ? `mixto:efectivo=${directMixedRefund.efectivo},transferencia=${directMixedRefund.transferencia},nequi=${directMixedRefund.nequi},daviplata=${directMixedRefund.daviplata}`
        : directRefundMethod;

      await addReturn({
        invoice_id: null as any,
        invoice_number: 'Sin Factura',
        customer_name: undefined,
        customer_document: undefined,
        type: 'partial',
        items,
        subtotal: total,
        tax: 0,
        total,
        reason: directReturnReason,
        refund_method: refundMethodStr,
        processed_by: currentUser?.username || 'unknown',
        date: new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString(),
      });

      toast.success('Devolución sin factura registrada correctamente');
      setIsDirectReturnOpen(false);
      await loadData();
    } catch {
      toast.error('Error al registrar la devolución');
    } finally {
      setIsSubmittingDirect(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleOpenDirectReturn}>
            <Plus className="h-4 w-4 mr-2" />
            Devolución sin Factura
          </Button>
          <Button onClick={handleOpenReturnDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Devolución
          </Button>
        </div>
      </div>

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
              Total Devoluciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700 dark:text-red-400">
              {(() => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const monday = new Date(now);
                monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                monday.setHours(0, 0, 0, 0);
                return returns.filter(ret => new Date(ret.date) >= monday).length;
              })()}
            </div>
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">Esta semana</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">
              Monto Devuelto
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">
              {(() => {
                const now = new Date();
                const dayOfWeek = now.getDay();
                const monday = new Date(now);
                monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                monday.setHours(0, 0, 0, 0);
                return formatCOP(
                  returns
                    .filter(ret => new Date(ret.date) >= monday)
                    .reduce((sum, ret) => sum + ret.total, 0)
                );
              })()}
            </div>
            <p className="text-xs text-red-500 dark:text-red-400 mt-1">Esta semana</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-purple-700 dark:text-purple-400">
              Dev. Completas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-700 dark:text-purple-400">
              {returns.filter(r => r.type === 'full').length}
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400">
              Dev. Parciales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">
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
            <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
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
                  <th className="text-center py-2 px-3 text-sm font-medium">Acciones</th>
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
                          ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-400 dark:text-red-300'
                          : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-400 dark:text-orange-300'
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
                          <div key={idx} className="text-xs">
                            <div className="text-muted-foreground">
                              {item.productName} x{item.quantity}
                            </div>
                            {item.unitIds && item.unitIds.length > 0 && (
                              <div className="text-blue-600 dark:text-blue-400 font-mono text-[10px] mt-0.5">
                                IDs: {item.unitIds.join(', ')}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevertReturn(ret)}
                        disabled={isReverting}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:text-blue-300 dark:hover:bg-blue-950"
                      >
                        <Undo2 className="w-4 h-4 mr-1" />
                        Revertir
                      </Button>
                    </td>
                  </tr>
                ))}
                {paginatedReturns.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-muted-foreground">
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
              <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
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
                      {selectedInvoice.items
                        .filter(item => !item.exchanged || item.fromExchange)
                        .map((item) => (
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

                {/* Método de reembolso */}
                <div className="space-y-2">
                  <Label>Método de Reembolso *</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {[
                      { value: 'efectivo', label: 'Efectivo', icon: '💵' },
                      { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
                      { value: 'nequi', label: 'Nequi', icon: '📱' },
                      { value: 'daviplata', label: 'Daviplata', icon: '💳' },
                      { value: 'mixto', label: 'Mixto', icon: '🔀' },
                    ].map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setRefundMethod(m.value)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                          refundMethod === m.value
                            ? 'border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                            : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <span className="text-lg">{m.icon}</span>
                        <span className="text-xs">{m.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Desglose mixto */}
                  {refundMethod === 'mixto' && (() => {
                    const total = calculateReturnTotal();
                    const assigned = mixedRefund.efectivo + mixedRefund.transferencia + mixedRefund.nequi + mixedRefund.daviplata;
                    const remaining = total - assigned;
                    const isExact = Math.abs(remaining) <= 1;
                    return (
                      <div className="mt-3 p-3 border-2 border-dashed border-red-200 dark:border-red-800 rounded-lg space-y-3">
                        <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Distribuir {formatCOP(total)}</div>
                        {([
                          { key: 'efectivo', label: 'Efectivo', icon: '💵' },
                          { key: 'transferencia', label: 'Transferencia', icon: '🏦' },
                          { key: 'nequi', label: 'Nequi', icon: '📱' },
                          { key: 'daviplata', label: 'Daviplata', icon: '💳' },
                        ] as const).map(({ key, label, icon }) => (
                          <div key={key} className="flex items-center gap-2">
                            <span className="w-6 text-center">{icon}</span>
                            <Label className="w-28 text-xs text-zinc-600 dark:text-zinc-400">{label}</Label>
                            <Input
                              type="number"
                              min={0}
                              value={mixedRefund[key] || ''}
                              placeholder="0"
                              onChange={(e) => setMixedRefund(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                              className="flex-1 h-8 text-sm"
                            />
                          </div>
                        ))}
                        <div className={`flex justify-between text-sm font-medium pt-1 border-t ${isExact ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          <span>Restante:</span>
                          <span>{isExact ? '✓ Completo' : formatCOP(remaining)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Total a devolver */}
                <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                  <CardContent className="pt-4">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-medium text-red-700 dark:text-red-400">Total a Devolver:</span>
                      <span className="text-2xl font-bold text-red-700 dark:text-red-400">
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
              disabled={!selectedInvoice || !returnReason.trim() || !refundMethod || isSubmitting}
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

      {/* ── Modal: Devolución sin Factura ─────────────────────────────────────── */}
      <Dialog open={isDirectReturnOpen} onOpenChange={setIsDirectReturnOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-red-600 dark:text-red-400" />
              Devolución sin Factura
            </DialogTitle>
            <DialogDescription>
              Registra una devolución casual sin necesidad de asociarla a una factura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Lista de productos */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Productos a Devolver</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDirectProductSearchTerm('');
                    setDirectSearchedProducts([]);
                    setHasSearchedDirect(false);
                    setIsDirectProductSearchOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar Producto
                </Button>
              </div>

              {directReturnProducts.length === 0 ? (
                <div className="border-2 border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No hay productos. Usa "Agregar Producto" para buscar.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {directReturnProducts.map((p) => {
                    const subtotal = (parseFloat(p.price) || 0) * (p.useUnitIds ? p.unitIds.length : (parseInt(p.quantity) || 0));
                    return (
                    <div key={p.productId} className="p-3 border rounded-lg bg-muted/40 space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{p.productName}</p>
                          {p.useUnitIds && (
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              🔢 IDs únicas — {p.unitIds.length} seleccionada(s)
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">Precio venta</Label>
                            <Input
                              type="number"
                              placeholder="0"
                              value={p.price}
                              onChange={(e) => handleUpdateDirectProduct(p.productId, 'price', e.target.value)}
                              className="w-28 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            />
                          </div>
                          {!p.useUnitIds && (
                            <div className="space-y-0.5">
                              <Label className="text-xs text-muted-foreground">Cantidad</Label>
                              <Input
                                type="number"
                                placeholder="0"
                                value={p.quantity}
                                onChange={(e) => handleUpdateDirectProduct(p.productId, 'quantity', e.target.value)}
                                className="w-20 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />
                            </div>
                          )}
                          <div className="space-y-0.5">
                            <Label className="text-xs text-muted-foreground">Subtotal</Label>
                            <div className="w-24 h-8 flex items-center text-sm font-semibold text-red-600 dark:text-red-400">
                              {formatCOP(subtotal)}
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveDirectProduct(p.productId)}
                            className="text-red-500 hover:text-red-700 mt-4"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* IDs únicas */}
                      {p.useUnitIds && (
                        <div className="pl-1 space-y-1">
                          <p className="text-xs text-muted-foreground">Selecciona las ID(s) que devuelve el cliente:</p>
                          {p.disabledIds.length === 0 ? (
                            <p className="text-xs text-amber-600 dark:text-amber-400">No hay IDs vendidas registradas para este producto</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {p.disabledIds.map((idObj) => {
                                const selected = p.unitIds.includes(idObj.id);
                                return (
                                  <button
                                    key={idObj.id}
                                    type="button"
                                    onClick={() => handleToggleDirectUnitId(p.productId, idObj.id)}
                                    className={`px-2.5 py-1 rounded-full text-xs font-mono border transition-colors ${
                                      selected
                                        ? 'bg-red-500 text-white border-red-500'
                                        : 'bg-muted text-muted-foreground border-border hover:border-red-400'
                                    }`}
                                  >
                                    #{idObj.id}{idObj.note ? ` (${idObj.note})` : ''}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="direct-reason">Motivo de la Devolución *</Label>
              <Input
                id="direct-reason"
                type="text"
                placeholder="Ej: Producto defectuoso, cambio de opinión, etc."
                value={directReturnReason}
                onChange={(e) => setDirectReturnReason(e.target.value)}
              />
            </div>

            {/* Método de reembolso */}
            <div className="space-y-2">
              <Label>Método de Reembolso *</Label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {[
                  { value: 'efectivo', label: 'Efectivo', icon: '💵' },
                  { value: 'transferencia', label: 'Transferencia', icon: '🏦' },
                  { value: 'nequi', label: 'Nequi', icon: '📱' },
                  { value: 'daviplata', label: 'Daviplata', icon: '💳' },
                  { value: 'mixto', label: 'Mixto', icon: '🔀' },
                ].map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setDirectRefundMethod(m.value)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                      directRefundMethod === m.value
                        ? 'border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-950/40 text-red-700 dark:text-red-400'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300'
                    }`}
                  >
                    <span className="text-lg">{m.icon}</span>
                    <span className="text-xs">{m.label}</span>
                  </button>
                ))}
              </div>

              {directRefundMethod === 'mixto' && (() => {
                const total = calculateDirectReturnTotal();
                const assigned = directMixedRefund.efectivo + directMixedRefund.transferencia + directMixedRefund.nequi + directMixedRefund.daviplata;
                const remaining = total - assigned;
                const isExact = Math.abs(remaining) <= 1;
                return (
                  <div className="mt-3 p-3 border-2 border-dashed border-red-200 dark:border-red-800 rounded-lg space-y-3">
                    <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Distribuir {formatCOP(total)}</div>
                    {([
                      { key: 'efectivo', label: 'Efectivo', icon: '💵' },
                      { key: 'transferencia', label: 'Transferencia', icon: '🏦' },
                      { key: 'nequi', label: 'Nequi', icon: '📱' },
                      { key: 'daviplata', label: 'Daviplata', icon: '💳' },
                    ] as const).map(({ key, label, icon }) => (
                      <div key={key} className="flex items-center gap-2">
                        <span className="w-6 text-center">{icon}</span>
                        <Label className="w-28 text-xs text-zinc-600 dark:text-zinc-400">{label}</Label>
                        <Input
                          type="number"
                          min={0}
                          value={directMixedRefund[key] || ''}
                          placeholder="0"
                          onChange={(e) => setDirectMixedRefund(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                          className="flex-1 h-8 text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </div>
                    ))}
                    <div className={`flex justify-between text-sm font-medium pt-1 border-t ${isExact ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      <span>Restante:</span>
                      <span>{isExact ? '✓ Completo' : formatCOP(remaining)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Total */}
            {directReturnProducts.length > 0 && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium text-red-700 dark:text-red-400">Total a Devolver:</span>
                    <span className="text-2xl font-bold text-red-700 dark:text-red-400">
                      {formatCOP(calculateDirectReturnTotal())}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
              <p className="text-sm text-yellow-700">
                El stock de los productos devueltos se reintegrará automáticamente al inventario.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDirectReturnOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDirectReturn}
              disabled={isSubmittingDirect}
              className="bg-red-600 hover:bg-red-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {isSubmittingDirect ? 'Registrando...' : 'Confirmar Devolución'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Búsqueda de productos para devolución directa ──────────────── */}
      <Dialog open={isDirectProductSearchOpen} onOpenChange={setIsDirectProductSearchOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Buscar Producto
            </DialogTitle>
            <DialogDescription>
              Busca el producto que el cliente devuelve
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 py-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                autoFocus
                placeholder="Buscar por nombre, código..."
                value={directProductSearchTerm}
                onChange={(e) => setDirectProductSearchTerm(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearchDirectProducts(); }}
                className="pl-10"
              />
            </div>
            <Button onClick={handleSearchDirectProducts} disabled={isSearchingDirect || !directProductSearchTerm.trim()}>
              {isSearchingDirect ? 'Buscando...' : 'Buscar'}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto border border-border rounded-lg min-h-[250px]">
            {!hasSearchedDirect ? (
              <div className="text-center py-16 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Escribe para buscar un producto</p>
                <p className="text-sm mt-1">Los resultados aparecerán aquí</p>
              </div>
            ) : directSearchedProducts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No se encontraron productos</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {directSearchedProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleAddDirectProduct(product)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/60 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-sm">{product.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{product.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                        {formatCOP(product.final_price)}
                      </p>
                      <p className="text-xs text-muted-foreground">Stock: {product.stock}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="mt-2">
            <Button type="button" variant="outline" onClick={() => setIsDirectProductSearchOpen(false)}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}