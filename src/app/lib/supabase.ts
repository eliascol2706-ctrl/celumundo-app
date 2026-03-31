import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// Tipos de datos
export interface Department {
  id: string;
  company: 'celumundo' | 'repuestos';
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  company: 'celumundo' | 'repuestos';
  code: string; // Código base: A10001A
  full_code: string; // Código completo con extensión: A10001-0001A (deprecated)
  variant_number: number; // Número de variante: 1, 2, 3... (deprecated)
  name: string;
  description: string;
  current_cost: number;
  old_cost: number;
  price1: number;
  price2: number;
  final_price: number;
  margin1: number; // NUEVO: Margen de ganancia para precio1
  margin2: number; // NUEVO: Margen de ganancia para precio2
  margin_final: number; // NUEVO: Margen de ganancia para precio final
  stock: number;
  min_stock: number;
  category: string;
  use_unit_ids: boolean; // NUEVO: Si el producto usa IDs únicas por unidad
  registered_ids: string[]; // NUEVO: Array de IDs registradas (ej: ['0001', '0002', '0003'])
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  unitIds?: string[]; // NUEVO: IDs de las unidades específicas vendidas (ej: ['0001', '0002'])
}

export interface Invoice {
  id: string;
  company: 'celumundo' | 'repuestos';
  number: string;
  date: string;
  type: 'regular' | 'wholesale';
  customer_name?: string;
  customer_document?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled' | 'partial_return' | 'returned';
  payment_method?: string;
  payment_cash?: number;
  payment_transfer?: number;
  payment_other?: number;
  attended_by?: string; // NUEVO: Usuario que atendió
  is_credit?: boolean; // NUEVO: Si es una venta a crédito
  credit_balance?: number; // NUEVO: Saldo pendiente por pagar
  created_at?: string;
  updated_at?: string;
}

export interface Customer {
  id: string;
  company: 'celumundo' | 'repuestos';
  name: string;
  document: string;
  phone?: string;
  email?: string;
  total_credit: number; // Total en crédito
  total_paid: number; // Total pagado
  created_at?: string;
  updated_at?: string;
}

export interface CreditPayment {
  id: string;
  company: 'celumundo' | 'repuestos';
  invoice_id: string;
  customer_document: string;
  date: string;
  amount: number;
  payment_method: string;
  notes?: string;
  registered_by: string;
  created_at?: string;
}

export interface Movement {
  id: string;
  company: 'celumundo' | 'repuestos';
  date: string;
  type: 'entry' | 'exit';
  product_id: string;
  product_name: string;
  quantity: number;
  reason: string;
  reference: string;
  user_name: string;
  created_at?: string;
  unit_ids: string[]; // NUEVO: IDs de las unidades específicas movidas (ej: ['0001', '0002'])
}

export interface Expense {
  id: string;
  company: 'celumundo' | 'repuestos';
  date: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  supplier: string;
  reference: string;
  status: 'pending' | 'paid';
  created_at?: string;
  updated_at?: string;
}

export interface DailyClosure {
  id: string;
  company: 'celumundo' | 'repuestos';
  date: string;
  total_invoices: number;
  pending_invoices: number;
  paid_invoices: number;
  total_cash: number;
  total_transfer: number;
  total: number;
  closed_by: string;
  closed_at: string;
  created_at?: string;
}

export interface MonthlyClosure {
  id: string;
  company: 'celumundo' | 'repuestos';
  month: string;
  year: number;
  total_revenue: number;
  total_invoices: number;
  daily_closures_count: number;
  closed_by: string;
  closed_at: string;
  created_at?: string;
}

export interface User {
  id?: string;
  username: string;
  password: string;
  role: 'admin' | 'seller';
  company?: 'celumundo' | 'repuestos';
}

export interface Session {
  user: User;
  company: 'celumundo' | 'repuestos';
}

// ============================================
// GESTIÓN DE USUARIOS
// ============================================

export const getUsersFromDB = async (company: 'celumundo' | 'repuestos'): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('company', company);
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  return data || [];
};

export const authenticateUser = async (
  username: string,
  password: string,
  company: 'celumundo' | 'repuestos'
): Promise<User | null> => {
  // Obtener el usuario por username y company
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('company', company)
    .eq('username', username)
    .maybeSingle();
  
  if (error) {
    console.error('Error authenticating user:', error);
    return null;
  }

  if (!user) {
    return null;
  }

  // Verificar la contraseña con bcrypt
  const isPasswordValid = await bcrypt.compare(password, user.password);
  
  if (!isPasswordValid) {
    return null;
  }

  return user;
};

