import os

path = "src/components/UserSettingsModal.tsx"
with open(path, "r") as f:
    content = f.read()

import_statement = "import { useNavigate } from \"react-router\";\nimport { useIsMobile } from \"../hooks/useIsMobile\";"
content = content.replace("import { useNavigate } from \"react-router\";", import_statement)


state_init = """  const { userData, currentUser } = useAuth();
  const isMobile = useIsMobile();
  const [name, setName] = useState(userData?.name || "");
  const [adminMobileViewAllContacts, setAdminMobileViewAllContacts] = useState(
    userData?.adminMobileViewAllContacts !== false
  );"""
content = content.replace("""  const { userData, currentUser } = useAuth();
  const [name, setName] = useState(userData?.name || "");""", state_init)

effect_update = """  React.useEffect(() => {
    if (isOpen && userData) {
      setName(userData.name || "");
      setAdminMobileViewAllContacts(userData.adminMobileViewAllContacts !== false);
    }
  }, [isOpen, userData]);"""
content = content.replace("""  React.useEffect(() => {
    if (isOpen && userData) {
      setName(userData.name || "");
    }
  }, [isOpen, userData]);""", effect_update)


save_update_old = """      await updateDoc(userRef, {
        name: name.trim()
      });"""
save_update_new = """      await updateDoc(userRef, {
        name: name.trim(),
        adminMobileViewAllContacts
      });"""
content = content.replace(save_update_old, save_update_new)


ui_insert = """            </div>

            {isMobile && userData.role === "admin" && (
              <div className="pt-2">
                <label className="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="relative inline-flex items-center">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={adminMobileViewAllContacts}
                      onChange={(e) => setAdminMobileViewAllContacts(e.target.checked)}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
                  </div>
                  <div>
                    <span className="block text-sm font-medium text-slate-900 dark:text-white">Ver todos los contactos</span>
                    <span className="block text-xs text-slate-500">Al desactivar, verás solo tus contactos.</span>
                  </div>
                </label>
              </div>
            )}

            <div className="pt-4 flex gap-3">"""
content = content.replace("""            </div>

            <div className="pt-4 flex gap-3">""", ui_insert)

with open(path, "w") as f:
    f.write(content)
