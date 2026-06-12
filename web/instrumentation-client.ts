import posthog from 'posthog-js';
import { getPostHogToken, isPostHogEnabled } from './lib/posthog-config';

if (isPostHogEnabled()) {
  const token = getPostHogToken();
  if (token) {
    posthog.init(token, {
      api_host: '/ingest',
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-01-30',
      capture_exceptions: true,
      debug: process.env.NODE_ENV === 'development',
    });
  }
}
