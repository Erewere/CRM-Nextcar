const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `                      <div
                        key={task.id}
                        className="group flex gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700/50 cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-slate-700/50 transition-all"
                        onClick={() => handleTaskClick(task)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(task.id, task.completed);
                          }}
                          className="mt-0.5 shrink-0 text-gray-300 hover:text-green-500 transition-colors"
                        >
                          <Circle className="w-4 h-4" />
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight flex items-center flex-wrap gap-1">
                            {task.title}
                            {task.type === "payment" && client && (
                              <span 
                                className="hidden group-hover:inline-block px-1.5 py-0.5 rounded text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-200 w-fit"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedClient(client);
                                }}
                              >
                                Ver Venta
                              </span>
                            )}
                          </span>
                          {task.dueDate && (
                            <span
                              className={clsx(
                                "text-[11px] mt-1 font-semibold flex items-center gap-1",
                                isAfter(
                                  startOfDay(new Date()),
                                  parseISO(task.dueDate),
                                )
                                  ? "text-rose-500"
                                  : "text-gray-500 dark:text-slate-400",
                              )}
                            >
                              {format(parseISO(task.dueDate), "MMM d", {
                                locale: es,
                              })}
                              {task.startTime && \` • \${task.startTime}\`}
                            </span>
                          )}
                          {client && (
                            <span className="text-[11px] text-blue-600 truncate mt-0.5">
                              {client.name}
                            </span>
                          )}
                        </div>
                      </div>`,
  `                      <div
                        key={task.id}
                        className="group flex gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-slate-700/30 transition-all"
                        onClick={() => handleTaskClick(task)}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(task.id, task.completed);
                          }}
                          className="mt-0.5 shrink-0 text-gray-300 dark:text-slate-500 hover:text-green-500 transition-colors"
                        >
                          <Circle className="w-5 h-5" />
                        </button>
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          <span className="text-[14px] font-medium text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                            {task.title}
                          </span>

                          <div className="flex flex-col gap-0.5">
                            {task.dealId && deals && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                <Briefcase className="w-3 h-3 opacity-70" />
                                <span className="truncate">{deals.find(d => d.id === task.dealId)?.title || "Trato"}</span>
                              </div>
                            )}
                            {client && (
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                                <User className="w-3 h-3 opacity-70" />
                                <span className="truncate">{client.name}</span>
                              </div>
                            )}
                          </div>

                          {task.dueDate && (
                            <div className="mt-1 flex items-center">
                              <span
                                className={clsx(
                                  "text-[10px] font-medium flex items-center gap-1 px-2 py-0.5 rounded-full border",
                                  isAfter(
                                    startOfDay(new Date()),
                                    parseISO(task.dueDate),
                                  ) && !task.completed
                                    ? "text-rose-500 border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800"
                                    : "text-slate-600 border-slate-200 dark:text-slate-300 dark:border-slate-700/60 dark:bg-slate-800"
                                )}
                              >
                                <Clock className="w-3 h-3" />
                                {format(parseISO(task.dueDate), "eee, d MMM", {
                                  locale: es,
                                })}
                                {task.startTime && \` • \${task.startTime}\`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Fixed Right Sidebar task styling');
