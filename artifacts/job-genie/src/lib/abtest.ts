export function getVisitorId(): string {
  let visitorId = localStorage.getItem('visitor_id');
  if (!visitorId) {
    visitorId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    localStorage.setItem('visitor_id', visitorId);
  }
  return visitorId;
}

export function getSessionId(): string {
  let sessionId = sessionStorage.getItem('session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
    sessionStorage.setItem('session_id', sessionId);
  }
  return sessionId;
}

import experimentsData from '../data/experiments.json';

export function getExperiment(experimentId: string) {
  const experiment = experimentsData.experiments.find(e => e.id === experimentId);
  if (!experiment || experiment.status !== 'active') {
    return null;
  }

  const visitorId = getVisitorId();
  const storageKey = `exp_${experimentId}`;
  const storedVariant = localStorage.getItem(storageKey);

  if (storedVariant) {
    const variant = experiment.variants.find(v => v.id === storedVariant);
    if (variant) return variant;
  }

  // Assign variant randomly based on weights
  const rand = Math.random();
  let cumulativeWeight = 0;
  for (const variant of experiment.variants) {
    cumulativeWeight += variant.weight;
    if (rand <= cumulativeWeight) {
      localStorage.setItem(storageKey, variant.id);
      return variant;
    }
  }

  // Fallback to control
  const control = experiment.variants.find(v => v.id === 'control') || experiment.variants[0];
  localStorage.setItem(storageKey, control.id);
  return control;
}
