import { Component, OnInit, OnDestroy, PLATFORM_ID, Inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ColDef, PaginationChangedEvent } from 'ag-grid-community';
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
import { GithubService } from '../../services/github.service';
import { Subject } from 'rxjs';
import { debounceTime, takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-github-integration',
  imports: [CommonModule, FormsModule, ReactiveFormsModule, AgGridModule, MatFormFieldModule, MatSelectModule, MatOptionModule, MatInputModule, MatExpansionModule, MatIconModule],
  templateUrl: './github-integration.html',
  styleUrl: './github-integration.css'
})
export class GithubIntegration implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<void>();

  isBrowser: boolean;
  isConnected = false;
  connectedAt: Date | null = null;
  username: string | null | undefined = null;
  collections = ['organizations', 'repos', 'commits', 'pulls', 'issues', 'users'];
  selectedCollection = 'organizations';
  searchText = '';
  columnDefs: ColDef[] = [];
  rowData: any[] = [];
  paginationPageSize = 20;
  currentPage = 1;
  totalPages = 0;
  loading = false;

  constructor(
    private githubService: GithubService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
    ModuleRegistry.registerModules([AllCommunityModule]);
  }

  ngOnInit() {
    this.setupSearchDebounce();
    this.checkIntegrationStatus();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSearchDebounce() {
    this.searchSubject.pipe(
      takeUntil(this.destroy$),
      debounceTime(300)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadCollectionData();
    });
  }

  checkIntegrationStatus() {
    this.githubService.getIntegrationStatus().subscribe({
      next: (response) => {
        console.log("response",response);
        this.isConnected = response.isConnected;
        this.connectedAt = response.connectedAt ? new Date(response.connectedAt) : null;
        this.username = response.username;
        if (this.isConnected) {
          // Set default collection and load data
          this.selectedCollection = 'organizations';
          this.loadCollectionData();
        }
      },
      error: (error) => {
        console.error('Error checking integration status:', error);
      }
    });
  }

  connectToGithub() {
    this.githubService.startGithubAuth().subscribe({
      next: (response) => {
        window.location.href = response.authUrl;
      }
    });
  }

  removeIntegration() {
    this.githubService.removeIntegration().subscribe({
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
    this.searchSubject.next();
  }

  loadCollectionData() {
    if (this.loading) return;
    this.loading = true;

    this.githubService.getCollectionData(this.selectedCollection, this.currentPage, this.paginationPageSize, this.searchText).pipe(
      takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        console.log("response",response);        
        this.rowData = response.data;
        this.totalPages = response.pages;
        
        // Dynamically set column definitions
        if (response.data.length > 0 && this.columnDefs.length === 0) {
          this.columnDefs = Object.keys(response.data[0]).map(key => ({
            field: key,
            filter: true,
            sortable: true
          }));
        }
      },
      error: (error) => {
        console.error('Error loading data:', error);
      },
      complete: () => {
        this.loading = false;
      }
    });
  }

  onPageChange(event: PaginationChangedEvent) {
    this.currentPage = event.api.paginationGetCurrentPage() + 1;
    this.loadCollectionData();
  }
}
