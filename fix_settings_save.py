import os

path = "src/components/UserSettingsModal.tsx"
with open(path, "r") as f:
    content = f.read()

save_update_old = """      await updateDoc(doc(db, "users", userData.id), {
        name: name,
      });"""
save_update_new = """      await updateDoc(doc(db, "users", userData.id), {
        name: name.trim(),
        adminMobileViewAllContacts
      });"""

if save_update_old in content:
    content = content.replace(save_update_old, save_update_new)
else:
    print("Not found")

with open(path, "w") as f:
    f.write(content)