export const updateUserCredentials = async (
  userId: string,
  updates: { username?: string; password?: string }
): Promise<boolean> => {
  // Si se está actualizando la contraseña, encriptarla
  if (updates.password) {
    const saltRounds = 10;
    updates.password = await bcrypt.hash(updates.password, saltRounds);
  }

  const { error } = await supabase
    .from('users')
    .update(updates)
    .eq('id', userId);
  
  if (error) {
    console.error('Error updating user credentials:', error);
    return false;
  }
  return true;
};

export const checkUsernameExists = async (
  username: string,
  company: 'celumundo' | 'repuestos',
  excludeUserId?: string
): Promise<boolean> => {
  let query = supabase
    .from('users')
    .select('id')
    .eq('company', company)
    .eq('username', username);
  
  if (excludeUserId) {
    query = query.neq('id', excludeUserId);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Error checking username:', error);
    return false;
  }
  return (data && data.length > 0);
};

// ============================================
// GESTIÓN DE SESIÓN
// ============================================

export const saveSession = (session: Session) => {
  localStorage.setItem('app_session', JSON.stringify(session));
};

export const getSession = (): Session | null => {
  const data = localStorage.getItem('app_session');
  return data ? JSON.parse(data) : null;
};

export const getCurrentCompany = (): 'celumundo' | 'repuestos' => {
  const session = getSession();
  return session?.company || 'celumundo';
};

export const getCurrentUser = (): User | null => {
  const session = getSession();
  return session?.user || null;
};

export const logoutUser = () => {
  localStorage.removeItem('app_session');
};

// ============================================
// DEPARTAMENTOS
// ============================================

export const getDepartments = async (): Promise<Department[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .eq('company', company)
    .order('name');
  
  if (error) {
    console.error('Error fetching departments:', error);
    return [];
  }
  return data || [];
};

export const addDepartment = async (department: Omit<Department, 'id' | 'company' | 'created_at' | 'updated_at'>): Promise<Department | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('departments')
    .insert([{ ...department, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding department:', error);
    return null;
  }
  return data;
};

export const updateDepartment = async (id: string, updates: Partial<Department>): Promise<Department | null> => {
  const { data, error } = await supabase
    .from('departments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating department:', error);
    return null;
  }
  return data;
};

export const deleteDepartment = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting department:', error);
    return false;
  }
  return true;
};

// ============================================
// PRODUCTOS
// ============================================

export const getProducts = async (): Promise<Product[]> => {
  const company = getCurrentCompany();
  
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('company', company)
      .order('name');
    
    if (error) {
      console.error('Error fetching products:', error);
      
      // Si la tabla no existe, dar instrucciones claras
      if (error.code === '42P01' || error.message.includes('relation "products" does not exist')) {
        console.error('❌ ERROR: La base de datos no está configurada.');
        console.error('📋 SOLUCIÓN:');
        console.error('1. Ve a tu Supabase Dashboard: https://app.supabase.com/');
        console.error('2. Abre SQL Editor → New Query');
        console.error('3. Copia el contenido del archivo: /supabase_reset_schema.sql');
        console.error('4. Pega y ejecuta el script (botón Run)');
        console.error('5. Recarga esta página');
        
        throw new Error('Base de datos no configurada. Revisa la consola para instrucciones.');
      }
      
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    throw error;
  }
};

export const addProduct = async (product: Omit<Product, 'id' | 'company' | 'created_at' | 'updated_at'>): Promise<Product | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('products')
    .insert([{ ...product, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding product:', error);
    return null;
  }
  return data;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating product:', error);
    return null;
  }
  return data;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }
  return true;
};

// ============================================
// FACTURAS
// ============================================

// Función auxiliar para obtener la fecha/hora en zona horaria de Colombia (GMT-5)
export const getColombiaDateTime = (): Date => {
  const now = new Date();
  // Convertir a hora de Colombia (GMT-5)
  const colombiaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  return colombiaTime;
};

// Función auxiliar para obtener la fecha en formato YYYY-MM-DD en zona horaria de Colombia
export const getColombiaDate = (): string => {
  const colombiaTime = getColombiaDateTime();
  return colombiaTime.toISOString().split('T')[0];
};

