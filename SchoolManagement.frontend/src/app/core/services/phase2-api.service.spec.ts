import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { Phase2ApiService } from './phase2-api.service';

describe('Phase2ApiService', () => {
  let service: Phase2ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(Phase2ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('requests students with server-side search and pagination', () => {
    service.getStudents('Rivera', 2).subscribe();
    const request = httpMock.expectOne((candidate) => candidate.url === `${environment.apiBaseUrl}/students`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('search')).toBe('Rivera');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('20');
    request.flush({ items: [], page: 2, pageSize: 20, totalCount: 0 });
  });

  it('sends confirmation to the dedicated workflow endpoint', () => {
    service.enrollmentAction(42, 'confirm').subscribe();
    const request = httpMock.expectOne(`${environment.apiBaseUrl}/enrollments/42/confirm`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({});
  });

  it('sends the required reason when canceling an enrollment', () => {
    service.enrollmentAction(42, 'cancel', 'Duplicate record').subscribe();
    const request = httpMock.expectOne(`${environment.apiBaseUrl}/enrollments/42/cancel`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Duplicate record' });
    request.flush({});
  });
});