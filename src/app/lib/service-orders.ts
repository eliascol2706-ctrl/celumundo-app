import { supabase, getCurrentCompany, getCurrentUser } from './supabase';

// ============================================
// INTERFACES - SERVICIO TÉCNICO
// ============================================

export interface Technician {
  id: string;
  company: 'celumundo' | 'repuestos';
  name: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ServiceOrder {
  id: string;
  company: 'celumundo' | 'repuestos';
  order_number: string;
  
  // Cliente
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  
  // Dispositivo
  device_brand: string;
  device_model: string;
  device_imei?: string;
  device_serial?: string;
  device_password?: string;
  
  // Problema y servicio
  reported_problem: string;
  diagnosis?: string;
  repair_details?: string;
  
  // Estado
  status: 'received' | 'diagnosis' | 'repairing' | 'waiting_parts' | 'ready' | 'delivered' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  
  // Técnico
  technician_id?: string;
  
  // Precios
  estimated_price?: number;
  final_price?: number;
  payment_status: 'pending' | 'partial' | 'paid';
  paid_amount: number;
  
  // Fechas
  received_date: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  
  // Seguimiento
  tracking_code?: string;
  
  // Notas
  observations?: string;
  internal_notes?: string;
  
  // Metadata
  created_at?: string;
  updated_at?: string;
  created_by?: string;
}

export interface ServiceOrderTimeline {
  id: string;
  service_order_id: string;
  event_type: 'status_change' | 'note' | 'payment' | 'part_added' | 'photo_added';
  description: string;
  old_status?: string;
  new_status?: string;
  created_by?: string;
  created_at?: string;
}

export interface ServiceOrderPart {
  id: string;
  service_order_id: string;
  part_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_id?: string;
  created_at?: string;
}

export interface ServiceOrderPhoto {
  id: string;
  service_order_id: string;
  photo_url: string;
  photo_type: 'before' | 'during' | 'after';
  description?: string;
  created_at?: string;
}

// ============================================
// FUNCIONES - TÉCNICOS
// ============================================

export const getTechnicians = async (): Promise<Technician[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('technicians')
      .select('*')
      .eq('company', company)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching technicians:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching technicians:', error);
    return [];
  }
};

export const addTechnician = async (technician: Omit<Technician, 'id' | 'company' | 'created_at' | 'updated_at'>): Promise<Technician | null> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('technicians')
      .insert({ ...technician, company })
      .select()
      .single();

    if (error) {
      console.error('Error adding technician:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error adding technician:', error);
    return null;
  }
};

export const updateTechnician = async (id: string, updates: Partial<Technician>): Promise<Technician | null> => {
  try {
    const { data, error } = await supabase
      .from('technicians')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating technician:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating technician:', error);
    return null;
  }
};

export const deleteTechnician = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('technicians')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting technician:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting technician:', error);
    return false;
  }
};

// ============================================
// FUNCIONES - ÓRDENES DE SERVICIO
// ============================================

export const getServiceOrders = async (): Promise<ServiceOrder[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('company', company)
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching service orders:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching service orders:', error);
    return [];
  }
};

export const getServiceOrderById = async (id: string): Promise<ServiceOrder | null> => {
  try {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching service order:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching service order:', error);
    return null;
  }
};

