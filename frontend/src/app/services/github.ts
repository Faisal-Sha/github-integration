import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment.development';
import { HttpClient } from '@angular/common/http';


export interface IntegrationStatus {
  isConnected: boolean;
  connectedAt?: Date;
  username?: string;
}

export interface CollectionResponse {
  data: any[];
  total: number;
  pages: number;
  message?: string;
}

export interface FetchStatus {
  status: string;
  progress: number;
  message: string;
}


@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private apiUrl = environment.apiUrl || 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}

  getIntegrationStatus(): Observable<IntegrationStatus> {
    return this.http.get<IntegrationStatus>(`${this.apiUrl}/github/status`);
  }

  getCollectionData(collection: string, search: string): Observable<CollectionResponse> {
    return this.http.get<CollectionResponse>(`${this.apiUrl}/github/data/${collection}`, {
      params: { search }
    });
  }

  startGithubAuth(): Observable<{ authUrl: string }> {
    return this.http.get<{ authUrl: string }>(`${this.apiUrl}/github/auth`);
  }

  handleCallback(code: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/github/callback`, { params: { code } });
  }

  removeIntegration(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/github/remove`);
  }

  getFetchStatus(): Observable<FetchStatus> {
    return this.http.get<FetchStatus>(`${this.apiUrl}/github/fetch-status`);
  }
}
