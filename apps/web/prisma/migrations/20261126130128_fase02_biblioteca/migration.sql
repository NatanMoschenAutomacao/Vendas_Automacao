-- CreateEnum
CREATE TYPE "TipoDeEquipamento" AS ENUM ('EQUIPAMENTO', 'SENSOR', 'ACESSORIO');

-- CreateEnum
CREATE TYPE "TipoDeDado" AS ENUM ('TEXTO', 'NUMERO', 'BOOLEANO', 'LISTA', 'MULTIPLA');

-- CreateTable
CREATE TABLE "equipamentos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" "TipoDeEquipamento" NOT NULL DEFAULT 'EQUIPAMENTO',
    "categoriaId" UUID NOT NULL,
    "imagemId" UUID,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "equipamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "definicoes_de_atributo" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "rotulo" TEXT NOT NULL,
    "tipoDado" "TipoDeDado" NOT NULL,
    "unidade" TEXT,
    "opcoes" TEXT[],
    "obrigatorio" BOOLEAN NOT NULL DEFAULT false,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "definicoes_de_atributo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modelos" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "fabricante" TEXT,
    "descricao" TEXT,
    "atributos" JSONB NOT NULL DEFAULT '{}',
    "imagemId" UUID,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imagens" (
    "id" UUID NOT NULL,
    "chave" TEXT NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "tamanho" INTEGER NOT NULL,
    "largura" INTEGER,
    "altura" INTEGER,
    "textoAlternativo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "imagens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "equipamentos_codigo_key" ON "equipamentos"("codigo");

-- CreateIndex
CREATE INDEX "equipamentos_categoriaId_ordem_idx" ON "equipamentos"("categoriaId", "ordem");

-- CreateIndex
CREATE INDEX "definicoes_de_atributo_equipamentoId_ordem_idx" ON "definicoes_de_atributo"("equipamentoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "definicoes_de_atributo_equipamentoId_chave_key" ON "definicoes_de_atributo"("equipamentoId", "chave");

-- CreateIndex
CREATE INDEX "modelos_equipamentoId_ordem_idx" ON "modelos"("equipamentoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "modelos_equipamentoId_codigo_key" ON "modelos"("equipamentoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "imagens_chave_key" ON "imagens"("chave");

-- AddForeignKey
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "categorias"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_imagemId_fkey" FOREIGN KEY ("imagemId") REFERENCES "imagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "definicoes_de_atributo" ADD CONSTRAINT "definicoes_de_atributo_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_imagemId_fkey" FOREIGN KEY ("imagemId") REFERENCES "imagens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
