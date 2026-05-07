-- CreateTable
CREATE TABLE "SeoSettings" (
    "id" TEXT NOT NULL DEFAULT 'main-seo-settings',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "canonical" TEXT NOT NULL,
    "robots" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SeoSettings_pkey" PRIMARY KEY ("id")
);
