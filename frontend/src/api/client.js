import axios from 'axios'

const TOKEN_KEY = 'rp.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export class ApiError extends Error {
  constructor({ status = 0, code = 'UNKNOWN', message, details = {}, requestId = null }) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
    this.requestId = requestId
  }
}

const FALLBACK_MESSAGES = {
  400: 'The request was not valid.',
  401: 'Please sign in to continue.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  409: 'That conflicts with the current state. Please refresh and try again.',
  422: 'Some details are not valid.',
  503: 'This service is temporarily unavailable.',
}

export function normalizeError(error) {
  if (error instanceof ApiError) return error
  if (error?.response) {
    const { status, data } = error.response
    const body = data?.error
    return new ApiError({
      status,
      code: body?.code || `HTTP_${status}`,
      message: body?.message || FALLBACK_MESSAGES[status] || 'Something went wrong. Please try again.',
      details: body?.details || {},
      requestId: body?.requestId || null,
    })
  }
  if (error?.code === 'ECONNABORTED') {
    return new ApiError({ code: 'TIMEOUT', message: 'The request took too long. Please try again.' })
  }
  return new ApiError({
    code: 'NETWORK',
    message: "Can't reach the RetailPulse server. Check that the backend is running.",
  })
}

let unauthorizedHandler = null

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler
}

export const api = axios.create({ baseURL: '/api', timeout: 120000 })

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const normalized = normalizeError(error)
    if (normalized.status === 401 && !error.config?.skipAuthRedirect && unauthorizedHandler) {
      unauthorizedHandler(normalized)
    }
    return Promise.reject(normalized)
  },
)

/** Drops empty values so they never reach the query string. */
export function cleanParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  )
}

export const unwrap = (response) => response.data

/** Downloads a server-generated file (with the auth header) and saves it under the server's filename. */
export async function downloadFile(path, params) {
  // Accept every status so error bodies (which arrive as blobs here) can be read for a useful message.
  const response = await api.get(path, { params: cleanParams(params), responseType: 'blob', validateStatus: () => true })
  if (response.status !== 200) {
    let body = null
    try {
      body = JSON.parse(await response.data.text())
    } catch {
      // not a JSON error envelope
    }
    throw new ApiError({
      status: response.status,
      code: body?.error?.code || `HTTP_${response.status}`,
      message: body?.error?.message || FALLBACK_MESSAGES[response.status] || 'The download failed. Please try again.',
      details: body?.error?.details || {},
      requestId: body?.error?.requestId || null,
    })
  }
  const filename = /filename="([^"]+)"/.exec(response.headers['content-disposition'] || '')?.[1] || 'export.csv'
  const url = URL.createObjectURL(response.data)
  const link = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}
