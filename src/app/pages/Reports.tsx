import { useState, useEffect, useRef } from 'react';
import { Package, DollarSign, TrendingDown, AlertCircle, Eye, TrendingUp, BarChart3, ShoppingCart, Sparkles, ClipboardList, Download, CheckCircle, CreditCard, FileText, Printer, Filter, X } from 'lucide-react';
import { getAllProducts, getInvoices, getExpenses, getCustomers, getDepartments, type Product, type Invoice, type Expense, type Customer, type Department } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { formatCOP } from '../lib/currency';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface SalesAnalysisData {
  topSellingProducts: Array<{ name: string; code: string; quantity: number; revenue: number }>;
  topRevenueProducts: Array<{ name: string; code: string; quantity: number; revenue: number }>;
  salesByCategory: Array<{ category: string; quantity: number; revenue: number }>;
  monthlyComparison: Array<{ month: string; sales: number; invoices: number }>;
  totalRevenue: number;
  totalProductsSold: number;
  averageTicket: number;
}

export default function Reports() {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllLowStockDialog, setShowAllLowStockDialog] = useState(false);

  // Estados para análisis de ventas
  const [analyzingSales, setAnalyzingSales] = useState(false);
  const [salesAnalysis, setSalesAnalysis] = useState<SalesAnalysisData | null>(null);
  const [showSalesAnalysis, setShowSalesAnalysis] = useState(false);

  // Estados para reporte de inventario
  const [showInventoryReport, setShowInventoryReport] = useState(false);
  const [inventoryProgress, setInventoryProgress] = useState(0);
  const [inventoryReady, setInventoryReady] = useState(false);
  const inventoryPdfRef = useRef<Blob | null>(null);

  // Estados para filtros del reporte de inventario
  const [showInventoryFilters, setShowInventoryFilters] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hideZeroStock, setHideZeroStock] = useState(false);
  const [inventoryPreviewData, setInventoryPreviewData] = useState<any[] | null>(null);
  const [showInventoryPreview, setShowInventoryPreview] = useState(false);

  // Estados para análisis por categoría
  const [showCategoryAnalysisModal, setShowCategoryAnalysisModal] = useState(false);
  const [selectedCategoryForAnalysis, setSelectedCategoryForAnalysis] = useState<string>('');
  const [categoryAnalysisLoading, setCategoryAnalysisLoading] = useState(false);
  const [categoryAnalysisResults, setCategoryAnalysisResults] = useState<Array<{
    code: string; name: string; quantity: number; avgPrice: number; unitCost: number; avgProfit: number; totalRevenue: number;
  }> | null>(null);

  const runCategoryAnalysis = async (category: string) => {
    setCategoryAnalysisLoading(true);
    setCategoryAnalysisResults(null);
    await new Promise(resolve => setTimeout(resolve, 800));
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthInvoices = invoices.filter(inv => {
      const d = new Date(inv.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear &&
        (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'pending');
    });
    const map: Map<string, { code: string; name: string; quantity: number; totalRevenue: number; unitCost: number }> = new Map();
    monthInvoices.forEach(inv => {
      inv.items?.forEach((item: any) => {
        const product = products.find(p => p.id === item.productId);
        if (!product || (product.category || 'Sin categoría') !== category) return;
        const key = item.productId;
        const existing = map.get(key);
        const revenue = (item.price || 0) * (item.quantity || 0);
        if (existing) {
          existing.quantity += item.quantity || 0;
          existing.totalRevenue += revenue;
        } else {
          map.set(key, {
            code: item.productCode || product?.code || '-',
            name: item.productName || product?.name || 'Desconocido',
            quantity: item.quantity || 0,
            totalRevenue: revenue,
            unitCost: product?.current_cost || 0,
          });
        }
      });
    });
    const results = Array.from(map.values()).map(p => ({
      code: p.code,
      name: p.name,
      quantity: p.quantity,
      avgPrice: p.quantity > 0 ? p.totalRevenue / p.quantity : 0,
      unitCost: p.unitCost,
      avgProfit: p.quantity > 0 ? (p.totalRevenue / p.quantity) - p.unitCost : 0,
      totalRevenue: p.totalRevenue,
    })).sort((a, b) => b.quantity - a.quantity || b.totalRevenue - a.totalRevenue);
    setCategoryAnalysisResults(results);
    setCategoryAnalysisLoading(false);
  };

  // Estados para reporte de crédito
  const [showCreditReport, setShowCreditReport] = useState(false);
  const [creditProgress, setCreditProgress] = useState(0);
  const [creditReady, setCreditReady] = useState(false);
  const creditPdfRef = useRef<Blob | null>(null);
  const [creditReportData, setCreditReportData] = useState<any>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [productsData, invoicesData, expensesData, customersData, departmentsData] = await Promise.all([
        getAllProducts(),
        getInvoices(),
        getExpenses(),
        getCustomers(),
        getDepartments(),
      ]);
      setProducts(productsData);
      setInvoices(invoicesData);
      setExpenses(expensesData);
      setCustomers(customersData);
      setDepartments(departmentsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredInventoryProducts = (cats: string[], noZero: boolean) => {
    let filtered = [...products];
    if (cats.length > 0) {
      filtered = filtered.filter(p => cats.includes(p.category || ''));
    }
    if (noZero) {
      filtered = filtered.filter(p => (p.stock ?? 0) > 0);
    }
    return filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  };

  const openInventoryFilters = () => {
    setSelectedCategories([]);
    setHideZeroStock(false);
    setShowInventoryFilters(true);
  };

  const handleInventoryPreview = () => {
    const sorted = getFilteredInventoryProducts(selectedCategories, hideZeroStock);
    setInventoryPreviewData(sorted);
    setShowInventoryFilters(false);
    setShowInventoryPreview(true);
  };

  const openInventoryReport = async (cats: string[], noZero: boolean) => {
    setShowInventoryFilters(false);
    setInventoryProgress(0);
    setInventoryReady(false);
    inventoryPdfRef.current = null;
    setShowInventoryReport(true);

    // Simular progreso mientras se genera el PDF
    const steps = [10, 25, 40, 60, 75, 88, 95];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 180));
      setInventoryProgress(step);
    }

    // Generar PDF
    const sorted = getFilteredInventoryProducts(cats, noZero);

    const totalProducts = sorted.length;
    const totalCost = sorted.reduce((s, p) => s + ((p.current_cost || 0) * (p.stock || 0)), 0);
    const totalProfit = sorted.reduce((s, p) => {
      const price = p.final_price || p.price1 || 0;
      const cost = p.current_cost || 0;
      return s + ((price - cost) * (p.stock || 0));
    }, 0);

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // ── Encabezado ──
    doc.setFillColor(20, 20, 20);
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CELUMUNDO VIP', 14, 11);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Inventario Completo', 14, 18);
    doc.setFontSize(8);
    doc.text(`Generado: ${now}`, 14, 24);

    // ── Resumen ──
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN GENERAL', 14, 36);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(14, 37.5, pageW - 14, 37.5);

    const summaryY = 43;
    const col = (pageW - 28) / 3;
    const summaryItems = [
      { label: 'Total Productos', value: totalProducts.toString() },
      { label: 'Costo Total Inventario', value: formatCOP(totalCost) },
      { label: 'Utilidad Estimada Total', value: formatCOP(totalProfit) },
    ];
    summaryItems.forEach((item, i) => {
      const x = 14 + col * i;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(item.label, x, summaryY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(item.value, x, summaryY + 6);
    });

    // ── Tabla ──
    const rows = sorted.map(p => {
      const price = p.final_price || p.price1 || 0;
      const cost = p.current_cost || 0;
      const profit = (price - cost) * (p.stock || 0);
      return [
        p.name || '—',
        p.category || '—',
        formatCOP(price),
        formatCOP(profit),
        formatCOP(cost),
        (p.stock ?? 0).toString(),
      ];
    });

    autoTable(doc, {
      startY: summaryY + 16,
      head: [['Producto', 'Categoría', 'Precio Final', 'Utilidad Est.', 'Costo', 'Stock']],
      body: rows,
      styles: {
        fontSize: 7.5,
        cellPadding: 2.5,
        textColor: [0, 0, 0],
        lineColor: [180, 180, 180],
        lineWidth: 0.15,
      },
      headStyles: {
        fillColor: [20, 20, 20],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 30 },
        2: { cellWidth: 28, halign: 'right' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 14, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
      didDrawPage: (data: any) => {
        // Pie de página
        const pageH = doc.internal.pageSize.getHeight();
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'normal');
        doc.text(`CELUMUNDO VIP — Reporte de Inventario — ${now}`, 14, pageH - 6);
        doc.text(`Página ${data.pageNumber}`, pageW - 14, pageH - 6, { align: 'right' });
      },
    });

    // ── Totales finales al pie de la tabla ──
    const finalY: number = (doc as any).lastAutoTable.finalY + 6;
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(14, finalY, pageW - 14, finalY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(0, 0, 0);
    doc.text(`Total productos registrados: ${totalProducts}`, 14, finalY + 6);
    doc.text(`Costo total del inventario: ${formatCOP(totalCost)}`, 14, finalY + 12);
    doc.text(`Utilidad estimada total: ${formatCOP(totalProfit)}`, 14, finalY + 18);

    inventoryPdfRef.current = doc.output('blob');

    setInventoryProgress(100);
    await new Promise(r => setTimeout(r, 350));
    setInventoryReady(true);
  };

  const downloadInventoryPdf = () => {
    if (!inventoryPdfRef.current) return;
    const url = URL.createObjectURL(inventoryPdfRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario-celumundo-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openCreditReport = async () => {
    setCreditProgress(0);
    setCreditReady(false);
    creditPdfRef.current = null;
    setCreditReportData(null);
    setShowCreditReport(true);

    // Simular progreso mientras se genera el reporte
    const steps = [10, 25, 40, 60, 75, 88, 95];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 180));
      setCreditProgress(step);
    }

    // Obtener facturas de crédito pendientes
    const creditInvoices = invoices.filter(inv => inv.status === 'pending' && inv.type === 'credit');

    // Agrupar por cliente
    const clientsWithDebt: Map<string, {
      customer: Customer | null;
      customerName: string;
      customerId: string;
      invoices: Invoice[];
      totalDebt: number;
    }> = new Map();

    creditInvoices.forEach(invoice => {
      // Usar customer_id si existe, sino usar customer_name como clave única
      const customerId = invoice.customer_id || `name-${invoice.customer_name || 'sin-nombre'}`;
      const customer = invoice.customer_id ? customers.find(c => c.id === invoice.customer_id) : null;
      const customerName = invoice.customer_name || customer?.name || 'Cliente no registrado';
      const pendingBalance = invoice.credit_balance || 0;

      if (clientsWithDebt.has(customerId)) {
        const existing = clientsWithDebt.get(customerId)!;
        existing.invoices.push(invoice);
        existing.totalDebt += pendingBalance;
      } else {
        clientsWithDebt.set(customerId, {
          customer,
          customerName,
          customerId,
          invoices: [invoice],
          totalDebt: pendingBalance
        });
      }
    });

    // Convertir a array y ordenar por deuda descendente
    const clientsArray = Array.from(clientsWithDebt.values()).sort((a, b) => b.totalDebt - a.totalDebt);

    // Calcular totales
    const totalPendingCredit = creditInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
    const totalPendingInvoices = creditInvoices.length;
    const customersWithDebt = clientsArray.length;

    const reportData = {
      clients: clientsArray,
      totalPendingCredit,
      totalPendingInvoices,
      customersWithDebt
    };

    setCreditReportData(reportData);

    // Generar PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const now = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    // ── Encabezado ──
    doc.setFillColor(37, 99, 235); // Blue-600
    doc.rect(0, 0, pageW, 28, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CELUMUNDO VIP', 14, 11);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Reporte de Crédito', 14, 18);
    doc.setFontSize(8);
    doc.text(`Generado: ${now}`, 14, 24);

    // ── Resumen ──
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN GENERAL', 14, 36);
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.line(14, 37.5, pageW - 14, 37.5);

    const summaryY = 43;
    const col = (pageW - 28) / 3;
    const summaryItems = [
      { label: 'Total Crédito Pendiente', value: formatCOP(totalPendingCredit) },
      { label: 'Clientes con Deuda', value: customersWithDebt.toString() },
      { label: 'Facturas Pendientes', value: totalPendingInvoices.toString() },
    ];
    summaryItems.forEach((item, i) => {
      const x = 14 + col * i;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      doc.text(item.label, x, summaryY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.text(item.value, x, summaryY + 6);
    });

    // ── Detalles por cliente ──
    let currentY = summaryY + 20;

    clientsArray.forEach((client, clientIndex) => {
      // Verificar si necesitamos nueva página
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Nombre del cliente y total
      doc.setFillColor(240, 240, 240);
      doc.rect(14, currentY - 4, pageW - 28, 10, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text(client.customerName, 16, currentY + 2);
      doc.setTextColor(220, 38, 38); // Red-600
      doc.text(`Deuda: ${formatCOP(client.totalDebt)}`, pageW - 16, currentY + 2, { align: 'right' });

      currentY += 12;

      // Tabla de facturas del cliente
      const invoiceRows = client.invoices.map(inv => {
        const total = inv.total || 0;
        const pendingBalance = inv.credit_balance || 0;
        const paid = total - pendingBalance;

        return [
          inv.number || '-',
          new Date(inv.date).toLocaleDateString('es-CO'),
          formatCOP(total),
          formatCOP(paid),
          formatCOP(pendingBalance)
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Factura', 'Fecha', 'Total', 'Abonado', 'Saldo']],
        body: invoiceRows,
        styles: {
          fontSize: 7.5,
          cellPadding: 2,
          textColor: [0, 0, 0],
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8,
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 30 },
          2: { cellWidth: 30, halign: 'right' },
          3: { cellWidth: 30, halign: 'right' },
          4: { cellWidth: 30, halign: 'right' },
        },
        margin: { left: 14, right: 14 },
        theme: 'grid',
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });

    // ── Totales finales ──
    if (currentY > 250) {
      doc.addPage();
      currentY = 20;
    }

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.4);
    doc.line(14, currentY, pageW - 14, currentY);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`TOTAL CRÉDITO PENDIENTE: ${formatCOP(totalPendingCredit)}`, 14, currentY + 6);
    doc.text(`Total de clientes con deuda: ${customersWithDebt}`, 14, currentY + 12);
    doc.text(`Total de facturas pendientes: ${totalPendingInvoices}`, 14, currentY + 18);

    creditPdfRef.current = doc.output('blob');

    setCreditProgress(100);
    await new Promise(r => setTimeout(r, 350));
    setCreditReady(true);
  };

  const downloadCreditPdf = () => {
    if (!creditPdfRef.current) return;
    const url = URL.createObjectURL(creditPdfRef.current);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-credito-${new Date().toISOString().slice(0, 10)}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printCreditPdf = () => {
    if (!creditPdfRef.current) return;
    const url = URL.createObjectURL(creditPdfRef.current);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 100);
    };
  };

  const viewCreditReport = () => {
    if (!creditPdfRef.current) return;
    const url = URL.createObjectURL(creditPdfRef.current);
    window.open(url, '_blank');
  };

  // Analizar ventas del mes
  const analyzeMonthlySales = async () => {
    setAnalyzingSales(true);
    setShowSalesAnalysis(true);

    const startTime = Date.now();

    try {
      // Obtener facturas del mes actual (incluyendo crédito y regulares)
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const monthInvoices = invoices.filter(inv => {
        const invDate = new Date(inv.date);
        return (
          invDate.getMonth() === currentMonth &&
          invDate.getFullYear() === currentYear &&
          (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'pending')
        );
      });

      // Analizar productos vendidos
      const productSales: Map<string, { name: string; code: string; quantity: number; revenue: number; category: string }> = new Map();

      monthInvoices.forEach(invoice => {
        invoice.items?.forEach((item: any) => {
          const existing = productSales.get(item.productId);
          const itemRevenue = (item.price || 0) * (item.quantity || 0);

          if (existing) {
            existing.quantity += item.quantity || 0;
            existing.revenue += itemRevenue;
          } else {
            const product = products.find(p => p.id === item.productId);
            productSales.set(item.productId, {
              name: item.productName || item.product_name || 'Desconocido',
              code: item.productCode || product?.code || '-',
              quantity: item.quantity || 0,
              revenue: itemRevenue,
              category: product?.category || 'Sin categoría'
            });
          }
        });
      });

      // Top 10 productos más vendidos por cantidad
      const topSelling = Array.from(productSales.values())
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

      // Top 10 productos que más generaron ingresos
      const topRevenue = Array.from(productSales.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Ventas por categoría
      const categoryMap: Map<string, { quantity: number; revenue: number }> = new Map();
      Array.from(productSales.values()).forEach(product => {
        const existing = categoryMap.get(product.category);
        if (existing) {
          existing.quantity += product.quantity;
          existing.revenue += product.revenue;
        } else {
          categoryMap.set(product.category, {
            quantity: product.quantity,
            revenue: product.revenue
          });
        }
      });

      const salesByCategory = Array.from(categoryMap.entries())
        .map(([category, data]) => ({ category, ...data }))
        .sort((a, b) => b.revenue - a.revenue);

      // Comparación mensual (últimos 6 meses)
      const monthlyData = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date(currentYear, currentMonth - i, 1);
        const monthInvoicesForPeriod = invoices.filter(inv => {
          const invDate = new Date(inv.date);
          return (
            invDate.getMonth() === date.getMonth() &&
            invDate.getFullYear() === date.getFullYear() &&
            (inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'pending')
          );
        });

        const monthName = date.toLocaleDateString('es-ES', { month: 'short' });
        monthlyData.push({
          month: monthName.charAt(0).toUpperCase() + monthName.slice(1),
          sales: monthInvoicesForPeriod.reduce((sum, inv) => sum + inv.total, 0),
          invoices: monthInvoicesForPeriod.length
        });
      }

      // Calcular totales
      const totalRevenue = monthInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalProductsSold = Array.from(productSales.values()).reduce((sum, p) => sum + p.quantity, 0);
      const averageTicket = monthInvoices.length > 0 ? totalRevenue / monthInvoices.length : 0;

      const analysis: SalesAnalysisData = {
        topSellingProducts: topSelling,
        topRevenueProducts: topRevenue,
        salesByCategory,
        monthlyComparison: monthlyData,
        totalRevenue,
        totalProductsSold,
        averageTicket
      };

      // Asegurar que la animación dure al menos 5 segundos
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, 5000 - elapsed);

      await new Promise(resolve => setTimeout(resolve, remainingTime));

      setSalesAnalysis(analysis);
    } catch (error) {
      console.error('Error analyzing sales:', error);
    } finally {
      setAnalyzingSales(false);
    }
  };

  // Productos en stock bajo
  const lowStockProducts = products
    .filter(p => {
      const minStock = p.min_stock || 0;
      return p.stock <= minStock && minStock > 0;
    })
    .sort((a, b) => a.stock - b.stock);

  const top5LowStock = lowStockProducts.slice(0, 5);

  // Ventas del mes (facturas pagadas y parcialmente devueltas)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  // Total de ventas del mes: TODAS las facturas (regulares y a crédito, pagas o no)
  // Excluyendo solo las devueltas completamente y canceladas
  const monthlyInvoices = invoices.filter(inv => {
    const invDate = new Date(inv.date);
    return (
      invDate.getMonth() === currentMonth &&
      invDate.getFullYear() === currentYear &&
      inv.status !== 'returned' &&
      inv.status !== 'cancelled'
    );
  });

  const monthlySales = monthlyInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const monthlyInvoiceCount = monthlyInvoices.length;

  // Total gastos
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // Gastos por categoría
  const expensesByCategory: { [key: string]: number } = {};
  expenses.forEach(expense => {
    const category = expense.category || 'Sin categoría';
    expensesByCategory[category] = (expensesByCategory[category] || 0) + expense.amount;
  });

  const expenseCategoryData = Object.entries(expensesByCategory)
    .map(([name, value]) => ({
      name,
      value,
    }))
    .sort((a, b) => b.value - a.value);

  // Colores para la gráfica
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Reportes</h2>
          <p className="text-muted-foreground mt-1">Resumen y análisis del negocio</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={openInventoryFilters}
            variant="outline"
            className="border-zinc-400 dark:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Reporte de Inventario
          </Button>
          <Button
            onClick={openCreditReport}
            variant="outline"
            className="border-blue-400 dark:border-blue-600 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Reporte Crédito
          </Button>
          <Button
            onClick={analyzeMonthlySales}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Análisis de Ventas
          </Button>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Productos en Stock Bajo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Bajo</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{lowStockProducts.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Productos por debajo del mínimo
            </p>
          </CardContent>
        </Card>

        {/* Ventas del Mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ventas del Mes</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{monthlyInvoiceCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {formatCOP(monthlySales)}
            </p>
          </CardContent>
        </Card>

        {/* Total Gastos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Gastos</CardTitle>
            <DollarSign className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{formatCOP(totalExpenses)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Todos los gastos registrados
            </p>
          </CardContent>
        </Card>

        {/* Balance */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance del Mes</CardTitle>
            <TrendingDown className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${monthlySales - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCOP(monthlySales - totalExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Ventas - Gastos
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Productos en Stock Bajo */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-red-600" />
              Productos en Stock Bajo
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No hay productos en stock bajo</p>
              </div>
            ) : (
              <div className="space-y-3">
                {top5LowStock.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">Código: {product.code}</p>
                    </div>
                    <div className="text-right ml-3">
                      <p className="text-lg font-bold text-red-600">{product.stock}</p>
                      <p className="text-xs text-muted-foreground">Min: {product.min_stock}</p>
                    </div>
                  </div>
                ))}
                {lowStockProducts.length > 5 && (
                  <Button
                    variant="outline"
                    className="w-full border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={() => setShowAllLowStockDialog(true)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver todos los productos en stock bajo ({lowStockProducts.length})
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gastos por Categoría */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-orange-600" />
              Gastos por Categoría
            </CardTitle>
          </CardHeader>
          <CardContent>
            {expenseCategoryData.length === 0 ? (
              <div className="text-center py-8">
                <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p className="text-muted-foreground">No hay gastos registrados</p>
              </div>
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={expenseCategoryData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {expenseCategoryData.map((entry, index) => (
                        <Cell key={`expense-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCOP(value)} />
                  </PieChart>
                </ResponsiveContainer>

                {/* Leyenda con totales */}
                <div className="space-y-2">
                  {expenseCategoryData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium">{entry.name}</span>
                      </div>
                      <span className="text-muted-foreground">{formatCOP(entry.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog para ver todos los productos en stock bajo */}
      <Dialog open={showAllLowStockDialog} onOpenChange={setShowAllLowStockDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Todos los Productos en Stock Bajo ({lowStockProducts.length})
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-4">
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{product.name}</p>
                  <p className="text-sm text-muted-foreground">Código: {product.code}</p>
                  <p className="text-sm text-muted-foreground">Categoría: {product.category}</p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-2xl font-bold text-red-600">{product.stock}</p>
                  <p className="text-sm text-muted-foreground">Mínimo: {product.min_stock}</p>
                  <p className="text-sm text-muted-foreground">
                    Faltante: {product.min_stock - product.stock}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Análisis de Ventas */}
      <Dialog open={showSalesAnalysis} onOpenChange={setShowSalesAnalysis}>
        <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0">
          <DialogHeader className={analyzingSales ? 'sr-only' : ''}>
            <DialogTitle>
              {analyzingSales ? 'Analizando Ventas' : 'Análisis de Ventas del Mes'}
            </DialogTitle>
            <DialogDescription>
              {analyzingSales ? 'Calculando y analizando datos de ventas...' : 'Resumen completo de ventas y análisis de productos'}
            </DialogDescription>
          </DialogHeader>
          {analyzingSales ? (
            // Pantalla de carga animada
            <div className="min-h-[600px] flex items-center justify-center p-12 bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950">
              <div className="text-center space-y-8">
                {/* Animación de carga */}
                <div className="relative">
                  {/* Círculo exterior rotando */}
                  <div className="w-32 h-32 mx-auto">
                    <div className="absolute inset-0 border-8 border-blue-200 dark:border-blue-800 rounded-full"></div>
                    <div className="absolute inset-0 border-8 border-transparent border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin"></div>
                  </div>

                  {/* Icono central pulsante */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-pulse">
                      <Sparkles className="w-12 h-12 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>

                  {/* Partículas flotantes */}
                  <div className="absolute -top-4 -left-4 w-3 h-3 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                  <div className="absolute -top-4 -right-4 w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="absolute -bottom-4 -left-4 w-3 h-3 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  <div className="absolute -bottom-4 -right-4 w-3 h-3 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.6s' }}></div>
                </div>

                {/* Texto animado */}
                <div className="space-y-3">
                  <h3 className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                    Calculando y analizando ventas
                  </h3>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                    <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    <div className="w-2 h-2 bg-pink-600 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Procesando datos de facturas y productos...
                  </p>
                </div>

                {/* Barra de progreso indeterminada */}
                <div className="w-64 mx-auto">
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 animate-[shimmer_2s_ease-in-out_infinite]"
                      style={{
                        width: '50%',
                        animation: 'shimmer 2s ease-in-out infinite'
                      }}
                    ></div>
                  </div>
                </div>
              </div>

              <style>{`
                @keyframes shimmer {
                  0%, 100% { transform: translateX(-100%); }
                  50% { transform: translateX(200%); }
                }
              `}</style>
            </div>
          ) : salesAnalysis ? (
            // Contenido del análisis
            <div className="p-6 space-y-6">
              {/* Título visible */}
              <div className="flex items-center gap-2 text-2xl font-bold">
                <BarChart3 className="h-6 w-6 text-blue-600" />
                Análisis de Ventas del Mes
              </div>

              {/* Tarjetas de resumen */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Total Ingresos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {formatCOP(salesAnalysis.totalRevenue)}
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      Del mes actual
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Productos Vendidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {salesAnalysis.totalProductsSold.toLocaleString()}
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                      Unidades totales
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-purple-900 dark:text-purple-100">Ticket Promedio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {formatCOP(salesAnalysis.averageTicket)}
                    </div>
                    <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
                      Por factura
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Gráficas y análisis */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Productos más vendidos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 text-green-600" />
                      Top 10 Más Vendidos (Cantidad)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesAnalysis.topSellingProducts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="code" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Código: {data.code}</p>
                                  <p className="text-sm text-green-600 font-bold mt-1">Vendidos: {data.quantity}</p>
                                  <p className="text-sm text-blue-600">Ingresos: {formatCOP(data.revenue)}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="quantity" fill="#10b981" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Productos que más generaron */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-blue-600" />
                      Top 10 Mayor Ingreso
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={salesAnalysis.topRevenueProducts}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="code" angle={-45} textAnchor="end" height={80} fontSize={10} />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                                  <p className="font-semibold text-sm">{data.name}</p>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Código: {data.code}</p>
                                  <p className="text-sm text-blue-600 font-bold mt-1">Ingresos: {formatCOP(data.revenue)}</p>
                                  <p className="text-sm text-green-600">Vendidos: {data.quantity}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Ventas por categoría */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-purple-600" />
                      Ventas por Categoría
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={salesAnalysis.salesByCategory}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="revenue"
                        >
                          {salesAnalysis.salesByCategory.map((entry, index) => (
                            <Cell key={`category-cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCOP(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 space-y-2">
                      {salesAnalysis.salesByCategory.slice(0, 5).map((cat, index) => (
                        <div key={cat.category} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <span>{cat.category}</span>
                          </div>
                          <span className="font-semibold">{formatCOP(cat.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Tendencia mensual */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-orange-600" />
                      Tendencia (Últimos 6 Meses)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={salesAnalysis.monthlyComparison}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow-lg">
                                  <p className="font-semibold text-sm">{data.month}</p>
                                  <p className="text-sm text-blue-600 font-bold">Ventas: {formatCOP(data.sales)}</p>
                                  <p className="text-sm text-green-600">Facturas: {data.invoices}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Tablas detalladas */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Tabla de más vendidos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalle de Más Vendidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left p-2">#</th>
                            <th className="text-left p-2">Producto</th>
                            <th className="text-right p-2">Cant.</th>
                            <th className="text-right p-2">Ingresos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesAnalysis.topSellingProducts.map((product, index) => (
                            <tr key={`top-selling-${index}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.code}</div>
                              </td>
                              <td className="p-2 text-right font-semibold text-green-600">{product.quantity}</td>
                              <td className="p-2 text-right text-blue-600">{formatCOP(product.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Tabla de mayor ingreso */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Detalle de Mayor Ingreso</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b">
                          <tr>
                            <th className="text-left p-2">#</th>
                            <th className="text-left p-2">Producto</th>
                            <th className="text-right p-2">Ingresos</th>
                            <th className="text-right p-2">Cant.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesAnalysis.topRevenueProducts.map((product, index) => (
                            <tr key={`top-revenue-${index}`} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                              <td className="p-2">{index + 1}</td>
                              <td className="p-2">
                                <div className="font-medium">{product.name}</div>
                                <div className="text-xs text-gray-500">{product.code}</div>
                              </td>
                              <td className="p-2 text-right font-semibold text-blue-600">{formatCOP(product.revenue)}</td>
                              <td className="p-2 text-right text-green-600">{product.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-between pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCategoryAnalysisModal(true);
                    setSelectedCategoryForAnalysis('');
                    setCategoryAnalysisResults(null);
                    setCategoryAnalysisLoading(false);
                  }}
                >
                  <BarChart3 className="w-4 h-4 mr-2" />
                  Análisis de ventas por Categoría
                </Button>
                <Button variant="outline" onClick={() => setShowSalesAnalysis(false)}>
                  Cerrar
                </Button>
              </div>

              {/* Modal análisis por categoría */}
              <Dialog open={showCategoryAnalysisModal} onOpenChange={setShowCategoryAnalysisModal}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-blue-600" />
                      Análisis de Ventas por Categoría
                    </DialogTitle>
                    <DialogDescription>
                      Selecciona una categoría para analizar el desempeño de sus productos este mes.
                    </DialogDescription>
                  </DialogHeader>

                  {/* Selección de categoría */}
                  {!categoryAnalysisLoading && !categoryAnalysisResults && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-1">
                        {salesAnalysis?.salesByCategory.map(cat => (
                          <button
                            key={cat.category}
                            onClick={() => setSelectedCategoryForAnalysis(cat.category)}
                            className={`p-3 rounded-lg border text-left transition-colors text-sm ${
                              selectedCategoryForAnalysis === cat.category
                                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300'
                                : 'border-border hover:border-blue-300 hover:bg-muted/50'
                            }`}
                          >
                            <p className="font-medium truncate">{cat.category}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{cat.quantity} uds · {formatCOP(cat.revenue)}</p>
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button variant="outline" onClick={() => setShowCategoryAnalysisModal(false)}>Cancelar</Button>
                        <Button
                          disabled={!selectedCategoryForAnalysis}
                          onClick={() => runCategoryAnalysis(selectedCategoryForAnalysis)}
                        >
                          Proceder
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Pantalla de carga */}
                  {categoryAnalysisLoading && (
                    <div className="py-16 flex flex-col items-center gap-4 text-center">
                      <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                      <p className="font-medium">Analizando categoría <span className="text-blue-600">"{selectedCategoryForAnalysis}"</span>...</p>
                      <p className="text-sm text-muted-foreground">Calculando cantidades, precios y ganancias</p>
                    </div>
                  )}

                  {/* Resultados */}
                  {!categoryAnalysisLoading && categoryAnalysisResults && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">{selectedCategoryForAnalysis}</h3>
                        <span className="text-sm text-muted-foreground">{categoryAnalysisResults.length} producto(s)</span>
                      </div>
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead className="bg-muted/50 sticky top-0">
                            <tr>
                              <th className="text-left p-3 font-semibold">Código</th>
                              <th className="text-left p-3 font-semibold">Producto</th>
                              <th className="text-right p-3 font-semibold">Cant. vendida</th>
                              <th className="text-right p-3 font-semibold">Precio promedio</th>
                              <th className="text-right p-3 font-semibold">Costo/unidad</th>
                              <th className="text-right p-3 font-semibold">Ganancia prom.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryAnalysisResults.map((row, i) => (
                              <tr key={row.code + i} className="border-t hover:bg-muted/30 transition-colors">
                                <td className="p-3 font-mono text-xs text-muted-foreground">{row.code}</td>
                                <td className="p-3 font-medium">{row.name}</td>
                                <td className="p-3 text-right font-semibold text-green-600">{row.quantity}</td>
                                <td className="p-3 text-right">{formatCOP(row.avgPrice)}</td>
                                <td className="p-3 text-right text-orange-600">{formatCOP(row.unitCost)}</td>
                                <td className={`p-3 text-right font-semibold ${row.avgProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                                  {formatCOP(row.avgProfit)}
                                </td>
                              </tr>
                            ))}
                            {categoryAnalysisResults.length === 0 && (
                              <tr>
                                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                  No hay ventas para esta categoría en el mes actual
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <Button
                          variant="outline"
                          onClick={() => { setCategoryAnalysisResults(null); setSelectedCategoryForAnalysis(''); }}
                        >
                          ← Volver
                        </Button>
                        <Button variant="outline" onClick={() => setShowCategoryAnalysisModal(false)}>
                          Cerrar
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal de Reporte de Inventario */}
      <Dialog open={showInventoryReport} onOpenChange={(open) => { if (!open && inventoryReady) { setShowInventoryReport(false); } else if (!open && inventoryProgress === 0) { setShowInventoryReport(false); } }}>
        <DialogContent className="max-w-sm w-[95vw] bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <ClipboardList className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              Reporte de Inventario
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-sm">
              Inventario completo con precios, costos y utilidades
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {!inventoryReady ? (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {inventoryProgress < 100 ? 'Generando reporte...' : 'Finalizando...'}
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    Procesando {products.length} productos
                  </p>
                </div>

                {/* Barra de progreso */}
                <div className="space-y-2">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-800 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-zinc-800 dark:bg-zinc-200 transition-all duration-300 ease-out"
                      style={{ width: `${inventoryProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
                    <span>Progreso</span>
                    <span className="font-mono font-medium text-zinc-700 dark:text-zinc-300">{inventoryProgress}%</span>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 dark:text-zinc-500 space-y-0.5 pl-1">
                  {inventoryProgress >= 10 && <p>✓ Cargando productos...</p>}
                  {inventoryProgress >= 40 && <p>✓ Calculando costos y utilidades...</p>}
                  {inventoryProgress >= 75 && <p>✓ Construyendo tabla de inventario...</p>}
                  {inventoryProgress >= 95 && <p>✓ Armando documento PDF...</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-14 h-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-zinc-700 dark:text-zinc-300" />
                  </div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">¡Reporte listo!</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                    {products.length} productos incluidos
                  </p>
                </div>

                <Button
                  onClick={downloadInventoryPdf}
                  className="w-full bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-300 dark:text-zinc-900 text-white font-semibold"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Descargar PDF
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setShowInventoryReport(false)}
                  className="w-full border-zinc-300 dark:border-zinc-700"
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de filtros del reporte de inventario */}
      <Dialog open={showInventoryFilters} onOpenChange={setShowInventoryFilters}>
        <DialogContent className="max-w-md w-[95vw] bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Filter className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              Filtros del Reporte de Inventario
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-sm">
              Personaliza qué productos incluir en el reporte
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Selector de categorías */}
            <div>
              <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                Categorías
                {selectedCategories.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-zinc-500">({selectedCategories.length} seleccionadas)</span>
                )}
              </p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-3">
                Deja vacío para incluir todos los productos
              </p>
              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                {departments.map(dept => {
                  const isSelected = selectedCategories.includes(dept.name);
                  return (
                    <button
                      key={dept.id}
                      onClick={() => {
                        setSelectedCategories(prev =>
                          isSelected ? prev.filter(c => c !== dept.name) : [...prev, dept.name]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        isSelected
                          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
                          : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 dark:bg-zinc-900 dark:text-zinc-300 dark:border-zinc-700 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {dept.name}
                    </button>
                  );
                })}
                {departments.length === 0 && (
                  <p className="text-xs text-zinc-400">No hay departamentos registrados</p>
                )}
              </div>
              {selectedCategories.length > 0 && (
                <button
                  onClick={() => setSelectedCategories([])}
                  className="mt-2 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Limpiar selección
                </button>
              )}
            </div>

            {/* Toggle stock cero */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <div>
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Ocultar stock en cero</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">Excluye productos sin existencias</p>
              </div>
              <button
                onClick={() => setHideZeroStock(v => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  hideZeroStock ? 'bg-zinc-900 dark:bg-zinc-100' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white dark:bg-zinc-900 shadow transition-transform ${
                  hideZeroStock ? 'translate-x-5' : 'translate-x-0'
                }`} />
              </button>
            </div>

            {/* Preview info */}
            <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
              {(() => {
                const count = getFilteredInventoryProducts(selectedCategories, hideZeroStock).length;
                return `${count} producto${count !== 1 ? 's' : ''} se incluirán en el reporte`;
              })()}
            </p>

            {/* Botones */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setShowInventoryFilters(false)}
                className="flex-1 border-zinc-300 dark:border-zinc-700"
              >
                Cancelar
              </Button>
              <Button
                variant="outline"
                onClick={handleInventoryPreview}
                className="flex-1 border-zinc-400 dark:border-zinc-600"
              >
                <Eye className="w-4 h-4 mr-1" />
                Previsualizar
              </Button>
              <Button
                onClick={() => openInventoryReport(selectedCategories, hideZeroStock)}
                className="flex-1 bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-300 dark:text-zinc-900 text-white"
              >
                Continuar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de previsualización del inventario */}
      <Dialog open={showInventoryPreview} onOpenChange={setShowInventoryPreview}>
        <DialogContent className="max-w-4xl w-[98vw] max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Eye className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
              Previsualización del Inventario
              {inventoryPreviewData && (
                <Badge variant="outline" className="ml-2 text-xs">{inventoryPreviewData.length} productos</Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-sm">
              Vista previa del reporte — sin descargar PDF
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 mt-2">
            {inventoryPreviewData && inventoryPreviewData.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
                  <tr>
                    <th className="text-left py-2 px-3">Producto</th>
                    <th className="text-left py-2 px-3">Categoría</th>
                    <th className="text-right py-2 px-3">Precio</th>
                    <th className="text-right py-2 px-3">Costo</th>
                    <th className="text-right py-2 px-3">Utilidad Est.</th>
                    <th className="text-center py-2 px-3">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryPreviewData.map((p, i) => {
                    const price = p.final_price || p.price1 || 0;
                    const cost = p.current_cost || 0;
                    const profit = (price - cost) * (p.stock || 0);
                    return (
                      <tr key={p.id} className={i % 2 === 0 ? 'bg-zinc-50 dark:bg-zinc-900' : 'bg-white dark:bg-zinc-950'}>
                        <td className="py-2 px-3 font-medium text-zinc-900 dark:text-zinc-100">{p.name || '—'}</td>
                        <td className="py-2 px-3 text-zinc-500 dark:text-zinc-400">{p.category || '—'}</td>
                        <td className="py-2 px-3 text-right text-zinc-700 dark:text-zinc-300">{formatCOP(price)}</td>
                        <td className="py-2 px-3 text-right text-zinc-500 dark:text-zinc-400">{formatCOP(cost)}</td>
                        <td className={`py-2 px-3 text-right font-medium ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600'}`}>{formatCOP(profit)}</td>
                        <td className={`py-2 px-3 text-center font-bold ${(p.stock ?? 0) === 0 ? 'text-red-500' : 'text-zinc-900 dark:text-zinc-100'}`}>{p.stock ?? 0}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-zinc-100 dark:bg-zinc-800 sticky bottom-0">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 font-bold text-zinc-800 dark:text-zinc-200 text-xs">TOTALES</td>
                    <td colSpan={2} className="py-2 px-3 text-right text-xs text-zinc-600 dark:text-zinc-400">
                      Costo total: <span className="font-bold">{formatCOP(inventoryPreviewData.reduce((s, p) => s + ((p.current_cost || 0) * (p.stock || 0)), 0))}</span>
                    </td>
                    <td className="py-2 px-3 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCOP(inventoryPreviewData.reduce((s, p) => { const pr = p.final_price || p.price1 || 0; return s + ((pr - (p.current_cost || 0)) * (p.stock || 0)); }, 0))}
                    </td>
                    <td className="py-2 px-3 text-center text-xs font-bold text-zinc-900 dark:text-zinc-100">
                      {inventoryPreviewData.reduce((s, p) => s + (p.stock || 0), 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <div className="text-center py-12 text-zinc-400">No hay productos para mostrar con los filtros seleccionados</div>
            )}
          </div>

          <div className="flex gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800 mt-2">
            <Button variant="outline" onClick={() => { setShowInventoryPreview(false); setShowInventoryFilters(true); }} className="flex-1 border-zinc-300 dark:border-zinc-700">
              Volver a filtros
            </Button>
            <Button
              onClick={() => { setShowInventoryPreview(false); openInventoryReport(selectedCategories, hideZeroStock); }}
              className="flex-1 bg-zinc-900 hover:bg-zinc-700 dark:bg-zinc-100 dark:hover:bg-zinc-300 dark:text-zinc-900 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Generar PDF
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Reporte de Crédito */}
      <Dialog open={showCreditReport} onOpenChange={(open) => { if (!open && creditReady) { setShowCreditReport(false); } else if (!open && creditProgress === 0) { setShowCreditReport(false); } }}>
        <DialogContent className="max-w-2xl w-[95vw] bg-white dark:bg-blue-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
              <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              Reporte de Crédito
            </DialogTitle>
            <DialogDescription className="text-blue-700 dark:text-blue-300 text-sm">
              Estado de cuentas por cobrar y clientes con deuda pendiente
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {!creditReady ? (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {creditProgress < 100 ? 'Generando reporte...' : 'Finalizando...'}
                  </p>
                  <p className="text-xs text-blue-500 dark:text-blue-400">
                    Analizando facturas de crédito
                  </p>
                </div>

                {/* Barra de progreso */}
                <div className="space-y-2">
                  <div className="w-full bg-blue-200 dark:bg-blue-900 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-3 rounded-full bg-blue-600 dark:bg-blue-400 transition-all duration-300 ease-out"
                      style={{ width: `${creditProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-blue-500 dark:text-blue-400">
                    <span>Progreso</span>
                    <span className="font-mono font-medium text-blue-700 dark:text-blue-300">{creditProgress}%</span>
                  </div>
                </div>

                <div className="text-xs text-blue-500 dark:text-blue-400 space-y-0.5 pl-1">
                  {creditProgress >= 10 && <p>✓ Cargando facturas de crédito...</p>}
                  {creditProgress >= 40 && <p>✓ Agrupando por clientes...</p>}
                  {creditProgress >= 75 && <p>✓ Calculando totales...</p>}
                  {creditProgress >= 95 && <p>✓ Generando documento PDF...</p>}
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Resumen visible en el modal */}
                {creditReportData && (
                  <div className="grid grid-cols-3 gap-3 bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="text-center">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Total Pendiente</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{formatCOP(creditReportData.totalPendingCredit)}</p>
                    </div>
                    <div className="text-center border-l border-r border-blue-200 dark:border-blue-800">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Clientes</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{creditReportData.customersWithDebt}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Facturas</p>
                      <p className="text-lg font-bold text-blue-900 dark:text-blue-100">{creditReportData.totalPendingInvoices}</p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col items-center gap-2 py-2">
                  <div className="w-14 h-14 rounded-full bg-blue-100 dark:bg-blue-800 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-blue-700 dark:text-blue-300" />
                  </div>
                  <p className="font-semibold text-blue-900 dark:text-blue-100">¡Reporte listo!</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={viewCreditReport}
                    variant="outline"
                    className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900"
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Ver
                  </Button>
                  <Button
                    onClick={printCreditPdf}
                    variant="outline"
                    className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900"
                  >
                    <Printer className="w-4 h-4 mr-2" />
                    Imprimir
                  </Button>
                  <Button
                    onClick={downloadCreditPdf}
                    className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-semibold"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Descargar
                  </Button>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowCreditReport(false)}
                  className="w-full border-blue-300 dark:border-blue-700"
                >
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
