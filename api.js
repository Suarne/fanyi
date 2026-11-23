export const API_BASE_URL = (globalThis.WENYAN_API_BASE_URL || 'https://wenyan-grading-eiptkmuegs.cn-hangzhou.fcapp.run').replace(/\/$/, '');
const DEFAULT_TIMEOUT = 45000;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest(path, {
  method = 'GET',
  body,
  learningCode,
  timeout = DEFAULT_TIMEOUT,
  fetchImpl = globalThis.fetch
} = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (learningCode) headers.Authorization = `Bearer ${learningCode}`;
  let response;
  try {
    response = await fetchImpl(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError(504, 'TIMEOUT', '批改服务超时，请稍后手动重试');
    }
    throw new ApiError(0, 'NETWORK_ERROR', '无法连接服务，请检查网络后重试');
  } finally {
    clearTimeout(timer);
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) throw new ApiError(502, 'INVALID_RESPONSE', '服务返回了无法识别的内容');
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code || 'REQUEST_FAILED',
      payload?.error?.message || (response.status === 429 ? '今日或当前时段额度已用完，请稍后再试' : '服务暂时不可用，请稍后重试')
    );
  }
  return payload;
}

export function gradeTranslation(input, options) {
  return apiRequest('/api/grade', { ...options, method: 'POST', body: input });
}

export function createLearner(options) {
  return apiRequest('/api/learners', { ...options, method: 'POST', body: {} });
}

export function getWrongbook(learningCode, options) {
  return apiRequest('/api/wrongbook', { ...options, learningCode });
}

export function putWrongItem(learningCode, questionId, item, version, options) {
  return apiRequest(`/api/wrongbook/${encodeURIComponent(questionId)}`, {
    ...options,
    method: 'PUT',
    learningCode,
    body: { ...item, ...(version === null || version === undefined ? {} : { version }) }
  });
}

export function deleteWrongItem(learningCode, questionId, version, options) {
  return apiRequest(`/api/wrongbook/${encodeURIComponent(questionId)}`, {
    ...options,
    method: 'DELETE',
    learningCode,
    body: version === null || version === undefined ? {} : { version }
  });
}

export function clearWrongbook(learningCode, version, options) {
  return apiRequest('/api/wrongbook', {
    ...options,
    method: 'DELETE',
    learningCode,
    body: version === null || version === undefined ? {} : { version }
  });
}
