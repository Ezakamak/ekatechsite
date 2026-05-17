import { useEffect, useRef } from "react";

export type LobbyGameKey = "tech_duel" | "cipher" | "core_clash";

const CLOSE_ENDPOINT = "/api/lobbies/close";

export async function closeOpenLobby(game: LobbyGameKey, lobbyId: number) {
  const response = await fetch(CLOSE_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ game, lobby_id: lobbyId }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || "Lobby kapatılamadı.");
  return data;
}

function closeOpenLobbyOnExit(game: LobbyGameKey, lobbyId: number) {
  const payload = JSON.stringify({ game, lobby_id: lobbyId });
  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(CLOSE_ENDPOINT, blob)) return;
    }
  } catch {}

  try {
    void fetch(CLOSE_ENDPOINT, {
      method: "POST",
      credentials: "same-origin",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
  } catch {}
}

export function useAutoCloseOpenLobbies(game: LobbyGameKey, lobbyIds: number[]) {
  const lobbyIdsRef = useRef<number[]>([]);

  useEffect(() => {
    lobbyIdsRef.current = Array.from(new Set(lobbyIds.filter((id) => Number.isFinite(id) && id > 0)));
  }, [lobbyIds]);

  useEffect(() => {
    const closeTrackedLobbies = () => {
      for (const lobbyId of lobbyIdsRef.current) closeOpenLobbyOnExit(game, lobbyId);
    };

    window.addEventListener("pagehide", closeTrackedLobbies);
    window.addEventListener("beforeunload", closeTrackedLobbies);
    return () => {
      window.removeEventListener("pagehide", closeTrackedLobbies);
      window.removeEventListener("beforeunload", closeTrackedLobbies);
    };
  }, [game]);
}
