// Public API of the Tresor intelligence engine. UI code imports from here only.

import { localEmbedding } from './providers/local-embedding';
import { localForecast } from './forecast/forecast';
import { providers, registerProvider } from './providers/types';

/** Registers the built-in local providers once. A remote provider registered 'first' takes priority. */
export function ensureDefaultProviders() {
  if (!providers('embedding').some((p) => p.id === localEmbedding.id)) registerProvider('embedding', localEmbedding, 'last');
  if (!providers('forecast').some((p) => p.id === localForecast.id)) registerProvider('forecast', localForecast, 'last');
}
ensureDefaultProviders();

export * from './core/contract';
export { recentOperations, operationStats, onOperation } from './core/observability';
export { browserContext, buildContext, type IntelligenceContext } from './context/context';
export { eventBus, createEventBus, memoryStore, type EventBus } from './events/bus';
export { createEvent, validateEvent, type EventType, type TresorEvent } from './events/schema';
export { registerProvider, providers, withFallback } from './providers/types';
export { signalsFor, type ProductSignals, type Flavour } from './product/signals';
export { parseIntent, type SearchIntent } from './intent/intent';
export { search, type SearchHit, type SearchResult, type SearchOptions } from './search/pipeline';
export { RANKING_VERSION, WEIGHTS } from './ranking/ranking';
export { explanation, reasonLine, confidenceLabel, type Explanation } from './explanations/explain';
export { similarTo, pairsWith, cartSuggestions, forYou, unitsSold, type Recommendation } from './recommend/recommend';
export { salesByDay, productPerformance, funnel, searchAnalytics, categoryMix, cakeAnalytics } from './analytics/metrics';
export { stockOutlook, ses, backtest, type StockOutlook } from './forecast/forecast';
export { generateInsights, type Insight } from './insights/insights';
export { generateOperationalInsights, type JobLike } from './insights/operations';
export { orderShowcase, moodsFor, selectRendition, type ShowcaseItem, type Rendition } from './content/content';
export { proposeActions, approveAndApply, reject, pending, browserDecisionStore, memoryDecisionStore, POLICY, type ProposedAction, type DecisionLevel, type DecisionRecord, type DecisionStore, type ExecutionPlan } from './decisions/decisions';
export { askCopilot, type CopilotAnswer, type CopilotTopic } from './copilot/copilot';