export const getServiceOrderByTracking = async (trackingCode: string): Promise<ServiceOrder | null> => {
  try {
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('tracking_code', trackingCode)
      .single();

    if (error) {
      console.error('Error fetching service order by tracking:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error fetching service order by tracking:', error);
    return null;
  }
};

// Alias para compatibilidad
export const getServiceOrderByTrackingCode = getServiceOrderByTracking;

export const addServiceOrder = async (order: Omit<ServiceOrder, 'id' | 'order_number' | 'company' | 'created_at' | 'updated_at'>): Promise<ServiceOrder | null> => {
  try {
    const company = getCurrentCompany();
    const currentUser = getCurrentUser();
    
    // Generar número de orden
    const { data: lastOrder } = await supabase
      .from('service_orders')
      .select('order_number')
      .eq('company', company)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let orderNumber = 'ST-0001';
    if (lastOrder && lastOrder.order_number) {
      const lastNumber = parseInt(lastOrder.order_number.split('-')[1]) || 0;
      orderNumber = `ST-${String(lastNumber + 1).padStart(4, '0')}`;
    }

    // Generar código de seguimiento único
    const trackingCode = `${orderNumber}-${Date.now().toString(36).toUpperCase()}`;

    const { data, error } = await supabase
      .from('service_orders')
      .insert({ 
        ...order, 
        company,
        order_number: orderNumber,
        tracking_code: trackingCode,
        created_by: currentUser?.username
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding service order:', error);
      return null;
    }

    // Agregar evento al timeline
    await addServiceOrderTimeline({
      service_order_id: data.id,
      event_type: 'status_change',
      description: `Orden creada en estado: ${getStatusLabel(data.status)}`,
      new_status: data.status,
      created_by: currentUser?.username
    });

    return data;
  } catch (error) {
    console.error('Error adding service order:', error);
    return null;
  }
};

export const updateServiceOrder = async (id: string, updates: Partial<ServiceOrder>): Promise<ServiceOrder | null> => {
  try {
    const currentUser = getCurrentUser();
    
    // Si se está cambiando el estado, registrar en el timeline
    if (updates.status) {
      const currentOrder = await getServiceOrderById(id);
      if (currentOrder && currentOrder.status !== updates.status) {
        await addServiceOrderTimeline({
          service_order_id: id,
          event_type: 'status_change',
          description: `Estado cambiado de ${getStatusLabel(currentOrder.status)} a ${getStatusLabel(updates.status)}`,
          old_status: currentOrder.status,
          new_status: updates.status,
          created_by: currentUser?.username
        });
      }
    }

    const { data, error } = await supabase
      .from('service_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating service order:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error updating service order:', error);
    return null;
  }
};

export const deleteServiceOrder = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting service order:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting service order:', error);
    return false;
  }
};

// ============================================
// FUNCIONES - TIMELINE
// ============================================

export const getServiceOrderTimeline = async (orderId: string): Promise<ServiceOrderTimeline[]> => {
  try {
    const { data, error } = await supabase
      .from('service_order_timeline')
      .select('*')
      .eq('service_order_id', orderId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching timeline:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching timeline:', error);
    return [];
  }
};

export const addServiceOrderTimeline = async (timeline: Omit<ServiceOrderTimeline, 'id' | 'created_at'>): Promise<ServiceOrderTimeline | null> => {
  try {
    const { data, error } = await supabase
      .from('service_order_timeline')
      .insert(timeline)
      .select()
      .single();

    if (error) {
      console.error('Error adding timeline event:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error adding timeline event:', error);
    return null;
  }
};

// ============================================
// FUNCIONES - REPUESTOS
// ============================================

export const getServiceOrderParts = async (orderId: string): Promise<ServiceOrderPart[]> => {
  try {
    const { data, error } = await supabase
      .from('service_order_parts')
      .select('*')
      .eq('service_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching parts:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching parts:', error);
    return [];
  }
};

export const addServiceOrderPart = async (part: Omit<ServiceOrderPart, 'id' | 'created_at'>): Promise<ServiceOrderPart | null> => {
  try {
    const currentUser = getCurrentUser();
    
    const { data, error } = await supabase
      .from('service_order_parts')
      .insert(part)
      .select()
      .single();

    if (error) {
      console.error('Error adding part:', error);
      return null;
    }

    // Registrar en el timeline
    await addServiceOrderTimeline({
      service_order_id: part.service_order_id,
      event_type: 'part_added',
      description: `Repuesto agregado: ${part.part_name} (${part.quantity} x COP ${part.unit_price.toLocaleString()})`,
      created_by: currentUser?.username
    });

    return data;
  } catch (error) {
    console.error('Error adding part:', error);
    return null;
  }
};

export const deleteServiceOrderPart = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_order_parts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting part:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting part:', error);
    return false;
  }
};

