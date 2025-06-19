import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

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

@Injectable({
  providedIn: 'root'
})
export class GithubService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getIntegrationStatus(): Observable<IntegrationStatus> {
    return this.http.get<IntegrationStatus>(`${this.apiUrl}/github/status`);
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

  getCollectionData(collection: string, search: string): Observable<CollectionResponse> {
    return this.http.get<CollectionResponse>(`${this.apiUrl}/github/data/${collection}`, {
      params: { search }
    });
  }
}
