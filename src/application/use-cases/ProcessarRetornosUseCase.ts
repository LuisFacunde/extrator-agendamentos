import type { IPacienteRepository } from "../../domain/repositories/IPacienteRepository";
import type { GeminiRetornoGateway } from "../../infrastructure/gemini/GeminiRetornoGateway";
import type { ProcessamentoResult } from "../../domain/entities/Paciente";

/**
 * CAMADA: Application — Use Case (Orquestrador Principal)
 *
 * Este é o coração da aplicação. Orquestra o fluxo completo de ponta a ponta:
 *   1. Busca pacientes no Oracle (via Repository)
 *   2. Envia para análise híbrida (código + IA Gemini, via Gateway)
 *   3. Atualiza a data calculada no Oracle para cada paciente (via Repository)
 *   4. Retorna um resumo com estatísticas para a resposta HTTP
 *
 * INJEÇÃO DE DEPENDÊNCIA:
 * - Recebe `IPacienteRepository` por interface → desacoplado do Oracle
 * - Recebe `GeminiRetornoGateway` por tipo concreto → aceitável pois o Gateway
 *   já encapsula toda a complexidade da IA e pode ser mockado
 *
 * TRATAMENTO DE ERROS:
 * - Erros do Repository (ORA-*) ou do Gateway (API Gemini) são propagados para
 *   o Controller, que os captura e retorna HTTP 500 via error handler global.
 * - O loop de UPDATE é tolerante: falha em um paciente não interrompe os outros.
 */
export class ProcessarRetornosUseCase {

    /**
     * @param repository - Repositório de pacientes (injetado por interface).
     * @param gateway    - Gateway que encapsula a chamada ao Gemini.
     */
    constructor(
        private readonly repository: IPacienteRepository,
        private readonly gateway:    GeminiRetornoGateway
    ) {}

    /**
     * Executa o processamento completo de datas de retorno.
     *
     * @param limit - Número de pacientes a processar (vindo do body da requisição POST).
     * @returns Objeto com estatísticas e lista de resultados individuais.
     */
    async execute(limit: number): Promise<ProcessamentoResult> {
        // --- PASSO 1: Busca no Oracle ---
        console.log(`\n[UseCase] Iniciando processamento para ${limit} pacientes...`);
        const pacientes = await this.repository.fetchComRetornos(limit);
        console.log(`[UseCase] ${pacientes.length} pacientes recuperados do Oracle.`);

        if (pacientes.length === 0) {
            return {
                totalProcessados: 0,
                totalComRetorno:  0,
                totalSemRetorno:  0,
                totalAtualizados: 0,
                resultados:       []
            };
        }

        // --- PASSO 2: Processamento híbrido (código + IA) ---
        console.log("[UseCase] Enviando para processamento híbrido (código + Gemini)...");
        const resultados = await this.gateway.processReturnDates(pacientes);

        // --- PASSO 3: Atualização no Oracle ---
        console.log(`\n[UseCase] Salvando ${resultados.length} resultados no Oracle...`);
        let totalAtualizados = 0;

        for (const r of resultados) {
            try {
                await this.repository.updateDtRetornoCalc(r.prontuario, r.dataRetorno);
                if (r.dataRetorno) totalAtualizados++;
            } catch (updateError) {
                // Erro de UPDATE é logado mas não interrompe o loop
                // para garantir que os outros pacientes sejam processados
                console.error(
                    `[UseCase] Falha ao atualizar prontuário ${r.prontuario}:`,
                    updateError
                );
            }
        }

        // --- PASSO 4: Monta o resumo de retorno ---
        const totalComRetorno  = resultados.filter(r => r.dataRetorno !== null).length;
        const totalSemRetorno  = resultados.filter(r => r.dataRetorno === null).length;

        console.log(`\n[UseCase] Concluído. Com retorno: ${totalComRetorno} | Sem retorno: ${totalSemRetorno} | Atualizados no Oracle: ${totalAtualizados}`);

        return {
            totalProcessados: pacientes.length,
            totalComRetorno,
            totalSemRetorno,
            totalAtualizados,
            resultados
        };
    }
}
