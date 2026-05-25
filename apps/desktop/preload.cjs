const { contextBridge } = require('electron')

const getArgValue = (prefix) => {
  const arg = process.argv.find((item) => item.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : ''
}

contextBridge.exposeInMainWorld('__PILINOTE_RUNTIME__', {
  apiBaseUrl: getArgValue('--pilinote-api-base-url='),
  wsBaseUrl: getArgValue('--pilinote-ws-base-url=')
})
