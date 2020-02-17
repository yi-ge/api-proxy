import fs from 'fs'
import path from 'path'
import vm from 'vm'
import uuid from 'uuid'
import getJsonBody from './lib/json.js'
import userMap from './lib/user-map.js'
import {
  fileURLToPath
} from 'url'

try {
  // eslint-disable-next-line
  global.__filename = fileURLToPath(
    import.meta.url)
} catch (err) {
  console.error(err)
}

global.__dirname = path.dirname(__filename)

const USER_PATH = path.join(__dirname, '../user')

const jsonHeader = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, Token, x-access-token'
}

const parseBody = async (req, res, auth) => {
  if (req.method !== 'POST') {
    const body = JSON.stringify({
      err: 'Unsupported method.'
    })
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
    return false
  }

  if (auth) {
    let success = false
    if (req.headers['authorization']) {
      const token = req.headers['authorization'].replace('Custom ', '')
      const r = userMap.get(token)

      if (r && r.username) {
        req.username = r.username
        success = true
      }
    }

    if (!success) {
      const body = JSON.stringify({
        err: 'No Auth.'
      })
      jsonHeader['Content-Length'] = Buffer.byteLength(body)
      res.writeHead(403, jsonHeader)
      res.write(body)
      res.end()
      return false
    }
  }

  let jsonBody = null
  try {
    jsonBody = await getJsonBody(req)
  } catch (err) {
    jsonBody = {}
    console.log(err)
  }
  // console.log(jsonBody)

  req.body = jsonBody
  return true
}

export default {
  async login(req, res) {
    const pass = await parseBody(req, res, false)
    if (!pass) return

    const jsonBody = req.body
    const configData = fs.readFileSync(path.join(USER_PATH, 'config.js'), 'utf8')
    const content = {
      status: 0,
      msg: '用户名或密码不正确'
    }

    let config = null

    try {
      const context = {}
      const script = new vm.Script(configData)

      script.runInNewContext(context)

      config = context.main()
    } catch (err) {
      console.log(err)
    }

    const users = config.users
    const user = users.find(item => item.username === jsonBody.username && item.password === jsonBody.password)

    if (user) {
      content.status = 1
      content.token = Buffer.from(uuid.v4()).toString('base64')
      delete content.msg
      userMap.set(content.token, {
        username: jsonBody.username,
        created_time: new Date().getTime()
      })
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async getJobList(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const content = {
      status: 0,
      msg: '未知错误'
    }

    const files = fs.readdirSync(path.join(USER_PATH, 'job'))

    content.status = 1
    delete content.msg
    content.result = files

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async getJob(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const jsonBody = req.body

    const content = {
      status: 0,
      msg: '未知错误'
    }

    const filename = jsonBody.filename
    if (!filename.includes('/') && !filename.includes('..') && /^(?!\.)[^\\\/:\*\?"<>\|]{1,255}$/.test(filename)) {
      const filePath = path.join(USER_PATH, 'job', filename)
  
      try {
        if (fs.existsSync(filePath)) {
          content.result = fs.readFileSync(filePath, 'utf8')
          content.status = 1
          delete content.msg
        } else {
          content.status = -1
          content.msg = '文件不存在'
        }
      } catch (err) {
        console.log(err)
      }
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async getTemplate(req, res) {
    const configData = fs.readFileSync(path.join(USER_PATH, 'template.js'), 'utf8')
    let filename = '新建任务.js'
    let filePath = path.join(USER_PATH, 'job', filename)
    let index = 1

    while (fs.existsSync(filePath) || fs.existsSync(filePath.replace('.js', '.disabled.js'))) {
      filename = '新建任务' + (index++) + '.js'
      filePath = path.join(USER_PATH, 'job', filename)
    }

    fs.writeFileSync(filePath, configData, 'utf8')

    const content = {
      status: 1,
      result: {
        content: configData,
        filename
      }
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async setJob(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const jsonBody = req.body

    const content = {
      status: 0,
      msg: '未知错误'
    }

    try {

      const filename = jsonBody.filename
      if (!filename.includes('/') && !filename.includes('..') && /^(?!\.)[^\\\/:\*\?"<>\|]{1,255}$/.test(filename)) {
        const filePath = path.join(USER_PATH, 'job', filename)
        fs.writeFileSync(filePath, jsonBody.content, 'utf8')

        if (jsonBody.newFilename && !jsonBody.newFilename.includes('/') && !jsonBody.newFilename.includes('..') && /^(?!\.)[^\\\/:\*\?"<>\|]{1,255}$/.test(jsonBody.newFilename)) {
          fs.renameSync(path.join(USER_PATH, 'job', jsonBody.filename), path.join(USER_PATH, 'job', jsonBody.newFilename))
        }

        content.status = 1
        delete content.msg
      }

    } catch (err) {
      console.log(err)
      content.status = -1
      content.msg = '任务名称不合法，请遵守文件名命名规则。'
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async disableJob(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const jsonBody = req.body

    const content = {
      status: 0,
      msg: '未知错误'
    }

    if (jsonBody.filename.includes('.disabled.js')) {
      content.status = -1
      content.msg = '该任务已被禁用'
    } else {
      try {
        fs.renameSync(path.join(USER_PATH, 'job', jsonBody.filename), path.join(USER_PATH, 'job', jsonBody.filename.replace('.js', '.disabled.js')))
        content.status = 1
        delete content.msg
      } catch (err) {
        console.log(err)
      }
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async enableJob(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const jsonBody = req.body

    const content = {
      status: 0,
      msg: '未知错误'
    }

    if (!jsonBody.filename.includes('.disabled.js')) {
      content.status = -1
      content.msg = '该任务已被启用'
    } else {
      try {
        fs.renameSync(path.join(USER_PATH, 'job', jsonBody.filename), path.join(USER_PATH, 'job', jsonBody.filename.replace('.disabled.js', '.js')))
        content.status = 1
        delete content.msg
      } catch (err) {
        console.log(err)
      }
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async deleteJob(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const jsonBody = req.body

    const content = {
      status: 0,
      msg: '未知错误'
    }

    const filename = jsonBody.filename
    if (!filename.includes('/') && !filename.includes('..') && /^(?!\.)[^\\\/:\*\?"<>\|]{1,255}$/.test(filename)) {
      const filePath = path.join(USER_PATH, 'job', filename)
  
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath)
          content.status = 1
          delete content.msg
        }
      } catch (err) {
        console.log(err)
      }
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async getConfig(req, res) {
    const configData = fs.readFileSync(path.join(USER_PATH, 'config.js'), 'utf8')

    const content = {
      status: 1,
      result: configData
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  },

  async setConfig(req, res) {
    const auth = await parseBody(req, res, true)
    if (!auth) return

    const jsonBody = req.body

    const content = {
      status: 0,
      msg: '未知错误'
    }

    if (jsonBody.content) {
      let config = null

      try {
        const context = {}
        const script = new vm.Script(jsonBody.content)

        script.runInNewContext(context)

        config = context.main()
      } catch (err) {
        console.log(err)
      }

      global.manageDomain = config.manageDomain

      fs.writeFileSync(path.join(USER_PATH, 'config.js'), jsonBody.content, 'utf8')
      content.status = 1
      delete content.msg
    }

    const body = JSON.stringify(content)
    jsonHeader['Content-Length'] = Buffer.byteLength(body)
    res.writeHead(200, jsonHeader)
    res.write(body)
    res.end()
  }
}