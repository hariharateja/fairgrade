/**
 * Grader-consistency statistics.
 *
 * Students are spread across TAs roughly at random, so every TA's average on a question
 * should be close to everyone else's. For each TA and question we compare the TA's marks
 * with the marks given by all *other* TAs (Welch's z-test) and report the effect size
 * in standard deviations. A large, significant gap suggests the TA is lenient or harsh.
 */

export type GradePoint = { questionId: string; graderId: string; marks: number };

export type GraderQuestionStat = {
  graderId: string;
  questionId: string;
  n: number;
  mean: number;
  sd: number;
  othersMean: number | null;
  diff: number | null; // mean - othersMean, in marks
  effect: number | null; // diff / pooled sd
  pValue: number | null;
  flag: "lenient" | "harsh" | null;
};

export type QuestionSummary = {
  questionId: string;
  n: number;
  mean: number;
  sd: number;
  graders: GraderQuestionStat[];
};

const MIN_N = 5;
const EFFECT_THRESHOLD = 0.5;
const P_THRESHOLD = 0.05;

export function mean(xs: number[]) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function sd(xs: number[]) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

// Abramowitz-Stegun approximation of erf, accurate to ~1e-7.
function erf(x: number) {
  const sign = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

function twoSidedP(z: number) {
  return 1 - erf(Math.abs(z) / Math.SQRT2);
}

export function summarize(points: GradePoint[], questionIds: string[]): QuestionSummary[] {
  return questionIds.map((questionId) => {
    const qPoints = points.filter((p) => p.questionId === questionId);
    const all = qPoints.map((p) => p.marks);
    const byGrader = new Map<string, number[]>();
    for (const p of qPoints) {
      const list = byGrader.get(p.graderId) ?? [];
      list.push(p.marks);
      byGrader.set(p.graderId, list);
    }

    const graders: GraderQuestionStat[] = [...byGrader.entries()].map(([graderId, xs]) => {
      const others = qPoints.filter((p) => p.graderId !== graderId).map((p) => p.marks);
      const stat: GraderQuestionStat = {
        graderId,
        questionId,
        n: xs.length,
        mean: mean(xs),
        sd: sd(xs),
        othersMean: null,
        diff: null,
        effect: null,
        pValue: null,
        flag: null,
      };
      if (!others.length) return stat;
      stat.othersMean = mean(others);
      stat.diff = stat.mean - stat.othersMean;
      const pooled = sd(all);
      stat.effect = pooled > 0 ? stat.diff / pooled : 0;
      const se = Math.sqrt(sd(xs) ** 2 / xs.length + sd(others) ** 2 / others.length);
      stat.pValue = se > 0 ? twoSidedP(stat.diff / se) : stat.diff === 0 ? 1 : 0;
      if (xs.length >= MIN_N && Math.abs(stat.effect) >= EFFECT_THRESHOLD && stat.pValue < P_THRESHOLD) {
        stat.flag = stat.diff > 0 ? "lenient" : "harsh";
      }
      return stat;
    });

    graders.sort((a, b) => (b.effect ?? 0) - (a.effect ?? 0));
    return { questionId, n: all.length, mean: mean(all), sd: sd(all), graders };
  });
}

/** Histogram of marks into integer-width buckets from 0 to max. */
export function histogram(values: number[], max: number) {
  const buckets = Math.max(1, Math.ceil(max));
  const counts = new Array(buckets).fill(0);
  for (const v of values) {
    const i = Math.min(buckets - 1, Math.max(0, Math.floor(v)));
    counts[i]++;
  }
  return counts as number[];
}
