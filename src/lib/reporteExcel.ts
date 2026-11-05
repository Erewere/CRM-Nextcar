import * as XLSX from "xlsx";
import type { Analitica, Hallazgo } from "./analiticaAgencia";

/**
 * El tablero del administrador, en un libro de Excel.
 *
 * Los montos van como numeros y las fechas como fechas, no como texto: quien
 * lo abra tiene que poder sumar, filtrar y hacer su tabla dinamica. El costo y
 * el margen solo salen si quien descarga puede verlos en pantalla.
 */

export interface Hoja {
  nombre: string;
  filas: Record<string, string | number | Date | null>[];
}

const fecha = (ms: number | null) => (ms ? new Date(ms) : null);

export function descargarExcel(nombreArchivo: string, hojas: Hoja[]) {
  const libro = XLSX.utils.book_new();
  for (const h of hojas) {
    const filas = h.filas.length ? h.filas : [{ Nota: "Sin datos en este periodo" }];
    const hoja = XLSX.utils.json_to_sheet(filas, { cellDates: true, dateNF: "dd/mm/yyyy" });
    // Ancho de columna segun lo que trae, para que se lea sin arrastrar bordes.
    const claves = Object.keys(filas[0]);
    hoja["!cols"] = claves.map((k) => ({
      wch: Math.min(60, Math.max(k.length, ...filas.map((f) => {
        const v = f[k];
        return v instanceof Date ? 10 : String(v ?? "").length;
      })) + 2),
    }));
    // Excel no acepta nombres de hoja de mas de 31 letras ni con : \ / ? * [ ]
    XLSX.utils.book_append_sheet(libro, hoja, h.nombre.replace(/[:\\/?*[\]]/g, " ").slice(0, 31));
  }
  XLSX.writeFile(libro, nombreArchivo);
}

