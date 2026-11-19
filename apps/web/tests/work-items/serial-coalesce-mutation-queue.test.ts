import { describe, expect, it, vi } from 'vitest';
import { createSerialCoalesceMutationQueue } from '@/lib/work-items/serial-coalesce-mutation-queue';

describe('createSerialCoalesceMutationQueue', () => {
  it('coalesces rapid enqueues so only net desired is flushed', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const send = vi.fn(async (_id: string, desired: string) => {
      await gate;
      return {
        ack: desired,
        expectedUpdatedAt: '2026-10-02T00:00:00.000Z',
      };
    });

    const optimistic: string[] = [];
    const queue = createSerialCoalesceMutationQueue<string>({
      areEqual: (a, b) => a === b,
      getAckSeed: () => 'A',
      getExpectedUpdatedAt: () => '2026-10-01T00:00:00.000Z',
      applyOptimistic: (_id, desired) => {
        optimistic.push(desired);
      },
      reconcileToAck: vi.fn(),
      send,
    });

    queue.enqueue('item-1', 'B');
    queue.enqueue('item-1', 'C');
    expect(optimistic).toEqual(['B', 'C']);
    expect(queue.isPending('item-1')).toBe(true);

    release();
    await queue.whenIdle();

    // Intermediate B is skipped when C is already desired before the first
    // HTTP starts — or B then C if the first flush began with B.
    expect(send.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(send.mock.calls.length).toBeLessThanOrEqual(2);
    expect(send.mock.calls.at(-1)?.[1]).toBe('C');
    expect(queue.isPending('item-1')).toBe(false);
  });

  it('flushes a second desired after the first HTTP settles', async () => {
    // eslint-disable-next-line no-unused-vars
    let resolveFirst!: (value: {
      ack: string;
      expectedUpdatedAt: string;
    }) => void;
    const first = new Promise<{ ack: string; expectedUpdatedAt: string }>(
      (resolve) => {
        resolveFirst = resolve;
      }
    );
    const send = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce({
        ack: 'C',
        expectedUpdatedAt: '2026-10-02T00:00:00.000Z',
      });

    const queue = createSerialCoalesceMutationQueue<string>({
      areEqual: (a, b) => a === b,
      getAckSeed: () => 'A',
      getExpectedUpdatedAt: () => '2026-10-01T00:00:00.000Z',
      applyOptimistic: vi.fn(),
      reconcileToAck: vi.fn(),
      send,
    });

    queue.enqueue('item-1', 'B');
    await vi.waitFor(() => {
      expect(send).toHaveBeenCalledTimes(1);
    });
    expect(send.mock.calls[0]?.[1]).toBe('B');

    queue.enqueue('item-1', 'C');
    resolveFirst({
      ack: 'B',
      expectedUpdatedAt: '2026-10-01T12:00:00.000Z',
    });
    await queue.whenIdle();

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1]?.[1]).toBe('C');
  });

  it('reconciles to last ack when send fails', async () => {
    const reconcileToAck = vi.fn();
    const queue = createSerialCoalesceMutationQueue<string>({
      areEqual: (a, b) => a === b,
      getAckSeed: () => 'A',
      getExpectedUpdatedAt: () => '2026-10-01T00:00:00.000Z',
      applyOptimistic: vi.fn(),
      reconcileToAck,
      send: vi.fn().mockRejectedValue(new Error('boom')),
      onFlushError: vi.fn(),
    });

    queue.enqueue('item-1', 'B');
    await queue.whenIdle();

    expect(reconcileToAck).toHaveBeenCalledWith('item-1', 'A');
    expect(queue.hasAnyPending()).toBe(false);
  });

  it('skips flush when desired already matches ack', async () => {
    const send = vi.fn();
    const queue = createSerialCoalesceMutationQueue<string>({
      areEqual: (a, b) => a === b,
      getAckSeed: () => 'A',
      getExpectedUpdatedAt: () => '2026-10-01T00:00:00.000Z',
      applyOptimistic: vi.fn(),
      reconcileToAck: vi.fn(),
      send,
    });

    queue.enqueue('item-1', 'A');
    await queue.whenIdle();

    expect(send).not.toHaveBeenCalled();
  });
});
