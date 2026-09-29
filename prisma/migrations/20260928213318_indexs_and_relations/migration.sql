/*
  Warnings:

  - You are about to drop the column `version` on the `schemas` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[token_hash]` on the table `access_tokens` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "access_tokens" DROP CONSTRAINT "access_tokens_creator_id_fkey";

-- DropForeignKey
ALTER TABLE "documents" DROP CONSTRAINT "documents_folder_id_fkey";

-- AlterTable
ALTER TABLE "access_tokens" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "token_name" TEXT;

-- AlterTable
ALTER TABLE "schemas" DROP COLUMN "version";

-- CreateIndex
CREATE UNIQUE INDEX "access_tokens_token_hash_key" ON "access_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "access_tokens_target_id_target_type_idx" ON "access_tokens"("target_id", "target_type");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_folder_id_fkey" FOREIGN KEY ("folder_id") REFERENCES "folders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_tokens" ADD CONSTRAINT "access_tokens_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
