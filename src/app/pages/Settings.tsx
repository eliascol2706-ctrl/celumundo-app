import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User as UserIcon, Lock, Eye, EyeOff, Save, AlertCircle, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { 
  getCurrentUser, 
  getCurrentCompany, 
  updateUserCredentials, 
  checkUsernameExists,
  saveSession,
  getSession,
  getUsersFromDB,
  type Session,
  type User
} from '../lib/supabase';

export function Settings() {
  const currentUser = getCurrentUser();
  const currentCompany = getCurrentCompany();

  // Estados para el admin
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Estados para el vendedor
  const [sellerUser, setSellerUser] = useState<User | null>(null);
  const [sellerNewUsername, setSellerNewUsername] = useState('');
  const [sellerPassword, setSellerPassword] = useState('');
  const [sellerNewPassword, setSellerNewPassword] = useState('');
  const [sellerConfirmPassword, setSellerConfirmPassword] = useState('');
  const [adminPasswordForSeller, setAdminPasswordForSeller] = useState('');
  const [showSellerPassword, setShowSellerPassword] = useState(false);
  const [showSellerNewPassword, setShowSellerNewPassword] = useState(false);
  const [showSellerConfirmPassword, setShowSellerConfirmPassword] = useState(false);
  const [showAdminPasswordForSeller, setShowAdminPasswordForSeller] = useState(false);
  const [isUpdatingSeller, setIsUpdatingSeller] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setNewUsername(currentUser.username);
      loadSellerUser();
    }
  }, [currentUser]);

  const loadSellerUser = async () => {
    try {
      const users = await getUsersFromDB(currentCompany);
      const seller = users.find(u => u.role === 'seller');
      if (seller) {
        setSellerUser(seller);
        setSellerNewUsername(seller.username);
        setSellerPassword(seller.password);
      }
    } catch (error) {
      console.error('Error loading seller user:', error);
      toast.error('Error al cargar datos del vendedor');
    }
  };

  const handleUpdateOwnCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !currentUser.id) {
      toast.error('Error: No se encontró información del usuario');
      return;
    }

    // Validar contraseña actual
    if (currentPassword !== currentUser.password) {
      toast.error('La contraseña actual es incorrecta');
      return;
    }

    // Validar que al menos uno de los campos esté siendo actualizado
    const isUsernameChanged = newUsername !== currentUser.username;
    const isPasswordChanged = newPassword !== '';

    if (!isUsernameChanged && !isPasswordChanged) {
      toast.info('No hay cambios para guardar');
      return;
    }

    // Si se está cambiando la contraseña, validar que coincidan
    if (isPasswordChanged) {
      if (newPassword.length < 4) {
        toast.error('La nueva contraseña debe tener al menos 4 caracteres');
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error('Las contraseñas nuevas no coinciden');
        return;
      }
    }

    // Si se está cambiando el username, verificar que no exista
    if (isUsernameChanged) {
      const exists = await checkUsernameExists(newUsername, currentCompany, currentUser.id);
      if (exists) {
        toast.error('Este nombre de usuario ya existe en esta empresa');
        return;
      }
    }

    setIsUpdating(true);

    try {
      const updates: { username?: string; password?: string } = {};

      if (isUsernameChanged) {
        updates.username = newUsername;
      }

      if (isPasswordChanged) {
        updates.password = newPassword;
      }

      const success = await updateUserCredentials(currentUser.id, updates);

      if (success) {
        // Actualizar la sesión con los nuevos datos
        const session = getSession();
        if (session) {
          const updatedSession: Session = {
            ...session,
            user: {
              ...session.user,
              username: updates.username || session.user.username,
              password: updates.password || session.user.password,
            },
          };
          saveSession(updatedSession);
        }

        toast.success('✅ Tus credenciales han sido actualizadas', {
          description: 'Los cambios han sido guardados exitosamente',
        });

        // Limpiar campos de contraseña
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error('Error al actualizar credenciales');
      }
    } catch (error) {
      console.error('Error updating credentials:', error);
      toast.error('Error al actualizar credenciales');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateSellerCredentials = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !sellerUser || !sellerUser.id) {
      toast.error('Error: No se encontró información del vendedor');
      return;
    }

    // Validar contraseña del admin
    if (adminPasswordForSeller !== currentUser.password) {
      toast.error('Tu contraseña de administrador es incorrecta');
      return;
    }

    // Validar que al menos uno de los campos esté siendo actualizado
    const isUsernameChanged = sellerNewUsername !== sellerUser.username;
    const isPasswordChanged = sellerNewPassword !== '';

    if (!isUsernameChanged && !isPasswordChanged) {
      toast.info('No hay cambios para guardar');
      return;
    }

    // Si se está cambiando la contraseña, validar que coincidan
    if (isPasswordChanged) {
      if (sellerNewPassword.length < 4) {
        toast.error('La nueva contraseña debe tener al menos 4 caracteres');
        return;
      }

      if (sellerNewPassword !== sellerConfirmPassword) {
        toast.error('Las contraseñas nuevas no coinciden');
        return;
      }
    }

    // Si se está cambiando el username, verificar que no exista
    if (isUsernameChanged) {
      const exists = await checkUsernameExists(sellerNewUsername, currentCompany, sellerUser.id);
      if (exists) {
        toast.error('Este nombre de usuario ya existe en esta empresa');
        return;
      }
    }

    setIsUpdatingSeller(true);

    try {
      const updates: { username?: string; password?: string } = {};

      if (isUsernameChanged) {
        updates.username = sellerNewUsername;
      }

      if (isPasswordChanged) {
        updates.password = sellerNewPassword;
      }

      const success = await updateUserCredentials(sellerUser.id, updates);

      if (success) {
        toast.success('✅ Credenciales del vendedor actualizadas', {
          description: 'Los cambios han sido guardados exitosamente',
        });

        // Recargar datos del vendedor
        await loadSellerUser();

        // Limpiar campos
        setAdminPasswordForSeller('');
        setSellerNewPassword('');
        setSellerConfirmPassword('');
      } else {
        toast.error('Error al actualizar credenciales del vendedor');
      }
    } catch (error) {
      console.error('Error updating seller credentials:', error);
      toast.error('Error al actualizar credenciales del vendedor');
    } finally {
      setIsUpdatingSeller(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Ajustes</h2>
            <p className="text-muted-foreground mt-1">Gestión de credenciales</p>
          </div>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
              <p>No se pudo cargar la información del usuario</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const companyName = currentCompany === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Configuración</h2>
          <p className="text-muted-foreground mt-1">Gestión de credenciales y usuarios</p>
        </div>
      </div>

      {/* Información de la empresa */}
      <Card className="border-green-200 dark:border-green-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-green-600" />
            Empresa Actual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">
                {companyName.substring(0, 1)}
              </span>
            </div>
            <div>
              <p className="text-xl font-bold text-green-700 dark:text-green-400">{companyName}</p>
              <p className="text-sm text-muted-foreground">
                Administrador: {currentUser.username}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs para gestión de credenciales */}
      <Tabs defaultValue="own" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="own" className="flex items-center gap-2">
            <UserIcon className="h-4 w-4" />
            Mis Credenciales
          </TabsTrigger>
          <TabsTrigger value="seller" className="flex items-center gap-2">
            <UsersIcon className="h-4 w-4" />
            Usuario Vendedor
          </TabsTrigger>
        </TabsList>

        {/* Tab: Mis Credenciales (Admin) */}
        <TabsContent value="own" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="h-5 w-5 text-green-600" />
                Actualizar Mis Credenciales
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateOwnCredentials} className="space-y-6">
                {/* Contraseña actual */}
                <div className="space-y-2">
                  <Label htmlFor="currentPassword" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Contraseña Actual <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="currentPassword"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Ingresa tu contraseña actual"
                      required
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <p className="text-sm font-medium mb-4">Cambiar credenciales</p>

                  {/* Nuevo nombre de usuario */}
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="newUsername" className="flex items-center gap-2">
                      <UserIcon className="h-4 w-4" />
                      Nuevo Nombre de Usuario
                    </Label>
                    <Input
                      id="newUsername"
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="Ingresa un nuevo nombre de usuario"
                      minLength={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      Deja este campo sin cambios si no deseas modificar tu usuario
                    </p>
                  </div>

                  {/* Nueva contraseña */}
                  <div className="space-y-2 mb-4">
                    <Label htmlFor="newPassword" className="flex items-center gap-2">
                      <Lock className="h-4 w-4" />
                      Nueva Contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Ingresa una nueva contraseña"
                        minLength={4}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deja este campo vacío si no deseas cambiar tu contraseña
                    </p>
                  </div>

                  {/* Confirmar nueva contraseña */}
                  {newPassword && (
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirma tu nueva contraseña"
                          required
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4 border-t">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                    disabled={isUpdating}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {isUpdating ? 'Guardando...' : 'Guardar Cambios'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Usuario Vendedor */}
        <TabsContent value="seller" className="space-y-4">
          {sellerUser ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-blue-600" />
                  Gestionar Credenciales del Vendedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Info actual del vendedor */}
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                    Usuario Vendedor Actual
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <UserIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-blue-700 dark:text-blue-300">
                        {sellerUser.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Contraseña: {'•'.repeat(sellerUser.password?.length || 8)}
                      </p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleUpdateSellerCredentials} className="space-y-6">
                  {/* Contraseña del admin para autorizar */}
                  <div className="space-y-2">
                    <Label htmlFor="adminPasswordForSeller" className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-orange-600" />
                      Tu Contraseña de Administrador <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="adminPasswordForSeller"
                        type={showAdminPasswordForSeller ? 'text' : 'password'}
                        value={adminPasswordForSeller}
                        onChange={(e) => setAdminPasswordForSeller(e.target.value)}
                        placeholder="Ingresa tu contraseña para autorizar cambios"
                        required
                        className="pr-10 border-orange-300 dark:border-orange-700"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPasswordForSeller(!showAdminPasswordForSeller)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showAdminPasswordForSeller ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400">
                      ⚠️ Se requiere tu contraseña de admin para modificar credenciales del vendedor
                    </p>
                  </div>

                  <div className="border-t pt-6">
                    <p className="text-sm font-medium mb-4">Nuevas credenciales del vendedor</p>

                    {/* Nuevo nombre de usuario del vendedor */}
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="sellerNewUsername" className="flex items-center gap-2">
                        <UserIcon className="h-4 w-4" />
                        Nuevo Nombre de Usuario
                      </Label>
                      <Input
                        id="sellerNewUsername"
                        type="text"
                        value={sellerNewUsername}
                        onChange={(e) => setSellerNewUsername(e.target.value)}
                        placeholder="Ingresa un nuevo nombre de usuario"
                        minLength={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Deja este campo sin cambios si no deseas modificar el usuario
                      </p>
                    </div>

                    {/* Nueva contraseña del vendedor */}
                    <div className="space-y-2 mb-4">
                      <Label htmlFor="sellerNewPassword" className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Nueva Contraseña
                      </Label>
                      <div className="relative">
                        <Input
                          id="sellerNewPassword"
                          type={showSellerNewPassword ? 'text' : 'password'}
                          value={sellerNewPassword}
                          onChange={(e) => setSellerNewPassword(e.target.value)}
                          placeholder="Ingresa una nueva contraseña"
                          minLength={4}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSellerNewPassword(!showSellerNewPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showSellerNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Deja este campo vacío si no deseas cambiar la contraseña
                      </p>
                    </div>

                    {/* Confirmar nueva contraseña del vendedor */}
                    {sellerNewPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="sellerConfirmPassword" className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Confirmar Nueva Contraseña <span className="text-red-500">*</span>
                        </Label>
                        <div className="relative">
                          <Input
                            id="sellerConfirmPassword"
                            type={showSellerConfirmPassword ? 'text' : 'password'}
                            value={sellerConfirmPassword}
                            onChange={(e) => setSellerConfirmPassword(e.target.value)}
                            placeholder="Confirma la nueva contraseña"
                            required
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSellerConfirmPassword(!showSellerConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showSellerConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-4 pt-4 border-t">
                    <Button
                      type="submit"
                      className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                      disabled={isUpdatingSeller}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isUpdatingSeller ? 'Guardando...' : 'Actualizar Credenciales del Vendedor'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                  <p>No se encontró usuario vendedor en esta empresa</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Información de seguridad */}
      <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
            <AlertCircle className="h-5 w-5" />
            Información de Seguridad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-orange-600 dark:text-orange-400">•</span>
              <span>Las contraseñas deben tener al menos 4 caracteres</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 dark:text-orange-400">•</span>
              <span>Los nombres de usuario deben ser únicos en tu empresa</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 dark:text-orange-400">•</span>
              <span>Las credenciales son específicas para: <strong>{companyName}</strong></span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 dark:text-orange-400">•</span>
              <span>Se requiere contraseña del <span className="font-bold">ADMIN</span> para modificar credenciales del vendedor</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-600 dark:text-orange-400">•</span>
              <span>Guarda las nuevas credenciales en un lugar seguro</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}