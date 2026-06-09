import {
  getInvoicesByMonthRange,
  getColombiaDate,
  extractColombiaDate,
  extractColombiaDateTime,
  getCurrentCompany,
  getCreditPaymentsByInvoice,
  getCreditPayments,
  getReturns,
  getExchanges,
  getAllProducts,
  getExpenses,
  getCustomers,
  getWarranties,
  getCreditNotes,
  getDailyClosures,
  type CreditPayment,
  type Return,
  type Exchange,
  type Warranty,
  type CreditNote,
  type DailyClosure
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
  ArrowDownRight,
  Package,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { jsPDF } from 'jspdf';
import { ThermalInvoicePrint } from '../components/ThermalInvoicePrint';
import { printThermalInvoice as printThermalDirect } from '../lib/thermal-printer';
import { printPDFInvoice } from '../lib/pdf-printer';
import { isPrintingAvailable } from '../lib/platform-detector';
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isThermalPrintDialogOpen, setIsThermalPrintDialogOpen] = useState(false);
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  const [allCreditPayments, setAllCreditPayments] = useState<CreditPayment[]>([]); // Todos los abonos
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [dailyClosures, setDailyClosures] = useState<DailyClosure[]>([]);

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

  // Estado para modal de desglose de costos de productos
  const [isCostBreakdownOpen, setIsCostBreakdownOpen] = useState(false);

  // Filtros para modales
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Estado para navegación de meses
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [isTimeTravel, setIsTimeTravel] = useState(false);

  // Ref para impresión térmica
  const thermalPrintRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Funciones para navegación de meses
  const activateTimeTravel = (callback: () => void) => {
    setIsTimeTravel(true);
    // Usar setTimeout corto para permitir que se muestre el loading
    setTimeout(() => {
      callback();
      // Dar tiempo para que React procese el cambio
      setTimeout(() => {
        setIsTimeTravel(false);
      }, 100);
    }, 50);
  };

  const goToPreviousMonth = () => {
    const currentMonth = selectedMonth || getColombiaDate().slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const prevMonth = month === 1
      ? `${year - 1}-12`
      : `${year}-${String(month - 1).padStart(2, '0')}`;

    activateTimeTravel(() => setSelectedMonth(prevMonth));
  };

  const goToNextMonth = () => {
    const currentMonth = selectedMonth || getColombiaDate().slice(0, 7);
    const [year, month] = currentMonth.split('-').map(Number);
    const nextMonth = month === 12
      ? `${year + 1}-01`
      : `${year}-${String(month + 1).padStart(2, '0')}`;

    activateTimeTravel(() => setSelectedMonth(nextMonth));
  };

  const goToCurrentMonth = () => {
    activateTimeTravel(() => setSelectedMonth(null));
  };

  const getMonthName = () => {
    const month = selectedMonth || getColombiaDate().slice(0, 7);
    const [year, monthNum] = month.split('-');
    const date = new Date(`${month}-01T12:00:00`);
    const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    return monthName.charAt(0).toUpperCase() + monthName.slice(1);
  };

  const isCurrentMonth = () => {
    const current = getColombiaDate().slice(0, 7);
    const displayed = selectedMonth || current;
    return current === displayed;
  };

  // Obtener meses disponibles de los últimos 12 meses con datos
  const getAvailableMonths = () => {
    const months = new Set<string>();

    // Agregar meses de facturas
    invoices.forEach(inv => {
      const month = extractColombiaDate(inv.date).slice(0, 7);
      months.add(month);
    });

    // Agregar meses de gastos
    expenses.forEach(exp => {
      const month = extractColombiaDate(exp.date).slice(0, 7);
      months.add(month);
    });

    // Convertir a array y ordenar de más reciente a más antiguo
    const sortedMonths = Array.from(months).sort((a, b) => b.localeCompare(a));

    // Limitar a los últimos 12 meses
    return sortedMonths.slice(0, 12);
  };

  const handleMonthChange = (month: string) => {
    activateTimeTravel(() => {
      if (month === 'current') {
        setSelectedMonth(null);
      } else {
        setSelectedMonth(month);
      }
    });
  };

  const loadData = async () => {
    setIsLoading(true);
    const [invoicesData, returnsData, exchangesData, productsData, expensesData, customersData, warrantiesData, paymentsData, creditNotesData, dailyClosuresData] = await Promise.all([
      getInvoicesByMonthRange(3),
      getReturns(),
      getExchanges(),
      getAllProducts(),
      getExpenses(),
      getCustomers(),
      getWarranties(),
      getCreditPayments(),
      getCreditNotes(),
      getDailyClosures()
    ]);
    setInvoices(invoicesData);
    setReturns(returnsData);
    setExchanges(exchangesData);
    setProducts(productsData);
    setExpenses(expensesData);
    setCustomers(customersData);
    setWarranties(warrantiesData);
    setAllCreditPayments(paymentsData);
    setCreditNotes(creditNotesData);
    setDailyClosures(dailyClosuresData);
    setIsLoading(false);
  };

  // Calcular la ganancia proporcional de un abono basándose en el margen de la factura
  const calculatePaymentProfit = (payment: CreditPayment): number => {
    // Buscar la factura asociada al abono
    const invoice = invoices.find(inv => inv.id === payment.invoice_id);
    if (!invoice) return 0;

    // Calcular el costo total de los productos de la factura
    let totalCost = 0;
    invoice.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product && product.current_cost) {
        totalCost += product.current_cost * item.quantity;
      }
    });

    // Calcular el margen de ganancia de la factura
    const invoiceTotal = invoice.total;
    const invoiceProfit = invoiceTotal - totalCost;
    const profitMargin = invoiceTotal > 0 ? invoiceProfit / invoiceTotal : 0;

    // Aplicar el margen de ganancia al monto del abono
    const paymentProfit = payment.amount * profitMargin;

    return paymentProfit;
  };

  // Calcular estadísticas con comparación de mes anterior
  const getStats = () => {
    const today = getColombiaDate();
    // Usar el mes seleccionado o el mes actual por defecto
    const thisMonth = selectedMonth || today.slice(0, 7);

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
        if (ex.status === 'pending') return false; // Excluir cambios pendientes
        const exDate = extractColombiaDate(ex.date);
        return exDate.startsWith(targetMonth);
      });

      const monthExpenses = expenses.filter((exp) => {
        const expDate = extractColombiaDate(exp.date);
        return expDate.startsWith(targetMonth);
      });

      // Notas crédito emitidas en este mes (viven en el período de emisión, no de la factura)
      const monthCreditNotes = creditNotes.filter((cn) => {
        const cnDate = extractColombiaDate(cn.date);
        return cnDate.startsWith(targetMonth) && cn.status === 'issued';
      });

      // Facturas regulares pagadas (no crédito)
      const facturasPagas = monthInvoices
        .filter((inv) => (inv.status === 'paid' || inv.status === 'partial_return') && !inv.is_credit)
        .reduce((sum, inv) => sum + inv.total, 0);

      // Facturas a crédito ya pagadas completamente o con devolución parcial
      const creditosPagados = monthInvoices
        .filter((inv) => (inv.status === 'paid' || inv.status === 'partial_return') && inv.is_credit)
        .reduce((sum, inv) => sum + inv.total, 0);

      // Todas las facturas a crédito del mes (pagas o pendientes, excluyendo canceladas)
      const creditosDelMes = monthInvoices
        .filter((inv) => inv.is_credit && inv.status !== 'cancelled' && inv.status !== 'anulada')
        .reduce((sum, inv) => sum + inv.total, 0);

      const totalDevoluciones = monthReturns.reduce((sum, ret) => sum + ret.total, 0);

      // Devoluciones por método de pago del mes
      const parseMixedRefundMonth = (method: string) => {
        const result = { efectivo: 0, transfer: 0 };
        if (!method.startsWith('mixto:')) return result;
        method.slice(6).split(',').forEach(part => {
          const [k, v] = part.split('=');
          const val = parseFloat(v) || 0;
          if (k === 'efectivo') result.efectivo += val;
          if (['transferencia', 'nequi', 'daviplata'].includes(k)) result.transfer += val;
        });
        return result;
      };
      let cashReturnsDelMes = 0;
      let transferReturnsDelMes = 0;
      monthReturns.forEach((ret) => {
        const method = (ret.refund_method || '').toLowerCase();
        const amount = ret.total || 0;
        if (method === 'efectivo') cashReturnsDelMes += amount;
        else if (['transferencia', 'nequi', 'daviplata'].includes(method)) transferReturnsDelMes += amount;
        else if (method.startsWith('mixto:')) {
          const parsed = parseMixedRefundMonth(method);
          cashReturnsDelMes += parsed.efectivo;
          transferReturnsDelMes += parsed.transfer;
        }
      });

      // Impacto de cambios por método de pago del mes
      const cashExchangeDelMes = monthExchanges.reduce((sum, ex) => {
        const diff = Number(ex.price_difference) || 0;
        if (diff > 0) return sum + (ex.payment_cash || 0);
        if (diff < 0) return sum - (ex.payment_cash || 0);
        return sum;
      }, 0);
      const transferExchangeDelMes = monthExchanges.reduce((sum, ex) => {
        const diff = Number(ex.price_difference) || 0;
        if (diff > 0) return sum + (ex.payment_transfer || 0);
        if (diff < 0) return sum - (ex.payment_transfer || 0);
        return sum;
      }, 0);

      // Calcular costo de productos devueltos
      let costoDevoluciones = 0;
      monthReturns.forEach((ret) => {
        ret.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (product && product.current_cost) {
            costoDevoluciones += product.current_cost * item.quantity;
          }
        });
      });

      // Calcular impacto de cambios (suma de todos los price_difference, sean positivos o negativos)
      const impactoCambios = monthExchanges.reduce((sum, exchange) => {
        const diff = Number(exchange.price_difference) || 0;
        return sum + diff;
      }, 0);

      // Mantener abonos para referencia en otros cálculos
      const paymentsDelMes = allCreditPayments.filter((payment) => {
        const paymentDate = extractColombiaDate(payment.date);
        return paymentDate.startsWith(targetMonth);
      });

      const gananciasDeAbonos = paymentsDelMes.reduce((sum, payment) => {
        return sum + calculatePaymentProfit(payment);
      }, 0);

      const abonosDelMes = paymentsDelMes.reduce((sum, payment) => sum + payment.amount, 0);

      // Ajuste por notas crédito del mes
      const totalNotasCredito = monthCreditNotes.reduce((s, cn) => s + cn.total, 0);

      // Ingresos del mes: regulares pagadas + todos los créditos emitidos + impacto cambios − notas crédito − devoluciones
      const ingresoNeto = facturasPagas + creditosDelMes + impactoCambios - totalNotasCredito - totalDevoluciones;

      // Desglose por método de pago del mes (para Ingreso por Caja)
      let cashDelMes = 0;
      let transferDelMes = 0;
      const paidMonthInvoices = monthInvoices.filter(
        (inv) => (inv.status === 'paid' || inv.status === 'partial_return') && !inv.is_credit
      );
      paidMonthInvoices.forEach((inv) => {
        const total = inv.total || 0;
        const pm = (inv.payment_method || '').toLowerCase();
        if (pm === 'efectivo' || pm.includes('efectivo') || pm.includes('cash')) {
          cashDelMes += total;
        } else if (
          ['transferencia', 'nequi', 'daviplata', 'transfer'].includes(pm) ||
          pm.includes('transferencia') || pm.includes('nequi') || pm.includes('daviplata')
        ) {
          transferDelMes += total;
        } else if (inv.payment_details && typeof inv.payment_details === 'object') {
          const detailCash = Number(inv.payment_details.cash || inv.payment_details.efectivo || 0);
          const detailTransfer = Number(
            (inv.payment_details.transfer || 0) +
            (inv.payment_details.transferencia || 0) +
            (inv.payment_details.nequi || 0) +
            (inv.payment_details.daviplata || 0)
          );
          cashDelMes += detailCash;
          transferDelMes += detailTransfer;
          // any unclassified remainder goes to cash
          const classified = detailCash + detailTransfer;
          if (classified < total) {
            cashDelMes += total - classified;
          }
        } else {
          // fallback: unrecognized payment method counted as cash
          cashDelMes += total;
        }
      });
      // Abonos en efectivo y transferencia del mes
      const abonosCashDelMes = paymentsDelMes
        .filter((p) => ['efectivo', 'cash'].includes(p.payment_method || ''))
        .reduce((sum, p) => sum + p.amount, 0);
      const abonosTransferDelMes = paymentsDelMes
        .filter((p) => ['transferencia', 'transfer', 'nequi', 'daviplata'].includes(p.payment_method || ''))
        .reduce((sum, p) => sum + p.amount, 0);
      const ingresoCajaDelMes = cashDelMes + transferDelMes + abonosDelMes
        - cashReturnsDelMes - transferReturnsDelMes
        + cashExchangeDelMes + transferExchangeDelMes;

      // Ingresos por factura (referencia, no se usa en ganancias)
      // Incluye: facturas en confirmación + crédito pendiente (considerando abonos)
      const totalFacturasEnConfirmacion = monthInvoices
        .filter((inv) => inv.status === 'pending_confirmation')
        .reduce((sum, inv) => sum + inv.total, 0);

      // Crédito pendiente del mes (usando credit_balance que ya considera abonos)
      const creditoPendienteDelMes = monthInvoices
        .filter((inv) => inv.status === 'pending' && inv.is_credit && inv.credit_balance > 0)
        .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

      const ingresosPorFactura = totalFacturasEnConfirmacion + creditoPendienteDelMes;

      // Costos de Productos: facturas pagas + facturas a crédito emitidas (excluyendo anuladas)
      const facturasParaCostos = monthInvoices.filter((inv) => {
        if (inv.status === 'anulada' || inv.status === 'cancelled') return false;
        if (inv.is_credit) return true; // Todas las facturas a crédito no anuladas
        return inv.status === 'paid' || inv.status === 'partial_return'; // Regulares solo si están pagas
      });

      let costosDeProductos = 0;
      facturasParaCostos.forEach((invoice) => {
        invoice.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (product && product.current_cost) {
            costosDeProductos += product.current_cost * item.quantity;
          }
        });
      });

      // Mantener totalCostos para compatibilidad con código existente
      const facturasPagasList = monthInvoices.filter((inv) => (inv.status === 'paid' || inv.status === 'partial_return') && !inv.is_credit);
      let totalCostos = 0;

      facturasPagasList.forEach((invoice) => {
        invoice.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (product && product.current_cost) {
            totalCostos += product.current_cost * item.quantity;
          }
        });
      });

      // Restar costos de los productos acreditados en notas crédito del mes
      let costosNotasCredito = 0;
      monthCreditNotes.forEach((cn) => {
        cn.items.forEach((item) => {
          if (item.productId.startsWith('common-')) return;
          const product = products.find((p) => p.id === item.productId);
          if (product && product.current_cost) {
            costosNotasCredito += product.current_cost * item.quantity;
          }
        });
      });
      // Restar también el costo de devoluciones
      costosDeProductos = Math.max(0, costosDeProductos - costosNotasCredito - costoDevoluciones);

      const totalGastos = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      // Impacto de utilidad por cambios del mes (profit_difference)
      const exchangeProfitImpact = monthExchanges.reduce((sum, ex) => sum + (Number(ex.profit_difference) || 0), 0);

      // Ganancias Netas: ingresos - costos - gastos operativos
      const gananciasNetas = ingresoNeto - costosDeProductos - totalGastos + exchangeProfitImpact;

      // Ganancias Brutas: ingresos + notas de crédito (se suman de vuelta) - costos (sin gastos operativos)
      const gananciasBrutas = ingresoNeto + totalNotasCredito - costosDeProductos + exchangeProfitImpact;

      // Mantener ganancias original para compatibilidad
      const ganancias = ingresoNeto - totalCostos - totalGastos + exchangeProfitImpact;

      const margen = ingresoNeto > 0 ? (gananciasNetas / ingresoNeto) * 100 : 0;
      const margenBruto = ingresoNeto > 0 ? (gananciasBrutas / (ingresoNeto + totalNotasCredito)) * 100 : 0;

      return {
        ingresoNeto,
        totalGastos,
        ganancias,
        margen,
        totalCostos,
        totalDevoluciones,
        costoDevoluciones,
        impactoCambios,
        facturasPagas,
        creditosPagados,
        abonosDelMes,
        gananciasDeAbonos,
        ingresosPorFactura,
        costosDeProductos,
        gananciasNetas,
        gananciasBrutas,
        margenBruto,
        totalNotasCredito,
        creditosDelMes,
        cashDelMes,
        transferDelMes,
        abonosCashDelMes,
        abonosTransferDelMes,
        cashReturnsDelMes,
        transferReturnsDelMes,
        cashExchangeDelMes,
        transferExchangeDelMes,
        ingresoCajaDelMes,
        invoicesCount: monthInvoices.length,
        expenses: monthExpenses,
        creditNotes: monthCreditNotes
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

    const gananciasChange = Math.abs(previousMonth.gananciasNetas) > 0
      ? ((currentMonth.gananciasNetas - previousMonth.gananciasNetas) / Math.abs(previousMonth.gananciasNetas)) * 100
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
    // Filtrar facturas del día (todas las pagas)
    const dayInvoicesRegular = invoices.filter(inv => {
      const invDate = extractColombiaDate(inv.date);
      return invDate === date && (inv.status === 'paid' || inv.status === 'partial_return') && !inv.is_credit;
    });

    const dayInvoicesCredit = invoices.filter(inv => {
      const invDate = extractColombiaDate(inv.date);
      return invDate === date && (inv.status === 'paid' || inv.status === 'partial_return') && inv.is_credit;
    });

    // Filtrar devoluciones del día
    const dayReturns = returns.filter(ret => {
      const retDate = extractColombiaDate(ret.date);
      return retDate === date;
    });

    // Filtrar notas crédito del día
    const dayCreditNotes = creditNotes.filter(cn => {
      const cnDate = extractColombiaDate(cn.date);
      return cnDate === date && cn.status === 'issued';
    });

    // Filtrar gastos del día
    const dayExpenses = expenses.filter(exp => {
      const expDate = extractColombiaDate(exp.date);
      return expDate === date;
    });

    // Filtrar cambios del día (excluir cambios pendientes)
    const dayExchanges = exchanges.filter(ex => {
      if (ex.status === 'pending') return false; // Excluir cambios pendientes
      const exDate = extractColombiaDate(ex.date);
      return exDate === date;
    });

    // Calcular ingresos
    const facturasPagas = dayInvoicesRegular.reduce((sum, inv) => sum + inv.total, 0);
    const creditosPagados = dayInvoicesCredit.reduce((sum, inv) => sum + inv.total, 0);
    const impactoCambios = dayExchanges.reduce((sum, exchange) => {
      const diff = Number(exchange.price_difference) || 0;
      return sum + diff;
    }, 0);

    // Calcular devoluciones y notas crédito
    const totalDevoluciones = dayReturns.reduce((sum, ret) => sum + ret.total, 0);
    const totalNotasCredito = dayCreditNotes.reduce((sum, cn) => sum + cn.total, 0);

    // NUEVO: Abonos a crédito del día - calcular ganancia proporcional
    const paymentsDelDia = allCreditPayments.filter((payment) => {
      const paymentDate = extractColombiaDate(payment.date);
      return paymentDate === date;
    });

    // Calcular la ganancia real de los abonos (no el monto completo)
    const gananciasDeAbonos = paymentsDelDia.reduce((sum, payment) => {
      return sum + calculatePaymentProfit(payment);
    }, 0);

    // Mantener el total de abonos para referencia
    const abonosDelDia = paymentsDelDia.reduce((sum, payment) => sum + payment.amount, 0);

    // INGRESOS NETOS: facturas pagas + créditos pagados - notas crédito - devoluciones
    const ingresosNetos = facturasPagas + creditosPagados - totalNotasCredito - totalDevoluciones;

    // Calcular costos de productos (todas las facturas pagas)
    let costos = 0;
    const allDayInvoices = [...dayInvoicesRegular, ...dayInvoicesCredit];
    allDayInvoices.forEach(invoice => {
      invoice.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product && product.current_cost) {
          costos += product.current_cost * item.quantity;
        }
      });
    });

    // Restar costos de productos devueltos
    let costoDevoluciones = 0;
    dayReturns.forEach(ret => {
      ret.items.forEach(item => {
        const product = products.find(p => p.id === item.productId);
        if (product && product.current_cost) {
          costoDevoluciones += product.current_cost * item.quantity;
        }
      });
    });

    // Restar costos de productos en notas crédito
    let costosNotasCredito = 0;
    dayCreditNotes.forEach(cn => {
      cn.items.forEach(item => {
        if (item.productId.startsWith('common-')) return;
        const product = products.find(p => p.id === item.productId);
        if (product && product.current_cost) {
          costosNotasCredito += product.current_cost * item.quantity;
        }
      });
    });

    // Aplicar las restas a los costos
    costos = Math.max(0, costos - costoDevoluciones - costosNotasCredito);

    // Impacto de utilidad por cambios del día (profit_difference)
    const exchangeProfitImpact = dayExchanges.reduce((sum, ex) => sum + (Number(ex.profit_difference) || 0), 0);

    // Calcular gastos
    const gastos = dayExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Calcular ganancias (incluyendo impacto de utilidad de cambios)
    const ganancias = ingresosNetos - costos - gastos + exchangeProfitImpact;

    return {
      invoices: allDayInvoices,
      ingresosNetos,
      gastos,
      costos,
      ganancias,
      facturasPagas,
      impactoCambios,
      abonosDelDia,
      gananciasDeAbonos,
      totalDevoluciones,
      totalNotasCredito
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
      doc.text(`Ganancias Netas: ${formatCOP(stats.currentMonth.gananciasNetas)}`, 20, y);
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
      if (stats.currentMonth.abonosDelMes > 0) {
        doc.text(`Abonos a Crédito: ${formatCOP(stats.currentMonth.abonosDelMes)}`, 25, y);
        y += 6;
      }
      if (stats.currentMonth.impactoCambios !== 0) {
        doc.text(`Impacto de Cambios: ${stats.currentMonth.impactoCambios > 0 ? '+' : ''}${formatCOP(stats.currentMonth.impactoCambios)}`, 25, y);
        y += 6;
      }
      doc.text(`Costos de Productos: ${formatCOP(stats.currentMonth.costosDeProductos)}`, 25, y);
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

    // Data for tendencias (last 6 months) - basado en cierres diarios
    const last6Months = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      // Filtrar cierres diarios de este mes
      const monthClosures = dailyClosures.filter(closure => {
        const closureDate = extractColombiaDate(closure.date);
        return closureDate.startsWith(monthStr);
      });

      let ingresos = 0;
      let gastos = 0;
      let ganancias = 0;

      if (monthClosures.length > 0) {
        // Si existen cierres diarios para este mes, sumar sus valores
        ingresos = monthClosures.reduce((sum, c) => sum + (c.total || 0), 0);
        gastos = monthClosures.reduce((sum, c) => sum + (c.total_expenses || 0), 0);
        // Usar profit_collected si existe, sino profit_generated
        ganancias = monthClosures.reduce((sum, c) => sum + (c.profit_collected || c.profit_generated || 0), 0);
      } else {
        // Si no existe cierre, calcular desde las facturas (fallback)
        const monthInvoices = invoices.filter(inv => extractColombiaDate(inv.date).startsWith(monthStr));
        const monthExpenses = expenses.filter(exp => extractColombiaDate(exp.date).startsWith(monthStr));
        const monthExchanges = exchanges.filter(ex => ex.status !== 'pending' && extractColombiaDate(ex.date).startsWith(monthStr));
        const monthReturns = returns.filter(ret => extractColombiaDate(ret.date).startsWith(monthStr));
        const monthCreditNotes = creditNotes.filter(cn => extractColombiaDate(cn.date).startsWith(monthStr) && cn.status === 'issued');

        // IMPORTANTE: Solo contar facturas REGULARES pagadas (excluir crédito para evitar doble contabilidad)
        const paidInvoices = monthInvoices.filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && !inv.is_credit);
        const creditInvoices = monthInvoices.filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && inv.is_credit);

        const facturasPagas = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);
        const creditosPagados = creditInvoices.reduce((sum, inv) => sum + inv.total, 0);

        // Calcular devoluciones y notas crédito
        const totalDevoluciones = monthReturns.reduce((sum, ret) => sum + ret.total, 0);
        const totalNotasCredito = monthCreditNotes.reduce((sum, cn) => sum + cn.total, 0);

        // INGRESOS: facturas pagas + créditos pagados - notas crédito - devoluciones
        ingresos = facturasPagas + creditosPagados - totalNotasCredito - totalDevoluciones;

        gastos = monthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        // Calcular costos de productos vendidos en el mes (todas las facturas pagas, regulares y crédito)
        let costos = 0;
        const allPaidInvoices = [...paidInvoices, ...creditInvoices];
        allPaidInvoices.forEach(invoice => {
          invoice.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.current_cost) {
              costos += product.current_cost * item.quantity;
            }
          });
        });

        // Restar costos de productos devueltos
        let costoDevoluciones = 0;
        monthReturns.forEach(ret => {
          ret.items.forEach(item => {
            const product = products.find(p => p.id === item.productId);
            if (product && product.current_cost) {
              costoDevoluciones += product.current_cost * item.quantity;
            }
          });
        });

        // Restar costos de productos en notas crédito
        let costosNotasCredito = 0;
        monthCreditNotes.forEach(cn => {
          cn.items.forEach(item => {
            if (item.productId.startsWith('common-')) return;
            const product = products.find(p => p.id === item.productId);
            if (product && product.current_cost) {
              costosNotasCredito += product.current_cost * item.quantity;
            }
          });
        });

        // Aplicar las restas a los costos
        costos = Math.max(0, costos - costoDevoluciones - costosNotasCredito);

        const monthExchangeProfitImpact = monthExchanges.reduce((sum, ex) => sum + (Number(ex.profit_difference) || 0), 0);

        ganancias = ingresos - gastos - costos + monthExchangeProfitImpact;
      }

      last6Months.push({
        month: date.toLocaleDateString('es-CO', { month: 'short' }),
        monthKey: monthStr,
        ingresos,
        gastos,
        ganancias
      });
    }

    // Payment methods data - incluir todas las facturas pagadas
    const paymentMethodsData = [
      {
        name: 'Efectivo',
        key: 'payment-cash',
        value: invoices
          .filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && inv.payment_cash)
          .reduce((sum, inv) => sum + (inv.payment_cash || 0), 0)
      },
      {
        name: 'Transferencia',
        key: 'payment-transfer',
        value: invoices
          .filter(inv => (inv.status === 'paid' || inv.status === 'partial_return') && inv.payment_transfer)
          .reduce((sum, inv) => sum + (inv.payment_transfer || 0), 0)
      },
      {
        name: 'Otros',
        key: 'payment-other',
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

    const expensesChartData = Object.entries(expenseCategories).map(([name, value], index) => ({
      name,
      value: value as number,
      key: `expense-${name}-${index}` // Añadir key única
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
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center">
        <div className="text-center">
          {/* Título animado */}
          <h2 className="text-2xl font-semibold text-zinc-700 dark:text-zinc-100 mb-8 animate-pulse">
            Estructurando y Analizando
          </h2>

          {/* Grid de barras animadas simulando datos */}
          <div className="flex gap-2 justify-center mb-8">
            {[0, 1, 2, 3, 4, 5, 6].map((index) => (
              <div
                key={index}
                className="w-3 bg-emerald-600 dark:bg-emerald-500 rounded-full"
                style={{
                  height: '80px',
                  animation: `barAnimation 1.5s ease-in-out ${index * 0.15}s infinite`,
                }}
              />
            ))}
          </div>

          {/* Indicadores de progreso */}
          <div className="space-y-3 max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-pulse" />
                <span>Procesando facturas</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full animate-[progressBar_2s_ease-in-out_infinite]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" style={{ animationDelay: '0.3s' }} />
                <span>Calculando ingresos</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full animate-[progressBar_2s_ease-in-out_0.3s_infinite]" />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400 animate-pulse" style={{ animationDelay: '0.6s' }} />
                <span>Generando estadísticas</span>
              </div>
              <div className="w-24 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-purple-600 dark:bg-purple-500 rounded-full animate-[progressBar_2s_ease-in-out_0.6s_infinite]" />
              </div>
            </div>
          </div>

          {/* Animación de spinner circular de respaldo */}
          <div className="mt-8 flex justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-600 dark:text-emerald-400 opacity-50" />
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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Pantalla de carga - aparece sobre el contenido */}
      {isTimeTravel && (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
          <div className="text-center space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="text-lg text-zinc-600 dark:text-zinc-400">Recalculando...</p>
          </div>
        </div>
      )}

      {/* Contenido normal - oculto durante el viaje en el tiempo */}
      {!isTimeTravel && (
      <>
        {/* Header */}
        <div className="bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 dark:border-zinc-800">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/sistema/facturacion')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Facturación
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100 dark:text-zinc-100">Gestión de Finanzas</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 dark:text-zinc-400 mt-1">
                Panel de control financiero y análisis de rendimiento
              </p>
            </div>

            {/* Selector de meses */}
            <div className="flex items-center gap-3 mx-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-zinc-500" />
                <Select
                  value={selectedMonth || 'current'}
                  onValueChange={handleMonthChange}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue>
                      {getMonthName()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Mes Actual</span>
                        <Badge variant="outline" className="text-xs bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                          Hoy
                        </Badge>
                      </div>
                    </SelectItem>
                    {getAvailableMonths().map(month => {
                      const date = new Date(`${month}-01T12:00:00`);
                      const monthName = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
                      const formattedName = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                      const isCurrent = month === getColombiaDate().slice(0, 7);

                      if (isCurrent) return null; // Ya está en "Mes Actual"

                      return (
                        <SelectItem key={month} value={month}>
                          {formattedName}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>

                {/* Botones de navegación rápida */}
                <div className="flex items-center gap-1 ml-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8 p-0"
                    title="Mes anterior"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={goToNextMonth}
                    disabled={isCurrentMonth()}
                    className="h-8 w-8 p-0"
                    title="Mes siguiente"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950"
                onClick={() => navigate('/sistema/facturacion/cierre-finanzas')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Finalizar Finanzas
              </Button>
              <Button
                variant="outline"
                className="border-orange-600 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={() => navigate('/sistema/facturacion/deudas')}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Gestión de Deudas
              </Button>
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
      </div>

      <div className="p-6 space-y-6">
        {/* Section 1: Overview Financiero */}
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Overview Financiero</h2>
          <div className="space-y-4">
          {/* Fila 1: Ingresos del Mes (ancho completo) */}
          <div>
            {/* 1. Ingresos del Mes */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Ingresos del Mes</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(stats.currentMonth.ingresoNeto)}</div>

                {/* Desglose ingresos totales */}
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>📄 Facturas pagas</span>
                    <span className="font-medium">+{formatCOP(stats.currentMonth.facturasPagas)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                    <span>📋 Créditos emitidos</span>
                    <span className="font-medium">+{formatCOP(stats.currentMonth.creditosDelMes)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">🔄 Impacto cambios</span>
                    <span className={`font-medium ${stats.currentMonth.impactoCambios >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {stats.currentMonth.impactoCambios >= 0 ? '+' : ''}{formatCOP(stats.currentMonth.impactoCambios)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">📝 Notas de crédito</span>
                    <span className="font-medium text-red-600">-{formatCOP(stats.currentMonth.totalNotasCredito)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">↩️ Devoluciones</span>
                    <span className="font-medium text-red-600">-{formatCOP(stats.currentMonth.totalDevoluciones)}</span>
                  </div>
                </div>

                {/* Sección Ingreso por Caja del Mes */}
                <div className="mt-4 pt-4 border-t-2 border-emerald-300 dark:border-emerald-600 rounded-lg bg-emerald-100/60 dark:bg-emerald-900/30 p-3 -mx-1">
                  <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide mb-1">🏧 Ingreso por Caja del Mes</p>
                  <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mb-2">
                    {formatCOP(stats.currentMonth.ingresoCajaDelMes)}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-300">💵 Efectivo</span>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCOP(stats.currentMonth.cashDelMes)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-300">🏦 Transferencias</span>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCOP(stats.currentMonth.transferDelMes)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-700 dark:text-emerald-300">💳 Abonos</span>
                      <span className="font-semibold text-emerald-800 dark:text-emerald-200">{formatCOP(stats.currentMonth.abonosDelMes)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-emerald-600 dark:text-emerald-400">🔄 Dif. cambios</span>
                      <span className={`font-semibold ${(stats.currentMonth.cashExchangeDelMes + stats.currentMonth.transferExchangeDelMes) >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-orange-600'}`}>
                        {(stats.currentMonth.cashExchangeDelMes + stats.currentMonth.transferExchangeDelMes) >= 0 ? '+' : ''}{formatCOP(stats.currentMonth.cashExchangeDelMes + stats.currentMonth.transferExchangeDelMes)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-orange-600 dark:text-orange-400">↩️ Devoluciones</span>
                      <span className="font-semibold text-orange-600 dark:text-orange-400">-{formatCOP(stats.currentMonth.cashReturnsDelMes + stats.currentMonth.transferReturnsDelMes)}</span>
                    </div>
                  </div>
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
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">vs mes anterior</span>
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

          </div>

          {/* Fila 2: 2 cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* 2. Total de Facturas En Confirmación */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total de Facturas En Confirmación</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(stats.currentMonth.ingresosPorFactura)}</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
                    Total de facturas pendientes y en confirmación del mes
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {(() => {
                    const change = stats.previousMonth.ingresosPorFactura > 0
                      ? ((stats.currentMonth.ingresosPorFactura - stats.previousMonth.ingresosPorFactura) / stats.previousMonth.ingresosPorFactura * 100)
                      : 0;
                    return (
                      <>
                        {change >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-red-600" />
                        )}
                        <span className={`text-sm font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">vs mes anterior</span>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* 3. Costos de Productos */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Costos de Productos</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                    <Package className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(stats.currentMonth.costosDeProductos)}</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-2">
                    Costos netos considerando devoluciones
                  </div>
                  {stats.currentMonth.costoDevoluciones > 0 && (
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Costos recuperados por devoluciones</span>
                      <span className="font-medium text-emerald-600">-{formatCOP(stats.currentMonth.costoDevoluciones)}</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {(() => {
                    const change = stats.previousMonth.costosDeProductos > 0
                      ? ((stats.currentMonth.costosDeProductos - stats.previousMonth.costosDeProductos) / stats.previousMonth.costosDeProductos * 100)
                      : 0;
                    return (
                      <>
                        {change >= 0 ? (
                          <ArrowUpRight className="w-4 h-4 text-red-600" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4 text-emerald-600" />
                        )}
                        <span className={`text-sm font-medium ${change >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">vs mes anterior</span>
                      </>
                    );
                  })()}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCostBreakdownOpen(true)}
                  className="w-full mt-3 text-xs border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950 text-orange-700 dark:text-orange-400"
                >
                  <ChevronRight className="w-3 h-3 mr-1" />
                  Ver Desglose Detallado
                </Button>
              </CardContent>
            </Card>

          </div>

          {/* Fila 3: 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 4. Gastos del Mes */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Gastos del Mes</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <Wallet className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(stats.currentMonth.totalGastos)}</div>

                {/* Desglose */}
                <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400">
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
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">vs mes anterior</span>
                </div>
              </CardContent>
            </Card>

            {/* 5. Ganancias Netas */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Ganancias Netas</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <DollarSign className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Ganancias Brutas */}
                <div className="mb-4">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Ganancia Bruta</p>
                  <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{formatCOP(stats.currentMonth.gananciasBrutas)}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Ingresos del mes</span>
                      <span className="font-medium text-emerald-600">+{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Notas de crédito (+)</span>
                      <span className="font-medium text-emerald-600">+{formatCOP(stats.currentMonth.totalNotasCredito)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Costos productos</span>
                      <span className="font-medium text-red-600">-{formatCOP(stats.currentMonth.costosDeProductos)}</span>
                    </div>
                  </div>
                </div>

                {/* Ganancias Netas */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1">Ganancia Neta</p>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{formatCOP(stats.currentMonth.gananciasNetas)}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Ganancia bruta</span>
                      <span className="font-medium text-emerald-600">+{formatCOP(stats.currentMonth.gananciasBrutas)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Gastos operativos</span>
                      <span className="font-medium text-red-600">-{formatCOP(stats.currentMonth.totalGastos)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3">
                  {(() => {
                    const change = Math.abs(stats.previousMonth.gananciasNetas) > 0
                      ? ((stats.currentMonth.gananciasNetas - stats.previousMonth.gananciasNetas) / Math.abs(stats.previousMonth.gananciasNetas) * 100)
                      : 0;
                    return (
                      <>
                        {change >= 0 ? <ArrowUpRight className="w-4 h-4 text-emerald-600" /> : <ArrowDownRight className="w-4 h-4 text-red-600" />}
                        <span className={`text-sm font-medium ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                        </span>
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">vs mes anterior</span>
                      </>
                    );
                  })()}
                </div>

                <Button variant="outline" size="sm" className="w-full mt-3" onClick={() => setIsDailyBreakdownOpen(true)}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Desglosar ganancias
                </Button>
              </CardContent>
            </Card>

            {/* 6. Margen de Ganancia */}
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Margen de Ganancia</CardTitle>
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Margen Bruto */}
                <div className="mb-3">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">% Ganancia Bruta</div>
                  <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.currentMonth.margenBruto.toFixed(1)}%</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Ganancias brutas</span>
                      <span className="font-medium">{formatCOP(stats.currentMonth.gananciasBrutas)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Ingresos + notas crédito</span>
                      <span className="font-medium">{formatCOP(stats.currentMonth.ingresoNeto + stats.currentMonth.totalNotasCredito)}</span>
                    </div>
                  </div>
                </div>

                {/* Margen Neto */}
                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">% Ganancia Neta</div>
                  <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.currentMonth.margen.toFixed(1)}%</div>
                  <div className="mt-1 space-y-1">
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Ganancias netas</span>
                      <span className="font-medium">{formatCOP(stats.currentMonth.gananciasNetas)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 dark:text-zinc-400">
                      <span>Ingresos del mes</span>
                      <span className="font-medium">{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  {stats.currentMonth.margen >= stats.previousMonth.margen ? (
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${stats.currentMonth.margen >= stats.previousMonth.margen ? 'text-emerald-600' : 'text-red-600'}`}>
                    {(stats.currentMonth.margen - stats.previousMonth.margen).toFixed(1)}pts
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">margen neto vs mes anterior</span>
                </div>
              </CardContent>
            </Card>
          </div>
          </div>
        </div>

        {/* Section 2: Análisis Visual */}
        <Card className="border-zinc-200 dark:border-zinc-800">
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
                    <XAxis dataKey="monthKey" tickFormatter={(value) => {
                      const item = chartData.tendencias.find(d => d.monthKey === value);
                      return item?.month || value;
                    }} />
                    <YAxis />
                    <Tooltip formatter={(value: any) => formatCOP(value)} labelFormatter={(label) => {
                      const item = chartData.tendencias.find(d => d.monthKey === label);
                      return item?.month || label;
                    }} />
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
                      {chartData.paymentMethods.map((entry) => (
                        <Cell key={entry.key} fill={COLORS[chartData.paymentMethods.indexOf(entry) % COLORS.length]} />
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
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Detalles Financieros</h2>
          <div className="space-y-3">
            {/* Ingresos */}
            <Collapsible open={ingresosOpen} onOpenChange={setIngresosOpen}>
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">Ingresos</CardTitle>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatCOP(stats.currentMonth.ingresoNeto)}</p>
                        </div>
                      </div>
                      {ingresosOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">Facturas Pagas y Parciales</span>
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">+{formatCOP(stats.currentMonth.facturasPagas)}</span>
                    </div>
                    {stats.currentMonth.creditosPagados > 0 && (
                      <div className="flex justify-between py-2 border-b border-zinc-100">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Créditos Pagados</span>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">+{formatCOP(stats.currentMonth.creditosPagados)}</span>
                      </div>
                    )}
                    {stats.currentMonth.impactoCambios !== 0 && (
                      <div className="flex justify-between py-2 border-b border-zinc-100">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Impacto de Cambios</span>
                        <span className={`text-sm font-medium ${stats.currentMonth.impactoCambios > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {stats.currentMonth.impactoCambios > 0 ? '+' : ''}{formatCOP(stats.currentMonth.impactoCambios)}
                        </span>
                      </div>
                    )}
                    {stats.currentMonth.totalNotasCredito > 0 && (
                      <div className="flex justify-between py-2 border-b border-zinc-100">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Notas Crédito emitidas</span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          -{formatCOP(stats.currentMonth.totalNotasCredito)}
                        </span>
                      </div>
                    )}
                    {stats.currentMonth.totalDevoluciones > 0 && (
                      <div className="flex justify-between py-2 border-b border-zinc-100">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">Devoluciones</span>
                        <span className="text-sm font-medium text-red-600 dark:text-red-400">
                          -{formatCOP(stats.currentMonth.totalDevoluciones)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 font-semibold border-t border-zinc-200 dark:border-zinc-800">
                      <span className="text-sm">Total Neto</span>
                      <span className="text-sm">{formatCOP(stats.currentMonth.ingresoNeto)}</span>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Egresos */}
            <Collapsible open={egresosOpen} onOpenChange={setEgresosOpen}>
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                          <Wallet className="w-5 h-5 text-red-600" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">Egresos</CardTitle>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">{formatCOP(stats.currentMonth.costosDeProductos + stats.currentMonth.totalGastos)}</p>
                        </div>
                      </div>
                      {egresosOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0 space-y-2">
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">Costos de Productos</span>
                      <span className="text-sm font-medium">{formatCOP(stats.currentMonth.costosDeProductos)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-zinc-100">
                      <span className="text-sm text-zinc-600 dark:text-zinc-400">Gastos Operativos</span>
                      <span className="text-sm font-medium">{formatCOP(stats.currentMonth.totalGastos)}</span>
                    </div>
                    <div className="flex justify-between py-2 font-semibold">
                      <span className="text-sm">Total Egresos</span>
                      <span className="text-sm">{formatCOP(stats.currentMonth.costosDeProductos + stats.currentMonth.totalGastos)}</span>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            {/* Cuentas por Cobrar */}
            <Collapsible open={cuentasPorCobrarOpen} onOpenChange={setCuentasPorCobrarOpen}>
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CollapsibleTrigger className="w-full">
                  <CardHeader className="cursor-pointer hover:bg-zinc-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <CardTitle className="text-lg">Cuentas por Cobrar</CardTitle>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">
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
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Rankings del Mes</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top Gastos */}
            <Card className="border-zinc-200 dark:border-zinc-800">
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
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{expense.category || 'Sin categoría'}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-red-600">{formatCOP(expense.amount)}</span>
                    </div>
                  ))}
                  {topLists.topExpenses.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">No hay gastos este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Facturas */}
            <Card className="border-zinc-200 dark:border-zinc-800">
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
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{invoice.customer_name || 'Cliente general'}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-emerald-600">{formatCOP(invoice.total)}</span>
                    </div>
                  ))}
                  {topLists.topInvoices.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">No hay facturas este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top Clientes */}
            <Card className="border-zinc-200 dark:border-zinc-800">
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
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{customer.count} compras</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-blue-600">{formatCOP(customer.total)}</span>
                    </div>
                  ))}
                  {topLists.topCustomers.length === 0 && (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-4">No hay clientes con compras este mes</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Section 5: Quick Actions */}
        <Card className="border-zinc-200 dark:border-zinc-800">
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
              <Button variant="outline" onClick={() => navigate('/sistema/gastos')}>
                <Wallet className="w-4 h-4 mr-2" />
                Gestionar Gastos
              </Button>
              <Button variant="outline" onClick={() => navigate('/sistema/clientes')}>
                <Users className="w-4 h-4 mr-2" />
                Ver Clientes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      </>
      )}

      {/* Modal de Facturas Pagas */}
      <Dialog open={activeModal === 'paid'} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
              Facturas Pagas
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-200 dark:border-zinc-800">
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
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                <Receipt className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p>No se encontraron facturas pagas</p>
              </div>
            ) : (
              getFilteredInvoices('paid').map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 dark:bg-emerald-900/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{invoice.number}</span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{extractColombiaDateTime(invoice.date)}</span>
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

          <div className="grid grid-cols-2 gap-4 py-4 border-y border-zinc-200 dark:border-zinc-800">
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
              <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                <CreditCard className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                <p>No se encontraron facturas a crédito</p>
              </div>
            ) : (
              getFilteredInvoices('credit').map((invoice) => (
                <div
                  key={invoice.id}
                  className="p-4 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 dark:bg-blue-900/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{invoice.number}</span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400">{extractColombiaDateTime(invoice.date)}</span>
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
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Fecha y Hora</p>
                  <p className="font-medium">{extractColombiaDateTime(selectedInvoice.date)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Estado</p>
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
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Cliente</p>
                    <p className="font-medium">{selectedInvoice.customer_name}</p>
                  </div>
                )}
                {selectedInvoice.customer_document && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Documento</p>
                    <p className="font-medium">{selectedInvoice.customer_document}</p>
                  </div>
                )}
                {selectedInvoice.payment_method && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Método de Pago</p>
                    <p className="font-medium">{selectedInvoice.payment_method}</p>
                  </div>
                )}
                {selectedInvoice.attended_by && (
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Atendido por</p>
                    <p className="font-medium">{selectedInvoice.attended_by}</p>
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-3">Productos</h3>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, idx) => (
                    <div key={idx} className="p-3 bg-zinc-50 rounded border border-zinc-200 dark:border-zinc-800">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-zinc-500 dark:text-zinc-400">Código: {item.productCode}</p>
                          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            {item.quantity} x {formatCOP(item.price)}
                          </p>
                        </div>
                        <p className="font-bold text-lg">{formatCOP(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800">
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

          <DialogFooter className="flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsThermalPrintDialogOpen(false);
                setIsPrintDialogOpen(true);
              }}
            >
              Volver
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleThermalPrint}
              disabled={!isPrintingAvailable()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Tirilla
            </Button>
          </DialogFooter>
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
                  (inv.status === 'paid' || inv.status === 'partial_return') &&
                  !inv.is_credit
                );
                const totalPaidInvoices = paidInvoices.reduce((sum, inv) => sum + inv.total, 0);

                return (
                  <>
                    {paidInvoices.length > 0 ? (
                      <div className="border border-emerald-300 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-emerald-100 dark:bg-emerald-900/30 sticky top-0">
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
                      <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg border border-emerald-200">
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
                      <div className="border border-red-300 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-red-100 dark:bg-red-900/30 sticky top-0">
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
                      <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg border border-red-200">
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
                  ex.status !== 'pending' && extractColombiaDate(ex.date).startsWith(stats.thisMonth)
                );
                const totalExchangeImpact = monthExchanges.reduce((sum, ex) => sum + ex.price_difference, 0);
                const positiveExchanges = monthExchanges.filter(ex => ex.price_difference > 0);
                const negativeExchanges = monthExchanges.filter(ex => ex.price_difference < 0);
                const neutralExchanges = monthExchanges.filter(ex => ex.price_difference === 0);

                return (
                  <>
                    {monthExchanges.length > 0 ? (
                      <div className="border border-blue-300 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
                        <div className="max-h-60 overflow-y-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-blue-100 dark:bg-blue-900/30 sticky top-0">
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
                                        <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 text-xs">Upgrade</Badge>
                                      ) : ex.price_difference < 0 ? (
                                        <Badge className="bg-orange-100 text-orange-700 text-xs">Downgrade</Badge>
                                      ) : (
                                        <Badge variant="secondary" className="text-xs">Neutro</Badge>
                                      )}
                                    </td>
                                    <td className={`py-2 px-3 text-right font-semibold ${
                                      ex.price_difference > 0 ? 'text-emerald-600' :
                                      ex.price_difference < 0 ? 'text-red-600' :
                                      'text-zinc-600 dark:text-zinc-400'
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
                      <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg border border-blue-200">
                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-zinc-300" />
                        <p className="text-sm">No hay cambios este mes</p>
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      <div className="flex justify-between items-center px-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Cambios positivos ({positiveExchanges.length}):</span>
                        <span className="text-emerald-600 font-medium">
                          +{formatCOP(positiveExchanges.reduce((sum, ex) => sum + ex.price_difference, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Cambios negativos ({negativeExchanges.length}):</span>
                        <span className="text-red-600 font-medium">
                          {formatCOP(negativeExchanges.reduce((sum, ex) => sum + ex.price_difference, 0))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center px-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <span>Cambios neutros ({neutralExchanges.length}):</span>
                        <span className="text-zinc-600 dark:text-zinc-400 font-medium">{formatCOP(0)}</span>
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
                      <div className="border border-purple-300 rounded-lg overflow-hidden bg-white dark:bg-zinc-900">
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
                      <div className="text-center py-6 text-zinc-500 dark:text-zinc-400 bg-white dark:bg-zinc-900 rounded-lg border border-purple-200">
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
                <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-700">Facturas Pagas</span>
                  <span className="font-semibold text-emerald-600">+{formatCOP(stats.currentMonth.facturasPagas)}</span>
                </div>
                {stats.currentMonth.abonosDelMes > 0 && (
                  <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                    <span className="text-zinc-700">Abonos a Crédito</span>
                    <span className="font-semibold text-emerald-600">+{formatCOP(stats.currentMonth.abonosDelMes)}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-zinc-200 dark:border-zinc-800">
                  <span className="text-zinc-700">Impacto de Cambios</span>
                  <span className={`font-semibold ${
                    stats.currentMonth.impactoCambios > 0 ? 'text-emerald-600' :
                    stats.currentMonth.impactoCambios < 0 ? 'text-red-600' :
                    'text-zinc-600 dark:text-zinc-400'
                  }`}>
                    {stats.currentMonth.impactoCambios > 0 ? '+' : ''}{formatCOP(stats.currentMonth.impactoCambios)}
                  </span>
                </div>
                <div className="flex justify-between py-3 pt-4 border-t-2 border-zinc-400">
                  <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Ingresos Netos</span>
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

      {/* Dialog de Desglose de Costos de Productos */}
      <Dialog open={isCostBreakdownOpen} onOpenChange={setIsCostBreakdownOpen}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-600" />
              Desglose de Costos de Productos
            </DialogTitle>
            <DialogDescription>
              Detalles de los productos incluidos en el cálculo de costos del mes {(() => {
                const targetMonth = isTimeTravel && selectedMonth ? selectedMonth : getColombiaDate().slice(0, 7);
                const [year, month] = targetMonth.split('-');
                const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                return `${monthNames[parseInt(month) - 1]} ${year}`;
              })()}
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const targetMonth = isTimeTravel && selectedMonth ? selectedMonth : getColombiaDate().slice(0, 7);
            const monthInvoices = invoices.filter(inv => extractColombiaDate(inv.date).startsWith(targetMonth));

            // Para costos e ingresos: usar todas las facturas pagadas (regulares + créditos pagados)
            // Esto coincide con ingresoNeto = facturasPagas + creditosPagados
            const facturasParaCostos = monthInvoices.filter((inv) => inv.status === 'paid' || inv.status === 'partial_return');

            // Agrupar productos
            const productMap = new Map<string, {
              productId: string;
              productName: string;
              quantity: number;
              unitCost: number;
              totalCost: number;
              totalRevenue: number;
              averageRevenue: number;
              profitMargin: number;
            }>();

            // Procesar TODAS las facturas pagadas para capturar tanto costos como ingresos
            facturasParaCostos.forEach((invoice) => {
              invoice.items.forEach((item) => {
                const product = products.find((p) => p.id === item.productId);
                const unitCost = product?.current_cost || 0;

                const existing = productMap.get(item.productId);
                if (existing) {
                  existing.quantity += item.quantity;
                  existing.totalCost += unitCost * item.quantity;
                  existing.totalRevenue += item.total;
                  existing.averageRevenue = existing.totalRevenue / existing.quantity;
                  existing.profitMargin = existing.averageRevenue > 0
                    ? ((existing.averageRevenue - existing.unitCost) / existing.averageRevenue) * 100
                    : 0;
                } else {
                  const totalCost = unitCost * item.quantity;
                  const totalRevenue = item.total;
                  const averageRevenue = totalRevenue / item.quantity;
                  const profitMargin = averageRevenue > 0
                    ? ((averageRevenue - unitCost) / averageRevenue) * 100
                    : 0;

                  productMap.set(item.productId, {
                    productId: item.productId,
                    productName: item.productName,
                    quantity: item.quantity,
                    unitCost,
                    totalCost,
                    totalRevenue,
                    averageRevenue,
                    profitMargin
                  });
                }
              });
            });

            // Calcular ingresos por separado: regulares vs crédito
            const facturasRegulares = monthInvoices.filter((inv) => (inv.status === 'paid' || inv.status === 'partial_return') && !inv.is_credit);
            const facturasCredito = monthInvoices.filter((inv) => (inv.status === 'paid' || inv.status === 'partial_return') && inv.is_credit);

            let ingresosRegulares = 0;
            let ingresosCredito = 0;

            facturasRegulares.forEach((invoice) => {
              invoice.items.forEach((item) => {
                ingresosRegulares += item.total;
              });
            });

            facturasCredito.forEach((invoice) => {
              invoice.items.forEach((item) => {
                ingresosCredito += item.total;
              });
            });

            const productsList = Array.from(productMap.values()).sort((a, b) => b.totalCost - a.totalCost);
            const totalCost = productsList.reduce((sum, p) => sum + p.totalCost, 0);
            const totalRevenue = productsList.reduce((sum, p) => sum + p.totalRevenue, 0);
            const overallMargin = totalRevenue > 0 ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0;

            return (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20">
                    <CardContent className="p-4">
                      <div className="text-xs text-orange-600 dark:text-orange-400 uppercase mb-1">Costo Total</div>
                      <div className="text-xl font-bold text-orange-700 dark:text-orange-400">{formatCOP(totalCost)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20">
                    <CardContent className="p-4">
                      <div className="text-xs text-emerald-600 dark:text-emerald-400 uppercase mb-1">Ingresos Totales</div>
                      <div className="text-xl font-bold text-emerald-700 dark:text-emerald-400">{formatCOP(totalRevenue)}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
                    <CardContent className="p-4">
                      <div className="text-xs text-blue-600 dark:text-blue-400 uppercase mb-1">Margen Promedio</div>
                      <div className="text-xl font-bold text-blue-700 dark:text-blue-400">{overallMargin.toFixed(1)}%</div>
                    </CardContent>
                  </Card>
                </div>

                {/* Desglose de Ingresos */}
                <Card className="border-zinc-200 dark:border-zinc-800 mb-4">
                  <CardContent className="p-4">
                    <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-3">
                      Desglose de Ingresos
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Facturas regulares pagadas</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCOP(ingresosRegulares)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-zinc-600 dark:text-zinc-400">Facturas crédito pagadas</span>
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatCOP(ingresosCredito)}</span>
                      </div>
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">Total Ingresos</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(totalRevenue)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 dark:bg-zinc-900">
                        <tr>
                          <th className="text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Producto</th>
                          <th className="text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Cantidad</th>
                          <th className="text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Costo Unit.</th>
                          <th className="text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Costo Total</th>
                          <th className="text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Ingreso Prom.</th>
                          <th className="text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400 px-4 py-3">Margen %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {productsList.map((product) => (
                          <tr key={product.productId} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                            <td className="px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100">{product.productName}</td>
                            <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">{product.quantity}</td>
                            <td className="px-4 py-3 text-sm text-right text-zinc-900 dark:text-zinc-100">{formatCOP(product.unitCost)}</td>
                            <td className="px-4 py-3 text-sm text-right font-medium text-orange-600 dark:text-orange-400">{formatCOP(product.totalCost)}</td>
                            <td className="px-4 py-3 text-sm text-right text-emerald-600 dark:text-emerald-400">{formatCOP(product.averageRevenue)}</td>
                            <td className="px-4 py-3 text-sm text-right">
                              <span className={`font-medium ${product.profitMargin >= 20 ? 'text-emerald-600 dark:text-emerald-400' : product.profitMargin >= 10 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                                {product.profitMargin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-zinc-50 dark:bg-zinc-900 border-t-2 border-zinc-300 dark:border-zinc-700">
                        <tr>
                          <td className="px-4 py-3 text-sm font-bold text-zinc-900 dark:text-zinc-100">TOTAL</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-zinc-900 dark:text-zinc-100">
                            {productsList.reduce((sum, p) => sum + p.quantity, 0)}
                          </td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-orange-600 dark:text-orange-400">{formatCOP(totalCost)}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(totalRevenue)}</td>
                          <td className="px-4 py-3 text-sm text-right font-bold text-blue-600 dark:text-blue-400">{overallMargin.toFixed(1)}%</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCostBreakdownOpen(false)}>
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
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 space-y-1">
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
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 space-y-1">
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
                        <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-2">
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
                      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
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
                      <div className="text-center py-8 text-zinc-500 dark:text-zinc-400 bg-zinc-50 rounded-lg border border-zinc-200 dark:border-zinc-800">
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
