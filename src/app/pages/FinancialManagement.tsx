import {
  getInvoices,
  getColombiaDate,
  extractColombiaDate,
  extractColombiaDateTime,
  getCurrentCompany,
  getCreditPaymentsByInvoice,
  getReturns,
  getExchanges,
  getAllProducts,
  getExpenses,
  getCustomers,
  getWarranties,
  type CreditPayment,
  type Return,
  type Exchange,
  type Warranty
} from '../lib/supabase';
import { getServiceOrders, type ServiceOrder } from '../lib/service-orders';
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
  TrendingDown,
  FileText,
  Loader2,
  DollarSign,
  Printer,
  PiggyBank,
  BarChart3,
  Download,
  Users,
  ShoppingCart,
  Wallet,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { jsPDF } from 'jspdf';
import { ThermalInvoicePrint } from '../components/ThermalInvoicePrint';
import { printThermalInvoice as printThermalDirect } from '../lib/thermal-printer';
import { printPDFInvoice } from '../lib/pdf-printer';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

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

export function FinancialManagement() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [returns, setReturns] = useState<Return[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<Warranty[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isThermalPrintDialogOpen, setIsThermalPrintDialogOpen] = useState(false);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);

  // Estado para tabs y collapsibles
  const [activeTab, setActiveTab] = useState('tendencias');
  const [ingresosOpen, setIngresosOpen] = useState(false);
  const [egresosOpen, setEgresosOpen] = useState(false);
  const [cuentasPorCobrarOpen, setCuentasPorCobrarOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Estado para modal de desglose diario
  const [isDailyBreakdownOpen, setIsDailyBreakdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getColombiaDate());

  // Estado para modal de desglose de ingresos
  const [isIncomeBreakdownOpen, setIsIncomeBreakdownOpen] = useState(false);

  // Filtros para modales
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Ref para impresión térmica
  const thermalPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    const [invoicesData, returnsData, exchangesData, productsData, expensesData, customersData, warrantiesData, serviceOrdersData] = await Promise.all([
      getInvoices(),
      getReturns(),
      getExchanges(),
      getAllProducts(),
      getExpenses(),
      getCustomers(),
      getWarranties(),
      getServiceOrders()
    ]);
    setInvoices(invoicesData);
    setReturns(returnsData);
    setExchanges(exchangesData);
    setProducts(productsData);
    setExpenses(expensesData);
    setCustomers(customersData);
    setWarranties(warrantiesData);
    setServiceOrders(serviceOrdersData);
    setIsLoading(false);
  };

  // Calcular estadísticas con comparación de mes anterior
  const getStats = () => {
    const today = getColombiaDate();
    const thisMonth = today.slice(0, 7);

    // Calcular mes anterior
    const [year, month] = thisMonth.split('-').map(Number);
    const prevMonth = month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, '0')}`;

    const calculateMonthStats = (targetMonth: string) => {
      const monthInvoices = invoices.filter((inv) => {
        const invDate = extractColombiaDate(inv.date);
        return invDate.startsWith(targetMonth);
      });

      const monthReturns = returns.filter((ret) => {
        const retDate = extractColombiaDate(ret.date);
        return retDate.startsWith(targetMonth);
      });

      const monthExchanges = exchanges.filter((ex) => {
        const exDate = extractColombiaDate(ex.date);
        return exDate.startsWith(targetMonth);
      });

      const monthExpenses = expenses.filter((exp) => {
        const expDate = extractColombiaDate(exp.date);
        return expDate.startsWith(targetMonth);
      });

      // NUEVO: Filtrar órdenes de servicio pagadas del mes
      const monthServiceOrders = serviceOrders.filter((order) => {
        const orderDate = extractColombiaDate(order.received_date);
        return orderDate.startsWith(targetMonth) && order.payment_status === 'paid' && order.final_price;
      });

      // Incluir todas las facturas pagadas (regulares y crédito) + devoluciones parciales
      // Las facturas con status 'returned' ya están excluidas, no necesitamos restar devoluciones
      const facturasPagas = monthInvoices
        .filter((inv) => inv.status === 'paid' || inv.status === 'partial_return')
        .reduce((sum, inv) => sum + inv.total, 0);

      const totalDevoluciones = monthReturns.reduce((sum, ret) => sum + ret.total, 0);

      const impactoCambios = monthExchanges.reduce((sum, exchange) => {
        if (exchange.price_difference > 0) {
          return sum + exchange.price_difference;
        } else if (exchange.price_difference < 0) {
          return sum + exchange.price_difference;
        }
        return sum;
      }, 0);

      // NUEVO: Ingresos de servicio técnico
      const ingresosServicioTecnico = monthServiceOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);

      // No restamos totalDevoluciones porque las facturas 'returned' ya no se cuentan en facturasPagas
      // MODIFICADO: Incluir ingresos de servicio técnico
      const ingresoNeto = facturasPagas + impactoCambios + ingresosServicioTecnico;

      const facturasPagasList = monthInvoices.filter((inv) => inv.status === 'paid' || inv.status === 'partial_return');
      let totalCostos = 0;

      facturasPagasList.forEach((invoice) => {
        invoice.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (product && product.current_cost) {
            totalCostos += product.current_cost * item.quantity;
          }
        });
      });

      const totalGastos = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const ganancias = ingresoNeto - totalCostos - totalGastos;
      const margen = ingresoNeto > 0 ? (ganancias / ingresoNeto) * 100 : 0;

      return {
        ingresoNeto,
        totalGastos,
        ganancias,
        margen,
        totalCostos,
        totalDevoluciones,
        impactoCambios,
        facturasPagas,
        invoicesCount: monthInvoices.length,
        expenses: monthExpenses
      };
    };

    const currentMonth = calculateMonthStats(thisMonth);
    const previousMonth = calculateMonthStats(prevMonth);

    const ingresosChange = previousMonth.ingresoNeto > 0
      ? ((currentMonth.ingresoNeto - previousMonth.ingresoNeto) / previousMonth.ingresoNeto) * 100
      : 0;

    const gastosChange = previousMonth.totalGastos > 0
      ? ((currentMonth.totalGastos - previousMonth.totalGastos) / previousMonth.totalGastos) * 100
      : 0;

    const gananciasChange = previousMonth.ganancias > 0
      ? ((currentMonth.ganancias - previousMonth.ganancias) / previousMonth.ganancias) * 100
      : 0;

    return {
      currentMonth,
      previousMonth,
      ingresosChange,
      gastosChange,
      gananciasChange,
      thisMonth,
      prevMonth
    };
  };

  // Filtrar facturas según el modal activo
  const getFilteredInvoices = (type: ModalType) => {
    if (!type) return [];

    let filtered = invoices;

    if (type === 'paid') {
      filtered = filtered.filter((inv) => inv.status === 'paid' || inv.status === 'partial_return');
    } else if (type === 'credit') {
      filtered = filtered.filter((inv) => inv.is_credit);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (inv) =>
          inv.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (inv.customer_name && inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (dateFilter) {
      filtered = filtered.filter((inv) => inv.date.startsWith(dateFilter));
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
    if (invoice.is_credit) {
      const payments = await getCreditPaymentsByInvoice(invoice.id);
      setCreditPayments(payments);
    } else {
      setCreditPayments([]);
    }
    setIsPrintDialogOpen(true);
  };

  const handlePrintPDF = async () => {
    if (!selectedInvoice) return;

    try {
      // Cargar pagos de crédito si aplica
      let payments: CreditPayment[] = [];
      if (selectedInvoice.is_credit) {
        payments = await getCreditPaymentsByInvoice(selectedInvoice.id);
      }

      // Usar el nuevo servicio de impresión directa
      await printPDFInvoice({
        invoice: selectedInvoice,
        creditPayments: payments,
        products: products,
      });

      toast.success('Factura PDF impresa exitosamente');
      setIsPrintDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al imprimir factura');
    }
  };

  // DEPRECATED: Old jsPDF function
  const handlePrintPDF_OLD = () => {
    if (!selectedInvoice) return;

    const doc = new jsPDF();
    const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(companyName, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`Factura ${selectedInvoice.number}`, pageWidth / 2, 30, { align: 'center' });

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

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(`TOTAL: ${formatCOP(selectedInvoice.total)}`, pageWidth - 20, y, { align: 'right' });

    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast.success('Abriendo vista de impresión PDF');
    setIsPrintDialogOpen(false);
  };

  const handleThermalPrint = async () => {
    if (!selectedInvoice) return;

    try {
      // Cargar pagos de crédito si aplica
      let payments: CreditPayment[] = [];
      if (selectedInvoice.is_credit) {
        payments = await getCreditPaymentsByInvoice(selectedInvoice.id);
      }

      // Usar el nuevo servicio de impresión directa térmica
      await printThermalDirect({
        invoice: selectedInvoice,
        creditPayments: payments,
        products: products,
      });

      toast.success('Factura térmica impresa exitosamente');
      setIsPrintDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al imprimir factura');
    }
  };

  // DEPRECATED: Old iframe printing function
  const handleThermalPrint_OLD = () => {
    setIsPrintDialogOpen(false);
    setIsThermalPrintDialogOpen(true);

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

  // Calcular estadísticas de un día específico
  const getDailyStats = (date: string) => {
    // Filtrar facturas del día
    const dayInvoices = invoices.filter(inv => {
      const invDate = extractColombiaDate(inv.date);
      return invDate === date && (inv.status === 'paid' || inv.status === 'partial_return');
    });

    // Filtrar gastos del día
    const dayExpenses = expenses.filter(exp => {
      const expDate = extractColombiaDate(exp.date);
      return expDate === date;
    });

    // Filtrar cambios del día
    const dayExchanges = exchanges.filter(ex => {
      const exDate = extractColombiaDate(ex.date);
      return exDate === date;
    });

    // NUEVO: Filtrar órdenes de servicio pagadas del día
    const dayServiceOrders = serviceOrders.filter(order => {
      const orderDate = extractColombiaDate(order.received_date);
      return orderDate === date && order.payment_status === 'paid' && order.final_price;
    });

    // Calcular ingresos
    const facturasPagas = dayInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const impactoCambios = dayExchanges.reduce((sum, exchange) => {
      if (exchange.price_difference > 0) {
        return sum + exchange.price_difference;
      } else if (exchange.price_difference < 0) {
        return sum + exchange.price_difference;
      }
      return sum;
    }, 0);

    // NUEVO: Ingresos de servicio técnico
    const ingresosServicioTecnico = dayServiceOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);

    // MODIFICADO: Incluir ingresos de servicio técnico
    const ingresosNetos = facturasPagas + impactoCambios + ingresosServicioTecnico;

    // Calcular costos de productos
    let costos = 0;
    dayInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product && product.current_cost) {
          costos += product.current_cost * item.quantity;
        }
      });
    });

    // Calcular gastos
    const gastos = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calcular ganancias
    const ganancias = ingresosNetos - costos - gastos;

    return {
      invoices: dayInvoices,
      ingresosNetos,
      gastos,
      costos,
      ganancias,
      facturasPagas,
      impactoCambios
    };
  };

  const handleExportReport = () => {
    setIsExporting(true);
    try {
      const doc = new jsPDF();
      const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
      const pageWidth = doc.internal.pageSize.getWidth();
      const stats = getStats();
      const topListsData = getTopLists();

      // Header
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(companyName, pageWidth / 2, 20, { align: 'center' });

      doc.setFontSize(14);
      doc.text('Reporte Financiero', pageWidth / 2, 28, { align: 'center' });

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}`, pageWidth / 2, 35, { align: 'center' });

      let y = 45;

      // Overview Financiero
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Overview Financiero', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Ingresos del Mes: ${formatCOP(stats.currentMonth.ingresoNeto)}`, 20, y);
      y += 6;
      doc.text(`Gastos del Mes: ${formatCOP(stats.currentMonth.totalGastos)}`, 20, y);
      y += 6;
      doc.text(`Ganancias Netas: ${formatCOP(stats.currentMonth.ganancias)}`, 20, y);
      y += 6;
      doc.text(`Margen de Ganancia: ${stats.currentMonth.margen.toFixed(1)}%`, 20, y);
      y += 10;

      // Comparación con mes anterior
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.text(`Ingresos vs mes anterior: ${stats.ingresosChange >= 0 ? '+' : ''}${stats.ingresosChange.toFixed(1)}%`, 20, y);
      y += 5;
      doc.text(`Gastos vs mes anterior: ${stats.gastosChange >= 0 ? '+' : ''}${stats.gastosChange.toFixed(1)}%`, 20, y);
      y += 5;
      doc.text(`Ganancias vs mes anterior: ${stats.gananciasChange >= 0 ? '+' : ''}${stats.gananciasChange.toFixed(1)}%`, 20, y);
      y += 12;

      // Desglose Financiero
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Desglose Financiero', 20, y);
      y += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Facturas Pagas: ${formatCOP(stats.currentMonth.facturasPagas)}`, 25, y);
      y += 6;
      if (stats.currentMonth.impactoCambios !== 0) {
        doc.text(`Impacto de Cambios: ${stats.currentMonth.impactoCambios > 0 ? '+' : ''}${formatCOP(stats.currentMonth.impactoCambios)}`, 25, y);
        y += 6;
      }
      doc.text(`Costos de Productos: ${formatCOP(stats.currentMonth.totalCostos)}`, 25, y);
      y += 6;
      doc.text(`Gastos Operativos: ${formatCOP(stats.currentMonth.totalGastos)}`, 25, y);
      y += 12;

      // Top 5 Gastos
      if (topListsData.topExpenses.length > 0) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Top 5 Gastos del Mes', 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        topListsData.topExpenses.forEach((expense: any, idx: number) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${idx + 1}. ${expense.description} - ${formatCOP(expense.amount)}`, 25, y);
          y += 5;
        });
        y += 7;
      }

      // Top 5 Facturas
      if (topListsData.topInvoices.length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Top 5 Facturas Más Grandes', 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        topListsData.topInvoices.forEach((invoice: any, idx: number) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          const customerName = invoice.customer_name || 'Cliente general';
          doc.text(`${idx + 1}. ${invoice.number} - ${customerName} - ${formatCOP(invoice.total)}`, 25, y);
          y += 5;
        });
        y += 7;
      }

      // Top 5 Clientes
      if (topListsData.topCustomers.length > 0) {
        if (y > 240) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Top 5 Mejores Clientes', 20, y);
        y += 8;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        topListsData.topCustomers.forEach((customer: any, idx: number) => {
          if (y > 270) {
            doc.addPage();
            y = 20;
          }
          doc.text(`${idx + 1}. ${customer.name} - ${customer.count} compras - ${formatCOP(customer.total)}`, 25, y);
          y += 5;
        });
      }

      // Footer en cada página
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Página ${i} de ${pageCount}`, pageWidth / 2, 285, { align: 'center' });
        doc.text(`Generado con Gestión de Finanzas - ${companyName}`, pageWidth / 2, 290, { align: 'center' });
      }

      // Generar nombre de archivo con fecha
      const fileName = `Reporte_Financiero_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);

      toast.success('Reporte exportado exitosamente');
    } catch (error) {
      console.error('Error al exportar reporte:', error);
      toast.error('Error al generar el reporte');
    } finally {
      setIsExporting(false);
    }
  };

  // Get chart data
  const getChartData = () => {
    const stats = getStats();

    // Data for tendencias (last 6 months)
    const last6Months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const monthInvoices = invoices.filter(inv => extractColombiaDate(inv.date).startsWith(monthStr));
      const monthExpenses = expenses.filter(exp => extractColombiaDate(exp.date).startsWith(monthStr));
      const monthExchanges = exchanges.filter(ex => extractColombiaDate(ex.date).startsWith(monthStr));

      // Incluir todas las facturas pagadas (regulares y crédito) + devoluciones parciales
      const paidInvoices = monthInvoices.filter(inv => inv.status === 'paid' || inv.status === 'partial_return');
      const facturasPagas = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

      // Calcular impacto de cambios del mes
      const impactoCambios = monthExchanges.reduce((sum, exchange) => {
        if (exchange.price_difference > 0) {
          return sum + exchange.price_difference;
        } else if (exchange.price_difference < 0) {
          return sum + exchange.price_difference;
        }
        return sum;
      }, 0);

      const ingresos = facturasPagas + impactoCambios;

      const gastos = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

      // Calcular costos de productos vendidos en el mes
      let costos = 0;
      paidInvoices.forEach(invoice => {
        invoice.items.forEach(item => {
          const product = products.find(p => p.id === item.productId);
          if (product && product.current_cost) {
            costos += product.current_cost * item.quantity;
          }
        });
      });

      last6Months.push({
        month: date.toLocaleDateString('es-CO', { month: 'short' }),
        ingresos,
        gastos,
        ganancias: ingresos - gastos - costos
      });
    }

    // Payment methods data - incluir todas las facturas pagadas
    const paymentMethodsData = [
      {
        name: 'Efectivo',
        value: invoices
          .filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && inv.payment_cash)
          .reduce((sum, inv) => sum + (inv.payment_cash || 0), 0)
      },
      {
        name: 'Transferencia',
        value: invoices
          .filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && inv.payment_transfer)
          .reduce((sum, inv) => sum + (inv.payment_transfer || 0), 0)
      },
      {
        name: 'Otros',
        value: invoices
          .filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && inv.payment_other)
          .reduce((sum, inv) => sum + (inv.payment_other || 0), 0)
      }
    ].filter(item => item.value > 0);

    // Expenses by category
    const expenseCategories = stats.currentMonth.expenses.reduce((acc: any, exp: any) => {
      const category = exp.category || 'Sin categoría';
      acc[category] = (acc[category] || 0) + exp.amount;
      return acc;
    }, {});

    const expensesChartData = Object.entries(expenseCategories).map(([name, value]) => ({
      name,
      value: value as number
    }));

    return {
      tendencias: last6Months,
      paymentMethods: paymentMethodsData,
      expenseCategories: expensesChartData
    };
  };

  // Get top lists data
  const getTopLists = () => {
    const stats = getStats();

    // Top 5 expenses
    const topExpenses = stats.currentMonth.expenses
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 5);

    // Top 5 largest invoices - solo facturas que generaron ingresos
    const topInvoices = invoices
      .filter(inv =>
        extractColombiaDate(inv.date).startsWith(stats.thisMonth) &&
        (inv.status === 'paid' || inv.status === 'partial_return')
      )
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Top 5 customers by purchase amount
    const customerTotals = invoices
      .filter(inv =>
        extractColombiaDate(inv.date).startsWith(stats.thisMonth) &&
        (inv.status === 'paid' || inv.status === 'partial_return') &&
        inv.customer_document
      )
      .reduce((acc: any, inv) => {
        const doc = inv.customer_document!;
        if (!acc[doc]) {
          acc[doc] = {
            document: doc,
            name: inv.customer_name || 'Cliente sin nombre',
            total: 0,
            count: 0
          };
        }
        acc[doc].total += inv.total;
        acc[doc].count += 1;
        return acc;
      }, {});

    const topCustomers = Object.values(customerTotals)
      .sort((a: any, b: any) => b.total - a.total)
      .slice(0, 5);

    return {
      topExpenses,
      topInvoices,
      topCustomers
    };
  };

  const stats = getStats();
  const chartData = getChartData();
  const topLists = getTopLists();
  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          {/* Título animado */}
          <h2 className="text-2xl font-semibold text-zinc-700 mb-8 animate-pulse">
            Estructurando y Analizando
          </h2>

          {/* Grid de barras animadas simulando datos */}
          <div className="flex gap-2 justify-center mb-8">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <div
                key={index}
                className="w-3 bg-emerald-600 rounded-full"
                style={{
                  height: '80px',
                  animation: `barAnimation 1.5s ease-in-out ${index * 0.15}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Indicadores de progreso */}
          <div className="space-y-3 max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>Procesando facturas</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 rounded-full animate-[progressBar_2s_ease-in-out_infinite]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600 animate-pulse" style={{ animationDelay: '0.3s' }} />
                <span>Calculando ingresos</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full animate-[progressBar_2s_ease-in-out_0.3s_infinite]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-600">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600 animate-pulse" style={{ animationDelay: '0.6s' }} />
                <span>Generando estadísticas</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 rounded-full animate-[progressBar_2s_ease-in-out_0.6s_infinite]" />
              </div>
            </div>
          </div>

          {/* Animación de spinner circular de respaldo */}
          <div className="mt-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 opacity-50" />
          </div>

          {/* Estilos CSS inline para las animaciones */}
          <style>{`
            @keyframes barAnimation {
              0%, 100% {
                transform: scaleY(0.3);
                opacity: 0.4;
              }
              50% {
                transform: scaleY(1);
                opacity: 1;
              }
            }

            @keyframes progressBar {
              0% {
                width: 0%;
              }
              50% {
                width: 100%;
              }
              100% {
                width: 0%;
              }
            }
          `}</style>
        </div>
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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900">Gestión de Finanzas</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Panel de control financiero y análisis de rendimiento
              </p>
            </div>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleExportReport}
              disabled={isExporting}
            >
              <Download className="w-4 h-4 mr-2" />
              {isExporting ? 'Generando...' : 'Exportar Reporte'}
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {/* Section 1: Overview Financiero */}
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">Overview Financiero</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Ingresos del Mes */}
            <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600">Ingresos del Mes</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900">{formatCOP(stats.currentMonth.ingresoNeto)}</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200 space-y-1">
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Facturas pagas</span>
                    <span className="font-medium">{formatCOP(stats.currentMonth.facturasPagas)}</span>
                  </div>
                  {stats.currentMonth.impactoCambios !== 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-600">Impacto cambios</span>
                      <span className={`font-medium ${stats.currentMonth.impactoCambios > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {stats.currentMonth.impactoCambios > 0 ? '+' : ''}{formatCOP(stats.currentMonth.impactoCambios)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {stats.ingresosChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${stats.ingresosChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stats.ingresosChange >= 0 ? '+' : ''}{stats.ingresosChange.toFixed(1)}%
                  </span>
                  <span className="text-xs text-zinc-500">vs mes anterior</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setIsIncomeBreakdownOpen(true)}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Desglose
                </Button>
              </CardContent>
            </Card>

            {/* Gastos del Mes */}
            <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600">Gastos del Mes</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-red-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900">{formatCOP(stats.currentMonth.totalGastos)}</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200">
                  <div className="text-xs text-zinc-500">
                    Gastos operativos del mes
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {stats.gastosChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-red-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                  )}
                  <span className={`text-sm font-medium ${stats.gastosChange >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {stats.gastosChange >= 0 ? '+' : ''}{stats.gastosChange.toFixed(1)}%
                  </span>
                  <span className="text-xs text-zinc-500">vs mes anterior</span>
                </div>
              </CardContent>
            </Card>

            {/* Ganancias Netas */}
            <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600">Ganancias Netas</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900">{formatCOP(stats.currentMonth.ganancias)}</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600">Ingresos</span>
                    <span className="font-medium text-emerald-600">+{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600">Costos productos</span>
                    <span className="font-medium text-red-600">-{formatCOP(stats.currentMonth.totalCostos)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600">Gastos operativos</span>
                    <span className="font-medium text-red-600">-{formatCOP(stats.currentMonth.totalGastos)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {stats.gananciasChange >= 0 ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${stats.gananciasChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {stats.gananciasChange >= 0 ? '+' : ''}{stats.gananciasChange.toFixed(1)}%
                  </span>
                  <span className="text-xs text-zinc-500">vs mes anterior</span>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3"
                  onClick={() => setIsDailyBreakdownOpen(true)}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Desglosar ganancias
                </Button>
              </CardContent>
            </Card>

            {/* Margen de Ganancia */}
            <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600">Margen de Ganancia</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-purple-600" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900">{stats.currentMonth.margen.toFixed(1)}%</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200 space-y-1">
                  <div className="text-xs text-zinc-500">
                    Fórmula: (Ganancias / Ingresos) × 100
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Ganancias</span>
                    <span className="font-medium">{formatCOP(stats.currentMonth.ganancias)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600">
                    <span>Ingresos</span>
                    <span className="font-medium">{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {stats.currentMonth.margen >= stats.previousMonth.margen ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${stats.currentMonth.margen >= stats.previousMonth.margen ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(stats.currentMonth.margen - stats.previousMonth.margen).toFixed(1)}pts
                  </span>
                  <span className="text-xs text-zinc-500">vs mes anterior</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 2: Análisis Visual */}
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-lg">Análisis Visual</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tendencias">Tendencias</TabsTrigger>
                <TabsTrigger value="metodos">Métodos de Pago</TabsTrigger>
                <TabsTrigger value="gastos">Categorías de Gastos</TabsTrigger>
              </TabsList>

              <TabsContent value="tendencias" className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData.tendencias}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatCOP(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="ingresos" stroke="#10b981" strokeWidth={2} name="Ingresos" />
                    <Line type="monotone" dataKey="gastos" stroke="#ef4444" strokeWidth={2} name="Gastos" />
                    <Line type="monotone" dataKey="ganancias" stroke="#3b82f6" strokeWidth={2} name="Ganancias" />
                  </LineChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="metodos" className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={chartData.paymentMethods}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={(entry) => `${entry.name}: ${formatCOP(entry.value)}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {chartData.paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCOP(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </TabsContent>

              <TabsContent value="gastos" className="pt-6">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData.expenseCategories}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatCOP(value)} />
                    <Bar dataKey="value" fill="#ef4444" name="Monto" />
                  </BarChart>
                </ResponsiveContainer>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Section 3: Detalles Financieros */}
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">Detalles Financieros</h2>
          <div className="space-y-3">
            {/* Ingresos */}
            <Collapsible open={ingresosOpen} onOpenChange={setIngresosOpen}>
              <Card className="border-zinc-200">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">Ingresos</CardTitle>
                          <p className="text-sm text-zinc-500">{formatCOP(stats.currentMonth.ingresoNeto)}</p>
                        </div>
                      </div>
                      {ingresosOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-sm text-zinc-600">Facturas Pagas y Parciales</span>
                      <span className="text-sm font-medium">{formatCOP(stats.currentMonth.facturasPagas)}</span>
                    </div>
                    {stats.currentMonth.impactoCambios !== 0 && (
                      <div className="flex justify-between py-2 border-b border-zinc-100">
                        <span className="text-sm text-zinc-600">Impacto de Cambios</span>
                        <span className={`text-sm font-medium ${stats.currentMonth.impactoCambios > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {stats.currentMonth.impactoCambios > 0 ? '+' : ''}{formatCOP(stats.currentMonth.impactoCambios)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 font-semibold">
                      <span className="text-sm">Total Neto</span>
                      <span className="text-sm">{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                    </div>
                    {stats.currentMonth.totalDevoluciones > 0 && (
                      <div className="flex justify-between py-2 pt-3 border-t border-zinc-200">
                        <span className="text-xs text-zinc-500">Devoluciones registradas (ref.)</span>
                        <span className="text-xs text-zinc-500">{formatCOP(stats.currentMonth.totalDevoluciones)}</span>
                      </div>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Egresos */}
            <Collapsible open={egresosOpen} onOpenChange={setEgresosOpen}>
              <Card className="border-zinc-200">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">Egresos</CardTitle>
                          <p className="text-sm text-zinc-500">{formatCOP(stats.currentMonth.totalCostos + stats.currentMonth.totalGastos)}</p>
                        </div>
                      </div>
                      {egresosOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-sm text-zinc-600">Costos de Productos</span>
                      <span className="text-sm font-medium">{formatCOP(stats.currentMonth.totalCostos)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-sm text-zinc-600">Gastos Operativos</span>
                      <span className="text-sm font-medium">{formatCOP(stats.currentMonth.totalGastos)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-semibold">
                      <span className="text-sm">Total Egresos</span>
                      <span className="text-sm">{formatCOP(stats.currentMonth.totalCostos + stats.currentMonth.totalGastos)}</span>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Cuentas por Cobrar */}
            <Collapsible open={cuentasPorCobrarOpen} onOpenChange={setCuentasPorCobrarOpen}>
              <Card className="border-zinc-200">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">Cuentas por Cobrar</CardTitle>
                          <p className="text-sm text-zinc-500">
                            {formatCOP(
                              invoices
                                .filter(inv => inv.is_credit && inv.status === 'pending' && inv.credit_balance)
                                .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0)
                            )}
                          </p>
                        </div>
                      </div>
                      {cuentasPorCobrarOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openModal('credit')}
                    >
                      Ver Facturas a Crédito
                    </Button>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </div>
        </div>

        {/* Section 4: Top Lists */}
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 mb-4">Rankings del Mes</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Gastos */}
            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle className="text-base">Top 5 Gastos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topLists.topExpenses.map((expense: any, idx: number) => (
                    <div key={expense.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{expense.description}</p>
                          <p className="text-xs text-zinc-500">{expense.category || 'Sin categoría'}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{formatCOP(expense.amount)}</span>
                    </div>
                  ))}
                  {topLists.topExpenses.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">No hay gastos este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Facturas */}
            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle className="text-base">Top 5 Facturas Más Grandes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topLists.topInvoices.map((invoice: Invoice, idx: number) => (
                    <div key={invoice.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{invoice.number}</p>
                          <p className="text-xs text-zinc-500">{invoice.customer_name || 'Cliente general'}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{formatCOP(invoice.total)}</span>
                    </div>
                  ))}
                  {topLists.topInvoices.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">No hay facturas este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Clientes */}
            <Card className="border-zinc-200">
              <CardHeader>
                <CardTitle className="text-base">Top 5 Mejores Clientes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topLists.topCustomers.map((customer: any, idx: number) => (
                    <div key={customer.document} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-6 h-6 rounded-full flex items-center justify-center p-0">
                          {idx + 1}
                        </Badge>
                        <div>
                          <p className="text-sm font-medium">{customer.name}</p>
                          <p className="text-xs text-zinc-500">{customer.count} compras</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{formatCOP(customer.total)}</span>
                    </div>
                  ))}
                  {topLists.topCustomers.length === 0 && (
                    <p className="text-sm text-zinc-500 text-center py-4">No hay clientes con compras este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 5: Quick Actions */}
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle className="text-base">Acciones Rápidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" onClick={() => openModal('paid')}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Ver Facturas Pagas
              </Button>
              <Button variant="outline" onClick={() => openModal('credit')}>
                <CreditCard className="w-4 h-4 mr-2" />
                Ver Créditos
              </Button>
              <Button variant="outline" onClick={() => navigate('/gastos')}>
                <Wallet className="w-4 h-4 mr-2" />
                Gestionar Gastos
              </Button>
              <Button variant="outline" onClick={() => navigate('/clientes')}>
                <Users className="w-4 h-4 mr-2" />
                Ver Clientes
              </Button>
            </div>
          </CardContent>
        </Card>
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

      {/* Dialog de Selección de Tipo de Impresión */}
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
                products={products}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Desglose de Ingresos del Mes */}
      <Dialog open={isIncomeBreakdownOpen} onOpenChange={setIsIncomeBreakdownOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-emerald-600" />
              Desglose Detallado de Ingresos
            </DialogTitle>
            <DialogDescription>
              Vista detallada de todos los componentes que conforman los ingresos del mes
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Month selector */}
            <div>
              <Label htmlFor="month-selector" className="text-sm font-medium mb-2 block">
                Mes a analizar
              </Label>
              <Input
                id="month-selector"
                type="month"
                defaultValue={stats.thisMonth}
                onChange={(e) => {
                  // This would require adding state for selected month if needed for filtering
                  // For now, showing current month data
                }}
                className="w-64"
              />
            </div>

            {/* Facturas Pagas */}
            <div className="border border-emerald-200 rounded-lg p-4 bg-emerald-50">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-emerald-700">
                <Receipt className="w-5 h-5" />
                Facturas Pagas
              </h3>

              {(() => {
                const paidInvoices = invoices.filter(inv =>
                  extractColombiaDate(inv.date).startsWith(stats.thisMonth) &&
                  (inv.status === 'paid' || inv.status === 'partial_return')
                );
                const totalPaidInvoices = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

                return (
                  <>
                    {paidInvoices.length > 0 ? (
                      <div className="border border-emerald-300 rounded-lg overflow-hidden bg-white">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-emerald-100 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium">Número</th>
                                <th className="text-left py-2 px-3 font-medium">Cliente</th>
                                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                                <th className="text-left py-2 px-3 font-medium">Estado</th>
                                <th className="text-right py-2 px-3 font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paidInvoices.map((inv) => (
                                <tr key={inv.id} className="border-t border-emerald-100 hover:bg-emerald-50">
                                  <td className="py-2 px-3 font-medium">{inv.number}</td>
                                  <td className="py-2 px-3">{inv.customer_name || 'Cliente general'}</td>
                                  <td className="py-2 px-3">{extractColombiaDate(inv.date)}</td>
                                  <td className="py-2 px-3">
                                    <Badge variant={inv.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                                      {inv.status === 'paid' ? 'Pagada' : 'Parcial'}
                                    </Badge>
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                                    {formatCOP(inv.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 bg-white rounded-lg border border-emerald-200">
                        <Receipt className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
                        <p className="text-sm">No hay facturas pagas este mes</p>
                      </div>
                    )}
                    <div className="mt-3 flex justify-between items-center px-2">
                      <span className="text-sm font-medium text-emerald-800">Total Facturas Pagas:</span>
                      <span className="text-lg font-bold text-emerald-700">{formatCOP(totalPaidInvoices)}</span>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Devoluciones Parciales */}
            <div className="border border-red-200 rounded-lg p-4 bg-red-50">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-red-700">
                <TrendingDown className="w-5 h-5" />
                Devoluciones Parciales
              </h3>

              {(() => {
                // Filtrar solo devoluciones que corresponden a facturas con estado "partial_return"
                const monthReturns = returns.filter(ret => {
                  const retDate = extractColombiaDate(ret.date);
                  if (!retDate.startsWith(stats.thisMonth)) return false;

                  // Verificar que la factura asociada tenga estado "partial_return"
                  const invoice = invoices.find(inv => inv.id === ret.invoice_id);
                  return invoice?.status === 'partial_return';
                });
                const totalPartialReturns = monthReturns.reduce((sum, ret) => sum + ret.total, 0);

                return (
                  <>
                    {monthReturns.length > 0 ? (
                      <div className="border border-red-300 rounded-lg overflow-hidden bg-white">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-red-100 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium">Factura</th>
                                <th className="text-left py-2 px-3 font-medium">Cliente</th>
                                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                                <th className="text-left py-2 px-3 font-medium">Motivo</th>
                                <th className="text-right py-2 px-3 font-medium">Monto Devuelto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthReturns.map((ret) => {
                                const invoice = invoices.find(inv => inv.id === ret.invoice_id);
                                return (
                                  <tr key={ret.id} className="border-t border-red-100 hover:bg-red-50">
                                    <td className="py-2 px-3 font-medium">{invoice?.number || 'N/A'}</td>
                                    <td className="py-2 px-3">{ret.customer_name || 'N/A'}</td>
                                    <td className="py-2 px-3">{extractColombiaDate(ret.date)}</td>
                                    <td className="py-2 px-3 text-xs">{ret.reason || 'Sin motivo'}</td>
                                    <td className="py-2 px-3 text-right font-semibold text-red-600">
                                      -{formatCOP(ret.total)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 bg-white rounded-lg border border-red-200">
                        <TrendingDown className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
                        <p className="text-sm">No hay devoluciones parciales este mes</p>
                      </div>
                    )}
                    <div className="mt-3 flex justify-between items-center px-2">
                      <span className="text-sm font-medium text-red-800">Total Devoluciones Parciales:</span>
                      <span className="text-lg font-bold text-red-700">-{formatCOP(totalPartialReturns)}</span>
                    </div>
                    <p className="text-xs text-red-600 mt-1 px-2">
                      * Solo se muestran devoluciones de facturas parcialmente devueltas que impactan los ingresos netos
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Cambios */}
            <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-blue-700">
                <ShoppingCart className="w-5 h-5" />
                Cambios (Intercambios)
              </h3>

              {(() => {
                const monthExchanges = exchanges.filter(ex =>
                  extractColombiaDate(ex.date).startsWith(stats.thisMonth)
                );
                const totalExchangeImpact = monthExchanges.reduce((sum, ex) => sum + ex.price_difference, 0);
                const positiveExchanges = monthExchanges.filter(ex => ex.price_difference > 0);
                const negativeExchanges = monthExchanges.filter(ex => ex.price_difference < 0);
                const neutralExchanges = monthExchanges.filter(ex => ex.price_difference === 0);

                return (
                  <>
                    {monthExchanges.length > 0 ? (
                      <div className="border border-blue-300 rounded-lg overflow-hidden bg-white">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-blue-100 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium">Factura</th>
                                <th className="text-left py-2 px-3 font-medium">Cliente</th>
                                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                                <th className="text-left py-2 px-3 font-medium">Tipo</th>
                                <th className="text-right py-2 px-3 font-medium">Impacto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthExchanges.map((ex) => {
                                const invoice = invoices.find(inv => inv.id === ex.invoice_id);
                                return (
                                  <tr key={ex.id} className="border-t border-blue-100 hover:bg-blue-50">
                                    <td className="py-2 px-3 font-medium">{invoice?.number || 'N/A'}</td>
                                    <td className="py-2 px-3">{ex.customer_name || 'N/A'}</td>
                                    <td className="py-2 px-3">{extractColombiaDate(ex.date)}</td>
                                    <td className="py-2 px-3">
                                      {ex.price_difference > 0 ? (
                                        <Badge className="bg-emerald-100 text-emerald-700 text-xs">Upgrade</Badge>
                                      ) : ex.price_difference < 0 ? (
                                        <Badge className="bg-orange-100 text-orange-700 text-xs">Downgrade</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">Neutro</Badge>
                                      )}
                                    </td>
                                    <td className={`py-2 px-3 text-right font-semibold ${
                                      ex.price_difference > 0 ? 'text-emerald-600' :
                                      ex.price_difference < 0 ? 'text-red-600' :
                                      'text-zinc-600'
                                    }`}>
                                      {ex.price_difference > 0 ? '+' : ''}{formatCOP(ex.price_difference)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 bg-white rounded-lg border border-blue-200">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
                        <p className="text-sm">No hay cambios este mes</p>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-center px-2 text-xs text-zinc-600">
                        <span>Cambios positivos ({positiveExchanges.length}):</span>
                        <span className="text-emerald-600 font-medium">
                          +{formatCOP(positiveExchanges.reduce((sum, ex) => sum + ex.price_difference, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-2 text-xs text-zinc-600">
                        <span>Cambios negativos ({negativeExchanges.length}):</span>
                        <span className="text-red-600 font-medium">
                          {formatCOP(negativeExchanges.reduce((sum, ex) => sum + ex.price_difference, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-2 text-xs text-zinc-600">
                        <span>Cambios neutros ({neutralExchanges.length}):</span>
                        <span className="text-zinc-600 font-medium">{formatCOP(0)}</span>
                      </div>
                      <div className="flex justify-between items-center px-2 pt-2 border-t border-blue-200">
                        <span className="text-sm font-medium text-blue-800">Impacto Total de Cambios:</span>
                        <span className={`text-lg font-bold ${
                          totalExchangeImpact > 0 ? 'text-emerald-700' :
                          totalExchangeImpact < 0 ? 'text-red-700' :
                          'text-blue-700'
                        }`}>
                          {totalExchangeImpact > 0 ? '+' : ''}{formatCOP(totalExchangeImpact)}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Garantías */}
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <h3 className="font-semibold text-lg mb-3 flex items-center gap-2 text-purple-700">
                <CheckCircle className="w-5 h-5" />
                Garantías
              </h3>

              {(() => {
                const monthWarranties = warranties.filter(war =>
                  extractColombiaDate(war.date).startsWith(stats.thisMonth)
                );

                return (
                  <>
                    {monthWarranties.length > 0 ? (
                      <div className="border border-purple-300 rounded-lg overflow-hidden bg-white">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-purple-100 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium">Factura</th>
                                <th className="text-left py-2 px-3 font-medium">Cliente</th>
                                <th className="text-left py-2 px-3 font-medium">Fecha</th>
                                <th className="text-left py-2 px-3 font-medium">Estado</th>
                                <th className="text-left py-2 px-3 font-medium">Tipo</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthWarranties.map((war) => {
                                const invoice = invoices.find(inv => inv.id === war.invoice_id);
                                return (
                                  <tr key={war.id} className="border-t border-purple-100 hover:bg-purple-50">
                                    <td className="py-2 px-3 font-medium">{invoice?.number || 'N/A'}</td>
                                    <td className="py-2 px-3">{war.customer_name || 'N/A'}</td>
                                    <td className="py-2 px-3">{extractColombiaDate(war.date)}</td>
                                    <td className="py-2 px-3">
                                      <Badge
                                        variant={war.status === 'resolved' ? 'default' : 'secondary'}
                                        className="text-xs"
                                      >
                                        {war.status === 'resolved' ? 'Resuelta' : 'Pendiente'}
                                      </Badge>
                                    </td>
                                    <td className="py-2 px-3 text-xs">{war.warranty_type || 'N/A'}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-6 text-zinc-500 bg-white rounded-lg border border-purple-200">
                        <CheckCircle className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
                        <p className="text-sm">No hay garantías este mes</p>
                      </div>
                    )}
                    <div className="mt-3 flex justify-between items-center px-2">
                      <span className="text-sm font-medium text-purple-800">Total Garantías:</span>
                      <span className="text-lg font-bold text-purple-700">{monthWarranties.length}</span>
                    </div>
                    <p className="text-xs text-purple-600 mt-1 px-2">
                      * Las garantías representan reemplazos sin impacto monetario directo en ingresos
                    </p>
                  </>
                );
              })()}
            </div>

            {/* Resumen Final */}
            <div className="border-2 border-zinc-300 rounded-lg p-4 bg-zinc-50">
              <h3 className="font-semibold text-lg mb-4 text-zinc-800">Cálculo de Ingresos Netos del Mes</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-zinc-200">
                  <span className="text-zinc-700">Facturas Pagas</span>
                  <span className="font-semibold text-emerald-600">+{formatCOP(stats.currentMonth.facturasPagas)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-zinc-200">
                  <span className="text-zinc-700">Impacto de Cambios</span>
                  <span className={`font-semibold ${
                    stats.currentMonth.impactoCambios > 0 ? 'text-emerald-600' :
                    stats.currentMonth.impactoCambios < 0 ? 'text-red-600' :
                    'text-zinc-600'
                  }`}>
                    {stats.currentMonth.impactoCambios > 0 ? '+' : ''}{formatCOP(stats.currentMonth.impactoCambios)}
                  </span>
                </div>
                <div className="flex justify-between py-3 pt-4 border-t-2 border-zinc-400">
                  <span className="text-lg font-bold text-zinc-900">Ingresos Netos</span>
                  <span className="text-xl font-bold text-emerald-600">{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <strong>Nota:</strong> Los ingresos netos no restan las devoluciones porque las facturas con estado "devuelta"
                ya están excluidas del cálculo de facturas pagas. Las facturas "parcialmente devueltas" se incluyen
                con su total original.
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsIncomeBreakdownOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Desglose Diario de Ganancias */}
      <Dialog open={isDailyBreakdownOpen} onOpenChange={setIsDailyBreakdownOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-600" />
              Desglose de Ganancias por Día
            </DialogTitle>
            <DialogDescription>
              Selecciona una fecha para ver el detalle de ingresos y ganancias
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Selector de fecha */}
            <div>
              <Label htmlFor="date-selector" className="text-sm font-medium mb-2 block">
                Fecha
              </Label>
              <Input
                id="date-selector"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Resumen financiero del día */}
            {(() => {
              const dailyStats = getDailyStats(selectedDate);
              return (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Ingresos Netos */}
                    <Card className="border-emerald-200 bg-emerald-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-700">Ingresos Netos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">
                          {formatCOP(dailyStats.ingresosNetos)}
                        </div>
                        <div className="text-xs text-zinc-600 mt-2 space-y-1">
                          <div>Facturas: {formatCOP(dailyStats.facturasPagas)}</div>
                          {dailyStats.impactoCambios !== 0 && (
                            <div className={dailyStats.impactoCambios > 0 ? 'text-emerald-600' : 'text-red-600'}>
                              Cambios: {dailyStats.impactoCambios > 0 ? '+' : ''}{formatCOP(dailyStats.impactoCambios)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Egresos */}
                    <Card className="border-red-200 bg-red-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-700">Egresos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-red-600">
                          {formatCOP(dailyStats.costos + dailyStats.gastos)}
                        </div>
                        <div className="text-xs text-zinc-600 mt-2 space-y-1">
                          <div>Costos: {formatCOP(dailyStats.costos)}</div>
                          <div>Gastos: {formatCOP(dailyStats.gastos)}</div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Ganancias */}
                    <Card className="border-blue-200 bg-blue-50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700">Ganancias</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className={`text-2xl font-bold ${dailyStats.ganancias >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {formatCOP(dailyStats.ganancias)}
                        </div>
                        <div className="text-xs text-zinc-600 mt-2">
                          Margen: {dailyStats.ingresosNetos > 0 ? ((dailyStats.ganancias / dailyStats.ingresosNetos) * 100).toFixed(1) : '0.0'}%
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Lista de facturas */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Facturas del Día ({dailyStats.invoices.length})
                    </h3>
                    {dailyStats.invoices.length > 0 ? (
                      <div className="border border-zinc-200 rounded-lg overflow-hidden">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-zinc-100 sticky top-0">
                              <tr>
                                <th className="text-left py-2 px-3 font-medium">Número</th>
                                <th className="text-left py-2 px-3 font-medium">Cliente</th>
                                <th className="text-left py-2 px-3 font-medium">Hora</th>
                                <th className="text-right py-2 px-3 font-medium">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dailyStats.invoices.map((inv) => (
                                <tr key={inv.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                                  <td className="py-2 px-3 font-medium">{inv.number}</td>
                                  <td className="py-2 px-3">{inv.customer_name || 'Cliente general'}</td>
                                  <td className="py-2 px-3">
                                    {new Date(inv.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                                  </td>
                                  <td className="py-2 px-3 text-right font-semibold text-emerald-600">
                                    {formatCOP(inv.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-zinc-500 bg-zinc-50 rounded-lg border border-zinc-200">
                        <Receipt className="w-12 h-12 mx-auto mb-2 text-zinc-300" />
                        <p>No hay facturas para esta fecha</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDailyBreakdownOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