// Función para verificar si se puede facturar (validar cierre pendiente)
export const canCreateInvoice = async (): Promise<{ canCreate: boolean; message?: string; requiresMonthlyClose?: boolean }> => {
  const company = getCurrentCompany();
  const colombiaTime = getColombiaDateTime();
  const currentHour = colombiaTime.getHours();
  
  console.log('[DEBUG canCreateInvoice] Fecha/Hora Colombia:', colombiaTime.toISOString());
  console.log('[DEBUG canCreateInvoice] Fecha Colombia (YYYY-MM-DD):', getColombiaDate());
  
  // Verificar si hay algún cierre previo en el sistema
  const { data: anyClosures, error: anyClosureError } = await supabase
    .from('daily_closures')
    .select('id')
    .eq('company', company)
    .limit(1);
  
  if (anyClosureError) {
    console.error('Error checking closures:', anyClosureError);
    return { canCreate: false, message: 'Error al verificar cierres' };
  }
  
  console.log('[DEBUG canCreateInvoice] ¿Hay cierres previos?:', anyClosures && anyClosures.length > 0);
  
  // Si no hay ningún cierre previo, permitir facturar (primera vez)
  if (!anyClosures || anyClosures.length === 0) {
    console.log('[DEBUG canCreateInvoice] No hay cierres previos, permitir facturar');
    return { canCreate: true };
  }
  
  // Si ya existen cierres y es después de las 12:00 AM, verificar cierre del día anterior
  if (currentHour >= 0) {
    // Calcular el día anterior correctamente en zona horaria de Colombia
    const today = getColombiaDate(); // YYYY-MM-DD en zona Colombia
    const todayDate = new Date(today + 'T00:00:00'); // Crear date object desde string
    todayDate.setDate(todayDate.getDate() - 1); // Restar un día
    const yesterdayStr = todayDate.toISOString().split('T')[0]; // Convertir a YYYY-MM-DD
    
    console.log('[DEBUG canCreateInvoice] Hoy (Colombia):', today);
    console.log('[DEBUG canCreateInvoice] Ayer (calculado):', yesterdayStr);
    
    // NUEVO: Primero verificar si hubo facturas en el día anterior
    const { data: yesterdayInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id')
      .eq('company', company)
      .eq('date', yesterdayStr);
    
    if (invoicesError) {
      console.error('Error checking yesterday invoices:', invoicesError);
      return { canCreate: false, message: 'Error al verificar facturas del día anterior' };
    }
    
    console.log('[DEBUG canCreateInvoice] Facturas de ayer encontradas:', yesterdayInvoices?.length || 0);
    
    // Si NO hubo facturas ayer, NO se requiere cierre, permitir facturar hoy
    if (!yesterdayInvoices || yesterdayInvoices.length === 0) {
      console.log('[DEBUG canCreateInvoice] No hubo facturas ayer, no se requiere cierre, permitir facturar');
      
      // VALIDACIÓN ADICIONAL: Verificar si es un nuevo mes y requiere cierre mensual
      const currentMonth = today.substring(0, 7); // YYYY-MM
      const yesterdayMonth = yesterdayStr.substring(0, 7); // YYYY-MM
      
      console.log('[DEBUG canCreateInvoice] Mes actual:', currentMonth);
      console.log('[DEBUG canCreateInvoice] Mes de ayer:', yesterdayMonth);
      
      // Si es día 1 de un nuevo mes (ayer era otro mes)
      if (currentMonth !== yesterdayMonth) {
        console.log('[DEBUG canCreateInvoice] ¡Es un nuevo mes! Verificando cierre mensual...');
        
        // Verificar si existe un cierre mensual para el mes anterior
        const { data: monthlyClosures, error: monthlyError } = await supabase
          .from('monthly_closures')
          .select('id, month, year')
          .eq('company', company)
          .eq('month', yesterdayMonth);
        
        if (monthlyError) {
          console.error('Error checking monthly closures:', monthlyError);
          return { canCreate: false, message: 'Error al verificar cierres mensuales' };
        }
        
        console.log('[DEBUG canCreateInvoice] Cierres mensuales encontrados:', monthlyClosures);
        
        // Si no existe cierre mensual del mes anterior, no permitir facturar
        if (!monthlyClosures || monthlyClosures.length === 0) {
          console.log('[DEBUG canCreateInvoice] No hay cierre mensual, bloquear facturación');
          
          const previousMonthDate = new Date(yesterdayStr);
          const monthName = previousMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
          
          return { 
            canCreate: false,
            requiresMonthlyClose: true,
            message: `⚠️ Es un nuevo mes. Debes realizar el CIERRE MENSUAL de ${monthName} antes de continuar facturando.\n\nVe a la sección "Cierres" y realiza el cierre mensual.` 
          };
        }
        
        console.log('[DEBUG canCreateInvoice] Cierre mensual existe, permitir facturar en nuevo mes');
      }
      
      return { canCreate: true };
    }
    
    // Si SÍ hubo facturas ayer, verificar si existe un cierre para ese día
    const { data: closures, error } = await supabase
      .from('daily_closures')
      .select('id, date')
      .eq('company', company)
      .eq('date', yesterdayStr);
    
    if (error) {
      console.error('Error checking closures:', error);
      return { canCreate: false, message: 'Error al verificar cierres' };
    }
    
    console.log('[DEBUG canCreateInvoice] Cierres encontrados para ayer:', closures);
    
    // Si hubo facturas ayer pero NO existe cierre del día anterior, no permitir facturar
    if (!closures || closures.length === 0) {
      console.log('[DEBUG canCreateInvoice] Hubo facturas ayer pero no hay cierre, bloquear facturación');
      return { 
        canCreate: false, 
        message: `No se puede facturar. Debes realizar el cierre del día ${yesterdayStr} (${todayDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}) antes de continuar.` 
      };
    }
    
    console.log('[DEBUG canCreateInvoice] Cierre de ayer existe, permitir facturar');
  }
  
  return { canCreate: true };
};

export const getInvoices = async (): Promise<Invoice[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('company', company)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
  return data || [];
};

export const addInvoice = async (invoice: Omit<Invoice, 'id' | 'number' | 'company' | 'created_at' | 'updated_at'>): Promise<Invoice | null> => {
  const company = getCurrentCompany();
  
  // Validar si se puede crear la factura
  const validation = await canCreateInvoice();
  if (!validation.canCreate) {
    console.error('Cannot create invoice:', validation.message);
    throw new Error(validation.message || 'No se puede crear la factura');
  }
  
  // Obtener el siguiente número de factura
  const { data: nextNumber } = await supabase.rpc('get_next_invoice_number', { company_name: company });
  
  // Usar la fecha y hora actual de Colombia
  const colombiaDateTime = getColombiaDateTime().toISOString();
  
  const { data, error } = await supabase
    .from('invoices')
    .insert([{ 
      ...invoice, 
      company, 
      number: nextNumber,
      date: colombiaDateTime // Guardar con fecha y hora completa de Colombia
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding invoice:', error);
    return null;
  }
  
  // Registrar movimientos y actualizar stock
  for (const item of invoice.items) {
    await addMovement({
      type: 'exit',
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      reason: 'Venta - Factura',
      reference: nextNumber || '',
      user_name: getCurrentUser()?.username || 'Sistema',
      unit_ids: item.unitIds || []
    });
    
    // Actualizar stock
    const { data: product } = await supabase
      .from('products')
      .select('stock')
      .eq('id', item.productId)
      .single();
    
    if (product) {
      await updateProduct(item.productId, { stock: product.stock - item.quantity });
    }
  }
  
  return data;
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice | null> => {
  const { data, error } = await supabase
    .from('invoices')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating invoice:', error);
    return null;
  }
  return data;
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting invoice:', error);
    return false;
  }
  return true;
};

// ============================================
// MOVIMIENTOS
// ============================================

export const getMovements = async (): Promise<Movement[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('movements')
    .select('*')
    .eq('company', company)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching movements:', error);
    return [];
  }
  return data || [];
};

export const addMovement = async (movement: Omit<Movement, 'id' | 'company' | 'created_at'>): Promise<Movement | null> => {
  const company = getCurrentCompany();
  
  const { data, error } = await supabase
    .from('movements')
    .insert([{
      type: movement.type,
      product_id: movement.product_id,
      product_name: movement.product_name,
      quantity: movement.quantity,
      reason: movement.reason,
      reference: movement.reference,
      user_name: movement.user_name,
      unit_ids: movement.unit_ids || [], // Siempre incluir unit_ids, aunque sea array vacío
      company
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding movement:', error);
    throw new Error('Error al registrar movimiento');
  }
  return data;
};

export const createManualMovement = async (
  productId: string,
  quantity: number,
  type: 'entry' | 'exit',
  reason: string,
  reference: string
): Promise<Movement | null> => {
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single();
  
  if (!product) return null;
  
  const newStock = type === 'entry' 
    ? product.stock + quantity 
    : product.stock - quantity;
  
  if (newStock < 0) {
    throw new Error('Stock insuficiente');
  }
  
  await updateProduct(productId, { stock: newStock });
  
  return addMovement({
    type,
    product_id: productId,
    product_name: product.name,
    quantity,
    reason,
    reference,
    user_name: getCurrentUser()?.username || 'Usuario',
    unit_ids: []
  });
};

// ============================================
// GASTOS
// ============================================

export const getExpenses = async (): Promise<Expense[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('company', company)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching expenses:', error);
    return [];
  }
  return data || [];
};

export const addExpense = async (expense: Omit<Expense, 'id' | 'company' | 'created_at' | 'updated_at'>): Promise<Expense | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('expenses')
    .insert([{ ...expense, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding expense:', error);
    return null;
  }
  return data;
};

export const updateExpense = async (id: string, updates: Partial<Expense>): Promise<Expense | null> => {
  const { data, error } = await supabase
    .from('expenses')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating expense:', error);
    return null;
  }
  return data;
};

export const deleteExpense = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting expense:', error);
    return false;
  }
  return true;
};

