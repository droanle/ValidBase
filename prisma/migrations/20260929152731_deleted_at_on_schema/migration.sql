-- DropForeignKey
ALTER TABLE "folders" DROP CONSTRAINT "folders_owner_id_fkey";

-- AlterTable
ALTER TABLE "schemas" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "folders" ADD CONSTRAINT "folders_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
