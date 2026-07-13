import type { PacienteComRetornos } from "../entities/Paciente";

export interface IPacienteRepository {
    fetchComRetornos(limit: number): Promise<PacienteComRetornos[]>;
    updateDtRetornoCalc(prontuario: number, dtRetorno: Date | null): Promise<void>;
}
