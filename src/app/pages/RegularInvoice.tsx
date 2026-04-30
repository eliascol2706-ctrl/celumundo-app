import { useState, useEffect, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Receipt,
  User,
  Package,
  DollarSign,
  CreditCard,
  Loader2,
  CheckCircle,
  Clock,
  Banknote,
  Smartphone,
  Info,
  X,
  Hash,
  Edit,
  Scan,
  Printer,
  Download,
  FileText,
  Save,
  FolderOpen
} from 'lucide-react';
import {
  getAllProducts,
  getDepartments,
  addInvoice,
  updateProduct,
  addMovement,
  canCreateInvoice,
  getCurrentUser,
  saveInvoiceDraft,
  getInvoiceSaves,
  deleteInvoiceSave,
  type InvoiceSave
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { ProductSelectionModal } from '../components/ProductSelectionModal';
import { ThermalInvoicePrint } from '../components/ThermalInvoicePrint';
import { isElectron, onGlobalShortcut, removeGlobalShortcutListener } from '../lib/electron-utils';

interface InvoiceItem {
  productId: string;
  productName: string;
  productCode: string;
  quantity: number;
  price: number;
  total: number;
  useUnitIds?: boolean;
  unitIds?: string[];
  availableIds?: Array<{ id: string; note: string }>; // Array de IDs con notas
  unitIdNotes?: { [id: string]: string };
}

interface Product {
  id: string;
  code: string;
  name: string;
  price1: number;
  final_price: number;
  stock: number;
  use_unit_ids: boolean;
  registered_ids: string[];
  registered_ids_with_notes?: Array<{ id: string; note: string }>;
}

type InvoiceStatus = 'paid' | 'pending_confirmation';
type PaymentMethod = 'cash' | 'transfer' | 'nequi' | 'daviplata' | 'mixed';

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  nequi: 'Nequi',
  daviplata: 'Daviplata',
  mixed: 'Mixto'
};

