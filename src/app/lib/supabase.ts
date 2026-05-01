import { createClient } from '@supabase/supabase-js';

import { projectId, publicAnonKey } from '../../../utils/supabase/info.tsx';
import { cache, cacheKeys, invalidateCache } from './cache';

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
  registered_ids: Array<{ id: string; note: string }>; // Array de IDs con notas opcionales
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
  unitIdNotes?: { [id: string]: string }; // NUEVO: Notas adicionales por ID única
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
  unit_ids: string[]; // IDs de las unidades específicas movidas (ej: ['0001', '0002'])
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
  profit_generated?: number; // Ganancia de todas las ventas del día (regulares + crédito)
  profit_collected?: number; // Ganancia de ventas pagadas al 100% ese día
  closed_by: string;
  closed_at: string;
  created_at?: string;
}

export interface MonthlyClosure {
  id: string;
  company: 'celumundo' | 'repuestos';
  month: string;
  year: number;
  total_revenue: number; // Ingresos netos del mes (facturas pagadas y parcialmente devueltas)
  total_invoices: number;
  daily_closures_count: number;
  real_profit?: number; // Ganancias reales (ventas - costo productos - gastos) - DEPRECATED
  profit_generated?: number; // Ganancia de todas las ventas del mes (regulares + crédito)
  profit_collected?: number; // Ganancia de facturas pagadas al 100% en este mes
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

export interface ExchangeProduct {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  unitIds?: string[];
}

export interface Exchange {
  id: string;
  company: 'celumundo' | 'repuestos';
  exchange_number: string;
  date: string;
  type: 'invoice' | 'direct' | 'pending';
  status?: 'completed' | 'pending' | 'cancelled';
  invoice_id?: string;
  invoice_number?: string;
  customer_name?: string;

  // NUEVO: Múltiples productos
  original_products: ExchangeProduct[];
  new_products: ExchangeProduct[];

  // DEPRECATED: Mantener para compatibilidad con registros antiguos
  original_product_id?: string;
  original_product_name?: string;
  original_quantity?: number;
  original_price?: number;
  original_total?: number;
  original_unit_ids?: string[];
  new_product_id?: string;
  new_product_name?: string;
  new_quantity?: number;
  new_price?: number;
  new_total?: number;
  new_unit_ids?: string[];

  price_difference?: number;
  payment_method?: string;
  payment_amount?: number;
  payment_cash?: number;
  payment_transfer?: number;
  payment_other?: number;
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

export interface PublicCatalog {
  id: string;
  company: 'celumundo' | 'repuestos';
  product_id: string;
  price_type: 'price1' | 'price2' | 'final_price'; // Campo requerido por constraint de DB
  display_order: number;
  image_url?: string;
  discount_percentage?: number; // Porcentaje de descuento (0-100)
  original_price: number; // Precio original del producto
  custom_price?: number; // Precio personalizado (sobrescribe original_price con descuento)
  description?: string; // Descripción personalizada para el catálogo
  display_name?: string; // Nombre personalizado para mostrar en el catálogo
  show_references?: boolean; // true = mostrar referencias en el catálogo
  product_references?: string[]; // Referencias específicas del producto
  show_price: boolean; // true = muestra precio, false = muestra botón consultar
  created_at?: string;
  updated_at?: string;
}

// Type alias para usar en el código
export type CatalogItem = PublicCatalog;

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

  return cache.withCache(
    cacheKeys.departments(company),
    async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('id, name, company, created_at, updated_at')
        .eq('company', company)
        .order('name');

      if (error) {
        console.error('Error fetching departments:', error);
        return [];
      }
      return data || [];
    },
    10 * 60 * 1000 // 10 minutos
  );
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

  // Invalidar caché
  invalidateCache.departments(company);

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
      .order('name')
      .limit(1000); // Límite explícito de 1000

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

// NUEVA FUNCIÓN: Obtiene TODOS los productos sin límite (paginación automática)
export const getAllProducts = async (): Promise<Product[]> => {
  const company = getCurrentCompany();

  return cache.withCache(
    cacheKeys.products(company),
    async () => {
      const pageSize = 1000;
      let allProducts: Product[] = [];
      let page = 0;
      let hasMore = true;

      try {
        while (hasMore) {
          const { data, error } = await supabase
            .from('products')
            .select('id, code, name, description, price1, price2, final_price, stock, min_stock, category, registered_ids, created_at, updated_at, company, current_cost')
            .eq('company', company)
            .order('name')
            .range(page * pageSize, (page + 1) * pageSize - 1);

          if (error) {
            console.error('Error fetching all products:', error);
            throw error;
          }

          if (data && data.length > 0) {
            allProducts = [...allProducts, ...data];
            page++;

            // Si obtuvimos menos de 1000, ya no hay más datos
            if (data.length < pageSize) {
              hasMore = false;
            }
          } else {
            hasMore = false;
          }
        }

        return allProducts;
      } catch (error) {
        console.error('Error connecting to Supabase:', error);
        throw error;
      }
    },
    5 * 60 * 1000 // 5 minutos
  );
};

// NUEVA FUNCIÓN: Búsqueda de productos con filtros y paginación del lado del servidor
export const searchProducts = async (filters: {
  code?: string;
  name?: string;
  description?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ products: Product[]; total: number }> => {
  const company = getCurrentCompany();
  const page = filters.page || 0;
  const pageSize = filters.pageSize || 50;

  try {
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('company', company);

    // Aplicar filtros
    if (filters.code) {
      query = query.ilike('code', `%${filters.code}%`);
    }
    if (filters.name) {
      query = query.ilike('name', `%${filters.name}%`);
    }
    if (filters.description) {
      query = query.ilike('description', `%${filters.description}%`);
    }
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category);
    }

    // Ordenar y paginar
    query = query
      .order('name')
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error searching products:', error);
      return { products: [], total: 0 };
    }

    return {
      products: data || [],
      total: count || 0
    };
  } catch (error) {
    console.error('Error searching products:', error);
    return { products: [], total: 0 };
  }
};

// NUEVA FUNCIÓN: Búsqueda de productos para selectores de facturas (sin límite estricto)
export const searchProductsForInvoice = async (searchTerm: string): Promise<Product[]> => {
  const company = getCurrentCompany();

  try {
    let query = supabase
      .from('products')
      .select('*')
      .eq('company', company);

    // Si hay término de búsqueda, aplicar filtros
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.trim();
      // Buscar en código, nombre, descripción o categoría
      query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`);
    }

    // Ordenar por nombre y limitar a 500 resultados (más que suficiente para un selector)
    query = query.order('name').limit(500);

    const { data, error } = await query;

    if (error) {
      console.error('Error searching products for invoice:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error searching products for invoice:', error);
    return [];
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

  // Invalidar caché de productos
  invalidateCache.products(company);

  return data;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  const company = getCurrentCompany();
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

  // Invalidar caché de productos
  invalidateCache.products(company);

  return data;
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  const company = getCurrentCompany();
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    return false;
  }

  // Invalidar caché de productos
  invalidateCache.products(company);

  return true;
};

// ============================================
// GESTIÓN DE IMÁGENES DEL CATÁLOGO
// ============================================

/**
 * Subir imagen al Storage de Supabase para catálogo
 */
export const uploadCatalogImage = async (file: File): Promise<string> => {
  const company = getCurrentCompany();

  // Generar nombre único para el archivo
  const fileExt = file.name.split('.').pop();
  const fileName = `${company}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

  // Subir archivo al bucket catalog-images
  const { data, error } = await supabase.storage
    .from('catalog-images')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading image:', error);
    throw error;
  }

  // Obtener URL pública de la imagen
  const { data: urlData } = supabase.storage
    .from('catalog-images')
    .getPublicUrl(data.path);

  return urlData.publicUrl;
};

