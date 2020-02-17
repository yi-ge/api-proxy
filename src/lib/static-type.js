export default (endTag) => {
  var type = null
  switch (endTag) {
    case 'html' :
    case 'htm' :
      type = 'text/html; charset=UTF-8'
      break
    case 'js' :
      type = 'application/javascript; charset="UTF-8"'
      break
    case 'css' :
      type = 'text/css; charset="UTF-8"'
      break
    case 'txt' :
      type = 'text/plain; charset="UTF-8"'
      break
    case 'gif' :
      type = 'image/gif; charset="UTF-8"'
      break
    case 'manifest' :
      type = 'text/cache-manifest; charset="UTF-8"'
      break
    case 'ico' :
      type = 'image/x-icon; charset="UTF-8"'
      break
    case 'jpg' :
    case 'jpeg' :
      type = 'image/jpeg; charset="UTF-8"'
      break
    case 'pdf' :
      type = 'application/pdf; charset="UTF-8"'
      break
    case 'png' :
      type = 'image/png; charset="UTF-8"'
      break
    case 'svg' :
      type = 'image/svg+xml; charset="UTF-8"'
      break
    default :
      type = 'application/octet-stream'
      break
  }
  return type
}
