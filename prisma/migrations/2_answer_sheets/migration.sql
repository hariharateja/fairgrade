-- CreateTable
CREATE TABLE "AnswerSheet" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnswerSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AnswerSheet_examId_studentId_key" ON "AnswerSheet"("examId", "studentId");

-- AddForeignKey
ALTER TABLE "AnswerSheet" ADD CONSTRAINT "AnswerSheet_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerSheet" ADD CONSTRAINT "AnswerSheet_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnswerSheet" ADD CONSTRAINT "AnswerSheet_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Keep the new table away from Supabase's public Data API, like every other table.
ALTER TABLE "AnswerSheet" ENABLE ROW LEVEL SECURITY;
