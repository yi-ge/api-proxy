import fs from 'fs'
import path from 'path'
import http from 'http'
import {
  URL, fileURLToPath
} from 'url'

import staticType from './lib/static-type.js'
import module from './module.js'
import runtime from './runtime.js'
import vm from 'vm'

try {
  // eslint-disable-next-line
  global.__filename = fileURLToPath(
    import.meta.url)
} catch (err) {
  console.error(err)
}

global.__dirname = path.dirname(__filename)

let PORT = process.env.PORT || 80 // 测试环境监听端口5050
const isDev = process.env.NODE_ENV ? process.env.NODE_ENV === 'development' : false
const server = new http.Server()
const baseURL = path.join(__dirname, './ui')
const USER_PATH = path.join(__dirname, '../user')

const configData = fs.readFileSync(path.join(USER_PATH, 'config.js'), 'utf8')
let config = null

try {
  const context = {}
  const script = new vm.Script(configData)

  script.runInNewContext(context)

  config = context.main()
} catch (err) {
  console.log(err)
}

global.manageDomain = config.manageDomain

// 使用on方法注册时间处理
server.on('request', async function (request, response) {
  const host = request.headers['host'].split(':')[0]
  if (global.manageDomain === host) {
    // 解析请求的URL
    if (request.url.includes('/api') && isDev) console.log('request' + request.url)
    // 特殊URL会让服务器在发送响应前先等待,模拟路由
    switch (request.url) {
      case '' || '/': // 模拟欢迎页,nodejs是高效流处理的方案,也可以通过配置文件来配置
        fs.readFile(path.join(baseURL, 'index.html'), function (err, content) {
          if (err) {
            response.writeHead(404, {
              'Content-Type': 'text/plain; charset="UTF-8"',
              'Content-Length': Buffer.byteLength(err.message)
            })
            response.write(err.message)
            response.end()
          } else {
            response.writeHead(200, {
              'Content-Type': 'text/html; charset=UTF-8',
              'Content-Length': Buffer.byteLength(content)
            })
            response.write(content)
            response.end()
          }
        })
        break
      case '/api/login':
        return module.login(request, response)
      case '/api/getJobList':
        return module.getJobList(request, response)
      case '/api/getJob':
        return module.getJob(request, response)
      case '/api/getTemplate':
        return module.getTemplate(request, response)
      case '/api/setJob':
        return module.setJob(request, response)
      case '/api/disableJob':
        return module.disableJob(request, response)
      case '/api/enableJob':
        return module.enableJob(request, response)
      case '/api/deleteJob':
        return module.deleteJob(request, response)
      case '/api/getConfig':
        return module.getConfig(request, response)
      case '/api/setConfig':
        return module.setConfig(request, response)
      default: // 处理来自本地目录的文件
        var filename = request.url.substring(1) // 去掉前导'/'
        var type = staticType(filename.substring(filename.lastIndexOf('.') + 1))
        // 异步读取文件,并将内容作为单独的数据模块传给回调函数
        // 对于确实很大的文件,使用流API fs.createReadStream()更好
        fs.readFile(path.join(baseURL, filename), function (err, content) {
          if (err) {
            response.writeHead(404, {
              'Content-Type': 'text/plain; charset="UTF-8"',
              'Content-Length': Buffer.byteLength(err.message)
            })
            response.write(err.message)
            response.end()
          } else {
            response.writeHead(200, {
              'Content-Type': type,
              'Content-Length': Buffer.byteLength(content)
            })
            response.write(content)
            response.end()
          }
        })
        break
    }
  }
})

runtime(server)

server.listen(PORT, function() {
  console.log('Server running at port: ' + PORT)
})
