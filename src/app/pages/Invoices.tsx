import { useEffect, useState, useRef } from 'react';
import { Plus, Search, Eye, FileText, Printer, Download, X, Info, Scan, Hash, RotateCcw, CreditCard, Trash2, Receipt, Calendar, Loader2, Check } from 'lucide-react';
import {
  getInvoices,
  getProducts,
  getAllProducts,
  searchProductsForInvoice,
  updateProduct,
  getCurrentCompany,
  getCurrentUser,
  addMovement,
  getCreditPaymentsByInvoice,
  deleteCreditPayment,
  canCreateInvoice,
  getColombiaDateTime,
  getColombiaDate,
  extractColombiaDate,
  confirmInvoicePayment,
  getCustomers,
  type CreditPayment,
  supabase
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { jsPDF } from 'jspdf';
import { ProductInfoDialog } from '../components/ProductInfoDialog';
import { ThermalInvoicePrint } from '../components/ThermalInvoicePrint';
import { includesIgnoreAccents } from '../lib/string-utils';

interface InvoiceItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  total: number;
  useUnitIds?: boolean;
  unitIds?: string[];
  availableIds?: string[];
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
  status: 'pending' | 'paid' | 'cancelled' | 'pending_confirmation'; // ACTUALIZADO
  payment_method?: string;
  payment_note?: string; // NUEVO
  payment_cash?: number;
  payment_transfer?: number;
  payment_other?: number;
  attended_by?: string;
  is_credit?: boolean; // Si es una venta a crédito
  credit_balance?: number; // Saldo pendiente por pagar
  due_date?: string; // Fecha de vencimiento para créditos
  created_at?: string;
  updated_at?: string;
}

interface Product {
  id: string;
  company: 'celumundo' | 'repuestos';
  code: string;
  name: string;
  description: string;
  current_cost: number;
  old_cost: number;
  price1: number;
  price2: number;
  final_price: number;
  margin1: number;
  margin2: number;
  margin_final: number;
  stock: number;
  min_stock: number;
  category: string;
  use_unit_ids: boolean;
  registered_ids: Array<{ id: string; note: string }>;
  created_at?: string;
  updated_at?: string;
}

