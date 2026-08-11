-- AlterTable
ALTER TABLE "etiquetas" ADD COLUMN     "clave" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "etiquetas_clave_key" ON "etiquetas"("clave");

