import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, X, CheckCheck, Package, Clock, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import {
  getUnreadNotifications,
  upsertNotification,
  deleteNotification,
  markNotificationRead,
  markAllNotificationsRead,
  getAllProducts,
  getPendingCreditInvoices,
  type AppNotification,
} from '../lib/supabase';
import { formatCOP } from '../lib/currency';

const SYNC_INTERVAL_MS = 30 * 60 * 1000; // 30 min

function diffDays(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

const TYPE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  invoice_due_soon: {
    icon: <Clock className="w-4 h-4" />,
    color: 'text-yellow-600 dark:text-yellow-400',
    bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  },
  invoice_overdue: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
  },
  low_stock: {
    icon: <Package className="w-4 h-4" />,
    color: 'text-orange-600 dark:text-orange-400',
    bg: 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800',
  },
};

export function NotificationCenter() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const syncNotifications = useCallback(async () => {
    setSyncing(true);
    try {
      const [invoices, products] = await Promise.all([
        getPendingCreditInvoices(),
        getAllProducts(),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // ── Facturas ──────────────────────────────────────────────────────────
      for (const inv of invoices) {
        if (!inv.due_date) continue;
        const diff = diffDays(inv.due_date);

        if (diff < 0) {
          // Vencida
          await upsertNotification(
            'invoice_overdue',
            inv.id,
            'Factura vencida',
            `Factura ${inv.number} de ${inv.customer_name || 'cliente'} — saldo ${formatCOP(inv.credit_balance || 0)} — vencida hace ${Math.abs(diff)} día(s)`
          );
          // Si había "due_soon" para la misma, eliminarla
          await deleteNotification('invoice_due_soon', inv.id);
        } else if (diff <= 2) {
          // Por vencer
          await upsertNotification(
            'invoice_due_soon',
            inv.id,
            'Factura próxima a vencer',
            `Factura ${inv.number} de ${inv.customer_name || 'cliente'} — saldo ${formatCOP(inv.credit_balance || 0)} — vence en ${diff === 0 ? 'hoy' : `${diff} día(s)`}`
          );
        } else {
          // Ya no aplica — limpiar si existían
          await deleteNotification('invoice_due_soon', inv.id);
          await deleteNotification('invoice_overdue', inv.id);
        }
      }

      // ── Stock bajo ────────────────────────────────────────────────────────
      for (const product of products) {
        if (product.min_stock > 0 && product.stock <= product.min_stock) {
          await upsertNotification(
            'low_stock',
            product.id,
            'Stock bajo mínimo',
            `${product.name} (${product.code}) — stock actual: ${product.stock}, mínimo: ${product.min_stock}`
          );
        } else {
          // Stock normalizado — eliminar notificación si existía
          await deleteNotification('low_stock', product.id);
        }
      }

      // ── Cargar notificaciones no leídas ───────────────────────────────────
      const unread = await getUnreadNotifications();
      setNotifications(unread);
    } catch (err) {
      console.error('Error syncing notifications:', err);
    } finally {
      setSyncing(false);
    }
  }, []);

  // Sync al montar y cada 30 min
  useEffect(() => {
    syncNotifications();
    const interval = setInterval(syncNotifications, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [syncNotifications]);

  // Cerrar panel al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllRead = async () => {
    await markAllNotificationsRead();
    setNotifications([]);
  };

  const unreadCount = notifications.length;

  return (
    <div ref={panelRef} className="fixed top-4 right-4 z-50 flex flex-col items-end gap-3">
      {/* Botón flotante */}
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={`relative w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          isOpen
            ? 'bg-zinc-800 dark:bg-zinc-100 text-white dark:text-zinc-900'
            : 'bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-700'
        } border border-zinc-200 dark:border-zinc-700`}
      >
        <Bell className={`w-5 h-5 ${syncing ? 'animate-pulse' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center px-1 shadow">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="w-96 max-h-[70vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
              <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">Notificaciones</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={handleMarkAllRead}>
                  <CheckCheck className="w-3 h-3 mr-1" />
                  Marcar todo
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Lista */}
          <div className="overflow-y-auto flex-1">
            {syncing && notifications.length === 0 ? (
              <div className="p-8 text-center text-zinc-400 text-sm">
                <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin mx-auto mb-2" />
                Sincronizando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCheck className="w-10 h-10 mx-auto text-emerald-400 mb-2" />
                <p className="text-sm text-zinc-500 dark:text-zinc-400">Sin notificaciones pendientes</p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {notifications.map(n => {
                  const meta = TYPE_META[n.type] ?? TYPE_META.low_stock;
                  return (
                    <div key={n.id} className={`flex gap-3 p-4 ${meta.bg} border-l-4`}>
                      <div className={`mt-0.5 flex-shrink-0 ${meta.color}`}>{meta.icon}</div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${meta.color}`}>{n.title}</p>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 leading-relaxed">{n.message}</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {new Date(n.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="flex-shrink-0 mt-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                        title="Marcar como leída"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
