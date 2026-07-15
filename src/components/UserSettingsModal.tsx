import React, { useState, useRef } from "react";
import { X, Upload, Camera, LogOut } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage, logout } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { User } from "../types";
import { useNavigate } from "react-router";
import clsx from "clsx";

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserSettingsModal({ isOpen, onClose }: UserSettingsModalProps) {
  const { userData, currentUser } = useAuth();
  const [name, setName] = useState(userData?.name || "");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isOpen && userData) {
      setName(userData.name || "");
    }
  }, [isOpen, userData]);

  if (!isOpen || !userData) return null;

  const handleLogout = async () => {
    try {
      await logout();
      onClose();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase() || "US";
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData.id) return;
    
    try {
      setIsSaving(true);
      await updateDoc(doc(db, "users", userData.id), {
        name: name,
      });
      onClose();
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Hubo un error al guardar los cambios.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData.id) return;

    try {
      setUploadingImage(true);
      const storageRef = ref(storage, `users/${userData.id}/avatar/${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",
        () => {},
        (error) => {
          console.error("Upload error:", error);
          alert("Error subiendo la imagen.");
          setUploadingImage(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          await updateDoc(doc(db, "users", userData.id), {
            photoURL: downloadURL,
          });
          setUploadingImage(false);
        }
      );
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Hubo un error al subir la imagen.");
      setUploadingImage(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 relative z-10">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-800 dark:text-white">
            Configuración de Usuario
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              {userData.photoURL ? (
                <img
                  src={userData.photoURL}
                  alt="Avatar"
                  className="w-20 h-20 rounded-full object-cover border-2 border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold text-2xl flex items-center justify-center border-2 border-slate-200 dark:border-slate-700">
                  {getInitials(userData.name)}
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-6 h-6 text-white" />
              </div>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={handleImageUpload}
                disabled={uploadingImage}
              />
            </div>
            {uploadingImage && (
              <p className="text-xs text-blue-500 mt-2">Subiendo...</p>
            )}
            <div className="mt-3 text-center">
              <p className="text-sm font-medium text-slate-900 dark:text-white">{userData.email}</p>
              <p className="text-xs text-slate-500 capitalize">{userData.role}</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Nombre
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                placeholder="Ingresa tu nombre"
              />
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors text-sm"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50 transition-colors text-sm"
              >
                {isSaving ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/40 rounded-lg font-medium transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