/**
 * Eliminar imagen del Storage
 */
export const deleteCatalogImage = async (imageUrl: string): Promise<void> => {
  try {
    // Extraer el path del URL
    const urlParts = imageUrl.split('/catalog-images/');
    if (urlParts.length < 2) return;

    const filePath = urlParts[1];

    const { error } = await supabase.storage
      .from('catalog-images')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting image:', error);
      throw error;
    }
  } catch (error) {
    console.error('Error in deleteCatalogImage:', error);
  }
};

// ============================================
// FACTURAS
// ============================================

// Función auxiliar para obtener la fecha/hora en zona horaria de Colombia (GMT-5)
export const getColombiaDateTime = (): Date => {
  const now = new Date();

  // Usar Intl.DateTimeFormat para obtener componentes de fecha en zona Colombia
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '0';

  const year = parseInt(get('year'));
  const month = parseInt(get('month')) - 1; // Los meses en Date van de 0-11
  const day = parseInt(get('day'));
  const hour = parseInt(get('hour'));
  const minute = parseInt(get('minute'));
  const second = parseInt(get('second'));

  // Crear objeto Date con la hora de Colombia
  return new Date(year, month, day, hour, minute, second);
};

// Función auxiliar para obtener la fecha en formato YYYY-MM-DD en zona horaria de Colombia
export const getColombiaDate = (): string => {
  const now = new Date();

  // Usar Intl.DateTimeFormat para obtener la fecha en zona horaria de Colombia
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = get('year');
  const month = get('month');
  const day = get('day');

  return `${year}-${month}-${day}`;
};

// Función auxiliar para obtener el timestamp ISO completo en zona horaria de Colombia
export const getColombiaTimestampISO = (): string => {
  const now = new Date();

  // Obtener la fecha/hora en formato de Colombia usando Intl
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find(p => p.type === type)?.value || '';

  const year = get('year');
  const month = get('month');
  const day = get('day');
  const hour = get('hour');
  const minute = get('minute');
  const second = get('second');

  // Devolver en formato ISO con offset de Colombia (-05:00)
  return `${year}-${month}-${day}T${hour}:${minute}:${second}-05:00`;
};

// Función auxiliar para extraer la fecha (YYYY-MM-DD) de un timestamp, considerando zona horaria de Colombia
export const extractColombiaDate = (timestamp: string): string => {
  if (!timestamp) return '';

  // Si el timestamp ya es solo fecha (YYYY-MM-DD), devolverlo tal cual
  if (timestamp.length === 10 && !timestamp.includes('T')) {
    return timestamp;
  }

  try {
    // Convertir el timestamp a fecha
    const date = new Date(timestamp);

    // Verificar si es una fecha válida
    if (isNaN(date.getTime())) {
      console.error('[extractColombiaDate] Fecha inválida:', timestamp);
      return timestamp;
    }

    // Usar Intl.DateTimeFormat para obtener la fecha en zona horaria de Colombia
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '';

    const year = get('year');
    const month = get('month');
    const day = get('day');

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error('[extractColombiaDate] Error procesando fecha:', timestamp, error);
    return timestamp;
  }
};

// Función auxiliar para convertir una fecha YYYY-MM-DD a un timestamp ISO en zona horaria de Colombia
export const dateStringToColombiaISO = (dateString: string): string => {
  // Crear una fecha a las 12:00 PM hora de Colombia para evitar problemas de límite de día
  // Formato: YYYY-MM-DD -> YYYY-MM-DDTHH:MM:SS en zona de Colombia
  const [year, month, day] = dateString.split('-').map(Number);

  // Crear fecha en hora local (Colombia) a las 12:00 PM
  const colombiaDate = new Date(year, month - 1, day, 12, 0, 0, 0);

  // Ajustar por diferencia horaria de Colombia (GMT-5)
  // Necesitamos calcular la diferencia entre la hora local del servidor y Colombia
  const offsetColombia = -5 * 60; // Colombia es GMT-5 (en minutos)
  const offsetLocal = colombiaDate.getTimezoneOffset(); // Offset del servidor en minutos (negativo para GMT+)
  const offsetDiff = offsetLocal - offsetColombia; // Diferencia en minutos

  // Ajustar la fecha
  const adjustedDate = new Date(colombiaDate.getTime() - offsetDiff * 60 * 1000);

  return adjustedDate.toISOString();
};

// Función auxiliar para extraer la fecha y hora completa, considerando zona horaria de Colombia
export const extractColombiaDateTime = (timestamp: string): string => {
  if (!timestamp) return '';

  // Si el timestamp ya es solo fecha (YYYY-MM-DD), devolver con hora 00:00:00
  if (timestamp.length === 10 && !timestamp.includes('T')) {
    return `${timestamp} 00:00:00`;
  }

  try {
    // Convertir el timestamp a fecha
    const date = new Date(timestamp);

    // Verificar si es una fecha válida
    if (isNaN(date.getTime())) {
      console.error('[extractColombiaDateTime] Fecha inválida:', timestamp);
      return timestamp;
    }

    // Usar Intl.DateTimeFormat para obtener la fecha en zona horaria de Colombia
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(date);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '00';

    const year = get('year');
    const month = get('month');
    const day = get('day');
    const hour = get('hour');
    const minute = get('minute');
    const second = get('second');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  } catch (error) {
    console.error('[extractColombiaDateTime] Error procesando fecha:', timestamp, error);
    return timestamp;
  }
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
    .order('date', { ascending: false })
    .limit(1000); // Límite explícito de 1000

  if (error) {
    console.error('Error fetching invoices:', error);
    return [];
  }
  return data || [];
};