// ============================================
// CIERRES DIARIOS
// ============================================

export const getDailyClosures = async (): Promise<DailyClosure[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('daily_closures')
    .select('*')
    .eq('company', company)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching daily closures:', error);
    return [];
  }
  return data || [];
};

export const addDailyClosure = async (closure: Omit<DailyClosure, 'id' | 'company' | 'created_at'>): Promise<DailyClosure | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('daily_closures')
    .insert([{ ...closure, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding daily closure:', error);
    return null;
  }
  return data;
};

// Función para borrar un cierre por ID (útil para corregir datos)
export const deleteDailyClosure = async (closureId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('daily_closures')
    .delete()
    .eq('id', closureId);
  
  if (error) {
    console.error('Error deleting daily closure:', error);
    return false;
  }
  return true;
};

// Función para actualizar la fecha de un cierre (útil para corregir datos)
export const updateClosureDate = async (closureId: string, newDate: string): Promise<boolean> => {
  const { error } = await supabase
    .from('daily_closures')
    .update({ date: newDate })
    .eq('id', closureId);
  
  if (error) {
    console.error('Error updating closure date:', error);
    return false;
  }
  return true;
};

// ============================================
// CIERRES MENSUALES
// ============================================

export const getMonthlyClosures = async (): Promise<MonthlyClosure[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('monthly_closures')
    .select('*')
    .eq('company', company)
    .order('month', { ascending: false });
  
  if (error) {
    console.error('Error fetching monthly closures:', error);
    return [];
  }
  return data || [];
};

export const addMonthlyClosure = async (closure: Omit<MonthlyClosure, 'id' | 'company' | 'created_at'>): Promise<MonthlyClosure | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('monthly_closures')
    .insert([{ ...closure, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding monthly closure:', error);
    return null;
  }
  return data;
};

// ============================================
// DEVOLUCIONES
// ============================================

export interface Return {
  id: string;
  company: 'celumundo' | 'repuestos';
  return_number: string;
  date: string;
  type: 'full' | 'partial';
  invoice_id: string;
  invoice_number: string;
  customer_name?: string;
  customer_document?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  reason: string;
  refund_method?: string;
  processed_by: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export const getReturns = async (): Promise<Return[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .eq('company', company)
      .order('date', { ascending: false });
    
    if (error) {
      // Verificar si es un error de tabla no existente
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.error('⚠️ La tabla "returns" no existe en Supabase.');
        console.error('📋 SOLUCIÓN: Ejecuta el script SQL en /migration_add_returns_table.sql');
        console.error('1. Ve a https://app.supabase.com/');
        console.error('2. Abre SQL Editor → New Query');
        console.error('3. Copia y ejecuta el contenido de migration_add_returns_table.sql');
        console.error('4. Recarga la página');
        throw new Error('TABLE_NOT_EXISTS');
      }
      
      console.error('Error fetching returns:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }
    return data || [];
  } catch (error) {
    // Si es nuestro error personalizado, propagarlo
    if (error instanceof Error && error.message === 'TABLE_NOT_EXISTS') {
      throw error;
    }
    
    // Para errores de red (Failed to fetch)
    if (error instanceof Error && error.message.includes('Failed to fetch')) {
      console.error('⚠️ Error de conexión con Supabase - Posible tabla faltante');
      console.error('📋 SOLUCIÓN: Verifica que la tabla "returns" existe en Supabase');
      console.error('Ejecuta el script: /migration_add_returns_table.sql');
      throw new Error('TABLE_NOT_EXISTS');
    }
    
    console.error('Error fetching returns:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error),
      hint: 'Verifica que la tabla "returns" existe en Supabase',
      code: ''
    });
    return [];
  }
};

export const getReturnsByInvoice = async (invoiceId: string): Promise<Return[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('returns')
      .select('*')
      .eq('company', company)
      .eq('invoice_id', invoiceId)
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Error fetching returns by invoice:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching returns by invoice:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : String(error),
      hint: 'Verifica que la tabla "returns" existe en Supabase',
      code: ''
    });
    return [];
  }
};

