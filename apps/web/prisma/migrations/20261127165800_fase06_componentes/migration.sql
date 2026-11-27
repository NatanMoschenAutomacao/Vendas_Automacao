-- CreateEnum
CREATE TYPE "DonoDeRegra" AS ENUM ('EQUIPAMENTO', 'MODELO', 'TIPO_DE_PAINEL', 'PROJETO');

-- CreateEnum
CREATE TYPE "EstagioDeRegra" AS ENUM ('RECURSO', 'MATERIAL');

-- AlterTable
ALTER TABLE "modelos" ADD COLUMN     "itemId" UUID;

-- CreateTable
CREATE TABLE "categorias_de_componente" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorias_de_componente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itens_de_catalogo" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "codigoFabricante" TEXT,
    "descricao" TEXT NOT NULL,
    "fabricante" TEXT,
    "modelo" TEXT,
    "unidade" TEXT NOT NULL DEFAULT 'pç',
    "fracionavel" BOOLEAN NOT NULL DEFAULT false,
    "fornecedor" TEXT,
    "atributos" JSONB NOT NULL DEFAULT '{}',
    "categoriaId" UUID,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_de_catalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_de_recurso" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "fisico" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_de_recurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regras" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "donoTipo" "DonoDeRegra" NOT NULL,
    "equipamentoId" UUID,
    "modeloId" UUID,
    "tipoDePainelId" UUID,
    "estagio" "EstagioDeRegra" NOT NULL,
    "base" TEXT NOT NULL,
    "condicao" JSONB,
    "prioridade" INTEGER NOT NULL DEFAULT 100,
    "permiteRemocao" BOOLEAN NOT NULL DEFAULT false,
    "efeitos" JSONB NOT NULL DEFAULT '[]',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categorias_de_componente_nome_key" ON "categorias_de_componente"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "itens_de_catalogo_codigo_key" ON "itens_de_catalogo"("codigo");

-- CreateIndex
CREATE INDEX "itens_de_catalogo_descricao_idx" ON "itens_de_catalogo"("descricao");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_de_recurso_codigo_key" ON "tipos_de_recurso"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "regras_codigo_key" ON "regras"("codigo");

-- CreateIndex
CREATE INDEX "regras_donoTipo_idx" ON "regras"("donoTipo");

-- AddForeignKey
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "itens_de_catalogo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itens_de_catalogo" ADD CONSTRAINT "itens_de_catalogo_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias_de_componente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras" ADD CONSTRAINT "regras_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras" ADD CONSTRAINT "regras_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "regras" ADD CONSTRAINT "regras_tipoDePainelId_fkey" FOREIGN KEY ("tipoDePainelId") REFERENCES "tipos_de_painel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O dono da regra bate com a coluna preenchida.
ALTER TABLE "regras" ADD CONSTRAINT "regras_dono_coerente" CHECK (
  ("donoTipo" = 'EQUIPAMENTO' AND "equipamentoId" IS NOT NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL) OR
  ("donoTipo" = 'MODELO' AND "modeloId" IS NOT NULL AND "equipamentoId" IS NULL AND "tipoDePainelId" IS NULL) OR
  ("donoTipo" = 'TIPO_DE_PAINEL' AND "tipoDePainelId" IS NOT NULL AND "equipamentoId" IS NULL AND "modeloId" IS NULL) OR
  ("donoTipo" = 'PROJETO' AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL)
);
ALTER TABLE "itens_de_catalogo" ADD CONSTRAINT "itens_unidade_preenchida" CHECK (length(trim("unidade")) > 0);
