const requests = new Map();
let requestCounter = 1;

function storeRequest(req, res) {
    const id = requestCounter++;
    const requestData = {
        id,
        method: req.method,
        originalUrl: req.url,
        host: req.host,
        port: req.port,
        path: req.path,
        headers: req.headers,
        body: req.body,
        timestamp: new Date(),
        response: {
            statusCode: res.statusCode,
            headers: res.headers,
            body: res.body
        }
    };
    requests.set(id, requestData);
    return requestData;
}

function getRequest(id) {
    return requests.get(Number(id));
}

function getAllRequests() {
    return Array.from(requests.values());
}

module.exports = {
    storeRequest,
    getRequest,
    getAllRequests
};
