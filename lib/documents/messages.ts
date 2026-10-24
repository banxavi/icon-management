import { messages } from '@/lib/messages'

export function mapDocumentError(message: string): string {
  if (message.includes('FILE_TYPE')) return messages.fileType
  if (message.includes('FILE_TOO_LARGE') || message.includes('FILE_EMPTY')) return messages.fileTooLarge
  if (message.includes('FOLDER_FORBIDDEN') || message.includes('UNAUTHENTICATED')) return messages.folderForbidden
  if (message.includes('NAME_REQUIRED')) return messages.documentName
  if (message.includes('TOO_MANY_TAGS')) return messages.tooManyTags
  if (message.includes('UPLOAD_MISSING')) return messages.uploadMissing
  if (message.includes('NOT_FOUND')) return messages.documentMissing
  if (message.includes('VISIBILITY_INVALID')) return messages.folderVisibility
  if (/duplicate key|document_folders_team_name/i.test(message)) return messages.folderExists
  return messages.saveFailed
}
