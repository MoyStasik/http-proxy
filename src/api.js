const express = require('express');
const bodyParser = require('body-parser');
const { getRequest, getAllRequests } = require('./storage');
const http = require('http');
const https = require('https');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/requests', async (req, res) => {
    try {
        const requests = await getAllRequests();
        res.json(requests);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/requests/:id', async (req, res) => {
    try {
        const request = await getRequest(req.params.id);
        if (request) {
            res.json(request);
        } else {
            res.status(404).json({ error: 'Request not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/repeat/:id', async (req, res) => {
    try {
        const originalRequest = await getRequest(req.params.id);
        if (!originalRequest) {
            return res.status(404).json({ error: 'Request not found' });
        }

        const protocol = originalRequest.port === 443 ? https : http;
        const options = {
            hostname: originalRequest.host,
            port: originalRequest.port,
            path: originalRequest.path,
            method: originalRequest.method,
            headers: originalRequest.headers
        };

        const proxyReq = protocol.request(options, (proxyRes) => {
            let responseBody = [];

            proxyRes.on('data', (chunk) => {
                responseBody.push(chunk);
            });

            proxyRes.on('end', () => {
                const fullResponse = Buffer.concat(responseBody).toString();
                res.json({
                    status: proxyRes.statusCode,
                    headers: proxyRes.headers,
                    body: fullResponse
                });
            });
        });

        proxyReq.on('error', (err) => {
            res.status(500).json({ error: err.message });
        });

        // Если есть тело запроса (для POST, PUT, PATCH)
        if (['POST', 'PUT', 'PATCH'].includes(originalRequest.method)) {
            proxyReq.write(originalRequest.body);
        }

        proxyReq.end();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = app;
