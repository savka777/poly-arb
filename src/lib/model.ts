import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic';

let _model: ReturnType<ReturnType<typeof createVertexAnthropic>> | null = null;

export function getModel() {
  if (!_model) {
    const vertexAnthropic = createVertexAnthropic({
      project: process.env.GOOGLE_CLOUD_PROJECT!,
      location: process.env.VERTEX_REGION || 'us-east5',
    });
    _model = vertexAnthropic('claude-opus-4-5@20251101');
  }
  return _model;
}

// Lazy proxy — model only initializes on first use, not at import time
export const model = new Proxy({} as ReturnType<typeof getModel>, {
  get(_target, prop, receiver) {
    return Reflect.get(getModel(), prop, receiver);
  },
});
