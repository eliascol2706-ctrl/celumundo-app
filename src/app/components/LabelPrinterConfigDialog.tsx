import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useState, useEffect } from 'react';
import { type LabelPrinterSettings, defaultLabelSettings } from '../lib/printer-config';

interface LabelPrinterConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: LabelPrinterSettings;
  onSave: (settings: LabelPrinterSettings) => void;
}

export function LabelPrinterConfigDialog({
  open,
  onOpenChange,
  settings,
  onSave,
}: LabelPrinterConfigDialogProps) {
  const [localSettings, setLocalSettings] = useState<LabelPrinterSettings>(settings);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings, open]);

  const handleSave = () => {
    onSave(localSettings);
    onOpenChange(false);
  };

  const handleReset = () => {
    setLocalSettings(defaultLabelSettings);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configuración de Impresora de Etiquetas</DialogTitle>
          <DialogDescription>
            Configura los parámetros de impresión para las etiquetas de productos
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dimensiones de la etiqueta */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Dimensiones de Etiqueta (mm)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="width">Ancho</Label>
                <Input
                  id="width"
                  type="number"
                  min="10"
                  max="200"
                  value={localSettings.width}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, width: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">Alto</Label>
                <Input
                  id="height"
                  type="number"
                  min="10"
                  max="200"
                  value={localSettings.height}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, height: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          {/* Márgenes */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Márgenes (mm)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="marginTop">Superior</Label>
                <Input
                  id="marginTop"
                  type="number"
                  min="0"
                  max="50"
                  value={localSettings.marginTop}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, marginTop: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginBottom">Inferior</Label>
                <Input
                  id="marginBottom"
                  type="number"
                  min="0"
                  max="50"
                  value={localSettings.marginBottom}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, marginBottom: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginLeft">Izquierdo</Label>
                <Input
                  id="marginLeft"
                  type="number"
                  min="0"
                  max="50"
                  value={localSettings.marginLeft}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, marginLeft: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginRight">Derecho</Label>
                <Input
                  id="marginRight"
                  type="number"
                  min="0"
                  max="50"
                  value={localSettings.marginRight}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, marginRight: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          {/* Orientación y diseño */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              Diseño de Impresión
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="orientation">Orientación</Label>
                <Select
                  value={localSettings.orientation}
                  onValueChange={(value: 'horizontal' | 'vertical') =>
                    setLocalSettings({ ...localSettings, orientation: value })
                  }
                >
                  <SelectTrigger id="orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="horizontal">Horizontal</SelectItem>
                    <SelectItem value="vertical">Vertical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="labelsPerRow">Etiquetas por Fila</Label>
                <Input
                  id="labelsPerRow"
                  type="number"
                  min="1"
                  max="10"
                  value={localSettings.labelsPerRow}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, labelsPerRow: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="spacing">Espaciado (mm)</Label>
                <Input
                  id="spacing"
                  type="number"
                  min="0"
                  max="20"
                  value={localSettings.spacing}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, spacing: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          {/* Vista previa de configuración */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="text-blue-600 dark:text-blue-400 mt-0.5">ℹ️</div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                  Vista Previa de Configuración
                </p>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <li>
                    Dimensión: {localSettings.width}mm × {localSettings.height}mm (
                    {localSettings.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'})
                  </li>
                  <li>
                    Márgenes: Superior {localSettings.marginTop}mm, Inferior{' '}
                    {localSettings.marginBottom}mm, Izquierdo {localSettings.marginLeft}mm, Derecho{' '}
                    {localSettings.marginRight}mm
                  </li>
                  <li>
                    Diseño: {localSettings.labelsPerRow} etiqueta(s) por fila con {localSettings.spacing}mm de espaciado
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button variant="outline" onClick={handleReset}>
              Restaurar Predeterminados
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white">
                Guardar Configuración
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
