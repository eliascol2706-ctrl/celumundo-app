import { createClient } from '@supabase/supabase-js';

import { projectId, publicAnonKey } from '/utils/supabase/info';

// Cliente de Supabase
const supabaseUrl = `https://${projectId}.supabase.co`;
export const supabase = createClient(supabaseUrl, publicAnonKey);

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
  invoice_type?: 'regular' | 'wholesale'; // Alias para compatibilidad
  customer_name?: string;
  customer_document?: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'pending' | 'paid' | 'cancelled' | 'partial_return' | 'returned' | 'pending_confirmation'; // ACTUALIZADO: Agregado 'pending_confirmation'
  payment_method?: string;
  payment_cash?: number;
  payment_transfer?: number;
  payment_other?: number;
  payment_note?: string; // NUEVO: Nota adicional del pago
  attended_by?: string; // Usuario que atendió
  is_credit?: boolean; // Si es una venta a crédito
  credit_balance?: number; // Saldo pendiente por pagar
  due_date?: string; // Fecha de vencimiento para créditos
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
  address?: string;
  credit_limit: number; // Cupo de crédito aprobado
  payment_term: number; // Plazo de pago en días (ej: 30 días)
  status: 'active' | 'overdue' | 'blocked'; // Estado del cliente
  blocked: boolean; // Si está bloqueado para nuevas ventas
  total_credit: number; // Total en crédito
  total_paid: number; // Total pagado
  notes?: string;
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
  proof_url?: string; // URL del comprobante de pago
  notes?: string;
  registered_by: string;
  created_at?: string;
}

export interface CreditHistory {
  id: string;
  company: 'celumundo' | 'repuestos';
  customer_document: string;
  event_type: 'payment' | 'invoice' | 'status_change' | 'credit_limit_change' | 'note';
  description: string;
  amount?: number;
  reference_id?: string; // ID de factura o pago relacionado
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

export interface Exchange {
  id: string;
  company: 'celumundo' | 'repuestos';
  exchange_number: string;
  date: string;
  type: 'invoice' | 'direct';
  invoice_id?: string;
  invoice_number?: string;
  customer_name?: string;
  original_product_id: string;
  original_product_name: string;
  original_quantity: number;
  original_price: number;
  original_total: number;
  original_unit_ids?: string[];
  new_product_id: string;
  new_product_name: string;
  new_quantity: number;
  new_price: number;
  new_total: number;
  new_unit_ids?: string[];
  price_difference: number;
  payment_method?: string; // Mantener por compatibilidad
  payment_amount?: number; // Mantener por compatibilidad
  payment_cash?: number; // NUEVO: Monto en efectivo
  payment_transfer?: number; // NUEVO: Monto en transferencia
  notes?: string;
  registered_by: string;
  created_at?: string;
  updated_at?: string;
}

export interface Warranty {
  id: string;
  company: 'celumundo' | 'repuestos';
  warranty_number: string;
  date: string;
  product_id: string;
  product_name: string;
  product_code: string;
  quantity: number;
  unit_ids?: string[];
  notes?: string;
  discount_from_stock: boolean;
  status: 'pending' | 'sent' | 'returned' | 'resolved' | 'cancelled';
  sent_date?: string;
  returned_date?: string;
  resolved_date?: string;
  sent_notes?: string;
  return_notes?: string;
  resolution_notes?: string;
  registered_by: string;
  updated_by?: string;
  updated_at?: string;
  created_at?: string;
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

  // Verificar la contraseña directamente
  if (password !== user.password) {
    return null;
  }

