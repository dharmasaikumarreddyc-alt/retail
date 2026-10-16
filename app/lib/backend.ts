const configuredBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL?.trim();

export const backendUrl = (configuredBackendUrl || 'http://localhost:8000').replace(/\/+$/, '');

export const optionalBackendUrl = configuredBackendUrl
  ? configuredBackendUrl.replace(/\/+$/, '')
  : null;
