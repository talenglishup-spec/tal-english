export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]|_/g, "") // Remove punctuation
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim();
}

type ScoreResult = {
  score: number;
  feedback: string;
  matched_text?: string;
};

export function calculateScore(
  target: string,
  actual: string,
  variations: string[] = [],
  keyword: string = ""
): ScoreResult {
  const normalizedActual = normalizeText(actual);

  if (!normalizedActual) return { score: 0, feedback: "No speech detected." };

  // 1. Prepare candidate targets (Target + Variations)
  const candidates = [target, ...variations].map(t => normalizeText(t)).filter(t => t.length > 0);

  if (candidates.length === 0) return { score: 0, feedback: "No targets defined." };

  // 2. Find best match among candidates
  let maxScore = 0;
  let bestMatch = "";

  for (const cand of candidates) {
    const distance = levenshteinDistance(cand, normalizedActual);
    const maxLength = Math.max(cand.length, normalizedActual.length);
    const similarity = maxLength === 0 ? 0 : Math.max(0, 100 * (1 - distance / maxLength));

    if (similarity > maxScore) {
      maxScore = similarity;
      bestMatch = cand;
    }
  }

  // 3. Round score
  let score = Math.round(maxScore);

  // 4. Keyword Check (Auxiliary)
  let keywordFeedback = "";
  if (keyword) {
    const normKeyword = normalizeText(keyword);
    if (!normalizedActual.includes(normKeyword)) {
      // Penalty or just feedback? User said "Auxiliary score/feedback"
      // Let's deduct a small amount if main score is high but keyword missing, 
      // or just warn in feedback.
      keywordFeedback = ` (Keyword missing: "${keyword}")`;
      if (score > 80) score -= 10; // Penalize perfection if keyword missing
    } else {
      // Bonus?
      if (score < 90) score += 5;
    }
  }

  // Clamp score
  score = Math.min(100, Math.max(0, score));

  // 5. Generate Feedback
  let feedback = "Excellent!";
  if (score < 50) feedback = "Try again!";
  else if (score < 80) feedback = "Good, but can be better!";

  if (keywordFeedback) feedback += keywordFeedback;

  return { score, feedback, matched_text: bestMatch };
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          Math.min(
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1 // deletion
          )
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
