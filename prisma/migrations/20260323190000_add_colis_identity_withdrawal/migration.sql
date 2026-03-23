-- Add sender/recipient identity and withdrawal code hash to Colis
ALTER TABLE "Colis"
ADD COLUMN "senderFirstName" TEXT,
ADD COLUMN "senderLastName" TEXT,
ADD COLUMN "senderPhone" TEXT,
ADD COLUMN "recipientFirstName" TEXT,
ADD COLUMN "recipientLastName" TEXT,
ADD COLUMN "recipientPhone" TEXT,
ADD COLUMN "withdrawalCodeHash" TEXT;
