import type { FastifyPluginAsync } from "fastify";
import { OraclePacienteRepository } from "../../infrastructure/database/OraclePacienteRepository";
import { GeminiRetornoGateway } from "../../infrastructure/gemini/GeminiRetornoGateway";
import { ListarRetornosUseCase } from "../../application/use-cases/ListarRetornosUseCase";
import { ProcessarRetornosUseCase } from "../../application/use-cases/ProcessarRetornosUseCase";
import {
    RetornosController,
    type ListarQueryParams,
    type ProcessarBody
} from "../controllers/retornos.controller";

/**
 * CAMADA: API — Rotas (e Composition Root)
 *
 * Este arquivo tem duas responsabilidades:
 *
 * 1. COMPOSITION ROOT:
 *    É o único lugar onde as implementações CONCRETAS são instanciadas e
 *    injetadas nas abstrações. A cadeia de dependências é montada aqui:
 *
 *    OraclePacienteRepository  ─┐
 *                                ├─► ProcessarRetornosUseCase ─► RetornosController
 *    GeminiRetornoGateway      ─┘
 *    OraclePacienteRepository  ──► ListarRetornosUseCase     ─► RetornosController
 *
 * 2. REGISTRO DE ROTAS:
 *    Define os endpoints HTTP e conecta cada rota ao método correto do Controller.
 *
 * Por que aqui e não no server.ts?
 * Manter a composição junto às rotas facilita o isolamento por domínio.
 * Se o projeto crescer, cada módulo/domínio terá seu próprio routes.ts com
 * seu próprio conjunto de dependências.
 */
const retornosRoutes: FastifyPluginAsync = async (fastify) => {

    // -------------------------------------------------------------------------
    // Instanciação das dependências concretas (Composition Root)
    // -------------------------------------------------------------------------

    // Repositório: implementação Oracle do contrato IPacienteRepository
    const repository = new OraclePacienteRepository();

    // Gateway: encapsula a comunicação com a API do Gemini
    const geminiGateway = new GeminiRetornoGateway();

    // Use Cases: recebem dependências via construtor (injeção de dependência)
    const listarUC    = new ListarRetornosUseCase(repository);
    const processarUC = new ProcessarRetornosUseCase(repository, geminiGateway);

    // Controller: recebe os Use Cases via construtor
    const controller = new RetornosController(listarUC, processarUC);

    // -------------------------------------------------------------------------
    // Registro das rotas
    // -------------------------------------------------------------------------

    /**
     * GET /api/retornos?limit=50
     *
     * Consulta os pacientes com seus dados de retorno atuais no Oracle.
     * Não aciona IA. Útil para auditoria e visualização do estado atual.
     *
     * Query Params:
     *   - limit (opcional, default: 100): número máximo de pacientes a retornar.
     */
    fastify.get<{ Querystring: ListarQueryParams }>(
        "/retornos",
        {
            schema: {
                querystring: {
                    type: "object",
                    properties: {
                        limit: { type: "number", minimum: 1, maximum: 1000, default: 100 }
                    }
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                properties: {
                                    total:     { type: "number" },
                                    limit:     { type: "number" },
                                    pacientes: { type: "array" }
                                }
                            }
                        }
                    }
                }
            }
        },
        controller.listar.bind(controller)
    );

    /**
     * POST /api/retornos/processar
     * Body: { "limit": 100 }
     *
     * Executa o fluxo completo: busca Oracle → análise IA (Gemini) → update Oracle.
     * Retorna estatísticas e a lista de resultados individuais.
     *
     * Body:
     *   - limit (obrigatório, 1-1000): número de pacientes a processar nesta execução.
     */
    fastify.post<{ Body: ProcessarBody }>(
        "/retornos/processar",
        {
            schema: {
                body: {
                    type: "object",
                    required: ["limit"],
                    properties: {
                        limit: { type: "number", minimum: 1, maximum: 1000 }
                    }
                },
                response: {
                    200: {
                        type: "object",
                        properties: {
                            success: { type: "boolean" },
                            data: {
                                type: "object",
                                properties: {
                                    totalProcessados: { type: "number" },
                                    totalComRetorno:  { type: "number" },
                                    totalSemRetorno:  { type: "number" },
                                    totalAtualizados: { type: "number" },
                                    resultados:       { type: "array" }
                                }
                            }
                        }
                    }
                }
            }
        },
        controller.processar.bind(controller)
    );
};

export default retornosRoutes;
