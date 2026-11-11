/**
 * Generates the instruments' samples off the main thread (decision AU-11): the drone and pad take
 * about a tenth of a second each, which would stall a frame of play. The page sends the names and
 * receives each sample as it is made.
 */
import { makeSample } from './samples.ts';
import type { InstrumentName } from './samples.ts';

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<readonly InstrumentName[]>) => void) | null;
  postMessage: (message: unknown, transfer: Transferable[]) => void;
};

scope.onmessage = (e) => {
  for (const name of e.data) {
    const s = makeSample(name);
    scope.postMessage({ name, sample: s }, [s.data.buffer]);
  }
};
