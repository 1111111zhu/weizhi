ALTER TABLE "users"
  ADD COLUMN "staff_no" TEXT,
  ADD COLUMN "hourly_rate" DECIMAL(18, 2);

CREATE UNIQUE INDEX "users_staff_no_key" ON "users"("staff_no");
