import { Target } from "lucide-react";
import { useMetas } from "../../lib/metasApi";
import { nombreDelMes } from "../../lib/metas";
import { MetaBarra } from "./MetaBarra";

/** La meta del mes de un asesor y cómo va el equipo (para su panel). */
export function MiMeta({ usuarioId }: { usuarioId?: string }) {
  const { datos, mes } = useMetas();
  if (!datos) return null;
  const yo = datos.asesores.find((a) => a.id === usuarioId) || datos.asesores[0];
  const mia = yo?.meta.autos || 0;
  const eq = datos.equipo.meta.autos || 0;
  if (!mia && !eq) {
    return <p className="text-xs text-white/60 flex items-center gap-1.5"><Target className="w-3.5 h-3.5" /> Tu administrador aún no fija la meta de {nombreDelMes(mes)}.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 sm:min-w-[26rem]">
      {mia > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Tu meta · {nombreDelMes(mes)}</p>
          <MetaBarra oscuro ventas={yo?.ventas || 0} meta={mia} mes={mes} />
        </div>
      )}
      {eq > 0 && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">Meta del equipo</p>
          <MetaBarra oscuro ventas={datos.equipo.ventas} meta={eq} mes={mes} />
        </div>
      )}
    </div>
  );
}
