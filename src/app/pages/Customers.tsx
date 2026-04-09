import { useState, useEffect } from 'react';
import { User, CreditCard, DollarSign, FileText, Plus, Search, Eye, Printer, Trash2, XCircle, AlertTriangle } from 'lucide-react';
import { getCustomers, getInvoices, getCreditPaymentsByInvoice, addCreditPayment, deleteCreditPayment, cancelCreditInvoice, type Customer, type Invoice, type CreditPayment, getCurrentUser } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { SQLSetupGuide } from '../components/SQLSetupGuide';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<CreditPayment[]>([]);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    paymentMethod: 'cash',
    notes: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [customersData, invoicesData] = await Promise.all([
        getCustomers(),
        getInvoices()
      ]);
      setCustomers(customersData);
      setInvoices(invoicesData);
      setShowSetupGuide(false);
    } catch (error: any) {
      console.error('Error loading data:', error);
      if (error?.code === 'PGRST205' || error?.code === '42P01') {
        setShowSetupGuide(true);
      }
    }
  };

  if (showSetupGuide) {
    return <SQLSetupGuide />;
  }

  const handleOpenPaymentDialog = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const paymentsData = await getCreditPaymentsByInvoice(invoice.id);
    setPayments(paymentsData);
    setPaymentForm({
      amount: '',
      paymentMethod: 'cash',
      notes: ''
    });
    setIsPaymentDialogOpen(true);
  };

  const handleViewInvoice = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    const paymentsData = await getCreditPaymentsByInvoice(invoice.id);
    setPayments(paymentsData);
    setIsViewDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!selectedInvoice) return;

    const amount = parseFloat(paymentForm.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    const currentBalance = selectedInvoice.credit_balance || selectedInvoice.total;
    if (amount > currentBalance) {
      toast.error('El abono no puede ser mayor al saldo pendiente');
      return;
    }

    const payment: Omit<CreditPayment, 'id' | 'company' | 'created_at'> = {
      invoice_id: selectedInvoice.id,
      customer_document: selectedInvoice.customer_document || '',
      date: new Date().toISOString(),
      amount,
      payment_method: paymentForm.paymentMethod,
      notes: paymentForm.notes,
      registered_by: getCurrentUser()?.username || 'Usuario'
    };

    setIsSubmitting(true);
    const result = await addCreditPayment(payment);
    if (result) {
      toast.success('Abono registrado exitosamente');
      setIsPaymentDialogOpen(false);
      loadData();
    } else {
      toast.error('Error al registrar el abono');
    }
    setIsSubmitting(false);
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!selectedInvoice) return;

    if (!confirm('¿Está seguro de eliminar este abono? Esta acción no se puede deshacer y el saldo pendiente se actualizará.')) {
      return;
    }

    setIsDeletingId(paymentId);
    const result = await deleteCreditPayment(paymentId);
    if (result) {
      toast.success('Abono eliminado exitosamente');
      // Recargar los abonos actualizados
      const updatedPayments = await getCreditPaymentsByInvoice(selectedInvoice.id);
      setPayments(updatedPayments);
      // Recargar todos los datos para actualizar los saldos
      loadData();
    } else {
      toast.error('Error al eliminar el abono');
    }
    setIsDeletingId(null);
  };

  const handleCancelCreditInvoice = async (invoiceId: string, invoiceNumber: string) => {
    if (!confirm(`⚠️ ADVERTENCIA: ¿Está seguro de cancelar esta factura de crédito?\n\nFactura: ${invoiceNumber}\n\nEsta acción:\n✓ Reintegrará los productos al inventario\n✓ Eliminará todos los abonos registrados\n✓ Eliminará completamente la factura\n✗ NO se puede deshacer\n\n¿Desea continuar?`)) {
      return;
    }

    setIsSubmitting(true);
    const result = await cancelCreditInvoice(invoiceId);
    if (result) {
      toast.success('Factura de crédito cancelada exitosamente');
      // Cerrar el modal si está abierto
      setIsViewDialogOpen(false);
      // Recargar todos los datos
      await loadData();
    } else {
      toast.error('Error al cancelar la factura de crédito');
    }
    setIsSubmitting(false);
  };

  // Filtrar facturas de crédito por cliente
  const getCustomerInvoices = (customerDocument: string) => {
    return invoices.filter(inv => 
      inv.is_credit && 
      inv.customer_document === customerDocument
    );
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.document.includes(searchTerm)
  );

  // Paginación
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  // Reset page cuando cambia la búsqueda
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Estadísticas generales
  const totalCreditBalance = invoices
    .filter(inv => inv.is_credit && inv.status === 'pending')
    .reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

  const totalPaid = invoices
    .filter(inv => inv.is_credit && inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalPending = invoices.filter(inv => inv.is_credit && inv.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Clientes</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Gestión de clientes y créditos</p>
        </div>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Clientes</CardTitle>
            <User className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{customers.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Facturas Pendientes</CardTitle>
            <FileText className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalPending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Saldo por Cobrar</CardTitle>
            <CreditCard className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCOP(totalCreditBalance)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Pagado</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCOP(totalPaid)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Búsqueda */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Buscar por nombre o documento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lista de Clientes */}
      <div className="grid grid-cols-1 gap-4">
        {paginatedCustomers.map((customer) => {
          const customerInvoices = getCustomerInvoices(customer.document);
          const pendingInvoices = customerInvoices.filter(inv => inv.status === 'pending');
          const totalDebt = pendingInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);

          return (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                        <User className="h-6 w-6 text-green-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{customer.name}</h3>
                        <p className="text-sm text-gray-600">CC: {customer.document}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500">Facturas Totales</p>
                        <p className="text-sm font-semibold text-gray-900">{customerInvoices.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Pendientes</p>
                        <p className="text-sm font-semibold text-orange-600">{pendingInvoices.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Saldo Total</p>
                        <p className="text-sm font-semibold text-red-600">{formatCOP(totalDebt)}</p>
                      </div>
                    </div>

                    {/* Facturas del Cliente */}
                    {customerInvoices.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-sm font-semibold text-gray-700">Facturas</h4>
                        <div className="space-y-2">
                          {customerInvoices.map((invoice) => (
                            <div
                              key={invoice.id}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-semibold text-gray-900">
                                    {invoice.number}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                                      invoice.status === 'paid'
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-orange-100 text-orange-700'
                                    }`}
                                  >
                                    {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(invoice.date).toLocaleDateString('es-CO')}
                                </p>
                              </div>
                              <div className="text-right mr-4">
                                <p className="text-sm font-semibold text-gray-900">
                                  {formatCOP(invoice.total)}
                                </p>
                                {invoice.status === 'pending' && (
                                  <p className="text-xs text-red-600">
                                    Saldo: {formatCOP(invoice.credit_balance || 0)}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                {invoice.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleOpenPaymentDialog(invoice)}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Abonar
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleViewInvoice(invoice)}
                                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Ver
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {paginatedCustomers.length === 0 && (
          <Card>
            <CardContent className="p-12 text-center">
              <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No hay clientes</h3>
              <p className="text-gray-600">
                Los clientes se crearán automáticamente al generar facturas a crédito
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Mostrando {startIndex + 1} - {Math.min(endIndex, filteredCustomers.length)} de {filteredCustomers.length} clientes
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Anterior
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  (page >= currentPage - 1 && page <= currentPage + 1)
                ) {
                  return (
                    <Button
                      key={page}
                      variant={currentPage === page ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                      className="min-w-[40px]"
                    >
                      {page}
                    </Button>
                  );
                } else if (page === currentPage - 2 || page === currentPage + 2) {
                  return <span key={page} className="px-2 text-gray-500">...</span>;
                }
                return null;
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Dialog de Abono */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Abono</DialogTitle>
            <DialogDescription>Ingrese los detalles del abono para la factura seleccionada.</DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Factura:</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedInvoice.number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Cliente:</span>
                  <span className="text-sm font-semibold text-gray-900">{selectedInvoice.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Factura:</span>
                  <span className="text-sm font-semibold text-gray-900">{formatCOP(selectedInvoice.total)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm font-semibold text-gray-900">Saldo Pendiente:</span>
                  <span className="text-lg font-bold text-red-600">
                    {formatCOP(selectedInvoice.credit_balance || 0)}
                  </span>
                </div>
              </div>

              {/* Historial de Abonos */}
              {payments.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Historial de Abonos</Label>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex justify-between text-xs p-2 bg-gray-50 rounded">
                        <span className="text-gray-600">
                          {new Date(payment.date).toLocaleDateString('es-CO')}
                        </span>
                        <span className="font-semibold text-green-600">{formatCOP(payment.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Monto del Abono *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  min="0"
                  step="1000"
                />
              </div>

              <div className="space-y-2">
                <Label>Método de Pago *</Label>
                <Select
                  value={paymentForm.paymentMethod}
                  onValueChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Efectivo</SelectItem>
                    <SelectItem value="transfer">Transferencia</SelectItem>
                    <SelectItem value="card">Tarjeta</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Textarea
                  placeholder="Observaciones del abono..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitPayment} className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
              {isSubmitting ? 'Registrando...' : 'Registrar Abono'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Ver Factura */}
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
              {/* Información básica de la factura */}
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
                  <p className="text-muted-foreground">Documento</p>
                  <p>{selectedInvoice.customer_document || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo</p>
                  <p>{selectedInvoice.type === 'regular' ? 'Regular' : 'Al Mayor'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Estado</p>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full inline-block ${
                      selectedInvoice.status === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {selectedInvoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                  </span>
                </div>
              </div>

              {/* Productos */}
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

              {/* Totales */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-bold">
                    {formatCOP(selectedInvoice.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (19%):</span>
                  <span className="font-bold">
                    {formatCOP(selectedInvoice.tax)}
                  </span>
                </div>
                <div className="flex justify-between text-lg font-bold text-green-600">
                  <span>TOTAL:</span>
                  <span>{formatCOP(selectedInvoice.total)}</span>
                </div>
              </div>

              {/* Historial de Abonos */}
              {payments.length > 0 && (
                <div className="border-t border-border pt-4">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    Historial de Abonos
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {payments.map((payment) => (
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
                              disabled={isDeletingId === payment.id}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                          <p>
                            <span className="font-medium">Método:</span>{' '}
                            {payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : payment.payment_method === 'card' ? 'Tarjeta' : 'Otro'}
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
                        {formatCOP(payments.reduce((sum, p) => sum + p.amount, 0))}
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

              {payments.length === 0 && selectedInvoice.status === 'pending' && (
                <div className="border-t border-border pt-4">
                  <div className="p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg border border-yellow-200 dark:border-yellow-800 text-center">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      No hay abonos registrados para esta factura
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
            {selectedInvoice && selectedInvoice.status === 'pending' && (
              <Button 
                onClick={() => {
                  setIsViewDialogOpen(false);
                  handleOpenPaymentDialog(selectedInvoice);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Registrar Abono
              </Button>
            )}
            {selectedInvoice && selectedInvoice.status === 'pending' && (
              <Button 
                onClick={() => handleCancelCreditInvoice(selectedInvoice.id, selectedInvoice.number)}
                className="bg-red-600 hover:bg-red-700"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Cancelar Factura
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}