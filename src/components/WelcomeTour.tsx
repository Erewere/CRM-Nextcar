import React, { useState, useEffect } from 'react';
import { Joyride, CallBackProps, STATUS, Step } from 'react-joyride';
import { useAuth } from '../contexts/AuthContext';

export function WelcomeTour() {
  const [run, setRun] = useState(false);
  const { userData } = useAuth();

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const hasCompleted = localStorage.getItem('luho_tour_completed') || localStorage.getItem('nextcar_tour_completed');
    
    let isNewUser = false;
    if (userData?.createdAt) {
      try {
        let createdDate;
        if (typeof userData.createdAt === 'string') {
          createdDate = new Date(userData.createdAt);
        } else if (typeof userData.createdAt === 'object' && 'toDate' in userData.createdAt) {
          // @ts-ignore
          createdDate = userData.createdAt.toDate();
        } else if (typeof userData.createdAt === 'object' && 'seconds' in userData.createdAt) {
           // @ts-ignore
           createdDate = new Date(userData.createdAt.seconds * 1000);
        } else {
          createdDate = new Date(userData.createdAt);
        }
        
        isNewUser = (new Date().getTime() - createdDate.getTime()) < 1000 * 60 * 60 * 24 * 7;
      } catch (e) {
        console.error("Error parsing createdAt", e);
        isNewUser = false; // default to false if error
      }
    }
  
    if (!hasCompleted && !isMobile && isNewUser) {
      // Delay slightly to ensure UI is rendered
      const timer = setTimeout(() => {
        setRun(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [userData?.createdAt]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];
    
    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem('luho_tour_completed', 'true');
    }
  };

  const steps: Step[] = [
    {
      target: 'nav a[href="/"]',
      content: 'Bienvenido a LUHO CRM. Este es tu Dashboard, donde podrás ver las estadísticas y métricas principales de tus ventas.',
      disableBeacon: true,
    },
    {
      target: 'nav a[href="/kanban"]',
      content: 'En el Embudo de Ventas podrás administrar tus prospectos. ¡Arrastra y suelta las tarjetas para avanzar el proceso de venta!',
    },
    {
      target: 'nav a[href="/inventory"]',
      content: 'Gestiona tu Inventario de Vehículos. Puedes dar de alta autos, subir fotos y controlar su estatus (Disponible, Vendido).',
    },
    {
      target: 'nav a[href="/persons"]',
      content: 'Directorio de Personas. Mantén todos tus clientes y contactos organizados en un solo lugar.',
    },
    {
      target: 'nav a[href="/tasks"]',
      content: 'Calendario y Tareas. Programa seguimientos, reuniones y actividades diarias. ¡Conéctalo con tu Google Calendar!',
    },
    {
      target: '.tour-profile-button',
      content: 'Configuración y Perfil. Aquí puedes ajustar tus datos, contraseña y preferencias. ¡Estás listo para comenzar!',
    }
  ];

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      showSkipButton
      showProgress
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#4F46E5', // Indigo-600
          zIndex: 10000,
        },
      }}
      locale={{
        back: 'Atrás',
        close: 'Cerrar',
        last: 'Finalizar',
        next: 'Siguiente',
        skip: 'Omitir',
      }}
    />
  );
}
