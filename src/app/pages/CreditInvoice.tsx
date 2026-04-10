import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  ArrowLeft,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Ban,
  DollarSign,
  Calendar,
  CreditCard,
  User,
  Package,
  X,
  Info,
  TrendingDown,
  TrendingUp,
  Edit2,
  Minus,
  Loader2,
  Hash,
  Edit
} from 'lucide-react';
import {
  getCustomers,
  getProducts,
  getDepartments,
  addInvoice,
  updateProduct,
  addMovement,
  addCreditHistory,
  updateCustomer,
  canCreateInvoice,
  getColombiaDateTime,
  type Customer,
  getCurrentUser,
  getInvoices
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { includesIgnoreAccents } from '../lib/string-utils';
import { CreditWarningModal } from '../components/CreditWarningModal';
import { ProductSelectionModal } from '../components/ProductSelectionModal';

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
  price2: number; // Precio al mayor
  stock: number;
  use_unit_ids: boolean;
  registered_ids: string[];
  registered_ids_with_notes?: Array<{ id: string; note: string }>;
}

export function CreditInvoice() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [paymentTerm, setPaymentTerm] = useState('30');
  const [dueDate, setDueDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [warningData, setWarningData] = useState({
    overdueDays: 0,
    totalDebt: 0
  });
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductIndex, setSelectedProductIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Estados para selector de IDs únicas
  const [unitIdDialogOpen, setUnitIdDialogOpen] = useState(false);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [unitIdNotes, setUnitIdNotes] = useState<{ [id: string]: string }>({});

  // Estados para análisis de crédito
  const [creditAnalysis, setCreditAnalysis] = useState({
    usedCredit: 0,
    availableCredit: 0,
    creditAfterSale: 0,
    hasEnoughCredit: true,
    overdueDays: 0,
    totalDebt: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCustomer) {
      calculatePaymentTerm();
      analyzeCreditStatus();
    }
  }, [selectedCustomer, items]);

  useEffect(() => {
    if (showProductSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showProductSearch]);

  const loadData = async () => {
    const [customersData, productsData, departmentsData] = await Promise.all([
      getCustomers(),
      getProducts(),
      getDepartments()
    ]);
    setCustomers(customersData);
    setProducts(productsData);
    setDepartments(departmentsData);
  };

  const calculatePaymentTerm = () => {
    if (selectedCustomer) {
      setPaymentTerm(selectedCustomer.payment_term.toString());
      const days = selectedCustomer.payment_term;
      const date = new Date();
      date.setDate(date.getDate() + days);
      setDueDate(date.toISOString().split('T')[0]);
    }
  };

  const analyzeCreditStatus = async () => {
    if (!selectedCustomer) return;

    try {
      const allInvoices = await getInvoices();
      const customerInvoices = allInvoices.filter(
        (inv) => inv.customer_document === selectedCustomer.document && inv.is_credit && inv.status === 'pending'
      );

      const totalDebt = customerInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
      const usedCredit = totalDebt;
      const availableCredit = selectedCustomer.credit_limit - usedCredit;
      const invoiceTotal = calculateTotal();
      const creditAfterSale = availableCredit - invoiceTotal;

      // Calcular días de mora
      const today = new Date();
      let maxOverdueDays = 0;
      customerInvoices.forEach((inv) => {
        if (inv.due_date) {
          const dueDate = new Date(inv.due_date);
          if (dueDate < today) {
            const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (overdueDays > maxOverdueDays) {
              maxOverdueDays = overdueDays;
            }
          }
        }
      });

      setCreditAnalysis({
        usedCredit,
        availableCredit,
        creditAfterSale,
        hasEnoughCredit: creditAfterSale >= 0,
        overdueDays: maxOverdueDays,
        totalDebt
      });

      setWarningData({
        overdueDays: maxOverdueDays,
        totalDebt
      });
    } catch (error) {
      console.error('Error analyzing credit:', error);
    }
  };

  const calculateSubtotal = () => {
    return items.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTotal = () => {
    return calculateSubtotal();
  };

  const addItem = () => {
    // Abrir modal de selección de productos
    // Preparar nuevo item
    const newIndex = items.length;
    setSelectedProductIndex(newIndex);
    setShowProductSearch(true);
  };

  const addProductToList = (product: any) => {
    // Verificar si el producto usa IDs y tiene IDs disponibles
    if (product.use_unit_ids) {
      const availableIds = product.registered_ids || [];
      if (availableIds.length === 0) {
        toast.error(`${product.name} no tiene IDs registradas disponibles`);
        return;
      }
    }

    // Agregar nuevo item con el producto seleccionado
    const newItem: InvoiceItem = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity: 1,
      price: product.price2,
      total: product.price2,
      useUnitIds: product.use_unit_ids,
      unitIds: [],
      availableIds: product.registered_ids || [],
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

  const selectProduct = (index: number, product: Product) => {
    updateItem(index, 'productId', product.id);
    updateItem(index, 'productName', product.name);
    updateItem(index, 'productCode', product.code);
    updateItem(index, 'price', product.price2);
    updateItem(index, 'total', product.price2 * items[index].quantity);
    updateItem(index, 'useUnitIds', product.use_unit_ids);
    updateItem(index, 'availableIds', product.registered_ids || []);
    setShowProductSearch(false);
    setProductSearch('');
  };

  const filteredProducts = products.filter(
    (p) =>
      includesIgnoreAccents(p.name, productSearch) ||
      p.code.toLowerCase().includes(productSearch.toLowerCase())
  );

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
    const item = items[currentItemIndex];
    
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
    
    const item = items[currentItemIndex];
    
    if (selectedUnitIds.length !== item.quantity) {
      toast.error(`Debes seleccionar exactamente ${item.quantity} IDs`);
      return;
    }
    
    const updated = [...items];
    updated[currentItemIndex].unitIds = selectedUnitIds;
    updated[currentItemIndex].unitIdNotes = unitIdNotes;
    setItems(updated);
    setUnitIdDialogOpen(false);
    setCurrentItemIndex(null);
    setSelectedUnitIds([]);
    setUnitIdNotes({});
    toast.success('IDs seleccionadas correctamente');
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!selectedCustomer) {
      toast.error('Seleccione un cliente');
      return;
    }

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

    // Verificar si el cliente está bloqueado
    if (selectedCustomer.blocked) {
      setShowWarningModal(true);
      return;
    }

    // Verificar facturas vencidas
    if (creditAnalysis.overdueDays > 0) {
      setShowWarningModal(true);
      return;
    }

    // Verificar crédito disponible
    if (!creditAnalysis.hasEnoughCredit) {
      toast.error('El cliente no tiene crédito suficiente para esta venta');
      return;
    }

    // Verificar si se pueden crear facturas (no hay cierre)
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

    // Verificar stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.stock < item.quantity) {
        toast.error(`Stock insuficiente para ${product.name}`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Crear factura
      const invoiceData = {
        type: 'wholesale' as const,
        customer_name: selectedCustomer.name,
        customer_document: selectedCustomer.document,
        items: items.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productCode: item.productCode,
          quantity: item.quantity,
          price: item.price,
          total: item.total,
          useUnitIds: item.useUnitIds,
          unitIds: item.unitIds
        })),
        subtotal: calculateSubtotal(),
        tax: 0,
        total: calculateTotal(),
        is_credit: true,
        credit_balance: calculateTotal(),
        due_date: dueDate,
        status: 'pending' as const,
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

          // Si usa IDs unitarios, remover los IDs vendidos
          let newRegisteredIds = product.registered_ids;
          if (item.useUnitIds && item.unitIds && item.unitIds.length > 0) {
            newRegisteredIds = product.registered_ids.filter(
              (id) => !item.unitIds!.includes(id)
            );
          }

          await updateProduct(item.productId, {
            stock: newStock,
            registered_ids: newRegisteredIds
          });

          // Registrar movimiento
          await addMovement({
            type: 'exit',
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            reason: `Venta a crédito - Factura ${invoice.number}`,
            reference: invoice.number,
            user_name: getCurrentUser()?.username || 'Usuario',
            unit_ids: item.useUnitIds ? item.unitIds : []
          });
        }
      }

      // Actualizar totales del cliente
      await updateCustomer(selectedCustomer.id, {
        total_credit: selectedCustomer.total_credit + calculateTotal()
      });

      // Registrar en historial
      await addCreditHistory({
        customer_document: selectedCustomer.document,
        event_type: 'invoice',
        description: `Factura ${invoice.number} creada - ${formatCOP(calculateTotal())}`,
        amount: calculateTotal(),
        reference_id: invoice.id,
        registered_by: getCurrentUser()?.username || 'Sistema'
      });

      toast.success('Factura a crédito creada exitosamente');
      navigate('/facturacion/historial');
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Error al crear la factura');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRiskBadge = () => {
    if (!selectedCustomer) return null;

    if (selectedCustomer.blocked) {
      return (
        <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
          <Ban className="w-4 h-4 mr-1" />
          Bloqueado
        </Badge>
      );
    }

    if (creditAnalysis.overdueDays > 0) {
      return (
        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
          <AlertTriangle className="w-4 h-4 mr-1" />
          En Riesgo
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
        <CheckCircle className="w-4 h-4 mr-1" />
        Activo
      </Badge>
    );
  };

  const getStatusColor = () => {
    if (!selectedCustomer) return 'zinc';
    if (selectedCustomer.blocked) return 'red';
    if (creditAnalysis.overdueDays > 0) return 'amber';
    return 'emerald';
  };

  const statusColor = getStatusColor();

  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header */}
      <div className="bg-white border-b border-zinc-200">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/facturacion')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al Menú
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900">Nueva Factura a Crédito</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Venta con pago diferido y seguimiento de cartera
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sección Cliente */}
            <Card className={`border-2 ${
              selectedCustomer
                ? `border-${statusColor}-300 bg-${statusColor}-50/50`
                : 'border-zinc-200'
            }`}>
              <CardHeader className="border-b border-zinc-100">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Cliente
                  </CardTitle>
                  {selectedCustomer && getRiskBadge()}
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                {!selectedCustomer ? (
                  <div>
                    <Label>Seleccionar Cliente *</Label>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        const customer = customers.find((c) => c.id === value);
                        setSelectedCustomer(customer || null);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Buscar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name} - {customer.document}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-zinc-500 mt-2">
                      Solo clientes con cupo de crédito asignado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-lg font-semibold text-zinc-900">
                          {selectedCustomer.name}
                        </p>
                        <p className="text-sm text-zinc-500">{selectedCustomer.document}</p>
                        {selectedCustomer.phone && (
                          <p className="text-sm text-zinc-600 mt-1">{selectedCustomer.phone}</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedCustomer(null)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-zinc-200">
                      <div>
                        <p className="text-xs text-zinc-600">Cupo de Crédito</p>
                        <p className="text-sm font-bold text-zinc-900">
                          {formatCOP(selectedCustomer.credit_limit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-600">Deuda Actual</p>
                        <p className="text-sm font-bold text-amber-600">
                          {formatCOP(creditAnalysis.usedCredit)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-600">Crédito Disponible</p>
                        <p className={`text-sm font-bold ${
                          creditAnalysis.availableCredit > 0 ? 'text-emerald-600' : 'text-red-600'
                        }`}>
                          {formatCOP(creditAnalysis.availableCredit)}
                        </p>
                      </div>
                    </div>

                    {creditAnalysis.overdueDays > 0 && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-amber-900">
                              Cliente con facturas vencidas
                            </p>
                            <p className="text-xs text-amber-700 mt-1">
                              {creditAnalysis.overdueDays} días de mora • {formatCOP(creditAnalysis.totalDebt)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sección Productos */}
            <Card className="border-zinc-200">
              <CardHeader className="border-b border-zinc-100">
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
                  <div className="text-center py-12 text-zinc-500">
                    <Package className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
                    <p className="text-lg font-medium">No hay productos agregados</p>
                    <p className="text-sm mt-1">Agregue productos para continuar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {items.map((item, index) => (
                      <div
                        key={index}
                        className="p-4 bg-zinc-50 rounded-lg border border-zinc-200"
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
                                    <div className="flex flex-wrap gap-1 mb-2">
                                      {item.unitIds.map((id) => (
                                        <span
                                          key={id}
                                          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded text-xs font-mono"
                                        >
                                          {id}
                                        </span>
                                      ))}
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
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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

            {/* Sección Condiciones de Crédito */}
            {selectedCustomer && (
              <Card className="border-zinc-200">
                <CardHeader className="border-b border-zinc-100">
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    Condiciones de Crédito
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Días de Crédito</Label>
                      <Input
                        type="number"
                        value={paymentTerm}
                        onChange={(e) => {
                          setPaymentTerm(e.target.value);
                          const days = parseInt(e.target.value) || 0;
                          const date = new Date();
                          date.setDate(date.getDate() + days);
                          setDueDate(date.toISOString().split('T')[0]);
                        }}
                        min="1"
                      />
                      <p className="text-xs text-zinc-500 mt-1">
                        Plazo estándar: {selectedCustomer.payment_term} días
                      </p>
                    </div>
                    <div>
                      <Label>Fecha de Vencimiento</Label>
                      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Panel Lateral (Sticky) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Resumen */}
              <Card className="border-zinc-200 shadow-lg">
                <CardHeader className="border-b border-zinc-100 bg-zinc-50">
                  <CardTitle>Resumen de Venta</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-zinc-900">Total:</span>
                    <span className="text-emerald-600">{formatCOP(calculateTotal())}</span>
                  </div>

                  {selectedCustomer && (
                    <>
                      <div className="pt-4 border-t border-zinc-200 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-600">Disponible actual:</span>
                          <span className="font-medium text-emerald-600">
                            {formatCOP(creditAnalysis.availableCredit)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-zinc-600">Después de la venta:</span>
                          <span
                            className={`font-bold ${
                              creditAnalysis.hasEnoughCredit ? 'text-emerald-600' : 'text-red-600'
                            }`}
                          >
                            {formatCOP(creditAnalysis.creditAfterSale)}
                          </span>
                        </div>
                      </div>

                      {/* Advertencias */}
                      {!creditAnalysis.hasEnoughCredit && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-red-900">
                                Crédito Insuficiente
                              </p>
                              <p className="text-xs text-red-700 mt-1">
                                Esta venta supera el crédito disponible en{' '}
                                {formatCOP(Math.abs(creditAnalysis.creditAfterSale))}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {creditAnalysis.hasEnoughCredit && calculateTotal() > 0 && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-emerald-900">
                                Venta Autorizada
                              </p>
                              <p className="text-xs text-emerald-700 mt-1">
                                El cliente tiene crédito suficiente
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {creditAnalysis.overdueDays > 0 && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-amber-900">
                                Cliente con Mora
                              </p>
                              <p className="text-xs text-amber-700 mt-1">
                                {creditAnalysis.overdueDays} días • {formatCOP(creditAnalysis.totalDebt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Botones de Acción */}
              <div className="space-y-3">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    isSubmitting ||
                    isValidating ||
                    !selectedCustomer ||
                    items.length === 0 ||
                    selectedCustomer.blocked ||
                    !creditAnalysis.hasEnoughCredit
                  }
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
                      <CreditCard className="w-4 h-4 mr-2" />
                      Crear Factura a Crédito
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

      {/* Product Selection Modal */}
      <ProductSelectionModal
        open={showProductSearch}
        onOpenChange={setShowProductSearch}
        products={products}
        departments={departments}
        onSelectProduct={(product) => {
          if (selectedProductIndex !== null && selectedProductIndex < items.length) {
            // Editar producto existente
            selectProduct(selectedProductIndex, product);
          } else {
            // Agregar nuevo producto
            addProductToList(product);
          }
        }}
      />

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
              Selecciona exactamente{' '}
              {currentItemIndex !== null && items[currentItemIndex]?.quantity}{' '}
              IDs para esta venta.
            </DialogDescription>
          </DialogHeader>

          {currentItemIndex !== null && items[currentItemIndex] && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-zinc-50 dark:bg-zinc-900 p-3 rounded border border-zinc-200 dark:border-zinc-800">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">
                  {items[currentItemIndex].productName}
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Seleccionadas: {selectedUnitIds.length} /{' '}
                  {items[currentItemIndex].quantity}
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
                  <div className="col-span-full text-center py-8 text-zinc-500 dark:text-zinc-400">
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

      {/* Warning Modal */}
      {selectedCustomer && (
        <CreditWarningModal
          isOpen={showWarningModal}
          onClose={() => setShowWarningModal(false)}
          customer={selectedCustomer}
          totalDebt={warningData.totalDebt}
          overdueDays={warningData.overdueDays}
          onRegisterPayment={() => {
            setShowWarningModal(false);
            navigate(`/customers/${selectedCustomer.document}`);
          }}
          onContinueAnyway={() => {
            // Solo admin puede continuar
            const user = getCurrentUser();
            if (user?.role === 'admin') {
              setShowWarningModal(false);
              // Continuar con la creación aunque tenga advertencias
              toast.warning('Continuando con la venta (modo administrador)');
            }
          }}
          userRole={getCurrentUser()?.role || 'seller'}
        />
      )}
    </div>
  );
}