  return user;
};

export const updateUserCredentials = async (
  userId: string,
  updates: { username?: string; password?: string }
): Promise<boolean> => {
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
  const year = colombiaTime.getFullYear();
  const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
  const day = String(colombiaTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Función auxiliar para extraer la fecha (YYYY-MM-DD) de un timestamp, considerando zona horaria de Colombia
export const extractColombiaDate = (timestamp: string): string => {
  if (!timestamp) return '';
  // Si el timestamp ya es solo fecha (YYYY-MM-DD), devolverlo tal cual
  if (timestamp.length === 10 && !timestamp.includes('T')) {
    return timestamp;
  }
  // Convertir el timestamp a fecha en zona de Colombia
  const date = new Date(timestamp);
  const colombiaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const year = colombiaDate.getFullYear();
  const month = String(colombiaDate.getMonth() + 1).padStart(2, '0');
  const day = String(colombiaDate.getDate()).padStart(2, '0');
  const result = `${year}-${month}-${day}`;
  
  // Debug temporal
  if (timestamp.includes('2025-04')) {
    console.log('[extractColombiaDate] DEBUG:', {
      input: timestamp,
      output: result,
      dateObj: date.toISOString(),
      colombiaDateObj: colombiaDate.toISOString()
    });
  }
  
  return result;
};

// Función auxiliar para extraer la fecha y hora completa, considerando zona horaria de Colombia
export const extractColombiaDateTime = (timestamp: string): string => {
  if (!timestamp) return '';
  // Si el timestamp ya es solo fecha (YYYY-MM-DD), devolver con hora 00:00:00
  if (timestamp.length === 10 && !timestamp.includes('T')) {
    return `${timestamp} 00:00:00`;
  }
  // Convertir el timestamp a fecha/hora en zona de Colombia
  const date = new Date(timestamp);
  const colombiaDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
  const year = colombiaDate.getFullYear();
  const month = String(colombiaDate.getMonth() + 1).padStart(2, '0');
  const day = String(colombiaDate.getDate()).padStart(2, '0');
  const hours = String(colombiaDate.getHours()).padStart(2, '0');
  const minutes = String(colombiaDate.getMinutes()).padStart(2, '0');
  const seconds = String(colombiaDate.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

// Función para verificar si se puede facturar (validar cierre pendiente)
export const canCreateInvoice = async (): Promise<{ canCreate: boolean; message?: string; requiresMonthlyClose?: boolean }> => {
  const company = getCurrentCompany();
  const colombiaTime = getColombiaDateTime();
  const today = getColombiaDate(); // YYYY-MM-DD en zona Colombia

  // Calcular el día anterior usando zona horaria de Colombia
  const colombiaDate = new Date(colombiaTime);
  colombiaDate.setDate(colombiaDate.getDate() - 1);
  const yesterdayStr = `${colombiaDate.getFullYear()}-${String(colombiaDate.getMonth() + 1).padStart(2, '0')}-${String(colombiaDate.getDate()).padStart(2, '0')}`;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[canCreateInvoice] 🔍 VALIDACIÓN DE FACTURACIÓN');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[canCreateInvoice] Fecha/Hora Colombia actual:', colombiaTime.toISOString());
  console.log('[canCreateInvoice] HOY (Colombia):', today);
  console.log('[canCreateInvoice] AYER (Colombia):', yesterdayStr);
  console.log('[canCreateInvoice] Empresa:', company);

  try {
    // PASO 1: Verificar si ya se hizo el cierre del día ACTUAL
    const { data: todayClosures } = await supabase
      .from('daily_closures')
      .select('id, date, closed_at')
      .eq('company', company)
      .eq('date', today)
      .limit(1);

    if (todayClosures && todayClosures.length > 0) {
      const closureDate = new Date(todayClosures[0].closed_at);
      const closureColombiaTime = new Date(closureDate.toLocaleString('en-US', { timeZone: 'America/Bogota' }));
      const closureTimeStr = closureColombiaTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

      console.log('[canCreateInvoice] ❌ Ya existe cierre de HOY');
      return {
        canCreate: false,
        message: `🚫 No se pueden realizar facturas.\n\nYa se realizó el cierre del día ${today} a las ${closureTimeStr}.\n\nPodrás facturar nuevamente a partir de las 12:00 AM del siguiente día.`
      };
    }

    // PASO 2: Verificar si existe algún cierre previo (primera vez)
    const { data: anyClosures, error: anyClosuresError } = await supabase
      .from('daily_closures')
      .select('id, date')
      .eq('company', company)
      .limit(10);

    console.log('[canCreateInvoice] Consulta de cierres previos:', { 
      closures: anyClosures, 
      count: anyClosures?.length || 0,
      error: anyClosuresError 
    });

    // Solo permitir sin validaciones si NO hay cierres previos Y NO hay facturas de ayer
    if (!anyClosures || anyClosures.length === 0) {
      console.log('[canCreateInvoice] ℹ️ No hay cierres previos en BD');
      // Continuar para validar si hay facturas de ayer
      // NO retornar aquí, seguir con PASO 3
    } else {
      console.log('[canCreateInvoice] ℹ️ Existen', anyClosures.length, 'cierres previos en BD');
    }

    // PASO 3: Obtener TODAS las facturas del día anterior para validar con extractColombiaDate
    const { data: allInvoices } = await supabase
      .from('invoices')
      .select('id, date, number')
      .eq('company', company);

    console.log('[canCreateInvoice] Total facturas en BD:', allInvoices?.length || 0);

    // Filtrar facturas del día anterior usando extractColombiaDate
    const yesterdayInvoices = (allInvoices || []).filter(inv => {
      const invDate = extractColombiaDate(inv.date);
      const isYesterday = invDate === yesterdayStr;
      if (isYesterday) {
        console.log('[canCreateInvoice] Factura de AYER encontrada:', {
          number: inv.number,
          date: inv.date,
          extractedDate: invDate,
          yesterday: yesterdayStr
        });
      }
      return isYesterday;
    });

    console.log('[canCreateInvoice] Facturas de ayer:', yesterdayInvoices.length);
    
    // Debug: Mostrar todas las fechas únicas
    const uniqueDates = [...new Set((allInvoices || []).map(inv => extractColombiaDate(inv.date)))];
    console.log('[canCreateInvoice] Fechas únicas en BD:', uniqueDates.sort().reverse().slice(0, 5));

    // PASO 4: Si NO hubo facturas AYER
    if (yesterdayInvoices.length === 0) {
      console.log('[canCreateInvoice] ℹ️ No hay facturas de ayer');
      
      const currentMonth = today.substring(0, 7); // YYYY-MM
      const yesterdayMonth = yesterdayStr.substring(0, 7); // YYYY-MM

      // Si es día 1 de un nuevo mes (ayer era último día de otro mes)
      if (currentMonth !== yesterdayMonth) {
        console.log('[canCreateInvoice] Es un nuevo mes, verificar cierre mensual del mes anterior');

        // Verificar si HUBO facturas en el mes anterior
        const previousMonthInvoices = (allInvoices || []).filter(inv => {
          const invDate = extractColombiaDate(inv.date);
          return invDate.startsWith(yesterdayMonth);
        });

        console.log('[canCreateInvoice] Facturas del mes anterior:', previousMonthInvoices.length);

        // Solo pedir cierre mensual si HUBO facturas en el mes anterior
        if (previousMonthInvoices.length > 0) {
          // Verificar si existe un cierre mensual para el mes anterior
          const { data: monthlyClosures } = await supabase
            .from('monthly_closures')
            .select('id')
            .eq('company', company)
            .eq('month', yesterdayMonth)
            .limit(1);

          if (!monthlyClosures || monthlyClosures.length === 0) {
            const previousMonthDate = new Date(yesterdayStr + 'T12:00:00');
            const monthName = previousMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });

            console.log('[canCreateInvoice] ❌ Falta cierre mensual del mes anterior');
            return {
              canCreate: false,
              requiresMonthlyClose: true,
              message: `⚠️ Es un nuevo mes. Debes realizar el CIERRE MENSUAL de ${monthName} antes de continuar facturando.\n\nVe a la sección "Cierres" y realiza el cierre mensual.`
            };
          }
        }
      }

      // Si no hay cierres previos en el sistema, es primera vez, permitir
      if (!anyClosures || anyClosures.length === 0) {
        console.log('[canCreateInvoice] ✅ Primera vez en el sistema, permitir facturar');
        return { canCreate: true };
      }

      console.log('[canCreateInvoice] ✅ No hay facturas de ayer pero hay cierres previos, permitir facturar');
      return { canCreate: true };
    }

    // PASO 5: Si hubo facturas AYER, verificar que se haya hecho el cierre del día anterior
    const { data: yesterdayClosures } = await supabase
      .from('daily_closures')
      .select('id')
      .eq('company', company)
      .eq('date', yesterdayStr)
      .limit(1);

    if (!yesterdayClosures || yesterdayClosures.length === 0) {
      const yesterdayDate = new Date(yesterdayStr + 'T12:00:00');
      const yesterdayFormatted = yesterdayDate.toLocaleDateString('es-ES', { timeZone: 'America/Bogota' });

      console.log('[canCreateInvoice] ❌ Falta cierre del día anterior');
      return {
        canCreate: false,
        message: `⚠️ Debes realizar el CIERRE DEL DÍA de ayer (${yesterdayFormatted}) antes de continuar facturando.\n\nVe a la sección "Cierres" y realiza el cierre diario.`
      };
    }

    // PASO 6: Verificar si es un nuevo mes y requiere cierre mensual
    const currentMonth = today.substring(0, 7);
    const yesterdayMonth = yesterdayStr.substring(0, 7);

    if (currentMonth !== yesterdayMonth) {
      console.log('[canCreateInvoice] Es un nuevo mes después de cerrar ayer, verificar cierre mensual');

      // Verificar si HUBO facturas en el mes anterior
      const previousMonthInvoices = (allInvoices || []).filter(inv => {
        const invDate = extractColombiaDate(inv.date);
        return invDate.startsWith(yesterdayMonth);
      });

      console.log('[canCreateInvoice] Facturas del mes anterior:', previousMonthInvoices.length);

      // Solo pedir cierre mensual si HUBO facturas en el mes anterior
      if (previousMonthInvoices.length > 0) {
        const { data: monthlyClosures } = await supabase
          .from('monthly_closures')
          .select('id')
          .eq('company', company)
          .eq('month', yesterdayMonth)
          .limit(1);

        if (!monthlyClosures || monthlyClosures.length === 0) {
          const previousMonthDate = new Date(yesterdayStr + 'T12:00:00');
          const monthName = previousMonthDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'America/Bogota' });

          console.log('[canCreateInvoice] ❌ Falta cierre mensual del mes anterior');
          return {
            canCreate: false,
            requiresMonthlyClose: true,
            message: `⚠️ Es un nuevo mes. Debes realizar el CIERRE MENSUAL de ${monthName} antes de continuar facturando.\n\nVe a la sección "Cierres" y realiza el cierre mensual.`
          };
        }
      }
    }

    console.log('[canCreateInvoice] ✅ Todas las validaciones pasaron, permitir facturar');
    return { canCreate: true };
  } catch (error) {
    console.error('[canCreateInvoice] Error:', error);
    return { canCreate: false, message: 'Error al verificar permisos de facturación' };
  }
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
  
