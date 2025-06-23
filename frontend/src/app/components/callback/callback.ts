import { Component, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GithubService } from '../../services/github';
import { interval, Subject } from 'rxjs';
import { takeUntil, switchMap } from 'rxjs/operators';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-callback',
  imports: [CommonModule, MatProgressBarModule],
  templateUrl: './callback.html',
  styleUrl: './callback.css'
})
export class Callback {
  private destroy$ = new Subject<void>();
  progress = 0;
  status = signal<'pending' | 'processing' | 'failed' | 'completed'>('pending');
  message = 'Processing GitHub authentication...';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private githubService: GithubService
  ) {}

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      this.githubService.handleCallback(code).subscribe({
        next: () => {
          // Start polling fetch status
          // this.pollFetchStatus();
          this.router.navigate(['/']);
        },
        error: (error:any) => {
          console.error('Error in GitHub callback:', error);
          this.router.navigate(['/'], { queryParams: { error: 'Authentication failed' } });
        }
      });
    } else {
      this.router.navigate(['/'], { queryParams: { error: 'No code received' } });
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  pollFetchStatus() {
    interval(2000).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.githubService.getFetchStatus())
    ).subscribe({
      next: (response) => {
        this.status.set(response.status as 'pending' | 'processing' | 'failed' | 'completed');
        this.progress = response.progress;
        this.message = response.message;

        if (response.status === 'completed' || response.status === 'failed') {
          this.router.navigate(['/']);
        }
      },
      error: (error:any) => {
        console.error('Error polling fetch status:', error);
        this.router.navigate(['/'], { queryParams: { error: 'Failed to fetch data' } });
      }
    });
  }
}