// NUEVA FUNCIÓN: Obtiene TODAS las facturas sin límite (paginación automática)
export const getAllInvoices = async (): Promise<Invoice[]> => {
  const company = getCurrentCompany();
  const pageSize = 1000;
  let allInvoices: Invoice[] = [];
  let page = 0;
  let hasMore = true;

  try {
    while (hasMore) {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('company', company)
        .order('date', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('Error fetching all invoices:', error);
        return allInvoices; // Retornar lo que hemos obtenido hasta ahora
      }

      if (data && data.length > 0) {
        allInvoices = [...allInvoices, ...data];
        page++;

        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return allInvoices;
  } catch (error) {
    console.error('Error connecting to Supabase:', error);
    return allInvoices;
  }
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
    // Si es el primer intento, usar el RPC
    if (attempt === 0) {
      const { data: invoiceNumber } = await supabase.rpc('get_next_invoice_number', { company_name: company });
      nextNumber = invoiceNumber;
    } else {
      // En reintentos, calcular manualmente desde el MAX actual
      const { data: maxInvoice } = await supabase
        .from('invoices')
        .select('number')
        .eq('company', company)
        .order('number', { ascending: false })
        .limit(1)
        .single();

      if (maxInvoice) {
        const currentMax = parseInt(maxInvoice.number);
        nextNumber = String(currentMax + 1).padStart(5, '0');
        console.log(`📊 Calculated next number from MAX: ${maxInvoice.number} -> ${nextNumber}`);
      } else {
        nextNumber = '00001';
      }
    }

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
  try {
    const company = getCurrentCompany();
    const currentUser = getCurrentUser();

    // 1. Obtener la factura completa antes de eliminarla
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', id)
      .eq('company', company)
      .single();

    if (invoiceError || !invoice) {
      console.error('Error fetching invoice:', invoiceError);
      return false;
    }

    console.log(`[DeleteInvoice] Eliminando factura ${invoice.number}, estado: ${invoice.status}`);

    // 2. SOLO restaurar inventario si la factura NO está pagada
    // Si status es 'paid', el inventario ya fue descontado definitivamente
    // Si status es 'pending_confirmation' o 'pending', el inventario está reservado y debe restaurarse
    if (invoice.status !== 'paid') {
      console.log(`[DeleteInvoice] Restaurando inventario (status: ${invoice.status})`);

      for (const item of invoice.items) {
        console.log('[DeleteInvoice] Procesando item:', {
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          quantityType: typeof item.quantity
        });

        // Obtener el producto actual
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', item.productId)
          .eq('company', company)
          .single();

        if (productError || !product) {
          console.error('[DeleteInvoice] Error fetching product:', productError);
          continue;
        }

        console.log('[DeleteInvoice] Producto encontrado:', {
          name: product.name,
          currentStock: product.stock,
          stockType: typeof product.stock
        });

        // Restaurar stock - asegurarse de que sean números
        const currentStock = Number(product.stock) || 0;
        const itemQuantity = Number(item.quantity) || 0;

        if (itemQuantity === 0) {
          console.warn('[DeleteInvoice] ADVERTENCIA: cantidad del item es 0');
        }

        const updatedStock = currentStock + itemQuantity;
        console.log(`[DeleteInvoice] Calculando nuevo stock: ${currentStock} + ${itemQuantity} = ${updatedStock}`);

        // Si el producto usa IDs únicas, re-habilitar las IDs que estaban deshabilitadas
        let updatedRegisteredIds = [...(product.registered_ids || [])];

        if (product.use_unit_ids && item.unitIds && item.unitIds.length > 0) {
          console.log(`[DeleteInvoice] Re-habilitando ${item.unitIds.length} IDs únicas`);

          // Re-habilitar las IDs que estaban deshabilitadas por esta factura
          updatedRegisteredIds = updatedRegisteredIds.map((idObj: any) => {
            if (typeof idObj === 'object' && item.unitIds.includes(idObj.id)) {
              // Verificar si estaba reservada por esta factura
              if (idObj.disabled && idObj.reservedBy === invoice.id) {
                return { ...idObj, disabled: false, reservedBy: undefined };
              }
            }
            return idObj;
          });
        }

        // Actualizar el producto
        console.log(`[DeleteInvoice] Actualizando producto ${item.productId} con stock: ${updatedStock}`);
        const { data: updateData, error: updateError } = await supabase
          .from('products')
          .update({
            stock: updatedStock,
            registered_ids: updatedRegisteredIds
          })
          .eq('id', item.productId)
          .eq('company', company)
          .select();

        if (updateError) {
          console.error('[DeleteInvoice] Error updating product stock:', updateError);
        } else {
          console.log('[DeleteInvoice] Producto actualizado exitosamente:', updateData);
        }

        // Registrar movimiento de inventario
        await supabase
          .from('movements')
          .insert([{
            type: 'entry',
            product_id: item.productId,
            product_name: item.productName,
            quantity: item.quantity,
            reason: `Eliminación de factura ${invoice.status === 'pending_confirmation' ? 'pendiente' : ''} - Factura ${invoice.number}`,
            reference: invoice.number,
            user_name: currentUser?.username || 'Sistema',
            unit_ids: item.unitIds || [],
            company
          }]);
      }
    } else {
      console.log(`[DeleteInvoice] Factura pagada, NO se restaura inventario`);
    }

    // 3. Eliminar la factura
    const { error: deleteError } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id)
      .eq('company', company);

    if (deleteError) {
      console.error('Error deleting invoice:', deleteError);
      return false;
    }

    console.log(`[DeleteInvoice] Factura ${invoice.number} eliminada exitosamente`);
    return true;
  } catch (error) {
    console.error('Error in deleteInvoice:', error);
    return false;
  }
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

  // Convertir la fecha YYYY-MM-DD a timestamp ISO en zona horaria de Colombia
  const expenseDate = expense.date.length === 10 && !expense.date.includes('T')
    ? dateStringToColombiaISO(expense.date)
    : expense.date;

  const { data, error } = await supabase
    .from('expenses')
    .insert([{
      ...expense,
      date: expenseDate,
      company
    }])
    .select()
    .single();

  if (error) {
    console.error('Error adding expense:', error);
    return null;
  }
  return data;
};

export const updateExpense = async (id: string, updates: Partial<Expense>): Promise<Expense | null> => {
  // Si se está actualizando la fecha, convertirla a timestamp ISO en zona horaria de Colombia
  const updatedData = { ...updates };
  if (updates.date && updates.date.length === 10 && !updates.date.includes('T')) {
    updatedData.date = dateStringToColombiaISO(updates.date);
  }

  const { data, error } = await supabase
    .from('expenses')
    .update(updatedData)
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

  // Convertir la fecha YYYY-MM-DD a timestamp ISO en zona horaria de Colombia
  const returnDate = returnData.date && returnData.date.length === 10 && !returnData.date.includes('T')
    ? dateStringToColombiaISO(returnData.date)
    : returnData.date;

  // Crear registro de devolución
  const { data, error } = await supabase
    .from('returns')
    .insert([{
      ...returnData,
      date: returnDate,
      company,
      return_number
    }])
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

      // Si el producto usa IDs únicas, restaurarlas (quitando el flag disabled)
      if (product.use_unit_ids && item.unitIds && item.unitIds.length > 0) {
        const { restoreReturnedIds } = await import('./unit-ids-utils');
        newRegisteredIds = restoreReturnedIds(newRegisteredIds, item.unitIds);
      }

      await updateProduct(item.productId, {
        stock: newStock,
        registered_ids: newRegisteredIds
      });
    }
  }
  
  // Actualizar estado de la factura y eliminar productos devueltos
  const { data: invoice } = await supabase
    .from('invoices')
    .select('items, total, subtotal, tax')
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

    // Actualizar items de la factura: eliminar productos devueltos o reducir cantidad
    const updatedItems = invoice.items
      .map((invItem: InvoiceItem) => {
        const returnedQty = totalReturnedItems[invItem.productId] || 0;
        const remainingQty = invItem.quantity - returnedQty;

        if (remainingQty <= 0) {
          // Producto completamente devuelto, no incluirlo
          return null;
        } else if (remainingQty < invItem.quantity) {
          // Producto parcialmente devuelto, reducir cantidad
          return {
            ...invItem,
            quantity: remainingQty,
            total: remainingQty * invItem.price
          };
        } else {
          // Producto no devuelto, mantener igual
          return invItem;
        }
      })
      .filter((item: InvoiceItem | null) => item !== null); // Eliminar productos completamente devueltos

    // Verificar si todos los productos fueron devueltos
    const allProductsReturned = updatedItems.length === 0;

    // Recalcular totales de la factura
    const newSubtotal = updatedItems.reduce((sum: number, item: InvoiceItem) => sum + item.total, 0);
    const taxRate = invoice.subtotal > 0 ? invoice.tax / invoice.subtotal : 0;
    const newTax = newSubtotal * taxRate;
    const newTotal = newSubtotal + newTax;

    console.log(`[addReturn] Factura ${returnData.invoice_number}:`);
    console.log(`  Items originales: ${invoice.items.length}`);
    console.log(`  Items restantes: ${updatedItems.length}`);
    console.log(`  Total original: ${invoice.total}`);
    console.log(`  Total actualizado: ${newTotal}`);

    // Actualizar estado de factura y items
    const newStatus = allProductsReturned ? 'returned' : 'partial_return';
    await updateInvoice(returnData.invoice_id, {
      status: newStatus,
      items: updatedItems,
      subtotal: newSubtotal,
      tax: newTax,
      total: newTotal
    });
  }
  
  return data;
};

