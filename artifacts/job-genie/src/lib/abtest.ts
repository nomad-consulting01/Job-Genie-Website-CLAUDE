import experimentsData from '../data/experiments.json';

export function getVisitorId(): string {
  try {
    let visitorId = localStorage.getItem('visitor_id');
    if (!visitorId) {
      visitorId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
      localStorage.setItem('visitor_id', visitorId);
    }
    return visitorId;
  } catch {
    return 'anon';
  }
}

export function getSessionId(): string {
  try {
    let sessionId = sessionStorage.getItem('session_id');
    if (!sessionId) {
      sessionId = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2));
      sessionStorage.setItem('session_id', sessionId);
    }
    return sessionId;
  } catch {
    return 'anon';
  }
}

export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  overrides: Record<string, string>;
}

export function getExperiment(experimentId: string): ExperimentVariant | null {
  try {
    const experiment = experimentsData.experiments.find(e => e.id === experimentId);
    if (!experiment || experiment.status !== 'active') return null;

    const storageKey = `exp_${experimentId}`;
    const storedVariantId = localStorage.getItem(storageKey);

    if (storedVariantId) {
      const variant = experiment.variants.find(v => v.id === storedVariantId);
      if (variant) return variant as ExperimentVariant;
    }

    const rand = Math.random();
    let cumulative = 0;
    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (rand <= cumulative) {
        localStorage.setItem(storageKey, variant.id);
        return variant as ExperimentVariant;
      }
    }

    const control = experiment.variants.find(v => v.id === 'control') ?? experiment.variants[0];
    localStorage.setItem(storageKey, control.id);
    return control as ExperimentVariant;
  } catch {
    return null;
  }
}

export function getSlugExperiment(slug: string): ExperimentVariant | null {
  if (!slug) return null;
  const expId = `lp_${slug}`;
  return getExperiment(expId);
}
