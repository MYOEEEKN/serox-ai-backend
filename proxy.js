// proxy.js - A simple CORS-Anywhere style proxy server
// This is used to bypass the 403 Forbidden error from the external API.

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PROXY_PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

app.post('/proxy', async (req, res) => {
    const targetUrl = "https://api.bdg88zf.com/api/webapi/GetNoaverageEmerdList";
    console.log(`Proxy: Forwarding request to ${targetUrl}`);

    try {
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://bdg88zf.com/"
            },
            body: JSON.stringify(req.body) // Forward the body from the original request
        });

        if (!response.ok) {
            const errorText = await response.text();
            // Forward the actual status code and error from the target server
            return res.status(response.status).send(errorText);
        }

        const data = await response.json();
        res.json(data);

    } catch (error) {
        console.error('Proxy error:', error);
        res.status(500).json({ message: "Proxy server internal error." });
    }
});

app.listen(PORT, () => {
    console.log(`Proxy server running on port ${PORT}`);
});
