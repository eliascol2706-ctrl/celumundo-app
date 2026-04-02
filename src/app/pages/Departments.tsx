import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, FolderOpen, TrendingUp, Package, ShoppingCart } from 'lucide-react';
import { getDepartments, addDepartment, updateDepartment, deleteDepartment, getProducts, getInvoices, type Department, type Product, type Invoice } from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';

export function Departments() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });

  useEffect(() => {
    loadDepartments();
    loadProducts();
    loadInvoices();
  }, []);

  const loadDepartments = async () => {
    const data = await getDepartments();
    setDepartments(data);
  };

  const loadProducts = async () => {
    const data = await getProducts();
    setProducts(data);
  };

  const loadInvoices = async () => {
    const data = await getInvoices();
    setInvoices(data);
  };

  // Calcular estadísticas por departamento
  const getDepartmentStats = (departmentName: string) => {
    const deptProducts = products.filter(p => p.category === departmentName);
    const productIds = new Set(deptProducts.map(p => p.id));
    
    let totalSales = 0;
    let totalRevenue = 0;
    
    invoices.forEach(invoice => {
      if (invoice.status !== 'cancelled' && invoice.status !== 'returned') {
        invoice.items.forEach(item => {
          if (productIds.has(item.productId)) {
            totalSales += item.quantity;
            totalRevenue += item.total;
          }
        });
      }
    });

    return {
      productCount: deptProducts.length,
      totalSales,
      totalRevenue
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (editingDepartment) {
        const updated = await updateDepartment(editingDepartment.id, formData);
        if (updated) {
          setDepartments(departments.map(d => d.id === updated.id ? updated : d));
        }
      } else {
        const newDepartment = await addDepartment(formData);
        if (newDepartment) {
          setDepartments([...departments, newDepartment]);
        }
      }
      handleCloseDialog();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (department: Department) => {
    setEditingDepartment(department);
    setFormData({
      name: department.name,
      description: department.description || '',
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('¿Estás seguro de eliminar este departamento?')) return;
    
    if (isDeletingId) return;
    setIsDeletingId(id);

    try {
      const success = await deleteDepartment(id);
      if (success) {
        setDepartments(departments.filter(d => d.id !== id));
      }
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingDepartment(null);
    setFormData({ name: '', description: '' });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between animate-fade-in-up">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Departamentos</h1>
          <p className="text-muted-foreground mt-1">Gestiona las categorías de productos y visualiza su rendimiento</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-green-600 hover:bg-green-700">
          <Plus className="mr-2 h-4 w-4" />
          Nuevo Departamento
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Departamentos</CardTitle>
            <FolderOpen className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{products.length}</div>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Ventas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {invoices.filter(i => i.status !== 'cancelled' && i.status !== 'returned').length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departments Grid */}
      {departments.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-medium">No hay departamentos</h3>
              <p className="text-muted-foreground mt-1">Comienza creando tu primer departamento</p>
              <Button onClick={() => setDialogOpen(true)} className="mt-4 bg-green-600 hover:bg-green-700">
                <Plus className="mr-2 h-4 w-4" />
                Crear Departamento
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => {
            const stats = getDepartmentStats(department.name);
            return (
              <Card key={department.id} className="hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-l-4 border-l-green-600">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FolderOpen className="h-5 w-5 text-green-600" />
                        {department.name}
                      </CardTitle>
                      {department.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {department.description}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(department)}
                        disabled={isDeletingId !== null}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(department.id)}
                        disabled={isDeletingId !== null}
                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Estadísticas */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-3 text-center hover:scale-105 transition-transform duration-200">
                      <Package className="h-4 w-4 text-blue-600 mx-auto mb-1" />
                      <div className="text-xl font-bold text-blue-600">{stats.productCount}</div>
                      <div className="text-xs text-muted-foreground">Productos</div>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-3 text-center hover:scale-105 transition-transform duration-200">
                      <ShoppingCart className="h-4 w-4 text-purple-600 mx-auto mb-1" />
                      <div className="text-xl font-bold text-purple-600">{stats.totalSales}</div>
                      <div className="text-xs text-muted-foreground">Unidades</div>
                    </div>
                    <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 text-center hover:scale-105 transition-transform duration-200">
                      <TrendingUp className="h-4 w-4 text-green-600 mx-auto mb-1" />
                      <div className="text-xl font-bold text-green-600">
                        {stats.totalRevenue > 0
                          ? stats.totalRevenue >= 1000000
                            ? `${Math.round(stats.totalRevenue / 1000000)}M`
                            : `${Math.round(stats.totalRevenue / 1000)}K`
                          : '0K'}
                      </div>
                      <div className="text-xs text-muted-foreground">Ingresos</div>
                    </div>
                  </div>

                  {/* Barra de progreso de ventas */}
                  {stats.totalSales > 0 && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Rendimiento</span>
                        <span className="font-medium text-green-600">{stats.totalSales} ventas</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-1000"
                          style={{ 
                            width: `${Math.min((stats.totalSales / Math.max(...departments.map(d => getDepartmentStats(d.name).totalSales), 1)) * 100, 100)}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? 'Editar Departamento' : 'Nuevo Departamento'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ej: Smartphones, Pantallas, Baterías"
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descripción del departamento (opcional)"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="bg-green-600 hover:bg-green-700" disabled={isSubmitting}>
                {isSubmitting ? 'Procesando...' : editingDepartment ? 'Actualizar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
