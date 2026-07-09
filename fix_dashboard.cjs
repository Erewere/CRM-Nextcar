const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

const regex = /\{userData\?\.role === "admin" && \(\s*<Link[\s\S]*?Matches de Inventario[\s\S]*?<\/Link>\s*\)\}/;

const correctFilters = `
            {userData?.role === "admin" && (
              <select
                className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 max-w-[150px] truncate"
                value={filterSeller}
                onChange={(e) => setFilterSeller(e.target.value)}
              >
                <option value="all">Todos los vendedores</option>
                {users
                  .filter((u) => u.role === "seller")
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
              </select>
            )}
            <select
              className="px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 max-w-[180px] truncate"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {Array.from(
                new Set(vehicles.map((v) => v.bodyType).filter(Boolean)),
              ).map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
            <div className="relative">
              <button
                onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm rounded-md focus:outline-none text-slate-700 dark:text-slate-300 max-w-[180px]"
              >
                <span className="truncate">
                  {filterTags.length > 0
                    ? \`\${filterTags.length} etiquetas\`
                    : "Todas las etiquetas"}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>
              {isTagDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-0"
                    onClick={() => setIsTagDropdownOpen(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-10 py-1 max-h-60 overflow-y-auto">
                    <div
                      className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
                      onClick={() => {
                        setFilterTags([]);
                        setIsTagDropdownOpen(false);
                      }}
                    >
                      <span>Todas las etiquetas</span>
                      {filterTags.length === 0 && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    {agencyTags.map((tag) => (
                      <div
                        key={tag.id}
                        className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-between text-sm text-slate-700 dark:text-slate-300"
                        onClick={() => {
                          if (filterTags.includes(tag.name)) {
                            setFilterTags(
                              filterTags.filter((t) => t !== tag.name),
                            );
                          } else {
                            setFilterTags([...filterTags, tag.name]);
                          }
                        }}
                      >
                        <span>{tag.name}</span>
                        {filterTags.includes(tag.name) && (
                          <Check className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
              <span className="text-xs text-slate-400 font-medium">Desde</span>
              <input
                type="date"
                className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-300"
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setActiveDateFilter(""); }}
              />
            </div>
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1">
              <span className="text-xs text-slate-400 font-medium">Hasta</span>
              <input
                type="date"
                className="bg-transparent text-sm focus:outline-none text-slate-700 dark:text-slate-300"
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setActiveDateFilter(""); }}
              />
            </div>
            {(filterSeller !== "all" ||
              filterCategory !== "all" ||
              filterTags.length > 0 ||
              filterStartDate ||
              filterEndDate) && (
              <button
                onClick={() => {
                  setFilterSeller("all");
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setFilterCategory("all");
                  setFilterTags([]);
                  setActiveDateFilter("");
                }}
                className="text-xs text-red-500 hover:text-red-700 font-medium px-2"
              >
                Limpiar Filtros
              </button>
            )}
`;

code = code.replace(regex, correctFilters);
fs.writeFileSync('src/pages/Dashboard.tsx', code);
