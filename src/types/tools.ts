import type { LucideIcon } from 'lucide-react';

export type ToolCategory = 
  | 'pdf' 
  | 'convert' 
  | 'edit' 
  | 'organize' 
  | 'sign' 
  | 'ocr' 
  | 'image' 
  | 'text' 
  | 'productivity';

export interface ToolDefinition {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
  iconName: string; // for dynamic or lucide reference
  icon?: LucideIcon;
  badge?: 'Core' | 'Popular' | 'New' | 'Utility';
  route: string;
  keywords: string[];
  acceptedInputMimeTypes: string[];
  acceptedInputExtensions: string[];
  outputExtension: string;
  outputMimeType: string;
  priority: number;
}

export type ProcessingStatus = 'idle' | 'queued' | 'processing' | 'validating' | 'completed' | 'failed' | 'cancelled';

export interface JobProgress {
  id: string;
  toolId: string;
  fileName: string;
  fileSizeBytes: number;
  status: ProcessingStatus;
  progressPercent: number; // 0 to 100
  statusMessage: string;
  startedAt: number;
  completedAt?: number;
  error?: string;
  resultBlob?: Blob;
  resultFileName?: string;
  validationReport?: import('./document').ValidationReport;
}
