this.DOMAIN = 'api.dev.y-bi.top'
const proxy = httpProxy.createProxyServer()

proxy.on('proxyReq', function (proxyReq, req, res, options) {
    proxyReq.setHeader('origin', 'https://api.wyr.me')
    // proxyReq.setHeader('referer', 'https://api.wyr.me/')
    // proxyReq.setHeader('host', 'api.wyr.me')
    console.info(JSON.stringify(req.headers, true, 2))
    console.debug(proxyReq.getHeader('host'))
})

proxy.on('proxyRes', function (proxyRes, req, res) {
    // console.debug('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2))
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token')
})

proxy.on('error', function (e, req, res) {
    res.writeHead(500, {
        'Content-Type': 'text/plain'
    });

    res.end('Something went wrong. And we are reporting a custom error message.');
    console.error(e)
})

function main(req, res) {
    proxy.web(req, res, { target: 'https://api.wyr.me', secure: true, changeOrigin: true })
}