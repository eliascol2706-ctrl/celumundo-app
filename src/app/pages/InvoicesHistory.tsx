import {
  getInvoices,
  getColombiaDate,
  extractColombiaDate,
  extractColombiaDateTime,
  getCurrentCompany,
  getCreditPaymentsByInvoice,
  getReturns,
  getExchanges,
  getProducts,
  getExpenses,
  type CreditPayment,
  type Return,
  type Exchange
} from '../lib/supabase';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  CheckCircle,
  Calendar,
  Search,
  Eye,
  TrendingUp,
  FileText,
  Loader2,
  DollarSign,
  Printer,
  PiggyBank
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { jsPDF } from 'jspdf';
import { ThermalInvoicePrint } from '../components/ThermalInvoicePrint';

interface InvoiceItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  total: number;
  useUnitIds?: boolean;
  unitIds?: string[];
}

interface Invoice {
  id: string;
  company: 'celumundo' | 'repuestos';
  number: string;
  date: string;
  type: 'regular' | 'wholesale';
  customer_name?: string;
  customer_document?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled' | 'pending_confirmation';
  payment_method?: string;
  payment_note?: string;
  payment_cash?: number;
  payment_transfer?: number;
  payment_other?: number;
  attended_by?: string;
  is_credit?: boolean;
  credit_balance?: number;
  due_date?: string;
  created_at?: string;
  updated_at?: string;
}

type ModalType = 'paid' | 'credit' | null;

