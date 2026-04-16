import { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, User, Phone, Mail, CheckCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Card, CardContent } from './ui/card';
import {
  getTechnicians,
  addTechnician,
  updateTechnician,
  deleteTechnician,
  type Technician,
} from '../lib/service-orders';
import { toast } from 'sonner';

interface TechniciansDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function TechniciansDialog({
  open,
  onOpenChange,
  onUpdate,
}: TechniciansDialogProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Technician['status']>('active');

  useEffect(() => {
    if (open) {
      loadTechnicians();
    }
  }, [open]);

  const loadTechnicians = async () => {
    setLoading(true);
    try {
      const data = await getTechnicians();
      setTechnicians(data);
    } catch (error) {
      console.error('Error loading technicians:', error);
      toast.error('Error al cargar los técnicos');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    try {
      if (editingId) {
        // Actualizar
        const updated = await updateTechnician(editingId, {
          name,
          phone: phone || undefined,
          email: email || undefined,
          status,
        });

        if (updated) {
          toast.success('Técnico actualizado');
          resetForm();
          await loadTechnicians();
          onUpdate();
        }
      } else {
        // Crear nuevo
        const technician = await addTechnician({
          name,
          phone: phone || undefined,
          email: email || undefined,
          status,
        });

        if (technician) {
          toast.success('Técnico creado exitosamente');
          resetForm();
          await loadTechnicians();
          onUpdate();
        }
      }
    } catch (error) {
      console.error('Error saving technician:', error);
      toast.error('Error al guardar el técnico');
    }
  };

  const handleEdit = (tech: Technician) => {
    setEditingId(tech.id);
    setName(tech.name);
    setPhone(tech.phone || '');
    setEmail(tech.email || '');
    setStatus(tech.status);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este técnico?')) return;

    try {
      const success = await deleteTechnician(id);
      if (success) {
        toast.success('Técnico eliminado');
        await loadTechnicians();
        onUpdate();
      }
    } catch (error) {
      console.error('Error deleting technician:', error);
      toast.error('Error al eliminar el técnico');
    }
  };

  const handleToggleStatus = async (tech: Technician) => {
    const newStatus = tech.status === 'active' ? 'inactive' : 'active';
    const updated = await updateTechnician(tech.id, { status: newStatus });
    
    if (updated) {
      toast.success(`Técnico ${newStatus === 'active' ? 'activado' : 'desactivado'}`);
      await loadTechnicians();
      onUpdate();
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setStatus('active');
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <User className="h-5 w-5" />
            Gestión de Técnicos
          </DialogTitle>
          <DialogDescription>
            Administra el equipo de técnicos de servicio
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Botón para mostrar formulario */}
          {!showForm && (
            <Button
              onClick={() => setShowForm(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Agregar Técnico
            </Button>
          )}

          {/* Formulario */}
          {showForm && (
            <Card className="bg-blue-50 dark:bg-blue-950">
              <CardContent className="pt-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">
                      {editingId ? 'Editar Técnico' : 'Nuevo Técnico'}
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={resetForm}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <Label htmlFor="name">
                      Nombre <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Nombre completo"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+57 300 123 4567"
                      />
                    </div>

                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tecnico@email.com"
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Estado</Label>
                    <div className="flex gap-4 mt-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value="active"
                          checked={status === 'active'}
                          onChange={() => setStatus('active')}
                        />
                        <span className="text-sm">Activo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="status"
                          value="inactive"
                          checked={status === 'inactive'}
                          onChange={() => setStatus('inactive')}
                        />
                        <span className="text-sm">Inactivo</span>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {editingId ? 'Actualizar' : 'Crear'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resetForm}
                    >
                      Cancelar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Lista de técnicos */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {technicians.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No hay técnicos registrados</p>
                </div>
              ) : (
                technicians.map((tech) => (
                  <Card key={tech.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{tech.name}</h4>
                            <Badge
                              variant={tech.status === 'active' ? 'default' : 'secondary'}
                              className={
                                tech.status === 'active'
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                              }
                            >
                              {tech.status === 'active' ? (
                                <>
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Activo
                                </>
                              ) : (
                                <>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Inactivo
                                </>
                              )}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-sm text-muted-foreground">
                            {tech.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5" />
                                <span>{tech.phone}</span>
                              </div>
                            )}
                            {tech.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5" />
                                <span>{tech.email}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(tech)}
                            title={
                              tech.status === 'active' ? 'Desactivar' : 'Activar'
                            }
                          >
                            {tech.status === 'active' ? (
                              <XCircle className="h-4 w-4 text-gray-600" />
                            ) : (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(tech)}
                          >
                            <Edit2 className="h-4 w-4 text-blue-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(tech.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
