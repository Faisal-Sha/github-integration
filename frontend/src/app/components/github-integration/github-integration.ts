import { Component, signal } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ValueFormatterParams, GridReadyEvent, ModuleRegistry, AllCommunityModule, GridApi, RowSelectionOptions, SelectionChangedEvent, CellValueChangedEvent, PaginationChangedEvent } from 'ag-grid-community';
import { GithubService, FetchStats, CurrentRepo } from '../../services/github';
import { takeUntil, Subject, debounceTime, interval, switchMap } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCardModule } from '@angular/material/card';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-github-integration',
  imports: [AgGridAngular, CommonModule, FormsModule, MatExpansionModule, MatIconModule, MatFormFieldModule, MatSelectModule, MatInputModule, MatProgressBarModule, MatCardModule],
  templateUrl: './github-integration.html',
  styleUrl: './github-integration.css'
})
export class GithubIntegration {
  private searchSubject = new Subject<void>();
  private destroy$ = new Subject<void>();
  private pollInterval$ = interval(3000)  // Poll every second for more responsive updates;

  rowData: any[] = [];
  colDefs: ColDef[] = [];
  isConnected = signal(false);
  connectedAt = signal<Date | null>(null);
  username = signal<string | null>(null);
  fetchStatus = signal<'idle' | 'processing' | 'failed'>('idle');
  fetchProgress = signal(0);
  fetchMessage = signal('');
  currentRepo = signal<CurrentRepo | null>(null);
  stats = signal<FetchStats>({ totalRepos: 0, processedRepos: 0, totalCommits: 0, totalPulls: 0, totalIssues: 0 });
  lastUpdated = signal<Date | null>(null);
  
  gridApi: GridApi<any> | null = null;
  collections = ['organizations', 'repos', 'commits', 'pulls', 'issues'];
  selectedCollection = signal('organizations');
  searchText = '';
  showSearchedText = signal(false);
  paginationPageSize = signal(20);
  currentPage = 1;
  totalPages = 0;

  rowSelection: RowSelectionOptions = {
    mode: "multiRow",
    headerCheckbox: false,
  };
  defaultColDef: ColDef = {
    filter: true,
    editable: true,
    resizable: true,
    sortable: true,
  };

  constructor(private githubService: GithubService) {
    ModuleRegistry.registerModules([AllCommunityModule]);
  }

  ngOnInit() {
    this.setupSearchDebounce();
    // this.gitHubIntegrationStatus();
  }

  private setGridData(data: any[]) {
    console.log("Setting grid data", data);
    if (!data?.length) {
      this.rowData = [];
      this.colDefs = [];
      return;
    }
    
    // First set the column definitions
    this.colDefs = [
      {
        headerName: '#',
        valueFormatter: (params: ValueFormatterParams) => ((params.node?.rowIndex || 0) + 1).toString(),
        width: 70,
        pinned: 'left'
      },
      ...Object.keys(data[0]).map(key => ({
        field: key,
        headerName: key.charAt(0).toUpperCase() + key.slice(1)
      }))
    ];

    // Then set the row data
    setTimeout(() => {
      console.log("Setting grid data", data);
      this.rowData = [...data];
      if (this.gridApi) {
        this.gridApi.setGridOption('columnDefs', this.colDefs);
        this.gridApi.setGridOption('rowData', this.rowData);
      }
    });
  }

  onGridReady(params: GridReadyEvent) {
    console.log("Grid Ready!", params);
    this.gridApi = params.api;
    this.gridApi.sizeColumnsToFit();
    // if (this.isConnected()) {
    //   this.selectedCollection.set('organizations');
    //   this.loadCollectionData(this.selectedCollection());
    // }
    this.gitHubIntegrationStatus();
  }

  gitHubIntegrationStatus() {
    this.githubService.getIntegrationStatus().subscribe({
      next: (response) => {
        console.log("status response",response);
        this.isConnected.set(response.isConnected);
        this.connectedAt.set(response.connectedAt || null);
        this.username.set(response.username || null);
        if (this.isConnected()) {
          this.pollFetchStatus();
          this.loadCollectionData(this.selectedCollection());
        }
      },
      error: (error) => {
        console.error('Error checking integration status:', error);
      }
    });
  }

  loadCollectionData(collection: string) {
    this.githubService.getCollectionData(collection, this.searchText).pipe(
      takeUntil(this.destroy$)).subscribe({
      next: (response) => {
        console.log("collection response",response);
        this.totalPages = Math.ceil(response.data.length / this.paginationPageSize());
        this.setGridData(response.data);
      },
      error: (error: any) => {
        console.error('Error loading data:', error);
      }
    });
  }

  connectToGithub() {
    this.githubService.startGithubAuth().subscribe({
      next: (response:any) => {
        window.location.href = response.authUrl;
      },
      error: (error:any) => {
        console.error('Error connecting to GitHub:', error);
      }
    });
  }

  removeIntegration() { 
    this.githubService.removeIntegration().subscribe({
      next: () => {
        this.isConnected.set(false);
        this.connectedAt.set(null);
        this.username.set(null);
        this.rowData = [];
        this.colDefs = [];
        this.fetchStatus.set('idle');
        this.fetchProgress.set(0);
        this.fetchMessage.set('');
      },
      error: (error:any) => {
        console.error('Error removing integration:', error);
      }
    });
  }

  onCollectionChange() {
    this.currentPage = 1;
    this.loadCollectionData(this.selectedCollection());
  }

  onSearch() {
    this.searchSubject.next();
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
      this.loadCollectionData(this.selectedCollection());
    });
  }

  private pollFetchStatus() {
    console.log("Polling fetch status...");
    this.pollInterval$.pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.githubService.getFetchStatus())
    ).subscribe(status => {
      console.log("Fetch status", status, status.stats);
      this.fetchStatus.set(status.status as any);
      this.fetchProgress.set(status.progress);
      this.fetchMessage.set(status.message);
      this.currentRepo.set(status.currentRepo || null);
      if (status.stats) {
        this.stats.set(status.stats);
      }
      // Only update if we have a valid date string
      if (status.updatedAt) {
        const date = new Date(status.updatedAt);
        if (!isNaN(date.getTime())) {
          this.lastUpdated.set(date);
        }
      }

      // Auto-refresh data when collection matches current repo type
      if (status.currentRepo && this.selectedCollection()) {
        const collection = this.selectedCollection();
        if ((collection === 'commits' && status.currentRepo.commitsPage > 0) ||
            (collection === 'pulls' && status.currentRepo.pullsPage > 0) ||
            (collection === 'issues' && status.currentRepo.issuesPage > 0)) {
          this.loadCollectionData(collection);
        }
      }
    });
  }

  onSelectionChanged = (event: SelectionChangedEvent) => {
    console.log("Row Selected!");
  };
  onCellValueChanged = (event: CellValueChangedEvent) => {
    console.log(`New Cell Value: ${event.value}`);
  };

  onPageChange(event: PaginationChangedEvent<any>) {
    console.log("Page Changed!");
    const newPage = event.api.paginationGetCurrentPage() + 1;
    if (newPage !== this.currentPage) {
      this.currentPage = newPage;
      this.loadCollectionData(this.selectedCollection());
    }
  }

}
