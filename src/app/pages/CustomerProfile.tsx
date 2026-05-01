import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Clock,
  Ban,
  CheckCircle,
  AlertCircle,
  Receipt,
  History,
  Lock,
  Unlock,
  Link,
  Copy
} from 'lucide-react';
import {
  getCustomerByDocument,
  getInvoices,
  getCreditHistory,
  getCreditPaymentsByInvoice,
  updateCustomer,
  addCreditHistory,
  type Customer,
  type Invoice,
  type CreditHistory as CreditHistoryType,
  type CreditPayment,
  getCurrentUser
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { PaymentDialog } from '../components/PaymentDialog';
import { AgingReportView } from '../components/AgingReportView';

export function CustomerProfile() {
  const { document } = useParams<{ document: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<CreditHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTrackingLinkDialog, setShowTrackingLinkDialog] = useState(false);

  useEffect(() => {
    if (document) {
      loadCustomerData();
    }
  }, [document]);

  const loadCustomerData = async () => {
    if (!document) return;

    setLoading(true);
    try {
      // Decodificar el documento de la URL por si tiene caracteres especiales
      const decodedDocument = decodeURIComponent(document);
      console.log('Cargando perfil del cliente con documento:', decodedDocument);

      const [customerData, allInvoices, historyData] = await Promise.all([
        getCustomerByDocument(decodedDocument),
        getInvoices(),
        getCreditHistory(decodedDocument)
      ]);

      if (!customerData) {
        console.error('Cliente no encontrado con documento:', decodedDocument);
        toast.error('Cliente no encontrado');
        navigate('/clientes');
        return;
      }

      console.log('Datos del cliente cargados:', customerData);

      const customerInvoices = allInvoices.filter(
        (inv) => inv.customer_document === decodedDocument && inv.is_credit
      );

      // Calcular el estado correcto del cliente basándose en sus facturas
      let calculatedStatus: 'active' | 'overdue' | 'blocked' = 'active';

      if (customerData.blocked) {
        calculatedStatus = 'blocked';
      } else {
        // Verificar si tiene facturas pendientes vencidas
        const today = new Date();
        const hasOverdueInvoices = customerInvoices.some((inv) => {
          if (inv.status !== 'pending' || !inv.due_date) return false;
          const dueDate = new Date(inv.due_date);
          return dueDate < today;
        });

        calculatedStatus = hasOverdueInvoices ? 'overdue' : 'active';
      }

      // Si el estado calculado es diferente al guardado, actualizar en la base de datos
      if (calculatedStatus !== customerData.status) {
        await updateCustomer(customerData.id, { status: calculatedStatus });
        customerData.status = calculatedStatus;
      }

      setCustomer(customerData);
      setInvoices(customerInvoices);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading customer data:', error);
      toast.error('Error al cargar los datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!customer) return;

    const newBlockedStatus = !customer.blocked;
    const confirmMessage = newBlockedStatus
      ? '¿Está seguro de bloquear este cliente? No podrá realizar nuevas ventas a crédito.'
      : '¿Está seguro de desbloquear este cliente?';

    if (!confirm(confirmMessage)) return;

    setIsUpdating(true);

    // Calcular el nuevo estado
    let newStatus: 'active' | 'overdue' | 'blocked';
    if (newBlockedStatus) {
      newStatus = 'blocked';
    } else {
      // Si se desbloquea, verificar si tiene facturas vencidas
      const today = new Date();
      const hasOverdueInvoices = invoices.some((inv) => {
        if (inv.status !== 'pending' || !inv.due_date) return false;
        const dueDate = new Date(inv.due_date);
        return dueDate < today;
      });
      newStatus = hasOverdueInvoices ? 'overdue' : 'active';
    }

    const result = await updateCustomer(customer.id, {
      blocked: newBlockedStatus,
      status: newStatus
    });

    if (result) {
      await addCreditHistory({
        customer_document: customer.document,
        event_type: 'status_change',
        description: newBlockedStatus ? 'Cliente bloqueado' : 'Cliente desbloqueado',
        registered_by: getCurrentUser()?.username || 'Sistema'
      });

      toast.success(newBlockedStatus ? 'Cliente bloqueado' : 'Cliente desbloqueado');
      loadCustomerData();
    } else {
      toast.error('Error al actualizar el estado del cliente');
    }
    setIsUpdating(false);
  };

  const handleCopyTrackingLink = () => {
    setShowTrackingLinkDialog(true);
  };

  const getStatusBadge = () => {
    if (!customer) return null;

    const styles = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      overdue: 'bg-amber-100 text-amber-700 border-amber-200',
      blocked: 'bg-red-100 text-red-700 border-red-200'
    };
    const labels = {
      active: 'Activo',
      overdue: 'Vencido',
      blocked: 'Bloqueado'
    };
    const Icon = customer.status === 'blocked' ? Ban : customer.status === 'active' ? CheckCircle : AlertCircle;

    return (
      <Badge variant="outline" className={`${styles[customer.status]} text-sm font-medium`}>
        <Icon className="w-4 h-4 mr-1" />
        {labels[customer.status]}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (invoice: Invoice) => {
    if (invoice.status === 'paid') {
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Pagado</Badge>;
    }
    if (invoice.status === 'cancelled') {
      return <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">Cancelado</Badge>;
    }

    if (!invoice.due_date) {
      return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pendiente</Badge>;
    }

    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const isOverdue = dueDate < today;

    return isOverdue ? (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Vencido</Badge>
    ) : (
      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pendiente</Badge>
    );
  };

  const getPaymentIcon = (method: string) => {
    const icons: { [key: string]: string } = {
      cash: '💵',
      transfer: '🏦',
      nequi: '📱',
      daviplata: '💳',
      other: '💰'
    };
    return icons[method] || '💰';
  };

  const getHistoryIcon = (eventType: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      payment: <DollarSign className="w-4 h-4 text-emerald-600" />,
      invoice: <FileText className="w-4 h-4 text-blue-600" />,
      status_change: <AlertCircle className="w-4 h-4 text-amber-600" />,
      credit_limit_change: <CreditCard className="w-4 h-4 text-purple-600" />,
      note: <History className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
    };
    return icons[eventType] || <History className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-zinc-500 dark:text-zinc-400">Cargando perfil del cliente...</div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  const pendingInvoices = invoices.filter((inv) => inv.status === 'pending');
  const totalBalance = pendingInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
  const usedCredit = totalBalance;
  const availableCredit = customer.credit_limit - usedCredit;

  // Calcular días de mora máximo
  const today = new Date();
  let maxOverdueDays = 0;
  pendingInvoices.forEach((inv) => {
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

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/clientes')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{customer.name}</h1>
                  {getStatusBadge()}
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    {customer.document}
                  </span>
                  {customer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {customer.phone}
                    </span>
                  )}
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </span>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {customer.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleCopyTrackingLink}
                variant="outline"
                className="border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
              >
                <Link className="w-4 h-4 mr-2" />
                Link de Seguimiento
                <Copy className="w-3 h-3 ml-2" />
              </Button>

              <Button
                onClick={handleToggleBlock}
                disabled={isUpdating}
                variant={customer.blocked ? 'default' : 'outline'}
                className={customer.blocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-red-300 text-red-600 hover:bg-red-50'}
              >
                {customer.blocked ? (
                  <>
                    <Unlock className="w-4 h-4 mr-2" />
                    Desbloquear Cliente
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-2" />
                    Bloquear Cliente
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas de Crédito */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Cupo de Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(customer.credit_limit)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Límite aprobado</p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Crédito Usado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCOP(usedCredit)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {customer.credit_limit > 0 ? `${((usedCredit / customer.credit_limit) * 100).toFixed(1)}% utilizado` : 'Sin cupo'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Crédito Disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCOP(availableCredit)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Para nuevas compras</p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Plazo de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{customer.payment_term} días</div>
              {maxOverdueDays > 0 && (
                <p className="text-xs text-red-600 mt-1 font-medium">{maxOverdueDays} días de mora</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs de Contenido */}
      <div className="p-6">
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="invoices">
              <FileText className="w-4 h-4 mr-2" />
              Facturas ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="payments">
              <Receipt className="w-4 h-4 mr-2" />
              Pagos
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* Tab de Facturas */}
          <TabsContent value="invoices" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Facturas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {invoices.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-lg font-medium">No hay facturas registradas</p>
                    <p className="text-sm mt-1">Las facturas a crédito aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Número</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Emisión</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Vencimiento</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Total</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Pagado</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Saldo</th>
                          <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Estado</th>
                          <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {invoices.map((invoice) => {
                          const paid = invoice.total - (invoice.credit_balance || 0);
                          const balance = invoice.credit_balance || 0;

                          return (
                            <tr key={invoice.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                              <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">{invoice.number}</td>
                              <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                {new Date(invoice.date).toLocaleDateString('es-CO')}
                              </td>
                              <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                {invoice.due_date
                                  ? new Date(invoice.due_date).toLocaleDateString('es-CO')
                                  : 'Sin fecha'}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                                {formatCOP(invoice.total)}
                              </td>
                              <td className="px-6 py-4 text-right text-emerald-600">{formatCOP(paid)}</td>
                              <td className="px-6 py-4 text-right text-amber-600 font-medium">
                                {formatCOP(balance)}
                              </td>
                              <td className="px-6 py-4 text-center">{getInvoiceStatusBadge(invoice)}</td>
                              <td className="px-6 py-4 text-center">
                                {invoice.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedInvoice(invoice);
                                      setIsPaymentDialogOpen(true);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Registrar Pago
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Pagos */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Historial de Pagos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <PaymentsTab invoices={invoices} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Historial */}
          <TabsContent value="history" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Línea de Tiempo</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {history.length === 0 ? (
                  <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    <History className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-lg font-medium">No hay eventos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((event, index) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            {getHistoryIcon(event.event_type)}
                          </div>
                          {index < history.length - 1 && (
                            <div className="w-0.5 h-full bg-zinc-200 mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.description}</p>
                          {event.amount && (
                            <p className="text-sm text-emerald-600 font-medium mt-1">{formatCOP(event.amount)}</p>
                          )}
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {new Date(event.created_at!).toLocaleString('es-CO')} • {event.registered_by}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Dialog */}
      {selectedInvoice && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onPaymentSuccess={loadCustomerData}
        />
      )}

      {/* Tracking Link Dialog */}
      <Dialog open={showTrackingLinkDialog} onOpenChange={setShowTrackingLinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-600" />
              Link de Seguimiento
            </DialogTitle>
            <DialogDescription>
              Comparte este link con tu cliente para que pueda ver su estado de cuenta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Link del cliente
              </label>
              <Input
                readOnly
                value={customer ? `https://celumundo-app.vercel.app/seguimiento-cliente/${customer.id}` : ''}
                className="font-mono text-sm"
                onClick={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.select();
                }}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Haz clic en el link para seleccionarlo y copiarlo
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para mostrar pagos
function PaymentsTab({ invoices }: { invoices: Invoice[] }) {
  const [payments, setPayments] = useState<Array<CreditPayment & { invoice_number: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllPayments();
  }, [invoices]);

  const loadAllPayments = async () => {
    setLoading(true);
    const allPayments: Array<CreditPayment & { invoice_number: string }> = [];

    for (const invoice of invoices) {
      const invoicePayments = await getCreditPaymentsByInvoice(invoice.id);
      invoicePayments.forEach((payment) => {
        allPayments.push({
          ...payment,
          invoice_number: invoice.number
        });
      });
    }

    allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setPayments(allPayments);
    setLoading(false);
  };

  const getPaymentIcon = (method: string) => {
    const icons: { [key: string]: string } = {
      cash: '💵',
      transfer: '🏦',
      nequi: '📱',
      daviplata: '💳',
      other: '💰'
    };
    return icons[method] || '💰';
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
        <div className="animate-pulse">Cargando pagos...</div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
        <Receipt className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
        <p className="text-lg font-medium">No hay pagos registrados</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-zinc-100">
      {payments.map((payment) => (
        <div key={payment.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-xl">
                {getPaymentIcon(payment.payment_method)}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatCOP(payment.amount)}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 capitalize">
                  {payment.payment_method} • Factura {payment.invoice_number}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{new Date(payment.date).toLocaleDateString('es-CO')}</p>
              <p className="text-xs text-zinc-400 dark:text-zinc-500">
                {new Date(payment.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          {payment.notes && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 ml-15">{payment.notes}</p>
          )}
        </div>
      ))}
    </div>
  );
}