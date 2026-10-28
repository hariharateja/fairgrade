/**
 * Demo data: one course, two exams, 48 students and five staff.
 * One TA is lenient and one is harsh, so the consistency dashboard has something to find.
 *
 *   npm run seed           (wipes the database first)
 *
 * Every account's password is "password123".
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { randomUUID } from "node:crypto";
import { clearAllObjects, putObject, storageDriver } from "../src/lib/storage";

const db = new PrismaClient();
const PASSWORD = "password123";

// Deterministic randomness so every seed produces the same demo.
let seed = 20261028;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function normal(mu: number, sigma: number) {
  const u = 1 - rand();
  const v = rand();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function pick<T>(xs: T[]) {
  return xs[Math.floor(rand() * xs.length)];
}

const FIRST = ["Aarav", "Diya", "Ishaan", "Ananya", "Kabir", "Meera", "Rohan", "Saanvi", "Vihaan", "Aditi", "Arjun", "Kavya", "Dev", "Nisha", "Karan", "Riya", "Siddharth", "Tara", "Yash", "Pooja", "Nikhil", "Sana", "Varun", "Isha"];
const LAST = ["Sharma", "Iyer", "Reddy", "Patel", "Nair", "Gupta", "Kulkarni", "Banerjee", "Menon", "Joshi", "Rao", "Singh", "Desai", "Chatterjee", "Pillai", "Verma"];

type ItemSpec = { description: string; marks: number };
type QuestionSpec = { label: string; maxMarks: number; prompt: string; modelAnswer: string; items: ItemSpec[] };

const QUIZ: QuestionSpec[] = [
  {
    label: "Q1",
    maxMarks: 4,
    prompt: "Define f(n) = O(g(n)) and show that 3n² + 5n = O(n²).",
    modelAnswer: "f(n)=O(g(n)) iff ∃ c>0, n₀ such that f(n) ≤ c·g(n) ∀ n ≥ n₀. Take c=4, n₀=5: 3n²+5n ≤ 4n² ⇔ 5n ≤ n² ⇔ n ≥ 5.",
    items: [
      { description: "States the formal definition with constants c and n₀", marks: 2 },
      { description: "Shows 3n² + 5n ≤ c·n² with valid c and n₀", marks: 2 },
    ],
  },
  {
    label: "Q2",
    maxMarks: 6,
    prompt: "Give an algorithm to check whether a string of brackets ()[]{} is balanced, and its complexity.",
    modelAnswer: "Scan left to right; push opening brackets; on a closing bracket pop and check it matches; at the end the stack must be empty. O(n) time, O(n) space.",
    items: [
      { description: "Pushes opening brackets onto a stack", marks: 2 },
      { description: "Pops and checks the match on each closing bracket", marks: 2 },
      { description: "Checks the stack is empty at the end", marks: 1 },
      { description: "States O(n) time complexity", marks: 1 },
      { description: "Fails on empty stack when a closing bracket arrives (no check)", marks: -1 },
    ],
  },
];

const MIDSEM: QuestionSpec[] = [
  {
    label: "Q1",
    maxMarks: 8,
    prompt: "Explain how to delete a node from a binary search tree. Cover every case.",
    modelAnswer: "Leaf: remove it. One child: splice the child into the parent. Two children: replace the key with the inorder successor (min of right subtree) and delete that successor. O(h).",
    items: [
      { description: "Handles the leaf case", marks: 2 },
      { description: "Handles the one-child case by splicing", marks: 2 },
      { description: "Handles two children via inorder successor or predecessor", marks: 3 },
      { description: "States the complexity as O(h)", marks: 1 },
    ],
  },
  {
    label: "Q2",
    maxMarks: 10,
    prompt: "Write the recurrence for merge sort and solve it.",
    modelAnswer: "T(n) = 2T(n/2) + Θ(n), T(1) = Θ(1). Master theorem case 2 (a=2, b=2, f(n)=Θ(n)=Θ(n^log_b a)) gives Θ(n log n).",
    items: [
      { description: "Writes T(n) = 2T(n/2) + Θ(n)", marks: 3 },
      { description: "Solves it via master theorem or recursion tree, with steps shown", marks: 4 },
      { description: "Final answer Θ(n log n)", marks: 2 },
      { description: "States the base case", marks: 1 },
      { description: "Arithmetic or algebra error while solving", marks: -1 },
    ],
  },
  {
    label: "Q3",
    maxMarks: 12,
    prompt: "Describe Dijkstra's algorithm and run it from vertex A on the graph in Figure 2.",
    modelAnswer: "dist[A]=0, others ∞; repeatedly extract the min-dist vertex from a priority queue and relax its edges. Final distances A0 B3 C5 D6 E8. O((V+E) log V) with a binary heap.",
    items: [
      { description: "Initialises distances (source 0, all others ∞)", marks: 2 },
      { description: "Uses a min-priority queue keyed by distance", marks: 3 },
      { description: "Correct relaxation step", marks: 3 },
      { description: "Correct trace on the given graph", marks: 3 },
      { description: "States O((V + E) log V)", marks: 1 },
      { description: "Applies it to negative edges without comment", marks: -2 },
    ],
  },
];

// How each TA tends to grade: probability shift for ticking a positive criterion.
const TA_BIAS: Record<string, number> = { rahul: 0.22, priya: -0.24, arjun: 0.02, sneha: -0.03 };

async function answerPhoto(lines: string[]) {
  const width = 1100;
  const lineHeight = 52;
  const height = 120 + lines.length * lineHeight;
  const rules = Array.from({ length: Math.ceil(height / lineHeight) }, (_, i) => `<line x1="0" x2="${width}" y1="${80 + i * lineHeight}" y2="${80 + i * lineHeight}" stroke="#bcd3ee" stroke-width="2"/>`).join("");
  const text = lines
    .map((l, i) => `<text x="90" y="${72 + (i + 1) * lineHeight - 8}" font-family="Bradley Hand, Segoe Print, Comic Sans MS, cursive" font-size="32" fill="#1e2a78">${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" fill="#fbfaf4"/>${rules}
    <line x1="70" x2="70" y1="0" y2="${height}" stroke="#e8a0a0" stroke-width="2"/>${text}</svg>`;
  const name = `${randomUUID()}.jpg`;
  await putObject(name, await sharp(Buffer.from(svg)).jpeg({ quality: 85 }).toBuffer());
  return name;
}

async function main() {
  console.log("Clearing database…");
  await db.$transaction([
    db.gradeHistory.deleteMany(),
    db.crib.deleteMany(),
    db.doubtComment.deleteMany(),
    db.ruling.deleteMany(),
    db.doubt.deleteMany(),
    db.grade.deleteMany(),
    db.allocation.deleteMany(),
    db.rubricItem.deleteMany(),
    db.question.deleteMany(),
    db.exam.deleteMany(),
    db.membership.deleteMany(),
    db.course.deleteMany(),
    db.user.deleteMany(),
  ]);
  // Uploaded photos belong to the rows we just deleted.
  console.log(`Clearing photos (${storageDriver() === "supabase" ? "Supabase Storage" : "local uploads/"})…`);
  await clearAllObjects();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const mkUser = (name: string, email: string, rollNo: string | null = null) =>
    db.user.create({ data: { name, email, rollNo, passwordHash } });

  const instructor = await mkUser("Prof. Anjali Rao", "instructor@demo.edu");
  const headTa = await mkUser("Vikram Shetty", "headta@demo.edu");
  const tas = {
    rahul: await mkUser("Rahul Mehta", "rahul@demo.edu"),
    priya: await mkUser("Priya Krishnan", "priya@demo.edu"),
    arjun: await mkUser("Arjun Bose", "arjun@demo.edu"),
    sneha: await mkUser("Sneha Kapoor", "sneha@demo.edu"),
  };
  const taKeys = Object.keys(tas) as (keyof typeof tas)[];

  const students: Awaited<ReturnType<typeof mkUser>>[] = [];
  for (let i = 1; i <= 48; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const roll = `24B${String(1000 + i).padStart(4, "0")}`;
    students.push(await mkUser(name, i === 1 ? "student@demo.edu" : `student${i}@demo.edu`, roll));
  }

  const course = await db.course.create({
    data: {
      code: "CS 213",
      name: "Data Structures and Algorithms",
      term: "Autumn 2026",
      ownerId: instructor.id,
      studentJoinCode: "DSA2026S",
      taJoinCode: "DSA2026T",
      memberships: {
        create: [
          { userId: instructor.id, role: "INSTRUCTOR" },
          { userId: headTa.id, role: "HEAD_TA" },
          ...taKeys.map((k) => ({ userId: tas[k].id, role: "TA" })),
          ...students.map((s) => ({ userId: s.id, role: "STUDENT" })),
        ],
      },
    },
  });

  // Each student has an underlying ability so marks correlate across questions.
  const ability = new Map(students.map((s) => [s.id, Math.min(0.97, Math.max(0.15, normal(0.64, 0.17)))]));

  async function buildExam(opts: { title: string; status: string; specs: QuestionSpec[]; gradedShare: number; deadlineDays?: number }) {
    const total = opts.specs.reduce((s, q) => s + q.maxMarks, 0);
    const exam = await db.exam.create({
      data: {
        courseId: course.id,
        title: opts.title,
        totalMarks: total,
        status: opts.status,
        cribDeadline: opts.deadlineDays ? new Date(Date.now() + opts.deadlineDays * 86400000) : null,
      },
    });
    const questions = [];
    for (const [order, spec] of opts.specs.entries()) {
      questions.push(
        await db.question.create({
          data: {
            examId: exam.id,
            label: spec.label,
            order,
            maxMarks: spec.maxMarks,
            prompt: spec.prompt,
            modelAnswer: spec.modelAnswer,
            rubricItems: { create: spec.items.map((it, i) => ({ ...it, order: i })) },
          },
          include: { rubricItems: true },
        }),
      );
    }

    // Even, random allocation across the four TAs.
    const shuffled = [...students].sort(() => rand() - 0.5);
    const allocation = new Map<string, keyof typeof tas>();
    shuffled.forEach((s, i) => allocation.set(s.id, taKeys[i % taKeys.length]));
    await db.allocation.createMany({
      data: shuffled.map((s) => ({ examId: exam.id, studentId: s.id, taId: tas[allocation.get(s.id)!].id })),
    });

    const gradedStudents = shuffled.slice(0, Math.round(shuffled.length * opts.gradedShare));
    for (const s of gradedStudents) {
      const taKey = allocation.get(s.id)!;
      for (const q of questions) {
        const applied: string[] = [];
        for (const item of q.rubricItems) {
          if (item.marks > 0) {
            const p = (ability.get(s.id) ?? 0.6) + normal(0, 0.12) + TA_BIAS[taKey];
            if (rand() < p) applied.push(item.id);
          } else {
            // Harsh graders apply deductions more often, lenient ones less.
            const p = 0.14 - TA_BIAS[taKey] * 0.4;
            if (rand() < p) applied.push(item.id);
          }
        }
        const sum = q.rubricItems.filter((i) => applied.includes(i.id)).reduce((a, i) => a + i.marks, 0);
        await db.grade.create({
          data: {
            examId: exam.id,
            questionId: q.id,
            studentId: s.id,
            graderId: tas[taKey].id,
            marks: Math.min(q.maxMarks, Math.max(0, sum)),
            appliedItemIds: JSON.stringify(applied),
          },
        });
      }
    }
    return { exam, questions };
  }

  console.log("Creating Quiz 1 (results published)…");
  const quiz = await buildExam({ title: "Quiz 1", status: "PUBLISHED", specs: QUIZ, gradedShare: 1, deadlineDays: 5 });
  console.log("Creating Midsem (grading in progress)…");
  const mid = await buildExam({ title: "Midsem", status: "GRADING", specs: MIDSEM, gradedShare: 0.7 });

  // Make sure the demo student has a crib-worthy Quiz 1 Q2: graded by Priya without the stack-empty check.
  const demoStudent = students[0];
  const quizQ2 = quiz.questions[1];
  const stackEmpty = quizQ2.rubricItems.find((i) => i.description.startsWith("Checks the stack"))!;
  const q2Applied = quizQ2.rubricItems.filter((i) => i.marks > 0 && i.id !== stackEmpty.id).map((i) => i.id);
  await db.allocation.update({
    where: { examId_studentId: { examId: quiz.exam.id, studentId: demoStudent.id } },
    data: { taId: tas.priya.id },
  });
  await db.grade.updateMany({ where: { examId: quiz.exam.id, studentId: demoStudent.id }, data: { graderId: tas.priya.id } });
  await db.grade.update({
    where: { questionId_studentId: { questionId: quizQ2.id, studentId: demoStudent.id } },
    data: { appliedItemIds: JSON.stringify(q2Applied), marks: 5, comment: "Good, but see the end condition." },
  });

  // Rulings
  const midQ1 = mid.questions[0];
  const midQ3 = mid.questions[2];
  await db.ruling.createMany({
    data: [
      { questionId: midQ1.id, text: "Using the inorder predecessor instead of the successor is equally correct: award the full 3 marks for the two-children case.", createdById: instructor.id },
      { questionId: midQ3.id, text: "If the trace has a single arithmetic slip but the order of extraction is right, give 2 of the 3 trace marks.", createdById: headTa.id },
      { questionId: quizQ2.id, text: "A counter-based solution works only for one bracket type: no marks for 'pops and checks the match', full marks otherwise if correct.", createdById: instructor.id },
    ],
  });

  // Doubts on the midsem
  const midGraded = await db.grade.findMany({ where: { examId: mid.exam.id }, select: { studentId: true }, distinct: ["studentId"] });
  const gradedIds = new Set(midGraded.map((g) => g.studentId));
  const pendingForRahul = (await db.allocation.findMany({ where: { examId: mid.exam.id, taId: tas.rahul.id } }))
    .map((a) => a.studentId)
    .filter((id) => !gradedIds.has(id));
  const pendingForPriya = (await db.allocation.findMany({ where: { examId: mid.exam.id, taId: tas.priya.id } }))
    .map((a) => a.studentId)
    .filter((id) => !gradedIds.has(id));

  const photo1 = await answerPhoto([
    "Q1. Deleting a node z from a BST:",
    "case 1: z is a leaf -> just remove it, set parent ptr = NULL",
    "case 2: z has 1 child -> connect parent of z to the child",
    "case 3: z has 2 children -> find max of LEFT subtree (pred.)",
    "         copy its key into z, then delete the pred. node",
    "Time: we walk down one path so it is O(height)",
  ]);
  const q1 = midQ1;
  const item = (q: typeof q1, prefix: string) => q.rubricItems.find((i) => i.description.startsWith(prefix))!.id;
  const doubt1 = await db.doubt.create({
    data: {
      examId: mid.exam.id,
      questionId: q1.id,
      studentId: pendingForRahul[0] ?? null,
      raisedById: tas.rahul.id,
      note: "Student used the inorder predecessor instead of the successor. Full marks for case 3?",
      imagePaths: JSON.stringify([photo1]),
      status: "RESOLVED",
      aiMode: "live",
      aiMarks: 8,
      aiConfidence: "high",
      aiTranscription:
        "Q1. Deleting a node z from a BST:\ncase 1: z is a leaf → just remove it, set parent ptr = NULL\ncase 2: z has 1 child → connect parent of z to the child\ncase 3: z has 2 children → find max of LEFT subtree (pred.), copy its key into z, then delete the pred. node\nTime: we walk down one path so it is O(height)",
      aiAnalysis: JSON.stringify({
        criteria: [
          { rubricItemId: item(q1, "Handles the leaf"), status: "met", marksAwarded: 2, evidence: "\"z is a leaf -> just remove it, set parent ptr = NULL\"" },
          { rubricItemId: item(q1, "Handles the one-child"), status: "met", marksAwarded: 2, evidence: "\"connect parent of z to the child\" is splicing." },
          { rubricItemId: item(q1, "Handles two children"), status: "met", marksAwarded: 3, evidence: "Uses max of left subtree (inorder predecessor); the criterion explicitly allows the predecessor." },
          { rubricItemId: item(q1, "States the complexity"), status: "met", marksAwarded: 1, evidence: "\"O(height)\"" },
        ],
        rationale: "All four cases are handled correctly. The criterion for two children names the predecessor as acceptable, and a staff ruling confirms full marks.",
        proposedRuling: "",
        needsHumanReview: false,
      }),
      finalMarks: 8,
      resolutionNote: "Matches the ruling on predecessor vs successor.",
      resolvedById: tas.rahul.id,
      resolvedAt: new Date(Date.now() - 3 * 3600000),
    },
  });
  if (doubt1.studentId) {
    await db.grade.create({
      data: {
        examId: mid.exam.id,
        questionId: q1.id,
        studentId: doubt1.studentId,
        graderId: tas.rahul.id,
        marks: 8,
        appliedItemIds: JSON.stringify(q1.rubricItems.map((i) => i.id)),
      },
    });
  }

  const midQ2 = mid.questions[1];
  const photo2 = await answerPhoto([
    "Q2. Merge sort splits into 2 halves and merges in linear time",
    "T(n) = 2T(n/2) + cn",
    "Guess T(n) <= k n log n. Substitute:",
    "T(n) <= 2 k (n/2) log(n/2) + cn = k n log n - k n + c n",
    "     <= k n log n  when k >= c",
    "So T(n) = O(n log n)",
  ]);
  await db.doubt.create({
    data: {
      examId: mid.exam.id,
      questionId: midQ2.id,
      studentId: pendingForPriya[0] ?? null,
      raisedById: tas.priya.id,
      note: "Used the substitution method, not master theorem or recursion tree. Rubric only names those two. Does criterion 2 apply?",
      imagePaths: JSON.stringify([photo2]),
      status: "ESCALATED",
      aiMode: "live",
      aiMarks: 8,
      aiConfidence: "medium",
      aiTranscription:
        "Q2. Merge sort splits into 2 halves and merges in linear time\nT(n) = 2T(n/2) + cn\nGuess T(n) ≤ k n log n. Substitute:\nT(n) ≤ 2k(n/2)log(n/2) + cn = k n log n − kn + cn ≤ k n log n when k ≥ c\nSo T(n) = O(n log n)",
      aiAnalysis: JSON.stringify({
        criteria: [
          { rubricItemId: item(midQ2, "Writes T(n)"), status: "met", marksAwarded: 3, evidence: "\"T(n) = 2T(n/2) + cn\"" },
          { rubricItemId: item(midQ2, "Solves it"), status: "partial", marksAwarded: 3, evidence: "Valid substitution proof with steps, but the rubric names only master theorem or recursion tree, and the proof gives only an upper bound." },
          { rubricItemId: item(midQ2, "Final answer"), status: "partial", marksAwarded: 1, evidence: "Concludes O(n log n), not Θ(n log n)." },
          { rubricItemId: item(midQ2, "States the base"), status: "not_met", marksAwarded: 0, evidence: "No base case stated." },
          { rubricItemId: item(midQ2, "Arithmetic"), status: "not_met", marksAwarded: 0, evidence: "Algebra is correct." },
        ],
        rationale:
          "The substitution method is a correct, rigorous technique, but the rubric does not say whether it earns the 4 marks for solving, and the student only proves an upper bound. This needs an instructor decision so all TAs treat substitution the same way.",
        proposedRuling: "Accept the substitution method as equivalent to master theorem / recursion tree for criterion 2 when every step is shown; proving only O(·) instead of Θ(·) gets 1 of the 2 final-answer marks.",
        needsHumanReview: true,
      }),
      comments: {
        create: [
          { authorId: tas.arjun.id, body: "I had two scripts like this too and gave full marks for solving. Would be good to have a ruling." },
          { authorId: tas.sneha.id, body: "Same here, but I took a mark off for O vs Θ." },
        ],
      },
    },
  });

  // Cribs on Quiz 1
  const quizQ1 = quiz.questions[0];
  const otherGrades = await db.grade.findMany({
    where: { examId: quiz.exam.id, questionId: quizQ1.id, studentId: { not: demoStudent.id }, graderId: tas.priya.id },
    take: 3,
  });
  if (otherGrades[0]) {
    const g = otherGrades[0];
    const missing = quizQ1.rubricItems.find((i) => !JSON.parse(g.appliedItemIds).includes(i.id));
    await db.crib.create({
      data: {
        examId: quiz.exam.id,
        questionId: quizQ1.id,
        gradeId: g.id,
        studentId: g.studentId,
        rubricItemId: missing?.id ?? null,
        reason: "I wrote the definition with c and n₀ in the second line of my answer (\"there exist c, n0 > 0 such that…\"). It seems to have been missed.",
        reviewerId: headTa.id,
        marksBefore: g.marks,
        aiMode: "live",
        aiVerdict: "likely_valid",
        aiSuggestedMarks: Math.min(4, g.marks + (missing?.marks ?? 0)),
        aiAnalysis: "The student quotes a complete formal definition with both constants. If the script contains that line, the first criterion is met and should be awarded. Recommend checking the second line of the answer.",
      },
    });
  }
  if (otherGrades[1]) {
    const g = otherGrades[1];
    await db.crib.create({
      data: {
        examId: quiz.exam.id,
        questionId: quizQ1.id,
        gradeId: g.id,
        studentId: g.studentId,
        reason: "I think my answer deserves more marks because I wrote a lot and explained the idea of Big-O in detail with examples.",
        reviewerId: tas.arjun.id,
        marksBefore: g.marks,
        marksAfter: g.marks,
        status: "REJECTED",
        response: "Length isn't a rubric criterion. Your answer doesn't give explicit c and n₀, so criterion 2 can't be awarded.",
        resolvedAt: new Date(Date.now() - 86400000),
        aiMode: "live",
        aiVerdict: "likely_invalid",
        aiAnalysis: "The request doesn't cite a rubric criterion and argues from answer length. Under the rubric, marks depend on stating the definition and exhibiting valid constants.",
      },
    });
  }

  console.log("\nDone. Log in with any of these (password: password123):");
  console.log("  instructor@demo.edu   Instructor");
  console.log("  headta@demo.edu       Head TA");
  console.log("  rahul@demo.edu        TA (lenient)");
  console.log("  priya@demo.edu        TA (harsh)");
  console.log("  arjun@demo.edu, sneha@demo.edu   TAs");
  console.log("  student@demo.edu      Student (has a Quiz 1 mark worth a crib)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
