import type { SocketLike } from "./types";

const SERVER_URL = import.meta.env.VITE_TECH_AVIATOR_SOCKET_URL || "http://localhost:4100";
const SOCKET_IO_CLIENT_URL = "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

/**
 * Runtime Socket.IO connector for the Tech Aviator backend. The socket is
 * returned immediately after the client module loads so React can register
 * listeners before the server emits the first gameplay packets.
 */
export async function connectTechAviatorSocket(userId: string, userName: string): Promise<SocketLike> {
  const module = await import(/* @vite-ignore */ SOCKET_IO_CLIENT_URL);

  return module.io(SERVER_URL, {
    transports: ["websocket"],
    auth: { userId, userName },
    reconnectionAttempts: 3,
    timeout: 2500,
  }) as SocketLike;
}
