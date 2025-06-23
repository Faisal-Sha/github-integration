import { Routes } from '@angular/router';
import { GithubIntegration } from './components/github-integration/github-integration';
import { Callback } from './components/callback/callback';

export const routes: Routes = [
    { path: '', component: GithubIntegration },
    { path: 'callback', component: Callback }
];
