/**
 * CAMADA: Domain — Contratos de Repositório
 *
 * Define a INTERFACE do repositório de pacientes.
 * Este contrato é o que o Use Case conhece — nunca a implementação concreta.
 *
 * Princípio aplicado: Dependency Inversion (SOLID)
 * - O Use Case (alto nível) depende desta abstração (interface).
 * - A implementação concreta (OraclePacienteRepository) depende desta mesma abstração.
 * - Resultado: é possível trocar o banco de dados ou usar mocks nos testes
 *   sem alterar uma linha do Use Case.
 */
import type { PacienteComRetornos } from "../entities/Paciente";

export interface IPacienteRepository {
    /**
     * Busca pacientes com seus campos de retorno ambulatorial preenchidos.
     * Filtra automaticamente apenas pacientes em situação ativa na lista de espera.
     *
     * @param limit - Número máximo de registros a retornar.
     * @returns Array de pacientes com dados de retorno.
     */
    fetchComRetornos(limit: number): Promise<PacienteComRetornos[]>;

    /**
     * Atualiza o campo `dt_retorno_calc` na tabela `fav_lista_espera`.
     * A query aplica regras de negócio: só atualiza se a data for futura
     * e o paciente estiver em situação ativa ('S').
     *
     * @param prontuario - Código do paciente (cd_paciente).
     * @param dtRetorno  - Data calculada, ou null para não atualizar.
     */
    updateDtRetornoCalc(prontuario: number, dtRetorno: Date | null): Promise<void>;
}
