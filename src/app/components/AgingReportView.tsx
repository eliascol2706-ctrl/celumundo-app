import { useState, useEffect } from 'react';
import { Calendar, TrendingDown, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { getAgingReport } from '../lib/supabase';
import { formatCOP } from '../lib/currency';

interface AgingRange {
  label: string;
  min: number;
  max: number;
  amount: number;
  count: number;
}

interface AgingData {
  current: AgingRange;
  thirtyToSixty: AgingRange;
  sixtyToNinety: AgingRange;
  overNinety: AgingRange;
}

export function AgingReportView() {
  const [data, setData] = useState<AgingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const agingData = await getAgingReport();
    setData(agingData);
    setLoading(false);
  };

  if (loading) {
    return (
      <Card className="border-zinc-200 shadow-sm">
        <CardContent className="p-12 text-center">
          <div className="animate-pulse text-zinc-500">Cargando reporte...</div>
        </CardContent>
      </Card>
    );
  }

  if (!data) {
    return null;
  }

  const total = data.current.amount + data.thirtyToSixty.amount + data.sixtyToNinety.amount + data.overNinety.amount;

  const ranges = [
    { data: data.current, color: 'emerald', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700', borderColor: 'border-emerald-200' },
    { data: data.thirtyToSixty, color: 'amber', bgColor: 'bg-amber-100', textColor: 'text-amber-700', borderColor: 'border-amber-200' },
    { data: data.sixtyToNinety, color: 'orange', bgColor: 'bg-orange-100', textColor: 'text-orange-700', borderColor: 'border-orange-200' },
    { data: data.overNinety, color: 'red', bgColor: 'bg-red-100', textColor: 'text-red-700', borderColor: 'border-red-200' }
  ];

  return (
    <div className="space-y-6">
      <Card className="border-zinc-200 shadow-sm">
        <CardHeader className="border-b border-zinc-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl font-semibold text-zinc-900">
                Envejecimiento de Cartera
              </CardTitle>
              <p className="text-sm text-zinc-500 mt-1">Análisis de facturas por tiempo de vencimiento</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-zinc-600">Total en Cartera</p>
              <p className="text-2xl font-bold text-zinc-900">{formatCOP(total)}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {ranges.map((range, index) => {
              const percentage = total > 0 ? (range.data.amount / total) * 100 : 0;

              return (
                <div key={index}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Calendar className={`w-4 h-4 ${range.textColor}`} />
                      <span className="text-sm font-medium text-zinc-900">{range.data.label}</span>
                      <span className="text-xs text-zinc-500">({range.data.count} facturas)</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-zinc-900">{formatCOP(range.data.amount)}</p>
                      <p className="text-xs text-zinc-500">{percentage.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="w-full bg-zinc-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full ${range.bgColor.replace('100', '500')} transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Resumen */}
          <div className="mt-6 pt-6 border-t border-zinc-200 grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-medium text-emerald-900">Cartera Sana</span>
              </div>
              <p className="text-xl font-bold text-emerald-700">{formatCOP(data.current.amount)}</p>
              <p className="text-xs text-emerald-600 mt-1">0-30 días</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-900">Cartera Crítica</span>
              </div>
              <p className="text-xl font-bold text-red-700">
                {formatCOP(data.sixtyToNinety.amount + data.overNinety.amount)}
              </p>
              <p className="text-xs text-red-600 mt-1">Más de 60 días</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
