import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

@Component({
  selector: 'app-callback',
  imports: [],
  templateUrl: './callback.html',
  styleUrl: './callback.css'
})
export class Callback {
  constructor(private route: ActivatedRoute, private router: Router) {}

  ngOnInit() {
    const success = this.route.snapshot.queryParamMap.get('success');
    console.log("success",success);
    if (success === 'true') {
      this.router.navigate(['/']);
    } else {
      this.router.navigate(['/'], { queryParams: { error: 'Authentication failed' } });
    }
  }
}
