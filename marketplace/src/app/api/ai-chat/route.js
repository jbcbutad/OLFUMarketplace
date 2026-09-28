import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Helper function to wait/retry if Google servers are overloaded
async function sendMessageWithRetry(chat, message, retries = 3, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const result = await chat.sendMessage({ message });
      return result;
    } catch (error) {
      // Check if it's a 503 high demand/overloaded error
      const isOverloaded = error.status === 503 || (error.message && error.message.includes('high demand'));
      if (isOverloaded && i < retries - 1) {
        console.warn(`Gemini overloaded (503). Retrying attempt ${i + 2} in ${delay}ms...`);
        await new Promise((res) => setTimeout(res, delay));
        delay *= 2; // Double the delay each time (exponential backoff)
      } else {
        throw error;
      }
    }
  }
}

export async function POST(req) {
  try {
    const { history, message } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const systemInstruction = `
      You are the official AI assistant for the OLFU Marketplace platform. 
      Help users navigate listings, handle platform guidelines, and answer questions concisely and friendly.
    `;

    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = ai.chats.create({
      model: 'gemini-3.5-flash',
      history: formattedHistory,
      config: { systemInstruction, temperature: 0.7 }
    });

    // Use retry wrapper to automatically handle temporary 503 traffic spikes
    const result = await sendMessageWithRetry(chat, message);
    const reply = result.text || "I'm sorry, I couldn't process that.";

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('AI Chat Error:', error);
    return NextResponse.json(
      { error: 'The AI model is currently busy due to high traffic. Please try again in a moment.' }, 
      { status: 500 }
    );
  }
}