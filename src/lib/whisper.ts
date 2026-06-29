import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import os from 'os';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function transcribeAudio(audioBuffer: Buffer): Promise<string> {
  // Whisper API requires a file stream, so we'll write the buffer to a temporary file
  const tempFilePath = path.join(os.tmpdir(), `audio-${Date.now()}.webm`);
  
  try {
    fs.writeFileSync(tempFilePath, audioBuffer);
    
    const response = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
      language: 'en',
    });

    return response.text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw error;
  } finally {
    // Clean up temporary file
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.error('Failed to delete temp audio file:', e);
      }
    }
  }
}
