/**
 * Script CLI — Visualização completa com comparação de todas as fontes de data.
 * Mostra dados brutos do Oracle + resultado do processamento híbrido (sem salvar).
 * Uso: npm run test-dates
 */
import { initPool } from "../config/database";
import { OraclePacienteRepository } from "../infrastructure/database/OraclePacienteRepository";
import { GeminiRetornoGateway } from "../infrastructure/gemini/GeminiRetornoGateway";
import type { PacienteRetorno } from "../domain/entities/Paciente";

async function main() {
    try {
        await initPool();

        const repository = new OraclePacienteRepository();
        const gateway    = new GeminiRetornoGateway();

        const pacientes = await repository.fetchComRetornos(100);
        console.log(`\n--- ${pacientes.length} pacientes recuperados do Oracle ---`);

        console.log("\nProcessando datas (abordagem híbrida: código + IA)...");
        const resultados = await gateway.processReturnDates(pacientes);

        const resultadoMap = new Map<number, PacienteRetorno>();
        for (const r of resultados) {
            resultadoMap.set(r.prontuario, r);
        }

        console.log("\n=== VISÃO COMPLETA: TODAS AS DATAS DE RETORNO POSSÍVEIS ===\n");
        console.table(
            pacientes.map(p => {
                const res  = resultadoMap.get(p.prontuario);
                const isMC = !!(p.mcData && p.mcSetor);

                return {
                    "Prontuário":       p.prontuario,
                    "Paciente":         p.paciente,
                    "Observação":       p.observacao
                        ? (p.observacao.length > 60 ? p.observacao.substring(0, 60) + "..." : p.observacao)
                        : "-",
                    "Amb 1":            p.ambEspecializado1 || "-",
                    "Amb 1 - Retorno":  p.ambDtRetorno1 || "-",
                    "Amb 2":            p.ambEspecializado2 || "-",
                    "Amb 2 - Retorno":  p.ambDtRetorno2 || "-",
                    "Amb 3":            p.ambEspecializado3 || "-",
                    "Amb 3 - Retorno":  p.ambDtRetorno3 || "-",
                    "MC":               isMC ? "Sim" : "Não",
                    "MC - Data":        p.mcData || "-",
                    "MC - Setor":       p.mcSetor || "-",
                    "── RESULTADO ──":  "────────",
                    "Data Selecionada": res?.dataRetorno
                        ? res.dataRetorno.toLocaleDateString("pt-BR")
                        : "Sem Retorno",
                    "Ambulatório Final": res?.ambulatorio || "-",
                    "Fonte":             res?.fonte || "-",
                    "Motivo (IA)":       res?.motivo || "-"
                };
            })
        );

        const porFonte = new Map<string, number>();
        for (const r of resultados) {
            const count = porFonte.get(r.fonte) ?? 0;
            porFonte.set(r.fonte, count + 1);
        }

        console.log("\n=== RESUMO POR FONTE ===");
        console.table(
            Array.from(porFonte.entries()).map(([fonte, count]) => ({
                "Fonte":      fonte,
                "Quantidade": count,
                "%":          ((count / resultados.length) * 100).toFixed(1) + "%"
            }))
        );

        const totalComRetorno = resultados.filter(r => r.dataRetorno).length;
        const totalSemRetorno = resultados.filter(r => !r.dataRetorno).length;

        console.log(`\nTotal de pacientes: ${pacientes.length}`);
        console.log(`Com retorno identificado: ${totalComRetorno}`);
        console.log(`Sem retorno identificado: ${totalSemRetorno}`);

    } catch (error) {
        console.error("Erro ao exibir dados completos:", error);
    }
}

main().catch(console.error);