export function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'recent' | 'highest' | 'lowest' | 'oldest'>('recent');
  const [periodFilter, setPeriodFilter] = useState<'today' | 'yesterday' | 'current_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'last_year' | 'all'>('today');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [isThermalPrintDialogOpen, setIsThermalPrintDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceType, setInvoiceType] = useState<'regular' | 'wholesale'>('regular');
  const [selectedProductInfo, setSelectedProductInfo] = useState<Product | null>(null);
  const [invoiceToPrint, setInvoiceToPrint] = useState<Invoice | null>(null);
  const invoiceRef = useRef<HTMLDivElement>(null);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [isProductInfoDialogOpen, setIsProductInfoDialogOpen] = useState(false);
  
  // Búsqueda y filtrado de productos
  const [productSearchInput, setProductSearchInput] = useState(''); // Lo que escribe el usuario
  const [productSearchTerm, setProductSearchTerm] = useState(''); // Término real para filtrar
  const [productSortOrder, setProductSortOrder] = useState<'az' | 'highest' | 'lowest'>('az');
  const [isSearchingProducts, setIsSearchingProducts] = useState(false);

  // Función para ejecutar búsqueda del lado del servidor
  const handleProductSearch = async () => {
    setIsSearchingProducts(true);
    try {
      const results = await searchProductsForInvoice(productSearchInput);
      setProducts(results);
      setProductSearchTerm(productSearchInput);
    } catch (error) {
      console.error('Error searching products:', error);
      toast.error('Error al buscar productos');
    } finally {
      setIsSearchingProducts(false);
    }
  };
  
  // Dialog de selección de productos
  const [isProductSelectDialogOpen, setIsProductSelectDialogOpen] = useState(false);
  
  // Estados para el lector de código de barras
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Estado para selector de IDs únicas
  const [unitIdDialogOpen, setUnitIdDialogOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  
  const [formData, setFormData] = useState({
    customerName: '',
    customerDocument: '',
  });
  
  const [isCredit, setIsCredit] = useState(false); // NUEVO: Para ventas a crédito
  const [isPendingConfirmation, setIsPendingConfirmation] = useState(false); // NUEVO: Para facturas en confirmación
  
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [currentItem, setCurrentItem] = useState({
    productId: '',
    quantity: '1',
    price: '',
  });
  
  // Estado para los abonos
  const [creditPayments, setCreditPayments] = useState<CreditPayment[]>([]);
  
  // Estado para prevenir doble clic
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false); // Para la validación de canCreateInvoice
  
  // Dialog de método de pago
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    cash: 0,
    transfer: 0,
    other: 0,
    note: '', // NUEVO: Nota adicional del pago
  });

  // Dialog de confirmar pago de factura pendiente
  const [isConfirmPaymentDialogOpen, setIsConfirmPaymentDialogOpen] = useState(false);
  const [invoiceToConfirm, setInvoiceToConfirm] = useState<Invoice | null>(null);

  // Estados para selector de clientes existentes
  const [customers, setCustomers] = useState<{ id: string; name: string; document: string }[]>([]);
  const [showExistingCustomers, setShowExistingCustomers] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  // Manejar entrada de código de barras
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Solo capturar cuando el diálogo está abierto y no hay focus en inputs
      if (!isCreateDialogOpen || document.activeElement?.tagName === 'INPUT') return;
      
      // Limpiar timeout anterior
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
      
      // Si es Enter, procesar el código
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        const code = barcodeBuffer.trim();
        setBarcodeBuffer('');
        
        console.log('🔵 Código RAW recibido del lector:', code, 'Longitud:', code.length);
        
        // Detectar si el código incluye un ID de unidad
        // El lector de código de barras entrega códigos continuos de 9 dígitos
        // Formato: "100020010" -> primeros 5 dígitos = código producto (10002), últimos 4 = ID unidad (0010)
        let scannedUnitId: string | null = null;
        let productCodeToSearch = code;
        
        // Limpiar código de posibles letras A
        const cleanCode = code.replace(/A/g, '');
        
        // Si el código tiene 9 dígitos exactos (después de limpiar), separar código de producto y ID de unidad
        if (/^\d{9}$/.test(cleanCode)) {
          productCodeToSearch = cleanCode.substring(0, 5); // Primeros 5 dígitos
          scannedUnitId = cleanCode.substring(5, 9); // Últimos 4 dígitos
          console.log('📊 Código escaneado (9 dígitos):', {
            codigoCompleto: cleanCode,
            codigoProducto: productCodeToSearch,
            idUnidad: scannedUnitId
          });
        } 
        // Si tiene 5 dígitos, es solo código de producto
        else if (/^\d{5}$/.test(cleanCode)) {
          productCodeToSearch = cleanCode;
          console.log('📊 Código escaneado (5 dígitos - solo producto):', {
            codigoProducto: productCodeToSearch
          });
        }
        // También soportar formato con guión: "10001-0001"
        else if (cleanCode.includes('-')) {
          const parts = cleanCode.split('-');
          if (parts.length === 2) {
            productCodeToSearch = parts[0];
            scannedUnitId = parts[1];
          }
        }
        
        console.log('🔍 Buscando producto con código:', productCodeToSearch);
        
        // Buscar producto por código
        const product = products.find(p => {
          const numericCode = p.code.replace(/[^0-9]/g, '');
          const match = numericCode === productCodeToSearch || numericCode === cleanCode || p.code === code;
          console.log('  Comparando:', {
            producto: p.name,
            codigoOriginal: p.code,
            codigoNumerico: numericCode,
            buscando: productCodeToSearch,
            coincide: match ? '✅' : '❌'
          });
          return match;
        });
        
        console.log('✅ Producto encontrado:', product ? product.name : '❌ NO ENCONTRADO');
        
        if (product) {
          // Verificar stock SOLO para productos con IDs únicas
          if (product.use_unit_ids && product.stock <= 0) {
            toast.error(`${product.name} requiere IDs únicas y no tiene stock disponible`);
            return;
          }
          
          // Verificar si ya está agregado
          if (invoiceItems.some(item => item.productId === product.id)) {
            toast.error('Este producto ya está agregado');
            return;
          }
          
          // Agregar automáticamente el producto
          const defaultPrice = invoiceType === 'regular' ? product.final_price : product.price2;
          
          const newItem: InvoiceItem = {
            productId: product.id,
            productName: product.name,
            productCode: product.code,
            quantity: 1,
            price: defaultPrice,
            total: defaultPrice,
            useUnitIds: product.use_unit_ids,
            unitIds: [],
            availableIds: product.use_unit_ids ? (product.registered_ids || []) : undefined,
          };
          
          // Si usa IDs, abrir selector
          if (product.use_unit_ids) {
            if ((product.registered_ids || []).length === 0) {
              toast.error(`${product.name} no tiene IDs registradas disponibles`);
              return;
            }
            
            // Si se escaneó un ID de unidad específico, pre-seleccionarlo
            if (scannedUnitId && product.registered_ids?.includes(scannedUnitId)) {
              // Agregar el producto con el ID ya seleccionado
              newItem.unitIds = [scannedUnitId];
              newItem.quantity = 1;
              setInvoiceItems(prev => [...prev, newItem]);
              toast.success(`Producto agregado: ${product.name} (ID: ${scannedUnitId})`);
            } else {
              // Abrir el selector de IDs normalmente
              setInvoiceItems(prev => [...prev, newItem]);
              setCurrentItemIndex(invoiceItems.length);
              
              // Si se escaneó un ID pero no está disponible, notificar
              if (scannedUnitId) {
                toast.warning(`ID ${scannedUnitId} no disponible. Seleccione una ID manualmente.`);
              }
              
              setSelectedUnitIds([]);
              setUnitIdDialogOpen(true);
            }
          } else {
            setInvoiceItems(prev => [...prev, newItem]);
            toast.success(`Producto agregado: ${product.name}`);
          }
        } else {
          toast.error('Producto no encontrado');
        }
        return;
      }
      
      // Agregar carácter al buffer si es alfanumérico
      if (e.key.length === 1) {
        setBarcodeBuffer(prev => prev + e.key);
        
        // Resetear buffer después de 100ms de inactividad
        barcodeTimeoutRef.current = setTimeout(() => {
          setBarcodeBuffer('');
        }, 100);
      }
    };
    
    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [isCreateDialogOpen, barcodeBuffer, products, invoiceType, invoiceItems]);

  // Escuchar evento personalizado para abrir el diálogo de crear factura desde el botón flotante
  useEffect(() => {
    const handleOpenDialog = () => {
      handleOpenCreateDialog();
    };
    
    window.addEventListener('openCreateInvoiceDialog', handleOpenDialog);
    
    return () => {
      window.removeEventListener('openCreateInvoiceDialog', handleOpenDialog);
    };
  }, []); // Solo se ejecuta al montar/desmontar el componente

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [invoicesData, productsData, customersData] = await Promise.all([
        getInvoices(),
        getAllProducts(),
        getCustomers(),
      ]);
      setInvoices(invoicesData);
      setProducts(productsData);
      setCustomers(customersData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setIsLoading(false);
    }
  };

  const getSortedInvoices = () => {
    // Filtrar por período
    let periodFiltered = invoices;
    const colombiaToday = getColombiaDate(); // YYYY-MM-DD en zona horaria de Colombia

    switch (periodFilter) {
      case 'today': {
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate === colombiaToday;
        });
        break;
      }
      case 'yesterday': {
        // Calcular ayer en zona horaria de Colombia
        const todayDate = new Date(colombiaToday + 'T12:00:00');
        todayDate.setDate(todayDate.getDate() - 1);
        const year = todayDate.getFullYear();
        const month = String(todayDate.getMonth() + 1).padStart(2, '0');
        const day = String(todayDate.getDate()).padStart(2, '0');
        const colombiaYesterday = `${year}-${month}-${day}`;
        
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate === colombiaYesterday;
        });
        break;
      }
      case 'current_month': {
        const currentMonth = colombiaToday.substring(0, 7); // YYYY-MM
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate.substring(0, 7) === currentMonth;
        });
        break;
      }
      case 'last_month': {
        // Calcular mes anterior usando fecha de Colombia
        const todayDate = new Date(colombiaToday + 'T12:00:00');
        todayDate.setMonth(todayDate.getMonth() - 1);
        const year = todayDate.getFullYear();
        const month = String(todayDate.getMonth() + 1).padStart(2, '0');
        const lastMonth = `${year}-${month}`;
        
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate.substring(0, 7) === lastMonth;
        });
        break;
      }
      case 'last_3_months': {
        const todayDate = new Date(colombiaToday + 'T12:00:00');
        todayDate.setMonth(todayDate.getMonth() - 3);
        const threeMonthsAgo = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-01`;
        
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate >= threeMonthsAgo;
        });
        break;
      }
      case 'last_6_months': {
        const todayDate = new Date(colombiaToday + 'T12:00:00');
        todayDate.setMonth(todayDate.getMonth() - 6);
        const sixMonthsAgo = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-01`;
        
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate >= sixMonthsAgo;
        });
        break;
      }
      case 'last_year': {
        const todayDate = new Date(colombiaToday + 'T12:00:00');
        todayDate.setFullYear(todayDate.getFullYear() - 1);
        const oneYearAgo = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-01`;
        
        periodFiltered = invoices.filter(invoice => {
          if (!invoice.date) return false;
          const invoiceDate = extractColombiaDate(invoice.date);
          return invoiceDate >= oneYearAgo;
        });
        break;
      }
      case 'all':
        periodFiltered = invoices;
        break;
    }

    // Filtrar por búsqueda
    const filtered = periodFiltered.filter(invoice =>
      invoice.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Ordenar
    return filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'recent':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'oldest':
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        case 'highest':
          return b.total - a.total;
        case 'lowest':
          return a.total - b.total;
        default:
          return 0;
      }
    });
  };

  const getSortedProducts = () => {
    const filtered = products.filter(product =>
      includesIgnoreAccents(product.name, productSearchTerm) ||
      includesIgnoreAccents(product.code, productSearchTerm) ||
      includesIgnoreAccents(product.category, productSearchTerm)
    );

    return filtered.sort((a, b) => {
      switch (productSortOrder) {
        case 'az':
          return a.name.localeCompare(b.name);
        case 'highest':
          return (invoiceType === 'regular' ? b.final_price : b.price2) - 
                 (invoiceType === 'regular' ? a.final_price : a.price2);
        case 'lowest':
          return (invoiceType === 'regular' ? a.final_price : a.price2) - 
                 (invoiceType === 'regular' ? b.final_price : b.price2);
        default:
          return 0;
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  // Cargar abonos cuando se selecciona una factura para imprimir
  useEffect(() => {
    const loadPaymentsForPrint = async () => {
      if (invoiceToPrint?.is_credit) {
        const payments = await getCreditPaymentsByInvoice(invoiceToPrint.id);
        setCreditPayments(payments);
      } else {
        setCreditPayments([]);
      }
    };
    
    if (invoiceToPrint) {
      loadPaymentsForPrint();
    }
  }, [invoiceToPrint]);

  const handleOpenCreateDialog = async () => {
    try {
      setIsValidating(true);

      // Validar si se puede crear una factura (verificar cierre pendiente)
      const validation = await canCreateInvoice();

      if (!validation.canCreate) {
        const toastMessage = validation.message || 'No se puede crear factura en este momento';
        const toastDuration = validation.requiresMonthlyClose ? 10000 : 8000;
        const buttonLabel = validation.requiresMonthlyClose ? '🔒 Realizar Cierre Mensual' : 'Ir a Cierres';

        toast.error(toastMessage, {
          duration: toastDuration,
          action: {
            label: buttonLabel,
            onClick: () => window.location.href = '/cierres'
          }
        });
        return;
      }

      setInvoiceType('regular');
      setFormData({ customerName: '', customerDocument: '' });
      setInvoiceItems([]);
      setCurrentItem({ productId: '', quantity: '1', price: '' });
      setSelectedProductInfo(null);
      setShowExistingCustomers(false);
      setSelectedCustomerId('');
      setEditingInvoiceId(null);
      setIsCredit(false);
      setIsPendingConfirmation(false);
      setIsCreateDialogOpen(true);

      // Recargar productos cada vez que se abre el diálogo para mostrar productos recién creados
      const productsData = await getAllProducts();
      setProducts(productsData);
    } catch (error) {
      console.error('Error opening create dialog:', error);
      toast.error('Error al abrir el diálogo de facturación');
    } finally {
      setIsValidating(false);
    }
  };

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) {
      setSelectedProductInfo(null);
      setCurrentItem({ ...currentItem, productId: '', price: '' });
      return;
    }

    setSelectedProductInfo(product);
    const defaultPrice = invoiceType === 'regular' ? product.final_price : product.price2;
    setCurrentItem({
      productId,
      quantity: '1',
      price: defaultPrice.toString(),
    });
  };

  const handleOpenProductSelectDialog = async () => {
    // Recargar productos antes de abrir el diálogo de selección
    const productsData = await getAllProducts();
    setProducts(productsData);
    setIsProductSelectDialogOpen(true);
  };

  const handleAddItem = () => {
    if (!currentItem.productId) {
      toast.error('Selecciona un producto');
      return;
    }

    const product = products.find(p => p.id === currentItem.productId);
    if (!product) return;

    const quantity = parseInt(currentItem.quantity) || 1;
    const price = parseFloat(currentItem.price) || 0;

    if (quantity <= 0 || price <= 0) {
      toast.error('Cantidad y precio deben ser mayores a 0');
      return;
    }

    if (product.stock < quantity) {
      toast.error('Stock insuficiente');
      return;
    }

    if (invoiceItems.some(item => item.productId === product.id)) {
      toast.error('Este producto ya está agregado');
      return;
    }

    // Verificar IDs si el producto las usa
    if (product.use_unit_ids) {
      const availableIds = product.registered_ids || [];
      if (availableIds.length < quantity) {
        toast.error(`Solo hay ${availableIds.length} unidades con ID disponibles`);
        return;
      }
    }

    const total = quantity * price;

    const newItem: InvoiceItem = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity,
      price,
      total,
      useUnitIds: product.use_unit_ids,
      unitIds: [],
      availableIds: product.use_unit_ids ? (product.registered_ids || []) : undefined,
    };

    // Si usa IDs, abrir selector
    if (product.use_unit_ids) {
      setInvoiceItems([...invoiceItems, newItem]);
      setCurrentItemIndex(invoiceItems.length);
      setSelectedUnitIds([]);
      setUnitIdDialogOpen(true);
    } else {
      setInvoiceItems([...invoiceItems, newItem]);
      toast.success('Producto agregado');
    }

    setCurrentItem({ productId: '', quantity: '1', price: '' });
    setSelectedProductInfo(null);
  };

  const handleAddProductDirect = (product: Product) => {
    // En lugar de agregar directamente, seleccionar el producto en el formulario
    setCurrentItem({
      productId: product.id,
      quantity: '1',
      price: (invoiceType === 'regular' ? product.final_price : product.price2).toString(),
    });

    // Mostrar información del producto
    setSelectedProductInfo(product);

    // Cerrar el diálogo de búsqueda
    setIsProductSelectDialogOpen(false);

    toast.success(`Producto seleccionado: ${product.name}`);
  };

  const handleRemoveItem = (index: number) => {
    setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
  };

  const handleUpdateItemQuantity = (index: number, quantity: number) => {
    const updated = [...invoiceItems];
    const item = updated[index];
    
    if (quantity <= 0) return;
    
    // Verificar stock
    const product = products.find(p => p.id === item.productId);
    if (product && product.stock < quantity) {
      toast.error('Stock insuficiente');
      return;
    }
    
    // Si usa IDs, verificar disponibilidad y ajustar IDs
    if (item.useUnitIds && item.availableIds) {
      if (quantity > item.availableIds.length) {
        toast.error(`Solo hay ${item.availableIds.length} unidades disponibles`);
        return;
      }
      
      // Ajustar IDs seleccionadas
      if (quantity < item.unitIds!.length) {
        item.unitIds = item.unitIds!.slice(0, quantity);
      }
    }
    
    updated[index].quantity = quantity;
    updated[index].total = quantity * item.price;
    setInvoiceItems(updated);
  };

  const handleUpdateItemPrice = (index: number, price: number) => {
    if (price < 0) return;
    const updated = [...invoiceItems];
    updated[index].price = price;
    updated[index].total = price * updated[index].quantity;
    setInvoiceItems(updated);
  };

  const handleOpenUnitIdSelector = (index: number) => {
    setCurrentItemIndex(index);
    setSelectedUnitIds([...invoiceItems[index].unitIds!]);
    setUnitIdDialogOpen(true);
  };

  const toggleUnitId = (unitId: string) => {
    const item = invoiceItems[currentItemIndex!];
    
    if (selectedUnitIds.includes(unitId)) {
      setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
    } else {
      if (selectedUnitIds.length >= item.quantity) {
        toast.error(`Solo puedes seleccionar ${item.quantity} IDs`);
        return;
      }
      setSelectedUnitIds([...selectedUnitIds, unitId]);
    }
  };

  const handleSaveUnitIds = () => {
    if (currentItemIndex === null) return;
    
    const item = invoiceItems[currentItemIndex];
    
    if (selectedUnitIds.length !== item.quantity) {
      toast.error(`Debes seleccionar exactamente ${item.quantity} IDs`);
      return;
    }
    
    const updated = [...invoiceItems];
    updated[currentItemIndex].unitIds = selectedUnitIds;
    setInvoiceItems(updated);
    setUnitIdDialogOpen(false);
    setCurrentItemIndex(null);
    setSelectedUnitIds([]);
    toast.success('IDs seleccionadas correctamente');
  };

  const calculateTotals = () => {
    const total = invoiceItems.reduce((sum, item) => sum + item.total, 0);
    return { subtotal: total, tax: 0, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (invoiceItems.length === 0) {
      toast.error('Agrega al menos un producto');
      return;
    }

    // Validar que productos con IDs tengan IDs seleccionadas
    for (const item of invoiceItems) {
      if (item.useUnitIds && (!item.unitIds || item.unitIds.length === 0)) {
        toast.error(`Debes seleccionar las IDs para ${item.productName}. Haz clic en "Seleccionar IDs" en la lista de productos.`);
        return;
      }
      if (item.useUnitIds && item.unitIds && item.unitIds.length !== item.quantity) {
        toast.error(`${item.productName}: Debes seleccionar ${item.quantity} IDs pero solo has seleccionado ${item.unitIds.length}`);
        return;
      }
    }

    // Si es crédito O factura pendiente O editando factura existente, crear directamente sin pasar por el diálogo de pago
    if (isCredit || isPendingConfirmation || editingInvoiceId) {
      await handleConfirmPayment();
      return;
    }

    // Si NO es crédito ni pendiente, abrir diálogo de método de pago
    const { total } = calculateTotals();
    setPaymentData({
      cash: total,
      transfer: 0,
      other: 0,
      note: '',
    });
    setIsPaymentDialogOpen(true);
  };
  
  const handleConfirmPayment = async () => {
    // Prevenir doble clic
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      // Si es crédito y es venta al mayor, validar que tenga nombre y documento
      if (isCredit && invoiceType === 'wholesale') {
        if (!formData.customerName || !formData.customerDocument) {
          toast.error('Para ventas a crédito debe ingresar nombre y documento del cliente');
          setIsSubmitting(false);
          return;
        }
      }
      
      // Si NO es crédito NI pendiente de confirmación, validar que la suma sea igual al total
      const { subtotal, tax, total } = calculateTotals();
      if (!isCredit && !isPendingConfirmation) {
        const paymentTotal = paymentData.cash + paymentData.transfer + paymentData.other;
        
        if (Math.abs(paymentTotal - total) > 0.01) {
          toast.error(`El total de los pagos (${formatCOP(paymentTotal)}) debe ser igual al total de la factura (${formatCOP(total)})`);
          setIsSubmitting(false);
          return;
        }
      }
      
      const user = getCurrentUser();
      const company = getCurrentCompany();

      // Obtener siguiente número de factura
      const { data: nextNumber } = await supabase.rpc('get_next_invoice_number', { 
        company_name: company 
      });

      // Formatear métodos de pago (solo si NO es crédito NI pendiente de confirmación)
      let paymentMethodStr = '';
      if (!isCredit && !isPendingConfirmation) {
        const paymentMethods = [];
        if (paymentData.cash > 0) paymentMethods.push(`Efectivo: ${formatCOP(paymentData.cash)}`);
        if (paymentData.transfer > 0) paymentMethods.push(`Transferencia: ${formatCOP(paymentData.transfer)}`);
        if (paymentData.other > 0) paymentMethods.push(`Otros: ${formatCOP(paymentData.other)}`);
        paymentMethodStr = paymentMethods.join(', ');
      }

      // Si estamos editando una factura existente (agregar productos a factura pendiente)
      if (editingInvoiceId) {
        const { data: updatedInvoice, error: updateError } = await supabase
          .from('invoices')
          .update({
            items: invoiceItems.map(item => ({
              productId: item.productId,
              productName: item.productName,
              productCode: item.productCode,
              quantity: item.quantity,
              price: item.price,
              total: item.total,
              unitIds: item.unitIds || []
            })),
            subtotal,
            tax,
            total,
            credit_balance: total, // Actualizar saldo
          })
          .eq('id', editingInvoiceId)
          .eq('company', company)
          .select()
          .single();
        
        if (updateError) {
          console.error('Error updating invoice:', updateError);
          throw new Error('Error al actualizar factura');
        }

        // Registrar movimientos de inventario para los nuevos productos
        for (const item of invoiceItems) {
          await addMovement({
            type: 'exit',
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            reason: 'Venta - Factura',
            reference: updatedInvoice.number,
            user_name: getCurrentUser()?.username || 'Usuario',
            unit_ids: item.unitIds || []
          });
        }

        toast.success('Factura actualizada exitosamente');
        setIsCreateDialogOpen(false);
        setIsPaymentDialogOpen(false);
        setEditingInvoiceId(null);
        await loadData();
        
        // Resetear formulario
        setInvoiceItems([]);
        setFormData({ customerName: '', customerDocument: '' });
        setIsCredit(false);
        setIsPendingConfirmation(false);
        setShowExistingCustomers(false);
        setSelectedCustomerId('');
        setIsSubmitting(false);
        return;
      }

      // Crear factura nueva
      const invoiceData = {
        company,
        number: nextNumber || '00001',
        date: getColombiaDateTime().toISOString(), // Fecha y hora completa de Colombia (GMT-5)
        type: invoiceType,
        customer_name: formData.customerName || undefined,
        customer_document: formData.customerDocument || undefined,
        items: invoiceItems.map(item => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          unitIds: item.unitIds || []
        })),
        subtotal,
        tax,
        total,
        status: isPendingConfirmation ? ('pending_confirmation' as const) : (isCredit ? ('pending' as const) : ('paid' as const)), // ACTUALIZADO: Usar status para pending_confirmation
        payment_method: (isCredit || isPendingConfirmation) ? undefined : paymentMethodStr,
        payment_cash: (isCredit || isPendingConfirmation) ? undefined : paymentData.cash,
        payment_transfer: (isCredit || isPendingConfirmation) ? undefined : paymentData.transfer,
        payment_other: (isCredit || isPendingConfirmation) ? undefined : paymentData.other,
        payment_note: (!isCredit && !isPendingConfirmation && paymentData.note) ? paymentData.note : undefined, // NUEVO
        attended_by: user?.username || 'Usuario',
        is_credit: isCredit,
        credit_balance: isCredit ? total : undefined,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert([invoiceData])
        .select()
        .single();

      if (invoiceError) {
        console.error('Error creating invoice:', invoiceError);
        throw new Error('Error al crear factura');
      }

      // Si es crédito, crear o actualizar el cliente
      if (isCredit && formData.customerDocument) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('*')
          .eq('company', company)
          .eq('document', formData.customerDocument)
          .single();

        if (existingCustomer) {
          // Actualizar cliente existente
          await supabase
            .from('customers')
            .update({
              name: formData.customerName,
              total_credit: existingCustomer.total_credit + total,
            })
            .eq('id', existingCustomer.id);
        } else {
          // Crear nuevo cliente
          await supabase
            .from('customers')
            .insert([{
              company,
              name: formData.customerName,
              document: formData.customerDocument,
              total_credit: total,
              total_paid: 0,
            }]);
        }
      }

      // Actualizar stock y registrar movimientos (SOLO si NO es factura en confirmación)
      // Las facturas en confirmación NO modifican el stock hasta que se aprueben
      if (!isPendingConfirmation) {
        for (const item of invoiceItems) {
          const product = products.find(p => p.id === item.productId);
          if (!product) continue;

          const updates: any = {
            stock: product.stock - item.quantity
          };

          // Si usa IDs, remover las IDs vendidas
          if (item.useUnitIds && item.unitIds) {
            const updatedIds = (product.registered_ids || []).filter(
              idObj => !item.unitIds!.includes(idObj.id)
            );
            updates.registered_ids = updatedIds;
          }

          await updateProduct(item.productId, updates);

          // Registrar movimiento
          await addMovement({
            type: 'exit',
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            reason: 'Venta - Factura',
            reference: nextNumber || '00001',
            user_name: user?.username || 'Usuario',
            unit_ids: item.unitIds || []
          });
        }
      }

      const successMessage = isPendingConfirmation 
        ? 'Factura creada en estado "En Confirmación"' 
        : 'Factura creada exitosamente';
      toast.success(successMessage);
      setIsCreateDialogOpen(false);
      setIsPaymentDialogOpen(false);
      setInvoiceToPrint(newInvoice as Invoice);
      setIsPrintDialogOpen(true);
      await loadData();
      
      // Resetear formulario
      setFormData({ customerName: '', customerDocument: '' });
      setInvoiceItems([]);
      setCurrentItem({ productId: '', quantity: '1', price: '' });
      setSelectedProductInfo(null);
      setIsCredit(false); // Resetear estado de crédito
      setIsPendingConfirmation(false); // NUEVO: Resetear estado de confirmación
      setInvoiceType('regular'); // Resetear tipo de factura
      setShowExistingCustomers(false); // Resetear selector de clientes
      setSelectedCustomerId(''); // Resetear cliente seleccionado
      setEditingInvoiceId(null); // Resetear factura en edición
    } catch (error) {
      console.error('Error:', error);
      toast.error(error instanceof Error ? error.message : 'Error al crear factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
    
    // Cargar los abonos de esta factura si es a crédito
    if (invoice.is_credit) {
      const payments = await getCreditPaymentsByInvoice(invoice.id);
      setCreditPayments(payments);
    } else {
      setCreditPayments([]);
    }
  };

  // Manejar confirmación de pago de factura pendiente
  const handleConfirmInvoicePayment = async () => {
    if (!invoiceToConfirm) return;
    
    // Validar que el total coincida
    const paymentTotal = paymentData.cash + paymentData.transfer + paymentData.other;
    if (Math.abs(paymentTotal - invoiceToConfirm.total) > 0.01) {
      toast.error(`El total de los pagos debe ser igual al total de la factura (${formatCOP(invoiceToConfirm.total)})`);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Formatear método de pago
      const paymentMethods = [];
      if (paymentData.cash > 0) paymentMethods.push(`Efectivo: ${formatCOP(paymentData.cash)}`);
      if (paymentData.transfer > 0) paymentMethods.push(`Transferencia: ${formatCOP(paymentData.transfer)}`);
      if (paymentData.other > 0) paymentMethods.push(`Otros: ${formatCOP(paymentData.other)}`);
      const paymentMethodStr = paymentMethods.join(', ');
      
      const result = await confirmInvoicePayment(invoiceToConfirm.id, {
        payment_method: paymentMethodStr,
        payment_cash: paymentData.cash,
        payment_transfer: paymentData.transfer,
        payment_other: paymentData.other,
        payment_note: paymentData.note || undefined,
        update_date: true // ✅ Actualizar la fecha al día actual
      });
      
      if (result) {
        // AHORA reducir stock y registrar movimientos (porque la factura se está aprobando)
        for (const item of invoiceToConfirm.items) {
          const product = products.find(p => p.id === item.productId);
          if (!product) continue;

          const updates: any = {
            stock: product.stock - item.quantity
          };

          // Si usa IDs, remover las IDs vendidas
          if (item.unitIds && item.unitIds.length > 0) {
            const updatedIds = (product.registered_ids || []).filter(
              idObj => !item.unitIds!.includes(idObj.id)
            );
            updates.registered_ids = updatedIds;
          }

          await updateProduct(item.productId, updates);

          // Registrar movimiento
          await addMovement({
            type: 'exit',
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            reason: 'Venta - Factura',
            reference: invoiceToConfirm.number,
            user_name: getCurrentUser()?.username || 'Usuario',
            unit_ids: item.unitIds || []
          });
        }

        toast.success('Pago confirmado exitosamente');
        setIsConfirmPaymentDialogOpen(false);
        setInvoiceToConfirm(null);
        await loadData();
      } else {
        toast.error('Error al confirmar el pago');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al confirmar el pago');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar eliminación de factura en confirmación
  const handleDeletePendingConfirmation = async (invoice: Invoice) => {
    const confirmed = confirm(
      `¿Estás seguro de eliminar la factura ${invoice.number}?\n\n` +
      `Total: ${formatCOP(invoice.total)}\n` +
      `Cliente: ${invoice.customer_name || 'Consumidor Final'}\n\n` +
      `Nota: Esta factura está "En Confirmación", por lo que NO afectó el stock.\n` +
      `Esta acción no se puede deshacer.`
    );

    if (!confirmed) return;

    setIsSubmitting(true);

    try {
      const company = getCurrentCompany();

      // NO devolver stock porque las facturas en confirmación NO modifican el stock
      // Solo eliminar la factura directamente

      // Eliminar la factura
      const { error: deleteError } = await supabase
        .from('invoices')
        .delete()
        .eq('id', invoice.id)
        .eq('company', company);

      if (deleteError) {
        console.error('Error deleting invoice:', deleteError);
        throw new Error('Error al eliminar factura');
      }

      toast.success('Factura eliminada exitosamente');
      await loadData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejar selección de cliente existente
  const handleSelectExistingCustomer = async (customerId: string) => {
    setSelectedCustomerId(customerId);
    const customer = customers.find(c => c.id === customerId);
    
    if (!customer) return;
    
    setFormData({
      ...formData,
      customerName: customer.name,
      customerDocument: customer.document
    });
    
    // Buscar factura pendiente del cliente (crédito)
    const pendingInvoice = invoices.find(inv => 
      inv.customer_document === customer.document &&
      inv.status === 'pending' &&
      inv.type === 'wholesale' &&
      inv.is_credit
    );
    
    if (pendingInvoice) {
      const shouldLoadInvoice = confirm(
        `Este cliente tiene una factura a crédito pendiente:\n\n` +
        `Factura: ${pendingInvoice.number}\n` +
        `Saldo: ${formatCOP(pendingInvoice.credit_balance || pendingInvoice.total)}\n\n` +
        `¿Deseas cargar esa factura para agregar o modificar productos?`
      );
      
      if (shouldLoadInvoice) {
        // Cargar items de la factura pendiente
        setInvoiceItems(pendingInvoice.items.map(item => ({
          ...item,
          availableIds: [] // Resetear IDs disponibles
        })));
        setEditingInvoiceId(pendingInvoice.id);
        setIsCredit(true); // Mantener como crédito
        
        toast.success(`Factura ${pendingInvoice.number} cargada. Puedes agregar o modificar productos.`);
      }
    }
  };

    /* CODIGO BASURA COMENTADO - ELIMINAR
    // if (!confirm(`¿Deseas devolver ${item.quantity} unidad(es) de "${item.productName}"?`)) {
      return;
    }

    try {
      const user = getCurrentUser();
      const product = products.find(p => p.id === item.productId);
      
      if (!product) {
        toast.error('Producto no encontrado');
        return;
      }

      // Actualizar stock
      const updates: any = {
        stock: product.stock + item.quantity
      };

      // Si usa IDs, reintegrar las IDs
      if (item.unitIds && item.unitIds.length > 0) {
        const newIdsWithNotes = item.unitIds.map(id => ({
          id,
          note: item.unitIdNotes?.[id] || ''
        }));
        const updatedIds = [...(product.registered_ids || []), ...newIdsWithNotes].sort((a, b) => parseInt(a.id) - parseInt(b.id));
        updates.registered_ids = updatedIds;
      }

      await updateProduct(item.productId, updates);

      // Registrar movimiento de devolución
      await addMovement({
        type: 'entry',
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        reason: 'Devolución de Factura',
        reference: selectedInvoiceForReturn.number,
        user_name: user?.username || 'Usuario',
        unit_ids: item.unitIds || []
      });

      toast.success(`Devolución de "${item.productName}" procesada exitosamente`);
      await loadData();
      setIsReturnDialogOpen(false);
      setSelectedInvoiceForReturn(null);
    } catch (error) {
      console.error('Error en devolución:', error);
      toast.error('Error al procesar la devolución');
    }
  };

  const handleCompleteReturn = async () => {
    if (!selectedInvoiceForReturn) return;

    if (!confirm(`¿Deseas devolver TODOS los productos de la factura ${selectedInvoiceForReturn.number}?`)) {
      return;
    }

    try {
      const user = getCurrentUser();

      // Procesar cada item
      for (const item of selectedInvoiceForReturn.items) {
        const product = products.find(p => p.id === item.productId);
        
        if (!product) {
          console.error(`Producto ${item.productId} no encontrado`);
          continue;
        }

        // Actualizar stock
        const updates: any = {
          stock: product.stock + item.quantity
        };

        // Si usa IDs, reintegrar las IDs
        if (item.unitIds && item.unitIds.length > 0) {
          const newIdsWithNotes = item.unitIds.map(id => ({
            id,
            note: item.unitIdNotes?.[id] || ''
          }));
          const updatedIds = [...(product.registered_ids || []), ...newIdsWithNotes].sort((a, b) => parseInt(a.id) - parseInt(b.id));
          updates.registered_ids = updatedIds;
        }

        await updateProduct(item.productId, updates);

        // Registrar movimiento de devolución
        await addMovement({
          type: 'entry',
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          reason: 'Devolución Completa - Factura',
          reference: selectedInvoiceForReturn.number,
          user_name: user?.username || 'Usuario',
          unit_ids: item.unitIds || []
        });
      }

      toast.success('Devolución completa procesada exitosamente');
      await loadData();
      setIsReturnDialogOpen(false);
      setSelectedInvoiceForReturn(null);
    } catch (error) {
      console.error('Error en devolución completa:', error);
      toast.error('Error al procesar la devolución completa');
    }
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setIsViewDialogOpen(true);
    
    // Cargar los abonos de esta factura si es a crédito
    if (invoice.is_credit) {
      const payments = await getCreditPaymentsByInvoice(invoice.id);
      setCreditPayments(payments);
    } else {
      setCreditPayments([]);
    }
  };
  */ // FIN CODIGO BASURA

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedInvoice) return;

    if (!confirm('¿Está seguro de eliminar este abono? Esta acción no se puede deshacer y el saldo pendiente se actualizará.')) {
      return;
    }

    const result = await deleteCreditPayment(paymentId);
    if (result) {
      toast.success('Abono eliminado exitosamente');
      await loadData();
      // Recargar los abonos
      if (selectedInvoice.is_credit) {
        const payments = await getCreditPaymentsByInvoice(selectedInvoice.id);
        setCreditPayments(payments);
      }
    } else {
      toast.error('Error al eliminar el abono');
    }
  };

  const handlePrint = async () => {
    if (!invoiceToPrint) return;

    // Cargar los abonos si es factura a crédito
    let payments: CreditPayment[] = [];
    if (invoiceToPrint.is_credit) {
      payments = await getCreditPaymentsByInvoice(invoiceToPrint.id);
    }

    const doc = new jsPDF();
    const company = getCurrentCompany();
    const companyName = company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

    // Encabezado
    doc.setFontSize(18);
    doc.text(companyName, 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('FACTURA DE VENTA', 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`No. ${invoiceToPrint.number}`, 105, 34, { align: 'center' });
    doc.line(10, 38, 200, 38);

    // Información del cliente
    let y = 45;
    doc.text(`Cliente: ${invoiceToPrint.customer_name || 'Consumidor Final'}`, 10, y);
    y += 6;
    if (invoiceToPrint.customer_document) {
      doc.text(`Documento: ${invoiceToPrint.customer_document}`, 10, y);
      y += 6;
    }
    doc.text(`Fecha: ${new Date(invoiceToPrint.date).toLocaleString('es-ES')}`, 10, y);
    y += 6;
    doc.text(`Tipo: ${invoiceToPrint.type === 'regular' ? 'Regular' : 'Al Mayor'}`, 10, y);
    y += 6;
    doc.text(`Atendido por: ${invoiceToPrint.attended_by || 'N/A'}`, 10, y);
    y += 8;
    doc.line(10, y, 200, y);

    // Productos
    y += 8;
    doc.setFontSize(12);
    doc.text('PRODUCTOS', 105, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9);

    invoiceToPrint.items.forEach((item: any) => {
      doc.text(`${item.productName}`, 10, y);
      y += 5;
      doc.text(`  Cantidad: ${item.quantity} x ${formatCOP(item.price)} = ${formatCOP(item.total)}`, 10, y);
      y += 5;
      
      // Mostrar IDs si existen
      if (item.unitIds && item.unitIds.length > 0) {
        doc.setFontSize(8);
        doc.text(`  IDs: ${item.unitIds.join(', ')}`, 10, y);
        y += 5;
        doc.setFontSize(9);
      }
      
      y += 3;
    });

    // Totales
    y += 5;
    doc.line(10, y, 200, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Subtotal: ${formatCOP(invoiceToPrint.subtotal)}`, 140, y);
    y += 6;
    doc.text(`IVA (19%): ${formatCOP(invoiceToPrint.tax)}`, 140, y);
    y += 6;
    doc.setFontSize(12);
    doc.text(`TOTAL: ${formatCOP(invoiceToPrint.total)}`, 140, y);
    y += 8;
    doc.setFontSize(10);
    
    // Métodos de pago desglosados
    if (invoiceToPrint.payment_cash || invoiceToPrint.payment_transfer || invoiceToPrint.payment_other) {
      doc.text('Método de Pago:', 10, y);
      y += 5;
      if (invoiceToPrint.payment_cash && invoiceToPrint.payment_cash > 0) {
        doc.text(`  Efectivo: ${formatCOP(invoiceToPrint.payment_cash)}`, 10, y);
        y += 5;
      }
      if (invoiceToPrint.payment_transfer && invoiceToPrint.payment_transfer > 0) {
        doc.text(`  Transferencia: ${formatCOP(invoiceToPrint.payment_transfer)}`, 10, y);
        y += 5;
      }
      if (invoiceToPrint.payment_other && invoiceToPrint.payment_other > 0) {
        doc.text(`  Otros: ${formatCOP(invoiceToPrint.payment_other)}`, 10, y);
        y += 5;
      }
    } else if (invoiceToPrint.payment_method) {
      doc.text(`Método de Pago: ${invoiceToPrint.payment_method}`, 10, y);
      y += 5;
    }

    // NUEVO: Sección de abonos para facturas a crédito
    if (invoiceToPrint.is_credit && payments.length > 0) {
      y += 8;
      doc.line(10, y, 200, y);
      y += 8;
      doc.setFontSize(12);
      doc.text('HISTORIAL DE ABONOS', 105, y, { align: 'center' });
      y += 8;
      doc.setFontSize(9);
      
      payments.forEach((payment) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        const paymentDate = new Date(payment.date).toLocaleString('es-ES');
        doc.text(`Fecha: ${paymentDate}`, 10, y);
        y += 5;
        doc.text(`Monto: ${formatCOP(payment.amount)}`, 10, y);
        y += 5;
        doc.text(`Método: ${payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}`, 10, y);
        y += 5;
        if (payment.notes) {
          doc.text(`Nota: ${payment.notes}`, 10, y);
          y += 5;
        }
        doc.text(`Registrado por: ${payment.registered_by}`, 10, y);
        y += 8;
      });
      
      // Mostrar saldo pendiente
      const totalAbonos = payments.reduce((sum, p) => sum + p.amount, 0);
      const saldoPendiente = invoiceToPrint.total - totalAbonos;
      
      doc.setFontSize(10);
      doc.text(`Total Abonado: ${formatCOP(totalAbonos)}`, 140, y);
      y += 6;
      doc.setFontSize(12);
      doc.setTextColor(saldoPendiente > 0 ? 255 : 0, saldoPendiente > 0 ? 150 : 0, 0);
      doc.text(`Saldo Pendiente: ${formatCOP(saldoPendiente)}`, 140, y);
      doc.setTextColor(0, 0, 0);
    }

    // Abrir vista de impresión en lugar de descargar
    doc.autoPrint();
    window.open(doc.output('bloburl'), '_blank');
    toast.success('Abriendo vista de impresión');
  };

  const handleThermalPrint = () => {
    if (!thermalPrintRef.current) return;
    
    // Crear un iframe temporal para la impresión
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'absolute';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    
    document.body.appendChild(printFrame);
    
    const printDocument = printFrame.contentDocument || printFrame.contentWindow?.document;
    if (!printDocument) return;
    
    // Copiar TODO el contenido del ref (incluye el <style> del componente)
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
    
    // Esperar a que se cargue el contenido
    setTimeout(() => {
      printFrame.contentWindow?.print();
      
      // Limpiar el iframe después de imprimir
      setTimeout(() => {
        document.body.removeChild(printFrame);
      }, 100);
    }, 250);
  };

  const handleDownloadPDF = async () => {
    if (!invoiceToPrint) return;

    // Cargar los abonos si es factura a crédito
    let payments: CreditPayment[] = [];
    if (invoiceToPrint.is_credit) {
      payments = await getCreditPaymentsByInvoice(invoiceToPrint.id);
    }

    const doc = new jsPDF();
    const company = getCurrentCompany();
    const companyName = company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

    // Encabezado
    doc.setFontSize(18);
    doc.text(companyName, 105, 20, { align: 'center' });
    doc.setFontSize(14);
    doc.text('FACTURA DE VENTA', 105, 28, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`No. ${invoiceToPrint.number}`, 105, 34, { align: 'center' });
    doc.line(10, 38, 200, 38);

    // Información del cliente
    let y = 45;
    doc.text(`Cliente: ${invoiceToPrint.customer_name || 'Consumidor Final'}`, 10, y);
    y += 6;
    if (invoiceToPrint.customer_document) {
      doc.text(`Documento: ${invoiceToPrint.customer_document}`, 10, y);
      y += 6;
    }
    doc.text(`Fecha: ${new Date(invoiceToPrint.date).toLocaleString('es-ES')}`, 10, y);
    y += 6;
    doc.text(`Tipo: ${invoiceToPrint.type === 'regular' ? 'Regular' : 'Al Mayor'}`, 10, y);
    y += 6;
    doc.text(`Atendido por: ${invoiceToPrint.attended_by || 'N/A'}`, 10, y);
    y += 8;
    doc.line(10, y, 200, y);

    // Productos
    y += 8;
    doc.setFontSize(12);
    doc.text('PRODUCTOS', 105, y, { align: 'center' });
    y += 8;
    doc.setFontSize(9);

    invoiceToPrint.items.forEach((item: any) => {
      doc.text(`${item.productName}`, 10, y);
      y += 5;
      doc.text(`  Cantidad: ${item.quantity} x ${formatCOP(item.price)} = ${formatCOP(item.total)}`, 10, y);
      y += 5;
      
      // Mostrar IDs si existen
      if (item.unitIds && item.unitIds.length > 0) {
        doc.setFontSize(8);
        doc.text(`  IDs: ${item.unitIds.join(', ')}`, 10, y);
        y += 5;
        doc.setFontSize(9);
      }
      
      y += 3;
    });

    // Totales
    y += 5;
    doc.line(10, y, 200, y);
    y += 8;
    doc.setFontSize(10);
    doc.text(`Subtotal: ${formatCOP(invoiceToPrint.subtotal)}`, 140, y);
    y += 6;
    doc.text(`IVA (19%): ${formatCOP(invoiceToPrint.tax)}`, 140, y);
    y += 6;
    doc.setFontSize(12);
    doc.text(`TOTAL: ${formatCOP(invoiceToPrint.total)}`, 140, y);
    y += 8;
    doc.setFontSize(10);
    
    // Métodos de pago desglosados
    if (invoiceToPrint.payment_cash || invoiceToPrint.payment_transfer || invoiceToPrint.payment_other) {
      doc.text('Método de Pago:', 10, y);
      y += 5;
      if (invoiceToPrint.payment_cash && invoiceToPrint.payment_cash > 0) {
        doc.text(`  Efectivo: ${formatCOP(invoiceToPrint.payment_cash)}`, 10, y);
        y += 5;
      }
      if (invoiceToPrint.payment_transfer && invoiceToPrint.payment_transfer > 0) {
        doc.text(`  Transferencia: ${formatCOP(invoiceToPrint.payment_transfer)}`, 10, y);
        y += 5;
      }
      if (invoiceToPrint.payment_other && invoiceToPrint.payment_other > 0) {
        doc.text(`  Otros: ${formatCOP(invoiceToPrint.payment_other)}`, 10, y);
        y += 5;
      }
    } else if (invoiceToPrint.payment_method) {
      doc.text(`Método de Pago: ${invoiceToPrint.payment_method}`, 10, y);
      y += 5;
    }

    // NUEVO: Sección de abonos para facturas a crédito
    if (invoiceToPrint.is_credit && payments.length > 0) {
      y += 8;
      doc.line(10, y, 200, y);
      y += 8;
      doc.setFontSize(12);
      doc.text('HISTORIAL DE ABONOS', 105, y, { align: 'center' });
      y += 8;
      doc.setFontSize(9);
      
      payments.forEach((payment) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        const paymentDate = new Date(payment.date).toLocaleString('es-ES');
        doc.text(`Fecha: ${paymentDate}`, 10, y);
        y += 5;
        doc.text(`Monto: ${formatCOP(payment.amount)}`, 10, y);
        y += 5;
        doc.text(`Método: ${payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}`, 10, y);
        y += 5;
        if (payment.notes) {
          doc.text(`Nota: ${payment.notes}`, 10, y);
          y += 5;
        }
        doc.text(`Registrado por: ${payment.registered_by}`, 10, y);
        y += 8;
      });
      
      // Mostrar saldo pendiente
      const totalAbonos = payments.reduce((sum, p) => sum + p.amount, 0);
      const saldoPendiente = invoiceToPrint.total - totalAbonos;
      
      doc.setFontSize(10);
      doc.text(`Total Abonado: ${formatCOP(totalAbonos)}`, 140, y);
      y += 6;
      doc.setFontSize(12);
      doc.setTextColor(saldoPendiente > 0 ? 255 : 0, saldoPendiente > 0 ? 150 : 128, 0);
      doc.text(`Saldo Pendiente: ${formatCOP(saldoPendiente)}`, 140, y);
      doc.setTextColor(0, 0, 0);
    }

    // Descargar
    doc.save(`Factura-${invoiceToPrint.number}.pdf`);
    toast.success('PDF descargado');
  };

  const stats = {
    total: invoices.length,
    pending: invoices.filter(i => i.status === 'pending').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    revenue: invoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0),
  };

  // Estadísticas del período filtrado
  const filteredInvoices = getSortedInvoices();
  const periodStats = {
    total: filteredInvoices.length,
    paid: filteredInvoices.filter(i => i.status === 'paid').length,
    pending: filteredInvoices.filter(i => i.status === 'pending').length,
    revenue: filteredInvoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + i.total, 0),
  };

  // Función para obtener el nombre del período
  const getPeriodName = () => {
    switch (periodFilter) {
      case 'today':
        return 'Hoy';
      case 'yesterday':
        return 'Ayer';
      case 'current_month':
        return 'Mes Actual';
      case 'last_month':
        return 'Mes Anterior';
      case 'last_3_months':
        return 'Últimos 3 Meses';
      case 'last_6_months':
        return 'Últimos 6 Meses';
      case 'last_year':
        return 'Último Año';
      case 'all':
        return 'Todo el Historial';
      default:
        return '';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Cargando facturas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Facturación</h2>
          <p className="text-muted-foreground mt-1">
            Sistema de facturación con gestión de IDs únicas
          </p>
        </div>
        <Button onClick={handleOpenCreateDialog} size="lg" disabled={isValidating}>
          {isValidating ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Validando...
            </>
          ) : (
            <>
              <Plus className="h-5 w-5 mr-2" />
              Nueva Factura
            </>
          )}
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={periodFilter === 'today' ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {getPeriodName()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{periodStats.total}</div>
            {periodFilter !== 'all' && (
              <p className="text-xs text-muted-foreground mt-1">
                de {stats.total} total
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {periodStats.pending}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Pagadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {periodStats.paid}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Ingresos {periodFilter !== 'all' ? getPeriodName() : 'Totales'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCOP(periodStats.revenue)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por número o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none z-10" />
              <Select value={periodFilter} onValueChange={(value: any) => setPeriodFilter(value)}>
                <SelectTrigger className="pl-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">
                    <span className="font-medium text-green-600 dark:text-green-400">📅 Hoy</span>
                  </SelectItem>
                  <SelectItem value="yesterday">Ayer</SelectItem>
                  <SelectItem value="current_month">Mes Actual</SelectItem>
                  <SelectItem value="last_month">Mes Anterior</SelectItem>
                  <SelectItem value="last_3_months">Últimos 3 Meses</SelectItem>
                  <SelectItem value="last_6_months">Últimos 6 Meses</SelectItem>
                  <SelectItem value="last_year">Último Año</SelectItem>
                  <SelectItem value="all">Todo el Historial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Más recientes</SelectItem>
                <SelectItem value="oldest">Más antiguas</SelectItem>
                <SelectItem value="highest">Mayor valor</SelectItem>
                <SelectItem value="lowest">Menor valor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Lista de facturas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Facturas ({getSortedInvoices().length})</CardTitle>
            {periodFilter !== 'all' && getSortedInvoices().length > 0 && (
              <span className="text-sm text-muted-foreground">
                Mostrando: <span className="font-medium text-green-600 dark:text-green-400">{getPeriodName()}</span>
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Número
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Cliente
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Tipo
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Total
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Estado
                  </th>
                  <th className="text-center py-3 px-4 font-medium text-gray-700 dark:text-gray-300">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {getSortedInvoices().map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {invoice.number}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                      {new Date(invoice.date).toLocaleString('es-ES', { timeZone: 'America/Bogota' })}
                    </td>
                    <td className="py-3 px-4 text-gray-900 dark:text-gray-100">
                      {invoice.customer_name || 'Consumidor Final'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          invoice.type === 'regular'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                            : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
                        }`}
                      >
                        {invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-gray-900 dark:text-gray-100">
                      {formatCOP(invoice.total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          invoice.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : invoice.status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : invoice.status === 'pending_confirmation'
                            ? 'bg-orange-100 text-orange-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {invoice.status === 'paid'
                          ? '✅ Pagada'
                          : invoice.status === 'pending'
                          ? '⏳ Pendiente'
                          : invoice.status === 'pending_confirmation'
                          ? '⚠️ En Confirmación'
                          : '❌ Cancelada'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-2">
                        {/* Botón Aprobar (solo para facturas en confirmación) */}
                        {invoice.status === 'pending_confirmation' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setInvoiceToConfirm(invoice);
                                setPaymentData({
                                  cash: invoice.total,
                                  transfer: 0,
                                  other: 0,
                                  note: ''
                                });
                                setIsConfirmPaymentDialogOpen(true);
                              }}
                              className="border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                              title="Aprobar Factura"
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeletePendingConfirmation(invoice)}
                              className="border-red-600 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                              title="Eliminar Factura"
                              disabled={isSubmitting}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewInvoice(invoice)}
                          title="Ver Factura"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setInvoiceToPrint(invoice);
                            setIsPrintDialogOpen(true);
                          }}
                          title="Imprimir Factura"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {getSortedInvoices().length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-2" />
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                          No hay facturas en {getPeriodName().toLowerCase()}
                        </p>
                        {periodFilter !== 'all' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setPeriodFilter('all')}
                            className="mt-2"
                          >
                            Ver todo el historial
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog crear factura */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Nueva Factura
              <span className="ml-4 text-sm text-blue-600 flex items-center gap-1">
                <Scan className="h-4 w-4" />
                Lector de código activo
              </span>
            </DialogTitle>
            <DialogDescription>
              Complete la información y agregue productos. Use el lector de código de barras o seleccione manualmente.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
              {/* Columna izquierda */}
              <div className="space-y-4">
                {/* Tipo de factura */}
                <div className="space-y-2">
                  <Label>Tipo de Factura</Label>
                  <Select
                    value={invoiceType}
                    onValueChange={(value: 'regular' | 'wholesale') =>
                      setInvoiceType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="regular">
                        Regular (Precio Final)
                      </SelectItem>
                      <SelectItem value="wholesale">
                        Al Mayor (Precio 2)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Checkbox de Crédito - Solo para Al Mayor */}
                {invoiceType === 'wholesale' && (
                  <div className="flex items-center space-x-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <input
                      type="checkbox"
                      id="isCredit"
                      checked={isCredit}
                      onChange={(e) => {
                        setIsCredit(e.target.checked);
                        if (e.target.checked) setIsPendingConfirmation(false); // Deshabilitar confirmación si se activa crédito
                      }}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <Label htmlFor="isCredit" className="text-sm font-semibold text-blue-900 dark:text-blue-100 cursor-pointer">
                      Venta a Crédito
                    </Label>
                    {isCredit && (
                      <span className="ml-2 px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 text-xs font-medium rounded-full">
                        Pendiente de Pago
                      </span>
                    )}
                  </div>
                )}

                {/* Checkbox de Factura en Confirmación (solo para facturas regulares) */}
                {!isCredit && invoiceType === 'regular' && (
                  <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    <input
                      type="checkbox"
                      id="isPendingConfirmation"
                      checked={isPendingConfirmation}
                      onChange={(e) => setIsPendingConfirmation(e.target.checked)}
                      className="w-4 h-4 text-yellow-600 bg-gray-100 border-gray-300 rounded focus:ring-yellow-500"
                    />
                    <Label htmlFor="isPendingConfirmation" className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 cursor-pointer">
                      Factura en Confirmación
                    </Label>
                    {isPendingConfirmation && (
                      <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 text-xs font-medium rounded-full">
                        Requiere Confirmación de Pago
                      </span>
                    )}
                  </div>
                )}

                {/* Información del cliente */}
                {/* Selector de cliente existente (solo para facturas al mayor) */}
                {invoiceType === 'wholesale' && (
                  <div className="space-y-3 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-center justify-between">
                      <Label className="text-blue-900 dark:text-blue-100 font-semibold">
                        {showExistingCustomers ? '👤 Cliente Existente' : '➕ Nuevo Cliente'}
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowExistingCustomers(!showExistingCustomers);
                          if (showExistingCustomers) {
                            // Limpiar al volver a nuevo cliente
                            setFormData({ ...formData, customerName: '', customerDocument: '' });
                            setInvoiceItems([]);
                            setEditingInvoiceId(null);
                            setSelectedCustomerId('');
                          }
                        }}
                        className="border-blue-600 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900"
                      >
                        {showExistingCustomers ? '➕ Nuevo Cliente' : '👤 Cliente Existente'}
                      </Button>
                    </div>
                    
                    {showExistingCustomers && (
                      <div className="space-y-2">
                        <Label htmlFor="existingCustomer">Seleccionar Cliente</Label>
                        <Select
                          value={selectedCustomerId}
                          onValueChange={handleSelectExistingCustomer}
                        >
                          <SelectTrigger className="bg-white dark:bg-gray-800">
                            <SelectValue placeholder="Selecciona un cliente..." />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.length === 0 && (
                              <div className="p-4 text-center text-gray-500">
                                No hay clientes registrados
                              </div>
                            )}
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} - {customer.document}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {editingInvoiceId && (
                          <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-800">
                            <Info className="h-4 w-4 text-green-600" />
                            <span className="text-xs text-green-700 dark:text-green-300">
                              Factura cargada. Puedes agregar/eliminar productos.
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="customerName">
                    Nombre del Cliente {isCredit && invoiceType === 'wholesale' && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value })
                    }
                    placeholder="Consumidor Final"
                    disabled={showExistingCustomers && invoiceType === 'wholesale'}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerDocument">
                    Documento {isCredit && invoiceType === 'wholesale' && <span className="text-red-500">*</span>}
                  </Label>
                  <Input
                    id="customerDocument"
                    value={formData.customerDocument}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        customerDocument: e.target.value,
                      })
                    }
                    placeholder="CC, NIT, etc."
                    disabled={showExistingCustomers && invoiceType === 'wholesale'}
                  />
                </div>

                {/* Agregar producto */}
                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-3">Agregar Producto</h4>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mb-3"
                    onClick={handleOpenProductSelectDialog}
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Buscar Producto
                  </Button>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="product">O Seleccionar Producto</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={async () => {
                            const productsData = await getAllProducts();
                            setProducts(productsData);
                            toast.success('Productos actualizados');
                          }}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Actualizar
                        </Button>
                      </div>
                      <Select
                        value={currentItem.productId}
                        onValueChange={handleProductChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar producto" />
                        </SelectTrigger>
                        <SelectContent>
                          {products
                            .map((product) => {
                              const cannotSelect = product.use_unit_ids && product.stock <= 0;
                              return (
                              <SelectItem 
                                key={product.id} 
                                value={product.id}
                                disabled={cannotSelect}
                              >
                                {product.code} - {product.name} (Stock: {product.stock}
                                {product.stock < 0 ? ' ⚠️ Negativo' : product.stock === 0 ? ' ⚠️ Sin stock' : ''})
                                {product.use_unit_ids && ' 🔢'}
                                {cannotSelect && ' 🔒'}
                              </SelectItem>
                            );
                            })}
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedProductInfo && (
                      <div className="space-y-3">
                        {/* Información resumida con botón para ver más */}
                        <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-semibold text-green-900 flex items-center gap-2">
                              <Info className="h-4 w-4" />
                              Información del Producto
                            </h5>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setIsProductInfoDialogOpen(true)}
                              className="h-7 px-2 text-xs hover:bg-green-100"
                            >
                              <Eye className="h-3 w-3 mr-1" />
                              Ver Detalles
                            </Button>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-white/60 p-2 rounded">
                              <p className="text-xs text-gray-600">Stock Disponible</p>
                              <p className="text-sm font-bold text-gray-900">
                                {selectedProductInfo.stock} unidades
                              </p>
                            </div>
                            <div className="bg-white/60 p-2 rounded">
                              <p className="text-xs text-gray-600">Costo Actual</p>
                              <p className="text-sm font-bold text-gray-900">
                                {formatCOP(selectedProductInfo.current_cost)}
                              </p>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-green-200">
                            <p className="text-xs text-gray-600 mb-2">Precios de Venta:</p>
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-blue-50 p-2 rounded text-center">
                                <p className="text-xs text-blue-600 font-medium">Precio 1</p>
                                <p className="text-sm font-bold text-blue-900">
                                  {formatCOP(selectedProductInfo.price1)}
                                </p>
                              </div>
                              <div className="bg-purple-50 p-2 rounded text-center">
                                <p className="text-xs text-purple-600 font-medium">Precio 2</p>
                                <p className="text-sm font-bold text-purple-900">
                                  {formatCOP(selectedProductInfo.price2)}
                                </p>
                              </div>
                              <div className="bg-green-100 p-2 rounded text-center">
                                <p className="text-xs text-green-700 font-medium">P. Final</p>
                                <p className="text-sm font-bold text-green-900">
                                  {formatCOP(selectedProductInfo.final_price)}
                                </p>
                              </div>
                            </div>
                          </div>

                          {selectedProductInfo.use_unit_ids && (
                            <div className="mt-2 pt-2 border-t border-green-200">
                              <p className="text-xs text-blue-600 font-medium flex items-center gap-1">
                                <Hash className="h-3 w-3" />
                                Este producto usa IDs únicas ({selectedProductInfo.registered_ids?.length || 0} disponibles)
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Cantidad</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={currentItem.quantity}
                          onChange={(e) =>
                            setCurrentItem({
                              ...currentItem,
                              quantity: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="price">Precio Unitario</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          value={currentItem.price}
                          onChange={(e) =>
                            setCurrentItem({
                              ...currentItem,
                              price: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleAddItem}
                      className="w-full"
                      disabled={!currentItem.productId}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Agregar Producto
                    </Button>
                  </div>
                </div>
              </div>

              {/* Columna derecha - Productos agregados */}
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-semibold mb-3">
                    Productos ({invoiceItems.length})
                  </h4>

                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {invoiceItems.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 bg-background rounded border border-border"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {item.productName}
                              {item.useUnitIds && (
                                <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                  IDs Únicas
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.productCode}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveItem(index)}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <Label className="text-xs">Cantidad</Label>
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateItemQuantity(
                                  index,
                                  parseInt(e.target.value) || 1
                                )
                              }
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Precio</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.price}
                              onChange={(e) =>
                                handleUpdateItemPrice(
                                  index,
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="h-8"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Total</Label>
                            <Input
                              value={formatCOP(item.total)}
                              disabled
                              className="h-8"
                            />
                          </div>
                        </div>

                        {/* Mostrar/Seleccionar IDs */}
                        {item.useUnitIds && (
                          <div className="mt-2">
                            {item.unitIds && item.unitIds.length > 0 ? (
                              <>
                                <p className="text-xs font-medium text-blue-600 mb-1">
                                  IDs seleccionadas:
                                </p>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {item.unitIds.map((id) => (
                                    <span
                                      key={id}
                                      className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded"
                                    >
                                      {id}
                                    </span>
                                  ))}
                                </div>
                              </>
                            ) : (
                              <p className="text-xs text-red-600 font-medium mb-2">
                                ⚠️ Debes seleccionar las IDs
                              </p>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenUnitIdSelector(index)}
                              className="w-full"
                            >
                              <Hash className="h-3 w-3 mr-1" />
                              Seleccionar IDs
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}

                    {invoiceItems.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No hay productos agregados
                      </p>
                    )}
                  </div>

                  {/* Totales */}
                  {invoiceItems.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      <div className="flex justify-between text-lg font-bold text-green-600">
                        <span>TOTAL:</span>
                        <span>{formatCOP(calculateTotals().total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="border-t border-border pt-4 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  // Resetear estados al cancelar
                  setShowExistingCustomers(false);
                  setSelectedCustomerId('');
                  setEditingInvoiceId(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting || invoiceItems.length === 0}>
                <FileText className="h-4 w-4 mr-2" />
                {isSubmitting ? 'Procesando...' : (isCredit ? 'Crear Factura a Crédito' : 'Crear Factura')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de método de pago */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-700">
              💰 Método de Pago
            </DialogTitle>
            <DialogDescription>
              Ingrese los montos de pago. La suma debe ser igual al total de la factura.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-4 rounded-lg">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total a Pagar:</p>
              <p className="text-2xl font-bold text-green-600">{formatCOP(calculateTotals().total)}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="paymentCash">
                  Efectivo
                </Label>
                <Input
                  id="paymentCash"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.cash}
                  onChange={(e) => setPaymentData({ ...paymentData, cash: parseFloat(e.target.value) || 0 })}
                  className="text-lg font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentTransfer">
                  Transferencia
                </Label>
                <Input
                  id="paymentTransfer"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.transfer}
                  onChange={(e) => setPaymentData({ ...paymentData, transfer: parseFloat(e.target.value) || 0 })}
                  className="text-lg font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentOther">
                  Otros
                </Label>
                <Input
                  id="paymentOther"
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentData.other}
                  onChange={(e) => setPaymentData({ ...paymentData, other: parseFloat(e.target.value) || 0 })}
                  className="text-lg font-semibold"
                />
              </div>
            </div>

            <div className={`p-3 rounded-lg border-2 ${
              Math.abs((paymentData.cash + paymentData.transfer + paymentData.other) - calculateTotals().total) < 0.01
                ? 'bg-green-50 dark:bg-green-950 border-green-500'
                : 'bg-red-50 dark:bg-red-950 border-red-500'
            }`}>
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Total Ingresado:</p>
              <p className={`text-xl font-bold ${
                Math.abs((paymentData.cash + paymentData.transfer + paymentData.other) - calculateTotals().total) < 0.01
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {formatCOP(paymentData.cash + paymentData.transfer + paymentData.other)}
              </p>
              {Math.abs((paymentData.cash + paymentData.transfer + paymentData.other) - calculateTotals().total) >= 0.01 && (
                <p className="text-xs text-red-600 mt-1">
                  Diferencia: {formatCOP(Math.abs((paymentData.cash + paymentData.transfer + paymentData.other) - calculateTotals().total))}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleConfirmPayment}
              disabled={isSubmitting || Math.abs((paymentData.cash + paymentData.transfer + paymentData.other) - calculateTotals().total) >= 0.01}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? 'Procesando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog buscar productos */}
      <Dialog
        open={isProductSelectDialogOpen}
        onOpenChange={setIsProductSelectDialogOpen}
      >
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Buscar Producto</DialogTitle>
            <DialogDescription>
              Haz clic en un producto para seleccionarlo en el formulario de factura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre, código o categoría..."
                    value={productSearchInput}
                    onChange={(e) => setProductSearchInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleProductSearch()}
                    className="pl-10"
                  />
                </div>
                <Button onClick={handleProductSearch} className="w-full">
                  <Search className="h-4 w-4 mr-2" />
                  Buscar
                </Button>
              </div>
              <Select
                value={productSortOrder}
                onValueChange={(value: any) => setProductSortOrder(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="az">Alfabético (A-Z)</SelectItem>
                  <SelectItem value="highest">Mayor precio</SelectItem>
                  <SelectItem value="lowest">Menor precio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto">
              {getSortedProducts()
                .map((product) => {
                  const cannotAdd = product.use_unit_ids && product.stock <= 0;
                  return (
                  <div
                    key={product.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      cannotAdd 
                        ? 'border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/20 cursor-not-allowed opacity-60' 
                        : 'border-border cursor-pointer hover:bg-muted'
                    }`}
                    onClick={() => !cannotAdd && handleAddProductDirect(product)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm">{product.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground font-mono">
                            {product.code}
                          </p>
                          <span className="text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded">
                            {product.category}
                          </span>
                        </div>
                      </div>
                      {product.use_unit_ids && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          🔢 IDs
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="text-muted-foreground">Stock:</span>{' '}
                        <span className={`font-medium ${
                          product.stock < 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : product.stock === 0 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : 'text-gray-900 dark:text-gray-100'
                        }`}>
                          {product.stock}
                          {product.stock <= 0 && (
                            <span className="ml-1 text-xs">
                              {product.stock < 0 ? '⚠️ Negativo' : '⚠️ Sin stock'}
                            </span>
                          )}
                        </span>
                      </p>
                      <p>
                        <span className="text-muted-foreground">Precio:</span>{' '}
                        <span className="font-bold text-green-600">
                          {formatCOP(
                            invoiceType === 'regular'
                              ? product.final_price
                              : product.price2
                          )}
                        </span>
                      </p>
                      {product.use_unit_ids && (
                        <p className="text-xs text-blue-600">
                          {product.registered_ids?.length || 0} IDs disponibles
                        </p>
                      )}
                      {cannotAdd && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-2">
                          🔒 Requiere IDs - No disponible
                        </p>
                      )}
                    </div>
                  </div>
                );
                })}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog selector de IDs únicas */}
      <Dialog open={unitIdDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Si se cierra el modal y el producto no tiene IDs, eliminarlo
          if (currentItemIndex !== null && invoiceItems[currentItemIndex]) {
            const item = invoiceItems[currentItemIndex];
            if (!item.unitIds || item.unitIds.length === 0) {
              const updated = invoiceItems.filter((_, idx) => idx !== currentItemIndex);
              setInvoiceItems(updated);
              toast.info('Producto eliminado (sin IDs seleccionadas)');
            }
          }
          setCurrentItemIndex(null);
          setSelectedUnitIds([]);
        }
        setUnitIdDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Seleccionar IDs de Unidades</DialogTitle>
            <DialogDescription>
              Selecciona exactamente{' '}
              {currentItemIndex !== null && invoiceItems[currentItemIndex]?.quantity}{' '}
              IDs para esta venta.
            </DialogDescription>
          </DialogHeader>

          {currentItemIndex !== null && invoiceItems[currentItemIndex] && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-muted p-3 rounded">
                <p className="font-medium">
                  {invoiceItems[currentItemIndex].productName}
                </p>
                <p className="text-sm text-muted-foreground">
                  Seleccionadas: {selectedUnitIds.length} /{' '}
                  {invoiceItems[currentItemIndex].quantity}
                </p>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {invoiceItems[currentItemIndex].availableIds && invoiceItems[currentItemIndex].availableIds!.length > 0 ? (
                  invoiceItems[currentItemIndex].availableIds!.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleUnitId(id)}
                      className={`p-3 rounded border-2 font-mono text-sm transition-all ${
                        selectedUnitIds.includes(id)
                          ? 'border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-950 dark:text-green-400'
                          : 'border-gray-200 bg-white hover:border-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500'
                      }`}
                    >
                      {id}
                    </button>
                  ))
                ) : (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <p className="text-sm">No hay IDs disponibles para este producto.</p>
                    <p className="text-xs mt-1">Debes registrar IDs en el módulo de Movimientos antes de vender este producto.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                // Si el producto no tiene IDs seleccionadas, eliminarlo de la lista
                if (currentItemIndex !== null && invoiceItems[currentItemIndex]) {
                  const item = invoiceItems[currentItemIndex];
                  if (!item.unitIds || item.unitIds.length === 0) {
                    const updated = invoiceItems.filter((_, idx) => idx !== currentItemIndex);
                    setInvoiceItems(updated);
                    toast.info('Producto eliminado (sin IDs seleccionadas)');
                  }
                }
                setUnitIdDialogOpen(false);
                setCurrentItemIndex(null);
                setSelectedUnitIds([]);
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveUnitIds}>
              Confirmar Selección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ver factura */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalles de Factura</DialogTitle>
            <DialogDescription>
              Información completa de la factura incluyendo productos y abonos registrados
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Número</p>
                  <p className="font-mono font-bold">{selectedInvoice.number}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Fecha</p>
                  <p>{new Date(selectedInvoice.date).toLocaleString('es-ES')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p>{selectedInvoice.customer_name || 'Consumidor Final'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p>
                    {selectedInvoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
                  </p>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-3">Productos</h4>
                <div className="space-y-3">
                  {selectedInvoice.items.map((item: any, index: number) => (
                    <div key={index} className="p-3 bg-muted rounded">
                      <p className="font-medium">{item.productName}</p>
                      <p className="text-sm text-muted-foreground">
                        {item.quantity} x {formatCOP(item.price)} ={' '}
                        {formatCOP(item.total)}
                      </p>
                      {item.unitIds && item.unitIds.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            IDs de las Unidades:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.unitIds.map((id: string) => (
                              <span
                                key={id}
                                className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-mono rounded"
                              >
                                {id}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Desglose de métodos de pago */}
              <div className="border-t border-border pt-4">
                <h4 className="font-semibold mb-3 text-sm">Métodos de Pago</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Efectivo:</span>
                    <span className="font-medium">{formatCOP(selectedInvoice.payment_cash || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Transferencias:</span>
                    <span className="font-medium">{formatCOP(selectedInvoice.payment_transfer || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Otros:</span>
                    <span className="font-medium">{formatCOP(selectedInvoice.payment_other || 0)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-lg font-bold text-green-600">
                  <span>TOTAL:</span>
                  <span>{formatCOP(selectedInvoice.total)}</span>
                </div>
              </div>

              {/* NUEVO: Mostrar abonos si es factura a crédito */}
              {selectedInvoice.is_credit && creditPayments.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    Historial de Abonos
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {creditPayments.map((payment) => (
                      <div key={payment.id} className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                            {new Date(payment.date).toLocaleString('es-ES')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-green-600">
                              {formatCOP(payment.amount)}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeletePayment(payment.id)}
                              className="h-6 w-6 p-0 hover:bg-red-100 hover:text-red-600"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                          <p>
                            <span className="font-medium">Método:</span>{' '}
                            {payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                          </p>
                          {payment.notes && (
                            <p>
                              <span className="font-medium">Nota:</span> {payment.notes}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Registrado por:</span> {payment.registered_by}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Resumen de abonos */}
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-950 dark:to-green-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">Total Abonado:</span>
                      <span className="font-bold text-green-600">
                        {formatCOP(creditPayments.reduce((sum, p) => sum + p.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Saldo Pendiente:</span>
                      <span className="font-bold text-orange-600">
                        {formatCOP(selectedInvoice.credit_balance || selectedInvoice.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
            >
              Cerrar
            </Button>
            {selectedInvoice && (
              <Button
                onClick={() => {
                  setInvoiceToPrint(selectedInvoice);
                  setIsViewDialogOpen(false);
                  setIsPrintDialogOpen(true);
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Imprimir
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog imprimir factura */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imprimir Factura</DialogTitle>
            <DialogDescription>
              Vista previa de la factura antes de imprimir
            </DialogDescription>
          </DialogHeader>

          {invoiceToPrint && (
            <div ref={invoiceRef} className="p-8 bg-white text-black">
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold">
                  {getCurrentCompany() === 'celumundo'
                    ? 'CELUMUNDO VIP'
                    : 'REPUESTOS VIP'}
                </h2>
                <p className="text-xl font-semibold mt-2">FACTURA DE VENTA</p>
                <p className="text-lg font-mono">No. {invoiceToPrint.number}</p>
              </div>

              <div className="mb-6 space-y-1">
                <p>
                  <span className="font-semibold">Cliente:</span>{' '}
                  {invoiceToPrint.customer_name || 'Consumidor Final'}
                </p>
                {invoiceToPrint.customer_document && (
                  <p>
                    <span className="font-semibold">Documento:</span>{' '}
                    {invoiceToPrint.customer_document}
                  </p>
                )}
                <p>
                  <span className="font-semibold">Fecha:</span>{' '}
                  {new Date(invoiceToPrint.date).toLocaleString('es-ES')}
                </p>
                <p>
                  <span className="font-semibold">Tipo:</span>{' '}
                  {invoiceToPrint.type === 'regular' ? 'Regular' : 'Al Mayor'}
                </p>
                <p>
                  <span className="font-semibold">Atendido por:</span>{' '}
                  {invoiceToPrint.attended_by || 'N/A'}
                </p>
              </div>

              <div className="mb-6">
                <h3 className="font-bold text-lg mb-3 border-b pb-2">
                  PRODUCTOS
                </h3>
                <div className="space-y-3">
                  {invoiceToPrint.items.map((item: any, index: number) => (
                    <div key={index} className="pb-3 border-b">
                      <p className="font-semibold">{item.productName}</p>
                      <p className="text-sm">
                        {item.quantity} x {formatCOP(item.price)} ={' '}
                        {formatCOP(item.total)}
                      </p>
                      {item.unitIds && item.unitIds.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-semibold text-blue-700">
                            IDs de las Unidades:
                          </p>
                          <p className="text-sm font-mono text-blue-600">
                            {item.unitIds.join(', ')}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2 text-right">
                <p className="text-2xl font-bold border-t-2 pt-2 mt-2">
                  <span>TOTAL:</span> {formatCOP(invoiceToPrint.total)}
                </p>
              </div>

              <div className="mt-6 text-sm">
                <p className="font-semibold mb-2">Método de Pago:</p>
                {(invoiceToPrint.payment_cash || invoiceToPrint.payment_transfer || invoiceToPrint.payment_other) ? (
                  <div className="space-y-1 ml-4">
                    {invoiceToPrint.payment_cash && invoiceToPrint.payment_cash > 0 && (
                      <p>Efectivo: {formatCOP(invoiceToPrint.payment_cash)}</p>
                    )}
                    {invoiceToPrint.payment_transfer && invoiceToPrint.payment_transfer > 0 && (
                      <p>Transferencia: {formatCOP(invoiceToPrint.payment_transfer)}</p>
                    )}
                    {invoiceToPrint.payment_other && invoiceToPrint.payment_other > 0 && (
                      <p>Otros: {formatCOP(invoiceToPrint.payment_other)}</p>
                    )}
                  </div>
                ) : (
                  <p className="ml-4">{invoiceToPrint.payment_method || 'N/A'}</p>
                )}
              </div>

              {/* NUEVO: Sección de abonos para facturas a crédito */}
              {invoiceToPrint.is_credit && creditPayments.length > 0 && (
                <div className="mt-6 border-t-2 pt-4">
                  <h3 className="font-bold text-lg mb-3 text-blue-700">
                    HISTORIAL DE ABONOS
                  </h3>
                  <div className="space-y-3">
                    {creditPayments.map((payment) => (
                      <div key={payment.id} className="p-3 bg-blue-50 rounded border border-blue-200">
                        <div className="flex justify-between mb-1">
                          <span className="font-semibold">
                            {new Date(payment.date).toLocaleString('es-ES')}
                          </span>
                          <span className="font-bold text-green-600">
                            {formatCOP(payment.amount)}
                          </span>
                        </div>
                        <div className="text-sm space-y-0.5">
                          <p>
                            <span className="font-semibold">Método:</span>{' '}
                            {payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                          </p>
                          {payment.notes && (
                            <p>
                              <span className="font-semibold">Nota:</span> {payment.notes}
                            </p>
                          )}
                          <p>
                            <span className="font-semibold">Registrado por:</span> {payment.registered_by}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Resumen de abonos */}
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border-2 border-blue-300">
                    <div className="flex justify-between text-base mb-2">
                      <span className="font-bold">Total Abonado:</span>
                      <span className="font-bold text-green-600 text-lg">
                        {formatCOP(creditPayments.reduce((sum, p) => sum + p.amount, 0))}
                      </span>
                    </div>
                    <div className="flex justify-between text-base">
                      <span className="font-bold">Saldo Pendiente:</span>
                      <span className="font-bold text-orange-600 text-lg">
                        {formatCOP(invoiceToPrint.credit_balance || invoiceToPrint.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 text-center text-sm text-gray-600">
                <p>¡Gracias por su compra!</p>
                <p>www.celumundovip.com</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsPrintDialogOpen(false)}
            >
              Cerrar
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-2" />
              Descargar PDF
            </Button>
            <Button variant="outline" onClick={() => {
              setIsPrintDialogOpen(false);
              setIsThermalPrintDialogOpen(true);
            }} className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300">
              <Receipt className="h-4 w-4 mr-2" />
              Tirilla (80mm)
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Imprimir Normal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmar Pago de Factura Pendiente */}
      <Dialog open={isConfirmPaymentDialogOpen} onOpenChange={setIsConfirmPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Confirmar Pago de Factura
            </DialogTitle>
            <DialogDescription>
              Ingrese los detalles del pago para confirmar la factura.
            </DialogDescription>
          </DialogHeader>

          {invoiceToConfirm && (
            <div className="space-y-4">
              {/* Resumen de la factura */}
              <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Factura:</span>
                  <span className="text-sm font-semibold">{invoiceToConfirm.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Cliente:</span>
                  <span className="text-sm font-semibold">{invoiceToConfirm.customer_name || 'Consumidor Final'}</span>
                </div>
                <div className="flex justify-between border-t pt-2 dark:border-gray-700">
                  <span className="text-sm font-semibold">Total a Pagar:</span>
                  <span className="text-lg font-bold text-green-600">{formatCOP(invoiceToConfirm.total)}</span>
                </div>
              </div>

              {/* Método de pago */}
              <div className="space-y-2">
                <Label htmlFor="cashPayment">Efectivo</Label>
                <Input
                  id="cashPayment"
                  type="number"
                  value={paymentData.cash}
                  onChange={(e) => setPaymentData({ ...paymentData, cash: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transferPayment">Transferencia</Label>
                <Input
                  id="transferPayment"
                  type="number"
                  value={paymentData.transfer}
                  onChange={(e) => setPaymentData({ ...paymentData, transfer: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="otherPayment">Otros</Label>
                <Input
                  id="otherPayment"
                  type="number"
                  value={paymentData.other}
                  onChange={(e) => setPaymentData({ ...paymentData, other: parseFloat(e.target.value) || 0 })}
                  min="0"
                  step="1000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentNoteConfirm">Nota Adicional (Opcional)</Label>
                <Input
                  id="paymentNoteConfirm"
                  type="text"
                  placeholder="Ej: Pagado con tarjeta terminación 1234..."
                  value={paymentData.note}
                  onChange={(e) => setPaymentData({ ...paymentData, note: e.target.value })}
                />
              </div>

              {/* Resumen del pago */}
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-800">
                <div className="flex justify-between text-sm">
                  <span>Total pagando:</span>
                  <span className="font-bold">
                    {formatCOP(paymentData.cash + paymentData.transfer + paymentData.other)}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmPaymentDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmInvoicePayment}
              className="bg-green-600 hover:bg-green-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Confirmando...' : 'Confirmar Pago'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog impresión térmica (tirilla 80mm) */}
      <Dialog open={isThermalPrintDialogOpen} onOpenChange={setIsThermalPrintDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Imprimir en Tirilla Térmica (80mm)</DialogTitle>
            <DialogDescription>
              Vista previa para impresora térmica SAT-22TUE de 80mm
            </DialogDescription>
          </DialogHeader>

          {invoiceToPrint && (
            <div ref={thermalPrintRef}>
              <ThermalInvoicePrint 
                invoice={invoiceToPrint} 
                creditPayments={creditPayments}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsThermalPrintDialogOpen(false);
                setIsPrintDialogOpen(true);
              }}
            >
              Volver
            </Button>
            <Button onClick={handleThermalPrint}>
              <Receipt className="h-4 w-4 mr-2" />
              Imprimir Tirilla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de información del producto */}
      <ProductInfoDialog
        open={isProductInfoDialogOpen}
        onOpenChange={setIsProductInfoDialogOpen}
        product={selectedProductInfo}
      />
    </div>
  );
}
