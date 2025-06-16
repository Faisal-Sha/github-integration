import { Component, OnInit, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ColDef, PaginationChangedEvent } from 'ag-grid-community';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AgGridModule } from 'ag-grid-angular';
import { ModuleRegistry, AllCommunityModule } from 'ag-grid-community';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-github-integration',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule, MatFormFieldModule, MatSelectModule, MatOptionModule, MatInputModule, MatExpansionModule, MatIconModule],
  templateUrl: './github-integration.html',
  styleUrl: './github-integration.css'
})
export class GithubIntegration implements OnInit {
  isBrowser: boolean;
  isConnected = false;
  connectedAt: Date | null = null;
  username: string | null = null;
  collections = ['organizations', 'repos', 'commits', 'pulls', 'issues', 'users'];
  selectedCollection = 'organizations';
  searchText = '';
  columnDefs: ColDef[] = [];
  rowData: any[] = [];
  paginationPageSize = 20;
  currentPage = 1;
  totalPages = 0;

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    ModuleRegistry.registerModules([AllCommunityModule]);
  }

  ngOnInit() {
    this.checkIntegrationStatus();
  }

  checkIntegrationStatus() {
    this.http.get<any>('http://backend:3000/api/github/status').subscribe({
      next: (response) => {
        console.log("response",response);
        this.isConnected = response.isConnected;
        this.connectedAt = response.connectedAt ? new Date(response.connectedAt) : null;
        this.username = response.username;
        if (this.isConnected) {
          this.loadCollectionData();
        }
      }
    });
  }

  connectToGithub() {
    this.http.get<any>('http://backend:3000/api/github/auth').subscribe({
      next: (response) => {
        window.location.href = response.authUrl;
      }
    });
  }

  removeIntegration() {
    this.http.delete('http://localhost:3000/api/github/remove').subscribe({
      next: () => {
        this.isConnected = false;
        this.connectedAt = null;
        this.username = null;
        this.rowData = [];
      }
    });
  }

  onCollectionChange() {
    this.currentPage = 1;
    this.loadCollectionData();
  }

  onSearch() {
    this.currentPage = 1;
    this.loadCollectionData();
  }

  loadCollectionData() {
    this.http.get<any>(`http://localhost:3000/api/github/data/${this.selectedCollection}`, {
      params: {
        page: this.currentPage.toString(),
        limit: this.paginationPageSize.toString(),
        search: this.searchText
      }
    }).subscribe({
      next: (response) => {
        console.log("response",response);
        this.rowData = response.data;
        this.totalPages = response.pages;
        
        // Dynamically set column definitions
        if (response.data.length > 0) {
          this.columnDefs = Object.keys(response.data[0]).map(key => ({
            field: key,
            filter: true,
            sortable: true
          }));
        }
      }
    });
  }

  onPageChange(event: PaginationChangedEvent<any, any>) {
    // this.currentPage = event.page;
    this.loadCollectionData();
  }
}
