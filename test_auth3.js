import { browserLocalPersistence, browserSessionPersistence, inMemoryPersistence } from 'firebase/auth';
console.log(browserLocalPersistence.type, browserSessionPersistence.type, inMemoryPersistence.type);
