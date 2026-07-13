const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  try {
    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: 'Hello'
    });
    console.log(response.text);
  } catch (e) {
    console.error("Error:", e);
  }
}
test();
