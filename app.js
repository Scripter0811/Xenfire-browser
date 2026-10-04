"use strict";
const $ = (s) => document.querySelector(s);
const SEARCH = "https://duckduckgo.com/?q=%s";
const QUICK = [["🔎", "DuckDuckGo", "https://duckduckgo.com"], ["▶️", "YouTube", "https://www.youtube.com"], ["📚", "Wikipedia", "https://www.wikipedia.org"], ["💬", "Reddit", "https://www.reddit.com"]];
let tabs = [], active = null, nextId = 1, ready = null;

// ---------- storage (safe) ----------
const store = {
	get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
	set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
let marks = store.get("xf-marks", []);

// ---------- proxy setup ----------
function setup() {
	return (ready ??= (async () => {
		if (!navigator.serviceWorker) throw new Error("Service workers need https (or localhost).");
		const reg = await navigator.serviceWorker.register("/uv/sw.js", { scope: __uv$config.prefix });
		const sw = reg.installing || reg.waiting;
		if (!reg.active && sw) await new Promise((r) => sw.addEventListener("statechange", () => sw.state === "activated" && r()));
		const conn = new BareMux.BareMuxConnection("/baremux/worker.js");
		await conn.setTransport("/epoxy/index.mjs", [{ wisp: XENFIRE.WISP_URL }]);
	})().catch((e) => { ready = null; throw e; }));
}

// ---------- url helpers ----------
function toUrl(input) {
	input = input.trim();
	try { return new URL(input).toString(); } catch {}
	try { const u = new URL("https://" + input); if (u.hostname.includes(".")) return u.toString(); } catch {}
	return SEARCH.replace("%s", encodeURIComponent(input));
}
const proxied = (url) => __uv$config.prefix + __uv$config.encodeUrl(url);
function realUrl(href) {
	const p = location.origin + __uv$config.prefix;
	return href.startsWith(p) ? __uv$config.decodeUrl(href.slice(p.length)) : null;
}

// ---------- tabs ----------
const cur = () => tabs.find((t) => t.id === active);
function newTab(url) {
	const t = { id: nextId++, url: "", title: "New tab", frame: document.createElement("iframe") };
	t.frame.setAttribute("allow", "fullscreen; autoplay; clipboard-write");
	$("#frames").append(t.frame);
	tabs.push(t);
	select(t.id);
	if (url) go(url);
}
function select(id) { active = id; render(); }
function closeTab(id) {
	const i = tabs.findIndex((t) => t.id === id);
	tabs[i].frame.remove(); tabs.splice(i, 1);
	if (!tabs.length) return newTab();
	if (active === id) active = tabs[Math.min(i, tabs.length - 1)].id;
	render();
}
async function go(input) {
	const t = cur(); if (!input.trim()) return;
	const url = toUrl(input);
	t.url = url; t.title = "Loading…"; render(); $("#status").classList.add("busy");
	try { await setup(); } catch (e) { t.title = "Error"; render(); $("#status").classList.remove("busy"); return alert("Xenfire couldn't start: " + e.message + "\nCheck WISP_URL in config.js and that the backend is awake."); }
	t.frame.src = proxied(url);
}

// ---------- render ----------
function render() {
	const t = cur();
	$("#tabs").replaceChildren(...tabs.map((x) => {
		const d = document.createElement("div");
		d.className = "tab" + (x.id === active ? " on" : "");
		d.innerHTML = "<span></span><b title='Close'>×</b>";
		d.firstChild.textContent = x.title;
		d.onclick = () => select(x.id);
		d.lastChild.onclick = (e) => { e.stopPropagation(); closeTab(x.id); };
		return d;
	}));
	tabs.forEach((x) => x.frame.classList.toggle("on", x.id === active && !!x.url));
	$("#home").classList.toggle("off", !!t.url);
	if (document.activeElement !== $("#addr")) $("#addr").value = t.url;
	$("#star").textContent = marks.some((m) => m.url === t.url) ? "★" : "☆";
	$("#star").classList.toggle("on", marks.some((m) => m.url === t.url));
	document.title = t.url ? t.title + " – Xenfire" : "Xenfire";
	drawHome();
}
function tile(icon, label, url, onclick) {
	const d = document.createElement("div");
	d.className = "tile"; d.title = url;
	d.innerHTML = "<i></i><span></span>";
	d.firstChild.textContent = icon; d.lastChild.textContent = label;
	d.onclick = onclick; return d;
}
function drawHome() {
	$("#quick").replaceChildren(...QUICK.map(([i, n, u]) => tile(i, n, u, () => go(u))));
	if (marks.length) $("#marks").replaceChildren(...marks.map((m) => {
		const d = tile("⭐", m.title || m.url, m.url, () => go(m.url));
		d.oncontextmenu = (e) => { e.preventDefault(); marks = marks.filter((x) => x !== m); store.set("xf-marks", marks); render(); };
		return d;
	}));
	else $("#marks").innerHTML = "<p class='empty'>Nothing yet. Press ☆ on any page.</p>";
}

// keep address bar / title in sync with where the page navigated
setInterval(() => {
	const t = cur(); if (!t || !t.url) return;
	try {
		const w = t.frame.contentWindow, u = realUrl(w.location.href);
		if (u && u !== t.url) t.url = u;
		const title = w.document.title; if (title) t.title = title;
		if (w.document.readyState === "complete") $("#status").classList.remove("busy");
		render();
	} catch {}
}, 700);

// ---------- controls ----------
$("#bar").onsubmit = (e) => { e.preventDefault(); go($("#addr").value); $("#addr").blur(); };
$("#homeform").onsubmit = (e) => { e.preventDefault(); go($("#homeaddr").value); $("#homeaddr").value = ""; };
$("#newtab").onclick = () => newTab();
$("#back").onclick = () => { try { cur().frame.contentWindow.history.back(); } catch {} };
$("#fwd").onclick = () => { try { cur().frame.contentWindow.history.forward(); } catch {} };
$("#reload").onclick = () => { const t = cur(); if (t.url) { try { t.frame.contentWindow.location.reload(); } catch { t.frame.src = proxied(t.url); } } };
$("#homebtn").onclick = () => { const t = cur(); t.url = ""; t.title = "New tab"; t.frame.removeAttribute("src"); render(); };
$("#star").onclick = () => {
	const t = cur(); if (!t.url) return;
	marks = marks.some((m) => m.url === t.url) ? marks.filter((m) => m.url !== t.url) : [...marks, { url: t.url, title: t.title }];
	store.set("xf-marks", marks); render();
};
$("#addr").onfocus = (e) => e.target.select();

newTab();
setup().catch(() => {}); // warm up service worker + wake the backend