  // Usar la fecha y hora actual de Colombia
  const colombiaDateTime = getColombiaDateTime().toISOString();
  
  // Intentar insertar con retry en caso de duplicate key
  let data = null;
  let nextNumber = '';
  const maxRetries = 5;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Obtener el siguiente número de factura
    const { data: invoiceNumber } = await supabase.rpc('get_next_invoice_number', { company_name: company });
    nextNumber = invoiceNumber;
    console.log(`🔄 Attempting to create invoice ${nextNumber} (attempt ${attempt + 1}/${maxRetries})`);
    
    const result = await supabase
      .from('invoices')
      .insert([{ 
        ...invoice, 
        company, 
        number: nextNumber,
        date: colombiaDateTime
      }])
      .select()
      .single();
    
    if (result.error) {
      // Si es error de duplicate key, reintentar
      if (result.error.code === '23505') {
        console.log(`⚠️ Duplicate invoice number detected, retrying... (attempt ${attempt + 1}/${maxRetries})`);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        } else {
          console.error('Max retries reached with duplicate key error');
          return null;
        }
      }
      
      // Si es otro tipo de error, loguear y retornar null inmediatamente
      console.error('Error adding invoice:', result.error);
      return null;
    }
    
    // Éxito
    console.log(`✅ Invoice created successfully: ${nextNumber}`);
    data = result.data;
    break;
  }
  
  if (!data) {
    console.error('Failed to create invoice after all retries');
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

// Cancelar factura de crédito y reintegrar inventario
export const cancelCreditInvoice = async (invoiceId: string): Promise<boolean> => {
  try {
    const company = getCurrentCompany();
    const currentUser = getCurrentUser();
    
    // 1. Obtener la factura completa
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('company', company)
      .single();
    
    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError);
      return false;
    }

    // 2. Reintegrar productos al inventario
    for (const item of invoice.items) {
      // Obtener el producto actual
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .eq('company', company)
        .single();
      
      if (productError || !product) {
        console.error('Error fetching product:', productError);
        continue; // Continuar con el siguiente producto
      }

      // Preparar actualización del producto
      const updatedStock = product.stock + item.quantity;
      let updatedRegisteredIds = [...(product.registered_ids || [])];
      
      // Si el item tiene unitIds, reintegrarlos al principio del array
      if (product.use_unit_ids && item.unitIds && item.unitIds.length > 0) {
        updatedRegisteredIds = [...item.unitIds, ...updatedRegisteredIds];
      }

      // Actualizar el producto
      const { error: updateError } = await supabase
        .from('products')
        .update({
          stock: updatedStock,
          registered_ids: updatedRegisteredIds
        })
        .eq('id', item.productId)
        .eq('company', company);
      
      if (updateError) {
        console.error('Error updating product stock:', updateError);
        // No retornamos false aquí para intentar procesar todos los productos
      }

      // Registrar movimiento de inventario
      await supabase
        .from('movements')
        .insert([{
          type: 'entry',
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          reason: `Cancelación de crédito - Factura ${invoice.number}`,
          reference: invoice.number,
          user_name: currentUser?.username || 'Sistema',
          unit_ids: item.unitIds || [],
          company
        }]);
    }

    // 3. Eliminar todos los abonos relacionados
    const { error: paymentsError } = await supabase
      .from('credit_payments')
      .delete()
      .eq('invoice_id', invoiceId)
      .eq('company', company);
    
    if (paymentsError) {
      console.error('Error deleting credit payments:', paymentsError);
      // Continuar con la eliminación de la factura
    }

    // 4. Eliminar la factura
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', invoiceId)
      .eq('company', company);
    
    if (deleteError) {
      console.error('Error deleting invoice:', deleteError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error canceling credit invoice:', error);
    return false;
  }
};

// Confirmar pago de factura pendiente
export const confirmInvoicePayment = async (
  invoiceId: string,
  paymentData: {
    payment_method: string;
    payment_cash?: number;
    payment_transfer?: number;
    payment_other?: number;
    payment_note?: string;
    update_date?: boolean; // Nueva opción para actualizar la fecha al día de hoy
  }
): Promise<Invoice | null> => {
  const company = getCurrentCompany();
  
  // Preparar los datos a actualizar
  const updateData: any = {
    status: 'paid', // CORREGIDO: Usar 'status' en lugar de 'payment_status'
    payment_method: paymentData.payment_method,
    payment_cash: paymentData.payment_cash || 0,
    payment_transfer: paymentData.payment_transfer || 0,
    payment_other: paymentData.payment_other || 0,
    payment_note: paymentData.payment_note || null,
  };

  // Si se solicita actualizar la fecha, usar la fecha actual de Colombia
  if (paymentData.update_date) {
    updateData.date = getColombiaDateTime();
  }
  
  const { data, error } = await supabase
    .from('invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .eq('company', company)
    .select()
    .single();
  
  if (error) {
    console.error('Error confirming invoice payment:', error);
    return null;
  }
  
  return data;
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

// ============================================
// HISTORIAL DE CRÉDITO
// ============================================

export const getCreditHistory = async (customerDocument: string): Promise<CreditHistory[]> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('credit_history')
    .select('*')
    .eq('company', company)
    .eq('customer_document', customerDocument)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching credit history:', error);
    return [];
  }
  return data || [];
};

export const addCreditHistory = async (history: Omit<CreditHistory, 'id' | 'company' | 'created_at'>): Promise<CreditHistory | null> => {
  const company = getCurrentCompany();
  const { data, error } = await supabase
    .from('credit_history')
    .insert([{ ...history, company }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding credit history:', error);
    return null;
  }
  return data;
};

// ============================================
// MÉTRICAS Y ANÁLISIS DE CRÉDITO
// ============================================

export const getCreditMetrics = async () => {
  const company = getCurrentCompany();
  const customers = await getCustomers();
  const invoices = await getInvoices();
  const creditInvoices = invoices.filter(inv => inv.is_credit && inv.status !== 'cancelled');
  
  // Total de cartera
  const totalPortfolio = creditInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
  
  // Cartera vencida
  const today = new Date();
  const overdueInvoices = creditInvoices.filter(inv => {
    if (!inv.due_date) return false;
    const dueDate = new Date(inv.due_date);
    return dueDate < today && (inv.credit_balance || 0) > 0;
  });
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
  
  // Pagos de la semana
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const payments = await getCreditPayments();
  const weekPayments = payments.filter(p => new Date(p.date) >= weekAgo);
  const weekPaymentsTotal = weekPayments.reduce((sum, p) => sum + p.amount, 0);
  
  // Indicador de riesgo
  const riskPercentage = totalPortfolio > 0 ? (overdueAmount / totalPortfolio) * 100 : 0;
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (riskPercentage > 50) riskLevel = 'high';
  else if (riskPercentage > 25) riskLevel = 'medium';
  
  return {
    totalPortfolio,
    overdueAmount,
    weekPaymentsTotal,
    weekPaymentsCount: weekPayments.length,
    riskLevel,
    riskPercentage
  };
};

export const getTopDebtors = async (limit: number = 5) => {
  const customers = await getCustomers();
  const invoices = await getInvoices();
  
  const customersWithDebt = customers.map(customer => {
    const customerInvoices = invoices.filter(inv => 
      inv.customer_document === customer.document && 
      inv.is_credit && 
      (inv.credit_balance || 0) > 0
    );
    
    const totalDebt = customerInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
    
    // Calcular días de mora (mayor de todas las facturas)
    const today = new Date();
    let maxOverdueDays = 0;
    customerInvoices.forEach(inv => {
      if (inv.due_date) {
        const dueDate = new Date(inv.due_date);
        if (dueDate < today) {
          const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          if (overdueDays > maxOverdueDays) {
            maxOverdueDays = overdueDays;
          }
        }
      }
    });
    
    return {
      ...customer,
      totalDebt,
      overdueDays: maxOverdueDays
    };
  }).filter(c => c.totalDebt > 0);
  
  return customersWithDebt
    .sort((a, b) => b.totalDebt - a.totalDebt)
    .slice(0, limit);
};

export const getAgingReport = async () => {
  const invoices = await getInvoices();
  const creditInvoices = invoices.filter(inv => 
    inv.is_credit && 
    (inv.credit_balance || 0) > 0 &&
    inv.status !== 'cancelled'
  );
  
  const today = new Date();
  
  const ranges = {
    current: { label: '0-30 días', min: 0, max: 30, amount: 0, count: 0 },
    thirtyToSixty: { label: '31-60 días', min: 31, max: 60, amount: 0, count: 0 },
    sixtyToNinety: { label: '61-90 días', min: 61, max: 90, amount: 0, count: 0 },
    overNinety: { label: 'Más de 90 días', min: 91, max: Infinity, amount: 0, count: 0 }
  };
  
  creditInvoices.forEach(inv => {
    if (!inv.due_date) return;
    
    const dueDate = new Date(inv.due_date);
    const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
    const balance = inv.credit_balance || 0;
    
    if (overdueDays >= 0 && overdueDays <= 30) {
      ranges.current.amount += balance;
      ranges.current.count++;
    } else if (overdueDays >= 31 && overdueDays <= 60) {
      ranges.thirtyToSixty.amount += balance;
      ranges.thirtyToSixty.count++;
    } else if (overdueDays >= 61 && overdueDays <= 90) {
      ranges.sixtyToNinety.amount += balance;
      ranges.sixtyToNinety.count++;
    } else if (overdueDays > 90) {
      ranges.overNinety.amount += balance;
      ranges.overNinety.count++;
    }
  });
  
  return ranges;
};

export const getRecentPayments = async (limit: number = 10): Promise<CreditPayment[]> => {
  const payments = await getCreditPayments();
  return payments.slice(0, limit);
};

export const updateCustomerStatus = async (customerDocument: string): Promise<void> => {
  const customer = await getCustomerByDocument(customerDocument);
  if (!customer) return;
  
  const invoices = await getInvoices();
  const customerInvoices = invoices.filter(inv => 
    inv.customer_document === customerDocument &&
    inv.is_credit &&
    (inv.credit_balance || 0) > 0
  );
  
  const today = new Date();
  let hasOverdue = false;
  
  for (const inv of customerInvoices) {
    if (inv.due_date) {
      const dueDate = new Date(inv.due_date);
      if (dueDate < today) {
        hasOverdue = true;
        break;
      }
    }
  }
  
  const newStatus = customer.blocked ? 'blocked' : (hasOverdue ? 'overdue' : 'active');
  
  if (customer.status !== newStatus) {
    await updateCustomer(customer.id, { status: newStatus });
  }
};

// ============================================
// CAMBIOS
// ============================================

export const getExchanges = async (): Promise<Exchange[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('exchanges')
      .select('*')
      .eq('company', company)
      .order('date', { ascending: false });
    
    if (error) {
      // Verificar si es un error de tabla no existente
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.error('⚠️ La tabla "exchanges" no existe en Supabase.');
        console.error('📋 SOLUCIÓN: Ejecuta el script SQL provisto por el sistema');
        console.error('1. Ve a https://app.supabase.com/');
        console.error('2. Abre SQL Editor → New Query');
        console.error('3. Copia y ejecuta el script SQL de exchanges');
        console.error('4. Recarga la página');
        return [];
      }
      
      console.error('Error fetching exchanges:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching exchanges:', error);
    return [];
  }
};

export const addExchange = async (exchangeData: Omit<Exchange, 'id' | 'exchange_number' | 'company' | 'created_at' | 'updated_at'>): Promise<Exchange | null> => {
  const company = getCurrentCompany();
  const colombiaDateTime = getColombiaDateTime().toISOString();
  
  // Función auxiliar para generar número de cambio
  const generateExchangeNumber = async (): Promise<string> => {
    const today = getColombiaDate().replace(/-/g, '');
    // Usar "C" para Repuestos VIP y "V" para Celumundo VIP
    const companyPrefix = company === 'repuestos' ? 'C' : 'V';
    const prefix = `${companyPrefix}${today}`;
    
    const { data: exchanges } = await supabase
      .from('exchanges')
      .select('exchange_number')
      .eq('company', company)
      .like('exchange_number', `${prefix}%`)
      .order('exchange_number', { ascending: false })
      .limit(1);
    
    let nextSequence = 1;
    if (exchanges && exchanges.length > 0) {
      const lastSequence = parseInt(exchanges[0].exchange_number.slice(-4));
      nextSequence = lastSequence + 1;
    }
    
    return `${prefix}-${nextSequence.toString().padStart(4, '0')}`;
  };
  
  // Intentar insertar con retry automático en caso de duplicate key
  let data = null;
  let exchange_number = '';
  const maxRetries = 5;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    exchange_number = await generateExchangeNumber();
    console.log(`🔄 Attempting to create exchange ${exchange_number} (attempt ${attempt + 1}/${maxRetries})`);
    
    const result = await supabase
      .from('exchanges')
      .insert([{ 
        ...exchangeData, 
        company, 
        exchange_number,
        date: colombiaDateTime 
      }])
      .select()
      .single();
    
    if (result.error) {
      // Si es error de duplicate key, reintentar
      if (result.error.code === '23505') {
        console.log(`⚠️ Duplicate key detected, retrying... (attempt ${attempt + 1}/${maxRetries})`);
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
          continue;
        } else {
          console.error('Max retries reached with duplicate key error');
          return null;
        }
      }
      
      // Si es otro tipo de error, loguear y retornar null inmediatamente
      console.error('Error adding exchange:', result.error);
      return null;
    }
    
    // Éxito
    console.log(`✅ Exchange created successfully: ${exchange_number}`);
    data = result.data;
    break;
  }
  
  if (!data) {
    console.error('Failed to create exchange after all retries');
    return null;
  }
  
  // 1. Devolver el producto original al inventario
  await addMovement({
    type: 'entry',
    product_id: exchangeData.original_product_id,
    product_name: exchangeData.original_product_name,
    quantity: exchangeData.original_quantity,
    reason: 'Cambio - Producto devuelto',
    reference: exchange_number,
    user_name: exchangeData.registered_by,
    unit_ids: exchangeData.original_unit_ids || []
  });
  
  const { data: originalProduct } = await supabase
    .from('products')
    .select('*')
    .eq('id', exchangeData.original_product_id)
    .single();
  
  if (originalProduct) {
    const newStock = originalProduct.stock + exchangeData.original_quantity;
    let newRegisteredIds = originalProduct.registered_ids || [];
    
    // Si el producto usa IDs únicas, agregarlas de vuelta
    if (originalProduct.use_unit_ids && exchangeData.original_unit_ids && exchangeData.original_unit_ids.length > 0) {
      newRegisteredIds = [...exchangeData.original_unit_ids, ...newRegisteredIds];
    }
    
    await updateProduct(exchangeData.original_product_id, { 
      stock: newStock,
      registered_ids: newRegisteredIds
    });
  }
  
  // 2. Sacar el producto nuevo del inventario
  await addMovement({
    type: 'exit',
    product_id: exchangeData.new_product_id,
    product_name: exchangeData.new_product_name,
    quantity: exchangeData.new_quantity,
    reason: 'Cambio - Producto entregado',
    reference: exchange_number,
    user_name: exchangeData.registered_by,
    unit_ids: exchangeData.new_unit_ids || []
  });
  
  const { data: newProduct } = await supabase
    .from('products')
    .select('*')
    .eq('id', exchangeData.new_product_id)
    .single();
  
  if (newProduct) {
    const newStock = newProduct.stock - exchangeData.new_quantity;
    let newRegisteredIds = newProduct.registered_ids || [];
    
    // Si el producto usa IDs únicas, removerlas
    if (newProduct.use_unit_ids && exchangeData.new_unit_ids && exchangeData.new_unit_ids.length > 0) {
      newRegisteredIds = newRegisteredIds.filter(id => !exchangeData.new_unit_ids?.includes(id));
    }
    
    await updateProduct(exchangeData.new_product_id, { 
      stock: newStock,
      registered_ids: newRegisteredIds
    });
  }
  
  return data;
};

