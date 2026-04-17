import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  X,
  User,
  Smartphone,
  Wrench,
  Package,
  Clock,
  DollarSign,
  LinkIcon,
  Copy,
  Check,
  CheckCircle,
  Save,
  Plus,
  Trash2,
  Printer,
} from 'lucide-react';
import {
  updateServiceOrder,
  addServiceOrderTimeline,
  getServiceOrderTimeline,
  getServiceOrderParts,
  addServiceOrderPart,
  deleteServiceOrderPart,
  type ServiceOrder,
  type Technician,
  type ServiceOrderTimeline,
  type ServiceOrderPart,
  getStatusLabel,
  getPriorityLabel,
  getPaymentStatusLabel,
} from '../lib/service-orders';
import { formatCOP } from '../lib/currency';
import { getCurrentUser, extractColombiaDateTime, getColombiaTimestampISO } from '../lib/supabase';
import { toast } from 'sonner';
import { ThermalServiceReceipt } from './ThermalServiceReceipt';

interface ServiceOrderDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: ServiceOrder;
  technicians: Technician[];
  onUpdate: () => void;
}

const STATUS_OPTIONS: Array<{ value: ServiceOrder['status']; label: string; color: string }> = [
  { value: 'received', label: 'Recibido', color: 'bg-slate-500' },
  { value: 'diagnosis', label: 'Diagnóstico', color: 'bg-purple-500' },
  { value: 'repairing', label: 'En reparación', color: 'bg-blue-500' },
  { value: 'waiting_parts', label: 'Esperando repuesto', color: 'bg-yellow-500' },
  { value: 'ready', label: 'Listo', color: 'bg-green-500' },
  { value: 'delivered', label: 'Entregado', color: 'bg-gray-500' },
  { value: 'cancelled', label: 'Cancelado', color: 'bg-red-500' },
];

