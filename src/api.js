const express = require('express');
const bodyParser = require('body-parser');
const { getRequest, getAllRequests } = require('./storage');
const http = require('http');

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/requests', (req, res) => {
    const requests = getAllRequests();
    res.json(requests);
});

app.get('/requests/:id', (req, res) => {
    const request = getRequest(req.params.id);
    if (request) {
        res.json(request);
    } else {
        res.status(404).json({ error: 'Request not found' });
    }
});

app.get('/repeat/:id', (req, res) => {
    const originalRequest = getRequest(req.params.id);
    if (!originalRequest) {
        return res.status(404).json({ error: 'Request not found' });
    }

    const options = {
        host: originalRequest.host,
        port: originalRequest.port,
        path: originalRequest.path,
        method: originalRequest.method,
        headers: originalRequest.headers
    };

    const proxyReq = http.request(options, (proxyRes) => {
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

    proxyReq.end();
});

module.exports = app;
