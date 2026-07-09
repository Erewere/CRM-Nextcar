const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, where } = require('firebase/firestore');
// Just use a simpler way: dump the firebase-applet-config.json to know the project id
// Or use grep in the web console? I can't.
