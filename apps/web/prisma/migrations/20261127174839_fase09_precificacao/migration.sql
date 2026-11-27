-- CreateEnum
CREATE TYPE "GrupoComercial" AS ENUM ('MATERIAL', 'SOFTWARE');

-- CreateEnum
CREATE TYPE "ModoDePreco" AS ENUM ('VENDA_FIXA', 'CUSTO_REGRA');

-- AlterEnum
ALTER TYPE "EstagioDeRegra" ADD VALUE 'SERVICO';

-- AlterTable
ALTER TABLE "itens_de_catalogo" ADD COLUMN     "grupoComercial" "GrupoComercial" NOT NULL DEFAULT 'MATERIAL';

-- CreateTable
CREATE TABLE "precos_dos_itens" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "custo" DECIMAL(14,4),
    "modo" "ModoDePreco" NOT NULL,
    "venda" DECIMAL(14,4),
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "atualizadoPor" TEXT,
    "observacao" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "precos_dos_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "servicos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "unidade" TEXT NOT NULL DEFAULT 'h',
    "fracionavel" BOOLEAN NOT NULL DEFAULT true,
    "valor" DECIMAL(14,4),
    "custo" DECIMAL(14,4),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "servicos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "precos_dos_itens_itemId_vigenteDesde_idx" ON "precos_dos_itens"("itemId", "vigenteDesde");

-- CreateIndex
CREATE UNIQUE INDEX "servicos_codigo_key" ON "servicos"("codigo");

-- AddForeignKey
ALTER TABLE "precos_dos_itens" ADD CONSTRAINT "precos_dos_itens_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "itens_de_catalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regras de integridade da precificação (Fase 09).
ALTER TABLE "precos_dos_itens" ADD CONSTRAINT "precos_valores_nao_negativos" CHECK (("custo" IS NULL OR "custo" >= 0) AND ("venda" IS NULL OR "venda" >= 0));
-- Venda fixa exige preço de venda; custo + regra exige custo.
ALTER TABLE "precos_dos_itens" ADD CONSTRAINT "precos_modo_coerente" CHECK (("modo" = 'VENDA_FIXA' AND "venda" IS NOT NULL) OR ("modo" = 'CUSTO_REGRA' AND "custo" IS NOT NULL));
ALTER TABLE "servicos" ADD CONSTRAINT "servicos_valores_nao_negativos" CHECK (("valor" IS NULL OR "valor" >= 0) AND ("custo" IS NULL OR "custo" >= 0));
