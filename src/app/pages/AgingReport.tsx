import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Calendar, Download, Filter } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AgingReportView } from '../components/AgingReportView';

export function AgingReport() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/clientes')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-zinc-900">Envejecimiento de Cartera</h1>
              <p className="text-sm text-zinc-500 mt-1">
                Análisis detallado de facturas por tiempo de vencimiento
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
              </Button>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <AgingReportView />
      </div>
    </div>
  );
}
