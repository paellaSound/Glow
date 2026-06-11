/** Scheduled lead time between orchestrator send and targetTimestamp. */
export const ORCHESTRATOR_SCHEDULE_MS = 100;

export function orchestratorSentAt(
  targetTimestamp: number,
  seedTimestamp?: number
): number {
  return seedTimestamp ?? targetTimestamp - ORCHESTRATOR_SCHEDULE_MS;
}

export function measureOrchestratorMessageDelay(
  targetTimestamp: number,
  seedTimestamp?: number
): number {
  return Math.max(0, Date.now() - orchestratorSentAt(targetTimestamp, seedTimestamp));
}

export function measureOneWayLatency(sentAt: number, receivedAt = Date.now()): number {
  return Math.max(0, Math.round((receivedAt - sentAt) / 2));
}
