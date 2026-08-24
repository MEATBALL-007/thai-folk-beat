import { AudioEngine } from './AudioEngine';

/**
 * One AudioContext for the whole app.
 *
 * Scenes come and go; the context must not. Creating a second AudioContext would
 * give the Conductor a second, unrelated clock, and browsers cap how many a page
 * may open. Constructed suspended — call `audio.resume()` from the first user
 * gesture (spec §5.1).
 */
export const audio = new AudioEngine();
