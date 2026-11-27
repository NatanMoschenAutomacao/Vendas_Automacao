-- CreateEnum
CREATE TYPE "StatusDoOrcamento" AS ENUM ('RASCUNHO', 'AGUARDANDO_VALIDACAO', 'VALIDADO', 'EMITIDO');

-- CreateEnum
CREATE TYPE "FormaDeHotspot" AS ENUM ('RETANGULO', 'ELIPSE');

-- CreateEnum
CREATE TYPE "AlvoDeHotspot" AS ENUM ('EQUIPAMENTO', 'MODELO', 'KIT', 'PERGUNTA', 'OPCAO');

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" UUID NOT NULL,
    "numero" TEXT NOT NULL,
    "cliente" TEXT NOT NULL,
    "empresa" TEXT,
    "projeto" TEXT NOT NULL,
    "cidade" TEXT,
    "uf" TEXT,
    "observacoes" TEXT,
    "status" "StatusDoOrcamento" NOT NULL DEFAULT 'RASCUNHO',
    "vendedorId" UUID NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revisoes" (
    "id" UUID NOT NULL,
    "orcamentoId" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "configuracao" JSONB NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "salvoEm" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revisoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kits" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "categoriaId" UUID NOT NULL,
    "imagemId" UUID,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_de_kit" (
    "id" UUID NOT NULL,
    "kitId" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "modeloId" UUID,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "respostas" JSONB NOT NULL DEFAULT '{}',
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itens_de_kit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imagens_interativas" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "imagemId" UUID NOT NULL,
    "categoriaId" UUID,
    "equipamentoId" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imagens_interativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotspots" (
    "id" UUID NOT NULL,
    "imagemInterativaId" UUID NOT NULL,
    "rotulo" TEXT NOT NULL,
    "forma" "FormaDeHotspot" NOT NULL DEFAULT 'RETANGULO',
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,
    "largura" DOUBLE PRECISION NOT NULL,
    "altura" DOUBLE PRECISION NOT NULL,
    "alvoTipo" "AlvoDeHotspot" NOT NULL,
    "alvoId" TEXT NOT NULL,
    "alvoValor" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hotspots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_numero_key" ON "orcamentos"("numero");

-- CreateIndex
CREATE INDEX "orcamentos_vendedorId_atualizadoEm_idx" ON "orcamentos"("vendedorId", "atualizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "revisoes_orcamentoId_numero_key" ON "revisoes"("orcamentoId", "numero");

-- CreateIndex
CREATE INDEX "kits_categoriaId_ordem_idx" ON "kits"("categoriaId", "ordem");

-- CreateIndex
CREATE INDEX "itens_de_kit_kitId_ordem_idx" ON "itens_de_kit"("kitId", "ordem");

-- CreateIndex
CREATE INDEX "hotspots_imagemInterativaId_ordem_idx" ON "hotspots"("imagemInterativaId", "ordem");

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_vendedorId_fkey" FOREIGN KEY ("vendedorId") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revisoes" ADD CONSTRAINT "revisoes_orcamentoId_fkey" FOREIGN KEY ("orcamentoId") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kits" ADD CONSTRAINT "kits_imagemId_fkey" FOREIGN KEY ("imagemId") REFERENCES "imagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_de_kit" ADD CONSTRAINT "itens_de_kit_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_de_kit" ADD CONSTRAINT "itens_de_kit_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_de_kit" ADD CONSTRAINT "itens_de_kit_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagens_interativas" ADD CONSTRAINT "imagens_interativas_imagemId_fkey" FOREIGN KEY ("imagemId") REFERENCES "imagens"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagens_interativas" ADD CONSTRAINT "imagens_interativas_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imagens_interativas" ADD CONSTRAINT "imagens_interativas_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotspots" ADD CONSTRAINT "hotspots_imagemInterativaId_fkey" FOREIGN KEY ("imagemInterativaId") REFERENCES "imagens_interativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Imagem interativa pertence a um sistema OU a um equipamento.
ALTER TABLE "imagens_interativas" ADD CONSTRAINT "imagens_interativas_um_dono" CHECK (num_nonnulls("categoriaId", "equipamentoId") = 1);
-- Hotspot dentro da imagem.
ALTER TABLE "hotspots" ADD CONSTRAINT "hotspots_dentro" CHECK ("x" >= 0 AND "y" >= 0 AND "largura" > 0 AND "altura" > 0 AND "x" + "largura" <= 1.0001 AND "y" + "altura" <= 1.0001);
ALTER TABLE "itens_de_kit" ADD CONSTRAINT "itens_de_kit_quantidade" CHECK ("quantidade" >= 1);
