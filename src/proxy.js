const http = require('http');
const net = require('net');
const tls = require('tls');
const { storeRequest } = require('./storage');
const api = require('./api');
const { generateCA, generateHostCert } = require('./cert-utils');
const fs = require('fs');
const path = require('path');

const proxyPort = 8080;
const apiPort = 8000;

// Ensure certs directory exists
if (!fs.existsSync(path.join(__dirname, '../certs'))) {
    fs.mkdirSync(path.join(__dirname, '../certs'));
}

// Generate CA certificate
generateCA();

// Start API server
api.listen(apiPort, () => {
    console.log(`API server running on port ${apiPort}`);
});

// Create HTTP proxy server
const proxyServer = http.createServer(async (clientReq, clientRes) => {
    try {
        console.log('зашел')
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

// Handle CONNECT method for HTTPS
proxyServer.on('connect', (req, clientSocket, head) => {
    try {
        // Parse host and port from CONNECT request
        const [host, port] = req.url.split(':');
        const targetPort = port || 443;

        // Establish connection to target server
        const serverSocket = net.connect(targetPort, host, () => {
            // Respond to client that connection is established
            clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');

            // Generate certificate for this host
            const { cert, key } = generateHostCert(host);

            // Create TLS server for MITM
            const tlsServer = tls.createServer({
                key: key,
                cert: cert,
                SNICallback: (servername, cb) => {
                    const { cert, key } = generateHostCert(servername);
                    const ctx = tls.createSecureContext({ cert, key });
                    cb(null, ctx);
                }
            });

            // Pipe client through our TLS server to target
            tlsServer.on('secureConnection', (tlsSocket) => {
                tlsSocket.pipe(serverSocket);
                serverSocket.pipe(tlsSocket);

                // Store the request
                storeRequest({
                    method: 'CONNECT',
                    url: req.url,
                    host,
                    port: targetPort,
                    headers: req.headers,
                    timestamp: new Date()
                }, {
                    statusCode: 200,
                    statusMessage: 'Connection Established',
                    headers: {},
                    body: ''
                });
            });

            // Start TLS server
            tlsServer.emit('connection', clientSocket);
        });

        serverSocket.on('error', (err) => {
            console.error('Server socket error:', err);
            clientSocket.end();
        });

        if (head && head.length) {
            serverSocket.write(head);
        }

    } catch (err) {
        console.error('HTTPS proxy error:', err);
        clientSocket.end();
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
