
import fs from 'fs'
import path from 'path'
import vm from 'vm'
import uuid from 'uuid'
import url from 'url'
import httpProxy from 'http-proxy'
import userMap from './lib/user-map.js'
import SocketIO from 'socket.io'
import dayjs from 'dayjs'
import axios from 'axios'
import request from 'request'
import parse from 'co-body'
import zlib from 'zlib'
import querystring from 'querystring'

const USER_PATH = path.join(__dirname, '../user')
const jobMap = new Map();

const container = async (io, socket, server) => {
  socket.on('runJob', function (data) {
    const filename = data.filename
    if (!filename.includes('/') && !filename.includes('..') && /^(?!\.)[^\\\/:\*\?"<>\|]{1,255}$/.test(filename)) {
      const jobFunction = jobMap.get(filename)
      if (jobFunction) {
        server.removeListener('request', jobFunction)
      }

      const filePath = path.join(USER_PATH, 'job', filename)
      let code = ''

      try {
        if (fs.existsSync(filePath)) {
          code = fs.readFileSync(filePath, 'utf8')

          const context = {
            DOMAIN: null,
            SCHEMA: 'http',
            manageDomain: global.manageDomain,
            httpProxy,
            axios,
            request,
            path,
            uuid,
            dayjs,
            url,
            parse,
            Buffer,
            zlib,
            querystring,
            console: {
              log(...message) {
                socket.emit('add', message.join(' ') + '\n');
                console.log.apply(console, arguments);
              },
              error(...message) {
                socket.emit('add', '\x1B[1;3;31m' + message.join(' ') + '\x1B[0m\n');
                console.error.apply(console, arguments);
              },
              info(...message) {
                socket.emit('add', '\x1B[1;3;32m' + message.join(' ') + '\x1B[0m\n');
                console.info.apply(console, arguments);
              },
              warn(...message) {
                socket.emit('add', '\x1B[1;3;34m' + message.join(' ') + '\x1B[0m\n');
                console.warn.apply(console, arguments);
              },
              debug(...message) {
                socket.emit('add', '\x1B[1;3;36m' + message.join(' ') + '\x1B[0m\n');
                console.debug.apply(console, arguments);
              }
            }
          }
          const script = new vm.Script(code)

          script.runInNewContext(context)

          const requestFunction = (request, response) => {
            const host = request.headers['host'].split(':')[0]
            if (global.manageDomain !== host) {
              const domain = context.DOMAIN
              let reg = ''
              if (!domain) {
                socket.emit('add', '未设置域名。\n')
                return
              }

              if (domain.split('*') > 2) {
                socket.emit('add', '只支持单个变量的泛解析域名。\n')
                return
              }

              if (domain.includes('*')) {
                reg = domain
                reg = reg.replace('*', '^([0-9a-z][0-9a-z-]{0,61})?[0-9a-z]')
                reg = reg.split('.').join('\.')
                reg = new RegExp(reg, "ig")
              }

              if (host === domain || (domain.includes('*') && reg.test(host))) {
                socket.emit('add', '\x1B[1;3;33m' + dayjs().format('YYYY-MM-DD HH:mm:ss') + '\x1B[0m ' + request.url + '\n')
                try {
                  context.main(request, response)
                } catch (err) {
                  socket.emit('add', '\n\x1B[1;3;31mError:\x1B[0m\n')
                  // socket.emit('add', err.message + '\n')
                  socket.emit('add', err.stack + '\n')
                }
              }
            }
          }

          jobMap.set(filename, requestFunction)

          server.addListener('request', requestFunction)

          socket.emit('show', dayjs().format('YYYY-MM-DD HH:mm:ss') + ' - ')
          socket.emit('add', filename.replace('.js', '') + ' 任务成功运行。\n')
        } else {
          socket.emit('show', '任务文件不存在\n')
        }
      } catch (err) {
        console.log(err)
      }
    }
  })

  socket.on('stopJob', function(data) {
    const jobFunction = jobMap.get(data.filename)
    if (jobFunction) {
      server.removeListener('request', jobFunction)
    }

    socket.emit('show', '该任务已停止。\n')
  })
}

export default (server) => {
  const io = SocketIO(server)

  io.on('connection', function (socket) {
    console.log('One user connected - ' + socket.id)
    socket.on('auth', function (authorization) {
      if (authorization) {
        const token = authorization.replace('Custom ', '')
        const r = userMap.get(token)
  
        if (r && r.username) {
          container(io, socket, server)
          socket.emit('auth', 'success')
          return
        }
      }

      socket.emit('auth', 'fail')
      socket.removeAllListeners('runJob')
      socket.removeAllListeners('stopJob')
    })
  })
}

