import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let component: Login;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    fixture.detectChanges();
  });

  afterEach(() => httpMock.verify());

  it('does not submit and marks fields touched when the form is invalid', () => {
    component.submit();

    expect(component.form.controls.username.touched).toBe(true);
    expect(component.form.controls.password.touched).toBe(true);
    httpMock.expectNone(`${environment.apiBaseUrl}/auth/login`);
  });

  it('shows a generic invalid-credentials message on 401', () => {
    component.form.setValue({ username: 'jdoe', password: 'wrong' });

    component.submit();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      { title: 'Unauthorized' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(component.errorMessage()).toBe('Invalid username or password.');
    expect(component.isSubmitting()).toBe(false);
  });

  it('navigates to the dashboard after a successful login', () => {
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');
    component.form.setValue({ username: 'jdoe', password: 'secret' });

    component.submit();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush({
      accessToken: 'a',
      accessTokenExpiresAtUtc: new Date().toISOString(),
      refreshToken: 'r',
      refreshTokenExpiresAtUtc: new Date().toISOString(),
      userId: 1,
      username: 'jdoe',
      roles: ['Registrar'],
    });

    expect(navigateSpy).toHaveBeenCalledWith('/dashboard');
  });
});
