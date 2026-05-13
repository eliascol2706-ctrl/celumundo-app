import { supabase, getCurrentCompany } from './supabase';

export interface ServiceOrder {
  id: string;
  company: 'celumundo' | 'repuestos';
  received_date: string;
  payment_status: 'pending' | 'paid' | 'cancelled';
  final_price?: number;
  customer_name?: string;
  customer_phone?: string;
  device_type?: string;
  brand?: string;
  model?: string;
  issue_description?: string;
  diagnosis?: string;
  repair_notes?: string;
  warranty_days?: number;
  technician_name?: string;
  delivery_date?: string;
  tracking_code?: string;
  status?: string;
  priority?: string;
}

export interface ServiceOrderTimeline {
  id: string;
  service_order_id: string;
  status: string;
  notes?: string;
  created_at: string;
  created_by: string;
}

export async function getServiceOrders(): Promise<ServiceOrder[]> {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('company', company)
      .order('received_date', { ascending: false });

    if (error) {
      // Si la tabla no existe, retornar array vacío sin mostrar error
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        return [];
      }
      console.error('Error fetching service orders:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getServiceOrders:', error);
    return [];
  }
}

export async function getServiceOrderByTrackingCode(trackingCode: string): Promise<ServiceOrder | null> {
  try {
    const company = getCurrentCompany();
    const { data, error } = await supabase
      .from('service_orders')
      .select('*')
      .eq('company', company)
      .eq('tracking_code', trackingCode)
      .single();

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        return null;
      }
      console.error('Error fetching service order by tracking code:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getServiceOrderByTrackingCode:', error);
    return null;
  }
}

export async function getServiceOrderTimeline(orderId: string): Promise<ServiceOrderTimeline[]> {
  try {
    const { data, error } = await supabase
      .from('service_order_timeline')
      .select('*')
      .eq('service_order_id', orderId)
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('Could not find the table')) {
        return [];
      }
      console.error('Error fetching service order timeline:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getServiceOrderTimeline:', error);
    return [];
  }
}

export function getStatusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    received: 'Recibido',
    diagnosis: 'Diagnóstico',
    repairing: 'En reparación',
    waiting_parts: 'Esperando repuesto',
    ready: 'Listo',
    delivered: 'Entregado',
  };
  return statusMap[status] || status;
}

export function getPriorityLabel(priority: string): string {
  const priorityMap: Record<string, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
  };
  return priorityMap[priority] || priority;
}
