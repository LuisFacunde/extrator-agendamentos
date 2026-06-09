import { initPool } from "./config/database";
import { fetchPacientesComRetornos } from "./services/oracleService";

async function main() {
    try {
        await initPool();

        const pacientes = await fetchPacientesComRetornos(100);
        console.log(`\n--- ${pacientes.length} pacientes recuperados do Oracle ---`);

        console.log("\n=== DADOS DOS PACIENTES E RETORNOS SELECIONADOS NO FORMULÁRIO ===");
        console.table(
            pacientes.map(p => ({
                "Prontuário": p.prontuario,
                "Paciente": p.paciente,
                "Retorno Estimado": p.dtRetornoCalc ? p.dtRetornoCalc.toLocaleDateString('pt-BR') : "Sem Retorno Calculado",
                "Amb 1": p.ambEspecializado1 || "-",
                "Amb 1 - d  t_retorno": p.ambDtRetorno1 || "-",
                "Amb 2": p.ambEspecializado2 || "-",
                "Amb 2 - dt_retorno": p.ambDtRetorno2 || "-",
                "Amb 3": p.ambEspecializado3 || "-",
                "Amb 3 - dt_retorno": p.ambDtRetorno3 || "-"
            }))
        );
    } catch (error) {
        console.error("Erro ao exibir dados dos retornos:", error);
    }
}

main().catch(console.error);
