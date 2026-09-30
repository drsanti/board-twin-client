/*
 * types.ts — wire types for the board-twin WS/JSON API (:7392).
 *
 * These describe the messages exchanged with the broker, plus the
 * client-side snapshot shape. See ../../README.md "Web API" for the
 * protocol walkthrough.
 */

/** Board layout announced by the simulator (or a static default). */
export interface BoardDescriptor {
  leds?: number[];
  buttons?: number[];
  switches?: number[];
  adcs?: number[];
  mic?: number[];
  speaker?: number[];
  seg7?: number[];
  pwm?: number[];
  rgb?: number[];
  uart?: boolean;
}

/** One line on the serial panel. rx = sim → panel, tx = panel → sim. */
export interface SerialLine {
  dir: "rx" | "tx";
  text: string;
}

export interface TaskInfo {
  n: string;                        // task name
  s: string;                        // running|ready|blocked|suspended|deleted
  p: number;                        // priority
  hwm: number;                      // stack high-water mark, bytes
}

export interface SimStats {
  up: number;                       // uptime, seconds
  tick: number;                     // configTICK_RATE_HZ
  heapFree: number;
  heapTotal: number;
  tasks: TaskInfo[];
}

/** Client-side view of everything the broker has told us so far. */
export interface Snapshot {
  connected: boolean;
  board: BoardDescriptor | null;
  state: Record<string, number | string>;
  log: string[];
  serial: SerialLine[];
  stats: SimStats | null;
}

/* ---- messages: broker → client ---- */

export type BrokerMessage =
  | { kind: "hello"; version: string; board?: BoardDescriptor; state?: Record<string, number | string> }
  | { kind: "board"; board: BoardDescriptor }
  | { kind: "set"; dev: string; id: number; value: number }
  | { kind: "evt"; dev: string; id: number; name: string }
  | { kind: "uart"; dir?: "rx" | "tx"; text: string }
  | { kind: "stats"; stats: SimStats }
  | { kind: "rst" };

/* ---- messages: client → broker ---- */

export type ClientMessage =
  | { kind: "set"; dev: string; id: number; value: number }
  | { kind: "evt"; dev: string; id: number; name: string }
  | { kind: "uart"; port: number; text: string }
  | { kind: "rst" };

/* ---- typed client events ---- */

export interface ClientEvents {
  /** Connected (or reconnected) to the broker. */
  connect: () => void;
  /** Connection lost; auto-reconnect already scheduled. */
  disconnect: () => void;
  /** Board layout changed (sim announced a new descriptor). */
  board: (board: BoardDescriptor) => void;
  /** A device value changed, from any peer including the sim. */
  state: (dev: string, id: number, value: number) => void;
  /** A UI-style event (button press/release etc.). */
  event: (dev: string, id: number, name: string) => void;
  /** A serial line, in either direction. */
  uart: (line: SerialLine) => void;
  /** Kernel telemetry (1 Hz while the sim sends it). */
  stats: (stats: SimStats) => void;
  /** Board state reset. */
  reset: () => void;
  /** Any snapshot mutation — mirrors subscribe(). */
  change: (snapshot: Snapshot) => void;
}
