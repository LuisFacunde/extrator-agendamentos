import type { IPacienteRepository } from "../../domain/repositories/IPacienteRepository";
import type { GeminiRetornoGateway } from "../../infrastructure/gemini/GeminiRetornoGateway";
import type { ProcessamentoResult } from "../../domain/entities/Paciente";

export class ProcessarRetornosUseCase {

    constructor(
        private readonly repository: IPacienteRepository,
        private readonly gateway: GeminiRetornoGateway
    ) {}

    async execute(limit: number): Promise<ProcessamentoResult> {
        console.log(`\n[UseCase] Iniciando processamento para ${limit} pacientes...`);
        const pacientes = await this.repository.fetchComRetornos(limit);
        console.log(`[UseCase] ${pacientes.length} pacientes recuperados do Oracle.`);

        if (pacientes.length === 0) {
            return {
                totalProcessados: 0,
                totalComRetorno: 0,
                totalSemRetorno: 0,
                totalAtualizados: 0,
                resultados: []
            };
        }

        console.log("[UseCase] Enviando para processamento híbrido (código + Gemini)...");
        const resultados = await this.gateway.processReturnDates(pacientes);

        console.log(`\n[UseCase] Salvando ${resultados.length} resultados no Oracle...`);
        let totalAtualizados = 0;

        for (const r of resultados) {
            try {
                await this.repository.updateDtRetornoCalc(r.prontuario, r.dataRetorno);
                if (r.dataRetorno) totalAtualizados++;
            } catch (updateError) {
                console.error(
                    `[UseCase] Falha ao atualizar prontuário ${r.prontuario}:`,
                    updateError
                );
            }
        }

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
