export interface UploadResponse {
  document_id: string;
  status: string;
  total_pages: number;
  enhanced_json_url: string;
}

export interface DocumentSummary {
  document_id: string;
  total_pages: number;
  sub_documents?: number;
  results_url?: string;
}

export interface PageInfo {
  width_px?: number;
  height_px?: number;
}

export interface PageElement {
  element_id: string;
  type: string;
  content: string;
  bbox_pixel?: [number, number, number, number];
  bbox_pdf?: [number, number, number, number];
  page_number?: number;
}

export interface OntologyPage {
  page_number?: number;
  page_info?: PageInfo;
  elements?: PageElement[];
}

export interface SubDocument {
  id: string;
  type: string;
  title?: string;
  page_range?: [number, number];
  element_count?: number;
  confidence?: number;
}

export interface OntologyDocument {
  document_id: string;
  total_pages: number;
  sub_documents?: SubDocument[];
  pages?: OntologyPage[];
  processing_stats?: Record<string, unknown>;
  patient_demographics?: Record<string, unknown>;
}

export interface MatchedElement {
  element_id: string;
  type: string;
  content: string;
  page_number: number;
  bbox_pixel?: [number, number, number, number];
  bbox_pdf?: [number, number, number, number];
  relevance?: string;
}

export interface QueryResponse {
  answer_summary: string;
  matched_elements: MatchedElement[];
  reasoning?: string;
  filter_stats?: Record<string, unknown>;
}

export interface SampleDocument {
  id: string;
  filename: string;
  display_name: string;
  size_bytes?: number;
}

export interface SampleDocumentsResponse {
  samples: SampleDocument[];
}

export interface PrecomputedAnswer {
  document_id: string;
  source_json: string;
  total_questions: number;
  questions: PrecomputedQuestion[];
}

export interface PrecomputedQuestion {
  question_id: string;
  question: string;
  answer: {
    answer_summary: string;
    reasoning: string;
    matched_elements: MatchedElement[];
  };
}

export interface PrecomputedAnswersListResponse {
  status: string;
  total_documents: number;
  documents: Array<{
    document_id: string;
    filename: string;
    total_questions: number;
    source_json: string;
    answers_url: string;
  }>;
}

