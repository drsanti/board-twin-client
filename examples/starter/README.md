# board-twin starter app

Minimal web app that talks to the **board-twin** simulator board —
reads live state, shows the serial output, and drives inputs back.

## Run

1. Start **board-twin** (the desktop app) — leave it open.
2. Optionally start a FreeRTOS example so the board has live data.
3. In this folder:

   ```bash
   npm install
   npm run dev
   ```

   Open the URL Vite prints (usually http://localhost:5173).

## What it shows

| Piece | What happens |
|-------|--------------|
| **status badge** | green when connected to `ws://127.0.0.1:7392` |
| **press btn0/1** | sends `evt` → the FreeRTOS app sees a button press |
| **toggle led0** | writes `led/0` — shared state, visible in board-twin too |
| **UART input** | sends a line to the sim (`BSP_UART_ReadLine` reads it) — try `help` on ex13 |
| **reset** | clears board state on all connected peers |
| **state table** | every `dev/id` value, live |
| **kernel stats** | uptime, heap, task count — needs a sim running with `BSP_SendStats` |

## Next steps

- `board.on("state", cb)` / `board.on("event", cb)` for targeted updates
- `board.subscribe(cb)` + `board.getSnapshot()` pairs with React's
  `useSyncExternalStore`
- Full API: see `../../README.md` (CLIENT-API.md in the student pack)