export function RegularInvoice() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const shouldProceedRef = useRef(false);

  // Modal de estado inicial
  const [showStatusModal, setShowStatusModal] = useState(true);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('paid');

  // Información del cliente (opcional)
  const [customerName, setCustomerName] = useState('');
  const [customerDocument, setCustomerDocument] = useState('');

  // Método de pago
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentCash, setPaymentCash] = useState(0);
  const [paymentTransfer, setPaymentTransfer] = useState(0);
  const [paymentNequi, setPaymentNequi] = useState(0);
  const [paymentDaviplata, setPaymentDaviplata] = useState(0);

  // Preview de confirmación
  const [showPreview, setShowPreview] = useState(false);

  // Modal de método de pago
  const [showPaymentMethodModal, setShowPaymentMethodModal] = useState(false);

  // Estados para guardar/cargar facturas
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [savedInvoices, setSavedInvoices] = useState<InvoiceSave[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(false);

  // Estados para selector de IDs únicas
  const [unitIdDialogOpen, setUnitIdDialogOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitIdNotes, setUnitIdNotes] = useState<{ [id: string]: string }>({});

  // Estados para el lector de código de barras
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    loadData();
  }, []);

  // Manejar entrada de código de barras
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // No capturar si hay focus en inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      // Limpiar timeout anterior
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Si es Enter, procesar el código
      if (e.key === 'Enter' && barcodeBuffer.length > 0) {
        const code = barcodeBuffer.trim();
        setBarcodeBuffer('');

        console.log('🔵 [RegularInvoice] Código RAW recibido del lector:', code, 'Longitud:', code.length);

        // Detectar si el código incluye un ID de unidad
        let scannedUnitId: string | null = null;
        let productCodeToSearch = code;

        // Limpiar código de posibles letras A
        const cleanCode = code.replace(/A/g, '');

        // Si el código tiene 9 dígitos exactos, separar código de producto y ID de unidad
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
          console.log('📊 Código escaneado (5 dígitos - solo producto):', productCodeToSearch);
        }
        // Soportar formato con guión: "10001-0001"
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
          return numericCode === productCodeToSearch || numericCode === cleanCode || p.code === code;
        });

        console.log('✅ Producto encontrado:', product ? product.name : '❌ NO ENCONTRADO');

        if (product) {
          // Verificar si ya está agregado
          if (items.some(item => item.productId === product.id)) {
            toast.error('Este producto ya está agregado');
            return;
          }

          // Agregar automáticamente el producto usando la función existente
          addProductToList(product);

          // Si se escaneó un ID de unidad específico, pre-seleccionarlo
          if (scannedUnitId && product.use_unit_ids) {
            const { getAvailableIds } = import('../lib/unit-ids-utils').then(module => {
              const availableIds = module.getAvailableIds(product.registered_ids || []);
              const availableIdStrings = availableIds.map(idObj => typeof idObj === 'object' ? idObj.id : idObj);

              if (availableIdStrings.includes(scannedUnitId!)) {
                toast.success(`Producto agregado: ${product.name} (ID: ${scannedUnitId})`);
                setTimeout(() => {
                  setSelectedUnitIds([scannedUnitId!]);
                }, 100);
              } else {
                toast.warning(`ID ${scannedUnitId} no disponible. Seleccione una ID manualmente.`);
              }
            });
          } else if (!product.use_unit_ids) {
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
  }, [barcodeBuffer, products, items]);

  // === Funciones helper (declaradas antes de los useEffects que las usan) ===
  const loadData = async () => {
    const [productsData, departmentsData] = await Promise.all([
      getAllProducts(),
      getDepartments()
    ]);
    setProducts(productsData);
    setDepartments(departmentsData);
  };

  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const getTotalPayments = () => {
    if (paymentMethod === 'mixed') {
      return paymentCash + paymentTransfer + paymentNequi + paymentDaviplata;
    }
    return calculateTotal();
  };

  const addItem = () => {
    const newIndex = items.length;
    setSelectedProductIndex(newIndex);
    setShowProductSearch(true);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    if (field === 'quantity' || field === 'price') {
      newItems[index].total = newItems[index].quantity * newItems[index].price;
    }

    setItems(newItems);
  };

  const handleSubmit = async () => {
    // Validaciones
    if (items.length === 0) {
      toast.error('Agregue al menos un producto');
      return;
    }

    if (items.some((item) => !item.productId || item.quantity <= 0)) {
      toast.error('Complete todos los productos');
      return;
    }

    // Validar que productos con IDs tengan IDs seleccionadas
    for (const item of items) {
      if (item.useUnitIds && (!item.unitIds || item.unitIds.length === 0)) {
        toast.error(`Debes seleccionar las IDs para ${item.productName}. Haz clic en "Seleccionar IDs" en la lista de productos.`);
        return;
      }
      if (item.useUnitIds && item.unitIds && item.unitIds.length !== item.quantity) {
        toast.error(`${item.productName}: Debes seleccionar ${item.quantity} IDs pero solo has seleccionado ${item.unitIds.length}`);
        return;
      }
    }

    // Verificar if se pueden crear facturas (no hay cierre)
    setIsValidating(true);
    const validation = await canCreateInvoice();
    setIsValidating(false);

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

    // Validar pagos si está paga
    if (invoiceStatus === 'paid') {
      const total = calculateTotal();
      const totalPaid = getTotalPayments();

      if (paymentMethod === 'mixed' && totalPaid !== total) {
        toast.error(`El total de pagos (${formatCOP(totalPaid)}) no coincide con el total de la factura (${formatCOP(total)})`);
        return;
      }
    }

    // ✅ Mostrar preview en lugar de crear directamente
    setShowPreview(true);
  };

  const handleConfirmCreate = async () => {
    setIsSubmitting(true);

    try {
      // Preparar datos de pago
      const paymentData: any = {};
      if (invoiceStatus === 'paid') {
        if (paymentMethod === 'mixed') {
          paymentData.payment_method = 'mixed';
          paymentData.payment_cash = paymentCash;
          paymentData.payment_transfer = paymentTransfer;
          paymentData.payment_other = paymentNequi + paymentDaviplata;
          paymentData.payment_note = `Nequi: ${formatCOP(paymentNequi)}, Daviplata: ${formatCOP(paymentDaviplata)}`;
        } else {
          paymentData.payment_method = PAYMENT_METHOD_LABELS[paymentMethod];
          if (paymentMethod === 'cash') {
            paymentData.payment_cash = calculateTotal();
          } else if (paymentMethod === 'transfer') {
            paymentData.payment_transfer = calculateTotal();
          } else if (paymentMethod === 'nequi') {
            paymentData.payment_other = calculateTotal();
            paymentData.payment_note = 'Nequi';
          } else if (paymentMethod === 'daviplata') {
            paymentData.payment_other = calculateTotal();
            paymentData.payment_note = 'Daviplata';
          }
        }
      }

      // Crear factura
      const invoiceData = {
        type: 'regular' as const,
        customer_name: customerName || undefined,
        customer_document: customerDocument || undefined,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          useUnitIds: item.useUnitIds,
          unitIds: item.unitIds,
          unitIdNotes: item.unitIdNotes
        })),
        subtotal: calculateTotal(),
        tax: 0,
        total: calculateTotal(),
        status: invoiceStatus,
        ...paymentData,
        attended_by: getCurrentUser()?.username || 'Usuario'
      };

      const invoice = await addInvoice(invoiceData);

      if (!invoice) {
        toast.error('Error al crear la factura');
        setIsSubmitting(false);
        return;
      }

      // Actualizar inventario
      for (const item of items) {
        const product = products.find((p) => p.id === item.productId);
        if (product) {
          const newStock = product.stock - item.quantity;
          let newRegisteredIds = product.registered_ids;

          if (item.useUnitIds && item.unitIds && item.unitIds.length > 0) {
            if (invoiceStatus === 'paid') {
              // Si está paga: MARCAR como vendidas (no eliminar, para poder restaurar en devoluciones)
              const { markIdsAsSold } = await import('../lib/unit-ids-utils');
              newRegisteredIds = markIdsAsSold(product.registered_ids, item.unitIds);
            } else {
              // Si está en confirmación: INHABILITAR las IDs temporalmente
              const { disableIds } = await import('../lib/unit-ids-utils');
              newRegisteredIds = disableIds(product.registered_ids, item.unitIds, invoice.id);
            }
          }

          await updateProduct(item.productId, {
            stock: newStock,
            registered_ids: newRegisteredIds
          });

          // Registrar movimiento solo si está paga
          if (invoiceStatus === 'paid') {
            await addMovement({
              type: 'exit',
              product_id: item.productId,
              product_name: item.productName,
              quantity: item.quantity,
              reason: `Venta regular - Factura ${invoice.number}`,
              reference: invoice.number,
              user_name: getCurrentUser()?.username || 'Usuario',
              unit_ids: item.useUnitIds ? item.unitIds : []
            });
          }
        }
      }

      toast.success(
        invoiceStatus === 'paid'
          ? 'Factura creada y pagada exitosamente'
          : 'Factura creada - Pendiente de confirmación de pago'
      );

      // Guardar la factura en localStorage para mostrar modal en InvoicesMenu
      localStorage.setItem('lastCreatedInvoice', JSON.stringify(invoice));

      // Marcar que debe proceder sin mostrar alerta
      shouldProceedRef.current = true;

      // Navegar (el blocker procederá automáticamente)
      navigate('/facturacion');
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Error al crear la factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Guardar factura
  const handleSaveInvoice = async () => {
    if (items.length === 0) {
      toast.error('No hay productos para guardar');
      return;
    }

    setIsSaving(true);
    try {
      const invoiceData = {
        items,
        customerName,
        customerDocument,
        invoiceStatus,
        paymentMethod,
        paymentCash,
        paymentTransfer,
        paymentNequi,
        paymentDaviplata,
        total: calculateTotal()
      };

      const result = await saveInvoiceDraft('regular', invoiceData, saveName || undefined);

      if (result) {
        toast.success('Factura guardada exitosamente');
        setShowSaveDialog(false);
        setSaveName('');
        // Limpiar la factura actual
        setItems([]);
        setCustomerName('');
        setCustomerDocument('');
        setPaymentMethod('cash');
        setPaymentCash(0);
        setPaymentTransfer(0);
        setPaymentNequi(0);
        setPaymentDaviplata(0);
      } else {
        toast.error('Error al guardar la factura');
      }
    } catch (error) {
      console.error('Error saving invoice:', error);
      toast.error('Error al guardar la factura');
    } finally {
      setIsSaving(false);
    }
  };

  // Cargar lista de facturas guardadas
  const loadSavedInvoices = async () => {
    setIsLoadingList(true);
    try {
      const saves = await getInvoiceSaves('regular');
      setSavedInvoices(saves);
    } catch (error) {
      console.error('Error loading saved invoices:', error);
      toast.error('Error al cargar facturas guardadas');
    } finally {
      setIsLoadingList(false);
    }
  };

  // Cargar factura guardada
  const handleLoadInvoice = (save: InvoiceSave) => {
    const data = save.invoice_data;
    setItems(data.items || []);
    setCustomerName(data.customerName || '');
    setCustomerDocument(data.customerDocument || '');
    setInvoiceStatus(data.invoiceStatus || 'paid');
    setPaymentMethod(data.paymentMethod || 'cash');
    setPaymentCash(data.paymentCash || 0);
    setPaymentTransfer(data.paymentTransfer || 0);
    setPaymentNequi(data.paymentNequi || 0);
    setPaymentDaviplata(data.paymentDaviplata || 0);
    setShowLoadDialog(false);
    toast.success('Factura cargada exitosamente');
  };

  // Eliminar factura guardada
  const handleDeleteSave = async (saveId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta factura guardada?')) return;

    const success = await deleteInvoiceSave(saveId);
    if (success) {
      toast.success('Factura eliminada');
      loadSavedInvoices(); // Recargar lista
    } else {
      toast.error('Error al eliminar');
    }
  };

  // Cargar facturas guardadas cuando se abre el diálogo
  useEffect(() => {
    if (showLoadDialog) {
      loadSavedInvoices();
    }
  }, [showLoadDialog]);

  // Bloquear navegación si hay productos en la factura
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      items.length > 0 &&
      currentLocation.pathname !== nextLocation.pathname
  );

  // Mostrar confirmación al bloqueador de navegación
  useEffect(() => {
    if (blocker.state === "blocked") {
      // Si se marcó shouldProceed, proceder automáticamente sin alerta
      if (shouldProceedRef.current) {
        shouldProceedRef.current = false;
        blocker.proceed();
        return;
      }

      // Si no, mostrar confirmación normal
      const confirmExit = window.confirm(
        "⚠️ Tienes una factura sin terminar con productos agregados.\n\nSi sales, se perderá toda la información.\n\n¿Estás seguro de que deseas salir?"
      );

      if (confirmExit) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  // Prevenir cierre de ventana/pestaña si hay productos
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (items.length > 0) {
        e.preventDefault();
        e.returnValue = ''; // Necesario para Chrome
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [items.length]);

  // Atajos de teclado para agilizar facturación
  useEffect(() => {
    // Función unificada para manejar atajos
    const processShortcut = (key: string) => {
      console.log('⌨️ [Regular] Atajo recibido:', key);

      // F1: Agregar producto
      if (key === 'F1') {
        console.log('✅ F1 - Agregar producto');
        addItem();
        return;
      }

      // F2: Modificar precio del último producto
      if (key === 'F2') {
        console.log('✅ F2 - Editar precio', 'Items:', items.length);
        if (items.length > 0) {
          const lastIndex = items.length - 1;
          const lastItem = items[lastIndex];
          console.log('Último producto:', lastItem);

          const newPrice = window.prompt(`Nuevo precio para ${lastItem.productName}:`, lastItem.price.toString());
          console.log('Precio ingresado:', newPrice);

          if (newPrice !== null && newPrice.trim() !== '') {
            const parsedPrice = parseFloat(newPrice);
            if (!isNaN(parsedPrice) && parsedPrice > 0) {
              updateItem(lastIndex, 'price', parsedPrice);
              toast.success(`Precio actualizado a ${formatCOP(parsedPrice)}`);
            } else {
              toast.error('Precio inválido');
            }
          }
        } else {
          toast.error('No hay productos para editar');
        }
        return;
      }

      // F3: Modificar cantidad del último producto
      if (key === 'F3') {
        console.log('✅ F3 - Editar cantidad', 'Items:', items.length);
        if (items.length > 0) {
          const lastIndex = items.length - 1;
          const lastItem = items[lastIndex];
          console.log('Último producto:', lastItem);

          const newQty = window.prompt(`Nueva cantidad para ${lastItem.productName}:`, lastItem.quantity.toString());
          console.log('Cantidad ingresada:', newQty);

          if (newQty !== null && newQty.trim() !== '') {
            const parsedQty = parseInt(newQty);
            if (!isNaN(parsedQty) && parsedQty > 0) {
              updateItem(lastIndex, 'quantity', parsedQty);
              toast.success(`Cantidad actualizada a ${parsedQty}`);
            } else {
              toast.error('Cantidad inválida');
            }
          }
        } else {
          toast.error('No hay productos para editar');
        }
        return;
      }

      // F4: Remover último producto
      if (key === 'F4') {
        console.log('✅ F4 - Quitar producto');
        if (items.length > 0) {
          const lastIndex = items.length - 1;
          removeItem(lastIndex);
          toast.success('Producto removido');
        }
        return;
      }

      // F5: Método de pago - Efectivo
      if (key === 'F5') {
        console.log('✅ F5 - Efectivo');
        setPaymentMethod('cash');
        toast.success('Método: Efectivo');
        return;
      }

      // F6: Método de pago - Transferencia
      if (key === 'F6') {
        console.log('✅ F6 - Transferencia');
        setPaymentMethod('transfer');
        toast.success('Método: Transferencia');
        return;
      }

      // F7: Método de pago - Nequi
      if (key === 'F7') {
        console.log('✅ F7 - Nequi');
        setPaymentMethod('nequi');
        toast.success('Método: Nequi');
        return;
      }

      // F8: Método de pago - Daviplata
      if (key === 'F8') {
        console.log('✅ F8 - Daviplata');
        setPaymentMethod('daviplata');
        toast.success('Método: Daviplata');
        return;
      }

      // F9: Método de pago - Mixto
      if (key === 'F9') {
        console.log('✅ F9 - Mixto');
        setPaymentMethod('mixed');
        toast.success('Método: Mixto');
        return;
      }

      // Enter: Finalizar factura (solo si no hay modales abiertos)
      if (key === 'Enter') {
        console.log('✅ Enter - Finalizar factura');
        if (items.length > 0 && !isSubmitting && !showPreview && !unitIdDialogOpen) {
          handleSubmit();
        }
        return;
      }
    };

    // Handler para eventos de teclado del navegador
    const handleKeyboardShortcuts = (e: KeyboardEvent) => {
      const isTyping = document.activeElement?.tagName === 'INPUT' ||
                      document.activeElement?.tagName === 'TEXTAREA';

      // Para teclas F, siempre procesarlas
      if (e.key.startsWith('F') && /^F([1-9]|1[0-2])$/.test(e.key)) {
        e.preventDefault();
        processShortcut(e.key);
        return;
      }

      // Para Enter, solo si no está escribiendo
      if (e.key === 'Enter' && !isTyping) {
        e.preventDefault();
        processShortcut(e.key);
        return;
      }
    };

    // Registrar listener de teclado normal
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Si estamos en Electron, también registrar listener global
    if (isElectron()) {
      console.log('🖥️ [Regular] Electron detectado - Registrando atajos globales');
      onGlobalShortcut((key) => {
        console.log('🌐 [Regular] Atajo global de Electron:', key);
        processShortcut(key);
      });
    }

    return () => {
      document.removeEventListener('keydown', handleKeyboardShortcuts);
      if (isElectron()) {
        removeGlobalShortcutListener();
      }
    };
  }, [items, isSubmitting, showPreview, unitIdDialogOpen, addItem, removeItem, updateItem, handleSubmit, setPaymentMethod]);

  const addProductToList = async (product: any) => {
    // Verificar si el producto usa IDs y tiene IDs disponibles
    if (product.use_unit_ids) {
      const { getAvailableIds } = await import('../lib/unit-ids-utils');
      const availableIds = getAvailableIds(product.registered_ids || []);
      if (availableIds.length === 0) {
        toast.error(`${product.name} no tiene IDs registradas disponibles`);
        return;
      }
    }

    // Filtrar solo IDs disponibles (no inhabilitadas)
    const { getAvailableIds } = await import('../lib/unit-ids-utils');
    const availableIds = product.use_unit_ids
      ? getAvailableIds(product.registered_ids || [])
      : product.registered_ids || [];

    const newItem: InvoiceItem = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity: 1,
      price: product.final_price,
      total: product.final_price,
      useUnitIds: product.use_unit_ids,
      unitIds: [],
      availableIds: availableIds,
      unitIdNotes: {}
    };

    setItems([...items, newItem]);
    setShowProductSearch(false);

    // Si usa IDs, abrir selector
    if (product.use_unit_ids) {
      setCurrentItemIndex(items.length);
      setSelectedUnitIds([]);
      setUnitIdDialogOpen(true);
    }
  };

  const selectProduct = async (index: number, product: Product) => {
    // Filtrar solo IDs disponibles (no inhabilitadas)
    const { getAvailableIds } = await import('../lib/unit-ids-utils');
    const availableIds = product.use_unit_ids
      ? getAvailableIds(product.registered_ids || [])
      : product.registered_ids || [];

    updateItem(index, 'productId', product.id);
    updateItem(index, 'productName', product.name);
    updateItem(index, 'productCode', product.code);
    updateItem(index, 'price', product.final_price);
    updateItem(index, 'total', product.final_price * items[index].quantity);
    updateItem(index, 'useUnitIds', product.use_unit_ids);
    updateItem(index, 'availableIds', availableIds);
    setShowProductSearch(false);
  };

  const handleStatusSelection = (status: InvoiceStatus) => {
    setInvoiceStatus(status);
    setShowStatusModal(false);
    
    // Si selecciona "Paga", mostrar modal de método de pago
    // Si selecciona "En Confirmación", no mostrar modal de método de pago
    if (status === 'paid') {
      setShowPaymentMethodModal(true);
    }
  };

  // Funciones para manejo de IDs únicas
  const handleOpenUnitIdSelector = (index: number) => {
    setCurrentItemIndex(index);
    setSelectedUnitIds([...(items[index].unitIds || [])]);
    
    // Cargar notas existentes o crear objeto vacío con notas del producto
    const existingNotes = items[index].unitIdNotes || {};
    const productNotesMap: { [id: string]: string } = {};
    
    // Pre-cargar las notas del producto si existen
    if (items[index].availableIds) {
      items[index].availableIds!.forEach((item) => {
        productNotesMap[item.id] = item.note || '';
      });
    }
    
    // Combinar notas existentes con las del producto
    setUnitIdNotes({ ...productNotesMap, ...existingNotes });
    setUnitIdDialogOpen(true);
  };

  const toggleUnitId = (unitId: string) => {
    if (currentItemIndex === null) return;

    if (selectedUnitIds.includes(unitId)) {
      setSelectedUnitIds(selectedUnitIds.filter(id => id !== unitId));
    } else {
      setSelectedUnitIds([...selectedUnitIds, unitId]);
    }
  };

  const handleSaveUnitIds = () => {
    if (currentItemIndex === null) return;

    // Validar que se haya seleccionado al menos 1 ID
    if (selectedUnitIds.length === 0) {
      toast.error('Debes seleccionar al menos 1 ID');
      return;
    }

    const updated = [...items];
    updated[currentItemIndex].unitIds = selectedUnitIds;
    updated[currentItemIndex].unitIdNotes = unitIdNotes;
    // Actualizar cantidad automáticamente según IDs seleccionadas
    updated[currentItemIndex].quantity = selectedUnitIds.length;
    updated[currentItemIndex].total = selectedUnitIds.length * updated[currentItemIndex].price;
    setItems(updated);
    setUnitIdDialogOpen(false);
    setCurrentItemIndex(null);
    setSelectedUnitIds([]);
    setUnitIdNotes({});
    toast.success(`${selectedUnitIds.length} ID(s) seleccionadas correctamente`);
  };

  // Función para manejar volver al menú con confirmación
  const handleBackToMenu = () => {
    if (items.length > 0) {
      const confirmExit = window.confirm(
        "⚠️ Tienes una factura sin terminar con productos agregados.\n\nSi sales, se perderá toda la información.\n\n¿Estás seguro de que deseas salir?"
      );
      if (confirmExit) {
        shouldProceedRef.current = true;
        navigate('/facturacion');
      }
    } else {
      navigate('/facturacion');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Button variant="ghost" onClick={handleBackToMenu}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al Menú
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(true)}
              disabled={items.length === 0}
              className="border-blue-300 text-blue-700 hover:bg-blue-50"
            >
              <Save className="w-4 h-4 mr-2" />
              Guardar
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowLoadDialog(true)}
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Cargar
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Nueva Factura Regular</h1>
                <span className="flex items-center gap-1 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  <Scan className="h-4 w-4" />
                  Lector de código activo
                </span>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {invoiceStatus === 'paid' ? 'Venta con pago inmediato' : 'Venta pendiente de confirmación'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {invoiceStatus === 'paid' ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Paga</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">En Confirmación</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Atajos de Teclado - Compacto */}
            <div className="px-3 py-2 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 flex-wrap text-[10px]">
                <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-900 dark:text-blue-100 font-medium">Atajos:</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F1</kbd> Agregar</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F2</kbd> Precio</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F3</kbd> Cantidad</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F4</kbd> Quitar</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F5</kbd> Efectivo</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F6</kbd> Transfer.</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F7</kbd> Nequi</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F8</kbd> Daviplata</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">F9</kbd> Mixto</span>
                <span className="text-blue-700 dark:text-blue-300"><kbd className="px-1.5 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-blue-300/50 rounded font-mono text-[9px]">Enter</kbd> Finalizar</span>
              </div>
            </div>

            {/* Información del Cliente (Opcional) */}
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <User className="w-5 h-5" />
                  Información del Cliente (Opcional)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nombre del cliente..."
                    />
                  </div>
                  <div>
                    <Label>Cédula</Label>
                    <Input
                      value={customerDocument}
                      onChange={(e) => setCustomerDocument(e.target.value)}
                      placeholder="Número de documento..."
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sección Productos */}
            <Card className="border-zinc-200 dark:border-zinc-800">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5" />
                    Productos
                  </CardTitle>
                  <Button onClick={addItem} size="sm" className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {items.length === 0 ? (
                  <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
                    <Package className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-lg font-medium">No hay productos agregados</p>
                    <p className="text-sm mt-1">Agregue productos para continuar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex-1 space-y-3">
                            <div>
                              <Label>Producto *</Label>
                              <div className="relative">
                                <Input
                                  value={item.productName || ''}
                                  onClick={() => {
                                    setSelectedProductIndex(index);
                                    setShowProductSearch(true);
                                  }}
                                  readOnly
                                  placeholder="Seleccionar producto..."
                                  className="cursor-pointer"
                                />
                                {item.productCode && (
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500">
                                    {item.productCode}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                              <div>
                                <Label>Cantidad *</Label>
                                <Input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateItem(index, 'quantity', parseInt(e.target.value) || 0)
                                  }
                                  min="1"
                                />
                              </div>
                              <div>
                                <Label>Precio *</Label>
                                <Input
                                  type="number"
                                  value={item.price}
                                  onChange={(e) =>
                                    updateItem(index, 'price', parseFloat(e.target.value) || 0)
                                  }
                                  min="0"
                                />
                              </div>
                              <div>
                                <Label>Total</Label>
                                <Input value={formatCOP(item.total)} readOnly className="font-bold" />
                              </div>
                            </div>

                            {/* Mostrar/Seleccionar IDs */}
                            {item.useUnitIds && (
                              <div className="mt-3">
                                {item.unitIds && item.unitIds.length > 0 ? (
                                  <>
                                    <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                                      IDs seleccionadas:
                                    </p>
                                    <div className="space-y-1 mb-2">
                                      {item.unitIds.map((id) => {
                                        const note = item.unitIdNotes?.[id] || '';
                                        return (
                                          <div key={id} className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded text-xs font-mono">
                                              {id}
                                            </span>
                                            {note && (
                                              <span className="text-xs text-zinc-600 dark:text-zinc-400 italic">
                                                {note}
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                                    ⚠️ Debes seleccionar las IDs para este producto
                                  </p>
                                )}
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenUnitIdSelector(index)}
                                  className="w-full border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950 text-blue-700 dark:text-blue-400"
                                >
                                  <Hash className="h-3 w-3 mr-1" />
                                  Seleccionar IDs
                                </Button>
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Método de Pago - Solo si está paga */}
            {invoiceStatus === 'paid' && (
              <Card className="border-zinc-200 dark:border-zinc-800">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Método de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Seleccionar método *</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 mt-2">
                      <Button
                        type="button"
                        variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('cash')}
                        className={paymentMethod === 'cash' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <Banknote className="w-4 h-4 mr-2" />
                        Efectivo
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'transfer' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('transfer')}
                        className={paymentMethod === 'transfer' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <CreditCard className="w-4 h-4 mr-2" />
                        Transfer
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'nequi' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('nequi')}
                        className={paymentMethod === 'nequi' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Nequi
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'daviplata' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('daviplata')}
                        className={paymentMethod === 'daviplata' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <Smartphone className="w-4 h-4 mr-2" />
                        Daviplata
                      </Button>
                      <Button
                        type="button"
                        variant={paymentMethod === 'mixed' ? 'default' : 'outline'}
                        onClick={() => setPaymentMethod('mixed')}
                        className={paymentMethod === 'mixed' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                      >
                        <DollarSign className="w-4 h-4 mr-2" />
                        Mixto
                      </Button>
                    </div>
                  </div>

                  {paymentMethod === 'mixed' && (
                    <div className="space-y-3 p-3 sm:p-4 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-700">
                      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Distribución de Pagos</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs sm:text-sm">Efectivo</Label>
                          <Input
                            type="number"
                            value={paymentCash}
                            onChange={(e) => setPaymentCash(parseFloat(e.target.value) || 0)}
                            min="0"
                            className="text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Transferencia</Label>
                          <Input
                            type="number"
                            value={paymentTransfer}
                            onChange={(e) => setPaymentTransfer(parseFloat(e.target.value) || 0)}
                            min="0"
                            className="text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Nequi</Label>
                          <Input
                            type="number"
                            value={paymentNequi}
                            onChange={(e) => setPaymentNequi(parseFloat(e.target.value) || 0)}
                            min="0"
                            className="text-sm sm:text-base"
                          />
                        </div>
                        <div>
                          <Label className="text-xs sm:text-sm">Daviplata</Label>
                          <Input
                            type="number"
                            value={paymentDaviplata}
                            onChange={(e) => setPaymentDaviplata(parseFloat(e.target.value) || 0)}
                            min="0"
                            className="text-sm sm:text-base"
                          />
                        </div>
                      </div>
                      <div className="pt-3 border-t border-zinc-300 dark:border-zinc-600 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <span className="text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300">Total de Pagos:</span>
                        <span className={`text-base sm:text-lg font-bold ${getTotalPayments() === calculateTotal() ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {formatCOP(getTotalPayments())}
                        </span>
                      </div>
                      {getTotalPayments() !== calculateTotal() && (
                        <p className="text-xs text-red-600">
                          ⚠️ El total de pagos debe coincidir con el total de la factura
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel Lateral */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Resumen */}
              <Card className="border-zinc-200 dark:border-zinc-800 shadow-lg">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
                  <CardTitle className="text-zinc-900 dark:text-zinc-100">Resumen de Venta</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-zinc-900 dark:text-zinc-100">Total:</span>
                    <span className="text-emerald-600 dark:text-emerald-400">{formatCOP(calculateTotal())}</span>
                  </div>

                  <div className="pt-4 border-t border-zinc-200 dark:border-zinc-700">
                    <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <div className="flex justify-between">
                        <span>Productos:</span>
                        <span className="font-medium">{items.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estado:</span>
                        <span className={`font-medium ${invoiceStatus === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {invoiceStatus === 'paid' ? 'Paga' : 'En Confirmación'}
                        </span>
                      </div>
                      {invoiceStatus === 'paid' && paymentMethod && (
                        <div className="flex justify-between">
                          <span>Método:</span>
                          <span className="font-medium">{PAYMENT_METHOD_LABELS[paymentMethod]}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Botones de Acción */}
              <div className="space-y-3">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isValidating || items.length === 0}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creando factura...
                    </>
                  ) : isValidating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Validando...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4 mr-2" />
                      Crear Factura
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => navigate('/facturacion')}
                  className="w-full"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Selección de Estado Inicial */}
      <Dialog open={showStatusModal} onOpenChange={setShowStatusModal}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-2xl text-zinc-900 dark:text-zinc-100">¿Cuál es el estado de esta factura?</DialogTitle>
            <DialogDescription>
              Selecciona el estado de pago de la factura
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              onClick={() => handleStatusSelection('paid')}
              className="w-full h-20 bg-emerald-600 hover:bg-emerald-700 flex-col gap-2"
            >
              <CheckCircle className="w-8 h-8" />
              <span className="text-lg font-semibold">Paga</span>
              <span className="text-xs opacity-90">El pago ya fue recibido</span>
            </Button>
            <Button
              onClick={() => handleStatusSelection('pending_confirmation')}
              variant="outline"
              className="w-full h-20 border-2 border-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950 flex-col gap-2"
            >
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
              <span className="text-lg font-semibold text-amber-700 dark:text-amber-400">En Confirmación</span>
              <span className="text-xs text-amber-600 dark:text-amber-400">Pendiente de confirmar pago</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Product Selection Modal */}
      <ProductSelectionModal
        open={showProductSearch}
        onOpenChange={setShowProductSearch}
        products={products}
        departments={departments}
        onSelectProduct={(product) => {
          if (selectedProductIndex !== null && selectedProductIndex < items.length) {
            selectProduct(selectedProductIndex, product);
          } else {
            addProductToList(product);
          }
        }}
      />

      {/* Preview Modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !isSubmitting) {
              e.preventDefault();
              handleConfirmCreate();
            }
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-600" />
              Vista Previa de Factura
            </DialogTitle>
            <DialogDescription>
              Revisa los detalles de la factura antes de crearla
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Estado y Cliente */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Estado</p>
                <div className="flex items-center gap-2">
                  {invoiceStatus === 'paid' ? (
                    <>
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                      <span className="font-semibold text-emerald-600">Pagada</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span className="font-semibold text-amber-600">En Confirmación</span>
                    </>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Tipo</p>
                <span className="font-semibold text-zinc-900 dark:text-zinc-100">Regular</span>
              </div>

              {customerName && (
                <>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Cliente</p>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">{customerName}</span>
                  </div>
                  {customerDocument && (
                    <div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Documento</p>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">{customerDocument}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Método de Pago */}
            {invoiceStatus === 'paid' && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-2 font-semibold">MÉTODO DE PAGO</p>
                <div className="space-y-2">
                  {paymentMethod === 'mixed' ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {paymentCash > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 dark:text-zinc-300">Efectivo:</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(paymentCash)}</span>
                          </div>
                        )}
                        {paymentTransfer > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 dark:text-zinc-300">Transferencia:</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(paymentTransfer)}</span>
                          </div>
                        )}
                        {paymentNequi > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 dark:text-zinc-300">Nequi:</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(paymentNequi)}</span>
                          </div>
                        )}
                        {paymentDaviplata > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-600 dark:text-zinc-300">Daviplata:</span>
                            <span className="font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(paymentDaviplata)}</span>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      {paymentMethod === 'cash' && <Banknote className="w-4 h-4 text-emerald-600" />}
                      {paymentMethod === 'transfer' && <CreditCard className="w-4 h-4 text-emerald-600" />}
                      {(paymentMethod === 'nequi' || paymentMethod === 'daviplata') && <Smartphone className="w-4 h-4 text-emerald-600" />}
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 text-lg">
                        {PAYMENT_METHOD_LABELS[paymentMethod]}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Lista de Productos */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden">
              <div className="bg-zinc-100 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">PRODUCTOS ({items.length})</p>
              </div>
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 max-h-64 overflow-y-auto">
                {items.map((item, index) => (
                  <div key={index} className="p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">{item.productName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {item.productCode} • {item.quantity} x {formatCOP(item.price)}
                        </p>
                        
                        {/* Mostrar IDs únicas con notas si existen */}
                        {item.useUnitIds && item.unitIds && item.unitIds.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">IDs Vendidas:</p>
                            {item.unitIds.map((id) => {
                              const note = item.unitIdNotes?.[id] || '';
                              return (
                                <div key={id} className="flex items-center gap-2 text-xs">
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded font-mono">
                                    {id}
                                  </span>
                                  {note && (
                                    <span className="text-zinc-600 dark:text-zinc-400 italic">• {note}</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-600 dark:text-emerald-400">{formatCOP(item.total)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="p-4 bg-emerald-600 dark:bg-emerald-700 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-white font-semibold text-lg">TOTAL A PAGAR:</span>
                <span className="text-white font-bold text-2xl">{formatCOP(calculateTotal())}</span>
              </div>
            </div>

            {/* Advertencia de confirmación */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {invoiceStatus === 'paid' 
                  ? 'Al confirmar, se creará la factura y se actualizará el inventario inmediatamente.'
                  : 'Al confirmar, se creará la factura pendiente de confirmación de pago. El inventario se actualizará cuando se confirme el pago.'
                }
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
              className="flex-1"
              disabled={isSubmitting}
            >
              <X className="w-4 h-4 mr-2" />
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmCreate}
              disabled={isSubmitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              autoFocus
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirmar y Crear
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog selector de IDs únicas */}
      <Dialog open={unitIdDialogOpen} onOpenChange={(open) => {
        if (!open) {
          // Si se cierra el modal y el producto no tiene IDs, eliminarlo
          if (currentItemIndex !== null && items[currentItemIndex]) {
            const item = items[currentItemIndex];
            if (!item.unitIds || item.unitIds.length === 0) {
              const updated = items.filter((_, idx) => idx !== currentItemIndex);
              setItems(updated);
              toast.info('Producto eliminado (sin IDs seleccionadas)');
            }
          }
          setCurrentItemIndex(null);
          setSelectedUnitIds([]);
        }
        setUnitIdDialogOpen(open);
      }}>
        <DialogContent className="max-w-2xl bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Seleccionar IDs de Unidades</DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Selecciona las IDs que deseas vender. La cantidad se ajustará automáticamente.
            </DialogDescription>
          </DialogHeader>

          {currentItemIndex !== null && items[currentItemIndex] && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {items[currentItemIndex].productName}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  IDs seleccionadas: {selectedUnitIds.length} {selectedUnitIds.length === 1 ? 'unidad' : 'unidades'}
                </p>
              </div>

              <div className="space-y-2">
                {items[currentItemIndex].availableIds && items[currentItemIndex].availableIds!.length > 0 ? (
                  items[currentItemIndex].availableIds!.map((item) => {
                    const currentNote = unitIdNotes[item.id] || item.note || '';
                    
                    return (
                      <div
                        key={item.id}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedUnitIds.includes(item.id)
                            ? 'border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-950'
                            : 'border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => toggleUnitId(item.id)}
                            className={`px-3 py-1.5 rounded font-mono text-sm font-medium transition-all ${
                              selectedUnitIds.includes(item.id)
                                ? 'bg-green-600 text-white dark:bg-green-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
                            }`}
                          >
                            {item.id}
                          </button>
                          {selectedUnitIds.includes(item.id) && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                              ✓ Seleccionada
                            </span>
                          )}
                        </div>
                        {currentNote && (
                          <div className="flex items-start gap-2 px-2 py-1.5 bg-blue-50 dark:bg-blue-950 rounded text-xs">
                            <Info className="h-3 w-3 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                            <span className="text-blue-700 dark:text-blue-300">{currentNote}</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-zinc-500 dark:text-zinc-400">
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
                if (currentItemIndex !== null && items[currentItemIndex]) {
                  const item = items[currentItemIndex];
                  if (!item.unitIds || item.unitIds.length === 0) {
                    const updated = items.filter((_, idx) => idx !== currentItemIndex);
                    setItems(updated);
                    toast.info('Producto eliminado (sin IDs seleccionadas)');
                  }
                }
                setUnitIdDialogOpen(false);
                setCurrentItemIndex(null);
                setSelectedUnitIds([]);
              }}
              className="border-zinc-300 dark:border-zinc-700"
            >
              Cancelar
            </Button>
            <Button 
              type="button" 
              onClick={handleSaveUnitIds}
              className="bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white"
            >
              Confirmar Selección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Guardar Factura */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Guardar Factura</DialogTitle>
            <DialogDescription>
              Guarda esta factura para continuarla más tarde
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="save-name">Nombre (opcional)</Label>
              <Input
                id="save-name"
                placeholder="Ej: Factura cliente Juan..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Dale un nombre descriptivo para identificarla fácilmente
              </p>
            </div>

            <div className="bg-muted/50 dark:bg-zinc-800/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1 text-zinc-900 dark:text-zinc-100">Se guardará:</p>
              <ul className="space-y-1 text-muted-foreground dark:text-zinc-400">
                <li>• {items.length} producto(s)</li>
                <li>• Total: {formatCOP(calculateTotal())}</li>
                {customerName && <li>• Cliente: {customerName}</li>}
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveInvoice}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo para Cargar Factura */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] bg-white dark:bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Cargar Factura Guardada</DialogTitle>
            <DialogDescription>
              Selecciona una factura guardada para continuar trabajando en ella
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 max-h-[500px] overflow-y-auto">
            {isLoadingList ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : savedInvoices.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground dark:text-zinc-400">
                <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No hay facturas guardadas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {savedInvoices.map((save) => {
                  const data = save.invoice_data;
                  return (
                    <div
                      key={save.id}
                      className="border dark:border-zinc-700 rounded-lg p-4 hover:bg-muted/50 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-medium text-zinc-900 dark:text-zinc-100">
                            {save.save_name || `Factura sin nombre`}
                          </h4>
                          <div className="text-sm text-muted-foreground dark:text-zinc-400 mt-1 space-y-0.5">
                            <p>• {data.items?.length || 0} producto(s)</p>
                            <p>• Total: {formatCOP(data.total || 0)}</p>
                            {data.customerName && <p>• Cliente: {data.customerName}</p>}
                            <p className="text-xs">
                              Guardada: {new Date(save.created_at).toLocaleString('es-CO')}
                            </p>
                            {save.created_by && (
                              <p className="text-xs">Por: {save.created_by}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleLoadInvoice(save)}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            <FolderOpen className="w-4 h-4 mr-1" />
                            Cargar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteSave(save.id)}
                            className="text-red-600 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLoadDialog(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}