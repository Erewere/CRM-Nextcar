const fs = require('fs');
let content = fs.readFileSync('src/pages/Tasks.tsx', 'utf8');

if (!content.includes('Briefcase,')) {
  content = content.replace(
    `  User,`,
    `  User,\n  Briefcase,`
  );
}

content = content.replace(
  `                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className={clsx("text-[15px] font-normal tracking-wide text-slate-900 dark:text-slate-100", task.completed && "line-through text-gray-500 dark:text-slate-400")}>
                      {task.title}
                    </span>
                    {client && (
                      <span className="text-sm text-slate-500 dark:text-slate-400 truncate">
                        {client.name}
                      </span>
                    )}
                    {task.dueDate && (
                      <div className="flex items-center gap-1.5 mt-1.5">`,
  `                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className={clsx("text-[15px] font-normal tracking-wide text-slate-900 dark:text-slate-100", task.completed && "line-through text-gray-500 dark:text-slate-400")}>
                      {task.title}
                    </span>
                    
                    <div className="flex flex-col gap-0.5 mt-0.5">
                      {task.dealId && deals && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                           <Briefcase className="w-3.5 h-3.5 opacity-70" />
                           <span className="truncate">{deals.find(d => d.id === task.dealId)?.title || "Trato"}</span>
                         </div>
                      )}
                      {client && (
                         <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                           <User className="w-3.5 h-3.5 opacity-70" />
                           <span className="truncate">{client.name}</span>
                         </div>
                      )}
                    </div>

                    {task.dueDate && (
                      <div className="flex items-center gap-1.5 mt-1.5">`
);

fs.writeFileSync('src/pages/Tasks.tsx', content);
console.log('Patched Tasks.tsx for mobile task fields');
