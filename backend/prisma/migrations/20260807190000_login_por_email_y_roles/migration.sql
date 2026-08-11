-- CreateEnum
CREATE TYPE "RolAdmin" AS ENUM ('super_admin', 'admin');

-- AlterTable
ALTER TABLE "administradores" ADD COLUMN     "email" TEXT,
ADD COLUMN     "rol" "RolAdmin" NOT NULL DEFAULT 'admin';

-- CreateIndex
CREATE UNIQUE INDEX "administradores_email_key" ON "administradores"("email");

