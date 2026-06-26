// CloudFront Function (viewer-request): SPA ルーティング
// CustomErrorResponses の 404→index.html 変換は /api/* の JSON 404 も壊すため、こちらで代替する。
function handler(event) {
  var request = event.request
  var uri = request.uri

  if (
    uri.startsWith('/api/') ||
    uri.startsWith('/ws/') ||
    uri.startsWith('/health') ||
    uri.startsWith('/internal/') ||
    uri.startsWith('/assets/') ||
    uri.startsWith('/images/') ||
    uri.indexOf('.') !== -1
  ) {
    return request
  }

  request.uri = '/index.html'
  return request
}