export const addReturn = async (returnData: Omit<Return, 'id' | 'return_number' | 'company' | 'created_at' | 'updated_at'>): Promise<Return | null> => {
  const company = getCurrentCompany();
  
  // Generar número de devolución
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `D${today}`;
  
  // Buscar último número del día
  const { data: lastReturn } = await supabase
    .from('returns')
    .select('return_number')
    .eq('company', company)
    .like('return_number', `${prefix}%`)
    .order('return_number', { ascending: false })
    .limit(1)
    .single();
  
  let nextSequence = 1;
  if (lastReturn) {
    const lastSequence = parseInt(lastReturn.return_number.slice(-4));
    nextSequence = lastSequence + 1;
  }
  
  const return_number = `${prefix}-${nextSequence.toString().padStart(4, '0')}`;
  
  // Crear registro de devolución
  const { data, error } = await supabase
    .from('returns')
    .insert([{ ...returnData, company, return_number }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding return:', error);
    return null;
  }
  
  // Actualizar inventario
  for (const item of returnData.items) {
    // Crear movimiento de entrada
    await addMovement({
      type: 'entry',
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      reason: 'Devolución',
      reference: `Factura ${returnData.invoice_number}`,
      user_name: returnData.processed_by,
      unit_ids: item.unitIds || []
    });
    
    // Actualizar stock y IDs registradas
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', item.productId)
      .single();
    
    if (product) {
      const newStock = product.stock + item.quantity;
      let newRegisteredIds = product.registered_ids || [];
      
      // Si el producto usa IDs únicas, agregarlas de vuelta al inicio del array
      if (product.use_unit_ids && item.unitIds && item.unitIds.length > 0) {
        newRegisteredIds = [...item.unitIds, ...newRegisteredIds];
      }
      
      await updateProduct(item.productId, { 
        stock: newStock,
        registered_ids: newRegisteredIds
      });
    }
  }
  
  // Actualizar estado de la factura
  const { data: invoice } = await supabase
    .from('invoices')
    .select('items')
    .eq('id', returnData.invoice_id)
    .single();
  
  if (invoice) {
    // Calcular si es devolución completa
    const allReturns = await getReturnsByInvoice(returnData.invoice_id);
    const totalReturnedItems: { [key: string]: number } = {};
    
    // Sumar cantidades devueltas (incluyendo la actual)
    [...allReturns, data as Return].forEach(ret => {
      ret.items.forEach(item => {
        totalReturnedItems[item.productId] = (totalReturnedItems[item.productId] || 0) + item.quantity;
      });
    });
    
    // Verificar si todos los productos fueron devueltos
    const allProductsReturned = invoice.items.every((invItem: InvoiceItem) => {
      return totalReturnedItems[invItem.productId] >= invItem.quantity;
    });
    
    // Actualizar estado de factura
    const newStatus = allProductsReturned ? 'returned' : 'partial_return';
    await updateInvoice(returnData.invoice_id, { status: newStatus });
  }
  
  return data;
};

export const getReturnsStats = async () => {
  const returns = await getReturns();
  const invoices = await getInvoices();
  
  const totalReturns = returns.length;
  const totalReturnAmount = returns.reduce((sum, ret) => sum + ret.total, 0);
  const fullReturns = returns.filter(r => r.type === 'full').length;
  const partialReturns = returns.filter(r => r.type === 'partial').length;
  
  const totalInvoices = invoices.filter(inv => 
    inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned'
  ).length;
  
  const returnRate = totalInvoices > 0 ? (totalReturns / totalInvoices) * 100 : 0;
  
  return {
    totalReturns,
    totalReturnAmount,
    fullReturns,
    partialReturns,
    returnRate
  };
};

/**
 * Calcula los ingresos netos considerando devoluciones
 */
export const calculateNetRevenue = (invoices: Invoice[], returns: Return[]): number => {
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned')
    .reduce((sum, inv) => sum + inv.total, 0);
  
  const totalReturns = returns.reduce((sum, ret) => sum + ret.total, 0);
  
  return totalRevenue - totalReturns;
};

// ============================================
// CLIENTES
// ============================================

export const getCustomers = async (): Promise<Customer[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company', company)
    .order('name');
  
  if (error) {
    console.error('Error fetching customers:', error);
    return [];
  }
  return data || [];
};

export const getCustomerByDocument = async (document: string): Promise<Customer | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company', company)
    .eq('document', document)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // No encontrado
    console.error('Error fetching customer:', error);
    return null;
  }
  return data;
};

