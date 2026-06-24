import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types';
import { Bell, X } from 'lucide-react';
import clsx from 'clsx';

export function TaskReminders() {
  const { userData } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activeReminders, setActiveReminders] = useState<Task[]>([]);
  const notifiedTasks = useRef<Set<string>>(new Set());

  // Request browser notification permission
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, []);

  useEffect(() => {
    if (!userData?.id || userData.role === 'master' || userData.role === 'unassigned') return;

    const q = query(
      collection(db, 'tasks'),
      where('sellerId', '==', userData.id),
      where('completed', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
      setTasks(taskList);
    });

    return () => unsubscribe();
  }, [userData]);

  useEffect(() => {
    const checkReminders = () => {
      if (tasks.length === 0) return;
      
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();

      const newReminders: Task[] = [];

      tasks.forEach(task => {
        if (!task.dueDate || !task.startTime || task.completed) return;
        if (notifiedTasks.current.has(task.id)) return;

        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        
        if (task.dueDate === todayStr) {
          const [time, period] = task.startTime.split(' ');
          if (time && period) {
            let [hoursStr, minutesStr] = time.split(':');
            let hours = parseInt(hoursStr, 10);
            const minutes = parseInt(minutesStr, 10);

            if (period.toLowerCase() === 'p.m.' && hours < 12) hours += 12;
            if (period.toLowerCase() === 'a.m.' && hours === 12) hours = 0;

            // Check if task is within 15 minutes or exactly now
            const taskTimeInMinutes = hours * 60 + minutes;
            const currentTimeInMinutes = currentHours * 60 + currentMinutes;
            const diff = taskTimeInMinutes - currentTimeInMinutes;

            // Trigger if diff is exactly 15 minutes, or exactly 0 (now), or if we missed it by less than 5 mins
            if (diff === 15 || diff === 0 || (diff < 0 && diff > -5 && !notifiedTasks.current.has(task.id))) {
              newReminders.push(task);
              notifiedTasks.current.add(task.id);
              
              // Browser Notification
              if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
                new Notification('Recordatorio de Tarea', {
                  body: `${task.title} - ${task.startTime}`,
                  icon: '/favicon.svg'
                });
              }
            }
          }
        }
      });

      if (newReminders.length > 0) {
        setActiveReminders(prev => [...prev, ...newReminders]);
      }
    };

    // Check immediately, then every minute
    checkReminders();
    const interval = setInterval(checkReminders, 60000);
    return () => clearInterval(interval);
  }, [tasks]);

  const dismissReminder = (taskId: string) => {
    setActiveReminders(prev => prev.filter(t => t.id !== taskId));
  };

  if (activeReminders.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {activeReminders.map(task => (
        <div key={`reminder-${task.id}`} className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-900 shadow-xl rounded-lg p-4 flex items-start gap-3 w-80 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 p-2 rounded-full shrink-0">
            <Bell className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-gray-900 dark:text-slate-100 text-sm">Recordatorio</h4>
            <p className="text-gray-600 dark:text-slate-300 text-sm">{task.title}</p>
            <p className="text-blue-600 dark:text-blue-400 text-xs font-medium mt-1">{task.startTime}</p>
          </div>
          <button 
            onClick={() => dismissReminder(task.id)}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
