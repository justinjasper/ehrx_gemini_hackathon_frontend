import {
  DocumentSummary,
  OntologyDocument,
  PrecomputedAnswer,
  PrecomputedAnswersListResponse,
  QueryResponse,
  SampleDocumentsResponse,
  UploadResponse
} from "./types";
import { appConfig } from "./config";

const API_BASE_URL = appConfig.apiBaseUrl;

const withBase = (path: string) => `${API_BASE_URL}${path}`;

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      message || `Request failed with status ${response.status}`
    );
  }
  return response.json() as Promise<T>;
}

export async function uploadDocument(
  file: File,
  pageRange: string,
  documentType: string
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("page_range", pageRange);
  formData.append("document_type", documentType);

  const response = await fetch(withBase("/upload"), {
    method: "POST",
    body: formData
  });
  return handleResponse<UploadResponse>(response);
}

export async function fetchDocuments(): Promise<{
  documents: DocumentSummary[];
}> {
  const response = await fetch(withBase("/documents"));
  return handleResponse<{ documents: DocumentSummary[] }>(response);
}

export async function fetchOntology(
  documentId: string
): Promise<OntologyDocument> {
  const response = await fetch(
    withBase(`/documents/${encodeURIComponent(documentId)}/ontology`)
  );
  return handleResponse<OntologyDocument>(response);
}

export async function queryDocument(
  documentId: string,
  question: string
): Promise<QueryResponse> {
  const response = await fetch(
    withBase(`/documents/${encodeURIComponent(documentId)}/query`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    }
  );
  return handleResponse<QueryResponse>(response);
}

export async function fetchSampleDocuments(): Promise<SampleDocumentsResponse> {
  const response = await fetch(withBase("/sample-documents"));
  return handleResponse<SampleDocumentsResponse>(response);
}

export async function processSampleDocument(
  filename: string,
  pageRange: string,
  documentType: string
): Promise<
  UploadResponse & {
    source?: string;
    filename?: string;
  }
> {
  const formData = new FormData();
  formData.append("page_range", pageRange);
  formData.append("document_type", documentType);

  const response = await fetch(
    withBase(
      `/sample-documents/${encodeURIComponent(filename)}/process`
    ),
    {
      method: "POST",
      body: formData
    }
  );

  return handleResponse(response);
}

export async function fetchSamplePdf(filename: string): Promise<File> {
  const response = await fetch(
    withBase(`/sample-documents/${encodeURIComponent(filename)}`)
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch sample PDF: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new File([blob], filename, { type: "application/pdf" });
}

export async function listPrecomputedAnswers(): Promise<PrecomputedAnswersListResponse> {
  const response = await fetch(withBase("/precomputed-answers"));
  return handleResponse<PrecomputedAnswersListResponse>(response);
}

export async function getPrecomputedAnswers(
  documentId: string
): Promise<PrecomputedAnswer> {
  const response = await fetch(
    withBase(`/precomputed-answers/${encodeURIComponent(documentId)}`)
  );
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        `Precomputed answers not found for document: ${documentId}`
      );
    }
    throw new Error(
      `Failed to get precomputed answers: ${response.statusText}`
    );
  }
  return handleResponse<PrecomputedAnswer>(response);
}

