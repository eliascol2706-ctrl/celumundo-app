import { useState, useMemo } from 'react';
import { X, Download, Printer, Calendar, Filter, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { formatCOP } from '../lib/currency';
import { extractColombiaDate, getColombiaDate, type Invoice } from '../lib/supabase';
import { toast } from 'sonner';
import { jsPDF } from 'jspdf';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';

interface ProductSalesReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoices: Invoice[];
  products: any[];
}

interface SoldProduct {
  productId: string;
  productName: string;
  quantitySold: number;
  totalRevenue: number;
  averagePrice: number;
  unitIds: string[];
  category?: string;
}

export function ProductSalesReportDialog({
  open,
  onOpenChange,
  invoices,
  products
}: ProductSalesReportDialogProps) {
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'currentMonth' | 'previousMonth' | 'all'>('today');
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity' | 'name'>('revenue');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Calcular productos vendidos según los filtros
  const soldProducts = useMemo(() => {
    // Filtrar facturas por periodo
    let filteredInvoices = [...invoices];
    const todayStr = getColombiaDate();
    const today = new Date(todayStr + 'T00:00:00-05:00');

    if (periodFilter !== 'all') {
      filteredInvoices = filteredInvoices.filter(inv => {
        const invDate = extractColombiaDate(inv.date);

        if (periodFilter === 'today') {
          return invDate === todayStr;
        } else if (periodFilter === 'yesterday') {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          return invDate === yesterdayStr;
        } else if (periodFilter === 'currentMonth') {
          const currentMonth = todayStr.slice(0, 7);
          return invDate.startsWith(currentMonth);
        } else if (periodFilter === 'previousMonth') {
          const currentDate = new Date(today);
          currentDate.setMonth(currentDate.getMonth() - 1);
          const previousMonth = currentDate.toISOString().slice(0, 7);
          return invDate.startsWith(previousMonth);
        }
        return true;
      });
    }

    // Solo facturas pagadas o parcialmente devueltas
    filteredInvoices = filteredInvoices.filter(inv => 
      inv.status === 'paid' || inv.status === 'partial_return'
    );

    // Agregar productos
    const productMap = new Map<string, SoldProduct>();

    filteredInvoices.forEach(invoice => {
      invoice.items.forEach((item: any) => {
        // Buscar producto en la lista de productos para obtener la categoría
        const productData = products.find(p => p.id === item.productId);
        
        const existing = productMap.get(item.productId);

        if (existing) {
          existing.quantitySold += item.quantity;
          existing.totalRevenue += item.total;
          existing.averagePrice = existing.totalRevenue / existing.quantitySold;
          
          // Agregar IDs únicos si existen
          if (item.unitIds && Array.isArray(item.unitIds)) {
            existing.unitIds.push(...item.unitIds);
          }
        } else {
          productMap.set(item.productId, {
            productId: item.productId,
            productName: item.productName,
            quantitySold: item.quantity,
            totalRevenue: item.total,
            averagePrice: item.price,
            unitIds: item.unitIds || [],
            category: productData?.category || 'Sin categoría'
          });
        }
      });
    });

    // Convertir a array y ordenar
    let productsArray = Array.from(productMap.values());

    if (sortBy === 'revenue') {
      productsArray.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (sortBy === 'quantity') {
      productsArray.sort((a, b) => b.quantitySold - a.quantitySold);
    } else if (sortBy === 'name') {
      productsArray.sort((a, b) => a.productName.localeCompare(b.productName));
    }

    return productsArray;
  }, [invoices, products, periodFilter, sortBy]);

  // Obtener categorías únicas de los productos vendidos
  const uniqueCategories = useMemo(() => {
    const categories = new Set<string>();
    soldProducts.forEach(p => {
      if (p.category) {
        categories.add(p.category);
      }
    });
    return Array.from(categories).sort();
  }, [soldProducts]);

  // Filtrar productos por categoría y búsqueda
  const filteredProducts = useMemo(() => {
    let filtered = [...soldProducts];

    // Filtrar por categoría
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category === categoryFilter);
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      const lowerSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(product => 
        product.productName.toLowerCase().includes(lowerSearch)
      );
    }

    return filtered;
  }, [soldProducts, categoryFilter, searchTerm]);

  // Calcular totales del periodo completo (sin filtros de búsqueda ni categoría)
  const totals = useMemo(() => {
    return {
      totalProducts: soldProducts.length,
      totalQuantity: soldProducts.reduce((sum, p) => sum + p.quantitySold, 0),
      totalRevenue: soldProducts.reduce((sum, p) => sum + p.totalRevenue, 0)
    };
  }, [soldProducts]);

  // Calcular totales de productos filtrados
  const filteredTotals = useMemo(() => {
    return {
      totalProducts: filteredProducts.length,
      totalQuantity: filteredProducts.reduce((sum, p) => sum + p.quantitySold, 0),
      totalRevenue: filteredProducts.reduce((sum, p) => sum + p.totalRevenue, 0)
    };
  }, [filteredProducts]);

  const getPeriodLabel = () => {
    const todayStr = getColombiaDate();
    const today = new Date(todayStr + 'T00:00:00-05:00');

    if (periodFilter === 'today') {
      return `Hoy - ${new Date(todayStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    } else if (periodFilter === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return `Ayer - ${yesterday.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}`;
    } else if (periodFilter === 'currentMonth') {
      return `Mes Actual - ${new Date(todayStr).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    } else if (periodFilter === 'previousMonth') {
      const currentDate = new Date(today);
      currentDate.setMonth(currentDate.getMonth() - 1);
      return `Mes Anterior - ${currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
    } else {
      return 'Todos los registros';
    }
  };

  const generatePDF = (download: boolean = false) => {
    // Usar filteredProducts para el PDF
    if (filteredProducts.length === 0) {
      toast.error('No hay productos para generar el reporte');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = 20;

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('REGISTRO DE VENTAS DE PRODUCTOS', pageWidth / 2, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(getPeriodLabel(), pageWidth / 2, y, { align: 'center' });
    
    y += 10;
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text(`Generado: ${new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`, pageWidth / 2, y, { align: 'center' });
    
    // Mostrar filtros aplicados
    if (categoryFilter !== 'all' || searchTerm) {
      y += 5;
      let filterText = 'Filtros: ';
      const filters = [];
      if (categoryFilter !== 'all') filters.push(`Categoría: ${categoryFilter}`);
      if (searchTerm) filters.push(`Búsqueda: "${searchTerm}"`);
      filterText += filters.join(' | ');
      doc.text(filterText, pageWidth / 2, y, { align: 'center' });
    }
    
    doc.setTextColor(0, 0, 0);
    y += 10;

    // Totales (usar filteredTotals para mostrar solo los productos filtrados)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y, pageWidth - 2 * margin, 20, 'F');
    
    doc.text(`Total Productos Diferentes: ${filteredTotals.totalProducts}`, margin + 5, y + 7);
    doc.text(`Total Unidades Vendidas: ${filteredTotals.totalQuantity}`, margin + 5, y + 14);
    doc.text(`Total Ingresos: COP ${formatCOP(filteredTotals.totalRevenue)}`, pageWidth - margin - 5, y + 7, { align: 'right' });
    
    y += 25;

    // Table Header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(22, 163, 74); // Verde
    doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
    
    doc.text('Producto', margin + 2, y + 5);
    doc.text('Cant.', margin + 100, y + 5, { align: 'right' });
    doc.text('P. Prom.', margin + 120, y + 5, { align: 'right' });
    doc.text('Total Ventas', pageWidth - margin - 2, y + 5, { align: 'right' });
    
    y += 10;
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');

    // Products (usar filteredProducts)
    filteredProducts.forEach((product, index) => {
      // Verificar si necesitamos nueva página
      if (y > pageHeight - 40) {
        doc.addPage();
        y = 20;
        
        // Re-dibujar header en nueva página
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(22, 163, 74);
        doc.setTextColor(255, 255, 255);
        doc.rect(margin, y, pageWidth - 2 * margin, 7, 'F');
        
        doc.text('Producto', margin + 2, y + 5);
        doc.text('Cant.', margin + 100, y + 5, { align: 'right' });
        doc.text('P. Prom.', margin + 120, y + 5, { align: 'right' });
        doc.text('Total Ventas', pageWidth - margin - 2, y + 5, { align: 'right' });
        
        y += 10;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
      }

      // Alternar color de fondo
      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y - 4, pageWidth - 2 * margin, 6, 'F');
      }

      // Producto (truncar si es muy largo)
      const productName = product.productName.length > 50 
        ? product.productName.substring(0, 47) + '...' 
        : product.productName;
      doc.text(productName, margin + 2, y);
      doc.text(product.quantitySold.toString(), margin + 100, y, { align: 'right' });
      doc.text(formatCOP(product.averagePrice), margin + 120, y, { align: 'right' });
      doc.text(formatCOP(product.totalRevenue), pageWidth - margin - 2, y, { align: 'right' });
      
      y += 6;

      // Si tiene IDs únicos, agregarlos en la siguiente línea
      if (product.unitIds.length > 0) {
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        const idsText = 'IDs: ' + product.unitIds.join(', ');
        
        // Dividir IDs si son muy largos
        const maxWidth = pageWidth - 2 * margin - 4;
        const lines = doc.splitTextToSize(idsText, maxWidth);
        
        lines.forEach((line: string) => {
          if (y > pageHeight - 30) {
            doc.addPage();
            y = 20;
          }
          doc.text(line, margin + 2, y);
          y += 4;
        });
        
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        y += 2;
      }
    });

    // Footer
    y += 10;
    if (y > pageHeight - 30) {
      doc.addPage();
      y = 20;
    }
    
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 7;
    
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text('CELUMUNDO VIP - Sistema de Gestión de Inventarios', pageWidth / 2, y, { align: 'center' });
    y += 5;
    doc.text('www.celumundovip.com', pageWidth / 2, y, { align: 'center' });

    // Descargar o imprimir
    if (download) {
      doc.save(`Registro_Ventas_Productos_${periodFilter}_${new Date().getTime()}.pdf`);
      toast.success('PDF descargado exitosamente');
    } else {
      doc.autoPrint();
      window.open(doc.output('bloburl'), '_blank');
      toast.success('Abriendo vista de impresión...');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-green-600 dark:text-green-400" />
            Registro de Ventas de Productos
          </DialogTitle>
          <DialogDescription>
            Visualiza y exporta todos los productos vendidos según las facturas pagadas
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Filtros */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Periodo</label>
                  <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="yesterday">Ayer</SelectItem>
                      <SelectItem value="currentMonth">Mes Actual</SelectItem>
                      <SelectItem value="previousMonth">Mes Anterior</SelectItem>
                      <SelectItem value="all">Todos los registros</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Categoría</label>
                  <Select value={categoryFilter} onValueChange={(value: string) => setCategoryFilter(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas las categorías" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las categorías</SelectItem>
                      {uniqueCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Ordenar por</label>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Mayor Ingreso</SelectItem>
                      <SelectItem value="quantity">Mayor Cantidad</SelectItem>
                      <SelectItem value="name">Nombre (A-Z)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Campo de búsqueda */}
              <div>
                <label className="text-sm font-medium mb-2 block">Buscar Producto</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar producto por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estadísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Productos Diferentes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {filteredTotals.totalProducts}
                </div>
                {(categoryFilter !== 'all' || searchTerm) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    de {totals.totalProducts} totales
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unidades Vendidas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredTotals.totalQuantity}
                </div>
                {(categoryFilter !== 'all' || searchTerm) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    de {totals.totalQuantity} totales
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Ingresos Totales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  COP {formatCOP(filteredTotals.totalRevenue)}
                </div>
                {(categoryFilter !== 'all' || searchTerm) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    de COP {formatCOP(totals.totalRevenue)}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tabla de productos */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Productos Vendidos - {getPeriodLabel()}</CardTitle>
                <div className="flex gap-2">
                  <Button
                    onClick={() => generatePDF(true)}
                    variant="outline"
                    size="sm"
                    disabled={filteredProducts.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Descargar PDF
                  </Button>
                  <Button
                    onClick={() => generatePDF(false)}
                    variant="default"
                    size="sm"
                    disabled={filteredProducts.length === 0}
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Imprimir PDF
                  </Button>
                </div>
              </div>

              {/* Mostrar info de filtros aplicados */}
              {(categoryFilter !== 'all' || searchTerm) && (
                <div className="mt-3 text-sm text-muted-foreground">
                  Mostrando {filteredProducts.length} de {soldProducts.length} productos
                  {filteredProducts.length > 0 && (
                    <span className="ml-2">
                      ({filteredTotals.totalQuantity} unidades - COP {formatCOP(filteredTotals.totalRevenue)})
                    </span>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-3 text-sm font-medium">Producto</th>
                      <th className="text-center py-3 px-3 text-sm font-medium">Cantidad</th>
                      <th className="text-right py-3 px-3 text-sm font-medium">Precio Promedio</th>
                      <th className="text-right py-3 px-3 text-sm font-medium">Total Ventas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((product, index) => (
                      <tr key={product.productId} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-3">
                          <div>
                            <div className="font-medium text-sm">{product.productName}</div>
                            {product.category && (
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {product.category}
                              </div>
                            )}
                            {product.unitIds.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                IDs: {product.unitIds.join(', ')}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center text-sm font-medium">
                          {product.quantitySold}
                        </td>
                        <td className="py-3 px-3 text-right text-sm">
                          COP {formatCOP(product.averagePrice)}
                        </td>
                        <td className="py-3 px-3 text-right text-sm font-bold text-green-600 dark:text-green-400">
                          COP {formatCOP(product.totalRevenue)}
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-muted-foreground">
                          {searchTerm || categoryFilter !== 'all' 
                            ? 'No se encontraron productos con los filtros aplicados' 
                            : 'No hay productos vendidos en el periodo seleccionado'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Botón cerrar */}
          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={handleClose}>
              <X className="h-4 w-4 mr-2" />
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
