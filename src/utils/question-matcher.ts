import fs from 'fs';
import path from 'path';

const MASTER_PATH = path.join(process.cwd(), 'data/questions/question_master.csv');
const ALIAS_PATH = path.join(process.cwd(), 'data/questions/question_aliases.csv');
const CANDIDATE_PATH = path.join(process.cwd(), 'data/questions/question_new_candidates.csv');

interface MasterQuestion {
    id: string;
    question_en: string;
    intent_type: string;
    notes: string;
}

interface Alias {
    alias_id: string;
    alias_text: string;
    master_id: string;
}

export interface MatchResult {
    matched_id: string | null;  // Can be Master ID (Q01) or Alias ID (Q01-1)
    master_id: string | null;   // Always the Master ID (Q01)
    confidence: number;
    match_type: 'exact' | 'fuzzy' | 'none';
    suggested_id?: string;
}

/**
 * Basic Normalization: lowercase, remove punctuation, trim.
 */
export function normalize(text: string): string {
    return text
        .toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}

/**
 * Standard Levenshtein Distance
 */
function levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) matrix[i] = [i];
    for (let j = 0; j <= len2; j++) matrix[0][j] = j;

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }
    return matrix[len1][len2];
}

/**
 * Calculate Similarity Score (0 to 100)
 */
function calculateSimilarity(s1: string, s2: string): number {
    const n1 = normalize(s1);
    const n2 = normalize(s2);
    if (n1 === n2) return 100;
    
    const distance = levenshteinDistance(n1, n2);
    const maxLength = Math.max(n1.length, n2.length);
    if (maxLength === 0) return 0;
    
    return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Load CSV Helpers (Simple Parser)
 */
function loadMaster(): MasterQuestion[] {
    if (!fs.existsSync(MASTER_PATH)) return [];
    const content = fs.readFileSync(MASTER_PATH, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0).slice(1);
    return lines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return {
            id: (parts[0] || '').replace(/^"|"$/g, ''),
            question_en: (parts[1] || '').replace(/^"|"$/g, ''),
            intent_type: (parts[2] || '').replace(/^"|"$/g, ''),
            notes: (parts[3] || '').replace(/^"|"$/g, '')
        };
    });
}

function loadAliases(): Alias[] {
    if (!fs.existsSync(ALIAS_PATH)) return [];
    const content = fs.readFileSync(ALIAS_PATH, 'utf-8');
    const lines = content.split('\n').filter(l => l.trim().length > 0).slice(1);
    return lines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return {
            alias_id: (parts[0] || '').replace(/^"|"$/g, ''),
            alias_text: (parts[1] || '').replace(/^"|"$/g, ''),
            master_id: (parts[2] || '').replace(/^"|"$/g, '')
        };
    });
}

/**
 * Logic:
 * 1. Exact match against Master and Alias
 * 2. Fuzzy match against Master and Alias
 */
export function findBestMatch(inputText: string): MatchResult {
    const masters = loadMaster();
    const aliases = loadAliases();
    const normalizedInput = normalize(inputText);

    // 1. Exact Match - Alias Priority
    for (const a of aliases) {
        if (normalize(a.alias_text) === normalizedInput) {
            return { matched_id: a.alias_id, master_id: a.master_id, confidence: 100, match_type: 'exact' };
        }
    }
    for (const m of masters) {
        if (normalize(m.question_en) === normalizedInput) {
            return { matched_id: m.id, master_id: m.id, confidence: 100, match_type: 'exact' };
        }
    }

    // 2. Fuzzy Match
    let bestMatch: { matched_id: string, master_id: string, score: number } | null = null;

    // Check against Alias (Higher specificity)
    for (const a of aliases) {
        const score = calculateSimilarity(a.alias_text, inputText);
        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { matched_id: a.alias_id, master_id: a.master_id, score };
        }
    }
    // Check against Master
    for (const m of masters) {
        const score = calculateSimilarity(m.question_en, inputText);
        if (!bestMatch || score > bestMatch.score) {
            bestMatch = { matched_id: m.id, master_id: m.id, score };
        }
    }

    if (bestMatch && bestMatch.score >= 85) {
        return { 
            matched_id: bestMatch.matched_id, 
            master_id: bestMatch.master_id, 
            confidence: bestMatch.score, 
            match_type: 'fuzzy' 
        };
    }

    // Low confidence suggestion
    return {
        matched_id: null,
        master_id: null,
        confidence: bestMatch ? bestMatch.score : 0,
        match_type: 'none',
        suggested_id: bestMatch ? bestMatch.matched_id : undefined
    };
}

/**
 * Record failure to Candidate CSV
 */
export async function recordCandidate(rawText: string, suggestedId?: string) {
    if (!fs.existsSync(CANDIDATE_PATH)) {
        fs.writeFileSync(CANDIDATE_PATH, '"raw_text","hit_count","last_seen","suggested_id"\n');
    }

    const content = fs.readFileSync(CANDIDATE_PATH, 'utf-8');
    const lines = content.split('\n');
    const headers = lines[0];
    const dataLines = lines.slice(1).filter(l => l.trim().length > 0);
    
    let found = false;
    const newDataLines = dataLines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        const text = parts[0].replace(/^"|"$/g, '');
        if (normalize(text) === normalize(rawText)) {
            found = true;
            const count = parseInt(parts[1].replace(/^"|"$/g, '')) + 1;
            return `"${text}","${count}","${new Date().toISOString()}","${suggestedId || (parts[3] || '').replace(/^"|"$/g, '')}"`;
        }
        return line;
    });

    if (!found) {
        newDataLines.push(`"${rawText}","1","${new Date().toISOString()}","${suggestedId || ''}"`);
    }

    const newContent = [headers, ...newDataLines].join('\n') + '\n';
    fs.writeFileSync(CANDIDATE_PATH, newContent);
}
