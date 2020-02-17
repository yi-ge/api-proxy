require.config({
  paths: {
    vs: 'monaco-editor/min/vs'
  }
})

function formatDate (t) {
  var date = new Date(t)
  var YY = date.getFullYear() + '-'
  var MM = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '-'
  var DD = (date.getDate() < 10 ? '0' + (date.getDate()) : date.getDate())
  var hh = (date.getHours() < 10 ? '0' + date.getHours() : date.getHours()) + ':'
  var mm = (date.getMinutes() < 10 ? '0' + date.getMinutes() : date.getMinutes()) + ':'
  var ss = (date.getSeconds() < 10 ? '0' + date.getSeconds() : date.getSeconds())
  return YY + MM + DD + ' ' + hh + mm + ss
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  var k = 1024;
  var dm = decimals < 0 ? 0 : decimals;
  var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  var i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function debounce(func, wait, immediate) {
  var time
  var debounced = function() {
      var context = this
      if(time) clearTimeout(time)

      if(immediate) {
          var callNow = !time
          if(callNow) func.apply(context, arguments)
          time = setTimeout(
              ()=>{time = null} //见注解
          , wait)
      } else {
          time = setTimeout(
              ()=>{func.apply(context, arguments)}
          , wait) 
      }
  }

  debounced.cancel = function() {
      clearTimeout(time)
      time = null
  }

  return debounced
}

$(document).ready(function () {
  $('body').loading()
  window.editorReady = false

  var socket = io();
  Terminal.applyAddon(attach);
  Terminal.applyAddon(fit);
  const term = new Terminal({
    useStyle: true,
    convertEol: true,
    screenKeys: true,
    cursorBlink: false,
    visualBell: true,
    colors: Terminal.xtermColors
  });
  window.term = term;
  window.socket = socket;

  var terminalDom = document.getElementById('terminal');

  socket.on('auth', (data) => {
    if (data === 'success') {
      term.clear();
      term.write('Welcome \x1B[1;3;31mAPI-Proxy\x1B[0m ! \n');
    } else {
      term.clear();
      term.write('Auth fail. \n');
    }
  })

  socket.on('show', (data) => {
    term.clear();
    term.write(data);
  })

  socket.on('add', (data) => {
    term.write(data);
  })

  term.open(terminalDom);
  term.fit();
  term.write('Verifying... Please wait ...\n');

  require(['vs/editor/editor.main'], function () {
    window.editorReady = true
  })

  // tip是提示信息，type:'success'是成功信息，'danger'是失败信息,'info'是普通信息,'warning'是警告信息
  var ShowTip = function (tip, type) {
    var $tip = $('#tip')
    if ($tip.length === 0) {
      $tip = $('<span id="tip" style="position:fixed;top:50px;left: 50%;z-index:9999;height: 35px;padding: 0 20px;line-height: 35px;"></span>')
      $('body').append($tip)
    }
    $tip.stop(true).prop('class', 'alert alert-' + type).text(tip).css('margin-left', -$tip.outerWidth() / 2).fadeIn(500).delay(2000).fadeOut(500)
  }

  var updateCurrentToolBtnStatus = function () {
    setTimeout(function () {
      var filename = $('#editor-title').val()
      $('.file').each(function() {
        if ($(this).text() === filename) {
          if ($(this).hasClass('disabled-job')) {
            $('#disable-job').hide()
            $('#enable-job').show()
          } else {
            $('#disable-job').show()
            $('#enable-job').hide()
          }
        }
      })
    })
  }

  var getJob = function (filename) {
    $('#editor').loading()
    var isDisabled = false
    $('.file').each(function() {
      if ($(this).text() === filename) {
        if ($(this).hasClass('disabled-job')) {
          isDisabled = true
        }
        $(this).addClass('active')
      } else {
        $(this).removeClass('active')
      }
    })

    $('#editor-title').val(filename)
    window.currentFilename = filename
    filename += (isDisabled ? '.disabled' : '') + '.js'

    updateCurrentToolBtnStatus()

    var waitingEditor = function () {
      setTimeout(() => {
        if (window.editorReady === true) {
          if (!window.codeEditor) {
            window.$codeEditor = $('#container-editor')
            window.$codeEditor.empty()
            window.codeEditor = monaco.editor.create(window.$codeEditor[0], {
              value: '',
              language: 'javascript'
            })
          }

          $.post({
            url: '/api/getJob',
            headers: {
              Authorization: 'Custom ' + window.localStorage.token
            },
            data: JSON.stringify({
              filename: filename
            }),
            success (data) {
              if (data.status === 1) {
                window.currentCode = data.result
                window.codeEditor.setValue(data.result)
                window.codeEditor.layout()
              } else {
                ShowTip(data.msg, 'warning')
              }

              $('#editor').loading('stop')
            }
          })
        } else {
          waitingEditor()
        }
      }, 50)
    }

    waitingEditor()
  }

  var login = function () {
    $.post({
      url: '/api/login',
      dataType: 'json',
      contentType: 'application/json',
      data: JSON.stringify({
        username: $('#inputUsername').val(),
        password: $('#inputPassword').val()
      }),
      success(data) {
        if (data.status === 1) {
          window.localStorage.token = data.token
          $('#login').modal('hide')
          getJobList()
        } else {
          ShowTip(data.msg, 'warning')
        }
      }
    })
  }

  var init = function () {
    var $lastFile = null

    $('.file').hover(function () {
      $lastFile = $(this)
      $('.files-control').css('top', $lastFile.position().top + 3).show()
    }, function() {
      $lastFile.removeAttr("style")
      $('.files-control').hide()
    })

    $('.files-control').hover(function () {
      $lastFile.css('background-color', 'aliceblue')
      $('.files-control').show()
    }, function() {
      $lastFile.removeAttr("style")
      $('.files-control').hide()
    })

    $('#files').scroll(debounce(function() {
      $('.files-control').hide()
    }, 50, true))

    $('#setting').unbind('shown.bs.modal')
    $('#setting').on('shown.bs.modal', function () {
      var waitingEditor = function () {
        setTimeout(() => {
          if (window.editorReady === true) {
            $.post({
              url: '/api/getConfig',
              headers: {
                Authorization: 'Custom ' + window.localStorage.token
              },
              success (data) {
                if (data.status === 1) {
                  window.$settingEditor = $('#container-setting')

                  window.$settingEditor.empty()

                  window.settingEditor = monaco.editor.create(window.$settingEditor[0], {
                    value: data.result,
                    language: 'javascript'
                  })

                  var manageDomain = ''

                  try {
                    manageDomain = /manageDomain: '(.*)'/.exec(data.result)

                    if (manageDomain && manageDomain[1]) {
                      window.manageDomain = manageDomain[1]
                    }
                  } catch (err) {
                    console.log(err)
                  }

                  window.settingEditor.layout()
                } else {
                  ShowTip(data.msg, 'warning')
                }

                $('#setting').loading('stop')
              }
            })
          } else {
            waitingEditor()
          }
        }, 50)
      }

      waitingEditor()
    })

    $('#setting-btn').off('click').click(function () {
      $('#setting').loading()
      $('#setting').modal('show')
    })

    $('#save-setting').off('click').click(function () {
      $.post({
        url: '/api/setConfig',
        headers: {
          Authorization: 'Custom ' + window.localStorage.token
        },
        dataType: 'json',
        contentType: 'application/json',
        data: JSON.stringify({
          content: window.settingEditor.getValue()
        }),
        success (data) {
          if (data.status === 1) {
            $('#setting').modal('hide')
            init()
            ShowTip('设置保存成功', 'success')

            var manageDomain = ''

            try {
              manageDomain = /manageDomain: '(.*)'/.exec(window.settingEditor.getValue())

              if (manageDomain && manageDomain[1]) {
                if (window.manageDomain !== manageDomain[1]) {
                  var port = ''
                  if (window.location.port && window.location.port !== '80') {
                    port = window.location.port
                  }
                  window.location.href = window.location.protocol + '//' + manageDomain[1] + ':' + port
                }
              }
            } catch (err) {
              console.log(err)
            }
          } else {
            ShowTip(data.msg, 'danger')
          }
        }
      })
    })

    $('#add-job').off('click').click(function () {
      $('#editor').loading()
      var waitingEditor = function () {
        setTimeout(() => {
          if (window.editorReady === true) {
            $.post({
              url: '/api/getTemplate',
              headers: {
                Authorization: 'Custom ' + window.localStorage.token
              },
              success (data) {
                if (data.status === 1) {
                  filename = data.result.filename
                  filename = filename.substr(0, filename.length - 3)
                  window.currentFilename = filename
                  $('#files').append('<div class="file">' + filename + '</div>\n')
                  $('#editor-title').val(filename)
                  $('.file').each(function() {
                    if ($(this).text() === filename) {
                      $(this).addClass('active')
                    } else {
                      $(this).removeClass('active')
                    }
                  })
                  window.codeEditor.setValue(data.result.content)
                  window.codeEditor.layout()

                  $('#disable-job').show()
                  $('#enable-job').hide()

                  ShowTip('创建成功', 'info')
                } else {
                  ShowTip(data.msg, 'warning')
                }

                $('#editor').loading('stop')
              }
            })
          } else {
            waitingEditor()
          }
        }, 50)
      }

      waitingEditor()
    })

    $('#logout').off('click').click(function () {
      window.localStorage.token = null
      $('#login').modal('show')
      socket.emit('auth', 'Custom ' + window.localStorage.token)
    })

    $('#open-doc-btn').off('click').click(function () {
      window.open('https://github.com/yi-ge/api-proxy')
    })

    $('.file').off('click').click(function () {
      if (window.currentCode && window.codeEditor && window.currentCode !== window.codeEditor.getValue() && confirm('是否放弃当前修改？')) {
        getJob($(this).text())
      } else if (window.currentCode && window.codeEditor && window.currentCode === window.codeEditor.getValue()) {
        getJob($(this).text())
      } else if (!window.currentCode || !window.codeEditor) {
        getJob($(this).text())
      }
    })

    $('#delete-job').off('click').click(function () {
      var isDisabled = false
      var filename = $lastFile.text()

      $('.file').each(function() {
        if ($(this).text() === filename) {
          if ($(this).hasClass('disabled-job')) {
            isDisabled = true
          }
        }
      })

      if (confirm('您确定要删除"' + filename + '"吗？')) {
        $.post({
          url: '/api/deleteJob',
          headers: {
            Authorization: 'Custom ' + window.localStorage.token
          },
          data: JSON.stringify({
            filename: filename + (isDisabled ? '.disabled.js' : '.js')
          }),
          success (data) {
            if (data.status === 1) {
              $('.file').each(function() {
                if ($(this).text() === filename) {
                  $(this).remove()
                }
              })

              if ($('#editor-title').val() === filename) {
                if ($('#files').children().first()) {
                  getJob($('#files').children().first().text())
                }
              }

              ShowTip('删除成功', 'success')
            } else {
              ShowTip(data.msg, 'warning')
            }
          }
        })
      }
    })

    $('#set-job').off('click').click(function () {
      var filename = $('#editor-title').val()
      var isDisabled = false

      $('.file').each(function() {
        if ($(this).text() === filename) {
          if ($(this).hasClass('disabled-job')) {
            isDisabled = true
          }
        }
      })

      $.post({
        url: '/api/setJob',
        headers: {
          Authorization: 'Custom ' + window.localStorage.token
        },
        data: JSON.stringify({
          filename: window.currentFilename + (isDisabled ? '.disabled' : '') + '.js',
          newFilename: window.currentFilename !== filename ? filename + (isDisabled ? '.disabled' : '') + '.js' : '',
          content: window.codeEditor.getValue()
        }),
        success (data) {
          if (data.status === 1) {

            if (window.currentFilename !== filename) {
              $('.file').each(function() {
                if ($(this).text() === window.currentFilename) {
                  $(this).text(filename)
                  window.currentFilename = filename
                }
              })
            }

            window.currentCode = window.codeEditor.getValue()

            ShowTip('保存成功', 'success')
          } else {
            ShowTip(data.msg, 'warning')
          }
        }
      })
    })

    $('#enable-job').off('click').click(function () {
      var filename = $('#editor-title').val()
      $.post({
        url: '/api/enableJob',
        headers: {
          Authorization: 'Custom ' + window.localStorage.token
        },
        data: JSON.stringify({
          filename: filename + '.disabled.js'
        }),
        success (data) {
          if (data.status === 1) {
            $('.file').each(function() {
              if ($(this).text() === filename) {
                $(this).removeClass('disabled-job')
              }
            })

            updateCurrentToolBtnStatus()

            $.toast({
              title: '启用成功',
              subtitle: 'now',
              content: '执行一次“运行”，该任务方可启动。',
              type: 'success',
              delay: 5000
            })
          } else {
            ShowTip(data.msg, 'warning')
          }
        }
      })
    })

    $('#disable-job').off('click').click(function () {
      var filename = $('#editor-title').val()
      var isDisabled = false

      $('.file').each(function() {
        if ($(this).text() === filename) {
          if ($(this).hasClass('disabled-job')) {
            isDisabled = true
          }
        }
      })
      
      var filename = $('#editor-title').val()
      socket.emit('stopJob', {
        filename: filename + '.js'
      })

      $.post({
        url: '/api/disableJob',
        headers: {
          Authorization: 'Custom ' + window.localStorage.token
        },
        data: JSON.stringify({
          filename: filename + '.js'
        }),
        success (data) {
          if (data.status === 1) {
            $('.file').each(function() {
              if ($(this).text() === filename) {
                $(this).addClass('disabled-job')
              }
            })

            updateCurrentToolBtnStatus()

            ShowTip('已禁用', 'success')
          } else {
            ShowTip(data.msg, 'warning')
          }
        }
      })
    })

    $('#run-job').off('click').click(function () {
      var filename = $('#editor-title').val()
      var isDisabled = false

      $('.file').each(function() {
        if ($(this).text() === filename) {
          if ($(this).hasClass('disabled-job')) {
            isDisabled = true
          }
        }
      })

      if (!isDisabled) {
        socket.emit('runJob', {
          filename: filename + '.js'
        })
      } else {
        ShowTip('当前任务已被禁用', 'danger')
      }
    })

    socket.emit('auth', 'Custom ' + window.localStorage.token)
  }

  var getJobList = function () {
    $.post({
      url: '/api/getJobList',
      headers: {
        Authorization: 'Custom ' + window.localStorage.token
      },
      success (data) {
        if (data.status === 1) {
          var files = data.result
          files.sort(function (a, b) {
            return b.includes('.disabled.js') ? -1 : 1
          })

          $('#files').empty()

          var filesHTML = ''
          for (var n = 0; n < files.length; n++) {
            if (files[n].includes('.disabled.js')) {
              filesHTML += '<div class="file disabled-job">' + files[n].substr(0, files[n].length - 12) + '</div>\n'
            } else {
              filesHTML += '<div class="file">' + files[n].substr(0, files[n].length - 3) + '</div>\n'
            }
          }

          $('#files').append(filesHTML)

          if (files.length > 0) {
            getJob(files[0].substr(0, files[0].length - 3))
          }
          
          init()
          $('body').loading('stop')
        } else {
          ShowTip(data.msg, 'warning')
        }
      },
      error (err) {
        if (err.status === 403) {
          $('body').loading('stop')
          $('#login').modal('show')
  
          window.localStorage.token = null
          return
        }
  
        console.log(err)
      }
    })
  }

  $('#login-btn').off('click').click(function () {
    login()
  })

  $('#inputPassword').keydown(function (event) {
    if (event.keyCode == 13) {
      login()
    }
  })

  var waitingEditor = function () {
    setTimeout(() => {
      if (window.editorReady === true) {
        if (!window.codeEditor) {
          window.$codeEditor = $('#container-editor')
          window.$codeEditor.empty()
          window.codeEditor = monaco.editor.create(window.$codeEditor[0], {
            value: '',
            language: 'javascript'
          })
        }
      } else {
        waitingEditor()
      }
    }, 100)
  }

  waitingEditor()

  getJobList()
})
