-- CreateEnum
CREATE TYPE "ModoDeHeranca" AS ENUM ('NOVA', 'SUBSTITUIR', 'OCULTAR');

-- CreateTable
CREATE TABLE "perguntas" (
    "id" UUID NOT NULL,
    "equipamentoId" UUID,
    "modeloId" UUID,
    "chave" TEXT NOT NULL,
    "modo" "ModoDeHeranca" NOT NULL DEFAULT 'NOVA',
    "texto" TEXT NOT NULL,
    "ajuda" TEXT,
    "tipo" TEXT NOT NULL,
    "unidade" TEXT,
    "obrigatoria" BOOLEAN NOT NULL DEFAULT false,
    "minimo" DOUBLE PRECISION,
    "maximo" DOUBLE PRECISION,
    "passo" DOUBLE PRECISION,
    "padrao" JSONB,
    "condicao" JSONB,
    "opcoes" JSONB NOT NULL DEFAULT '[]',
    "atributo" TEXT,
    "formula" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "perguntas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "perguntas_equipamentoId_ordem_idx" ON "perguntas"("equipamentoId", "ordem");

-- CreateIndex
CREATE INDEX "perguntas_modeloId_ordem_idx" ON "perguntas"("modeloId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "perguntas_equipamentoId_chave_key" ON "perguntas"("equipamentoId", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "perguntas_modeloId_chave_key" ON "perguntas"("modeloId", "chave");

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Toda pergunta pertence a exatamente um dono.
ALTER TABLE "perguntas" ADD CONSTRAINT "perguntas_um_dono" CHECK (num_nonnulls("equipamentoId", "modeloId") = 1);
