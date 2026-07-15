const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobilePersons.tsx', 'utf8');

const importReplacement = `import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { Client, PipelineStage } from '../../types';
import { Search, Phone, MessageCircle, User, Car, Calendar, FileText, ChevronRight, Activity, X } from 'lucide-react';
import { MobileClientDetail } from './MobileClientDetail';
import { NewActivityModal } from '../../components/NewActivityModal';`;

content = content.replace(/import React, \{ useState, useEffect \} from 'react';\nimport \{ useAuth \} from '\.\.\/\.\.\/contexts\/AuthContext';\nimport \{ db \} from '\.\.\/\.\.\/lib\/firebase';\nimport \{ collection, query, where, getDocs \} from 'firebase\/firestore';\nimport \{ Client \} from '\.\.\/\.\.\/types';\nimport \{ Search, Phone, MessageCircle, User, Car \} from 'lucide-react';\nimport \{ MobileClientDetail \} from '\.\/MobileClientDetail';/, importReplacement);

fs.writeFileSync('src/pages/mobile/MobilePersons.tsx', content);
console.log('Fixed imports in MobilePersons');
