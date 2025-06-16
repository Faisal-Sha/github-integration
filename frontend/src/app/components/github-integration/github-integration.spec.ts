import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GithubIntegration } from './github-integration';

describe('GithubIntegration', () => {
  let component: GithubIntegration;
  let fixture: ComponentFixture<GithubIntegration>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GithubIntegration]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GithubIntegration);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
