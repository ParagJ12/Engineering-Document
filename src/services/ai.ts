import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface DocumentAnalysis {
  documentType: string;
  summary: string;
  keyInsights: string[];
}

function getSafeMimeType(mimeType: string, fileName: string): string {
  if (mimeType && (mimeType.startsWith('image/') || mimeType === 'application/pdf' || mimeType.startsWith('text/'))) {
    return mimeType;
  }
  
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'text/csv';
  if (ext === 'txt' || ext === 'step' || ext === 'stp' || ext === 'iges' || ext === 'igs') return 'text/plain';
  
  // Default to text/plain for unknown CAD files so Gemini attempts to read any plaintext metadata
  return 'text/plain';
}

export async function analyzeDocument(
  fileData: string,
  mimeType: string,
  fileName: string
): Promise<DocumentAnalysis> {
  const safeMimeType = getSafeMimeType(mimeType, fileName);

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview", // Upgraded from lite to flash for better accuracy
    contents: {
      parts: [
        {
          inlineData: {
            data: fileData,
            mimeType: safeMimeType,
          },
        },
        {
          text: `Analyze this engineering document named "${fileName}". 
CRITICAL INSTRUCTION: You must base your entire analysis STRICTLY on the provided document. Do NOT hallucinate, invent, or assume any details, numbers, or features that are not explicitly in the text.

1. Identify its specific type (e.g., Bill of Materials, Feasibility Report, Design Specification, Research Paper, CAD Model, Assembly, etc.).
2. Provide a concise 2-3 sentence technical summary of its contents. Be highly accurate.
3. Extract 3-5 Key Insights tailored to the document type. 
   - If information is missing, state "Not specified in document" rather than guessing.
   - If BOM: focus on cost, component count, and supplier dependencies.
   - If Feasibility Report: focus on risks, timelines, and blockers.
   - If Design Spec: focus on component breakdown and architecture.
   - If CAD/Drawing: focus on part complexity, materials, and structural role.`,
        },
      ],
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: {
            type: Type.STRING,
            description: "The specific type of the engineering document.",
          },
          summary: {
            type: Type.STRING,
            description: "A concise 2-3 sentence technical summary of the document's contents.",
          },
          keyInsights: {
            type: Type.ARRAY,
            items: {
              type: Type.STRING,
            },
            description: "3-5 key insights specialized for the document type.",
          },
        },
        required: ["documentType", "summary", "keyInsights"],
      },
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error("Failed to analyze document.");
  }

  return JSON.parse(text) as DocumentAnalysis;
}

export async function generateRoleSummary(
  fileData: string,
  mimeType: string,
  fileName: string,
  role: string,
  roleDescription: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const safeMimeType = getSafeMimeType(mimeType, fileName);

  const prompt = `Act as a highly experienced ${role}. Your task is to analyze the provided engineering document named "${fileName}" and generate a professional, industry-standard artifact.

Role Context: ${roleDescription}

CRITICAL ANTI-HALLUCINATION INSTRUCTIONS:
- Base your entire response STRICTLY on the provided document.
- Do NOT hallucinate, invent, or assume features, metrics, timelines, or requirements that are not explicitly stated or directly inferable from the text.
- If critical information required for your artifact is missing from the document, explicitly state "[Information not provided in the source document]" instead of making it up.
- Maintain 90%+ factual accuracy to the source material.

Instructions:
1. Think and write EXACTLY like a senior ${role} would. Use the appropriate terminology, structure, and tone.
2. If you are a Product Manager, output a structured Product Requirements Document (PRD) (Context, Problem, Goals, User Stories, Requirements).
3. If you are an Engineer, output a Technical Specification (Architecture, Components, Data Models, APIs, Constraints).
4. If you are an Investor/Leadership, output an Executive Summary & Risk Analysis (ROI, Market Opportunity, Cost Drivers, Supply Chain Risks).
5. If you are Operations, output a Manufacturing & Supply Chain Plan (BOM analysis, Supplier dependencies, Logistics, Assembly steps).

If the file is a CAD model or drawing (e.g., .prt, .asm, .drw), extract whatever metadata, part names, or structure you can find and infer the business context relevant to this role without inventing fake dimensions or materials.

Format the output in clean Markdown with clear headings, bullet points, and actionable takeaways. Do not include generic AI filler. Get straight to the point.`;

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3.1-pro-preview", // Keep pro for high-quality generation
    contents: {
      parts: [
        {
          inlineData: {
            data: fileData,
            mimeType: safeMimeType,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  });

  let fullText = "";
  for await (const chunk of responseStream) {
    if (chunk.text) {
      fullText += chunk.text;
      if (onChunk) {
        onChunk(fullText);
      }
    }
  }

  return fullText;
}

export async function chatWithDocument(
  fileData: string,
  mimeType: string,
  fileName: string,
  history: { role: 'user' | 'model', content: string }[],
  message: string,
  onChunk?: (text: string) => void
): Promise<string> {
  const safeMimeType = getSafeMimeType(mimeType, fileName);
  
  const chatHistoryParts = history.map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.content}`).join('\n\n');
  
  const prompt = `You are an AI assistant helping a user understand an engineering document named "${fileName}".
Here is the conversation history so far:
${chatHistoryParts}

User's new question: ${message}

CRITICAL INSTRUCTION: Answer the user's question STRICTLY based on the provided document. 
- Do NOT hallucinate or bring in outside information unless explicitly asked to explain a concept mentioned in the text.
- If the answer is not contained within the document, explicitly state: "I cannot find this information in the provided document."
- Be concise, highly accurate, and helpful. Format your response in Markdown if appropriate.`;

  const responseStream = await ai.models.generateContentStream({
    model: "gemini-3-flash-preview", // Faster model for chat
    contents: {
      parts: [
        {
          inlineData: {
            data: fileData,
            mimeType: safeMimeType,
          },
        },
        {
          text: prompt,
        },
      ],
    },
  });

  let fullText = "";
  for await (const chunk of responseStream) {
    if (chunk.text) {
      fullText += chunk.text;
      if (onChunk) {
        onChunk(fullText);
      }
    }
  }

  return fullText;
}
