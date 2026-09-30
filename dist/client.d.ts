import type { ClientEvents, ClientMessage, Snapshot } from "./types.js";
type Listener = () => void;
type Handler<K extends keyof ClientEvents> = ClientEvents[K];
export interface BoardTwinClientOptions {
    /** WebSocket implementation (defaults to the global one). */
    WebSocket?: typeof WebSocket;
    /** Reconnect after connection loss. Default true. */
    autoReconnect?: boolean;
    /** Delay before reconnecting, ms. Default 1500. */
    reconnectDelay?: number;
    /** Rolling caps for the snapshot's log/serial buffers. */
    maxLog?: number;
    maxSerial?: number;
}
export declare class BoardTwinClient {
    private ws;
    private url;
    private opts;
    private WS;
    private closed;
    private listeners;
    private handlers;
    private snapshot;
    constructor(url?: string, opts?: BoardTwinClientOptions);
    connect(): void;
    /** Stop reconnecting and close. */
    disconnect(): void;
    private handle;
    send(obj: ClientMessage): void;
    /** Set a device value — e.g. set("led", 0, 1). Shared namespace, last-write-wins. */
    set(dev: string, id: number, value: number): void;
    /** Emit a UI event — e.g. event("btn", 0, "press"). */
    event(dev: string, id: number, name: string): void;
    /** Alias for event() — matches the wire kind. */
    evt(dev: string, id: number, name: string): void;
    /** Send a text line to the sim (BSP_UART_ReadLine/Read read it). */
    uart(text: string, port?: number): void;
    /** Clear board state on all peers. */
    reset(): void;
    /** Latest snapshot (same shape the React UI consumes). */
    getSnapshot: () => Snapshot;
    /** Convenience lookup: value of `dev/id`, undefined if unset. */
    get(dev: string, id: number): number | string | undefined;
    /** Subscribe to any snapshot change. Returns an unsubscribe fn. */
    subscribe: (cb: Listener) => (() => void);
    /** Typed event subscription. Returns an unsubscribe fn. */
    on<K extends keyof ClientEvents>(kind: K, cb: Handler<K>): () => void;
    off<K extends keyof ClientEvents>(kind: K, cb: Handler<K>): void;
    private emit;
    private patch;
    private pushLog;
}
export {};
//# sourceMappingURL=client.d.ts.map