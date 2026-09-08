import React from 'react';
import { NextcarLogo } from '../components/NextcarLogo';

// Aviso de privacidad. Pagina publica, sin sesion: Meta la abre para revisar la
// app, y quien quiera ejercer sus derechos tiene que poder leerla sin tener
// cuenta. Por eso vive fuera de ProtectedRoute.
//
// Describe lo que el CRM hace de verdad --los canales de Meta, el calendario de
// Google, donde se guardan los datos-- y no un texto generico. Al agregar una
// integracion nueva que toque datos personales, actualizar tambien esto.

const ACTUALIZADO = '8 de septiembre de 2026';
const CONTACTO = 'contacto@erewere.com';

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3">{titulo}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

export function Privacidad() {
  return (
    <div className="min-h-[100dvh] bg-[#f4f5f5] dark:bg-slate-900 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-slate-800 rounded shadow-sm border border-gray-200 dark:border-slate-700 p-8 md:p-12">
        <div className="flex h-12 w-32 mb-8">
          <NextcarLogo variant="full" />
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-50 mb-1">
          Aviso de Privacidad
        </h1>
        <p className="text-xs text-slate-400 mb-8">Última actualización: {ACTUALIZADO}</p>

        <Seccion titulo="Quién es responsable de tus datos">
          <p>
            <strong>Luis Felipe Jaramillo Urrea</strong>, persona física que opera bajo las marcas
            <strong> Nextcar</strong> y <strong>Erewere</strong>, es el responsable del tratamiento
            de los datos personales que se recaban a través del CRM disponible en{' '}
            <strong>crm.erewere.com</strong>.
          </p>
          <p>
            Para cualquier asunto relacionado con este aviso o con tus datos, el contacto es{' '}
            <a href={`mailto:${CONTACTO}`} className="text-blue-600 dark:text-blue-400 font-semibold underline">
              {CONTACTO}
            </a>.
          </p>
        </Seccion>

        <Seccion titulo="Qué es este sistema">
          <p>
            Nextcar CRM es una herramienta de trabajo que usan agencias de venta de automóviles
            seminuevos para llevar su inventario y dar seguimiento a sus clientes. Cada agencia
            administra su propia información y solo puede ver la suya.
          </p>
          <p>
            Si eres cliente de una agencia y tus datos están aquí, fue esa agencia quien los
            registró. Ella decide qué guardar y por cuánto tiempo; nosotros ponemos el sistema donde
            se guardan.
          </p>
        </Seccion>

        <Seccion titulo="Qué datos se guardan">
          <p>De las personas interesadas en comprar o vender un vehículo:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Nombre, teléfono, correo electrónico y dirección.</li>
            <li>Qué vehículo busca o le interesa, y su presupuesto.</li>
            <li>Notas y actividades que registra el personal de la agencia.</li>
            <li>
              Las conversaciones que esa persona mantiene con la agencia por WhatsApp y por
              Messenger, cuando la agencia tiene conectados esos canales.
            </li>
            <li>
              Si se concreta una compra, los datos de la operación y de los pagos.
            </li>
          </ul>
          <p>
            De quienes usan el sistema (personal de las agencias): nombre, correo, rol dentro de su
            agencia y registro de su actividad.
          </p>
          <p>
            <strong>No se recaban</strong> datos de salud, origen étnico, creencias religiosas,
            opiniones políticas, preferencia sexual ni ningún otro dato sensible.
          </p>
        </Seccion>

        <Seccion titulo="Para qué se usan">
          <p>
            Únicamente para que la agencia pueda atender a sus clientes: responder sus mensajes,
            recomendarle vehículos de su inventario, agendar citas y pruebas de manejo, dar
            seguimiento a una venta y llevar el control de sus pagos.
          </p>
          <p>
            <strong>No se venden, rentan ni comparten con terceros para fines publicitarios.</strong>
          </p>
        </Seccion>

        <Seccion titulo="Mensajes de WhatsApp y Messenger">
          <p>
            Cuando una persona le escribe a una agencia por WhatsApp o por Messenger, Meta entrega
            ese mensaje al CRM y ahí queda guardado, junto con el nombre público y el identificador
            que Meta proporciona. Esto permite que el vendedor conteste desde el sistema y que la
            conversación no se pierda al cambiar de teléfono o de persona.
          </p>
          <p>
            El tratamiento que Meta hace de esos mensajes se rige por sus propias políticas. El CRM
            no publica nada en tu nombre, no lee otras conversaciones y no accede a tu lista de
            contactos.
          </p>
        </Seccion>

        <Seccion titulo="Con quién se comparten">
          <p>
            Solo con los proveedores necesarios para que el sistema funcione, y únicamente para eso:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Google (Firebase)</strong> — guarda la base de datos y administra el acceso de los usuarios.</li>
            <li><strong>Meta</strong> — entrega y envía los mensajes de WhatsApp y Messenger.</li>
            <li><strong>Hostinger</strong> — aloja el sistema.</li>
            <li><strong>Resend</strong> — envía los correos que manda el CRM.</li>
            <li><strong>Stripe</strong> — cobra la suscripción a las agencias. No recibe datos de los clientes de las agencias.</li>
            <li>
              <strong>Google Calendar</strong> — solo si el usuario conecta su cuenta a propósito, para
              que sus citas aparezcan en su agenda. Puede desconectarla cuando quiera desde
              Integraciones.
            </li>
          </ul>
          <p>
            También se compartirán datos cuando una autoridad competente lo requiera legalmente.
          </p>
        </Seccion>

        <Seccion titulo="Inventario compartido entre agencias">
          <p>
            Una agencia puede activar la opción de compartir su inventario con otras agencias de la
            red. Cuando lo hace, <strong>solo se comparten datos de los vehículos</strong> —marca,
            modelo, año, precio, fotos y características—, nunca datos de sus clientes ni sus costos
            internos.
          </p>
        </Seccion>

        <Seccion titulo="Tus derechos">
          <p>
            Puedes pedir acceder a tus datos, corregirlos si están mal, cancelarlos u oponerte a que
            se usen. También puedes revocar tu consentimiento en cualquier momento.
          </p>
          <p>
            Escribe a{' '}
            <a href={`mailto:${CONTACTO}`} className="text-blue-600 dark:text-blue-400 font-semibold underline">
              {CONTACTO}
            </a>{' '}
            indicando qué quieres hacer y cómo podemos identificarte. Se responde en un plazo máximo
            de 20 días hábiles.
          </p>
          <p>
            Si tus datos los registró una agencia en particular, se le dará aviso para que también
            atienda tu solicitud.
          </p>
        </Seccion>

        <Seccion titulo="Cuánto tiempo se conservan">
          <p>
            Mientras la agencia mantenga activa su cuenta y los necesite para atenderte, o hasta que
            pidas su eliminación. Los datos de operaciones cerradas se conservan el tiempo que exijan
            las obligaciones fiscales aplicables.
          </p>
        </Seccion>

        <Seccion titulo="Seguridad">
          <p>
            El acceso al sistema requiere usuario y contraseña. Cada agencia solo puede ver su propia
            información, y dentro de cada agencia el acceso depende del rol de cada persona. La
            información viaja cifrada y las credenciales de los servicios conectados se guardan
            separadas del resto de los datos.
          </p>
          <p>
            Ningún sistema es infalible. Si llegara a ocurrir una vulneración que afecte de forma
            significativa tus datos, se te informará.
          </p>
        </Seccion>

        <Seccion titulo="Cambios a este aviso">
          <p>
            Si cambia la forma en que se tratan los datos, este aviso se actualiza en esta misma
            dirección y cambia la fecha del encabezado.
          </p>
        </Seccion>

        <p className="text-xs text-slate-400 border-t border-gray-200 dark:border-slate-700 pt-6">
          Luis Felipe Jaramillo Urrea · Nextcar · Erewere · {CONTACTO}
        </p>
      </div>
    </div>
  );
}
