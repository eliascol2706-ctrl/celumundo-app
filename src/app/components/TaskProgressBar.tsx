import { useEffect } from 'react';
import { useTaskQueue } from '../contexts/TaskQueueContext';
import { CheckCircle, Loader2, AlertCircle, X } from 'lucide-react';
import { Card } from './ui/card';

export function TaskProgressBar() {
  const { tasks, removeTask } = useTaskQueue();

  // Auto-remover tareas completadas después de 5 segundos
  useEffect(() => {
    const completedTasks = tasks.filter(t => t.status === 'completed');
    const timeouts: NodeJS.Timeout[] = [];

    completedTasks.forEach(task => {
      const timeout = setTimeout(() => {
        removeTask(task.id);
      }, 5000);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [tasks, removeTask]);

  // Auto-remover tareas con error después de 8 segundos
  useEffect(() => {
    const errorTasks = tasks.filter(t => t.status === 'error');
    const timeouts: NodeJS.Timeout[] = [];

    errorTasks.forEach(task => {
      const timeout = setTimeout(() => {
        removeTask(task.id);
      }, 8000);
      timeouts.push(timeout);
    });

    return () => {
      timeouts.forEach(timeout => clearTimeout(timeout));
    };
  }, [tasks, removeTask]);

  if (tasks.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {tasks.map(task => (
        <Card key={task.id} className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {task.status === 'processing' && (
                <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
              )}
              {task.status === 'completed' && (
                <CheckCircle className="h-5 w-5 text-green-600" />
              )}
              {task.status === 'error' && (
                <AlertCircle className="h-5 w-5 text-red-600" />
              )}
              {task.status === 'pending' && (
                <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {task.message}
              </p>

              {task.status === 'error' && task.error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  {task.error}
                </p>
              )}

              {(task.status === 'processing' || task.status === 'pending') && (
                <div className="mt-2">
                  <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    {task.progress}%
                  </p>
                </div>
              )}
            </div>

            <button
              onClick={() => removeTask(task.id)}
              className="flex-shrink-0 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}
