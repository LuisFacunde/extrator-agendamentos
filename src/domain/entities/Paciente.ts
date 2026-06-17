/**
 * CAMADA: Domain — Entidades
 *
 * Este arquivo é a ÚNICA fonte de verdade para os tipos do domínio de pacientes.
 * Não possui nenhuma dependência externa (sem imports de Oracle, Gemini ou Fastify).
 * Todos as outras camadas importam tipos daqui, nunca ao contrário.
 */

// ---------------------------------------------------------------------------
// Dados brutos retornados pelo banco Oracle
// ---------------------------------------------------------------------------

/**
 * Representa um paciente com todos os seus campos de agendamento de retorno,
 * conforme recuperado da query principal no Oracle.
 */
export interface PacienteComRetornos {
    cdAtendimento: number;
    prontuario: number;
    paciente: string;
    dataCriacao: Date;
    /** Data de retorno calculada já existente no Oracle (pode ser nula). */
    dtRetornoCalc: Date | null;
    observacao: string | null;
    ambEspecializado1: string | null;
    ambDtRetorno1: string | null;
    ambEspecializado2: string | null;
    ambDtRetorno2: string | null;
    ambEspecializado3: string | null;
    ambDtRetorno3: string | null;
    mcData: string | null;
    mcSetor: string | null;
}

// ---------------------------------------------------------------------------
// Resultado do processamento de IA
// ---------------------------------------------------------------------------

/**
 * Resultado final do processamento para um paciente: contém a data de retorno
 * selecionada (via código ou IA) e os metadados da decisão.
 */
export interface PacienteRetorno {
    prontuario: number;
    nome: string;
    dataRetorno: Date | null;
    ambulatorio: string | null;
    /** Indica se a data veio de uma Marcação Complementar. */
    marcacaoComplementar: boolean;
    /** Fonte utilizada para selecionar a data (ex: "Ambulatório 1", "Observação (IA)"). */
    fonte: string;
    /** Explicação gerada pela IA sobre como a data foi extraída (quando aplicável). */
    motivo: string;
}

// ---------------------------------------------------------------------------
// Resultado do Use Case de processamento
// ---------------------------------------------------------------------------

/**
 * Objeto de retorno do Use Case ProcessarRetornosUseCase.
 * Contém estatísticas e a lista completa de resultados individuais.
 */
export interface ProcessamentoResult {
    totalProcessados: number;
    totalComRetorno: number;
    totalSemRetorno: number;
    totalAtualizados: number;
    resultados: PacienteRetorno[];
}
