/**
 * Script CLI — Visualização dos dados de retorno sem processamento de IA.
 * Uso: npm run show-dates
 */
import { initPool } from "./config/database";
import { OraclePacienteRepository } from "./infrastructure/database/OraclePacienteRepository";

async function main() {
    try {
        await initPool();

        const repository = new OraclePacienteRepository();
        const pacientes  = await repository.fetchComRetornos(100);
        console.log(`\n--- ${pacientes.length} pacientes recuperados do Oracle ---`);

        console.log("\n=== DADOS DOS PACIENTES E RETORNOS SELECIONADOS NO FORMULÁRIO ===");
        console.table(
            pacientes.map(p => {
                const isMC = !!(p.mcData && p.mcSetor);
                return {
                    "Prontuário":      p.prontuario,
                    "Paciente":        p.paciente,
                    "Retorno Estimado": isMC
                        ? p.mcData
                        : (p.dtRetornoCalc ? p.dtRetornoCalc.toLocaleDateString("pt-BR") : "Sem Retorno Calculado"),
                    "Amb. Retorno":    isMC ? p.mcSetor : (p.ambEspecializado1 || "-"),
                    "MC":              isMC ? "Sim" : "Não"
                };
            })
        );
    } catch (error) {
        console.error("Erro ao exibir dados dos retornos:", error);
    }
}

main().catch(console.error);
