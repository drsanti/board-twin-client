# @ternion/board-twin-client

Typed TypeScript client for the **board-twin** live-data broker
(`ws://127.0.0.1:7392`). Use it to build web apps that read the simulated
board's live state — LEDs, buttons, ADC, PWM, UART, kernel stats — and
drive inputs back into the FreeRTOS simulator.

Works in browsers and Node ≥ 22 (both have a global `WebSocket`); an
implementation can be injected for older runtimes.

## Install

From GitHub (no npm publish yet — `dist/` is committed, no build needed):

```bash
npm install drsanti/board-twin-client
# pin a release:
npm install drsanti/board-twin-client#v0.2.0
```

**Starter app:** [`examples/starter/`](examples/starter/) — a minimal
Vite app (live state table, serial panel, button/LED/UART controls).
`npm install && npm run dev` and it's talking to the board.

## Usage

```ts
import { BoardTwinClient } from "@ternion/board-twin-client";

const board = new BoardTwinClient("ws://127.0.0.1:7392");

// typed events
board.on("connect",    () => console.log("online"));
board.on("board",      (desc) => console.log("layout:", desc));
board.on("state",      (dev, id, v) => console.log(`${dev}/${id} = ${v}`));
board.on("event",      (dev, id, name) => console.log(`${dev}/${id} ${name}`));
board.on("uart",       (line) => console.log(`[${line.dir}] ${line.text}`));
board.on("stats",      (s) => console.log(`heap ${s.heapFree}/${s.heapTotal}`));

// drive the board
board.set("led", 0, 1);            // LED0 on
board.event("btn", 2, "press");    // simulate a button press
board.uart("help");                // send a line to the sim's UART
board.reset();                     // clear board state on all peers
```

## Snapshot API (for frameworks)

```ts
const snap = board.getSnapshot();          // { connected, board, state, log, serial, stats }
const unsub = board.subscribe(() => {      // fires on every change — pair with
  render(board.getSnapshot());             // useSyncExternalStore in React
});
board.get("adc", 0);                       // quick lookup: value of adc/0
```

## Options

```ts
new BoardTwinClient(url, {
  WebSocket,            // inject for Node < 22 or tests
  autoReconnect: true,  // reconnect on connection loss
  reconnectDelay: 1500, // ms
  maxLog: 300,          // snapshot log/serial buffer caps
  maxSerial: 200,
});
```

## Wire protocol

Client → broker:

```json
{"kind":"set","dev":"led","id":3,"value":1}
{"kind":"evt","dev":"btn","id":0,"name":"press"}
{"kind":"uart","port":0,"text":"hello"}
{"kind":"rst"}
```

Broker → client:

```json
{"kind":"hello","version":"1","board":{...},"state":{...}}
{"kind":"board","board":{...}}
{"kind":"set","dev":"led","id":0,"value":1}
{"kind":"evt","dev":"btn","id":0,"name":"press"}
{"kind":"uart","dir":"rx","text":"..."}
{"kind":"stats","stats":{...}}
{"kind":"rst"}
```

Shared namespace, last-write-wins, broadcast to all peers. The board-twin
React UI uses this exact class — the app dogfoods the public SDK.
