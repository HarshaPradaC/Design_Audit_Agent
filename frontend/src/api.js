import axios from 'axios'

const api = axios.create({ baseURL: '' })

export async function analyzeLevel1(file, onProgress) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/analyze/level1', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => onProgress && onProgress(Math.round(e.loaded / e.total * 20)),
  })
  return data
}

export async function analyzeLevel2(before, after) {
  const form = new FormData()
  form.append('before', before)
  form.append('after', after)
  const { data } = await api.post('/analyze/level2', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function startMonitor(config) {
  const { data } = await api.post('/monitor/start', config)
  return data
}

export async function getMonitorStatus(runId) {
  const { data } = await api.get(`/monitor/status/${runId}`)
  return data
}

export async function refreshBaseline(pageName) {
  const { data } = await api.post(`/baseline/refresh/${pageName}`)
  return data
}

export function createProgressSocket(runId, onEvent) {
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const ws = new WebSocket(`${protocol}://${location.host}/ws/${runId}`)
  ws.onmessage = (e) => onEvent(JSON.parse(e.data))
  ws.onerror = (e) => console.error('WS error', e)
  return ws
}
