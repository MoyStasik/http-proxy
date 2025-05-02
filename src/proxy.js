const http = require('http');
const { storeRequest } = require('./storage');
const api = require('./api');

const proxyPort = 8080;
const apiPort = 8000;

api.listen(apiPort, () => {
    console.log(`API server running on port ${apiPort}`);
});

const proxyServer = http.createServer(async (clientReq, clientRes) => {
    try {
        const { host, port, path, headers } = parseProxyRequest(clientReq);

        const proxy = port === 443 ? require('https') : http;

        const proxyReq = proxy.request({
            host,
            port,
            path,
            method: clientReq.method,
            headers
        }, async (proxyRes) => {
            let responseBody = [];

            proxyRes.on('data', (chunk) => {
                responseBody.push(chunk);
            });

            proxyRes.on('end', async () => {
                const fullResponse = Buffer.concat(responseBody).toString();

                try {
                    await storeRequest({
                        ...clientReq,
                        host,
                        port,
                        path,
                        headers,
                        body: clientReq.body || ''
                    }, {
                        ...proxyRes,
                        statusCode: proxyRes.statusCode,
                        statusMessage: proxyRes.statusMessage,
                        headers: proxyRes.headers,
                        body: fullResponse
                    });
                } catch (err) {
                    console.error('Error storing request:', err);
                }

                clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
                clientRes.end(fullResponse);
            });
        });

        proxyReq.on('error', (err) => {
            console.error('Proxy request error:', err);
            clientRes.writeHead(500);
            clientRes.end('Proxy error');
        });

        if (['POST', 'PUT', 'PATCH'].includes(clientReq.method)) {
            let body = [];
            clientReq.on('data', (chunk) => {
                body.push(chunk);
            }).on('end', () => {
                const bodyBuffer = Buffer.concat(body);
                clientReq.body = bodyBuffer; // Сохраняем тело запроса
                proxyReq.write(bodyBuffer);
                proxyReq.end();
            });
        } else {
            proxyReq.end();
        }

    } catch (err) {
        console.error('Error processing request:', err);
        clientRes.writeHead(400);
        clientRes.end('Bad request');
    }
});

function parseProxyRequest(req) {
    const urlMatch = req.url.match(/^https?:\/\/([^\/]+)(\/.*)?$/i);
    if (!urlMatch) {
        throw new Error('Invalid proxy request format');
    }

    const fullHost = urlMatch[1];
    const path = urlMatch[2] || '/';

    let host, port;
    if (fullHost.includes(':')) {
        [host, port] = fullHost.split(':');
        port = parseInt(port);
    } else {
        host = fullHost;
        port = req.url.startsWith('https://') ? 443 : 80;
    }

    const headers = { ...req.headers };
    delete headers['proxy-connection'];
    headers['host'] = fullHost;

    return {
        host,
        port,
        path,
        headers
    };
}

proxyServer.listen(proxyPort, () => {
    console.log(`Proxy server running on port ${proxyPort}`);
});
