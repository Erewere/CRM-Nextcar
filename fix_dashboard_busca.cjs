const fs = require('fs');
let content = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// 1. Add calculation
const matchCalcStr = `  // Match Calculation
  let allClientMatches = 0;
  activeContacts.forEach((client) => {
    const matches = getClientMatches(client, availableVehicles);
    allClientMatches += matches.length;
  });`;

const buscanAutoCalc = `
  const buscanAutoClients = activeContacts.filter(c => 
    c.tags && c.tags.some(t => t.toLowerCase().includes('busca de auto') || t.toLowerCase().includes('busca auto') || t.toLowerCase() === 'compra')
  );
  const buscanAutoCount = buscanAutoClients.length;
`;

if (content.includes(matchCalcStr) && !content.includes('buscanAutoCount')) {
  content = content.replace(matchCalcStr, matchCalcStr + buscanAutoCalc);
}

// 2. Add to mobile action center
const mobileActionCenterMatches = `{allClientMatches > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-500" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Matches</p>
                  </div>
                  <span className="text-emerald-600 font-black text-lg">{allClientMatches}</span>
                </Link>
              )}`;

const mobileBuscanAutoUI = `
              {buscanAutoCount > 0 && (
                <Link to="/persons" className="flex flex-col gap-1 justify-between p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 transition-colors">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">Buscan Auto</p>
                  </div>
                  <span className="text-indigo-600 font-black text-lg">{buscanAutoCount}</span>
                </Link>
              )}
`;

if (content.includes(mobileActionCenterMatches) && !content.includes('buscanAutoCount > 0 &&')) {
  content = content.replace(mobileActionCenterMatches, mobileBuscanAutoUI + mobileActionCenterMatches);
}

// 3. Add to desktop action center
const desktopActionCenterMatches = `{allClientMatches > 0 && (
                  <Link
                    to="/persons"
                    className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors h-full"
                  >
                    <div className="flex items-center gap-3">
                      <Target className="w-5 h-5 text-emerald-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Matches Inventario
                        </p>
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                          Posibles coincidencias
                        </p>
                      </div>
                    </div>
                    <span className="text-emerald-600 font-black text-xl">
                      {allClientMatches}
                    </span>
                  </Link>
                )}`;
                
const desktopBuscanAutoUI = `
                {buscanAutoCount > 0 && (
                  <Link
                    to="/persons"
                    className="flex flex-col gap-2 justify-between p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors h-full"
                  >
                    <div className="flex items-center gap-3">
                      <Car className="w-5 h-5 text-indigo-500" />
                      <div>
                        <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                          Buscan Auto
                        </p>
                        <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          Prospectos en búsqueda
                        </p>
                      </div>
                    </div>
                    <span className="text-indigo-600 font-black text-xl">
                      {buscanAutoCount}
                    </span>
                  </Link>
                )}
`;

if (content.includes(desktopActionCenterMatches) && !content.includes(desktopBuscanAutoUI.trim())) {
  content = content.replace(desktopActionCenterMatches, desktopBuscanAutoUI + desktopActionCenterMatches);
}

// 4. Ensure Car icon is imported from lucide-react
if (!content.includes('Car,') && !content.includes(', Car') && content.includes('lucide-react')) {
  content = content.replace('Calendar,', 'Calendar,\n  Car,');
}

fs.writeFileSync('src/pages/Dashboard.tsx', content);
console.log('Fixed Dashboard.tsx');
