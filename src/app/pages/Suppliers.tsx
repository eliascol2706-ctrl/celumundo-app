import { useState, useEffect } from 'react';
import { Building2, Plus, Edit2, Trash2, Phone, Mail, MapPin, ChevronDown, ChevronRight, FileText, Shield, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import {
  getSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getCurrentCompany,
  supabase,
  type Supplier,
} from '../lib/supabase';

interface SupplierDebtRow {
  id: string;
  invoice_reference: string;
  total_amount: number;
  pending_amount: number;
  paid_amount: number;
  status: string;
  invoice_date: string;
}

interface WarrantyRow {
  id: string;
  warranty_number: string;
  product_name: string;
  product_id: string;
  quantity: number;
  status: string;
  date: string;
  unit_cost: number;
}

interface SupplierWithData extends Supplier {
  debts: SupplierDebtRow[];
  warranties: WarrantyRow[];
  expanded: boolean;
}

const emptyForm = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

export function Suppliers() {
  const [suppliers, setSuppliers] = useState<SupplierWithData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal crear/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const company = getCurrentCompany();
      const [suppliersData, { data: debtsData }, { data: warrantiesData }] = await Promise.all([
        getSuppliers(),
        supabase.from('supplier_debts').select('id,invoice_reference,total_amount,pending_amount,paid_amount,status,invoice_date,supplier_id').eq('company', company),
        supabase.from('warranties').select('id,warranty_number,product_name,product_id,quantity,status,date,supplier_id').eq('company', company),
      ]);

      // Fetch costs for products that appear in warranties
      const productIds = [...new Set((warrantiesData || []).map((w: any) => w.product_id).filter(Boolean))];
      let costMap: Record<string, number> = {};
      if (productIds.length > 0) {
        const { data: productsData } = await supabase
          .from('products')
          .select('id,current_cost')
          .in('id', productIds);
        (productsData || []).forEach((p: any) => { costMap[p.id] = p.current_cost || 0; });
      }

      const enriched: SupplierWithData[] = suppliersData.map(s => ({
        ...s,
        debts: (debtsData || []).filter((d: any) => d.supplier_id === s.id),
        warranties: (warrantiesData || [])
          .filter((w: any) => w.supplier_id === s.id)
          .map((w: any) => ({ ...w, unit_cost: costMap[w.product_id] || 0 })),
        expanded: false,
      }));

      setSuppliers(enriched);
    } catch (error) {
      console.error('Error loading suppliers:', error);
      toast.error('Error al cargar los proveedores');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const handleOpenEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('El nombre del proveedor es obligatorio');
      return;
    }
    setSaving(true);
    try {
      if (editingSupplier) {
        const result = await updateSupplier(editingSupplier.id, {
          name: form.name.trim(),
          contact_name: form.contact_name.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        if (!result) throw new Error('Update failed');
        toast.success('Proveedor actualizado');
      } else {
        const result = await addSupplier({
          name: form.name.trim(),
          contact_name: form.contact_name.trim() || undefined,
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          notes: form.notes.trim() || undefined,
        });
        if (!result) throw new Error('Insert failed');
        toast.success('Proveedor registrado');
      }
      setModalOpen(false);
      loadAll();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast.error('Error al guardar el proveedor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: SupplierWithData) => {
    const hasData = supplier.debts.length > 0 || supplier.warranties.length > 0;
    const msg = hasData
      ? `¿Eliminar a "${supplier.name}"? Tiene ${supplier.debts.length} factura(s) y ${supplier.warranties.length} garantía(s) asociadas. Esos registros quedarán sin proveedor.`
      : `¿Eliminar al proveedor "${supplier.name}"?`;

    if (!confirm(msg)) return;

    const ok = await deleteSupplier(supplier.id);
    if (ok) {
      toast.success('Proveedor eliminado');
      loadAll();
    } else {
      toast.error('Error al eliminar el proveedor');
    }
  };

  const toggleExpanded = (id: string) => {
    setSuppliers(prev => prev.map(s => s.id === id ? { ...s, expanded: !s.expanded } : s));
  };

  const statusDebtLabel: Record<string, string> = {
    active: 'Activa', paid: 'Pagada', overdue: 'Atrasada', cancelled: 'Anulada',
  };
  const statusWarrantyLabel: Record<string, string> = {
    pending: 'Pendiente', sent: 'Enviada', returned: 'Devuelta', resolved: 'Resuelta', cancelled: 'Cancelada',
  };

  const totalPendingAll = suppliers.reduce((sum, s) =>
    sum + s.debts.filter(d => d.status === 'active' || d.status === 'overdue').reduce((a, d) => a + d.pending_amount, 0), 0);
  const totalWarrantiesAll = suppliers.reduce((sum, s) => sum + s.warranties.length, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Cargando proveedores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Proveedores</h2>
          <p className="text-muted-foreground mt-1">Gestión de proveedores y sus deudas / garantías</p>
        </div>
        <Button onClick={handleOpenCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Proveedor
        </Button>
      </div>

      {/* Resumen global */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Proveedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{suppliers.length}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Deuda Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCOP(totalPendingAll)}</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Total Garantías
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{totalWarrantiesAll}</div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de proveedores */}
      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="font-medium">No hay proveedores registrados</p>
            <p className="text-sm mt-1">Crea el primero con el botón "Nuevo Proveedor"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {suppliers.map(supplier => {
            const activeDebts = supplier.debts.filter(d => d.status === 'active' || d.status === 'overdue');
            const totalPending = activeDebts.reduce((sum, d) => sum + d.pending_amount, 0);
            const totalDebt = supplier.debts.reduce((sum, d) => sum + d.total_amount, 0);
            const activeWarranties = supplier.warranties.filter(w => w.status !== 'cancelled' && w.status !== 'resolved');

            return (
              <Card key={supplier.id} className="overflow-hidden">
                {/* Cabecera del proveedor */}
                <div
                  className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => toggleExpanded(supplier.id)}
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-base">{supplier.name}</h3>
                      {supplier.contact_name && (
                        <span className="text-xs text-muted-foreground">· {supplier.contact_name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-0.5 flex-wrap">
                      {supplier.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" />{supplier.phone}
                        </span>
                      )}
                      {supplier.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />{supplier.email}
                        </span>
                      )}
                      {supplier.address && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />{supplier.address}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chips de resumen */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Deuda pendiente</p>
                      <p className={`text-sm font-bold ${totalPending > 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                        {formatCOP(totalPending)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Garantías activas</p>
                      <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{activeWarranties.length}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenEdit(supplier); }}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleDelete(supplier); }}
                        className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {supplier.expanded
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      }
                    </div>
                  </div>
                </div>

                {/* Detalle expandido */}
                {supplier.expanded && (
                  <div className="border-t border-border">
                    <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">

                      {/* Facturas/Deudas */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-500" />
                            Facturas ({supplier.debts.length})
                          </h4>
                          <div className="text-xs text-muted-foreground">
                            Total: <span className="font-semibold">{formatCOP(totalDebt)}</span>
                            {' · '}Pendiente: <span className="font-semibold text-red-600 dark:text-red-400">{formatCOP(totalPending)}</span>
                          </div>
                        </div>

                        {supplier.debts.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Sin facturas asociadas</p>
                        ) : (
                          <div className="space-y-1.5 max-h-52 overflow-y-auto">
                            {supplier.debts.map(debt => (
                              <div key={debt.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                                <div>
                                  <span className="font-mono font-semibold">{debt.invoice_reference}</span>
                                  <span className="text-muted-foreground ml-2">{new Date(debt.invoice_date).toLocaleDateString('es-ES')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge className={`text-xs px-1.5 py-0 ${
                                    debt.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                    : debt.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                                    : debt.status === 'overdue' ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                  }`}>
                                    {statusDebtLabel[debt.status] || debt.status}
                                  </Badge>
                                  <span className={`font-semibold ${debt.pending_amount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600'}`}>
                                    {formatCOP(debt.pending_amount)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Garantías */}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold flex items-center gap-2">
                            <Shield className="h-4 w-4 text-amber-500" />
                            Garantías ({supplier.warranties.length})
                          </h4>
                          <div className="text-xs text-muted-foreground text-right">
                            <div>Activas: <span className="font-semibold text-amber-600 dark:text-amber-400">{activeWarranties.length}</span></div>
                          </div>
                        </div>

                        {supplier.warranties.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">Sin garantías asociadas</p>
                        ) : (
                          <>
                            <div className="space-y-1.5 max-h-52 overflow-y-auto">
                              {supplier.warranties.map(warranty => {
                                const totalCost = warranty.unit_cost * warranty.quantity;
                                return (
                                  <div key={warranty.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/50">
                                    <div>
                                      <span className="font-mono font-semibold">{warranty.warranty_number}</span>
                                      <span className="text-muted-foreground ml-2">{warranty.product_name}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge className={`text-xs px-1.5 py-0 ${
                                        warranty.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400'
                                        : warranty.status === 'sent' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
                                        : warranty.status === 'returned' ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                                        : warranty.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400'
                                        : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                                      }`}>
                                        {statusWarrantyLabel[warranty.status] || warranty.status}
                                      </Badge>
                                      <span className="text-muted-foreground">×{warranty.quantity}</span>
                                      {totalCost > 0 && (
                                        <span className="font-semibold text-amber-700 dark:text-amber-400">
                                          {formatCOP(totalCost)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Total costo garantías */}
                            {(() => {
                              const totalWarrantyCost = supplier.warranties.reduce(
                                (sum, w) => sum + w.unit_cost * w.quantity, 0
                              );
                              const activeWarrantyCost = activeWarranties.reduce(
                                (sum, w) => sum + w.unit_cost * w.quantity, 0
                              );
                              return (
                                <div className="pt-2 border-t border-border space-y-1">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Costo activas ({activeWarranties.length}):</span>
                                    <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCOP(activeWarrantyCost)}</span>
                                  </div>
                                  <div className="flex justify-between text-xs font-semibold">
                                    <span>Costo total ({supplier.warranties.length}):</span>
                                    <span className="text-amber-700 dark:text-amber-300">{formatCOP(totalWarrantyCost)}</span>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
            </DialogTitle>
            <DialogDescription>
              {editingSupplier ? 'Modifica los datos del proveedor' : 'Registra un nuevo proveedor'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Nombre *</Label>
              <Input
                placeholder="Nombre del proveedor"
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Contacto</Label>
              <Input
                placeholder="Nombre de la persona de contacto"
                value={form.contact_name}
                onChange={e => setForm(prev => ({ ...prev, contact_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Teléfono</Label>
                <Input
                  placeholder="Número de teléfono"
                  value={form.phone}
                  onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={form.email}
                  onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Dirección</Label>
              <Input
                placeholder="Dirección"
                value={form.address}
                onChange={e => setForm(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Notas</Label>
              <Input
                placeholder="Observaciones adicionales"
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : editingSupplier ? 'Actualizar' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
