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

const retornosRoutes: FastifyPluginAsync = async (fastify) => {
    const repository = new OraclePacienteRepository();
    const geminiGateway = new GeminiRetornoGateway();
    const listarUC    = new ListarRetornosUseCase(repository);
    const processarUC = new ProcessarRetornosUseCase(repository, geminiGateway);
    const controller = new RetornosController(listarUC, processarUC);

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
                                    total: { type: "number" },
                                    limit: { type: "number" },
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
                                    totalComRetorno: { type: "number" },
                                    totalSemRetorno: { type: "number" },
                                    totalAtualizados: { type: "number" },
                                    resultados: { type: "array" }
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
