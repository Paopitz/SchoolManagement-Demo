import { HttpBackend, HttpClient } from '@angular/common/http';
import { Injectable, Provider, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ENROLLMENT_PORTAL_OPTIONS_LOADER } from '../enrollment-applications/enrollment-application-api.service';
import { PortalOptions } from '../enrollment-applications/enrollment-application.models';

/** Public, safe school configuration. No staff JWT or applicant session is needed. */
@Injectable({ providedIn: 'root' })
export class StudentPortalOptionsService {
  private readonly http = new HttpClient(inject(HttpBackend));

  load(): Observable<PortalOptions> {
    return this.http.get<PortalOptions>(`${environment.apiBaseUrl}/student-portal/options`);
  }
}

export const enrollmentPortalOptionsProvider: Provider = {
  provide: ENROLLMENT_PORTAL_OPTIONS_LOADER,
  useFactory: () => {
    const options = inject(StudentPortalOptionsService);
    return () => options.load();
  },
};
