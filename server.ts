import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API proxy route for GAS
  app.all("/api/gas-proxy", async (req, res) => {
    let gasUrl = (req.query.targetUrl || req.body?.targetUrl || req.headers['x-gas-url']) as string;
    if (!gasUrl) {
      gasUrl = process.env.VITE_GOOGLE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxVnHwT0cMLBOJqBfuPiBI1rpuv6sHrGRNW6R0CLwptLG9i0cmnH_acgllLAi0xbZBI/exec?action=getQueue&sheet=Story";
    }

    try {
      const urlObj = new URL(gasUrl.trim());
      
      // Copy all query parameters from client request to GAS request, except proxy-specific ones
      Object.keys(req.query).forEach((key) => {
        if (key !== 'targetUrl') {
          urlObj.searchParams.set(key, String(req.query[key]));
        }
      });

      console.log(`[PROXY] Incoming request: ${req.method} ${req.url}`);
      console.log(`[PROXY] Target Gas URL: ${gasUrl}`);
      console.log(`[PROXY] Query params:`, JSON.stringify(req.query));
      console.log(`[PROXY] Body keys:`, req.body ? Object.keys(req.body) : 'none');

      const options: RequestInit = {
        method: req.method,
        redirect: 'follow',
      };

      if (req.method === 'POST') {
        options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        const params = new URLSearchParams();
        if (req.body && typeof req.body === 'object') {
          Object.keys(req.body).forEach((key) => {
            if (key !== 'targetUrl') {
              params.append(key, String(req.body[key]));
              // If the parameter is in the POST body, delete it from the URL's query parameters
              // to prevent conflicts. Google Apps Script's e.parameter can prioritize URL query parameters.
              urlObj.searchParams.delete(key);
            }
          });
        }
        options.body = params.toString();
      }

      console.log(`[PROXY] Formatting outgoing request to: ${urlObj.toString()}`);
      
      const response = await fetch(urlObj.toString(), options);
      const responseText = await response.text();
      
      console.log(`[PROXY] GAS response status: ${response.status}`);
      console.log(`[PROXY] GAS response (first 250 chars): ${responseText.slice(0, 250)}`);
      
      res.status(response.status);
      const resContentType = response.headers.get('content-type');
      if (resContentType) {
        res.setHeader('content-type', resContentType);
      }
      res.send(responseText);
    } catch (err: any) {
      console.error("[PROXY] Error occurred during GAS proxy:", err);
      res.status(500).json({ error: "Proxy Error", message: err.message });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
