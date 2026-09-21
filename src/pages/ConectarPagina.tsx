import { useState } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { auth, logout } from "../lib/firebase";
import { NextcarLogo, NextcarIcono } from "../components/NextcarLogo";

/**
 * «Entrar con mi cuenta del CRM» desde nextcar.erewere.com llega aqui. Si la
 * persona no ha iniciado sesion, se recuerda a donde iba y se le manda al
 * login; al volver, confirma y el servidor le da un pase de un solo uso para
 * la pagina (ver src/lib/pasePagina.ts). La contrasena solo se escribe en el CRM.
 */

export const CLAVE_IR_A_PAGINA = "irAConectarPagina";

export function ConectarPagina() {
  const { currentUser, userData, agencyData, loading } = useAuth();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-[#f4f5f5]"><NextcarIcono className="h-14 w-14" animado /></div>;
  }
  if (!currentUser) {
    try { sessionStorage.setItem(CLAVE_IR_A_PAGINA, "1"); } catch { /* sin almacenamiento: vuelve al inicio */ }
    return <Navigate to="/login" replace />;
  }
  if (!userData) {
    return <div className="min-h-[100dvh] flex items-center justify-center bg-[#f4f5f5]"><NextcarIcono className="h-14 w-14" animado /></div>;
  }

  const esAdmin = userData.role === "admin";
  const agencia = (agencyData as any)?.name || "tu agencia";

  const continuar = async () => {
    setEnviando(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch("/api/pagina/pase", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.url) throw new Error(d.error || "No se pudo abrir la página.");
      window.location.href = d.url;
    } catch (e: any) {
      setError(e.message || "No se pudo abrir la página.");
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#F6F5F2] p-4">
      <div className="w-full max-w-sm bg-white border border-[#DAD6CE] rounded-lg p-6 shadow-sm">
        <NextcarLogo className="h-8 mb-6" />
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#4A463F]">Portal de agencias</p>
        <h1 className="text-xl font-extrabold tracking-tight text-[#0F0F10] mt-1">Entrar a nextcar.erewere.com</h1>

        {esAdmin ? (
          <>
            <p className="text-sm text-[#4A463F] mt-3">
              Vas a entrar al portal de la página como <b>{agencia}</b>, con tu cuenta <b>{userData.email}</b>. Ahí verás el inventario que tienes en el CRM.
            </p>
            {error && <p className="text-sm text-[#A82A17] mt-3">{error}</p>}
            <button
              onClick={continuar}
              disabled={enviando}
              className="w-full mt-5 py-3 rounded-md bg-[#D6402A] hover:bg-[#A82A17] disabled:opacity-60 text-white text-sm font-bold"
            >
              {enviando ? "Abriendo…" : "Continuar a la página"}
            </button>
          </>
        ) : (
          <p className="text-sm text-[#4A463F] mt-3">
            Solo el administrador de la agencia puede entrar al portal de la página. Pídele a tu administrador que lo haga.
          </p>
        )}

        <div className="flex justify-between mt-4 text-xs">
          <a href="https://www.nextcar.erewere.com/" className="text-[#4A463F] hover:underline">Volver a la página</a>
          <button onClick={() => logout()} className="text-[#4A463F] hover:underline">No soy yo</button>
        </div>
      </div>
    </div>
  );
}
