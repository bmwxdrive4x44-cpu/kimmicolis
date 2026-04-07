-- Migration: Add professional client support
-- Adds clientType to User and isPriority to Colis

-- Add clientType column to User table (STANDARD or PRO)
ALTER TABLE "User" ADD COLUMN "clientType" TEXT NOT NULL DEFAULT 'STANDARD';

-- Add isPriority flag to Colis for pro parcel prioritization
ALTER TABLE "Colis" ADD COLUMN "isPriority" BOOLEAN NOT NULL DEFAULT false;
