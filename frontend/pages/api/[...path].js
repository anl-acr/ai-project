export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
};

export default async function handler(req, res) {
  const { path } = req.query;
  const subPath = Array.isArray(path) ? path.join('/') : path || '';
  
  // Construct target URL to Python FastAPI server on 127.0.0.1:8000
  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const targetUrl = `http://127.0.0.1:8000/api/${subPath}${queryString}`;

  try {
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;

    const fetchOptions = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      fetchOptions.body = Buffer.concat(buffers);
    }

    const backendRes = await fetch(targetUrl, fetchOptions);
    const contentType = backendRes.headers.get('content-type');
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    
    res.status(backendRes.status);
    const responseArrayBuffer = await backendRes.arrayBuffer();
    res.send(Buffer.from(responseArrayBuffer));
  } catch (error) {
    console.error(`[API Proxy Error to ${targetUrl}]:`, error);
    res.status(500).json({ detail: `Backend proxy error: ${error.message}` });
  }
}
