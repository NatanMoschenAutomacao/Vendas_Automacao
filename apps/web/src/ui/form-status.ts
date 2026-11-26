export type EstadoDoFormulario = {
  ok?: boolean;
  mensagem?: string;
  erros?: Record<string, string>;
};

export const ESTADO_INICIAL: EstadoDoFormulario = {};