export const getExchangesStats = async () => {
  const exchanges = await getExchanges();
  
  const totalExchanges = exchanges.length;
  const exchangesByInvoice = exchanges.filter(e => e.type === 'invoice').length;
  const directExchanges = exchanges.filter(e => e.type === 'direct').length;
  
  // Calcular diferencia total (cuánto han pagado los clientes por diferencias)
  const totalPositiveDifference = exchanges
    .filter(e => e.price_difference > 0)
    .reduce((sum, e) => sum + (e.payment_amount || 0), 0);
  
  // Calcular diferencia total negativa (cuánto se les ha devuelto a los clientes)
  const totalNegativeDifference = exchanges
    .filter(e => e.price_difference < 0)
    .reduce((sum, e) => sum + Math.abs(e.price_difference), 0);
  
  return {
    totalExchanges,
    exchangesByInvoice,
    directExchanges,
    totalPositiveDifference,
    totalNegativeDifference
  };
};

/**
 * Calcula el impacto de cambios en los ingresos
 */
export const calculateExchangeImpact = (exchanges: Exchange[]): number => {
  // El impacto neto es la suma de todas las diferencias de precio que se cobraron
  return exchanges.reduce((sum, ex) => {
    // Solo contar las diferencias que se pagaron realmente
    if (ex.price_difference > 0 && ex.payment_amount) {
      return sum + ex.payment_amount;
    } else if (ex.price_difference < 0) {
      return sum + ex.price_difference; // Negativo, resta de ingresos
    }
    return sum;
  }, 0);
};

