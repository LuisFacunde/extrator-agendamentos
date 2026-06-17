import type { FastifyRequest, FastifyReply } from "fastify";
import type { ListarRetornosUseCase } from "../../application/use-cases/ListarRetornosUseCase";
import type { ProcessarRetornosUseCase } from "../../application/use-cases/ProcessarRetornosUseCase";
import type { PacienteComRetornos } from "../../domain/entities/Paciente";

// ---------------------------------------------------------------------------
// Tipagem dos parâmetros de cada rota
// ---------------------------------------------------------------------------

/** Query params do GET /api/retornos */
export interface ListarQueryParams {
    limit?: number;
}

/** Body do POST /api/retornos/processar */
export interface ProcessarBody {
    limit: number;
}

/**
 * CAMADA: API — Controller
 *
 * Responsabilidades EXCLUSIVAS deste controller:
 *   1. Extrair e validar parâmetros da requisição HTTP (query params, body)
 *   2. Chamar o Use Case correspondente
 *   3. Formatar e retornar a resposta HTTP padronizada
 *
 * O Controller NÃO contém regras de negócio.
 * O Controller NÃO conhece Oracle, Gemini ou qualquer detalhe de infraestrutura.
 *
 * TRATAMENTO DE ERROS:
 * - Erros propagados pelos Use Cases são capturados aqui.
 * - São retornados como HTTP 500 via `reply.internalServerError()` (do @fastify/sensible),
 *   garantindo que o servidor nunca quebre por uma falha de negócio.
 */
export class RetornosController {

    /**
     * INJEÇÃO DE DEPENDÊNCIA via construtor.
     * O controller recebe os Use Cases já instanciados (pelo Composition Root em routes.ts).
     * Nunca instancia Use Cases ou classes de infraestrutura diretamente.
     */
    constructor(
        private readonly listarUC:    ListarRetornosUseCase,
        private readonly processarUC: ProcessarRetornosUseCase
    ) {}

    /**
     * GET /api/retornos?limit=50
     *
     * Retorna os dados brutos do Oracle com o campo dt_retorno_calc atual.
     * Não aciona a IA. Útil para consultar o estado atual da lista de espera.
     *
     * @param limit - Query param opcional (default: 100). Máximo de pacientes.
     */
    async listar(
        request: FastifyRequest<{ Querystring: ListarQueryParams }>,
        reply: FastifyReply
    ): Promise<void> {
        try {
            const limit = Number(request.query.limit ?? 100);

            if (isNaN(limit) || limit < 1 || limit > 1000) {
                return reply.status(400).send({
                    success: false,
                    error: "O parâmetro `limit` deve ser um número entre 1 e 1000."
                });
            }

            const pacientes = await this.listarUC.execute(limit);

            return reply.status(200).send({
                success: true,
                data: {
                    total: pacientes.length,
                    limit,
                    pacientes: pacientes.map((p: PacienteComRetornos) => ({
                        prontuario:       p.prontuario,
                        paciente:         p.paciente,
                        dataCriacao:      p.dataCriacao.toLocaleDateString("pt-BR"),
                        dtRetornoCalc:    p.dtRetornoCalc?.toLocaleDateString("pt-BR") ?? null,
                        observacao:       p.observacao ?? null,
                        ambEspecializado1: p.ambEspecializado1,
                        ambDtRetorno1:    p.ambDtRetorno1,
                        ambEspecializado2: p.ambEspecializado2,
                        ambDtRetorno2:    p.ambDtRetorno2,
                        ambEspecializado3: p.ambEspecializado3,
                        ambDtRetorno3:    p.ambDtRetorno3,
                        mcData:           p.mcData,
                        mcSetor:          p.mcSetor,
                    }))
                }
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Erro desconhecido";
            request.log.error({ err }, `[Controller] Erro em GET /retornos: ${message}`);
            return reply.internalServerError(`Erro ao listar retornos: ${message}`);
        }
    }

    /**
     * POST /api/retornos/processar
     * Body: { "limit": 100 }
     *
     * Executa o fluxo completo: busca → IA (Gemini) → update no Oracle.
     * Retorna um resumo com estatísticas e os resultados individuais.
     *
     * @param limit - Número de pacientes a processar (obrigatório no body).
     */
    async processar(
        request: FastifyRequest<{ Body: ProcessarBody }>,
        reply: FastifyReply
    ): Promise<void> {
        try {
            const { limit } = request.body;

            if (!limit || isNaN(limit) || limit < 1 || limit > 1000) {
                return reply.status(400).send({
                    success: false,
                    error: "O campo `limit` no body deve ser um número entre 1 e 1000."
                });
            }

            request.log.info(`[Controller] Iniciando processamento para limit=${limit}`);
            const resultado = await this.processarUC.execute(limit);

            return reply.status(200).send({
                success: true,
                data: {
                    totalProcessados: resultado.totalProcessados,
                    totalComRetorno:  resultado.totalComRetorno,
                    totalSemRetorno:  resultado.totalSemRetorno,
                    totalAtualizados: resultado.totalAtualizados,
                    resultados: resultado.resultados.map(r => ({
                        prontuario:           r.prontuario,
                        nome:                 r.nome,
                        dataRetorno:          r.dataRetorno?.toLocaleDateString("pt-BR") ?? null,
                        ambulatorio:          r.ambulatorio,
                        marcacaoComplementar: r.marcacaoComplementar,
                        fonte:                r.fonte,
                        motivo:               r.motivo || null,
                    }))
                }
            });
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Erro desconhecido";
            request.log.error({ err }, `[Controller] Erro em POST /retornos/processar: ${message}`);
            return reply.internalServerError(`Erro ao processar retornos: ${message}`);
        }
    }
}
