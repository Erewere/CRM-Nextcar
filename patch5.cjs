const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

content = content.replace(
  `          {view === "list" && (
            <table className="w-full text-left border-collapse text-sm text-gray-800 dark:text-slate-200 table-fixed min-w-[800px]">`,
  `          {view === "list" && (
            <>
            <table className="hidden md:table w-full text-left border-collapse text-sm text-gray-800 dark:text-slate-200 table-fixed min-w-[800px]">`
);

content = content.replace(
  `                {sortedTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400"
                    >
                      No hay actividades para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}`,
  `                {sortedTasks.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400"
                    >
                      No hay actividades para mostrar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden flex flex-col bg-white dark:bg-[#111] min-h-full pb-24">
              {sortedTasks.map(({ task, client }) => (
                <div key={task.id} className="flex items-start gap-4 p-4 border-b border-gray-100 dark:border-[#222]" onClick={() => handleTaskClick(task)}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTask(task.id, task.completed);
                    }}
                    className={clsx(
                      "mt-1 shrink-0 transition-colors",
                      task.completed
                        ? "text-green-500"
                        : "text-gray-400 hover:text-green-500"
                    )}
                  >
                    {task.completed ? (
                      <CheckCircle className="w-6 h-6" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className={clsx("text-[15px] font-normal tracking-wide text-slate-900 dark:text-slate-100", task.completed && "line-through text-gray-500 dark:text-slate-400")}>
                      {task.title}
                    </span>
                    {client && (
                      <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {client.name}
                      </span>
                    )}
                    {task.dueDate && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <div className={clsx(
                          "flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border",
                          isAfter(startOfDay(new Date()), parseISO(task.dueDate)) && !task.completed
                            ? "text-rose-500 border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-800"
                            : "text-slate-600 border-slate-300 dark:text-slate-300 dark:border-slate-600"
                        )}>
                          <Clock className="w-3.5 h-3.5" />
                          {format(parseISO(task.dueDate), "eee, d MMM", { locale: es })}
                          {task.startTime && \` • \${task.startTime}\`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {sortedTasks.length === 0 && (
                <div className="p-8 text-center text-sm font-medium text-gray-500 dark:text-slate-400">
                  No hay actividades para mostrar.
                </div>
              )}
            </div>
            </>
          )}`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx for mobile list view');
