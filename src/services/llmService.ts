import { GoogleGenAI } from "@google/genai";
import { Paciente } from "./oracleService";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface PacienteRetorno {
    prontuario: number;
    nome: string;
    dataRetorno: string | null;
    motivo: string;
}

/**
 * Envia as observações e datas de criação de uma lista de pacientes para o Gemini
 * para identificar ou calcular a data de retorno (limite de 12 meses).
 */
export async function processReturnDates(pacientes: Paciente[]): Promise<PacienteRetorno[]> {
    if (!pacientes || pacientes.length === 0) {
        return [];
    }

    // Formata a lista de pacientes de forma limpa para enviar ao prompt
    const formattedList = pacientes.map((p, index) => {
        return `${index + 1}. Prontuário: ${p.PRONTUARIO}, Nome: ${p.PACIENTE}, Data Criação: ${p.DATA_CRIACAO}, Observação: "${p.OBSERVACAO}"`;
    }).join("\n");

    const prompt = `Você é um assistente especializado em faturamento e agendamento médico.
    Sua tarefa é analisar as observações clínicas (OBSERVACAO) e a data de criação do documento (DATA_CRIACAO) para calcular a data de retorno do paciente.

    Regras de Cálculo:
    1. Se a observação contiver uma data de retorno específica (ex: "RETORNO EM 07/07/2025" ou "RETORNO DIA 15/08/2025"), use essa data.
    2. Se a observação contiver um prazo relativo (ex: "retorno em 3 meses", "retorno em 90 dias", "retorno em 2 semanas"), calcule a data de retorno somando esse prazo à data de criação do documento.
    3. IMPORTANTE: A data de retorno calculada NÃO deve ultrapassar 12 meses a partir da data de criação do documento. Se o prazo for superior a 12 meses (ex: "retorno em 18 meses", "retorno em 2 anos"), ou se a data de retorno encontrada for mais de 12 meses após a data de criação, você deve retornar null ou string vazia.
    4. Se a observação NÃO indicar nenhum agendamento/retorno futuro planejado (ex: "ENCAIXE", "PACIENTE ALTA", "MOSTRA DE EXAMES DE URGENCIA", "PRE OP"), retorne null ou string vazia.

    Lista de Pacientes para Análise:
    ${formattedList}
    `;

    let attempt = 0;
    const maxRetries = 3;
    const delayMs = 3000;
    let textResponse = "";

    while (attempt < maxRetries) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-3.5-flash",
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "OBJECT",
                        properties: {
                            pacientes: {
                                type: "ARRAY",
                                items: {
                                    type: "OBJECT",
                                    properties: {
                                        prontuario: {
                                            type: "INTEGER",
                                            description: "Número do prontuário do paciente."
                                        },
                                        nome: {
                                            type: "STRING",
                                            description: "Nome completo do paciente."
                                        },
                                        dataRetorno: {
                                            type: "STRING",
                                            description: "Data calculada do retorno do paciente no formato DD/MM/YYYY. Deve ser nula ou vazia se não aplicável ou superior a 12 meses."
                                        },
                                        motivo: {
                                            type: "STRING",
                                            description: "Breve explicação sobre como a data de retorno foi identificada ou calculada com base na observação."
                                        }
                                    },
                                    required: ["prontuario", "nome", "dataRetorno"]
                                }
                            }
                        },
                        required: ["pacientes"]
                    }
                }
            });

            if (response.text) {
                textResponse = response.text;
                break; // Sucesso, sai do loop
            }
            throw new Error("Resposta vazia da API do Gemini.");
        } catch (error: any) {
            attempt++;
            if (attempt >= maxRetries) {
                console.error("Erro ao processar as datas de retorno com o Gemini após limite de tentativas:", error);
                throw error;
            }
            console.warn(`[Gemini API] Tentativa ${attempt}/${maxRetries} falhou (${error.message || error}). Tentando novamente em ${delayMs / 1000}s...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }

    try {
        const data = JSON.parse(textResponse);
        const resultList = data.pacientes || [];

        return resultList.map((item: any) => {
            const dataRet = item.dataRetorno === "null" || item.dataRetorno === "undefined" || !item.dataRetorno
                ? null
                : item.dataRetorno;
            return {
                prontuario: item.prontuario,
                nome: item.nome,
                dataRetorno: dataRet,
                motivo: item.motivo
            };
        });
    } catch (error) {
        console.error("Erro ao analisar resposta JSON do Gemini:", error);
        throw error;
    }
}
