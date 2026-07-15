const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

// 1. Time Column
content = content.replace(
  `                    {Array.from({ length: 24 }, (_, i) => (
                      <div
                        key={i}
                        className="h-24 border-b border-gray-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400 text-right pr-1 md:pr-2 pt-1 font-medium leading-[1.1]"
                      >
                        {i.toString().padStart(2, "0")}
                        <span className="hidden md:inline">:00</span>
                      </div>
                    ))}`,
  `                    {Array.from({ length: businessHours.end - businessHours.start + 1 }, (_, i) => {
                      const hour = i + businessHours.start;
                      return (
                        <div
                          key={hour}
                          className="h-24 border-b border-gray-200 dark:border-slate-700 text-[10px] text-gray-500 dark:text-slate-400 text-right pr-1 md:pr-2 pt-1 font-medium leading-[1.1]"
                        >
                          {hour.toString().padStart(2, "0")}
                          <span className="hidden md:inline">:00</span>
                        </div>
                      );
                    })}`
);

// 2. Hour Cells Background
content = content.replace(
  `                          <div className="relative flex-1">
                            {Array.from({ length: 24 }, (_, h) => (
                              <div
                                key={h}
                                className="h-24 border-b border-gray-100 dark:border-slate-800/50"
                              />
                            ))}`,
  `                          <div className="relative flex-1">
                            {Array.from({ length: businessHours.end - businessHours.start + 1 }, (_, h) => (
                              <div
                                key={h}
                                className="h-24 border-b border-gray-100 dark:border-slate-800/50"
                              />
                            ))}`
);

// 3. Absolute positioning of tasks
content = content.replace(
  `                              const top = startHour * 96 + (startMin / 60) * 96;`,
  `                              // Do not render tasks outside business hours
                              if (startHour < businessHours.start || startHour > businessHours.end) {
                                return null;
                              }
                              const top = (startHour - businessHours.start) * 96 + (startMin / 60) * 96;`
);

// 4. Drag logic updates
content = content.replace(
  `          const startHour = Math.floor(top / 96);
          const startMin = Math.floor(((top % 96) / 96) * 60);`,
  `          const startHour = Math.floor(top / 96) + businessHours.start;
          const startMin = Math.floor(((top % 96) / 96) * 60);`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed calendar layout inside Tasks.tsx');
