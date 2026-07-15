const fs = require('fs');
let content = fs.readFileSync('src/pages/AgencyUsers.tsx', 'utf8');

// Add states
content = content.replace(
  `  const [savingInactivity, setSavingInactivity] = useState(false);`,
  `  const [savingInactivity, setSavingInactivity] = useState(false);
  const [businessStart, setBusinessStart] = useState('08:00');
  const [businessEnd, setBusinessEnd] = useState('21:00');
  const [savingHours, setSavingHours] = useState(false);`
);

// Add loading logic
content = content.replace(
  `          const agencySnap = await getDoc(doc(db, 'agencies', userData.agencyId));
          if (agencySnap.exists() && agencySnap.data().inactivityAlertDays) {
            setInactivityAlertDays(agencySnap.data().inactivityAlertDays);
          }`,
  `          const agencySnap = await getDoc(doc(db, 'agencies', userData.agencyId));
          if (agencySnap.exists()) {
            const agencyData = agencySnap.data();
            if (agencyData.inactivityAlertDays) {
              setInactivityAlertDays(agencyData.inactivityAlertDays);
            }
            if (agencyData.businessHours) {
              setBusinessStart(agencyData.businessHours.start || '08:00');
              setBusinessEnd(agencyData.businessHours.end || '21:00');
            }
          }`
);

// Add save function
content = content.replace(
  `  const handleSaveInactivity = async () => {`,
  `  const handleSaveBusinessHours = async () => {
    if (!userData?.agencyId || userData.agencyId === 'unassigned') return;
    setSavingHours(true);
    try {
      await updateDoc(doc(db, 'agencies', userData.agencyId), {
        businessHours: { start: businessStart, end: businessEnd }
      });
      // Optionally show a non-intrusive toast, but an alert works for now
      // alert('Horario guardado correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al guardar el horario.');
    } finally {
      setSavingHours(false);
    }
  };

  const handleSaveInactivity = async () => {`
);

// Add UI
content = content.replace(
  `      {/* Sección de Gestión de Etiquetas */}`,
  `      {/* Horario de Calendario */}
      {userData?.role === 'admin' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-500" />
              Horario del Calendario
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Define el horario de inicio y fin para mostrar en el calendario de la agencia.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Inicio</label>
              <input 
                type="time" 
                value={businessStart}
                onChange={(e) => setBusinessStart(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fin</label>
              <input 
                type="time" 
                value={businessEnd}
                onChange={(e) => setBusinessEnd(e.target.value)}
                className="border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1.5 text-sm bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="pt-5">
              <button 
                onClick={handleSaveBusinessHours}
                disabled={savingHours}
                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
              >
                {savingHours ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sección de Gestión de Etiquetas */}`
);

fs.writeFileSync('src/pages/AgencyUsers.tsx', content);
console.log('Fixed AgencyUsers.tsx');