/**
 * Revierte una devolución, devolviendo los productos al inventario de la factura
 */
export const revertReturn = async (returnId: string): Promise<boolean> => {
  try {
    // Obtener la devolución
    const { data: returnData, error: returnError } = await supabase
      .from('returns')
      .select('*')
      .eq('id', returnId)
      .single();

    if (returnError || !returnData) {
      console.error('Error obteniendo devolución:', returnError);
      return false;
    }

    // Obtener la factura original
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', returnData.invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error('Error obteniendo factura:', invoiceError);
      return false;
    }

    // Procesar cada item devuelto
    for (const item of returnData.items) {
      // Crear movimiento de salida (restar del inventario)
      await addMovement({
        type: 'exit',
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        reason: 'Reversión de devolución',
        reference: `Factura ${returnData.invoice_number}`,
        user_name: getCurrentUser()?.username || 'Sistema',
        unit_ids: item.unitIds || []
      });

      // Actualizar stock y IDs registradas (restar del stock)
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', item.productId)
        .single();

      if (product) {
        const newStock = product.stock - item.quantity;
        let newRegisteredIds = product.registered_ids || [];

        // Si el producto usa IDs únicas, eliminarlas del array
        if (product.use_unit_ids && item.unitIds && item.unitIds.length > 0) {
          newRegisteredIds = newRegisteredIds.filter((id: string) => !item.unitIds!.includes(id));
        }

        await updateProduct(item.productId, {
          stock: newStock,
          registered_ids: newRegisteredIds
        });
      }
    }

    // Obtener todas las devoluciones de esta factura (excluyendo la actual)
    const allReturns = await getReturnsByInvoice(returnData.invoice_id);
    const otherReturns = allReturns.filter(r => r.id !== returnId);

    // Reconstruir los items de la factura agregando los items revertidos
    const currentItems = invoice.items as InvoiceItem[];
    const updatedItems = [...currentItems];

    // Agregar de vuelta los items de la devolución
    returnData.items.forEach((returnItem: any) => {
      const existingItemIndex = updatedItems.findIndex(
        (invItem) => invItem.productId === returnItem.productId
      );

      if (existingItemIndex >= 0) {
        // El producto ya existe en la factura, aumentar la cantidad
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + returnItem.quantity,
          total: (updatedItems[existingItemIndex].quantity + returnItem.quantity) * updatedItems[existingItemIndex].price
        };
      } else {
        // El producto no existe, agregarlo
        updatedItems.push({
          productId: returnItem.productId,
          productName: returnItem.productName,
          productCode: returnItem.productCode || '',
          quantity: returnItem.quantity,
          price: returnItem.price,
          total: returnItem.quantity * returnItem.price,
          useUnitIds: returnItem.useUnitIds || false,
          unitIds: returnItem.unitIds || []
        });
      }
    });

    // Recalcular totales
    const newSubtotal = updatedItems.reduce((sum, item) => sum + item.total, 0);
    const taxRate = invoice.subtotal > 0 ? invoice.tax / invoice.subtotal : 0;
    const newTax = newSubtotal * taxRate;
    const newTotal = newSubtotal + newTax;

    // Determinar el nuevo estado de la factura
    let newStatus: 'paid' | 'partial_return' | 'returned' = 'paid';

    if (otherReturns.length > 0) {
      // Hay otras devoluciones, verificar si son totales o parciales
      const totalReturnedItems: { [key: string]: number } = {};
      otherReturns.forEach(ret => {
        ret.items.forEach(item => {
          totalReturnedItems[item.productId] = (totalReturnedItems[item.productId] || 0) + item.quantity;
        });
      });

      // Verificar si todos los productos están devueltos
      const allReturned = updatedItems.every(item => {
        const returnedQty = totalReturnedItems[item.productId] || 0;
        return returnedQty >= item.quantity;
      });

      newStatus = allReturned ? 'returned' : 'partial_return';
    }

    // Actualizar la factura
    const { error: updateError } = await supabase
      .from('invoices')
      .update({
        status: newStatus,
        items: updatedItems,
        subtotal: newSubtotal,
        tax: newTax,
        total: newTotal
      })
      .eq('id', returnData.invoice_id);

    if (updateError) {
      console.error('Error actualizando factura:', updateError);
      return false;
    }

    // Eliminar el registro de devolución
    const { error: deleteError } = await supabase
      .from('returns')
      .delete()
      .eq('id', returnId);

    if (deleteError) {
      console.error('Error eliminando devolución:', deleteError);
      return false;
    }

    console.log(`[revertReturn] Devolución ${returnData.return_number} revertida exitosamente`);
    return true;
  } catch (error) {
    console.error('Error revirtiendo devolución:', error);
    return false;
  }
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
 * Calcula los ingresos netos considerando devoluciones y cambios
 * Suma Efectivo + Transferencias (incluye Nequi y Daviplata) + Otros
 * Resta devoluciones y ajusta por el impacto financiero de los cambios
 */
