# Precificação (Fase 09)

Regras que o motor (`packages/engine/src/precos`) aplica. Todas podem ser revistas pelo comercial; mudar uma delas é mudar o motor e os testes.

## Preço de cada item

- Cada registro de preço tem um modo: **venda fixa** (usa o preço de venda cadastrado, nenhuma regra por cima) ou **custo + regra comercial** (aplica markup ou margem ao custo). Nunca os dois.
- Markup: venda = custo × (1 + markup). Margem: venda = custo ÷ (1 − margem).
- O histórico é mantido. Vale o registro com a maior data "vigente a partir de" que já começou (horário de Brasília).
- Serviços têm um valor de venda fixo e um custo opcional.

## Arredondamento (cenário 18)

- Cálculo em decimal exato (decimal.js), nunca em ponto flutuante.
- O preço unitário de venda é arredondado para centavos (meio para cima). O total da linha é unitário × quantidade, também arredondado para centavos.
- Subtotais e totais são somas das linhas arredondadas. Assim tela, PDF e Excel batem.

## Item sem preço (cenário 15)

- A linha aparece como "sem preço", o grupo e o total ficam marcados como parciais e o total soma só o que tem preço.
- Gera a pendência impeditiva `SEM_PRECO`, que bloqueia a emissão definitiva.
- Item em "custo + regra" sem regra comercial configurada também fica sem preço e gera `REGRA_COMERCIAL_AUSENTE` (visível só para quem vê custo).

## Descontos, acréscimos e impostos

Ordem de cálculo em cada grupo (materiais, serviços, software):

1. Subtotal = soma das linhas.
2. Descontos e acréscimos do grupo, na ordem em que foram incluídos. Percentuais incidem sobre o subtotal do grupo.
3. Impostos do grupo: linhas percentuais sobre o líquido do grupo (sem cálculo fiscal, decisão 11).
4. Total do grupo = líquido + impostos.

Depois, descontos e acréscimos sobre o **total geral** incidem sobre a soma dos totais dos grupos (já com impostos). **Suposição da v1, a confirmar com o comercial.**

- Todo desconto ou acréscimo exige justificativa; autor e data são gravados pelo servidor.
- Um desconto maior que o valor sobre o qual incide é limitado a esse valor e gera pendência impeditiva.

## Permissões

- O vendedor recebe do servidor só preços de venda: o snapshot dele já vem com custo + regra convertido em venda fixa, sem custo, sem regra comercial e sem margem.
- O vendedor só aplica descontos **percentuais** e, somados por grupo (e no total), até o limite configurado. Descontos já salvos e não alterados (por exemplo, aplicados pelo administrador) ficam fora da conta. O servidor confere ao salvar.
- O administrador técnico aplica qualquer desconto, inclusive em valor, e vê custo e margem.
