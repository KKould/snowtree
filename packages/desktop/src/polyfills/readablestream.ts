/**
 * ReadableStream polyfill for Node.js environments
 *
 * This ensures ReadableStream is available globally for:
 * - Anthropic SDK streaming responses
 * - Web Streams API compatibility
 */

import { ReadableStream, WritableStream, TransformStream } from 'web-streams-polyfill';

// Only polyfill if not already available (Node.js < 18)
if (typeof globalThis.ReadableStream === 'undefined') {
  (globalThis as any).ReadableStream = ReadableStream;
}

if (typeof globalThis.WritableStream === 'undefined') {
  (globalThis as any).WritableStream = WritableStream;
}

if (typeof globalThis.TransformStream === 'undefined') {
  (globalThis as any).TransformStream = TransformStream;
}
