// Xenfire: serves the UI and the proxy backend from one place. No folders needed.
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import express from "express";
import wisp from "wisp-server-node";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const root = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use((req, res, next) => {
	res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
	res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
	next();
});

// Our own files (they sit next to this file)
const send = (file) => (req, res) => res.sendFile(file, { root });
app.get("/", send("index.html"));
app.get("/index.html", send("index.html"));
app.get("/app.js", send("app.js"));
app.get("/style.css", send("style.css"));
app.get("/config.js", send("config.js"));
app.get("/uv/uv.config.js", send("uv.config.js")); // overrides the stock config

// Proxy engine files come straight from node_modules
app.use("/uv/", express.static(uvPath));
app.use("/epoxy/", express.static(epoxyPath));
app.use("/baremux/", express.static(baremuxPath));

app.use((req, res) => res.status(404).send("Not found"));

const server = createServer(app);
server.on("upgrade", (req, socket, head) => {
	if (req.url.endsWith("/wisp/")) return wisp.routeRequest(req, socket, head);
	socket.end();
});
const port = parseInt(process.env.PORT || "") || 8080;
server.listen(port, () => console.log("Xenfire running on port " + port));
