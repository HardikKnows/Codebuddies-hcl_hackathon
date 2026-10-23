import { api, cleanParams, downloadFile, unwrap } from './client'

const importForm = (file, updateExisting) => {
  const form = new FormData()
  form.append('file', file)
  form.append('updateExisting', updateExisting ? 'true' : 'false')
  return form
}

export const authApi = {
  login: (email, password) => api.post('/auth/login', { email, password }, { skipAuthRedirect: true }).then(unwrap),
  me: () => api.get('/auth/me').then(unwrap),
  updateProfile: (body) => api.patch('/profile', body).then(unwrap),
}

export const catalogApi = {
  categories: () => api.get('/categories').then(unwrap),
  brands: () => api.get('/brands').then(unwrap),
  stores: () => api.get('/stores').then(unwrap),
  products: (params) => api.get('/products', { params: cleanParams(params) }).then(unwrap),
  product: (sku, storeId) => api.get(`/products/${encodeURIComponent(sku)}`, { params: cleanParams({ storeId }) }).then(unwrap),
}

export const ordersApi = {
  quote: (body) => api.post('/cart/quote', body).then(unwrap),
  place: (body) => api.post('/orders', body).then(unwrap),
  mine: (params) => api.get('/orders', { params: cleanParams(params) }).then(unwrap),
  get: (orderNumber) => api.get(`/orders/${encodeURIComponent(orderNumber)}`).then(unwrap),
}

export const ticketsApi = {
  list: (params) => api.get('/tickets', { params: cleanParams(params) }).then(unwrap),
  create: (body) => api.post('/tickets', body).then(unwrap),
  update: (ticketNumber, body) => api.patch(`/tickets/${encodeURIComponent(ticketNumber)}`, body).then(unwrap),
}

export const opsApi = {
  summary: () => api.get('/ops/summary').then(unwrap),
  inventory: (params) => api.get('/ops/inventory', { params: cleanParams(params) }).then(unwrap),
  simulate: (body) => api.post('/ops/inventory/simulated-events', body).then(unwrap),
  adjustStock: (body) => api.post('/ops/inventory/adjustments', body).then(unwrap),
  orders: (params) => api.get('/ops/orders', { params: cleanParams(params) }).then(unwrap),
  audit: (params) => api.get('/audit-events', { params: cleanParams(params) }).then(unwrap),
  documents: () => api.get('/knowledge/documents').then(unwrap),
}

// kind: 'products' | 'inventory'. Preview validates and changes nothing; apply re-validates on the server.
export const dataApi = {
  previewImport: (kind, file, updateExisting) => api.post(`/ops/imports/${kind}/preview`, importForm(file, updateExisting)).then(unwrap),
  applyImport: (kind, file, updateExisting) => api.post(`/ops/imports/${kind}`, importForm(file, updateExisting)).then(unwrap),
  exportCatalog: () => downloadFile('/ops/exports/catalog.csv'),
  exportInventory: (params) => downloadFile('/ops/exports/inventory.csv', params),
}

export const assistantApi = {
  chat: (body) => api.post('/assistant/chat', body).then(unwrap),
  recommend: (body) => api.post('/assistant/recommendations', body).then(unwrap),
  policy: (body) => api.post('/assistant/policy-answers', body).then(unwrap),
  confirmAction: (id) => api.post(`/actions/${encodeURIComponent(id)}/confirm`).then(unwrap),
  cancelAction: (id) => api.post(`/actions/${encodeURIComponent(id)}/cancel`).then(unwrap),
}
