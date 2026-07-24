export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(req, res) {
  const { path } = req.query;
  const subPath = Array.isArray(path) ? path.join('/') : path || '';
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `http://127.0.0.1:8000/api/${subPath}${queryString}`;

  try {
    const headers = {
      'content-type': req.headers['content-type'] || 'application/json',
    };
    if (req.headers['x-user-id']) headers['x-user-id'] = req.headers['x-user-id'];
    if (req.headers['authorization']) headers['authorization'] = req.headers['authorization'];

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : (req.body || '');
    }

    const backendRes = await fetch(targetUrl, fetchOptions);
    const contentType = backendRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    res.status(backendRes.status);
    const data = await backendRes.text();
    res.send(data);
  } catch (error) {
    console.error(`[API Proxy Error to ${targetUrl}]:`, error);
    res.status(500).json({ detail: `Backend proxy error: ${error.message}` });
  }
}
