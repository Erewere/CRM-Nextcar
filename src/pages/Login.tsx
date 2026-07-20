import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { Navigate, useLocation } from 'react-router';
import { LuhoLogo } from '../components/LuhoLogo';

export function Login() {
  const { currentUser, loading, connectGoogleServices } = useAuth();
  const location = useLocation();
  const [isRegistering, setIsRegistering] = useState(() => new URLSearchParams(location.search).get('register') === 'true');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (loading) return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-[#f4f5f5] dark:bg-slate-900">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
      <p className="text-slate-500 font-medium text-sm">Cargando aplicación...</p>
    </div>
  );
  if (currentUser) return <Navigate to="/" />;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegistering) {
        const userCred = await signUpWithEmail(email, password);
        await updateProfile(userCred.user, { displayName: name });
      } else {
        await signInWithEmail(email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setError('El email ya está registrado. Por favor, inicia sesión con tu contraseña.');
        setIsRegistering(false);
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña es demasiado débil (mínimo 6 caracteres).');
      } else {
        setError('Error en la autenticación. Por favor, intenta de nuevo.');
      }
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f4f5f5] dark:bg-slate-900 px-4 relative overflow-hidden font-sans">
      <div className="z-10 w-full max-w-sm bg-white dark:bg-slate-800 p-10 rounded shadow-xl border border-gray-200 dark:border-slate-700 flex flex-col items-center">
        <div className="flex items-center justify-center mb-8 border-b border-gray-200 dark:border-slate-700 pb-6 w-full">
          <div className="flex h-16 w-40 items-center justify-center">
            <LuhoLogo variant="full" />
          </div>
        </div>
        
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 text-center mb-6">
          {isRegistering ? 'Crear nueva cuenta' : 'Acceso al Portal CRM'}
        </h2>

        {error && (
          <div className="mb-4 w-full p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded text-center font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full space-y-4 mb-6">
          {isRegistering && (
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
                placeholder="Tu nombre real"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Email</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">Contraseña</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-gray-200 dark:border-slate-700 bg-[#f4f5f5] dark:bg-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors text-white font-bold rounded shadow-sm shadow-blue-200 text-sm mt-2"
          >
            {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="w-full border-t border-gray-200 dark:border-slate-700 pt-6">
          <button
            onClick={async () => {
              try {
                const token = await connectGoogleServices();
                if (!token) {
                  // User closed popup or failed. connectGoogleServices handles logs
                }
              } catch (err: any) {
                setError('Error al iniciar sesión con Google. Verifica tu conexión o intenta con correo.');
              }
            }}
            type="button"
            className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-[#f4f5f5] dark:bg-slate-900 transition-colors text-slate-700 dark:text-slate-300 font-bold rounded flex items-center justify-center gap-3 shadow-sm text-sm"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-4 h-4 bg-white dark:bg-slate-800 rounded-full" />
            Continuar con Google
          </button>
        </div>

        <button 
          onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
          className="mt-6 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 transition-colors"
        >
          {isRegistering ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </button>
        
        <p className="mt-8 text-[10px] text-center text-slate-400">
          Uso exclusivo para personal autorizado de agencias LUHO.
        </p>
      </div>
    </div>
  );
}
