-- AlterTable
ALTER TABLE "controladores" ADD COLUMN     "barramento" TEXT,
ADD COLUMN     "consumoMaxBarramento" INTEGER,
ADD COLUMN     "maxModulos" INTEGER;

-- CreateTable
CREATE TABLE "cartoes_de_expansao" (
    "id" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "barramento" TEXT,
    "consumo" INTEGER,
    "tipoDeSinal" TEXT,
    "observacoes" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cartoes_de_expansao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recursos_do_cartao" (
    "cartaoId" UUID NOT NULL,
    "tipoRecursoId" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,

    CONSTRAINT "recursos_do_cartao_pkey" PRIMARY KEY ("cartaoId","tipoRecursoId")
);

-- CreateTable
CREATE TABLE "_CartoesCompativeis" (
    "A" UUID NOT NULL,
    "B" UUID NOT NULL,

    CONSTRAINT "_CartoesCompativeis_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "cartoes_de_expansao_itemId_key" ON "cartoes_de_expansao"("itemId");

-- CreateIndex
CREATE INDEX "_CartoesCompativeis_B_index" ON "_CartoesCompativeis"("B");

-- AddForeignKey
ALTER TABLE "cartoes_de_expansao" ADD CONSTRAINT "cartoes_de_expansao_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "itens_de_catalogo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos_do_cartao" ADD CONSTRAINT "recursos_do_cartao_cartaoId_fkey" FOREIGN KEY ("cartaoId") REFERENCES "cartoes_de_expansao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recursos_do_cartao" ADD CONSTRAINT "recursos_do_cartao_tipoRecursoId_fkey" FOREIGN KEY ("tipoRecursoId") REFERENCES "tipos_de_recurso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CartoesCompativeis" ADD CONSTRAINT "_CartoesCompativeis_A_fkey" FOREIGN KEY ("A") REFERENCES "cartoes_de_expansao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_CartoesCompativeis" ADD CONSTRAINT "_CartoesCompativeis_B_fkey" FOREIGN KEY ("B") REFERENCES "controladores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "recursos_do_cartao" ADD CONSTRAINT "recursos_do_cartao_quantidade" CHECK ("quantidade" >= 0);
ALTER TABLE "controladores" ADD CONSTRAINT "controladores_expansao_valida" CHECK (
  ("maxModulos" IS NULL OR "maxModulos" BETWEEN 0 AND 64) AND ("consumoMaxBarramento" IS NULL OR "consumoMaxBarramento" >= 0)
);
ALTER TABLE "cartoes_de_expansao" ADD CONSTRAINT "cartoes_consumo_valido" CHECK ("consumo" IS NULL OR "consumo" >= 0);
