export function friendlyStockAdjustmentError(message: string): string {
  if (
    message.includes('quantity negative') ||
    message.includes('Stock adjustment would make')
  ) {
    return 'That adjustment would bring quantity below zero. No changes were made.'
  }
  if (message.includes('Part not found')) {
    return 'Part not found.'
  }
  return message
}
