import { HttpErrorResponse } from '@angular/common/http';
import { apiErrorMessage } from './api-error-message';

describe('apiErrorMessage', () => {
  it('uses a problem detail supplied by the API', () => {
    const error = new HttpErrorResponse({ status: 409, error: { title: 'Conflict', detail: 'Employee number already exists.' } });
    expect(apiErrorMessage(error)).toBe('Employee number already exists.');
  });

  it('combines model validation errors when no detail is provided', () => {
    const error = new HttpErrorResponse({ status: 400, error: { errors: { firstName: ['First name is required.'], lastName: ['Last name is required.'] } } });
    expect(apiErrorMessage(error)).toBe('First name is required. Last name is required.');
  });

  it('provides a safe server error message and reference ID without exposing details', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { detail: 'SQL connection string secret', traceId: 'request-123' },
    });
    expect(apiErrorMessage(error)).toBe('The server encountered an error. Please try again later. Reference ID: request-123');
    expect(apiErrorMessage(error)).not.toContain('SQL');
  });

  it('explains missing resources and unavailable API connections', () => {
    expect(apiErrorMessage(new HttpErrorResponse({ status: 404 }))).toBe('The requested item could not be found.');
    expect(apiErrorMessage(new HttpErrorResponse({ status: 0 }))).toContain('server could not be reached');
  });
});
