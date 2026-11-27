-- CreateEnum
CREATE TYPE "TipoDeDerivacao" AS ENUM ('NENHUM', 'INDIVIDUAL', 'COLETIVO');

-- AlterTable
ALTER TABLE "equipamentos" ADD COLUMN     "acionamento" "TipoDeDerivacao" NOT NULL DEFAULT 'NENHUM',
ADD COLUMN     "acionamentoPorGrupo" INTEGER,
ADD COLUMN     "protecao" "TipoDeDerivacao" NOT NULL DEFAULT 'NENHUM',
ADD COLUMN     "protecaoPorGrupo" INTEGER;

-- AlterTable
ALTER TABLE "modelos" ADD COLUMN     "acionamento" "TipoDeDerivacao",
ADD COLUMN     "acionamentoPorGrupo" INTEGER,
ADD COLUMN     "protecao" "TipoDeDerivacao",
ADD COLUMN     "protecaoPorGrupo" INTEGER;

-- CreateTable
CREATE TABLE "tipos_de_painel" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tipos_de_painel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funcoes_de_controle" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "funcoes_de_controle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tipos_de_painel_nome_key" ON "tipos_de_painel"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "funcoes_de_controle_codigo_key" ON "funcoes_de_controle"("codigo");

-- Coletivo exige "por grupo" positivo; nos demais tipos o campo fica vazio.
ALTER TABLE "equipamentos" ADD CONSTRAINT "equipamentos_derivacao_valida" CHECK (
  ("acionamentoPorGrupo" IS NULL OR "acionamentoPorGrupo" > 0) AND ("protecaoPorGrupo" IS NULL OR "protecaoPorGrupo" > 0)
);
ALTER TABLE "modelos" ADD CONSTRAINT "modelos_derivacao_valida" CHECK (
  ("acionamentoPorGrupo" IS NULL OR "acionamentoPorGrupo" > 0) AND ("protecaoPorGrupo" IS NULL OR "protecaoPorGrupo" > 0)
);
