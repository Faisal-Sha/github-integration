import { Routes } from '@angular/router';
import { Callback } from './components/callback/callback';
import { GithubIntegration } from './components/github-integration/github-integration';

export const routes: Routes = [
    { path: '', component: GithubIntegration },
    { path: 'callback', component: Callback }
];
