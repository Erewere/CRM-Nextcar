import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Client, Deal, Task } from '../types';
import { Users, Search, Plus, MapPin, Mail, Phone, Building2, X, List, Grid, Settings, Trash2, Download, User as UserIcon } from 'lucide-react';
import { ClientDetailModal } from '../components/ClientDetailModal';
import clsx from 'clsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function Persons() {
  const { userData, googleToken, connectGoogleServices } = useAuth();
  const [persons, setPersons] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<Client | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [importingContacts, setImportingContacts] = useState(false);

  // New person form state
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [phones, setPhones] = useState([{ value: '', type: 'Trabajo' }]);
  const [emails, setEmails] = useState([{ value: '', type: 'Trabajo' }]);
  const [labels, setLabels] = useState('');
  const [agencyUsers, setAgencyUsers] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!userData || userData.role === 'master') return;

    const fetchData = async () => {
      let q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId));
      let dq = query(collection(db, 'deals'), where('agencyId', '==', userData.agencyId));
      let tq = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId));
      const uq = query(collection(db, 'users'), where('agencyId', '==', userData.agencyId));

      if (userData.role === 'seller') {
        q = query(collection(db, 'clients'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
        dq = query(collection(db, 'deals'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
        tq = query(collection(db, 'tasks'), where('agencyId', '==', userData.agencyId), where('sellerId', '==', userData.id));
      }
      try {
        const [snap, dSnap, tSnap, uSnap] = await Promise.all([
          getDocs(q),
          getDocs(dq).catch(() => ({ docs: [] }) as any),
          getDocs(tq).catch(() => ({ docs: [] }) as any),
          getDocs(uq).catch(() => ({ docs: [] }) as any)
        ]);
        
        const usersMap: Record<string, string> = {};
        uSnap.docs.forEach((d: any) => {
          usersMap[d.id] = d.data().name;
        });
        setAgencyUsers(usersMap);

        const allClients = snap.docs.map(d => ({ id: d.id, ...d.data() } as Client));
        const uniqueClients: Client[] = [];
        const seenNames = new Set<string>();
        for (const c of allClients) {
          const nm = c.name?.trim().toLowerCase();
          if (nm && !seenNames.has(nm)) {
            seenNames.add(nm);
            uniqueClients.push(c);
          } else if (!nm) {
            uniqueClients.push(c);
          }
        }
        setPersons(uniqueClients);
        
        setDeals(dSnap?.docs ? dSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Deal)) : []);
        setTasks(tSnap?.docs ? tSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Task)) : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [userData]);

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !name) return;
    
    try {
      const primaryPhone = phones.map(p => p.value).filter(Boolean).join(', ');
      const primaryEmail = emails.map(e => e.value).filter(Boolean).join(', ');

      const newRef = doc(collection(db, 'clients'));
      const newPerson: Client = {
        id: newRef.id,
        agencyId: userData.agencyId || '',
        sellerId: userData.id || '',
        name,
        email: primaryEmail,
        phone: primaryPhone,
        organization,
        address: '',
        vehicle: '',
        status: '',
        origin: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(newRef, newPerson);
      setPersons(prev => [newPerson, ...prev]);
      setShowAddPerson(false);
      setName('');
      setPhones([{ value: '', type: 'Trabajo' }]);
      setEmails([{ value: '', type: 'Trabajo' }]);
      setOrganization('');
      setLabels('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleImportGoogleContacts = async () => {
    try {
      let token = googleToken;
      if (!token) {
        token = await connectGoogleServices();
      }
      if (!token) return;

      setImportingContacts(true);
      const res = await fetch('https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,phoneNumbers,organizations&pageSize=1000', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      
      if (data.connections) {
        let importedCount = 0;
        let newPersons: Client[] = [];
        for (const person of data.connections) {
          const personName = person.names?.[0]?.displayName || '';
          const personEmail = person.emailAddresses?.[0]?.value || '';
          const personPhone = person.phoneNumbers?.[0]?.value || '';
          const personOrganization = person.organizations?.[0]?.name || '';

          if (personName && (personEmail || personPhone)) {
            // Check if already exists in persons list
            const exists = [...persons, ...newPersons].find(p => 
              (personEmail && p.email?.includes(personEmail)) || 
              (personPhone && p.phone?.includes(personPhone)) ||
              (p.name.toLowerCase() === personName.toLowerCase())
            );
            
            if (!exists) {
              const newRef = doc(collection(db, 'clients'));
              const newPerson: Client = {
                id: newRef.id,
                agencyId: userData?.agencyId || '',
                sellerId: userData?.id || '',
                name: personName,
                email: personEmail,
                phone: personPhone,
                organization: personOrganization,
                address: '',
                vehicle: '',
                status: '',
                origin: 'google_contacts',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              await setDoc(newRef, newPerson);
              newPersons.push(newPerson);
              importedCount++;
            }
          }
        }
        
        if (newPersons.length > 0) {
          setPersons(prev => [...newPersons, ...prev]);
        }
        alert(`Se importaron ${importedCount} contactos nuevos desde Google.`);
      } else {
        alert('No se encontraron contactos para importar.');
      }
    } catch (e) {
      console.error('Error al importar contactos:', e);
      alert('Hubo un error al importar los contactos. Verifica los permisos.');
    } finally {
      setImportingContacts(false);
      setShowAddPerson(false);
    }
  };

  const filteredPersons = persons.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.organization && p.organization.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getPersonStats = (personId: string) => {
    const personDeals = deals.filter(d => d.clientId === personId);
    let openDeals = personDeals.filter(d => d.status === 'open' || !['won','lost'].includes(d.status)).length;
    let closedDeals = personDeals.filter(d => ['won','lost'].includes(d.status)).length;
    
    if (personDeals.length === 0) {
      const person = persons.find(p => p.id === personId);
      if (person && person.status) {
        const pStatus = person.status.toLowerCase();
        const isClosed = pStatus === 'won' || pStatus.includes('ganado') || pStatus === 'lost' || pStatus.includes('perdido');
        if (isClosed) closedDeals = 1;
        else openDeals = 1;
      }
    }

    const personTasks = tasks.filter(t => t.clientId === personId && !t.completed);
    personTasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    const nextTaskDate = personTasks.length > 0 ? personTasks[0].dueDate : null;

    return {
      openDeals,
      closedDeals,
      nextTaskDate: nextTaskDate ? format(new Date(nextTaskDate), "d 'de' MMMM 'de' yyyy", { locale: es }) : ''
    };
  };

  if (loading) return <div className="flex justify-center items-center h-full">Cargando...</div>;

  return (
    <div className="flex flex-col h-full bg-[#f4f5f5]">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 bg-white border-b border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-800">Personas</h1>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button 
                onClick={() => setViewMode('list')} 
                className={clsx("p-1.5 rounded transition-colors", viewMode === 'list' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
              >
                <List className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setViewMode('grid')} 
                className={clsx("p-1.5 rounded transition-colors", viewMode === 'grid' ? "bg-white shadow-sm text-blue-600" : "text-gray-500 hover:text-gray-700")}
              >
                <Grid className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button 
              onClick={handleImportGoogleContacts}
              disabled={importingContacts}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-white border border-gray-300 text-gray-700 rounded font-semibold hover:bg-gray-50 shadow-sm text-xs md:text-sm"
            >
              <Download className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">{importingContacts ? 'Importando...' : 'Importar de Google'}</span><span className="sm:hidden">Importar</span>
            </button>
            <button 
              onClick={() => setShowAddPerson(true)}
              className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700 shadow-sm text-xs md:text-sm"
            >
              <Plus className="w-4 h-4 shrink-0" /> Persona
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 relative max-w-md">
          <Search className="w-5 h-5 text-gray-400 absolute left-3" />
          <input 
            type="text" 
            placeholder="Buscar en Pipedrive..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full border border-gray-300 rounded-full py-1.5 pl-10 pr-3 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-gray-50 hover:bg-gray-100"
          />
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="p-6 flex-1 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredPersons.map(person => (
              <div 
                key={person.id} 
                className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedPerson(person)}
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xl flex-shrink-0">
                    {person.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="overflow-hidden">
                    <h3 className="font-bold text-gray-900 truncate" title={person.name}>{person.name}</h3>
                    {person.organization && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.organization}</span>
                      </div>
                    )}
                    {person.email && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.email}</span>
                      </div>
                    )}
                    {person.phone && (
                      <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                        <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{person.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto bg-white border-t border-gray-200">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#fcfdfd] border-b border-gray-200 text-gray-600 font-medium sticky top-0 z-10 shadow-sm">
              <tr>
                <th className="px-4 py-3 w-10 border-r border-gray-200"><input type="checkbox" className="rounded border-gray-300" /></th>
                <th className="px-4 py-3 border-r border-gray-200">Nombre</th>
                <th className="px-4 py-3 border-r border-gray-200">Organización</th>
                <th className="px-4 py-3 border-r border-gray-200">Correo electrónico</th>
                <th className="px-4 py-3 border-r border-gray-200">Teléfono</th>
                <th className="px-4 py-3 border-r border-gray-200 text-right">Tratos cerrados</th>
                <th className="px-4 py-3 border-r border-gray-200 text-right">Tratos abiertos</th>
                <th className="px-4 py-3 border-r border-gray-200">Fecha de la próxima actividad</th>
                <th className="px-4 py-3 border-r border-gray-200">Propietario</th>
                <th className="px-4 py-3 w-10"><Settings className="w-4 h-4 text-gray-400" /></th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredPersons.map(person => {
                const stats = getPersonStats(person.id);
                return (
                  <tr key={person.id} className="border-b border-gray-100 hover:bg-gray-50 group cursor-pointer" onClick={() => setSelectedPerson(person)}>
                    <td className="px-4 py-2 border-r border-gray-100" onClick={e => e.stopPropagation()}><input type="checkbox" className="rounded border-gray-300" /></td>
                    <td className="px-4 py-2 border-r border-gray-100 text-blue-600 font-medium">{person.name}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600">{person.organization}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600">{person.email}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600">{person.phone}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600 text-right">{stats.closedDeals}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600 text-right">{stats.openDeals}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600">{stats.nextTaskDate}</td>
                    <td className="px-4 py-2 border-r border-gray-100 text-gray-600">{agencyUsers[person.sellerId] || agencyUsers[person.agencyId] || 'Sin asignar'}</td>
                    <td className="px-4 py-2 text-center text-gray-400 group-hover:text-gray-600">...</td>
                  </tr>
                );
              })}
              {filteredPersons.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 font-medium border-b border-gray-100">
                    No se encontraron personas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddPerson && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddPerson} className="bg-white rounded shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-800">Añadir persona</h2>
              <button type="button" onClick={() => setShowAddPerson(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-2 flex flex-col gap-4 text-sm">
              <div>
                <label className="block text-gray-700 mb-1">Nombre</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border border-gray-300 rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Organización</label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                  <input type="text" value={organization} onChange={e => setOrganization(e.target.value)} className="w-full border border-gray-300 rounded p-2 pl-9 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-gray-700 mb-1">Teléfono</label>
                {phones.map((p, idx) => {
                  const existingMatch = persons.find(client => client.phone && p.value.length > 5 && client.phone.includes(p.value));
                  return (
                  <div key={`phone-${idx}`} className="mb-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="tel" 
                        value={p.value} 
                        list="modal-phones-list"
                        onChange={e => {
                          const newP = [...phones];
                          newP[idx].value = e.target.value;
                          setPhones(newP);
                        }} 
                        className="flex-1 border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" 
                      />
                      <select 
                        value={p.type} 
                        onChange={e => {
                          const newP = [...phones];
                          newP[idx].type = e.target.value;
                          setPhones(newP);
                        }} 
                        className="w-28 border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option>Trabajo</option>
                        <option>Móvil</option>
                        <option>Casa</option>
                        <option>Otro</option>
                      </select>
                      <button type="button" onClick={() => setPhones(phones.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {existingMatch && (
                      <p className="text-[11px] text-orange-600 font-medium mt-1">Este teléfono podría estar ligado a: {existingMatch.name}</p>
                    )}
                  </div>
                )})}
                <datalist id="modal-phones-list">
                  {persons.filter(cl => cl.phone).map(cl => <option key={cl.id} value={cl.phone}>{cl.name}</option>)}
                </datalist>
                <button type="button" onClick={() => setPhones([...phones, { value: '', type: 'Móvil' }])} className="text-blue-600 font-bold hover:underline">
                  + Añade un número de teléfono
                </button>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Correo electrónico</label>
                {emails.map((m, idx) => {
                  const existingMatch = persons.find(client => client.email && m.value.length > 5 && client.email.includes(m.value));
                  return (
                  <div key={`email-${idx}`} className="mb-2">
                    <div className="flex items-center gap-2">
                      <input 
                        type="email" 
                        value={m.value} 
                        list="modal-emails-list"
                        onChange={e => {
                          const newE = [...emails];
                          newE[idx].value = e.target.value;
                          setEmails(newE);
                        }} 
                        className="flex-1 border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none" 
                      />
                      <select 
                        value={m.type} 
                        onChange={e => {
                          const newE = [...emails];
                          newE[idx].type = e.target.value;
                          setEmails(newE);
                        }} 
                        className="w-28 border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                      >
                        <option>Trabajo</option>
                        <option>Personal</option>
                        <option>Otro</option>
                      </select>
                      <button type="button" onClick={() => setEmails(emails.filter((_, i) => i !== idx))} className="text-gray-400 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {existingMatch && (
                      <p className="text-[11px] text-orange-600 font-medium mt-1">Este correo podría estar ligado a: {existingMatch.name}</p>
                    )}
                  </div>
                )})}
                <datalist id="modal-emails-list">
                  {persons.filter(cl => cl.email).map(cl => <option key={cl.id} value={cl.email}>{cl.name}</option>)}
                </datalist>
                <button type="button" onClick={() => setEmails([...emails, { value: '', type: 'Trabajo' }])} className="text-blue-600 font-bold hover:underline">
                  + Añade un correo electrónico
                </button>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Etiquetas</label>
                <select className="w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white text-gray-500 font-medium">
                  <option>Añadir etiquetas</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Propietario</label>
                <select className="w-full border border-gray-300 rounded p-2 focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                  <option>{userData?.name || 'Luis'} (Tú)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-700 mb-1">Visible para</label>
                <div className="relative">
                   <div className="absolute left-3 top-2.5 flex flex-wrap w-4 h-4 gap-[2px] items-center justify-center p-[2px]">
                     <div className="w-[5px] h-[5px] bg-gray-500 rounded-sm"></div>
                     <div className="w-[5px] h-[5px] bg-gray-500 rounded-sm"></div>
                     <div className="w-[5px] h-[5px] bg-gray-500 rounded-sm"></div>
                     <div className="w-[5px] h-[5px] bg-gray-500 rounded-sm"></div>
                   </div>
                   <select className="w-full border border-gray-300 rounded p-2 pl-9 focus:ring-1 focus:ring-blue-500 outline-none bg-white">
                     <option>Grupo de visibilidad del propiet...</option>
                   </select>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center bg-gray-50 mt-2">
              <button type="button" className="flex items-center gap-2 font-bold text-gray-600 hover:text-gray-800">
                <Download className="w-4 h-4" /> Importar
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowAddPerson(false)} className="px-5 py-1.5 font-bold text-gray-700 border border-gray-300 bg-white hover:bg-gray-50 rounded">Cancelar</button>
                <button type="submit" className="px-5 py-1.5 font-bold text-white bg-[#2E914F] hover:bg-[#257A41] rounded shadow-sm">Guardar</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {selectedPerson && (
        <ClientDetailModal client={selectedPerson} onClose={() => setSelectedPerson(null)} />
      )}
    </div>
  );
}
