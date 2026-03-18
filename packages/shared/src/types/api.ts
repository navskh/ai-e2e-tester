export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginationQuery {
  page?: number;
  pageSize?: number;
  status?: string;
  sortBy?: 'startedAt' | 'durationMs';
  sortOrder?: 'asc' | 'desc';
}

export interface HealthResponse {
  status: 'ok';
  uptime: number;
  version: string;
}
