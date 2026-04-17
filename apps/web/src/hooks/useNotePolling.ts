import { useState, useEffect, useRef, useCallback } from 'react';
import { aiNoteService } from '../services/aiNote';

interface UseNotePollingOptions {
  noteId: string | null;
  onStatusChange?: (status: string) => void;
  onComplete?: (note: any) => void;
  onError?: (error: string) => void;
  interval?: number;
}

export function useNotePolling({
  noteId,
  onStatusChange,
  onComplete,
  onError,
  interval = 3000,
}: UseNotePollingOptions) {
  const [status, setStatus] = useState<string>('idle');
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((id: string) => {
    clearPolling();
    
    intervalRef.current = setInterval(async () => {
      try {
        const response = await aiNoteService.getStatus(id);
        
        if (response.success) {
          setStatus(response.status);
          setProgress(response.progress || 0);
          setError(response.error || null);
          
          onStatusChange?.(response.status);
          
          if (response.status === 'completed') {
            clearPolling();
            const note = await aiNoteService.getNote(id);
            onComplete?.(note);
          } else if (response.status === 'failed') {
            clearPolling();
            onError?.(response.error || '分析失败');
          }
        }
      } catch (err) {
        console.error('轮询错误:', err);
      }
    }, interval);
  }, [clearPolling, interval, onStatusChange, onComplete, onError]);

  useEffect(() => {
    if (noteId) {
      startPolling(noteId);
    }
    
    return () => clearPolling();
  }, [noteId, startPolling, clearPolling]);

  return {
    status,
    progress,
    error,
    startPolling,
    clearPolling,
  };
}