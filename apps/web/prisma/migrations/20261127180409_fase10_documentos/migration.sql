-- CreateTable
CREATE TABLE "modelos_de_texto" (
    "id" UUID NOT NULL,
    "secao" TEXT NOT NULL,
    "donoTipo" "DonoDeRegra" NOT NULL,
    "equipamentoId" UUID,
    "modeloId" UUID,
    "tipoDePainelId" UUID,
    "controladorId" UUID,
    "texto" TEXT NOT NULL,
    "condicao" JSONB,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "modelos_de_texto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emissoes" (
    "id" UUID NOT NULL,
    "revisaoId" UUID NOT NULL,
    "emitidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emitidoPorId" UUID,
    "configuracao" JSONB NOT NULL,
    "snapshot" JSONB NOT NULL,
    "resultado" JSONB NOT NULL,

    CONSTRAINT "emissoes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "modelos_de_texto_secao_ordem_idx" ON "modelos_de_texto"("secao", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "emissoes_revisaoId_key" ON "emissoes"("revisaoId");

-- AddForeignKey
ALTER TABLE "modelos_de_texto" ADD CONSTRAINT "modelos_de_texto_equipamentoId_fkey" FOREIGN KEY ("equipamentoId") REFERENCES "equipamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_de_texto" ADD CONSTRAINT "modelos_de_texto_modeloId_fkey" FOREIGN KEY ("modeloId") REFERENCES "modelos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_de_texto" ADD CONSTRAINT "modelos_de_texto_tipoDePainelId_fkey" FOREIGN KEY ("tipoDePainelId") REFERENCES "tipos_de_painel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modelos_de_texto" ADD CONSTRAINT "modelos_de_texto_controladorId_fkey" FOREIGN KEY ("controladorId") REFERENCES "controladores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissoes" ADD CONSTRAINT "emissoes_revisaoId_fkey" FOREIGN KEY ("revisaoId") REFERENCES "revisoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emissoes" ADD CONSTRAINT "emissoes_emitidoPorId_fkey" FOREIGN KEY ("emitidoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- O dono do modelo de texto precisa bater com o tipo (mesma regra das regras de composição).
ALTER TABLE "modelos_de_texto" ADD CONSTRAINT "modelos_de_texto_dono_coerente" CHECK (
  ("donoTipo" = 'EQUIPAMENTO' AND "equipamentoId" IS NOT NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL AND "controladorId" IS NULL) OR
  ("donoTipo" = 'MODELO' AND "modeloId" IS NOT NULL AND "equipamentoId" IS NULL AND "tipoDePainelId" IS NULL AND "controladorId" IS NULL) OR
  ("donoTipo" = 'TIPO_DE_PAINEL' AND "tipoDePainelId" IS NOT NULL AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "controladorId" IS NULL) OR
  ("donoTipo" = 'CONTROLADOR' AND "controladorId" IS NOT NULL AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL) OR
  ("donoTipo" = 'PROJETO' AND "equipamentoId" IS NULL AND "modeloId" IS NULL AND "tipoDePainelId" IS NULL AND "controladorId" IS NULL)
);
ALTER TABLE "modelos_de_texto" ADD CONSTRAINT "modelos_de_texto_secao_valida" CHECK ("secao" IN ('objeto', 'equipamentos', 'paineis', 'automacao', 'servicos', 'observacoes'));
