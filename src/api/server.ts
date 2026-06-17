import "dotenv/config";
import Fastify, { type FastifyError } from "fastify";
import sensible from "@fastify/sensible";
import oraclePlugin from "./plugins/oracle.plugin";
import retornosRoutes from "./routes/retornos.routes";

/**
 * CAMADA: API — Entry Point do Servidor
 *
 * Responsabilidades:
 *   1. Configurar a instância do Fastify (logger, etc.)
 *   2. Registrar plugins globais (Oracle, Sensible)
 *   3. Registrar as rotas por domínio
 *   4. Configurar o error handler global
 *   5. Iniciar o servidor na porta configurada
 *
 * SEPARAÇÃO buildServer/main:
 * A função `buildServer()` é exportada para facilitar testes de integração
 * (permite criar a instância sem iniciar o servidor de rede).
 */

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

/**
 * Constrói e configura a instância do Fastify.
 * Não inicia o servidor — apenas configura plugins e rotas.
 */
export async function buildServer() {
    const fastify = Fastify({
        /**
         * Logger estruturado com pino-pretty em desenvolvimento.
         * Em produção (NODE_ENV=production), usa JSON puro para compatibilidade
         * com sistemas de log centralizados (ex: Datadog, ELK).
         */
        logger: process.env.NODE_ENV !== "production"
            ? {
                level: "info",
                transport: {
                    target: "pino-pretty",
                    options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" }
                }
            }
            : { level: "info" }
    });

    // -------------------------------------------------------------------------
    // Plugins Globais
    // -------------------------------------------------------------------------

    /**
     * @fastify/sensible: adiciona métodos de erro HTTP padronizados ao reply.
     * Ex: reply.notFound(), reply.badRequest(), reply.internalServerError()
     * Documentação: https://github.com/fastify/fastify-sensible
     */
    await fastify.register(sensible);

    /**
     * Oracle Plugin: inicializa o pool de conexões Oracle no startup.
     * Se a conexão falhar, o servidor não iniciará.
     */
    await fastify.register(oraclePlugin);

    // -------------------------------------------------------------------------
    // Rotas por Domínio
    // -------------------------------------------------------------------------

    /**
     * Todas as rotas do domínio de retornos são prefixadas com /api.
     * Resultado: GET /api/retornos | POST /api/retornos/processar
     */
    await fastify.register(retornosRoutes, { prefix: "/api" });

    // -------------------------------------------------------------------------
    // Error Handler Global
    // -------------------------------------------------------------------------

    /**
     * Captura qualquer erro não tratado pelos controllers.
     * Garante que falhas inesperadas (ex: erros ORA-* não capturados,
     * ou erros na API do Gemini) retornem uma resposta HTTP 500 formatada,
     * sem derrubar o servidor.
     */
    fastify.setErrorHandler((error: FastifyError, request, reply) => {
        fastify.log.error(
            { err: error, method: request.method, url: request.url },
            "Erro não tratado capturado pelo error handler global"
        );
        reply.status(error.statusCode ?? 500).send({
            success: false,
            error:   error.message ?? "Erro interno do servidor",
            ...(process.env.NODE_ENV !== "production" && { stack: error.stack })
        });
    });

    // -------------------------------------------------------------------------
    // Health Check (utilitário)
    // -------------------------------------------------------------------------
    fastify.get("/health", async () => ({
        status:  "ok",
        version: process.env.npm_package_version ?? "1.0.0",
        time:    new Date().toISOString()
    }));

    return fastify;
}

/**
 * Ponto de entrada principal.
 * Constrói o servidor e inicia a escuta na porta configurada.
 */
async function main(): Promise<void> {
    const fastify = await buildServer();

    try {
        await fastify.listen({ port: PORT, host: HOST });
        fastify.log.info(`Servidor iniciado em http://${HOST}:${PORT}`);
    } catch (err) {
        fastify.log.error(err, "Falha ao iniciar o servidor");
        process.exit(1);
    }
}

main();
