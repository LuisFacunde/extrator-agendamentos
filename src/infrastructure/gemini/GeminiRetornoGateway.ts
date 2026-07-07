import { GoogleGenAI } from "@google/genai";
import type { PacienteComRetornos, PacienteRetorno } from "../../domain/entities/Paciente";

interface DateCandidate {
    date: Date;
    source: string;
    ambulatorio: string | null;
}

interface GeminiPacienteItem {
    prontuario: number;
    dataRetorno: string;
    motivo?: string;
}

export class GeminiRetornoGateway {
    private readonly ai: GoogleGenAI;
    private readonly modelName = "gemini-3.5-flash";

    constructor() {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error("GEMINI_API_KEY não definida nas variáveis de ambiente.");
        }
        this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }

    private parseAmbDate(dateStr: string | null | undefined): Date | null {
        if (!dateStr || dateStr === "-" || dateStr.trim() === "") return null;
        const parts = dateStr.trim().split("/");
        if (parts.length === 2) {
            const year  = parseInt(parts[0] ?? "", 10);
            const month = parseInt(parts[1] ?? "", 10) - 1;
            if (!isNaN(year) && !isNaN(month)) {
                return new Date(year, month, 1);
            }
        }
        return null;
    }

    private parseDDMMYYYY(dateStr: string | null | undefined): Date | null {
        if (
            !dateStr ||
            dateStr === "-" ||
            dateStr.trim() === "" ||
            dateStr === "null" ||
            dateStr === "undefined"
        ) return null;

        const parts = dateStr.trim().split("/");
        if (parts.length === 3) {
            const day   = parseInt(parts[0] ?? "", 10);
            const month = parseInt(parts[1] ?? "", 10) - 1;
            const year  = parseInt(parts[2] ?? "", 10);
            const date  = new Date(year, month, day);
            if (!isNaN(date.getTime())) return date;
        }

        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    }

    private selectBestDate(candidates: DateCandidate[]): DateCandidate | null {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        const future = candidates
            .filter(c => c.date >= now)
            .sort((a, b) => a.date.getTime() - b.date.getTime());

        return future[0] ?? null;
    }

    private async extractDatesFromObservations(
        pacientes: PacienteComRetornos[]
    ): Promise<Map<number, { dataRetorno: Date | null; motivo: string }>> {
        const result = new Map<number, { dataRetorno: Date | null; motivo: string }>();

        const withObs = pacientes.filter(p => p.observacao && p.observacao.trim() !== "");
        if (withObs.length === 0) return result;

        const formattedList = withObs.map((p, i) =>
            `${i + 1}. Prontuário: ${p.prontuario}, Nome: ${p.paciente}, ` +
            `Data Criação: ${p.dataCriacao.toLocaleDateString("pt-BR")}, ` +
            `Observação: "${p.observacao}"`
        ).join("\n");

        const prompt = `Você é um assistente especializado em faturamento e agendamento médico.
                        Sua tarefa é analisar APENAS o campo de OBSERVAÇÃO clínica de cada paciente e extrair a data de retorno mencionada.

                        === REGRAS DE EXTRAÇÃO ===
                        1. Se a observação contiver uma data de retorno específica (ex: "RETORNO EM 07/07/2025"), extraia essa data.
                        2. Se a observação contiver um prazo relativo (ex: "retorno em 3 meses", "retorno em 90 dias"), calcule a data somando o prazo à DATA DE CRIAÇÃO do documento.
                        3. IMPORTANTE: A data NÃO deve ultrapassar 12 meses a partir da data de criação. Se ultrapassar, retorne string vazia.
                        4. Se a observação NÃO indicar retorno (ex: "ENCAIXE", "PACIENTE ALTA", "MOSTRA DE EXAMES", "PRE OP"), retorne string vazia.

                        Lista de Pacientes: ${formattedList}`;
        const responseSchema = {
            type: "OBJECT",
            properties: {
                pacientes: {
                    type: "ARRAY",
                    items: {
                        type: "OBJECT",
                        properties: {
                            prontuario:  { type: "INTEGER",  description: "Número do prontuário." },
                            dataRetorno: { type: "STRING",   description: "Data no formato DD/MM/YYYY ou vazia." },
                            motivo:      { type: "STRING",   description: "Explicação de como a data foi extraída." }
                        },
                        required: ["prontuario", "dataRetorno"]
                    }
                }
            },
            required: ["pacientes"]
        };

        const maxRetries = 3;
        const delayMs    = 3000;
        let   textResponse = "";

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.ai.models.generateContent({
                    model:    this.modelName,
                    contents: prompt,
                    config:   { responseMimeType: "application/json", responseSchema }
                });

                if (!response.text) throw new Error("Resposta vazia da API do Gemini.");
                textResponse = response.text;
                break;
            } catch (error: any) {
                if (attempt >= maxRetries) {
                    console.error("[Gemini] Todas as tentativas falharam:", error);
                    throw error;
                }
                console.warn(
                    `[Gemini] Tentativa ${attempt}/${maxRetries} falhou (${error.message}). ` +
                    `Tentando novamente em ${delayMs / 1000}s...`
                );
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }

        const data = JSON.parse(textResponse) as { pacientes: GeminiPacienteItem[] };
        for (const item of data.pacientes ?? []) {
            result.set(item.prontuario, {
                dataRetorno: this.parseDDMMYYYY(item.dataRetorno),
                motivo: item.motivo ?? ""
            });
        }
        return result;
    }

    async processReturnDates(pacientes: PacienteComRetornos[]): Promise<PacienteRetorno[]> {
        if (!pacientes || pacientes.length === 0) return [];

        console.log("[Gateway] Enviando observações para análise da IA...");
        const observationDates = await this.extractDatesFromObservations(pacientes);
        console.log(`[Gateway] IA retornou resultados para ${observationDates.size} observações.\n`);

        return pacientes.map((p): PacienteRetorno => {
            const candidates: DateCandidate[] = [];

            if (p.mcData && p.mcSetor) {
                const mcDate = this.parseDDMMYYYY(p.mcData);
                if (mcDate) candidates.push({ date: mcDate, source: "Marcação Complementar", ambulatorio: p.mcSetor });
            }


            const ambSlots = [
                { esp: p.ambEspecializado1, dt: p.ambDtRetorno1, label: "Ambulatório 1" },
                { esp: p.ambEspecializado2, dt: p.ambDtRetorno2, label: "Ambulatório 2" },
                { esp: p.ambEspecializado3, dt: p.ambDtRetorno3, label: "Ambulatório 3" },
            ];
            for (const slot of ambSlots) {
                if (slot.esp && slot.dt) {
                    const d = this.parseAmbDate(slot.dt);
                    if (d) candidates.push({ date: d, source: slot.label, ambulatorio: slot.esp });
                }
            }

            const obsResult = observationDates.get(p.prontuario);
            if (obsResult?.dataRetorno) {
                candidates.push({ date: obsResult.dataRetorno, source: "Observação (IA)", ambulatorio: null });
            }

            const best = this.selectBestDate(candidates);

            return {
                prontuario: p.prontuario,
                nome: p.paciente,
                dataRetorno: best?.date ?? null,
                ambulatorio: best?.ambulatorio ?? null,
                marcacaoComplementar: best?.source === "Marcação Complementar",
                fonte: best?.source ?? "Nenhuma fonte identificada",
                motivo: obsResult?.motivo ?? "",
            };
        });
    }
}
