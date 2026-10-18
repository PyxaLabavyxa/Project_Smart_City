export type ChatPresence = { client_id: string; sequence: number; active: boolean; last_message_id: number | null };

export function createChatPresence(clientId: string, publish: (value: ChatPresence) => void) {
  let sequence = 0;
  let lastSeen: number | null = null;
  let previousActive = false;
  let previousSeen: number | null = null;
  let closed = false;
  function send(active: boolean) {
    previousActive = active;
    previousSeen = lastSeen;
    publish({ client_id: clientId, sequence: ++sequence, active, last_message_id: lastSeen });
  }
  return {
    update(visible: boolean, canRenew: boolean, visibleMessage: number | null, heartbeat = false) {
      if (closed) return;
      if (visible && visibleMessage !== null) lastSeen = Math.max(lastSeen ?? 0, visibleMessage);
      const active = visible && canRenew;
      if (active !== previousActive || lastSeen !== previousSeen || (heartbeat && active)) send(active);
    },
    close() {
      if (closed) return;
      closed = true;
      if (previousActive) send(false);
    },
  };
}