export const calculateNetRevenue = (invoices: Invoice[], returns: Return[], exchanges: Exchange[] = []): number => {
  let totalCash = 0;
  let totalTransfer = 0;
  let totalOthers = 0;

  // Sumar pagos de facturas pagadas (incluye crédito pagado y devoluciones parciales)
  invoices
    .filter(inv => inv.status === 'paid' || inv.status === 'partial_return')
    .forEach(invoice => {
      const paymentStr = invoice.payment_method || '';

      // Verificar si tiene formato detallado (con montos) o simple (solo nombre)
      const hasDetailedFormat = paymentStr.includes(':');

      if (hasDetailedFormat) {
        // FORMATO DETALLADO: "Efectivo: $200.000, Nequi: $100.000"

        // Extraer efectivo
        const cashMatch = paymentStr.match(/Efectivo:\s*\$?([\d,.]+)/i);
        if (cashMatch) {
          const cashValue = parseFloat(cashMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(cashValue)) totalCash += cashValue;
        }

        // Extraer transferencia
        const transferMatch = paymentStr.match(/Transferencia:\s*\$?([\d,.]+)/i);
        if (transferMatch) {
          const transferValue = parseFloat(transferMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(transferValue)) totalTransfer += transferValue;
        }

        // Extraer Nequi
        const nequiMatch = paymentStr.match(/Nequi:\s*\$?([\d,.]+)/i);
        if (nequiMatch) {
          const nequiValue = parseFloat(nequiMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(nequiValue)) totalTransfer += nequiValue;
        }

        // Extraer Daviplata
        const daviplataMatch = paymentStr.match(/Daviplata:\s*\$?([\d,.]+)/i);
        if (daviplataMatch) {
          const daviplataValue = parseFloat(daviplataMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(daviplataValue)) totalTransfer += daviplataValue;
        }

        // Extraer Otros
        const otherMatch = paymentStr.match(/Otros:\s*\$?([\d,.]+)/i);
        if (otherMatch) {
          const otherValue = parseFloat(otherMatch[1].replace(/\./g, '').replace(/,/g, '.'));
          if (!isNaN(otherValue)) totalOthers += otherValue;
        }
      } else {
        // FORMATO SIMPLE: solo el nombre del método
        const paymentLower = paymentStr.toLowerCase().trim();
        const invoiceTotal = invoice.total || 0;

        if (paymentLower === 'efectivo') {
          totalCash += invoiceTotal;
        } else if (paymentLower === 'transferencia' || paymentLower === 'nequi' || paymentLower === 'daviplata') {
          totalTransfer += invoiceTotal;
        } else if (paymentLower === 'otros') {
          totalOthers += invoiceTotal;
        }
      }
    });

  const totalRevenue = totalCash + totalTransfer + totalOthers;

  // Calcular impacto de CAMBIOS
  // - Si price_difference > 0: El cliente pagó más (SUMA)
  // - Si price_difference < 0: Se le devolvió dinero (RESTA)
  // - Si price_difference === 0: No afecta ingresos
  const exchangesImpact = exchanges.reduce((sum, exchange) => {
    if (exchange.price_difference > 0) {
      return sum + exchange.price_difference; // Cliente pagó diferencia
    } else if (exchange.price_difference < 0) {
      return sum + exchange.price_difference; // Se devolvió dinero (negativo)
    }
    return sum; // Sin impacto si es 0
  }, 0);

  // No restamos totalReturns porque las facturas 'returned' ya no se cuentan en totalRevenue
  // Solo incluimos facturas 'paid' y 'partial_return'
  return totalRevenue + exchangesImpact;
};

// ============================================
// CLIENTES
// ============================================

export const getCustomers = async (): Promise<Customer[]> => {
  const company = getCurrentCompany();

  return cache.withCache(
    cacheKeys.customers(company),
    async () => {
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
    },
    5 * 60 * 1000 // 5 minutos
  );
};

