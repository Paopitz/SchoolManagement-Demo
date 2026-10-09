import { HttpErrorResponse } from '@angular/common/http';

interface ApiProblem {
  title?: unknown;
  detail?: unknown;
  traceId?: unknown;
  errors?: unknown;
}

export function apiErrorMessage(error: unknown): string {
  if (!(error instanceof HttpErrorResponse)) {
    return 'Something went wrong. Please try again.';
  }

  if (error.status === 0) {
    return 'The server could not be reached. Check your connection and try again.';
  }

  const problem = asProblem(error.error);
  if (error.status >= 500) {
    const reference = typeof problem?.traceId === 'string' ? ` Reference ID: ${problem.traceId}` : '';
    return `The server encountered an error. Please try again later.${reference}`;
  }

  if (error.status === 401 && typeof problem?.detail !== 'string') {
    return 'Your session has expired. Sign in again to continue.';
  }

  if (error.status === 403 && typeof problem?.detail !== 'string') {
    return 'You do not have permission to perform this action.';
  }

  const detail = typeof problem?.detail === 'string' ? problem.detail.trim() : '';
  if (detail) {
    return detail;
  }

  const validation = formatValidationErrors(problem?.errors);
  if (validation) {
    return validation;
  }

  if (typeof problem?.title === 'string' && problem.title.trim()) {
    return problem.title.trim();
  }

  switch (error.status) {
    case 400: return 'Check the information you entered and try again.';
    case 401: return 'Your username or password is incorrect.';
    case 403: return 'You do not have permission to perform this action.';
    case 404: return 'The requested item could not be found.';
    case 409: return 'This action conflicts with the current record. Refresh and try again.';
    case 503: return 'The service is temporarily unavailable. Please try again later.';
    default: return `The request could not be completed (HTTP ${error.status}).`;
  }
}

function asProblem(value: unknown): ApiProblem | null {
  return typeof value === 'object' && value !== null ? value as ApiProblem : null;
}

function formatValidationErrors(value: unknown): string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return '';
  }

  const messages = Object.values(value).flatMap((item) =>
    Array.isArray(item) ? item.filter((message): message is string => typeof message === 'string') : [],
  );
  return [...new Set(messages)].join(' ');
}
