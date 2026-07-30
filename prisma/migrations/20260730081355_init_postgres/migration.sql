-- CreateEnum
CREATE TYPE "Category" AS ENUM ('FOUNDATION', 'BLUSH', 'BRONZER', 'HIGHLIGHTER', 'EYESHADOW', 'LIPSTICK', 'SETTING_POWDER');

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "shade" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "price" DECIMAL(65,30) NOT NULL,
    "coverage" TEXT NOT NULL,
    "finish" TEXT NOT NULL,
    "skinType" TEXT NOT NULL,
    "desc" TEXT NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedLook" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "layers" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedLook_pkey" PRIMARY KEY ("id")
);
