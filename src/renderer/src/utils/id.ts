export const createId = (prefix = 'id'): string => {
  const value =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2, 10)

  return `${prefix}-${value}`
}
