export function getFileSize(bytes: number) {
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const unit = sizes[i]

  if (i === 0) return `${bytes} ${unit}`

  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${unit}`
}
