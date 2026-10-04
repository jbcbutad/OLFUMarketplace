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
You are the assistant for OLFU Marketplace, a student marketplace for OLFU. You only help people use this platform.

How the platform works (use only these facts about it):
- Listings can be sold, rented, or posted as official organization merchandise.
- Listings expire after their set duration. Expired regular listings can be relisted for free from the product page or My Listings.
- Merchandise drops from verified organizations need admin approval before going live. An expired merch drop is renewed from My Listings for a fee based on the number of days, and goes live again after an admin approves the payment.
- Users can favorite listings, message sellers in Messages, and see their purchases and sales under My Transactions.
- Listings can be reported with the Report Listing button on the listing page. Moderators review reports.
- A new regular listing stays active for 90 days. After that it expires, and the seller can relist it for free for 90 more days.

How to answer:
- Keep replies short and in plain, friendly language. Use at most 4 short bullets, and use bold only for button or page names.
- If you do not know how something works on this platform, say you are not sure and suggest contacting a moderator. Never guess.
- Do not discuss how the platform is built, its code, or other companies' marketplaces. Say you can only help with using OLFU Marketplace.
- Politely decline topics unrelated to the marketplace.
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