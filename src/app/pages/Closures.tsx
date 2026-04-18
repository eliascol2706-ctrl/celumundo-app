import { useState, useEffect } from 'react';
import { Calendar, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import {
  getInvoices,
  getDailyClosures,
  getMonthlyClosures,
  getReturns,
  getCustomers,
  getAllProducts,
  getColombiaDate,
  extractColombiaDate,
  deleteDailyClosure,
  updateClosureDate,
  getExpenses,
  getCreditPayments,
  getExchanges,
} from '../lib/supabase';
import { getServiceOrders, type ServiceOrder } from '../lib/service-orders';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCOP } from '../lib/currency';
import { DailyClosureDialog } from '../components/DailyClosureDialog';
import { MonthlyClosureDialog } from '../components/MonthlyClosureDialog';
import { toast } from 'sonner';

type ClosureView = 'daily' | 'monthly';

export function Closures() {
  const [view, setView] = useState<ClosureView>('daily');
  const [isDailyDialogOpen, setIsDailyDialogOpen] = useState(false);
  const [isMonthlyDialogOpen, setIsMonthlyDialogOpen] = useState(false);
  const [currentPageDaily, setCurrentPageDaily] = useState(1);
  const [currentPageMonthly, setCurrentPageMonthly] = useState(1);
  const itemsPerPage = 10;

  const [invoices, setInvoices] = useState<any[]>([]);
  const [dailyClosures, setDailyClosures] = useState<any[]>([]);
  const [monthlyClosures, setMonthlyClosures] = useState<any[]>([]);
  const [returns, setReturns] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [creditPayments, setCreditPayments] = useState<any[]>([]);
  const [exchanges, setExchanges] = useState<any[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);

  useEffect(() => {
    loadData();
    
    // Exponer la función deleteDailyClosure globalmente para debugging
    (window as any).deleteDailyClosure = async (closureId: string) => {
      const success = await deleteDailyClosure(closureId);
      if (success) {
        console.log('✅ Cierre eliminado exitosamente. Recargando datos...');
        await loadData();
      } else {
        console.error('❌ Error al eliminar el cierre.');
      }
      return success;
    };
  }, []);

  const loadData = async () => {
    const [invoicesData, dailyClosuresData, monthlyClosuresData, returnsData, customersData, productsData, expensesData, creditPaymentsData, exchangesData, serviceOrdersData] = await Promise.all([
      getInvoices(),
      getDailyClosures(),
      getMonthlyClosures(),
      getReturns(),
      getCustomers(),
      getAllProducts(),
      getExpenses(),
      getCreditPayments(),
      getExchanges(),
      getServiceOrders(),
    ]);
    setInvoices(invoicesData);
    setDailyClosures(dailyClosuresData);
    setMonthlyClosures(monthlyClosuresData);
    setReturns(returnsData);
    setCustomers(customersData);
    setProducts(productsData);
    setExpenses(expensesData);
    setCreditPayments(creditPaymentsData);
    setExchanges(exchangesData);
    setServiceOrders(serviceOrdersData);
    
    // DEBUG: Ver qué cierres tenemos guardados
    console.log('[DEBUG Closures] Cierres diarios guardados:', dailyClosuresData.map(c => ({ id: c.id, date: c.date, closed_by: c.closed_by })));
    console.log('[DEBUG Closures] Fecha actual Colombia:', getColombiaDate());
    
    // Detectar cierres incorrectos - CALCULAR AYER CORRECTAMENTE SIN UTC
    const today = getColombiaDate();
    // Calcular ayer usando Date pero convirtiendo el resultado
    const todayDate = new Date(today + 'T12:00:00'); // Usar mediodía para evitar problemas de zona horaria
    todayDate.setDate(todayDate.getDate() - 1);
    // Extraer fecha en formato Colombia (no usar toISOString)
    const year = todayDate.getFullYear();
    const month = String(todayDate.getMonth() + 1).padStart(2, '0');
    const day = String(todayDate.getDate()).padStart(2, '0');
    const yesterday = `${year}-${month}-${day}`;
    
    const todayClosures = dailyClosuresData.filter(c => extractColombiaDate(c.date) === today);
    const yesterdayClosures = dailyClosuresData.filter(c => extractColombiaDate(c.date) === yesterday);
    
    if (todayClosures.length > 0 && yesterdayClosures.length === 0) {
      console.warn('⚠️ ADVERTENCIA: Hay cierres del día de hoy, pero NO hay cierres de ayer.');
      console.warn('⚠️ Si acabas de hacer un cierre y aún no puedes facturar, es posible que el cierre se haya guardado con la fecha incorrecta.');
      console.warn('⚠️ SOLUCIÓN: Elimina el cierre incorrecto ejecutando este comando en la consola:');
      console.warn(`   deleteDailyClosure("${todayClosures[0].id}")`);
      console.warn('⚠️ Luego recarga la página y vuelve a hacer el cierre.');
    }
  };

  const getTodayInvoices = () => {
    const today = getColombiaDate();
    return invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate === today;
    });
  };
  
  // Nueva función para obtener el día que se debe cerrar
  const getDayToClose = () => {
    const today = getColombiaDate();
    
    // Verificar si ya existe un cierre para hoy
    const hasTodayClosure = dailyClosures.some(closure => {
      const closureDate = extractColombiaDate(closure.date);
      return closureDate === today;
    });
    
    // Si ya hay cierre de hoy, no se puede cerrar
    if (hasTodayClosure) {
      return null;
    }
    
    // Verificar si hay facturas de hoy
    const todayInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate === today;
    });
    
    if (todayInvoices.length > 0) {
      // Si hay facturas de hoy, cerrar el día de hoy
      return today;
    }
    
    // Si no hay facturas de hoy, buscar el día anterior sin cierre - CALCULAR SIN UTC
    const todayDate = new Date(today + 'T12:00:00'); // Usar mediodía para evitar problemas
    todayDate.setDate(todayDate.getDate() - 1);
    // Extraer fecha sin usar toISOString
    const year = todayDate.getFullYear();
    const month = String(todayDate.getMonth() + 1).padStart(2, '0');
    const day = String(todayDate.getDate()).padStart(2, '0');
    const yesterday = `${year}-${month}-${day}`;
    
    const hasYesterdayClosure = dailyClosures.some(closure => {
      const closureDate = extractColombiaDate(closure.date);
      return closureDate === yesterday;
    });
    
    const yesterdayInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate === yesterday;
    });
    
    // Si hay facturas de ayer y no hay cierre, cerrar ayer
    if (yesterdayInvoices.length > 0 && !hasYesterdayClosure) {
      return yesterday;
    }
    
    // No hay nada que cerrar
    return null;
  };
  
  // Nueva función para obtener facturas del día a cerrar
  const getInvoicesToClose = () => {
    const dayToClose = getDayToClose();
    if (!dayToClose) return [];
    
    return invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate === dayToClose;
    });
  };

  const getCurrentMonthClosures = () => {
    const currentMonth = getColombiaDate().substring(0, 7);
    return dailyClosures.filter(closure => {
      const closureDate = extractColombiaDate(closure.date);
      return closureDate && closureDate.substring(0, 7) === currentMonth;
    });
  };

  const calculateDailyStats = () => {
    const todayInvoices = getInvoicesToClose();
    const today = getDayToClose();

    const totalInvoices = todayInvoices.length;
    const regularInvoices = todayInvoices.filter(inv => inv.type === 'regular').length;
    const wholesaleInvoices = todayInvoices.filter(inv => inv.type === 'wholesale').length;

    const creditInvoices = todayInvoices.filter(inv => inv.is_credit);
    const pendingCreditBalance = creditInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

    // CORRECCIÓN: Incluir facturas pagadas, parcialmente devueltas y completamente devueltas
    // Estas facturas SÍ generaron ingresos brutos, las devoluciones se restan por separado
    const grossRevenue = todayInvoices
      .filter(inv => inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned')
      .reduce((sum, inv) => sum + inv.total, 0);

    // CAMBIO CRÍTICO: Filtrar devoluciones por la fecha de la factura original, NO por la fecha de la devolución
    // Ejemplo: Si una factura del día 27 se devuelve el día 28, la devolución cuenta para el cierre del día 27
    const todayReturns = returns.filter(ret => {
      // Buscar la factura original
      const originalInvoice = invoices.find(inv => inv.id === ret.invoice_id);
      if (!originalInvoice) return false;

      // Solo contar la devolución si la factura original es del día que se está cerrando
      const invoiceDate = extractColombiaDate(originalInvoice.date);
      return invoiceDate === today;
    });

    const totalReturns = todayReturns.reduce((sum, ret) => sum + ret.total, 0);

    // NUEVO: Filtrar órdenes de servicio pagadas del día
    const todayServiceOrders = serviceOrders.filter(order => {
      const orderDate = extractColombiaDate(order.received_date);
      return orderDate === today && order.payment_status === 'paid' && order.final_price;
    });

    // NUEVO: Ingresos de servicio técnico
    const serviceRevenue = todayServiceOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);
    
    // FILTRAR ABONOS A CRÉDITO DEL DÍA - usar extractColombiaDate para evitar problemas de zona horaria
    const todayCreditPayments = creditPayments.filter(payment => {
      if (!payment.date) return false;
      const paymentDate = extractColombiaDate(payment.date);
      return paymentDate === today;
    });

    // FILTRAR CAMBIOS DEL DÍA - usar extractColombiaDate para evitar problemas de zona horaria
    const todayExchanges = exchanges.filter(exchange => {
      if (!exchange.date) return false;
      const exchangeDate = extractColombiaDate(exchange.date);
      return exchangeDate === today;
    });
    
    console.log(`[DEBUG Cierres] Día a cerrar: ${today}`);
    console.log(`[DEBUG Cierres] Facturas del día: ${todayInvoices.length}`);
    console.log(`[DEBUG Cierres] Devoluciones que afectan este día: ${todayReturns.length}`);
    console.log(`[DEBUG Cierres] Total devoluciones: ${formatCOP(totalReturns)}`);
    console.log(`[DEBUG Cierres] Abonos a crédito del día: ${todayCreditPayments.length}`);
    console.log(`[DEBUG Cierres] Total abonos: ${formatCOP(todayCreditPayments.reduce((sum, p) => sum + p.amount, 0))}`);
    console.log(`[DEBUG Cierres] Cambios del día: ${todayExchanges.length}`);
    console.log(`[DEBUG Cierres] Órdenes de servicio técnico: ${todayServiceOrders.length}`);
    console.log(`[DEBUG Cierres] Ingresos servicio técnico: ${formatCOP(serviceRevenue)}`);

    return {
      totalInvoices,
      regularInvoices,
      wholesaleInvoices,
      invoices: todayInvoices,
      creditInvoices: creditInvoices.length,
      pendingCreditBalance,
      grossRevenue,
      totalReturns,
      serviceRevenue, // NUEVO: Ingresos de servicio técnico
      netRevenue: grossRevenue - totalReturns + serviceRevenue, // MODIFICADO: Incluir servicio técnico
      totalProductsSold: todayInvoices
        .filter(inv => inv.status === 'paid')
        .reduce((sum, inv) => {
          return sum + inv.items.reduce((itemSum: number, item: any) => itemSum + item.quantity, 0);
        }, 0),
      creditPayments: todayCreditPayments, // Incluir abonos del día
      exchanges: todayExchanges, // NUEVO: Incluir cambios del día
    };
  };

  const calculateMonthlyStats = () => {
    const currentMonthClosures = getCurrentMonthClosures();
    const totalRevenue = currentMonthClosures.reduce((sum, closure) => sum + closure.total, 0);

    // Obtener mes actual y anterior usando fecha de Colombia - SIN UTC
    const currentColombiaDate = getColombiaDate();
    const currentMonthStr = currentColombiaDate.substring(0, 7);
    
    // Calcular mes anterior usando fecha de Colombia - SIN toISOString
    const currentDate = new Date(currentColombiaDate + 'T12:00:00'); // Mediodía para evitar problemas
    currentDate.setMonth(currentDate.getMonth() - 1);
    // Extraer mes anterior sin usar toISOString
    const prevYear = currentDate.getFullYear();
    const prevMonth = String(currentDate.getMonth() + 1).padStart(2, '0');
    const previousMonthStr = `${prevYear}-${prevMonth}`;

    const previousMonthInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate.substring(0, 7) === previousMonthStr && (inv.status === 'paid' || inv.status === 'partial_return');
    });
    const previousMonthRevenue = previousMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Calcular impacto de cambios del mes anterior
    const previousMonthExchanges = exchanges.filter(ex => {
      if (!ex.date) return false;
      const exDate = extractColombiaDate(ex.date);
      return exDate.substring(0, 7) === previousMonthStr;
    });
    const previousMonthExchangeImpact = previousMonthExchanges.reduce((sum, exchange) => {
      if (exchange.price_difference > 0) {
        return sum + exchange.price_difference;
      } else if (exchange.price_difference < 0) {
        return sum + exchange.price_difference;
      }
      return sum;
    }, 0);

    // NUEVO: Calcular ingresos de servicio técnico del mes anterior
    const previousMonthServiceOrders = serviceOrders.filter(order => {
      const orderDate = extractColombiaDate(order.received_date);
      return orderDate.substring(0, 7) === previousMonthStr && order.payment_status === 'paid' && order.final_price;
    });
    const previousMonthServiceRevenue = previousMonthServiceOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);

    const previousMonthNetRevenue = previousMonthRevenue + previousMonthExchangeImpact + previousMonthServiceRevenue;

    const currentMonthInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate.substring(0, 7) === currentMonthStr && (inv.status === 'paid' || inv.status === 'partial_return');
    });
    const currentMonthRevenue = currentMonthInvoices.reduce((sum, inv) => sum + inv.total, 0);

    // Calcular impacto de cambios del mes actual
    const currentMonthExchanges = exchanges.filter(ex => {
      if (!ex.date) return false;
      const exDate = extractColombiaDate(ex.date);
      return exDate.substring(0, 7) === currentMonthStr;
    });
    const currentMonthExchangeImpact = currentMonthExchanges.reduce((sum, exchange) => {
      if (exchange.price_difference > 0) {
        return sum + exchange.price_difference; // Cliente pagó diferencia
      } else if (exchange.price_difference < 0) {
        return sum + exchange.price_difference; // Se devolvió dinero (negativo)
      }
      return sum;
    }, 0);

    // NUEVO: Calcular ingresos de servicio técnico del mes actual
    const currentMonthServiceOrders = serviceOrders.filter(order => {
      const orderDate = extractColombiaDate(order.received_date);
      return orderDate.substring(0, 7) === currentMonthStr && order.payment_status === 'paid' && order.final_price;
    });
    const currentMonthServiceRevenue = currentMonthServiceOrders.reduce((sum, order) => sum + (order.final_price || 0), 0);

    // Calcular créditos pendientes del mes actual
    const currentMonthCreditInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate.substring(0, 7) === currentMonthStr && inv.is_credit;
    });
    const totalPendingCredit = currentMonthCreditInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

    // Calcular créditos pendientes del mes anterior
    const previousMonthCreditInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate.substring(0, 7) === previousMonthStr && inv.is_credit;
    });
    const previousMonthPendingCredit = previousMonthCreditInvoices
      .filter(inv => inv.status === 'pending')
      .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

    // Calcular gastos del mes actual
    const currentMonthExpenses = expenses.filter(expense => {
      if (!expense.date) return false;
      const expenseDate = extractColombiaDate(expense.date);
      return expenseDate.substring(0, 7) === currentMonthStr;
    });
    const totalExpenses = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // Los ingresos netos incluyen las facturas pagadas + el impacto de cambios + servicio técnico
    // Las facturas 'returned' ya no se cuentan en currentMonthRevenue
    const netRevenue = currentMonthRevenue + currentMonthExchangeImpact + currentMonthServiceRevenue;

    // Calcular costo de productos vendidos en el mes
    let totalProductCost = 0;
    currentMonthInvoices.forEach(invoice => {
      if (invoice.items && Array.isArray(invoice.items)) {
        invoice.items.forEach((item: any) => {
          const product = products.find(p => p.id === item.productId);
          if (product && product.current_cost) {
            totalProductCost += product.current_cost * item.quantity;
          }
        });
      }
    });

    // Calcular ganancias reales (ingresos netos - costo de productos - gastos)
    const realProfit = netRevenue - totalProductCost - totalExpenses;

    // Crear objetos Date para obtener nombres de meses en español
    const previousMonthDate = new Date(previousMonthStr + '-01T12:00:00');
    const currentMonthDate = new Date(currentMonthStr + '-01T12:00:00');

    const comparisonData = [
      {
        id: 'prev-month',
        name: previousMonthDate.toLocaleDateString('es-ES', { month: 'short' }),
        ventas: previousMonthNetRevenue,
      },
      {
        id: 'current-month',
        name: currentMonthDate.toLocaleDateString('es-ES', { month: 'short' }),
        ventas: netRevenue,
      },
    ];

    const creditComparisonData = [
      {
        id: 'prev-month-credit',
        name: previousMonthDate.toLocaleDateString('es-ES', { month: 'short' }),
        creditos: previousMonthPendingCredit,
      },
      {
        id: 'current-month-credit',
        name: currentMonthDate.toLocaleDateString('es-ES', { month: 'short' }),
        creditos: totalPendingCredit,
      },
    ];

    // Datos de ventas diarias del mes
    const dailySalesData = currentMonthClosures.map((closure, index) => ({
      id: `day-${index}`,
      day: new Date(closure.date + 'T12:00:00').getDate().toString(),
      sales: closure.total,
    }));

    return {
      closures: currentMonthClosures,
      totalRevenue,
      totalInvoices: currentMonthInvoices.length,
      totalPendingCredit,
      totalExpenses,
      comparisonData,
      creditComparisonData,
      dailySalesData,
      currentMonthRevenue,
      previousMonthRevenue,
      netRevenue,
      previousMonthNetRevenue,
      totalProductCost,
      realProfit,
      serviceRevenue: currentMonthServiceRevenue, // NUEVO: Ingresos de servicio técnico
    };
  };

  const calculateHourlyData = () => {
    const todayInvoices = getTodayInvoices();
    const hourlyMap = new Map<number, number>();

    // Inicializar todas las horas con 0
    for (let i = 0; i < 24; i++) {
      hourlyMap.set(i, 0);
    }

    // Sumar ventas por hora - USAR ZONA HORARIA DE COLOMBIA
    todayInvoices.forEach(inv => {
      if (inv.date && inv.status === 'paid') {
        // Convertir la fecha a hora de Colombia usando toLocaleString
        const colombiaDateStr = new Date(inv.date).toLocaleString('en-US', { timeZone: 'America/Bogota' });
        const colombiaDate = new Date(colombiaDateStr);
        const hour = colombiaDate.getHours();
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + inv.total);
      }
    });

    // Convertir a array - usar solo horas con ventas o todas las horas del día
    return Array.from(hourlyMap.entries())
      .filter(([_, sales]) => sales > 0 || true) // Mostrar todas las horas
      .map(([hour, sales]) => ({
        hour: `${hour.toString().padStart(2, '0')}:00`,
        sales,
      }));
  };

  const calculateTopProducts = () => {
    const todayInvoices = getTodayInvoices();
    const productSales: { [key: string]: { name: string; quantity: number; revenue: number } } = {};

    todayInvoices.forEach(invoice => {
      if (invoice.status === 'paid') {
        invoice.items.forEach((item: any) => {
          if (!productSales[item.productId]) {
            productSales[item.productId] = { name: item.productName, quantity: 0, revenue: 0 };
          }
          productSales[item.productId].quantity += item.quantity;
          productSales[item.productId].revenue += item.total;
        });
      }
    });

    return Object.values(productSales)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  };

  const dailyStats = calculateDailyStats();
  const monthlyStats = calculateMonthlyStats();
  const hourlyData = calculateHourlyData();
  const topProducts = calculateTopProducts();

  const hasCurrentMonthClosure = () => {
    const currentMonth = getColombiaDate().substring(0, 7);
    return monthlyClosures.some(closure => closure.month === currentMonth);
  };

  // Verificar si es un nuevo mes sin cierre mensual del mes anterior
  const needsMonthlyClose = () => {
    const today = getColombiaDate();
    
    // Calcular ayer sin usar toISOString - SIN UTC
    const todayDate = new Date(today + 'T12:00:00'); // Mediodía para evitar problemas
    todayDate.setDate(todayDate.getDate() - 1);
    // Extraer fecha sin usar toISOString
    const year = todayDate.getFullYear();
    const month = String(todayDate.getMonth() + 1).padStart(2, '0');
    const day = String(todayDate.getDate()).padStart(2, '0');
    const yesterdayStr = `${year}-${month}-${day}`;

    const currentMonth = today.substring(0, 7);
    const yesterdayMonth = yesterdayStr.substring(0, 7);

    // Si es día 1 de un nuevo mes (ayer era otro mes)
    if (currentMonth !== yesterdayMonth) {
      // Verificar si existe cierre mensual del mes anterior
      const hasPreviousMonthClosure = monthlyClosures.some(closure => closure.month === yesterdayMonth);

      // Verificar si realmente hubo facturas en el mes anterior usando extractColombiaDate
      const previousMonthInvoices = invoices.filter(inv => {
        if (!inv.date) return false;
        const invDate = extractColombiaDate(inv.date);
        return invDate.substring(0, 7) === yesterdayMonth;
      });

      // Solo pedir el cierre mensual si:
      // 1. NO existe un cierre mensual del mes anterior
      // 2. Hay cierres diarios en total (el sistema está en uso)
      // 3. Realmente hubo facturas en el mes anterior
      if (!hasPreviousMonthClosure && dailyClosures.length > 0 && previousMonthInvoices.length > 0) {
        const previousMonthDate = new Date(yesterdayStr + 'T12:00:00');
        const monthName = previousMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return { needed: true, monthName };
      }
    }
    return { needed: false };
  };

  const handleOpenClosureDialog = () => {
    if (view === 'daily') {
      if (dailyStats.totalInvoices === 0) {
        toast.error('No hay facturas para cerrar hoy');
        return;
      }
      setIsDailyDialogOpen(true);
    } else {
      if (hasCurrentMonthClosure()) {
        toast.error('Ya existe un cierre para este mes');
        return;
      }
      if (getCurrentMonthClosures().length === 0) {
        toast.error('No hay cierres diarios en este mes para realizar el cierre mensual');
        return;
      }
      setIsMonthlyDialogOpen(true);
    }
  };

  const getInvoiceStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      paid: 'Pagada',
      pending: 'Pendiente',
      cancelled: 'Cancelada',
      partial_return: 'Parcialmente Devuelta',
      returned: 'Devuelta Completa',
    };
    return labels[status] || status;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Cierres</h2>
          <p className="text-muted-foreground mt-1">Gestión de cierres diarios y mensuales</p>
        </div>
      </div>

      {/* Alerta de cierre mensual requerido */}
      {needsMonthlyClose().needed && (
        <Card className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-8 w-8 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-orange-900 dark:text-orange-100 mb-2">
                  ⚠️ Cierre Mensual Requerido
                </h3>
                <p className="text-orange-800 dark:text-orange-200 mb-3">
                  Es un nuevo mes y necesitas realizar el <strong>Cierre Mensual de {needsMonthlyClose().monthName}</strong> antes de continuar facturando.
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
                  El sistema bloqueará la creación de nuevas facturas hasta que se complete este cierre.
                </p>
                <Button
                  onClick={() => {
                    setView('monthly');
                    setTimeout(() => {
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }, 100);
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Realizar Cierre Mensual Ahora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* View Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Button
              onClick={() => setView('daily')}
              variant={view === 'daily' ? 'default' : 'outline'}
              className={view === 'daily' ? '' : 'hover:bg-green-50 dark:hover:bg-green-950'}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Cierre Diario
            </Button>
            <Button
              onClick={() => setView('monthly')}
              variant={view === 'monthly' ? 'default' : 'outline'}
              className={view === 'monthly' ? '' : 'hover:bg-green-50 dark:hover:bg-green-950'}
            >
              <FileText className="h-4 w-4 mr-2" />
              Cierre Mensual
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Daily Closure View */}
      {view === 'daily' && (
        <>
          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Facturas Totales del Día
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {dailyStats.totalInvoices}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ingresos Brutos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  COP {formatCOP(dailyStats.grossRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Créditos Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  COP {formatCOP(dailyStats.pendingCreditBalance)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Invoices Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Facturas de Hoy</CardTitle>
                <Button onClick={handleOpenClosureDialog} disabled={dailyStats.totalInvoices === 0}>
                  {dailyStats.totalInvoices === 0 ? 'No hay facturas para cerrar' : 'Finalizar Cierre'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-sm font-medium">Número</th>
                      <th className="text-left py-2 px-3 text-sm font-medium">Tipo</th>
                      <th className="text-left py-2 px-3 text-sm font-medium">Cliente</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                      <th className="text-center py-2 px-3 text-sm font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyStats.invoices.map((invoice) => (
                      <tr key={invoice.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-2 px-3 text-sm font-medium">{invoice.number}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            invoice.type === 'regular' 
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' 
                              : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                          }`}>
                            {invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-sm">{invoice.customer_name || '-'}</td>
                        <td className="py-2 px-3 text-right text-sm font-medium text-green-600 dark:text-green-400">
                          COP {formatCOP(invoice.total)}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            invoice.status === 'paid'
                              ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                              : invoice.status === 'pending'
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                              : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          }`}>
                            {getInvoiceStatusLabel(invoice.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {dailyStats.invoices.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted-foreground">
                          No hay facturas hoy
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Daily Closures History */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Cierres Diarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-sm font-medium">Fecha</th>
                      <th className="text-center py-2 px-3 text-sm font-medium">Facturas</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Efectivo</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Transferencias</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Ganancias</th>
                      <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const reversedClosures = dailyClosures.slice().reverse();
                      const totalPages = Math.ceil(reversedClosures.length / itemsPerPage);
                      const startIndex = (currentPageDaily - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedClosures = reversedClosures.slice(startIndex, endIndex);

                      return (
                        <>
                          {paginatedClosures.map((closure) => (
                            <tr key={closure.id} className="border-b border-border hover:bg-muted/50">
                              <td className="py-2 px-3 text-sm">
                                {new Date(closure.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                              </td>
                              <td className="py-2 px-3 text-center text-sm">{closure.total_invoices}</td>
                              <td className="py-2 px-3 text-right text-sm">COP {formatCOP(closure.total_cash)}</td>
                              <td className="py-2 px-3 text-right text-sm">COP {formatCOP(closure.total_transfer)}</td>
                              <td className="py-2 px-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                                COP {formatCOP(closure.total)}
                              </td>
                              <td className="py-2 px-3 text-right text-sm font-bold text-blue-600 dark:text-blue-400">
                                COP {formatCOP(closure.total_profit || 0)}
                              </td>
                              <td className="py-2 px-3 text-sm">{closure.closed_by}</td>
                            </tr>
                          ))}
                          {paginatedClosures.length === 0 && (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-muted-foreground">
                                No hay cierres registrados
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Paginación Diaria */}
              {dailyClosures.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPageDaily - 1) * itemsPerPage + 1} - {Math.min(currentPageDaily * itemsPerPage, dailyClosures.length)} de {dailyClosures.length} cierres
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageDaily(prev => Math.max(1, prev - 1))}
                      disabled={currentPageDaily === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(dailyClosures.length / itemsPerPage) }, (_, i) => i + 1).map(page => {
                        const totalPages = Math.ceil(dailyClosures.length / itemsPerPage);
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPageDaily - 1 && page <= currentPageDaily + 1)
                        ) {
                          return (
                            <Button
                              key={page}
                              variant={currentPageDaily === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPageDaily(page)}
                              className="min-w-[40px]"
                            >
                              {page}
                            </Button>
                          );
                        } else if (page === currentPageDaily - 2 || page === currentPageDaily + 2) {
                          return <span key={page} className="px-2 text-muted-foreground">...</span>;
                        }
                        return null;
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageDaily(prev => Math.min(Math.ceil(dailyClosures.length / itemsPerPage), prev + 1))}
                      disabled={currentPageDaily === Math.ceil(dailyClosures.length / itemsPerPage)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Monthly Closure View */}
      {view === 'monthly' && (
        <>
          {/* Monthly Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Generado del Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  COP {formatCOP(monthlyStats.netRevenue)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Facturas Totales del Mes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {monthlyStats.totalInvoices}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Comparación Mensual de Ventas</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={monthlyStats.comparisonData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => `COP ${formatCOP(value)}`} />
                  <Legend />
                  <Bar dataKey="ventas" fill="#16a34a" name="Ventas" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-sm">
                  {monthlyStats.netRevenue > monthlyStats.previousMonthNetRevenue ? (
                    <span className="text-green-600 dark:text-green-400 font-medium flex items-center">
                      <TrendingUp className="h-4 w-4 mr-1" />
                      Incremento de COP {formatCOP(monthlyStats.netRevenue - monthlyStats.previousMonthNetRevenue)} respecto al mes anterior
                    </span>
                  ) : monthlyStats.netRevenue < monthlyStats.previousMonthNetRevenue ? (
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      ↓ Disminución de COP {formatCOP(monthlyStats.previousMonthNetRevenue - monthlyStats.netRevenue)} respecto al mes anterior
                    </span>
                  ) : (
                    <span className="text-muted-foreground font-medium">
                      Sin cambios respecto al mes anterior
                    </span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Closures Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Cierres del Mes</CardTitle>
                <Button onClick={handleOpenClosureDialog} disabled={hasCurrentMonthClosure()}>
                  {hasCurrentMonthClosure() ? 'Cierre Ya Realizado' : 'Finalizar Cierre'}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-sm font-medium">Fecha</th>
                      <th className="text-center py-2 px-3 text-sm font-medium">Facturas</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Efectivo</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Transferencias</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                      <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyStats.closures.map((closure) => (
                      <tr key={closure.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-2 px-3 text-sm">
                          {new Date(closure.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                        </td>
                        <td className="py-2 px-3 text-center text-sm">{closure.total_invoices}</td>
                        <td className="py-2 px-3 text-right text-sm">COP {formatCOP(closure.total_cash)}</td>
                        <td className="py-2 px-3 text-right text-sm">COP {formatCOP(closure.total_transfer)}</td>
                        <td className="py-2 px-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                          COP {formatCOP(closure.total)}
                        </td>
                        <td className="py-2 px-3 text-sm">{closure.closed_by}</td>
                      </tr>
                    ))}
                    {monthlyStats.closures.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-muted-foreground">
                          No hay cierres este mes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Monthly Closures History */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de Cierres Mensuales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 text-sm font-medium">Mes</th>
                      <th className="text-center py-2 px-3 text-sm font-medium">Año</th>
                      <th className="text-center py-2 px-3 text-sm font-medium">Facturas</th>
                      <th className="text-right py-2 px-3 text-sm font-medium">Total</th>
                      <th className="text-left py-2 px-3 text-sm font-medium">Cerrado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const reversedClosures = monthlyClosures.slice().reverse();
                      const totalPages = Math.ceil(reversedClosures.length / itemsPerPage);
                      const startIndex = (currentPageMonthly - 1) * itemsPerPage;
                      const endIndex = startIndex + itemsPerPage;
                      const paginatedClosures = reversedClosures.slice(startIndex, endIndex);

                      return (
                        <>
                          {paginatedClosures.map((closure) => (
                            <tr key={closure.id} className="border-b border-border hover:bg-muted/50">
                              <td className="py-2 px-3 text-sm">
                                {new Date(closure.month + '-01').toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' })}
                              </td>
                              <td className="py-2 px-3 text-center text-sm">{closure.year}</td>
                              <td className="py-2 px-3 text-center text-sm">{closure.totalInvoices}</td>
                              <td className="py-2 px-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                                COP {formatCOP(closure.totalRevenue)}
                              </td>
                              <td className="py-2 px-3 text-sm">{closure.closedBy}</td>
                            </tr>
                          ))}
                          {paginatedClosures.length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                No hay cierres mensuales registrados
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Paginación Mensual */}
              {monthlyClosures.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPageMonthly - 1) * itemsPerPage + 1} - {Math.min(currentPageMonthly * itemsPerPage, monthlyClosures.length)} de {monthlyClosures.length} cierres
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageMonthly(prev => Math.max(1, prev - 1))}
                      disabled={currentPageMonthly === 1}
                    >
                      Anterior
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.ceil(monthlyClosures.length / itemsPerPage) }, (_, i) => i + 1).map(page => {
                        const totalPages = Math.ceil(monthlyClosures.length / itemsPerPage);
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPageMonthly - 1 && page <= currentPageMonthly + 1)
                        ) {
                          return (
                            <Button
                              key={page}
                              variant={currentPageMonthly === page ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPageMonthly(page)}
                              className="min-w-[40px]"
                            >
                              {page}
                            </Button>
                          );
                        } else if (page === currentPageMonthly - 2 || page === currentPageMonthly + 2) {
                          return <span key={page} className="px-2 text-muted-foreground">...</span>;
                        }
                        return null;
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPageMonthly(prev => Math.min(Math.ceil(monthlyClosures.length / itemsPerPage), prev + 1))}
                      disabled={currentPageMonthly === Math.ceil(monthlyClosures.length / itemsPerPage)}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Dialogs */}
      <DailyClosureDialog
        open={isDailyDialogOpen}
        onOpenChange={setIsDailyDialogOpen}
        dailyStats={dailyStats}
        dayToClose={getDayToClose() || getColombiaDate()}
        hourlyData={hourlyData}
        topProducts={topProducts}
        products={products}
        onSuccess={loadData}
      />

      <MonthlyClosureDialog
        open={isMonthlyDialogOpen}
        onOpenChange={setIsMonthlyDialogOpen}
        monthlyStats={monthlyStats}
        onSuccess={loadData}
      />
    </div>
  );
}