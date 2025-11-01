import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostTransactionQueue } from './post-transaction-queue';
import type { Logger } from '../core/context';

describe('PostTransactionQueue', () => {
  let mockLogger: Logger;
  let queue: PostTransactionQueue;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };
    queue = new PostTransactionQueue(mockLogger);
  });

  describe('Constructor', () => {
    it('creates an empty queue', () => {
      expect(queue.size).toBe(0);
    });
  });

  describe('enqueue()', () => {
    it('adds a single task to the queue', () => {
      queue.enqueue(() => {});
      expect(queue.size).toBe(1);
    });

    it('adds multiple tasks to the queue', () => {
      queue.enqueue(() => {});
      queue.enqueue(() => {});
      queue.enqueue(() => {});
      expect(queue.size).toBe(3);
    });

    it('maintains task order', () => {
      const results: number[] = [];
      queue.enqueue(() => results.push(1));
      queue.enqueue(() => results.push(2));
      queue.enqueue(() => results.push(3));

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(results).toEqual([1, 2, 3]);
    });
  });

  describe('flush()', () => {
    it('executes all queued tasks', () => {
      const task1 = vi.fn();
      const task2 = vi.fn();
      const task3 = vi.fn();

      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(task1).toHaveBeenCalledOnce();
      expect(task2).toHaveBeenCalledOnce();
      expect(task3).toHaveBeenCalledOnce();
    });

    it('clears the queue after flushing', () => {
      queue.enqueue(() => {});
      queue.enqueue(() => {});

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(queue.size).toBe(0);
    });

    it('does nothing when queue is empty', () => {
      const withLock = vi.fn((fn: () => void) => fn());
      queue.flush(withLock);

      expect(withLock).not.toHaveBeenCalled();
    });

    it('executes tasks within the provided lock', () => {
      const task = vi.fn();
      const withLock = vi.fn((fn: () => void) => fn());

      queue.enqueue(task);
      queue.flush(withLock);

      expect(withLock).toHaveBeenCalledWith(task);
      expect(task).toHaveBeenCalledOnce();
    });

    it('logs flush operation when tasks exist', () => {
      queue.enqueue(() => {});
      queue.enqueue(() => {});

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[PostTransactionQueue] Flushing 2 post-transaction callbacks'
      );
    });

    it('does not log when queue is empty', () => {
      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('continues executing remaining tasks if one fails', () => {
      const task1 = vi.fn();
      const task2 = vi.fn(() => {
        throw new Error('Task 2 failed');
      });
      const task3 = vi.fn();

      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);

      const withLock = (fn: () => void) => fn();
      
      // Should not throw
      expect(() => queue.flush(withLock)).not.toThrow();

      // All tasks should have been attempted
      expect(task1).toHaveBeenCalledOnce();
      expect(task2).toHaveBeenCalledOnce();
      expect(task3).toHaveBeenCalledOnce();
    });

    it('logs errors from failed tasks', () => {
      const error = new Error('Test error');
      queue.enqueue(() => {
        throw error;
      });

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      // Check that the error log was called (2nd call, after the flush log)
      expect(mockLogger.debug).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenNthCalledWith(
        2,
        '[PostTransactionQueue] Task failed (continuing with remaining tasks):',
        error
      );
    });

    it('handles errors from lock function itself', () => {
      queue.enqueue(() => {});

      const withLock = vi.fn(() => {
        throw new Error('Lock error');
      });

      expect(() => queue.flush(withLock)).not.toThrow();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('failed'),
        expect.any(Error)
      );
    });

    it('clears queue even if all tasks fail', () => {
      queue.enqueue(() => {
        throw new Error('Fail 1');
      });
      queue.enqueue(() => {
        throw new Error('Fail 2');
      });

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(queue.size).toBe(0);
    });

    it('handles multiple failures independently', () => {
      const task1 = vi.fn(() => {
        throw new Error('Error 1');
      });
      const task2 = vi.fn(() => {
        throw new Error('Error 2');
      });
      const task3 = vi.fn(() => {
        throw new Error('Error 3');
      });

      queue.enqueue(task1);
      queue.enqueue(task2);
      queue.enqueue(task3);

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      // All tasks attempted
      expect(task1).toHaveBeenCalledOnce();
      expect(task2).toHaveBeenCalledOnce();
      expect(task3).toHaveBeenCalledOnce();

      // Multiple error logs
      expect(mockLogger.debug).toHaveBeenCalledTimes(4); // 1 flush log + 3 error logs
    });
  });

  describe('size property', () => {
    it('returns 0 for empty queue', () => {
      expect(queue.size).toBe(0);
    });

    it('returns correct size after enqueueing', () => {
      queue.enqueue(() => {});
      expect(queue.size).toBe(1);

      queue.enqueue(() => {});
      expect(queue.size).toBe(2);

      queue.enqueue(() => {});
      expect(queue.size).toBe(3);
    });

    it('returns 0 after flushing', () => {
      queue.enqueue(() => {});
      queue.enqueue(() => {});

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(queue.size).toBe(0);
    });

    it('updates correctly after partial flush and re-enqueue', () => {
      queue.enqueue(() => {});
      expect(queue.size).toBe(1);

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);
      expect(queue.size).toBe(0);

      queue.enqueue(() => {});
      queue.enqueue(() => {});
      expect(queue.size).toBe(2);
    });
  });

  describe('clear()', () => {
    it('clears all tasks from queue', () => {
      queue.enqueue(() => {});
      queue.enqueue(() => {});
      queue.enqueue(() => {});

      queue.clear();

      expect(queue.size).toBe(0);
    });

    it('prevents cleared tasks from executing on flush', () => {
      const task = vi.fn();
      queue.enqueue(task);
      queue.clear();

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(task).not.toHaveBeenCalled();
    });

    it('does nothing when queue is already empty', () => {
      queue.clear();
      expect(queue.size).toBe(0);

      // Should not throw
      queue.clear();
      expect(queue.size).toBe(0);
    });

    it('allows enqueuing after clear', () => {
      queue.enqueue(() => {});
      queue.clear();
      expect(queue.size).toBe(0);

      queue.enqueue(() => {});
      expect(queue.size).toBe(1);
    });
  });

  describe('Multiple flush cycles', () => {
    it('can enqueue and flush multiple times', () => {
      const results: string[] = [];
      const withLock = (fn: () => void) => fn();

      // First cycle
      queue.enqueue(() => results.push('a'));
      queue.flush(withLock);
      expect(results).toEqual(['a']);

      // Second cycle
      queue.enqueue(() => results.push('b'));
      queue.flush(withLock);
      expect(results).toEqual(['a', 'b']);

      // Third cycle
      queue.enqueue(() => results.push('c'));
      queue.enqueue(() => results.push('d'));
      queue.flush(withLock);
      expect(results).toEqual(['a', 'b', 'c', 'd']);
    });

    it('tasks can enqueue new tasks (handled in next flush)', () => {
      const results: number[] = [];
      const withLock = (fn: () => void) => fn();

      queue.enqueue(() => {
        results.push(1);
        // Enqueue during execution
        queue.enqueue(() => results.push(3));
      });
      queue.enqueue(() => results.push(2));

      queue.flush(withLock);

      // First flush: 1, 2 (task 3 not executed yet)
      expect(results).toEqual([1, 2]);
      expect(queue.size).toBe(1);

      // Second flush: 3
      queue.flush(withLock);
      expect(results).toEqual([1, 2, 3]);
    });

    it('handles interleaved enqueue and flush', () => {
      const task1 = vi.fn();
      const task2 = vi.fn();
      const task3 = vi.fn();
      const withLock = (fn: () => void) => fn();

      queue.enqueue(task1);
      queue.flush(withLock);
      expect(task1).toHaveBeenCalledOnce();

      queue.enqueue(task2);
      queue.enqueue(task3);
      queue.flush(withLock);
      expect(task2).toHaveBeenCalledOnce();
      expect(task3).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it('handles tasks that modify external state', () => {
      let counter = 0;
      queue.enqueue(() => (counter += 1));
      queue.enqueue(() => (counter *= 2));
      queue.enqueue(() => (counter += 10));

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(counter).toBe(12); // (0 + 1) * 2 + 10
    });

    it('handles async operations (but does not wait)', () => {
      const results: string[] = [];
      const withLock = (fn: () => void) => fn();

      queue.enqueue(() => {
        results.push('sync');
        Promise.resolve().then(() => results.push('async'));
      });

      queue.flush(withLock);

      // Flush is synchronous, so only 'sync' is immediately available
      expect(results).toEqual(['sync']);
    });

    it('handles empty function callbacks', () => {
      queue.enqueue(() => {});
      queue.enqueue(() => {});

      const withLock = (fn: () => void) => fn();
      expect(() => queue.flush(withLock)).not.toThrow();
    });

    it('handles very large queues', () => {
      const count = 10000;
      let executed = 0;

      for (let i = 0; i < count; i++) {
        queue.enqueue(() => executed++);
      }

      expect(queue.size).toBe(count);

      const withLock = (fn: () => void) => fn();
      queue.flush(withLock);

      expect(executed).toBe(count);
      expect(queue.size).toBe(0);
    });
  });
});

