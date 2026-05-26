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
    let gasUrl = req.headers['x-gas-url'] as string;
    if (!gasUrl) {
      gasUrl = process.env.VITE_GOOGLE_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxVnHwT0cMLBOJqBfuPiBI1rpuv6sHrGRNW6R0CLwptLG9i0cmnH_acgllLAi0xbZBI/exec";
    }

    try {
      const urlObj = new URL(gasUrl.trim());
      
      // Copy all query parameters from client request to GAS request
      Object.keys(req.query).forEach((key) => {
        urlObj.searchParams.set(key, String(req.query[key]));
      });

      const options: RequestInit = {
        method: req.method,
        redirect: 'follow',
      };

      if (req.method === 'POST') {
        const contentType = req.headers['content-type'];
        if (contentType && contentType.includes('application/json')) {
          options.headers = { 'Content-Type': 'application/json' };
          options.body = JSON.stringify(req.body);
        } else {
          options.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
          const params = new URLSearchParams();
          Object.keys(req.body).forEach((key) => {
            params.append(key, String(req.body[key]));
          });
          options.body = params.toString();
        }
      }

      console.log(`[PROXY] Forwarding ${req.method} to: ${urlObj.toString()}`);
      
      const response = await fetch(urlObj.toString(), options);
      const responseText = await response.text();
      
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
