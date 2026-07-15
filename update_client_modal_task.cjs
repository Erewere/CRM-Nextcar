const fs = require('fs');
let content = fs.readFileSync('src/components/ClientDetailModal.tsx', 'utf8');

const targetImport = `import { PaymentModal } from "./PaymentModal";`;
if (!content.includes(`import { NewActivityModal } from "./NewActivityModal";`)) {
  content = content.replace(targetImport, targetImport + `\nimport { NewActivityModal } from "./NewActivityModal";`);
}

const targetState = `const [showPaymentModal, setShowPaymentModal] = useState(false);`;
if (!content.includes(`const [showNewTaskModal, setShowNewTaskModal] = useState(false);`)) {
  content = content.replace(targetState, targetState + `\n  const [showNewTaskModal, setShowNewTaskModal] = useState(false);\n  const [newTaskPrefill, setNewTaskPrefill] = useState<any>(null);`);
}

const targetToggle = `  const toggleTaskCompletion = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id as string), {
        completed: !task.completed,
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.id === task.id ? { ...t, completed: !task.completed } : t,
        ),
      );
    } catch (err) {
      console.error(err);
    }
  };`;
const replacementToggle = `  const toggleTaskCompletion = async (task: Task) => {
    try {
      await updateDoc(doc(db, "tasks", task.id as string), {
        completed: !task.completed,
      });
      
      const updatedTasks = tasks.map((t) =>
        t.id === task.id ? { ...t, completed: !task.completed } : t,
      );
      setTasks(updatedTasks);
      
      // If marked as complete, check if there are any pending tasks for this client/deal
      if (!task.completed) {
        const hasPending = updatedTasks.some(t => !t.completed && t.id !== task.id);
        if (!hasPending) {
           setNewTaskPrefill({
              clientId: client.id || "",
              clientName: formData.name || "",
              dealId: formData.originalClientId ? client.id : "",
              dealTitle: formData.dealTitle || ""
           });
           setShowNewTaskModal(true);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };`;

content = content.replace(targetToggle, replacementToggle);

// Add the modal at the end before final div
const modalMarkup = `      {/* New Activity Modal */}
      {showNewTaskModal && (
        <NewActivityModal
          onClose={() => {
            setShowNewTaskModal(false);
            setNewTaskPrefill(null);
          }}
          clients={[{ id: client.id, ...formData } as any]}
          deals={deals}
          currentUser={userData}
          initialData={newTaskPrefill}
          onSave={async (taskData) => {
            if (!taskData.title || !taskData.dueDate || !userData) {
              if (!taskData.title) alert("El título es requerido");
              return;
            }
            try {
              const { doc, collection, setDoc } = await import("firebase/firestore");
              const newRef = doc(collection(db, "tasks"));
              const tempTask = {
                agencyId: userData.agencyId || "",
                sellerId: userData.id || "",
                clientId: taskData.clientId || client.id || "",
                dealId: taskData.dealId || "",
                title: taskData.title,
                type: taskData.type || "call",
                notes: taskData.notes || "",
                dueDate: taskData.dueDate,
                startTime: taskData.startTime,
                endTime: taskData.endTime,
                completed: taskData.completed || false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              
              // Remove undefined fields
              Object.keys(tempTask).forEach(
                (k) =>
                  tempTask[k as keyof typeof tempTask] === undefined &&
                  delete tempTask[k as keyof typeof tempTask],
              );
              
              await setDoc(newRef, tempTask);
              
              // Optimistically update tasks array
              setTasks(prev => [{ id: newRef.id, ...tempTask } as Task, ...prev]);
              
              setShowNewTaskModal(false);
              setNewTaskPrefill(null);
            } catch (err) {
              console.error("Error creating task:", err);
            }
          }}
        />
      )}`;

// We can put it right before the last closing div of ClientDetailModal
const lastDivIndex = content.lastIndexOf('</div>\n    </div>\n  );\n}');
if (lastDivIndex !== -1 && !content.includes('<NewActivityModal')) {
  content = content.slice(0, lastDivIndex) + modalMarkup + '\n' + content.slice(lastDivIndex);
}

fs.writeFileSync('src/components/ClientDetailModal.tsx', content);
console.log('Updated ClientDetailModal');
