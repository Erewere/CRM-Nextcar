import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { signInWithGoogle, signInWithEmail, signUpWithEmail } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { Navigate, useLocation } from 'react-router';
import { NextcarLogo } from '../components/NextcarLogo';

export function Login() {
  const { currentUser, loading, connectGoogleServices } = useAuth();
  const location = useLocation();
  const [isRegistering, setIsRegistering] = useState(() => new URLSearchParams(location.search).get('register') === 'true');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (loading) return null;
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
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 relative overflow-hidden font-sans">
      <div className="z-10 w-full max-w-sm bg-white dark:bg-slate-800 p-10 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-8 border-b border-slate-100 dark:border-slate-700 pb-6 w-full justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 border border-slate-800/80 shadow-lg p-1.5">
            <NextcarLogo variant="icon" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Nextcar <span className="text-blue-600">CRM</span></span>
        </div>
        
        <h2 className="text-base font-bold text-slate-800 dark:text-slate-200 text-center mb-6">
          {isRegistering ? 'Crear nueva cuenta' : 'Acceso al Portal CRM'}
        </h2>

        {error && (
          <div className="mb-4 w-full p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg text-center font-medium">
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
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
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
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
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
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 py-2.5 px-4 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-colors text-white font-bold rounded-lg shadow-md shadow-blue-200 text-sm mt-2"
          >
            {isRegistering ? 'Registrarse' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="w-full border-t border-slate-100 dark:border-slate-700 pt-6">
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
            className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:bg-slate-900 transition-colors text-slate-700 dark:text-slate-300 font-bold rounded-lg flex items-center justify-center gap-3 shadow-sm text-sm"
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
          Uso exclusivo para personal autorizado de agencias Nextcar.
        </p>
      </div>
    </div>
  );
}
