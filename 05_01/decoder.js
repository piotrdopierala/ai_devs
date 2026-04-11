// 05_01/decoder.js
export function decodeAttachment(base64, meta) {
  const mimeType = (meta || '').split(';')[0].trim().toLowerCase()

  if (mimeType === 'application/json' || mimeType.startsWith('text/')) {
    const content = Buffer.from(base64, 'base64').toString('utf8')
    return {type: 'text', content}
  }

  if (mimeType.startsWith('image/')) {
    return {type: 'image', base64, mimeType}
  }

  if (mimeType.startsWith('audio/')) {
    return {type: 'audio', base64, mimeType}
  }

  return {type: 'skip'}
}
