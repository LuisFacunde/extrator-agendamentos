import { initPool } from "./config/database";
import { OraclePacienteRepository } from "./infrastructure/database/OraclePacienteRepository";
import { GeminiRetornoGateway } from "./infrastructure/gemini/GeminiRetornoGateway";

async function main() {
    await initPool();

    const repository = new OraclePacienteRepository();
    const gateway    = new GeminiRetornoGateway();

    const pacientes = await repository.fetchComRetornos(100);
    console.log(`\n--- ${pacientes.length} pacientes recuperados do Oracle ---`);

    console.log("\nProcessando datas de retorno (abordagem híbrida: código + IA)...");
    const resultados = await gateway.processReturnDates(pacientes);

    console.log("\n=== RESULTADOS DO PROCESSAMENTO DE RETORNO ===");
    console.table(
        resultados.map(r => ({
            "Prontuário": r.prontuario,
            "Paciente": r.nome,
            "Retorno Estimado": r.dataRetorno ? r.dataRetorno.toLocaleDateString("pt-BR") : "Sem Retorno",
            "Ambulatório": r.ambulatorio || "-",
            "Fonte": r.fonte,
            "MC": r.marcacaoComplementar ? "Sim" : "Não"
        }))
    );

    console.log("\n=== SALVANDO RESULTADOS NO ORACLE (TABELA fav_lista_espera) ===");
    for (const r of resultados) {
        await repository.updateDtRetornoCalc(r.prontuario, r.dataRetorno);
    }
}

main().catch(console.error);