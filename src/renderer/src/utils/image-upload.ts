export const readImageFileAsDataUrl = async (
  file: File,
  options?: {
    maxBytes?: number
  }
): Promise<string> => {
  const maxBytes = options?.maxBytes ?? 3_000_000

  if (!file.type.startsWith('image/')) {
    throw new Error('Lütfen görsel formatında bir dosya seç.')
  }

  if (file.size > maxBytes) {
    throw new Error('Seçtiğin görsel çok büyük. Lütfen 3 MB altındaki bir dosya kullan.')
  }

  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }

      reject(new Error('Görsel okunamadı. Lütfen farklı bir dosya dene.'))
    }

    reader.onerror = () => {
      reject(new Error('Görsel okunamadı. Lütfen farklı bir dosya dene.'))
    }

    reader.readAsDataURL(file)
  })
}
