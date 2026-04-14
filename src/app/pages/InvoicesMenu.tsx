import { useNavigate } from 'react-router';
import { Receipt, CreditCard, TrendingUp, DollarSign, Calendar, FileText, Clock, CheckCircle, Eye, Loader2, Banknote, ArrowRightLeft, RotateCcw, AlertTriangle, X, Trash2, Smartphone, Printer, Search, Filter, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useEffect, useState } from 'react';
import { getInvoices, getColombiaDate, extractColombiaDate, extractColombiaDateTime, canCreateInvoice, type Invoice, getProducts, deleteInvoice, supabase, getCreditPaymentsByInvoice, type CreditPayment, getCurrentUser, getCurrentCompany } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { jsPDF } from 'jspdf';

export function InvoicesMenu() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();
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
  const [products, setProducts] = useState<any[]>([]);
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
  const [showPrintSelectionModal, setShowPrintSelectionModal] = useState(false);
  const [printMethod, setPrintMethod] = useState<'pdf' | 'thermal'>('pdf');

  // Estados para filtros de facturas
  const [searchTerm, setSearchTerm] = useState('');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'currentMonth' | 'previousMonth' | 'all'>('today');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'highest' | 'lowest'>('recent');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'efectivo' | 'transferencia' | 'nequi' | 'daviplata' | 'otros' | 'mixto'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending_confirmation' | 'pending' | 'partial_return'>('all');

  // Estados para modal de impresión de factura recién creada
  const [showPrintOptionsModal, setShowPrintOptionsModal] = useState(false);
  const [newlyCreatedInvoice, setNewlyCreatedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  // Detectar factura recién creada
  useEffect(() => {
    const checkNewInvoice = () => {
      const savedInvoice = localStorage.getItem('lastCreatedInvoice');
      if (savedInvoice) {
        try {
          const invoice = JSON.parse(savedInvoice);
          setNewlyCreatedInvoice(invoice);
          setShowPrintOptionsModal(true);
          localStorage.removeItem('lastCreatedInvoice');
        } catch (error) {
          console.error('Error parsing saved invoice:', error);
        }
      }
    };

    checkNewInvoice();
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
      setProducts(products);
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
        if (statusFilter === 'partial_return') return inv.status === 'partial_return';
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

  const printThermalInvoice = async (invoice: Invoice, payments: CreditPayment[] = []) => {
    const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

    // Crear contenido HTML para la impresión térmica
    const thermalHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Factura ${invoice.number}</title>
          <style>
            @page {
              size: 80mm auto;
              margin: 0;
            }

            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }

            body {
              width: 80mm;
              font-family: 'Courier New', Courier, monospace;
              font-size: 12pt;
              padding: 4mm 3mm 6mm 3mm;
              background: white;
              color: black;
              line-height: 1.3;
            }

            .header {
              text-align: center;
              margin-bottom: 5mm;
              border-bottom: 2px dashed black;
              padding-bottom: 4mm;
            }

            .company-name {
              font-size: 18pt;
              font-weight: bold;
              margin-bottom: 2mm;
              letter-spacing: 1px;
            }

            .invoice-title {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 2mm;
            }

            .invoice-number {
              font-size: 13pt;
              font-weight: bold;
            }

            .info-section {
              margin-bottom: 5mm;
              font-size: 11pt;
              border-bottom: 1px dashed black;
              padding-bottom: 4mm;
            }

            .info-line {
              margin-bottom: 2mm;
            }

            .label {
              font-weight: bold;
            }

            .products-section {
              margin-bottom: 5mm;
              border-bottom: 2px dashed black;
              padding-bottom: 4mm;
            }

            .products-title {
              font-size: 13pt;
              font-weight: bold;
              text-align: center;
              margin-bottom: 3mm;
            }

            .product-item {
              margin-bottom: 4mm;
              font-size: 11pt;
            }

            .product-name {
              font-weight: bold;
              margin-bottom: 1.5mm;
              font-size: 12pt;
            }

            .product-details {
              margin-bottom: 1.5mm;
            }

            .product-ids {
              font-size: 10pt;
              margin-top: 2mm;
              padding: 2mm;
              background: #f5f5f5;
              border: 1px solid #ddd;
            }

            .total-section {
              margin-bottom: 5mm;
              font-size: 12pt;
            }

            .total-line {
              font-size: 15pt;
              font-weight: bold;
              border-top: 3px double black;
              padding-top: 3mm;
              margin-top: 2mm;
              display: flex;
              justify-content: space-between;
            }

            .payment-section {
              margin-bottom: 5mm;
              font-size: 11pt;
              border-bottom: 1px dashed black;
              padding-bottom: 4mm;
            }

            .payment-title {
              font-weight: bold;
              margin-bottom: 2mm;
              font-size: 12pt;
            }

            .payment-item {
              margin-bottom: 1.5mm;
            }

            .credit-section {
              margin-bottom: 5mm;
              font-size: 11pt;
              border-bottom: 1px dashed black;
              padding-bottom: 4mm;
            }

            .credit-title {
              font-weight: bold;
              text-align: center;
              margin-bottom: 3mm;
              font-size: 13pt;
            }

            .footer {
              text-align: center;
              font-size: 11pt;
              margin-top: 5mm;
              padding-top: 3mm;
              padding-bottom: 5mm;
            }

            .thank-you {
              font-weight: bold;
              margin-top: 3mm;
              margin-bottom: 3mm;
              font-size: 14pt;
            }

            .flex-between {
              display: flex;
              justify-content: space-between;
            }
          </style>
        </head>
        <body>
          <!-- Header -->
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div class="invoice-title">FACTURA DE VENTA</div>
            <div class="invoice-number">No. ${invoice.number}</div>
          </div>

          <!-- Info -->
          <div class="info-section">
            <div class="info-line">
              <span class="label">Cliente: </span>
              <span>${invoice.customer_name || 'Consumidor Final'}</span>
            </div>
            ${invoice.customer_document ? `
            <div class="info-line">
              <span class="label">Documento: </span>
              <span>${invoice.customer_document}</span>
            </div>
            ` : ''}
            <div class="info-line">
              <span class="label">Fecha: </span>
              <span>${new Date(invoice.date).toLocaleString('es-CO', {
                timeZone: 'America/Bogota',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            <div class="info-line">
              <span class="label">Tipo: </span>
              <span>${invoice.type === 'wholesale' ? 'Al Mayor' : 'Regular'}</span>
            </div>
            ${invoice.attended_by ? `
            <div class="info-line">
              <span class="label">Atendido: </span>
              <span>${invoice.attended_by}</span>
            </div>
            ` : ''}
          </div>

          <!-- Products -->
          <div class="products-section">
            <div class="products-title">PRODUCTOS</div>
            ${invoice.items.map((item: any) => `
              <div class="product-item">
                <div class="product-name">${item.productName}</div>
                <div class="product-details">
                  ${item.quantity} x ${formatCOP(item.price)} = ${formatCOP(item.total)}
                </div>
                ${item.unitIds && item.unitIds.length > 0 ? `
                  <div class="product-ids">
                    <div style="font-weight: bold; margin-bottom: 1mm;">IDs:</div>
                    <div>${item.unitIds.join(', ')}</div>
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>

          <!-- Total -->
          <div class="total-section">
            <div class="total-line">
              <span>TOTAL:</span>
              <span>${formatCOP(invoice.total)}</span>
            </div>
          </div>

          <!-- Payment Method -->
          ${invoice.payment_method ? `
          <div class="payment-section">
            <div class="payment-title">Método de Pago:</div>
            ${(invoice.payment_cash > 0 || invoice.payment_transfer > 0 || invoice.payment_other > 0) ? `
              ${invoice.payment_cash > 0 ? `<div class="payment-item">• Efectivo: ${formatCOP(invoice.payment_cash)}</div>` : ''}
              ${invoice.payment_transfer > 0 ? `<div class="payment-item">• Transferencia: ${formatCOP(invoice.payment_transfer)}</div>` : ''}
              ${invoice.payment_other > 0 ? `<div class="payment-item">• Otros: ${formatCOP(invoice.payment_other)}</div>` : ''}
            ` : `
              <div>${invoice.payment_method}</div>
            `}
          </div>
          ` : ''}

          <!-- Credit Section -->
          ${invoice.is_credit ? `
          <div class="credit-section">
            <div class="credit-title">FACTURA A CRÉDITO</div>

            ${payments && payments.length > 0 ? `
              <div style="font-weight: bold; margin-bottom: 2mm; font-size: 12pt;">Abonos:</div>
              ${payments.map((payment: any) => `
                <div style="margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 1px dotted #ccc;">
                  <div class="flex-between">
                    <span>${new Date(payment.date).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })}</span>
                    <span>${formatCOP(payment.amount)}</span>
                  </div>
                  <div style="font-size: 10pt; margin-top: 1mm;">
                    ${payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                  </div>
                </div>
              `).join('')}
              <div style="font-weight: bold; margin-top: 3mm; font-size: 12pt;">
                <div class="flex-between">
                  <span>Total Abonado:</span>
                  <span>${formatCOP(payments.reduce((sum: number, p: any) => sum + p.amount, 0))}</span>
                </div>
              </div>
            ` : ''}

            <div style="font-weight: bold; margin-top: 3mm; font-size: 12pt;">
              <div class="flex-between">
                <span>Saldo Pendiente:</span>
                <span>${formatCOP(invoice.credit_balance || invoice.total)}</span>
              </div>
            </div>
            <div style="margin-top: 2mm; font-size: 10pt;">
              Estado: ${invoice.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
            </div>
          </div>
          ` : ''}

          <!-- Footer -->
          <div class="footer">
            <div>================================</div>
            <div class="thank-you">¡GRACIAS POR SU COMPRA!</div>
            <div style="margin-top: 3mm; margin-bottom: 2mm; font-size: 12pt; font-weight: bold;">
              ${companyName}
            </div>
            <div style="margin-bottom: 2mm; font-size: 11pt;">
              www.celumundovip.com
            </div>
            <div style="font-size: 10pt; margin-top: 2mm; margin-bottom: 3mm;">
              ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}
            </div>
          </div>

          <!-- Espacio adicional para que la factura salga completa de la impresora -->
          <div style="height: 50mm;"></div>
        </body>
      </html>
    `;

    // Crear iframe oculto
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    printFrame.style.visibility = 'hidden';

    document.body.appendChild(printFrame);

    const printDocument = printFrame.contentWindow?.document;
    if (!printDocument) {
      toast.error('Error al preparar la impresión');
      document.body.removeChild(printFrame);
      return;
    }

    printDocument.open();
    printDocument.write(thermalHTML);
    printDocument.close();

    // Esperar a que se cargue el contenido y luego imprimir
    setTimeout(() => {
      printFrame.contentWindow?.focus();
      printFrame.contentWindow?.print();

      // Remover el iframe después de imprimir
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 1000);
    }, 500);
  };

  const handlePrintThermalDirect = async () => {
    if (!newlyCreatedInvoice) return;

    // Si la factura es a crédito, cargar los pagos
    let payments: CreditPayment[] = [];
    if (newlyCreatedInvoice.is_credit) {
      payments = await getCreditPaymentsByInvoice(newlyCreatedInvoice.id);
    }

    setShowPrintOptionsModal(false);
    await printThermalInvoice(newlyCreatedInvoice, payments);
  };

  const generatePDFInvoice = (invoice: Invoice, download: boolean = false) => {
    const doc = new jsPDF();
    const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

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
    doc.text(`Fecha: ${new Date(invoice.date).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })}`, 20, y);
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

    doc.text(`Tipo: ${invoice.type === 'wholesale' ? 'Al Mayor' : 'Regular'}`, 20, y);
    y += 6;

    if (invoice.is_credit) {
      doc.setTextColor(0, 100, 200);
      doc.setFont('helvetica', 'bold');
      doc.text('FACTURA A CRÉDITO', 20, y);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      y += 6;
    }

    y += 5;

    // Items Header
    doc.setFont('helvetica', 'bold');
    doc.text('Cant.', 20, y);
    doc.text('Producto', 40, y);
    doc.text('Precio', 130, y);
    doc.text('Total', 170, y);
    y += 2;
    doc.line(20, y, 190, y);
    y += 6;

    // Items
    doc.setFont('helvetica', 'normal');
    invoice.items.forEach((item) => {
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
      }

      doc.text(item.quantity.toString(), 20, y);
      const productName = item.productName.length > 40 ? item.productName.substring(0, 40) + '...' : item.productName;
      doc.text(productName, 40, y);
      doc.text(formatCOP(item.price), 130, y);
      doc.text(formatCOP(item.total), 170, y);
      y += 6;

      // Si tiene IDs únicos, mostrarlos
      if (item.unitIds && item.unitIds.length > 0) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        const idsText = 'IDs: ' + item.unitIds.join(', ');
        const maxWidth = 70;
        const lines = doc.splitTextToSize(idsText, maxWidth);
        lines.forEach((line: string) => {
          if (y > pageHeight - 40) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, 40, y);
          y += 4;
        });
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        y += 2;
      }
    });

    y += 5;
    doc.line(20, y, 190, y);
    y += 8;

    // Total
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TOTAL: ${formatCOP(invoice.total)}`, pageWidth - 20, y, { align: 'right' });

    // Métodos de pago
    if (invoice.payment_method) {
      y += 10;
      doc.setFontSize(12);
      doc.text('Método de Pago:', 20, y);
      y += 6;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      if (invoice.payment_cash > 0 || invoice.payment_transfer > 0 || invoice.payment_other > 0) {
        if (invoice.payment_cash > 0) {
          doc.text(`• Efectivo: ${formatCOP(invoice.payment_cash)}`, 20, y);
          y += 6;
        }
        if (invoice.payment_transfer > 0) {
          doc.text(`• Transferencia: ${formatCOP(invoice.payment_transfer)}`, 20, y);
          y += 6;
        }
        if (invoice.payment_other > 0) {
          doc.text(`• Otros: ${formatCOP(invoice.payment_other)}`, 20, y);
          y += 6;
        }
      } else {
        doc.text(invoice.payment_method, 20, y);
        y += 6;
      }
    }

    // Información de crédito
    if (invoice.is_credit && invoice.credit_balance !== undefined) {
      y += 5;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(200, 100, 0);
      doc.text(`Saldo Pendiente: ${formatCOP(invoice.credit_balance)}`, 20, y);
      doc.setTextColor(0, 0, 0);
    }

    // Footer
    y = pageHeight - 20;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(companyName, pageWidth / 2, y, { align: 'center' });
    doc.text('www.celumundovip.com', pageWidth / 2, y + 4, { align: 'center' });

    if (download) {
      // Descargar el PDF
      doc.save(`Factura_${invoice.number}.pdf`);
      toast.success('PDF descargado exitosamente');
    } else {
      // Abrir para imprimir
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      toast.success('Abriendo vista de impresión PDF');
    }
  };

  const handlePrintPDF = () => {
    if (!newlyCreatedInvoice) return;
    setShowPrintOptionsModal(false);
    generatePDFInvoice(newlyCreatedInvoice, false);
  };

  const handleDownloadPDF = () => {
    if (!newlyCreatedInvoice) return;
    setShowPrintOptionsModal(false);
    generatePDFInvoice(newlyCreatedInvoice, true);
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

      // ✅ Al aprobar una factura en confirmación:
      // - El stock YA fue restado cuando se creó la factura
      // - Las IDs únicas fueron INHABILITADAS (no eliminadas)
      // - Los movimientos NO fueron registrados
      //
      // Entonces ahora debemos:
      // 1. Marcar IDs como vendidas (disabled permanente, sin eliminar)
      // 2. Registrar los movimientos de salida
      for (const item of selectedInvoice.items) {
        const product = products.find(p => p.id === item.productId);
        if (!product) continue;

        // Si el producto usa IDs únicas, marcarlas como vendidas (no eliminar)
        if (item.unitIds && item.unitIds.length > 0 && product.registered_ids) {
          const { markIdsAsSold } = await import('../lib/unit-ids-utils');
          const newRegisteredIds = markIdsAsSold(product.registered_ids, item.unitIds);

          await updateProduct(product.id, {
            registered_ids: newRegisteredIds
          });
        }

        // Registrar movimiento de salida (no se registró cuando se creó la factura en confirmación)
        await addMovement({
          type: 'exit',
          product_id: product.id,
          product_name: product.name,
          quantity: item.quantity,
          reason: 'Venta',
          reference: `Factura ${selectedInvoice.number}`,
          user_name: user.username,
          unit_ids: item.unitIds || []
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <FileText className="w-5 h-5 flex-shrink-0" />
                  <span className="text-base sm:text-lg">Facturas realizadas</span>
                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800">
                    {getFilteredInvoices().length} {getFilteredInvoices().length === 1 ? 'factura' : 'facturas'}
                  </Badge>
                </CardTitle>
              </div>

              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Buscar factura o cliente..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 text-sm"
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
                      <SelectItem value="partial_return">Parcialmente devueltas</SelectItem>
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
                  className="text-xs w-full sm:w-auto"
                >
                  <X className="w-3 h-3 mr-1" />
                  Limpiar filtros
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="text-center py-8 sm:py-12 px-4 text-zinc-500 dark:text-zinc-400">
                  <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
                  <p className="text-sm sm:text-base">Cargando facturas...</p>
                </div>
              ) : getFilteredInvoices().length === 0 ? (
                <div className="text-center py-8 sm:py-12 px-4 text-zinc-500 dark:text-zinc-400">
                  <FileText className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-base sm:text-lg font-medium">No hay facturas</p>
                  <p className="text-xs sm:text-sm mt-1">No se encontraron facturas con los filtros aplicados</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px]">
                    <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                      <tr>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 whitespace-nowrap">Factura</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 whitespace-nowrap">Cliente</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 hidden lg:table-cell whitespace-nowrap">Tipo</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 whitespace-nowrap">Total</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 hidden md:table-cell whitespace-nowrap">Método Pago</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 whitespace-nowrap">Estado</th>
                        <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 hidden xl:table-cell whitespace-nowrap">Fecha</th>
                        <th className="text-center text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-2 sm:px-4 py-3 whitespace-nowrap">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {getFilteredInvoices().map((invoice) => (
                        <tr
                          key={invoice.id}
                          className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
                        >
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                            <span className="text-xs sm:text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                              #{invoice.number}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3">
                            <div className="text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate max-w-[150px] sm:max-w-none">
                              {invoice.customer_name || 'Sin cliente'}
                            </div>
                            {invoice.customer_document && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                                {invoice.customer_document}
                              </div>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                            {invoice.is_credit ? (
                              <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800 text-xs">
                                <CreditCard className="w-3 h-3 mr-1" />
                                Crédito
                              </Badge>
                            ) : invoice.type === 'wholesale' ? (
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs">
                                Al Mayor
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
                                Regular
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                            <span className="text-xs sm:text-sm font-bold text-green-600 dark:text-green-400">
                              {formatCOP(invoice.total)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 hidden md:table-cell whitespace-nowrap">
                            {invoice.payment_method ? (
                              <>
                                {invoice.payment_method.toLowerCase().includes('efectivo') ? (
                                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
                                    <Banknote className="w-3 h-3 mr-1" />
                                    Efectivo
                                  </Badge>
                                ) : invoice.payment_method.toLowerCase().includes('transferencia') ? (
                                  <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800 text-xs">
                                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                                    Transferencia
                                  </Badge>
                                ) : invoice.payment_method.toLowerCase().includes('nequi') ? (
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs">
                                    <ArrowRightLeft className="w-3 h-3 mr-1" />
                                    Nequi
                                  </Badge>
                                ) : invoice.payment_method.toLowerCase().includes('daviplata') ? (
                                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-xs">
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
                          <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
                            {invoice.status === 'paid' ? (
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Pagada</span>
                              </Badge>
                            ) : invoice.status === 'returned' ? (
                              <Badge variant="outline" className="bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 text-xs">
                                <RotateCcw className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Devolución</span>
                              </Badge>
                            ) : invoice.status === 'partial_return' ? (
                              <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800 text-xs">
                                <AlertTriangle className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Devolución Parcial</span>
                              </Badge>
                            ) : invoice.status === 'pending_confirmation' ? (
                              <Badge variant="outline" className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Confirmación</span>
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-800 text-xs">
                                <Clock className="w-3 h-3 mr-1" />
                                <span className="hidden sm:inline">Pendiente</span>
                              </Badge>
                            )}
                          </td>
                          <td className="px-2 sm:px-4 py-3 hidden xl:table-cell whitespace-nowrap">
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {extractColombiaDateTime(invoice.date)}
                            </span>
                          </td>
                          <td className="px-2 sm:px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex gap-1 justify-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePreviewInvoice(invoice)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 h-8 w-8 p-0"
                                title="Ver"
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
                                className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 h-8 w-8 p-0"
                                title="Imprimir"
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
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Detalles de la factura seleccionada
            </DialogDescription>
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
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0 z-10">
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
                              <td className="px-3 py-2 bg-white dark:bg-zinc-950">
                                <div className="font-medium text-zinc-900 dark:text-zinc-100">{item.productName || item.product_name || 'Sin nombre'}</div>
                                {item.productCode && (
                                  <div className="text-xs text-zinc-500 dark:text-zinc-400">{item.productCode}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950">{item.quantity}</td>
                              <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-950">{formatCOP(item.price)}</td>
                              <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-950">{formatCOP(item.total || item.subtotal || (item.price * item.quantity))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Métodos de Pago */}
                  {selectedInvoice.payment_method && (
                    <div className="mt-4 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 bg-zinc-50 dark:bg-zinc-900/50">
                      <div className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Métodos de Pago</div>
                      <div className="space-y-2">
                        {selectedInvoice.payment_cash !== undefined && selectedInvoice.payment_cash > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-xs">
                                <Banknote className="w-3 h-3 mr-1" />
                                Efectivo
                              </Badge>
                            </div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatCOP(selectedInvoice.payment_cash)}
                            </span>
                          </div>
                        )}
                        {selectedInvoice.payment_transfer !== undefined && selectedInvoice.payment_transfer > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-sky-50 dark:bg-sky-950 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800 text-xs">
                                <ArrowRightLeft className="w-3 h-3 mr-1" />
                                Transferencia
                              </Badge>
                            </div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatCOP(selectedInvoice.payment_transfer)}
                            </span>
                          </div>
                        )}
                        {selectedInvoice.payment_other !== undefined && selectedInvoice.payment_other > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800 text-xs">
                                <ArrowRightLeft className="w-3 h-3 mr-1" />
                                Nequi/Daviplata
                              </Badge>
                            </div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatCOP(selectedInvoice.payment_other)}
                            </span>
                          </div>
                        )}
                        {/* Fallback para facturas antiguas sin campos separados */}
                        {(!selectedInvoice.payment_cash && !selectedInvoice.payment_transfer && !selectedInvoice.payment_other) && selectedInvoice.payment_method && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 text-xs">
                                {selectedInvoice.payment_method}
                              </Badge>
                            </div>
                            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                              {formatCOP(selectedInvoice.total)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

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
              onClick={async () => {
                if (printMethod === 'pdf') {
                  generatePDFInvoice(selectedInvoice!, false);
                  setShowPrintSelectionModal(false);
                } else if (printMethod === 'thermal') {
                  // Cargar pagos de crédito si aplica
                  let payments: CreditPayment[] = [];
                  if (selectedInvoice!.is_credit) {
                    payments = await getCreditPaymentsByInvoice(selectedInvoice!.id);
                  }

                  setShowPrintSelectionModal(false);
                  await printThermalInvoice(selectedInvoice!, payments);
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Opciones de Impresión (Factura Recién Creada) */}
      <Dialog open={showPrintOptionsModal} onOpenChange={setShowPrintOptionsModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Factura Creada Exitosamente
            </DialogTitle>
            <DialogDescription>
              {newlyCreatedInvoice && `Factura #${newlyCreatedInvoice.number}`}
              <br />
              Selecciona una opción para continuar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Botón Imprimir PDF (A4) */}
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handlePrintPDF}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir PDF (Formato A4)
            </Button>

            {/* Botón Descargar PDF */}
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              onClick={handleDownloadPDF}
            >
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>

            {/* Botón Imprimir Tirilla */}
            <Button
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              onClick={handlePrintThermalDirect}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Tirilla (Térmica 80mm)
            </Button>

            {/* Botón Finalizar */}
            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setShowPrintOptionsModal(false)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}