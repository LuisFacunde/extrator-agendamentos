import { initPool } from "./config/database";
import { fetchPacientes, updateDtRetornoCalc } from "./services/oracleService";
import { processReturnDates } from "./services/llmService";

async function main() {
    await initPool();

    const pacientes = await fetchPacientes(100);
    console.log(`\n--- ${pacientes.length} pacientes recuperados do Oracle ---`);

    console.log("\nEnviando observações e datas de criação para a API do Gemini processar...");
    const resultados = await processReturnDates(pacientes);

    console.log("\n=== RESULTADOS DO PROCESSAMENTO DE RETORNO ===");
    console.table(
        resultados.map(r => ({
            "Prontuário": r.prontuario,
            "Paciente": r.nome,
            "Retorno Estimado": r.dataRetorno ? r.dataRetorno.toLocaleDateString('pt-BR') : "Sem Retorno / Excedido (>12m)"
        }))
    );

    console.log("\n=== SALVANDO RESULTADOS NO ORACLE (TABELA fav_lista_espera) ===");
    for (const r of resultados) {
        await updateDtRetornoCalc(r.prontuario, r.dataRetorno);
    }
}

main().catch(console.error);