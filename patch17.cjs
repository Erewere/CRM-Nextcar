const fs = require('fs');
let content = fs.readFileSync('src/components/NewActivityModal.tsx', 'utf8');

content = content.replace(
  `        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto md:overflow-hidden">`,
  `        {/* Content */}
        <div className="flex flex-col md:flex-row flex-1 overflow-y-auto overflow-x-hidden md:overflow-hidden">`
);

content = content.replace(
  `            {/* Title & Type */}
            <div>
              <input
                type="text"`,
  `            {/* Title & Type */}
            <div className="w-full">
              <input
                type="text"`
);

content = content.replace(
  `              <div className="flex border border-gray-300 rounded w-fit overflow-hidden">`,
  `              <div className="flex border border-gray-300 rounded w-full md:w-fit overflow-hidden">`
);

content = content.replace(
  `                      className={clsx(
                        "p-2 border-r border-gray-300 last:border-r-0 hover:bg-gray-50 dark:bg-slate-900 transition-colors",`,
  `                      className={clsx(
                        "flex-1 md:flex-none p-2 border-r border-gray-300 last:border-r-0 hover:bg-gray-50 dark:bg-slate-900 transition-colors flex justify-center items-center",`
);

content = content.replace(
  `            {/* Date & Time */}
            <div className="flex items-center gap-4">
              <Clock className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0" />
              <div className="flex items-center gap-2 flex-1">`,
  `            {/* Date & Time */}
            <div className="flex items-center gap-2 md:gap-4 w-full">
              <Clock className="w-5 h-5 text-gray-500 dark:text-slate-400 flex-shrink-0 hidden md:block" />
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full">`
);

content = content.replace(
  `                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none flex-1 max-w-[150px]"
                />`,
  `                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="border border-gray-300 rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none w-full md:flex-1 md:max-w-[150px]"
                />`
);

content = content.replace(
  `                <TimeSelect
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Inicio"
                />
                <span className="text-gray-500">-</span>
                <TimeSelect
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="Fin"
                />`,
  `                <div className="flex items-center gap-2 w-full">
                  <div className="flex-1">
                    <TimeSelect
                      value={startTime}
                      onChange={setStartTime}
                      placeholder="Inicio"
                    />
                  </div>
                  <span className="text-gray-500 shrink-0">-</span>
                  <div className="flex-1">
                    <TimeSelect
                      value={endTime}
                      onChange={setEndTime}
                      placeholder="Fin"
                    />
                  </div>
                </div>`
);

fs.writeFileSync('src/components/NewActivityModal.tsx', content);
console.log('Fixed mobile layout inside form of NewActivityModal.tsx');
