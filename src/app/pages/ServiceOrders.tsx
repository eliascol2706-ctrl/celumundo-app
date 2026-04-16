import { useState, useEffect } from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import {
  Plus,
  Search,
  Filter,
  User,
  Smartphone,
  AlertCircle,
  DollarSign,
  Clock,
  Eye,
  MoreVertical,
  Settings,
  Users,
  History,
  TrendingUp
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';
import {
  getServiceOrders,
  updateServiceOrder,
  getTechnicians,
  getServiceOrdersStats,
  type ServiceOrder,
  type Technician,
  getStatusLabel,
  getPriorityLabel,
} from '../lib/service-orders';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { CreateServiceOrderDialog } from '../components/CreateServiceOrderDialog';
import { ServiceOrderDetailDialog } from '../components/ServiceOrderDetailDialog';
import { TechniciansDialog } from '../components/TechniciansDialog';
import { getCurrentCompany } from '../lib/supabase';

const COLUMNS = [
  { id: 'received', label: 'Recibido', color: 'bg-slate-100 dark:bg-slate-900' },
  { id: 'diagnosis', label: 'Diagnóstico', color: 'bg-purple-50 dark:bg-purple-950' },
  { id: 'repairing', label: 'En reparación', color: 'bg-blue-50 dark:bg-blue-950' },
  { id: 'waiting_parts', label: 'Esperando repuesto', color: 'bg-yellow-50 dark:bg-yellow-950' },
  { id: 'ready', label: 'Listo', color: 'bg-green-50 dark:bg-green-950' },
  { id: 'delivered', label: 'Entregado', color: 'bg-gray-100 dark:bg-gray-900' },
];

interface OrderCardProps {
  order: ServiceOrder;
  technicians: Technician[];
  onView: (order: ServiceOrder) => void;
}

const ItemType = 'ORDER_CARD';

function OrderCard({ order, technicians, onView }: OrderCardProps) {
  const [{ isDragging }, drag] = useDrag({
    type: ItemType,
    item: { order },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const technician = technicians.find(t => t.id === order.technician_id);

  const priorityColors = {
    low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  };

  return (
    <div
      ref={drag}
      className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-3 cursor-move hover:shadow-md transition-all ${
        isDragging ? 'opacity-50' : ''
      }`}
      onClick={() => onView(order)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {order.order_number}
            </span>
            <Badge className={`text-xs px-2 py-0.5 ${priorityColors[order.priority]}`}>
              {getPriorityLabel(order.priority)}
            </Badge>
          </div>
          <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            {order.customer_name}
          </h4>
        </div>
      </div>

      {/* Device */}
      <div className="flex items-center gap-2 mb-3 text-sm text-slate-600 dark:text-slate-400">
        <Smartphone className="h-4 w-4 flex-shrink-0" />
        <span className="truncate">{order.device_brand} {order.device_model}</span>
      </div>

      {/* Problem */}
      <div className="flex items-start gap-2 mb-3">
        <AlertCircle className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
          {order.reported_problem}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {technician?.name || 'Sin asignar'}
          </span>
        </div>
        {order.estimated_price && (
          <div className="flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-blue-400">
            <DollarSign className="h-3.5 w-3.5" />
            <span>{formatCOP(order.estimated_price)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface ColumnProps {
  column: typeof COLUMNS[0];
  orders: ServiceOrder[];
  technicians: Technician[];
  onDrop: (orderId: string, newStatus: ServiceOrder['status']) => void;
  onView: (order: ServiceOrder) => void;
}

function Column({ column, orders, technicians, onDrop, onView }: ColumnProps) {
  const [{ isOver }, drop] = useDrop({
    accept: ItemType,
    drop: (item: { order: ServiceOrder }) => {
      if (item.order.status !== column.id) {
        onDrop(item.order.id, column.id as ServiceOrder['status']);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div className="flex-shrink-0 w-80">
      <div className={`rounded-lg ${column.color} p-4`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
            {column.label}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {orders.length}
          </Badge>
        </div>

        <div
          ref={drop}
          className={`min-h-[500px] ${
            isOver ? 'bg-blue-100/50 dark:bg-blue-900/20 rounded-lg' : ''
          }`}
        >
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              technicians={technicians}
              onView={onView}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ServiceOrders() {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<ServiceOrder | null>(null);
  const [showTechniciansDialog, setShowTechniciansDialog] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const company = getCurrentCompany();

  // Verificar que sea REPUESTOS VIP
  if (company !== 'repuestos') {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-600">
              <AlertCircle className="h-5 w-5" />
              Módulo no disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              El módulo de Servicio Técnico está disponible únicamente para <strong>REPUESTOS VIP</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const loadData = async () => {
    setLoading(true);
    try {
      const [ordersData, techniciansData, statsData] = await Promise.all([
        getServiceOrders(),
        getTechnicians(),
        getServiceOrdersStats(),
      ]);
      setOrders(ordersData);
      setTechnicians(techniciansData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDrop = async (orderId: string, newStatus: ServiceOrder['status']) => {
    try {
      const updatedOrder = await updateServiceOrder(orderId, { status: newStatus });
      if (updatedOrder) {
        setOrders(prev =>
          prev.map(o => (o.id === orderId ? updatedOrder : o))
        );
        toast.success(`Orden movida a: ${getStatusLabel(newStatus)}`);
      } else {
        toast.error('Error al actualizar el estado');
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Error al actualizar el estado');
    }
  };

  const handleOrderCreated = async () => {
    setShowCreateDialog(false);
    await loadData();
    toast.success('Orden creada exitosamente');
  };

  const handleOrderUpdated = async () => {
    setSelectedOrder(null);
    await loadData();
  };

  const filteredOrders = orders.filter(order => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.customer_name.toLowerCase().includes(search) ||
      order.order_number.toLowerCase().includes(search) ||
      order.device_brand.toLowerCase().includes(search) ||
      order.device_model.toLowerCase().includes(search) ||
      order.customer_phone.includes(search)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-muted-foreground">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Servicio Técnico
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Gestión completa de órdenes de reparación
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTechniciansDialog(true)}
          >
            <Users className="h-4 w-4 mr-2" />
            Técnicos
          </Button>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva Orden
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Órdenes Activas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {stats.total - stats.byStatus.delivered - stats.byStatus.cancelled}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Ingresos Totales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                COP {formatCOP(stats.totalRevenue)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Pagos Pendientes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                COP {formatCOP(stats.pendingPayment)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Prioridad Alta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-600 dark:text-red-400">
                {stats.byPriority.high || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Buscar por cliente, orden, dispositivo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Kanban Board */}
      <DndProvider backend={HTML5Backend}>
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4">
            {COLUMNS.map((column) => (
              <Column
                key={column.id}
                column={column}
                orders={filteredOrders.filter(
                  (o) => o.status === column.id
                )}
                technicians={technicians}
                onDrop={handleDrop}
                onView={setSelectedOrder}
              />
            ))}
          </div>
        </div>
      </DndProvider>

      {/* Dialogs */}
      <CreateServiceOrderDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        technicians={technicians}
        onSuccess={handleOrderCreated}
      />

      {selectedOrder && (
        <ServiceOrderDetailDialog
          open={!!selectedOrder}
          onOpenChange={(open) => !open && setSelectedOrder(null)}
          order={selectedOrder}
          technicians={technicians}
          onUpdate={handleOrderUpdated}
        />
      )}

      <TechniciansDialog
        open={showTechniciansDialog}
        onOpenChange={setShowTechniciansDialog}
        onUpdate={loadData}
      />
    </div>
  );
}
