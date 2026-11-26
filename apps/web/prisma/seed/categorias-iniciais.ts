/**
 * Categorias e sistemas iniciais sugeridos no §8 do prompt mestre.
 * São apenas nomes de organização, sem dados técnicos. A equipe pode
 * renomear, reorganizar, inativar ou excluir livremente.
 */
export const CATEGORIAS_INICIAIS: Record<string, string[]> = {
  "Climatização": ["Exaustores", "Circuladores de ar", "Pad & Fan", "Climatizadores", "Nebulização", "Aquecimento", "Resfriamento", "Desumidificação"],
  "Irrigação": ["Gotejamento", "Microaspersão", "Aspersão", "Barras de irrigação", "Motobombas", "Válvulas solenoides"],
  "Fertirrigação": ["Sistemas de dosagem", "Canais de fertilizantes", "Controle de EC", "Controle de pH", "Monitoramento de vazão", "Agitação de fertilizantes"],
  "Telas e cortinas": ["Sombreamento", "Escurecimento", "Cortinas laterais", "Cortinas zenitais", "Aberturas motorizadas"],
  "Iluminação": ["Fotoperíodo", "Iluminação suplementar"],
  "Monitoramento": ["Estação meteorológica", "Sensores ambientais", "Sensores de solo", "Sensores de reservatórios", "Sensores de pressão", "Sensores de vazão"],
  "Automação": ["Painéis elétricos", "CLPs", "IHMs", "Controladores digitais", "Controladores de irrigação", "Sistemas convencionais"],
  "Software": ["APP Zanatta", "Monitoramento remoto", "Controle remoto", "Histórico de dados", "Alarmes", "Notificações"],
  "Movimentação": ["Esteiras", "Linhas de plantio", "Mesas móveis", "Sistemas motorizados"],
  "Reservatórios": ["Controle de nível", "Abastecimento automático", "Motobombas", "Boias elétricas"],
};
