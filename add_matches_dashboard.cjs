const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const importReplacement = `import { getClientMatches } from './Persons';
import { Target } from 'lucide-react';
`;

code = code.replace(/import \{ Link \} from "react-router";/, `import { Link } from "react-router";\n${importReplacement}`);

const matchCalculation = `
  // Inventory
  const availableVehicles = filteredVehicles.filter(
    (v) => v.status === "available" || !v.status,
  );

  // Match Calculation
  const allClientMatches = useMemo(() => {
    let total = 0;
    activeContacts.forEach((client) => {
      const matches = getClientMatches(client, availableVehicles);
      total += matches.length;
    });
    return total;
  }, [activeContacts, availableVehicles]);
`;

code = code.replace(/\/\/ Inventory\s*const availableVehicles = filteredVehicles\.filter\(\s*\(v\) => v\.status === "available" \|\| !v\.status,\s*\);/, matchCalculation);

const uiInsertion = `            {userData?.role === "admin" && (
              <Link
                to="/users"
                className="block flex items-center justify-between p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Alertas de Inactividad
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Clientes sin atención (&#62;{inactivityAlertDays}d)
                    </p>
                  </div>
                </div>
                <span className="text-orange-600 font-black text-xl">
                  {inactiveAlerts.length}
                </span>
              </Link>
            )}

            {allClientMatches > 0 && (
              <Link
                to="/persons"
                className="block flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Target className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      Matches de Inventario
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
            )}
`;

code = code.replace(/            \{userData\?\.role === "admin" && \([\s\S]*?<\/Link>\s*\)\}/, uiInsertion);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
