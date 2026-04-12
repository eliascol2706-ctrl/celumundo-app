import { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  User, 
  Phone, 
  Mail, 
  MapPin,
  CreditCard,
  TrendingUp,
  Calendar,
  FileText,
  DollarSign,
  BarChart3,
  Eye,
  Edit,
  Trash2
} from 'lucide-react';
import { 
  getCustomers, 
  addCustomer,
  updateCustomer,
  deleteCustomer,
  addCreditHistory,
  type Customer,
  getCurrentUser
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';
import { useNavigate } from 'react-router';
import { CreditDashboard } from './CreditDashboard';
import { Textarea } from '../components/ui/textarea';

type ViewMode = 'dashboard' | 'list';

export function CustomersNew() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [customerForm, setCustomerForm] = useState({
    name: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    credit_limit: '',
    payment_term: '30',
    notes: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    const data = await getCustomers();
    setCustomers(data);
  };

  const resetForm = () => {
    setCustomerForm({
      name: '',
      document: '',
      phone: '',
      email: '',
      address: '',
      credit_limit: '',
      payment_term: '30',
      notes: ''
    });
  };

  const handleAddCustomer = async () => {
    if (!customerForm.name || !customerForm.document) {
      toast.error('Complete los campos requeridos: Nombre y Documento');
      return;
    }

    const creditLimit = parseFloat(customerForm.credit_limit) || 0;
    const paymentTerm = parseInt(customerForm.payment_term) || 30;

    setIsSubmitting(true);
    const newCustomer: Omit<Customer, 'id' | 'company' | 'created_at' | 'updated_at'> = {
      name: customerForm.name,
      document: customerForm.document,
      phone: customerForm.phone || undefined,
      email: customerForm.email || undefined,
      address: customerForm.address || undefined,
      credit_limit: creditLimit,
      payment_term: paymentTerm,
      status: 'active',
      blocked: false,
      total_credit: 0,
      total_paid: 0,
      notes: customerForm.notes || undefined
    };

    const result = await addCustomer(newCustomer);
    if (result) {
      // Registrar en historial
      await addCreditHistory({
        customer_document: result.document,
        event_type: 'note',
        description: 'Cliente registrado en el sistema',
        registered_by: getCurrentUser()?.username || 'Sistema'
      });

      if (creditLimit > 0) {
        await addCreditHistory({
          customer_document: result.document,
          event_type: 'credit_limit_change',
          description: `Cupo de crédito asignado: ${formatCOP(creditLimit)}`,
          amount: creditLimit,
          registered_by: getCurrentUser()?.username || 'Sistema'
        });
      }

      toast.success('Cliente registrado exitosamente');
      setIsAddDialogOpen(false);
      resetForm();
      loadCustomers();
    } else {
      toast.error('Error al registrar el cliente');
    }
    setIsSubmitting(false);
  };

  const handleEditCustomer = async () => {
    if (!selectedCustomer) return;

    if (!customerForm.name || !customerForm.document) {
      toast.error('Complete los campos requeridos: Nombre y Documento');
      return;
    }

    const creditLimit = parseFloat(customerForm.credit_limit) || 0;
    const paymentTerm = parseInt(customerForm.payment_term) || 30;

    setIsSubmitting(true);
    
    // Verificar si cambió el cupo de crédito
    const creditLimitChanged = creditLimit !== selectedCustomer.credit_limit;

    const updates: Partial<Customer> = {
      name: customerForm.name,
      document: customerForm.document,
      phone: customerForm.phone || undefined,
      email: customerForm.email || undefined,
      address: customerForm.address || undefined,
      credit_limit: creditLimit,
      payment_term: paymentTerm,
      notes: customerForm.notes || undefined
    };

    const result = await updateCustomer(selectedCustomer.id, updates);
    if (result) {
      // Registrar cambio de cupo en historial si aplica
      if (creditLimitChanged) {
        await addCreditHistory({
          customer_document: result.document,
          event_type: 'credit_limit_change',
          description: `Cupo de crédito modificado de ${formatCOP(selectedCustomer.credit_limit)} a ${formatCOP(creditLimit)}`,
          amount: creditLimit,
          registered_by: getCurrentUser()?.username || 'Sistema'
        });
      }

      toast.success('Cliente actualizado exitosamente');
      setIsEditDialogOpen(false);
      setSelectedCustomer(null);
      resetForm();
      loadCustomers();
    } else {
      toast.error('Error al actualizar el cliente');
    }
    setIsSubmitting(false);
  };

  const handleDeleteCustomer = async (customer: Customer) => {
    if (!confirm(`¿Está seguro de eliminar al cliente ${customer.name}?\\n\\nEsta acción no se puede deshacer.`)) {
      return;
    }

    const result = await deleteCustomer(customer.id);
    if (result) {
      toast.success('Cliente eliminado exitosamente');
      loadCustomers();
    } else {
      toast.error('Error al eliminar el cliente');
    }
  };

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerForm({
      name: customer.name,
      document: customer.document,
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      credit_limit: customer.credit_limit.toString(),
      payment_term: customer.payment_term.toString(),
      notes: customer.notes || ''
    });
    setIsEditDialogOpen(true);
  };

  const getStatusBadge = (customer: Customer) => {
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
    return (
      <Badge variant="outline" className={styles[customer.status]}>
        {labels[customer.status]}
      </Badge>
    );
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.document.includes(searchTerm)
  );

  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = filteredCustomers.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  if (viewMode === 'dashboard') {
    return (
      <div>
        <div className="bg-white border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
          <div className="flex gap-2">
            <Button 
              onClick={() => setViewMode('dashboard')}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Dashboard
            </Button>
            <Button 
              onClick={() => setViewMode('list')}
              variant="outline"
            >
              <User className="w-4 h-4 mr-2" />
              Lista de Clientes
            </Button>
          </div>
          <Button 
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
        <CreditDashboard />

        {/* Dialog para agregar cliente */}
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
              <DialogDescription>
                Complete la información del cliente para registrarlo en el sistema.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label htmlFor="name">Nombre Completo *</Label>
                <Input
                  id="name"
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="Ej: María González"
                />
              </div>

              <div>
                <Label htmlFor="document">Documento *</Label>
                <Input
                  id="document"
                  value={customerForm.document}
                  onChange={(e) => setCustomerForm({ ...customerForm, document: e.target.value })}
                  placeholder="Ej: 1234567890"
                />
              </div>

              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="Ej: 3001234567"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                  placeholder="Ej: cliente@email.com"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  id="address"
                  value={customerForm.address}
                  onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                  placeholder="Ej: Calle 123 #45-67"
                />
              </div>

              <div>
                <Label htmlFor="credit_limit">Cupo de Crédito</Label>
                <Input
                  id="credit_limit"
                  type="number"
                  value={customerForm.credit_limit}
                  onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value })}
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="payment_term">Plazo de Pago (días)</Label>
                <Input
                  id="payment_term"
                  type="number"
                  value={customerForm.payment_term}
                  onChange={(e) => setCustomerForm({ ...customerForm, payment_term: e.target.value })}
                  placeholder="30"
                />
              </div>

              <div className="col-span-2">
                <Label htmlFor="notes">Notas</Label>
                <Textarea
                  id="notes"
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                  placeholder="Notas adicionales sobre el cliente..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={handleAddCustomer}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {isSubmitting ? 'Guardando...' : 'Registrar Cliente'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Lista de Clientes</h1>
          <p className="text-sm text-zinc-500 mt-1">Gestión completa de clientes de crédito</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={() => setViewMode('dashboard')}
            variant="outline"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
          <Button 
            onClick={() => setViewMode('list')}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <User className="w-4 h-4 mr-2" />
            Lista de Clientes
          </Button>
          <Button 
            onClick={() => {
              resetForm();
              setIsAddDialogOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Búsqueda */}
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar por nombre o documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Clientes */}
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="border-b border-zinc-100">
          <CardTitle className="text-lg font-semibold text-zinc-900">
            Clientes ({filteredCustomers.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {paginatedCustomers.length === 0 ? (
            <div className="p-12 text-center text-zinc-500">
              <User className="w-16 h-16 mx-auto mb-4 text-zinc-300" />
              <p className="text-lg font-medium">No hay clientes registrados</p>
              <p className="text-sm mt-1">Comience agregando un nuevo cliente</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                      Cliente
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                      Contacto
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                      Cupo
                    </th>
                    <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                      Saldo
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                      Estado
                    </th>
                    <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {paginatedCustomers.map((customer) => {
                    const usedCredit = customer.total_credit - customer.total_paid;
                    const availableCredit = customer.credit_limit - usedCredit;

                    return (
                      <tr key={customer.id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                              <User className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                              <p className="font-medium text-zinc-900">{customer.name}</p>
                              <p className="text-sm text-zinc-500">{customer.document}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm">
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-zinc-600">
                                <Phone className="w-3 h-3" />
                                <span>{customer.phone}</span>
                              </div>
                            )}
                            {customer.email && (
                              <div className="flex items-center gap-1 text-zinc-600 mt-1">
                                <Mail className="w-3 h-3" />
                                <span>{customer.email}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-medium text-zinc-900">{formatCOP(customer.credit_limit)}</p>
                          <p className="text-xs text-emerald-600">
                            Disponible: {formatCOP(availableCredit)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className="font-medium text-zinc-900">{formatCOP(usedCredit)}</p>
                          <p className="text-xs text-zinc-500">{customer.payment_term} días</p>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getStatusBadge(customer)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/clientes/${customer.document}`)}
                              className="hover:bg-emerald-50 hover:border-emerald-300"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEditDialog(customer)}
                              className="hover:bg-blue-50 hover:border-blue-300"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteCustomer(customer)}
                              className="hover:bg-red-50 hover:border-red-300 text-red-600"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="border-t border-zinc-100 px-6 py-4 flex items-center justify-between">
            <p className="text-sm text-zinc-600">
              Mostrando {startIndex + 1} a {Math.min(endIndex, filteredCustomers.length)} de {filteredCustomers.length} clientes
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <div className="flex gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={currentPage === page ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Siguiente
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Dialogs */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Nuevo Cliente</DialogTitle>
            <DialogDescription>
              Complete la información del cliente para registrarlo en el sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="name">Nombre Completo *</Label>
              <Input
                id="name"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="Ej: María González"
              />
            </div>

            <div>
              <Label htmlFor="document">Documento *</Label>
              <Input
                id="document"
                value={customerForm.document}
                onChange={(e) => setCustomerForm({ ...customerForm, document: e.target.value })}
                placeholder="Ej: 1234567890"
              />
            </div>

            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                placeholder="Ej: 3001234567"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                placeholder="Ej: cliente@email.com"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                placeholder="Ej: Calle 123 #45-67"
              />
            </div>

            <div>
              <Label htmlFor="credit_limit">Cupo de Crédito</Label>
              <Input
                id="credit_limit"
                type="number"
                value={customerForm.credit_limit}
                onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="payment_term">Plazo de Pago (días)</Label>
              <Input
                id="payment_term"
                type="number"
                value={customerForm.payment_term}
                onChange={(e) => setCustomerForm({ ...customerForm, payment_term: e.target.value })}
                placeholder="30"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={customerForm.notes}
                onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                placeholder="Notas adicionales sobre el cliente..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleAddCustomer}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? 'Guardando...' : 'Registrar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
            <DialogDescription>
              Modifique la información del cliente.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="col-span-2">
              <Label htmlFor="edit-name">Nombre Completo *</Label>
              <Input
                id="edit-name"
                value={customerForm.name}
                onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                placeholder="Ej: María González"
              />
            </div>

            <div>
              <Label htmlFor="edit-document">Documento *</Label>
              <Input
                id="edit-document"
                value={customerForm.document}
                onChange={(e) => setCustomerForm({ ...customerForm, document: e.target.value })}
                placeholder="Ej: 1234567890"
              />
            </div>

            <div>
              <Label htmlFor="edit-phone">Teléfono</Label>
              <Input
                id="edit-phone"
                value={customerForm.phone}
                onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                placeholder="Ej: 3001234567"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={customerForm.email}
                onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })}
                placeholder="Ej: cliente@email.com"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="edit-address">Dirección</Label>
              <Input
                id="edit-address"
                value={customerForm.address}
                onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })}
                placeholder="Ej: Calle 123 #45-67"
              />
            </div>

            <div>
              <Label htmlFor="edit-credit-limit">Cupo de Crédito</Label>
              <Input
                id="edit-credit-limit"
                type="number"
                value={customerForm.credit_limit}
                onChange={(e) => setCustomerForm({ ...customerForm, credit_limit: e.target.value })}
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="edit-payment-term">Plazo de Pago (días)</Label>
              <Input
                id="edit-payment-term"
                type="number"
                value={customerForm.payment_term}
                onChange={(e) => setCustomerForm({ ...customerForm, payment_term: e.target.value })}
                placeholder="30"
              />
            </div>

            <div className="col-span-2">
              <Label htmlFor="edit-notes">Notas</Label>
              <Textarea
                id="edit-notes"
                value={customerForm.notes}
                onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })}
                placeholder="Notas adicionales sobre el cliente..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleEditCustomer}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {isSubmitting ? 'Guardando...' : 'Actualizar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
