import { useNavigate } from 'react-router';
import { Receipt, CreditCard, TrendingUp, DollarSign, Calendar, FileText, Clock, CheckCircle, Eye, Loader2, Banknote, ArrowRightLeft, RotateCcw, AlertTriangle, X, Trash2, Smartphone, Printer, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useEffect, useState, useRef } from 'react';
import { getInvoices, getColombiaDate, extractColombiaDate, extractColombiaDateTime, canCreateInvoice, type Invoice, getProducts, deleteInvoice, supabase, getCreditPaymentsByInvoice, type CreditPayment, getCurrentUser, getCurrentCompany } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { jsPDF } from 'jspdf';
import { ThermalInvoicePrint } from '../components/ThermalInvoicePrint';

export function InvoicesMenu() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    regularToday: 0,
    creditToday: 0,
    pendingConfirmation: 0,
    totalCreditPending: 0,
    totalSalesToday: 0,
    cashToday: 0,
    transferToday: 0
  });
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
  const [todayInvoices, setTodayInvoices] = useState<Invoice[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [mixedPayments, setMixedPayments] = useState({
    cash: 0,
    transfer: 0,
    other: 0
  });
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [showPrintSelectionModal, setShowPrintSelectionModal] = useState(false);
  const [showThermalPrintDialog, setShowThermalPrintDialog] = useState(false);
  const [printMethod, setPrintMethod] = useState<'pdf' | 'thermal'>('pdf');

  // Estados para filtros de facturas
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'currentMonth' | 'previousMonth' | 'all'>('today');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'otros' | 'mixto'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending_confirmation' | 'pending'>('all');

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [invoices, products] = await Promise.all([
        getInvoices(),
        getProducts()
      ]);
      
      // Obtener fecha actual en zona horaria de Colombia (GMT-5)
      const todayStr = getColombiaDate(); // YYYY-MM-DD en zona Colombia
      const thisMonth = todayStr.slice(0, 7); // YYYY-MM para comparar mes

      console.log('[InvoicesMenu] Calculando stats para fecha Colombia:', todayStr);

      // Filtrar facturas de HOY
      const invoicesToday = invoices.filter(inv => {
        const invoiceDate = extractColombiaDate(inv.date);
        return invoiceDate === todayStr;
      });

      // Filtrar solo facturas PAGADAS de hoy para calcular ganancias y métodos de pago
      const paidInvoicesToday = invoicesToday.filter(inv => inv.status === 'paid');

      // Contar facturas regulares de HOY (en zona horaria Colombia)
      const regularToday = invoicesToday.filter(inv => !inv.is_credit).length;

      // Contar facturas a crédito de HOY (en zona horaria Colombia)
      const creditToday = invoicesToday.filter(inv => inv.is_credit).length;

      // Calcular cartera pendiente (créditos sin pagar completamente)
      const totalCreditPending = invoices
        .filter(inv => inv.is_credit && inv.credit_balance && inv.credit_balance > 0)
        .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

      // Calcular TOTAL FACTURADO del día (solo facturas pagadas)
      const totalSalesToday = paidInvoicesToday.reduce((sum, inv) => {
        return sum + inv.total;
      }, 0);

      // Calcular pagos en EFECTIVO del día (solo facturas pagadas)
      const cashToday = paidInvoicesToday.reduce((sum, inv) => {
        return sum + (inv.payment_cash || 0);
      }, 0);

      // Calcular pagos por TRANSFERENCIA del día (transferencia + nequi + daviplata)
      const transferToday = paidInvoicesToday.reduce((sum, inv) => {
        // Sumar payment_transfer y payment_other (que incluye nequi, daviplata, etc)
        return sum + (inv.payment_transfer || 0) + (inv.payment_other || 0);
      }, 0);

      console.log('[InvoicesMenu] Stats calculadas:', {
        todayStr,
        regularToday,
        creditToday,
        totalCreditPending,
        totalSalesToday,
        cashToday,
        transferToday,
        invoicesToday: invoicesToday.length,
        paidInvoicesToday: paidInvoicesToday.length
      });

      setStats({
        regularToday,
        creditToday,
        pendingConfirmation: invoices.filter(inv => inv.status === 'pending_confirmation').length,
        totalCreditPending,
        totalSalesToday,
        cashToday,
        transferToday
      });

      // Cargar TODAS las facturas (no solo las de hoy) para los filtros
      setTodayInvoices(invoices);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para filtrar y ordenar facturas
  const getFilteredInvoices = () => {
    let filtered = [...todayInvoices];

    // Filtrar por periodo de tiempo
    if (periodFilter !== 'all') {
      const todayStr = getColombiaDate(); // YYYY-MM-DD
      const today = new Date(todayStr + 'T00:00:00-05:00');

      filtered = filtered.filter(inv => {
        const invDate = extractColombiaDate(inv.date);

        if (periodFilter === 'today') {
          return invDate === todayStr;
        } else if (periodFilter === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          return invDate === yesterdayStr;
        } else if (periodFilter === 'currentMonth') {
          const currentMonth = todayStr.slice(0, 7); // YYYY-MM
          return invDate.startsWith(currentMonth);
        } else if (periodFilter === 'previousMonth') {
          const currentDate = new Date(today);
          currentDate.setMonth(currentDate.getMonth() - 1);
          const previousMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM
          return invDate.startsWith(previousMonth);
        }
        return true;
      });
    }

    // Filtrar por búsqueda (número de factura o nombre del cliente)
    if (searchTerm) {
      filtered = filtered.filter(inv =>
        inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (inv.customer_name && inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filtrar por método de pago
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(inv => {
        const paymentStr = (inv.payment_method || '').toLowerCase();

        if (paymentFilter === 'mixto') {
          // Mixto: tiene ":" o "," (pago con múltiples métodos)
          return paymentStr.includes(':') || paymentStr.includes(',');
        } else if (paymentFilter === 'efectivo') {
          return paymentStr.includes('efectivo') && !paymentStr.includes(':') && !paymentStr.includes(',');
        } else if (paymentFilter === 'transferencia') {
          return paymentStr.includes('transferencia') && !paymentStr.includes(':') && !paymentStr.includes(',');
        } else if (paymentFilter === 'nequi') {
          return paymentStr.includes('nequi') && !paymentStr.includes(':') && !paymentStr.includes(',');
        } else if (paymentFilter === 'daviplata') {
          return paymentStr.includes('daviplata') && !paymentStr.includes(':') && !paymentStr.includes(',');
        } else if (paymentFilter === 'otros') {
          return paymentStr.includes('otros') && !paymentStr.includes(':') && !paymentStr.includes(',');
        }
        return true;
      });
    }

    // Filtrar por estado
    if (statusFilter !== 'all') {
      filtered = filtered.filter(inv => {
        if (statusFilter === 'paid') return inv.status === 'paid';
        if (statusFilter === 'pending_confirmation') return inv.status === 'pending_confirmation';
        if (statusFilter === 'pending') return inv.is_credit && inv.status === 'pending';
        return true;
      });
    }

    // Ordenar
    filtered.sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortBy === 'oldest') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      } else if (sortBy === 'highest') {
        return b.total - a.total;
      } else if (sortBy === 'lowest') {
        return a.total - b.total;
      }
      return 0;
    });

    return filtered;
  };

  const handleNavigateToRegular = async () => {
    setIsValidating(true);
    try {
      const validation = await canCreateInvoice();
      
      if (!validation.canCreate) {
        const toastMessage = validation.message || 'No se puede crear factura en este momento';
        const toastDuration = validation.requiresMonthlyClose ? 10000 : 8000;
        
        toast.error(toastMessage, {
          duration: toastDuration,
          action: {
            label: validation.requiresMonthlyClose ? '🔒 Realizar Cierre Mensual' : 'Ir a Cierres',
            onClick: () => navigate('/cierres')
          }
        });
        return;
      }

      navigate('/facturacion/regular');
    } catch (error) {
      console.error('Error validating invoice creation:', error);
      toast.error('Error al validar permisos de facturación');
    } finally {
      setIsValidating(false);
    }
  };

  const handleNavigateToCredit = async () => {
    setIsValidating(true);
    try {
      const validation = await canCreateInvoice();
      
      if (!validation.canCreate) {
        const toastMessage = validation.message || 'No se puede crear factura en este momento';
        const toastDuration = validation.requiresMonthlyClose ? 10000 : 8000;
        
        toast.error(toastMessage, {
          duration: toastDuration,
          action: {
            label: validation.requiresMonthlyClose ? '🔒 Realizar Cierre Mensual' : 'Ir a Cierres',
            onClick: () => navigate('/cierres')
          }
        });
        return;
      }

      navigate('/facturacion/credito');
    } catch (error) {
      console.error('Error validating invoice creation:', error);
      toast.error('Error al validar permisos de facturación');
    } finally {
      setIsValidating(false);
    }
  };

  const handleApproveInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentMethod('');
    setShowPaymentMethodModal(true);
  };

  const handleConfirmPaymentMethod = async () => {
    if (!selectedInvoice || !paymentMethod) {
      toast.error('Debe seleccionar un método de pago');
      return;
    }

    try {
      const user = getCurrentUser();
      const company = getCurrentCompany();

      if (!user) {
        toast.error('Sesión expirada. Por favor inicia sesión nuevamente.');
        return;
      }

      let paymentCash = 0;
      let paymentTransfer = 0;
      let paymentOther = 0;
      let paymentMethodStr = '';

      // Configurar los montos de pago según el método seleccionado
      if (paymentMethod === 'Efectivo') {
        paymentCash = selectedInvoice.total;
        paymentMethodStr = 'Efectivo';
      } else if (paymentMethod === 'Transferencia') {
        paymentTransfer = selectedInvoice.total;
        paymentMethodStr = 'Transferencia';
      } else if (paymentMethod === 'Nequi') {
        paymentOther = selectedInvoice.total;
        paymentMethodStr = 'Nequi';
      } else if (paymentMethod === 'Daviplata') {
        paymentOther = selectedInvoice.total;
        paymentMethodStr = 'Daviplata';
      } else if (paymentMethod === 'Mixto') {
        const totalMixed = mixedPayments.cash + mixedPayments.transfer + mixedPayments.other;
        if (Math.abs(totalMixed - selectedInvoice.total) > 0.01) {
          toast.error('La suma de los montos debe ser igual al total de la factura');
          return;
        }
        paymentCash = mixedPayments.cash;
        paymentTransfer = mixedPayments.transfer;
        paymentOther = mixedPayments.other;

        // Construir string detallado para mixto
        const methods = [];
        if (mixedPayments.cash > 0) methods.push(`Efectivo: ${formatCOP(mixedPayments.cash)}`);
        if (mixedPayments.transfer > 0) methods.push(`Transferencia: ${formatCOP(mixedPayments.transfer)}`);
        if (mixedPayments.other > 0) methods.push(`Otros: ${formatCOP(mixedPayments.other)}`);
        paymentMethodStr = methods.join(', ');
      }

      // Usar confirmInvoicePayment con update_date: true
      const { confirmInvoicePayment, updateProduct, addMovement } = await import('../lib/supabase');

      const result = await confirmInvoicePayment(selectedInvoice.id, {
        payment_method: paymentMethodStr,
        payment_cash: paymentCash,
        payment_transfer: paymentTransfer,
        payment_other: paymentOther,
        update_date: true // ✅ Actualizar la fecha al día actual
      });

      if (!result) {
        throw new Error('Error al confirmar el pago');
      }

      // Procesar inventario: reducir stock y eliminar IDs únicas
      for (const item of selectedInvoice.items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;

        const updates: any = {
          stock: product.stock - item.quantity
        };

        // Si el producto tiene IDs únicas, eliminar las que se vendieron
        if (item.unitIds && item.unitIds.length > 0 && product.registered_ids) {
          const remainingIds = product.registered_ids.filter(
            (idObj: any) => !item.unitIds.includes(idObj.id)
          );
          updates.registered_ids = remainingIds;
        }

        await updateProduct(product.id, updates);

        // Registrar movimiento de salida
        await addMovement({
          type: 'exit',
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          reason: 'Venta',
          reference: `Factura ${selectedInvoice.number}`,
          user_name: user.username,
          unit_ids: item.unitIds || [],
          unit_id_notes: {}
        });
      }

      toast.success('Factura aprobada exitosamente');
      setShowPaymentMethodModal(false);
      setShowPendingModal(false);
      setSelectedInvoice(null);
      setPaymentMethod('');
      setMixedPayments({ cash: 0, transfer: 0, other: 0 });
      loadStats();
    } catch (error) {
      console.error('Error al aprobar factura:', error);
      toast.error('Error al aprobar la factura');
    }
  };

  const handleDeleteInvoice = async (invoice: Invoice) => {
    if (!confirm(`¿Está seguro de eliminar la factura #${invoice.number}?`)) {
      return;
    }

    const result = await deleteInvoice(invoice.id);
    if (result) {
      toast.success('Factura eliminada exitosamente');
      setShowPendingModal(false);
      loadStats();
    } else {
      toast.error('Error al eliminar la factura');
    }
  };

  const handlePreviewInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPreviewModal(true);
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const doc = new jsPDF();
    const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Factura ${invoice.number}`, pageWidth / 2, 30, { align: 'center' });

    // Info
    let y = 45;
    doc.setFontSize(10);
    doc.text(`Fecha: ${extractColombiaDateTime(invoice.date)}`, 20, y);
    y += 6;

    if (invoice.customer_name) {
      doc.text(`Cliente: ${invoice.customer_name}`, 20, y);
      y += 6;
    }

    if (invoice.customer_document) {
      doc.text(`Documento: ${invoice.customer_document}`, 20, y);
      y += 6;
    }

    if (invoice.attended_by) {
      doc.text(`Atendido por: ${invoice.attended_by}`, 20, y);
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
    invoice.items.forEach((item) => {
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
    doc.text(`TOTAL: ${formatCOP(invoice.total)}`, pageWidth - 20, y, { align: 'right' });

    // Abrir para imprimir
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast.success('Abriendo vista de impresión PDF');
  };

  const handlePrintThermalInvoice = (invoice: Invoice) => {
    setShowThermalPrintDialog(true);

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
          setShowThermalPrintDialog(false);
        }, 100);
      }, 500);
    }, 300);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <div className="p-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Facturación</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">Seleccione el tipo de factura a crear</p>
          </div>
          
          {/* Botones de creación de facturas */}
          <div className="flex items-center gap-3">
            <Button
              onClick={handleNavigateToRegular}
              disabled={isValidating}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 mr-2" />
                  Factura Regular
                </>
              )}
            </Button>

            <Button
              onClick={handleNavigateToCredit}
              disabled={isValidating}
              className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 text-white"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Factura a Crédito
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Stats - Primera fila */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Regulares Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.regularToday}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Facturas regulares</p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Crédito Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.creditToday}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Facturas a crédito</p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Facturas en Confirmación</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.pendingConfirmation}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Pendientes de pago</p>
              {stats.pendingConfirmation > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const invoices = await getInvoices();
                    const pending = invoices.filter(inv => inv.status === 'pending_confirmation');
                    setPendingInvoices(pending);
                    setShowPendingModal(true);
                  }}
                  className="w-full mt-3 text-xs border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
                >
                  <Clock className="w-3 h-3 mr-1" />
                  Ver Facturas
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Cartera Pendiente</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{formatCOP(stats.totalCreditPending)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Por cobrar</p>
            </CardContent>
          </Card>
        </div>

        {/* Stats - Segunda fila (Ganancias y Métodos de Pago) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Total Facturado Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCOP(stats.totalSalesToday)}</div>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mt-1">Solo facturas pagadas</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
                <Banknote className="w-4 h-4" />
                Efectivo Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCOP(stats.cashToday)}</div>
              <p className="text-xs text-green-600 dark:text-green-500 mt-1">Pagos en efectivo</p>
            </CardContent>
          </Card>

          <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-violet-700 dark:text-violet-400 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4" />
                Transferencias Hoy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-violet-700 dark:text-violet-400">{formatCOP(stats.transferToday)}</div>
              <p className="text-xs text-violet-600 dark:text-violet-500 mt-1">Incluye Nequi, Daviplata</p>
            </CardContent>
          </Card>
        </div>

        {/* Facturas del día de hoy */}
        <div className="max-w-6xl mx-auto">
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader className="border-b border-zinc-200 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Facturas realizadas
                  <Badge variant="outline" className="ml-2 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                    {getFilteredInvoices().length} {getFilteredInvoices().length === 1 ? 'factura' : 'facturas'}
                  </Badge>
                </CardTitle>
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Buscar por número de factura o nombre del cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtros */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Filtro de Periodo */}
                <div>
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Periodo
                  </Label>
                  <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="yesterday">Ayer</SelectItem>
                      <SelectItem value="currentMonth">Mes Actual</SelectItem>
                      <SelectItem value="previousMonth">Mes Anterior</SelectItem>
                      <SelectItem value="all">Todas las Facturas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Ordenamiento */}
                <div>
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Filter className="w-3 h-3" />
                    Ordenar por
                  </Label>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="recent">Más recientes</SelectItem>
                      <SelectItem value="oldest">Más antiguas</SelectItem>
                      <SelectItem value="highest">Mayor a menor</SelectItem>
                      <SelectItem value="lowest">Menor a mayor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Método de Pago */}
                <div>
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                    <Banknote className="w-3 h-3" />
                    Método de pago
                  </Label>
                  <Select value={paymentFilter} onValueChange={(value: any) => setPaymentFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="nequi">Nequi</SelectItem>
                      <SelectItem value="daviplata">Daviplata</SelectItem>
                      <SelectItem value="otros">Otros</SelectItem>
                      <SelectItem value="mixto">Mixtos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtro de Estado */}
                <div>
                  <Label className="text-xs text-zinc-600 dark:text-zinc-400 mb-1.5 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Estado
                  </Label>
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="paid">Pagadas</SelectItem>
                      <SelectItem value="pending_confirmation">En confirmación</SelectItem>
                      <SelectItem value="pending">Pendiente por crédito</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Botón para limpiar filtros (opcional) */}
              {(searchTerm || periodFilter !== 'today' || sortBy !== 'recent' || paymentFilter !== 'all' || statusFilter !== 'all') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchTerm('');
                    setPeriodFilter('today');
                    setSortBy('recent');
                    setPaymentFilter('all');
                    setStatusFilter('all');
                  }}
                  className="text-xs"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                  <p>Cargando facturas...</p>
                </div>
              ) : getFilteredInvoices().length === 0 ? (
                <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-lg font-medium">No hay facturas</p>
                  <p className="text-sm mt-1">No se encontraron facturas con los filtros aplicados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Factura</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Cliente</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Tipo</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Total</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Método Pago</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Estado</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Fecha</th>
                        <th className="text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {getFilteredInvoices().map((invoice) => (
                        <tr 
                          key={invoice.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              #{invoice.number}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm text-zinc-900 dark:text-zinc-100">
                              {invoice.customer_name || 'Sin cliente'}
                            </div>
                            {invoice.customer_document && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                                {invoice.customer_document}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {invoice.is_credit ? (
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                                <CreditCard className="w-3 h-3 mr-1" />
                                Crédito
                              </Badge>
                            ) : invoice.type === 'wholesale' ? (
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                Al Mayor
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                                Regular
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-sm font-bold text-green-600 dark:text-green-400">
                              {formatCOP(invoice.total)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {invoice.payment_method ? (
                              <>
                                {invoice.payment_method.toLowerCase().includes('efectivo') ? (
                                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                                    <Banknote className="w-3 h-3 mr-1" />
                                    Efectivo
                                  </Badge>
                                ) : invoice.payment_method.toLowerCase().includes('transferencia') ? (
                                  <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800">
                                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                                    Transferencia
                                  </Badge>
                                ) : invoice.payment_method.toLowerCase().includes('nequi') ? (
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                                    Nequi
                                  </Badge>
                                ) : invoice.payment_method.toLowerCase().includes('daviplata') ? (
                                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                                    Daviplata
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 text-xs">
                                    {invoice.payment_method}
                                  </Badge>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-zinc-400 dark:text-zinc-600">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {invoice.status === 'paid' ? (
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Pagada
                              </Badge>
                            ) : invoice.status === 'returned' ? (
                              <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800">
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Devolución
                              </Badge>
                            ) : invoice.status === 'partial_return' ? (
                              <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                Devolución Parcial
                              </Badge>
                            ) : invoice.status === 'pending_confirmation' ? (
                              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Confirmación
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800">
                                <Clock className="w-3 h-3 mr-1" />
                                Pendiente
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {extractColombiaDateTime(invoice.date)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewInvoice(invoice)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (invoice.is_credit) {
                                    const payments = await getCreditPaymentsByInvoice(invoice.id);
                                    setCreditPayments(payments);
                                  }
                                  setSelectedInvoice(invoice);
                                  setShowPrintSelectionModal(true);
                                }}
                                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300"
                              >
                                <Printer className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Botón de Historial */}
          <div className="mt-6 text-center">
            <Button 
              variant="outline" 
              onClick={() => navigate('/facturacion/historial')}
              className="px-8 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 border-zinc-300 dark:border-zinc-700"
            >
              <FileText className="w-4 h-4 mr-2" />
              Historial Completo de Facturas
            </Button>
          </div>
        </div>
      </div>

      {/* Modal de Facturas Pendientes */}
      <Dialog open={showPendingModal} onOpenChange={setShowPendingModal}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              Facturas en Confirmación
              <Badge variant="outline" className="ml-2 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                {pendingInvoices.length} {pendingInvoices.length === 1 ? 'factura' : 'facturas'}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Gestione las facturas que están pendientes de confirmación de pago
            </DialogDescription>
          </DialogHeader>

          {pendingInvoices.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
              <Clock className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
              <p className="text-lg font-medium">No hay facturas pendientes</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingInvoices.map((invoice) => (
                <Card key={invoice.id} className="border-zinc-200 dark:border-zinc-800">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-lg font-mono font-bold text-zinc-900 dark:text-zinc-100">
                            #{invoice.number}
                          </span>
                          {invoice.type === 'wholesale' ? (
                            <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                              Al Mayor
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                              Regular
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400">
                          <span className="font-medium">Cliente:</span> {invoice.customer_name || 'Sin cliente'}
                          {invoice.customer_document && ` (${invoice.customer_document})`}
                        </div>
                        <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                          {formatCOP(invoice.total)}
                        </div>
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {new Date(invoice.date).toLocaleString('es-CO', {
                            timeZone: 'America/Bogota',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePreviewInvoice(invoice)}
                          className="border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Ver
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleApproveInvoice(invoice)}
                          className="border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950 text-green-700 dark:text-green-400"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Aprobar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteInvoice(invoice)}
                          className="border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950 text-red-700 dark:text-red-400"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Selección de Método de Pago */}
      <Dialog open={showPaymentMethodModal} onOpenChange={setShowPaymentMethodModal}>
        <DialogContent className="bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Seleccionar Método de Pago</DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Seleccione el método de pago con el que se recibió el pago de esta factura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-zinc-700 dark:text-zinc-300">Factura #{selectedInvoice?.number}</Label>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {selectedInvoice && formatCOP(selectedInvoice.total)}
              </div>
            </div>

            <div>
              <Label className="text-zinc-700 dark:text-zinc-300">Método de Pago</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                  <SelectValue placeholder="Seleccione un método" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                  <SelectItem value="Efectivo">Efectivo</SelectItem>
                  <SelectItem value="Transferencia">Transferencia</SelectItem>
                  <SelectItem value="Nequi">Nequi</SelectItem>
                  <SelectItem value="Daviplata">Daviplata</SelectItem>
                  <SelectItem value="Mixto">Mixto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {paymentMethod === 'Mixto' && (
              <div className="space-y-3 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
                <div>
                  <Label className="text-zinc-700 dark:text-zinc-300">Efectivo</Label>
                  <Input
                    type="number"
                    value={mixedPayments.cash}
                    onChange={(e) => setMixedPayments({ ...mixedPayments, cash: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <Label className="text-zinc-700 dark:text-zinc-300">Transferencia</Label>
                  <Input
                    type="number"
                    value={mixedPayments.transfer}
                    onChange={(e) => setMixedPayments({ ...mixedPayments, transfer: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                <div>
                  <Label className="text-zinc-700 dark:text-zinc-300">Otro (Nequi/Daviplata)</Label>
                  <Input
                    type="number"
                    value={mixedPayments.other}
                    onChange={(e) => setMixedPayments({ ...mixedPayments, other: parseFloat(e.target.value) || 0 })}
                    placeholder="0"
                    className="bg-white dark:bg-zinc-950 border-zinc-300 dark:border-zinc-700"
                  />
                </div>
                <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-600 dark:text-zinc-400">Total ingresado:</span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {formatCOP(mixedPayments.cash + mixedPayments.transfer + mixedPayments.other)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-zinc-600 dark:text-zinc-400">Faltante:</span>
                    <span className={`font-bold ${
                      selectedInvoice && (mixedPayments.cash + mixedPayments.transfer + mixedPayments.other) >= selectedInvoice.total
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}>
                      {selectedInvoice && formatCOP(selectedInvoice.total - (mixedPayments.cash + mixedPayments.transfer + mixedPayments.other))}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPaymentMethodModal(false);
                setPaymentMethod('');
                setMixedPayments({ cash: 0, transfer: 0, other: 0 });
              }}
              className="border-zinc-300 dark:border-zinc-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmPaymentMethod}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Preview de Factura */}
      <Dialog open={showPreviewModal} onOpenChange={setShowPreviewModal}>
        <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Vista Previa de Factura</DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-3xl font-mono font-bold text-zinc-900 dark:text-zinc-100">
                    #{selectedInvoice.number}
                  </div>
                  <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                    {new Date(selectedInvoice.date).toLocaleString('es-CO', {
                      timeZone: 'America/Bogota',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                {selectedInvoice.type === 'wholesale' ? (
                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800">
                    Al Mayor
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                    Regular
                  </Badge>
                )}
              </div>

              <div className="border-t border-b border-zinc-200 dark:border-zinc-800 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">Cliente</div>
                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{selectedInvoice.customer_name || 'Sin cliente'}</div>
                    {selectedInvoice.customer_document && (
                      <div className="text-sm text-zinc-600 dark:text-zinc-400">{selectedInvoice.customer_document}</div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400 uppercase">Total</div>
                    <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCOP(selectedInvoice.total)}
                    </div>
                  </div>
                </div>
              </div>

              {selectedInvoice.items && selectedInvoice.items.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Productos</div>
                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr>
                          <th className="text-left px-3 py-2 text-zinc-600 dark:text-zinc-400">Producto</th>
                          <th className="text-center px-3 py-2 text-zinc-600 dark:text-zinc-400">Cant.</th>
                          <th className="text-right px-3 py-2 text-zinc-600 dark:text-zinc-400">Precio</th>
                          <th className="text-right px-3 py-2 text-zinc-600 dark:text-zinc-400">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {selectedInvoice.items.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">
                              <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.productName || item.product_name || 'Sin nombre'}</div>
                              {item.productCode && (
                                <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.productCode}</div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300">{item.quantity}</td>
                            <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatCOP(item.price)}</td>
                            <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-100">{formatCOP(item.total || item.subtotal || (item.price * item.quantity))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 border-t border-zinc-200 dark:border-zinc-800 pt-4">
                    <div className="flex justify-between text-lg font-bold">
                      <span className="text-zinc-700 dark:text-zinc-300">Total:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(selectedInvoice.total)}</span>
                    </div>
                    {selectedInvoice.is_credit && selectedInvoice.credit_balance && selectedInvoice.credit_balance > 0 && (
                      <div className="flex justify-between text-sm mt-2">
                        <span className="text-zinc-600 dark:text-zinc-400">Saldo pendiente:</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">{formatCOP(selectedInvoice.credit_balance)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewModal(false)}
              className="border-zinc-300 dark:border-zinc-700"
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Selección de Método de Impresión */}
      <Dialog open={showPrintSelectionModal} onOpenChange={setShowPrintSelectionModal}>
        <DialogContent className="bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Seleccionar Método de Impresión</DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Elija el método de impresión para la factura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="text-zinc-700 dark:text-zinc-300">Factura #{selectedInvoice?.number}</Label>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {selectedInvoice && formatCOP(selectedInvoice.total)}
              </div>
            </div>

            <div>
              <Label className="text-zinc-700 dark:text-zinc-300">Método de Impresión</Label>
              <Select value={printMethod} onValueChange={setPrintMethod}>
                <SelectTrigger className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                  <SelectValue placeholder="Seleccione un método" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700">
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="thermal">Termal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPrintSelectionModal(false);
                setPrintMethod('pdf');
              }}
              className="border-zinc-300 dark:border-zinc-700"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (printMethod === 'pdf') {
                  handlePrintInvoice(selectedInvoice!);
                } else if (printMethod === 'thermal') {
                  handlePrintThermalInvoice(selectedInvoice!);
                }
                setShowPrintSelectionModal(false);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vista Previa Impresión Térmica */}
      <Dialog open={showThermalPrintDialog} onOpenChange={setShowThermalPrintDialog}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Vista Previa - Impresión Térmica</DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
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