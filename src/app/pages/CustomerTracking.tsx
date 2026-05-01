import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { User, CreditCard, DollarSign, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { getCustomers, getInvoices, getCreditPaymentsByInvoice, type Customer, type Invoice, type CreditPayment, extractColombiaDate } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatCOP } from '../lib/currency';
import { Badge } from '../components/ui/badge';

export function CustomerTracking() {
  const { document } = useParams<{ document: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<{ [key: string]: CreditPayment[] }>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomerData();
  }, [document]);

  const loadCustomerData = async () => {
    if (!document) return;

    try {
      const [customersData, invoicesData] = await Promise.all([
        getCustomers(),
        getInvoices()
      ]);

      // Buscar cliente por documento
      const foundCustomer = customersData.find(c => c.document === document);
      setCustomer(foundCustomer || null);

      // Filtrar facturas del cliente
      const customerInvoices = invoicesData.filter(
        inv => inv.is_credit && inv.customer_document === document
      );
      setInvoices(customerInvoices);

      // Cargar pagos para cada factura
      const paymentsMap: { [key: string]: CreditPayment[] } = {};
      for (const invoice of customerInvoices) {
        const invoicePayments = await getCreditPaymentsByInvoice(invoice.id);
        paymentsMap[invoice.id] = invoicePayments;
      }
      setPayments(paymentsMap);
    } catch (error) {
      console.error('Error loading customer data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-12 text-center">
            <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Cliente no encontrado</h2>
            <p className="text-gray-600 dark:text-gray-400">
              No se encontró ningún cliente con el documento proporcionado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
  const totalDebt = pendingInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => {
    const invoicePayments = payments[inv.id] || [];
    return sum + invoicePayments.reduce((pSum, p) => pSum + p.amount, 0);
  }, 0);
  const creditLimit = customer.credit_limit || 0;
  const availableCredit = creditLimit - totalDebt;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* Header con información del cliente */}
        <div className="mb-8">
          <Card className="border-purple-200 dark:border-purple-800 shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">
                  <User className="h-10 w-10 text-white" />
                </div>
                <div className="flex-1">
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                    {customer.name}
                  </h1>
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
                    CC: {customer.document}
                  </p>
                  <div className="flex items-center gap-3">
                    {pendingInvoices.length > 0 ? (
                      <Badge className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800">
                        <Clock className="h-3 w-3 mr-1" />
                        {pendingInvoices.length} factura{pendingInvoices.length !== 1 ? 's' : ''} pendiente{pendingInvoices.length !== 1 ? 's' : ''}
                      </Badge>
                    ) : (
                      <Badge className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Al día
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Estadísticas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Cupo Disponible
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {formatCOP(availableCredit)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                de {formatCOP(creditLimit)}
              </p>
            </CardContent>
          </Card>

          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Saldo Pendiente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {formatCOP(totalDebt)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Total Abonado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {formatCOP(totalPaid)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Total Facturas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {invoices.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Facturas */}
        <Card className="border-gray-200 dark:border-gray-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Facturas a Crédito
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay facturas registradas</p>
              </div>
            ) : (
              <div className="space-y-4">
                {invoices.map((invoice) => {
                  const invoicePayments = payments[invoice.id] || [];
                  const totalPaidInvoice = invoicePayments.reduce((sum, p) => sum + p.amount, 0);
                  const balance = invoice.credit_balance || 0;

                  return (
                    <div
                      key={invoice.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-lg font-bold text-gray-900 dark:text-gray-100">
                              {invoice.number}
                            </span>
                            <Badge
                              className={
                                invoice.status === 'paid'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800'
                                  : 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800'
                              }
                            >
                              {invoice.status === 'paid' ? 'Pagada' : 'Pendiente'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {extractColombiaDate(invoice.date)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500 dark:text-gray-400">Total</p>
                          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                            {formatCOP(invoice.total)}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-3">
                        <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded-lg">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Abonado</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">
                            {formatCOP(totalPaidInvoice)}
                          </p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">Saldo</p>
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">
                            {formatCOP(balance)}
                          </p>
                        </div>
                      </div>

                      {/* Historial de Abonos */}
                      {invoicePayments.length > 0 && (
                        <div className="mt-4 border-t border-gray-200 dark:border-gray-700 pt-3">
                          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            Historial de Abonos
                          </h5>
                          <div className="space-y-2">
                            {invoicePayments.map((payment) => (
                              <div
                                key={payment.id}
                                className="flex items-center justify-between text-sm bg-gray-50 dark:bg-gray-800 p-2 rounded"
                              >
                                <div>
                                  <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {extractColombiaDate(payment.date)}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {payment.payment_method}
                                  </p>
                                </div>
                                <p className="font-bold text-green-600 dark:text-green-400">
                                  {formatCOP(payment.amount)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>Portal de Seguimiento de Cliente - Celumundo</p>
        </div>
      </div>
    </div>
  );
}
