import { aFormaVieja, deFormaVieja, estadoDeCuenta, fechaDelPago, fusionarPagosViejos, hoyISO, liquidacionAnticipada, type ConceptoPago, type PagoVenta, type PlanVenta } from "../lib/planDePagos.ts";

/**
 * Pagos de las ventas: un solo lugar para el dinero.
 *
 * Antes cada pago vivía dentro de saleDetails.payments, copiado en el trato,
 * el contacto y el auto, y lo escribían ocho caminos distintos desde el
 * navegador. Cualquiera que guardara la venta otra vez podía pisar la lista:
 * así se perdió el enganche de César Augusto (HHHSeminuevos, 5 oct 2026).
 *
 * Ahora cada pago es un documento de pagosVenta (sin regla para el
 * navegador: solo el servidor lo escribe), con quién y cuándo. No se borra:
 * se anula con motivo. Después de cada cambio el servidor reescribe la copia
 * de saleDetails.payments en trato, contacto y auto para las pantallas y
 * reportes que todavía la leen, y marca las tareas de cobro según el dinero
 * real: una mensualidad está hecha solo si hay pago que la cubra.
 */

const ROLES_NO_COBRAN = new Set(["seller", "taller"]);
// «descuento» no se registra a mano: solo sale de una liquidación anticipada.
const CONCEPTOS = new Set<ConceptoPago>(["enganche", "comision", "mensualidad", "abono", "liquidacion", "pago"]);
const ROLES_DESCUENTAN = new Set(["admin", "manager", "master"]);
const FORMAS = new Set(["efectivo", "transferencia", "tarjeta", "cheque", "otro"]);
const idValido = (s: string) => /^[A-Za-z0-9_-]{1,64}$/.test(s);
const fechaValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00`));
const textoCorto = (s: any, n = 300) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

/** Lo del plan, sin la lista vieja de pagos. */
export function planDe(sd: any): PlanVenta {
  const { payments, ...plan } = sd || {};
  return plan;
}

export function registrarVentas(app: any, { usuarioQuePide, getAdminDb }: { usuarioQuePide: (req: any, res: any) => Promise<any>; getAdminDb: () => any }) {
  const col = (db: any) => db.collection("pagosVenta");

  async function nombreDe(db: any, uid: string) {
    const u = (await db.collection("users").doc(uid).get()).data() || {};
    return String(u.name || u.email || "Usuario");
  }

  /** El trato, si es de la agencia de quien pide (el master ve todas). */
  async function tratoDe(q: any, dealId: string) {
    if (!idValido(dealId)) return null;
    const s = await q.adminDb.collection("deals").doc(dealId).get();
    if (!s.exists) return null;
    const d = s.data();
    if (q.rol !== "master" && d.agencyId !== q.agencyId) return null;
    return { ref: s.ref, datos: d };
  }

  /** El auto de esta venta: el que la registra como suya, o el del trato si su comprador es este cliente. */
  async function autoDe(db: any, dealId: string, d: any) {
    if (d.vehicleId && idValido(String(d.vehicleId))) {
      const v = await db.collection("vehicles").doc(String(d.vehicleId)).get();
      const x = v.data();
      if (x && x.agencyId === d.agencyId && (x.soldDealId === dealId || (!x.soldDealId && d.clientId && (x.buyerId === d.clientId || x.soldToClientId === d.clientId)))) return { ref: v.ref, datos: x };
    }
    const s = await db.collection("vehicles").where("soldDealId", "==", dealId).limit(1).get();
    const v = s.docs[0];
    return v && v.data().agencyId === d.agencyId ? { ref: v.ref, datos: v.data() } : null;
  }

  async function pagosDe(db: any, dealId: string): Promise<PagoVenta[]> {
    const s = await col(db).where("dealId", "==", dealId).get();
    return s.docs.map((x: any) => ({ ...x.data(), id: x.id }) as PagoVenta);
  }

  /**
   * La primera vez que se toca una venta, sus pagos viejos (de las tres
   * copias, juntas sin duplicar) pasan a pagosVenta tal cual. Se hace una
   * sola vez por trato (marca pagosEnColeccion).
   */
  async function asegurarMigrado(db: any, dealId: string) {
    const dealRef = db.collection("deals").doc(dealId);
    await db.runTransaction(async (tx: any) => {
      const ds = await tx.get(dealRef);
      const d = ds.data();
      if (!d || d.pagosEnColeccion) return;
      const auto = await autoDe(db, dealId, d);
      const cliente = d.clientId && idValido(String(d.clientId)) ? (await tx.get(db.collection("clients").doc(String(d.clientId)))).data() : null;
      const delCliente = cliente && cliente.ventaDealId === dealId ? cliente.saleDetails?.payments : null;
      const viejos = fusionarPagosViejos(d.saleDetails?.payments, delCliente, auto?.datos?.saleDetails?.payments);
      const esCredito = d.saleDetails?.method === "credito";
      const usados = new Set<string>();
      for (const p of viejos) {
        const nuevo = deFormaVieja(p, esCredito);
        if (!(nuevo.monto > 0) || !fechaValida(nuevo.fecha)) continue;
        const id = idValido(nuevo.id) && !usados.has(nuevo.id) ? `m_${dealId}_${nuevo.id}` : col(db).doc().id;
        usados.add(nuevo.id);
        const { id: _sinId, ...resto } = nuevo;
        tx.set(col(db).doc(id), { ...resto, dealId, agencyId: d.agencyId, clientId: d.clientId || null });
      }
      tx.update(dealRef, { pagosEnColeccion: true });
    });
  }

  /**
   * Reescribe la copia vieja (saleDetails.payments) en trato, contacto y auto
   * a partir de pagosVenta, y pone las tareas de cobro según el dinero real.
   */
  async function reflejar(db: any, dealId: string) {
    const ds = await db.collection("deals").doc(dealId).get();
    const d = ds.data();
    if (!d) return null;
    const pagos = await pagosDe(db, dealId);
    const activos = pagos.filter((p) => !p.anulado);
    // Las pantallas viejas suman payments como dinero: el descuento no va ahí.
    const lista = activos.filter((p) => p.concepto !== "descuento").sort((a, b) => a.fecha.localeCompare(b.fecha)).map(aFormaVieja);
    const plan = planDe(d.saleDetails);
    const ec = estadoDeCuenta(plan, pagos);
    const resumen = { pagado: ec.pagado, descontado: ec.descontado, saldo: ec.saldo, liquidada: ec.liquidada, actualizadoEn: new Date().toISOString() };

    if (d.saleDetails) await ds.ref.update({ "saleDetails.payments": lista, cuenta: resumen });
    if (d.clientId && idValido(String(d.clientId))) {
      const cRef = db.collection("clients").doc(String(d.clientId));
      const c = (await cRef.get()).data();
      // Las copias del contacto y del auto quedan iguales al trato: mismo plan, mismos pagos.
      if (c && c.ventaDealId === dealId && d.saleDetails) await cRef.update({ saleDetails: { ...plan, payments: lista } });
    }
    const auto = await autoDe(db, dealId, d);
    if (auto && d.saleDetails && (auto.datos.status === "sold" || auto.datos.saleDetails)) await auto.ref.update({ saleDetails: { ...plan, payments: lista } });

    await tareasDeCobro(db, dealId, d, ec, plan);
    return { pagos, ec };
  }

  /**
   * Las tareas de cobro siguen al plan y al dinero:
   *  - una por mensualidad del plan vigente (id fijo, así no se duplican);
   *  - hecha solo si esa mensualidad está cubierta por pagos reales;
   *  - si el plan cambió (otro plazo u otra fecha, o ya no es crédito), las
   *    pendientes que ya no corresponden se quitan. Las hechas se quedan.
   */
  async function tareasDeCobro(db: any, dealId: string, d: any, ec: any, plan: any) {
    if (!d.clientId || !idValido(String(d.clientId))) return;
    const clientId = String(d.clientId);
    const cliente = (await db.collection("clients").doc(clientId).get()).data() || {};
    const nombre = cliente.name || String(d.title || "").replace(/^Trato con /, "") || "cliente";
    const quiero = new Map<string, any>();
    if (ec.esCredito && plan.firstPaymentDate && ec.mensualidades.length) {
      const plazo = ec.mensualidades.length;
      const primera = String(plan.firstPaymentDate).slice(0, 10);
      for (const m of ec.mensualidades) {
        const id = `pago_${clientId}_${primera}_${plazo}_${m.n}`.replace(/[^\w-]/g, "_");
        quiero.set(id, { n: m.n, plazo, fecha: fechaDelPago(primera, m.n - 1), monto: m.monto, pagada: m.estado === "pagada" });
      }
    }
    const ts = await db.collection("tasks").where("clientId", "==", clientId).get();
    const deCredito = (await db.collection("deals").where("clientId", "==", clientId).get()).docs
      .filter((x: any) => x.data().saleDetails?.method === "credito" && x.data().agencyId === d.agencyId).length;
    const existentes = new Set<string>();
    const ahora = new Date().toISOString();
    for (const t of ts.docs) {
      const x = t.data();
      if (x.type !== "payment" || x.agencyId !== d.agencyId) continue;
      const deEsta = x.dealId === dealId || (!x.dealId && deCredito <= 1);
      if (!deEsta) continue;
      const q = quiero.get(t.id) || [...quiero.entries()].find(([, v]) => String(x.title || "").startsWith(`Pago ${v.n}/${v.plazo} `) && x.dueDate === v.fecha)?.[1];
      if (q) {
        existentes.add(`${q.n}`);
        const cambios: any = {};
        if (!!x.completed !== q.pagada) Object.assign(cambios, q.pagada ? { completed: true, completedAt: ahora, completadaPorPago: true } : { completed: false, completedAt: null, completadaPorPago: false });
        if (x.dealId !== dealId) cambios.dealId = dealId;
        if (Object.keys(cambios).length) await t.ref.update(cambios);
      } else if ((!x.completed || x.completadaPorPago) && /^Pago \d+\/\d+ /.test(String(x.title || ""))) {
        await t.ref.delete(); // de un plan anterior: sin cobrar, o marcada por el sistema (el pago sigue en la venta)
      }
    }
    for (const [id, q] of quiero) {
      if (existentes.has(`${q.n}`)) continue;
      await db.collection("tasks").doc(id).set({
        agencyId: d.agencyId, sellerId: d.sellerId || null, clientId, dealId,
        title: `Pago ${q.n}/${q.plazo} - Crédito de ${nombre}`,
        notes: `Monto a cobrar: $${Number(q.monto).toFixed(2)}`,
        dueDate: q.fecha, type: "payment", completed: q.pagada, ...(q.pagada ? { completedAt: ahora, completadaPorPago: true } : {}),
        createdAt: ahora,
      });
    }
  }

  async function quien(req: any, res: any) {
    const q = await usuarioQuePide(req, res);
    if (!q) return null;
    return { ...q, puedeCobrar: !ROLES_NO_COBRAN.has(q.rol), puedeDescontar: ROLES_DESCUENTAN.has(q.rol) };
  }

  // ---------- Leer la venta completa ----------
  app.get("/api/ventas/:dealId", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      const d = t.datos;
      const auto = await autoDe(q.adminDb, t.ref.id, d);
      const cliente = d.clientId && idValido(String(d.clientId)) ? (await q.adminDb.collection("clients").doc(String(d.clientId)).get()).data() : null;
      // Ver no migra: lo viejo (las tres copias juntas, como se migrará) se
      // muestra tal cual hasta que alguien registre algo.
      const pagos = d.pagosEnColeccion
        ? await pagosDe(q.adminDb, t.ref.id)
        : fusionarPagosViejos(d.saleDetails?.payments, cliente?.ventaDealId === t.ref.id ? cliente?.saleDetails?.payments : null, auto?.datos?.saleDetails?.payments)
          .map((p: any) => ({ ...deFormaVieja(p, d.saleDetails?.method === "credito"), id: String(p.id || Math.random()) }));
      const ag = (await q.adminDb.collection("agencies").doc(d.agencyId).get()).data() || {};
      const plan = planDe(d.saleDetails);
      res.json({
        venta: {
          dealId: t.ref.id,
          estado: d.status || "",
          vendidoEl: d.soldAt || "",
          cliente: cliente ? { id: d.clientId, nombre: cliente.name || "", telefono: cliente.phone || "" } : { id: d.clientId || null, nombre: d.title || "", telefono: "" },
          auto: auto ? { id: auto.ref.id, nombre: `${auto.datos.year || ""} ${auto.datos.make || ""} ${auto.datos.model || ""}`.replace(/\s+/g, " ").trim(), vin: auto.datos.vin || "", foto: (auto.datos.photoUrls || [])[0] || auto.datos.photoUrl || "" } : (d.vehicle ? { id: null, nombre: String(d.vehicle) } : null),
          agencia: { nombre: ag.name || "", logo: ag.logoUrl || "", direccion: ag.address || "", telefono: ag.phone || "" },
          plan,
          tienePlan: !!d.saleDetails,
          pagos: pagos.sort((a: any, b: any) => `${b.fecha}|${b.registradoEn || ""}`.localeCompare(`${a.fecha}|${a.registradoEn || ""}`)),
          cuenta: estadoDeCuenta(plan, pagos, hoyISO()),
        },
        puedeCobrar: q.puedeCobrar,
        puedeDescontar: q.puedeDescontar,
      });
    } catch (e) {
      console.error("ventas/leer:", e);
      res.status(500).json({ error: "No se pudo leer la venta." });
    }
  });

  // ---------- Registrar un pago ----------
  app.post("/api/ventas/:dealId/pagos", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede registrar pagos." });
    const b = req.body || {};
    const monto = Math.round((Number(b.monto) || 0) * 100) / 100;
    const fecha = String(b.fecha || "");
    const concepto = String(b.concepto || "") as ConceptoPago;
    const forma = String(b.forma || "");
    if (!(monto > 0) || monto > 50_000_000) return res.status(400).json({ error: "Pon un monto válido." });
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Pon la fecha del pago." });
    if (!CONCEPTOS.has(concepto)) return res.status(400).json({ error: "Elige qué se está pagando." });
    if (!FORMAS.has(forma)) return res.status(400).json({ error: "Elige la forma de pago." });
    // Una misma petición repetida (doble clic, red lenta) no registra dos pagos.
    const clave = textoCorto(b.clave, 64);
    if (clave && !idValido(clave)) return res.status(400).json({ error: "Petición no válida." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      if (!t.datos.saleDetails) return res.status(409).json({ error: "Primero registra la venta (precio y forma de pago)." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      const ref = clave ? col(q.adminDb).doc(`p_${t.ref.id}_${clave}`) : col(q.adminDb).doc();
      const pago = {
        dealId: t.ref.id, agencyId: t.datos.agencyId, clientId: t.datos.clientId || null,
        monto, fecha, forma, concepto,
        ...(textoCorto(b.nota) ? { nota: textoCorto(b.nota) } : {}),
        registradoPor: q.uid, registradoPorNombre: await nombreDe(q.adminDb, q.uid), registradoEn: new Date().toISOString(), origen: "crm",
      };
      const nuevo = await q.adminDb.runTransaction(async (tx: any) => {
        if ((await tx.get(ref)).exists) return false;
        tx.set(ref, pago);
        return true;
      });
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, id: ref.id, repetido: !nuevo, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/pagar:", e);
      res.status(500).json({ error: "No se pudo registrar el pago. Intenta de nuevo." });
    }
  });

  // ---------- Liquidar antes de tiempo ----------
  // El monto lo calcula el servidor con la misma regla que ve la pantalla; si
  // no coincide (alguien registró otro pago mientras tanto), se pide revisar.
  app.post("/api/ventas/:dealId/liquidar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede registrar pagos." });
    const b = req.body || {};
    const fecha = String(b.fecha || "");
    const forma = String(b.forma || "");
    const descontar = !!b.descontarIntereses;
    const clave = textoCorto(b.clave, 64);
    if (!fechaValida(fecha)) return res.status(400).json({ error: "Pon la fecha del pago." });
    if (!FORMAS.has(forma)) return res.status(400).json({ error: "Elige la forma de pago." });
    if (!clave || !idValido(clave)) return res.status(400).json({ error: "Petición no válida." });
    if (descontar && !q.puedeDescontar) return res.status(403).json({ error: "Solo un administrador o gerente puede descontar intereses." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      if (t.datos.saleDetails?.method !== "credito") return res.status(409).json({ error: "Solo un crédito de la casa se liquida así." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      const pagos = await pagosDe(q.adminDb, t.ref.id);
      const l = liquidacionAnticipada(planDe(t.datos.saleDetails), pagos, fecha);
      if (!l) return res.status(409).json({ error: "Este crédito ya está liquidado." });
      const monto = descontar ? l.conDescuento : l.sinDescuento;
      if (Math.abs(monto - Number(b.montoEsperado || 0)) > 1) return res.status(409).json({ error: "El saldo cambió mientras tanto. Revisa el monto y vuelve a intentarlo.", liquidacion: l });
      const nombre = await nombreDe(q.adminDb, q.uid);
      const comun = { dealId: t.ref.id, agencyId: t.datos.agencyId, clientId: t.datos.clientId || null, fecha, registradoPor: q.uid, registradoPorNombre: nombre, registradoEn: new Date().toISOString(), origen: "crm" };
      const refPago = col(q.adminDb).doc(`p_${t.ref.id}_${clave}`);
      const refDesc = col(q.adminDb).doc(`p_${t.ref.id}_${clave}_d`);
      const nota = textoCorto(b.nota);
      const nuevo = await q.adminDb.runTransaction(async (tx: any) => {
        if ((await tx.get(refPago)).exists) return false;
        tx.set(refPago, { ...comun, monto, forma, concepto: "liquidacion", nota: nota || (descontar ? "Liquidación anticipada (sin intereses futuros)" : "Liquidación anticipada") });
        if (descontar && l.interesFuturo > 0) {
          tx.set(refDesc, { ...comun, monto: l.interesFuturo, forma: "otro", concepto: "descuento", nota: `Intereses no generados por liquidar antes (autorizó ${nombre})` });
        }
        return true;
      });
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, repetido: !nuevo, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/liquidar:", e);
      res.status(500).json({ error: "No se pudo registrar la liquidación." });
    }
  });

  // ---------- Anular un pago (no se borra) ----------
  app.post("/api/ventas/:dealId/pagos/:pid/anular", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    if (!q.puedeCobrar) return res.status(403).json({ error: "Solo un administrador puede anular pagos." });
    const motivo = textoCorto(req.body?.motivo, 200);
    if (!motivo) return res.status(400).json({ error: "Escribe por qué se anula." });
    const pid = String(req.params.pid || "");
    if (!idValido(pid)) return res.status(400).json({ error: "Pago no válido." });
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      // El id que ve la pantalla antes de migrar es el viejo: se busca su copia.
      let ref = col(q.adminDb).doc(pid);
      let p = (await ref.get()).data();
      if (!p) { ref = col(q.adminDb).doc(`m_${t.ref.id}_${pid}`); p = (await ref.get()).data(); }
      if (!p || p.dealId !== t.ref.id) return res.status(404).json({ error: "No encontramos ese pago." });
      if (p.anulado) return res.json({ ok: true });
      if (p.concepto === "descuento") return res.status(409).json({ error: "El descuento se quita anulando la liquidación que lo generó." });
      const anulacion = { anulado: true, motivoAnulacion: motivo, anuladoPor: q.uid, anuladoPorNombre: await nombreDe(q.adminDb, q.uid), anuladoEn: new Date().toISOString() };
      await ref.update(anulacion);
      // Si era una liquidación con descuento de intereses, el descuento se va con ella.
      const desc = col(q.adminDb).doc(`${ref.id}_d`);
      if (p.concepto === "liquidacion" && (await desc.get()).exists) await desc.update(anulacion);
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/anular:", e);
      res.status(500).json({ error: "No se pudo anular el pago." });
    }
  });

  // ---------- Después de guardar la venta (trato ganado, cambio de plan) ----------
  // Las pantallas que guardan la venta reescriben saleDetails completo; esto
  // vuelve a poner los pagos y las tareas en su lugar.
  app.post("/api/ventas/:dealId/reflejar", async (req: any, res: any) => {
    const q = await quien(req, res);
    if (!q) return;
    try {
      const t = await tratoDe(q, String(req.params.dealId || ""));
      if (!t) return res.status(404).json({ error: "No encontramos esa venta." });
      await asegurarMigrado(q.adminDb, t.ref.id);
      const r = await reflejar(q.adminDb, t.ref.id);
      res.json({ ok: true, cuenta: r?.ec });
    } catch (e) {
      console.error("ventas/reflejar:", e);
      res.status(500).json({ error: "No se pudo actualizar la venta." });
    }
  });

  return { asegurarMigrado, reflejar, pagosDe, autoDe };
}
