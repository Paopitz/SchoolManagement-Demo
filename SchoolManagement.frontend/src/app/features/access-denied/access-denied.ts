import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [RouterLink],
  template: `<section role="alert"><h1>{{ unavailable ? 'Access check unavailable' : 'Access denied' }}</h1>
    <p>{{ unavailable ? 'Your permissions could not be checked. Please try again or contact an administrator.' : 'Your account does not have permission to open this page. Contact an administrator if you need access.' }}</p>
    <a routerLink="/login">Return to sign in</a></section>`,
  styles: [`section { padding: 3rem; max-width: 50rem; margin: auto; }`],
})
export class AccessDeniedPage {
  readonly unavailable = inject(ActivatedRoute).snapshot.queryParamMap.get('unavailable') === '1';
}
