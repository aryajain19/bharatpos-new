import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/**
 * Hook to listen for USB barcode scanner input on Web platforms.
 * A USB scanner acts as a fast keyboard that rapidly types digits followed by 'Enter'.
 */
export function useUSBScanner(onScan: (barcode: string) => void) {
  const buffer = useRef('');
  const timeoutId = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Enter') {
        if (buffer.current.length > 3) { // Arbitrary minimum length for a barcode
          onScan(buffer.current);
        }
        buffer.current = '';
        if (timeoutId.current) clearTimeout(timeoutId.current);
        return;
      }

      // If it's a character, append to buffer
      if (e.key.length === 1) {
        buffer.current += e.key;

        // Reset buffer if typing is too slow (human typing vs scanner)
        // Scanners typically type very fast (e.g. < 50ms per character)
        if (timeoutId.current) clearTimeout(timeoutId.current);
        timeoutId.current = setTimeout(() => {
          buffer.current = '';
        }, 100); 
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (timeoutId.current) clearTimeout(timeoutId.current);
    };
  }, [onScan]);
}
