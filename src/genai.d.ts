// This file provides TypeScript definitions for the GoogleGenAI library
// which is loaded via a script tag in index.html.

declare namespace GoogleGenAI {
  interface GenerateContentRequest {
    model: string;
    contents: { parts: { text: string }[] }[];
  }

  interface GenerateContentResponse {
    text: string;
    candidates?: any[];
    promptFeedback?: any;
  }

  interface GenerativeModel {
    generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
  }

  interface GoogleAI {
    models: {
      generateContent(request: GenerateContentRequest): Promise<GenerateContentResponse>;
    };
  }
  
  interface GoogleGenAI {
    new (options: { apiKey: string }): GoogleAI;
  }
}

declare global {
  interface Window {
    GoogleGenAI?: {
      GoogleGenAI: GoogleGenAI.GoogleGenAI;
    };
  }
}

export {};
