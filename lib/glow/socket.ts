'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { RoomStatePayload } from './types';
import { getRealtimeUrl } from './matrix';

export function useGlowSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);

  useEffect(() => {
    const socket = io(getRealtimeUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('room:state', (state: RoomStatePayload) => setRoomState(state));
    socket.on('room:closed', () => setRoomState(null));

    return () => {
      socket.disconnect();
    };
  }, []);

  const emitWithCallback = useCallback(
    <T,>(event: string, payload: unknown): Promise<T> =>
      new Promise((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket) {
          reject(new Error('Socket not connected'));
          return;
        }
        socket.emit(event, payload, (response: T) => resolve(response));
      }),
    []
  );

  const on = useCallback((event: string, handler: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, handler);
    return () => {
      socketRef.current?.off(event, handler);
    };
  }, []);

  const emit = useCallback((event: string, payload: unknown) => {
    socketRef.current?.emit(event, payload);
  }, []);

  return {
    socket: socketRef,
    connected,
    roomState,
    emitWithCallback,
    emit,
    on,
  };
}
