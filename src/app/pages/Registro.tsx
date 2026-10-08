import { useState, useCallback, Fragment } from 'react';
import {
  FileText, Package, Users, DollarSign, RotateCcw, RefreshCw,
  TrendingDown, TrendingUp, CreditCard, Search, Filter, X,
  ClipboardList, Calendar, User, Hash, ChevronDown, Info,
  BarChart3, ShoppingBag, BookOpen, AlertTriangle, Loader2,
  ArrowUpDown, CheckCircle2, XCircle
} from 'lucide-react';
import { supabase, getSession, getCurrentUser } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

// ─── Types ──────────────────────────────────────────────────────────────────

export type LogType =
  | 'factura_contado'
  | 'factura_credito'
  | 'factura_confirmada'
  | 'factura_pagada'
  | 'abono'
  | 'cargo_inventario'
  | 'descargo_inventario'
  | 'modificacion_producto'
  | 'nuevo_cliente'
  | 'aumento_credito'
  | 'gasto'
  | 'cierre'
  | 'devolucion'
  | 'cambio';

export interface SystemLog {
  id: string;
  company: string;
  reference: string;
  type: LogType;
  user_name: string;
  entity_name?: string;
  amount?: number;
  description: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// ─── Log type metadata ───────────────────────────────────────────────────────

const LOG_TYPES: Record<LogType, { label: string; color: string; icon: React.ElementType; badgeClass: string }> = {
  factura_contado: {
    label: 'Factura de Contado',
    color: 'text-emerald-600 dark:text-emerald-400',
    icon: FileText,
    badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  },
  factura_credito: {
    label: 'Factura a Crédito',
    color: 'text-blue-600 dark:text-blue-400',
    icon: CreditCard,
    badgeClass: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  },
  factura_confirmada: {
    label: 'Confirmación de Factura',
    color: 'text-teal-600 dark:text-teal-400',
    icon: CheckCircle2,
    badgeClass: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400 border-teal-200 dark:border-teal-800',
  },
  factura_pagada: {
    label: 'Factura Pagada',
    color: 'text-green-600 dark:text-green-400',
    icon: CheckCircle2,
    badgeClass: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400 border-green-200 dark:border-green-800',
  },
  abono: {
    label: 'Abono a Crédito',
    color: 'text-cyan-600 dark:text-cyan-400',
    icon: TrendingUp,
    badgeClass: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800',
  },
  cargo_inventario: {
    label: 'Cargo de Inventario',
    color: 'text-indigo-600 dark:text-indigo-400',
    icon: Package,
    badgeClass: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
  },
  descargo_inventario: {
    label: 'Descargo de Inventario',
    color: 'text-violet-600 dark:text-violet-400',
    icon: TrendingDown,
    badgeClass: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  },
  modificacion_producto: {
    label: 'Modificación de Producto',
    color: 'text-orange-600 dark:text-orange-400',
    icon: Package,
    badgeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400 border-orange-200 dark:border-orange-800',
  },
  nuevo_cliente: {
    label: 'Nuevo Cliente',
    color: 'text-pink-600 dark:text-pink-400',
    icon: Users,
    badgeClass: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-400 border-pink-200 dark:border-pink-800',
  },
  aumento_credito: {
    label: 'Aumento de Crédito',
    color: 'text-sky-600 dark:text-sky-400',
    icon: TrendingUp,
    badgeClass: 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400 border-sky-200 dark:border-sky-800',
  },
  gasto: {
    label: 'Gasto Registrado',
    color: 'text-red-600 dark:text-red-400',
    icon: DollarSign,
    badgeClass: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-800',
  },
  cierre: {
    label: 'Cierre',
    color: 'text-zinc-600 dark:text-zinc-400',
    icon: BarChart3,
    badgeClass: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700',
  },
  devolucion: {
    label: 'Devolución',
    color: 'text-amber-600 dark:text-amber-400',
    icon: RotateCcw,
    badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  },
  cambio: {
    label: 'Cambio',
    color: 'text-lime-600 dark:text-lime-400',
    icon: RefreshCw,
    badgeClass: 'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-400 border-lime-200 dark:border-lime-800',
  },
};

const TYPE_GROUPS: { label: string; types: LogType[] }[] = [
  {
    label: 'Facturación',
    types: ['factura_contado', 'factura_credito', 'factura_confirmada', 'factura_pagada', 'abono'],
  },
  {
    label: 'Inventario',
    types: ['cargo_inventario', 'descargo_inventario', 'modificacion_producto'],
  },
  {
    label: 'Clientes',
    types: ['nuevo_cliente', 'aumento_credito'],
  },
  {
    label: 'Operaciones',
    types: ['gasto', 'cierre', 'devolucion', 'cambio'],
  },
];

// ─── Utility ─────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function ago15days() {
  const d = new Date();
  d.setDate(d.getDate() - 15);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

// ─── Component ───────────────────────────────────────────────────────────────

export function Registro() {
  const session = getSession();
  const currentUser = getCurrentUser();

  // Panel state
  const [selectedType, setSelectedType] = useState<LogType | 'all' | null>(null);
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Advanced search filters
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<LogType | 'all'>('all');
  const [filterUser, setFilterUser] = useState('');
  const [filterRef, setFilterRef] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [limit, setLimit] = useState(50);

  // Expanded row
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchLogs = useCallback(async (opts: {
    type?: LogType | 'all' | null;
    user?: string;
    ref?: string;
    dateFrom?: string;
    dateTo?: string;
    lim?: number;
    last15?: boolean;
  }) => {
    if (!session) return;
    setLoading(true);
    setLogs([]);

    try {
      let q = supabase
        .from('system_logs')
        .select('*', { count: 'exact' })
        .eq('company', session.company)
        .order('created_at', { ascending: false })
        .limit(opts.lim ?? limit);

      if (opts.type && opts.type !== 'all') {
        q = q.eq('type', opts.type);
      }
      if (opts.user?.trim()) {
        q = q.ilike('user_name', `%${opts.user.trim()}%`);
      }
      if (opts.ref?.trim()) {
        q = q.ilike('reference', `%${opts.ref.trim()}%`);
      }
      if (opts.last15) {
        q = q.gte('created_at', ago15days());
      } else {
        if (opts.dateFrom) q = q.gte('created_at', `${opts.dateFrom}T00:00:00`);
        if (opts.dateTo) q = q.lte('created_at', `${opts.dateTo}T23:59:59`);
      }

      const { data, error, count } = await q;
      if (error) throw error;
      setLogs((data as SystemLog[]) ?? []);
      setTotalCount(count ?? 0);
      setHasLoaded(true);
    } catch (err) {
      console.error('Error fetching logs:', err);
    } finally {
      setLoading(false);
    }
  }, [session, limit]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectType = (type: LogType | 'all') => {
    setSelectedType(type);
    setFilterType(type);
    setFilterUser('');
    setFilterRef('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setShowFilters(false);
    fetchLogs({ type, last15: true });
  };

  const handleSearch = () => {
    fetchLogs({
      type: filterType,
      user: filterUser,
      ref: filterRef,
      dateFrom: filterDateFrom,
      dateTo: filterDateTo,
      lim: limit,
      last15: false,
    });
  };

  const handleClearSearch = () => {
    if (selectedType) {
      setFilterType(selectedType);
    }
    setFilterUser('');
    setFilterRef('');
    setFilterDateFrom('');
    setFilterDateTo('');
    if (selectedType) {
      fetchLogs({ type: selectedType, last15: true });
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const TypeBadge = ({ type }: { type: LogType }) => {
    const meta = LOG_TYPES[type];
    const Icon = meta.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.badgeClass}`}>
        <Icon className="h-3 w-3" />
        {meta.label}
      </span>
    );
  };

  // ── Pre-load state: type selector ─────────────────────────────────────────

  if (!hasLoaded && !loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-950 rounded-lg">
                <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              Registro del Sistema
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Trazabilidad completa de cada movimiento y operación
            </p>
          </div>
        </div>

        {/* Type selector */}
        <Card className="border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-600" />
              ¿Qué tipo de registros desea consultar?
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Seleccione una categoría para ver los últimos 15 días de actividad
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* All types option */}
            <button
              onClick={() => handleSelectType('all')}
              className="w-full flex items-center gap-3 p-4 rounded-xl border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 hover:border-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 transition-all group"
            >
              <div className="p-2.5 rounded-lg bg-emerald-600 text-white group-hover:scale-105 transition-transform">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">Todos los registros</p>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Ver toda la actividad del sistema</p>
              </div>
            </button>

            {/* Grouped types */}
            {TYPE_GROUPS.map(group => (
              <div key={group.label}>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                  {group.label}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {group.types.map(type => {
                    const meta = LOG_TYPES[type];
                    const Icon = meta.icon;
                    return (
                      <button
                        key={type}
                        onClick={() => handleSelectType(type)}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-emerald-400 dark:hover:border-emerald-600 hover:bg-muted transition-all group text-left"
                      >
                        <div className={`p-1.5 rounded-md bg-muted group-hover:bg-card transition-colors ${meta.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-medium text-foreground leading-tight">
                          {meta.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Loading spinner ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <Loader2 className="h-10 w-10 text-emerald-600 animate-spin" />
        <p className="text-muted-foreground font-medium">Consultando registros...</p>
      </div>
    );
  }

  // ── Main view ─────────────────────────────────────────────────────────────

  const activeTypeMeta = selectedType && selectedType !== 'all' ? LOG_TYPES[selectedType] : null;
  const ActiveIcon = activeTypeMeta?.icon ?? ClipboardList;

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950 rounded-lg">
              <BookOpen className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            Registro del Sistema
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {selectedType && selectedType !== 'all'
              ? `Mostrando: ${LOG_TYPES[selectedType].label}`
              : 'Todos los tipos de registro'}{' '}
            · <span className="font-medium">{totalCount} resultado{totalCount !== 1 ? 's' : ''}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setHasLoaded(false);
              setLogs([]);
              setSelectedType(null);
            }}
            className="text-xs"
          >
            <ChevronDown className="h-3.5 w-3.5 mr-1 rotate-90" />
            Cambiar tipo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={showFilters ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : ''}
          >
            <Filter className="h-3.5 w-3.5 mr-1.5" />
            Buscar / Filtrar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchLogs({ type: selectedType, user: filterUser, ref: filterRef, dateFrom: filterDateFrom, dateTo: filterDateTo, last15: false })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Advanced filter panel */}
      {showFilters && (
        <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/20 animate-scale-in">
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Type filter */}
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de registro</Label>
                <Select
                  value={filterType}
                  onValueChange={(v) => setFilterType(v as LogType | 'all')}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los tipos</SelectItem>
                    {Object.entries(LOG_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User filter */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <User className="h-3 w-3" /> Usuario
                </Label>
                <Input
                  placeholder="Nombre de usuario..."
                  value={filterUser}
                  onChange={e => setFilterUser(e.target.value)}
                  className="h-9 text-sm bg-background"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Reference filter */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Referencia
                </Label>
                <Input
                  placeholder="REF-0001, FAC-..."
                  value={filterRef}
                  onChange={e => setFilterRef(e.target.value)}
                  className="h-9 text-sm bg-background"
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                />
              </div>

              {/* Limit */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" /> Mostrar
                </Label>
                <Select
                  value={String(limit)}
                  onValueChange={v => setLimit(Number(v))}
                >
                  <SelectTrigger className="h-9 text-sm bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25 registros</SelectItem>
                    <SelectItem value="50">50 registros</SelectItem>
                    <SelectItem value="100">100 registros</SelectItem>
                    <SelectItem value="200">200 registros</SelectItem>
                    <SelectItem value="500">500 registros</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Date range */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Desde
                </Label>
                <Input
                  type="date"
                  value={filterDateFrom}
                  onChange={e => setFilterDateFrom(e.target.value)}
                  className="h-9 text-sm bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> Hasta
                </Label>
                <Input
                  type="date"
                  value={filterDateTo}
                  onChange={e => setFilterDateTo(e.target.value)}
                  className="h-9 text-sm bg-background"
                />
              </div>

              {/* Actions */}
              <div className="sm:col-span-2 flex items-end gap-2">
                <Button
                  onClick={handleSearch}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white h-9 flex-1"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Buscar en base de datos
                </Button>
                <Button
                  variant="outline"
                  onClick={handleClearSearch}
                  className="h-9"
                  title="Limpiar filtros"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Last-15-days shortcut */}
            <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800 flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Al seleccionar el tipo sin rango de fechas se muestran los <strong>últimos 15 días</strong>.
                Use los campos de fecha para ampliar la búsqueda.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs h-7 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950"
                onClick={() => {
                  setFilterDateFrom('');
                  setFilterDateTo('');
                  fetchLogs({ type: filterType, user: filterUser, ref: filterRef, last15: true });
                }}
              >
                Volver a últimos 15 días
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results table */}
      <Card className="border-border">
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="p-4 rounded-full bg-muted">
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">No se encontraron registros</p>
                <p className="text-sm text-muted-foreground mt-1">
                  No hay actividad en los últimos 15 días para este tipo.
                  Prueba con otro rango de fechas.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(true)}
              >
                <Calendar className="h-4 w-4 mr-2" />
                Ampliar rango de fechas
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                      Referencia
                    </th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                      Tipo
                    </th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                      Usuario
                    </th>
                    <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap hidden md:table-cell">
                      Entidad / Descripción
                    </th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap hidden lg:table-cell">
                      Valor
                    </th>
                    <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map(log => {
                    const meta = LOG_TYPES[log.type];
                    const Icon = meta?.icon ?? ClipboardList;
                    const isExpanded = expandedId === log.id;

                    return (
                      <Fragment key={log.id}>
                        <tr
                          onClick={() => setExpandedId(isExpanded ? null : log.id)}
                          className="hover:bg-muted/40 cursor-pointer transition-colors"
                        >
                          {/* Reference */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className="font-mono text-xs font-semibold bg-muted px-2 py-1 rounded text-foreground">
                              {log.reference}
                            </span>
                          </td>

                          {/* Type badge */}
                          <td className="px-4 py-3">
                            {meta ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${meta.badgeClass}`}>
                                <Icon className="h-3 w-3" />
                                <span className="hidden sm:inline">{meta.label}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">{log.type}</span>
                            )}
                          </td>

                          {/* User */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0">
                                <User className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                              </div>
                              <span className="text-sm text-foreground font-medium">{log.user_name}</span>
                            </div>
                          </td>

                          {/* Entity / Description */}
                          <td className="px-4 py-3 hidden md:table-cell max-w-xs">
                            <div>
                              {log.entity_name && (
                                <p className="text-sm font-medium text-foreground truncate">
                                  {log.entity_name}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground truncate">
                                {log.description}
                              </p>
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-4 py-3 text-right hidden lg:table-cell whitespace-nowrap">
                            {log.amount != null ? (
                              <span className={`text-sm font-bold ${
                                log.type === 'gasto' || log.type === 'descargo_inventario'
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}>
                                {log.type === 'gasto' || log.type === 'descargo_inventario' ? '−' : '+'}
                                {formatCOP(log.amount)}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span className="text-xs text-muted-foreground">
                              {formatDateTime(log.created_at)}
                            </span>
                          </td>
                        </tr>

                        {/* Expanded detail row */}
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Referencia completa</p>
                                  <p className="font-mono font-bold text-foreground">{log.reference}</p>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Descripción completa</p>
                                  <p className="text-foreground">{log.description}</p>
                                </div>
                                {log.entity_name && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Entidad</p>
                                    <p className="text-foreground">{log.entity_name}</p>
                                  </div>
                                )}
                                {log.amount != null && (
                                  <div>
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Valor</p>
                                    <p className={`font-bold text-lg ${
                                      log.type === 'gasto' || log.type === 'descargo_inventario'
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>
                                      {formatCOP(log.amount)}
                                    </p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Fecha y hora</p>
                                  <p className="text-foreground">
                                    {new Date(log.created_at).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'medium' })}
                                  </p>
                                </div>
                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div className="md:col-span-2 lg:col-span-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Datos adicionales</p>
                                    <div className="flex flex-wrap gap-2">
                                      {Object.entries(log.metadata).map(([k, v]) => (
                                        <div key={k} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted border border-border text-xs">
                                          <span className="text-muted-foreground font-medium capitalize">{k.replace(/_/g, ' ')}:</span>
                                          <span className="text-foreground font-mono">{String(v)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer info */}
      {logs.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <p>Mostrando {logs.length} de {totalCount} registros · Haz clic en una fila para ver el detalle</p>
          {totalCount > logs.length && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              onClick={() => {
                setLimit(prev => prev + 100);
                fetchLogs({
                  type: filterType,
                  user: filterUser,
                  ref: filterRef,
                  dateFrom: filterDateFrom,
                  dateTo: filterDateTo,
                  lim: limit + 100,
                  last15: !filterDateFrom && !filterDateTo,
                });
              }}
            >
              Cargar más registros
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default Registro;
