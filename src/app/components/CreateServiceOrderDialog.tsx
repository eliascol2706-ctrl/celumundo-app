import { useState } from 'react';
import { X, Plus, Smartphone, User, AlertCircle, DollarSign, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { addServiceOrder, type Technician, type ServiceOrder } from '../lib/service-orders';
import { getColombiaDate } from '../lib/supabase';
import { toast } from 'sonner';

interface CreateServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technicians: Technician[];
  onSuccess: () => void;
}

export function CreateServiceOrderDialog({
  open,
  onOpenChange,
  technicians,
  onSuccess,
}: CreateServiceOrderDialogProps) {
  const [loading, setLoading] = useState(false);
  
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [deviceImei, setDeviceImei] = useState('');
  const [deviceSerial, setDeviceSerial] = useState('');
  const [devicePassword, setDevicePassword] = useState('');
  
  const [reportedProblem, setReportedProblem] = useState('');
  const [observations, setObservations] = useState('');
  
  const [technicianId, setTechnicianId] = useState<string>('');
  const [priority, setPriority] = useState<ServiceOrder['priority']>('medium');
  const [estimatedPrice, setEstimatedPrice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName || !customerPhone || !deviceBrand || !deviceModel || !reportedProblem) {
      toast.error('Por favor completa los campos requeridos');
      return;
    }

    setLoading(true);
    try {
      const order = await addServiceOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || undefined,
        device_brand: deviceBrand,
        device_model: deviceModel,
        device_imei: deviceImei || undefined,
        device_serial: deviceSerial || undefined,
        device_password: devicePassword || undefined,
        reported_problem: reportedProblem,
        observations: observations || undefined,
        status: 'received',
        priority,
        technician_id: technicianId && technicianId !== 'none' ? technicianId : undefined,
        estimated_price: estimatedPrice ? parseFloat(estimatedPrice) : undefined,
        payment_status: 'pending',
        paid_amount: 0,
        received_date: getColombiaDate(),
      });

      if (order) {
        // Reset form
        setCustomerName('');
        setCustomerPhone('');
        setCustomerEmail('');
        setDeviceBrand('');
        setDeviceModel('');
        setDeviceImei('');
        setDeviceSerial('');
        setDevicePassword('');
        setReportedProblem('');
        setObservations('');
        setTechnicianId('');
        setPriority('medium');
        setEstimatedPrice('');
        
        onSuccess();
      } else {
        toast.error('Error al crear la orden');
      }
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Error al crear la orden');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <Plus className="h-5 w-5" />
            Nueva Orden de Servicio
          </DialogTitle>
          <DialogDescription>
            Registra una nueva orden de reparación en el sistema
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Información del Cliente */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-lg">Información del Cliente</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="customerName">
                  Nombre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Nombre completo del cliente"
                  required
                />
              </div>

              <div>
                <Label htmlFor="customerPhone">
                  Teléfono <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="+57 300 123 4567"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="customerEmail">Email (opcional)</Label>
                <Input
                  id="customerEmail"
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="cliente@email.com"
                />
              </div>
            </div>
          </div>

          {/* Información del Dispositivo */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Smartphone className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-lg">Información del Dispositivo</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deviceBrand">
                  Marca <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deviceBrand"
                  value={deviceBrand}
                  onChange={(e) => setDeviceBrand(e.target.value)}
                  placeholder="Samsung, Apple, Xiaomi..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="deviceModel">
                  Modelo <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deviceModel"
                  value={deviceModel}
                  onChange={(e) => setDeviceModel(e.target.value)}
                  placeholder="Galaxy S21, iPhone 13..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="deviceImei">IMEI (opcional)</Label>
                <Input
                  id="deviceImei"
                  value={deviceImei}
                  onChange={(e) => setDeviceImei(e.target.value)}
                  placeholder="123456789012345"
                />
              </div>

              <div>
                <Label htmlFor="deviceSerial">Serial (opcional)</Label>
                <Input
                  id="deviceSerial"
                  value={deviceSerial}
                  onChange={(e) => setDeviceSerial(e.target.value)}
                  placeholder="Número de serie"
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="devicePassword">Contraseña del Equipo (opcional)</Label>
                <Input
                  id="devicePassword"
                  value={devicePassword}
                  onChange={(e) => setDevicePassword(e.target.value)}
                  placeholder="PIN, patrón, o contraseña"
                />
              </div>
            </div>
          </div>

          {/* Problema Reportado */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-lg">Descripción del Problema</h3>
            </div>

            <div>
              <Label htmlFor="reportedProblem">
                Problema Reportado <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reportedProblem"
                value={reportedProblem}
                onChange={(e) => setReportedProblem(e.target.value)}
                placeholder="Describe el problema reportado por el cliente..."
                rows={3}
                required
              />
            </div>

            <div>
              <Label htmlFor="observations">Observaciones Iniciales (opcional)</Label>
              <Textarea
                id="observations"
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Rayones, golpes, accesorios incluidos, etc..."
                rows={2}
              />
            </div>
          </div>

          {/* Asignación y Detalles */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="technician">Técnico Asignado</Label>
                <Select value={technicianId} onValueChange={setTechnicianId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {technicians
                      .filter(t => t.status === 'active')
                      .map((tech) => (
                        <SelectItem key={tech.id} value={tech.id}>
                          {tech.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="priority">Prioridad</Label>
                <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="estimatedPrice">Precio Estimado (COP)</Label>
                <Input
                  id="estimatedPrice"
                  type="number"
                  value={estimatedPrice}
                  onChange={(e) => setEstimatedPrice(e.target.value)}
                  placeholder="50000"
                  min="0"
                  step="1000"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {loading ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                  Creando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear Orden
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}