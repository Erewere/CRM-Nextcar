export function checkIsWon(status: string = "", pipelineStages: {id: string, title?: string}[] = []) {
  const wonKeywords = [
    "ganado", "won", "vendid", "cerrad", 
    "entregad", "completad", "finalizad", 
    "pagad", "exito", "éxito", "completed", "finish", "listo"
  ];
  const s = String(status || "").toLowerCase();
  if (s === "won") return true;
  if (wonKeywords.some((k) => s.includes(k))) return true;
  
  const stage = pipelineStages.find(st => st.id === status);
  if (stage) {
    const t = String(stage.title || "").toLowerCase();
    const id = String(stage.id || "").toLowerCase();
    if (id === "won") return true;
    return wonKeywords.some((k) => t.includes(k) || id.includes(k));
  }
  return false;
}

export function checkIsLost(status: string = "", pipelineStages: {id: string, title?: string}[] = []) {
  const lostKeywords = ["perdid", "lost", "cancelad", "rechazad", "fallid", "abandonad"];
  const s = String(status || "").toLowerCase();
  if (s === "lost") return true;
  if (lostKeywords.some((k) => s.includes(k))) return true;
  
  const stage = pipelineStages.find(st => st.id === status);
  if (stage) {
    const t = String(stage.title || "").toLowerCase();
    const id = String(stage.id || "").toLowerCase();
    if (id === "lost") return true;
    return lostKeywords.some((k) => t.includes(k) || id.includes(k));
  }
  return false;
}
