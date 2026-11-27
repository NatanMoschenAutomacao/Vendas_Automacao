# Cenários de teste do §48: onde cada um é verificado

Os testes do motor (`packages/engine/test`) rodam em `pnpm test`; os de interface (`apps/web/e2e`) rodam em sequência, fase 01 a 10, sobre o mesmo banco descartável (`pnpm --filter web test:e2e`). Todos usam dados DEMO.

| Cenário | Assunto (resumo do planejamento) | Motor | Interface |
| --- | --- | --- | --- |
| 01 | Estação meteorológica: seleção e composição | ⚠️ sem teste nomeado | `fase04` (seleção), `fase06` (materiais) |
| 02 | Exaustores: seleção e composição | ⚠️ sem teste nomeado | `fase04` (seleção), `fase06` (materiais) |
| 03 | Seleção no configurador | ⚠️ sem teste nomeado | `fase04` |
| 04 | Seleção no configurador | ⚠️ sem teste nomeado | `fase04` |
| 05 | Equipamentos, acionamentos, proteções e grupos separados | `estrutura.test.ts` | `fase05` |
| 06 | 11 equipamentos em 2 grupos consomem 2 saídas | `controladores.test.ts` | `fase07` |
| 07 e 08 | Totalização por item + unidade, nunca pela descrição | `materiais.test.ts` | `fase06` |
| 09 | Instância compartilhada contada uma vez | `estrutura.test.ts`, `materiais.test.ts` | `fase05` |
| 10 | Déficit = necessidade + reserva − integrado | `expansao.test.ts` | `fase08` |
| 11 | Várias combinações de cartões viram escolha | `expansao.test.ts` | `fase08` |
| 12 | Só cartões compatíveis e do mesmo barramento | `expansao.test.ts` | `fase08` |
| 13 | Recursos somados por controlador, não pelo projeto | `controladores.test.ts` | `fase07` |
| 14 | (Fase 06) | ⚠️ sem teste nomeado | `fase06` |
| 15 | Item sem preço: total parcial e emissão bloqueada | `precos.test.ts` | `fase09`, `fase10` |
| 16 | Mesmas entradas, mesmo resultado; recalcular não acumula | `pipeline.test.ts`, `materiais.test.ts`, `precos.test.ts` | — |
| 17 | Equipamento existente: sem fornecimento, com automação | `materiais.test.ts`, `precos.test.ts` | `fase06` |
| 18 | Tela, PDF e Excel batem (arredondamento por linha) | `precos.test.ts` | `documentos.test.ts` (Excel e PDF) |

## Pendente para fechar a validação

Os cenários 01 a 04 e 14 estão cobertos pelos fluxos das fases 04 e 06, mas sem um teste com o número do cenário, porque o texto exato do §48 não está no planejamento aprovado. Com o texto do §48, cada um vira um teste nomeado do motor, como os demais.