export function ServiceOrderDetailDialog({
  open,
  onOpenChange,
  order: initialOrder,
  technicians,
  onUpdate,
}: ServiceOrderDetailDialogProps) {
  const [order, setOrder] = useState(initialOrder);
  const [timeline, setTimeline] = useState<ServiceOrderTimeline[]>([]);
  const [parts, setParts] = useState<ServiceOrderPart[]>([]);
  
  const [diagnosis, setDiagnosis] = useState(order.diagnosis || '');
  const [repairDetails, setRepairDetails] = useState(order.repair_details || '');
  const [internalNotes, setInternalNotes] = useState(order.internal_notes || '');
  const [finalPrice, setFinalPrice] = useState(order.final_price?.toString() || '');
  const [paidAmount, setPaidAmount] = useState(order.paid_amount?.toString() || '');
  
  const [newNote, setNewNote] = useState('');
  const [newPartName, setNewPartName] = useState('');
  const [newPartQuantity, setNewPartQuantity] = useState('1');
  const [newPartPrice, setNewPartPrice] = useState('');
  
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<'reception' | 'delivery'>('reception');

  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const currentUser = getCurrentUser();

  useEffect(() => {
    if (open) {
      loadTimeline();
      loadParts();
    }
  }, [open, order.id]);

  useEffect(() => {
    setOrder(initialOrder);
    setDiagnosis(initialOrder.diagnosis || '');
    setRepairDetails(initialOrder.repair_details || '');
    setInternalNotes(initialOrder.internal_notes || '');
    setFinalPrice(initialOrder.final_price?.toString() || '');
    setPaidAmount(initialOrder.paid_amount?.toString() || '0');
  }, [initialOrder]);

  const loadTimeline = async () => {
    const data = await getServiceOrderTimeline(order.id);
    setTimeline(data);
  };

  const loadParts = async () => {
    const data = await getServiceOrderParts(order.id);
    setParts(data);
  };

  const handleStatusChange = async (newStatus: ServiceOrder['status']) => {
    const updated = await updateServiceOrder(order.id, { status: newStatus });
    if (updated) {
      setOrder(updated);
      await loadTimeline();
      toast.success(`Estado actualizado a: ${getStatusLabel(newStatus)}`);
      onUpdate();
    } else {
      toast.error('Error al actualizar el estado');
    }
  };

  const handleTechnicianChange = async (technicianId: string) => {
    const updated = await updateServiceOrder(order.id, { 
      technician_id: technicianId && technicianId !== 'none' ? technicianId : undefined 
    });
    if (updated) {
      setOrder(updated);
      toast.success('Técnico asignado');
      onUpdate();
    }
  };

  const handlePriorityChange = async (priority: ServiceOrder['priority']) => {
    const updated = await updateServiceOrder(order.id, { priority });
    if (updated) {
      setOrder(updated);
      toast.success('Prioridad actualizada');
      onUpdate();
    }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try {
      const updates: Partial<ServiceOrder> = {
        diagnosis: diagnosis || undefined,
        repair_details: repairDetails || undefined,
        internal_notes: internalNotes || undefined,
        final_price: finalPrice ? parseFloat(finalPrice) : undefined,
        paid_amount: paidAmount ? parseFloat(paidAmount) : 0,
      };

      // Actualizar payment_status basado en los montos
      if (finalPrice && paidAmount) {
        const final = parseFloat(finalPrice);
        const paid = parseFloat(paidAmount);
        if (paid >= final) {
          updates.payment_status = 'paid';
        } else if (paid > 0) {
          updates.payment_status = 'partial';
        } else {
          updates.payment_status = 'pending';
        }
      }

      const updated = await updateServiceOrder(order.id, updates);
      if (updated) {
        setOrder(updated);
        toast.success('Detalles guardados exitosamente');
        onUpdate();
      }
    } catch (error) {
      toast.error('Error al guardar los detalles');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;

    const timeline = await addServiceOrderTimeline({
      service_order_id: order.id,
      event_type: 'note',
      description: newNote,
      created_by: currentUser?.username,
    });

    if (timeline) {
      setNewNote('');
      await loadTimeline();
      toast.success('Nota agregada');
    }
  };

  const handleAddPart = async () => {
    if (!newPartName.trim() || !newPartPrice) {
      toast.error('Completa los campos del repuesto');
      return;
    }

    const quantity = parseInt(newPartQuantity);
    const unitPrice = parseFloat(newPartPrice);

    const part = await addServiceOrderPart({
      service_order_id: order.id,
      part_name: newPartName,
      quantity,
      unit_price: unitPrice,
      total_price: quantity * unitPrice,
    });

    if (part) {
      setNewPartName('');
      setNewPartQuantity('1');
      setNewPartPrice('');
      await loadParts();
      await loadTimeline();
      toast.success('Repuesto agregado');
    }
  };

  const handleDeletePart = async (partId: string) => {
    if (!confirm('¿Eliminar este repuesto?')) return;

    const success = await deleteServiceOrderPart(partId);
    if (success) {
      await loadParts();
      toast.success('Repuesto eliminado');
    }
  };

  const handleCopyTrackingLink = () => {
    if (order.tracking_code) {
      const link = `${window.location.origin}/seguimiento/${order.tracking_code}`;
      
      // Crear elemento temporal para copiar
      const textArea = document.createElement('textarea');
      textArea.value = link;
      textArea.style.position = 'fixed';
      textArea.style.top = '0';
      textArea.style.left = '0';
      textArea.style.width = '2em';
      textArea.style.height = '2em';
      textArea.style.padding = '0';
      textArea.style.border = 'none';
      textArea.style.outline = 'none';
      textArea.style.boxShadow = 'none';
      textArea.style.background = 'transparent';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast.success('Enlace copiado al portapapeles');
        } else {
          toast.error('No se pudo copiar el enlace');
        }
      } catch (err) {
        console.error('Error copying:', err);
        toast.error('No se pudo copiar el enlace');
      } finally {
        document.body.removeChild(textArea);
      }
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm('¿Estás seguro de cancelar esta orden de servicio técnico? Esta acción no se puede deshacer.')) return;

    const updated = await updateServiceOrder(order.id, {
      status: 'cancelled',
    });

    if (updated) {
      setOrder(updated);
      await loadTimeline();
      onUpdate();
      toast.success('Orden cancelada');
    }
  };

  const handleMarkAsDelivered = async () => {
    if (!confirm('¿Marcar esta orden como entregada?')) return;

    const updated = await updateServiceOrder(order.id, {
      status: 'delivered',
      actual_delivery_date: getColombiaTimestampISO(), // CORREGIDO: Usar timestamp en hora de Colombia
    });

    if (updated) {
      setOrder(updated);
      await loadTimeline();
      toast.success('Orden marcada como entregada');
      onUpdate();
    }
  };

  const handlePrintReceipt = (type: 'reception' | 'delivery') => {
    setReceiptType(type);
    setIsPrintDialogOpen(true);

    setTimeout(() => {
      if (!thermalPrintRef.current) return;

      const printFrame = document.createElement('iframe');
      printFrame.style.position = 'absolute';
      printFrame.style.width = '0';
      printFrame.style.height = '0';
      printFrame.style.border = 'none';

      document.body.appendChild(printFrame);

      const printDocument = printFrame.contentWindow?.document;
      if (!printDocument) return;

      printDocument.open();
      printDocument.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Comprobante de ${type === 'reception' ? 'Recepción' : 'Entrega'}</title>
          </head>
          <body>
            ${thermalPrintRef.current.innerHTML}
          </body>
        </html>
      `);
      printDocument.close();

      setTimeout(() => {
        printFrame.contentWindow?.print();
        setTimeout(() => {
          document.body.removeChild(printFrame);
          setIsPrintDialogOpen(false);
        }, 100);
      }, 500);
    }, 300);
  };

  const technician = technicians.find(t => t.id === order.technician_id);
  const totalPartsCost = parts.reduce((sum, p) => sum + p.total_price, 0);

  const currentStatusOption = STATUS_OPTIONS.find(s => s.value === order.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {order.order_number}
              </span>
              <Badge className={`${currentStatusOption?.color} text-white`}>
                {getStatusLabel(order.status)}
              </Badge>
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Izquierda - Información Principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Información General */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-5 w-5 text-blue-600" />
                  Información del Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Nombre:</span>
                    <p className="font-semibold">{order.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Teléfono:</span>
                    <p className="font-semibold">{order.customer_phone}</p>
                  </div>
                  {order.customer_email && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-semibold">{order.customer_email}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Información del Dispositivo */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-blue-600" />
                  Dispositivo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Marca:</span>
                    <p className="font-semibold">{order.device_brand}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Modelo:</span>
                    <p className="font-semibold">{order.device_model}</p>
                  </div>
                  {order.device_imei && (
                    <div>
                      <span className="text-muted-foreground">IMEI:</span>
                      <p className="font-mono text-xs">{order.device_imei}</p>
                    </div>
                  )}
                  {order.device_serial && (
                    <div>
                      <span className="text-muted-foreground">Serial:</span>
                      <p className="font-mono text-xs">{order.device_serial}</p>
                    </div>
                  )}
                  {order.device_password && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Contraseña:</span>
                      <p className="font-mono font-semibold">{order.device_password}</p>
                    </div>
                  )}
                </div>
                
                <div className="pt-3 border-t">
                  <span className="text-muted-foreground text-sm">Problema Reportado:</span>
                  <p className="mt-1 text-sm">{order.reported_problem}</p>
                </div>
                
                {order.observations && (
                  <div className="pt-3 border-t">
                    <span className="text-muted-foreground text-sm">Observaciones:</span>
                    <p className="mt-1 text-sm">{order.observations}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Gestión Técnica */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-5 w-5 text-blue-600" />
                  Gestión Técnica
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="diagnosis">Diagnóstico</Label>
                  <Textarea
                    id="diagnosis"
                    value={diagnosis}
                    onChange={(e) => setDiagnosis(e.target.value)}
                    placeholder="Describe el diagnóstico técnico..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="repairDetails">Detalles de la Reparación</Label>
                  <Textarea
                    id="repairDetails"
                    value={repairDetails}
                    onChange={(e) => setRepairDetails(e.target.value)}
                    placeholder="Describe el trabajo realizado..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="internalNotes">Notas Internas</Label>
                  <Textarea
                    id="internalNotes"
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Notas privadas del técnico..."
                    rows={2}
                  />
                </div>

                <Button onClick={handleSaveDetails} disabled={saving} className="w-full">
                  {saving ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Guardar Detalles
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Repuestos Utilizados */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" />
                  Repuestos Utilizados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Lista de repuestos */}
                {parts.length > 0 && (
                  <div className="space-y-2">
                    {parts.map((part) => (
                      <div
                        key={part.id}
                        className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-semibold text-sm">{part.part_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {part.quantity} x COP {formatCOP(part.unit_price)} = COP {formatCOP(part.total_price)}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePart(part.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    ))}
                    <div className="pt-2 border-t">
                      <p className="text-sm font-semibold text-right">
                        Total Repuestos: COP {formatCOP(totalPartsCost)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Agregar repuesto */}
                <div className="pt-4 border-t space-y-3">
                  <Label>Agregar Repuesto</Label>
                  <div className="grid grid-cols-12 gap-2">
                    <Input
                      placeholder="Nombre del repuesto"
                      value={newPartName}
                      onChange={(e) => setNewPartName(e.target.value)}
                      className="col-span-6"
                    />
                    <Input
                      type="number"
                      placeholder="Cant."
                      value={newPartQuantity}
                      onChange={(e) => setNewPartQuantity(e.target.value)}
                      min="1"
                      className="col-span-2"
                    />
                    <Input
                      type="number"
                      placeholder="Precio"
                      value={newPartPrice}
                      onChange={(e) => setNewPartPrice(e.target.value)}
                      min="0"
                      className="col-span-3"
                    />
                    <Button
                      onClick={handleAddPart}
                      size="sm"
                      className="col-span-1"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Timeline */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  Historial
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Agregar nota */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Agregar una nota..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddNote()}
                  />
                  <Button onClick={handleAddNote} size="sm">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                {/* Timeline */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {timeline.map((event) => (
                    <div
                      key={event.id}
                      className="flex gap-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm">{event.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {event.created_by} • {extractColombiaDateTime(event.created_at!)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Columna Derecha - Acciones y Costos */}
          <div className="space-y-6">
            {/* Estado */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estado de la Orden</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Cambiar Estado</Label>
                  <Select
                    value={order.status}
                    onValueChange={(v: any) => handleStatusChange(v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Barra de progreso */}
                <div className="space-y-2">
                  {STATUS_OPTIONS.slice(0, -1).map((status, index) => (
                    <div
                      key={status.value}
                      className={`flex items-center gap-2 text-xs ${
                        STATUS_OPTIONS.findIndex(s => s.value === order.status) >= index
                          ? 'text-blue-600 font-semibold'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {STATUS_OPTIONS.findIndex(s => s.value === order.status) >= index ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-current" />
                      )}
                      <span>{status.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Asignación */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Asignación</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Técnico</Label>
                  <Select
                    value={order.technician_id || 'none'}
                    onValueChange={handleTechnicianChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin asignar" />
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
                  <Label>Prioridad</Label>
                  <Select
                    value={order.priority}
                    onValueChange={(v: any) => handlePriorityChange(v)}
                  >
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
              </CardContent>
            </Card>

            {/* Costos */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  Costos y Pago
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {order.estimated_price && (
                  <div>
                    <span className="text-xs text-muted-foreground">Precio Estimado</span>
                    <p className="text-lg font-semibold">
                      COP {formatCOP(order.estimated_price)}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="finalPrice">Precio Final</Label>
                  <Input
                    id="finalPrice"
                    type="number"
                    value={finalPrice}
                    onChange={(e) => setFinalPrice(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div>
                  <Label htmlFor="paidAmount">Monto Pagado</Label>
                  <Input
                    id="paidAmount"
                    type="number"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Estado de Pago</span>
                    <Badge
                      variant={
                        order.payment_status === 'paid'
                          ? 'default'
                          : order.payment_status === 'partial'
                          ? 'secondary'
                          : 'outline'
                      }
                    >
                      {getPaymentStatusLabel(order.payment_status)}
                    </Badge>
                  </div>
                  {order.final_price && (
                    <div className="flex items-center justify-between text-sm mt-2">
                      <span className="text-muted-foreground">Saldo Pendiente</span>
                      <span className="font-semibold">
                        COP {formatCOP(order.final_price - (order.paid_amount || 0))}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Enlace de Seguimiento e Impresión */}
            {order.tracking_code && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-blue-600" />
                    Seguimiento e Impresión
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleCopyTrackingLink}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Enlace
                      </>
                    )}
                  </Button>

                  {/* Botones de Impresión */}
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintReceipt('reception')}
                      className="text-xs"
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Recepción
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePrintReceipt('delivery')}
                      className="text-xs"
                    >
                      <Printer className="h-3 w-3 mr-1" />
                      Entrega
                    </Button>
                  </div>

                  <div className="mt-3 p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700">
                    <p className="text-xs text-muted-foreground mb-1">Enlace de seguimiento:</p>
                    <a
                      href={`/seguimiento/${order.tracking_code}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline break-all"
                    >
                      {`${window.location.origin}/seguimiento/${order.tracking_code}`}
                    </a>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Código: {order.tracking_code}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Acciones */}
            {order.status !== 'delivered' && order.status !== 'cancelled' && (
              <div className="space-y-2">
                <Button
                  onClick={handleMarkAsDelivered}
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar como Entregado
                </Button>

                <Button
                  onClick={handleCancelOrder}
                  variant="destructive"
                  className="w-full"
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancelar Orden
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Diálogo de Impresión Térmica */}
      <Dialog open={isPrintDialogOpen} onOpenChange={setIsPrintDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Comprobante de {receiptType === 'reception' ? 'Recepción' : 'Entrega'}
            </DialogTitle>
            <DialogDescription>
              Preparando impresión...
            </DialogDescription>
          </DialogHeader>
          <div ref={thermalPrintRef}>
            <ThermalServiceReceipt
              order={order}
              technician={technician}
              receiptType={receiptType}
            />
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}