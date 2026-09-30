const MAX_LOG = 300;
const MAX_SERIAL = 200;
export class BoardTwinClient {
    ws = null;
    url;
    opts;
    WS;
    closed = false;
    listeners = new Set();
    handlers = new Map();
    snapshot = {
        connected: false, board: null, state: {}, log: [], serial: [], stats: null,
    };
    constructor(url = "ws://127.0.0.1:7392", opts = {}) {
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
            try {
                this.handle(JSON.parse(e.data));
            }
            catch { /* ignore malformed frames */ }
        };
    }
    /** Stop reconnecting and close. */
    disconnect() {
        this.closed = true;
        this.ws?.close();
    }
    /* ---- broker → client ---- */
    handle(m) {
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
                const line = { dir: m.dir === "tx" ? "tx" : "rx", text: String(m.text ?? "") };
                const serial = [...this.snapshot.serial, line];
                if (serial.length > this.opts.maxSerial)
                    serial.splice(0, serial.length - this.opts.maxSerial);
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
                this.patch({ stats: m.stats ?? null }); // 1 Hz — keep out of the log
                if (m.stats)
                    this.emit("stats", m.stats);
                break;
        }
    }
    /* ---- client → broker ---- */
    send(obj) {
        if (this.ws?.readyState === WebSocket.OPEN)
            this.ws.send(JSON.stringify(obj));
    }
    /** Set a device value — e.g. set("led", 0, 1). Shared namespace, last-write-wins. */
    set(dev, id, value) {
        this.send({ kind: "set", dev, id, value });
    }
    /** Emit a UI event — e.g. event("btn", 0, "press"). */
    event(dev, id, name) {
        this.send({ kind: "evt", dev, id, name });
    }
    /** Alias for event() — matches the wire kind. */
    evt(dev, id, name) {
        this.event(dev, id, name);
    }
    /** Send a text line to the sim (BSP_UART_ReadLine/Read read it). */
    uart(text, port = 0) {
        this.send({ kind: "uart", port, text });
    }
    /** Clear board state on all peers. */
    reset() { this.send({ kind: "rst" }); }
    /* ---- read-side ---- */
    /** Latest snapshot (same shape the React UI consumes). */
    getSnapshot = () => this.snapshot;
    /** Convenience lookup: value of `dev/id`, undefined if unset. */
    get(dev, id) {
        return this.snapshot.state[`${dev}/${id}`];
    }
    /** Subscribe to any snapshot change. Returns an unsubscribe fn. */
    subscribe = (cb) => {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    };
    /** Typed event subscription. Returns an unsubscribe fn. */
    on(kind, cb) {
        let set = this.handlers.get(kind);
        if (!set)
            this.handlers.set(kind, (set = new Set()));
        const fn = cb;
        set.add(fn);
        return () => set.delete(fn);
    }
    off(kind, cb) {
        this.handlers.get(kind)?.delete(cb);
    }
    /* ---- internals ---- */
    emit(kind, ...args) {
        this.handlers.get(kind)?.forEach((cb) => cb(...args));
    }
    patch(p) {
        this.snapshot = { ...this.snapshot, ...p };
        this.listeners.forEach((cb) => cb());
        this.emit("change", this.snapshot);
    }
    pushLog(line) {
        const log = [...this.snapshot.log, line];
        if (log.length > this.opts.maxLog)
            log.splice(0, log.length - this.opts.maxLog);
        this.patch({ log });
    }
}
//# sourceMappingURL=client.js.map