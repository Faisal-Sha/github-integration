import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.html',
  styleUrl: './callback.css'
})
export class Callback {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) {
      // Send code to backend
      this.http.get(`http://backend:3000/api/github/callback?code=${code}`).subscribe({
        next: () => {
          this.router.navigate(['/']);
        },
        error: (error) => {
          console.error('Error in GitHub callback:', error);
          this.router.navigate(['/'], { queryParams: { error: 'Authentication failed' } });
        }
      });
    } else {
      this.router.navigate(['/'], { queryParams: { error: 'No code received' } });
    }
  }
}
