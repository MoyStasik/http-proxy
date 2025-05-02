const mongoose = require('mongoose');
const { parse } = require('url');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');

// Подключение к MongoDB
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/proxyDB', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Схема для хранения запросов
const RequestSchema = new mongoose.Schema({
  method: String,
  originalUrl: String,
  host: String,
  port: Number,
  path: String,
  query: Object,
  headers: Object,
  cookies: Object,
  body: String,
  postParams: Object,
  timestamp: { type: Date, default: Date.now }
});

// Схема для хранения ответов
const ResponseSchema = new mongoose.Schema({
  requestId: mongoose.Schema.Types.ObjectId,
  statusCode: Number,
  statusMessage: String,
  headers: Object,
  body: String,
  timestamp: { type: Date, default: Date.now }
});

const RequestModel = mongoose.model('Request', RequestSchema);
const ResponseModel = mongoose.model('Response', ResponseSchema);

async function storeRequest(req, res) {
  try {
    // Парсинг URL и query параметров
    const parsedUrl = parse(req.url, true);
    const query = parsedUrl.query;

    // Парсинг cookies
    const cookies = {};
    if (req.headers.cookie) {
      cookieParser()(req, null, () => {});
      cookies = req.cookies || {};
    }

    // Парсинг тела запроса (если есть)
    let body = '';
    let postParams = {};

    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      body = req.body || '';

      if (req.headers['content-type'] &&
          req.headers['content-type'].includes('application/x-www-form-urlencoded') &&
          body) {
        postParams = querystring.parse(body.toString());
      }
    }

    // Сохранение запроса
    const requestDoc = new RequestModel({
      method: req.method,
      originalUrl: req.url,
      host: req.host,
      port: req.port,
      path: parsedUrl.pathname,
      query,
      headers: req.headers,
      cookies,
      body: body.toString(),
      postParams
    });

    const savedRequest = await requestDoc.save();

    // Сохранение ответа
    const responseDoc = new ResponseModel({
      requestId: savedRequest._id,
      statusCode: res.statusCode,
      statusMessage: res.statusMessage || '',
      headers: res.headers,
      body: res.body
    });

    await responseDoc.save();

    return {
      id: savedRequest._id,
      ...savedRequest.toObject(),
      response: responseDoc.toObject()
    };
  } catch (err) {
    console.error('Error storing request:', err);
    throw err;
  }
}

async function getRequest(id) {
  try {
    const request = await RequestModel.findById(id);
    if (!request) return null;

    const response = await ResponseModel.findOne({ requestId: id });

    return {
      ...request.toObject(),
      response: response ? response.toObject() : null
    };
  } catch (err) {
    console.error('Error getting request:', err);
    return null;
  }
}

async function getAllRequests() {
  try {
    const requests = await RequestModel.find().sort({ timestamp: -1 });
    return await Promise.all(requests.map(async req => {
      const res = await ResponseModel.findOne({ requestId: req._id });
      return {
        ...req.toObject(),
        response: res ? res.toObject() : null
      };
    }));
  } catch (err) {
    console.error('Error getting all requests:', err);
    return [];
  }
}

module.exports = {
  storeRequest,
  getRequest,
  getAllRequests
};
