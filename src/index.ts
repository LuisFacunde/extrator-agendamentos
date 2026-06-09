import { initPool } from "./config/database";
import { fetchPacientesComRetornos, updateDtRetornoCalc } from "./services/oracleService";
import { processReturnDates } from "./services/llmService";

async function main() {
    await initPool();

    const pacientes = await fetchPacientesComRetornos(100);
    console.log(`\n--- ${pacientes.length} pacientes recuperados do Oracle ---`);

    // Mapeia os dados no formato esperado pela API do Gemini
    const pacientesParaLLM = pacientes.map(p => ({
        PRONTUARIO: p.prontuario,
        PACIENTE: p.paciente,
        DATA_CRIACAO: p.dataCriacao,
        OBSERVACAO: p.observacao || ""
    }));

    console.log("\nEnviando observações e datas de criação para a API do Gemini processar...");
    const resultados = await processReturnDates(pacientesParaLLM);

    console.log("\n=== RESULTADOS DO PROCESSAMENTO DE RETORNO (GEMINI) ===");
    console.table(
        resultados.map(r => ({
            "Prontuário": r.prontuario,
            "Paciente": r.nome,
            "Retorno Estimado": r.dataRetorno ? r.dataRetorno.toLocaleDateString('pt-BR') : "Sem Retorno Calculado"
        }))
    );

    console.log("\n=== SALVANDO RESULTADOS NO ORACLE (TABELA fav_lista_espera) ===");
    for (const r of resultados) {
        await updateDtRetornoCalc(r.prontuario, r.dataRetorno);
    }
}

main().catch(console.error);