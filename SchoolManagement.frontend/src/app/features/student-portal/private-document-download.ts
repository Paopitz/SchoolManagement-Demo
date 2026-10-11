/** Authenticated bytes only: never navigate to a public storage URL or render a PDF inline. */
export function downloadPrivateDocument(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = fileName || 'document'; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
