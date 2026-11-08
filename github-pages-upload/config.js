/*
 * Where the published entries come from.
 *   null                    static hosting (GitHub Pages): the site reads entries.json that sits next to index.html.
 *                           The admin page commits to that file in your repo.            <- default
 *   'https://your-server'   you host server.js separately; the site loads published entries from it
 * When the page is served by server.js itself, the server supplies this file with '' (same origin) automatically.
 */
window.LW_API = null;
