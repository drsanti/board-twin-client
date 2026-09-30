/*
 * main.ts — minimal board-twin web app.
 *
 * Connects to the board-twin broker, mirrors live board state into a
 * table, and drives inputs back (buttons, LED override, UART, reset).
 */
import { BoardTwinClient } from "@ternion/board-twin-client";
import type { Snapshot } from "@ternion/board-twin-client";

const board = new BoardTwinClient("ws://127.0.0.1:7392");

const $ = <T extends HTMLElement>(sel: string) =>
  document.querySelector(sel) as T;

/* ---- connection badge ---- */

function setStatus(on: boolean) {
  const el = $<HTMLSpanElement>("#status");
  el.textContent = on ? "connected" : "offline";
  el.classList.toggle("on", on);
}
board.on("connect", () => setStatus(true));
board.on("disconnect", () => setStatus(false));

/* ---- live state table + stats ----
 * subscribe() fires on every snapshot change — the simplest render
 * loop: repaint the whole table. For React apps you'd pair this with
 * useSyncExternalStore instead. */

function render(snap: Snapshot) {
  const rows = Object.entries(snap.state)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`)
    .join("");
  $("#state").innerHTML =
    rows || `<tr><td colspan="2">(waiting for board data…)</td></tr>`;

  const s = snap.stats;
  $("#stats").textContent = s
    ? `up ${s.up}s · heap ${s.heapFree}/${s.heapTotal} B · ${s.tasks.length} tasks · tick ${s.tick} Hz`
    : "—";
}
board.subscribe(() => render(board.getSnapshot()));

/* ---- serial panel ---- */

board.on("uart", (line) => {
  const box = $("#serial");
  const div = document.createElement("div");
  div.className = line.dir;
  div.textContent = `${line.dir === "rx" ? "sim→" : "→sim"} ${line.text}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
});

/* ---- drive the board ---- */

$("#btn0").onclick = () => board.event("btn", 0, "press");
$("#btn1").onclick = () => board.event("btn", 1, "press");
$("#led0").onclick = () =>
  board.set("led", 0, board.get("led", 0) ? 0 : 1);
$("#reset").onclick = () => board.reset();

const sendUart = () => {
  const input = $<HTMLInputElement>("#uartText");
  if (input.value) board.uart(input.value);
  input.value = "";
  input.focus();
};
$("#uartSend").onclick = sendUart;
$("#uartText").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendUart();
});
