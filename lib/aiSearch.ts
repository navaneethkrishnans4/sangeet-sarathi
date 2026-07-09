import { app } from './firebase';
import { getGenerativeModel, Schema, SchemaType, getAI } from "firebase/ai";

export async function performAISearch(
    query: string,
    catalog: { id: string; name: string; description: string; category: string }[],
    base64Image?: string,
    mimeType?: string
): Promise<string[]> {
    if (!app || Object.keys(app).length === 0) {
        throw new Error("Firebase app is not initialized. Please ensure your Firebase API keys are set.");
    }

    const ai = getAI(app);

    // Initialize the model. We use gemini-2.5-flash for speed and multimodal capabilities.
    const model = getGenerativeModel(ai, {
        model: "gemini-2.5-flash",
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: SchemaType.ARRAY,
                description: "List of product IDs that match the search intent",
                items: {
                    type: SchemaType.STRING
                }
            } as Schema
        }
    });

    const promptText = `
You are a smart search assistant for a musical instrument store.
You need to return a JSON array of product IDs that best match the user's search query or image.
Handle misspellings (e.g., 'thabla' -> 'tabla') and semantic synonyms (e.g., 'plastic sheet' -> 'plastic head').
If an image is provided, identify the instrument in the image and return the matching product IDs from the catalog.

Here is the store catalog in JSON format:
${JSON.stringify(catalog, null, 2)}

User's search query: "${query}"
`;

    const prompt: any[] = [promptText];

    if (base64Image && mimeType) {
        prompt.push({
            inlineData: {
                data: base64Image,
                mimeType: mimeType
            }
        });
    }

    let retries = 3;
    let delay = 1000;

    while (retries > 0) {
        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            const ids = JSON.parse(responseText);
            return Array.isArray(ids) ? ids : [];
        } catch (error: any) {
            const isOverloaded = error?.message?.includes("429") || 
                               error?.message?.includes("OVERLOADED") ||
                               error?.status === 429;
                               
            if (isOverloaded && retries > 1) {
                retries--;
                console.warn(`AI Search overloaded, retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            } else {
                console.error("AI Search Error:", error);
                return [];
            }
        }
    }
    return [];
}
