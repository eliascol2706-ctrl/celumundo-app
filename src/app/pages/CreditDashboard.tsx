import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  DollarSign, 
  Users, 
  Calendar,
  CreditCard,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { 
  getCreditMetrics, 
  getTopDebtors, 
  getRecentPayments, 
  type Customer,
  type CreditPayment 
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { formatCOP } from '../lib/currency';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router';

interface Metrics {
  totalPortfolio: number;
  overdueAmount: number;
  weekPaymentsTotal: number;
  weekPaymentsCount: number;
  riskLevel: 'low' | 'medium' | 'high';
  riskPercentage: number;
}

interface Debtor extends Customer {
  totalDebt: number;
  overdueDays: number;
}

export function CreditDashboard() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<Metrics>({
    totalPortfolio: 0,
    overdueAmount: 0,
    weekPaymentsTotal: 0,
    weekPaymentsCount: 0,
    riskLevel: 'low',
    riskPercentage: 0
  });
  const [topDebtors, setTopDebtors] = useState<Debtor[]>([]);
  const [recentPayments, setRecentPayments] = useState<CreditPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsData, debtorsData, paymentsData] = await Promise.all([
        getCreditMetrics(),
        getTopDebtors(5),
        getRecentPayments(10)
      ]);
      setMetrics(metricsData);
      setTopDebtors(debtorsData);
      setRecentPayments(paymentsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRiskBadge = (level: 'low' | 'medium' | 'high') => {
    const styles = {
      low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      medium: 'bg-amber-100 text-amber-700 border-amber-200',
      high: 'bg-red-100 text-red-700 border-red-200'
    };
    const labels = {
      low: 'Bajo Riesgo',
      medium: 'Riesgo Medio',
      high: 'Alto Riesgo'
    };
    return (
      <Badge variant="outline" className={styles[level]}>
        {labels[level]}
      </Badge>
    );
  };

  const getStatusBadge = (customer: Debtor) => {
    if (customer.blocked) {
      return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Bloqueado</Badge>;
    }
    if (customer.overdueDays > 0) {
      return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Vencido</Badge>;
    }
    return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Al día</Badge>;
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
      <div className="flex items-center justify-center h-96">
        <div className="animate-pulse text-zinc-500">Cargando dashboard...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Gestión de Crédito</h1>
          <p className="text-sm text-zinc-500 mt-1">Panel de control de cartera de clientes</p>
        </div>
        <Button
          onClick={() => navigate('/clientes?mode=list')}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Users className="w-4 h-4 mr-2" />
          Ver Clientes
        </Button>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total de Cartera */}
        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Total de Cartera</CardTitle>
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <DollarSign className="w-4 h-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900">{formatCOP(metrics.totalPortfolio)}</div>
            <p className="text-xs text-zinc-500 mt-1">Créditos activos</p>
          </CardContent>
        </Card>

        {/* Cartera Vencida */}
        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Cartera Vencida</CardTitle>
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatCOP(metrics.overdueAmount)}</div>
            <p className="text-xs text-zinc-500 mt-1">
              {metrics.totalPortfolio > 0 
                ? `${((metrics.overdueAmount / metrics.totalPortfolio) * 100).toFixed(1)}% del total`
                : 'Sin cartera vencida'}
            </p>
          </CardContent>
        </Card>

        {/* Pagos de la Semana */}
        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Pagos (7 días)</CardTitle>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-zinc-900">{formatCOP(metrics.weekPaymentsTotal)}</div>
            <p className="text-xs text-zinc-500 mt-1">{metrics.weekPaymentsCount} pagos recibidos</p>
          </CardContent>
        </Card>

        {/* Indicador de Riesgo */}
        <Card className="border-zinc-200 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-600">Indicador de Riesgo</CardTitle>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
              metrics.riskLevel === 'high' ? 'bg-red-100' :
              metrics.riskLevel === 'medium' ? 'bg-amber-100' : 'bg-emerald-100'
            }`}>
              <TrendingDown className={`w-4 h-4 ${
                metrics.riskLevel === 'high' ? 'text-red-600' :
                metrics.riskLevel === 'medium' ? 'text-amber-600' : 'text-emerald-600'
              }`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-bold text-zinc-900">{metrics.riskPercentage.toFixed(1)}%</div>
              {getRiskBadge(metrics.riskLevel)}
            </div>
            <p className="text-xs text-zinc-500 mt-1">Porcentaje de mora</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Clientes con Mayor Deuda */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100">
            <CardTitle className="text-lg font-semibold text-zinc-900">Clientes con Mayor Deuda</CardTitle>
            <p className="text-sm text-zinc-500 mt-1">Top 5 clientes por saldo pendiente</p>
          </CardHeader>
          <CardContent className="p-0">
            {topDebtors.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <Users className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                <p>No hay clientes con deuda</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {topDebtors.map((debtor) => (
                  <div 
                    key={debtor.id}
                    className="p-4 hover:bg-zinc-50 transition-colors cursor-pointer flex items-center justify-between"
                    onClick={() => navigate(`/clientes/${debtor.document}`)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-zinc-900">{debtor.name}</p>
                        {getStatusBadge(debtor)}
                      </div>
                      <p className="text-sm text-zinc-500 mt-1">
                        {debtor.overdueDays > 0 
                          ? `${debtor.overdueDays} días de mora` 
                          : 'Sin mora'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-zinc-900">{formatCOP(debtor.totalDebt)}</p>
                      <ArrowRight className="w-4 h-4 text-zinc-400 ml-auto mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagos Recientes */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="border-b border-zinc-100">
            <CardTitle className="text-lg font-semibold text-zinc-900">Pagos Recientes</CardTitle>
            <p className="text-sm text-zinc-500 mt-1">Últimos abonos registrados</p>
          </CardHeader>
          <CardContent className="p-0">
            {recentPayments.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 text-zinc-300" />
                <p>No hay pagos registrados</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {recentPayments.map((payment) => (
                  <div 
                    key={payment.id}
                    className="p-4 hover:bg-zinc-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-lg">
                          {getPaymentIcon(payment.payment_method)}
                        </div>
                        <div>
                          <p className="font-medium text-zinc-900">{formatCOP(payment.amount)}</p>
                          <p className="text-sm text-zinc-500 capitalize">{payment.payment_method}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-zinc-600">
                          {new Date(payment.date).toLocaleDateString('es-CO')}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {new Date(payment.date).toLocaleTimeString('es-CO', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </p>
                      </div>
                    </div>
                    {payment.notes && (
                      <p className="text-sm text-zinc-500 mt-2 ml-13">{payment.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
