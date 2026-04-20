import { useState, useMemo, useEffect } from 'react';
import { FileText, Filter, ShoppingCart, X, Download, Printer, ChevronRight, ChevronLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent } from './ui/card';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCOP } from '../lib/currency';
import { getInvoices, extractColombiaDate, getColombiaDate, type Product } from '../lib/supabase';
import { isPrintingAvailable } from '../lib/platform-detector';
import { getPrinterConfig, printDirect } from '../lib/printer-config';

interface OrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
}

type Phase = 'filters' | 'order';

interface OrderFilters {
  category: string;
  analyzeSales: boolean;
  analyzeRevenue: boolean;
  nearMinimum: boolean;
}

interface OrderItem {
  product: Product;
  recommendedQuantity: number;
  finalQuantity: number;
}

export function OrderDialog({ open, onOpenChange, products }: OrderDialogProps) {
  const [phase, setPhase] = useState<Phase>('filters');
  const [filters, setFilters] = useState<OrderFilters>({
    category: 'all',
    analyzeSales: false,
    analyzeRevenue: false,
    nearMinimum: true, // Por defecto activado
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [showPdfPreview, setShowPdfPreview] = useState(false);

  // Obtener categorías únicas
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return ['Todas las categorías', ...uniqueCategories.sort()];
  }, [products]);

  // Calcular ventas mensuales de cada producto
  const calculateMonthlySales = async (): Promise<Map<string, number>> => {
    const salesMap = new Map<string, number>();
    const invoices = await getInvoices();
    
    // Obtener el mes actual
    const currentMonth = getColombiaDate().substring(0, 7); // YYYY-MM
    
    // Filtrar facturas del mes actual
    const monthInvoices = invoices.filter(inv => {
      if (!inv.date) return false;
      const invDate = extractColombiaDate(inv.date);
      return invDate.substring(0, 7) === currentMonth;
    });
    
    // Contar ventas por producto
    monthInvoices.forEach(invoice => {
      invoice.items?.forEach((item: any) => {
        const currentCount = salesMap.get(item.productId) || 0;
        salesMap.set(item.productId, currentCount + item.quantity);
      });
    });
    
    return salesMap;
  };

  // Generar pedido basado en filtros
  const generateOrder = async () => {
    let filteredProducts = products;
    
    // Filtrar por categoría
    if (filters.category !== 'all' && filters.category !== 'Todas las categorías') {
      filteredProducts = filteredProducts.filter(p => p.category === filters.category);
    }
    
    const items: OrderItem[] = [];
    const monthlySales = await calculateMonthlySales();
    
    filteredProducts.forEach(product => {
      let shouldInclude = false;
      let recommendedQty = 0;
      
      const salesCount = monthlySales.get(product.id) || 0;
      const stockMin = product.min_stock || 0;
      const currentStock = product.stock || 0;
      const costPrice = product.current_cost || 0;
      const finalPrice = product.final_price || 0;
      const margin = finalPrice - costPrice;
      const marginPercent = costPrice > 0 ? (margin / costPrice) * 100 : 0;
      
      // Verificar si está cerca del mínimo (dentro del 20% del mínimo)
      const isNearMinimum = currentStock <= stockMin || currentStock <= stockMin * 1.2;
      
      // Determinar cantidad recomendada basándose en los filtros activos
      const activeFiltersCount = [filters.analyzeSales, filters.analyzeRevenue, filters.nearMinimum].filter(Boolean).length;
      
      // Si "Cercano al mínimo" está activado
      if (filters.nearMinimum && isNearMinimum) {
        shouldInclude = true;
        const deficit = Math.max(0, stockMin - currentStock);
        recommendedQty += deficit + Math.ceil(stockMin * 0.5); // Añadir 50% extra del mínimo
      }
      
      // Si "Analizar ventas" está activado
      if (filters.analyzeSales) {
        if (salesCount > 40) {
          shouldInclude = true;
          const salesQty = Math.pow(stockMin, 3);
          recommendedQty = activeFiltersCount > 1 ? Math.max(recommendedQty, salesQty * 0.7) : salesQty;
        } else if (salesCount > 20) {
          shouldInclude = true;
          const salesQty = Math.pow(stockMin, 2);
          recommendedQty = activeFiltersCount > 1 ? Math.max(recommendedQty, salesQty * 0.8) : salesQty;
        } else if (salesCount > 10) {
          shouldInclude = true;
          const salesQty = stockMin + 5;
          recommendedQty = activeFiltersCount > 1 ? Math.max(recommendedQty, salesQty * 0.9) : salesQty;
        }
      }
      
      // Si "Analizar ingresos" está activado (incompatible con analizar ventas)
      if (filters.analyzeRevenue && !filters.analyzeSales) {
        // Productos con mayor margen de ganancia merecen más stock
        if (marginPercent > 50) {
          shouldInclude = true;
          const revenueQty = stockMin * 2;
          recommendedQty = activeFiltersCount > 1 ? Math.max(recommendedQty, revenueQty * 0.8) : revenueQty;
        } else if (marginPercent > 30) {
          shouldInclude = true;
          const revenueQty = Math.ceil(stockMin * 1.5);
          recommendedQty = activeFiltersCount > 1 ? Math.max(recommendedQty, revenueQty * 0.9) : revenueQty;
        } else if (marginPercent > 10 && isNearMinimum) {
          shouldInclude = true;
          const revenueQty = stockMin;
          recommendedQty = activeFiltersCount > 1 ? Math.max(recommendedQty, revenueQty) : revenueQty;
        }
      }
      
      if (shouldInclude && recommendedQty > 0) {
        items.push({
          product,
          recommendedQuantity: Math.ceil(recommendedQty),
          finalQuantity: Math.ceil(recommendedQty),
        });
      }
    });
    
    // Ordenar por cantidad recomendada (mayor a menor)
    items.sort((a, b) => b.recommendedQuantity - a.recommendedQuantity);
    
    setOrderItems(items);
    setPhase('order');
    
    if (items.length === 0) {
      toast.info('No se encontraron productos que cumplan con los filtros seleccionados');
    } else {
      toast.success(`Se encontraron ${items.length} productos para el pedido`);
    }
  };

  // Actualizar cantidad final de un item
  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...orderItems];
    newItems[index].finalQuantity = Math.max(0, quantity);
    setOrderItems(newItems);
  };

  // Eliminar un item del pedido
  const removeItem = (index: number) => {
    const newItems = orderItems.filter((_, i) => i !== index);
    setOrderItems(newItems);
    toast.success('Producto eliminado del pedido');
  };

  // Generar PDF del pedido
  const generatePDF = async (action: 'download' | 'print') => {
    if (orderItems.length === 0) {
      toast.error('No hay productos en el pedido');
      return;
    }

    // Validar plataforma para impresión
    if (action === 'print' && !isPrintingAvailable()) {
      toast.error('La impresión solo está disponible en la aplicación de escritorio');
      return;
    }

    // Si es impresión directa, usar printDirect con impresora PDF
    if (action === 'print') {
      try {
        const config = await getPrinterConfig();

        if (!config.pdf) {
          toast.error('No se ha configurado una impresora PDF. Ve a Configuración para configurarla.');
          return;
        }

        const currentDate = new Date().toLocaleDateString('es-CO', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        const totalCost = orderItems.reduce((sum, item) =>
          sum + ((item.product.current_cost || 0) * item.finalQuantity), 0
        );

        const totalQuantity = orderItems.reduce((sum, item) => sum + item.finalQuantity, 0);

        // Generar filas de productos
        const productsHTML = orderItems.map(item => `
          <tr>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${item.product.code || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${item.product.name}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.product.category || '-'}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.product.stock || 0}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${item.product.min_stock || 0}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: #22c55e;">${item.finalQuantity}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">COP ${formatCOP(item.product.current_cost || 0)}</td>
            <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: bold;">COP ${formatCOP((item.product.current_cost || 0) * item.finalQuantity)}</td>
          </tr>
        `).join('');

        const html = `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <style>
                @page {
                  size: A4;
                  margin: 15mm;
                }
                * {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                }
                body {
                  font-family: 'Arial', 'Helvetica', sans-serif;
                  margin: 0;
                  padding: 0;
                  color: #333;
                }
                .header {
                  background-color: #22c55e;
                  color: white;
                  padding: 20px;
                  text-align: center;
                  margin-bottom: 30px;
                }
                .title {
                  font-size: 28pt;
                  font-weight: bold;
                  margin-bottom: 10px;
                }
                .subtitle {
                  font-size: 14pt;
                }
                .info {
                  margin-bottom: 20px;
                  padding: 15px;
                  background-color: #f5f5f5;
                  border-radius: 4px;
                }
                .info-item {
                  margin-bottom: 5px;
                  font-size: 11pt;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 20px;
                }
                thead {
                  background-color: #22c55e;
                  color: white;
                }
                th {
                  padding: 10px;
                  text-align: left;
                  font-size: 10pt;
                }
                td {
                  font-size: 9pt;
                }
                .total-section {
                  background-color: #22c55e;
                  color: white;
                  padding: 15px;
                  text-align: right;
                  font-size: 14pt;
                  font-weight: bold;
                  margin-top: 20px;
                }
                .footer {
                  margin-top: 40px;
                  padding-top: 20px;
                  border-top: 2px solid #ddd;
                  text-align: center;
                  color: #666;
                  font-size: 9pt;
                }
              </style>
            </head>
            <body>
              <!-- Header -->
              <div class="header">
                <div class="title">ORDEN DE PEDIDO</div>
                <div class="subtitle">CELUMUNDO VIP</div>
              </div>

              <!-- Info -->
              <div class="info">
                <div class="info-item"><strong>Fecha:</strong> ${currentDate}</div>
                <div class="info-item"><strong>Total de productos:</strong> ${orderItems.length}</div>
                <div class="info-item"><strong>Cantidad total:</strong> ${totalQuantity} unidades</div>
              </div>

              <!-- Table -->
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th style="text-align: center;">Categoría</th>
                    <th style="text-align: center;">Stock</th>
                    <th style="text-align: center;">Mín.</th>
                    <th style="text-align: center;">Cantidad</th>
                    <th style="text-align: right;">Costo Unit.</th>
                    <th style="text-align: right;">Costo Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsHTML}
                </tbody>
              </table>

              <!-- Total -->
              <div class="total-section">
                TOTAL ESTIMADO: COP ${formatCOP(totalCost)}
              </div>

              <!-- Footer -->
              <div class="footer">
                <p>Este documento es una orden de pedido generada por CELUMUNDO VIP</p>
                <p>Verifique las cantidades antes de realizar el pedido final</p>
                <p>${new Date().toLocaleString('es-ES')}</p>
              </div>
            </body>
          </html>
        `;

        const success = await printDirect(config.pdf, html, 'pdf');

        if (!success) {
          throw new Error('Error al enviar el documento a la impresora');
        }

        toast.success('Documento enviado a la impresora');
        setShowPdfPreview(false);
      } catch (error: any) {
        console.error('Error al imprimir:', error);
        toast.error(error.message || 'Error al imprimir el pedido');
      }
      return;
    }

    // Si es descarga, usar jsPDF
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFillColor(34, 197, 94); // Verde corporativo
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text('ORDEN DE PEDIDO', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(12);
    doc.text('CELUMUNDO VIP', pageWidth / 2, 30, { align: 'center' });

    // Info del pedido
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    const currentDate = new Date().toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    doc.text(`Fecha: ${currentDate}`, 14, 50);
    doc.text(`Total de productos: ${orderItems.length}`, 14, 56);
    doc.text(`Cantidad total: ${orderItems.reduce((sum, item) => sum + item.finalQuantity, 0)} unidades`, 14, 62);

    // Tabla de productos
    const tableData = orderItems.map(item => [
      item.product.code || '-',
      item.product.name,
      item.product.category || '-',
      item.product.stock || 0,
      item.product.min_stock || 0,
      item.finalQuantity,
      formatCOP(item.product.current_cost || 0),
      formatCOP((item.product.current_cost || 0) * item.finalQuantity),
    ]);

    autoTable(doc, {
      startY: 70,
      head: [['Código', 'Producto', 'Categoría', 'Stock', 'Mín.', 'Cantidad', 'Costo Unit.', 'Costo Total']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 50 },
        2: { cellWidth: 25 },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: [34, 197, 94] },
        6: { halign: 'right', cellWidth: 25 },
        7: { halign: 'right', cellWidth: 25 },
      },
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    // Total estimado
    const finalY = (doc as any).lastAutoTable.finalY || 70;
    const totalCost = orderItems.reduce((sum, item) =>
      sum + ((item.product.current_cost || 0) * item.finalQuantity), 0
    );

    doc.setFillColor(34, 197, 94);
    doc.rect(pageWidth - 80, finalY + 10, 66, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.text('TOTAL ESTIMADO:', pageWidth - 75, finalY + 17);
    doc.text(`$${formatCOP(totalCost)}`, pageWidth - 15, finalY + 17, { align: 'right' });

    // Footer
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(8);
    doc.text('Este documento es una orden de pedido generada por CELUMUNDO VIP', pageWidth / 2, finalY + 30, { align: 'center' });
    doc.text('Verifique las cantidades antes de realizar el pedido final', pageWidth / 2, finalY + 35, { align: 'center' });

    doc.save(`Pedido_${new Date().toISOString().split('T')[0]}.pdf`);
    toast.success('PDF descargado exitosamente');

    setShowPdfPreview(false);
  };

  // Reset al cerrar
  const handleClose = () => {
    setPhase('filters');
    setFilters({
      category: 'all',
      analyzeSales: false,
      analyzeRevenue: false,
      nearMinimum: true,
    });
    setOrderItems([]);
    setShowPdfPreview(false);
    onOpenChange(false);
  };

  // Auto-desactivar "Analizar ventas" si se activa "Analizar ingresos"
  useEffect(() => {
    if (filters.analyzeRevenue && filters.analyzeSales) {
      setFilters(prev => ({ ...prev, analyzeSales: false }));
    }
  }, [filters.analyzeRevenue]);

  // Auto-desactivar "Analizar ingresos" si se activa "Analizar ventas"
  useEffect(() => {
    if (filters.analyzeSales && filters.analyzeRevenue) {
      setFilters(prev => ({ ...prev, analyzeRevenue: false }));
    }
  }, [filters.analyzeSales]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Realizar Pedido
            </DialogTitle>
            <DialogDescription>
              Genera un pedido basado en los filtros seleccionados y las ventas mensuales de los productos.
            </DialogDescription>
          </DialogHeader>

          {/* Indicador de fase */}
          <div className="flex items-center justify-center gap-4 py-4">
            <div className={`flex items-center gap-2 ${phase === 'filters' ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                phase === 'filters' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                1
              </div>
              <span>Filtros</span>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400" />
            <div className={`flex items-center gap-2 ${phase === 'order' ? 'text-green-600 font-bold' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                phase === 'order' ? 'bg-green-600 text-white' : 'bg-gray-200 dark:bg-gray-700'
              }`}>
                2
              </div>
              <span>Pedido</span>
            </div>
          </div>

          {/* Fase 1: Filtros */}
          {phase === 'filters' && (
            <div className="space-y-6">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  {/* Categoría */}
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoría</Label>
                    <Select
                      value={filters.category}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, category: value }))}
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las categorías</SelectItem>
                        {categories.filter(c => c !== 'Todas las categorías').map(category => (
                          <SelectItem key={category} value={category}>{category}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Analizar ventas de productos */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">Analizar Ventas de Productos</Label>
                      <p className="text-sm text-muted-foreground">
                        Recomienda cantidades basándose en las ventas mensuales
                      </p>
                      <p className="text-xs text-muted-foreground">
                        • {'>'}40 ventas/mes: Stock mín³ | • {'>'}20 ventas: Stock mín² | • {'>'}10 ventas: Stock mín + 5
                      </p>
                    </div>
                    <Button
                      variant={filters.analyzeSales ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, analyzeSales: !prev.analyzeSales }))}
                      className={filters.analyzeSales ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {filters.analyzeSales ? 'ON' : 'OFF'}
                    </Button>
                  </div>

                  {/* Analizar ingresos */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">Analizar Ingresos</Label>
                      <p className="text-sm text-muted-foreground">
                        Recomienda cantidades basándose en el margen de ganancia
                      </p>
                      <p className="text-xs text-muted-foreground">
                        • {'>'}50% margen: 2x stock mín | • {'>'}30%: 1.5x | • {'>'}10%: 1x (si cercano al mín)
                      </p>
                      {filters.analyzeSales && (
                        <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                          ⚠️ Incompatible con "Analizar Ventas"
                        </p>
                      )}
                    </div>
                    <Button
                      variant={filters.analyzeRevenue ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, analyzeRevenue: !prev.analyzeRevenue }))}
                      className={filters.analyzeRevenue ? 'bg-green-600 hover:bg-green-700' : ''}
                      disabled={filters.analyzeSales}
                    >
                      {filters.analyzeRevenue ? 'ON' : 'OFF'}
                    </Button>
                  </div>

                  {/* Cercano al mínimo */}
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="space-y-1">
                      <Label className="text-base">Cercano al Mínimo</Label>
                      <p className="text-sm text-muted-foreground">
                        Incluye productos en stock mínimo o cercanos (20% del mínimo)
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Añade: Déficit + 50% del stock mínimo
                      </p>
                    </div>
                    <Button
                      variant={filters.nearMinimum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilters(prev => ({ ...prev, nearMinimum: !prev.nearMinimum }))}
                      className={filters.nearMinimum ? 'bg-green-600 hover:bg-green-700' : ''}
                    >
                      {filters.nearMinimum ? 'ON' : 'OFF'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button onClick={generateOrder} className="bg-green-600 hover:bg-green-700">
                  <ChevronRight className="h-4 w-4 mr-2" />
                  Generar Pedido
                </Button>
              </div>
            </div>
          )}

          {/* Fase 2: Pedido */}
          {phase === 'order' && (
            <div className="space-y-4">
              {orderItems.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-muted-foreground">No hay productos en el pedido</p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  <div className="text-sm text-muted-foreground mb-2">
                    {orderItems.length} producto{orderItems.length !== 1 ? 's' : ''} en el pedido
                  </div>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {orderItems.map((item, index) => (
                      <Card key={item.product.id}>
                        <CardContent className="py-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{item.product.name}</h4>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
                                <span>Código: {item.product.code || '-'}</span>
                                <span>Categoría: {item.product.category || '-'}</span>
                                <span>Stock: {item.product.stock || 0}</span>
                                <span>Mínimo: {item.product.min_stock || 0}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                Cantidad recomendada: {item.recommendedQuantity}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-24">
                                <Input
                                  type="number"
                                  min="0"
                                  value={item.finalQuantity}
                                  onChange={(e) => updateItemQuantity(index, parseInt(e.target.value) || 0)}
                                  className="text-center"
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeItem(index)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Resumen */}
                  <Card className="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                    <CardContent className="py-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm text-muted-foreground">Cantidad Total</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            {orderItems.reduce((sum, item) => sum + item.finalQuantity, 0)} unidades
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Costo Estimado</p>
                          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                            ${formatCOP(orderItems.reduce((sum, item) => 
                              sum + ((item.product.current_cost || 0) * item.finalQuantity), 0
                            ))}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setPhase('filters')}>
                  <ChevronLeft className="h-4 w-4 mr-2" />
                  Volver a Filtros
                </Button>
                <Button 
                  onClick={() => setShowPdfPreview(true)}
                  className="bg-green-600 hover:bg-green-700"
                  disabled={orderItems.length === 0}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Realizar Pedido
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Preview PDF */}
      <Dialog open={showPdfPreview} onOpenChange={setShowPdfPreview}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generar Documento de Pedido</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Advertencia cuando está en web */}
            {!isPrintingAvailable() && (
              <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="text-red-600 dark:text-red-400 mt-0.5">⚠️</div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-1">
                      Impresión No Disponible
                    </p>
                    <p className="text-xs text-red-800 dark:text-red-200">
                      Usa la aplicación de escritorio para imprimir. Puedes descargar el PDF desde el navegador.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              El documento incluirá {orderItems.length} producto{orderItems.length !== 1 ? 's' : ''} con un total de{' '}
              {orderItems.reduce((sum, item) => sum + item.finalQuantity, 0)} unidades.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                onClick={() => generatePDF('download')}
                className="w-full"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
              <Button
                onClick={() => generatePDF('print')}
                disabled={!isPrintingAvailable()}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}