import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Search, ShoppingCart, Phone, MessageCircle, X, Percent, ExternalLink } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { supabase } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import type { CatalogItem } from '../lib/supabase';

export function PublicCatalog() {
  const { company } = useParams<{ company: 'celumundo' | 'repuestos' }>();
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<string>('');

  const companyName = company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  const whatsappNumber = '+573145537596';

  useEffect(() => {
    loadCatalog();
  }, [company]);

  const loadCatalog = async () => {
    setLoading(true);
    try {
      // Obtener productos del catálogo
      const { data: catalogData, error: catalogError } = await supabase
        .from('public_catalogs')
        .select('*')
        .eq('company', company)
        .order('display_order', { ascending: true });

      if (catalogError) throw catalogError;

      // Obtener información de productos
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('company', company);

      if (productsError) throw productsError;

      setCatalogItems(catalogData || []);
      setProducts(productsData || []);
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProductName = (productId: string) => {
    const product = products.find(p => p.id === productId);
    return product?.name || 'Producto';
  };

  const calculateDiscountedPrice = (originalPrice: number, discount: number) => {
    return originalPrice * (1 - discount / 100);
  };

  const handleConsultPrice = (productName: string) => {
    setSelectedProduct(productName);
    setShowContactModal(true);
  };

  const handleWhatsAppContact = () => {
    const message = encodeURIComponent(
      `Hola! Me gustaría consultar el precio de: ${selectedProduct}`
    );
    window.open(`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${message}`, '_blank');
    setShowContactModal(false);
  };

  const filteredItems = catalogItems.filter(item => {
    const productName = getProductName(item.product_id).toLowerCase();
    return productName.includes(searchTerm.toLowerCase());
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-xl font-semibold text-gray-700">Cargando catálogo...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-gray-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-2xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Logo y título */}
            <div className="text-center md:text-left">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-2">
                {companyName}
              </h1>
              <p className="text-emerald-100 text-lg">
                Catálogo de Productos
              </p>
            </div>

            {/* Contacto */}
            <div className="flex items-center gap-3">
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-white text-emerald-600 px-6 py-3 rounded-full font-semibold hover:bg-emerald-50 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <MessageCircle className="w-5 h-5" />
                <span className="hidden sm:inline">Contáctanos</span>
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Buscar productos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 pr-4 py-6 text-lg rounded-2xl border-2 border-gray-200 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-200 shadow-lg"
            />
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="container mx-auto px-4 pb-16">
        {filteredItems.length === 0 ? (
          <div className="text-center py-20">
            <ShoppingCart className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <p className="text-2xl font-semibold text-gray-600 mb-2">
              {searchTerm ? 'No se encontraron productos' : 'No hay productos en el catálogo'}
            </p>
            <p className="text-gray-400">
              {searchTerm ? 'Intenta con otra búsqueda' : 'Vuelve pronto para ver nuestras novedades'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredItems.map((item) => {
              const hasDiscount = (item.discount_percentage || 0) > 0;
              const discountedPrice = hasDiscount
                ? calculateDiscountedPrice(item.original_price, item.discount_percentage!)
                : item.original_price;
              const productName = getProductName(item.product_id);

              return (
                <div
                  key={item.id}
                  className="group bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden transform hover:-translate-y-2 border-2 border-gray-100 hover:border-emerald-300"
                >
                  {/* Image Container */}
                  <div className="relative aspect-square bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={productName}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingCart className="w-20 h-20 text-gray-300" />
                      </div>
                    )}

                    {/* Discount Badge */}
                    {hasDiscount && (
                      <div className="absolute top-4 right-4">
                        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2 rounded-full shadow-xl flex items-center gap-1 font-bold">
                          <Percent className="w-4 h-4" />
                          -{item.discount_percentage}%
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-6">
                    <h3 className="text-lg font-bold text-gray-800 mb-3 line-clamp-2 min-h-[3.5rem]">
                      {productName}
                    </h3>

                    {/* Price Section */}
                    {item.show_price ? (
                      <div className="mb-4">
                        {hasDiscount && (
                          <div className="text-sm text-gray-400 line-through mb-1">
                            {formatCOP(item.original_price)}
                          </div>
                        )}
                        <div className={`text-3xl font-bold ${hasDiscount ? 'text-emerald-600' : 'text-gray-800'}`}>
                          COP {formatCOP(discountedPrice)}
                        </div>
                        {hasDiscount && (
                          <div className="text-sm text-emerald-600 font-semibold mt-1">
                            Ahorras: COP {formatCOP(item.original_price - discountedPrice)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mb-4">
                        <Button
                          onClick={() => handleConsultPrice(productName)}
                          className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-semibold py-6 rounded-xl shadow-lg hover:shadow-xl transition-all"
                        >
                          <MessageCircle className="w-5 h-5 mr-2" />
                          Consultar Precio
                        </Button>
                      </div>
                    )}

                    {/* Contact Button */}
                    <a
                      href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola! Me interesa: ${productName}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button
                        variant="outline"
                        className="w-full border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50 font-semibold py-6 rounded-xl transition-all group"
                      >
                        <Phone className="w-5 h-5 mr-2 group-hover:rotate-12 transition-transform" />
                        Contactar
                      </Button>
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 to-black text-white py-12 mt-20">
        <div className="container mx-auto px-4">
          <div className="text-center">
            <h3 className="text-3xl font-bold mb-4">{companyName}</h3>
            <p className="text-gray-300 mb-6 text-lg">
              Tu mejor opción en tecnología y calidad
            </p>
            <div className="flex items-center justify-center gap-4 mb-6">
              <a
                href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 px-8 py-4 rounded-full font-semibold transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
              >
                <MessageCircle className="w-6 h-6" />
                WhatsApp: {whatsappNumber}
              </a>
            </div>
            <div className="text-gray-400 text-sm">
              <p>© {new Date().getFullYear()} {companyName}. Todos los derechos reservados.</p>
              <p className="mt-2">www.celumundovip.com</p>
            </div>
          </div>
        </div>
      </footer>

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-center mb-4">
              ¡Contáctanos por WhatsApp!
            </DialogTitle>
          </DialogHeader>

          <div className="text-center py-6">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <MessageCircle className="w-12 h-12 text-white" />
            </div>

            <p className="text-lg text-gray-700 mb-6">
              Para consultar el precio de:
            </p>

            <p className="text-xl font-bold text-gray-900 mb-6 px-4 py-3 bg-gray-100 rounded-lg">
              {selectedProduct}
            </p>

            <p className="text-gray-600 mb-6">
              Comunícate con nosotros al:
            </p>

            <div className="bg-gradient-to-r from-emerald-50 to-emerald-100 px-6 py-4 rounded-xl mb-6">
              <p className="text-2xl font-bold text-emerald-700">
                {whatsappNumber}
              </p>
            </div>

            <Button
              onClick={handleWhatsAppContact}
              className="w-full bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all"
            >
              <MessageCircle className="w-6 h-6 mr-2" />
              Abrir WhatsApp
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
