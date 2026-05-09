export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    const Clipboard = (await import('expo-clipboard')) as typeof import('expo-clipboard');
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

