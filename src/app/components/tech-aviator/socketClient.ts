import type { SocketLike } from "./types";

const SERVER_URL = import.meta.env.VITE_TECH_AVIATOR_SOCKET_URL || "http://localhost:4100";

/**
 * Runtime Socket.IO connector. It first tries the official CDN ESM client and
 * then falls back to a tiny Socket.IO v4 WebSocket transport for this game's
 * event/ack pattern. This keeps the frontend buildable in restricted CI while
 * preserving the requested socket.io protocol against the Node backend.
 */
export async function connectTechAviatorSocket(userId: string, userName: string): Promise<SocketLike> {
  try {
    const socketIoClientUrl = "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";
    const module = await import(/* @vite-ignore */ socketIoClientUrl);
    return module.io(SERVER_URL, {
      transports: ["websocket"],
      auth: { userId, userName },
    }) as SocketLike;
  } catch {
    return createSocketIoWebSocketFallback(userId, userName);
  }
}

function createSocketIoWebSocketFallback(userId: string, userName: string): Promise<SocketLike> {
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const pendingAcks = new Map<number, (response: any) => void>();
  const queuedPackets: string[] = [];
  let nextAckId = 1;
  let namespaceConnected = false;
  const wsBase = SERVER_URL.replace(/^http/, "ws").replace(/\/$/, "");
  const socket = new WebSocket(`${wsBase}/socket.io/?EIO=4&transport=websocket`);

  const api: SocketLike = {
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)?.add(handler);
    },
    off(event, handler) {
      if (!handler) listeners.delete(event);
      else listeners.get(event)?.delete(handler);
    },
    emit(event, payload, ack) {
      const ackId = ack ? nextAckId++ : undefined;
      if (ack && ackId) pendingAcks.set(ackId, ack);
      sendSocketIoPacket(`42${ackId ?? ""}${JSON.stringify([event, payload])}`);
    },
    disconnect() {
      socket.close();
    },
  };

  function sendSocketIoPacket(packet: string) {
    if (namespaceConnected && socket.readyState === WebSocket.OPEN) socket.send(packet);
    else queuedPackets.push(packet);
  }

  function flushQueue() {
    while (queuedPackets.length && socket.readyState === WebSocket.OPEN) {
      socket.send(queuedPackets.shift() as string);
    }
  }

  function dispatch(event: string, ...args: any[]) {
    listeners.get(event)?.forEach((handler) => handler(...args));
  }

  return new Promise((resolve, reject) => {
    const rejectTimer = window.setTimeout(() => reject(new Error("SOCKET_IO_FALLBACK_TIMEOUT")), 3500);

    socket.addEventListener("open", () => {
      // Wait for Engine.IO open packet before sending the Socket.IO namespace connect.
    });

    socket.addEventListener("message", (event) => {
      const packet = String(event.data);

      if (packet.startsWith("0")) {
        socket.send(`40${JSON.stringify({ userId, userName })}`);
        return;
      }

      if (packet === "2") {
        socket.send("3");
        return;
      }

      if (packet.startsWith("40")) {
        namespaceConnected = true;
        window.clearTimeout(rejectTimer);
        flushQueue();
        resolve(api);
        return;
      }

      if (packet.startsWith("42")) {
        const jsonStart = packet.indexOf("[");
        if (jsonStart === -1) return;
        const [eventName, ...args] = JSON.parse(packet.slice(jsonStart));
        dispatch(eventName, ...args);
        return;
      }

      if (packet.startsWith("43")) {
        const jsonStart = packet.indexOf("[");
        const ackId = Number(packet.slice(2, jsonStart));
        const ack = pendingAcks.get(ackId);
        if (ack) {
          ack(JSON.parse(packet.slice(jsonStart))[0]);
          pendingAcks.delete(ackId);
        }
      }
    });

    socket.addEventListener("error", () => {
      window.clearTimeout(rejectTimer);
      reject(new Error("SOCKET_IO_FALLBACK_ERROR"));
    });
  });
}
