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

        const proxyReq = http.request({
            host,
            port,
            path,
            method: clientReq.method,
            headers
        }, (proxyRes) => {
            let responseBody = [];

            proxyRes.on('data', (chunk) => {
                responseBody.push(chunk);
            });

            proxyRes.on('end', () => {
                const fullResponse = Buffer.concat(responseBody).toString();

                storeRequest({
                    ...clientReq,
                    host,
                    port,
                    path,
                    headers
                }, {
                    ...proxyRes,
                    body: fullResponse
                });

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
                proxyReq.write(Buffer.concat(body));
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
    const requestLine = req.method + ' ' + req.url + ' ' + req.httpVersion;

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
