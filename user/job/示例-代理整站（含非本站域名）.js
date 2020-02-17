// 测试访问时请加路径：/mobile/webapp/index/index/#index/index/foo=bar/vt=map
// 由于源地址js脚本限制，该示例会自动跳转到https。

this.DOMAIN = '*-map.dev.y-bi.top' // 域名，请确保 *.dev.y-bi.top 泛解析到服务器
this.SCHEMA = 'http' // 当前访问模式
const proxy = httpProxy.createProxyServer()
const proxyOther = httpProxy.createProxyServer()
const hostMap = new Map()
let hostMapIndex = 0

proxy.on('proxyReq', function (proxyReq, req, res, options) {
  proxyReq.setHeader('origin', 'https://map.baidu.com')
  proxyReq.setHeader('referer', null)
  proxyReq.setHeader('host', 'map.baidu.com')
  // console.info(JSON.stringify(proxyReq.getHeader('origin'), true, 2))
})

const decodeHandler = (encoding, bufferData, callback) => {
  let data = null
  if (encoding == 'gzip') {
    zlib.gunzip(bufferData, function (err, decoded) {
      data = decoded.toString();
      callback(err, data);
    });
  } else if (encoding == 'deflate') {
    zlib.inflate(bufferData, function (err, decoded) {
      data = decoded.toString();
      callback(err, data);
    });
  } else {
    data = bufferData.toString();
    callback(null, data);
  }
}

proxy.on('proxyRes', function (proxyRes, req, res) {
  console.log(proxyRes.headers)

  var body = [];
  var encoding = proxyRes.headers['content-encoding'];

  if (proxyRes.headers['content-type'].includes('text/html')) {
    // 非gzip/deflate要转成utf-8格式
    if (encoding === 'undefined') {
      proxyRes.setEncoding('utf-8');
    }
  }

  proxyRes.on('data', function (chunk) {
    body.push(chunk);
  });

  proxyRes.on('end', function () {
    const bufferData = Buffer.concat(body)
    if (proxyRes.headers['content-type'].includes('text/html')) {
      decodeHandler(encoding, bufferData, function (err, data) {
        var reg = /((http|https):\/\/)?[\w\-_]+(\.[\w\-_]+)+([\w\-\.,@?^=%&amp;:/~\+#]*[\w\-\@?^=%&amp;/~\+#])?/g;
        data = data.replace(reg, function (a) {
          const schema = a.includes('https') ? 'https://' : 'http://'
          const oldHost = a.split('/')[2]
          const newHost = 'map' + hostMapIndex + '-map.dev.y-bi.top'
          hostMapIndex++
          hostMap.set(newHost, {
            schema,
            host: oldHost
          })

          if (SCHEMA === 'http') {
            a = a.replace('https://', 'http://')
          } else {
            a = a.replace('http://', 'https://')
          }
          return a.replace(oldHost, newHost)
        })

        res.end(data);
      })
    } else {
      res.end(bufferData.toString());
    }
  });
})

proxy.on('error', function (e) {
  console.error(e)
})

proxyOther.on('error', function (e) {
  console.error(e)
})

function main(req, res) {
  const host = req.headers['host'].split(':')[0]
  const otherTarget = hostMap.get(host)
  console.log(host, otherTarget)
  if (host === 'home-map.dev.y-bi.top') {
    proxy.web(req, res, {
      target: 'https://map.baidu.com',
      secure: false,
      changeOrigin: true,
      selfHandleResponse: true,
      cookieDomainRewrite: {
        "*": "home-map.dev.y-bi.top"
      }
    })
  } else if (otherTarget) {
    console.log(otherTarget)
    proxyOther.web(req, res, {
      target: otherTarget.schema + otherTarget.host,
      secure: false,
      changeOrigin: true
    })
  }
}