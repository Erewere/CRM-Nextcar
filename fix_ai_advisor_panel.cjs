const fs = require('fs');
let code = fs.readFileSync('src/components/AiAdvisorPanel.tsx', 'utf8');

// Stop auto-fetching in useEffect
const effectStart = `    // Call AI in the background
    if (activeContacts.length > 0) {
      setIsLoading(true);
      setErrorMsg(null);
      fetch("/api/ai-advisor", {`;
const effectEnd = `      .finally(() => setIsLoading(false));
    }`;

const fetchLogic = code.substring(code.indexOf(effectStart), code.indexOf(effectEnd) + effectEnd.length);

code = code.replace(fetchLogic, '');

// Create the fetch function
const newFetchLogic = `
  const handleAnalyzeWithAI = () => {
    if (activeContacts.length === 0) return;
    setIsLoading(true);
    setErrorMsg(null);
    fetch("/api/ai-advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agencyId,
        activeContacts: activeContacts.slice(0, 10),
        tasks,
        pipelineStages
      })
    })
    .then(res => {
      if (!res.ok) {
         return res.json().then(err => { throw new Error(err.error || 'Error calling AI'); });
      }
      return res.json();
    })
    .then(data => {
      if (data.recommendations && Array.isArray(data.recommendations)) {
        const aiMapped = data.recommendations.map((rec: any) => {
          let icon = null;
          switch (rec.type) {
            case 'overdue': icon = <Phone className="w-4 h-4 text-rose-400" />; break;
            case 'proposal': icon = <FileText className="w-4 h-4 text-purple-400" />; break;
            case 'followup': icon = <Clock className="w-4 h-4 text-amber-400" />; break;
            case 'new': icon = <Phone className="w-4 h-4 text-blue-400" />; break;
            case 'closing': icon = <CheckCircle className="w-4 h-4 text-emerald-400" />; break;
            case 'meeting': icon = <Phone className="w-4 h-4 text-indigo-400" />; break;
            default: icon = <Phone className="w-4 h-4 text-slate-400" />;
          }
          return { ...rec, icon };
        }).slice(0, 8);
        
        if (aiMapped.length > 0) {
          setRecommendations(aiMapped);
        }
      }
    })
    .catch(err => { console.error(err); setErrorMsg(err.message || "Error al obtener recomendaciones"); })
    .finally(() => setIsLoading(false));
  };
`;

code = code.replace('useEffect(() => {', newFetchLogic + '\n  useEffect(() => {');

// Add the button and change rendering
const buttonHtmlSearch = `<div className="hidden sm:flex items-center gap-2 text-xs bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-full text-indigo-200">
          {isLoading ? (
            <><Loader2 className="w-3 h-3 animate-spin text-indigo-300" /> Analizando con Gemini...</>
          ) : (
            <><span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Recomendaciones en tiempo real</>
          )}
        </div>`;

const buttonHtmlReplace = `<div className="flex items-center gap-2">
          {isLoading ? (
            <div className="hidden sm:flex items-center gap-2 text-xs bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 rounded-full text-indigo-200">
              <Loader2 className="w-3 h-3 animate-spin text-indigo-300" /> Analizando con Gemini...
            </div>
          ) : (
            <button onClick={handleAnalyzeWithAI} className="hidden sm:flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 border border-indigo-400/50 px-3 py-1.5 rounded-full text-white transition-colors cursor-pointer shadow-sm">
              <Bot className="w-3 h-3" /> Analizar con Gemini
            </button>
          )}
        </div>`;
code = code.replace(buttonHtmlSearch, buttonHtmlReplace);

// Fix the card display
const cardDisplaySearch = `<p className="text-sm font-semibold text-white leading-tight pr-2 group-hover:text-indigo-200 transition-colors">
                    {idx + 1}. {rec.actionText}
                  </p>
                  <p className="text-xs text-indigo-200/70 mt-1">{rec.reason}</p>`;

const cardDisplayReplace = `<div className="mb-1">
                    <p className="text-xs font-bold text-indigo-300 truncate">
                      {rec.clientName}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-white leading-tight pr-2 group-hover:text-indigo-200 transition-colors">
                    {rec.actionText}
                  </p>
                  <p className="text-[10px] text-indigo-200/70 mt-1 line-clamp-2">{rec.reason}</p>`;
code = code.replace(cardDisplaySearch, cardDisplayReplace);

fs.writeFileSync('src/components/AiAdvisorPanel.tsx', code);
