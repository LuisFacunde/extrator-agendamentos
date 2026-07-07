export interface PacienteComRetornos {
    cdAtendimento: number;
    prontuario: number;
    paciente: string;
    dataCriacao: Date;
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

export interface PacienteRetorno {
    prontuario: number;
    nome: string;
    dataRetorno: Date | null;
    ambulatorio: string | null;
    marcacaoComplementar: boolean;
    fonte: string;
    motivo: string;
}

export interface ProcessamentoResult {
    totalProcessados: number;
    totalComRetorno: number;
    totalSemRetorno: number;
    totalAtualizados: number;
    resultados: PacienteRetorno[];
}
