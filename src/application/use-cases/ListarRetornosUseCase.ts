import type { IPacienteRepository } from "../../domain/repositories/IPacienteRepository";
import type { PacienteComRetornos } from "../../domain/entities/Paciente";

/**
 * CAMADA: Application — Use Case
 *
 * Responsabilidade: apenas buscar e retornar os dados do Oracle com os
 * campos de retorno já calculados (dt_retorno_calc).
 *
 * NÃO aciona a IA. NÃO atualiza o banco.
 * É a implementação do endpoint GET /api/retornos.
 *
 * INJEÇÃO DE DEPENDÊNCIA:
 * Recebe IPacienteRepository via construtor — nunca instancia o OraclePacienteRepository
 * diretamente. Isso garante desacoplamento e testabilidade.
 */
export class ListarRetornosUseCase {

    /**
     * @param repository - Implementação do repositório injetada externamente.
     *                     Em produção: OraclePacienteRepository.
     *                     Em testes: MockPacienteRepository.
     */
    constructor(private readonly repository: IPacienteRepository) {}

    /**
     * Executa a listagem de pacientes com dados de retorno.
     *
     * @param limit - Máximo de pacientes a retornar (vindo do query param da rota).
     * @returns Array de pacientes com todos os campos de retorno preenchidos.
     */
    async execute(limit: number): Promise<PacienteComRetornos[]> {
        return this.repository.fetchComRetornos(limit);
    }
}
