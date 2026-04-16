import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  Smartphone, 
  User, 
  Clock, 
  CheckCircle, 
  Package,
  AlertCircle 
} from 'lucide-react';
import { 
  getServiceOrderByTrackingCode, 
  getServiceOrderTimeline,
  type ServiceOrder,
  type ServiceOrderTimeline,
  getStatusLabel,
  getPriorityLabel 
} from '../lib/service-orders';
import { extractColombiaDateTime } from '../lib/supabase';

const STATUS_OPTIONS = [
  { value: 'received', label: 'Recibido', color: 'bg-slate-500', icon: Package },
  { value: 'diagnosis', label: 'Diagnóstico', color: 'bg-purple-500', icon: AlertCircle },
  { value: 'repairing', label: 'En reparación', color: 'bg-blue-500', icon: Package },
  { value: 'waiting_parts', label: 'Esperando repuesto', color: 'bg-yellow-500', icon: Clock },
  { value: 'ready', label: 'Listo', color: 'bg-green-500', icon: CheckCircle },
  { value: 'delivered', label: 'Entregado', color: 'bg-gray-500', icon: CheckCircle },
];

export default function TrackingPage() {
  const { trackingCode } = useParams<{ trackingCode: string }>();
  const [order, setOrder] = useState<ServiceOrder | null>(null);
  const [timeline, setTimeline] = useState<ServiceOrderTimeline[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [trackingCode]);

  const loadOrder = async () => {
    if (!trackingCode) return;

    setLoading(true);
    try {
      const orderData = await getServiceOrderByTrackingCode(trackingCode);
      if (orderData) {
        setOrder(orderData);
        const timelineData = await getServiceOrderTimeline(orderData.id);
        // Filtrar solo eventos públicos (no notas internas)
        const publicTimeline = timelineData.filter(
          event => event.event_type !== 'note'
        );
        setTimeline(publicTimeline);
        setNotFound(false);
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.error('Error loading order:', error);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-green-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Cargando información...</p>
        </div>
      </div>
    );
  }

  if (notFound || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Orden no encontrada</h2>
            <p className="text-muted-foreground">
              No se encontró ninguna orden con el código: <strong>{trackingCode}</strong>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatusIndex = STATUS_OPTIONS.findIndex(s => s.value === order.status);
  const currentStatus = STATUS_OPTIONS.find(s => s.value === order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Seguimiento de Orden
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Código: <span className="font-mono font-semibold">{trackingCode}</span>
          </p>
        </div>

        {/* Información General */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{order.order_number}</CardTitle>
              <Badge className={`${currentStatus?.color} text-white text-base px-3 py-1`}>
                {getStatusLabel(order.status)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Smartphone className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Dispositivo</p>
                  <p className="font-semibold">{order.device_brand} {order.device_model}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 mt-1" />
                <div>
                  <p className="text-sm text-muted-foreground">Fecha de Recepción</p>
                  <p className="font-semibold">{extractColombiaDateTime(order.received_date)}</p>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <p className="text-sm text-muted-foreground mb-1">Problema Reportado</p>
              <p className="text-sm">{order.reported_problem}</p>
            </div>
          </CardContent>
        </Card>

        {/* Progreso */}
        <Card>
          <CardHeader>
            <CardTitle>Estado del Servicio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {STATUS_OPTIONS.map((status, index) => {
                const Icon = status.icon;
                const isCompleted = index <= currentStatusIndex;
                const isCurrent = index === currentStatusIndex;

                return (
                  <div key={status.value} className="flex items-center gap-4">
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      isCompleted 
                        ? status.color + ' text-white' 
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className={`font-semibold ${
                        isCurrent ? 'text-blue-600 dark:text-blue-400' : ''
                      } ${
                        isCompleted ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'
                      }`}>
                        {status.label}
                      </p>
                    </div>
                    {isCompleted && (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Historial */}
        {timeline.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Historial de Actualizaciones</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {timeline.map((event) => (
                  <div
                    key={event.id}
                    className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium">{event.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {extractColombiaDateTime(event.created_at!)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>Para más información, contacta con nuestro servicio al cliente</p>
        </div>
      </div>
    </div>
  );
}