export function InvoicesHistory() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isThermalPrintDialogOpen, setIsThermalPrintDialogOpen] = useState(false);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);

  // Filtros para modales
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Ref para impresión térmica
  const thermalPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    setIsLoading(true);
    const [invoicesData, returnsData, exchangesData, productsData, expensesData] = await Promise.all([
      getInvoices(),
      getReturns(),
      getExchanges(),
      getProducts(),
      getExpenses()
    ]);
    setInvoices(invoicesData);
    setReturns(returnsData);
    setExchanges(exchangesData);
    setProducts(productsData);
    setExpenses(expensesData);
    setIsLoading(false);
  };

  // Calcular estadísticas
  const getStats = () => {
    const today = getColombiaDate(); // YYYY-MM-DD en zona Colombia
    const thisMonth = today.slice(0, 7); // YYYY-MM

    // Usar extractColombiaDate para comparaciones precisas
    const totalMonth = invoices.filter((inv) => {
      const invDate = extractColombiaDate(inv.date);
      return invDate.startsWith(thisMonth);
    }).length;

    const totalToday = invoices.filter((inv) => {
      const invDate = extractColombiaDate(inv.date);
      return invDate === today;
    }).length;

    const totalPaid = invoices.filter((inv) => inv.status === 'paid' && !inv.is_credit).length;
    const totalPending = invoices.filter((inv) => inv.status === 'pending_confirmation').length;
    const totalCredit = invoices.filter((inv) => inv.is_credit).length;

    // ==========================================
    // INGRESOS BRUTOS (Total Facturado)
    // ==========================================
    // Incluye TODAS las facturas excepto las completamente devueltas
    const ingresoBruto = invoices
      .filter((inv) => inv.status !== 'returned' && inv.status !== 'cancelled')
      .reduce((sum, inv) => sum + inv.total, 0);

    // ==========================================
    // INGRESOS NETOS (Efectivamente Ingresado)
    // ==========================================
    // Paso 1: Sumar facturas pagas (sin crédito pendiente)
    const facturasPagas = invoices
      .filter((inv) => inv.status === 'paid' && !inv.is_credit)
      .reduce((sum, inv) => sum + inv.total, 0);

    // Paso 2: Restar TODAS las devoluciones
    const totalDevoluciones = returns.reduce((sum, ret) => sum + ret.total, 0);

    // Paso 3: Calcular impacto de CAMBIOS
    // - Si price_difference > 0: El cliente pagó más (SUMA)
    // - Si price_difference < 0: Se le devolvió dinero (RESTA)
    // - Si price_difference === 0: No afecta ingresos
    const impactoCambios = exchanges.reduce((sum, exchange) => {
      if (exchange.price_difference > 0) {
        return sum + exchange.price_difference; // Cliente pagó diferencia
      } else if (exchange.price_difference < 0) {
        return sum + exchange.price_difference; // Se devolvió dinero (negativo)
      }
      return sum; // Sin impacto si es 0
    }, 0);

    // Cálculo final: Facturas Pagas - Devoluciones + Impacto de Cambios
    const ingresoNeto = facturasPagas - totalDevoluciones + impactoCambios;

    // ==========================================
    // GANANCIAS (Margen de Utilidad)
    // ==========================================
    // Paso 1: Calcular costos de productos vendidos en facturas pagas
    const facturasPagasList = invoices.filter((inv) => inv.status === 'paid' && !inv.is_credit);
    let totalCostos = 0;
    
    facturasPagasList.forEach((invoice) => {
      invoice.items.forEach((item) => {
        const product = products.find((p) => p.id === item.productId);
        if (product && product.current_cost) {
          totalCostos += product.current_cost * item.quantity;
        }
      });
    });

    // Paso 2: Calcular total de gastos
    const totalGastos = expenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Paso 3: Calcular ganancias
    // Ganancia = Ingresos Netos - Costos de Productos - Gastos
    const ganancias = ingresoNeto - totalCostos - totalGastos;

    return { 
      totalMonth, 
      totalToday, 
      totalPaid, 
      totalPending, 
      totalCredit, 
      ingresoBruto, 
      ingresoNeto,
      // Datos adicionales para tooltips/detalles
      totalDevoluciones,
      impactoCambios,
      // Ganancias
      ganancias,
      totalCostos,
      totalGastos
    };
  };

  // Filtrar facturas según el modal activo
  const getFilteredInvoices = (type: ModalType) => {
    if (!type) return [];

    let filtered = invoices;

    // Filtrar por tipo
    if (type === 'paid') {
      filtered = filtered.filter((inv) => inv.status === 'paid' && !inv.is_credit);
    } else if (type === 'credit') {
      filtered = filtered.filter((inv) => inv.is_credit);
    }

    // Filtrar por búsqueda
    if (searchTerm) {
      filtered = filtered.filter(
        (inv) =>
          inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (inv.customer_name && inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtrar por fecha
    if (dateFilter) {
      filtered = filtered.filter((inv) => inv.date.startsWith(dateFilter));
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const handleApproveInvoice = async (invoice: Invoice) => {
    if (isApproving) return;

    setIsApproving(true);
    try {
      // Confirmar el pago y actualizar la fecha al día de hoy
      await confirmInvoicePayment(invoice.id, {
        payment_method: 'Efectivo',
        payment_cash: invoice.total,
        payment_transfer: 0,
        payment_other: 0,
        update_date: true // ✅ Actualizar la fecha al día actual
      });

      // Actualizar inventario
      for (const item of invoice.items) {
        // Obtener el producto actual para tener el stock correcto
        const { data: productData } = await (await import('../lib/supabase')).supabase
          .from('products')
          .select('stock, registered_ids')
          .eq('id', item.productId)
          .single();

        if (productData) {
          const newStock = productData.stock - item.quantity;

          // Si usa IDs unitarios, remover los IDs vendidos
          let newRegisteredIds = productData.registered_ids || [];
          if (item.useUnitIds && item.unitIds && item.unitIds.length > 0) {
            newRegisteredIds = newRegisteredIds.filter((id: string) => !item.unitIds!.includes(id));
          }

          await updateProduct(item.productId, {
            stock: newStock,
            registered_ids: newRegisteredIds
          });

          // Registrar movimiento
          await addMovement({
            type: 'exit',
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            reason: `Venta aprobada - Factura ${invoice.number}`,
            reference: invoice.number,
            user_name: getCurrentUser()?.username || 'Usuario',
            unit_ids: item.useUnitIds ? item.unitIds : []
          });
        }
      }

      toast.success('Factura aprobada exitosamente');
      await loadInvoices();
    } catch (error) {
      console.error('Error approving invoice:', error);
      toast.error('Error al aprobar la factura');
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!confirm('¿Está seguro de eliminar esta factura?')) return;
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      await deleteInvoice(invoiceId);
      toast.success('Factura eliminada exitosamente');
      await loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('Error al eliminar la factura');
    } finally {
      setIsDeleting(false);
    }
  };

  const openModal = (type: ModalType) => {
    setActiveModal(type);
  };

  const closeModal = () => {
    setActiveModal(null);
    setSearchTerm('');
    setDateFilter('');
  };

  const viewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
  };

  const openPrintDialog = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    // Cargar pagos a crédito si es factura a crédito
    if (invoice.is_credit) {
      const payments = await getCreditPaymentsByInvoice(invoice.id);
      setCreditPayments(payments);
    } else {
      setCreditPayments([]);
    }
    setIsPrintDialogOpen(true);
  };

  const handlePrintPDF = () => {
    if (!selectedInvoice) return;

    const doc = new jsPDF();
    const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Factura ${selectedInvoice.number}`, pageWidth / 2, 30, { align: 'center' });
    
    // Info
    let y = 45;
    doc.setFontSize(10);
    doc.text(`Fecha: ${extractColombiaDateTime(selectedInvoice.date)}`, 20, y);
    y += 6;
    
    if (selectedInvoice.customer_name) {
      doc.text(`Cliente: ${selectedInvoice.customer_name}`, 20, y);
      y += 6;
    }
    
    if (selectedInvoice.customer_document) {
      doc.text(`Documento: ${selectedInvoice.customer_document}`, 20, y);
      y += 6;
    }
    
    if (selectedInvoice.attended_by) {
      doc.text(`Atendido por: ${selectedInvoice.attended_by}`, 20, y);
      y += 6;
    }
    
    y += 5;
    
    // Items
    doc.setFont('helvetica', 'bold');
    doc.text('Cant.', 20, y);
    doc.text('Producto', 40, y);
    doc.text('Precio', 130, y);
    doc.text('Total', 170, y);
    y += 2;
    doc.line(20, y, 190, y);
    y += 6;
    
    doc.setFont('helvetica', 'normal');
    selectedInvoice.items.forEach((item) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      doc.text(item.quantity.toString(), 20, y);
      const productName = item.productName.length > 40 ? item.productName.substring(0, 40) + '...' : item.productName;
      doc.text(productName, 40, y);
      doc.text(formatCOP(item.price), 130, y);
      doc.text(formatCOP(item.total), 170, y);
      y += 6;
    });
    
    y += 5;
    doc.line(20, y, 190, y);
    y += 8;
    
    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TOTAL: ${formatCOP(selectedInvoice.total)}`, pageWidth - 20, y, { align: 'right' });
    
    // Abrir para imprimir
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast.success('Abriendo vista de impresión PDF');
    setIsPrintDialogOpen(false);
  };

  const handleThermalPrint = () => {
    setIsPrintDialogOpen(false);
    setIsThermalPrintDialogOpen(true);
    
    // Esperar a que el modal se renderice
    setTimeout(() => {
      if (!thermalPrintRef.current) return;
      
      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';
      
      document.body.appendChild(printFrame);
      
      const printDocument = printFrame.contentWindow?.document;
      if (!printDocument) return;
      
      printDocument.open();
      printDocument.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Impresión Térmica</title>
          </head>
          <body>
            ${thermalPrintRef.current.innerHTML}
          </body>
        </html>
      `);
      printDocument.close();
      
      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
          setIsThermalPrintDialogOpen(false);
        }, 100);
      }, 500);
    }, 300);
  };

  const stats = getStats();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/facturacion')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Facturación
          </Button>

          <div>
            <h1 className="text-3xl font-semibold text-zinc-900">Historial de Facturas</h1>
            <p className="text-sm text-zinc-500 mt-1">
              Consulta y gestiona todas las facturas del sistema
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Facturas del Mes */}
          <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-sm font-medium text-zinc-600">Total del Mes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-900">{stats.totalMonth}</div>
              <p className="text-xs text-zinc-500 mt-1">Facturas este mes</p>
            </CardContent>
          </Card>

          {/* Total Facturas Hoy */}
          <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-sm font-medium text-zinc-600">Total Hoy</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-900">{stats.totalToday}</div>
              <p className="text-xs text-zinc-500 mt-1">Facturas de hoy</p>
            </CardContent>
          </Card>

          {/* Facturas Pagas */}
          <Card
            className="border-2 border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => openModal('paid')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <CardTitle className="text-sm font-medium text-zinc-600">Facturas Pagas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-zinc-900">{stats.totalPaid}</div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100"
              >
                Ver Detalles
              </Button>
            </CardContent>
          </Card>

          {/* Facturas a Cr��dito */}
          <Card
            className="border-2 border-blue-200 bg-blue-50/50 hover:bg-blue-50 shadow-sm hover:shadow-md transition-all cursor-pointer"
            onClick={() => openModal('credit')}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-sm font-medium text-blue-700">Facturas a Crédito</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-700">{stats.totalCredit}</div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-blue-700 hover:text-blue-800 hover:bg-blue-100"
              >
                Ver Detalles
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Ingresos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Ingresos Brutos */}
          <Card className="border-2 border-purple-200 bg-purple-50/50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-purple-600" />
                <CardTitle className="text-sm font-medium text-purple-700">Ingresos Brutos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-purple-600">{formatCOP(stats.ingresoBruto)}</div>
              <p className="text-xs text-zinc-500 mt-2">
                Incluye facturas pagas, en confirmación y a crédito
              </p>
              <div className="mt-3 pt-3 border-t border-purple-200">
                <p className="text-xs font-medium text-purple-700 mb-1">Cálculo:</p>
                <p className="text-xs text-zinc-600">
                  ✓ Todas las facturas activas<br/>
                  ✗ Excluye facturas devueltas o canceladas
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Ingresos Netos */}
          <Card className="border-2 border-emerald-200 bg-emerald-50/50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
                <CardTitle className="text-sm font-medium text-emerald-700">Ingresos Netos</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-emerald-600">{formatCOP(stats.ingresoNeto)}</div>
              <p className="text-xs text-zinc-500 mt-2">
                Ingresos reales después de devoluciones y cambios
              </p>
              <div className="mt-3 pt-3 border-t border-emerald-200 space-y-1">
                <p className="text-xs font-medium text-emerald-700">Desglose:</p>
                <div className="text-xs text-zinc-600 space-y-0.5">
                  <p>• Facturas pagas: {formatCOP(invoices.filter(inv => inv.status === 'paid' && !inv.is_credit).reduce((s, i) => s + i.total, 0))}</p>
                  {stats.totalDevoluciones > 0 && (
                    <p className="text-red-600">- Devoluciones: {formatCOP(stats.totalDevoluciones)}</p>
                  )}
                  {stats.impactoCambios !== 0 && (
                    <p className={stats.impactoCambios > 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {stats.impactoCambios > 0 ? '+' : '-'} Cambios: {formatCOP(Math.abs(stats.impactoCambios))}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cards de Ganancias */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* Ganancias */}
          <Card className="border-2 border-green-200 bg-green-50/50 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <PiggyBank className="w-6 h-6 text-green-600" />
                <CardTitle className="text-sm font-medium text-green-700">Ganancias</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-green-600">{formatCOP(stats.ganancias)}</div>
              <p className="text-xs text-zinc-500 mt-2">
                Margen de utilidad después de costos y gastos
              </p>
              <div className="mt-3 pt-3 border-t border-green-200 space-y-1">
                <p className="text-xs font-medium text-green-700">Desglose:</p>
                <div className="text-xs text-zinc-600 space-y-0.5">
                  <p>• Ingresos Netos: {formatCOP(stats.ingresoNeto)}</p>
                  <p className="text-red-600">- Costos de Productos: {formatCOP(stats.totalCostos)}</p>
                  <p className="text-red-600">- Gastos: {formatCOP(stats.totalGastos)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal de Facturas Pagas */}
      <Dialog open={activeModal === 'paid'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              Facturas Pagas
            </DialogTitle>
          </DialogHeader>

          {/* Filtros */}
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-200">
            <div>
              <Label>Buscar por Cliente o ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre del cliente o ID..."
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>Filtrar por Fecha</Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Lista de Facturas */}
          <div className="space-y-3">
            {getFilteredInvoices('paid').length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p>No se encontraron facturas pagas</p>
              </div>
            ) : (
              getFilteredInvoices('paid').map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-900">{invoice.number}</span>
                        <span className="text-sm text-zinc-500">{extractColombiaDateTime(invoice.date)}</span>
                        {invoice.customer_name && (
                          <span className="text-sm text-zinc-700 font-medium">
                            {invoice.customer_name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xl font-bold text-emerald-600">
                          {formatCOP(invoice.total)}
                        </span>
                        {invoice.payment_method && (
                          <span className="text-xs px-2 py-1 bg-zinc-200 text-zinc-700 rounded">
                            {invoice.payment_method}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => viewInvoice(invoice)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openPrintDialog(invoice)}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Facturas a Crédito */}
      <Dialog open={activeModal === 'credit'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CreditCard className="w-6 h-6 text-blue-600" />
              Facturas a Crédito
            </DialogTitle>
          </DialogHeader>

          {/* Filtros */}
          <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-200">
            <div>
              <Label>Buscar por Cliente o ID</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Nombre del cliente o ID..."
                  className="pl-9"
                />
              </div>
            </div>
            <div>
              <Label>Filtrar por Fecha</Label>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Lista de Facturas */}
          <div className="space-y-3">
            {getFilteredInvoices('credit').length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                <CreditCard className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p>No se encontraron facturas a crédito</p>
              </div>
            ) : (
              getFilteredInvoices('credit').map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-900">{invoice.number}</span>
                        <span className="text-sm text-zinc-500">{extractColombiaDateTime(invoice.date)}</span>
                        {invoice.customer_name && (
                          <span className="text-sm text-zinc-700 font-medium">
                            {invoice.customer_name}
                          </span>
                        )}
                        {invoice.status === 'pending' && (
                          <span className="text-xs px-2 py-1 bg-amber-200 text-amber-700 rounded">
                            Pendiente
                          </span>
                        )}
                        {invoice.status === 'paid' && (
                          <span className="text-xs px-2 py-1 bg-emerald-200 text-emerald-700 rounded">
                            Pagada
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xl font-bold text-blue-600">
                          {formatCOP(invoice.total)}
                        </span>
                        {invoice.credit_balance !== undefined && invoice.credit_balance > 0 && (
                          <span className="text-sm text-red-600 font-medium">
                            Saldo: {formatCOP(invoice.credit_balance)}
                          </span>
                        )}
                        {invoice.due_date && (
                          <span className="text-xs px-2 py-1 bg-zinc-200 text-zinc-700 rounded">
                            Vence: {invoice.due_date}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => viewInvoice(invoice)}>
                        <Eye className="w-4 h-4 mr-2" />
                        Ver
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openPrintDialog(invoice)}>
                        <Printer className="w-4 h-4 mr-2" />
                        Imprimir
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Vista de Factura */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">Factura {selectedInvoice?.number}</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 rounded-lg">
                <div>
                  <p className="text-xs text-zinc-500">Fecha y Hora</p>
                  <p className="font-medium">{extractColombiaDateTime(selectedInvoice.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Estado</p>
                  <p className="font-medium">
                    {selectedInvoice.status === 'paid'
                      ? 'Pagada'
                      : selectedInvoice.status === 'pending_confirmation'
                      ? 'En Confirmación'
                      : 'Pendiente'}
                  </p>
                </div>
                {selectedInvoice.customer_name && (
                  <div>
                    <p className="text-xs text-zinc-500">Cliente</p>
                    <p className="font-medium">{selectedInvoice.customer_name}</p>
                  </div>
                )}
                {selectedInvoice.customer_document && (
                  <div>
                    <p className="text-xs text-zinc-500">Documento</p>
                    <p className="font-medium">{selectedInvoice.customer_document}</p>
                  </div>
                )}
                {selectedInvoice.payment_method && (
                  <div>
                    <p className="text-xs text-zinc-500">Método de Pago</p>
                    <p className="font-medium">{selectedInvoice.payment_method}</p>
                  </div>
                )}
                {selectedInvoice.attended_by && (
                  <div>
                    <p className="text-xs text-zinc-500">Atendido por</p>
                    <p className="font-medium">{selectedInvoice.attended_by}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Productos</h3>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-zinc-50 rounded border border-zinc-200">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-zinc-500">Código: {item.productCode}</p>
                          <p className="text-sm text-zinc-600 mt-1">
                            {item.quantity} x {formatCOP(item.price)}
                          </p>
                        </div>
                        <p className="font-bold text-lg">{formatCOP(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200">
                <div className="flex justify-between text-2xl font-bold">
                  <span>Total:</span>
                  <span className="text-emerald-600">{formatCOP(selectedInvoice.total)}</span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
            {selectedInvoice && (
              <Button onClick={() => { setIsViewDialogOpen(false); openPrintDialog(selectedInvoice); }}>
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Selección de Tipo de Impresi��n */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Seleccionar Tipo de Impresión</DialogTitle>
            <DialogDescription>
              Elige el formato de impresión para la factura {selectedInvoice?.number}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              onClick={handlePrintPDF}
              className="h-24 flex flex-col gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <FileText className="w-8 h-8" />
              <span>PDF Carta</span>
              <span className="text-xs opacity-80">Tamaño estándar</span>
            </Button>
            <Button
              onClick={handleThermalPrint}
              className="h-24 flex flex-col gap-2 bg-emerald-600 hover:bg-emerald-700"
            >
              <Receipt className="w-8 h-8" />
              <span>Tirilla 80mm</span>
              <span className="text-xs opacity-80">Impresora térmica</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Vista Previa Impresión Térmica */}
      <Dialog open={isThermalPrintDialogOpen} onOpenChange={setIsThermalPrintDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vista Previa - Impresión Térmica</DialogTitle>
            <DialogDescription>
              Vista previa para impresora térmica SAT-22TUE de 80mm
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div ref={thermalPrintRef}>
              <ThermalInvoicePrint 
                invoice={selectedInvoice} 
                creditPayments={creditPayments}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}