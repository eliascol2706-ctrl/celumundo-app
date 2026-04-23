import { useEffect, useState, useRef } from "react";
import { Plus, Search, Pencil, Trash2, AlertCircle, Percent, List, X, Printer, Eye, Loader2, FileText } from 'lucide-react';
import { getProducts, getAllProducts, searchProducts, addProduct, updateProduct, deleteProduct, getDepartments, type Product, type Department, supabase } from '../lib/supabase';
import { extractIds } from '../lib/unit-ids-utils';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { copyToClipboard } from '../lib/clipboard';
import { includesIgnoreAccents } from '../lib/string-utils';
import { jsPDF } from 'jspdf';
import { OrderDialog } from '../components/OrderDialog';
import { isPrintingAvailable } from '../lib/platform-detector';
import { getPrinterConfig, printDirect } from '../lib/printer-config';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para búsqueda avanzada
  const [searchCode, setSearchCode] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');

  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const [totalProducts, setTotalProducts] = useState(0);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isUnitIdsDialogOpen, setIsUnitIdsDialogOpen] = useState(false);
  const [selectedProductForIds, setSelectedProductForIds] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // Prevenir doble clic

  // Estados para el sistema de impresión
  const [isPrintOptionsOpen, setIsPrintOptionsOpen] = useState(false);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    nameFilter: '',
    categoryFilter: 'all' as string,
    stockOrder: 'asc' as 'asc' | 'desc',
    includeZeroStock: true
  });

  // Estado para el sistema de pedidos
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    currentCost: '',
    oldCost: '',
    price1: '',
    price2: '',
    finalPrice: '',
    stock: '',
    minStock: '',
    category: '',
    margin1: '',
    margin2: '',
    marginFinal: '',
    useUnitIds: false,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadDepartments();
        // Cargar productos inicialmente
        await loadProducts();
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Error al cargar los datos');
      }
    };
    loadData();
  }, []);

  // Nuevo useEffect: recargar productos solo cuando cambie la página (después del primer render)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    loadProducts();
  }, [currentPage]);

  const loadDepartments = async () => {
    const data = await getDepartments();
    setDepartments(data);
  };

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      const result = await searchProducts({
        code: searchCode,
        name: searchName,
        description: searchDescription,
        category: searchCategory,
        page: currentPage - 1, // searchProducts usa índice 0
        pageSize: itemsPerPage
      });
      setProducts(result.products);
      setTotalProducts(result.total);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Error al cargar productos');
    } finally {
      setIsLoading(false);
    }
  };

  const getNextProductCode = async () => {
    // Obtener TODOS los productos de la base de datos para encontrar el código más alto
    const allProducts = await getAllProducts();

    if (allProducts.length === 0) {
      return { base: 'A10001A', variant: 1 };
    }

    // Extraer todos los códigos base para encontrar el máximo
    const baseCodes = allProducts.map(p => {
      const match = p.code.match(/A(\d+)A/);
      return match ? parseInt(match[1]) : 10000;
    });

    const maxBaseNumber = Math.max(...baseCodes, 10000);

    // Si estamos creando un producto nuevo, usar el siguiente número base
    const nextBaseNumber = maxBaseNumber >= 10000 ? maxBaseNumber + 1 : 10001;
    const baseCode = `A${nextBaseNumber.toString().padStart(5, '0')}A`;

    return { base: baseCode, variant: 1 };
  };

  // Obtener el siguiente número de variante para un código base
  const getNextVariantNumber = (baseCode: string): number => {
    const variants = products.filter(p => p.code === baseCode);
    if (variants.length === 0) return 1;
    
    const variantNumbers = variants.map(p => p.variant_number || 1);
    return Math.max(...variantNumbers) + 1;
  };

  // Generar código completo con extensión
  const generateFullCode = (baseCode: string, variantNumber: number): string => {
    // Validar que variantNumber sea un número válido
    const safeVariantNumber = variantNumber && !isNaN(variantNumber) ? variantNumber : 1;
    // Validar que baseCode sea válido
    const safeBaseCode = baseCode || 'A10001A';
    return `${safeBaseCode.slice(0, -1)}-${safeVariantNumber.toString().padStart(4, '0')}A`;
  };

  // Los productos ya vienen filtrados desde el servidor
  // No necesitamos filtrado local

  // Obtener categorías únicas para el filtro (necesitamos cargar todas las categorías)
  const [allCategories, setAllCategories] = useState<string[]>([]);
  useEffect(() => {
    const loadCategories = async () => {
      const allProducts = await getAllProducts();
      const categories = Array.from(new Set(allProducts.map(p => p.category)))
        .filter(category => category && category.trim() !== '')
        .sort();
      setAllCategories(categories);
    };
    loadCategories();
  }, []);

  // Calcular paginación del lado del servidor
  const totalPages = Math.ceil(totalProducts / itemsPerPage);

  // Los productos ya vienen paginados desde el servidor
  const paginatedProducts = products;

  // Función para ejecutar búsqueda (resetea a página 1 y carga productos)
  const handleSearch = () => {
    setCurrentPage(1);
    loadProducts();
  };

  // Calcular precio desde margen
  const calculatePriceFromMargin = (cost: number, margin: number): number => {
    return cost * (1 + margin / 100);
  };

  // Calcular margen desde precio
  const calculateMarginFromPrice = (cost: number, price: number): number => {
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  };

  // Actualizar precio cuando cambia el margen
  const handleMarginChange = (field: 'margin1' | 'margin2' | 'marginFinal', value: string) => {
    const cost = parseFloat(formData.currentCost) || 0;
    const margin = parseFloat(value) || 0;
    const price = calculatePriceFromMargin(cost, margin);

    const priceField = field === 'margin1' ? 'price1' : field === 'margin2' ? 'price2' : 'finalPrice';

    setFormData({
      ...formData,
      [field]: value,
      [priceField]: price.toFixed(2),
    });
  };

  // Actualizar margen cuando cambia el precio
  const handlePriceChange = (field: 'price1' | 'price2' | 'finalPrice', value: string) => {
    const cost = parseFloat(formData.currentCost) || 0;
    const price = parseFloat(value) || 0;
    const margin = calculateMarginFromPrice(cost, price);

    const marginField = field === 'price1' ? 'margin1' : field === 'price2' ? 'margin2' : 'marginFinal';

    setFormData({
      ...formData,
      [field]: value,
      [marginField]: margin.toFixed(2),
    });
  };

  // Actualizar todos los precios cuando cambia el costo
  const handleCostChange = (value: string) => {
    const cost = parseFloat(value) || 0;
    
    const margin1 = parseFloat(formData.margin1) || 0;
    const margin2 = parseFloat(formData.margin2) || 0;
    const marginFinal = parseFloat(formData.marginFinal) || 0;

    setFormData({
      ...formData,
      currentCost: value,
      price1: cost > 0 ? calculatePriceFromMargin(cost, margin1).toFixed(2) : '',
      price2: cost > 0 ? calculatePriceFromMargin(cost, margin2).toFixed(2) : '',
      finalPrice: cost > 0 ? calculatePriceFromMargin(cost, marginFinal).toFixed(2) : '',
    });
  };

  // Obtener productos para impresión con filtros y ordenamiento
  const getProductsForPrint = () => {
    let productsToShow = [...products];

    // Filtrar por nombre (búsqueda)
    if (printOptions.nameFilter.trim()) {
      productsToShow = productsToShow.filter(p =>
        includesIgnoreAccents(p.name, printOptions.nameFilter)
      );
    }

    // Filtrar por categoría
    if (printOptions.categoryFilter !== 'all') {
      productsToShow = productsToShow.filter(p => p.category === printOptions.categoryFilter);
    }

    // Filtrar por stock cero
    if (!printOptions.includeZeroStock) {
      productsToShow = productsToShow.filter(p => p.stock > 0);
    }

    // Ordenar por nombre primero
    productsToShow.sort((a, b) => a.name.localeCompare(b.name));

    // Ordenar por stock
    if (printOptions.stockOrder === 'asc') {
      productsToShow.sort((a, b) => a.stock - b.stock);
    } else {
      productsToShow.sort((a, b) => b.stock - a.stock);
    }

    return productsToShow;
  };

  // Generar PDF para impresión
  const handlePrintToPDF = async () => {
    // Validar plataforma
    if (!isPrintingAvailable()) {
      toast.error('La impresión solo está disponible en la aplicación de escritorio');
      return;
    }

    try {
      const config = await getPrinterConfig();

      if (!config.pdf) {
        toast.error('No se ha configurado una impresora PDF. Ve a Configuración para configurarla.');
        return;
      }

      const productsToShow = getProductsForPrint();

      if (productsToShow.length === 0) {
        toast.error('No hay productos para imprimir');
        return;
      }

      const date = new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Generar filtros aplicados
      let filterText = '';
      if (printOptions.nameFilter) {
        filterText += `Nombre: "${printOptions.nameFilter}" | `;
      }
      if (printOptions.categoryFilter !== 'all') {
        filterText += `Categoría: ${printOptions.categoryFilter} | `;
      }
      filterText += `Stock: ${printOptions.stockOrder === 'asc' ? '↑ Menor a Mayor' : '↓ Mayor a Menor'} | `;
      filterText += `${printOptions.includeZeroStock ? 'Con' : 'Sin'} stock 0`;

      // Generar filas de productos
      const productsHTML = productsToShow.map((product) => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${product.code}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${product.name}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${product.category}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center; font-weight: bold; color: ${product.stock <= 0 ? '#ef4444' : product.stock <= (product.min_stock || 0) ? '#f59e0b' : '#22c55e'};">
            ${product.stock}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 500;">
            COP ${formatCOP(product.final_price)}
          </td>
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
              .container {
                max-width: 800px;
                margin: 0 auto;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 3px solid #1976d2;
              }
              .title {
                font-size: 24pt;
                font-weight: bold;
                color: #1976d2;
                margin-bottom: 10px;
              }
              .subtitle {
                font-size: 11pt;
                color: #666;
                margin-bottom: 5px;
              }
              .filters {
                font-size: 9pt;
                color: #666;
                font-style: italic;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }
              thead {
                background-color: #1976d2;
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
              .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 2px solid #ddd;
                text-align: center;
                color: #666;
                font-size: 10pt;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <!-- Header -->
              <div class="header">
                <div class="title">REPORTE DE PRODUCTOS</div>
                <div class="subtitle">Fecha: ${date}</div>
                <div class="filters">Filtros: ${filterText}</div>
              </div>

              <!-- Table -->
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Categoría</th>
                    <th style="text-align: center;">Stock</th>
                    <th style="text-align: right;">Precio Final</th>
                  </tr>
                </thead>
                <tbody>
                  ${productsHTML}
                </tbody>
              </table>

              <!-- Footer -->
              <div class="footer">
                <p><strong>Total de productos: ${productsToShow.length}</strong></p>
                <p>CELUMUNDO VIP - Sistema de Gestión de Inventarios</p>
                <p>www.celumundovip.com</p>
                <p>${new Date().toLocaleString('es-ES')}</p>
              </div>
            </div>
          </body>
        </html>
      `;

      const success = await printDirect(config.pdf, html, 'pdf');

      if (!success) {
        throw new Error('Error al enviar el documento a la impresora');
      }

      toast.success('Documento enviado a la impresora');
    } catch (error: any) {
      console.error('Error al imprimir:', error);
      toast.error(error.message || 'Error al imprimir el reporte');
    }
  };

  const handleOpenDialog = async (product?: Product) => {
    if (product) {
      setEditingProduct(product);

      // Calcular márgenes si no existen
      const currentCost = product.current_cost || 0;
      const margin1 = product.margin1 !== undefined ? product.margin1 :
        (currentCost > 0 ? calculateMarginFromPrice(currentCost, product.price1) : 0);
      const margin2 = product.margin2 !== undefined ? product.margin2 :
        (currentCost > 0 ? calculateMarginFromPrice(currentCost, product.price2) : 0);
      const marginFinal = product.margin_final !== undefined ? product.margin_final :
        (currentCost > 0 ? calculateMarginFromPrice(currentCost, product.final_price) : 0);

      // Usar full_code si existe, si no generar desde code y variant_number
      const displayCode = product.full_code || generateFullCode(product.code, product.variant_number);

      setFormData({
        code: displayCode,
        name: product.name,
        description: product.description,
        currentCost: product.current_cost.toString(),
        oldCost: product.old_cost.toString(),
        price1: product.price1.toString(),
        price2: product.price2.toString(),
        finalPrice: product.final_price.toString(),
        stock: product.stock.toString(),
        minStock: product.min_stock.toString(),
        category: product.category,
        margin1: margin1.toFixed(2),
        margin2: margin2.toFixed(2),
        marginFinal: marginFinal.toFixed(2),
        useUnitIds: product.use_unit_ids || false,
      });
    } else {
      setEditingProduct(null);
      const { base } = await getNextProductCode();
      // Al crear nuevo, solo mostrar el código base sin extensión de variante
      setFormData({
        code: base,
        name: '',
        description: '',
        currentCost: '',
        oldCost: '',
        price1: '',
        price2: '',
        finalPrice: '',
        stock: '0',
        minStock: '5',
        category: '',
        margin1: '',
        margin2: '',
        marginFinal: '',
        useUnitIds: false,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevenir doble clic
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Extraer código base del código ingresado
      // Soporta formatos: A10001A (base) o A10001-0001A (con variante)
      let baseCode = formData.code;
      let variantNumber = 1;
      
      // Si tiene formato con variante: A10001-0001A
      const fullCodeMatch = formData.code.match(/A(\d+)-(\d+)A/);
      if (fullCodeMatch) {
        baseCode = `A${fullCodeMatch[1]}A`;
        variantNumber = parseInt(fullCodeMatch[2]);
      } else {
        // Si tiene formato base: A10001A, extraer solo el número
        const baseCodeMatch = formData.code.match(/A(\d+)A/);
        if (baseCodeMatch) {
          baseCode = formData.code; // Mantener el formato base
          variantNumber = 1;
        }
      }
      
      const productData = {
        code: baseCode,
        full_code: formData.code,
        variant_number: variantNumber,
        name: formData.name,
        description: formData.description,
        current_cost: parseFloat(formData.currentCost),
        old_cost: parseFloat(formData.oldCost),
        price1: parseFloat(formData.price1),
        price2: parseFloat(formData.price2),
        final_price: parseFloat(formData.finalPrice),
        stock: parseInt(formData.stock),
        min_stock: parseInt(formData.minStock),
        category: formData.category,
        margin1: parseFloat(formData.margin1),
        margin2: parseFloat(formData.margin2),
        margin_final: parseFloat(formData.marginFinal),
        use_unit_ids: formData.useUnitIds,
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productData);
        toast.success('Producto actualizado correctamente');
      } else {
        await addProduct(productData);
        toast.success('Producto agregado correctamente');
      }

      setIsDialogOpen(false);
      loadProducts();
    } catch (error) {
      console.error('Error al guardar producto:', error);
      toast.error(error instanceof Error ? error.message : 'Error al guardar el producto');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`¿Estás seguro de eliminar el producto "${name}"?`)) {
      await deleteProduct(id);
      toast.success('Producto eliminado');
      loadProducts();
    }
  };

  const handleOpenUnitIdsDialog = (product: Product) => {
    setSelectedProductForIds(product);
    setIsUnitIdsDialogOpen(true);
  };

  // Función para eliminar una ID específica del producto
  const handleDeleteUnitId = async (productId: string, idToDelete: string) => {
    if (!confirm(`¿Estás seguro de eliminar la ID "${idToDelete}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const product = products.find(p => p.id === productId);
      if (!product || !product.registered_ids) return;

      // Remover la ID del array
      const updatedIds = product.registered_ids.filter(item => item.id !== idToDelete);
      
      // Actualizar el producto en Supabase
      await updateProduct(productId, {
        registered_ids: updatedIds,
        stock: updatedIds.length, // Actualizar el stock también
      });

      toast.success(`ID "${idToDelete}" eliminada correctamente`);
      
      // Recargar productos
      await loadProducts();
      
      // Actualizar el producto seleccionado en el diálogo si está abierto
      if (selectedProductForIds && selectedProductForIds.id === productId) {
        const updatedProduct = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();
        if (updatedProduct.data) {
          setSelectedProductForIds(updatedProduct.data as Product);
        }
      }
      
      // Actualizar el producto en edición si está abierto
      if (editingProduct && editingProduct.id === productId) {
        const updatedProduct = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .single();
        if (updatedProduct.data) {
          setEditingProduct(updatedProduct.data as Product);
        }
      }
    } catch (error) {
      console.error('Error al eliminar ID:', error);
      toast.error('Error al eliminar la ID');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Cargando productos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Productos</h2>
          <p className="text-muted-foreground mt-1">Gestión de inventario</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            onClick={() => setIsOrderDialogOpen(true)}
            disabled={!isPrintingAvailable()}
            className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 w-full sm:w-auto text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileText className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Realizar Pedido</span>
            <span className="sm:hidden">Pedido</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsPrintOptionsOpen(true)}
            disabled={!isPrintingAvailable()}
            className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950 w-full sm:w-auto text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Imprimir Productos</span>
            <span className="sm:hidden">Imprimir</span>
          </Button>
          <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto text-sm">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

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
                Las funciones de impresión solo están disponibles en la aplicación de escritorio.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Buscador Avanzado */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <Input
                type="text"
                placeholder="Buscar por código..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Buscar por nombre..."
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Buscar por descripción..."
                value={searchDescription}
                onChange={(e) => setSearchDescription(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <div>
              <Select value={searchCategory} onValueChange={setSearchCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.name}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              onClick={handleSearch}
              className="flex-1"
              disabled={isLoading}
            >
              <Search className="h-4 w-4 mr-2" />
              {isLoading ? 'Buscando...' : 'Buscar Productos'}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setSearchCode('');
                setSearchName('');
                setSearchDescription('');
                setSearchCategory('all');
                setCurrentPage(1);
                loadProducts();
              }}
              disabled={isLoading}
            >
              <X className="h-4 w-4 mr-2" />
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista de productos */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lista de Productos ({totalProducts})</CardTitle>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Código</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Producto</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Categoría</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Precio</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Stock</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedProducts.map((product) => {
                  return (
                    <tr key={product.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-bold text-gray-900 dark:text-gray-100">
                          {product.code}
                        </span>
                        {product.use_unit_ids && (
                          <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
                            🔢 IDs
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{product.name}</p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">{product.description}</p>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs rounded-full">
                          {product.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <p className="font-medium text-gray-900 dark:text-gray-100">
                          {formatCOP(product.final_price)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Costo: {formatCOP(product.current_cost)}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.stock <= product.min_stock && (
                            <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                          )}
                          <span className={`font-medium ${
                            product.stock <= product.min_stock ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                          }`}>
                            {product.stock}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Mín: {product.min_stock}</p>
                        {product.use_unit_ids && product.registered_ids && (
                          <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                            IDs: {product.registered_ids.length}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {product.use_unit_ids && product.registered_ids && product.registered_ids.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenUnitIdsDialog(product)}
                              title="Ver IDs registradas"
                            >
                              <List className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDialog(product)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(product.id, product.name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {paginatedProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 dark:text-gray-400">
                      No se encontraron productos
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog para agregar/editar */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingProduct ? 'Editar Producto' : 'Nuevo Producto'}
            </DialogTitle>
            <DialogDescription>
              Complete el formulario. Los precios se calculan automáticamente según el margen de ganancia.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4 py-4">
              {/* Código y Categoría */}
              <div className="space-y-2">
                <Label htmlFor="code">
                  Código {!editingProduct && <span className="text-xs text-green-600">(Generado automáticamente)</span>}
                </Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  readOnly={!editingProduct}
                  disabled={!editingProduct}
                  className={!editingProduct ? 'bg-green-50 dark:bg-green-950 font-mono text-lg font-bold text-green-600 dark:text-green-400 cursor-not-allowed' : 'font-mono'}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.name}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Nombre y Descripción */}
              <div className="col-span-2 space-y-2">
                <Label htmlFor="name">Nombre del Producto</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="description">Descripción (Opcional)</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* Costos */}
              <div className="space-y-2">
                <Label htmlFor="currentCost">Costo Actual</Label>
                <Input
                  id="currentCost"
                  type="number"
                  step="0.01"
                  value={formData.currentCost}
                  onChange={(e) => handleCostChange(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oldCost">Costo Anterior</Label>
                <Input
                  id="oldCost"
                  type="number"
                  step="0.01"
                  value={formData.oldCost}
                  onChange={(e) => setFormData({ ...formData, oldCost: e.target.value })}
                  required
                />
              </div>

              {/* Precio 1 con Margen */}
              <div className="col-span-2 bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <h4 className="font-semibold text-blue-700 dark:text-blue-300 mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Precio 1
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="margin1">Margen de Ganancia (%)</Label>
                    <Input
                      id="margin1"
                      type="number"
                      step="0.01"
                      value={formData.margin1}
                      onChange={(e) => handleMarginChange('margin1', e.target.value)}
                      placeholder="Ej: 25"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price1">Precio de Venta (COP)</Label>
                    <Input
                      id="price1"
                      type="number"
                      step="0.01"
                      value={formData.price1}
                      onChange={(e) => handlePriceChange('price1', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Precio 2 con Margen */}
              <div className="col-span-2 bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <h4 className="font-semibold text-green-700 dark:text-green-300 mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Precio 2
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="margin2">Margen de Ganancia (%)</Label>
                    <Input
                      id="margin2"
                      type="number"
                      step="0.01"
                      value={formData.margin2}
                      onChange={(e) => handleMarginChange('margin2', e.target.value)}
                      placeholder="Ej: 35"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price2">Precio de Venta (COP)</Label>
                    <Input
                      id="price2"
                      type="number"
                      step="0.01"
                      value={formData.price2}
                      onChange={(e) => handlePriceChange('price2', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Precio Final con Margen */}
              <div className="col-span-2 bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Precio Final
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="marginFinal">Margen de Ganancia (%)</Label>
                    <Input
                      id="marginFinal"
                      type="number"
                      step="0.01"
                      value={formData.marginFinal}
                      onChange={(e) => handleMarginChange('marginFinal', e.target.value)}
                      placeholder="Ej: 50"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="finalPrice">Precio de Venta (COP)</Label>
                    <Input
                      id="finalPrice"
                      type="number"
                      step="0.01"
                      value={formData.finalPrice}
                      onChange={(e) => handlePriceChange('finalPrice', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Stock */}
              <div className="space-y-2">
                <Label htmlFor="stock">
                  Stock Actual {!editingProduct && <span className="text-xs text-gray-500">(Se actualiza con movimientos)</span>}
                </Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                  readOnly={!editingProduct}
                  disabled={!editingProduct}
                  className={!editingProduct ? 'bg-gray-100 dark:bg-gray-900 cursor-not-allowed' : ''}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStock">Stock Mínimo</Label>
                <Input
                  id="minStock"
                  type="number"
                  value={formData.minStock}
                  onChange={(e) => setFormData({ ...formData, minStock: e.target.value })}
                  required
                />
              </div>

              {/* Checkbox para IDs únicas */}
              <div className="col-span-2 space-y-2">
                <div className="flex items-center space-x-2 p-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <input
                    type="checkbox"
                    id="useUnitIds"
                    checked={formData.useUnitIds}
                    onChange={(e) => setFormData({ ...formData, useUnitIds: e.target.checked })}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                  />
                  <Label htmlFor="useUnitIds" className="cursor-pointer font-medium">
                    Este producto requiere IDs únicas por unidad
                  </Label>
                </div>
                <p className="text-xs text-muted-foreground pl-1">
                  Activa esta opción para productos de alto valor (celulares, tablets, etc.) que requieren seguimiento individual. Las IDs se asignarán automáticamente al registrar movimientos de entrada.
                </p>
              </div>

              {/* Mostrar IDs registradas si está editando y el producto usa IDs */}
              {editingProduct && editingProduct.use_unit_ids && editingProduct.registered_ids && editingProduct.registered_ids.length > 0 && (
                <div className="col-span-2 space-y-2">
                  <Label>IDs Registradas ({editingProduct.registered_ids.length}) - Click en X para eliminar</Label>
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg max-h-40 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {editingProduct.registered_ids.map((item) => (
                        <div
                          key={item.id}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-mono rounded-full group hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                          title={item.note || 'Sin nota'}
                        >
                          <span>{item.id}</span>
                          {item.note && <span className="text-[10px] opacity-70">({item.note.substring(0, 15)}{item.note.length > 15 ? '...' : ''})</span>}
                          <button
                            type="button"
                            onClick={() => handleDeleteUnitId(editingProduct.id, item.id)}
                            className="ml-1 hover:bg-red-200 dark:hover:bg-red-800 rounded-full p-0.5 transition-colors"
                            title={`Eliminar ID ${item.id}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    ⚠️ Al eliminar una ID, el stock se reducirá automáticamente.
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando...' : (editingProduct ? 'Actualizar' : 'Guardar')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog para IDs únicas */}
      <Dialog open={isUnitIdsDialogOpen} onOpenChange={setIsUnitIdsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <List className="h-5 w-5 text-blue-600" />
              IDs Únicas Registradas
            </DialogTitle>
            <DialogDescription>
              Lista de todas las IDs únicas registradas para este producto
            </DialogDescription>
          </DialogHeader>
          
          {selectedProductForIds && (
            <div className="mt-2 mb-4">
              <p className="font-medium text-gray-900">{selectedProductForIds.name}</p>
              <p className="text-sm text-gray-600">Código: {selectedProductForIds.code}</p>
            </div>
          )}
          
          {selectedProductForIds && selectedProductForIds.use_unit_ids && (
            <div className="space-y-4 py-4">
              {selectedProductForIds.registered_ids && selectedProductForIds.registered_ids.length > 0 ? (
                <>
                  <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-blue-900 dark:text-blue-100">
                          Total de IDs Registradas
                        </p>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          Unidades individuales con seguimiento
                        </p>
                      </div>
                      <div className="text-4xl font-bold text-blue-600">
                        {selectedProductForIds.registered_ids.length}
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-gray-700 mb-3 block">
                      Listado de IDs (Click para copiar / Botón rojo para eliminar)
                    </Label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-4 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg max-h-80 overflow-y-auto">
                      {selectedProductForIds.registered_ids
                        .sort((a, b) => parseInt(a.id) - parseInt(b.id))
                        .map((item) => {
                          const fullCode = `${selectedProductForIds.code.slice(0, -1)}-${item.id}A`;
                          return (
                            <div
                              key={item.id}
                              className="relative group"
                              title={item.note || 'Sin nota'}
                            >
                              <button
                                type="button"
                                onClick={async () => {
                                  const success = await copyToClipboard(fullCode);
                                  if (success) {
                                    toast.success(`Copiado: ${fullCode}`);
                                  } else {
                                    toast.error('No se pudo copiar al portapapeles');
                                  }
                                }}
                                className="w-full px-3 py-2 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900 dark:to-green-800 hover:from-green-200 hover:to-green-300 dark:hover:from-green-800 dark:hover:to-green-700 text-green-800 dark:text-green-200 text-sm font-mono rounded-lg border-2 border-green-300 dark:border-green-700 transition-all hover:scale-105 cursor-pointer shadow-sm hover:shadow-md flex flex-col items-center gap-0.5"
                                title={`Click para copiar: ${fullCode}${item.note ? ` - ${item.note}` : ''}`}
                              >
                                <span>{item.id}</span>
                                {item.note && <span className="text-[9px] opacity-60 text-center line-clamp-1">{item.note}</span>}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUnitId(selectedProductForIds.id, item.id)}
                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                                title={`Eliminar ID ${item.id}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-200">
                      💡 <strong>Tip:</strong> Haz clic en cualquier ID para copiar el código completo al portapapeles. Pasa el mouse sobre una ID y presiona el botón rojo para eliminarla.
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
                      Ejemplo: Click en "0001" copia "{selectedProductForIds.code.slice(0, -1)}-0001A"
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full mb-4">
                    <List className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 font-medium">
                    No hay IDs registradas aún
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    Las IDs se generarán automáticamente cuando registres una entrada de inventario
                  </p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsUnitIdsDialogOpen(false)}
            >
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Opciones de Impresión */}
      <Dialog open={isPrintOptionsOpen} onOpenChange={setIsPrintOptionsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Printer className="h-4 w-4 sm:h-5 sm:w-5" />
              Filtros de Impresión
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Filtra y ordena los productos a imprimir
            </DialogDescription>
          </DialogHeader>

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
                    La impresión solo está disponible en la aplicación de escritorio.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4 sm:space-y-6 py-2 sm:py-4">
            {/* Filtrar por Nombre */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Buscar por Nombre</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Escribe para buscar productos..."
                  value={printOptions.nameFilter}
                  onChange={(e) => setPrintOptions({ ...printOptions, nameFilter: e.target.value })}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Deja vacío para incluir todos los productos
              </p>
            </div>

            {/* Filtrar por Categoría */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Filtrar por Categoría</Label>
              <Select
                value={printOptions.categoryFilter}
                onValueChange={(value) => setPrintOptions({ ...printOptions, categoryFilter: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Ordenar Stock */}
            <div className="space-y-2 sm:space-y-3">
              <Label className="text-sm sm:text-base font-semibold">Ordenar por Stock</Label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  onClick={() => setPrintOptions({ ...printOptions, stockOrder: 'asc' })}
                  className={`p-2 sm:p-4 rounded-lg border-2 transition-all ${
                    printOptions.stockOrder === 'asc'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="font-medium text-sm sm:text-base">Menor a Mayor</div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">↑</div>
                </button>
                <button
                  onClick={() => setPrintOptions({ ...printOptions, stockOrder: 'desc' })}
                  className={`p-2 sm:p-4 rounded-lg border-2 transition-all ${
                    printOptions.stockOrder === 'desc'
                      ? 'border-blue-600 bg-blue-50 dark:bg-blue-950/30'
                      : 'border-border hover:border-blue-300 dark:hover:border-blue-700'
                  }`}
                >
                  <div className="font-medium text-sm sm:text-base">Mayor a Menor</div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">↓</div>
                </button>
              </div>
            </div>

            {/* Incluir productos sin stock */}
            <div className="space-y-2 sm:space-y-3">
              <div className="flex items-center justify-between p-3 sm:p-4 rounded-lg border bg-card gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm sm:text-base">Productos sin stock</div>
                  <div className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">
                    Incluir productos con 0 unidades
                  </div>
                </div>
                <button
                  onClick={() => setPrintOptions({ ...printOptions, includeZeroStock: !printOptions.includeZeroStock })}
                  className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
                    printOptions.includeZeroStock ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      printOptions.includeZeroStock ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Resumen */}
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="text-green-600 dark:text-green-400 mt-0.5 text-sm sm:text-base">📊</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                    Resumen de Filtros
                  </p>
                  <ul className="text-xs text-green-800 dark:text-green-200 space-y-0.5 sm:space-y-1">
                    {printOptions.nameFilter && (
                      <li className="truncate">• Nombre: <strong>"{printOptions.nameFilter}"</strong></li>
                    )}
                    {printOptions.categoryFilter !== 'all' && (
                      <li className="truncate">• Categoría: <strong>{printOptions.categoryFilter}</strong></li>
                    )}
                    <li className="truncate">• Stock ordenado: <strong>{printOptions.stockOrder === 'asc' ? 'Menor a Mayor ↑' : 'Mayor a Menor ↓'}</strong></li>
                    <li className="truncate">• {printOptions.includeZeroStock ? 'Incluye' : 'Excluye'} stock 0</li>
                    <li className="truncate font-semibold">• Total: <strong className="text-base">{getProductsForPrint().length}</strong> productos</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => {
                setIsPrintOptionsOpen(false);
                // Resetear filtros al cerrar
                setPrintOptions({
                  nameFilter: '',
                  categoryFilter: 'all',
                  stockOrder: 'asc',
                  includeZeroStock: true
                });
              }}
              className="w-full sm:w-auto text-sm"
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setIsPrintOptionsOpen(false);
                setIsPrintPreviewOpen(true);
              }}
              className="w-full sm:w-auto border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 text-sm"
            >
              <Eye className="h-4 w-4 mr-2" />
              Vista Previa
            </Button>
            <Button
              onClick={() => {
                setIsPrintOptionsOpen(false);
                handlePrintToPDF();
              }}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={getProductsForPrint().length === 0 || !isPrintingAvailable()}
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Vista Previa */}
      <Dialog open={isPrintPreviewOpen} onOpenChange={setIsPrintPreviewOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Eye className="h-4 w-4 sm:h-5 sm:w-5" />
              Vista Previa
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Revisa los productos a imprimir
            </DialogDescription>
          </DialogHeader>

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
                    La impresión solo está disponible en la aplicación de escritorio.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto -mx-3 sm:mx-0">
            {/* Información de filtros */}
            <div className="bg-muted/50 p-2 sm:p-4 rounded-lg mb-3 sm:mb-4 sticky top-0 z-10 mx-3 sm:mx-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                <div className="flex flex-wrap items-center gap-2 sm:gap-6 text-xs sm:text-sm">
                  {printOptions.nameFilter && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Nombre:</span>
                      <strong>"{printOptions.nameFilter}"</strong>
                    </div>
                  )}
                  {printOptions.categoryFilter !== 'all' && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Categoría:</span>
                      <strong>{printOptions.categoryFilter}</strong>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Stock:</span>
                    <strong>{printOptions.stockOrder === 'asc' ? '↑' : '↓'}</strong>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Stock 0:</span>
                    <strong>{printOptions.includeZeroStock ? 'Sí' : 'No'}</strong>
                  </div>
                </div>
                <div className="text-xs sm:text-sm font-semibold whitespace-nowrap">
                  Total: {getProductsForPrint().length}
                </div>
              </div>
            </div>

            {/* Tabla de productos - Scrollable horizontalmente en móvil */}
            <div className="border rounded-lg overflow-hidden mx-3 sm:mx-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm">#</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm">Código</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm">Nombre</th>
                      <th className="text-left p-2 sm:p-3 font-semibold text-xs sm:text-sm">Categoría</th>
                      <th className="text-right p-2 sm:p-3 font-semibold text-xs sm:text-sm">Stock</th>
                      <th className="text-right p-2 sm:p-3 font-semibold text-xs sm:text-sm">Precio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getProductsForPrint().map((product, index) => (
                      <tr
                        key={product.id}
                        className="border-t hover:bg-muted/30 transition-colors"
                      >
                        <td className="p-2 sm:p-3 text-muted-foreground text-xs sm:text-sm">{index + 1}</td>
                        <td className="p-2 sm:p-3 font-mono text-xs sm:text-sm">{product.code}</td>
                        <td className="p-2 sm:p-3 text-xs sm:text-sm">{product.name}</td>
                        <td className="p-2 sm:p-3">
                          <span className="inline-block px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
                            {product.category}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-right">
                          <span className={`font-semibold text-xs sm:text-sm ${
                            product.stock === 0
                              ? 'text-red-600 dark:text-red-400'
                              : product.stock <= product.min_stock
                              ? 'text-yellow-600 dark:text-yellow-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {product.stock}
                          </span>
                        </td>
                        <td className="p-2 sm:p-3 text-right font-semibold text-xs sm:text-sm">
                          {formatCOP(product.final_price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-3 sm:mt-4 gap-2 flex-col sm:flex-row">
            <Button
              variant="outline"
              onClick={() => setIsPrintPreviewOpen(false)}
              className="w-full sm:w-auto text-sm"
            >
              Cerrar
            </Button>
            <Button
              onClick={() => {
                setIsPrintPreviewOpen(false);
                handlePrintToPDF();
              }}
              disabled={!isPrintingAvailable()}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Printer className="h-4 w-4 mr-2" />
              Imprimir PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Realizar Pedido */}
      <OrderDialog
        open={isOrderDialogOpen}
        onOpenChange={setIsOrderDialogOpen}
        products={products}
      />
    </div>
  );
}