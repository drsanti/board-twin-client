/*
 * client.ts — BoardTwinClient, the typed WS/JSON client for board-twin.
 *
 * Works in browsers (global WebSocket) and Node ≥22 (also global
 * WebSocket); an implementation can be injected for older runtimes.
 *
 * The board-twin React UI uses the same class — the app dogfoods the
 * public SDK.
 */
import type {
  BoardDescriptor,
  BrokerMessage,
  ClientEvents,
  ClientMessage,
  SerialLine,
  Snapshot,
} from "./types.js";

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

const MAX_LOG = 300;
const MAX_SERIAL = 200;

export class BoardTwinClient {
  private ws: WebSocket | null = null;
  private url: string;
  private opts: Required<Omit<BoardTwinClientOptions, "WebSocket">>;
  private WS: typeof WebSocket;
  private closed = false;

  private listeners = new Set<Listener>();
  private handlers = new Map<keyof ClientEvents, Set<(...args: never[]) => void>>();

  private snapshot: Snapshot = {
    connected: false, board: null, state: {}, log: [], serial: [], stats: null,
  };

  constructor(url = "ws://127.0.0.1:7392", opts: BoardTwinClientOptions = {}) {
    this.url = url;
    this.WS = opts.WebSocket ?? WebSocket;
    this.opts = {
      autoReconnect: opts.autoReconnect ?? true,
      reconnectDelay: opts.reconnectDelay ?? 1500,
      maxLog: opts.maxLog ?? MAX_LOG,
      maxSerial: opts.maxSerial ?? MAX_SERIAL,
    };
    this.connect();
  }

  /* ---- connection ---- */

  connect() {
    this.closed = false;
    const ws = new this.WS(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.patch({ connected: true });
      this.emit("connect");
    };
    ws.onclose = () => {
      this.patch({ connected: false });
      this.emit("disconnect");
      if (!this.closed && this.opts.autoReconnect) {
        setTimeout(() => this.connect(), this.opts.reconnectDelay);
      }
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      try { this.handle(JSON.parse(e.data as string) as BrokerMessage); }
      catch { /* ignore malformed frames */ }
    };
  }

  /** Stop reconnecting and close. */
  disconnect() {
    this.closed = true;
    this.ws?.close();
  }

  /* ---- broker → client ---- */

  private handle(m: BrokerMessage) {
    switch (m.kind) {
      case "hello":
        this.patch({ board: m.board ?? null, state: m.state ?? {} });
        this.pushLog(`connected — boardtwin/${m.version}`);
        break;
      case "board":
        this.patch({ board: m.board });
        this.pushLog("board layout updated");
        this.emit("board", m.board);
        break;
      case "set":
        this.patch({ state: { ...this.snapshot.state, [`${m.dev}/${m.id}`]: m.value } });
        this.pushLog(`set ${m.dev}/${m.id} = ${m.value}`);
        this.emit("state", m.dev, m.id, m.value);
        break;
      case "evt":
        this.pushLog(`evt ${m.dev}/${m.id} ${m.name}`);
        this.emit("event", m.dev, m.id, m.name);
        break;
      case "uart": {
        const line: SerialLine = { dir: m.dir === "tx" ? "tx" : "rx", text: String(m.text ?? "") };
        const serial = [...this.snapshot.serial, line];
        if (serial.length > this.opts.maxSerial) serial.splice(0, serial.length - this.opts.maxSerial);
        this.patch({ serial });
        this.pushLog(`uart> ${line.text}`);
        this.emit("uart", line);
        break;
      }
      case "rst":
        this.patch({ state: {} });
        this.pushLog("board reset");
        this.emit("reset");
        break;
      case "stats":
        this.patch({ stats: m.stats ?? null });   // 1 Hz — keep out of the log
        if (m.stats) this.emit("stats", m.stats);
        break;
    }
  }

  /* ---- client → broker ---- */

  send(obj: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }
  /** Set a device value — e.g. set("led", 0, 1). Shared namespace, last-write-wins. */
  set(dev: string, id: number, value: number) {
    this.send({ kind: "set", dev, id, value });
  }
  /** Emit a UI event — e.g. event("btn", 0, "press"). */
  event(dev: string, id: number, name: string) {
    this.send({ kind: "evt", dev, id, name });
  }
  /** Alias for event() — matches the wire kind. */
  evt(dev: string, id: number, name: string) {
    this.event(dev, id, name);
  }
  /** Send a text line to the sim (BSP_UART_ReadLine/Read read it). */
  uart(text: string, port = 0) {
    this.send({ kind: "uart", port, text });
  }
  /** Clear board state on all peers. */
  reset() { this.send({ kind: "rst" }); }

  /* ---- read-side ---- */

  /** Latest snapshot (same shape the React UI consumes). */
  getSnapshot = (): Snapshot => this.snapshot;

  /** Convenience lookup: value of `dev/id`, undefined if unset. */
  get(dev: string, id: number): number | string | undefined {
    return this.snapshot.state[`${dev}/${id}`];
  }

  /** Subscribe to any snapshot change. Returns an unsubscribe fn. */
  subscribe = (cb: Listener): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  /** Typed event subscription. Returns an unsubscribe fn. */
  on<K extends keyof ClientEvents>(kind: K, cb: Handler<K>): () => void {
    let set = this.handlers.get(kind);
    if (!set) this.handlers.set(kind, (set = new Set()));
    const fn = cb as (...args: never[]) => void;
    set.add(fn);
    return () => set.delete(fn);
  }

  off<K extends keyof ClientEvents>(kind: K, cb: Handler<K>) {
    this.handlers.get(kind)?.delete(cb as (...args: never[]) => void);
  }

  /* ---- internals ---- */

  private emit<K extends keyof ClientEvents>(kind: K, ...args: Parameters<ClientEvents[K]>) {
    this.handlers.get(kind)?.forEach((cb) => (cb as (...a: unknown[]) => void)(...args));
  }

  private patch(p: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...p };
    this.listeners.forEach((cb) => cb());
    this.emit("change", this.snapshot);
  }

  private pushLog(line: string) {
    const log = [...this.snapshot.log, line];
    if (log.length > this.opts.maxLog) log.splice(0, log.length - this.opts.maxLog);
    this.patch({ log });
  }
}
