const fs = require('fs');
let content = fs.readFileSync('src/pages/mobile/MobileClientDetail.tsx', 'utf8');

if (!content.includes('scrollToHistory?: boolean;')) {
  content = content.replace('onUpdated: () => void;\n}', 'onUpdated: () => void;\n  scrollToHistory?: boolean;\n}');
  
  content = content.replace('export function MobileClientDetail({ client, onClose, onUpdated }: Props)', 'export function MobileClientDetail({ client, onClose, onUpdated, scrollToHistory }: Props)');
  
  const refCode = `
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollToHistory && historyRef.current) {
      setTimeout(() => {
        historyRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, [scrollToHistory, client]);
`;

  content = content.replace('  const [notes, setNotes] = useState<any[]>([]);', '  const [notes, setNotes] = useState<any[]>([]);\n' + refCode);

  content = content.replace('{/* Historial (Notas) */}', '{/* Historial (Notas) */}\n        <div ref={historyRef} />');
  
  fs.writeFileSync('src/pages/mobile/MobileClientDetail.tsx', content);
  console.log("Updated MobileClientDetail");
}
