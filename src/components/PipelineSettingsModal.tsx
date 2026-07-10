import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { PipelineStage } from '../types';

interface Props {
  onClose: () => void;
  currentStages: PipelineStage[];
}

export function PipelineSettingsModal({ onClose, currentStages }: Props) {
  const { userData } = useAuth();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  useEffect(() => {
    setStages(currentStages);
  }, [currentStages]);

  const handleSave = async () => {
    if (!userData?.agencyId) {
      alert('No tienes perfil activo.');
      return;
    }
    setLoading(true);
    try {
      await setDoc(doc(db, 'agencies', userData.agencyId), {
        pipelineStages: stages
      }, { merge: true });
    } catch (e: any) {
      console.error('Error saving pipeline stages', e);
      alert('Error saving pipeline stages: ' + e?.message);
    } finally {
      setLoading(false);
      onClose(); // ensure it closes in both cases
    }
  };

  const handleAdd = () => {
    if (!newTitle.trim()) return;
    const id = newTitle.toLowerCase().replace(/[^a-z0-9]/g, '-');
    setStages([...stages, { id, title: newTitle }]);
    setNewTitle('');
  };

  const handleRemove = (id: string) => {
    setStages(stages.filter(s => s.id !== id));
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newStages = [...stages];
    const temp = newStages[index - 1];
    newStages[index - 1] = newStages[index];
    newStages[index] = temp;
    setStages(newStages);
  };

  const moveDown = (index: number) => {
    if (index === stages.length - 1) return;
    const newStages = [...stages];
    const temp = newStages[index + 1];
    newStages[index + 1] = newStages[index];
    newStages[index] = temp;
    setStages(newStages);
  };

  if (userData?.role !== 'admin') return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] relative z-10">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-900">
          <h2 className="font-bold text-lg text-slate-800 dark:text-slate-200">Configurar Etapas</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-slate-400">✕</button>
        </div>
        
        <div className="p-4 overflow-y-auto flex-1">
          <div className="mb-4 flex gap-2">
            <input 
              type="text" 
              placeholder="Nueva etapa..." 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button onClick={handleAdd} className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-semibold">
              Agregar
            </button>
          </div>

          <div className="space-y-2">
            {stages.map((stage, i) => (
              <div key={stage.id} className="flex items-center justify-between border rounded-lg p-2 bg-white dark:bg-slate-800">
                <span className="font-medium text-sm text-slate-700 dark:text-slate-300">{stage.title}</span>
                <div className="flex gap-1">
                  <button onClick={() => moveUp(i)} disabled={i === 0} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                    ↑
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === stages.length - 1} className="p-1 text-slate-400 hover:text-blue-600 disabled:opacity-30">
                    ↓
                  </button>
                  <button onClick={() => handleRemove(stage.id)} className="p-1 text-slate-400 hover:text-red-600 ml-2">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 rounded-lg">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="px-4 py-2 text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 rounded-lg font-bold">
            {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
