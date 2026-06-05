import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface Task {
  id: string;
  type: 'invoice' | 'credit_invoice' | 'movement' | 'return';
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress: number;
  message: string;
  data?: any;
  error?: string;
}

interface TaskQueueContextType {
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status' | 'progress'>) => string;
  updateTask: (id: string, updates: Partial<Task>) => void;
  removeTask: (id: string) => void;
  processingCount: number;
}

const TaskQueueContext = createContext<TaskQueueContextType | undefined>(undefined);

export function TaskQueueProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);

  const addTask = useCallback((task: Omit<Task, 'id' | 'status' | 'progress'>) => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = {
      ...task,
      id,
      status: 'pending',
      progress: 0,
    };
    setTasks(prev => [...prev, newTask]);
    return id;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(task =>
      task.id === id ? { ...task, ...updates } : task
    ));
  }, []);

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(task => task.id !== id));
  }, []);

  const processingCount = tasks.filter(t => t.status === 'processing' || t.status === 'pending').length;

  return (
    <TaskQueueContext.Provider value={{ tasks, addTask, updateTask, removeTask, processingCount }}>
      {children}
    </TaskQueueContext.Provider>
  );
}

export function useTaskQueue() {
  const context = useContext(TaskQueueContext);
  if (!context) {
    throw new Error('useTaskQueue must be used within TaskQueueProvider');
  }
  return context;
}
