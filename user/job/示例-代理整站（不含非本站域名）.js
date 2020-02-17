this.DOMAIN = '*-ip.dev.y-bi.top' // 域名
const proxy = httpProxy.createProxyServer()

proxy.on('proxyReq', function (proxyReq, req, res, options) {
    proxyReq.setHeader('origin', 'http://www.cip.cc')
    proxyReq.setHeader('referer', 'http://www.cip.cc/')
    proxyReq.setHeader('host', 'www.cip.cc')
    console.info(JSON.stringify(proxyReq.getHeader('host'), true, 2))
})

proxy.on('error', function (e) {
    console.error(e)
})

function main(req, res) {
    proxy.web(req, res, { target: 'http://www.cip.cc', changeOrigin: true })
}