-- Add support for relay commerce proof documents (JSON serialized list)
ALTER TABLE "Relais"
ADD COLUMN "commerceDocuments" TEXT;
