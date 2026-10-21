/**
 * Que Stripe cobre por los usuarios que la agencia tiene HOY.
 *
 * La suscripcion se pagaba con la cantidad de usuarios del dia del primer pago y nunca se volvia a ajustar: una agencia que
 * agregaba usuarios despues seguia pagando por los de antes. Aqui se cuenta cuantos usuarios tiene cada agencia y se compara
 * con la cantidad de su suscripcion; si cambia, se ajusta (Stripe prorratea lo que falta del mes).
 *
 * Es el dinero de alguien, asi que:
 *  - Mientras `plataforma/facturacion.sincronizar` NO sea true, solo se CALCULA y se deja constancia de la diferencia;
 *    Stripe no se toca. Se enciende a proposito, despues de revisar el reporte.
 *  - Nunca se toca una agencia de cortesia, sin suscripcion, o cuya suscripcion no sea de un solo precio.
 *  - Nunca se baja a menos de 1 usuario.
 *  - Todo queda en `facturacionRegistro` (solo el servidor la lee), con quien estaba antes y quien despues.
 */

export type ResultadoSync = {
  agencyId: string;
  nombre: string;
  estado: "cortesia" | "sin-suscripcion" | "suscripcion-no-vigente" | "revisar" | "al-dia" | "diferencia" | "ajustada" | "error";
  usuarios?: number;
  cobrados?: number;
  detalle?: string;
};

const ESTADOS_VIGENTES = new Set(["active", "trialing", "past_due"]);

export async function usuariosDeLaAgencia(db: any, agencyId: string): Promise<number> {
  const s = await db.collection("users").where("agencyId", "==", agencyId).get();
  return s.size;
}

export async function sincronizarUsuariosDeAgencia(db: any, stripe: any, agencyId: string, opciones: { aplicar: boolean }): Promise<ResultadoSync> {
  const ref = db.collection("agencies").doc(agencyId);
  const a = (await ref.get()).data();
  const base = { agencyId, nombre: String(a?.name || agencyId) };
  if (!a) return { ...base, estado: "error", detalle: "La agencia no existe." };
  if (a.hasFreeAccess) return { ...base, estado: "cortesia" };
  if (!a.stripeCustomerId) return { ...base, estado: "sin-suscripcion" };

  try {
    const lista = await stripe.subscriptions.list({ customer: a.stripeCustomerId, status: "all", limit: 10 });
    const vigentes = lista.data.filter((x: any) => ESTADOS_VIGENTES.has(x.status));
    // Si hay mas de una suscripcion vigente no se adivina cual es: se avisa.
    if (vigentes.length === 0) return { ...base, estado: "suscripcion-no-vigente" };
    if (vigentes.length > 1) return { ...base, estado: "revisar", detalle: "Tiene más de una suscripción vigente." };
    const sub = vigentes[0];
    if (sub.items.data.length !== 1) return { ...base, estado: "revisar", detalle: "La suscripción tiene más de un precio: no se toca sola." };
    const item = sub.items.data[0];
    const cobrados = Number(item.quantity) || 0;
    const usuarios = await usuariosDeLaAgencia(db, agencyId);
    if (usuarios < 1) return { ...base, estado: "revisar", usuarios, cobrados, detalle: "La agencia no tiene usuarios." };
    if (usuarios === cobrados) {
      await ref.set({ facturacion: { usuarios, cobrados, estado: "al-dia", revisadoEn: new Date().toISOString(), suscripcionId: sub.id } }, { merge: true });
      return { ...base, estado: "al-dia", usuarios, cobrados };
    }
    if (!opciones.aplicar) {
      await ref.set({ facturacion: { usuarios, cobrados, estado: "diferencia", revisadoEn: new Date().toISOString(), suscripcionId: sub.id } }, { merge: true });
      return { ...base, estado: "diferencia", usuarios, cobrados, detalle: "Sincronización apagada: solo se registró la diferencia." };
    }
    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, quantity: usuarios }],
      proration_behavior: "create_prorations",
      metadata: { ...(sub.metadata || {}), agencyId },
    });
    const ahora = new Date().toISOString();
    await ref.set({ facturacion: { usuarios, cobrados: usuarios, estado: "al-dia", revisadoEn: ahora, ajustadoEn: ahora, suscripcionId: sub.id } }, { merge: true });
    await db.collection("facturacionRegistro").add({ agencyId, antes: cobrados, despues: usuarios, suscripcionId: sub.id, fecha: ahora });
    return { ...base, estado: "ajustada", usuarios, cobrados: usuarios, detalle: `De ${cobrados} a ${usuarios} usuarios.` };
  } catch (e: any) {
    return { ...base, estado: "error", detalle: String(e?.message || e).slice(0, 200) };
  }
}

/** Revisa todas las agencias que tienen suscripcion. `sincronizar` sale del interruptor de plataforma/facturacion. */
export async function sincronizarTodas(db: any, stripe: any): Promise<ResultadoSync[]> {
  const interruptor = (await db.collection("plataforma").doc("facturacion").get()).data();
  const aplicar = interruptor?.sincronizar === true;
  const agencias = await db.collection("agencies").get();
  const resultados: ResultadoSync[] = [];
  for (const d of agencias.docs) {
    const x = d.data();
    if (x.hasFreeAccess || !x.stripeCustomerId) continue;
    resultados.push(await sincronizarUsuariosDeAgencia(db, stripe, d.id, { aplicar }));
  }
  await db.collection("plataforma").doc("facturacionUltimaRevision").set({ en: new Date().toISOString(), aplicar, resultados }, { merge: false });
  return resultados;
}
