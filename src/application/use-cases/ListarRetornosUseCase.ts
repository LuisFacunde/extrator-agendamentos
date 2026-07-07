import type { IPacienteRepository } from "../../domain/repositories/IPacienteRepository";
import type { PacienteComRetornos } from "../../domain/entities/Paciente";

export class ListarRetornosUseCase {

    constructor(private readonly repository: IPacienteRepository) {}

    async execute(limit: number): Promise<PacienteComRetornos[]> {
        return this.repository.fetchComRetornos(limit);
    }
}
