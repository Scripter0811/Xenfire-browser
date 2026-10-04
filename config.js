// Default: the backend is the same site (one Render service serves everything).
// If you host the UI on Firebase instead, replace with: "wss://YOUR-APP.onrender.com/wisp/"
window.XENFIRE = {
	WISP_URL: (location.protocol === "https:" ? "wss://" : "ws://") + location.host + "/wisp/",
};
