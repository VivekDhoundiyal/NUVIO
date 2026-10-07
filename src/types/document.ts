export type AnnotationType = 
  | 'text' 
  | 'image' 
  | 'drawing' 
  | 'shape' 
  | 'signature' 
  | 'stamp' 
  | 'watermark'
  | 'highlight'
  | 'underline'
  | 'strikethrough';

export type ShapeType = 'rectangle' | 'circle' | 'line' | 'arrow' | 'highlight' | 'underline' | 'strikethrough';

export interface Point {
  x: number;
  y: number;
}

export interface TextWordItem {
  id: string;
  spanId: string;
  pageIndex: number;
  text: string;
  originalText: string;
  x: number; // Points from left of page
  y: number; // Points from top of page
  pdfX: number; // PDF user coordinate (origin bottom-left)
  pdfY: number; // PDF user coordinate baseline (origin bottom-left)
  width: number;
  height: number;
  baseline: number;
  fontSize: number;
  fontFamily: string;
  pdfFontName?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color: string;
  rgbColor: { r: number; g: number; b: number };
  isModified: boolean;
  charBounds?: { char: string; x: number; width: number }[];
  /** Content-stream direct operator address */
  streamIndex?: number;
  opIndex?: number;
  fontResourceName?: string;
  rawTextMatrix?: number[];
  rawOperandType?: 'literal' | 'hex' | 'array';
}

export interface PDFTextElement {
  id: string;
  pageIndex: number;
  originalText: string;
  currentText: string;

  originalFont?: string;
  resolvedFont?: string;
  embeddedFontReference?: string;

  fontSize: number;
  originalFontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';

  fillColor?: string;
  rgbColor?: { r: number; g: number; b: number };
  strokeColor?: string;

  characterSpacing?: number;
  wordSpacing?: number;
  horizontalScale?: number;
  lineHeight?: number;

  x: number; // Canonical PDF user coordinate (origin bottom-left) or screen projection
  y: number; // Canonical PDF user coordinate (origin bottom-left) or screen projection
  pdfX?: number; // Explicit PDF user coordinate
  pdfY?: number; // Explicit PDF user coordinate
  width: number;
  height: number;

  baseline?: number;
  rotation?: number;

  textMatrix?: number[];
  transformMatrix?: number[];

  renderingMode?: number;

  originalBoundingBox?: { x: number; y: number; width: number; height: number };
  currentBoundingBox?: { x: number; y: number; width: number; height: number };

  sourceOperatorReference?: {
    streamIndex: number;
    opIndex: number;
    operandIndex: number;
  };
  sourceTextItemReference?: string;

  isModified: boolean;
  isDeleted?: boolean;
  isFromOcr?: boolean;
  glyphs?: any[];
  words?: TextWordItem[];

  // Compatibility fields for UI rendering and toolbar
  fontFamily?: string;
  color?: string;
  originalColor?: string;
  pdfFontName?: string;
  fontResourceName?: string;
  streamIndex?: number;
  opIndex?: number;
  underline?: boolean;
  strikethrough?: boolean;
  listType?: 'bullet' | 'number';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'baseline' | 'super' | 'sub';
  letterSpacing?: number;
  backgroundColor?: string;
  bbox?: { x: number; y: number; width: number; height: number };
  rawTextMatrix?: number[];
  rawOperandType?: 'literal' | 'hex' | 'array';
}

export type EditableTextSpan = PDFTextElement;

export interface AnnotationObject {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  x: number; // in points (1/72 inch) or relative percentage
  y: number;
  width: number;
  height: number;
  rotation?: number; // degrees (0, 90, 180, 270, etc.)
  opacity?: number; // 0 to 1
  zIndex?: number;
  
  // Text specific
  text?: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  strikethrough?: boolean;
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  verticalAlign?: 'baseline' | 'super' | 'sub';
  letterSpacing?: number;
  lineHeight?: number;
  listType?: 'bullet' | 'number';
  textColor?: string;
  backgroundColor?: string;

  // Shapes & Drawing specific
  shapeType?: ShapeType;
  strokeColor?: string;
  strokeWidth?: number;
  fillColor?: string;
  points?: Point[]; // for freehand drawings and arrows

  // Image & Signature specific
  imageDataUrl?: string;
  imageMimeType?: string;

  // Stamp specific
  stampText?: string;
  stampType?: 'APPROVED' | 'REJECTED' | 'CONFIDENTIAL' | 'DRAFT' | 'PAID' | 'REVIEW' | 'FINAL' | 'COPY' | 'CUSTOM';

  // Watermark specific
  watermarkType?: 'text' | 'image';
  watermarkPosition?: 'center' | 'diagonal' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'tile';
  watermarkTargetPages?: 'all' | 'current';
  watermarkImageSize?: number;
  
  // Creation metadata
  createdAt: number;
}

export interface PageInfo {
  pageIndex: number;
  width: number;
  height: number;
  rotation: number;
  originalRotation: number;
  aspectRatio: number;
  thumbnailUrl?: string;
}

export interface DocumentMetadata {
  fileName: string;
  fileSizeBytes: number;
  pageCount: number;
  title?: string;
  author?: string;
  creator?: string;
  creationDate?: Date;
  modificationDate?: Date;
  isEncrypted?: boolean;
}

export interface ValidationItem {
  id: string;
  category: 'integrity' | 'layout' | 'content' | 'performance' | 'security';
  label: string;
  status: 'passed' | 'warning' | 'failed';
  details: string;
  suggestedAction?: string;
}

export interface ValidationReport {
  passed: boolean;
  isValid?: boolean; // alias for passed
  score: number; // 0 to 100
  summary?: string;
  items: ValidationItem[];
  checks?: ValidationItem[]; // alias for items
  timestamp: number;
  inputSummary: {
    pageCount?: number;
    fileSizeBytes?: number;
    dimensions?: { width: number; height: number };
  };
  outputSummary: {
    pageCount?: number;
    fileSizeBytes?: number;
    dimensions?: { width: number; height: number };
  };
}

export interface SavedDraft {
  id: string;
  title: string;
  lastModified: number;
  fileData?: ArrayBuffer;
  fileName: string;
  annotations: AnnotationObject[];
  editableSpansByPage?: Record<number, EditableTextSpan[]>;
  pages?: PageInfo[];
  pageRotations: Record<number, number>;
  deletedPages: number[];
}

export interface SavedSignature {
  id: string;
  name: string;
  dataUrl: string;
  createdAt: number;
}

export interface SavedStamp {
  id: string;
  title: string;
  type: string;
  color: string;
  createdAt: number;
}