/**
 * Calcula los ingresos netos considerando cambios
 */
export const calculateNetRevenueWithExchanges = (invoices: Invoice[], exchanges: Exchange[]): number => {
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid' || inv.status === 'partial_return' || inv.status === 'returned')
    .reduce((sum, inv) => sum + inv.total, 0);
  
  // Sumar el impacto de los cambios (positivo si se cobró, negativo si se devolvió)
  const exchangeImpact = calculateExchangeImpact(exchanges);
  
  return totalRevenue + exchangeImpact;
};

/**
 * Elimina un cambio y revierte los movimientos de inventario
 */
export const deleteExchange = async (exchangeId: string): Promise<boolean> => {
  try {
    const company = getCurrentCompany();
    const user = getCurrentUser();
    
    if (!user) {
      console.error('No hay usuario autenticado');
      return false;
    }
    
    // Obtener el cambio antes de eliminarlo
    const { data: exchange, error: fetchError } = await supabase
      .from('exchanges')
      .select('*')
      .eq('id', exchangeId)
      .eq('company', company)
      .single();
    
    if (fetchError || !exchange) {
      console.error('Error al obtener el cambio:', fetchError);
      return false;
    }
    
    // 1. REVERTIR: Sacar el producto original del inventario (el que devolvieron)
    // Porque al crear el cambio se AGREGÓ al inventario
    await addMovement({
      type: 'exit',
      product_id: exchange.original_product_id,
      product_name: exchange.original_product_name,
      quantity: exchange.original_quantity,
      reason: 'Cambio eliminado - Revertir devolución',
      reference: exchange.exchange_number,
      user_name: user.username,
      unit_ids: exchange.original_unit_ids || []
    });
    
    const { data: originalProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', exchange.original_product_id)
      .single();
    
    if (originalProduct) {
      const newStock = originalProduct.stock - exchange.original_quantity;
      let newRegisteredIds = originalProduct.registered_ids || [];
      
      // Si el producto usa IDs únicas, removerlas
      if (originalProduct.use_unit_ids && exchange.original_unit_ids && exchange.original_unit_ids.length > 0) {
        newRegisteredIds = newRegisteredIds.filter(id => !exchange.original_unit_ids?.includes(id));
      }
      
      await updateProduct(exchange.original_product_id, { 
        stock: newStock,
        registered_ids: newRegisteredIds
      });
    }
    
    // 2. REVERTIR: Devolver el producto nuevo al inventario (el que entregaron)
    // Porque al crear el cambio se RESTÓ del inventario
    await addMovement({
      type: 'entry',
      product_id: exchange.new_product_id,
      product_name: exchange.new_product_name,
      quantity: exchange.new_quantity,
      reason: 'Cambio eliminado - Devolver producto',
      reference: exchange.exchange_number,
      user_name: user.username,
      unit_ids: exchange.new_unit_ids || []
    });
    
    const { data: newProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', exchange.new_product_id)
      .single();
    
    if (newProduct) {
      const newStock = newProduct.stock + exchange.new_quantity;
      let newRegisteredIds = newProduct.registered_ids || [];
      
      // Si el producto usa IDs únicas, agregarlas de vuelta
      if (newProduct.use_unit_ids && exchange.new_unit_ids && exchange.new_unit_ids.length > 0) {
        newRegisteredIds = [...exchange.new_unit_ids, ...newRegisteredIds];
      }
      
      await updateProduct(exchange.new_product_id, { 
        stock: newStock,
        registered_ids: newRegisteredIds
      });
    }
    
    // 3. Eliminar el cambio de la base de datos
    const { error: deleteError } = await supabase
      .from('exchanges')
      .delete()
      .eq('id', exchangeId)
      .eq('company', company);
    
    if (deleteError) {
      console.error('Error al eliminar el cambio:', deleteError);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error en deleteExchange:', error);
    return false;
  }
};

// ============================================
// GARANTÍAS
// ============================================

export const getWarranties = async (): Promise<Warranty[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('warranties')
      .select('*')
      .eq('company', company)
      .order('date', { ascending: false });
    
    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.error('⚠️ La tabla "warranties" no existe en Supabase.');
        console.error('📋 SOLUCIÓN: Ejecuta el script SQL en /supabase_warranties_script.sql');
        return [];
      }
      console.error('Error fetching warranties:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching warranties:', error);
    return [];
  }
};

export const addWarranty = async (warrantyData: Omit<Warranty, 'id' | 'warranty_number' | 'company' | 'created_at' | 'updated_at'>): Promise<Warranty | null> => {
  const company = getCurrentCompany();
  
  const today = getColombiaDateTime();
  const { data: warrantyNumber } = await supabase.rpc('generate_warranty_number', { 
    p_company: company,
    p_date: today.toISOString()
  });
  
  if (!warrantyNumber) {
    console.error('Error generating warranty number');
    return null;
  }
  
  const colombiaDateTime = today.toISOString();
  
  const { data, error } = await supabase
    .from('warranties')
    .insert([{ 
      ...warrantyData, 
      company: company, 
      warranty_number: warrantyNumber,
      date: colombiaDateTime 
    }])
    .select()
    .single();
  
  if (error) {
    console.error('Error adding warranty:', error);
    return null;
  }
  
  if (warrantyData.discount_from_stock) {
    await addMovement({
      type: 'exit',
      product_id: warrantyData.product_id,
      product_name: warrantyData.product_name,
      quantity: warrantyData.quantity,
      reason: 'Garantía - Producto enviado',
      reference: warrantyNumber,
      user_name: warrantyData.registered_by,
      unit_ids: warrantyData.unit_ids || []
    });
    
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', warrantyData.product_id)
      .single();
    
    if (product) {
      const newStock = product.stock - warrantyData.quantity;
      let newRegisteredIds = product.registered_ids || [];
      
      if (product.use_unit_ids && warrantyData.unit_ids && warrantyData.unit_ids.length > 0) {
        newRegisteredIds = newRegisteredIds.filter(id => !warrantyData.unit_ids?.includes(id));
      }
      
      await updateProduct(warrantyData.product_id, { 
        stock: newStock,
        registered_ids: newRegisteredIds
      });
    }
  }
  
  return data;
};

export const updateWarrantyStatus = async (
  id: string, 
  status: Warranty['status'], 
  notes?: { sent_notes?: string; return_notes?: string; resolution_notes?: string },
  updatedBy?: string
): Promise<Warranty | null> => {
  const updates: Partial<Warranty> = {
    status,
    updated_by: updatedBy,
    updated_at: getColombiaDateTime().toISOString()
  };
  
  if (status === 'sent') {
    updates.sent_date = getColombiaDateTime().toISOString();
    if (notes?.sent_notes) updates.sent_notes = notes.sent_notes;
  } else if (status === 'returned') {
    updates.returned_date = getColombiaDateTime().toISOString();
    if (notes?.return_notes) updates.return_notes = notes.return_notes;
  } else if (status === 'resolved') {
    updates.resolved_date = getColombiaDateTime().toISOString();
    if (notes?.resolution_notes) updates.resolution_notes = notes.resolution_notes;
  }
  
  const { data, error } = await supabase
    .from('warranties')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating warranty status:', error);
    return null;
  }
  
  if (status === 'resolved') {
    const { data: warranty } = await supabase
      .from('warranties')
      .select('*')
      .eq('id', id)
      .single();
    
    if (warranty && warranty.discount_from_stock) {
      await addMovement({
        type: 'entry',
        product_id: warranty.product_id,
        product_name: warranty.product_name,
        quantity: warranty.quantity,
        reason: 'Garantía - Producto devuelto',
        reference: warranty.warranty_number,
        user_name: updatedBy || 'Sistema',
        unit_ids: warranty.unit_ids || []
      });
      
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', warranty.product_id)
        .single();
      
      if (product) {
        const newStock = product.stock + warranty.quantity;
        let newRegisteredIds = product.registered_ids || [];
        
        if (product.use_unit_ids && warranty.unit_ids && warranty.unit_ids.length > 0) {
          newRegisteredIds = [...warranty.unit_ids, ...newRegisteredIds];
        }
        
        await updateProduct(warranty.product_id, { 
          stock: newStock,
          registered_ids: newRegisteredIds
        });
      }
    }
  }
  
  return data;
};

export const getWarrantiesStats = async () => {
  const warranties = await getWarranties();
  
  const totalWarranties = warranties.length;
  const pendingWarranties = warranties.filter(w => w.status === 'pending').length;
  const sentWarranties = warranties.filter(w => w.status === 'sent').length;
  const returnedWarranties = warranties.filter(w => w.status === 'returned').length;
  const resolvedWarranties = warranties.filter(w => w.status === 'resolved').length;
  const cancelledWarranties = warranties.filter(w => w.status === 'cancelled').length;
  
  const activeWarranties = warranties.filter(w => w.status === 'pending' || w.status === 'sent' || w.status === 'returned');
  const totalActiveUnits = activeWarranties.reduce((sum, w) => sum + w.quantity, 0);
  
  const resolutionRate = totalWarranties > 0 ? (resolvedWarranties / totalWarranties) * 100 : 0;
  
  return {
    totalWarranties,
    pendingWarranties,
    sentWarranties,
    returnedWarranties,
    resolvedWarranties,
    cancelledWarranties,
    totalActiveUnits,
    resolutionRate
  };
};