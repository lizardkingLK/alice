/**
 * Per-entity serial flushes with coalesce for optimistic DnD / field bursts.
 * Same idea as comment reactions: UI updates immediately; network waits for the
 * previous HTTP settle, then sends only the net desired vs last ack.
 */

export type SerialCoalesceSendOptions = {
  readonly keepalive?: boolean;
};

export type SerialCoalesceFlushResult<TDesired> = {
  readonly ack: TDesired;
  readonly expectedUpdatedAt: string;
};

type SerialCoalesceLane<TDesired> = {
  desired: TDesired | undefined;
  ack: TDesired | undefined;
  expectedUpdatedAt: string | undefined;
  generation: number;
  pendingFlushes: number;
  chain: Promise<void>;
};

/* eslint-disable no-unused-vars -- documents queue callback contracts */
export type SerialCoalesceMutationQueueOptions<TDesired> = {
  areEqual: (a: TDesired, b: TDesired) => boolean;
  /** Seed ack from current local entity when the lane is empty. */
  getAckSeed: (id: string) => TDesired | undefined;
  /** Lock token for the next PATCH (usually entity.updated_at). */
  getExpectedUpdatedAt: (id: string) => string | undefined;
  applyOptimistic: (id: string, desired: TDesired) => void;
  /** Revert local UI to last ack after a failed flush. */
  reconcileToAck: (id: string, ack: TDesired) => void;
  send: (
    id: string,
    desired: TDesired,
    expectedUpdatedAt: string,
    options?: SerialCoalesceSendOptions
  ) => Promise<SerialCoalesceFlushResult<TDesired>>;
  onPendingChange?: (id: string, isPending: boolean) => void;
  onFlushError?: (id: string, error: unknown) => void;
};
/* eslint-enable no-unused-vars */

export function createSerialCoalesceMutationQueue<TDesired>(
  options: SerialCoalesceMutationQueueOptions<TDesired>
) {
  const lanes = new Map<string, SerialCoalesceLane<TDesired>>();

  function getLane(id: string): SerialCoalesceLane<TDesired> {
    let lane = lanes.get(id);
    if (!lane) {
      lane = {
        desired: undefined,
        ack: undefined,
        expectedUpdatedAt: undefined,
        generation: 0,
        pendingFlushes: 0,
        chain: Promise.resolve(),
      };
      lanes.set(id, lane);
    }
    return lane;
  }

  function notifyPending(id: string, lane: SerialCoalesceLane<TDesired>) {
    options.onPendingChange?.(id, lane.pendingFlushes > 0);
  }

  function isPending(id: string): boolean {
    return (lanes.get(id)?.pendingFlushes ?? 0) > 0;
  }

  function needsFlush(lane: SerialCoalesceLane<TDesired>): boolean {
    if (lane.desired === undefined || lane.ack === undefined) {
      return lane.desired !== undefined;
    }
    return !options.areEqual(lane.desired, lane.ack);
  }

  function hasAnyPending(): boolean {
    for (const lane of lanes.values()) {
      if (lane.pendingFlushes > 0 || needsFlush(lane)) {
        return true;
      }
    }
    return false;
  }

  function seedLane(id: string) {
    const lane = getLane(id);
    if (lane.ack !== undefined || lane.desired !== undefined) {
      return;
    }
    const seed = options.getAckSeed(id);
    if (seed === undefined) {
      return;
    }
    lane.ack = seed;
    lane.expectedUpdatedAt = options.getExpectedUpdatedAt(id);
  }

  async function flushDiffs(
    id: string,
    sendOptions?: SerialCoalesceSendOptions
  ): Promise<void> {
    const lane = getLane(id);
    while (needsFlush(lane)) {
      const desired = lane.desired;
      if (desired === undefined) {
        return;
      }
      const expectedUpdatedAt =
        lane.expectedUpdatedAt ?? options.getExpectedUpdatedAt(id);
      if (!expectedUpdatedAt) {
        throw new Error('Missing expectedUpdatedAt for mutation flush');
      }

      const result = await options.send(
        id,
        desired,
        expectedUpdatedAt,
        sendOptions
      );
      lane.ack = result.ack;
      lane.expectedUpdatedAt = result.expectedUpdatedAt;
      // If the user coalesced to a new desired mid-flight, loop; otherwise stop.
      if (
        lane.desired !== undefined &&
        options.areEqual(lane.desired, lane.ack)
      ) {
        return;
      }
    }
  }

  function scheduleFlush(id: string, sendOptions?: SerialCoalesceSendOptions) {
    const lane = getLane(id);
    lane.pendingFlushes += 1;
    notifyPending(id, lane);
    lane.chain = lane.chain
      .then(() => flushDiffs(id, sendOptions))
      .catch((error) => {
        options.onFlushError?.(id, error);
        if (lane.ack !== undefined) {
          lane.desired = lane.ack;
          options.reconcileToAck(id, lane.ack);
        }
      })
      .finally(() => {
        lane.pendingFlushes = Math.max(0, lane.pendingFlushes - 1);
        notifyPending(id, lane);
      });
  }

  function enqueue(id: string, desired: TDesired): void {
    seedLane(id);
    const lane = getLane(id);
    if (lane.ack === undefined) {
      const seed = options.getAckSeed(id);
      if (seed === undefined) {
        return;
      }
      lane.ack = seed;
      lane.expectedUpdatedAt = options.getExpectedUpdatedAt(id);
    }

    lane.generation += 1;
    lane.desired = desired;
    options.applyOptimistic(id, desired);

    if (lane.ack !== undefined && options.areEqual(desired, lane.ack)) {
      return;
    }
    scheduleFlush(id);
  }

  /**
   * Align lane ack with an authoritative server/conflict row (e.g. 409 rebase).
   * Clears the need to flush when desired already matches.
   */
  function acknowledge(id: string, ack: TDesired, expectedUpdatedAt: string) {
    const lane = getLane(id);
    lane.ack = ack;
    lane.desired = ack;
    lane.expectedUpdatedAt = expectedUpdatedAt;
    lane.generation += 1;
  }

  function flushPendingKeepalive(): void {
    for (const [id, lane] of lanes) {
      if (!needsFlush(lane)) {
        continue;
      }
      scheduleFlush(id, { keepalive: true });
    }
  }

  async function whenIdle(): Promise<void> {
    const chains = [...lanes.values()].map((lane) => lane.chain);
    await Promise.allSettled(chains);
  }

  return {
    enqueue,
    acknowledge,
    isPending,
    hasAnyPending,
    flushPendingKeepalive,
    whenIdle,
  };
}

export type SerialCoalesceMutationQueue<TDesired> = ReturnType<
  typeof createSerialCoalesceMutationQueue<TDesired>
>;