// ============================================
// FUNCIONES - FOTOS
// ============================================

export const getServiceOrderPhotos = async (orderId: string): Promise<ServiceOrderPhoto[]> => {
  try {
    const { data, error } = await supabase
      .from('service_order_photos')
      .select('*')
      .eq('service_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching photos:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching photos:', error);
    return [];
  }
};

export const addServiceOrderPhoto = async (photo: Omit<ServiceOrderPhoto, 'id' | 'created_at'>): Promise<ServiceOrderPhoto | null> => {
  try {
    const currentUser = getCurrentUser();
    
    const { data, error } = await supabase
      .from('service_order_photos')
      .insert(photo)
      .select()
      .single();

    if (error) {
      console.error('Error adding photo:', error);
      return null;
    }

    // Registrar en el timeline
    await addServiceOrderTimeline({
      service_order_id: photo.service_order_id,
      event_type: 'photo_added',
      description: `Foto agregada: ${photo.photo_type}`,
      created_by: currentUser?.username
    });

    return data;
  } catch (error) {
    console.error('Error adding photo:', error);
    return null;
  }
};

export const deleteServiceOrderPhoto = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('service_order_photos')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting photo:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting photo:', error);
    return false;
  }
};

// ============================================
// FUNCIONES AUXILIARES
// ============================================

export const getServiceOrdersStats = async () => {
  try {
    const orders = await getServiceOrders();
    
    return {
      total: orders.length,
      byStatus: {
        received: orders.filter(o => o.status === 'received').length,
        diagnosis: orders.filter(o => o.status === 'diagnosis').length,
        repairing: orders.filter(o => o.status === 'repairing').length,
        waiting_parts: orders.filter(o => o.status === 'waiting_parts').length,
        ready: orders.filter(o => o.status === 'ready').length,
        delivered: orders.filter(o => o.status === 'delivered').length,
        cancelled: orders.filter(o => o.status === 'cancelled').length,
      },
      byPriority: {
        low: orders.filter(o => o.priority === 'low').length,
        medium: orders.filter(o => o.priority === 'medium').length,
        high: orders.filter(o => o.priority === 'high').length,
      },
      totalRevenue: orders
        .filter(o => o.final_price && o.payment_status === 'paid')
        .reduce((sum, o) => sum + (o.final_price || 0), 0),
      pendingPayment: orders
        .filter(o => o.final_price && o.payment_status !== 'paid')
        .reduce((sum, o) => sum + ((o.final_price || 0) - (o.paid_amount || 0)), 0),
    };
  } catch (error) {
    console.error('Error getting service orders stats:', error);
    return {
      total: 0,
      byStatus: {},
      byPriority: {},
      totalRevenue: 0,
      pendingPayment: 0,
    };
  }
};

export const getCustomerServiceHistory = async (customerPhone: string): Promise<ServiceOrder[]> => {
  try {
    const company = getCurrentCompany();
    const { data, error} = await supabase
      .from('service_orders')
      .select('*')
      .eq('company', company)
      .eq('customer_phone', customerPhone)
      .order('received_date', { ascending: false });

    if (error) {
      console.error('Error fetching customer service history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching customer service history:', error);
    return [];
  }
};

export const getStatusLabel = (status: ServiceOrder['status']): string => {
  const labels = {
    received: 'Recibido',
    diagnosis: 'Diagnóstico',
    repairing: 'En reparación',
    waiting_parts: 'Esperando repuesto',
    ready: 'Listo',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
};

export const getPriorityLabel = (priority: ServiceOrder['priority']): string => {
  const labels = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
  };
  return labels[priority] || priority;
};

export const getPaymentStatusLabel = (status: ServiceOrder['payment_status']): string => {
  const labels = {
    pending: 'Pendiente',
    partial: 'Parcial',
    paid: 'Pagado',
  };
  return labels[status] || status;
};