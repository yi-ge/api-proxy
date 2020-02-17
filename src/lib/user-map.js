import fs from 'fs'
import path from 'path'
import {
  fileURLToPath
} from 'url'

let __filename = null
try {
  // eslint-disable-next-line
  __filename = fileURLToPath(
    import.meta.url)
} catch (err) {
  console.error(err)
}

const __dirname = path.dirname(__filename)

const WORK_PATH = path.join(__dirname, '../../user')

const writeCacheFile = (data) => {
  fs.writeFileSync(path.join(WORK_PATH, 'cache.json'), data, 'utf8')
}

const readCacheFile = () => {
  const filePath = path.join(WORK_PATH, 'cache.json')

  if (!fs.existsSync(filePath)) {
    const tmp = new Map()
    writeCacheFile(JSON.stringify([...tmp]))
  }

  return fs.readFileSync(filePath, 'utf8')
}

class UserMap extends Map {
  set (...args) {
    super.set(...args)
    writeCacheFile(JSON.stringify([...this]))
  }
}

const userMap = new UserMap(JSON.parse(readCacheFile()))

const checkUserAuthCron = () => {
  setInterval(function () {
    userMap.forEach((item, key) => {
      if (new Date().getTime() - item.created_time > 3600 * 1000) {
        userMap.delete(key)
        writeCacheFile(JSON.stringify([...userMap]))
      }
    })
  }, 3600 * 1000)
}

checkUserAuthCron()

export default userMap
