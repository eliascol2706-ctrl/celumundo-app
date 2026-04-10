import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
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
  X
} from 'lucide-react';
import {
  getProducts,
  getDepartments,
  addInvoice,
  updateProduct,
  addMovement,
  canCreateInvoice,
  getCurrentUser
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
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
  availableIds?: string[];
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [productsData, departmentsData] = await Promise.all([
      getProducts(),
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

  const addProductToList = (product: any) => {
    const newItem: InvoiceItem = {
      productId: product.id,
      productName: product.name,
      productCode: product.code,
      quantity: 1,
      price: product.final_price,
      total: product.final_price,
      useUnitIds: product.use_unit_ids,
      unitIds: [],
      availableIds: product.registered_ids || []
    };

    setItems([...items, newItem]);
    setShowProductSearch(false);
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
    updateItem(index, 'price', product.final_price);
    updateItem(index, 'total', product.final_price * items[index].quantity);
    updateItem(index, 'useUnitIds', product.use_unit_ids);
    updateItem(index, 'availableIds', product.registered_ids);
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

    // Verificar stock
    for (const item of items) {
      const product = products.find((p) => p.id === item.productId);
      if (product && product.stock < item.quantity) {
        toast.error(`Stock insuficiente para ${product.name}`);
        return;
      }
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

  // Nueva función para confirmar y crear la factura
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
          unitIds: item.unitIds
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

      // Actualizar inventario solo si la factura está paga
      if (invoiceStatus === 'paid') {
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
      navigate('/facturacion/historial');
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('Error al crear la factura');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              <h1 className="text-3xl font-semibold text-zinc-900">Nueva Factura Regular</h1>
              <p className="text-sm text-zinc-500 mt-1">
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
            {/* Información del Cliente (Opcional) */}
            <Card className="border-zinc-200">
              <CardHeader className="border-b border-zinc-100">
                <CardTitle className="flex items-center gap-2">
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

            {/* Método de Pago - Solo si está paga */}
            {invoiceStatus === 'paid' && (
              <Card className="border-zinc-200">
                <CardHeader className="border-b border-zinc-100">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Método de Pago
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <Label>Seleccionar método *</Label>
                    <div className="grid grid-cols-5 gap-2 mt-2">
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
                    <div className="space-y-3 p-4 bg-zinc-50 rounded-lg border border-zinc-200">
                      <p className="text-sm font-medium text-zinc-700">Distribución de Pagos</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>Efectivo</Label>
                          <Input
                            type="number"
                            value={paymentCash}
                            onChange={(e) => setPaymentCash(parseFloat(e.target.value) || 0)}
                            min="0"
                          />
                        </div>
                        <div>
                          <Label>Transferencia</Label>
                          <Input
                            type="number"
                            value={paymentTransfer}
                            onChange={(e) => setPaymentTransfer(parseFloat(e.target.value) || 0)}
                            min="0"
                          />
                        </div>
                        <div>
                          <Label>Nequi</Label>
                          <Input
                            type="number"
                            value={paymentNequi}
                            onChange={(e) => setPaymentNequi(parseFloat(e.target.value) || 0)}
                            min="0"
                          />
                        </div>
                        <div>
                          <Label>Daviplata</Label>
                          <Input
                            type="number"
                            value={paymentDaviplata}
                            onChange={(e) => setPaymentDaviplata(parseFloat(e.target.value) || 0)}
                            min="0"
                          />
                        </div>
                      </div>
                      <div className="pt-3 border-t border-zinc-300 flex justify-between items-center">
                        <span className="text-sm font-medium text-zinc-700">Total de Pagos:</span>
                        <span className={`text-lg font-bold ${getTotalPayments() === calculateTotal() ? 'text-emerald-600' : 'text-red-600'}`}>
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
              <Card className="border-zinc-200 shadow-lg">
                <CardHeader className="border-b border-zinc-100 bg-zinc-50">
                  <CardTitle>Resumen de Venta</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex justify-between text-lg font-bold">
                    <span className="text-zinc-900">Total:</span>
                    <span className="text-emerald-600">{formatCOP(calculateTotal())}</span>
                  </div>

                  <div className="pt-4 border-t border-zinc-200">
                    <div className="space-y-2 text-sm text-zinc-600">
                      <div className="flex justify-between">
                        <span>Productos:</span>
                        <span className="font-medium">{items.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Estado:</span>
                        <span className={`font-medium ${invoiceStatus === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl">¿Cuál es el estado de esta factura?</DialogTitle>
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
              className="w-full h-20 border-2 border-amber-300 hover:bg-amber-50 flex-col gap-2"
            >
              <Clock className="w-8 h-8 text-amber-600" />
              <span className="text-lg font-semibold text-amber-700">En Confirmación</span>
              <span className="text-xs text-amber-600">Pendiente de confirmar pago</span>
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
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <Receipt className="w-6 h-6 text-emerald-600" />
              Vista Previa de Factura
            </DialogTitle>
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
    </div>
  );
}