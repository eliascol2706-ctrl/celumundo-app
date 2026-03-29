# 🏪 CELUMUNDO VIP / REPUESTOS VIP - Sistema de Inventarios

Sistema completo de gestión de inventarios, facturación y reportes para dos empresas independientes.

![Version](https://img.shields.io/badge/version-2.0.0-green)
![React](https://img.shields.io/badge/React-18-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)
![Tailwind](https://img.shields.io/badge/Tailwind-4.0-cyan)

## 🚀 Inicio Rápido

### 1. Configurar Supabase (5 minutos)

1. Crea un proyecto gratuito en [supabase.com](https://supabase.com)
2. En el **SQL Editor**, ejecuta TODO el archivo `/supabase-schema.sql`
3. En **Settings > API**, copia el Project ID y la Anon Key
4. Edita `/utils/supabase/info.tsx` con tus credenciales

### 2. Iniciar el Sistema

```bash
npm install
npm run dev
```

### 3. Iniciar Sesión

- **Admin**: `admin` / `admin1` (acceso total)
- **Seller**: `seller` / `seller1` (acceso limitado)

📚 **Instrucciones detalladas**: Ver [INSTRUCCIONES.md](/INSTRUCCIONES.md)

---

## ✨ Características Principales

### 🏢 Dual-Company
- **CELUMUNDO VIP**: Venta de smartphones y accesorios
- **REPUESTOS VIP**: Venta de repuestos técnicos
- Datos completamente separados entre empresas

### 📄 Sistema de Facturación
- Ventana de creación al **90% de pantalla**
- Dos tipos: **Regular** (IVA 19%) y **Al Mayor** (sin IVA)
- Opciones simplificadas: **Descargar** e **Imprimir**
- Búsqueda inteligente de productos con filtros
- Vista de **5 precios** por producto

### 📦 Gestión de Productos
- IDs automáticos: **A00001A, A00002A, A00003A...**
- 5 campos de precio configurables
- Control de stock con alertas
- Organización por categorías

### 📊 Módulos Adicionales
- **Movimientos**: Control de entradas/salidas de inventario
- **Gastos**: Gestión de gastos empresariales
- **Cierres**: Cierres diarios y mensuales con reportes
- **Reportes**: Análisis con gráficos (recharts)
- **Dashboard**: Resumen ejecutivo con métricas

---

## 🗂️ Estructura del Proyecto

```
/
├── src/
│   ├── app/
│   │   ├── pages/          # Páginas principales
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Invoices.tsx    # Facturación (90% pantalla)
│   │   │   ├── Products.tsx
│   │   │   ├── Movements.tsx
│   │   │   ├── Expenses.tsx
│   │   │   ├── Closures.tsx
│   │   │   └── Reports.tsx
│   │   ├── lib/            # Lógica de negocio
│   │   │   ├── supabase.ts     # Cliente Supabase
│   │   │   ├── auth.ts         # Autenticación
│   │   │   └── currency.ts     # Formato COP
│   │   └── components/     # Componentes UI
│   └── styles/             # Estilos globales
├── utils/
│   └── supabase/
│       └── info.tsx        # ⚠️ Configurar aquí tus credenciales
├── supabase-schema.sql     # ⚠️ Script SQL completo
├── INSTRUCCIONES.md        # Guía detallada
└── README.md               # Este archivo
```

---

## 🎯 Tecnologías

- **Frontend**: React 18 + TypeScript
- **Estilos**: Tailwind CSS 4.0
- **Base de Datos**: Supabase (PostgreSQL)
- **Gráficos**: Recharts
- **Routing**: React Router
- **UI Components**: shadcn/ui
- **Icons**: Lucide React

---

## 📊 Base de Datos

El script SQL crea automáticamente:

### Tablas (6)
- `products` - Productos con IDs A00001A
- `invoices` - Facturas Regular y Al Mayor
- `movements` - Movimientos de inventario
- `expenses` - Gastos empresariales
- `daily_closures` - Cierres diarios
- `monthly_closures` - Cierres mensuales

### Funciones (3)
- `generate_product_code()` - Genera IDs automáticos
- `get_next_invoice_number()` - Numeración de facturas
- `update_updated_at_column()` - Timestamps automáticos

### Datos de Prueba
- 15 productos para CELUMUNDO VIP
- 18 productos para REPUESTOS VIP

---

## 🔐 Usuarios y Permisos

| Usuario | Contraseña | Permisos |
|---------|-----------|----------|
| `admin` | `admin1` | Todos los módulos |
| `seller` | `seller1` | Facturación, Movimientos, Cierres |

Los permisos se configuran en `/src/app/lib/auth.ts`

---

## 🎨 Personalización

### Cambiar Colores
Busca y reemplaza `#16a34a` (verde corporativo) en:
- `/src/app/pages/*.tsx`
- `/src/styles/theme.css`

### Agregar Usuarios
Edita `/src/app/lib/auth.ts`:

```typescript
const users = [
  { username: 'nuevo', password: 'pass123', role: 'admin' }
];
```

### Modificar IVA
Edita `/src/app/pages/Invoices.tsx` busca `TAX_RATE = 0.19`

---

## 📝 Características Técnicas

### ✅ Implementado
- [x] Migración completa a Supabase
- [x] IDs de productos formato A00001A
- [x] Facturación con ventana 90%
- [x] Opciones de impresión simplificadas
- [x] Async/await en todos los módulos
- [x] Nombres de campos snake_case
- [x] Separación total de datos por empresa
- [x] Reportes con gráficos analíticos
- [x] Sistema de cierres diarios/mensuales

### 🔄 Mejoras Futuras (Opcionales)
- [ ] Autenticación con Supabase Auth
- [ ] Exportar reportes a PDF/Excel
- [ ] Notificaciones push
- [ ] App móvil con React Native
- [ ] Multi-idioma (i18n)

---

## 🐛 Problemas Comunes

### Error al cargar productos
**Solución**: Ejecuta el script SQL completo en Supabase

### Los IDs no son A00001A
**Solución**: Verifica que la función `generate_product_code()` exista:
```sql
SELECT generate_product_code();
```

### Failed to fetch
**Solución**: Verifica las credenciales en `/utils/supabase/info.tsx`

---

## 📚 Documentación

- [Instrucciones Completas](INSTRUCCIONES.md)
- [Supabase Docs](https://supabase.com/docs)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

## 📄 Licencia

Este proyecto fue desarrollado como sistema privado para CELUMUNDO VIP / REPUESTOS VIP.

---

## 👨‍💻 Desarrollado con ❤️

Sistema de inventarios empresarial con React, TypeScript, Tailwind CSS y Supabase.

**Versión**: 2.0.0  
**Última actualización**: Marzo 2026

---

## 🎉 ¡Listo para Producción!

El sistema está 100% funcional y listo para usar en producción.

**¿Necesitas ayuda?** Consulta [INSTRUCCIONES.md](INSTRUCCIONES.md)
