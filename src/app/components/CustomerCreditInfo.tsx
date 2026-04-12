import { useEffect, useState } from 'react';
import { 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  TrendingUp, 
  Calendar,
  Eye,
  Ban
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { formatCOP } from '../lib/currency';
import { 
  getCustomerByDocument, 
  getInvoices, 
  type Customer 
} from '../lib/supabase';
import { useNavigate } from 'react-router';

interface CustomerCreditInfoProps {
  customerDocument: string;
  invoiceTotal: number;
  onWarning?: (hasIssues: boolean, customer: Customer | null, overdueDays: number, totalDebt: number) => void;
}

export function CustomerCreditInfo({ 
  customerDocument, 
  invoiceTotal,
  onWarning 
}: CustomerCreditInfoProps) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    usedCredit: 0,
    availableCredit: 0,
    overdueDays: 0,
    totalDebt: 0
  });

  useEffect(() => {
    if (customerDocument) {
      loadCustomerData();
    }
  }, [customerDocument]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const [customerData, allInvoices] = await Promise.all([
        getCustomerByDocument(customerDocument),
        getInvoices()
      ]);

      if (!customerData) {
        setCustomer(null);
        setLoading(false);
        return;
      }

      setCustomer(customerData);

      // Calcular estadísticas
      const customerInvoices = allInvoices.filter(
        (inv) => inv.customer_document === customerDocument && inv.is_credit && inv.status === 'pending'
      );

      const totalDebt = customerInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
      const usedCredit = totalDebt;
      const availableCredit = customerData.credit_limit - usedCredit;

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

      setStats({
        usedCredit,
        availableCredit,
        overdueDays: maxOverdueDays,
        totalDebt
      });

      // Notificar si hay problemas
      const hasIssues = customerData.blocked || maxOverdueDays > 0 || (availableCredit - invoiceTotal) < 0;
      if (onWarning) {
        onWarning(hasIssues, customerData, maxOverdueDays, totalDebt);
      }
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse text-center text-zinc-500">
            Cargando información del cliente...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!customer) {
    return null;
  }

  const creditAfterSale = stats.availableCredit - invoiceTotal;
  const hasEnoughCredit = creditAfterSale >= 0;
  const isBlocked = customer.blocked;
  const hasOverdue = stats.overdueDays > 0;

  return (
    <Card className={`border-2 ${
      isBlocked ? 'border-red-300 bg-red-50' :
      !hasEnoughCredit || hasOverdue ? 'border-amber-300 bg-amber-50' :
      'border-emerald-300 bg-emerald-50'
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-zinc-900 flex items-center gap-2">
            <CreditCard className="w-5 h-5" />
            Información de Crédito
          </CardTitle>
          <div className="flex items-center gap-2">
            {isBlocked ? (
              <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                <Ban className="w-3 h-3 mr-1" />
                Bloqueado
              </Badge>
            ) : hasOverdue ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                <AlertCircle className="w-3 h-3 mr-1" />
                Mora
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                <CheckCircle className="w-3 h-3 mr-1" />
                Activo
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Cliente */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-900">{customer.name}</p>
            <p className="text-xs text-zinc-500">{customer.document}</p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(`/clientes/${customer.document}`)}
          >
            <Eye className="w-4 h-4 mr-1" />
            Ver Perfil
          </Button>
        </div>

        {/* Métricas */}
        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-zinc-200">
          <div className="space-y-1">
            <p className="text-xs text-zinc-600">Cupo Total</p>
            <p className="text-sm font-bold text-zinc-900">{formatCOP(customer.credit_limit)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-zinc-600">Plazo</p>
            <p className="text-sm font-bold text-zinc-900">{customer.payment_term} días</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-zinc-600">Crédito Usado</p>
            <p className="text-sm font-bold text-amber-600">{formatCOP(stats.usedCredit)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-zinc-600">Disponible</p>
            <p className="text-sm font-bold text-emerald-600">{formatCOP(stats.availableCredit)}</p>
          </div>
        </div>

        {/* Simulación */}
        {invoiceTotal > 0 && (
          <div className="pt-3 border-t border-zinc-200">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-zinc-600">Después de esta venta:</p>
              <TrendingUp className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-zinc-900">Crédito disponible:</p>
              <p className={`text-lg font-bold ${
                hasEnoughCredit ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatCOP(creditAfterSale)}
              </p>
            </div>
          </div>
        )}

        {/* Alertas */}
        {isBlocked && (
          <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Ban className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900">Cliente Bloqueado</p>
                <p className="text-xs text-red-700 mt-1">
                  No se pueden realizar ventas a crédito a este cliente
                </p>
              </div>
            </div>
          </div>
        )}

        {!isBlocked && hasOverdue && (
          <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Calendar className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Facturas Vencidas</p>
                <p className="text-xs text-amber-700 mt-1">
                  {stats.overdueDays} días de mora • Deuda: {formatCOP(stats.totalDebt)}
                </p>
              </div>
            </div>
          </div>
        )}

        {!isBlocked && !hasOverdue && !hasEnoughCredit && invoiceTotal > 0 && (
          <div className="p-3 bg-amber-100 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-amber-900">Crédito Insuficiente</p>
                <p className="text-xs text-amber-700 mt-1">
                  Esta venta excede el cupo disponible en {formatCOP(Math.abs(creditAfterSale))}
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