export const addCustomer = async (customer: Omit<Customer, 'id' | 'company' | 'created_at' | 'updated_at'>): Promise<Customer | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('customers')
    .insert([{ ...customer, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding customer:', error);
    return null;
  }
  return data;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer | null> => {
  const { data, error } = await supabase
    .from('customers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating customer:', error);
    return null;
  }
  return data;
};

export const deleteCustomer = async (id: string): Promise<boolean> => {
  const { error } = await supabase
    .from('customers')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting customer:', error);
    return false;
  }
  return true;
};

// ============================================
// ABONOS A CRÉDITO
// ============================================

export const getCreditPayments = async (): Promise<CreditPayment[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('credit_payments')
    .select('*')
    .eq('company', company)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching credit payments:', error);
    return [];
  }
  return data || [];
};

export const getCreditPaymentsByInvoice = async (invoiceId: string): Promise<CreditPayment[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('credit_payments')
    .select('*')
    .eq('company', company)
    .eq('invoice_id', invoiceId)
    .order('date', { ascending: false });
  
  if (error) {
    console.error('Error fetching credit payments by invoice:', error);
    return [];
  }
  return data || [];
};

export const addCreditPayment = async (payment: Omit<CreditPayment, 'id' | 'company' | 'created_at'>): Promise<CreditPayment | null> => {
  const company = getCurrentCompany();
  
  // Crear el abono
  const { data, error } = await supabase
    .from('credit_payments')
    .insert([{ ...payment, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding credit payment:', error);
    return null;
  }
  
  // Actualizar el balance de la factura
  const { data: invoice } = await supabase
    .from('invoices')
    .select('credit_balance, total')
    .eq('id', payment.invoice_id)
    .single();
  
  if (invoice) {
    const newBalance = (invoice.credit_balance || invoice.total) - payment.amount;
    const newStatus = newBalance <= 0 ? 'paid' : 'pending';
    
    await updateInvoice(payment.invoice_id, { 
      credit_balance: newBalance,
      status: newStatus
    });
  }
  
  // Actualizar totales del cliente
  const customer = await getCustomerByDocument(payment.customer_document);
  if (customer) {
    await updateCustomer(customer.id, {
      total_paid: customer.total_paid + payment.amount
    });
  }
  
  return data;
};

export const deleteCreditPayment = async (id: string): Promise<boolean> => {
  // Obtener el abono antes de eliminarlo para revertir cambios
  const { data: payment } = await supabase
    .from('credit_payments')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!payment) return false;
  
  // Revertir el balance de la factura
  const { data: invoice } = await supabase
    .from('invoices')
    .select('credit_balance, total')
    .eq('id', payment.invoice_id)
    .single();
  
  if (invoice) {
    const newBalance = (invoice.credit_balance || 0) + payment.amount;
    await updateInvoice(payment.invoice_id, { 
      credit_balance: newBalance,
      status: 'pending'
    });
  }
  
  // Revertir totales del cliente
  const customer = await getCustomerByDocument(payment.customer_document);
  if (customer) {
    await updateCustomer(customer.id, {
      total_paid: customer.total_paid - payment.amount
    });
  }
  
  // Eliminar el abono
  const { error } = await supabase
    .from('credit_payments')
    .delete()
    .eq('id', id);
  
  if (error) {
    console.error('Error deleting credit payment:', error);
    return false;
  }
  return true;
};