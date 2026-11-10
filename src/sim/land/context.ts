/** Builds what the on-foot systems need from loaded content and balance.json. */
import { parseMovementBalance } from '../../content/balance.ts';
import type { Content } from '../../content/registry.ts';
import type { SimWorldContext } from '../simulation.ts';

export function landContext(
  content: Pick<Content, 'onFoot' | 'opening' | 'zoneMaps'>,
  balance: unknown,
): SimWorldContext {
  if (content.onFoot === null) throw new Error('content/onfoot.json did not load');
  return {
    maps: content.zoneMaps,
    movement: parseMovementBalance(balance),
    rules: content.onFoot,
    opening: content.opening,
  };
}
