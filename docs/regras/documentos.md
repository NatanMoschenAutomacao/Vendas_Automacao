# Documentos, status e emissão (Fase 10)

## Descritivo técnico

- Montado a partir dos **modelos de texto** (Administração › Textos do descritivo). Cada trecho tem seção, dono (equipamento, modelo, tipo de painel, controlador ou projeto), ordem, texto com variáveis e uma condição de uso opcional.
- Variáveis: `{{quantidade}}`, `{{equipamento.nome}}`, `{{modelo.nome}}`, `{{ambiente.nome}}`, `{{painel.identificacao}}`, `{{controlador.modelo}}` e todas as variáveis das condições (respostas, atributos do modelo, projeto…).
- Plural: `{{plural:exaustor|exaustores}}` escolhe pela quantidade do contexto.
- Ordem das seções (provisória, a confirmar com o modelo atual da empresa): Objeto, Equipamentos, Painéis elétricos, Controle e automação, Serviços, Observações.
- Texto de opção de resposta: use um trecho do equipamento com condição sobre a resposta (ex.: `resposta.tipo_controle = grupos`).
- Trecho editado à mão fica salvo como substituição. Se o texto gerado mudar depois, aparece a advertência "pode estar desatualizado"; um trecho editado que deixou de existir também vira advertência.

## Status

Rascunho → Aguardando validação → Validado → Emitido.

- **Enviar para validação:** o vendedor, a partir do rascunho. Fora do rascunho o orçamento fica somente leitura.
- **Validar:** só o administrador técnico, e só sem pendências impeditivas (recalculado no servidor).
- **Voltar para rascunho:** o vendedor retira da fila de validação; o administrador também desfaz uma validação.
- **Emitir:** a partir de Validado. O servidor recalcula com a biblioteca completa e, se não houver impeditivas, grava a emissão congelada (configuração, snapshot da biblioteca e resultado).
- **Abrir nova revisão:** a partir de Emitido, copia a configuração para a revisão seguinte, em rascunho. A emissão anterior continua intacta.

## Documentos

- **Proposta (PDF)** e **Listas e preços (Excel)**: sem custo, margem nem pendências.
- **Orçamento interno (PDF e Excel)**: só para quem vê custo; inclui custo, margem, lista totalizada, lista detalhada com origem, I/O e pendências.
- Antes da emissão, os documentos saem como **prévia** (marcados no arquivo e no nome). Depois da emissão, saem da emissão congelada, mesmo que a biblioteca mude.
- Tela, PDF e Excel usam os mesmos valores decimais do motor (cenário 18); o Excel grava valores, não fórmulas.
