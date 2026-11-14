/**
 * The prompt line for a movement verb in reach (Stage 14; Book 2 section 10: each verb starts with
 * its prompt; Book 8 section 10, "Interaction prompts"): climb or climb down, jump across, crawl
 * through, take hold of a heavy object, and, holding it, how to pull it or leave it. A verb that
 * would be refused shows its refusal's words instead (too tired, hands full, no room). Words come
 * from strings, never IDs.
 */
import type { TraverseOffer, TraverseRefusal } from '../sim/land/traverse.ts';

type Translate = (key: string, vars?: Record<string, string>) => string;

const REFUSAL_WORDS: Readonly<Record<TraverseRefusal, string>> = {
  HANDS_FULL: 'ui.refusal.hands_full',
  TOO_TIRED: 'ui.refusal.too_tired',
  NO_ROOM: 'ui.refusal.no_room',
  NOTHING_THERE: 'ui.refusal.nothing_there',
};

export function verbPrompt(
  offer: TraverseOffer,
  t: Translate,
  key: string,
  mouse: boolean,
): { text: string; kind: string } {
  const say = (k: string): string => (mouse ? t(`${k}_click`) : t(k, { key }));
  switch (offer.kind) {
    case 'climb': {
      const k = offer.from === 'FOOT' ? 'ui.prompt.climb' : 'ui.prompt.climb_down';
      return { text: say(k), kind: offer.from === 'FOOT' ? 'climb' : 'climb_down' };
    }
    case 'jump':
      return offer.refusal === null
        ? { text: say('ui.prompt.jump'), kind: 'jump' }
        : { text: t(REFUSAL_WORDS[offer.refusal]), kind: offer.refusal.toLowerCase() };
    case 'crawl':
      return offer.refusal === null
        ? { text: say('ui.prompt.crawl'), kind: 'crawl' }
        : { text: t('caption.edge.low'), kind: 'too_low' };
    case 'grip':
      return { text: say('ui.prompt.grip'), kind: 'grip' };
    case 'gripping':
      return { text: say('ui.prompt.gripping'), kind: 'gripping' };
  }
}
