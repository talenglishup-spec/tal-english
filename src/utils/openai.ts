import OpenAI from 'openai';

export const getOpenAI = () => {
    const apiKey = (process.env.OPENAI_API_KEY || '').trim();
    
    // Log safe parts of the key to debug 401
    const safeKey = apiKey.length > 10 
        ? `${apiKey.substring(0, 7)}...${apiKey.substring(apiKey.length - 4)}` 
        : '(too short)';
    console.log(`[OpenAI Init] API Key present: ${!!apiKey}, Length: ${apiKey.length}, SafeKey: ${safeKey}`);

    if (!apiKey) {
        throw new Error("OpenAI API Key missing (OPENAI_API_KEY).");
    }
    return new OpenAI({
        apiKey: apiKey,
    });
};