export function hojasDelReporte(
  a: Analitica,
  h: Hallazgo[],
  o: { verCostos: boolean; periodo: string; agencia: string },
): Record<"resumen" | "ventas" | "inventario" | "clientes" | "equipo", Hoja[]> {
  const r = a.resumen;
  const d = a.desempeno;
  const resumen: Hoja[] = [
    {
      nombre: "Resumen",
      filas: [
        { Indicador: "Agencia", Valor: o.agencia },
        { Indicador: "Periodo", Valor: o.periodo },
        { Indicador: "Autos vendidos", Valor: r.ventas },
        { Indicador: "Autos vendidos (periodo anterior)", Valor: r.ventasAntes },
        { Indicador: "Ingresos por ventas", Valor: r.ingresos },
        { Indicador: "Ingresos (periodo anterior)", Valor: r.ingresosAntes },
        { Indicador: "Ticket promedio", Valor: r.ticket },
        { Indicador: "Días para vender (mediana)", Valor: r.diasParaVender },
        { Indicador: "Prospectos nuevos", Valor: r.prospectos },
        { Indicador: "Prospectos nuevos (periodo anterior)", Valor: r.prospectosAntes },
        { Indicador: "Tratos abiertos hoy", Valor: r.tratosAbiertos },
        { Indicador: "Autos en inventario", Valor: r.inventarioUnidades },
        { Indicador: "Valor del inventario", Valor: r.inventarioValor },
        ...(o.verCostos ? [{ Indicador: `Margen bruto (sobre ${r.margenSobre} autos con costo)`, Valor: r.margen }] : []),
        ...h.map((x, i) => ({ Indicador: `Hallazgo ${i + 1}`, Valor: x.texto })),
      ],
    },
    {
      nombre: "Desempeño",
      filas: [
        ...(o.verCostos
          ? [
              { Indicador: "ROI de lo vendido (%)", Valor: d.roi, "Qué significa": "Utilidad entre lo invertido (compra + gastos del auto). De cada $100 invertidos, cuánto quedó." },
              { Indicador: "ROI anualizado (%)", Valor: d.roiAnual, "Qué significa": "El mismo retorno llevado a un año según los días que el dinero estuvo parado en cada auto. Premia vender rápido y permite comparar autos que tardaron distinto." },
              { Indicador: "Utilidad neta", Valor: d.conCosto ? d.utilidad : null, "Qué significa": "Precio de venta menos compra y gastos, de los autos con costo capturado." },
              { Indicador: "Inversión en lo vendido", Valor: d.conCosto ? d.inversion : null, "Qué significa": "Compra más gastos (reparación, trámites) de esos autos." },
              { Indicador: "Margen sobre venta (%)", Valor: d.margenPct, "Qué significa": "De cada $100 que se vendieron, cuánto fue utilidad." },
              { Indicador: "Utilidad por día en piso", Valor: d.utilidadPorDia, "Qué significa": "Lo que dejó, en promedio, cada día que un auto estuvo en el piso." },
              { Indicador: "Autos vendidos con costo capturado", Valor: `${d.conCosto} de ${d.ventas}`, "Qué significa": "El ROI solo cuenta los autos que tienen costo y precio de venta. Mientras más costos captures, más completo es." },
              { Indicador: "ROI del periodo anterior (%)", Valor: d.antes.roi, "Qué significa": "Para comparar con el periodo de arriba, del mismo largo." },
            ]
          : []),
        { Indicador: "Días en piso al vender (promedio)", Valor: d.diasPromedio, "Qué significa": "Desde que llegó el auto hasta que se vendió." },
        { Indicador: "Días en piso al vender (mediana)", Valor: r.diasParaVender, "Qué significa": "La mitad de los autos se vendió en menos días que esto." },
        { Indicador: "% vendido en 30 días o menos", Valor: d.pctRapidas, "Qué significa": "Autos que rotan rápido." },
        { Indicador: "% que tardó más de 90 días", Valor: d.pctLentas, "Qué significa": "Autos que se quedaron mucho tiempo." },
        { Indicador: "Rotación del piso (veces al año)", Valor: d.rotacion, "Qué significa": "Ventas de los últimos 12 meses entre autos en piso hoy. Más alto, mejor." },
        { Indicador: "Días que tarda en venderse todo el piso", Valor: d.diasDeInventario, "Qué significa": "Con el ritmo de ventas de 12 meses, en cuánto tiempo se vendería el inventario actual." },
        ...(o.verCostos
          ? [
              { Indicador: "Dinero invertido en el piso", Valor: d.capitalSobre ? d.capital : null, "Qué significa": `Compra + gastos de ${d.capitalSobre} autos propios sin vender. No cuenta consignación, que no costó dinero.` },
              { Indicador: "Dinero parado más de 90 días", Valor: d.capitalSobre ? d.capitalParado90 : null, "Qué significa": "La parte de esa inversión que está en autos con más de 90 días en piso." },
              { Indicador: "Utilidad en tu piso (a precio de lista)", Valor: d.capitalSobre ? d.utilidadPotencial : null, "Qué significa": "Lo que quedaría si se vendiera todo al precio publicado." },
              { Indicador: "ROI en tu piso (%)", Valor: d.roiPotencial, "Qué significa": "Esa utilidad entre lo invertido." },
            ]
          : []),
      ],
    },
  ];

  const ventas: Hoja[] = [
    {
      nombre: "Ventas",
      filas: a.ventas.lista.map((v) => ({
        Auto: v.auto,
        Tipo: v.tipo,
        Marca: v.marca,
        Año: v.anio || null,
        Transmisión: v.transmision,
        "Precio de venta": v.precio,
        "Vendido el": fecha(v.vendidoEl),
        "Días para vender": v.dias,
        ...(o.verCostos
          ? {
              Costo: v.costo,
              Gastos: v.gastos,
              Inversión: v.inversion,
              "Margen bruto": v.margen,
              "Utilidad neta": v.utilidad,
              "ROI %": v.roi,
              "Utilidad por día en piso": v.utilidad != null && v.dias != null ? Math.round(v.utilidad / Math.max(1, v.dias)) : null,
            }
          : {}),
      })),
    },
    {
      nombre: "Rapidez de venta",
      filas: d.porRapidez.map((x) => ({
        "Días en piso antes de venderse": x.etiqueta,
        Autos: x.unidades,
        Ingresos: x.ingresos,
        ...(o.verCostos
          ? { "Autos con costo": x.conCosto, Inversión: x.conCosto ? x.inversion : null, "Utilidad neta": x.conCosto ? x.utilidad : null, "Utilidad por auto": x.utilidadPromedio, "ROI %": x.roi, "ROI anualizado %": x.roiAnual }
          : {}),
      })),
    },
    {
      nombre: "Ventas por tipo",
      filas: a.ventas.porTipo.map((t) => ({
        Tipo: t.tipo, Unidades: t.unidades, Monto: t.monto, "Ticket promedio": t.ticket, "Días para vender (mediana)": t.diasMediana,
        ...(o.verCostos ? { "Autos con costo": t.conCosto, "Utilidad neta": t.conCosto ? t.utilidad : null, "ROI %": t.roi, "ROI anualizado %": t.roiAnual, "Utilidad por día en piso": t.utilidadPorDia } : {}),
      })),
    },
    { nombre: "Por rango de precio", filas: a.ventas.porRango.map((t) => ({ Rango: t.etiqueta, Unidades: t.unidades, Monto: t.monto })) },
    {
      nombre: "Ventas por marca",
      filas: a.ventas.porMarca.map((t) => ({
        Marca: t.marca, Unidades: t.unidades, Monto: t.monto, "Días para vender (mediana)": t.diasMediana,
        ...(o.verCostos ? { "Autos con costo": t.conCosto, "Utilidad neta": t.conCosto ? t.utilidad : null, "ROI %": t.roi, "ROI anualizado %": t.roiAnual } : {}),
      })),
    },
    { nombre: "Ventas por año modelo", filas: a.ventas.porAnio.map((t) => ({ "Año modelo": t.rango, Unidades: t.unidades, Monto: t.monto })) },
    { nombre: "Ventas por mes", filas: a.ventas.porMes.map((t) => ({ Mes: t.etiqueta, Unidades: t.unidades, Monto: t.monto })) },
  ];

  const inventario: Hoja[] = [
    {
      nombre: "Inventario",
      filas: a.inventario.lista.map((v) => ({
        Auto: v.auto,
        Tipo: v.tipo,
        Marca: v.marca,
        Año: v.anio || null,
        Precio: v.precio,
        "Días en piso": v.dias,
        Propiedad: v.propiedad,
        Apartado: v.apartado ? "Sí" : "No",
        ...(o.verCostos ? { Costo: v.costo, Gastos: v.gastos, Inversión: v.inversion } : {}),
      })),
    },
    {
      nombre: "Antigüedad",
      filas: a.inventario.antiguedad.map((x) => ({
        Rango: x.etiqueta, Autos: x.unidades, Valor: x.valor,
        ...(o.verCostos ? { "Dinero invertido (autos propios)": x.capital } : {}),
      })),
    },
    { nombre: "Vendo vs tengo", filas: a.inventario.mezcla.map((m) => ({ Tipo: m.tipo, "% de ventas (12 meses)": m.pctVentas, "% del inventario": m.pctInventario, "Diferencia (puntos)": m.diferencia })) },
    { nombre: "Inventario por tipo", filas: a.inventario.porTipo.map((t) => ({ Tipo: t.tipo, Autos: t.unidades, Valor: t.valor })) },
  ];

  const clientes: Hoja[] = [
    { nombre: "Prospectos por fuente", filas: a.clientes.porFuente.map((f) => ({ "Cómo llegó": f.etiqueta, Prospectos: f.prospectos, Compraron: f.compraron, "Conversión %": f.conversion })) },
    { nombre: "Prospectos por mes", filas: a.clientes.porMes.map((m) => ({ Mes: m.etiqueta, Prospectos: m.prospectos })) },
    {
      nombre: "Lo que buscan",
      filas: [
        ...a.clientes.demanda.porTipo.map((t) => ({ Qué: "Tipo", Valor: t.tipo, Clientes: t.clientes })),
        ...a.clientes.demanda.porPresupuesto.filter((t) => t.clientes > 0).map((t) => ({ Qué: "Presupuesto", Valor: t.etiqueta, Clientes: t.clientes })),
        ...a.clientes.demanda.porMarca.map((t) => ({ Qué: "Marca", Valor: t.marca, Clientes: t.clientes })),
      ],
    },
  ];

  const equipo: Hoja[] = [
    { nombre: "Equipo", filas: a.equipo.map((u) => ({ Asesor: u.nombre, "Prospectos nuevos": u.prospectos, "Tratos abiertos": u.tratosAbiertos, Ventas: u.ventas, Monto: u.monto, "Conversión %": u.conversion })) },
  ];

  return { resumen, ventas, inventario, clientes, equipo };
}