export const getCustomerByDocument = async (document: string): Promise<Customer | null> => {
  const company = getCurrentCompany();

  // Limpiar el documento de espacios en blanco
  const cleanDocument = document.trim();

  console.log('Buscando cliente:', { company, document: cleanDocument });

  // Primero, intentar encontrar el cliente con búsqueda exacta
  let { data, error } = await supabase
    .from('customers')
    .select('*')
    .eq('company', company)
    .eq('document', cleanDocument)
    .single();

  if (error && error.code === 'PGRST116') {
    // Si no se encuentra, hacer una búsqueda de diagnóstico
    console.log('Cliente no encontrado con búsqueda exacta. Buscando todos los clientes...');

    const { data: allCustomers, error: allError } = await supabase
      .from('customers')
      .select('id, name, document')
      .eq('company', company)
      .limit(50);

    if (!allError && allCustomers) {
      console.log('Todos los clientes de la empresa:', allCustomers);
      console.log('Documentos disponibles:', allCustomers.map(c => `"${c.document}"`));

      // Intentar buscar de forma flexible (case-insensitive, eliminando espacios)
      const found = allCustomers.find(c =>
        c.document.trim().toLowerCase() === cleanDocument.toLowerCase()
      );

      if (found) {
        console.log('Cliente encontrado con búsqueda flexible:', found);
        // Obtener el cliente completo
        const { data: fullData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', found.id)
          .single();
        return fullData || null;
      }
    }

    console.log('Cliente no encontrado con documento:', cleanDocument);
    return null;
  }

  if (error) {
    console.error('Error fetching customer:', error);
    return null;
  }

  console.log('Cliente encontrado:', data);
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

  // Invalidar caché de clientes para forzar recarga
  invalidateCache.customers(company);

  return data;
};

export const updateCustomer = async (id: string, updates: Partial<Customer>): Promise<Customer | null> => {
  const company = getCurrentCompany();

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

  // Invalidar caché de clientes para forzar recarga
  invalidateCache.customers(company);

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

/**
 * Calcula la ganancia de una factura basándose en sus items
 * Ganancia = Total de venta - Costo total de productos
 */
export const calculateInvoiceProfit = async (invoiceId: string): Promise<number> => {
  // Obtener la factura con sus items
  const { data: invoice } = await supabase
    .from('invoices')
    .select('items, total')
    .eq('id', invoiceId)
    .single();

  if (!invoice || !invoice.items) {
    return 0;
  }

  let totalCost = 0;

  // Calcular costo total
  for (const item of invoice.items) {
    const { data: product } = await supabase
      .from('products')
      .select('current_cost')
      .eq('id', item.productId)
      .single();

    if (product) {
      totalCost += product.current_cost * item.quantity;
    }
  }

  // Ganancia = Total - Costo
  const profit = invoice.total - totalCost;
  return profit;
};

export const addCreditPayment = async (payment: Omit<CreditPayment, 'id' | 'company' | 'created_at'>): Promise<CreditPayment | null> => {
  const company = getCurrentCompany();

  // Convertir la fecha YYYY-MM-DD a timestamp ISO en zona horaria de Colombia
  const paymentDate = payment.date && payment.date.length === 10 && !payment.date.includes('T')
    ? dateStringToColombiaISO(payment.date)
    : payment.date;

  // Crear el abono
  const { data, error } = await supabase
    .from('credit_payments')
    .insert([{
      ...payment,
      date: paymentDate,
      company
    }])
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
    const wasUnpaid = invoice.credit_balance > 0 || (invoice.credit_balance === undefined && invoice.total > 0);
    const isNowPaid = newBalance <= 0;
    const newStatus = isNowPaid ? 'paid' : 'pending';

    await updateInvoice(payment.invoice_id, {
      credit_balance: newBalance,
      status: newStatus
    });

    // Si la factura acaba de ser completamente pagada, sumar ganancia al cierre mensual actual
    if (wasUnpaid && isNowPaid) {
      const profit = await calculateInvoiceProfit(payment.invoice_id);

      // Obtener o crear cierre del mes actual
      const now = new Date(paymentDate);
      const monthStr = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const monthKey = `${year}-${monthStr}`;

      // Buscar cierre mensual existente
      const { data: existingClosure } = await supabase
        .from('monthly_closures')
        .select('*')
        .eq('company', company)
        .eq('month', monthKey)
        .eq('year', year)
        .single();

      if (existingClosure) {
        // Actualizar cierre existente sumando la ganancia cobrada
        await supabase
          .from('monthly_closures')
          .update({
            profit_collected: (existingClosure.profit_collected || 0) + profit
          })
          .eq('id', existingClosure.id);
      }
      // Si no existe cierre mensual aún, la ganancia se sumará cuando se cree el cierre
    }
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
      .select('*')
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

  const isPendingExchange = exchangeData.status === 'pending';

  // ============================================
  // PROCESAR PRODUCTOS ORIGINALES (MÚLTIPLES)
  // ============================================
  for (const originalProd of exchangeData.original_products) {
    // 1. Registrar movimiento de entrada
    await addMovement({
      type: 'entry',
      product_id: originalProd.productId,
      product_name: originalProd.productName,
      quantity: originalProd.quantity,
      reason: isPendingExchange ? 'Cambio en espera - Producto devuelto' : 'Cambio - Producto devuelto',
      reference: exchange_number,
      user_name: exchangeData.registered_by,
      unit_ids: originalProd.unitIds || []
    });

    // 2. Actualizar stock del producto original (sumar)
    const { data: product } = await supabase
      .from('products')
      .select('*')
      .eq('id', originalProd.productId)
      .single();

    if (product) {
      const newStock = product.stock + originalProd.quantity;
      let newRegisteredIds = product.registered_ids || [];

      // Si el producto usa IDs únicas, agregarlas de vuelta
      if (product.use_unit_ids && originalProd.unitIds && originalProd.unitIds.length > 0) {
        if (isPendingExchange) {
          const { restoreIdsForExchange } = await import('./unit-ids-utils');
          newRegisteredIds = restoreIdsForExchange(newRegisteredIds, originalProd.unitIds, data.id);
        } else {
          const { convertToIdsWithNotes } = await import('./unit-ids-utils');
          const idsAsObjects = convertToIdsWithNotes(originalProd.unitIds);
          newRegisteredIds = [...idsAsObjects, ...newRegisteredIds];
        }
      }

      await updateProduct(originalProd.productId, {
        stock: newStock,
        registered_ids: newRegisteredIds
      });
    }
  }

  // ============================================
  // PROCESAR PRODUCTOS NUEVOS (MÚLTIPLES)
  // Solo si NO es un cambio en espera
  // ============================================
  if (!isPendingExchange && exchangeData.new_products.length > 0) {
    for (const newProd of exchangeData.new_products) {
      // 1. Registrar movimiento de salida
      await addMovement({
        type: 'exit',
        product_id: newProd.productId,
        product_name: newProd.productName,
        quantity: newProd.quantity,
        reason: 'Cambio - Producto entregado',
        reference: exchange_number,
        user_name: exchangeData.registered_by,
        unit_ids: newProd.unitIds || []
      });

      // 2. Actualizar stock del producto nuevo (restar)
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', newProd.productId)
        .single();

      if (product) {
        const newStock = product.stock - newProd.quantity;
        let newRegisteredIds = product.registered_ids || [];

        // Si el producto usa IDs únicas, removerlas
        if (product.use_unit_ids && newProd.unitIds && newProd.unitIds.length > 0) {
          newRegisteredIds = newRegisteredIds.filter(
            (idObj: any) => !newProd.unitIds?.includes(typeof idObj === 'string' ? idObj : idObj.id)
          );
        }

        await updateProduct(newProd.productId, {
          stock: newStock,
          registered_ids: newRegisteredIds
        });
      }
    }
  }

  return data;
};

/**
 * Finalizar un cambio en espera
 */
export const finalizeExchange = async (
  exchangeId: string,
  finalizeData: {
    new_products: ExchangeProduct[];
    payment_method?: string;
    payment_cash?: number;
    payment_transfer?: number;
    payment_other?: number;
  }
): Promise<Exchange | null> => {
  try {
    const company = getCurrentCompany();

    // 1. Obtener el cambio en espera
    const { data: exchange, error: fetchError } = await supabase
      .from('exchanges')
      .select('*')
      .eq('id', exchangeId)
      .eq('company', company)
      .single();

    if (fetchError || !exchange) {
      console.error('Error fetching exchange:', fetchError);
      return null;
    }

    if (exchange.status !== 'pending') {
      console.error('Exchange is not in pending status');
      return null;
    }

    // 2. Calcular diferencia de precio
    const new_total = finalizeData.new_products.reduce((sum, p) => sum + p.total, 0);
    const price_difference = new_total - exchange.original_total;

    // 3. Procesar cada producto nuevo (sacar del inventario)
    for (const newProd of finalizeData.new_products) {
      // Registrar movimiento de salida
      await addMovement({
        type: 'exit',
        product_id: newProd.productId,
        product_name: newProd.productName,
        quantity: newProd.quantity,
        reason: 'Cambio finalizado - Producto entregado',
        reference: exchange.exchange_number,
        user_name: exchange.registered_by,
        unit_ids: newProd.unitIds || []
      });

      // Actualizar stock
      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', newProd.productId)
        .single();

      if (product) {
        const newStock = product.stock - newProd.quantity;
        let newRegisteredIds = product.registered_ids || [];

        // Si el producto usa IDs únicas, eliminarlas definitivamente
        if (product.use_unit_ids && newProd.unitIds && newProd.unitIds.length > 0) {
          const { removeIds } = await import('./unit-ids-utils');
          newRegisteredIds = removeIds(newRegisteredIds, newProd.unitIds);
        }

        await updateProduct(newProd.productId, {
          stock: newStock,
          registered_ids: newRegisteredIds
        });
      }
    }

    // 4. Liberar las IDs del producto original que estaban marcadas como "en cambio"
    // (si el cambio original tenía IDs de productos con uso de IDs únicas)
    if (exchange.original_products && Array.isArray(exchange.original_products)) {
      // Si usa el formato nuevo de arrays
      for (const originalProd of exchange.original_products) {
        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', originalProd.productId)
          .single();

        if (product && product.use_unit_ids && originalProd.unitIds && originalProd.unitIds.length > 0) {
          const { releaseExchangeIds } = await import('./unit-ids-utils');
          const newRegisteredIds = releaseExchangeIds(product.registered_ids || [], exchangeId);

          await updateProduct(originalProd.productId, {
            registered_ids: newRegisteredIds
          });
        }
      }
    } else {
      // Compatibilidad con formato antiguo (single product)
      const { data: originalProduct } = await supabase
        .from('products')
        .select('*')
        .eq('id', exchange.original_product_id)
        .single();

      if (originalProduct && originalProduct.use_unit_ids && exchange.original_unit_ids && exchange.original_unit_ids.length > 0) {
        const { releaseExchangeIds } = await import('./unit-ids-utils');
        const newRegisteredIds = releaseExchangeIds(originalProduct.registered_ids || [], exchangeId);

        await updateProduct(exchange.original_product_id, {
          registered_ids: newRegisteredIds
        });
      }
    }

    // 5. Actualizar el cambio con los datos de los productos nuevos
    const { data: updatedExchange, error: updateError } = await supabase
      .from('exchanges')
      .update({
        status: 'completed',
        // Nuevo formato con arrays
        new_products: finalizeData.new_products,
        // Compatibilidad con campos antiguos (primer producto)
        new_product_id: finalizeData.new_products[0]?.productId,
        new_product_name: finalizeData.new_products[0]?.productName,
        new_quantity: finalizeData.new_products.reduce((sum, p) => sum + p.quantity, 0),
        new_price: finalizeData.new_products[0]?.price || 0,
        new_total: new_total,
        new_unit_ids: finalizeData.new_products[0]?.unitIds || [],
        price_difference: price_difference,
        payment_method: finalizeData.payment_method,
        payment_cash: finalizeData.payment_cash || 0,
        payment_transfer: finalizeData.payment_transfer || 0,
        payment_other: finalizeData.payment_other || 0
      })
      .eq('id', exchangeId)
      .eq('company', company)
      .select('*')
      .single();

    if (updateError) {
      console.error('Error updating exchange:', updateError);
      return null;
    }

    console.log(`✅ Exchange ${exchange.exchange_number} finalized successfully`);
    return updatedExchange;
  } catch (error) {
    console.error('Error in finalizeExchange:', error);
    return null;
  }
};

/**
 * Cancelar un cambio en espera
 */
export const cancelExchange = async (exchangeId: string): Promise<boolean> => {
  try {
    const company = getCurrentCompany();

    // 1. Obtener el cambio en espera
    const { data: exchange, error: fetchError } = await supabase
      .from('exchanges')
      .select('*')
      .eq('id', exchangeId)
      .eq('company', company)
      .single();

    if (fetchError || !exchange) {
      console.error('Error fetching exchange:', fetchError);
      return false;
    }

    if (exchange.status !== 'pending') {
      console.error('Exchange is not in pending status');
      return false;
    }

    // 2. Devolver los productos originales de vuelta al cliente (revertir la devolución)
    // Esto significa sacarlos del inventario nuevamente
    const originalProducts = exchange.original_products && Array.isArray(exchange.original_products)
      ? exchange.original_products
      : [{
          productId: exchange.original_product_id,
          productName: exchange.original_product_name,
          quantity: exchange.original_quantity,
          price: exchange.original_price,
          total: exchange.original_total,
          unitIds: exchange.original_unit_ids
        }];

    for (const originalProd of originalProducts) {
      await addMovement({
        type: 'exit',
        product_id: originalProd.productId,
        product_name: originalProd.productName,
        quantity: originalProd.quantity,
        reason: 'Cambio cancelado - Producto devuelto al cliente',
        reference: exchange.exchange_number,
        user_name: exchange.registered_by,
        unit_ids: originalProd.unitIds || []
      });

      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', originalProd.productId)
        .single();

      if (product) {
        const newStock = product.stock - originalProd.quantity;
        let newRegisteredIds = product.registered_ids || [];

        // Si el producto usa IDs únicas, liberar las IDs que estaban marcadas como "en cambio"
        if (product.use_unit_ids && originalProd.unitIds && originalProd.unitIds.length > 0) {
          const { releaseExchangeIds } = await import('./unit-ids-utils');
          newRegisteredIds = releaseExchangeIds(newRegisteredIds, exchangeId);
        }

        await updateProduct(originalProd.productId, {
          stock: newStock,
          registered_ids: newRegisteredIds
        });
      }
    }

    // 3. Eliminar el cambio pendiente (no marcarlo como cancelado)
    const { error: deleteError } = await supabase
      .from('exchanges')
      .delete()
      .eq('id', exchangeId)
      .eq('company', company);

    if (deleteError) {
      console.error('Error deleting exchange:', deleteError);
      return false;
    }

    console.log(`✅ Exchange ${exchange.exchange_number} deleted successfully`);
    return true;
  } catch (error) {
    console.error('Error in cancelExchange:', error);
    return false;
  }
};

export const getExchangesStats = async () => {
  const exchanges = await getExchanges();

  // Solo contar cambios completados (excluir pendientes y cancelados)
  const completedExchanges = exchanges.filter(e => e.status === 'completed');

  const totalExchanges = completedExchanges.length;
  const exchangesByInvoice = completedExchanges.filter(e => e.type === 'invoice').length;
  const directExchanges = completedExchanges.filter(e => e.type === 'direct').length;

  // Calcular diferencia total (cuánto han pagado los clientes por diferencias)
  // Solo de cambios completados
  const totalPositiveDifference = completedExchanges
    .filter(e => e.price_difference > 0)
    .reduce((sum, e) => sum + e.price_difference, 0);

  // Calcular diferencia total negativa (cuánto se les ha devuelto a los clientes)
  // Solo de cambios completados
  const totalNegativeDifference = completedExchanges
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
  // Solo contar cambios completados (excluir pendientes y cancelados)
  const completedExchanges = exchanges.filter(ex => ex.status === 'completed');

  // El impacto neto es la suma de todas las diferencias de precio
  return completedExchanges.reduce((sum, ex) => {
    return sum + ex.price_difference;
  }, 0);
};

/**
 * Calcula los ingresos netos considerando cambios
 */
export const calculateNetRevenueWithExchanges = (invoices: Invoice[], exchanges: Exchange[]): number => {
  // Solo incluir facturas pagadas y con devolución parcial (no las completamente devueltas)
  const totalRevenue = invoices
    .filter(inv => inv.status === 'paid' || inv.status === 'partial_return')
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
    
    // 1. REVERTIR: Sacar los productos originales del inventario (los que devolvieron)
    // Porque al crear el cambio se AGREGARON al inventario
    const originalProducts = exchange.original_products && Array.isArray(exchange.original_products)
      ? exchange.original_products
      : [{
          productId: exchange.original_product_id,
          productName: exchange.original_product_name,
          quantity: exchange.original_quantity,
          price: exchange.original_price,
          total: exchange.original_total,
          unitIds: exchange.original_unit_ids
        }];

    for (const originalProd of originalProducts) {
      await addMovement({
        type: 'exit',
        product_id: originalProd.productId,
        product_name: originalProd.productName,
        quantity: originalProd.quantity,
        reason: 'Cambio eliminado - Revertir devolución',
        reference: exchange.exchange_number,
        user_name: user.username,
        unit_ids: originalProd.unitIds || []
      });

      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', originalProd.productId)
        .single();

      if (product) {
        const newStock = product.stock - originalProd.quantity;
        let newRegisteredIds = product.registered_ids || [];

        // Si el producto usa IDs únicas, removerlas
        if (product.use_unit_ids && originalProd.unitIds && originalProd.unitIds.length > 0) {
          newRegisteredIds = newRegisteredIds.filter(
            (idObj: any) => !originalProd.unitIds?.includes(typeof idObj === 'string' ? idObj : idObj.id)
          );
        }

        await updateProduct(originalProd.productId, {
          stock: newStock,
          registered_ids: newRegisteredIds
        });
      }
    }

    // 2. REVERTIR: Devolver los productos nuevos al inventario (los que entregaron)
    // Porque al crear el cambio se RESTARON del inventario
    if (exchange.new_product_id) {
      const newProducts = exchange.new_products && Array.isArray(exchange.new_products)
        ? exchange.new_products
        : [{
            productId: exchange.new_product_id,
            productName: exchange.new_product_name,
            quantity: exchange.new_quantity,
            price: exchange.new_price,
            total: exchange.new_total,
            unitIds: exchange.new_unit_ids
          }];

      for (const newProd of newProducts) {
        await addMovement({
          type: 'entry',
          product_id: newProd.productId,
          product_name: newProd.productName,
          quantity: newProd.quantity,
          reason: 'Cambio eliminado - Devolver producto',
          reference: exchange.exchange_number,
          user_name: user.username,
          unit_ids: newProd.unitIds || []
        });

        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', newProd.productId)
          .single();

        if (product) {
          const newStock = product.stock + newProd.quantity;
          let newRegisteredIds = product.registered_ids || [];

          // Si el producto usa IDs únicas, agregarlas de vuelta
          if (product.use_unit_ids && newProd.unitIds && newProd.unitIds.length > 0) {
            const { convertToIdsWithNotes } = await import('./unit-ids-utils');
            const idsAsObjects = convertToIdsWithNotes(newProd.unitIds);
            newRegisteredIds = [...idsAsObjects, ...newRegisteredIds];
          }

          await updateProduct(newProd.productId, {
            stock: newStock,
            registered_ids: newRegisteredIds
          });
        }
      }
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
        // No eliminar las IDs, solo marcarlas como en garantía
        const { markIdsAsWarranty } = await import('./unit-ids-utils');
        newRegisteredIds = markIdsAsWarranty(newRegisteredIds, warrantyData.unit_ids, data.id);
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
  
  // Manejar cambios en stock e IDs para garantías resueltas o canceladas
  if (status === 'resolved' || status === 'cancelled') {
    const { data: warranty } = await supabase
      .from('warranties')
      .select('*')
      .eq('id', id)
      .single();

    if (warranty && warranty.discount_from_stock) {
      // Solo añadir movimiento de entrada si se resolvió (producto devuelto)
      if (status === 'resolved') {
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
      }

      const { data: product } = await supabase
        .from('products')
        .select('*')
        .eq('id', warranty.product_id)
        .single();

      if (product) {
        let newStock = product.stock;
        let newRegisteredIds = product.registered_ids || [];

        // Solo incrementar stock si se resolvió (producto devuelto al inventario)
        if (status === 'resolved') {
          newStock = product.stock + warranty.quantity;
        }

        if (product.use_unit_ids && warranty.unit_ids && warranty.unit_ids.length > 0) {
          const { releaseWarrantyIds } = await import('./unit-ids-utils');

          // Si se resolvió, liberar como disponibles
          // Si se canceló, liberar como vendidas (el producto no volvió)
          const markAsSold = status === 'cancelled';
          newRegisteredIds = releaseWarrantyIds(newRegisteredIds, id, markAsSold);
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

// ============================================
// CATÁLOGO PÚBLICO
// ============================================

export const getCatalogProducts = async (company: 'celumundo' | 'repuestos'): Promise<PublicCatalog[]> => {
  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .select('*')
      .eq('company', company)
      .order('display_order', { ascending: true });

    if (error) {
      if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
        console.error('⚠️ La tabla "public_catalogs" no existe en Supabase.');
        console.error('📋 SOLUCIÓN: Ejecuta el script SQL proporcionado para crear la tabla');
        return [];
      }
      console.error('Error fetching catalog products:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error fetching catalog products:', error);
    return [];
  }
};

export const addProductToCatalog = async (
  company: 'celumundo' | 'repuestos',
  productId: string,
  priceType: 'price1' | 'price2' | 'final_price',
  imageUrl?: string
): Promise<PublicCatalog | null> => {
  try {
    // Get current max display_order for this company
    const { data: existing } = await supabase
      .from('public_catalogs')
      .select('display_order')
      .eq('company', company)
      .order('display_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = existing ? existing.display_order + 1 : 1;

    const { data, error } = await supabase
      .from('public_catalogs')
      .insert([{
        company,
        product_id: productId,
        price_type: priceType,
        display_order: nextOrder,
        image_url: imageUrl || null
      }])
      .select()
      .single();

    if (error) {
      console.error('Error adding product to catalog:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error adding product to catalog:', error);
    return null;
  }
};

export const removeProductFromCatalog = async (catalogId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('public_catalogs')
      .delete()
      .eq('id', catalogId);

    if (error) {
      console.error('Error removing product from catalog:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error removing product from catalog:', error);
    return false;
  }
};

export const updateCatalogPriceType = async (
  catalogId: string,
  priceType: 'price1' | 'price2' | 'final_price'
): Promise<PublicCatalog | null> => {
  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .update({ price_type: priceType })
      .eq('id', catalogId)
      .select()
      .single();

    if (error) {
      console.error('Error updating catalog price type:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating catalog price type:', error);
    return null;
  }
};

export const updateCatalogDisplayOrder = async (
  catalogId: string,
  newOrder: number
): Promise<PublicCatalog | null> => {
  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .update({ display_order: newOrder })
      .eq('id', catalogId)
      .select()
      .single();

    if (error) {
      console.error('Error updating catalog display order:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating catalog display order:', error);
    return null;
  }
};

export const updateCatalogImage = async (
  catalogId: string,
  imageUrl: string | null
): Promise<PublicCatalog | null> => {
  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .update({ image_url: imageUrl })
      .eq('id', catalogId)
      .select()
      .single();

    if (error) {
      console.error('Error updating catalog image:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating catalog image:', error);
    return null;
  }
};

// ============================================
// GESTIÓN DE CATÁLOGO PÚBLICO
// ============================================

/**
 * Obtener todos los productos del catálogo
 */
export const getCatalogItems = async (): Promise<CatalogItem[]> => {
  const company = getCurrentCompany();

  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .select('*')
      .eq('company', company)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching catalog items:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching catalog items:', error);
    return [];
  }
};

/**
 * Agregar un producto al catálogo
 */
export const addCatalogItem = async (
  item: Omit<CatalogItem, 'id' | 'created_at' | 'updated_at'>
): Promise<CatalogItem | null> => {
  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .insert([item])
      .select()
      .single();

    if (error) {
      console.error('Error adding catalog item:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error adding catalog item:', error);
    return null;
  }
};

/**
 * Actualizar un producto del catálogo
 */
export const updateCatalogItem = async (
  catalogId: string,
  updates: Partial<Omit<CatalogItem, 'id' | 'created_at' | 'updated_at'>>
): Promise<CatalogItem | null> => {
  try {
    const { data, error } = await supabase
      .from('public_catalogs')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', catalogId)
      .select()
      .single();

    if (error) {
      console.error('Error updating catalog item:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating catalog item:', error);
    return null;
  }
};

/**
 * Eliminar un producto del catálogo
 */
export const deleteCatalogItem = async (catalogId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('public_catalogs')
      .delete()
      .eq('id', catalogId);

    if (error) {
      console.error('Error deleting catalog item:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting catalog item:', error);
    return false;
  }
};

// ==================== FACTURAS GUARDADAS ====================

export interface InvoiceSave {
  id: string;
  company: string;
  invoice_type: 'regular' | 'credito';
  save_name?: string;
  invoice_data: any; // JSON con todos los datos de la factura
  created_at: string;
  updated_at: string;
  created_by?: string;
}

/**
 * Guardar una factura en progreso
 */
export const saveInvoiceDraft = async (
  invoiceType: 'regular' | 'credito',
  invoiceData: any,
  saveName?: string
): Promise<InvoiceSave | null> => {
  try {
    const company = getCurrentCompany();
    const currentUserData = getCurrentUser();

    const { data, error } = await supabase
      .from('invoice_saves')
      .insert([{
        company,
        invoice_type: invoiceType,
        save_name: saveName,
        invoice_data: invoiceData,
        created_by: currentUserData?.username
      }])
      .select()
      .single();

    if (error) {
      console.error('Error saving invoice draft:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error saving invoice draft:', error);
    return null;
  }
};

/**
 * Obtener todas las facturas guardadas
 */
export const getInvoiceSaves = async (invoiceType?: 'regular' | 'credito'): Promise<InvoiceSave[]> => {
  try {
    const company = getCurrentCompany();

    let query = supabase
      .from('invoice_saves')
      .select('*')
      .eq('company', company)
      .order('created_at', { ascending: false });

    if (invoiceType) {
      query = query.eq('invoice_type', invoiceType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching invoice saves:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching invoice saves:', error);
    return [];
  }
};

/**
 * Eliminar una factura guardada
 */
export const deleteInvoiceSave = async (saveId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('invoice_saves')
      .delete()
      .eq('id', saveId);

    if (error) {
      console.error('Error deleting invoice save:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting invoice save:', error);
    return false;
  }
};