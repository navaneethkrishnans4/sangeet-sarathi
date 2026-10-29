-- CreateTable
CREATE TABLE "OrderNumber" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "centerNumber" TEXT NOT NULL DEFAULT '4048',
    "city" TEXT,
    "academyName" TEXT,
    "examType" TEXT,
    "examMode" TEXT DEFAULT 'Digital',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderNumber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAcademy" (
    "id" TEXT NOT NULL,
    "uniqueKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "teacherName" TEXT,
    "schoolName" TEXT,
    "primary_email" TEXT,
    "phone" TEXT,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAcademy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherAlias" (
    "id" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,

    CONSTRAINT "TeacherAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "examType" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "instrument" TEXT NOT NULL,
    "expectedFee" DOUBLE PRECISION NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'Pending',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "sessionMonth" TEXT,
    "teacherId" TEXT,
    "orderNumberId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "narration" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reconciledMethod" TEXT,
    "reconciledTeacherId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "sessionMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TempBankTransaction" (
    "id" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3),
    "narration" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "mappedTeacherId" TEXT,
    "matchMethod" TEXT,
    "isRuleSaved" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "sessionMonth" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TempBankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotYetPaid" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "teacherId" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotYetPaid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderNumber_orderNumber_key" ON "OrderNumber"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAcademy_uniqueKey_key" ON "TeacherAcademy"("uniqueKey");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAlias_alias_key" ON "TeacherAlias"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "BankTransaction_narration_key" ON "BankTransaction"("narration");

-- AddForeignKey
ALTER TABLE "TeacherAlias" ADD CONSTRAINT "TeacherAlias_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherAcademy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherAcademy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_orderNumberId_fkey" FOREIGN KEY ("orderNumberId") REFERENCES "OrderNumber"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankTransaction" ADD CONSTRAINT "BankTransaction_reconciledTeacherId_fkey" FOREIGN KEY ("reconciledTeacherId") REFERENCES "TeacherAcademy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TempBankTransaction" ADD CONSTRAINT "TempBankTransaction_mappedTeacherId_fkey" FOREIGN KEY ("mappedTeacherId") REFERENCES "TeacherAcademy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
