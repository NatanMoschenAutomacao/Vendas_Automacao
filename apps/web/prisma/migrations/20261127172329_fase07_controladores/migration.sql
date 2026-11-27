-- CreateEnum
CREATE TYPE "TipoDeControlador" AS ENUM ('CONVENCIONAL', 'DIGITAL', 'CLP', 'IRRIGACAO', 'IHM');

-- AlterEnum
ALTER TYPE "DonoDeRegra" ADD VALUE 'CONTROLADOR';

-- AlterTable
ALTER TABLE "regras" ADD COLUMN     "controladorId" UUID;

-- CreateTable
CREATE TABLE "controladores" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "tipo" "TipoDeControlador" NOT NULL,
    "alimentacao" TEXT,
    "tensoes" INTEGER[],
    "protocolos" TEXT[],
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "controladores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recursos_do_controlador" (
    "controladorId" UUID NOT NULL,
    "tipoRecursoId" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "recursos_do_controlador_pkey" PRIMARY KEY ("controladorId","tipoRecursoId")
);

-- CreateTable
CREATE TABLE "saidas_funcionais" (
    "id" UUID NOT NULL,
    "controladorId" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "descricao" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "saidas_funcionais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_FuncoesDaSaida" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_FuncoesDaSaida_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_ModelosCompativeis" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_ModelosCompativeis_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "controladores_itemId_key" ON "controladores"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "saidas_funcionais_controladorId_codigo_key" ON "saidas_funcionais"("controladorId", "codigo");

-- CreateIndex
CREATE INDEX "_FuncoesDaSaida_B_index" ON "_FuncoesDaSaida"("B");

-- CreateIndex
CREATE INDEX "_ModelosCompativeis_B_index" ON "_ModelosCompativeis"("B");

-- AddForeignKey
ALTER TABLE "regras" ADD CONSTRAINT "regras_controladorId_fkey" FOREIGN KEY ("controladorId") REFERENCES "controladores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "controladores" ADD CONSTRAINT "controladores_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "itens_de_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos_do_controlador" ADD CONSTRAINT "recursos_do_controlador_controladorId_fkey" FOREIGN KEY ("controladorId") REFERENCES "controladores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos_do_controlador" ADD CONSTRAINT "recursos_do_controlador_tipoRecursoId_fkey" FOREIGN KEY ("tipoRecursoId") REFERENCES "tipos_de_recurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saidas_funcionais" ADD CONSTRAINT "saidas_funcionais_controladorId_fkey" FOREIGN KEY ("controladorId") REFERENCES "controladores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FuncoesDaSaida" ADD CONSTRAINT "_FuncoesDaSaida_A_fkey" FOREIGN KEY ("A") REFERENCES "funcoes_de_controle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_FuncoesDaSaida" ADD CONSTRAINT "_FuncoesDaSaida_B_fkey" FOREIGN KEY ("B") REFERENCES "saidas_funcionais"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModelosCompativeis" ADD CONSTRAINT "_ModelosCompativeis_A_fkey" FOREIGN KEY ("A") REFERENCES "controladores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ModelosCompativeis" ADD CONSTRAINT "_ModelosCompativeis_B_fkey" FOREIGN KEY ("B") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Dono coerente, agora com controlador.
ALTER TABLE "regras" DROP CONSTRAINT "regras_dono_coerente";
ALTER TABLE "regras" ADD CONSTRAINT "regras_dono_coerente" CHECK (
  ("donoTipo" = 'EQUIPAMENTO' AND "equipamentoId" IS NOT NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL AND "controladorId" IS NULL) OR
  ("donoTipo" = 'MODELO' AND "modeloId" IS NOT NULL AND "equipamentoId" IS NULL AND "tipoDePainelId" IS NULL AND "controladorId" IS NULL) OR
  ("donoTipo" = 'TIPO_DE_PAINEL' AND "tipoDePainelId" IS NOT NULL AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "controladorId" IS NULL) OR
  ("donoTipo" = 'CONTROLADOR' AND "controladorId" IS NOT NULL AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL) OR
  ("donoTipo" = 'PROJETO' AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL AND "controladorId" IS NULL)
);
ALTER TABLE "recursos_do_controlador" ADD CONSTRAINT "recursos_do_controlador_quantidade" CHECK ("quantidade" >= 0);
